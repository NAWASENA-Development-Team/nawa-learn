// tests/unit/badges.test.ts
// ─── Lencana: katalog di server, tampilan di klien ────────────────────────────
//
// Sebelum M14e seluruh katalog — 85 definisi beserta 85 fungsi `unlockCondition`,
// delapan di antaranya syarat lencana **rahasia** — ikut ke bundel browser.
// `unlockCondition.toString()` dari DevTools sudah cukup untuk membacanya, dan
// panel moderator bahkan mengevaluasi kondisi itu di klien.
//
// Test ini menjaga tiga sifat yang, kalau rusak, rusaknya tidak terlihat di HTML:
//
//   1. Katalog tetap utuh dan setiap lencana tetap bisa dievaluasi (85 lencana
//      adalah janji produk, bukan angka yang kebetulan).
//   2. `BadgeDisplay` tidak pernah membawa `unlockCondition`, dan lencana rahasia
//      yang belum dibuka keluar dalam bentuk yang sudah diperah.
//   3. Tidak ada komponen klien yang mengimpor `catalog.ts`/`evaluate.ts` — satu
//      impor saja akan menyeret delapan syarat rahasia kembali ke bundel.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "../helpers/source";

import { BADGE_DEFINITIONS, getBadgesByCategory } from "@/lib/badges/catalog";
import {
  BADGE_TOTAL,
  buildBadgeUnlockData,
  evaluateBadges,
  getDaysOldAccount,
  getHiddenBadgeDisplays,
  toBadgeDisplays,
} from "@/lib/badges/evaluate";
import {
  BADGE_CATEGORY_ORDER,
  getRarityColor,
  getRarityTextColor,
  getSpecialtyBadge,
} from "@/lib/badges/display";
import type { BadgeUnlockData, SpecialtyStats } from "@/lib/badges/types";

const ZERO_SPECIALTY: SpecialtyStats = {
  hardQuizzes: 0,
  approvedMods: 0,
  diverseSubjects: 0,
  quizTotal: 0,
  approvedQuestions: 0,
  totalDownloads: 0,
};

const ZEROED: BadgeUnlockData = {
  points: 0,
  rank: 0,
  approvedModules: 0,
  approvedQuestions: 0,
  totalDownloads: 0,
  modulesBySubject: {},
  accountAgeInDays: 0,
};

/** Akun yang memenuhi **semua** delapan syarat lencana rahasia. */
const POWER_USER: BadgeUnlockData = {
  points: 6000,
  rank: 1,
  approvedModules: 60,
  approvedQuestions: 60,
  totalDownloads: 3000,
  modulesBySubject: { Matematika: 20, Fisika: 15, Biologi: 15, Sejarah: 10 },
  accountAgeInDays: 400,
};

describe("katalog lencana", () => {
  it("berisi seluruh 85 lencana", () => {
    expect(BADGE_TOTAL).toBe(85);
    expect(BADGE_DEFINITIONS.length).toBe(BADGE_TOTAL);
  });

  it("memakai id yang unik", () => {
    const ids = BADGE_DEFINITIONS.map((badge) => badge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lengkap metadatanya di setiap lencana", () => {
    for (const badge of BADGE_DEFINITIONS) {
      expect(badge.title.length).toBeGreaterThan(0);
      expect(badge.description.length).toBeGreaterThan(0);
      expect(badge.icon.length).toBeGreaterThan(0);
      expect(badge.howToUnlock.length).toBeGreaterThan(0);
      expect(typeof badge.unlockCondition).toBe("function");
      expect(["common", "uncommon", "rare", "epic", "legendary"]).toContain(badge.rarity);
      expect(BADGE_CATEGORY_ORDER).toContain(badge.category);
    }
  });

  it("memberi setiap lencana rahasia syarat yang bisa dibaca moderator", () => {
    // `requirement` adalah satu-satunya jalan panel moderator menampilkan syarat
    // rahasia. Kalau ada lencana tersembunyi tanpa teks ini, panelnya hanya
    // menampilkan "—" dan moderator kehilangan satu-satunya keterangan.
    const hidden = BADGE_DEFINITIONS.filter((badge) => badge.hidden);
    expect(hidden.length).toBe(8);
    for (const badge of hidden) {
      expect(badge.requirement?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("tidak pernah melempar untuk akun yang baru dibuat", () => {
    for (const badge of BADGE_DEFINITIONS) {
      expect(() => badge.unlockCondition(ZEROED)).not.toThrow();
    }
  });

  it("tidak membagikan semuanya ke akun tanpa usaha", () => {
    const locked = BADGE_DEFINITIONS.filter((badge) => !badge.unlockCondition(ZEROED));
    expect(locked.length).toBeGreaterThan(0);
  });

  it("getBadgesByCategory mencakup setiap kategori yang punya lencana", () => {
    const total = BADGE_CATEGORY_ORDER.reduce(
      (sum, category) => sum + getBadgesByCategory(category).length,
      0,
    );
    expect(total).toBe(BADGE_DEFINITIONS.length);
  });

  it("getBadgesByCategory hanya mengembalikan kategori yang diminta", () => {
    const milestones = getBadgesByCategory("milestone");
    expect(milestones.length).toBeGreaterThan(0);
    expect(milestones.every((badge) => badge.category === "milestone")).toBe(true);
  });
});

describe("getRarityColor / getRarityTextColor", () => {
  it("mengembalikan kelas untuk setiap tingkat kelangkaan", () => {
    for (const rarity of ["common", "uncommon", "rare", "epic", "legendary"] as const) {
      expect(getRarityColor(rarity).length).toBeGreaterThan(0);
      expect(getRarityTextColor(rarity).length).toBeGreaterThan(0);
    }
  });
});

describe("getDaysOldAccount", () => {
  it("menghitung hari penuh sejak pendaftaran", () => {
    const now = new Date("2026-08-15T12:00:00Z");
    expect(getDaysOldAccount("2026-08-15T11:00:00Z", now)).toBe(0);
    expect(getDaysOldAccount("2026-08-14T12:00:00Z", now)).toBe(1);
    expect(getDaysOldAccount("2026-07-16T12:00:00Z", now)).toBe(30);
  });

  it("menerima Date maupun string ISO", () => {
    const now = new Date("2026-08-15T12:00:00Z");
    expect(getDaysOldAccount(new Date("2026-08-14T12:00:00Z"), now)).toBe(1);
  });
});

describe("buildBadgeUnlockData", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const now = new Date("2026-04-11T00:00:00Z"); // 100 hari

  it("mengambil angka modul/soal/unduhan dari SpecialtyStats, bukan dari daftar baris", () => {
    const data = buildBadgeUnlockData({
      points: 42,
      rank: 3,
      specialty: { ...ZERO_SPECIALTY, approvedMods: 7, approvedQuestions: 9, totalDownloads: 250 },
      modulesBySubject: { Matematika: 4 },
      createdAt,
      now,
    });

    expect(data.approvedModules).toBe(7);
    expect(data.approvedQuestions).toBe(9);
    expect(data.totalDownloads).toBe(250);
    expect(data.modulesBySubject).toEqual({ Matematika: 4 });
    expect(data.accountAgeInDays).toBe(100);
  });

  it("hanya membawa field yang benar-benar dibaca kondisi lencana", () => {
    const data = buildBadgeUnlockData({
      points: 0,
      rank: 0,
      specialty: ZERO_SPECIALTY,
      modulesBySubject: {},
      createdAt,
      now,
    });

    expect(Object.keys(data).sort()).toEqual([
      "accountAgeInDays",
      "approvedModules",
      "approvedQuestions",
      "modulesBySubject",
      "points",
      "rank",
      "totalDownloads",
    ]);
  });
});

describe("evaluateBadges", () => {
  it("mengembalikan id, bukan objek lencana", () => {
    const unlocked = evaluateBadges(POWER_USER);
    expect(unlocked.length).toBeGreaterThan(0);
    for (const id of unlocked) expect(typeof id).toBe("string");
  });

  it("membuka seluruh delapan lencana rahasia untuk akun yang memenuhi semuanya", () => {
    const hidden = getBadgesByCategory("hidden").map((badge) => badge.id);
    expect(hidden.length).toBe(8);

    const unlocked = new Set(evaluateBadges(POWER_USER));
    for (const id of hidden) expect(unlocked.has(id)).toBe(true);
  });

  it("tidak membuka satu pun lencana rahasia untuk akun tanpa usaha", () => {
    const hidden = new Set(getBadgesByCategory("hidden").map((badge) => badge.id));
    const unlocked = evaluateBadges(ZEROED).filter((id) => hidden.has(id));
    expect(unlocked).toEqual([]);
  });

  it("hanya mengembalikan id yang benar-benar ada di katalog", () => {
    const known = new Set(BADGE_DEFINITIONS.map((badge) => badge.id));
    for (const id of evaluateBadges(POWER_USER)) expect(known.has(id)).toBe(true);
  });
});

describe("toBadgeDisplays", () => {
  it("mengirim satu entri per lencana", () => {
    const displays = toBadgeDisplays({ unlockedIds: [], isModerator: false });
    expect(displays.length).toBe(BADGE_TOTAL);
  });

  it("tidak pernah membawa fungsi kondisi", () => {
    const displays = toBadgeDisplays({ unlockedIds: evaluateBadges(POWER_USER), isModerator: false });
    for (const display of displays) {
      expect("unlockCondition" in display).toBe(false);
      // Serialisasi adalah batas sebenarnya: sebuah fungsi tidak selamat.
      expect(() => JSON.stringify(display)).not.toThrow();
    }
  });

  it("memerahkan lencana rahasia yang belum dibuka untuk siswa", () => {
    const displays = toBadgeDisplays({ unlockedIds: [], isModerator: false });
    const hidden = displays.filter((display) => display.hidden);

    expect(hidden.length).toBe(8);
    for (const display of hidden) {
      expect(display.redacted).toBe(true);
      expect(display.title).toBe("???");
      expect(display.icon).toBe("❓");
      expect(display.howToUnlock).toBe("???");
      expect(display.unlocked).toBe(false);
    }
  });

  it("tidak memerahkan lencana rahasia yang sudah dibuka pemiliknya", () => {
    const unlockedIds = getBadgesByCategory("hidden").map((badge) => badge.id);
    const displays = toBadgeDisplays({ unlockedIds, isModerator: false });

    for (const display of displays.filter((entry) => entry.hidden)) {
      expect(display.redacted).toBe(false);
      expect(display.unlocked).toBe(true);
      expect(display.title).not.toBe("???");
    }
  });

  it("tidak memerahkan apa pun untuk moderator", () => {
    const displays = toBadgeDisplays({ unlockedIds: [], isModerator: true });
    expect(displays.some((display) => display.redacted)).toBe(false);
  });

  it("hanya mengisi requirement bila diminta **dan** penontonnya moderator", () => {
    const forStudent = toBadgeDisplays({
      unlockedIds: [],
      isModerator: false,
      includeRequirement: true,
    });
    expect(forStudent.every((display) => display.requirement === undefined)).toBe(true);

    const forModeratorWithoutFlag = toBadgeDisplays({ unlockedIds: [], isModerator: true });
    expect(forModeratorWithoutFlag.every((display) => display.requirement === undefined)).toBe(true);

    const forModerator = toBadgeDisplays({
      unlockedIds: [],
      isModerator: true,
      includeRequirement: true,
    });
    for (const display of forModerator) {
      if (!display.hidden) {
        // `requirement` hanya untuk lencana rahasia; lencana biasa sudah punya
        // `howToUnlock` yang memang boleh dibaca siswa.
        expect(display.requirement).toBeUndefined();
        continue;
      }
      expect(typeof display.requirement).toBe("string");
      expect(display.requirement?.length).toBeGreaterThan(0);
      // Teks yang ditulis tangan, bukan potongan fungsi: tidak ada nama
      // parameter, panah, kurung kurawal, atau baris baru yang bocor ke panel.
      expect(display.requirement).not.toContain("=>");
      expect(display.requirement).not.toContain("data.");
      expect(display.requirement).not.toMatch(/[{}]/);
      expect(display.requirement).not.toContain("\n");
    }
  });

  it("menulis syarat rahasia sebagai kalimat, bukan kode", () => {
    // Dulu teks ini diturunkan dari `unlockCondition.toString()`, yang membaca
    // fungsi **terkompilasi**: `3000` keluar sebagai `3e3` dan di bundel
    // produksi `data` menjadi `e`. Sekarang teksnya ada di katalog.
    const byId = new Map(
      getHiddenBadgeDisplays({ includeRequirement: true }).map((display) => [
        display.id,
        display.requirement,
      ]),
    );
    expect(byId.get("shadow_pioneer")).toBe("Poin minimal 3000.");
    expect(byId.get("midnight_scholar")).toBe("Minimal 50 modul disetujui.");
    expect(byId.get("eternal_flame")).toBe(
      "Akun berumur minimal 365 hari, poin minimal 2000, dan 20 modul disetujui.",
    );
  });

  it("bisa dibatasi ke satu kategori", () => {
    const displays = toBadgeDisplays({ unlockedIds: [], isModerator: false, category: "hidden" });
    expect(displays.length).toBe(8);
    expect(displays.every((display) => display.category === "hidden")).toBe(true);
  });
});

describe("getHiddenBadgeDisplays", () => {
  it("mengembalikan delapan lencana rahasia lengkap dengan syaratnya", () => {
    const displays = getHiddenBadgeDisplays({ includeRequirement: true });
    expect(displays.length).toBe(8);
    for (const display of displays) {
      expect(display.hidden).toBe(true);
      expect(display.redacted).toBe(false);
      expect(display.requirement).toBeTruthy();
    }
  });

  it("menyembunyikan syarat dari pemegang kursi musim", () => {
    // Kursi hanya memegang amanah satu musim. Ia tetap perlu melihat **siapa**
    // memegang lencana rahasia (bagian pekerjaan moderasi), tetapi syarat yang
    // terbaca adalah syarat yang bisa diakali.
    const displays = getHiddenBadgeDisplays({ includeRequirement: false });
    expect(displays.length).toBe(8);
    for (const display of displays) {
      expect(display.hidden).toBe(true);
      expect(display.requirement).toBeUndefined();
    }
  });
});

describe("getSpecialtyBadge", () => {
  it("mengembalikan null di luar podium bila peringkat diberikan", () => {
    expect(getSpecialtyBadge(ZERO_SPECIALTY, 4)).toBeNull();
  });

  it("tetap memberi lencana untuk tiga besar", () => {
    expect(getSpecialtyBadge(ZERO_SPECIALTY, 1)).not.toBeNull();
  });

  it("mengutamakan angka yang paling mengesankan", () => {
    expect(
      getSpecialtyBadge({ ...ZERO_SPECIALTY, totalDownloads: 100, approvedQuestions: 50 })?.name,
    ).toBe("Viral Educator");
  });

  it("jatuh ke lencana bawaan, bukan mengembalikan kosong", () => {
    expect(getSpecialtyBadge(ZERO_SPECIALTY)?.name).toBe("Legend Scholar");
  });
});

// ─── Katalog tidak boleh bocor ke bundel browser ──────────────────────────────
//
// Diperiksa dari **sumber**, bukan dari HTML: impor yang salah tidak mengubah
// markup apa pun, dan hasilnya hanya terlihat sebagai 85 fungsi kondisi yang
// bisa dibaca dari DevTools.
const SRC = path.resolve(process.cwd(), "src");

function walk(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, extensions));
    else if (extensions.some((extension) => entry.endsWith(extension))) out.push(full);
  }
  return out;
}

const relative = (file: string) => path.relative(SRC, file).replace(/\\/g, "/");
const read = (file: string) => readFileSync(file, "utf8");

const readCode = (file: string) => withoutComments(read(file));

describe("katalog lencana tetap di server", () => {
  it("barrel `@/lib/badges` tidak mengekspor katalog maupun evaluator", () => {
    const barrel = readCode(path.join(SRC, "lib/badges/index.ts"));
    expect(barrel).not.toContain("./catalog");
    expect(barrel).not.toContain("./evaluate");
  });

  it("tidak ada komponen klien yang mengimpor catalog/evaluate", () => {
    // `src/components/**` adalah permukaan klien. Halaman dan rute boleh
    // mengimpor evaluator: keduanya berjalan di server.
    const componentFiles = walk(path.join(SRC, "components"), [".ts", ".tsx"]);
    expect(componentFiles.length).toBeGreaterThan(0);

    const offenders = componentFiles
      .filter((file) => /@\/lib\/badges\/(catalog|evaluate)/.test(readCode(file)))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  it("tidak ada komponen klien yang menyentuh definisi/kondisi lencana", () => {
    const componentFiles = walk(path.join(SRC, "components"), [".ts", ".tsx"]);
    const offenders = componentFiles
      .filter((file) => /\bBADGE_DEFINITIONS\b|\bunlockCondition\b/.test(readCode(file)))
      .map(relative);

    expect(offenders).toEqual([]);
  });
});
