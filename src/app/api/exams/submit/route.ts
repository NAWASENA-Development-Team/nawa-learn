// app/api/exams/submit/route.ts
// Grades a student-authored ("custom") exam.
//
// Custom exams are a jsonb blob on `custom_exams`, not rows in `questions`, so
// the quiz grader cannot see them. Before this route existed the browser held the
// answer keys and graded itself — which is exactly why /api/exams/list used to
// hand those keys out. Grading here is what lets that list stop shipping them.
//
// It deliberately awards nothing. M3 decided that an exam a student wrote can
// never move V-Points, and this route does not change that: it has no pointsLog
// write, no points update and no level-reward check. It grades, and says so.
//
// M18 menambahkan dua penjaga sebelum penilaian:
//
//   1. `status = 'approved'`. Sejak paket ujian harus ditinjau, ada paket
//      `pending` dan `rejected` di database, dan mengerjakan yang belum ditinjau
//      berarti memakai kunci yang belum diperiksa siapa pun. Jawabannya **404**,
//      bukan 403: bagi siswa, paket yang belum tayang memang tidak ada — sama
//      seperti paket yang sudah dihapus.
//   2. Karya sendiri tidak bisa dikerjakan. Penulisnya memegang kuncinya, jadi
//      "mengerjakan" paket sendiri selalu skor penuh, dan sebuah skor penuh yang
//      bisa dibuat sendiri tidak berarti apa pun. Ini 403 dengan kode yang jelas,
//      karena penulisnya memang melihat paket itu di halamannya sendiri.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customExams } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { examSubmitSchema, gradeExam } from "@/lib/examScoring";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";

export async function POST(req: Request) {
  const log = requestLogger(req);

  const authz = await requireUser();
  if (!authz.ok) return authz.response;

  const limit = await rateLimit(req, "exams/submit", authz.user.id);
  if (!limit.ok) return limit.response;

  const parsed = await parseJsonBody(req, examSubmitSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const [exam] = await db
      .select({
        questions: customExams.questions,
        status: customExams.status,
        authorId: customExams.authorId,
      })
      .from(customExams)
      .where(eq(customExams.id, parsed.data.examId))
      .limit(1);

    // `pending` dan `rejected` dijawab 404 yang sama dengan "tidak ada":
    // membedakannya akan memberi tahu siswa bahwa sebuah paket sedang ditinjau,
    // dan itu urusan penulisnya serta moderatornya.
    if (!exam || exam.status !== "approved") {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    if (exam.authorId !== null && exam.authorId === authz.user.id) {
      return NextResponse.json(
        {
          error: "Kamu tidak dapat mengerjakan paket ujian yang kamu buat sendiri.",
          code: "own_exam_forbidden",
        },
        { status: 403 },
      );
    }

    const grade = gradeExam(exam.questions, parsed.data.answers);

    // The same shape /api/quiz/submit answers with, so the practice page can keep
    // one rendering path for both. `rewardable: false` is what tells the UI this
    // was graded but pays nothing.
    return NextResponse.json(
      {
        success: true,
        rewardable: false,
        pointsAwarded: 0,
        penaltyPoints: 0,
        correctCount: grade.correctCount,
        wrongAnswers: grade.totalCount - grade.correctCount,
        totalCount: grade.totalCount,
        creditedCount: 0,
        alreadyCompleted: false,
        results: grade.results,
        levelRewards: [],
      },
      { status: 200 },
    );
  } catch (error) {
    log.error("Exam grading error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
