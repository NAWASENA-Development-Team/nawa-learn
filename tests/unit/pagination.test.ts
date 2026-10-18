// tests/unit/pagination.test.ts
// Paginasi adalah tempat dua bug mahal biasanya bersembunyi: batas yang bisa
// dilewati (sehingga "limit" tidak membatasi apa pun) dan kursor yang rusak
// diperlakukan sebagai "mulai dari awal" (sehingga klien mengulang halaman
// pertama selamanya tanpa pernah melihat kesalahan). Keduanya diuji di sini,
// tanpa database dan tanpa Next.js.
import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  pageSlice,
  readCursor,
  readLimit,
} from "@/lib/pagination";

function request(query = ""): Request {
  return new Request(`https://nawa.test/api/things${query}`);
}

const SAMPLE_ID = "3f7c1b90-2f6a-4a1c-9c1e-8b2d5e6f7a8b";

/** base64url, so the fixtures reach the branch under test instead of the regex. */
function b64url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("readLimit", () => {
  it("falls back to the default when the parameter is absent", () => {
    expect(readLimit(request(), { defaultValue: 50, max: 100 })).toBe(50);
  });

  it("honours a value inside the range", () => {
    expect(readLimit(request("?limit=17"), { defaultValue: 50, max: 100 })).toBe(17);
  });

  it("clamps a value above the ceiling instead of trusting it", () => {
    // The ceiling is the whole point: `?limit=1000000` must not become a way to
    // ask for the entire table.
    expect(readLimit(request("?limit=1000000"), { defaultValue: 50, max: 100 })).toBe(100);
  });

  it("falls back to the default for values that are not positive integers", () => {
    for (const raw of ["", "abc", "0", "-5", "1.5", "12abc", " "]) {
      expect(readLimit(request(`?limit=${encodeURIComponent(raw)}`), { defaultValue: 50, max: 100 })).toBe(50);
    }
  });
});

describe("cursor encoding", () => {
  it("round-trips a timestamp and an id", () => {
    const createdAt = new Date("2026-04-05T06:07:08.901Z");
    const decoded = decodeCursor(encodeCursor({ createdAt, id: SAMPLE_ID }));

    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(SAMPLE_ID);
    expect(decoded?.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it("produces a URL-safe token with no padding or reserved characters", () => {
    const token = encodeCursor({ createdAt: new Date("2026-04-05T06:07:08.901Z"), id: SAMPLE_ID });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects tokens it cannot trust", () => {
    const valid = encodeCursor({ createdAt: new Date("2026-04-05T06:07:08.901Z"), id: SAMPLE_ID });

    const broken = [
      "",
      "!!!not-base64!!!",
      // base64 of a payload with no separator at all
      b64url("2026-04-05T06:07:08.901Z"),
      // valid shape, but the id is not a uuid
      b64url("2026-04-05T06:07:08.901Z|not-a-uuid"),
      // valid shape, but the timestamp is not a date
      b64url(`nonsense|${SAMPLE_ID}`),
      // longer than any cursor has a right to be
      "a".repeat(500),
      `${valid}=`,
    ];

    for (const token of broken) {
      expect(decodeCursor(token)).toBeNull();
    }
  });
});

describe("readCursor", () => {
  it("treats a missing or empty cursor as 'start from the beginning'", () => {
    expect(readCursor(request())).toEqual({ cursor: null, malformed: false });
    expect(readCursor(request("?cursor="))).toEqual({ cursor: null, malformed: false });
  });

  it("flags a present-but-unreadable cursor instead of silently restarting", () => {
    // This is the difference between "page 1 again" and "your cursor is wrong".
    expect(readCursor(request("?cursor=%%%"))).toEqual({ cursor: null, malformed: true });
  });

  it("reads a valid cursor", () => {
    const token = encodeCursor({ createdAt: new Date("2026-01-02T03:04:05.000Z"), id: SAMPLE_ID });
    const result = readCursor(request(`?cursor=${token}`));
    expect(result.malformed).toBe(false);
    expect(result.cursor?.id).toBe(SAMPLE_ID);
  });
});

describe("pageSlice", () => {
  // Real UUIDs, because `decodeCursor` refuses anything else — a cursor that
  // cannot be read back is not a cursor.
  const A = "11111111-1111-4111-8111-111111111111";
  const B = "22222222-2222-4222-8222-222222222222";
  const C = "33333333-3333-4333-8333-333333333333";

  const rows = [
    { id: A, createdAt: new Date("2026-01-03T00:00:00.000Z") },
    { id: B, createdAt: new Date("2026-01-02T00:00:00.000Z") },
    { id: C, createdAt: new Date("2026-01-01T00:00:00.000Z") },
  ];

  it("returns everything and no cursor when the page is not full", () => {
    expect(pageSlice(rows, 5)).toEqual({ rows, nextCursor: null });
  });

  it("returns no cursor when the extra row was never fetched", () => {
    // `limit + 1` is the caller's job; with exactly `limit` rows there is no
    // evidence of a next page, so inventing a cursor would loop the client.
    expect(pageSlice(rows, 3)).toEqual({ rows, nextCursor: null });
  });

  it("trims the probe row and points the cursor at the last row kept", () => {
    const result = pageSlice(rows, 2);

    expect(result.rows.map((r) => r.id)).toEqual([A, B]);
    expect(result.nextCursor).not.toBeNull();
    expect(decodeCursor(result.nextCursor!)).toEqual({
      id: B,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });
  });

  it("handles an empty result", () => {
    expect(pageSlice([], 10)).toEqual({ rows: [], nextCursor: null });
  });
});
