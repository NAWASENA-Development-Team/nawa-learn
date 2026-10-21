// src/i18n/messages.ts
// ─── Katalog string antarmuka ─────────────────────────────────────────────────
//
// Satu-satunya tempat string UI yang dilihat pengguna boleh hidup. Komponen
// memanggilnya lewat `t("nav.modules")` dari `src/i18n/t.ts`; key-nya adalah
// path bertitik yang menelusuri objek ini, jadi kesalahan ketik di key gagal
// saat kompilasi, bukan saat rendering.
//
// Ini adalah **locale tunggal** (`id`) — seluruh pengguna aplikasi ini adalah
// siswa SMAN 2 Jonggol. Lapisan ini bukan spekulasi akan datangnya bahasa
// Inggris; nilainya sekarang adalah bahwa string tidak lagi tersebar di 47
// berkas, dan satu ejaan ("Masuk" vs "Masuk / Daftar" vs "Login") punya satu
// tempat. M5 mencatat i18n sebagai butir yang belum dikerjakan; M15c memulainya
// dengan kerangka plus tiga permukaan (Navbar, sign-in, sign-up). Kunci
// disiplinnya, sesuai pelajaran M5 (tabel bookmarks yang dihapus karena tidak
// ada pembacanya): **setiap key di sini harus dipakai** — `tests/unit/i18n.test.ts`
// memutus tes jika ada key yatim.
//
// Migrasi **bertahap dan tersisa**: ~872 string di 47 berkas, baru ~60 yang
// pindah. Daftar berkas yang tersisa ada di `docs/AUDIT-AND-ROADMAP.md` (M15c).
// Setengah katalog yang tidak terpakai adalah dua sumber kebenaran; setengah
// JSX yang masih literal adalah utang yang terlihat, bukan yang terlupakan.
export const messages = {
  nav: {
    modules: "Modul",
    practice: "Latihan Soal",
    leaderboard: "Peringkat",
    submit: "Upload",
    profile: "Profil Saya",
    privacy: "Privasi",
    moderator: "Moderator",
    active: "Aktif",
    signIn: "Masuk / Daftar",
    openMenu: "Buka menu",
    closeMenu: "Tutup menu",
    toLight: "Ganti ke mode terang",
    toDark: "Ganti ke mode gelap",
  },
  auth: {
    signIn: {
      metaTitle: "Masuk | NAWA-LEARN SMAN 2 Jonggol",
      metaDescription:
        "Masuk ke akun NAWA-LEARN SMAN 2 Jonggol untuk melanjutkan belajar, mengunggah modul, dan mengerjakan soal latihan.",
      mobileHeading: "Siap belajar jadi lebih seru?",
      mobileSubheading: "Platform belajar kolaboratif OSIS NAWASENA SMAN 2 Jonggol.",
      desktopHeading: "Siap buat belajar jadi lebih terarah?",
      desktopSubheading:
        "Platform belajar kolaboratif yang dirancang oleh OSIS NAWASENA khusus untuk seluruh siswa dan guru SMAN 2 Jonggol.",
      featureFree: "Modul gratis",
      featureBank: "Bank soal CBT",
      featureBoard: "Leaderboard",
      perkModules: "Akses ratusan modul terverifikasi gratis",
      perkBank: "Asah kemampuanmu lewat ribuan bank soal CBT",
      perkPoints: "Kumpulkan Poin XP & rebut takhta leaderboard!",
      managedBy: "Dikelola oleh OSIS NAWASENA SMAN 2 Jonggol · Divisi ICT",
      badgeRank: "Peringkat #1",
      badgeBank: "Latih Soal CBT",
      badgeModules: "240+ Modul Belajar",
    },
    signUp: {
      metaTitle: "Daftar Akun | NAWA-LEARN SMAN 2 Jonggol",
      metaDescription:
        "Buat akun NAWA-LEARN gratis dan akses ratusan modul, bank soal, serta raih peringkat pertama di SMAN 2 Jonggol.",
      mobileHeading: "Bergabung & jadi lebih hebat!",
      mobileSubheading:
        "Buat akun barumu dan mulai perjalanan belajar yang terarah bersama SMAN 2 Jonggol.",
      desktopHeading: "Bergabung & Jadi Lebih Hebat",
      desktopSubheading:
        "Buat akun belajarmu sekarang dan mulai perjalanan prestasi yang penuh kolaborasi bersama siswa dan guru SMAN 2 Jonggol.",
      featureFree: "Modul gratis",
      featureBank: "Bank soal CBT",
      featureBoard: "Leaderboard",
      perkModules: "Akses ratusan modul terverifikasi gratis",
      perkBank: "Asah kemampuanmu lewat ribuan bank soal CBT",
      perkPoints: "Kumpulkan Poin XP & rebut takhta leaderboard!",
      managedBy: "Dikelola oleh OSIS NAWASENA SMAN 2 Jonggol · Divisi ICT",
      badgeRank: "Peringkat #1",
      badgeBank: "Latih Soal CBT",
      badgeModules: "240+ Modul Belajar",
      // Paragraf persetujuan UU PDP dipecah menjadi lima key, bukan satu dengan
      // placeholder: tautan "Kebijakan Privasi" dan "Ketentuan Layanan" harus
      // jadi elemen <Link> yang bisa diklik (UU PDP — hak subjek data harus
      // bisa dijangkau), dan interpolasi string tidak bisa menghasilkan elemen
      // React tanpa dangerouslySetInnerHTML.
      consentIntro: "Setelah akun dibuat, kamu akan diminta menyetujui",
      consentPrivacy: "Kebijakan Privasi",
      consentAnd: "dan",
      consentTerms: "Ketentuan Layanan",
      consentOutro:
        "kami sebelum bisa memakai fitur-fiturnya. Bacalah dulu — keduanya ditulis dengan bahasa sehari-hari, bukan pasal berbelit.",
    },
  },
} as const;

export type Messages = typeof messages;
