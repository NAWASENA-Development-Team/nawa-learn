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
- Avatar picker in `src/components/profile/ProfileModals.tsx` (moved out of `ProfileClient` in M14f; the header only renders the selected avatar and the picker-open button)
- Users can select avatars from the profile page
- Selected avatar is saved to localStorage
- Each avatar has a unique gradient background color

### Moderator Panel Security
- Moderator panel is hidden from public navigation unless the signed-in user has reviewer rights.
- Access is **role-based**, not password-based: the panel opens only when `users.role` is `moderator` or `admin`. A season seat also holds `role = 'moderator'` for the length of its season — see *Dewan Podium* below for what that does and does not permit.
- `canReview` is resolved **on the server** by `getCurrentUser()` (`src/lib/currentUser.ts`), which the root layout calls once per request (React `cache`) and passes to `Navbar` as a boolean prop. There is no client-side password, no `sessionStorage` flag, and no `/api/moderator/auth-check` round trip — that route was deleted in M14d because it had no callers left.
- The panel itself is gated in `src/app/(dashboard)/moderator/page.tsx` (a server component) with `hasReviewerRole()`, which calls `notFound()` for anyone else. The UI lives in `src/components/moderator/ModeratorClient.tsx` (a thin shell that loads the four queues on mount; the tabs themselves are `SubmissionsModulesTab`, `SubmissionsQuestionsTab`, `HiddenBadgesTab`, `DailyQuizTab`) and only ever mounts for a reviewer, so there is no client-side gate to skip by not running JavaScript.
- `role` is read from `users.role` and nowhere else. Clerk `publicMetadata` is deliberately not consulted: a second copy of the role would drift from `npm run db:promote`.
- Reviewer API routes are guarded by `requireReviewer()` (human staff **and** season seats) or `requireHumanReviewer()` (human staff only) from `src/lib/authz.ts`. `requireModerator()` no longer exists — it was deleted, not aliased, and `tests/unit/authz.test.ts` scans `src/` (comments stripped) so the name cannot come back as an alias.
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
- Location: `src/lib/badges/` (a directory since M14e; `src/lib/badges.ts` is gone)
- Badge evaluation runs **on the server**: `profile/[id]/page.tsx` and `GET /api/moderator/hidden-badges` call `evaluateBadges()`. `ProfileClient` receives the answer as a `badgeDisplays` prop and evaluates nothing — and since M14f the panels (`ProfileBadges`, `ProfileStatsGrid`, the summary/moduls/questions/points-log panels and the five modals) are separate components that receive it as plain props and evaluate nothing either.
- Dynamic unlock conditions based on:
  - Points accumulated
  - Leaderboard rank
  - Number of approved modules/questions
  - Total downloads
  - Modules by subject
  - Account age in days
  - Answered questions (`quizTotal`) and answered *hard* questions (`hardQuizzes`)

### The catalogue is server-only, and the split is load-bearing
- `src/lib/badges/catalog.ts` holds the 85 definitions **including the eight hidden `unlockCondition` functions**. `src/lib/badges/evaluate.ts` runs them. `src/lib/badges/index.ts` is the barrel, and it deliberately exports **only** `display.ts` plus the types — never `catalog` or `evaluate`. `tests/unit/badges.test.ts` fails if that changes, and separately scans `src/components/**` for `@/lib/badges/(catalog|evaluate)`, `BADGE_DEFINITIONS` and `unlockCondition`.
- Before M14e the whole catalogue shipped in the browser bundle, so `unlockCondition.toString()` in DevTools revealed every "secret" requirement. Now the conditions never leave the server, and `toBadgeDisplays()` **rebuilds** each entry (it does not spread the definition) so no field can slip through.
- Hidden badges are replaced by `MYSTERY_TITLE = "???"` / `MYSTERY_ICON = "❓"` until they are unlocked **or the viewer is a moderator**. The viewer's role is the gate, not the profile owner's — the old code used the owner's role, which meant a student opening a moderator's profile saw that moderator's hidden-badge details.
- `BadgeDisplay.requirement` is written by hand in `catalog.ts` for the eight hidden badges and is only filled when **both** `includeRequirement` and `isModerator` are true. It is **not** derived from `unlockCondition.toString()`: `toString()` reads the *compiled* function, so `3000` arrives as `3e3` and production minification renames the parameter to `e`, which made the panel print `e.points>=3e3`. The trade-off is honest: a written string can go stale if a condition changes — that is a stale hint in a moderator-only panel, never a leak or a wrong count, because `unlockCondition` stays the single source of truth.

### The six specialty numbers come from SQL, not from a loaded row set
- `src/lib/specialtyStats.ts` computes `approvedMods`, `approvedQuestions`, `totalDownloads`, `quizTotal`, `hardQuizzes` and the subject spread in **three aggregate queries**, returning a `Map` pre-filled for every requested id (`emptySpecialtyStats()` is the zero value).
- Both the leaderboard page and `profile/[id]` call it. Never derive a badge number from rows already loaded for display — that is exactly how the leaderboard and the profile disagreed before M13.
- `quizTotal` counts `quiz_answer` rows and `hardQuizzes` counts those whose `ref_id` joins `questions.difficulty = 'sulit'` (`leftJoin`, so a deleted question still counts). It must **never** go back to `action LIKE 'quiz_completed%'`: no writer has ever emitted that action, so those three badges were un-unlockable from the day they were written.
- Badge copy says "soal" (questions), not "kuis": one correct answer is one `quiz_answer` row, not one quiz.

### `src/lib/participants.ts` — a tombstone is not a student
- Anonymised accounts stay as `users` rows on purpose (M11): `modules.uploader_id`, `questions.uploader_id` and `points_log.user_id` point there. But `clerk_id` becomes `deleted:<uuid>`, the name becomes "Anonim" and points become 0 — so they are **not** participants.
- `IS_PARTICIPANT` is one shared SQL expression, used by the leaderboard (board, `totalStudents`, rank) **and** the public profile page (rank, `totalStudents`). Two pages computing "total siswa" with two definitions is how they end up showing "1 dari 6" and "1 dari 7" for the same data.
- Never inline `notLike(users.clerkId, "deleted:%")` again — that is exactly the drift the module prevents. `DELETED_CLERK_PREFIX` is the one place the prefix literal lives (besides the writer in `lib/accountData.ts`).

### Badge Display
- Organized by category in profile page
- Shows progress per category (X / Y badges unlocked)
- Unlocked badges display with rarity gradient and icon
- Locked badges show how to unlock them
- Hover effects and smooth transitions

### Adding New Badges
To add new badges, edit `src/lib/badges/catalog.ts`:
1. Add the badge object to `BADGE_DEFINITIONS`
2. Define the `unlockCondition` function (server-only — it is never serialised)
3. Set category, rarity, icon, and description
4. If `hidden: true`, also write `requirement` — the human-readable condition the moderator panel shows
5. Badges automatically appear in the profile; `BADGE_TOTAL` and the category counts follow the array

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

## Pagination & query cost

### `src/lib/pagination.ts` is the only way a list is bounded
- Keyset, never `offset`. `offset` is wrong twice over: page 20 still makes the database scan the first 20 pages, and a row inserted in the middle makes the next page skip or repeat. Keyset resumes from the last position.
- `id` is always part of the key. `created_at` is **not unique** — in Postgres `now()` returns the *transaction start* time, so two rows written in sequence can share a timestamp exactly. Always `orderBy(desc(createdAt), desc(id))`.
- `readLimit(req, { defaultValue, max })` — a non-numeric or `<1` limit **falls back to the default**, it is not a 400. `?limit=abc` is a typo, and the ceiling already bounds the query cost.
- `readCursor(req)` returns `{ cursor, malformed }`. A malformed cursor is **400** + `cache-control: no-store`, never a silent restart at page 1: a client that stores cursors would otherwise loop over the first page forever and never see an error.
- `encodeCursor`/`decodeCursor` are base64url with `|` as the separator (ISO-8601 already contains `.`), capped at `MAX_CURSOR_LENGTH = 200`, and the id must match a UUID shape.
- `keysetBefore(createdAt, id, cursor)` is an explicit `OR`, not `ROW(...) < ROW(...)`, because that is the form an index on `(created_at DESC, id DESC)` can serve directly.
- `pageSlice(rows, limit)` expects `limit + 1` rows. The extra row answers "is there another page?" without a second `COUNT(*)`, and it avoids a false `nextCursor` when the row count is an exact multiple of the limit.

### Counting statements is the only honest proof of an N+1 fix
- `createTestDb({ onQuery })` in `tests/helpers/harness.ts` receives every statement the drizzle instance sends. `tests/integration/query-count.test.ts` asserts the count is **constant** as rows grow (`getSpecialtyStats` = 3, `profile/status` = 5).
- A response-body test cannot catch a regression here: 5 queries and 55 queries produce byte-identical JSON.
- **`createTestDb()` belongs in `beforeAll`, never in `beforeEach`.** It starts a whole Postgres compiled to WASM; on a 2-core machine one boot can approach the 120 s `hookTimeout`, so 21 boots (one per test) turned `season-cron.test.ts` into 506 s and one run reported `Hook timed out` — a message that reads like a regression and is not. Between tests, call `resetTestDb(db)`: it derives the table list from `schema` itself and issues one `TRUNCATE ... RESTART IDENTITY CASCADE`, so a table added later is cleared without anyone remembering to add it. The proof it is not vacuous is a test that asserts an *empty* table after earlier tests wrote to it (e.g. `expect(audits).toHaveLength(0)`).

### `src/lib/specialtyStats.ts` is shared, so the two pages cannot disagree
- The six badge numbers are computed in **three** aggregate queries and returned as a pre-filled `Map`; `emptySpecialtyStats()` is the zero value for an id with no data.
- Both the leaderboard page and `profile/[id]` call it. Never recompute a badge number from a loaded row set — that is how the leaderboard and the profile drifted apart before M13.
- `quizTotal` / `hardQuizzes` derive from `quiz_answer` rows (the only thing actually written), **not** from an `action LIKE 'quiz_completed%'` that no writer ever emitted. `hardQuizzes` uses a `leftJoin` so a deleted question still counts as one the student answered.

### Lists that are deliberately unbounded
- A single user's own modules/questions on the profile page are display data with no pagination UI, and their stats no longer depend on the rows (SQL computes them). Do not cap them "for safety" — silently hiding a student's 21st module is worse than a 25-row query. Revisit only if one user can hold thousands.
- The leaderboard is capped at 100 server-side (`LEADERBOARD_SIZE`); client-side search works on that set.

### Caching is deferred, with a trigger
- `unstable_cache` is **deprecated in Next 16** (replaced by `use cache`), and `use cache` needs `cacheComponents: true`. That flag is not set and is hostile to the nonce-CSP architecture: a nonce cannot be baked into HTML prerendered at build time, so every route is dynamic on purpose (M9).
- Do not flip `cacheComponents` to make a page cacheable. Revisit when a read route actually exceeds its p95 budget on real traffic, or when Next stabilises the replacement API.

## Security headers, CSP & CSRF

### One module owns the header set
- `src/lib/securityHeaders.ts` has **zero imports** on purpose: `next.config.ts` is loaded outside the app's module graph and `src/proxy.ts` runs on the Edge, so anything Node- or Clerk-specific in here would break one of them. It exports `CSP_DIRECTIVES` (a plain `Record<string, string[]>`), `SECURITY_HEADERS`, `HSTS_HEADER`, `CSP_REPORT_PATH` and `staticSecurityHeaders(isProduction)`.
- `next.config.ts` `headers()` sends the request-independent set to `/(.*)`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (deny-all except `camera=(self)`, which `ModuleUploadTabs` on the submit page needs for note capture), and `Cross-Origin-Opener-Policy: same-origin-allow-popups` (the popup-safe value for Clerk's OAuth — `same-origin` would sever `window.opener` and break "Masuk dengan Google").
- HSTS is only sent when `NODE_ENV === "production"`, with `includeSubDomains` and **without** `preload` (a one-way door that needs a separate, deliberate decision).

### The CSP is nonce-based and lives in `src/proxy.ts`
- `clerkMiddleware`'s `contentSecurityPolicy` option is given a **callback** `(req) => ({ … })` because `reportTo` needs an absolute URL built from the request (`x-forwarded-proto` + `x-forwarded-host`/`Host`); `Reporting-Endpoints` rejects relative values. A legacy `report-uri` directive carries the same URL.
- `strict: true` strips `http:`/`https:` from `script-src` and adds `'strict-dynamic'` + a fresh nonce per request. Clerk's helper **unions** our directives with its own defaults, so our map only ever adds: `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `img-src` extras (`data:` for legacy base64 rows, `blob:` for the camera preview, `https://*.blob.vercel-storage.com`), `frame-src 'self'` + `https:` (the module reader's iframe), and `connect-src 'self'`. Clerk keeps `'unsafe-inline'` in `script-src`, but browsers ignore it whenever a nonce is present.
- **Never hand-roll the CSP header.** Clerk's defaults carry the hosts it needs (frontend API, telemetry, `img.clerk.com`, Stripe, Google Maps, `challenges.cloudflare.com`) and they change between releases.

### A nonce forces every route to render dynamically
- `src/app/layout.tsx` reads `headers().get("x-nonce")` and passes it to `<ClerkProvider nonce={nonce}>` and `<ThemeProvider nonce={nonce}>`. Both render a `<script>`; under `'strict-dynamic'` a document script tag is only trusted if it carries the nonce, so omitting either one costs sign-in or the theme.
- Reading `headers()` in the root layout opts **every** route into dynamic rendering. That is a requirement of nonce CSP, not a regression: a nonce cannot be baked into HTML prerendered at build time. It incidentally fixes `/moderator` and `/questions/practice`, which used to be statically prerendered.
- `@vercel/analytics` is **not mounted**. `cb970a5` claims "integrate analytics in layout", but its diff only added the import — `<Analytics />` was never rendered, so the package has never collected anything. M14a removed the dead import rather than leaving a line that reads like telemetry is installed. If it is ever mounted it needs nothing special under CSP (it injects its script via `document.createElement("script")` in `useEffect`, which `'strict-dynamic'` trusts) — but it also needs a `/privacy` disclosure, because "we collect nothing" is currently true and the policy says so.

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
- `src/lib/authz.ts` exports `requireSession()` alongside `requireUser()`/`requireReviewer()`. It calls only `auth()` and fetches no user row; it returns the **Clerk id, never a database id**.
- Use it for a route that needs *a* session but has no use for the user (`api/modules/count`, `api/modules/download`). The point is that "not worth an extra query on the hot path" is no longer a reason to skip an in-handler guard.
- Every route must authorize in the handler. `src/proxy.ts` is defence in depth, **not** the only defence — it was dead code from M1 to M9 (see C6) and three routes silently lost their only gate. `api/exams/list`, `api/modules/count` and `api/modules/download` are now guarded locally.
- Never hand `requireSession()`'s Clerk id to `rateLimit` or to an ownership check. Pass the **database** user id, or `null` when the identity is unknown — the IP bucket still applies.

### One guard, one answer (M14d)
- `requireUser()` is the default for **every** route that needs the row. Seven routes hand-rolled the same `auth()` + `findFirst` pair and disagreed about the answer: five said **404** for "session but no provisioned row", while `requireUser()` says **403** — the caller *is* authenticated, the account just is not provisioned. One condition, one status code. `api/profile/status`, `api/profile/report`, `api/questions/submit`, `api/modules/submit`, `api/exams/create` and `api/questions/approved` were converted; `api/moderator/auth-check` was **deleted** (its only two callers were the Navbar and the moderator page, both now server-resolved).
- `api/questions/approved` used to tolerate an anonymous caller and answer `isOwnQuestion: false`. That branch was unreachable in production, but it meant the only thing between an anonymous visitor and the whole approved question bank was a file that was dead from M1 to M9. It now requires a session; `tests/integration/api-surface.test.ts` asserts the 401.
- Order matters: **guard → rate limit → read the body**. `api/modules/submit` parsed and validated the payload *before* checking who was calling; it now follows the same order as every other mutating route.
- A **role** rule is separate from a session rule. `api/questions/submit` and `api/modules/submit` still reject `role === "student"` with their own 403 after `requireUser()`: "signed in" is not "allowed to upload".
- `api/exams/create` no longer accepts anonymous creation (**H3**). `custom_exams.author_id` stays nullable so rows written before the change remain valid; nothing writes `NULL` any more.
- **Pages cannot use these helpers** — a page cannot return a `Response`. They use `getCurrentUser()` (`src/lib/currentUser.ts`) instead, which is React-`cache`d and shared between the root layout (Navbar's `isModerator`) and the `(dashboard)` layout (consent). A dashboard page therefore costs **one** user query, not two, and an anonymous visitor costs none. Do **not** route `requireUser()` through `cache()`: a route handler needs the 401/403 `Response`, and a cache that returns null cannot express it.
- The `Moderator` nav item is a **server prop** now. It used to be a `fetch("/api/moderator/auth-check")` on every page load: an extra HTTP round trip, an extra query, a guaranteed 401 for anonymous visitors behind the deny-by-default proxy, and a link that popped in after hydration.

## Privacy & data governance (UU PDP)

### Consent is a server-side gate, not a sign-up checkbox
- `src/lib/policy.ts` holds `POLICY_VERSION` and `hasAcceptedCurrentPolicy()`. The version lives in **code**, never as a column default: bumping it is what re-prompts every user whose stored version no longer matches.
- The gate is `src/app/(dashboard)/layout.tsx`, not the Clerk `<SignUp>` form. A layout runs before any page beneath it, so form sign-up, Google OAuth and pre-M11 rows are all caught by one check. Clerk's express-consent checkbox is a dashboard toggle that cannot be tested and fails silently; ours cannot.
- `/consent` deliberately sits **outside** the `(dashboard)` route group. Inside it, the gate would redirect the consent page to itself and the user could never accept anything.
- **`POST /api/consent/accept` is the only writer** of `users.consent_policy_version` / `users.consent_accepted_at`. It takes the version from the server constant, never from the body, and the schema is `.strict()` with `accept: true` required.
- The Clerk webhook **never** writes consent. It knows an account was created; it does not know anyone ticked anything. A `legal_accepted_at` from Clerk is logged (`clerk_legal_consent_seen`) but never stored as our consent — Clerk does not know our version.
- Pre-M11 accounts have `NULL` consent columns and are asked **once**. That is intended, not an oversight.

### `RETENTION_POLICY` is one array with two readers
- `src/lib/retention.ts` owns the windows (`reports` 12 months, `points_log` 24, `submissions` 24, `daily_activity` 24, `mail_outbox` 1). The table on `/privacy` renders from it and `runRetention()` deletes from it, so the policy a student reads cannot drift from the one the machine runs.
- `daily_activity` is a target even though it is also deleted on account deletion: the two paths answer different questions ("this account is gone" vs "this row is older than the window"), exactly like `points_log`. Its only readers are today's window and the data export, so a two-year-old attendance row answers nothing.
- `modules`, `questions` and `custom_exams` are deliberately **not** retention targets: they are library content other students read, not a record about one person. Attribution is handled by account deletion instead.
- `POST /api/cron/retention` is **POST-only** — `GET` answers 405. It is destructive, and a GET can be fired by a prefetcher, crawler or stray tab. Vercel Cron sends POST.
- An unset `CRON_SECRET` means **401 for everyone** (fail closed), logged as `cron_retention_misconfigured` rather than `cron_retention_unauthorized` because the two need different midnight actions. The token comparison is hand-rolled constant-time so no `node:crypto` is needed on that path. Schedule lives in `vercel.json`.

### Data-subject requests: export and delete
- `GET /api/profile/export?format=json|csv` and `POST /api/profile/delete` back `/profile/privacy`. Both take the identity **from the session**; there is no `userId` field anywhere, so the routes cannot be aimed at someone else.
- Route handlers are **not** under `(dashboard)/layout.tsx`, so the consent gate does not cover them — each guards itself (`requireUser()` → `rateLimit()` → then read input).
- Export lists every column **by name**. A bare `select()` would silently pick up PII columns added later.
- CSV is long form (`kategori,kolom,nilai`) with a BOM (Excel reads UTF-8) and a leading `'` on cells starting with `=`, `+`, `-`, `@`, tab or CR to defuse CSV injection. Six record types with unrelated columns cannot share one header without dropping data, and this file is evidence.
- Delete is **anonymisation, not `DELETE FROM users`**: `modules.uploader_id`, `questions.uploader_id` and `submissions.submitter_id` are `NOT NULL` and point here, so deleting the row would destroy unrelated students' work. `clerk_id` becomes a unique `deleted:<uuid>` tombstone, identity fields are blanked, consent columns are nulled, `reports` + `points_log` + `bookmarks` + `daily_activity` + `mail_outbox` are deleted, `role`/`season_role_key` are reset, and the user's exams are renamed to "Anonim". The UI requires typing `HAPUS AKUN SAYA`, and that phrase is defined **once** in `src/lib/accountConstants.ts` — a copy anywhere else is the drift the module exists to prevent (`tests/unit/ci-gates.test.ts` fails if a second literal appears in `src/`).
- Order is deliberate and **not transactional** (Neon HTTP has none): local data is anonymised first, the Clerk account is deleted last. If the last step fails the user already has no personal data with us and it is logged (`account_deletion_clerk_failed`); the reverse — Clerk gone, data still here — would be unrecoverable.
- **Two doors, one implementation.** `POST /api/profile/delete` (self-service) and the `user.deleted` branch of `webhooks/clerk` (deleted from the Clerk dashboard) both call `anonymiseAccountByClerkId()` in `src/lib/accountData.ts`. Never duplicate the anonymisation field list in a route — that is how the two doors drift and one of them quietly stops blanking a column.
- `anonymiseAccountByClerkId()` is **idempotent by construction**: after it runs, `clerk_id` is `deleted:<uuid>`, so a replayed webhook finds no row and answers `200` (`clerk_user_deleted_no_row`). A Clerk `user.deleted` for an unknown id is also `200`, not `404` — Clerk retries on non-2xx.

### Bookmarks are account-owned, and the request carries a desired state
- `bookmarks` (`user_id`, `module_id`, unique on the pair) replaced one global `localStorage` key, `nawa_bookmarks`. On a shared school PC that key had no user id in it, so the next student inherited the previous one's saved list — a correctness bug and a small privacy leak at once.
- `POST /api/bookmarks` takes `{ moduleId, bookmarked }`, **not** a toggle. A toggle is not idempotent: one click delivered twice (bad network, double tap) silently returns to the original state. The unique index plus `onConflictDoNothing()` is what makes the desired-state form safe to retry.
- A bookmark may only target an `approved` module — 404, not an FK-violation 500. That check is the only thing stopping a student from bookmarking someone else's pending submission.
- Bookmarks are personal data: they are in `collectUserData()` as `penanda` (module id + saved time only — never the module title, which belongs to another student) and in the anonymisation delete list. They are **not** a retention target, like `modules`/`questions`.
- This is a deliberate **reversal of M5**, which dropped `bookmarks` for having no writer and no reader. The reason M5 gave is exactly why the table earns its place now: it ships with a writer, a reader and an owner.

## Dewan Podium (season seats)

### The seat is a derived fact, never a stored grant
- The current season's top three hold a real moderator seat until the season ends. The seat is computed from the leaderboard, not recorded as "this user was elected": `src/lib/seat.ts` exports `SEAT_COUNT = 3`, `rankOf()`, `isInConflictZone()` and `getPodium()`, and `getPodium()` is the **single** definition of "top three". The cron, the leaderboard and the mailer all call it; none of them re-derives the ranking.
- `users.role` stays the **only** permission source. `users.season_role_key` records *why* a role was granted: `NULL` means a human granted it (`npm run db:promote`) and it is **never** auto-revoked; a season key (`"2026-Q4"`) means the cron granted it and the cron may take it back.
- `season_podium` is **archival only** — it exists so a finished season can be mailed and displayed. It is never consulted for authorization. A permission check that reads an archive table is a permission check that outlives its season.
- Season expiry works **without** the cron: `isSeatActive()` compares `season_role_key` against the current season key, so a stale key stops granting anything the moment the season turns. The cron is a reconciliation job, not the enforcement point.

### Two guards, split by capability
- `requireReviewer()` — human staff **and** season seats. Used by the four queues, `modules/approve`, `questions/approve`, `questions/reject`, `moderator/hidden-badges` and `questions/daily-create`.
- `requireHumanReviewer()` — human staff only. Used by `moderator/audit-log` (a list of everyone ever moderated is not a thing to hand three students for three months) and to decide whether hidden-badge `requirement` text is included.
- A seat **may not** upload: `modules/submit` and `questions/submit` answer `403 seat_cannot_upload` when `season_role_key !== null`. The check keys on the key being set, **not** on the seat still being active — an expired-but-not-yet-revoked seat also cannot upload, which is the safe direction.
- That guard runs **before** rate limiting and before the body is read, so a seat sending an empty body still gets 403 rather than a validation error.
- A seat **may** still answer quizzes and claim the daily +25. Losing upload rights is the trade-off of the seat; losing the ability to study would be a punishment for winning.

### Conflict of interest is explicit, not inferred
- A seat cannot review a submission from anyone in the top 10 (`CONFLICT_ZONE_RANK`), answered with `403 seat_conflict_of_interest`. Human staff are exempt: they were appointed, not elected by the same board they are judging.
- Self-review is forbidden for **everyone** on both approve routes and `questions/reject` (`403 self_review_forbidden`). A seat reviewing its own upload would be the obvious hole; a human moderator doing it is the same bug.

### The stipend is flat and idempotent
- `+10` per day while seated, awarded by the cron through `points_log` with `deterministicUuid("season-stipend:{userId}:{windowStart}")` as the reference — so a second run in the same window conflicts on the unique index and pays nothing.
- Capped at `STIPEND_MAX_DAYS_PER_SEASON = 30` credited days (300 points) per season. The cap counts `season_stipend` rows, not days elapsed.
- Authorship of the daily quiz is **deliberately not rewarded**. An earlier design paid +10 to whoever authored it first; that is a 03:00 race, it rewards speed over quality, and the author nets −15/day after paying the quiz themselves.

### Daily quiz economy
- `daily_quiz_slot` has `window_start` as its primary key, so **one curated question per day** is enforced by the database, not by a read-then-write check.
- `question_id` is `NOT NULL`, so the slot cannot be claimed before the question exists. The order is: create the question → claim the slot with `ON CONFLICT DO NOTHING` → on conflict **delete the question just created** and answer `409 daily_slot_taken`. The orphan window is milliseconds and a failed compensating delete is logged (`daily slot compensation delete failed`) rather than swallowed.
- `daily_activity` is the **proof of participation**, separate from `points_log`. Before M16 `daily-claim` inferred "already done today" from a `quiz_answer` ledger row — but that row only exists when points were actually paid, so the most diligent students were the first to lose their +25, permanently. A fact must not be inferred from its payment record.
- Because it is a record about the person and not about their work, it is **exported as `harian`** and **deleted** on account deletion (not anonymised — the same class as `points_log`, unlike `modules`/`questions`).
- `quiz/submit` writes `daily_activity` with `onConflictDoNothing()` inside a `try/catch`: a failure there never fails grading, because the points are already paid and a correct answer is still correct.
- The session is **deterministic**, not shuffled: slot first, then the `Kuis Harian` category, then easy → sedang → sulit, then newest, `id` desc. A stable order is what makes "why is this question here" answerable.
- Hybrid supply fills the day from the slot plus up to 19 unanswered approved questions, so the 03:00–07:00 WIB gap before the cron still has a session.

### The cron is a reconciler, and its order is load-bearing
- `src/lib/seasonCron.ts` `runSeasonCron(db, log, now?)` — testable without HTTP, mirroring `runRetention`. `POST /api/cron/season` is POST-only, constant-time bearer check, and **401 for everyone** when `CRON_SECRET` is unset.
- **Both cron paths must be in `PUBLIC_ROUTES`.** The scheduler has no session, so a path the proxy does not list answers a **307 to Clerk's hosted sign-in** for a request carrying a bearer token and no cookie — the job then fails every night and nothing in the response says why. `tests/unit/proxy-location.test.ts` derives every `src/app/api/cron/*/route.ts` and requires a matching matcher entry **in both directions** (a listed path with no route also fails), and `scripts/verify-proxy.mjs` probes both cron paths at runtime, demanding a non-3xx answer plus a `401` from the route's own gate. **The probe must send `POST`.** Both routes answer `405` to `GET` by design (a GET can be fired by a prefetcher or a stray tab), so a GET probe is answered by the method guard and never reaches the bearer gate — it fails while the gate is perfectly fine. That is exactly how M16's first CI run went red: the runtime probe was the only step that failed, and the code was correct. This is the C6/C8 shape for the third time: a control that exists, is documented, and never runs.
- Order: archive the podium **before** resetting points → rollover → revoke keys from *other* seasons → grant to the current top three → revoke current-season holders displaced from the top three → stipend → fill an empty slot → measure pool depth → drain the mail outbox.
- Archiving after the reset would archive a board of zeroes. That is the one ordering mistake that loses a season permanently.
- Revoking "keys from other seasons" and "current-season holders who fell out of the top three" are **two separate steps**. Merging them produces daily revoke/re-grant churn and an audit row per day per seat.
- The cron never stamps a season key onto human staff (`role` moderator/admin with `season_role_key IS NULL`) even when they rank in the top three — only two seats fill in that case.
- Rollover is idempotent without a state table: `UPDATE users SET season_points = 0, season_reset_at = now() WHERE season_reset_at IS NULL OR season_reset_at < <season start>`. The `season_points = 0` guard is mandatory; without it a second run stamps a new reset time on already-reset users.
- An empty slot is filled from the **oldest approved question never yet used as a slot** (`author_id = NULL`) — deterministic rotation, not random, so the bank is exhausted in a predictable order.
- `daily_pool_depth` is sampled from 20 recently-active users (two bounded queries), never the whole table, and warns `daily_pool_depth_low` below `DAILY_POOL_DEPTH_MIN = 20`.

### Mail is an outbox, not a call in the request
- `src/lib/mailer.ts` owns six `MailKind`s: `submission_approved`, `submission_rejected`, `badge_unlocked`, `season_result`, `seat_granted`, `seat_revoked`.
- `enqueueMail()` writes a row; `sendPendingMail()` drains it with a 10 s `AbortController` deadline and `MAX_ATTEMPTS = 5`. Delivery is **best-effort and immediate**, so a normal request sends at once while a provider outage leaves the row for the next cron.
- `dedupe_key` is unique. Approval and rejection share `sub:{submissionId}` — a submission can only be decided once, so the two kinds can never both fire for it.
- No `RESEND_API_KEY` → status `skipped`, `lastError: mail_not_configured`, and the caller still gets 200. A notification is not a reason to fail an approval.
- `users.emailNotifications` is respected at enqueue time and changed through `POST /api/profile/notifications` with a **desired-state** body `{ enabled }`, never a toggle — the same reasoning as `POST /api/bookmarks`.
- Pruning lives in `RETENTION_POLICY` (`mail_outbox`, 1 month), not in `mailer.ts`. One delete path per table.
- The outbox is **part of a student's own data**: `collectUserData()` exports it as `surel` (`kind`, `status`, `payload`, `createdAt`, `sentAt` — never `lastError`, which is the provider talking about the delivery, not about the person), and `deleteAccountData()` deletes the account's rows. Without that delete a `pending` row would still be picked up by the next cron and sent to the tombstone address `deleted+<uuid>@deleted.nawasena.site` — a guaranteed-failing provider call for an account that asked to be forgotten.

### Badge mail
- `src/lib/badgeMail.ts` `notifyUnlockedBadges()` mails only `epic`/`legendary` and **never** hidden badges — for a hidden badge the title *is* the secret.
- Dedupe key `badge:{userId}:{badgeId}`; the function never throws.
- Its queries run **sequentially**, not `Promise.all`: PGlite in tests is a single connection, and a parallel batch deadlocks the suite.

## Audit log

### One writer, scalar snapshots
- `src/lib/auditLog.ts` is the **only** module that inserts into `audit_log`. `recordAudit(db, entry, { log })` returns `boolean`; it never throws.
- `AuditSnapshot = Record<string, string | number | boolean | null>` is the point, not a limitation. A free-form `jsonb` invites `before: userRow`, and an audit table holding a copy of a `users` row is a **second PII store** that no retention job and no anonymisation path knows about. Ids, statuses, roles and numbers only.
- Audit writes are **best-effort**: a failure logs the alertable `audit_write_failed` and the audited action still stands. Neon HTTP has no transactions, so "write the audit and mutate atomically" is not available; the alternative — rolling back a moderation decision that already happened — is worse.
- `AUDIT_ACTIONS` is a closed list (`content.approve`, `content.reject`, `user.role_change`, `user.anonymise`). **Automatic point grants are deliberately not audited** — `points_log` is already their complete record, and copying it into `audit_log` creates two tables that can disagree.
- `actor_id` is nullable and means **system/CLI**, not "unknown" (`npm run db:promote` has no `users` row to point at). It is never nulled on anonymisation: the FK is `ON DELETE no action` and the row is never deleted — M11's tombstone design is what keeps the trail.
- `GET /api/moderator/audit-log` (`requireHumanReviewer` → `rateLimit("moderator/audit-log", user.id)`) exists so the table is not write-only theatre. It returns ids, actions and scalars — never names or emails — and validates `entity` against a closed enum plus UUID-shaped ids. It is **human-only** on purpose: an audit trail that a season seat can read is a list of everyone who has ever been moderated, handed to three students for three months.

## Data minimisation, enforced

### `tests/unit/pii-surface.test.ts` is a tripwire, not a regression test
- It reads source files, because the properties it guards are invisible in rendered output. `email` may appear in exactly one API route (`webhooks/clerk`, which receives it from Clerk) and never in `moderator/**`. No `db.select()` without an explicit column list anywhere in `src/`. `audit_log` is inserted only from `lib/auditLog.ts`. The `clerkId: \`deleted:` tombstone is written only in `lib/accountData.ts`.
- It caught a real leak on its first run: `app/(dashboard)/profile/[id]/page.tsx` called `db.query.users.findFirst({ where })` with **no column list**, so `email` and both UU PDP consent columns were fetched for every profile a visitor opened; it serialised `clerkId` to a client component that printed its last four characters on a public certificate; and it called `db.select().from(questions)`, pulling `answer_key` into a public page. None of that showed in the HTML — `email` was blanked before serialisation and the answer key was never rendered — which is exactly why it survived nine milestones. Gate the **source**, not the output.
- `clerkId` may be **fetched** on a page (the profile page compares it with the session to decide "is this mine") but must never be **serialised** into a client prop. Fetch what a decision needs; send what the UI renders.
- If a new tripwire assertion fails, fix the code or narrow the assertion with a written reason. Do not add a file to an allowlist to make it green — a dead exemption is an unreviewed blind spot (same rule as `.gitleaks.toml` and the audit gate).
- **Every source tripwire strips comments first**, through `withoutComments()` in `tests/helpers/source.ts` — shared by `pii-surface`, `badges` and `route-boundaries`. Without it, a comment that *explains* why a column is not selected reads as a violation of the rule about that column (this happened in M14e, in `api/moderator/hidden-badges/route.ts`), and the cheapest way to go green becomes deleting the explanation. Stripping is not a weakening: the scan still covers the code, and code that genuinely reads `email` still fails.

### Deliberate non-goals, with reasons
- **No application-level column encryption.** Neon encrypts the volume (AES-256) and every connection is TLS; the key is never on the app server. Encrypting `users.email` in the app would need a key store *and* a deterministic blind index, because that column is `ensureUser()`'s lookup key — two representations of every address, kept in sync forever. The threat it closes (a direct reader of the database contents) is not worth that for a school platform. Minimisation, deny-by-default, retention and audit are the controls that actually shrink the surface.
- **No Sentry `beforeSend`.** Sentry was never installed — no `@sentry/*` dependency, no config file, no `SENTRY_DSN`. If it is ever added, `beforeSend` must ship in the same commit, and `src/lib/logger.ts` already carries the redaction key list to reuse.

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

## Route boundaries

- The four boundary files live at the **root of `src/app` and nowhere else**: `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx`. That is a decision, not an unfinished job. `error.tsx` renders *inside* the root layout, so the Navbar and footer stay; `(dashboard)/layout.tsx` carries no chrome of its own (it is the consent gate plus `children`), so a `(dashboard)` copy would emit byte-identical markup. Per-segment copies are justified only where the shared fallback is *wrong* — which is why `profile` and `profile/[id]` keep their own skeleton, and why the root spinner is a CSS ring rather than a large skeleton card (a big card that flashes and disappears reads as an error).
- **`global-error.tsx` uses inline styles, and that is not taste.** It replaces the root layout, and the root layout is what imports `globals.css` — so every Tailwind class in that file has no definition. The prerendered error document proves it: `_global-error.html` carries **no `rel="stylesheet"` and no `class` attribute at all**. It must also render its own `<html>`/`<body>`. Its "back to home" link is a plain `<a>`, not `next/link`: when the root layout is what failed, the client router is the untrustworthy part, and a full reload re-renders from the server.
- Both error boundaries display `error.digest`. A boundary runs in the browser, outside any request that has a `requestId`, and `src/lib/logger.ts` is server-only — with no client error backend (Sentry still has no DSN, §8) the digest is the only thread linking a student's report to a server log line.
- `not-found.tsx` stays a server component: three links and a paragraph need no state, so shipping it as client JS is pure weight.
- **`profile/loading.tsx` and `profile/[id]/loading.tsx` are five-line wrappers around `src/components/profile/ProfileSkeleton.tsx`.** They used to hold 51 *identical* lines each; the risk was never tidiness, it was that a fix to one would leave the other behind and nothing would notice. The shimmer test scans all of `src/`, not just `src/app`, and asserts it found at least one reference — a scan that silently finds nothing is a green gate over no code.
- Every loading fallback carries `role="status"` and marks its decorative parts `aria-hidden`. A skeleton that is never announced is an empty page to a screen reader.
- **An unknown URL is a 307 to Clerk's sign-in for an anonymous visitor, not a 404** — the deny-by-default proxy answers first. Accepted: route structure does not leak, and a signed-in visitor still gets a real 404. The 404 page is therefore effectively a signed-in surface.
- **`users.id` is `uuid`, so a malformed segment must never reach the database.** Postgres rejects `WHERE id = 'halo'` with `22P02`; catching that together with real database errors is how a database outage comes to look exactly like a missing student. `src/lib/ids.ts` owns the single `isUuid()` definition — `decodeCursor` and `profile/[id]` both use it. A valid id with no row is `notFound()`; a genuine database failure is logged **and rethrown** so `error.tsx` owns it.
- `tests/unit/route-boundaries.test.ts` gates the **source**, not the output, because none of these properties is visible in HTML: every `page.tsx` has an `error.tsx` somewhere up its directory chain; `global-error.tsx` contains no `className` and no stylesheet import; no second file renders 404 copy (comments are stripped first, so *explaining* an old bug cannot fail the gate); and any `animate-[shimmer…]` reference has matching `@keyframes shimmer` in `globals.css` — two skeletons pointed at a keyframe that never existed and were silently static, because an animation that never runs looks identical to one that finished.
- Proving a boundary is live is the same discipline as *Proving a file convention is live*: `next build` produces `chunks/ssr/src_app_not-found_tsx_*.js`, `chunks/ssr/src_app_global-error_tsx_*.js` and `app/_global-error.{html,rsc,meta}`. The file existing on disk proves nothing.

## Site identity & the crawler-facing files

- `src/lib/site.ts` is the only place that knows the site's name, description and absolute origin. `SITE_URL` resolves `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `http://localhost:3000`. The Vercel variable is always set and always points at **production**, previews included — which is exactly right for a sitemap, since a preview must not advertise itself as indexable.
- `parseOrigin()` accepts a bare host or a full URL, refuses non-http(s) and anything with a path or credentials, and **never throws**. It is imported by the root layout, so a throw would take down every route, including the one that would explain the typo. A bad value falls back and is ignored — the same trade-off `readLimit` makes for a malformed `?limit=`.
- `robots.ts`, `sitemap.ts`, `manifest.ts` and `icon.svg` are file conventions under **`src/app`** (see *Proving a file convention is live*). `next build` lists them as `○ /robots.txt`, `○ /sitemap.xml`, `○ /manifest.webmanifest`, `○ /icon.svg`; a missing line means the file is in the wrong directory.
- **A metadata route is a public surface the deny-by-default proxy can block.** `config.matcher` excludes `.svg`, `.ico`, `.webmanifest` and friends but **not** `.txt` or `.xml`, so `/robots.txt` and `/sitemap.xml` genuinely reach the auth gate. Left out of `PUBLIC_ROUTES` they answer a **307 to Clerk's hosted sign-in**, which a crawler reads as "this whole site is a login page". Both are listed; `/manifest.webmanifest` deliberately is **not**, because `webmanifest` is in the matcher exclusion and an entry there would be configuration that does nothing. `scripts/verify-proxy.mjs` probes both at runtime and demands **200** — a static route can start working while the allowlist entry quietly goes missing, and the resulting 307 is invisible in an already-signed-in tab.
- **A URL belongs in `sitemap.ts` only if an anonymous visitor gets a 200 from it.** The current list is `/`, `/privacy`, `/terms` — the page-shaped subset of `PUBLIC_ROUTES`. `/api/health`, `/api/csp-report` and `/api/webhooks/**` are public but are not pages, and `/api/cron/retention` must not be discovered. `lastModified` is omitted on purpose: `new Date()` claims "changed just now" every time it is asked.
- `tests/unit/metadata-routes.test.ts` derives the app's top-level URL segments from `src/app/**/page.tsx` (route groups stripped) and requires each to be **published in the sitemap or disallowed in robots**. There is no third state where a new page is merely absent from both lists. Gate the source, not the output — same discipline as `pii-surface.test.ts`.
- No `title.template` in the root layout: the six pages that set their own `metadata` already end their titles with `"| NAWA-LEARN SMAN 2 Jonggol"`, so a template would render the suffix twice. No `openGraph.images` either — an OG image must be a raster, and every platform ignores SVG, so declaring the vector mark would produce a broken-image card.
- `themeColor` lives in `export const viewport`, not `metadata` (Next 16 deprecated the metadata form). The two `prefers-color-scheme` queries track the **OS** scheme because next-themes keeps the explicit choice in `localStorage`, which the server cannot read. `colorScheme` is deliberately not declared: `ThemeProvider` drives `.dark` itself, so `"light dark"` would let the UA paint light form controls inside a dark page.

## Lint, types, and gates that actually block

### `lint` is blocking, and that is the whole point
- `eslint .` is **0 errors / 0 warnings** as of M14a, down from 180 problems (51 errors / 129 warnings). `continue-on-error: true` sat on the CI lint step from M4 to M13 behind a `TODO(M14)`, which means the gate reported for nine milestones and blocked for none — the same failure shape as C6 (dead `proxy.ts`) and C8 (CI red at `Build`): a control that is present, documented, and permanently ignored.
- `tests/unit/ci-gates.test.ts` asserts the workflow contains a `run: npm run lint` step and that `continue-on-error` appears nowhere in it. Removing the flag without that assertion would let the next helpful person put it back to "unblock a PR".
- `@typescript-eslint/no-explicit-any` is an **error**, not a warning. When a `no-explicit-any` fires, the usual cause is dead code, not a missing type: every `(x as any).emoji` in the avatar picker was a leftover from an emoji-avatar era, because `AvatarOption` requires `svg`. Delete the dead arm; do not widen the type.
- `no-console` is an **error** everywhere, with written exceptions where stdout *is* the interface: `src/lib/logger.ts` (the sink itself), `src/db/seed.ts`, `src/db/promote.ts`, `scripts/**/*.mjs`, `src/components/**/*.tsx` (browser behaviour, not server logging), `src/app/**/error.tsx` + `src/app/global-error.tsx` (see *Route boundaries*), and `tests/**/*.ts` (stdout is a failing assertion's explanation). Server code uses `log.info` / `log.warn` / `log.error` from `src/lib/logger.ts` — see *Structured logging*.
- `.opencode/**` is ignored. Bundled skill scripts under it produced 94 of the 129 baseline warnings; linting a vendored tool directory drowns the warnings that concern this repository.
- Two client pages keep a scoped, written `eslint-disable`: `PrivacyClient` uses `window.location.assign("/")` rather than `router.push` on purpose (a soft navigation keeps the deleted Clerk user in memory, so the next page renders as if the session were alive), and that reason belongs in the comment above the disable, not in a chat log.

### ESLint catches correctness bugs, not just style
Every one of these was a real defect surfaced by turning the gate on, and each is worth recognising again:
- `fetch` only rejects on **network** failure. A handler that never checked `res.ok` announced "Avatar berhasil diperbarui" for a 400 or a 429, and the picker kept the rejected avatar until reload. Check `res.ok`, and revert optimistic state on failure.
- A `setState` updater must be pure. `masteredCount` was incremented inside the `setQueue` updater, and React calls updaters twice in dev StrictMode — every correct answer counted twice.
- A state value that can be derived from props is not state. `bio`/`motto` were mirrored into `useState` from props via a `useEffect`, which gave one value two sources of truth plus an extra render on every `router.refresh()`.
- `watch(name)` from react-hook-form makes React Compiler bail out of the whole component ("Use of incompatible library"). `useWatch({ control, name })` does not. If the compiler bails, the file is no longer compiled — a silent, whole-file regression.
- `react-hooks/refs` fires when a function that writes a ref is passed during render. `onSubmit={handleSubmit(onSubmit)}` writes `fileInputRef.current` transitively, so it must be `onSubmit={(event) => { void handleSubmit(onSubmit)(event); }}` — ref access in an event handler is allowed, during render it is not.
- Dead state is worse than missing state. `editName`, `isNameChanged`, `isSaving`, `restUsers`, and a never-set `totalQuestions` `useState` all read like features and were never read by anything. Delete them; a fake spinner is a lie that survives review.

## Design tokens & accessibility

### A colour class that does not exist produces no CSS, silently
- Tailwind knows eleven steps per colour: `50, 100, … 900, 950`. `zinc-550`, `zinc-850`, `indigo-650` are not in the scale, and Tailwind v4 emits **no rule at all** for them — no warning, no error. The class stays in `className` and reads like a design decision while the element simply inherits its parent's colour.
- M15's overhaul shipped **200** of these across 26 files, almost all from one bulk `+50` shift (`border-zinc-250` sitting next to `dark:border-zinc-750` is unmistakably 200/700). Nothing failed, so nothing noticed for several milestones.
- `tests/unit/design-tokens.test.ts` now scans `src/**/*.{ts,tsx,css}` and fails on any shade outside the scale. It reads the **source**, through `withoutComments()`, for the same reason as `pii-surface.test.ts`: a dead class is invisible in rendered HTML.
- Repairing one is not mechanical. Backgrounds, borders and rings round **down** — that reverses the shift. Light-mode text rounds **up** while the result stays ≤ 600, because `text-zinc-450` → `zinc-400` is 3.1:1 on white and fails AA for normal text, while `450` → `500` passes. Dark-mode text always rounds down, i.e. lighter on `#09090b`. Pick the direction from contrast, not from symmetry.
- A `dark:` variant holding the same value as its base is a no-op, not documentation. Fourteen `text-zinc-500 dark:text-zinc-500` pairs became redundant during the repair and were collapsed.

### The two user preferences live in CSS, not in components
- `globals.css` puts a `transition` on `*, *::before, *::after` and `scroll-behavior: smooth` on `html`, so honouring reduced motion is a **base-layer** job: one `@media (prefers-reduced-motion: reduce)` overrides both. Durations become `0.01ms`, **not** `none` — `transitionend`/`animationend` still fire, so code waiting on them does not hang.
- `::view-transition-*` pseudo-elements are not matched by `*`, so the theme ripple needs its own `animation: none` inside that media query. A reduced-motion block covering only `*` leaves the largest animation in the app running.
- Focus is the same shape: `@layer base { :focus-visible { outline: 2px solid #4f46e5 } }`. It sits in `base` on purpose so Tailwind utilities still win — an input with `focus:ring-2` must not get a second ring. The colour is `DESIGN.md`'s own focus-ring token, so this implements the written spec rather than inventing a look.
- Do not "fix" accessibility by sprinkling `focus-visible:` classes across 40 components. One base rule covers every control that had no indicator, and it changes nothing for mouse users.
- Proving either one is live means checking the **emitted** CSS (`.next/static/chunks/*.css`), not `globals.css`. A stylesheet that is never imported looks identical in a diff.
- `@theme` holds the 17 colours; the 397 arbitrary-value classes (`text-[10px]`, `scale-[0.98]`, …) are still raw. That is the remaining half of the token story: type and spacing are not tokenised, colours are. See the next section.

### `DESIGN.md` is the source of truth, and a test enforces it
- `globals.css` now has an `@theme` block defining all 17 palette colours as `--color-nawa-*`. It is not documentation: `tests/unit/design-tokens.test.ts` **parses the `colors:` frontmatter out of `DESIGN.md`** and fails if any value differs from `@theme`. Change the palette in one place and the other must follow, or the build fails.
- Only the seven **brand** colours were migrated to token utilities (`indigo-600` → `bg-nawa-primary`, etc.), **462 occurrences across 48 files**, all with byte-identical hex — so the render did not change. Migrating them is what stops `DESIGN.md` from describing a palette the components ignore.
- The **neutrals stay raw** (`zinc-200`, `zinc-800`, …) and that is a decision. `zinc-800` is a border, a button background *and* text in different places; `bg-zinc-800` → `bg-nawa-border-dark` would be wrong in two of the three. A semantically wrong bulk rename is worse than no token. They are declared in `@theme` only for parity with the doc.
- Use the token when the meaning is "the brand colour". Use a raw shade when the meaning is "this particular grey for this particular surface". If you cannot say which, it is the second one.
- The test also fails if no component uses the brand tokens — a token block with no readers is the M5 shape (a table with a writer and no reader).
- `accent-*`, `border-t-*` / `border-l-*` and plain hex in inline SVG styles all bypass a class-name sweep. Check them by hand after a migration; the first sweep missed eight of them. `NawaIcon` now reads `var(--color-nawa-primary)`, so the logo follows the palette.
- **Tailwind v4's automatic content detection scans markdown, so a class name written in a doc ships CSS.** `globals.css` therefore disables it — `@import "tailwindcss" source(none)` plus an explicit `@source "../../src/**/*.{ts,tsx}"`. Before that, `from-indigo-600 to-violet-600` in a prose line of `DESIGN.md`, and the old class names quoted in a roadmap migration note, emitted `.from-indigo-600`, `.to-violet-600`, `.border-t-indigo-600` and `.accent-indigo-600` although no component used them. Harmless bytes, but they made "is the rename finished?" unanswerable by grepping the build output, and they turned every doc into a hidden content source.
  - Keep the pairing: `source(none)` without a `@source` ships **zero** utility CSS — a page with no styling, far worse than phantom rules. `tests/unit/design-tokens.test.ts` asserts both halves and that no `@source` points at `*.md`.
  - Corollary for every sweep: verify against the **emitted** CSS, not the script's own count. A bulk rename reported "done" while nine occurrences stayed behind, and the build output was the only thing that said so.

### Accessibility is a gated property now, not a claim
- **Every form control has a name, and a test refuses to let that regress.** `tests/unit/a11y.test.ts` reads the source (comments stripped via `withoutComments()`) and fails if an `<input>`/`<textarea>`/`<select>` has neither `aria-label` nor an `id` that some `<label htmlFor>` in the same file actually points at. **An `id` alone does not count** — the first version of the test accepted it and stayed green over a control whose label had just been removed. `id` is only a name when something references it.
- Group headings that look like labels but govern a set of buttons (grade picker, category picker, A–E options) must be `<fieldset>` + `<legend>`, not `htmlFor` pointing at nothing.
- **Icon-only buttons must have a name.** Same file, same scan: a `<button>` whose children contain no text needs `aria-label`/`aria-labelledby` (`title` and an inner `alt` also count, but `aria-label` is the clearer choice). Twelve buttons were silent before M15d.
- `placeholder` is **not** a label. It disappears the moment someone types, which is exactly when the field matters.
- **`tests/a11y/axe.test.tsx` runs axe-core inside `npm run test`.** Components are rendered with `renderToStaticMarkup`, mounted into the jsdom document the test already owns, and audited against `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`.
  - Render into the **global** `document`, never into a fresh `new JSDOM(...)`: axe validates its context against the global `Node` class, so a separate jsdom instance answers `axe.run arguments are invalid` instead of auditing anything.
  - That file carries `// @vitest-environment jsdom`; the suite default stays `node` so PGlite is not dragged through a fake DOM. `vitest.config.mts` includes `tests/**/*.test.tsx` for this one reason.
  - **Why jsdom and not Playwright:** every real defect sits behind the auth gate (`/submit`, `/practice`, `/profile`, `/moderator`), while `PUBLIC_ROUTES` exposes five pages and the CI job is hermetic by design (`ci-gates.test.ts` fails if `secrets.*` returns). A browser job would audit the marketing pages and report green over forms it never loaded — C6/C8 for a third time. No secrets, no server, no browser download.
  - The harness has **permanent self-tests** proving it is not vacuously green: `<div aria-label>` without a role must yield `aria-prohibited-attr`, and `<input type="text">` with no name must yield `label`. If someone breaks `audit()`, those fail before any component test does.
  - **`axe._running` is a module-level flag, and a timeout does not clear it.** One audit that exceeds its timeout leaves the flag set, so every later `axe.run` throws `Axe is already running` — one slow audit reads as five accessibility failures that do not exist (this happened on a full M16 run). The file therefore sets a 120 s timeout for its own blocks and clears the flag in `beforeEach`; tests inside one file are sequential, so an abandoned audit from the previous test is already orphaned. Do not lower that timeout back to the global 30 s: a large form in jsdom was measured at 36 s on a loaded 2-core machine.
- **`color-contrast` is disabled on purpose, with the reason in the file.** jsdom computes no layout, so axe reports every text node as *incomplete*. Contrast, touch-target size and responsive layout still need a browser; screen-reader behaviour (NVDA/JAWS/VoiceOver) still needs a human. None of those is claimed as covered — **M18** in `docs/AUDIT-AND-ROADMAP.md` owns them, and it is a separate milestone precisely so "M15 selesai" can be true.
- `<div onClick>` is **not** caught by any gate here. The Google Drive file rows in `DrivePickerModal` are still unreachable by keyboard; that is recorded as debt, not as done.

## Interface strings

### One catalogue, typed paths, no dependency
- UI copy lives in `src/i18n/messages.ts` and is read through `t("nav.modules")` from `src/i18n/t.ts`. The path is type-checked: a typo fails `tsc`, not rendering.
- There is **no i18n library**. `next-intl` for a single locale is a dependency tree with no reader, and this repo counts advisories. When a second locale actually exists, the change is swapping the static object for a per-locale resolver — callers do not move.
- There is **no string interpolation**, on purpose. `t()` returns a string, so it cannot produce a `<Link>`. A sentence that needs a clickable element in the middle (the UU PDP consent paragraph) is split into several keys and composed in JSX. `dangerouslySetInnerHTML` is not an acceptable price for one sentence.
- `tests/unit/i18n.test.ts` asserts **every catalogue key is called somewhere**. A key with no reader is dead copy that will silently diverge from the inline string that replaced it — the same failure M5 closed for `bookmarks`. The regex must allow CamelCase (`[a-zA-Z]`); the first version used `[a-z]` and reported every `auth.signUp.*` key as an orphan.
- Migration is **incremental and explicitly unfinished**: Navbar, `sign-in` and `sign-up` are done (50 of ~872 strings). The remainder is listed in `docs/AUDIT-AND-ROADMAP.md` under **M18** (moved there when M15 closed). Half a catalogue that nobody calls would be two sources of truth; JSX that is still literal is visible debt.
- Brand and organisation names (`NAWA-LEARN`, `OSIS NAWASENA SMAN 2 Jonggol`) stay inline. They are proper nouns, not copy.
- **The whole catalogue ships to the browser.** `Navbar` is a client component and calls `t()`, and `t()` resolves paths dynamically, so every message must be present client-side. At 50 strings that is nothing. At 872 it would be tens of kilobytes on every page for copy that mostly renders on the server — before finishing the migration, split the catalogue per surface (or resolve server strings at build time) rather than shipping one object to both sides.
