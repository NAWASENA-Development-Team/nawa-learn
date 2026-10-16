// app/api/modules/submit/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { modules, submissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requestLogger } from "@/lib/logger";

// Validate incoming request body using Zod
const submitSchema = z.object({
  title: z.string().min(5),
  subject: z.string().min(2),
  grade: z.string().min(1).optional().default("Umum"),
  category: z.string().min(2),
  contentUrl: z.string().refine(
    (val) => val.startsWith("data:") || /^https?:\/\/.+/.test(val),
    { message: "URL tidak valid" }
  ),
});

export async function POST(req: Request) {
  const log = requestLogger(req);
  try {
    // 1. Authenticate the request via Clerk
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      log.error("Authentication failed: No clerkId");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate the request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      log.error("JSON parse error:", parseError);
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    let validatedData;
    try {
      validatedData = submitSchema.parse(body);
    } catch (validationError) {
      log.error("Validation error:", validationError);
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
        columns: { id: true, role: true }
      });
    } catch (dbError) {
      log.error("Database query error:", dbError);
      return NextResponse.json({ 
        error: "Database connection error" 
      }, { status: 503 });
    }

    if (!dbUser) {
      log.error("authenticated user has no row in the users table", { clerkId });
      return NextResponse.json({ 
        error: "User profile not synced with database. Please try logging out and back in." 
      }, { status: 404 });
    }
    
    if (dbUser.role === "student") {
      return NextResponse.json({ 
        error: "Hanya kontributor yang dapat mengunggah modul" 
      }, { status: 403 });
    }

    // 4. Insert module into database
    // Note: neon-http driver does not support transactions, use sequential inserts
    let newModule;
    try {
      const [insertedModule] = await db.insert(modules).values({
        title: validatedData.title,
        subject: validatedData.subject,
        grade: validatedData.grade || "Umum",
        category: validatedData.category,
        contentUrl: validatedData.contentUrl,
        uploaderId: dbUser.id,
        status: "pending",
      }).returning({ id: modules.id });
      newModule = insertedModule;
    } catch (moduleError) {
      log.error("Module insert error:", moduleError);
      return NextResponse.json({ 
        error: "Failed to save module. Please try again." 
      }, { status: 500 });
    }

    // 5. Insert submission record for moderation queue
    try {
      await db.insert(submissions).values({
        type: "module",
        refId: newModule.id,
        submitterId: dbUser.id,
        status: "pending",
      });
    } catch (submissionError) {
      log.error("submission record insert failed", { error: submissionError });
      // Module was inserted, still return success but log the issue
      log.warn("module inserted but its submission record was not created", {
        moduleId: newModule.id,
      });
    }

    const result = newModule;

    return NextResponse.json({ success: true, moduleId: result.id }, { status: 201 });

  } catch (error) {
    log.error("Unexpected submission error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error. Please try again later." 
    }, { status: 500 });
  }
}
