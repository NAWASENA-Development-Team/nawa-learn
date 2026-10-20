// src/app/page.tsx
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

  // 2. Fetch latest approved modules with uploader credit
  const dbSampleModules = await db
    .select({
      id: modules.id,
      title: modules.title,
      subject: modules.subject,
      category: modules.category,
      downloads: modules.downloads,
      uploaderName: users.name,
    })
    .from(modules)
    .leftJoin(users, eq(modules.uploaderId, users.id))
    .where(eq(modules.status, "approved"))
    .orderBy(desc(modules.createdAt))
    .limit(4);

  // 3. Authentic fallbacks if database has fewer than 4 approved modules
  const defaultSampleModules = [
    {
      id: "default-0",
      title: "Matematika Saintek — Limit Fungsi & Turunan Aljabar",
      subject: "Matematika",
      category: "UTBK-SNBT",
      downloads: 142,
      points: 50,
      uploaderName: "Ahmad Fauzi (XII MIPA 1)",
    },
    {
      id: "default-1",
      title: "Fisika Terpadu — Dinamika Rotasi & Kesetimbangan Benda Tegar",
      subject: "Fisika",
      category: "Olimpiade",
      downloads: 98,
      points: 50,
      uploaderName: "Siti Rahma (XI MIPA 2)",
    },
    {
      id: "default-2",
      title: "Kimia Dasar — Stoikiometri & Reaksi Redoks Lengkap",
      subject: "Kimia",
      category: "UTBK-SNBT",
      downloads: 175,
      points: 50,
      uploaderName: "Budi Santoso (XII MIPA 3)",
    },
    {
      id: "default-3",
      title: "Biologi Molekuler — Sintesis Protein & Pembelahan Sel",
      subject: "Biologi",
      category: "Kurikulum Merdeka",
      downloads: 120,
      points: 50,
      uploaderName: "Dewi Lestari (XI MIPA 1)",
    },
  ];

  const sampleModules = dbSampleModules.map((m) => ({
    id: m.id,
    title: m.title,
    subject: m.subject,
    category: m.category,
    downloads: m.downloads ?? 0,
    uploaderName: m.uploaderName || "Kontributor NAWASENA",
    points: 50,
  }));

  let fallbackIdx = 0;
  while (sampleModules.length < 4 && fallbackIdx < defaultSampleModules.length) {
    sampleModules.push({
      ...defaultSampleModules[fallbackIdx],
      id: `default-${fallbackIdx}`,
    });
    fallbackIdx++;
  }

  const stats = {
    modules: modulesCount,
    questions: questionsCount,
    students: studentsCount,
    contributors: contributorsCount,
  };

  return <LandingClient stats={stats} sampleModules={sampleModules} />;
}
