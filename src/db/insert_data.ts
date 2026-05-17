// src/db/insert_data.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = neon(databaseUrl);
const db = drizzle(sql, { schema });

async function run() {
  console.log("Connecting to database and running script...");

  // 1. Create a dummy uploader user
  const [dummyUser] = await db.insert(schema.users).values({
    clerkId: "user_test_clerk_12345",
    name: "Ahmad Kontributor",
    email: "ahmad.kontributor@sman2jonggol.sch.id",
    role: "contributor",
    points: 150,
  }).onConflictDoUpdate({
    target: schema.users.clerkId,
    set: { name: "Ahmad Kontributor" }
  }).returning({ id: schema.users.id });

  console.log("User successfully created/synced: ", dummyUser.id);

  // 2. Insert 3 new sample modules
  const modulesToInsert = [
    {
      title: "Biologi Keren — Genetika dan Rekayasa Kromosom",
      subject: "Biologi",
      grade: "Kelas XII",
      category: "UTBK",
      contentUrl: "https://drive.google.com/file/d/genetika-test/view",
      uploaderId: dummyUser.id,
      status: "pending" as const,
      downloads: 12,
    },
    {
      title: "Matematika Cepat — Trik Integral Parsial & Substitusi",
      subject: "Matematika",
      grade: "Kelas XI",
      category: "Reguler",
      contentUrl: "https://drive.google.com/file/d/integral-trik/view",
      uploaderId: dummyUser.id,
      status: "approved" as const,
      downloads: 45,
    },
    {
      title: "Fisika Asyik — Hukum Newton & Dinamika Rotasi",
      subject: "Fisika",
      grade: "Kelas X",
      category: "Olimpiade",
      contentUrl: "https://drive.google.com/file/d/fisika-rotasi/view",
      uploaderId: dummyUser.id,
      status: "approved" as const,
      downloads: 28,
    }
  ];

  console.log("Inserting modules...");
  for (const mod of modulesToInsert) {
    const [insertedModule] = await db.insert(schema.modules).values(mod).returning({ id: schema.modules.id });
    console.log(`Module "${mod.title}" successfully inserted with ID: ${insertedModule.id}`);
  }

  console.log("All data successfully inserted!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Error executing script:", err);
  process.exit(1);
});
