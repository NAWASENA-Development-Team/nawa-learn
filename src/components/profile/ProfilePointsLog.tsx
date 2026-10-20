// components/profile/ProfilePointsLog.tsx
// ─── Tab "Riwayat Poin" ────────────────────────────────────────────────────────
// Garis waktu poin. Pemetaan `action` → ikon/teks adalah urusan tampilan, jadi
// ia tinggal di sini, bukan di komponen induk — komponen induk tidak perlu
// tahu bahwa "quiz_completed_sulit" harus menjadi Target biru.
import { BookOpen, Clock, Edit3, XCircle, Share2, Calendar, Star, Target } from "lucide-react";
import type { PointLog } from "./types";

export function ProfilePointsLog({ logs }: { logs: PointLog[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-8 pb-4 border-b border-zinc-150 dark:border-zinc-850 flex items-center justify-between relative z-10">
        <div>
          <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
            <span className="p-1.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </span>
            Jejak Petualanganmu
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            Riwayat lengkap bagaimana kamu mengumpulkan V-Point di NAWA-LEARN.
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-950/50">
          <span className="text-5xl block animate-bounce">⏱️</span>
          <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mt-4">Belum ada riwayat perolehan poin</h4>
          <p className="text-xs text-zinc-500 mt-2 max-w-xs mx-auto">
            Unggah modul belajar perdana untuk mengklaim poin pertamamu senilai 50 poin!
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-amber-500/20 dark:border-amber-500/20 pl-6 sm:pl-8 space-y-6 sm:space-y-8 max-w-3xl text-left ml-4 sm:ml-6">
          {logs.map((log) => {
            // Determine format
            let actionText = log.action.replace(/_/g, " ");
            let ActionIcon = Target;
            let iconColor = "text-zinc-500 dark:text-zinc-400";
            let iconBg = "bg-zinc-100 dark:bg-zinc-800";

            if (log.action.includes("quiz_completed")) {
              const diff = log.action.split("_").pop() || "";
              actionText = `Menyelesaikan Kuis CBT ${diff ? `(${diff.charAt(0).toUpperCase() + diff.slice(1)})` : ""}`;
              ActionIcon = Target;
              iconColor = "text-blue-500 dark:text-blue-400";
              iconBg = "bg-blue-100 dark:bg-blue-900/30 border-blue-500/20";
            } else if (log.action === "module_approved") {
              actionText = "Modul Berhasil Disetujui";
              ActionIcon = BookOpen;
              iconColor = "text-emerald-500 dark:text-emerald-400";
              iconBg = "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500/20";
            } else if (log.action === "question_approved") {
              actionText = "Soal CBT Berhasil Disetujui";
              ActionIcon = Edit3;
              iconColor = "text-purple-500 dark:text-purple-400";
              iconBg = "bg-purple-100 dark:bg-purple-900/30 border-purple-500/20";
            } else if (log.action.includes("rejected")) {
              actionText = log.action.includes("module") ? "Modul Ditolak" : "Soal Ditolak";
              ActionIcon = XCircle;
              iconColor = "text-rose-500 dark:text-rose-400";
              iconBg = "bg-rose-100 dark:bg-rose-900/30 border-rose-500/20";
            } else if (log.action === "module_downloaded") {
              actionText = "Seseorang Mengunduh Modulmu";
              ActionIcon = Share2;
              iconColor = "text-sky-500 dark:text-sky-400";
              iconBg = "bg-sky-100 dark:bg-sky-900/30 border-sky-500/20";
            } else if (log.action === "daily_login") {
              actionText = "Login Harian";
              ActionIcon = Calendar;
              iconColor = "text-amber-500 dark:text-amber-400";
              iconBg = "bg-amber-100 dark:bg-amber-900/30 border-amber-500/20";
            }

            const isPositive = log.delta > 0;
            const pointColor = isPositive ? "text-amber-500 dark:text-amber-400" : "text-rose-500 dark:text-rose-400";
            const pointBg = isPositive ? "bg-amber-100/50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/50" : "bg-rose-100/50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/50";

            return (
              <div key={log.id} className="relative group">
                {/* Timeline bullet */}
                <span className={`absolute -left-[33px] sm:-left-[41px] top-4 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-900
                  ${isPositive ? "bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm shadow-amber-500/50" : "bg-gradient-to-br from-rose-400 to-rose-600 shadow-sm shadow-rose-500/50"}
                  transition-transform duration-300 group-hover:scale-125`}
                />

                <div className="bg-zinc-50/80 hover:bg-white dark:bg-zinc-950/50 dark:hover:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-amber-300/50 dark:hover:border-amber-700/50 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 shadow-sm hover:shadow-md">

                  <div className="flex items-center gap-4">
                    <div className={`shrink-0 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-[14px] border ${iconBg} ${iconColor} shadow-inner`}>
                      <ActionIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-white capitalize">
                        {actionText}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold tracking-wide uppercase">
                          {new Date(log.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`shrink-0 self-start sm:self-auto px-4 py-2 rounded-xl border ${pointBg} flex items-center gap-1.5`}>
                    <Star className={`w-3.5 h-3.5 ${pointColor} ${isPositive ? "fill-amber-500/50" : "fill-rose-500/50"}`} />
                    <span className={`font-black text-sm sm:text-base ${pointColor}`}>
                      {isPositive ? `+${log.delta}` : log.delta} Poin
                    </span>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
