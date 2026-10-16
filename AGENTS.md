<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
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
- Authentication itself (deny-by-default for every route) is enforced in `proxy.ts`.

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
- `GET /api/health` is deliberately public (see `PUBLIC_ROUTES` in `proxy.ts`) so an uptime monitor can reach it without a session. It returns only coarse status — `{ status, checks: { database, auth }, timestamp }` — with `200` healthy / `503` degraded, and `cache-control: no-store`.
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
- `src/lib/storage.ts` — Vercel Blob driver over raw `fetch` (no `@vercel/blob` dependency), plus the magic-byte sniffer and `isOwnStorageUrl()`. It reads `BLOB_READ_WRITE_TOKEN` (and optional `VERCEL_BLOB_API_URL`).
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

