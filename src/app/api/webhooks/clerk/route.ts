// src/app/api/webhooks/clerk/route.ts
// ─── Sinkronisasi pengguna Clerk → tabel `users` ──────────────────────────────
// Jalur normal yang membuat baris `users`. Tugasnya sempit dan sengaja begitu:
// memastikan setiap akun Clerk punya padanannya di database kami, dengan nama
// tampilan dan surel yang benar.
//
// Yang **tidak** dikerjakan di sini: mencatat persetujuan kebijakan. Sebuah
// webhook tidak tahu apakah pemilik akun benar-benar mencentang apa pun — ia
// hanya tahu Clerk membuat sebuah akun. Menulis `consent_accepted_at` dari sini
// berarti mencatat persetujuan yang tidak pernah diberikan, dan itu justru hal
// yang UU PDP melarang. Persetujuan dicatat di satu tempat saja:
// `POST /api/consent/accept`, setelah pengguna menekan tombolnya sendiri.
//
// Yang dicatat di sini hanya **sinyal**: bila dashboard Clerk menyalakan
// persyaratan persetujuan, Clerk mengirim `legal_accepted_at`, dan nilainya
// dilaporkan ke log sebagai bukti tambahan. Nilai itu tidak pernah disimpan
// sebagai persetujuan versi kebijakan kami, karena Clerk tidak tahu versi kami.
import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requestLogger } from "@/lib/logger";
import { ensureUserRow, resolveDisplayName, type ClerkProfileLike } from "@/lib/ensureUser";
import { anonymiseAccountByClerkId } from "@/lib/accountData";
import { recordAudit } from "@/lib/auditLog";
import { deleteObject, isOwnStorageUrl } from "@/lib/storage";

/**
 * Bentuk `data` di dalam event Clerk, diketik secara struktural.
 *
 * Clerk memakai `snake_case` di payload webhook dan `camelCase` di SDK-nya;
 * modul `ensureUser` memilih `camelCase` (itu yang dipakai `currentUser()`),
 * jadi pemetaannya dilakukan di sini, di satu tempat, alih-alih menyalin logika
 * nama tampilan ke dua bentuk yang berbeda.
 */
interface ClerkWebhookUser {
  id: string;
  email_addresses?: { email_address: string }[];
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  external_accounts?: { provider: string }[];
  legal_accepted_at?: string | null;
}

function toProfileLike(data: ClerkWebhookUser): ClerkProfileLike {
  return {
    id: data.id,
    emailAddresses: data.email_addresses?.map((address) => ({
      emailAddress: address.email_address,
    })),
    username: data.username,
    firstName: data.first_name,
    lastName: data.last_name,
    externalAccounts: data.external_accounts?.map((account) => ({
      provider: account.provider,
    })),
  };
}

export async function POST(req: Request) {
  const log = requestLogger(req);
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // Gagal keras, bukan diam-diam: tanpa rahasia ini tanda tangan Svix tidak
    // bisa diverifikasi, dan sebuah endpoint yang menerima payload tanpa
    // verifikasi berarti siapa pun bisa membuat baris `users` palsu.
    log.error("clerk_webhook_misconfigured", { reason: "CLERK_WEBHOOK_SECRET is not set" });
    return new Response("Error: webhook secret is not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Error: Missing Svix headers", { status: 400 });
  }

  // Badan mentah, bukan hasil `JSON.stringify(await req.json())`. Svix menandatangani
  // byte-nya, bukan maknanya: mengurai lalu menyusun ulang JSON bergantung pada
  // urutan kunci dan spasi yang kebetulan sama. `req.text()` tidak menebak.
  const rawBody = await req.text();

  let evt: WebhookEvent;
  try {
    evt = new Webhook(webhookSecret).verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    log.error("clerk_webhook_invalid_signature", { error: err });
    return new Response("Error: Invalid signature", { status: 400 });
  }

  const data = evt.data as unknown as ClerkWebhookUser;

  try {
    if (evt.type === "user.created") {
      // `ensureUserRow` sengaja mencocokkan lewat surel lebih dulu: saat berpindah
      // dari instance Clerk dev ke produksi, barisnya sudah ada dengan `clerk_id`
      // lama, dan membuat baris kedua akan memecah riwayat poin pengguna itu.
      const user = await ensureUserRow(toProfileLike(data));

      log.info("clerk_user_created", { userId: user?.id });

      if (data.legal_accepted_at) {
        // Bukti tambahan dari dashboard Clerk. Tidak disimpan sebagai
        // persetujuan versi kami — lihat catatan di kepala berkas ini.
        log.info("clerk_legal_consent_seen", { userId: user?.id });
      }

      return new Response("User successfully synced to Neon", { status: 200 });
    }

    if (evt.type === "user.updated") {
      const profile = toProfileLike(data);

      // Pencocokan lewat `clerk_id`, bukan surel: siswa yang mengganti surelnya
      // akan menghasilkan baris kedua bila kita mencocokkan dengan surel baru.
      const [updated] = await db
        .update(users)
        .set({ name: resolveDisplayName(profile), email: profile.emailAddresses?.[0]?.emailAddress ?? `${data.id}@user.nawasena.site` })
        .where(eq(users.clerkId, data.id))
        .returning({ id: users.id });

      // Baris yang belum ada (webhook `user.created` hilang, atau migrasi
      // instance) dibuat di sini alih-alih dibiarkan tanpa padanan.
      if (!updated) {
        const created = await ensureUserRow(profile);
        log.info("clerk_user_updated_created_missing_row", { userId: created?.id });
      }

      return new Response("User updated in Neon", { status: 200 });
    }

    if (evt.type === "user.deleted") {
      // Akun yang dihapus dari dashboard Clerk tidak pernah melewati
      // `/api/profile/delete`: tidak ada sesi, tidak ada id internal. Satu-satunya
      // hal yang Clerk kirim dan pernah kita simpan adalah `clerk_id` — jadi
      // anonimisasinya dicari lewat itu.
      const result = await anonymiseAccountByClerkId(db, data.id);

      if (!result.found) {
        // Bukan kegagalan. Ini artinya salah satu dari: Svix mengirim ulang event
        // yang sama, akun dibuat sebelum webhook `user.created` pernah berjalan,
        // atau barisnya sudah dianonimkan (clerk_id-nya kini `deleted:<uuid>`).
        // Membalas 5xx akan membuat Svix mencoba lagi selamanya untuk sesuatu
        // yang tidak akan berubah, jadi jawabannya 200.
        log.info("clerk_user_deleted_no_row", { svixId });
        return new Response("No matching user row; nothing to anonymise", { status: 200 });
      }

      // Objek blob dihapus setelah barisnya dikosongkan, dan kegagalannya tidak
      // fatal: URL-nya sudah tidak tersimpan di mana pun. Pola yang sama dengan
      // `/api/profile/delete`.
      if (result.report.photoUrlCleared && isOwnStorageUrl(result.report.photoUrlCleared)) {
        try {
          await deleteObject(result.report.photoUrlCleared);
        } catch (error) {
          log.warn("failed to delete deleted-account photo object", { error, userId: result.userId });
        }
      }

      // Jejak penghapusan itu sendiri. `actorId: null` karena pelakunya adalah
      // pemilik akun, yang justru sedang berhenti menjadi subjek data di sini.
      await recordAudit(db, {
        actorId: null,
        action: "user.anonymise",
        entity: "user",
        entityId: result.userId,
        after: { source: "clerk_webhook", completedAt: result.report.completedAt },
      }, { log });

      log.info("clerk_user_deleted_anonymised", {
        userId: result.userId,
        reportsDeleted: result.report.deleted.reports,
        pointsDeleted: result.report.deleted.pointsLog,
        bookmarksDeleted: result.report.deleted.bookmarks,
        mailDeleted: result.report.deleted.mailOutbox,
        dailyActivityDeleted: result.report.deleted.dailyActivity,
        submissionsFeedbackCleared: result.report.submissionsFeedbackCleared,
      });

      return new Response("User anonymised in Neon", { status: 200 });
    }
  } catch (error) {
    log.error("clerk_webhook_db_error", { error, eventType: evt.type });
    return new Response("Error syncing user to database", { status: 500 });
  }

  return new Response("Webhook received", { status: 200 });
}
