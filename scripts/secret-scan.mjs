#!/usr/bin/env node
// scripts/secret-scan.mjs
// ─── gitleaks wrapper that degrades gracefully ────────────────────────────────
// gitleaks is a Go binary, not an npm package, so it cannot be a dependency that
// `npm install` guarantees. This wrapper therefore does three things the raw
// binary cannot:
//
//   1. It finds gitleaks wherever it happens to live (PATH, or the usual Windows
//      install locations) and, if it is genuinely absent, says so clearly and
//      exits 0 — a missing scanner must not block a commit. That grace period is
//      for *developer machines only*: in CI a missing scanner is a hard failure,
//      because "the scan did not run" and "the scan found nothing" are otherwise
//      indistinguishable from the outside, and a secret-scan job that quietly
//      does nothing is worse than no job at all. CI installs gitleaks, so CI
//      never legitimately takes that branch.
//   2. It picks the subcommand syntax from the scanner's *version*, not from its
//      exit code. v8.19 renamed `protect`/`detect` to `git`/`dir`, and the two
//      are indistinguishable by exit status: gitleaks reports "leaks found" and
//      "unknown command" with the same code (1). Trying the modern spelling and
//      falling back on a non-zero status therefore reads a syntax error as a
//      finding, and blocks a commit while accusing the author of a leak they do
//      not have. Anything older than 8.19 is skipped instead, loudly.
//   3. It always passes `--config` explicitly and `--redact`. Redaction matters:
//      without it a finding prints the secret itself, and in CI that lands the
//      very value we are trying to contain in a public build log.
//
// Usage:
//   node scripts/secret-scan.mjs            # scan the whole history (CI / manual)
//   node scripts/secret-scan.mjs --staged   # scan only what is staged (pre-commit)
//
// Note: never scan the working tree with `gitleaks dir`. It does not honour
// `.gitignore`, so it reads `.env.local` and `.next/` and reports the *live*
// credentials as findings — technically true, and useless, because those files
// are exactly the ones that must not be committed. History is the thing to scan.
//
// Exit codes:
//   0  clean (or, on a developer machine only, the scanner is missing / too old)
//   1  a secret was found
//   2  the scanner is installed but could not be run, or it is missing or too old
//      while running in CI

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

// `git`/`dir` and `--staged` landed in 8.19. Below that the wrapper refuses to
// guess; CI pins a known-good version, so the gate is never skipped there.
const MIN_MAJOR = 8;
const MIN_MINOR = 19;

const staged = process.argv.includes("--staged");
const root = path.resolve(import.meta.dirname, "..");

// GitHub Actions sets `CI=true` for every step. That single signal is enough:
// nobody is watching a terminal, and a skip would look exactly like a pass.
// (Deliberately not also `GITHUB_ACTIONS`: it would be a second platform-injected
// name in the `env-example` sweep for no extra information.)
const inCi = Boolean(process.env.CI);

/**
 * Where a gitleaks binary might be. PATH first, then the places Windows
 * installers and the common Unix package managers put it.
 */
function candidates() {
  return [
    "gitleaks",
    path.join(process.env.LOCALAPPDATA ?? "", "Programs", "gitleaks", "gitleaks.exe"),
    path.join(process.env.ProgramFiles ?? "", "gitleaks", "gitleaks.exe"),
    "/usr/local/bin/gitleaks",
    "/opt/homebrew/bin/gitleaks",
  ].filter(Boolean);
}

/** `gitleaks version` prints a bare semver; anything else is not usable. */
function versionOf(bin) {
  const res = spawnSync(bin, ["version"], { encoding: "utf8", shell: false });
  if (res.error || res.status !== 0) return null;

  const match = /(\d+)\.(\d+)\.(\d+)/.exec(res.stdout ?? "");
  if (!match) return null;

  return { major: Number(match[1]), minor: Number(match[2]), raw: match[0] };
}

function isSupported(version) {
  if (version.major !== MIN_MAJOR) return version.major > MIN_MAJOR;
  return version.minor >= MIN_MINOR;
}

let found = null;
for (const candidate of candidates()) {
  const version = versionOf(candidate);
  if (version) {
    found = { bin: candidate, version };
    break;
  }
}

if (!found) {
  if (inCi) {
    console.error(
      "[secret-scan] gitleaks is not installed, and this is CI — refusing to report a clean scan.\n" +
        "              The workflow installs gitleaks itself, so this means the install step broke.\n" +
        "              Fix the install: a scanner that silently does not run looks exactly like a\n" +
        "              repository with no secrets in it.",
    );
    process.exit(2);
  }

  console.warn(
    "[secret-scan] gitleaks is not installed — skipping.\n" +
      "              install it to scan locally: https://github.com/gitleaks/gitleaks#installing\n" +
      "              (CI runs it on every push and pull request regardless, and will not skip.)",
  );
  process.exit(0);
}

if (!isSupported(found.version)) {
  if (inCi) {
    console.error(
      `[secret-scan] gitleaks ${found.version.raw} is older than ${MIN_MAJOR}.${MIN_MINOR}, and this is CI.\n` +
        "              Bump GITLEAKS_VERSION in .github/workflows/ci.yml — but run the new version\n" +
        "              against this repository's history first, so the change is deliberate.",
    );
    process.exit(2);
  }

  console.warn(
    `[secret-scan] gitleaks ${found.version.raw} is older than ${MIN_MAJOR}.${MIN_MINOR} — skipping.\n` +
      `              ${found.version.raw} has no \`git\` subcommand, and its exit codes cannot be told\n` +
      "              apart from a real finding. Upgrade gitleaks; CI pins a supported version.",
  );
  process.exit(0);
}

const args = [
  "git",
  ...(staged ? ["--staged"] : []),
  "--redact",
  "--verbose",
  "--no-banner",
  "--config",
  path.join(root, ".gitleaks.toml"),
];

const res = spawnSync(found.bin, args, { cwd: root, encoding: "utf8", shell: false });

if (res.error) {
  console.error(`[secret-scan] could not run ${found.bin}: ${res.error.message}`);
  process.exit(2);
}

if (res.stdout) process.stdout.write(res.stdout);
if (res.stderr) process.stderr.write(res.stderr);

if (res.status === 0) process.exit(0);

if (res.status === 1) {
  console.error(
    staged
      ? "\n[secret-scan] Commit refused: gitleaks found a secret in the staged changes."
      : "\n[secret-scan] gitleaks found a secret in the repository history.",
  );
  process.exit(1);
}

// Anything else is the scanner failing, not a finding. Say so distinctly: a
// broken scanner must never be mistaken for a clean repository.
console.error(
  `[secret-scan] gitleaks ${found.version.raw} exited ${res.status} — that is a scanner failure, not a finding.`,
);
process.exit(2);
