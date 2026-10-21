// src/app/api/cron/season/route.ts
// ─── Job musim: rollover poin, kursi Dewan Podium, honor, dan outbox ─────────
// Polanya sengaja menyalin `api/cron/retention`: `POST` saja, gagal tertutup bila
// `CRON_SECRET` tidak diset, dan `GET` dijawab 405. Yang berbeda hanya isinya.
//
// Kenapa `POST`: route ini mengubah peran pengguna dan menulis poin. Sebuah `GET`
// bisa dipicu oleh prefetcher, crawler, atau tab yang tidak sengaja dibuka, dan
// operasi semacam ini tidak boleh punya jalur picu yang tidak disengaja. Vercel
// Cron mengirim POST.
//
// Jadwalnya `0 0 * * *` UTC di `vercel.json` — 07:00 WIB, tepat setelah batas
// kuartal (yang juga 00:00 UTC). Menjalankannya pukul 20:00 UTC akan membuat
// kursi baru diberikan tujuh jam setelah musim berganti.
//
// **Kalau job ini mati sama sekali, tidak ada kursi abadi**: `isSeatActive()`
// membandingkan kunci yang tersimpan dengan musim berjalan, jadi peran dari
// musim lalu otomatis tidak sah. Yang tertunda hanyalah pemberian kursi baru,
// dan endpoint ini tetap bisa dipanggil manual dengan `CRON_SECRET`.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { runSeasonCron } from "@/lib/seasonCron";

export const maxDuration = 60;

/**
 * Perbandingan waktu-tetap, tanpa `node:crypto`.
 *
 * Sama persis dengan `api/cron/retention`: `===` pada string keluar lebih cepat
 * pada karakter pertama yang berbeda, dan selisih itu cukup untuk menebak rahasia
 * karakter demi karakter.
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
    // `CRON_SECRET` yang kosong adalah kesalahan konfigurasi, bukan percobaan
    // masuk yang gagal. Dua keadaan itu butuh tindakan tengah malam yang
    // berbeda, jadi keduanya diberi nama berbeda di log.
    if (!process.env.CRON_SECRET) {
      log.error("cron_season_misconfigured", { reason: "CRON_SECRET is not set" });
    } else {
      log.warn("cron_season_unauthorized", { reason: "bad or missing bearer token" });
    }
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const limit = await rateLimit(req, "cron/season", null);
  if (!limit.ok) return limit.response;

  try {
    const result = await runSeasonCron(db, log);

    log.info("season_cron_completed", {
      seasonKey: result.seasonKey,
      archived: result.archived,
      rolledOver: result.rolledOver,
      revoked: result.revoked,
      granted: result.granted,
      displaced: result.displaced,
      stipendPaid: result.stipendPaid,
      stipendCapped: result.stipendCapped,
      slotFilled: result.slotFilled,
      poolDepth: result.poolDepth,
      mailSent: result.mail.sent,
      mailFailed: result.mail.failed,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    log.error("season_cron_failed", error);
    return NextResponse.json(
      { error: "Season cron failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

/**
 * `GET` sengaja ditolak — alasannya sama dengan `api/cron/retention`.
 */
export function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
  );
}
