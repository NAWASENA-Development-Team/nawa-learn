// app/(dashboard)/modules/page.tsx
import { db } from "@/db";
import { modules, users } from "@/db/schema";
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

  return <ModulesLibraryClient initialModules={serializedModules} />;
}