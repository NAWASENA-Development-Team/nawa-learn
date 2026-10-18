// tests/integration/bookmarks.test.ts
// "Tersimpan" used to be one `localStorage` key, `nawa_bookmarks`, with no user
// id in it. On a shared school PC the next student inherited the previous one's
// bookmarks — a correctness bug and a small privacy leak. The list is now owned
// by the account, and these tests pin the properties that make that true:
//
//   * the list is scoped to the caller (two users, two lists),
//   * a bookmark may only point at an approved module (404, not an FK 500),
//   * the request carries the *desired state*, not a toggle, so a retry cannot
//     silently undo itself — the unique index owns idempotency.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, jsonRequest, seedUser, uniqueId, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { GET as listBookmarks, POST as toggleBookmark } from "@/app/api/bookmarks/route";
import * as schema from "@/db/schema";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  authMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function signIn(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

function post(body: unknown): Request {
  return jsonRequest("https://nawa.test/api/bookmarks", body);
}

function get(): Request {
  return new Request("https://nawa.test/api/bookmarks", { method: "GET" });
}

async function seedModule(status: "pending" | "approved" | "rejected" = "approved") {
  const uploader = await seedUser(db, {});
  const [row] = await db
    .insert(schema.modules)
    .values({
      title: "Modul Uji",
      subject: "Matematika",
      grade: "12",
      category: "UTBK",
      contentUrl: "https://store123.public.blob.vercel-storage.com/uploads/u1/modul.pdf",
      uploaderId: uploader.id,
      status,
    })
    .returning();
  return row;
}

async function bookmarkCount(userId: string) {
  const rows = await db
    .select({ id: schema.bookmarks.id })
    .from(schema.bookmarks)
    .where(eq(schema.bookmarks.userId, userId));
  return rows.length;
}

describe("GET /api/bookmarks", () => {
  it("answers 401 without a session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const response = await listBookmarks(get());

    expect(response.status).toBe(401);
  });

  it("returns only the caller's own module ids", async () => {
    const mine = await seedUser(db, { clerkId: uniqueId("clerk") });
    const theirs = await seedUser(db, { clerkId: uniqueId("clerk") });
    const first = await seedModule();
    const second = await seedModule();
    await db.insert(schema.bookmarks).values([
      { userId: mine.id, moduleId: first.id },
      { userId: theirs.id, moduleId: second.id },
    ]);

    signIn(mine.clerkId);
    const response = await listBookmarks(get());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { moduleIds: string[] };
    expect(body.moduleIds).toEqual([first.id]);
  });

  it("returns an empty list rather than an error for a user with no bookmarks", async () => {
    const user = await seedUser(db, { clerkId: uniqueId("clerk") });
    signIn(user.clerkId);

    const response = await listBookmarks(get());

    expect(response.status).toBe(200);
    expect((await response.json()) as { moduleIds: string[] }).toEqual({ moduleIds: [] });
  });
});

describe("POST /api/bookmarks", () => {
  it("answers 401 without a session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const response = await toggleBookmark(post({ moduleId: crypto.randomUUID(), bookmarked: true }));

    expect(response.status).toBe(401);
  });

  it("saves a bookmark for an approved module", async () => {
    const user = await seedUser(db, { clerkId: uniqueId("clerk") });
    const seeded = await seedModule();
    signIn(user.clerkId);

    const response = await toggleBookmark(post({ moduleId: seeded.id, bookmarked: true }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()) as { bookmarked: boolean }).toEqual({ bookmarked: true });
    expect(await bookmarkCount(user.id)).toBe(1);
  });

  it("is idempotent: sending the same request twice leaves one row", async () => {
    // The point of `{ bookmarked: true }` over a toggle. A retry on a flaky
    // connection must not undo the bookmark the student just made.
    const user = await seedUser(db, { clerkId: uniqueId("clerk") });
    const seeded = await seedModule();
    signIn(user.clerkId);

    const first = await toggleBookmark(post({ moduleId: seeded.id, bookmarked: true }));
    const second = await toggleBookmark(post({ moduleId: seeded.id, bookmarked: true }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await bookmarkCount(user.id)).toBe(1);
  });

  it("removes a bookmark when asked for the un-saved state", async () => {
    const user = await seedUser(db, { clerkId: uniqueId("clerk") });
    const seeded = await seedModule();
    await db.insert(schema.bookmarks).values({ userId: user.id, moduleId: seeded.id });
    signIn(user.clerkId);

    const response = await toggleBookmark(post({ moduleId: seeded.id, bookmarked: false }));

    expect(response.status).toBe(200);
    expect((await response.json()) as { bookmarked: boolean }).toEqual({ bookmarked: false });
    expect(await bookmarkCount(user.id)).toBe(0);
  });

  it("answers 200 when removing a bookmark that was never there", async () => {
    const user = await seedUser(db, { clerkId: uniqueId("clerk") });
    const seeded = await seedModule();
    signIn(user.clerkId);

    const response = await toggleBookmark(post({ moduleId: seeded.id, bookmarked: false }));

    expect(response.status).toBe(200);
  });

  it("refuses to bookmark a module the library does not show", async () => {
    // A foreign key would accept the id and reject nothing; the status check is
    // what stops a student bookmarking someone else's pending submission.
    const user = await seedUser(db, { clerkId: uniqueId("clerk") });
    const pending = await seedModule("pending");
    signIn(user.clerkId);

    const response = await toggleBookmark(post({ moduleId: pending.id, bookmarked: true }));

    expect(response.status).toBe(404);
    expect(await bookmarkCount(user.id)).toBe(0);
  });

  it("answers 404 for a module id that matches nothing", async () => {
    const user = await seedUser(db, { clerkId: uniqueId("clerk") });
    signIn(user.clerkId);

    const response = await toggleBookmark(post({ moduleId: crypto.randomUUID(), bookmarked: true }));

    expect(response.status).toBe(404);
  });

  it("answers 400 for a malformed module id instead of a database error", async () => {
    const user = await seedUser(db, { clerkId: uniqueId("clerk") });
    signIn(user.clerkId);

    const response = await toggleBookmark(post({ moduleId: "not-a-uuid", bookmarked: true }));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { details: { path: string }[] };
    expect(body.details.map((detail) => detail.path)).toContain("moduleId");
  });

  it("answers 400 when the desired state is missing", async () => {
    const user = await seedUser(db, { clerkId: uniqueId("clerk") });
    const seeded = await seedModule();
    signIn(user.clerkId);

    const response = await toggleBookmark(post({ moduleId: seeded.id }));

    expect(response.status).toBe(400);
  });

  it("answers 400 for an unknown key", async () => {
    const user = await seedUser(db, { clerkId: uniqueId("clerk") });
    const seeded = await seedModule();
    signIn(user.clerkId);

    const response = await toggleBookmark(post({ moduleId: seeded.id, bookmarked: true, userId: "x" }));

    expect(response.status).toBe(400);
  });

  it("does not let one user remove another user's bookmark", async () => {
    const mine = await seedUser(db, { clerkId: uniqueId("clerk") });
    const theirs = await seedUser(db, { clerkId: uniqueId("clerk") });
    const seeded = await seedModule();
    await db.insert(schema.bookmarks).values({ userId: theirs.id, moduleId: seeded.id });
    signIn(mine.clerkId);

    await toggleBookmark(post({ moduleId: seeded.id, bookmarked: false }));

    expect(await bookmarkCount(theirs.id)).toBe(1);
  });
});
