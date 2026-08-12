import { db } from "@/db";
import { questions } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import DailyQuizClient from "@/components/questions/DailyQuizClient";

export const dynamic = "force-dynamic";

export default async function DailyQuizPage() {
  // Fetch approved questions specifically for Kuis Harian
  const allQuestions = await db.query.questions.findMany({
    where: and(
      eq(questions.status, "approved"),
      eq(questions.category, "Kuis Harian")
    ),
    orderBy: [desc(questions.createdAt)],
  });

  return <DailyQuizClient initialQuestions={allQuestions} />;
}
