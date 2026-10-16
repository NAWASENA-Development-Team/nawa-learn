// src/lib/securityHeaders.ts
// ─── Security headers ─────────────────────────────────────────────────────────
// One module decides which security headers this app sends, so `next.config.ts`
// (static headers, build time) and `src/proxy.ts` (per-request CSP, Edge runtime)
// cannot drift apart.
//
// Deliberately **import-free**. `next.config.ts` is loaded outside the app's
// module graph, so anything Node- or Clerk-specific in here would be a bundling
// hazard for the config loader. `CSP_DIRECTIVES` is a plain string map for that
// reason; `src/proxy.ts` narrows it to Clerk's directive type at the call site.

export type HeaderPair = { key: string; value: string };

/** Where browsers POST CSP violation reports. Public route — see `PUBLIC_ROUTES`. */
export const CSP_REPORT_PATH = "/api/csp-report";

/** Every CSP directive is a list of source expressions. */
export type CspDirectives = Record<string, string[]>;

/**
 * Merged on top of Clerk's defaults (see `content-security-policy.js` under
 * `@clerk/nextjs/dist/` in `node_modules`), which already allow
 * Clerk's own frontend API, telemetry, `img.clerk.com`, Stripe, Google Maps and
 * the Cloudflare Turnstile challenge frame. Clerk *unions* the lists for
 * directives it already knows about, so everything below can only widen the
 * policy — which is why the interesting entries here are the ones that add a
 * restriction (`'none'`) or a source Clerk does not know about.
 *
 * What each entry is for:
 *
 *   object-src 'none'       no `<embed>`/`<object>`/`<applet>` plugin surface.
 *                           We only ever use `<embed>` for our own blob PDFs,
 *                           which is `frame-src`/`img-src` territory in modern
 *                           browsers, not a plugin.
 *   base-uri 'self'         stops an injected `<base>` from re-pointing every
 *                           relative URL on the page at an attacker's origin.
 *   frame-ancestors 'none'  clickjacking. `X-Frame-Options: DENY` covers old
 *                           browsers, this covers the ones that dropped it.
 *   img-src                 `data:` for the legacy base64 PDFs/photos still in
 *                           the database, `blob:` for the camera capture
 *                           preview, and our own Vercel Blob store for uploaded
 *                           avatars and module previews.
 *   frame-src https:        the module reader embeds arbitrary approved external
 *                           content in an `<iframe>` (Google Drive, Canva,
 *                           YouTube…). Moderator-approved, but genuinely any
 *                           https host — see the M9 note in
 *                           docs/AUDIT-AND-ROADMAP.md for the trade-off.
 *   connect-src 'self'      every `fetch()` in the app is same-origin. Clerk's
 *                           default adds its own frontend API host.
 */
export const CSP_DIRECTIVES: CspDirectives = {
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "frame-ancestors": ["'none'"],
  "img-src": ["'self'", "data:", "blob:", "https://*.blob.vercel-storage.com"],
  "frame-src": ["'self'", "https:"],
  "connect-src": ["'self'"],
};

/**
 * Headers that do not depend on the request, so they can be declared once in
 * `next.config.ts` instead of being rebuilt on every invocation.
 */
export const SECURITY_HEADERS: HeaderPair[] = [
  // Stop a browser from re-interpreting a response as a different type. Without
  // it, an uploaded file that sniffs as HTML can be served as HTML from our
  // origin. Matters most for the object-storage and API responses.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Send the full URL to same-origin requests, but only the origin to other
  // sites. Module URLs and report payloads contain ids we would rather not hand
  // to whatever a student clicks next.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Legacy twin of `frame-ancestors 'none'`, kept for browsers that never
  // implemented the CSP directive.
  { key: "X-Frame-Options", value: "DENY" },

  // Deny every powerful feature by default. `camera=(self)` is the one the app
  // actually needs: SubmitClient captures a photo of handwritten notes with
  // `navigator.mediaDevices.getUserMedia`.
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "serial=()",
      "bluetooth=()",
      "accelerometer=()",
      "gyroscope=()",
      "magnetometer=()",
    ].join(", "),
  },

  // Isolate the browsing context from cross-origin openers while still letting
  // popups we open keep `window.opener`. `same-origin` would sever that link and
  // break Clerk's popup-based OAuth ("Masuk dengan Google"); this exact value is
  // the documented safe choice for that flow.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

/**
 * HSTS is a long-lived commitment, so it is only sent from a production build.
 * `includeSubDomains` here means subdomains of the host that sends it
 * (`*.learn.nawasena.site`), not every sibling of `nawasena.site`.
 *
 * `preload` is deliberately absent: it is a one-way door that requires a
 * submission to the browser vendors' list and is painful to undo. Add it as a
 * separate, deliberate decision once every subdomain is known to be https-only.
 */
export const HSTS_HEADER: HeaderPair = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains",
};

/** The header set for a given build, ready for `next.config.ts` `headers()`. */
export function staticSecurityHeaders(isProduction: boolean): HeaderPair[] {
  return isProduction ? [...SECURITY_HEADERS, HSTS_HEADER] : [...SECURITY_HEADERS];
}
