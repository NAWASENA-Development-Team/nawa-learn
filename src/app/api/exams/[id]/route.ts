// app/api/exams/[id]/route.ts
// ─── Menghapus paket ujian milik sendiri ──────────────────────────────────────
//
// Sebelum M18 paket ujian hanya bisa dibuat dan tidak pernah bisa dihapus: satu
// paket salah yang terlanjur dibuat menetap di daftar semua siswa selamanya.
// Sekarang penulisnya bisa menghapusnya, dan penghapusannya **permanen** —
// termasuk baris `submissions`-nya.
//
// Kenapa permanen, bukan `status = 'deleted'`: sebuah paket yang ditolak atau
// usang tidak punya nilai sejarah yang sebanding dengan risikonya. `submissions`
// menunjuk ke sini lewat `ref_id` yang **tidak** punya foreign key (kolomnya
// varchar-bertipe-id, dipakai bersama modul dan soal), jadi baris antreannya
// harus dihapus bersamaan — kalau tidak, antrean moderator akan menyimpan baris
// yang menunjuk ke paket yang sudah tidak ada, dan setiap peninjauan berikutnya
// menjadi 404 yang membingungkan.
//
// Hanya **pemilik**. Moderator tidak menghapus karya orang lain dari sini; itu
// tindakan take-down yang butuh alurnya sendiri, bukan tombol di samping tombol
// "setujui".
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customExams, submissions } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = requestLogger(req);

  const authz = await requireUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  const limit = await rateLimit(req, "exams/delete", user.id);
  if (!limit.ok) return limit.response;

  const { id } = await params;

  // `custom_exams.id` bertipe uuid: segmen URL yang bukan UUID akan ditolak
  // Postgres dengan `22P02`, dan menangkapnya bersama galat database sungguhan
  // membuat database yang mati terlihat seperti paket yang tidak ada.
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  try {
    const exam = await db.query.customExams.findFirst({
      where: eq(customExams.id, id),
      // `author_id` boleh NULL untuk baris pra-M18; `null !== user.id`, jadi
      // paket tanpa penulis tidak bisa dihapus siapa pun lewat route ini.
      columns: { id: true, authorId: true, title: true },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }
    if (exam.authorId !== user.id) {
      return NextResponse.json(
        { error: "Kamu hanya dapat menghapus paket ujian milikmu sendiri", code: "not_owner" },
        { status: 403 },
      );
    }

    // Antrean lebih dulu, paketnya belakangan: kalau langkah pertama gagal,
    // paketnya masih utuh dan pengguna bisa mencoba lagi. Urutan sebaliknya akan
    // meninggalkan baris antrean yatim yang tidak bisa dibersihkan dari UI mana
    // pun.
    await db
      .delete(submissions)
      .where(and(eq(submissions.refId, id), eq(submissions.type, "exam")));

    await db.delete(customExams).where(eq(customExams.id, id));

    log.info("exam_deleted", { examId: id, userId: user.id });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    log.error("Exam delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
