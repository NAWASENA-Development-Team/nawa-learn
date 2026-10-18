// src/app/sitemap.ts
// ─── The three URLs this site actually publishes ─────────────────────────────
// This list is short on purpose, and that is the honest description of the app:
// modules, questions, the leaderboard and every profile live behind a session
// and answer a redirect to Clerk when fetched anonymously. A sitemap that listed
// them would be a list of redirects.
//
// Which is also why this file must not grow by copying a route list out of
// `src/app/**`. A URL belongs here only if an anonymous visitor — or a crawler,
// which is an anonymous visitor with no cookie jar — gets a 200 from it. The
// public set is defined by `PUBLIC_ROUTES` in `src/proxy.ts`; the three entries
// below are the page-shaped subset of it. `/api/health`, `/api/csp-report` and
// `/api/webhooks/**` are public but are not pages, and the cron route is not
// meant to be discovered at all.
//
// `tests/unit/metadata-routes.test.ts` pins this set so that adding a URL here
// is a deliberate edit with a comment, not an accident.
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

type PublicPage = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

const PUBLIC_PAGES: PublicPage[] = [
  // The landing page. It is the only thing here with any reason to change often.
  { path: "/", changeFrequency: "monthly", priority: 1 },
  // Legal documents. `changeFrequency: "yearly"` is not pessimism: `POLICY_VERSION`
  // only moves when the policy text moves, and the retention table on /privacy is
  // rendered from `RETENTION_POLICY` rather than rewritten by hand.
  { path: "/privacy", changeFrequency: "yearly", priority: 0.5 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  // `lastModified` is deliberately absent. The tempting value is `new Date()`,
  // which tells a crawler "everything changed just now, every time you ask" —
  // a signal that is wrong every day except the one it was written, and that
  // eventually trains the crawler to distrust the whole file. A sitemap without
  // it is a normal, valid sitemap. Reintroduce it per entry only when the entry
  // has a real timestamp to read (a DB `max(updated_at)`, say).
  return PUBLIC_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    changeFrequency,
    priority,
  }));
}
