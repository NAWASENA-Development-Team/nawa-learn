// src/app/api/bookmarks/route.ts
// ─── Penanda modul, milik akun (M14) ──────────────────────────────────────────
// Sebelum ini "tersimpan" adalah satu kunci `localStorage` bernama
// `nawa_bookmarks` tanpa id pengguna. Di komputer sekolah yang dipakai
// bergantian, siswa berikutnya melihat modul yang disimpan siswa sebelumnya —
// bug kebenaran sekaligus kebocoran privasi kecil. Data milik seseorang
// disimpan di akun, bukan di perangkat.
//
// Bentuk permintaannya **bukan** "balikkan" (toggle) melainkan "jadikan
// tersimpan / jadikan tidak tersimpan". Toggle di server tidak idempoten:
// satu klik yang terkirim dua kali (jaringan buruk, tombol ditekan ulang) akan
// mengembalikan keadaan ke semula tanpa ada yang menyadarinya. Keadaan yang
// diminta membuat percobaan ulang selalu aman.
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookmarks, modules } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";

// The ids are uuid columns; checking the shape here turns a malformed id into a
// 400 instead of the 500 Postgres raises on a bad cast.
const bookmarkSchema = z
  .object({
    moduleId: z.uuid(),
    bookmarked: z.boolean(),
  })
  .strict();

/** The ids the signed-in user has bookmarked, for the library page's initial render. */
export async function GET(req: Request) {
  const log = requestLogger(req);

  const authz = await requireUser();
  if (!authz.ok) return authz.response;

  try {
    const rows = await db
      .select({ moduleId: bookmarks.moduleId })
      .from(bookmarks)
      .where(eq(bookmarks.userId, authz.user.id));

    return NextResponse.json(
      { moduleIds: rows.map((row) => row.moduleId) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.error("bookmarks_list_failed", { error });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const log = requestLogger(req);

  const authz = await requireUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  // Database id, never a Clerk id: see the note in src/lib/rateLimit.ts.
  const limit = await rateLimit(req, "bookmarks/toggle", user.id);
  if (!limit.ok) return limit.response;

  const parsed = await parseJsonBody(req, bookmarkSchema);
  if (!parsed.ok) return parsed.response;
  const { moduleId, bookmarked } = parsed.data;

  try {
    if (bookmarked) {
      // A bookmark may only point at a module the library actually shows. The
      // foreign key would reject an unknown id anyway, but as a 500; this turns
      // it into the honest 404 and refuses a pending/rejected module too.
      const target = await db.query.modules.findFirst({
        where: and(eq(modules.id, moduleId), eq(modules.status, "approved")),
        columns: { id: true },
      });
      if (!target) {
        return NextResponse.json(
          { error: "Module not found" },
          { status: 404, headers: { "cache-control": "no-store" } },
        );
      }

      // `onConflictDoNothing` makes a repeated request a no-op instead of a
      // unique-violation 500 — the index, not application code, owns idempotency.
      await db.insert(bookmarks).values({ userId: user.id, moduleId }).onConflictDoNothing();
    } else {
      await db
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.moduleId, moduleId)));
    }

    return NextResponse.json(
      { bookmarked },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.error("bookmarks_toggle_failed", { error });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
