// src/app/api/profile/notifications/route.ts
// ─── Pilihan surel: satu kolom, satu pemilik ──────────────────────────────────
// Ini satu-satunya penulis `users.email_notifications`. Kalau nanti ada layar
// kedua yang bisa mematikan surel, ia harus memanggil route ini — bukan menulis
// kolomnya sendiri. Dua penulis untuk satu preferensi adalah cara paling halus
// membuat halaman ini dan pengirim surel berbeda pendapat.
//
// Bentuk body-nya **keadaan yang diinginkan** (`{ enabled: boolean }`), bukan
// "toggle". Alasannya sama dengan `POST /api/bookmarks`: satu klik yang terkirim
// dua kali (jaringan buruk, ketukan ganda) pada sebuah toggle mengembalikan
// pengguna ke keadaan semula tanpa satu pun pesan kesalahan.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";

const notificationsSchema = z.object({ enabled: z.boolean() }).strict();

export async function POST(req: Request) {
  const log = requestLogger(req);

  const authz = await requireUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  // Urutannya guard → rate limit → baca body, sama dengan route mutasi lain.
  const limit = await rateLimit(req, "profile/notifications", user.id);
  if (!limit.ok) return limit.response;

  const parsed = await parseJsonBody(req, notificationsSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await db
      .update(users)
      .set({ emailNotifications: parsed.data.enabled })
      .where(eq(users.id, user.id));

    log.info("email_notifications_changed", { enabled: parsed.data.enabled, userId: user.id });

    return NextResponse.json(
      { success: true, enabled: parsed.data.enabled },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.error("email_notifications_update_failed", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
