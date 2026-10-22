// app/(dashboard)/profile/[id]/page.tsx
import { db } from "@/db";
import { users, modules, questions, pointsLog } from "@/db/schema";
import { eq, desc, count, sql, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import ProfileClient from "@/components/profile/ProfileClient";
import { isUuid } from "@/lib/ids";
import { logger } from "@/lib/logger";
import { IS_PARTICIPANT } from "@/lib/participants";
import { getCurrentUser, getSessionUserId } from "@/lib/currentUser";
import { canReview, isHumanStaff } from "@/lib/authz";
import { emptySpecialtyStats, getSpecialtyStats, getSubjectBreakdown } from "@/lib/specialtyStats";
import {
  buildBadgeUnlockData,
  evaluateBadges,
  toBadgeDisplays,
} from "@/lib/badges/evaluate";

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
        seasonRoleKey: true,
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

  // 4. Siapa yang melihat.
  //
  // Dua hal diputuskan di sini, dan keduanya tentang **penonton**, bukan pemilik
  // profil: apakah ini profil sendiri, dan apakah penontonnya moderator. Yang
  // kedua baru benar sejak M14e — versi lama memakai `user.role` (peran pemilik
  // profil) untuk memutuskan apakah lencana rahasia boleh diperlihatkan, sehingga
  // seorang siswa yang membuka profil seorang moderator melihat kedelapan syarat
  // rahasia itu.
  //
  // `getSessionUserId()`/`getCurrentUser()` adalah `cache()` React, dan root
  // layout sudah memanggil `getCurrentUser()` untuk Navbar, jadi keduanya tidak
  // menambah query dalam request ini.
  const [clerkId, viewer] = await Promise.all([
    getSessionUserId(),
    getCurrentUser(),
  ]);
  const isOwnProfile = clerkId ? dbUser.clerkId === clerkId : false;
  // `canReview`, bukan `hasReviewerRole`: peran `moderator` dari kursi musim lalu
  // masih terbaca di kolom `role` sampai cron mencabutnya, dan syarat lencana
  // rahasia bukan untuk pemegang amanah yang sudah berakhir.
  const viewerIsModerator = viewer ? canReview(viewer) : false;

  // 4b. Profil staf manusia bukan permukaan siswa (M17).
  //
  // Moderator yang diangkat lewat `db:promote` tidak ada di papan peringkat dan
  // tautan ke profilnya tidak pernah dirender. Membiarkan `/profile/<id>` tetap
  // terbuka akan membuat penyembunyian itu kosmetik: id-nya masih bisa ditemukan
  // dari tautan lama atau percobaan langsung, dan yang terbuka adalah nama, bio,
  // serta motto seorang guru.
  //
  // Yang tetap boleh membukanya: pemiliknya sendiri dan peninjau (staf manusia
  // maupun kursi aktif) — supaya baris "Tim Moderator" di panel bisa diklik.
  // `notFound()`, bukan 403: jawaban yang membedakan "ada tetapi terlarang" dari
  // "tidak ada" sudah cukup untuk memetakan siapa saja staf platform ini.
  if (isHumanStaff(dbUser) && !isOwnProfile && !viewerIsModerator) notFound();

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
    specialtyStatsById,
    subjectBreakdownById
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
    // Peta "jumlah modul disetujui per mata pelajaran", juga SQL. Lencana yang
    // menyebut Matematika/sains/bahasa/sejarah membacanya; sebelum M14e peta ini
    // dibangun di browser dari daftar modul halaman ini.
    getSubjectBreakdown(db, [dbUser.id]),
  ]);

  // Staf manusia tidak punya peringkat: ia tidak ikut dihitung di papan, jadi
  // "jumlah peserta dengan poin lebih tinggi + 1" tidak berarti apa pun untuknya
  // (bisa menghasilkan "#7 dari 6"). `null` yang menyeberang ke UI.
  //
  // Evaluasi lencana tetap butuh angka, dan yang dipakai adalah
  // `Number.MAX_SAFE_INTEGER` — nilai yang sama dengan `rankOf()` untuk orang di
  // luar papan. **Jangan** memakai nol: kelima lencana peringkat berbentuk
  // `rank <= 50`, sehingga nol justru membuka semuanya.
  const staffProfile = isHumanStaff(dbUser);
  const rank = staffProfile ? null : (higherPointsResult[0]?.value || 0) + 1;
  const totalStudents = totalStudentsResult[0]?.value || 1;
  const specialtyStats = specialtyStatsById.get(dbUser.id) ?? emptySpecialtyStats();

  // Lencana dievaluasi di server, sekali.
  //
  // Yang menyeberang ke komponen klien hanya `BadgeDisplay[]` — judul, ikon dan
  // status terbuka. `unlockCondition` tidak pernah ikut: versi lama mengirim
  // seluruh katalog ke browser, jadi delapan syarat rahasia bisa dibaca dengan
  // `unlockCondition.toString()` dari DevTools.
  const unlockedBadgeIds = evaluateBadges(
    buildBadgeUnlockData({
      points: dbUser.points,
      rank: rank ?? Number.MAX_SAFE_INTEGER,
      specialty: specialtyStats,
      modulesBySubject: subjectBreakdownById.get(dbUser.id) ?? {},
      createdAt: dbUser.createdAt,
    }),
  );

  const badgeDisplays = toBadgeDisplays({
    unlockedIds: unlockedBadgeIds,
    isModerator: viewerIsModerator,
  });

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
      specialtyStats={specialtyStats}
      badgeDisplays={badgeDisplays}
      isOwnProfile={isOwnProfile}
    />
  );
}
