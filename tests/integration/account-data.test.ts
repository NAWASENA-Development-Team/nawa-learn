// tests/integration/account-data.test.ts
// The two data-subject rights, exercised against real Postgres. Both are
// irreversible in the direction that matters, so the assertions are about what
// is *left* as much as what is gone:
//
//   • export must be complete — the whole point of a DSR is that the person can
//     see everything, including the answer keys they wrote;
//   • deletion must empty the identity without destroying other people's
//     library content, which is why it anonymises instead of deleting the row.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedQuestion, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import * as schema from "@/db/schema";
import { ANONYMOUS_DISPLAY_NAME } from "@/lib/accountConstants";
import { anonymiseAccountByClerkId, collectUserData, deleteAccountData } from "@/lib/accountData";
import { POLICY_VERSION } from "@/lib/policy";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

async function seedModule(uploaderId: string) {
  const [row] = await db
    .insert(schema.modules)
    .values({
      title: "Modul Budi",
      subject: "Matematika",
      grade: "10",
      category: "UTBK",
      contentUrl: "https://example.test/m",
      uploaderId,
      status: "approved",
    })
    .returning();
  return row;
}

async function seedExam(authorId: string) {
  const [row] = await db
    .insert(schema.customExams)
    .values({
      title: "Ujian Budi",
      subject: "Fisika",
      category: "Latihan",
      difficulty: "sedang",
      questions: [{ id: "1", text: "?", options: { A: "a" }, answerKey: "A" }],
      authorId,
      authorName: "Budi",
    })
    .returning();
  return row;
}

describe("collectUserData", () => {
  it("gathers every record tied to the account, keyed in Indonesian", async () => {
    const user = await seedUser(db, { name: "Budi", points: 120 });
    await seedModule(user.id);
    await seedQuestion(db, { uploaderId: user.id, difficulty: "mudah" });
    await seedExam(user.id);
    await db.insert(schema.pointsLog).values({ userId: user.id, action: "quiz_answer", delta: 10 });
    await db.insert(schema.submissions).values({
      type: "module",
      refId: crypto.randomUUID(),
      submitterId: user.id,
      status: "approved",
      feedback: "bagus",
    });
    await db
      .insert(schema.reports)
      .values({ userId: user.id, issueType: "bug", description: "gagal unggah" });

    const data = await collectUserData(db, user.id);

    expect(data.akun.id).toBe(user.id);
    expect(data.akun.name).toBe("Budi");
    expect(data.akun.role).toBe("student");
    expect(data.akun.points).toBe(120);
    expect(data.modul).toHaveLength(1);
    expect(data.soal).toHaveLength(1);
    expect(data.ujian).toHaveLength(1);
    expect(data.poin).toHaveLength(1);
    expect(data.pengajuan).toHaveLength(1);
    expect(data.laporan).toHaveLength(1);
  });

  it("includes the answer key, because this is the owner's own file", async () => {
    const user = await seedUser(db, {});
    await seedQuestion(db, { uploaderId: user.id, difficulty: "sulit", answerKey: "D" });

    const data = await collectUserData(db, user.id);

    expect(JSON.stringify(data.soal)).toContain("answerKey");
    expect(JSON.stringify(data.soal)).toContain("D");
  });

  it("stamps the export with the time and the policy version in force", async () => {
    const user = await seedUser(db, {});

    const data = await collectUserData(db, user.id);

    expect(Number.isNaN(Date.parse(data.exportedAt))).toBe(false);
    expect(data.policyVersion).toBe(POLICY_VERSION);
    expect(data.catatan.length).toBeGreaterThan(0);
  });

  it("includes the modules the user saved, because a saved list is a statement about them", async () => {
    // The module belongs to someone else; the *choice* to save it belongs to this
    // student, and on a shared school PC that choice used to leak to the next
    // person through `localStorage`. It is part of their data now.
    const owner = await seedUser(db, {});
    const saver = await seedUser(db, {});
    const saved = await seedModule(owner.id);
    await db.insert(schema.bookmarks).values({ userId: saver.id, moduleId: saved.id });

    const data = await collectUserData(db, saver.id);

    expect(data.penanda).toHaveLength(1);
    expect(JSON.stringify(data.penanda)).toContain(saved.id);
    // The title is deliberately absent: copying another student's content into
    // this file would add nothing the id does not already say.
    expect(JSON.stringify(data.penanda)).not.toContain("Modul Budi");
  });

  it("returns an empty array, never a missing key, for a user with no content", async () => {
    const user = await seedUser(db, {});

    const data = await collectUserData(db, user.id);

    expect(data.modul).toEqual([]);
    expect(data.soal).toEqual([]);
    expect(data.poin).toEqual([]);
  });

  it("refuses an id that has no row instead of exporting a half-empty file", async () => {
    await expect(collectUserData(db, crypto.randomUUID())).rejects.toThrow(/no user row/);
  });
});

describe("deleteAccountData", () => {
  async function seedFullAccount() {
    const user = await seedUser(db, { name: "Budi", points: 300 });
    await db
      .update(schema.users)
      .set({
        seasonPoints: 50,
        avatarIndex: 4,
        photoUrl: "https://store.public.blob.vercel-storage.com/uploads/x/a.png",
        bio: "bio",
        motto: "motto",
        levelFrame: "gold",
        claimedLevelRewards: [2, 5],
        lastDailyQuizAt: new Date(),
        consentPolicyVersion: POLICY_VERSION,
        consentAcceptedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    const seededModule = await seedModule(user.id);
    const question = await seedQuestion(db, { uploaderId: user.id, difficulty: "mudah" });
    const exam = await seedExam(user.id);
    await db.insert(schema.pointsLog).values({ userId: user.id, action: "quiz_answer", delta: 10 });
    const [submission] = await db
      .insert(schema.submissions)
      .values({
        type: "module",
        refId: crypto.randomUUID(),
        submitterId: user.id,
        status: "approved",
        feedback: "catatan reviewer tentang Budi",
      })
      .returning();
    await db
      .insert(schema.reports)
      .values({ userId: user.id, issueType: "bug", description: "laporan Budi" });
    await db.insert(schema.bookmarks).values({ userId: user.id, moduleId: seededModule.id });

    return { user, seededModule, question, exam, submission };
  }

  it("empties the identity and reports what it removed", async () => {
    const { user } = await seedFullAccount();

    const report = await deleteAccountData(db, user.id);

    expect(report.userId).toBe(user.id);
    expect(report.deleted.reports).toBe(1);
    expect(report.deleted.pointsLog).toBe(1);
    expect(report.deleted.bookmarks).toBe(1);
    expect(report.photoUrlCleared).toContain("blob.vercel-storage.com");

    const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    expect(row).toBeDefined();
    // The row survives — modules/questions/submissions point at it — but it can
    // no longer be mapped to a person or to a Clerk account.
    expect(row?.clerkId).toBe(`deleted:${user.id}`);
    expect(row?.name).toBe(ANONYMOUS_DISPLAY_NAME);
    expect(row?.email).toContain("@deleted.");
    expect(row?.photoUrl).toBeNull();
    expect(row?.bio).toBeNull();
    expect(row?.motto).toBeNull();
    expect(row?.avatarIndex).toBeNull();
    expect(row?.levelFrame).toBeNull();
    expect(row?.claimedLevelRewards).toBeNull();
    expect(row?.lastDailyQuizAt).toBeNull();
    expect(row?.points).toBe(0);
    expect(row?.seasonPoints).toBe(0);
    // Consent is withdrawn with the identity: with no identity there is no
    // processing basis left to record.
    expect(row?.consentPolicyVersion).toBeNull();
    expect(row?.consentAcceptedAt).toBeNull();
  });

  it("deletes the personal records the account owned", async () => {
    const { user } = await seedFullAccount();

    await deleteAccountData(db, user.id);

    const reports = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.userId, user.id));
    const points = await db
      .select()
      .from(schema.pointsLog)
      .where(eq(schema.pointsLog.userId, user.id));
    const saved = await db
      .select()
      .from(schema.bookmarks)
      .where(eq(schema.bookmarks.userId, user.id));
    expect(reports).toEqual([]);
    expect(points).toEqual([]);
    expect(saved).toEqual([]);
  });

  it("keeps other students' library content, only anonymising the author", async () => {
    const { user, seededModule, question, exam } = await seedFullAccount();

    await deleteAccountData(db, user.id);

    // The module and question remain readable — they were never only about the
    // author — and keep pointing at the now-anonymous row.
    const keptModule = await db.query.modules.findFirst({
      where: eq(schema.modules.id, seededModule.id),
    });
    const keptQuestion = await db.query.questions.findFirst({
      where: eq(schema.questions.id, question.id),
    });
    expect(keptModule?.title).toBe("Modul Budi");
    expect(keptModule?.uploaderId).toBe(user.id);
    expect(keptQuestion?.uploaderId).toBe(user.id);

    // The exam's author attribution is replaced rather than left pointing at a
    // person, so the name is gone from the public list.
    const keptExam = await db.query.customExams.findFirst({
      where: eq(schema.customExams.id, exam.id),
    });
    expect(keptExam?.authorId).toBeNull();
    expect(keptExam?.authorName).toBe(ANONYMOUS_DISPLAY_NAME);
  });

  it("clears a reviewer's notes about the user but keeps the moderation record", async () => {
    const { user, submission } = await seedFullAccount();

    const report = await deleteAccountData(db, user.id);

    expect(report.submissionsFeedbackCleared).toBe(1);
    const row = await db.query.submissions.findFirst({
      where: eq(schema.submissions.id, submission.id),
    });
    expect(row).toBeDefined();
    expect(row?.feedback).toBeNull();
    expect(row?.status).toBe("approved");
  });

  it("leaves a different student's account completely untouched", async () => {
    const victim = await seedUser(db, { name: "Ani", points: 90 });
    const { user } = await seedFullAccount();

    await deleteAccountData(db, user.id);

    const other = await db.query.users.findFirst({ where: eq(schema.users.id, victim.id) });
    expect(other?.name).toBe("Ani");
    expect(other?.clerkId).toBe(victim.clerkId);
    expect(other?.points).toBe(90);
  });

  it("cannot be undone by signing up again: the tombstone keeps the row unreachable", async () => {
    const { user } = await seedFullAccount();

    await deleteAccountData(db, user.id);

    // A brand-new Clerk account can never accidentally claim the old row: the
    // tombstone is unique and no longer matches any real clerk_id.
    const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    expect(row?.clerkId).not.toBe(user.clerkId);

    const recreated = await seedUser(db, {});
    expect(recreated.clerkId).not.toBe(row?.clerkId);
  });

  it("refuses an id that has no row", async () => {
    await expect(deleteAccountData(db, crypto.randomUUID())).rejects.toThrow(/no user row/);
  });
});

// The webhook path. It cannot use an internal id — when an account is deleted
// from the Clerk dashboard there is no session and no row id in hand, only the
// `clerk_id` we stored. `tests/integration/clerk-webhook.test.ts` proves the HTTP
// half; this proves the lookup itself, including the two states that must not be
// treated as failures.
describe("anonymiseAccountByClerkId", () => {
  it("finds the row by clerk id and anonymises it", async () => {
    const user = await seedUser(db, { name: "Dewi", points: 120 });

    const result = await anonymiseAccountByClerkId(db, user.clerkId);

    expect(result.found).toBe(true);
    if (!result.found) throw new Error("unreachable");
    expect(result.userId).toBe(user.id);

    const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    expect(row?.name).toBe(ANONYMOUS_DISPLAY_NAME);
    expect(row?.clerkId).toBe(`deleted:${user.id}`);
  });

  it("returns found: false for a clerk id we never stored", async () => {
    const result = await anonymiseAccountByClerkId(db, "clerk_never_seen");

    expect(result).toEqual({ found: false });
  });

  it("returns found: false on a second delivery instead of erasing twice", async () => {
    const user = await seedUser(db, {});

    const first = await anonymiseAccountByClerkId(db, user.clerkId);
    const second = await anonymiseAccountByClerkId(db, user.clerkId);

    expect(first.found).toBe(true);
    expect(second).toEqual({ found: false });
  });
});
