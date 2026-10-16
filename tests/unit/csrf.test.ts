// tests/unit/csrf.test.ts
// The CSRF guard is the one check that runs before *everything* else in the
// proxy, including the session lookup. A false negative lets an attacker ride a
// logged-in student's cookie; a false positive locks the whole school out of
// every form. Both directions are pinned here, and the module is deliberately
// free of Clerk imports so this can be a plain unit test.
import { describe, expect, it } from "vitest";
import {
  isCrossSiteRequest,
  requestHost,
  requestOrigin,
  type RequestLike,
} from "@/lib/csrf";

const HOST = "learn.nawasena.site";

function req(init: {
  method?: string;
  headers?: Record<string, string>;
  protocol?: string;
  host?: string;
} = {}): RequestLike {
  return {
    method: init.method ?? "POST",
    headers: new Headers(init.headers ?? {}),
    nextUrl: { protocol: init.protocol ?? "https:", host: init.host ?? HOST },
  };
}

describe("requestHost / requestOrigin", () => {
  it("prefers the forwarded host over the Host header and nextUrl", () => {
    const r = req({
      headers: { host: "internal:3000", "x-forwarded-host": HOST },
      host: "localhost:3000",
    });

    expect(requestHost(r)).toBe(HOST);
  });

  it("takes only the first hop of a forwarded chain", () => {
    const r = req({
      headers: { "x-forwarded-host": `${HOST}, proxy.internal`, "x-forwarded-proto": "https, http" },
    });

    expect(requestHost(r)).toBe(HOST);
    expect(requestOrigin(r)).toBe(`https://${HOST}`);
  });

  it("falls back to nextUrl when no host header is present", () => {
    expect(requestHost(req())).toBe(HOST);
    expect(requestOrigin(req())).toBe(`https://${HOST}`);
  });

  it("normalises the protocol that nextUrl reports with a colon", () => {
    expect(requestOrigin(req({ protocol: "http:", host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
  });
});

describe("isCrossSiteRequest — same-origin traffic is never blocked", () => {
  it("allows a same-origin POST", () => {
    expect(isCrossSiteRequest(req({ headers: { origin: `https://${HOST}` } }))).toBe(false);
  });

  it("allows a same-origin POST that arrives behind a TLS-terminating proxy", () => {
    // The request reaches us as plain http; the browser saw https. Comparing
    // full origins here would reject every production mutation.
    const r = req({
      protocol: "http:",
      host: "internal:3000",
      headers: {
        origin: `https://${HOST}`,
        "x-forwarded-host": HOST,
        "x-forwarded-proto": "http",
      },
    });

    expect(isCrossSiteRequest(r)).toBe(false);
  });

  it("ignores read-only methods even when the origin is foreign", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(
        isCrossSiteRequest(req({ method, headers: { origin: "https://evil.example" } })),
      ).toBe(false);
    }
  });

  it("allows a request with neither Origin nor Sec-Fetch-Site", () => {
    // Svix webhooks, cron and curl look like this. Their authenticity is proven
    // elsewhere (signature, secret), not by an origin the browser would have set.
    expect(isCrossSiteRequest(req())).toBe(false);
  });

  it("allows Sec-Fetch-Site: same-origin", () => {
    expect(isCrossSiteRequest(req({ headers: { "sec-fetch-site": "same-origin" } }))).toBe(false);
  });

  it("allows Sec-Fetch-Site: none (user-initiated navigation)", () => {
    expect(isCrossSiteRequest(req({ headers: { "sec-fetch-site": "none" } }))).toBe(false);
  });
});

describe("isCrossSiteRequest — forgery is refused", () => {
  it("refuses a POST from another site", () => {
    expect(
      isCrossSiteRequest(req({ headers: { origin: "https://evil.example" } })),
    ).toBe(true);
  });

  it("refuses a look-alike host", () => {
    expect(
      isCrossSiteRequest(req({ headers: { origin: `https://${HOST}.evil.example` } })),
    ).toBe(true);
  });

  it("refuses a sibling subdomain", () => {
    expect(
      isCrossSiteRequest(req({ headers: { origin: "https://evil.nawasena.site" } })),
    ).toBe(true);
  });

  it("refuses a different port on the same host", () => {
    expect(
      isCrossSiteRequest(req({ headers: { origin: `https://${HOST}:8443` } })),
    ).toBe(true);
  });

  it("refuses Origin: null", () => {
    // Sandboxed iframe / opaque origin. It is not a URL, so it cannot be ours.
    expect(isCrossSiteRequest(req({ headers: { origin: "null" } }))).toBe(true);
  });

  it("refuses an unparseable Origin rather than falling through", () => {
    expect(isCrossSiteRequest(req({ headers: { origin: "not a url" } }))).toBe(true);
  });

  it("refuses Sec-Fetch-Site: cross-site", () => {
    expect(isCrossSiteRequest(req({ headers: { "sec-fetch-site": "cross-site" } }))).toBe(true);
  });

  it("refuses Sec-Fetch-Site: same-site", () => {
    // A subdomain is same-site but a different origin, so it is not a boundary
    // we accept.
    expect(isCrossSiteRequest(req({ headers: { "sec-fetch-site": "same-site" } }))).toBe(true);
  });

  it("covers every state-changing method", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(
        isCrossSiteRequest(req({ method, headers: { origin: "https://evil.example" } })),
      ).toBe(true);
    }
  });

  it("treats a lower-case method the same as an upper-case one", () => {
    expect(
      isCrossSiteRequest(req({ method: "post", headers: { origin: "https://evil.example" } })),
    ).toBe(true);
  });
});
