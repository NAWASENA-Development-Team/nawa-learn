// app/api/questions/reject/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { questions, submissions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireReviewer, isHumanReviewer } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/auditLog";
import { isInConflictZone } from "@/lib/seat";
import { enqueueMail } from "@/lib/mailer";

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
  .strict()
  .refine((d) => Boolean(d.submissionId || d.questionId), {
    message: "submissionId or questionId is required",
  });

export async function POST(req: Request) {
  const log = requestLogger(req);
  // 1. Authorization: staf manusia atau pemegang kursi musim yang masih berlaku.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;
  const reviewer = authz.user;

  try {
    const parsed = await parseJsonBody(req, rejectSchema);
    if (!parsed.ok) return parsed.response;
    const { submissionId, questionId, feedback } = parsed.data;

    // 2. Resolve the submission row.
    let submission = submissionId
      ? await db.query.submissions.findFirst({
          where: eq(submissions.id, submissionId),
          columns: { id: true, type: true, refId: true, submitterId: true },
        })
      : null;

    // Fallback: identify by question id (used by the daily-quiz take-down flow).
    if (!submission && questionId) {
      submission = await db.query.submissions.findFirst({
        where: and(eq(submissions.refId, questionId), eq(submissions.type, "question")),
        columns: { id: true, type: true, refId: true, submitterId: true },
      }) ?? null;
    }

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.type !== "question") {
      return NextResponse.json({ error: "Submission is not a question" }, { status: 400 });
    }

    const targetQuestionId = submission.refId;

    // 2b. Penolakan juga penilaian: menolak karya pesaing adalah kekuatan yang
    // sama besarnya dengan menyetujuinya. Karena itu penjaga yang sama berlaku
    // (I4 dan I5), sebelum ada satu baris pun diubah.
    if (submission.submitterId === reviewer.id) {
      return NextResponse.json(
        { error: "Tidak dapat meninjau kiriman sendiri", code: "self_review_forbidden" },
        { status: 403 },
      );
    }
    if (!isHumanReviewer(reviewer) && (await isInConflictZone(db, submission.submitterId))) {
      return NextResponse.json(
        {
          error: "Kiriman ini berasal dari sepuluh besar. Pemegang kursi tidak dapat meninjaunya.",
          code: "seat_conflict_of_interest",
        },
        { status: 403 },
      );
    }

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

    // 4. Jejak keputusan. Penolakan tidak memberi poin, jadi `points_log` tidak
    // akan pernah punya baris untuknya — tanpa audit log, satu-satunya bukti
    // bahwa soal ini pernah ditinjau adalah `reviewer_id`, yang akan tertimpa
    // bila soal yang sama diputuskan lagi.
    await recordAudit(db, {
      actorId: reviewer.id,
      action: "content.reject",
      entity: "question",
      entityId: targetQuestionId,
      before: { status: "pending" },
      after: { status: "rejected", submissionId: submission.id },
    }, { log });

    // 5. Kabar ke pengirim. Penolakan tanpa penjelasan adalah penolakan yang
    // membuat orang berhenti mengirim, jadi catatan peninjau ikut dikirim.
    await enqueueMail(
      db,
      {
        toUserId: submission.submitterId,
        kind: "submission_rejected",
        dedupeKey: `sub:${submission.id}`,
        payload: {
          title: `Soal`,
          reason: feedback || "Soal ditolak oleh moderator.",
        },
      },
      log,
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    log.error("Question reject error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
