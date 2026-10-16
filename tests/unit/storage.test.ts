// tests/unit/storage.test.ts
// Two things are worth pinning here:
//
//   1. `checkUpload` is the only thing standing between a browser and our bucket.
//      It must decide on the bytes, not on the name or the declared type.
//   2. The transfer is the official `@vercel/blob` SDK, so the seam under test is
//      the call *we* make into it: the options, the deadline, and the typed error
//      that comes back out. How the SDK turns those options into headers is the
//      SDK's contract, not ours — mocking `undici` to assert on them would pin a
//      dependency's internals and break on its next release.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { putMock, delMock } = vi.hoisted(() => ({ putMock: vi.fn(), delMock: vi.fn() }));

vi.mock("@vercel/blob", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vercel/blob")>();
  return { ...actual, put: putMock, del: delMock };
});

import { BlobError } from "@vercel/blob";
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
const pdf = (extra = 0) => new Uint8Array([...Buffer.from("%PDF-1.4"), ...new Array(extra).fill(0)]);
const text = () => new Uint8Array(Buffer.from("just some plain text, definitely not an image"));

/** The options object our module hands to `put`. */
type PutOptions = {
  access: string;
  token: string;
  contentType: string;
  addRandomSuffix: boolean;
  allowOverwrite: boolean;
  cacheControlMaxAge: number;
  abortSignal: AbortSignal;
};

const STORED_URL = "https://store123.public.blob.vercel-storage.com/uploads/u1/a.pdf";

beforeEach(() => {
  putMock.mockReset();
  delMock.mockReset();
  putMock.mockResolvedValue({ url: STORED_URL, pathname: "uploads/u1/a.pdf" });
  delMock.mockResolvedValue(undefined);
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  it("decides on the bytes, so a lying content-type changes nothing", () => {
    // The file name is never consulted at all; the declared MIME is, but only to
    // detect a disagreement.
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
    expect(checkUpload(png(), { declaredType: "application/octet-stream", purpose: "avatar" })).toMatchObject(
      { ok: true },
    );
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
    expect(
      checkUpload(new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), {
        purpose: "module",
      }),
    ).toMatchObject({ ok: false, reason: { code: "unsupported_type" } });
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
  const upload = (bytes = pdf()) =>
    putObject({ pathname: "uploads/u1/a.pdf", bytes, contentType: "application/pdf" });

  it("uploads through the SDK with the options that make an object immutable", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);

    const object = await upload();

    expect(object).toEqual({ url: STORED_URL, pathname: "uploads/u1/a.pdf" });
    expect(putMock).toHaveBeenCalledTimes(1);

    const [pathname, body, options] = putMock.mock.calls[0] as [string, Buffer, PutOptions];
    expect(pathname).toBe("uploads/u1/a.pdf");
    expect(options).toMatchObject({
      access: "public",
      // Passed explicitly: the SDK would otherwise prefer OIDC over our token.
      token: TOKEN,
      contentType: "application/pdf",
      // The pathname already ends in a uuid, so the store must neither rename it
      // nor let a guessed pathname replace somebody else's file.
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    expect(options.cacheControlMaxAge).toBeGreaterThan(0);
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
    // The bytes themselves, not a path and not a data URL.
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(Array.from(body)).toEqual(Array.from(pdf()));
  });

  it("gives up on a store that never answers, rather than retrying for minutes", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    // Nothing settles until the deadline aborts the request. The SDK only reads
    // an `AbortError` as "give up" — `AbortSignal.timeout` reports a
    // `TimeoutError`, which it would retry ten times with backoff.
    let signal: AbortSignal | undefined;
    putMock.mockImplementation((_pathname: string, _body: Buffer, options: PutOptions) => {
      signal = options.abortSignal;
      return new Promise((_resolve, reject) => {
        options.abortSignal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });

    vi.useFakeTimers();
    const pending = upload();
    const rejected = expect(pending).rejects.toThrow(StorageError);
    await vi.advanceTimersByTimeAsync(20_000);
    await rejected;

    expect(signal?.aborted).toBe(true);
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it("turns an SDK failure into one typed error, without retrying it ourselves", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    putMock.mockRejectedValue(new BlobError("forbidden"));

    const error = await upload().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).code).toBe("unavailable");
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it("reports a transport failure the same way as a refusal", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    putMock.mockRejectedValue(new TypeError("fetch failed"));

    const error = await upload().catch((thrown: unknown) => thrown);

    expect((error as StorageError).code).toBe("unavailable");
    expect((error as StorageError).message).toContain("was unreachable");
  });

  it("throws when the store answers without a url", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    putMock.mockResolvedValue({ url: undefined, pathname: "uploads/u1/a.pdf" });

    await expect(upload()).rejects.toThrow(/no url/);
  });

  it("refuses to guess a store id from a malformed token", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "not-a-blob-token");

    await expect(upload()).rejects.toThrow(/malformed/);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("refuses to upload with no token at all", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

    const error = await upload().catch((thrown: unknown) => thrown);

    expect((error as StorageError).code).toBe("not_configured");
    expect(putMock).not.toHaveBeenCalled();
  });
});

describe("deleteObject", () => {
  const url = "https://store123.public.blob.vercel-storage.com/uploads/u1/old.png";

  it("asks the SDK to delete the object", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);

    await deleteObject(url);

    expect(delMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({ token: TOKEN, abortSignal: expect.any(AbortSignal) }),
    );
  });

  it("does nothing for a URL that is not ours", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);

    await deleteObject("https://evil.test/tracker.gif");

    expect(delMock).not.toHaveBeenCalled();
  });

  it("does nothing when storage is not configured", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

    await deleteObject(url);

    expect(delMock).not.toHaveBeenCalled();
  });

  it("surfaces a failed delete as a typed error", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    delMock.mockRejectedValue(new BlobError("forbidden"));

    await expect(deleteObject(url)).rejects.toThrow(StorageError);
  });
});
