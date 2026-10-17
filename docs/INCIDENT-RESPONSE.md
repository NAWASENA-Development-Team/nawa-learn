# Prosedur Penanganan Insiden Data Pribadi

**NAWA-LEARN — OSIS NAWASENA SMAN 2 Jonggol (Divisi ICT)**

| | |
|---|---|
| Versi | 1.0 |
| Berlaku sejak | 17 Oktober 2026 |
| Dasar hukum | UU No. 27/2022 tentang Pelindungan Data Pribadi, Pasal 46 |
| Pemilik proses | Ketua OSIS NAWASENA (penanggung jawab akhir), dijalankan oleh Divisi ICT |
| Dokumen terkait | `SECURITY.md` (cara melaporkan kerentanan), `docs/AUDIT-AND-ROADMAP.md` §3, halaman `/privacy` |

Dokumen ini adalah prosedur **internal**: siapa yang melakukan apa, dalam berapa lama, ketika
data pribadi siswa bocor, hilang, atau diakses tanpa hak. `SECURITY.md` menjelaskan bagaimana
orang luar melaporkan kerentanan; dokumen ini menjelaskan apa yang kita lakukan setelah
laporan itu masuk — atau setelah kita sendiri yang menemukannya.

---

## 1. Apa yang dihitung sebagai insiden

Insiden data pribadi adalah setiap peristiwa yang mengakibatkan data pribadi **diakses,
diungkap, diubah, atau hilang tanpa hak**. Termasuk:

- Kredensial bocor ke repositori publik atau tempat yang bisa dibaca orang lain
  (`.env.local`, token Vercel Blob, `CLERK_SECRET_KEY`, `DATABASE_URL`, `CRON_SECRET`).
- Akses tanpa hak ke database atau ke penyimpanan berkas (Neon / Vercel Blob).
- Kebocoran satu siswa membaca data siswa lain — misalnya kunci jawaban, surel, atau
  jawaban ujian buatan orang lain — lewat celah otorisasi.
- Kehilangan data karena penghapusan yang tidak disengaja atau kegagalan migrasi.
- Perubahan kode oleh pihak yang tidak berhak.

**Bukan** insiden data pribadi, tetapi tetap dicatat dan ditangani sebagai gangguan biasa:
situs mati, kesalahan tampilan, atau bug yang tidak menyentuh data siapa pun.

> Batas praktisnya satu pertanyaan: *apakah ada orang yang bisa melihat atau mengubah data
> yang bukan miliknya?* Jika ya, anggap insiden sampai terbukti sebaliknya.

---

## 2. Peran dan tanggung jawab

Jabatan, bukan nama orang — pembagian ini tidak boleh bergantung pada siapa yang sedang
menjabat. Satu orang boleh memegang lebih dari satu peran; yang penting setiap peran punya
pemilik yang jelas **sebelum** insiden terjadi.

| Peran | Pemegang | Tanggung jawab dalam insiden |
|---|---|---|
| **Penanggung jawab akhir** | Kepala Sekolah | Memutuskan tingkat keparahan, menyetujui isi pemberitahuan, mewakili sekolah ke luar (dinas, orang tua). |
| **Koordinator insiden** | Wakil Kesiswaan | Memimpin rapat triase, menjaga jadwal 1×24 jam / 3×24 jam, memutuskan eskalasi. |
| **Pelaksana teknis** | PIC ICT (Divisi ICT OSIS) | Menyelidiki akar masalah, menutup celah, merotasi kredensial, mengembalikan layanan. Menulis kronologi. |
| **Penghubung pengguna** | Ketua OSIS | Menyusun dan mengirim pemberitahuan ke siswa yang terdampak; menjadi titik kontak pertanyaan. |
| **Pendamping & penasihat** | Guru pendamping OSIS | Memastikan keputusan mempertimbangkan kepentingan siswa; meninjau bahasa pemberitahuan agar bisa dipahami pelajar. |

**Wajib ada pengganti.** Setiap peran punya satu nama cadangan yang ditulis di papan pengurus
OSIS periode berjalan. Sebuah prosedur yang berhenti karena satu orang sedang ujian bukan
prosedur.

---

## 3. Tingkat keparahan

| Tingkat | Definisi | Contoh | Batas waktu |
|---|---|---|---|
| **Kritis** | Data pribadi siswa terbuka untuk umum, atau bisa diakses tanpa hak dalam skala banyak akun. | `DATABASE_URL` atau `CLERK_SECRET_KEY` ter-commit; endpoint tanpa otorisasi mengembalikan data siswa. | Triase **≤ 4 jam**, tutup celah **≤ 24 jam**, beri tahu subjek **≤ 3×24 jam** |
| **Tinggi** | Data pribadi sebagian akun terpapar, atau kerentanan yang bisa dipakai untuk itu. | Satu siswa bisa membaca jawaban/kunci milik siswa lain; foto profil di path yang bisa ditebak. | Triase **≤ 24 jam**, tutup celah **≤ 3×24 jam**, beri tahu bila ada subjek terdampak |
| **Sedang** | Kebocoran terbatas tanpa dampak langsung ke siswa, atau kesalahan konfigurasi yang belum dieksploitasi. | Header keamanan hilang di satu rute; log memuat PII tanpa teredaksi. | Triase **≤ 3 hari**, perbaiki di siklus rilis berikutnya |
| **Rendah** | Temuan tanpa jalur eksploitasi nyata. | Advisory dependensi di pohon dev. | Catat di `docs/AUDIT-AND-ROADMAP.md`, jadwalkan sebagai utang teknis |

---

## 4. Alur penanganan

### 4.1 Deteksi (jam ke-0)

Sumber deteksi yang **sudah** ada di platform:

| Sinyal | Artinya |
|---|---|
| `account_deletion_clerk_failed` (level `error`) | Data pribadi sudah dihapus dari database kita, tetapi akun masuknya masih hidup. |
| `cron_retention_misconfigured` (level `error`) | `CRON_SECRET` tidak diset — job retensi tidak berjalan, data menumpuk melewati masa simpan. |
| `retention_run_failed` (level `error`) | Job retensi gagal; sebagian data lama tidak terhapus. |
| `rate_limit_exceeded` (level `warn`) | Satu akun/IP menembus anggaran. Bisa berarti serangan, bisa berarti bug di klien. |
| `point_spike_detected` (level `warn`) | Lonjakan poin dalam 10 menit — indikasi penyalahgunaan jalur poin. |
| `csp_violation` (level `warn`) | Halaman mencoba memuat sumber yang diblokir. Sering menandakan injeksi skrip. |
| Laporan dari siswa/guru lewat tombol **Lapor Isu** atau surel `SECURITY.md`. | Laporan manusia. |

Siapa pun yang menemukan sinyal ini **wajib** menyampaikannya ke Koordinator insiden dan PIC
ICT dalam **≤ 24 jam**. Menyimpan temuan sendiri untuk "dicek dulu" adalah pelanggaran
prosedur, bukan kehati-hatian.

### 4.2 Triase (≤ 1×24 jam)

Koordinator insiden memanggil rapat triase (boleh lewat pesan grup, tidak harus tatap muka).
Empat pertanyaan yang harus dijawab dan **dicatat**:

1. Data pribadi apa yang terlibat?
2. Berapa banyak subjek data terdampak?
3. Siapa yang sudah bisa mengaksesnya, dan sejak kapan?
4. Tingkat keparahan berapa (bagian 3)?

Hasil triase ditulis sebagai catatan bertanggal, walaupun jawabannya masih sementara.

### 4.3 Pengendalian (≤ 3×24 jam)

Tindakan standar PIC ICT, sesuai jenis insiden:

- **Kredensial bocor → rotasi dulu, bersihkan riwayat kemudian.** Rotasi adalah satu-satunya
  langkah yang benar-benar mencabut akses; menghapus berkas dari commit tidak membatalkan apa
  pun karena nilainya tetap ada di riwayat dan di setiap fork.
- **Celah otorisasi →** tutup celahnya di route handler (setiap route wajib punya penjaganya
  sendiri), tambahkan test regresi yang gagal sebelum perbaikan dan lulus sesudahnya.
- **Akses tanpa hak ke database →** putus sesi Clerk yang mencurigakan, tinjau log akses Neon,
  ganti kredensial database.
- **Penghapusan tidak sengaja →** hentikan semua job yang menulis, pulihkan dari titik
  pemulihan Neon (PITR), verifikasi barisnya kembali.

Setiap tindakan dicatat dengan waktu (WIB) dan pelakunya.

### 4.4 Pemberitahuan (≤ 3×24 jam)

UU PDP mewajibkan pemberitahuan tertulis paling lambat **3×24 jam** sejak insiden diketahui,
kepada **subjek data** yang terdampak. Sekolah juga menyampaikan laporan ke pihak yang
berwenang melalui Kepala Sekolah.

Isi pemberitahuan ke siswa — bahasa sehari-hari, tanpa istilah teknis:

1. Apa yang terjadi, sedatar mungkin.
2. Data apa saja yang terdampak (sebutkan jenisnya).
3. Apa yang **sudah** kami lakukan.
4. Apa yang perlu siswa lakukan (mis. ganti kata sandi bila akun lain memakai sandi yang sama).
5. Ke mana bertanya, dan kepada siapa.

Pemberitahuan tidak boleh menunda perbaikan, dan perbaikan tidak boleh menunda pemberitahuan.
Keduanya berjalan bersamaan.

### 4.5 Pemulihan dan penutupan

- Pastikan layanan kembali normal dan celahnya benar-benar tertutup.
- Tambahkan test regresi supaya celah yang sama tidak bisa kembali tanpa gagal build.
- Tulis **post-mortem tanpa menyalahkan individu**: apa yang terjadi, mengapa bisa lolos, apa
  yang berubah supaya tidak terulang. Fokusnya pada sistem dan proses, bukan pada orangnya.
- Perbarui `docs/AUDIT-AND-ROADMAP.md` dan, bila ada kewajiban baru, dokumen ini.

---

## 5. Catatan tanggung jawab internal

Rapat triase mencatat, minimal:

```
Tanggal/jam diketahui : 
Dilaporkan oleh       : 
Diketahui oleh        : 
Tingkat keparahan     : 
Data terdampak        : 
Jumlah subjek         : 
Tindakan & waktu      : 
Pemberitahuan dikirim : (tanggal/jam, oleh siapa)
Ditutup pada          : 
Pelajaran & perubahan : 
```

Catatan ini disimpan oleh Divisi ICT dan diserahkan ke Wakil Kesiswaan pada akhir periode
kepengurusan. Isinya **tidak** di-commit ke repositori publik ini bila memuat data pribadi.

---

## 6. Latihan dan peninjauan

- **Latihan meja (tabletop)** satu kali per semester: satu skenario, dijalankan bersama seluruh
  peran di bagian 2, tanpa sistem sungguhan. Tujuannya menguji apakah orangnya tahu harus
  menghubungi siapa, bukan menguji kodenya.
- Prosedur ini ditinjau setiap awal periode kepengurusan OSIS, dan setiap kali ada insiden
  sungguhan.
- Perubahan kontak, nama pengurus, atau alur wajib masuk ke dokumen ini pada hari yang sama.

---

## 7. Kontak

| Keperluan | Tujuan |
|---|---|
| Laporan kerentanan (pihak luar) | `osissmanduajonggol@gmail.com` — lihat `SECURITY.md` |
| Pertanyaan data pribadi / hak subjek data | `privasi@nawasena.site` — lihat halaman `/privacy` |
| Insiden internal | Koordinator insiden (Wakil Kesiswaan) + PIC ICT, lewat kanal pengurus OSIS |
