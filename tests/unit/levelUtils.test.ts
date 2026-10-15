import { describe, expect, it } from "vitest";
import { getLevel, getLevelThreshold, getPointsToNextLevel } from "@/lib/levelUtils";

// Documented curve: XP to go from level N to N+1 is N * 50, so the total to
// reach level N is 25 * N * (N - 1).
describe("getLevelThreshold", () => {
  it("matches the documented table", () => {
    expect(getLevelThreshold(1)).toBe(0);
    expect(getLevelThreshold(2)).toBe(50);
    expect(getLevelThreshold(3)).toBe(150);
    expect(getLevelThreshold(4)).toBe(300);
    expect(getLevelThreshold(5)).toBe(500);
    expect(getLevelThreshold(10)).toBe(2250);
    expect(getLevelThreshold(15)).toBe(5250);
  });

  it("is strictly increasing", () => {
    for (let level = 1; level < 60; level++) {
      expect(getLevelThreshold(level + 1)).toBeGreaterThan(getLevelThreshold(level));
    }
  });
});

describe("getLevel", () => {
  it("starts everyone at level 1", () => {
    expect(getLevel(0)).toBe(1);
  });

  it("promotes exactly at the threshold and not one point earlier", () => {
    for (let level = 2; level <= 40; level++) {
      const threshold = getLevelThreshold(level);
      expect(getLevel(threshold - 1)).toBe(level - 1);
      expect(getLevel(threshold)).toBe(level);
    }
  });

  it("never returns a level below 1, even for junk input", () => {
    for (const points of [-1000, -1, 0, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const level = getLevel(points);
      expect(Number.isFinite(level)).toBe(true);
      expect(level).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("getPointsToNextLevel", () => {
  it("reports progress inside the current level", () => {
    expect(getPointsToNextLevel(0)).toEqual({ current: 0, needed: 50 });
    expect(getPointsToNextLevel(50)).toEqual({ current: 0, needed: 100 });
    expect(getPointsToNextLevel(120)).toEqual({ current: 70, needed: 100 });
  });

  it("always leaves current strictly inside [0, needed)", () => {
    for (let points = 0; points <= 5000; points += 37) {
      const { current, needed } = getPointsToNextLevel(points);
      expect(needed).toBeGreaterThan(0);
      expect(current).toBeGreaterThanOrEqual(0);
      expect(current).toBeLessThan(needed);
    }
  });
});
