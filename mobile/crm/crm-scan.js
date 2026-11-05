/* "Нов клиент" / "Нов имот" menu: Добави ръчно, or Сканиране (gallery photo, file, camera).
   The file is analysed for real by /api/scan (Gemini) while a scanning bar runs over it,
   then the new-record form opens already filled in; the scanned file is kept as a document. */
(function () {
  "use strict";
  var U = window.NDUI, D = window.ND;
  var css =
    ".nds-pop{position:fixed;z-index:70;min-width:250px;max-width:calc(100vw - 20px);padding:8px;border-radius:20px;background:linear-gradient(180deg,rgba(255,251,247,.98),rgba(251,236,224,.97));border:1.5px solid #e3b25e;box-shadow:0 0 0 1px rgba(255,236,190,.6) inset,0 0 18px rgba(227,178,94,.55),0 14px 34px rgba(40,4,12,.45);font-family:'Roboto Condensed',system-ui,sans-serif;transform-origin:top right;animation:ndsIn .18s ease-out}" +
    "@keyframes ndsIn{from{opacity:0;transform:translateY(-6px) scale(.97)}to{opacity:1;transform:none}}" +
    ".nds-pop[hidden]{display:none}" +
    ".nds-pop button{display:flex;align-items:center;gap:12px;width:100%;min-height:48px;padding:8px 14px;border:0;border-radius:14px;background:transparent;color:#4e0912;font:700 16px/1.15 'Roboto Condensed',sans-serif;text-align:left;cursor:pointer}" +
    ".nds-pop button+button{margin-top:4px}" +
    ".nds-pop button:hover,.nds-pop button:focus-visible{background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1px rgba(227,178,94,.6),0 0 10px rgba(255,214,150,.6);outline:0}" +
    ".nds-pop button .ib{flex:0 0 auto;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:#fff3dc;background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);box-shadow:0 0 0 1.5px #edc47a,0 0 10px rgba(255,190,120,.55)}" +
    ".nds-pop button .ib svg{width:19px;height:19px}" +
    ".nds-pop button small{display:block;font:400 12.5px/1.2 'Roboto Condensed',sans-serif;color:#6b4a40;margin-top:2px}" +
    ".nds-pop .back{min-height:34px;font-size:13px;color:#8d1530}" +
    ".nds-pop h4{margin:4px 8px 8px;font:700 15px/1 Georgia,serif;color:#6b0a1c}" +
    ".nds-ov{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:18px;background:radial-gradient(120% 90% at 50% 0%,rgba(154,26,51,.6),rgba(30,3,9,.88));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}" +
    ".nds-ov[hidden]{display:none}" +
    ".nds-card{width:min(420px,100%);padding:16px 16px 18px;border-radius:26px;background:linear-gradient(160deg,rgba(255,250,246,.97),rgba(251,236,224,.94));border:1.5px solid #e3b25e;box-shadow:0 0 26px rgba(227,178,94,.55),0 24px 60px rgba(30,0,8,.6);text-align:center;font-family:'Roboto Condensed',sans-serif}" +
    ".nds-card h3{margin:2px 0 12px;font:700 21px/1.15 Georgia,serif;color:#6b0a1c}" +
    ".nds-doc{position:relative;height:min(52vh,420px);border-radius:18px;overflow:hidden;background:#1d0a0e center/contain no-repeat;box-shadow:0 0 0 2px #e3b25e,0 0 16px rgba(227,178,94,.55)}" +
    ".nds-doc.pdf{display:grid;place-items:center;background:linear-gradient(180deg,#fffdf9,#f3e1d1);color:#8d1530;font:700 18px 'Roboto Condensed',sans-serif}" +
    ".nds-doc.pdf svg{width:70px;height:70px;display:block;margin:0 auto 8px}" +
    ".nds-doc:before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(243,207,134,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(243,207,134,.12) 1px,transparent 1px);background-size:22px 22px;pointer-events:none}" +
    ".nds-bar{position:absolute;left:-4%;right:-4%;height:3px;top:0;background:linear-gradient(90deg,transparent,#f3cf86 15%,#fff6d8 50%,#f3cf86 85%,transparent);box-shadow:0 0 14px 4px rgba(243,207,134,.85),0 0 40px 10px rgba(180,36,70,.45);animation:ndsScan 1.7s ease-in-out infinite alternate}" +
    ".nds-bar:after{content:'';position:absolute;left:0;right:0;bottom:3px;height:70px;background:linear-gradient(0deg,rgba(243,207,134,.28),transparent)}" +
    ".nds-bar.down:after{bottom:auto;top:3px;background:linear-gradient(180deg,rgba(243,207,134,.28),transparent)}" +
    "@keyframes ndsScan{from{top:2%}to{top:97%}}" +
    ".nds-st{margin:14px 4px 4px;font:700 16px/1.3 'Roboto Condensed',sans-serif;color:#4e0912;min-height:42px}" +
    ".nds-st small{display:block;font-weight:400;font-size:13px;color:#6b4a40;margin-top:3px}" +
    ".nds-x{margin-top:10px;height:42px;padding:0 22px;border-radius:21px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;font:700 15px 'Roboto Condensed',sans-serif;cursor:pointer}";
  var I = {
    pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 13H8M16 17H8M16 13h-2"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3"/></svg>'
  };
  function boot() { if (document.getElementById("nds-css")) return; var s = document.createElement("style"); s.id = "nds-css"; s.textContent = css; document.head.appendChild(s); }

  var pop = null, ctxKind = "client", handlers = null;
  function item(ic, t, sub, act) { return '<button type="button" data-a="' + act + '"><span class="ib">' + ic + "</span><span>" + t + (sub ? "<small>" + sub + "</small>" : "") + "</span></button>"; }
  function render(level) {
    var what = ctxKind === "property" ? "имот" : "клиент";
    pop.innerHTML = level === 2
      ? "<h4>Сканиране на " + what + "</h4>" +
        item(I.img, "Качи снимка от галерия", "Снимка от телефона", "gallery") +
        item(I.file, "Файл", "PDF или снимка от файловете", "file") +
        item(I.cam, "Снимай на момента", "Отваря камерата", "camera") +
        '<button type="button" class="back" data-a="back">‹ Назад</button>'
      : item(I.pen, "Добави ръчно", "Попълване на картата", "manual") +
        item(I.scan, "Сканиране на " + what, "Лична карта, визитка, бележка, обява, документ…", "scan");
  }
  function place(anchor) {
    var r = anchor.getBoundingClientRect(), w = pop.offsetWidth;
    var left = Math.min(Math.max(10, r.right - w), innerWidth - w - 10), top = r.bottom + 8;
    if (top + pop.offsetHeight > innerHeight - 10) top = Math.max(10, r.top - pop.offsetHeight - 8);
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  function close() { if (pop) pop.hidden = true; }
  function pick(mode) {
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = mode === "file" ? "image/*,application/pdf" : "image/*";
    if (mode === "camera") inp.setAttribute("capture", "environment");
    inp.style.cssText = "position:fixed;left:-999px;top:0;opacity:0";
    document.body.appendChild(inp);
    inp.onchange = function () { var f = inp.files && inp.files[0]; inp.remove(); if (f) scan(f); };
    inp.click();
  }
  function menu(anchor, kind, h) {
    boot(); ctxKind = kind; handlers = h;
    if (!pop) {
      pop = document.createElement("div"); pop.className = "nds-pop"; pop.setAttribute("role", "menu"); document.body.appendChild(pop);
      pop.addEventListener("click", function (e) {
        var b = e.target.closest("[data-a]"); if (!b) return; e.stopPropagation();
        var a = b.getAttribute("data-a");
        if (a === "manual") { close(); handlers.manual(); }
        else if (a === "scan") { render(2); place(pop._anchor); }
        else if (a === "back") { render(1); place(pop._anchor); }
        else { close(); pick(a); }
      });
      document.addEventListener("click", function (e) { if (pop && !pop.hidden && !pop.contains(e.target) && e.target !== pop._anchor && !(pop._anchor && pop._anchor.contains(e.target))) close(); }, true);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
      addEventListener("resize", close);
    }
    if (!pop.hidden && pop._anchor === anchor) { close(); return; }
    pop._anchor = anchor; render(1); pop.hidden = false; place(anchor);
  }

  /* ---------- prepare the file: photos are resized to keep the upload small ---------- */
  function readAsDataURL(blob) { return new Promise(function (ok, bad) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = bad; r.readAsDataURL(blob); }); }
  function prepare(file) {
    if (file.type === "application/pdf") {
      if (file.size > 4 * 1024 * 1024) return Promise.reject(new Error("PDF файлът е по-голям от 4 MB."));
      return readAsDataURL(file).then(function (u) { return { mime: "application/pdf", data: u.split(",")[1], preview: null }; });
    }
    return readAsDataURL(file).then(function (url) {
      return new Promise(function (ok) {
        var im = new Image();
        im.onload = function () {
          var max = 1800, k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas");
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          var out = c.toDataURL("image/jpeg", 0.86);
          ok({ mime: "image/jpeg", data: out.split(",")[1], preview: out });
        };
        im.onerror = function () { ok({ mime: file.type || "image/jpeg", data: url.split(",")[1], preview: url }); };
        im.src = url;
      });
    });
  }

  /* ---------- scanning overlay ---------- */
  var ov = null, stT = null;
  function showOverlay(prep, name) {
    boot();
    if (!ov) { ov = document.createElement("div"); ov.className = "nds-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Сканиране"); document.body.appendChild(ov); }
    var what = ctxKind === "property" ? "имот" : "клиент";
    ov.innerHTML = '<div class="nds-card"><h3>Сканиране на ' + what + "</h3>" +
      (prep.preview ? '<div class="nds-doc" style="background-image:url(' + prep.preview + ')"><div class="nds-bar"></div></div>'
        : '<div class="nds-doc pdf"><div>' + I.file + U.esc(name || "Документ") + '</div><div class="nds-bar"></div></div>') +
      '<div class="nds-st" aria-live="polite">Разпознаване на текста…</div><button type="button" class="nds-x">Отказ</button></div>';
    ov.hidden = false;
    var steps = ["Разпознаване на текста…", "Откриване на имена и телефони…", "Извличане на данните…", "Попълване на картата…"], i = 0;
    clearInterval(stT); stT = setInterval(function () { i = Math.min(i + 1, steps.length - 1); var s = ov.querySelector(".nds-st"); if (s) s.firstChild.nodeValue = steps[i]; }, 1900);
    var bar = ov.querySelector(".nds-bar"); bar.addEventListener("animationiteration", function () { bar.classList.toggle("down"); });
    return new Promise(function (ok) { ov.querySelector(".nds-x").onclick = function () { ok("cancel"); }; });
  }
  function hideOverlay() { clearInterval(stT); if (ov) ov.hidden = true; }

  function scan(file) {
    var cancelled = false;
    prepare(file).then(function (prep) {
      showOverlay(prep, file.name).then(function () { cancelled = true; hideOverlay(); });
      return D.token().then(function (tok) {
        return fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ kind: ctxKind, mime: prep.mime, data: prep.data, name: file.name }) });
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (cancelled) return;
        hideOverlay();
        if (!j.ok) { D.say(j.error || "Сканирането не успя"); return; }
        var f = j.fields || {};
        var found = Object.keys(f).filter(function (k) { return f[k] != null && f[k] !== "" && k !== "summary"; }).length;
        D.say(found ? "Разпознати данни: " + found + " полета" : "Не открих данни – попълнете ръчно");
        handlers.scanned(f, file);
      });
    }).catch(function (e) { hideOverlay(); if (!cancelled) D.say("Грешка при сканиране: " + ((e && e.message) || e)); });
  }

  window.NDScan = { menu: menu, close: close };
})();
