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
// Diekspor sebagai satu ekspresi SQL, bukan sebagai fungsi yang mengembalikan
// string, supaya ia bisa dipakai langsung di `.where(...)` maupun di `count()`.
import { notLike } from "drizzle-orm";
import { users } from "@/db/schema";

/** Awalan tombstone yang ditulis `anonymiseAccountByClerkId()` (M11/M12). */
export const DELETED_CLERK_PREFIX = "deleted:";

/** `true` untuk setiap baris `users` yang masih peserta. */
export const IS_PARTICIPANT = notLike(users.clerkId, `${DELETED_CLERK_PREFIX}%`);
