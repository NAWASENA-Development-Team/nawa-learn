// app/(dashboard)/profile/page.tsx
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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
    const isGoogleAuth = clerkUser.externalAccounts?.some(
      (acc) => acc.provider === "google" || acc.provider === "oauth_google",
    );
    const name = isGoogleAuth && (clerkUser.firstName || clerkUser.lastName)
      ? `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim()
      : clerkUser.username
        || `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim()
        || "Student";

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

  // 2b. Re-sync name from Clerk if it's still the generic "Student" placeholder.
  //     This silently fixes existing accounts created before the webhook was updated.
  if (dbUser!.name === 'Student') {
    const clerkUserFresh = await currentUser();
    if (clerkUserFresh) {
      const isGoogle = clerkUserFresh.externalAccounts?.some(
        (acc) => acc.provider === 'google' || acc.provider === 'oauth_google',
      );
      const freshName = (isGoogle && (clerkUserFresh.firstName || clerkUserFresh.lastName))
        ? `${clerkUserFresh.firstName || ''} ${clerkUserFresh.lastName || ''}`.trim()
        : clerkUserFresh.username
          || `${clerkUserFresh.firstName || ''} ${clerkUserFresh.lastName || ''}`.trim();
      if (freshName && freshName !== 'Student') {
        await db.update(users).set({ name: freshName }).where(eq(users.clerkId, clerkId));
        dbUser = { ...dbUser!, name: freshName };
      }
    }
  }

  // 3. Redirect to the user's specific profile page
  redirect(`/profile/${dbUser.id}`);
}
