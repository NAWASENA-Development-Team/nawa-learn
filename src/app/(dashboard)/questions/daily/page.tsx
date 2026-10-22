import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { dailyActivity } from "@/db/schema";
import DailyQuizClient from "@/components/questions/DailyQuizClient";
import { getCurrentUser } from "@/lib/currentUser";
import { resolveDailyQuestion } from "@/lib/dailySession";
import { startOfDailyWindow } from "@/lib/dailyWindow";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Kuis Harian: **satu** soal per jendela, satu percobaan, dan hadiah hanya untuk
 * jawaban benar.
 *
 * ## Kenapa halaman ini tidak lagi menyusun sesi dua puluh soal
 *
 * Sampai M17 halaman ini membangun sesi hibrida: soal slot hari ini ditambah
 * sampai 19 soal `approved` yang belum pernah dijawab pengguna. Alasannya masuk
 * akal saat itu — bank soal kurasi tipis, dan satu siswa rajin bisa menghabiskan
 * kategori "Kuis Harian" lalu tidak bisa mengklaim +25 selamanya. Tetapi
 * konsekuensinya: halaman disusun ulang setiap kali dimuat, jadi siswa yang
 * salah cukup me-refresh untuk mendapat soal lain, dan hadiah +25 dibayar untuk
 * partisipasi apa pun.
 *
 * Sekarang yang dibaca adalah **fakta**, bukan sesi:
 *   1. sudah ada `daily_activity` untuk jendela ini → `done`, apa pun isi bank;
 *   2. belum ada → satu soal dari `resolveDailyQuestion()`;
 *   3. bank kosong → `empty`, dan halaman mengatakannya.
 *
 * Langkah 1 juga menutup celah "refresh dapat soal baru": percobaan hari ini
 * sudah tercatat, jadi tidak ada soal yang ditampilkan lagi.
 */
export default async function DailyQuizPage() {
  const user = await getCurrentUser();
  const windowStart = startOfDailyWindow();

  if (user) {
    const today = await db
      .select({ isCorrect: dailyActivity.isCorrect })
      .from(dailyActivity)
      .where(
        and(
          eq(dailyActivity.userId, user.id),
          eq(dailyActivity.windowStart, windowStart),
        ),
      )
      .limit(1);

    if (today.length > 0) {
      return <DailyQuizClient status="done" isCorrect={today[0].isCorrect} />;
    }
  }

  const question = await resolveDailyQuestion(db, {
    userId: user?.id ?? null,
    now: windowStart,
    log: logger,
  });

  if (!question) {
    return <DailyQuizClient status="empty" />;
  }

  return (
    <DailyQuizClient
      status="ready"
      question={{
        id: question.id,
        questionText: question.questionText,
        options: question.options,
      }}
    />
  );
}
