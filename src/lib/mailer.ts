// src/lib/mailer.ts
// ─── Surel transaksional: outbox, pengiriman, dan kurasnya ────────────────────
// Satu aturan di atas semua aturan lain di berkas ini: **surel tidak pernah
// menggagalkan aksi yang memicunya**. Persetujuan modul sudah terjadi ketika
// surelnya gagal; membatalkan persetujuan karena penyedia surel sedang down
// adalah menukar kebenaran data dengan kerapian notifikasi.
//
// Karena itu bentuknya outbox:
//   - `enqueueMail()` menulis satu baris `mail_outbox`, lalu **mencoba** kirim
//     segera (best effort). Kalau berhasil, baris menjadi `sent` pada detik itu
//     juga — notifikasi tidak menunggu cron 24 jam.
//   - Kalau gagal, baris tetap `pending` dan `sendPendingMail()` mengurasnya pada
//     jadwal berikutnya. Outbox adalah antrean **percobaan ulang**, bukan penunda.
//
// `fetch` biasa, bukan SDK. Alasan yang sama dengan `src/lib/storage.ts`: SDK
// menyembunyikan timeout dan kebijakan retry-nya sendiri, dan sebuah permintaan
// tanpa batas waktu di dalam route handler adalah cara termudah membuat satu
// penyedia surel yang lambat terlihat seperti seluruh aplikasi yang lambat.
//
// Alamat surel **tidak** disimpan di outbox. Hanya `to_user_id`; alamatnya dibaca
// dari `users.email` saat kirim. Satu salinan PII, bukan dua — alasan yang sama
// dengan `AuditSnapshot` yang hanya menyimpan skalar.

import { and, asc, eq, lt, sql } from "drizzle-orm";
import { mailOutbox, users } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { logger as rootLogger } from "@/lib/logger";

/** Batas waktu satu permintaan kirim. */
const SEND_TIMEOUT_MS = 10_000;

/** Batas jumlah surel yang dikuras dalam satu putaran cron. */
const DRAIN_BATCH = 50;

/** Surel yang lebih tua dari ini tidak dicoba lagi — kegagalannya sudah final. */
const MAX_ATTEMPTS = 5;

export type MailKind =
  | "submission_approved"
  | "submission_rejected"
  | "badge_unlocked"
  | "season_result"
  | "seat_granted"
  | "seat_revoked";

export type MailPayload = Record<string, string | number>;

/** Nama pengirim. Alamatnya dari `MAIL_FROM`, nama ini hanya awalan yang enak dibaca. */
const SENDER_NAME = "NAWA-LEARN";

type MailLog = Pick<typeof rootLogger, "info" | "warn" | "error">;

/** Satu baris outbox yang siap dikirim. */
type OutboxRow = {
  id: string;
  toUserId: string;
  kind: string;
  payload: unknown;
};

/**
 * Isi surel, ditulis di satu tempat.
 *
 * Teks biasa **dan** HTML: beberapa klien surel sekolah masih menampilkan teks
 * biasa saja, dan surel HTML yang hanya berisi satu paragraf tanpa versi teks
 * adalah surel yang lebih sering masuk spam.
 */
export function renderMail(
  kind: string,
  payload: MailPayload,
): { subject: string; text: string; html: string } | null {
  const str = (key: string): string => String(payload[key] ?? "");
  const esc = (value: string): string =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const wrap = (title: string, paragraphs: string[]): string =>
    `<div style="font-family:system-ui,sans-serif;line-height:1.6;color:#18181b">` +
    `<h2 style="font-size:18px;margin:0 0 12px">${esc(title)}</h2>` +
    paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join("") +
    `<p style="margin:24px 0 0;font-size:12px;color:#71717a">NAWA-LEARN · SMAN 2 Jonggol</p>` +
    `</div>`;

  switch (kind) {
    case "submission_approved": {
      const title = str("title") || "kirimanmu";
      const points = payload.points === undefined ? "" : ` (+${str("points")} V-Points)`;
      const subject = `Kirimanmu disetujui: ${title}`;
      const body = [
        `Kabar baik — ${title} sudah disetujui dan sekarang bisa dibaca siswa lain${points}.`,
        "Terima kasih sudah berbagi.",
      ];
      return { subject, text: `${subject}\n\n${body.join("\n\n")}`, html: wrap(subject, body) };
    }

    case "submission_rejected": {
      const title = str("title") || "kirimanmu";
      const reason = str("reason");
      const subject = `Kirimanmu belum bisa diterbitkan: ${title}`;
      const body = [
        `Kirimanmu belum bisa diterbitkan. Kamu masih bisa memperbaikinya dan mengirim ulang.`,
        ...(reason ? [`Catatan peninjau: ${reason}`] : []),
      ];
      return { subject, text: `${subject}\n\n${body.join("\n\n")}`, html: wrap(subject, body) };
    }

    case "badge_unlocked": {
      const badge = str("badgeTitle") || "lencana baru";
      const subject = `Lencana baru terbuka: ${badge}`;
      const body = [
        `Kamu baru saja membuka lencana "${badge}". Buka halaman profil untuk melihatnya.`,
      ];
      return { subject, text: `${subject}\n\n${body.join("\n\n")}`, html: wrap(subject, body) };
    }

    case "season_result": {
      const season = str("seasonKey");
      const place = str("place");
      const points = str("points");
      const subject = `Hasil musim ${season}: peringkat ${place}`;
      const body = [
        `Musim ${season} sudah selesai. Kamu finis di peringkat ${place} dengan ${points} V-Points musim ini.`,
        "Papan peringkat musim baru sudah dimulai dari nol. Poin seumur hidupmu tidak berkurang.",
      ];
      return { subject, text: `${subject}\n\n${body.join("\n\n")}`, html: wrap(subject, body) };
    }

    case "seat_granted": {
      const season = str("seasonKey");
      const subject = `Kamu duduk di Dewan Podium musim ${season}`;
      const body = [
        `Tiga teratas papan peringkat musim ${season} memegang kursi moderasi sampai musim ini berakhir.`,
        "Sebagai pemegang kursi, kamu dapat meninjau kiriman modul dan soal, serta menulis soal Kuis Harian. Kamu tidak dapat mengunggah modul atau soal selama menjabat, dan tidak dapat meninjau kiriman sepuluh besar.",
        "Kursi berakhir dengan sendirinya saat musim berganti.",
      ];
      return { subject, text: `${subject}\n\n${body.join("\n\n")}`, html: wrap(subject, body) };
    }

    case "seat_revoked": {
      const season = str("seasonKey");
      const reason = str("reason");
      const subject = `Kursi Dewan Podium musim ${season} berakhir`;
      const body = [
        reason === "displaced"
          ? "Kamu tidak lagi berada di tiga teratas papan peringkat musim ini, jadi kursi moderasimu berakhir."
          : "Musim ini sudah berganti, jadi kursi moderasimu berakhir dengan sendirinya.",
        "Poin seumur hidupmu tidak berkurang. Kalau kamu kembali ke tiga teratas, kursinya kembali.",
      ];
      return { subject, text: `${subject}\n\n${body.join("\n\n")}`, html: wrap(subject, body) };
    }

    default:
      return null;
  }
}

/** Apakah penyedia surel dikonfigurasi. Dibaca saat kirim, bukan saat enqueue. */
function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/**
 * Kirim satu baris outbox.
 *
 * Mengembalikan status akhirnya. Tidak pernah melempar: setiap kegagalan
 * (penyedia mati, alamat kosong, pengguna mematikan notifikasi) adalah keadaan
 * normal yang harus tercatat, bukan pengecualian yang merambat ke pemanggil.
 */
async function deliver(
  db: AppDb,
  row: OutboxRow,
  log: MailLog,
): Promise<"sent" | "failed" | "skipped"> {
  const payload =
    row.payload && typeof row.payload === "object" ? (row.payload as MailPayload) : {};

  // Dibaca saat kirim, bukan saat enqueue: pengguna yang mematikan notifikasi
  // setelah baris masuk tidak boleh tetap dikirimi.
  const recipient = await db.query.users.findFirst({
    where: eq(users.id, row.toUserId),
    columns: { email: true, emailNotifications: true },
  });

  if (!recipient || !recipient.email || !recipient.emailNotifications) {
    await db
      .update(mailOutbox)
      .set({ status: "skipped", lastError: "recipient_opted_out_or_missing", sentAt: new Date() })
      .where(eq(mailOutbox.id, row.id));
    return "skipped";
  }

  if (!isMailConfigured()) {
    // Bukan kegagalan yang perlu dicoba ulang: penyedia memang belum dipasang.
    // Tetap `skipped`, dan aksi pemanggil tetap sukses.
    log.warn("mail_not_configured", { kind: row.kind, outboxId: row.id });
    await db
      .update(mailOutbox)
      .set({ status: "skipped", lastError: "mail_not_configured" })
      .where(eq(mailOutbox.id, row.id));
    return "skipped";
  }

  const rendered = renderMail(row.kind, payload);
  if (!rendered) {
    await db
      .update(mailOutbox)
      .set({ status: "skipped", lastError: "unknown_mail_kind" })
      .where(eq(mailOutbox.id, row.id));
    return "skipped";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: `${SENDER_NAME} <${process.env.MAIL_FROM}>`,
        to: [recipient.email],
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Isi respons penyedia tidak pernah masuk log: ia bisa memuat alamat
      // surel penerima. Hanya status HTTP-nya yang dicatat.
      await db
        .update(mailOutbox)
        .set({
          status: "failed",
          attempts: sql`${mailOutbox.attempts} + 1`,
          lastError: `http_${response.status}`,
        })
        .where(eq(mailOutbox.id, row.id));
      log.warn("mail_send_failed", { kind: row.kind, status: response.status });
      return "failed";
    }

    await db
      .update(mailOutbox)
      .set({ status: "sent", sentAt: new Date(), lastError: null })
      .where(eq(mailOutbox.id, row.id));
    return "sent";
  } catch (error) {
    await db
      .update(mailOutbox)
      .set({
        status: "failed",
        attempts: sql`${mailOutbox.attempts} + 1`,
        lastError: error instanceof Error ? error.name : "send_failed",
      })
      .where(eq(mailOutbox.id, row.id));
    log.error("mail_send_failed", error);
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Catat satu surel ke outbox, lalu coba kirim segera.
 *
 * Mengembalikan `true` bila barisnya baru (bukan duplikat). Kegagalan apa pun
 * ditelan dan dicatat — pemanggil tidak boleh perlu `try/catch` untuk sebuah
 * notifikasi.
 */
export async function enqueueMail(
  db: AppDb,
  entry: { toUserId: string; kind: MailKind; dedupeKey: string; payload?: MailPayload },
  log: MailLog = rootLogger,
): Promise<boolean> {
  try {
    const inserted = await db
      .insert(mailOutbox)
      .values({
        toUserId: entry.toUserId,
        kind: entry.kind,
        dedupeKey: entry.dedupeKey,
        payload: entry.payload ?? {},
      })
      .onConflictDoNothing()
      .returning({
        id: mailOutbox.id,
        toUserId: mailOutbox.toUserId,
        kind: mailOutbox.kind,
        payload: mailOutbox.payload,
      });

    const row = inserted[0];
    if (!row) return false; // sudah pernah dicatat; satu kejadian, satu surel

    await deliver(db, row, log);
    return true;
  } catch (error) {
    log.error("mail_enqueue_failed", error);
    return false;
  }
}

/**
 * Kuras antrean percobaan ulang.
 *
 * Dipanggil cron. Hanya menyentuh baris `pending`/`failed` yang belum melewati
 * `MAX_ATTEMPTS`, supaya satu alamat yang selalu ditolak tidak dicoba selamanya.
 */
export async function sendPendingMail(
  db: AppDb,
  log: MailLog = rootLogger,
  limit: number = DRAIN_BATCH,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const rows = await db
    .select({
      id: mailOutbox.id,
      toUserId: mailOutbox.toUserId,
      kind: mailOutbox.kind,
      payload: mailOutbox.payload,
    })
    .from(mailOutbox)
    .where(
      and(
        sql`${mailOutbox.status} IN ('pending', 'failed')`,
        lt(mailOutbox.attempts, MAX_ATTEMPTS),
      ),
    )
    .orderBy(asc(mailOutbox.createdAt))
    .limit(limit);

  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    const outcome = await deliver(db, row, log);
    result[outcome] += 1;
  }
  return result;
}
