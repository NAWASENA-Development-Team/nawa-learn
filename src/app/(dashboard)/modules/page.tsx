// app/(dashboard)/modules/page.tsx
import { db } from "@/db";
import { modules, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";

// Server Component fetching approved modules
export default async function ModulesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: selectedCategory } = await searchParams;

  // Build the query dynamically based on filters
  let query = db.select({
      id: modules.id,
      title: modules.title,
      subject: modules.subject,
      category: modules.category,
      downloads: modules.downloads,
      uploaderName: users.name
    })
    .from(modules)
    .leftJoin(users, eq(modules.uploaderId, users.id))
    .where(eq(modules.status, "approved"));

  // Apply category filter if it exists
  // Note: In a real app, use drizzle's 'and' operator for complex queries
  const fetchedModules = await query.orderBy(desc(modules.createdAt)).execute();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Module Library</h2>
          <p className="text-zinc-500 mt-2">Browse community-reviewed study materials.</p>
        </div>
        <Link 
          href="/submit" 
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm font-medium"
        >
          Upload Module
        </Link>
      </div>

      {fetchedModules.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <span className="text-4xl">📚</span>
          <h3 className="mt-4 text-lg font-bold text-zinc-900 dark:text-white">Belum ada modul terverifikasi</h3>
          <p className="mt-2 text-sm text-zinc-500 max-w-sm mx-auto">
            Jadilah kontributor pertama dengan mengupload materi atau catatan belajar terbaikmu!
          </p>
          <Link
            href="/submit"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            Upload Modul Sekarang
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fetchedModules.map((mod: typeof fetchedModules[number]) => (
            <div key={mod.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm bg-white dark:bg-zinc-900">
              <div className="flex justify-between items-start mb-4">
                <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-400/10 px-2 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 ring-1 ring-inset ring-indigo-700/10">
                  {mod.category}
                </span>
                <span className="text-xs text-zinc-500">{mod.downloads} dls</span>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{mod.title}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{mod.subject}</p>
              <div className="text-xs text-zinc-500 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                Uploaded by {mod.uploaderName || "Anonim"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}