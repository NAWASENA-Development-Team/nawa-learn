// tests/integration/audit-log.test.ts
// ─── Bukti bahwa keputusan administratif meninggalkan jejak ───────────────────
// Sampai M12, satu-satunya bukti bahwa sebuah soal pernah ditinjau adalah
// `submissions.reviewer_id` — dan kolom itu ditimpa setiap keputusan berikutnya.
// Penolakan bahkan tidak meninggalkan jejak sama sekali: ia tidak memberi poin,
// jadi `points_log` tidak punya baris untuknya.
//
// Yang diuji di sini ada tiga lapis:
//
//   1. `recordAudit` menulis apa adanya, dan **tidak** melempar ketika gagal —
//      karena tindakan yang sudah terjadi tidak boleh dibatalkan oleh kegagalan
//      mencatatnya (Neon HTTP tidak punya transaksi).
//   2. Ketiga route moderasi benar-benar memanggilnya. Sebuah helper yang tidak
//      pernah dipanggil adalah tabel kosong dengan dokumentasi bagus.
//   3. `before`/`after` hanya berisi skalar — tidak ada salinan baris `users`
//      yang menyelinap menjadi PII kedua.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  apiRequest,
  createTestDb,
  jsonRequest,
  seedQuestion,
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
import { POST as approveModule } from "@/app/api/modules/approve/route";
import { POST as approveQuestion } from "@/app/api/questions/approve/route";
import { POST as rejectQuestion } from "@/app/api/questions/reject/route";
import { GET as readAuditLog } from "@/app/api/moderator/audit-log/route";
import * as schema from "@/db/schema";
import { AUDIT_LIST_MAX, listAuditEntries, recordAudit } from "@/lib/auditLog";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  authMock.mockReset();
  // The logger writes to the console by design; silence it so a passing run is
  // not 200 lines of JSON.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

function signIn(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

async function seedModule(uploaderId: string) {
  const [row] = await db
    .insert(schema.modules)
    .values({
      title: uniqueId("Modul"),
      subject: "Matematika",
      grade: "12",
      category: "UTBK",
      contentUrl: "https://example.test/modul.pdf",
      uploaderId,
      status: "pending",
    })
    .returning();
  return row;
}

async function seedSubmission(input: {
  type: "module" | "question";
  refId: string;
  submitterId: string;
}) {
  const [row] = await db
    .insert(schema.submissions)
    .values({ ...input, status: "pending" })
    .returning();
  return row;
}

async function auditRows(entityId: string) {
  return db.query.auditLog.findMany({
    where: eq(schema.auditLog.entityId, entityId),
  });
}

// ─── Helper ───────────────────────────────────────────────────────────────────

describe("recordAudit", () => {
  it("stores actor, action, entity and both snapshots", async () => {
    const actor = await seedUser(db, { role: "moderator" });
    const entityId = crypto.randomUUID();

    const ok = await recordAudit(db, {
      actorId: actor.id,
      action: "content.approve",
      entity: "question",
      entityId,
      before: { status: "pending" },
      after: { status: "approved", pointsAwarded: 25 },
    });

    expect(ok).toBe(true);
    const rows = await auditRows(entityId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: actor.id,
      action: "content.approve",
      entity: "question",
      entityId,
      before: { status: "pending" },
      after: { status: "approved", pointsAwarded: 25 },
    });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
  });

  it("accepts a system action with no actor", async () => {
    const entityId = crypto.randomUUID();

    const ok = await recordAudit(db, {
      actorId: null,
      action: "user.role_change",
      entity: "user",
      entityId,
      before: { role: "student" },
      after: { role: "moderator", source: "cli:db:promote" },
    });

    expect(ok).toBe(true);
    const rows = await auditRows(entityId);
    expect(rows[0].actorId).toBeNull();
  });

  // The single most important behaviour of this helper: an audit write that
  // fails must not take the moderation decision down with it. Neon HTTP has no
  // transactions, so the alternative is writing the audit row *first* — which
  // records a decision that may never have happened.
  it("returns false instead of throwing when the row cannot be written", async () => {
    const entityId = crypto.randomUUID();

    const ok = await recordAudit(db, {
      // No such user: the foreign key refuses the insert.
      actorId: "00000000-0000-0000-0000-000000000000",
      action: "content.reject",
      entity: "question",
      entityId,
      after: { status: "rejected" },
    });

    expect(ok).toBe(false);
    expect(await auditRows(entityId)).toHaveLength(0);
  });
});

describe("listAuditEntries", () => {
  it("filters by entity and entity id", async () => {
    const wanted = crypto.randomUUID();
    const other = crypto.randomUUID();

    await recordAudit(db, { actorId: null, action: "content.approve", entity: "module", entityId: wanted });
    await recordAudit(db, { actorId: null, action: "content.reject", entity: "question", entityId: other });

    const entries = await listAuditEntries(db, { entity: "module", entityId: wanted });

    expect(entries).toHaveLength(1);
    expect(entries[0].entityId).toBe(wanted);
  });

  it("returns the newest entry first", async () => {
    const actor = await seedUser(db, { role: "moderator" });
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();

    await recordAudit(db, { actorId: actor.id, action: "content.approve", entity: "question", entityId: first });
    await recordAudit(db, { actorId: actor.id, action: "content.reject", entity: "question", entityId: second });

    const entries = await listAuditEntries(db, { actorId: actor.id });

    expect(entries.map((entry) => entry.entityId)).toEqual([second, first]);
  });

  // Pin the reason the test above is deterministic. Both rows are written inside
  // this file's single transaction, and `now()` would stamp them identically —
  // that is exactly how CI caught the original `defaultNow()`: it passed here and
  // failed on the runner, where the two inserts landed in the same microsecond.
  // `clock_timestamp()` reads the clock per statement, so the ordering contract
  // holds regardless of transaction boundaries.
  it("stamps two entries written in one transaction with different times", async () => {
    const entityId = crypto.randomUUID();

    await recordAudit(db, { actorId: null, action: "content.approve", entity: "module", entityId });
    await recordAudit(db, { actorId: null, action: "content.reject", entity: "module", entityId });

    const entries = await listAuditEntries(db, { entityId });

    expect(entries).toHaveLength(2);
    expect(entries[0].createdAt.getTime()).not.toBe(entries[1].createdAt.getTime());
  });

  it("never returns more rows than the hard cap, whatever the caller asks for", async () => {
    const entityId = crypto.randomUUID();
    for (let i = 0; i < 3; i += 1) {
      await recordAudit(db, { actorId: null, action: "content.approve", entity: "module", entityId });
    }

    const entries = await listAuditEntries(db, { entityId, limit: AUDIT_LIST_MAX + 5_000 });

    expect(entries).toHaveLength(3);
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

describe("POST /api/modules/approve", () => {
  it("records the approval with the reviewer as actor", async () => {
    const moderator = await seedUser(db, { role: "moderator" });
    const uploader = await seedUser(db, {});
    const mod = await seedModule(uploader.id);
    const submission = await seedSubmission({ type: "module", refId: mod.id, submitterId: uploader.id });
    signIn(moderator.clerkId);

    const response = await approveModule(
      jsonRequest("https://nawa.test/api/modules/approve", { submissionId: submission.id }),
    );

    expect(response.status).toBe(200);
    const rows = await auditRows(mod.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: moderator.id,
      action: "content.approve",
      entity: "module",
      before: { status: "pending" },
    });
    expect((rows[0].after as Record<string, unknown>).status).toBe("approved");
  });
});

describe("POST /api/questions/approve", () => {
  it("records the difficulty-derived reward that was actually paid", async () => {
    const moderator = await seedUser(db, { role: "moderator" });
    const uploader = await seedUser(db, {});
    const question = await seedQuestion(db, { uploaderId: uploader.id, difficulty: "sulit", status: "pending" });
    const submission = await seedSubmission({ type: "question", refId: question.id, submitterId: uploader.id });
    signIn(moderator.clerkId);

    const response = await approveQuestion(
      jsonRequest("https://nawa.test/api/questions/approve", { submissionId: submission.id }),
    );

    expect(response.status).toBe(200);
    const rows = await auditRows(question.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].after).toMatchObject({ status: "approved", pointsAwarded: 40 });
    // The difficulty at decision time is part of the record: the reward table can
    // change, and without it a future reader cannot tell whether 40 was right.
    expect(rows[0].before).toMatchObject({ difficulty: "sulit" });
  });
});

describe("POST /api/questions/reject", () => {
  it("records a rejection even though no points changed hands", async () => {
    const moderator = await seedUser(db, { role: "moderator" });
    const uploader = await seedUser(db, {});
    const question = await seedQuestion(db, { uploaderId: uploader.id, difficulty: "mudah", status: "pending" });
    const submission = await seedSubmission({ type: "question", refId: question.id, submitterId: uploader.id });
    signIn(moderator.clerkId);

    const response = await rejectQuestion(
      jsonRequest("https://nawa.test/api/questions/reject", { submissionId: submission.id }),
    );

    expect(response.status).toBe(200);
    const rows = await auditRows(question.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: moderator.id,
      action: "content.reject",
      entity: "question",
      after: { status: "rejected", submissionId: submission.id },
    });

    // The proof that this row is not redundant with `points_log`: there is none.
    const points = await db.query.pointsLog.findMany({
      where: and(eq(schema.pointsLog.userId, uploader.id), eq(schema.pointsLog.refId, question.id)),
    });
    expect(points).toHaveLength(0);
  });
});

// ─── The read endpoint ────────────────────────────────────────────────────────

describe("GET /api/moderator/audit-log", () => {
  it("returns the trail to a moderator and nothing personal in it", async () => {
    const moderator = await seedUser(db, { role: "moderator", name: "Pak Budi" });
    const entityId = crypto.randomUUID();
    await recordAudit(db, {
      actorId: moderator.id,
      action: "content.approve",
      entity: "module",
      entityId,
      before: { status: "pending" },
      after: { status: "approved", pointsAwarded: 50 },
    });
    signIn(moderator.clerkId);

    const response = await readAuditLog(apiRequest(`/api/moderator/audit-log?entity=module&entityId=${entityId}`));
    const raw = await response.text();

    expect(response.status).toBe(200);
    expect(raw).toContain(entityId);
    // The actor's display name and email are deliberately absent: the trail
    // records *what happened*, and joins to `users` are the caller's problem.
    expect(raw).not.toContain("Pak Budi");
    expect(raw).not.toMatch(/email/i);
  });

  it("refuses an entity it does not know", async () => {
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    const response = await readAuditLog(apiRequest("/api/moderator/audit-log?entity=passwords"));

    expect(response.status).toBe(400);
  });

  it("refuses a limit above the hard cap", async () => {
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    const response = await readAuditLog(
      apiRequest(`/api/moderator/audit-log?limit=${AUDIT_LIST_MAX + 1}`),
    );

    expect(response.status).toBe(400);
  });

  it("refuses a non-uuid filter instead of silently returning nothing", async () => {
    const moderator = await seedUser(db, { role: "moderator" });
    signIn(moderator.clerkId);

    const response = await readAuditLog(apiRequest("/api/moderator/audit-log?actorId=not-a-uuid"));

    expect(response.status).toBe(400);
  });
});
