/* Service worker for the installable CRM app. Network first (always fresh data);
   the page shell is kept for offline start, data always comes live from the database. */
var CACHE = "nd-crm-v49";
var SHELL = ["crm-nachalo.html", "crm-klienti.html", "crm-imoti.html", "crm-brokeri.html", "crm-kalendar.html", "crm-kompanii.html", "crm-naemi.html", "crm-sdelki.html", "crm-dogovori.html", "crm-poshta.html", "bank.html",
  "crm-blend.css", "crm-data.js", "crm-ui.js", "crm-global.js", "crm-dictate.js", "crm-doclists.js", "crm-video.js", "crm-inquiries.js", "crm-klienti-tabs.js", "crm-imoti-tabs.js", "crm-contracts.js",
  "crm-assistant.js", "crm-collect.js", "crm-scan.js", "crm-publish.js", "crm-push.js", "../ash.js", "../places.js", "../nd-menu.js",
  "assets/vendor/supabase.js", "assets/logo.png", "assets/app-icon3-round-192.png", "assets/fonts/pt-serif-cyrillic-400-normal.woff2", "assets/fonts/pt-serif-cyrillic-700-normal.woff2", "assets/fonts/roboto-condensed-cyrillic-400-normal.woff2", "assets/fonts/roboto-condensed-cyrillic-700-normal.woff2"];
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

/* ---- известия на телефона (Web Push): показват се и на заключен екран; бутон „Потвърждавам“ спира ескалацията към екипа ---- */
self.addEventListener("push", function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "Имоти Надежда", body: e.data ? e.data.text() : "" }; }
  var opts = {
    body: d.body || "", icon: "/mobile/crm/assets/app-icon3-192.png", badge: "/mobile/crm/assets/app-icon3-192.png", lang: "bg",
    tag: d.tag || ("nd-" + Date.now()), renotify: true, requireInteraction: !!d.ack, vibrate: [120, 60, 120],
    data: { url: d.url || "/mobile/crm/crm-kalendar.html", ack: d.ack || null, rid: d.rid || null },
    actions: d.actions || (d.ack ? [{ action: "ack", title: "Потвърждавам" }, { action: "open", title: "Отвори" }] : [])
  };
  e.waitUntil(self.registration.showNotification(d.title || "Имоти Надежда", opts));
});
self.addEventListener("notificationclick", function (e) {
  var n = e.notification, data = n.data || {}; n.close();
  var ackP = data.ack ? fetch("/api/push?action=ack&t=" + encodeURIComponent(data.ack), { cache: "no-store" }).catch(function () {}) : Promise.resolve();
  if (e.action === "ack") { e.waitUntil(ackP); return; }
  e.waitUntil(ackP.then(function () { return clients.matchAll({ type: "window", includeUncontrolled: true }); }).then(function (list) {
    var url = new URL(data.url || "/mobile/crm/crm-kalendar.html", self.location.origin).href;
    for (var i = 0; i < list.length; i++) { if (list[i].url.indexOf("/mobile/crm/") >= 0 && "focus" in list[i]) { list[i].navigate(url); return list[i].focus(); } }
    return clients.openWindow(url);
  }));
});
