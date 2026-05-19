// app/api/questions/reject/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { questions, submissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";

const rejectSchema = z.object({
  submissionId: z.string().uuid(),
  questionId: z.string().uuid(),
  feedback: z.string().optional(),
});

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
    const { submissionId, questionId, feedback } = rejectSchema.parse(body);

    await db.update(questions)
      .set({ status: "rejected" })
      .where(eq(questions.id, questionId));

    await db.update(submissions)
      .set({
        status: "rejected",
        reviewerId: reviewer.id,
        feedback: feedback || "Soal ditolak oleh moderator.",
      })
      .where(eq(submissions.id, submissionId));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Question reject error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
