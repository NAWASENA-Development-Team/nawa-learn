// app/api/modules/approve/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { modules, submissions, users, pointsLog } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireModerator } from "@/lib/authz";
import { checkAndGrantLevelRewards } from "@/lib/levelRewards";
import { needsSeasonReset } from "@/lib/season";

// The client only picks *which* submission to act on.
// `moduleId` and `submitterId` are resolved from the submission row in the
// database — trusting them from the request body would let anyone award points
// to any account (and moderate content they do not own).
const approveSchema = z.object({
  submissionId: z.string().uuid(),
  feedback: z.string().max(1000).optional(),
});

// Points awarded for an approved module
const MODULE_APPROVAL_POINTS = 50;

export async function POST(req: Request) {
  // 1. Authorization: moderator or admin only.
  const authz = await requireModerator();
  if (!authz.ok) return authz.response;
  const reviewer = authz.user;

  try {
    const body = await req.json();
    const { submissionId, feedback } = approveSchema.parse(body);

    // 2. Resolve the real target from the database.
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      columns: { id: true, type: true, refId: true, submitterId: true, status: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.type !== "module") {
      return NextResponse.json({ error: "Submission is not a module" }, { status: 400 });
    }

    const moduleId = submission.refId;
    const submitterId = submission.submitterId;

    // Get submitter's current points for the level reward check
    const submitter = await db.query.users.findFirst({
      where: eq(users.id, submitterId),
      columns: { id: true, points: true, seasonPoints: true, seasonResetAt: true },
    });
    if (!submitter) {
      return NextResponse.json({ error: "Submitter not found" }, { status: 404 });
    }

    // 3. Atomically claim the submission.
    // The `status = 'pending'` condition means a submission can only ever be
    // approved once, which also makes the points award below idempotent.
    // (The neon-http driver has no transactions, so this conditional update is
    // our guard against double-award.)
    const claimed = await db
      .update(submissions)
      .set({
        status: "approved",
        reviewerId: reviewer.id,
        feedback: feedback || "Good job!",
      })
      .where(and(eq(submissions.id, submissionId), eq(submissions.status, "pending")))
      .returning({ id: submissions.id });

    if (claimed.length === 0) {
      return NextResponse.json({ error: "Submission already reviewed" }, { status: 409 });
    }

    // 4. Publish the module.
    await db.update(modules)
      .set({ status: "approved" })
      .where(eq(modules.id, moduleId));

    // 5. Log the points award.
    await db.insert(pointsLog).values({
      userId: submitterId,
      action: "module_approved",
      delta: MODULE_APPROVAL_POINTS,
      refId: moduleId,
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
        points: sql`${users.points} + ${MODULE_APPROVAL_POINTS}`,
        seasonPoints: sql`${users.seasonPoints} + ${MODULE_APPROVAL_POINTS}`,
        role: sql`CASE WHEN ${users.role} = 'student' THEN 'contributor'::role ELSE ${users.role} END`,
      })
      .where(eq(users.id, submitterId));

    const newPoints = submitter.points + MODULE_APPROVAL_POINTS;

    // 8. Check and grant level rewards.
    const levelRewards = await checkAndGrantLevelRewards(submitterId, submitter.points, newPoints);

    return NextResponse.json({
      success: true,
      message: "Module approved and points awarded",
      levelRewards: levelRewards.map(r => r.label),
    }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Approval error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
