// app/api/exams/create/route.ts
// ─── Paket ujian: dibuat kontributor, ditinjau sebelum tayang ─────────────────
//
// Sebelum M18 route ini menerima **siapa pun** yang punya sesi, langsung
// menerbitkan paketnya, dan tidak menyimpan baris `submissions`. Dua akibatnya:
// siswa yang belum pernah berkontribusi pun bisa membuat paket 50 soal yang
// langsung dikerjakan orang lain, dan tidak ada satu pun layar yang bisa
// meninjau — paket yang salah kunci membebani setiap siswa yang mengerjakannya,
// bukan hanya penulisnya.
//
// M18 menutup keduanya: perannya harus contributor ke atas, paketnya masuk
// `pending`, dan baris `submissions` (`type: 'exam'`) adalah apa yang benar-benar
// diputuskan moderator. `submissions.type` adalah varchar, jadi tidak ada enum
// baru yang perlu dimigrasikan untuk satu nilai ini.
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customExams, submissions } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import {
  MAX_PENDING_EXAMS,
  MAX_PUBLISHED_EXAMS,
  examPendingQuotaResponse,
  examPublishedQuotaResponse,
  pendingExamCount,
  publishedExamCount,
} from "@/lib/submissionQuota";
import { optionalText, parseJsonBody, shortText } from "@/lib/validation";

// `explanation` is nullish rather than optional: the exam builder sends `null`
// for a question with no explanation, and the old `z.string().optional()` turned
// that into a 400 — so saving any exam with one blank explanation failed.
const questionSchema = z
  .object({
    id: shortText(200),
    text: shortText(2000),
    options: z
      .object({
        A: z.string().trim().max(500),
        B: z.string().trim().max(500),
        C: z.string().trim().max(500),
        D: z.string().trim().max(500),
        E: z.string().trim().max(500),
      })
      .strict(),
    answerKey: z.enum(["A", "B", "C", "D", "E"]),
    explanation: optionalText(2000).nullable(),
  })
  .strict();

const createSchema = z
  .object({
    title: shortText(200, 3),
    subject: shortText(100),
    category: shortText(100),
    difficulty: shortText(50),
    durationMinutes: z.number().int().min(1).max(180),
    questions: z.array(questionSchema).min(1).max(50),
  })
  .strict();

/** 50 questions with five options each is ~25 KB; this is the generous ceiling. */
const MAX_EXAM_BODY_BYTES = 256 * 1024;

export async function POST(req: Request) {
  const log = requestLogger(req);
  try {
    // 1. Sesi, lalu peran, lalu kursi — sebelum badan dibaca.
    //
    // Urutannya sengaja: `requireUser()` menjawab 401/403 untuk sesi, dua
    // penjaga di bawah menjawab pertanyaan yang berbeda ("boleh membuat paket?"
    // dan "boleh menerbitkan karya?"), dan baru setelah itu server mem-parse
    // payload hingga 256 KB.
    const authz = await requireUser();
    if (!authz.ok) return authz.response;
    const author = authz.user;

    // Siswa boleh mengajukan modul dan soal — itu jalan menjadi kontributor —
    // tetapi **belum** boleh membuat paket ujian. Satu paket berisi hingga 50
    // soal sekaligus, jadi ini permukaan yang paling mahal untuk ditinjau dan
    // paling merugikan bila salah; ia dibuka setelah ada karya yang disetujui.
    if (author.role === "student") {
      return NextResponse.json(
        {
          error:
            "Paket ujian hanya bisa dibuat kontributor. Ajukan modul atau soal lebih dulu — setelah satu karya disetujui dan poinmu mencapai 100, kamu menjadi kontributor.",
          code: "contributor_required",
        },
        { status: 403 },
      );
    }

    // Kursi Dewan Podium tidak menerbitkan karya apa pun, termasuk paket ujian.
    // Alasannya sama dengan modul dan soal, ditambah satu: approval paket
    // membayar +20 V-Points ke penulisnya, dan kursi sudah menerima stipend
    // harian dari posisi yang ia menangkan.
    if (author.seasonRoleKey !== null) {
      return NextResponse.json(
        {
          error: "Pemegang kursi Dewan Podium tidak dapat membuat paket ujian.",
          code: "seat_cannot_upload",
        },
        { status: 403 },
      );
    }

    const limit = await rateLimit(req, "exams/create", author.id);
    if (!limit.ok) return limit.response;

    // 2. Batas antrean dan batas terbit, sebelum badan dibaca. Keduanya 409:
    // keadaannya adalah data ("kamu punya terlalu banyak yang belum diputus"),
    // bukan kecepatan.
    if ((await pendingExamCount(db, author.id)) >= MAX_PENDING_EXAMS) {
      return examPendingQuotaResponse();
    }
    if ((await publishedExamCount(db, author.id)) >= MAX_PUBLISHED_EXAMS) {
      return examPublishedQuotaResponse();
    }

    const parsed = await parseJsonBody(req, createSchema, { maxBytes: MAX_EXAM_BODY_BYTES });
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // 3. Paket ditulis `pending`. `statusEnum` yang sudah ada dipakai ulang,
    // jadi tidak ada nilai baru yang perlu dipahami pembaca lain.
    const [exam] = await db
      .insert(customExams)
      .values({
        title: data.title,
        subject: data.subject,
        category: data.category,
        difficulty: data.difficulty,
        durationMinutes: data.durationMinutes,
        questions: data.questions,
        authorId: author.id,
        authorName: author.name,
        status: "pending",
      })
      .returning({ id: customExams.id });

    // 4. Baris antrean. Bila langkah ini gagal, paket yang baru dibuat **dihapus
    //    lagi**: paket `pending` tanpa baris `submissions` tidak akan pernah
    //    muncul di antrean mana pun, jadi membiarkannya berarti menyimpan karya
    //    yang penulisnya kira sedang ditinjau padahal tidak ada yang akan
    //    membacanya. Pola kompensasi yang sama dipakai slot kuis harian.
    try {
      await db.insert(submissions).values({
        type: "exam",
        refId: exam.id,
        submitterId: author.id,
        status: "pending",
      });
    } catch (submissionError) {
      log.error("exam_submission_backfill_failed", submissionError);
      try {
        await db.delete(customExams).where(eq(customExams.id, exam.id));
      } catch (cleanupError) {
        log.error("exam_orphan_cleanup_failed", cleanupError);
      }
      return NextResponse.json(
        { error: "Gagal mendaftarkan paket ujian ke antrean tinjauan. Coba lagi." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        examId: exam.id,
        status: "pending",
        message: "Paket ujian terkirim dan menunggu tinjauan moderator.",
      },
      { status: 201 },
    );
  } catch (error) {
    log.error("Exam create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
