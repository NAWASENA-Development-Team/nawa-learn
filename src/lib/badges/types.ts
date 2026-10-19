// src/lib/badges/types.ts
// ─── Bentuk data lencana ──────────────────────────────────────────────────────
//
// Berkas ini **tidak mengimpor apa pun**. Itulah alasannya berdiri sendiri:
// tipe di sini dipakai oleh modul server (`specialtyStats`, halaman profil) dan
// oleh komponen klien, dan sebuah tipe yang menarik `@/db` ke dalam bundel
// browser akan menggagalkan build, bukan sekadar memperbesar bundel.

/** Kategori tampilan. `hidden` adalah lencana rahasia yang hanya moderator tahu.
 *
 *  Daftar ini adalah daftar kategori yang **benar-benar punya lencana**: nilai
 *  `"subject"` yang dulu ada di sini tidak dipakai satu pun dari 85 definisi, dan
 *  kategori yang tidak pernah muncul hanya menghasilkan cabang render yang tidak
 *  bisa dicapai. */
export type BadgeCategory =
  | "contribution"
  | "learning"
  | "social"
  | "milestone"
  | "special"
  | "hidden";

export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/**
 * Potret satu siswa pada saat evaluasi.
 *
 * Semua angka di sini berasal dari SQL (`getSpecialtyStats` + satu agregat
 * subjek), bukan dari baris yang kebetulan dimuat untuk ditampilkan. Sebelum
 * M14e, `approvedModules`, `approvedQuestions`, `totalDownloads` dan
 * `modulesBySubject` diturunkan di browser dari daftar modul/soal halaman itu —
 * sumber kedua untuk angka yang sama, persis yang membuat papan peringkat dan
 * profil berbeda pendapat sebelum M13.
 *
 * `totalStudents`, `questionsCreated` dan `createdAt` sudah dihapus di M14e:
 * tidak satu pun dari 85 kondisi membacanya, dan `createdAt` hanya hidup untuk
 * menurunkan `accountAgeInDays` — yang kini dihitung sekali, di server.
 */
export interface BadgeUnlockData {
  points: number;
  rank: number;
  approvedModules: number;
  approvedQuestions: number;
  totalDownloads: number;
  modulesBySubject: Record<string, number>;
  accountAgeInDays: number;
}

/** Satu lencana beserta aturan pembukaannya. Hanya ada di server. */
export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  unlockCondition: (data: BadgeUnlockData) => boolean;
  howToUnlock: string;
  /**
   * Jika `true`, judul/deskripsi/ikon asli tidak dikirim ke siswa yang belum
   * membukanya — lihat `toBadgeDisplays()` di `evaluate.ts`.
   */
  hidden?: boolean;
  /**
   * Syarat dalam bahasa manusia, **hanya untuk panel moderator** pada lencana
   * rahasia — lencana biasa sudah punya `howToUnlock` yang memang boleh dibaca
   * siswa.
   *
   * Ini tulisan, bukan kode. Versi sebelumnya menurunkan teks ini dari
   * `unlockCondition.toString()`, dan itu tidak pernah benar-benar bekerja:
   * `toString()` membaca fungsi yang **sudah dikompilasi**, jadi `3000` keluar
   * sebagai `3e3`, dan di bundel produksi yang diminifikasi parameter `data`
   * menjadi `e` sehingga hasilnya `e.points>=3e3`. Teks yang ditulis tangan tidak
   * bergantung pada minifier.
   *
   * Konsekuensinya jujur dicatat: teks ini bisa tertinggal bila kondisinya
   * diubah. Itu bug tampilan di panel moderator, bukan kebocoran atau kesalahan
   * hitung — `unlockCondition` tetap satu-satunya sumber kebenaran, dan
   * `tests/unit/badges.test.ts` menjaga setiap lencana rahasia punya teks ini
   * serta tidak pernah dikirim ke siswa.
   */
  requirement?: string;
}

/**
 * Bentuk lencana yang **boleh** menyeberang ke komponen klien.
 *
 * Tidak ada `unlockCondition` di sini, dan itu bukan kerapian: sebuah fungsi
 * tidak bisa diserialkan melewati batas server/klien, dan versi lama
 * mengekspor seluruh katalog (termasuk 8 kondisi rahasia) ke bundel browser.
 * Artinya siapa pun bisa membaca `unlockCondition.toString()` dari bundel dan
 * mengetahui syarat lencana yang seharusnya dirahasiakan. Sekarang kondisinya
 * tidak pernah meninggalkan server.
 */
export interface BadgeDisplay {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  howToUnlock: string;
  hidden: boolean;
  /** Sudah terbuka untuk pemilik profil ini. Diputuskan server. */
  unlocked: boolean;
  /** `true` bila judul/ikon/syarat aslinya sudah diganti dengan versi misteri. */
  redacted: boolean;
  /**
   * Syarat yang bisa dibaca manusia. Hanya diisi untuk moderator
   * (`toBadgeDisplays({ includeRequirement: true })`), karena panel moderator
   * menampilkan syarat lencana rahasia secara terbuka. Siswa tidak pernah
   * menerima field ini — bukan string kosong, melainkan tidak ada.
   */
  requirement?: string;
}

/** Enam angka lencana spesialis, dihitung SQL oleh `getSpecialtyStats`. */
export interface SpecialtyStats {
  hardQuizzes: number;
  approvedMods: number;
  diverseSubjects: number;
  quizTotal: number;
  approvedQuestions: number;
  totalDownloads: number;
}
