<div align="center">
  <h1>🚀 Nawa Learn</h1>
  <p><strong>Empowering Education Through Gamification and Collaborative Learning.</strong></p>
</div>

<br />

## 📖 About Nawa Learn

Nawa Learn is an innovative, next-generation learning platform designed by the **Nawasena Development Team**. We aim to revolutionize the educational experience by combining a modern technology stack with gamified elements such as interactive avatars, comprehensive badge systems, and a competitive leaderboard. Nawa Learn creates an engaging and dynamic environment for students to share knowledge, access learning modules, and excel in their academic journey.

## ✨ Key Features

- **Gamified Learning Experience**: Engage with an extensive badge system featuring over 80 achievements across multiple categories.
- **Customizable Avatars**: Express yourself with 22+ custom SVG avatars spanning fantasy and sci-fi themes.
- **Resource Sharing**: Upload and download comprehensive learning modules and questions.
- **Competitive Leaderboards**: Track points and compete with peers to reach the top ranks.
- **Secure Moderator Panel**: Dedicated interface for content curation and platform administration.
- **Responsive & Modern UI**: Built with Next.js and Tailwind CSS, featuring rich aesthetics, dark mode, and micro-animations.

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons & Assets**: Custom SVG Components

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- Node.js 22.x (Next.js 16 requires 20.9 or later; CI runs 22)
- npm — the lockfile is `package-lock.json`, and CI installs with `npm ci`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/NAWASENA-Development-Team/nawa-learn.git
   cd nawa-learn
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   This also installs the pre-commit secret scan (it sets `core.hooksPath` to
   `.githooks/`). If it is skipped, run `npm run hooks:install` by hand.

3. Configure the environment. The app will not start without a database and Clerk
   credentials, so copy the template and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   `.env.example` documents every variable — which are required, which are
   optional, and which are injected by the hosting platform. `.env.local` is
   gitignored; never commit it. This repository is public.

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Checks

```bash
npm run lint          # eslint
npm test              # unit + integration (PGlite, no database needed)
npm run build         # production build
npm run audit:gate    # dependency advisories (HIGH/CRITICAL block)
npm run secrets:scan  # gitleaks over the full git history
npm run verify:proxy  # needs a prior build; proves the proxy is actually live
```

`npm run verify:proxy` exists because Next resolves `proxy.ts` **relative to the
directory holding `app/`** and fails silently when it is misplaced: the build
stays green while the auth gate, the CSRF guard and the CSP never run. It starts
a real server and asserts an unauthenticated `/api/*` request is refused with a
nonce-bearing CSP header.

`npm run audit:gate` is deliberately not `npm audit --audit-level=high`. That
check goes red on every push for advisories nobody here can fix, and a gate that
is always red is a gate nobody reads — which is how this project carried three
*critical* advisories for months. Instead, HIGH/CRITICAL block unless they carry
a reasoned exception, and **an exception that stops matching anything fails the
build too**, so the list cannot rot into a permanent exemption. It is currently
empty, which is the target state. Prefer `npm audit fix` (never `--force`) over
adding an entry.

## 🤝 Contributing

We welcome contributions from the community! Whether it's reporting a bug, suggesting a feature, or writing code, your help is appreciated. 

Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before getting started.

## 🔒 Security

If you discover any security-related issues, please refer to our [Security Policy](SECURITY.md) for reporting guidelines.

### Repository settings (maintainers)

Some protections cannot live in the repository, because they configure GitHub
rather than the code. They must be set once, by an organisation admin, on
`main`:

```bash
gh api -X PUT repos/NAWASENA-Development-Team/nawa-learn/branches/main/protection \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=Typecheck, lint, test, build' \
  -f 'required_status_checks[contexts][]=Secret scan (gitleaks)' \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -f 'enforce_admins=true' \
  -f 'restrictions=' \
  -f 'allow_force_pushes=false' \
  -f 'allow_deletions=false'
```

The two contexts are exactly the job names in `.github/workflows/ci.yml`; if
either is renamed, update them together or the check silently stops being
required. If the API rejects `restrictions` — branch restrictions need a plan
that supports them — drop that one field and re-run.

Also worth enabling in **Settings → Code security** (free for public
repositories):

- **Secret scanning** and **push protection** — GitHub refuses a push that
  contains a recognised credential, which catches the one case `gitleaks` cannot:
  the developer who never installed it locally.
- **Dependabot alerts** and **security updates**, so an advisory against an
  already-installed package opens a PR instead of waiting for Monday's scheduled
  run.

Without required status checks, the CI jobs added in M10 are advisory only: a red
`Secret scan` or a failing `audit:gate` can still be merged.

## 📄 License

This project is proprietary and developed by the Nawasena Development Team. All rights reserved.

---
<div align="center">
  Made with ❤️ by the Nawasena Development Team
</div>
