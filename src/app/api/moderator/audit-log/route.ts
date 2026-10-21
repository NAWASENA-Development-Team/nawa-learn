// src/app/api/moderator/audit-log/route.ts
// ─── "Siapa memutuskan apa" (M12) ─────────────────────────────────────────────
// Tabel `audit_log` hanya berguna kalau ada yang bisa membacanya. Route ini
// adalah pembacanya: peninjau saja, dengan batas jumlah baris.
//
// Dua hal yang sengaja **tidak** dikembalikan: nama dan surel. Setiap baris
// hanya berisi id, nama tindakan, dan potret skalar (`status`, `role`,
// `pointsAwarded`). Kalau suatu hari seseorang ingin menambahkan nama pelaku ke
// respons ini, ia harus menambah join ke `users` — dan itu akan terlihat jelas
// di diff, bukan menyelinap lewat `before`/`after`.
import { NextResponse } from "next/server";
import { db } from "@/db";
import { requireHumanReviewer } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { AUDIT_ENTITIES, AUDIT_LIST_MAX, listAuditEntries, type AuditEntity } from "@/lib/auditLog";

// Sama dengan pola di `validation.ts`: id yang tidak berbentuk uuid adalah 400,
// bukan query yang mengembalikan nol baris.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const noStore = { "cache-control": "no-store" } as const;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: noStore });
}

export async function GET(req: Request) {
  const log = requestLogger(req);

  // Membaca jejak tindakan moderator lain adalah wewenang peninjau **manusia**,
  // bukan sekadar "punya sesi" — dan bukan wewenang pemegang kursi. Kursi adalah
  // amanah satu musim; riwayat keputusan staf tidak ikut menjadi miliknya.
  const authz = await requireHumanReviewer();
  if (!authz.ok) return authz.response;

  const limit = await rateLimit(req, "moderator/audit-log", authz.user.id);
  if (!limit.ok) return limit.response;

  const params = new URL(req.url).searchParams;

  const entityParam = params.get("entity");
  if (entityParam && !(AUDIT_ENTITIES as readonly string[]).includes(entityParam)) {
    return badRequest(`entity must be one of: ${AUDIT_ENTITIES.join(", ")}`);
  }
  const entity = (entityParam ?? undefined) as AuditEntity | undefined;

  const entityId = params.get("entityId") ?? undefined;
  if (entityId && !UUID_RE.test(entityId)) return badRequest("entityId must be a uuid");

  const actorId = params.get("actorId") ?? undefined;
  if (actorId && !UUID_RE.test(actorId)) return badRequest("actorId must be a uuid");

  const limitParam = params.get("limit");
  let requestedLimit = 50;
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > AUDIT_LIST_MAX) {
      return badRequest(`limit must be an integer between 1 and ${AUDIT_LIST_MAX}`);
    }
    requestedLimit = parsed;
  }

  try {
    const entries = await listAuditEntries(db, {
      entity,
      entityId,
      actorId,
      limit: requestedLimit,
    });

    return NextResponse.json(
      { success: true, count: entries.length, entries },
      { status: 200, headers: noStore },
    );
  } catch (error) {
    log.error("audit log read error", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: noStore },
    );
  }
}
