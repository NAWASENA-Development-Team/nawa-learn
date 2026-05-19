// components/layout/Navbar.tsx
"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  Trophy,
  Upload,
  User,
  X,
  Menu,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";

// ── Theme Toggle ──────────────────────────────────────────────────────────────
function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={compact ? "h-8 w-8" : "h-9 w-9"} />;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative inline-flex items-center justify-center rounded-xl border transition-all cursor-pointer
        ${compact ? "h-8 w-8" : "h-9 w-9"}
        border-zinc-200 bg-white/80 text-zinc-500 hover:border-indigo-300 hover:text-indigo-600
        dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400`}
    >
      <Sun className={`absolute h-4 w-4 transition-all duration-300 ${isDark ? "scale-0 opacity-0 rotate-90" : "scale-100 opacity-100"}`} />
      <Moon className={`absolute h-4 w-4 transition-all duration-300 ${isDark ? "scale-100 opacity-100" : "scale-0 opacity-0 -rotate-90"}`} />
    </button>
  );
}

// ── Nav items definition ───────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: "/modules",            label: "Modul",        icon: BookOpen },
  { href: "/questions/practice", label: "Latihan Soal", icon: ClipboardList },
  { href: "/leaderboard",        label: "Peringkat",    icon: Trophy },
  { href: "/submit",             label: "Upload",       icon: Upload },
  { href: "/profile",            label: "Profil Saya",  icon: User },
];

// ── Main Navbar ───────────────────────────────────────────────────────────────
export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">

            {/* Left: Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0 group"
            >
              <div className="flex items-center gap-1.5">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-black text-lg tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                  NAWA-LEARN
                </span>
              </div>
            </Link>

            {/* Center: Desktop nav links (signed-in only) */}
            <Show when="signed-in">
              <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                        ${active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
                        }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${active ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </Show>

            {/* Right: Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle />

              <Show when="signed-out">
                <Link
                  href="/sign-in"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:from-indigo-700 hover:to-violet-700 hover:shadow-indigo-500/30 active:scale-[0.98]"
                >
                  Masuk / Daftar
                </Link>
                {/* Mobile: icon-only sign-in button */}
                <Link
                  href="/sign-in"
                  className="sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20"
                >
                  <User className="h-4 w-4" />
                </Link>
              </Show>

              <Show when="signed-in">
                <UserButton />

                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileOpen(v => !v)}
                  aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
                  className="md:hidden inline-flex items-center justify-center h-9 w-9 rounded-xl border border-zinc-200 bg-white/80 text-zinc-600 transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400 cursor-pointer"
                >
                  {mobileOpen
                    ? <X className="h-4.5 w-4.5" />
                    : <Menu className="h-4.5 w-4.5" />
                  }
                </button>
              </Show>
            </div>

          </div>
        </div>

        {/* ── Desktop active indicator line ── */}
        <div className="hidden md:block h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
      </nav>

      {/* ── Mobile drawer (signed-in) ─────────────────────────────────── */}
      <Show when="signed-in">
        {/* Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Slide-down panel */}
        <div
          className={`fixed top-16 left-0 right-0 z-40 md:hidden transition-all duration-300 ease-in-out ${
            mobileOpen ? "translate-y-0 opacity-100 pointer-events-auto" : "-translate-y-3 opacity-0 pointer-events-none"
          }`}
        >
          <div className="mx-3 mt-1 rounded-2xl border border-zinc-200/80 bg-white/95 shadow-xl shadow-zinc-900/10 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/95 dark:shadow-zinc-950/50 overflow-hidden">
            
            {/* Nav links */}
            <nav className="p-3 space-y-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200
                      ${active
                        ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border border-indigo-100 dark:from-indigo-500/10 dark:to-violet-500/10 dark:text-indigo-400 dark:border-indigo-900/50"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                      }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      active
                        ? "bg-indigo-100 dark:bg-indigo-500/20"
                        : "bg-zinc-100 dark:bg-zinc-800"
                    }`}>
                      <Icon className={`h-4 w-4 ${active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500 dark:text-zinc-400"}`} />
                    </div>
                    <span>{label}</span>
                    {active && (
                      <span className="ml-auto text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Aktif</span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Footer strip */}
            <div className="border-t border-zinc-100 dark:border-zinc-800/60 px-5 py-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">
                OSIS NAWASENA SMAN 2 Jonggol
              </span>
              <ThemeToggle compact />
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
