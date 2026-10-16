import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, newRequestId, requestLogger } from "@/lib/logger";

// Capture everything the logger writes. warn/error go to stderr, the rest to
// stdout, so both streams are spied on.
function captureLines(): string[] {
  const lines: string[] = [];
  const push = (args: unknown[]) => {
    lines.push(String(args[0]));
  };
  vi.spyOn(console, "log").mockImplementation((...args) => push(args));
  vi.spyOn(console, "error").mockImplementation((...args) => push(args));
  return lines;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("structured logger", () => {
  it("writes exactly one JSON object per call, with level, time and message", () => {
    const lines = captureLines();

    logger.info("module approved", { moduleId: "m1" });

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]);
    expect(record.level).toBe("info");
    expect(record.msg).toBe("module approved");
    expect(record.moduleId).toBe("m1");
    expect(Number.isNaN(Date.parse(record.time))).toBe(false);
  });

  it("sends warnings and errors to stderr so platforms can split them", () => {
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.warn("careful");
    logger.error("broken");
    logger.info("fine");

    expect(stderr).toHaveBeenCalledTimes(2);
    expect(stdout).toHaveBeenCalledTimes(1);
  });

  it("can be silenced below the configured level", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    const lines = captureLines();

    logger.debug("noise");
    logger.info("noise");
    logger.warn("kept");
    logger.error("kept");

    expect(lines).toHaveLength(2);
  });
});

// The whole point of the logger existing: a careless caller must not be able to
// put a student's personal data into the logs.
describe("PII redaction", () => {
  it("redacts emails, names, clerk ids and profile fields", () => {
    const lines = captureLines();

    logger.info("user loaded", {
      user: {
        email: "budi@example.test",
        name: "Budi Santoso",
        clerkId: "user_2abc",
        bio: "suka matematika",
        motto: "belajar terus",
        photoUrl: "https://img.example.test/p.png",
      },
    });

    const raw = lines[0];
    expect(raw).not.toContain("budi@example.test");
    expect(raw).not.toContain("Budi Santoso");
    expect(raw).not.toContain("user_2abc");
    expect(raw).not.toContain("suka matematika");

    const record = JSON.parse(raw);
    expect(record.user.email).toBe("[redacted]");
    expect(record.user.name).toBe("[redacted]");
    expect(record.user.clerkId).toBe("[redacted]");
    expect(record.user.bio).toBe("[redacted]");
    expect(record.user.photoUrl).toBe("[redacted]");
  });

  it("redacts credentials and request headers", () => {
    const lines = captureLines();

    logger.error("upstream call failed", {
      authorization: "Bearer sk_live_supersecret",
      cookie: "session=abc123",
      token: "t-123",
    });

    const raw = lines[0];
    expect(raw).not.toContain("supersecret");
    expect(raw).not.toContain("session=abc123");
    const record = JSON.parse(raw);
    expect(record.authorization).toBe("[redacted]");
    expect(record.cookie).toBe("[redacted]");
    expect(record.token).toBe("[redacted]");
  });

  it("redacts inside arrays and nested objects", () => {
    const lines = captureLines();

    logger.info("submissions", {
      items: [{ email: "a@example.test" }, { email: "b@example.test" }],
      meta: { author: { name: "Siti" } },
    });

    const raw = lines[0];
    expect(raw).not.toContain("a@example.test");
    expect(raw).not.toContain("b@example.test");
    expect(raw).not.toContain("Siti");
    const record = JSON.parse(raw);
    expect(record.items[0].email).toBe("[redacted]");
    expect(record.meta.author.name).toBe("[redacted]");
  });

  it("does not over-redact ordinary keys that merely look sensitive", () => {
    // Regression guard: a bare `ip` pattern used to redact `description`, and a
    // `\bname\b` pattern silently failed to catch `userName`.
    const lines = captureLines();

    logger.info("question loaded", {
      description: "perkalian adalah penjumlahan berulang",
      userName: "Budi",
      clipboardSize: 3,
    });

    const record = JSON.parse(lines[0]);
    expect(record.description).toBe("perkalian adalah penjumlahan berulang");
    expect(record.clipboardSize).toBe(3);
    expect(record.userName).toBe("[redacted]");
  });

  it("keeps the useful parts of an Error while losing nothing to redaction", () => {
    const lines = captureLines();
    const boom = new Error("unique constraint violated");

    logger.error("insert failed", { error: boom });

    const record = JSON.parse(lines[0]);
    expect(record.error.name).toBe("Error");
    expect(record.error.message).toBe("unique constraint violated");
    expect(record.error.stack).toContain("Error");
  });

  it("cannot be tricked into forging the level or the message", () => {
    const lines = captureLines();

    logger.info("the real message", { level: "error", msg: "a fake message", time: 0 });

    const record = JSON.parse(lines[0]);
    expect(record.level).toBe("info");
    expect(record.msg).toBe("the real message");
    expect(typeof record.time).toBe("string");
  });
});

describe("request correlation", () => {
  it("adds the requestId and context supplied by child()", () => {
    const lines = captureLines();

    logger.child({ requestId: "req-123" }).info("inside a request");

    expect(JSON.parse(lines[0]).requestId).toBe("req-123");
  });

  it("honours an x-request-id supplied upstream", () => {
    const lines = captureLines();
    const request = new Request("https://example.test/api/quiz/submit", {
      headers: { "x-request-id": "from-the-cdn" },
    });

    requestLogger(request, { route: "quiz/submit" }).info("submitted");

    const record = JSON.parse(lines[0]);
    expect(record.requestId).toBe("from-the-cdn");
    expect(record.route).toBe("quiz/submit");
  });

  it("mints its own id when no upstream supplied one", () => {
    const lines = captureLines();

    requestLogger(new Request("https://example.test/api/health")).info("checked");

    expect(JSON.parse(lines[0]).requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("generates distinct ids", () => {
    expect(newRequestId()).not.toBe(newRequestId());
  });
});
