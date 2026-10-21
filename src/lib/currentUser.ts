// src/lib/currentUser.ts
// ─── The signed-in user, resolved once per request ───────────────────────────
// Layouts are server components, so they cannot use `requireUser()`: that helper
// returns a `Response`, and a layout has no way to return one. They also cannot
// call `auth()` and then query `users` themselves, because more than one layout
// runs per request — the root layout renders the Navbar, and the dashboard layout
// enforces consent — and two independent lookups would mean two round trips to
// Neon for the same row.
//
// `cache()` from React makes the lookup request-scoped: the first caller pays for
// the query, every later caller in the same render pass gets the same promise.
// React 19 guarantees this only within one request, which is exactly the lifetime
// we want — a role change must be visible on the next navigation, not cached for
// minutes.
//
// Anonymous visitors cost nothing: `getSessionUserId()` returns null and the
// query never runs.
//
// This is deliberately *not* used by API routes. `requireUser()` owns that path
// and returns the 401/403 responses the routes need; sharing an implementation
// between a function that throws and one that returns a Response would only make
// both harder to reason about.
import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/lib/authz";

export type CurrentUser = {
  id: string;
  name: string;
  role: Role;
  /** Non-null when `role` came from the season podium rather than `db:promote`. */
  seasonRoleKey: string | null;
  /** Null for an account that has never accepted the current policy version. */
  consentPolicyVersion: string | null;
};

/**
 * The Clerk id of the current session, or null. Cached so `getCurrentUser()`
 * does not read the session headers a second time.
 */
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const { userId } = await auth();
  return userId;
});

/**
 * The provisioned `users` row for the current session, or null when there is no
 * session *or* no row (the Clerk webhook has not synced yet).
 *
 * Callers that must tell those two states apart call `getSessionUserId()` first —
 * the dashboard layout does, because "no session" redirects to sign-in while
 * "no row" redirects to consent.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const clerkId = await getSessionUserId();
  if (!clerkId) return null;

  const row = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    columns: {
      id: true,
      name: true,
      role: true,
      seasonRoleKey: true,
      consentPolicyVersion: true,
    },
  });

  return row ?? null;
});
