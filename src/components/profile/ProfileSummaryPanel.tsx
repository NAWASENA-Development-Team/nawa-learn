// components/profile/ProfileSummaryPanel.tsx
// ─── Tab "Ringkasan": lencana + ajakan kontribusi + sidebar statistik ──────────
//
// Lencana di sini murni presentasional — `badgeDisplays` sudah dievaluasi di
// server (M14e) dan angka spesialis sudah dihitung SQL (`getSpecialtyStats`).
// Tidak ada perhitungan apa pun di komponen ini.
import Link from "next/link";
import { ArrowRight, BarChart2, Folder, Download, HelpCircle, GraduationCap } from "lucide-react";
import { ProfileBadges } from "./ProfileBadges";
import type { BadgeDisplay, SpecialtyStats } from "@/lib/badges";
import type { UserModule, UserQuestion } from "./types";

interface ProfileSummaryPanelProps {
  badgeDisplays: BadgeDisplay[];
  specialtyStats: SpecialtyStats;
  userModules: UserModule[];
  userQuestions: UserQuestion[];
}

export function ProfileSummaryPanel({
  badgeDisplays, specialtyStats, userModules, userQuestions,
}: ProfileSummaryPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

      {/* Achievements List */}
      <div className="lg:col-span-2 space-y-6">
        <ProfileBadges badgeDisplays={badgeDisplays} />

        {/* Learning resources reminder */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-zinc-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden border border-indigo-500/20 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="text-center sm:text-left relative z-10">
            <h4 className="text-xl sm:text-2xl font-black">Ingin menaikkan level &amp; poinmu?</h4>
            <p className="text-xs text-zinc-300 mt-1 max-w-sm sm:max-w-md leading-relaxed">
              Unggah rangkuman rumus kreatif, catatan pelajaran estetik, atau latihan soal menarik. Dapatkan poin setiap modul/soal disetujui!
            </p>
          </div>
          <Link
            href="/submit"
            className="shrink-0 bg-nawa-primary hover:bg-nawa-primary-hover text-white font-bold text-xs px-5 py-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 border border-indigo-500 cursor-pointer"
          >
            Unggah Catatan <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Right sidebar: Contribution details */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <h3 className="text-base font-extrabold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart2 className="h-4.5 w-4.5 text-indigo-500" /> Statistik Singkat
          </h3>

          <div className="space-y-3">
            <div className="group flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 shadow-sm hover:shadow-md cursor-default">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/40 text-nawa-primary dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Folder className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-zinc-800 dark:text-zinc-200 group-hover:text-nawa-primary dark:group-hover:text-indigo-400 transition-colors">Total Modul Pending</h4>
                  <p className="text-[10px] text-zinc-500">Dalam tinjauan OSIS</p>
                </div>
              </div>
              <span className="font-black text-sm text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                {userModules.filter((m) => m.status === "pending").length} <span className="text-[10px] text-zinc-400 font-semibold uppercase">Berkas</span>
              </span>
            </div>

            <div className="group flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-emerald-400 dark:hover:border-nawa-success transition-all duration-300 shadow-sm hover:shadow-md cursor-default">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Total Unduhan Karya</h4>
                  <p className="text-[10px] text-zinc-500">Diunduh siswa lain</p>
                </div>
              </div>
              <span className="font-black text-sm text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                {specialtyStats.totalDownloads} <span className="text-[10px] text-zinc-400 font-semibold uppercase">Kali</span>
              </span>
            </div>

            <div className="group flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-amber-400 dark:hover:border-nawa-warning transition-all duration-300 shadow-sm hover:shadow-md cursor-default">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-zinc-800 dark:text-zinc-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Soal Latihan Pending</h4>
                  <p className="text-[10px] text-zinc-500">Verifikasi kesulitan</p>
                </div>
              </div>
              <span className="font-black text-sm text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                {userQuestions.filter((q) => q.status === "pending").length} <span className="text-[10px] text-zinc-400 font-semibold uppercase">Soal</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick info card about Nawasena */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm text-center relative overflow-hidden">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-nawa-primary dark:text-indigo-400 mb-3 border border-indigo-100 dark:border-indigo-900/30">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white">OSIS NAWASENA SMAN 2 Jonggol</h4>
          <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
            Platform NAWA-LEARN digagas oleh Divisi ICT OSIS Nawasena SMAN 2 Jonggol untuk mempermudah kolaborasi belajar antar siswa. Terima kasih telah menjadi kontributor aktif!
          </p>
          <div className="border-t border-zinc-100 dark:border-zinc-800 mt-4 pt-4 text-xs font-semibold text-nawa-primary dark:text-indigo-400">
            Kabinet Nawasena • Divisi ICT SMAN 2 Jonggol
          </div>
        </div>
      </div>

    </div>
  );
}
