// src/app/api/health/route.ts
// ─── Liveness / readiness probe ───────────────────────────────────────────────
// For an uptime monitor. It is deliberately public (see PUBLIC_ROUTES in
// src/proxy.ts) and therefore reports only *coarse status*, never data: an outage
// page that leaks table names and error messages is a gift to an attacker.
//
//  200  everything the app cannot work without is reachable
//  503  the database, the schema, or the auth configuration is not usable
//
// The schema check is not decoration. `select 1` cannot tell a migrated database
// from a stale one, so on 2026-10-22 the M16 deploy shipped code that selects
// `users.season_role_key` while the database was still at migration 0005: every
// signed-in page threw 42703 and rendered `error.tsx`, and this endpoint answered
// `200 {"status":"ok"}` the whole time — because the database was perfectly
// reachable. The count is deliberately coarse: it catches "a migration was never
// applied", not "a migration file was edited in place". It is still the one
// signal that turns a monitor red within a minute instead of a student's report.
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import journal from "@/db/migrations/meta/_journal.json";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Derived from drizzle-kit's own journal, never hand-written: `generate` appends
// an entry, so a new migration updates this number without anyone remembering to.
const EXPECTED_MIGRATIONS = journal.entries.length;

type SchemaStatus = "ok" | "stale" | "unknown";

// A health check that hangs is worse than one that fails: the monitor learns
// nothing. Bound the await. The timer is cleared in `finally`, otherwise the
// losing branch rejects after the race is already settled and surfaces as an
// unhandled rejection in the logs.
const DB_TIMEOUT_MS = 3_000;

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("database check timed out")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function databaseStatus(): Promise<"ok" | "down"> {
  try {
    await withTimeout(db.execute(sql`select 1`), DB_TIMEOUT_MS);
    return "ok";
  } catch (error) {
    // The reason goes to the logs, not to the anonymous caller.
    logger.error("health check failed: database unreachable", { error });
    return "down";
  }
}

// `db.execute()` hands back a bare row array on neon-http and a result object on
// PGlite, so both shapes are read rather than assuming the deployed one.
function appliedMigrations(result: unknown): number | null {
  const rows = Array.isArray(result)
    ? result
    : Array.isArray((result as { rows?: unknown } | null)?.rows)
      ? (result as { rows: unknown[] }).rows
      : null;
  if (!rows || rows.length === 0) return null;

  const applied = Number((rows[0] as Record<string, unknown>).applied);
  return Number.isFinite(applied) ? applied : null;
}

async function schemaStatus(): Promise<SchemaStatus> {
  try {
    const result = await withTimeout(
      db.execute(sql`select count(*)::int as applied from drizzle.__drizzle_migrations`),
      DB_TIMEOUT_MS,
    );
    const applied = appliedMigrations(result);
    if (applied === null) {
      logger.error("health check failed: migration count unreadable");
      return "stale";
    }

    // `>=`, not `===`: a database one migration *ahead* of the deployed build is
    // a rollback window, not an outage — additive migrations do not break older
    // code. A database *behind* the build is exactly the failure above.
    return applied >= EXPECTED_MIGRATIONS ? "ok" : "stale";
  } catch (error) {
    logger.error("health check failed: schema version unreadable", { error });
    return "stale";
  }
}

export async function GET() {
  const database = await databaseStatus();
  // Asking an unreachable database for its migration count would only produce a
  // second failure for the same reason, and one log line is enough to explain it.
  const schemaVersion = database === "ok" ? await schemaStatus() : "unknown";
  const auth =
    process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "ok" : "down";

  const healthy = database === "ok" && schemaVersion === "ok" && auth === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: { database, schema: schemaVersion, auth },
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      // Monitors should never serve a stale health verdict.
      headers: { "cache-control": "no-store" },
    },
  );
}
