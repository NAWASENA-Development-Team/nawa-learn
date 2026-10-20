// components/moderator/DailyQuizTab.tsx
// ─── Tab 4: pembuat soal Kuis Harian ─────────────────────────────────────────
//
// Murni presentasi: form dan daftar. Penyimpanan (`/api/questions/daily-
// create`) dan penghapusan (`/api/questions/reject` soft-delete) adalah
// callback ke shell, yang memperbarui daftar setiap operasi berhasil.
"use client";

import { Zap, Plus, Trash2 } from "lucide-react";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import { dailyDifficultyClass } from "./types";
import type { DailyQuestion, Difficulty } from "./types";

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
  dailyQuestions: DailyQuestion[];
  isLoadingDaily: boolean;
  isSubmittingDaily: boolean;
  dailyForm: DailyFormState;
  onFormChange: (updater: (prev: DailyFormState) => DailyFormState) => void;
  onCreateQuestion: (e: React.FormEvent) => void;
  onDeleteQuestion: (questionId: string) => void;
}

export function DailyQuizTab({
  dailyQuestions, isLoadingDaily, isSubmittingDaily, dailyForm,
  onFormChange, onCreateQuestion, onDeleteQuestion,
}: DailyQuizTabProps) {
  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl px-5 py-3 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-300">
        <Zap className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Buat soal untuk <strong>Kuis Harian</strong>. Soal yang dibuat di sini langsung aktif tanpa perlu persetujuan.
          Siswa yang menyelesaikan kuis harian mendapat <strong>+25 Poin XP</strong> (1x per hari, reset 03:00 WIB).
          Variasikan tingkat kesulitannya!
        </span>
      </div>

      {/* Create Form */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-extrabold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-emerald-600" /> Buat Soal Baru
        </h3>
        <form onSubmit={onCreateQuestion} className="space-y-4">
          {/* Question Text */}
          <div>
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">Pertanyaan</label>
            <textarea
              value={dailyForm.questionText}
              onChange={(e) => onFormChange(f => ({ ...f, questionText: e.target.value }))}
              placeholder="Tulis pertanyaan di sini..."
              rows={3}
              required
              className="w-full px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Subject + Difficulty Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">Mata Pelajaran</label>
              <select
                value={dailyForm.subject}
                onChange={(e) => onFormChange(f => ({ ...f, subject: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500"
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
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1.5">Tingkat Kesulitan</label>
              <select
                value={dailyForm.difficulty}
                onChange={(e) => onFormChange(f => ({ ...f, difficulty: e.target.value as Difficulty }))}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="mudah">Mudah</option>
                <option value="sedang">Sedang</option>
                <option value="sulit">Sulit</option>
              </select>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400">Pilihan Jawaban</label>
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
                    value={dailyForm[fieldKey]}
                    onChange={(e) => onFormChange(f => ({ ...f, [fieldKey]: e.target.value }))}
                    placeholder={`Opsi ${key}${key === "E" ? " (opsional)" : ""}`}
                    required={isRequired}
                    className="flex-1 px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  {dailyForm.answerKey === key && (
                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider shrink-0">Kunci</span>
                  )}
                </div>
              );
            })}
            <p className="text-[10px] text-zinc-400 mt-1">Klik huruf untuk menjadikannya kunci jawaban yang benar.</p>
          </div>

          <button
            type="submit"
            disabled={isSubmittingDaily}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmittingDaily ? (
              <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
            ) : (
              <><Zap className="h-4 w-4" /> Tambahkan ke Kuis Harian</>
            )}
          </button>
        </form>
      </div>

      {/* Existing Daily Questions List */}
      <div>
        <h3 className="text-sm font-extrabold text-zinc-700 dark:text-zinc-300 mb-3 flex items-center gap-2">
          Soal Kuis Harian Aktif ({dailyQuestions.length})
        </h3>
        {isLoadingDaily ? (
          <div className="p-12 text-center text-zinc-600 flex flex-col items-center justify-center">
            <div className="h-8 w-8 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin mb-3" />
            <p className="text-xs font-bold">Memuat soal kuis harian...</p>
          </div>
        ) : dailyQuestions.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-2xl p-8 text-center">
            <Zap className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-zinc-500">Belum ada soal kuis harian. Buat soal pertamamu di atas!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dailyQuestions.map((q, idx) => (
              <div key={q.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex gap-4 items-start text-left">
                <span className="text-xs font-black text-zinc-400 mt-1 shrink-0 w-6 text-center">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 leading-relaxed">
                    <LatexRenderer text={q.questionText} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${dailyDifficultyClass(q.difficulty)}`}>{q.difficulty}</span>
                    {q.subject && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">{q.subject}</span>}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">Kunci: {q.answerKey}</span>
                  </div>
                </div>
                <button
                  onClick={() => onDeleteQuestion(q.id)}
                  className="shrink-0 h-8 w-8 rounded-lg border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.98] flex items-center justify-center transition-colors cursor-pointer"
                  title="Hapus soal ini"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
