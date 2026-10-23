// scripts/sync-pdf-worker.mjs
// ─── Salin worker PDF.js ke `public/` ─────────────────────────────────────────
//
// PDF.js mem-parse dokumen di dalam Web Worker. Di peramban, worker itu harus
// berupa URL yang bisa dimuat sebagai modul — dan cara "modern" untuk mendapat
// URL tersebut,
//
//     new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)
//
// bergantung pada bundler yang bersedia menyelesaikan *specifier package* di
// dalam `new URL` menjadi aset statis. Turbopack tidak menjanjikan itu. Kalau
// gagal, kegagalannya **diam**: worker tidak pernah dibuat, `getDocument()`
// menggantung, dan PDF tidak pernah muncul — persis gejala yang M21 ada untuk
// menghapus.
//
// Jadi worker-nya adalah file statis dengan nama tetap, disalin ke `public/pdf/`
// dari paket yang benar-benar terpasang. Dengan begitu:
//
//   • `/pdf/pdf.worker.min.mjs` dilayani dari origin kita, sehingga cukup
//     `worker-src 'self'` — tanpa `blob:` dan tanpa CDN;
//   • versinya tidak bisa "melayang": isi yang disalin selalu dibaca dari
//     `node_modules/pdfjs-dist` pada saat install/build, dan
//     `tests/unit/pdf-worker.test.ts` membandingkan sha256 keduanya.
//
// Dijalankan otomatis oleh `postinstall` (setelah `npm ci`) dan `prebuild`
// (sebelum `next build`), jadi tidak ada langkah manual yang bisa terlupa.
// Berkas hasil salinan **tidak** di-commit: `.gitignore` menutup `public/pdf/`,
// dan salinan 1,3 MB di riwayat git hanya akan menua bersama setiap versi.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules", "pdfjs-dist");
const source = join(pkgDir, "build", "pdf.worker.min.mjs");
const targetDir = join(root, "public", "pdf");
const target = join(targetDir, "pdf.worker.min.mjs");
const marker = join(targetDir, "version.json");

function fail(message) {
  console.error(`[sync-pdf-worker] ${message}`);
  process.exit(1);
}

if (!existsSync(source)) {
  fail(
    `Worker PDF.js tidak ditemukan di ${source}. Jalankan "npm install" lebih dulu ` +
      `(paket pdfjs-dist adalah dependensi, bukan devDependency).`,
  );
}

const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;
const bytes = readFileSync(source);
const sha256 = createHash("sha256").update(bytes).digest("hex");

const upToDate =
  existsSync(target) &&
  existsSync(marker) &&
  statSync(target).size === bytes.byteLength &&
  JSON.parse(readFileSync(marker, "utf8")).sha256 === sha256;

if (!upToDate) {
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(source, target);
  writeFileSync(marker, `${JSON.stringify({ version, sha256 }, null, 2)}\n`, "utf8");
}

console.log(`[sync-pdf-worker] pdfjs-dist ${version} — ${target.replace(root, "")} siap.`);
