import { describe, expect, it, vi } from "vitest";

// `authz.ts` imports the database layer, and `src/db/index.ts` eagerly creates a
// Neon client from DATABASE_URL. Stub both out so the pure authorization policy
// can be tested without a database or a Clerk session.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { hasReviewerRole, requireSession, REVIEWER_ROLES } from "@/lib/authz";

const authMock = vi.mocked(auth);

// The M2 decision: reviewer access is decided purely by `users.role`. The old
// hardcoded password and the "top 3 by season points" shortcut are gone, and
// nothing may quietly re-open them.
describe("hasReviewerRole", () => {
  it("allows moderators and admins", () => {
    expect(hasReviewerRole("moderator")).toBe(true);
    expect(hasReviewerRole("admin")).toBe(true);
  });

  it("denies every non-reviewer role", () => {
    for (const role of ["guest", "student", "contributor"]) {
      expect(hasReviewerRole(role)).toBe(false);
    }
  });

  it("denies unexpected or spoofed values by default", () => {
    for (const role of ["", " ", "MODERATOR", "moderator ", "admin ", "superadmin", "root", "any", "__proto__"]) {
      expect(hasReviewerRole(role)).toBe(false);
    }
  });

  it("keeps the allowlist tight", () => {
    expect([...REVIEWER_ROLES].sort()).toEqual(["admin", "moderator"]);
  });
});

// The cheap guard. Routes that need *a* session but not the user row (a download
// counter, a public count) used to trust src/proxy.ts alone — which failed open
// the moment the proxy file was misplaced. This one refuses an anonymous caller
// without paying for a query, so there is no longer a reason to skip it.
describe("requireSession", () => {
  it("answers 401 when there is no session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const result = await requireSession();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns the Clerk id, never a database id", async () => {
    authMock.mockResolvedValue({ userId: "clerk_abc" } as never);

    await expect(requireSession()).resolves.toEqual({ ok: true, clerkId: "clerk_abc" });
  });
});
