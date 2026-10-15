# NAWA-LEARN — Audit Teknis & Roadmap Menuju SaaS Premium

> Tanggal audit: 2026-10-15
> Commit: `0d88b45` — feat: enhance moderator and user role checks in submission routes
> Stack: Next.js 16.2.6 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind 4 · Clerk 7 · Drizzle 0.45 + Neon HTTP · Zod 4
> Catatan: audit awal bersifat statis (`node_modules` belum ter-install saat itu). Pada 2026-10-16 dependensi sudah terpasang, `.env.local` tersedia, sehingga `tsc --noEmit`, `eslint`, `npm test`, dan **`next build`** semuanya sudah bisa dijalankan dan dipakai untuk memverifikasi M1–M4.

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
| Keamanan (authz) | 6 / 10 | RBAC terpusat + deny-by-default, 8 endpoint review dijaga, matriks 401/403 teruji. Kurang: rate limiting, security header, validasi input di beberapa route. |
| Integritas data | 6 / 10 | Poin & skor dinilai server, idempotensi lewat constraint DB, kunci jawaban tidak lagi bocor. Kurang: constraint & indeks tambahan, soft delete. |
| Privasi & kepatuhan | 2 / 10 | Tidak ada consent, retensi, export/delete, atau kebijakan privasi (UU PDP). |
| Observability | 2 / 10 | Hanya `console.log`, tanpa error tracking, tanpa health check. |
| Testing & CI | 7 / 10 | 108 test (unit + integrasi PGlite), CI workflow, coverage 63.74%, `next build` terverifikasi. Kurang: E2E, dan ~10 route masih 0% coverage. |
| Dokumentasi | 5 / 10 | README rapi, tapi `AGENTS.md` sudah drift dari kode. |

**Estimasi jarak ke "premium":** 3 fase kerja, ~16 milestone. Fase 0 (M1–M3) bersifat darurat dan **harus selesai sebelum platform dipakai lebih luas lagi**, karena saat ini satu akun siswa terautentikasi bisa mengangkat dirinya ke puncak leaderboard dan menyetujui kontennya sendiri.

> **Status per 2026-10-16:** Fase 0 **selesai** — M1 (`52bba95`), M2 (`1f5a6c7`), H12 (`836107f`), M3 (`dcb9b84`). M4 (test + CI) juga **selesai**: 108 test hijau, CI aktif, `next build` terverifikasi. Otorisasi approval, kebocoran kunci jawaban, dan integritas poin/ranking sudah ditutup. Yang tersisa: E2E, dan seluruh Fase 1+ (M5 ke atas).

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

**Perbaikan:** hapus semuanya dari repo. Debugging pakai observability (M6), bukan endpoint publik. `insert_data.ts` sudah jadi versi script yang benar — pakai itu.

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

### C6. Middleware proteksi route tidak berfungsi — ✅ SELESAI di M2

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

**Perbaikan:** satu file saja (`proxy.ts`), daftar route diperbaiki, dan terapkan *deny-by-default*: lindungi semua route API kecuali daftar yang memang publik.

---

## 2. Temuan Tinggi (P1)

### H1. `/api/profile/update` tanpa skema, tanpa batas, tanpa sanitasi
**Lokasi:** `src/app/api/profile/update/route.ts:26-46`

Iterasi kunci yang "diizinkan", tapi nilai dilewatkan mentah. Tidak ada Zod. Akibatnya:
- `photoUrl` = data-URL base64 sebesar apa pun. Cek 2MB hanya ada di klien (`ProfileClient.tsx:215`) dan mudah dilewati → **bloat Postgres**, dan karena `photoUrl` juga dikirim ke halaman leaderboard, satu pengguna bisa membengkakkan payload 100 user sekaligus.
- `motto` melebihi `varchar(200)` → error 500, bukan 400 yang informatif.
- `avatarIndex` bisa negatif atau di luar `AVATAR_OPTIONS.length`.

### H2. `/api/moderator/hidden-badges` membocorkan data semua user tanpa autentikasi — ✅ SELESAI di M2
**Lokasi:** `src/app/api/moderator/hidden-badges/route.ts:8`

Tidak ada `auth()` sama sekali. Mengembalikan `id`, `name`, `points`, `createdAt`, dan jumlah kontribusi **seluruh siswa**, bisa dipanggil siapa pun. Ini PII yang tidak perlu dipublikasikan. Selain itu, evaluasi badge dilakukan di klien (`moderator/page.tsx:145`, `badges.ts` 973 baris) — logika seharusnya di server.

### H3. `/api/exams/create` bisa dipakai tanpa login
**Lokasi:** `src/app/api/exams/create/route.ts:32-41`

`clerkId` boleh `null`; `authorName` fallback ke `"Siswa SMAN 2"`. Siapa pun bisa membanjiri database dengan ujian custom berisi 50 soal JSON. Vektor spam/abuse + penyimpanan. Juga tidak ada moderasi konten buatan siswa.

### H4. `/api/modules/download` bisa dipakai tanpa login & tanpa validasi UUID
**Lokasi:** `src/app/api/modules/download/route.ts:7-18`

Menambah counter untuk UUID apa pun, tanpa autentikasi, tanpa rate limit. Angka unduhan menentukan badge ("Hundred Downloads") dan omzet sinyal sosial → mudah dimanipulasi. UUID invalid → error 500 alih-alih 400.

### H5. Webhook Clerk tidak lengkap & tidak idempoten
**Lokasi:** `src/app/api/webhooks/clerk/route.ts:69-117`

- Tidak menangani `user.deleted` → data siswa yatim selamanya (pelanggaran retensi/privacy).
- `user.updated` menulis `email` tanpa menangani bentrok `UNIQUE` → 500 dan event hilang.
- Re-link berdasarkan email (`:76-86`) menautkan ulang akun ke `clerkId` baru; di migrasi dev→prod ini OK, tapi sebagai jalur produksi permanen ia membuka pintu pengambilalihan akun jika verifikasi email pernah dilonggarkan.
- Tidak ada idempotensi berbasis `svix-id` → Clerk mengirim ulang = efek ganda.

### H6. `next.config.ts` mengizinkan gambar dari host apa pun
**Lokasi:** `next.config.ts:4-11`

```ts
images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] }
```
Next.js image optimizer akan mem-fetch URL apa pun yang diminta → **SSRF / open image proxy** atas nama domain Anda (biaya bandwidth + potensi probing jaringan internal). Ganti ke daftar hostname eksplisit (`drive.google.com`, `res.cloudinary.com`, dll.).

### H7. Tidak ada rate limiting di mana pun
Semua endpoint bisa dipanggil ribuan kali per detik: submit modul/soal, kirim laporan, klaim poin, increment download, dan login. Wajib ada pembatasan per IP + per user (Upstash Ratelimit / @vercel/firewall).

### H8. Tidak ada security header
Tidak ada CSP, HSTS, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, atau `Permissions-Policy`. Situs bisa di-iframe (clickjacking), dan tanpa CSP setiap celah XSS jadi jauh lebih berbahaya.

### H9. Skema database tanpa migration, langsung `push` ke produksi — 🔶 SEBAGIAN (M4: migrasi berversi sudah di-generate; workflow produksi belum)
**Lokasi:** `package.json:10`, `drizzle.config.ts:10-11`

`"db:push": "drizzle-kit push"` dan folder `src/db/migrations` tidak pernah ada. Tidak ada riwayat perubahan, tidak ada rollback, tidak ada review perubahan skema. Untuk produk dengan data siswa ini tidak bisa diterima.

**Sisa yang belum:** `src/db/migrations/` sekarang ada dan dipakai test, tapi database produksi belum pernah di-baseline. Lihat catatan di M5 — migrasi tidak boleh dijalankan mentah ke DB yang sudah dibuat lewat `push`.

### H10. Nol test, nol CI — ✅ SELESAI (M4: 101 test unit + integrasi, CI workflow)
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

---

## 3. Privasi & Kepatuhan (UU PDP No. 27/2022)

Ini platform sekolah dengan **data anak/siswa**. Kategori data ini menuntut perlindungan lebih tinggi, dan saat ini hampir tidak ada kontrol yang relevan.

| Kewajiban | Status | Bukti |
|---|---|---|
| Dasar pemrosesan & persetujuan (consent) | ❌ Tidak ada | Tidak ada halaman/checkbox consent saat sign-up. |
| Kebijakan Privasi | ❌ Tidak ada | Hanya `SECURITY.md`; tidak ada `/privacy`. |
| Hak akses & ekspor data (DSR) | ❌ Tidak ada | Tidak ada endpoint export. |
| Hak penghapusan data | ❌ Tidak ada | Tidak ada `user.deleted`, tidak ada delete account. |
| Pembatasan retensi | ❌ Tidak ada | `reports`, `pointsLog`, `submissions` tumbuh selamanya. |
| Minimisasi data | ❌ Lemah | Email, foto base64, dan seluruh aktivitas poin tersimpan tanpa limit. |
| Kontrol akses ke PII | ❌ Buruk | C2, C4, H2 membocorkan nama/email/poin. |
| Audit trail akses data | ❌ Tidak ada | Tidak ada log siapa membaca/mengubah data siapa. |
| Notifikasi insiden | ⚠️ Hanya janji | `SECURITY.md` menjanjikan respons 48 jam, tanpa proses internal. |

Tambahan: `AGENTS.md` mendokumentasikan password moderator default di repo publik — kebocoran kredensial lewat dokumentasi.

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
- Tidak ada `.env.example` → onboarding sulit, rawan salah konfigurasi (`CLERK_WEBHOOK_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_CLERK_*`).
- 7 pemanggilan `console.log/error` produksi, beberapa mencetak objek user.
- `catch (error: any)` di beberapa tempat (`api/seed/route.ts:73`, `ProfileClient.tsx:237`).
- Drift dokumentasi: `AGENTS.md` bilang password `nawa2024`, kode bilang `nawa2026`; `AGENTS.md` menyebut "22+ avatar" sementara `avatars.ts` berisi 23.
- Tidak ada `Dependabot`/`Renovate`, tidak ada `npm audit` di CI → 33 dependency tanpa pemantauan CVE.

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
- [x] Buat `src/lib/authz.ts`: `requireUser()`, `requireRole(roles)`, `requireModerator()` + predikat murni `hasReviewerRole(role)` — mengembalikan union `{ok:true,user} | {ok:false,response}` (401 bila belum login, 403 bila peran tidak cukup / user belum tersinkron).
- [x] Terapkan di **semua** route approval/review/daily-create + seluruh queue moderasi.
- [x] Ambil `submitterId` (dan `moduleId`/`questionId`) **hanya** dari baris `submissions` di DB; field itu dibuang dari body.
- [x] Hapus `MODERATOR_PASSWORD` & flag `sessionStorage`; `isModerator` murni dari `users.role`.
- [x] Perbaiki matcher `proxy.ts` → **deny-by-default** terhadap path nyata.
- [x] Middleware menutup `moderator` dan seluruh `/api/**` non-publik (401 JSON untuk API, redirect untuk halaman).

**Definition of Done:** user `student` → 403 di endpoint review; tanpa login → 401; hanya `moderator`/`admin` sukses.
- [x] Wiring terverifikasi: 8/8 route review+queue memanggil `requireModerator()`; tidak ada `submitterId` dari body; tidak ada sisa password/`sessionStorage`.
- [x] `tsc --noEmit` exit 0; `eslint` bersih untuk seluruh file baru/ubah (sisa masalah adalah pra-eksisting).
- [ ] ⚠️ **Test otomatis untuk matriks 401/403 ditunda ke M4** (harness test belum ada). Bukti perilaku saat ini statis + manual.

**Catatan keputusan**
- `requireOwner(resourceId)` **tidak dibuat**: di semua route yang ada, kepemilikan diturunkan dari sesi (`clerkId`) atau dari baris `submissions`, jadi abstraksi itu akan jadi dead code. Akan ditambahkan saat ada resource yang benar-benar butuh.
- Bonus keamanan (overlap M3): approval kini **idempoten** — klaim `submissions` lewat `UPDATE ... WHERE status='pending'` sehingga submit yang sama tidak bisa di-approve dua kali (sebelumnya tiap klik menambah +50 poin lagi).
- Perubahan perilaku produk: karena deny-by-default, `/modules`, `/leaderboard`, `/profile/[id]` kini butuh login. Ubah allowlist `isPublicRoute` di `proxy.ts` bila ada yang memang harus publik.
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
- **Wajib dijalankan:** `npm run db:push` untuk membuat index unik baru. Tanpa itu, poin masih akan bertambah tapi idempotensi per-soal tidak aktif.
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
- **Temuan baru yang tercatat (belum dikerjakan):** `requireUser()`/`requireModerator()` baru dipakai di 8 route review + 2 route kuis. Route user-facing lain masih memakai `await auth()` mentah (`modules/submit`, `questions/submit`, `profile/update`, `profile/status`, `profile/report`, `exams/create`, `questions/approved`, `moderator/auth-check`). Konsekuensinya: route itu (a) tidak memverifikasi bahwa user benar-benar ada di tabel `users`, dan (b) memulangkan bentuk error yang berbeda-beda. Eksposur saat ini terbatas karena `proxy.ts` tetap menolak request tanpa sesi, tapi ini utang yang harus dibayar - kandidat kuat untuk M7/M9.

---

#### M5 - Migrasi database terkelola
**Deliverables**
- [ ] Ganti `db:push` dengan `drizzle-kit generate` + `drizzle-kit migrate`.
- [ ] Commit folder `src/db/migrations`; semua perubahan skema lewat PR.
- [ ] Tambah constraint: unique di `bookmarks`, `reviews`, `submissions`, `points_log`; `CHECK (rating BETWEEN 1 AND 5)`; `CHECK (avatar_index >= 0)`.
- [ ] Tambah indeks: `modules(status, subject)`, `questions(status, category)`, `users(season_points DESC)`, `points_log(user_id, action)`.
- [ ] Tambah `updatedAt` + soft delete (`deletedAt`) pada tabel konten.
- [ ] Hapus tabel tak terpakai (`reviews`, `bookmarks`) atau implementasikan dengan benar.
- [ ] Pisahkan seed ke `src/db/seed.ts` dengan environment guard.

> ⚠️ **Sudah sebagian dikerjakan lebih awal di M4** (karena test integrasi butuh DDL asli): `src/db/migrations/0000_*.sql` sudah ada, dan `npm run db:generate` sudah ditambahkan. **Jangan jalankan `drizzle-kit migrate` ke database produksi mentah-mentah** — tabelnya sudah dibuat lewat `push`, jadi migrasi akan gagal dengan "relation already exists". M5 harus: (1) menjalankan migrasi ini di database bersih untuk mendapat baseline, lalu (2) menandai migrasi 0000 sebagai sudah diterapkan di DB produksi (`__drizzle_migrations`), atau memakai `drizzle-kit push` sekali lagi untuk menyelaraskan lalu baseline. `db:push` **tetap dipakai** sampai langkah ini selesai — dan karena itu **`npm run db:push` masih wajib dijalankan** untuk membuat index unik M3.

**Definition of Done:** DB produksi bisa dibuat ulang dari nol hanya dengan `migrate` + `seed`; rollback teruji.

---

#### M6 — Observability
**Deliverables**
- [ ] Sentry (atau setara) untuk server + client, dengan `release` dan `user.id` (tanpa PII).
- [ ] Structured logging (pino) dengan `requestId`, level, dan redaksi PII.
- [ ] `GET /api/health` (DB + Clerk) untuk uptime monitor.
- [ ] Ganti seluruh `console.log` produksi.
- [ ] Dashboard dasar: error rate, p95 latency, poin/hari, submission/hari.

**Definition of Done:** Error yang sengaja ditanam muncul di Sentry dengan stack + requestId dalam < 1 menit.

---

### FASE 2 — HARDENING KEAMANAN (target: 3 minggu)

#### M7 — Rate limiting & anti-abuse
- [ ] Upstash Ratelimit di endpoint mutasi (submit, report, download, quiz, profile) — per user dan per IP.
- [ ] Persempit: 1 submit modul / menit, 5 laporan / jam, dll.
- [ ] Bot protection pada sign-up (Clerk sudah punya; aktifkan + CAPTCHA).
- [ ] Alarm otomatis bila pola abuse terdeteksi (lonjakan poin tak wajar).

#### M8 — Validasi & penanganan unggahan menyeluruh
- [ ] Zod schema untuk **setiap** endpoint; `safeParse` → 400 konsisten.
- [ ] Batas ukuran body per route (`avatarIndex` 0–22, `bio` ≤ 500, `motto` ≤ 200).
- [ ] Hentikan base64 di DB: unggah ke object storage (Vercel Blob / Cloudinary / S3) + URL + validasi tipe & ukuran di server.
- [ ] Sanitasi konten di semua titik render; jangan pernah `dangerouslySetInnerHTML` (saat ini aman, jaga agar tetap begitu).
- [ ] `next.config.ts`: ganti `hostname: '**'` dengan allowlist eksplisit.

#### M9 — Header keamanan, CSRF, dan sesi
- [ ] CSP ketat (nonce-based) + `report-uri`.
- [ ] HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'`.
- [ ] Verifikasi proteksi CSRF pada semua route mutasi berbasis cookie.
- [ ] Rotasi `CLERK_SECRET_KEY` bila pernah terekspos di file lokal/log.

#### M10 — Manajemen rahasia & supply chain
- [ ] `.env.example` lengkap dengan penjelasan tiap variabel.
- [ ] `gitleaks`/`trufflehog` di pre-commit + CI.
- [ ] Dependabot/Renovate + `npm audit --production` di CI.
- [ ] `npm ci` (bukan `npm install`) di pipeline; commit lockfile konsisten.
- [ ] Lindungi branch `main` (required review + required status checks).

---

### FASE 3 — PRIVASI & KEPATUHAN (target: 2–3 minggu)
*Kriteria keluar: seorang siswa bisa memahami, mengekspor, dan menghapus datanya tanpa menghubungi admin.*

#### M11 — Tata kelola data (UU PDP)
- [ ] Halaman `/privacy` dan `/terms` (bahasa Indonesia, bahasa sederhana untuk pelajar).
- [ ] Consent eksplisit saat sign-up (checkbox, tercatat timestamp + versi kebijakan).
- [ ] Halaman `/profile/privacy`: **Ekspor data saya** (JSON/CSV) dan **Hapus akun saya**.
- [ ] Kebijakan retensi tertulis + job pembersih (mis. `reports` ditutup → arsip 12 bulan → hapus).
- [ ] Proses notifikasi insiden ≤ 72 jam; catat tanggung jawab internal.

#### M12 — Minimisasi data & PII hardening
- [ ] Hapus `email` dari endpoint apa pun yang tidak membutuhkannya; audit ulang tiap `select()`.
- [ ] Redaksi PII di log & Sentry (`beforeSend`).
- [ ] Enkripsi at-rest untuk kolom sensitif; `photoUrl` pindah ke storage terpisah.
- [ ] `user.deleted` di webhook → hapus/anonimkan data terkait (modul tetap ada, atribusi jadi "Anonim").
- [ ] Audit log tabel baru: `audit_log(actor_id, action, entity, entity_id, before, after, created_at)` untuk setiap approve/reject/point-grant/role-change.
- [ ] Blokir akses tanpa login ke PII (menyelesaikan C4 & H2 secara permanen).

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
Minggu 2-5    M4 → M5 → M6                    (fondasi: test, migrasi, observability)
Minggu 6-8    M7 → M8 → M9 → M10              (hardening keamanan)
Minggu 9-11   M11 → M12                       (privasi & kepatuhan UU PDP)
Minggu 12-19  M13 → M14 → M15 → M16 → M17     (produk & kemampuan operasi)
```

### 5 hal yang jika hanya sempat dikerjakan 5
1. **M2** — RBAC terpusat. Tanpa ini, tidak ada yang lain berarti.
2. **M3** — Poin & kuis dinilai server. Ranking harus bisa dipercaya.
3. **M1** — Hapus endpoint debug/seed. Akses terbuka ke data siswa tidak bisa ditawar.
4. **M4** — Test + CI, agar bug di atas tidak kembali.
5. **M12** — Audit log & penghapusan data. Ini yang membedakan produk sekolah dari produk mainan.

---

## 7. Catatan Metodologi & Batasan

- Audit bersifat **statis**, tanpa menjalankan build, test, atau aplikasi. Karena `node_modules` belum ter-install, `tsc --noEmit` dan `eslint` tidak dijalankan; kemungkinan masih ada temuan yang hanya muncul saat runtime.
- Belum dilakukan: pengujian penetrasi aktif, audit dependency (SCA), pemeriksaan header respons nyata, dan analisis bundle.
- Belum diverifikasi terhadap `node_modules/next/dist/docs/` (tidak tersedia). Semua klaim tentang perilaku Next.js 16 (mis. penggantian `middleware` → `proxy`) harus dikonfirmasi terhadap dokumentasi versi yang terpasang sesuai instruksi di `AGENTS.md`.
- Skor adalah penilaian relatif terhadap standar produk SaaS komersial, bukan benchmark absolut.
