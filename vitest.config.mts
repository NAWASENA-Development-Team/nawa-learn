import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias from tsconfig.json so tests import the same
    // way application code does.
    alias: { "@": srcDir },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Resets the in-memory rate-limit counters before every test; see the file.
    setupFiles: ["tests/setup.ts"],
    // Integration tests boot a real Postgres (PGlite) for each file, which is
    // slower than a unit test on a cold CI runner.
    testTimeout: 30_000,
    // `createTestDb()` starts a whole Postgres compiled to WASM, once per
    // integration file. Measured on a 2-core machine *with* v8 coverage
    // instrumentation, that single `beforeAll` costs around 50 seconds — so the
    // old 60s ceiling sat within the noise and failed intermittently, on a
    // different file each run. A hook timeout is there to catch a hang, not to
    // enforce a performance budget, and a gate that fails at random is a gate
    // people learn to re-run instead of read.
    //
    // Raising it here was only half the fix: every integration file also passed
    // an explicit `60_000` to its own `beforeAll`, and a per-call timeout beats
    // this one without a word. So the number below was not in force anywhere
    // until those literals were deleted. Do not put one back —
    // `tests/unit/ci-gates.test.ts` fails if any test file hard-codes a timeout.
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      // The rules live in src/lib; the routes are covered by the integration
      // suite, so both are measured.
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      reporter: ["text", "lcov"],
    },
  },
});
