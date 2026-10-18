// tests/unit/ids.test.ts
// Satu regex, dua pemakai. Yang diuji di sini bukan regexnya, melainkan batas
// antara "id yang mungkin ada" dan "bukan id sama sekali": halaman profil publik
// memakai jawaban itu untuk memilih antara 404 dan query database, dan Postgres
// menolak cast `uuid` yang salah bentuk dengan galat yang tidak bisa dibedakan
// dari database yang sedang mati.
import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/ids";

const SAMPLE_ID = "3f7c1b90-2f6a-4a1c-9c1e-8b2d5e6f7a8b";

describe("isUuid", () => {
  it("accepts a canonical lowercase UUID", () => {
    expect(isUuid(SAMPLE_ID)).toBe(true);
  });

  it("accepts uppercase, because a pasted link may be capitalised", () => {
    expect(isUuid(SAMPLE_ID.toUpperCase())).toBe(true);
  });

  it("accepts any version digit rather than only v4", () => {
    // `crypto.randomUUID()` emits v4, but a seeded or migrated row need not, and
    // rejecting it here would 404 a row that genuinely exists.
    expect(isUuid("3f7c1b90-2f6a-1a1c-9c1e-8b2d5e6f7a8b")).toBe(true);
  });

  it("rejects a slug", () => {
    expect(isUuid("halo")).toBe(false);
  });

  it("rejects an empty string", () => {
    // `readCursor` feeds this function the id half of a decoded cursor, which can
    // legitimately be empty.
    expect(isUuid("")).toBe(false);
  });

  it("rejects a UUID with a truncated group", () => {
    expect(isUuid("3f7c1b90-2f6a-4a1c-9c1e-8b2d5e6f7a8")).toBe(false);
  });

  it("rejects braces and a trailing newline", () => {
    expect(isUuid(`{${SAMPLE_ID}}`)).toBe(false);
    expect(isUuid(`${SAMPLE_ID}\n`)).toBe(false);
  });

  it("rejects a non-hex character in an otherwise valid shape", () => {
    expect(isUuid("3f7c1b90-2f6a-4a1c-9c1e-8b2d5e6f7a8z")).toBe(false);
  });
});
