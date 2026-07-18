# Security Notes and Enterprise Guidance

## Design Principles

AI Work Diary is designed to run safely on enterprise machines where the user **does not have admin rights**:

- Runs entirely as a Node.js user-space process
- No elevated OS privileges needed
- No system-wide daemons or background services
- SQLite database stored in the app's own `data/` directory — no system database required
- All secrets stored in a `.env.local` file that the user controls

---

## Authentication

| Mechanism | Detail |
|---|---|
| Password storage | bcrypt with 12 rounds |
| Access tokens | JWT, HS256, 15-minute TTL |
| Refresh tokens | 48-byte random, SHA-256 hashed before storage |
| Token rotation | New refresh token issued on every use |
| Token reuse detection | Replay of an old refresh token immediately revokes the session |
| Session cap | Max 10 active sessions per account; oldest evicted when cap is reached |
| Login/register abuse controls | Basic per-IP in-memory rate limits on auth endpoints |
| Timing-safe login | bcrypt always runs even for unknown emails (prevents user enumeration) |
| Generic error message | Login failure returns "Invalid email or password" — no specifics |

---

## Data Storage

- **All data is local**: the SQLite database lives in `apps/web/data/workdiary.db` on the machine running the server.
- The `data/` directory is excluded from git via `.gitignore`.
- No data is sent to any external service by this application.
- Backups are the user's responsibility.
- Browser `localStorage` is used only for client auth/session tokens (`wd_access_token`, `wd_refresh_token`, `wd_session_id`, `wd_device_label`).
- Because tokens are in `localStorage`, XSS in the same origin would increase token exposure risk; keep dependencies patched and avoid unsafe HTML/script injection.
- Activity changes store version snapshots in `activity_versions` for state-history/audit context.

---

## Network / Browser Activity Collection

> ⚠️ **Important enterprise notice**

If future features collect browser history or system activity:

- Collection must be **explicit, user-triggered, and local-only**.
- No silent background monitoring.
- Data must not be transmitted to any external server.
- Enterprise IT policies may restrict access to browser profiles or system event logs — respect those restrictions.
- If corporate monitoring software is present, any local data collection by this app remains visible to that software.

**Red flag checklist before enabling any data-collection feature:**

- [ ] Does your organisation's AUP allow reading browser history programmatically?
- [ ] Does your organisation's AUP allow reading system activity logs?
- [ ] Is the collected data stored only locally (no cloud sync)?
- [ ] Is the user informed and has explicitly consented?
- [ ] Is the collected data deleted when the user requests it?

If any checkbox is unclear, consult your IT / Security team before enabling that feature.

---

## Atlassian Worklog Pro Integration

AI Work Diary does **not** auto-submit to Atlassian Worklog Pro. It generates **draft payloads only**.

The user must:
1. Open Atlassian Worklog Pro manually.
2. Enter the worklog details from the draft.
3. Return to AI Work Diary and confirm submission.

This design ensures:
- No Atlassian credentials are ever stored in AI Work Diary.
- No API keys are required or requested.
- Every submission is explicitly confirmed by the user.

---

## Secret Management

- `JWT_SECRET` must be ≥ 32 random characters.
- Store it in `apps/web/.env.local`, never commit it.
- Rotate it if you suspect it has been exposed (all sessions will be invalidated).
- Never hard-code secrets in source code or Docker images.

---

## Deployment Considerations

| Scenario | Recommendation |
|---|---|
| Local development | `npm run dev` with `.env.local` |
| Single-user local server | `npm run build && npm start` |
| Shared team server | Run behind a reverse proxy (nginx/caddy) with HTTPS. Use an environment variable manager instead of `.env.local`. |
| Cloud / container | Persist `DATA_DIR` to a volume. Inject `JWT_SECRET` via a secrets manager. |

**HTTPS is strongly recommended for any deployment where the network is not fully trusted.**

---

## Known Limitations / Open Items

- Login/register rate limiting is in-memory and per app instance; use reverse-proxy or distributed rate limiting for multi-instance production setups.
- No email verification on registration (suitable for personal/team use; add if multi-tenant).
- No CSRF protection on API routes (mitigated by Bearer token auth — no cookies used).
- Activity data is not encrypted at rest (SQLite plaintext). Use OS-level disk encryption if required.
- Overlapping refresh attempts from multiple devices/tabs can still race; in-tab refresh is coalesced and server validation adds a short grace window before replay-triggered revocation.
