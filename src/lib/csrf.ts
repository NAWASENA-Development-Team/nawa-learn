// src/lib/csrf.ts
// ─── Cross-site request forgery guard ─────────────────────────────────────────
// Every mutation in this app is a cookie-authenticated `fetch` to our own
// origin. The session cookie itself is already `SameSite=Lax` and Clerk-managed,
// which stops the classic cross-site `<form>` POST — but "the browser will not
// send the cookie" is a property of the browser, not of our code. This module is
// the part we control, and it runs before any handler does.
//
// The check is the standard one: for a state-changing method, if the browser
// told us where the request came from, that origin has to be us.
//
//   Origin present       → its host must equal the host we were addressed as.
//   Origin absent        → a non-browser client (Svix webhook, cron, curl).
//                          Fall back to `Sec-Fetch-Site` when present.
//
// We compare **hosts, not full origins**. The scheme is not reliable behind TLS
// termination (the request may arrive as `http` while the browser saw `https`),
// and a browser cannot forge the `Host` header it is connecting to. Ports are
// part of the host string, so a different port still fails.

/** Methods that can change state. Everything else is read-only and unchecked. */
export const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * The part of a `NextRequest` this module needs. Structural, so a test can pass
 * a plain object and the proxy can pass the real thing.
 */
export interface RequestLike {
  method: string;
  headers: Headers;
  nextUrl: { protocol: string; host: string };
}

/** `x-forwarded-*` may carry a comma-separated chain; the first hop is ours. */
function firstForwarded(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first ? first : null;
}

/** The host the client actually connected to, behind any proxy. */
export function requestHost(req: RequestLike): string {
  return (
    firstForwarded(req.headers.get("x-forwarded-host")) ??
    req.headers.get("host") ??
    req.nextUrl.host
  );
}

/** The absolute origin of this request, for building absolute URLs. */
export function requestOrigin(req: RequestLike): string {
  const protocol = (
    firstForwarded(req.headers.get("x-forwarded-proto")) ?? req.nextUrl.protocol
  ).replace(/:$/, "");
  return `${protocol}://${requestHost(req)}`;
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host || null;
  } catch {
    // `Origin: null` (sandboxed iframe, opaque origin, `data:` document) is not
    // a URL. It can never be our own origin, so it fails closed.
    return null;
  }
}

/**
 * True when a state-changing request did not come from this origin and must be
 * refused before it reaches a handler.
 */
export function isCrossSiteRequest(req: RequestLike): boolean {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) return false;

  const origin = req.headers.get("origin");
  if (origin !== null) {
    const host = hostOf(origin);
    return host === null || host !== requestHost(req);
  }

  // No Origin: not a browser form/fetch. Trust `Sec-Fetch-Site` when the client
  // sent it, and require it to be exactly `same-origin` — a sibling subdomain
  // (`same-site`) is a different security boundary, and a cross-site value is
  // precisely the attack. `none` means the user initiated the navigation.
  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") return true;

  return false;
}
