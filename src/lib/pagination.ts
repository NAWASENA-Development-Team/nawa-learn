// src/lib/pagination.ts
// ─── Paginasi keyset, sekecil mungkin dan bisa diuji tanpa database ───────────
// Daftar yang tidak dibatasi adalah cara paling umum sebuah endpoint tumbuh dari
// "cepat" menjadi "timeout": `/api/questions/approved` menarik **setiap** soal
// yang pernah disetujui ke satu respons, dan biayanya naik seiring waktu, bukan
// seiring trafik. `limit` saja tidak cukup — dengan `offset`, halaman ke-20 tetap
// memaksa database memindai 20 halaman pertama, dan baris yang disisipkan di
// tengah membuat halaman berikutnya melewatkan atau mengulang data.
//
// Keyset (a.k.a. cursor) menghilangkan keduanya: `WHERE (created_at, id) <
// (cursor.created_at, cursor.id) ORDER BY created_at DESC, id DESC LIMIT n` hanya
// memindai mulai dari posisi terakhir. Itu sebabnya modul ini ada, dan itu
// sebabnya ia **tidak** mengimpor Next.js maupun database: seluruh perilakunya
// (batas, penyandian kursor, kursor rusak) bisa diuji langsung.
//
// `id` selalu ikut menjadi bagian kunci, bukan hiasan. `created_at` tidak unik —
// dan di Postgres `now()` bahkan mengembalikan waktu **mulai transaksi**, jadi
// dua baris yang ditulis berurutan bisa berbagi stempel waktu yang sama persis.
// Tanpa pemecah seri, urutan halaman menjadi tidak dapat ditentukan dan sebuah
// baris bisa muncul dua kali atau tidak sama sekali.

import { and, eq, lt, or, sql, type AnyColumn, type SQL } from "drizzle-orm";

/** Posisi terakhir yang sudah dilihat pembaca. */
export interface PageCursor {
  createdAt: Date;
  id: string;
}

export interface CursorRead {
  cursor: PageCursor | null;
  /** `true` bila `?cursor=` ada tetapi tidak bisa dibaca. Route menjawab 400. */
  malformed: boolean;
}

/** Pemisah yang tidak mungkin muncul di ISO-8601 maupun UUID. */
const SEPARATOR = "|";

/** Kursor yang wajar jauh di bawah ini; lebih panjang berarti sampah. */
const MAX_CURSOR_LENGTH = 200;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `?limit=` dengan batas atas yang dipaksakan.
 *
 * Nilai yang bukan bilangan bulat positif **jatuh ke default**, bukan menjadi
 * 400: `?limit=abc` hampir selalu berasal dari URL yang salah ketik, bukan dari
 * klien yang mencoba menyalahgunakan sesuatu, dan menolaknya tidak menambah
 * keamanan apa pun — batas atasnya sudah menjaga biaya query.
 */
export function readLimit(req: Request, options: { defaultValue: number; max: number }): number {
  const raw = new URL(req.url).searchParams.get("limit");
  if (raw === null || !/^\d+$/.test(raw)) return options.defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (parsed < 1) return options.defaultValue;
  return Math.min(parsed, options.max);
}

/**
 * `?cursor=` — `malformed: true` bila ada tetapi tidak terbaca.
 *
 * Sengaja dibedakan dari "tidak ada kursor". Kalau kursor rusak diperlakukan
 * sebagai "mulai dari awal", klien yang menyimpan kursor akan mengulang halaman
 * pertama selamanya tanpa pernah melihat kesalahan; 400 membuat bug itu terlihat
 * pada permintaan pertama.
 */
export function readCursor(req: Request): CursorRead {
  const raw = new URL(req.url).searchParams.get("cursor");
  if (raw === null || raw === "") return { cursor: null, malformed: false };
  const cursor = decodeCursor(raw);
  return cursor ? { cursor, malformed: false } : { cursor: null, malformed: true };
}

export function encodeCursor(cursor: PageCursor): string {
  return toBase64Url(`${cursor.createdAt.toISOString()}${SEPARATOR}${cursor.id}`);
}

export function decodeCursor(raw: string): PageCursor | null {
  if (raw.length > MAX_CURSOR_LENGTH) return null;

  const decoded = fromBase64Url(raw);
  if (decoded === null) return null;

  const split = decoded.indexOf(SEPARATOR);
  if (split < 1) return null;

  const id = decoded.slice(split + 1);
  if (!UUID_PATTERN.test(id)) return null;

  const createdAt = new Date(decoded.slice(0, split));
  if (Number.isNaN(createdAt.getTime())) return null;

  return { createdAt, id };
}

/**
 * Predikat `(created_at, id) < (cursor)` untuk urutan `DESC`.
 *
 * Ditulis sebagai `OR` eksplisit, bukan perbandingan baris `ROW(...) < ROW(...)`,
 * karena bentuk inilah yang bisa dilayani indeks `(created_at DESC, id DESC)`
 * secara langsung.
 */
export function keysetBefore(createdAt: AnyColumn, id: AnyColumn, cursor: PageCursor): SQL {
  return (
    or(
      lt(createdAt, cursor.createdAt),
      and(eq(createdAt, cursor.createdAt), lt(id, cursor.id)),
    ) ?? sql`false`
  );
}

/**
 * Memotong hasil `limit + 1` menjadi satu halaman dan kursor berikutnya.
 *
 * Satu baris ekstra diambil supaya "apakah masih ada halaman lagi?" bisa
 * dijawab tanpa `COUNT(*)` kedua — dan tanpa `nextCursor` palsu ketika jumlah
 * baris kebetulan tepat kelipatan `limit`.
 */
export function pageSlice<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
): { rows: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { rows, nextCursor: null };
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { rows: page, nextCursor: encodeCursor({ createdAt: last.createdAt, id: last.id }) };
}

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const withPadding = remainder === 0 ? padded : padded + "=".repeat(4 - remainder);
  try {
    return atob(withPadding);
  } catch {
    return null;
  }
}
