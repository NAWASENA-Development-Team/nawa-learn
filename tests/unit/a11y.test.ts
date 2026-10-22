// tests/unit/a11y.test.ts
// ─── Nama yang bisa dibacakan, dijaga sebagai invarian (M15c) ─────────────────
// Sebelum M15c seluruh repo hanya punya **lima** `aria-label` untuk 108 tombol,
// dan **nol** dari 33 kontrol form punya `id`; setiap `<label>` adalah teks
// visual tanpa `htmlFor`. Tak satu pun dari itu terlihat di HTML: markup-nya
// benar secara visual, dan pembaca layar tetap membacakan "edit teks, kosong"
// untuk setiap kolom.
//
// Karena itu gerbang ini membaca **sumber**, bukan keluaran yang dirender —
// sama seperti `pii-surface.test.ts` dan `route-boundaries.test.ts`. Empat sifat
// yang dijaga, semuanya rusak tanpa suara:
//
//   1. **Setiap kontrol punya nama.** `<input>`, `<textarea>`, `<select>` wajib
//      membawa `id` (yang dirujuk sebuah `<label htmlFor>`) atau `aria-label`.
//      `placeholder` bukan nama: ia hilang begitu pengguna mulai mengetik.
//   2. **Setiap `htmlFor` menunjuk sesuatu.** Label yatim lebih buruk daripada
//      label yang tidak ada, karena ia terbaca seperti sudah dikerjakan.
//   3. **Setiap tombol ikon punya nama.** `<button>` yang isinya hanya ikon
//      tidak punya teks untuk dibacakan, sehingga `aria-label` / `aria-labelledby`
//      (atau `title`, atau `alt` pada gambar di dalamnya) adalah satu-satunya
//      nama yang tersisa.
//   4. **`id` unik di dalam satu berkas.** Dua elemen ber-`id` sama membuat
//      `getElementById` memilih yang pertama, sehingga sebuah label bisa
//      menunjuk kolom yang salah pada halaman yang sama.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "../helpers/source";

const SRC = path.resolve(process.cwd(), "src");

function walk(dir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, extensions));
    } else if (extensions.some((extension) => entry.endsWith(extension))) {
      out.push(full);
    }
  }
  return out;
}

const relative = (file: string) => path.relative(SRC, file).replace(/\\/g, "/");
const read = (file: string) => withoutComments(readFileSync(file, "utf8"));

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/**
 * Membaca satu tag pembuka mulai dari `<nama`, berhenti pada `>` yang berada di
 * kedalaman kurung kurawal nol.
 *
 * `/<input[^>]*>/` tidak cukup: `onChange={(event) => …}` mengandung `>`, jadi
 * regex naif berhenti di tengah atribut dan atribut sesudahnya (termasuk `id`)
 * tidak pernah ikut diperiksa — sebuah gerbang yang gagal terbuka, bukan gagal
 * tertutup.
 */
function readOpenTag(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const character = source[i];
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
    else if (character === ">" && depth <= 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

/**
 * Semua nilai atribut bernama `name`, dalam **kedua** bentuk yang dipakai JSX:
 * literal string (`htmlFor="x"`) dan template literal tanpa interpolasi
 * (`htmlFor={`x`}`).
 *
 * Versi pertama hanya membaca literal string, sehingga satu-satunya kontrol
 * dinamis di aplikasi — textarea alasan penolakan di antrean ujian, yang `id`-nya
 * wajib unik per baris sehingga harus berupa template literal — dilaporkan tanpa
 * nama padahal `<label htmlFor>`-nya ada dan menunjuk tepat ke sana. Gerbang yang
 * salah menuduh sama merusaknya dengan gerbang yang gagal terbuka: satu-satunya
 * cara membuatnya hijau adalah menghapus label yang benar.
 */
function attributeValues(source: string, name: string): Array<{ value: string; index: number }> {
  const out: Array<{ value: string; index: number }> = [];
  const patterns = [
    new RegExp(`\\b${name}="([^"]+)"`, "g"),
    new RegExp("\\b" + name + "=\\{`([^`]+)`\\}", "g"),
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      out.push({ value: match[1], index: match.index });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** Nilai satu atribut di dalam satu tag pembuka, atau `undefined`. */
function readAttribute(tag: string, name: string): string | undefined {
  return attributeValues(tag, name)[0]?.value;
}

/** Berkas JSX di `src/`, dibaca sekali lalu dipakai keempat pemeriksaan. */
const FILES = walk(SRC, [".tsx"]).map((file) => ({ rel: relative(file), src: read(file) }));

describe("aksesibilitas: kontrol form punya nama", () => {
  it("setiap input, textarea, dan select membawa id yang dirujuk label, atau aria-label", () => {
    const offenders: string[] = [];

    for (const { rel, src } of FILES) {
      const control = /<(input|textarea|select)\b/g;
      let match: RegExpExecArray | null;
      while ((match = control.exec(src)) !== null) {
        const tag = readOpenTag(src, match.index);
        const hasAria = /aria-label|aria-labelledby/.test(tag);
        const id = readAttribute(tag, "id");
        // `id` sendirian bukan nama: ia baru menjadi nama ketika ada
        // `<label htmlFor>` yang menunjuknya. Gerbang yang menerima `id` apa
        // adanya akan hijau atas kolom yang tetap dibacakan "kosong".
        const referenced =
          id !== undefined && attributeValues(src, "htmlFor").some((label) => label.value === id);
        if (!hasAria && !referenced) {
          offenders.push(`${rel}:${lineOf(src, match.index)}  <${match[1]}>`);
        }
      }
    }

    expect(
      offenders,
      "Setiap kontrol form butuh aria-label, atau id yang dirujuk <label htmlFor>. " +
        "Placeholder tidak cukup: ia hilang begitu pengguna mengetik.",
    ).toEqual([]);
  });

  it("menemukan kontrol dalam jumlah yang masuk akal (scan tidak diam-diam kosong)", () => {
    // Gerbang yang tidak menemukan apa pun selalu hijau. Angka di bawah adalah
    // jumlah kontrol saat M15c (33); sebuah regex yang rusak akan menjatuhkannya
    // ke nol, dan test ini yang memberi tahu.
    let total = 0;
    for (const { src } of FILES) {
      total += (src.match(/<(input|textarea|select)\b/g) ?? []).length;
    }
    expect(total).toBeGreaterThanOrEqual(30);
  });
});

describe("aksesibilitas: label menunjuk sesuatu", () => {
  it("setiap htmlFor punya pasangan id di berkas yang sama", () => {
    const offenders: string[] = [];

    for (const { rel, src } of FILES) {
      const ids = new Set(attributeValues(src, "id").map((entry) => entry.value));
      for (const label of attributeValues(src, "htmlFor")) {
        if (!ids.has(label.value)) {
          offenders.push(`${rel}:${lineOf(src, label.index)}  htmlFor="${label.value}"`);
        }
      }
    }

    expect(offenders, "Label yatim menunjuk elemen yang tidak ada dan tidak membacakan apa pun.").toEqual([]);
  });

  it("tidak ada id ganda di dalam satu berkas", () => {
    const offenders: string[] = [];

    for (const { rel, src } of FILES) {
      // Hanya id **literal** yang dibandingkan. `id={`baris-${row.id}`}` baru
      // mendapat nilainya saat render, dan setiap baris mendapat nilai berbeda —
      // membandingkan teks template-nya akan menuduh pola yang justru dipakai
      // untuk menjamin keunikan.
      const ids = new Set<string>();
      for (const entry of attributeValues(src, "id")) {
        if (entry.value.includes("${")) continue;
        if (ids.has(entry.value)) {
          offenders.push(`${rel}:${lineOf(src, entry.index)}  id="${entry.value}"`);
        }
        ids.add(entry.value);
      }
    }

    expect(offenders, "id ganda membuat getElementById memilih elemen pertama, bukan yang dimaksud.").toEqual([]);
  });
});

describe("aksesibilitas: tombol ikon punya nama", () => {
  it("tidak ada tombol yang isinya hanya ikon tanpa nama", () => {
    const offenders: string[] = [];

    for (const { rel, src } of FILES) {
      const button = /<button\b[\s\S]*?<\/button>/g;
      let match: RegExpExecArray | null;
      while ((match = button.exec(src)) !== null) {
        const block = match[0];
        // Nama yang tersedia bagi teknologi bantu: atrribut ARIA, `title`, atau
        // `alt` sebuah gambar di dalamnya. Teks literal dihitung terpisah.
        if (/aria-label|aria-labelledby|\btitle=|\balt=/.test(block)) continue;

        const body = block.slice(block.indexOf(">") + 1);
        const text = body.replace(/<[^>]*>/g, "").trim();
        if (!/[\p{L}\p{N}]{2,}/u.test(text)) {
          offenders.push(`${rel}:${lineOf(src, match.index)}`);
        }
      }
    }

    expect(
      offenders,
      "Tombol tanpa teks tidak punya nama untuk dibacakan. Beri aria-label.",
    ).toEqual([]);
  });

  it("memeriksa tombol dalam jumlah yang masuk akal", () => {
    let total = 0;
    for (const { src } of FILES) {
      total += (src.match(/<button\b/g) ?? []).length;
    }
    expect(total).toBeGreaterThanOrEqual(100);
  });
});
