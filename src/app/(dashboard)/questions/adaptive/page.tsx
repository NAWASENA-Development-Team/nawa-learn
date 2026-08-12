import { db } from "@/db";
import { questions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import AdaptiveQuizClient from "@/components/questions/AdaptiveQuizClient";

export const dynamic = "force-dynamic";

export default async function AdaptiveQuizPage() {
  // Fetch approved questions
  const allQuestions = await db.query.questions.findMany({
    where: eq(questions.status, "approved"),
    orderBy: [desc(questions.createdAt)],
  });

  return <AdaptiveQuizClient initialQuestions={allQuestions} />;
}
