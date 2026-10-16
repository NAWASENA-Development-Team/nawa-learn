// tests/integration/csp-report.test.ts
// The violation sink is public and anonymous, so the interesting properties are
// that it stays bounded, that it never trusts its input, and that it turns both
// on-the-wire formats into one predictable log line. Nothing here touches the
// database — the route deliberately stores nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/csp-report/route";
import { RATE_LIMITS } from "@/lib/rateLimit";

const ENDPOINT = "https://nawa.test/api/csp-report";

/** Everything the route logs, whichever stream the logger chose. */
function captureLogs(): string[] {
  const lines: string[] = [];
  const push = (args: unknown[]) => {
    lines.push(String(args[0]));
  };
  vi.spyOn(console, "log").mockImplementation((...args) => push(args));
  vi.spyOn(console, "error").mockImplementation((...args) => push(args));
  vi.spyOn(console, "warn").mockImplementation((...args) => push(args));
  return lines;
}

function records(lines: string[]): Array<Record<string, unknown>> {
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

function violations(lines: string[]): Array<Record<string, unknown>> {
  return records(lines).filter((r) => r.msg === "csp_violation");
}

function post(body: string, contentType = "application/csp-report", headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: { "content-type": contentType, "x-forwarded-for": "203.0.113.7", ...headers },
    body,
  });
}

/** The legacy `report-uri` shape, which is what `report-uri` still sends. */
function legacyReport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    "csp-report": {
      "document-uri": "https://nawa.test/modules",
      "effective-directive": "script-src",
      "blocked-uri": "https://evil.example/tracker.js",
      "source-file": "https://nawa.test/modules",
      "line-number": 12,
      disposition: "enforce",
      "original-policy": "default-src 'self'; script-src 'self'",
      ...overrides,
    },
  });
}

let lines: string[];

beforeEach(() => {
  lines = captureLogs();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/csp-report — the legacy report-uri format", () => {
  it("accepts the report and answers 204 with nothing cached", async () => {
    const response = await POST(post(legacyReport()));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("logs the effective directive, not the whole violated policy section", async () => {
    await POST(post(legacyReport()));

    const [violation] = violations(lines);
    expect(violation?.directive).toBe("script-src");
    expect(violation?.blockedUri).toBe("https://evil.example/tracker.js");
    expect(violation?.documentUri).toBe("https://nawa.test/modules");
    expect(violation?.lineNumber).toBe(12);
    expect(violation?.disposition).toBe("enforce");
  });

  it("never logs the original policy, which is the entire header", async () => {
    await POST(post(legacyReport()));

    expect(lines.join("\n")).not.toContain("original-policy");
    expect(lines.join("\n")).not.toContain("default-src");
  });

  it("falls back to violated-directive when effective-directive is absent", async () => {
    const body = legacyReport({
      "effective-directive": undefined,
      "violated-directive": "img-src 'self'",
    });

    await POST(post(body));

    expect(violations(lines)[0]?.directive).toBe("img-src 'self'");
  });

  it("keeps the script sample, which the browser already caps at 40 characters", async () => {
    await POST(post(legacyReport({ "script-sample": "alert(1)" })));

    expect(violations(lines)[0]?.sample).toBe("alert(1)");
  });
});

describe("POST /api/csp-report — the Reporting API format", () => {
  const reportingApiBody = JSON.stringify([
    {
      type: "csp-violation",
      body: {
        documentURL: "https://nawa.test/leaderboard",
        effectiveDirective: "img-src",
        blockedURL: "https://tracker.example/pixel.gif",
        sourceFile: "https://nawa.test/leaderboard",
        lineNumber: 3,
        disposition: "enforce",
      },
    },
  ]);

  it("normalises a batched report into the same log shape", async () => {
    const response = await POST(post(reportingApiBody, "application/reports+json"));

    expect(response.status).toBe(204);
    const [violation] = violations(lines);
    expect(violation?.directive).toBe("img-src");
    expect(violation?.blockedUri).toBe("https://tracker.example/pixel.gif");
    expect(violation?.lineNumber).toBe(3);
  });

  it("ignores report entries that are not csp-violation", async () => {
    const body = JSON.stringify([
      { type: "deprecation", body: { message: "something else" } },
      { type: "csp-violation", body: { effectiveDirective: "style-src" } },
    ]);

    await POST(post(body, "application/reports+json"));

    const logged = violations(lines);
    expect(logged).toHaveLength(1);
    expect(logged[0]?.directive).toBe("style-src");
  });

  it("accepts a Reporting API body that arrives as plain application/json", async () => {
    const response = await POST(post(reportingApiBody, "application/json"));

    expect(response.status).toBe(204);
    expect(violations(lines)).toHaveLength(1);
  });

  it("tolerates a content-type carrying a charset", async () => {
    const response = await POST(post(legacyReport(), "application/csp-report; charset=utf-8"));

    expect(response.status).toBe(204);
  });
});

describe("POST /api/csp-report — input is not trusted", () => {
  it("refuses a non-report media type with 415", async () => {
    const response = await POST(post("{}", "text/plain"));

    expect(response.status).toBe(415);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses malformed JSON with 400", async () => {
    const response = await POST(post("{ not json"));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses a body over the ceiling, from the content-length hint", async () => {
    const response = await POST(post("{}", "application/csp-report", { "content-length": "99999" }));

    expect(response.status).toBe(413);
  });

  it("refuses an oversized body that arrives without a content-length", async () => {
    const huge = JSON.stringify({ "csp-report": { "blocked-uri": "x".repeat(17 * 1024) } });
    const request = new Request(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/csp-report", "x-forwarded-for": "203.0.113.7" },
      body: huge,
    });
    expect(request.headers.get("content-length")).toBeNull();

    const response = await POST(request);

    expect(response.status).toBe(413);
  });

  it("answers 204 but logs nothing for a body that is valid JSON of the wrong shape", async () => {
    const response = await POST(post(JSON.stringify({ hello: "world" })));

    expect(response.status).toBe(204);
    expect(violations(lines)).toHaveLength(0);
  });

  it("truncates a field long enough to be a data: URI", async () => {
    await POST(post(legacyReport({ "blocked-uri": `data:text/plain;base64,${"A".repeat(5000)}` })));

    const blocked = violations(lines)[0]?.blockedUri as string;
    expect(blocked.length).toBeLessThanOrEqual(201);
    expect(blocked.endsWith("…")).toBe(true);
  });

  it("caps how many violations one request can write", async () => {
    const many = JSON.stringify(
      Array.from({ length: 40 }, (_, i) => ({
        type: "csp-violation",
        body: { effectiveDirective: "img-src", blockedURL: `https://t.example/${i}` },
      })),
    );

    await POST(post(many, "application/reports+json"));

    expect(violations(lines)).toHaveLength(10);
    const truncated = records(lines).find((r) => r.msg === "csp_violation_truncated");
    expect(truncated?.reported).toBe(40);
    expect(truncated?.logged).toBe(10);
  });

  it("never echoes a raw IP address into the log line", async () => {
    await POST(post(legacyReport()));

    expect(lines.join("\n")).not.toContain("203.0.113.7");
  });
});

describe("POST /api/csp-report — abuse and method handling", () => {
  it("has a rate-limit policy that is generous enough for one broken page", () => {
    expect(RATE_LIMITS["csp/report"].perIp.limit).toBeGreaterThanOrEqual(60);
  });

  it("answers 429 once the anonymous IP budget is spent", async () => {
    const limit = RATE_LIMITS["csp/report"].perIp.limit;

    for (let i = 0; i < limit; i += 1) {
      const response = await POST(post(legacyReport()));
      expect(response.status).toBe(204);
    }

    const blocked = await POST(post(legacyReport()));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(blocked.headers.get("cache-control")).toBe("no-store");
  });

  it("refuses a GET with 405 and names the allowed method", async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
