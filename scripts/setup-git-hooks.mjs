#!/usr/bin/env node
// scripts/setup-git-hooks.mjs
// ─── Install the committed pre-commit hook ────────────────────────────────────
// Git only ever runs hooks out of `.git/hooks`, which is not version-controlled.
// A hook that lives in the repository is therefore inert until something points
// git at it. That something is this script, and npm runs it automatically because
// it is wired to the `prepare` lifecycle script — `prepare` fires after both
// `npm install` and `npm ci`, so a fresh clone is protected without anyone
// reading the README.
//
// Deliberately a script rather than a dependency: husky would do the same job for
// the price of a package in every contributor's tree and a second `.husky/`
// directory. This is 30 lines and no supply chain.
//
// Run by hand with:  npm run hooks:install
//
// It never fails the install. A convenience hook is not worth breaking
// `npm install` over, so every error path exits 0 with a warning.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const HOOKS_DIR = ".githooks";

const root = path.resolve(import.meta.dirname, "..");

/** Run git, returning trimmed stdout or null when the command fails. */
function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function skip(reason) {
  console.log(`[hooks] skipped: ${reason}`);
  process.exit(0);
}

const hookPath = path.join(root, HOOKS_DIR, "pre-commit");

// CI has no working copy to protect — and `core.hooksPath` there would be
// meaningless. `npm ci` runs `prepare`, so this branch is hit on every CI run.
if (process.env.CI) skip("CI environment");
if (!existsSync(hookPath)) skip(`${HOOKS_DIR}/pre-commit is missing`);
if (git(["rev-parse", "--is-inside-work-tree"]) !== "true") skip("not a git work tree");

// On POSIX, git refuses to run a hook that is not executable: it prints a single
// warning and carries on with the commit. That is the exact failure this whole
// milestone is about — a control that silently does nothing — so the bit is
// committed as 100755 and re-asserted here for checkouts that lost it (a ZIP
// download, or a `core.fileMode` that does not track it). Windows has no execute
// bit at all, so there is nothing to set there.
if (process.platform !== "win32") {
  try {
    chmodSync(hookPath, 0o755);
  } catch {
    // Best effort: a hook we cannot mark executable is worth a warning, never a
    // failed `npm install`.
    console.warn(`[hooks] could not mark ${HOOKS_DIR}/pre-commit executable`);
  }
}

const current = git(["config", "--get", "core.hooksPath"]);

// Refuse to clobber. If someone has pointed git at husky, or at their own hooks
// directory, overwriting it would silently disable *their* tooling.
if (current && current !== HOOKS_DIR) {
  skip(`core.hooksPath is already set to "${current}" — leaving it alone`);
}

if (current === HOOKS_DIR) {
  console.log(`[hooks] already installed (core.hooksPath=${HOOKS_DIR})`);
  process.exit(0);
}

if (git(["config", "core.hooksPath", HOOKS_DIR]) === null) {
  skip("could not set core.hooksPath");
}

console.log(`[hooks] installed: pre-commit secret scan (core.hooksPath=${HOOKS_DIR})`);
