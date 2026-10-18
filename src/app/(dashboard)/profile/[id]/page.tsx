// app/(dashboard)/profile/[id]/page.tsx
import { db } from "@/db";
import { users, modules, questions, pointsLog } from "@/db/schema";
import { eq, desc, count, sql, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import ProfileClient from "@/components/profile/ProfileClient";
import { isUuid } from "@/lib/ids";
import { logger } from "@/lib/logger";
import { IS_PARTICIPANT } from "@/lib/participants";
import { emptySpecialtyStats, getSpecialtyStats } from "@/lib/specialtyStats";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicProfilePage({ params }: PageProps) {
  // Await params for safe Next.js 16 compatibility
  const { id: profileUserId } = await params;

  // 1. Bentuk id diperiksa **sebelum** menyentuh database.
  //
  // `users.id` bertipe `uuid`, jadi Postgres menolak `WHERE id = 'halo'` dengan
  // galat `22P02`. Sebelum M14c galat itu ditangkap bersama galat database
  // sungguhan, dan keduanya dirender sebagai "Siswa Tidak Ditemukan" — artinya
  // database yang sedang mati terlihat persis seperti siswa yang tidak ada, dan
  // satu-satunya tempat kedua kasus itu bisa dibedakan adalah baris log. Dengan
  // pemeriksaan bentuk di sini, URL ngawur berhenti sebagai 404 dan gangguan
  // database naik ke `src/app/error.tsx` sebagai galat yang jujur.
  if (!isUuid(profileUserId)) notFound();

  // 2. Fetch user by Neon Database UUID.
  //
  // Kolomnya disebut satu per satu (M12). Tanpa daftar kolom, `findFirst` membawa
  // **setiap** kolom `users` ke halaman yang bisa dibuka siapa saja yang punya
  // tautannya — termasuk `email` dan dua kolom persetujuan UU PDP. Yang dipakai
  // halaman ini hanya identitas tampilan dan angka; sisanya hanya menambah
  // permukaan PII. `clerkId` tetap diambil karena halaman ini membandingkannya
  // dengan sesi untuk menentukan "ini profil saya", tetapi ia **tidak** ikut
  // diserialkan ke klien.
  let dbUser;
  try {
    dbUser = await db.query.users.findFirst({
      where: eq(users.id, profileUserId),
      columns: {
        id: true,
        clerkId: true,
        name: true,
        role: true,
        points: true,
        createdAt: true,
        avatarIndex: true,
        photoUrl: true,
        bio: true,
        motto: true,
        levelFrame: true,
      },
    });
  } catch (err) {
    // Gangguan database. Dicatat (dengan `requestId` dari `requestLogger`) lalu
    // **dilempar ulang** supaya `src/app/error.tsx` yang menampilkannya. Menelan
    // galat di sini akan mengubah gangguan sesaat menjadi halaman "tidak
    // ditemukan" yang menyesatkan. User id sengaja tidak dicatat: itu
    // pengenal subjek data, dan `logger` hanya menyensor nama kunci yang dikenal.
    logger.error("profile_fetch_failed", err);
    throw err;
  }

  // 3. Id sah tetapi barisnya tidak ada → 404 yang sama dengan URL ngawur.
  if (!dbUser) notFound();

  // 4. Determine if this profile belongs to the currently authenticated user
  const { userId: clerkId } = await auth();
  const isOwnProfile = clerkId ? dbUser.clerkId === clerkId : false;

  // 5. Retrieve rank statistics & data concurrently for optimization
  const modulesCondition = isOwnProfile 
    ? eq(modules.uploaderId, dbUser.id)
    : sql`${modules.uploaderId} = ${dbUser.id} AND ${modules.status} = 'approved'`;

  const questionsCondition = isOwnProfile
    ? eq(questions.uploaderId, dbUser.id)
    : sql`${questions.uploaderId} = ${dbUser.id} AND ${questions.status} = 'approved'`;

  const [
    higherPointsResult,
    totalStudentsResult,
    fetchedModules,
    fetchedQuestions,
    fetchedPointLogs,
    specialtyStatsById
  ] = await Promise.all([
    // Peringkat dan "total siswa" memakai definisi peserta yang **sama** dengan
    // papan peringkat (`IS_PARTICIPANT`). Akun yang sudah dianonimkan tetap berupa
    // baris `users` demi integritas foreign key, tetapi bukan siswa lagi; tanpa
    // filter ini, profil menampilkan "1 dari 7" sementara papan peringkat
    // menampilkan "1 dari 6".
    db
      .select({ value: count() })
      .from(users)
      .where(and(IS_PARTICIPANT, sql`${users.points} > ${dbUser.points}`)),
    db.select({ value: count() }).from(users).where(IS_PARTICIPANT),
    // Daftar kolom eksplisit, bukan `select()`. Dua alasan, dan yang kedua
    // serius: `questions` punya kolom `answer_key` dan `options`. Sebuah
    // `select()` liar menarik kunci jawaban ke dalam halaman profil publik —
    // tidak dirender hari ini, tetapi satu refactor dari bocor, dan invarian M3
    // ("kunci jawaban tidak pernah sampai ke browser") menjadi janji tanpa
    // penjaga. Dengan daftar kolom, kunci itu tidak pernah dibaca sama sekali.
    db
      .select({
        id: modules.id,
        title: modules.title,
        subject: modules.subject,
        grade: modules.grade,
        category: modules.category,
        downloads: modules.downloads,
        status: modules.status,
        createdAt: modules.createdAt,
      })
      .from(modules)
      .where(modulesCondition)
      .orderBy(desc(modules.createdAt)),
    db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        difficulty: questions.difficulty,
        status: questions.status,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .where(questionsCondition)
      .orderBy(desc(questions.createdAt)),
    db
      .select({
        id: pointsLog.id,
        action: pointsLog.action,
        delta: pointsLog.delta,
        createdAt: pointsLog.createdAt,
      })
      .from(pointsLog)
      .where(eq(pointsLog.userId, dbUser.id))
      .orderBy(desc(pointsLog.createdAt))
      .limit(20),
    // Enam angka lencana, dihitung SQL. Sebelumnya `ProfileClient` menurunkannya
    // dari 20 baris log di atas — jendela yang terlalu pendek untuk sebuah
    // pencapaian seumur akun, dan disaring dengan nama aksi yang tidak pernah
    // ditulis (`quiz_completed*`), sehingga selalu nol.
    getSpecialtyStats(db, [dbUser.id]),
  ]);

  const rank = (higherPointsResult[0]?.value || 0) + 1;
  const totalStudents = totalStudentsResult[0]?.value || 1;

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

  const serializedQuestions = fetchedQuestions.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    difficulty: q.difficulty,
    status: q.status,
    createdAt: q.createdAt.toISOString(),
  }));

  const serializedPointLogs = fetchedPointLogs.map((log) => ({
    id: log.id,
    action: log.action,
    delta: log.delta,
    createdAt: log.createdAt.toISOString(),
  }));

  // Prepare profile payload
  //
  // Tidak ada `email` dan tidak ada `clerkId`. Surel orang lain memang sudah
  // dikosongkan di sini, tetapi nilainya tetap **diambil** dari database dan
  // tetap melewati batas server/klien sampai baris di bawah ini — satu `?` yang
  // salah dan alamat surel seorang siswa ada di payload RSC. Yang tidak dibaca
  // tidak bisa bocor, jadi kolomnya tidak dibaca sama sekali.
  //
  // `clerkId` malah lebih buruk: ia dipakai apa adanya oleh halaman ini untuk
  // mencetak empat huruf terakhir pada sertifikat kontributor — sebuah fragmen
  // identitas Clerk yang tampil di halaman publik. Sekarang fragmen itu diambil
  // dari `id` internal, yang sudah menjadi bagian dari URL profil.
  const profilePayload = {
    id: dbUser.id,
    name: dbUser.name,
    role: dbUser.role as "guest" | "student" | "contributor" | "moderator" | "admin",
    points: dbUser.points,
    createdAt: dbUser.createdAt.toISOString(),
    rank,
    totalStudents,
    avatarIndex: dbUser.avatarIndex ?? null,
    photoUrl: dbUser.photoUrl ?? null,
    bio: dbUser.bio ?? null,
    motto: dbUser.motto ?? null,
    levelFrame: dbUser.levelFrame ?? null,
  };

  return (
    <ProfileClient 
      user={profilePayload}
      userModules={serializedModules}
      userQuestions={serializedQuestions}
      pointLogs={serializedPointLogs}
      specialtyStats={specialtyStatsById.get(dbUser.id) ?? emptySpecialtyStats()}
      isOwnProfile={isOwnProfile}
    />
  );
}
