// src/app/api/csp-report/route.ts
// ─── CSP violation sink ───────────────────────────────────────────────────────
// The browser posts here whenever the Content-Security-Policy in src/proxy.ts blocks
// something. Without a sink a strict policy is unfalsifiable: you cannot tell
// "nothing is being blocked" from "the report went nowhere".
//
// It is a *public* route (see PUBLIC_ROUTES in src/proxy.ts) because the browser
// sends these without credentials, and it deliberately stores nothing — it
// writes one log line per violation and answers 204. The value is entirely in
// the log drain.
//
// Two wire formats arrive, and both are accepted:
//   • `application/csp-report`    → { "csp-report": { …kebab-case… } }   (report-uri)
//   • `application/reports+json`  → [ { type, body: { …camelCase… } } ]  (report-to)
import { NextResponse } from "next/server";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";

// A single violation is well under a kilobyte; a batched report is a few. This
// is a public endpoint, so the ceiling exists to bound what an anonymous caller
// can make us parse.
const MAX_REPORT_BYTES = 16 * 1024;

// One page can violate a policy dozens of times (every blocked image). Log the
// first few — that is enough to identify the directive — and count the rest.
const MAX_LOGGED_VIOLATIONS = 10;

// Longest string field we are willing to log. A blocked `data:` URI can be
// megabytes long; the point of the line is to name the directive and the host,
// not to reproduce the payload.
const MAX_FIELD_CHARS = 200;

const ACCEPTED_CONTENT_TYPES = new Set([
  "application/csp-report",
  "application/reports+json",
  // Some proxies normalise the legacy type to this. Harmless to accept.
  "application/json",
]);

type Violation = {
  directive: string | null;
  blockedUri: string | null;
  documentUri: string | null;
  sourceFile: string | null;
  lineNumber: number | null;
  disposition: string | null;
  sample: string | null;
};

function trim(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.length > MAX_FIELD_CHARS ? `${value.slice(0, MAX_FIELD_CHARS)}…` : value;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fromLegacyReport(body: unknown): Violation | null {
  if (typeof body !== "object" || body === null) return null;
  const report = (body as Record<string, unknown>)["csp-report"];
  if (typeof report !== "object" || report === null) return null;
  const r = report as Record<string, unknown>;

  return {
    // `effective-directive` is the one that actually blocked; `violated-directive`
    // is the whole policy section and is less precise.
    directive: trim(r["effective-directive"]) ?? trim(r["violated-directive"]),
    blockedUri: trim(r["blocked-uri"]),
    documentUri: trim(r["document-uri"]),
    sourceFile: trim(r["source-file"]),
    lineNumber: asNumber(r["line-number"]),
    disposition: trim(r["disposition"]),
    sample: trim(r["script-sample"]),
  };
}

function fromReportingApi(body: unknown): Violation[] {
  if (!Array.isArray(body)) return [];
  const out: Violation[] = [];
  for (const entry of body) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (e.type !== "csp-violation") continue;
    const b = (typeof e.body === "object" && e.body !== null ? e.body : {}) as Record<string, unknown>;

    out.push({
      directive: trim(b.effectiveDirective),
      blockedUri: trim(b.blockedURL),
      documentUri: trim(b.documentURL),
      sourceFile: trim(b.sourceFile),
      lineNumber: asNumber(b.lineNumber),
      disposition: trim(b.disposition),
      sample: trim(b.sample),
    });
  }
  return out;
}

function noStore(status: number): NextResponse {
  return new NextResponse(null, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const log = requestLogger(req);

  // Anonymous, so the identity bucket is not applicable and only the IP budget
  // counts. Generous: a legitimately broken page can emit a burst, and a school
  // sits behind one NAT address.
  const limit = await rateLimit(req, "csp/report", null);
  if (!limit.ok) return limit.response;

  const contentType = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!ACCEPTED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Unsupported Media Type" },
      { status: 415, headers: { "cache-control": "no-store" } },
    );
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BYTES) {
    return noStore(413);
  }

  const raw = await req.text();
  if (raw.length > MAX_REPORT_BYTES) {
    return noStore(413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A malformed report is a client bug, not a security event.
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const violations =
    contentType === "application/reports+json"
      ? fromReportingApi(parsed)
      : (() => {
          const single = fromLegacyReport(parsed);
          return single ? [single] : fromReportingApi(parsed);
        })();

  // `csp_violation` is the alertable event name: a drain can count it by
  // `directive` and page someone when a new one appears in production.
  for (const violation of violations.slice(0, MAX_LOGGED_VIOLATIONS)) {
    log.warn("csp_violation", violation);
  }
  if (violations.length > MAX_LOGGED_VIOLATIONS) {
    log.warn("csp_violation_truncated", {
      reported: violations.length,
      logged: MAX_LOGGED_VIOLATIONS,
    });
  }

  return noStore(204);
}

/** Anything but POST is a mistake; say so instead of silently 405-ing via Next. */
export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    { status: 405, headers: { allow: "POST", "cache-control": "no-store" } },
  );
}
