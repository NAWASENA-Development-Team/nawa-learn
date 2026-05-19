// app/api/exams/list/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { customExams } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const exams = await db
      .select({
        id: customExams.id,
        title: customExams.title,
        subject: customExams.subject,
        category: customExams.category,
        difficulty: customExams.difficulty,
        durationMinutes: customExams.durationMinutes,
        questions: customExams.questions,
        authorName: customExams.authorName,
        createdAt: customExams.createdAt,
      })
      .from(customExams)
      .orderBy(desc(customExams.createdAt));

    return NextResponse.json({ success: true, data: exams }, { status: 200 });
  } catch (error) {
    console.error("Exam list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
