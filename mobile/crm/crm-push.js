/* Imoti Nadezhda CRM — известия на телефона (Web Push), дори на заключен екран.
   NDPush.enable() иска разрешение и записва абонамента на сървъра (/api/push); NDPush.status() връща състоянието;
   докато CRM е отворен, на 5 минути се вика /api/push tick (резервен планировчик към pg_cron).
   На началния екран: нови писма излизат на заключения екран. */
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
      return api({ action: "subscribe", subscription: s.toJSON(), ua: navigator.userAgent.slice(0, 160) }).then(function (r) { if (!r.ok) throw new Error(r.error || "Абонаментът не се записа"); try { localStorage.setItem("nd-push-on", "1"); } catch (x) {} hideBanner(); return r; });
    });
  }
  function disable() { return current().then(function (s) { var ep = s ? s.endpoint : null; return (s ? s.unsubscribe() : Promise.resolve()).then(function () { try { localStorage.removeItem("nd-push-on"); } catch (x) {} return api({ action: "unsubscribe", endpoint: ep }); }); }); }
  function test() { return api({ action: "test" }); }
  function ack(eventId) { return api({ action: "ack", event_id: eventId }); }
  function hideBanner() { var el = document.getElementById("nd-push-mail"); if (el) el.remove(); }
  function banner() {
    if (document.getElementById("nd-push-mail")) return;
    try { if (sessionStorage.getItem("nd-push-mail-hide") === "1") return; } catch (x) {}
    var el = document.createElement("div");
    el.id = "nd-push-mail";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Известия за пощата");
    el.innerHTML = "<p>Нови писма ще излизат на <b>заключения екран</b>.</p><button type=\"button\" data-on>Включи</button><button type=\"button\" data-x aria-label=\"Затвори\">×</button>";
    el.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:240;display:flex;align-items:center;gap:10px;padding:14px 14px 14px 16px;border-radius:18px;background:linear-gradient(180deg,#7a0f22,#4f0716);color:#fff6e8;border:1.5px solid #e3b25e;box-shadow:0 10px 28px rgba(40,4,12,.45),0 0 16px rgba(227,178,94,.45);font:600 15px/1.3 'Roboto Condensed',system-ui,sans-serif";
    var p = el.querySelector("p"); p.style.cssText = "flex:1;margin:0";
    var on = el.querySelector("[data-on]"); on.style.cssText = "flex:0 0 auto;height:40px;padding:0 14px;border-radius:14px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffaf1,#f1dfc7);color:#6b0a1c;font:700 15px 'Roboto Condensed',sans-serif";
    var x = el.querySelector("[data-x]"); x.style.cssText = "flex:0 0 auto;width:36px;height:36px;border:0;background:transparent;color:#ffe9c4;font:700 22px/1 Georgia,serif";
    on.onclick = function () { on.disabled = true; enable().then(function () { return test(); }).then(function () { hideBanner(); }).catch(function (err) { on.disabled = false; on.textContent = (err && err.message) ? "Опитай пак" : "Включи"; }); };
    x.onclick = function () { try { sessionStorage.setItem("nd-push-mail-hide", "1"); } catch (e) {} hideBanner(); };
    document.body.appendChild(el);
  }
  function keepSub() {
    return current().then(function (s) {
      if (s) return api({ action: "subscribe", subscription: s.toJSON(), ua: navigator.userAgent.slice(0, 160) });
      return enable();
    });
  }
  /* подновяване на абонамента при всяко отваряне (ключът може да е сменен) + резервен tick */
  function boot() {
    D.ready().then(function () {
      var on = false; try { on = localStorage.getItem("nd-push-on") === "1"; } catch (x) {}
      if (supported() && Notification.permission === "granted" && (on || standalone)) keepSub().catch(function () {});
      else if (standalone && supported() && Notification.permission !== "denied") current().then(function (s) { if (!s) banner(); }).catch(function () { banner(); });
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
