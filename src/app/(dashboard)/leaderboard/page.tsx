// app/(dashboard)/leaderboard/page.tsx
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import LeaderboardClient from "@/components/leaderboard/LeaderboardClient";
import { IS_PARTICIPANT } from "@/lib/participants";
import { effectiveSeasonPoints, getSeasonLabel, isSeasonCurrent } from "@/lib/season";
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
      seasonResetAt: true,
      avatarIndex: true,
      photoUrl: true,
    },
  });
  if (!dbUser) return null;

  // Poin musim yang sah. `season_points` hanya direset saat pengguna menulis poin
  // berikutnya (reset malas), jadi akun dorman masih menyimpan angka musim lalu.
  // Tanpa koreksi ini, akun yang tidak pernah kembali tampil di papan peringkat
  // dengan poin lama — dan bisa memegang kursi moderator selama berbulan-bulan.
  const seasonPoints = isSeasonCurrent(dbUser.seasonResetAt) ? dbUser.seasonPoints : 0;

  // Peringkat = jumlah peserta dengan poin musim **efektif** lebih tinggi + 1.
  // Perbandingannya memakai ekspresi yang sama dengan daftar di bawah, bukan
  // kolom mentah, supaya "peringkat saya" tidak bisa berbeda dari baris saya.
  const [higher] = await db
    .select({ value: count() })
    .from(users)
    .where(and(IS_PARTICIPANT, sql`${effectiveSeasonPoints()} > ${seasonPoints}`));

  return {
    id: dbUser.id,
    name: dbUser.name,
    points: dbUser.points,
    seasonPoints,
    rank: (higher?.value ?? 0) + 1,
    avatarIndex: dbUser.avatarIndex ?? null,
    photoUrl: dbUser.photoUrl ?? null,
  };
}

export default async function LeaderboardPage() {
  const { userId: clerkId } = await auth();

  // 1. Seratus kontributor teratas, plus jumlah peserta.
  //
  // Poin yang diurutkan adalah poin musim **efektif** (`effectiveSeasonPoints()`),
  // bukan kolom mentah: baris yang terakhir menulis di musim lalu masih menyimpan
  // angka musim lalu sampai ia menulis poin lagi. Daftar dan peringkat pengguna
  // login wajib memakai ekspresi yang sama, kalau tidak keduanya bisa berbeda
  // pendapat tentang siapa yang berada di tiga teratas.
  //
  // `desc(users.id)` sebagai pemecah seri: `season_points` tidak unik, dan tanpa
  // kunci kedua urutan baris yang poinnya sama ditentukan Postgres — artinya
  // "peringkat 7" bisa berpindah orang di antara dua pemuatan halaman. Pemecah
  // seri yang sama dipakai `rankOf()` untuk menentukan pemegang kursi.
  const seasonPoints = effectiveSeasonPoints();

  const [topUsersData, totalStudentsResult] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        points: users.points,
        seasonPoints,
        avatarIndex: users.avatarIndex,
        photoUrl: users.photoUrl,
      })
      .from(users)
      .where(IS_PARTICIPANT)
      .orderBy(desc(seasonPoints), desc(users.id))
      .limit(LEADERBOARD_SIZE),
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
