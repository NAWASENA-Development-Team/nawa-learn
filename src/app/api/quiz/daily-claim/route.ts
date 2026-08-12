import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, pointsLog } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userRecord = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    });

    if (!userRecord) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const now = new Date();
    // 03:00 WIB is 20:00 UTC of the previous day
    const resetHourUTC = 20; 
    let lastReset = new Date(now);
    
    if (now.getUTCHours() < resetHourUTC) {
      // If it's currently before 20:00 UTC, the most recent reset was yesterday at 20:00 UTC
      lastReset.setUTCDate(lastReset.getUTCDate() - 1);
    }
    lastReset.setUTCHours(resetHourUTC, 0, 0, 0);

    const canClaim = !userRecord.lastDailyQuizAt || new Date(userRecord.lastDailyQuizAt) < lastReset;

    if (!canClaim) {
      return NextResponse.json({
        success: false,
        message: "Reward Kuis Harian sudah diklaim hari ini. Kembali lagi besok setelah pukul 03.00 WIB!"
      });
    }

    // Grant +25 V-Points
    const pointsAwarded = 25;
    await db.update(users)
      .set({ 
        points: userRecord.points + pointsAwarded,
        lastDailyQuizAt: now 
      })
      .where(eq(users.id, userRecord.id));

    // Log the transaction
    await db.insert(pointsLog).values({
      userId: userRecord.id,
      action: "Kuis Harian Adaptif",
      delta: pointsAwarded,
    });

    return NextResponse.json({
      success: true,
      pointsAwarded,
      message: "Berhasil menyelesaikan Kuis Harian! +25 V-Points"
    });

  } catch (error) {
    console.error("Daily claim error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
