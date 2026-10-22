import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import { GET } from "@/app/api/health/route";
import journal from "@/db/migrations/meta/_journal.json";

// The number the route derives from drizzle-kit's journal. Read here too, so the
// tests break the day the journal stops being the source of truth.
const EXPECTED = journal.entries.length;

function configureAuth(present: boolean) {
  vi.stubEnv("CLERK_SECRET_KEY", present ? "sk_test_fake" : "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", present ? "pk_test_fake" : "");
}

function migrationCount(applied: number) {
  return vi.fn().mockResolvedValue([{ applied }]);
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.spyOn(console, "error").mockImplementation(() => {});
  holder.db = { execute: migrationCount(EXPECTED) };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("reports ok when the database answers, the schema is current and auth is configured", async () => {
    configureAuth(true);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      checks: { database: "ok", schema: "ok", auth: "ok" },
    });
  });

  // The regression this endpoint missed in production: a reachable database that
  // is one migration behind the deployed code. `select 1` says "ok" to that.
  it("reports 503 when the database is behind the migrations this build needs", async () => {
    configureAuth(true);
    holder.db = { execute: migrationCount(EXPECTED - 1) };

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: { database: "ok", schema: "stale", auth: "ok" },
    });
  });

  // A rollback window: the database is ahead of the deployed build. Additive
  // migrations do not break older code, so this must not read as an outage.
  it("treats a database one migration ahead as usable", async () => {
    configureAuth(true);
    holder.db = { execute: migrationCount(EXPECTED + 1) };

    expect((await GET()).status).toBe(200);
  });

  it("reports stale when the migration count cannot be read", async () => {
    configureAuth(true);
    holder.db = { execute: vi.fn().mockResolvedValue([]) };

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      checks: { database: "ok", schema: "stale" },
    });
  });

  it("reports 503 when the database is unreachable", async () => {
    configureAuth(true);
    holder.db = {
      execute: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED db-internal-1:5432")),
    };

    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("down");
    // Not "ok": an unreachable database says nothing about the schema.
    expect(body.checks.schema).toBe("unknown");
  });

  // The endpoint is public, so its body must not become an intelligence feed.
  it("never leaks the underlying database error to an anonymous caller", async () => {
    configureAuth(true);
    holder.db = {
      execute: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED db-internal-1:5432")),
    };

    const raw = await (await GET()).text();

    expect(raw).not.toContain("ECONNREFUSED");
    expect(raw).not.toContain("db-internal");
    expect(raw).not.toContain("5432");
  });

  it("reports 503 when the auth configuration is missing", async () => {
    configureAuth(false);

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      checks: { database: "ok", schema: "ok", auth: "down" },
    });
  });

  it("refuses to let a monitor cache a stale verdict", async () => {
    configureAuth(true);

    const response = await GET();

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
