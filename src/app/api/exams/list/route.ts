// app/api/exams/list/route.ts
// ─── Daftar paket ujian yang boleh dikerjakan ─────────────────────────────────
//
// Sebelum M18 route ini mengembalikan **setiap** paket ujian tanpa syarat status,
// dan sejak pembuatan paket dibatasi ke kontributor, itu berarti satu paket yang
// belum ditinjau langsung bisa dikerjakan siapa pun. Sekarang ada dua lingkup:
//
//   - tanpa `?mine=1` → hanya `status = 'approved'`, yaitu yang sudah ditinjau.
//   - dengan `?mine=1` → hanya milik pemanggil, **semua** status, supaya penulis
//     bisa melihat paketnya yang masih `pending` atau `rejected` beserta
//     statusnya. Ini satu-satunya cara penulis tahu nasib karyanya tanpa surel.
//
// Kunci jawaban tetap tidak pernah ikut: `toPublicExamQuestions()` adalah satu-
// satunya bentuk yang boleh menyeberang ke browser, untuk lingkup mana pun.
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customExams } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { toPublicExamQuestions } from "@/lib/examScoring";
import { requestLogger } from "@/lib/logger";
import { keysetBefore, pageSlice, readCursor, readLimit } from "@/lib/pagination";
import { rateLimit } from "@/lib/rateLimit";

// A list, not a feed. The cap is what stops a single request from pulling every
// exam ever created; `?cursor=` (M13) is what lets a caller walk past it without
// re-reading the rows it already has.
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: Request) {
  const log = requestLogger(req);

  // This route had no in-handler guard at all until H13 — it relied entirely on
  // src/proxy.ts, so while the proxy file sat at the repo root and was never
  // loaded, every exam (answer keys included) was readable anonymously. The guard
  // is local now; the proxy is defence in depth, not the only defence.
  const authz = await requireUser();
  if (!authz.ok) return authz.response;

  const limit = await rateLimit(req, "exams/list", authz.user.id);
  if (!limit.ok) return limit.response;

  // A cursor that cannot be read is a 400, not "start from page one". Silently
  // restarting would make a paginating client loop over the first page forever.
  const { cursor, malformed } = readCursor(req);
  if (malformed) {
    return NextResponse.json(
      { error: "Cursor tidak valid" },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }

  const pageSize = readLimit(req, { defaultValue: DEFAULT_LIMIT, max: MAX_LIMIT });
  const mine = new URL(req.url).searchParams.get("mine") === "1";

  // Lingkup dan kursor digabung dengan `and()`, bukan dua `.where()` berurutan
  // (drizzle hanya memakai yang terakhir). Keduanya wajib ada di klausa yang
  // sama: tanpa lingkup, kursor berjalan di atas seluruh tabel.
  const scope = mine
    ? eq(customExams.authorId, authz.user.id)
    : eq(customExams.status, "approved");
  const where = cursor
    ? and(scope, keysetBefore(customExams.createdAt, customExams.id, cursor))
    : scope;

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
        authorId: customExams.authorId,
        authorName: customExams.authorName,
        status: customExams.status,
        // `created_at` is not unique — two exams created in the same transaction
        // share a timestamp — so `pageSlice` also keys on `id` to decide where
        // the next page starts.
        createdAt: customExams.createdAt,
      })
      .from(customExams)
      .where(where)
      .orderBy(desc(customExams.createdAt), desc(customExams.id))
      // One extra row: that is how `nextCursor` is known without a second COUNT.
      .limit(pageSize + 1);

    const page = pageSlice(exams, pageSize);

    // `questions` carries the answer keys, so it is redacted here — on the server,
    // before serialisation. Grading moves to /api/exams/submit, which is the only
    // place a key is ever compared to an answer.
    const data = page.rows.map(({ questions, authorId, ...exam }) => {
      const publicQuestions = toPublicExamQuestions(questions);
      return {
        ...exam,
        // An id, not the author row: the client only needs "is this mine?" to
        // decide between "kerjakan" and "hapus".
        isOwn: authorId === authz.user.id,
        questionCount: publicQuestions.length,
        questions: publicQuestions,
      };
    });

    return NextResponse.json(
      { success: true, data, nextCursor: page.nextCursor },
      { status: 200 },
    );
  } catch (error) {
    log.error("Exam list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
