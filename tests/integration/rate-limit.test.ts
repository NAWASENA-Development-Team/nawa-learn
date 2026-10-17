// tests/integration/rate-limit.test.ts
// The limit only matters if it holds at the HTTP boundary, so this drives a real
// route handler rather than the helper in isolation.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUser, uniqueId, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { POST as updateProfile } from "@/app/api/profile/update/route";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { RATE_LIMITS, resetInMemoryCounters } from "@/lib/rateLimit";

const authMock = vi.mocked(auth);
const IP_LIMIT = RATE_LIMITS["profile/update"].perIp.limit;
// `avatarIndex` is range-checked now, so the budget loop has to stay inside the
// real list while still sending a distinct, valid value each round.
const VALID_AVATAR_INDEX = (i: number) => i % AVATAR_OPTIONS.length;

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  authMock.mockReset();
  resetInMemoryCounters();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function update(ip: string, body: string) {
  return new Request("https://nawa.test/api/profile/update", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body,
  });
}

async function signIn() {
  const user = await seedUser(db, { clerkId: uniqueId("clerk") });
  authMock.mockResolvedValue({ userId: user.clerkId } as never);
  return user;
}

describe("POST /api/profile/update", () => {
  it("allows the budget, then answers 429 with Retry-After", async () => {
    await signIn();

    for (let i = 0; i < IP_LIMIT; i += 1) {
      const allowed = await updateProfile(
        update("198.51.100.77", JSON.stringify({ avatarIndex: VALID_AVATAR_INDEX(i) })),
      );
      expect(allowed.status).toBe(200);
    }

    const blocked = await updateProfile(update("198.51.100.77", JSON.stringify({ avatarIndex: 1 })));

    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect(blocked.headers.get("cache-control")).toBe("no-store");
    await expect(blocked.json()).resolves.toMatchObject({ error: "Too many requests" });
  });

  // Ordering matters: the guard must run before the body is read, otherwise an
  // exhausted client can still make the server parse a large payload.
  it("refuses an exhausted client before it even reads the body", async () => {
    await signIn();

    for (let i = 0; i < IP_LIMIT; i += 1) {
      await updateProfile(update("198.51.100.80", JSON.stringify({ avatarIndex: 0 })));
    }

    const blocked = await updateProfile(update("198.51.100.80", "this is not json"));

    expect(blocked.status).toBe(429);
  });

  it("keeps the budget per address, not global", async () => {
    await signIn();

    for (let i = 0; i < IP_LIMIT; i += 1) {
      await updateProfile(update("198.51.100.81", JSON.stringify({ avatarIndex: 0 })));
    }

    const other = await updateProfile(update("198.51.100.82", JSON.stringify({ avatarIndex: 0 })));

    expect(other.status).toBe(200);
  });
});
