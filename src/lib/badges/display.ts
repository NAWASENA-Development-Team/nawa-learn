// src/lib/badges/display.ts
// ─── Bagian katalog yang boleh sampai ke browser ──────────────────────────────
//
// `getRarityColor`/`getRarityTextColor` adalah kelas Tailwind, bukan rahasia, dan
// komponen klien membutuhkannya. Fungsi-fungsi itu tinggal di sini, bukan di
// `catalog.ts`, supaya berkas yang mengimpor katalog (beserta 85 fungsi kondisi)
// tidak pernah masuk ke bundel browser.

import type { BadgeCategory, BadgeRarity, SpecialtyStats } from "./types";

/**
 * Kategori yang punya lencana, dalam urutan tampil di profil.
 *
 * Tinggal di sini, bukan di `evaluate.ts`, karena urutan tampil adalah urutan
 * **render** — komponen klien yang membutuhkannya, dan mengimpor `evaluate.ts`
 * berarti menarik katalog beserta 85 fungsi kondisi ke bundel browser. Satu
 * definisi untuk kedua sisi: `evaluate.ts` mengimpor dari sini.
 */
export const BADGE_CATEGORY_ORDER: readonly BadgeCategory[] = [
  "contribution",
  "learning",
  "milestone",
  "social",
  "special",
  "hidden",
];

/**
 * Lencana spesialis untuk tiga besar papan peringkat.
 *
 * Dipakai dua komponen klien (profil dan papan peringkat), jadi ia tinggal di
 * sini — berkas yang aman diimpor browser — dan bukan di `evaluate.ts`, yang
 * menarik seluruh katalog beserta 85 fungsi kondisi.
 *
 * `hardQuizzes`/`quizTotal` adalah jumlah **soal** yang dijawab (baris
 * `points_log` dengan aksi `quiz_answer`), bukan jumlah sesi kuis: sesi tidak
 * pernah dicatat di mana pun, jadi lencana "10+ kuis" hanya bisa membaca nol.
 * Teksnya menyebut apa yang benar-benar dihitung.
 */
export const getSpecialtyBadge = (stats: SpecialtyStats, rank?: number) => {
  if (rank && rank > 3) return null; // Default behavior for podium: only top 3 gets it if rank is passed

  if (stats.totalDownloads >= 100) return { name: "Viral Educator", desc: "Materi Diunduh 100+ Kali", icon: "🔥", gradient: "from-red-600 via-nawa-error to-pink-500", border: "border-rose-400/50", glow: "shadow-nawa-error/40" };
  if (stats.approvedQuestions >= 5) return { name: "Question Master", desc: "Pembuat Soal Mahir", icon: "📝", gradient: "from-blue-600 via-sky-500 to-cyan-400", border: "border-sky-400/50", glow: "shadow-sky-500/40" };
  if (stats.hardQuizzes >= 2) return { name: "Rule Breaker", desc: "Menaklukkan 2+ Soal Sulit", icon: "⚡", gradient: "from-red-500 via-orange-500 to-yellow-400", border: "border-orange-400/50", glow: "shadow-orange-500/40" };
  if (stats.approvedMods >= 5) return { name: "Library Builder", desc: "Kontributor 5+ Modul", icon: "🏛️", gradient: "from-amber-600 via-orange-500 to-amber-400", border: "border-orange-400/50", glow: "shadow-orange-500/40" };
  if (stats.approvedMods >= 3) return { name: "Grand Archivist", desc: "Penjaga Arsip Agung NAWA-LEARN", icon: "📚", gradient: "from-indigo-500 via-purple-500 to-pink-500", border: "border-purple-400/50", glow: "shadow-purple-500/40" };
  if (stats.diverseSubjects >= 4) return { name: "Polymath", desc: "Ahli 4+ Mata Pelajaran", icon: "🧬", gradient: "from-fuchsia-600 via-purple-500 to-pink-400", border: "border-fuchsia-400/50", glow: "shadow-fuchsia-500/40" };
  if (stats.diverseSubjects >= 3) return { name: "Scholar Prime", desc: "Kontributor Multi-Disiplin", icon: "🧠", gradient: "from-emerald-400 via-teal-500 to-cyan-500", border: "border-teal-400/50", glow: "shadow-teal-500/40" };
  if (stats.quizTotal >= 10) return { name: "Eternal Student", desc: "Menjawab 10+ Soal", icon: "⏳", gradient: "from-slate-600 via-zinc-500 to-stone-400", border: "border-slate-400/50", glow: "shadow-slate-400/40" };
  if (stats.quizTotal >= 5) return { name: "Quiz Dominator", desc: "Menjawab 5+ Soal", icon: "🎯", gradient: "from-cyan-500 via-blue-500 to-nawa-primary", border: "border-cyan-400/50", glow: "shadow-cyan-400/40" };
  return { name: "Legend Scholar", desc: "Legenda Platform NAWA-LEARN", icon: "👑", gradient: "from-amber-400 via-yellow-400 to-amber-300", border: "border-amber-400/50", glow: "shadow-amber-400/40" };
};

/** Kelas gradien latar untuk sebuah tingkat kelangkaan. */
export const getRarityColor = (rarity: BadgeRarity): string => {
  const colors: Record<BadgeRarity, string> = {
    common: "from-gray-400 to-gray-600",
    uncommon: "from-green-400 to-green-600",
    rare: "from-blue-400 to-blue-600",
    epic: "from-purple-400 to-purple-600",
    legendary: "from-yellow-400 to-yellow-600",
  };
  return colors[rarity];
};

/** Kelas warna teks untuk sebuah tingkat kelangkaan. */
export const getRarityTextColor = (rarity: BadgeRarity): string => {
  const colors: Record<BadgeRarity, string> = {
    common: "text-gray-700 dark:text-gray-300",
    uncommon: "text-green-700 dark:text-green-300",
    rare: "text-blue-700 dark:text-blue-300",
    epic: "text-purple-700 dark:text-purple-300",
    legendary: "text-yellow-700 dark:text-yellow-300",
  };
  return colors[rarity];
};
