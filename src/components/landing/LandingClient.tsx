// src/components/landing/LandingClient.tsx
"use client";

import Link from "next/link";
import { SignInButton, Show } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";

/* --------------- Animated counter --------------- */
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

const features = [
  {
    emoji: "📚",
    title: "Perpustakaan Modul",
    desc: "Materi belajar berkualitas yang dikurasi oleh siswa dan guru SMAN 2 Jonggol — dari UTBK hingga Olimpiade.",
    accentLight: "bg-indigo-50 border-indigo-200",
    accentDark: "dark:bg-indigo-950/40 dark:border-indigo-800/60",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/60",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    tagBg: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300",
    href: "/modules",
    tag: "Modul",
  },
  {
    emoji: "⚡",
    title: "Latihan Soal",
    desc: "Bank soal adaptif dengan berbagai tingkat kesulitan. Lacak perkembanganmu secara real-time.",
    accentLight: "bg-violet-50 border-violet-200",
    accentDark: "dark:bg-violet-950/40 dark:border-violet-800/60",
    iconBg: "bg-violet-100 dark:bg-violet-900/60",
    iconColor: "text-violet-600 dark:text-violet-400",
    tagBg: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
    href: "/questions/practice",
    tag: "Latihan",
  },
  {
    emoji: "🏆",
    title: "Papan Peringkat",
    desc: "Sistem gamifikasi berbasis poin. Kontribusi modul dan soal berkualitas = pengakuan komunitas.",
    accentLight: "bg-amber-50 border-amber-200",
    accentDark: "dark:bg-amber-950/40 dark:border-amber-800/60",
    iconBg: "bg-amber-100 dark:bg-amber-900/60",
    iconColor: "text-amber-600 dark:text-amber-400",
    tagBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    href: "/leaderboard",
    tag: "Gamifikasi",
  },
  {
    emoji: "🤝",
    title: "Kontribusi",
    desc: "Upload modul dan soal buatanmu. Moderasi ketat memastikan setiap konten sudah terverifikasi.",
    accentLight: "bg-emerald-50 border-emerald-200",
    accentDark: "dark:bg-emerald-950/40 dark:border-emerald-800/60",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/60",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    tagBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    href: "/submit",
    tag: "Komunitas",
  },
];

const steps = [
  { num: "01", title: "Daftar Akun", desc: "Buat akun NAWA-LEARN menggunakan email sekolah kamu. Gratis dan cepat.", icon: "👤" },
  { num: "02", title: "Jelajahi Materi", desc: "Temukan modul dan latihan soal yang sesuai kebutuhan belajarmu.", icon: "🔍" },
  { num: "03", title: "Berkontribusi", desc: "Upload materi terbaikmu dan dapatkan poin kontribusi dari komunitas.", icon: "✨" },
];

import { ReactNode } from "react";

function ScrollReveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
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
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-[0.98] pointer-events-none"
      }`}
    >
      {children}
    </div>
  );
}

export default function LandingClient({ stats, sampleModules }: LandingClientProps) {
  const statsList = [
    { label: "Modul Terverifikasi", target: stats.modules, suffix: "+", color: "text-indigo-600 dark:text-indigo-400" },
    { label: "Bank Soal Latihan", target: stats.questions, suffix: "+", color: "text-violet-600 dark:text-violet-400" },
    { label: "Siswa Terdaftar", target: stats.students, suffix: "+", color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Kontributor Aktif", target: stats.contributors, suffix: "+", color: "text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="relative overflow-x-hidden">

      {/* -- Decorative orbs (positioned precisely to not bleed into content) -- */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 right-0 h-[480px] w-[480px] rounded-full bg-indigo-400/10 blur-[100px] dark:bg-indigo-500/15" />
        <div className="absolute top-[60%] -left-32 h-[360px] w-[360px] rounded-full bg-violet-400/8 blur-[80px] dark:bg-violet-500/10" />
      </div>

      {/* ══════════════ HERO ══════════════ */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="flex flex-col items-center text-center">

          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/60 dark:text-indigo-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500 dark:bg-indigo-400" />
            Platform resmi OSIS NAWASENA · SMAN 2 Jonggol
          </div>

          {/* Headline — strong contrast in both modes */}
          <h1 className="max-w-4xl text-3xl sm:text-5xl font-black leading-[1.1] tracking-tight text-zinc-900 dark:text-white md:text-7xl">
            Belajar Lebih Cerdas,{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400">
              Bersama-sama.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400 md:text-xl">
            Satu platform kolaboratif untuk akses modul, latih soal, dan berkontribusi
            untuk komunitas pelajar SMAN 2 Jonggol.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Show when="signed-out">
              <Link
                id="hero-cta-signin"
                href="/sign-in"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 hover:shadow-indigo-500/35 hover:-translate-y-0.5 active:translate-y-0 dark:bg-indigo-500 dark:hover:bg-indigo-600 dark:shadow-indigo-500/20"
              >
                Mulai Belajar Gratis
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                id="hero-cta-modules"
                href="/modules"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 hover:-translate-y-0.5 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                Ke Perpustakaan Modul →
              </Link>
            </Show>
            <Link
              id="hero-cta-leaderboard"
              href="/leaderboard"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-7 py-3.5 text-base font-semibold text-zinc-700 shadow-sm transition-all hover:border-zinc-400 hover:bg-zinc-50 hover:-translate-y-0.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              Lihat Papan Peringkat
            </Link>
          </div>

          {/* Dashboard preview card */}
          <div className="mt-14 w-full max-w-4xl">
            <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40">
              {/* Browser bar */}
              <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <div className="ml-4 flex-1 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-1 text-xs text-zinc-400 text-left dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                  nawa-learn.sman2jonggol.sch.id
                </div>
              </div>
              <div className="p-5">
                {/* Stats row */}
                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: "Modul", value: stats.modules.toLocaleString("id-ID"), cls: "text-indigo-600 dark:text-indigo-400" },
                    { label: "Bank Soal", value: stats.questions.toLocaleString("id-ID"), cls: "text-violet-600 dark:text-violet-400" },
                    { label: "Kontributor", value: stats.contributors.toLocaleString("id-ID"), cls: "text-emerald-600 dark:text-emerald-400" },
                    { label: "Pelajar Aktif", value: stats.students.toLocaleString("id-ID"), cls: "text-amber-600 dark:text-amber-400" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-zinc-50 p-4 text-center dark:bg-zinc-800/60">
                      <div className={`text-2xl font-black md:text-3xl ${s.cls}`}>{s.value}</div>
                      <div className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{s.label}</div>
                    </div>
                  ))}
                </div>
                {/* Sample modules */}
                <div className="space-y-2">
                  {sampleModules.map((m, idx) => {
                    const badgeCls = m.category.toLowerCase().includes("utbk")
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300"
                      : "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300";

                    return (
                      <Link
                        key={idx}
                        href="/modules"
                        className="group flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/20 transition-all duration-300 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 hover:scale-[1.01] hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${badgeCls}`}>{m.category}</span>
                          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-left">{m.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">+{m.points} poin</span>
                          <svg className="h-4 w-4 text-indigo-500 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ FEATURES ══════════════ */}
      <ScrollReveal>
        <section id="fitur" className="relative z-10 mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black text-zinc-900 dark:text-white md:text-4xl">
              Semua yang kamu butuhkan,<br className="hidden md:block" /> ada di sini.
            </h2>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400">
              Satu platform, semua kebutuhan belajar siswa SMAN 2 Jonggol.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Link
                key={f.title}
                href={f.href}
                id={`feature-${f.href.replace("/", "")}`}
                className={`group flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${f.accentLight} ${f.accentDark}`}
              >
                {/* Icon */}
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${f.iconBg}`}>
                  {f.emoji}
                </div>
                {/* Tag */}
                <span className={`mb-3 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${f.tagBg}`}>
                  {f.tag}
                </span>
                <h3 className="mb-2 text-base font-bold text-zinc-900 dark:text-white">{f.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{f.desc}</p>
                <div className={`mt-5 flex items-center gap-1 text-sm font-semibold ${f.iconColor}`}>
                  Jelajahi
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* ══════════════ HOW IT WORKS ══════════════ */}
      <ScrollReveal>
        <section className="relative z-10 border-y border-zinc-200 bg-zinc-50 py-20 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-black text-zinc-900 dark:text-white md:text-4xl">Cara mulai belajar</h2>
              <p className="mt-3 text-zinc-600 dark:text-zinc-400">Tiga langkah untuk akses penuh semua fitur NAWA-LEARN.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {steps.map((s, i) => (
                <div key={s.num} className="relative flex flex-col items-center text-center">
                  {/* Connector */}
                  {i < steps.length - 1 && (
                    <div aria-hidden className="absolute top-8 left-[calc(50%+2.5rem)] right-[calc(-50%+2.5rem)] hidden h-px bg-zinc-300 dark:bg-zinc-700 md:block" />
                  )}
                  {/* Step number bubble */}
                  <div className="relative z-10 mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-indigo-200 bg-white shadow-md dark:border-indigo-800/60 dark:bg-zinc-900">
                    <span className="text-xl">{s.icon}</span>
                    <span className="absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white dark:bg-indigo-500">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-zinc-900 dark:text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ══════════════ QUOTE ══════════════ */}
      <ScrollReveal>
        <section className="relative z-10 mx-auto max-w-3xl px-6 py-16">
          <div className="relative rounded-2xl border border-indigo-200 bg-indigo-50 px-8 py-10 text-center dark:border-indigo-800/50 dark:bg-indigo-950/30 md:px-12">
            {/* Label pill */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="rounded-full border border-indigo-200 bg-white px-4 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600 shadow-sm dark:border-indigo-800/60 dark:bg-zinc-900 dark:text-indigo-400">
                Pesan dari OSIS
              </span>
            </div>
            {/* Decorative quote mark */}
            <span aria-hidden className="mb-3 block text-4xl leading-none text-indigo-300 dark:text-indigo-700">&ldquo;</span>
            <blockquote className="text-lg font-medium leading-relaxed text-zinc-700 dark:text-zinc-300 md:text-xl">
              NAWA-LEARN lahir dari semangat gotong royong. Setiap modul yang kamu upload,
              setiap soal yang kamu buat — adalah investasi untuk adik-adik yang belajar setelahmu.
            </blockquote>
            <div className="mt-6 text-sm font-bold text-indigo-600 dark:text-indigo-400">
              Ketua OSIS NAWASENA — SMAN 2 Jonggol
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* ══════════════ FINAL CTA ══════════════ */}
      <ScrollReveal>
        <section className="relative z-10 px-6 pb-20">
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-10 text-center shadow-2xl shadow-indigo-500/20 md:p-16">
              {/* Decorative rings */}
              <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full border border-white/10" />
              <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full border border-white/10" />
              <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5" />

              <h2 className="relative text-3xl font-black text-white md:text-4xl">
                Siap bergabung dengan<br />komunitas pelajar NAWASENA?
              </h2>
              <p className="relative mt-3 text-lg text-indigo-200">
                Gratis. Selamanya. Untuk seluruh warga SMAN 2 Jonggol.
              </p>

              <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
                <Show when="signed-out">
                  <Link
                    id="cta-final-signin"
                    href="/sign-in"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-indigo-700 shadow-lg transition-all hover:bg-indigo-50 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
                  >
                    Daftar Sekarang — Gratis
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </Show>
                <Show when="signed-in">
                  <Link
                    id="cta-final-modules"
                    href="/modules"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-indigo-700 shadow-lg transition-all hover:bg-indigo-50 hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    Jelajahi Modul Sekarang →
                  </Link>
                </Show>
                <Link
                  id="cta-final-leaderboard"
                  href="/leaderboard"
                  className="inline-flex items-center rounded-xl border border-white/30 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur transition-all hover:bg-white/20 hover:-translate-y-0.5"
                >
                  Lihat Peringkat
                </Link>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

    </div>
  );
}
