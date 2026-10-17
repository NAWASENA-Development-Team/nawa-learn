<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**This is a `src/` project.** The app lives at `src/app`, so every Next.js *file convention* must also live under `src/` — `src/proxy.ts` (not `proxy.ts`), and likewise for `instrumentation.ts` and friends. Next resolves these files **relative to the directory that holds `app`/`pages`**, and it does so **silently**: a mislocated `proxy.ts` builds cleanly and simply never runs. Nothing warns you. This actually happened — root `proxy.ts` was dead from M1 to M9, taking the auth gate, the CSRF guard, and the CSP with it (see C6 in `docs/AUDIT-AND-ROADMAP.md`).

After touching a file convention, prove it is live — and do **not** reach for `middleware-manifest.json`. On Next 16 + Turbopack both `server/middleware-manifest.json` and `server/middleware/middleware-manifest.json` stay `{"middleware":{}}` **even when the proxy is running**, so an empty manifest proves nothing at all. The two signals that genuinely differ are: (1) `next build` prints a `ƒ Proxy (Middleware)` line, and (2) a real `next start` answers `GET /` with a `content-security-policy` header carrying a nonce.
<!-- END:nextjs-agent-rules -->

## Avatar System

### 22+ Custom SVG Avatars
The profile page now features 22+ custom SVG avatars with fantasy and sci-fi themes:

**Fantasy Avatars (10):**
- Wizard (Penyihir Rumus)
- Knight (Ksatria Baja)
- Dragon (Naga Penjaga)
- Elf (Peri Hutan)
- Mage (Penyihir Rumus)
- Archer (Pemanah Mahir)
- Paladin (Kesatria Cahaya)
- Rogue (Pencuri Bayangan)
- Necromancer (Penyihir Gelap)
- Bard (Penyanyi Legendaris)

**Sci-Fi Avatars (13):**
- Cyborg (Cyborg Futuristik)
- Alien (Makhluk Asing)
- Robot (Robot Cerdas)
- Astronaut (Penjelajah Angkasa)
- Hacker (Hacker Jenius)
- Pilot (Pilot Pemberani)
- Android (Android Canggih)
- Spaceman (Prajurit Luar Angkasa)
- Scientist (Ilmuwan Brilian)
- Engineer (Insinyur Handal)
- Explorer (Penjelajah Petualang)
- Guardian (Penjaga Galaksi)
- Mystic (Mistis Gaib)

### Avatar Implementation
- Location: `public/avatars/*.svg`
- Avatar picker in `src/components/profile/ProfileClient.tsx`
- Users can select avatars from the profile page
- Selected avatar is saved to localStorage
- Each avatar has a unique gradient background color

### Moderator Panel Security
- Moderator panel is hidden from public navigation unless the signed-in user has reviewer rights.
- Access is **role-based**, not password-based: the panel opens only when `users.role` is `moderator` or `admin`.
- `isModerator` is resolved server-side via `GET /api/moderator/auth-check`. There is no client-side password or `sessionStorage` flag.
- All reviewer API routes are guarded by `requireModerator()` from `src/lib/authz.ts`.
- To grant access, promote a user's role:
  `npm run db:promote -- someone@example.com moderator` (see `src/db/promote.ts`).
- Authentication itself (deny-by-default for every route) is enforced in `src/proxy.ts`.

## Badge System (80+ Achievements)

### Overview
Comprehensive competitive badge system with 80+ achievements organized into 5 categories. Students can compete to collect badges by contributing, learning, and engaging with the platform.

### Badge Categories

**1. Contribution Badges (20 badges)**
Earned by uploading modules and creating questions:
- First Step, Module Contributor, Prolific Contributor
- Knowledge Creator, Question Master, Library Builder
- Generous Sharer, Popular Author, Viral Content, Content Legend
- Balanced Contributor, Super Contributor, Mega Contributor
- First Module, First Question, Twenty Modules, Twenty Questions
- Hundred Downloads, Three Hundred Downloads, Seven Hundred Downloads

**2. Learning Badges (15 badges)**
Earned by consistent learning and account longevity:
- Learner, Dedicated Learner, Loyal Member, Veteran Member, Founding Member
- Math Enthusiast, Science Master, Language Expert, History Scholar
- Multi Subject, All Subjects
- Consistent Learner, Semester Member, Year Member

**3. Milestone Badges (20 badges)**
Earned by reaching point and ranking milestones:
- Fifty Points, Hundred Points, Two Hundred Points, Three Hundred Points
- Five Hundred Points, Seven Hundred Fifty Points, Thousand Points, Fifteen Hundred Points, Two Thousand Points
- Top 50, Top 20, Top 10, Top 5, Number One
- Level 2, Level 5, Level 10, Level 15, Level 20

**4. Social Badges (15 badges)**
Earned by helping the community and gaining popularity:
- Helpful Peer, Community Builder, Knowledge Sharer, Inspiration Source
- Mentor Figure, Role Model, Generous Contributor, Beloved Teacher
- Legend Maker, Question Guru, Module Expert, Trusted Contributor
- Community Hero, Beacon of Knowledge

**5. Special Badges (10 badges)**
Rare and unique achievements:
- Early Bird, Speedster, Perfectionist, Night Owl, Weekend Warrior
- Consistency King, Renaissance Person, Hall of Fame
- Platinum Member, Eternal Student

### Rarity Levels
- **Common** (Gray): Basic achievements
- **Uncommon** (Green): Moderate difficulty
- **Rare** (Blue): Challenging achievements
- **Epic** (Purple): Very difficult achievements
- **Legendary** (Gold): Extremely difficult achievements

### Implementation Details
- Location: `src/lib/badges.ts`
- Badge evaluation in: `src/components/profile/ProfileClient.tsx`
- Dynamic unlock conditions based on:
  - Points accumulated
  - Leaderboard rank
  - Number of approved modules/questions
  - Total downloads
  - Modules by subject
  - Account age in days

### Badge Display
- Organized by category in profile page
- Shows progress per category (X / Y badges unlocked)
- Unlocked badges display with rarity gradient and icon
- Locked badges show how to unlock them
- Hover effects and smooth transitions

### Adding New Badges
To add new badges, edit `src/lib/badges.ts`:
1. Add badge object to `BADGES` array
2. Define unlock condition function
3. Set category, rarity, icon, and description
4. Badges automatically appear in profile

## Observability

### Structured logging
- `src/lib/logger.ts` — one JSON object per line with a pino-compatible shape (`level`, `time`, `msg`, `requestId`).
- Every API route handler takes a `Request` and binds `const log = requestLogger(req);` as its first statement. That binding is what puts a `requestId` on each line.
- No `console.log` in server code — use `log.info` / `log.warn` / `log.error`.
- `log.error("message", error)` accepts the error directly; it is normalised to `{ error: { name, message, stack } }`.
- **PII redaction is by key name** (`email`, `*name`, `clerkId`, `token`, `authorization`, `cookie`, `bio`, `motto`, `photo*`, `*ip*`). Always give a bare value a named key — `log.error("no row", { clerkId })` — because a value passed without a key lands under `detail` and is **not** redacted.
- Verbosity follows `LOG_LEVEL` (default: `info` in production, `debug` otherwise).

### Health check
- `GET /api/health` is deliberately public (see `PUBLIC_ROUTES` in `src/proxy.ts`) so an uptime monitor can reach it without a session. It returns only coarse status — `{ status, checks: { database, auth }, timestamp }` — with `200` healthy / `503` degraded, and `cache-control: no-store`.
- Do not add data to it. The real failure reason goes to the logs, never to the anonymous caller.
- `tests/unit/health.test.ts` asserts that no database error detail leaks into the response body.

### Rate limiting & anti-abuse
- `src/lib/rateLimit.ts` — fixed-window counters applied **per user and per IP** on the mutating routes. Budgets live in `RATE_LIMITS`.
- Route usage: `const limit = await rateLimit(req, "modules/submit", dbUser.id); if (!limit.ok) return limit.response;` — call it **before reading the body**, and pass the **database user id**, never a Clerk id or an email (pass `null` when the identity is unknown; the IP bucket still applies).
- Backends: Upstash Redis when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, otherwise an in-process `Map`. **The in-memory backend does not stop a distributed flood on serverless** — production needs Upstash. The limiter fails **open** and logs loudly if the store errors.
- Bucket keys are `sha256` digests, so no raw IP or user id reaches Upstash (a third party) or a log line.
- A tripped limit logs the alertable event `rate_limit_exceeded` and answers `429` with `Retry-After` and `cache-control: no-store`.
- `src/lib/abuse.ts` — `flagPointSpike()` logs `point_spike_detected` when a user's credited points in a 10-minute window pass `POINT_SPIKE_THRESHOLD`. It is a deliberately blunt tripwire, not a precise detector; alert on it from a log drain.
- Tests reset the in-memory counters through `tests/setup.ts` (registered as `setupFiles`), so one test never spends the next one's budget.

## Input validation & uploads

### One way to read a JSON body
- `src/lib/validation.ts` — every POST route reads its body through `parseJsonBody(req, schema)` (or `readJsonBody` when there is no schema). Do not call `req.json()` directly; the only exception is `webhooks/clerk`, where svix signature verification needs the untouched raw body.
- Usage: `const parsed = await parseJsonBody(req, mySchema); if (!parsed.ok) return parsed.response;` — `parsed.data` is typed from the schema.
- Rejections are uniform and all carry `cache-control: no-store`:
  - **400** `{ error, details: [{ path, message }] }` — schema failure. `path` is a **dotted string** (`"options.A"`), and `"(root)"` for a whole-body issue. `fieldErrors()` also splits `.strict()` failures into one entry per unknown key.
  - **413** — body over the ceiling (`MAX_JSON_BODY_BYTES`, 64 KB by default; `exams/create` raises it to 256 KB).
  - **415** — a JSON route called with a non-JSON `content-type`.
- Schemas are `.strict()`, so a typo'd key is a 400 rather than a silent no-op. Reusable field helpers: `shortText`, `optionalText`, `httpUrl` (`httpUrl` refuses `data:` and `javascript:`).

### Uploads go to object storage, never into a column
- `src/lib/storage.ts` — the official `@vercel/blob` SDK (`put` / `del`) plus the parts the SDK cannot know: the magic-byte sniffer, the size ceilings, `buildPathname()` and `isOwnStorageUrl()`. It reads `BLOB_READ_WRITE_TOKEN`.
  - The token is passed **explicitly** on every call. Left alone the SDK resolves credentials OIDC-first, so a deployment with `VERCEL_OIDC_TOKEN` set would pick the store from `BLOB_STORE_ID` and silently ignore our token.
  - Every call runs under an `AbortController` deadline (`withDeadline`). The SDK retries up to ten times with backoff, and it only reads an `AbortError` as "give up" — `AbortSignal.timeout` reports a `TimeoutError` and would be retried like any other failure.
  - Every failure surfaces as a typed `StorageError` (`not_configured` / `unavailable`); the caller never sees an SDK error class.
- `src/lib/uploadClient.ts` — the browser half. `uploadFile(file, "avatar" | "module")` posts multipart to `/api/uploads` and returns `{ ok, url?, error? }`. Its `MAX_*`/`ACCEPTED_*` constants are **mirrors** of `storage.ts` (which imports `node:crypto` and cannot be bundled client-side); a unit test asserts they stay in sync.
- `POST /api/uploads` — `requireUser()` + `rateLimit(req, "uploads/create", user.id)`, then a `content-length` pre-check, then multipart parsing, then **magic-byte** detection.
  - Accepted: avatar → png/jpeg/webp (≤2 MB); module → the same plus PDF (≤10 MB). SVG is deliberately excluded (it can carry script and is served inline).
  - A declared `content-type` that disagrees with the sniffed bytes is **rejected** (`type_mismatch`), not silently rewritten.
  - Returns **503** when `BLOB_READ_WRITE_TOKEN` is unset. There is deliberately **no base64 fallback** — an unconfigured deploy must fail loudly, not quietly re-bloat Postgres.
  - Object path is `uploads/<userId>/<uuid>.<ext>`; overwrite and random-suffix are both off.
- Where a URL is stored:
  - `users.photo_url` (via `profile/update`) may only be `null` or an `isOwnStorageUrl()` URL. An arbitrary https URL would turn the leaderboard into a third-party image host and a tracking pixel. Replacing or clearing the photo deletes the old object (best effort, non-fatal).
  - `modules.content_url` (via `modules/submit`) must be `http(s)`; `data:` is refused. Google Drive links remain valid.
- `next.config.ts` — `images.remotePatterns` is a single explicit entry, `*.public.blob.vercel-storage.com`. Never widen it back to `**`: that makes the image optimizer an open proxy (SSRF).
- The module reader (`ModulesLibraryClient`) renders own-blob PDFs/images directly and still supports the legacy `data:` PDF rows. Replacing a just-uploaded file before submitting leaves an orphaned blob; there is no garbage collector yet (tracked as future work).

## Security headers, CSP & CSRF

### One module owns the header set
- `src/lib/securityHeaders.ts` has **zero imports** on purpose: `next.config.ts` is loaded outside the app's module graph and `src/proxy.ts` runs on the Edge, so anything Node- or Clerk-specific in here would break one of them. It exports `CSP_DIRECTIVES` (a plain `Record<string, string[]>`), `SECURITY_HEADERS`, `HSTS_HEADER`, `CSP_REPORT_PATH` and `staticSecurityHeaders(isProduction)`.
- `next.config.ts` `headers()` sends the request-independent set to `/(.*)`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (deny-all except `camera=(self)`, which `SubmitClient` needs for note capture), and `Cross-Origin-Opener-Policy: same-origin-allow-popups` (the popup-safe value for Clerk's OAuth — `same-origin` would sever `window.opener` and break "Masuk dengan Google").
- HSTS is only sent when `NODE_ENV === "production"`, with `includeSubDomains` and **without** `preload` (a one-way door that needs a separate, deliberate decision).

### The CSP is nonce-based and lives in `src/proxy.ts`
- `clerkMiddleware`'s `contentSecurityPolicy` option is given a **callback** `(req) => ({ … })` because `reportTo` needs an absolute URL built from the request (`x-forwarded-proto` + `x-forwarded-host`/`Host`); `Reporting-Endpoints` rejects relative values. A legacy `report-uri` directive carries the same URL.
- `strict: true` strips `http:`/`https:` from `script-src` and adds `'strict-dynamic'` + a fresh nonce per request. Clerk's helper **unions** our directives with its own defaults, so our map only ever adds: `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `img-src` extras (`data:` for legacy base64 rows, `blob:` for the camera preview, `https://*.blob.vercel-storage.com`), `frame-src 'self'` + `https:` (the module reader's iframe), and `connect-src 'self'`. Clerk keeps `'unsafe-inline'` in `script-src`, but browsers ignore it whenever a nonce is present.
- **Never hand-roll the CSP header.** Clerk's defaults carry the hosts it needs (frontend API, telemetry, `img.clerk.com`, Stripe, Google Maps, `challenges.cloudflare.com`) and they change between releases.

### A nonce forces every route to render dynamically
- `src/app/layout.tsx` reads `headers().get("x-nonce")` and passes it to `<ClerkProvider nonce={nonce}>` and `<ThemeProvider nonce={nonce}>`. Both render a `<script>`; under `'strict-dynamic'` a document script tag is only trusted if it carries the nonce, so omitting either one costs sign-in or the theme.
- Reading `headers()` in the root layout opts **every** route into dynamic rendering. That is a requirement of nonce CSP, not a regression: a nonce cannot be baked into HTML prerendered at build time. It incidentally fixes `/moderator` and `/questions/practice`, which used to be statically prerendered.
- `@vercel/analytics` needs nothing special: it injects its script via `document.createElement("script")` in `useEffect`, which `'strict-dynamic'` trusts.

### CSRF guard runs before authentication
- `src/lib/csrf.ts` — `isCrossSiteRequest(req)` and `requestOrigin(req)`, deliberately free of Clerk imports so it is unit-testable with a plain object.
- Rule: only `POST`/`PUT`/`PATCH`/`DELETE`. If `Origin` is present, its **host** must equal `x-forwarded-host` ?? `Host` ?? `nextUrl.host`; an unparseable or `null` origin **fails closed**. Otherwise fall back to `Sec-Fetch-Site` and refuse anything that is not `same-origin`/`none`. Neither header present → allowed (Svix webhooks, cron, curl — their authenticity is proven elsewhere).
- Hosts, not full origins: behind TLS termination the request can arrive as `http` while the browser saw `https`, so comparing schemes would reject every production mutation. A browser cannot forge `Host`, and a port is part of the host string.
- It runs at the top of `src/proxy.ts`, **before** `auth()`. Test-visible consequence: a cross-site request to a protected route answers **403**, never 401.
- `SameSite=Lax` cookies are not a substitute — "the browser will not send the cookie" is a property of the browser, not of our code.

### CSP violation sink
- `POST /api/csp-report` is public (`PUBLIC_ROUTES`) and anonymous: browsers send these without credentials. It stores nothing and answers **204**; the value is entirely in the log drain.
- Accepts `application/csp-report` (legacy `report-uri` shape), `application/reports+json` (Reporting API batch) and `application/json`; normalises both into `{ directive, blockedUri, documentUri, sourceFile, lineNumber, disposition, sample }`. Unsupported type → **415**, malformed JSON → **400**, over 16 KB → **413**, `GET` → **405**.
- Emits the alertable event `csp_violation` (plus `csp_violation_truncated` when a report is clipped). `original-policy` is deliberately never logged, every string field is cut at 200 chars (a blocked `data:` URI can be megabytes), and one request writes at most 10 lines.
- Budget: `csp/report` — 120/min per IP in `RATE_LIMITS`. A single broken page can emit a burst, and a school shares one NAT address.

## Custom exams (student-authored) — grading is server-side

### Two endpoints, one secret
- A custom exam is **not** rows in `questions`. It is one jsonb blob on `custom_exams.questions`, and the answer key sits *inside* each question. The blob is therefore the secret: the moment it is serialised to a browser, the exam is over.
- `src/lib/examScoring.ts` owns both halves and must never lose either: `toPublicExamQuestions(raw)` (the only shape a browser may receive) and `gradeExam(raw, answers)` (the only place a submitted answer meets a key). It imports no database and no Next.js code, which is what makes it directly testable.
- `POST /api/exams/submit` takes `{ examId, answers }`, grades against the stored keys, and answers with the **same shape as `/api/quiz/submit`** (`results: [{ questionId, correct, correctKey }]`) so the practice page keeps one rendering path. `examSubmitSchema` is `.strict()`, so a body carrying its own `correctCount` is a 400 — the score is derived, never accepted.
- It **awards nothing**, and that is a decision, not an omission (M3): an exam a student wrote can never move V-Points. No `pointsLog` write, no `users.points` update, always `rewardable: false, pointsAwarded: 0`.
- `GET /api/exams/list` redacts on the server, before serialisation. `toPublicExamQuestions` **rebuilds** each object from an allowlist of fields rather than deleting `answerKey` from the stored one, so no spread can bring the key back. It also drops `__proto__`/`constructor`/`prototype` option keys. `tests/unit/examScoring.test.ts` asserts the literal string `answerKey` never appears in the serialised result.
- `explanation` **is** sent — it is not a secret, only the key is, and the review screen shows it after grading.

### `requireSession()` — the cheap guard
- `src/lib/authz.ts` exports `requireSession()` alongside `requireUser()`/`requireModerator()`. It calls only `auth()` and fetches no user row; it returns the **Clerk id, never a database id**.
- Use it for a route that needs *a* session but has no use for the user (`api/modules/count`, `api/modules/download`). The point is that "not worth an extra query on the hot path" is no longer a reason to skip an in-handler guard.
- Every route must authorize in the handler. `src/proxy.ts` is defence in depth, **not** the only defence — it was dead code from M1 to M9 (see C6) and three routes silently lost their only gate. `api/exams/list`, `api/modules/count` and `api/modules/download` are now guarded locally.
- Never hand `requireSession()`'s Clerk id to `rateLimit` or to an ownership check. Pass the **database** user id, or `null` when the identity is unknown — the IP bucket still applies.

## Privacy & data governance (UU PDP)

### Consent is a server-side gate, not a sign-up checkbox
- `src/lib/policy.ts` holds `POLICY_VERSION` and `hasAcceptedCurrentPolicy()`. The version lives in **code**, never as a column default: bumping it is what re-prompts every user whose stored version no longer matches.
- The gate is `src/app/(dashboard)/layout.tsx`, not the Clerk `<SignUp>` form. A layout runs before any page beneath it, so form sign-up, Google OAuth and pre-M11 rows are all caught by one check. Clerk's express-consent checkbox is a dashboard toggle that cannot be tested and fails silently; ours cannot.
- `/consent` deliberately sits **outside** the `(dashboard)` route group. Inside it, the gate would redirect the consent page to itself and the user could never accept anything.
- **`POST /api/consent/accept` is the only writer** of `users.consent_policy_version` / `users.consent_accepted_at`. It takes the version from the server constant, never from the body, and the schema is `.strict()` with `accept: true` required.
- The Clerk webhook **never** writes consent. It knows an account was created; it does not know anyone ticked anything. A `legal_accepted_at` from Clerk is logged (`clerk_legal_consent_seen`) but never stored as our consent — Clerk does not know our version.
- Pre-M11 accounts have `NULL` consent columns and are asked **once**. That is intended, not an oversight.

### `RETENTION_POLICY` is one array with two readers
- `src/lib/retention.ts` owns the windows (`reports` 12 months, `points_log` 24, `submissions` 24). The table on `/privacy` renders from it and `runRetention()` deletes from it, so the policy a student reads cannot drift from the one the machine runs.
- `modules`, `questions` and `custom_exams` are deliberately **not** retention targets: they are library content other students read, not a record about one person. Attribution is handled by account deletion instead.
- `POST /api/cron/retention` is **POST-only** — `GET` answers 405. It is destructive, and a GET can be fired by a prefetcher, crawler or stray tab. Vercel Cron sends POST.
- An unset `CRON_SECRET` means **401 for everyone** (fail closed), logged as `cron_retention_misconfigured` rather than `cron_retention_unauthorized` because the two need different midnight actions. The token comparison is hand-rolled constant-time so no `node:crypto` is needed on that path. Schedule lives in `vercel.json`.

### Data-subject requests: export and delete
- `GET /api/profile/export?format=json|csv` and `POST /api/profile/delete` back `/profile/privacy`. Both take the identity **from the session**; there is no `userId` field anywhere, so the routes cannot be aimed at someone else.
- Route handlers are **not** under `(dashboard)/layout.tsx`, so the consent gate does not cover them — each guards itself (`requireUser()` → `rateLimit()` → then read input).
- Export lists every column **by name**. A bare `select()` would silently pick up PII columns added later.
- CSV is long form (`kategori,kolom,nilai`) with a BOM (Excel reads UTF-8) and a leading `'` on cells starting with `=`, `+`, `-`, `@`, tab or CR to defuse CSV injection. Six record types with unrelated columns cannot share one header without dropping data, and this file is evidence.
- Delete is **anonymisation, not `DELETE FROM users`**: `modules.uploader_id`, `questions.uploader_id` and `submissions.submitter_id` are `NOT NULL` and point here, so deleting the row would destroy unrelated students' work. `clerk_id` becomes a unique `deleted:<uuid>` tombstone, identity fields are blanked, consent columns are nulled, `reports` + `points_log` are deleted, and the user's exams are renamed to "Anonim". The UI requires typing `HAPUS AKUN SAYA`, and that phrase is defined **once** in `src/lib/accountConstants.ts` — a copy anywhere else is the drift the module exists to prevent (`tests/unit/ci-gates.test.ts` fails if a second literal appears in `src/`).
- Order is deliberate and **not transactional** (Neon HTTP has none): local data is anonymised first, the Clerk account is deleted last. If the last step fails the user already has no personal data with us and it is logged (`account_deletion_clerk_failed`); the reverse — Clerk gone, data still here — would be unrecoverable.

## Secrets & supply chain

### The repository is public
- A credential that reaches a commit is **published**, and deleting the file afterwards does not unpublish it: the value stays in the history and in every fork. `.env.local` (live Clerk, Neon and Vercel Blob credentials) has stayed untracked so far — that was luck, not a control.
- Never copy a value out of `.env.local` into `.env.example`, a test, a doc, or a commit message. `.env.example` holds placeholders only.
- If a secret ever does leak, **rotate it first** and clean the history second. Rotation is the only step that actually revokes anything.

### `.env.example` is the contract
- Every variable the app reads is documented there, split into required / optional / platform-injected. `tests/unit/env-example.test.ts` scans the **whole repository** (not just `src/**` — the first version did that and silently missed `drizzle.config.ts`, the file that decides where migrations run) for `process.env.X` and fails when the template falls behind, so adding a variable without documenting it breaks the build rather than someone's first `npm run dev`.
- `.gitignore` has `.env*`, which swallows the template too. The `!.env.example` negation below it is load-bearing and is asserted by the same test.

### gitleaks
- `.gitleaks.toml` uses the default rule set as-is and carries **one** allowlist entry — the fake Stripe key in the log-redaction fixture in `tests/unit/logger.test.ts` — and **no `paths` exemption**. The first version carried ten regexes and two path exemptions; running the real binary against the real history showed nine of the regexes suppressed nothing and both path entries were redundant. A dead allowlist entry is an unreviewed blind spot, so do not add one "just in case": add an entry only for a value that genuinely trips a rule, and say which rule and which file.
- CI **installs gitleaks itself** (`.github/workflows/ci.yml`, version pinned and its sha256 checked against the release's `checksums.txt`) rather than using `gitleaks/gitleaks-action`. The action gates on the **repository owner's type**, not on visibility: for an Organization owner it exits 1 without a `GITLEAKS_LICENSE` secret, and this repo's owner is an organization. It also defaults to gitleaks 8.24.3 and scans only the pushed range.
- `.githooks/pre-commit` runs `scripts/secret-scan.mjs --staged`; `scripts/setup-git-hooks.mjs` installs it by setting `core.hooksPath`, and npm runs that automatically through the `prepare` script. `npm run hooks:install` does it by hand. CI runs the same wrapper over the full history, so the two cannot drift.
- The hook is committed as **mode 100755 with LF endings**, and `.gitattributes` forces `eol=lf` for `.githooks/*`. Both matter, and neither is visible in a diff: POSIX git silently skips a hook that lacks the execute bit (it warns once and lets the commit through), and a CRLF shebang is not a shebang — `core.autocrlf=true` is the Windows default and git for Windows runs hooks through its bundled `sh`. `tests/unit/ci-gates.test.ts` asserts both, because a scanner that quietly stops running looks exactly like a scanner that finds nothing.
- The wrapper picks the subcommand spelling from the scanner's **version**, never from its exit code: `gitleaks` exits 1 for "leaks found" *and* for "unknown command", so an exit-code fallback reads a syntax error as a finding and blocks a commit while accusing the author of a leak they do not have. Below 8.19 it skips, loudly.
- A missing `gitleaks` binary makes the hook **warn and exit 0**. A local scanner that is not installed must never block a commit — CI is the real gate. But the *same* wrapper **fails (exit 2)** when `CI` is set and the binary is missing or older than 8.19, because "the scan never ran" and "the scan found nothing" look identical from outside, and a secret-scan job that quietly does nothing is worse than no job. The workflow installs gitleaks itself, so CI never legitimately takes that branch.
- Never scan the working tree (`gitleaks dir`): it does not honour `.gitignore`, so it reads `.env.local` and `.next/` and reports the **live** credentials as findings. Those files are precisely the ones that must not be committed, so the alarm is useless and trains people to bypass the hook. History is the thing to scan.

### Dependency advisories
- `npm run audit:gate` (`scripts/audit-gate.mjs`) blocks HIGH/CRITICAL advisories that are not on a reviewed allowlist, and **also blocks when an allowlist entry stops matching anything**, so exceptions cannot rot into permanent exemptions. LOW/MODERATE are printed but do not block.
- Do not add an allowlist entry to make CI green. Add one only after confirming the vulnerable path is unreachable from this app, and write that reason down.
- The allowlist is currently **empty**, and that is the target state, not an oversight. The two entries M10 shipped (`js-cookie`, `source-map-js`) were deleted the same day, once a non-force `npm audit fix` was shown to clear them — the gate itself refused to pass while they were stale. Before allowlisting anything, check whether `npm audit fix` already resolves it. The `js-cookie` entry looked unfixable because `@clerk/shared` pins it exactly, but `@clerk/nextjs` declares `@clerk/shared: ^4.12.0`, and the newer shared pins the fixed version.
- Never `npm audit fix --force`. It installs versions outside the ranges the parents declared, which is a hidden version conflict rather than a reviewed exception. The `katex` nested under `react-katex` (`^0.16.0`, fix in 0.18.2) is exactly that case and is deliberately left as a printed LOW.
- Never re-introduce `npm install` in CI; `npm ci` is what makes the lockfile binding.
- M10 exists because `next` sat on 16.2.6 through 17 advisories — three of them CRITICAL, including an unauthenticated RCE in the Image Optimization API that this app genuinely exposed through `next/image` (see C7). Nothing was watching. Dependabot and the audit gate are the fix; the version bump was only the symptom.

### CI holds no repository secret
- The `verify` job in `.github/workflows/ci.yml` is **hermetic**: it reads no `secrets.*` at all, and `tests/unit/ci-gates.test.ts` fails if one is reintroduced. It used to read `secrets.DATABASE_URL` and the two `secrets.CLERK_*`. Those secrets were never configured on the repository, so **every run from M5 to M10 died at the `Build` step** and the two proxy gates under it never executed once (C8). A gate that cannot go green is not a gate.
- Nothing in the job needs a credential. `src/db/index.ts` calls `neon()` at module scope, and `neon()` throws on an absent **or unparseable** URL — so the build needs a *syntactically valid* `DATABASE_URL`, never a reachable one. Collecting page data imports the route modules; it does not query. The runtime probe is refused by the proxy with 401 before any route, query or Clerk call runs.
- The publishable key is **derived, not written down**: `pk_test_$(printf '%s' 'example.clerk.accounts.dev$' | base64 -w0)`. A `pk_` key is public by design (it ships in the client bundle), but a literal `pk_test_<base64>` in a public repository trips gitleaks' `generic-api-key` rule on entropy alone — and allowlisting that rule is the one exception that could hide a *real* key. It must still *parse*: with an empty key `verify:proxy` answers **500**, not 401.

## Proving a file convention is live

Next resolves `proxy.ts`, `instrumentation.ts` and friends **relative to the directory holding `app`**, and it does so **silently** — a misplaced file builds cleanly, typechecks cleanly and never runs. This project is a `src/` project, so they live in `src/`.

- **Never** use `middleware-manifest.json` as evidence. On Next 16 + Turbopack both copies stay `{"middleware":{}}` whether the proxy runs or not.
- The two signals that genuinely differ: `next build` prints `ƒ Proxy (Middleware)`, and a real `next start` answers an unauthenticated `/api/*` request with **401** plus a nonce-bearing `content-security-policy`.
- `npm run verify:proxy` performs the runtime half. `tests/unit/ci-gates.test.ts` keeps CI performing both — though note that until the end of M10 neither gate had ever actually run in CI: the `Build` step failed first on every run (see *CI holds no repository secret*).



