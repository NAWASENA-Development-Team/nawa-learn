// tests/integration/account-routes.test.ts
// The HTTP half of the two data-subject rights.
//
// `account-data.test.ts` proves the *data* logic: what `collectUserData` gathers
// and what `deleteAccountData` leaves behind. It calls those functions directly,
// so nothing in it exercises the two routes a student actually reaches. That gap
// is not cosmetic — the routes are where the guards live (`requireUser` →
// `rateLimit` → body), and route handlers are **not** under
// `src/app/(dashboard)/layout.tsx`, so the consent gate does not cover them. A
// regression that dropped `requireUser()` would have left both functions 100%
// covered and both endpoints open.
//
// The other thing only a route test can show is that deletion cannot be aimed at
// somebody else: there is no `userId` in the body, and the confirmation phrase is
// a `z.literal` inside a `.strict()` object, so the *shape* of the request is the
// security property.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedUser, uniqueId, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));
const clerk = vi.hoisted(() => ({ deleteUser: vi.fn(), client: vi.fn() }));
const storage = vi.hoisted(() => ({ deleteObject: vi.fn() }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkClient: clerk.client,
}));

// Only the network call is faked. `isOwnStorageUrl` stays real: deciding whether
// a stored URL is ours is part of what the delete route asks it.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, deleteObject: storage.deleteObject };
});

import { auth } from "@clerk/nextjs/server";
import { GET as exportData } from "@/app/api/profile/export/route";
import { POST as deleteAccount } from "@/app/api/profile/delete/route";
import * as schema from "@/db/schema";
import { ANONYMOUS_DISPLAY_NAME, DELETE_ACCOUNT_CONFIRMATION } from "@/lib/accountConstants";

const authMock = vi.mocked(auth);
const PHOTO = "https://store123.public.blob.vercel-storage.com/uploads/u1/me.png";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  authMock.mockReset();
  clerk.deleteUser.mockReset();
  clerk.deleteUser.mockResolvedValue(undefined);
  clerk.client.mockReset();
  clerk.client.mockResolvedValue({ users: { deleteUser: clerk.deleteUser } });
  storage.deleteObject.mockReset();
  storage.deleteObject.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function signIn() {
  const user = await seedUser(db, { clerkId: uniqueId("clerk") });
  authMock.mockResolvedValue({ userId: user.clerkId } as never);
  return user;
}

function getExport(query = ""): Request {
  return new Request(`https://nawa.test/api/profile/export${query}`, { method: "GET" });
}

function postDelete(body: unknown, contentType = "application/json"): Request {
  return new Request("https://nawa.test/api/profile/delete", {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("GET /api/profile/export — guards", () => {
  it("answers 401 without a session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const response = await exportData(getExport());

    expect(response.status).toBe(401);
  });

  it("answers 403 for a session whose row the webhook has not created yet", async () => {
    // Signed in, but no `users` row: there is nothing to export, and pretending
    // otherwise would return an empty file that looks like a complete answer.
    authMock.mockResolvedValue({ userId: uniqueId("clerk-orphan") } as never);

    const response = await exportData(getExport());

    expect(response.status).toBe(403);
  });

  it("spends a budget of three downloads per hour, then answers 429", async () => {
    await signIn();

    for (let i = 0; i < 3; i += 1) {
      expect((await exportData(getExport())).status).toBe(200);
    }

    const limited = await exportData(getExport());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(limited.headers.get("cache-control")).toBe("no-store");
  });
});

describe("GET /api/profile/export — the file", () => {
  it("downloads JSON by default, as an attachment that cannot be cached", async () => {
    const user = await signIn();

    const response = await exportData(getExport());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="nawa-learn-data-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");

    const body = await response.json();
    expect(body.akun.email).toBe(user.email);
    expect(body.catatan).toBeTruthy();
  });

  it("falls back to JSON for a format it does not recognise", async () => {
    // Not a 400: the only two formats are "csv" and "everything else". Refusing
    // an unknown value would break the download for anyone whose bookmark picked
    // up a stray parameter.
    await signIn();

    const response = await exportData(getExport("?format=xml"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("downloads CSV with a BOM so Excel reads it as UTF-8", async () => {
    const user = await signIn();

    const response = await exportData(getExport("?format=csv"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toMatch(/filename=".*\.csv"$/);

    // The BOM is checked as **bytes**, not characters: `response.text()` decodes
    // with a TextDecoder that strips a leading U+FEFF by default, so a string
    // assertion would pass on a file Excel still reads as Latin-1. The three
    // bytes EF BB BF are what Excel actually sniffs.
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('"kategori","kolom","nilai"');
    expect(text).toContain(user.email);
  });
});

describe("POST /api/profile/delete — the request shape is the guard", () => {
  it("answers 401 without a session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const response = await deleteAccount(postDelete({ confirmation: DELETE_ACCOUNT_CONFIRMATION }));

    expect(response.status).toBe(401);
  });

  it("refuses a non-JSON content type before reading the body", async () => {
    await signIn();

    const response = await deleteAccount(postDelete("confirmation=x", "text/plain"));

    expect(response.status).toBe(415);
  });

  it.each([
    ["an empty object", {}],
    ["the wrong phrase", { confirmation: "hapus akun saya" }],
    ["a near miss with trailing space", { confirmation: `${DELETE_ACCOUNT_CONFIRMATION} ` }],
    ["an extra field", { confirmation: DELETE_ACCOUNT_CONFIRMATION, userId: "someone-else" }],
  ])("refuses %s and deletes nothing", async (_label, body) => {
    const user = await signIn();

    const response = await deleteAccount(postDelete(body));

    expect(response.status).toBe(400);
    // The row is untouched: a rejected request must not have half-deleted
    // anything on its way to the schema check.
    const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    expect(row?.clerkId).toBe(user.clerkId);
  });

  it("cannot be aimed at another account", async () => {
    // The most important negative case: a signed-in attacker names a victim.
    // `.strict()` turns the extra key into a 400, so the request never reaches
    // `deleteAccountData` at all.
    const attacker = await signIn();
    const victim = await seedUser(db, { clerkId: uniqueId("clerk-victim") });

    const response = await deleteAccount(
      postDelete({ confirmation: DELETE_ACCOUNT_CONFIRMATION, userId: victim.id }),
    );

    expect(response.status).toBe(400);
    const victimRow = await db.query.users.findFirst({ where: eq(schema.users.id, victim.id) });
    expect(victimRow?.clerkId).toBe(victim.clerkId);
    expect(attacker.id).not.toBe(victim.id);
  });
});

describe("POST /api/profile/delete — what it does", () => {
  it("anonymises the caller, deletes their logs, and deletes the Clerk account last", async () => {
    const user = await signIn();
    await db
      .update(schema.users)
      .set({ photoUrl: PHOTO, bio: "bio", consentPolicyVersion: "1.0" })
      .where(eq(schema.users.id, user.id));
    await db.insert(schema.reports).values({
      userId: user.id,
      issueType: "bug",
      description: "laporan",
    });
    await db.insert(schema.pointsLog).values({
      userId: user.id,
      action: "quiz_correct",
      delta: 10,
    });

    const response = await deleteAccount(postDelete({ confirmation: DELETE_ACCOUNT_CONFIRMATION }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, clerkDeleted: true });

    const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    expect(row?.clerkId).toBe(`deleted:${user.id}`);
    expect(row?.name).toBe(ANONYMOUS_DISPLAY_NAME);
    expect(row?.photoUrl).toBeNull();
    expect(row?.bio).toBeNull();
    expect(row?.consentPolicyVersion).toBeNull();
    expect(row?.points).toBe(0);

    expect(await db.select().from(schema.reports)).toHaveLength(0);
    expect(await db.select().from(schema.pointsLog)).toHaveLength(0);

    // The stored object is removed, and it is removed *by its stored URL* — the
    // route must not guess a path.
    expect(storage.deleteObject).toHaveBeenCalledWith(PHOTO);
    // Clerk goes last, and it is the Clerk id that was live a moment ago.
    expect(clerk.deleteUser).toHaveBeenCalledWith(user.clerkId);
  });

  it("still succeeds when Clerk refuses, and says so in the answer", async () => {
    // The account is already anonymous in our database by then, so reporting a
    // failure would invite a second attempt that deletes nothing and confuses
    // the user. The truthful answer is `clerkDeleted: false` plus an error log.
    const user = await signIn();
    clerk.deleteUser.mockRejectedValue(new Error("clerk down"));

    const response = await deleteAccount(postDelete({ confirmation: DELETE_ACCOUNT_CONFIRMATION }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, clerkDeleted: false });

    const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    expect(row?.clerkId).toBe(`deleted:${user.id}`);
  });

  it("does not fail the deletion when the photo object is already gone", async () => {
    const user = await signIn();
    await db.update(schema.users).set({ photoUrl: PHOTO }).where(eq(schema.users.id, user.id));
    storage.deleteObject.mockRejectedValue(new Error("blob 404"));

    const response = await deleteAccount(postDelete({ confirmation: DELETE_ACCOUNT_CONFIRMATION }));

    expect(response.status).toBe(200);
    const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    expect(row?.photoUrl).toBeNull();
  });
});
