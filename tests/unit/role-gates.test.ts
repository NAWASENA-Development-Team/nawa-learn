// tests/unit/role-gates.test.ts
// ─── Peran tidak pernah naik karena kehadiran (M18) ───────────────────────────
//
// Sampai M17 empat route menempelkan ekspresi yang sama pada `UPDATE` poinnya:
//
//   role: sql`CASE WHEN role = 'student' THEN 'contributor'::role ELSE role END`
//
// `quiz/submit`, `quiz/daily-claim`, `modules/approve`, `questions/approve` —
// masing-masing tanpa ambang. Akibatnya satu jawaban benar sudah cukup untuk
// menjadi kontributor, dan produksi membuktikannya: dua kontributor dengan total
// dua baris `quiz_answer`.
//
// Sifat itu tidak terlihat di keluaran mana pun. Respons `quiz/submit` tetap
// `{ success: true, results: [...] }`; yang berubah hanya satu kolom di database
// yang dibaca halaman lain. Jadi gerbangnya membaca **sumber**, dengan komentar
// dibuang lebih dulu (`withoutComments`) — kalau tidak, komentar yang
// menjelaskan kenapa pintu itu ditutup akan terbaca sebagai pintu yang terbuka.
//
// Yang dijaga:
//
//   1. Ekspresi `CASE WHEN role = 'student' …` tidak boleh kembali ke mana pun.
//   2. Setiap route `*/approve` yang membayar poin **wajib** memanggil
//      `promoteIfEligible`. Pintu kelima tanpa promosi berarti kontributor baru
//      tidak pernah lahir dari karya yang disetujui.
//   3. `quiz/submit` dan `quiz/daily-claim` **tidak** boleh memanggilnya:
//      kehadiran bukan kontribusi.
//   4. `users.role` hanya ditulis ke `"contributor"` oleh tiga berkas yang
//      disebut namanya, masing-masing dengan alasan tertulis.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { withoutComments } from "../helpers/source";

const SRC_DIR = path.join(process.cwd(), "src");

/** Semua berkas `.ts`/`.tsx` di bawah `src/`, relatif terhadap `src/`. */
function sourceFiles(dir: string = SRC_DIR, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full, path.join(prefix, entry)));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    found.push(path.join(prefix, entry).replaceAll("\\", "/"));
  }
  return found;
}

/** Isi berkas tanpa komentar. Dibaca sekali, dipakai oleh semua pemeriksaan. */
function read(relativePath: string): string {
  return withoutComments(readFileSync(path.join(SRC_DIR, relativePath), "utf8"));
}

const FILES = sourceFiles();

/**
 * Berkas yang boleh menulis `role: "contributor"`, beserta alasannya.
 *
 * Sebuah allowlist adalah tempat kode mati bersembunyi, jadi setiap entri harus
 * menyebut alasan yang masih benar. Menambah entri baru berarti menambah pintu
 * evolusi peran — dan itu keputusan produk, bukan keputusan test.
 */
const CONTRIBUTOR_WRITERS = new Map([
  ["lib/promotion.ts", "satu-satunya gerbang promosi student → contributor"],
  ["lib/seasonCron.ts", "kursi yang berakhir kembali menjadi contributor"],
  ["db/seed.ts", "data benih untuk pengembangan lokal"],
]);

describe("ekspresi promosi lama tidak kembali", () => {
  it("finds no `CASE WHEN role = 'student'` anywhere in src", () => {
    const offenders = FILES.filter((file) =>
      /CASE\s+WHEN\s+role\s*=\s*'student'/i.test(read(file)),
    );

    expect(offenders).toEqual([]);
  });

  it("finds no `'contributor'::role` cast anywhere in src", () => {
    // Bentuk yang sama, ejaan lain: satu baris `sql` sudah cukup untuk
    // mengembalikan promosi tanpa ambang.
    const offenders = FILES.filter((file) => read(file).includes("::role"));

    expect(offenders).toEqual([]);
  });
});

describe("setiap route approval memanggil satu gerbang promosi", () => {
  const approveRoutes = FILES.filter((file) => /^app\/api\/.*\/approve\/route\.ts$/.test(file));

  it("finds the approve routes at all", () => {
    // Gerbang yang memindai daftar kosong selalu hijau. Kalau pola path-nya
    // berubah, tes ini yang memberi tahu, bukan produksi.
    expect(approveRoutes.length).toBeGreaterThanOrEqual(3);
    expect(approveRoutes).toContain("app/api/modules/approve/route.ts");
    expect(approveRoutes).toContain("app/api/questions/approve/route.ts");
    expect(approveRoutes).toContain("app/api/exams/approve/route.ts");
  });

  it.each([
    "app/api/modules/approve/route.ts",
    "app/api/questions/approve/route.ts",
    "app/api/exams/approve/route.ts",
  ])("%s imports promoteIfEligible", (file) => {
    const source = read(file);
    expect(source).toContain('from "@/lib/promotion"');
    expect(source).toContain("promoteIfEligible(");
  });
});

describe("kehadiran bukan kontribusi", () => {
  it.each(["app/api/quiz/submit/route.ts", "app/api/quiz/daily-claim/route.ts"])(
    "%s does not promote anyone",
    (file) => {
      // Menjawab kuis dan mengklaim hadiah harian boleh memberi poin, tetapi
      // tidak boleh memberi peran. Kalau salah satunya memanggil gerbang ini,
      // "kontributor" berhenti berarti "pernah membuat karya".
      const source = read(file);
      expect(source).not.toContain("promoteIfEligible");
      expect(source).not.toContain("@/lib/promotion");
    },
  );
});

describe("penulis `users.role = contributor`", () => {
  it("keeps the list of writers down to the three that have a reason", () => {
    const writers = FILES.filter((file) => /role:\s*"contributor"/.test(read(file)));

    expect(writers.sort()).toEqual([...CONTRIBUTOR_WRITERS.keys()].sort());
  });

  it("documents a reason for every allowlisted writer", () => {
    for (const reason of CONTRIBUTOR_WRITERS.values()) {
      expect(reason.length).toBeGreaterThan(10);
    }
  });
});
