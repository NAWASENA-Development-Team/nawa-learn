import { db } from "@/db";
import { questions } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import DailyQuizClient from "@/components/questions/DailyQuizClient";

export const dynamic = "force-dynamic";

/**
 * How many questions one daily session contains.
 *
 * The cap used to be applied in the browser, which meant every question in the
 * category crossed the network so that most of them could be thrown away. It is
 * applied here instead: the server picks the session, and the client renders it.
 */
const SESSION_SIZE = 20;

/** Fisher–Yates. Returns a new array; the input is not mutated. */
function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default async function DailyQuizPage() {
  // Approved questions for Kuis Harian.
  //
  // `answerKey` and `explanation` are deliberately NOT selected: the score is
  // decided by /api/quiz/submit on the server, so the browser never receives
  // the answers in the first place.
  const allQuestions = await db.query.questions.findMany({
    where: and(
      eq(questions.status, "approved"),
      eq(questions.category, "Kuis Harian")
    ),
    columns: { id: true, questionText: true, options: true },
    orderBy: [desc(questions.createdAt)],
  });

  // Shuffling here, not in the component, is what keeps the first paint
  // identical on the server and in the browser. A `Math.random()` call during
  // the client render (or in a mount effect) either causes a hydration mismatch
  // or an extra empty render before the queue appears.
  const sessionQuestions = shuffled(allQuestions)
    .slice(0, SESSION_SIZE)
    .map((q) => ({
      id: q.id,
      questionText: q.questionText,
      // `options` is a jsonb column, so drizzle can only type it as `unknown`.
      // Every writer goes through `questionSubmitSchema` in
      // `src/app/api/questions/submit/route.ts`, which is `.strict()` and types
      // the four options as strings, so a non-string value cannot be stored.
      options: q.options as Record<string, string>,
    }));

  return <DailyQuizClient initialQuestions={sessionQuestions} />;
}
