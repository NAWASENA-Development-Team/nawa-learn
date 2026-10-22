// src/lib/auditLog.ts
// ─── Jejak tindakan administratif (M12) ───────────────────────────────────────
// `points_log` menjawab "berapa poin yang diterima seseorang". Ia tidak bisa
// menjawab "siapa yang memutuskan ini, dan apa keadaannya sebelum keputusan itu",
// karena:
//
//   • penolakan tidak memberi poin sama sekali, jadi tidak punya baris di sana;
//   • `submissions.reviewer_id` hanya menyimpan peninjau **terakhir** — keputusan
//     berikutnya menimpanya, dan riwayatnya hilang;
//   • perubahan peran lewat `npm run db:promote` tidak meninggalkan jejak apa pun.
//
// Modul ini sengaja **tanpa** impor Next.js atau Clerk, sama seperti
// `accountData.ts`: yang tersisa hanya database dan logger, sehingga bisa diuji
// langsung terhadap Postgres sungguhan.
//
// ## Kegagalan menulis audit tidak membatalkan tindakannya
// Neon HTTP tidak punya transaksi. Kalau baris audit ditulis lebih dulu lalu
// mutasinya gagal, kita menyimpan catatan dusta ("moderator X menyetujui soal Y")
// untuk sesuatu yang tidak pernah terjadi. Kalau ditulis belakangan lalu gagal,
// kita kehilangan catatan untuk sesuatu yang **sudah** terjadi. Pilihan kedua
// adalah kegagalan yang jujur: tindakannya nyata, catatannya hilang, dan
// `audit_write_failed` masuk ke log sebagai peristiwa yang bisa diberi alarm.
// Itu sebabnya `recordAudit` mengembalikan boolean alih-alih melempar.
import * as schema from "@/db/schema";
import type { AppDb } from "@/db/types";
import { logger, type Logger } from "@/lib/logger";

/** Tindakan yang dicatat. Daftar tertutup, bukan `string` bebas. */
export const AUDIT_ACTIONS = [
  "content.approve",
  "content.reject",
  "user.role_change",
  "user.anonymise",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Entitas yang bisa menjadi sasaran. Juga daftar tertutup. */
// `exam` ditambahkan di M18: paket ujian punya antrean tinjauan sendiri dan
// keputusannya layak punya jejak yang sama dengan modul dan soal. Kolomnya
// `varchar(64)`, jadi tidak ada enum yang perlu dimigrasikan.
export const AUDIT_ENTITIES = ["module", "question", "exam", "submission", "user"] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

/**
 * Potret keadaan sebelum/sesudah.
 *
 * Nilainya dibatasi pada skalar. Ini bukan kerapian gaya: sebuah audit log yang
 * menerima `unknown` akan, cepat atau lambat, diberi baris `users` utuh — dan
 * dengan itu menjadi **salinan PII kedua** yang harus ikut diekspor lewat
 * `/api/profile/export` dan ikut dikosongkan saat akun dihapus. Bentuk sempit ini
 * membuat kesalahan itu mustahil secara tipe, bukan sekadar tidak dianjurkan.
 */
export type AuditSnapshot = Record<string, string | number | boolean | null>;

export interface AuditEntry {
  /** Pelaku. `null` = sistem/CLI (mis. `npm run db:promote`). */
  actorId: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string | null;
  before?: AuditSnapshot;
  after?: AuditSnapshot;
}

/**
 * Menulis satu baris audit. Tidak pernah melempar.
 *
 * @returns `true` bila baris tersimpan, `false` bila gagal (sudah dilog).
 */
export async function recordAudit(
  db: AppDb,
  entry: AuditEntry,
  options: { log?: Logger } = {},
): Promise<boolean> {
  const log = options.log ?? logger;

  try {
    await db.insert(schema.auditLog).values({
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
    return true;
  } catch (error) {
    // Alertable. Field-nya sengaja hanya id dan nama tindakan: sebuah kegagalan
    // audit tidak boleh menjadi jalan PII masuk ke log.
    log.error("audit_write_failed", {
      error,
      auditAction: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
    });
    return false;
  }
}

export interface AuditListOptions {
  entity?: AuditEntity;
  entityId?: string;
  actorId?: string;
  limit?: number;
}

/** Batas atas keras, supaya satu permintaan tidak bisa menarik seluruh tabel. */
export const AUDIT_LIST_MAX = 100;

/**
 * Membaca riwayat audit, terbaru lebih dulu.
 *
 * Kolomnya disebut satu per satu — bukan `select()` — karena tabel ini hidup
 * berdampingan dengan `users` dan sebuah seleksi liar akan mulai membawa kolom
 * baru begitu skema bertambah.
 */
export async function listAuditEntries(db: AppDb, options: AuditListOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), AUDIT_LIST_MAX);

  return db.query.auditLog.findMany({
    where: (table, { and, eq }) => {
      const conditions = [];
      if (options.entity) conditions.push(eq(table.entity, options.entity));
      if (options.entityId) conditions.push(eq(table.entityId, options.entityId));
      if (options.actorId) conditions.push(eq(table.actorId, options.actorId));
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
    columns: {
      id: true,
      actorId: true,
      action: true,
      entity: true,
      entityId: true,
      before: true,
      after: true,
      createdAt: true,
    },
    // Urutan ini harus deterministik. `desc(createdAt)` saja tidak cukup:
    // `clock_timestamp()` memiliki resolusi milidetik di PGlite dan timestamp
    // Postgres sendiri hanya mikrodetik, jadi dua baris yang ditulis cepat
    // bisa berbagi stempel waktu yang persis sama — dan saat itu terjadi,
    // "terbaru lebih dulu" menjadi lemparan koin. `id` menjadi pemutus seri,
    // sama seperti di `src/lib/pagination.ts`. Catatan: ini urutan *sisipan*
    // yang kasat mata, bukan urutan logis; jika dua baris benar-benar menempati
    // mikrodetik yang sama, tidak ada yang bisa membedakan mana yang "terbaru"
    // sebenarnya, jadi apa pun yang konsisten lebih baik daripada yang acak.
    orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
    limit,
  });
}
