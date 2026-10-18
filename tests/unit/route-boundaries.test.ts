// tests/unit/route-boundaries.test.ts
// ─── Batas route: file yang gagal secara diam-diam ────────────────────────────
// `error.tsx`, `not-found.tsx`, `global-error.tsx` dan `loading.tsx` adalah file
// konvensi: kalau salah tempat, salah nama, atau salah jenis komponen, build tetap
// hijau dan tidak ada satu pun tes lain yang gagal — yang hilang hanya perilakunya,
// dan hanya terlihat saat produksi sedang bermasalah. Itu persis pola yang sudah
// pernah menggigit proyek ini dua kali: `proxy.ts` yang mati dari M1 sampai M9 dan
// gate CI yang merah di langkah build dari M5 sampai M10.
//
// Karena itu berkas ini membaca **sumber**, bukan hasil render. Dua jebakan yang
// dijaga di sini tidak mungkin terlihat di HTML:
//
//   • `global-error.tsx` menggantikan layout akar, sehingga `globals.css` tidak
//     ikut termuat. Satu `className` di sana berarti halaman galat yang tampil
//     tanpa satu pun gayanya — dan tidak ada yang akan menyadarinya sampai layout
//     akar benar-benar gagal.
//   • `global-error.tsx` wajib merender `<html>` dan `<body>` sendiri. Tanpa itu
//     Next memakai halaman galat bawaannya, yaitu yang ingin dihindari.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const APP_DIR = path.join(SRC_DIR, "app");

function read(relativePath: string): string {
  return readFileSync(path.join(APP_DIR, relativePath), "utf8");
}

/** Membaca berkas relatif terhadap `src/`, bukan `src/app`. */
function srcRead(relativePath: string): string {
  return readFileSync(path.join(SRC_DIR, relativePath), "utf8");
}

function exists(relativePath: string): boolean {
  try {
    return statSync(path.join(APP_DIR, relativePath)).isFile();
  } catch {
    return false;
  }
}

/** Semua direktori yang memuat `page.tsx`, relatif terhadap `src/app`. */
function pageDirs(dir: string = APP_DIR, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) {
      if (entry === "page.tsx") found.push(prefix);
      continue;
    }
    if (entry.startsWith("_")) continue;
    found.push(...pageDirs(full, path.join(prefix, entry)));
  }
  return found;
}

/** Semua berkas di bawah `dir`, sebagai path relatif terhadap `dir`. */
function walk(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...walk(full, path.join(prefix, entry)));
      continue;
    }
    found.push(path.join(prefix, entry));
  }
  return found;
}

/**
 * Membuang komentar sebelum memeriksa teks yang tampil.
 *
 * Tanpa ini, sebuah komentar yang *menjelaskan* bug lama akan dihitung sebagai
 * bug itu sendiri — dan cara termudah membuat tes hijau adalah menghapus
 * penjelasannya, yang justru kebalikan dari yang diinginkan. Penyapu ini hanya
 * mengenali tiga bentuk yang dipakai repo ini (`//`, `/* *\/`, dan `{/* *\/}`
 * di JSX); ia bukan parser, dan itu cukup karena yang diperiksa hanyalah
 * keberadaan sebuah frasa, bukan struktur.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("root boundaries exist", () => {
  it.each(["error.tsx", "not-found.tsx", "global-error.tsx", "loading.tsx"])(
    "ships src/app/%s",
    (file) => {
      expect(exists(file)).toBe(true);
    },
  );

  it("keeps the dashboard's own loading skeleton", () => {
    // `(dashboard)/loading.tsx` is what covers every nested dashboard route, since
    // the nearest `loading.tsx` wins. Losing it would leave the whole dashboard on
    // the root spinner.
    expect(exists(path.join("(dashboard)", "loading.tsx"))).toBe(true);
  });
});

describe("every page has an error boundary above it", () => {
  // `error.tsx` catches errors in its own segment and everything below it, so a
  // page is covered if any ancestor directory (up to and including `src/app`)
  // contains one. Today that is the single root boundary; the invariant is what
  // matters, because it survives the day someone moves it into a route group.
  const dirs = pageDirs();

  it("finds pages to check", () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  it.each(dirs.map((dir) => [dir || "(root)", dir] as const))(
    "%s is inside a boundary",
    (_label, dir) => {
      let current = dir;
      let covered = false;
      for (;;) {
        if (exists(path.join(current, "error.tsx"))) {
          covered = true;
          break;
        }
        if (current === "") break;
        current = path.dirname(current);
        if (current === ".") current = "";
      }
      expect(covered).toBe(true);
    },
  );
});

describe("global-error.tsx", () => {
  const source = read("global-error.tsx");

  it("is a client component, as a boundary must be", () => {
    expect(source.startsWith('"use client";')).toBe(true);
  });

  it("renders its own <html> and <body>", () => {
    // Next requires this because the file *replaces* the root layout. The regex
    // demands a real attribute after the tag name, so the prose in the header
    // comment (`<html>` / `<body>`) cannot satisfy it.
    expect(source).toMatch(/<html\s+[a-zA-Z]/);
    expect(source).toMatch(/<body\s+[a-zA-Z]/);
  });

  it("uses no Tailwind classes and imports no stylesheet", () => {
    // The whole point: `globals.css` is imported by the root layout, and the root
    // layout is exactly what is being replaced when this file renders. Any
    // `className` here would be a class nobody defined.
    expect(source).not.toMatch(/\bclassName\b/);
    expect(source).not.toMatch(/^\s*import\s+[^;]*globals\.css/m);
    expect(source).toMatch(/\bstyle=/);
  });

  it("surfaces the digest so a report can be matched to a server log line", () => {
    expect(source).toMatch(/digest/);
  });
});

describe("error.tsx", () => {
  const source = read("error.tsx");

  it("is a client component", () => {
    expect(source.startsWith('"use client";')).toBe(true);
  });

  it("offers reset() as the retry path", () => {
    // Without it the only recovery is a manual page reload, which is what the
    // default Next overlay does — and the default overlay is why this file exists.
    expect(source).toMatch(/\breset\b/);
    expect(source).toMatch(/onClick=\{reset\}/);
  });

  it("surfaces the digest", () => {
    expect(source).toMatch(/digest/);
  });
});

describe("not-found.tsx", () => {
  const source = read("not-found.tsx");

  it("stays a server component", () => {
    // Nothing in it needs state or an event handler, so shipping it as client
    // JavaScript would only add weight to a page that is three links.
    expect(source.startsWith('"use client"')).toBe(false);
  });

  it("is the only place that renders 404 copy", () => {
    // Before M14c `profile/[id]` carried its own "Siswa Tidak Ditemukan" card,
    // which meant the same state had two designs and one of them was reached by a
    // database outage as well. A second copy is now a test failure.
    //
    // The scan covers all of `src/`, not just `src/app`: a hand-rolled 404 in a
    // component would escape a narrower sweep just as easily. The two phrases are
    // the ones that describe *a page or profile that does not exist* — deliberately
    // not every string containing "tidak ditemukan", because `SubmitClient` shows
    // "Profil Tidak Ditemukan" for a different condition (the signed-in user has no
    // synced row yet) and that message is correct where it is.
    const ROUTE_404_COPY = ["Halaman Tidak Ditemukan", "Siswa Tidak Ditemukan"];
    const boundary = path.join("app", "not-found.tsx");
    const offenders = walk(SRC_DIR)
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => file !== boundary)
      .filter((file) => {
        const text = withoutComments(srcRead(file));
        return ROUTE_404_COPY.some((phrase) => text.includes(phrase));
      });
    expect(offenders).toEqual([]);
  });
});

describe("the public profile page", () => {
  const source = readFileSync(
    path.join(APP_DIR, "(dashboard)", "profile", "[id]", "page.tsx"),
    "utf8",
  );

  it("routes a malformed id to notFound() instead of querying the database", () => {
    // `users.id` is `uuid`, so `WHERE id = 'halo'` raises 22P02. That used to be
    // caught together with real database errors and rendered as "not found".
    expect(source).toMatch(/isUuid\(profileUserId\)/);
    expect(source).toMatch(/notFound\(\)/);
  });

  it("rethrows a database failure so the error boundary can own it", () => {
    expect(source).toMatch(/throw err/);
  });
});

describe("animated skeletons", () => {
  it("every shimmer reference has keyframes behind it", () => {
    // `animate-[shimmer_1.5s_infinite]` pointed at a keyframe that did not exist
    // until M14c, so two skeletons were silently static. A CSS animation that
    // never runs looks identical to one that has finished.
    //
    // The sweep covers all of `src/`, because the markup moved to
    // `src/components/profile/ProfileSkeleton.tsx`. Scanning only `src/app` would
    // find zero references and pass without checking anything — a vacuous gate is
    // worse than none, so the "found something" assertion below is load-bearing.
    const users = walk(SRC_DIR)
      .filter((file) => file.endsWith(".tsx"))
      .filter((file) => srcRead(file).includes("animate-[shimmer"));
    expect(users.length).toBeGreaterThan(0);

    const css = readFileSync(path.join(APP_DIR, "globals.css"), "utf8");
    expect(css).toMatch(/@keyframes\s+shimmer\b/);
  });
});
