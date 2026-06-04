// Minimal service worker for "Имоти Надежда" PWA.
// Strategy: NetworkFirst for navigations, CacheFirst for icons/manifest.
// Kept intentionally simple to avoid stale-shell issues.

const CACHE = "imoti-nadezhda-v1";
const PRECACHE = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Never intercept OAuth / API / supabase requests
  if (url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/api/")) return;
  if (url.origin !== self.location.origin) return;

  // HTML navigations: network first, fall back to cached shell
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || caches.match("/") || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets: cache first
  if (PRECACHE.includes(url.pathname) || url.pathname.startsWith("/icon-")) {
    event.respondWith(
      caches.match(req).then((c) => c || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })),
    );
  }
});

// Allow the page to trigger immediate activation of an updated SW.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
