// tests/unit/pdf-worker.test.ts
// ─── Worker PDF.js: satu file statis yang harus tetap sinkron ─────────────────
//
// Pembaca modul tidak memakai `<embed>` dan tidak memakai plugin peramban; PDF
// di-parse di dalam Web Worker. Worker itu disalin dari `node_modules` ke
// `public/pdf/` oleh `scripts/sync-pdf-worker.mjs`, karena `new URL(...)` dengan
// specifier package bukan kontrak yang dijanjikan Turbopack — dan kegagalannya
// diam: dokumen menggantung tanpa pesan.
//
// Yang bisa membusuk tanpa tes ini:
//
//   • salinan yang tertinggal setelah `pdfjs-dist` di-upgrade, sehingga worker
//     versi lama mem-parse dokumen versi baru (gejala: PDF tertentu kosong);
//   • `postinstall`/`prebuild` yang dihapus, sehingga `/pdf/pdf.worker.min.mjs`
//     menjadi 404 di deploy berikutnya dan tidak ada yang tahu sampai ada siswa
//     yang membuka modul;
//   • konstanta di komponen yang diubah tanpa menyalin file ke jalur baru.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const installedPackage = join(root, "node_modules/pdfjs-dist/package.json");
const installedWorker = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const publicWorker = join(root, "public/pdf/pdf.worker.min.mjs");
const marker = join(root, "public/pdf/version.json");

const sha256 = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

describe("worker PDF.js", () => {
  it("disalin ke public/pdf dan identik dengan paket yang terpasang", () => {
    expect(
      existsSync(publicWorker),
      "Worker belum disalin. Jalankan `node scripts/sync-pdf-worker.mjs` " +
        "(otomatis lewat postinstall dan prebuild).",
    ).toBe(true);

    expect(sha256(publicWorker)).toBe(sha256(installedWorker));
  });

  it("mencatat versi pdfjs-dist yang benar-benar terpasang", () => {
    const { version } = JSON.parse(readFileSync(installedPackage, "utf8"));
    const recorded = JSON.parse(readFileSync(marker, "utf8"));

    expect(recorded.version).toBe(version);
    // Dan versi itu juga yang diminta `package.json`, supaya lockfile dan paket
    // di disk tidak berbeda pendapat tanpa ada yang menyadarinya.
    const dependency = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).dependencies[
      "pdfjs-dist"
    ];
    expect(dependency).toContain(version);
  });

  it("komponen pembaca menunjuk ke jalur yang benar-benar ada", () => {
    const source = readFileSync(
      join(root, "src/components/modules/ModuleReader.tsx"),
      "utf8",
    );
    const match = /const PDF_WORKER_SRC = "([^"]+)";/.exec(source);

    expect(match, "PDF_WORKER_SRC tidak ditemukan di ModuleReader.tsx").not.toBeNull();
    const workerSrc = match?.[1] ?? "";
    // `/pdf/...` → `public/pdf/...`
    expect(existsSync(join(root, "public", workerSrc.replace(/^\//, "")))).toBe(true);
  });

  it("penyalinan berjalan otomatis, bukan langkah manual yang bisa lupa", () => {
    const scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts;
    expect(scripts.postinstall).toContain("sync-pdf-worker.mjs");
    expect(scripts.prebuild).toContain("sync-pdf-worker.mjs");
  });

  it("proxy tidak menggate worker sebagai route", () => {
    // Matcher `src/proxy.ts` dulu hanya mengecualikan `js`, sehingga permintaan
    // worker `.mjs` melewati gerbang Clerk. Bagi siswa yang sudah masuk itu tidak
    // terasa — worker same-origin membawa cookie — tetapi aset statis yang bisa
    // dijawab 307 ke halaman masuk bukan aset statis, dan kegagalannya hanya
    // muncul untuk pengguna yang sesinya sedang diperbarui.
    const proxy = readFileSync(join(root, "src/proxy.ts"), "utf8");
    expect(proxy).toMatch(/js\(\?!on\)\|mjs/);
  });
});
