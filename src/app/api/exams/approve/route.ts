// app/api/exams/approve/route.ts
// ─── Menerbitkan paket ujian ──────────────────────────────────────────────────
//
// Bentuknya sengaja mengikuti `modules/approve` dan `questions/approve` langkah
// demi langkah, karena pertanyaannya sama: siapa yang berhak memutuskan, apa yang
// dibayar, dan apa yang tercatat. Yang berbeda hanya dua hal — sasarannya
// `custom_exams`, dan nilainya **+20**, bukan +50.
//
// Kenapa +20 dan bukan +50 seperti modul: paket ujian ditulis dari soal-soal yang
// sudah ada di kepala penulisnya, bukan dari dokumen yang diunggah, dan paketnya
// bisa berisi satu soal. Menyamakan bayarannya dengan modul akan membuat paket
// satu soal lebih menguntungkan daripada modul satu bab — insentif yang salah
// arah. Angka ini juga di bawah ambang promosi (100), jadi satu paket tidak
// pernah menjadi satu-satunya alasan seseorang menjadi kontributor.
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customExams, pointsLog, submissions, users } from "@/db/schema";
import { requireReviewer, isHumanReviewer } from "@/lib/authz";
import { checkAndGrantLevelRewards } from "@/lib/levelRewards";
import { needsSeasonReset } from "@/lib/season";
import { isInConflictZone } from "@/lib/seat";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/auditLog";
import { notifyUnlockedBadges } from "@/lib/badgeMail";
import { enqueueMail } from "@/lib/mailer";
import { promoteIfEligible } from "@/lib/promotion";

// `examId` dan `authorId` dibaca dari baris `submissions`, tidak pernah dari
// badan permintaan — kalau tidak, siapa pun bisa memberi poin ke akun mana pun.
const approveSchema = z.object({
  submissionId: z.string().uuid(),
  feedback: z.string().max(1000).optional(),
}).strict();

/** V-Points untuk penulis paket ujian yang diterbitkan. */
const EXAM_APPROVAL_POINTS = 20;

export async function POST(req: Request) {
  const log = requestLogger(req);
  // 1. Staf manusia atau pemegang kursi musim yang masih berlaku. Kursi **boleh**
  // meninjau paket ujian — itu satu-satunya karya yang boleh ia sentuh selain
  // modul dan soal.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;
  const reviewer = authz.user;

  const limit = await rateLimit(req, "exams/approve", reviewer.id);
  if (!limit.ok) return limit.response;

  try {
    const parsed = await parseJsonBody(req, approveSchema);
    if (!parsed.ok) return parsed.response;
    const { submissionId, feedback } = parsed.data;

    // 2. Sasaran sebenarnya dari database.
    const submission = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
      columns: { id: true, type: true, refId: true, submitterId: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.type !== "exam") {
      return NextResponse.json({ error: "Submission is not an exam" }, { status: 400 });
    }

    const examId = submission.refId;
    const submitterId = submission.submitterId;

    // 2b. Dua penolakan yang harus terjadi **sebelum** poin ditulis.
    if (submitterId === reviewer.id) {
      return NextResponse.json(
        { error: "Tidak dapat meninjau kiriman sendiri", code: "self_review_forbidden" },
        { status: 403 },
      );
    }
    if (!isHumanReviewer(reviewer) && (await isInConflictZone(db, submitterId))) {
      return NextResponse.json(
        {
          error: "Kiriman ini berasal dari sepuluh besar. Pemegang kursi tidak dapat meninjaunya.",
          code: "seat_conflict_of_interest",
        },
        { status: 403 },
      );
    }

    // Judul dipakai surel di bawah. `status` ikut dibaca supaya paket yang sudah
    // terbit tidak bisa "disetujui" ulang lewat jalur lain (mis. submission yang
    // dibuat manual) dan membayar dua kali.
    const exam = await db.query.customExams.findFirst({
      where: eq(customExams.id, examId),
      columns: { title: true, status: true },
    });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const submitter = await db.query.users.findFirst({
      where: eq(users.id, submitterId),
      columns: { id: true, points: true, seasonPoints: true, seasonResetAt: true },
    });
    if (!submitter) return NextResponse.json({ error: "Submitter not found" }, { status: 404 });

    // 3. Klaim submission secara atomik. `status = 'pending'` berarti satu
    // submission hanya bisa disetujui sekali, yang sekaligus membuat pembayaran
    // di bawah idempoten (neon-http tidak punya transaksi).
    const claimed = await db
      .update(submissions)
      .set({
        status: "approved",
        reviewerId: reviewer.id,
        feedback: feedback || "Paket ujian disetujui. Terima kasih atas kontribusinya!",
      })
      .where(and(eq(submissions.id, submissionId), eq(submissions.status, "pending")))
      .returning({ id: submissions.id });

    if (claimed.length === 0) {
      return NextResponse.json({ error: "Submission already reviewed" }, { status: 409 });
    }

    // 4. Terbitkan paketnya. Dibatasi `status = 'pending'` juga, supaya paket
    // yang sudah `approved` tidak pernah "disetujui" untuk kedua kalinya.
    const published = await db
      .update(customExams)
      .set({ status: "approved" })
      .where(and(eq(customExams.id, examId), eq(customExams.status, "pending")))
      .returning({ id: customExams.id });

    // Kalau baris submission berhasil diklaim tetapi paketnya ternyata sudah
    // tidak `pending`, tidak ada yang berubah dan tidak ada poin yang boleh
    // dibayar. Ini 409, bukan 500: keadaannya sudah final, bukan rusak.
    if (published.length === 0) {
      return NextResponse.json({ error: "Exam already reviewed" }, { status: 409 });
    }

    // 5. Catat pembayaran.
    await db.insert(pointsLog).values({
      userId: submitterId,
      action: "exam_approved",
      delta: EXAM_APPROVAL_POINTS,
      refId: examId,
    });

    // 6. Pemeriksaan reset musim yang malas (pola yang sama dengan modul/soal).
    if (needsSeasonReset(submitter.seasonResetAt)) {
      await db.update(users)
        .set({ seasonPoints: 0, seasonResetAt: new Date() })
        .where(eq(users.id, submitterId));
    }

    // 7. Tambah poin. Peran **tidak** ikut di sini: promosi adalah pernyataan
    // terpisah setelah poin benar-benar bertambah (M18).
    await db.update(users)
      .set({
        points: sql`${users.points} + ${EXAM_APPROVAL_POINTS}`,
        seasonPoints: sql`${users.seasonPoints} + ${EXAM_APPROVAL_POINTS}`,
      })
      .where(eq(users.id, submitterId));

    // 7b. Satu-satunya pintu evolusi peran. Best effort.
    await promoteIfEligible(db, { userId: submitterId, actorId: reviewer.id, log });

    const newPoints = submitter.points + EXAM_APPROVAL_POINTS;

    // 8. Jejak keputusan. `entity: "exam"` — nilai yang ditambahkan M18 ke daftar
    // tertutup `AUDIT_ENTITIES`; kolomnya varchar, jadi tidak ada migrasi.
    await recordAudit(db, {
      actorId: reviewer.id,
      action: "content.approve",
      entity: "exam",
      entityId: examId,
      before: { status: "pending" },
      after: { status: "approved", pointsAwarded: EXAM_APPROVAL_POINTS },
    }, { log });

    // 9. Hadiah level.
    const levelRewards = await checkAndGrantLevelRewards(submitterId, submitter.points, newPoints);

    // 10. Notifikasi. Best effort, tidak pernah melempar.
    await enqueueMail(
      db,
      {
        toUserId: submitterId,
        kind: "exam_approved",
        // Kunci yang sama dengan penolakan: satu submission hanya diputus sekali,
        // jadi kedua jenis surel itu tidak mungkin sama-sama terkirim.
        dedupeKey: `sub:${submissionId}`,
        payload: { title: exam.title, points: EXAM_APPROVAL_POINTS },
      },
      log,
    );
    await notifyUnlockedBadges(db, submitterId, log);

    return NextResponse.json({
      success: true,
      pointsAwarded: EXAM_APPROVAL_POINTS,
      levelRewards: levelRewards.map((r) => r.label),
    }, { status: 200 });
  } catch (error) {
    log.error("Exam approve error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
