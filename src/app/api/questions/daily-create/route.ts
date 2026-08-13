// app/api/questions/daily-create/route.ts
// Moderator-only endpoint to create daily quiz questions directly (auto-approved).
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { questions, users, submissions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the user exists in DB
    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { questionText, options, answerKey, difficulty, subject } = body;

    // Validate required fields
    if (!questionText || !options || !answerKey || !difficulty) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate options has at least A-D
    if (!options.A || !options.B || !options.C || !options.D) {
      return NextResponse.json({ error: "Options must include at least A, B, C, D" }, { status: 400 });
    }

    // Validate answerKey is one of the option keys
    if (!options[answerKey]) {
      return NextResponse.json({ error: "Answer key must match one of the options" }, { status: 400 });
    }

    // Insert question directly as approved with category "Kuis Harian"
    const [newQuestion] = await db.insert(questions).values({
      questionText,
      options,
      answerKey,
      difficulty,
      subject: subject || "Umum",
      category: "Kuis Harian",
      uploaderId: dbUser.id,
      status: "approved", // Auto-approved since moderator creates it
    }).returning();

    // Also create a submission record for tracking
    await db.insert(submissions).values({
      type: "question",
      refId: newQuestion.id,
      submitterId: dbUser.id,
      status: "approved",
      feedback: "Dibuat langsung oleh moderator untuk Kuis Harian.",
    });

    return NextResponse.json({
      success: true,
      questionId: newQuestion.id,
      message: "Soal Kuis Harian berhasil ditambahkan!",
    });

  } catch (error) {
    console.error("Daily question create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// GET: Fetch all existing daily quiz questions for the moderator to see
export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dailyQuestions = await db.query.questions.findMany({
      where: eq(questions.category, "Kuis Harian"),
      orderBy: (q, { desc }) => [desc(q.createdAt)],
    });

    return NextResponse.json({ success: true, data: dailyQuestions });
  } catch (error) {
    console.error("Daily questions list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
