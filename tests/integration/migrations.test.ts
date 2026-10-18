import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

// Migration 0000 is the schema as it existed before M5; 0001 is the M5 upgrade;
// 0002 adds the UU PDP consent columns in M11; 0003 adds the audit log in M12;
// 0004 adds the M13 indexes. These tests run the real SQL files against a
// database that already holds data, which is the only way to prove the upgrade is
// safe on the live database.
const MIGRATIONS_DIR = path.resolve(process.cwd(), "src/db/migrations");
const LEGACY = "0000_absurd_warhawk.sql";
const UPGRADE = "0001_clever_lady_mastermind.sql";
const CONSENT = "0002_charming_venom.sql";
const AUDIT = "0003_panoramic_landau.sql";
const INDEXES = "0004_wide_tyrannus.sql";

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
  });

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

describe("M11 consent columns on a database that already has data", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. The pre-M11 schema, with the M5 upgrade applied — exactly the live
    //    database's state the moment before 0002 runs.
    await db.exec(sqlOf(LEGACY));
    await db.exec(sqlOf(UPGRADE));

    // 2. A row that exists before the consent columns are added.
    await db.exec(`
      INSERT INTO users (id, clerk_id, name, email, role, points)
      VALUES ('${USER_A}', 'clerk_a', 'A', 'a@example.test', 'student', 120);
    `);

    // 3. Apply the consent migration.
    await db.exec(sqlOf(CONSENT));
  });

  it("keeps the pre-existing row and leaves its consent NULL", async () => {
    const result = await db.query<{
      consent_policy_version: string | null;
      consent_accepted_at: Date | null;
    }>(
      `SELECT consent_policy_version, consent_accepted_at FROM users WHERE id = '${USER_A}'`,
    );

    expect(result.rows).toHaveLength(1);
    // NULL is what the gate reads as "never accepted", so a pre-M11 account is
    // correctly asked for consent once instead of being assumed to have given it.
    expect(result.rows[0].consent_policy_version).toBeNull();
    expect(result.rows[0].consent_accepted_at).toBeNull();
  });

  it("adds both columns to the existing table", async () => {
    const result = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users'
         AND column_name IN ('consent_policy_version', 'consent_accepted_at')`,
    );
    expect(result.rows.map((row) => row.column_name).sort()).toEqual([
      "consent_accepted_at",
      "consent_policy_version",
    ]);
  });

  it("accepts a version and timestamp", async () => {
    await db.exec(
      `UPDATE users SET consent_policy_version = '1.0', consent_accepted_at = '2026-10-17T03:00:00Z'
       WHERE id = '${USER_A}'`,
    );
    const result = await db.query<{ consent_policy_version: string }>(
      `SELECT consent_policy_version FROM users WHERE id = '${USER_A}'`,
    );
    expect(result.rows[0].consent_policy_version).toBe("1.0");
  });

  it("refuses a version longer than the varchar(20) column", async () => {
    // A silently truncated version would compare unequal to the constant and
    // re-prompt forever; the column is sized to make an over-long value an error.
    await expect(
      db.exec(`UPDATE users SET consent_policy_version = repeat('x', 21) WHERE id = '${USER_A}'`),
    ).rejects.toThrow();
  });
});

// M12. The audit log is a *new* table, so the migration cannot lose data — but it
// can still be wrong in ways that only show up later: a nullable `actor_id` that
// turns out to be NOT NULL, a missing index that makes the moderation trail
// unreadable at 10k rows, or a foreign key that silently cascades and deletes the
// history of a moderator who leaves. All four are asserted here.
describe("M12 audit log on a database that already has data", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    await db.exec(sqlOf(LEGACY));
    await db.exec(sqlOf(UPGRADE));
    await db.exec(sqlOf(CONSENT));

    // Rows that exist before the new table is created. The migration must not
    // touch them.
    await db.exec(`
      INSERT INTO users (id, clerk_id, name, email, role, points)
      VALUES
        ('${USER_A}', 'clerk_a', 'A', 'a@example.test', 'moderator', 120),
        ('${USER_B}', 'clerk_b', 'B', 'b@example.test', 'student', 50);

      INSERT INTO modules (id, title, subject, grade, category, content_url, uploader_id, status)
      VALUES ('${MODULE}', 'Modul', 'Matematika', '10', 'UTBK', 'https://example.test/m', '${USER_B}', 'approved');
    `);

    await db.exec(sqlOf(AUDIT));
  });

  it("leaves every pre-existing row untouched", async () => {
    expect(await count(db, "users")).toBe(2);
    expect(await count(db, "modules")).toBe(1);
  });

  it("creates the table with the eight columns the schema declares", async () => {
    const result = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'audit_log'`,
    );
    expect(result.rows.map((row) => row.column_name).sort()).toEqual([
      "action",
      "actor_id",
      "after",
      "before",
      "created_at",
      "entity",
      "entity_id",
      "id",
    ]);
  });

  it("creates all three indexes", async () => {
    const result = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'audit_log'`,
    );
    const names = result.rows.map((row) => row.indexname);
    expect(names).toContain("audit_log_entity_idx");
    expect(names).toContain("audit_log_actor_created_idx");
    expect(names).toContain("audit_log_created_idx");
  });

  it("accepts a system action with no actor", async () => {
    // `actor_id` must stay nullable: `npm run db:promote` runs on an operator's
    // machine and has no row in `users` to point at.
    await db.exec(`
      INSERT INTO audit_log (actor_id, action, entity, entity_id, after)
      VALUES (NULL, 'user.role_change', 'user', '${USER_A}', '{"role":"moderator"}');
    `);

    const result = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_log WHERE actor_id IS NULL`,
    );
    expect(result.rows[0].n).toBe(1);
  });

  it("round-trips both jsonb snapshots", async () => {
    await db.exec(`
      INSERT INTO audit_log (actor_id, action, entity, entity_id, before, after)
      VALUES ('${USER_A}', 'content.approve', 'module', '${MODULE}',
              '{"status":"pending"}', '{"status":"approved","pointsAwarded":50}');
    `);

    const result = await db.query<{ before: unknown; after: unknown }>(
      `SELECT before, after FROM audit_log
       WHERE action = 'content.approve' AND entity_id = '${MODULE}'`,
    );
    expect(result.rows[0].before).toEqual({ status: "pending" });
    expect(result.rows[0].after).toEqual({ status: "approved", pointsAwarded: 50 });
  });

  it("refuses an actor that is not a real user", async () => {
    await expect(
      db.exec(`
        INSERT INTO audit_log (actor_id, action, entity, entity_id)
        VALUES ('99999999-9999-9999-9999-999999999999', 'content.reject', 'question', '${QUESTION}');
      `),
    ).rejects.toThrow();
  });

  it("keeps the trail when the actor's account is anonymised, not deleted", async () => {
    // The anonymisation path never deletes the `users` row, which is exactly why
    // the foreign key is safe here: history survives the person leaving.
    await db.exec(`
      INSERT INTO audit_log (actor_id, action, entity, entity_id)
      VALUES ('${USER_A}', 'content.reject', 'question', '${QUESTION}');
    `);

    await db.exec(`
      UPDATE users SET clerk_id = 'deleted:${USER_A}', name = 'Anonim', email = 'deleted+${USER_A}@deleted.nawasena.site'
      WHERE id = '${USER_A}';
    `);

    expect(await count(db, "audit_log")).toBeGreaterThan(0);
  });
});

// M13. Seven indexes, no columns. The migration cannot lose data by construction —
// but it *can* be wrong in a way only production notices: a descending index that
// silently came out ascending, which makes the keyset pagination this milestone
// added scan-and-sort instead of seek. So the direction is asserted, not just the
// name.
describe("M13 indexes on a database that already has data", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    await db.exec(sqlOf(LEGACY));
    await db.exec(sqlOf(UPGRADE));
    await db.exec(sqlOf(CONSENT));
    await db.exec(sqlOf(AUDIT));

    // Rows that exist before the indexes are created. CREATE INDEX rewrites the
    // whole table to build its tree, so this is exactly the run where a bad
    // expression would be noticed.
    await db.exec(`
      INSERT INTO users (id, clerk_id, name, email, role, points)
      VALUES
        ('${USER_A}', 'clerk_a', 'A', 'a@example.test', 'student', 120),
        ('${USER_B}', 'clerk_b', 'B', 'b@example.test', 'student', 50);

      INSERT INTO modules (id, title, subject, grade, category, content_url, uploader_id, status)
      VALUES ('${MODULE}', 'Modul', 'Matematika', '10', 'UTBK', 'https://example.test/m', '${USER_A}', 'approved');

      INSERT INTO questions (id, question_text, options, answer_key, difficulty, subject, category, uploader_id, status)
      VALUES ('${QUESTION}', 'Soal', '{"A":"a","B":"b"}', 'A', 'mudah', 'Matematika', 'UTBK', '${USER_A}', 'approved');
    `);

    await db.exec(sqlOf(INDEXES));
  });

  it("leaves every pre-existing row untouched", async () => {
    expect(await count(db, "users")).toBe(2);
    expect(await count(db, "modules")).toBe(1);
    expect(await count(db, "questions")).toBe(1);
  });

  it("creates all seven indexes", async () => {
    const result = await db.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const names = result.rows.map((row) => row.indexname);

    for (const name of [
      "custom_exams_created_idx",
      "modules_uploader_idx",
      "questions_status_created_idx",
      "questions_uploader_idx",
      "reports_user_created_idx",
      "submissions_submitter_created_idx",
      "users_points_idx",
    ]) {
      expect(names).toContain(name);
    }
  });

  it("keeps the sort direction the keyset pagination depends on", async () => {
    // `pg_get_indexdef` is the only place the direction is visible. An index that
    // came out ascending is still "present" and still satisfies the test above,
    // while quietly forcing a sort on every page.
    const result = await db.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN ('custom_exams_created_idx', 'questions_status_created_idx',
                           'reports_user_created_idx', 'submissions_submitter_created_idx',
                           'users_points_idx')`,
    );
    const byName = new Map(result.rows.map((row) => [row.indexname, row.indexdef]));

    // `pg_get_indexdef` omits quotes on non-reserved identifiers, so these
    // assertions match the shape Postgres actually prints: `created_at DESC
    // NULLS LAST, id DESC NULLS LAST`.
    expect(byName.get("custom_exams_created_idx")).toContain("created_at DESC");
    expect(byName.get("custom_exams_created_idx")).toContain("id DESC");
    expect(byName.get("questions_status_created_idx")).toContain("status, created_at DESC");
    expect(byName.get("reports_user_created_idx")).toContain("user_id, created_at DESC");
    expect(byName.get("submissions_submitter_created_idx")).toContain(
      "submitter_id, submitted_at DESC",
    );
    expect(byName.get("users_points_idx")).toContain("points DESC");
  });

  it("is safe to re-run as a plain CREATE INDEX (no CONCURRENTLY in the file)", async () => {
    // `drizzle-kit migrate` runs each statement inside a transaction, and
    // `CREATE INDEX CONCURRENTLY` is illegal there. A hand-edited migration that
    // added it would fail only on deploy, not in this test — unless the file
    // itself is asserted, which is what this does.
    expect(sqlOf(INDEXES)).not.toMatch(/CONCURRENTLY/i);
  });
});
