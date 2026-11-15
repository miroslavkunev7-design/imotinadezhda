/* Имоти Надежда CRM · crm-zoomfix.js
   ------------------------------------------------------------------------------------------
   Защо съществува: CRM страниците са нарисувани върху платно 1024 px и се смаляват с CSS „zoom“.
   По-старите iPhone / iPad (Safari и всички браузъри с WebKit преди поправката на
   bugs.webkit.org 272339 / 293617) НЕ прилагат zoom върху текста, когато -webkit-text-size-adjust
   не е „auto“: рамките се смаляват, а буквите и иконите остават в пълен размер и се застъпват.

   Какво прави: с невидима проба проверява дали този браузър има дефекта.
     · Няма дефект (нов iPhone, Android, компютър)  →  не прави нищо, страницата остава както е.
     · Има дефект  →  връща на текста точния мащаб на платното, по един от два начина,
       като всеки е проверен със същата проба, преди да се включи:
         P: -webkit-text-size-adjust = мащаба на съответния zoom (iPhone);
         Z: -webkit-text-zoom се редува родител/дете, за да се преизчисли шрифтът със zoom (iPad).
   Не променя дизайн, размери или подредба – само поправя размера на текста там, където е счупен.
   Ръчна проверка: ?ndtz=p | ?ndtz=z | ?ndtz=off в адреса; състоянието е в window.NDZoomFix.
   ------------------------------------------------------------------------------------------ */
(function () {
  "use strict";
  var w = window, d = document, root = d.documentElement;
  if (!root || w.NDZoomFix) return;
  var api = w.NDZoomFix = { mode: "", probe: null };
  var TSA = "-webkit-text-size-adjust", TSA2 = "text-size-adjust";

  /* ---------- проба: смалява ли zoom текста така, както смалява кутиите ---------- */
  function measure() {
    var host = d.createElement("div"), parent = d.body || root, out = null;
    var font = "display:inline-block;white-space:nowrap;font:normal 400 100px/1 Arial,Helvetica,sans-serif";
    var box = '<i style="display:inline-block;width:100px;height:1px"></i>';
    var cell = '<div><span style="' + font + '">MMMMMMMMMM</span>' + box + "</div>";
    var cellZ = '<div><span style="' + font + ';-webkit-text-zoom:reset">MMMMMMMMMM</span>' + box + "</div>";
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:absolute;left:-99999px;top:0;width:6000px;visibility:hidden;pointer-events:none;" +
      "-webkit-text-size-adjust:none;text-size-adjust:none";
    host.innerHTML = cell +                                                                 /* 0: без zoom (еталон) */
      '<div style="zoom:.5">' + cell + "</div>" +                                            /* 1: както е в сайта */
      '<div style="zoom:.5;-webkit-text-size-adjust:50%;text-size-adjust:50%">' + cell + "</div>" + /* 2: начин P */
      '<div style="zoom:.5">' + cellZ + "</div>";                                            /* 3: начин Z */
    try {
      parent.appendChild(host);
      var spans = host.getElementsByTagName("span"), boxes = host.getElementsByTagName("i"), r = [];
      for (var i = 0; i < 4; i++) {
        var a = spans[i].getBoundingClientRect().width, b = boxes[i].getBoundingClientRect().width;
        r.push(a > 0 && b > 0 ? a / b : NaN);
      }
      if (r[0] > 0) out = { now: r[1] / r[0], p: r[2] / r[0], z: r[3] / r[0] };
    } catch (e) { out = null; }
    if (host.parentNode) host.parentNode.removeChild(host);
    return out;
  }
  function good(x) { return x > 0.8 && x < 1.25; }

  function addCss(css) {
    var s = d.createElement("style");
    s.setAttribute("data-ndtz", "css");
    s.appendChild(d.createTextNode(css));
    (d.head || root).appendChild(s);
  }

  /* ---------- начин P: text-size-adjust = натрупания zoom на всяко мащабирано платно ---------- */
  function startP() {
    api.mode = "p";
    root.classList.add("ndtz-p");
    addCss(
      "html.ndtz-p body,html.ndtz-p body *{-webkit-text-size-adjust:inherit!important;text-size-adjust:inherit!important}" +
      "html.ndtz-p svg text,html.ndtz-p svg tspan,html.ndtz-p svg textPath{-webkit-text-size-adjust:none!important;text-size-adjust:none!important}");
    var ruleSel = "", sheetKey = "", applied = new Map(), raf = 0;

    function collect() {
      var key = "", sheets = d.styleSheets, s, rules;
      for (s = 0; s < sheets.length; s++) {
        try { rules = sheets[s].cssRules; } catch (e) { rules = null; }
        key += "|" + (sheets[s].href || "inline") + ":" + (rules ? rules.length : -1);
      }
      if (key === sheetKey) return;
      sheetKey = key;
      var list = [];
      function walk(rs) {
        for (var i = 0; i < rs.length; i++) {
          var r = rs[i];
          if (r.style && r.selectorText) { if (r.style.getPropertyValue("zoom")) list.push(r.selectorText); }
          else if (r.cssRules) { try { walk(r.cssRules); } catch (e) {} }
        }
      }
      for (s = 0; s < sheets.length; s++) {
        try { rules = sheets[s].cssRules; } catch (e) { rules = null; }
        if (rules) walk(rules);
      }
      var ok = [];
      for (var k = 0; k < list.length; k++) { try { d.querySelector(list[k]); ok.push(list[k]); } catch (e) {} }
      ruleSel = ok.join(",");
    }
    function ownZoom(el) {
      var v = getComputedStyle(el).zoom, n = parseFloat(v);
      if (!(n > 0)) return 1;
      return /%\s*$/.test(String(v)) ? n / 100 : n;
    }
    function setTsa(el, val) {
      if (applied.get(el) === val && el.style.getPropertyValue(TSA)) return;   /* вече е сложено и не е изтрито */
      el.style.setProperty(TSA, val, "important");
      el.style.setProperty(TSA2, val, "important");
    }
    function clearTsa(el) {
      if (!el.style || !el.style.getPropertyValue(TSA)) return;
      el.style.removeProperty(TSA);
      el.style.removeProperty(TSA2);
    }
    function rescan() {
      raf = 0;
      if (!d.body) return;
      collect();
      var els;
      try { els = d.querySelectorAll('[style*="zoom"]' + (ruleSel ? "," + ruleSel : "")); }
      catch (e) { els = d.querySelectorAll('[style*="zoom"]'); }
      var cum = new Map(), now = new Map();
      for (var i = 0; i < els.length; i++) {             /* редът е този на документа: родителите са преди децата */
        var el = els[i];
        if (el === root || el === d.body || !d.body.contains(el)) continue;
        var z = ownZoom(el);
        if (Math.abs(z - 1) < 0.0005) continue;
        var pz = 1, p = el.parentElement;
        while (p && p !== root) { if (cum.has(p)) { pz = cum.get(p); break; } p = p.parentElement; }
        var c = z * pz, val = (Math.round(c * 1e6) / 1e4) + "%";
        cum.set(el, c);
        setTsa(el, val);
        now.set(el, val);
      }
      applied.forEach(function (v, el) { if (!now.has(el)) clearTsa(el); });
      applied = now;
    }
    function schedule() { if (!raf) raf = (w.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(rescan); }

    api.rescan = rescan;
    rescan();
    try {
      new MutationObserver(schedule).observe(d, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class"] });
    } catch (e) {}
    d.addEventListener("DOMContentLoaded", rescan);
    d.addEventListener("load", function (e) {                                       /* зареден файл със стилове */
      var t = e && e.target;
      if (t && (t.nodeName === "LINK" || t.nodeName === "STYLE")) { sheetKey = ""; schedule(); }
    }, true);
    w.addEventListener("load", rescan);
    w.addEventListener("pageshow", rescan);
    w.addEventListener("resize", schedule);
    w.addEventListener("orientationchange", schedule);
  }

  /* ---------- начин Z: редуване на -webkit-text-zoom, за да се преизчисли шрифтът със zoom ---------- */
  function startZ() {
    api.mode = "z";
    root.classList.add("ndtz-z");
    var css = "html.ndtz-z,html.ndtz-z *{-webkit-text-size-adjust:none!important;text-size-adjust:none!important}" +
      '[data-ndtz="1"]{-webkit-text-zoom:reset}[data-ndtz="0"]{-webkit-text-zoom:normal}';
    ["::before", "::after", "::placeholder", "::-webkit-input-placeholder", "::marker", "::first-letter", "::first-line"].forEach(function (ps) {
      css += '[data-ndtz="1"]' + ps + "{-webkit-text-zoom:normal}" + '[data-ndtz="0"]' + ps + "{-webkit-text-zoom:reset}";
    });
    addCss(css);
    var SKIP = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, TITLE: 1, HEAD: 1, svg: 1, SVG: 1, TEMPLATE: 1, NOSCRIPT: 1 };
    function parityFor(el) {
      var p = el.parentElement;
      return p && p.getAttribute("data-ndtz") === "1" ? "0" : "1";
    }
    function mark(el, par) {
      var stack = [[el, par]];
      while (stack.length) {
        var it = stack.pop(), e = it[0], v = it[1];
        if (e.nodeType !== 1 || SKIP[e.nodeName]) continue;
        if (e.getAttribute("data-ndtz") !== v) e.setAttribute("data-ndtz", v);
        var nv = v === "1" ? "0" : "1";
        for (var c = e.firstElementChild; c; c = c.nextElementSibling) stack.push([c, nv]);
      }
    }
    function all() { if (d.body) mark(d.body, "1"); }
    api.rescan = all;
    all();
    try {
      new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
          var add = recs[i].addedNodes;
          for (var j = 0; j < add.length; j++) {
            var n = add[j];
            if (n.nodeType !== 1 || !n.parentElement || n.parentElement === d.head) continue;
            if (n === d.body) mark(n, "1"); else if (d.body && d.body.contains(n)) mark(n, parityFor(n));
          }
        }
      }).observe(d, { subtree: true, childList: true });
    } catch (e) {}
    d.addEventListener("DOMContentLoaded", all);
    w.addEventListener("pageshow", all);
  }

  /* ---------- решение ---------- */
  var force = /[?&]ndtz=(p|z|off)\b/.exec(location.search || "");
  function decide() {
    if (api.mode) return true;
    if (force) {
      if (force[1] === "p") startP(); else if (force[1] === "z") startZ(); else api.mode = "off";
      return true;
    }
    var m = measure();
    api.probe = m;
    if (!m || !(m.now > 0)) return false;                    /* страницата още няма размери – ще опитаме пак */
    if (good(m.now)) { api.mode = "ok"; return true; }       /* браузърът е изправен: нищо не се пипа */
    if (good(m.p)) startP(); else if (good(m.z)) startZ(); else api.mode = "unfixed";
    return true;
  }
  if (!decide()) {
    var retry = function () { decide(); };
    d.addEventListener("DOMContentLoaded", retry);
    w.addEventListener("load", retry);
    w.addEventListener("pageshow", retry);
  }
})();
