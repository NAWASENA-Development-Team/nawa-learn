// app/api/submissions/pending/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { submissions, modules, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currentUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
      columns: { role: true }
    });

    if (!currentUser || (currentUser.role !== "moderator" && currentUser.role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch pending submissions and join with module and submitter data
    const pendingQueue = await db.select({
      submissionId: submissions.id,
      submittedAt: submissions.submittedAt,
      moduleId: modules.id,
      moduleTitle: modules.title,
      moduleUrl: modules.contentUrl,
      submitterId: users.id,
      submitterName: users.name,
    })
    .from(submissions)
    .innerJoin(modules, eq(submissions.refId, modules.id))
    .innerJoin(users, eq(submissions.submitterId, users.id))
    .where(eq(submissions.status, "pending"))
    .orderBy(desc(submissions.submittedAt));

    return NextResponse.json({ data: pendingQueue }, { status: 200 });

  } catch (error) {
    console.error("Fetch pending queue error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
