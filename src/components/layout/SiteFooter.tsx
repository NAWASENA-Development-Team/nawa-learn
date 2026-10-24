// src/components/layout/SiteFooter.tsx
// ─── Footer situs untuk setiap halaman kecuali landing page ───────────────────
// Footer ini dulu hidup di `src/app/layout.tsx`, yang merendernya untuk **semua**
// halaman — termasuk landing page. Landing page punya footernya sendiri yang
// lebih lengkap (tautan navigasi situs, "Hak cipta dilindungi", "100% Bebas
// Iklan · Tanpa Pelacak Komersial"), sehingga di sana dua footer bertumpuk.
// Memindahkannya ke komponen ini dan merendernya per layout/halaman adalah cara
// satu-satunya untuk menghilangkannya di landing page **tanpa** menghilangkannya
// di halaman lain: layout akar tidak tahu rute apa yang sedang dirender, jadi
// keputusannya tidak bisa diambil di satu tempat.
//
// Yang paling bergantung padanya: halaman masuk dan pendaftaran. Dokumen hukum
// harus bisa dibaca **sebelum** mendaftar, jadi tautan Privasi/Ketentuan tetap
// ada di footer ini — termasuk untuk pengunjung yang belum punya akun.
//
// `mt-auto`: layout akar membungkus halaman dengan `<main className="flex-1 …">`
// (kolom flex), jadi footer ini menempel ke dasar layar meski isi halaman pendek.
// Di luar konteks flex `margin-top: auto` jatuh ke 0, jadi kelas ini aman walau
// komponennya dipakai ulang.
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto py-6 text-center text-sm text-zinc-400 dark:text-zinc-500 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <p>
        © {new Date().getFullYear()} OSIS NAWASENA SMAN 2 Jonggol. Developed by the ICT Division.
      </p>
      <nav className="mt-2 flex items-center justify-center gap-4 text-xs font-semibold">
        <Link href="/privacy" className="hover:text-nawa-primary hover:underline dark:hover:text-indigo-400">
          Kebijakan Privasi
        </Link>
        <span aria-hidden className="text-zinc-300 dark:text-zinc-700">•</span>
        <Link href="/terms" className="hover:text-nawa-primary hover:underline dark:hover:text-indigo-400">
          Ketentuan Layanan
        </Link>
      </nav>
    </footer>
  );
}
