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
//   const authz = await requireReviewer();
//   if (!authz.ok) return authz.response;
//   const reviewer = authz.user;   // provisioned DB user, role already verified

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSeasonKey } from "@/lib/season";

export type Role = "guest" | "student" | "contributor" | "moderator" | "admin";

/** The only roles allowed to review content and read moderation queues. */
export const REVIEWER_ROLES: readonly Role[] = ["moderator", "admin"];

export type SessionUser = {
  id: string;
  clerkId: string;
  name: string;
  role: Role;
  points: number;
  /** Non-null when `role` was granted by the season podium, not by a human. */
  seasonRoleKey: string | null;
};

export type AuthzOk = { ok: true; user: SessionUser };
export type AuthzFail = { ok: false; response: NextResponse };
export type AuthzResult = AuthzOk | AuthzFail;

export type SessionOk = { ok: true; clerkId: string };
export type SessionResult = SessionOk | AuthzFail;

/**
 * Pure predicate, exported so it can be unit-tested without Clerk or a database.
 */
export function hasReviewerRole(role: string): boolean {
  return (REVIEWER_ROLES as readonly string[]).includes(role);
}

/**
 * Kursi sah hanya bila kuncinya adalah musim berjalan.
 *
 * Inilah yang membuat masa jabatan berakhir **tanpa** bantuan cron: begitu
 * kalender melewati batas kuartal, kunci yang tersimpan tidak lagi sama dengan
 * `getSeasonKey()`, sehingga tidak ada kursi yang bisa menjadi permanen.
 */
export function isSeatActive(user: { seasonRoleKey: string | null }): boolean {
  return user.seasonRoleKey !== null && user.seasonRoleKey === getSeasonKey();
}

/**
 * Boleh membuka panel moderasi: staf manusia (`season_role_key IS NULL`) atau
 * pemegang kursi yang masih berlaku.
 *
 * Dipakai halaman (yang tidak bisa memakai `requireReviewer()` karena page tidak
 * dapat mengembalikan `Response`) dan `Navbar`, supaya tautan "Moderator" tidak
 * muncul untuk kursi yang sudah kedaluwarsa.
 */
export function canReview(user: { role: string; seasonRoleKey: string | null }): boolean {
  if (!hasReviewerRole(user.role)) return false;
  return user.seasonRoleKey === null || isSeatActive(user);
}

/**
 * Staf manusia — diberikan lewat `db:promote`, tidak pernah dicabut mesin.
 *
 * Ini pembeda untuk kapabilitas yang **tidak** boleh dipegang kursi: melihat
 * `requirement` lencana rahasia dan membaca `audit_log`. Kursi adalah amanah
 * satu musim, bukan jabatan kepercayaan penuh.
 *
 * Sejak M17 predikat ini juga menjawab "apakah orang ini peserta kompetisi":
 * staf tidak masuk papan peringkat. Pasangan SQL-nya adalah `IS_HUMAN_STAFF` di
 * `lib/participants.ts`, dan `tests/unit/participants.test.ts` memastikan
 * keduanya menjawab sama untuk setiap kombinasi `role` × `season_role_key`.
 *
 * Parameternya struktural, bukan `SessionUser`, karena halaman hanya memegang
 * baris dari `getCurrentUser()` — yang tidak membawa `clerkId` maupun `points`.
 */
export function isHumanStaff(user: { role: string; seasonRoleKey: string | null }): boolean {
  return hasReviewerRole(user.role) && user.seasonRoleKey === null;
}

/** Alias historis: peninjau manusia = staf manusia. */
export function isHumanReviewer(user: SessionUser): boolean {
  return isHumanStaff(user);
}

/**
 * Requires a signed-in session and nothing more — no database query.
 *
 * `requireUser` is the default, and most routes want the row. This one exists for
 * the handful that need *a* session but have no use for the user: a download
 * counter, a public count. Those routes used to lean on src/proxy.ts alone, which
 * is a single point of failure — when the proxy file sat at the repo root it was
 * never loaded, and they were open to anonymous callers. Guarding them in-handler
 * costs nothing here because no row is fetched.
 *
 * Returns the Clerk id, never a database id: it is not safe to feed into a
 * points or ownership check, and the rate limiter buckets on hashed values anyway.
 */
export async function requireSession(): Promise<SessionResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, clerkId: userId };
}

/**
 * Resolve the current Clerk session into a provisioned row in `users`.
 *
 * - No session        → 401 (not signed in)
 * - Session, no DB row → 403 (signed in but the Clerk webhook has not synced yet)
 */
export async function requireUser(): Promise<AuthzResult> {
  const session = await requireSession();
  if (!session.ok) return session;

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, session.clerkId),
    columns: {
      id: true,
      clerkId: true,
      name: true,
      role: true,
      points: true,
      seasonRoleKey: true,
    },
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

/**
 * Reviewer = staf manusia **atau** pemegang kursi musim yang masih berlaku.
 *
 * Ini penjaga untuk pekerjaan moderasi sehari-hari: antrean, setujui, tolak,
 * dan menulis soal kuis harian. `requireModerator()` sengaja **dihapus**, bukan
 * disisakan sebagai alias — alias adalah cara termudah bagi route baru untuk
 * diam-diam memakai penjaga yang lebih lebar dari yang dimaksud.
 */
export async function requireReviewer(): Promise<AuthzResult> {
  const result = await requireUser();
  if (!result.ok) return result;

  if (!canReview(result.user)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", code: "reviewer_required" },
        { status: 403 },
      ),
    };
  }
  return result;
}

/**
 * Reviewer manusia saja — tanpa kursi musim.
 *
 * Dipakai untuk dua hal yang tidak boleh dipegang pemegang kursi: melihat
 * `requirement` lencana rahasia dan membaca `audit_log`.
 */
export async function requireHumanReviewer(): Promise<AuthzResult> {
  const result = await requireUser();
  if (!result.ok) return result;

  if (!isHumanReviewer(result.user)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden", code: "human_reviewer_required" },
        { status: 403 },
      ),
    };
  }
  return result;
}
