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
      console.error("Authentication failed: No clerkId");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate the request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    let validatedData;
    try {
      validatedData = submitSchema.parse(body);
    } catch (validationError) {
      console.error("Validation error:", validationError);
      if (validationError instanceof z.ZodError) {
        return NextResponse.json({ 
          error: "Invalid data", 
          details: validationError.issues 
        }, { status: 400 });
      }
      throw validationError;
    }

    // 3. Look up the internal Neon User ID using the Clerk ID
    let dbUser;
    try {
      dbUser = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true }
      });
    } catch (dbError) {
      console.error("Database query error:", dbError);
      return NextResponse.json({ 
        error: "Database connection error" 
      }, { status: 503 });
    }

    if (!dbUser) {
      console.error("User not found in database for clerkId:", clerkId);
      return NextResponse.json({ 
        error: "User profile not synced with database. Please try logging out and back in." 
      }, { status: 404 });
    }

    // 4. Insert data using a database transaction to ensure atomicity
    let result;
    try {
      result = await db.transaction(async (tx) => {
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
    } catch (transactionError) {
      console.error("Transaction error:", transactionError);
      return NextResponse.json({ 
        error: "Failed to save module. Please try again." 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, moduleId: result.id }, { status: 201 });

  } catch (error) {
    console.error("Unexpected submission error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error. Please try again later." 
    }, { status: 500 });
  }
}
