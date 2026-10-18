// src/app/not-found.tsx
// ─── 404 ──────────────────────────────────────────────────────────────────────
// Dipakai untuk dua hal: URL yang tidak cocok dengan route mana pun, dan
// `notFound()` yang dipanggil dari sebuah halaman (mis. `profile/[id]` dengan
// segmen yang bukan UUID).
//
// Ini komponen server, dan tetap begitu: tidak ada satu pun bagian yang butuh
// state atau event, jadi mengirimnya sebagai JavaScript ke peramban hanya
// menambah bundel untuk halaman yang isinya tiga tautan.
//
// Ia dirender di dalam layout akar, sehingga Navbar dan footer tetap tampil.
// Karena itu tidak ada `not-found.tsx` per segmen: versi di `(dashboard)/` akan
// menghasilkan markup yang sama persis.
import Link from "next/link";
import { Compass, House } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-10 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/40">
          <Compass className="h-7 w-7 text-indigo-600 dark:text-indigo-400" aria-hidden />
        </div>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
          404
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-zinc-900 dark:text-white">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Alamat yang kamu buka tidak ada, atau tautannya sudah usang. Mungkin
          salah ketik sedikit?
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700"
          >
            <House className="h-4 w-4" aria-hidden />
            Ke beranda
          </Link>
          {/* Tautan ini benar untuk pengunjung yang sudah masuk. Pengunjung
              anonim memang tidak akan sampai di halaman ini sama sekali: proxy
              mengalihkan setiap path yang tidak dikenal ke halaman masuk, jadi
              struktur route tidak bocor ke publik. */}
          <Link
            href="/modules"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 px-5 py-2.5 text-xs font-bold text-zinc-700 transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
          >
            Jelajahi modul
          </Link>
        </div>
      </div>
    </div>
  );
}
