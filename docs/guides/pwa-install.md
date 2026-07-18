# Progressive Web App (PWA) — Browser-Based Window & Mobile App

AI Work Diary ships with PWA support. This means you can install it as a native-looking app on:

- 🖥️ **Windows / macOS / Linux** — desktop window from Chrome, Edge, or Opera
- 📱 **Android** — "Add to Home Screen" via Chrome, Samsung Internet, Opera
- 🍎 **iOS / iPadOS** — "Add to Home Screen" via Safari

No app store submission required. The app uses your existing backend (self-hosted or tunnelled).

---

## How it works

A PWA is a web app served over HTTPS with a `manifest.json` and optional service worker. The browser offers to install it as a full-screen window app with:
- Its own icon in taskbar/dock/home screen
- No browser chrome (address bar hidden)
- Launches directly, like a native app

> ℹ️ **The backend still runs on your machine.** PWA is only the frontend wrapper. You need a running Next.js server (or a tunnel) for the API to work.

---

## Desktop installation

### Chrome / Edge / Brave / Opera / Vivaldi (Windows, macOS, Linux)

1. Open the app URL in your browser.
2. Look for the **Install** icon in the address bar (⊕ or download icon).
3. Click **Install** → **Install** in the confirmation dialog.
4. The app opens as a standalone window and is pinned to your taskbar/dock.

**Alternatively** via the browser menu:
- Chrome: ⋮ → **Cast, save, and share** → **Install page as app**
- Edge: ⋯ → **Apps** → **Install this site as an app**
- Opera: Menu → **More tools** → **Save as App**

### Firefox

Firefox does not support PWA installation natively. Options:
- Use Chrome/Edge/Opera for installation, or
- Install the [Progressive Web Apps for Firefox](https://addons.mozilla.org/en-US/firefox/addon/pwas-for-firefox/) extension

### To uninstall

- Windows: Start Menu → right-click the app icon → **Uninstall**
- macOS: Finder → Applications → drag app to Trash
- Chrome: browser menu → Apps → find the app → ⋮ → Remove from Chrome

---

## Android installation

### Chrome for Android
1. Open the app URL in Chrome.
2. Tap the ⋮ menu → **Add to Home screen**.
3. Tap **Add** → **Add to Home screen** (or auto-prompt banner at the bottom).
4. The app icon appears on your home screen like a native app.

### Samsung Internet
1. Open the URL.
2. Tap the ≡ menu → **Add page to** → **Home screen**.

### Opera for Android
1. Open the URL.
2. Tap the O menu → **Home screen**.

### Firefox for Android
Firefox for Android supports PWA via "Add to Home Screen" but without full standalone mode. Use Chrome for the best experience.

---

## iOS / iPadOS installation (Safari only)

> ⚠️ PWA installation on iOS requires **Safari**. Third-party browsers on iOS (Chrome, Firefox, Edge) cannot install PWAs.

1. Open the app URL in **Safari**.
2. Tap the **Share** button (rectangle with arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Rename if desired → tap **Add**.
5. The icon appears on your home screen.

### iOS limitations
- No push notifications (iOS PWA limitation).
- App state resets after ~2 weeks of disuse (iOS WebKit storage eviction).
- Splash screens require specific icon sizes (configured in `manifest.json`).

---

## Atlas browser support

Atlas, Comet, and other Chromium-based browsers follow the same procedure as Chrome. Look for the install prompt in the address bar or the browser menu.

---

## Configuring the PWA (manifest.json)

The PWA manifest is at `apps/web/public/manifest.json`. Key fields:

```json
{
  "name": "AI Work Diary",
  "short_name": "WorkDiary",
  "start_url": "/dashboard",
  "display": "standalone",
  "theme_color": "#2563eb",
  "background_color": "#f4f4f5"
}
```

| Field | Description |
|---|---|
| `display` | `"standalone"` hides browser chrome (recommended) |
| `start_url` | Where the app opens when launched |
| `theme_color` | Title bar / status bar color on mobile |
| `background_color` | Splash screen background |

### Adding custom icons

Replace these files in `apps/web/public/`:
- `icon-192.png` — 192×192 PNG (required)
- `icon-512.png` — 512×512 PNG (required)
- `apple-touch-icon.png` — 180×180 PNG (iOS home screen)

---

## Offline support (optional)

The app includes a minimal service worker (`/sw.js`) that caches static assets. API calls require an active connection to the backend. To enable full offline caching, consider adding `next-pwa` to the project.

---

## Updating the installed app

PWAs update automatically the next time you open the app with an active internet connection. If an update is pending, refresh the page — the browser will install the new version.
