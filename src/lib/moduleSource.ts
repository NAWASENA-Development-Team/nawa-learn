// src/lib/moduleSource.ts
// ─── Satu definisi "modul ini sebenarnya apa" ────────────────────────────────
//
// Pembaca modul punya empat jalur yang sangat berbeda — PDF milik kita, gambar,
// embeds eksternal, dan tautan yang sudah mati — dan sebelum M21 jalur itu
// ditentukan oleh rantai `if (url.startsWith(...))` di dalam komponen 1.100
// baris. Dua akibatnya terlihat di produksi:
//
//   1. `data:application/pdf` sepanjang ±1 MB ikut dikirim di payload halaman
//      perpustakaan untuk **setiap** modul, lalu di-`atob()` di main thread saat
//      modul dibuka. Halaman terasa berat, dan PDF yang gagal dirender terasa
//      seperti file corrupt.
//   2. URL eksternal hanya dinormalisasi dengan `.replace("/view", "/preview")`,
//      sehingga `drive.google.com/file/d/<id>` (tanpa `/view`) tetap dimuat apa
//      adanya dan Drive menjawab `X-Frame-Options` — iframe kosong tanpa pesan.
//
// Modul ini murni: tidak menyentuh DOM dan tidak mengimpor Next.js, jadi
// seluruh matriks URL di bawah bisa diuji langsung (tests/unit/module-source).
//
// ATURAN YANG TIDAK BOLEH DILANGGAR: `src` tidak pernah berupa `data:` URI.
// Bytes milik kita selalu disajikan `/api/modules/<id>/file`, supaya halaman
// perpustakaan tidak pernah membawa isi file.

/** Jalur yang dipakai pembaca untuk menampilkan sebuah modul. */
export type ModuleSourceKind =
  /** PDF lama yang tersimpan base64 di kolom `modules.content_url`. */
  | "pdf-data"
  /** PDF di Vercel Blob milik kita — bisa diambil dan dirender ke canvas. */
  | "pdf-blob"
  /** Gambar lama yang tersimpan base64 di kolom. */
  | "image-data"
  /** Gambar di Vercel Blob milik kita. */
  | "image-blob"
  /** Google Drive / Google Docs yang bisa di-embed setelah dinormalisasi. */
  | "drive"
  /** Host lain (Canva, YouTube, blog guru…). */
  | "external"
  /** Tidak ada yang bisa ditampilkan. */
  | "unknown";

export interface ModuleSource {
  kind: ModuleSourceKind;
  /** URL yang dipakai pembaca. `null` hanya untuk `unknown`. */
  src: string | null;
}

/** Host object storage kita. Harus sama dengan `isOwnStorageUrl()` di server. */
const OWN_BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * Apakah URL ini milik Vercel Blob kita.
 *
 * Dicocokkan pada **hostname**, bukan `startsWith` pada seluruh URL: host lama
 * `nawa-learn.storage` dulu lolos pemeriksaan berbasis awalan lalu dirender
 * sebagai iframe yang tidak pernah memuat apa pun (domainnya sudah tidak ada).
 */
export function isOwnBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(OWN_BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** Ekstensi menentukan jenis media objek; isi objek tidak pernah kita baca. */
function blobKind(url: string): "pdf" | "image" | null {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|webp)$/.test(path)) return "image";
  return null;
}

/**
 * Ubah tautan Google Drive/Docs menjadi bentuk yang benar-benar bisa di-embed.
 *
 * Drive hanya mengizinkan `/preview` di dalam iframe. Empat bentuk yang beredar
 * di dunia nyata semuanya menuju ke sana:
 *
 *   drive.google.com/file/d/<id>/view        (tombol "Bagikan")
 *   drive.google.com/file/d/<id>             (tanpa akhiran)
 *   drive.google.com/open?id=<id>            (format lama)
 *   drive.google.com/uc?id=<id>&export=…     (tautan unduh)
 *
 * Docs memakai `/preview` pada path yang sama. Fungsi ini **idempoten**:
 * menormalkan hasil normalisasi tidak mengubah apa pun — sifat yang diuji,
 * karena normalizer yang tidak idempoten akan mengubah URL setiap render.
 *
 * Tautan yang tidak dikenali dikembalikan apa adanya. Menebak lebih buruk
 * daripada membiarkannya: pembaca tetap menampilkannya sebagai embed eksternal
 * dengan tombol "buka di tab baru".
 */
export function normalizeEmbedUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return rawUrl;

  const host = url.hostname;
  const isDrive = host === "drive.google.com";
  const isDocs = host === "docs.google.com";
  if (!isDrive && !isDocs) return rawUrl;

  // ID Drive panjangnya puluhan karakter; ambang rendah di sini supaya tautan
  // lama yang sah tidak ikut ditolak. Validasi "ID masuk akal" adalah urusan
  // route submit, bukan pembaca.
  const idPattern = /([A-Za-z0-9_-]{10,})/;

  if (isDrive) {
    const fromPath = url.pathname.match(new RegExp(`/file/d/${idPattern.source}`));
    const fromQuery = url.searchParams.get("id")?.match(idPattern);
    const id = fromPath?.[1] ?? fromQuery?.[1];
    if (!id) return rawUrl;
    return `https://drive.google.com/file/d/${id}/preview`;
  }

  // docs.google.com/<jenis>/d/<id>/edit → /<jenis>/d/<id>/preview
  const docs = url.pathname.match(
    new RegExp(`^/(document|spreadsheets|presentation)/d/${idPattern.source}`),
  );
  if (!docs) return rawUrl;
  const [, docType, id] = docs;
  return `https://docs.google.com/${docType}/d/${id}/preview`;
}

/**
 * Tentukan jalur pembaca untuk satu baris `modules`.
 *
 * `moduleId` dipakai untuk membangun URL rute file bagi baris `data:` — satu-
 * satunya cara agar isi file tidak ikut ke payload halaman.
 */
export function resolveModuleSource(contentUrl: string, moduleId: string): ModuleSource {
  const url = (contentUrl ?? "").trim();
  const fileRoute = `/api/modules/${encodeURIComponent(moduleId)}/file`;

  if (url.startsWith("data:application/pdf")) {
    return { kind: "pdf-data", src: fileRoute };
  }
  if (url.startsWith("data:image/")) {
    return { kind: "image-data", src: fileRoute };
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    // Skema lain (`javascript:`, `blob:` dari sesi lain, string kosong) tidak
    // pernah ditampilkan.
    return { kind: "unknown", src: null };
  }

  if (isOwnBlobUrl(url)) {
    const kind = blobKind(url);
    if (kind === "pdf") return { kind: "pdf-blob", src: url };
    if (kind === "image") return { kind: "image-blob", src: url };
    // Objek kita yang ekstensinya tidak dikenali: jangan menebak, dan jangan
    // memasangnya sebagai iframe — kita tahu bytes-nya bukan PDF/gambar.
    return { kind: "unknown", src: null };
  }

  const normalized = normalizeEmbedUrl(url);
  if (normalized !== url) return { kind: "drive", src: normalized };

  // Tautan Drive/Docs yang tidak bisa dinormalisasi (mis. folder, atau ID
  // palsu) tetap dicoba sebagai embed eksternal: lebih baik menampilkan
  // "buka di tab baru" daripada menyembunyikannya tanpa alasan.
  return { kind: "external", src: url };
}
