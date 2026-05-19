// app/api/modules/approve/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { modules, submissions, users, pointsLog } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { checkAndGrantLevelRewards } from "@/lib/levelRewards";

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

    // 1. Get the current user's DB ID (needed for reviewerId)
    // Access is controlled by the password gate in the moderator frontend
    const currentUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true, role: true }
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found in database" }, { status: 404 });
    }

    const body = await req.json();
    const { submissionId, moduleId, submitterId, feedback } = approveSchema.parse(body);

    // Get submitter's current points for level reward check
    const submitter = await db.query.users.findFirst({
      where: eq(users.id, submitterId),
      columns: { id: true, points: true },
    });
    if (!submitter) {
      return NextResponse.json({ error: "Submitter not found" }, { status: 404 });
    }

    // 2. Execute approval flow with sequential updates
    // Note: neon-http driver does not support transactions, use sequential queries

    // Update module status to approved
    await db.update(modules)
      .set({ status: "approved" })
      .where(eq(modules.id, moduleId));

    // Update submission record with reviewer info
    await db.update(submissions)
      .set({ 
        status: "approved", 
        reviewerId: currentUser.id,
        feedback: feedback || "Good job!"
      })
      .where(eq(submissions.id, submissionId));

    // Log the points award
    await db.insert(pointsLog).values({
      userId: submitterId,
      action: "module_approved",
      delta: MODULE_APPROVAL_POINTS,
      refId: moduleId,
    });

    // Increment the user's total points
    await db.update(users)
      .set({ points: sql`${users.points} + ${MODULE_APPROVAL_POINTS}` })
      .where(eq(users.id, submitterId));

    const newPoints = submitter.points + MODULE_APPROVAL_POINTS;

    // Check and grant level rewards
    const levelRewards = await checkAndGrantLevelRewards(submitterId, submitter.points, newPoints);

    return NextResponse.json({
      success: true,
      message: "Module approved and points awarded",
      levelRewards: levelRewards.map(r => r.label),
    }, { status: 200 });

  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
