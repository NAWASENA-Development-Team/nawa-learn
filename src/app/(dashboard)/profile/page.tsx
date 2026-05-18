// app/(dashboard)/profile/page.tsx
import { db } from "@/db";
import { users, modules, questions, pointsLog } from "@/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ProfileClient from "@/components/profile/ProfileClient";

export const dynamic = "force-dynamic";

export default async function OwnProfilePage() {
  // 1. Get Clerk Authentication details
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  // 2. Retrieve the user profile from database
  let dbUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  // Self-healing check: if user is logged in via Clerk but not yet synced in DB
  if (!dbUser) {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      redirect("/sign-in");
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "Student";

    try {
      const [insertedUser] = await db.insert(users).values({
        clerkId: clerkId,
        email: email,
        name: name,
        role: "student",
        points: 0,
      }).returning();
      
      dbUser = insertedUser;
    } catch (err) {
      console.error("Self-healing manual sync failed:", err);
      // Fallback redirect or error if Neon DB is temporarily down
      return (
        <div className="max-w-md mx-auto p-8 mt-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl text-center">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-xl font-bold mt-4 text-zinc-900 dark:text-white">Sinkronisasi Gagal</h2>
          <p className="text-sm text-zinc-500 mt-2">
            Profil Anda belum terhubung dengan database sekolah. Silakan muat ulang halaman ini atau hubungi ICT Division.
          </p>
        </div>
      );
    }
  }

  // 3. Retrieve rank statistics
  // Calculate user rank by checking how many users have more points
  const [higherPointsResult] = await db
    .select({ value: count() })
    .from(users)
    .where(sql`${users.points} > ${dbUser.points}`);

  const rank = (higherPointsResult?.value || 0) + 1;

  // Get total students
  const [totalStudentsResult] = await db
    .select({ value: count() })
    .from(users);
  
  const totalStudents = totalStudentsResult?.value || 1;

  // 4. Retrieve user's contributed modules
  const fetchedModules = await db
    .select()
    .from(modules)
    .where(eq(modules.uploaderId, dbUser.id))
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

  // 5. Retrieve user's contributed questions
  const fetchedQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.uploaderId, dbUser.id))
    .orderBy(desc(questions.createdAt));

  const serializedQuestions = fetchedQuestions.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    difficulty: q.difficulty,
    status: q.status,
    createdAt: q.createdAt.toISOString(),
  }));

  // 6. Retrieve user's point logs
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
    email: dbUser.email,
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
      isOwnProfile={true}
    />
  );
}
