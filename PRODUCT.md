# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary Users**: High school students of SMAN 2 Jonggol (grades 10–12) navigating daily curriculum coursework, preparing for semester exams (PTS, PAS/PAT), and training for the national university entrance examination (UTBK/SNBT) and academic Olympiads.
- **Student Contributors**: Students who take notes, summarize textbooks, and draft practice questions to help their peers while building their personal profile and reputation.
- **Reviewers & Moderators**: Academic leaders from OSIS NAWASENA and designated student/teacher moderators who review, approve, and curate student submissions for quality and accuracy.
- **Administrators**: Platform operators managing platform health, user roles, security, and institutional compliance.

## Product Purpose

Nawa Learn empowers students of SMAN 2 Jonggol through collaborative, gamified learning. It replaces fragmented chat-group note sharing with a centralized, quality-controlled repository of peer-authored learning modules and interactive question drills.

Success is measured by:
- Active peer knowledge exchange (high upload, review, and download rates of study modules).
- Consistent voluntary daily quiz drills and exam simulation practice.
- Improved academic confidence and UTBK readiness across the student body.
- Ironclad student data privacy and academic integrity.

## Positioning

Unlike commercial, one-way edtech platforms (e.g., Ruangguru, Zenius, or Google Classroom), Nawa Learn is a school-grounded, student-led collaborative hub built specifically for the community of SMAN 2 Jonggol by OSIS NAWASENA. It uniquely pairs verified peer-generated academic resources with competitive gamification (80+ achievements, 22+ custom avatars, tiered leaderboard milestones) and rigorous institutional data privacy (UU PDP).

## Operating Context

- **Academic Cycles**: Peak usage during examination weeks (PTS, PAS/PAT), ongoing daily study reinforcement, and high-intensity UTBK/SNBT preparation season.
- **Devices & Environments**: Mobile smartphones on cellular connections (on-the-go study, quick daily quizzes) and desktop/laptop browsers (reading lengthy PDF study guides, taking timed exam simulations).
- **Core Workflows**:
  - Finding and reading curriculum-aligned study modules.
  - Taking daily quizzes and timed multi-subject practice exams with instant scoring and LaTeX-rendered mathematical formulas.
  - Uploading scanned/digital notes or writing practice questions for moderator approval (+50 points per approved submission).
  - Tracking points, climbing the school-wide leaderboard, unlocking tiered badges, and customizing profile avatars.
  - Reviewing submitted content in the moderator queue.

## Capabilities and Constraints

- **Capabilities**:
  - **Module Library**: Search, filter, read, and download peer-created study materials (PDF, WebP, PNG, JPEG) across school subjects and exam categories (e.g., UTBK, Olimpiade).
  - **Practice & Exam Engine**: Categorized question practice with difficulty tagging (`mudah`, `sedang`, `sulit`), LaTeX mathematical equation support (KaTeX), timed custom exams, server-side grading, and immediate explanations.
  - **Gamification System**: 80+ achievements across 5 categories (Contribution, Learning, Milestone, Social, Special) and 5 rarity levels (Common to Legendary); 22+ custom SVG sci-fi and fantasy avatars; points ledger and top 100 leaderboard.
  - **Moderator Panel**: Multi-queue review dashboard (`modules`, `questions`, `hidden-badges`, `daily-quiz`) with role-based access control (`moderator`, `admin`).
  - **Privacy & Compliance (UU PDP)**: Version-controlled explicit consent gating, self-service data export (JSON/CSV), account deletion with anonymized tombstones (`deleted:<uuid>`), structured audit logging, and automated retention cleanup.
- **Constraints**:
  - **Technical Architecture**: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, Clerk authentication, Neon PostgreSQL with Drizzle ORM, Vercel Blob for object storage, Upstash Redis for rate limiting.
  - **Security & Integrity**: Nonce-based strict CSP with violation reporting, CSRF defense on mutating routes, deny-by-default routing proxy, magic-byte upload validation, and server-side scoring (no answer key or scoring logic exposed to clients).
  - **Data Retention & Integrity**: Tombstoned accounts preserve referential integrity for content authorship without leaking PII or contaminating active leaderboard rankings.

## Brand Commitments

- **Brand Name**: NAWA-LEARN
- **Organisation**: OSIS NAWASENA — SMAN 2 Jonggol
- **Tagline**: "Empowering Education Through Gamification and Collaborative Learning."
- **Voice & Tone**: Inspiring, supportive, youthful, intellectually ambitious, and community-centric.
- **Visual Assets**: Custom SVG logo mark (`NawaIcon`), 22+ custom theme SVG avatars (`public/avatars/*.svg`), and distinct badge rarity iconography.

## Evidence on Hand

- Verified production schema and database migrations (`src/db/schema.ts`).
- Comprehensive technical audit and architecture roadmap (`docs/AUDIT-AND-ROADMAP.md`).
- Fully implemented avatar library (`public/avatars/`) and server-side badge evaluation system (`src/lib/badges/`).
- 699 automated unit, integration, and security tests across 52 test suites.
- Non-goals: Commercial monetization, ads, unauthenticated public exposure of student test responses.

## Product Principles

1. **Peer-First Knowledge Exchange**: Peer-shared notes and practice questions form the heartbeat of the platform; authoring and curating quality content must feel rewarding, visible, and celebrated.
2. **Ironclad Academic & Data Integrity**: Points, scores, and rankings must be unforgeable and validated on the server. Student privacy and data protection are non-negotiable foundations.
3. **Purposeful Gamification**: Avatars, badges, and levels are not superficial decorations—they are earned symbols of academic diligence, consistency, and generous peer contribution.
4. **Focused, Fast, and Accessible**: Clear visual hierarchy, rapid mobile load times, distraction-free reading modes, and accessible mathematical notation ensure students can learn anytime, anywhere.

## Accessibility & Inclusion

- Responsive layout optimized for mobile viewports, tablets, and desktop workstations.
- Theme support with high-contrast light and dark modes.
- Keyboard-navigable practice quizzes and clear form validation.
- Accessible mathematical formula rendering via KaTeX.
