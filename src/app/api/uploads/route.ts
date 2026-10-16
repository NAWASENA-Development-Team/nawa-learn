// app/api/uploads/route.ts
// ─── The only door binary content goes through ────────────────────────────────
// Accepts one file as `multipart/form-data`, decides what it really is by its
// magic bytes, and stores it. The response is the https URL that the caller then
// puts in `photo_url` or `content_url`.
//
// Two things this route refuses to do, both deliberately:
//
//   * It does not accept a base64 body. That is the format we are migrating
//     away from, and accepting it "just for small files" would leave the
//     Postgres-as-a-file-store path open.
//   * It does not trust the browser's `content-type` or the file name. The
//     stored content type comes from the sniffed signature.
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import {
  MAX_UPLOAD_BYTES,
  buildPathname,
  checkUpload,
  putObject,
  storageConfigured,
  type UploadPurpose,
} from "@/lib/storage";

export const maxDuration = 30;

/** Multipart boundaries and part headers sit outside the file bytes. */
const MULTIPART_OVERHEAD_BYTES = 8 * 1024;

const PURPOSES: readonly UploadPurpose[] = ["avatar", "module"];

function isPurpose(value: unknown): value is UploadPurpose {
  return typeof value === "string" && (PURPOSES as readonly string[]).includes(value);
}

export async function POST(req: Request) {
  const log = requestLogger(req);

  const authz = await requireUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  const limit = await rateLimit(req, "uploads/create", user.id);
  if (!limit.ok) return limit.response;

  // Refuse an oversized request before buffering it. `content-length` is only a
  // hint, so the file is measured again after parsing.
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json(
      { error: "File is too large" },
      { status: 413, headers: { "cache-control": "no-store" } },
    );
  }

  if (!storageConfigured()) {
    // Loud, not silent. Falling back to base64 here is exactly how the problem
    // started, so an unconfigured deployment refuses the upload instead.
    log.error("upload rejected: object storage is not configured", {
      detail: "BLOB_READ_WRITE_TOKEN is not set",
    });
    return NextResponse.json(
      { error: "Object storage is not configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart/form-data body" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const purpose = form.get("purpose");
  if (!isPurpose(purpose)) {
    return NextResponse.json(
      { error: `purpose must be one of: ${PURPOSES.join(", ")}` },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "A `file` part is required" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes, { declaredType: file.type, purpose });
  if (!check.ok) {
    log.warn("upload_rejected", {
      code: check.reason.code,
      userId: user.id,
      declaredType: file.type || undefined,
      size: bytes.length,
    });
    return NextResponse.json(
      { error: check.reason.message, code: check.reason.code },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const stored = await putObject({
      pathname: buildPathname(user.id, check.type.ext),
      bytes,
      contentType: check.type.mime,
    });

    log.info("upload_stored", {
      userId: user.id,
      purpose,
      contentType: check.type.mime,
      size: bytes.length,
    });

    return NextResponse.json(
      { url: stored.url, contentType: check.type.mime, size: bytes.length },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    // The URL is never faked, so a storage failure is a failed upload.
    log.error("upload failed", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
