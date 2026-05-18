// app/api/debug/auth/route.ts
// Debug endpoint to check Clerk authentication
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    console.log("=== DEBUG AUTH ENDPOINT ===");
    
    // 1. Check Clerk auth
    const { userId: clerkId } = await auth();
    console.log("Clerk ID:", clerkId);
    
    if (!clerkId) {
      return NextResponse.json({ 
        error: "Not authenticated",
        clerkId: null 
      }, { status: 401 });
    }

    // 2. Get current user from Clerk
    const clerkUser = await currentUser();
    console.log("Clerk User:", {
      id: clerkUser?.id,
      email: clerkUser?.emailAddresses[0]?.emailAddress,
      firstName: clerkUser?.firstName,
      lastName: clerkUser?.lastName
    });

    // 3. Check if user exists in database
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId)
    });
    console.log("DB User:", dbUser);

    return NextResponse.json({
      authenticated: true,
      clerkId,
      clerkUser: {
        id: clerkUser?.id,
        email: clerkUser?.emailAddresses[0]?.emailAddress,
        firstName: clerkUser?.firstName,
        lastName: clerkUser?.lastName
      },
      dbUser: dbUser ? {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        points: dbUser.points
      } : null,
      status: dbUser ? "User synced" : "User NOT in database - needs sync"
    });

  } catch (error) {
    console.error("Debug auth error:", error);
    return NextResponse.json({ 
      error: String(error),
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
