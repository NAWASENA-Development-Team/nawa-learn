// tests/integration/abuse.test.ts
// The tripwire is only useful if it fires on the data it will actually see, so
// this runs it against a real Postgres with real points_log rows.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUser, uniqueId, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import { pointsLog } from "@/db/schema";
import { POINT_SPIKE_THRESHOLD, POINT_SPIKE_WINDOW_MINUTES, flagPointSpike } from "@/lib/abuse";
import { logger } from "@/lib/logger";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function capturedWarnings(): Array<Record<string, unknown>> {
  const calls = vi.mocked(console.error).mock.calls;
  return calls.map((call) => {
    try {
      return JSON.parse(String(call[0])) as Record<string, unknown>;
    } catch {
      return {};
    }
  });
}

async function credit(userId: string, delta: number, at?: Date) {
  await db.insert(pointsLog).values({
    userId,
    action: uniqueId("credit"),
    delta,
    refId: null,
    ...(at ? { createdAt: at } : {}),
  });
}

describe("flagPointSpike", () => {
  it("stays quiet for ordinary activity", async () => {
    const user = await seedUser(db, {});
    await credit(user.id, 15);
    await credit(user.id, 15);

    const total = await flagPointSpike(user.id, logger);

    expect(total).toBe(30);
    expect(capturedWarnings().some((line) => line.msg === "point_spike_detected")).toBe(false);
  });

  it("fires once the window total reaches the threshold", async () => {
    const user = await seedUser(db, {});
    await credit(user.id, POINT_SPIKE_THRESHOLD);

    const total = await flagPointSpike(user.id, logger);

    expect(total).toBe(POINT_SPIKE_THRESHOLD);
    const spike = capturedWarnings().find((line) => line.msg === "point_spike_detected");
    expect(spike).toBeDefined();
    expect(spike).toMatchObject({
      userId: user.id,
      pointsInWindow: POINT_SPIKE_THRESHOLD,
      windowMinutes: POINT_SPIKE_WINDOW_MINUTES,
    });
  });

  it("ignores credits older than the window", async () => {
    const user = await seedUser(db, {});
    const stale = new Date(Date.now() - (POINT_SPIKE_WINDOW_MINUTES + 1) * 60_000);
    await credit(user.id, POINT_SPIKE_THRESHOLD, stale);

    const total = await flagPointSpike(user.id, logger);

    expect(total).toBe(0);
    expect(capturedWarnings().some((line) => line.msg === "point_spike_detected")).toBe(false);
  });

  it("measures each user separately", async () => {
    const quiet = await seedUser(db, {});
    const noisy = await seedUser(db, {});
    await credit(noisy.id, POINT_SPIKE_THRESHOLD);

    // Someone else's spike must not be attributed to this user.
    expect(await flagPointSpike(quiet.id, logger)).toBe(0);
  });
});
