// app/api/exams/create/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { customExams, users } from "@/db/schema";
import { eq } from "drizzle-orm";
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
    const { userId: clerkId } = await auth();

    // Resolve the author before parsing the body, so the rate-limit guard can sit
    // ahead of the (potentially large) payload instead of after it.
    let authorId: string | null = null;
    let authorName = "Siswa SMAN 2";

    if (clerkId) {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true, name: true },
      });
      if (dbUser) {
        authorId = dbUser.id;
        authorName = dbUser.name;
      }
    }

    // Anonymous exam creation is still allowed (see H3), so `authorId` may be
    // null and only the IP bucket applies.
    const limit = await rateLimit(req, "exams/create", authorId);
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
        authorId: authorId ?? undefined,
        authorName,
      })
      .returning({ id: customExams.id });

    return NextResponse.json({ success: true, examId: exam.id }, { status: 201 });
  } catch (error) {
    log.error("Exam create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

