// app/api/modules/download/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { modules } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireSession } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";

// The id is a uuid column. Checking it here turns a malformed id into a 400
// instead of the 500 that Postgres used to raise on a bad cast.
const downloadSchema = z.object({ moduleId: z.uuid() }).strict();

export async function POST(req: Request) {
  const log = requestLogger(req);

  // Was guarded by src/proxy.ts alone, which meant it was anonymous whenever the
  // proxy file was misplaced. `requireSession` still resolves no user row, so the
  // "not worth a query on the hot path" reasoning below still holds.
  const session = await requireSession();
  if (!session.ok) return session.response;

  // IP-scoped: the route needs a session but no user id, and the limiter must
  // never be handed a Clerk id — a download counter is not worth the lookup.
  const limit = await rateLimit(req, "modules/download", null);
  if (!limit.ok) return limit.response;

  const parsed = await parseJsonBody(req, downloadSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await db
      .update(modules)
      .set({ downloads: sql`${modules.downloads} + 1` })
      .where(eq(modules.id, parsed.data.moduleId));

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Failed to increment download count:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
