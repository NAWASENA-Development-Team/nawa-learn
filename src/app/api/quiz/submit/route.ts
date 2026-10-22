// app/api/quiz/submit/route.ts
// The ONLY way to earn V-Points from a quiz.
//
// The browser is allowed to tell us *what it answered* and nothing else.
// `difficulty`, `score` and any `quizId` coming from the client are ignored —
// the score, the reward and the anti-replay key are all derived here, from the
// answer keys stored in the database.
import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyActivity, pointsLog, questions, users } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { flagPointSpike } from "@/lib/abuse";
import { resolveDailyQuestion } from "@/lib/dailySession";
import { startOfDailyWindow } from "@/lib/dailyWindow";
import { checkAndGrantLevelRewards } from "@/lib/levelRewards";
import { needsSeasonReset } from "@/lib/season";
import {
  isGradeableQuestionId,
  MAX_ANSWERS_PER_SUBMISSION,
  pointsForAnswer,
  quizSubmitSchema,
} from "@/lib/quizScoring";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";

type GradedQuestion = {
  questionId: string;
  correct: boolean;
  correctKey: string;
  /** true when this submission actually credited points for the question */
  credited: boolean;
};

/** Nothing here is worth points, so say so plainly instead of inventing a score. */
function notRewardable() {
  return NextResponse.json(
    {
      success: true,
      rewardable: false,
      pointsAwarded: 0,
      penaltyPoints: 0,
      correctCount: 0,
      wrongAnswers: 0,
      totalCount: 0,
      creditedCount: 0,
      alreadyCompleted: false,
      results: [] as GradedQuestion[],
      levelRewards: [] as string[],
    },
    { status: 200 },
  );
}

export async function POST(req: Request) {
  const log = requestLogger(req);
  const authz = await requireUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  const limit = await rateLimit(req, "quiz/submit", user.id);
  if (!limit.ok) return limit.response;

  try {
    const parsed = await parseJsonBody(req, quizSubmitSchema);
    if (!parsed.ok) return parsed.response;

    const { answers } = parsed.data;

    // Only ids that can exist in `questions` are gradeable. Sample/demo quizzes
    // are hardcoded in the browser with ids like "q1"; they are fine to practise
    // with, they just cannot earn points because nothing can verify them.
    const ids = Object.keys(answers)
      .filter(isGradeableQuestionId)
      .slice(0, MAX_ANSWERS_PER_SUBMISSION);

    if (ids.length === 0) return notRewardable();

    const rows = await db
      .select({
        id: questions.id,
        answerKey: questions.answerKey,
        difficulty: questions.difficulty,
        uploaderId: questions.uploaderId,
      })
      .from(questions)
      .where(and(inArray(questions.id, ids), eq(questions.status, "approved")));

    if (rows.length === 0) return notRewardable();

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: { points: true, seasonResetAt: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let pointsAwarded = 0;
    let correctCount = 0;
    let wrongAnswers = 0;
    let creditedCount = 0;
    /** Berapa soal yang percobaannya benar-benar baru tercatat. */
    let attemptCount = 0;
    const results: GradedQuestion[] = [];

    for (const q of rows) {
      const isCorrect = answers[q.id] === q.answerKey;
      if (isCorrect) correctCount++;
      else wrongAnswers++;

      // You cannot earn points from content you uploaded yourself.
      const selfAuthored = q.uploaderId === user.id;
      let credited = false;

      if (!selfAuthored) {
        const delta = pointsForAnswer(q.difficulty, isCorrect);

        // One attempt per question per user. `onConflictDoNothing` + the unique
        // index on (user_id, action, ref_id) is what enforces it, so re-playing
        // a quiz — or racing two requests — can never pay out twice.
        const inserted = await db
          .insert(pointsLog)
          .values({ userId: user.id, action: "quiz_answer", refId: q.id, delta })
          .onConflictDoNothing()
          .returning({ id: pointsLog.id });

        if (inserted.length > 0) {
          attemptCount++;
          // Baris tercatat **bukan** berarti poin dibayarkan: jawaban salah
          // menulis baris dengan `delta = 0` supaya percobaannya habis dan soal
          // itu tidak bisa dipakai menabung poin. `credited` dipakai UI untuk
          // lencana "+N poin" dan dipakai tripwire penyalahgunaan, jadi ia harus
          // mengikuti uangnya, bukan keberhasilan INSERT (M18).
          if (delta > 0) {
            credited = true;
            creditedCount++;
            pointsAwarded += delta;
          }
        }
      }

      results.push({
        questionId: q.id,
        correct: isCorrect,
        correctKey: q.answerKey,
        credited,
      });
    }

    if (pointsAwarded > 0) {
      if (needsSeasonReset(dbUser.seasonResetAt)) {
        await db
          .update(users)
          .set({ seasonPoints: 0, seasonResetAt: new Date() })
          .where(eq(users.id, user.id));
      }

      // Poin saja. Peran **tidak** naik di sini (M18): kehadiran bukan
      // kontribusi. Satu-satunya pintu evolusi adalah `promoteIfEligible()`,
      // dipanggil dari route approval setelah karya benar-benar diterima.
      await db
        .update(users)
        .set({
          points: sql`${users.points} + ${pointsAwarded}`,
          seasonPoints: sql`${users.seasonPoints} + ${pointsAwarded}`,
        })
        .where(eq(users.id, user.id));
    }

    // Bukti partisipasi kuis harian, ditulis **terlepas** dari pembayaran.
    //
    // Sebelum M16 `daily-claim` menyimpulkan "sudah mengerjakan" dari baris
    // `points_log` `quiz_answer`. Baris itu hanya ada bila poin dibayarkan, dan
    // indeks unik membuangnya ketika soal pernah dijawab — jadi pengguna paling
    // rajin justru yang pertama kehilangan +25, permanen. Sebuah kejadian tidak
    // boleh disimpulkan dari catatan pembayarannya.
    //
    // M18 menambah satu hal lagi: yang dicatat adalah **soal mana** dan **benar
    // atau tidak**. Hadiah +25 kini hanya dibayar untuk jawaban benar, dan
    // `points_log` tidak bisa menjawab pertanyaan itu — barisnya dibuang oleh
    // indeks unik dan baris delta 0 pun ada. Soal harian ditanyakan lewat
    // `resolveDailyQuestion()` supaya route ini dan halaman kuis memakai soal
    // yang sama, termasuk ketika soal slot ternyata milik penjawabnya sendiri.
    //
    // Kegagalan menulis baris ini tidak boleh menggagalkan penilaian: poin sudah
    // dibayarkan di atas, dan jawaban yang benar tetap benar.
    const windowStart = startOfDailyWindow();
    try {
      // Jalur cepat. Satu soal, satu percobaan: baris hari ini berarti
      // kesempatan hari ini sudah terpakai, jadi tidak ada yang perlu dihitung
      // atau ditimpa.
      const answeredToday = await db
        .select({ userId: dailyActivity.userId })
        .from(dailyActivity)
        .where(
          and(
            eq(dailyActivity.userId, user.id),
            eq(dailyActivity.windowStart, windowStart),
          ),
        )
        .limit(1);

      if (answeredToday.length === 0) {
        const daily = await resolveDailyQuestion(db, {
          userId: user.id,
          now: windowStart,
          log,
        });
        const answered = daily ? rows.find((row) => row.id === daily.id) : undefined;

        if (daily && answered) {
          await db
            .insert(dailyActivity)
            .values({
              userId: user.id,
              windowStart,
              questionId: daily.id,
              isCorrect: answers[daily.id] === answered.answerKey,
            })
            .onConflictDoNothing();
        }
      }
    } catch (error) {
      log.error("daily activity write failed", { error });
    }

    const newTotal = dbUser.points + pointsAwarded;
    const levelRewards =
      pointsAwarded > 0
        ? await checkAndGrantLevelRewards(user.id, dbUser.points, newTotal)
        : [];

    // Abuse tripwire. Only worth a query when this request actually credited
    // something, and it must never be able to fail the submission.
    if (creditedCount > 0) {
      try {
        await flagPointSpike(user.id, log);
      } catch (error) {
        log.error("point spike check failed", { error });
      }
    }

    return NextResponse.json({
      success: true,
      rewardable: true,
      pointsAwarded,
      penaltyPoints: 0,
      correctCount,
      wrongAnswers,
      totalCount: rows.length,
      creditedCount,
      // Tidak ada percobaan baru yang tercatat → setiap soal di sini sudah
      // pernah dijawab. Sengaja memakai `attemptCount`, bukan `creditedCount`:
      // jawaban salah tetap tercatat sebagai percobaan walau tidak dibayar.
      alreadyCompleted: attemptCount === 0,
      results,
      levelRewards: levelRewards.map((r) => r.label),
    }, { status: 200 });
  } catch (error) {
    log.error("Quiz submit error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
