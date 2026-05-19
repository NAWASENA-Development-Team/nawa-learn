// src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-zinc-950 dark:via-indigo-950/20 dark:to-purple-950/20 py-8 px-4 sm:px-6 lg:px-8">

      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-indigo-300/30 dark:bg-indigo-500/10 blur-2xl animate-[pulse_6s_infinite]" />
        <div className="absolute bottom-[10%] right-[5%] w-80 h-80 rounded-full bg-pink-300/30 dark:bg-pink-500/10 blur-2xl animate-[pulse_8s_infinite]" />
        {/* Floating badges — desktop only */}
        <div className="absolute top-[20%] right-[10%] hidden xl:flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800/50 rounded-2xl px-4 py-2.5 rotate-6 shadow-md animate-[bounce_4s_infinite]">
          <span className="text-xl">🏆</span>
          <span className="text-xs font-bold text-yellow-800 dark:text-yellow-400">Peringkat #1</span>
        </div>
        <div className="absolute bottom-[20%] left-[6%] hidden xl:flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-800/50 rounded-2xl px-4 py-2.5 -rotate-12 shadow-md animate-[bounce_5s_infinite_1s]">
          <span className="text-xl">⚡</span>
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Latih Soal Seru</span>
        </div>
        <div className="absolute top-[45%] left-[3%] hidden xl:flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-800/50 rounded-2xl px-4 py-2.5 rotate-12 shadow-md animate-[bounce_6s_infinite_2s]">
          <span className="text-xl">📚</span>
          <span className="text-xs font-bold text-indigo-800 dark:text-indigo-400">247+ Modul Kece</span>
        </div>
      </div>

      {/* Card container */}
      <div className="relative z-10 w-full max-w-5xl bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border border-white/60 dark:border-zinc-800/40 rounded-3xl p-5 sm:p-8 lg:p-10 shadow-2xl shadow-indigo-500/5">

        {/* ── Mobile: compact header above form ─────────────────────────── */}
        <div className="lg:hidden mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-black text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
              NAWA-LEARN
            </span>
          </Link>
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white leading-tight">
            Bergabung &amp; jadi{" "}
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              lebih hebat! 🎉
            </span>
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Buat akun barumu dan mulai perjalanan belajar yang seru bersama SMAN 2 Jonggol.
          </p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 justify-center flex-wrap">
            {[
              { emoji: "✨", text: "Modul gratis" },
              { emoji: "🎯", text: "Bank soal" },
              { emoji: "🔥", text: "Leaderboard" },
            ].map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 shrink-0 bg-white/70 dark:bg-zinc-800/60 border border-white dark:border-zinc-700 rounded-full px-3 py-1 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {f.emoji} {f.text}
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
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="font-black text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                  NAWA-LEARN
                </span>
              </Link>
              <h2 className="text-4xl xl:text-5xl font-black leading-tight tracking-tight text-zinc-900 dark:text-white">
                Bergabung &amp; Jadi{" "}
                <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                  Lebih Hebat! 🎉
                </span>
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-base leading-relaxed">
                Buat akun barumu sekarang dan mulailah perjalanan belajarmu yang penuh keseruan dan kolaborasi.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { emoji: "✨", text: "Akses ratusan modul terverifikasi gratis" },
                { emoji: "🎯", text: "Asah kemampuanmu lewat ribuan bank soal" },
                { emoji: "🔥", text: "Kumpulkan poin & rebut takhta leaderboard!" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-white/60 dark:bg-zinc-800/40 border border-white dark:border-zinc-800/50 shadow-sm transition-transform hover:scale-[1.02]">
                  <span className="text-xl shrink-0">{item.emoji}</span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{item.text}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">
              Dibuat dengan penuh ⚡ oleh OSIS NAWASENA SMAN 2 Jonggol.
            </p>
          </div>

          {/* Right panel — Clerk form */}
          <div className="lg:col-span-7 flex justify-center items-center w-full">
            <div className="w-full max-w-[440px] relative">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur-lg opacity-20" />
              <SignUp
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    cardBox: "w-full shadow-none",
                    card: "bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-900 rounded-3xl p-5 sm:p-7 shadow-2xl",
                    headerTitle: "text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight",
                    headerSubtitle: "text-sm font-semibold text-zinc-400 dark:text-zinc-500 mt-1",
                    socialButtonsBlockButton: "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 py-2.5 transition-all",
                    socialButtonsBlockButtonText: "font-bold text-sm",
                    dividerLine: "bg-zinc-100 dark:bg-zinc-800",
                    dividerText: "text-xs font-bold text-zinc-400 dark:text-zinc-500 px-3 bg-white dark:bg-zinc-950",
                    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-3 font-extrabold text-sm shadow-lg shadow-indigo-500/25 transition-all active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-600",
                    formFieldInput: "rounded-2xl border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 py-3 text-sm transition-all",
                    formFieldLabel: "text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-1.5",
                    footerActionLink: "text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-extrabold text-sm transition-colors",
                    footerActionText: "text-zinc-500 dark:text-zinc-400 font-semibold text-sm",
                    formFieldAction: "text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-bold text-xs",
                  }
                }}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
