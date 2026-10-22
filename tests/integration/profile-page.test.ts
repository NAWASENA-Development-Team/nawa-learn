// tests/integration/profile-page.test.ts
// Halaman profil publik dan papan peringkat harus menjawab pertanyaan yang sama
// dengan jawaban yang sama: "berapa siswa di platform ini, dan di peringkat berapa
// saya?" Sebelum M13 keduanya menjawab berbeda — papan peringkat menghitung akun
// yang sudah dianonimkan sebagai siswa, dan halaman profil menghitungnya juga,
// sementara filter tombstone hanya ada di satu tempat.
//
// Tombstone memang **bukan** bug: akun yang dihapus tetap berupa baris `users`
// karena `modules.uploader_id` dan `points_log.user_id` menunjuk ke sana (M11).
// Yang salah adalah menampilkannya sebagai siswa.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import PublicProfilePage from "@/app/(dashboard)/profile/[id]/page";
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
  // Satu database untuk seluruh berkas; setiap test mulai dari platform kosong.
  await db.delete(schema.modules);
  await db.delete(schema.questions);
  await db.delete(schema.pointsLog);
  await db.delete(schema.users);
});

afterEach(() => {
  vi.restoreAllMocks();
});

interface RenderedProps {
  // `rank` is `null` for human staff: they are not on the board, so a position
  // for them would have to be invented (M17).
  user: { id: string; name: string; rank: number | null; totalStudents: number };
  specialtyStats: { quizTotal: number; hardQuizzes: number };
  isOwnProfile: boolean;
}

// `notFound()` throws an `Error` whose `digest` (and message) is this literal.
// Asserting the digest rather than "it rejected" is the difference between
// "the page refused" and "the page crashed for some unrelated reason".
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";

async function render(id: string): Promise<RenderedProps> {
  const element = (await PublicProfilePage({
    params: Promise.resolve({ id }),
  })) as unknown as { props: RenderedProps };
  return element.props;
}

describe("PublicProfilePage", () => {
  it("does not count anonymised accounts as students", async () => {
    const student = await seedUser(db, { name: "Siswa Aktif", points: 40 });
    await seedUser(db, {
      name: "Anonim",
      points: 0,
      clerkId: "deleted:22222222-2222-4222-8222-222222222222",
    });

    const props = await render(student.id);

    // Papan peringkat menjawab 1 untuk data yang sama; profil tidak boleh 2.
    expect(props.user.totalStudents).toBe(1);
    expect(props.user.rank).toBe(1);
  });

  it("ranks among participants only", async () => {
    const me = await seedUser(db, { name: "Saya", points: 20 });
    await seedUser(db, { name: "Lebih Tinggi", points: 50 });
    // Tombstone dengan poin besar tidak boleh menggeser peringkat siapa pun.
    await seedUser(db, {
      name: "Anonim",
      points: 999,
      clerkId: "deleted:33333333-3333-4333-8333-333333333333",
    });

    const props = await render(me.id);

    expect(props.user.rank).toBe(2);
    expect(props.user.totalStudents).toBe(2);
  });

  it("computes badge numbers from SQL, not from the 20-row log window", async () => {
    const author = await seedUser(db, { name: "Penulis", points: 30 });
    // 21 answered questions: more than the `pointLogs` preview (`limit(20)`) can
    // hold, so deriving the count from that window would answer 20.
    for (let i = 0; i < 21; i++) {
      await db.insert(schema.pointsLog).values({
        userId: author.id,
        action: "quiz_answer",
        delta: 5,
        refId: null,
      });
    }

    const props = await render(author.id);

    expect(props.specialtyStats.quizTotal).toBe(21);
  });

  it("marks the page as the visitor's own only for their own row", async () => {
    const me = await seedUser(db, { name: "Saya", points: 10 });
    const other = await seedUser(db, { name: "Orang Lain", points: 10 });

    authMock.mockResolvedValue({ userId: me.clerkId } as never);

    expect((await render(me.id)).isOwnProfile).toBe(true);
    expect((await render(other.id)).isOwnProfile).toBe(false);
  });

  // ─── Profil staf manusia (M17) ─────────────────────────────────────────────
  //
  // Staf disembunyikan dari papan peringkat, jadi tidak ada tautan yang
  // mengarah ke profil mereka. Membiarkan URL-nya tetap terbuka akan membuat
  // penyembunyian itu kosmetik: id-nya bisa ditemukan dari tautan lama atau
  // percobaan langsung, dan yang terbuka adalah nama, bio serta motto seorang
  // guru. `notFound()`, bukan 403 — jawaban yang membedakan "ada tetapi
  // terlarang" dari "tidak ada" sudah cukup untuk memetakan staf platform.
  it("hides a human moderator's profile from a student", async () => {
    const staff = await seedUser(db, { name: "Pak Budi", role: "moderator" });
    const student = await seedUser(db, { name: "Siswa" });

    authMock.mockResolvedValue({ userId: student.clerkId } as never);

    await expect(render(staff.id)).rejects.toThrow(NOT_FOUND_DIGEST);
  });

  it("hides a human moderator's profile from an anonymous visitor", async () => {
    const staff = await seedUser(db, { name: "Pak Budi", role: "admin" });

    // `beforeEach` already leaves the session empty.
    await expect(render(staff.id)).rejects.toThrow(NOT_FOUND_DIGEST);
  });

  it("lets a reviewer open a staff profile, and gives that profile no rank", async () => {
    // The moderator team tab links here, so a reviewer must be able to follow it.
    const staff = await seedUser(db, { name: "Pak Budi", role: "moderator", points: 100 });
    const reviewer = await seedUser(db, { name: "Bu Sari", role: "admin" });
    await seedUser(db, { name: "Siswa", points: 10 });

    authMock.mockResolvedValue({ userId: reviewer.clerkId } as never);
    const props = await render(staff.id);

    expect(props.user.name).toBe("Pak Budi");
    // `null`, not `1` and not `0`. Zero would satisfy every `rank <= N` badge
    // condition; a computed rank would print "#4 dari 2" for someone the board
    // does not contain.
    expect(props.user.rank).toBeNull();
    // Only the student is a participant: the profile's owner and the reviewer
    // reading it are both human staff, and staff are not counted as students.
    expect(props.user.totalStudents).toBe(1);
  });

  it("lets a moderator open their own profile", async () => {
    const staff = await seedUser(db, { name: "Pak Budi", role: "moderator" });

    authMock.mockResolvedValue({ userId: staff.clerkId } as never);
    const props = await render(staff.id);

    expect(props.isOwnProfile).toBe(true);
    expect(props.user.rank).toBeNull();
  });

  it("keeps a season seat's profile public", async () => {
    // The mirror of the gate above, and the case a `role`-only check gets wrong:
    // a seat holds `role = moderator` for the length of the season but is still
    // a student, still on the board, and still has a profile students may open.
    const seat = await seedUser(db, {
      name: "Juara Musim",
      role: "moderator",
      seasonRoleKey: "2026-Q4",
      points: 20,
    });
    await seedUser(db, { name: "Siswa", points: 10 });

    const props = await render(seat.id);

    expect(props.user.rank).toBe(1);
    expect(props.user.totalStudents).toBe(2);
  });
});
