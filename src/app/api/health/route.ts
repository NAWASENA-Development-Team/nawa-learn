// src/app/api/health/route.ts
// ─── Liveness / readiness probe ───────────────────────────────────────────────
// For an uptime monitor. It is deliberately public (see PUBLIC_ROUTES in
// src/proxy.ts) and therefore reports only *coarse status*, never data: an outage
// page that leaks table names and error messages is a gift to an attacker.
//
//  200  everything the app cannot work without is reachable
//  503  the database or the auth configuration is not usable
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const database = await databaseStatus();
  const auth =
    process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "ok" : "down";

  const healthy = database === "ok" && auth === "ok";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: { database, auth },
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      // Monitors should never serve a stale health verdict.
      headers: { "cache-control": "no-store" },
    },
  );
}
