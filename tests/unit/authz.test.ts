import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { withoutComments } from "../helpers/source";

// `authz.ts` imports the database layer, and `src/db/index.ts` eagerly creates a
// Neon client from DATABASE_URL. Stub both out so the pure authorization policy
// can be tested without a database or a Clerk session.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { hasReviewerRole, requireSession, REVIEWER_ROLES } from "@/lib/authz";

const authMock = vi.mocked(auth);

const root = process.cwd();

// The M2 decision: reviewer access is decided purely by `users.role`. The old
// hardcoded password and the old "top 3 by season points" *lookup* are gone, and
// nothing may quietly re-open either.
//
// M16 did not reopen the second one. A Dewan Podium seat is a reviewer because
// the season cron wrote `users.role`; `authz.ts` still reads that column and
// nothing else. The difference is visible in the data: `season_role_key` records
// *why* the role was granted, and a key from a past season stops counting the
// moment the calendar turns (`isSeatActive()`). So the ranking is never consulted
// at authorization time — a permission check that reads the leaderboard would
// grant a seat to whoever happens to be on top of a query, including a row whose
// points have not been reset yet.
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

// ─── `requireModerator` tidak boleh kembali ───────────────────────────────────
//
// M16 memecah satu penjaga menjadi dua: `requireReviewer` (staf manusia **dan**
// kursi musim) dan `requireHumanReviewer` (staf manusia saja). `requireModerator`
// dihapus, bukan dialiaskan — alias adalah cara termudah bagi route baru untuk
// memakai penjaga yang lebih lebar dari yang dimaksud, dan tidak ada satu pun
// pesan galat yang akan memberi tahu bahwa itu terjadi.
//
// Yang dipindai adalah **kode**, bukan komentar: `withoutComments()` lebih dulu,
// supaya penjelasan tentang kenapa nama itu dihapus tidak terbaca sebagai
// pemakaiannya. Tanpa itu, cara termudah membuat tes ini hijau adalah menghapus
// penjelasannya — persis kebalikan dari yang diinginkan.
describe("the deleted requireModerator guard", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
  }

  it("is not exported from authz.ts", () => {
    const source = withoutComments(readFileSync(path.join(root, "src/lib/authz.ts"), "utf8"));
    expect(source).not.toMatch(/export\s+(async\s+)?function\s+requireModerator\b/);
    expect(source).not.toMatch(/export\s+const\s+requireModerator\b/);
  });

  it("is called nowhere in src/, not even as an alias", () => {
    const offenders = sourceFiles(path.join(root, "src"))
      .filter((file) => withoutComments(readFileSync(file, "utf8")).includes("requireModerator"))
      .map((file) => path.relative(root, file));

    expect(
      offenders,
      "requireModerator was deleted in M16. Use requireReviewer (human staff + " +
        "season seats) or requireHumanReviewer (human staff only).",
    ).toEqual([]);
  });
});
