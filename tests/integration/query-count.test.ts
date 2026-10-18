// tests/integration/query-count.test.ts
// Bukti, bukan klaim: dua perbaikan M13 adalah "N+1 dihapus", dan satu-satunya
// cara memastikannya adalah menghitung pernyataan SQL yang benar-benar dikirim.
// Respons HTTP-nya identik baik handler menjalankan 5 query maupun 55, jadi test
// yang hanya memeriksa body akan tetap hijau meskipun N+1 kembali.
//
// Yang diuji adalah **sifat**, bukan angka ajaib: jumlah query tidak boleh
// berubah ketika jumlah baris bertambah.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedQuestion, seedUser, type TestDb } from "../helpers/harness";

let statements: string[] = [];
const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { GET as getStatus } from "@/app/api/profile/status/route";
import { getSpecialtyStats } from "@/lib/specialtyStats";
import * as schema from "@/db/schema";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb({ onQuery: (query) => statements.push(query) });
  holder.db = db;
});

beforeEach(() => {
  statements = [];
  authMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function countQueries(run: () => Promise<unknown>): Promise<number> {
  statements = [];
  await run();
  return statements.length;
}

async function seedModule(uploaderId: string, title: string) {
  const [row] = await db
    .insert(schema.modules)
    .values({
      title,
      subject: "Matematika",
      grade: "12",
      category: "UTBK",
      contentUrl: "https://store123.public.blob.vercel-storage.com/uploads/u1/modul.pdf",
      uploaderId,
      status: "approved",
    })
    .returning();
  return row;
}

describe("getSpecialtyStats query count", () => {
  it("runs the same number of queries for one user and for many", async () => {
    const users = await Promise.all([seedUser(db, {}), seedUser(db, {}), seedUser(db, {})]);
    for (const user of users) {
      await seedModule(user.id, `Modul ${user.id.slice(0, 4)}`);
      await seedQuestion(db, { uploaderId: user.id, difficulty: "mudah" });
      await db.insert(schema.pointsLog).values({
        userId: user.id,
        action: "quiz_answer",
        delta: 5,
        refId: null,
      });
    }

    const one = await countQueries(() => getSpecialtyStats(db, [users[0].id]));
    const many = await countQueries(() => getSpecialtyStats(db, users.map((u) => u.id)));

    // The old implementation loaded every row and counted in JavaScript, so the
    // numbers here would have been identical too — which is why the second
    // assertion pins the *absolute* count. Three aggregates, no matter what.
    expect(many).toBe(one);
    expect(many).toBe(3);
  });
});

describe("GET /api/profile/status query count", () => {
  it("does not grow with the number of submissions and reports", async () => {
    const user = await seedUser(db, {});
    authMock.mockResolvedValue({ userId: user.clerkId } as never);

    // Three modules, three questions, three reports — the old handler ran one
    // extra lookup per row here, so this would have been 3 + 3 + 3 + 3 = 12.
    for (let i = 0; i < 3; i += 1) {
      const module = await seedModule(user.id, `Modul ${i}`);
      const question = await seedQuestion(db, { uploaderId: user.id, difficulty: "sedang" });
      await db.insert(schema.submissions).values({
        type: "module",
        refId: module.id,
        submitterId: user.id,
        submittedAt: new Date(Date.UTC(2026, 1, 1, 0, i)),
      });
      await db.insert(schema.submissions).values({
        type: "question",
        refId: question.id,
        submitterId: user.id,
        submittedAt: new Date(Date.UTC(2026, 1, 2, 0, i)),
      });
      await db.insert(schema.reports).values({
        userId: user.id,
        issueType: "bug",
        description: `Laporan ${i}`,
      });
    }

    const busy = await countQueries(() => getStatus(new Request("https://nawa.test/api/profile/status")));

    // 1 session lookup + submissions + reports + module titles + question titles.
    // Five, and it stays five no matter how many rows come back.
    expect(busy).toBe(5);

    // Twice the rows, same five statements. This is the assertion an N+1 cannot
    // survive: the old handler issued one lookup per row, so it would have grown
    // to 5 + 12 here.
    for (let i = 3; i < 6; i += 1) {
      const module = await seedModule(user.id, `Modul ${i}`);
      await db.insert(schema.submissions).values({
        type: "module",
        refId: module.id,
        submitterId: user.id,
        submittedAt: new Date(Date.UTC(2026, 1, 3, 0, i)),
      });
    }
    const busier = await countQueries(() => getStatus(new Request("https://nawa.test/api/profile/status")));
    expect(busier).toBe(busy);

    // With nothing to resolve there is nothing to look up: the two title queries
    // are skipped entirely rather than run against an empty id list.
    const quiet = await seedUser(db, {});
    authMock.mockResolvedValue({ userId: quiet.clerkId } as never);
    const empty = await countQueries(() => getStatus(new Request("https://nawa.test/api/profile/status")));
    expect(empty).toBe(3);
  });
});
