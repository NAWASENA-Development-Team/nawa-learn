// app/api/questions/submit/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { questions, submissions, users } from "@/db/schema";
import { eq } from "drizzle-orm";

const submitSchema = z.object({
  questionText: z.string().min(10, "Pertanyaan terlalu pendek"),
  options: z.object({
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().optional().default("-"),
    D: z.string().optional().default("-"),
    E: z.string().optional().default("-"),
  }),
  answerKey: z.enum(["A", "B", "C", "D", "E"]),
  difficulty: z.enum(["mudah", "sedang", "sulit"]),
  subject: z.string().min(2),
  category: z.string().min(2),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const data = submitSchema.parse(body);

    // Insert question
    const [question] = await db.insert(questions).values({
      questionText: data.questionText,
      options: data.options,
      answerKey: data.answerKey,
      difficulty: data.difficulty,
      subject: data.subject,
      category: data.category,
      uploaderId: dbUser.id,
      status: "pending",
    }).returning({ id: questions.id });

    // Create submission record
    await db.insert(submissions).values({
      type: "question",
      refId: question.id,
      submitterId: dbUser.id,
      status: "pending",
    });

    return NextResponse.json({ success: true, questionId: question.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Question submit error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
