// app/api/questions/daily-create/route.ts
// Reviewer-only endpoint to create daily quiz questions directly (auto-approved).
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dailyQuizSlot, questions, submissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireReviewer } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { parseJsonBody, shortText } from "@/lib/validation";
import { startOfDailyWindow } from "@/lib/dailyWindow";

// A question written straight into the daily quiz, so it is approved on arrival
// and never passes a reviewer. The schema is therefore the only gate: A and B
// are mandatory, C and D are required too because the daily quiz always renders
// four options, and the answer key has to point at a non-empty option.
const dailyQuestionSchema = z
  .object({
    questionText: shortText(2000, 10),
    options: z
      .object({
        A: shortText(500),
        B: shortText(500),
        C: shortText(500),
        D: shortText(500),
        E: shortText(500).optional(),
      })
      .strict(),
    answerKey: z.enum(["A", "B", "C", "D", "E"]),
    difficulty: z.enum(["mudah", "sedang", "sulit"]),
    subject: shortText(100, 2).optional().default("Umum"),
  })
  .strict()
  .refine((data) => Boolean(data.options[data.answerKey]), {
    message: "Answer key must match one of the provided options",
    path: ["answerKey"],
  });

export async function POST(req: Request) {
  const log = requestLogger(req);
  // Auto-approved content, so reviewers only — staff or a seated season moderator.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;
  const dbUser = authz.user;

  try {
    const parsed = await parseJsonBody(req, dailyQuestionSchema);
    if (!parsed.ok) return parsed.response;
    const { questionText, options, answerKey, difficulty, subject } = parsed.data;

    // Satu hari, satu slot. Sebelum M16 route ini menyisipkan soal tanpa
    // memeriksa apa pun, jadi tiga peninjau yang membuat soal pukul 03:00
    // menghasilkan tiga soal — dan tidak ada satu pun yang bisa disebut
    // "kuis hari ini".
    //
    // Urutannya: soal dulu, slot kedua, kompensasi bila slot sudah diambil.
    // Slot tidak bisa diklaim lebih dulu karena `question_id` wajib menunjuk
    // soal yang sudah ada; jadi yang kalah balapan menghapus soalnya sendiri.
    // Primary key `window_start` + `ON CONFLICT DO NOTHING` tetap yang memutuskan
    // pemenangnya — tanpa `SELECT` yang bisa dilewati dua permintaan bersamaan.
    const windowStart = startOfDailyWindow();

    // Insert question directly as approved with category "Kuis Harian"
    const [newQuestion] = await db.insert(questions).values({
      questionText,
      options,
      answerKey,
      difficulty,
      subject,
      category: "Kuis Harian",
      uploaderId: dbUser.id,
      status: "approved", // Auto-approved since a reviewer creates it
    }).returning();

    const claimed = await db
      .insert(dailyQuizSlot)
      .values({ windowStart, questionId: newQuestion.id, authorId: dbUser.id })
      .onConflictDoNothing()
      .returning({ windowStart: dailyQuizSlot.windowStart });

    if (claimed.length === 0) {
      // Kalah balapan: hari ini sudah punya soal kurasi. Soal yang baru dibuat
      // dihapus lagi supaya tidak ada soal yatim berstatus `approved` yang
      // menyelinap ke sesi kuis harian tanpa pernah menjadi "soal hari ini".
      try {
        await db.delete(questions).where(eq(questions.id, newQuestion.id));
      } catch (error) {
        log.error("daily slot compensation delete failed", {
          error,
          questionId: newQuestion.id,
        });
      }
      return NextResponse.json(
        {
          error: "Kuis Harian hari ini sudah dibuat.",
          code: "daily_slot_taken",
        },
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }

    // Also create a submission record for tracking
    await db.insert(submissions).values({
      type: "question",
      refId: newQuestion.id,
      submitterId: dbUser.id,
      status: "approved",
      feedback: "Dibuat langsung oleh moderator untuk Kuis Harian.",
    });

    return NextResponse.json({
      success: true,
      questionId: newQuestion.id,
      message: "Soal Kuis Harian berhasil ditambahkan!",
    });

  } catch (error) {
    log.error("Daily question create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// GET: Fetch all existing daily quiz questions for the reviewer to see
export async function GET(req: Request) {
  const log = requestLogger(req);
  // Includes answer keys — reviewers only.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;

  try {
    const dailyQuestions = await db.query.questions.findMany({
      where: eq(questions.category, "Kuis Harian"),
      orderBy: (q, { desc }) => [desc(q.createdAt)],
    });

    return NextResponse.json({ success: true, data: dailyQuestions });
  } catch (error) {
    log.error("Daily questions list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
