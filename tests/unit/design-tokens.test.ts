// tests/unit/design-tokens.test.ts
// ─── Kelas warna yang tidak pernah menghasilkan CSS ──────────────────────────
//
// Tailwind hanya mengenal sebelas langkah per warna: 50, 100, 200 … 900, 950.
// `zinc-550`, `zinc-850`, `indigo-650` dan sejenisnya **tidak ada**, dan Tailwind
// v4 tidak menghasilkan aturan apa pun untuknya — tanpa peringatan, tanpa error.
// Kelasnya tetap menempel di `className`, jadi ia terbaca seperti niat desain
// padahal elemennya hanya mewarisi warna induk.
//
// Itu bukan teori. Sebelum M15 ada 200 kemunculan seperti ini di 26 berkas,
// hampir semuanya berasal dari satu pergeseran massal `+50` (`border-zinc-250`
// yang berdampingan dengan `dark:border-zinc-750` jelas dimaksudkan 200/700).
// Karena tidak ada yang gagal, tidak ada yang menyadarinya selama beberapa
// milestone. Gerbang ini membaca **sumber**, bukan hasil render, dengan alasan
// yang sama seperti `pii-surface.test.ts`: kelas mati tidak terlihat di HTML.
//
// Dua pemeriksaan lain di berkas ini menjaga hal yang sama-sama tak terlihat:
// `prefers-reduced-motion` dan penanda fokus keyboard. Keduanya nol di seluruh
// `src` sebelum M15, dan keduanya hanya bisa dibuktikan dari CSS-nya.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { withoutComments } from "../helpers/source";

const SRC_DIR = path.join(process.cwd(), "src");
const GLOBALS_CSS = path.join(SRC_DIR, "app", "globals.css");

/** Skala warna Tailwind. Apa pun di luar daftar ini tidak menghasilkan CSS. */
const VALID_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const COLOR_NAMES = [
  "slate", "gray", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple",
  "fuchsia", "pink", "rose",
];

const COLOR_UTILITY = new RegExp(
  String.raw`(?<![\w-])(?:[a-z-]+:)*(?:text|bg|border|ring|divide|from|via|to|fill|stroke|shadow|outline|decoration|placeholder)-(` +
    COLOR_NAMES.join("|") +
    String.raw`)-(\d{2,3})\b`,
  "g",
);

function sourceFiles(dir: string = SRC_DIR, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, found);
    } else if (/\.(tsx?|css)$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

function globalsCss(): string {
  return withoutComments(readFileSync(GLOBALS_CSS, "utf8"));
}

describe("skala warna Tailwind", () => {
  it("tidak memakai shade yang tidak ada di skala", () => {
    const violations: string[] = [];

    for (const file of sourceFiles()) {
      // Komentar dibuang lebih dulu: sebuah komentar yang **menjelaskan** bug
      // `zinc-550` tidak boleh terbaca sebagai bug `zinc-550`.
      const lines = withoutComments(readFileSync(file, "utf8")).split(/\r?\n/);

      lines.forEach((line, index) => {
        for (const match of line.matchAll(COLOR_UTILITY)) {
          const [, color, shade] = match;
          if (VALID_SHADES.includes(Number(shade))) continue;
          const where = path.relative(process.cwd(), file);
          violations.push(`${where}:${index + 1}  ${color}-${shade}`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});

describe("prefers-reduced-motion", () => {
  it("globals.css mematikan transisi global saat pengguna meminta gerak minimal", () => {
    const css = globalsCss();

    // `globals.css` memasang transisi pada `*` dan `scroll-behavior: smooth`
    // pada `html`. Tanpa blok ini, pengguna yang meminta gerak minimal tetap
    // mendapat keduanya.
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/transition-duration:\s*0\.01ms/);
    expect(css).toMatch(/scroll-behavior:\s*auto/);
  });
});

describe("fokus keyboard", () => {
  it("globals.css memberi penanda fokus yang tidak bergantung pada default peramban", () => {
    const css = globalsCss();

    // `DESIGN.md` menetapkan Arcane Indigo sebagai warna focus ring, tapi
    // sebelum M15 tidak ada satu pun kelas `focus-visible:` di `src` — penanda
    // fokus hilang begitu sebuah kontrol memakai `focus:outline-none`.
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid #4f46e5/);
  });
});
