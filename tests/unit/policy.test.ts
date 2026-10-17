// tests/unit/policy.test.ts
// The policy version is the hinge the whole consent gate turns on. If it were a
// database default, a policy bump would change the text and leave every stored
// consent silently valid; if the predicate were lenient, a NULL would read as
// agreement. Both directions are pinned here, and the module has no imports at
// all, so this is a plain unit test.
import { describe, expect, it } from "vitest";
import {
  DATA_CONTROLLER,
  POLICY_EFFECTIVE_DATE,
  POLICY_PATHS,
  POLICY_VERSION,
  PRIVACY_CONTACT_EMAIL,
  hasAcceptedCurrentPolicy,
} from "@/lib/policy";

describe("POLICY_VERSION", () => {
  it("is a short, non-empty string that fits the column", () => {
    expect(POLICY_VERSION.length).toBeGreaterThan(0);
    // `users.consent_policy_version` is varchar(20); a longer constant would be
    // silently truncated by Postgres and the comparison would start lying.
    expect(POLICY_VERSION.length).toBeLessThanOrEqual(20);
  });

  it("looks like a version, so a human reading the column knows what it means", () => {
    expect(POLICY_VERSION).toMatch(/^\d+(\.\d+)*$/);
  });
});

describe("hasAcceptedCurrentPolicy", () => {
  it("accepts exactly the current version", () => {
    expect(hasAcceptedCurrentPolicy(POLICY_VERSION)).toBe(true);
  });

  it("treats every kind of missing value as not-yet-accepted", () => {
    // NULL is the pre-M11 row and the fresh account. It must never read as
    // agreement, or the gate would let everyone through on a fresh database.
    expect(hasAcceptedCurrentPolicy(null)).toBe(false);
    expect(hasAcceptedCurrentPolicy(undefined)).toBe(false);
    expect(hasAcceptedCurrentPolicy("")).toBe(false);
  });

  it("treats an old version as not-yet-accepted, so a bump re-prompts", () => {
    expect(hasAcceptedCurrentPolicy("0.9")).toBe(false);
    expect(hasAcceptedCurrentPolicy(`${POLICY_VERSION}-draft`)).toBe(false);
  });

  it("does not coerce: a numeric or padded value is still a mismatch", () => {
    // Guards against a future `==`-style refactor. The stored column is a
    // string; "1.0 " (trailing space) is not the same consent as "1.0".
    expect(hasAcceptedCurrentPolicy(` ${POLICY_VERSION} `)).toBe(false);
  });
});

describe("policy constants", () => {
  it("points both documents at the routes the proxy makes public", () => {
    expect(POLICY_PATHS.privacy).toBe("/privacy");
    expect(POLICY_PATHS.terms).toBe("/terms");
  });

  it("names a controller and a contact, because a policy without them is not actionable", () => {
    expect(DATA_CONTROLLER.length).toBeGreaterThan(0);
    expect(PRIVACY_CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+$/);
  });

  it("carries an effective date in ISO form", () => {
    expect(POLICY_EFFECTIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(POLICY_EFFECTIVE_DATE))).toBe(false);
  });
});
