#!/usr/bin/env node
// scripts/audit-gate.mjs
// ─── `npm audit` as a gate, not as wallpaper ──────────────────────────────────
// M10 added dependency auditing because nothing was watching the tree: `next` sat
// on 16.2.6 through 17 advisories, three of them *critical*, one of which
// (unauthenticated RCE in the image optimiser) this app genuinely exposed through
// `next/image`.
//
// The obvious implementation — `npm audit --audit-level=high` — was tried and
// rejected. Immediately after the Next upgrade there were still HIGH advisories
// that a plain threshold check would have painted CI red for on every push until
// upstream moved, and a permanently red gate is a gate everyone learns to ignore
// — which is how the Next advisories went unnoticed in the first place.
//
// So the gate is an *allowlist with an expiry discipline*:
//   • a new HIGH or CRITICAL advisory fails the build;
//   • an allowlisted one passes, but only because someone wrote down why;
//   • an allowlist entry that no longer matches anything also fails the build, so
//     the list cannot quietly rot into a permanent exemption.
//
// Severity policy: HIGH and CRITICAL block. LOW and MODERATE are printed for
// visibility but do not block — they are overwhelmingly build-time tooling.
//
// Usage: node scripts/audit-gate.mjs

import { spawnSync } from "node:child_process";
import process from "node:process";
import { collectFindings, evaluateFindings } from "./audit-gate-lib.mjs";

/**
 * Reviewed exceptions. Every entry needs a reason that would still make sense to
 * a stranger in six months, and a date so staleness is visible.
 *
 * Do NOT add an entry to make CI green. Add one only after checking that the
 * vulnerable code path is genuinely unreachable from this app.
 *
 * This list is **empty**, and that is the target state, not an oversight. M10
 * shipped it with two entries — `js-cookie` (pinned exactly at 3.0.5 by
 * `@clerk/shared`) and `source-map-js` (build-time only) — and both were deleted
 * the same day, once a non-force `npm audit fix` was shown to clear them:
 * `@clerk/nextjs` declares `@clerk/shared: ^4.12.0`, and `@clerk/shared` 4.40.0
 * pins `js-cookie` at 3.0.8. The gate is what forced that outcome. An entry that
 * stops matching anything fails the build, so an exception cannot outlive the
 * advisory that justified it.
 */
const ALLOWLIST = [];

function runAudit() {
  // `--omit=dev` is deliberate: a lint-plugin advisory is not a production risk,
  // and mixing the two is how a real finding gets lost in the noise.
  //
  // Windows has no bare `npm` executable, only `npm.cmd`, and Node refuses to
  // spawn a `.cmd` directly. `shell: true` would work but concatenates the
  // arguments unescaped (Node warns about exactly that: DEP0190). Going through
  // `cmd.exe` with one literal command string avoids both problems.
  const isWindows = process.platform === "win32";
  const res = isWindows
    ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm audit --omit=dev --json"], {
        cwd: process.cwd(),
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      })
    : spawnSync("npm", ["audit", "--omit=dev", "--json"], {
        cwd: process.cwd(),
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });

  // npm exits 1 when it finds anything at all, which is the normal case here.
  if (res.error) {
    console.error(`[audit-gate] could not run npm audit: ${res.error.message}`);
    process.exit(2);
  }

  try {
    return JSON.parse(res.stdout);
  } catch {
    console.error("[audit-gate] npm audit did not return JSON:\n");
    console.error(res.stdout?.slice(0, 2000) ?? "(no stdout)");
    console.error(res.stderr?.slice(0, 2000) ?? "");
    process.exit(2);
  }
}

const audit = runAudit();
const counts = audit.metadata?.vulnerabilities ?? {};

// The decision itself lives in `audit-gate-lib.mjs` so it can be unit-tested
// without this file's `npm audit` call firing on import. See that module for why
// the two subtleties it encodes matter.
const findings = collectFindings(audit);
const { blocking, ignored, unlisted, stale } = evaluateFindings(findings, ALLOWLIST);

console.log(
  `[audit-gate] npm audit --omit=dev: ${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ` +
    `${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low`,
);

if (ignored.length) {
  console.log("[audit-gate] below the blocking threshold (informational):");
  for (const f of ignored) console.log(`  ${f.severity.padEnd(8)} ${f.package.padEnd(26)} ${f.title}`);
}

let failed = false;

if (unlisted.length) {
  failed = true;
  console.error("\n[audit-gate] FAIL — HIGH/CRITICAL advisories that are not allowlisted:\n");
  for (const f of unlisted) {
    console.error(`  ${f.severity.toUpperCase()}  ${f.package}  ${f.range}`);
    console.error(`    ${f.title}`);
    console.error(`    ${f.url}`);
    console.error(`    fix available: ${f.fixAvailable ? "yes" : "no"}\n`);
  }
  console.error(
    "  Fix it, or — only after confirming the vulnerable path is unreachable — add a\n" +
      "  reasoned entry to ALLOWLIST in scripts/audit-gate.mjs.\n",
  );
}

if (stale.length) {
  failed = true;
  console.error("\n[audit-gate] FAIL — allowlist entries that no longer match any advisory:\n");
  for (const a of stale) {
    console.error(`  ${a.package}  (added ${a.added})`);
    console.error(`    ${a.url}`);
  }
  console.error("\n  Good news: the advisory is gone. Delete the entry so the list stays honest.\n");
}

if (failed) process.exit(1);

console.log(
  blocking.length === 0
    ? "[audit-gate] OK — no HIGH or CRITICAL advisories in the production dependency tree."
    : `[audit-gate] OK — ${blocking.length} blocking advisor${blocking.length === 1 ? "y" : "ies"}, ` +
      `all allowlisted (${ALLOWLIST.length} reviewed exception${ALLOWLIST.length === 1 ? "" : "s"}).`,
);
