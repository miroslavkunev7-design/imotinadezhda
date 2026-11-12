/* ИМОТИ НАДЕЖДА · 12.11 · „Ново строителство ▾“ → падащо меню „В проект / Завършено“ (на мястото на „Проекти на зелено“).
   Ползва същия стъклен списък като всички падащи менюта на сайта (mobile/nd-menu.js): скрит <select> се поставя върху бутона
   и му се подава pointerdown. Без nd-menu.js бутонът просто води към страницата на проекта.
   Бутон: всеки елемент с data-ncnav. */
(function () {
  "use strict";
  if (window.NDNcNav) return;
  var ITEMS = [["/mobile/nc-shumen.html", "В проект"], ["/mobile/nc.html?t=done", "Завършено"]];
  var sel = null, cur = null, downOpen = false;
  function fit() {
    if (!sel || !cur || !document.body.contains(cur)) return;
    var r = cur.getBoundingClientRect();
    sel.style.left = r.left + "px"; sel.style.top = r.top + "px"; sel.style.width = Math.max(1, r.width) + "px"; sel.style.height = Math.max(1, r.height) + "px";
  }
  function make() {
    if (sel) return sel;
    sel = document.createElement("select"); sel.id = "nd-ncnav"; sel.tabIndex = -1;
    sel.setAttribute("aria-hidden", "true"); sel.setAttribute("aria-label", "Ново строителство");
    sel.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;padding:0;margin:0;z-index:-1";
    var o = document.createElement("option"); o.value = ""; o.hidden = true; o.selected = true; sel.appendChild(o);
    ITEMS.forEach(function (x) { var p = document.createElement("option"); p.value = x[0]; p.textContent = x[1]; sel.appendChild(p); });
    sel.addEventListener("change", function () { var v = sel.value; sel.value = ""; if (v) location.href = v; });
    document.body.appendChild(sel);
    /* страницата се е преместила, докато списъкът е отворен: скритото поле следва бутона (nd-menu го ползва за котва) */
    window.addEventListener("scroll", function (e) { if (sel.classList.contains("ndm-open") && !(e.target && e.target.closest && e.target.closest(".ndmenu"))) fit(); }, true);
    window.addEventListener("resize", function () { if (sel.classList.contains("ndm-open")) fit(); });
    return sel;
  }
  function open(el) {
    if (downOpen) { downOpen = false; return; }            /* същото натискане току-що го затвори */
    var s = make(), ev; cur = el; fit();
    try { ev = new PointerEvent("pointerdown", { bubbles: true, cancelable: true }); } catch (e) { ev = document.createEvent("Event"); ev.initEvent("pointerdown", true, true); }
    s.dispatchEvent(ev);
    if (!s.classList.contains("ndm-open")) location.href = ITEMS[0][0];
  }
  document.addEventListener("pointerdown", function (e) {
    downOpen = !!(sel && sel.classList.contains("ndm-open") && e.target && e.target.closest && e.target.closest("[data-ncnav]"));
  }, true);
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest("[data-ncnav]");
    if (!t || e.defaultPrevented && t.tagName !== "BUTTON" || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault(); open(t);
  });
  window.NDNcNav = open;
})();
