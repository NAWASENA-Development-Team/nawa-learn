// src/lib/validation.ts
// ─── Request validation ───────────────────────────────────────────────────────
// One way to read a JSON body and one shape for a rejection, so a client can
// handle every endpoint the same way.
//
// Before this module each route did its own thing: some called `schema.parse()`
// inside a `try` and let the `ZodError` fall into the generic `catch` — which
// answered **500** for what is plainly a bad request — others hand-rolled
// `if (!field)` checks, and `profile/update` validated nothing at all. A 500 for
// a typo also means the client retries, and it hides real server faults in the
// noise.
//
// Status codes are deliberate:
//
//   400  the body parsed but did not satisfy the schema (or was not JSON)
//   413  the body is larger than the route accepts
//   415  the body is not JSON at all
//
// Every rejection is `no-store` and carries `{ error, details? }`, where
// `details` is a flat, serialisable list of `{ path, message }`.
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Default ceiling for a JSON request body.
 *
 * The largest legitimate body in this app is a custom exam: 50 questions, each
 * with five options and an explanation, which lands around 25 KB. 64 KB leaves
 * room without letting a single request allocate megabytes.
 */
export const MAX_JSON_BODY_BYTES = 64 * 1024;

export interface FieldError {
  /** Dotted path into the body, e.g. `options.A`. `(root)` for whole-body issues. */
  path: string;
  message: string;
}

export type ParseOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

const encoder = new TextEncoder();

function bytesOf(text: string): number {
  return encoder.encode(text).byteLength;
}

function errorResponse(status: number, error: string, details?: FieldError[]): NextResponse {
  return NextResponse.json(
    details && details.length > 0 ? { error, details } : { error },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/** Flattens a `ZodError` into a stable, JSON-safe list. */
export function fieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.flatMap((issue) => {
    // zod reports an unknown key as a single issue whose path is empty and whose
    // `keys` list names the offenders. Expanding it keeps the contract that
    // `path` points at the field the client has to fix; without this, a typo'd
    // key would come back as an unhelpful `(root)`.
    if (issue.code === "unrecognized_keys") {
      const prefix = issue.path.length > 0 ? `${issue.path.map(String).join(".")}.` : "";
      return issue.keys.map((key) => ({ path: `${prefix}${key}`, message: issue.message }));
    }

    return [
      {
        path: issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)",
        message: issue.message,
      },
    ];
  });
}

/** The single 400 produced for a schema failure. */
export function badRequest(error: z.ZodError, message = "Validation failed"): NextResponse {
  return errorResponse(400, message, fieldErrors(error));
}

/**
 * Reads the body as JSON, refusing anything oversized or mislabelled.
 *
 * The size limit is checked twice on purpose. `content-length` is supplied by
 * the client, so it is a cheap early reject but not a guarantee; the real check
 * is the measured length of what actually arrived.
 */
export async function readJsonBody(
  request: Request,
  options: { maxBytes?: number } = {},
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const maxBytes = options.maxBytes ?? MAX_JSON_BODY_BYTES;

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      response: errorResponse(415, "Expected a JSON request body (content-type: application/json)"),
    };
  }

  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: tooLarge(maxBytes) };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, response: errorResponse(400, "Could not read the request body") };
  }

  if (bytesOf(raw) > maxBytes) {
    return { ok: false, response: tooLarge(maxBytes) };
  }

  if (raw.trim() === "") {
    return { ok: false, response: errorResponse(400, "Request body is empty") };
  }

  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, response: errorResponse(400, "Request body is not valid JSON") };
  }
}

function tooLarge(maxBytes: number): NextResponse {
  return errorResponse(413, `Request body exceeds the ${maxBytes}-byte limit`);
}

/**
 * The whole job, in one call:
 *
 *   const parsed = await parseJsonBody(req, submitSchema);
 *   if (!parsed.ok) return parsed.response;
 *   // parsed.data is typed
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  options: { maxBytes?: number; message?: string } = {},
): Promise<ParseOutcome<T>> {
  const read = await readJsonBody(request, options);
  if (!read.ok) return read;

  const parsed = schema.safeParse(read.body);
  if (!parsed.success) {
    return { ok: false, response: badRequest(parsed.error, options.message) };
  }

  return { ok: true, data: parsed.data };
}

// ─── Reusable field schemas ───────────────────────────────────────────────────

/**
 * Text that a human wrote and that we will store and show to other people.
 * `.trim()` so a bio of only spaces does not count as content.
 */
export const shortText = (max: number, min = 1) => z.string().trim().min(min).max(max);

/**
 * An optional free-text field. An empty string is treated as "not provided"
 * rather than a validation failure, because that is what a form sends when the
 * user leaves the box untouched.
 */
export const optionalText = (max: number) => z.string().trim().max(max).optional();


/**
 * A URL we are willing to store.
 *
 * `data:` is rejected outright: that is how base64 documents and photos ended up
 * in Postgres columns and then in the leaderboard payload. Binary content now
 * goes through /api/uploads, which returns an https URL.
 */
export const httpUrl = (max = 2048) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => /^https?:\/\/[^\s]+$/i.test(value), {
      message: "Must be an http(s) URL",
    });
