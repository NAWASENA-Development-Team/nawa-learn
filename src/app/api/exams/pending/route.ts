// app/api/exams/pending/route.ts
// ─── Antrean tinjauan paket ujian ─────────────────────────────────────────────
//
// Antreannya adalah baris `submissions` bertipe `'exam'`, bukan tabel baru: satu
// tempat keputusan sudah ada (`submissions`), lengkap dengan `reviewer_id` dan
// `feedback`, dan panel moderator sudah memegang polanya. `type` adalah varchar,
// jadi tidak ada enum yang perlu dimigrasikan untuk satu nilai ini.
//
// Route ini **mengirim kunci jawaban** — itu bukan kebocoran, itu inti
// pekerjaannya: peninjau yang tidak melihat kunci tidak bisa memutuskan apakah
// paketnya benar. Karena itu `requireReviewer()` dan bukan `requireUser()`, dan
// `tests/unit/pii-surface.test.ts`/`examScoring.test.ts` menjaga agar satu-
// satunya jalan kunci keluar adalah lewat sini.
import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customExams, submissions, users } from "@/db/schema";
import { requireReviewer } from "@/lib/authz";
import { toReviewExamQuestions } from "@/lib/examScoring";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const log = requestLogger(req);
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;

  const limit = await rateLimit(req, "exams/pending", authz.user.id);
  if (!limit.ok) return limit.response;

  try {
    const rows = await db
      .select({
        submissionId: submissions.id,
        submittedAt: submissions.submittedAt,
        examId: customExams.id,
        title: customExams.title,
        subject: customExams.subject,
        category: customExams.category,
        difficulty: customExams.difficulty,
        durationMinutes: customExams.durationMinutes,
        questions: customExams.questions,
        submitterId: submissions.submitterId,
        submitterName: users.name,
      })
      .from(submissions)
      .innerJoin(customExams, eq(submissions.refId, customExams.id))
      .innerJoin(users, eq(submissions.submitterId, users.id))
      .where(
        and(
          eq(submissions.type, "exam"),
          eq(submissions.status, "pending"),
        ),
      )
      // Tertua lebih dulu: sebuah antrean yang menampilkan yang terbaru di atas
      // membuat kiriman lama tidak pernah sampai ke layar.
      .orderBy(asc(submissions.submittedAt));

    const data = rows.map(({ questions, ...row }) => {
      // Kunci ikut, dan hanya di route ini.
      const reviewQuestions = toReviewExamQuestions(questions);
      return { ...row, questions: reviewQuestions, questionCount: reviewQuestions.length };
    });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    log.error("Pending exams error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
