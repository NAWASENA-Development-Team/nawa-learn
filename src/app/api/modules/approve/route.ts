// app/api/modules/approve/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { modules, submissions, users, pointsLog } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { requireReviewer, isHumanReviewer } from "@/lib/authz";
import { checkAndGrantLevelRewards } from "@/lib/levelRewards";
import { needsSeasonReset } from "@/lib/season";
import { isInConflictZone } from "@/lib/seat";
import { requestLogger } from "@/lib/logger";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/auditLog";
import { notifyUnlockedBadges } from "@/lib/badgeMail";
import { enqueueMail } from "@/lib/mailer";
import { promoteIfEligible } from "@/lib/promotion";

// The client only picks *which* submission to act on.
// `moduleId` and `submitterId` are resolved from the submission row in the
// database — trusting them from the request body would let anyone award points
// to any account (and moderate content they do not own).
const approveSchema = z.object({
  submissionId: z.string().uuid(),
  feedback: z.string().max(1000).optional(),
}).strict();

// Points awarded for an approved module
const MODULE_APPROVAL_POINTS = 50;

export async function POST(req: Request) {
  const log = requestLogger(req);
  // 1. Authorization: staf manusia atau pemegang kursi musim yang masih berlaku.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;
  const reviewer = authz.user;

  try {
    const parsed = await parseJsonBody(req, approveSchema);
    if (!parsed.ok) return parsed.response;
    const { submissionId, feedback } = parsed.data;

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

    // 2b. Dua penolakan yang harus terjadi **sebelum** poin ditulis.
    //
    // Menyetujui karya sendiri adalah cara termudah mengubah unggahan menjadi
    // poin. Penjaga ini wajib meski kursi tidak boleh mengunggah: submission yang
    // masuk sebelum promosi tetap ada di antrean, dan tanpa penjaga ini seorang
    // kursi bisa menyetujui karyanya sendiri.
    if (submitterId === reviewer.id) {
      return NextResponse.json(
        { error: "Tidak dapat meninjau kiriman sendiri", code: "self_review_forbidden" },
        { status: 403 },
      );
    }

    // Zona konflik (I5): pemegang kursi tidak menyentuh karya sepuluh besar.
    // Staf manusia tidak diperiksa — ia pemutus akhir.
    if (!isHumanReviewer(reviewer) && (await isInConflictZone(db, submitterId))) {
      return NextResponse.json(
        {
          error: "Kiriman ini berasal dari sepuluh besar. Pemegang kursi tidak dapat meninjaunya.",
          code: "seat_conflict_of_interest",
        },
        { status: 403 },
      );
    }

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

    // 4. Publish the module. Judulnya dikembalikan karena dipakai surel di bawah
    // — satu query, bukan dua.
    const published = await db.update(modules)
      .set({ status: "approved" })
      .where(eq(modules.id, moduleId))
      .returning({ title: modules.title });

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

    // 7. Increment points. Peran **tidak** ikut di sini: promosi adalah
    // pernyataan terpisah setelah poin benar-benar bertambah (M18).
    await db.update(users)
      .set({
        points: sql`${users.points} + ${MODULE_APPROVAL_POINTS}`,
        seasonPoints: sql`${users.seasonPoints} + ${MODULE_APPROVAL_POINTS}`,
      })
      .where(eq(users.id, submitterId));

    // 7b. Satu-satunya pintu evolusi peran. Best effort: kegagalannya dicatat
    // dan keputusan approval tetap berdiri.
    await promoteIfEligible(db, { userId: submitterId, actorId: reviewer.id, log });

    const newPoints = submitter.points + MODULE_APPROVAL_POINTS;

    // 8. Jejak keputusan. Setelah poinnya benar-benar bertambah, supaya yang
    // tercatat adalah keadaan yang sungguh terjadi — bukan niat.
    await recordAudit(db, {
      actorId: reviewer.id,
      action: "content.approve",
      entity: "module",
      entityId: moduleId,
      before: { status: "pending" },
      after: { status: "approved", pointsAwarded: MODULE_APPROVAL_POINTS },
    }, { log });

    // 9. Check and grant level rewards.
    const levelRewards = await checkAndGrantLevelRewards(submitterId, submitter.points, newPoints);

    // 10. Notifikasi. Best effort dan tidak pernah melempar: persetujuan sudah
    // terjadi, dan surel yang gagal tidak boleh membatalkannya.
    await enqueueMail(
      db,
      {
        toUserId: submitterId,
        kind: "submission_approved",
        dedupeKey: `sub:${submissionId}`,
        payload: {
          title: published[0]?.title ?? "Modulmu",
          points: MODULE_APPROVAL_POINTS,
        },
      },
      log,
    );
    await notifyUnlockedBadges(db, submitterId, log);

    return NextResponse.json({
      success: true,
      message: "Module approved and points awarded",
      levelRewards: levelRewards.map(r => r.label),
    }, { status: 200 });

  } catch (error) {
    log.error("Approval error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
