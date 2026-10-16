// app/api/modules/download/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { modules } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const log = requestLogger(req);
  // IP-scoped: the route requires a session (proxy.ts) but never resolves a user,
  // and a download counter is not worth an extra query on the hot path.
  const limit = await rateLimit(req, "modules/download", null);
  if (!limit.ok) return limit.response;

  try {
    const { moduleId } = await req.json();
    if (!moduleId) {
      return NextResponse.json({ error: "Missing moduleId" }, { status: 400 });
    }

    await db
      .update(modules)
      .set({ downloads: sql`${modules.downloads} + 1` })
      .where(eq(modules.id, moduleId));

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Failed to increment download count:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
