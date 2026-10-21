// src/lib/rateLimit.ts
// ─── Rate limiting ────────────────────────────────────────────────────────────
// Fixed-window counters, applied per user *and* per client IP.
//
// Two backends, chosen at call time from the environment:
//
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set
//     → Upstash Redis over its REST API (plain `fetch`, no dependency)
//   otherwise
//     → an in-process Map
//
// Read the trade-off honestly: the in-memory backend only counts the requests
// that happen to land on the same server instance. On a serverless platform each
// invocation may be a fresh instance, so the in-memory backend does **not** stop
// a distributed flood. It is a development and single-instance fallback, and the
// structured warning it emits says so. Production needs Upstash.
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requestLogger, type Logger } from "@/lib/logger";

/**
 * Bucket keys are hashed before they are stored anywhere.
 *
 * Two reasons. The Upstash backend sends every key to a third party, and a raw
 * `x-forwarded-for` value is personal data under UU PDP. And a key ends up in a
 * log line when a limit trips, where a raw IP would be plain PII. A digest is
 * enough to count with and useless to read.
 *
 * `node:crypto` is fine here: unlike logger.ts, this module is only ever imported
 * by route handlers, which run in the Node runtime.
 */
function bucketId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

interface Bucket {
  limit: number;
  windowMs: number;
}

interface Policy {
  perUser: Bucket;
  perIp: Bucket;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;

/**
 * Per-route budgets. Deliberately tight on the routes that write content or
 * move points, generous on the read-ish ones, so a normal user never notices.
 * `modules/download` is high because a student may legitimately open several
 * materials in a row.
 */
export const RATE_LIMITS = {
  "modules/submit": { perUser: { limit: 5, windowMs: MINUTE }, perIp: { limit: 15, windowMs: MINUTE } },
  "questions/submit": { perUser: { limit: 10, windowMs: MINUTE }, perIp: { limit: 30, windowMs: MINUTE } },
  "profile/update": { perUser: { limit: 10, windowMs: MINUTE }, perIp: { limit: 30, windowMs: MINUTE } },
  "profile/report": { perUser: { limit: 5, windowMs: HOUR }, perIp: { limit: 20, windowMs: HOUR } },
  "modules/download": { perUser: { limit: 60, windowMs: MINUTE }, perIp: { limit: 120, windowMs: MINUTE } },
  "quiz/submit": { perUser: { limit: 30, windowMs: MINUTE }, perIp: { limit: 90, windowMs: MINUTE } },
  "quiz/daily-claim": { perUser: { limit: 3, windowMs: MINUTE }, perIp: { limit: 10, windowMs: MINUTE } },
  "exams/create": { perUser: { limit: 5, windowMs: MINUTE }, perIp: { limit: 15, windowMs: MINUTE } },
  // The list is a read, but an expensive one: it returns every exam's questions.
  // The cap is generous enough that a person refreshing never notices it.
  "exams/list": { perUser: { limit: 60, windowMs: MINUTE }, perIp: { limit: 120, windowMs: MINUTE } },
  "exams/submit": { perUser: { limit: 30, windowMs: MINUTE }, perIp: { limit: 90, windowMs: MINUTE } },
  // The only route that writes to object storage, so it is the one that costs
  // money per call. A module submission uploads one file; 15 a minute is far
  // more than a person needs and far less than a script wants.
  "uploads/create": { perUser: { limit: 15, windowMs: MINUTE }, perIp: { limit: 45, windowMs: MINUTE } },
  // Public and anonymous, so only the IP budget can ever apply. A single broken
  // page can emit a burst of reports; a whole school shares one NAT address.
  "csp/report": { perUser: { limit: 120, windowMs: MINUTE }, perIp: { limit: 120, windowMs: MINUTE } },
  // Consent is recorded once per policy version, so this budget exists only to
  // stop a script from hammering the write. The caller may not have a database
  // row yet, so the route passes `null` and only the IP bucket applies.
  "consent/accept": { perUser: { limit: 5, windowMs: MINUTE }, perIp: { limit: 15, windowMs: MINUTE } },
  // Reading your own data. Cheap, but it serialises every row the user owns, so
  // it is not something to let a script call in a tight loop.
  "profile/export": { perUser: { limit: 3, windowMs: HOUR }, perIp: { limit: 10, windowMs: HOUR } },
  // Deleting an account is a one-way door. Nothing legitimate calls it twice.
  "profile/delete": { perUser: { limit: 3, windowMs: HOUR }, perIp: { limit: 10, windowMs: HOUR } },
  // One switch, flipped by a human. Generous for a person, bounded for a script.
  "profile/notifications": { perUser: { limit: 30, windowMs: HOUR }, perIp: { limit: 60, windowMs: HOUR } },
  // The retention job runs on a schedule, not in a loop, and it is guarded by a
  // shared secret rather than a session. The IP bucket is the only real signal.
  "cron/retention": { perUser: { limit: 6, windowMs: HOUR }, perIp: { limit: 12, windowMs: HOUR } },
  // The season job does the same kind of work on a schedule: a rollover, three
  // seat changes and one stipend per seat. Same budget shape, same reason.
  "cron/season": { perUser: { limit: 6, windowMs: HOUR }, perIp: { limit: 12, windowMs: HOUR } },
  // Reading the moderation trail. Reviewer-only, but it is a page through a
  // table that only ever grows, so it gets a budget of its own rather than
  // sharing the read allowance of the public routes.
  "moderator/audit-log": { perUser: { limit: 60, windowMs: MINUTE }, perIp: { limit: 120, windowMs: MINUTE } },
  // A bookmark is one row keyed by (user, module). The button is clicked by a
  // human, so this budget is generous for a person and still bounded for a script.
  "bookmarks/toggle": { perUser: { limit: 60, windowMs: MINUTE }, perIp: { limit: 120, windowMs: MINUTE } },
} as const satisfies Record<string, Policy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMITS;

interface Counter {
  count: number;
  resetAt: number;
}

/**
 * The client address, taken from the forwarding headers a proxy sets.
 *
 * Caveat: `x-forwarded-for` is only trustworthy when the platform overwrites it
 * (Vercel does). On a bare Node server behind nothing, a client can forge it — so
 * this is a rate-limit signal, never an authorization one.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// ─── In-memory backend ────────────────────────────────────────────────────────

const memory = new Map<string, Counter>();
const MEMORY_PRUNE_THRESHOLD = 5_000;

function pruneMemory(now: number) {
  if (memory.size < MEMORY_PRUNE_THRESHOLD) return;
  for (const [key, counter] of memory) {
    if (counter.resetAt <= now) memory.delete(key);
  }
}

function incrementInMemory(key: string, windowMs: number): Counter {
  const now = Date.now();
  pruneMemory(now);

  const existing = memory.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh: Counter = { count: 1, resetAt: now + windowMs };
    memory.set(key, fresh);
    return fresh;
  }

  existing.count += 1;
  return existing;
}

/** Clears module state that would otherwise leak between tests. */
export function resetInMemoryCounters(): void {
  memory.clear();
  warnedAboutMemoryBackend = false;
}

// ─── Upstash backend ──────────────────────────────────────────────────────────

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let warnedAboutMemoryBackend = false;

/**
 * Says once per process, in production, that the limiter is running without a
 * shared store. Without this the deployment looks protected and is not; with it
 * the operator gets exactly one line naming the missing environment variable.
 */
function warnIfUnguarded(log: Logger): void {
  if (warnedAboutMemoryBackend) return;
  if (process.env.NODE_ENV !== "production") return;
  if (upstashConfigured()) return;

  warnedAboutMemoryBackend = true;
  log.warn("rate_limit_in_memory_backend", {
    detail:
      "UPSTASH_REDIS_REST_URL is not set, so limits are per-instance and will not stop a distributed flood",
  });
}

/**
 * One HTTP round trip per bucket, using Upstash's pipeline endpoint so the
 * INCR/EXPIRE/PTTL trio is evaluated without a client library.
 * `EXPIRE ... NX` only sets a TTL when the key has none, which keeps the window
 * from being pushed forward by every request.
 */
async function incrementUpstash(key: string, windowMs: number): Promise<Counter> {
  const base = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, "");
  const response = await fetch(`${base}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, Math.ceil(windowMs / 1000), "NX"],
      ["PTTL", key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash responded ${response.status}`);
  }

  const results = (await response.json()) as Array<{ result: number }>;
  const count = Number(results[0]?.result ?? 1);
  const pttl = Number(results[2]?.result ?? -1);

  return {
    count,
    resetAt: Date.now() + (pttl > 0 ? pttl : windowMs),
  };
}

async function increment(key: string, windowMs: number): Promise<Counter> {
  if (upstashConfigured()) return incrementUpstash(key, windowMs);
  return incrementInMemory(key, windowMs);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type RateLimitOutcome = { ok: true } | { ok: false; response: Response };

/**
 * Counts the request against every applicable bucket and returns a 429 when one
 * is exhausted. The shape mirrors `requireUser`/`requireReviewer` in authz.ts so
 * a route reads the same way:
 *
 *   const limit = await rateLimit(req, "modules/submit", authz.user.id);
 *   if (!limit.ok) return limit.response;
 *
 * `identity` is the stable principal to count against — pass the **database user
 * id**, never a Clerk id or an email. Pass `null` when the handler does not know
 * the caller yet; the IP bucket still applies.
 *
 * Availability note: if the backing store errors, the request is allowed through
 * and the failure is logged. Failing closed would turn a Redis hiccup into a
 * platform-wide outage, which is the worse outcome for a school.
 */
export async function rateLimit(
  request: Request,
  policyName: RateLimitPolicyName,
  identity: string | null,
): Promise<RateLimitOutcome> {
  const policy: Policy = RATE_LIMITS[policyName];
  const log = requestLogger(request, { policy: policyName });

  warnIfUnguarded(log);

  const buckets: Array<{ scope: "ip" | "user"; key: string; bucket: Bucket }> = [
    {
      scope: "ip",
      key: `ratelimit:${policyName}:ip:${bucketId(clientIp(request))}`,
      bucket: policy.perIp,
    },
  ];
  if (identity) {
    buckets.push({
      scope: "user",
      key: `ratelimit:${policyName}:user:${bucketId(identity)}`,
      bucket: policy.perUser,
    });
  }

  for (const { scope, key, bucket } of buckets) {
    let counter: Counter;
    try {
      counter = await increment(key, bucket.windowMs);
    } catch (error) {
      // Fail open, loudly. See the note above.
      log.error("rate limit store unavailable; allowing the request", { error, scope });
      continue;
    }

    if (counter.count > bucket.limit) {
      const retryAfter = Math.max(1, Math.ceil((counter.resetAt - Date.now()) / 1000));

      // A distinct event name so a log drain can alert on it without parsing prose.
      // `identity` is the database user id (a UUID), never a Clerk id or an IP.
      log.warn("rate_limit_exceeded", {
        scope,
        limit: bucket.limit,
        windowMs: bucket.windowMs,
        retryAfter,
        userId: identity ?? undefined,
      });

      return {
        ok: false,
        response: NextResponse.json(
          { error: "Too many requests", retryAfter },
          {
            status: 429,
            headers: {
              "retry-after": String(retryAfter),
              "cache-control": "no-store",
            },
          },
        ),
      };
    }
  }

  return { ok: true };
}
