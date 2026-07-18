# Capacitor — Native iOS & Android App

Capacitor from Ionic wraps AI Work Diary in a native iOS or Android WebView. The app calls your backend (running via a dev tunnel or hosted server) over HTTPS.

> ℹ️ **The SQLite database stays on your backend server**, not on the mobile device. The mobile app is purely a web frontend.

---

## Architecture

```
Mobile device (iOS / Android)
└── Capacitor WebView
    └── Loads the React dashboard
        └── API calls → your backend URL (tunnel or hosted)

Backend (your machine or server)
└── Next.js + SQLite
    └── Exposed via Cloudflare Tunnel / ngrok / Railway / etc.
```

---

## Prerequisites

- Node.js ≥ 20
- **iOS**: macOS + Xcode 15+
- **Android**: Android Studio (any OS)

---

## Step 1 — Export the Next.js app as a static bundle (API-less client)

Capacitor needs a static HTML/JS bundle. For AI Work Diary, this means the frontend only — API calls go to a remote backend URL.

### Configure the backend URL

Set the backend URL so all `authFetch` calls know where to send requests:

Create `apps/web/.env.mobile` (or set at build time):
```env
NEXT_PUBLIC_API_BASE_URL=https://your-tunnel-or-server-url.com
```

Update `apps/web/src/lib/auth-client.ts` to prefix API calls with this variable when set:

```ts
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export async function authFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  // ... existing token logic ...
  return fetch(`${API_BASE}${path}`, init);
}
```

### Export as static site

```bash
cd apps/web
NEXT_PUBLIC_API_BASE_URL=https://your-backend.example.com npm run build
npx next export -o out   # or set output: 'export' in next.config.ts
```

> ⚠️ `next export` disables API routes. The exported `out/` folder is the static bundle to be loaded by Capacitor.

---

## Step 2 — Add Capacitor to the project

```bash
cd apps/web
npm install @capacitor/core @capacitor/cli
npx cap init "AI Work Diary" "com.aiworkdiary.app" --web-dir out
```

---

## Step 3 — Add iOS and/or Android platforms

```bash
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
```

---

## Step 4 — Sync the web build with the native project

Every time you rebuild the web app, sync:

```bash
npm run build
npx cap sync
```

---

## Step 5 — Run on iOS

```bash
npx cap open ios
```

Xcode opens. Select a simulator or real device, then press **Run**.

---

## Step 6 — Run on Android

```bash
npx cap open android
```

Android Studio opens. Select an emulator or real device, then press **Run**.

---

## Step 7 — Allow network requests to HTTP (development only)

For iOS, add to `ios/App/App/Info.plist`:
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
</dict>
```

For Android, add to `android/app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">localhost</domain>
  </domain-config>
</network-security-config>
```

> Use HTTPS in production. Never ship with `NSAllowsArbitraryLoads: true` to the App Store.

---

## Step 8 — Build for distribution

### iOS (App Store / TestFlight)
1. Open Xcode → Product → Archive.
2. Follow the Distribution wizard.

### Android (Google Play)
```bash
npx cap build android
```
Then sign the APK/AAB in Android Studio.

---

## Recommended: Cloudflare Tunnel as the permanent backend

For a mobile app pointing at a home server:

1. Follow the [Cloudflare Tunnel guide](./free-deployment.md#option-2--cloudflare-tunnel-recommended-for-always-on).
2. Use `https://app.yourdomain.com` as `NEXT_PUBLIC_API_BASE_URL`.
3. Keep your machine on (or use a mini PC / Raspberry Pi).

---

## Capacitor configuration reference (`capacitor.config.ts`)

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aiworkdiary.app",
  appName: "AI Work Diary",
  webDir: "out",
  server: {
    // For development: point to running dev server (optional)
    // url: "http://192.168.x.x:3000",
    // cleartext: true,
  },
};

export default config;
```
