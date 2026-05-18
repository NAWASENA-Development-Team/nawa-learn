// app/api/debug/submit/route.ts
// Debug endpoint to test module submission with detailed logging
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { modules, submissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";

const submitSchema = z.object({
  title: z.string().min(5),
  subject: z.string().min(2),
  grade: z.string().min(1).optional().default("Umum"),
  category: z.string().min(2),
  contentUrl: z.string().url(),
});

export async function POST(req: Request) {
  const logs: string[] = [];
  
  try {
    logs.push("=== DEBUG SUBMIT ENDPOINT ===");
    
    // 1. Check authentication
    logs.push("Step 1: Checking Clerk authentication...");
    const { userId: clerkId } = await auth();
    logs.push(`  Clerk ID: ${clerkId || "NOT AUTHENTICATED"}`);
    
    if (!clerkId) {
      return NextResponse.json({ 
        error: "Unauthorized",
        logs,
        step: "authentication"
      }, { status: 401 });
    }

    // 2. Parse request body
    logs.push("Step 2: Parsing request body...");
    let body;
    try {
      body = await req.json();
      logs.push(`  Body keys: ${Object.keys(body).join(", ")}`);
    } catch (e) {
      logs.push(`  ERROR: Failed to parse JSON - ${e}`);
      return NextResponse.json({ error: "Invalid JSON", logs }, { status: 400 });
    }

    // 3. Validate data
    logs.push("Step 3: Validating data with Zod...");
    let validatedData;
    try {
      validatedData = submitSchema.parse(body);
      logs.push(`  Validation passed`);
      logs.push(`  Title: ${validatedData.title}`);
      logs.push(`  Subject: ${validatedData.subject}`);
      logs.push(`  Category: ${validatedData.category}`);
      logs.push(`  URL: ${validatedData.contentUrl.substring(0, 50)}...`);
    } catch (e) {
      if (e instanceof z.ZodError) {
        logs.push(`  ERROR: Validation failed - ${JSON.stringify(e.issues)}`);
      }
      return NextResponse.json({ error: "Validation failed", logs }, { status: 400 });
    }

    // 4. Find user in database
    logs.push("Step 4: Looking up user in database...");
    let dbUser;
    try {
      dbUser = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true, name: true, email: true }
      });
      
      if (dbUser) {
        logs.push(`  User found: ${dbUser.name} (${dbUser.email})`);
        logs.push(`  User ID: ${dbUser.id}`);
      } else {
        logs.push(`  ERROR: User not found for Clerk ID: ${clerkId}`);
      }
    } catch (e) {
      logs.push(`  ERROR: Database query failed - ${e}`);
      return NextResponse.json({ error: "Database query error", logs }, { status: 503 });
    }

    if (!dbUser) {
      return NextResponse.json({ 
        error: "User not found in database",
        logs,
        step: "user_lookup"
      }, { status: 404 });
    }

    // 5. Insert module (no transaction - neon-http doesn't support it)
    logs.push("Step 5: Inserting module into database...");
    let newModule;
    try {
      const [result] = await db.insert(modules).values({
        title: validatedData.title,
        subject: validatedData.subject,
        grade: validatedData.grade || "Umum",
        category: validatedData.category,
        contentUrl: validatedData.contentUrl,
        uploaderId: dbUser.id,
        status: "pending",
      }).returning({ id: modules.id });
      
      newModule = result;
      logs.push(`  Module inserted successfully`);
      logs.push(`  Module ID: ${newModule.id}`);
    } catch (e) {
      logs.push(`  ERROR: Failed to insert module - ${e}`);
      return NextResponse.json({ error: "Module insert failed", logs }, { status: 500 });
    }

    // 6. Insert submission record
    logs.push("Step 6: Inserting submission record...");
    try {
      await db.insert(submissions).values({
        type: "module",
        refId: newModule.id,
        submitterId: dbUser.id,
        status: "pending",
      });
      logs.push(`  Submission record inserted successfully`);
    } catch (e) {
      logs.push(`  ERROR: Failed to insert submission - ${e}`);
      // Still return success since module was inserted
      logs.push(`  WARNING: Submission record failed but module was saved`);
    }

    logs.push("=== SUCCESS ===");
    return NextResponse.json({ 
      success: true, 
      moduleId: newModule.id,
      logs
    }, { status: 201 });

  } catch (error) {
    logs.push(`UNEXPECTED ERROR: ${error}`);
    console.error("Debug submit error:", error);
    return NextResponse.json({ 
      error: "Unexpected error",
      logs,
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
