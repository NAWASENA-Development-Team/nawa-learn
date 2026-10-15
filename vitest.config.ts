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
    // Integration tests boot a real Postgres (PGlite) for each file, which is
    // slower than a unit test on a cold CI runner.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      // The rules live in src/lib; the routes are covered by the integration
      // suite, so both are measured.
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      reporter: ["text", "lcov"],
    },
  },
});
