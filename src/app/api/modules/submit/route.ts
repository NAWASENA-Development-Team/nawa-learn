// app/api/modules/submit/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { modules, submissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { httpUrl, parseJsonBody, shortText } from "@/lib/validation";

// Validate incoming request body using Zod.
//
// `contentUrl` used to accept a `data:` URL as well, which is how whole PDFs
// ended up inside a text column. Binary content now goes through /api/uploads,
// which hands back an https URL; a link pasted from Google Drive is still fine.
const submitSchema = z
  .object({
    title: shortText(200, 5),
    subject: shortText(100, 2),
    grade: shortText(50).optional().default("Umum"),
    category: shortText(100, 2),
    contentUrl: httpUrl(),
  })
  .strict();

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
    const parsed = await parseJsonBody(req, submitSchema, { message: "Invalid data" });
    if (!parsed.ok) return parsed.response;
    const validatedData = parsed.data;

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

    const limit = await rateLimit(req, "modules/submit", dbUser.id);
    if (!limit.ok) return limit.response;

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
