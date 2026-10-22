// tests/integration/exams-moderation.test.ts
// ─── M18: paket ujian ditinjau sebelum tayang ─────────────────────────────────
//
// Sampai M17 paket ujian yang dibuat siapa pun **langsung tayang**. Itu masih
// dapat diterima selama pembuatnya hanya staf, tetapi M18 membuka pembuatan paket
// untuk kontributor — dan satu kunci jawaban yang salah akan menyesatkan setiap
// siswa yang mengerjakan paket itu, bukan hanya penulisnya. "Jangan sampai ujian
// ngawur lolos dan membebani server" adalah alasan fiturnya ada, jadi yang diuji
// di sini adalah **gerbangnya**, bukan tampilannya:
//
//   1. **Kuota** — tiga paket menunggu, dua puluh lima terbit, dan baris
//      `type = 'exam'` tidak boleh memakan kuota modul/soal.
//   2. **Antrean** — hanya peninjau (`requireReviewer`) yang boleh membaca kunci
//      jawaban, dan antreannya tidak pernah memuat modul atau soal.
//   3. **Keputusan** — satu submission diputus tepat sekali (409 pada percobaan
//      kedua), karya sendiri tidak bisa ditinjau, dan kursi tidak boleh meninjau
//      sepuluh besar.
//   4. **Penolakan** tidak menghapus paket, dan paket yang sudah terbit tidak
//      bisa ditarik lewat tombol antrean.
//   5. **Penghapusan** hanya oleh pemilik, dan baris `submissions`-nya ikut pergi.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  apiRequest,
  createTestDb,
  jsonRequest,
  resetTestDb,
  seedUser,
  uniqueId,
  type TestDb,
} from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { POST as createExam } from "@/app/api/exams/create/route";
import { GET as pendingExams } from "@/app/api/exams/pending/route";
import { POST as approveExam } from "@/app/api/exams/approve/route";
import { POST as rejectExam } from "@/app/api/exams/reject/route";
import { DELETE as deleteExam } from "@/app/api/exams/[id]/route";
import * as schema from "@/db/schema";
import { getSeasonKey } from "@/lib/season";
import {
  MAX_PENDING_EXAMS,
  MAX_PUBLISHED_EXAMS,
  pendingExamCount,
  pendingSubmissionCount,
} from "@/lib/submissionQuota";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(async () => {
  authMock.mockReset();
  // Keadaan awal yang sama untuk setiap test: kuota diuji dengan menghitung
  // baris, jadi satu baris sisa dari test sebelumnya akan membuatnya berbohong.
  await resetTestDb(db);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Satu paket dua soal; `answerKey` sengaja ada supaya kebocorannya terlihat. */
function examQuestions() {
  return [
    {
      id: "q0",
      text: "Ibu kota Indonesia?",
      options: { A: "Jakarta", B: "Bandung", C: "Surabaya", D: "Medan", E: "Makassar" },
      answerKey: "A",
    },
    {
      id: "q1",
      text: "2 + 2 = ?",
      options: { A: "3", B: "4", C: "5", D: "6", E: "7" },
      answerKey: "B",
    },
  ];
}

function examBody() {
  return {
    title: "Paket Uji",
    subject: "Matematika",
    category: "UTBK-SNBT",
    difficulty: "Sedang",
    durationMinutes: 30,
    questions: examQuestions(),
  };
}

function signIn(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

/** The handler only reads `x-request-id`; the method is the route's own. */
function deleteRequest(id: string) {
  return new Request(`https://nawa.test/api/exams/${id}`, { method: "DELETE" });
}

async function seedExam(
  authorId: string,
  options: { status?: "pending" | "approved" | "rejected"; title?: string } = {},
) {
  const [row] = await db
    .insert(schema.customExams)
    .values({
      title: options.title ?? uniqueId("Paket"),
      subject: "Matematika",
      category: "UTBK-SNBT",
      difficulty: "Sedang",
      durationMinutes: 30,
      questions: examQuestions(),
      authorId,
      authorName: "Penulis Uji",
      status: options.status ?? "pending",
    })
    .returning();
  return row;
}

async function seedExamSubmission(input: {
  examId: string;
  submitterId: string;
  status?: "pending" | "approved" | "rejected";
  submittedAt?: Date;
}) {
  const [row] = await db
    .insert(schema.submissions)
    .values({
      type: "exam",
      refId: input.examId,
      submitterId: input.submitterId,
      status: input.status ?? "pending",
      ...(input.submittedAt === undefined ? {} : { submittedAt: input.submittedAt }),
    })
    .returning();
  return row;
}

/** A contributor with one pending package, the shape `create` produces. */
async function seedPendingExam(authorId: string, submittedAt?: Date) {
  const exam = await seedExam(authorId, { status: "pending" });
  const submission = await seedExamSubmission({
    examId: exam.id,
    submitterId: authorId,
    ...(submittedAt === undefined ? {} : { submittedAt }),
  });
  return { exam, submission };
}

async function examRow(id: string) {
  return db.query.customExams.findFirst({ where: eq(schema.customExams.id, id) });
}

async function submissionRow(id: string) {
  return db.query.submissions.findFirst({ where: eq(schema.submissions.id, id) });
}

async function mailsFor(userId: string) {
  return db.query.mailOutbox.findMany({ where: eq(schema.mailOutbox.toUserId, userId) });
}

async function auditsFor(entityId: string) {
  return db.query.auditLog.findMany({ where: eq(schema.auditLog.entityId, entityId) });
}

// ── Kuota ────────────────────────────────────────────────────────────────────

describe("POST /api/exams/create — kuota per akun", () => {
  it("answers 409 too_many_pending_exams at three pending packages", async () => {
    const author = await seedUser(db, { role: "contributor" });
    for (let i = 0; i < MAX_PENDING_EXAMS; i += 1) await seedExam(author.id);
    signIn(author.clerkId);

    const response = await createExam(jsonRequest("https://nawa.test/api/exams/create", examBody()));

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("too_many_pending_exams");
  });

  it("answers 409 too_many_exams at twenty-five published packages", async () => {
    const author = await seedUser(db, { role: "contributor" });
    for (let i = 0; i < MAX_PUBLISHED_EXAMS; i += 1) {
      await seedExam(author.id, { status: "approved" });
    }
    signIn(author.clerkId);

    const response = await createExam(jsonRequest("https://nawa.test/api/exams/create", examBody()));

    expect(response.status).toBe(409);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("too_many_exams");
  });

  it("does not spend the module/question quota on a package", async () => {
    // Dua kuota berbeda. Menyatukannya berarti seorang kontributor yang sedang
    // menunggu tiga paket tidak bisa mengajukan satu pun soal — dua permukaan
    // yang saling mengunci tanpa alasan.
    const author = await seedUser(db, { role: "contributor" });
    for (let i = 0; i < MAX_PENDING_EXAMS; i += 1) await seedExam(author.id);
    signIn(author.clerkId);

    expect(await pendingExamCount(db, author.id)).toBe(MAX_PENDING_EXAMS);
    // Kuota modul/soal tetap kosong, meskipun antrean paket sudah penuh.
    expect(await pendingSubmissionCount(db, author.id)).toBe(0);
  });

  it("counts only its own packages toward the pending cap", async () => {
    // `pendingExamCount` menyaring `author_id`. Tanpa saringan itu, satu
    // kontributor sibuk akan mengunci pembuatan paket seluruh platform.
    const author = await seedUser(db, { role: "contributor" });
    const neighbour = await seedUser(db, { role: "contributor" });
    for (let i = 0; i < MAX_PENDING_EXAMS; i += 1) await seedExam(neighbour.id);
    signIn(author.clerkId);

    const response = await createExam(jsonRequest("https://nawa.test/api/exams/create", examBody()));

    expect(response.status).toBe(201);
  });

  it("writes a submissions row of type exam alongside the package", async () => {
    const author = await seedUser(db, { role: "contributor" });
    signIn(author.clerkId);

    const response = await createExam(jsonRequest("https://nawa.test/api/exams/create", examBody()));
    const { examId } = (await response.json()) as { examId: string };

    const queue = await db.query.submissions.findMany({
      where: and(eq(schema.submissions.refId, examId), eq(schema.submissions.type, "exam")),
    });
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe("pending");
    expect(queue[0].submitterId).toBe(author.id);
  });
});

// ── Antrean ──────────────────────────────────────────────────────────────────

describe("GET /api/exams/pending — hanya untuk peninjau", () => {
  it("answers 403 for a student", async () => {
    const student = await seedUser(db, { role: "student" });
    signIn(student.clerkId);

    const response = await pendingExams(apiRequest("/api/exams/pending"));

    expect(response.status).toBe(403);
  });

  it("answers 403 for a contributor, because uploading is not reviewing", async () => {
    const contributor = await seedUser(db, { role: "contributor" });
    signIn(contributor.clerkId);

    const response = await pendingExams(apiRequest("/api/exams/pending"));

    expect(response.status).toBe(403);
  });

  it("sends the answer keys to a moderator, oldest submission first", async () => {
    const author = await seedUser(db, { role: "contributor" });
    // `submittedAt` ditulis eksplisit: `now()` adalah waktu **mulai transaksi**,
    // jadi dua baris yang ditulis berurutan bisa berbagi stempel waktu yang sama
    // dan urutannya menjadi tidak dapat dibuktikan.
    const first = await seedPendingExam(author.id, new Date("2026-01-01T00:00:00Z"));
    const second = await seedPendingExam(author.id, new Date("2026-01-02T00:00:00Z"));
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    const response = await pendingExams(apiRequest("/api/exams/pending"));
    const raw = await response.clone().text();
    const body = (await response.json()) as {
      data: Array<{ submissionId: string; questions: Array<{ answerKey: string }> }>;
    };

    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    // Kunci ikut: peninjau yang tidak melihat kunci tidak bisa memutuskan.
    expect(raw).toContain("answerKey");
    expect(body.data[0].questions[0].answerKey).toBe("A");
    expect(body.data.map((row) => row.submissionId)).toEqual([first.submission.id, second.submission.id]);
  });

  it("lets a season seat read the queue too", async () => {
    const author = await seedUser(db, { role: "contributor" });
    await seedPendingExam(author.id);
    const seat = await seedUser(db, { role: "moderator", seasonRoleKey: getSeasonKey() });
    signIn(seat.clerkId);

    const response = await pendingExams(apiRequest("/api/exams/pending"));

    expect(response.status).toBe(200);
  });

  it("never leaks a module or question submission into the queue", async () => {
    // `api/submissions/pending` dan `api/questions/pending` masing-masing
    // menyaring tipenya sendiri; kalau antrean ini tidak menyaring, satu baris
    // modul akan tampil sebagai paket ujian tanpa soal.
    const author = await seedUser(db, { role: "contributor" });
    await db.insert(schema.submissions).values({
      type: "module",
      refId: crypto.randomUUID(),
      submitterId: author.id,
    });
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    const body = (await (
      await pendingExams(apiRequest("/api/exams/pending"))
    ).json()) as { data: unknown[] };

    expect(body.data).toHaveLength(0);
  });
});

// ── Persetujuan ──────────────────────────────────────────────────────────────

describe("POST /api/exams/approve", () => {
  it("publishes the package, pays 20 points, and records why", async () => {
    const author = await seedUser(db, { role: "contributor", points: 10 });
    const { exam, submission } = await seedPendingExam(author.id);
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    const response = await approveExam(
      jsonRequest("https://nawa.test/api/exams/approve", { submissionId: submission.id }),
    );

    expect(response.status).toBe(200);
    expect((await examRow(exam.id))?.status).toBe("approved");
    expect((await submissionRow(submission.id))?.status).toBe("approved");

    const [updated] = await db
      .select({ points: schema.users.points })
      .from(schema.users)
      .where(eq(schema.users.id, author.id));
    expect(updated.points).toBe(30);

    const paid = await db.query.pointsLog.findMany({
      where: and(eq(schema.pointsLog.userId, author.id), eq(schema.pointsLog.action, "exam_approved")),
    });
    expect(paid).toHaveLength(1);
    expect(paid[0].delta).toBe(20);
    expect(paid[0].refId).toBe(exam.id);

    const audits = await auditsFor(exam.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: moderator.id,
      action: "content.approve",
      entity: "exam",
      before: { status: "pending" },
    });

    const mails = await mailsFor(author.id);
    expect(mails.some((mail) => mail.kind === "exam_approved")).toBe(true);
  });

  it("answers 409 when the same submission is decided twice", async () => {
    const author = await seedUser(db, { role: "contributor" });
    const { submission } = await seedPendingExam(author.id);
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    await approveExam(
      jsonRequest("https://nawa.test/api/exams/approve", { submissionId: submission.id }),
    );
    const second = await approveExam(
      jsonRequest("https://nawa.test/api/exams/approve", { submissionId: submission.id }),
    );

    expect(second.status).toBe(409);
    // Poin tidak dibayar dua kali: klaim `status = 'pending'` yang menjaganya.
    const paid = await db.query.pointsLog.findMany({
      where: and(eq(schema.pointsLog.userId, author.id), eq(schema.pointsLog.action, "exam_approved")),
    });
    expect(paid).toHaveLength(1);
  });

  it("answers 403 self_review_forbidden for the author's own package", async () => {
    const seat = await seedUser(db, { role: "moderator", seasonRoleKey: getSeasonKey() });
    const { submission } = await seedPendingExam(seat.id);
    signIn(seat.clerkId);

    const response = await approveExam(
      jsonRequest("https://nawa.test/api/exams/approve", { submissionId: submission.id }),
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("self_review_forbidden");
  });

  it("answers 403 seat_conflict_of_interest for a top-ten author", async () => {
    const author = await seedUser(db, { role: "contributor", points: 5 });
    const { submission } = await seedPendingExam(author.id);
    const seat = await seedUser(db, { role: "moderator", seasonRoleKey: getSeasonKey() });
    signIn(seat.clerkId);

    const response = await approveExam(
      jsonRequest("https://nawa.test/api/exams/approve", { submissionId: submission.id }),
    );

    // Dengan populasi sekecil ini, penulisnya ada di sepuluh besar.
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("seat_conflict_of_interest");
  });

  it("lets a seat approve an author who is outside the conflict zone", async () => {
    // Sepuluh peserta lain di atas penulis mendorongnya ke peringkat 11, dan di
    // luar zona konflik kursi boleh memutuskan — kalau tidak, kursi tidak bisa
    // meninjau apa pun selama platform masih kecil.
    //
    // `seasonPoints` diisi eksplisit: `effectiveSeasonPoints()` membaca kolom
    // itu (bukan `points`) selama musim berjalan, jadi pengguna yang hanya diberi
    // `points` akan tampak berpoin nol dan semua orang berbagi peringkat 1.
    const author = await seedUser(db, { role: "contributor", points: 0, seasonPoints: 0 });
    for (let i = 0; i < 10; i += 1) {
      await seedUser(db, { points: 100 + i, seasonPoints: 100 + i });
    }
    const { exam, submission } = await seedPendingExam(author.id);
    const seat = await seedUser(db, { role: "moderator", seasonRoleKey: getSeasonKey() });
    signIn(seat.clerkId);

    const response = await approveExam(
      jsonRequest("https://nawa.test/api/exams/approve", { submissionId: submission.id }),
    );

    expect(response.status).toBe(200);
    expect((await examRow(exam.id))?.status).toBe("approved");
  });

  it("promotes the author when the approval crosses the threshold", async () => {
    // Promosi adalah pernyataan **terpisah** setelah poin bertambah: `WHERE
    // points >= 100` pada `UPDATE` yang sama mengevaluasi nilai lama, jadi siswa
    // dengan 90 poin tidak akan pernah lolos.
    const author = await seedUser(db, { role: "student", points: 90 });
    const { submission } = await seedPendingExam(author.id);
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    const response = await approveExam(
      jsonRequest("https://nawa.test/api/exams/approve", { submissionId: submission.id }),
    );

    expect(response.status).toBe(200);
    const [row] = await db
      .select({ role: schema.users.role, points: schema.users.points })
      .from(schema.users)
      .where(eq(schema.users.id, author.id));
    expect(row.points).toBe(110);
    expect(row.role).toBe("contributor");
    expect((await mailsFor(author.id)).some((mail) => mail.kind === "role_promoted")).toBe(true);
  });

  it("leaves the author a student below the threshold", async () => {
    const author = await seedUser(db, { role: "student", points: 0 });
    const { submission } = await seedPendingExam(author.id);
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    await approveExam(
      jsonRequest("https://nawa.test/api/exams/approve", { submissionId: submission.id }),
    );

    const [row] = await db
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, author.id));
    expect(row.role).toBe("student");
  });
});

// ── Penolakan ────────────────────────────────────────────────────────────────

describe("POST /api/exams/reject", () => {
  it("keeps the package as rejected and pays nothing", async () => {
    const author = await seedUser(db, { role: "contributor", points: 40 });
    const { exam, submission } = await seedPendingExam(author.id);
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    const response = await rejectExam(
      jsonRequest("https://nawa.test/api/exams/reject", {
        submissionId: submission.id,
        feedback: "Kunci soal nomor 2 salah.",
      }),
    );

    expect(response.status).toBe(200);
    // Paketnya tetap ada: satu soal yang salah bukan alasan menghapus pekerjaan
    // orang. Penulisnya sendiri yang memutuskan memperbaiki atau menghapus.
    expect((await examRow(exam.id))?.status).toBe("rejected");
    expect((await submissionRow(submission.id))?.status).toBe("rejected");

    const [row] = await db
      .select({ points: schema.users.points })
      .from(schema.users)
      .where(eq(schema.users.id, author.id));
    expect(row.points).toBe(40);

    const mails = await mailsFor(author.id);
    const rejection = mails.find((mail) => mail.kind === "exam_rejected");
    expect(rejection).toBeDefined();
    expect(rejection?.payload).toMatchObject({ reason: "Kunci soal nomor 2 salah." });
  });

  it("answers 409 on a second decision", async () => {
    const author = await seedUser(db, { role: "contributor" });
    const { submission } = await seedPendingExam(author.id);
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    await rejectExam(
      jsonRequest("https://nawa.test/api/exams/reject", { submissionId: submission.id }),
    );
    const second = await rejectExam(
      jsonRequest("https://nawa.test/api/exams/reject", { submissionId: submission.id }),
    );

    expect(second.status).toBe(409);
  });

  it("refuses to reject a package that is already published", async () => {
    // Menarik paket yang sudah terbit berarti mengambil ujian dari siswa yang
    // mungkin sedang mengerjakannya — keputusan yang butuh alurnya sendiri, bukan
    // tombol di samping "setujui".
    const author = await seedUser(db, { role: "contributor" });
    const exam = await seedExam(author.id, { status: "approved" });
    const submission = await seedExamSubmission({ examId: exam.id, submitterId: author.id });
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    const response = await rejectExam(
      jsonRequest("https://nawa.test/api/exams/reject", { submissionId: submission.id }),
    );

    expect(response.status).toBe(409);
    expect((await examRow(exam.id))?.status).toBe("approved");
  });

  it("answers 400 when the submission is a module, not a package", async () => {
    const author = await seedUser(db, { role: "contributor" });
    const [moduleSubmission] = await db
      .insert(schema.submissions)
      .values({ type: "module", refId: crypto.randomUUID(), submitterId: author.id })
      .returning();
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    const response = await rejectExam(
      jsonRequest("https://nawa.test/api/exams/reject", { submissionId: moduleSubmission.id }),
    );

    expect(response.status).toBe(400);
  });
});

// ── Penghapusan ──────────────────────────────────────────────────────────────

describe("DELETE /api/exams/[id]", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("removes the package and its queue row for the owner", async () => {
    const author = await seedUser(db, { role: "contributor" });
    const { exam, submission } = await seedPendingExam(author.id);
    signIn(author.clerkId);

    const response = await deleteExam(
      deleteRequest(exam.id),
      params(exam.id),
    );

    expect(response.status).toBe(200);
    expect(await examRow(exam.id)).toBeUndefined();
    // Baris antrean harus ikut: `submissions.ref_id` tidak punya foreign key,
    // jadi tanpa penghapusan ini antrean menyimpan penunjuk ke paket yang hilang.
    expect(await submissionRow(submission.id)).toBeUndefined();
  });

  it("answers 403 not_owner for another contributor", async () => {
    const author = await seedUser(db, { role: "contributor" });
    const other = await seedUser(db, { role: "contributor" });
    const { exam } = await seedPendingExam(author.id);
    signIn(other.clerkId);

    const response = await deleteExam(
      deleteRequest(exam.id),
      params(exam.id),
    );

    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("not_owner");
    expect(await examRow(exam.id)).toBeDefined();
  });

  it("answers 404 for a malformed id without asking the database", async () => {
    const author = await seedUser(db, { role: "contributor" });
    signIn(author.clerkId);

    const response = await deleteExam(deleteRequest("halo"), params("halo"));

    expect(response.status).toBe(404);
  });

  it("answers 404 for a package that does not exist", async () => {
    const author = await seedUser(db, { role: "contributor" });
    signIn(author.clerkId);

    const missing = crypto.randomUUID();
    const response = await deleteExam(deleteRequest(missing), params(missing));

    expect(response.status).toBe(404);
  });
});
