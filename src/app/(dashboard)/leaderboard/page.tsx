// app/(dashboard)/leaderboard/page.tsx
import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";

// Halaman ini dirender di server untuk memastikan data peringkat selalu up-to-date
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  // Mengambil 10 siswa teratas berdasarkan poin kontribusi
  const topUsers = await db.query.users.findMany({
    orderBy: [desc(users.points)],
    limit: 10,
    columns: {
      id: true,
      name: true,
      points: true,
    }
  });

  return (
    <div className="max-w-3xl mx-auto p-6 mt-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3">Papan Peringkat NAWASENA</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Apresiasi untuk kontributor modul dan latihan soal paling aktif di SMAN 2 Jonggol.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {topUsers.map((user, index) => (
            <div 
              key={user.id} 
              className="flex items-center justify-between p-5 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Visualisasi Medali untuk Top 3 */}
                <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg
                  ${index === 0 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500" : 
                    index === 1 ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400" : 
                    index === 2 ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-500" : 
                    "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-600"}`}
                >
                  {index + 1}
                </div>
                
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{user.name}</h3>
                  {index < 3 && (
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Top Contributor
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-500">
                  {user.points}
                </div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Poin
                </div>
              </div>
            </div>
          ))}

          {topUsers.length === 0 && (
            <div className="p-8 text-center text-zinc-500">
              Belum ada data kontributor. Jadilah yang pertama membagikan modul!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}