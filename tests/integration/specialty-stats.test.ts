// tests/integration/specialty-stats.test.ts
// Enam angka di balik lencana spesialis. Yang diuji di sini bukan hanya
// aritmetikanya, tetapi juga dua hal yang salah sebelum M13:
//
//   1. `quizTotal`/`hardQuizzes` dihitung dari aksi `quiz_completed*` yang tidak
//      pernah ditulis siapa pun — jadi selalu nol dan tiga lencana mustahil
//      terbuka. Sekarang sumbernya `quiz_answer` + `questions.difficulty`.
//   2. Angka-angka itu dihitung di JavaScript dari baris yang dimuat, sehingga
//      bergantung pada berapa banyak baris yang kebetulan diambil. Sekarang SQL
//      yang menghitung, jadi hasilnya tidak bergantung pada jendela pemuatan.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { emptySpecialtyStats, getSpecialtyStats } from "@/lib/specialtyStats";
import { createTestDb, seedQuestion, seedUser, uniqueId, type TestDb } from "../helpers/harness";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  // PGlite is in-process; nothing to tear down beyond letting it be collected.
});

async function seedModule(
  uploaderId: string,
  overrides: { subject: string; status: "pending" | "approved" | "rejected"; downloads: number },
) {
  const [row] = await db
    .insert(schema.modules)
    .values({
      title: `Modul ${overrides.subject} ${uniqueId("t")}`,
      subject: overrides.subject,
      grade: "12",
      category: "UTBK",
      contentUrl: "https://store123.public.blob.vercel-storage.com/uploads/u1/modul.pdf",
      uploaderId,
      status: overrides.status,
      downloads: overrides.downloads,
    })
    .returning();
  return row;
}

async function logAnswer(userId: string, action: string, refId: string | null) {
  await db.insert(schema.pointsLog).values({ userId, action, delta: 1, refId });
}

describe("getSpecialtyStats", () => {
  it("returns an empty map when asked about nobody", async () => {
    const stats = await getSpecialtyStats(db, []);
    expect(stats.size).toBe(0);
  });

  it("gives every requested user an entry, even one with no rows at all", async () => {
    const quiet = await seedUser(db, {});
    const stats = await getSpecialtyStats(db, [quiet.id]);

    expect(stats.get(quiet.id)).toEqual(emptySpecialtyStats());
  });

  it("counts only approved content, but every download", async () => {
    const author = await seedUser(db, {});

    await seedModule(author.id, { subject: "Matematika", status: "approved", downloads: 10 });
    await seedModule(author.id, { subject: "Fisika", status: "approved", downloads: 5 });
    // Rejected, but it was downloaded before it was rejected — those downloads
    // really happened, and the old in-memory implementation counted them too.
    await seedModule(author.id, { subject: "Kimia", status: "rejected", downloads: 7 });
    // Pending: neither approved nor a new distinct subject.
    await seedModule(author.id, { subject: "Biologi", status: "pending", downloads: 1 });

    await seedQuestion(db, { uploaderId: author.id, difficulty: "mudah", status: "approved" });
    await seedQuestion(db, { uploaderId: author.id, difficulty: "sedang", status: "approved" });
    await seedQuestion(db, { uploaderId: author.id, difficulty: "sulit", status: "pending" });

    const stats = await getSpecialtyStats(db, [author.id]);
    const entry = stats.get(author.id)!;

    expect(entry.approvedMods).toBe(2);
    expect(entry.diverseSubjects).toBe(2);
    expect(entry.totalDownloads).toBe(23);
    expect(entry.approvedQuestions).toBe(2);
  });

  it("derives quiz totals from answered questions, not from a phantom action", async () => {
    const student = await seedUser(db, {});

    const easy = await seedQuestion(db, { uploaderId: student.id, difficulty: "mudah" });
    const hardOne = await seedQuestion(db, { uploaderId: student.id, difficulty: "sulit" });
    const hardTwo = await seedQuestion(db, { uploaderId: student.id, difficulty: "sulit" });

    await logAnswer(student.id, "quiz_answer", easy.id);
    await logAnswer(student.id, "quiz_answer", hardOne.id);
    await logAnswer(student.id, "quiz_answer", hardTwo.id);
    // A question that has since been deleted: the attempt still counts, but its
    // difficulty is unknowable, so it must not inflate `hardQuizzes`.
    await logAnswer(student.id, "quiz_answer", "00000000-0000-4000-8000-000000000000");

    // Other point actions must not be mistaken for quiz attempts.
    await logAnswer(student.id, "daily_quiz", null);
    await logAnswer(student.id, "module_approved", null);

    const stats = await getSpecialtyStats(db, [student.id]);
    const entry = stats.get(student.id)!;

    expect(entry.quizTotal).toBe(4);
    expect(entry.hardQuizzes).toBe(2);
  });

  it("keeps users apart instead of aggregating everyone together", async () => {
    const first = await seedUser(db, {});
    const second = await seedUser(db, {});

    await seedModule(first.id, { subject: "Matematika", status: "approved", downloads: 3 });
    await seedModule(second.id, { subject: "Sejarah", status: "approved", downloads: 40 });
    await seedModule(second.id, { subject: "Geografi", status: "approved", downloads: 2 });

    const stats = await getSpecialtyStats(db, [first.id, second.id]);

    expect(stats.get(first.id)).toMatchObject({
      approvedMods: 1,
      diverseSubjects: 1,
      totalDownloads: 3,
    });
    expect(stats.get(second.id)).toMatchObject({
      approvedMods: 2,
      diverseSubjects: 2,
      totalDownloads: 42,
    });
  });

  it("does not depend on how many users are asked about", async () => {
    // The query count is fixed at three no matter the length of the list — that
    // is the entire reason this module exists. The assertion is the *shape* of
    // the result, since a fan-out implementation would still return this.
    const users = await Promise.all([seedUser(db, {}), seedUser(db, {}), seedUser(db, {})]);
    const stats = await getSpecialtyStats(db, users.map((u) => u.id));

    expect(stats.size).toBe(3);
    for (const user of users) {
      expect(stats.get(user.id)).toEqual(emptySpecialtyStats());
    }
  });
});
