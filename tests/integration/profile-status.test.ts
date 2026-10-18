// tests/integration/profile-status.test.ts
// `GET /api/profile/status` used to be an N+1: one query for the submissions,
// then one query per submission just to look up its title (up to 50), plus one
// per report. These tests pin the *result* of that rewrite — a submission still
// renders the right title, a deleted item still says so, and both kinds are
// merged newest-first — so a future "optimisation" cannot quietly drop a row.
//
// The over-fetching is pinned separately: the old code used `findMany`/`findFirst`
// with no column list, pulling `modules.content_url` and `questions.answer_key`
// into the handler for no reason. The last test asserts neither value can reach
// the response body.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedQuestion, seedUser, uniqueId, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { GET as getStatus } from "@/app/api/profile/status/route";
import * as schema from "@/db/schema";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  authMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function call(): Promise<Response> {
  return getStatus(new Request("https://nawa.test/api/profile/status"));
}

async function signInAs(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

async function seedModule(uploaderId: string) {
  const [row] = await db
    .insert(schema.modules)
    .values({
      title: "Modul Aljabar",
      subject: "Matematika",
      grade: "12",
      category: "UTBK",
      contentUrl: "https://store123.public.blob.vercel-storage.com/uploads/u1/rahasia.pdf",
      uploaderId,
      status: "approved",
    })
    .returning();
  return row;
}

async function seedSubmission(
  submitterId: string,
  values: { type: "module" | "question"; refId: string; submittedAt: Date; status?: "pending" | "approved" | "rejected" },
) {
  const [row] = await db
    .insert(schema.submissions)
    .values({
      type: values.type,
      refId: values.refId,
      submitterId,
      status: values.status ?? "pending",
      submittedAt: values.submittedAt,
    })
    .returning();
  return row;
}

describe("GET /api/profile/status", () => {
  it("answers 401 without a session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);
    const response = await call();
    expect(response.status).toBe(401);
  });

  it("answers 404 when the session has no matching user row", async () => {
    await signInAs(uniqueId("ghost"));
    const response = await call();
    expect(response.status).toBe(404);
  });

  it("answers with an empty list for a user who never submitted anything", async () => {
    const user = await seedUser(db, {});
    await signInAs(user.clerkId);

    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [] });
  });

  it("labels module and question submissions with the title of the thing submitted", async () => {
    const user = await seedUser(db, {});
    const module = await seedModule(user.id);
    const question = await seedQuestion(db, { uploaderId: user.id, difficulty: "sedang" });

    await seedSubmission(user.id, {
      type: "module",
      refId: module.id,
      submittedAt: new Date("2026-02-01T10:00:00.000Z"),
    });
    await seedSubmission(user.id, {
      type: "question",
      refId: question.id,
      submittedAt: new Date("2026-02-02T10:00:00.000Z"),
    });

    await signInAs(user.clerkId);
    const body = (await (await call()).json()) as { data: { title: string; type: string }[] };

    expect(body.data.map((row) => row.title)).toEqual([
      "Soal: Matematika - UTBK",
      "Modul: Modul Aljabar",
    ]);
    expect(body.data.map((row) => row.type)).toEqual(["question", "module"]);
  });

  it("still reports a submission whose target no longer exists", async () => {
    const user = await seedUser(db, {});
    await seedSubmission(user.id, {
      type: "module",
      refId: "00000000-0000-4000-8000-000000000000",
      submittedAt: new Date("2026-02-01T10:00:00.000Z"),
    });

    await signInAs(user.clerkId);
    const body = (await (await call()).json()) as { data: { title: string }[] };

    // The row is the student's history; losing the title must not lose the row.
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe("Item Dihapus");
  });

  it("merges reports with submissions and orders the whole list newest-first", async () => {
    const user = await seedUser(db, {});
    const module = await seedModule(user.id);

    await seedSubmission(user.id, {
      type: "module",
      refId: module.id,
      submittedAt: new Date("2026-03-01T00:00:00.000Z"),
    });
    await db.insert(schema.reports).values({
      userId: user.id,
      issueType: "bug",
      description: "Tombol unggah tidak merespons",
      createdAt: new Date("2026-03-03T00:00:00.000Z"),
    });

    await signInAs(user.clerkId);
    const body = (await (await call()).json()) as {
      data: { type: string; title: string; submittedAt: string }[];
    };

    expect(body.data).toHaveLength(2);
    expect(body.data[0].type).toBe("report");
    expect(body.data[0].title).toBe("Laporan: Bug Sistem");
    expect(body.data[1].type).toBe("module");
    expect(new Date(body.data[0].submittedAt).getTime()).toBeGreaterThan(
      new Date(body.data[1].submittedAt).getTime(),
    );
  });

  it("truncates a long report description instead of shipping all of it", async () => {
    const user = await seedUser(db, {});
    const description = "x".repeat(150);
    await db.insert(schema.reports).values({
      userId: user.id,
      issueType: "other",
      description,
    });

    await signInAs(user.clerkId);
    const body = (await (await call()).json()) as { data: { feedback: string }[] };

    expect(body.data[0].feedback).toHaveLength(103);
    expect(body.data[0].feedback.endsWith("...")).toBe(true);
  });

  it("only ever returns the signed-in user's own rows", async () => {
    const me = await seedUser(db, {});
    const someoneElse = await seedUser(db, {});
    const theirModule = await seedModule(someoneElse.id);

    await seedSubmission(someoneElse.id, {
      type: "module",
      refId: theirModule.id,
      submittedAt: new Date("2026-02-01T10:00:00.000Z"),
    });

    await signInAs(me.clerkId);
    const body = (await (await call()).json()) as { data: unknown[] };

    expect(body.data).toEqual([]);
  });

  it("never reads module content or question answer keys to build a title", async () => {
    const user = await seedUser(db, {});
    const module = await seedModule(user.id);
    const question = await seedQuestion(db, {
      uploaderId: user.id,
      difficulty: "sulit",
      answerKey: "E",
    });

    await seedSubmission(user.id, {
      type: "module",
      refId: module.id,
      submittedAt: new Date("2026-02-01T10:00:00.000Z"),
    });
    await seedSubmission(user.id, {
      type: "question",
      refId: question.id,
      submittedAt: new Date("2026-02-02T10:00:00.000Z"),
    });

    await signInAs(user.clerkId);
    const raw = await (await call()).text();

    expect(raw).not.toContain("rahasia.pdf");
    expect(raw).not.toContain("answerKey");
    expect(raw).not.toContain("answer_key");
  });
});
