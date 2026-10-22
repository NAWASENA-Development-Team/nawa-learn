// tests/integration/moderator-team.test.ts
// ─── "Siapa yang menjaga platform ini" (M17) ──────────────────────────────────
//
// Sampai M17 daftar moderator bisa dilihat dengan membuka papan peringkat: staf
// manusia ada di sana, di antara siswa, dengan poin. Itu justru masalahnya —
// seorang guru tampil sebagai siswa oleh seluruh sekolah. Setelah staf
// disembunyikan dari setiap permukaan "daftar orang", tidak ada lagi satu pun
// layar yang menjawab pertanyaan itu, dan pemegang kursi yang baru duduk tidak
// punya cara untuk tahu kepada siapa ia bertanya.
//
// Karena itu route ini ada, dan yang diuji di sini adalah batasnya:
//
//   1. Hanya peninjau — staf manusia **dan** kursi musim. Siswa 403, anonim 401.
//   2. Dua kelompok disusun dari dua definisi yang sudah ada: `isHumanStaff()`
//      untuk staf, `getPodium()` untuk kursi. Tidak ada definisi ketiga.
//   3. Tidak ada alamat surel di respons. Daftar ini dibaca kursi musim juga,
//      dan alamat surel seorang guru bukan bagian dari "siapa yang menjaga panel".
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, createTestDb, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { GET as readTeam } from "@/app/api/moderator/team/route";
import * as schema from "@/db/schema";

const authMock = vi.mocked(auth);

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(async () => {
  authMock.mockReset();
  authMock.mockResolvedValue({ userId: null } as never);
  // The logger writes to the console by design; silence it so a passing run is
  // not 200 lines of JSON.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // One database for the file; each test starts from an empty platform.
  await db.delete(schema.modules);
  await db.delete(schema.questions);
  await db.delete(schema.pointsLog);
  await db.delete(schema.users);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function signIn(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

type TeamBody = {
  success: boolean;
  staff: { id: string; name: string; role: string }[];
  seats: { id: string; name: string; points: number; seatNumber: number }[];
};

async function read(): Promise<{ status: number; body: TeamBody; raw: string }> {
  const res = await readTeam(apiRequest("/api/moderator/team"));
  const raw = await res.text();
  return { status: res.status, body: JSON.parse(raw) as TeamBody, raw };
}

describe("GET /api/moderator/team", () => {
  it("lists human staff and the current podium, in podium order", async () => {
    const moderator = await seedUser(db, { name: "Pak Budi", role: "moderator" });
    await seedUser(db, { name: "Bu Sari", role: "admin" });
    await seedUser(db, { name: "Juara Satu", points: 90, seasonPoints: 90 });
    await seedUser(db, { name: "Juara Dua", points: 70, seasonPoints: 70 });
    await seedUser(db, { name: "Juara Tiga", points: 50, seasonPoints: 50 });

    signIn(moderator.clerkId);
    const { status, body } = await read();

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // Ordered by name, so the list does not reshuffle between loads.
    expect(body.staff.map((member) => member.name)).toEqual(["Bu Sari", "Pak Budi"]);
    expect(body.staff.map((member) => member.role)).toEqual(["admin", "moderator"]);
    // Ordered by the podium, not by `inArray` — a seat number must not depend on
    // the order Postgres happens to return three unrelated ids in.
    expect(body.seats.map((member) => member.name)).toEqual(["Juara Satu", "Juara Dua", "Juara Tiga"]);
    expect(body.seats.map((member) => member.seatNumber)).toEqual([1, 2, 3]);
    expect(body.seats.map((member) => member.points)).toEqual([90, 70, 50]);
  });

  it("never returns an address", async () => {
    const moderator = await seedUser(db, { name: "Pak Budi", role: "moderator" });
    await seedUser(db, { name: "Juara", points: 10, seasonPoints: 10 });

    signIn(moderator.clerkId);
    const { raw } = await read();

    // `seedUser` writes `<clerkId>@example.test` into `users.email`. Any of it
    // reaching this payload would mean a column list quietly became `select()`.
    expect(raw).not.toMatch(/@example\.test/);
    expect(raw).not.toMatch(/"email"/);
  });

  it("lets a season seat read it", async () => {
    // The reason the route exists: a seat is a student, so hiding staff from the
    // leaderboard removed the only way it could learn who the staff are.
    const seat = await seedUser(db, {
      name: "Juara Musim",
      role: "moderator",
      seasonRoleKey: "2026-Q4",
      points: 60,
      seasonPoints: 60,
    });
    await seedUser(db, { name: "Pak Budi", role: "moderator" });

    signIn(seat.clerkId);
    const { status, body } = await read();

    expect(status).toBe(200);
    expect(body.staff.map((member) => member.name)).toEqual(["Pak Budi"]);
    expect(body.seats.map((member) => member.name)).toEqual(["Juara Musim"]);
  });

  it("keeps staff out of the podium list even when they have the most points", async () => {
    // `getPodium()` filters through `IS_PARTICIPANT`, which excludes human staff,
    // so the two groups cannot overlap. Asserting it here is what stops a future
    // refactor from assembling the seat list from `season_role_key` instead —
    // which would list a staff member as a seat holder the cron never granted.
    const admin = await seedUser(db, { name: "Bu Sari", role: "admin", points: 900, seasonPoints: 900 });
    await seedUser(db, { name: "Juara", points: 10, seasonPoints: 10 });

    signIn(admin.clerkId);
    const { body } = await read();

    expect(body.seats.map((member) => member.name)).toEqual(["Juara"]);
    expect(body.staff.map((member) => member.name)).toEqual(["Bu Sari"]);
  });

  it("refuses a student", async () => {
    const student = await seedUser(db, { name: "Siswa" });
    await seedUser(db, { name: "Pak Budi", role: "moderator" });

    signIn(student.clerkId);
    const { status } = await read();

    expect(status).toBe(403);
  });

  it("refuses an anonymous caller", async () => {
    await seedUser(db, { name: "Pak Budi", role: "moderator" });

    const { status } = await read();

    expect(status).toBe(401);
  });

  it("marks the response no-store", async () => {
    const moderator = await seedUser(db, { name: "Pak Budi", role: "moderator" });
    signIn(moderator.clerkId);

    const res = await readTeam(apiRequest("/api/moderator/team"));

    // A list of names behind an auth gate must never be cached by a shared proxy.
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
