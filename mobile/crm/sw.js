/* Service worker for the installable CRM app. Network first (always fresh data);
   the page shell is kept for offline start, data always comes live from the database. */
var CACHE = "nd-crm-v31";
var SHELL = ["crm-nachalo.html", "crm-klienti.html", "crm-imoti.html", "crm-brokeri.html", "crm-kalendar.html", "crm-kompanii.html", "crm-sdelki.html", "crm-dogovori.html", "crm-contracts.js", "crm-sdelki.html",
  "crm-data.js", "crm-ui.js", "crm-global.js", "crm-klienti-tabs.js", "crm-imoti-tabs.js", "assets/logo.png", "assets/app-icon3-round-192.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).catch(function () {}).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  /* network first for everything: page and scripts always match the same release; the cache is only the offline fallback */
  e.respondWith(fetch(r).then(function (res) {
    if (res.ok && res.type === "basic") { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
    return res;
  }).catch(function () { return caches.match(r); }));
});
