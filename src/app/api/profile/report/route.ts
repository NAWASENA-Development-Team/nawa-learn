import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { reports, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const reportSchema = z.object({
  issueType: z.string().min(1),
  description: z.string().min(10),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const data = reportSchema.parse(body);

    await db.insert(reports).values({
      userId: dbUser.id,
      issueType: data.issueType,
      description: data.description,
      status: "pending",
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Submit report error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
