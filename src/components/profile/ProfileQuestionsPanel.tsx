// components/profile/ProfileQuestionsPanel.tsx
// ─── Tab "Soal Saya" ───────────────────────────────────────────────────────────
// Satu-satunya yang dibutuhkan adalah daftar soal. Tidak ada state, tidak ada
// handler — sebuah panel murni yang dipisahkan dari `ProfileClient` suppaya
// urusan tampilan tidak bercampur dengan urusan pengambilan data.
import Link from "next/link";
import { Clock, XCircle, CheckCircle2, HelpCircle, ArrowRight } from "lucide-react";
import type { UserQuestion } from "./types";

export function ProfileQuestionsPanel({ questions }: { questions: UserQuestion[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-nawa-success" /> Soal Latihan Yang Kamu Buat
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Daftar pertanyaan dan soal latihan ujian yang telah kamu tambahkan ke bank soal sekolah.
          </p>
        </div>
        <Link
          href="/submit"
          className="bg-nawa-primary hover:bg-nawa-primary-hover text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
        >
          + Buat Soal Baru
        </Link>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
          <HelpCircle className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
          <h4 className="text-base font-extrabold text-zinc-900 dark:text-white mt-3">Belum ada soal yang dibuat</h4>
          <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
            Bantu teman-teman berlatih materi dengan membuat pertanyaan pilihan ganda yang bermutu tinggi.
          </p>
          <Link
            href="/submit"
            className="mt-4 inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-nawa-primary dark:text-indigo-400 text-xs px-4.5 py-2.5 rounded-xl font-bold border border-indigo-100 dark:border-indigo-900 transition-all cursor-pointer"
          >
            Buat Soal Latihan Sekarang <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {questions.map((q) => (
            <div
              key={q.id}
              className="group relative bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:border-emerald-400 dark:hover:border-nawa-success transition-all duration-300 shadow-sm hover:shadow-md flex flex-col h-full overflow-hidden text-left"
            >
              <div className="absolute -right-8 -top-8 w-24 h-24 bg-nawa-success/5 rounded-full blur-2xl pointer-events-none group-hover:bg-nawa-success/15 transition-all" />

              <div className="flex justify-between items-start gap-4 mb-4 relative z-10">
                <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black tracking-wider uppercase border shadow-sm
                  ${q.difficulty === "mudah" ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/60" :
                    q.difficulty === "sedang" ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/60" :
                    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900/60"}`}
                >
                  Kesulitan: {q.difficulty}
                </span>

                <div>
                  {q.status === "approved" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> Disetujui
                    </span>
                  )}
                  {q.status === "pending" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      <Clock className="h-3 w-3" /> Tinjauan
                    </span>
                  )}
                  {q.status === "rejected" && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                      <XCircle className="h-3 w-3" /> Ditolak
                    </span>
                  )}
                </div>
              </div>

              <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 line-clamp-3 leading-relaxed relative z-10 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors mb-4">
                &quot;{q.questionText}&quot;
              </p>

              <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 font-semibold relative z-10">
                <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <HelpCircle className="h-3.5 w-3.5 text-nawa-success" /> Kuis CBT
                </span>
                <span>{new Date(q.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
