// src/lib/seat.ts
// ─── Kursi musim: siapa yang duduk, dan siapa yang tidak boleh disentuh ───────
// Tiga teratas papan peringkat musim memegang kursi moderator selama musim itu.
// Kursi adalah **fakta turunan**: tidak ada tabel `seat` yang harus dijaga
// konsisten dengan papan peringkat, karena tabel seperti itu akan menjadi salinan
// kedua dari kebenaran yang sama dan cepat atau lambat berbeda.
//
// Yang disimpan di database hanya `users.season_role_key` — asal-usul peran, bukan
// keabsahannya. Keabsahan diputuskan `isSeatActive()` dari kunci musim berjalan,
// jadi kursi berakhir karena kalender berganti, bukan karena ada job yang
// kebetulan berjalan.
//
// Modul ini juga pemilik definisi **zona konflik** (I5): pemegang kursi tidak
// boleh menyetujui atau menolak karya sepuluh besar. Kursi dan pesaingnya berada
// di papan yang sama; membiarkan kursi memberi nilai kepada pesaing terdekatnya
// adalah konflik kepentingan yang nyata, bukan teoretis.

import { and, count, desc, sql } from "drizzle-orm";
import type { AppDb } from "@/db/types";
import { users } from "@/db/schema";
import { IS_PARTICIPANT } from "@/lib/participants";
import { effectiveSeasonPoints } from "@/lib/season";

/** Jumlah kursi yang diperebutkan. */
export const SEAT_COUNT = 3;

/**
 * Batas zona konflik: peringkat 1–10 tidak boleh disentuh pemegang kursi.
 *
 * Sepuluh, bukan tiga: tiga teratas adalah lawan langsung hari ini, tetapi
 * peringkat keempat sampai kesepuluh bisa masuk podium dalam satu kiriman soal
 * yang disetujui. Batas yang lebih lebar membuat "menyetujui karya sendiri lewat
 * teman" tidak lagi menguntungkan secara langsung.
 */
export const CONFLICT_ZONE_RANK = 10;

/**
 * Peringkat seorang pengguna di papan musim, memakai definisi yang sama dengan
 * `(dashboard)/leaderboard/page.tsx`: peserta saja, poin musim **efektif**, dan
 * `id` sebagai pemecah seri.
 *
 * Peringkat = jumlah peserta dengan poin efektif lebih tinggi + 1. Karena `id`
 * unik, tidak ada dua pengguna yang mendapat peringkat sama — persis seperti
 * `desc(users.id)` pada daftar, sehingga "peringkat 4" di papan dan di sini
 * selalu orang yang sama.
 *
 * Pengguna yang tidak ada (id asing) mengembalikan `Number.MAX_SAFE_INTEGER`,
 * bukan 0: nilai itu berarti "tidak ada di zona konflik", dan pemanggil tidak
 * perlu membedakan "tidak ada" dari "sangat jauh di bawah".
 */
export async function rankOf(db: AppDb, userId: string): Promise<number> {
  const [self] = await db
    .select({ points: effectiveSeasonPoints() })
    .from(users)
    .where(and(IS_PARTICIPANT, sql`${users.id} = ${userId}`))
    .limit(1);

  if (!self) return Number.MAX_SAFE_INTEGER;

  const [higher] = await db
    .select({ value: count() })
    .from(users)
    .where(and(IS_PARTICIPANT, sql`${effectiveSeasonPoints()} > ${self.points}`));

  return (higher?.value ?? 0) + 1;
}

/**
 * Apakah pengguna ini berada di zona konflik untuk pemegang kursi.
 *
 * Hanya dipanggil pada jalur pemegang kursi. Staf manusia tidak diperiksa: ia
 * memang pemutus akhir, dan membatasinya akan membuat antrean berhenti ketika
 * satu-satunya moderator yang aktif juga berada di sepuluh besar.
 */
export async function isInConflictZone(db: AppDb, userId: string): Promise<boolean> {
  return (await rankOf(db, userId)) <= CONFLICT_ZONE_RANK;
}

export type PodiumEntry = {
  userId: string;
  points: number;
};

/**
 * Tiga teratas musim berjalan, sudah tersaring: peserta, poin efektif > 0.
 *
 * Syarat `> 0` wajib. Tanpa itu, pada detik pertama sebuah kuartal semua poin
 * masih nol dan tiga UUID sembarang akan menerima kursi — bukan karena mereka
 * menang, tetapi karena mereka kebetulan diurutkan lebih dulu.
 */
export async function getPodium(db: AppDb, limit: number = SEAT_COUNT): Promise<PodiumEntry[]> {
  const seasonPoints = effectiveSeasonPoints();

  const rows = await db
    .select({ userId: users.id, points: seasonPoints })
    .from(users)
    .where(and(IS_PARTICIPANT, sql`${seasonPoints} > 0`))
    .orderBy(desc(seasonPoints), desc(users.id))
    .limit(limit);

  return rows.map((row) => ({ userId: row.userId, points: row.points }));
}
