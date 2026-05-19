// components/layout/Navbar.tsx
"use client";

import Link from "next/link";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import NawaIcon from "@/components/icons/NawaIcon";

// Local helper: call document.startViewTransition safely without conflicting
// with any existing TS lib declarations (which may differ in optionality).
type VTResult = { ready: Promise<void>; finished: Promise<void> };
function startVT(cb: () => void): VTResult | null {
  const fn = (document as unknown as { startViewTransition?: (cb: () => void) => VTResult })
    .startViewTransition;
  if (!fn) { cb(); return null; }   // Fallback: run callback directly, skip animation
  return fn.call(document, cb);
}

// ── Theme Toggle ──────────────────────────────────────────────────────────────
function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={compact ? "h-8 w-8" : "h-9 w-9"} />;

  const isDark = resolvedTheme === "dark";

  const handleToggle = () => {
    const el = btnRef.current;
    const nextTheme = isDark ? "light" : "dark";

    // Grab the centre of the toggle button — this becomes the ripple origin
    if (!el) { setTheme(nextTheme); return; }

    const { left, top, width, height } = el.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;

    // Distance to the farthest corner of the viewport
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth  - x),
      Math.max(y, window.innerHeight - y)
    );

    // Swap theme inside the transition; next-themes synchronously toggles
    // the `.dark` class on <html>, which is all Tailwind CSS needs.
    // startVT returns null on Firefox / Safari — falls back to instant swap.
    const vt = startVT(() => setTheme(nextTheme));
    if (!vt) return; // no VT support — theme was already set via direct cb call

    // Once both snapshots exist, drive the clip-path circle that expands
    // from the button outward — closest elements change first.
    vt.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 600,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {
        // Transition may be skipped (e.g. reduced-motion); theme already set — no-op
      });
  };

  return (
    <button
      ref={btnRef}
      aria-label={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      onClick={handleToggle}
      className={`relative inline-flex items-center justify-center rounded-xl border cursor-pointer
        ${compact ? "h-8 w-8" : "h-9 w-9"}
        border-zinc-200 bg-white/80 text-zinc-500 hover:border-indigo-300 hover:text-indigo-600
        dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400`}
    >
      <Sun  className={`absolute h-4 w-4 transition-all duration-300 ${isDark ? "scale-0 opacity-0 rotate-90" : "scale-100 opacity-100"}`} />
      <Moon className={`absolute h-4 w-4 transition-all duration-300 ${isDark ? "scale-100 opacity-100" : "scale-0 opacity-0 -rotate-90"}`} />
    </button>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────
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

  // Prevent body scroll when drawer is open
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
            <Link href="/" className="flex items-center gap-2 shrink-0 group">
              <div className="flex items-center gap-1.5">
                {/* NAWA icon — inline SVG, no extra HTTP request */}
                <NawaIcon className="h-8 w-8 rounded-lg shadow-md shadow-indigo-500/20 transition-transform duration-200 group-hover:scale-105" />
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
                      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.96]
                        ${active
                          ? "bg-indigo-50 text-indigo-700 shadow-[0_1px_0_0_theme(colors.indigo.200)] dark:bg-indigo-500/10 dark:text-indigo-400 dark:shadow-[0_1px_0_0_theme(colors.indigo.800)]"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
                        }`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                      {label}
                      {active && (
                        <span className="absolute -bottom-[11px] inset-x-3 h-px rounded-full bg-indigo-400/60 dark:bg-indigo-500/50" aria-hidden />
                      )}
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
                  {mobileOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
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
        {/* Backdrop — fades independently of the panel */}
        <div
          onClick={() => setMobileOpen(false)}
          className={`fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm md:hidden transition-opacity duration-200 ${
            mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Scale-from-top panel — feels like it unfolds from the navbar */}
        <div
          className={`fixed top-16 left-0 right-0 z-50 md:hidden transition-[transform,opacity] duration-200 ease-out origin-top ${
            mobileOpen
              ? "scale-y-100 opacity-100 pointer-events-auto"
              : "scale-y-95 opacity-0 pointer-events-none"
          }`}
        >
          <div className="mx-3 mt-1 rounded-2xl border border-zinc-200/80 bg-white/95 shadow-xl shadow-zinc-900/10 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/95 dark:shadow-zinc-950/50 overflow-hidden">

            {/* Nav links */}
            <nav className="p-3 space-y-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }, idx) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    style={{ transitionDelay: mobileOpen ? `${idx * 25}ms` : "0ms" }}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97]
                      ${active
                        ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border border-indigo-100 dark:from-indigo-500/10 dark:to-violet-500/10 dark:text-indigo-400 dark:border-indigo-900/50"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                      }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150 ${
                      active ? "bg-indigo-100 dark:bg-indigo-500/20" : "bg-zinc-100 dark:bg-zinc-800"
                    }`}>
                      <Icon className={`h-4 w-4 ${active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500 dark:text-zinc-400"}`} />
                    </div>
                    <span>{label}</span>
                    {active && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
                        Aktif
                      </span>
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
