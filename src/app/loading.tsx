// src/app/loading.tsx
// ─── Status memuat untuk segmen akar ──────────────────────────────────────────
// Halaman di bawah `(dashboard)/` sudah punya `loading.tsx` sendiri (yang terdekat
// menang), jadi berkas ini menutupi sisanya: beranda `/` — yang menjalankan lima
// query agregat sebelum bisa dirender — serta `/privacy`, `/terms`, `/consent`
// dan halaman masuk/daftar.
//
// Bentuknya sengaja minimal. Skeleton besar milik `(dashboard)/` masuk akal karena
// tata letak halaman di sana sudah diketahui; di sini yang ditunggu justru
// sebaliknya, jadi kartu besar yang berkedip lalu hilang akan lebih terasa seperti
// galat daripada seperti kemajuan.
//
// Cincin CSS, bukan ikon: tidak ada berkas ikon tambahan yang perlu diunduh
// sebelum sesuatu bisa ditampilkan.
export default function RootLoading() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
      {/* `role="status"` membuat pembaca layar mengumumkan "Memuat…" tanpa perlu
          memindahkan fokus. Cincinnya sendiri tetap `aria-hidden`: bagi pembaca
          layar ia tidak membawa informasi apa pun. */}
      <div className="flex flex-col items-center gap-4" role="status">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-nawa-primary dark:border-zinc-700 dark:border-t-indigo-400"
          aria-hidden
        />
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Memuat…</p>
      </div>
    </div>
  );
}
