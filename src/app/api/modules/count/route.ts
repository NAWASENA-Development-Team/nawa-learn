// app/api/modules/count/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { modules } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { requireSession } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const log = requestLogger(req);

  // Guarded only by src/proxy.ts until M14's H13 slice. `requireSession` fetches
  // no user row, so an explicit guard here costs nothing measurable.
  const session = await requireSession();
  if (!session.ok) return session.response;

  try {
    const [result] = await db
      .select({ value: count() })
      .from(modules)
      .where(eq(modules.status, "approved"));

    return NextResponse.json({ count: result?.value || 0 });
  } catch (error) {
    log.error("Failed to fetch modules count:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
