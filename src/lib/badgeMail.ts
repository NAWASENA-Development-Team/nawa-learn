// src/lib/badgeMail.ts
// ─── Kabar lencana: hanya yang langka, hanya sekali ───────────────────────────
// Lencana `common`/`uncommon` tidak pernah dikirim. Alasannya bukan teknis:
// surel yang datang setiap hari akan dimatikan orang, dan begitu dimatikan,
// surel yang benar-benar penting ikut hilang. Jadi ambangnya `epic`/`legendary`
// — lencana yang memang layak diketahui.
//
// Lencana **rahasia** juga tidak pernah dikirim, sekalipun langka. Judul lencana
// rahasia adalah rahasianya; surel yang menyebutnya membocorkan hal yang sengaja
// disembunyikan dari halaman profil (lihat `src/lib/badges/evaluate.ts`).
//
// Tidak ada tabel "lencana terkirim". `dedupe_key` di `mail_outbox` sudah
// memainkan peran itu: `badge:{userId}:{badgeId}` hanya bisa masuk sekali, jadi
// evaluasi yang berjalan pada setiap persetujuan tidak pernah mengirim surel
// kedua. Satu kejadian, satu surel — dijaga database, bukan kode penjaga yang
// bisa lupa.

import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { AppDb } from "@/db/types";
import { BADGE_DEFINITIONS } from "@/lib/badges/catalog";
import { buildBadgeUnlockData, evaluateBadges } from "@/lib/badges/evaluate";
import { emptySpecialtyStats, getSpecialtyStats, getSubjectBreakdown } from "@/lib/specialtyStats";
import { enqueueMail } from "@/lib/mailer";
import { rankOf } from "@/lib/seat";
import type { Logger } from "@/lib/logger";

/** Rarity yang layak dikirim lewat surel. Lihat komentar di atas. */
const NOTIFY_RARITIES: readonly string[] = ["epic", "legendary"];

/**
 * Kirim kabar untuk lencana langka yang **sudah** terbuka bagi pengguna ini.
 *
 * Tidak pernah melempar dan tidak pernah menggagalkan pemanggilnya: sebuah
 * persetujuan sudah terjadi, dan lencana adalah akibat sampingan dari poin yang
 * baru saja ditulis. Mengembalikan jumlah surel yang benar-benar baru dicatat.
 */
export async function notifyUnlockedBadges(
  db: AppDb,
  userId: string,
  log: Logger,
): Promise<number> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { points: true, createdAt: true },
    });
    if (!user) return 0;

    // Berurutan, bukan `Promise.all`: driver test (PGlite) memakai satu koneksi,
    // dan query yang berlomba di atas satu koneksi adalah sumber kegagalan yang
    // hanya muncul di test.
    const specialty = await getSpecialtyStats(db, [userId]);
    const breakdown = await getSubjectBreakdown(db, [userId]);
    const rank = await rankOf(db, userId);

    const data = buildBadgeUnlockData({
      points: user.points,
      rank,
      specialty: specialty.get(userId) ?? emptySpecialtyStats(),
      modulesBySubject: breakdown.get(userId) ?? {},
      createdAt: user.createdAt,
    });

    const unlocked = new Set(evaluateBadges(data));
    let queued = 0;

    for (const badge of BADGE_DEFINITIONS) {
      if (!unlocked.has(badge.id)) continue;
      if (!NOTIFY_RARITIES.includes(badge.rarity)) continue;
      if (badge.hidden) continue; // judulnya rahasia

      const inserted = await enqueueMail(
        db,
        {
          toUserId: userId,
          kind: "badge_unlocked",
          dedupeKey: `badge:${userId}:${badge.id}`,
          payload: { badgeTitle: badge.title },
        },
        log,
      );
      if (inserted) queued += 1;
    }

    return queued;
  } catch (error) {
    log.error("badge_mail_failed", error);
    return 0;
  }
}
