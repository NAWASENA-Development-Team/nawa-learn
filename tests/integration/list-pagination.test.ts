// tests/integration/list-pagination.test.ts
// Dua daftar yang dulu tidak punya batas atau punya batas tanpa cara melanjutkan.
// Yang diuji: halaman benar-benar dibatasi, kursor menyambung tanpa tumpang
// tindih dan tanpa melewatkan baris, kursor rusak menjawab 400 (bukan diam-diam
// mengulang halaman pertama), dan data rahasia tetap tidak ikut terkirim.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedQuestion, seedUser, uniqueId, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { GET as listApprovedQuestions } from "@/app/api/questions/approved/route";
import { GET as listExams } from "@/app/api/exams/list/route";
import * as schema from "@/db/schema";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(async () => {
  authMock.mockReset();
  authMock.mockResolvedValue({ userId: null } as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
  // One database for the whole file (PGlite is expensive to build), so each test
  // starts from an empty list. Otherwise "the page has 1 row" is really "the
  // page has whatever the previous test left behind".
  await db.delete(schema.questions);
  await db.delete(schema.customExams);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function request(path: string): Request {
  return new Request(`https://nawa.test${path}`);
}

async function seedApproved(overrides: { createdAt: Date; status?: "approved" | "pending" }) {
  const author = await seedUser(db, {});
  const question = await seedQuestion(db, { uploaderId: author.id, difficulty: "mudah" });
  // `seedQuestion` stamps `created_at` with now(); the ordering under test needs
  // explicit, distinct values.
  const [row] = await db
    .update(schema.questions)
    .set({ createdAt: overrides.createdAt, status: overrides.status ?? "approved" })
    .where(eq(schema.questions.id, question.id))
    .returning();
  return row;
}

describe("GET /api/questions/approved", () => {
  it("returns one bounded page and a cursor for the rest", async () => {
    const stamps = [
      new Date("2026-05-05T00:00:00.000Z"),
      new Date("2026-05-04T00:00:00.000Z"),
      new Date("2026-05-03T00:00:00.000Z"),
      new Date("2026-05-02T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z"),
    ];
    for (const createdAt of stamps) await seedApproved({ createdAt });

    const first = await listApprovedQuestions(request("/api/questions/approved?limit=2"));
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as {
      data: { id: string }[];
      nextCursor: string | null;
    };
    expect(firstBody.data).toHaveLength(2);
    expect(firstBody.nextCursor).toBeTruthy();

    const second = await listApprovedQuestions(
      request(`/api/questions/approved?limit=2&cursor=${firstBody.nextCursor}`),
    );
    const secondBody = (await second.json()) as {
      data: { id: string }[];
      nextCursor: string | null;
    };
    expect(secondBody.data).toHaveLength(2);
    expect(secondBody.nextCursor).toBeTruthy();

    const third = await listApprovedQuestions(
      request(`/api/questions/approved?limit=2&cursor=${secondBody.nextCursor}`),
    );
    const thirdBody = (await third.json()) as {
      data: { id: string }[];
      nextCursor: string | null;
    };
    expect(thirdBody.data).toHaveLength(1);
    // No cursor on the last page: a client that follows it forever would spin.
    expect(thirdBody.nextCursor).toBeNull();

    const seen = [...firstBody.data, ...secondBody.data, ...thirdBody.data].map((q) => q.id);
    expect(new Set(seen).size).toBe(5);
  });

  it("answers 400 for a cursor it cannot read", async () => {
    const response = await listApprovedQuestions(
      request("/api/questions/approved?cursor=not-a-real-cursor"),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("never returns a pending question", async () => {
    await seedApproved({ createdAt: new Date("2026-06-01T00:00:00.000Z"), status: "pending" });

    const body = (await (
      await listApprovedQuestions(request("/api/questions/approved"))
    ).json()) as { data: unknown[] };

    expect(body.data).toEqual([]);
  });

  it("falls back to the default page size for a nonsense limit", async () => {
    await seedApproved({ createdAt: new Date("2026-06-01T00:00:00.000Z") });

    const response = await listApprovedQuestions(request("/api/questions/approved?limit=0"));
    const body = (await response.json()) as { data: unknown[] };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it("does not ship answer keys or explanations", async () => {
    await seedApproved({ createdAt: new Date("2026-06-01T00:00:00.000Z") });

    const raw = await (await listApprovedQuestions(request("/api/questions/approved"))).text();

    expect(raw).not.toContain("answerKey");
    expect(raw).not.toContain("explanation");
  });
});

async function seedExam(values: { createdAt: Date; title: string }) {
  const [row] = await db
    .insert(schema.customExams)
    .values({
      title: values.title,
      subject: "Matematika",
      category: "UTBK",
      difficulty: "sedang",
      durationMinutes: 30,
      authorName: "Penyusun",
      createdAt: values.createdAt,
      questions: [
        {
          id: uniqueId("q"),
          text: "Berapa 2 + 2?",
          options: { A: "3", B: "4", C: "5", D: "6", E: "7" },
          answerKey: "B",
        },
      ],
    })
    .returning();
  return row;
}

describe("GET /api/exams/list", () => {
  let signedInClerkId: string;

  beforeEach(async () => {
    const user = await seedUser(db, {});
    signedInClerkId = user.clerkId;
    authMock.mockResolvedValue({ userId: signedInClerkId } as never);
  });

  it("walks the list with a cursor without repeating or skipping an exam", async () => {
    await seedExam({ title: "Ujian Tua", createdAt: new Date("2026-04-01T00:00:00.000Z") });
    await seedExam({ title: "Ujian Tengah", createdAt: new Date("2026-04-02T00:00:00.000Z") });
    await seedExam({ title: "Ujian Baru", createdAt: new Date("2026-04-03T00:00:00.000Z") });

    const first = await listExams(request("/api/exams/list?limit=2"));
    const firstBody = (await first.json()) as {
      data: { id: string; title: string }[];
      nextCursor: string | null;
    };
    expect(firstBody.data.map((e) => e.title)).toEqual(["Ujian Baru", "Ujian Tengah"]);

    const second = await listExams(
      request(`/api/exams/list?limit=2&cursor=${firstBody.nextCursor}`),
    );
    const secondBody = (await second.json()) as {
      data: { id: string; title: string }[];
      nextCursor: string | null;
    };
    expect(secondBody.data.map((e) => e.title)).toEqual(["Ujian Tua"]);
    expect(secondBody.nextCursor).toBeNull();
  });

  it("answers 400 for a malformed cursor, after the auth and rate-limit guards", async () => {
    const response = await listExams(request("/api/exams/list?cursor=%25%25"));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 401 before reading the cursor when nobody is signed in", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const response = await listExams(request("/api/exams/list?cursor=%25%25"));

    expect(response.status).toBe(401);
  });

  it("still redacts answer keys while paginating", async () => {
    await seedExam({ title: "Ujian Rahasia", createdAt: new Date("2026-04-04T00:00:00.000Z") });

    const raw = await (await listExams(request("/api/exams/list"))).text();

    expect(raw).not.toContain("answerKey");
    expect(raw).toContain("Ujian Rahasia");
  });
});
