// tests/unit/securityHeaders.test.ts
// Two layers are checked here, on purpose:
//
//   1. The static header list, directly — cheap, and it is the part that must
//      never quietly lose `nosniff` or gain `preload`.
//   2. The *effective* Content-Security-Policy, by invoking the real proxy with
//      a real request. Clerk merges our directives into its own defaults and
//      mints the nonce, and the app's sign-in breaks if that merge stops
//      producing a nonce or drops `strict-dynamic`. Asserting on our input
//      object alone would prove nothing about what the browser receives.
//
// The proxy is imported dynamically because Clerk reads its keys from the
// environment at module load, so the stubs have to be in place first.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  CSP_DIRECTIVES,
  CSP_REPORT_PATH,
  HSTS_HEADER,
  SECURITY_HEADERS,
  staticSecurityHeaders,
} from "@/lib/securityHeaders";

const HOST = "learn.nawasena.site";
const ORIGIN = `https://${HOST}`;

// A structurally valid test publishable key: `pk_test_` + base64("<fapi>$").
// Clerk only parses it, it never leaves the process.
const PUBLISHABLE_KEY = `pk_test_${Buffer.from("example.clerk.accounts.dev$").toString("base64")}`;

type Proxy = (req: NextRequest, event: unknown) => Promise<Response>;

let proxy: Proxy;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", PUBLISHABLE_KEY);
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_not-a-real-secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

  proxy = ((await import("../../src/proxy")) as { default: Proxy }).default;
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function call(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  const request = new NextRequest(`${ORIGIN}${path}`, {
    method: init.method ?? "GET",
    headers: { host: HOST, ...init.headers },
  });
  return proxy(request, { waitUntil: () => {} });
}

function headerMap(response: Response): Record<string, string> {
  return Object.fromEntries(response.headers.entries());
}

function directivesOf(csp: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of csp.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [name, ...values] = trimmed.split(/\s+/);
    map.set(name!, values.join(" "));
  }
  return map;
}

describe("static security headers", () => {
  const byKey = new Map(SECURITY_HEADERS.map((h) => [h.key, h.value]));

  it("sends nosniff, a referrer policy and a framing policy", () => {
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
  });

  it("denies powerful features but keeps the camera for the note-capture flow", () => {
    const policy = byKey.get("Permissions-Policy")!;

    expect(policy).toContain("camera=(self)");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });

  it("keeps popups able to reach their opener, for Clerk's OAuth flow", () => {
    expect(byKey.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
  });

  it("omits HSTS from a development build", () => {
    const keys = staticSecurityHeaders(false).map((h) => h.key);

    expect(keys).not.toContain("Strict-Transport-Security");
  });

  it("sends HSTS in production, without preload", () => {
    const keys = staticSecurityHeaders(true).map((h) => h.key);

    expect(keys).toContain("Strict-Transport-Security");
    expect(HSTS_HEADER.value).toContain("includeSubDomains");
    // `preload` is a one-way door and a deliberate separate decision.
    expect(HSTS_HEADER.value).not.toContain("preload");
  });
});

describe("CSP directives we contribute", () => {
  it("locks down object, base and framing", () => {
    expect(CSP_DIRECTIVES["object-src"]).toEqual(["'none'"]);
    expect(CSP_DIRECTIVES["base-uri"]).toEqual(["'self'"]);
    expect(CSP_DIRECTIVES["frame-ancestors"]).toEqual(["'none'"]);
  });

  it("allows the image sources the app actually renders", () => {
    expect(CSP_DIRECTIVES["img-src"]).toContain("data:"); // legacy base64 rows
    expect(CSP_DIRECTIVES["img-src"]).toContain("blob:"); // camera preview
    expect(CSP_DIRECTIVES["img-src"]).toContain("https://*.blob.vercel-storage.com");
  });

  it("never contributes unsafe-inline or unsafe-eval itself", () => {
    const values = Object.values(CSP_DIRECTIVES).flat();

    expect(values).not.toContain("'unsafe-inline'");
    expect(values).not.toContain("'unsafe-eval'");
  });
});

describe("the policy the browser actually receives", () => {
  it("attaches a strict, nonce-based policy to a public page", async () => {
    const csp = (await call("/")).headers.get("content-security-policy");

    expect(csp).toBeTruthy();
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  });

  it("merges our restrictions with Clerk's defaults instead of replacing them", async () => {
    const csp = (await call("/")).headers.get("content-security-policy")!;
    const directives = directivesOf(csp);

    expect(directives.get("object-src")).toBe("'none'");
    expect(directives.get("base-uri")).toBe("'self'");
    expect(directives.get("frame-ancestors")).toBe("'none'");
    // Clerk's own defaults must survive the merge, or sign-in breaks.
    expect(directives.get("frame-src")).toContain("https://challenges.cloudflare.com");
    expect(directives.get("style-src")).toContain("'unsafe-inline'");
    expect(directives.get("default-src")).toBe("'self'");
  });

  it("keeps the Turnstile frame and our own iframe host reachable", async () => {
    const directives = directivesOf((await call("/")).headers.get("content-security-policy")!);

    expect(directives.get("frame-src")).toContain("'self'");
    expect(directives.get("frame-src")).toContain("https:");
  });

  it("publishes the report endpoint as an absolute URL", async () => {
    const response = await call("/");

    expect(response.headers.get("reporting-endpoints")).toBe(
      `csp-endpoint="${ORIGIN}${CSP_REPORT_PATH}"`,
    );
    expect(response.headers.get("content-security-policy")).toContain(
      `report-uri ${ORIGIN}${CSP_REPORT_PATH}`,
    );
    expect(response.headers.get("content-security-policy")).toContain("report-to csp-endpoint");
  });

  it("hands the same nonce to the request so server components can read it", async () => {
    const response = await call("/");
    const headers = headerMap(response);
    const nonce = headers["x-middleware-request-x-nonce"];

    expect(nonce).toBeTruthy();
    expect(headers["x-middleware-override-headers"]).toContain("x-nonce");
    expect(response.headers.get("content-security-policy")).toContain(`'nonce-${nonce}'`);
  });

  it("mints a different nonce for every request", async () => {
    const first = (await call("/")).headers.get("content-security-policy");
    const second = (await call("/")).headers.get("content-security-policy");

    expect(first).not.toBe(second);
  });

  it("uses the forwarded host, not the internal one, in the report URL", async () => {
    const response = await call("/", {
      headers: { host: "internal:3000", "x-forwarded-host": HOST, "x-forwarded-proto": "https" },
    });

    expect(response.headers.get("reporting-endpoints")).toBe(
      `csp-endpoint="${ORIGIN}${CSP_REPORT_PATH}"`,
    );
  });
});

describe("CSRF is enforced before anything else", () => {
  it("refuses a cross-site mutation to a public route", async () => {
    const response = await call(CSP_REPORT_PATH, {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/csp-report" },
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses a cross-site mutation before the session check can answer 401", async () => {
    // 403 rather than 401 proves the guard runs ahead of authentication: an
    // unauthenticated cross-site request never even reaches the auth branch.
    const response = await call("/api/uploads", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });

    expect(response.status).toBe(403);
  });

  it("lets a same-origin mutation through to the auth layer", async () => {
    const response = await call("/api/uploads", {
      method: "POST",
      headers: { origin: ORIGIN },
    });

    expect(response.status).toBe(401);
  });

  it("leaves read-only requests alone", async () => {
    const response = await call("/", { headers: { origin: "https://evil.example" } });

    expect(response.status).toBe(200);
  });
});
