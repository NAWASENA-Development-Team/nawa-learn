// components/practice/types.ts
// ─── Bentuk data latihan CBT ──────────────────────────────────────────────────
//
// Tipe dipisah dari halaman karena **enam** komponen memakainya: dua puluh
// layar daftar, persiapan, pengerjaan, hasil, dan modal pembuatan ujian.
// Menduplikasinya pasti berubah arah; mengimpornya dari halaman berarti
// membawa seluruh halaman ke setiap komponen.

export type Question = {
  id: string;
  text: string;
  options: Record<string, string>;
  answerKey: string;
  explanation?: string | null;
  subject: string;
  category: string;
  uploaderId?: string; // DB UUID of creator (for anti-cheat)
  isOwnQuestion?: boolean;
};

export type Quiz = {
  id: string;
  title: string;
  subject: string;
  category: string;
  questionsCount: number;
  durationMinutes: number;
  difficulty: string;
  icon: string;
  questions: Question[];
  author?: string;
  isCustom?: boolean;
};

// ─── API payloads ─────────────────────────────────────────────────────────────
// The shapes `/api/questions/approved` and `/api/exams/list` actually return.
// These used to be cast to `any[]`, which meant a renamed field in either route
// became `undefined` rendered into a quiz instead of a compile error.

export type ApprovedQuestionPayload = {
  id: string;
  questionText: string;
  options: Record<string, string> | null;
  subject: string | null;
  category: string | null;
  uploaderId: string;
  isOwnQuestion?: boolean;
};

export type ExamQuestionPayload = {
  id: string;
  text: string;
  options: Record<string, string>;
  explanation?: string | null;
};

export type ExamListItemPayload = {
  id: string;
  title: string;
  subject: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  authorName?: string | null;
  questions: ExamQuestionPayload[];
};

export type QuestionDraft = {
  text: string;
  optA: string; optB: string; optC: string; optD: string; optE: string;
  answerKey: string;
  explanation: string;
};

// ─── Constants & helpers ──────────────────────────────────────────────────────

export const DIFFICULTY_OPTIONS = ["Mudah", "Sedang", "Sulit", "Sangat Sulit"];
export const CATEGORY_OPTIONS = ["UTBK-SNBT", "Olimpiade (OSN)", "Ujian Harian", "Reguler", "Kuis Harian", "Campuran"];
export const EMPTY_DRAFT: QuestionDraft = {
  text: "", optA: "", optB: "", optC: "", optD: "", optE: "", answerKey: "A", explanation: "",
};

export function getDifficultyStyle(difficulty: string): string {
  const d = difficulty.toLowerCase();
  if (d === "mudah")
    return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30";
  if (d === "sedang" || d === "bervariasi")
    return "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30";
  if (d === "sulit")
    return "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30";
  if (d === "sangat sulit")
    return "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/30";
  return "bg-zinc-50 dark:bg-zinc-950/30 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-900/30";
}
