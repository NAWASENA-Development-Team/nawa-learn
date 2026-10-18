// src/lib/specialtyStats.ts
// ─── Angka di balik lencana spesialis, dihitung database ──────────────────────
// Sebelum M13, halaman peringkat memuat **seluruh** baris `modules`, `questions`
// dan `points_log` milik 100 pengguna teratas ke dalam memori Node, lalu
// menyaringnya satu per satu di JavaScript. Biayanya tumbuh sebanding dengan isi
// platform, bukan dengan jumlah pengguna yang ditampilkan: 100 pengguna dengan
// 200 soal masing-masing berarti 20.000 baris — termasuk `answer_key` — untuk
// menghasilkan enam angka.
//
// Modul ini menggantinya dengan tiga query agregat. Yang dikirim balik dari
// database hanya satu baris per pengguna, dan kolom rahasia tidak pernah dibaca
// sama sekali.
//
// ## Kenapa `quiz_answer`, bukan `quiz_completed`
// Kode lama menghitung "kuis" dari `action LIKE 'quiz_completed%'`. Tidak ada
// satu pun penulis di `src/` yang pernah menulis nilai itu — `points_log` hanya
// berisi `quiz_answer` (satu baris per soal yang dijawab), `daily_quiz`,
// `module_approved`, `question_approved`, dan `level_reward_points`. Artinya
// `quizTotal` dan `hardQuizzes` **selalu nol**, dan tiga lencana spesialis
// ("Quiz Dominator", "Eternal Student", "Rule Breaker") mustahil terbuka.
// Sekarang yang dihitung adalah soal yang benar-benar dijawab, dan "sulit"
// diambil dari `questions.difficulty` lewat `ref_id` — bukan dari tebakan di
// nama aksi.
//
// Modul ini dipakai dua permukaan (peringkat dan profil publik) supaya keduanya
// tidak bisa berbeda pendapat tentang siapa yang berhak atas sebuah lencana.

import { and, eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { SpecialtyStats } from "@/lib/badges";

/** Nilai netral untuk pengguna yang belum punya satu pun baris terkait. */
export function emptySpecialtyStats(): SpecialtyStats {
  return {
    hardQuizzes: 0,
    approvedMods: 0,
    diverseSubjects: 0,
    quizTotal: 0,
    approvedQuestions: 0,
    totalDownloads: 0,
  };
}

/**
 * Enam angka lencana untuk sekumpulan pengguna, dalam tiga query tetap.
 *
 * Jumlah query tidak bergantung pada panjang `userIds` — itulah intinya. Map yang
 * dikembalikan selalu berisi **setiap** id yang diminta, dengan nilai nol bila
 * pengguna itu tidak punya konten, sehingga pemanggil tidak perlu menangani
 * `undefined`.
 */
export async function getSpecialtyStats(
  db: AppDb,
  userIds: string[],
): Promise<Map<string, SpecialtyStats>> {
  const stats = new Map<string, SpecialtyStats>();
  if (userIds.length === 0) return stats;
  for (const id of userIds) stats.set(id, emptySpecialtyStats());

  const [moduleRows, questionRows, quizRows] = await Promise.all([
    db
      .select({
        userId: schema.modules.uploaderId,
        approvedMods:
          sql<number>`count(*) filter (where ${schema.modules.status} = 'approved')`.mapWith(Number),
        diverseSubjects:
          sql<number>`count(distinct ${schema.modules.subject}) filter (where ${schema.modules.status} = 'approved')`.mapWith(
            Number,
          ),
        // Unduhan dihitung dari **semua** modul, bukan hanya yang disetujui —
        // sama seperti sebelumnya. Sebuah modul yang sudah diunduh 100 kali lalu
        // ditolak bukan berarti unduhannya tidak pernah terjadi.
        totalDownloads: sql<number>`coalesce(sum(${schema.modules.downloads}), 0)`.mapWith(Number),
      })
      .from(schema.modules)
      .where(inArray(schema.modules.uploaderId, userIds))
      .groupBy(schema.modules.uploaderId),
    db
      .select({
        userId: schema.questions.uploaderId,
        approvedQuestions:
          sql<number>`count(*) filter (where ${schema.questions.status} = 'approved')`.mapWith(Number),
      })
      .from(schema.questions)
      .where(inArray(schema.questions.uploaderId, userIds))
      .groupBy(schema.questions.uploaderId),
    db
      .select({
        userId: schema.pointsLog.userId,
        quizTotal: sql<number>`count(*)`.mapWith(Number),
        hardQuizzes:
          sql<number>`count(*) filter (where ${schema.questions.difficulty} = 'sulit')`.mapWith(Number),
      })
      .from(schema.pointsLog)
      // `leftJoin`, bukan `innerJoin`: kalau soal yang pernah dijawab sudah
      // dihapus, jawabannya tetap dihitung sebagai soal yang dikerjakan
      // (`quizTotal`), hanya tidak bisa dipastikan sulit atau tidak.
      .leftJoin(schema.questions, eq(schema.questions.id, schema.pointsLog.refId))
      .where(
        and(
          inArray(schema.pointsLog.userId, userIds),
          eq(schema.pointsLog.action, "quiz_answer"),
        ),
      )
      .groupBy(schema.pointsLog.userId),
  ]);

  for (const row of moduleRows) {
    const entry = stats.get(row.userId);
    if (!entry) continue;
    entry.approvedMods = row.approvedMods;
    entry.diverseSubjects = row.diverseSubjects;
    entry.totalDownloads = row.totalDownloads;
  }

  for (const row of questionRows) {
    // `questions.uploader_id` boleh NULL (soal tanpa pemilik); `inArray` tidak
    // akan pernah mengembalikan baris seperti itu karena NULL tidak cocok dengan
    // daftar id mana pun.
    if (!row.userId) continue;
    const entry = stats.get(row.userId);
    if (!entry) continue;
    entry.approvedQuestions = row.approvedQuestions;
  }

  for (const row of quizRows) {
    const entry = stats.get(row.userId);
    if (!entry) continue;
    entry.quizTotal = row.quizTotal;
    entry.hardQuizzes = row.hardQuizzes;
  }

  return stats;
}
