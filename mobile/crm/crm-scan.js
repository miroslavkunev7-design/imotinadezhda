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
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6M9 13h6"/></svg>',
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
        (ctxKind === "property" ? item(I.folder, "Прикачи папка", "Снимки, видеа и опис на имота", "folder") : "") +
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
  var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function pick(mode) {
    var inp = document.createElement("input");
    if (mode === "folder") {
      inp.type = "file"; inp.multiple = true;
      if ("webkitdirectory" in inp) { inp.webkitdirectory = true; inp.setAttribute("webkitdirectory", ""); inp.setAttribute("directory", ""); } /* the whole folder */
      else inp.accept = "image/*,video/*,.zip,.txt,.md,.rtf,.doc,.docx,.pdf,text/plain,application/pdf,application/zip";
      inp.style.cssText = "position:fixed;left:-999px;top:0;opacity:0";
      document.body.appendChild(inp);
      inp.onchange = function () { var fs = [].slice.call(inp.files || []);  inp.remove(); if (fs.length) folderScan(fs); };
      inp.click(); return;
    }
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
  function prepare(file, maxSide) {
    if (file.type === "application/pdf") {
      if (file.size > 4 * 1024 * 1024) return Promise.reject(new Error("PDF файлът е по-голям от 4 MB."));
      return readAsDataURL(file).then(function (u) { return { mime: "application/pdf", data: u.split(",")[1], preview: null }; });
    }
    return readAsDataURL(file).then(function (url) {
      return new Promise(function (ok) {
        var im = new Image();
        im.onload = function () {
          var max = maxSide || 1800, k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas");
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
  function showOverlay(prep, name, mode) {
    boot();
    if (!ov) { ov = document.createElement("div"); ov.className = "nds-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Сканиране"); document.body.appendChild(ov); }
    var what = ctxKind === "property" ? "имот" : "клиент";
    ov.innerHTML = '<div class="nds-card"><h3>' + (mode === "folder" ? "Анализ на папката" : "Сканиране на " + what) + "</h3>" +
      (prep.preview ? '<div class="nds-doc" style="background-image:url(' + prep.preview + ')"><div class="nds-bar"></div></div>'
        : '<div class="nds-doc pdf"><div>' + (mode === "folder" ? I.folder : I.file) + U.esc(name || "Документ") + '</div><div class="nds-bar"></div></div>') +
      '<div class="nds-st" aria-live="polite">Разпознаване на текста…</div><button type="button" class="nds-x">Отказ</button></div>';
    ov.hidden = false;
    var steps = mode === "folder" ? ["Четене на описа…", "Цена от името на папката…", "Град, квартал, площ, етаж…", "AI описание без точен адрес…", "Попълване на картата…"]
      : ["Разпознаване на текста…", "Откриване на имена и телефони…", "Извличане на данните…", "Попълване на картата…"], i = 0;
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


  /* ---------- "Прикачи папка": photos + videos + опис of one property ---------- */
  var PHONE_RE = /(?:\+|00)?(?:359[\s\-\/.]*|0)\(?\d{2,3}\)?(?:[\s\-\/.]*\d){5,7}/g;
  var AGENCY_PHONE = "0898977370";
  function publicText(t) { return String(t || "").replace(PHONE_RE, AGENCY_PHONE); }
  /* the owner's price: the smaller price written in the опис (the folder name holds the official one) */
  /* the neighbourhood named in the опис or the folder name, from the site's own list for that city */
  function hoodIn(t, city) {
    var P = window.NDPlaces; if (!P || !t) return "";
    var c = P.city(city || ""), lists = c && P.PLACES[c] ? [[c, P.PLACES[c]]] : Object.keys(P.PLACES).map(function (k) { return [k, P.PLACES[k]]; });
    var k = P.key(t), best = "";
    lists.forEach(function (L) { L[1].forEach(function (h) { var hk = P.key(h); if (hk.length > 3 && k.indexOf(hk) >= 0 && hk.length > best.length) best = h; }); });
    if (!best) { var m = k.match(/(?:кв\.?|квартал|ж\.?к\.?|жк)\s*([а-яa-z0-9 .\-]{3,30})/); if (m) best = P.hood(c || "Шумен", m[1].trim()); }
    return best;
  }
  function pricesIn(t) {
    var out = [], re = /(\d{1,3}(?:[ \u00a0.]\d{3})+|\d{4,7})(?:[,.](\d{1,2}))?\s*(?:€|eur|евро|e|лв\.?|лева|bgn|k|к|хил\.?)?/gi, m;
    while ((m = re.exec(t))) {
      var raw = m[0], v = Number(m[1].replace(/[ \u00a0.]/g, ""));
      if (/(k|к|хил)/i.test(raw.slice(m[1].length))) v *= 1000;
      if (/(лв|лева|bgn)/i.test(raw)) v = Math.round(v / 1.95583);
      if (v >= 3000 && v <= 5000000) out.push(v);
    }
    var re2 = /(?:^|[^\d])(\d{2,3})\s*(?:k|к|хил\.?)(?![\wа-я])/gi;
    while ((m = re2.exec(t))) out.push(Number(m[1]) * 1000);
    return out;
  }
  function ownerPriceOf(text, official, aiOwner) {
    var c = pricesIn(text || "").filter(function (v) { return !official || (v < official && v >= official * 0.5); });
    var min = c.length ? Math.min.apply(null, c) : null, ai = Number(aiOwner) || null;
    if (ai && official && ai >= official) ai = null;
    if (ai && min) return Math.min(ai, min);
    return ai || min || null;
  }
  function phonesIn(t) { return (String(t || "").match(PHONE_RE) || []).map(function (x) { return x.replace(/[^\d+]/g, ""); }).filter(function (x, i, a) { return a.indexOf(x) === i && x.replace(/\D/g, "") !== AGENCY_PHONE.slice(1) && x !== AGENCY_PHONE; }); }
  function priceFromName(n) {
    var s = String(n || "").replace(/\.(\w{2,4})$/, ""), best = 0, m, re = /(\d{1,3}(?:[ ., ]\d{3})+|\d+)\s*(к|k|хил\.?)?/gi;
    while ((m = re.exec(s))) { var v = Number(m[1].replace(/[ ., ]/g, "")); if (m[2]) v *= 1000; if (v >= 1000 && v > best) best = v; }
    return best || null;
  }
  function loadScript(src) { return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error("Не успях да заредя " + src)); }; document.head.appendChild(s); }); }
  function docxText(file) {
    return (window.JSZip ? Promise.resolve() : loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js")).then(function () {
      return window.JSZip.loadAsync(file); }).then(function (z) { var x = z.file("word/document.xml"); return x ? x.async("string") : ""; })
      .then(function (xml) { return xml.replace(/<w:tab\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'"); });
  }
  function isImg(f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name); }
  function isVid(f) { return /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name); }
  function isDoc(f) { return /\.(txt|md|rtf|docx?|pdf)$/i.test(f.name) || /^text\//.test(f.type) || f.type === "application/pdf"; }
  /* a .zip of the folder (iPhone: Файлове → задръжте папката → Компресирай) is unpacked here */
  function setRel(f, rel) { try { Object.defineProperty(f, "webkitRelativePath", { value: rel }); } catch (e) {} return f; }
  function expandZips(files) {
    var zips = files.filter(function (f) { return /\.zip$/i.test(f.name) || f.type === "application/zip" || f.type === "application/x-zip-compressed"; });
    if (!zips.length) return Promise.resolve(files);
    var rest = files.filter(function (f) { return zips.indexOf(f) < 0; });
    return (window.JSZip ? Promise.resolve() : loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js")).then(function () {
      return Promise.all(zips.map(function (z) {
        return window.JSZip.loadAsync(z).then(function (zip) {
          var base = z.name.replace(/\.zip$/i, ""), ents = [];
          zip.forEach(function (path, e) { if (!e.dir && !/(^|\/)(__MACOSX|\.)/.test(path)) ents.push(e); });
          var tops = ents.map(function (e) { return e.name.split("/")[0]; }), oneTop = ents.length && ents.every(function (e) { return e.name.indexOf("/") > 0; }) && tops.every(function (t) { return t === tops[0]; });
          return Promise.all(ents.map(function (e) {
            return e.async("blob").then(function (b) {
              var nm = e.name.split("/").pop(), ext = (nm.split(".").pop() || "").toLowerCase();
              var mime = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", mp4: "video/mp4", mov: "video/quicktime", m4v: "video/mp4", pdf: "application/pdf", txt: "text/plain", md: "text/plain",
                docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword", rtf: "application/rtf" }[ext] || "";
              return setRel(new File([b], nm, { type: mime }), oneTop ? e.name : base + "/" + e.name);
            });
          }));
        });
      }));
    }).then(function (lists) { return rest.concat.apply(rest, lists); });
  }
  function docText(file) { /* old Word .doc: pull the readable text out of the binary */
    return file.arrayBuffer().then(function (buf) {
      var u16 = new TextDecoder("utf-16le").decode(buf), runs = u16.match(/[\u0020-\u007E\u0400-\u04FF\u00A0-\u00FF\u2010-\u201E\r\n\t]{8,}/g) || [];
      return runs.filter(function (r) { return /[А-Яа-я]{3}/.test(r) || /\d{3}/.test(r); }).join("\n").replace(/\r/g, "\n").slice(0, 30000);
    }).catch(function () { return ""; });
  }
  function folderScan(files) {
    expandZips(files).then(folderScan2).catch(function (e) { D.say("Не успях да отворя архива: " + ((e && e.message) || e)); });
  }
  function folderScan2(files) {
    files = files.filter(function (f) { return !/(^|\/)\./.test(f.webkitRelativePath || f.name); });
    files.sort(function (a, b) { return (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, "bg", { numeric: true }); });
    var rel = (files[0] && files[0].webkitRelativePath) || "", folder = rel.indexOf("/") > 0 ? rel.split("/")[0] : "";
    var allImgs = files.filter(isImg), imgs = allImgs.slice(0, 100), allVids = files.filter(isVid), vids = allVids.slice(0, 10), docs = files.filter(function (f) { return !isImg(f) && !isVid(f) && isDoc(f); });
    if (!imgs.length && !docs.length) { D.say("В папката няма снимки или опис"); return; }
    var price = priceFromName(folder) || (docs[0] && priceFromName(docs[0].name)) || null;
    var cancelled = false, pdf = null;
    var texts = docs.map(function (f) {
      if (/\.docx$/i.test(f.name)) return docxText(f).catch(function () { return ""; });
      if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") { if (!pdf && f.size <= 3 * 1024 * 1024) pdf = f; return Promise.resolve(""); }
      if (/\.doc$/i.test(f.name)) return docText(f);
      return f.text().then(function (t) { return /\.rtf$/i.test(f.name) ? t.replace(/\\par[d]?/g, "\n").replace(/\{\*?\\[^{}]+}|[{}]|\\[a-z]+-?\d* ?/gi, "") : t; }).catch(function () { return ""; });
    });
    var opisImgs = imgs.filter(function (f) { return /опис|opis|описание|notes?|бележк/i.test(f.name); });
    var samples = opisImgs.concat(imgs.filter(function (f) { return opisImgs.indexOf(f) < 0; })).slice(0, docs.length ? 3 : 4).map(function (f) { return prepare(f, 1200).catch(function () { return null; }); });
    Promise.all([Promise.all(texts), Promise.all(samples), pdf ? prepare(pdf) : null]).then(function (r) {
      var text = r[0].filter(Boolean).join("\n\n").trim().slice(0, 30000), pics = r[1].filter(Boolean), pdfPrep = r[2];
      showOverlay(pics[0] || { preview: null }, folder || (docs[0] && docs[0].name) || "Папка на имот", "folder").then(function () { cancelled = true; hideOverlay(); });
      var body = { kind: "folder", folder: folder, text: text, images: pics.map(function (x) { return { mime: x.mime, data: x.data }; }) };
      if (pdfPrep) { body.mime = pdfPrep.mime; body.data = pdfPrep.data; body.name = pdf.name; }
      return D.token().then(function (tok) {
        return fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify(body) });
      }).then(function (x) { return x.json(); }).then(function (j) {
        if (cancelled) return;
        hideOverlay();
        var f = (j && j.ok && j.fields) || {};
        if (!j.ok) D.say((j.error || "Анализът не успя") + " – попълнете ръчно");
        var phones = phonesIn(text).concat([].concat(f.ownerPhones || f.ownerPhone || []).map(String)).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
        var out = {
          title: f.title, deal: f.deal, type: f.type, area: f.area, rooms: f.rooms, beds: f.beds, baths: f.baths, floor: f.floor, year: f.year, build: f.build,
          region: f.region, city: f.city, hood: f.hood || hoodIn(text + " " + (folder || ""), f.city), address: f.address, client: f.ownerName || f.client,
          expo: f.expo, heat: f.heat, parking: f.parking, elevator: f.elevator, terraces: f.terraces, act: f.act, features: f.features, cond: f.cond,
          price: price || f.officialPrice || f.price || null, ownerPrice: ownerPriceOf(text, price || f.officialPrice || f.price || null, f.ownerPrice),
          desc: publicText(f.publicDesc || f.desc || ""), privDesc: text || f.privateDesc || "", ownerPhone: phones.join(", "),
          summary: null
        };
        D.say("Папка: " + imgs.length + " снимки" + (vids.length ? ", " + vids.length + " видеа" : "") + (text || pdf ? ", опис прочетен" : "") +
          (allImgs.length > 100 ? " · взети първите 100 снимки" : "") + (allVids.length > 10 ? " · взети първите 10 видеа" : ""));
        handlers.scanned(out, null, { pics: imgs, videos: vids, docs: docs, folder: folder });
      });
    }).catch(function (e) { hideOverlay(); if (!cancelled) D.say("Грешка при папката: " + ((e && e.message) || e)); });
  }

  /* logo on every photo of a property from a folder (bottom right), resized to max 2000 px */
  var logoP = null;
  function logo() { return logoP || (logoP = new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = "/mobile/home-assets/logo-roofs.svg"; })); }
  function watermark(file) {
    return Promise.all([readAsDataURL(file), logo()]).then(function (r) {
      return new Promise(function (ok) {
        var im = new Image();
        im.onload = function () {
          var k = Math.min(1, 2000 / Math.max(im.width, im.height)), c = document.createElement("canvas"), W = c.width = Math.round(im.width * k), H = c.height = Math.round(im.height * k), g = c.getContext("2d");
          g.drawImage(im, 0, 0, W, H);
          var u = Math.max(W, H) / 1000, bw = 250 * u, bh = 74 * u, x = W - bw - 22 * u, y = H - bh - 22 * u;
          g.globalAlpha = 0.82; g.fillStyle = "#fffaf3"; g.beginPath();
          if (g.roundRect) g.roundRect(x, y, bw, bh, 16 * u); else g.rect(x, y, bw, bh); g.fill();
          g.globalAlpha = 1; g.strokeStyle = "#e2a33b"; g.lineWidth = 2.5 * u; g.stroke();
          if (r[1]) g.drawImage(r[1], x + 10 * u, y + 13 * u, 74 * u, 48 * u);
          g.fillStyle = "#680019"; g.textBaseline = "middle"; g.font = "700 " + Math.round(25 * u) + "px Georgia, serif";
          g.fillText("ИМОТИ", x + 94 * u, y + 25 * u); g.fillText("НАДЕЖДА", x + 94 * u, y + 52 * u);
          c.toBlob(function (b) { ok(b ? new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file); }, "image/jpeg", 0.88);
        };
        im.onerror = function () { ok(file); };
        im.src = r[0];
      });
    }).catch(function () { return file; });
  }
  window.NDScan = { menu: menu, close: close, watermark: watermark, publicText: publicText, folder: function (files, h) { if (h) { handlers = h; ctxKind = "property"; } folderScan(files); } };
})();
