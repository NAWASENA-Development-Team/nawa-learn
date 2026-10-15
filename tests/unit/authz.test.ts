import { describe, expect, it, vi } from "vitest";

// `authz.ts` imports the database layer, and `src/db/index.ts` eagerly creates a
// Neon client from DATABASE_URL. Stub both out so the pure authorization policy
// can be tested without a database or a Clerk session.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { hasReviewerRole, REVIEWER_ROLES } from "@/lib/authz";

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
