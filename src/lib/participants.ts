// src/lib/participants.ts
// ─── Siapa yang dihitung sebagai siswa ───────────────────────────────────────
// Akun yang sudah dianonimkan **tetap berupa baris `users`** — itu keputusan M11
// yang disengaja: `modules.uploader_id`, `questions.uploader_id` dan
// `points_log.user_id` menunjuk ke sana, jadi menghapus barisnya akan ikut
// menghapus karya siswa lain. Yang tersisa adalah tombstone: `clerk_id` menjadi
// `deleted:<uuid>`, nama menjadi "Anonim", dan poin menjadi 0.
//
// Sebuah tombstone bukan peserta. Tanpa filter ini ia muncul di dasar papan
// peringkat dengan nama "Anonim" dan menggelembungkan setiap angka "total siswa"
// di platform — dan angka yang berbeda antara papan peringkat dan halaman profil
// adalah bug yang paling mudah dilihat siswa.
//
// Staf manusia juga bukan peserta (M17). Moderator yang diangkat lewat
// `db:promote` adalah **guru yang mengelola platform**, bukan siswa yang
// berlomba: menampilkannya di papan peringkat membuat papan itu berbohong dua
// arah — peringkat siswa lain bergeser oleh orang yang tidak ikut bertanding,
// dan moderatornya sendiri terlihat sebagai siswa oleh seluruh sekolah. Karena
// itu ia disembunyikan dari setiap permukaan "daftar orang".
//
// Bedanya dengan pemegang kursi Dewan Podium: kursi **adalah** peserta. Ia siswa
// yang menang, `season_role_key`-nya terisi, dan kalau ia disembunyikan podium
// tidak bisa dihitung sama sekali. Karena itu `IS_HUMAN_STAFF` mensyaratkan
// kuncinya `NULL` — kunci yang terisi berarti peran itu berasal dari musim, dan
// kursi yang sudah kedaluwarsa (kunci musim lama, belum dicabut cron) kembali
// menjadi peserta biasa.
//
// Diekspor sebagai satu ekspresi SQL, bukan sebagai fungsi yang mengembalikan
// string, supaya ia bisa dipakai langsung di `.where(...)` maupun di `count()`.
// Keduanya dibangun dengan template `sql`, bukan `and()`/`or()`: tipe kembalian
// helper itu adalah `SQL | undefined`, dan `.where(undefined)` berarti **tanpa
// filter sama sekali** — filter yang bisa hilang diam-diam adalah kelas bug yang
// sama dengan `proxy.ts` yang mati sembilan milestone.
import { inArray, isNull, notLike, sql } from "drizzle-orm";
import { users } from "@/db/schema";

/** Awalan tombstone yang ditulis `anonymiseAccountByClerkId()` (M11/M12). */
export const DELETED_CLERK_PREFIX = "deleted:";

/**
 * Peran peninjau, dicerminkan dari `REVIEWER_ROLES` di `lib/authz.ts`.
 *
 * Disalin, bukan diimpor, karena `authz.ts` menarik Clerk dan `next/server` ke
 * setiap modul yang menyentuhnya. `tests/unit/participants.test.ts` memastikan
 * kedua daftar tetap sama — sebuah salinan yang tidak diuji adalah definisi
 * kedua yang menunggu untuk berbeda.
 */
export const HUMAN_STAFF_ROLES = ["moderator", "admin"] as const;

/**
 * `true` untuk staf manusia: peran peninjau yang **tidak** berasal dari kursi
 * musim. Pemegang kursi tidak termasuk — ia peserta yang sedang menjabat.
 */
export const IS_HUMAN_STAFF = sql`(${inArray(users.role, [...HUMAN_STAFF_ROLES])} and ${isNull(users.seasonRoleKey)})`;

/** `true` untuk setiap baris `users` yang masih peserta. */
export const IS_PARTICIPANT = sql`(${notLike(users.clerkId, `${DELETED_CLERK_PREFIX}%`)} and not ${IS_HUMAN_STAFF})`;
