// tests/unit/i18n.test.ts
// ─── Katalog string: setiap key harus punya pembaca ───────────────────────────
//
// M5 menghapus tabel `bookmarks` karena ia punya penulis tanpa pembaca. Bentuk
// kegagalan yang sama berlaku untuk katalog i18n: sebuah key ditambahkan, tidak
// pernah dipanggil, dan diam-diam menjadi salinan mati dari string yang sudah
// diganti di tempat lain — atau, lebih buruk, key yang **ada** pemanggilnya
// dihapus, dan `t()` merender kosong.
//
// Tes ini membaca **sumber** (`src/**/*.{ts,tsx}`), bukan hasil render, dengan
// alasan yang sama seperti `pii-surface` dan `design-tokens`: key yatim tidak
// terlihat di HTML. Komentar dibuang lebih dulu melalui `withoutComments()`
// supaya catatan yang *menyebut* sebuah key tidak terbaca sebagai pemakaian.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { messages } from "@/i18n/messages";
import { withoutComments } from "../helpers/source";

const SRC_DIR = path.join(process.cwd(), "src");
// `[a-zA-Z]` — key CamelCase seperti `auth.signUp.metaTitle` wajib cocok;
// versi awal hanya `[a-z]` dan secara diam-diam melaporkan semua key berhuruf
// besar sebagai yatim.
const CALL = /\bt\(\s*["']([a-zA-Z][a-zA-Z0-9.]*)["']/g;

/** Semua leaf path di katalog, contoh: `["nav.modules", "auth.signIn.metaTitle"]`. */
function leafKeys(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return prefix ? [prefix] : [];
  if (typeof node !== "object" || node === null) return [];

  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => {
    const next = prefix ? `${prefix}.${k}` : k;
    return leafKeys(v, next);
  });
}

/** `t` adalah nama yang sangat pendek: `Toast` dan `ProfileHeader` sama-sama
 *  punya `const t = setTimeout(...)` lokal. Memindai semua berkas berarti
 *  `t("…")` di berkas itu akan terbaca sebagai pemanggilan katalog. Hanya
 *  berkas yang benar-benar mengimpor `t` dari `@/i18n/t` yang dipindai. */
const IMPORTS_T = /from\s+["']@\/i18n\/t["']/;

function sourceText(dir: string = SRC_DIR, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceText(full, found);
    else if (/\.(tsx?)$/.test(entry)) {
      const text = readFileSync(full, "utf8");
      if (IMPORTS_T.test(text)) found.push(text);
    }
  }
  return found;
}

describe("katalog string", () => {
  it("setiap key dipanggil setidaknya sekali (tidak ada penulis tanpa pembaca)", () => {
    const sources = sourceText();
    // Pemindaian yang tidak menemukan berkas apa pun akan hijau tanpa memeriksa
    // apa pun — bentuk kegagalan yang sama dengan `shimmer` yang menunjuk
    // keyframe yang tidak ada. Buktikan dulu ada yang dipindai.
    expect(sources.length, "tidak ada berkas yang mengimpor @/i18n/t").toBeGreaterThan(0);

    const used = new Set<string>();
    for (const source of sources) {
      for (const match of withoutComments(source).matchAll(CALL)) {
        used.add(match[1]);
      }
    }

    const orphans = leafKeys(messages).filter((key) => !used.has(key));
    expect(
      orphans,
      `key yatim (ditulis tapi tidak pernah dipanggil): ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("setiap key yang dipanggil betul-betul ada di katalog (typo gagal)", () => {
    // TypeScript seharusnya menangkap ini lebih dulu; tes ini menjaga pemanggilan
    // yang menyusup lewat data dinamis atau `as any`.
    const known = new Set(leafKeys(messages));

    const typos: string[] = [];
    for (const source of sourceText()) {
      for (const match of withoutComments(source).matchAll(CALL)) {
        if (!known.has(match[1])) typos.push(match[1]);
      }
    }

    expect(typos, `path yang tidak ada di katalog: ${typos.join(", ")}`).toEqual([]);
  });

  it("nilai tidak boleh kosong", () => {
    const empties = leafKeys(messages).filter((key) => {
      let node: unknown = messages;
      for (const segment of key.split(".")) {
        node = (node as Record<string, unknown>)[segment];
      }
      return typeof node !== "string" || node.trim() === "";
    });

    expect(empties, `string kosong: ${empties.join(", ")}`).toEqual([]);
  });
});
