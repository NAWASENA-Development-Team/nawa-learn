// tests/unit/retention.test.ts
// The retention table is the single source of truth for two readers at once:
// the /privacy page renders it and the cleanup job deletes by it. These are the
// parts that need no database — the shape of the table and the date arithmetic —
// so a mistake here (a zero window, a duplicate key, a cutoff off by a year)
// fails fast and cheap before the PGlite suite ever starts.
import { describe, expect, it } from "vitest";
import { RETENTION_POLICY, cutoffDate } from "@/lib/retention";

describe("RETENTION_POLICY", () => {
  it("has a positive, finite window for every rule", () => {
    for (const rule of RETENTION_POLICY) {
      expect(Number.isInteger(rule.windowMonths)).toBe(true);
      expect(rule.windowMonths).toBeGreaterThan(0);
    }
  });

  it("uses unique keys, so the job's result map cannot silently overwrite one", () => {
    const keys = RETENTION_POLICY.map((rule) => rule.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every rule a human label and a rationale for the /privacy table", () => {
    for (const rule of RETENTION_POLICY) {
      expect(rule.label.trim().length).toBeGreaterThan(0);
      expect(rule.rationale.trim().length).toBeGreaterThan(0);
    }
  });

  it("covers exactly the tables that grow without bound", () => {
    // Daftar ini sengaja ditulis lengkap, bukan `toContain`: menambah tabel yang
    // tumbuh terus harus memaksa seseorang menyentuh berkas ini dan berpikir
    // tentang masa simpannya. `mail_outbox` masuk di M16 — ia satu-satunya tabel
    // di sini yang isinya bukan tentang seseorang, tetapi tetap punya jendela
    // karena baris terkirim tidak berguna selamanya. `daily_activity` juga M16,
    // dan masuk justru karena satu-satunya pembacanya adalah jendela hari ini:
    // catatan kehadiran dua tahun lalu tidak menjawab pertanyaan apa pun.
    expect(RETENTION_POLICY.map((rule) => rule.key).sort()).toEqual([
      "daily_activity",
      "mail_outbox",
      "points_log",
      "reports",
      "submissions",
    ]);
  });
});

describe("cutoffDate", () => {
  it("subtracts whole calendar months", () => {
    const now = new Date("2026-10-17T03:00:00.000Z");
    expect(cutoffDate(now, 12).toISOString()).toBe("2025-10-17T03:00:00.000Z");
    expect(cutoffDate(now, 24).toISOString()).toBe("2024-10-17T03:00:00.000Z");
  });

  it("rolls the year back correctly across January", () => {
    const now = new Date("2026-01-15T00:00:00.000Z");
    expect(cutoffDate(now, 24).toISOString()).toBe("2024-01-15T00:00:00.000Z");
  });

  it("does not mutate the date it was given", () => {
    const now = new Date("2026-10-17T03:00:00.000Z");
    cutoffDate(now, 24);
    expect(now.toISOString()).toBe("2026-10-17T03:00:00.000Z");
  });

  it("matches every rule's window to the cutoff it would produce", () => {
    // Tie the two halves together: the cutoff the job computes must be exactly
    // the window the page advertises.
    const now = new Date("2026-06-01T00:00:00.000Z");
    for (const rule of RETENTION_POLICY) {
      const expected = new Date(now.getTime());
      expected.setMonth(expected.getMonth() - rule.windowMonths);
      expect(cutoffDate(now, rule.windowMonths).toISOString()).toBe(expected.toISOString());
    }
  });
});
