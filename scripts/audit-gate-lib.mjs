// scripts/audit-gate-lib.mjs
// ─── The decision half of the audit gate ──────────────────────────────────────
// Split out of `audit-gate.mjs` for one reason: that file runs `npm audit` the
// moment it is imported, so nothing could test the part that actually decides
// pass/fail. This module has no side effects and no I/O, so it can be imported by
// a unit test directly.
//
// The logic here is small but load-bearing. Two behaviours are the whole point of
// the design, and both are easy to break while "simplifying":
//
//   1. An advisory npm reports only through a string `via` is *not* an advisory.
//      npm marks @clerk/shared HIGH purely because js-cookie underneath it is
//      HIGH, and `via` is then the plain string "js-cookie" rather than an
//      advisory object. Counting it would make one advisory look like two and
//      force a second, pointless allowlist entry.
//   2. An allowlist entry that matches nothing is a *failure*, not a no-op. That
//      is what stops the exception list from rotting into a blanket exemption
//      once upstream ships a fix.

/**
 * Flatten npm's package-centric report into advisory-centric findings.
 *
 * @param {object} report parsed `npm audit --json` output
 * @returns {Array<{package: string, severity: string, url: string, title: string, range: string, fixAvailable: boolean}>}
 */
export function collectFindings(report) {
  const findings = [];
  for (const [pkg, v] of Object.entries(report?.vulnerabilities ?? {})) {
    for (const via of v?.via ?? []) {
      // A string `via` names the package whose advisory this one inherits.
      if (typeof via !== "object" || !via.url) continue;
      findings.push({
        package: pkg,
        severity: (via.severity ?? v.severity ?? "unknown").toLowerCase(),
        url: via.url,
        title: via.title ?? "(no title)",
        range: via.range ?? v.range ?? "",
        fixAvailable: v.fixAvailable === true,
      });
    }
  }
  return findings;
}

/** HIGH and CRITICAL block; everything else is printed for visibility only. */
export function isBlocking(finding) {
  return finding.severity === "high" || finding.severity === "critical";
}

/**
 * Partition findings against the reviewed allowlist.
 *
 * @param {Array} findings from {@link collectFindings}
 * @param {Array<{url: string, package: string, added: string}>} allowlist
 * @returns {{blocking: Array, ignored: Array, unlisted: Array, stale: Array}}
 */
export function evaluateFindings(findings, allowlist) {
  const allowed = new Set(allowlist.map((a) => a.url));

  const blocking = findings.filter(isBlocking);
  const ignored = findings.filter((f) => !isBlocking(f));

  const unlisted = blocking.filter((f) => !allowed.has(f.url));

  // Only a blocking finding can keep an allowlist entry alive. An entry for
  // something that is now LOW/MODERATE has stopped justifying its existence.
  const matched = new Set(blocking.filter((f) => allowed.has(f.url)).map((f) => f.url));
  const stale = allowlist.filter((a) => !matched.has(a.url));

  return { blocking, ignored, unlisted, stale };
}
