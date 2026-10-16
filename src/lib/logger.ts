// src/lib/logger.ts
// ─── Structured logging ───────────────────────────────────────────────────────
// One JSON object per line, with a level, a timestamp, an optional requestId and
// a message. The shape is deliberately pino-compatible so a real log drain can
// consume it without a translation layer.
//
// Why not `pino` itself: this runs in both the Node and the Edge runtime, and the
// whole job is "serialise an object and scrub it". A dependency would buy little
// and adds a bundling risk in the Edge runtime.
//
// Privacy: `redact()` scrubs known-sensitive keys before anything is written, so
// a careless `log.info("user", { user })` cannot put an email address into the
// logs. This matters under UU PDP — logs travel further than the database does.

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Keys whose *values* are personal data or credentials. Substring matching,
// because the codebase writes names like `uploaderEmail` or `authorizationHeader`.
//
// Two deliberate traps are avoided: a bare `ip` would also match `description`
// (descri**p**tion), and `\bname\b` would not match `userName` at all.
const SENSITIVE = /(email|phone|address|bio|motto|password|secret|token|authorization|cookie|session|clerk|photo|\bip\b)/i;
// Any key ending in `name` is treated as a person's name. This over-redacts the
// odd `fileName`, which is a trade we take: leaking a student's name is worse
// than losing the name of a file in a log line.
const NAME_KEY = /name$/i;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE.test(key) || NAME_KEY.test(key);
}

const REDACTED = "[redacted]";
const MAX_DEPTH = 4;

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  // Errors have no enumerable own properties, so they need handling up front.
  // `stack` is kept: it is the single most useful field when something breaks.
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(child, depth + 1);
  }
  return out;
}

function activeLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

export interface Logger {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
  /** Returns a logger that adds `context` to every line. Used for requestId. */
  child(context: Record<string, unknown>): Logger;
}

/**
 * Normalises whatever a call site hands over. The parameter is `unknown` on
 * purpose: handlers overwhelmingly do `catch (error) { log.error(msg, error) }`,
 * and forcing every caller to wrap that in an object is exactly how logging gets
 * skipped. Errors become `{ error }`, primitives become `{ detail }`.
 */
function toFields(context: unknown): Record<string, unknown> {
  if (context === undefined || context === null) return {};
  if (context instanceof Error) return { error: context };
  if (typeof context === "object") return context as Record<string, unknown>;
  return { detail: context };
}

function buildLogLine(
  level: LogLevel,
  context: Record<string, unknown>,
  message: string,
  fields?: unknown,
): string {
  // Reserved keys are written last so a stray field cannot forge the level.
  return JSON.stringify({
    ...(redact(context) as Record<string, unknown>),
    ...(redact(toFields(fields)) as Record<string, unknown>),
    level,
    time: new Date().toISOString(),
    msg: message,
  });
}

function makeLogger(context: Record<string, unknown>): Logger {
  const write = (level: LogLevel, message: string, fields?: unknown) => {
    if (LEVEL_RANK[level] < LEVEL_RANK[activeLevel()]) return;
    const line = buildLogLine(level, context, message, fields);
    // warn/error go to stderr so a platform can split them from normal output.
    if (level === "error" || level === "warn") console.error(line);
    else console.log(line);
  };

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
    child: (extra) => makeLogger({ ...context, ...extra }),
  };
}

export const logger: Logger = makeLogger({});

/**
 * A logger bound to one incoming request. Correlates every line of a request
 * under a single `requestId`, which is what makes a stack trace in a log drain
 * usable at all.
 *
 * `proxy.ts` mints the id and forwards it as `x-request-id`, so the same value
 * also appears in any upstream/proxy logs.
 */
export function requestLogger(request: Request, context: Record<string, unknown> = {}): Logger {
  const requestId = request.headers.get("x-request-id") ?? newRequestId();
  return logger.child({ requestId, ...context });
}

/** Exported for tests and for callers that need an id before a Request exists. */
export function newRequestId(): string {
  // Web Crypto, not node:crypto: this module is also imported by proxy.ts, which
  // runs in the Edge runtime where Node built-ins are not available.
  return globalThis.crypto.randomUUID();
}
