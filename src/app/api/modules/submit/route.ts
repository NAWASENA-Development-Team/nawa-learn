// app/api/modules/submit/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { modules, submissions } from "@/db/schema";
import { requireUser } from "@/lib/authz";
import { requestLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { httpUrl, parseJsonBody, shortText } from "@/lib/validation";

// Validate incoming request body using Zod.
//
// `contentUrl` used to accept a `data:` URL as well, which is how whole PDFs
// ended up inside a text column. Binary content now goes through /api/uploads,
// which hands back an https URL; a link pasted from Google Drive is still fine.
const submitSchema = z
  .object({
    title: shortText(200, 5),
    subject: shortText(100, 2),
    grade: shortText(50).optional().default("Umum"),
    category: shortText(100, 2),
    contentUrl: httpUrl(),
  })
  .strict();

export async function POST(req: Request) {
  const log = requestLogger(req);
  try {
    // 1. Authenticate and authorise. M14d replaced the hand-rolled auth + lookup
    //    here; `requireUser()` answers 401 for no session and 403 for a session
    //    with no provisioned row, the same as every other protected route.
    //
    //    Note the order: the body is parsed *after* the guard and the rate limit.
    //    This route used to parse the body first, so an unauthenticated caller
    //    could make the server parse and validate a payload before discovering it
    //    had no business sending one.
    const authz = await requireUser();
    if (!authz.ok) return authz.response;
    const dbUser = authz.user;

    if (dbUser.role === "student") {
      return NextResponse.json({ 
        error: "Hanya kontributor yang dapat mengunggah modul" 
      }, { status: 403 });
    }

    // Kursi Dewan Podium **tidak** boleh mengunggah (I2).
    //
    // Pemegang kursi memegang `role = 'moderator'` selama masa jabatannya, jadi
    // tanpa penjaga ini ia otomatis mewarisi hak unggah staf. Kursi adalah
    // amanah menilai, bukan hak menerbitkan: kalau kursi boleh mengunggah dan
    // menilai, ia bisa menerbitkan karyanya sendiri (dan itu sebabnya
    // `questions/approve` juga menolak tinjauan atas kiriman sendiri).
    //
    // Kuncinya `season_role_key`, bukan "kursi masih aktif": peran yang berasal
    // dari musim tidak pernah memberi hak unggah, termasuk pada hari terakhir
    // sebelum cron mencabutnya.
    if (dbUser.seasonRoleKey !== null) {
      return NextResponse.json(
        {
          error: "Pemegang kursi Dewan Podium tidak dapat mengunggah modul.",
          code: "seat_cannot_upload",
        },
        { status: 403 },
      );
    }

    const limit = await rateLimit(req, "modules/submit", dbUser.id);
    if (!limit.ok) return limit.response;

    // 2. Parse and validate the request body
    const parsed = await parseJsonBody(req, submitSchema, { message: "Invalid data" });
    if (!parsed.ok) return parsed.response;
    const validatedData = parsed.data;

    // 3. Insert module into database
    // Note: neon-http driver does not support transactions, use sequential inserts
    let newModule;
    try {
      const [insertedModule] = await db.insert(modules).values({
        title: validatedData.title,
        subject: validatedData.subject,
        grade: validatedData.grade || "Umum",
        category: validatedData.category,
        contentUrl: validatedData.contentUrl,
        uploaderId: dbUser.id,
        status: "pending",
      }).returning({ id: modules.id });
      newModule = insertedModule;
    } catch (moduleError) {
      log.error("Module insert error:", moduleError);
      return NextResponse.json({ 
        error: "Failed to save module. Please try again." 
      }, { status: 500 });
    }

    // 4. Insert submission record for moderation queue
    try {
      await db.insert(submissions).values({
        type: "module",
        refId: newModule.id,
        submitterId: dbUser.id,
        status: "pending",
      });
    } catch (submissionError) {
      log.error("submission record insert failed", { error: submissionError });
      // Module was inserted, still return success but log the issue
      log.warn("module inserted but its submission record was not created", {
        moduleId: newModule.id,
      });
    }

    const result = newModule;

    return NextResponse.json({ success: true, moduleId: result.id }, { status: 201 });

  } catch (error) {
    log.error("Unexpected submission error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error. Please try again later." 
    }, { status: 500 });
  }
}
