// components/practice/QuizResultsScreen.tsx
// ─── Layar 3: skor, V-Point, dan pembahasan ───────────────────────────────────
//
// Kunci di layar ini:
//
//   `gradedResults[q.id]?.correctKey ?? q.answerKey`
//
// Verdict server selalu menang. `q.answerKey` hanya dipakai untuk kuis contoh
// yang sama sekali tidak ada di database (soal demo bawaan). Untuk kuis
// kontribusi dan ujian buatan siswa, `q.answerKey` sengaja dikirim kosong
// dari server — string kosong itu adalah *janji*, bukan kecurangan: penilaian
// hanya terjadi di `/api/quiz/submit` dan `/api/exams/submit`.
"use client";

import {
  Award, AlertCircle, Sparkles, Minus, RotateCcw, BookOpen, Info, Lock, Gift,
} from "lucide-react";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import type { Question } from "./types";

export type GradedResult = { correct: boolean; correctKey: string };

interface QuizResultsScreenProps {
  questions: Question[];
  answers: Record<string, string>;
  gradedResults: Record<string, GradedResult>;
  /** Detik tersisa saat ujian selesai — ditampilkan sebagai statistik. */
  timeLeft: number;
  correctCount: number;
  wrongCount: number;
  finalScore: number;
  pointsLoading: boolean;
  pointsAwarded: number | null;
  penaltyPoints: number | null;
  alreadyCompleted: boolean;
  notRewardable: boolean;
  levelRewardsGranted: string[];
  onRestart: () => void;
  onBackToList: () => void;
}

export function QuizResultsScreen({
  questions, answers, gradedResults, timeLeft,
  correctCount, wrongCount, finalScore, pointsLoading, pointsAwarded,
  penaltyPoints, alreadyCompleted, notRewardable, levelRewardsGranted,
  onRestart, onBackToList,
}: QuizResultsScreenProps) {
  const netPoints = (pointsAwarded ?? 0) - (penaltyPoints ?? 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 sm:p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-6 border border-indigo-100 dark:border-indigo-900/30">
          <Award className="h-8 w-8" />
        </div>

        <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white">Hasil Latihan CBT Selesai</h2>
        <p className="text-sm text-zinc-550 dark:text-zinc-400 mt-2 max-w-md mx-auto">
          Selamat! Anda telah menyelesaikan simulasi kuis dari NAWA-LEARN. Hasil kinerja akademik Anda tercatat di bawah ini.
        </p>

        {/* Score circle */}
        <div className="my-8 relative inline-flex items-center justify-center">
          <div className="h-40 w-40 rounded-full border-8 border-zinc-100 dark:border-zinc-800 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <span className="text-4xl sm:text-5xl font-black text-indigo-600 dark:text-indigo-400">{finalScore}</span>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1">SCORE</span>
          </div>
          <div className="absolute -top-1 -right-1 bg-indigo-50 border border-indigo-200 p-1.5 rounded-lg text-indigo-600 animate-bounce">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-left">
            <span className="text-[10px] font-bold text-emerald-600 uppercase">Jawaban Benar</span>
            <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-450 mt-1">{correctCount} / {questions.length}</h4>
            <p className="text-xs text-zinc-455 dark:text-zinc-500 mt-1">Akurasi Soal</p>
          </div>
          <div className="p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-left">
            <span className="text-[10px] font-bold text-red-500 uppercase">Jawaban Salah</span>
            <h4 className="text-2xl font-black text-red-505 mt-1">{wrongCount} / {questions.length}</h4>
            <p className="text-xs text-zinc-455 dark:text-zinc-500 mt-1">Tinjau Kesalahan</p>
          </div>
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl text-left">
            <span className="text-[10px] font-bold text-indigo-500 uppercase">Sisa Waktu Ujian</span>
            <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
            </h4>
            <p className="text-xs text-zinc-455 dark:text-zinc-500 mt-1">Manajemen Waktu</p>
          </div>
        </div>

        {/* Poin XP result section */}
        <div className="max-w-2xl mx-auto mb-6 space-y-3">
          {pointsLoading ? (
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin shrink-0" />
              <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Menghitung Poin kamu...</p>
            </div>
          ) : notRewardable ? (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                <Info className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Latihan Tanpa Poin XP</p>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">
                  Kuis ini tetap dinilai, tetapi tidak memberi poin — kuis contoh dan ujian buatan siswa tidak dapat diverifikasi, jadi tidak ada poin yang ditambahkan. Kuis hasil kontribusi siswa dan Kuis Harian tetap memberi poin.
                </p>
              </div>
            </div>
          ) : alreadyCompleted ? (
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Poin Tidak Diberikan</p>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">
                  Kamu sudah pernah menyelesaikan ujian ini sebelumnya. Poin XP hanya diberikan untuk penyelesaian <span className="font-bold">pertama kali</span>.
                </p>
              </div>
            </div>
          ) : pointsAwarded !== null ? (
            <>
              {/* Reward row */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Reward Selesai Kuis</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                      Dihitung server dari <span className="font-bold">{correctCount}</span> jawaban benar
                    </p>
                  </div>
                </div>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 shrink-0">+{pointsAwarded}</span>
              </div>

              {/* Penalty row (only if there are wrong answers) */}
              {(penaltyPoints ?? 0) > 0 && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-500 flex items-center justify-center shrink-0">
                      <Minus className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Penalti Jawaban Salah</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {wrongCount} salah × 10% dari reward dasar ({pointsAwarded} XP)
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-black text-red-600 dark:text-red-400 shrink-0">−{penaltyPoints}</span>
                </div>
              )}

              {/* Net total */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                netPoints >= 0
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30"
                  : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30"
              }`}>
                <p className={`text-sm font-extrabold ${netPoints >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                  {netPoints >= 0 ? "Net Poin Diterima" : "Net Poin Berkurang"}
                </p>
                <span className={`text-2xl font-black shrink-0 ${netPoints >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {netPoints >= 0 ? `+${netPoints}` : netPoints}
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* Level reward banner */}
        {levelRewardsGranted.length > 0 && (
          <div className="max-w-2xl mx-auto mb-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-left flex gap-3 items-start animate-in fade-in duration-300">
            <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center shrink-0">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="font-extrabold text-amber-800 dark:text-amber-300 text-sm">Level Reward Baru!</p>
              <ul className="mt-1 space-y-0.5">
                {levelRewardsGranted.map((r, i) => (
                  <li key={i} className="text-xs text-amber-700 dark:text-amber-400 font-semibold">• {r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Feedback badge */}
        <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm flex gap-3 items-start text-left mb-10">
          <AlertCircle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold text-zinc-900 dark:text-white">
              {finalScore >= 70 ? "Kesiapan Ujian Sangat Tinggi" : "Terus Berjuang & Pelajari Rangkuman"}
            </p>
            <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
              {finalScore >= 70
                ? "Hasil latihan menunjukkan pemahaman yang sangat mendalam pada konsep dasar. Pertahankan prestasi dan cobalah tantangan kuis lainnya!"
                : "Jangan patah semangat! Siswa SMAN 2 Jonggol dapat mengunduh serta membaca rangkuman pelajaran reguler dan UTBK secara instan di perpustakaan modul."}
            </p>
          </div>
        </div>

        {/* Review & Pembahasan */}
        <div className="max-w-4xl mx-auto mb-10 text-left space-y-6">
          <h3 className="text-xl font-black text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6">Kunci Jawaban & Pembahasan</h3>
          {questions.map((q, idx) => {
            const userAnswer = answers[q.id];
            const graded = gradedResults[q.id];
            // Prefer the key the server graded against; fall back to the local
            // key for sample/demo quizzes that live only in the browser.
            const correctKey = graded?.correctKey ?? q.answerKey;
            const isCorrect = graded ? graded.correct : userAnswer === correctKey;
            return (
              <div key={q.id} className={`p-5 rounded-2xl border ${isCorrect ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30" : "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900/30"}`}>
                <div className="flex gap-3 items-start mb-4">
                  <span className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5 ${isCorrect ? "bg-emerald-500" : "bg-red-500"}`}>
                    {idx + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <LatexRenderer text={q.text} />
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 ml-9">
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Jawabanmu</p>
                    <p className={`text-sm font-semibold ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {userAnswer ? `${userAnswer}. ${q.options[userAnswer]}` : "- Kosong -"}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Kunci Jawaban</p>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {correctKey ? `${correctKey}. ${q.options[correctKey]}` : "- Tidak tersedia -"}
                    </p>
                  </div>
                </div>

                {q.explanation && (
                  <div className="ml-9 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Pembahasan
                    </p>
                    <div className="text-sm text-zinc-700 dark:text-zinc-300">
                      <LatexRenderer text={q.explanation} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 border-t border-zinc-150 dark:border-zinc-800/80 pt-8">
          <button
            onClick={onRestart}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 text-sm transition-all shadow-md shadow-indigo-600/10 hover:shadow-lg active:scale-95 cursor-pointer border border-indigo-700"
          >
            <RotateCcw className="h-4 w-4" /> Ulangi Latihan CBT
          </button>
          <button
            onClick={onBackToList}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-750 dark:text-zinc-200 font-bold py-3 px-6 text-sm transition-all border border-zinc-200 dark:border-zinc-750 active:scale-95 cursor-pointer"
          >
            <BookOpen className="h-4 w-4" /> Daftar Kuis Lainnya
          </button>
        </div>
      </div>
    </div>
  );
}
