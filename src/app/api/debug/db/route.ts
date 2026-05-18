// app/api/debug/db/route.ts
// Debug endpoint to check database connection
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function GET() {
  try {
    console.log("=== DEBUG DATABASE ENDPOINT ===");
    
    // 1. Test database connection
    console.log("Testing database connection...");
    const allUsers = await db.query.users.findMany();
    console.log(`Database connected. Found ${allUsers.length} users`);

    // 2. Check environment variables
    const dbUrl = process.env.DATABASE_URL;
    console.log("Database URL configured:", !!dbUrl);

    return NextResponse.json({
      status: "Database connected",
      userCount: allUsers.length,
      databaseConfigured: !!dbUrl,
      sampleUsers: allUsers.slice(0, 3).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        clerkId: u.clerkId.substring(0, 10) + "..." // Hide sensitive data
      }))
    });

  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json({ 
      error: "Database connection failed",
      details: error instanceof Error ? error.message : String(error),
      databaseUrl: process.env.DATABASE_URL ? "Configured" : "NOT configured"
    }, { status: 500 });
  }
}
