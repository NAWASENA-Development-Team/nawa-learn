// src/lib/accountData.ts
// ─── Hak subjek data: ekspor dan penghapusan akun (UU PDP) ────────────────────
// Dua operasi yang UU PDP wajibkan bisa dilakukan sendiri oleh pemilik data:
//
//   • "melihat" — seluruh data yang tersimpan tentang seseorang, dalam bentuk
//     yang bisa dibuka tanpa alat khusus (JSON untuk keutuhan, CSV untuk Excel).
//   • "menghapus" — memutus akun dan mengosongkan identitasnya, tanpa perlu
//     mengirim surel ke admin dan tanpa menunggu siapa pun.
//
// Modul ini sengaja **tanpa** impor Clerk, Next.js, atau penyimpanan berkas: yang
// tersisa hanya database. Itu yang membuatnya bisa diuji langsung terhadap
// Postgres sungguhan (PGlite) tanpa jaringan. Pemanggilan Clerk dan penghapusan
// objek blob dilakukan oleh route, di lapisan yang memang tahu soal mereka.
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db/types";
import { ANONYMOUS_DISPLAY_NAME } from "@/lib/accountConstants";
import { POLICY_VERSION } from "@/lib/policy";

// Frasa konfirmasi dan nama pengganti tinggal di `src/lib/accountConstants.ts`,
// bukan di sini. Modul ini mengimpor `@/db/schema` (dan lewat itu drizzle), jadi
// konstanta yang dibaca komponen klien tidak boleh tinggal di sini — satu impor
// dari komponen klien akan menyeret kode server ke bundle browser. Kedua nilai
// itu juga didefinisikan **sekali** di sana; menyalinnya ke sini akan
// mengembalikan bug yang modul itu ada untuk mencegah: frasa di tombol dan frasa
// di skema menyimpang, dan penghapusan akun berhenti bekerja tanpa suara.

// ─── Ekspor ───────────────────────────────────────────────────────────────────

export interface ExportedAccount {
  id: string;
  clerkId: string;
  name: string;
  email: string;
  role: string;
  points: number;
  seasonPoints: number;
  createdAt: string;
  avatarIndex: number | null;
  photoUrl: string | null;
  bio: string | null;
  motto: string | null;
  levelFrame: string | null;
  consentPolicyVersion: string | null;
  consentAcceptedAt: string | null;
}

export interface UserDataExport {
  /** Kapan berkas ini dibuat — bagian dari hak "tahu data apa yang ada". */
  exportedAt: string;
  /** Versi kebijakan yang berlaku saat ekspor, supaya bisa ditelusuri. */
  policyVersion: string;
  /** Catatan singkat, ditulis untuk pembacanya (pelajar), bukan untuk mesin. */
  catatan: string;
  akun: ExportedAccount;
  modul: unknown[];
  soal: unknown[];
  ujian: unknown[];
  poin: unknown[];
  pengajuan: unknown[];
  laporan: unknown[];
  /** Modul yang ditandai "tersimpan" oleh pengguna ini. */
  penanda: unknown[];
  /** Surel transaksional yang pernah/akan dikirim ke akun ini. */
  surel: unknown[];
  /** Hari-hari ketika akun ini menjawab kuis harian. */
  harian: unknown[];
}

const iso = (value: Date | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null;

/**
 * Kumpulkan seluruh data milik satu pengguna.
 *
 * Setiap kolom disebut namanya satu per satu. Sebuah `select()` tanpa daftar
 * kolom akan otomatis ikut membawa kolom baru yang ditambahkan kemudian — dan
 * kolom baru itu tidak pernah dipikirkan untuk keluar dari server. Daftar
 * eksplisit membuat setiap penambahan kolom PII menjadi keputusan sadar.
 */
export async function collectUserData(db: AppDb, userId: string): Promise<UserDataExport> {
  const account = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: {
      id: true,
      clerkId: true,
      name: true,
      email: true,
      role: true,
      points: true,
      seasonPoints: true,
      createdAt: true,
      avatarIndex: true,
      photoUrl: true,
      bio: true,
      motto: true,
      levelFrame: true,
      consentPolicyVersion: true,
      consentAcceptedAt: true,
    },
  });

  if (!account) {
    throw new Error(`accountData: no user row for ${userId}`);
  }

  const [modul, soal, ujian, poin, pengajuan, laporan, penanda, surel, harian] = await Promise.all([
    db.query.modules.findMany({
      where: eq(schema.modules.uploaderId, userId),
      columns: {
        id: true,
        title: true,
        subject: true,
        grade: true,
        category: true,
        contentUrl: true,
        status: true,
        downloads: true,
        createdAt: true,
      },
    }),
    db.query.questions.findMany({
      where: eq(schema.questions.uploaderId, userId),
      columns: {
        id: true,
        questionText: true,
        options: true,
        answerKey: true,
        explanation: true,
        difficulty: true,
        subject: true,
        category: true,
        tags: true,
        status: true,
        createdAt: true,
      },
    }),
    db.query.customExams.findMany({
      where: eq(schema.customExams.authorId, userId),
      columns: {
        id: true,
        title: true,
        subject: true,
        category: true,
        difficulty: true,
        durationMinutes: true,
        createdAt: true,
      },
    }),
    db.query.pointsLog.findMany({
      where: eq(schema.pointsLog.userId, userId),
      columns: { id: true, action: true, delta: true, refId: true, createdAt: true },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
    db.query.submissions.findMany({
      where: eq(schema.submissions.submitterId, userId),
      columns: {
        id: true,
        type: true,
        refId: true,
        status: true,
        feedback: true,
        submittedAt: true,
      },
    }),
    db.query.reports.findMany({
      where: eq(schema.reports.userId, userId),
      columns: { id: true, issueType: true, description: true, status: true, createdAt: true },
    }),
    // What a student chose to save is a statement about that student, even though
    // the module itself belongs to someone else. The module id is enough to
    // identify it; copying the title in would duplicate another user's content
    // into this file for no gain.
    db.query.bookmarks.findMany({
      where: eq(schema.bookmarks.userId, userId),
      columns: { moduleId: true, createdAt: true },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
    // Antrean surel adalah data yang kami simpan tentang akun ini: apa yang
    // dikirim, kapan, dan statusnya. `lastError` sengaja tidak ikut — itu teks
    // galat dari penyedia tentang **pengiriman**, bukan tentang orangnya, dan
    // membawanya ke berkas bukti hanya menambah kebisingan.
    db.query.mailOutbox.findMany({
      where: eq(schema.mailOutbox.toUserId, userId),
      columns: { kind: true, status: true, payload: true, createdAt: true, sentAt: true },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    }),
    // Bukti partisipasi kuis harian: hari-hari ketika akun ini menjawab. Bukan
    // salinan `points_log` — baris ini ada justru ketika poin **tidak** dibayar
    // (jawaban salah tetap tercatat), jadi ia satu-satunya catatan hari aktif.
    db.query.dailyActivity.findMany({
      where: eq(schema.dailyActivity.userId, userId),
      columns: { windowStart: true, createdAt: true },
      orderBy: (table, { desc }) => [desc(table.windowStart)],
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    policyVersion: POLICY_VERSION,
    catatan:
      "Berkas ini berisi semua data yang NAWA-LEARN simpan tentang akunmu. " +
      "Kunci jawaban soal ujian buatanmu ikut di sini karena ini berkasmu sendiri.",
    akun: {
      ...account,
      role: String(account.role),
      createdAt: new Date(account.createdAt).toISOString(),
      consentAcceptedAt: iso(account.consentAcceptedAt),
    },
    modul,
    soal,
    ujian,
    poin,
    pengajuan,
    laporan,
    penanda,
    surel,
    harian,
  };
}

/**
 * Bentuk CSV yang dipilih: satu baris per nilai, dengan kolom
 * `kategori,kolom,nilai`.
 *
 * Alasannya praktis. Ekspor ini berisi sembilan jenis data dengan kolom yang sama
 * sekali berbeda (modul punya `downloads`, soal punya `answerKey`, poin punya
 * `delta`). CSV tidak punya konsep beberapa tabel, jadi pilihannya hanya dua:
 * membuang kolom sampai semuanya muat di satu header — yang berarti ekspornya
 * tidak lengkap — atau memakai bentuk panjang seperti ini, yang bisa dibuka
 * Excel, difilter, dan tidak kehilangan satu nilai pun. Kelengkapan menang atas
 * kerapian di sini, karena ini berkas bukti.
 */
export function exportUserDataCsv(data: UserDataExport): string {
  const rows: string[][] = [["kategori", "kolom", "nilai"]];

  const push = (category: string, key: string, value: unknown) => {
    rows.push([category, key, formatValue(value)]);
  };

  for (const [key, value] of Object.entries(data)) {
    if (key === "akun" || key === "exportedAt" || key === "policyVersion" || key === "catatan") {
      continue;
    }
    if (!Array.isArray(value)) continue;
    for (const [index, item] of value.entries()) {
      for (const [field, fieldValue] of Object.entries(item as Record<string, unknown>)) {
        push(`${key}[${index}]`, field, fieldValue);
      }
    }
  }

  push("akun", "exportedAt", data.exportedAt);
  push("akun", "policyVersion", data.policyVersion);
  for (const [key, value] of Object.entries(data.akun)) {
    push("akun", key, value);
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Satu sel CSV.
 *
 * Selalu dikutip — koma, kutip, dan baris baru di dalam teks soal atau bio akan
 * merusak struktur berkas kalau tidak — dan selalu diperiksa terhadap **CSV
 * injection**: Excel dan Google Sheets mengeksekusi sel yang dimulai dengan
 * `=`, `+`, `-`, `@`, tab, atau CR. Teks soal berasal dari pengguna lain, jadi
 * `=HYPERLINK(...)` bisa ikut terekspor dan berjalan di komputer orang yang
 * membuka berkas ini. Awalan `'` menonaktifkannya tanpa mengubah isi yang
 * terbaca.
 */
export function csvCell(value: string): string {
  const risky = /^[=+\-@\t\r]/.test(value);
  const safe = risky ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

// ─── Penghapusan ──────────────────────────────────────────────────────────────

export interface AccountDeletionReport {
  userId: string;
  /** URL foto lama, supaya route bisa menghapus objeknya dari penyimpanan. */
  photoUrlCleared: string | null;
  deleted: {
    reports: number;
    pointsLog: number;
    bookmarks: number;
    mailOutbox: number;
    dailyActivity: number;
  };
  /** Baris `submissions` yang catatan reviewer-nya dikosongkan. */
  submissionsFeedbackCleared: number;
  /** Ujian buatan pengguna yang namanya diganti menjadi "Anonim". */
  customExamsAnonymized: number;
  completedAt: string;
}

/**
 * Anonimkan akun dan hapus catatan yang memang tentang orangnya.
 *
 * Kenapa **anonim, bukan `DELETE FROM users`**: `modules.uploader_id`,
 * `questions.uploader_id`, dan `submissions.submitter_id` semuanya `NOT NULL`
 * dan menunjuk ke baris ini. Menghapus barisnya akan menghapus karya orang lain
 * yang tidak terkait — modul dan soal tetap dibaca siswa lain — atau gagal
 * karena foreign key. Jadi identitasnya dikosongkan, barisnya tetap ada, dan
 * karyanya berubah menjadi milik "Anonim".
 *
 * Kenapa `clerk_id` diganti tombstone (`deleted:<uuid>`) dan tidak dikosongkan:
 * kolomnya `NOT NULL UNIQUE`, dan sebuah tombstone yang unik menjaga dua
 * properti sekaligus — baris itu tidak bisa lagi dipetakan ke akun mana pun, dan
 * akun Clerk yang baru tidak pernah bisa secara tidak sengaja mengambil alih
 * baris lama ini.
 *
 * Urutan langkahnya berurutan, bukan transaksional: Neon HTTP tidak punya
 * transaksi. Karena itu penghapusan diurutkan dari yang paling penting lebih
 * dulu (laporan dan riwayat poin) dan pelaporannya mengembalikan hitungan
 * sebenarnya, sehingga kegagalan di tengah jalan terlihat di log alih-alih
 * diam-diam menjadi penghapusan sebagian.
 */
export async function deleteAccountData(
  db: AppDb,
  userId: string,
  options: { now?: Date } = {},
): Promise<AccountDeletionReport> {
  const now = options.now ?? new Date();

  const account = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { photoUrl: true },
  });
  if (!account) {
    throw new Error(`accountData: no user row for ${userId}`);
  }

  const deletedReports = await db
    .delete(schema.reports)
    .where(eq(schema.reports.userId, userId))
    .returning({ id: schema.reports.id });

  const deletedPoints = await db
    .delete(schema.pointsLog)
    .where(eq(schema.pointsLog.userId, userId))
    .returning({ id: schema.pointsLog.id });

  // Bookmarks are a reading history in disguise — "this student was preparing
  // for UTBK, in these subjects". They are also the only row this account owns
  // that is purely about the person and not about their work, so they go with
  // the reports and the points rather than being anonymised.
  const deletedBookmarks = await db
    .delete(schema.bookmarks)
    .where(eq(schema.bookmarks.userId, userId))
    .returning({ id: schema.bookmarks.id });

  // Surat yang belum terkirim ikut hilang. Bukan karena isinya tentang orangnya
  // — payload-nya hanya judul lencana, kunci musim, dan angka — tetapi karena
  // baris `pending` akan **tetap dikirim** oleh cron berikutnya ke alamat
  // tombstone `deleted+<uuid>@deleted.nawasena.site`. Panggilan penyedia yang
  // pasti gagal itu tidak berguna, dan antrean kirim bukan arsip yang perlu
  // dipertahankan setelah orangnya meminta dihapus.
  const deletedMail = await db
    .delete(schema.mailOutbox)
    .where(eq(schema.mailOutbox.toUserId, userId))
    .returning({ id: schema.mailOutbox.id });

  // "Orang ini belajar pada hari-hari ini" adalah catatan tentang orangnya, bukan
  // karya yang dibaca siswa lain — kelas yang sama dengan `points_log`, yang juga
  // dihapus dan bukan dianonimkan. Tidak ada pembaca lain: satu-satunya gunanya
  // adalah membuktikan partisipasi **akun ini**, dan akun ini sudah tidak ada.
  const deletedDailyActivity = await db
    .delete(schema.dailyActivity)
    .where(eq(schema.dailyActivity.userId, userId))
    .returning({ windowStart: schema.dailyActivity.windowStart });

  const clearedFeedback = await db
    .update(schema.submissions)
    .set({ feedback: null })
    .where(eq(schema.submissions.submitterId, userId))
    .returning({ id: schema.submissions.id });

  const anonymizedExams = await db
    .update(schema.customExams)
    .set({ authorId: null, authorName: ANONYMOUS_DISPLAY_NAME })
    .where(eq(schema.customExams.authorId, userId))
    .returning({ id: schema.customExams.id });

  // Terakhir, dan paling penting: identitasnya.
  await db
    .update(schema.users)
    .set({
      clerkId: `deleted:${userId}`,
      email: `deleted+${userId}@deleted.nawasena.site`,
      name: ANONYMOUS_DISPLAY_NAME,
      avatarIndex: null,
      photoUrl: null,
      bio: null,
      motto: null,
      levelFrame: null,
      claimedLevelRewards: null,
      lastDailyQuizAt: null,
      points: 0,
      seasonPoints: 0,
      // Kursi Dewan Podium adalah izin, dan izin tidak boleh menempel pada
      // tombstone. Baris ini tidak bisa lagi dipakai masuk (clerk_id-nya
      // tombstone), tetapi membiarkan `role`/`season_role_key` hidup berarti
      // mengandalkan cron berikutnya untuk mencabutnya — dan cron yang belum
      // jalan adalah izin yang masih berdiri.
      role: "student",
      seasonRoleKey: null,
      // Menarik persetujuan sekaligus: tanpa identitas, tidak ada dasar
      // pemrosesan yang tersisa untuk dicatat.
      consentPolicyVersion: null,
      consentAcceptedAt: null,
    })
    .where(eq(schema.users.id, userId));

  return {
    userId,
    photoUrlCleared: account.photoUrl,
    deleted: {
      reports: deletedReports.length,
      pointsLog: deletedPoints.length,
      bookmarks: deletedBookmarks.length,
      mailOutbox: deletedMail.length,
      dailyActivity: deletedDailyActivity.length,
    },
    submissionsFeedbackCleared: clearedFeedback.length,
    customExamsAnonymized: anonymizedExams.length,
    completedAt: now.toISOString(),
  };
}

// ─── Anonimisasi berdasarkan Clerk id (jalur webhook) ─────────────────────────

export type ClerkAnonymiseResult =
  | { found: false }
  | { found: true; userId: string; report: AccountDeletionReport };

/**
 * Anonimisasi akun yang dikenali lewat **Clerk id**, bukan id internal kita.
 *
 * Dipakai webhook `user.deleted`: ketika seseorang menghapus akunnya dari
 * dashboard Clerk (atau lewat aplikasi Clerk lain), tidak ada sesi yang bisa
 * dipakai `requireUser()` dan tidak ada id internal yang kita ketahui. Clerk
 * hanya mengirim satu hal yang pernah kita simpan — `clerk_id`.
 *
 * Idempoten dengan sendirinya: `deleteAccountData` mengganti `clerk_id` menjadi
 * `deleted:<uuid>`, jadi pengiriman ulang event yang sama (Svix mencoba lagi
 * ketika kita membalas 5xx, dan bisa mengirim ganda) tidak menemukan baris apa
 * pun dan mengembalikan `{ found: false }` — bukan kegagalan, dan bukan
 * penghapusan kedua.
 *
 * Mengembalikan `found: false` juga ketika tidak ada baris sama sekali. Itu
 * keadaan normal untuk akun yang dibuat sebelum webhook `user.created` pernah
 * berjalan, dan bukan alasan membalas 5xx ke Clerk.
 */
export async function anonymiseAccountByClerkId(
  db: AppDb,
  clerkId: string,
  options: { now?: Date } = {},
): Promise<ClerkAnonymiseResult> {
  const account = await db.query.users.findFirst({
    where: eq(schema.users.clerkId, clerkId),
    columns: { id: true },
  });

  if (!account) return { found: false };

  const report = await deleteAccountData(db, account.id, options);
  return { found: true, userId: account.id, report };
}
