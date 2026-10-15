import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedQuestion, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { GET as getApproved } from "@/app/api/questions/approved/route";
import { GET as getAuthCheck } from "@/app/api/moderator/auth-check/route";

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

function signOut() {
  authMock.mockResolvedValue({ userId: null } as never);
}

// The M3 promise is "the answer key never reaches the browser". That promise is
// only real if it holds at the HTTP boundary, so it is asserted against the raw
// response text, not just against the fields we happen to think about.
describe("GET /api/questions/approved", () => {
  it("never includes answerKey or explanation anywhere in the payload", async () => {
    const uploader = await seedUser(db, {});
    await seedQuestion(db, {
      uploaderId: uploader.id,
      difficulty: "sulit",
      answerKey: "D",
      status: "approved",
    });

    signOut();
    const response = await getApproved();
    const raw = await response.text();

    expect(response.status).toBe(200);
    expect(raw).not.toContain("answerKey");
    expect(raw).not.toContain("explanation");
    expect(raw).not.toContain("answer_key");
  });

  it("returns approved questions and nothing else", async () => {
    const uploader = await seedUser(db, {});
    const approved = await seedQuestion(db, {
      uploaderId: uploader.id,
      difficulty: "mudah",
      status: "approved",
    });
    const pending = await seedQuestion(db, {
      uploaderId: uploader.id,
      difficulty: "mudah",
      status: "pending",
    });

    signOut();
    const body = await (await getApproved()).json();
    const ids = body.data.map((q: { id: string }) => q.id);

    expect(ids).toContain(approved.id);
    expect(ids).not.toContain(pending.id);
  });

  it("flags a user's own questions so the UI can hide them from a quiz run", async () => {
    const me = await seedUser(db, {});
    const someoneElse = await seedUser(db, {});
    const mine = await seedQuestion(db, { uploaderId: me.id, difficulty: "mudah" });
    const theirs = await seedQuestion(db, { uploaderId: someoneElse.id, difficulty: "mudah" });

    signIn(me.clerkId);
    const body = await (await getApproved()).json();
    const byId = new Map(
      body.data.map((q: { id: string; isOwnQuestion: boolean }) => [q.id, q.isOwnQuestion]),
    );

    expect(byId.get(mine.id)).toBe(true);
    expect(byId.get(theirs.id)).toBe(false);
  });
});

// M2 replaced the hardcoded password and the "top 3 by points" shortcut with a
// single role check. These tests are the regression guard for that decision.
describe("GET /api/moderator/auth-check", () => {
  it("reports false for an anonymous visitor", async () => {
    signOut();
    const body = await (await getAuthCheck()).json();
    expect(body.isModerator).toBe(false);
  });

  it("reports false for a session with no provisioned user", async () => {
    signIn("clerk-never-synced");
    const body = await (await getAuthCheck()).json();
    expect(body.isModerator).toBe(false);
  });

  it("reports false for students and contributors", async () => {
    for (const role of ["student", "contributor"] as const) {
      const user = await seedUser(db, { role });
      signIn(user.clerkId);
      const body = await (await getAuthCheck()).json();
      expect(body.isModerator).toBe(false);
    }
  });

  it("reports true for moderators and admins", async () => {
    for (const role of ["moderator", "admin"] as const) {
      const user = await seedUser(db, { role });
      signIn(user.clerkId);
      const body = await (await getAuthCheck()).json();
      expect(body.isModerator).toBe(true);
    }
  });
});
