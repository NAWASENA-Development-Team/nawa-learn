import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  authMock.mockReset();
});

type RouteCase = {
  name: string;
  url: string;
  method: "GET" | "POST";
  load: () => Promise<Record<string, unknown>>;
};

// Every route that was opened up in M2. Each one must answer 401 without a
// session and 403 for a student — the exact matrix that was impossible to prove
// before this milestone.
const PROTECTED_ROUTES: RouteCase[] = [
  {
    name: "POST /api/modules/approve",
    url: "http://localhost/api/modules/approve",
    method: "POST",
    load: () => import("@/app/api/modules/approve/route"),
  },
  {
    name: "POST /api/questions/approve",
    url: "http://localhost/api/questions/approve",
    method: "POST",
    load: () => import("@/app/api/questions/approve/route"),
  },
  {
    name: "POST /api/questions/reject",
    url: "http://localhost/api/questions/reject",
    method: "POST",
    load: () => import("@/app/api/questions/reject/route"),
  },
  {
    name: "POST /api/questions/daily-create",
    url: "http://localhost/api/questions/daily-create",
    method: "POST",
    load: () => import("@/app/api/questions/daily-create/route"),
  },
  {
    name: "GET /api/questions/daily-create",
    url: "http://localhost/api/questions/daily-create",
    method: "GET",
    load: () => import("@/app/api/questions/daily-create/route"),
  },
  {
    name: "GET /api/questions/pending",
    url: "http://localhost/api/questions/pending",
    method: "GET",
    load: () => import("@/app/api/questions/pending/route"),
  },
  {
    name: "GET /api/submissions/pending",
    url: "http://localhost/api/submissions/pending",
    method: "GET",
    load: () => import("@/app/api/submissions/pending/route"),
  },
  {
    name: "GET /api/moderator/hidden-badges",
    url: "http://localhost/api/moderator/hidden-badges",
    method: "GET",
    load: () => import("@/app/api/moderator/hidden-badges/route"),
  },
];

async function call(route: RouteCase): Promise<Response> {
  const mod = await route.load();
  const handler = mod[route.method] as (req: Request) => Promise<Response>;
  const request =
    route.method === "GET"
      ? new Request(route.url)
      : new Request(route.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
  return handler(request);
}

describe.each(PROTECTED_ROUTES)("$name", (route) => {
  it("answers 401 without a session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);
    const response = await call(route);
    expect(response.status).toBe(401);
  });

  it("answers 403 for a signed-in student", async () => {
    const student = await seedUser(db, { role: "student" });
    authMock.mockResolvedValue({ userId: student.clerkId } as never);
    const response = await call(route);
    expect(response.status).toBe(403);
  });

  it("answers 403 for a contributor", async () => {
    const contributor = await seedUser(db, { role: "contributor" });
    authMock.mockResolvedValue({ userId: contributor.clerkId } as never);
    const response = await call(route);
    expect(response.status).toBe(403);
  });

  it("lets a moderator past the authorization gate", async () => {
    const moderator = await seedUser(db, { role: "moderator" });
    authMock.mockResolvedValue({ userId: moderator.clerkId } as never);
    const response = await call(route);
    // A rejection here would mean a business-rule answer (400/404/409), not an
    // authorization one. Only 401/403 would mean the gate failed.
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it("lets an admin past the authorization gate", async () => {
    const admin = await seedUser(db, { role: "admin" });
    authMock.mockResolvedValue({ userId: admin.clerkId } as never);
    const response = await call(route);
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });
});

describe("a session with no provisioned user", () => {
  it("is refused with 403 rather than treated as a moderator", async () => {
    authMock.mockResolvedValue({ userId: "clerk-never-synced" } as never);
    const response = await call(PROTECTED_ROUTES[7]);
    expect(response.status).toBe(403);
  });
});
