// app/api/questions/submit/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { questions, submissions } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { optionalText, parseJsonBody, shortText } from "@/lib/validation";

const submitSchema = z
  .object({
    questionText: shortText(2000, 10),
    options: z
      .object({
        A: shortText(500),
        B: shortText(500),
        C: shortText(500).optional().default("-"),
        D: shortText(500).optional().default("-"),
        E: shortText(500).optional().default("-"),
      })
      .strict(),
    answerKey: z.enum(["A", "B", "C", "D", "E"]),
    explanation: optionalText(2000),
    difficulty: z.enum(["mudah", "sedang", "sulit"]),
    subject: shortText(100, 2),
    category: shortText(100, 2),
  })
  .strict();

export async function POST(req: Request) {
  const log = requestLogger(req);
  try {
    // M14d: `requireUser()` replaces the hand-rolled auth + lookup. The role
    // rule below is a real authorisation decision and stays — "signed in" is not
    // the same thing as "allowed to upload".
    const authz = await requireUser();
    if (!authz.ok) return authz.response;
    const dbUser = authz.user;

    if (dbUser.role === "student") return NextResponse.json({ error: "Hanya kontributor yang dapat mengunggah soal" }, { status: 403 });

    const limit = await rateLimit(req, "questions/submit", dbUser.id);
    if (!limit.ok) return limit.response;

    const parsed = await parseJsonBody(req, submitSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // The answer key must point at an option that actually has content.
    if (!data.options[data.answerKey]) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: [{ path: "answerKey", message: `Option ${data.answerKey} is empty` }],
        },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }

    // Insert question
    const [question] = await db.insert(questions).values({
      questionText: data.questionText,
      options: data.options,
      answerKey: data.answerKey,
      explanation: data.explanation || null,
      difficulty: data.difficulty,
      subject: data.subject,
      category: data.category,
      uploaderId: dbUser.id,
      status: "pending",
    }).returning({ id: questions.id });

    // Create submission record
    await db.insert(submissions).values({
      type: "question",
      refId: question.id,
      submitterId: dbUser.id,
      status: "pending",
    });

    return NextResponse.json({ success: true, questionId: question.id }, { status: 201 });
  } catch (error) {
    log.error("Question submit error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
