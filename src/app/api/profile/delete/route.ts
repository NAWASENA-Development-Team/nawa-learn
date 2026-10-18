// src/app/api/profile/delete/route.ts
// ─── "Hapus akun saya" (UU PDP) ───────────────────────────────────────────────
// Ini pintu satu arah. Tiga hal yang membuatnya layak dipercaya:
//
//   1. Konfirmasi bukan sekadar klik: klien harus mengirim frasa
//      `DELETE_ACCOUNT_CONFIRMATION` dan skemanya `.strict()`, jadi sebuah body
//      `{}` atau body dengan field karangan adalah 400 — bukan penghapusan.
//   2. Identitas yang dihapus adalah identitas **pemanggil**, diambil dari
//      sesinya sendiri. Tidak ada `userId` di body, jadi route ini tidak bisa
//      dipakai untuk menghapus akun orang lain.
//   3. Urutannya jujur: data lokal dianonimkan lebih dulu, akun Clerk dihapus
//      terakhir. Kalau langkah terakhir gagal, pengguna sudah tidak punya data
//      pribadi di database kami dan kegagalannya tercatat di log — kebalikannya
//      (akun Clerk hilang tetapi datanya masih ada) adalah kegagalan yang jauh
//      lebih buruk, karena tidak ada lagi cara memperbaikinya.
import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";
import { isOwnStorageUrl, deleteObject } from "@/lib/storage";
import { DELETE_ACCOUNT_CONFIRMATION } from "@/lib/accountConstants";
import { deleteAccountData } from "@/lib/accountData";

export const maxDuration = 30;

/**
 * `.strict()` + literal: satu-satunya body yang diterima adalah frasa konfirmasi
 * yang benar. Tidak ada field lain yang bisa "menambah" sesuatu ke penghapusan.
 */
const deleteSchema = z
  .object({
    confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION),
  })
  .strict();

export async function POST(req: Request) {
  const log = requestLogger(req);

  const authz = await requireUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  const limit = await rateLimit(req, "profile/delete", user.id);
  if (!limit.ok) return limit.response;

  const parsed = await parseJsonBody(req, deleteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const report = await deleteAccountData(db, user.id);

    // Objek blob dihapus setelah barisnya dikosongkan, dan kegagalannya tidak
    // fatal: URL-nya sudah tidak tersimpan di mana pun, jadi paling buruk
    // tersisa satu berkas yatim di penyimpanan (utang yang sudah dicatat).
    if (report.photoUrlCleared && isOwnStorageUrl(report.photoUrlCleared)) {
      try {
        await deleteObject(report.photoUrlCleared);
      } catch (error) {
        log.warn("failed to delete account photo object", { error, userId: user.id });
      }
    }

    // Akun Clerk dihapus terakhir. `deleted:` sudah menggantikan clerk_id di
    // baris kami, jadi pemanggilan ini tidak lagi bisa "menemukan" barisnya.
    let clerkDeleted = true;
    try {
      await (await clerkClient()).users.deleteUser(user.clerkId);
    } catch (error) {
      clerkDeleted = false;
      // Alertable: data pribadi sudah hilang, tetapi akun masuknya masih hidup.
      log.error("account_deletion_clerk_failed", { error, userId: user.id });
    }

    log.info("account_deleted", {
      userId: user.id,
      reportsDeleted: report.deleted.reports,
      pointsDeleted: report.deleted.pointsLog,
      bookmarksDeleted: report.deleted.bookmarks,
      // Not `clerkDeleted`: the logger redacts any key containing "clerk" (it is
      // a credential marker), which would turn the one field an operator needs
      // into `"[redacted]"`. The failure path is still distinguishable by the
      // `account_deletion_clerk_failed` line above, but a redacted boolean in a
      // success line reads like a bug rather than a decision.
      signInAccountDeleted: clerkDeleted,
    });

    return NextResponse.json(
      { ok: true, clerkDeleted, completedAt: report.completedAt },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Deletion failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
