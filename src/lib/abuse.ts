// src/lib/abuse.ts
// ─── Abuse tripwire ───────────────────────────────────────────────────────────
// Flag, do not block.
//
// Honest framing: M3 already makes farming *one* question impossible — credit is
// granted once per question and enforced by a unique index on
// `points_log (user_id, action, ref_id)`. What is left is a human answering an
// implausible number of *new* questions in a short window, which no schema can
// distinguish from a diligent student.
//
// There is no baseline to compare against, so the threshold is a fixed number,
// set deliberately high: a tripwire that cries wolf gets muted, and a muted
// tripwire is worse than none. It writes one structured line and never affects
// the response. Real alerting means pointing a log drain at `point_spike_detected`.
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { pointsLog } from "@/db/schema";
import type { Logger } from "@/lib/logger";

export const POINT_SPIKE_WINDOW_MINUTES = 10;
export const POINT_SPIKE_THRESHOLD = 500;

/**
 * Points credited to `userId` in the recent window, logging a warning when it
 * looks impossible. Returns the total so a caller (or a test) can see the
 * measurement even when it stayed under the threshold.
 */
export async function flagPointSpike(userId: string, log: Logger): Promise<number> {
  const since = new Date(Date.now() - POINT_SPIKE_WINDOW_MINUTES * 60_000);

  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${pointsLog.delta}), 0)::int` })
    .from(pointsLog)
    .where(and(eq(pointsLog.userId, userId), gte(pointsLog.createdAt, since)));

  const total = row?.total ?? 0;

  if (total >= POINT_SPIKE_THRESHOLD) {
    log.warn("point_spike_detected", {
      userId,
      pointsInWindow: total,
      windowMinutes: POINT_SPIKE_WINDOW_MINUTES,
      threshold: POINT_SPIKE_THRESHOLD,
    });
  }

  return total;
}
