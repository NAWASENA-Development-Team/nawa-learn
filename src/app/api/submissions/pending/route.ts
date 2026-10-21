// app/api/submissions/pending/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { submissions, modules, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireReviewer } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const log = requestLogger(req);
  // The moderation queue is not public: staff or a seated season moderator.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;

  try {
    // Explicitly scoped to *module* submissions of type "module" so question
    // submissions can never leak into the module queue.
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
    .where(and(
      eq(submissions.type, "module"),
      eq(submissions.status, "pending"),
    ))
    .orderBy(desc(submissions.submittedAt));

    return NextResponse.json({ data: pendingQueue }, { status: 200 });

  } catch (error) {
    log.error("Fetch pending queue error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
