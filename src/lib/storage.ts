// src/lib/storage.ts
// ─── Object storage (Vercel Blob) ─────────────────────────────────────────────
// Why this exists: profile photos and module files used to be stored in Postgres
// as base64 data-URLs. A single module could put a whole PDF in a text column,
// and because the leaderboard selects `photo_url` for every student, one user's
// photo was paid for by everybody who loaded the page. Base64 also inflates
// payloads by ~33% and cannot be cached or served by a CDN.
//
// Now binary content goes to object storage and the database keeps a short https
// URL.
//
// The transfer itself is the official `@vercel/blob` SDK (`put` / `del`). That
// reverses the "no new dependency" call this module opened with. The REST
// contract looked small enough to call with `fetch`, but it is not ours: the API
// version, the header set, the retry policy, multipart and OIDC all move, and a
// hand-rolled client breaks silently when they do.
//
// What stays here is what the SDK cannot know:
//
//   * what the bytes *are*   — `checkUpload`, magic-byte sniffing, size ceilings
//   * where they may live    — `buildPathname`, `isOwnStorageUrl`
import { randomUUID } from "node:crypto";
import { BlobError, del, put } from "@vercel/blob";

/** How long a stored object may be cached at the edge. Uploads are immutable. */
const CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * The SDK retries a failed request up to ten times with exponential backoff, so
 * a store that simply stops answering would hold a route handler open for
 * minutes. These are the ceilings instead.
 */
const PUT_TIMEOUT_MS = 20_000;
const DELETE_TIMEOUT_MS = 10_000;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export type UploadKind = "image" | "document";

/**
 * What the upload is for. The purpose narrows the accepted types, so an avatar
 * cannot be a PDF and a module cannot be an SVG (which is a scripting vector
 * when it is served inline).
 */
export type UploadPurpose = "avatar" | "module";

export interface FileType {
  mime: string;
  ext: string;
  kind: UploadKind;
}

interface TypeRule extends FileType {
  /** Returns true when `bytes` really starts with this format's signature. */
  matches: (bytes: Uint8Array) => boolean;
  maxBytes: number;
  purposes: readonly UploadPurpose[];
}

function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Format detection by magic bytes, not by the client's `content-type` or the
 * file extension — both are attacker-controlled. This is the check that decides
 * what actually gets stored.
 */
const TYPE_RULES: readonly TypeRule[] = [
  {
    mime: "image/png",
    ext: "png",
    kind: "image",
    maxBytes: MAX_IMAGE_BYTES,
    purposes: ["avatar", "module"],
    matches: (b) => ascii(b, 0, "\x89PNG\r\n\x1a\n"),
  },
  {
    mime: "image/jpeg",
    ext: "jpg",
    kind: "image",
    maxBytes: MAX_IMAGE_BYTES,
    purposes: ["avatar", "module"],
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/webp",
    ext: "webp",
    kind: "image",
    maxBytes: MAX_IMAGE_BYTES,
    purposes: ["avatar", "module"],
    matches: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP"),
  },
  {
    mime: "application/pdf",
    ext: "pdf",
    kind: "document",
    maxBytes: MAX_DOCUMENT_BYTES,
    purposes: ["module"],
    matches: (b) => ascii(b, 0, "%PDF-"),
  },
];

export const ACCEPTED_MIME_TYPES: readonly string[] = TYPE_RULES.map((rule) => rule.mime);

/** The largest body /api/uploads will read, across every accepted type. */
export const MAX_UPLOAD_BYTES = Math.max(...TYPE_RULES.map((rule) => rule.maxBytes));

export type UploadRejection =
  | { code: "unsupported_type"; message: string }
  | { code: "type_mismatch"; message: string }
  | { code: "too_large"; message: string }
  | { code: "not_allowed_for_purpose"; message: string };

export type UploadCheck =
  | { ok: true; type: FileType }
  | { ok: false; reason: UploadRejection };

function humanSize(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

/**
 * Decides whether these bytes may be stored for this purpose.
 *
 * `declaredType` is the browser-supplied MIME type. It is never trusted for
 * storage, but a disagreement with the sniffed type is worth refusing: it is
 * either a broken client or someone probing the filter.
 */
export function checkUpload(
  bytes: Uint8Array,
  options: { declaredType?: string | null; purpose: UploadPurpose },
): UploadCheck {
  if (bytes.length === 0) {
    return { ok: false, reason: { code: "unsupported_type", message: "File is empty" } };
  }

  const rule = TYPE_RULES.find((candidate) => candidate.matches(bytes));
  if (!rule) {
    return {
      ok: false,
      reason: {
        code: "unsupported_type",
        message: `Unsupported file type. Accepted: ${ACCEPTED_MIME_TYPES.join(", ")}`,
      },
    };
  }

  const declared = options.declaredType?.split(";")[0]?.trim().toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== rule.mime) {
    return {
      ok: false,
      reason: {
        code: "type_mismatch",
        message: `File content is ${rule.mime} but it was declared as ${declared}`,
      },
    };
  }

  if (!rule.purposes.includes(options.purpose)) {
    return {
      ok: false,
      reason: {
        code: "not_allowed_for_purpose",
        message: `${rule.mime} is not accepted for ${options.purpose} uploads`,
      },
    };
  }

  if (bytes.length > rule.maxBytes) {
    return {
      ok: false,
      reason: {
        code: "too_large",
        message: `File exceeds the ${humanSize(rule.maxBytes)} limit for ${rule.mime}`,
      },
    };
  }

  return { ok: true, type: { mime: rule.mime, ext: rule.ext, kind: rule.kind } };
}

// ─── Vercel Blob client ───────────────────────────────────────────────────────

export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "rejected" | "unavailable",
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export function storageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * A read-write token is `vercel_blob_rw_<storeId>_<secret>`, and the store id is
 * the fourth segment. The SDK parses this too, but it treats a token it cannot
 * parse as an ordinary store error — and a malformed token is a configuration
 * fault, which the caller has to be able to tell apart from an outage.
 */
function storeIdFromToken(token: string): string {
  const [, , , storeId = ""] = token.split("_");
  if (!storeId) {
    throw new StorageError("BLOB_READ_WRITE_TOKEN is malformed: no store id found", "not_configured");
  }
  return storeId;
}

/**
 * The token is handed to the SDK explicitly on every call.
 *
 * Left to itself the SDK resolves credentials as OIDC first, then
 * `BLOB_READ_WRITE_TOKEN` — so on a deployment with OIDC enabled the store would
 * be chosen by `BLOB_STORE_ID` and this token would be ignored. Passing it keeps
 * exactly one credential in charge.
 */
function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new StorageError("BLOB_READ_WRITE_TOKEN is not set", "not_configured");
  storeIdFromToken(token);
  return token;
}

/**
 * Runs one SDK call under a hard deadline.
 *
 * Aborting through a plain `AbortController` is what the SDK reads as "give up
 * now" — it only recognises the `AbortError` a controller produces, while
 * `AbortSignal.timeout` reports a `TimeoutError` and gets retried like any other
 * transient failure.
 */
async function withDeadline<T>(ms: number, attempt: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await attempt(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The SDK's failures — its `BlobError` subclasses, and the raw transport error
 * once its retries are spent — carry no status code, and no caller can act
 * differently on any of them: the store was unreachable either way.
 */
function storageFailure(action: string, error: unknown): StorageError {
  if (error instanceof StorageError) return error;

  const detail = error instanceof Error ? error.message : String(error);
  const cause = error instanceof BlobError ? "rejected the request" : "was unreachable";
  return new StorageError(`Blob store ${cause} on ${action}: ${detail}`, "unavailable");
}

export interface StoredObject {
  url: string;
  pathname: string;
}

/** `uploads/<userId>/<random>.<ext>` — a uuid path, so it can never collide. */
export function buildPathname(userId: string, ext: string): string {
  return `uploads/${userId}/${randomUUID()}.${ext}`;
}

/**
 * Uploads one object and returns its public URL.
 *
 * `allowOverwrite` and `addRandomSuffix` are both off: the pathname already ends
 * in a uuid, and refusing to overwrite means a guessed pathname can never
 * replace somebody else's file. `cacheControlMaxAge` is set because an uploaded
 * object is immutable — it is addressed by uuid and never rewritten.
 */
export async function putObject(params: {
  pathname: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<StoredObject> {
  const token = blobToken();

  try {
    const result = await withDeadline(PUT_TIMEOUT_MS, (abortSignal) =>
      put(params.pathname, Buffer.from(params.bytes), {
        access: "public",
        token,
        contentType: params.contentType,
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: CACHE_MAX_AGE_SECONDS,
        abortSignal,
      }),
    );

    if (!result.url) {
      throw new StorageError("Blob store response had no url", "unavailable");
    }

    return { url: result.url, pathname: result.pathname || params.pathname };
  } catch (error) {
    throw storageFailure("upload", error);
  }
}

/**
 * Deletes a previously stored object. Best effort: the caller treats a failure
 * as a leaked object, never as a failed request.
 */
export async function deleteObject(url: string): Promise<void> {
  if (!storageConfigured() || !isOwnStorageUrl(url)) return;

  const token = blobToken();

  try {
    await withDeadline(DELETE_TIMEOUT_MS, (abortSignal) => del(url, { token, abortSignal }));
  } catch (error) {
    throw storageFailure("delete", error);
  }
}

/**
 * True only for URLs inside a Vercel Blob store.
 *
 * Used to keep `photo_url` pointing at our own storage: without it, the column
 * would happily accept any https URL, which turns the leaderboard into a
 * third-party image host and a tracking-pixel delivery mechanism.
 */
export function isOwnStorageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}
