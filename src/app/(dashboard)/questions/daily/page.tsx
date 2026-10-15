import { db } from "@/db";
import { questions } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import DailyQuizClient from "@/components/questions/DailyQuizClient";

export const dynamic = "force-dynamic";

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

  return <DailyQuizClient initialQuestions={allQuestions} />;
}
