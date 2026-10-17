// src/lib/policy.ts
// ─── Kebijakan privasi & ketentuan layanan: satu sumber kebenaran ─────────────
// Versi kebijakan hidup di sini, bukan di dalam teks halaman, karena dua tempat
// yang berbeda harus setuju tentang apa arti sebuah persetujuan:
//
//   • halaman /privacy dan /terms menampilkan versi yang berlaku sekarang
//   • consent yang tersimpan mencatat versi yang disetujui *saat itu*
//
// Kalau teks kebijakan berubah secara material, naikkan POLICY_VERSION. Baris
// `users.consent_policy_version` yang tidak lagi sama dengan konstanta ini
// berarti "menyetujui kebijakan lama", dan gerbang consent di
// src/app/(dashboard)/layout.tsx akan meminta persetujuan ulang. Tanpa versi,
// sebuah centang dari dua tahun lalu tidak bisa dibedakan dari centang hari ini.
//
// Modul ini sengaja tanpa impor apa pun: halaman server, route handler, dan
// komponen klien semuanya membacanya.

/** Versi kebijakan yang berlaku. Naikkan bila isinya berubah secara material. */
export const POLICY_VERSION = "1.0";

/** Tanggal versi ini mulai berlaku (ISO, tampil apa adanya di halaman). */
export const POLICY_EFFECTIVE_DATE = "2026-10-17";

/** Nama pengendali data yang ditampilkan di halaman kebijakan. */
export const DATA_CONTROLLER = "OSIS NAWASENA SMAN 2 Jonggol (Divisi ICT)";

/** Alamat surel untuk pertanyaan/permintaan terkait data pribadi. */
export const PRIVACY_CONTACT_EMAIL = "privasi@nawasena.site";

/** Rute publik yang memuat kedua dokumen. Dipakai oleh halaman dan oleh tautan. */
export const POLICY_PATHS = {
  privacy: "/privacy",
  terms: "/terms",
} as const;

/**
 * Apakah versi yang tersimpan masih versi yang berlaku?
 *
 * `null`/`undefined`/string kosong selalu berarti "belum setuju" — bukan
 * "setuju", dan bukan error. Ini predikat murni supaya bisa diuji tanpa
 * database.
 */
export function hasAcceptedCurrentPolicy(version: string | null | undefined): boolean {
  return version === POLICY_VERSION;
}
