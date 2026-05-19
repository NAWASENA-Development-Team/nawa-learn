// app/api/questions/approved/route.ts
// Returns all approved questions for the practice quiz page.
// Includes an `isOwnQuestion` flag so the frontend can enforce anti-cheat.
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { questions, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();

    // Determine current user's DB ID (null if unauthenticated)
    let currentDbUserId: string | null = null;
    if (clerkId) {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true },
      });
      currentDbUserId = dbUser?.id ?? null;
    }

    const rows = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        options: questions.options,
        answerKey: questions.answerKey,
        difficulty: questions.difficulty,
        subject: questions.subject,
        category: questions.category,
        uploaderId: questions.uploaderId,
        uploaderName: users.name,
      })
      .from(questions)
      .innerJoin(users, eq(questions.uploaderId, users.id))
      .where(eq(questions.status, "approved"));

    const withOwnerFlag = rows.map((q) => ({
      ...q,
      isOwnQuestion: currentDbUserId ? q.uploaderId === currentDbUserId : false,
    }));

    return NextResponse.json({ success: true, data: withOwnerFlag }, { status: 200 });
  } catch (error) {
    console.error("Approved questions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
