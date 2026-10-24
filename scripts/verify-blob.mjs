#!/usr/bin/env node
// scripts/verify-blob.mjs
// ─── Proves the Blob store *accepts and serves* what the app sends ───────────
// M14g: every upload had failed since M8 because the store was created **private**
// while `src/lib/storage.ts` uploads with `access: "public"`. Nothing caught it.
// `tests/unit/storage.test.ts` and `tests/integration/uploads.test.ts` both
// `vi.mock("@vercel/blob")`, and a mock cannot disagree with a store — it assumes
// `put()` succeeds, so the one thing that was actually broken was the one thing
// no test exercised. The build was green, the suite was green, and the only
// signal was a student saying the avatar would not save.
//
// That is the C6 failure shape a third time (the proxy that was never loaded, the
// CI that was never green): present, documented, tested in isolation, and never
// once verified *connected*. So this script does the one thing no test in this
// repository can — it talks to the real store.
//
// What it asserts, in one round trip:
//   1. `put()` succeeds with the app's exact options. A private store answers
//      "Cannot use public access on a private store" here and nowhere else.
//   2. The returned URL is readable by an **anonymous** GET. That is precisely
//      how a browser loads `photo_url`: no cookie, no token, no SDK.
//   3. The bytes come back unchanged and the content type survives.
//   4. The URL satisfies `isOwnStorageUrl()`, because the app validates its own
//      upload against that predicate before storing it. A store on a different
//      host would accept the upload and then have it rejected.
//   5. `del()` really removes the object, so replacing an avatar does not leak
//      the old one. `deleteObject()` is best-effort by design, which means a
//      broken delete is silent by design too.
//
// Deliberately NOT used as evidence: the SDK's own success return value. It
// reports what the API said, not what a browser can fetch.
//
// Usage:
//   npm run verify:blob              # token from the environment, else .env.local
//   npm run verify:blob -- --large   # also push a document-sized body (10 MB)
//   npm run verify:blob -- --keep    # leave the object and print its URL
//
// Exit codes: 0 = the store accepts and serves the probe, 1 = it does not,
//             2 = not configured (no token). 2 is a *skip*, not a failure: a
//             clone with no credentials must be able to run this without a red
//             build. For the same reason this script is deliberately absent from
//             CI — the `verify` job is hermetic, and `tests/unit/ci-gates.test.ts`
//             fails if a `secrets.*` reference ever reappears in the workflow.

import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { BlobError, BlobNotFoundError, del, head, put } from "@vercel/blob";

const args = process.argv.slice(2);
const LARGE = args.includes("--large");
const KEEP = args.includes("--keep");

// The SDK retries a failed request up to ten times with exponential backoff, so
// an unreachable store would hold this script open for minutes. These mirror the
// ceilings in `src/lib/storage.ts` — the probe should give up when the app does.
const PUT_TIMEOUT_MS = 20_000;
const DELETE_TIMEOUT_MS = 10_000;
const READ_TIMEOUT_MS = 30_000;

// 10 MB, the `MAX_DOCUMENT_BYTES` ceiling in `src/lib/storage.ts` — the largest
// body the app will ever send. Worth probing separately because a store can
// accept a 100-byte object and refuse a document-sized one, and that failure
// shows up only for real module uploads.
//
// It is *not* a multipart probe: `putObject()` never sets `multipart`, and the
// SDK's `multipart` option defaults to `false` — it does not switch over at 8 MB
// on its own. So this is the same single-PUT request with a bigger body, which is
// exactly what production does.
const LARGE_BYTES = 10 * 1024 * 1024;

const root = path.resolve(import.meta.dirname, "..");

/**
 * A failed expectation, as opposed to a crash. Thrown rather than exited so that
 * the single handler below always gets to clean up: `process.exit()` does not
 * unwind the stack, so an `exit` from inside the probe would skip the `catch` and
 * leak the very object the script had just created.
 */
class ProbeFailure extends Error {
  constructor(message) {
    super(message);
    this.name = "ProbeFailure";
  }
}

function check(condition, message) {
  if (!condition) throw new ProbeFailure(message);
}

function describe(error) {
  if (error instanceof BlobError) return `the Blob store rejected the request: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Aborting through a plain `AbortController` is what the SDK reads as "give up
 * now" — it only recognises the `AbortError` a controller produces, while
 * `AbortSignal.timeout` reports a `TimeoutError` and gets retried like any other
 * transient failure. Same helper, same reason, as `src/lib/storage.ts`.
 */
async function withDeadline(ms, attempt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await attempt(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Credentials ─────────────────────────────────────────────────────────────

/**
 * A token in the environment always wins; `.env.local` is only a convenience for
 * running this by hand. Loading the file first would let a stale local token
 * silently override the one the operator exported, which is the opposite of what
 * a verification script should do.
 */
function loadLocalEnv() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return;
  const file = path.join(root, ".env.local");
  if (!existsSync(file)) return;
  try {
    // Built in since Node 20.12, so this needs no dependency. A file that cannot
    // be parsed is not fatal here: the missing-token branch below explains it.
    process.loadEnvFile(file);
  } catch {
    /* fall through to the not-configured exit */
  }
}

loadLocalEnv();

const token = process.env.BLOB_READ_WRITE_TOKEN;

if (!token) {
  console.error(
    "\n· verify-blob: BLOB_READ_WRITE_TOKEN is not set — skipping (exit 2).\n" +
      "  Set it in the environment or in .env.local to probe the real store.\n",
  );
  process.exit(2);
}

/**
 * `vercel_blob_rw_<storeId>_<secret>` — the store id is the fourth segment. It is
 * printed because "the app is pointed at the wrong store" is a real failure mode
 * (the M14g fix rotated the token precisely to leave the private store behind),
 * and the id is the only way to tell from a terminal which store answered. It is
 * an identifier, not a credential.
 */
const [, , , storeId = ""] = token.split("_");
if (!storeId) {
  // Safe to exit outright: nothing has been uploaded yet, so there is nothing to
  // clean up. Every failure *after* the first `put()` goes through the handler at
  // the bottom of this file instead.
  console.error(
    "\n✖ BLOB_READ_WRITE_TOKEN is malformed: no store id found.\n" +
      "  Expected `vercel_blob_rw_<storeId>_<secret>`. `src/lib/storage.ts`\n" +
      "  rejects this token the same way before it ever reaches the SDK.\n",
  );
  process.exit(1);
}

console.log(`▲ probing Blob store ${storeId}${LARGE ? " (with a document-sized body)" : ""} …`);

// ─── The probe ───────────────────────────────────────────────────────────────

const probe = Buffer.from(
  `nawa-learn blob probe\nwhen: ${new Date().toISOString()}\nid:   ${randomUUID()}\n`,
  "utf8",
);
const payload = LARGE ? Buffer.concat([probe, Buffer.alloc(LARGE_BYTES - probe.length, 0x2e)]) : probe;
const expected = createHash("sha256").update(payload).digest("hex");

// A `verify/` prefix, not `uploads/`: a probe that leaks into the store should be
// obviously not a user's file, and `uploads/<userId>/…` is the only shape
// `buildPathname()` ever produces.
const pathname = `verify/probe-${randomUUID()}.txt`;

let storedUrl = null;
let removed = false;

/**
 * Best effort, but loud. `removed` is only set once the delete has actually
 * succeeded, so a failed delete in the middle of the probe is retried once by the
 * handler below instead of being written off.
 */
async function removeProbe() {
  if (!storedUrl || removed || KEEP) return;
  await withDeadline(DELETE_TIMEOUT_MS, (abortSignal) => del(storedUrl, { token, abortSignal }));
  removed = true;
}

try {
  // ── 1. Upload, with the app's exact options ────────────────────────────────
  //
  // Every one of these is load-bearing and comes from `putObject()`:
  //   • `access: "public"` is the option the private store rejected, and the
  //     store's access mode is permanent — it cannot be changed after creation.
  //   • `allowOverwrite: false` means a guessed pathname can never replace
  //     somebody else's file.
  //   • `addRandomSuffix: false` keeps the URL equal to the pathname the app
  //     chose and can therefore predict.
  //   • `cacheControlMaxAge` matters for the delete check below: an uploaded
  //     object is addressed by uuid and never rewritten, so it is cached hard.
  const uploaded = await withDeadline(PUT_TIMEOUT_MS, (abortSignal) =>
    put(pathname, payload, {
      access: "public",
      token,
      contentType: "text/plain",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
      abortSignal,
    }),
  );

  // `del()` accepts a URL *or* a pathname, so record whichever the SDK gave back
  // before asserting anything about it. If `put()` succeeded but returned no url,
  // the object still exists and the cleanup path must still be able to name it —
  // otherwise the one failure mode that leaks an object is the one that cannot
  // clean up after itself.
  storedUrl = uploaded?.url ?? uploaded?.pathname ?? null;
  check(Boolean(uploaded?.url), "`put()` returned no url. `putObject()` treats that as an unavailable store.");
  console.log(`  ✔ put() accepted ${(payload.length / 1024).toFixed(1)} KiB → ${storedUrl}`);

  // ── 2. The URL must be readable with no credentials ───────────────────────
  //
  // `photo_url` and `content_url` are rendered straight into `src`, so this GET
  // is the production read path with nothing added. A private store fails here
  // with 401/403 even if the upload above somehow succeeded.
  const response = await fetch(storedUrl, {
    redirect: "manual",
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });

  check(
    response.status === 200,
    `Anonymous GET of the uploaded object answered ${response.status}, not 200.\n` +
      `  The URL the app stores is loaded by a browser with no cookie and no\n` +
      `  token. A 401/403 here means the store is not publicly readable, and\n` +
      `  every avatar and module would render as a broken image.\n` +
      `  The access mode is fixed at store creation and cannot be changed\n` +
      `  afterwards — a private store has to be replaced, which is what the\n` +
      `  M14g incident had to do.`,
  );

  const body = Buffer.from(await response.arrayBuffer());
  const actual = createHash("sha256").update(body).digest("hex");

  check(
    actual === expected,
    `The object read back does not match the object written.\n` +
      `  wrote ${payload.length} bytes, sha256 ${expected}\n` +
      `  read  ${body.length} bytes, sha256 ${actual}\n` +
      `  A truncated upload is worse than a refused one: it stores a file that\n` +
      `  opens and is wrong.`,
  );
  console.log(`  ✔ anonymous GET → 200, ${body.length} bytes, sha256 matches`);

  // ── 3. The content type survived the round trip ───────────────────────────
  //
  // `contentType` is what makes a stored PDF open in a viewer instead of
  // downloading as octets, and it is sniffed from magic bytes by `checkUpload()`
  // — so a store that rewrites it silently breaks the reader.
  const contentType = response.headers.get("content-type") ?? "";
  check(
    /^text\/plain\b/i.test(contentType),
    `Expected the object to come back as text/plain, got "${contentType || "(absent)"}".\n` +
      `  The app sets contentType on every upload so that a stored PDF opens in\n` +
      `  a viewer rather than downloading as application/octet-stream.`,
  );
  console.log(`  ✔ content-type survived: ${contentType}`);

  // ── 4. The URL is one the app will accept back ────────────────────────────
  //
  // `isOwnStorageUrl()` gates `photo_url`, so that the column can never be used
  // as a third-party image host or a tracking pixel. It requires *both* `https:`
  // and a `.blob.vercel-storage.com` host, so both are checked here.
  const parsed = new URL(storedUrl);
  check(
    parsed.protocol === "https:" && parsed.hostname.endsWith(".blob.vercel-storage.com"),
    `The uploaded URL is ${parsed.protocol}//${parsed.hostname}, which\n` +
      `  \`isOwnStorageUrl()\` rejects. Every upload would be stored and then\n` +
      `  refused by the route that validates it.`,
  );
  console.log(`  ✔ host accepted by isOwnStorageUrl(): ${parsed.hostname}`);

  // The token names a store, and the URL should be that store. Worth asserting
  // because the SDK resolves credentials OIDC-first when it is not handed a
  // token, and `putObject()` passes one precisely so a deployment with
  // `VERCEL_OIDC_TOKEN` cannot quietly write into `BLOB_STORE_ID` instead.
  //
  // Compared case-insensitively: the store id inside the token is
  // `vercel_blob_rw_<storeId>_<secret>` and keeps its original casing
  // (`6xzlCY024uMRyPK5`), while a hostname is normalised to lower case by DNS and
  // by `URL`. A case-sensitive `startsWith` here fails on a perfectly good store —
  // it did, on the first real run of this script.
  check(
    parsed.hostname.toLowerCase().startsWith(`${storeId.toLowerCase()}.`),
    `The upload landed on "${parsed.hostname}", but the token names store\n` +
      `  "${storeId}". The object went somewhere other than the store this\n` +
      `  token grants access to — most likely a second credential in the\n` +
      `  environment winning over the one that was passed explicitly.`,
  );
  console.log("  ✔ the write landed in the token's own store");

  // ── 5. Delete, then prove it is gone ──────────────────────────────────────
  //
  // `deleteObject()` swallows failures on purpose (a failed delete is a leaked
  // object, never a failed request), so nothing in production will ever report a
  // broken delete. It has to be asserted here or not at all.
  if (KEEP) {
    console.log(`  · --keep: leaving the object in place at ${storedUrl}`);
  } else {
    await removeProbe();
    console.log("  ✔ del() accepted the delete");

    // `head()` asks the metadata API, not the CDN, and it *throws*
    // `BlobNotFoundError` for a missing blob rather than resolving falsy. A GET
    // would be the wrong probe: with the 30-day `cacheControlMaxAge` the app
    // sets, the edge can still answer a GET for a moment after `del()` and
    // report a false failure.
    let stillThere = true;
    try {
      await withDeadline(DELETE_TIMEOUT_MS, (abortSignal) => head(storedUrl, { token, abortSignal }));
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error;
      stillThere = false;
    }

    check(
      !stillThere,
      `The object is still present after del(): ${storedUrl}\n` +
        `  A replaced avatar would leave the old file in the store forever,\n` +
        `  costing storage and keeping a deleted student's photo reachable by\n` +
        `  anyone who kept the URL.`,
    );
    console.log("  ✔ head() reports the object is gone");
  }
} catch (error) {
  // One handler, and it runs before the exit code is set. A probe that fails must
  // not be the reason the store accumulates junk: the next person to look would
  // find test objects and conclude something else is writing to the store.
  let cleanupNote = "";
  try {
    await removeProbe();
  } catch (cleanupError) {
    cleanupNote =
      `\n! cleanup could not delete ${storedUrl}\n` +
      `  ${describe(cleanupError)}\n` +
      `  Delete it by hand: that object is now litter in a production store.\n`;
  }

  const headline =
    error instanceof ProbeFailure
      ? error.message
      : `verify-blob could not complete: ${describe(error)}`;

  console.error(`\n✖ ${headline}${cleanupNote}\n`);
  process.exit(1);
}

console.log(
  `\n✔ Blob store ${storeId} is live: put() accepted a public upload, an anonymous\n` +
    `  GET returned the exact bytes, the host is accepted by isOwnStorageUrl(), and\n` +
    `  del() removed the object.\n`,
);
