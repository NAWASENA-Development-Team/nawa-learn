import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BADGES,
  getBadgesByCategory,
  getDaysOldAccount,
  getRarityColor,
  getSpecialtyBadge,
} from "@/lib/badges";

const zeroedUser = {
  points: 0,
  rank: 0,
  totalStudents: 0,
  approvedModules: 0,
  approvedQuestions: 0,
  totalDownloads: 0,
  modulesBySubject: {},
  questionsCreated: 0,
  accountAgeInDays: 0,
  createdAt: new Date().toISOString(),
};

describe("BADGES catalogue", () => {
  it("is not empty", () => {
    expect(BADGES.length).toBeGreaterThan(0);
  });

  it("uses unique ids", () => {
    const ids = BADGES.map((badge) => badge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has complete metadata on every badge", () => {
    for (const badge of BADGES) {
      expect(badge.title.length).toBeGreaterThan(0);
      expect(badge.description.length).toBeGreaterThan(0);
      expect(badge.icon.length).toBeGreaterThan(0);
      expect(badge.howToUnlock.length).toBeGreaterThan(0);
      expect(typeof badge.unlockCondition).toBe("function");
      expect(["common", "uncommon", "rare", "epic", "legendary"]).toContain(badge.rarity);
    }
  });

  it("never throws when a badge is evaluated for a brand-new account", () => {
    for (const badge of BADGES) {
      expect(() => badge.unlockCondition(zeroedUser)).not.toThrow();
    }
  });

  it("does not hand out everything to a zero-effort account", () => {
    const locked = BADGES.filter((badge) => !badge.unlockCondition(zeroedUser));
    expect(locked.length).toBeGreaterThan(0);
  });
});

describe("getBadgesByCategory", () => {
  it("returns only badges from the requested category", () => {
    const milestones = getBadgesByCategory("milestone");
    expect(milestones.length).toBeGreaterThan(0);
    expect(milestones.every((badge) => badge.category === "milestone")).toBe(true);
  });

  it("covers every category that has badges", () => {
    const categories = [...new Set(BADGES.map((badge) => badge.category))];
    const total = categories.reduce((sum, category) => sum + getBadgesByCategory(category).length, 0);
    expect(total).toBe(BADGES.length);
  });
});

describe("getRarityColor", () => {
  it("returns a class string for every rarity", () => {
    for (const rarity of ["common", "uncommon", "rare", "epic", "legendary"] as const) {
      expect(getRarityColor(rarity).length).toBeGreaterThan(0);
    }
  });
});

describe("getDaysOldAccount", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts whole days since signup", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    expect(getDaysOldAccount("2026-08-15T11:00:00Z")).toBe(0);
    expect(getDaysOldAccount("2026-08-14T12:00:00Z")).toBe(1);
    expect(getDaysOldAccount("2026-07-16T12:00:00Z")).toBe(30);
  });
});

describe("getSpecialtyBadge", () => {
  const base = {
    hardQuizzes: 0,
    approvedMods: 0,
    diverseSubjects: 0,
    quizTotal: 0,
    approvedQuestions: 0,
    totalDownloads: 0,
  };

  it("returns null outside the podium when a rank is supplied", () => {
    expect(getSpecialtyBadge(base, 4)).toBeNull();
  });

  it("still returns a badge for the top three", () => {
    expect(getSpecialtyBadge(base, 1)).not.toBeNull();
  });

  it("prioritises the most impressive stat", () => {
    expect(getSpecialtyBadge({ ...base, totalDownloads: 100, approvedQuestions: 50 })?.name).toBe(
      "Viral Educator",
    );
  });

  it("falls back to a default badge rather than returning nothing", () => {
    expect(getSpecialtyBadge(base)?.name).toBe("Legend Scholar");
  });
});
