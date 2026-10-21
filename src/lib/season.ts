// src/lib/season.ts
// ─── Seasonal Leaderboard Utilities ─────────────────────────────────────────
// Seasons are fixed quarters: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec.
// Reset every 3 months at the start of a quarter.

import { sql, type SQL } from "drizzle-orm";
import { users } from "@/db/schema";

/**
 * Returns the start Date of the current season (quarter), in UTC.
 * Quarters: Jan 1, Apr 1, Jul 1, Oct 1.
 */
export function getCurrentSeasonStart(at: Date = new Date()): Date {
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth(); // 0-indexed
  const quarterMonth = Math.floor(month / 3) * 3; // 0, 3, 6, 9
  return new Date(Date.UTC(year, quarterMonth, 1, 0, 0, 0, 0));
}

/**
 * Start of the *next* season, i.e. the day the current seat term ends.
 * Used by the profile page to print "menjabat sampai …" without the reader
 * having to know how quarters work.
 */
export function getSeasonEnd(at: Date = new Date()): Date {
  const start = getCurrentSeasonStart(at);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1));
}

/**
 * Start of the previous season — the window the podium archive reads.
 *
 * `Date.UTC` normalises a negative month, so January rolls back to October of
 * the previous year without a special case.
 */
export function getPreviousSeasonStart(at: Date = new Date()): Date {
  const start = getCurrentSeasonStart(at);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 3, 1));
}

/**
 * "2026-Q4" — stable for a whole quarter, used as the seat key.
 *
 * This is a pure function of a date: it reads no user row, so two requests on
 * the same second cannot disagree about which season a seat belongs to.
 */
export function getSeasonKey(at: Date = new Date()): string {
  const quarter = Math.floor(at.getUTCMonth() / 3) + 1;
  return `${at.getUTCFullYear()}-Q${quarter}`;
}

/**
 * Poin yang sah untuk musim berjalan.
 *
 * `season_points` hanya direset saat pengguna menulis poin berikutnya (reset
 * malas), jadi baris yang terakhir menulis di musim lalu masih menyimpan angka
 * musim lalu. Tanpa koreksi ini, akun dorman memegang kursi selama berbulan-bulan
 * — dan pada hari pertama kuartal, tiga UUID acak bisa menerima kursi.
 *
 * `season_reset_at IS NULL` diperlakukan sebagai "belum pernah distempel" dan
 * dipercaya apa adanya: baris seperti itu hanya ada pada data pra-reset dan
 * fixture lama. Cron rollover menstempelnya.
 *
 * Pemakai **wajib** fungsi ini, bukan kolom mentah:
 *   - `(dashboard)/leaderboard/page.tsx` (daftar + peringkat pengguna login)
 *   - `(dashboard)/profile/[id]/page.tsx` (`higherPointsResult`)
 *   - `POST /api/cron/season` (arsip podium, penetapan kursi, zona konflik)
 *   - `src/lib/seat.ts` (`rankOf`)
 */
export function effectiveSeasonPoints(): SQL<number> {
  // ISO string, not a Date: the Neon HTTP driver and PGlite agree on a string
  // literal but not on how to serialise a JS Date inside a raw SQL template.
  const seasonStart = getCurrentSeasonStart().toISOString();
  return sql<number>`CASE
    WHEN ${users.seasonResetAt} IS NULL
      OR ${users.seasonResetAt} >= ${seasonStart}
    THEN ${users.seasonPoints}
    ELSE 0
  END`;
}

/**
 * Kembar JavaScript dari `effectiveSeasonPoints()`.
 *
 * Dipakai saat angkanya sudah ada di tangan (satu baris hasil `findFirst`),
 * sehingga tidak perlu query kedua. **Aturannya harus identik** dengan SQL di
 * atas; `tests/unit/season.test.ts` mengunci keduanya pada batas yang sama.
 */
export function isSeasonCurrent(seasonResetAt: Date | null, at: Date = new Date()): boolean {
  if (seasonResetAt === null) return true;
  return seasonResetAt.getTime() >= getCurrentSeasonStart(at).getTime();
}

/**
 * Returns a human-readable label for the current season.
 * e.g. "Season 3 — Jul–Sep 2026"
 */
export function getSeasonLabel(): string {
  const start = getCurrentSeasonStart();
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const seasonNumber = Math.floor(month / 3) + 1;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const startMonth = monthNames[month];
  const endMonth = monthNames[month + 2];
  return `Season ${seasonNumber} — ${startMonth}–${endMonth} ${year}`;
}

/**
 * Check if a user's seasonResetAt is before the current season start.
 * If so, their seasonPoints need to be reset to 0.
 */
export function needsSeasonReset(seasonResetAt: Date | null): boolean {
  const seasonStart = getCurrentSeasonStart();
  if (!seasonResetAt) return true; // Never reset before
  return new Date(seasonResetAt) < seasonStart;
}
