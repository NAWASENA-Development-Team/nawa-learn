// tests/integration/modules-download.test.ts
// The download counter used to take whatever `moduleId` it was given and hand it
// straight to Postgres, so a malformed id surfaced as a 500 from a failed uuid
// cast. It is a 400 now, and that is the behaviour worth pinning.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import { POST as download } from "@/app/api/modules/download/route";
import * as schema from "@/db/schema";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
}, 60_000);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function post(body: unknown): Request {
  return new Request("https://nawa.test/api/modules/download", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seedModule() {
  const user = await seedUser(db, {});
  const [row] = await db
    .insert(schema.modules)
    .values({
      title: "Modul Uji",
      subject: "Matematika",
      grade: "12",
      category: "UTBK",
      contentUrl: "https://store123.public.blob.vercel-storage.com/uploads/u1/modul.pdf",
      uploaderId: user.id,
      status: "approved",
    })
    .returning();
  return row;
}

describe("POST /api/modules/download", () => {
  it("answers 400 for a malformed id instead of a database error", async () => {
    const response = await download(post({ moduleId: "not-a-uuid" }));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { details: { path: string }[] };
    expect(body.details.map((detail) => detail.path)).toContain("moduleId");
  });

  it("answers 400 for a missing id", async () => {
    const response = await download(post({}));

    expect(response.status).toBe(400);
  });

  it("answers 400 for an unknown key", async () => {
    const response = await download(post({ moduleId: crypto.randomUUID(), extra: 1 }));

    expect(response.status).toBe(400);
  });

  it("increments the counter for a real module", async () => {
    const seeded = await seedModule();

    const response = await download(post({ moduleId: seeded.id }));

    expect(response.status).toBe(200);
    const row = await db.query.modules.findFirst({ where: eq(schema.modules.id, seeded.id) });
    expect(row?.downloads).toBe(seeded.downloads + 1);
  });

  it("still answers 200 for an id that matches nothing", async () => {
    // The counter is fire-and-forget from the reader's point of view; an unknown
    // id is not worth an error the UI would have to handle.
    const response = await download(post({ moduleId: crypto.randomUUID() }));

    expect(response.status).toBe(200);
  });
});
