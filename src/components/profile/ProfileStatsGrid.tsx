// components/profile/ProfileStatsGrid.tsx
// ─── Empat kartu statistik di bawah banner ────────────────────────────────────
//
// Catatan tentang angka: `userModules.length` dan `userQuestions.length`
// adalah jumlah baris yang dimuat halaman (semua status). Jumlah **unduhan**
// tidak muncul di sini — kartu unduhan ada di panel ringkasan dan angkanya
// berasal dari agregasi SQL (`specialtyStats.totalDownloads`), bukan dari
// `reduce` di atas daftar baris yang kebetulan dimuat.
import { Trophy, TrendingUp, BookOpen, HelpCircle } from "lucide-react";
import type { UserProfile, UserModule, UserQuestion } from "./types";

interface ProfileStatsGridProps {
  user: UserProfile;
  userModules: UserModule[];
  userQuestions: UserQuestion[];
}

export function ProfileStatsGrid({ user, userModules, userQuestions }: ProfileStatsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">

      {/* Total Points Card (Gold) */}
      <div className="group relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 p-5 sm:p-6 border border-amber-200/60 dark:border-amber-900/30 rounded-3xl shadow-sm hover:shadow-md hover:border-amber-400 dark:hover:border-amber-700/80 transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner font-bold">
            <Trophy className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-zinc-550 dark:text-zinc-450 uppercase tracking-wider">V-Point</span>
        </div>
        <p className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform duration-200">
          {user.points}
        </p>
        <div className="mt-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500 font-medium">
          Meningkat lewat unggah modul &amp; latihan.
        </div>
      </div>

      {/* Leaderboard Rank Card (Indigo/Blue) */}
      <div className="group relative overflow-hidden bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/10 p-5 sm:p-6 border border-indigo-200/60 dark:border-indigo-900/30 rounded-3xl shadow-sm hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-700/80 transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner font-bold">
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-zinc-550 dark:text-zinc-450 uppercase tracking-wider">Peringkat Sekolah</span>
        </div>
        <p className="text-3xl sm:text-4xl font-black text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform duration-200">
          {user.points > 0 ? `#${user.rank}` : "—"}
        </p>
        <div className="mt-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500 font-medium">
          {user.points > 0
            ? `Peringkat #${user.rank} dari ${user.totalStudents} siswa.`
            : "Unggah modul untuk masuk papan peringkat!"
          }
        </div>
      </div>

      {/* Total Modules Uploaded (Purple) */}
      <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/20 dark:to-fuchsia-950/10 p-5 sm:p-6 border border-purple-200/60 dark:border-purple-900/30 rounded-3xl shadow-sm hover:shadow-md hover:border-purple-400 dark:hover:border-purple-700/80 transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-inner font-bold">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-zinc-550 dark:text-zinc-450 uppercase tracking-wider">Modul Dibagikan</span>
        </div>
        <p className="text-3xl sm:text-4xl font-black text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform duration-200">
          {userModules.length}
        </p>
        <div className="mt-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500 font-medium">
          {userModules.filter((m) => m.status === "approved").length} disetujui • {userModules.filter((m) => m.status === "pending").length} verifikasi
        </div>
      </div>

      {/* Practice Questions created (Emerald) */}
      <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/10 p-5 sm:p-6 border border-emerald-200/60 dark:border-emerald-900/30 rounded-3xl shadow-sm hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-700/80 transition-all duration-300">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner font-bold">
            <HelpCircle className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-zinc-550 dark:text-zinc-450 uppercase tracking-wider">Soal Latihan</span>
        </div>
        <p className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform duration-200">
          {userQuestions.length}
        </p>
        <div className="mt-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-500 font-medium">
          {userQuestions.filter((q) => q.status === "approved").length} disetujui • {userQuestions.filter((q) => q.status === "pending").length} verifikasi
        </div>
      </div>

    </div>
  );
}
