// src/app/api/moderator/team/route.ts
// ─── Siapa yang menjaga platform ini (M17) ────────────────────────────────────
// Sejak staf manusia disembunyikan dari papan peringkat, tidak ada satu pun
// permukaan publik yang bisa menjawab "siapa moderator di sini?". Pemegang kursi
// yang baru duduk perlu tahu kepada siapa ia bertanya, dan staf perlu tahu siapa
// yang sedang menjabat bersamanya. Jawabannya ada di sini, di balik peninjau.
//
// Dua kelompok, dua definisi yang sudah ada di tempat lain — tidak ada definisi
// ketiga yang dibuat di route ini:
//   - staf manusia : `IS_HUMAN_STAFF` dari `lib/participants.ts`, ekspresi yang
//                    sama yang dipakai papan peringkat untuk mengecualikan mereka
//   - kursi musim  : `getPodium()`, sumber yang sama dengan cron dan pemberian
//                    peran. Kursi **tidak** diambil dari `season_role_key`,
//                    karena kunci yang tersisa dari musim lalu belum dicabut cron
//                    akan tampil sebagai kursi yang tidak lagi duduk.
//
// Yang tidak dikembalikan: `email`. Daftar ini dibaca kursi musim juga, dan
// alamat surel seorang guru bukan bagian dari "siapa yang harus saya hubungi di
// panel". Id-nya cukup untuk membuka profil (peninjau boleh membuka profil staf).
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { asc, inArray } from "drizzle-orm";
import { requireReviewer } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { IS_HUMAN_STAFF } from "@/lib/participants";
import { getPodium } from "@/lib/seat";

const noStore = { "cache-control": "no-store" } as const;

export async function GET(req: Request) {
  const log = requestLogger(req);

  // Peninjau, bukan staf manusia saja: justru kursi musim yang paling butuh
  // daftar ini. Yang tidak boleh adalah siswa biasa.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;

  const limit = await rateLimit(req, "moderator/team", authz.user.id);
  if (!limit.ok) return limit.response;

  try {
    // Kolom disebut satu per satu. `select()` polos akan ikut menarik `email`
    // dan kolom consent, dan `tests/unit/pii-surface.test.ts` menolak keduanya
    // muncul di bawah `moderator/`.
    //
    // Filternya adalah `IS_HUMAN_STAFF` yang **sama** dengan yang dipakai papan
    // peringkat untuk mengecualikan mereka — bukan salinan syaratnya. Menyalin
    // `role IN (...) AND season_role_key IS NULL` ke sini berarti route ini
    // punya definisi "staf" sendiri yang bisa berbeda diam-diam dari papan.
    const staff = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        avatarIndex: users.avatarIndex,
        photoUrl: users.photoUrl,
      })
      .from(users)
      .where(IS_HUMAN_STAFF)
      .orderBy(asc(users.name));

    const podium = await getPodium(db);

    // Nama pemegang kursi dicari terpisah, **berurutan**, bukan `Promise.all`:
    // PGlite di test adalah satu koneksi, dan satu batch paralel membuat seluruh
    // suite menggantung.
    const seats: Array<{
      id: string;
      name: string;
      avatarIndex: number | null;
      photoUrl: string | null;
      points: number;
      seatNumber: number;
    }> = [];

    if (podium.length > 0) {
      const rows = await db
        .select({
          id: users.id,
          name: users.name,
          avatarIndex: users.avatarIndex,
          photoUrl: users.photoUrl,
        })
        .from(users)
        .where(inArray(users.id, podium.map((entry) => entry.userId)));

      const byId = new Map(rows.map((row) => [row.id, row]));

      // Urutan mengikuti podium, bukan urutan `inArray` (yang tidak dijamin).
      for (const [index, entry] of podium.entries()) {
        const row = byId.get(entry.userId);
        // Baris bisa hilang di antara dua query hanya kalau akunnya dihapus
        // tepat saat itu. Melewatinya lebih jujur daripada menampilkan
        // "Tanpa Nama" di kursi nomor satu.
        if (!row) continue;
        seats.push({ ...row, points: entry.points, seatNumber: index + 1 });
      }
    }

    // `staff` tidak mungkin tumpang tindih dengan `seats`: `getPodium()` menyaring
    // `IS_PARTICIPANT`, dan `IS_PARTICIPANT` sudah mengecualikan staf manusia.
    return NextResponse.json(
      { success: true, staff, seats },
      { status: 200, headers: noStore },
    );
  } catch (error) {
    log.error("moderator team read error", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: noStore },
    );
  }
}
