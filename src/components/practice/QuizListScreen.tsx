// components/practice/QuizListScreen.tsx
// ─── Layar 1: daftar paket ujian ──────────────────────────────────────────────
//
// Murni presentasi: daftar kuis, kartu statistik, dan ajakan kuis harian.
// Tidak ada state di sini — pemilihan kuis, penghapusan ujian buatan, dan
// membuka modal pembuatan adalah callback ke halaman, yang menguasai session.
"use client";

import Link from "next/link";
import {
  Clock, ArrowRight, FileText, PlusCircle, Trash2, BrainCircuit,
  BookOpen, Users, AlertTriangle,
} from "lucide-react";
import type { Quiz } from "./types";
import { getDifficultyStyle } from "./types";

interface QuizListScreenProps {
  quizzes: Quiz[];
  onSelectQuiz: (quiz: Quiz) => void;
  onOpenCreateModal: () => void;
  onDeleteCustomExam: (examId: string, e: React.MouseEvent) => void;
}

export function QuizListScreen({
  quizzes, onSelectQuiz, onOpenCreateModal, onDeleteCustomExam,
}: QuizListScreenProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 text-left animate-in fade-in duration-200">

      {/* Header banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-zinc-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden mb-8 border border-zinc-800 shadow-xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Simulasi &amp; Paket Latihan Ujian CBT SMAN 2 Jonggol
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300 mt-2 max-w-2xl leading-relaxed">
            Tingkatkan kesiapan akademis Anda dengan mengerjakan paket simulasi kuis pilihan ganda terstandar UTBK-SNBT, Olimpiade Sains, dan evaluasi kurikulum sekolah.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase">Paket Ujian</p>
            <p className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">{quizzes.length} Tersedia</p>
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase">Kolaborasi Siswa</p>
            <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              {quizzes.some(q => q.id === "quiz_contributed") ? "Aktif & Terbuka" : "Menunggu Draf"}
            </p>
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase">Sistem Penalti</p>
            <p className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">-10% / Jawaban Salah</p>
          </div>
        </div>
      </div>

      {/* Daily Quiz CTA */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 rounded-2xl p-6 text-white mb-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-lg shadow-indigo-500/20 relative overflow-hidden border border-indigo-400/20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-white/15 p-3 rounded-2xl backdrop-blur-sm relative border border-white/20">
            <BrainCircuit className="h-8 w-8 text-white" />
            <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-950 text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-sm">+25 XP</div>
          </div>
          <div>
            <h3 className="text-lg font-black flex items-center gap-2">Tantangan Kuis Harian</h3>
            <p className="text-xs sm:text-sm text-indigo-100 max-w-lg mt-1 leading-relaxed">
              Selesaikan tantangan soal adaptif yang diacak sistem setiap hari untuk menjaga streak dan klaim bonus +25 poin musim. (Reset setiap 03.00 WIB).
            </p>
          </div>
        </div>
        <Link
          href="/questions/daily"
          className="shrink-0 bg-white hover:bg-indigo-50 text-indigo-700 px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-[0.98] hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer relative z-10"
        >
          Mulai Kuis Harian <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Quiz list */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Daftar Paket Simulasi CBT SMAN 2
          </h3>
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/40 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Buat Ujian Baru
          </button>
        </div>

        <div className="space-y-3">
          {quizzes.map((quiz) => {
            const isContributed = quiz.id === "quiz_contributed";
            const isEmpty = quiz.questions.length === 0;

            return (
              <div
                key={quiz.id}
                className={`flex flex-col md:flex-row md:items-center justify-between p-4 bg-white dark:bg-zinc-900 border rounded-2xl gap-4 transition-all duration-200 group text-left ${
                  isEmpty
                    ? "border-zinc-200 dark:border-zinc-800 opacity-60"
                    : isContributed
                      ? "border-amber-300 dark:border-amber-800 bg-amber-50/5 dark:bg-amber-950/5 shadow-inner shadow-amber-500/[0.02] hover:shadow-md"
                      : quiz.isCustom
                        ? "border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/5 hover:shadow-md"
                        : "border-zinc-200 dark:border-zinc-800 hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500/55"
                }`}
              >
                {/* Left: icon + title */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-lg border ${
                    isContributed
                      ? "bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900 text-amber-600"
                      : quiz.isCustom
                        ? "bg-indigo-100 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900"
                        : quiz.subject === "Campuran"
                          ? "bg-indigo-100 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900 text-indigo-600"
                          : quiz.subject === "Matematika"
                            ? "bg-orange-100 dark:bg-orange-950/60 border-orange-200 dark:border-orange-900 text-orange-600"
                            : quiz.subject === "Fisika"
                              ? "bg-purple-100 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900 text-purple-600"
                              : quiz.subject === "Biologi"
                                ? "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900 text-emerald-600"
                                : "bg-teal-100 dark:bg-teal-950/60 border-teal-200 dark:border-teal-900 text-teal-600"
                  }`}>
                    {quiz.icon}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {quiz.title}
                      </h4>
                      {isContributed && (
                        <span className="bg-amber-500 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse border border-amber-600">
                          KONTRIBUSI SISWA
                        </span>
                      )}
                      {quiz.isCustom && (
                        <span className="bg-indigo-500 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-indigo-600">
                          BUATAN SISWA
                        </span>
                      )}
                      {isEmpty && (
                        <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          BELUM ADA SOAL
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[10px] bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 font-bold px-2 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800">
                        {quiz.subject}
                      </span>
                      <span className="text-[10px] bg-zinc-100 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 font-bold px-2 py-0.5 rounded border border-zinc-200/50 dark:border-zinc-800">
                        {quiz.category}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${getDifficultyStyle(quiz.difficulty)}`}>
                        {quiz.difficulty}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: stats + action */}
                <div className="flex flex-row items-center justify-between md:justify-end gap-3 border-t md:border-0 border-zinc-100 dark:border-zinc-800 pt-3 md:pt-0 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-bold bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-inner">
                      <FileText className="h-3.5 w-3.5 text-indigo-500" />
                      <span>{quiz.questionsCount} Soal</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-bold bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800 px-3 py-1.5 rounded-xl shadow-inner">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      <span>{quiz.durationMinutes} Menit</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {quiz.isCustom && (
                      <button
                        onClick={(e) => onDeleteCustomExam(quiz.id, e)}
                        className="h-8 w-8 flex items-center justify-center rounded-xl border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                        title="Hapus ujian ini"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => !isEmpty && onSelectQuiz(quiz)}
                      disabled={isEmpty}
                      className={`inline-flex items-center gap-1.5 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm hover:scale-[1.02] active:scale-95 cursor-pointer ${
                        isEmpty
                          ? "bg-zinc-300 dark:bg-zinc-700 cursor-not-allowed"
                          : isContributed
                            ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/10 border border-amber-600"
                            : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/10 border border-indigo-600"
                      }`}
                    >
                      {isEmpty ? "Tidak Tersedia" : <>Mulai <ArrowRight className="h-3.5 w-3.5" /></>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
