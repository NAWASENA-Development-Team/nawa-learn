// tests/integration/modules-file.test.ts
// ─── Bytes modul lama, diuji di batas HTTP ────────────────────────────────────
//
// Route ini ada karena tiga baris `modules` menyimpan PDF sebagai base64 dan isi
// itu dulu ikut di payload halaman perpustakaan. Yang harus dibuktikan bukan
// "route mengembalikan 200", melainkan bahwa **byte yang keluar sama persis**
// dengan byte yang ditulis, bahwa baris yang belum disetujui tidak bisa dibaca,
// dan bahwa route ini menolak melayani apa pun yang bukan `data:`.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, createTestDb, resetTestDb, seedUser, type TestDb } from "../helpers/harness";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));

import { auth } from "@clerk/nextjs/server";
import { GET } from "@/app/api/modules/[id]/file/route";
import { modules } from "@/db/schema";

const authMock = vi.mocked(auth);
let db: TestDb;

/** Byte yang tidak boleh berubah bentuk setelah melewati base64 dan route. */
const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n", "binary");

beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(async () => {
  authMock.mockReset();
  await resetTestDb(db);
});

function signIn(clerkId: string) {
  authMock.mockResolvedValue({ userId: clerkId } as never);
}

async function seedModule(
  overrides: Partial<{ contentUrl: string; status: "pending" | "approved" | "rejected"; title: string }> = {},
) {
  const uploader = await seedUser(db, {});
  const [row] = await db
    .insert(modules)
    .values({
      title: overrides.title ?? "Modul Uji",
      subject: "Fisika",
      grade: "X",
      category: "Reguler",
      contentUrl: overrides.contentUrl ?? `data:application/pdf;base64,${PDF_BYTES.toString("base64")}`,
      uploaderId: uploader.id,
      status: overrides.status ?? "approved",
    })
    .returning();
  return row;
}

const call = (id: string, query = "", clerkId?: string) => {
  if (clerkId) signIn(clerkId);
  return GET(apiRequest(`/api/modules/${id}/file${query}`), {
    params: Promise.resolve({ id }),
  });
};

describe("GET /api/modules/[id]/file", () => {
  it("menolak pemanggil anonim", async () => {
    const mod = await seedModule();
    authMock.mockResolvedValue({ userId: null } as never);

    const response = await GET(apiRequest(`/api/modules/${mod.id}/file`), {
      params: Promise.resolve({ id: mod.id }),
    });

    expect(response.status).toBe(401);
  });

  it("mengembalikan byte PDF yang sama persis, sebagai inline", async () => {
    const mod = await seedModule();
    const reader = await seedUser(db, {});

    const response = await call(mod.id, "", reader.clerkId);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer()).equals(PDF_BYTES)).toBe(true);
  });

  it("mengubah content-disposition menjadi attachment saat diminta unduh", async () => {
    const mod = await seedModule();
    const reader = await seedUser(db, {});

    const response = await call(mod.id, "?download=1", reader.clerkId);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
  });

  it("tetap benar bila base64 mengandung baris baru", async () => {
    // `Buffer.from(x, "base64")` mengabaikan karakter di luar alfabet, sehingga
    // varian ini harus menghasilkan byte yang identik — bukan file kosong.
    const wrapped = PDF_BYTES.toString("base64").replace(/(.{40})/g, "$1\n");
    const mod = await seedModule({ contentUrl: `data:application/pdf;base64,${wrapped}` });
    const reader = await seedUser(db, {});

    const response = await call(mod.id, "", reader.clerkId);

    expect(Buffer.from(await response.arrayBuffer()).equals(PDF_BYTES)).toBe(true);
  });

  it("menyajikan gambar lama dengan tipe aslinya", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const mod = await seedModule({ contentUrl: `data:image/png;base64,${png.toString("base64")}` });
    const reader = await seedUser(db, {});

    const response = await call(mod.id, "", reader.clerkId);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer()).equals(png)).toBe(true);
  });

  it("menjawab 404 untuk modul yang belum disetujui", async () => {
    const mod = await seedModule({ status: "pending" });
    const reader = await seedUser(db, {});

    expect((await call(mod.id, "", reader.clerkId)).status).toBe(404);
  });

  it("menjawab 404 untuk id yang bukan UUID, tanpa menyentuh database", async () => {
    const reader = await seedUser(db, {});
    expect((await call("halo", "", reader.clerkId)).status).toBe(404);
  });

  it("menjawab 400 untuk modul yang bytes-nya bukan milik route ini", async () => {
    // URL blob dan host eksternal punya jalurnya sendiri; route ini tidak boleh
    // menjadi proxy untuk apa pun yang bukan isi kolom.
    const mod = await seedModule({
      contentUrl: "https://contoh.public.blob.vercel-storage.com/uploads/a/b.pdf",
    });
    const reader = await seedUser(db, {});

    const response = await call(mod.id, "", reader.clerkId);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "not_inline_content" });
  });

  it("menolak tipe data: yang tidak boleh disajikan", async () => {
    const mod = await seedModule({
      contentUrl: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    });
    const reader = await seedUser(db, {});

    const response = await call(mod.id, "", reader.clerkId);

    // Bukan 200 dengan `text/html`: itu akan menjadi XSS dari origin kita.
    expect(response.status).toBe(400);
  });
});
