import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import { GET } from "@/app/api/health/route";

function configureAuth(present: boolean) {
  vi.stubEnv("CLERK_SECRET_KEY", present ? "sk_test_fake" : "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", present ? "pk_test_fake" : "");
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.spyOn(console, "error").mockImplementation(() => {});
  holder.db = { execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]) };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("reports ok when the database answers and auth is configured", async () => {
    configureAuth(true);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      checks: { database: "ok", auth: "ok" },
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
      checks: { database: "ok", auth: "down" },
    });
  });

  it("refuses to let a monitor cache a stale verdict", async () => {
    configureAuth(true);

    const response = await GET();

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
