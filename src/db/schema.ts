// db/schema.ts
import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, uniqueIndex, index, check } from "drizzle-orm/pg-core";
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
  photoUrl: text("photo_url"),                 // base64 data-URL (Top-10 perk)
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
  // Maintained by a database trigger, not by application code, so it stays
  // truthful even for updates that forget to set it.
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // The leaderboard orders by season points and pages through the whole table.
  index("users_season_points_idx").on(table.seasonPoints.desc()),
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
]);

// `reviews` and `bookmarks` were dropped in M5: neither table was referenced
// anywhere in src/ (the bookmark button is client-side state, not this table).
// They can come back — with proper constraints — once those features exist.

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
});

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
});