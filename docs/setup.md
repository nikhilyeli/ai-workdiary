# Setup Guide

## Requirements

| Tool | Minimum Version |
|---|---|
| Node.js | 20.x |
| npm | 10.x |

No admin rights or system-level access required. The app runs entirely in user space.

---

## Installation

```bash
git clone https://github.com/nikhilyeli-hcl/ai-workdiary.git
cd ai-workdiary
npm install        # installs root workspace + apps/web dependencies
```

---

## Environment Configuration

```bash
cd apps/web
cp .env.example .env.local
```

Open `.env.local` in any text editor.

### Required Variables

| Variable | Description |
|---|---|
| `JWT_SECRET` | A random string of ≥ 32 characters used to sign JWTs |

Generate a secure value:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Optional Variables

| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `apps/web/data` | Absolute path where the SQLite database is stored |
| `PORT` | `3000` | HTTP port to listen on |

---

## Development

```bash
# From the repo root:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The first request automatically creates the SQLite schema in `apps/web/data/workdiary.db`.

### Browser Compatibility

The app supports modern browsers including:
- Atlas
- Comet
- Opera
- Firefox
- Chrome
- Edge
- Safari

---

## Production Build

```bash
npm run build      # from repo root
npm run start      # from repo root
```

Or from `apps/web` directly:

```bash
cd apps/web
npm run build
npm start
```

---

## Running Tests

```bash
npm run test               # run all tests once
npm run test:watch         # watch mode (from apps/web)
```

### Playwright E2E

```bash
cd apps/web
npm run playwright:install
npm run test:e2e
```

Tests run against an in-memory SQLite database — no `data/` directory or environment variables needed.

---

## File Locations

| Path | Description |
|---|---|
| `apps/web/data/workdiary.db` | SQLite database (auto-created, git-ignored) |
| `apps/web/.env.local` | Local secrets (git-ignored) |
| `apps/web/.env.example` | Template — safe to commit |

---

## Stopping the Server

Press `Ctrl+C` in the terminal where `npm run dev` or `npm start` is running.

---

## GitHub Actions and Pages

- CI workflow: `.github/workflows/ci.yml`
- Playwright E2E workflow: `.github/workflows/playwright.yml`
- Frontend docs Pages deployment: `.github/workflows/pages.yml`
- Backend deployment trigger workflow: `.github/workflows/backend-deploy.yml`

Recommended branch protection required checks:
- `CI / Lint, test, build`
- `Playwright E2E / E2E tests`
