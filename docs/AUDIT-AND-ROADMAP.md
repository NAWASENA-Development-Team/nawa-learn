# NAWA-LEARN — Audit Teknis & Roadmap Menuju SaaS Premium

> Tanggal audit: 2026-10-15
> Commit: `0d88b45` — feat: enhance moderator and user role checks in submission routes
> Stack: Next.js 16.4.2 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind 4 · Clerk 7 · Drizzle 0.45 + Neon HTTP · Zod 4 · Vercel Blob · Upstash Redis
> Catatan: audit awal bersifat statis (`node_modules` belum ter-install saat itu). Pada 2026-10-16 dependensi sudah terpasang, `.env.local` tersedia, sehingga `tsc --noEmit`, `eslint`, `npm test`, dan **`next build`** semuanya sudah bisa dijalankan; M9 juga diverifikasi di **`next start` sungguhan** (CSP, CSRF, dan redirect auth benar-benar aktif).

---

## 0. Ringkasan Eksekutif

Nawa Learn punya **UI yang jauh lebih matang dari fondasinya**. Tampilan, gamifikasi, avatar, badge, dan sertifikat sudah terasa seperti produk jadi. Tapi di lapisan yang menentukan apakah sebuah platform boleh disebut "SaaS premium" — **otorisasi, integritas data, privasi, observability, dan QA** — kodebase ini masih tahap prototipe.

Kesimpulan singkat dalam satu kalimat:

> **Ini bukan aplikasi yang kurang fitur. Ini aplikasi yang fiturnya belum dilindungi.**

### Scorecard

| Dimensi | Skor | Catatan |
|---|---|---|
| UI / UX visual | 7.5 / 10 | Konsisten, animatif, responsif. Tapi ada mojibake & aksesibilitas minim. |
| Arsitektur | 4 / 10 | Duplikasi folder API, middleware ganda, logika bisnis di komponen klien 1500+ baris. |
| Keamanan (authz) | 9 / 10 | RBAC terpusat + deny-by-default, 8 endpoint review dijaga, matriks 401/403 teruji, rate limiting per user+IP di 12 route (`RATE_LIMITS`) dengan 429 + `Retry-After`, CSP ketat berbasis nonce + `frame-ancestors 'none'` + HSTS/`nosniff`/`Permissions-Policy`, penjaga CSRF di depan setiap mutasi, unggahan lewat storage dengan validasi magic-byte. **Catatan penting:** sebelum M9, `proxy.ts` ada di root sehingga Next tidak pernah memuatnya — deny-by-default yang diklaim M2 baru benar-benar aktif setelah file dipindah ke `src/proxy.ts` dan diverifikasi di server produksi. Skor 9 adalah kondisi **setelah** perbaikan itu **dan** setelah H13 (ketiga route yang dulu hanya mengandalkan proxy kini punya penjaga di handler). Kurang: bot protection sign-up (toggle dashboard Clerk), dan beberapa route masih `auth()` mentah alih-alih `requireUser()` (M14). |
| Integritas data | 9 / 10 | Poin & skor dinilai server, idempotensi ditegakkan constraint DB, kunci jawaban **kuis maupun ujian buatan siswa** tidak lagi bocor (H13 menutup jalur `customExams` dengan memindahkan penilaiannya ke `POST /api/exams/submit`), index + CHECK + partial-unique ditambahkan, `updatedAt` dijaga trigger. Kurang: soft delete (belum ada fitur hapus) & rollback teruji. |
| Database & migrasi | 8 / 10 | Migrasi berversi, CI menolak drift skema, `db:push` dihapus, seed berpengaman, adopsi database lama terbukti nol kehilangan data. Kurang: rollback/down-migration belum diuji. |
| Privasi & kepatuhan | 8 / 10 | M11 menutup yang paling mendasar: consent eksplisit ber-versi yang ditegakkan gerbang layout, `/privacy` (11 bagian) + `/terms` (9 bagian) publik, ekspor data (JSON/CSV) dan hapus-akun (anonimisasi) yang bisa dilakukan siswa sendiri, kebijakan retensi yang **dieksekusi** job terjadwal (`RETENTION_POLICY` = satu sumber kebenaran untuk halaman dan job), dan prosedur insiden 72 jam dengan peran + templat catatan. M12 menutup sisanya yang bisa ditutup di kode: `user.deleted` di webhook memakai jalur anonimisasi yang **sama** dengan hapus mandiri, `audit_log` mencatat setiap approve/reject/role-change/anonymise dengan snapshot skalar saja, dan minimisasi data ditegakkan tripwire statis (nol `db.select()` tanpa daftar kolom; `email` hanya di webhook). Kurang (sengaja): enkripsi kolom tingkat aplikasi dan `beforeSend` Sentry — keduanya non-goal bertulis alasan. |
| Observability | 5 / 10 | Logger terstruktur (redaksi PII teruji) + `requestId` + `/api/health` publik, seluruh route API sudah memakainya. Kurang: error tracking (Sentry), dashboard, dan log komponen klien. |
| Testing & CI | 9 / 10 | 524 test di 40 file, coverage **79,01%** baris (branch 85,96%, fungsi 96,56%) pada cakupan `src/lib/**` + `src/app/api/**` — unit + integrasi PGlite + migrasi + logger/health + rate limiting & alarm + CSP/CSRF + penilaian ujian sisi server + hak subjek data (lib **dan** route) + penjaga lokasi file konvensi, CI workflow, `next build` terverifikasi, dan sejak M12 sebuah **tripwire statis** yang menjaga permukaan PII di kode sumber (bukan di keluaran). Kurang: E2E, dan **5 route masih 0%** (`exams/create`, `modules/submit`, `questions/submit`, `profile/report`, `profile/status`). |
| Rahasia & supply chain | 9 / 10 | `.env.example` menutup seluruh 10 variabel yang dibaca kode dan dijaga tripwire; `gitleaks` di pre-commit (tanpa dependensi baru) dan di CI — dipasang sendiri dengan sha256 terverifikasi terhadap `checksums.txt` rilis, bukan lewat `gitleaks-action` yang menuntut lisensi untuk repo milik organisasi — dengan `fetch-depth: 0` dan allowlist satu entri tanpa pengecualian path; Dependabot untuk npm **dan** github-actions; gerbang `npm audit` dengan disiplin allowlist-ber-kedaluwarsa. Pohon dependensi produksi kini **0 critical / 0 high / 0 moderate** (2 low, keduanya `katex` bersarang di `react-katex`), dan daftar allowlist gerbang **kosong** — gerbang itu sendiri yang memaksa kedua entri M10 dihapus setelah `npm audit fix` non-force terbukti menyelesaikannya. Job CI `verify` kini **hermetik** — ia tidak membaca satu pun `secrets.*` — dan membuktikan proxy hidup lewat dua sinyal independen (baris `ƒ Proxy (Middleware)` **dan** smoke runtime 401 + CSP bernonce). **Tetapi kedua gerbang itu baru benar-benar dieksekusi setelah perbaikan di akhir M10: CI belum pernah hijau dari M5 sampai M10**, selalu mati di langkah `Build` karena `secrets.DATABASE_URL` tidak pernah dikonfigurasi (C8). Kurang: branch protection `main` dan secret scanning/push protection GitHub — keduanya pengaturan repo, bukan kode, dan belum dilakukan (C7 adalah akibatnya). Pohon **dev** sengaja di luar cakupan gerbang (`--omit=dev`) dan tetap membawa 2 CRITICAL (`vitest`/`tinypool`) + 5 HIGH (rantai `eslint-config-next`→`braces`); Dependabot menghitung pohon penuh, jadi alert publik repo ini tidak akan nol selama itu berdiri — perbaikannya lompatan mayor `vitest` 3→5, dicatat sebagai utang M14. |
| Dokumentasi | 5 / 10 | README rapi; `AGENTS.md` sempat drift dari kode (lokasi `proxy.ts`, klaim `x-request-id` yang tidak pernah benar) dan sebagian sudah dikoreksi di M9 — tetapi penyelarasan menyeluruh baru dijadwalkan di M17. |

**Estimasi jarak ke "premium":** 3 fase kerja, ~16 milestone. Fase 0 (M1–M3) bersifat darurat dan **harus selesai sebelum platform dipakai lebih luas lagi**, karena saat ini satu akun siswa terautentikasi bisa mengangkat dirinya ke puncak leaderboard dan menyetujui kontennya sendiri.

> **Status per 2026-10-16:** Fase 0 **selesai** — M1 (`52bba95`), M2 (`1f5a6c7`), H12 (`836107f`), M3 (`dcb9b84`), M4 (`7c5ee5f`), M5 (`eafd76b`), M6 (`9543af0`), M7 (`8d03153`), M8 (`54c8e49`), M9 (`c656380`), H13 (`35ff160`, irisan M14), migrasi SDK storage (`ba0bad4`), M10 (`d426ba2`). **M6 (observability) sebagian selesai**: logger terstruktur dengan redaksi PII teruji + `/api/health`, dipakai seluruh route API. **M7 (rate limiting & anti-abuse) sebagian selesai**: 10 endpoint dibatasi per user + per IP dengan 429, plus alarm lonjakan poin; bot protection sign-up tinggal toggle dashboard Clerk. **M8 (validasi & penanganan unggahan) selesai**: setiap route POST punya schema Zod, base64 tidak lagi masuk DB (unggahan ke Vercel Blob + validasi magic-byte), dan `remotePatterns` dipersempit. **M9 (header keamanan, CSRF, sesi) selesai**: CSP ketat berbasis nonce dengan `'strict-dynamic'` + `frame-ancestors 'none'`, HSTS/`nosniff`/`Permissions-Policy`/COOP, penjaga CSRF di depan setiap mutasi (403 sebelum auth), dan penampung laporan pelanggaran CSP. **M9 juga menutup C6 yang ternyata belum benar-benar tertutup:** `proxy.ts` berada di root sedangkan aplikasi ada di `src/app`, sehingga Next **tidak pernah memuatnya** — gate autentikasi deny-by-default, penjaga CSRF, dan CSP sama-sama kode mati sejak M1. File kini di `src/proxy.ts` dan dibuktikan hidup di server produksi sungguhan (`next build` memunculkan baris `ƒ Proxy (Middleware)`; POST lintas situs dijawab 403; CSP + `Reporting-Endpoints` ada di respons `/`). **H13 selesai**: penilaian ujian buatan siswa pindah ke server (`POST /api/exams/submit`), `api/exams/list` berhenti mengirim kunci jawaban dan kini dijaga + dibatasi, dan `api/modules/count` + `api/modules/download` mendapat penjaga sesi eksplisit — tidak ada lagi route yang hanya mengandalkan proxy. Otorisasi approval, kebocoran kunci jawaban (kuis **dan** ujian siswa), integritas poin/ranking, workflow skema, penyalahgunaan endpoint, jalur unggahan, dan header keamanan sudah ditutup. Sisa jujur: rate limiting **efektif penuh hanya dengan Upstash** (env), unggahan ke Blob **belum diverifikasi live** (token sudah ada di `.env.local`, verifikasi manual belum dijalankan), error tracking (Sentry) butuh DSN, E2E, rollback migration, dan M10 ke atas. **M10 (rahasia & supply chain) selesai — dan menemukan C7:** `next@16.2.6` ternyata membawa **17 advisory, 3 di antaranya CRITICAL** — termasuk RCE tanpa autentikasi di Image Optimization API, yang benar-benar terekspos lewat `next/image` — dan tidak ada apa pun di repo ini yang bisa memberi tahu, karena `npm audit` baru pertama kali dijalankan di M10. `next` naik ke **16.4.2** (audit turun dari 11 vuln/1 kritis → 7 vuln/0 kritis, `next` hilang sepenuhnya), lalu `npm audit fix` non-force menghabiskan tiga HIGH yang tersisa sehingga pohon produksi berakhir di **0 critical / 0 high / 0 moderate** dengan daftar pengecualian gerbang **kosong** (gerbang itu sendiri yang memaksa kedua entri awalnya dihapus), `.env.example` menutup seluruh 10 variabel yang dibaca kode, `gitleaks` berjalan di pre-commit **dan** CI (dipasang sendiri dengan checksum terverifikasi, karena `gitleaks-action` menuntut `GITLEAKS_LICENSE` untuk repo milik organisasi dan akan gagal di run pertama), Dependabot memantau npm **dan** github-actions, dan CI kini membuktikan proxy benar-benar terdaftar lewat dua sinyal independen (baris `Proxy (Middleware)` **dan** smoke runtime 401 + CSP bernonce) — meskipun, seperti dicatat C8, kedua gerbang itu **baru benar-benar berjalan setelah perbaikan di akhir M10**: job CI dari M5 sampai M10 selalu mati di langkah `Build` karena `secrets.DATABASE_URL` tidak pernah dikonfigurasi, sehingga job `verify` sekarang **hermetik** dan tidak membaca satu pun secret repo. Sisa jujur: branch protection `main` serta secret scanning/push protection GitHub adalah pengaturan repo, bukan kode — keduanya dicatat sebagai utang terbuka di §8.

### Yang sudah bagus (jangan dirusak)

- Skema Drizzle bersih, bertipe, dan mudah dibaca (`src/db/schema.ts`).
- Sebagian besar route sudah pakai Clerk `auth()` + validasi Zod.
- Komentar jujur soal keterbatasan driver (`neon-http` tidak mendukung transaksi) — ini bagus.
- Pemisahan `levelUtils.ts` (pure, client-safe) dari `levelRewards.ts` (server) adalah keputusan desain yang benar.
- `photoUrl` sudah disembunyikan di profil publik (`isOwnProfile`), dan `email` juga. Kesadaran privasi dasar sudah ada.
- Webhook Clerk sudah memverifikasi signature Svix dengan benar.

---

## 1. Temuan Kritis (P0) — Perbaiki Sebelum Apa Pun

### C1. Otorisasi hilang total di jalur approval (`modules/approve`, `questions/approve`, `questions/reject`, `questions/daily-create`) — ✅ SELESAI di M2

**Lokasi:** `src/app/api/modules/approve/route.ts:26-31`, `src/app/api/questions/approve/route.ts:30-34`, `src/app/api/questions/reject/route.ts:20-24`, `src/app/api/questions/daily-create/route.ts:17-22`

Keempat route ini hanya memeriksa **apakah user login**, bukan apakah user adalah moderator. Bahkan ada komentar yang mengakui hal ini secara terbuka:

```ts
// modules/approve/route.ts:26-27
// 1. Get the current user's DB ID (needed for reviewerId)
// Access is controlled by the password gate in the moderator frontend
```

Password gate di frontend **bukan kontrol akses**. Dampak yang bisa dieksploitasi langsung oleh siswa mana pun dengan DevTools:

1. `POST /api/modules/approve` dengan `submitterId` miliknya sendiri → **+50 poin per panggilan**, tanpa batas. Loop 200x = 10.000 poin.
2. `POST /api/questions/daily-create` → menyuntik soal ke kategori "Kuis Harian" yang langsung `status: "approved"` dan tanpa review.
3. `POST /api/questions/approve` → soal akan disetujui, `role` submitter otomatis naik dari `student` → `contributor`.
4. Poin bisa dikirim ke **akun siswa lain** (`submitterId` bebas) → modus sabotase/kolusi ranking.

**Perbaikan:** middleware otorisasi terpusat berbasis `users.role` di DB (bukan klien). `role ∈ {moderator, admin}` wajib untuk semua route review. Jangan pernah menerima `submitterId` dari body — ambil dari baris `submissions` di server.

---

### C2. Kunci jawaban bocor ke seluruh klien — ✅ SELESAI di M3

**Lokasi:** `src/app/api/questions/approved/route.ts:29`, `src/app/api/questions/pending/route.ts:17`, `src/app/(dashboard)/questions/practice/page.tsx:383,392,1372`

`/api/questions/approved` mengirim `answerKey` dan `explanation` untuk **seluruh bank soal** ke browser. Pemeriksaan jawaban dilakukan di klien:

```tsx
// practice/page.tsx:383
if (answers[q.id] === q.answerKey) correct++;
```

Artinya: (a) seluruh kunci jawaban bisa di-scrape satu request, (b) siswa bisa mengubah `answerKey` di memori untuk mendapat skor 100, (c) "anti-cheat" `isOwnQuestion` hanya menyembunyikan soal milik sendiri di UI — tidak menghalangi apa pun di API.

`/api/questions/pending` malah **tidak terautentikasi sama sekali** (tidak ada `auth()`), sehingga soal yang belum disetujui beserta kunci jawaban, nama, dan ID submitter terbuka untuk publik.

**Perbaikan:** pindahkan penilaian sepenuhnya ke server. Endpoint publik hanya mengembalikan `id, questionText, options`. Buat `POST /api/quiz/submit` yang menilai di server lalu mengembalikan hasil + penjelasan. Untuk kuis berbatas waktu, simpan session soal di server.

---

### C3. Integritas poin & ranking bisa dimanipulasi dari klien — ✅ SELESAI di M3

**Lokasi:** `src/app/api/quiz/complete/route.ts:11-31`, `src/app/api/quiz/daily-claim/route.ts:7`, `src/lib/levelRewards.ts:18`

- `quiz/complete` menentukan reward dari `difficulty` dan `score` yang **dikirim klien**. `difficulty: "sangat sulit"` = 100 poin tanpa menjawab apa pun.
- `quizId` juga dari klien dan dipakai sebagai kunci idempotensi (`quiz_completed_${quizId}`). Kirim `quizId` acak → reward bisa diklaim berulang tanpa batas.
- `daily-claim` memberikan +25 poin tanpa verifikasi bahwa user benar-benar mengerjakan kuis. Bisa diklaim tiap hari otomatis, dan itu otomatis menaikkan `role` ke `contributor`.
- `checkAndGrantLevelRewards` (`levelRewards.ts:18`) memberi **role moderator permanen di level 100**. Kombinasi dengan bug di atas = eskalasi privilese gratis lewat grinding.

**Perbaikan:** poin hanya boleh dihitung dari data yang dimiliki server (jawaban tersimpan). Semua reward harus idempoten dengan kunci unik di DB (`UNIQUE (user_id, action, ref_id)`), bukan hasil query-lalu-insert.

---

### C4. Endpoint debug & seed terbuka di produksi — ✅ SELESAI di M1

**Lokasi:** `src/app/api/debug/auth/route.ts`, `src/app/api/debug/db/route.ts`, `src/app/api/debug/submit/route.ts`, `src/app/api/seed/route.ts`

- `GET /api/seed` — **tanpa autentikasi**, menulis user dummy + 3 modul ke database produksi pada setiap pemanggilan. Siapa pun yang tahu URL bisa mengotori data.
- `GET /api/debug/db` — **tanpa autentikasi**, membocorkan jumlah user, `id`, `name`, `email` (3 sampel), dan status konfigurasi `DATABASE_URL`.
- `POST /api/debug/submit` — melewati aturan peran (tidak ada cek `role === "student"` seperti di endpoint submit sebenarnya) dan mengembalikan log internal detail ke klien.
- `ERROR_TROUBLESHOOTING.md` mendokumentasikan endpoint ini sebagai fitur, sehingga kecil kemungkinan dihapus tanpa disadari.

**Perbaikan:** hapus semuanya dari repo. Debugging pakai observability (M6), bukan endpoint publik. Untuk data contoh lokal, pakai `src/db/seed.ts` (butuh `ALLOW_SEED=1`, dan idempoten) — bukan endpoint HTTP.

---

### C5. Password moderator tertanam di bundle klien — ✅ SELESAI di M2

**Lokasi:** `src/app/(dashboard)/moderator/page.tsx:52`

```ts
const MODERATOR_PASSWORD = "nawa2026"; // Change this to your desired password
```

Karena ini komponen `"use client"`, string tersebut **dikirim apa adanya ke setiap browser**. Password efektifnya publik. Ditambah lagi, `AGENTS.md` menyebut password-nya `nawa2024` — dokumentasi sudah drift dari kode.

Setelah lolos, "autentikasi" hanya disimpan di `sessionStorage` sebagai `"true"` — bisa di-set manual dari console.

**Perbaikan:** hapus seluruh gate password. Gunakan Clerk role/organization, atau `users.role` di DB, dan validasi ulang di setiap API call.

---

### C6. Middleware proteksi route tidak berfungsi — ✅ SELESAI di M2, tapi **regresi senyap** baru ketahuan dan ditutup di M9

**Lokasi:** `proxy.ts:5-10` dan `src/middleware.ts:5-10` (dua file identik)

```ts
const isProtectedRoute = createRouteMatcher([
  '/(dashboard)(.*)',   // ← route group bukan bagian dari URL
  '/submit(.*)',
  '/api/modules(.*)',
  '/api/questions(.*)'
]);
```

`(dashboard)` adalah **route group** — tidak pernah muncul di URL. Halaman sebenarnya berada di `/modules`, `/leaderboard`, `/profile`, `/moderator`, `/questions/practice`. Pola ini hanya cocok dengan path literal `/dashboard...`, sehingga:

- Halaman dashboard **tidak terlindungi** oleh middleware (bergantung pada `auth()` di dalam server component, yang sebagian memang tidak memanggilnya — mis. `modules/page.tsx`).
- Route API lain (`/api/moderator`, `/api/profile`, `/api/exams`, `/api/quiz`, `/api/submissions`, `/api/debug`, `/api/seed`) **tidak masuk daftar protected** meskipun middleware dijalankan untuknya. Semuanya bergantung pada `auth()` masing-masing — dan beberapa lupa.

Selain itu ada **dua file middleware** (`/proxy.ts` dan `/src/middleware.ts`) dengan isi identik. Di Next.js 16 `middleware.ts` digantikan `proxy.ts`; menyimpan keduanya menimbulkan ambiguitas mana yang aktif dan berisiko middleware dijalankan dobel.

**Perbaikan M2 (tidak lengkap):** satu file saja, daftar route diperbaiki, dan *deny-by-default* diterapkan: semua route API dilindungi kecuali `PUBLIC_ROUTES`. Tapi file yang dipertahankan **salah tempat** — lihat regresi di bawah.

**Regresi senyap: file-nya tidak pernah dimuat.** M2 menghapus `src/middleware.ts` dan menyisakan **`proxy.ts` di root**. Itu keliru. Aplikasi ini memakai `src/app` (sejak commit awal), dan Next.js hanya mencari `proxy.ts`/`middleware.ts` di **root proyek atau di dalam `src/`**, sejajar dengan `app`. Karena `src/` ada, Next mencari `src/proxy.ts` — dan root `proxy.ts` **tidak pernah dimuat sama sekali**.

Akibatnya, dari M1 sampai M9 seluruh isi `proxy.ts` **mati**: tidak ada deny-by-default, tidak ada `auth.protect()` untuk halaman, dan tidak ada 401 JSON untuk API. Setiap route sepenuhnya bergantung pada pemeriksaan `auth()` di dalam handler-nya sendiri — tepat kondisi yang C6 keluhkan di awal, dan alasan mengapa utang `auth()` mentah yang tercatat di M9 jauh lebih berbahaya daripada yang terlihat.

Kenapa luput selama delapan milestone? Karena **tidak ada satu pun test atau langkah build yang gagal**: unit test memanggil handler route secara langsung (melewati proxy), dan `next build` selesai tanpa error. Satu-satunya jejak yang bisa dilihat adalah baris `ƒ Proxy (Middleware)` pada keluaran build — dan baris itu memang **tidak ada** sebelum perbaikan, tapi tidak ada yang mencarinya.

Penting untuk tidak salah menyimpulkan: **`middleware-manifest.json` bukan petunjuk yang sah di sini.** Pada build Next 16 + Turbopack, kedua manifest (`server/middleware-manifest.json` dan `server/middleware/middleware-manifest.json`) tetap berisi `"middleware": {}` **baik sebelum maupun sesudah perbaikan** — jadi mengosongnya file itu tidak membuktikan apa pun. Yang benar-benar membedakan keadaan rusak dari keadaan sehat hanya dua hal: (a) keluaran `next build` memuat baris `ƒ Proxy (Middleware)`, dan (b) perilaku runtime — CSP muncul di respons, dan POST lintas situs dijawab 403.

**Ini bukan artefak lokal.** Vercel menjalankan `next build` yang sama, jadi situs yang ter-deploy pun tidak pernah punya middleware sejak M1. Konsekuensi nyata di produksi: `/modules`, `/leaderboard`, `/profile/[id]`, `/submit`, `/questions/*`, dan `/moderator` **bisa diakses tanpa sesi**, dan setiap route API hanya bergantung pada pemeriksaan `auth()` di handler-nya masing-masing. Setiap asumsi yang dibangun di atas "endpoint ini ada di belakang proxy" perlu diperiksa ulang; utang `auth()` mentah di M14 jadi jauh lebih mendesak daripada yang terlihat saat dicatat.

**Perbaikan M9 (terverifikasi di server produksi sungguhan):** file dipindah ke `src/proxy.ts` (import disesuaikan ke `./lib/...`), lalu dibuktikan pada `next start` sungguhan: `next build` kini memunculkan baris `ƒ Proxy (Middleware)` (sebelumnya tidak ada), `GET /` membawa CSP berbasis nonce + `Reporting-Endpoints`, seluruh 21 tag `<script>` SSR membawa nonce, `x-nonce` mengalir ke layout, halaman terproteksi menjawab **307 → sign-in**, API anonim menjawab **401 JSON**, dan POST lintas situs ke `/api/csp-report` dijawab **403** (sebelumnya 204 karena guard-nya tidak pernah jalan).

**Pelajaran (masuk `AGENTS.md`):** lokasi file konvensi Next tidak boleh ditebak. Proyek ini adalah proyek `src/`, jadi setiap file konvensi (`proxy.ts`, `instrumentation.ts`, dst.) harus berada di dalam `src/`, sejajar dengan `app/`.

---

### C7. `next@16.2.6` tertinggal 17 advisory, **3 di antaranya kritis** — ✅ SELESAI di M10

**Temuan baru 2026-10-16, di luar rencana M10.** Saat menyiapkan pemindaian supply chain, `npm audit` dijalankan untuk pertama kalinya sejak proyek dimulai — dan hasilnya bukan soal dependensi kecil.

`next@16.2.6` (versi yang dipakai sejak awal) rentan terhadap **17 advisory**, termasuk tiga **CRITICAL**:

| GHSA | Judul | Dampak di proyek ini |
|---|---|---|
| `GHSA-p293-qw3h-jr36` | Unauthenticated RCE di server yang di-host di **Windows** | Tidak berlaku untuk produksi Vercel (Linux), tapi berlaku untuk **mesin developer Windows** ini bila `next start` dijalankan dan port-nya terjangkau. |
| `GHSA-2xp9-vwfh-vxw4` | Unauthenticated RCE di **Image Optimization API** (jalur AVIF) | **Berlaku.** `next/image` memang dipakai (`ProfileClient.tsx`, `LeaderboardClient.tsx`), dan `/api/_next/image` adalah endpoint publik. |
| `GHSA-vcvr-r3jv-pc5j` | RCE di `next/og` `ImageResponse` | Tidak berlaku langsung — tidak ada pemakaian `next/og`/`ImageResponse` di repo ini. |

Di antara yang HIGH: `GHSA-cjq9-62q9-8jv4` (SSRF di Image Optimization), `GHSA-p9j2-gv94-2wf4` (SSRF di `rewrites` lewat hostname tujuan yang dikendalikan penyerang), `GHSA-m99w-x7hq-7vfj` + `GHSA-89xv-2m56-2m9x` (DoS & SSRF di Server Actions), dan `GHSA-6gpp-xcg3-4w24` (**bypass middleware/proxy** di App Router + Turbopack dengan satu locale).

Yang membuat `GHSA-6gpp-xcg3-4w24` layak disebut khusus: ia menyerang **tepat lapisan yang baru saja diperbaiki di M9**. Dua hal membatasi dampaknya di sini — `next.config.ts` tidak punya blok `i18n` sama sekali (advisory mensyaratkan satu entri `config.i18n.locales`), dan `auth()` di dalam handler sudah menjadi pertahanan berlapis sejak H13. Tapi "kemungkinan tidak tereksploitasi" bukan "tidak tereksploitasi", dan rentang versinya tetap terdampak.

**Perbaikan:** `next` dan `eslint-config-next` naik `16.2.6` → **`16.4.2`** (`latest`), pin tetap **eksak** mengikuti konvensi repo. `npm audit --omit=dev` turun dari **11 (1 kritis / 6 tinggi)** menjadi **7 (0 kritis / 3 tinggi)**, dan `next` hilang sepenuhnya dari daftar. Tiga HIGH yang tersisa lalu ikut dibereskan di milestone yang sama: `npm audit fix` non-force menaikkan `source-map-js` 1.2.1 → 1.2.2 dan membiarkan `@clerk/shared` mengambang 4.12.0 → 4.40.0 (yang membawa `js-cookie` 3.0.5 → 3.0.8), sehingga pohon produksi berakhir di **0 critical / 0 high / 0 moderate** — sisa 2 low (`katex` bersarang di `react-katex`) — dan daftar pengecualian gerbang **kosong**.

Satu catatan agar angka di atas tidak salah dibaca: `npm audit` menghitung **paket**, bukan advisory. `next` muncul sebagai **satu** entri berkategori kritis — kategori itu adalah severity tertinggi di antara 17 advisory yang menempel padanya. Jadi "1 kritis" di laporan `npm audit` berarti "satu paket yang punya advisory kritis", bukan "satu kerentanan kritis". Ketika paket itu hilang, seluruh 17 advisory-nya ikut hilang.

**Akar masalahnya bukan versinya, tapi tidak adanya pemantauan.** Advisory-advisory ini sudah lama ada; yang tidak ada adalah apa pun yang memberi tahu. Itulah sebabnya M10 menambahkan `.github/dependabot.yml` **dan** gerbang `npm audit` di CI (`scripts/audit-gate.mjs`), bukan sekadar menaikkan versinya. Naik versi memperbaiki hari ini; gerbangnya mencegah pengulangan. Gerbang itu juga sudah membuktikan dirinya sendiri di milestone ini: ia yang memaksa kedua pengecualian awalnya dihapus, karena entri yang berhenti cocok dengan advisory apa pun akan menggagalkan build.

**Pelajaran:** sebuah proyek tanpa `npm audit` tidak "bersih" — ia hanya belum diperiksa. Skor dependensi sebelumnya tidak pernah diukur, jadi tidak ada satu pun sinyal yang berubah saat kerentanan kritis masuk ke `package-lock.json`.

---

### C8. CI belum pernah hijau sekali pun — dan penyebabnya rahasia yang tidak pernah ada — ✅ SELESAI di M10

**Temuan baru 2026-10-16, saat menutup M10.** Workflow `CI` sudah ada sejak M5 (H10). Setiap run-nya diperiksa lewat API publik GitHub — `52bba95` (M1), `eafd76b` (M5), `9b95d92`, `ceffc8a`, `1b45bbd`, plus ketujuh run PR Dependabot — dan **tidak satu pun hijau**. Hanya job `Secret scan (gitleaks)` yang lolos; job `Typecheck, lint, test, build` selalu gagal.

Kegagalannya selalu di langkah yang sama: **`Build`**, sekitar 14–16 detik setelah mulai. Kedua gerbang proxy (`Build registered the proxy`, `Proxy answers at runtime`) selalu **dilewati**. Artinya selama M5 sampai M10 dokumen ini mengklaim CI membuktikan proxy hidup, padahal klaim itu belum pernah sekali pun dieksekusi.

**Akar masalah.** `src/db/index.ts:6` memanggil `neon(process.env.DATABASE_URL!)` di scope modul, dan `neon()` **melempar** bila URL-nya tidak ada **atau tidak bisa di-*parse***. CI tidak punya `.env.local`, dan langkah `Build` membaca `secrets.DATABASE_URL` yang **belum pernah dikonfigurasi di repositori** — jadi `next build` mati saat `Collecting page data`:

```
Error: Failed to collect configuration for /api/exams/create
[cause]: No database connection string was provided to `neon()`
```

Direproduksi di mesin ini: build **tanpa** `.env.local` → exit 1 pada 241 s; build dengan `DATABASE_URL` dummy yang **valid secara sintaks** dan kunci Clerk **kosong** → **exit 0** pada 145 s, mencetak `Proxy (Middleware)`. Jadi build tidak butuh database nyata dan tidak butuh kunci Clerk nyata — hanya URL yang bisa di-*parse*.

**Perbaikan.** Job `verify` dibuat **hermetik**: tidak membaca satu pun `secrets.*`. Placeholder-nya eksplisit dan kecil — `DATABASE_URL: postgresql://ci:ci@localhost:5432/ci`, `CLERK_SECRET_KEY: sk_test_ci_placeholder`, dan publishable key yang **diturunkan** di dalam langkah itu sendiri:

```sh
export NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_$(printf '%s' 'example.clerk.accounts.dev$' | base64 -w0)"
```

Kunci publishable memang harus berbentuk `pk_test_<base64 dari domain *.clerk.accounts.dev>`, dan base64 dari domain semacam itu selalu berentropi tinggi — sehingga menuliskannya literal di repositori publik memicu rule `generic-api-key` milik gitleaks. Yang dipilih adalah **menurunkannya**, bukan menambahkan pengecualian allowlist: `.gitleaks.toml` memang hanya boleh memuat nilai yang benar-benar tak terhindarkan, dan `generic-api-key` justru rule yang menangkap rahasia tak dikenal. (`pk_` sendiri publik — ia ikut terkirim di bundle klien.)

Probe runtime **butuh** kunci yang bisa di-*parse*: dengan kunci Clerk kosong, `verify:proxy` menjawab `status: 500` tanpa CSP (exit 1); dengan placeholder di atas, `status: 401` + CSP bernonce (exit 0) — proxy menolaknya sebelum route, query, atau Clerk tersentuh.

**Bukti lokal (urutan CI yang sama, tanpa kredensial nyata):** `npm run build` exit 0 dalam 171 s dan mencetak `Proxy (Middleware)`; `node scripts/verify-proxy.mjs` exit 0 dengan `status: 401` + CSP bernonce.

**Pelajaran.** Ini C6 dalam bentuk lain: kontrol yang ada, terdokumentasi, dan **diklaim** berjalan — tapi tidak. Bedanya, C6 adalah file yang tidak dimuat; C8 adalah **gate yang tidak pernah dieksekusi karena langkah sebelumnya selalu gagal, dan tidak ada yang melihat**. Skor "Testing & CI" di dokumen ini diukur dari apa yang ada di dalam file workflow, bukan dari apa yang pernah benar-benar berjalan. Itulah kenapa branch protection (§8 baris 1) bukan formalitas: tanpa ia, CI yang merah selama lima milestone tidak pernah menghalangi apa pun. Dijaga oleh `tests/unit/ci-gates.test.ts`, yang kini menolak `secrets.` di dalam workflow.

---

## 2. Temuan Tinggi (P1)

### H1. `/api/profile/update` tanpa skema, tanpa batas, tanpa sanitasi — ✅ SELESAI di M8
**Lokasi:** `src/app/api/profile/update/route.ts:26-46`

Iterasi kunci yang "diizinkan", tapi nilai dilewatkan mentah. Tidak ada Zod. Akibatnya:
- `photoUrl` = data-URL base64 sebesar apa pun. Cek 2MB hanya ada di klien (`ProfileClient.tsx:215`) dan mudah dilewati → **bloat Postgres**, dan karena `photoUrl` juga dikirim ke halaman leaderboard, satu pengguna bisa membengkakkan payload 100 user sekaligus.
- `motto` melebihi `varchar(200)` → error 500, bukan 400 yang informatif.
- `avatarIndex` bisa negatif atau di luar `AVATAR_OPTIONS.length`.

**Status (M8):** route ditulis ulang dengan Zod `.strict()` + `.refine()` (body kosong ditolak), `avatarIndex` dibatasi `0..AVATAR_OPTIONS.length-1`, `bio` ≤ 500, `motto` ≤ 200, dan `photoUrl` **hanya boleh `null` atau URL di object storage sendiri** (`isOwnStorageUrl`) — jadi base64 tidak mungkin lagi masuk lewat jalur ini, dan leaderboard tidak bisa dijadikan host gambar pihak ketiga / tracking pixel. Route juga sekarang memakai `requireUser()`, yang sekaligus menghapus bug "200 tanpa efek" untuk user yang belum tersinkron (dulu hanya 500/200 palsu). Lihat M8 untuk detail dan test-nya.

### H2. `/api/moderator/hidden-badges` membocorkan data semua user tanpa autentikasi — ✅ SELESAI di M2
**Lokasi:** `src/app/api/moderator/hidden-badges/route.ts:8`

Tidak ada `auth()` sama sekali. Mengembalikan `id`, `name`, `points`, `createdAt`, dan jumlah kontribusi **seluruh siswa**, bisa dipanggil siapa pun. Ini PII yang tidak perlu dipublikasikan. Selain itu, evaluasi badge dilakukan di klien (`moderator/page.tsx:145`, `badges.ts` 973 baris) — logika seharusnya di server.

### H3. `/api/exams/create` bisa dipakai tanpa login
**Lokasi:** `src/app/api/exams/create/route.ts:32-41`

`clerkId` boleh `null`; `authorName` fallback ke `"Siswa SMAN 2"`. Siapa pun bisa membanjiri database dengan ujian custom berisi 50 soal JSON. Vektor spam/abuse + penyimpanan. Juga tidak ada moderasi konten buatan siswa.

### H4. `/api/modules/download` bisa dipakai tanpa login & tanpa validasi UUID — ✅ SELESAI di M2+M7+M8
**Lokasi:** `src/app/api/modules/download/route.ts:7-18`

Menambah counter untuk UUID apa pun, tanpa autentikasi, tanpa rate limit. Angka unduhan menentukan badge ("Hundred Downloads") dan omzet sinyal sosial → mudah dimanipulasi. UUID invalid → error 500 alih-alih 400.

**Status:** (a) M2 — `src/proxy.ts` menolak request tanpa sesi untuk seluruh route API di luar `PUBLIC_ROUTES`, jadi endpoint ini tidak lagi anonim (baru benar-benar berlaku sejak M9 — lihat C6); (b) M7 — dibatasi `modules/download` 60/menit per IP; (c) M8 — `moduleId` divalidasi `z.uuid()` sehingga id ngawur jadi **400**, bukan 500 dari cast Postgres. Sisa utang: counter tetap dapat dinaikkan oleh user yang login berulang kali; itu batas desain (counter unduhan memang publik bagi user), bukan bug.

### H5. Webhook Clerk tidak lengkap & tidak idempoten
**Lokasi:** `src/app/api/webhooks/clerk/route.ts:69-117`

- Tidak menangani `user.deleted` → data siswa yatim selamanya (pelanggaran retensi/privacy).
- `user.updated` menulis `email` tanpa menangani bentrok `UNIQUE` → 500 dan event hilang.
- Re-link berdasarkan email (`:76-86`) menautkan ulang akun ke `clerkId` baru; di migrasi dev→prod ini OK, tapi sebagai jalur produksi permanen ia membuka pintu pengambilalihan akun jika verifikasi email pernah dilonggarkan.
- Tidak ada idempotensi berbasis `svix-id` → Clerk mengirim ulang = efek ganda.

### H6. `next.config.ts` mengizinkan gambar dari host apa pun — ✅ SELESAI di M8
**Lokasi:** `next.config.ts:4-11`

```ts
images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] }
```
Next.js image optimizer akan mem-fetch URL apa pun yang diminta → **SSRF / open image proxy** atas nama domain Anda (biaya bandwidth + potensi probing jaringan internal). Ganti ke daftar hostname eksplisit (`drive.google.com`, `res.cloudinary.com`, dll.).

**Status (M8):** daftar liar itu diganti satu entri eksplisit, `*.public.blob.vercel-storage.com` — satu-satunya host gambar jarak jauh yang benar-benar dipakai (foto profil hasil unggahan). Karena `photoUrl` sekarang juga wajib menunjuk ke storage sendiri (H1), tidak ada lagi jalur yang bisa membuat optimizer mem-fetch host sembarangan. Diverifikasi ke produksi sebelum mempersempit: kolom `users.photo_url` berisi 0 URL jarak jauh (3 `NULL`, 3 `data:`), jadi tidak ada foto lama yang rusak.

### H7. Tidak ada rate limiting di mana pun — ✅ SELESAI di M7
Semua endpoint bisa dipanggil ribuan kali per detik: submit modul/soal, kirim laporan, klaim poin, increment download, dan login. Wajib ada pembatasan per IP + per user (Upstash Ratelimit / @vercel/firewall).

**Status:** 12 route dibatasi per user + per IP (`RATE_LIMITS` di `src/lib/rateLimit.ts`), dengan 429 + `Retry-After` — 8 di antaranya sejak M7, lalu `uploads/create` (M8), `csp/report` (M9), dan `exams/list` + `exams/submit` (H13/M14). **Catatan penting:** proteksi penuh hanya aktif bila `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` diset; tanpa itu limiter memakai store in-memory yang tidak efektif di serverless. Bot protection sign-up tetap toggle dashboard Clerk (lihat checklist M7).

### H8. Tidak ada security header — ✅ SELESAI di M9
Tidak ada CSP, HSTS, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, atau `Permissions-Policy`. Situs bisa di-iframe (clickjacking), dan tanpa CSP setiap celah XSS jadi jauh lebih berbahaya.

**Status (M9):** CSP ketat berbasis nonce (dengan `'strict-dynamic'`) sekarang dipasang per request di `src/proxy.ts`, plus `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, dan `report-uri`/`report-to` ke `/api/csp-report`. Header yang tidak bergantung request (HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, COOP) dikirim dari `next.config.ts`. Lihat M9 untuk detail, termasuk mengapa CSP memakai helper Clerk dan mengapa nonce membuat seluruh aplikasi dirender dinamis.

### H9. Skema database tanpa migration, langsung `push` ke produksi — ✅ SELESAI (M5: migrasi berversi + adopsi database asli terverifikasi)
**Lokasi dulu:** `package.json:10`, `drizzle.config.ts:10-11`

`"db:push": "drizzle-kit push"` dan folder `src/db/migrations` tidak pernah ada. Tidak ada riwayat perubahan, tidak ada rollback, tidak ada review perubahan skema. Untuk produk dengan data siswa ini tidak bisa diterima.

**Selesai:** `src/db/migrations/` di-commit dan database produksi sudah diadopsi ke sistem migrasi (baseline 0000 + `migrate` 0001) dengan **nol kehilangan data**. `db:push` dihapus dari `package.json`, CI menolak drift antara `schema.ts` dan migrasi, dan seed diberi pengaman. Sisa jujur: rollback/down-migration belum teruji (lihat M5).

### H10. Nol test, nol CI — ✅ SELESAI (M4: 108 test, CI workflow; M5: +9 test migrasi; M6: +18 test logger & health; M7: +21 test rate limiting & alarm; M8: +76 test validasi & unggahan; M9: +63 test CSP, CSRF, laporan pelanggaran & lokasi proxy; H13/M14: +33 test penilaian ujian sisi server & penjaga sesi; M8 susulan: +3 test setelah `storage.ts` pindah ke SDK resmi; M10: +50 test tripwire untuk template env, gerbang audit & gerbang CI, termasuk invarian "CI tidak menyentuh secret repo" dan "wrapper scanner tidak boleh diam-diam lulus di CI"; M11: +92 test consent gate, versi kebijakan, ekspor/hapus akun (lapisan lib **dan** HTTP), job retensi, migrasi `0002`, dua tripwire (timeout inline, frasa konfirmasi tunggal), dan satu assertion `CRON_SECRET` di template env; M12: +51 test jejak audit, penghapusan lewat webhook, idempotensi anonimisasi, migrasi `0003`, dan tripwire permukaan PII yang **langsung menemukan kebocoran nyata pada run pertamanya** → 524 test / 40 file)
Tidak ada `*.test.ts`, tidak ada `.github/workflows`. Tidak ada yang mencegah regresi seperti bug otorisasi di atas. `npm run lint` pun tidak pernah dijalankan otomatis.

### H11. Performa: N+1 query dan query tak terbatas
- `src/app/api/profile/status/route.ts:32-50` — loop `Promise.all` yang menjalankan satu query per submission (maks 100 query untuk satu request).
- `src/app/(dashboard)/leaderboard/page.tsx:30-40` — memuat **seluruh** modul, soal, dan pointsLog milik 100 user teratas, lalu difilter di JavaScript.
- `/api/questions/approved` mengembalikan seluruh bank soal tanpa paginasi.
- Semua halaman pakai `force-dynamic`, jadi tidak ada satu pun yang di-cache.
- `photoUrl` base64 ikut ke leaderboard → payload bisa puluhan MB.

### H12. Halaman `/submit` hilang, digantikan komponen yang meng-import dirinya sendiri — ✅ SELESAI (2026-10-16)
**Lokasi:** `src/components/submit/SubmitClient.tsx:1-86`, `src/components/layout/Navbar.tsx:112`

Ditemukan saat M2. Pada commit terakhir (`0d88b45`) file `src/app/(dashboard)/submit/page.tsx` **dihapus**, dan sebagai gantinya dibuat `src/components/submit/SubmitClient.tsx` yang isinya justru komponen *halaman* (`SubmitPage`) — lalu di baris 6 meng-import dirinya sendiri dan di baris 85 me-render `<SubmitClient />` (yaitu dirinya sendiri). Akibatnya:

- Navbar menautkan "Upload" ke `/submit`, padahal route itu **tidak ada** → 404 untuk semua pengguna.
- Alur unggah modul/soal (`/api/modules/submit`, `/api/questions/submit`) jadi tidak punya pintu masuk di UI.
- Jika file itu suatu saat dipasang sebagai page, ia akan **rekursi tak terbatas**.

**Perbaikan (SELESAI 2026-10-16):** arsitektur yang dimaksud commit `0d88b45` dipulihkan dengan benar:

- `src/components/submit/SubmitClient.tsx` kembali menjadi **form unggah (client)** — 1296 baris yang hilang dipulihkan utuh dari `0d88b45^`, kemudian dirapikan (nama komponen, komentar header, 6 temuan lint warisan diperbaiki).
- `src/app/(dashboard)/submit/page.tsx` kembali menjadi **halaman server** yang memverifikasi sesi + peran, menampilkan layar "Akses Terkunci" untuk siswa, dan me-render `<SubmitClient />`.
- Navbar "Upload" → `/submit` berfungsi lagi; tidak ada lagi self-import/rekursi.
- Catatan: `/api/modules/submit` dan `/api/questions/submit` **sudah** menolak siswa dengan 403, jadi gate di halaman murni UX (pesan ramah, bukan pengamanan).

### H13. `/api/exams/list` tanpa otorisasi apa pun, dan mengirim kunci jawaban — **SELESAI (2026-10-16)** (temuan baru 2026-10-16)
**Lokasi:** `src/app/api/exams/list/route.ts`

Handler ini **tidak punya satu pun pemeriksaan otorisasi** — tidak `requireUser()`, tidak `requireModerator()`, tidak `auth()`. Satu-satunya yang melindunginya adalah proxy deny-by-default. Karena proxy itu ternyata mati dari M1 sampai M9 (lihat C6), route ini **terbuka untuk siapa saja selama sembilan milestone**. M9 menutup lubang anonim itu, tapi handler-nya masih belum memeriksa apa pun sendiri.

Yang membuatnya lebih dari sekadar soal disiplin:

- **Kunci jawaban ikut terkirim.** Query-nya memilih `customExams.questions` **utuh** — seluruh payload soal, termasuk jawaban benar. C2 sudah menutup kebocoran kunci jawaban pada jalur kuis, tapi jalur `customExams` ini tidak pernah masuk cakupan perbaikan itu.
- **Tanpa batas.** Tidak ada `limit`/paginasi; seluruh riwayat ujian dikembalikan sekaligus (M13 sudah mencatat sisi performanya, bukan sisi otorisasinya).
- **Tanpa rate limit** — tidak terdaftar di `RATE_LIMITS`.
- `authorName` juga ikut, jadi ini menyentuh PII ringan.

**Kenapa dampaknya lebih rendah daripada C2:** M3 memutuskan ujian buatan siswa tidak menghasilkan poin, jadi insentif menyontek rendah. Tapi ini tetap membuka karya siswa lain ke semua siswa yang login. Konsumennya `src/app/(dashboard)/questions/practice/page.tsx`.

#### Perbaikan yang dikirim (M14, irisan H13)

Akar masalahnya bukan satu `if` yang lupa ditulis, melainkan **arsitektur penilaian**: kunci jawaban harus ada di browser karena browser yang menilai. Jadi perbaikannya dua lapis.

1. **Penilaian pindah ke server — `POST /api/exams/submit` (baru).** Meniru pola M3 untuk kuis: klien hanya mengirim `{ examId, answers }`, server memuat blob `custom_exams.questions`, menilai sendiri, lalu mengembalikan bentuk yang sama dengan `/api/quiz/submit` (`results: [{ questionId, correct, correctKey }]`). `correctCount` tidak pernah diterima dari klien — `examSubmitSchema` `.strict()` menolak body yang mencoba menyetel skornya sendiri. Ujian buatan siswa tetap **tidak memberi poin** (keputusan M3 dipertahankan): route ini tidak menulis `pointsLog`, tidak menyentuh `users.points`, dan selalu menjawab `rewardable: false, pointsAwarded: 0`.
2. **`GET /api/exams/list` berhenti mengirim kunci.** `requireUser()` di handler, `rateLimit("exams/list")`, dan `limit` (default 50, maks 100). Setiap soal dilewatkan `toPublicExamQuestions()` yang **membangun ulang** objeknya dari daftar field yang diizinkan, bukan menghapus satu field dari objek tersimpan — jadi tidak ada jalur spread yang bisa memunculkan kembali kunci. Redaksi terjadi di server, sebelum serialisasi.
3. **Tiga route proxy-only kini punya penjaga sendiri.** `api/modules/count` dan `api/modules/download` memakai `requireSession()` baru di `src/lib/authz.ts` — pemeriksaan sesi tanpa query DB, supaya alasan lama ("tidak sepadan satu query di jalur panas") tidak lagi menjadi alasan melewatkan penjaga. `api/exams/list` memakai `requireUser()`.

Kode: `src/lib/examScoring.ts` (modul murni tanpa DB/Next: redaksi + penilaian), `src/app/api/exams/submit/route.ts`, `src/app/api/exams/list/route.ts`, `src/lib/authz.ts`. Tes: `tests/unit/examScoring.test.ts` (13) + `tests/integration/exams.test.ts` (17), termasuk asersi bahwa string `answerKey` **tidak muncul sama sekali** di JSON respons dan bahwa `pointsLog` tetap kosong setelah skor sempurna.

Perbaikan sampingan: `explanation` kini ikut terkirim ke klien (dulu terbuang oleh pemetaan lama), sehingga layar pembahasan ujian buatan siswa akhirnya berfungsi. `explanation` bukan rahasia — ia hanya ditampilkan setelah penilaian.

#### Peta route yang dulu bergantung sepenuhnya pada proxy (tidak ada pemeriksaan di handler, dan bukan route publik yang disengaja)

Ini argumen terkuat untuk pemeriksaan CI di M10 — sekarang ketiganya sudah punya penjaga di handler, dan pemeriksaan CI itu tetap diperlukan agar tidak ada route keempat.

| Route | Isi yang dikembalikan | Status setelah H13 |
|---|---|---|
| `api/exams/list` | seluruh ujian + `authorName` (kunci jawaban **dihapus**) | `requireUser()` + `rateLimit` + `limit` |
| `api/modules/download` | hanya menaikkan counter | `requireSession()` (tetap tanpa query user; bucket rate limit tetap per IP) |
| `api/modules/count` | satu bilangan bulat | `requireSession()` |

Sisanya (`api/health`, `api/csp-report`, `api/webhooks/clerk`) memang publik secara sengaja dan sudah didokumentasikan; `webhooks/clerk` membuktikan keasliannya lewat tanda tangan Svix (`wh.verify`, baris 34).

**Sisa yang belum:** `authorName` masih terkirim ke setiap user yang login (karya siswa terbuka bagi semua siswa lain — keputusan produk, bukan bug), dan belum ada paginasi sungguhan (M13).

---

## 3. Privasi & Kepatuhan (UU PDP No. 27/2022)

Ini platform sekolah dengan **data anak/siswa**. Kategori data ini menuntut perlindungan lebih tinggi, dan saat ini hampir tidak ada kontrol yang relevan.

| Kewajiban | Status | Bukti |
|---|---|---|
| Dasar pemrosesan & persetujuan (consent) | ✅ Ada (M11) | Checkbox eksplisit (tidak tercentang bawaan) + gerbang `src/app/(dashboard)/layout.tsx`; `users.consent_policy_version` + `consent_accepted_at` mencatat versi + waktu. |
| Kebijakan Privasi | ✅ Ada (M11) | `/privacy` (11 bagian, termasuk tabel masa simpan) dan `/terms` (9 bagian), publik di `PUBLIC_ROUTES`. |
| Hak akses & ekspor data (DSR) | ✅ Ada (M11) | `GET /api/profile/export?format=json\|csv` + halaman `/profile/privacy`. |
| Hak penghapusan data | ✅ Ada (M11, dilengkapi M12) | Dua pintu, satu implementasi: `POST /api/profile/delete` (mandiri) dan cabang `user.deleted` di webhook Clerk (dari dashboard Clerk) sama-sama memanggil `anonymiseAccountByClerkId()` di `src/lib/accountData.ts`. Keduanya idempoten. |
| Pembatasan retensi | ✅ Ada (M11) | `RETENTION_POLICY` (`reports` 12 bln, `points_log` 24 bln, `submissions` 24 bln) ditampilkan di `/privacy` dan dieksekusi `POST /api/cron/retention` terjadwal. |
| Minimisasi data | ✅ Ada (M12) | Nol `db.select()` tanpa daftar kolom di `src/`; `users.email` hanya disentuh webhook Clerk; halaman profil publik tidak lagi mengambil email/kolom consent dan tidak lagi mengirim `clerkId` ke klien; foto profil adalah objek Blob, bukan base64 (M8). Dijaga `tests/unit/pii-surface.test.ts`. |
| Kontrol akses ke PII | ✅ Baik | C2 (kunci jawaban) ditutup di M3, H13 menutup jalur `customExams` yang setara, dan H2 (`hidden-badges`) dijaga `requireModerator()` di handler; sejak M9 deny-by-default menutup akses **anonim** ke `/leaderboard` & `/profile/[id]`. Sisa yang disengaja: daftar ujian mengirim `authorName` ke setiap user yang login (keputusan produk). |
| Audit trail akses data | ✅ Ada (M12) | `audit_log` (migrasi `0003`) mencatat `content.approve`, `content.reject`, `user.role_change`, `user.anonymise` — aktor, entitas, dan snapshot **skalar** sebelum/sesudah. Dibaca lewat `GET /api/moderator/audit-log`. Hibah poin otomatis sengaja tidak diduplikasi: `points_log` sudah menjadi catatannya. |
| Notifikasi insiden | ✅ Ada (M11) | `docs/INCIDENT-RESPONSE.md`: peran + pengganti, tingkat keparahan, batas waktu 3×24 jam (UU PDP Pasal 46), templat catatan tanggung jawab. `SECURITY.md` tetap jalur pelaporan dari luar. |

Tambahan: seluruh pengguna yang mendaftar **sebelum** M11 tidak pernah menyetujui kebijakan apa pun; gerbang consent meminta persetujuan itu satu kali saat mereka membuka dashboard berikutnya. Ini disengaja, bukan efek samping yang tidak diperhatikan.

---

## 4. Temuan Sedang & Rendah (P2/P3)

**P2 — Arsitektur & data**
- **Duplikasi folder API mati:** `src/api/modules/approve/route.ts`, `src/api/modules/subimt/route.ts` (typo "subimt"), `src/api/modules/subimt/pending/route.ts`, `src/api/webhooks/clerk/route.ts`. Ini bukan route yang dikenali Next (bukan di `src/app/api`), jadi tidak pernah dieksekusi — tapi ia menyimpan versi lama `db.transaction()` yang tidak kompatibel dengan `neon-http`, membingungkan siapa pun yang membacanya.
- **Tabel tidak terpakai:** `reviews` dan `bookmarks` didefinisikan di skema tapi tidak pernah disentuh; bookmark justru disimpan di `localStorage` (`ModulesLibraryClient.tsx:60`). Dead schema = beban kognitif.
- **Tidak ada `updatedAt`, soft delete, atau audit trail** di tabel mana pun. Approval tidak tercatat siapa/kapan di luar `submissions.reviewerId`.
- **Tidak ada unique constraint** pada `bookmarks(userId, questionId)`, `reviews(moduleId, reviewerId)`, dan `submissions(refId, type)` → duplikasi data bisa masuk.
- **Tidak ada indeks** pada kolom yang sering difilter (`status`, `subject`, `category`, `uploaderId`, `seasonPoints`).
- **`role: "admin"` ada di enum tapi tidak pernah dipakai** — jalur eskalasi tidak jelas.

**P2 — Kode & UX**
- **Mojibake parah:** `sign-up/page.tsx` dan `sign-up/[[...sign-up]]/page.tsx` berisi `dY?+`, `�s�`, `�"?�"?` — karakter UTF-8 rusak. Ini bukan kosmetik; teks ini **tampil rusak ke pengguna**.
- **Logika bisnis di komponen klien raksasa:** `ProfileClient.tsx` 1.630 baris, `practice/page.tsx` 1.526 baris, `badges.ts` 973 baris, `moderator/page.tsx` 946 baris. Sulit diuji dan tidak mungkin di-review.
- **Evaluasi badge di klien** → kondisi rahasia ("hidden badges") bisa dibaca dari bundle.
- **Data localStorage sebagai sumber kebenaran** untuk avatar, bio, motto, foto, dan bookmark → data hilang saat ganti device, dan tidak konsisten dengan DB.
- **Tidak ada `loading.tsx`/`error.tsx` yang seragam** — `profile/[id]/loading.tsx` ada, halaman lain tidak.
- **Import berlebih:** `LeaderboardClient` 552 baris, `LandingClient` 472 baris tanpa pembagian komponen.
- **`proxy.ts` dan `src/middleware.ts` duplikat** (lihat C6).

**P3 — Housekeeping**
- `clerk_exports.txt` (daftar nama export Clerk) di-commit ke repo root, tidak gitignored. Bukan rahasia, tapi sampah.
- `generate_avatars.py` dan `public/next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg` sisa template.
- Tidak ada `.env.example` → onboarding sulit, rawan salah konfigurasi (`CLERK_WEBHOOK_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_CLERK_*`). — ✅ **SELESAI di M10**: `.env.example` mendokumentasikan seluruh 10 variabel yang dibaca kode (wajib / opsional / disuntik platform), dan `tests/unit/env-example.test.ts` menolak template yang ketinggalan variabel.
- 7 pemanggilan `console.log/error` produksi, beberapa mencetak objek user.
- `catch (error: any)` di beberapa tempat (`api/seed/route.ts:73`, `ProfileClient.tsx:237`).
- Drift dokumentasi: `AGENTS.md` bilang password `nawa2024`, kode bilang `nawa2026`; `AGENTS.md` menyebut "22+ avatar" sementara `avatars.ts` berisi 23.
- Tidak ada `Dependabot`/`Renovate`, tidak ada `npm audit` di CI → 37 dependency langsung (22 runtime + 15 dev) tanpa pemantauan CVE. — ✅ **SELESAI di M10**: `.github/dependabot.yml` (npm + github-actions, mingguan, dikelompokkan) plus gerbang `npm audit --omit=dev` di CI yang memblokir HIGH/CRITICAL kecuali ada pengecualian tertulis di `scripts/audit-gate.mjs` — dan pengecualian yang jadi basi juga memblokir. Daftar pengecualiannya berakhir **kosong**: pohon produksi kini 0 critical / 0 high / 0 moderate. Temuan nyata saat gerbang ini dipasang pertama kali: **C7**.

---

## 5. ROADMAP — Milestone

17 milestone dalam 5 fase. Setiap milestone punya satu tujuan, deliverable yang bisa dicek, dan definisi selesai.

---

### FASE 0 — HENTIKAN PERDARAHAN (target: 1 minggu)
*Kriteria keluar fase: audit keamanan ulang oleh pihak ketiga lulus; tidak ada endpoint yang mengubah data tanpa pemeriksaan peran.*

#### M1 — Bersihkan endpoint berbahaya ✅ SELESAI (2026-10-15)
**Tujuan:** Menutup semua jalur tulis/baca terbuka.
**Deliverables**
- [x] Hapus `src/app/api/debug/**` (auth, db, submit) dan `src/app/api/seed/**`.
- [x] Hapus `src/api/**` (folder duplikat mati) dan `src/middleware.ts`.
- [x] Hapus `clerk_exports.txt`, `generate_avatars.py`, aset template di `public/`.
- [x] Hapus `ERROR_TROUBLESHOOTING.md` atau tandai arsip → dipindah ke `docs/archive/` + banner obsolete.

**Definition of Done:** `git grep -n "api/debug\|api/seed"` kosong; build hijau; tidak ada route yang tersisa yang menulis DB tanpa `auth()`.
- [x] Tidak ada referensi menggantung (hanya tersisa di dokumen arsip yang sudah ditandai obsolete).
- [x] `proxy.ts` dipertahankan sebagai satu-satunya middleware (Next 16).
- [ ] ⚠️ Verifikasi build/`tsc`/`eslint` **belum dijalankan** — `npm install` terblokir lock file Windows di environment ini, dan `.env.local` tidak tersedia. Jalankan manual: `npm ci && npx tsc --noEmit && npm run lint`.

---

#### M2 — Otorisasi terpusat (RBAC) ✅ SELESAI (2026-10-16)
**Tujuan:** Satu tempat yang menentukan siapa boleh apa.
**Deliverables**
- [x] Buat `src/lib/authz.ts`: `requireUser()`, `requireRole(roles)`, `requireModerator()` + predikat murni `hasReviewerRole(role)` — mengembalikan union `{ok:true,user} | {ok:false,response}` (401 bila belum login, 403 bila peran tidak cukup / user belum tersinkron). **Ditambah di H13/M14:** `requireSession()` — penjaga sesi yang tidak menyentuh DB, untuk route yang butuh *ada* sesi tetapi tidak butuh baris user.
- [x] Terapkan di **semua** route approval/review/daily-create + seluruh queue moderasi.
- [x] Ambil `submitterId` (dan `moduleId`/`questionId`) **hanya** dari baris `submissions` di DB; field itu dibuang dari body.
- [x] Hapus `MODERATOR_PASSWORD` & flag `sessionStorage`; `isModerator` murni dari `users.role`.
- [x] Perbaiki matcher `src/proxy.ts` → **deny-by-default** terhadap path nyata.
- [x] Middleware menutup `moderator` dan seluruh `/api/**` non-publik (401 JSON untuk API, redirect untuk halaman).

**Definition of Done:** user `student` → 403 di endpoint review; tanpa login → 401; hanya `moderator`/`admin` sukses.
- [x] Wiring terverifikasi: 8/8 route review+queue memanggil `requireModerator()`; tidak ada `submitterId` dari body; tidak ada sisa password/`sessionStorage`.
- [x] `tsc --noEmit` exit 0; `eslint` bersih untuk seluruh file baru/ubah (sisa masalah adalah pra-eksisting).
- [ ] ⚠️ **Test otomatis untuk matriks 401/403 ditunda ke M4** (harness test belum ada). Bukti perilaku saat ini statis + manual.

**Catatan keputusan**
- `requireOwner(resourceId)` **tidak dibuat**: di semua route yang ada, kepemilikan diturunkan dari sesi (`clerkId`) atau dari baris `submissions`, jadi abstraksi itu akan jadi dead code. Akan ditambahkan saat ada resource yang benar-benar butuh.
- Bonus keamanan (overlap M3): approval kini **idempoten** — klaim `submissions` lewat `UPDATE ... WHERE status='pending'` sehingga submit yang sama tidak bisa di-approve dua kali (sebelumnya tiap klik menambah +50 poin lagi).
- Perubahan perilaku produk: karena deny-by-default, `/modules`, `/leaderboard`, `/profile/[id]` kini butuh login. Ubah allowlist `isPublicRoute` di `src/proxy.ts` bila ada yang memang harus publik.
- Peran harus di-set eksplisit (level-100 & top-3 tidak lagi otomatis jadi moderator). Gunakan `npm run db:promote -- <email> moderator`.

---

#### M3 — Integritas poin & kunci jawaban di sisi server ✅ SELESAI (2026-10-16)
**Tujuan:** Klien tidak lagi menentukan poin.
**Deliverables**
- [x] Buang `answerKey` dan `explanation` dari `/api/questions/approved`.
- [x] Buang `answerKey`/`explanation` dari props halaman Kuis Harian (`questions/daily/page.tsx` kini `columns: { id, questionText, options }` saja).
- [x] `POST /api/quiz/submit` (baru) menilai jawaban **di server** terhadap kunci di DB. Hapus `POST /api/quiz/complete` yang lama.
- [x] Poin dihitung dari hasil penilaian server; `difficulty`, `score`, dan `quizId` dari klien **diabaikan total** (schema hanya menerima `answers`).
- [x] `daily-claim` hanya sukses bila ada **bukti percobaan ter-nilai** (baris `points_log` aksi `quiz_answer` pada soal kategori "Kuis Harian" sejak reset harian).
- [x] Idempotensi berbasis constraint DB: `uniqueIndex("points_log_user_action_ref_unique")` pada `(user_id, action, ref_id)`.
- [x] Cabut reward role "moderator di level 100"; moderator hanya lewat penunjukan admin (`npm run db:promote`).
- [ ] ⏭️ `POST /api/quiz/start` (session + batas waktu) — **sengaja tidak dibuat** (lihat catatan keputusan).
- [ ] ⏭️ Evaluasi badge dipindah ke server — **ditunda**; `/api/moderator/hidden-badges` sudah dijaga `requireModerator()` di M2.

**Definition of Done:** Skrip penyerang simulasi (`difficulty: sangat sulit`, `quizId` acak, loop approve) tidak menaikkan poin sama sekali.
- [x] Endpoint yang dulu diserang (`/api/quiz/complete`) **sudah tidak ada**; `/api/quiz/submit` tidak menerima `difficulty`/`score`/`quizId` sama sekali, jadi tidak ada permukaan untuk menyuap poin.
- [x] Loop approve tetap mati karena M2 (klaim atomik `submissions`).
- [x] `tsc --noEmit` exit 0; total error `eslint` repo **47 → 46** (tidak ada error baru; sisa `any`/`set-state-in-effect` sudah ada di HEAD).
- [ ] ⚠️ **Belum diuji runtime** — `.env.local` (Clerk + `DATABASE_URL`) belum ada, jadi skenario penyerang belum dieksekusi. Bukti saat ini statis (kode) + type/lint. Eksekusi nyata masuk M4.

**Model poin baru (sengaja diubah — baca sebelum kaget)**
- Poin kuis sekarang **per soal**, bukan per kuis: `mudah=5`, `sedang=10`, `sulit=15`, hanya bila jawaban **benar**.
- **Satu percobaan per soal per user, selamanya.** Baris `points_log` (`action="quiz_answer"`, `ref_id=questionId`) mencatat percobaan pertama — benar maupun salah (`delta=0`). Mengerjakan ulang soal tidak menambah poin lagi. Ini yang membuat farming mustahil: total poin yang bisa diraih = jumlah soal terverifikasi.
- **Anti self-dealing:** soal yang diunggah user sendiri tidak memberi poin ke dirinya (`uploaderId === user.id` disaring di server, bukan lagi hanya di klien).
- **Yang tidak lagi memberi poin:** kuis contoh hardcoded di browser (id `q1`…), ujian buatan siswa (`custom_exams`, soal ada di blob JSON, bukan `questions`), dan semua yang id-nya bukan UUID. UI menampilkan kartu "Latihan Tanpa V-Point" sebagai gantinya.
- Kartu hasil kuis kini menampilkan hasil penilaian server; layar review memakai `correctKey` dari respons server (kunci baru dikirim **setelah** jawaban dinilai).

**Catatan keputusan**
- **Kenapa tanpa `/api/quiz/start`:** idempotensi per-soal (`UNIQUE (user_id, action, ref_id)` dengan `ref_id = questionId`) sudah membuat farming mustahil tanpa perlu menyimpan session. Tabel session hanya akan menambah entropi + migrasi tanpa menambah keamanan untuk reward. **Batas waktu** masih bisa ditambahkan nanti kalau memang dibutuhkan sebagai aturan produk, bukan aturan keamanan.
- **`UNIQUE` dengan `ref_id` NULL aman:** Postgres menganggap NULL berbeda satu sama lain, jadi baris lama (`level_reward_points`, dll. dengan `ref_id` NULL) tidak akan bentrok. Constraint hanya mengikat saat `ref_id` diisi.
- **Bonus:** constraint yang sama otomatis membuat `modules/approve` & `questions/approve` (yang menulis `ref_id=moduleId/questionId`) ikut idempoten di level DB — melengkapi klaim atomik M2.
- **Kenapa kunci jawaban baru dikirim setelah dinilai:** soal yang belum dijawab tidak membawa kunci; tetapi saat "Cek Jawaban" di Kuis Harian, server mengembalikan kunci untuk soal itu. Karena poin hanya dihitung sekali per soal, membocorkan kunci setelah percobaan pertama tidak bisa dipakai farming.
- **Sudah diterapkan di produksi (2026-10-16):** index unik `points_log_user_action_ref_unique` sudah dibuat di database asli lewat prosedur adopsi M5. Idempotensi per-soal kini aktif, bukan sekadar ada di kode.
- **Perubahan perilaku:** leaderboard akan "mengendap" bagi user lama karena poin kuis kini jauh lebih kecil dan sekali saja per soal.

---

### FASE 1 — FONDASI ENGINEERING (target: 3–4 minggu)
*Kriteria keluar: perubahan apa pun bisa dibuktikan tidak merusak apa pun, dan setiap error di produksi terlihat.*

#### M4 - Testing & CI ✅ SELESAI (unit + integrasi) (2026-10-16)
**Deliverables**
- [x] Vitest untuk unit: `levelUtils`, `season`, `badges`, `quizScoring` (aturan skor + validasi Zod), `authz` (matriks peran).
- [x] Harness: `vitest.config.ts` (alias `@/*`, environment node), skrip `npm test` / `test:watch` / `test:coverage`.
- [x] **Test integrasi route dengan database ephemeral** — memakai **PGlite** (Postgres asli dikompilasi ke WASM), bukan Neon branch/Testcontainers. Alasan: tanpa Docker, tanpa network, tanpa `DATABASE_URL`, dan **jalan di CI tanpa secret**.
- [x] `.github/workflows/ci.yml`: install → `tsc --noEmit` → `lint` → `test` → `build` pada setiap PR + push ke `main`.
- [x] Code coverage: `@vitest/coverage-v8`. Scope `src/lib` + `src/app/api` → total **63.74%**; `authz`/`levelUtils`/`quizScoring`/`season` **100%**, `quiz/submit` **94.7%**, `quiz/daily-claim` **93.5%**, `badges` 99%, `levelRewards` 90%, `questions/approved` 87%, `questions/pending` 92%.
- [x] Logika skor dipindah ke `src/lib/quizScoring.ts` (murni, tanpa DB) supaya bisa diuji — sebelumnya terkurung di dalam route handler.
- [x] Migrasi berversi di-generate (`src/db/migrations/0000_*.sql`) dan dipakai sebagai DDL test — satu sumber kebenaran dari `schema.ts`, tanpa DDL tulis-tangan yang bisa drift.
- [ ] ⏭️ **Playwright** untuk alur kritis (sign-up → submit → approve → poin; kuis → skor → poin) — **ditunda**, butuh app yang jalan + browser. Test integrasi sudah menutup jalur poin/skor/otorisasi di level route.

**Definition of Done:** PR tidak bisa merge jika CI merah; setidaknya 3 skenario keamanan dari M2/M3 ter-cover.
- [x] `tsc`, `test`, dan `build` **blocking** di CI. `lint` masih `continue-on-error` karena repo membawa ~46 error pra-eksisting → jadi blocking di M14.
- [x] **Total 108 test di 9 file, semuanya hijau.**
- [x] **Batas API dikunci test** (`tests/integration/api-surface.test.ts`, 7 test): respons `/api/questions/approved` **tidak mengandung** `answerKey`/`explanation` bahkan saat diperiksa sebagai **teks mentah** (bukan hanya field yang kita ingat); hanya soal berstatus `approved` yang keluar; `isOwnQuestion` benar. `/api/moderator/auth-check` mengembalikan `false` untuk anonim/`student`/`contributor`/user-belum-tersinkron, dan `true` hanya untuk `moderator`/`admin`.
- [x] **Simulasi penyerang M3 benar-benar dieksekusi** (`tests/integration/quiz-submit.test.ts`, 11 test):
  1. Body `{ difficulty: "sangat sulit", score: 100, quizId: acak, pointsAwarded: 999999 }` → server tetap membayar **5 poin** (nilai asli soal "mudah"), bukan 100.
  2. `quizId` acak 10x berturut-turut → **0 poin tambahan** setiap kali.
  3. Idempotensi dijamin **constraint database**: insert duplikat ke `points_log` ditolak oleh Postgres.
  4. Jawaban salah = 0 poin, dan percobaan tetap "terbakar" (menjawab benar setelahnya juga 0).
  5. Soal milik sendiri tidak memberi poin; soal berstatus `pending` diabaikan; id sampel (`q1`) tidak bisa dinilai.
  6. Bonus level 5 dijalankan (495 + 10 + 250 = 755 poin).
- [x] **Matriks 401/403 M2 dieksekusi** untuk seluruh 8 endpoint review (`tests/integration/authz-matrix.test.ts`): anonim → 401, `student`/`contributor` → 403, `moderator`/`admin` lolos.
- [x] `daily-claim` diuji: menolak tanpa bukti, menolak soal non-"Kuis Harian", menolak percobaan basi (48 jam), membayar 25 sekali lalu menolak klaim kedua.
- [x] **`next build` berhasil diverifikasi** untuk pertama kali (compiled + TypeScript + 23 halaman). Tabel route mengonfirmasi `/api/quiz/submit` ada dan `/api/quiz/complete` sudah hilang.
- [x] **Bonus temuan:** test unit menangkap bug nyata — `getLevel()` mengembalikan `NaN` untuk poin negatif/NaN (akan tampil "Level NaN" di UI). Diperbaiki dengan clamp; ada test regresinya.

**Catatan keputusan**
- **PGlite, bukan Testcontainers:** test harus bisa jalan di CI tanpa Docker daemon dan tanpa kredensial. PGlite memberi Postgres asli (enum, FK, unique index, `ON CONFLICT`) sehingga constraint yang justru jadi inti keamanan M3 benar-benar teruji.
- `@/db` di-`vi.mock` dengan getter supaya route memakai instance PGlite test, bukan klien Neon. `@clerk/nextjs/server` juga di-mock untuk mengontrol sesi.
- Tabel tidak di-truncate antar test; setiap test memakai user/soal baru dengan id unik, jadi isolasi tidak bergantung pada urutan.
- Coverage `60.87%` sudah melewati target 60%, tapi tidak merata: route yang belum punya test (`exams/*`, `profile/*`, `modules/download`, `webhooks/clerk`) masih 0%. Angka ini yang harus naik di milestone berikutnya.
- **Catatan build (sudah diperbaiki):** `next build` sempat memperingatkan "multiple lockfiles" karena ada `bun.lock` di direktori home pengguna, sehingga Turbopack memilih home directory sebagai workspace root. Diperbaiki dengan `turbopack.root` (absolute path ke direktori proyek) di `next.config.ts`.
- **Temuan baru yang tercatat (belum dikerjakan):** `requireUser()`/`requireModerator()` baru dipakai di 8 route review + 2 route kuis. Route user-facing lain masih memakai `await auth()` mentah (`modules/submit`, `questions/submit`, `profile/status`, `profile/report`, `exams/create`, `questions/approved`, `moderator/auth-check`; `profile/update` **sudah** dipindah ke `requireUser()` di M8). Konsekuensinya: route itu (a) tidak memverifikasi bahwa user benar-benar ada di tabel `users`, dan (b) memulangkan bentuk error yang berbeda-beda. Eksposur saat ini terbatas karena `src/proxy.ts` tetap menolak request tanpa sesi, tapi ini utang yang harus dibayar — sekarang lebih mendesak, karena sebelum M9 proxy itu ternyata tidak pernah jalan sama sekali (lihat C6).

---

#### M5 - Migrasi database terkelola ✅ SELESAI (2026-10-16)
**Deliverables**
- [x] Ganti `db:push` dengan `drizzle-kit generate` + `drizzle-kit migrate`. Script `db:push` **dihapus** dari `package.json`: tidak boleh ada lagi jalan pintas yang bisa menyimpangkan skema produksi tanpa riwayat.
- [x] `src/db/migrations/` di-commit; setiap perubahan skema lewat PR, dan CI gagal bila `schema.ts` menyimpang dari migrasi.
- [x] Constraint: `points_log(user_id, action, ref_id)` unik (M3); **partial** unique `submissions(type, ref_id) WHERE status='pending'`; `CHECK (users.avatar_index IS NULL OR avatar_index >= 0)`.
- [x] Index: `modules(status, subject)`, `questions(status, category)`, `users(season_points DESC NULLS LAST)`.
- [x] `updatedAt` pada `users`, `modules`, `questions`, `submissions` — **dijaga trigger database** (`set_updated_at()`), bukan oleh disiplin kode aplikasi.
- [x] **Hapus tabel mati** `reviews` dan `bookmarks` (keduanya nol referensi di `src/`; bookmark di UI adalah state klien).
- [x] Seed dipindah ke `src/db/seed.ts` **dengan pengaman**: menolak jalan kecuali `ALLOW_SEED=1`, mencetak host target, dan idempoten. `insert_data.ts` lama (yang menulis tanpa syarat ke `DATABASE_URL` mana pun) dihapus.
- [ ] ⏭️ `points_log(user_id, action)` **sengaja tidak dibuat** — index unik M3 sudah `(user_id, action, ref_id)` dan `(user_id, action)` adalah prefix-nya, jadi index terpisah hanya duplikasi.
- [ ] ⏭️ `deletedAt` (soft delete) **ditunda**. Tidak ada satu pun operasi hapus di seluruh `src/`, jadi kolomnya akan jadi kolom mati — dan soft delete setengah jalan (kolom ada, query tidak memfilter) lebih buruk daripada tidak ada. Harus dikerjakan bersama fitur hapusnya.

**Definition of Done:** DB produksi bisa dibuat ulang dari nol hanya dengan `migrate` + `seed`; rollback teruji.
- [x] Database asli **sudah dimigrasikan dan diverifikasi** pada 2026-10-16.
- [x] **Nol kehilangan data**: jumlah baris identik sebelum dan sesudah (6 users, 10 modules, 2 questions, 9 submissions, 26 points_log, 1 custom_exam).
- [x] Index, CHECK constraint, dan 4 trigger terverifikasi ada di database asli lewat inspeksi read-only setelah migrasi.
- [x] `tests/integration/migrations.test.ts` (9 test) menjalankan file SQL asli terhadap Postgres nyata (PGlite) yang **sudah berisi data lama**: 0000 → isi data legacy (termasuk baris di tabel yang akan dihapus) → 0001 → verifikasi data, index, trigger, partial-unique, dan CHECK. Total suite: **117 test di 10 file**, coverage tetap **63.74%** (test migrasi menjalankan SQL, bukan kode `src/`).
- [ ] ⚠️ **Rollback belum teruji secara eksplisit.** Drizzle tidak punya down-migration; rollback nyata hanya PITR Neon atau restore dari backup. Perubahan additive (index/kolom) mudah dibalik, tapi `DROP TABLE` tidak. DoD ini karena itu **belum sepenuhnya terpenuhi** — dicatat apa adanya.

**Prosedur adopsi database yang sudah ada (dijalankan sekali, 2026-10-16)**
1. **Backup** seluruh tabel ke JSON (63 baris) sebagai jaring kedua di samping PITR Neon.
2. **Inspeksi read-only**: daftar tabel/index/constraint + cek duplikat yang bisa menggagalkan constraint baru (hasil: nol duplikat, `avatar_index` nol negatif).
3. **Sinkron ke 0000**: satu-satunya selisih database asli vs migrasi 0000 adalah index unik M3 (karena `db:push` belum pernah dijalankan) → `CREATE UNIQUE INDEX IF NOT EXISTS`.
4. **Baseline**: catat 0000 sebagai sudah diterapkan di `drizzle.__drizzle_migrations` (hash = sha256 isi file; `created_at` = `when` dari `_journal.json`).
5. **`npx drizzle-kit migrate`** menerapkan 0001 lewat migrator resmi Drizzle, bukan SQL buatan sendiri.
6. **Verifikasi ulang** dengan inspeksi read-only.

**Catatan keputusan**
- **Kenapa `db:push` dihapus:** perintah itu menyelaraskan database langsung dari `schema.ts` tanpa riwayat, tanpa review, dan bisa menjatuhkan kolom/tabel secara diam-diam. Selama perintahnya ada, cepat atau lambat ada yang memakainya pada database produksi.
- **Kenapa `updatedAt` pakai trigger:** kalau hanya kolomnya yang ditambah, setiap jalur kode yang lupa mengisinya akan menulis timestamp bohong. Trigger membuatnya benar tanpa bergantung pada ingatan penulis kode.
- **Hash migrasi dicatat, bukan dibandingkan:** migrator `neon-http` Drizzle membandingkan `created_at`, bukan hash (`node_modules/drizzle-orm/neon-http/migrator.js`). Hash tetap dihitung dengan cara yang sama supaya catatannya konsisten.
- **`DROP TABLE ... CASCADE` aman di sini** karena `bookmarks` dan `reviews` tidak direferensikan siapa pun dan keduanya kosong di produksi (diverifikasi sebelum migrasi, bukan diasumsikan).

---

#### M6 — Observability 🔶 SEBAGIAN (logging + health selesai; Sentry menunggu keputusan DSN)
**Deliverables**
- [x] Structured logging dengan `requestId`, level, dan redaksi PII — `src/lib/logger.ts`.
- [x] `GET /api/health` (DB + Clerk) untuk uptime monitor, publik dan hanya mengembalikan status kasar. **Diverifikasi live**: `next start` lalu `GET /api/health` tanpa sesi → `HTTP 200` `{"status":"ok","checks":{"database":"ok","auth":"ok"},…}` dengan `cache-control: no-store` — permintaan itu benar-benar memukul Neon asli.
- [x] Ganti seluruh `console.*` di kode server (33 pemanggilan di 22 file: 22 handler route API + 1 server component `profile/page.tsx`) dengan logger terstruktur.
- [ ] ⏭️ Sentry (atau setara) untuk server + client. **Tidak dikerjakan**: butuh DSN dari akun pihak ketiga. Logger sengaja dibuat kompatibel pino (satu objek JSON per baris dengan `level`/`time`/`msg`/`requestId`), jadi drain/Sentry bisa ditambahkan tanpa mengubah satu pun call site.
- [ ] ⏭️ Dashboard (error rate, p95 latency, poin/hari, submission/hari). Butuh backend observability dulu.

**Definition of Done:** Error yang sengaja ditanam muncul di Sentry dengan stack + requestId dalam < 1 menit. — **belum terpenuhi** (menunggu Sentry).

**Catatan keputusan**
- **Kenapa bukan `pino`:** logger ini dipakai hampir setiap route API, dan sengaja tidak menyentuh modul Node apa pun (`requestId` memakai Web Crypto, `globalThis.crypto.randomUUID()`, bukan `node:crypto`) supaya tetap bisa hidup di runtime apa pun — termasuk Edge — tanpa mengubah satu pun call site. Bentuk keluarannya tetap kompatibel pino, jadi menambahkan drain nanti tidak perlu menyentuh call site.
- **Redaksi PII diuji, bukan diklaim.** `tests/unit/logger.test.ts` (13 test) membuktikan email, nama, `clerkId`, `bio`, `motto`, `photoUrl`, `authorization`, `cookie`, dan `token` tidak pernah keluar ke log — termasuk di dalam array dan objek bertingkat. Ada juga regression test untuk dua jebakan regex: pola `ip` yang keliru ikut meredaksi `description`, dan `\bname\b` yang gagal menangkap `userName`.
- **Nama key yang penting:** call site yang mengirim nilai mentah (`clerkId`, `moduleId`) diperbaiki agar memakai key bernama — kalau tidak, nilainya masuk sebagai `detail` dan lolos dari redaksi.
- **`requestId` tanpa menyentuh header request di `src/proxy.ts`:** menimpa header request di dalam `clerkMiddleware` berisiko menabrak header internal Clerk. Logger menghormati `x-request-id` bila ada yang memasangnya (CDN/proxy) dan membuat sendiri bila tidak, sehingga korelasi tetap utuh per request.
- **`/api/health` publik tapi tidak bocor:** route ditambahkan ke `PUBLIC_ROUTES` karena monitor tidak punya sesi. Ia hanya mengembalikan `ok`/`down` per komponen; pesan error asli hanya masuk log. Ada test yang memastikan `ECONNREFUSED`, nama host internal, dan nomor port tidak muncul di respons.
- **`console.*` di komponen klien sengaja belum diubah:** log browser tidak punya tempat tujuan terstruktur sebelum ada Sentry. Menggantinya sekarang hanya akan menukar `console.log` dengan JSON di konsol pengguna.

---

### FASE 2 — HARDENING KEAMANAN (target: 3 minggu)

#### M7 — Rate limiting & anti-abuse 🔶 SEBAGIAN (limiter + alarm selesai; bot protection = toggle dashboard Clerk)
- [x] Rate limiting di 8 endpoint mutasi (`modules/submit`, `questions/submit`, `profile/update`, `profile/report`, `modules/download`, `quiz/submit`, `quiz/daily-claim`, `exams/create`) — **per user dan per IP**, dua bucket sekaligus.
- [x] Budget per route dipersempit: submit modul 5/menit, soal 10/menit, laporan 5/jam, klaim harian 3/menit, update profil 10/menit, download 60/menit (lihat `RATE_LIMITS`).
- [ ] ⏭️ Bot protection pada sign-up. **Tidak bisa dikerjakan dari kode**: ini toggle di Clerk Dashboard (Attack Protection → bot/CAPTCHA). Checklist ada di bawah.
- [x] Alarm otomatis: `point_spike_detected` (lonjakan poin) + event `rate_limit_exceeded`. Keduanya log terstruktur, bukan blokir.
- [x] Backend tanpa akun pihak ketiga: in-memory (dev/1 instance) **atau** Upstash REST via `fetch` murni (tanpa dependensi baru), dipilih dari env. Di produksi tanpa Upstash, limiter menulis satu peringatan `rate_limit_in_memory_backend` per proses, supaya deploy tidak *terlihat* terlindungi padahal tidak.

**Definition of Done:** skrip yang menembak satu endpoint 1.000× berhenti di balasan 429, dan user normal tidak merasakannya.

**Verifikasi:** 21 test baru — 14 unit (`tests/unit/rateLimit.test.ts`) + 3 integrasi (`tests/integration/rate-limit.test.ts`) yang benar-benar memukul route `profile/update` sampai 429, plus 4 test alarm (`tests/integration/abuse.test.ts`). Coverage total naik ke **68.09%** (dari 63.74%); `abuse.ts` 100%, `rateLimit.ts` 96%, `logger.ts` 97.3%, `api/health` 100%.

**Catatan keputusan**
- **Jujur soal batas backend in-memory.** Rate limiter in-memory hanya menghitung request yang mendarat di instance yang sama. Di serverless (Vercel), tiap invocation bisa instance baru, jadi backend ini **tidak** menghentikan flood terdistribusi. Ia berguna untuk dev dan deploy satu instance. **Produksi butuh Upstash**: set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` dan limiter otomatis berpindah backend tanpa perubahan kode. Peringatan ini juga ikut tercetak di komentar modul dan di AGENTS.md, supaya tidak diklaim sebagai proteksi yang tidak ada.
- **Kenapa Upstash lewat `fetch`, bukan `@upstash/ratelimit`:** satu dependensi lebih sedikit, dan perintahnya sederhana (`INCR` + `EXPIRE ... NX` + `PTTL` dalam satu pipeline). Bentuk body pipeline diuji eksplisit, termasuk bahwa TTL memakai `NX` — kalau TTL diperbarui tiap request, window-nya tidak pernah menutup.
- **Fail-open, dengan suara.** Kalau store error, request dilewatkan dan error-nya di-log. Menutup (fail-closed) berarti gangguan Redis berubah menjadi outage seluruh platform — hasil yang lebih buruk untuk sekolah. Trade-off ini disengaja dan terdokumentasi.
- **Identitas di-hash.** Key bucket = `sha256(ip)` / `sha256(userId)`, dipotong 32 hex. Upstash adalah pihak ketiga, dan IP adalah data pribadi di bawah UU PDP; hash menjaga key tetap tidak terbaca sambil tetap bisa dihitung. Ada test yang memastikan **IP mentah dan user id mentah tidak pernah terkirim** ke Upstash.
- **Guard jalan sebelum body dibaca.** Ada test yang membuktikan client yang sudah kehabisan kuota langsung dapat 429 walaupun mengirim body yang bukan JSON — jadi payload besar tidak sempat diparse.
- **`profile/update`, `modules/download`, dan `csp/report` hanya dibatasi per IP** (bucket per-user-nya tetap ada di `RATE_LIMITS` tetapi route memanggil `rateLimit(..., null)`). `profile/update` hanya mengubah baris milik pemanggil sendiri (abuse = merusak diri sendiri), `modules/download` tidak pernah me-resolve user, dan `csp/report` publik sehingga tidak ada identitas. Menambah query ke hot path untuk ketiganya tidak sepadan. `exams/create` masih boleh anonim (lihat H3), jadi bucket per-user-nya hanya berlaku bila `authorId` ada.
- **Alarm lonjakan poin itu tripwire, bukan detektor presisi.** M3 sudah membuat farming satu soal mustahil (unique index). Yang tersisa adalah manusia yang menjawab banyak soal *baru* dengan cepat — dan tidak ada baseline untuk membedakannya dari murid rajin. Ambangnya karena itu sengaja tinggi (500 poin / 10 menit) supaya tidak jadi alarm yang di-mute. Ia hanya menulis log `point_spike_detected`; alert sungguhan butuh log drain yang mengawasi event itu.
- **Reset store antar test.** Hitungan limiter adalah state module; `tests/setup.ts` meresetnya di `beforeEach`, jadi tiap test mulai dari dunia yang bersih seperti instance server yang baru.

**Checklist manual (butuh akses dashboard Clerk)** **Selesai**
1. Clerk Dashboard → **Attack Protection** (atau **User & Authentication → Attack Protection**).
2. Aktifkan **Bot protection** pada sign-up/sign-in.
3. Aktifkan **CAPTCHA** (mis. Cloudflare Turnstile) untuk sign-up.
4. Tambahkan `NEXT_PUBLIC_CLERK_...`/secret yang diminta Clerk ke env produksi, lalu verifikasi form sign-up benar-benar menantang.

Sumber: `src/lib/rateLimit.ts`, `src/lib/abuse.ts`.

#### M8 — Validasi & penanganan unggahan menyeluruh ✅ SELESAI (2026-10-16)
**Deliverables**
- [x] Zod schema untuk **setiap** endpoint POST. Satu helper (`parseJsonBody` di `src/lib/validation.ts`) membaca body dengan batas ukuran, menolak content-type yang salah, dan memetakan kegagalan schema ke **satu bentuk error**: `400 { error, details: [{ path, message }] }`.
- [x] Batas ukuran body: default `MAX_JSON_BODY_BYTES = 64 KB` (body sah terbesar adalah ujian custom ~25 KB), `exams/create` 256 KB. Body lebih besar → **413**.
- [x] Base64 di DB dihentikan. `POST /api/uploads` menerima `multipart/form-data`, menyaring **magic bytes** (bukan `content-type` klien), dan mengembalikan URL object storage.
- [x] `next.config.ts`: `hostname: '**'` diganti allowlist eksplisit (lihat H6).
- [x] Sanitasi render: tidak ada `dangerouslySetInnerHTML` di seluruh repo (diverifikasi), dan sekarang dijaga oleh kenyataan bahwa URL modul wajib `http(s)`.

**Definition of Done:** setiap route mutasi menolak body cacat dengan 400/413/415 yang konsisten, dan tidak ada jalur yang menulis blob besar ke Postgres.

**Verifikasi:** 232 test lulus (dari 156), 21 file. Coverage total **73.5%** (dari 68.09%). `storage.ts` 100%, `uploadClient.ts` 100%, `api/uploads` 100%, `api/profile/update` 95.2%, `api/modules/download` 88.5%, `validation.ts` 97.8%. `tsc --noEmit` bersih; `next build` sukses (34 route); `eslint .` **45 error / 34 warning** — satu error *lebih sedikit* dari baseline M7 (46/34), semuanya `react-hooks/*` yang sudah ada sebelumnya di komponen klien.

**Test baru**
- `tests/unit/validation.test.ts` (16) — 415 non-JSON, 413 lewat pengukuran **dan** lewat petunjuk `content-length`, body kosong, JSON rusak, path bertitik, `(root)`, key tak dikenal pada schema `.strict()`, pesan kustom.
- `tests/unit/storage.test.ts` (23; semula 20) — magic-byte png/jpeg/webp/pdf, `type_mismatch` (byte menang atas klaim), `application/octet-stream`/null diterima, GIF/SVG/teks ditolak, batas ukuran tepat di ambang, PDF ditolak untuk avatar, `isOwnStorageUrl` (termasuk `blob.vercel-storage.com.evil.test`), bentuk `buildPathname`, lalu — setelah pindah ke SDK resmi — **opsi yang kita kirim ke `put`/`del`**, tenggat `AbortController`, dan `StorageError` bertipe (bukan lagi header REST yang dirakit sendiri).
- `tests/unit/uploadClient.test.ts` (6) — bentuk multipart, pesan error server diteruskan, fallback saat body bukan JSON, 200 tanpa `url` = gagal, error jaringan jadi pesan; **plus test yang mengunci agar limit klien tidak menyimpang dari `storage.ts`**.
- `tests/integration/uploads.test.ts` (14) — 401 tanpa sesi, 403 user belum tersinkron, **503 saat storage belum dikonfigurasi** (tanpa fallback base64 dan tanpa memanggil `put`), 400 non-multipart / purpose hilang / file hilang, `unsupported_type`, `type_mismatch`, `not_allowed_for_purpose`, 413 lewat `content-length` (tanpa body) dan lewat file 11 MB sungguhan, 201 dengan `put` di-mock, 502 saat storage gagal.
- `tests/integration/profile-update.test.ts` (15) — 401/403, key tak dikenal ditolak, body kosong, `avatarIndex` di luar rentang, `photoUrl` base64 **dan** host asing ditolak, `motto` kepanjangan, JSON rusak → 400 bukan 500, penulisan `avatarIndex`/`bio`/`motto`, penyimpanan URL sendiri, **penghapusan objek lama saat diganti**, tidak ada penghapusan saat URL sama, dan edit tetap sukses bila penghapusan gagal.
- `tests/integration/modules-download.test.ts` (5) — id ngawur → 400 (dulu 500 dari cast Postgres), id hilang, key tak dikenal, counter naik, id tak dikenal tetap 200.
- `tests/integration/rate-limit.test.ts` diperbaiki: loop budget dulu mengirim `avatarIndex` 0..29, yang kini ilegal untuk indeks 23–29.

**Catatan keputusan**
- **Magic bytes, bukan `content-type`.** Klien menentukan header-nya sendiri, jadi header tidak membuktikan apa pun. Format ditentukan dari beberapa byte pertama, dan bila tipe yang diklaim **berbeda** dari yang terbaca, request **ditolak** (`type_mismatch`) — bukan diam-diam ditulis ulang. Diam-diam memperbaiki berarti file tersimpan dengan tipe yang tidak pernah dipilih penggunanya.
- **Allowlist per tujuan, bukan satu daftar global.** `purpose` mempersempit tipe: avatar hanya png/jpeg/webp, modul menambah PDF. Konsekuensinya SVG **tidak** diizinkan: SVG bisa berisi script dan disajikan inline oleh blob store, jadi ia adalah vektor XSS, bukan gambar biasa.
- **Tipe unggahan modul dipersempit ke PDF + png/jpeg/webp.** `.docx`/`.doc`/`.pptx` yang dulu diiklankan dihapus: pembaca di aplikasi tidak bisa merender Office, dan menyajikannya dari blob berarti mengunduh file Office milik orang lain ke mesin siswa. Tab Google Drive tetap jadi jalan keluar untuk format lain.
- **503, bukan fallback base64.** Saat `BLOB_READ_WRITE_TOKEN` belum ada, endpoint menjawab 503 dengan log yang berisik. Jalan pintas "kalau storage tidak ada, tulis base64 ke DB" persis masalah yang M8 selesaikan; membiarkannya sebagai fallback berarti masalah itu kembali diam-diam di produksi.
- **`photoUrl` hanya boleh `null` atau storage sendiri.** Tanpa batas ini, leaderboard (yang mengirim `photoUrl` 100 user sekaligus) berubah jadi CDN gambar gratis dan **tracking pixel** yang menyala untuk setiap pengunjung. Objek lama dihapus saat diganti/dikosongkan; kegagalan penghapusan bersifat *best effort* (objek yatim = masalah kebersihan, bukan edit profil yang gagal).
- **`contentUrl` wajib `http(s)`; `data:` ditolak.** Ini mematikan jalur base64 PDF yang dulu dipakai `SubmitClient`. Tautan Google Drive tetap diterima.
- **Bentuk error 400: `path` berupa string bertitik**, bukan array milik Zod. Hanya satu konsumen yang membaca `details` (`SubmitClient`), dan ia sudah disesuaikan. `fieldErrors` juga **memecah** kegagalan `.strict()` menjadi satu entri per key (`unrecognized_keys` di Zod 4 membawa `path` kosong + daftar `keys`); tanpa itu, key salah ketik hanya muncul sebagai `(root)` yang tidak menolong siapa pun.
- **Kontrak jalur blob diserahkan ke SDK resmi (keputusan dibalik).** M8 dulu memanggil REST Vercel Blob lewat `fetch` murni dengan alasan "tanpa dependensi baru". Itu keliru dalam jangka panjang: kontraknya memang kecil, tapi **bukan milik kita** — versi API, set header, kebijakan retry, multipart, dan OIDC semuanya berubah tanpa pemberitahuan, dan klien buatan sendiri gagal **diam-diam** saat itu terjadi. Kini `src/lib/storage.ts` memakai `put`/`del` dari `@vercel/blob`; yang tetap tinggal di modul ini hanya hal yang SDK tidak mungkin tahu: apa isi byte-nya (`checkUpload`, magic bytes, plafon ukuran) dan di mana objek boleh hidup (`buildPathname`, `isOwnStorageUrl`).
- **Token dikirim eksplisit ke setiap panggilan SDK.** Tanpa itu SDK menyelesaikan kredensial dengan urutan OIDC → `BLOB_READ_WRITE_TOKEN`, jadi deployment yang punya `VERCEL_OIDC_TOKEN` akan memilih store dari `BLOB_STORE_ID` dan **mengabaikan** token kita. Store id tetap diperiksa sendiri (`token.split("_")[3]`) supaya token cacat dilaporkan sebagai `not_configured` (kesalahan konfigurasi), bukan sebagai gangguan store.
- **Setiap panggilan dibungkus tenggat `AbortController`.** SDK melakukan retry sampai **10 kali** dengan backoff; store yang sekadar menggantung akan menahan handler jauh melewati `maxDuration`. SDK hanya membaca `AbortError` sebagai "menyerah" — `AbortSignal.timeout` menghasilkan `TimeoutError` yang justru **di-retry** seperti kegagalan biasa. Karena itu `withDeadline` memakai controller, bukan `AbortSignal.timeout`.
- **Kegagalan SDK dinormalkan jadi `StorageError` bertipe.** Pemanggil tidak pernah melihat kelas error SDK; dari sudut pandang route, store tidak terjangkau (`unavailable`) atau belum dikonfigurasi (`not_configured`).
- **Unit test menghentikan mock di batas modul kita, bukan di `undici`.** Meng-mock `undici` untuk menguji header berarti mengunci internal dependensi dan akan pecah di rilis berikutnya; yang diuji sekarang adalah opsi yang **kita** kirim ke SDK (`access`, `token`, `contentType`, `addRandomSuffix: false`, `allowOverwrite: false`, `cacheControlMaxAge`), tenggatnya, dan error bertipe yang keluar. Integrasi `/api/uploads` dan `profile/update` hanya mengganti panggilan jaringannya, sehingga `checkUpload`, plafon ukuran, dan `isOwnStorageUrl` tetap asli — setiap penolakan tetap keputusan route sendiri.
- **Tidak ada overwrite, dan pathname berisi uuid.** `uploads/<userId>/<uuid>.<ext>`: path yang ditebak tidak bisa menimpa file orang lain, dan dua unggahan tidak bisa bertabrakan.
- **Perbaikan bug di luar fokus:** `exams/create` mengirim `explanation: null` untuk soal tanpa pembahasan, sedangkan schema-nya `z.string().optional()` → menyimpan ujian dengan satu pembahasan kosong dulu **selalu** 400. Kini `optionalText(2000).nullable()`. `profile/report` juga kini `z.enum(["bug","content","other"])`, cocok dengan tiga pilihan di dialog.
- **`webhooks/clerk` sengaja tetap `req.json()` mentah.** Verifikasi tanda tangan svix butuh body asli; membungkusnya dengan schema yang membaca ulang body akan merusaknya.
- **Keterbatasan yang dicatat, belum dikerjakan:** blob yang diunggah lalu *diganti sebelum disubmit* (pilih file A → ganti ke file B) meninggalkan objek yatim. Membersihkannya butuh sapuan berkala berbasis referensi (`contentUrl`/`photoUrl` yang tidak lagi dirujuk baris mana pun) — kandidat untuk M13/M14, bukan penambahan yang aman dilakukan diam-diam di sini.
- **Data produksi yang perlu dibersihkan (bukan bug kode):** 3 modul punya `contentUrl` menunjuk host palsu `https://nawa-learn.storage/uploads/local-...` dan 1 menunjuk `https://drive.google.com/test` — tautan mati. 3 modul lain menyimpan PDF `data:` base64 yang **tetap harus** didukung pembaca (baris lama belum dimigrasikan). Lihat catatan migrasi data di akhir bagian ini.

**Verifikasi live yang masih tertunda:** unggahan sungguhan ke Vercel Blob. `BLOB_READ_WRITE_TOKEN` sekarang sudah ada di `.env.local`, jadi langkah ini tinggal dijalankan manual: buka halaman profil dan unggah avatar, lalu submit satu modul, dan pastikan URL yang tersimpan menunjuk `*.public.blob.vercel-storage.com`. Tanpa langkah itu, tes tetap memakai `put`/`del` yang di-mock dan endpoint menjawab 503 bila token hilang.

**Migrasi data yang disarankan (dijalankan manual, bukan bagian dari kode M8)**
1. **Tautan mati:** perbarui/arsipkan 3 modul ber-`contentUrl` `https://nawa-learn.storage/...` dan 1 modul ber-`https://drive.google.com/test`. Keduanya tidak akan pernah bisa dibuka siswa.
2. **PDF `data:`:** unggah ulang 3 modul yang menyimpan PDF base64 ke Blob, lalu ganti `content_url` dengan URL hasil unggahan. Pembaca tetap mendukung `data:` sampai ini selesai, jadi langkah ini bisa dicicil.
3. Setelah (2) selesai, kandidat berikutnya adalah menambahkan `CHECK`/validasi agar `content_url` baru selalu `http(s)` — saat ini penjagaan itu ada di schema request, bukan di kolom.

Sumber: `src/lib/validation.ts`, `src/lib/storage.ts`, `src/lib/uploadClient.ts`, `src/app/api/uploads/route.ts`, `src/app/api/profile/update/route.ts`, `src/components/submit/SubmitClient.tsx`, `src/components/modules/ModulesLibraryClient.tsx`, `next.config.ts`.

#### M9 — Header keamanan, CSRF, dan sesi ✅ SELESAI (2026-10-16)
**Deliverables**
- [x] CSP ketat berbasis **nonce** + `report-uri`/`report-to`, dipasang per request di `src/proxy.ts` lewat opsi `contentSecurityPolicy` milik Clerk (`strict: true`).
- [x] HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy` lewat `headers()` di `next.config.ts`.
- [x] Penjaga CSRF di depan semua route mutasi berbasis cookie, dijalankan **sebelum** pemeriksaan sesi.
- [x] `CLERK_SECRET_KEY`: diperiksa, **tidak pernah terekspos** — tidak ada file `.env*` yang pernah di-commit (`git log --all --diff-filter=A` tidak menemukan satu pun), dan `.env*` ada di `.gitignore`. Rotasi tidak diperlukan.
- [x] `POST /api/csp-report` sebagai penampung laporan pelanggaran CSP (publik, tanpa kredensial, tidak menyimpan apa pun).
- [x] **Perbaikan kritis C6:** `proxy.ts` dipindah ke `src/proxy.ts`. File di root tidak pernah dimuat Next (lihat C6), sehingga gate autentikasi, penjaga CSRF, dan CSP **sama-sama tidak pernah jalan** sampai M9.

**Definition of Done:** respons dari origin ini membawa CSP nonce yang berlaku, laman tidak bisa di-iframe, dan request lintas situs ke endpoint mutasi dijawab **403** tanpa pernah menyentuh handler.

**Verifikasi:** 295 test lulus (dari 232), 25 file — **63 test baru**. `tsc --noEmit` bersih; `eslint .` **45 error / 34 warning** (tidak berubah dari M8, semuanya `react-hooks/*` yang sudah ada sebelumnya); `next build` sukses (36 route, semuanya dinamis) dan kini memunculkan baris **`ƒ Proxy (Middleware)`** yang sebelumnya tidak ada.

**Verifikasi live (server produksi sungguhan, `next start`):** setelah pemindahan ke `src/proxy.ts`, `next build` memunculkan baris `ƒ Proxy (Middleware)` yang sebelumnya tidak ada; `GET /` membawa `Content-Security-Policy` berbasis nonce, `Reporting-Endpoints`, dan seluruh header statis; **21 dari 21** tag `<script>` SSR membawa nonce; API anonim menjawab **401 JSON**; halaman terproteksi menjawab **307 → sign-in**; POST lintas situs (`Origin: https://evil.example`) ke `/api/csp-report` dijawab **403** (dan 403 itu tetap membawa header statis), sedangkan same-origin dijawab **204**. Sebelum pemindahan, seluruh pemeriksaan ini gagal — CSP tidak ada dan POST lintas situs lolos dengan **204**. Catatan: `middleware-manifest.json` **bukan** bukti apa pun di sini — pada Next 16 + Turbopack file itu tetap `{}` bahkan saat proxy berjalan; sinyal yang sah adalah baris build dan perilaku runtime di atas.

**Test baru**
- `tests/unit/csrf.test.ts` (20) — same-origin lolos (termasuk di belakang proxy TLS-terminating, tempat skema request `http` tapi browser melihat `https`), host kembar/sibling subdomain/port berbeda ditolak, `Origin: null` ditolak, `Origin` tak terurai **gagal tertutup**, `Sec-Fetch-Site: cross-site`/`same-site` ditolak, `same-origin`/`none` lolos, metode baca diabaikan, rantai `x-forwarded-*` diambil hop pertama.
- `tests/unit/securityHeaders.test.ts` (19) — daftar header statis (nosniff, referrer, framing, `camera=(self)`, COOP, HSTS hanya di produksi, tanpa `preload`) **plus** CSP yang benar-benar diterima browser, diuji dengan **memanggil `src/proxy.ts` asli** memakai `NextRequest` sungguhan: `'strict-dynamic'` + nonce ada, direktif Clerk tetap hidup setelah merge (`frame-src` Cloudflare Turnstile, `style-src 'unsafe-inline'`, `default-src 'self'`), `Reporting-Endpoints` absolut, `x-nonce` diteruskan ke request lewat `x-middleware-override-headers`, nonce **berbeda tiap request**, dan CSRF 403 sebelum auth (bukan 401).
- `tests/integration/csp-report.test.ts` (20) — format `report-uri` lama dan `reports+json` baru dinormalkan ke satu bentuk log, `original-policy` **tidak pernah** ikut tercatat, `effective-directive` diutamakan, entri non-`csp-violation` diabaikan, 415/400/413/405, field panjang (`data:` URI) dipotong, satu request maksimal 10 baris log, IP mentah tidak pernah masuk log, dan 429 setelah budget per IP habis.
- `tests/unit/proxy-location.test.ts` (4) — penjaga lokasi file konvensi. Memastikan aplikasi tetap di `src/app`, `src/proxy.ts` ada, dan **tidak ada** `proxy.ts` di root maupun `middleware.ts` yang tertinggal. Tes ini sengaja berupa asersi filesystem — bentuk yang tidak lazim — karena kegagalan yang dijaganya **tidak terlihat oleh apa pun**: build hijau, `tsc` hijau, manifest tetap kosong entah proxy hidup atau mati, dan seluruh gate keamanan mati tanpa satu pun peringatan (persis C6).

**Catatan keputusan**
- **CSP memakai helper Clerk, bukan header buatan sendiri.** `clerkMiddleware` sudah punya opsi `contentSecurityPolicy` yang menaruh nonce di **header request dan respons** sekaligus mengekspor `x-nonce`. Menulis ini manual berarti mengulang daftar host milik Clerk (frontend API, telemetry, `img.clerk.com`, Stripe, Google Maps, `challenges.cloudflare.com`) dan daftar itu akan basi setiap Clerk rilis. Helper-nya juga **menggabungkan** direktif kita dengan default-nya (union), jadi yang kita kontribusikan hanya penambahan.
- **`strict: true`.** Ini yang menghapus `http:`/`https:` dari `script-src` dan menambahkan `'strict-dynamic'`. `'unsafe-inline'` tetap tertulis di header karena Clerk memang menambahkannya, tapi browser **mengabaikannya** begitu ada nonce — jadi CSP-nya efektif seketat nonce, tanpa mematahkan inline style. `'unsafe-eval'` hanya muncul di build non-produksi.
- **Nonce memaksa seluruh aplikasi jadi dinamis, dan itu memang konsekuensinya.** `src/app/layout.tsx` membaca `headers()` untuk mengambil `x-nonce`. Efek sampingnya bagus: `/moderator` dan `/questions/practice` yang dulu **di-prerender statis** (dan karenanya akan mustahil diberi nonce) sekarang dirender per request. Ini bukan regresi yang tidak disadari — ini syarat teknis dari CSP nonce.
- **Nonce harus diteruskan ke dua komponen, bukan hanya Clerk.** `ClerkProvider nonce={…}` untuk tag pemuat clerk-js, dan `ThemeProvider nonce={…}` untuk skrip pra-hidrasi next-themes (0.4.6 menerima prop `nonce`). Di bawah `'strict-dynamic'` tag skrip di dokumen hanya dipercaya bila membawa nonce, jadi melewatkan salah satunya berarti kehilangan sign-in atau tema. `@vercel/analytics` tidak butuh perlakuan khusus: ia menyuntik skrip lewat `document.createElement` di `useEffect`, dan itu dipercaya oleh `'strict-dynamic'`.
- **CSP di `src/proxy.ts`, header statis di `next.config.ts`.** CSP tidak bisa ikut ke `next.config.ts` karena nonce harus segar per request, sedangkan `next.config.ts` dievaluasi sekali saat build. Header yang tidak bergantung request justru lebih murah di sana. Keduanya membaca **satu modul** (`src/lib/securityHeaders.ts`) supaya tidak bisa menyimpang satu sama lain; modul itu sengaja **tanpa import** karena `next.config.ts` dimuat di luar graf modul aplikasi.
- **`src/proxy.ts`, bukan `proxy.ts`.** Ini temuan paling penting di M9, dan bukan temuan tentang CSP. Proyek ini memakai `src/app`, jadi Next mencari file konvensi di dalam `src/`. Root `proxy.ts` — satu-satunya file yang tersisa setelah M2 — **tidak pernah dimuat**: build selesai tanpa error dan tanpa baris `ƒ Proxy (Middleware)` yang seharusnya muncul, jadi tidak ada satu pun peringatan. Artinya deny-by-default yang diklaim M2, penjaga CSRF, dan CSP M9 semuanya adalah kode mati. Pemindahan file adalah perbaikannya; ini juga alasan setiap klaim "middleware jalan" sebelum M9 tidak pernah benar-benar terbukti. Aturan umumnya masuk `AGENTS.md`, termasuk peringatan bahwa `middleware-manifest.json` **bukan** bukti apa pun di Next 16 + Turbopack.
- **`reportTo` wajib URL absolut.** Header `Reporting-Endpoints` menolak nilai relatif, jadi URL-nya dibangun dari request (`x-forwarded-proto` + `x-forwarded-host`/`Host`). Direktif `report-uri` lama tetap dikirim dengan URL yang sama untuk browser yang tidak pernah mengirim Reporting API.
- **CSRF membandingkan host, bukan origin penuh.** Skema tidak bisa dipercaya di belakang TLS termination (request bisa datang sebagai `http` sementara browser melihat `https`); membandingkan origin penuh akan menolak **setiap** mutasi produksi. Sebaliknya `Host` tidak bisa dipalsukan browser, dan port ikut terbaca di dalam string host. Origin yang tidak terurai (`null` dari iframe sandbox) **gagal tertutup**.
- **Penjaga CSRF jalan sebelum `auth()`.** Konsekuensi yang bisa diuji: request lintas situs ke endpoint terproteksi dijawab **403**, bukan 401 — pembuktian bahwa ia tidak pernah sampai ke cabang autentikasi.
- **Cookie `SameSite=Lax` bukan pengganti penjaga ini.** "Browser tidak akan mengirim cookie" adalah sifat browser, bukan sifat kode kita. Endpoint webhook (Svix) dan cron sengaja tidak punya `Origin`/`Sec-Fetch-Site` dan karena itu lolos — keasliannya dibuktikan tanda tangan, bukan origin.
- **`/api/csp-report` sengaja publik dan tidak menyimpan apa pun.** Tanpa penampung, CSP ketat menjadi tidak bisa dibuktikan salah: kita tidak bisa membedakan "tidak ada yang diblokir" dari "laporannya tidak pergi ke mana-mana". Ia hanya menulis satu baris log (`csp_violation`) per pelanggaran — field `original-policy` (seluruh header) sengaja dibuang, setiap string dipotong 200 karakter, dan satu request maksimal 10 baris. `data:` URI raksasa adalah alasan pemotongan itu.
- **`Cross-Origin-Opener-Policy: same-origin-allow-popups`.** Nilai `same-origin` akan memutus `window.opener` dan merusak alur OAuth berbasis popup milik Clerk ("Masuk dengan Google"). Ini nilai paling ketat yang masih kompatibel.
- **HSTS tanpa `preload`, dan hanya di produksi.** `preload` adalah pintu satu arah yang butuh pendaftaran ke daftar browser vendor; itu keputusan terpisah. Di build dev, HSTS tidak dikirim supaya `localhost` tidak terkunci ke https.
- **Utang yang masih terbuka:** beberapa route masih memakai `auth()` mentah alih-alih `requireUser()`/`requireModerator()` (`modules/submit`, `questions/submit`, `profile/status`, `profile/report`, `exams/create`, `questions/approved`, `moderator/auth-check`). Ini tidak membatalkan M9 (setiap route tetap punya pemeriksaan sesi), tapi menyeragamkannya adalah pekerjaan M14. `frame-src https:` masih membolehkan iframe ke host https mana pun — itu memang kebutuhan pembaca modul (Google Drive, Canva), dan dibatasi oleh fakta bahwa hanya moderator yang bisa menyetujui modul.
- **Efek samping deny-by-default yang perlu dicatat:** `Navbar` (`src/components/layout/Navbar.tsx:124`) memanggil `/api/moderator/auth-check` di setiap halaman, termasuk halaman publik. Sebelum M9 route itu dijalankan handler-nya; sekarang proxy menjawab **401** lebih dulu untuk pengunjung anonim. Tidak ada yang rusak — komponennya menangani respons non-OK dengan `res.ok ? res.json() : { isModerator: false }` — tetapi ini berarti satu request yang dijamin gagal di setiap page load anonim. Perbaikan yang benar (M14/M15): lewati fetch bila tidak ada sesi, atau pindahkan pemeriksaan role ke server component.

Sumber: `src/lib/securityHeaders.ts`, `src/lib/csrf.ts`, `src/app/api/csp-report/route.ts`, `src/proxy.ts`, `next.config.ts`, `src/app/layout.tsx`, `src/components/providers/ThemeProvider.tsx`, `src/lib/rateLimit.ts`.

#### M10 — Manajemen rahasia & supply chain ✅ SELESAI (2026-10-16)

**Temuan yang memicu milestone ini (C7):** `next@16.2.6` membawa **17 advisory**, 3 di antaranya CRITICAL, dan tidak ada apa pun di repo ini yang bisa memberi tahu. `npm audit` baru pertama kali dijalankan di M10.

**Deliverables**
- [x] `.env.example` lengkap dengan penjelasan tiap variabel — 10 variabel yang benar-benar dibaca kode, dipisah wajib / opsional / disuntik platform. Placeholder saja; `.env.local` memuat kredensial **live** (Clerk, Neon, Blob) dan tidak pernah masuk git. Dijaga `tests/unit/env-example.test.ts`, yang memindai **seluruh repo** (bukan hanya `src/**` — versi pertamanya begitu, dan itu diam-diam melewatkan `drizzle.config.ts`, file yang menentukan ke mana migrasi berjalan) untuk `process.env.X` dan gagal bila template ketinggalan. Variabel milik platform (`CI`, `ComSpec`, `LOCALAPPDATA`, `ProgramFiles`) dikecualikan lewat daftar eksplisit yang dikunci tesnya sendiri, sehingga menambah pengecualian kelima adalah edit yang terlihat, bukan pelebaran titik buta yang senyap.
- [x] `gitleaks` di pre-commit + CI. Hook `.githooks/pre-commit` (tanpa dependensi baru — `core.hooksPath` diatur `scripts/setup-git-hooks.mjs`, dipanggil otomatis oleh `prepare`), dan job `secret-scan` terpisah di CI dengan `fetch-depth: 0`. `.gitleaks.toml` memakai ruleset default dan membawa **satu** entri allowlist — kunci Stripe palsu di fixture redaksi log `tests/unit/logger.test.ts` — dan **tanpa** pengecualian `paths`. Versi pertama file ini membawa sepuluh regex dan dua pengecualian path; menjalankan binary sungguhan terhadap riwayat sungguhan (v8.30.1, seluruh riwayat: **72 commit, 2,43 MB, nol temuan**) menunjukkan riwayat itu hanya punya **satu** temuan default-ruleset, jadi sembilan regex mematikan tidak menahan apa pun dan kedua pengecualian path terbukti mubazir begitu diuji. Entri allowlist yang mati bukan tanpa biaya: ia titik buta yang tidak pernah ditinjau dan membuat daftar tak terbaca, jadi semuanya dihapus. CI **memasang gitleaks sendiri** (v8.30.1, sha256 diverifikasi terhadap `checksums.txt` rilis) alih-alih memakai `gitleaks/gitleaks-action`, karena action itu menuntut `GITLEAKS_LICENSE` untuk repo milik **organisasi** — dan pemilik repo ini adalah organisasi, jadi action tersebut akan gagal di run pertama. Wrapper juga memilih sintaks subcommand dari **versi** scanner, bukan dari exit code: `gitleaks` memakai kode 1 baik untuk "leaks found" *maupun* untuk "unknown command", sehingga fallback berbasis exit code membaca error sintaks sebagai temuan dan menuduh penulis punya kebocoran yang tidak ada. Tanpa gitleaks terpasang, hook **melewatkan diri dengan peringatan** dan exit 0 — scanner lokal yang hilang tidak boleh menghalangi commit, karena CI yang menjadi gerbang sebenarnya.
- [x] Dependabot + `npm audit` di CI. `.github/dependabot.yml` mencakup **npm dan github-actions** (action pihak ketiga juga rantai pasok), mingguan, dikelompokkan agar tidak membanjiri PR. Gerbangnya `scripts/audit-gate.mjs`, bukan `--audit-level=high` polos: HIGH/CRITICAL memblokir kecuali ada pengecualian yang ditulis alasannya, **dan pengecualian yang tidak lagi cocok dengan advisory mana pun juga memblokir** — supaya daftar pengecualian tidak membusuk menjadi pembebasan permanen. LOW/MODERATE dicetak sebagai informasi. Hasil akhir M10: pohon produksi `--omit=dev` berada di **0 critical / 0 high / 0 moderate** (2 low, keduanya `katex` bersarang di `react-katex`), dan daftar pengecualian gerbang **kosong** — lihat catatan keputusan soal `npm audit fix` di bawah.
- [x] `npm ci` di pipeline + lockfile konsisten. Sudah `npm ci` sejak M4; M10 menambah `tests/unit/ci-gates.test.ts` yang memastikan tidak ada yang menukarnya kembali ke `npm install`.
- [x] **CI membuktikan proxy benar-benar terdaftar**, bukan sekadar ada filenya — dua lapis, dan keduanya sengaja **tidak** memakai `middleware-manifest.json` (di Next 16 + Turbopack file itu tetap `{"middleware":{}}` entah proxy hidup atau mati):
  1. **Build-time:** `next build` ditulis ke `build.log` (dengan `set -o pipefail`, kalau tidak `tee` yang menentukan status pipeline), lalu CI memastikan baris `Proxy (Middleware)` ada. Yang di-grep substring ASCII-nya, bukan karakter `ƒ`, supaya encoding yang rusak tidak membuat langkah ini lolos secara semu.
  2. **Runtime:** `scripts/verify-proxy.mjs` menjalankan `next start` sungguhan dan menembak `GET /api/__proxy-smoke__` — path di bawah `/api` yang **tidak** diklaim route mana pun. Proxy hidup menjawab **401** (deny-by-default, tanpa pernah meng-import `src/db`); proxy mati akan menjawab **404** karena request lolos ke router. Responsnya juga harus membawa CSP bernonce, yang hanya bisa dihasilkan `src/proxy.ts`. Ini bukti yang jauh lebih kuat daripada baris build, dan inilah yang menutup C6 secara struktural. (**Catatan C8:** kedua lapis ini tidak pernah benar-benar dieksekusi di CI sampai akhir M10 — langkah `Build` selalu gagal lebih dulu karena `secrets.DATABASE_URL` tidak pernah dikonfigurasi; lihat catatan keputusan hermetik di bawah.)
- [ ] Lindungi branch `main` (required review + required status checks) — **tidak dikerjakan, dan tidak bisa dikerjakan dari sini.** Repo publik dan `gh` CLI tidak terpasang di mesin ini, jadi tidak ada cara menutupnya lewat commit; perintah `gh api` lengkapnya ada di `README.md` (bagian *Repository settings*). Checkbox ini sengaja dibiarkan **kosong**: selama ini belum dilakukan, CI M10 baru sebatas **saran**, dan commit merah — termasuk yang membawa rahasia — masih bisa di-merge. Dicatat juga sebagai utang terbuka di §8.

**Test baru**
- `tests/unit/env-example.test.ts` (16) — setiap variabel `process.env.*` yang dibaca kode ada di `.env.example`; negasi `!.env.example` di `.gitignore` masih ada (baris itu gampang terhapus dan `/.env*` akan menelan template-nya); template tidak memuat kredensial yang terlihat asli. Pemindaiannya menutupi **seluruh repo** dengan ekstensi JS/TS, jadi `drizzle.config.ts` dan `scripts/**` ikut terjaga, bukan hanya `src/**`. Tiga tes menjaga cakupan itu sendiri: daftar variabel platform harus sama persis dengan empat nama yang diketahui (detektor perubahan — daftar itu satu-satunya lubang di sapuan ini, jadi menambahnya harus terlihat saat review), tidak satu pun nama di daftar itu boleh muncul di template (kalau pernah, sapuannya berhenti memeriksa variabel yang sungguh dikonfigurasi tanpa ada yang gagal), dan `NODE_ENV`/`ComSpec` harus benar-benar terbaca — tanpa itu, penyempitan `SKIP_DIRS` atau ekstensi di masa depan bisa mempersempit sapuan kembali diam-diam.
- `tests/unit/ci-gates.test.ts` (21) — CI tetap memindai rahasia dengan `fetch-depth: 0`, tetap `npm ci`, tetap menjalankan gerbang audit, tetap membuktikan baris `Proxy (Middleware)`, **tidak pernah** menyentuh `middleware-manifest.json`, tetap memakai `set -o pipefail`, dan setiap `npm run <skrip>` yang dipanggil CI menunjuk berkas yang benar-benar ada. Tiga tes terakhir menjaga keputusan M10 yang paling mudah dibatalkan tanpa sadar: CI **memasang gitleaks sendiri** dan tidak boleh kembali ke `gitleaks/gitleaks-action`; checksum scanner yang diunduh harus diverifikasi (`sha256sum -c -`); dan `.gitleaks.toml` tidak boleh mendapat pengecualian `paths` kembali. Satu tes lagi mengunci hook-nya sendiri: ia harus ter-commit sebagai **100755** (git POSIX menolak menjalankan hook tanpa bit eksekusi — hanya memperingatkan lalu melanjutkan commit, dan Windows tidak punya bit itu untuk di-set) dan `.gitattributes` harus memaksa `eol=lf` untuk `.githooks/*` (shebang ber-CRLF bukan shebang, dan `core.autocrlf=true` adalah default Windows). Satu tes lagi adalah temuan C8: workflow **tidak boleh** memuat `secrets.` sama sekali, karena sejak M5 sampai M10 satu secret yang tidak pernah dikonfigurasi (`DATABASE_URL`) membuat **setiap** run merah di langkah `Build`, sehingga kedua gerbang proxy di atas tidak pernah dieksekusi sekali pun. Tes terakhir menutup sisi lain C8: `scripts/secret-scan.mjs` harus memeriksa `CI` dan **menolak lulus** bila gitleaks tidak ada atau terlalu tua, karena "pemindaian tidak berjalan" dan "pemindaian bersih" menghasilkan job hijau yang sama persis.
- `tests/unit/audit-gate.test.ts` (13) — keputusan gerbang audit, yang dipindah ke `scripts/audit-gate-lib.mjs` justru supaya bisa diuji (file `audit-gate.mjs` menjalankan `npm audit` begitu di-import). Dua perilaku yang dijaga: `via` berupa string biasa **bukan** advisory (kasus nyata `@clerk/shared` → `js-cookie`; menghitungnya akan membuat satu advisory tampak dua dan memaksa entri allowlist kedua yang tidak perlu), dan entri allowlist yang tidak lagi cocok dengan apa pun **harus** dilaporkan basi. Termasuk kasus severity turun ke LOW: advisory yang melemah tidak boleh menghidupkan kembali pengecualiannya. Satu tes terakhir mengunci keadaan akhir M10: allowlist kosong **dan** temuan kosong berarti lulus.

**Catatan keputusan**
- **Naik ke `next@16.4.2`, bukan patch 16.2.x.** Advisory SSRF Image Optimization / cache poisoning / metadata image baru tertutup di ≥16.3.8, dan `next/image` memang dipakai. Pin tetap **eksak** mengikuti konvensi repo. Hasil: 11 vuln (1 kritis / 6 tinggi) → **7 (0 kritis / 3 tinggi)**, dan `next` hilang sepenuhnya. Tiga HIGH yang tersisa itu kemudian ikut dihabiskan di milestone yang sama — lihat catatan `npm audit fix` di bawah — sehingga pohon produksi berakhir di **0 critical / 0 high / 0 moderate**.
- **`npm audit fix` non-force dijalankan, dan daftar allowlist dikosongkan sebagai hasilnya.** Awalnya gerbang M10 dikirim dengan **dua** pengecualian bertulis alasan: `js-cookie` dan `source-map-js`. Keduanya dihapus di hari yang sama, setelah diperiksa bahwa keduanya memang bisa dibereskan: `source-map-js` (build-time saja) cukup naik 1.2.1 → 1.2.2, dan penghalang `js-cookie` ternyata bukan advisory yang tak terselesaikan melainkan **pin eksak** — `@clerk/shared@4.12.0` mengunci `js-cookie` tepat di `3.0.5`. Karena `@clerk/nextjs@7.3.5` mendeklarasikan `@clerk/shared: ^4.12.0`, dan `@clerk/shared@4.40.0` mengunci `js-cookie` di `3.0.8`, membiarkan `@clerk/shared` mengambang sudah menyelesaikannya. `npm audit fix` **tanpa** `--force` mengubah 58 entri lockfile (0 paket ditambah, 0 dihapus) — seluruhnya di dalam rentang semver yang sudah dideklarasikan induknya, jadi **tidak ada satu pun spek di `package.json` yang berubah**; `@clerk/shared` 4.12.0 → 4.40.0 adalah satu-satunya lompatan yang menyentuh runtime. Yang penting: yang memaksa penghapusan entri itu adalah **gerbangnya sendiri**, bukan disiplin manual. Entri yang berhenti cocok dengan advisory apa pun akan menggagalkan build, dan itu persis yang terjadi — gerbang menolak lulus dengan dua entri basi sebelum keduanya dihapus. `--force` sengaja tidak dipakai: ia memasang versi di luar rentang yang dideklarasikan hulu, dan itu bukan pengecualian yang ditinjau, itu konflik versi yang disembunyikan.
- **`katex` 0.16.47 yang bersarang di `react-katex` dibiarkan, dan alasannya ditulis di sini.** `react-katex@3.1.0` mendeklarasikan `katex: ^0.16.0`, sedangkan perbaikannya ada di ≥0.18.2 — jadi satu-satunya jalan adalah `--force` yang menurunkan `react-katex` ke 2.0.2, sebuah perubahan breaking. Advisory-nya ber-severity **low** (prototype pollution yang melewati trust restriction), jadi ia tidak memblokir gerbang; ia muncul di keluaran informasional setiap run, dan itu memang tujuannya.
- **Gerbang ini sengaja hanya memeriksa pohon produksi (`--omit=dev`), dan pohon dev tetap kotor — itu keputusan, bukan kelalaian.** Perkakas dev tidak pernah dikirim ke siswa, jadi kerentanan di sana bukan risiko produk; memaksanya ke gerbang akan membuat gerbang merah permanen, dan gerbang yang selalu merah adalah gerbang yang tidak dibaca (lihat C7). Tapi angkanya harus ditulis di sini supaya tidak ada yang bingung menghadapi GitHub: pohon dev membawa **2 CRITICAL** (`vitest` — path traversal / arbitrary file read lewat `@vitest/mocker`; dan `tinypool` — prototype pollution yang berujung RCE, ikut masuk lewat `vitest`) plus **5 HIGH** dari satu rantai (`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`). **Dependabot menghitung pohon penuh, jadi daftar alert publik repo ini tidak akan pernah mencapai nol** selama keduanya berdiri — dan itu persis yang terlihat begitu M10 di-push: GitHub melaporkan **48** pada push pertama (angka yang masih memakai keadaan **sebelum** push, `next@16.2.6` masih terhitung di dalamnya) lalu **6** (2 critical / 3 moderate / 1 low) pada push berikutnya, sementara `npm audit` atas pohon penuh yang **sama** melaporkan **15** (2 critical / 5 high / 6 moderate / 2 low). Kedua angka itu benar menurut sumbernya dan **tidak saling menggantikan** — Dependabot dan `npm audit` memakai basis advisory dan pemetaan yang berbeda, dan angka di pesan push Dependabot juga bisa belum selesai diproses — jadi jangan pakai salah satunya untuk membantah yang lain. Yang penting, keduanya sepakat pada satu hal yang menentukan: **2 CRITICAL tetap ada, dan keduanya hanya di pohon dev.** Perbaikannya bukan `--force`: `vitest` harus naik **3.2.7 → 5.x** — lompatan mayor, dan pin 3.2.7 adalah keputusan M4 — sementara npm menyarankan `eslint-config-next` **turun** ke 14.2.35, yang absurd karena repo ini sudah di 16.4.2. Keduanya dicatat sebagai utang M14, bukan dikerjakan diam-diam di sini.
- **Pre-commit tanpa dependensi baru.** Husky akan melakukan hal yang sama dengan harga satu paket di tree setiap kontributor dan satu direktori `.husky/`. Yang dipakai: `.githooks/pre-commit` yang di-commit + `scripts/setup-git-hooks.mjs` (30 baris) yang mengatur `core.hooksPath`. Ia menolak menimpa `core.hooksPath` yang sudah diatur orang lain, dan tidak melakukan apa pun di CI. Hook-nya sendiri di-commit sebagai **100755 dengan LF**, dan `.gitattributes` memaksa `eol=lf` untuk `.githooks/*`. Keduanya perlu karena kegagalannya bisu dan tidak terlihat di diff: git POSIX menolak menjalankan hook tanpa bit eksekusi — ia hanya memperingatkan lalu melanjutkan commit, dan Windows tidak punya bit itu untuk di-set, jadi mode harus ada di commit, bukan di disk siapa pun — sedangkan shebang ber-CRLF (`#!/usr/bin/env sh\r`) bukan shebang, dan `core.autocrlf=true` adalah default Windows. Tanpa keduanya hook itu hidup hanya di mesin penulisnya dan mati di klon mana pun, yaitu bentuk kegagalan C6. Keduanya dikunci `tests/unit/ci-gates.test.ts`.
- **`gitleaks/gitleaks-action` ditinggalkan setelah dipastikan akan gagal di sini.** Anggapan awalnya "repo publik, jadi gratis" — dan itu salah: action memilih jalur lisensi berdasarkan **tipe pemilik**, bukan visibilitas, dan untuk pemilik bertipe organisasi ia keluar dengan kode 1 tanpa `GITLEAKS_LICENSE`. Pemilik repo ini adalah organisasi. Ia juga default ke gitleaks 8.24.3 dan hanya memindai rentang commit yang di-push, bukan seluruh riwayat. CI kini memasang binary-nya sendiri (versi dipin, sha256 diverifikasi terhadap `checksums.txt` rilis) dan menjalankan wrapper yang sama dengan hook lokal, sehingga CI dan pre-commit tidak bisa menyimpang satu sama lain.
- **Versi gitleaks dipin di CI, dan itu berarti utang bump manual.** Dependabot tidak mengelola variabel `env`, jadi `GITLEAKS_VERSION` tidak akan naik sendiri. Konsekuensinya disengaja: pemindai yang berubah di bawah build membuat build merah jadi ambigu. Bump-nya manual dan disengaja, setelah menjalankan versi baru terhadap riwayat repo ini.
- **`gitleaks`, bukan `trufflehog`.** `trufflehog` memverifikasi kredensial dengan memanggil layanan pihak ketiga; itu berarti CI mengirim kandidat rahasia ke internet. `gitleaks` sepenuhnya offline, cukup untuk kasus "ada yang men-commit `.env.local`".
- **Wrapper scanner gagal keras di CI bila binary-nya tidak ada.** Sebelumnya `scripts/secret-scan.mjs` hanya memperingatkan lalu `exit 0` saat gitleaks tidak ditemukan — perilaku yang benar untuk hook lokal, tetapi di CI artinya "pemindaian tidak berjalan" dan "pemindaian bersih" menghasilkan keluaran yang **sama persis**: job hijau. Karena job `Secret scan` di CI memang hijau sementara job `verify` merah (C8), tidak ada cara membedakan keduanya dari luar. Sekarang wrapper memeriksa `CI` dan keluar dengan kode **2** bila binary hilang atau lebih tua dari 8.19 — CI memasang gitleaks sendiri, jadi cabang itu tidak pernah sah di sana.
- **Job `verify` di CI dibuat hermetik — tidak membaca satu pun `secrets.*` — setelah ditemukan CI belum pernah hijau sekali pun (C8).** Sejak workflow ini mendarat di M5 sampai M10, **setiap** run gagal di langkah `Build` dalam 14–16 detik karena `secrets.DATABASE_URL` tidak pernah dikonfigurasi, dan **kedua gerbang proxy di atas selalu dilewati** — jadi klaim "CI membuktikan proxy hidup" di dokumen ini, sampai akhir M10, belum pernah dieksekusi. Akarnya: `src/db/index.ts` memanggil `neon()` di scope modul, dan `neon()` melempar untuk URL yang tidak ada **atau tidak bisa di-*parse***; `next build` meng-import modul route saat mengumpulkan page data, jadi ia butuh URL yang valid secara sintaks — bukan database yang bisa dihubungi. Placeholder yang dipakai: `postgresql://ci:ci@localhost:5432/ci`, `sk_test_ci_placeholder`, dan publishable key yang **diturunkan** (`pk_test_$(printf '%s' 'example.clerk.accounts.dev$' | base64 -w0)`) alih-alih ditulis literal, karena base64 dari domain `*.clerk.accounts.dev` selalu berentropi tinggi dan literalnya memicu `generic-api-key` — sedangkan meng-allowlist rule itu adalah satu-satunya pengecualian yang bisa menyembunyikan kunci sungguhan. Probe runtime memang **butuh** kunci yang bisa di-*parse*: dengan kunci kosong ia menjawab `500`, bukan `401`. Dijaga `tests/unit/ci-gates.test.ts`.
- **`hookTimeout` 60 → 120 detik (di luar rencana).** Saat menjalankan `npm run test:coverage` untuk milestone ini, `beforeAll` PGlite timeout **dua kali berturut-turut, di file yang berbeda tiap kali** (`authz-matrix`, lalu `abuse` + `modules-download`) — padahal setiap file itu hijau saat dijalankan sendiri. Diukur: satu boot PGlite memakan ~50 detik di mesin 2-core di bawah instrumentasi v8, jadi ambang 60 detik berada di dalam rentang derau. Ini bukan bug yang ditemukan audit, tapi kelas kegagalan yang sama dengan C6 dan C7: sebuah gerbang yang gagal acak akan dipelajari untuk di-*re-run*, bukan dibaca. Batasnya dinaikkan, dan biaya akarnya (12 boot terpisah, satu per file) sengaja dibiarkan — berbagi satu instance akan mengorbankan isolasi antar-test. **Kenaikan itu ternyata tidak pernah berlaku:** setiap berkas integrasi masih mengoper `60_000` sebagai argumen `beforeAll` miliknya sendiri, dan batas per-panggilan mengalahkan `hookTimeout` tanpa sepatah kata. Ketahuan di M11 saat `npm run test:coverage` menjatuhkan `migrations.test.ts` di 60 detik sementara berkas yang sama hijau di `npm test` — persis bentuk C6: sebuah setelan yang terlihat terkonfigurasi, padahal tidak. Literalnya dihapus dari 14 berkas, dan `tests/unit/ci-gates.test.ts` kini gagal bila ada berkas test yang menulis timeout inline lagi.

**Definition of Done:** `npm run audit:gate` lulus dengan **0 critical / 0 high / 0 moderate** di pohon produksi **dan** daftar pengecualian kosong; `npm run verify:proxy` lulus melawan `next start` sungguhan; hook pre-commit aktif di klon bersih tanpa langkah manual; `.env.example` menutup seluruh variabel yang dibaca kode; job `verify` di CI benar-benar **hijau** dan tidak membaca satu pun secret repo.

**Sisa yang tidak bisa diselesaikan dari kode:** branch protection `main` (butuh admin), dan GitHub secret scanning + push protection (butuh pengaturan repo).

---

### FASE 3 — PRIVASI & KEPATUHAN (target: 2–3 minggu)
*Kriteria keluar: seorang siswa bisa memahami, mengekspor, dan menghapus datanya tanpa menghubungi admin.*

#### M11 — Tata kelola data (UU PDP) ✅ SELESAI (2026-10-17)

**Deliverables**
- [x] Halaman `/privacy` dan `/terms` (bahasa Indonesia, bahasa sederhana untuk pelajar) — `/privacy` punya **11 bagian** (data apa yang disimpan, dasar pemrosesan, siapa yang bisa melihat, **tabel masa simpan**, hak subjek data, keamanan, cara menghubungi pengendali data) dan `/terms` **9 bagian** (aturan pemakaian, kepemilikan karya, moderasi). Keduanya publik di `PUBLIC_ROUTES` (`src/proxy.ts`), karena calon pengguna harus bisa membaca apa yang akan ia setujui **sebelum** punya akun, dan tautan yang dikirim ke siswa tidak boleh memantul ke halaman masuk. Tautannya ada di footer `src/app/layout.tsx` (tampil di **setiap** halaman, termasuk halaman masuk) dan di navbar. Tabel masa simpan **dirender dari `RETENTION_POLICY`**, bukan diketik ulang — lihat catatan keputusan.
- [x] Consent eksplisit saat sign-up (checkbox, tercatat timestamp + versi kebijakan) — tersimpan di `users.consent_policy_version` + `users.consent_accepted_at` (migrasi `0002_charming_venom.sql`). Yang menegakkannya bukan halaman pendaftaran melainkan **gerbang di `src/app/(dashboard)/layout.tsx`**: setiap halaman yang butuh akun berada di route group itu, dan sebuah layout berjalan sebelum halaman mana pun di bawahnya dirender, jadi apa pun cara akun dibuat (form Clerk, Google OAuth, atau baris lama yang belum pernah menyetujui) dashboard tidak dirender sampai consent versi yang berlaku terisi. Kotak centang di `ConsentForm` sengaja **tidak** tercentang bawaan dan tombolnya nonaktif sampai dicentang.
- [x] Halaman `/profile/privacy`: **Ekspor data saya** (JSON/CSV) dan **Hapus akun saya** — `GET /api/profile/export?format=json|csv` dan `POST /api/profile/delete`. Ekspor mengembalikan seluruh baris milik pengguna dengan setiap kolom **disebut namanya satu per satu** (sebuah `select()` tanpa daftar kolom akan otomatis ikut membawa kolom PII yang ditambahkan kemudian). CSV memakai bentuk panjang `kategori,kolom,nilai` — enam jenis data dengan kolom yang berbeda tidak bisa muat dalam satu header tanpa membuang data — dengan BOM di depan agar Excel membaca UTF-8 dan awalan `'` untuk menetralkan CSV injection. Hapus akun adalah **anonimisasi, bukan `DELETE FROM users`**: `clerk_id` menjadi tombstone unik `deleted:<uuid>`, identitas dikosongkan, `reports` + `points_log` dihapus, ujian buatan pengguna berganti nama menjadi "Anonim", dan karya (modul/soal) tetap ada karena dibaca siswa lain. Konfirmasi menuntut pengguna mengetik frasa `HAPUS AKUN SAYA`.
- [x] Kebijakan retensi tertulis + job pembersih (mis. `reports` ditutup → arsip 12 bulan → hapus) — `src/lib/retention.ts` memegang `RETENTION_POLICY` sebagai **satu-satunya sumber kebenaran**; tabel di `/privacy` dan `runRetention()` membaca angka yang sama, sehingga kebijakan yang dibaca pengguna tidak bisa menyimpang dari yang dijalankan mesin. Aturannya: `reports` 12 bulan, `points_log` 24 bulan, `submissions` 24 bulan. `POST /api/cron/retention` menjalankannya, dijadwalkan `vercel.json` pada `0 19 * * *` UTC (02.00 WIB).
- [x] Proses notifikasi insiden ≤ 72 jam; catat tanggung jawab internal — `docs/INCIDENT-RESPONSE.md`: definisi insiden (termasuk batas praktisnya: *apakah ada orang yang bisa melihat atau mengubah data yang bukan miliknya?*), **lima peran** yang dinyatakan sebagai jabatan — bukan nama orang — masing-masing wajib punya pengganti, empat tingkat keparahan dengan batas waktu (kritis: triase ≤ 4 jam, tutup celah ≤ 24 jam, beri tahu subjek ≤ 3×24 jam), alur deteksi → triase → pengendalian → pemberitahuan → penutupan, tabel sinyal deteksi yang **sudah ada** di platform (mis. `retention_run_failed`, `rate_limit_exceeded`, `csp_violation`), dan templat catatan tanggung jawab.

**Test baru**
- `tests/unit/policy.test.ts` (9) — versi kebijakan yang tersimpan hanya cocok bila **sama persis** dengan yang berlaku; `null`/`undefined`/string kosong berarti "belum setuju", bukan "setuju" dan bukan error. Ini predikat murni yang dibaca gerbang, jadi menguji langsung berarti menguji keputusan gerbangnya tanpa database.
- `tests/unit/retention.test.ts` (8) — `cutoffDate()` mengurangi **bulan kalender**, bukan 30×hari (selisihnya terlihat di Februari), dan `runRetention()` menghapus tepat baris yang lebih tua dari batas sementara baris yang lebih baru bertahan; menjalankannya dua kali bersifat idempoten; tabel yang sengaja **tidak** ikut retensi (`modules`, `questions`, `custom_exams`) tetap utuh.
- `tests/unit/account-data-csv.test.ts` (12) — bentuk panjang CSV, kutip yang benar untuk koma/kutip/baris baru di dalam teks, BOM, dan `csvCell()` menetralkan `=`, `+`, `-`, `@`, tab, dan CR di awal sel.
- `tests/integration/consent.test.ts` (15) — gerbang `DashboardLayout` diuji dengan memanggil layout-nya langsung (`next/navigation`'s `redirect` di-mock sebagai pelempar yang mencatat tujuan): sesi tanpa baris, baris tanpa consent, dan baris dengan consent **versi lama** semuanya diarahkan ke `/consent`; baris dengan versi berlaku dirender. `POST /api/consent/accept` menolak body tanpa `accept: true`, body yang menyebut versi lain, dan body dengan field karangan (`.strict()`), lalu menulis kedua kolom.
- `tests/integration/retention-job.test.ts` (13) — job benar-benar menghapus berdasarkan `RETENTION_POLICY` dan mengembalikan hitungannya; otorisasinya: `CRON_SECRET` tidak diset → **401** (gagal tertutup), token salah → 401, token benar → 200; `GET` → **405** dengan header `allow: POST`.
- `tests/integration/account-data.test.ts` (12) — ekspor memuat seluruh kategori data milik pengguna; hapus akun mengosongkan identitas, menghapus `reports` + `points_log`, menganonimkan ujian, dan **tidak** menghapus modul/soal miliknya.
- `tests/integration/migrations.test.ts` (+4, kini 13) — `0002_charming_venom.sql` dijalankan di atas database yang **sudah berisi baris `users`** sebelum kolom consent ditambahkan: barisnya bertahan, kedua kolomnya `NULL` (sehingga akun pra-M11 diminta menyetujui **sekali**, bukan diasumsikan sudah setuju), versi bisa diisi, dan versi yang melebihi `varchar(20)` ditolak — versi yang terpotong diam-diam akan selamanya tidak sama dengan konstanta dan meminta persetujuan berulang.
- `tests/integration/account-routes.test.ts` (16) — **lapisan HTTP** dari kedua hak subjek data, yang tidak disentuh `account-data.test.ts` karena berkas itu memanggil fungsinya langsung. Yang diuji hanya bisa diuji di route: `401` tanpa sesi dan `403` untuk sesi yang barisnya belum disinkronkan webhook; batas laju (3 unduhan/jam → `429` + `Retry-After`); JSON sebagai default dan sebagai fallback untuk `format` yang tidak dikenal; CSV dengan **tiga byte** `EF BB BF` di depan (`response.text()` membuang BOM, jadi pemeriksaan berbasis string akan lulus pada berkas yang tetap dibaca Excel sebagai Latin-1); dan untuk hapus akun: `415` untuk content-type non-JSON, `400` untuk body kosong / frasa salah / frasa dengan spasi ekstra / field tambahan, **`userId` milik orang lain ditolak sebelum `deleteAccountData` dipanggil**, urutan "anonimkan dulu, Clerk terakhir", `clerkDeleted: false` saat Clerk menolak, dan kegagalan menghapus objek foto tidak menggagalkan penghapusan.
- `tests/unit/ci-gates.test.ts` (+2, kini 23) — dua tripwire untuk kelas kegagalan "gerbang yang terlihat terpasang": (1) berkas test mana pun yang menulis timeout inline (`}, 60_000);`) membuat test ini gagal — lihat catatan M10, `hookTimeout` 120 detik ternyata tidak pernah berlaku karena setiap berkas integrasi menimpanya sendiri; (2) frasa `HAPUS AKUN SAYA` hanya boleh tertulis di `src/lib/accountConstants.ts`, karena salinan kedua di `accountData.ts` persis penyimpangan yang modul itu ada untuk mencegah — ubah satu literal dan tombol hapus berhenti bekerja tanpa satu pun error.

**Catatan keputusan**
- **Consent ditegakkan di layout, bukan di halaman pendaftaran.** `<SignUp>` milik Clerk hanya menampilkan kotak centang persetujuan bila opsi itu dinyalakan di dashboard Clerk — sebuah langkah manual di luar repositori yang tidak bisa diuji, dan yang bila terlupa akan menghasilkan akun tanpa persetujuan tanpa satu pun tanda. Gerbang di `src/app/(dashboard)/layout.tsx` menegakkannya di kode dan menangkap ketiga jalur masuk sekaligus: form Clerk, Google OAuth, dan baris lama. Efek sampingnya disengaja: **seluruh pengguna lama diminta menyetujui satu kali** — mereka memang belum pernah menyetujui kebijakan mana pun. Halaman `/consent` sengaja hidup **di luar** route group `(dashboard)`; kalau ia ikut dijaga gerbang yang sama, pengguna akan terjebak lingkaran pengalihan dan tidak akan pernah bisa menyetujui apa pun.
- **Versi kebijakan hidup di kode (`src/lib/policy.ts`), bukan sebagai default kolom.** Kalau teks kebijakan berubah secara material, cukup naikkan `POLICY_VERSION`, dan setiap baris yang menyimpan versi lama otomatis diminta menyetujui ulang. Menaruhnya sebagai default database akan membuat perubahan kebijakan menjadi migrasi, dan tanpa versi sebuah centang dari dua tahun lalu tidak bisa dibedakan dari centang hari ini.
- **Webhook Clerk tidak pernah menulis consent.** Sebuah webhook hanya tahu Clerk membuat akun; ia tidak tahu apakah pemiliknya benar-benar mencentang apa pun. Menulis `consent_accepted_at` dari sana berarti mencatat persetujuan yang tidak pernah diberikan — persis hal yang UU PDP larang. Nilai `legal_accepted_at` yang mungkin dikirim Clerk tetap dilaporkan ke log sebagai sinyal tambahan (`clerk_legal_consent_seen`) tetapi **tidak pernah** disimpan sebagai persetujuan versi kami, karena Clerk tidak tahu versi kami. Satu-satunya penulisnya adalah `POST /api/consent/accept`, dan route itu mengambil versi dari konstanta server — bukan dari body — sehingga klien tidak bisa mengaku menyetujui versi yang tidak pernah ada.
- **`RETENTION_POLICY` adalah satu array yang melayani dua pembaca.** Tabel di `/privacy` dirender dari array yang sama yang dipakai `runRetention()`. Kebijakan retensi yang ditulis di halaman tetapi tidak pernah dijalankan bukan kebijakan, ia janji; sebaliknya, job yang menghapus dengan angka yang berbeda dari yang dijanjikan halaman adalah kebijakan yang diam-diam berbohong. Satu array menghapus kemungkinan keduanya menyimpang. Tabel yang **sengaja tidak** ikut retensi adalah `modules`, `questions`, dan `custom_exams`: itu isi perpustakaan yang dibaca siswa lain, bukan catatan tentang satu orang, dan menghapusnya akan menghapus karya orang yang tidak terkait. Atribusinya diselesaikan lewat jalur hapus akun, bukan retensi.
- **Job retensi hanya menerima `POST`, dan `GET` dijawab 405.** Ini operasi destruktif. Sebuah `GET` bisa dipicu oleh apa pun yang menjelajahi tautan — prefetcher, crawler, atau tab yang tidak sengaja dibuka — dan operasi penghapus tidak boleh punya jalur picu yang tidak disengaja. Vercel Cron mengirim POST, jadi tidak ada yang hilang. Predikatnya ditulis sebagai `switch` eksplisit atas nama tabel yang bertipe, bukan dengan menyisipkan nama tabel sebagai string ke SQL: sebuah tabel yang ditulis sebagai string adalah tempat kesalahan ketik berubah menjadi penghapusan tabel yang salah.
- **`CRON_SECRET` yang kosong berarti 401 untuk semua orang — gagal tertutup.** Penjadwal tidak punya sesi, jadi `requireUser()` tidak berlaku dan satu-satunya gerbang adalah `Authorization: Bearer $CRON_SECRET`. Endpoint penghapus yang salah konfigurasi harus **mati**, bukan terbuka. `CRON_SECRET` yang tidak diset dicatat sebagai `cron_retention_misconfigured` (`error`) dan bukan `cron_retention_unauthorized` (`warn`), karena keduanya butuh tindakan yang berbeda pada tengah malam. Perbandingan tokennya memakai waktu-tetap yang ditulis tangan (tanpa `node:crypto`) supaya selisih waktu per karakter tidak membocorkan rahasianya.
- **Hapus akun adalah anonimisasi, bukan `DELETE FROM users`.** `modules.uploader_id`, `questions.uploader_id`, dan `submissions.submitter_id` semuanya `NOT NULL` dan menunjuk ke baris ini; menghapus barisnya akan menghapus karya siswa lain yang tidak terkait atau gagal karena foreign key. Jadi identitasnya dikosongkan dan karyanya menjadi milik "Anonim". `clerk_id` diganti tombstone unik `deleted:<uuid>` alih-alih dikosongkan: kolomnya `NOT NULL UNIQUE`, dan tombstone menjaga dua properti sekaligus — baris itu tidak bisa lagi dipetakan ke akun mana pun, dan akun Clerk baru tidak pernah bisa secara tidak sengaja mengambil alih baris lama ini. Kolom consent ikut dikosongkan: tanpa identitas, tidak ada dasar pemrosesan yang tersisa untuk dicatat.
- **Penghapusan berjalan berurutan, bukan transaksional, dan urutannya disengaja.** Neon HTTP tidak punya transaksi. Karena itu data lokal dianonimkan **lebih dulu** dan akun Clerk dihapus **terakhir**: kalau langkah terakhir gagal, pengguna sudah tidak punya data pribadi di database kami dan kegagalannya tercatat (`account_deletion_clerk_failed`) — kebalikannya, akun Clerk hilang tetapi datanya masih ada, adalah kegagalan yang jauh lebih buruk karena tidak ada lagi cara memperbaikinya.
- **Identitas yang dihapus diambil dari sesi, bukan dari body.** `POST /api/profile/delete` tidak punya field `userId` sama sekali — route ini tidak bisa dipakai untuk menghapus akun orang lain. Ekspor pun dijaga `requireUser()` → `rateLimit()` → baru membaca input, karena route handler **tidak** berada di bawah `(dashboard)/layout.tsx`, jadi gerbang consent tidak berlaku di sana.
- **CSV memakai bentuk panjang, dan itu pilihan sadar mengorbankan kerapian.** Ekspornya berisi enam jenis data dengan kolom yang sama sekali berbeda; CSV tidak punya konsep beberapa tabel, jadi pilihannya hanya membuang kolom sampai semuanya muat di satu header — yang berarti ekspornya tidak lengkap — atau bentuk panjang `kategori,kolom,nilai` yang bisa dibuka Excel, difilter, dan tidak kehilangan satu nilai pun. Kelengkapan menang, karena berkas ini adalah bukti.
- **Tautan privasi ada di navigasi utama, bukan terkubur di halaman profil.** UU PDP menuntut hak subjek data bisa **dilakukan**, bukan sekadar **ada**. Sebuah fitur ekspor yang tidak ditemukan sama saja dengan fitur yang tidak ada bagi pelajar. Karena itu ada entri navbar "Privasi" dan tautan "Privasi & Data" di halaman profil, dan pencocokan item aktif navbar diperbaiki menjadi per segmen (`pathname === href || pathname.startsWith(href + "/")`) supaya `/profile/privacy` tidak menyalakan `/profile` sekaligus.
- **`SECURITY.md` dan `docs/INCIDENT-RESPONSE.md` membagi dua peran yang berbeda.** `SECURITY.md` menjelaskan bagaimana **orang luar** melaporkan kerentanan (termasuk janji balasan 48 jam); `INCIDENT-RESPONSE.md` menjelaskan apa yang **kami** lakukan setelah laporan itu masuk, dengan batas waktu 3×24 jam yang dituntut UU PDP untuk pemberitahuan ke subjek data. Keduanya ditautkan satu sama lain agar tidak terbaca sebagai dua janji yang saling bertentangan.

**Verifikasi:** `npm test` → **473 test di 37 file, semuanya lulus** (dari 381/30 di akhir M10; +92 di M11). `npm run test:coverage` → **79,01% baris**, branch **85,96%**, fungsi **96,56%** pada cakupan `src/lib/**` + `src/app/api/**`; `profile/export` dan `profile/delete` naik dari **0%** ke 88% dan 90% baris, sementara `policy.ts`, `retention.ts`, `accountData.ts`, dan `accountConstants.ts` di 100%. `npx tsc --noEmit` bersih. Coverage **naik** dari 77,01% (M10) ke 79,01%, meski M11 menambah ~200 baris route yang tadinya nol test: tanpa `account-routes.test.ts` angkanya sempat 75,08% — turun, karena kode baru yang belum diuji ikut dihitung. Test route itulah yang mengembalikannya ke atas angka M10, bukan kode lama yang kehilangan test.

**Definition of Done:** setiap pengguna baru (dan setiap pengguna lama sekali saja) tidak bisa merender satu halaman pun di dalam `(dashboard)` sebelum mencentang persetujuan, dan persetujuan itu tersimpan bersama versi kebijakannya; seorang siswa bisa mengunduh seluruh datanya dalam JSON maupun CSV dan menghapus akunnya sendiri dari `/profile/privacy` tanpa menghubungi admin; `RETENTION_POLICY` ditampilkan di `/privacy` **dan** dieksekusi `POST /api/cron/retention` dengan angka yang sama, terjadwal di `vercel.json`; dan ada prosedur insiden tertulis dengan peran, batas waktu 72 jam, serta templat catatan tanggung jawab.

**Sisa yang tidak bisa diselesaikan dari kode:** menyetel `CRON_SECRET` di Vercel (produksi) dan memastikan penjadwal cron aktif; serta menyalakan (atau sengaja tidak menyalakan) kotak persetujuan ekspres di dashboard Clerk — gerbang kita tetap menegakkan consent tanpa itu, tetapi Clerk tidak akan memberi sinyal `legal_accepted_at`. Jalur `user.deleted` yang dulu dijanjikan untuk M12 sudah mendarat di M12.

#### M12 — Minimisasi data & PII hardening ✅ SELESAI (2026-10-17)

**Deliverables**
- [x] Hapus `email` dari endpoint apa pun yang tidak membutuhkannya; audit ulang tiap `select()` — hasil auditnya: `users.email` hanya disentuh **satu** route API (`webhooks/clerk`), dan itu benar karena Clerk-lah yang mengirimkannya. Yang ditemukan justru di tempat yang tidak dicurigai: **halaman** `profile/[id]/page.tsx` memanggil `db.query.users.findFirst({ where })` tanpa daftar kolom — sehingga `email` dan kedua kolom persetujuan UU PDP **diambil** untuk setiap profil yang dibuka siapa saja — lalu mengirim `clerkId` ke komponen klien, yang mencetak empat huruf terakhirnya pada sertifikat kontributor di halaman publik. Halaman itu juga memanggil `db.select().from(questions)`, yang menarik `answer_key` ke dalam halaman profil. Ketiganya diperbaiki: daftar kolom eksplisit, `email` tidak dibaca sama sekali, `clerkId` tetap dibaca (halaman membandingkannya dengan sesi) tetapi **tidak** diserialkan, dan fragmen sertifikat kini diambil dari `id` internal yang sudah menjadi bagian URL. `db.select()` tanpa daftar kolom kini **nol** di seluruh `src/`.
- [x] Redaksi PII di log & Sentry (`beforeSend`) — log sudah meredaksi berdasarkan **nama kunci** sejak M6 (`email`, `*name`, `clerkId`, `token`, `authorization`, `cookie`, `bio`, `motto`, `photo*`, `*ip*`), jadi tidak ada pekerjaan baru di sana; yang ditambahkan adalah invarian yang menjaganya (lihat `pii-surface.test.ts`). Sentry **tidak pernah dipasang** di repo ini — tidak ada `@sentry/*` di `package.json`, tidak ada `sentry.*.config.ts`, tidak ada `SENTRY_DSN` di `.env.example` — jadi `beforeSend` tidak punya objek untuk dikonfigurasi. Itu dicatat sebagai non-goal di bawah, bukan dikerjakan sebagai kode mati.
- [x] Enkripsi at-rest untuk kolom sensitif; `photoUrl` pindah ke storage terpisah — separuh yang bisa dikerjakan sudah selesai di **M8**: foto profil kini objek di Vercel Blob (`users.photo_url` hanya boleh `null` atau URL milik storage sendiri), bukan `data:` base64 di dalam kolom. Enkripsi kolom **sengaja tidak dikerjakan**; alasannya di bawah.
- [x] `user.deleted` di webhook → hapus/anonimkan data terkait (modul tetap ada, atribusi jadi "Anonim") — cabang `user.deleted` baru di `src/app/api/webhooks/clerk/route.ts`, memanggil `anonymiseAccountByClerkId()` di `src/lib/accountData.ts`. Fungsi itu **sama** dengan yang dipakai `POST /api/profile/delete`, sehingga kedua pintu penghapusan tidak bisa punya definisi "anonim" yang berbeda. Karya tetap ada; identitas menjadi `ANONYMOUS_DISPLAY_NAME`. Objek foto di Blob dihapus sebagai upaya terbaik (kegagalannya tidak menggagalkan anonimisasi). **Idempoten**: setelah anonimisasi `clerk_id` sudah menjadi `deleted:<uuid>`, jadi pengiriman ulang event yang sama tidak menemukan baris, menjawab `200` + `clerk_user_deleted_no_row`, dan tidak menulis audit kedua.
- [x] Audit log tabel baru: `audit_log(actor_id, action, entity, entity_id, before, after, created_at)` untuk setiap approve/reject/point-grant/role-change - migrasi `0003_panoramic_landau.sql`, tabel `src/db/schema.ts`, penulis tunggal `src/lib/auditLog.ts`. Yang diaudit: `content.approve` (modul & soal), `content.reject` (soal), `user.role_change` (`npm run db:promote`), dan `user.anonymise` (webhook & hapus mandiri). **Hibah poin otomatis tidak diduplikasi** — `points_log` sudah menjadi catatan lengkapnya, dan menyalinnya ke `audit_log` berarti dua tabel yang bisa berselisih. Tiga indeks: `(entity, entity_id)`, `(actor_id, created_at DESC)`, `(created_at DESC)`. Ada **pembaca**-nya juga: `GET /api/moderator/audit-log` (`requireModerator` + `rateLimit`), yang mengembalikan hanya id, aksi, dan skalar — tidak pernah nama atau surel.
- [x] Blokir akses tanpa login ke PII (menyelesaikan C4 & H2 secara permanen) — sudah tertutup sejak M1/M2 (guard di handler) dan M9 (deny-by-default di `src/proxy.ts`), jadi ini pekerjaan **verifikasi**, bukan perbaikan. `tests/integration/authz-matrix.test.ts` kini juga memuat `GET /api/moderator/audit-log`, sehingga route baru tidak bisa lahir tanpa penjaga.

**Test baru**
- `tests/unit/pii-surface.test.ts` (12) — tripwire statis, bukan test perilaku, karena yang dijaga adalah sifat kode sumber: `email` hanya boleh muncul di `webhooks/clerk` dan tidak pernah di `moderator/**`; tidak ada `db.select()` tanpa daftar kolom di `src/`; `audit_log` hanya di-insert dari `lib/auditLog.ts`; `recordAudit(` hadir di tiga route moderasi + `promote.ts`; tombstone `clerkId: \`deleted:` hanya di `lib/accountData.ts`; kedua pintu penghapusan memakai helper bersama; dan tiga pin regresi untuk temuan profil di atas. **Test ini menemukan pelanggaran sungguhan pada run pertamanya** — lihat catatan keputusan.
- `tests/integration/audit-log.test.ts` (13) — `recordAudit` menulis baris, menerima `actorId: null` untuk aksi sistem, dan mengembalikan `false` (bukan melempar) saat FK gagal; `listAuditEntries` menyaring, mengurutkan terbaru-dulu, dan menghormati batas; tiga route moderasi benar-benar menghasilkan baris audit — termasuk bukti bahwa `questions/reject` **tidak** menulis `points_log`; dan `GET /api/moderator/audit-log` mengembalikan jejak tanpa nama/surel serta `400` untuk `entity` karangan, `limit` di luar rentang, dan UUID yang tidak valid.
- `tests/integration/clerk-webhook.test.ts` (11) — tanda tangan Svix asli dihitung dengan `node:crypto`, bukan di-mock, sehingga verifikasi tanda tangan benar-benar berjalan: anonimisasi mengosongkan identitas, karya tetap, objek foto dihapus, kegagalan Blob tidak fatal, baris audit tertulis, event yang dikirim ulang tidak mengubah apa pun, `clerk_id` yang tidak dikenal menjawab `200`, tanda tangan salah `400`, header Svix hilang `400`, `CLERK_WEBHOOK_SECRET` kosong `500`, dan `user.created` tetap bekerja.
- `tests/integration/migrations.test.ts` (+7, kini 20) — `0003` dijalankan di atas database yang **sudah berisi** `users` dan `modules`: baris lama tidak tersentuh, tabel punya tepat delapan kolom, ketiga indeks ada, `actor_id` boleh `NULL` (CLI tidak punya baris `users`), kedua snapshot jsonb bolak-balik utuh, `actor_id` yang bukan pengguna sungguhan ditolak FK, dan jejak audit **bertahan** setelah aktornya dianonimkan.
- `tests/integration/account-data.test.ts` (+3, kini 15) — `anonymiseAccountByClerkId` menemukan dan menganonimkan, mengembalikan `found: false` untuk `clerk_id` yang tidak dikenal, dan `found: false` pada pengiriman ulang (idempotensi).
- `tests/integration/authz-matrix.test.ts` (+1) — `GET /api/moderator/audit-log` masuk daftar route terproteksi.

**Catatan keputusan**
- **Snapshot audit dibatasi pada skalar, dan itu batas yang ditegakkan tipe.** `AuditSnapshot = Record<string, string | number | boolean | null>`. Sebuah `jsonb` bebas akan menggoda orang menulis `before: userRow` — dan tabel audit yang menyimpan salinan baris `users` adalah **salinan kedua PII** yang tidak pernah ikut retensi maupun anonimisasi. Dengan tipe itu, yang bisa dicatat hanya id, status, peran, dan angka: cukup untuk menjawab "siapa mengubah apa, kapan, dari apa ke apa", tidak cukup untuk membocorkan apa pun.
- **`actor_id` sengaja tidak dikosongkan saat anonimisasi.** Foreign key-nya `ON DELETE no action` dan tidak pernah terpicu, karena jalur hapus akun **tidak menghapus baris `users`** — ia mengganti `clerk_id` menjadi tombstone. Jadi jejak audit bertahan justru karena keputusan M11 itu. Sebuah `NULL` di `actor_id` berarti aksi **sistem/CLI** (`npm run db:promote`), bukan "tidak diketahui".
- **Penulisan audit bersifat upaya terbaik dan tidak pernah menggagalkan aksi yang diaudit.** `recordAudit` mengembalikan `boolean` dan mencatat event `audit_write_failed` (level `error`, sehingga bisa di-alert dari log drain) alih-alih melempar. Neon HTTP tidak punya transaksi, jadi "tulis audit dan ubah data secara atomik" memang tidak mungkin; pilihannya hanya menggagalkan moderasi yang sudah terjadi, atau mencatat kegagalannya dengan keras. Yang kedua benar: keputusan moderasi tetap berlaku, dan operator melihat bahwa jejaknya hilang.
- **`GET /api/moderator/audit-log` ada supaya tabel ini bukan teater.** Tabel audit yang hanya bisa ditulis tidak memberi jaminan apa pun — tidak ada yang pernah membacanya, jadi kesalahannya tidak pernah terlihat. Endpoint baca ini dijaga `requireModerator()` (bukan `requireSession()`), punya anggaran laju sendiri, dan memvalidasi parameternya terhadap daftar `entity` **tertutup** serta UUID yang benar-benar UUID.
- **Enkripsi kolom adalah non-goal yang disengaja, dengan alasan.** Neon mengenkripsi volume penyimpanan dengan AES-256 dan seluruh koneksi memakai TLS; kunci itu tidak pernah ada di mesin aplikasi. Enkripsi kolom tingkat aplikasi akan menambah kunci yang harus disimpan **di suatu tempat** (KMS baru) untuk melindungi dari satu-satunya ancaman yang belum tertutup: pembaca langsung isi database. Tetapi `users.email` adalah **kunci pencarian** `ensureUser()` dan webhook, jadi mengenkripsinya menuntut blind index (HMAC deterministik) yang membuat kesamaan surel tetap bisa diuji — dan itu berarti dua representasi surel, satu di kolom terenkripsi dan satu di indeks, keduanya harus disamakan setiap kali skema berubah. Untuk platform sekolah tanpa data kesehatan/keuangan, biaya operasional itu lebih besar daripada pengurangan risiko. Yang **dilakukan** sebagai gantinya adalah yang benar-benar mengurangi permukaan: minimisasi (kolom tidak dibaca), pembatasan akses (deny-by-default), retensi (M11), dan audit (milestone ini).
- **Sentry `beforeSend` tidak bisa dikonfigurasi karena Sentry tidak ada.** Tidak ada `@sentry/*` di `package.json` dan tidak ada konfigurasi Sentry di repo. Menambahkan dependensi agar sebuah checklist bisa dicentang adalah cara paling mahal untuk menambah berat bundle tanpa menambah keamanan. Kalau M6 nanti memutuskan memasang Sentry, `beforeSend` **wajib** ikut di commit yang sama — dan `logger.ts` sudah punya daftar kunci yang harus diredaksi, yang bisa dipakai ulang sebagai sumbernya.
- **Tripwire statis menemukan pelanggaran sungguhan pada run pertama, dan itulah nilainya.** `pii-surface.test.ts` ditulis sebagai invarian, bukan sebagai test regresi untuk kode yang sudah benar — dan run pertamanya langsung gagal di `profile/[id]/page.tsx`. Empat kebocoran itu (email, `clerkId`, `answer_key`, kolom consent) sudah ada sejak sebelum M9 dan tidak pernah terlihat karena tidak satu pun muncul di HTML yang dirender: `email` dikosongkan untuk orang lain sebelum diserialkan, `clerkId` hanya dipakai empat huruf, dan `answer_key` tidak dirender sama sekali. Yang membuatnya berbahaya justru sifat itu — satu refactor menghapus satu ternary dan kebocorannya menjadi nyata. Gerbang yang hanya memeriksa keluaran akan meloloskannya; gerbang yang memeriksa **sumbernya** tidak.
- **CodeQL sudah aktif dan audit ini belum pernah menyebutnya.** Workflow `CodeQL` berjalan dari **default setup** GitHub (`dynamic/github-code-scanning/codeql`) — tidak ada berkas workflow di repo — dan setiap push menjalankan `Analyze (javascript-typescript)` serta `Analyze (actions)`, keduanya hijau. Ini melengkapi M10 (gitleaks) dengan analisis statis sisi GitHub, dan **tidak** tumpang tindih dengan baris §8 tentang *secret scanning + push protection*, yang merupakan fitur berbeda. Tidak ada yang perlu dikonfigurasi di repo; yang perlu diingat hanya bahwa hasilnya tidak muncul di `npm audit` maupun di `npm test`.

**Definition of Done:** tidak ada route API yang mengirim `users.email` kecuali webhook Clerk yang menerimanya; tidak ada satu pun `db.select()` tanpa daftar kolom di `src/`; akun yang dihapus dari dashboard Clerk ikut dianonimkan dengan hasil yang sama persis seperti hapus mandiri, dan pengiriman ulang event itu tidak mengubah apa pun; setiap approve, reject, dan role-change meninggalkan baris `audit_log` yang bisa dibaca moderator lewat API dan tidak memuat nama atau surel; dan ada test statis yang gagal bila salah satu sifat itu rusak di kemudian hari.

**Verifikasi:** `npm test` → **524 test di 40 file, semuanya lulus** (dari 473/37 di akhir M11; +51 di M12, dari 3 berkas baru dan tambahan di 3 berkas lama). `npx tsc --noEmit` bersih. Migrasi `0003` diverifikasi dua arah: `drizzle-kit generate` melaporkan tidak ada drift, dan `migrations.test.ts` menjalankannya di atas database yang sudah berisi baris. Angka coverage M12 **tidak** diukur ulang — mesin 2-core ini butuh ~10 menit untuk `test:coverage`, dan yang berubah hanya tambahan kode yang seluruhnya punya test; angka 79,01% baris di atas adalah pengukuran M11 dan tetap menjadi rujukan terakhir.

**Sisa yang tidak bisa diselesaikan dari kode:** enkripsi kolom tingkat aplikasi (non-goal, lihat di atas) dan `beforeSend` Sentry (tidak ada Sentry untuk dikonfigurasi).

---

### FASE 4 — PRODUK & DX KELAS PREMIUM (target: 6–8 minggu)

#### M13 — Arsitektur data & performa
- [ ] Hapus N+1 di `profile/status` (join tunggal atau `inArray` + peta).
- [ ] Leaderboard: agregasi di SQL, bukan muat-semua-lalu-filter di JS.
- [ ] Paginasi + `limit`/`cursor` di `/api/questions/approved`, `/api/exams/list`, leaderboard.
- [ ] Terapkan caching: `revalidate`/`unstable_cache` untuk data publik statis, `force-dynamic` hanya bila perlu.
- [ ] Ukur: p75/p95 latency per route sebelum & sesudah (bukti, bukan klaim).
- [ ] Target SLO: halaman utama < 1.5s p75, API baca < 300ms p95.

#### M14 — Pelunasan utang teknis & struktur
- [ ] Perbaiki encoding UTF-8 (mojibake `dY?`, `�s�`) di seluruh `src/`.
- [ ] Pecah komponen raksasa: `ProfileClient` (1.630) → ≥ 6 komponen; `practice` (1.526) → ≥ 5.
- [ ] Pindahkan evaluasi badge ke `src/lib/badges/` sisi server + unit test.
- [ ] Hapus ketergantungan pada `localStorage` sebagai sumber kebenaran; server jadi pemilik data.
- [ ] Standarkan struktur: `src/server/{services,repositories,authz}`, `src/features/*`.
- [ ] Hilangkan `any` tersisa; aktifkan aturan ESLint `no-explicit-any`, `no-console` (kecuali logger).
- [ ] Tambahkan `loading.tsx` + `error.tsx` + `not-found.tsx` di setiap segmen.
- [ ] Lengkapi file konvensi tingkat aplikasi yang saat ini **tidak ada sama sekali**: `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/manifest.ts`, dan `icon`/`favicon.ico`. `public/` hanya berisi `icon-nawa.svg`, jadi tab browser memakai favicon default. Konsekuensi deny-by-default (M9): setiap route terproteksi menjawab 307 ke sign-in Clerk di origin lain, sehingga crawler tidak mengindeks apa pun kecuali landing page — tetapi tetap perlu `robots.ts` eksplisit agar `/api/**` tidak diprobe dan sign-in tidak dipromosikan ke mesin pencari.
- [x] Tutup **H13**: `api/exams/list` kini dijaga `requireUser()` + `rateLimit` + `limit` dan **tidak lagi mengirim kunci jawaban** — penilaian ujian buatan siswa pindah ke `POST /api/exams/submit` (baru) mengikuti pola M3, dan `api/modules/count` + `api/modules/download` mendapat penjaga `requireSession()` eksplisit. Ketiga route itu dulu **hanya** bergantung pada proxy; sebelum M9 ketiganya terbuka untuk anonim.

#### M15 — UX, aksesibilitas, dan bahasa
- [ ] Audit aksesibilitas (axe/Lighthouse): kontras, fokus, `aria`, navigasi keyboard, `prefers-reduced-motion`.
- [ ] Uji dengan screen reader pada alur inti (submit, kuis, profil).
- [ ] Design token terpusat (warna, radius, spacing) — hilangkan nilai acak di `className`.
- [ ] Internationalisasi: ekstrak string ke kamus (Indonesia sebagai default, Inggris siap).
- [ ] Empty/error/loading state yang konsisten di semua halaman.
- [ ] Halaman 404/500 yang ramah, bukan default Next.js.

#### M16 — Fitur kelas premium (pembeda)
Pilih berdasarkan bukti penggunaan, bukan asumsi:
- [ ] Analitik belajar per siswa: topik kuat/lemah, tren waktu, rekomendasi latihan.
- [ ] Ujian terjadwal dengan penilaian server + anti-kecurangan (bank soal teracak per sesi, token sesi).
- [ ] Kelas/rombel: guru menugaskan modul, memantau progres.
- [ ] Kolaborasi: komentar, review sebaya, moderasi berbasis laporan.
- [ ] Notifikasi (in-app + email) untuk approval, badge, dan pengingat harian.
- [ ] Billing/multi-tenant bila akan dipakai lintas sekolah (Stripe/Midtrans + pembatasan kuota per paket).

#### M17 — Operasional, dokumentasi, dan keberlanjutan
- [ ] Runbook: rotasi kunci, restore database, insiden, rollback deploy.
- [ ] ADR (Architecture Decision Records) untuk keputusan besar (Neon HTTP tanpa transaksi, gamifikasi role, dsb.).
- [ ] Onboarding engineer baru: `.env.example`, `CONTRIBUTING.md` yang benar-benar mengikuti alur, `docs/`.
- [ ] Perbarui `AGENTS.md` agar sinkron dengan kode (password, jumlah avatar, alur auth).
- [ ] Backup otomatis teruji (PITR Neon) + latihan restore terjadwal.
- [ ] SLA/SLO tertulis + post-mortem tanpa menyalahkan individu.

---

## 6. Urutan Eksekusi yang Disarankan

```
Minggu 1      M1 → M2 → M3 ✅                 (SELESAI — darurat sudah ditutup)
Minggu 2-5    M4 → M5 → M6 → M7 → M8 ✅       (fondasi + hardening: test, migrasi, observability, rate limit, validasi/unggahan)
Minggu 6-8    M9 ✅ → M10 ✅                 (hardening keamanan lanjutan: header/CSP/CSRF selesai; rahasia & supply chain selesai — temuan C7 ditutup di sini)
Minggu 9-11   M11 ✅ → M12 ✅                 (privasi & kepatuhan UU PDP — tata kelola data selesai)
Minggu 12-19  M13 → M14 → M15 → M16 → M17     (produk & kemampuan operasi)
```

### 5 hal yang jika hanya sempat dikerjakan 5
1. **M2** — RBAC terpusat. Tanpa ini, tidak ada yang lain berarti.
2. **M3** — Poin & kuis dinilai server. Ranking harus bisa dipercaya.
3. **M1** — Hapus endpoint debug/seed. Akses terbuka ke data siswa tidak bisa ditawar.
4. **M4** — Test + CI, agar bug di atas tidak kembali.
5. **M12 ✅** — Audit log & penghapusan data. Ini yang membedakan produk sekolah dari produk mainan.

---

## 7. Catatan Metodologi & Batasan

- Audit **awal** (2026-10-15) bersifat statis, tanpa menjalankan build, test, atau aplikasi — `node_modules` belum ter-install saat itu. Sejak 2026-10-16 dependensi sudah terpasang dan `.env.local` tersedia, sehingga `tsc --noEmit`, `eslint`, `npm test`, `next build`, dan `next start` sungguhan semuanya sudah dijalankan; temuan yang hanya muncul saat runtime kini punya bukti empiris, bukan dugaan.
- Sudah dilakukan sejak itu: **SCA** (`npm audit` + gerbang allowlist di CI), pemeriksaan header respons nyata (CSP/CSRF/HSTS diuji terhadap server yang benar-benar berjalan), pemindaian rahasia (`gitleaks`), dan verifikasi bahwa `proxy.ts` benar-benar terdaftar (dua sinyal independen).
- Belum dilakukan: pengujian penetrasi aktif, analisis bundle, dan pengujian beban.
- Klaim tentang perilaku Next.js 16 diverifikasi terhadap `node_modules/next/dist/docs/` (versi terpasang) sesuai instruksi di `AGENTS.md`; satu klaim yang **terbukti salah** — bahwa `middleware-manifest.json` bisa dipakai sebagai bukti proxy hidup — sudah dikoreksi di M9/M10.
- **Suite integrasi itu berat, dan biayanya bergantung perangkat.** Setiap file integrasi menyalakan Postgres WASM (PGlite) sendiri, dan di mesin 2-core ini satu `beforeAll` saja memakan sekitar 50 detik di bawah instrumentasi v8. Karena itu `hookTimeout` 60 detik **sempat gagal acak** — dua kali berturut-turut, di file yang berbeda tiap kali (`authz-matrix`, lalu `abuse` + `modules-download`), padahal semuanya hijau saat dijalankan sendiri. Batasnya dinaikkan ke 120 detik (lihat `vitest.config.ts`) dan dicatat sebagai utang: itu menutupi gejalanya, bukan menghilangkan biayanya. Kenaikan itu sendiri baru benar-benar berlaku di M11: sampai saat itu setiap berkas integrasi masih mengoper `60_000` ke `beforeAll`-nya masing-masing, dan batas per-panggilan mengalahkan `hookTimeout` tanpa peringatan — jadi angka 120 detik hanya ada di konfigurasi, bukan di eksekusi. Literalnya dihapus, dan `tests/unit/ci-gates.test.ts` sekarang menolak timeout inline di berkas test mana pun. Akar masalahnya — 12 boot PGlite terpisah, satu per file — sengaja **tidak** diubah, karena berbagi satu instance akan mengorbankan isolasi antar-test, dan isolasi itulah yang membuat tes ini bisa dipercaya. Akibat praktis: `npm run test:coverage` butuh ~10 menit di mesin ini, dan angka coverage di bawah diukur di sana, bukan di runner CI.
- **Perbedaan durasi test antara mesin ini dan runner CI sudah dijelaskan, bukan bug.** Langkah `Unit + integration tests` di CI selesai dalam **20 detik**, sementara `npm test` di mesin 2-core ini butuh ~276 detik. Sempat dicurigai suite-nya diam-diam di-skip di CI. Ternyata tidak: `vitest.config.ts` tidak punya filter maupun kondisi `process.env.CI`, tidak ada satu pun `it.skip`/`describe.skip`/`skipIf` di `tests/**`, dan `vitest run` gagal bila tidak ada berkas yang cocok — jadi job hijau berarti suite-nya benar-benar jalan. Penyebabnya dua hal yang terukur: tanpa instrumentasi v8, satu berkas integrasi di mesin ini turun dari ~50 detik ke **13–28 detik** (lihat durasi per berkas di keluaran `npm test`), dan runner CI punya 4 core, bukan 2.
- Skor adalah penilaian relatif terhadap standar produk SaaS komersial, bukan benchmark absolut.

---

## 8. Tindakan manual yang tidak bisa dilakukan dari kode

Beberapa kontrol keamanan hidup di **pengaturan GitHub atau dashboard pihak ketiga**, bukan di repositori, sehingga tidak bisa ditutup oleh commit mana pun. Ini daftar jujurnya — selama item di bawah belum dikerjakan, skor di atas adalah *kondisi yang bisa dicapai*, bukan *kondisi yang berlaku*.

| # | Tindakan | Di mana | Kenapa penting |
|---|---|---|---|
| 1 | **Branch protection `main`**: required review ≥1, required status checks (`Secret scan (gitleaks)`, typecheck/lint/test/build), `enforce_admins`, larang force-push & deletion | Settings → Branches, atau API (lihat `README.md`) | Tanpa ini, job CI M10 hanya **saran**. Commit merah — termasuk yang membawa rahasia — tetap bisa di-merge. Ini bukan kekhawatiran teoretis: CI ternyata **belum pernah hijau** dari M5 sampai M10 (C8) dan tidak ada apa pun yang menghentikan merge selama itu. |
| 2 | **Secret scanning + push protection** | Settings → Code security (gratis untuk repo publik) | Ini satu-satunya lapisan yang menangkap kasus yang `gitleaks` tidak bisa: developer yang tidak pernah memasang hook-nya. |
| 3 | **Dependabot alerts + security updates** | Settings → Code security | Advisory terhadap paket yang **sudah terpasang** membuka PR sendiri, tidak menunggu jadwal Senin. Ini yang akan mencegah C7 terulang. |
| 4 | **Bot protection pada sign-up Clerk** | Dashboard Clerk | Rate limiting M7 membatasi endpoint sendiri; ia tidak menghentikan pendaftaran massal akun. |
| 5 | **Rotasi kredensial** jika `.env.local` pernah bocor | Dashboard Clerk / Neon / Vercel | Rotasi adalah satu-satunya langkah yang benar-benar mencabut akses; membersihkan riwayat git hanya menyembunyikan. |
| 6 | **`BLOB_READ_WRITE_TOKEN` di produksi** + smoke upload nyata | Dashboard Vercel | Tanpa token, `/api/uploads` menjawab 503 dengan sengaja (tidak ada fallback base64). Jalur unggahan belum pernah diuji di produksi. |

**Catatan:** pada mesin ini `gh` CLI **tidak terpasang** dan tidak ada token admin, jadi item 1–3 harus dikerjakan manual oleh admin organisasi. Perintah `gh api` lengkapnya ada di `README.md` bagian *Repository settings*.

**CodeQL sudah aktif, dan itu tidak perlu tindakan.** Workflow `CodeQL` berjalan dari **default setup** GitHub (`dynamic/github-code-scanning/codeql`), bukan dari berkas di repo, sehingga tidak terlihat di `git ls-files` dan tidak disebut di bagian mana pun sebelum M12. Setiap push menjalankan dua analisis — `Analyze (javascript-typescript)` dan `Analyze (actions)` — dan keduanya hijau. Ini **melengkapi** `gitleaks` (M10): gitleaks mencari rahasia di riwayat, CodeQL mencari pola berbahaya di kode. Ia juga **bukan** pengganti baris 2 di atas: *secret scanning + push protection* adalah fitur berbeda yang berjalan **sebelum** commit mendarat, sedangkan CodeQL berjalan sesudahnya. Yang perlu diingat hanya bahwa temuannya muncul di tab Security GitHub, bukan di `npm audit`, `npm test`, atau log CI mana pun.
