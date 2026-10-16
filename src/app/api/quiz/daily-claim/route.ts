// app/api/quiz/daily-claim/route.ts
// Flat daily bonus for finishing the daily quiz.
//
// Two things the old version did not do:
//   1. It paid out without any proof that the user touched the daily quiz.
//   2. It decided "already claimed" by reading a timestamp and writing it back,
//      which two concurrent requests could both pass.
// Now the bonus requires a *graded* attempt recorded by /api/quiz/submit, and
// the once-per-day rule is enforced by the unique index on points_log.
import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { pointsLog, questions, users } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";

const DAILY_REWARD = 25;
// 03:00 WIB === 20:00 UTC of the previous day.
const RESET_HOUR_UTC = 20;

function startOfDailyWindow(now: Date): Date {
  const start = new Date(now);
  if (start.getUTCHours() < RESET_HOUR_UTC) {
    start.setUTCDate(start.getUTCDate() - 1);
  }
  start.setUTCHours(RESET_HOUR_UTC, 0, 0, 0);
  return start;
}

/** Stable UUID-shaped key so the DB unique index can enforce "once per window". */
function deterministicUuid(input: string): string {
  const h = createHash("sha1").update(input).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export async function POST(req: Request) {
  const log = requestLogger(req);
  const authz = await requireUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  const limit = await rateLimit(req, "quiz/daily-claim", user.id);
  if (!limit.ok) return limit.response;

  try {
    const now = new Date();
    const windowStart = startOfDailyWindow(now);

    // Proof of participation: at least one graded answer on a Kuis Harian
    // question since the reset. Those rows are written by /api/quiz/submit
    // after grading against the database, so they cannot be forged client-side.
    const proof = await db
      .select({ id: pointsLog.id })
      .from(pointsLog)
      .innerJoin(questions, eq(pointsLog.refId, questions.id))
      .where(
        and(
          eq(pointsLog.userId, user.id),
          eq(pointsLog.action, "quiz_answer"),
          eq(questions.category, "Kuis Harian"),
          gte(pointsLog.createdAt, windowStart),
        ),
      )
      .limit(1);

    if (proof.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Kerjakan dulu minimal satu soal Kuis Harian hari ini untuk mengklaim hadiah.",
      });
    }

    // Atomic claim: if this row already exists, the bonus was taken today.
    const dayRef = deterministicUuid(`${user.id}:daily:${windowStart.toISOString()}`);
    const inserted = await db
      .insert(pointsLog)
      .values({ userId: user.id, action: "daily_quiz", refId: dayRef, delta: DAILY_REWARD })
      .onConflictDoNothing()
      .returning({ id: pointsLog.id });

    if (inserted.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Reward Kuis Harian sudah diklaim hari ini. Kembali lagi besok setelah pukul 03.00 WIB!",
      });
    }

    await db
      .update(users)
      .set({
        points: sql`${users.points} + ${DAILY_REWARD}`,
        seasonPoints: sql`${users.seasonPoints} + ${DAILY_REWARD}`,
        lastDailyQuizAt: now,
        role: sql`CASE WHEN ${users.role} = 'student' THEN 'contributor'::role ELSE ${users.role} END`,
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      pointsAwarded: DAILY_REWARD,
      message: `Berhasil menyelesaikan Kuis Harian! +${DAILY_REWARD} V-Points`,
    });
  } catch (error) {
    log.error("Daily claim error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
