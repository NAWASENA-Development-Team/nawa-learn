// tests/integration/profile-update.test.ts
// This route used to copy four keys straight out of the request body with no
// schema at all. The interesting cases are therefore the ones that used to
// succeed: an unknown key, a base64 photo, an out-of-range avatar, an empty body.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedUser, uniqueId, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));
const storage = vi.hoisted(() => ({ deleteObject: vi.fn() }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
// Only the network call is faked; `isOwnStorageUrl` stays real, because the
// route's URL validation is one of the things under test.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, deleteObject: storage.deleteObject };
});

import { auth } from "@clerk/nextjs/server";
import { POST as updateProfile } from "@/app/api/profile/update/route";
import * as schema from "@/db/schema";
import { AVATAR_OPTIONS } from "@/lib/avatars";

const authMock = vi.mocked(auth);
const TOKEN = "vercel_blob_rw_store123_secret";
const OLD_PHOTO = "https://store123.public.blob.vercel-storage.com/uploads/u1/old.png";
const NEW_PHOTO = "https://store123.public.blob.vercel-storage.com/uploads/u1/new.png";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
}, 60_000);

beforeEach(() => {
  authMock.mockReset();
  vi.unstubAllEnvs();
  storage.deleteObject.mockReset();
  storage.deleteObject.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function signIn() {
  const user = await seedUser(db, { clerkId: uniqueId("clerk") });
  authMock.mockResolvedValue({ userId: user.clerkId } as never);
  return user;
}

function post(body: unknown): Request {
  return new Request("https://nawa.test/api/profile/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readUser(id: string) {
  return db.query.users.findFirst({ where: eq(schema.users.id, id) });
}

describe("POST /api/profile/update — identity", () => {
  it("answers 401 without a session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const response = await updateProfile(post({ avatarIndex: 0 }));

    expect(response.status).toBe(401);
  });

  it("answers 403 for a session with no database row", async () => {
    authMock.mockResolvedValue({ userId: uniqueId("clerk") } as never);

    const response = await updateProfile(post({ avatarIndex: 0 }));

    expect(response.status).toBe(403);
  });
});

describe("POST /api/profile/update — schema", () => {
  it("rejects an unknown key instead of ignoring it", async () => {
    await signIn();

    const response = await updateProfile(post({ avatarIndex: 1, role: "admin" }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { details: { path: string }[] };
    expect(body.details.map((detail) => detail.path)).toContain("role");
  });

  it("rejects an empty body with a root-level error", async () => {
    await signIn();

    const response = await updateProfile(post({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      details: [{ path: "(root)", message: "No updatable fields provided" }],
    });
  });

  it("rejects an avatar index past the end of the list", async () => {
    await signIn();

    const response = await updateProfile(post({ avatarIndex: AVATAR_OPTIONS.length }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { details: { path: string }[] };
    expect(body.details.map((detail) => detail.path)).toContain("avatarIndex");
  });

  it("rejects a base64 photo", async () => {
    await signIn();

    const response = await updateProfile(post({ photoUrl: "data:image/png;base64,iVBORw0KGgo=" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      details: [{ path: "photoUrl", message: expect.stringContaining("our own storage") }],
    });
  });

  it("rejects a photo hosted somewhere else", async () => {
    await signIn();

    // This is the tracking-pixel case: an arbitrary https URL would let the
    // leaderboard be used to serve and count somebody else's images.
    const response = await updateProfile(post({ photoUrl: "https://evil.test/pixel.gif" }));

    expect(response.status).toBe(400);
  });

  it("rejects a motto longer than the column", async () => {
    await signIn();

    const response = await updateProfile(post({ motto: "x".repeat(201) }));

    expect(response.status).toBe(400);
  });

  it("answers 400, never 500, for malformed JSON", async () => {
    await signIn();

    const response = await updateProfile(post("{ not json"));

    expect(response.status).toBe(400);
  });
});

describe("POST /api/profile/update — writes", () => {
  it("applies a valid avatar index", async () => {
    const user = await signIn();

    const response = await updateProfile(post({ avatarIndex: 3 }));

    expect(response.status).toBe(200);
    expect((await readUser(user.id))?.avatarIndex).toBe(3);
  });

  it("trims text and accepts null to clear a field", async () => {
    const user = await signIn();

    const response = await updateProfile(post({ bio: "  Belajar terus  ", motto: null }));

    expect(response.status).toBe(200);
    const row = await readUser(user.id);
    expect(row?.bio).toBe("Belajar terus");
    expect(row?.motto).toBeNull();
  });

  it("stores an own-storage photo URL", async () => {
    const user = await signIn();

    const response = await updateProfile(post({ photoUrl: NEW_PHOTO }));

    expect(response.status).toBe(200);
    expect((await readUser(user.id))?.photoUrl).toBe(NEW_PHOTO);
  });

  it("deletes the replaced object so the old URL stops resolving", async () => {
    const user = await signIn();
    await db.update(schema.users).set({ photoUrl: OLD_PHOTO }).where(eq(schema.users.id, user.id));
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);

    const response = await updateProfile(post({ photoUrl: NEW_PHOTO }));

    expect(response.status).toBe(200);
    expect((await readUser(user.id))?.photoUrl).toBe(NEW_PHOTO);
    expect(storage.deleteObject).toHaveBeenCalledWith(OLD_PHOTO);
  });

  it("does not delete anything when the photo is unchanged", async () => {
    const user = await signIn();
    await db.update(schema.users).set({ photoUrl: OLD_PHOTO }).where(eq(schema.users.id, user.id));
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);

    const response = await updateProfile(post({ photoUrl: OLD_PHOTO }));

    expect(response.status).toBe(200);
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("still succeeds when deleting the old object fails", async () => {
    const user = await signIn();
    await db.update(schema.users).set({ photoUrl: OLD_PHOTO }).where(eq(schema.users.id, user.id));
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    storage.deleteObject.mockRejectedValue(new Error("store is down"));

    const response = await updateProfile(post({ photoUrl: NEW_PHOTO }));

    // An orphaned object is a cleanup problem, not a failed profile edit.
    expect(response.status).toBe(200);
    expect((await readUser(user.id))?.photoUrl).toBe(NEW_PHOTO);
  });
});
