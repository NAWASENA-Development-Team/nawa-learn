// src/lib/submissionQuota.ts
// ─── Batas antrean kiriman per akun ───────────────────────────────────────────
//
// M18 membuka jalan kontribusi untuk **siswa**: sejak itu setiap siswa boleh
// mengajukan modul dan soal. Tanpa batas, satu akun bisa membanjiri antrean
// moderasi dengan tiga puluh draf dan membuat peninjau berhenti membaca — dan
// antrean yang tidak dibaca adalah antrean yang tidak ada.
//
// Batasnya **tiga** kiriman `pending` per akun. Angka ini sengaja kecil: satu
// kiriman yang sedang ditinjau adalah satu kiriman yang belum bisa diperbaiki
// penulisnya, jadi menumpuk lebih dari tiga berarti menulis untuk antrean, bukan
// untuk dibaca.
//
// Keadaan ini dijawab **409**, bukan 429. 429 adalah "kamu terlalu cepat" dan
// sudah dipakai `rateLimit`; ini "kamu punya terlalu banyak yang belum diputus",
// yaitu keadaan data yang tidak berubah karena menunggu beberapa detik.
import { and, count, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db/types";

/** Kiriman `pending` maksimum per akun, lintas modul dan soal. */
export const MAX_PENDING_SUBMISSIONS = 3;

/** Paket ujian `pending` maksimum per akun. */
export const MAX_PENDING_EXAMS = 3;

/** Paket ujian `approved` maksimum per akun — batas terbit, bukan batas antrean. */
export const MAX_PUBLISHED_EXAMS = 25;

/** Tipe baris `submissions` yang mewakili paket ujian, bukan modul/soal. */
const EXAM_SUBMISSION_TYPE = "exam";

/**
 * Berapa kiriman modul/soal yang masih menunggu keputusan.
 *
 * Baris `type = 'exam'` **tidak** ikut dihitung: paket ujian punya batasnya
 * sendiri (`MAX_PENDING_EXAMS`), dan menyatukan keduanya berarti seorang
 * kontributor yang sedang menunggu tiga paket ujian tidak bisa mengajukan satu
 * pun soal — dua permukaan berbeda yang saling mengunci tanpa alasan.
 */
export async function pendingSubmissionCount(
  db: AppDb,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.submissions)
    .where(
      and(
        eq(schema.submissions.submitterId, userId),
        eq(schema.submissions.status, "pending"),
        ne(schema.submissions.type, EXAM_SUBMISSION_TYPE),
      ),
    );
  return Number(row?.value ?? 0);
}

/** Berapa paket ujian yang masih menunggu tinjauan. */
export async function pendingExamCount(db: AppDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.customExams)
    .where(
      and(
        eq(schema.customExams.authorId, userId),
        eq(schema.customExams.status, "pending"),
      ),
    );
  return Number(row?.value ?? 0);
}

/** Berapa paket ujian yang sudah terbit. */
export async function publishedExamCount(db: AppDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(schema.customExams)
    .where(
      and(
        eq(schema.customExams.authorId, userId),
        eq(schema.customExams.status, "approved"),
      ),
    );
  return Number(row?.value ?? 0);
}

/**
 * Jawaban standar saat batasnya terlampaui.
 *
 * Ditulis di satu tempat supaya kedua route menjawab dengan `code` yang sama —
 * klien yang menampilkan pesan berdasarkan `code` tidak boleh mendapat dua
 * ejaan berbeda untuk satu keadaan.
 */
export function pendingQuotaResponse(): NextResponse {
  return NextResponse.json(
    {
      error: `Kamu masih punya ${MAX_PENDING_SUBMISSIONS} kiriman yang menunggu tinjauan. Tunggu keputusannya dulu sebelum mengirim lagi.`,
      // "submissions", bukan sekadar "pending": `too_many_pending_exams` ada di
      // berkas yang sama, dan dua kode yang hanya berbeda di akhiran adalah kode
      // yang cepat tertukar saat dibaca dari log.
      code: "too_many_pending_submissions",
    },
    { status: 409, headers: { "cache-control": "no-store" } },
  );
}

/** Jawaban standar saat antrean paket ujian penuh. */
export function examPendingQuotaResponse(): NextResponse {
  return NextResponse.json(
    {
      error: `Kamu masih punya ${MAX_PENDING_EXAMS} paket ujian yang menunggu tinjauan. Tunggu keputusannya dulu sebelum membuat yang baru.`,
      code: "too_many_pending_exams",
    },
    { status: 409, headers: { "cache-control": "no-store" } },
  );
}

/** Jawaban standar saat batas paket terbit tercapai. */
export function examPublishedQuotaResponse(): NextResponse {
  return NextResponse.json(
    {
      error: `Kamu sudah punya ${MAX_PUBLISHED_EXAMS} paket ujian terbit — batas per akun. Hapus salah satunya lebih dulu bila ingin menerbitkan yang baru.`,
      code: "too_many_exams",
    },
    { status: 409, headers: { "cache-control": "no-store" } },
  );
}
