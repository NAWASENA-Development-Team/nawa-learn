// tests/unit/metadata-routes.test.ts
// ─── The crawler-facing files, checked against the routes that actually exist ─
// `robots.ts`, `sitemap.ts` and `manifest.ts` are the three files whose failure
// mode is silence. A robots file that omits a route does not break anything; it
// just lets crawlers wander into `/api/**`. A sitemap that lists a URL that no
// longer exists is still valid XML. A manifest that points at an icon path that
// Next never serves installs with a blank tile. Nothing in the app notices any of
// it, which is exactly why these assertions read the filesystem instead of
// trusting the lists to stay in step by hand.
//
// The central test below derives the app's top-level URL segments from
// `src/app/**/page.tsx`, strips route groups (they do not appear in a URL), and
// requires every one of them to be either published in the sitemap or excluded in
// robots. Adding `src/app/(dashboard)/calendar/page.tsx` therefore fails this
// file until someone decides which it is — the same "gate the source, not the
// output" discipline as `pii-surface.test.ts`.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SITE_NAME, SITE_TITLE, SITE_URL, absoluteUrl } from "@/lib/site";

const APP_DIR = path.join(process.cwd(), "src", "app");

/**
 * Every URL path served by a `page.tsx`, as a segment array.
 *
 * Route groups — `(auth)`, `(dashboard)` — are organisational only: Next strips
 * them from the URL, so they must not become a segment here. Dynamic segments
 * are kept verbatim (`[id]`, `[[...sign-in]]`); only the first segment is used by
 * the tests below, and that one is always a literal.
 */
function pagePaths(dir: string = APP_DIR, prefix: string[] = []): string[][] {
  const found: string[][] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) {
      if (entry === "page.tsx") found.push(prefix);
      continue;
    }
    // `_private` folders are Next's opt-out from routing; they hold no pages.
    if (entry.startsWith("_")) continue;
    const isGroup = /^\(.*\)$/.test(entry);
    found.push(...pagePaths(full, isGroup ? prefix : [...prefix, entry]));
  }
  return found;
}

/** `"/profile"` for `(dashboard)/profile/[id]/page.tsx`, `"/"` for the root. */
function topLevelPaths(): string[] {
  const paths = new Set(pagePaths().map((segments) => (segments.length ? `/${segments[0]}` : "/")));
  return [...paths].sort();
}

const ROBOTS = robots();
const SITEMAP = sitemap();
const MANIFEST = manifest();

/** `rules` may be one object or an array; this file writes one. */
const RULES = Array.isArray(ROBOTS.rules) ? ROBOTS.rules : [ROBOTS.rules];

const ALLOW = RULES.flatMap((rule) => ([] as string[]).concat(rule.allow ?? []));
const DISALLOW = RULES.flatMap((rule) => ([] as string[]).concat(rule.disallow ?? []));

/** robots.txt prefix semantics: an entry matches its own path and anything below. */
const isDisallowed = (urlPath: string) => DISALLOW.some((entry) => urlPath.startsWith(entry));

const sitemapPaths = SITEMAP.map((entry) => new URL(entry.url).pathname);

describe("src/lib/site.ts", () => {
  it("resolves an origin without a trailing slash", () => {
    // `${SITE_URL}/privacy` is written all over the metadata files; a trailing
    // slash here would produce `//privacy`, which some crawlers treat as a
    // distinct URL and most CDNs normalise with a redirect.
    expect(SITE_URL).not.toMatch(/\/$/);
    expect(() => new URL(SITE_URL)).not.toThrow();
    expect(new URL(SITE_URL).origin).toBe(SITE_URL);
  });

  it("falls back to localhost rather than throwing when nothing is configured", () => {
    // No `NEXT_PUBLIC_SITE_URL` and no Vercel context in this test process. The
    // important half is `not.toThrow`: this module is imported by the root
    // layout, so a throw here would take down every route in the app.
    //
    // The assertion below is skipped when a developer has set the override
    // themselves — their machine is not the environment this test describes, and
    // failing there would be a false alarm about the wrong thing. CI sets neither
    // variable, so the real assertion does run there.
    const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (configured) {
      // Same normalisation the module performs: accept a bare host or a full URL.
      const asUrl = configured.includes("://") ? configured : `https://${configured}`;
      expect(SITE_URL).toBe(new URL(asUrl).origin);
      return;
    }
    expect(SITE_URL).toBe("http://localhost:3000");
  });

  it("normalises a path that forgot its leading slash", () => {
    expect(absoluteUrl("privacy")).toBe(`${SITE_URL}/privacy`);
    expect(absoluteUrl("/privacy")).toBe(`${SITE_URL}/privacy`);
  });
});

describe("src/app/robots.ts", () => {
  it("points at an absolute sitemap URL", () => {
    // A relative `Sitemap:` value is ignored rather than rejected, so a wrong one
    // produces a file that looks correct and does nothing.
    expect(ROBOTS.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(new URL(String(ROBOTS.sitemap)).origin).toBe(SITE_URL);
  });

  it("does not disallow anything the sitemap publishes", () => {
    for (const urlPath of sitemapPaths) {
      expect(
        isDisallowed(urlPath),
        `${urlPath} is published in sitemap.ts but excluded by robots.ts — a crawler ` +
          `is told to index a URL it is also told not to fetch.`,
      ).toBe(false);
    }
  });

  it("keeps /api out of the crawl", () => {
    // Every route under /api answers 401 without a session, so a crawl of it is
    // pure cost: a request, a Clerk session lookup and a log line per URL.
    expect(isDisallowed("/api/health")).toBe(true);
    expect(isDisallowed("/api/bookmarks")).toBe(true);
  });

  it("decides every route that exists, instead of leaving it to chance", () => {
    // The load-bearing test in this file. A new page is either public (it must
    // appear in sitemap.ts) or private (it must be covered by a disallow entry).
    // There is no third state where it is merely absent from both lists.
    for (const urlPath of topLevelPaths()) {
      const published = sitemapPaths.includes(urlPath);
      expect(
        published || isDisallowed(urlPath),
        `Route ${urlPath} is neither in sitemap.ts nor excluded by robots.ts. ` +
          `Add it to PRIVATE_PREFIXES in src/app/robots.ts, or — if an anonymous ` +
          `visitor really gets a 200 from it — publish it in src/app/sitemap.ts ` +
          `and add it to PUBLIC_ROUTES in src/proxy.ts.`,
      ).toBe(true);
    }
  });

  it("allows the public pages explicitly rather than by omission", () => {
    // `allow: "/"` plus a disallow list is the shape in use: the disallow entries
    // are longer prefixes, so they win. This pins that the root itself is not
    // caught by any disallow entry.
    expect(ALLOW).toContain("/");
    expect(isDisallowed("/")).toBe(false);
  });
});

describe("src/app/sitemap.ts", () => {
  it("emits absolute http(s) URLs, all distinct", () => {
    const urls = SITEMAP.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url.startsWith("http://") || url.startsWith("https://")).toBe(true);
      expect(new URL(url).origin).toBe(SITE_URL);
    }
  });

  it("publishes only routes that exist on disk", () => {
    // Catches the reverse drift: a route that was renamed or deleted but is still
    // advertised, which a crawler reports as a 404 against our own sitemap.
    const existing = new Set(topLevelPaths());
    for (const urlPath of sitemapPaths) {
      expect(existing.has(urlPath), `${urlPath} is in sitemap.ts but has no page.tsx`).toBe(true);
    }
  });

  it("omits lastModified on purpose", () => {
    // A `new Date()` here means "changed just now" on every request, which is a
    // signal that is wrong every day except the one it was written. If a real
    // timestamp is ever wired up this assertion should be replaced, not deleted.
    for (const entry of SITEMAP) expect(entry.lastModified).toBeUndefined();
  });
});

describe("src/app/manifest.ts", () => {
  it("identifies the app with the names the rest of the app uses", () => {
    expect(MANIFEST.name).toBe(SITE_TITLE);
    expect(MANIFEST.short_name).toBe(SITE_NAME);
    expect(MANIFEST.lang).toBe("id");
  });

  it("keeps short_name short enough for a home-screen label", () => {
    // Android and iOS both truncate at roughly 12 characters; past that the tile
    // shows an ellipsis instead of the name.
    expect((MANIFEST.short_name ?? "").length).toBeLessThanOrEqual(12);
  });

  it("scopes the installed app to the site root", () => {
    expect(MANIFEST.start_url).toBe("/");
    expect(MANIFEST.scope).toBe("/");
  });

  it("declares at least one icon, with an absolute path", () => {
    expect(MANIFEST.icons?.length).toBeGreaterThan(0);
    for (const icon of MANIFEST.icons ?? []) expect(icon.src.startsWith("/")).toBe(true);
  });

  it("uses valid hex colours", () => {
    // Both fields are read by the OS splash screen, which ignores anything it
    // cannot parse — silently, with a white flash on a dark-themed app.
    for (const value of [MANIFEST.background_color, MANIFEST.theme_color]) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("the proxy lets crawler metadata through", () => {
  it("lists /robots.txt and /sitemap.xml in PUBLIC_ROUTES", () => {
    // These two are the only metadata routes the proxy's matcher does not
    // exclude (`.txt` and `.xml` are not in its static-extension list). Without
    // the entries, both answer a 307 to Clerk's hosted sign-in domain, which is
    // indistinguishable from "the whole site is a login page". Source-read on
    // purpose: the failure is invisible at runtime until a crawler sees it, and
    // `scripts/verify-proxy.mjs` covers the runtime half.
    const proxy = readFileSync(path.join(process.cwd(), "src", "proxy.ts"), "utf8");
    expect(proxy).toContain("'/robots.txt'");
    expect(proxy).toContain("'/sitemap.xml'");
  });
});
