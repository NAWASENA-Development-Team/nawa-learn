// app/api/questions/daily-create/route.ts
// Moderator-only endpoint to create daily quiz questions directly (auto-approved).
import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions, submissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireModerator } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { parseJsonBody, shortText } from "@/lib/validation";

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
  // Auto-approved content, so moderator/admin only.
  const authz = await requireModerator();
  if (!authz.ok) return authz.response;
  const dbUser = authz.user;

  try {
    const parsed = await parseJsonBody(req, dailyQuestionSchema);
    if (!parsed.ok) return parsed.response;
    const { questionText, options, answerKey, difficulty, subject } = parsed.data;

    // Insert question directly as approved with category "Kuis Harian"
    const [newQuestion] = await db.insert(questions).values({
      questionText,
      options,
      answerKey,
      difficulty,
      subject,
      category: "Kuis Harian",
      uploaderId: dbUser.id,
      status: "approved", // Auto-approved since moderator creates it
    }).returning();

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

// GET: Fetch all existing daily quiz questions for the moderator to see
export async function GET(req: Request) {
  const log = requestLogger(req);
  // Includes answer keys — moderator/admin only.
  const authz = await requireModerator();
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
