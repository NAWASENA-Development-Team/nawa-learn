// src/app/api/consent/accept/route.ts
// ─── Mencatat persetujuan kebijakan ───────────────────────────────────────────
// Dipanggil oleh halaman /consent (gerbang di src/app/(dashboard)/layout.tsx) dan
// bisa juga dipanggil ulang saat kebijakan naik versi.
//
// Yang dicatat hanya dua hal: versi kebijakan yang berlaku saat tombol ditekan,
// dan waktunya. Versi diambil dari konstanta di src/lib/policy.ts, bukan dari
// klien, supaya body tidak bisa mengaku menyetujui versi yang tidak pernah ada.
import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";
import { requireSession } from "@/lib/authz";
import { ensureUserRow } from "@/lib/ensureUser";
import { POLICY_VERSION } from "@/lib/policy";

/**
 * `.strict()` dan `z.literal(POLICY_VERSION)`: body yang menyebut versi lain
 * adalah 400, bukan persetujuan terhadap versi itu. `accept` harus literal
 * `true` — sebuah checkbox yang tidak dicentang tidak boleh menjadi persetujuan
 * hanya karena field-nya ada.
 */
const consentSchema = z
  .object({
    accept: z.literal(true),
    policyVersion: z.literal(POLICY_VERSION),
  })
  .strict();

export async function POST(req: Request) {
  const log = requestLogger(req);
  try {
    const session = await requireSession();
    if (!session.ok) return session.response;

    // Identitas database belum tentu diketahui (baris bisa belum ada), jadi
    // bucket pengguna dilewati dan hanya bucket IP yang berlaku.
    const limit = await rateLimit(req, "consent/accept", null);
    if (!limit.ok) return limit.response;

    const parsed = await parseJsonBody(req, consentSchema);
    if (!parsed.ok) return parsed.response;

    const existing = await db.query.users.findFirst({
      where: eq(users.clerkId, session.clerkId),
      columns: { id: true },
    });

    let userId = existing?.id;

    if (!userId) {
      // Akun ada di Clerk tetapi barisnya belum dibuat (webhook belum jalan).
      // Membuatnya di sini, bukan menolak: pengguna tidak boleh terjebak di
      // layar persetujuan karena masalah sinkronisasi yang bukan salahnya.
      const profile = await currentUser();
      if (!profile) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const created = await ensureUserRow(profile);
      if (!created) {
        log.error("consent: could not provision user row", { clerkId: session.clerkId });
        return NextResponse.json({ error: "Could not provision account" }, { status: 500 });
      }
      userId = created.id;
    }

    const acceptedAt = new Date();
    await db
      .update(users)
      .set({ consentPolicyVersion: POLICY_VERSION, consentAcceptedAt: acceptedAt })
      .where(eq(users.id, userId));

    // Alertable event: "who agreed to which policy, when" is the whole point of
    // this milestone, so it belongs in the log drain as well as in the column.
    log.info("policy_consent_accepted", {
      userId,
      policyVersion: POLICY_VERSION,
      acceptedAt: acceptedAt.toISOString(),
    });

    return NextResponse.json(
      { ok: true, policyVersion: POLICY_VERSION, acceptedAt: acceptedAt.toISOString() },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    log.error("Consent accept error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
