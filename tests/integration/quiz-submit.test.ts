import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, jsonRequest, seedQuestion, seedUser, type TestDb } from "../helpers/harness";

// The route imports the database layer; swap it for an in-process Postgres.
const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import * as schema from "@/db/schema";
import { POST } from "@/app/api/quiz/submit/route";

const authMock = vi.mocked(auth);
const ENDPOINT = "http://localhost/api/quiz/submit";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  authMock.mockReset();
});

function signIn(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

function signOut() {
  authMock.mockResolvedValue({ userId: null } as never);
}

async function pointsOf(userId: string): Promise<number> {
  const row = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { points: true },
  });
  return row?.points ?? 0;
}

async function submit(body: unknown) {
  const response = await POST(jsonRequest(ENDPOINT, body));
  return { status: response.status, data: await response.json() };
}

describe("POST /api/quiz/submit — authorization", () => {
  it("answers 401 for an anonymous caller", async () => {
    signOut();
    const { status } = await submit({ answers: {} });
    expect(status).toBe(401);
  });

  it("answers 403 for a session that has no provisioned user yet", async () => {
    signIn("clerk-never-synced");
    const { status } = await submit({ answers: {} });
    expect(status).toBe(403);
  });
});

describe("POST /api/quiz/submit — the M3 attacker simulation", () => {
  it("ignores difficulty, score and quizId, and pays the real value of the question", async () => {
    const author = await seedUser(db, {});
    const attacker = await seedUser(db, {});
    const question = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "mudah",
      answerKey: "A",
    });

    signIn(attacker.clerkId);

    // This is the payload the deleted /api/quiz/complete endpoint paid 100 VP for.
    const { status, data } = await submit({
      answers: { [question.id]: "A" },
      difficulty: "sangat sulit",
      score: 100,
      wrongAnswers: 0,
      quizId: "random-quiz-id-1",
      pointsAwarded: 999_999,
    });

    expect(status).toBe(200);
    expect(data.pointsAwarded).toBe(5); // the real value of a "mudah" question
    expect(await pointsOf(attacker.id)).toBe(5);
  });

  it("cannot be replayed by inventing a fresh quizId every time", async () => {
    const author = await seedUser(db, {});
    const attacker = await seedUser(db, {});
    const question = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sulit",
      answerKey: "B",
    });

    signIn(attacker.clerkId);

    const first = await submit({ answers: { [question.id]: "B" }, quizId: "run-1" });
    expect(first.data.pointsAwarded).toBe(15);

    // Ten more attempts, each pretending to be a brand-new quiz.
    for (let i = 2; i <= 11; i++) {
      const replay = await submit({ answers: { [question.id]: "B" }, quizId: `run-${i}` });
      expect(replay.data.pointsAwarded).toBe(0);
      expect(replay.data.alreadyCompleted).toBe(true);
    }

    expect(await pointsOf(attacker.id)).toBe(15);
  });

  it("is protected by a database constraint, not by application bookkeeping", async () => {
    const author = await seedUser(db, {});
    const attacker = await seedUser(db, {});
    const question = await seedQuestion(db, { uploaderId: author.id, difficulty: "sedang" });

    const row = {
      userId: attacker.id,
      action: "quiz_answer",
      refId: question.id,
      delta: 10,
    };
    await db.insert(schema.pointsLog).values(row);

    // A second identical row must be rejected by the unique index itself, so
    // even a future code path that forgets to check cannot double-credit.
    await expect(db.insert(schema.pointsLog).values(row)).rejects.toThrow();
  });

  it("pays nothing for a wrong answer, but still uses up the attempt", async () => {
    const author = await seedUser(db, {});
    const student = await seedUser(db, {});
    const question = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sulit",
      answerKey: "C",
    });

    signIn(student.clerkId);

    const wrong = await submit({ answers: { [question.id]: "A" } });
    expect(wrong.data.correctCount).toBe(0);
    expect(wrong.data.pointsAwarded).toBe(0);

    // Answering the same question correctly afterwards earns nothing.
    const late = await submit({ answers: { [question.id]: "C" } });
    expect(late.data.correctCount).toBe(1);
    expect(late.data.pointsAwarded).toBe(0);

    expect(await pointsOf(student.id)).toBe(0);
  });
});

describe("POST /api/quiz/submit — untrusted content cannot earn", () => {
  it("never pays a user for a question they uploaded themselves", async () => {
    const author = await seedUser(db, {});
    const question = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sulit",
      answerKey: "A",
    });

    signIn(author.clerkId);
    const { data } = await submit({ answers: { [question.id]: "A" } });

    expect(data.results[0].correct).toBe(true); // still graded, so the review screen works
    expect(data.pointsAwarded).toBe(0); // but it pays nothing
    expect(await pointsOf(author.id)).toBe(0);
  });

  it("treats browser-only sample ids as ungradeable", async () => {
    const student = await seedUser(db, {});
    signIn(student.clerkId);

    const { data } = await submit({ answers: { q1: "A", q2: "B", quiz_physics: "C" } });

    expect(data.rewardable).toBe(false);
    expect(data.pointsAwarded).toBe(0);
    expect(data.results).toEqual([]);
    expect(await pointsOf(student.id)).toBe(0);
  });

  it("ignores questions that are not approved", async () => {
    const author = await seedUser(db, {});
    const student = await seedUser(db, {});
    const pending = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sulit",
      status: "pending",
    });

    signIn(student.clerkId);
    const { data } = await submit({ answers: { [pending.id]: "A" } });

    expect(data.pointsAwarded).toBe(0);
    expect(await pointsOf(student.id)).toBe(0);
  });

  it("rejects a malformed body", async () => {
    const student = await seedUser(db, {});
    signIn(student.clerkId);

    const { status } = await submit({ difficulty: "sulit", score: 100 });
    expect(status).toBe(400);
  });
});

describe("POST /api/quiz/submit — level rewards", () => {
  it("grants the level-5 bonus when the award crosses the threshold", async () => {
    const author = await seedUser(db, {});
    const student = await seedUser(db, { points: 495 });
    const question = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sedang",
      answerKey: "A",
    });

    signIn(student.clerkId);
    const { data } = await submit({ answers: { [question.id]: "A" } });

    expect(data.pointsAwarded).toBe(10);
    expect(data.levelRewards.length).toBeGreaterThan(0);
    // 495 + 10 (the answer) + 250 (the level-5 bonus)
    expect(await pointsOf(student.id)).toBe(755);
  });
});
