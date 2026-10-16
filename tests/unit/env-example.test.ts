// tests/unit/env-example.test.ts
// ─── The template must not drift from the code ────────────────────────────────
// M10 added `.env.example` because the README's setup instructions were a lie:
// it told a new contributor to run `npm install && npm run dev`, which throws
// without `DATABASE_URL`. A template is only useful if it is *complete*, and the
// way it stops being complete is silent — someone adds
// `process.env.NEW_THING` to a route and nothing anywhere notices that the
// documented setup no longer works.
//
// So this test reads every environment variable the code actually references —
// across the whole repository, not just `src/` — and asserts the template
// mentions each one. It is the same shape as `proxy-location.test.ts`: a
// filesystem assertion guarding an invisible failure.
//
// Nothing the *app* configures is exempt. `NODE_ENV` and `ALLOW_SEED` are
// checked like every other variable; they pass because the template genuinely
// mentions them — `NODE_ENV` as prose explaining that Next.js sets it,
// `ALLOW_SEED` as a commented assignment showing the opt-in. The only names
// skipped are the platform's own (`PLATFORM_VARS` below), and that list is
// pinned by a test and cross-checked against the template so it cannot grow
// into a place where real configuration hides.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/**
 * Directories that hold code but never application configuration. Dependencies
 * and build output are skipped because a minified bundle mentions plenty of
 * variables that are none of this test's business; `tests/` is skipped because a
 * test supplies its own environment.
 */
const SKIP_DIRS = new Set(["node_modules", ".next", ".vercel", "coverage", ".git", "tests"]);

/**
 * Variables the *platform* provides — the OS shell path, a Windows install root,
 * a CI marker. The app reads them, but nobody running Nawa Learn configures
 * them, so they deliberately do not belong in `.env.example`.
 *
 * Kept as an explicit list, and pinned by the test below, so that adding a fifth
 * is a reviewable edit rather than a quiet widening of what this test is willing
 * to ignore. The one thing this list must never do is excuse a variable the
 * template *does* document.
 */
const PLATFORM_VARS = new Set(["CI", "ComSpec", "LOCALAPPDATA", "ProgramFiles"]);

/** Every file under the repository with a JS/TS extension. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) return [];
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx|mjs|cjs|js)$/.test(entry) ? [full] : [];
  });
}

/** `process.env.X` and `process.env["X"]` both count. */
function envVarsIn(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) found.push(m[1]);
  for (const m of source.matchAll(/process\.env\[["']([A-Za-z_][A-Za-z0-9_]*)["']\]/g)) found.push(m[1]);
  return found;
}

const referenced = [
  ...new Set(
    walk(root).flatMap((file) => envVarsIn(readFileSync(file, "utf8"))),
  ),
]
  .filter((name) => !PLATFORM_VARS.has(name))
  .sort();

const template = readFileSync(path.join(root, ".env.example"), "utf8");

// A variable counts as documented when its name appears as a whole word —
// either as an assignment or in a `#` comment. Mentioning is enough, because the
// template deliberately shows `NODE_ENV` as prose rather than a value to set.
// The word boundaries matter: without them `NODE` would be "documented" by
// `NODE_ENV`, and the test would stop noticing a genuinely missing variable.
const documented = (name: string) => new RegExp(`\\b${name}\\b`).test(template);

describe(".env.example", () => {
  it("exists and is not ignored by .gitignore", () => {
    // `.gitignore` carries `.env*`, which swallows the template too. The fix is a
    // `!.env.example` negation — a line that is very easy to delete by accident.
    const ignore = readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(ignore).toMatch(/^!\.env\.example$/m);
  });

  it("finds a plausible number of variables to check (guards the parser)", () => {
    // If the regexes above ever stop matching, the test below would pass
    // vacuously. This pins that the walk still sees the app's real variables.
    expect(referenced.length).toBeGreaterThanOrEqual(8);
    expect(referenced).toContain("DATABASE_URL");
    expect(referenced).toContain("CLERK_SECRET_KEY");
  });

  it("reads root config and scripts too, not just src/", () => {
    // The walk used to cover `src/**` only, which silently excluded
    // `drizzle.config.ts` — the file that decides where migrations run, and the
    // one whose `DATABASE_URL` a contributor hits first. Widening the walk is
    // only half the fix: without this, a later `SKIP_DIRS` or extension tweak
    // could narrow it again and nothing would fail.
    expect(referenced).toContain("NODE_ENV"); // read by next.config.ts
    expect(PLATFORM_VARS.has("ComSpec")).toBe(true); // read by scripts/audit-gate.mjs
  });

  it("keeps the platform-variable exemption list to a known, explicit set", () => {
    // A deliberate change detector. `PLATFORM_VARS` is the one hole in the
    // sweep below, so adding to it has to be an edit a reviewer sees — the same
    // discipline as the audit-gate allowlist, where an exemption nobody notices
    // is a blind spot rather than a decision.
    expect([...PLATFORM_VARS].sort()).toEqual([
      "CI",
      "ComSpec",
      "LOCALAPPDATA",
      "ProgramFiles",
    ]);
  });

  it("never exempts a variable the template actually documents", () => {
    // The exemption may only excuse platform plumbing. If one of those names
    // ever became real configuration, the sweep below would quietly stop
    // checking it — so the overlap is asserted to be empty rather than assumed.
    for (const name of PLATFORM_VARS) expect(documented(name)).toBe(false);
  });

  it.each(referenced)("documents %s", (name) => {
    expect(
      documented(name),
      `${name} is read by the app but missing from .env.example — add it, with a ` +
        `note on whether it is required, optional, or platform-injected.`,
    ).toBe(true);
  });

  it("holds no real-looking credential", () => {
    // The template is committed to a public repository. Placeholders only.
    expect(template).not.toMatch(/sk_(live|test)_[A-Za-z0-9]{16,}/);
    expect(template).not.toMatch(/pk_(live|test)_[A-Za-z0-9]{16,}/);
    expect(template).not.toMatch(/whsec_[A-Za-z0-9]{16,}/);
    expect(template).not.toMatch(/vercel_blob_rw_[A-Za-z0-9]{16,}/);
    expect(template).not.toMatch(/postgresql:\/\/[^"'$\s<>]*:[^"'$\s@<>]{12,}@/);
  });
});
