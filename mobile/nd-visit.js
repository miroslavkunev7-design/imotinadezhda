/* Реални посещения на публичния сайт (таблица nd_site_visits, функция nd_visit).
   Един човек се брои веднъж за сайта и веднъж за всеки имот, който отвори; при второ влизане не се отчита.
   Брокерите не се броят: устройство, на което някога е влизано в CRM, не изпраща нищо. Ботовете също не се броят. */
(function () {
  "use strict";
  if (window.ndVisit) return;
  var URL = "https://hyvwfsmjbaynozceookv.supabase.co/rest/v1/rpc/nd_visit", KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
  var LS = null; try { LS = window.localStorage; LS.getItem("nd-visitor"); } catch (e) { LS = null; }
  function get(k) { try { return LS ? LS.getItem(k) : null; } catch (e) { return null; } }
  function set(k, v) { try { if (LS) LS.setItem(k, v); } catch (e) {} }
  function cookie(k) { var m = new RegExp("(?:^|; )" + k + "=([^;]*)").exec(document.cookie || ""); return m ? m[1] : ""; }
  function staff() {
    if (get("nd-staff-device") === "1") return true;
    try { for (var i = 0; LS && i < LS.length; i++) { var k = LS.key(i); if ((/^sb-[a-z0-9]+-auth-token$/.test(k) || k === "nd-crm-auth") && get(k)) { set("nd-staff-device", "1"); return true; } } } catch (e) {}
    return false;
  }
  function uid() {
    var v = get("nd-visitor") || cookie("nd_visitor");
    if (!/^[a-z0-9-]{16,64}$/.test(v || "")) {
      var a = new Uint8Array(16); try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256); }
      v = [].map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    }
    set("nd-visitor", v); try { document.cookie = "nd_visitor=" + v + "; path=/; max-age=63072000; SameSite=Lax"; } catch (e) {}
    return v;
  }
  var seen = {}; try { seen = JSON.parse(get("nd-visit-seen") || "{}") || {}; } catch (e) { seen = {}; }
  function send(prop) {
    prop = String(prop || ""); var key = prop || "_site";
    if (seen[key] || navigator.webdriver || /bot|crawl|spider|headless|lighthouse|pagespeed/i.test(navigator.userAgent) || staff()) return;
    seen[key] = 1;
    try {
      fetch(URL, { method: "POST", keepalive: true, headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_visitor: uid(), p_prop: prop }) })
        .then(function (r) { if (!r.ok) { delete seen[key]; return; } var ks = Object.keys(seen); if (ks.length > 600) ks.slice(1, 200).forEach(function (k) { delete seen[k]; }); set("nd-visit-seen", JSON.stringify(seen)); })
        .catch(function () { delete seen[key]; });
    } catch (e) { delete seen[key]; }
  }
  /* страница на имот в публичния сайт: #/property/<id>/<град> */
  function route() { var m = /^#\/property\/([^\/?#]+)/.exec(location.hash || ""); if (m) { try { send(decodeURIComponent(m[1])); } catch (e) {} } }
  window.ndVisit = send;
  function start() { send(""); route(); window.addEventListener("hashchange", route); }
  if (document.visibilityState === "prerender") document.addEventListener("visibilitychange", function once() { document.removeEventListener("visibilitychange", once); start(); });
  else start();
})();
