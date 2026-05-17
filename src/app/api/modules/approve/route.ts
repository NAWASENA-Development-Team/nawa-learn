// app/api/modules/approve/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { modules, submissions, users, pointsLog } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const approveSchema = z.object({
  submissionId: z.string().uuid(),
  moduleId: z.string().uuid(),
  submitterId: z.string().uuid(),
  feedback: z.string().optional(),
});

// Points awarded for an approved module
const MODULE_APPROVAL_POINTS = 50; 

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Verify the current user is actually a moderator or admin
    const currentUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true, role: true }
    });

    if (!currentUser || (currentUser.role !== "moderator" && currentUser.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const { submissionId, moduleId, submitterId, feedback } = approveSchema.parse(body);

    // 2. Execute the approval flow within a transaction
    await db.transaction(async (tx) => {
      // Update module status to live
      await tx.update(modules)
        .set({ status: "approved" })
        .where(eq(modules.id, moduleId));

      // Update submission record with reviewer info
      await tx.update(submissions)
        .set({ 
          status: "approved", 
          reviewerId: currentUser.id,
          feedback: feedback || "Good job!"
        })
        .where(eq(submissions.id, submissionId));

      // Log the points transaction
      await tx.insert(pointsLog).values({
        userId: submitterId,
        action: "module_approved",
        delta: MODULE_APPROVAL_POINTS,
        refId: moduleId,
      });

      // Increment the user's total points profile
      await tx.update(users)
        .set({ points: sql`${users.points} + ${MODULE_APPROVAL_POINTS}` })
        .where(eq(users.id, submitterId));
    });

    return NextResponse.json({ success: true, message: "Module approved and points awarded" }, { status: 200 });

  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
