# Complete Setup Guide

Step-by-step installation for AI Work Diary on Windows, macOS, and Linux.

---

## System requirements

| Tool | Minimum version | Check |
|---|---|---|
| Node.js | 20.x | `node --version` |
| npm | 10.x | `npm --version` |
| Git | any | `git --version` |
| Disk space | 300 MB | — |

No admin rights, background services, or system-level access required.

---

## 1. Clone the repository

```bash
git clone https://github.com/nikhilyeli-hcl/ai-workdiary.git
cd ai-workdiary
```

---

## 2. Install dependencies

```bash
npm install
```

This installs the monorepo root + `apps/web` dependencies.

---

## 3. Configure environment

```bash
cd apps/web
cp .env.example .env.local
```

Open `.env.local` and set a strong `JWT_SECRET`:

```env
# Generate with:
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=your_64_char_hex_secret_here
```

See the [Configuration Guide](./configuration.md) for all options.

---

## 4. Start the development server

```bash
# From the repo root:
cd ../..
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 5. Register your account

1. Click **Create one** on the login page (or go to `/register`).
2. Enter your name, email, and a password (minimum 10 characters).
3. You are signed in and the onboarding tour starts.

---

## Running tests

```bash
# Unit tests (Vitest)
npm run test

# Watch mode
npm run test:watch

# Lint
npm run lint

# Build check
npm run build
```

### Playwright E2E tests

```bash
cd apps/web
npm run playwright:install   # one-time browser install
npm run test:e2e
```

---

## Production deployment (local)

```bash
# Build
npm run build

# Start production server
npm run start
```

---

## Deployment options

See the [Free Deployment Guide](./free-deployment.md) for hosting options including:
- VS Code Dev Tunnels
- Cloudflare Tunnel (always-on, free)
- ngrok
- localtunnel
- Railway, Render, Fly.io

---

## Installing as a desktop/mobile app

See the [PWA Install Guide](./pwa-install.md) for browser-based window and mobile app installation.

For native desktop: [Electron Guide](./electron.md).  
For native mobile: [Capacitor Guide](./capacitor.md).

---

## Updating

```bash
git pull origin main
npm install      # pick up any new dependencies
npm run build    # rebuild
```

---

## Uninstalling

1. Stop the server (`Ctrl+C`).
2. Delete the repository folder.
3. The SQLite database is in `apps/web/data/` — delete that folder to wipe all data.

---

## Troubleshooting

### `JWT_SECRET must be set and at least 32 characters`
Your `.env.local` is missing or the value is too short. Generate a new value:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Port 3000 already in use
```bash
# Change the port (in .env.local):
PORT=3001
# Then start:
npm run dev
```

### `better-sqlite3` binary error
Rebuild native modules:
```bash
cd apps/web
npm rebuild better-sqlite3
```

### Database locked
Stop all running instances of the app — SQLite allows only one writer at a time.
