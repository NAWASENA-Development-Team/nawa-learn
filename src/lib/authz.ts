// src/lib/authz.ts
// ─── Centralized authorization ────────────────────────────────────────────────
// Single source of truth for "who may do what".
//
// Every API route that touches protected data goes through these helpers instead
// of calling `auth()` ad-hoc, so a role check can never be silently forgotten.
// This is deliberately *separate* from src/proxy.ts: the proxy only answers
// "is there a session?"; fine-grained roles/ownership are decided here, close to
// the data.
//
// Usage:
//
//   const authz = await requireModerator();
//   if (!authz.ok) return authz.response;
//   const reviewer = authz.user;   // provisioned DB user, role already verified

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export type Role = "guest" | "student" | "contributor" | "moderator" | "admin";

/** The only roles allowed to review content and read moderation queues. */
export const REVIEWER_ROLES: readonly Role[] = ["moderator", "admin"];

export type SessionUser = {
  id: string;
  clerkId: string;
  name: string;
  role: Role;
  points: number;
};

export type AuthzOk = { ok: true; user: SessionUser };
export type AuthzFail = { ok: false; response: NextResponse };
export type AuthzResult = AuthzOk | AuthzFail;

/**
 * Pure predicate, exported so it can be unit-tested without Clerk or a database.
 */
export function hasReviewerRole(role: string): boolean {
  return (REVIEWER_ROLES as readonly string[]).includes(role);
}

/**
 * Resolve the current Clerk session into a provisioned row in `users`.
 *
 * - No session        → 401 (not signed in)
 * - Session, no DB row → 403 (signed in but the Clerk webhook has not synced yet)
 */
export async function requireUser(): Promise<AuthzResult> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    columns: { id: true, clerkId: true, name: true, role: true, points: true },
  });

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "User profile not synced. Please sign out and sign in again." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user };
}

/**
 * Requires an authenticated, provisioned user whose role is listed in `roles`.
 *
 * - Not signed in        → 401
 * - Role not permitted   → 403
 */
export async function requireRole(roles: readonly Role[]): Promise<AuthzResult> {
  const result = await requireUser();
  if (!result.ok) return result;

  if (!roles.includes(result.user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}

/** Requires a moderator or an admin. */
export function requireModerator(): Promise<AuthzResult> {
  return requireRole(REVIEWER_ROLES);
}
