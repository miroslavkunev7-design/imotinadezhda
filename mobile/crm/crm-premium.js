/* CRM · премиум визия (етап 1): златна лента докато се зареждат данни + кратка вибрация при важни действия (Android). */
(function () {
  if (window.__ndPremium) return; window.__ndPremium = 1;
  /* ---- златна лента: брои заявките към базата и показва тънка светеща линия горе ---- */
  var bar = null, busy = 0, hideT = null, showT = null;
  function ensure() { if (!bar && document.body) { bar = document.createElement("div"); bar.id = "nd-load"; bar.setAttribute("aria-hidden", "true"); document.body.appendChild(bar); } return bar; }
  function upd() {
    clearTimeout(hideT); clearTimeout(showT);
    if (busy > 0) showT = setTimeout(function () { var b = ensure(); if (b && busy > 0) b.classList.add("on"); }, 120); // кратки заявки не мигат
    else hideT = setTimeout(function () { if (bar) bar.classList.remove("on"); }, 180);
  }
  var of = window.fetch;
  if (of) window.fetch = function (input) {
    var u = typeof input === "string" ? input : (input && input.url) || "";
    var track = /supabase\.co\/(rest|storage)\/|\/api\//.test(u) && !/realtime/.test(u);
    if (!track) return of.apply(this, arguments);
    busy++; upd();
    var done = function () { busy = Math.max(0, busy - 1); upd(); };
    return of.apply(this, arguments).then(function (r) { done(); return r; }, function (e) { done(); throw e; });
  };
  /* ---- вибрация при запис / изтриване / изпращане (само на телефони, които поддържат) ---- */
  document.addEventListener("click", function (e) {
    if (!navigator.vibrate) return;
    var b = e.target.closest && e.target.closest('#nd-f-save,[type="submit"],[data-del],.danger,.c-send,[data-haptic]');
    if (b) try { navigator.vibrate(12); } catch (x) {}
  }, true);
})();
/* The signed-in broker's actual portrait, refreshed after a saved card change. */
(function () {
  function matches(card) {
    var u = window.ND && ND.user; if (!u || !card) return false;
    if (card.user_id) return card.user_id === u.id;
    return !!(u.email && card.email && u.email.toLowerCase() === card.email.toLowerCase());
  }
  function paint(card) {
    if (!matches(card)) return;
    var path = card.photo || card.thumb;
    if (!path) return;
    var task = /^brokers\//.test(path) ? ND.fileUrl(path) : Promise.resolve(/^https?:\/\//.test(path) ? path : 'assets/' + path);
    task.then(function (url) {
      if (!url) return;
      [].forEach.call(document.querySelectorAll('.avatar img'), function (image) { image.src = url; image.alt = card.name || 'Моят профил'; image.decoding = 'async'; });
    }).catch(function () {});
  }
  function boot() {
    if (!window.ND) return;
    ND.ready().then(function () { return ND.load('brokers'); }).then(function (cards) { var mine = cards.filter(matches); if (mine.length === 1) paint(mine[0]); }).catch(function () {});
  }
  addEventListener('nd-broker-updated', function (event) { paint(event.detail); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
/* ---- поздрав в Начало ---- */
(function () {
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  /* поздрав в хедъра на Начало */
  function greet() {
    var hs = document.querySelector(".hero-sub"); if (!hs || !/crm-nachalo/.test(location.pathname) || hs.getAttribute("data-g") === "2") return;
    var u = (window.ND && ND.user) || null, m = (u && u.user_metadata) || {}, nm = String(m.full_name || m.name || "").trim().split(/\s+/)[0];
    if (!u && !greet.t0) { greet.t0 = Date.now(); setTimeout(greet, 900); setTimeout(greet, 2500); }
    hs.setAttribute("data-g", u || (greet.t0 && Date.now() - greet.t0 > 2000) ? "2" : "1");
    var h = new Date().getHours(), g = h < 5 ? "Добър вечер" : h < 11 ? "Добро утро" : h < 18 ? "Добър ден" : "Добър вечер";
    var d = new Date().toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long" });
    hs.innerHTML = '<span class="nd-greet">' + esc(g + (nm ? ", " + nm : "")) + '</span><span class="nd-date">' + esc(d.charAt(0).toUpperCase() + d.slice(1)) + "</span>";
  }
  var t = 0; function run() { clearTimeout(t); t = setTimeout(function () { try { greet(); } catch (e) {} }, 60); }
  function boot() { run(); new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) { var t = ms[i].target; return run(); } }).observe(document.body, { childList: true, subtree: true, characterData: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
