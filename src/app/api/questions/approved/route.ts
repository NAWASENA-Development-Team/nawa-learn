// app/api/questions/approved/route.ts
// Returns approved questions for the practice quiz page.
//
// `answerKey` and `explanation` are deliberately NOT sent to the browser: the
// score is decided server-side in /api/quiz/submit, so the client never needs
// the answers. The review screen gets the correct keys back *after* grading.
// `isOwnQuestion` lets the UI hide a user's own questions from a quiz run.
//
// ## Paginasi (M13)
// Route ini dulu mengembalikan **setiap** soal yang pernah disetujui, tanpa
// batas. Biayanya tumbuh seiring isi platform: pada 5.000 soal, satu kunjungan
// halaman latihan menarik 5.000 baris plus opsi jawabannya. Sekarang ia memakai
// keyset (`?cursor=`) dengan batas atas yang dipaksakan, dan mengembalikan
// `nextCursor` bila masih ada halaman berikutnya.
//
// Halaman latihan mengambil satu halaman saja lalu menyusun kuis dari situ —
// kuis 5.000 soal tidak berguna bagi siapa pun. Nilai default 200 dipilih supaya
// "X soal tersedia" di UI tetap terasa penuh untuk sekolah sebesar ini, tanpa
// membuat responsnya tidak terbatas.
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { questions, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requestLogger } from "@/lib/logger";
import { keysetBefore, pageSlice, readCursor, readLimit } from "@/lib/pagination";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export async function GET(req: Request) {
  const log = requestLogger(req);
  try {
    const { cursor, malformed } = readCursor(req);
    if (malformed) {
      return NextResponse.json(
        { error: "Cursor tidak valid" },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }

    const limit = readLimit(req, { defaultValue: DEFAULT_LIMIT, max: MAX_LIMIT });

    const { userId: clerkId } = await auth();

    // Determine current user's DB ID (null if unauthenticated)
    let currentDbUserId: string | null = null;
    if (clerkId) {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
        columns: { id: true },
      });
      currentDbUserId = dbUser?.id ?? null;
    }

    const rows = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        options: questions.options,
        difficulty: questions.difficulty,
        subject: questions.subject,
        category: questions.category,
        uploaderId: questions.uploaderId,
        uploaderName: users.name,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .innerJoin(users, eq(questions.uploaderId, users.id))
      .where(
        cursor
          ? and(eq(questions.status, "approved"), keysetBefore(questions.createdAt, questions.id, cursor))
          : eq(questions.status, "approved"),
      )
      .orderBy(desc(questions.createdAt), desc(questions.id))
      // Satu baris ekstra: itulah cara `nextCursor` diketahui tanpa COUNT kedua.
      .limit(limit + 1);

    const page = pageSlice(rows, limit);

    // Rebuilt from an allowlist rather than spread-then-delete. `createdAt` is
    // selected only because `pageSlice` needs it to mint the cursor; it was not
    // in this response before M13 and it is not in it now. Listing the fields
    // means a column added to the select above cannot leak by default — the same
    // reason `toPublicExamQuestions` rebuilds instead of redacting.
    const data = page.rows.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
      difficulty: q.difficulty,
      subject: q.subject,
      category: q.category,
      uploaderId: q.uploaderId,
      uploaderName: q.uploaderName,
      isOwnQuestion: currentDbUserId ? q.uploaderId === currentDbUserId : false,
    }));

    return NextResponse.json(
      { success: true, data, nextCursor: page.nextCursor },
      { status: 200 },
    );
  } catch (error) {
    log.error("Approved questions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
