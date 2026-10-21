// src/lib/dailyWindow.ts
// ─── Satu definisi "hari kuis harian" ─────────────────────────────────────────
// Jendela harian mulai 03:00 WIB (20:00 UTC hari sebelumnya), bukan tengah malam:
// siswa mengerjakan kuis pada malam hari, dan jendela yang berganti pukul 00:00
// WIB memotong sesi yang sedang berjalan.
//
// Modul ini ada karena tiga tempat harus sepakat tentang batas hari yang sama:
// `quiz/daily-claim` (hadiah +25), `quiz/submit` (bukti partisipasi), dan cron
// musim (slot kuis harian serta honor kursi). Sebelum M16 konstanta dan fungsi
// ini hidup di dalam route `daily-claim`, sehingga tempat kedua yang
// membutuhkannya hampir pasti akan menyalinnya — dan dua salinan batas hari
// adalah cara paling halus membuat "sudah klaim" berbeda dari "sudah
// mengerjakan".
//
// Modul ini tidak mengimpor database dan tidak mengimpor Next.js, sehingga bisa
// diuji langsung dan dipakai dari job mana pun.

import { createHash } from "node:crypto";

/** Hadiah tetap untuk menyelesaikan kuis harian. */
export const DAILY_REWARD = 25;

/** 03:00 WIB === 20:00 UTC hari sebelumnya. */
export const RESET_HOUR_UTC = 20;

/**
 * Awal jendela harian yang memuat `now`.
 *
 * Selalu mengembalikan waktu dengan jam 20:00:00.000 UTC, sehingga bisa dipakai
 * sebagai kunci (`daily_activity.window_start`, `daily_quiz_slot.window_start`)
 * tanpa dua permintaan yang berdekatan menghasilkan dua nilai berbeda.
 */
export function startOfDailyWindow(now: Date = new Date()): Date {
  const start = new Date(now);
  if (start.getUTCHours() < RESET_HOUR_UTC) {
    start.setUTCDate(start.getUTCDate() - 1);
  }
  start.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);
  return start;
}

/**
 * UUID berbentuk sah yang diturunkan dari sebuah string.
 *
 * Dipakai sebagai `ref_id` pada `points_log` ketika kejadiannya tidak punya id
 * alami (hadiah harian, honor kursi). Karena indeks unik
 * `(user_id, action, ref_id)` sudah ada, kunci yang deterministik membuat
 * "sekali per jendela" menjadi jaminan database, bukan pemeriksaan `SELECT`
 * yang bisa dilewati dua permintaan bersamaan.
 */
export function deterministicUuid(input: string): string {
  const h = createHash("sha1").update(input).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
