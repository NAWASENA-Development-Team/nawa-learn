// app/(dashboard)/leaderboard/page.tsx
import { db } from "@/db";
import { users } from "@/db/schema";
import { desc, count, eq, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import LeaderboardClient from "@/components/leaderboard/LeaderboardClient";

// Halaman ini dirender di server untuk memastikan data peringkat selalu up-to-date
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  // 1. Mengambil 50 kontributor teratas untuk pencarian interaktif di client
  const topUsers = await db.query.users.findMany({
    orderBy: [desc(users.points)],
    limit: 50,
    columns: {
      id: true,
      name: true,
      points: true,
      avatarIndex: true,
      photoUrl: true,
    }
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