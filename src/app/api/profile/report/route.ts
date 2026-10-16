import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { reports, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
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
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

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
