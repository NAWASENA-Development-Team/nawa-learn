// src/lib/promotion.ts
// ─── Satu-satunya pintu evolusi student → contributor ─────────────────────────
//
// Sebelum M18 ada **empat** pintu, dan keempatnya tanpa ambang sama sekali:
// `quiz/submit`, `quiz/daily-claim`, `modules/approve`, `questions/approve` —
// masing-masing menempelkan
//
//   role: sql`CASE WHEN role = 'student' THEN 'contributor'::role ELSE role END`
//
// pada `UPDATE` poinnya. Artinya **satu jawaban benar** sudah cukup untuk menjadi
// kontributor, dan itu persis yang terjadi di produksi: dua kontributor dengan
// total dua baris `quiz_answer`. Tidak ada tes yang mengunci perilaku itu, jadi
// tidak ada yang menangkapnya sejak M3.
//
// Aturan M18: peran naik bila **karya disetujui** dan poin sudah melewati ambang.
// Kehadiran (klaim harian, jawaban kuis) tidak pernah menaikkan peran — kalau
// kehadiran cukup, "kontributor" berhenti berarti apa pun.
//
// ## Kenapa pernyataan terpisah, bukan satu `UPDATE`
//
// `UPDATE users SET points = points + 50 WHERE points >= 100` mengevaluasi
// `WHERE` terhadap nilai **lama** (semantik Postgres). Siswa dengan 60 poin yang
// baru mendapat +50 tidak akan lolos, padahal totalnya 110. Jadi poin ditambah
// lebih dulu, lalu peran diperiksa pada keadaan yang sudah baru.
//
// Keuntungan sampingannya sama pentingnya: `RETURNING` kosong berarti tidak ada
// yang berubah, sehingga audit dan surel hanya terjadi ketika peran sungguh
// berpindah. Dua peninjau yang menyetujui dua kiriman pada detik yang sama tidak
// menghasilkan dua surel "kamu sekarang kontributor".
//
// Modul ini **tidak pernah melempar**. Kegagalan promosi dicatat sebagai
// `role_promotion_failed` dan keputusan approval yang memicunya tetap berdiri —
// pola yang sama dengan `recordAudit()` dan `enqueueMail()`: sebuah notifikasi
// atau catatan yang gagal tidak boleh membatalkan karya yang sudah diterima.
import { and, eq, gte } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db/types";
import { recordAudit } from "@/lib/auditLog";
import type { Logger } from "@/lib/logger";
import { enqueueMail } from "@/lib/mailer";

/**
 * Poin minimum untuk menjadi kontributor.
 *
 * 100 dipilih setelah Kuis Harian menjadi **satu soal** dengan hadiah +25 hanya
 * bila benar: tiga hari berturut-turut menjawab benar sudah cukup untuk ambang
 * ini. Itu memang tujuannya — ambang ini mengukur kehadiran belajar, sementara
 * peran contributor tetap menuntut satu karya yang disetujui.
 */
export const CONTRIBUTOR_POINTS_THRESHOLD = 100;

export interface PromotionInput {
  userId: string;
  /** `null` berarti sistem (mis. cron), pola yang sama dengan `audit_log`. */
  actorId: string | null;
  log: Logger;
}

/**
 * Naikkan `student` → `contributor` bila poinnya sudah melewati ambang.
 *
 * @returns `true` hanya bila barisnya benar-benar berubah.
 */
export async function promoteIfEligible(
  db: AppDb,
  input: PromotionInput,
): Promise<boolean> {
  try {
    const promoted = await db
      .update(schema.users)
      .set({ role: "contributor" })
      .where(
        and(
          eq(schema.users.id, input.userId),
          // Hanya `student`. Contributor, moderator, admin, dan pemegang kursi
          // musim tidak pernah tersentuh — termasuk kursi yang perannya berasal
          // dari `season_role_key`, yang akan dicabut cron saat musim berganti.
          eq(schema.users.role, "student"),
          gte(schema.users.points, CONTRIBUTOR_POINTS_THRESHOLD),
        ),
      )
      .returning({ id: schema.users.id, points: schema.users.points });

    const row = promoted[0];
    if (!row) return false;

    await recordAudit(
      db,
      {
        actorId: input.actorId,
        action: "user.role_change",
        entity: "user",
        entityId: row.id,
        before: { role: "student" },
        after: {
          role: "contributor",
          reason: "contribution_threshold",
          points: row.points,
        },
      },
      { log: input.log },
    );

    await enqueueMail(
      db,
      {
        toUserId: row.id,
        kind: "role_promoted",
        // Satu peran, satu surel seumur hidup. Kunci dedupe-nya tidak memuat
        // tanggal: promosi hanya bisa terjadi sekali per akun.
        dedupeKey: `role:${row.id}`,
        payload: { points: row.points, role: "contributor" },
      },
      input.log,
    );

    input.log.info("role_promoted", {
      userId: row.id,
      points: row.points,
      threshold: CONTRIBUTOR_POINTS_THRESHOLD,
    });

    return true;
  } catch (error) {
    // Alertable. Tidak pernah dilempar: approval yang memicunya sudah terjadi.
    input.log.error("role_promotion_failed", error);
    return false;
  }
}
