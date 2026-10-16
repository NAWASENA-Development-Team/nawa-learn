import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, rateLimit, resetInMemoryCounters } from "@/lib/rateLimit";

function apiRequest(ip = "203.0.113.7", path = "/api/quiz/daily-claim"): Request {
  return new Request(`https://nawa.test${path}`, {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

/** Silence the logger and let a test inspect what it wrote. */
function captureWarnings(): string[] {
  const lines: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    lines.push(String(args[0]));
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  return lines;
}

beforeEach(() => {
  // The in-memory counters are module state; without this every test would
  // inherit the previous one's counts.
  resetInMemoryCounters();
  // Keep the suite output readable; tests that assert on logs capture their own.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for and trims it", () => {
    const request = new Request("https://nawa.test/api", {
      headers: { "x-forwarded-for": " 198.51.100.4 , 10.0.0.1" },
    });

    expect(clientIp(request)).toBe("198.51.100.4");
  });

  it("falls back to x-real-ip", () => {
    const request = new Request("https://nawa.test/api", {
      headers: { "x-real-ip": "198.51.100.9" },
    });

    expect(clientIp(request)).toBe("198.51.100.9");
  });

  it("returns a constant when the platform supplied nothing", () => {
    expect(clientIp(new Request("https://nawa.test/api"))).toBe("unknown");
  });
});

describe("rateLimit (in-memory backend)", () => {
  it("allows up to the user limit and refuses the next request", async () => {
    // policy: quiz/daily-claim is 3 per minute per user.
    expect((await rateLimit(apiRequest(), "quiz/daily-claim", "user-1")).ok).toBe(true);
    expect((await rateLimit(apiRequest(), "quiz/daily-claim", "user-1")).ok).toBe(true);
    expect((await rateLimit(apiRequest(), "quiz/daily-claim", "user-1")).ok).toBe(true);

    const blocked = await rateLimit(apiRequest(), "quiz/daily-claim", "user-1");

    expect(blocked.ok).toBe(false);
    if (blocked.ok) throw new Error("unreachable");
    expect(blocked.response.status).toBe(429);
    expect(Number(blocked.response.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect(blocked.response.headers.get("cache-control")).toBe("no-store");
    await expect(blocked.response.json()).resolves.toMatchObject({ error: "Too many requests" });
  });

  it("counts each user separately", async () => {
    for (let i = 0; i < 3; i += 1) {
      await rateLimit(apiRequest(), "quiz/daily-claim", "user-1");
    }
    expect((await rateLimit(apiRequest(), "quiz/daily-claim", "user-1")).ok).toBe(false);

    // A different account from the same address is a different bucket.
    expect((await rateLimit(apiRequest(), "quiz/daily-claim", "user-2")).ok).toBe(true);
  });

  it("applies the IP bucket when there is no user identity", async () => {
    // quiz/daily-claim is 10 per minute per IP.
    for (let i = 0; i < 10; i += 1) {
      expect((await rateLimit(apiRequest("198.51.100.1"), "quiz/daily-claim", null)).ok).toBe(true);
    }

    expect((await rateLimit(apiRequest("198.51.100.1"), "quiz/daily-claim", null)).ok).toBe(false);
    // A different address is untouched.
    expect((await rateLimit(apiRequest("198.51.100.2"), "quiz/daily-claim", null)).ok).toBe(true);
  });

  it("must also enforce the IP bucket for a signed-in user", async () => {
    // Every call reuses user-1, whose per-user budget is only 3, so use the
    // wider per-user policy and prove the IP ceiling exists by exceeding it with
    // distinct users from one address.
    // quiz/daily-claim perIp = 10.
    for (let i = 0; i < 10; i += 1) {
      await rateLimit(apiRequest("198.51.100.3"), "quiz/daily-claim", `user-${i}`);
    }

    const blocked = await rateLimit(apiRequest("198.51.100.3"), "quiz/daily-claim", "user-fresh");
    expect(blocked.ok).toBe(false);
  });

  it("reopens the window once it has elapsed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    for (let i = 0; i < 3; i += 1) {
      await rateLimit(apiRequest(), "quiz/daily-claim", "user-1");
    }
    expect((await rateLimit(apiRequest(), "quiz/daily-claim", "user-1")).ok).toBe(false);

    vi.advanceTimersByTime(61_000);

    expect((await rateLimit(apiRequest(), "quiz/daily-claim", "user-1")).ok).toBe(true);
  });

  it("emits an alertable event when a limit trips", async () => {
    const lines = captureWarnings();

    for (let i = 0; i < 4; i += 1) {
      await rateLimit(apiRequest(), "quiz/daily-claim", "user-1");
    }

    const exceeded = lines.map((line) => JSON.parse(line)).find((line) => line.msg === "rate_limit_exceeded");
    expect(exceeded).toBeDefined();
    expect(exceeded).toMatchObject({ scope: "user", limit: 3, policy: "quiz/daily-claim" });
  });

  it("says once, in production, that no shared store is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const lines = captureWarnings();

    await rateLimit(apiRequest(), "quiz/daily-claim", "user-1");
    await rateLimit(apiRequest(), "quiz/daily-claim", "user-1");

    const warnings = lines
      .map((line) => JSON.parse(line))
      .filter((line) => line.msg === "rate_limit_in_memory_backend");

    // Once per process, not once per request.
    expect(warnings).toHaveLength(1);
    expect(warnings[0].detail).toContain("UPSTASH_REDIS_REST_URL");
  });

  it("does not warn about the backend outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const lines = captureWarnings();

    await rateLimit(apiRequest(), "quiz/daily-claim", "user-1");

    expect(
      lines.map((line) => JSON.parse(line)).some((line) => line.msg === "rate_limit_in_memory_backend"),
    ).toBe(false);
  });
});

describe("rateLimit (Upstash backend)", () => {
  function configureUpstash() {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example-upstash.test/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok_fake");
  }

  it("never sends a raw IP or a raw user id to the third party", async () => {
    configureUpstash();
    // A fresh Response per call: a body can only be read once.
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify([{ result: 1 }, { result: 0 }, { result: 60_000 }]), { status: 200 }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await rateLimit(apiRequest("203.0.113.99"), "quiz/daily-claim", "user-abc");

    const bodies = fetchMock.mock.calls.map((call) => String(call[1]?.body));
    expect(bodies.join(" ")).not.toContain("203.0.113.99");
    expect(bodies.join(" ")).not.toContain("user-abc");
  });

  it("reads the count from the pipeline and blocks past the limit", async () => {
    configureUpstash();
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify([{ result: 5 }, { result: 0 }, { result: 42_000 }]), { status: 200 }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await rateLimit(apiRequest(), "quiz/daily-claim", "user-1");

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    // PTTL (42s) is what the client is told to wait.
    expect(Number(outcome.response.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example-upstash.test/pipeline",
      expect.objectContaining({ method: "POST" }),
    );

    // The window is only stable because the TTL is set once (NX). Assert the
    // exact command shape and that the key is namespaced and hashed.
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual([
      ["INCR", expect.stringMatching(/^ratelimit:quiz\/daily-claim:ip:[0-9a-f]{32}$/)],
      ["EXPIRE", expect.stringMatching(/^ratelimit:quiz\/daily-claim:ip:[0-9a-f]{32}$/), 60, "NX"],
      ["PTTL", expect.stringMatching(/^ratelimit:quiz\/daily-claim:ip:[0-9a-f]{32}$/)],
    ]);
  });

  it("allows the request and shouts when the store is down", async () => {
    configureUpstash();
    const lines = captureWarnings();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("upstash unreachable")));

    const outcome = await rateLimit(apiRequest(), "quiz/daily-claim", "user-1");

    // Failing closed would turn a Redis hiccup into a platform-wide outage.
    expect(outcome.ok).toBe(true);
    const logged = lines.map((line) => JSON.parse(line)).find((line) => line.msg.includes("rate limit store unavailable"));
    expect(logged).toBeDefined();
    expect(logged.error.name).toBe("Error");
  });
});
