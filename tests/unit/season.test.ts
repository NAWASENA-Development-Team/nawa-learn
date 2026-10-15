import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurrentSeasonStart, getSeasonLabel, needsSeasonReset } from "@/lib/season";

afterEach(() => {
  vi.useRealTimers();
});

function freeze(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("getCurrentSeasonStart", () => {
  it("returns the quarter boundary in UTC", () => {
    const cases: Array<[string, string]> = [
      ["2026-01-01T00:00:00Z", "2026-01-01T00:00:00.000Z"],
      ["2026-03-31T23:59:59Z", "2026-01-01T00:00:00.000Z"],
      ["2026-04-01T00:00:00Z", "2026-04-01T00:00:00.000Z"],
      ["2026-08-15T12:00:00Z", "2026-07-01T00:00:00.000Z"],
      ["2026-10-01T00:00:00Z", "2026-10-01T00:00:00.000Z"],
      ["2026-12-31T23:59:59Z", "2026-10-01T00:00:00.000Z"],
    ];

    for (const [now, expected] of cases) {
      freeze(now);
      expect(getCurrentSeasonStart().toISOString()).toBe(expected);
    }
  });

  it("uses UTC, not the machine's local timezone", () => {
    // 2026-07-01T00:30Z is still 30 Jun in western timezones; the season must
    // roll over on the UTC boundary regardless.
    freeze("2026-07-01T00:30:00Z");
    expect(getCurrentSeasonStart().toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("getSeasonLabel", () => {
  it("names the quarter and the year", () => {
    freeze("2026-08-15T12:00:00Z");
    expect(getSeasonLabel()).toMatch(/^Season 3 .* Jul.*Sep 2026$/);
  });

  it("numbers seasons 1 to 4 across the year", () => {
    const expected: Array<[string, number]> = [
      ["2026-02-10T00:00:00Z", 1],
      ["2026-05-10T00:00:00Z", 2],
      ["2026-08-10T00:00:00Z", 3],
      ["2026-11-10T00:00:00Z", 4],
    ];

    for (const [now, seasonNumber] of expected) {
      freeze(now);
      expect(getSeasonLabel()).toContain(`Season ${seasonNumber} `);
    }
  });
});

describe("needsSeasonReset", () => {
  it("is true when the user has never been reset", () => {
    freeze("2026-08-15T12:00:00Z");
    expect(needsSeasonReset(null)).toBe(true);
  });

  it("is true when the last reset happened in a previous season", () => {
    freeze("2026-08-15T12:00:00Z");
    expect(needsSeasonReset(new Date("2026-06-30T23:59:59Z"))).toBe(true);
  });

  it("is false once the user has been reset in the current season", () => {
    freeze("2026-08-15T12:00:00Z");
    expect(needsSeasonReset(new Date("2026-07-01T00:00:00Z"))).toBe(false);
    expect(needsSeasonReset(new Date("2026-08-14T10:00:00Z"))).toBe(false);
  });
});
