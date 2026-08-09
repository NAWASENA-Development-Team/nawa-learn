import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { submissions, modules, questions, users, reports } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { id: true },
    });
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Fetch all submissions by this user
    const userSubmissions = await db.query.submissions.findMany({
      where: eq(submissions.submitterId, dbUser.id),
      orderBy: [desc(submissions.submittedAt)],
      limit: 50, // Recent 50
    });

    const userReports = await db.query.reports.findMany({
      where: eq(reports.userId, dbUser.id),
      orderBy: [desc(reports.createdAt)],
      limit: 50,
    });

    // We can join or just query modules and questions
    const enriched = await Promise.all(userSubmissions.map(async (sub) => {
      let title = "Item Dihapus";
      if (sub.type === "module") {
        const mod = await db.query.modules.findFirst({ where: eq(modules.id, sub.refId) });
        if (mod) title = `Modul: ${mod.title}`;
      } else if (sub.type === "question") {
        const q = await db.query.questions.findFirst({ where: eq(questions.id, sub.refId) });
        if (q) title = `Soal: ${q.subject} - ${q.category}`;
      }

      return {
        id: sub.id,
        type: sub.type,
        title,
        status: sub.status,
        submittedAt: sub.submittedAt,
        feedback: sub.feedback,
      };
    }));

    const enrichedReports = userReports.map(r => ({
      id: r.id,
      type: "report",
      title: `Laporan: ${r.issueType === 'bug' ? 'Bug Sistem' : r.issueType === 'content' ? 'Kesalahan Konten' : 'Lainnya'}`,
      status: r.status,
      submittedAt: r.createdAt,
      feedback: r.description.slice(0, 100) + (r.description.length > 100 ? '...' : ''),
    }));

    const combined = [...enriched, ...enrichedReports].sort((a, b) => {
      const dateA = new Date(a.submittedAt).getTime();
      const dateB = new Date(b.submittedAt).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ data: combined }, { status: 200 });

  } catch (error) {
    console.error("Fetch user status error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
