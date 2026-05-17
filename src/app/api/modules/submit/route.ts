// app/api/modules/submit/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { modules, submissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Validate incoming request body using Zod
const submitSchema = z.object({
  title: z.string().min(5),
  subject: z.string().min(2),
  grade: z.string().min(1).optional().default("Umum"),
  category: z.string().min(2),
  contentUrl: z.string().url(),
});

export async function POST(req: Request) {
  try {
    // 1. Authenticate the request via Clerk
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate the request body
    const body = await req.json();
    const validatedData = submitSchema.parse(body);

    // 3. Look up the internal Neon User ID using the Clerk ID
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true }
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User profile not synced" }, { status: 404 });
    }

    // 4. Insert data using a database transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // Insert the pending module
      const [newModule] = await tx.insert(modules).values({
        title: validatedData.title,
        subject: validatedData.subject,
        grade: validatedData.grade || "Umum",
        category: validatedData.category,
        contentUrl: validatedData.contentUrl,
        uploaderId: dbUser.id,
        status: "pending", 
      }).returning({ id: modules.id });

      // Insert the corresponding review submission record
      await tx.insert(submissions).values({
        type: "module",
        refId: newModule.id,
        submitterId: dbUser.id,
        status: "pending",
      });

      return newModule;
    });

    return NextResponse.json({ success: true, moduleId: result.id }, { status: 201 });

  } catch (error) {
    console.error("Submission error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
