// tests/integration/season-cron.test.ts
// Satu putaran cron musim, diuji terhadap Postgres sungguhan.
//
// Yang diperiksa di sini bukan "cron berjalan tanpa error", melainkan lima janji
// yang masing-masing bisa rusak diam-diam:
//
//   1. Podium musim lalu diarsipkan **sebelum** poin direset — kalau urutannya
//      terbalik, arsipnya berisi nol dan tidak ada yang tahu.
//   2. Rollover idempoten: cron yang dijalankan dua kali tidak mereset dua kali.
//   3. Promosi manusia (`season_role_key IS NULL`) tidak pernah dicabut mesin.
//   4. Kursi diberikan ke tiga teratas, dicabut dari yang tergeser, dan honor
//      +10 dibayar sekali per jendela harian dengan plafon per musim.
//   5. Slot kuis harian terisi walau tidak ada moderator yang membuatnya.
//
// Semua waktu diturunkan dari `new Date()`, bukan ditulis mati: `effectiveSeasonPoints()`
// memakai musim berjalan yang sesungguhnya, jadi tanggal hard-code akan lulus
// hari ini dan gagal di kuartal berikutnya.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  createTestDb,
  resetTestDb,
  seedQuestion,
  seedUser,
  type TestDb,
} from "../helpers/harness";

import * as schema from "@/db/schema";
import { startOfDailyWindow } from "@/lib/dailyWindow";
import type { Logger } from "@/lib/logger";
import { getCurrentSeasonStart, getPreviousSeasonStart, getSeasonKey } from "@/lib/season";
import { runSeasonCron, STIPEND_MAX_DAYS_PER_SEASON, STIPEND_POINTS } from "@/lib/seasonCron";
import { GET as seasonCronGet, POST as seasonCronPost } from "@/app/api/cron/season/route";

// Route-nya membaca `db` dari modul `@/db`; `runSeasonCron` menerimanya sebagai
// argumen. Mock ini hanya menjembatani keduanya supaya lapisan HTTP bisa diuji
// terhadap database test yang sama, bukan database sungguhan.
const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

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

// Diturunkan dari jam sebenarnya, karena `effectiveSeasonPoints()` membaca musim
// berjalan dari jam sistem.
const NOW = new Date();
const SEASON_START = getCurrentSeasonStart(NOW);
const PREVIOUS_START = getPreviousSeasonStart(NOW);
const SEASON_KEY = getSeasonKey(NOW);
const PREVIOUS_KEY = getSeasonKey(PREVIOUS_START);

// Satu database untuk seluruh berkas, dikosongkan di antara test.
//
// `createTestDb()` menyalakan Postgres yang dikompilasi ke WASM. Membuatnya di
// dalam `beforeEach` berarti membayar biaya itu 21 kali, dan pada mesin 2 inti
// satu boot melewati `hookTimeout` 120 detik — laporannya lalu berbunyi "Hook
// timed out", yang terbaca seperti regresi padahal hanya mesin yang sibuk.
// `resetTestDb()` memberi keadaan awal yang sama (tidak ada baris di tabel mana
// pun) dengan biaya milidetik.
beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(async () => {
  await resetTestDb(db);
});

/**
 * Menstempel kolom musim secara eksplisit.
 *
 * `seedUser()` sengaja tidak mengekspos `seasonResetAt`: fixture yang membiarkannya
 * NULL akan direset cron, sehingga test "siapa yang duduk" harus menyatakan
 * dengan jelas apakah penggunanya sudah distempel musim ini atau belum.
 */
async function setSeason(
  userId: string,
  seasonPoints: number,
  seasonResetAt: Date,
): Promise<void> {
  await db
    .update(schema.users)
    .set({ seasonPoints, seasonResetAt })
    .where(eq(schema.users.id, userId));
}

describe("runSeasonCron — arsip podium", () => {
  it("mengarsipkan poin musim lalu sebelum rollover menghapusnya", async () => {
    const first = await seedUser(db, { clerkId: "arsip_juara" });
    const second = await seedUser(db, { clerkId: "arsip_runner_up" });
    await setSeason(first.id, 50, PREVIOUS_START);
    await setSeason(second.id, 30, PREVIOUS_START);

    const result = await runSeasonCron(db, log, NOW);

    expect(result.archived).toBe(2);

    const podium = await db
      .select()
      .from(schema.seasonPodium)
      .orderBy(schema.seasonPodium.place);

    expect(podium).toHaveLength(2);
    expect(podium[0]).toMatchObject({
      seasonKey: PREVIOUS_KEY,
      place: 1,
      userId: first.id,
      points: 50,
    });
    expect(podium[1]).toMatchObject({ place: 2, userId: second.id, points: 30 });

    // Arsip menyimpan angka lama; baris pengguna sudah direset.
    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, first.id));
    expect(after.seasonPoints).toBe(0);
    expect(after.seasonResetAt).not.toBeNull();
  });

  it("tidak menimpa podium yang sudah diarsipkan (ON CONFLICT DO NOTHING)", async () => {
    const original = await seedUser(db, { clerkId: "arsip_asli" });
    const late = await seedUser(db, { clerkId: "arsip_terlambat" });
    await setSeason(late.id, 99, PREVIOUS_START);

    await db.insert(schema.seasonPodium).values({
      seasonKey: PREVIOUS_KEY,
      place: 1,
      userId: original.id,
      points: 12,
    });

    await runSeasonCron(db, log, NOW);

    const [row] = await db
      .select()
      .from(schema.seasonPodium)
      .where(eq(schema.seasonPodium.seasonKey, PREVIOUS_KEY));

    expect(row.userId).toBe(original.id);
    expect(row.points).toBe(12);
  });

  it("mengirim surel hasil musim ke tiap baris podium", async () => {
    const winner = await seedUser(db, { clerkId: "hasil_juara" });
    await setSeason(winner.id, 40, PREVIOUS_START);

    await runSeasonCron(db, log, NOW);

    const outbox = await db.select().from(schema.mailOutbox);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      toUserId: winner.id,
      kind: "season_result",
      dedupeKey: `season:${PREVIOUS_KEY}:${winner.id}`,
    });
    expect(outbox[0].payload).toMatchObject({ seasonKey: PREVIOUS_KEY, place: 1, points: 40 });
  });

  it("idempoten: putaran kedua tidak mengarsipkan atau mereset apa pun lagi", async () => {
    const user = await seedUser(db, { clerkId: "idempoten" });
    await setSeason(user.id, 25, PREVIOUS_START);

    const first = await runSeasonCron(db, log, NOW);
    const second = await runSeasonCron(db, log, NOW);

    expect(first.archived).toBe(1);
    expect(first.rolledOver).toBeGreaterThanOrEqual(1);
    expect(second.archived).toBe(0);
    expect(second.rolledOver).toBe(0);

    const podium = await db.select().from(schema.seasonPodium);
    expect(podium).toHaveLength(1);
  });
});

describe("runSeasonCron — kursi Dewan Podium", () => {
  it("memberi kursi ke tiga teratas dan tidak menstempel staf manusia", async () => {
    const staff = await seedUser(db, {
      clerkId: "staf_manusia",
      role: "moderator",
      seasonRoleKey: null,
    });
    const contender = await seedUser(db, { clerkId: "penantang" });
    await setSeason(staff.id, 100, SEASON_START);
    await setSeason(contender.id, 60, SEASON_START);

    const result = await runSeasonCron(db, log, NOW);

    // Staf manusia menang secara poin, tetapi kursi musiman tidak ditempelkan
    // padanya: kalau ditempelkan, cron berikutnya akan mencabut peran yang
    // diberikan manusia.
    const [staffAfter] = await db.select().from(schema.users).where(eq(schema.users.id, staff.id));
    expect(staffAfter.role).toBe("moderator");
    expect(staffAfter.seasonRoleKey).toBeNull();

    const [contenderAfter] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, contender.id));
    expect(contenderAfter.role).toBe("moderator");
    expect(contenderAfter.seasonRoleKey).toBe(SEASON_KEY);

    expect(result.granted).toBe(1);
  });

  it("tidak memberi kursi pada hari pertama musim ketika semua poin nol", async () => {
    const a = await seedUser(db, { clerkId: "nol_a" });
    const b = await seedUser(db, { clerkId: "nol_b" });
    const c = await seedUser(db, { clerkId: "nol_c" });
    await setSeason(a.id, 0, SEASON_START);
    await setSeason(b.id, 0, SEASON_START);
    await setSeason(c.id, 0, SEASON_START);

    const result = await runSeasonCron(db, log, NOW);

    expect(result.granted).toBe(0);
    const rows = await db.select().from(schema.users);
    expect(rows.every((row) => row.role === "student")).toBe(true);
  });

  it("mencabut kursi dari pemegang yang tergeser dari tiga teratas", async () => {
    const seated = await seedUser(db, {
      clerkId: "kursi_tergeser",
      role: "moderator",
      seasonRoleKey: SEASON_KEY,
    });
    await setSeason(seated.id, 5, SEASON_START);

    for (const [index, points] of [80, 70, 60].entries()) {
      const rival = await seedUser(db, { clerkId: `rival_${index}` });
      await setSeason(rival.id, points, SEASON_START);
    }

    const result = await runSeasonCron(db, log, NOW);

    expect(result.displaced).toBe(1);

    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, seated.id));
    expect(after.role).toBe("contributor");
    expect(after.seasonRoleKey).toBeNull();

    const outbox = await db.select().from(schema.mailOutbox);
    expect(outbox.map((row) => row.kind)).toContain("seat_revoked");
    expect(outbox.map((row) => row.dedupeKey)).toContain(`seat-end:${SEASON_KEY}:${seated.id}`);
  });

  it("mencabut kursi dari musim lain tanpa menyentuh promosi manusia", async () => {
    const oldSeat = await seedUser(db, {
      clerkId: "kursi_musim_lalu",
      role: "moderator",
      seasonRoleKey: PREVIOUS_KEY,
    });
    const human = await seedUser(db, {
      clerkId: "moderator_tetap",
      role: "moderator",
      seasonRoleKey: null,
    });
    await setSeason(oldSeat.id, 0, SEASON_START);
    await setSeason(human.id, 0, SEASON_START);

    const result = await runSeasonCron(db, log, NOW);

    expect(result.revoked).toBe(1);

    const [oldAfter] = await db.select().from(schema.users).where(eq(schema.users.id, oldSeat.id));
    expect(oldAfter.role).toBe("contributor");
    expect(oldAfter.seasonRoleKey).toBeNull();

    const [humanAfter] = await db.select().from(schema.users).where(eq(schema.users.id, human.id));
    expect(humanAfter.role).toBe("moderator");
    expect(humanAfter.seasonRoleKey).toBeNull();
  });

  it("tidak menulis ulang kursi yang sudah benar (tanpa spam audit harian)", async () => {
    const seat = await seedUser(db, {
      clerkId: "kursi_tetap",
      role: "moderator",
      seasonRoleKey: SEASON_KEY,
    });
    await setSeason(seat.id, 50, SEASON_START);

    const result = await runSeasonCron(db, log, NOW);

    expect(result.granted).toBe(0);
    expect(result.displaced).toBe(0);

    const audits = await db.select().from(schema.auditLog);
    expect(audits).toHaveLength(0);
  });
});

describe("runSeasonCron — honor", () => {
  it("membayar +10 sekali per jendela harian", async () => {
    const seat = await seedUser(db, {
      clerkId: "penerima_honor",
      role: "moderator",
      seasonRoleKey: SEASON_KEY,
    });
    await setSeason(seat.id, 50, SEASON_START);

    const first = await runSeasonCron(db, log, NOW);
    const second = await runSeasonCron(db, log, NOW);

    expect(first.stipendPaid).toBe(1);
    expect(second.stipendPaid).toBe(0);

    const rows = await db
      .select()
      .from(schema.pointsLog)
      .where(eq(schema.pointsLog.action, "season_stipend"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: seat.id, delta: STIPEND_POINTS });

    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, seat.id));
    expect(after.points).toBe(STIPEND_POINTS);
    expect(after.seasonPoints).toBe(50 + STIPEND_POINTS);
  });

  it("berhenti membayar setelah plafon hari per musim tercapai", async () => {
    const seat = await seedUser(db, {
      clerkId: "penerima_plafon",
      role: "moderator",
      seasonRoleKey: SEASON_KEY,
    });
    await setSeason(seat.id, 50, SEASON_START);

    await db.insert(schema.pointsLog).values(
      Array.from({ length: STIPEND_MAX_DAYS_PER_SEASON }, (_, index) => ({
        userId: seat.id,
        action: "season_stipend",
        delta: STIPEND_POINTS,
        refId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      })),
    );

    const result = await runSeasonCron(db, log, NOW);

    expect(result.stipendPaid).toBe(0);
    expect(result.stipendCapped).toBe(1);

    const rows = await db
      .select()
      .from(schema.pointsLog)
      .where(eq(schema.pointsLog.action, "season_stipend"));
    expect(rows).toHaveLength(STIPEND_MAX_DAYS_PER_SEASON);
  });

  it("tidak membayar honor kepada moderator yang bukan pemegang kursi musim", async () => {
    const human = await seedUser(db, {
      clerkId: "moderator_tanpa_kursi",
      role: "moderator",
      seasonRoleKey: null,
    });
    await setSeason(human.id, 500, SEASON_START);

    const result = await runSeasonCron(db, log, NOW);

    // Ia memang masuk podium, tetapi tidak distempel kursi (lihat test kursi),
    // jadi tidak ada honor yang mengalir ke staf tetap.
    expect(result.stipendPaid).toBe(0);
  });
});

describe("runSeasonCron — slot kuis harian", () => {
  it("mengisi slot dari bank soal bila belum ada yang mengisi", async () => {
    const author = await seedUser(db, { clerkId: "penulis_soal" });
    const question = await seedQuestion(db, { uploaderId: author.id, difficulty: "sedang" });

    const result = await runSeasonCron(db, log, NOW);

    expect(result.slotFilled).toBe(true);

    const [slot] = await db.select().from(schema.dailyQuizSlot);
    expect(slot.questionId).toBe(question.id);
    expect(slot.authorId).toBeNull();
    expect(slot.windowStart.toISOString()).toBe(startOfDailyWindow(NOW).toISOString());
  });

  it("tidak mengisi slot yang sudah diisi manusia, dan tidak mengulang soal yang pernah jadi slot", async () => {
    const author = await seedUser(db, { clerkId: "penulis_dua_soal" });
    const first = await seedQuestion(db, { uploaderId: author.id, difficulty: "mudah" });
    const second = await seedQuestion(db, { uploaderId: author.id, difficulty: "sulit" });

    const windowStart = startOfDailyWindow(NOW);
    await db.insert(schema.dailyQuizSlot).values({
      windowStart,
      questionId: first.id,
      authorId: author.id,
    });

    const result = await runSeasonCron(db, log, NOW);
    expect(result.slotFilled).toBe(false);

    // Jendela berikutnya: soal yang sudah pernah dipakai tidak boleh dipilih lagi.
    const nextDay = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    await runSeasonCron(db, log, nextDay);

    const slots = await db.select().from(schema.dailyQuizSlot);
    expect(slots).toHaveLength(2);
    expect(slots.map((row) => row.questionId).sort()).toEqual([first.id, second.id].sort());
  });

  it("melaporkan slot kosong ketika bank soal belum punya soal approved", async () => {
    const result = await runSeasonCron(db, log, NOW);

    expect(result.slotFilled).toBe(false);
    expect(await db.select().from(schema.dailyQuizSlot)).toHaveLength(0);
  });
});

describe("runSeasonCron — kedalaman bank soal", () => {
  it("mengukur kedalaman pada sampel pengguna aktif", async () => {
    const author = await seedUser(db, { clerkId: "penulis_kedalaman" });
    const reader = await seedUser(db, { clerkId: "pembaca_kedalaman" });
    const question = await seedQuestion(db, { uploaderId: author.id, difficulty: "mudah" });
    const other = await seedQuestion(db, { uploaderId: author.id, difficulty: "sedang" });

    await db.insert(schema.pointsLog).values({
      userId: reader.id,
      action: "quiz_answer",
      delta: 10,
      refId: question.id,
    });

    const result = await runSeasonCron(db, log, NOW);

    // Dua soal approved, satu sudah dijawab pembaca → kedalaman median 1.
    expect(result.poolDepth).toBe(1);
    expect(other.id).toBeDefined();
  });
});

// ─── Lapisan HTTP ────────────────────────────────────────────────────────────
//
// `runSeasonCron` sudah diuji di atas; yang diuji di sini adalah **pintunya**.
// Tiga sifatnya tidak terlihat dari hasil cron, dan ketiganya rusak diam-diam:
// rahasia yang tidak diset harus menutup (bukan membuka), `GET` harus ditolak
// karena operasi ini mengubah peran dan menulis poin, dan permintaan yang tidak
// membawa token tidak boleh sampai ke `runSeasonCron` sama sekali.
describe("POST /api/cron/season — otorisasi", () => {
  const SECRET = "cron_secret_that_is_long_enough_to_be_real";

  beforeEach(() => {
    // Logger menulis JSON ke stdout; yang diuji adalah status, bukan baris log.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  function post(headers: Record<string, string> = {}) {
    return new Request("https://nawa.test/api/cron/season", {
      method: "POST",
      headers,
    });
  }

  it("menjalankan cron dengan bearer token yang benar", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    const response = await seasonCronPost(post({ authorization: `Bearer ${SECRET}` }));
    const body = (await response.json()) as { seasonKey: string };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.seasonKey).toBe(SEASON_KEY);
  });

  it("menolak permintaan tanpa token", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    const response = await seasonCronPost(post());

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("menolak token yang salah, termasuk yang hanya berbeda panjang", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    const wrong = await seasonCronPost(post({ authorization: `Bearer ${"x".repeat(SECRET.length)}` }));
    const short = await seasonCronPost(post({ authorization: "Bearer short" }));

    expect(wrong.status).toBe(401);
    expect(short.status).toBe(401);
  });

  it("menutup ketika CRON_SECRET tidak diset — bukan membuka", async () => {
    vi.stubEnv("CRON_SECRET", "");

    // Token apa pun ditolak, termasuk string kosong: rahasia yang tidak ada
    // tidak boleh berarti "tidak ada yang perlu dicocokkan".
    const response = await seasonCronPost(post({ authorization: "Bearer " }));

    expect(response.status).toBe(401);
  });

  it("menolak GET dengan 405", async () => {
    const response = seasonCronGet();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
