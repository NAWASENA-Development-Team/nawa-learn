import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { apiRequest, createTestDb, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import * as schema from "@/db/schema";
import { POST } from "@/app/api/quiz/daily-claim/route";
import { startOfDailyWindow } from "@/lib/dailyWindow";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  authMock.mockReset();
});

function signIn(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

async function claim() {
  const response = await POST(apiRequest("/api/quiz/daily-claim", "POST"));
  return { status: response.status, data: await response.json() };
}

async function pointsOf(userId: string): Promise<number> {
  const row = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { points: true },
  });
  return row?.points ?? 0;
}

/**
 * Bukti partisipasi, persis seperti yang ditulis `/api/quiz/submit`.
 *
 * Sejak M16 buktinya `daily_activity`, bukan `points_log`. Perbedaan ini bukan
 * detail internal: `points_log` hanya berisi jawaban yang **dibayar**, sehingga
 * pengguna yang sudah menjawab semua soal tidak pernah punya baris baru dan
 * kehilangan +25 selamanya.
 *
 * Sejak M18 baris yang sama juga menyimpan `is_correct`, karena hadiahnya kini
 * hanya untuk jawaban benar. Bawaannya `true` — kasus "sudah menjawab dengan
 * benar" adalah yang diuji oleh sebagian besar test di bawah; test yang
 * menguji jawaban salah memintanya secara eksplisit.
 */
async function recordActivity(
  userId: string,
  {
    windowStart = startOfDailyWindow(),
    isCorrect = true,
  }: { windowStart?: Date; isCorrect?: boolean } = {},
) {
  await db
    .insert(schema.dailyActivity)
    .values({ userId, windowStart, isCorrect })
    .onConflictDoNothing();
}

describe("POST /api/quiz/daily-claim", () => {
  it("answers 401 for an anonymous caller", async () => {
    authMock.mockResolvedValue({ userId: null } as never);
    const { status } = await claim();
    expect(status).toBe(401);
  });

  it("refuses to pay out when no attempt is on record", async () => {
    const student = await seedUser(db, {});
    signIn(student.clerkId);

    const { data } = await claim();

    expect(data.success).toBe(false);
    expect(data.pointsAwarded).toBeUndefined();
    expect(await pointsOf(student.id)).toBe(0);
  });

  it("refuses to pay out for a wrong answer", async () => {
    // M18: hadiahnya hanya untuk jawaban benar, dan `daily_activity.is_correct`
    // adalah satu-satunya tempat fakta itu disimpan — `points_log` tidak bisa
    // menjawabnya, karena baris `delta = 0` pun ada di sana.
    const student = await seedUser(db, {});
    await recordActivity(student.id, { isCorrect: false });

    signIn(student.clerkId);
    const { data } = await claim();

    expect(data.success).toBe(false);
    expect(data.code).toBe("incorrect");
    expect(await pointsOf(student.id)).toBe(0);
  });

  it("pays out even when the attempt earned no points at all", async () => {
    // Inilah bug yang M16 perbaiki: dulu buktinya dibaca dari `points_log`, dan
    // baris itu tidak pernah ditulis ketika soal sudah pernah dijawab (atau
    // ketika soalnya karya sendiri). Pengguna paling rajin justru yang pertama
    // kehilangan hadiah harian — permanen.
    const student = await seedUser(db, {});
    await recordActivity(student.id);

    signIn(student.clerkId);
    const { data } = await claim();

    expect(data.success).toBe(true);
    expect(data.pointsAwarded).toBe(25);
    expect(await pointsOf(student.id)).toBe(25);
  });

  it("ignores activity from a previous window", async () => {
    const student = await seedUser(db, {});
    // 48 jam lalu: pasti sebelum reset 03:00 WIB hari ini.
    await recordActivity(student.id, {
      windowStart: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });

    signIn(student.clerkId);
    const { data } = await claim();

    expect(data.success).toBe(false);
    expect(await pointsOf(student.id)).toBe(0);
  });

  it("pays the flat bonus once, and refuses a second claim the same day", async () => {
    const student = await seedUser(db, {});
    await recordActivity(student.id);

    signIn(student.clerkId);

    const first = await claim();
    expect(first.data.success).toBe(true);
    expect(first.data.pointsAwarded).toBe(25);
    expect(await pointsOf(student.id)).toBe(25);

    const second = await claim();
    expect(second.data.success).toBe(false);
    expect(await pointsOf(student.id)).toBe(25);
  });

  it("stamps the user row so the UI can show today's status", async () => {
    const student = await seedUser(db, {});
    await recordActivity(student.id);

    signIn(student.clerkId);
    await claim();

    const row = await db.query.users.findFirst({
      where: eq(schema.users.id, student.id),
      columns: { lastDailyQuizAt: true },
    });
    expect(row?.lastDailyQuizAt).toBeInstanceOf(Date);
  });
});
