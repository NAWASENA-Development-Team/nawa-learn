// app/api/exams/list/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { customExams } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireUser } from "@/lib/authz";
import { toPublicExamQuestions } from "@/lib/examScoring";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";

// A list, not a feed. Until real pagination lands (M13) this cap is what stops a
// single request from pulling every exam ever created.
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function readLimit(req: Request): number {
  const parsed = Number.parseInt(new URL(req.url).searchParams.get("limit") ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(req: Request) {
  const log = requestLogger(req);

  // This route had no in-handler guard at all until M14's H13 slice — it relied
  // entirely on src/proxy.ts, so while the proxy file sat at the repo root and was
  // never loaded, every exam (answer keys included) was readable anonymously. The
  // guard is local now; the proxy is defence in depth, not the only defence.
  const authz = await requireUser();
  if (!authz.ok) return authz.response;

  const limit = await rateLimit(req, "exams/list", authz.user.id);
  if (!limit.ok) return limit.response;

  try {
    const exams = await db
      .select({
        id: customExams.id,
        title: customExams.title,
        subject: customExams.subject,
        category: customExams.category,
        difficulty: customExams.difficulty,
        durationMinutes: customExams.durationMinutes,
        questions: customExams.questions,
        authorName: customExams.authorName,
        createdAt: customExams.createdAt,
      })
      .from(customExams)
      .orderBy(desc(customExams.createdAt))
      .limit(readLimit(req));

    // `questions` carries the answer keys, so it is redacted here — on the server,
    // before serialisation. Grading moves to /api/exams/submit, which is the only
    // place a key is ever compared to an answer.
    const data = exams.map(({ questions, ...exam }) => {
      const publicQuestions = toPublicExamQuestions(questions);
      return { ...exam, questionCount: publicQuestions.length, questions: publicQuestions };
    });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    log.error("Exam list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
