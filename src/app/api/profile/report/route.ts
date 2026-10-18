import { NextResponse } from "next/server";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonBody, shortText } from "@/lib/validation";

const reportSchema = z
  .object({
    // Mirrors the three options the report dialog offers.
    issueType: z.enum(["bug", "content", "other"]),
    description: shortText(2000, 10),
  })
  .strict();

export async function POST(req: Request) {
  const log = requestLogger(req);
  try {
    // M14d: `requireUser()` replaces the hand-rolled auth + lookup, and answers
    // 403 (not 404) for a session with no provisioned row — the same answer every
    // other protected route gives for the same condition.
    const authz = await requireUser();
    if (!authz.ok) return authz.response;
    const dbUser = authz.user;

    const limit = await rateLimit(req, "profile/report", dbUser.id);
    if (!limit.ok) return limit.response;

    const parsed = await parseJsonBody(req, reportSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    await db.insert(reports).values({
      userId: dbUser.id,
      issueType: data.issueType,
      description: data.description,
      status: "pending",
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    log.error("Submit report error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
