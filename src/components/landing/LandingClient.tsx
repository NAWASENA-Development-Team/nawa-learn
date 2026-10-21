// src/components/landing/LandingClient.tsx
"use client";

import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  Trophy,
  Shield,
  GraduationCap,
  CheckCircle2,
  FileText,
  Check,
  Zap,
  Award,
  Target,
  Clock,
  ArrowUpRight,
  Lock,
} from "lucide-react";
import NawaIcon from "@/components/icons/NawaIcon";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import { LatexRenderer } from "@/components/ui/LatexRenderer";

/* ── Live Animated Counter ─────────────────────────────────────────────────── */
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      observer.disconnect();
      const duration = 1200;
      const steps = 60;
      const step = Math.max(1, Math.floor(target / steps));
      let current = 0;
      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          setCount(target);
          clearInterval(timer);
        } else {
          setCount(current);
        }
      }, duration / steps);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString("id-ID")}{suffix}</span>;
}

/* ── Props ────────────────────────────────────────────────────────────────── */
interface SampleModule {
  id: string;
  title: string;
  subject: string;
  category: string;
  downloads: number;
  uploaderName: string;
  points: number;
}

interface LandingClientProps {
  stats: {
    modules: number;
    questions: number;
    students: number;
    contributors: number;
  };
  sampleModules: SampleModule[];
}

export default function LandingClient({ stats, sampleModules }: LandingClientProps) {
  // Interactive Simulator Tab state: "cbt" | "avatar"
  const [activeSimTab, setActiveSimTab] = useState<"cbt" | "avatar">("cbt");

  // CBT interactive practice state
  const [selectedOption, setSelectedOption] = useState<string | null>("B");
  const [hasCheckedAnswer, setHasCheckedAnswer] = useState<boolean>(true);

  // Avatar showcase state
  const [selectedAvatarIdx, setSelectedAvatarIdx] = useState<number>(0);
  const currentAvatar = useMemo(() => AVATAR_OPTIONS[selectedAvatarIdx] ?? AVATAR_OPTIONS[0], [selectedAvatarIdx]);

  return (
    <div className="relative overflow-x-hidden bg-white text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-50">

      {/* ══════════════════════════════════════════════════════════════════════
          HERO SECTION
          Persuade mode: clear value proposition, high typographic authority,
          zero kicker/eyebrow, and authentic scholastic ambiance.
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative isolate pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden border-b border-zinc-200/80 dark:border-zinc-800/80">
        {/* Ambient atmospheric aura — subtle diffused glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[550px] w-[920px] rounded-full bg-gradient-to-b from-indigo-500/12 via-violet-500/6 to-transparent blur-[90px] dark:from-nawa-primary/15 dark:via-nawa-secondary/8" />
          <div className="absolute top-1/3 -right-32 h-[380px] w-[380px] rounded-full bg-purple-500/8 blur-[80px] dark:bg-purple-600/10" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">

            {/* Direct Authoritative Headline (No kicker/eyebrow above) */}
            <h1 className="max-w-4xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-zinc-900 dark:text-white">
              Ruang Belajar Bersama &amp; Simulasi Ujian SMAN 2 Jonggol
            </h1>

            {/* Clear, High-Yield Subheading */}
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-lg md:text-xl">
              Akses modul terverifikasi dari rekan sebayamu, kuasai latihan soal UTBK dan olimpiade dengan notasi LaTeX presisi, dan kumpulkan pencapaian akademikmu dalam ekosistem belajar yang jujur dan suportif.
            </p>

            {/* Primary & Secondary Action Pair */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Show when="signed-out">
                <Link
                  id="hero-cta-register"
                  href="/sign-in"
                  className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-nawa-primary to-nawa-secondary px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:from-nawa-primary-hover hover:to-nawa-secondary-hover hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Mulai Belajar Sekarang
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <Link
                  id="hero-cta-modules"
                  href="/modules"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-300 hover:-translate-y-0.5 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
                >
                  <BookOpen className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                  Jelajahi Bank Modul
                </Link>
              </Show>

              <Show when="signed-in">
                <Link
                  id="hero-cta-practice"
                  href="/questions/practice"
                  className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-nawa-primary to-nawa-secondary px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:from-nawa-primary-hover hover:to-nawa-secondary-hover hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Masuk Ruang Latihan Soal
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <Link
                  id="hero-cta-leaderboard"
                  href="/leaderboard"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-300 hover:-translate-y-0.5 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
                >
                  <Trophy className="h-4 w-4 text-nawa-warning" />
                  Papan Peringkat Musim
                </Link>
              </Show>
            </div>

            {/* Seamless Live Data Ribbon (Not fragmented cookie-cutter metric cards) */}
            <div className="mt-12 w-full max-w-4xl rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/60 sm:p-5">
              <div className="grid grid-cols-2 gap-4 divide-y divide-zinc-200/60 dark:divide-zinc-800/60 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
                <div className="flex flex-col items-center justify-center pt-2 sm:pt-0">
                  <div className="text-2xl font-black text-nawa-primary dark:text-indigo-400 sm:text-3xl">
                    <Counter target={stats.modules} suffix="+" />
                  </div>
                  <span className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Modul Terverifikasi</span>
                </div>
                <div className="flex flex-col items-center justify-center pt-2 sm:pt-0">
                  <div className="text-2xl font-black text-nawa-secondary dark:text-violet-400 sm:text-3xl">
                    <Counter target={stats.questions} suffix="+" />
                  </div>
                  <span className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Bank Soal Latihan</span>
                </div>
                <div className="flex flex-col items-center justify-center pt-2 sm:pt-0">
                  <div className="text-2xl font-black text-zinc-900 dark:text-white sm:text-3xl">
                    <Counter target={stats.students} suffix="+" />
                  </div>
                  <span className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Siswa Terdaftar</span>
                </div>
                <div className="flex flex-col items-center justify-center pt-2 sm:pt-0">
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 sm:text-3xl">
                    <Counter target={stats.contributors} suffix="+" />
                  </div>
                  <span className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Kontributor Aktif</span>
                </div>
              </div>
            </div>

            {/* ── Interactive Arcane Academy Live Simulator ── */}
            <div className="mt-12 w-full max-w-4xl text-left">
              {/* Simulator Switcher Bar */}
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-100/80 px-4 py-2.5 rounded-t-2xl dark:border-zinc-800 dark:bg-zinc-900/80">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveSimTab("cbt")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      activeSimTab === "cbt"
                        ? "bg-white text-nawa-primary-hover shadow-sm dark:bg-zinc-800 dark:text-indigo-400"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    <GraduationCap className="h-4 w-4 text-indigo-500" />
                    Simulasi CBT &amp; LaTeX
                  </button>
                  <button
                    onClick={() => setActiveSimTab("avatar")}
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      activeSimTab === "avatar"
                        ? "bg-white text-nawa-primary-hover shadow-sm dark:bg-zinc-800 dark:text-indigo-400"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    <Trophy className="h-4 w-4 text-nawa-warning" />
                    Gelar &amp; 22+ Avatar Siswa
                  </button>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                  <span className="inline-block h-2 w-2 rounded-full bg-nawa-success animate-pulse" />
                  Pratinjau Interaktif
                </div>
              </div>

              {/* Simulator Viewport Container */}
              <div className="rounded-b-2xl border-x border-b border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
                {activeSimTab === "cbt" ? (
                  <div>
                    {/* Simulated Quiz Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-nawa-primary-hover dark:bg-indigo-950/60 dark:text-indigo-400">
                          Matematika Saintek
                        </span>
                        <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                          UTBK-SNBT · Sulit
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-zinc-500 dark:text-zinc-400">
                        <Clock className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Sisa Waktu: 18:45</span>
                      </div>
                    </div>

                    {/* Question with KaTeX Formula */}
                    <div className="mt-5">
                      <h2 className="text-base font-bold text-zinc-900 dark:text-white sm:text-lg">
                        Tentukan nilai limit trigonometri berikut:
                      </h2>
                      <div className="my-3 rounded-xl bg-zinc-50/80 p-3.5 text-center text-base sm:text-lg dark:bg-zinc-950/60">
                        <LatexRenderer text="$\lim_{x \to 0} \frac{\sin(4x) \cdot \tan(3x)}{1 - \cos(2x)} = \dots$" />
                      </div>
                    </div>

                    {/* Interactive Multiple Choice Options */}
                    <div className="mt-4 space-y-2.5">
                      {[
                        { key: "A", val: "$3$" },
                        { key: "B", val: "$6$", correct: true },
                        { key: "C", val: "$8$" },
                        { key: "D", val: "$12$" },
                      ].map((opt) => {
                        const isChosen = selectedOption === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => {
                              setSelectedOption(opt.key);
                              setHasCheckedAnswer(true);
                            }}
                            className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all duration-150 cursor-pointer ${
                              isChosen
                                ? opt.correct
                                  ? "border-nawa-success bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200"
                                  : "border-nawa-error bg-rose-50/70 text-rose-950 dark:bg-rose-950/40 dark:text-rose-200"
                                : "border-zinc-200 bg-white hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-indigo-800"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                  isChosen
                                    ? opt.correct
                                      ? "bg-emerald-600 text-white"
                                      : "bg-rose-600 text-white"
                                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                }`}
                              >
                                {opt.key}
                              </span>
                              <span className="text-sm font-semibold">
                                <LatexRenderer text={opt.val} />
                              </span>
                            </div>
                            {isChosen && (
                              <span className="flex items-center gap-1 text-xs font-bold">
                                {opt.correct ? (
                                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                    <Check className="h-4 w-4" /> Benar (+50 XP)
                                  </span>
                                ) : (
                                  <span className="text-rose-600 dark:text-rose-400">Kurang Tepat</span>
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Step-by-Step Explanation Bar */}
                    {hasCheckedAnswer && (
                      <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
                        <span className="font-bold">Pembahasan Singkat:</span> Gunakan identitas sudut ganda{" "}
                        <LatexRenderer text="$1 - \cos(2x) = 2\sin^2(x)$" />. Maka limit menjadi{" "}
                        <LatexRenderer text="$\lim_{x \to 0} \frac{\sin(4x) \cdot \tan(3x)}{2\sin^2(x)} = \frac{4 \cdot 3}{2 \cdot 1^2} = 6$" />.
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Simulated Profile & Avatar Vault */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 dark:bg-zinc-950 dark:border-zinc-800">
                        <div className="relative mb-3 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-1 shadow-lg shadow-indigo-500/20">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={currentAvatar.svg}
                            alt={currentAvatar.label}
                            className="h-20 w-20 rounded-xl bg-zinc-900 object-cover"
                          />
                          <span className="absolute -top-2 -right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950 shadow">
                            Lv. 10
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-zinc-900 dark:text-white">Ahmad Fauzi</h3>
                        <p className="text-xs font-semibold text-nawa-primary dark:text-indigo-400">{currentAvatar.label}</p>
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-100/70 px-2.5 py-1 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                          <Trophy className="h-3.5 w-3.5 text-nawa-warning" /> Peringkat #3 Sekolah
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-4">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                            Pilih Avatar Fantasy &amp; Sci-Fi (22+ Karakter):
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {AVATAR_OPTIONS.slice(0, 8).map((av, idx) => (
                              <button
                                key={av.svg}
                                onClick={() => setSelectedAvatarIdx(idx)}
                                title={av.label}
                                className={`flex h-11 w-11 items-center justify-center rounded-xl border p-1 transition-all cursor-pointer ${
                                  selectedAvatarIdx === idx
                                    ? "border-nawa-primary bg-indigo-50 shadow-md ring-2 ring-indigo-500/30 dark:bg-indigo-950"
                                    : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
                                }`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={av.svg} alt={av.label} className="h-8 w-8 rounded-lg object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                            Tingkat Kelangkaan Lencana (80+ Achievements):
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[11px] font-bold">
                            <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-2 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                              Common
                            </div>
                            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 p-2 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Uncommon
                            </div>
                            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/60 p-2 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              Rare
                            </div>
                            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/60 p-2 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              Epic
                            </div>
                            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/60 p-2 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 col-span-2 sm:col-span-1">
                              Legendary
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          CONTENT-LED BENTO ARCHITECTURE
          Refuses same-size card ruts. Asymmetric, purpose-driven panels
          grounded in real student workflows.
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 bg-zinc-50/50 dark:bg-zinc-950/50 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* Section Heading (No kicker) */}
          <div className="max-w-3xl">
            <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white sm:text-4xl md:text-5xl">
              Pilar Pembelajaran NAWA-LEARN
            </h2>
            <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
              Dirancang untuk memenuhi kebutuhan nyata siswa SMAN 2 Jonggol: dari persiapan ujian semester hingga seleksi perguruan tinggi negeri.
            </p>
          </div>

          {/* Asymmetric Bento Showcase */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Bento Card 1: Bank Soal & Mesin CBT Presisi (Wide 2-col) */}
            <div className="md:col-span-2 rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-sm transition-all duration-200 hover:border-indigo-300 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-indigo-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-nawa-primary dark:bg-indigo-950/60 dark:text-indigo-400">
                    <Target className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Simulasi &amp; Latihan
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  Bank Soal Terverifikasi &amp; Penilaian Aman
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-xl">
                  Kerjakan ratusan soal latihan dari mata pelajaran Matematika, Fisika, Kimia, hingga Biologi. Dilengkapi format persamaan LaTeX presisi, penilaian server-side anti-bocor, serta pembahasan terstruktur di akhir pengerjaan.
                </p>

                {/* Sub-capabilities list */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-nawa-success shrink-0 mt-0.5" />
                    <span>Dukungan rumus matematika &amp; sains standar KaTeX</span>
                  </div>
                  <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-nawa-success shrink-0 mt-0.5" />
                    <span>Tingkat kesulitan terstandar: Mudah, Sedang, Sulit</span>
                  </div>
                  <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-nawa-success shrink-0 mt-0.5" />
                    <span>Ujian kustom adaptif dengan timer simulasi UTBK</span>
                  </div>
                  <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-nawa-success shrink-0 mt-0.5" />
                    <span>Poin dan reward dievaluasi langsung di sisi server</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <Link
                  href="/questions/practice"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-nawa-primary hover:text-nawa-primary-hover dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                >
                  Buka Ruang Latihan Soal
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <span className="text-xs font-semibold text-zinc-400">Gratis &amp; Terbuka</span>
              </div>
            </div>

            {/* Bento Card 2: Vault Modul Terkurasi (1-col) */}
            <div className="rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-sm transition-all duration-200 hover:border-violet-300 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-violet-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-nawa-secondary dark:bg-violet-950/60 dark:text-violet-400">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Catatan Sebaya
                  </span>
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                  Perpustakaan Modul Terkurasi
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Kumpulan ringkasan materi, peta konsep, dan catatan ujian buatan siswa SMAN 2 Jonggol. Setiap modul melewati kurasi moderator sebelum dipublikasikan.
                </p>

                <div className="mt-6 space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-500" />
                    <span>Mendukung PDF &amp; catatan bergambar resolusi tinggi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-nawa-success" />
                    <span>Verifikasi ketat oleh tim kurator OSIS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-nawa-warning" />
                    <span>Hadiah +50 poin untuk setiap modul yang disetujui</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <Link
                  href="/modules"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-nawa-secondary hover:text-nawa-secondary-hover dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
                >
                  Telusuri Semua Modul
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Bento Card 3: Kuis Harian Berhadiah (1-col) */}
            <div className="rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-sm transition-all duration-200 hover:border-amber-300 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-amber-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                    <Zap className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Streak Harian
                  </span>
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                  Kuis Harian Adaptif
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Tantang pemahaman konsepmu setiap hari dengan kuis acak adaptif. Selesaikan satu set soal harian dan klaim poin musim untuk menjaga momentum belajarmu.
                </p>
                <div className="mt-5 rounded-2xl bg-amber-50/70 p-3.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200/60 dark:border-amber-900/40">
                  <span className="font-bold">Reset otomatis:</span> Pukul 03.00 WIB setiap pagi. Uji konsistensimu!
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <Link
                  href="/questions/practice"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                >
                  Mulai Kuis Hari Ini
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Bento Card 4: Gamifikasi, Avatar, & Privasi UU PDP (Wide 2-col) */}
            <div className="md:col-span-2 rounded-3xl border border-zinc-200/80 bg-white p-8 shadow-sm transition-all duration-200 hover:border-emerald-300 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-emerald-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <Shield className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Integritas &amp; Privasi
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  Peringkat Sehat &amp; Kepatuhan Privasi Penuh
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-xl">
                  Kompetisi akademik yang sehat dilindungi oleh sistem keamanan berlapis. Nilai dan peringkat dihitung murni dari kontribusi dan hasil latihan, didukung tata kelola data pribadi sesuai UU PDP Indonesia.
                </p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-nawa-warning" /> 80+ Lencana &amp; Papan Peringkat
                    </h4>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Lencana dikelompokkan dalam 5 kategori prestasi dengan 5 tingkat kelangkaan resmi.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <Lock className="h-4 w-4 text-nawa-success" /> Perlindungan Privasi UU PDP
                    </h4>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      Persetujuan eksplisit, ekspor data mandiri (CSV/JSON), dan opsi anonimisasi akun kapan saja.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <Link
                  href="/leaderboard"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                >
                  Lihat Papan Peringkat
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/privacy"
                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
                >
                  Kebijakan Privasi
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          LIVE MODULE REPOSITORY PREVIEW
          Real data feed from the database: authentic notes & verified downloads.
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-24 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white sm:text-3xl">
                Modul Komunitas Terbaru
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Materi dan catatan belajar yang baru saja diverifikasi oleh kurator sekolah.
              </p>
            </div>
            <Link
              href="/modules"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-nawa-primary hover:text-nawa-primary-hover dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
            >
              Lihat Seluruh Perpustakaan Modul
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sampleModules.map((m) => (
              <Link
                key={m.id}
                href="/modules"
                className="group flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-nawa-primary-hover"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-nawa-primary-hover dark:bg-indigo-950/60 dark:text-indigo-300">
                      {m.subject || "Umum"}
                    </span>
                    <span className="text-[11px] font-semibold text-zinc-400">
                      {m.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white group-hover:text-nawa-primary dark:group-hover:text-indigo-400 transition-colors">
                    {m.title}
                  </h3>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="font-medium">Oleh {m.uploaderName}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
                      {m.downloads} diunduh
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +{m.points} XP
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          COMMUNITY MANIFESTO: OSIS NAWASENA SMAN 2 JONGGOL
          Grounding the product in real school pride and peer collaboration.
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-24 bg-gradient-to-b from-transparent via-indigo-50/30 to-transparent dark:via-indigo-950/10 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center mb-6">
            <NawaIcon className="h-16 w-16 drop-shadow-md" />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white sm:text-3xl md:text-4xl">
            Amanat Komunitas OSIS NAWASENA
          </h2>
          <blockquote className="mt-6 text-base leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-lg md:text-xl font-medium max-w-2xl mx-auto">
            &ldquo;NAWA-LEARN dibangun dari semangat gotong royong warga SMAN 2 Jonggol. Setiap catatan modul yang kamu bagikan dan setiap soal latihan yang kamu susun adalah warisan pengetahuan nyata bagi rekan dan adik kelas yang belajar setelahmu.&rdquo;
          </blockquote>
          <div className="mt-6 flex flex-col items-center">
            <span className="text-sm font-bold text-nawa-primary dark:text-indigo-400">
              Tim Pengembang OSIS NAWASENA
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              SMA Negeri 2 Jonggol, Kabupaten Bogor
            </span>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          FINAL CONVERSION CALL TO ACTION
          Direct, encouraging invitation to join the scholastic community.
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-zinc-900 px-8 py-14 text-center text-white shadow-2xl dark:bg-zinc-900 sm:px-16 sm:py-20 border border-zinc-800">
            {/* Ambient interior glow */}
            <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-[80px]" />
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-500/20 blur-[80px]" />

            <h2 className="relative text-3xl font-black tracking-tight sm:text-4xl md:text-5xl">
              Mulai Perjalanan Akademikmu Hari Ini
            </h2>
            <p className="relative mt-4 max-w-xl mx-auto text-sm leading-relaxed text-zinc-300 sm:text-base">
              Bergabunglah bersama ratusan siswa SMAN 2 Jonggol lainnya. Akses seluruh modul, kerjakan simulasi ujian, dan kumpulkan pencapaianmu—100% gratis.
            </p>

            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
              <Show when="signed-out">
                <Link
                  id="final-cta-signin"
                  href="/sign-in"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:from-nawa-primary hover:to-nawa-secondary hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Daftar Akun Sekarang
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  id="final-cta-modules"
                  href="/modules"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-6 py-3.5 text-sm font-semibold text-zinc-200 transition-all duration-200 hover:bg-zinc-800 hover:border-zinc-600 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Jelajahi Modul
                </Link>
              </Show>

              <Show when="signed-in">
                <Link
                  id="final-cta-practice"
                  href="/questions/practice"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:from-nawa-primary hover:to-nawa-secondary hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Buka Latihan Soal
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  id="final-cta-leaderboard"
                  href="/leaderboard"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-6 py-3.5 text-sm font-semibold text-zinc-200 transition-all duration-200 hover:bg-zinc-800 hover:border-zinc-600 hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Papan Peringkat
                </Link>
              </Show>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
          Accessible navigation, legal links, and institutional attribution.
      ══════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-zinc-200/80 bg-zinc-50 py-12 dark:border-zinc-800/80 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <NawaIcon className="h-7 w-7" />
              <div className="text-left">
                <span className="font-black text-sm tracking-tight text-zinc-900 dark:text-white">
                  NAWA-LEARN
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Platform Belajar Kolaboratif OSIS NAWASENA · SMAN 2 Jonggol
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              <Link href="/modules" className="hover:text-nawa-primary dark:hover:text-indigo-400 transition-colors">
                Modul
              </Link>
              <Link href="/questions/practice" className="hover:text-nawa-primary dark:hover:text-indigo-400 transition-colors">
                Latihan Soal
              </Link>
              <Link href="/leaderboard" className="hover:text-nawa-primary dark:hover:text-indigo-400 transition-colors">
                Peringkat
              </Link>
              <Link href="/privacy" className="hover:text-nawa-primary dark:hover:text-indigo-400 transition-colors">
                Privasi (UU PDP)
              </Link>
              <Link href="/terms" className="hover:text-nawa-primary dark:hover:text-indigo-400 transition-colors">
                Ketentuan Layanan
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-400 dark:text-zinc-500">
            <p>© {new Date().getFullYear()} OSIS NAWASENA SMAN 2 Jonggol. Hak cipta dilindungi.</p>
            <p>100% Bebas Iklan · Tanpa Pelacak Komersial</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
