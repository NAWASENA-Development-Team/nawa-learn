// tests/integration/uploads.test.ts
// The upload endpoint is the only way binary content enters the system, so its
// refusals matter as much as its success path. Everything here runs against a
// real database, and only the network call to Vercel Blob is replaced — the
// point is to prove the *route's* decisions, not to reach the store.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUser, uniqueId, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));
const storage = vi.hoisted(() => ({ putObject: vi.fn() }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
// Only the transport is faked. `checkUpload`, the size ceilings and
// `buildPathname` stay real, so every refusal below is the route's own.
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return { ...actual, putObject: storage.putObject };
});

import { auth } from "@clerk/nextjs/server";
import { POST as upload } from "@/app/api/uploads/route";
import { MAX_DOCUMENT_BYTES, MAX_UPLOAD_BYTES } from "@/lib/storage";

const authMock = vi.mocked(auth);
const TOKEN = "vercel_blob_rw_store123_secret";
const STORED_URL = "https://store123.public.blob.vercel-storage.com/uploads/u1/abc.pdf";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  authMock.mockReset();
  vi.unstubAllEnvs();
  storage.putObject.mockReset();
  storage.putObject.mockResolvedValue({ url: STORED_URL, pathname: "uploads/u1/abc.pdf" });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const pdf = (extra = 0) => new Uint8Array([...Buffer.from("%PDF-1.4"), ...new Array(extra).fill(0)]);

async function signIn() {
  const user = await seedUser(db, { clerkId: uniqueId("clerk") });
  authMock.mockResolvedValue({ userId: user.clerkId } as never);
  return user;
}

function post(form: FormData, ip = "203.0.113.10"): Request {
  return new Request("https://nawa.test/api/uploads", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: form,
  });
}

function moduleUpload(bytes: Uint8Array, type = "application/pdf", name = "modul.pdf"): Request {
  const form = new FormData();
  form.set("purpose", "module");
  form.set("file", new File([bytes as BlobPart], name, { type }));
  return post(form);
}

describe("POST /api/uploads — identity", () => {
  it("answers 401 when there is no session", async () => {
    authMock.mockResolvedValue({ userId: null } as never);

    const response = await upload(moduleUpload(pdf()));

    expect(response.status).toBe(401);
  });

  it("answers 403 when the session has no provisioned row", async () => {
    authMock.mockResolvedValue({ userId: uniqueId("clerk") } as never);

    const response = await upload(moduleUpload(pdf()));

    expect(response.status).toBe(403);
  });
});

describe("POST /api/uploads — configuration", () => {
  it("refuses with 503 rather than falling back to base64 when storage is unset", async () => {
    await signIn();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");

    const response = await upload(moduleUpload(pdf()));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    // Nothing was stored and, crucially, no data URL was invented.
    expect(storage.putObject).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "Object storage is not configured" });
  });
});

describe("POST /api/uploads — request shape", () => {
  beforeEach(() => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
  });

  it("rejects a non-multipart body", async () => {
    await signIn();

    const response = await upload(
      new Request("https://nawa.test/api/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Expected a multipart/form-data body",
    });
  });

  it("rejects a missing or unknown purpose", async () => {
    await signIn();

    const form = new FormData();
    form.set("file", new File([pdf() as BlobPart], "modul.pdf", { type: "application/pdf" }));
    const response = await upload(post(form));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("purpose") });
  });

  it("rejects a request with no file part", async () => {
    await signIn();

    const form = new FormData();
    form.set("purpose", "module");
    const response = await upload(post(form));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("file") });
  });
});

describe("POST /api/uploads — content screening", () => {
  beforeEach(async () => {
    await signIn();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
  });

  it("refuses a type that is not on the list, and never calls storage", async () => {
    const response = await upload(moduleUpload(new Uint8Array(Buffer.from("plain text")), "text/plain", "notes.txt"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "unsupported_type" });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("refuses a file whose declared type disagrees with its bytes", async () => {
    // A PDF wearing a PNG content-type: the bytes win, and the disagreement is
    // treated as a rejection rather than a silent rewrite.
    const response = await upload(moduleUpload(pdf(), "image/png", "modul.png"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "type_mismatch" });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("refuses a PDF uploaded as an avatar", async () => {
    const form = new FormData();
    form.set("purpose", "avatar");
    form.set("file", new File([pdf() as BlobPart], "modul.pdf", { type: "application/pdf" }));

    const response = await upload(post(form));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "not_allowed_for_purpose" });
  });

  it("refuses a body whose declared length is over the ceiling, before parsing it", async () => {
    const response = await upload(
      new Request("https://nawa.test/api/uploads", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=----nawa",
          "content-length": String(MAX_UPLOAD_BYTES + 1024 * 1024),
          "x-forwarded-for": "203.0.113.30",
        },
      }),
    );

    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("refuses a real oversized file", async () => {
    const response = await upload(moduleUpload(pdf(MAX_DOCUMENT_BYTES + 1024 * 1024)));

    // Either the content-length hint or the measured check catches it; both are
    // refusals, and neither may reach storage.
    expect([400, 413]).toContain(response.status);
  });
});

describe("POST /api/uploads — success", () => {
  it("stores the sniffed type and returns the URL, not a data URL", async () => {
    const user = await signIn();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);

    const bytes = pdf();
    const response = await upload(moduleUpload(bytes));

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      url: STORED_URL,
      contentType: "application/pdf",
      size: bytes.length,
    });

    // The pathname is namespaced by the database user id, and the content type
    // handed to storage is the sniffed one, never the declared one.
    expect(storage.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: expect.stringMatching(new RegExp(`^uploads/${user.id}/[0-9a-f-]{36}\\.pdf$`)),
        contentType: "application/pdf",
        bytes: expect.any(Uint8Array),
      }),
    );
  });

  it("answers 502 and stores nothing when the object store fails", async () => {
    await signIn();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    storage.putObject.mockRejectedValue(new Error("store is down"));

    const response = await upload(moduleUpload(pdf()));

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Upload failed" });
  });

  it("accepts a PNG for an avatar", async () => {
    await signIn();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", TOKEN);
    storage.putObject.mockResolvedValue({
      url: "https://s.public.blob.vercel-storage.com/uploads/u1/a.png",
      pathname: "uploads/u1/a.png",
    });

    const form = new FormData();
    form.set("purpose", "avatar");
    form.set("file", new File([png() as BlobPart], "aku.png", { type: "image/png" }));

    const response = await upload(post(form, "203.0.113.40"));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ contentType: "image/png" });
  });
});
