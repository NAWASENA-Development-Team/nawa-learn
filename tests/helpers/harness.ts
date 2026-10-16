// tests/helpers/harness.ts
// Integration-test plumbing: an in-process Postgres and small seed helpers.
//
// PGlite is real Postgres compiled to WASM, so integration tests get real SQL,
// real constraints and real indexes — with no Docker, no DATABASE_URL and no
// network. That matters here because the security property under test (quiz
// scoring is idempotent) lives in the database: a mocked Drizzle would prove
// nothing.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/** A brand-new database with the versioned migrations applied. */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "src/db/migrations" });
  return db;
}

let counter = 0;

/** Unique-per-call ids, so one test can never collide with another. */
export function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function seedUser(
  db: TestDb,
  overrides: Partial<{
    clerkId: string;
    name: string;
    role: "guest" | "student" | "contributor" | "moderator" | "admin";
    points: number;
  }> = {},
) {
  const clerkId = overrides.clerkId ?? uniqueId("clerk");
  const [row] = await db
    .insert(schema.users)
    .values({
      clerkId,
      name: overrides.name ?? clerkId,
      email: `${clerkId}@example.test`,
      role: overrides.role ?? "student",
      points: overrides.points ?? 0,
    })
    .returning();
  return row;
}

export async function seedQuestion(
  db: TestDb,
  overrides: {
    uploaderId: string;
    difficulty: "mudah" | "sedang" | "sulit";
    answerKey?: string;
    category?: string;
    status?: "pending" | "approved" | "rejected";
  },
) {
  const [row] = await db
    .insert(schema.questions)
    .values({
      questionText: `Soal ${overrides.difficulty}`,
      options: { A: "opsi A", B: "opsi B", C: "opsi C", D: "opsi D", E: "opsi E" },
      answerKey: overrides.answerKey ?? "A",
      difficulty: overrides.difficulty,
      subject: "Matematika",
      category: overrides.category ?? "UTBK",
      uploaderId: overrides.uploaderId,
      status: overrides.status ?? "approved",
    })
    .returning();
  return row;
}

export function jsonRequest(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * A request object for handlers that take one. Every route handler now accepts a
 * `Request` because the structured logger reads `x-request-id` from it; a stable
 * header also makes the log line for a failing assertion easy to find.
 */
export function apiRequest(path = "/api", method: "GET" | "POST" = "GET"): Request {
  // `Request` requires an absolute URL; the host is never contacted.
  const url = new URL(path, "https://nawa.test").toString();
  return new Request(url, { method, headers: { "x-request-id": uniqueId("test-req") } });
}
