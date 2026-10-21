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

// CSS butuh pembaca komentar sendiri. `withoutComments()` menganggap urutan
// `/*` + `*/` di dalam string glob `@source "../../src/**/*.{ts,tsx}"` sebagai
// blok komentar, lalu memakan segalanya sampai `*/` berikutnya — termasuk
// `@custom-variant dark` yang berada di antaranya. Untuk CSS, komentar selalu
// didahului whitespace, `{`, `}` atau `;`, jadi pembuka yang menempel pada
// huruf (seperti di dalam glob) tidak dianggap komentar.
function globalsCss(): string {
  return readFileSync(GLOBALS_CSS, "utf8")
    .replace(/(^|[\s{};])\/\*[\s\S]*?\*\//g, "$1");
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

/**
 * `colors:` dari frontmatter `DESIGN.md`, diparsing tanpa dependensi YAML.
 * Frontmatter ini sengaja dipakai sebagai **sumber kebenaran**: jika seseorang
 * mengubah palet di dokumen, tes ini gagal sampai `@theme` mengikutinya —
 * begitulah `DESIGN.md` berhenti menjadi kamus dan menjadi penjaga.
 */
function designPalette(): Map<string, string> {
  const md = readFileSync(path.join(process.cwd(), "DESIGN.md"), "utf8");
  const frontmatter = md.split(/^---$/m)[1] ?? "";
  const palette = new Map<string, string>();

  let inColors = false;
  for (const line of frontmatter.split(/\r?\n/)) {
    if (/^colors:/.test(line)) { inColors = true; continue; }
    if (inColors && /^\S/.test(line)) break; // blok berikutnya (typography, dst.)
    if (!inColors) continue;

    const entry = line.match(/^\s{2}([\w-]+):\s*"(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))"/);
    if (entry) palette.set(entry[1], entry[2].toLowerCase());
  }

  expect(palette.size, "DESIGN.md frontmatter must list its colours").toBeGreaterThan(0);
  return palette;
}

describe("blok @theme", () => {
  it("setiap warna di DESIGN.md ada di @theme dengan nilai yang persis sama", () => {
    const css = globalsCss();
    // Ambil hanya blok @theme yang pertama (yang ada `--color-*`-nya).
    const themeBlock = css.match(/@theme\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(themeBlock, "globals.css must declare an @theme block").not.toBe("");

    const missing: string[] = [];
    const wrong: string[] = [];

    for (const [name, hex] of designPalette()) {
      // Nama di dokumen dipakai mentah dengan prefiks `nawa-`:
      // `primary` -> `--color-nawa-primary`, `surface-dark` -> `--color-nawa-surface-dark`.
      const token = `--color-nawa-${name}`;
      const declared = themeBlock.match(
        new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(#[0-9a-fA-F]{3,6})`),
      );

      if (!declared) missing.push(`${name} (${token})`);
      else if (declared[1].toLowerCase() !== hex) {
        wrong.push(`${name}: DESIGN.md ${hex} vs @theme ${declared[1]}`);
      }
    }

    expect(missing).toEqual([]);
    expect(wrong).toEqual([]);
  });

  it("warna brand benar-benar dipakai, bukan sekadar dideklarasikan", () => {
    // Blok @theme tanpa pemakaian adalah "penulis tanpa pembaca" — pola yang
    // membuat M5 menghapus tabel bookmarks. Setelah migrasi, `bg-nawa-primary`
    // harus muncul di sekurang-kurangnya satu berkas.
    const users = sourceFiles().filter((f) =>
      /(?:bg|text|border|ring|from|to|via)-nawa-(?:primary|secondary|success|error|warning)/
        .test(readFileSync(f, "utf8")));
    expect(users.length, "no component uses the nawa-* brand tokens").toBeGreaterThan(0);
  });
});

describe("sumber konten Tailwind", () => {
  it("dibatasi ke src/, supaya nama kelas di markdown tidak ikut jadi CSS", () => {
    const css = globalsCss();

    // Deteksi otomatis Tailwind v4 memindai seluruh proyek, **termasuk
    // markdown**. Akibatnya `from-indigo-600 to-violet-600` yang dikutip di
    // catatan migrasi `DESIGN.md` benar-benar memancarkan `.from-indigo-600` dan
    // `.to-violet-600` ke bundel, padahal tidak ada komponen yang memakainya —
    // dan itu membuat "apakah rename-nya selesai?" mustahil dijawab dengan
    // menggrep keluaran build.
    expect(css, "auto-detection must be disabled").toMatch(/@import\s+"tailwindcss"\s+source\(none\)/);
    expect(css, "@source must point at the real component tree").toMatch(
      /@source\s+"[^"]*src\/\*\*\/\*\.\{ts,tsx\}"/,
    );
    // Kalau `source(none)` dihapus tanpa mengembalikan `@source`, seluruh CSS
    // utilitas hilang dan halaman tampil tanpa gaya — kegagalan yang jauh lebih
    // mahal daripada beberapa aturan hantu. Keduanya harus ada bersamaan.
    expect(css).not.toMatch(/@source\s+"[^"]*\.md"/);
  });
});
