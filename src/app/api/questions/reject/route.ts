// app/api/questions/reject/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { questions, submissions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireModerator } from "@/lib/authz";

// A moderation take-down. The client may identify the target either by
// submission id (the moderation queue) or by question id (the daily-quiz list,
// where questions are already approved). Either way the ids stored on the
// submission row are authoritative — the body never dictates which question or
// submitter is affected.
const rejectSchema = z
  .object({
    submissionId: z.string().uuid().optional(),
    questionId: z.string().uuid().optional(),
    feedback: z.string().max(1000).optional(),
  })
  .refine((d) => Boolean(d.submissionId || d.questionId), {
    message: "submissionId or questionId is required",
  });

export async function POST(req: Request) {
  // 1. Authorization: moderator or admin only.
  const authz = await requireModerator();
  if (!authz.ok) return authz.response;
  const reviewer = authz.user;

  try {
    const body = await req.json();
    const { submissionId, questionId, feedback } = rejectSchema.parse(body);

    // 2. Resolve the submission row.
    let submission = submissionId
      ? await db.query.submissions.findFirst({
          where: eq(submissions.id, submissionId),
          columns: { id: true, type: true, refId: true },
        })
      : null;

    // Fallback: identify by question id (used by the daily-quiz take-down flow).
    if (!submission && questionId) {
      submission = await db.query.submissions.findFirst({
        where: and(eq(submissions.refId, questionId), eq(submissions.type, "question")),
        columns: { id: true, type: true, refId: true },
      }) ?? null;
    }

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.type !== "question") {
      return NextResponse.json({ error: "Submission is not a question" }, { status: 400 });
    }

    const targetQuestionId = submission.refId;

    // 3. Reject the question and record the reviewer.
    await db.update(questions)
      .set({ status: "rejected" })
      .where(eq(questions.id, targetQuestionId));

    await db.update(submissions)
      .set({
        status: "rejected",
        reviewerId: reviewer.id,
        feedback: feedback || "Soal ditolak oleh moderator.",
      })
      .where(eq(submissions.id, submission.id));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Question reject error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
