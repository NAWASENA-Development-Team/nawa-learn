import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import SubmitClient from "@/components/submit/SubmitClient";
import Link from "next/link";
import { Gavel, ShieldCheck, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Pintu masuk kontribusi.
 *
 * Sampai M17 halaman ini menolak `role === "student"` sepenuhnya, dan itu
 * membuat jalan evolusi peran mustahil: peran hanya naik lewat karya yang
 * disetujui, sementara karya tidak bisa diajukan sebelum perannya naik. M18
 * membalik urutannya — **semua** pengguna yang bukan pemegang kursi boleh
 * mengajukan modul dan soal, dan peran naik setelah karyanya diterima.
 *
 * Yang tetap ditolak adalah **kursi Dewan Podium**, dan penolakannya di sini
 * bukan hiasan: API-nya sudah menjawab `403 seat_cannot_upload`, jadi menampilkan
 * formulir kepada pemegang kursi berarti menampilkan formulir yang pasti gagal.
 *
 * Satu hal yang **tidak** dibuka untuk siswa adalah tab paket ujian: membuat
 * paket ujian tetap khusus kontributor dan staf (M18). Peran itu dihitung di sini
 * dan dikirim sebagai `canCreateExam`, supaya tab yang pasti dijawab
 * `403 contributor_required` tidak pernah dirender.
 */
export default async function SubmitPage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    // Only what this page decides on; avoids pulling the (potentially large)
    // base64 photoUrl and other unused columns.
    columns: { role: true, seasonRoleKey: true },
  });

  if (!dbUser) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Sinkronisasi Diperlukan</h2>
        <p className="mt-2 text-zinc-500">Silakan muat ulang halaman atau login kembali.</p>
      </div>
    );
  }

  // Kursi musim tidak membuat konten. Kuncinya `season_role_key !== null`, bukan
  // "kursi masih aktif": peran yang berasal dari musim tidak pernah memberi hak
  // unggah, termasuk pada hari terakhir sebelum cron mencabutnya.
  if (dbUser.seasonRoleKey !== null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8 text-center">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="mx-auto h-20 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 border border-zinc-200 dark:border-zinc-700 shadow-inner">
              <Gavel className="h-10 w-10 text-zinc-400" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-4">
              Kursi Dewan Podium
            </h1>

            <p className="text-zinc-600 dark:text-zinc-400 text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-8">
              Selama musim ini kamu memegang kursi moderasi, jadi kamu <span className="font-bold text-zinc-800 dark:text-zinc-200">tidak dapat mengunggah</span> modul
              maupun soal. Kursi adalah amanah menilai: penulis yang juga penilai bisa
              menerbitkan karyanya sendiri.
            </p>

            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-6 text-left mb-8">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4" /> Yang tetap bisa kamu lakukan
              </h3>
              <p className="text-sm text-nawa-primary-hover dark:text-indigo-400">
                Meninjau kiriman modul, soal, dan paket ujian di{" "}
                <Link href="/moderator" className="font-bold underline hover:text-indigo-800 dark:hover:text-indigo-300">panel moderator</Link>.
                Mengerjakan kuis harian, latihan, dan ujian juga tetap terbuka — kursi
                berakhir dengan sendirinya saat musim berganti, dan hak unggahmu kembali.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href="/moderator"
                className="inline-flex items-center justify-center gap-2 bg-nawa-primary hover:bg-nawa-primary-hover text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95"
              >
                <ShieldCheck className="h-5 w-5" /> Buka Panel Moderator
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-6 py-3 rounded-xl font-bold transition-all active:scale-95"
              >
                Kembali ke Beranda <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <SubmitClient canCreateExam={dbUser.role !== "student"} />;
}
