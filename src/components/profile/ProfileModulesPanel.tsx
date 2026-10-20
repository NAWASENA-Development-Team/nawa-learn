// components/profile/ProfileModulesPanel.tsx
// ─── Tab "Modul Saya" ──────────────────────────────────────────────────────────
// Dulu satu blok 90-baris di tengah `ProfileClient` 1700-baris. Satu-satunya
// yang dibutuhkannya adalah daftar modul; tidak ada state, tidak ada handler,
// tidak ada efek. Memisahkannya bukan merapikan: sebuah panel yang bisa dibaca
// dari atas ke bawah tanpa melompat ke definisi state adalah panel yang bisa
// diubah tanpa takut menyentuh yang lain.
import Link from "next/link";
import { BookOpen, Clock, XCircle, CheckCircle2, Download, ArrowRight } from "lucide-react";
import type { UserModule } from "./types";

export function ProfileModulesPanel({ modules }: { modules: UserModule[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-150 dark:border-zinc-850">
        <div>
          <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-500" /> Modul Yang Kamu Unggah
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Daftar lengkap catatan pelajaran, rangkuman, dan modul yang telah kamu kontribusikan.
          </p>
        </div>
        <Link
          href="/submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
        >
          + Unggah Modul Baru
        </Link>
      </div>

      {modules.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
          <BookOpen className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mt-3">Belum ada modul yang diunggah</h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
            Bagikan modul pelajaranmu sekarang dan dapatkan Poin XP dari komunitas NAWA-LEARN.
          </p>
          <Link
            href="/submit"
            className="mt-4 inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs px-4.5 py-2.5 rounded-xl font-bold border border-indigo-100 dark:border-indigo-900 transition-all cursor-pointer"
          >
            Mulai Berbagi Sekarang <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {modules.map((mod) => (
            <div key={mod.id} className="group relative bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col h-full overflow-hidden">
              <div className="absolute -right-8 -top-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/15 transition-all" />

              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shadow-sm">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{mod.subject}</span>
                    <div className="flex gap-1.5 mt-0.5">
                      <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-bold text-zinc-600 dark:text-zinc-400">{mod.grade}</span>
                      <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold">{mod.category}</span>
                    </div>
                  </div>
                </div>
                <div>
                  {mod.status === "approved" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Disetujui
                    </span>
                  )}
                  {mod.status === "pending" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      <Clock className="h-3 w-3" /> Tinjauan
                    </span>
                  )}
                  {mod.status === "rejected" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                      <XCircle className="h-3 w-3" /> Ditolak
                    </span>
                  )}
                </div>
              </div>

              <h4 className="font-extrabold text-sm text-zinc-900 dark:zinc-100 mb-2 line-clamp-2 leading-snug relative z-10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {mod.title}
              </h4>

              <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 relative z-10">
                <span className="font-semibold">{new Date(mod.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <Download className="h-3.5 w-3.5 text-indigo-500" /> {mod.downloads} Unduhan
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
