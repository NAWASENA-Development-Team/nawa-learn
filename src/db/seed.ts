// src/db/seed.ts
// ─── Development seed data ────────────────────────────────────────────────────
// Writes fake users and modules so the UI has something to show.
//
// This script used to be called `insert_data.ts` and ran unconditionally against
// whatever `DATABASE_URL` pointed at — including production. It now refuses to
// run unless you explicitly opt in:
//
//   ALLOW_SEED=1 npm run db:seed
//
// It is also idempotent: re-running it will not pile up duplicate modules.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import * as schema from "./schema";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const targetHost = (() => {
  try {
    return new URL(databaseUrl).host;
  } catch {
    return "(unparsable DATABASE_URL)";
  }
})();

if (process.env.ALLOW_SEED !== "1") {
  console.error("Refusing to seed.");
  console.error(`  Target: ${targetHost}`);
  console.error("  This script writes fake rows. Re-run with ALLOW_SEED=1 to confirm:");
  console.error("    ALLOW_SEED=1 npm run db:seed");
  process.exit(1);
}

console.log(`Seeding ${targetHost} ...`);

const sql = neon(databaseUrl);
const db = drizzle(sql, { schema });

const DUMMY_CLERK_ID = "user_test_clerk_12345";

const modulesToInsert = [
  {
    title: "Biologi Keren — Genetika dan Rekayasa Kromosom",
    subject: "Biologi",
    grade: "Kelas XII",
    category: "UTBK",
    contentUrl: "https://drive.google.com/file/d/genetika-test/view",
    status: "pending" as const,
    downloads: 12,
  },
  {
    title: "Matematika Cepat — Trik Integral Parsial & Substitusi",
    subject: "Matematika",
    grade: "Kelas XI",
    category: "Reguler",
    contentUrl: "https://drive.google.com/file/d/integral-trik/view",
    status: "approved" as const,
    downloads: 45,
  },
  {
    title: "Fisika Asyik — Hukum Newton & Dinamika Rotasi",
    subject: "Fisika",
    grade: "Kelas X",
    category: "Olimpiade",
    contentUrl: "https://drive.google.com/file/d/fisika-rotasi/view",
    status: "approved" as const,
    downloads: 28,
  },
];

async function run() {
  const [dummyUser] = await db
    .insert(schema.users)
    .values({
      clerkId: DUMMY_CLERK_ID,
      name: "Ahmad Kontributor",
      email: "ahmad.kontributor@sman2jonggol.sch.id",
      role: "contributor",
      points: 150,
    })
    .onConflictDoUpdate({
      target: schema.users.clerkId,
      set: { name: "Ahmad Kontributor" },
    })
    .returning({ id: schema.users.id });

  console.log(`User ready: ${dummyUser.id}`);

  for (const mod of modulesToInsert) {
    const existing = await db.query.modules.findFirst({
      where: and(eq(schema.modules.title, mod.title), eq(schema.modules.uploaderId, dummyUser.id)),
      columns: { id: true },
    });
    if (existing) {
      console.log(`Skipped (already present): ${mod.title}`);
      continue;
    }

    const [inserted] = await db
      .insert(schema.modules)
      .values({ ...mod, uploaderId: dummyUser.id })
      .returning({ id: schema.modules.id });
    console.log(`Inserted "${mod.title}" → ${inserted.id}`);
  }

  console.log("Seed complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
