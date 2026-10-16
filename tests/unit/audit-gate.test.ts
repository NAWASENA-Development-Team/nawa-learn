// tests/unit/audit-gate.test.ts
// ─── Regression protection for the audit gate's *decision* ───────────────────
// `scripts/audit-gate.mjs` runs `npm audit` the moment it is imported, so it
// cannot be imported here. The decision half was therefore split into
// `scripts/audit-gate-lib.mjs`, which is pure and has no I/O.
//
// This matters more than the line count suggests. The gate exists because
// nothing was watching the dependency tree while `next` sat on a version with
// three CRITICAL advisories (see C7). A gate that silently stops working is worse
// than no gate, because it is trusted. The two behaviours asserted below are the
// ones a future "simplification" is most likely to remove:
//
//   • an advisory npm reports only through a string `via` must not be counted;
//   • an allowlist entry that matches nothing must be reported as stale, so the
//     exception list cannot rot into a permanent exemption.
import { describe, expect, it } from "vitest";

import { collectFindings, evaluateFindings, isBlocking } from "../../scripts/audit-gate-lib.mjs";

/** Minimal shape of what `npm audit --json` emits for one vulnerable package. */
function report(vulnerabilities: Record<string, unknown>) {
  return { vulnerabilities };
}

describe("collectFindings", () => {
  it("keeps advisory objects and drops inherited-by-name entries", () => {
    // This is the real @clerk/shared → js-cookie case: the parent is reported
    // HIGH, but its `via` is the plain string "js-cookie", because the advisory
    // itself belongs to js-cookie. Counting it would double-count one advisory.
    const findings = collectFindings(
      report({
        "js-cookie": {
          severity: "high",
          via: [
            {
              source: 1111111,
              name: "js-cookie",
              severity: "high",
              url: "https://github.com/advisories/GHSA-qjx8-664m-686j",
              title: "prototype hijack in assign()",
              range: "<=3.0.5",
            },
          ],
          fixAvailable: false,
        },
        "@clerk/shared": { severity: "high", via: ["js-cookie"], fixAvailable: false },
      }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      package: "js-cookie",
      severity: "high",
      url: "https://github.com/advisories/GHSA-qjx8-664m-686j",
    });
  });

  it("falls back to the package severity when the advisory omits one", () => {
    const findings = collectFindings(
      report({ pkg: { severity: "critical", via: [{ url: "https://example.test/a" }] } }),
    );

    expect(findings[0].severity).toBe("critical");
  });

  it("normalises severity to lowercase so comparisons cannot miss", () => {
    const findings = collectFindings(
      report({ pkg: { via: [{ url: "https://example.test/a", severity: "HIGH" }] } }),
    );

    expect(findings[0].severity).toBe("high");
  });

  it("tolerates a report with no vulnerabilities at all", () => {
    expect(collectFindings(report({}))).toEqual([]);
    expect(collectFindings({})).toEqual([]);
  });
});

describe("isBlocking", () => {
  it("blocks HIGH and CRITICAL only", () => {
    expect(isBlocking({ severity: "critical" })).toBe(true);
    expect(isBlocking({ severity: "high" })).toBe(true);
    expect(isBlocking({ severity: "moderate" })).toBe(false);
    expect(isBlocking({ severity: "low" })).toBe(false);
  });
});

describe("evaluateFindings", () => {
  const high = { package: "js-cookie", severity: "high", url: "https://example.test/high" };
  const critical = { package: "next", severity: "critical", url: "https://example.test/critical" };
  const low = { package: "dompurify", severity: "low", url: "https://example.test/low" };

  it("fails on an unlisted HIGH, which is the whole point of the gate", () => {
    const { unlisted, stale } = evaluateFindings([high], []);

    expect(unlisted).toEqual([high]);
    expect(stale).toEqual([]);
  });

  it("passes an allowlisted HIGH", () => {
    const allowlist = [{ url: high.url, package: "js-cookie", added: "2026-10-16" }];

    const { unlisted, stale } = evaluateFindings([high], allowlist);

    expect(unlisted).toEqual([]);
    expect(stale).toEqual([]);
  });

  it("reports an allowlist entry that no longer matches anything as stale", () => {
    // The advisory was fixed upstream: the entry must not silently survive as a
    // permanent exemption for whatever reuses that package name next.
    const allowlist = [{ url: high.url, package: "js-cookie", added: "2026-10-16" }];

    const { stale, unlisted } = evaluateFindings([], allowlist);

    expect(stale).toEqual(allowlist);
    expect(unlisted).toEqual([]);
  });

  it("fails both ways at once when one advisory is new and another entry is rotten", () => {
    const allowlist = [{ url: "https://example.test/fixed", package: "old", added: "2026-01-01" }];

    const { unlisted, stale } = evaluateFindings([critical], allowlist);

    expect(unlisted).toEqual([critical]);
    expect(stale).toEqual(allowlist);
  });

  it("never lets a LOW or MODERATE finding keep an allowlist entry alive", () => {
    // Severity can drop without the advisory disappearing. Only a *blocking*
    // finding justifies an exception, so a downgraded advisory must surface the
    // entry as stale rather than quietly refreshing it.
    const allowlist = [{ url: low.url, package: "dompurify", added: "2026-10-16" }];

    const { ignored, blocking, stale } = evaluateFindings([low], allowlist);

    expect(ignored).toEqual([low]);
    expect(blocking).toEqual([]);
    expect(stale).toEqual(allowlist);
  });

  it("separates blocking from informational findings", () => {
    const { blocking, ignored } = evaluateFindings([critical, high, low], []);

    expect(blocking).toEqual([critical, high]);
    expect(ignored).toEqual([low]);
  });

  it("passes cleanly when there is nothing to report and nothing allowlisted", () => {
    // The state M10 actually ended in: an empty allowlist and an empty
    // production advisory set. Both halves must be empty for the gate to pass,
    // so this pins the zero-state rather than leaving it implied.
    const { blocking, ignored, unlisted, stale } = evaluateFindings([], []);

    expect(blocking).toEqual([]);
    expect(ignored).toEqual([]);
    expect(unlisted).toEqual([]);
    expect(stale).toEqual([]);
  });

  it("does not mutate the findings or the allowlist it is given", () => {
    const findings = [high, low];
    const allowlist = [{ url: high.url, package: "js-cookie", added: "2026-10-16" }];
    const findingsSnapshot = [...findings];
    const allowlistSnapshot = [...allowlist];

    evaluateFindings(findings, allowlist);

    expect(findings).toEqual(findingsSnapshot);
    expect(allowlist).toEqual(allowlistSnapshot);
  });
});
