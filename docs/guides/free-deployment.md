# Free Deployment & Dev Tunnel Options

AI Work Diary requires a live Node.js server (Next.js API routes + SQLite). This guide covers every free option for exposing your local server to the internet, plus permanent free hosting options.

---

## Architecture recap

```
Your machine
└── npm run dev (port 3000)
       ├── Serves the React dashboard at /
       ├── Handles API routes at /api/*
       └── Reads/writes SQLite at apps/web/data/workdiary.db

Tunnel / hosting
└── Public HTTPS URL → forwards to localhost:3000
```

The **GitHub Pages site** (`https://nikhilyeli-hcl.github.io/ai-workdiary/`) hosts **docs only**. The full Next.js app always needs a server.

---

## Option 1 — VS Code Dev Tunnels (recommended for development)

**Free. No account required for basic tunnels. Persistent URLs available with a Microsoft account.**

### Quick start (GUI)
1. Open VS Code.
2. In the bottom status bar click **Ports** (or `Ctrl+Shift+P → Forward a Port`).
3. Enter port **3000** and press Enter.
4. Right-click the forwarded port → **Port Visibility → Public**.
5. Copy the URL shown — it looks like `https://abc123-3000.uks1.devtunnels.ms`.

### Quick start (CLI)
```bash
# Install the CLI once
winget install Microsoft.devtunnel          # Windows
brew install --cask devtunnel               # macOS
curl -sL https://aka.ms/DevTunnelCliInstall | bash  # Linux

# Log in (optional — needed for persistent URLs)
devtunnel user login

# Start a tunnel to port 3000
devtunnel host -p 3000 --allow-anonymous
```

### Persistent named tunnel
```bash
devtunnel create ai-workdiary
devtunnel port create ai-workdiary -p 3000
devtunnel host ai-workdiary
```

---

## Option 2 — Cloudflare Tunnel (recommended for always-on)

**Free forever. Named, stable URLs. No time-limit.**

### One-liner (temporary)
```bash
npx cloudflared tunnel --url http://localhost:3000
```
Prints a URL like `https://random-words.trycloudflare.com` — no account required.

### Permanent setup (needs a free Cloudflare account + domain)

1. **Sign up** at [cloudflare.com](https://cloudflare.com) (free).
2. Add your domain to Cloudflare (or use a free `.pages.dev` subdomain).
3. Install `cloudflared`:
   ```bash
   # macOS
   brew install cloudflared
   # Windows (scoop)
   scoop install cloudflared
   # Linux
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
   chmod +x /usr/local/bin/cloudflared
   ```
4. Authenticate:
   ```bash
   cloudflared login
   ```
5. Create and configure the tunnel:
   ```bash
   cloudflared tunnel create ai-workdiary
   cloudflared tunnel route dns ai-workdiary app.yourdomain.com
   ```
6. Create `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: ai-workdiary
   credentials-file: ~/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: app.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```
7. Run the tunnel:
   ```bash
   cloudflared tunnel run ai-workdiary
   ```
8. (Optional) run as system service:
   ```bash
   cloudflared service install
   ```

---

## Option 3 — ngrok

**Free tier: random URL per session. Paid tier: static domain.**

```bash
# Install
npm install -g ngrok       # or: https://ngrok.com/download

# Authenticate (one-time)
ngrok config add-authtoken <your-token-from-ngrok.com>

# Start tunnel
ngrok http 3000
```

Output includes:
```
Forwarding  https://xxxx.ngrok-free.app → http://localhost:3000
```

### Static domain (free with ngrok account)
1. Sign up at [ngrok.com](https://ngrok.com) → Domains → Claim a free static domain.
2. Use: `ngrok http --domain=your-domain.ngrok-free.app 3000`

---

## Option 4 — localtunnel (zero-account, disposable)

**Free. No account. No install. Works everywhere.**

```bash
# One-liner, no global install
npx localtunnel --port 3000

# Request a specific subdomain (availability not guaranteed)
npx localtunnel --port 3000 --subdomain ai-workdiary
```

Prints: `your url is: https://ai-workdiary.loca.lt`

> ⚠️ localtunnel URLs may require a password step in the browser (click "Continue"). This is a bot-protection measure.

---

## Option 5 — Railway (free hobby tier — runs the server permanently)

**Free $5/month credit. Full Node.js server. No tunnels needed.**

1. Push your repo to GitHub.
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub.
3. Select your repo and set:
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Add environment variable `JWT_SECRET` with a strong random value.
5. Railway provides a public HTTPS URL automatically.

---

## Option 6 — Render (free tier, spins down after inactivity)

1. Go to [render.com](https://render.com) → New Web Service.
2. Connect your GitHub repo.
3. Set:
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment variable**: `JWT_SECRET=<strong-secret>`
4. Choose **Free** instance (note: cold start after 15 min idle).

---

## Option 7 — Fly.io (free allowance, permanent)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# In apps/web:
cd apps/web
fly launch          # follow prompts

# Deploy
fly deploy
```

Fly gives 3 shared-CPU VMs free. Add `JWT_SECRET` as a secret:
```bash
fly secrets set JWT_SECRET="your-strong-secret"
```

---

## Automate backend deploys with GitHub Actions

This repository includes `.github/workflows/backend-deploy.yml` to automate backend deploys.

It does two things on every push to `main` (or manual run):
1. Runs `npm run test` and `npm run build`
2. Triggers your backend host deploy webhook

Set repository secrets:
- `BACKEND_DEPLOY_HOOK_URL` (required): deploy webhook URL from Railway/Render/Fly/etc.
- `BACKEND_DEPLOY_HOOK_TOKEN` (optional): bearer token sent as `Authorization: Bearer ...`

---

## Choosing the right option

| Goal | Best Option |
|---|---|
| Quick dev demo | localtunnel (zero setup) |
| Stable dev URL for team | VS Code Dev Tunnels (Microsoft account) |
| Always-on, own domain | Cloudflare Tunnel + free domain |
| Permanent cloud hosting | Railway or Fly.io |
| Production | Fly.io or VPS with Nginx + Cloudflare |
