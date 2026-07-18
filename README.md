# AI Work Diary

> **Orchestrator, reviewer, and worklog summarizer** for Jira, Bitbucket, browser history, and system activities.

AI Work Diary is a **review-first, not auto-sync** tool. It collects or accepts work activities from multiple sources, lets you verify and annotate them in a dashboard, then helps you generate reviewed worklog drafts for manual submission to **Atlassian Worklog Pro**.

---

## Features

| Feature | Description |
|---|---|
| **Multi-device login** | Sign in from any number of devices with one account; manage or revoke sessions from the Sessions tab |
| **Activity review** | Browse, filter, edit, approve, or skip activity entries by time and source |
| **Export** | Export activities/worklog drafts as JSON or CSV from the dashboard |
| **Version history** | Activity edits use optimistic concurrency and keep a state-history trail |
| **Manual entries** | Add any activity manually with a ticket number and description |
| **Worklog draft generation** | Approved activities → worklog drafts with ticket number and description |
| **Onboarding tour** | Intro.js guided tour for first-time users |
| **Security-first** | JWT access tokens (15 min TTL) + refresh tokens (30 day, rotated), bcrypt passwords, session cap, timing-safe auth |

---

## Architecture

```
apps/
└── web/          # Next.js full-stack app (API routes + React dashboard)
    ├── src/
    │   ├── app/
    │   │   ├── api/          # REST API (auth, activities, worklogs, sessions)
    │   │   ├── dashboard/    # Dashboard UI
    │   │   ├── login/
    │   │   └── register/
    │   ├── components/dashboard/
    │   ├── lib/              # db.ts, auth.ts, api-helpers.ts, auth-client.ts
    │   └── types/
    ├── __tests__/            # Vitest unit tests
    └── data/                 # SQLite database (auto-created, git-ignored)
docs/
├── setup.md
├── user-guide.md
└── security-notes.md
```

**Stack:** Next.js 16 (TypeScript) · SQLite (better-sqlite3) · Tailwind CSS · JWT (jose) · bcryptjs · Intro.js · Vitest

---

## Quick Start

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### 1. Clone and install

```bash
git clone https://github.com/nikhilyeli-hcl/ai-workdiary.git
cd ai-workdiary
npm install
```

### 2. Configure environment

```bash
cd apps/web
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Generate a strong secret:
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=your_long_random_secret_here
```

### 3. Run in development

```bash
cd ai-workdiary          # repo root
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Register your account

Visit `/register`, create your account, then follow the onboarding tour.

---

## Usage Workflow

```
1. Collect activities  →  Add manually or (future) import from Jira/Bitbucket
2. Review in dashboard →  Set ticket numbers, write worklog notes, approve
3. Generate drafts     →  Click "→ Worklog" on approved activities
4. Submit manually     →  Open Atlassian Worklog Pro, copy the draft details
5. Confirm in app      →  Click "Mark logged" to track what's been submitted
```

> **AI Work Diary never auto-submits worklogs.** Every submission is explicitly confirmed by you.

---

## Running Tests

```bash
cd apps/web
npm test
```

## Running Playwright E2E

```bash
cd apps/web
npm run playwright:install
npm run test:e2e
```

---

## Security Notes

See [`docs/security-notes.md`](docs/security-notes.md) for enterprise considerations.

Key points:
- No admin rights required
- No background processes or privileged OS access
- SQLite database stored in `apps/web/data/` — **never commit this directory**
- Browser `localStorage` stores auth/session client tokens only (access token, refresh token, session id, device label), not activity/worklog tables
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens short-lived (15 min); refresh tokens rotated on each use
- Token reuse detection: refresh token replay invalidates the session immediately
- Up to 10 concurrent sessions per account (oldest evicted when cap reached)
- Revoking a session immediately blocks API access because auth now verifies both JWT and session row status
- Auth endpoints include basic per-IP rate limiting for login/registration

---

## Docs

| Document | Description |
|---|---|
| [Setup Guide](docs/setup.md) | Detailed installation and configuration |
| [User Guide](docs/user-guide.md) | Step-by-step end-user guide |
| [Security Notes](docs/security-notes.md) | Enterprise security and compliance guide |

---

## GitHub Automation

- **CI** workflow runs lint, tests, and build on push/PR to `main`.
- **Playwright E2E** workflow runs browser tests on push/PR to `main`.
- **Deploy Frontend Docs to Pages** publishes the `docs/` folder to GitHub Pages.
  - GitHub Pages hosts docs/static content only.
  - The full Next.js app is not suitable for Pages because API routes + SQLite require a server runtime.
- **Deploy Backend with GitHub Actions** verifies tests/build, then triggers a deploy hook.
  - Configure repository secret `BACKEND_DEPLOY_HOOK_URL` with your backend host deploy webhook URL.
  - Optional: set `BACKEND_DEPLOY_HOOK_TOKEN` if your endpoint expects a bearer token.
