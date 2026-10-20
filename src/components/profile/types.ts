// components/profile/types.ts
// ─── Bentuk data yang menyeberang dari server ke komponen profil ──────────────
//
// Field-field di sini adalah *payload*. Yang tidak dibutuhkan UI tidak boleh
// ada di sini: `clerkId` dan `email` sengaja tidak ada (M12). Keduanya dulu
// dikirim dari server padahal tidak pernah dirender — `email` malah dikosongkan
// untuk profil orang lain, yang berarti nilainya tetap menyeberang hanya untuk
// dibuang. Pesan yang membawa data yang tidak dirender adalah permukaan PII
// yang menunggu untuk dibocorkan.
//
// Memisahkan definisi ini ke file sendiri supaya enam komponen profil bisa
// mengimpornya tanpa harus mengimpor seluruh `ProfileClient` (dan tanpa
// menduplikasinya — duplikasi pasti berubah arah).

/** Baris `users` yang dirender profil. */
export interface UserProfile {
  id: string;
  name: string;
  // `clerkId` dan `email` sengaja tidak ada di sini (M12). Keduanya dulu dikirim
  // dari server padahal tidak pernah dirender — `email` malah dikosongkan untuk
  // profil orang lain, yang berarti nilainya tetap menyeberang hanya untuk
  // dibuang. Yang tidak dibutuhkan UI tidak boleh ada di payload.
  role: "guest" | "student" | "contributor" | "moderator" | "admin";
  points: number;
  createdAt: string; // ISO string
  rank: number;
  totalStudents: number;
  // Profile customisation — stored in DB so other users can see them
  avatarIndex: number | null;
  photoUrl: string | null;
  bio: string | null;
  motto: string | null;
  // Level rewards
  levelFrame: string | null; // "wood" | "bronze" | "silver" | "gold" | null
}

/** Baris `modules` milik pengguna ini. */
export interface UserModule {
  id: string;
  title: string;
  subject: string;
  grade: string;
  category: string;
  downloads: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

/** Baris `questions` milik pengguna ini. */
export interface UserQuestion {
  id: string;
  questionText: string;
  difficulty: "mudah" | "sedang" | "sulit";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

/** Baris `points_log` milik pengguna ini. */
export interface PointLog {
  id: string;
  action: string;
  delta: number;
  createdAt: string;
}

/**
 * Satu baris `GET /api/profile/status`: sebuah kontribusi atau laporan,
 * diratakan untuk tab "status" halaman profil.
 *
 * `status` adalah `statusEnum` — `submissions.status` dan `reports.status`
 * memakainya, jadi kedua cabang route itu benar-benar berbagi satu union.
 * Dulu ini bertipe `any[]`, dan JSX membandingkannya dengan `"resolved"`, nilai
 * yang tidak pernah ada di enum itu.
 */
export type ProfileStatusItem = {
  type: "module" | "question" | "report";
  title: string;
  status: "pending" | "approved" | "rejected";
  /** ISO-8601 string: a `Date` does not survive `JSON.stringify`. */
  submittedAt: string;
  feedback: string | null;
};

// ─── Level helpers ─────────────────────────────────────────────────────────────
// Inline di sini, bukan dari `src/lib/levelUtils`, karena profil dan UI lain
// membutuhkan rumus yang sama tanpa membawa dependensi server. Linear scaling:
// dari L ke L+1 butuh L*50 XP.
export const calcLevel = (pts: number): number =>
  Math.floor((1 + Math.sqrt(1 + (4 * pts) / 25)) / 2);

export const calcLevelThreshold = (lvl: number): number => 25 * lvl * (lvl - 1);

// ─── Nilai tampilan ketika kolomnya `NULL` ──────────────────────────────────────
// Sebuah konstanta, bukan state: nilai ini tidak pernah berubah selama komponen
// hidup, dan menyimpannya di state membuatnya ikut "disinkronkan" dari prop —
// persis bug yang baru saja dihapus.
export const ADMIN_DEFAULT_BIO =
  "Administrator Platform NAWA-LEARN SMAN 2 Jonggol. Siap menyaring modul-modul berkualitas!";
export const STUDENT_DEFAULT_BIO =
  "Siswa aktif SMAN 2 Jonggol. Senang berbagi catatan dan belajar bersama teman-teman.";
export const DEFAULT_MOTTO = "Belajar hari ini, memimpin esok hari!";

// Daftar bio acak untuk tombol "Acak Bio Lucu".
export const PLAYFUL_BIOS = [
  "Siswa teladan SMAN 2 Jonggol yang hobi belajar sambil dengerin lagu pop alternatif. 🎧",
  "Pencari ilmu sejati. Musuh bebuyutan soal kalkulus, tapi bersahabat baik dengan biologi sel. 🧬",
  "Menyelesaikan limit fungsi aljabar lebih cepat daripada menyeduh mi instan. ⚡",
  "Kolektor V-Point NAWA-LEARN teraktif! Mari majukan literasi digital sekolah kita! 📚",
  "Tidur nyenyak adalah mitos, rumus fisika adalah realitas. Pejuang UTBK jalur undangan! 🎓",
];

/** Judul tampilan per kategori. `Record<BadgeCategory, …>` supaya kategori baru
 *  tidak bisa ditambahkan tanpa judulnya. */
const BADGE_CATEGORY_TITLES = {
  contribution: "🎁 Lencana Kontribusi",
  learning: "📚 Lencana Pembelajaran",
  milestone: "🎯 Lencana Pencapaian",
  social: "🤝 Lencana Sosial",
  special: "⭐ Lencana Khusus",
  hidden: "🔒 Lencana Tersembunyi",
} as const;

export { BADGE_CATEGORY_TITLES };
