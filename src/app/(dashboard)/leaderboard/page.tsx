// app/(dashboard)/leaderboard/page.tsx
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, count, desc, eq, gt } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import LeaderboardClient from "@/components/leaderboard/LeaderboardClient";
import { IS_PARTICIPANT } from "@/lib/participants";
import { getSeasonLabel } from "@/lib/season";
import { emptySpecialtyStats, getSpecialtyStats } from "@/lib/specialtyStats";

// Halaman ini dirender di server untuk memastikan data peringkat selalu up-to-date
export const dynamic = "force-dynamic";

/** Papan peringkat menampilkan 100 teratas; pencarian di client bekerja pada set itu. */
const LEADERBOARD_SIZE = 100;

async function loadLoggedInUser(clerkId: string | null) {
  if (!clerkId) return null;

  const dbUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    columns: {
      id: true,
      name: true,
      points: true,
      seasonPoints: true,
      avatarIndex: true,
      photoUrl: true,
    },
  });
  if (!dbUser) return null;

  // Peringkat = jumlah peserta dengan poin musim lebih tinggi + 1.
  const [higher] = await db
    .select({ value: count() })
    .from(users)
    .where(and(IS_PARTICIPANT, gt(users.seasonPoints, dbUser.seasonPoints)));

  return {
    id: dbUser.id,
    name: dbUser.name,
    points: dbUser.points,
    seasonPoints: dbUser.seasonPoints,
    rank: (higher?.value ?? 0) + 1,
    avatarIndex: dbUser.avatarIndex ?? null,
    photoUrl: dbUser.photoUrl ?? null,
  };
}

export default async function LeaderboardPage() {
  const { userId: clerkId } = await auth();

  // 1. Seratus kontributor teratas, plus jumlah peserta.
  //
  // `desc(users.id)` sebagai pemecah seri: `season_points` tidak unik, dan tanpa
  // kunci kedua urutan baris yang poinnya sama ditentukan Postgres — artinya
  // "peringkat 7" bisa berpindah orang di antara dua pemuatan halaman.
  const [topUsersData, totalStudentsResult] = await Promise.all([
    db.query.users.findMany({
      where: IS_PARTICIPANT,
      orderBy: [desc(users.seasonPoints), desc(users.id)],
      limit: LEADERBOARD_SIZE,
      columns: {
        id: true,
        name: true,
        points: true,
        seasonPoints: true,
        avatarIndex: true,
        photoUrl: true,
      },
    }),
    db.select({ value: count() }).from(users).where(IS_PARTICIPANT),
  ]);

  const topUserIds = topUsersData.map((u) => u.id);

  // 2. Enam angka lencana per pengguna, dihitung SQL (tiga query agregat).
  //
  // Sebelum M13 di sini ada tiga `findMany` tanpa daftar kolom yang memuat
  // **seluruh** modul, soal (termasuk `answer_key`), dan baris poin milik 100
  // pengguna ke memori Node, lalu menyaringnya di JavaScript.
  const [stats, loggedInUser] = await Promise.all([
    getSpecialtyStats(db, topUserIds),
    loadLoggedInUser(clerkId),
  ]);

  const topUsers = topUsersData.map((user) => ({
    ...user,
    stats: stats.get(user.id) ?? emptySpecialtyStats(),
  }));

  const totalStudents = totalStudentsResult[0]?.value || 1;
  const seasonLabel = getSeasonLabel();

  return (
    <LeaderboardClient
      topUsers={topUsers}
      loggedInUser={loggedInUser}
      totalStudents={totalStudents}
      seasonLabel={seasonLabel}
    />
  );
}
