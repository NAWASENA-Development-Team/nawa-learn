// app/api/moderator/auth-check/route.ts
// Tells the client whether the signed-in user may open the moderator panel.
// The answer comes solely from `users.role` — never from a hardcoded password
// or a leaderboard position (both were spoofable / manipulable).
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hasReviewerRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ isModerator: false });
    }

    const currentUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { role: true },
    });

    return NextResponse.json({ isModerator: hasReviewerRole(currentUser?.role ?? "guest") });
  } catch (error) {
    console.error("Moderator auth check error:", error);
    return NextResponse.json({ isModerator: false });
  }
}
