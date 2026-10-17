// tests/integration/clerk-webhook.test.ts
// ─── Akun yang dihapus dari dashboard Clerk (M11 → M12) ───────────────────────
// `/api/profile/delete` hanya menangkap siswa yang menghapus akunnya **lewat
// aplikasi ini**. Kalau akunnya dihapus dari dashboard Clerk — oleh admin
// sekolah, oleh orang tua, atau oleh siswa itu sendiri lewat aplikasi Clerk lain
// — tidak ada sesi yang bisa dipakai `requireUser()` dan tidak ada id internal
// yang kita ketahui. Satu-satunya sinyal adalah webhook `user.deleted`.
//
// Sebelum M12 event itu jatuh ke `return new Response("Webhook received")` di
// ujung handler: dibalas 200, dan baris `users` tetap utuh selamanya dengan nama
// dan surel orang yang akunnya sudah tidak ada. Itu kegagalan yang tidak
// kelihatan — persis kelas kegagalan yang audit ini ada untuk menemukannya.
//
// Test ini menandatangani payload-nya sendiri dengan skema Svix yang asli
// (`v1,base64(HMAC-SHA256(key, id.timestamp.body))`), jadi yang diuji adalah
// jalur verifikasi yang sesungguhnya, bukan jalur yang dilewati dengan mock.
import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedUser, uniqueId, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));
const storage = vi.hoisted(() => ({ deleteObject: vi.fn() }));
const headerHolder = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => headerHolder.headers,
}));

// Only the network call is faked. `isOwnStorageUrl` stays real: deciding whether
// a stored URL belongs to our blob store is part of what the handler asks it.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, deleteObject: storage.deleteObject };
});

import { POST as clerkWebhook } from "@/app/api/webhooks/clerk/route";
import * as schema from "@/db/schema";
import { ANONYMOUS_DISPLAY_NAME } from "@/lib/accountConstants";

const SECRET = `whsec_${Buffer.from("m12-webhook-test-secret").toString("base64")}`;
const PHOTO = "https://store123.public.blob.vercel-storage.com/uploads/u1/me.png";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  process.env.CLERK_WEBHOOK_SECRET = SECRET;
  storage.deleteObject.mockReset();
  storage.deleteObject.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

/** The signature Svix would send, computed with the real scheme. */
function sign(messageId: string, timestamp: string, body: string, secret = SECRET): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const digest = createHmac("sha256", key).update(`${messageId}.${timestamp}.${body}`).digest("base64");
  return `v1,${digest}`;
}

function webhookRequest(
  event: unknown,
  options: { messageId?: string; timestamp?: string; secret?: string } = {},
): Request {
  const messageId = options.messageId ?? uniqueId("msg");
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify(event);

  headerHolder.headers = new Headers({
    "svix-id": messageId,
    "svix-timestamp": timestamp,
    "svix-signature": sign(messageId, timestamp, body, options.secret),
  });

  return new Request("https://nawa.test/api/webhooks/clerk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

function deletedEvent(clerkId: string) {
  return {
    type: "user.deleted",
    data: { id: clerkId, object: "user", deleted: true },
  };
}

describe("POST /api/webhooks/clerk — user.deleted", () => {
  it("anonymises the row instead of leaving the identity behind", async () => {
    const user = await seedUser(db, { points: 240 });
    await db
      .update(schema.users)
      .set({ photoUrl: PHOTO, bio: "Halo", motto: "Belajar" })
      .where(eq(schema.users.id, user.id));

    const response = await clerkWebhook(webhookRequest(deletedEvent(user.clerkId)));

    expect(response.status).toBe(200);

    const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    expect(row).toBeDefined();
    expect(row!.name).toBe(ANONYMOUS_DISPLAY_NAME);
    expect(row!.email).toBe(`deleted+${user.id}@deleted.nawasena.site`);
    expect(row!.clerkId).toBe(`deleted:${user.id}`);
    expect(row!.points).toBe(0);
    expect(row!.bio).toBeNull();
    expect(row!.motto).toBeNull();
    expect(row!.photoUrl).toBeNull();
  });

  it("keeps library content other students depend on", async () => {
    const user = await seedUser(db, {});
    const [mod] = await db
      .insert(schema.modules)
      .values({
        title: "Modul yang tetap terbit",
        subject: "Fisika",
        grade: "12",
        category: "UTBK",
        contentUrl: "https://example.test/fisika.pdf",
        uploaderId: user.id,
        status: "approved",
      })
      .returning();

    await clerkWebhook(webhookRequest(deletedEvent(user.clerkId)));

    // The row is anonymised, not deleted: `modules.uploader_id` is NOT NULL and
    // deleting it would take an approved module out of the library.
    const stored = await db.query.modules.findFirst({ where: eq(schema.modules.id, mod.id) });
    expect(stored).toBeDefined();
    expect(stored!.uploaderId).toBe(user.id);
    expect(stored!.status).toBe("approved");
  });

  it("deletes the profile photo object from blob storage", async () => {
    const user = await seedUser(db, {});
    await db.update(schema.users).set({ photoUrl: PHOTO }).where(eq(schema.users.id, user.id));

    await clerkWebhook(webhookRequest(deletedEvent(user.clerkId)));

    expect(storage.deleteObject).toHaveBeenCalledWith(PHOTO);
  });

  it("does not fail the webhook when the blob delete fails", async () => {
    const user = await seedUser(db, {});
    await db.update(schema.users).set({ photoUrl: PHOTO }).where(eq(schema.users.id, user.id));
    storage.deleteObject.mockRejectedValue(new Error("storage down"));

    const response = await clerkWebhook(webhookRequest(deletedEvent(user.clerkId)));

    expect(response.status).toBe(200);
    const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    expect(row!.name).toBe(ANONYMOUS_DISPLAY_NAME);
  });

  it("records the erasure in the audit log", async () => {
    const user = await seedUser(db, {});

    await clerkWebhook(webhookRequest(deletedEvent(user.clerkId)));

    const entries = await db.query.auditLog.findMany({
      where: eq(schema.auditLog.entityId, user.id),
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorId: null,
      action: "user.anonymise",
      entity: "user",
    });
  });

  // Svix retries a delivery whenever we do not answer 2xx, and it may deliver
  // the same event twice regardless. A second delivery must be a no-op, not a
  // second erasure and certainly not a 500 that keeps the retries coming.
  it("is idempotent on a replayed delivery", async () => {
    const user = await seedUser(db, {});
    const event = deletedEvent(user.clerkId);
    const messageId = uniqueId("msg");

    const first = await clerkWebhook(webhookRequest(event, { messageId }));
    const second = await clerkWebhook(webhookRequest(event, { messageId }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const entries = await db.query.auditLog.findMany({
      where: eq(schema.auditLog.entityId, user.id),
    });
    expect(entries).toHaveLength(1);
  });

  it("answers 200 for an account that never had a row", async () => {
    const response = await clerkWebhook(webhookRequest(deletedEvent("clerk_never_synced")));

    // Not 404: Clerk cannot act on a 404, and a 5xx would make it retry forever
    // for something that will never exist.
    expect(response.status).toBe(200);
  });
});

describe("POST /api/webhooks/clerk — signature", () => {
  it("rejects a payload signed with the wrong secret", async () => {
    const user = await seedUser(db, {});

    const response = await clerkWebhook(
      webhookRequest(deletedEvent(user.clerkId), {
        secret: `whsec_${Buffer.from("not-the-secret").toString("base64")}`,
      }),
    );

    expect(response.status).toBe(400);
    const row = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
    expect(row!.name).not.toBe(ANONYMOUS_DISPLAY_NAME);
  });

  it("rejects a request with no Svix headers", async () => {
    headerHolder.headers = new Headers();

    const response = await clerkWebhook(
      new Request("https://nawa.test/api/webhooks/clerk", { method: "POST", body: "{}" }),
    );

    expect(response.status).toBe(400);
  });

  it("refuses to run at all when the secret is not configured", async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;

    const response = await clerkWebhook(webhookRequest(deletedEvent("clerk_anything")));

    expect(response.status).toBe(500);
  });
});

describe("POST /api/webhooks/clerk — user.created", () => {
  it("still provisions a row (the branch the M12 edit sits next to)", async () => {
    const clerkId = uniqueId("clerk");

    const response = await clerkWebhook(
      webhookRequest({
        type: "user.created",
        data: {
          id: clerkId,
          email_addresses: [{ email_address: `${clerkId}@example.test` }],
          first_name: "Siti",
          last_name: "Rahma",
          external_accounts: [{ provider: "oauth_google" }],
        },
      }),
    );

    expect(response.status).toBe(200);
    const row = await db.query.users.findFirst({ where: eq(schema.users.clerkId, clerkId) });
    expect(row).toBeDefined();
    expect(row!.email).toBe(`${clerkId}@example.test`);
    expect(row!.role).toBe("student");
  });
});
