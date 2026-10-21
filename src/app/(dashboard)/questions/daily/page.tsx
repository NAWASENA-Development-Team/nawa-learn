import { db } from "@/db";
import { dailyQuizSlot, pointsLog, questions } from "@/db/schema";
import { and, desc, eq, ne, notInArray, sql } from "drizzle-orm";
import DailyQuizClient from "@/components/questions/DailyQuizClient";
import { getCurrentUser } from "@/lib/currentUser";
import { startOfDailyWindow } from "@/lib/dailyWindow";

export const dynamic = "force-dynamic";

/**
 * How many questions one daily session contains.
 *
 * The cap used to be applied in the browser, which meant every question in the
 * category crossed the network so that most of them could be thrown away. It is
 * applied here instead: the server picks the session, and the client renders it.
 */
const SESSION_SIZE = 20;

/** Kolom yang boleh menyeberang ke browser. `answerKey` tidak pernah ikut. */
const QUESTION_COLUMNS = {
  id: true,
  questionText: true,
  options: true,
} as const;

/** Bentuk kolom yang sama untuk `db.select()`, yang butuh referensi kolom. */
const QUESTION_FIELDS = {
  id: questions.id,
  questionText: questions.questionText,
  options: questions.options,
};

type SessionQuestion = {
  id: string;
  questionText: string;
  // `options` is a jsonb column, so drizzle can only type it as `unknown`.
  // Every writer goes through `questionSubmitSchema` in
  // `src/app/api/questions/submit/route.ts`, which is `.strict()` and types
  // the four options as strings, so a non-string value cannot be stored.
  options: Record<string, string>;
};

/** Satu-satunya tempat `options` yang bertipe `unknown` diberi bentuk. */
function toSessionQuestion(row: {
  id: string;
  questionText: string;
  options: unknown;
}): SessionQuestion {
  return {
    id: row.id,
    questionText: row.questionText,
    options: row.options as Record<string, string>,
  };
}

/**
 * Sesi kuis harian: satu soal kurasi hari ini, lalu bank `approved` yang belum
 * pernah dijawab pengguna ini.
 *
 * ## Kenapa bukan hanya kategori "Kuis Harian"
 *
 * Sampai M16 satu-satunya pintu masuk soal adalah `api/questions/daily-create`,
 * hanya untuk peninjau, tanpa antrean. Bank `approved` yang sudah ada — aset
 * terbesar platform — tidak pernah dipakai. Ketika tiga peninjau sibuk, seluruh
 * sekolah kehabisan soal; ketika satu siswa rajin, ia menghabiskan kategori itu
 * dan **tidak bisa mengklaim +25 lagi selamanya**, karena satu soal hanya bisa
 * dijawab sekali per pengguna.
 *
 * Sesi sekarang hibrida: soal slot hari ini (kalau ada) + sampai 19 soal
 * `approved` lain yang belum pernah dijawab pengguna ini dan bukan karyanya
 * sendiri. Tanpa tabel baru, tanpa kolom baru, tanpa mengubah alur poin.
 *
 * ## Kenapa urutannya deterministik, bukan acak
 *
 * Urutan lama diacak di server. Dengan pasokan hibrida, pengacakan justru
 * merugikan: soal `sulit` bisa muncul di pembuka sesi, dan tidak ada cara
 * memastikan soal yang lebih mudah benar-benar terpakai lebih dulu. Urutan
 * sekarang adalah **prioritas pemilihan**: slot hari ini, lalu kategori
 * "Kuis Harian", lalu sisa bank; di dalamnya mudah → sedang → sulit, lalu
 * terbaru. Soal yang sudah dijawab tidak pernah muncul lagi, jadi sesi tetap
 * bergerak maju tanpa undian.
 *
 * Soal karya sendiri dikecualikan karena `quiz/submit` memang tidak memberi poin
 * untuknya — menampilkannya hanya membuang satu slot dari dua puluh.
 */
export default async function DailyQuizPage() {
  const user = await getCurrentUser();

  // Tanpa pengguna, tidak ada riwayat jawaban untuk disaring; sesi dibangun dari
  // soal kurasi saja. Halaman ini berada di balik gerbang auth, jadi cabang ini
  // praktis tidak terjadi — tetapi harus tetap benar bila terjadi.
  const answeredIds = user
    ? (
        await db
          .select({ refId: pointsLog.refId })
          .from(pointsLog)
          .where(and(eq(pointsLog.userId, user.id), eq(pointsLog.action, "quiz_answer")))
      )
        .map((row) => row.refId)
        .filter((id): id is string => id !== null)
    : [];

  // Soal kurasi hari ini, bila sudah ada. Bisa berasal dari `daily-create`
  // (kategori "Kuis Harian") atau dari fallback cron yang mengambil soal bank
  // umum — karena itu ia diambil lewat slot, bukan lewat kategori.
  const slot = await db.query.dailyQuizSlot.findFirst({
    where: eq(dailyQuizSlot.windowStart, startOfDailyWindow()),
    columns: { questionId: true },
  });

  const slotQuestion =
    slot && !answeredIds.includes(slot.questionId)
      ? await db.query.questions.findFirst({
          where: and(eq(questions.id, slot.questionId), eq(questions.status, "approved")),
          columns: QUESTION_COLUMNS,
        })
      : undefined;

  const remaining = SESSION_SIZE - (slotQuestion ? 1 : 0);

  const filters = [eq(questions.status, "approved")];
  if (answeredIds.length > 0) filters.push(notInArray(questions.id, answeredIds));
  if (user) filters.push(ne(questions.uploaderId, user.id));
  if (slotQuestion) filters.push(ne(questions.id, slotQuestion.id));

  // Prioritas: kategori "Kuis Harian" dulu, lalu mudah → sedang → sulit, lalu
  // terbaru. `id` sebagai kunci terakhir supaya urutan tidak berubah di antara
  // dua pemuatan halaman ketika `created_at` sama.
  const pool = await db
    .select(QUESTION_FIELDS)
    .from(questions)
    .where(and(...filters))
    .orderBy(
      sql`CASE WHEN ${questions.category} = 'Kuis Harian' THEN 0 ELSE 1 END`,
      sql`CASE ${questions.difficulty} WHEN 'mudah' THEN 0 WHEN 'sedang' THEN 1 ELSE 2 END`,
      desc(questions.createdAt),
      desc(questions.id),
    )
    .limit(remaining);

  const sessionQuestions: SessionQuestion[] = [
    ...(slotQuestion ? [toSessionQuestion(slotQuestion)] : []),
    ...pool.map(toSessionQuestion),
  ];

  return <DailyQuizClient initialQuestions={sessionQuestions} />;
}
