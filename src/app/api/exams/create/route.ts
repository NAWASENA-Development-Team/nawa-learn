// app/api/exams/create/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { customExams } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
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
    // H3: this route used to accept exam creation with no session at all, and
    // stored `author_id = NULL` for anyone who did not have a provisioned row.
    // A custom exam is stored content that other students can read back through
    // /api/exams/list, so "anyone on the internet may write one" was a spam
    // surface, not a feature. `requireUser()` closes it; `custom_exams.author_id`
    // stays nullable so the rows written before this change remain valid.
    //
    // Resolving the author first also puts the rate-limit guard ahead of the
    // (potentially 256 KB) payload instead of after it.
    const authz = await requireUser();
    if (!authz.ok) return authz.response;
    const author = authz.user;

    const limit = await rateLimit(req, "exams/create", author.id);
    if (!limit.ok) return limit.response;

    const parsed = await parseJsonBody(req, createSchema, { maxBytes: MAX_EXAM_BODY_BYTES });
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

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
      })
      .returning({ id: customExams.id });

    return NextResponse.json({ success: true, examId: exam.id }, { status: 201 });
  } catch (error) {
    log.error("Exam create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

