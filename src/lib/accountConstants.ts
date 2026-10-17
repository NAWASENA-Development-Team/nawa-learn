// src/lib/accountConstants.ts
// ─── Konstanta akun yang dipakai klien *dan* server ───────────────────────────
// Frasa konfirmasi penghapusan akun harus sama persis di dua tempat: di tombol
// yang menuntut pengguna mengetiknya (komponen klien) dan di skema yang
// memverifikasinya (route handler). Dua literal yang ditulis terpisah akan
// menyimpang, dan penyimpangannya muncul sebagai "tombol hapus yang tidak
// pernah bekerja" — bug yang tidak terlihat sampai ada orang benar-benar ingin
// menghapus akunnya.
//
// Modul ini sengaja **tanpa impor apa pun**, sama seperti src/lib/policy.ts:
// src/lib/accountData.ts mengimpor `@/db/schema` (dan lewat itu drizzle), jadi
// konstanta ini tidak boleh tinggal di sana — satu nilai yang diimpor komponen
// klien dari sana akan menyeret kode server ke dalam bundle browser.

/**
 * Frasa yang harus diketik ulang pengguna untuk menghapus akunnya.
 *
 * Sebuah tombol "Ya, hapus" dengan dua langkah konfirmasi masih bisa tertekan
 * karena refleks; sebuah kalimat yang harus diketik tidak. Tindakan ini permanen
 * dan memutus akses masuk, jadi gesekan kecil di sini disengaja.
 */
export const DELETE_ACCOUNT_CONFIRMATION = "HAPUS AKUN SAYA";

/** Nama pengganti pada baris yang tidak ikut dihapus (atribusi karya). */
export const ANONYMOUS_DISPLAY_NAME = "Anonim";
