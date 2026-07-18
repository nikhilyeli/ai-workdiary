// AI Work Diary — minimal service worker
// Caches static assets (JS/CSS/fonts) for faster repeat loads.
// API routes are never cached — they always go to the network.

const CACHE_NAME = "wd-v1";
const STATIC_EXTENSIONS = [".js", ".css", ".woff", ".woff2", ".png", ".svg", ".ico"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API routes or non-GET requests
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  const isStatic = STATIC_EXTENSIONS.some((e) => url.pathname.endsWith(e));

  if (isStatic) {
    // Cache-first for static assets
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            }
            return res;
          })
      )
    );
  }
  // All other requests (HTML pages) fall through to network
});
