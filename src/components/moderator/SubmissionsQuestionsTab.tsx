// components/moderator/SubmissionsQuestionsTab.tsx
// ─── Tab 2: antrean draf soal latihan ─────────────────────────────────────────
//
// Murni presentasi. Soal yang ditampilkan sudah berstatus pending; persetujuan
// dan penolakan adalah callback ke shell, yang menulis hasilnya ke state dan
// menghapus kartu dari antrean.
//
// `answerKey` dimuat moderator di sini — moderator adalah pihak yang
// menyetujui, jadi melihat kunci adalah tugasnya. Yang tidak boleh terjadi
// adalah kunci yang sama terlihat oleh siswa lain, dan pencegahannya ada di
// `/api/questions/approved`.
"use client";

import { Check, X, HelpCircle, Key } from "lucide-react";
import { LatexRenderer } from "@/components/ui/LatexRenderer";
import {
  difficultyBadgeClass, difficultyLabel, difficultyPoints,
} from "./types";
import type { PendingQuestion } from "./types";

interface SubmissionsQuestionsTabProps {
  pendingQuestions: PendingQuestion[];
  isLoadingQuestions: boolean;
  processingQuestionId: string | null;
  onApproveQuestion: (q: PendingQuestion) => void;
  onRejectQuestion: (q: PendingQuestion) => void;
}

export function SubmissionsQuestionsTab({
  pendingQuestions, isLoadingQuestions, processingQuestionId,
  onApproveQuestion, onRejectQuestion,
}: SubmissionsQuestionsTabProps) {
  return (
    <div className="space-y-4">
      {isLoadingQuestions ? (
        <div className="text-center py-10 text-zinc-500 text-sm">Memuat soal pending...</div>
      ) : pendingQuestions.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 rounded-3xl p-10 text-center shadow-sm max-w-xl mx-auto">
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-100/40">
            <HelpCircle className="h-6 w-6" />
          </div>
          <h4 className="text-base font-extrabold text-zinc-850 dark:text-zinc-150">Antrean Latihan Soal Bersih</h4>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Siswa belum mengajukan soal kuis baru untuk latihan mandiri. Usulan soal latihan dari kontributor akan muncul di sini untuk peninjauan.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {pendingQuestions.map((q) => (
            <div
              key={q.questionId}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col gap-5 text-left border-l-4 border-l-purple-500"
            >
              {/* Top Header Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {q.subject && (
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-2.5 py-0.5 rounded">
                      {q.subject}
                    </span>
                  )}
                  {q.category && (
                    <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-extrabold px-2.5 py-0.5 rounded">
                      {q.category}
                    </span>
                  )}
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded ${difficultyBadgeClass(q.difficulty)}`}>
                    {difficultyLabel(q.difficulty)} · {difficultyPoints(q.difficulty)}
                  </span>
                </div>

                <div className="text-right">
                  <p className="text-[10px] text-zinc-400">PENGUSUL: <span className="font-bold text-zinc-600 dark:text-zinc-300">{q.submitterName}</span></p>
                </div>
              </div>

              {/* Question text */}
              <div>
                <div className="text-sm font-extrabold text-zinc-950 dark:text-zinc-150 leading-relaxed mb-3">
                  <LatexRenderer text={q.questionText} />
                </div>

                {/* Options list */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {Object.entries(q.options as Record<string, string>).map(([key, val]) => (
                    <div
                      key={key}
                      className={`p-2.5 rounded-xl border text-xs flex gap-2 items-center ${
                        q.answerKey === key
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-350 text-emerald-800 dark:text-emerald-450 font-bold"
                          : "border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      <span className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                        q.answerKey === key ? "bg-emerald-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                      }`}>
                        {key}
                      </span>
                      <span className="truncate"><LatexRenderer text={val} /></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer tools */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Kunci Jawaban:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm uppercase">Opsi {q.answerKey}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onRejectQuestion(q)}
                    disabled={processingQuestionId === q.questionId}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-red-200 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.98] text-red-600 dark:text-red-400 font-bold px-4 text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <X className="h-4 w-4 mr-1" /> Tolak
                  </button>

                  <button
                    onClick={() => onApproveQuestion(q)}
                    disabled={processingQuestionId === q.questionId}
                    className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-extrabold px-4 text-xs transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-4 w-4 mr-1" /> {processingQuestionId === q.questionId ? "Memproses..." : "Setujui & Publikasikan"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
