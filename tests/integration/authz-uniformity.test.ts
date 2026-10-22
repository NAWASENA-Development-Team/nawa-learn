// tests/integration/authz-uniformity.test.ts
// M14d: the four mutating routes below used to hand-roll the same `auth()` +
// `users.findFirst` pair and disagree about what to answer. They all go through
// `requireUser()` now, so this file pins the three things that were actually
// wrong:
//
//   1. **One condition, one answer.** A session with no provisioned row is 403
//      everywhere, never 404 in five places and 403 in the rest.
//   2. **Guard → role → rate limit → body.** `modules/submit` used to parse and
//      validate the payload *before* checking who was calling. The order is
//      observable: an anonymous caller sending garbage must get 401, not 400.
//   3. **H3 is closed.** `exams/create` refuses an anonymous caller and stores
//      the real author instead of `author_id = NULL`.
//
// These four routes were at 0% coverage before this file, which is why the
// ordering bug survived review: nothing was watching.
//
// M18 mengubah siapa yang boleh mengunggah. `modules/submit` dan
// `questions/submit` dulu menolak `role === "student"` dengan 403, dan itu
// menutup satu-satunya jalan menjadi kontributor: peran hanya naik lewat karya
// yang disetujui, sementara karya tidak bisa diajukan sebelum perannya naik.
// Sekarang siswa boleh mengunggah, dan penjaganya tinggal dua: **kursi** (tidak
// boleh mengunggah sama sekali) dan **kuota** (tiga kiriman menunggu). Jadi test
// peran di bawah berganti arah: siswa → 400 (lolos penjaga, gagal skema), kursi
// → 403. `exams/create` tetap butuh kontributor, jadi fixture-nya ikut naik.
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
import { POST as createExam } from "@/app/api/exams/create/route";
import { POST as submitModule } from "@/app/api/modules/submit/route";
import { POST as submitQuestion } from "@/app/api/questions/submit/route";
import { POST as submitReport } from "@/app/api/profile/report/route";
import * as schema from "@/db/schema";
import { getSeasonKey } from "@/lib/season";
import { MAX_PENDING_SUBMISSIONS } from "@/lib/submissionQuota";

const authMock = vi.mocked(auth);

/**
 * Kunci musim yang **sedang berjalan**, bukan literal.
 *
 * `isSeatActive()` membandingkan `season_role_key` dengan musim saat ini, jadi
 * kursi berlabel `"2026-Q4"` berhenti menjadi kursi pada 1 Januari 2027 — dan
 * test ini akan mulai menjawab 400 (bukan 403) tanpa satu baris kode berubah.
 * Memakai `getSeasonKey()` membuatnya tetap benar kapan pun suite dijalankan.
 */
const SEASON_KEY = getSeasonKey();

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

function signOut() {
  authMock.mockResolvedValue({ userId: null } as never);
}

// ── Request bodies ───────────────────────────────────────────────────────────
// Each one is valid on its own, so a rejection can only come from the guard
// under test — not from a typo in the fixture.

function examBody() {
  return {
    title: "Latihan UTBK",
    subject: "Matematika",
    category: "UTBK",
    difficulty: "sedang",
    durationMinutes: 30,
    questions: [
      {
        id: "q1",
        text: "Berapa 1 + 1?",
        options: { A: "1", B: "2", C: "3", D: "4", E: "5" },
        answerKey: "B",
        explanation: null,
      },
    ],
  };
}

function moduleBody() {
  return {
    title: "Modul Aljabar",
    subject: "Matematika",
    grade: "Kelas 10",
    category: "UTBK",
    contentUrl: "https://example.test/modul.pdf",
  };
}

function questionBody() {
  return {
    questionText: "Akar dari 144 adalah?",
    options: { A: "10", B: "11", C: "12", D: "13", E: "14" },
    answerKey: "C",
    explanation: "12 x 12 = 144",
    difficulty: "mudah",
    subject: "Matematika",
    category: "UTBK",
  };
}

function reportBody() {
  return { issueType: "bug", description: "Tombol simpan tidak merespons." };
}

/** Body that fails every schema at once — used only to prove order. */
function garbageBody() {
  return { notAField: true };
}

const post = (path: string, body: unknown) => jsonRequest(`https://nawa.test${path}`, body);

// Explicit column lists rather than `select()`: a table with a union type cannot
// be handed to `.from()` anyway, and naming the column keeps the count honest if
// a column is added later.
async function countExams() {
  return (await db.select({ id: schema.customExams.id }).from(schema.customExams)).length;
}

async function countQuestions() {
  return (await db.select({ id: schema.questions.id }).from(schema.questions)).length;
}

// ── The shared contract ──────────────────────────────────────────────────────

describe("every mutating route answers the same way for the same condition", () => {
  const routes = [
    { name: "exams/create", call: createExam, path: "/api/exams/create", body: examBody },
    { name: "modules/submit", call: submitModule, path: "/api/modules/submit", body: moduleBody },
    {
      name: "questions/submit",
      call: submitQuestion,
      path: "/api/questions/submit",
      body: questionBody,
    },
    { name: "profile/report", call: submitReport, path: "/api/profile/report", body: reportBody },
  ] as const;

  it.each(routes)("$name answers 401 with no session", async ({ call, path, body }) => {
    signOut();
    const response = await call(post(path, body()));
    expect(response.status).toBe(401);
  });

  it.each(routes)("$name answers 403 for a session with no provisioned row", async ({
    call,
    path,
    body,
  }) => {
    // The exact condition five routes used to call 404. A caller who has a
    // session *is* authenticated; the account is merely not provisioned yet.
    signIn(uniqueId("ghost"));
    const response = await call(post(path, body()));
    expect(response.status).toBe(403);
  });
});

// ── Order: guard → role → rate limit → body ──────────────────────────────────

describe("modules/submit — the guard runs before the body is read", () => {
  it("answers 401, not 400, when an anonymous caller sends an invalid body", async () => {
    signOut();
    const response = await submitModule(post("/api/modules/submit", garbageBody()));
    expect(response.status).toBe(401);
  });

  it("answers 400 for a student, because students may submit since M18", async () => {
    // Dulu 403: peran siswa adalah penjaga unggah, dan itu membuat peran tidak
    // pernah bisa naik. Sekarang penjaganya kursi, jadi seorang siswa sampai ke
    // validasi skema — dan body yang tidak valid memang 400.
    const student = await seedUser(db, { role: "student" });
    signIn(student.clerkId);
    const response = await submitModule(post("/api/modules/submit", garbageBody()));
    expect(response.status).toBe(400);
  });

  it("answers 403 for a season seat, before the body is read", async () => {
    // Kursi memegang `role = 'moderator'` selama masa jabatannya, jadi tanpa
    // penjaga `season_role_key` ia otomatis mewarisi hak unggah staf — dan kursi
    // yang boleh mengunggah sekaligus menilai bisa menerbitkan karyanya sendiri.
    const seat = await seedUser(db, { role: "moderator", seasonRoleKey: SEASON_KEY });
    signIn(seat.clerkId);
    const response = await submitModule(post("/api/modules/submit", garbageBody()));
    expect(response.status).toBe(403);

    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("seat_cannot_upload");
  });

  it("still answers 400 once the caller is allowed to submit", async () => {
    const contributor = await seedUser(db, { role: "contributor" });
    signIn(contributor.clerkId);
    const response = await submitModule(post("/api/modules/submit", garbageBody()));
    expect(response.status).toBe(400);
  });
});

describe("questions/submit — the seat is the only uploader forbidden", () => {
  it("accepts a student submission now that contributing is how a student advances", async () => {
    const student = await seedUser(db, { role: "student" });
    signIn(student.clerkId);
    const before = await countQuestions();

    const response = await submitQuestion(post("/api/questions/submit", questionBody()));

    expect(response.status).toBe(201);
    expect(await countQuestions()).toBe(before + 1);
  });

  it("answers 403 for a season seat even with a valid payload", async () => {
    const seat = await seedUser(db, { role: "moderator", seasonRoleKey: SEASON_KEY });
    signIn(seat.clerkId);
    const before = await countQuestions();

    const response = await submitQuestion(post("/api/questions/submit", questionBody()));

    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("seat_cannot_upload");
    expect(await countQuestions()).toBe(before);
  });
});

// ── kuota kiriman ────────────────────────────────────────────────────────────

describe("kuota kiriman — tiga yang menunggu per akun", () => {
  /** Satu baris `submissions` yang belum diputus; jenisnya tidak penting bagi kuota. */
  async function seedPendingSubmission(userId: string, type: "module" | "question") {
    await db.insert(schema.submissions).values({
      type,
      refId: crypto.randomUUID(),
      submitterId: userId,
    });
  }

  it("answers 409 too_many_pending_submissions at three pending", async () => {
    // Sejak M18 setiap siswa boleh mengajukan. Tanpa batas, satu akun bisa
    // membanjiri antrean moderasi sampai peninjau berhenti membacanya — dan
    // antrean yang tidak dibaca adalah antrean yang tidak ada.
    const student = await seedUser(db, { role: "student" });
    for (let i = 0; i < MAX_PENDING_SUBMISSIONS; i += 1) {
      await seedPendingSubmission(student.id, i % 2 === 0 ? "module" : "question");
    }
    signIn(student.clerkId);
    const before = await countQuestions();

    const response = await submitQuestion(post("/api/questions/submit", questionBody()));

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("too_many_pending_submissions");
    // Ditolak berarti tidak ada baris yang ditulis: kuota yang menolak setelah
    // menyimpan bukan kuota.
    expect(await countQuestions()).toBe(before);
  });

  it("counts modules and questions in one budget", async () => {
    // Dua tab, satu peninjau. Kalau anggarannya terpisah, batasnya bisa
    // dilipatgandakan hanya dengan berpindah tab.
    const student = await seedUser(db, { role: "student" });
    for (let i = 0; i < MAX_PENDING_SUBMISSIONS; i += 1) {
      await seedPendingSubmission(student.id, "module");
    }
    signIn(student.clerkId);

    const response = await submitModule(post("/api/modules/submit", moduleBody()));

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("too_many_pending_submissions");
  });

  it("does not count another account's pending rows", async () => {
    const student = await seedUser(db, { role: "student" });
    const neighbour = await seedUser(db, { role: "student" });
    for (let i = 0; i < MAX_PENDING_SUBMISSIONS; i += 1) {
      await seedPendingSubmission(neighbour.id, "module");
    }
    signIn(student.clerkId);

    const response = await submitQuestion(post("/api/questions/submit", questionBody()));

    expect(response.status).toBe(201);
  });

  it("frees the budget once a submission is decided", async () => {
    // Yang dihitung adalah `status = 'pending'`, bukan "pernah mengirim". Kalau
    // sebaliknya, siswa yang tiga kali ditolak tidak akan pernah bisa memperbaiki
    // karyanya — hukuman permanen untuk kesalahan pertama.
    const student = await seedUser(db, { role: "student" });
    for (let i = 0; i < MAX_PENDING_SUBMISSIONS; i += 1) {
      await db.insert(schema.submissions).values({
        type: "question",
        refId: crypto.randomUUID(),
        submitterId: student.id,
        status: "rejected",
      });
    }
    signIn(student.clerkId);

    const response = await submitQuestion(post("/api/questions/submit", questionBody()));

    expect(response.status).toBe(201);
  });
});

// ── exams/create — H3 ────────────────────────────────────────────────────────

describe("POST /api/exams/create (H3)", () => {
  it("stores the real author instead of a NULL author_id", async () => {
    const user = await seedUser(db, { role: "contributor", name: "Budi Santoso" });
    signIn(user.clerkId);

    const response = await createExam(post("/api/exams/create", examBody()));
    expect(response.status).toBe(201);

    const { examId } = (await response.json()) as { examId: string };
    const [row] = await db
      .select()
      .from(schema.customExams)
      .where(eq(schema.customExams.id, examId));

    expect(row.authorId).toBe(user.id);
    expect(row.authorName).toBe("Budi Santoso");
    // M18: paket ujian tidak tayang sebelum ditinjau.
    expect(row.status).toBe("pending");
  });

  it("writes no row at all for an anonymous caller", async () => {
    signOut();
    const before = await countExams();

    const response = await createExam(post("/api/exams/create", examBody()));

    expect(response.status).toBe(401);
    expect(await countExams()).toBe(before);
  });

  it("answers 403 contributor_required for a student", async () => {
    // Paket ujian adalah satu-satunya konten yang tetap butuh peran: ia menilai
    // banyak soal sekaligus dan tidak punya alur "satu kiriman, satu tinjauan"
    // yang bisa dipakai siswa untuk naik peran.
    const student = await seedUser(db, { role: "student" });
    signIn(student.clerkId);
    const before = await countExams();

    const response = await createExam(post("/api/exams/create", examBody()));

    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("contributor_required");
    expect(await countExams()).toBe(before);
  });

  it("answers 403 seat_cannot_upload for a season seat", async () => {
    const seat = await seedUser(db, { role: "moderator", seasonRoleKey: SEASON_KEY });
    signIn(seat.clerkId);
    const before = await countExams();

    const response = await createExam(post("/api/exams/create", examBody()));

    expect(response.status).toBe(403);
    expect(await countExams()).toBe(before);
  });

  it("rejects a payload with an unknown key rather than ignoring it", async () => {
    const user = await seedUser(db, { role: "contributor" });
    signIn(user.clerkId);

    const response = await createExam(
      post("/api/exams/create", { ...examBody(), answerKey: "B" }),
    );

    expect(response.status).toBe(400);
  });
});

// ── The happy paths, so a guard that rejects everything fails too ────────────

describe("the allowed caller still succeeds", () => {
  it("modules/submit inserts the module and its moderation submission", async () => {
    const contributor = await seedUser(db, { role: "contributor" });
    signIn(contributor.clerkId);

    const response = await submitModule(post("/api/modules/submit", moduleBody()));
    expect(response.status).toBe(201);

    const [module] = await db
      .select()
      .from(schema.modules)
      .where(eq(schema.modules.uploaderId, contributor.id));

    expect(module.title).toBe("Modul Aljabar");
    expect(module.status).toBe("pending");

    const [submission] = await db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.refId, module.id));

    expect(submission.type).toBe("module");
    expect(submission.submitterId).toBe(contributor.id);
  });

  it("modules/submit refuses a data: URL", async () => {
    const contributor = await seedUser(db, { role: "contributor" });
    signIn(contributor.clerkId);

    const response = await submitModule(
      post("/api/modules/submit", {
        ...moduleBody(),
        contentUrl: "data:application/pdf;base64,JVBERi0xLjQK",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("questions/submit inserts a pending question for a contributor", async () => {
    const contributor = await seedUser(db, { role: "contributor" });
    signIn(contributor.clerkId);

    const response = await submitQuestion(post("/api/questions/submit", questionBody()));
    expect(response.status).toBe(201);

    const [question] = await db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.uploaderId, contributor.id));

    expect(question.status).toBe("pending");
    expect(question.answerKey).toBe("C");
  });

  it("questions/submit rejects an empty option string", async () => {
    const contributor = await seedUser(db, { role: "contributor" });
    signIn(contributor.clerkId);

    const response = await submitQuestion(
      post("/api/questions/submit", {
        ...questionBody(),
        options: { A: "10", B: "11", C: "12", D: "13", E: "" },
        answerKey: "E",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("profile/report records the report against the caller", async () => {
    const user = await seedUser(db, {});
    signIn(user.clerkId);

    const response = await submitReport(post("/api/profile/report", reportBody()));
    expect(response.status).toBe(201);

    const [report] = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.userId, user.id));

    expect(report.issueType).toBe("bug");
    expect(report.status).toBe("pending");
  });

  it("profile/report refuses an unknown issue type", async () => {
    const user = await seedUser(db, {});
    signIn(user.clerkId);

    const response = await submitReport(
      post("/api/profile/report", { issueType: "spam", description: "Halo dunia" }),
    );

    expect(response.status).toBe(400);
  });
});
