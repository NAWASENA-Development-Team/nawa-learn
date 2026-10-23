// src/app/api/modules/[id]/file/route.ts
// ─── Bytes modul lama, disajikan saat diminta ─────────────────────────────────
//
// Sebelum M21 halaman perpustakaan mengirim `modules.content_url` **apa adanya**
// untuk setiap modul, dan tiga baris lama menyimpan PDF sebagai base64 di kolom
// itu. Artinya ±1,9 MB base64 ikut di payload setiap kunjungan — bahkan untuk
// siswa yang tidak membuka satu modul pun — lalu di-`atob()` di main thread saat
// modulnya dibuka. Halaman terasa berat, dan PDF yang gagal dirender terasa
// seperti file corrupt.
//
// Route ini mengembalikan isi file sebagai `application/pdf` / `image/*` biasa,
// sehingga klien cukup memuatnya saat benar-benar dibutuhkan. Kontraknya sempit
// dengan sengaja: **hanya** baris `data:` yang dilayani di sini. Bytes yang
// sudah berada di object storage punya URL sendiri, dan host eksternal tidak
// boleh diproksikan lewat fungsi kita.
//
// Penjaganya `requireUser()`, bukan `requireSession()`: route ini mengeluarkan
// isi karya orang lain, jadi ia harus tahu siapa yang meminta (dan rate limiter
// membutuhkan id baris database untuk bucket per pengguna).
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { modules } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { isUuid } from "@/lib/ids";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";

/** Hanya tipe yang boleh keluar dari route ini — bukan seluruh isi `data:`. */
const SERVED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Pisahkan data URI menjadi mime + byte.
 *
 * `Buffer.from(x, "base64")` mengabaikan karakter di luar alfabet base64, jadi
 * varian yang mengandung baris baru tetap terdekode benar. Bentuk **tanpa**
 * `;base64` (persen-encoding) juga ditangani: kalau tidak, satu baris lama yang
 * tidak base64 akan diam-diam menjadi file kosong — persis gejala "file corrupt"
 * yang route ini ada untuk menghapusnya.
 */
/**
 * Persen-encoding → byte, satu per satu.
 *
 * `decodeURIComponent` tidak bisa dipakai di sini: sebuah data URI boleh memuat
 * byte mentah seperti `%89` yang bukan UTF-8, dan fungsi itu melempar `URIError`
 * — hasilnya file kosong yang terlihat seperti korup. Dekode per byte tidak
 * pernah gagal.
 */
function percentToBytes(payload: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < payload.length; i += 1) {
    if (payload[i] === "%" && i + 2 < payload.length) {
      const byte = Number.parseInt(payload.slice(i + 1, i + 3), 16);
      if (Number.isNaN(byte)) {
        out.push(payload.charCodeAt(i) & 0xff);
        continue;
      }
      out.push(byte);
      i += 2;
      continue;
    }
    out.push(payload.charCodeAt(i) & 0xff);
  }
  return new Uint8Array(out);
}

function decodeDataUri(uri: string): { mime: string; bytes: Uint8Array } | null {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(uri);
  if (!match) return null;

  const [, mime, base64Flag, payload] = match;
  if (!(mime in SERVED_TYPES)) return null;

  const bytes = base64Flag
    ? new Uint8Array(Buffer.from(payload, "base64"))
    : percentToBytes(payload);

  return bytes.byteLength === 0 ? null : { mime, bytes };
}

/** Nama file yang aman untuk `content-disposition`. */
function safeFilename(title: string, extension: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return `${base || "modul"}.${extension}`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const log = requestLogger(req);

  const authz = await requireUser();
  if (!authz.ok) return authz.response;

  const limit = await rateLimit(req, "modules/file", authz.user.id);
  if (!limit.ok) return limit.response;

  const { id } = await params;

  // `modules.id` bertipe uuid: segmen yang bukan UUID akan membuat Postgres
  // menjawab `22P02`, dan menangkapnya bersama galat database sungguhan membuat
  // database yang mati terlihat seperti modul yang tidak ada.
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  let row: { contentUrl: string; status: string; title: string } | undefined;
  try {
    row = await db.query.modules.findFirst({
      where: eq(modules.id, id),
      columns: { contentUrl: true, status: true, title: true },
    });
  } catch (error) {
    // Database yang sedang bermasalah tidak boleh terlihat seperti modul yang
    // tidak ada; galatnya masuk log, pemanggilnya mendapat 500 yang jujur.
    log.error("Failed to read module content", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  // Hanya modul yang sudah disetujui yang bisa dibaca lewat perpustakaan.
  // `pending` dijawab 404, bukan 403: membedakan "ada tapi tidak boleh" dari
  // "tidak ada" cukup untuk menyebutkan isi karya orang lain yang belum dinilai.
  if (!row || row.status !== "approved") {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const decoded = decodeDataUri(row.contentUrl);
  if (!decoded) {
    // Modul yang diunggah setelah M10 hidup di object storage dan punya URL
    // sendiri; modul eksternal adalah iframe. Keduanya bukan urusan route ini.
    return NextResponse.json(
      { error: "Module content is not served from this route", code: "not_inline_content" },
      { status: 400 },
    );
  }

  const download = new URL(req.url).searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(decoded.bytes), {
    status: 200,
    headers: {
      "content-type": decoded.mime,
      "content-length": String(decoded.bytes.byteLength),
      // `inline` supaya pembaca bisa memuatnya ke <canvas> tanpa dialog unduh.
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${safeFilename(
        row.title,
        SERVED_TYPES[decoded.mime],
      )}"`,
      // Pribadi: isinya karya siswa yang hanya boleh dibaca pemegang sesi.
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
