// app/api/quiz/complete/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { users, pointsLog } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const completeSchema = z.object({
  quizId: z.string().min(1),
  difficulty: z.string().min(1),
  score: z.number().min(0).max(100),
});

// V-Point rewards by quiz difficulty
const QUIZ_POINTS: Record<string, number> = {
  "mudah": 15,
  "sedang": 25,
  "normal": 25,
  "sulit": 45,
  "sangat sulit": 45,
  "bervariasi": 25,
};

function getPointsForDifficulty(difficulty: string): number {
  const key = difficulty.toLowerCase();
  return QUIZ_POINTS[key] ?? 25; // default 25 if unknown
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

    const pointsAwarded = getPointsForDifficulty(validated.difficulty);

    // Award points for quiz completion
    await db.insert(pointsLog).values({
      userId: dbUser.id,
      action: `quiz_completed_${validated.difficulty.toLowerCase()}`,
      delta: pointsAwarded,
      refId: null,
    });

    // Increment user's total points
    await db.update(users)
      .set({ points: sql`${users.points} + ${pointsAwarded}` })
      .where(eq(users.id, dbUser.id));

    const newTotal = dbUser.points + pointsAwarded;

    return NextResponse.json({
      success: true,
      pointsAwarded,
      newTotal,
      difficulty: validated.difficulty,
    }, { status: 200 });

  } catch (error) {
    console.error("Quiz complete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
