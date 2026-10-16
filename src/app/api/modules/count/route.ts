// app/api/modules/count/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { modules } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { requestLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const log = requestLogger(req);
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
