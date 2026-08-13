// Minimal service worker for "Имоти Надежда" PWA.
// Strategy: NETWORK-ONLY for HTML navigations (always fresh, no stale shell).
//           CacheFirst only for static icons/manifest.
// Combined with the page-side updater in src/lib/pwa.ts this gives reliable
// auto-update: every new deploy is picked up on the next navigation/visibility
// change without the user having to clear caches or reinstall the PWA.

const CACHE = "imoti-nadezhda-v3";
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
      // Drop every previous cache (including older HTML shells).
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
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/api/")) return;

  // HTML navigations → network-only. No fallback to stale cached HTML that
  // may reference deleted JS chunks.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req));
    return;
  }

  // Static PWA assets → cache-first.
  if (PRECACHE.includes(url.pathname) || url.pathname.startsWith("/icon-")) {
    event.respondWith(
      caches.match(req).then((c) =>
        c ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        }),
      ),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ===== Web Push =====
self.addEventListener("push", (event) => {
  let data = { title: "Имоти Надежда", body: "", url: "/admin", tag: undefined };
  try { if (event.data) data = { ...data, ...event.data.json() }; }
  catch { if (event.data) data.body = event.data.text(); }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [400, 200, 400, 200, 800],
      requireInteraction: true,
      data: { url: data.url || "/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
