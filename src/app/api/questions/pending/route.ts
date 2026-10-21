// app/api/questions/pending/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions, submissions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireReviewer } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const log = requestLogger(req);
  // Contains unreviewed questions *with their answer keys* — staff or a seated
  // season moderator, never a plain student.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;

  try {
    // Get all pending questions with submitter info via submissions table
    const rows = await db
      .select({
        submissionId: submissions.id,
        submittedAt: submissions.submittedAt,
        questionId: questions.id,
        questionText: questions.questionText,
        options: questions.options,
        answerKey: questions.answerKey,
        difficulty: questions.difficulty,
        subject: questions.subject,
        category: questions.category,
        submitterId: submissions.submitterId,
        submitterName: users.name,
      })
      .from(submissions)
      .innerJoin(questions, eq(submissions.refId, questions.id))
      .innerJoin(users, eq(submissions.submitterId, users.id))
      .where(
        and(
          eq(submissions.type, "question"),
          eq(submissions.status, "pending"),
        ),
      );

    return NextResponse.json({ success: true, data: rows }, { status: 200 });
  } catch (error) {
    log.error("Pending questions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
