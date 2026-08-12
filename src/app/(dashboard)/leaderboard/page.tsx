// app/(dashboard)/leaderboard/page.tsx
import { db } from "@/db";
import { users, modules, questions, pointsLog } from "@/db/schema";
import { desc, count, eq, sql, inArray } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import LeaderboardClient from "@/components/leaderboard/LeaderboardClient";

// Halaman ini dirender di server untuk memastikan data peringkat selalu up-to-date
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  // 1. Mengambil 100 kontributor teratas untuk pencarian interaktif di client
  const topUsersData = await db.query.users.findMany({
    orderBy: [desc(users.points)],
    limit: 100,
    columns: {
      id: true,
      name: true,
      points: true,
      avatarIndex: true,
      photoUrl: true,
    }
  });

  const topUserIds = topUsersData.map(u => u.id);

  // Get data to compute exact specialty badges
  const allModules = topUserIds.length ? await db.query.modules.findMany({
    where: inArray(modules.uploaderId, topUserIds),
  }) : [];
  
  const allQuestions = topUserIds.length ? await db.query.questions.findMany({
    where: inArray(questions.uploaderId, topUserIds),
  }) : [];
  
  const allLogs = topUserIds.length ? await db.query.pointsLog.findMany({
    where: inArray(pointsLog.userId, topUserIds),
  }) : [];

  const topUsers = topUsersData.map((u, i) => {
    const rank = i + 1;
    const userMods = allModules.filter(m => m.uploaderId === u.id);
    const userQs = allQuestions.filter(q => q.uploaderId === u.id);
    const userLogs = allLogs.filter(l => l.userId === u.id);

    const stats = {
      hardQuizzes: userLogs.filter(l => l.action === "quiz_completed_sulit" || l.action === "quiz_completed_sangat sulit").length,
      approvedMods: userMods.filter(m => m.status === "approved").length,
      quizTotal: userLogs.filter(l => l.action.startsWith("quiz_completed")).length,
      diverseSubjects: new Set(userMods.filter(m => m.status === "approved").map(m => m.subject)).size,
      approvedQuestions: userQs.filter(q => q.status === "approved").length,
      totalDownloads: userMods.reduce((a, m) => a + m.downloads, 0),
    };

    return {
      ...u,
      stats // We pass stats down so client can use getSpecialtyBadge
    };
  });

  // 2. Mengambil total seluruh siswa kontributor
  const [totalStudentsResult] = await db
    .select({ value: count() })
    .from(users);
  
  const totalStudents = totalStudentsResult?.value || 1;

  // 3. Mengambil status peringkat user yang sedang login saat ini (jika ada)
  const { userId: clerkId } = await auth();
  let loggedInUser = null;

  if (clerkId) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: {
        id: true,
        name: true,
        points: true,
        avatarIndex: true,
        photoUrl: true,
      }
    });

    if (dbUser) {
      // Hitung rank user dengan menjumlahkan siswa yang punya poin di atas user ini + 1
      const [higherPointsResult] = await db
        .select({ value: count() })
        .from(users)
        .where(sql`${users.points} > ${dbUser.points}`);
      
      loggedInUser = {
        id: dbUser.id,
        name: dbUser.name,
        points: dbUser.points,
        rank: (higherPointsResult?.value || 0) + 1,
        avatarIndex: dbUser.avatarIndex ?? null,
        photoUrl: dbUser.photoUrl ?? null,
      };
    }
  }

  return (
    <LeaderboardClient 
      topUsers={topUsers}
      loggedInUser={loggedInUser}
      totalStudents={totalStudents}
    />
  );
}