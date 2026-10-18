// app/api/profile/status/route.ts
// ─── Riwayat pengajuan & laporan milik pengguna yang sedang masuk ─────────────
// Sebelum M13 route ini adalah N+1 klasik: satu query untuk pengajuan, lalu
// **satu query lagi per pengajuan** (sampai 50) hanya untuk mengambil judulnya,
// ditambah satu query per laporan. Empat puluh delapan pengajuan berarti ~50
// perjalanan pulang-pergi ke Neon, masing-masing dengan latensi jaringan sendiri.
//
// Sekarang jumlahnya tetap: 1 pengguna + 2 daftar (paralel) + 2 pencarian judul
// (paralel) = 5 query, berapa pun banyak pengajuannya.
//
// Perhatikan juga `columns` di setiap query. Versi lama memakai `findFirst` dan
// `findMany` tanpa daftar kolom, sehingga mengambil **seluruh** baris modul
// (termasuk `content_url`) dan seluruh baris soal (termasuk `answer_key`) hanya
// untuk membaca satu judul. Kunci jawaban memang tidak pernah dirender di sini,
// tetapi data yang tidak dibaca adalah data yang tidak bisa bocor.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { submissions, modules, questions, reports } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";

/** Berapa pengajuan & laporan terbaru yang ditampilkan. */
const RECENT_LIMIT = 50;

export async function GET(req: Request) {
  const log = requestLogger(req);
  try {
    // M14d: standardised on `requireUser()`. This route used to hand-roll the
    // same two steps and answer **404** for a session with no provisioned row,
    // while every other protected route answers 403 — the same condition
    // reported as two different things. The query count is unchanged (one
    // `findFirst`), which `tests/integration/query-count.test.ts` pins.
    const authz = await requireUser();
    if (!authz.ok) return authz.response;
    const dbUser = authz.user;

    // Dua daftar ini tidak saling bergantung, jadi dikirim bersamaan.
    const [userSubmissions, userReports] = await Promise.all([
      db.query.submissions.findMany({
        where: eq(submissions.submitterId, dbUser.id),
        orderBy: [desc(submissions.submittedAt)],
        limit: RECENT_LIMIT,
        columns: {
          id: true,
          type: true,
          refId: true,
          status: true,
          submittedAt: true,
          feedback: true,
        },
      }),
      db.query.reports.findMany({
        where: eq(reports.userId, dbUser.id),
        orderBy: [desc(reports.createdAt)],
        limit: RECENT_LIMIT,
        columns: {
          id: true,
          issueType: true,
          description: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // Satu pencarian per jenis konten, bukan satu per pengajuan.
    const moduleIds = [...new Set(userSubmissions.filter((s) => s.type === "module").map((s) => s.refId))];
    const questionIds = [
      ...new Set(userSubmissions.filter((s) => s.type === "question").map((s) => s.refId)),
    ];

    const [moduleRows, questionRows] = await Promise.all([
      moduleIds.length
        ? db
            .select({ id: modules.id, title: modules.title })
            .from(modules)
            .where(inArray(modules.id, moduleIds))
        : Promise.resolve([]),
      questionIds.length
        ? db
            .select({ id: questions.id, subject: questions.subject, category: questions.category })
            .from(questions)
            .where(inArray(questions.id, questionIds))
        : Promise.resolve([]),
    ]);

    const moduleTitles = new Map(moduleRows.map((m) => [m.id, m.title]));
    // `subject` dan `category` boleh NULL. Versi lama mencetak "null - null";
    // sekarang bagian yang kosong dilewati saja.
    const questionLabels = new Map(
      questionRows.map((q) => [q.id, [q.subject, q.category].filter(Boolean).join(" - ") || "Tanpa kategori"]),
    );

    const enriched = userSubmissions.map((sub) => {
      let title = "Item Dihapus";
      if (sub.type === "module") {
        const moduleTitle = moduleTitles.get(sub.refId);
        if (moduleTitle) title = `Modul: ${moduleTitle}`;
      } else if (sub.type === "question") {
        const label = questionLabels.get(sub.refId);
        if (label) title = `Soal: ${label}`;
      }

      return {
        id: sub.id,
        type: sub.type,
        title,
        status: sub.status,
        submittedAt: sub.submittedAt,
        feedback: sub.feedback,
      };
    });

    const enrichedReports = userReports.map((r) => ({
      id: r.id,
      type: "report",
      title: `Laporan: ${r.issueType === "bug" ? "Bug Sistem" : r.issueType === "content" ? "Kesalahan Konten" : "Lainnya"}`,
      status: r.status,
      submittedAt: r.createdAt,
      feedback: r.description.slice(0, 100) + (r.description.length > 100 ? "..." : ""),
    }));

    const combined = [...enriched, ...enrichedReports].sort((a, b) => {
      const dateA = new Date(a.submittedAt).getTime();
      const dateB = new Date(b.submittedAt).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ data: combined }, { status: 200 });
  } catch (error) {
    log.error("Fetch user status error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
