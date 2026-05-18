// app/(dashboard)/profile/[id]/page.tsx
import { db } from "@/db";
import { users, modules, questions, pointsLog } from "@/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ProfileClient from "@/components/profile/ProfileClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicProfilePage({ params }: PageProps) {
  // Await params for safe Next.js 16 compatibility
  const { id: profileUserId } = await params;

  // 1. Fetch user by Neon Database UUID
  let dbUser;
  try {
    dbUser = await db.query.users.findFirst({
      where: eq(users.id, profileUserId),
    });
  } catch (err) {
    console.error("Invalid UUID or database error fetching profile:", err);
  }

  // 2. Render user not found if user does not exist
  if (!dbUser) {
    return (
      <div className="max-w-md mx-auto p-10 mt-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-center shadow-lg">
        <span className="text-5xl">🧐</span>
        <h2 className="text-xl font-bold mt-4 text-zinc-900 dark:text-white">Siswa Tidak Ditemukan</h2>
        <p className="text-sm text-zinc-550 dark:text-zinc-400 mt-2">
          Maaf, profil siswa dengan ID tersebut tidak ditemukan di SMAN 2 Jonggol atau tautan yang Anda ikuti sudah usang.
        </p>
        <div className="mt-6">
          <a
            href="/leaderboard"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-bold transition-all shadow-md"
          >
            Lihat Papan Peringkat
          </a>
        </div>
      </div>
    );
  }

  // 3. Determine if this profile belongs to the currently authenticated user
  const { userId: clerkId } = await auth();
  const isOwnProfile = clerkId ? dbUser.clerkId === clerkId : false;

  // 4. Retrieve rank statistics
  const [higherPointsResult] = await db
    .select({ value: count() })
    .from(users)
    .where(sql`${users.points} > ${dbUser.points}`);

  const rank = (higherPointsResult?.value || 0) + 1;

  const [totalStudentsResult] = await db
    .select({ value: count() })
    .from(users);
  
  const totalStudents = totalStudentsResult?.value || 1;

  // 5. Retrieve user's contributed modules
  // If it's another user, we ONLY show approved modules to keep it clean and private
  const modulesCondition = isOwnProfile 
    ? eq(modules.uploaderId, dbUser.id)
    : sql`${modules.uploaderId} = ${dbUser.id} AND ${modules.status} = 'approved'`;

  const fetchedModules = await db
    .select()
    .from(modules)
    .where(modulesCondition)
    .orderBy(desc(modules.createdAt));

  const serializedModules = fetchedModules.map((m) => ({
    id: m.id,
    title: m.title,
    subject: m.subject,
    grade: m.grade,
    category: m.category,
    downloads: m.downloads,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
  }));

  // 6. Retrieve user's contributed questions
  // If it's another user, we ONLY show approved questions
  const questionsCondition = isOwnProfile
    ? eq(questions.uploaderId, dbUser.id)
    : sql`${questions.uploaderId} = ${dbUser.id} AND ${questions.status} = 'approved'`;

  const fetchedQuestions = await db
    .select()
    .from(questions)
    .where(questionsCondition)
    .orderBy(desc(questions.createdAt));

  const serializedQuestions = fetchedQuestions.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    difficulty: q.difficulty,
    status: q.status,
    createdAt: q.createdAt.toISOString(),
  }));

  // 7. Retrieve user's point logs
  const fetchedPointLogs = await db
    .select()
    .from(pointsLog)
    .where(eq(pointsLog.userId, dbUser.id))
    .orderBy(desc(pointsLog.createdAt))
    .limit(20);

  const serializedPointLogs = fetchedPointLogs.map((log) => ({
    id: log.id,
    action: log.action,
    delta: log.delta,
    createdAt: log.createdAt.toISOString(),
  }));

  // Prepare profile payload
  const profilePayload = {
    id: dbUser.id,
    clerkId: dbUser.clerkId,
    name: dbUser.name,
    email: isOwnProfile ? dbUser.email : "", // Hide other people's emails for privacy
    role: dbUser.role as "guest" | "student" | "contributor" | "moderator" | "admin",
    points: dbUser.points,
    createdAt: dbUser.createdAt.toISOString(),
    rank,
    totalStudents,
  };

  return (
    <ProfileClient 
      user={profilePayload}
      userModules={serializedModules}
      userQuestions={serializedQuestions}
      pointLogs={serializedPointLogs}
      isOwnProfile={isOwnProfile}
    />
  );
}
