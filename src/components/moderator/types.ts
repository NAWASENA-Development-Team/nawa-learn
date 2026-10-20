// components/moderator/types.ts
// ─── Bentuk data panel moderator ─────────────────────────────────────────────
//
// Dipakai oleh empat tab (modul, soal, lencana, kuis harian) dan oleh shell.
// Ditarik ke file sendiri karena tiap tab hanya butuh bentuknya sendiri —
// mengimpor dari shell berarti membawa seluruh panel ke setiap tab.

export type PendingSubmission = {
  submissionId: string;
  submittedAt: string;
  moduleId: string;
  moduleTitle: string;
  moduleUrl: string;
  submitterId: string;
  submitterName: string;
};

export type PendingQuestion = {
  submissionId: string;
  questionId: string;
  questionText: string;
  options: Record<string, string>;
  answerKey: string;
  difficulty: "mudah" | "sedang" | "sulit";
  subject: string | null;
  category: string | null;
  submittedAt: string;
  submitterId: string;
  submitterName: string;
};

// User stats returned from /api/moderator/hidden-badges
export type HiddenBadgeHolder = {
  id: string;
  name: string;
  points: number;
  approvedModules: number;
  approvedQuestions: number;
};

export type DailyQuestion = {
  id: string;
  questionText: string;
  options: Record<string, string>;
  answerKey: string;
  difficulty: string;
  subject: string | null;
  createdAt: string;
};

export type Difficulty = "mudah" | "sedang" | "sulit";

/** Warna badge kesulitan untuk kartu soal di tab antrean. */
export function difficultyBadgeClass(d: Difficulty): string {
  return {
    mudah: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    sedang: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
    sulit: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  }[d];
}

/** Warna badge kesulitan untuk daftar kuis harian. */
export function dailyDifficultyClass(d: string): string {
  return {
    mudah: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    sedang: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
    sulit: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  }[d] || "bg-zinc-100 text-zinc-600";
}

export function difficultyLabel(d: Difficulty): string {
  return { mudah: "Mudah", sedang: "Sedang", sulit: "Sulit" }[d];
}

export function difficultyPoints(d: Difficulty): string {
  return { mudah: "+15 XP", sedang: "+25 XP", sulit: "+40 XP" }[d];
}
