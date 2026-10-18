// src/app/robots.ts
// ─── What a crawler is allowed to fetch ──────────────────────────────────────
// This file did not exist until M14b, which meant `/robots.txt` was answered by
// the deny-by-default proxy: a 307 to Clerk's hosted sign-in domain. A crawler
// that follows that redirect concludes the whole site is a login page, and the
// landing page — the one page that is genuinely public — never gets indexed.
//
// There is a second, quieter cost. With no `robots.txt`, well-behaved crawlers
// still fetch `/`, `/api/**` and everything they can guess, and every one of
// those guesses hits the proxy, Clerk's session check and (for `/api`) a 401.
// An explicit file is cheaper for us and clearer for them.
//
// This file is only reachable because `/robots.txt` was added to
// `PUBLIC_ROUTES` in `src/proxy.ts` — the proxy's matcher does not exclude
// `.txt`. `scripts/verify-proxy.mjs` asserts it answers 200 in CI, because a
// `robots.ts` that the auth gate hides is exactly the kind of control that looks
// present and does nothing.
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * Everything below is session-gated. Listing these is not what protects them —
 * the proxy and `requireUser()` are — it only stops crawlers from wasting
 * requests on URLs that can only ever answer a redirect.
 *
 * `/sign-in` and `/sign-up` are listed because our own routes redirect to Clerk's
 * hosted pages; indexing the hop adds nothing and surfaces a login screen in
 * search results.
 */
const PRIVATE_PREFIXES = [
  "/api/",
  "/sign-in",
  "/sign-up",
  "/consent",
  "/leaderboard",
  "/moderator",
  "/modules",
  "/profile",
  "/questions",
  "/submit",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Allowed by default: `/`, `/privacy` and `/terms` are the public surface,
      // and a prospective student has to be able to read the policy before they
      // have an account. A `Disallow: /` with a list of `Allow` exceptions reads
      // as "nothing is public" and is the harder shape to keep correct.
      allow: "/",
      disallow: PRIVATE_PREFIXES,
    },
    // Absolute, because a relative sitemap reference is ignored rather than
    // rejected. `absoluteUrl` resolves it from the deployment's own origin.
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
