// components/practice/QuizSessionScreen.tsx
// ─── Layar 4: pengerjaan ujian aktif ──────────────────────────────────────────
//
// Semua state sesi (jawaban, indeks, waktu) dipegang halaman dan datang lewat
// props — layar ini tidak menyimpan apa pun, sehingga timer dan navigasi tetap
// satu sumber kebenaran. `answers` adalah `Record<string, string>` murni;
// **tidak ada** kunci jawaban yang pernah masuk ke payload ini.
"use client";

import {
  Clock, ArrowLeft, ArrowRight, Check, CheckCircle2, Shuffle, AlertTriangle,
} from "lucide-react";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import type { Quiz, Question } from "./types";

interface QuizSessionScreenProps {
  quiz: Quiz;
  questions: Question[];
  currentIndex: number;
  answers: Record<string, string>;
  timeLeft: number;
  answeredCount: number;
  progressPercent: number;
  onSelectOption: (questionId: string, optionKey: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpTo: (index: number) => void;
  onFinish: () => void;
}

export function QuizSessionScreen({
  quiz, questions, currentIndex, answers, timeLeft, answeredCount, progressPercent,
  onSelectOption, onPrev, onNext, onJumpTo, onFinish,
}: QuizSessionScreenProps) {
  const currentQ = questions[currentIndex];
  const isTimeCritical = timeLeft < 300;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800/80">
        <div className="text-left">
          <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">{quiz.title}</h2>
          <p className="text-xs text-zinc-600 mt-1">
            Kerjakan soal pilihan ganda di bawah ini secara teliti untuk menguji kesiapan UTBK dan Olimpiade Anda.
          </p>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono font-bold text-sm sm:text-base tracking-widest shrink-0 transition-all ${
          isTimeCritical
            ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40 animate-pulse"
            : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-nawa-primary dark:text-indigo-400"
        }`}>
          <Clock className={`h-4.5 w-4.5 ${isTimeCritical ? "text-red-500 animate-spin" : "text-indigo-500"}`} />
          <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-8 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full flex-1">
          <div className="flex justify-between text-xs font-bold text-zinc-600 mb-1.5 text-left">
            <span>Progress Pengisian</span>
            <span>{answeredCount} dari {questions.length} Soal Terjawab ({progressPercent}%)</span>
          </div>
          <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-nawa-primary rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Left: question panel */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 sm:p-8 text-left">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-1 rounded-lg text-zinc-600 font-bold uppercase tracking-wider">
                Pertanyaan {currentIndex + 1}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-nawa-primary dark:text-indigo-400 font-extrabold px-2.5 py-0.5 rounded">
                  {currentQ.subject}
                </span>
                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-extrabold px-2.5 py-0.5 rounded">
                  {currentQ.category}
                </span>
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white leading-relaxed mb-8">
              <LatexRenderer text={currentQ.text} />
            </h3>

            <div className="space-y-3">
              {Object.entries(currentQ.options).map(([key, value]) => {
                const isSelected = answers[currentQ.id] === key;
                return (
                  <button
                    key={key}
                    onClick={() => onSelectOption(currentQ.id, key)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between cursor-pointer group hover:scale-[1.01] ${
                      isSelected
                        ? "border-nawa-primary bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-indigo-300 dark:hover:border-indigo-900 text-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                        isSelected
                          ? "bg-nawa-primary text-white shadow-md shadow-nawa-primary/10"
                          : "bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700 group-hover:bg-indigo-50 group-hover:text-nawa-primary transition-colors"
                      }`}>
                        {key}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold">
                        <LatexRenderer text={value} />
                      </span>
                    </div>
                    {isSelected && (
                      <div className="h-5 w-5 rounded-full bg-nawa-primary text-white flex items-center justify-center shadow-md">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation controls */}
          <div className="flex justify-between items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm">
            <button
              onClick={onPrev}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> Sebelumnya
            </button>

            {currentIndex === questions.length - 1 ? (
              <button
                onClick={() => {
                  if (confirm("Apakah Anda yakin ingin menyelesaikan simulasi CBT ini?")) {
                    onFinish();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-nawa-primary hover:bg-nawa-primary-hover text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-nawa-primary/10 hover:shadow-lg active:scale-95 transition-all cursor-pointer border border-nawa-primary-hover"
              >
                Selesaikan Ujian <CheckCircle2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={onNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-nawa-primary hover:bg-nawa-primary-hover text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-nawa-primary/10 hover:shadow-lg active:scale-95 transition-all cursor-pointer border border-nawa-primary-hover"
              >
                Berikutnya <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="lg:col-span-1 space-y-6 text-left">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Navigasi Soal</h4>
            <div className="grid grid-cols-5 gap-2.5">
              {questions.map((q, idx) => {
                const isActive = currentIndex === idx;
                const isAnswered = answers[q.id] !== undefined;
                return (
                  <button
                    key={q.id}
                    onClick={() => onJumpTo(idx)}
                    className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                      isActive
                        ? "bg-nawa-primary border-nawa-primary text-white shadow-md shadow-nawa-primary/20 font-black scale-105"
                        : isAnswered
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                          : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800/80 mt-4 pt-4 space-y-2 text-[10px] font-semibold text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-md bg-nawa-primary" />
                <span>Soal Aktif saat ini</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-md bg-emerald-50 border border-emerald-300" />
                <span>Sudah diisi / dijawab</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-md bg-zinc-50 border border-zinc-200" />
                <span>Belum dikerjakan</span>
              </div>
            </div>
          </div>

          {/* Peserta ujian card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-sm relative overflow-hidden bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Peserta Ujian</h4>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-nawa-primary dark:text-indigo-400 flex items-center justify-center font-bold text-xs uppercase border border-indigo-100 dark:border-indigo-950/50">
                {quiz.id === "quiz_contributed" || quiz.isCustom ? "K" : "A"}
              </div>
              <div>
                <h5 className="text-xs font-extrabold text-zinc-900 dark:text-white">
                  {quiz.id === "quiz_contributed" ? "Kolaborasi Siswa" : quiz.isCustom ? (quiz.author ?? "Siswa SMAN 2") : "Ahmad Kontributor"}
                </h5>
                <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Siswa SMAN 2 Jonggol</p>
              </div>
            </div>
            <div className="border-t border-zinc-100 dark:border-zinc-800/80 mt-4 pt-3 space-y-2 text-[10px] text-zinc-500">
              <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" /> <b>Durasi:</b> {quiz.durationMinutes} Menit Maksimal</p>
              <p className="flex items-center gap-1.5"><Shuffle className="h-3.5 w-3.5 text-zinc-400 shrink-0" /> <b>Acak Soal:</b> Aktif (CBT Mode)</p>
              <p className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-nawa-warning shrink-0" /> <b>Penalti:</b> -10% / Jawaban Salah</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
