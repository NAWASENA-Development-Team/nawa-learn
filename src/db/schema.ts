// db/schema.ts
import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";

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
});

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
});

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id").references(() => modules.id), // Nullable for standalone questions
  questionText: text("question_text").notNull(),
  options: jsonb("options").notNull(), // e.g., { A: "...", B: "...", C: "...", D: "...", E: "..." }
  answerKey: varchar("answer_key", { length: 10 }).notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  subject: varchar("subject", { length: 100 }),   // e.g. "Matematika"
  category: varchar("category", { length: 100 }),  // e.g. "UTBK", "Olimpiade"
  tags: text("tags").array(),
  uploaderId: uuid("uploader_id").references(() => users.id).notNull(),
  status: statusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // 'module' | 'question'
  refId: uuid("ref_id").notNull(), // ID of module or question
  submitterId: uuid("submitter_id").references(() => users.id).notNull(),
  status: statusEnum("status").default("pending").notNull(),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  feedback: text("feedback"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id").references(() => modules.id).notNull(),
  reviewerId: uuid("reviewer_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1 to 5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  questionId: uuid("question_id").references(() => questions.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pointsLog = pgTable("points_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  delta: integer("delta").notNull(), // Positive or negative
  refId: uuid("ref_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});