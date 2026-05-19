// app/api/quiz/complete/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { users, pointsLog } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";

const completeSchema = z.object({
  quizId: z.string().min(1),
  difficulty: z.string().min(1),
  score: z.number().min(0).max(100),
  wrongAnswers: z.number().int().min(0).default(0),
});

// V-Point rewards by quiz difficulty
const QUIZ_POINTS: Record<string, number> = {
  "mudah": 15,
  "sedang": 25,
  "normal": 25,
  "sulit": 45,
  "sangat sulit": 100,
  "bervariasi": 25,
};

function getPointsForDifficulty(difficulty: string): number {
  const key = difficulty.toLowerCase();
  return QUIZ_POINTS[key] ?? 25;
}

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    let validated;
    try {
      validated = completeSchema.parse(body);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid data", details: e.issues }, { status: 400 });
      }
      throw e;
    }

    // Find user in DB
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true, points: true }
    });

    if (!dbUser) {
      return NextResponse.json({
        error: "User not found. Please log out and log back in."
      }, { status: 404 });
    }

    // ── First-completion check ─────────────────────────────────────────────
    // Use quizId-scoped action so each quiz can only reward once per user.
    const completionAction = `quiz_completed_${validated.quizId}`;

    const existingEntry = await db.query.pointsLog.findFirst({
      where: and(
        eq(pointsLog.userId, dbUser.id),
        eq(pointsLog.action, completionAction)
      ),
      columns: { id: true },
    });

    if (existingEntry) {
      // Already completed before — no reward, no penalty
      return NextResponse.json({
        success: true,
        pointsAwarded: 0,
        penaltyPoints: 0,
        netPoints: 0,
        newTotal: dbUser.points,
        difficulty: validated.difficulty,
        alreadyCompleted: true,
      }, { status: 200 });
    }

    // ── First time: award + apply penalty ────────────────────────────────
    const pointsAwarded = getPointsForDifficulty(validated.difficulty);
    const wrongAnswers = validated.wrongAnswers ?? 0;

    // Penalty: 10% of current total per wrong answer
    const penaltyPoints = Math.floor(wrongAnswers * 0.10 * dbUser.points);
    const netChange = pointsAwarded - penaltyPoints;

    // Log reward (action = completionAction, used as uniqueness key too)
    await db.insert(pointsLog).values({
      userId: dbUser.id,
      action: completionAction,
      delta: pointsAwarded,
      refId: null,
    });

    // Log penalty if any
    if (penaltyPoints > 0) {
      await db.insert(pointsLog).values({
        userId: dbUser.id,
        action: "quiz_wrong_answer_penalty",
        delta: -penaltyPoints,
        refId: null,
      });
    }

    // Update total (floor at 0)
    await db.update(users)
      .set({ points: sql`GREATEST(0, ${users.points} + ${netChange})` })
      .where(eq(users.id, dbUser.id));

    const newTotal = Math.max(0, dbUser.points + netChange);

    return NextResponse.json({
      success: true,
      pointsAwarded,
      penaltyPoints,
      netPoints: netChange,
      newTotal,
      difficulty: validated.difficulty,
      alreadyCompleted: false,
    }, { status: 200 });

  } catch (error) {
    console.error("Quiz complete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
