// src/app/api/cron/retention/route.ts
// ─── Job retensi terjadwal (UU PDP) ───────────────────────────────────────────
// UU PDP mewajibkan data pribadi dihapus setelah masa simpannya berakhir. Sebuah
// kebijakan retensi yang hanya *ditulis* di halaman /privacy tetapi tidak pernah
// dijalankan bukan kebijakan — ia janji. Route ini yang menjalankannya.
//
// Kenapa POST dan bukan GET: ini menghapus baris. Sebuah `GET` bisa dipicu oleh
// apa pun yang menjelajahi tautan — prefetcher, crawler, atau tab yang tidak
// sengaja dibuka — dan sebuah operasi destruktif tidak boleh punya jalur picu
// yang tidak disengaja. Vercel Cron mengirim POST.
//
// Jadwalnya ada di vercel.json: `0 19 * * *` UTC, yaitu 02.00 WIB — jam paling
// sepi untuk sebuah platform sekolah, sehingga penghapusan tidak pernah bersaing
// dengan siapa pun yang sedang belajar.
//
// Penjagaannya hanya satu: header `Authorization: Bearer $CRON_SECRET`. Penjadwal
// tidak punya sesi, jadi `requireUser()` tidak berlaku; sebagai gantinya route
// ini **gagal tertutup** — `CRON_SECRET` yang kosong atau tidak diset berarti 401
// untuk semua orang, bukan akses terbuka untuk semua orang. Itu pembedaan yang
// penting: sebuah endpoint penghapus yang salah konfigurasi harus mati, bukan
// terbuka.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { runRetention } from "@/lib/retention";

export const maxDuration = 60;

/**
 * Perbandingan waktu-tetap, tanpa `node:crypto`.
 *
 * `===` pada string keluar lebih cepat pada karakter pertama yang berbeda, dan
 * selisih waktu itu cukup untuk menebak rahasia karakter demi karakter. Fungsi
 * ini selalu membandingkan seluruh panjang. Panjangnya sendiri dibocorkan, tetapi
 * untuk sebuah token acak berukuran tetap itu tidak memberi apa pun.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;

  return timingSafeEqual(header.slice(prefix.length), secret);
}

export async function POST(req: Request) {
  const log = requestLogger(req);

  if (!authorized(req)) {
    // `CRON_SECRET` yang belum diset adalah kesalahan konfigurasi, bukan
    // percobaan masuk yang gagal. Dibedakan di log supaya tidak tertukar saat
    // ada alarm menyala pada tengah malam.
    if (!process.env.CRON_SECRET) {
      log.error("cron_retention_misconfigured", { reason: "CRON_SECRET is not set" });
    } else {
      log.warn("cron_retention_unauthorized", { reason: "bad or missing bearer token" });
    }
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const limit = await rateLimit(req, "cron/retention", null);
  if (!limit.ok) return limit.response;

  try {
    const result = await runRetention(db);

    log.info("retention_run_completed", {
      totalDeleted: result.totalDeleted,
      reports: result.deleted.reports,
      pointsLog: result.deleted.points_log,
      submissions: result.deleted.submissions,
      dailyActivity: result.deleted.daily_activity,
      mailOutbox: result.deleted.mail_outbox,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    log.error("retention_run_failed", { error });
    return NextResponse.json(
      { error: "Retention run failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

/**
 * `GET` sengaja ditolak. Vercel Cron memakai POST, dan menerima GET di sini akan
 * mengembalikan jalur picu yang tidak disengaja yang justru ingin dihindari.
 */
export function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
  );
}
