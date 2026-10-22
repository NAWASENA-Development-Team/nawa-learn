// tests/integration/exams.test.ts
// H13's regression suite.
//
// The bug was not a missing `if`. It was a route that (a) trusted src/proxy.ts for
// authorization and (b) shipped answer keys to the browser so the browser could
// grade itself. Fixing it means two things must hold at the HTTP boundary: a
// session is required, and the key never leaves the server. Both are asserted here
// against a real Postgres, because the leak lived in the row, not in a mock.
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
import { GET as listExams } from "@/app/api/exams/list/route";
import { POST as submitExam } from "@/app/api/exams/submit/route";
import { GET as modulesCount } from "@/app/api/modules/count/route";
import { POST as modulesDownload } from "@/app/api/modules/download/route";
import { customExams, pointsLog, users } from "@/db/schema";
import { resetInMemoryCounters } from "@/lib/rateLimit";

const authMock = vi.mocked(auth);

const QUESTIONS = [
  {
    id: "custom_x_q0",
    text: "2 + 2 = ?",
    options: { A: "3", B: "4", C: "5", D: "6", E: "7" },
    answerKey: "B",
    explanation: "Aritmetika dasar.",
  },
  {
    id: "custom_x_q1",
    text: "Ibu kota Indonesia?",
    options: { A: "Jakarta", B: "Bandung", C: "Surabaya", D: "Medan", E: "Makassar" },
    answerKey: "A",
    explanation: null,
  },
];

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(async () => {
  authMock.mockReset();
  resetInMemoryCounters();
  // One PGlite instance is shared by the whole file, so a row seeded by an earlier
  // test would silently change what "caps the number of exams" means here.
  await db.delete(customExams);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A signed-in user whose Clerk id resolves to a real row. */
async function signIn(overrides: { role?: "student" | "contributor" } = {}) {
  const user = await seedUser(db, { clerkId: uniqueId("clerk"), ...overrides });
  authMock.mockResolvedValue({ userId: user.clerkId } as never);
  return user;
}

/**
 * Sejak M18 sebuah paket ujian punya status, dan `list` hanya mengirim yang
 * `approved`. Paket di berkas ini adalah fixture untuk kebocoran kunci jawaban,
 * bukan untuk alur peninjauan — jadi default-nya `approved`. Berkas
 * `exams-moderation.test.ts` yang menguji `pending` dan `rejected`.
 */
async function seedExam(
  options: {
    questions?: unknown;
    status?: "pending" | "approved" | "rejected";
    authorId?: string;
    authorName?: string;
  } = {},
) {
  const author = options.authorId
    ? null
    : await seedUser(db, { role: "contributor" });
  const [row] = await db
    .insert(customExams)
    .values({
      title: "Ujian Uji",
      subject: "Matematika",
      category: "UTBK-SNBT",
      difficulty: "Sedang",
      durationMinutes: 30,
      questions: options.questions ?? QUESTIONS,
      authorId: options.authorId ?? author?.id ?? null,
      authorName: options.authorName ?? author?.name ?? "Penulis Uji",
      status: options.status ?? "approved",
    })
    .returning();
  return row;
}

function listRequest(query = "") {
  return new Request(`https://nawa.test/api/exams/list${query}`, {
    method: "GET",
    headers: { "x-request-id": uniqueId("test-req") },
  });
}

describe("GET /api/exams/list", () => {
  it("answers 401 when there is no session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const res = await listExams(listRequest());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: "Unauthorized" });
  });

  it("answers 403 for a session the database has never seen", async () => {
    authMock.mockResolvedValue({ userId: uniqueId("clerk-unknown") } as never);

    const res = await listExams(listRequest());

    expect(res.status).toBe(403);
  });

  it("never sends an answer key to the browser", async () => {
    await signIn();
    await seedExam();

    const res = await listExams(listRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].questions).toHaveLength(2);
    expect(body.data[0].questionCount).toBe(2);
    // The whole point: not "the field is absent on this question" but "the word
    // does not occur anywhere in the response".
    expect(JSON.stringify(body)).not.toContain("answerKey");
    expect(body.data[0].questions[0].answerKey).toBeUndefined();
  });

  it("still sends the question text and options the practice page needs", async () => {
    await signIn();
    await seedExam();

    const body = await (await listExams(listRequest())).json();

    expect(body.data[0].questions[0]).toMatchObject({
      id: "custom_x_q0",
      text: "2 + 2 = ?",
      options: { A: "3", B: "4", C: "5", D: "6", E: "7" },
      explanation: "Aritmetika dasar.",
    });
  });

  it("caps the number of exams it returns", async () => {
    await signIn();
    await seedExam();
    await seedExam();
    await seedExam();

    const body = await (await listExams(listRequest("?limit=2"))).json();

    expect(body.data).toHaveLength(2);
  });

  it("ignores a nonsense limit instead of failing", async () => {
    await signIn();
    await seedExam();

    const body = await (await listExams(listRequest("?limit=abc"))).json();

    expect(body.data).toHaveLength(1);
  });
});

// ── M18: paket ujian harus ditinjau sebelum tayang ───────────────────────────
//
// Sebelum M18 daftar ini mengirim **setiap** paket, dan sejak pembuatan paket
// dibatasi ke kontributor itu berarti satu paket yang belum ditinjau langsung
// bisa dikerjakan siapa pun. Dua lingkup di bawah adalah kontrolnya.
describe("GET /api/exams/list — lingkup (M18)", () => {
  it("hanya mengirim paket approved secara default", async () => {
    await signIn();
    await seedExam({ status: "approved" });
    await seedExam({ status: "pending" });
    await seedExam({ status: "rejected" });

    const body = await (await listExams(listRequest())).json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].status).toBe("approved");
  });

  it("mengirim paket milik pemanggil dalam semua status pada ?mine=1", async () => {
    const me = await signIn({ role: "contributor" });
    await seedExam({ status: "approved", authorId: me.id, authorName: me.name });
    await seedExam({ status: "pending", authorId: me.id, authorName: me.name });
    await seedExam({ status: "rejected", authorId: me.id, authorName: me.name });

    const body = await (await listExams(listRequest("?mine=1"))).json();

    expect(body.data).toHaveLength(3);
    expect(body.data.map((row: { status: string }) => row.status).sort()).toEqual([
      "approved",
      "pending",
      "rejected",
    ]);
    expect(body.data.every((row: { isOwn: boolean }) => row.isOwn)).toBe(true);
  });

  it("tidak memasukkan paket orang lain yang belum tayang ke ?mine=1", async () => {
    const me = await signIn({ role: "contributor" });
    const other = await seedUser(db, { role: "contributor" });
    await seedExam({ status: "pending", authorId: other.id, authorName: other.name });

    const body = await (await listExams(listRequest("?mine=1"))).json();

    expect(body.data).toHaveLength(0);
    expect(me.id).not.toBe(other.id);
  });

  it("menandai isOwn untuk paket sendiri di daftar publik", async () => {
    const me = await signIn({ role: "contributor" });
    await seedExam({ status: "approved", authorId: me.id, authorName: me.name });

    const body = await (await listExams(listRequest())).json();

    expect(body.data[0].isOwn).toBe(true);
  });
});

describe("POST /api/exams/submit", () => {
  it("answers 401 when there is no session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const res = await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: "3f1a5b2c-4d5e-4f60-8a9b-0c1d2e3f4a5b",
      answers: {},
    }));

    expect(res.status).toBe(401);
  });

  it("answers 404 for an exam that does not exist", async () => {
    await signIn();

    const res = await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: "3f1a5b2c-4d5e-4f60-8a9b-0c1d2e3f4a5b",
      answers: {},
    }));

    expect(res.status).toBe(404);
  });

  it("answers 400 for an exam id that is not a uuid", async () => {
    await signIn();

    const res = await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: "custom_1",
      answers: {},
    }));

    expect(res.status).toBe(400);
  });

  it("grades server-side and hands back the keys for review only", async () => {
    await signIn();
    const exam = await seedExam();

    const res = await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: exam.id,
      answers: { custom_x_q0: "B", custom_x_q1: "E" },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.correctCount).toBe(1);
    expect(body.totalCount).toBe(2);
    expect(body.wrongAnswers).toBe(1);
    expect(body.results).toEqual([
      { questionId: "custom_x_q0", correct: true, correctKey: "B" },
      { questionId: "custom_x_q1", correct: false, correctKey: "A" },
    ]);
  });

  it("never pays out, whatever the score", async () => {
    const user = await signIn();
    const exam = await seedExam();

    const res = await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: exam.id,
      answers: { custom_x_q0: "B", custom_x_q1: "A" },
    }));
    const body = await res.json();

    expect(body.rewardable).toBe(false);
    expect(body.pointsAwarded).toBe(0);
    expect(body.creditedCount).toBe(0);
    expect(body.levelRewards).toEqual([]);

    // The claim is "nothing moved", so check the tables rather than the payload.
    const [row] = await db.select({ points: users.points, seasonPoints: users.seasonPoints })
      .from(users).where(eq(users.id, user.id));
    expect(row).toEqual({ points: 0, seasonPoints: 0 });
    expect(await db.select({ id: pointsLog.id }).from(pointsLog)).toHaveLength(0);
  });

  it("ignores an answer for a question the exam does not contain", async () => {
    await signIn();
    const exam = await seedExam();

    const body = await (await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: exam.id,
      answers: { custom_x_q0: "B", "not-in-this-exam": "A" },
    }))).json();

    expect(body.results).toHaveLength(2);
    expect(body.correctCount).toBe(1);
  });

  it("refuses a body that tries to declare its own score", async () => {
    await signIn();
    const exam = await seedExam();

    const res = await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: exam.id,
      answers: { custom_x_q0: "B" },
      correctCount: 99,
    }));

    expect(res.status).toBe(400);
  });

  it("grades a row whose blob is malformed without crashing", async () => {
    await signIn();
    const exam = await seedExam({ questions: { not: "an array" } });

    const res = await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: exam.id,
      answers: { anything: "A" },
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ correctCount: 0, totalCount: 0, results: [] });
  });

  // ── M18: status dan kepemilikan ──
  it("answers 404 for a package that is still pending", async () => {
    await signIn();
    const exam = await seedExam({ status: "pending" });

    const res = await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: exam.id,
      answers: { custom_x_q0: "B" },
    }));

    // 404, bukan 403: bagi siswa, paket yang belum tayang memang tidak ada.
    expect(res.status).toBe(404);
  });

  it("answers 404 for a rejected package", async () => {
    await signIn();
    const exam = await seedExam({ status: "rejected" });

    const res = await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: exam.id,
      answers: { custom_x_q0: "B" },
    }));

    expect(res.status).toBe(404);
  });

  it("answers 403 own_exam_forbidden for the author's own package", async () => {
    const author = await signIn({ role: "contributor" });
    const exam = await seedExam({ authorId: author.id, authorName: author.name });

    const res = await submitExam(jsonRequest("https://nawa.test/api/exams/submit", {
      examId: exam.id,
      answers: { custom_x_q0: "B", custom_x_q1: "A" },
    }));

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("own_exam_forbidden");
  });
});

// These two routes had no in-handler authorization at all: src/proxy.ts was their
// only gate, and while the proxy file sat at the repo root it was never loaded.
describe("routes that relied on the proxy alone", () => {
  it("GET /api/modules/count answers 401 when there is no session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const res = await modulesCount(new Request("https://nawa.test/api/modules/count"));

    expect(res.status).toBe(401);
  });

  it("POST /api/modules/download answers 401 when there is no session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const res = await modulesDownload(jsonRequest("https://nawa.test/api/modules/download", {
      moduleId: "3f1a5b2c-4d5e-4f60-8a9b-0c1d2e3f4a5b",
    }));

    expect(res.status).toBe(401);
  });

  it("rejects an anonymous download before it reads the body", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const res = await modulesDownload(new Request("https://nawa.test/api/modules/download", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json at all",
    }));

    expect(res.status).toBe(401);
  });
});
