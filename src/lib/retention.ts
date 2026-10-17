// src/lib/retention.ts
// ─── Kebijakan retensi & job pembersih ────────────────────────────────────────
// UU PDP mewajibkan data pribadi dihapus setelah tujuan pengumpulannya selesai,
// atau setelah masa simpan yang wajar. "Wajar" harus ditulis di suatu tempat yang
// bisa dibaca pengguna *dan* dieksekusi mesin, dan dua tempat itu tidak boleh
// berbeda. Karena itu tabel di bawah adalah satu-satunya sumber kebenaran:
// halaman /privacy menampilkannya, dan `runRetention()` menghapus berdasarkan
// angka yang sama.
//
// Yang sengaja TIDAK dihapus: `modules`, `questions`, dan `custom_exams`. Itu isi
// perpustakaan yang dibaca siswa lain, bukan catatan tentang satu orang, dan
// penghapusannya akan menghapus karya orang lain yang tidak terkait. Atribusinya
// diselesaikan lewat jalur hapus akun (src/lib/accountData.ts), bukan lewat
// retensi.
import { lt } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db/types";

/**
 * Bentuk database yang dibutuhkan modul ini — Neon HTTP di produksi, PGlite di
 * test. Lihat src/db/types.ts untuk alasannya.
 */
export type RetentionDb = AppDb;

export interface RetentionRule {
  /** Nama tabel, dipakai sebagai kunci hasil dan di log. */
  key: "reports" | "points_log" | "submissions";
  /** Nama yang dibaca manusia, dipakai di halaman /privacy. */
  label: string;
  /** Umur maksimum dalam bulan. */
  windowMonths: number;
  /** Alasan singkat, tampil di halaman /privacy. */
  rationale: string;
}

/**
 * Masa simpan. Mengubah angka di sini mengubah halaman /privacy *dan* job
 * sekaligus; itulah tujuannya.
 */
export const RETENTION_POLICY: readonly RetentionRule[] = [
  {
    key: "reports",
    label: "Laporan masalah (bug/konten)",
    windowMonths: 12,
    rationale:
      "Dipakai hanya untuk memperbaiki platform. Setelah setahun laporan tidak lagi ditindaklanjuti.",
  },
  {
    key: "points_log",
    label: "Riwayat poin (V-Point)",
    windowMonths: 24,
    rationale:
      "Menjaga keadilan papan peringkat dan menyelesaikan sengketa poin pada tahun ajaran yang sama.",
  },
  {
    key: "submissions",
    label: "Riwayat pengajuan moderasi",
    windowMonths: 24,
    rationale:
      "Bukti mengapa sebuah modul/soal disetujui atau ditolak; setelah dua tahun tidak lagi diperlukan.",
  },
];

export type RetentionCounts = Record<RetentionRule["key"], number>;

export interface RetentionResult {
  /** Waktu eksekusi, untuk log dan jawaban endpoint. */
  ranAt: string;
  /** Batas waktu per tabel (ISO), supaya hasilnya bisa diaudit. */
  cutoffs: Record<RetentionRule["key"], string>;
  deleted: RetentionCounts;
  totalDeleted: number;
}

/** Batas waktu = `now` dikurangi `windowMonths` bulan kalender. */
export function cutoffDate(now: Date, windowMonths: number): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setMonth(cutoff.getMonth() - windowMonths);
  return cutoff;
}

/**
 * Jalankan seluruh aturan retensi. Idempoten: menjalankannya dua kali berturut
 * hari tidak menghapus apa pun yang lebih baru, dan baris yang sudah terhapus
 * tidak dihitung lagi.
 *
 * `now` bisa disuntik supaya test tidak perlu menunggu setahun.
 */
export async function runRetention(
  db: RetentionDb,
  options: { now?: Date } = {},
): Promise<RetentionResult> {
  const now = options.now ?? new Date();

  const cutoffs = {} as RetentionResult["cutoffs"];
  const deleted = {} as RetentionCounts;

  for (const rule of RETENTION_POLICY) {
    const cutoff = cutoffDate(now, rule.windowMonths);
    cutoffs[rule.key] = cutoff.toISOString();
    deleted[rule.key] = await deleteOlderThan(db, rule.key, cutoff);
  }

  const totalDeleted = Object.values(deleted).reduce((sum, value) => sum + value, 0);

  return { ranAt: now.toISOString(), cutoffs, deleted, totalDeleted };
}

/**
 * Satu tabel, satu predikat. Ditulis sebagai `switch` eksplisit, bukan dengan
 * nama tabel sebagai string yang disisipkan ke SQL: sebuah tabel yang ditulis
 * sebagai string adalah tempat kesalahan ketik berubah menjadi penghapusan
 * tabel yang salah.
 */
async function deleteOlderThan(
  db: RetentionDb,
  key: RetentionRule["key"],
  cutoff: Date,
): Promise<number> {
  switch (key) {
    case "reports": {
      const removed = await db
        .delete(schema.reports)
        .where(lt(schema.reports.createdAt, cutoff))
        .returning({ id: schema.reports.id });
      return removed.length;
    }
    case "points_log": {
      const removed = await db
        .delete(schema.pointsLog)
        .where(lt(schema.pointsLog.createdAt, cutoff))
        .returning({ id: schema.pointsLog.id });
      return removed.length;
    }
    case "submissions": {
      const removed = await db
        .delete(schema.submissions)
        .where(lt(schema.submissions.submittedAt, cutoff))
        .returning({ id: schema.submissions.id });
      return removed.length;
    }
  }
}
