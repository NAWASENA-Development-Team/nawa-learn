// tests/integration/promotion.test.ts
// ─── Satu pintu, satu ambang (M18) ────────────────────────────────────────────
//
// Sebelum M18 peran naik **tanpa ambang**: `quiz/submit`, `quiz/daily-claim`,
// `modules/approve` dan `questions/approve` masing-masing menempelkan
//
//   CASE WHEN role = 'student' THEN 'contributor'::role ELSE role END
//
// pada `UPDATE` poinnya. Satu jawaban benar sudah cukup, dan itulah yang terjadi
// di produksi: dua kontributor dengan total dua baris `quiz_answer`.
//
// Yang diuji di sini adalah `promoteIfEligible` sebagai satu-satunya pintu:
//
//   1. **Ambang** — 99 tidak, 100 ya. Batasnya inklusif, dan itu dikunci di sini
//      supaya tidak bergeser tanpa ada yang memperhatikan.
//   2. **Hanya `student`** — kontributor, moderator, dan pemegang kursi tidak
//      pernah tersentuh, berapa pun poinnya. Peran mereka bukan hadiah poin.
//   3. **Idempoten** — `RETURNING` kosong berarti tidak ada audit kedua dan tidak
//      ada surel kedua. Dua approval yang balapan tidak menghasilkan dua kabar.
//   4. **Tidak pernah melempar** — approval yang memicunya sudah terjadi, jadi
//      kegagalan promosi dicatat, bukan dilempar.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  createTestDb,
  resetTestDb,
  seedUser,
  type TestDb,
} from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import * as schema from "@/db/schema";
import type { Logger } from "@/lib/logger";
import { CONTRIBUTOR_POINTS_THRESHOLD, promoteIfEligible } from "@/lib/promotion";
import { getSeasonKey } from "@/lib/season";

let db: TestDb;

/** Logger yang diam: yang diuji adalah keadaan database, bukan baris log. */
function silentLogger(): Logger {
  const noop = () => {};
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    child: () => silentLogger(),
  };
}

const log = silentLogger();

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(async () => {
  await resetTestDb(db);
});

async function roleOf(userId: string) {
  const [row] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return row.role;
}

async function mailsFor(userId: string) {
  return db.query.mailOutbox.findMany({ where: eq(schema.mailOutbox.toUserId, userId) });
}

async function auditsFor(userId: string) {
  return db.query.auditLog.findMany({
    where: and(
      eq(schema.auditLog.entityId, userId),
      eq(schema.auditLog.action, "user.role_change"),
    ),
  });
}

describe("promoteIfEligible — ambang", () => {
  it("leaves a student one point below the threshold alone", async () => {
    const student = await seedUser(db, { points: CONTRIBUTOR_POINTS_THRESHOLD - 1 });

    const promoted = await promoteIfEligible(db, {
      userId: student.id,
      actorId: null,
      log,
    });

    expect(promoted).toBe(false);
    expect(await roleOf(student.id)).toBe("student");
    expect(await mailsFor(student.id)).toHaveLength(0);
    expect(await auditsFor(student.id)).toHaveLength(0);
  });

  it("promotes a student exactly at the threshold", async () => {
    const student = await seedUser(db, { points: CONTRIBUTOR_POINTS_THRESHOLD });

    const promoted = await promoteIfEligible(db, {
      userId: student.id,
      actorId: null,
      log,
    });

    expect(promoted).toBe(true);
    expect(await roleOf(student.id)).toBe("contributor");
  });

  it("writes the promotion as an audit row and one mail", async () => {
    const reviewer = await seedUser(db, { role: "moderator" });
    const student = await seedUser(db, { points: CONTRIBUTOR_POINTS_THRESHOLD + 20 });

    await promoteIfEligible(db, { userId: student.id, actorId: reviewer.id, log });

    const audits = await auditsFor(student.id);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorId: reviewer.id,
      entity: "user",
      before: { role: "student" },
    });
    expect((audits[0].after as Record<string, unknown>).role).toBe("contributor");

    const mails = await mailsFor(student.id);
    expect(mails).toHaveLength(1);
    expect(mails[0].kind).toBe("role_promoted");
    // Satu peran, satu surel seumur hidup: kuncinya tidak memuat tanggal.
    expect(mails[0].dedupeKey).toBe(`role:${student.id}`);
  });
});

describe("promoteIfEligible — hanya student", () => {
  it("never touches a contributor, however many points it has", async () => {
    const contributor = await seedUser(db, { role: "contributor", points: 5000 });

    const promoted = await promoteIfEligible(db, {
      userId: contributor.id,
      actorId: null,
      log,
    });

    expect(promoted).toBe(false);
    expect(await roleOf(contributor.id)).toBe("contributor");
    expect(await mailsFor(contributor.id)).toHaveLength(0);
  });

  it("never touches human staff", async () => {
    // Moderator yang meninjau karya orang lain bisa saja berpoin tinggi. Kalau
    // promosi tidak menyaring peran, ia akan menerima surel "kamu sekarang
    // kontributor" — dan turun pangkat secara harfiah.
    const moderator = await seedUser(db, { role: "moderator", points: 5000 });

    const promoted = await promoteIfEligible(db, {
      userId: moderator.id,
      actorId: null,
      log,
    });

    expect(promoted).toBe(false);
    expect(await roleOf(moderator.id)).toBe("moderator");
  });

  it("never touches a season seat, whose role the cron owns", async () => {
    // Kursi memegang `role = moderator` selama musimnya. Promosi di sini akan
    // membuat cron mencabut kursinya menjadi `student` saat musim berganti —
    // hadiah yang berubah menjadi hukuman.
    const seat = await seedUser(db, {
      role: "moderator",
      points: 5000,
      seasonRoleKey: getSeasonKey(),
    });

    const promoted = await promoteIfEligible(db, {
      userId: seat.id,
      actorId: null,
      log,
    });

    expect(promoted).toBe(false);
    expect(await roleOf(seat.id)).toBe("moderator");
  });
});

describe("promoteIfEligible — idempoten", () => {
  it("answers false the second time and sends no second mail", async () => {
    const student = await seedUser(db, { points: CONTRIBUTOR_POINTS_THRESHOLD });

    expect(await promoteIfEligible(db, { userId: student.id, actorId: null, log })).toBe(true);
    expect(await promoteIfEligible(db, { userId: student.id, actorId: null, log })).toBe(false);

    expect(await mailsFor(student.id)).toHaveLength(1);
    expect(await auditsFor(student.id)).toHaveLength(1);
  });

  it("answers false for an id that does not exist", async () => {
    // `db:promote` dan cron memanggilnya dengan id yang datang dari tempat lain;
    // baris yang hilang adalah keadaan biasa, bukan galat.
    const promoted = await promoteIfEligible(db, {
      userId: crypto.randomUUID(),
      actorId: null,
      log,
    });

    expect(promoted).toBe(false);
  });
});
