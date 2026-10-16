// tests/unit/uploadClient.test.ts
// The browser helper is small, but it owns two things the UI depends on: the
// multipart shape the server expects, and the rule that a failure is reported
// rather than swallowed. `fetch` is stubbed, so the relative URL never resolves.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCEPTED_AVATAR_TYPES,
  ACCEPTED_MODULE_FILE_TYPES,
  MAX_AVATAR_BYTES,
  MAX_MODULE_FILE_BYTES,
  uploadFile,
} from "@/lib/uploadClient";

const file = (name = "modul.pdf", type = "application/pdf") =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46]) as BlobPart], name, { type });

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("uploadFile", () => {
  it("sends purpose and file as multipart", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://s.public.blob.vercel-storage.com/a.pdf" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await uploadFile(file(), "module");

    expect(outcome).toEqual({ ok: true, url: "https://s.public.blob.vercel-storage.com/a.pdf" });
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe("/api/uploads");
    expect(init.method).toBe("POST");
    // The browser sets the multipart content-type with its boundary; the helper
    // must not set one itself.
    expect(init.headers).toBeUndefined();
    const form = init.body as FormData;
    expect(form.get("purpose")).toBe("module");
    expect(form.get("file")).toBeInstanceOf(File);
  });

  it("reports the server's message on a rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "File exceeds the 2 MB limit for image/png" }), { status: 400 }),
    ));

    const outcome = await uploadFile(file("aku.png", "image/png"), "avatar");

    expect(outcome).toEqual({ ok: false, error: "File exceeds the 2 MB limit for image/png" });
  });

  it("falls back to a generic message when the body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })));

    const outcome = await uploadFile(file(), "module");

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe("Unggahan gagal. Coba lagi.");
  });

  it("treats a 200 without a url as a failure", async () => {
    // The URL is what the caller stores; a success with no URL would leave the
    // form pointing at nothing.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));

    const outcome = await uploadFile(file(), "module");

    expect(outcome.ok).toBe(false);
  });

  it("turns a network error into a message instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const outcome = await uploadFile(file(), "module");

    expect(outcome).toEqual({ ok: false, error: "Kesalahan jaringan saat mengunggah berkas." });
  });
});

describe("mirrored limits", () => {
  it("match what the server enforces", async () => {
    // These are duplicated from src/lib/storage.ts, which cannot be imported into
    // a client bundle. This is the guard against the two drifting apart.
    const storage = await import("@/lib/storage");
    expect(MAX_AVATAR_BYTES).toBe(storage.MAX_IMAGE_BYTES);
    expect(MAX_MODULE_FILE_BYTES).toBe(storage.MAX_DOCUMENT_BYTES);
    expect(ACCEPTED_AVATAR_TYPES.split(",").sort()).toEqual(
      ["image/png", "image/jpeg", "image/webp"].sort(),
    );
    expect(ACCEPTED_MODULE_FILE_TYPES.split(",")).toContain("application/pdf");
  });
});
