// app/api/exams/reject/route.ts
// ─── Menolak paket ujian ──────────────────────────────────────────────────────
//
// Penolakan **tidak** menghapus paketnya. Paket yang ditolak tetap ada sebagai
// milik penulisnya (`status = 'rejected'`), terlihat di halaman kontribusi
// bersamaan statusnya, dan penulisnya sendiri yang memutuskan untuk menghapus
// atau memperbaikinya. Menghapus karya orang lain dari sini akan membuat satu
// klik moderator menghilangkan pekerjaan yang mungkin hanya salah satu soalnya.
//
// Bedanya dengan `questions/reject`: di sana penolakan adalah juga **take-down**
// soal yang sudah tayang (dipakai alur kuis harian). Di sini tidak ada alur itu —
// paket yang sudah `approved` tidak bisa ditolak lewat route ini, karena
// membatalkannya berarti menarik ujian dari siswa yang mungkin sedang
// mengerjakannya, dan itu keputusan yang butuh alur sendiri, bukan tombol antrean.
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customExams, submissions } from "@/db/schema";
import { requireReviewer, isHumanReviewer } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/auditLog";
import { isInConflictZone } from "@/lib/seat";
import { enqueueMail } from "@/lib/mailer";

const rejectSchema = z
  .object({
    submissionId: z.string().uuid(),
    feedback: z.string().max(1000).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const log = requestLogger(req);
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;
  const reviewer = authz.user;

  const limit = await rateLimit(req, "exams/reject", reviewer.id);
  if (!limit.ok) return limit.response;

  try {
    const parsed = await parseJsonBody(req, rejectSchema);
    if (!parsed.ok) return parsed.response;
    const { submissionId, feedback } = parsed.data;

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

    // Penjaga yang sama dengan approve, sebelum satu baris pun diubah: menolak
    // karya pesaing sama kuatnya dengan menyetujuinya.
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

    // Klaim submission secara atomik. Kalau sudah diputus, 409 — bukan menimpa
    // keputusan sebelumnya.
    const claimed = await db
      .update(submissions)
      .set({
        status: "rejected",
        reviewerId: reviewer.id,
        feedback: feedback || "Paket ujian belum bisa diterbitkan.",
      })
      .where(and(eq(submissions.id, submissionId), eq(submissions.status, "pending")))
      .returning({ id: submissions.id });

    if (claimed.length === 0) {
      return NextResponse.json({ error: "Submission already reviewed" }, { status: 409 });
    }

    // Paketnya tetap ada, hanya berubah status. Judul dikembalikan untuk surel.
    const rejected = await db
      .update(customExams)
      .set({ status: "rejected" })
      .where(and(eq(customExams.id, examId), eq(customExams.status, "pending")))
      .returning({ title: customExams.title });

    // Cermin dari `exams/approve`: kalau baris antreannya berhasil diklaim
    // tetapi paketnya ternyata bukan `pending` lagi, tidak ada yang berubah dan
    // tidak ada surel yang boleh berangkat. Menarik paket yang **sudah terbit**
    // adalah keputusan tersendiri (mencabut ujian dari siswa yang mungkin sedang
    // mengerjakannya), bukan efek samping tombol di antrean tinjauan.
    if (rejected.length === 0) {
      return NextResponse.json({ error: "Exam already reviewed" }, { status: 409 });
    }

    // 3. Jejak keputusan. Penolakan tidak membayar apa pun, jadi `points_log`
    // tidak akan pernah punya baris untuknya.
    await recordAudit(db, {
      actorId: reviewer.id,
      action: "content.reject",
      entity: "exam",
      entityId: examId,
      before: { status: "pending" },
      after: { status: "rejected", submissionId: submission.id },
    }, { log });

    // 4. Kabar ke penulis, beserta catatan peninjau. Penolakan tanpa alasan
    // adalah penolakan yang membuat orang berhenti mengirim.
    await enqueueMail(
      db,
      {
        toUserId: submission.submitterId,
        kind: "exam_rejected",
        dedupeKey: `sub:${submission.id}`,
        payload: {
          title: rejected[0]?.title ?? "Paket ujianmu",
          reason: feedback || "Paket ujian belum bisa diterbitkan.",
        },
      },
      log,
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    log.error("Exam reject error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
