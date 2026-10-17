// app/api/questions/approve/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { questions, submissions, users, pointsLog } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireModerator } from "@/lib/authz";
import { checkAndGrantLevelRewards } from "@/lib/levelRewards";
import { needsSeasonReset } from "@/lib/season";
import { requestLogger } from "@/lib/logger";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/auditLog";

// `questionId` and `submitterId` are resolved from the submission row in the
// database, never from the request body.
const approveSchema = z.object({
  submissionId: z.string().uuid(),
  feedback: z.string().max(1000).optional(),
}).strict();

// Points awarded to the question creator when their question is approved
const QUESTION_APPROVAL_POINTS: Record<string, number> = {
  mudah:  15,
  sedang: 25,
  sulit:  40,
};

export async function POST(req: Request) {
  const log = requestLogger(req);
  // 1. Authorization: moderator or admin only.
  const authz = await requireModerator();
  if (!authz.ok) return authz.response;
  const reviewer = authz.user;

  try {
    const parsed = await parseJsonBody(req, approveSchema);
    if (!parsed.ok) return parsed.response;
    const { submissionId, feedback } = parsed.data;

    // 2. Resolve the real target from the database.
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      columns: { id: true, type: true, refId: true, submitterId: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.type !== "question") {
      return NextResponse.json({ error: "Submission is not a question" }, { status: 400 });
    }

    const questionId = submission.refId;
    const submitterId = submission.submitterId;

    // Difficulty (and therefore the reward) comes from the stored question.
    const question = await db.query.questions.findFirst({
      where: eq(questions.id, questionId),
      columns: { difficulty: true },
    });
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

    const pointsAwarded = QUESTION_APPROVAL_POINTS[question.difficulty] ?? 15;

    // Get submitter's current points (for the level reward check)
    const submitter = await db.query.users.findFirst({
      where: eq(users.id, submitterId),
      columns: { id: true, points: true, seasonPoints: true, seasonResetAt: true },
    });
    if (!submitter) return NextResponse.json({ error: "Submitter not found" }, { status: 404 });

    // 3. Atomically claim the submission (see modules/approve for rationale).
    const claimed = await db
      .update(submissions)
      .set({
        status: "approved",
        reviewerId: reviewer.id,
        feedback: feedback || "Soal disetujui. Terima kasih atas kontribusinya!",
      })
      .where(and(eq(submissions.id, submissionId), eq(submissions.status, "pending")))
      .returning({ id: submissions.id });

    if (claimed.length === 0) {
      return NextResponse.json({ error: "Submission already reviewed" }, { status: 409 });
    }

    // 4. Approve the question.
    await db.update(questions)
      .set({ status: "approved" })
      .where(eq(questions.id, questionId));

    // 5. Log and award points.
    await db.insert(pointsLog).values({
      userId: submitterId,
      action: "question_approved",
      delta: pointsAwarded,
      refId: questionId,
    });

    // 6. Lazy season reset check
    if (needsSeasonReset(submitter.seasonResetAt)) {
      await db.update(users)
        .set({ seasonPoints: 0, seasonResetAt: new Date() })
        .where(eq(users.id, submitterId));
    }

    // 7. Increment points, promote to contributor if still a student.
    await db.update(users)
      .set({
        points: sql`${users.points} + ${pointsAwarded}`,
        seasonPoints: sql`${users.seasonPoints} + ${pointsAwarded}`,
        role: sql`CASE WHEN ${users.role} = 'student' THEN 'contributor'::role ELSE ${users.role} END`,
      })
      .where(eq(users.id, submitterId));

    const newPoints = submitter.points + pointsAwarded;

    // 8. Jejak keputusan (lihat modules/approve).
    await recordAudit(db, {
      actorId: reviewer.id,
      action: "content.approve",
      entity: "question",
      entityId: questionId,
      before: { status: "pending", difficulty: question.difficulty },
      after: { status: "approved", pointsAwarded },
    }, { log });

    // 9. Check level rewards.
    const levelRewards = await checkAndGrantLevelRewards(submitterId, submitter.points, newPoints);

    return NextResponse.json({
      success: true,
      pointsAwarded,
      levelRewards: levelRewards.map(r => r.label),
    }, { status: 200 });

  } catch (error) {
    log.error("Question approve error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
