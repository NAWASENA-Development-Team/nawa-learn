// src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Sparkles, Trophy, Zap, BookOpen, Target, Flame } from "lucide-react";
import { Metadata } from "next";
import { POLICY_PATHS } from "@/lib/policy";

export const metadata: Metadata = {
  title: "Daftar Akun | NAWA-LEARN SMAN 2 Jonggol",
  description: "Buat akun NAWA-LEARN gratis dan akses ratusan modul, bank soal, serta raih peringkat pertama di SMAN 2 Jonggol.",
};

export default function SignUpPage() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-zinc-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">

      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[5%] w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl" />
        <div className="absolute bottom-[10%] right-[5%] w-96 h-96 rounded-full bg-purple-500/5 blur-3xl" />
        {/* Floating badges — desktop only */}
        <div className="absolute top-[20%] right-[10%] hidden xl:flex items-center gap-2.5 bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl px-4 py-2.5 shadow-sm rotate-3">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Peringkat #1</span>
        </div>
        <div className="absolute bottom-[20%] left-[6%] hidden xl:flex items-center gap-2.5 bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl px-4 py-2.5 shadow-sm -rotate-6">
          <Zap className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Latih Soal CBT</span>
        </div>
        <div className="absolute top-[45%] left-[3%] hidden xl:flex items-center gap-2.5 bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl px-4 py-2.5 shadow-sm rotate-6">
          <BookOpen className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">240+ Modul Belajar</span>
        </div>
      </div>

      {/* Card container */}
      <div className="relative z-10 w-full max-w-5xl bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-8 lg:p-10 shadow-xl">

        {/* ── Mobile: compact header above form ─────────────────────────── */}
        <div className="lg:hidden mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-zinc-900 dark:text-white">
              NAWA-LEARN
            </span>
          </Link>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white leading-tight">
            Bergabung &amp; jadi lebih hebat!
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Buat akun barumu dan mulai perjalanan belajar yang terarah bersama SMAN 2 Jonggol.
          </p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 justify-center flex-wrap">
            {[
              { icon: Sparkles, text: "Modul gratis", color: "text-indigo-500" },
              { icon: Target, text: "Bank soal CBT", color: "text-amber-500" },
              { icon: Flame, text: "Leaderboard", color: "text-rose-500" },
            ].map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 shrink-0 bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700 rounded-full px-3 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <f.icon className={`h-3.5 w-3.5 ${f.color}`} /> {f.text}
              </span>
            ))}
          </div>
        </div>

        {/* ── Two-column layout (desktop) ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">

          {/* Left panel — desktop only */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between h-full space-y-8 pr-6">
            <div className="space-y-4">
              <Link href="/" className="inline-flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="font-extrabold text-xl tracking-tight text-zinc-900 dark:text-white">
                  NAWA-LEARN
                </span>
              </Link>
              <h2 className="text-4xl xl:text-5xl font-black leading-tight tracking-tight text-zinc-950 dark:text-white">
                Bergabung &amp; Jadi Lebih Hebat
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-base leading-relaxed">
                Buat akun belajarmu sekarang dan mulai perjalanan prestasi yang penuh kolaborasi bersama siswa dan guru SMAN 2 Jonggol.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { icon: Sparkles, text: "Akses ratusan modul terverifikasi gratis", color: "text-indigo-500" },
                { icon: Target, text: "Asah kemampuanmu lewat ribuan bank soal CBT", color: "text-amber-500" },
                { icon: Flame, text: "Kumpulkan Poin XP & rebut takhta leaderboard!", color: "text-rose-500" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 shadow-sm transition-all">
                  <div className="h-7 w-7 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-center shrink-0">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{item.text}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              Dikelola oleh OSIS NAWASENA SMAN 2 Jonggol · Divisi ICT
            </p>
          </div>

          {/* Right panel — Clerk form */}
          <div className="lg:col-span-7 flex justify-center items-center w-full">
            <div className="w-full max-w-[440px]">
              <SignUp
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                fallbackRedirectUrl="/modules"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    cardBox: "w-full shadow-none",
                    card: "bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-xl",
                    headerTitle: "text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight",
                    headerSubtitle: "text-sm font-semibold text-zinc-400 dark:text-zinc-500 mt-1",
                    socialButtonsBlockButton: "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 py-2.5 transition-all active:scale-[0.98]",
                    socialButtonsBlockButtonText: "font-bold text-sm",
                    dividerLine: "bg-zinc-100 dark:bg-zinc-800",
                    dividerText: "text-xs font-bold text-zinc-400 dark:text-zinc-500 px-3 bg-white dark:bg-zinc-950",
                    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-3 font-extrabold text-sm shadow-sm transition-all active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-600",
                    formFieldInput: "rounded-2xl border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 py-3 text-sm transition-all",
                    formFieldLabel: "text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5",
                    footerActionLink: "text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-extrabold text-sm transition-colors",
                    footerActionText: "text-zinc-500 dark:text-zinc-400 font-semibold text-sm",
                    formFieldAction: "text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold text-xs",
                  }
                }}
              />

              {/* ── Pemberitahuan persetujuan (UU PDP) ────────────────────────
                  Persetujuan yang *tercatat* diambil satu langkah setelah ini,
                  di /consent, dengan kotak centang yang harus dicentang sendiri
                  dan tombol yang menulis timestamp + versi kebijakan. Yang ada
                  di sini adalah pemberitahuannya: siswa berhak tahu sejak awal
                  apa yang akan ia setujui, sebelum mengetikkan apa pun. */}
              <p className="mt-4 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Setelah akun dibuat, kamu akan diminta menyetujui{" "}
                <Link
                  href={POLICY_PATHS.privacy}
                  target="_blank"
                  className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Kebijakan Privasi
                </Link>{" "}
                dan{" "}
                <Link
                  href={POLICY_PATHS.terms}
                  target="_blank"
                  className="font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Ketentuan Layanan
                </Link>{" "}
                kami sebelum bisa memakai fitur-fiturnya. Bacalah dulu — keduanya ditulis
                dengan bahasa sehari-hari, bukan pasal berbelit.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
