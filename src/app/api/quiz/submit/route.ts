// app/api/quiz/submit/route.ts
// The ONLY way to earn V-Points from a quiz.
//
// The browser is allowed to tell us *what it answered* and nothing else.
// `difficulty`, `score` and any `quizId` coming from the client are ignored —
// the score, the reward and the anti-replay key are all derived here, from the
// answer keys stored in the database.
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { pointsLog, questions, users } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { flagPointSpike } from "@/lib/abuse";
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
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { answers } = quizSubmitSchema.parse(body);

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
          credited = true;
          creditedCount++;
          pointsAwarded += delta;
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

      await db
        .update(users)
        .set({
          points: sql`${users.points} + ${pointsAwarded}`,
          seasonPoints: sql`${users.seasonPoints} + ${pointsAwarded}`,
          role: sql`CASE WHEN ${users.role} = 'student' THEN 'contributor'::role ELSE ${users.role} END`,
        })
        .where(eq(users.id, user.id));
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
      // Nothing new was credited → every question here had already been answered.
      alreadyCompleted: creditedCount === 0,
      results,
      levelRewards: levelRewards.map((r) => r.label),
    }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    log.error("Quiz submit error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
