// app/(dashboard)/modules/page.tsx
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bookmarks, modules, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import ModulesLibraryClient from "@/components/modules/ModulesLibraryClient";

export const dynamic = "force-dynamic";

export default async function ModulesPage() {
  // Query all approved modules with all details needed for the premium interactive library
  const fetchedModules = await db
    .select({
      id: modules.id,
      title: modules.title,
      subject: modules.subject,
      grade: modules.grade,
      category: modules.category,
      contentUrl: modules.contentUrl,
      downloads: modules.downloads,
      uploaderName: users.name,
      createdAt: modules.createdAt,
    })
    .from(modules)
    .leftJoin(users, eq(modules.uploaderId, users.id))
    .where(eq(modules.status, "approved"))
    .orderBy(desc(modules.createdAt));

  // Serialize Date objects to ISO strings for safe transmission to client component props
  const serializedModules = fetchedModules.map((mod) => ({
    ...mod,
    createdAt: mod.createdAt.toISOString(),
  }));

  // The reader's own bookmarks. This used to be one global `localStorage` key with
  // no user id in it, which meant a shared school computer showed one student
  // another student's saved modules. Reading it here keeps the first paint correct
  // instead of filling the stars in after hydration.
  const { userId: clerkId } = await auth();
  let bookmarkedIds: string[] = [];
  if (clerkId) {
    const rows = await db
      .select({ moduleId: bookmarks.moduleId })
      .from(bookmarks)
      .innerJoin(users, eq(bookmarks.userId, users.id))
      .where(eq(users.clerkId, clerkId));
    bookmarkedIds = rows.map((row) => row.moduleId);
  }

  return (
    <ModulesLibraryClient
      initialModules={serializedModules}
      initialBookmarkedIds={bookmarkedIds}
    />
  );
}