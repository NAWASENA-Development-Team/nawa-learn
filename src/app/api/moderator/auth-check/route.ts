import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ isModerator: false });
    }

    // Get current user and top 3 users by points
    const [currentUser, top3Users] = await Promise.all([
      db.query.users.findFirst({
        where: (users, { eq }) => eq(users.clerkId, clerkId),
        columns: { id: true },
      }),
      db.query.users.findMany({
        orderBy: [desc(users.seasonPoints), desc(users.createdAt)],
        limit: 3,
        columns: { id: true },
      }),
    ]);

    if (!currentUser) {
      return NextResponse.json({ isModerator: false });
    }

    const isTop3 = top3Users.some((u) => u.id === currentUser.id);

    return NextResponse.json({ isModerator: isTop3 });
  } catch (error) {
    console.error("Moderator auth check error:", error);
    return NextResponse.json({ isModerator: false });
  }
}
