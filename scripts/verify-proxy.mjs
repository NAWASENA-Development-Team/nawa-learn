#!/usr/bin/env node
// scripts/verify-proxy.mjs
// ─── Proves the proxy is *live*, not merely present ──────────────────────────
// M9 found that `proxy.ts` had sat at the repository root since M1 while Next
// looked for it in `src/`. Nothing failed: the build was green, the typecheck was
// green, the tests were green — and the deny-by-default auth gate, the CSRF guard
// and the CSP were all dead code for eight milestones (see C6 in
// docs/AUDIT-AND-ROADMAP.md).
//
// `tests/unit/proxy-location.test.ts` only closes the filesystem half of that
// hole: it asserts the file is in the right directory. It cannot assert that Next
// actually *loads* it. So this script closes the other half by starting a real
// production server and making a real request.
//
// What it asserts, in one round trip:
//   1. the request reaches the proxy at all — an unauthenticated call to a path
//      that does not exist under /api must answer 401, not 404. A 404 would mean
//      the request sailed straight past the proxy to the router.
//   2. the proxy is the one from `src/proxy.ts` — the response must carry a
//      nonce-bearing `content-security-policy`, which only that file produces.
//
// Deliberately NOT used as evidence: `server/middleware-manifest.json`. On Next 16
// + Turbopack it stays `{"middleware":{}}` whether or not the proxy is running.
//
// Usage:
//   node scripts/verify-proxy.mjs            # needs a prior `next build`
//   node scripts/verify-proxy.mjs --port 3211
//
// Exit codes: 0 = proxy is live, 1 = it is not (or the server never came up).

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const portArg = args.indexOf("--port");
const PORT = Number(portArg !== -1 ? args[portArg + 1] : 3211);
const HOST = "127.0.0.1";

// A path under /api that no route handler claims. If the proxy runs, the request
// is refused before the router ever sees it.
const PROBE_PATH = "/api/__proxy-smoke__";

const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 250;

const root = path.resolve(import.meta.dirname, "..");

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!existsSync(path.join(root, ".next", "BUILD_ID"))) {
  fail("No production build found at .next/. Run `npm run build` first.");
}

console.log(`▲ starting \`next start -p ${PORT}\` to probe ${PROBE_PATH} …`);

const child = spawn(
  process.execPath,
  [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: process.env },
);

let serverLog = "";
child.stdout.on("data", (d) => (serverLog += d.toString()));
child.stderr.on("data", (d) => (serverLog += d.toString()));

let exited = false;
child.on("exit", (code) => {
  exited = true;
  if (code !== 0 && code !== null) serverLog += `\n(next start exited with code ${code})`;
});

function shutdown() {
  if (!exited) child.kill("SIGTERM");
}

process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited) fail(`\`next start\` exited before it was ready.\n\n${serverLog}`);
    try {
      const res = await fetch(`http://${HOST}:${PORT}${PROBE_PATH}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      });
      return res;
    } catch {
      await sleep(POLL_INTERVAL_MS);
    }
  }
  fail(`\`next start\` did not answer within ${READY_TIMEOUT_MS / 1000}s.\n\n${serverLog}`);
}

const res = await waitForServer();
const csp = res.headers.get("content-security-policy") ?? "";
const nonce = csp.match(/'nonce-([^']+)'/)?.[1];

console.log(`  status: ${res.status}`);
console.log(`  content-security-policy: ${csp ? `${csp.slice(0, 72)}…` : "(absent)"}`);

shutdown();

if (res.status !== 401) {
  fail(
    `Expected 401 from the proxy, got ${res.status}.\n` +
      `  A 404 means the request reached the router without passing the proxy:\n` +
      `  the deny-by-default auth gate is not running. Check that the proxy file\n` +
      `  lives next to \`app\` (this project keeps it at src/proxy.ts).`,
  );
}

if (!nonce) {
  fail(
    "The response carries no nonce-bearing CSP.\n" +
      "  The auth gate answered, but the CSP half of the proxy did not run.",
  );
}

console.log(`\n✔ Proxy is live: unauthenticated ${PROBE_PATH} → 401, CSP nonce ${nonce.slice(0, 8)}…\n`);
