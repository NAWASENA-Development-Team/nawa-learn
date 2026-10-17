// src/app/api/profile/export/route.ts
// ─── "Ekspor data saya" (UU PDP) ──────────────────────────────────────────────
// GET, karena ini pembacaan yang tidak mengubah apa pun. Sengaja **tidak**
// mengembalikan JSON sebagai default tanpa nama berkas: browser harus
// mengunduhnya sebagai berkas, bukan menampilkannya di tab, supaya hasilnya bisa
// disimpan dan diperiksa.
//
// Penjagaannya sama seperti route lain: requireUser() → rateLimit() → baru
// membaca input. Route handler tidak berada di bawah src/app/(dashboard)/layout.tsx,
// jadi gerbang consent tidak berlaku di sini; yang berlaku adalah requireUser()
// dan pembatasan laju.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { collectUserData, exportUserDataCsv } from "@/lib/accountData";

export const maxDuration = 30;

export async function GET(req: Request) {
  const log = requestLogger(req);

  const authz = await requireUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  // Identitas database, bukan Clerk id: lihat catatan di src/lib/rateLimit.ts.
  const limit = await rateLimit(req, "profile/export", user.id);
  if (!limit.ok) return limit.response;

  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    const data = await collectUserData(db, user.id);

    log.info("account_data_exported", {
      userId: user.id,
      format,
      modules: data.modul.length,
      questions: data.soal.length,
    });

    if (format === "csv") {
      // BOM di depan supaya Excel di Windows membaca UTF-8, bukan Latin-1 —
      // tanpa itu nama bermata pelajaran beraksen berubah menjadi mojibake.
      const csv = `\uFEFF${exportUserDataCsv(data)}`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="nawa-learn-data-${stamp}.csv"`,
          "cache-control": "no-store",
        },
      });
    }

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="nawa-learn-data-${stamp}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    log.error("Account export error:", error);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
