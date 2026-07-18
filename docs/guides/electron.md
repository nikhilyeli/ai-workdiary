# Electron — Desktop Window App

Electron wraps the AI Work Diary web UI in a native desktop window (Windows, macOS, Linux) that runs entirely offline, with the Next.js server **embedded inside the Electron main process**.

> ℹ️ This guide is for local/developer packaging. For a quick "window app" without Electron, see the [PWA guide](./pwa-install.md).

---

## Architecture

```
Electron main process
├── Spawns: next start (built Next.js server on port 3000)
└── Opens: BrowserWindow pointing to http://localhost:3000

Electron renderer (BrowserWindow)
└── Renders the React dashboard (same as browser)
```

SQLite stays local — `apps/web/data/workdiary.db` on the user's machine.

---

## Prerequisites

- Node.js ≥ 20 (same as the web app)
- npm ≥ 10
- The repo cloned locally

---

## Step 1 — Add the Electron package

From the repository root:

```bash
# Create a separate electron workspace
mkdir -p electron
cd electron
npm init -y
npm install --save-dev electron electron-builder
npm install tree-kill     # for clean server shutdown
```

---

## Step 2 — Create the Electron main file

Create `electron/main.js`:

```js
const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const kill = require("tree-kill");

const APP_URL = "http://localhost:3000";
const WEB_DIR = path.join(__dirname, "..", "apps", "web");

let mainWindow;
let serverProcess;

function startNextServer() {
  // Run `npm start` inside apps/web (which runs `next start`)
  serverProcess = spawn("npm", ["start"], {
    cwd: WEB_DIR,
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      // Set JWT_SECRET from env or a fallback for local use
      JWT_SECRET: process.env.JWT_SECRET || require("crypto").randomBytes(48).toString("hex"),
    },
  });

  serverProcess.stdout.on("data", (data) => console.log("[server]", data.toString()));
  serverProcess.stderr.on("data", (data) => console.error("[server]", data.toString()));
}

function waitForServer(url, retries = 30, delay = 500) {
  return new Promise((resolve, reject) => {
    const http = require("http");
    let attempts = 0;

    function tryConnect() {
      http.get(url, (res) => {
        if (res.statusCode < 500) resolve();
        else retry();
      }).on("error", retry);
    }

    function retry() {
      attempts++;
      if (attempts >= retries) return reject(new Error("Server did not start in time"));
      setTimeout(tryConnect, delay);
    }

    tryConnect();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "AI Work Diary",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(APP_URL);

  // Open external links in the OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  startNextServer();
  try {
    await waitForServer(APP_URL);
    createWindow();
  } catch (err) {
    console.error("Could not connect to Next.js server:", err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (serverProcess) kill(serverProcess.pid);
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});
```

---

## Step 3 — Build the Next.js app

```bash
# From repo root
npm run build
```

This creates the production `.next` bundle in `apps/web/.next`.

---

## Step 4 — Configure electron-builder

Create `electron/package.json` (update or replace the generated one):

```json
{
  "name": "ai-workdiary-desktop",
  "version": "1.0.0",
  "description": "AI Work Diary Desktop",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.ai-workdiary.app",
    "productName": "AI Work Diary",
    "directories": { "output": "dist" },
    "files": ["main.js", "node_modules/**/*"],
    "extraResources": [
      { "from": "../apps/web", "to": "apps/web",
        "filter": ["**/*", "!data/**", "!node_modules/.cache/**"] }
    ],
    "win":   { "target": "nsis" },
    "mac":   { "target": "dmg" },
    "linux": { "target": "AppImage" }
  },
  "dependencies": { "tree-kill": "^1.2.2" },
  "devDependencies": {
    "electron": "^32.0.0",
    "electron-builder": "^24.0.0"
  }
}
```

---

## Step 5 — Run in development

```bash
cd electron
npm start
```

A native window opens pointing to the local Next.js server.

---

## Step 6 — Package for distribution

```bash
cd electron
npm run dist
```

Output in `electron/dist/`:
- Windows: `.exe` installer
- macOS: `.dmg`
- Linux: `.AppImage`

---

## Setting JWT_SECRET for the packaged app

The packaged app generates a random `JWT_SECRET` on every launch if none is set. This means sessions are invalidated on restart. For persistent sessions, set the environment variable before launching:

**Windows** (PowerShell):
```powershell
$env:JWT_SECRET = "your-long-secret-here"
& "AI Work Diary.exe"
```

**macOS/Linux**:
```bash
JWT_SECRET="your-long-secret-here" ./AI\ Work\ Diary.AppImage
```

Or add it to your system environment variables for automatic use.

---

## Data location (SQLite)

The database is stored at:
- **macOS**: `~/Library/Application Support/AI Work Diary/data/workdiary.db`
- **Windows**: `%APPDATA%\AI Work Diary\data\workdiary.db`
- **Linux**: `~/.config/AI Work Diary/data/workdiary.db`

To persist data across app reinstalls, back up this file.
