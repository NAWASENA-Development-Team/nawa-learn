// app/api/moderator/hidden-badges/route.ts
// ─── Siapa yang memegang lencana rahasia ──────────────────────────────────────
//
// Sebelum M14e rute ini mengirim angka mentah setiap pengguna ke browser, dan
// panel moderator **mengevaluasi sendiri** kedelapan kondisi rahasia dengan
// `BADGES.filter(...)`. Akibatnya seluruh katalog — termasuk kedelapan fungsi
// `unlockCondition` yang seharusnya dirahasiakan — ikut ke bundel browser.
// Siapa pun yang membuka panel itu, atau sekadar mengunduh chunk-nya, bisa
// membaca syarat lencana "rahasia" dari DevTools.
//
// Sekarang evaluasinya di sini. Jawabannya `BadgeDisplay[]` — judul, ikon, dan
// `requirement` yang ditulis di katalog server — ditambah peta pemegang per id
// lencana. Komponen klien tidak lagi memiliki satu pun fungsi kondisi.
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireReviewer, isHumanReviewer } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { IS_PARTICIPANT } from "@/lib/participants";
import { emptySpecialtyStats, getSpecialtyStats, getSubjectBreakdown } from "@/lib/specialtyStats";
import {
  buildBadgeUnlockData,
  evaluateBadges,
  getHiddenBadgeDisplays,
} from "@/lib/badges/evaluate";

/**
 * Batas jumlah akun yang dievaluasi dalam satu permintaan.
 *
 * Panel ini menampilkan pemegang lencana, bukan papan peringkat. Tanpa batas,
 * biayanya tumbuh sebanding dengan seluruh populasi sekolah setiap kali tab
 * dibuka — dan karena `getSpecialtyStats` mengagregasi di database, batas ini
 * menjaga ukuran payload, bukan jumlah query (tetap tiga).
 */
const MAX_MONITORED_USERS = 500;

interface HiddenBadgeHolder {
  id: string;
  name: string;
  points: number;
  approvedModules: number;
  approvedQuestions: number;
}

export async function GET(req: Request) {
  const log = requestLogger(req);
  // Memuat statistik per siswa, jadi staf atau pemegang kursi musim.
  //
  // Kursi boleh melihat **siapa** memegang lencana rahasia — itu bagian dari
  // pekerjaan moderasi — tetapi tidak boleh membaca **syaratnya**. Syarat yang
  // terbaca adalah syarat yang bisa diakali, dan kursi hanya memegang amanah
  // satu musim.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;

  try {
    // Daftar kolom eksplisit: `select()` polos akan ikut membawa `email` dan dua
    // kolom persetujuan UU PDP ke panel yang hanya butuh nama dan angka.
    // `IS_PARTICIPANT` menyaring akun yang sudah dianonimkan — tombstone bukan
    // siswa, dan lencana bukan sesuatu yang bisa dipegang akun yang sudah dihapus.
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        points: users.points,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(IS_PARTICIPANT)
      .orderBy(desc(users.points), desc(users.id))
      .limit(MAX_MONITORED_USERS);

    const ids = rows.map((row) => row.id);
    const [specialty, subjects] = await Promise.all([
      getSpecialtyStats(db, ids),
      getSubjectBreakdown(db, ids),
    ]);

    const badges = getHiddenBadgeDisplays({
      includeRequirement: isHumanReviewer(authz.user),
    });
    const holders: Record<string, HiddenBadgeHolder[]> = {};
    for (const badge of badges) holders[badge.id] = [];

    for (const row of rows) {
      const stats = specialty.get(row.id) ?? emptySpecialtyStats();
      const unlocked = evaluateBadges(
        buildBadgeUnlockData({
          points: row.points,
          // Tidak satu pun dari delapan kondisi rahasia membaca peringkat, jadi
          // nol adalah nilai yang jujur di sini — bukan tebakan yang kebetulan
          // tidak berpengaruh.
          rank: 0,
          specialty: stats,
          modulesBySubject: subjects.get(row.id) ?? {},
          createdAt: row.createdAt,
        }),
      );

      for (const badgeId of unlocked) {
        const list = holders[badgeId];
        if (!list) continue;
        list.push({
          id: row.id,
          name: row.name,
          points: row.points,
          approvedModules: stats.approvedMods,
          approvedQuestions: stats.approvedQuestions,
        });
      }
    }

    return NextResponse.json({ success: true, badges, holders }, { status: 200 });
  } catch (error) {
    log.error("hidden_badges_failed", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
