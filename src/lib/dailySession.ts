// src/lib/dailySession.ts
// ─── Satu soal, satu hari, satu percobaan ─────────────────────────────────────
// Sebelum M18 "Kuis Harian" berarti dua puluh soal tanpa batas percobaan, dan
// hadiah +25 dibayar untuk partisipasi apa pun — termasuk satu jawaban salah.
// Halaman menyusun sesi baru setiap kali dimuat ulang, jadi siswa yang salah
// cukup me-refresh untuk mendapat soal lain, dan siswa yang sudah menjawab
// semuanya tetap mendapat soal baru.
//
// Sekarang soalnya **satu**, dipilih server, dan sama untuk semua orang:
// `daily_quiz_slot` (satu baris per jendela) adalah definisinya. Modul ini
// adalah satu-satunya tempat slot itu diisi dan dibaca, sehingga cron dan
// halaman tidak bisa memilih soal yang berbeda.
//
// Kenapa `ensureDailySlot()` dipanggil dari halaman juga: jendela harian mulai
// 03:00 WIB, sementara cron musim berjalan 07:00 WIB. Empat jam di antaranya
// dulu diisi "slot kosong lalu ambil 20 soal dari bank" — jalur yang sekarang
// dihapus. Tanpa pengisian dari halaman, empat jam pertama setiap hari tidak
// punya soal sama sekali.
import { and, asc, eq, ne, notInArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db/types";
import { startOfDailyWindow } from "@/lib/dailyWindow";
import { logger, type Logger } from "@/lib/logger";

/** Soal yang boleh menyeberang ke browser. `answerKey` tidak pernah ikut. */
export interface DailyQuestion {
  id: string;
  questionText: string;
  options: Record<string, string>;
  uploaderId: string;
}

interface DailySlot {
  windowStart: Date;
  questionId: string | null;
  /** True bila pemanggilan inilah yang mengisi slot. */
  filled: boolean;
}

interface SessionOptions {
  now?: Date;
  log?: Logger;
}

/**
 * Pastikan slot jendela `now` terisi, lalu kembalikan isinya.
 *
 * Idempoten: pemanggilan kedua hanya membaca baris yang sudah ada. Dua
 * permintaan yang berdekatan bisa sama-sama memilih soal, dan `window_start`
 * sebagai primary key yang memutuskan pemenangnya — yang kalah membaca ulang
 * baris pemenang, bukan menimpa.
 *
 * Soal dipilih deterministik (tertua yang belum pernah menjadi slot), sehingga
 * bank berputar alih-alih mengulang satu soal yang sama terus-menerus.
 */
export async function ensureDailySlot(
  db: AppDb,
  { now = new Date(), log = logger }: SessionOptions = {},
): Promise<DailySlot> {
  const windowStart = startOfDailyWindow(now);

  const existing = await db.query.dailyQuizSlot.findFirst({
    where: eq(schema.dailyQuizSlot.windowStart, windowStart),
    columns: { questionId: true },
  });

  if (existing) {
    return { windowStart, questionId: existing.questionId, filled: false };
  }

  const usedSlotQuestions = (
    await db
      .select({ questionId: schema.dailyQuizSlot.questionId })
      .from(schema.dailyQuizSlot)
  ).map((row) => row.questionId);

  const filters = [eq(schema.questions.status, "approved")];
  if (usedSlotQuestions.length > 0) {
    filters.push(notInArray(schema.questions.id, usedSlotQuestions));
  }

  const candidate = await db.query.questions.findFirst({
    where: and(...filters),
    columns: { id: true },
    orderBy: [asc(schema.questions.createdAt), asc(schema.questions.id)],
  });

  if (!candidate) {
    log.warn("daily_slot_empty_no_candidate", { windowStart: windowStart.toISOString() });
    return { windowStart, questionId: null, filled: false };
  }

  const claimed = await db
    .insert(schema.dailyQuizSlot)
    .values({ windowStart, questionId: candidate.id })
    .onConflictDoNothing()
    .returning({ questionId: schema.dailyQuizSlot.questionId });

  if (claimed.length > 0) {
    return { windowStart, questionId: claimed[0].questionId, filled: true };
  }

  // Balapan: permintaan lain mengisi slot ini lebih dulu. Baca barisnya.
  const winner = await db.query.dailyQuizSlot.findFirst({
    where: eq(schema.dailyQuizSlot.windowStart, windowStart),
    columns: { questionId: true },
  });

  return { windowStart, questionId: winner?.questionId ?? null, filled: false };
}

/**
 * Soal yang harus dijawab `userId` pada jendela `now`, atau `null` bila bank
 * soal belum punya satu pun soal yang disetujui.
 *
 * Soal milik penanya sendiri dilewati: menjawab soal sendiri bukan ujian, dan
 * karena `quiz/submit` menolak memberi poin untuk karya sendiri, menampilkannya
 * hanya akan menutup satu-satunya kesempatan siswa itu mendapat +25 hari ini.
 * `userId` boleh `null` (pengunjung anonim) — saat itu tidak ada yang dilewati.
 */
export async function resolveDailyQuestion(
  db: AppDb,
  { userId, now = new Date(), log = logger }: SessionOptions & { userId: string | null },
): Promise<DailyQuestion | null> {
  const slot = await ensureDailySlot(db, { now, log });

  if (slot.questionId) {
    const fromSlot = await db.query.questions.findFirst({
      where: and(
        eq(schema.questions.id, slot.questionId),
        eq(schema.questions.status, "approved"),
      ),
      columns: { id: true, questionText: true, options: true, uploaderId: true },
    });

    if (fromSlot && fromSlot.uploaderId !== userId) {
      return toDailyQuestion(fromSlot);
    }
  }

  // Jaring pengaman: slot menunjuk soal yang sudah tidak disetujui (atau slot
  // kosong karena bank belum punya soal). Pilih satu soal lain yang disetujui,
  // deterministik, bukan milik penanya.
  const fallbackFilters = [eq(schema.questions.status, "approved")];
  if (userId) fallbackFilters.push(ne(schema.questions.uploaderId, userId));
  if (slot.questionId) fallbackFilters.push(ne(schema.questions.id, slot.questionId));

  const fallback = await db.query.questions.findFirst({
    where: and(...fallbackFilters),
    columns: { id: true, questionText: true, options: true, uploaderId: true },
    orderBy: [asc(schema.questions.createdAt), asc(schema.questions.id)],
  });

  return fallback ? toDailyQuestion(fallback) : null;
}

/**
 * `options` adalah jsonb tanpa `$type`, jadi Drizzle mengetiknya `unknown`.
 * Bentuk yang sebenarnya selalu `{ A: "...", B: "...", ... }` — ditulis oleh
 * `/api/questions/submit` setelah lolos Zod — dan pemeran ini satu-satunya
 * tempat bentuk itu dinyatakan.
 */
function toDailyQuestion(row: {
  id: string;
  questionText: string;
  options: unknown;
  uploaderId: string;
}): DailyQuestion {
  return {
    id: row.id,
    questionText: row.questionText,
    options: row.options as Record<string, string>,
    uploaderId: row.uploaderId,
  };
}
