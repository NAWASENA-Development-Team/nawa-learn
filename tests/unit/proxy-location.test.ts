// tests/unit/proxy-location.test.ts
// ─── A tripwire for a silent, eight-milestone outage ─────────────────────────
// Next.js resolves file conventions (`proxy.ts`, `instrumentation.ts`, …)
// **relative to the directory that holds `app`/`pages`**. This project keeps its
// app at `src/app`, so the convention directory is `src/`.
//
// Getting this wrong does not fail the build, does not fail typechecking, and
// does not warn. The file simply never runs. That is exactly what happened here:
// `proxy.ts` sat at the repo root from M1 to M9, so the deny-by-default auth
// gate, the CSRF guard, and the CSP were all dead code while eight milestones of
// documentation described them as working (see C6 in docs/AUDIT-AND-ROADMAP.md).
//
// Note what is deliberately *not* asserted here: `middleware-manifest.json`. On
// Next 16 + Turbopack it stays `{"middleware":{}}` whether or not the proxy is
// live, so it is not evidence of anything. The real signals are the build's
// `ƒ Proxy (Middleware)` line and runtime behaviour — neither of which a unit
// test can reach. This test only closes the filesystem side.
//
// A filesystem assertion is an unusual thing to put in a test suite. It earns
// its place because the failure mode is *invisible*: nothing else in this suite,
// and nothing in `next build`, can see it. If this test ever fails, do not
// "fix" it by editing the path — move the file.
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const exists = (relative: string) => existsSync(path.join(root, relative));

describe("Next.js file-convention locations", () => {
  it("keeps the app under src/, which is the premise of every assertion below", () => {
    expect(exists("src/app/layout.tsx")).toBe(true);
  });

  it("places the proxy where Next will actually load it (src/proxy.ts)", () => {
    expect(exists("src/proxy.ts")).toBe(true);
  });

  it("leaves no proxy at the repo root, where Next would silently ignore it", () => {
    expect(exists("proxy.ts")).toBe(false);
    expect(exists("proxy.js")).toBe(false);
  });

  it("leaves no deprecated middleware file behind (Next 16 renamed it to proxy)", () => {
    expect(exists("middleware.ts")).toBe(false);
    expect(exists("src/middleware.ts")).toBe(false);
  });
});
