// db/schema.ts
import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, uniqueIndex, index, check, boolean, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Enums
export const roleEnum = pgEnum("role", ["guest", "student", "contributor", "moderator", "admin"]);
export const difficultyEnum = pgEnum("difficulty", ["mudah", "sedang", "sulit"]);
export const statusEnum = pgEnum("status", ["pending", "approved", "rejected"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: roleEnum("role").default("student").notNull(),
  points: integer("points").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Profile customisation (server-persisted so other users can see them)
  avatarIndex: integer("avatar_index"),        // index into AVATAR_OPTIONS[]
  photoUrl: text("photo_url"),                 // URL in our own Vercel Blob store (M8), not a data-URL
  bio: text("bio"),
  motto: varchar("motto", { length: 200 }),
  // Level reward tracking
  claimedLevelRewards: jsonb("claimed_level_rewards").$type<number[]>(), // levels already rewarded
  levelFrame: varchar("level_frame", { length: 20 }),                    // "wood"|"bronze"|"silver"|"gold"
  // Daily quiz tracking
  lastDailyQuizAt: timestamp("last_daily_quiz_at"),
  // ── Consent (UU PDP) ────────────────────────────────────────────────────────
  // Written in exactly one place: `POST /api/consent/accept`, after the user
  // presses the button on /consent. The Clerk webhook deliberately does *not*
  // write these columns — a webhook cannot know that anyone ticked a box, and
  // recording a consent that was never given is what UU PDP forbids. NULL means
  // the user has never agreed to the current policy, and the dashboard layout
  // refuses to render until it is set. The version is stored next to the
  // timestamp so a later policy change can be told apart from an old consent.
  consentPolicyVersion: varchar("consent_policy_version", { length: 20 }),
  consentAcceptedAt: timestamp("consent_accepted_at"),
  // Seasonal leaderboard
  seasonPoints: integer("season_points").default(0).notNull(),   // points earned in current season only
  seasonResetAt: timestamp("season_reset_at"),                   // when this user's season points were last reset
  // ── Dewan Podium (M16) ──────────────────────────────────────────────────────
  // Asal-usul kursi moderator. `NULL` = diberikan manusia lewat `db:promote`,
  // tidak pernah dicabut otomatis. Berisi kunci musim ("2026-Q4") bila peran
  // `moderator` ini berasal dari tiga teratas papan peringkat.
  //
  // Masa jabatan **tidak** disimpan di sini: kursi sah hanya bila kunci ini sama
  // dengan `getSeasonKey()` saat ini. Jadi kursi berakhir karena kalender
  // berganti, bukan karena ada job yang kebetulan berjalan — cron hanya
  // merapikan `role` agar tidak tertinggal.
  seasonRoleKey: varchar("season_role_key", { length: 16 }),
  // Surel transaksional (M16c). Default true: notifikasi persetujuan adalah
  // bagian dari janji platform, bukan kampanye pemasaran. Diperiksa **saat
  // kirim**, bukan saat enqueue, supaya mematikan setelah baris masuk berlaku.
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  // Maintained by a database trigger, not by application code, so it stays
  // truthful even for updates that forget to set it.
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // The leaderboard orders by season points and pages through the whole table.
  index("users_season_points_idx").on(table.seasonPoints.desc()),
  // M13: the public profile computes "peringkat saya" with
  // `SELECT count(*) FROM users WHERE points > $1`, and the leaderboard does the
  // same over season points. The season index above covers the second; this one
  // covers the first, which previously scanned `users` on every profile view.
  index("users_points_idx").on(table.points.desc()),
  // `avatar_index` is an index into AVATAR_OPTIONS[]; a negative value would
  // render a broken avatar. NULL is allowed (user never picked one).
  check("users_avatar_index_non_negative", sql`${table.avatarIndex} IS NULL OR ${table.avatarIndex} >= 0`),
]);

export const modules = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  grade: varchar("grade", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(), // e.g., UTBK, Olimpiade
  contentUrl: text("content_url").notNull(),
  uploaderId: uuid("uploader_id").references(() => users.id).notNull(),
  status: statusEnum("status").default("pending").notNull(),
  downloads: integer("downloads").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // The library and the moderation queue both filter on status and subject.
  index("modules_status_subject_idx").on(table.status, table.subject),
  // M13: the leaderboard aggregates per uploader (`GROUP BY uploader_id`). The
  // index above is leading on `status`, so it cannot serve that grouping.
  index("modules_uploader_idx").on(table.uploaderId),
]);

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id").references(() => modules.id), // Nullable for standalone questions
  questionText: text("question_text").notNull(),
  options: jsonb("options").notNull(), // e.g., { A: "...", B: "...", C: "...", D: "...", E: "..." }
  answerKey: varchar("answer_key", { length: 10 }).notNull(),
  explanation: text("explanation"),
  difficulty: difficultyEnum("difficulty").notNull(),
  subject: varchar("subject", { length: 100 }),   // e.g. "Matematika"
  category: varchar("category", { length: 100 }),  // e.g. "UTBK", "Olimpiade"
  tags: text("tags").array(),
  uploaderId: uuid("uploader_id").references(() => users.id).notNull(),
  status: statusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // The practice quiz loads approved questions, the daily quiz loads approved
  // daily questions — both filter on these two columns.
  index("questions_status_category_idx").on(table.status, table.category),
  // M13: keyset pagination of the approved-question list is
  // `WHERE status = 'approved' AND (created_at, id) < (cursor)
  //  ORDER BY created_at DESC, id DESC`. This index is exactly that order, so
  // the scan starts at the cursor instead of sorting the whole table.
  index("questions_status_created_idx").on(table.status, table.createdAt.desc(), table.id.desc()),
  // M13: the leaderboard aggregates per uploader (`GROUP BY uploader_id`).
  index("questions_uploader_idx").on(table.uploaderId),
]);

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // 'module' | 'question'
  refId: uuid("ref_id").notNull(), // ID of module or question
  submitterId: uuid("submitter_id").references(() => users.id).notNull(),
  status: statusEnum("status").default("pending").notNull(),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  feedback: text("feedback"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // Only one *pending* submission may exist per content item, so the moderation
  // queue cannot fill up with duplicates (the insert used to be a racy
  // find-then-insert). Approved and rejected rows are deliberately exempt, so a
  // piece of content can be resubmitted after a rejection.
  uniqueIndex("submissions_pending_ref_unique")
    .on(table.type, table.refId)
    .where(sql`${table.status} = 'pending'`),
  // M13: `GET /api/profile/status` reads a user's own submissions newest-first.
  // There was no index on `submitter_id` at all, so that was a sequential scan.
  index("submissions_submitter_created_idx").on(table.submitterId, table.submittedAt.desc()),
]);

// `reviews` was dropped in M5: nothing in src/ ever referenced it. It can come
// back, with proper constraints, once the feature exists. `bookmarks` was
// dropped in M5 for the same reason and has now come back below — the reader and
// the writer exist now, which is exactly the condition M5 set.
//
// ── Bookmarks (M14) ───────────────────────────────────────────────────────────
// Kenapa tabel ini kembali. M5 membuangnya karena tidak ada penulis dan tidak
// ada pembaca di seluruh `src/`. Penggantinya di sisi klien ternyata **lebih
// buruk daripada tidak ada**: satu kunci `localStorage` bernama `nawa_bookmarks`,
// tanpa id pengguna. Di komputer sekolah yang dipakai bergantian, siswa kedua
// membuka perpustakaan dan melihat modul yang disimpan siswa pertama. Itu bug
// kebenaran sekaligus kebocoran privasi kecil, dan keduanya berasal dari satu
// kesalahan: data milik seseorang disimpan di perangkat, bukan di akun.
//
// `uniqueIndex(userId, moduleId)` membuat "tersimpan" menjadi keadaan yang
// mustahil terduplikasi, sehingga tombol bookmark tidak perlu membaca-dulu-lalu-
// menulis (pola yang sudah pernah balapan di `submissions`).
export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  moduleId: uuid("module_id")
    .references(() => modules.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // Idempotensi ada di database, bukan di kode: menekan tombol dua kali tidak
  // bisa menghasilkan dua baris, berapa pun jumlah permintaan yang balapan.
  uniqueIndex("bookmarks_user_module_unique").on(table.userId, table.moduleId),
  // `GET /api/bookmarks` membaca seluruh simpanan satu pengguna.
  index("bookmarks_user_idx").on(table.userId),
]);

export const customExams = pgTable("custom_exams", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  difficulty: varchar("difficulty", { length: 50 }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  // Array of { id, text, options: {A,B,C,D,E}, answerKey }
  questions: jsonb("questions").notNull(),
  authorId: uuid("author_id").references(() => users.id),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // M13: `/api/exams/list` is keyset-paginated newest-first. Without this the
  // sort had to happen in memory over the whole table before `LIMIT` applied.
  index("custom_exams_created_idx").on(table.createdAt.desc(), table.id.desc()),
]);

export const pointsLog = pgTable("points_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  delta: integer("delta").notNull(), // Positive or negative
  refId: uuid("ref_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // Idempotency lives in the database, not in application code: a user can only
  // be credited once per (action, ref). Rows with a NULL ref are unaffected,
  // because Postgres treats NULLs as distinct in a unique index.
  //   quiz_answer    + refId = questionId  → one attempt per question, ever
  //   module_approved+ refId = moduleId    → a module can only pay out once
  uniqueIndex("points_log_user_action_ref_unique").on(table.userId, table.action, table.refId),
]);

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  issueType: varchar("issue_type", { length: 100 }).notNull(), // 'bug', 'content', 'other'
  description: text("description").notNull(),
  status: statusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // M13: `GET /api/profile/status` lists a user's own reports newest-first.
  index("reports_user_created_idx").on(table.userId, table.createdAt.desc()),
]);

// ── Audit log (M12) ───────────────────────────────────────────────────────────
// Siapa melakukan apa, terhadap apa. Tabel ini menjawab pertanyaan yang tidak
// bisa dijawab `points_log`: `points_log` mencatat **poin** (dan hanya itu),
// sementara keputusan moderasi yang tidak memberi poin — menolak soal,
// menurunkan konten — tidak meninggalkan jejak apa pun selain `reviewer_id` di
// baris pengajuan yang bisa ditimpa keputusan berikutnya.
//
// `before`/`after` sengaja hanya berisi **id, status, peran, dan angka** — bukan
// baris utuh. Sebuah audit log yang menyalin baris `users` akan menjadi salinan
// PII kedua yang harus ikut diekspor dan dihapus; bentuk sempit ini membuat itu
// mustahil secara struktural, bukan sekadar konvensi.
//
// `actor_id` menunjuk ke baris `users` dan **tidak** ikut dikosongkan saat akun
// dianonimkan (`deleteAccountData`): barisnya tetap ada dengan nama "Anonim",
// jadi jejak tindakan administratif tetap utuh sementara tidak lagi menunjuk
// siapa pun. NULL berarti tindakan sistem/CLI (mis. `npm run db:promote`).
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id),
  action: varchar("action", { length: 64 }).notNull(),   // 'content.approve' | 'content.reject' | 'user.role_change'
  entity: varchar("entity", { length: 64 }).notNull(),   // 'module' | 'question' | 'submission' | 'user'
  entityId: uuid("entity_id"),
  before: jsonb("before").$type<Record<string, unknown>>(),
  after: jsonb("after").$type<Record<string, unknown>>(),
  // `clock_timestamp()`, bukan `now()`. Ini bukan selera: `now()` mengembalikan
  // waktu **mulai transaksi**, jadi dua baris audit yang ditulis dalam satu
  // transaksi mendapat stempel waktu yang identik dan urutannya menjadi tidak
  // bisa ditentukan. Untuk tabel yang gunanya justru "apa yang terjadi lebih
  // dulu", itu kehilangan informasi. `clock_timestamp()` membaca jam sungguhan
  // per pernyataan, sehingga urutan tetap benar berapa pun batas transaksinya.
  // Bug ini tertangkap CI, bukan tinjauan kode (lihat catatan M12).
  createdAt: timestamp("created_at").default(sql`clock_timestamp()`).notNull(),
}, (table) => [
  // "Riwayat konten ini" dan "riwayat moderator ini" adalah dua pertanyaan yang
  // benar-benar ditanyakan saat menyelidiki sesuatu.
  index("audit_log_entity_idx").on(table.entity, table.entityId),
  index("audit_log_actor_created_idx").on(table.actorId, table.createdAt.desc()),
  index("audit_log_created_idx").on(table.createdAt.desc()),
]);

// ── Dewan Podium (M16) ────────────────────────────────────────────────────────
// Empat tabel di bawah ini adalah *arsip* dan *bukti*, bukan sumber izin.
// Satu-satunya sumber izin tetap `users.role`; kursi musim dikenali dari
// `users.season_role_key` + kunci musim berjalan. Karena itu tidak ada tabel
// "seat" yang harus dijaga konsisten dengan papan peringkat.

/**
 * Arsip podium satu musim.
 *
 * Ditulis **sebelum** reset poin (angkanya hilang setelah rollover), dan
 * `PRIMARY KEY (season_key, place)` membuat pengarsipan idempoten: cron yang
 * berjalan dua kali tidak bisa menulis podium yang sama dengan isi berbeda.
 * Tabel ini tidak pernah dibaca untuk memutuskan izin — hanya untuk laporan dan
 * surel "hasil musim".
 */
export const seasonPodium = pgTable("season_podium", {
  seasonKey: varchar("season_key", { length: 16 }).notNull(),
  place: integer("place").notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.seasonKey, table.place] }),
  check("season_podium_place_range", sql`${table.place} BETWEEN 1 AND 3`),
]);

/**
 * Satu soal kurasi per jendela harian.
 *
 * Sebelum M16 `api/questions/daily-create` menyisipkan soal tanpa memeriksa apa
 * pun, jadi tiga moderator yang membuat soal pukul 03:00 menghasilkan tiga soal.
 * `window_start` sebagai primary key membuat "satu hari, satu slot" menjadi
 * kenyataan di database, bukan harapan di kode. `author_id` NULL berarti slot
 * diisi fallback cron dari bank soal.
 */
export const dailyQuizSlot = pgTable("daily_quiz_slot", {
  windowStart: timestamp("window_start").primaryKey(),
  questionId: uuid("question_id").references(() => questions.id).notNull(),
  authorId: uuid("author_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Bukti partisipasi kuis harian, terpisah dari buku besar poin.
 *
 * `daily-claim` dulu menyimpulkan "sudah mengerjakan" dari baris `points_log`
 * `quiz_answer`. Baris itu hanya ada bila poin benar-benar dibayarkan, dan
 * indeks unik membuangnya bila soal itu pernah dijawab — jadi pengguna paling
 * rajin justru yang pertama kehilangan +25, permanen.
 *
 * Prinsipnya umum: **jangan menyimpulkan sebuah kejadian dari catatan
 * pembayarannya.** `quiz/submit` menulis baris di sini setiap kali soal kuis
 * harian dikirim, dibayar maupun tidak.
 */
export const dailyActivity = pgTable("daily_activity", {
  userId: uuid("user_id").references(() => users.id).notNull(),
  windowStart: timestamp("window_start").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.windowStart] }),
]);

/**
 * Outbox surel transaksional.
 *
 * Alamat surel **tidak** disimpan di sini: hanya `to_user_id`, dan alamatnya
 * dibaca dari `users.email` saat kirim. Satu salinan PII, bukan dua — alasan
 * yang sama dengan `AuditSnapshot` yang hanya menyimpan skalar.
 *
 * `dedupe_key` unik adalah idempotensinya: approve yang dikirim ulang (klik
 * ganda, retry jaringan) tidak menghasilkan dua surel.
 */
export const mailOutbox = pgTable("mail_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  toUserId: uuid("to_user_id").references(() => users.id).notNull(),
  kind: varchar("kind", { length: 40 }).notNull(),
  dedupeKey: varchar("dedupe_key", { length: 120 }).notNull().unique(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  status: varchar("status", { length: 16 }).default("pending").notNull(), // pending|sent|failed|skipped
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
}, (table) => [
  // Cron mengosongkan antrean percobaan ulang dengan `WHERE status='pending'`.
  index("mail_outbox_pending_idx").on(table.status, table.createdAt),
]);