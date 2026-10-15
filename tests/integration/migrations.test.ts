import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

// Migration 0000 is the schema as it existed before M5; 0001 is the M5 upgrade.
// These tests run the real SQL files against a database that already holds data,
// which is the only way to prove the upgrade is safe on the live database.
const MIGRATIONS_DIR = path.resolve(process.cwd(), "src/db/migrations");
const LEGACY = "0000_absurd_warhawk.sql";
const UPGRADE = "0001_clever_lady_mastermind.sql";

const sqlOf = (file: string) => readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const MODULE = "33333333-3333-3333-3333-333333333333";
const QUESTION = "44444444-4444-4444-4444-444444444444";

async function count(db: PGlite, table: string): Promise<number> {
  const result = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
  return result.rows[0].n;
}

describe("M5 upgrade on a database that already has data", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Bring up the pre-M5 schema, exactly as the live database is today.
    await db.exec(sqlOf(LEGACY));

    // 2. Seed data that predates the upgrade: rows in the tables 0001 drops, and
    //    rows that exercise each new constraint.
    await db.exec(`
      INSERT INTO users (id, clerk_id, name, email, role, points, season_points, avatar_index)
      VALUES
        ('${USER_A}', 'clerk_a', 'A', 'a@example.test', 'student', 120, 120, NULL),
        ('${USER_B}', 'clerk_b', 'B', 'b@example.test', 'moderator', 50, 50, 3);

      INSERT INTO modules (id, title, subject, grade, category, content_url, uploader_id, status)
      VALUES ('${MODULE}', 'Modul', 'Matematika', '10', 'UTBK', 'https://example.test/m', '${USER_A}', 'approved');

      INSERT INTO questions (id, question_text, options, answer_key, difficulty, subject, category, uploader_id, status)
      VALUES ('${QUESTION}', 'Soal', '{"A":"a","B":"b"}', 'A', 'mudah', 'Matematika', 'UTBK', '${USER_A}', 'approved');

      INSERT INTO submissions (id, type, ref_id, submitter_id, status)
      VALUES (gen_random_uuid(), 'module', '${MODULE}', '${USER_A}', 'approved');

      INSERT INTO points_log (user_id, action, delta)
      VALUES ('${USER_A}', 'level_reward_points', 250);

      INSERT INTO reviews (id, module_id, reviewer_id, rating)
      VALUES (gen_random_uuid(), '${MODULE}', '${USER_B}', 5);

      INSERT INTO bookmarks (id, user_id, question_id)
      VALUES (gen_random_uuid(), '${USER_A}', '${QUESTION}');
    `);

    // 3. Apply the upgrade.
    await db.exec(sqlOf(UPGRADE));
  }, 60_000);

  it("keeps every row that existed before the upgrade", async () => {
    expect(await count(db, "users")).toBe(2);
    expect(await count(db, "modules")).toBe(1);
    expect(await count(db, "questions")).toBe(1);
    expect(await count(db, "submissions")).toBe(1);
    expect(await count(db, "points_log")).toBe(1);
  });

  it("drops the two unused tables", async () => {
    const result = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('reviews', 'bookmarks')`,
    );
    expect(result.rows).toEqual([]);
  });

  it("backfills updated_at on existing rows instead of leaving them null", async () => {
    const result = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM users WHERE updated_at IS NULL`,
    );
    expect(result.rows[0].n).toBe(0);
  });

  it("creates every index the upgrade promises", async () => {
    const result = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const names = result.rows.map((row) => row.indexname);
    expect(names).toContain("modules_status_subject_idx");
    expect(names).toContain("questions_status_category_idx");
    expect(names).toContain("users_season_points_idx");
    expect(names).toContain("submissions_pending_ref_unique");
    expect(names).toContain("points_log_user_action_ref_unique");
  });

  it("keeps updated_at honest through the trigger, not through application code", async () => {
    // Backdate the column, then touch the row from "application code" that knows
    // nothing about timestamps. The trigger must still move it forward.
    await db.exec(`UPDATE users SET updated_at = '2000-01-01T00:00:00Z' WHERE id = '${USER_A}'`);
    await db.exec(`UPDATE users SET name = 'A renamed' WHERE id = '${USER_A}'`);

    const result = await db.query<{ updated_at: Date }>(
      `SELECT updated_at FROM users WHERE id = '${USER_A}'`,
    );
    expect(new Date(result.rows[0].updated_at).getUTCFullYear()).toBeGreaterThan(2000);
  });

  it("refuses a second pending submission for the same item", async () => {
    await db.exec(
      `INSERT INTO submissions (id, type, ref_id, submitter_id, status)
       VALUES (gen_random_uuid(), 'module', '${MODULE}', '${USER_B}', 'pending')`,
    );

    await expect(
      db.exec(
        `INSERT INTO submissions (id, type, ref_id, submitter_id, status)
         VALUES (gen_random_uuid(), 'module', '${MODULE}', '${USER_B}', 'pending')`,
      ),
    ).rejects.toThrow();
  });

  it("still allows resubmitting after a rejection", async () => {
    // A rejected row must not block a fresh pending submission for the same item.
    await db.exec(
      `INSERT INTO submissions (id, type, ref_id, submitter_id, status)
       VALUES (gen_random_uuid(), 'question', '${QUESTION}', '${USER_A}', 'rejected')`,
    );
    await db.exec(
      `INSERT INTO submissions (id, type, ref_id, submitter_id, status)
       VALUES (gen_random_uuid(), 'question', '${QUESTION}', '${USER_A}', 'pending')`,
    );

    const pending = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM submissions
       WHERE type = 'question' AND ref_id = '${QUESTION}' AND status = 'pending'`,
    );
    expect(pending.rows[0].n).toBe(1);
  });

  it("refuses a negative avatar_index", async () => {
    await expect(
      db.exec(`UPDATE users SET avatar_index = -1 WHERE id = '${USER_A}'`),
    ).rejects.toThrow();
  });

  it("still accepts a valid avatar_index", async () => {
    await db.exec(`UPDATE users SET avatar_index = 7 WHERE id = '${USER_A}'`);
    const result = await db.query<{ avatar_index: number }>(
      `SELECT avatar_index FROM users WHERE id = '${USER_A}'`,
    );
    expect(result.rows[0].avatar_index).toBe(7);
  });
});
