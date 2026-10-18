// src/lib/ids.ts
// ─── Bentuk id yang boleh datang dari luar ────────────────────────────────────
// Satu definisi, dua pembaca: `src/lib/pagination.ts` memakainya untuk menolak
// kursor yang id-nya bukan UUID, dan halaman profil publik memakainya untuk
// memutuskan bahwa sebuah segmen URL **bukan id sama sekali**.
//
// Kenapa yang kedua penting: `users.id` bertipe `uuid`, jadi Postgres menolak
// `WHERE id = 'halo'` dengan galat `22P02` (invalid_text_representation). Sebelum
// ini halaman profil menangkap galat itu bersama galat database sungguhan dan
// merender "Siswa Tidak Ditemukan" untuk keduanya — artinya database yang sedang
// mati terlihat seperti siswa yang tidak ada, dan satu-satunya jejaknya ada di
// log. Memeriksa bentuknya lebih dulu membuat kedua kasus itu tidak bisa lagi
// tertukar: URL ngawur menjadi 404, database bermasalah menjadi 500 yang jujur.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `true` bila `value` berbentuk UUID (versi apa pun, huruf besar/kecil). */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
