// src/lib/site.ts
// ─── One place that knows what this site is called and where it lives ─────────
// `robots.ts`, `sitemap.ts`, `manifest.ts` and the root layout all need the same
// three facts: the site's name, its description, and its absolute origin. Three
// copies of a string are three chances for one of them to go stale, and the
// origin is worse than a string — `sitemap.xml` and `robots.txt` must contain
// *absolute* URLs, and a relative one is silently ignored by a crawler rather
// than rejected, so a wrong origin produces a valid-looking file that indexes
// nothing.
//
// The origin is resolved, never hardcoded, because the same code runs on
// `localhost:3000`, on a Vercel preview deployment and on the production domain,
// and each of those must describe itself accurately. A sitemap that advertises
// `localhost` in production is the classic form of this bug.
//
// Order, and why:
//   1. `NEXT_PUBLIC_SITE_URL` — an explicit override. It exists for a custom
//      domain that Vercel does not know about, and for local work where you want
//      to see production-shaped absolute URLs.
//   2. `VERCEL_PROJECT_PRODUCTION_URL` — injected by Vercel and *always* set,
//      even on a preview deployment, where it points at production on purpose.
//      That is the correct answer for a sitemap: previews must not advertise
//      themselves as indexable.
//   3. `http://localhost:3000` — local development with no Vercel context.
//
// This module must never throw at import time. It is imported by the root layout,
// which every route renders, so a typo in an environment variable would take the
// whole app down — including the pages that would explain what is wrong. A bad
// value falls back and is ignored, which is the same trade-off `readLimit` makes
// for a malformed `?limit=`: a typo is a typo, not a reason to 500.

/** Short name. Fits a browser tab, a home-screen label and a manifest `short_name`. */
export const SITE_NAME = "NAWA-LEARN";

/** Full title. The root layout's default `<title>` and the manifest `name`. */
export const SITE_TITLE = "NAWA-LEARN | SMAN 2 Jonggol";

/** One sentence, reused by `<meta name="description">`, Open Graph and the manifest. */
export const SITE_DESCRIPTION =
  "Platform belajar kolaboratif OSIS NAWASENA SMAN 2 Jonggol: berbagi modul, berlatih soal, dan bersaing sehat di papan peringkat.";

const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * Trims trailing slashes and validates. Returns `null` for anything that is not a
 * usable http(s) origin, so the caller can fall through to the next candidate.
 */
function parseOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  // `VERCEL_PROJECT_PRODUCTION_URL` is a bare host (`nawa.example.com`), while a
  // hand-written override usually carries a scheme. Accept both rather than
  // making the operator remember which one this particular variable wants.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    // A `javascript:` or `file:` origin is not a site origin, and neither is one
    // with a path or credentials. Refusing them here means `absoluteUrl()` below
    // cannot be tricked into emitting something that is not a URL.
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * The absolute origin, with no trailing slash — so callers can write
 * `${SITE_URL}/privacy` and `${SITE_URL}/sitemap.xml` without a double slash.
 */
export const SITE_URL =
  parseOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
  parseOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  LOCAL_ORIGIN;

/**
 * Resolves a site-relative path against {@link SITE_URL}.
 *
 * `pathname` must start with `/`; anything else is treated as relative to the
 * root rather than resolved as a sibling of it, because every caller in this app
 * passes an app path and a silent `..` escape would be a surprise.
 */
export function absoluteUrl(pathname: string): string {
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
