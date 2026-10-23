// src/components/modules/ModuleReader.tsx
// ─── Pembaca modul ────────────────────────────────────────────────────────────
//
// Sampai M20 "membaca modul" berarti menyerahkan file ke browser:
//
//   <embed type="application/pdf">   untuk PDF milik sendiri
//   <iframe src="…">                 untuk tautan eksternal
//
// Dua-duanya gagal dengan cara yang sama diamnya. `<embed>` diatur oleh direktif
// CSP `object-src`, dan `securityHeaders.ts` mengirim `object-src 'none'` — jadi
// PDF kita sendiri diblokir oleh kebijakan kita sendiri. `<iframe>` ke Drive
// hanya berfungsi kalau URL-nya berbentuk `/preview`, sementara kode lama cuma
// menukar `/view`; bentuk lain menjawab `X-Frame-Options` dan frame-nya kosong.
// Dan ketika tipe file tidak dikenali, komponen lama merender **mockup catatan
// tulisan tangan** — dekorasi yang berpura-pura menjadi file siswa.
//
// Di sini PDF dirender sendiri ke `<canvas>` lewat PDF.js: tidak ada plugin
// browser, tidak ada `object-src`, dan hasilnya sama di desktop maupun Android
// (Chrome Android memang tidak merender PDF di dalam iframe). Tautan eksternal
// tetap iframe — bytes-nya tidak bisa kita ambil karena CORS — tetapi selalu
// disertai tombol "buka di tab baru", jadi frame yang kosong tidak lagi menjadi
// jalan buntu tanpa penjelasan.
//
// Batas yang jujur: gambar dirender dengan penskalaan CSS, belum ada pemilihan
// teks di dalam PDF. Keduanya bukan janji yang dibuat komponen ini.
"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  RotateCw,
  X,
} from "lucide-react";
import type { ModuleSource } from "@/lib/moduleSource";

/**
 * Worker PDF.js disalin ke `public/` oleh `scripts/sync-pdf-worker.mjs` (dipanggil
 * `prebuild`/`predev`), bukan di-resolve bundler.
 *
 * Alasannya bukan selera: `new URL("pdfjs-dist/…", import.meta.url)` mengandalkan
 * bundler menyelesaikan specifier package menjadi aset statis, dan itu bukan
 * perilaku yang dijanjikan Turbopack. Kalau gagal, kegagalannya **diam** — worker
 * tidak pernah dibuat dan PDF tidak pernah muncul. Satu file statis dengan nama
 * tetap bisa dibuktikan lewat `next build` dan lewat satu permintaan HTTP.
 *
 * Versi worker harus sama dengan versi `pdfjs-dist`; `scripts/sync-pdf-worker.mjs`
 * menulis versi itu ke berkas penanda, dan `tests/unit/pdf-worker.test.ts`
 * memastikan keduanya tidak pernah berbeda.
 */
const PDF_WORKER_SRC = "/pdf/pdf.worker.min.mjs";

/** Ukuran halaman dikali `devicePixelRatio`, tetapi tidak lebih dari 2. */
const MAX_PIXEL_RATIO = 2;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export interface ReaderModule {
  id: string;
  title: string;
  subject: string;
  grade: string;
  category: string;
  uploaderName: string | null;
  /** ISO string dari server. */
  createdAt: string;
  source: ModuleSource;
}

interface ModuleReaderProps {
  module: ReaderModule;
  onClose: () => void;
  /**
   * Dipanggil saat tombol Unduh ditekan — satu-satunya tempat hitungan
   * `modules.downloads` bertambah. Membuka modul tidak lagi dihitung.
   */
  onDownload: () => void;
}

const isPdfKind = (kind: ModuleSource["kind"]) => kind === "pdf-data" || kind === "pdf-blob";
const isImageKind = (kind: ModuleSource["kind"]) => kind === "image-data" || kind === "image-blob";

export default function ModuleReader({ module: mod, onClose, onDownload }: ModuleReaderProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Escape menutup pembaca, dan fokus berpindah ke tombol tutup saat dibuka:
  // modal yang bisa dibuka dengan keyboard tetapi tidak bisa ditutup dengan
  // keyboard adalah jebakan.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    // Kunci gulir halaman di belakang modal; dikembalikan persis seperti semula.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const { kind, src } = mod.source;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="module-reader-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-nawa-primary dark:border-indigo-900/40 dark:bg-indigo-950/50 dark:text-indigo-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <h2
                id="module-reader-title"
                className="truncate text-sm font-extrabold text-zinc-900 dark:text-white sm:text-base"
              >
                {mod.title}
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                <span className="font-semibold text-indigo-500">{mod.subject}</span>
                <span aria-hidden="true">•</span>
                <span>Kelas {mod.grade}</span>
                <span aria-hidden="true">•</span>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-nawa-primary dark:bg-indigo-950/40 dark:text-indigo-400">
                  {mod.category}
                </span>
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup pembaca modul"
            className="shrink-0 cursor-pointer rounded-xl p-2 text-zinc-400 transition-all hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-zinc-100 p-3 dark:bg-zinc-950/85 sm:p-5">
          {isPdfKind(kind) && src ? (
            // `key={src}` me-remount saat sumbernya berubah, sehingga state
            // halaman/zoom kembali ke awal tanpa `setState` sinkron di dalam
            // effect (yang dilarang react-hooks/set-state-in-effect).
            <PdfPageReader key={src} src={src} title={mod.title} />
          ) : isImageKind(kind) && src ? (
            <ImageViewer src={src} title={mod.title} />
          ) : (kind === "drive" || kind === "external") && src ? (
            <EmbeddedDocument src={src} />
          ) : (
            <BrokenDocument />
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs text-zinc-500">
            Diunggah oleh{" "}
            <span className="font-bold text-zinc-700 dark:text-zinc-300">
              {mod.uploaderName || "Anonim"}
            </span>{" "}
            •{" "}
            {new Date(mod.createdAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl bg-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 transition-all hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              Tutup
            </button>
            {src && (kind === "drive" || kind === "external") ? (
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-nawa-primary px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-nawa-primary-hover"
              >
                <ExternalLink className="h-4 w-4" /> Buka di tab baru
              </a>
            ) : src ? (
              <a
                href={kind === "pdf-data" || kind === "image-data" ? `${src}?download=1` : src}
                download={kind === "pdf-data" || kind === "image-data" ? undefined : true}
                target={kind === "pdf-data" || kind === "image-data" ? undefined : "_blank"}
                rel="noopener noreferrer"
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 rounded-xl bg-nawa-primary px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-nawa-primary-hover"
              >
                <Download className="h-4 w-4" /> Unduh
              </a>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

function PdfPageReader({ src, title }: { src: string; title: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Lebar wadah menentukan skala "pas lebar". Diukur, bukan ditebak: lebar modal
  // berbeda antara ponsel dan desktop, dan PDF yang dirender pada skala tetap
  // akan terpotong di layar kecil.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setContainerWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { destroy: () => Promise<void> } | null = null;

    (async () => {
      try {
        // Dimuat dinamis: halaman perpustakaan tidak membayar ±800 KB PDF.js
        // hanya karena ada tombol "buka".
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

        const task = pdfjs.getDocument({ url: src });
        loadingTask = task;
        const loaded = await task.promise;

        if (cancelled) {
          void loaded.destroy();
          return;
        }
        setDoc(loaded);
        setPageCount(loaded.numPages);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          error instanceof Error && error.message ? error.message : "Dokumen tidak bisa dibaca.",
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [src]);

  useEffect(() => {
    if (!doc || status !== "ready") return;

    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const natural = page.getViewport({ scale: 1, rotation });
        const fitScale = containerWidth > 0 ? containerWidth / natural.width : 1;
        const viewport = page.getViewport({ scale: fitScale * zoom, rotation });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const task = page.render({
          canvas,
          viewport,
          // Tanpa transform ini, canvas berukuran devicePixel tetapi digambar
          // pada skala CSS — hasilnya PDF pecah di layar retina.
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        renderTask = task;
        await task.promise;
      } catch (error) {
        // `RenderingCancelledException` bukan kegagalan: itu artinya pengguna
        // sudah memindah halaman sebelum halaman ini selesai digambar.
        if (cancelled) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "RenderingCancelledException") return;
        setErrorMessage(
          error instanceof Error && error.message ? error.message : "Halaman gagal dirender.",
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNumber, zoom, rotation, containerWidth, status]);

  const canPrev = pageNumber > 1;
  const canNext = pageNumber < pageCount;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPageNumber((n) => Math.max(1, n - 1))}
            disabled={!canPrev}
            aria-label="Halaman sebelumnya"
            className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[86px] text-center text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
            {status === "ready" ? `${pageNumber} / ${pageCount}` : "…"}
          </span>
          <button
            type="button"
            onClick={() => setPageNumber((n) => Math.min(pageCount, n + 1))}
            disabled={!canNext}
            aria-label="Halaman berikutnya"
            className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - 0.25) * 100) / 100))}
            disabled={status !== "ready"}
            aria-label="Perkecil"
            className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            disabled={status !== "ready"}
            title="Pas lebar"
            className="min-w-[52px] cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold tabular-nums text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + 0.25) * 100) / 100))}
            disabled={status !== "ready"}
            aria-label="Perbesar"
            className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            disabled={status !== "ready"}
            aria-label="Putar halaman"
            className="ml-1 cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex min-h-[420px] flex-col items-center overflow-auto rounded-xl border border-zinc-200 bg-zinc-200/60 p-2 dark:border-zinc-800 dark:bg-zinc-900/60"
      >
        {status === "error" ? (
          <ReaderFailure
            title="Dokumen tidak bisa dibuka"
            detail={errorMessage}
            href={src}
            filename={title}
          />
        ) : (
          <>
            {status === "loading" && (
              <p className="flex items-center gap-2 py-16 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat dokumen…
              </p>
            )}
            <canvas
              ref={canvasRef}
              aria-label={`Halaman ${pageNumber} dari ${pageCount} — ${title}`}
              className={`rounded-lg bg-white shadow-lg ${status === "loading" ? "hidden" : ""}`}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Gambar ──────────────────────────────────────────────────────────────────

function ImageViewer({ src, title }: { src: string; title: string }) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <ReaderFailure title="Gambar tidak bisa dimuat" detail={null} href={src} filename={title} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-1 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
          aria-label="Perkecil"
          className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
          disabled={zoom <= 1}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          title="Ukuran asli"
          className="min-w-[52px] cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold tabular-nums text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + 0.25) * 100) / 100))}
          aria-label="Perbesar"
          className="cursor-pointer rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-auto rounded-xl border border-zinc-200 bg-zinc-200/60 p-2 dark:border-zinc-800 dark:bg-zinc-900/60">
        {/* eslint-disable-next-line @next/next/no-img-element -- objek dari
            object storage kita sendiri dan rute file; next/image tidak dipakai
            karena lebarnya tidak diketahui dan optimizer tidak menambah nilai. */}
        <img
          src={src}
          alt={title}
          onError={() => setFailed(true)}
          className="mx-auto block h-auto rounded-lg bg-white shadow-lg"
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── Tautan eksternal ────────────────────────────────────────────────────────

function EmbeddedDocument({ src }: { src: string }) {
  let host = "sumber eksternal";
  try {
    const parsed = new URL(src);
    host =
      parsed.hostname === "drive.google.com" || parsed.hostname === "docs.google.com"
        ? "Google Drive"
        : parsed.hostname;
  } catch {
    // URL yang tidak bisa diurai tetap dicoba; biarkan labelnya umum.
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <span>
          Ditampilkan langsung dari {host}. Kalau area di bawah kosong, berkasnya tidak
          mengizinkan tampilan sematan.
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 font-bold underline underline-offset-2"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Buka di tab baru
        </a>
      </div>
      <iframe
        src={src}
        title="Dokumen modul"
        className="min-h-[62vh] w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800"
        referrerPolicy="no-referrer"
        allowFullScreen
      />
    </div>
  );
}

// ─── Keadaan jujur ───────────────────────────────────────────────────────────

function BrokenDocument() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden="true" />
      <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
        Dokumen tidak bisa ditampilkan
      </p>
      <p className="max-w-md text-xs leading-relaxed text-zinc-500">
        Berkas modul ini tidak tersedia atau tautannya tidak dikenali. Ini bukan masalah
        pada perangkatmu — kontributornya perlu mengunggah ulang berkasnya.
      </p>
    </div>
  );
}

function ReaderFailure({
  title,
  detail,
  href,
  filename,
}: {
  title: string;
  detail: string | null;
  href: string;
  filename: string;
}) {
  return (
    <div className="flex min-h-[360px] w-full flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden="true" />
      <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{title}</p>
      {detail && (
        <p className="max-w-md break-words font-mono text-[11px] text-zinc-500">{detail}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
        >
          <ExternalLink className="h-4 w-4" /> Coba buka langsung
        </a>
        <a
          href={href}
          download={filename}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 px-4 py-2 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <Download className="h-4 w-4" /> Unduh berkas
        </a>
      </div>
    </div>
  );
}
