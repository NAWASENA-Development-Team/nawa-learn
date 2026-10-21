// src/lib/seasonCron.ts
// ─── Daur hidup kursi musim, honor, dan kuras outbox ──────────────────────────
// Satu putaran cron menjalankan delapan langkah, dan **urutannya bagian dari
// kebenaran**, bukan selera:
//
//   1. Arsip podium musim lalu — sebelum reset, karena setelahnya angkanya hilang.
//   2. Rollover poin musim.
//   3. Cabut kursi dari musim lain (kunci lama).
//   4. Tetapkan kursi untuk tiga teratas musim berjalan.
//   5. Cabut kursi yang tergeser dari tiga teratas.
//   6. Honor +10 untuk pemegang kursi, sekali per jendela harian.
//   7. Isi slot kuis harian bila masih kosong.
//   8. Catat `daily_pool_depth`, kuras outbox, pangkas catatan lama.
//
// Semua langkah idempoten: menjalankan cron dua kali menghasilkan keadaan yang
// sama. Itu bukan kemewahan — Vercel Cron bisa mengulang, dan sebuah job yang
// hanya benar bila dijalankan sekali adalah job yang suatu hari akan merusak data.
//
// ## Kenapa pencabutan tidak boleh bergantung pada cron
// Kalau cron mati sama sekali, **pencabutan tetap terjadi** karena
// `isSeatActive()` membandingkan `season_role_key` dengan kunci musim berjalan
// (invarian I1). Yang tertunda hanyalah **pemberian**. Tidak ada kursi abadi.

import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db/types";
import { recordAudit } from "@/lib/auditLog";
import { deterministicUuid, startOfDailyWindow } from "@/lib/dailyWindow";
import { enqueueMail, sendPendingMail } from "@/lib/mailer";
import { IS_PARTICIPANT } from "@/lib/participants";
import { getCurrentSeasonStart, getPreviousSeasonStart, getSeasonKey } from "@/lib/season";
import { getPodium, SEAT_COUNT } from "@/lib/seat";
import type { Logger } from "@/lib/logger";

/** Honor harian pemegang kursi. */
export const STIPEND_POINTS = 10;

/**
 * Plafon hari berbayar per musim (30 × 10 = 300).
 *
 * Tanpa plafon, kursi memberi 900 poin per musim untuk nol pekerjaan — lebih
 * besar daripada menyetujui delapan belas modul — dan diberikan kepada orang
 * yang sudah memimpin papan. Plafon menjaga kursi tetap penghargaan simbolis,
 * bukan mesin ekonomi.
 */
export const STIPEND_MAX_DAYS_PER_SEASON = 30;

/**
 * Ambang peringatan kedalaman bank soal.
 *
 * Sesi kuis harian berisi sampai 20 soal. Bila bank `approved` yang belum
 * dijawab pengguna aktif median tinggal di bawah 20, separuh sekolah sudah
 * kehabisan soal hari itu — dan itu tidak bisa diperbaiki dengan menambah honor,
 * hanya dengan menambah soal.
 */
export const DAILY_POOL_DEPTH_MIN = 20;

/** Berapa pengguna aktif dijadikan sampel saat mengukur kedalaman bank soal. */
const POOL_SAMPLE_SIZE = 20;

export type SeasonCronResult = {
  seasonKey: string;
  archived: number;
  rolledOver: number;
  revoked: number;
  granted: number;
  displaced: number;
  stipendPaid: number;
  stipendCapped: number;
  slotFilled: boolean;
  poolDepth: number | null;
  mail: { sent: number; failed: number; skipped: number };
};

/** Snapshot audit yang hanya berisi skalar — lihat `AuditSnapshot`. */
function roleSnapshot(role: string, seasonRoleKey: string | null) {
  return { role, seasonRoleKey };
}

export async function runSeasonCron(
  db: AppDb,
  log: Logger,
  now: Date = new Date(),
): Promise<SeasonCronResult> {
  const seasonKey = getSeasonKey(now);
  const seasonStart = getCurrentSeasonStart(now);
  const previousStart = getPreviousSeasonStart(now);

  // ── 1. Arsip podium musim lalu ────────────────────────────────────────────
  // Hanya ketika ada baris yang memang perlu direset. Menjalankan arsip setiap
  // hari akan menulis podium musim berjalan ke kunci musim **lalu** begitu
  // kuartal berganti — salah, dan tidak bisa diperbaiki karena `ON CONFLICT`
  // membuat baris pertama menang.
  let archived = 0;
  const [stale] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      or(
        isNull(schema.users.seasonResetAt),
        lt(schema.users.seasonResetAt, seasonStart),
      ),
    )
    .limit(1);

  if (stale) {
    const previousKey = getSeasonKey(previousStart);
    const podium = await db
      .select({ userId: schema.users.id, points: schema.users.seasonPoints })
      .from(schema.users)
      .where(
        and(
          IS_PARTICIPANT,
          gte(schema.users.seasonResetAt, previousStart),
          sql`${schema.users.seasonPoints} > 0`,
        ),
      )
      .orderBy(desc(schema.users.seasonPoints), desc(schema.users.id))
      .limit(SEAT_COUNT);

    if (podium.length > 0) {
      await db
        .insert(schema.seasonPodium)
        .values(
          podium.map((row, index) => ({
            seasonKey: previousKey,
            place: index + 1,
            userId: row.userId,
            points: row.points,
          })),
        )
        .onConflictDoNothing();
      archived = podium.length;

      // Kabar hasil musim ke tiga podium. Dikirim dari sini, bukan dari jalur
      // poin: hanya cron yang tahu kapan sebuah musim benar-benar berakhir.
      for (const [index, row] of podium.entries()) {
        await enqueueMail(
          db,
          {
            toUserId: row.userId,
            kind: "season_result",
            dedupeKey: `season:${previousKey}:${row.userId}`,
            payload: { seasonKey: previousKey, place: index + 1, points: row.points },
          },
          log,
        );
      }
    }
  }

  // ── 2. Rollover ───────────────────────────────────────────────────────────
  // Idempoten tanpa tabel penanda: setelah dijalankan, tidak ada lagi baris yang
  // memenuhi syarat.
  const rolled = await db
    .update(schema.users)
    .set({ seasonPoints: 0, seasonResetAt: now })
    .where(
      or(
        isNull(schema.users.seasonResetAt),
        lt(schema.users.seasonResetAt, seasonStart),
      ),
    )
    .returning({ id: schema.users.id });

  // ── 3. Cabut kursi dari musim lain ────────────────────────────────────────
  // Hanya kunci **lama**. Baris dengan `season_role_key IS NULL` tidak pernah
  // disentuh, jadi promosi manusia tidak bisa dicabut mesin — itu janji yang
  // ditulis di `db:promote` dan diuji di `season-seat.test.ts`.
  const revokedRows = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      seasonRoleKey: schema.users.seasonRoleKey,
    })
    .from(schema.users)
    .where(
      and(
        isNotNull(schema.users.seasonRoleKey),
        ne(schema.users.seasonRoleKey, seasonKey),
      ),
    );

  if (revokedRows.length > 0) {
    await db
      .update(schema.users)
      .set({ role: "contributor", seasonRoleKey: null })
      .where(inArray(schema.users.id, revokedRows.map((row) => row.id)));

    for (const row of revokedRows) {
      await recordAudit(
        db,
        {
          actorId: null,
          action: "user.role_change",
          entity: "user",
          entityId: row.id,
          before: roleSnapshot(row.role, row.seasonRoleKey),
          after: { role: "contributor", seasonRoleKey: null, reason: "season_ended" },
        },
        { log },
      );

      await enqueueMail(
        db,
        {
          toUserId: row.id,
          kind: "seat_revoked",
          dedupeKey: `seat-end:${row.seasonRoleKey}:${row.id}`,
          payload: { seasonKey: row.seasonRoleKey ?? "", reason: "season_ended" },
        },
        log,
      );
    }
  }

  // ── 4. Tetapkan kursi untuk tiga teratas ──────────────────────────────────
  // Podium dibaca dari `getPodium()` supaya papan peringkat dan kursi memakai
  // definisi peringkat yang sama persis — poin musim efektif, peserta saja,
  // `id` sebagai pemecah seri, dan `> 0` supaya hari pertama kuartal tidak
  // memberi kursi kepada tiga UUID sembarang. Salinan query di sini akan menjadi
  // definisi kedua dari "tiga teratas", dan dua definisi adalah cara paling halus
  // membuat papan peringkat dan kursi menunjuk orang yang berbeda.
  const podium = await getPodium(db);

  // Satu query tambahan untuk kolom yang tidak dipakai papan peringkat
  // (peran dan asal-usulnya). Nol query bila podium kosong — awal musim.
  const podiumState = new Map<string, { role: string; seasonRoleKey: string | null }>();
  if (podium.length > 0) {
    const rows = await db
      .select({
        id: schema.users.id,
        role: schema.users.role,
        seasonRoleKey: schema.users.seasonRoleKey,
      })
      .from(schema.users)
      .where(
        inArray(
          schema.users.id,
          podium.map((row) => row.userId),
        ),
      );
    for (const row of rows) {
      podiumState.set(row.id, { role: row.role, seasonRoleKey: row.seasonRoleKey });
    }
  }

  let granted = 0;
  for (const row of podium) {
    const current = podiumState.get(row.userId) ?? { role: "student", seasonRoleKey: null };

    // Staf manusia yang kebetulan masuk tiga teratas tidak distempel: kursi
    // adalah amanah musiman, dan menempelkan kunci musim pada seorang moderator
    // akan membuat cron berikutnya mencabut perannya. Pemegang kursi musim ini
    // yang sudah berperan `moderator` juga dilewati: menulis ulang keadaan yang
    // sama setiap hari hanya menghasilkan satu baris audit harian yang tidak
    // memberi tahu apa pun.
    if (current.role === "moderator" || current.role === "admin") {
      if (current.seasonRoleKey === null || current.seasonRoleKey === seasonKey) continue;
    }

    await db
      .update(schema.users)
      .set({ role: "moderator", seasonRoleKey: seasonKey })
      .where(eq(schema.users.id, row.userId));

    granted += 1;

    await recordAudit(
      db,
      {
        actorId: null,
        action: "user.role_change",
        entity: "user",
        entityId: row.userId,
        before: roleSnapshot(current.role, current.seasonRoleKey),
        after: { role: "moderator", seasonRoleKey: seasonKey, reason: "season_podium" },
      },
      { log },
    );

    await enqueueMail(
      db,
      {
        toUserId: row.userId,
        kind: "seat_granted",
        dedupeKey: `seat:${seasonKey}:${row.userId}`,
        payload: { seasonKey, points: row.points },
      },
      log,
    );
  }

  // ── 5. Cabut kursi yang tergeser ──────────────────────────────────────────
  // Pemegang kursi musim ini yang tidak lagi di tiga teratas. Tanpa langkah ini,
  // seseorang yang turun ke peringkat 40 tetap menjadi moderator sampai kuartal
  // berganti — dan kursi berhenti bermakna "tiga teratas".
  const podiumIds = podium.map((row) => row.userId);
  const seated = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      seasonRoleKey: schema.users.seasonRoleKey,
    })
    .from(schema.users)
    .where(eq(schema.users.seasonRoleKey, seasonKey));

  const displacedRows = seated.filter((row) => !podiumIds.includes(row.id));

  if (displacedRows.length > 0) {
    await db
      .update(schema.users)
      .set({ role: "contributor", seasonRoleKey: null })
      .where(inArray(schema.users.id, displacedRows.map((row) => row.id)));

    for (const row of displacedRows) {
      await recordAudit(
        db,
        {
          actorId: null,
          action: "user.role_change",
          entity: "user",
          entityId: row.id,
          before: roleSnapshot(row.role, row.seasonRoleKey),
          after: { role: "contributor", seasonRoleKey: null, reason: "displaced" },
        },
        { log },
      );

      await enqueueMail(
        db,
        {
          toUserId: row.id,
          kind: "seat_revoked",
          dedupeKey: `seat-end:${seasonKey}:${row.id}`,
          payload: { seasonKey, reason: "displaced" },
        },
        log,
      );
    }
  }

  // ── 6. Honor ──────────────────────────────────────────────────────────────
  // Dibayar per jendela harian, bukan per permintaan: kuncinya deterministik dan
  // indeks unik `(user_id, action, ref_id)` yang menjaminnya. Tidak ada kode
  // penjaga tambahan yang bisa lupa.
  const windowStart = startOfDailyWindow(now);
  const activeSeats = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.seasonRoleKey, seasonKey));

  let stipendPaid = 0;
  let stipendCapped = 0;

  for (const seat of activeSeats) {
    const [used] = await db
      .select({ value: count() })
      .from(schema.pointsLog)
      .where(
        and(
          eq(schema.pointsLog.userId, seat.id),
          eq(schema.pointsLog.action, "season_stipend"),
          gte(schema.pointsLog.createdAt, seasonStart),
        ),
      );

    if ((used?.value ?? 0) >= STIPEND_MAX_DAYS_PER_SEASON) {
      stipendCapped += 1;
      log.info("stipend_capped", { userId: seat.id, seasonKey });
      continue;
    }

    const inserted = await db
      .insert(schema.pointsLog)
      .values({
        userId: seat.id,
        action: "season_stipend",
        refId: deterministicUuid(`season-stipend:${seat.id}:${windowStart.toISOString()}`),
        delta: STIPEND_POINTS,
      })
      .onConflictDoNothing()
      .returning({ id: schema.pointsLog.id });

    if (inserted.length === 0) continue; // sudah dibayar hari ini

    await db
      .update(schema.users)
      .set({
        points: sql`${schema.users.points} + ${STIPEND_POINTS}`,
        seasonPoints: sql`${schema.users.seasonPoints} + ${STIPEND_POINTS}`,
      })
      .where(eq(schema.users.id, seat.id));

    stipendPaid += 1;
  }

  // ── 7. Slot kuis harian ───────────────────────────────────────────────────
  // Kalau tiga peninjau telat bangun, seluruh sekolah tetap punya soal. Soal
  // dipilih deterministik (tertua yang belum pernah menjadi slot), sehingga
  // bank berputar alih-alih mengulang satu soal yang sama.
  let slotFilled = false;
  const existingSlot = await db.query.dailyQuizSlot.findFirst({
    where: eq(schema.dailyQuizSlot.windowStart, windowStart),
    columns: { windowStart: true },
  });

  if (!existingSlot) {
    const usedSlotQuestions = (
      await db.select({ questionId: schema.dailyQuizSlot.questionId }).from(schema.dailyQuizSlot)
    ).map((row) => row.questionId);

    const slotFilters = [eq(schema.questions.status, "approved")];
    if (usedSlotQuestions.length > 0) {
      slotFilters.push(notInArray(schema.questions.id, usedSlotQuestions));
    }

    const candidate = await db.query.questions.findFirst({
      where: and(...slotFilters),
      columns: { id: true },
      orderBy: [asc(schema.questions.createdAt), asc(schema.questions.id)],
    });

    if (candidate) {
      const claimed = await db
        .insert(schema.dailyQuizSlot)
        .values({ windowStart, questionId: candidate.id, authorId: null })
        .onConflictDoNothing()
        .returning({ windowStart: schema.dailyQuizSlot.windowStart });
      slotFilled = claimed.length > 0;
    } else {
      log.warn("daily_slot_empty_no_candidate", { windowStart: windowStart.toISOString() });
    }
  }

  // ── 8. Kedalaman bank soal ────────────────────────────────────────────────
  // Metrik ini yang menentukan apakah kuis harian hidup atau mati. Diukur pada
  // sampel pengguna aktif terakhir, bukan seluruh tabel: angka yang cukup untuk
  // memberi alarm, dengan biaya query yang tetap.
  let poolDepth: number | null = null;
  const activeSample = await db
    .select({ userId: schema.pointsLog.userId })
    .from(schema.pointsLog)
    .where(gte(schema.pointsLog.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)))
    .groupBy(schema.pointsLog.userId)
    .orderBy(desc(sql`max(${schema.pointsLog.createdAt})`))
    .limit(POOL_SAMPLE_SIZE);

  const [approvedCount] = await db
    .select({ value: count() })
    .from(schema.questions)
    .where(eq(schema.questions.status, "approved"));

  if (activeSample.length > 0 && approvedCount) {
    const answered = await db
      .select({ userId: schema.pointsLog.userId, value: count(schema.pointsLog.refId) })
      .from(schema.pointsLog)
      .where(
        and(
          eq(schema.pointsLog.action, "quiz_answer"),
          inArray(
            schema.pointsLog.userId,
            activeSample.map((row) => row.userId),
          ),
        ),
      )
      .groupBy(schema.pointsLog.userId);

    const byUser = new Map(answered.map((row) => [row.userId, row.value]));
    const depths = activeSample
      .map((row) => approvedCount.value - (byUser.get(row.userId) ?? 0))
      .sort((a, b) => a - b);
    poolDepth = depths[Math.floor(depths.length / 2)] ?? null;

    log.info("daily_pool_depth", {
      depth: poolDepth,
      approved: approvedCount.value,
      sample: activeSample.length,
    });

    if (poolDepth !== null && poolDepth < DAILY_POOL_DEPTH_MIN) {
      log.warn("daily_pool_depth_low", {
        depth: poolDepth,
        approved: approvedCount.value,
        threshold: DAILY_POOL_DEPTH_MIN,
      });
    }
  }

  // ── 9. Outbox ─────────────────────────────────────────────────────────────
  // Pemangkasan catatan lama **tidak** di sini: ia milik `RETENTION_POLICY`
  // (`mail_outbox`, satu bulan), yang sudah dijalankan job retensi tiap malam.
  // Dua jalur hapus untuk satu tabel adalah dua angka yang bisa berbeda.
  const mail = await sendPendingMail(db, log);

  return {
    seasonKey,
    archived,
    rolledOver: rolled.length,
    revoked: revokedRows.length,
    granted,
    displaced: displacedRows.length,
    stipendPaid,
    stipendCapped,
    slotFilled,
    poolDepth,
    mail,
  };
}
