// tests/integration/leaderboard.test.ts
// Papan peringkat adalah satu-satunya halaman yang menyebut nama siswa lain, jadi
// kesalahan di sini paling terlihat. Tiga hal diuji, dan ketiganya adalah bug yang
// benar-benar ada sebelum M13:
//
//   1. Akun yang sudah dianonimkan tetap berupa baris `users` (demi integritas
//      foreign key), sehingga tanpa filter ia muncul di dasar papan dengan nama
//      "Anonim" dan 0 poin — dan ikut menggelembungkan "total siswa".
//   2. Urutan baris dengan poin sama ditentukan Postgres, jadi "peringkat 7" bisa
//      berpindah orang di antara dua pemuatan halaman. Sekarang ada pemecah seri.
//   3. Enam angka lencana dimuat dengan memuat **seluruh** modul/soal/poin ke
//      memori. Sekarang SQL yang menghitung, dan halaman profil memakai fungsi
//      yang sama — jadi keduanya tidak bisa berbeda pendapat.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedQuestion, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import LeaderboardPage from "@/app/(dashboard)/leaderboard/page";
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
  // One database for the file; each test starts from an empty board.
  await db.delete(schema.modules);
  await db.delete(schema.questions);
  await db.delete(schema.pointsLog);
  await db.delete(schema.users);
});

afterEach(() => {
  vi.restoreAllMocks();
});

interface RenderedProps {
  topUsers: {
    id: string;
    name: string;
    seasonPoints: number;
    stats: { approvedMods: number; quizTotal: number };
  }[];
  loggedInUser: { id: string; rank: number } | null;
  totalStudents: number;
}

async function render(): Promise<RenderedProps> {
  const element = (await LeaderboardPage()) as unknown as { props: RenderedProps };
  return element.props;
}

describe("LeaderboardPage", () => {
  it("leaves anonymised accounts off the board and out of the student count", async () => {
    await seedUser(db, { name: "Siswa Aktif", points: 40 });
    await seedUser(db, { name: "Anonim", points: 0, clerkId: "deleted:00000000-0000-4000-8000-000000000000" });

    const props = await render();

    expect(props.topUsers.map((u) => u.name)).toEqual(["Siswa Aktif"]);
    // "Total siswa" is a number shown to students; a tombstone is not a student.
    expect(props.totalStudents).toBe(1);
  });

  it("orders by season points, with a stable tiebreaker", async () => {
    // `points` and `seasonPoints` are different columns: the board ranks on the
    // seasonal score, so seeding `points` alone would leave everyone at 0 and the
    // assertion below would be testing the tiebreaker only.
    const low = await seedUser(db, { name: "Rendah", points: 5, seasonPoints: 5 });
    const high = await seedUser(db, { name: "Tinggi", points: 50, seasonPoints: 50 });
    const tieA = await seedUser(db, { name: "Seri A", points: 20, seasonPoints: 20 });
    const tieB = await seedUser(db, { name: "Seri B", points: 20, seasonPoints: 20 });

    const first = await render();
    const second = await render();

    const names = first.topUsers.map((u) => u.name);
    expect(names[0]).toBe("Tinggi");
    expect(names[3]).toBe("Rendah");
    // The two tied rows may fall either way round — ids are random uuids, not
    // creation order — but they must be the two tied users, and the order must
    // not change between renders. That is the whole point of the tiebreaker:
    // "peringkat 7" cannot be a different person on the next page load.
    expect(new Set(names.slice(1, 3))).toEqual(new Set(["Seri A", "Seri B"]));
    expect(second.topUsers.map((u) => u.id)).toEqual(first.topUsers.map((u) => u.id));
    expect(new Set([tieA.id, tieB.id, low.id, high.id]).size).toBe(4);
  });

  it("attaches exact badge numbers computed in SQL", async () => {
    const author = await seedUser(db, { name: "Penulis", points: 30 });
    await db.insert(schema.modules).values({
      title: "Modul A",
      subject: "Matematika",
      grade: "12",
      category: "UTBK",
      contentUrl: "https://store123.public.blob.vercel-storage.com/uploads/u1/a.pdf",
      uploaderId: author.id,
      status: "approved",
    });
    await db.insert(schema.modules).values({
      title: "Modul B",
      subject: "Fisika",
      grade: "12",
      category: "UTBK",
      contentUrl: "https://store123.public.blob.vercel-storage.com/uploads/u1/b.pdf",
      uploaderId: author.id,
      status: "approved",
    });
    const question = await seedQuestion(db, { uploaderId: author.id, difficulty: "sulit" });
    await db.insert(schema.pointsLog).values({
      userId: author.id,
      action: "quiz_answer",
      delta: 15,
      refId: question.id,
    });

    const props = await render();
    const entry = props.topUsers.find((u) => u.id === author.id);

    expect(entry?.stats).toMatchObject({ approvedMods: 2, quizTotal: 1 });
  });

  it("ranks the signed-in user among participants only", async () => {
    const me = await seedUser(db, { name: "Saya", points: 20, seasonPoints: 20 });
    await seedUser(db, { name: "Lebih Tinggi", points: 50, seasonPoints: 50 });
    // A tombstone with a huge season score must not push me down a rank.
    await seedUser(db, {
      name: "Anonim",
      points: 0,
      seasonPoints: 999,
      clerkId: "deleted:11111111-1111-4111-8111-111111111111",
    });

    authMock.mockResolvedValue({ userId: me.clerkId } as never);
    const props = await render();

    expect(props.loggedInUser?.id).toBe(me.id);
    expect(props.loggedInUser?.rank).toBe(2);
  });

  it("keeps human staff off the board and out of the student count", async () => {
    // A promoted moderator is a teacher who runs the platform, not a student
    // competing for the season. Two lies come from listing one: everyone else's
    // rank shifts by a person who is not playing, and the moderator is published
    // to the whole school as a student (M17).
    await seedUser(db, { name: "Siswa", points: 40, seasonPoints: 40 });
    await seedUser(db, { name: "Pak Budi", role: "moderator", points: 500, seasonPoints: 500 });
    await seedUser(db, { name: "Bu Sari", role: "admin", points: 900, seasonPoints: 900 });

    const props = await render();

    expect(props.topUsers.map((u) => u.name)).toEqual(["Siswa"]);
    expect(props.totalStudents).toBe(1);
  });

  it("keeps a season seat on the board", async () => {
    // The mirror of the test above, and the one that matters most: a seat *is* a
    // student. `role` is `moderator` for the length of the season, so a filter
    // that read `role` alone would hide the very person the podium describes.
    const seat = await seedUser(db, {
      name: "Juara Musim",
      role: "moderator",
      seasonRoleKey: "2026-Q4",
      points: 70,
      seasonPoints: 70,
    });

    const props = await render();

    expect(props.topUsers.map((u) => u.name)).toEqual(["Juara Musim"]);
    expect(props.totalStudents).toBe(1);
    expect(props.topUsers[0].id).toBe(seat.id);
  });

  it("gives a signed-in staff member no rank at all", async () => {
    // `null`, not `0` and not "last place": a teacher is not competing, and the
    // page must not invent a position for them. `0` would be worse than a lie —
    // it satisfies every `rank <= N` badge condition on the profile.
    const staff = await seedUser(db, { name: "Pak Budi", role: "moderator", points: 100, seasonPoints: 100 });
    await seedUser(db, { name: "Siswa", points: 10, seasonPoints: 10 });

    authMock.mockResolvedValue({ userId: staff.clerkId } as never);
    const props = await render();

    expect(props.loggedInUser).toBeNull();
  });

  it("has nobody signed in when the session is empty", async () => {
    await seedUser(db, { name: "Siswa", points: 10 });

    const props = await render();

    expect(props.loggedInUser).toBeNull();
  });
});
