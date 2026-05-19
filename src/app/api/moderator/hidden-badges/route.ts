// app/api/moderator/hidden-badges/route.ts
// Returns all users with aggregated stats so the moderator dashboard can
// evaluate which hidden badges each user has unlocked (client-side via BADGES).
import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Subquery-based aggregation to avoid cartesian product from multi-join
    const rows = await db.execute(sql`
      SELECT
        u.id,
        u.name,
        u.points,
        u.created_at      AS "createdAt",
        COALESCE(m.approved_modules,   0)::int AS "approvedModules",
        COALESCE(m.total_downloads,    0)::int AS "totalDownloads",
        COALESCE(q.approved_questions, 0)::int AS "approvedQuestions"
      FROM users u
      LEFT JOIN (
        SELECT uploader_id,
               COUNT(*) FILTER (WHERE status = 'approved')       AS approved_modules,
               SUM(downloads) FILTER (WHERE status = 'approved') AS total_downloads
        FROM modules
        GROUP BY uploader_id
      ) m ON m.uploader_id = u.id
      LEFT JOIN (
        SELECT uploader_id,
               COUNT(*) FILTER (WHERE status = 'approved') AS approved_questions
        FROM questions
        GROUP BY uploader_id
      ) q ON q.uploader_id = u.id
      ORDER BY u.points DESC
    `);

    return NextResponse.json({ success: true, users: rows.rows }, { status: 200 });
  } catch (error) {
    console.error("Hidden badges API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
