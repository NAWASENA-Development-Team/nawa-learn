"use client";

// src/app/error.tsx
// ─── Batas galat untuk seluruh halaman ────────────────────────────────────────
// Satu berkas, bukan satu per segmen. Alasannya bukan kemalasan: `error.tsx`
// dirender di dalam layout akar, jadi Navbar dan footer tetap ada di sini persis
// seperti di halaman normal. Menambahkan salinan di `(dashboard)/` hanya akan
// menghasilkan tampilan yang identik, karena layout grup itu sendiri tidak punya
// kerangka visual — isinya hanya gerbang consent yang mengembalikan `children`.
//
// Yang **tidak** ditangkap di sini: galat di `src/app/layout.tsx`. Untuk itu ada
// `global-error.tsx`, dan hanya untuk itu.
//
// Kenapa galat dicatat ke konsol: sebuah batas galat berjalan di peramban, di
// luar permintaan mana pun yang punya `requestId`, dan `src/lib/logger.ts`
// server-only. `digest` yang ditampilkan di bawah adalah satu-satunya benang yang
// menghubungkan laporan seorang siswa dengan baris log server.
import { useEffect } from "react";
import Link from "next/link";
import { House, RotateCcw, TriangleAlert } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route_error", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-10 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40">
          <TriangleAlert className="h-7 w-7 text-rose-600 dark:text-rose-400" aria-hidden />
        </div>

        <h1 className="mt-5 text-2xl font-extrabold text-zinc-900 dark:text-white">
          Halaman gagal dimuat
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Terjadi kesalahan saat mengambil data untuk halaman ini. Coba lagi; bila
          terus berulang, laporkan kode kejadian di bawah kepada pengurus OSIS.
        </p>

        {error.digest ? (
          <p className="mt-4 break-all rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            Kode kejadian: {error.digest}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.98] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Coba lagi
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 active:scale-[0.98]"
          >
            <House className="h-4 w-4" aria-hidden />
            Ke beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
