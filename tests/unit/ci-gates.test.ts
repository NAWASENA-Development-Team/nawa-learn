// tests/unit/ci-gates.test.ts
// ─── The gates M10 added must stay gates ──────────────────────────────────────
// This is a test about the CI workflow, which is an odd thing to unit test. It
// earns its place the same way `proxy-location.test.ts` does: the thing being
// protected fails *silently*. A deleted CI step does not break the build, does not
// break a test, and does not warn — it just stops running, and the repository
// looks exactly as healthy as before.
//
// That is not hypothetical here. The deny-by-default proxy was dead code from M1
// to M9 while CI stayed green (C6). M10's whole purpose is to make that class of
// failure visible, so the controls it adds are pinned in place.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

const ci = read(".github/workflows/ci.yml");
const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

/**
 * The workflow's executable content, with `#` comment lines removed.
 *
 * Needed because this file's comments *name* the things the assertions forbid —
 * the note explaining why `middleware-manifest.json` is not evidence would
 * otherwise trip the very check that says not to use it.
 */
const ciBody = ci
  .split(/\r?\n/)
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");

describe("CI workflow", () => {
  it("runs a secret scan over the full history", () => {
    // The repository is public: a committed credential is a published one, and
    // deleting the file afterwards does not unpublish it.
    expect(ci).toMatch(/gitleaks/i);
    expect(ci).toMatch(/fetch-depth:\s*0/);
  });

  it("installs gitleaks itself rather than using gitleaks-action", () => {
    // `gitleaks/gitleaks-action` gates on the repository *owner's* type, not on
    // visibility: for an Organization owner it exits 1 unless a
    // `GITLEAKS_LICENSE` secret exists. This repository's owner is an
    // organization, so the action would have failed on its very first run — and
    // a secret-scan job that fails for a licensing reason is a job somebody
    // disables. Pinned here so it is not reintroduced by someone who reads the
    // action's "free for public repositories" summary and believes it.
    expect(ciBody).not.toMatch(/gitleaks\/gitleaks-action/);
    expect(ciBody).toMatch(/scripts\/secret-scan\.mjs/);
  });

  it("verifies the checksum of the scanner it downloads", () => {
    // The job downloads a binary from the internet and then trusts its verdict.
    // The download is the one step that must not go unverified.
    expect(ci).toMatch(/GITLEAKS_SHA256:/);
    expect(ciBody).toMatch(/sha256sum -c -/);
  });

  it("installs with `npm ci`, so the lockfile is the contract", () => {
    expect(ciBody).toMatch(/run:\s*npm ci\b/);
    expect(ciBody).not.toMatch(/run:\s*npm install\b/);
  });

  it("gates on dependency advisories", () => {
    expect(ciBody).toMatch(/npm run audit:gate/);
  });

  it("proves the build registered the proxy", () => {
    // The only build-time signal that the proxy is live.
    expect(ciBody).toMatch(/Proxy \(Middleware\)/);
  });

  it("never reaches for middleware-manifest.json as evidence", () => {
    // On Next 16 + Turbopack it stays `{"middleware":{}}` whether or not the
    // proxy runs, so an empty manifest proves nothing — and a CI check written
    // against it would fail open.
    expect(ciBody).not.toMatch(/middleware-manifest/);
  });

  it("proves the proxy answers at runtime, not merely that it exists", () => {
    expect(ciBody).toMatch(/npm run verify:proxy/);
  });

  it("does not swallow a failing build through the tee pipe", () => {
    // `npm run build | tee build.log` reports tee's exit status, so a failed
    // build would pass the step and the grep below would then fail confusingly.
    expect(ciBody).toMatch(/set -o pipefail/);
  });

  it("holds no repository secret, so an unset one cannot redden every run", () => {
    // This is the M10 lesson, and it is the opposite of the usual one. The
    // workflow handed the Build step and the runtime proxy probe
    // `secrets.DATABASE_URL` and the two `secrets.CLERK_*`. Those secrets were
    // never configured on the repository, so *every* run from M5 — when the
    // workflow landed — to M10 died at the Build step, and the two proxy gates
    // above never executed once. CI has never been green here.
    //
    // Nothing in the job needs a credential: the build only *evaluates* modules
    // (`neon()` throws on an absent or unparseable URL, but nothing connects), and
    // the runtime probe is refused with 401 before any route, query or Clerk call
    // runs. So the job is hermetic on purpose, and a missing secret can never be
    // the reason it fails again.
    expect(ciBody).not.toMatch(/secrets\./);
  });
});

describe("the scripts those steps call", () => {
  // A CI step that points at a script which no longer exists fails loudly, so
  // this is mostly about the *local* entry points staying available.
  it.each([
    ["audit:gate", "scripts/audit-gate.mjs"],
    ["secrets:scan", "scripts/secret-scan.mjs"],
    ["verify:proxy", "scripts/verify-proxy.mjs"],
    ["hooks:install", "scripts/setup-git-hooks.mjs"],
    ["prepare", "scripts/setup-git-hooks.mjs"],
  ])("`npm run %s` resolves to an existing file", (script, file) => {
    expect(pkg.scripts[script]).toContain(file);
    expect(existsSync(path.join(root, file))).toBe(true);
  });

  it("ships a committed pre-commit hook and a way to install it", () => {
    // Git only runs hooks from `.git/hooks`, which is not version-controlled, so
    // a committed hook is inert without `core.hooksPath`.
    expect(existsSync(path.join(root, ".githooks/pre-commit"))).toBe(true);
    expect(pkg.scripts.prepare).toContain("setup-git-hooks");
  });

  it("commits the pre-commit hook as an executable LF script", () => {
    // Two ways a committed hook stops running without anyone noticing, neither
    // of which shows up in a diff:
    //
    //   • POSIX git refuses to run a hook that lacks the execute bit. It prints
    //     one warning and lets the commit through. Windows cannot set that bit
    //     at all, so it has to be recorded in the index as 100755 — a
    //     `chmodSync` in the installer cannot help a fresh Linux or macOS clone,
    //     because the installer runs only after the hook would be needed.
    //   • A CRLF shebang (`#!/usr/bin/env sh\r`) is not a shebang; the
    //     interpreter is looked up under the literal name `sh\r` and the hook
    //     dies on line 1. `core.autocrlf=true` is the Windows default and git
    //     for Windows runs hooks through its bundled `sh`, so `.gitattributes`
    //     has to force `eol=lf` for the hooks directory.
    //
    // Both are the C6 failure shape — a control that is present, documented and
    // green, but silently not running — so both are asserted here.
    const indexEntry = execFileSync("git", ["ls-files", "-s", ".githooks/pre-commit"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(indexEntry).toMatch(/^100755 /);
    expect(read(".gitattributes")).toMatch(/^\.githooks\/\*\s+text\s+eol=lf\s*$/m);
  });
});

describe("the secret-scan wrapper", () => {
  it("refuses to report a clean scan when it could not run in CI", () => {
    // On a developer machine a missing scanner warns and exits 0 — correct,
    // because a contributor without gitleaks must not be blocked. In CI that same
    // branch makes "the scan never ran" indistinguishable from "the scan found
    // nothing": the job goes green either way. That is the shape of C8 — the
    // `Secret scan` job was green on every run while the `verify` job was red,
    // and nothing from outside could tell a skip from a pass.
    const wrapper = read("scripts/secret-scan.mjs");
    expect(wrapper).toMatch(/process\.env\.CI\b/);
    // Both skip branches — no binary, and a binary too old to trust — must be
    // gated on `inCi` before they may exit 0.
    expect(wrapper.match(/if \(inCi\) \{/g) ?? []).toHaveLength(2);
  });
});

describe("dependency hygiene config", () => {
  it("has a Dependabot config covering npm and the actions themselves", () => {
    const dependabot = read(".github/dependabot.yml");
    expect(dependabot).toMatch(/package-ecosystem:\s*npm/);
    // `actions/checkout@v4` is executable code from a third party with its own
    // supply chain; it needs watching too.
    expect(dependabot).toMatch(/package-ecosystem:\s*github-actions/);
  });

  it("scopes the secret scanner with an explicit allowlist file", () => {
    expect(existsSync(path.join(root, ".gitleaks.toml"))).toBe(true);
  });

  it("keeps the gitleaks allowlist free of path exemptions", () => {
    // A `paths` entry silences every rule for a whole file, so it is a blind
    // spot by construction. The first version of this config exempted
    // `docs/AUDIT-AND-ROADMAP.md` and `docs/archive/`, which are precisely the
    // files most likely to receive a pasted credential — and running the real
    // binary against the real history showed both entries suppressed nothing.
    // A blind spot that suppresses nothing is pure cost, so the list is regexes
    // only, and this test keeps it that way.
    const gitleaks = read(".gitleaks.toml");
    expect(gitleaks).not.toMatch(/^\s*paths\s*=/m);
  });
});
