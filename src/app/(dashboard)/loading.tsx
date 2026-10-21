import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    // `role="status"` supaya pembaca layar mengumumkan status memuat ini; ikonnya
    // sendiri dekoratif dan tidak perlu dibacakan.
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 w-full" role="status">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse" aria-hidden />
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm relative z-10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-nawa-primary dark:text-indigo-400" aria-hidden />
        </div>
      </div>
      <div className="text-center">
        <h3 className="font-extrabold text-zinc-900 dark:text-white text-lg">Memuat Halaman...</h3>
        <p className="text-xs text-zinc-500 mt-1">Tunggu sebentar, sedang menyiapkan data untukmu.</p>
      </div>
    </div>
  );
}
