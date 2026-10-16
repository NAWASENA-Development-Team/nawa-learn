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
// The Vercel Blob REST API is called directly with `fetch`, the same way
// `rateLimit.ts` talks to Upstash, so this adds no dependency. The contract is
// pinned to `x-api-version: 13` and mirrors `@vercel/blob`'s own client:
//
//   PUT  {base}/?pathname=<encoded>     body = the bytes
//   POST {base}/delete                  body = { urls: [...] }
//
// If that surface ever grows (multipart, client tokens, OIDC), swapping this
// module for the official `@vercel/blob` package is the intended move.
import { randomUUID } from "node:crypto";

/** Pinned to the version `@vercel/blob@2.8.2` sends. */
const BLOB_API_VERSION = 13;
const DEFAULT_BLOB_API_URL = "https://vercel.com/api/blob";

/** How long a stored object may be cached at the edge. Uploads are immutable. */
const CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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

function apiBaseUrl(): string {
  const override = process.env.VERCEL_BLOB_API_URL || process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL;
  return (override || DEFAULT_BLOB_API_URL).replace(/\/$/, "");
}

/**
 * A read-write token looks like `vercel_blob_rw_<storeId>_<secret>`. The API
 * wants the store id as its own header, exactly as `@vercel/blob` derives it.
 */
function storeIdFromToken(token: string): string {
  const [, , , storeId = ""] = token.split("_");
  if (!storeId) {
    throw new StorageError("BLOB_READ_WRITE_TOKEN is malformed: no store id found", "not_configured");
  }
  return storeId;
}

function authHeaders(): Record<string, string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new StorageError("BLOB_READ_WRITE_TOKEN is not set", "not_configured");

  return {
    authorization: `Bearer ${token}`,
    "x-api-version": String(BLOB_API_VERSION),
    "x-vercel-blob-store-id": storeIdFromToken(token),
  };
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
 * replace somebody else's file.
 */
export async function putObject(params: {
  pathname: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<StoredObject> {
  const url = `${apiBaseUrl()}/?${new URLSearchParams({ pathname: params.pathname }).toString()}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...authHeaders(),
      "x-vercel-blob-access": "public",
      "x-content-type": params.contentType,
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "0",
      "x-cache-control-max-age": String(CACHE_MAX_AGE_SECONDS),
    },
    // A copy: the caller may reuse the buffer, and the fetch spec wants a
    // BodyInit rather than a view into a shared ArrayBuffer.
    body: new Uint8Array(params.bytes),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new StorageError(`Blob store responded ${response.status}`, "unavailable");
  }

  const payload = (await response.json()) as { url?: string; pathname?: string };
  if (!payload.url) {
    throw new StorageError("Blob store response had no url", "unavailable");
  }

  return { url: payload.url, pathname: payload.pathname ?? params.pathname };
}

/**
 * Deletes a previously stored object. Best effort: the caller treats a failure
 * as a leaked object, never as a failed request.
 */
export async function deleteObject(url: string): Promise<void> {
  if (!storageConfigured() || !isOwnStorageUrl(url)) return;

  const response = await fetch(`${apiBaseUrl()}/delete`, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ urls: [url] }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new StorageError(`Blob store responded ${response.status} on delete`, "unavailable");
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
