/* Тед skill „AI Видео на имот“ – двата похвата от обучителните видеа, 1:1:
   • Разходка: снимките се подреждат като маршрут и се генерират клипове по двойки с припокриване (1+2, 2+3, 3+4…),
     първа снимка = първи кадър, втора = последен кадър, с промпта на автора + посоката на камерата за тази стъпка.
   • Строеж: от снимката на готовия имот → „празен парцел“ (master environment) → сценарий по клипове във формата
     CLIP N — … / Start / Transformation / End / Continuity / Prompt ([MASTER ENVIRONMENT LOCK]. [CAMERA LOCK]. …) →
     всеки клип тръгва от последния кадър на предишния, последният завършва точно на реалната снимка.
   Генерирането е на сървъра (/api/video – Google Omni Flash или Sora 2); сглобяването и надписът „AI визуализация“ – тук. */
(function () {
  "use strict";
  var D = window.ND, A = window.NDAsh;
  if (!D || !A) return;
  var esc = A.esc, STORE = "nd-ted-video";
  var css =
    ".ndv{align-self:stretch;flex:none;display:grid;gap:10px;padding:12px;border-radius:18px;background:linear-gradient(160deg,rgba(255,250,246,.97),rgba(251,236,224,.94));border:1px solid rgba(227,178,94,.75);box-shadow:0 0 10px rgba(255,214,150,.4);font:14px/1.35 'Roboto Condensed',Arial,sans-serif;color:#3a0c12;position:relative;overflow:hidden;isolation:isolate}" +
    ".ndv:after{content:'';position:absolute;right:0;top:0;bottom:0;width:46%;background:url(/mobile/crm/assets/nd/ph11.jpg) center/cover;opacity:.22;z-index:-1;-webkit-mask-image:linear-gradient(270deg,#000 20%,transparent);mask-image:linear-gradient(270deg,#000 20%,transparent)}" +
    ".ndv h5{margin:0;font:700 15px 'Roboto Condensed',Arial,sans-serif;color:#6b0a1c;display:flex;align-items:center;gap:8px}.ndv h5 i{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:linear-gradient(180deg,#b42446,#7a0f22);color:#fff3dc;font-style:normal;font-size:12px}" +
    ".ndv label{font:700 12.5px 'Roboto Condensed',Arial,sans-serif;color:#6b0a1c}.ndv select,.ndv textarea,.ndv input[type=text]{width:100%;box-sizing:border-box;border-radius:12px;border:1.5px solid #e3b25e;background:rgba(255,253,250,.95);padding:7px 9px;font:14px/1.3 'Roboto Condensed',Arial,sans-serif;color:#3a0c12}" +
    ".ndv textarea{min-height:92px;resize:vertical;font-size:13px}.ndv .ndv-row4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}" +
    ".ndv .ndv-seg{display:flex;gap:6px}.ndv .ndv-seg button{flex:1;height:36px;border-radius:12px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;font:700 13.5px 'Roboto Condensed',Arial,sans-serif;cursor:pointer}.ndv .ndv-seg button.on{background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);color:#fff3dc;border-color:#edc47a;box-shadow:0 0 10px rgba(255,190,120,.55)}" +
    ".ndv .ndv-ph{display:grid;grid-template-columns:64px 1fr auto;gap:8px;align-items:center;padding:6px;border-radius:14px;background:rgba(255,255,255,.55);border:1px solid rgba(227,178,94,.6)}.ndv .ndv-ph .ndv-im{width:64px;height:64px;border-radius:10px;background:#e9d8c6 center/cover;position:relative}.ndv .ndv-ph .ndv-im b{position:absolute;left:-4px;top:-4px;width:20px;height:20px;border-radius:50%;background:linear-gradient(180deg,#b42446,#7a0f22);color:#fff3dc;font-size:11px;display:grid;place-items:center}" +
    ".ndv .ndv-ph .ndv-bt{display:flex;flex-direction:column;gap:3px}.ndv .ndv-ph .ndv-bt button{width:30px;height:24px;border-radius:8px;border:1px solid #e3b25e;background:#fffaf4;color:#6b0a1c;font-weight:700;cursor:pointer;padding:0}" +
    ".ndv .ndv-act{display:flex;gap:6px;flex-wrap:wrap}.ndv .ndv-act button,.ndv .ndv-act a{flex:1;min-width:96px;height:36px;border-radius:12px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;font:700 13px 'Roboto Condensed',Arial,sans-serif;display:grid;place-items:center;cursor:pointer;text-decoration:none}.ndv .ndv-act .pr{background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);color:#fff3dc;border-color:#edc47a}.ndv .ndv-act button:disabled{opacity:.55;cursor:default}" +
    ".ndv .ndv-clip{display:grid;gap:6px;padding:8px;border-radius:14px;background:rgba(255,255,255,.6);border:1px solid rgba(227,178,94,.65)}.ndv .ndv-clip .ndv-hd{display:flex;align-items:center;gap:8px;font-weight:700;color:#4e0912}.ndv .ndv-clip .ndv-hd .ndv-st{margin-left:auto;padding:2px 9px;border-radius:9px;font-size:11.5px;font-weight:700;color:#fff3dc;background:linear-gradient(180deg,#9c8574,#6d5a4c)}.ndv .ndv-clip .ndv-hd .ndv-st.ok{background:linear-gradient(180deg,#4f9a2a,#2b6a10)}.ndv .ndv-clip .ndv-hd .ndv-st.run{background:linear-gradient(180deg,#e0a02c,#b0730e);animation:ndvPulse 1.2s ease-in-out infinite}.ndv .ndv-clip .ndv-hd .ndv-st.err{background:linear-gradient(180deg,#c8233f,#7a0f22)}" +
    ".ndv .ndv-clip .ndv-fr{display:flex;gap:6px;align-items:center;font-size:12.5px;color:#6b4a40}.ndv .ndv-clip .ndv-fr span{width:38px;height:38px;border-radius:8px;background:#e9d8c6 center/cover;border:1px solid rgba(227,178,94,.6)}.ndv .ndv-clip .ndv-bg{font-size:12.5px;color:#6b4a40}.ndv .ndv-clip video{width:100%;max-height:300px;border-radius:12px;background:#000}" +
    ".ndv .ndv-img{width:100%;max-height:260px;object-fit:contain;border-radius:12px;background:#f1e2d2;display:block}.ndv .ndv-note{font-size:12.5px;color:#6b4a40}.ndv .ndv-cost{font-weight:700;color:#8d1530}.ndv .ndv-err{color:#a1122c;font-weight:700;font-size:13px}" +
    "@keyframes ndvPulse{0%,100%{opacity:1}50%{opacity:.55}}.ndv-f{grid-template-columns:repeat(4,1fr)!important}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var I = {
    walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    build: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20M4 20V8l6-4v16M10 20V12l6-3v11M16 20v-6l4-2v8"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
  };

  /* ---------- промптовете (дословно от видеата; редактират се преди генериране) ---------- */
  var ROOMS = [["out", "Отвън", "outside"], ["entry", "Вход", "the entrance"], ["living", "Хол", "the living room"], ["dining", "Трапезария", "the dining area"], ["kitchen", "Кухня", "the kitchen"], ["stairs", "Стълбище", "the staircase"], ["bedroom", "Спалня", "the bedroom"], ["bath", "Баня", "the bathroom"], ["patio", "Тераса", "the covered patio"], ["pool", "Басейн", "the pool"], ["garden", "Двор", "the garden"], ["final", "Краен външен кадър", "the final outdoor view"], ["other", "Друго", "the next room"]];
  var WALK_BASE = "Smoothly blend from the first image into the second image and keep the camera stable and make the transitions seamless. Then, follow the camera path through the property.";
  var WALK_ROUTE = "Start outside, move towards the entrance, then go into the living room, kitchen, patio, and finish with a final outdoor view.";
  function roomEn(id) { var r = ROOMS.filter(function (x) { return x[0] === id; })[0]; return r ? r[2] : "the next room"; }
  function move(a, b) {
    if (a === "out" && b === "entry") return "Start outside and move towards the entrance.";
    if (b === "final") return "Move away from " + roomEn(a) + " and finish with a final outdoor view of the property.";
    if (a === "entry") return "Go through the entrance and move inside with a slight turn to the right into " + roomEn(b) + ".";
    if (a === "living" && b === "kitchen") return "Pull back through the living room, then push forward into the kitchen.";
    if (a === "living") return "Pull back through the living room, then glide forward into " + roomEn(b) + ".";
    if (b === "patio") return "Move out from " + roomEn(a) + " onto the covered patio.";
    if (b === "pool") return "Continue outside from " + roomEn(a) + " towards the pool.";
    if (b === "final") return "Move away from " + roomEn(a) + " and finish with a final outdoor view of the property.";
    if (a === "out") return "Start outside and move towards " + roomEn(b) + ".";
    return "Move forward from " + roomEn(a) + " into " + roomEn(b) + ".";
  }
  var FIN = "Preserve the exact same architecture, background, environment layout, camera perspective, weather, time of day, and lighting established in the master environment. Do not redesign unrelated parts of the scene.";

  /* ---------- състояние ---------- */
  var S = load(), api0 = null, box = null, running = false, stopFlag = false, engines = null;
  function load() { try { return Object.assign({ mode: "walk", prop: null, photos: [], clips: null, lot: null, set: { engine: "omni", aspect: "9:16", dur: 6, res: "720p" }, final: null }, JSON.parse(sessionStorage.getItem(STORE) || "{}")); } catch (e) { return { mode: "walk", prop: null, photos: [], clips: null, lot: null, set: { engine: "omni", aspect: "9:16", dur: 6, res: "720p" }, final: null }; } }
  function save() { try { sessionStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }
  function vapi(body) { return D.token().then(function (t) { return fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(body) }); }).then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) throw new Error(j.error || "Грешка"); return j; }); }
  function code() { return (S.prop && (S.prop.code || S.prop.id)) || "misc"; }
  function base() { return "ted/video/" + String(code()).replace(/[^\w\-а-яА-Я]+/g, "_") + "/"; }
  function dollars() { var n = S.clips ? S.clips.length : Math.max(0, S.photos.length - 1); return (n * (+S.set.dur || 6) * 0.10).toFixed(2).replace(".", ","); }

  /* ---------- клипове ---------- */
  function walkClips() {
    var ph = S.photos; if (ph.length < 2) return null;
    var out = []; for (var i = 0; i < ph.length - 1; i++) {
      var a = ph[i], b = ph[i + 1];
      out.push({ n: i + 1, title: "Клип " + (i + 1) + ": " + roomBg(a.room) + " → " + roomBg(b.room), prompt: WALK_BASE + " " + move(a.room, b.room), first: { path: a.path, url: a.url }, last: { path: b.path, url: b.url }, status: "idle" });
    }
    return out;
  }
  function roomBg(id) { var r = ROOMS.filter(function (x) { return x[0] === id; })[0]; return r ? r[1] : "Друго"; }
  function resetClips() { S.clips = null; S.final = null; save(); }

  /* ---------- рендер ---------- */
  function render() {
    if (!box) return;
    var h = "";
    h += '<h5><i>1</i>Имот и снимки</h5>';
    h += '<select data-prop><option value="">Избери имот от CRM…</option>' + (render.props || []).map(function (p) { return '<option value="' + esc(p.id) + '"' + (S.prop && S.prop.id === p.id ? " selected" : "") + ">" + esc((p.code ? p.code + " · " : "") + (p.title || "Без заглавие") + (p.city ? " · " + p.city : "")) + "</option>"; }).join("") + "</select>";
    if (S.mode === "walk") {
      h += '<div class="ndv-note">Подредете снимките като маршрут: отвън → вход → хол → кухня → тераса → краен външен кадър. Зле подредени снимки AI не ги оправя. За всяка снимка изберете какво показва – от това се сглобява посоката на камерата.</div>';
      h += S.photos.map(function (p, i) { return '<div class="ndv-ph" data-i="' + i + '"><span class="ndv-im" style="background-image:url(' + esc(p.url || "") + ')"><b>' + (i + 1) + '</b></span><select data-room="' + i + '">' + ROOMS.map(function (r) { return '<option value="' + r[0] + '"' + (p.room === r[0] ? " selected" : "") + ">" + r[1] + "</option>"; }).join("") + '</select><span class="ndv-bt"><button type="button" data-up="' + i + '" title="Нагоре">▲</button><button type="button" data-dn="' + i + '" title="Надолу">▼</button><button type="button" data-rm="' + i + '" title="Премахни">✕</button></span></div>'; }).join("");
      h += '<div class="ndv-act"><button type="button" data-a="add">+ Снимки от телефона</button>' + (S.photos.length >= 2 ? '<button type="button" class="pr" data-a="prep">Подготви клиповете (' + (S.photos.length - 1) + ")</button>" : "") + "</div>";
    } else {
      var cover = S.photos[0];
      h += '<div class="ndv-note">Снимка на <b>готовия</b> имот (корицата). От нея правя „празен парцел“ и сценарий по клипове; всеки клип продължава от последния кадър на предишния, а последният завършва точно на реалната снимка.</div>';
      if (cover) h += '<img class="ndv-img" src="' + esc(cover.url || "") + '" alt="">';
      h += '<div class="ndv-act"><button type="button" data-a="add1">' + (cover ? "Друга снимка" : "+ Снимка") + "</button>" + (cover ? '<button type="button" data-a="lot"' + (running ? " disabled" : "") + ">" + (S.lot ? "Нов парцел" : "1. Създай празен парцел") + "</button>" : "") + "</div>";
      if (S.lot) h += '<label>Празен парцел (master environment)</label><img class="ndv-img" src="' + esc(S.lot.url || "") + '" alt="">';
      if (S.lot) h += '<div class="ndv-act"><button type="button" class="pr" data-a="script"' + (running ? " disabled" : "") + ">" + (S.clips ? "Нов сценарий" : "2. Сценарий по клипове") + "</button></div>";
    }
    h += '<h5><i>2</i>Настройки</h5><div class="ndv-row4"><div><label>Двигател</label><select data-set="engine">' + (engines || [{ id: "omni", name: "Google Omni Flash" }]).map(function (e) { return '<option value="' + e.id + '"' + (S.set.engine === e.id ? " selected" : "") + ">" + esc(e.name) + "</option>"; }).join("") + "</select></div>" +
      '<div><label>Формат</label><select data-set="aspect"><option value="9:16"' + (S.set.aspect === "9:16" ? " selected" : "") + '>9:16</option><option value="16:9"' + (S.set.aspect === "16:9" ? " selected" : "") + '>16:9</option></select></div>' +
      '<div><label>Клип</label><select data-set="dur">' + [4, 6, 8, 10].map(function (d) { return '<option value="' + d + '"' + (+S.set.dur === d ? " selected" : "") + ">" + d + " сек</option>"; }).join("") + "</select></div>" +
      '<div><label>Качество</label><select data-set="res"><option value="720p"' + (S.set.res === "720p" ? " selected" : "") + '>720p</option><option value="1080p"' + (S.set.res === "1080p" ? " selected" : "") + ">1080p</option></select></div></div>" +
      '<div class="ndv-note">Ориентировъчна цена: <span class="ndv-cost">≈ ' + dollars() + ' $</span> (платен лимит на Google, ~0,10 $/сек при 720p). Готовото видео носи дискретен надпис „AI визуализация“.</div>';
    if (S.clips) {
      h += '<h5><i>3</i>Клипове и промптове</h5>';
      h += S.clips.map(function (c, i) {
        var stc = c.status === "done" ? "ok" : c.status === "run" || c.status === "wait" ? "run" : c.status === "err" ? "err" : "";
        var stt = c.status === "done" ? "Готов" : c.status === "run" ? "Генерира се…" : c.status === "wait" ? "Чака кадър…" : c.status === "err" ? "Грешка" : "Чака";
        return '<div class="ndv-clip" data-c="' + i + '"><div class="ndv-hd"><span>' + esc(c.title || "Клип " + (i + 1)) + '</span><span class="ndv-st ' + stc + '">' + stt + "</span></div>" +
          (c.bg ? '<div class="ndv-bg">' + esc(c.bg) + "</div>" : "") +
          '<div class="ndv-fr"><span style="background-image:url(' + esc((c.first && c.first.url) || "") + ')"></span>→<span style="background-image:url(' + esc((c.last && c.last.url) || "") + ')"></span><em>' + (c.first && c.last ? "първи + последен кадър" : c.first ? "първи кадър" : "от предишния клип") + "</em></div>" +
          '<textarea data-pr="' + i + '"' + (c.status === "done" || c.status === "run" ? " readonly" : "") + ">" + esc(c.prompt) + "</textarea>" +
          (c.err ? '<div class="ndv-err">' + esc(c.err) + "</div>" : "") +
          (c.url ? '<video src="' + esc(c.url) + '" controls playsinline preload="metadata"></video>' : "") +
          (c.status === "err" || c.status === "done" ? '<div class="ndv-act"><button type="button" data-redo="' + i + '"' + (running ? " disabled" : "") + ">Повтори клипа</button>" + (c.url ? '<a href="' + esc(c.url) + '" target="_blank" rel="noopener">Отвори</a>' : "") + "</div>" : "") + "</div>";
      }).join("");
      var done = S.clips.filter(function (c) { return c.status === "done"; }).length;
      if (done === S.clips.length) {
        h += '<h5><i>4</i>Готово видео</h5>';
        if (S.final) h += '<video src="' + esc(S.final.url) + '" controls playsinline style="width:100%;max-height:360px;border-radius:12px;background:#000"></video>';
        h += '<div class="ndv-act"><button type="button" class="pr" data-a="stitch"' + (running ? " disabled" : "") + ">" + (S.final ? "Сглоби отново" : "Сглоби в едно видео") + "</button>" + (S.final ? '<a href="' + esc(S.final.url) + '" target="_blank" rel="noopener" download="ai-video.' + esc(S.final.ext || "mp4") + '">Свали</a>' : "") + (S.final && S.prop && !S.final.saved ? '<button type="button" data-a="save">Запази в имота</button>' : "") + "</div>";
        if (S.final && S.final.saved) h += '<div class="ndv-note">✔ Записано в картата на имота (раздел „Видеа“).</div>';
      }
    }
    box.innerHTML = h;
  }
  function photosFromProp(p) {
    var paths = (p.pics || []).slice(0, 30); if (!paths.length) { S.photos = []; return Promise.resolve(); }
    return D.fileUrls(paths).then(function (m) { S.photos = paths.map(function (pt, i) { return { path: pt, url: m[pt] || "", room: i === 0 ? "out" : i === paths.length - 1 ? "final" : "other" }; }); });
  }
  function pickFiles(one) {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; if (!one) inp.multiple = true; inp.style.cssText = "position:fixed;left:-999px;top:0;opacity:0"; document.body.appendChild(inp);
    inp.onchange = function () {
      var fs = [].slice.call(inp.files || []); inp.remove(); if (!fs.length) return;
      busy("Качвам снимките…");
      Promise.all(fs.map(function (f, i) { var p = base() + "src-" + Date.now() + "-" + i + ".jpg"; return D.upload(p, f).then(function () { return D.fileUrl(p); }).then(function (u) { return { path: p, url: u, room: "other" }; }); }))
        .then(function (arr) { if (one) S.photos = arr.slice(0, 1); else S.photos = S.photos.concat(arr); if (S.photos.length && S.mode === "walk") { S.photos[0].room = S.photos[0].room === "other" ? "out" : S.photos[0].room; } resetClips(); if (one) { S.lot = null; } save(); render(); }).catch(function (e) { D.say(e.message || "Снимките не се качиха"); }).then(function () { busy(); });
    };
    inp.click();
  }
  var busyEl = null;
  function busy(t) { if (busyEl) { busyEl.remove(); busyEl = null; } if (t && api0) busyEl = api0.add("a", esc(t), "wait"); }

  /* ---------- последен кадър от клип → снимка в нашия bucket ---------- */
  function lastFrame(url) {
    return new Promise(function (ok, no) {
      var v = document.createElement("video"); v.crossOrigin = "anonymous"; v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      var done = false, t = setTimeout(function () { if (!done) { done = true; no(new Error("Кадърът не се зареди")); } }, 25000);
      v.onloadedmetadata = function () { try { v.currentTime = Math.max(0, (v.duration || 1) - 0.08); } catch (e) {} };
      v.onseeked = function () {
        if (done) return; done = true; clearTimeout(t);
        try { var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0); c.toBlob(function (b) { b ? ok(b) : no(new Error("Кадърът не се записа")); }, "image/jpeg", 0.92); } catch (e) { no(e); }
      };
      v.onerror = function () { if (!done) { done = true; clearTimeout(t); no(new Error("Видеото не се отвори за кадър")); } };
    });
  }
  function frameToStorage(url, n) { var p = base() + "frame-" + n + "-" + Date.now() + ".jpg"; return lastFrame(url).then(function (b) { return D.upload(p, b); }).then(function () { return D.fileUrl(p); }).then(function (u) { return { path: p, url: u }; }); }

  /* ---------- генериране: последователно, клип по клип ---------- */
  function poll(job, savePath) {
    return new Promise(function (ok, no) {
      var t0 = Date.now();
      (function tick() {
        if (stopFlag) return no(new Error("Спряно"));
        vapi({ action: "status", job: job, save: savePath }).then(function (j) { if (j.done) return ok(j); if (Date.now() - t0 > 12 * 60000) return no(new Error("Отне твърде дълго")); setTimeout(tick, 7000); }).catch(function (e) { if (/HTTP 5|Failed to fetch|мрежа/i.test(e.message) && Date.now() - t0 < 12 * 60000) setTimeout(tick, 9000); else no(e); });
      })();
    });
  }
  function runAll() {
    if (running || !S.clips) return; running = true; stopFlag = false; render();
    var orig = S.photos[0];
    var chain = S.clips.reduce(function (pr, c, i) {
      return pr.then(function () {
        if (stopFlag || c.status === "done") return;
        c.err = ""; c.status = "wait"; save(); render();
        var prep = Promise.resolve();
        if (S.mode === "build") {
          if (i === 0) c.first = S.lot ? { path: S.lot.path, url: S.lot.url } : null;
          else { var prev = S.clips[i - 1]; if (!prev.url) throw new Error("Няма предишен клип"); prep = frameToStorage(prev.url, i).then(function (f) { c.first = f; }); }
          c.last = i === S.clips.length - 1 && orig ? { path: orig.path, url: orig.url } : null;
          if (S.set.engine === "sora") c.last = null;
        }
        return prep.then(function () {
          c.status = "run"; save(); render();
          return vapi({ action: "start", engine: S.set.engine, prompt: c.prompt, first: c.first ? { path: c.first.path } : null, last: c.last && S.set.engine !== "sora" ? { path: c.last.path } : null, aspect: S.set.aspect, duration: +S.set.dur, resolution: S.set.res });
        }).then(function (j) { c.job = j.job; save(); return poll(j.job, base() + "clip-" + (i + 1) + "-" + Date.now() + ".mp4"); })
          .then(function (j) { c.path = j.path; c.url = j.url; c.status = "done"; c.job = null; save(); render(); })
          .catch(function (e) { c.status = "err"; c.err = e.message || "Грешка"; save(); render(); if (S.mode === "build" || stopFlag) throw e; });
      });
    }, Promise.resolve());
    chain.catch(function () {}).then(function () { running = false; render(); var d = S.clips.filter(function (c) { return c.status === "done"; }).length; D.say(d === S.clips.length ? "Всички клипове са готови" : "Готови " + d + " от " + S.clips.length + " клипа"); });
  }

  /* ---------- сглобяване в браузъра: клиповете един след друг + надпис „AI визуализация“ ---------- */
  function stitch() {
    var clips = S.clips.filter(function (c) { return c.url; }); if (!clips.length) return;
    running = true; render(); busy("Сглобявам видеото (" + clips.length + " клипа)…");
    var vids = clips.map(function (c) { var v = document.createElement("video"); v.crossOrigin = "anonymous"; v.playsInline = true; v.preload = "auto"; v.src = c.url; v.muted = false; v.volume = 1; return v; });
    Promise.all(vids.map(function (v) { return new Promise(function (ok, no) { v.onloadedmetadata = function () { ok(); }; v.onerror = function () { no(new Error("Клип не се зареди")); }; setTimeout(function () { no(new Error("Клип не се зареди навреме")); }, 30000); }); })).then(function () {
      var W = Math.min(1080, vids[0].videoWidth || 720), H = Math.round(W * (vids[0].videoHeight || 1280) / (vids[0].videoWidth || 720));
      var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var ctx = cv.getContext("2d");
      var stream = cv.captureStream(30), ac = null;
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); var dest = ac.createMediaStreamDestination(); vids.forEach(function (v) { try { ac.createMediaElementSource(v).connect(dest); } catch (e) {} }); dest.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); }); } catch (e) { ac = null; }
      var mime = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].filter(function (m) { return window.MediaRecorder && MediaRecorder.isTypeSupported(m); })[0] || "";
      var rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 }) : new MediaRecorder(stream), chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      var ext = /mp4/.test(rec.mimeType || mime) ? "mp4" : "webm";
      var cur = 0, raf = 0;
      function draw() {
        var v = vids[cur]; if (!v) return;
        ctx.drawImage(v, 0, 0, W, H);
        var fs = Math.round(H * 0.022); ctx.font = "700 " + fs + "px 'Roboto Condensed',Arial,sans-serif"; var tw = ctx.measureText("AI визуализация").width;
        ctx.fillStyle = "rgba(60,10,20,.45)"; roundRect(ctx, W - tw - fs * 2.2, H - fs * 2.6, tw + fs * 1.4, fs * 1.7, fs * 0.85); ctx.fill();
        ctx.fillStyle = "rgba(255,243,220,.95)"; ctx.textBaseline = "middle"; ctx.fillText("AI визуализация", W - tw - fs * 1.5, H - fs * 1.75);
        raf = requestAnimationFrame(draw);
      }
      function playNext() {
        var v = vids[cur]; if (!v) { cancelAnimationFrame(raf); rec.stop(); return; }
        v.onended = function () { cur++; playNext(); };
        var p = v.play(); if (p && p.catch) p.catch(function () { cur++; playNext(); });
      }
      rec.onstop = function () {
        var blob = new Blob(chunks, { type: rec.mimeType || mime || "video/webm" });
        var p = base() + "ai-video-" + Date.now() + "." + ext;
        D.upload(p, blob).then(function () { return D.fileUrl(p); }).then(function (u) { S.final = { path: p, url: u, ext: ext, size: blob.size, mime: blob.type, saved: false }; save(); }).catch(function (e) { D.say("Видеото не се качи: " + (e.message || "")); S.final = { path: "", url: URL.createObjectURL(blob), ext: ext, size: blob.size, mime: blob.type, saved: false, local: true }; })
          .then(function () { if (ac) try { ac.close(); } catch (e) {} running = false; busy(); render(); });
      };
      rec.start(250); draw(); playNext();
    }).catch(function (e) { running = false; busy(); D.say(e.message || "Сглобяването не успя"); render(); });
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function saveToProp() {
    if (!S.final || !S.prop || S.final.local) return;
    D.load("properties").then(function (l) {
      var p = l.filter(function (x) { return x.id === S.prop.id; })[0]; if (!p) throw new Error("Имотът не е намерен");
      p.videos = p.videos || []; p.videos.push({ name: "AI видео – " + (S.mode === "walk" ? "разходка" : "строеж") + "." + S.final.ext, path: S.final.path, size: S.final.size, mime: S.final.mime, at: new Date().toISOString(), ai: true });
      p.log = (p.log || []).slice(0, 49); p.log.unshift({ icon: "camera", text: "Тед: AI видео (" + (S.mode === "walk" ? "разходка" : "строеж") + ", " + S.clips.length + " клипа)", at: new Date().toISOString() });
      return D.put("properties", p);
    }).then(function () { S.final.saved = true; save(); render(); D.say("Видеото е записано в картата на имота"); try { window.dispatchEvent(new CustomEvent("nd-data-changed")); } catch (e) {} }).catch(function (e) { D.say(e.message || "Не се записа"); });
  }

  /* ---------- събития ---------- */
  function bindBox() {
    box.addEventListener("change", function (e) {
      var t = e.target;
      if (t.matches("[data-prop]")) { var p = (render.props || []).filter(function (x) { return x.id === t.value; })[0]; S.prop = p ? { id: p.id, code: p.code, title: p.title, city: p.city } : null; S.lot = null; resetClips(); busy(p ? "Зареждам снимките…" : ""); (p ? photosFromProp(p) : Promise.resolve(S.photos = [])).then(function () { save(); busy(); render(); }); }
      if (t.matches("[data-room]")) { S.photos[+t.getAttribute("data-room")].room = t.value; resetClips(); save(); render(); }
      if (t.matches("[data-set]")) { S.set[t.getAttribute("data-set")] = t.getAttribute("data-set") === "dur" ? +t.value : t.value; save(); render(); }
    });
    box.addEventListener("input", function (e) { var t = e.target; if (t.matches("[data-pr]")) { S.clips[+t.getAttribute("data-pr")].prompt = t.value; save(); } });
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var i;
      if (b.hasAttribute("data-up")) { i = +b.getAttribute("data-up"); if (i > 0) { var x = S.photos.splice(i, 1)[0]; S.photos.splice(i - 1, 0, x); resetClips(); save(); render(); } }
      else if (b.hasAttribute("data-dn")) { i = +b.getAttribute("data-dn"); if (i < S.photos.length - 1) { var y = S.photos.splice(i, 1)[0]; S.photos.splice(i + 1, 0, y); resetClips(); save(); render(); } }
      else if (b.hasAttribute("data-rm")) { S.photos.splice(+b.getAttribute("data-rm"), 1); resetClips(); save(); render(); }
      else if (b.hasAttribute("data-redo")) { var c = S.clips[+b.getAttribute("data-redo")]; c.status = "idle"; c.err = ""; c.url = ""; c.path = ""; S.final = null; save(); render(); }
      else if (b.getAttribute("data-a") === "add") pickFiles(false);
      else if (b.getAttribute("data-a") === "add1") pickFiles(true);
      else if (b.getAttribute("data-a") === "prep") { S.clips = walkClips(); S.final = null; save(); render(); api0.add("a", "Подготвих <b>" + S.clips.length + " клипа</b> по двойки с припокриване (1+2, 2+3…). Прегледайте промптовете – може да ги редактирате – и натиснете „Генерирай“."); }
      else if (b.getAttribute("data-a") === "lot") { busy("Правя празния парцел от снимката…"); vapi({ action: "lot", photo: { path: S.photos[0].path }, save: base() + "lot-" + Date.now() + ".png" }).then(function (j) { S.lot = { path: j.path, url: j.url }; resetClips(); save(); render(); }).catch(function (e) { D.say(e.message); }).then(function () { busy(); }); }
      else if (b.getAttribute("data-a") === "script") { busy("Пиша сценария по клипове…"); var prefs = {}; try { prefs = JSON.parse(localStorage.getItem("nd-ted-prefs") || "{}"); } catch (x2) {} vapi({ action: "script", photo: { path: S.photos[0].path }, title: S.prop && S.prop.title, city: S.prop && S.prop.city, aspect: S.set.aspect, model: prefs.model || "" }).then(function (j) { S.clips = j.clips.map(function (c, k) { return { n: k + 1, title: c.title, bg: c.bg, start: c.start, transformation: c.transformation, end: c.end, continuity: c.continuity, prompt: c.prompt, status: "idle" }; }); S.final = null; save(); render(); api0.add("a", "Сценарий: <b>" + S.clips.length + " клипа</b>" + (j.model ? " (" + esc(j.model) + ")" : "") + ". Всеки клип започва от последния кадър на предишния; последният завършва на реалната снимка. Прегледайте промптовете и натиснете „Генерирай“."); }).catch(function (e) { D.say(e.message); }).then(function () { busy(); }); }
      else if (b.getAttribute("data-a") === "stitch") stitch();
      else if (b.getAttribute("data-a") === "save") saveToProp();
    });
  }

  A.addSkill({
    id: "video", name: "AI Видео на имот", sub: "Разходка по снимки или ускорен строеж – клип по клип",
    intro: function (api) {
      api0 = api;
      api.add("a", "<b>AI Видео на имот</b>\nДва похвата, точно както в обучителните видеа:\n• <b>Разходка</b> – снимките се подреждат като маршрут и се правят клипове по двойки с припокриване (1+2, 2+3…), за да тече като една разходка.\n• <b>Строеж</b> – от снимката на готовия имот: празен парцел → сценарий по клипове ([MASTER ENVIRONMENT LOCK]. [CAMERA LOCK].) → всеки клип продължава предишния.\nПромптовете са запаметени и се виждат преди пускане – редактирайте ги свободно. Накрая сглобявам клиповете в едно видео с надпис „AI визуализация“ и го записвам към имота.");
      box = document.createElement("div"); box.className = "ndv"; api.list().appendChild(box); bindBox(); render();
      D.ready().then(function () { return D.load("properties"); }).then(function (l) { render.props = l.filter(function (p) { return !p.archived; }).sort(function (a, b) { return String(b._updated).localeCompare(String(a._updated)); }).map(function (p) { return { id: p.id, code: p.code, title: p.title, city: p.city, pics: p.pics || [] }; }); render(); }).catch(function () {});
      if (!engines) vapi({ action: "engines" }).then(function (j) { engines = j.engines && j.engines.length ? j.engines : null; if (engines && !engines.some(function (e) { return e.id === S.set.engine; })) S.set.engine = engines[0].id; render(); }).catch(function () {});
    },
    footer: function () {
      return '<div class="nda-f ndv-f"><button type="button" data-a="walk"><span class="ib">' + I.walk + '</span>Разходка</button><button type="button" data-a="build"><span class="ib">' + I.build + '</span>Строеж</button>' +
        '<button type="button" data-a="go"><span class="ib">' + I.play + '</span>Генерирай</button><button type="button" data-a="stop"><span class="ib">' + I.stop + "</span>Стоп</button></div>";
    },
    bind: function (api, el) {
      api0 = api;
      el.querySelector(".nda-f").onclick = function (e) {
        var b = e.target.closest("[data-a]"); if (!b) return; var a = b.getAttribute("data-a");
        if (a === "walk" || a === "build") { if (S.mode !== a) { S.mode = a; S.lot = null; resetClips(); if (a === "build" && S.photos.length > 1) S.photos = S.photos.slice(0, 1); save(); render(); } }
        else if (a === "go") { if (running) return; if (!S.clips) { api.add("a", S.mode === "walk" ? "Първо изберете имот или снимки и натиснете „Подготви клиповете“." : "Първо създайте празния парцел и сценария (бутоните в панела)."); return; } runAll(); }
        else if (a === "stop") { if (running) { stopFlag = true; D.say("Спирам след текущия клип"); } }
      };
    }
  }, 2);
})();
