// app/api/questions/approve/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { questions, submissions, users, pointsLog } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { checkAndGrantLevelRewards } from "@/lib/levelRewards";

const approveSchema = z.object({
  submissionId: z.string().uuid(),
  questionId: z.string().uuid(),
  submitterId: z.string().uuid(),
  feedback: z.string().optional(),
});

// Points awarded to question creator when their question is approved (per difficulty)
const QUESTION_APPROVAL_POINTS: Record<string, number> = {
  mudah:  15,
  sedang: 25,
  sulit:  40,
};

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const reviewer = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true },
    });
    if (!reviewer) return NextResponse.json({ error: "Reviewer not found" }, { status: 404 });

    const body = await req.json();
    const { submissionId, questionId, submitterId, feedback } = approveSchema.parse(body);

    // Get the question to check difficulty
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, questionId),
      columns: { difficulty: true },
    });
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

    const pointsAwarded = QUESTION_APPROVAL_POINTS[question.difficulty] ?? 15;

    // Get submitter's current points (for level reward check)
    const submitter = await db.query.users.findFirst({
      where: eq(users.id, submitterId),
      columns: { id: true, points: true },
    });
    if (!submitter) return NextResponse.json({ error: "Submitter not found" }, { status: 404 });

    // Approve the question
    await db.update(questions)
      .set({ status: "approved" })
      .where(eq(questions.id, questionId));

    // Update submission
    await db.update(submissions)
      .set({
        status: "approved",
        reviewerId: reviewer.id,
        feedback: feedback || "Soal disetujui. Terima kasih atas kontribusinya!",
      })
      .where(eq(submissions.id, submissionId));

    // Log and award points
    await db.insert(pointsLog).values({
      userId: submitterId,
      action: "question_approved",
      delta: pointsAwarded,
      refId: questionId,
    });

    await db.update(users)
      .set({ points: sql`${users.points} + ${pointsAwarded}` })
      .where(eq(users.id, submitterId));

    const newPoints = submitter.points + pointsAwarded;

    // Check level rewards
    const levelRewards = await checkAndGrantLevelRewards(submitterId, submitter.points, newPoints);

    return NextResponse.json({
      success: true,
      pointsAwarded,
      levelRewards: levelRewards.map(r => r.label),
    }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Question approve error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
