import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated output: coverage reports are build artefacts, not source.
    // They are gitignored too, but ESLint still walks them otherwise.
    "coverage/**",
    ".vitest/**",
    // Local agent tooling (skills ship their own bundled JS). Not our source,
    // not shipped, not reviewable — linting it produced 94 of the 129 warnings
    // in the M14 baseline and drowned the ones that mattered.
    ".opencode/**",
  ]),
  {
    rules: {
      // M14: `any` is now an error rather than a warning, so a new one fails CI
      // instead of accumulating. Every remaining site was a real type hole
      // (an avatar shape that carried `emoji` on some rows and `svg` on others).
      "@typescript-eslint/no-explicit-any": "error",
      // M14: server code must go through `src/lib/logger.ts`. AGENTS.md has said
      // so since M6, but nothing enforced it, and a server component was still
      // printing a raw database error with `console.error`. Client components and
      // CLI scripts are exempted below — the browser console and a terminal are
      // the correct sinks there, and there is no logger to route to.
      "no-console": "error",
    },
  },
  {
    files: [
      // The sink itself.
      "src/lib/logger.ts",
      // CLI scripts: stdout/stderr *is* the interface.
      "src/db/seed.ts",
      "src/db/promote.ts",
      "scripts/**/*.mjs",
      // Browser components: `console.error` in a catch block is the only sink
      // available, and it never reaches a server log line.
      "src/components/**/*.tsx",
      // Tests: stdout is how a failing assertion explains itself, and a test
      // never runs inside a request that has a `requestId` to bind.
      "tests/**/*.ts",
      // Client pages (`"use client"`), same reason.
      "src/app/(dashboard)/moderator/page.tsx",
      "src/app/(dashboard)/questions/practice/page.tsx",
    ],
    rules: {
      "no-console": "off",
    },
  },
]);

export default eslintConfig;
