// app/api/seed/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";

export async function GET() {
  try {
    console.log("Running seed script via API...");

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
    const insertedIds = [];
    for (const mod of modulesToInsert) {
      const [insertedModule] = await db.insert(schema.modules).values(mod).returning({ id: schema.modules.id });
      insertedIds.push(insertedModule.id);
      console.log(`Module "${mod.title}" successfully inserted with ID: ${insertedModule.id}`);
    }

    return NextResponse.json({
      success: true,
      message: "Seed data successfully inserted!",
      userId: dummyUser.id,
      insertedIds
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error executing seed via API:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Unknown error"
    }, { status: 500 });
  }
}
