// app/api/exams/create/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { customExams, users } from "@/db/schema";
import { eq } from "drizzle-orm";

const questionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  options: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
    E: z.string(),
  }),
  answerKey: z.enum(["A", "B", "C", "D", "E"]),
});

const createSchema = z.object({
  title: z.string().min(3),
  subject: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.string().min(1),
  durationMinutes: z.number().int().min(1).max(180),
  questions: z.array(questionSchema).min(1).max(50),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();

    const body = await req.json();
    const data = createSchema.parse(body);

    // Try to get author info from DB; fall back to "Siswa SMAN 2" if not logged in
    let authorId: string | null = null;
    let authorName = data.questions[0] ? "Siswa SMAN 2" : "Siswa SMAN 2";

    if (clerkId) {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true, name: true },
      });
      if (dbUser) {
        authorId = dbUser.id;
        authorName = dbUser.name;
      }
    }

    const [exam] = await db
      .insert(customExams)
      .values({
        title: data.title,
        subject: data.subject,
        category: data.category,
        difficulty: data.difficulty,
        durationMinutes: data.durationMinutes,
        questions: data.questions,
        authorId: authorId ?? undefined,
        authorName,
      })
      .returning({ id: customExams.id });

    return NextResponse.json({ success: true, examId: exam.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Exam create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
