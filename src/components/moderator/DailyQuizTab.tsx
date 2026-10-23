// components/moderator/DailyQuizTab.tsx
// ─── Tab 4: pembuat soal Kuis Harian ─────────────────────────────────────────
//
// Murni presentasi: form dan daftar. Penyimpanan (`/api/questions/daily-
// create`) dan penghapusan (`/api/questions/reject` soft-delete) adalah
// callback ke shell, yang memperbarui daftar setiap operasi berhasil.
//
// Sejak M18b tab ini punya **dua** bagian yang tidak boleh tertukar:
//
//   • "Aktif hari ini" dibaca dari `daily_quiz_slot` jendela berjalan. Sebelumnya
//     panel hanya menampilkan semua soal berkategori "Kuis Harian" lalu
//     menjudulinya "aktif", sehingga soal kemarin tampak masih menjadi soal hari
//     ini padahal slot hari ini bisa berisi soal lain yang dipilih otomatis.
//   • "Soal kurasi di bank" adalah stok, bukan jadwal. Menghapus di sini
//     mengurangi bank dan **tidak** mengganti soal hari ini.
"use client";

import { Zap, Plus, Trash2 } from "lucide-react";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import { dailyDifficultyClass } from "./types";
import type { ActiveDailyQuestion, DailyQuestion, Difficulty } from "./types";

export type DailyFormState = {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string;
  answerKey: string;
  difficulty: Difficulty;
  subject: string;
};

interface DailyQuizTabProps {
  activeDaily: ActiveDailyQuestion | null;
  staleDailySlot: boolean;
  canReplaceDaily: boolean;
  dailyQuestions: DailyQuestion[];
  isLoadingDaily: boolean;
  isSubmittingDaily: boolean;
  dailyForm: DailyFormState;
  onFormChange: (updater: (prev: DailyFormState) => DailyFormState) => void;
  onCreateQuestion: (e: React.FormEvent) => void;
  onDeleteQuestion: (questionId: string) => void;
}

function QuestionMeta({ question }: { question: DailyQuestion }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${dailyDifficultyClass(question.difficulty)}`}>{question.difficulty}</span>
      {question.subject && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-nawa-primary dark:text-indigo-400">{question.subject}</span>}
      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Kunci: {question.answerKey}</span>
    </div>
  );
}

export function DailyQuizTab({
  activeDaily, staleDailySlot, canReplaceDaily, dailyQuestions, isLoadingDaily,
  isSubmittingDaily, dailyForm, onFormChange, onCreateQuestion, onDeleteQuestion,
}: DailyQuizTabProps) {
  const submitLabel = !canReplaceDaily
    ? "Simpan soal ke bank"
    : activeDaily
      ? "Ganti soal aktif hari ini"
      : "Tambahkan ke Kuis Harian";

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl px-5 py-3 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-300">
        <Zap className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          <strong>Satu soal aktif per hari.</strong> Kalau hari ini masih diisi otomatis dari bank,
          soalmu langsung menggantikannya. Kalau peninjau lain sudah mengurasi hari ini, soalmu tetap
          tersimpan di bank soal dan bisa dipakai hari lain — tidak ada yang dihapus.
          Siswa yang menjawab benar mendapat <strong>+25 Poin XP</strong> (1x per hari, reset 03:00 WIB).
        </span>
      </div>

      {/* Active slot today */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-extrabold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
          <Zap className="h-5 w-5 text-emerald-600" /> Aktif hari ini
        </h3>
        <p className="text-[11px] text-zinc-500 mb-4">
          Soal inilah yang dilihat siswa sekarang. Daftar di bawahnya adalah stok bank, bukan jadwal.
        </p>

        {isLoadingDaily ? (
          <p className="text-xs font-bold text-zinc-500">Memuat slot hari ini...</p>
        ) : staleDailySlot ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            Slot hari ini menunjuk soal yang sudah dihapus dari bank, jadi siswa sementara mendapat
            soal pengganti dari bank. Buat soal baru di bawah untuk mengisi slot ini.
          </div>
        ) : activeDaily ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {activeDaily.source === "auto" ? (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                  Otomatis dari bank
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                  Kurasi{activeDaily.authorName ? ` oleh ${activeDaily.authorName}` : ""}
                </span>
              )}
            </div>
            <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 leading-relaxed">
              <LatexRenderer text={activeDaily.question.questionText} />
            </div>
            <QuestionMeta question={activeDaily.question} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 px-4 py-6 text-center">
            <p className="text-xs font-bold text-zinc-500">Belum ada soal aktif hari ini.</p>
          </div>
        )}
      </div>

      {/* Create Form */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-extrabold text-zinc-900 dark:text-white mb-1 flex items-center gap-2">
          <Plus className="h-5 w-5 text-emerald-600" /> Buat Soal Baru
        </h3>
        {!canReplaceDaily && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-3">
            Hari ini sudah dikurasi peninjau lain. Soal yang kamu simpan akan masuk ke bank soal,
            bukan menggantikan soal hari ini.
          </p>
        )}
        <form onSubmit={onCreateQuestion} className="space-y-4">
          {/* Question Text */}
          <div>
            <label htmlFor="daily-question-text" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">Pertanyaan</label>
            <textarea
              id="daily-question-text"
              value={dailyForm.questionText}
              onChange={(e) => onFormChange(f => ({ ...f, questionText: e.target.value }))}
              placeholder="Tulis pertanyaan di sini..."
              rows={3}
              required
              className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-nawa-success focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Subject + Difficulty Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="daily-question-subject" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">Mata Pelajaran</label>
              <select
                id="daily-question-subject"
                value={dailyForm.subject}
                onChange={(e) => onFormChange(f => ({ ...f, subject: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-nawa-success"
              >
                <option value="Umum">Umum</option>
                <option value="Matematika">Matematika</option>
                <option value="Fisika">Fisika</option>
                <option value="Kimia">Kimia</option>
                <option value="Biologi">Biologi</option>
                <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                <option value="Bahasa Inggris">Bahasa Inggris</option>
                <option value="Sejarah">Sejarah</option>
                <option value="Geografi">Geografi</option>
                <option value="Ekonomi">Ekonomi</option>
                <option value="Sosiologi">Sosiologi</option>
                <option value="PKN">PKN</option>
                <option value="Informatika">Informatika</option>
              </select>
            </div>
            <div>
              <label htmlFor="daily-question-difficulty" className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">Tingkat Kesulitan</label>
              <select
                id="daily-question-difficulty"
                value={dailyForm.difficulty}
                onChange={(e) => onFormChange(f => ({ ...f, difficulty: e.target.value as Difficulty }))}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-nawa-success"
              >
                <option value="mudah">Mudah</option>
                <option value="sedang">Sedang</option>
                <option value="sulit">Sulit</option>
              </select>
            </div>
          </div>

          {/* Options */}
          <fieldset className="space-y-2">
            <legend className="block text-xs font-bold text-zinc-600 dark:text-zinc-400">Pilihan Jawaban</legend>
            {(["A", "B", "C", "D", "E"] as const).map((key) => {
              const fieldKey = `option${key}` as "optionA" | "optionB" | "optionC" | "optionD" | "optionE";
              const isRequired = key !== "E";
              return (
                <div key={key} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onFormChange(f => ({ ...f, answerKey: key }))}
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all border-2 cursor-pointer ${
                      dailyForm.answerKey === key
                        ? "bg-emerald-600 border-emerald-600 text-white scale-110"
                        : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-emerald-400"
                    }`}
                    title={`Jadikan ${key} sebagai kunci jawaban`}
                  >
                    {key}
                  </button>
                  <input
                    type="text"
                    aria-label={`Opsi ${key}${key === "E" ? " (opsional)" : ""}`}
                    value={dailyForm[fieldKey]}
                    onChange={(e) => onFormChange(f => ({ ...f, [fieldKey]: e.target.value }))}
                    placeholder={`Opsi ${key}${key === "E" ? " (opsional)" : ""}`}
                    required={isRequired}
                    className="flex-1 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:ring-2 focus:ring-nawa-success focus:border-transparent"
                  />
                  {dailyForm.answerKey === key && (
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider shrink-0">Kunci</span>
                  )}
                </div>
              );
            })}
            <p className="text-[10px] text-zinc-400 mt-1">Klik huruf untuk menjadikannya kunci jawaban yang benar.</p>
          </fieldset>

          <button
            type="submit"
            disabled={isSubmittingDaily}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmittingDaily ? (
              <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
            ) : (
              <><Zap className="h-4 w-4" /> {submitLabel}</>
            )}
          </button>
        </form>
      </div>

      {/* Curated bank */}
      <div>
        <h3 className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-2">
          Soal kurasi di bank ({dailyQuestions.length})
        </h3>
        <p className="text-[11px] text-zinc-500 mb-3">
          Stok soal untuk Kuis Harian. Menghapus di sini mengurangi bank soal dan tidak mengganti
          soal yang sedang aktif hari ini.
        </p>
        {isLoadingDaily ? (
          <div className="p-12 text-center text-zinc-600 flex flex-col items-center justify-center">
            <div className="h-8 w-8 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin mb-3" />
            <p className="text-xs font-bold">Memuat soal kuis harian...</p>
          </div>
        ) : dailyQuestions.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl p-8 text-center">
            <Zap className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-zinc-500">Belum ada soal kurasi di bank. Buat soal pertamamu di atas!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dailyQuestions.map((q, idx) => {
              const isActive = activeDaily?.question.id === q.id;
              return (
                <div key={q.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex gap-4 items-start text-left">
                  <span className="text-xs font-black text-zinc-400 mt-1 shrink-0 w-6 text-center">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    {isActive && (
                      <span className="inline-block mb-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                        Aktif hari ini
                      </span>
                    )}
                    <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      <LatexRenderer text={q.questionText} />
                    </div>
                    <QuestionMeta question={q} />
                  </div>
                  <button
                    onClick={() => onDeleteQuestion(q.id)}
                    aria-label={`Hapus soal nomor ${idx + 1} dari bank`}
                    className="shrink-0 h-8 w-8 rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.98] flex items-center justify-center transition-colors cursor-pointer"
                    title="Hapus dari bank soal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
