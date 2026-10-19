// src/lib/badges/evaluate.ts
// ─── Satu tempat yang memutuskan siapa berhak atas sebuah lencana ─────────────
//
// Sebelum M14e keputusan ini diambil di browser, dari baris yang kebetulan
// dimuat untuk ditampilkan. Halaman profil menyaring `userModules` dan
// `userQuestions` sendiri, sehingga `approvedModules` di lencana dan
// `approvedMods` di lencana spesialis berasal dari **dua sumber berbeda** —
// persis pola yang membuat papan peringkat dan profil berbeda pendapat sebelum
// M13. Sekarang server yang menghitung semuanya dari SQL (`getSpecialtyStats`
// dan `getSubjectBreakdown`), dan klien hanya menerima hasilnya.
//
// Modul ini **hanya untuk server**. Ia mengimpor `catalog.ts`, yang berisi 85
// fungsi kondisi; kalau berkas ini ikut ke bundel browser, seluruh kondisi
// rahasia ikut serta.
//
// ## Kenapa `toBadgeDisplays` memerah, bukan menyembunyikan saat render
// Versi lama mengirim judul dan deskripsi asli dari delapan lencana rahasia ke
// setiap browser dan menyembunyikannya dengan CSS/logika render. Data itu tetap
// ada di payload RSC: cukup buka DevTools dan lencana "rahasia" bukan rahasia
// lagi. Sekarang yang menyeberang hanya salinan yang sudah diperah — siswa tidak
// bisa membaca apa yang tidak pernah dikirim.

import { BADGE_DEFINITIONS } from "./catalog";
import type {
  Badge,
  BadgeCategory,
  BadgeDisplay,
  BadgeUnlockData,
  SpecialtyStats,
} from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Usia akun dalam hari penuh.
 *
 * `now` bisa diberikan supaya pengujian tidak bergantung pada jam dinding; di
 * produksi pemanggil membiarkannya kosong.
 */
export function getDaysOldAccount(
  createdAt: Date | string,
  now: Date = new Date(),
): number {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return Math.floor((now.getTime() - created.getTime()) / MS_PER_DAY);
}

export interface BadgeUnlockInput {
  points: number;
  rank: number;
  specialty: SpecialtyStats;
  modulesBySubject: Record<string, number>;
  createdAt: Date | string;
  /** Diisi hanya oleh pengujian. */
  now?: Date;
}

/**
 * Menyusun potret evaluasi dari angka yang **sudah** dihitung database.
 *
 * Fungsi ini tidak menyentuh database dan tidak membaca baris apa pun; ia hanya
 * memindahkan nama field. Itu yang membuatnya bisa diuji langsung, dan itu juga
 * yang membuat "angka lencana berasal dari SQL" menjadi sifat yang bisa
 * dibuktikan, bukan komentar.
 *
 * `approvedModules`/`approvedQuestions`/`totalDownloads` diambil dari
 * `specialty` — bukan dari `modulesBySubject` dan bukan dari daftar baris.
 */
export function buildBadgeUnlockData(input: BadgeUnlockInput): BadgeUnlockData {
  return {
    points: input.points,
    rank: input.rank,
    approvedModules: input.specialty.approvedMods,
    approvedQuestions: input.specialty.approvedQuestions,
    totalDownloads: input.specialty.totalDownloads,
    modulesBySubject: input.modulesBySubject,
    accountAgeInDays: getDaysOldAccount(input.createdAt, input.now),
  };
}

/**
 * Id lencana yang terbuka untuk potret ini.
 *
 * Dikembalikan sebagai `string[]` (bukan objek `Badge`) supaya pemanggil tidak
 * punya kesempatan menyebarkan fungsi kondisi ke payload — kesalahan yang mudah
 * terjadi kalau hasilnya berupa objek.
 */
export function evaluateBadges(data: BadgeUnlockData): string[] {
  return BADGE_DEFINITIONS.filter((badge) => badge.unlockCondition(data)).map(
    (badge) => badge.id,
  );
}

/** Versi pengganti untuk lencana rahasia yang belum dibuka siswa biasa. */
const MYSTERY_TITLE = "???";
const MYSTERY_DESCRIPTION =
  "Cara membuka lencana ini hanya diketahui moderator.";
const MYSTERY_ICON = "❓";

function toDisplay(
  badge: Badge,
  options: { unlocked: boolean; isModerator: boolean; includeRequirement: boolean },
): BadgeDisplay {
  const redacted = Boolean(badge.hidden) && !options.isModerator && !options.unlocked;

  const display: BadgeDisplay = {
    id: badge.id,
    title: redacted ? MYSTERY_TITLE : badge.title,
    description: redacted ? MYSTERY_DESCRIPTION : badge.description,
    icon: redacted ? MYSTERY_ICON : badge.icon,
    category: badge.category,
    rarity: badge.rarity,
    howToUnlock: redacted ? MYSTERY_TITLE : badge.howToUnlock,
    hidden: Boolean(badge.hidden),
    unlocked: options.unlocked,
    redacted,
  };

  if (options.includeRequirement && options.isModerator && badge.requirement) {
    // Teks yang ditulis tangan, bukan `unlockCondition.toString()`: lihat
    // komentar `Badge.requirement` di `types.ts` — fungsi yang dibaca di sini
    // sudah dikompilasi, jadi sumbernya tidak lagi menyerupai kode aslinya.
    display.requirement = badge.requirement;
  }

  return display;
}

export interface BadgeDisplayOptions {
  /** Id yang sudah terbuka — hasil `evaluateBadges()`. */
  unlockedIds: readonly string[];
  /** Peran **penonton**, bukan pemilik profil. */
  isModerator: boolean;
  /**
   * Sertakan `requirement` (syarat dalam bahasa manusia). Hanya untuk panel
   * moderator, dan hanya berlaku bila `isModerator` juga `true` — dua syarat,
   * karena satu salah setelan sudah cukup untuk membocorkan delapan syarat
   * rahasia.
   */
  includeRequirement?: boolean;
  /** Batasi ke satu kategori. */
  category?: BadgeCategory;
}

/**
 * Katalog dalam bentuk yang boleh menyeberangi batas server/klien.
 *
 * `unlocked` dihitung di sini sehingga komponen klien tidak perlu — dan tidak
 * bisa — mengevaluasi kondisi apa pun.
 */
export function toBadgeDisplays(options: BadgeDisplayOptions): BadgeDisplay[] {
  const unlocked = new Set(options.unlockedIds);
  const source = options.category
    ? BADGE_DEFINITIONS.filter((badge) => badge.category === options.category)
    : BADGE_DEFINITIONS;

  return source.map((badge) =>
    toDisplay(badge, {
      unlocked: unlocked.has(badge.id),
      isModerator: options.isModerator,
      includeRequirement: Boolean(options.includeRequirement),
    }),
  );
}

/**
 * Lencana tersembunyi saja, lengkap dengan syaratnya — untuk panel moderator.
 *
 * Fungsi terpisah, bukan `toBadgeDisplays({ category: "hidden" })`, karena nama
 * yang menyebut "hidden" di satu-satunya pemanggilnya membuat niatnya terbaca:
 * ini permukaan moderator, dan `includeRequirement` tidak punya jalan lain
 * untuk aktif.
 */
export function getHiddenBadgeDisplays(): BadgeDisplay[] {
  return toBadgeDisplays({
    unlockedIds: [],
    isModerator: true,
    includeRequirement: true,
    category: "hidden",
  });
}

/** Katalog penuh untuk moderator (mis. hitungan "x / y" di panel). */
export const BADGE_TOTAL = BADGE_DEFINITIONS.length;

/** Lencana menurut kategori, untuk panel dan pengujian. */
export function getBadgesByCategory(category: BadgeCategory): Badge[] {
  return BADGE_DEFINITIONS.filter((badge) => badge.category === category);
}
