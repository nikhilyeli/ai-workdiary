# Configuration Reference

Complete reference for every environment variable, server option, and feature flag available in AI Work Diary.

---

## Environment variables

Set these in `apps/web/.env.local` (copy from `.env.example`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | ✅ Yes | — | Random string ≥ 32 chars. Signs all JWT access tokens. **Change this immediately.** |
| `DATA_DIR` | No | `apps/web/data` | Absolute path where `workdiary.db` is stored. Use this to move the DB to a persistent volume. |
| `PORT` | No | `3000` | HTTP port for `next start`. |
| `NEXT_PUBLIC_API_BASE_URL` | No | `""` (same origin) | Set to your backend URL when the frontend is served from a different origin (e.g. Capacitor mobile). |

### Generating a strong JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copy the output into `.env.local`:
```env
JWT_SECRET=3a8f1b...your-64-char-hex-string
```

---

## Auth & session tuning

These are constants in `apps/web/src/lib/auth.ts` — edit to change defaults.

| Constant | Default | Description |
|---|---|---|
| `ACCESS_TOKEN_TTL_SECONDS` | `900` (15 min) | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh token lifetime |
| `MAX_SESSIONS_PER_USER` | `10` | Per-account session cap |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost factor |
| `REFRESH_RACE_GRACE_MS` | `5000` | Grace window for refresh-token races |

---

## Rate limiting

Controlled in `apps/web/src/lib/rate-limit.ts`. Applied at auth endpoints.

| Endpoint | Max requests | Window |
|---|---|---|
| `POST /api/auth/login` | 10 | 15 minutes |
| `POST /api/auth/register` | 5 | 15 minutes |

To adjust, edit the `enforceRateLimit(...)` calls in the relevant route files.

> ⚠️ The in-memory limiter resets on server restart and is per Node.js process. Use a Redis-backed limiter for multi-instance deployments.

---

## Database

SQLite file at `${DATA_DIR}/workdiary.db`. Schema is auto-created on first start.

### Tables

| Table | Description |
|---|---|
| `users` | Registered accounts |
| `sessions` | Active auth sessions with refresh-token hashes |
| `activities` | Work activity entries (all sources) |
| `activity_versions` | Snapshot history for every activity change |
| `worklog_drafts` | Generated worklog drafts pending submission |

### Backup

```bash
# Simple file copy (while server is stopped or using SQLite WAL)
cp apps/web/data/workdiary.db apps/web/data/workdiary.backup.db

# Live backup using the SQLite CLI
sqlite3 apps/web/data/workdiary.db ".backup '/backup/workdiary.db'"
```

### Custom data directory

```env
DATA_DIR=/mnt/persistent/ai-workdiary
```

---

## HTTPS / TLS

Next.js dev server does not serve HTTPS by default. For production or PWA install:

- **Cloudflare Tunnel** — auto TLS, no certificate management.
- **Railway / Render / Fly.io** — auto TLS.
- **Self-hosted with nginx**:
  ```nginx
  server {
    listen 443 ssl;
    server_name app.yourdomain.com;
    ssl_certificate /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;

    location / {
      proxy_pass http://localhost:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
  ```

---

## CORS (Capacitor / cross-origin clients)

When the frontend is served from a different origin (e.g. Capacitor), you need to allow cross-origin requests. Add to `apps/web/next.config.ts`:

```ts
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "capacitor://localhost" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization,Content-Type,X-Device-Label" },
        ],
      },
    ];
  },
};
export default nextConfig;
```

Replace `capacitor://localhost` with your actual origin(s).

---

## Export settings

Export endpoints support `?format=json|csv|xlsx|docx`. Maximum rows per export: **5000** (hardcoded limit to prevent memory issues). To increase, edit `LIMIT 5000` in `apps/web/src/app/api/activities/route.ts`.

---

## Import limits

Imports accept `.csv`, `.json`, and `.xlsx` files. There is no hardcoded file-size limit beyond the Next.js body-size limit (default 4 MB). To increase:

```ts
// apps/web/next.config.ts
export default {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};
```

---

## Feature flags (not yet configurable at runtime)

| Feature | Status | Location |
|---|---|---|
| Onboarding tour | Always on (first login) | `OnboardingTour.tsx` |
| Dark mode | Auto (system preference) | Tailwind CSS `dark:` classes |
| Version history | Always on | `activity-history.ts` |
| Concurrent-edit protection | Always on | `[id]/route.ts` |
