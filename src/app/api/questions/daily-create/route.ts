// app/api/questions/daily-create/route.ts
// Reviewer-only endpoint to create daily quiz questions directly (auto-approved).
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dailyQuizSlot, questions, submissions, users } from "@/db/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireReviewer } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { parseJsonBody, shortText } from "@/lib/validation";
import { startOfDailyWindow } from "@/lib/dailyWindow";

// A question written straight into the daily quiz, so it is approved on arrival
// and never passes a reviewer. The schema is therefore the only gate: A and B
// are mandatory, C and D are required too because the daily quiz always renders
// four options, and the answer key has to point at a non-empty option.
const dailyQuestionSchema = z
  .object({
    questionText: shortText(2000, 10),
    options: z
      .object({
        A: shortText(500),
        B: shortText(500),
        C: shortText(500),
        D: shortText(500),
        E: shortText(500).optional(),
      })
      .strict(),
    answerKey: z.enum(["A", "B", "C", "D", "E"]),
    difficulty: z.enum(["mudah", "sedang", "sulit"]),
    subject: shortText(100, 2).optional().default("Umum"),
  })
  .strict()
  .refine((data) => Boolean(data.options[data.answerKey]), {
    message: "Answer key must match one of the provided options",
    path: ["answerKey"],
  });

/** Satu soal hari ini, dikirim ke panel peninjau — termasuk kunci jawabannya. */
const activeColumns = {
  id: true,
  questionText: true,
  options: true,
  answerKey: true,
  difficulty: true,
  subject: true,
  createdAt: true,
} as const;

type ActiveQuestion = {
  id: string;
  questionText: string;
  options: unknown;
  answerKey: string;
  difficulty: string;
  subject: string | null;
  createdAt: Date;
};

export async function POST(req: Request) {
  const log = requestLogger(req);
  // Auto-approved content, so reviewers only — staff or a seated season moderator.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;
  const dbUser = authz.user;

  try {
    const parsed = await parseJsonBody(req, dailyQuestionSchema);
    if (!parsed.ok) return parsed.response;
    const { questionText, options, answerKey, difficulty, subject } = parsed.data;

    // Satu hari, satu slot. Primary key `window_start` tetap yang memutuskan
    // pemenangnya — tidak ada SELECT yang bisa dilewati dua permintaan bersamaan.
    //
    // Sejak M18b **kurasi mengalahkan pengisian otomatis**: `ensureDailySlot()`
    // mengisi slot setiap jendela baru dengan `author_id = NULL`, sehingga tanpa
    // aturan ini peninjau tidak pernah bisa mengurasi (slot selalu "sudah
    // terisi") dan satu-satunya cara mengganti soal adalah menghapus soal dari
    // bank — persis yang menggerus bank soal. `UPDATE` bersyarat di bawah
    // mengganti slot yang masih otomatis, kurasi milik sendiri, atau slot basi.
    const windowStart = startOfDailyWindow();

    // Insert question directly as approved with category "Kuis Harian"
    const [newQuestion] = await db
      .insert(questions)
      .values({
        questionText,
        options,
        answerKey,
        difficulty,
        subject,
        category: "Kuis Harian",
        uploaderId: dbUser.id,
        status: "approved", // Auto-approved since a reviewer creates it
      })
      .returning();

    const replaced = await db
      .update(dailyQuizSlot)
      .set({ questionId: newQuestion.id, authorId: dbUser.id })
      .where(
        and(
          eq(dailyQuizSlot.windowStart, windowStart),
          or(
            // Otomatis (`author_id` NULL) — kurasi selalu boleh menggantinya.
            isNull(dailyQuizSlot.authorId),
            // Kurasi sendiri — satu soal aktif per hari, boleh diganti.
            eq(dailyQuizSlot.authorId, dbUser.id),
            // Slot basi: soal yang ditunjuk sudah tidak disetujui (mis. dihapus
            // dari bank). Slot seperti ini harus bisa diperbaiki peninjau mana
            // pun, kalau tidak hari itu terkunci pada soal pengganti.
            sql`not exists (
              select 1 from ${questions}
              where ${questions.id} = ${dailyQuizSlot.questionId}
                and ${questions.status} = 'approved'
            )`,
          ),
        ),
      )
      .returning({ windowStart: dailyQuizSlot.windowStart });

    // Tidak ada baris yang diganti: hari ini belum punya slot sama sekali, atau
    // slotnya milik peninjau lain. `ON CONFLICT DO NOTHING` memutuskan yang
    // pertama tanpa balapan INSERT-then-SELECT.
    const claimed =
      replaced.length > 0
        ? replaced
        : await db
            .insert(dailyQuizSlot)
            .values({ windowStart, questionId: newQuestion.id, authorId: dbUser.id })
            .onConflictDoNothing()
            .returning({ windowStart: dailyQuizSlot.windowStart });

    if (claimed.length === 0) {
      // Kalah: hari ini sudah dikurasi peninjau lain. Soal tetap **disimpan**
      // sebagai soal `approved` di bank — ia akan ikut berputar sebagai soal
      // otomatis di hari lain. Menghapusnya (perilaku sebelum M18b) membuat satu
      // moderator yang kalah cepat mengurangi bank soal secara permanen.
      return NextResponse.json(
        {
          error:
            "Kuis Harian hari ini sudah dikurasi peninjau lain. Soalmu tetap tersimpan di bank soal.",
          code: "daily_slot_taken",
        },
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }

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
      replaced: replaced.length > 0,
      message:
        replaced.length > 0
          ? "Soal aktif hari ini berhasil diganti!"
          : "Soal Kuis Harian berhasil ditambahkan!",
    });
  } catch (error) {
    log.error("Daily question create error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// GET: today's active slot plus the curated bank, for the reviewer panel.
//
// Sebelum M18b endpoint ini hanya mengembalikan **semua** soal berkategori
// "Kuis Harian" sejak platform berdiri, dan panelnya menjuduli daftar itu "Soal
// Kuis Harian Aktif". Akibatnya soal kemarin tampak masih aktif hari ini —
// padahal slot hari ini bisa berisi soal lain yang dipilih otomatis — dan
// moderator menghapus soal dari bank untuk "mengganti" soal yang tidak
// berhubungan dengannya. `active` sekarang dibaca dari `daily_quiz_slot` jendela
// berjalan, bukan dari daftar.
export async function GET(req: Request) {
  const log = requestLogger(req);
  // Includes answer keys — reviewers only.
  const authz = await requireReviewer();
  if (!authz.ok) return authz.response;
  const dbUser = authz.user;

  try {
    const windowStart = startOfDailyWindow();

    const slot = await db.query.dailyQuizSlot.findFirst({
      where: eq(dailyQuizSlot.windowStart, windowStart),
      columns: { windowStart: true, questionId: true, authorId: true },
    });

    let active = null as null | {
      windowStart: string;
      source: "auto" | "curated";
      authorName: string | null;
      question: ActiveQuestion;
    };
    let staleSlot = false;

    if (slot) {
      // Satu query, dengan syarat `approved` ikut di dalamnya: slot yang
      // menunjuk soal non-aktif adalah slot basi, bukan soal hari ini.
      const question = await db.query.questions.findFirst({
        where: and(
          eq(questions.id, slot.questionId),
          eq(questions.status, "approved"),
        ),
        columns: activeColumns,
      });

      if (!question) {
        // Siswa tetap mendapat soal pengganti dari jaring pengaman
        // `resolveDailyQuestion()`; panel harus mengatakan itu, bukan
        // menampilkan soal mati sebagai aktif.
        staleSlot = true;
      } else {
        const author = slot.authorId
          ? await db.query.users.findFirst({
              where: eq(users.id, slot.authorId),
              columns: { name: true },
            })
          : null;

        active = {
          windowStart: slot.windowStart.toISOString(),
          source: slot.authorId ? "curated" : "auto",
          authorName: author?.name ?? null,
          question: question as ActiveQuestion,
        };
      }
    }

    // Bank kurasi: hanya yang masih `approved`, karena yang `rejected` tidak
    // bisa dipakai lagi — dan daftar yang menampilkannya membuat tombol hapus
    // tampak tidak bekerja setelah halaman dimuat ulang.
    const curated = await db.query.questions.findMany({
      where: and(eq(questions.category, "Kuis Harian"), eq(questions.status, "approved")),
      columns: activeColumns,
      orderBy: (q, { desc }) => [desc(q.createdAt)],
    });

    return NextResponse.json({
      success: true,
      active,
      staleSlot,
      // Apakah POST berikutnya akan mengaktifkan soal hari ini atau hanya
      // menyimpannya di bank. Dihitung server karena klien tidak memegang id
      // pengguna, dan aturan yang sama harus dipakai kedua endpoint.
      canReplace:
        !slot ||
        slot.authorId === null ||
        slot.authorId === dbUser.id ||
        staleSlot,
      curated,
    });
  } catch (error) {
    log.error("Daily questions list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
