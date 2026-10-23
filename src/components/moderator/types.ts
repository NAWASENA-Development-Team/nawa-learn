// components/moderator/types.ts
// ─── Bentuk data panel moderator ─────────────────────────────────────────────
//
// Dipakai oleh tab-tab panel moderator (modul, soal, paket ujian, lencana, kuis
// harian, tim) dan oleh shell. Ditarik ke file sendiri karena tiap tab hanya
// butuh bentuknya sendiri — mengimpor dari shell berarti membawa seluruh panel
// ke setiap tab.

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

/**
 * Staf manusia di tab Tim (M17) — `role` peninjau dengan `season_role_key` NULL.
 *
 * `email` sengaja tidak ada: daftar ini dibaca pemegang kursi juga, dan alamat
 * surel seorang guru bukan bagian dari "siapa yang menjaga panel ini".
 */
export type TeamStaffMember = {
  id: string;
  name: string;
  role: "moderator" | "admin";
  avatarIndex: number | null;
  photoUrl: string | null;
};

/**
 * Pemegang kursi Dewan Podium musim berjalan, diambil dari `getPodium()`.
 *
 * `seatNumber` berasal dari urutan podium, bukan dari `season_role_key`: kunci
 * yang tersisa dari musim lalu belum dicabut cron, jadi ia bukan bukti bahwa
 * orangnya masih duduk.
 */
export type TeamSeatMember = {
  id: string;
  name: string;
  avatarIndex: number | null;
  photoUrl: string | null;
  points: number;
  seatNumber: number;
};

/**
 * Satu soal paket ujian seperti yang dilihat **peninjau** — `answerKey` ikut.
 *
 * Bentuk ini hanya datang dari `GET /api/exams/pending` (di balik
 * `requireReviewer()`) lewat `toReviewExamQuestions()`. Kalau tipe ini suatu hari
 * dipakai untuk data dari `/api/exams/list`, kuncinya akan tampil sebagai string
 * kosong — bukan kebocoran, tetapi tab peninjau akan menampilkan paket seolah
 * tanpa kunci jawaban, dan menyetujuinya berarti menyetujui tanpa memeriksa.
 */
export type PendingExamQuestion = {
  id: string;
  text: string;
  options: Record<string, string>;
  answerKey: string;
  explanation: string | null;
};

/** Satu paket ujian yang menunggu keputusan (tab "Paket Ujian"). */
export type PendingExam = {
  submissionId: string;
  submittedAt: string;
  examId: string;
  title: string;
  subject: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  questionCount: number;
  questions: PendingExamQuestion[];
  submitterId: string;
  submitterName: string;
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

/**
 * Slot kuis harian jendela berjalan — bukan "soal terakhir yang dibuat".
 *
 * `source` adalah asalnya: `auto` berarti `daily_quiz_slot.author_id` NULL dan
 * soal dipilih `ensureDailySlot()` dari bank; `curated` berarti seorang peninjau
 * memilihnya. Setiap soal kurasi boleh **menggantikan** slot `auto`, jadi panel
 * perlu membedakannya agar "Ganti soal hari ini" terasa masuk akal.
 */
export type ActiveDailyQuestion = {
  windowStart: string;
  source: "auto" | "curated";
  authorName: string | null;
  question: DailyQuestion;
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
