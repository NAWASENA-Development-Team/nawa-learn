// tests/integration/daily-quiz.test.ts
// Ekonomi kuis harian setelah M16: satu slot per hari, bukti partisipasi yang
// terpisah dari buku besar poin, dan batas hak unggah pemegang kursi.
//
// Tiga cacat yang dijaga di sini:
//
//   1. `daily-create` dulu menyisipkan soal tanpa memeriksa apa pun, jadi tiga
//      peninjau yang membuat soal pukul 03:00 menghasilkan tiga soal dan tidak
//      ada satu pun yang bisa disebut "kuis hari ini". Sekarang primary key
//      `daily_quiz_slot.window_start` yang memutuskan, dan yang kalah balapan
//      menghapus soalnya sendiri.
//   2. `daily-claim` dulu menyimpulkan "sudah mengerjakan" dari `points_log`,
//      yang hanya berisi jawaban **dibayar** — jadi pengguna paling rajin justru
//      kehilangan +25 secara permanen. Bukti sekarang `daily_activity`, ditulis
//      setiap kali soal kuis harian dikirim, dibayar maupun tidak.
//   3. Kursi Dewan Podium memegang `role = 'moderator'` selama masa jabatan,
//      sehingga tanpa penjaga ia mewarisi hak unggah staf dan bisa menjadi
//      penulis sekaligus penilai karyanya sendiri.
//
// M18 mengubah **bentuk** kuis harian: satu soal, satu percobaan, dan hadiah
// hanya untuk jawaban benar. Berkas ini sekarang juga menjaga:
//
//   4. `ensureDailySlot()` memilih soal secara deterministik (tertua yang belum
//      pernah menjadi slot), sehingga bank berputar dan halaman serta cron tidak
//      bisa menampilkan soal berbeda pada hari yang sama.
//   5. `credited` mengikuti uangnya, bukan keberhasilan INSERT: jawaban salah
//      menulis baris `points_log` dengan `delta = 0`, dan dulu baris itu
//      dilaporkan sebagai "poin diterima".
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createTestDb,
  resetTestDb,
  seedQuestion,
  seedUser,
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
import * as schema from "@/db/schema";
import { POST as dailyCreate } from "@/app/api/questions/daily-create/route";
import { POST as questionSubmit } from "@/app/api/questions/submit/route";
import { POST as moduleSubmit } from "@/app/api/modules/submit/route";
import { POST as quizSubmit } from "@/app/api/quiz/submit/route";
import { ensureDailySlot } from "@/lib/dailySession";
import { startOfDailyWindow } from "@/lib/dailyWindow";
import { getSeasonKey } from "@/lib/season";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(async () => {
  authMock.mockReset();
  // `daily_quiz_slot` berkunci pada `window_start`, dan soal harian dipilih dari
  // **seluruh** bank soal yang disetujui. Dua hal itu membuat sisa data dari test
  // sebelumnya ikut menjadi kandidat — test ini akan lulus atau gagal tergantung
  // urutan, bukan tergantung kode. Database dibersihkan utuh, bukan satu tabel.
  await resetTestDb(db);
});

function signIn(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

function dailyBody(text: string) {
  return {
    questionText: text,
    options: { A: "satu", B: "dua", C: "tiga", D: "empat" },
    answerKey: "B",
    difficulty: "sedang",
  };
}

async function createDaily(clerkId: string, text: string) {
  signIn(clerkId);
  const response = await dailyCreate(
    new Request("https://nawa.test/api/questions/daily-create", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "test" },
      body: JSON.stringify(dailyBody(text)),
    }),
  );
  return { status: response.status, data: await response.json() };
}

async function answer(questionId: string, key = "A") {
  const response = await quizSubmit(
    new Request("https://nawa.test/api/quiz/submit", {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": "test" },
      body: JSON.stringify({ answers: { [questionId]: key } }),
    }),
  );
  return { status: response.status, data: await response.json() };
}

async function todayRows(userId: string) {
  return db
    .select()
    .from(schema.dailyActivity)
    .where(
      and(
        eq(schema.dailyActivity.userId, userId),
        eq(schema.dailyActivity.windowStart, startOfDailyWindow()),
      ),
    );
}

async function activityCount(userId: string): Promise<number> {
  return (await todayRows(userId)).length;
}

describe("POST /api/questions/daily-create — satu hari, satu slot", () => {
  it("membuat soal dan mengklaim slot hari ini", async () => {
    const reviewer = await seedUser(db, { clerkId: "kurator_satu", role: "moderator" });

    const { status, data } = await createDaily(reviewer.clerkId, "Ibu kota Indonesia adalah");

    expect(status).toBe(200);
    expect(data.success).toBe(true);

    const [slot] = await db.select().from(schema.dailyQuizSlot);
    expect(slot.questionId).toBe(data.questionId);
    expect(slot.authorId).toBe(reviewer.id);
  });

  it("menolak kurasi kedua pada hari yang sama dan menghapus soal yatimnya", async () => {
    const first = await seedUser(db, { clerkId: "kurator_awal", role: "moderator" });
    const second = await seedUser(db, { clerkId: "kurator_kedua", role: "moderator" });

    const winner = await createDaily(first.clerkId, "Soal pagi hari ini");
    expect(winner.status).toBe(200);

    const loser = await createDaily(second.clerkId, "Soal siang yang kalah balapan");

    expect(loser.status).toBe(409);
    expect(loser.data.code).toBe("daily_slot_taken");

    // Slot tetap milik pemenang...
    const slots = await db.select().from(schema.dailyQuizSlot);
    expect(slots).toHaveLength(1);
    expect(slots[0].questionId).toBe(winner.data.questionId);

    // ...dan soal yang kalah tidak tertinggal sebagai `approved` yatim.
    const orphans = await db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.questionText, "Soal siang yang kalah balapan"));
    expect(orphans).toHaveLength(0);
  });

  it("mengizinkan pemegang kursi Dewan Podium membuat soal kuis harian", async () => {
    // Kursi boleh membuat soal kuis harian (kemampuan yang dijanjikan M16) —
    // yang dilarang adalah mengunggah modul/soal latihan.
    const seat = await seedUser(db, {
      clerkId: "kursi_kurator",
      role: "moderator",
      seasonRoleKey: getSeasonKey(),
    });

    const { status } = await createDaily(seat.clerkId, "Soal dari pemegang kursi");
    expect(status).toBe(200);
  });

  it("menolak siswa biasa", async () => {
    const student = await seedUser(db, { clerkId: "siswa_kurator" });
    const { status } = await createDaily(student.clerkId, "Soal dari siswa");
    expect(status).toBe(403);
  });
});

describe("POST /api/quiz/submit — satu soal harian, satu percobaan", () => {
  it("mencatat daily_activity untuk soal slot hari ini", async () => {
    const author = await seedUser(db, { clerkId: "penulis_harian", role: "moderator" });
    const student = await seedUser(db, { clerkId: "siswa_harian" });
    const question = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sedang",
      answerKey: "A",
    });

    signIn(student.clerkId);
    const { status } = await answer(question.id, "A");

    expect(status).toBe(200);
    const rows = await todayRows(student.id);
    expect(rows).toHaveLength(1);
    // Bank soal hanya berisi satu soal, jadi `ensureDailySlot()` menjadikannya
    // soal hari ini — kategori tidak lagi menentukan apa pun.
    expect(rows[0].questionId).toBe(question.id);
    expect(rows[0].isCorrect).toBe(true);
  });

  it("menandai jawaban salah sebagai is_correct = false", async () => {
    const author = await seedUser(db, { clerkId: "penulis_salah", role: "moderator" });
    const student = await seedUser(db, { clerkId: "siswa_salah" });
    const question = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sedang",
      answerKey: "A",
    });

    signIn(student.clerkId);
    await answer(question.id, "B");

    const rows = await todayRows(student.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].isCorrect).toBe(false);
  });

  it("tidak menandai jawaban salah sebagai credited", async () => {
    // Cacat M17: baris `points_log` dengan `delta = 0` tetap membuat `credited`
    // bernilai true, jadi UI menampilkan "poin diterima" untuk jawaban salah.
    const author = await seedUser(db, { clerkId: "penulis_credited", role: "moderator" });
    const student = await seedUser(db, { clerkId: "siswa_credited" });
    const question = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sulit",
      answerKey: "A",
    });

    signIn(student.clerkId);
    const { data } = await answer(question.id, "C");

    expect(data.results?.[0]?.correct).toBe(false);
    expect(data.results?.[0]?.credited).toBe(false);
    expect(data.pointsAwarded).toBe(0);
    // Percobaannya tetap tercatat — karena itu `alreadyCompleted` tidak boleh
    // dihitung dari `creditedCount`.
    expect(data.alreadyCompleted).toBe(false);
  });

  it("tidak mencatat daily_activity untuk soal latihan biasa", async () => {
    const author = await seedUser(db, { clerkId: "penulis_latihan", role: "moderator" });
    const student = await seedUser(db, { clerkId: "siswa_latihan" });
    const dailyQuestion = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "mudah",
      answerKey: "A",
    });
    const practice = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "mudah",
      answerKey: "A",
    });

    await db.insert(schema.dailyQuizSlot).values({
      windowStart: startOfDailyWindow(),
      questionId: dailyQuestion.id,
      authorId: null,
    });

    signIn(student.clerkId);
    await answer(practice.id, "A");

    expect(await activityCount(student.id)).toBe(0);
  });

  it("tidak menimpa percobaan pertama pada jendela yang sama", async () => {
    const author = await seedUser(db, { clerkId: "penulis_sekali", role: "moderator" });
    const student = await seedUser(db, { clerkId: "siswa_sekali" });
    const question = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sedang",
      answerKey: "A",
    });

    signIn(student.clerkId);
    await answer(question.id, "A");
    await answer(question.id, "B");

    const rows = await todayRows(student.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].isCorrect).toBe(true);
  });

  it("melewati soal milik penjawabnya sendiri", async () => {
    // Menjawab soal sendiri bukan ujian, dan `quiz/submit` menolak membayar
    // karya sendiri. Kalau soal slot adalah karya penjawabnya, ia mendapat soal
    // lain — dan menjawab soalnya sendiri tidak menghasilkan bukti partisipasi.
    const author = await seedUser(db, { clerkId: "penulis_sendiri", role: "contributor" });
    const other = await seedUser(db, { clerkId: "penulis_lain", role: "moderator" });
    const own = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "mudah",
      answerKey: "A",
    });
    const alternative = await seedQuestion(db, {
      uploaderId: other.id,
      difficulty: "mudah",
      answerKey: "A",
    });

    await db.insert(schema.dailyQuizSlot).values({
      windowStart: startOfDailyWindow(),
      questionId: own.id,
      authorId: null,
    });

    signIn(author.clerkId);
    await answer(own.id, "A");
    expect(await activityCount(author.id)).toBe(0);

    await answer(alternative.id, "A");
    expect(await activityCount(author.id)).toBe(1);
  });

  it("tetap mencatat bukti walau poin tidak dibayarkan (soal sudah pernah dijawab)", async () => {
    // Inilah cacat aslinya: `points_log` tidak mendapat baris kedua, jadi dulu
    // pengguna yang menjawab ulang kehilangan hadiah hariannya selamanya.
    const author = await seedUser(db, { clerkId: "penulis_ulang", role: "moderator" });
    const student = await seedUser(db, { clerkId: "siswa_ulang" });
    const question = await seedQuestion(db, {
      uploaderId: author.id,
      difficulty: "sedang",
      answerKey: "A",
    });

    signIn(student.clerkId);
    await answer(question.id, "A");

    // Jendela berikutnya: bukti hari ini dihapus, soal yang sama dijawab lagi.
    await db
      .delete(schema.dailyActivity)
      .where(eq(schema.dailyActivity.userId, student.id));

    const second = await answer(question.id, "A");
    expect(second.data.results?.[0]?.correct).toBe(true);
    expect(second.data.results?.[0]?.credited).toBe(false);
    expect(await activityCount(student.id)).toBe(1);
  });
});

describe("ensureDailySlot — satu slot, deterministik", () => {
  it("mengisi slot dengan soal tertua yang belum pernah menjadi slot", async () => {
    const author = await seedUser(db, { clerkId: "kurator_slot", role: "moderator" });
    const oldest = await seedQuestion(db, { uploaderId: author.id, difficulty: "mudah" });
    const newer = await seedQuestion(db, { uploaderId: author.id, difficulty: "sedang" });
    // Urutan dipatok eksplisit: `created_at` dua sisipan berurutan bisa jatuh di
    // mikrodetik yang sama, dan test ini menguji urutannya, bukan kebetulan itu.
    await db
      .update(schema.questions)
      .set({ createdAt: new Date("2026-01-01T00:00:00.000Z") })
      .where(eq(schema.questions.id, oldest.id));
    await db
      .update(schema.questions)
      .set({ createdAt: new Date("2026-01-02T00:00:00.000Z") })
      .where(eq(schema.questions.id, newer.id));

    const slot = await ensureDailySlot(db);

    expect(slot.filled).toBe(true);
    expect(slot.questionId).toBe(oldest.id);
  });

  it("tidak mengisi ulang slot yang sudah ada", async () => {
    const author = await seedUser(db, { clerkId: "kurator_isi", role: "moderator" });
    await seedQuestion(db, { uploaderId: author.id, difficulty: "mudah" });
    const picked = await seedQuestion(db, { uploaderId: author.id, difficulty: "sedang" });

    await db.insert(schema.dailyQuizSlot).values({
      windowStart: startOfDailyWindow(),
      questionId: picked.id,
      authorId: null,
    });

    const slot = await ensureDailySlot(db);

    expect(slot.filled).toBe(false);
    expect(slot.questionId).toBe(picked.id);
  });

  it("berputar: soal yang pernah menjadi slot tidak dipilih lagi", async () => {
    const author = await seedUser(db, { clerkId: "kurator_putar", role: "moderator" });
    await seedQuestion(db, { uploaderId: author.id, difficulty: "mudah" });
    await seedQuestion(db, { uploaderId: author.id, difficulty: "sedang" });

    const today = await ensureDailySlot(db);
    expect(today.questionId).not.toBeNull();

    const tomorrow = new Date(startOfDailyWindow().getTime() + 24 * 60 * 60 * 1000);
    const next = await ensureDailySlot(db, { now: tomorrow });

    // Yang diuji adalah **perputaran**, bukan soal mana yang lebih dulu lahir:
    // dua sisipan berurutan bisa berbagi `created_at` yang sama.
    expect(next.filled).toBe(true);
    expect(next.questionId).not.toBeNull();
    expect(next.questionId).not.toBe(today.questionId);
  });

  it("mengembalikan slot kosong bila belum ada soal yang disetujui", async () => {
    const author = await seedUser(db, { clerkId: "kurator_kosong", role: "moderator" });
    await seedQuestion(db, { uploaderId: author.id, difficulty: "mudah", status: "pending" });

    const slot = await ensureDailySlot(db);

    expect(slot.filled).toBe(false);
    expect(slot.questionId).toBeNull();
    expect(await db.select().from(schema.dailyQuizSlot)).toHaveLength(0);
  });
});

describe("batas hak unggah pemegang kursi", () => {
  it("menolak unggah soal dari pemegang kursi dengan seat_cannot_upload", async () => {
    const seat = await seedUser(db, {
      clerkId: "kursi_unggah_soal",
      role: "moderator",
      seasonRoleKey: getSeasonKey(),
    });

    signIn(seat.clerkId);
    const response = await questionSubmit(
      new Request("https://nawa.test/api/questions/submit", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "test" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("seat_cannot_upload");
  });

  it("menolak unggah modul dari pemegang kursi dengan seat_cannot_upload", async () => {
    const seat = await seedUser(db, {
      clerkId: "kursi_unggah_modul",
      role: "moderator",
      seasonRoleKey: getSeasonKey(),
    });

    signIn(seat.clerkId);
    const response = await moduleSubmit(
      new Request("https://nawa.test/api/modules/submit", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "test" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("seat_cannot_upload");
  });

  it("tetap mengizinkan moderator manusia mengunggah (tidak kena penjaga kursi)", async () => {
    const human = await seedUser(db, {
      clerkId: "moderator_unggah",
      role: "moderator",
      seasonRoleKey: null,
    });

    signIn(human.clerkId);
    const response = await questionSubmit(
      new Request("https://nawa.test/api/questions/submit", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "test" },
        body: JSON.stringify({}),
      }),
    );

    // Body kosong gagal validasi (400), bukan ditolak oleh penjaga kursi (403):
    // staf manusia melewati penjaga itu.
    expect(response.status).not.toBe(403);
    expect(await response.json()).toHaveProperty("error");
  });
});

describe("daily_activity — satu bukti per jendela", () => {
  it("idempoten per pengguna per jendela", async () => {
    const student = await seedUser(db, { clerkId: "siswa_idempoten" });
    const windowStart = startOfDailyWindow();

    await db.insert(schema.dailyActivity).values({ userId: student.id, windowStart });
    await db
      .insert(schema.dailyActivity)
      .values({ userId: student.id, windowStart })
      .onConflictDoNothing();

    expect(await activityCount(student.id)).toBe(1);
  });

  it("jendela berikutnya adalah baris terpisah", async () => {
    const student = await seedUser(db, { clerkId: "siswa_dua_jendela" });
    const today = startOfDailyWindow();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    await db.insert(schema.dailyActivity).values([
      { userId: student.id, windowStart: yesterday },
      { userId: student.id, windowStart: today },
    ]);

    const rows = await db
      .select()
      .from(schema.dailyActivity)
      .where(eq(schema.dailyActivity.userId, student.id));
    expect(rows).toHaveLength(2);
  });
});
