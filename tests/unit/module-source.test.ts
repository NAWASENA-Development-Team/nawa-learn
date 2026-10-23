// tests/unit/module-source.test.ts
// ─── Matriks "modul ini diapakan" ─────────────────────────────────────────────
//
// Semua keputusan di `moduleSource.ts` murni, sehingga bisa diuji tanpa DOM,
// tanpa PDF.js dan tanpa jaringan. Itu penting karena dua bug M21 muncul dari
// rantai `if` yang tidak pernah diuji: `/view` → `/preview` hanya menangani satu
// bentuk URL Drive, dan `startsWith("https://nawa-learn.storage")` menganggap
// host yang sudah mati sebagai "milik kita".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isOwnBlobUrl,
  normalizeEmbedUrl,
  resolveModuleSource,
} from "@/lib/moduleSource";
import { withoutComments } from "../helpers/source";

const MODULE_ID = "11111111-2222-3333-4444-555555555555";
const FILE_ROUTE = `/api/modules/${MODULE_ID}/file`;
const DRIVE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("normalizeEmbedUrl", () => {
  it("mengubah bentuk /view menjadi /preview", () => {
    expect(
      normalizeEmbedUrl(`https://drive.google.com/file/d/${DRIVE_ID}/view?usp=sharing`),
    ).toBe(`https://drive.google.com/file/d/${DRIVE_ID}/preview`);
  });

  it("mengubah tautan tanpa akhiran menjadi /preview", () => {
    // Bentuk inilah yang paling sering dibagikan, dan yang dulu lolos apa adanya
    // lalu dijawab Drive dengan X-Frame-Options.
    expect(normalizeEmbedUrl(`https://drive.google.com/file/d/${DRIVE_ID}`)).toBe(
      `https://drive.google.com/file/d/${DRIVE_ID}/preview`,
    );
  });

  it("menangani dua bentuk tautan lama (open?id= dan uc?id=)", () => {
    expect(normalizeEmbedUrl(`https://drive.google.com/open?id=${DRIVE_ID}`)).toBe(
      `https://drive.google.com/file/d/${DRIVE_ID}/preview`,
    );
    expect(
      normalizeEmbedUrl(`https://drive.google.com/uc?id=${DRIVE_ID}&export=download`),
    ).toBe(`https://drive.google.com/file/d/${DRIVE_ID}/preview`);
  });

  it("menormalkan Google Docs, Sheets dan Slides", () => {
    expect(
      normalizeEmbedUrl(`https://docs.google.com/document/d/${DRIVE_ID}/edit?usp=sharing`),
    ).toBe(`https://docs.google.com/document/d/${DRIVE_ID}/preview`);
    expect(normalizeEmbedUrl(`https://docs.google.com/spreadsheets/d/${DRIVE_ID}/edit`)).toBe(
      `https://docs.google.com/spreadsheets/d/${DRIVE_ID}/preview`,
    );
    expect(
      normalizeEmbedUrl(`https://docs.google.com/presentation/d/${DRIVE_ID}/edit#slide=id.p`),
    ).toBe(`https://docs.google.com/presentation/d/${DRIVE_ID}/preview`);
  });

  it("idempoten: menormalkan hasil normalisasi tidak mengubah apa pun", () => {
    const urls = [
      `https://drive.google.com/file/d/${DRIVE_ID}/view`,
      `https://drive.google.com/open?id=${DRIVE_ID}`,
      `https://docs.google.com/document/d/${DRIVE_ID}/edit`,
      "https://contoh.test/modul.pdf",
    ];
    for (const url of urls) {
      const once = normalizeEmbedUrl(url);
      expect(normalizeEmbedUrl(once)).toBe(once);
    }
  });

  it("membiarkan tautan yang tidak dikenali apa adanya", () => {
    // Folder Drive, host lain, dan string ngawur tidak boleh ditebak-tebak.
    expect(normalizeEmbedUrl(`https://drive.google.com/drive/folders/${DRIVE_ID}`)).toBe(
      `https://drive.google.com/drive/folders/${DRIVE_ID}`,
    );
    expect(normalizeEmbedUrl("https://contoh.test/modul.pdf")).toBe(
      "https://contoh.test/modul.pdf",
    );
    expect(normalizeEmbedUrl("bukan url")).toBe("bukan url");
    expect(normalizeEmbedUrl("javascript:alert(1)")).toBe("javascript:alert(1)");
  });
});

describe("isOwnBlobUrl", () => {
  it("hanya cocok pada host object storage kita", () => {
    expect(
      isOwnBlobUrl("https://6xzlcy024umrypk5.public.blob.vercel-storage.com/uploads/a/b.pdf"),
    ).toBe(true);
    // Host lama ini sudah mati (ENOTFOUND). Pemeriksaan berbasis awalan string
    // pernah menganggapnya milik kita, sehingga modul dirender sebagai iframe
    // ke domain yang tidak ada.
    expect(isOwnBlobUrl("https://nawa-learn.storage/uploads/a.pdf")).toBe(false);
    expect(isOwnBlobUrl("bukan url")).toBe(false);
  });
});

describe("resolveModuleSource", () => {
  it("tidak pernah mengirim data: URI ke klien", () => {
    const pdf = resolveModuleSource("data:application/pdf;base64,JVBERi0xLjcK", MODULE_ID);
    const image = resolveModuleSource("data:image/png;base64,iVBORw0KGgo=", MODULE_ID);

    expect(pdf).toEqual({ kind: "pdf-data", src: FILE_ROUTE });
    expect(image).toEqual({ kind: "image-data", src: FILE_ROUTE });
    expect(pdf.src?.startsWith("data:")).toBe(false);
    expect(image.src?.startsWith("data:")).toBe(false);
  });

  it("mengenali media di object storage dari ekstensinya", () => {
    const base = "https://contoh.public.blob.vercel-storage.com/uploads/u/";
    expect(resolveModuleSource(`${base}modul.pdf`, MODULE_ID).kind).toBe("pdf-blob");
    expect(resolveModuleSource(`${base}foto.JPG`, MODULE_ID).kind).toBe("image-blob");
    // Ekstensi yang tidak kita kenal bukan PDF dan bukan gambar: jangan menebak.
    expect(resolveModuleSource(`${base}dokumen.docx`, MODULE_ID)).toEqual({
      kind: "unknown",
      src: null,
    });
  });

  it("menandai Drive setelah dinormalisasi, dan host lain sebagai eksternal", () => {
    expect(
      resolveModuleSource(`https://drive.google.com/file/d/${DRIVE_ID}/view`, MODULE_ID),
    ).toEqual({
      kind: "drive",
      src: `https://drive.google.com/file/d/${DRIVE_ID}/preview`,
    });

    expect(resolveModuleSource("https://www.canva.com/design/abc/view", MODULE_ID)).toEqual({
      kind: "external",
      src: "https://www.canva.com/design/abc/view",
    });
  });

  it("menolak skema yang tidak boleh dimuat", () => {
    expect(resolveModuleSource("javascript:alert(1)", MODULE_ID)).toEqual({
      kind: "unknown",
      src: null,
    });
    expect(resolveModuleSource("", MODULE_ID)).toEqual({ kind: "unknown", src: null });
    expect(resolveModuleSource("   ", MODULE_ID)).toEqual({ kind: "unknown", src: null });
  });

  it("memangkas spasi di sekitar URL", () => {
    expect(resolveModuleSource(`  https://contoh.test/a.pdf  `, MODULE_ID)).toEqual({
      kind: "external",
      src: "https://contoh.test/a.pdf",
    });
  });
});

// ─── Gerbang sumber ──────────────────────────────────────────────────────────
// Halaman perpustakaan adalah satu-satunya tempat yang masih memegang
// `content_url` mentah, dan itu hanya untuk dibuang. Kalau seseorang kelak
// mengembalikan `...mod` ke objek props, base64 ±1,9 MB akan ikut lagi dan tidak
// ada tes respons yang bisa melihatnya — payload-nya tetap JSON yang sah.
describe("modules/page.tsx", () => {
  const page = withoutComments(
    readFileSync(join(process.cwd(), "src/app/(dashboard)/modules/page.tsx"), "utf8"),
  );

  it("tidak meneruskan contentUrl ke komponen klien", () => {
    expect(page).toContain("resolveModuleSource(mod.contentUrl, mod.id)");

    // Yang menentukan adalah objek yang **dikirim**, bukan yang dibaca: kolomnya
    // memang harus di-select untuk diubah menjadi deskriptor. Ambil hanya blok
    // `serializedModules` lalu pastikan tidak ada `contentUrl` atau spread di
    // dalamnya.
    const start = page.indexOf("const serializedModules");
    const end = page.indexOf("const { userId", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const payload = page.slice(start, end);
    expect(payload).not.toMatch(/contentUrl\s*:/);
    expect(payload).not.toContain("...mod");
  });
});
