/* Imoti Nadezhda CRM — известия на телефона (Web Push), дори на заключен екран.
   NDPush.enable() иска разрешение и записва абонамента на сървъра (/api/push); NDPush.status() връща състоянието;
   докато CRM е отворен, на 5 минути се вика /api/push tick (резервен планировчик към pg_cron). */
(function () {
  "use strict";
  var D = window.ND, api = function (body) {
    return D.token().then(function (t) { return fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(body) }); })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); });
  };
  var isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  function supported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
  function b64(s) { var p = "=".repeat((4 - s.length % 4) % 4), b = (s + p).replace(/-/g, "+").replace(/_/g, "/"), raw = atob(b), a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }
  function reg() { return navigator.serviceWorker.register("sw.js").then(function () { return navigator.serviceWorker.ready; }); }
  function current() { if (!supported()) return Promise.resolve(null); return reg().then(function (r) { return r.pushManager.getSubscription(); }).catch(function () { return null; }); }
  /* състояние за настройките */
  function status() {
    if (!supported()) return Promise.resolve({ supported: false, reason: isIOS && !standalone ? "ios-home" : "unsupported", permission: "unsupported" });
    return current().then(function (s) { return { supported: true, permission: Notification.permission, subscribed: !!s, endpoint: s ? s.endpoint : null, reason: isIOS && !standalone ? "ios-home" : "" }; });
  }
  function enable() {
    if (!supported()) return Promise.reject(new Error(isIOS && !standalone ? "На iPhone известията работят само когато CRM е добавен на началния екран: Сподели → „Добави на началния екран“, после отворете CRM оттам." : "Този браузър не поддържа известия."));
    return Notification.requestPermission().then(function (p) {
      if (p !== "granted") throw new Error(p === "denied" ? "Известията са забранени за този сайт в настройките на браузъра. Разрешете ги и опитайте пак." : "Разрешението не беше дадено.");
      return api({ action: "vapid" });
    }).then(function (v) {
      if (!v.ok || !v.key) throw new Error(v.error || "Известията не са настроени на сървъра (VAPID).");
      return reg().then(function (r) { return r.pushManager.getSubscription().then(function (s) { return s || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(v.key) }); }); });
    }).then(function (s) {
      return api({ action: "subscribe", subscription: s.toJSON(), ua: navigator.userAgent.slice(0, 160) }).then(function (r) { if (!r.ok) throw new Error(r.error || "Абонаментът не се записа"); try { localStorage.setItem("nd-push-on", "1"); } catch (x) {} return r; });
    });
  }
  function disable() { return current().then(function (s) { var ep = s ? s.endpoint : null; return (s ? s.unsubscribe() : Promise.resolve()).then(function () { try { localStorage.removeItem("nd-push-on"); } catch (x) {} return api({ action: "unsubscribe", endpoint: ep }); }); }); }
  function test() { return api({ action: "test" }); }
  function ack(eventId) { return api({ action: "ack", event_id: eventId }); }
  /* подновяване на абонамента при всяко отваряне (ключът може да е сменен) + резервен tick */
  function boot() {
    D.ready().then(function () {
      var on = false; try { on = localStorage.getItem("nd-push-on") === "1"; } catch (x) {}
      if (on && supported() && Notification.permission === "granted") current().then(function (s) { if (s) api({ action: "subscribe", subscription: s.toJSON(), ua: navigator.userAgent.slice(0, 160) }).catch(function () {}); });
      var tick = function () { if (document.visibilityState !== "hidden") api({ action: "tick" }).catch(function () {}); };
      setTimeout(tick, 4000); setInterval(tick, 5 * 60000);
      /* потвърждение при отваряне на събитието от известието (#<event id>) */
      if (/crm-kalendar\.html$/.test(location.pathname) && location.hash.length > 1) ack(decodeURIComponent(location.hash.slice(1))).catch(function () {});
    }).catch(function () {});
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", function (e) { if (e.data && e.data.type === "nd-push-ack" && e.data.event_id) ack(e.data.event_id).catch(function () {}); });
  }
  window.NDPush = { supported: supported, status: status, enable: enable, disable: disable, test: test, ack: ack, isIOS: isIOS, standalone: standalone };
  if (D && D.ready) boot();
})();
