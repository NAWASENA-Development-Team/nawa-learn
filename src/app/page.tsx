// app/page.tsx
import { db } from "@/db";
import { modules, questions, users } from "@/db/schema";
import { count, eq, desc, sql } from "drizzle-orm";
import LandingClient from "@/components/landing/LandingClient";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // 1. Fetch real counts from DB
  const [approvedModulesCountResult] = await db
    .select({ value: count() })
    .from(modules)
    .where(eq(modules.status, "approved"));

  const [approvedQuestionsCountResult] = await db
    .select({ value: count() })
    .from(questions)
    .where(eq(questions.status, "approved"));

  const [studentsCountResult] = await db
    .select({ value: count() })
    .from(users);

  const [contributorsCountResult] = await db
    .select({ value: count() })
    .from(users)
    .where(sql`${users.points} > 0 OR ${users.role} = 'contributor'`);

  const modulesCount = approvedModulesCountResult?.value || 0;
  const questionsCount = approvedQuestionsCountResult?.value || 0;
  const studentsCount = studentsCountResult?.value || 0;
  const contributorsCount = contributorsCountResult?.value || 0;

  // 2. Fetch latest 3 modules for preview (syncs instantly upon upload!)
  const dbSampleModules = await db.query.modules.findMany({
    orderBy: [desc(modules.createdAt)],
    limit: 3,
  });

  // 3. Realistic fallbacks if database has less than 3 approved modules
  const defaultSampleModules = [
    { title: "Matematika — Limit dan Turunan", category: "UTBK", points: 50 },
    { title: "Fisika — Mekanika Fluida Lengkap", category: "Olimpiade", points: 50 },
    { title: "Kimia — Stoikiometri & Reaksi Redoks", category: "UTBK", points: 50 },
  ];

  const sampleModules = dbSampleModules.map((m) => ({
    id: m.id,
    title: m.title,
    category: m.category,
    points: 50,
  }));

  // Pad with defaults if less than 3
  let fallbackIdx = 0;
  while (sampleModules.length < 3 && fallbackIdx < defaultSampleModules.length) {
    sampleModules.push({
      id: `default-${fallbackIdx}`,
      ...defaultSampleModules[fallbackIdx]
    });
    fallbackIdx++;
  }

  // 4. Set dynamic stats
  const stats = {
    modules: modulesCount,
    questions: questionsCount,
    students: studentsCount,
    contributors: contributorsCount,
  };

  return <LandingClient stats={stats} sampleModules={sampleModules} />;
}
