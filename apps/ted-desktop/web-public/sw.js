/* Тед (уеб): винаги първо от мрежата (последната версия), кешът е само за пускане без връзка. Заявките към /api и Supabase не се пазят. */
var CACHE = "ted-web-v1";
self.addEventListener("install", function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(["./", "./index.html", "./manifest.webmanifest", "./icons/ted-192.png"]); }).catch(function () {}).then(function () { return self.skipWaiting(); })); });
self.addEventListener("activate", function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.indexOf("/mobile/ted/") !== 0) return;
  e.respondWith(fetch(r).then(function (res) { if (res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); } return res; }).catch(function () { return caches.match(r).then(function (m) { return m || caches.match("./index.html"); }); }));
});
