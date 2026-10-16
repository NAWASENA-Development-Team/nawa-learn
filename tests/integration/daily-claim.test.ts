import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { apiRequest, createTestDb, seedQuestion, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import * as schema from "@/db/schema";
import { POST } from "@/app/api/quiz/daily-claim/route";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
}, 60_000);

beforeEach(() => {
  authMock.mockReset();
});

function signIn(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

async function claim() {
  const response = await POST(apiRequest("/api/quiz/daily-claim", "POST"));
  return { status: response.status, data: await response.json() };
}

async function pointsOf(userId: string): Promise<number> {
  const row = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { points: true },
  });
  return row?.points ?? 0;
}

/** A graded attempt, exactly as /api/quiz/submit would have written it. */
async function recordAttempt(userId: string, questionId: string, createdAt?: Date) {
  await db.insert(schema.pointsLog).values({
    userId,
    action: "quiz_answer",
    refId: questionId,
    delta: 0,
    ...(createdAt ? { createdAt } : {}),
  });
}

describe("POST /api/quiz/daily-claim", () => {
  it("answers 401 for an anonymous caller", async () => {
    authMock.mockResolvedValue({ userId: null } as never);
    const { status } = await claim();
    expect(status).toBe(401);
  });

  it("refuses to pay out when no attempt is on record", async () => {
    const student = await seedUser(db, {});
    signIn(student.clerkId);

    const { data } = await claim();

    expect(data.success).toBe(false);
    expect(data.pointsAwarded).toBeUndefined();
    expect(await pointsOf(student.id)).toBe(0);
  });

  it("refuses to pay out for attempts on non-daily questions", async () => {
    const author = await seedUser(db, {});
    const student = await seedUser(db, {});
    const utbk = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sedang",
      category: "UTBK",
    });
    await recordAttempt(student.id, utbk.id);

    signIn(student.clerkId);
    const { data } = await claim();

    expect(data.success).toBe(false);
    expect(await pointsOf(student.id)).toBe(0);
  });

  it("ignores a daily attempt from a previous window", async () => {
    const author = await seedUser(db, {});
    const student = await seedUser(db, {});
    const daily = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sedang",
      category: "Kuis Harian",
    });
    // 48 hours ago: definitely before today's 03:00 WIB reset.
    await recordAttempt(student.id, daily.id, new Date(Date.now() - 48 * 60 * 60 * 1000));

    signIn(student.clerkId);
    const { data } = await claim();

    expect(data.success).toBe(false);
    expect(await pointsOf(student.id)).toBe(0);
  });

  it("pays the flat bonus once, and refuses a second claim the same day", async () => {
    const author = await seedUser(db, {});
    const student = await seedUser(db, {});
    const daily = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sedang",
      category: "Kuis Harian",
    });
    await recordAttempt(student.id, daily.id);

    signIn(student.clerkId);

    const first = await claim();
    expect(first.data.success).toBe(true);
    expect(first.data.pointsAwarded).toBe(25);
    expect(await pointsOf(student.id)).toBe(25);

    const second = await claim();
    expect(second.data.success).toBe(false);
    expect(await pointsOf(student.id)).toBe(25);
  });

  it("stamps the user row so the UI can show today's status", async () => {
    const author = await seedUser(db, {});
    const student = await seedUser(db, {});
    const daily = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sedang",
      category: "Kuis Harian",
    });
    await recordAttempt(student.id, daily.id);

    signIn(student.clerkId);
    await claim();

    const row = await db.query.users.findFirst({
      where: eq(schema.users.id, student.id),
      columns: { lastDailyQuizAt: true },
    });
    expect(row?.lastDailyQuizAt).toBeInstanceOf(Date);
  });
});
