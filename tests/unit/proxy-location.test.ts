// tests/unit/proxy-location.test.ts
// ─── A tripwire for a silent, eight-milestone outage ─────────────────────────
// Next.js resolves file conventions (`proxy.ts`, `instrumentation.ts`, …)
// **relative to the directory that holds `app`/`pages`**. This project keeps its
// app at `src/app`, so the convention directory is `src/`.
//
// Getting this wrong does not fail the build, does not fail typechecking, and
// does not warn. The file simply never runs. That is exactly what happened here:
// `proxy.ts` sat at the repo root from M1 to M9, so the deny-by-default auth
// gate, the CSRF guard, and the CSP were all dead code while eight milestones of
// documentation described them as working (see C6 in docs/AUDIT-AND-ROADMAP.md).
//
// Note what is deliberately *not* asserted here: `middleware-manifest.json`. On
// Next 16 + Turbopack it stays `{"middleware":{}}` whether or not the proxy is
// live, so it is not evidence of anything. The real signals are the build's
// `ƒ Proxy (Middleware)` line and runtime behaviour — neither of which a unit
// test can reach. This test only closes the filesystem side.
//
// A filesystem assertion is an unusual thing to put in a test suite. It earns
// its place because the failure mode is *invisible*: nothing else in this suite,
// and nothing in `next build`, can see it. If this test ever fails, do not
// "fix" it by editing the path — move the file.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withoutComments } from "../helpers/source";

const root = process.cwd();

const exists = (relative: string) => existsSync(path.join(root, relative));

describe("Next.js file-convention locations", () => {
  it("keeps the app under src/, which is the premise of every assertion below", () => {
    expect(exists("src/app/layout.tsx")).toBe(true);
  });

  it("places the proxy where Next will actually load it (src/proxy.ts)", () => {
    expect(exists("src/proxy.ts")).toBe(true);
  });

  it("leaves no proxy at the repo root, where Next would silently ignore it", () => {
    expect(exists("proxy.ts")).toBe(false);
    expect(exists("proxy.js")).toBe(false);
  });

  it("leaves no deprecated middleware file behind (Next 16 renamed it to proxy)", () => {
    expect(exists("middleware.ts")).toBe(false);
    expect(exists("src/middleware.ts")).toBe(false);
  });
});

// ─── Setiap jalur cron harus publik bagi proxy ────────────────────────────────
//
// Penjadwal platform tidak punya sesi. Sebuah jalur cron yang tidak terdaftar di
// matcher proxy dijawab **307 ke halaman masuk Clerk** untuk permintaan yang
// membawa bearer token dan tidak membawa cookie — job-nya lalu gagal setiap
// malam, dan tidak ada satu pun bagian dari respons yang menjelaskan sebabnya.
//
// Itu bukan hipotesis: M16 menambahkan `POST /api/cron/season` dan lupa
// mendaftarkannya, dan tidak ada gerbang mana pun yang memerah. Yang menangkapnya
// adalah pemeriksaan manual, yang justru jenis kontrol yang sudah tiga kali
// terbukti tidak pernah dijalankan (C6, C8, dan lint M4–M13).
//
// Diperiksa dua arah, karena keduanya kegagalan yang berbeda: jalur yang lupa
// didaftarkan berarti job yang tidak pernah berjalan, sedangkan jalur yang
// terdaftar tanpa route berarti konfigurasi mati yang membuat daftar ini
// menipu.
describe("cron routes and the proxy allowlist", () => {
  const cronRoot = path.join(root, "src/app/api/cron");

  /** Nama direktori di bawah `src/app/api/cron` yang benar-benar punya route. */
  function cronRoutePaths(): string[] {
    return readdirSync(cronRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => exists(`src/app/api/cron/${entry.name}/route.ts`))
      .map((entry) => `/api/cron/${entry.name}`)
      .sort();
  }

  /** Isi array `createRouteMatcher([...])`, tanpa komentar. */
  function publicRoutesSource(): string {
    const source = readFileSync(path.join(root, "src/proxy.ts"), "utf8");
    const open = source.indexOf("createRouteMatcher([");
    expect(open, "src/proxy.ts no longer calls createRouteMatcher([...])").toBeGreaterThan(-1);
    const close = source.indexOf("])", open);
    expect(close).toBeGreaterThan(open);
    return withoutComments(source.slice(open, close));
  }

  it("finds at least one cron route, so the scan cannot pass over nothing", () => {
    expect(cronRoutePaths().length).toBeGreaterThan(0);
  });

  it("lists every cron route as public", () => {
    const matcher = publicRoutesSource();
    for (const routePath of cronRoutePaths()) {
      expect(
        matcher.includes(`'${routePath}'`),
        `${routePath} is missing from PUBLIC_ROUTES in src/proxy.ts. ` +
          "The scheduler has no session, so this route would answer a 307 to " +
          "Clerk's sign-in page and never run.",
      ).toBe(true);
    }
  });

  it("lists no cron route that does not exist", () => {
    const matcher = publicRoutesSource();
    const listed = [...matcher.matchAll(/'(\/api\/cron\/[a-z0-9-]+)'/g)]
      .map((match) => match[1])
      .sort();

    expect(listed).toEqual(cronRoutePaths());
  });

  // ─── Dan probe runtime-nya harus memakai metode yang benar ──────────────────
  // Dua gerbang di atas menjaga allowlist, tetapi keduanya hanya membaca sumber.
  // Probe runtime-lah yang membuktikan jalurnya benar-benar sampai ke handler,
  // dan probe itu punya satu cara gagal yang tidak terlihat dari sini: metode
  // HTTP yang salah.
  //
  // Kedua route cron menjawab `405` untuk `GET` dengan sengaja — sebuah `GET`
  // bisa dipicu prefetcher, crawler, atau tab yang tidak sengaja dibuka, dan
  // kedua job ini mengubah peran pengguna atau menghapus baris. Probe `GET`
  // karenanya dijawab penjaga metode dan **tidak pernah sampai ke gerbang
  // bearer**, lalu gagal dengan pesan yang menuduh gerbangnya hilang padahal
  // gerbangnya sehat. Itu persis yang memerahkan run CI pertama M16: satu-satunya
  // langkah yang merah adalah probe runtime, dan kodenya benar.
  it("probes the cron routes with POST, the method their own gate expects", () => {
    const script = withoutComments(readFileSync(path.join(root, "scripts/verify-proxy.mjs"), "utf8"));

    expect(
      script,
      "scripts/verify-proxy.mjs must send POST to the cron probes: both routes " +
        "answer 405 to GET by design, so a GET probe never reaches the bearer gate.",
    ).toMatch(/probe\(\s*path\s*,\s*"POST"\s*\)/);

    // The default must stay GET so a metadata probe is not silently turned into
    // a mutation against some future route.
    expect(script).toMatch(/function probe\(pathname, method = "GET"\)/);
  });
});
