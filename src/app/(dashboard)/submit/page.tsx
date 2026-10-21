import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import SubmitClient from "@/components/submit/SubmitClient";
import Link from "next/link";
import { Lock, Sparkles, BrainCircuit } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    redirect("/sign-in");
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    // Only the role is needed here; avoids pulling the (potentially large)
    // base64 photoUrl and other unused columns.
    columns: { role: true },
  });

  if (!dbUser) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Sinkronisasi Diperlukan</h2>
        <p className="mt-2 text-zinc-500">Silakan muat ulang halaman atau login kembali.</p>
      </div>
    );
  }

  // Block 'student' role
  if (dbUser.role === "student") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:px-8 text-center">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden">
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-nawa-warning/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="mx-auto h-20 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 border border-zinc-200 dark:border-zinc-700 shadow-inner">
              <Lock className="h-10 w-10 text-zinc-400" />
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-4">
              Akses Terkunci
            </h1>
            
            <p className="text-zinc-600 dark:text-zinc-400 text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-8">
              Halaman kontribusi modul dan soal ini eksklusif bagi pengguna dengan peringkat minimal <span className="font-bold text-nawa-primary dark:text-indigo-400">KONTRIBUTOR</span>.
              Saat ini statusmu adalah <span className="font-bold text-zinc-700 dark:text-zinc-300">SISWA</span>.
            </p>
            
            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl p-6 text-left mb-8">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4" /> Cara Membuka Akses
              </h3>
              <p className="text-sm text-nawa-primary-hover dark:text-indigo-400">
                Kumpulkan V-Point pertamamu dengan cara mengerjakan dan menguasai <Link href="/questions/practice" className="font-bold underline hover:text-indigo-800 dark:hover:text-indigo-300">Latihan Soal Adaptif</Link> atau <Link href="/questions/daily" className="font-bold underline hover:text-indigo-800 dark:hover:text-indigo-300">Kuis Harian</Link>. 
                Setelah poinmu bertambah, statusmu akan otomatis naik menjadi Kontributor!
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link 
                href="/questions/practice" 
                className="inline-flex items-center justify-center gap-2 bg-nawa-primary hover:bg-nawa-primary-hover text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95"
              >
                <BrainCircuit className="h-5 w-5" /> Kerjakan Latihan CBT
              </Link>
              <Link 
                href="/" 
                className="inline-flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-6 py-3 rounded-xl font-bold transition-all active:scale-95"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <SubmitClient />;
}