// tests/unit/storage.test.ts
// Two things are worth pinning here:
//
//   1. `checkUpload` is the only thing standing between a browser and our bucket.
//      It must decide on the bytes, not on the name or the declared type.
//   2. The hand-rolled Vercel Blob client must speak the exact REST contract the
//      SDK does, so a mocked `fetch` asserts the URL and every header.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCEPTED_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  StorageError,
  buildPathname,
  checkUpload,
  deleteObject,
  isOwnStorageUrl,
  putObject,
  storageConfigured,
} from "@/lib/storage";

const TOKEN = "vercel_blob_rw_store123_secret";

const png = (extra = 0) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(extra).fill(0)]);
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const webp = () =>
  new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const pdf = (extra = 0) =>
  new Uint8Array([...Buffer.from("%PDF-1.4"), ...new Array(extra).fill(0)]);
const text = () => new Uint8Array(Buffer.from("just some plain text, definitely not an image"));

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("checkUpload", () => {
  it("accepts each supported type for its purpose", () => {
    expect(checkUpload(png(), { purpose: "avatar" })).toEqual({
      ok: true,
      type: { mime: "image/png", ext: "png", kind: "image" },
    });
    expect(checkUpload(jpeg(), { purpose: "avatar" })).toMatchObject({
      ok: true,
      type: { mime: "image/jpeg", ext: "jpg" },
    });
    expect(checkUpload(webp(), { purpose: "module" })).toMatchObject({
      ok: true,
      type: { mime: "image/webp", ext: "webp" },
    });
    expect(checkUpload(pdf(), { purpose: "module" })).toEqual({
      ok: true,
      type: { mime: "application/pdf", ext: "pdf", kind: "document" },
    });
  });

  it("decides on the bytes, so a lying extension or content-type changes nothing", () => {
    // `file.name` is never consulted at all; only the declared MIME is, and only
    // to detect a disagreement.
    const result = checkUpload(pdf(), { declaredType: "image/png", purpose: "module" });

    expect(result).toEqual({
      ok: false,
      reason: {
        code: "type_mismatch",
        message: expect.stringContaining("declared as image/png"),
      },
    });
  });

  it("accepts the generic content-type a browser sends when it does not know", () => {
    expect(checkUpload(png(), { declaredType: "application/octet-stream", purpose: "avatar" })).toMatchObject({
      ok: true,
    });
    expect(checkUpload(png(), { declaredType: null, purpose: "avatar" })).toMatchObject({ ok: true });
  });

  it("refuses a type that is not on the list at all", () => {
    // GIF is a real image format we simply do not accept; SVG is deliberately
    // absent because it executes script when served inline.
    const gif = new Uint8Array(Buffer.from("GIF89a"));
    expect(checkUpload(gif, { purpose: "avatar" })).toMatchObject({
      ok: false,
      reason: { code: "unsupported_type" },
    });
    expect(checkUpload(text(), { purpose: "module" })).toMatchObject({
      ok: false,
      reason: { code: "unsupported_type" },
    });
    expect(checkUpload(new Uint8Array(Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"/>")), { purpose: "module" })).toMatchObject({
      ok: false,
      reason: { code: "unsupported_type" },
    });
  });

  it("refuses an empty file", () => {
    expect(checkUpload(new Uint8Array(0), { purpose: "module" })).toEqual({
      ok: false,
      reason: { code: "unsupported_type", message: "File is empty" },
    });
  });

  it("keeps a PDF out of the avatar slot", () => {
    expect(checkUpload(pdf(), { purpose: "avatar" })).toEqual({
      ok: false,
      reason: { code: "not_allowed_for_purpose", message: expect.stringContaining("avatar") },
    });
  });

  it("enforces the per-type size ceiling", () => {
    // Exactly at the ceiling: allowed.
    expect(checkUpload(png(MAX_IMAGE_BYTES - 8), { purpose: "avatar" })).toMatchObject({ ok: true });
    // One byte over: refused.
    expect(checkUpload(png(MAX_IMAGE_BYTES - 8 + 1), { purpose: "avatar" })).toMatchObject({
      ok: false,
      reason: { code: "too_large" },
    });
  });

  it("sizes the two ceilings and the overall body limit consistently", () => {
    expect(MAX_DOCUMENT_BYTES).toBeGreaterThan(MAX_IMAGE_BYTES);
    expect(MAX_UPLOAD_BYTES).toBe(MAX_DOCUMENT_BYTES);
    expect(ACCEPTED_MIME_TYPES).toContain("application/pdf");
  });
});

describe("isOwnStorageUrl", () => {
  it("accepts only https URLs in a blob store", () => {
    expect(isOwnStorageUrl("https://abc123.public.blob.vercel-storage.com/uploads/u/1.pdf")).toBe(true);
    expect(isOwnStorageUrl("https://abc123.blob.vercel-storage.com/uploads/u/1.pdf")).toBe(true);
  });

  it("refuses anything that could be used as a third-party image host", () => {
    expect(isOwnStorageUrl("https://evil.test/tracker.gif")).toBe(false);
    expect(isOwnStorageUrl("https://drive.google.com/file/d/x/view")).toBe(false);
    // Plain http, a data URL, and the classic suffix trick.
    expect(isOwnStorageUrl("http://abc.public.blob.vercel-storage.com/x.png")).toBe(false);
    expect(isOwnStorageUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isOwnStorageUrl("https://blob.vercel-storage.com.evil.test/x.png")).toBe(false);
    expect(isOwnStorageUrl("not a url")).toBe(false);
  });
});

describe("buildPathname", () => {
  it("namespaces by user and ends in a uuid plus the sniffed extension", () => {
    const pathname = buildPathname("user-1", "pdf");

    expect(pathname).toMatch(/^uploads\/user-1\/[0-9a-f-]{36}\.pdf$/);
    expect(buildPathname("user-1", "pdf")).not.toBe(pathname);
  });
});

describe("storageConfigured", () => {
  it("is false until the token exists", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    expect(storageConfigured()).toBe(false);

    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    expect(storageConfigured()).toBe(true);
  });
});

describe("putObject", () => {
  it("PUTs to the pinned endpoint with the headers the SDK sends", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://s.public.blob.vercel-storage.com/a.pdf", pathname: "a.pdf" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const stored = await putObject({ pathname: "uploads/u1/a.pdf", bytes: pdf(), contentType: "application/pdf" });

    expect(stored).toEqual({
      url: "https://s.public.blob.vercel-storage.com/a.pdf",
      pathname: "a.pdf",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://vercel.com/api/blob/?pathname=uploads%2Fu1%2Fa.pdf");
    expect(init.method).toBe("PUT");
    const headers = init.headers as Record<string, string>;
    expect(headers).toMatchObject({
      authorization: `Bearer ${TOKEN}`,
      "x-api-version": "13",
      // The store id is the fourth underscore-separated segment of the token.
      "x-vercel-blob-store-id": "store123",
      "x-vercel-blob-access": "public",
      "x-content-type": "application/pdf",
      // Immutable objects: never overwrite, never rename.
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "0",
    });
    expect(Number(headers["x-cache-control-max-age"])).toBeGreaterThan(0);
  });

  it("honours an API URL override", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    vi.stubEnv("VERCEL_BLOB_API_URL", "https://blob-proxy.internal/api/blob/");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://x/y.pdf" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await putObject({ pathname: "p.pdf", bytes: pdf(), contentType: "application/pdf" });

    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      "https://blob-proxy.internal/api/blob/?pathname=p.pdf",
    );
  });

  it("throws a typed error when the store refuses", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 403 })));

    await expect(putObject({ pathname: "p.pdf", bytes: pdf(), contentType: "application/pdf" })).rejects.toThrow(
      StorageError,
    );
  });

  it("throws when the store answers 200 without a url", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    await expect(putObject({ pathname: "p.pdf", bytes: pdf(), contentType: "application/pdf" })).rejects.toThrow(
      /no url/,
    );
  });

  it("refuses to guess a store id from a malformed token", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "not-a-blob-token");
    vi.stubGlobal("fetch", vi.fn());

    await expect(putObject({ pathname: "p.pdf", bytes: pdf(), contentType: "application/pdf" })).rejects.toThrow(
      /malformed/,
    );
  });
});

describe("deleteObject", () => {
  it("posts the url to /delete", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const url = "https://s.public.blob.vercel-storage.com/uploads/u1/old.png";
    await deleteObject(url);

    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe("https://vercel.com/api/blob/delete");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ urls: [url] });
  });

  it("does nothing for a URL that is not ours", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await deleteObject("https://evil.test/tracker.gif");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing when storage is not configured", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await deleteObject("https://s.public.blob.vercel-storage.com/uploads/u1/old.png");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
