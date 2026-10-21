// tests/integration/retention-job.test.ts
// The retention job and the endpoint that runs it. Two promises are checked
// here and nowhere else:
//
//   1. "Data pribadi dihapus setelah masa simpannya berakhir" is a real deletion
//      against real Postgres, not a paragraph on /privacy. The rows the policy
//      names actually disappear, and the rows it does not name do not.
//   2. The endpoint that performs the deletion is reachable only with the cron
//      secret, fails closed when the secret is missing, and refuses GET.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import * as schema from "@/db/schema";
import { RETENTION_POLICY, cutoffDate, runRetention } from "@/lib/retention";
import { GET as cronGet, POST as cronPost } from "@/app/api/cron/retention/route";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const NOW = new Date("2026-10-17T03:00:00.000Z");
const LONG_AGO = new Date("2024-01-01T00:00:00.000Z");
const RECENT = new Date("2026-10-01T00:00:00.000Z");

async function seedReport(userId: string, createdAt: Date) {
  const [row] = await db
    .insert(schema.reports)
    .values({ userId, issueType: "bug", description: "laporan", createdAt })
    .returning();
  return row;
}

async function seedPoint(userId: string, createdAt: Date) {
  const [row] = await db
    .insert(schema.pointsLog)
    .values({ userId, action: "quiz_answer", refId: crypto.randomUUID(), delta: 10, createdAt })
    .returning();
  return row;
}

async function seedSubmission(userId: string, submittedAt: Date) {
  const [row] = await db
    .insert(schema.submissions)
    .values({
      type: "module",
      refId: crypto.randomUUID(),
      submitterId: userId,
      status: "approved",
      submittedAt,
    })
    .returning();
  return row;
}

describe("runRetention", () => {
  it("deletes rows older than each rule's window and keeps the rest", async () => {
    const user = await seedUser(db, {});
    const oldReport = await seedReport(user.id, LONG_AGO);
    const newReport = await seedReport(user.id, RECENT);
    const oldPoint = await seedPoint(user.id, LONG_AGO);
    const newPoint = await seedPoint(user.id, RECENT);
    const oldSubmission = await seedSubmission(user.id, LONG_AGO);
    const newSubmission = await seedSubmission(user.id, RECENT);
    // Kehadiran kuis harian: satu baris tua, satu baris baru. Yang tua dibuang
    // karena satu-satunya pembacanya adalah jendela hari ini.
    await db
      .insert(schema.dailyActivity)
      .values([
        { userId: user.id, windowStart: LONG_AGO },
        { userId: user.id, windowStart: RECENT },
      ]);

    const result = await runRetention(db, { now: NOW });

    expect(result.deleted.reports).toBe(1);
    expect(result.deleted.points_log).toBe(1);
    expect(result.deleted.submissions).toBe(1);
    expect(result.deleted.daily_activity).toBe(1);
    expect(result.totalDeleted).toBe(4);

    const reports = await db.select().from(schema.reports);
    expect(reports.map((row) => row.id)).toEqual([newReport.id]);
    const points = await db.select().from(schema.pointsLog);
    expect(points.map((row) => row.id)).toEqual([newPoint.id]);
    const submissions = await db.select().from(schema.submissions);
    expect(submissions.map((row) => row.id)).toEqual([newSubmission.id]);

    // Belt and braces: the deleted ids are gone from the table entirely.
    expect(reports.some((row) => row.id === oldReport.id)).toBe(false);
    expect(points.some((row) => row.id === oldPoint.id)).toBe(false);
    expect(submissions.some((row) => row.id === oldSubmission.id)).toBe(false);
  });

  it("keeps a row that sits exactly on the cutoff, because the predicate is strict", async () => {
    const user = await seedUser(db, {});
    const reportsCutoff = cutoffDate(NOW, 12);
    const boundary = await seedReport(user.id, reportsCutoff);

    const result = await runRetention(db, { now: NOW });

    expect(result.deleted.reports).toBe(0);
    const reports = await db.select().from(schema.reports);
    expect(reports.map((row) => row.id)).toContain(boundary.id);
  });

  it("reports the cutoff it used, so a run can be audited after the fact", async () => {
    const result = await runRetention(db, { now: NOW });
    expect(result.ranAt).toBe(NOW.toISOString());
    expect(result.cutoffs.reports).toBe(cutoffDate(NOW, 12).toISOString());
    expect(result.cutoffs.points_log).toBe(cutoffDate(NOW, 24).toISOString());
    expect(result.cutoffs.submissions).toBe(cutoffDate(NOW, 24).toISOString());
    expect(result.cutoffs.daily_activity).toBe(cutoffDate(NOW, 24).toISOString());
  });

  it("is idempotent: a second run the same day deletes nothing new", async () => {
    const user = await seedUser(db, {});
    await seedReport(user.id, LONG_AGO);
    await seedPoint(user.id, LONG_AGO);

    const first = await runRetention(db, { now: NOW });
    const second = await runRetention(db, { now: NOW });

    expect(first.totalDeleted).toBeGreaterThan(0);
    expect(second.totalDeleted).toBe(0);
    expect(second.deleted).toEqual({
      reports: 0,
      points_log: 0,
      submissions: 0,
      daily_activity: 0,
      mail_outbox: 0,
    });
  });

  it("never touches a table the policy does not name", async () => {
    // The deliberate decision: modules and questions are library content read by
    // other students, so an age-based sweep must leave them alone.
    const user = await seedUser(db, {});
    const [module] = await db
      .insert(schema.modules)
      .values({
        title: "Modul lama",
        subject: "Matematika",
        grade: "10",
        category: "UTBK",
        contentUrl: "https://example.test/m",
        uploaderId: user.id,
        status: "approved",
        createdAt: LONG_AGO,
      })
      .returning();

    const result = await runRetention(db, { now: NOW });

    expect(result.totalDeleted).toBe(0);
    const modules = await db.select().from(schema.modules);
    expect(modules.map((row) => row.id)).toContain(module.id);
  });

  it("has a rule for every table the result counts", async () => {
    const result = await runRetention(db, { now: NOW });
    expect(Object.keys(result.deleted).sort()).toEqual(
      RETENTION_POLICY.map((rule) => rule.key).sort(),
    );
  });
});

describe("POST /api/cron/retention — authorization", () => {
  const SECRET = "cron_secret_that_is_long_enough_to_be_real";

  function post(headers: Record<string, string> = {}): Request {
    return new Request("https://nawa.test/api/cron/retention", {
      method: "POST",
      headers: { "x-request-id": "test", ...headers },
    });
  }

  it("fails closed with 401 when CRON_SECRET is not configured", async () => {
    // The whole point: an unconfigured deployer gets a dead endpoint, not an
    // open delete-everything endpoint.
    vi.stubEnv("CRON_SECRET", "");
    const user = await seedUser(db, {});
    await seedReport(user.id, LONG_AGO);

    const response = await cronPost(post({ authorization: `Bearer ${SECRET}` }));

    expect(response.status).toBe(401);
    // Nothing was deleted.
    const reports = await db.select().from(schema.reports);
    expect(reports.length).toBeGreaterThan(0);
  });

  it("rejects a request with no Authorization header", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const response = await cronPost(post());
    expect(response.status).toBe(401);
  });

  it("rejects a bearer token of the wrong length", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const response = await cronPost(post({ authorization: "Bearer short" }));
    expect(response.status).toBe(401);
  });

  it("rejects a token of the right length but the wrong content", async () => {
    // The behavioural stand-in for `timingSafeEqual`: a same-length mismatch
    // must still be refused, which is the case the naive `===` gets right only
    // by accident.
    vi.stubEnv("CRON_SECRET", SECRET);
    const wrong = "x".repeat(SECRET.length);
    const response = await cronPost(post({ authorization: `Bearer ${wrong}` }));
    expect(response.status).toBe(401);
  });

  it("rejects a bare token without the Bearer prefix", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const response = await cronPost(post({ authorization: SECRET }));
    expect(response.status).toBe(401);
  });

  it("accepts the correct token and answers with the run report", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const user = await seedUser(db, {});
    await seedReport(user.id, LONG_AGO);

    const response = await cronPost(post({ authorization: `Bearer ${SECRET}` }));
    const body = (await response.json()) as {
      totalDeleted: number;
      deleted: { reports: number };
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.totalDeleted).toBeGreaterThanOrEqual(1);
    expect(body.deleted.reports).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /api/cron/retention", () => {
  it("answers 405 with an Allow header instead of running a destructive job", async () => {
    // A GET is what a link prefetcher, a crawler or a mistyped URL produces.
    // A destructive operation must not have an accidental trigger path.
    const response = cronGet();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
