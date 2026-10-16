// tests/unit/validation.test.ts
// The shared body reader is the thing every route now depends on, so its
// contract — status codes, the `details` shape, and the fact that a rejection is
// never cached — is pinned here.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MAX_JSON_BODY_BYTES,
  fieldErrors,
  httpUrl,
  optionalText,
  parseJsonBody,
  readJsonBody,
  shortText,
} from "@/lib/validation";

const schema = z.object({ name: shortText(10) }).strict();

function json(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://nawa.test/api/thing", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("readJsonBody", () => {
  it("refuses a body that is not JSON with 415, uncached", async () => {
    const request = new Request("https://nawa.test/api/thing", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "hello",
    });

    const result = await readJsonBody(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(415);
    expect(result.response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects an oversized body by measurement when no content-length is sent", async () => {
    const request = new Request("https://nawa.test/api/thing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x".repeat(200) }),
    });
    // A streamed body has no content-length header, so only the measured length
    // can catch it. This is the check the header hint cannot be trusted for.
    expect(request.headers.get("content-length")).toBeNull();

    const result = await readJsonBody(request, { maxBytes: 64 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(413);
    expect(result.response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects an oversized body from the content-length hint before reading it", async () => {
    const request = json("{}", { "content-length": String(MAX_JSON_BODY_BYTES + 1) });

    const result = await readJsonBody(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(413);
  });

  it("rejects an empty body", async () => {
    const result = await readJsonBody(json("   "));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toMatchObject({ error: "Request body is empty" });
  });

  it("rejects malformed JSON with 400, not 500", async () => {
    const result = await readJsonBody(json("{ not json"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
  });

  it("returns the parsed body when everything is in order", async () => {
    const result = await readJsonBody(json('{"a":1}'));

    expect(result).toEqual({ ok: true, body: { a: 1 } });
  });
});

describe("parseJsonBody", () => {
  it("returns typed data on success", async () => {
    const result = await parseJsonBody(json('{"name":"Budi"}'), schema);

    expect(result).toEqual({ ok: true, data: { name: "Budi" } });
  });

  it("flattens a schema failure into dotted paths", async () => {
    const nested = z.object({ options: z.object({ A: shortText(5) }) });

    const result = await parseJsonBody(json('{"options":{"A":"far too long"}}'), nested);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    await expect(result.response.json()).resolves.toEqual({
      error: "Validation failed",
      details: [{ path: "options.A", message: expect.any(String) }],
    });
  });

  it("uses `(root)` for a whole-body issue", async () => {
    const refined = z.object({ a: z.string() }).refine(() => false, { message: "not allowed" });

    const result = await parseJsonBody(json('{"a":"x"}'), refined);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    await expect(result.response.json()).resolves.toEqual({
      error: "Validation failed",
      details: [{ path: "(root)", message: "not allowed" }],
    });
  });

  it("refuses an unknown key in a strict schema", async () => {
    const result = await parseJsonBody(json('{"name":"Budi","role":"admin"}'), schema);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const body = (await result.response.json()) as { details: { path: string }[] };
    expect(body.details.map((d) => d.path)).toContain("role");
  });

  it("carries the caller's message", async () => {
    const result = await parseJsonBody(json("{}"), schema, { message: "Bad module" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    await expect(result.response.json()).resolves.toMatchObject({ error: "Bad module" });
  });
});

describe("fieldErrors", () => {
  it("stringifies numeric path segments", () => {
    const parsed = z.array(z.string().min(3)).safeParse(["good", "x"]);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(fieldErrors(parsed.error)).toEqual([{ path: "1", message: expect.any(String) }]);
  });

  it("names each unknown key of a strict object", () => {
    const strict = z.object({ name: z.string() }).strict();
    const parsed = strict.safeParse({ name: "Budi", role: "admin", points: 5 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(fieldErrors(parsed.error).map((issue) => issue.path).sort()).toEqual(["points", "role"]);
  });
});

describe("reusable field schemas", () => {
  it("shortText trims and enforces the bounds", () => {
    expect(shortText(10).parse("  Budi  ")).toBe("Budi");
    expect(shortText(10).safeParse("   ").success).toBe(false);
    expect(shortText(10).safeParse("x".repeat(11)).success).toBe(false);
  });

  it("optionalText lets an untouched form field through", () => {
    expect(optionalText(10).parse(undefined)).toBeUndefined();
    expect(optionalText(10).parse("")).toBe("");
  });

  it("httpUrl accepts http(s) and refuses data:", () => {
    expect(httpUrl().safeParse("https://drive.google.com/file/d/x/view").success).toBe(true);
    expect(httpUrl().safeParse("http://example.test/a.pdf").success).toBe(true);
    // This is the one that matters: base64 in a URL column is the problem.
    expect(httpUrl().safeParse("data:application/pdf;base64,JVBERi0=").success).toBe(false);
    expect(httpUrl().safeParse("javascript:alert(1)").success).toBe(false);
  });
});
