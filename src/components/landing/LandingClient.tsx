// src/components/landing/LandingClient.tsx
"use client";

import Link from "next/link";
import { SignInButton, Show } from "@clerk/nextjs";
import { useEffect, useRef, useState, ReactNode } from "react";

/* ─── Animated counter ─────────────────────────────────────────────────────── */
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || started.current) return;
      started.current = true;
      observer.disconnect();
      const duration = 1400;
      const steps = 80;
      const step = target / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += step;
        if (current >= target) { setCount(target); clearInterval(timer); }
        else setCount(Math.floor(current));
      }, duration / steps);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count.toLocaleString("id-ID")}{suffix}</span>;
}

/* ─── Scroll reveal wrapper ────────────────────────────────────────────────── */
function ScrollReveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-[900ms] ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Marquee text component ───────────────────────────────────────────────── */
function Marquee({ items }: { items: string[] }) {
  return (
    <div className="relative overflow-hidden py-4 border-y border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30">
      <div className="flex animate-[scroll_30s_linear_infinite] gap-12 whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-3 text-sm font-semibold text-zinc-400 dark:text-zinc-500 select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/60 dark:bg-indigo-500/40 shrink-0" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Props ────────────────────────────────────────────────────────────────── */
interface LandingClientProps {
  stats: {
    modules: number;
    questions: number;
    students: number;
    contributors: number;
  };
  sampleModules: {
    id: string;
    title: string;
    category: string;
    points: number;
  }[];
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function LandingClient({ stats, sampleModules }: LandingClientProps) {

  return (
    <div className="relative overflow-x-hidden bg-white dark:bg-zinc-950">

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative isolate overflow-hidden">
        {/* Background glow — subtle, not garish */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-gradient-to-br from-indigo-400/15 via-violet-400/8 to-transparent blur-[80px] dark:from-indigo-500/10 dark:via-violet-500/5" />
          <div className="absolute -bottom-40 right-0 h-[300px] w-[400px] rounded-full bg-indigo-300/8 blur-[60px] dark:bg-indigo-600/5" />
        </div>

        <div className="mx-auto max-w-7xl px-6 pt-20 pb-10 md:pt-32 md:pb-16 lg:pt-36 lg:pb-20">
          <div className="flex flex-col items-center text-center">

            {/* Overline badge */}
            <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-indigo-200/70 bg-white/80 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur-md dark:border-indigo-800/50 dark:bg-zinc-900/80 dark:text-indigo-300">
              <svg className="h-4 w-4 text-indigo-500 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
              </svg>
              Platform Edukasi OSIS NAWASENA
            </div>

            {/* Main headline */}
            <h1 className="max-w-5xl text-4xl font-black leading-[1.08] tracking-tight text-zinc-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Tempat siswa SMAN 2 Jonggol{" "}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">
                  belajar bersama
                </span>
                <span aria-hidden className="absolute -bottom-1 left-0 right-0 h-3 bg-indigo-200/40 dark:bg-indigo-600/20 rounded-full -z-0" />
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-xl">
              Akses modul pelajaran, latihan soal adaptif, dan kuis harian berhadiah —
              semuanya gratis, dibuat oleh siswa, untuk siswa.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Show when="signed-out">
                <Link
                  id="hero-cta-signin"
                  href="/sign-in"
                  className="group inline-flex items-center gap-2.5 rounded-2xl bg-indigo-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-indigo-500/25 transition-all duration-300 hover:bg-indigo-700 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  Mulai Belajar Gratis
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  id="hero-cta-modules"
                  href="/modules"
                  className="group inline-flex items-center gap-2.5 rounded-2xl bg-indigo-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-indigo-500/25 transition-all duration-300 hover:bg-indigo-700 hover:-translate-y-0.5 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  Ke Perpustakaan Modul
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </Show>
              <Link
                id="hero-cta-leaderboard"
                href="/leaderboard"
                className="inline-flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-8 py-4 text-base font-semibold text-zinc-700 shadow-sm transition-all duration-300 hover:border-zinc-400 hover:bg-zinc-50 hover:-translate-y-0.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
              >
                🏆 Lihat Peringkat
              </Link>
            </div>

            {/* Trust signals */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-zinc-500 dark:text-zinc-500">
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                100% Gratis
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                Tanpa Iklan
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                Diverifikasi Moderator
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SOCIAL PROOF — LIVE STATS ═══════════════ */}
      <ScrollReveal>
        <section className="relative z-10 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {[
                { label: "Modul Terverifikasi", target: stats.modules, emoji: "📚", gradient: "from-indigo-500/10 to-indigo-500/0 dark:from-indigo-500/15 dark:to-indigo-500/0", text: "text-indigo-600 dark:text-indigo-400" },
                { label: "Bank Soal Latihan",   target: stats.questions, emoji: "⚡", gradient: "from-violet-500/10 to-violet-500/0 dark:from-violet-500/15 dark:to-violet-500/0", text: "text-violet-600 dark:text-violet-400" },
                { label: "Siswa Terdaftar",     target: stats.students, emoji: "👥", gradient: "from-emerald-500/10 to-emerald-500/0 dark:from-emerald-500/15 dark:to-emerald-500/0", text: "text-emerald-600 dark:text-emerald-400" },
                { label: "Kontributor Aktif",   target: stats.contributors, emoji: "🌟", gradient: "from-amber-500/10 to-amber-500/0 dark:from-amber-500/15 dark:to-amber-500/0", text: "text-amber-600 dark:text-amber-400" },
              ].map((s) => (
                <div key={s.label} className={`relative overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-gradient-to-br ${s.gradient} p-6 md:p-8 text-center`}>
                  <span className="text-3xl mb-3 block">{s.emoji}</span>
                  <div className={`text-3xl md:text-4xl font-black ${s.text} tracking-tight`}>
                    <Counter target={s.target} suffix="+" />
                  </div>
                  <p className="mt-2 text-xs md:text-sm font-semibold text-zinc-500 dark:text-zinc-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════════ BRAND MARQUEE ═══════════════ */}
      <Marquee items={[
        "UTBK-SNBT", "Olimpiade Sains", "Matematika", "Fisika",
        "Kimia", "Biologi", "Bahasa Inggris", "Sosiologi",
        "Ekonomi", "Sejarah", "Geografi", "Bahasa Indonesia",
      ]} />

      {/* ═══════════════ FEATURES ═══════════════ */}
      <ScrollReveal>
        <section id="fitur" className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-28">
          <div className="mb-14 text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-4 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border border-indigo-100 dark:border-indigo-800/50">
              ✦ Fitur Unggulan
            </span>
            <h2 className="mt-4 text-3xl font-black text-zinc-900 dark:text-white md:text-5xl tracking-tight">
              Semua yang siswa butuhkan
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-zinc-600 dark:text-zinc-400 text-lg">
              Didesain khusus untuk ekosistem belajar SMAN 2 Jonggol yang kolaboratif.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 — Perpustakaan Modul */}
            <Link href="/modules" className="group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-300 dark:hover:border-indigo-700">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-2xl">📚</div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Perpustakaan Modul</h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Akses materi belajar dari UTBK hingga Olimpiade. Setiap modul dikurasi dan diverifikasi oleh moderator.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                Jelajahi Modul
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </Link>

            {/* Feature 2 — Latihan Soal */}
            <Link href="/questions/practice" className="group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-500/5 hover:border-violet-300 dark:hover:border-violet-700">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/50 text-2xl">⚡</div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Bank Soal & Latihan</h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Ratusan soal dengan tingkat kesulitan beragam. Ujian kustom, koreksi otomatis, dan penjelasan detail.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-violet-600 dark:text-violet-400">
                Mulai Latihan
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </Link>

            {/* Feature 3 — Kuis Harian Berhadiah (NEW) */}
            <Link href="/questions/daily" className="group relative overflow-hidden rounded-3xl border-2 border-amber-300/60 dark:border-amber-700/50 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-amber-950/30 dark:via-zinc-900 dark:to-orange-950/20 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10">
              <div className="absolute top-4 right-4 bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-sm uppercase tracking-wider">
                Baru!
              </div>
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-2xl">🎯</div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Kuis Harian Berhadiah</h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Tantangan harian dengan soal acak adaptif. Selesaikan dan raih <strong className="text-amber-600 dark:text-amber-400">+25 V-Points</strong> setiap hari! Reset pukul 03.00 WIB.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                Kerjakan Sekarang
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </Link>

            {/* Feature 4 — Papan Peringkat & Gamifikasi */}
            <Link href="/leaderboard" className="group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5 hover:border-emerald-300 dark:hover:border-emerald-700">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-2xl">🏆</div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Peringkat & 80+ Badge</h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Sistem gamifikasi lengkap dengan V-Points, leaderboard, dan 80+ achievement badge yang bisa dikumpulkan.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Lihat Peringkat
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </Link>

            {/* Feature 5 — Upload & Kontribusi */}
            <Link href="/submit" className="group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-rose-500/5 hover:border-rose-300 dark:hover:border-rose-700">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-2xl">🤝</div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Upload & Kontribusi</h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Bagikan modulmu dan buatkan soal latihan. Moderasi ketat memastikan kualitas — kontributor top jadi Moderator.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
                Mulai Kontribusi
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </Link>

            {/* Feature 6 — Profil & Avatar */}
            <Link href="/profile" className="group relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/5 hover:border-cyan-300 dark:hover:border-cyan-700">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 dark:bg-cyan-900/50 text-2xl">🧙</div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">22+ Avatar & Profil</h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Kustomisasi profilmu dengan 22+ avatar fantasy & sci-fi, motto personal, dan level frame yang bisa di-unlock.
              </p>
              <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-cyan-600 dark:text-cyan-400">
                Atur Profil
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </Link>
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <ScrollReveal>
        <section className="relative z-10 border-y border-zinc-200/80 bg-zinc-50 py-20 md:py-28 dark:border-zinc-800/60 dark:bg-zinc-900/40">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-14 text-center">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-4 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border border-emerald-100 dark:border-emerald-800/50">
                ✦ Panduan Memulai
              </span>
              <h2 className="mt-4 text-3xl font-black text-zinc-900 dark:text-white md:text-5xl tracking-tight">Tiga langkah mudah</h2>
              <p className="mt-3 text-zinc-600 dark:text-zinc-400 text-lg">Dari pendaftaran sampai berkontribusi — semudah hitungan jari.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                { num: 1, title: "Buat Akun", desc: "Daftar gratis menggunakan email apapun. Prosesnya tidak sampai semenit.", icon: "👤" },
                { num: 2, title: "Jelajahi & Latihan", desc: "Temukan modul, kerjakan soal latihan, dan selesaikan kuis harian untuk poin.", icon: "🔍" },
                { num: 3, title: "Berkontribusi", desc: "Upload materi dan soal terbaikmu. Kontributor Top 3 akan diangkat menjadi Moderator!", icon: "✨" },
              ].map((s, i) => (
                <ScrollReveal key={s.num} delay={i * 150}>
                  <div className="relative flex flex-col items-center text-center">
                    {/* Connector */}
                    {i < 2 && (
                      <div aria-hidden className="absolute top-8 left-[calc(50%+2.5rem)] right-[calc(-50%+2.5rem)] hidden h-px bg-zinc-300 dark:bg-zinc-700 md:block" />
                    )}
                    <div className="relative z-10 mb-5 flex h-18 w-18 items-center justify-center rounded-2xl border-2 border-indigo-200 bg-white shadow-lg dark:border-indigo-800/60 dark:bg-zinc-900">
                      <span className="text-2xl">{s.icon}</span>
                      <span className="absolute -top-2.5 -right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white shadow-md dark:bg-indigo-500">
                        {s.num}
                      </span>
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-zinc-900 dark:text-white">{s.title}</h3>
                    <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-xs">{s.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════════ SAMPLE MODULES PREVIEW ═══════════════ */}
      <ScrollReveal>
        <section className="relative z-10 mx-auto max-w-5xl px-6 py-20 md:py-24">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white md:text-3xl">Modul Terbaru</h2>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">Diunggah langsung oleh kontributor komunitas.</p>
          </div>

          <div className="space-y-3">
            {sampleModules.map((m, idx) => {
              const badgeCls = m.category.toLowerCase().includes("utbk")
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300"
                : m.category.toLowerCase().includes("olimpiade")
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

              return (
                <ScrollReveal key={idx} delay={idx * 100}>
                  <Link
                    href="/modules"
                    className="group flex items-center justify-between rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-5 transition-all duration-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 hover:shadow-md"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-bold ${badgeCls}`}>{m.category}</span>
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{m.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+{m.points} poin</span>
                      <svg className="h-4 w-4 text-indigo-500 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </Link>
                </ScrollReveal>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <Link href="/modules" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-4">
              Lihat semua modul →
            </Link>
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════════ QUOTE ═══════════════ */}
      <ScrollReveal>
        <section className="relative z-10 mx-auto max-w-3xl px-6 py-10">
          <div className="relative rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-8 py-12 text-center dark:border-indigo-800/40 dark:from-indigo-950/30 dark:via-zinc-900 dark:to-violet-950/20 md:px-14">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="rounded-full border border-indigo-200 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900 dark:text-indigo-400">
                Pesan dari OSIS
              </span>
            </div>
            <span aria-hidden className="mb-3 block text-5xl leading-none text-indigo-300 dark:text-indigo-700">&ldquo;</span>
            <blockquote className="text-lg font-medium leading-relaxed text-zinc-700 dark:text-zinc-300 md:text-xl">
              NAWA-LEARN lahir dari semangat gotong royong. Setiap modul yang kamu upload,
              setiap soal yang kamu buat — adalah investasi untuk adik-adik yang belajar setelahmu.
            </blockquote>
            <div className="mt-8 text-sm font-bold text-indigo-600 dark:text-indigo-400">
              Ketua OSIS NAWASENA — SMAN 2 Jonggol
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <ScrollReveal>
        <section className="relative z-10 px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-12 text-center shadow-2xl shadow-indigo-600/20 md:p-20">
              {/* Decorative */}
              <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full border border-white/10" />
              <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full border border-white/10" />
              <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.03]" />

              <h2 className="relative text-3xl font-black text-white md:text-5xl tracking-tight leading-tight">
                Siap bergabung dengan<br />komunitas pelajar NAWASENA?
              </h2>
              <p className="relative mt-4 text-lg text-indigo-200 max-w-lg mx-auto">
                Gratis. Selamanya. Untuk seluruh warga SMAN 2 Jonggol dan siapapun yang ingin belajar.
              </p>

              <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
                <Show when="signed-out">
                  <Link
                    id="cta-final-signin"
                    href="/sign-in"
                    className="group inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-indigo-700 shadow-xl transition-all duration-300 hover:bg-indigo-50 hover:-translate-y-0.5 hover:shadow-2xl active:translate-y-0"
                  >
                    Daftar Sekarang — Gratis
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </Show>
                <Show when="signed-in">
                  <Link
                    id="cta-final-modules"
                    href="/modules"
                    className="group inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-indigo-700 shadow-xl transition-all duration-300 hover:bg-indigo-50 hover:-translate-y-0.5 hover:shadow-2xl"
                  >
                    Jelajahi Modul Sekarang
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </Show>
                <Link
                  id="cta-final-leaderboard"
                  href="/leaderboard"
                  className="inline-flex items-center rounded-2xl border border-white/30 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur transition-all duration-300 hover:bg-white/20 hover:-translate-y-0.5"
                >
                  Lihat Peringkat
                </Link>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-zinc-200/80 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/50 py-10">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="font-black text-indigo-600 dark:text-indigo-400">NAWA-LEARN</span>
            <span>·</span>
            <span>Platform Edukasi OSIS NAWASENA</span>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            © {new Date().getFullYear()} SMAN 2 Jonggol. Dibuat dengan ❤️ oleh siswa, untuk siswa.
          </p>
        </div>
      </footer>

      {/* ═══ Marquee animation keyframes ═══ */}
      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

    </div>
  );
}
