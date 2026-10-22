// app/api/quiz/daily-claim/route.ts
// Flat daily bonus for finishing the daily quiz.
//
// Two things the old version did not do:
//   1. It paid out without any proof that the user touched the daily quiz.
//   2. It decided "already claimed" by reading a timestamp and writing it back,
//      which two concurrent requests could both pass.
// Now the bonus requires a *graded* attempt recorded by /api/quiz/submit, and
// the once-per-day rule is enforced by the unique index on points_log.
//
// M16 mengubah **sumber buktinya**, bukan syaratnya. Bukti partisipasi sekarang
// dibaca dari `daily_activity`, bukan dari `points_log`. Baris `points_log`
// `quiz_answer` hanya ada bila poin benar-benar dibayarkan, dan indeks unik
// membuangnya ketika soal itu pernah dijawab — jadi pengguna paling rajin justru
// yang pertama kehilangan +25, permanen. Sebuah kejadian tidak boleh disimpulkan
// dari catatan pembayarannya.
//
// M18 mengubah **syaratnya**: kuis harian adalah satu soal, dan hadiahnya hanya
// dibayar bila jawabannya benar. `daily_activity.is_correct` — bukan keberadaan
// barisnya — yang memutuskan.
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyActivity, pointsLog, users } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { DAILY_REWARD, deterministicUuid, startOfDailyWindow } from "@/lib/dailyWindow";

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

    // Bukti partisipasi: satu jawaban **tercatat** pada soal harian hari ini.
    //
    // M18 mengubah syaratnya, bukan sumber buktinya. Kuis harian kini satu soal,
    // jadi hadiah +25 hanya dibayar bila jawaban itu benar — kalau partisipasi
    // saja sudah cukup, satu soal berarti satu klik acak untuk poin gratis.
    // Kebenarannya dibaca dari `daily_activity.is_correct`, yang ditulis
    // `/api/quiz/submit` setelah dinilai terhadap kunci di database.
    const proof = await db
      .select({ isCorrect: dailyActivity.isCorrect })
      .from(dailyActivity)
      .where(
        and(
          eq(dailyActivity.userId, user.id),
          eq(dailyActivity.windowStart, windowStart),
        ),
      )
      .limit(1);

    if (proof.length === 0) {
      return NextResponse.json({
        success: false,
        code: "not_answered",
        message: "Kerjakan dulu soal Kuis Harian hari ini untuk mengklaim hadiah.",
      });
    }

    if (!proof[0].isCorrect) {
      return NextResponse.json({
        success: false,
        code: "incorrect",
        message: "Jawabanmu belum tepat. Hadiah Kuis Harian hanya untuk jawaban benar — coba lagi besok.",
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

