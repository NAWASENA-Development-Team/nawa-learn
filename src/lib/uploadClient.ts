// src/lib/uploadClient.ts
// ─── Browser side of /api/uploads ─────────────────────────────────────────────
// One place that knows how to hand a File to the server, so the profile photo
// and the module file cannot drift apart.
//
// The limits here are *mirrors* of `src/lib/storage.ts`, which is the authority.
// They are duplicated rather than imported because storage.ts imports
// `node:crypto` and can never be bundled into a client component. They exist so
// an obviously-too-big file is rejected before it is uploaded over a school
// connection; the server checks again regardless.
export type UploadPurpose = "avatar" | "module";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_MODULE_FILE_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_AVATAR_TYPES = "image/png,image/jpeg,image/webp";
export const ACCEPTED_MODULE_FILE_TYPES = "image/png,image/jpeg,image/webp,application/pdf";

export interface UploadOutcome {
  ok: boolean;
  url?: string;
  /** A message already suitable for a toast. */
  error?: string;
}

export async function uploadFile(file: File, purpose: UploadPurpose): Promise<UploadOutcome> {
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", file);

  try {
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

    if (!res.ok || !data.url) {
      return { ok: false, error: data.error ?? "Unggahan gagal. Coba lagi." };
    }

    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: "Kesalahan jaringan saat mengunggah berkas." };
  }
}
