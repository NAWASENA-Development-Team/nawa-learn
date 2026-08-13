// src/lib/season.ts
// ─── Seasonal Leaderboard Utilities ─────────────────────────────────────────
// Seasons are fixed quarters: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec.
// Reset every 3 months at the start of a quarter.

/**
 * Returns the start Date of the current season (quarter), in UTC.
 * Quarters: Jan 1, Apr 1, Jul 1, Oct 1.
 */
export function getCurrentSeasonStart(): Date {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const quarterMonth = Math.floor(month / 3) * 3; // 0, 3, 6, 9
  return new Date(Date.UTC(year, quarterMonth, 1, 0, 0, 0, 0));
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
