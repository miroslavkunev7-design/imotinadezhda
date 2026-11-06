/* Тед skill „AI Видео на имот“ – от снимките на обявата прави ЕДНО готово видео.
   • Разходка (похватът от видеото на Market U): снимките се подреждат като маршрут (AI), между всеки две съседни снимки се
     генерира кратък преход (първи кадър = снимка N, последен = снимка N+1), всички части вървят паралелно (по 3), с автоматичен
     повторен опит, и накрая се сглобяват в едно непрекъснато видео – с логото по средата и надпис „AI визуализация“.
   • Строеж: празен парцел → сценарий по клипове ([MASTER ENVIRONMENT LOCK]. [CAMERA LOCK]. …) → всеки клип продължава
     предишния, последният завършва на реалната снимка → едно видео.
   Генерирането е на сървъра (/api/video: Kling 3.0 / Veo през Vercel AI Gateway, Google Omni, Sora); сглобяването е тук.
   Състоянието се пази в localStorage – ако прозорецът се затвори, при отваряне продължава оттам, докъдето е стигнало. */
(function () {
  "use strict";
  var D = window.ND, A = window.NDAsh;
  if (!D || !A) return;
  var esc = A.esc, STORE = "nd-ted-video2", CONC = 3;
  var css =
    ".ndv{align-self:stretch;flex:none;display:grid;gap:10px;padding:12px;border-radius:18px;background:linear-gradient(160deg,rgba(255,250,246,.97),rgba(251,236,224,.94));border:1px solid rgba(227,178,94,.75);box-shadow:0 0 10px rgba(255,214,150,.4);font:14px/1.35 'Roboto Condensed',Arial,sans-serif;color:#3a0c12;position:relative;overflow:hidden;isolation:isolate}" +
    ".ndv:after{content:'';position:absolute;right:0;top:0;bottom:0;width:46%;background:url(/mobile/crm/assets/nd/ph11.jpg) center/cover;opacity:.22;z-index:-1;-webkit-mask-image:linear-gradient(270deg,#000 20%,transparent);mask-image:linear-gradient(270deg,#000 20%,transparent)}" +
    ".ndv h5{margin:0;font:700 15px 'Roboto Condensed',Arial,sans-serif;color:#6b0a1c;display:flex;align-items:center;gap:8px}.ndv h5 i{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:linear-gradient(180deg,#b42446,#7a0f22);color:#fff3dc;font-style:normal;font-size:12px}" +
    ".ndv label{font:700 12.5px 'Roboto Condensed',Arial,sans-serif;color:#6b0a1c}.ndv select,.ndv textarea,.ndv input[type=text]{width:100%;box-sizing:border-box;border-radius:12px;border:1.5px solid #e3b25e;background:rgba(255,253,250,.95);padding:7px 9px;font:14px/1.3 'Roboto Condensed',Arial,sans-serif;color:#3a0c12}" +
    ".ndv textarea{min-height:84px;resize:vertical;font-size:13px}.ndv .ndv-row4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}@media(max-width:420px){.ndv .ndv-row4{grid-template-columns:1fr 1fr}}" +
    ".ndv .ndv-strip{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 6px;scrollbar-width:thin}.ndv .ndv-t{flex:none;width:62px;display:grid;gap:3px;justify-items:center;font-size:10.5px;line-height:1.1;color:#6b4a40;text-align:center}" +
    ".ndv .ndv-t i{position:relative;display:block;width:62px;height:62px;border-radius:12px;background:#e9d8c6 center/cover;box-shadow:0 0 0 1px rgba(227,178,94,.75),0 0 6px rgba(255,214,150,.45)}.ndv .ndv-t i b{position:absolute;left:3px;top:3px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:linear-gradient(180deg,#b42446,#7a0f22);color:#fff3dc;font:700 11px/18px 'Roboto Condensed',Arial,sans-serif;text-align:center;font-style:normal}" +
    ".ndv details{border-radius:14px;border:1px solid rgba(227,178,94,.55);background:rgba(255,255,255,.45);padding:7px 9px}.ndv details>summary{cursor:pointer;font:700 13px 'Roboto Condensed',Arial,sans-serif;color:#6b0a1c;list-style:none;display:flex;align-items:center;gap:6px}.ndv details>summary::-webkit-details-marker{display:none}.ndv details>summary:before{content:'▸';transition:transform .2s}.ndv details[open]>summary:before{transform:rotate(90deg)}.ndv details>div{display:grid;gap:6px;margin-top:8px}" +
    ".ndv .ndv-ph{display:grid;grid-template-columns:48px 1fr auto;gap:8px;align-items:center;padding:5px;border-radius:12px;background:rgba(255,255,255,.55);border:1px solid rgba(227,178,94,.6)}.ndv .ndv-ph .ndv-im{width:48px;height:48px;border-radius:9px;background:#e9d8c6 center/cover;position:relative}.ndv .ndv-ph .ndv-im b{position:absolute;left:-4px;top:-4px;width:19px;height:19px;border-radius:50%;background:linear-gradient(180deg,#b42446,#7a0f22);color:#fff3dc;font-size:11px;display:grid;place-items:center}" +
    ".ndv .ndv-ph .ndv-bt{display:flex;gap:3px}.ndv .ndv-ph .ndv-bt button{width:28px;height:28px;border-radius:8px;border:1px solid #e3b25e;background:#fffaf4;color:#6b0a1c;font-weight:700;cursor:pointer;padding:0}" +
    ".ndv .ndv-act{display:flex;gap:6px;flex-wrap:wrap}.ndv .ndv-act button,.ndv .ndv-act a{flex:1;min-width:96px;height:38px;border-radius:12px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;font:700 13.5px 'Roboto Condensed',Arial,sans-serif;display:grid;place-items:center;cursor:pointer;text-decoration:none;box-shadow:0 0 8px rgba(255,214,150,.35)}.ndv .ndv-act .pr{background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);color:#fff3dc;border-color:#edc47a;box-shadow:0 0 12px rgba(255,190,120,.55)}.ndv .ndv-act .big{height:48px;font-size:16px}.ndv .ndv-act button:disabled{opacity:.55;cursor:default}" +
    ".ndv .ndv-prog{display:grid;gap:7px;padding:10px 11px;border-radius:14px;background:rgba(255,255,255,.62);border:1px solid rgba(227,178,94,.7);box-shadow:0 0 10px rgba(255,214,150,.35)}.ndv .ndv-prog b{font-size:15px;color:#4e0912}.ndv .ndv-bar{height:10px;border-radius:6px;background:rgba(122,15,34,.12);overflow:hidden}.ndv .ndv-bar span{display:block;height:100%;width:0;background:linear-gradient(90deg,#b42446,#e3b25e);box-shadow:0 0 10px rgba(255,190,120,.6);transition:width .5s}" +
    ".ndv .ndv-dots{display:flex;flex-wrap:wrap;gap:4px}.ndv .ndv-dots i{width:12px;height:12px;border-radius:50%;background:#d9c7b6;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}.ndv .ndv-dots i.run{background:#e0a02c;animation:ndvPulse 1.2s ease-in-out infinite}.ndv .ndv-dots i.ok{background:#3f8f22}.ndv .ndv-dots i.err{background:#c8233f}" +
    ".ndv .ndv-part{display:grid;gap:5px;padding:7px;border-radius:12px;background:rgba(255,255,255,.6);border:1px solid rgba(227,178,94,.6)}.ndv .ndv-part .hd{display:flex;align-items:center;gap:8px;font-weight:700;color:#4e0912;font-size:13.5px}.ndv .ndv-part .hd em{margin-left:auto;font-style:normal;padding:1px 8px;border-radius:9px;font-size:11px;color:#fff3dc;background:linear-gradient(180deg,#9c8574,#6d5a4c)}.ndv .ndv-part .hd em.ok{background:linear-gradient(180deg,#4f9a2a,#2b6a10)}.ndv .ndv-part .hd em.run{background:linear-gradient(180deg,#e0a02c,#b0730e)}.ndv .ndv-part .hd em.err{background:linear-gradient(180deg,#c8233f,#7a0f22)}" +
    ".ndv .ndv-part .fr{display:flex;gap:6px;align-items:center;font-size:12px;color:#6b4a40}.ndv .ndv-part .fr span{width:34px;height:34px;border-radius:7px;background:#e9d8c6 center/cover;border:1px solid rgba(227,178,94,.6)}" +
    ".ndv .ndv-final{display:grid;gap:8px}.ndv .ndv-final video{width:100%;max-height:440px;border-radius:14px;background:#000;box-shadow:0 0 0 1.5px #edc47a,0 0 18px rgba(255,214,150,.6)}" +
    ".ndv .ndv-img{width:100%;max-height:240px;object-fit:contain;border-radius:12px;background:#f1e2d2;display:block}.ndv .ndv-note{font-size:12.5px;color:#6b4a40}.ndv .ndv-cost{font-weight:700;color:#8d1530}.ndv .ndv-err{color:#a1122c;font-weight:700;font-size:12.5px}" +
    "@keyframes ndvPulse{0%,100%{opacity:1}50%{opacity:.5}}.ndv-f{grid-template-columns:repeat(4,1fr)!important}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var I = {
    walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    build: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20M4 20V8l6-4v16M10 20V12l6-3v11M16 20v-6l4-2v8"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
  };

  /* ---------- промптовете (запаметени в умението; виждат се и се редактират в „Части и промптове“) ---------- */
  var ROOMS = [["out", "Отвън", "outside"], ["entry", "Вход", "the entrance"], ["living", "Хол", "the living room"], ["dining", "Трапезария", "the dining area"], ["kitchen", "Кухня", "the kitchen"], ["stairs", "Стълбище", "the staircase"], ["bedroom", "Спалня", "the bedroom"], ["bath", "Баня", "the bathroom"], ["patio", "Тераса", "the covered patio"], ["pool", "Басейн", "the pool"], ["garden", "Двор", "the garden"], ["final", "Краен кадър", "the final outdoor view"], ["other", "Друго", "the next room"]];
  var WALK_BASE = "Smoothly blend from the first image into the second image and keep the camera stable and make the transitions seamless. Then, follow the camera path through the property.";
  function roomEn(id) { var r = ROOMS.filter(function (x) { return x[0] === id; })[0]; return r ? r[2] : "the next room"; }
  function roomBg(id) { var r = ROOMS.filter(function (x) { return x[0] === id; })[0]; return r ? r[1] : "Друго"; }
  function move(a, b) {
    if (a === "out" && b === "entry") return "Start outside and move towards the entrance.";
    if (b === "final") return "Move away from " + roomEn(a) + " and finish with a final outdoor view of the property.";
    if (a === "entry") return "Go through the entrance and move inside with a slight turn to the right into " + roomEn(b) + ".";
    if (a === "living" && b === "kitchen") return "Pull back through the living room, then push forward into the kitchen.";
    if (a === "living") return "Pull back through the living room, then glide forward into " + roomEn(b) + ".";
    if (b === "patio") return "Move out from " + roomEn(a) + " onto the covered patio.";
    if (b === "pool") return "Continue outside from " + roomEn(a) + " towards the pool.";
    if (a === "out") return "Start outside and move towards " + roomEn(b) + ".";
    return "Move forward from " + roomEn(a) + " into " + roomEn(b) + ".";
  }

  /* ---------- състояние ---------- */
  function fresh() { return { mode: "walk", prop: null, photos: [], set: { engine: "", aspect: "auto", dur: 5, res: "720p" }, parts: null, lot: null, final: null, auto: false, aspectAuto: "", aspectUsed: "" }; }
  function load() { try { var s = JSON.parse(localStorage.getItem(STORE) || "null"); return s && s.set ? Object.assign(fresh(), s) : fresh(); } catch (e) { return fresh(); } }
  var S = load(), api0 = null, box = null, running = false, stitching = false, stopFlag = false, fatal = "", engines = null, gateway = null, finalBlob = null, stitchInfo = "";
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }
  function vapi(body) { return D.token().then(function (t) { return fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(body) }); }).then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); }).then(function (j) { if (!j.ok) throw new Error(j.error || "Грешка"); return j; }); }
  function sleep(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function code() { return (S.prop && (S.prop.code || S.prop.id)) || "misc"; }
  function base() { return "ted/video/" + String(code()).replace(/[^\w\-а-яА-Я]+/g, "_") + "/"; }
  function eng() { var l = engines || []; return l.filter(function (e) { return e.id === S.set.engine; })[0] || l[0] || { id: S.set.engine || "omni", name: "…", price: 0.1, frames: 2, durs: [3, 4, 5, 6, 7, 8, 9, 10] }; }
  function durFor(e) { var d = +S.set.dur || 5; return (e.durs || [d]).reduce(function (a, x) { return Math.abs(x - d) < Math.abs(a - d) ? x : a; }, (e.durs || [d])[0]); }
  function aspect() { return S.set.aspect === "auto" ? (S.aspectAuto || "16:9") : S.set.aspect; }
  function nParts() { return S.parts ? S.parts.length : (S.mode === "walk" ? Math.max(0, S.photos.length - 1) : 0); }
  function money(v) { return v.toFixed(2).replace(".", ","); }
  function estimate() { var e = eng(), n = nParts(), d = durFor(e); return { n: n, sec: n * d, cost: n * d * (e.price || 0.1), min: Math.max(2, Math.ceil(n / CONC) * 2) }; }
  function leaveGuard(on) { window.onbeforeunload = on ? function () { return "Видеото още се прави – ако затворите, ще продължи при следващото отваряне."; } : null; }

  /* ---------- части ---------- */
  function walkParts() {
    var ph = S.photos; if (ph.length < 2) return null;
    var out = []; for (var i = 0; i < ph.length - 1; i++) {
      var a = ph[i], b = ph[i + 1];
      out.push({ n: i + 1, title: "Част " + (i + 1) + ": " + roomBg(a.room) + " → " + roomBg(b.room), prompt: WALK_BASE + " " + move(a.room, b.room), first: { path: a.path, url: a.url }, last: { path: b.path, url: b.url }, status: "idle" });
    }
    return out;
  }
  function resetParts() { S.parts = null; S.final = null; finalBlob = null; save(); }
  function counts() { var p = S.parts || [], c = { n: p.length, ok: 0, run: 0, err: 0 }; p.forEach(function (x) { if (x.status === "done") c.ok++; else if (x.status === "run") c.run++; else if (x.status === "err") c.err++; }); return c; }

  /* ---------- рендер ---------- */
  function render() {
    if (!box) return;
    var h = "", c = counts(), e = eng(), est = estimate();
    h += "<h5><i>1</i>Имот и снимки</h5>";
    h += '<select data-prop data-nodictate><option value="">Избери имот от CRM…</option>' + (render.props || []).map(function (p) { return '<option value="' + esc(p.id) + '"' + (S.prop && S.prop.id === p.id ? " selected" : "") + ">" + esc((p.code ? p.code + " · " : "") + (p.title || "Без заглавие") + (p.city ? " · " + p.city : "") + " (" + (p.pics || []).length + " снимки)") + "</option>"; }).join("") + "</select>";
    if (S.mode === "walk") {
      if (S.photos.length) h += '<div class="ndv-strip">' + S.photos.map(function (p, i) { return '<span class="ndv-t"><i style="background-image:url(' + esc(p.url || "") + ')"><b>' + (i + 1) + "</b></i>" + esc(roomBg(p.room)) + "</span>"; }).join("") + "</div>";
      h += '<div class="ndv-act"><button type="button" data-a="add">+ Снимки</button>' + (S.photos.length >= 2 ? '<button type="button" data-a="route"' + (running ? " disabled" : "") + ">Подреди автоматично (AI)</button>" : "") + "</div>";
      if (S.photos.length) h += "<details><summary>Промени реда и стаите (" + S.photos.length + " снимки)</summary><div>" + S.photos.map(function (p, i) { return '<div class="ndv-ph"><span class="ndv-im" style="background-image:url(' + esc(p.url || "") + ')"><b>' + (i + 1) + '</b></span><select data-room="' + i + '" data-nodictate>' + ROOMS.map(function (r) { return '<option value="' + r[0] + '"' + (p.room === r[0] ? " selected" : "") + ">" + r[1] + "</option>"; }).join("") + '</select><span class="ndv-bt"><button type="button" data-up="' + i + '" title="Нагоре">▲</button><button type="button" data-dn="' + i + '" title="Надолу">▼</button><button type="button" data-rm="' + i + '" title="Премахни">✕</button></span></div>'; }).join("") + "</div></details>";
    } else {
      var cover = S.photos[0];
      h += '<div class="ndv-note">Снимка на <b>готовия</b> имот. От нея правя празен парцел и сценарий; клиповете продължават един от друг и последният завършва точно на снимката.</div>';
      if (cover) h += '<img class="ndv-img" src="' + esc(cover.url || "") + '" alt="">';
      h += '<div class="ndv-act"><button type="button" data-a="add1">' + (cover ? "Друга снимка" : "+ Снимка") + "</button>" + (cover ? '<button type="button" data-a="lot"' + (running ? " disabled" : "") + ">" + (S.lot ? "Нов парцел" : "1. Създай празен парцел") + "</button>" : "") + "</div>";
      if (S.lot) h += '<label>Празен парцел</label><img class="ndv-img" src="' + esc(S.lot.url || "") + '" alt="">';
      if (S.lot) h += '<div class="ndv-act"><button type="button" data-a="script"' + (running ? " disabled" : "") + ">" + (S.parts ? "Нов сценарий" : "2. Сценарий по клипове") + "</button></div>";
    }
    h += "<h5><i>2</i>Настройки</h5><div class=\"ndv-row4\"><div><label>Двигател</label><select data-set=\"engine\" data-nodictate>" + (engines && engines.length ? engines.map(function (x) { return '<option value="' + x.id + '"' + (e.id === x.id ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") : '<option value="">' + (engines ? "Няма ключ за видео" : "Зареждам…") + "</option>") + "</select></div>" +
      '<div><label>Формат</label><select data-set="aspect" data-nodictate><option value="auto"' + (S.set.aspect === "auto" ? " selected" : "") + ">Авто" + (S.aspectAuto ? " (" + S.aspectAuto + ")" : "") + '</option><option value="9:16"' + (S.set.aspect === "9:16" ? " selected" : "") + '>9:16 вертикално</option><option value="16:9"' + (S.set.aspect === "16:9" ? " selected" : "") + ">16:9 хоризонтално</option></select></div>" +
      '<div><label>Преход</label><select data-set="dur" data-nodictate>' + [3, 4, 5, 6, 8, 10].map(function (d) { return '<option value="' + d + '"' + (+S.set.dur === d ? " selected" : "") + ">" + d + " сек</option>"; }).join("") + "</select></div>" +
      '<div><label>Качество</label><select data-set="res" data-nodictate><option value="720p"' + (S.set.res === "720p" ? " selected" : "") + '>720p</option><option value="1080p"' + (S.set.res === "1080p" ? " selected" : "") + ">1080p</option></select></div></div>";
    if (engines && !engines.length) h += '<div class="ndv-err">Няма ключ за видео. Добавете AI_GATEWAY_API_KEY (Vercel → AI Gateway → API Keys) или платен GEMINI_API_KEY във Vercel → Settings → Environment Variables.</div>';
    else if (est.n) h += '<div class="ndv-note">' + (S.mode === "walk" ? S.photos.length + " снимки → " : "") + est.n + " части × " + durFor(e) + " сек ≈ <b>" + est.sec + " сек видео</b> · ≈ <span class=\"ndv-cost\">$" + money(est.cost) + "</span> (" + esc(e.name || "") + (e.price ? ", $" + money(e.price) + "/сек" : "") + ") · ~" + est.min + " мин" + (gateway && gateway.ok && gateway.balance != null ? " · Gateway кредити: $" + esc(String(gateway.balance)) : "") + "</div>";
    h += "<h5><i>3</i>Видео</h5>";
    if (!S.parts && S.mode === "walk") h += '<div class="ndv-act"><button type="button" class="pr big" data-a="create"' + (S.photos.length < 2 || running || (engines && !engines.length) ? " disabled" : "") + ">Създай видеото" + (S.photos.length >= 2 ? " от " + S.photos.length + " снимки" : "") + "</button></div>";
    if (S.parts) {
      var pct = c.n ? Math.round((c.ok / c.n) * 100) : 0;
      var head = stitching ? "Сглобявам видеото… " + esc(stitchInfo) : running ? "Създавам видеото… готови " + c.ok + " от " + c.n + " части" : S.final ? "Готово – " + c.n + " части в едно видео" : c.ok === c.n ? "Всички части са готови" : c.err ? "Готови " + c.ok + " от " + c.n + " части – " + c.err + " не успяха" : "Готово за създаване: " + c.n + " части";
      h += '<div class="ndv-prog"><b>' + head + '</b><div class="ndv-bar"><span style="width:' + (stitching ? 100 : pct) + '%"></span></div><div class="ndv-dots">' + S.parts.map(function (p) { return '<i class="' + (p.status === "done" ? "ok" : p.status === "run" ? "run" : p.status === "err" ? "err" : "") + '" title="' + esc(p.title) + '"></i>'; }).join("") + "</div>" +
        (running || stitching ? '<div class="ndv-note">Не затваряйте прозореца – ако го затворите, при следващото отваряне продължавам оттук.</div>' : "") +
        (fatal ? '<div class="ndv-err">' + esc(fatal) + "</div>" : c.err && !running ? '<div class="ndv-err">' + esc(lastErr()) + "</div>" : "") + "</div>";
      if (!running && !stitching && !S.final) h += '<div class="ndv-act">' + (c.ok === c.n ? '<button type="button" class="pr big" data-a="stitch">Сглоби видеото</button>' : '<button type="button" class="pr big" data-a="create">' + (c.ok || c.err ? "Продължи (" + (c.n - c.ok) + " части)" : "Създай видеото") + "</button>") + (c.err && c.ok ? '<button type="button" data-a="stitch">Сглоби без неуспелите</button>' : "") + "</div>";
    }
    if (S.final) {
      h += '<div class="ndv-final"><video src="' + esc(S.final.url) + '" controls playsinline preload="metadata"></video><div class="ndv-act"><a href="' + esc(S.final.url) + '" target="_blank" rel="noopener" download="ai-video-' + esc(code()) + "." + esc(S.final.ext || "mp4") + '">Свали</a>' + (navigator.share ? '<button type="button" data-a="share">Сподели</button>' : "") + (S.prop && !S.final.saved && !S.final.local ? '<button type="button" data-a="save">Запази в имота</button>' : "") + '<button type="button" data-a="again">Ново видео</button></div>' + (S.final.saved ? '<div class="ndv-note">✔ Записано в картата на имота (раздел „Видеа“).</div>' : "") + "</div>";
    }
    if (S.parts) h += "<details><summary>Части и промптове (" + S.parts.length + ")</summary><div>" + S.parts.map(function (p, i) {
      var stc = p.status === "done" ? "ok" : p.status === "run" ? "run" : p.status === "err" ? "err" : "", stt = p.status === "done" ? "Готова" : p.status === "run" ? "Прави се…" : p.status === "err" ? "Грешка" : "Чака";
      return '<div class="ndv-part"><div class="hd"><span>' + esc(p.title || "Част " + (i + 1)) + '</span><em class="' + stc + '">' + stt + "</em></div>" + (p.bg ? '<div class="ndv-note">' + esc(p.bg) + "</div>" : "") +
        '<div class="fr"><span style="background-image:url(' + esc((p.first && p.first.url) || "") + ')"></span>→<span style="background-image:url(' + esc((p.last && p.last.url) || "") + ')"></span>' + (p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener" style="margin-left:auto;color:#6b0a1c;font-weight:700">Гледай частта</a>' : "") + "</div>" +
        '<textarea data-pr="' + i + '" data-nodictate' + (p.status === "done" || p.status === "run" ? " readonly" : "") + ">" + esc(p.prompt) + "</textarea>" + (p.err ? '<div class="ndv-err">' + esc(p.err) + "</div>" : "") +
        (p.status === "err" || p.status === "done" ? '<div class="ndv-act"><button type="button" data-redo="' + i + '"' + (running ? " disabled" : "") + ">Направи частта отново</button></div>" : "") + "</div>";
    }).join("") + "</div></details>";
    box.innerHTML = h;
  }
  function lastErr() { var p = (S.parts || []).filter(function (x) { return x.err; }); return p.length ? p[p.length - 1].err : ""; }
  function photosFromProp(p) {
    var paths = (p.pics || []).slice(0, 30); if (!paths.length) { S.photos = []; return Promise.resolve(); }
    return D.fileUrls(paths).then(function (m) { S.photos = paths.map(function (pt, i) { return { path: pt, url: m[pt] || "", room: i === 0 ? "out" : i === paths.length - 1 ? "final" : "other" }; }); });
  }
  function refreshUrls() {
    var paths = [];
    S.photos.forEach(function (p) { if (p.path) paths.push(p.path); });
    (S.parts || []).forEach(function (p) { if (p.path) paths.push(p.path); if (p.first && p.first.path) paths.push(p.first.path); if (p.last && p.last.path) paths.push(p.last.path); });
    if (S.lot && S.lot.path) paths.push(S.lot.path);
    if (!paths.length) return Promise.resolve();
    return D.fileUrls(paths.filter(function (x, i, a) { return a.indexOf(x) === i; })).then(function (m) {
      S.photos.forEach(function (p) { if (m[p.path]) p.url = m[p.path]; });
      (S.parts || []).forEach(function (p) { if (p.path && m[p.path]) p.url = m[p.path]; if (p.first && m[p.first.path]) p.first.url = m[p.first.path]; if (p.last && m[p.last.path]) p.last.url = m[p.last.path]; });
      if (S.lot && m[S.lot.path]) S.lot.url = m[S.lot.path];
      save();
    }).catch(function () {});
  }
  function uploadFiles(files) {
    return Promise.all(files.map(function (f, i) { var p = base() + "src-" + Date.now() + "-" + i + "." + ((f.type || "").split("/")[1] || "jpg").replace("jpeg", "jpg"); return D.upload(p, f).then(function () { return D.fileUrl(p); }).then(function (u) { return { path: p, url: u, room: "other" }; }); }));
  }
  function pickFiles(one) {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; if (!one) inp.multiple = true; inp.style.cssText = "position:fixed;left:-999px;top:0;opacity:0"; document.body.appendChild(inp);
    inp.onchange = function () {
      var fs = [].slice.call(inp.files || []); inp.remove(); if (!fs.length) return;
      busy("Качвам снимките…");
      uploadFiles(fs).then(function (arr) { if (one) { S.photos = arr.slice(0, 1); S.lot = null; } else S.photos = S.photos.concat(arr); if (S.photos.length && S.mode === "walk" && S.photos[0].room === "other") S.photos[0].room = "out"; S.aspectAuto = ""; resetParts(); render(); }).catch(function (e) { D.say(e.message || "Снимките не се качиха"); }).then(function () { busy(); });
    };
    inp.click();
  }
  var busyEl = null;
  function busy(t) { if (busyEl) { busyEl.remove(); busyEl = null; } if (t && api0) busyEl = api0.add("a", esc(t), "wait"); }
  function say(html) { if (api0) { var m = api0.add("a", html); try { m.scrollIntoView({ block: "end" }); } catch (e) {} return m; } }

  /* ---------- формат: хоризонтални снимки → 16:9, вертикални → 9:16 ---------- */
  function detectAspect() {
    if (S.aspectAuto || !S.photos.length) return Promise.resolve();
    var sample = S.photos.slice(0, 8);
    return Promise.all(sample.map(function (p) { return new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im.naturalWidth > im.naturalHeight ? 1 : 0); }; im.onerror = function () { ok(1); }; im.src = p.url; setTimeout(function () { ok(1); }, 8000); }); }))
      .then(function (r) { var land = r.reduce(function (a, b) { return a + b; }, 0); S.aspectAuto = land * 2 >= r.length ? "16:9" : "9:16"; save(); render(); });
  }

  /* ---------- AI подредба като маршрут ---------- */
  function thumb(url) {
    return new Promise(function (ok) {
      var im = new Image(); im.crossOrigin = "anonymous";
      im.onload = function () { try { var k = Math.min(1, 512 / Math.max(im.naturalWidth, im.naturalHeight)); var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.8).split(",")[1]); } catch (e) { ok(null); } };
      im.onerror = function () { ok(null); }; im.src = url;
    });
  }
  function autoRoute() {
    if (S.photos.length < 2) return Promise.resolve();
    busy("Подреждам снимките като маршрут…");
    return Promise.all(S.photos.map(function (p) { return thumb(p.url); })).then(function (th) {
      var send = []; th.forEach(function (d, i) { if (d) send.push({ i: i, data: d }); });
      if (send.length < 2) throw new Error("Снимките не се четат за подредба");
      return vapi({ action: "route", photos: send.map(function (x) { return { data: x.data, mime: "image/jpeg" }; }) }).then(function (j) {
        var ph = S.photos, out = [];
        (j.order || []).forEach(function (o) { var src = send[o.i]; if (src && ph[src.i] && out.indexOf(ph[src.i]) < 0) { ph[src.i].room = o.room; out.push(ph[src.i]); } });
        ph.forEach(function (p) { if (out.indexOf(p) < 0) out.push(p); });
        S.photos = out; if (j.aspect) S.aspectAuto = j.aspect; resetParts(); render();
      });
    }).then(function () { busy(); }, function (e) { busy(); D.say(e.message || "Подредбата не успя"); });
  }

  /* ---------- генериране ---------- */
  function poll(job, savePath) {
    return new Promise(function (ok, no) {
      var t0 = Date.now();
      (function tick() {
        if (stopFlag) return no(new Error("Спряно"));
        vapi({ action: "status", job: job, save: savePath }).then(function (j) { if (j.done) return ok(j); if (Date.now() - t0 > 15 * 60000) return no(new Error("Частта отне повече от 15 минути")); setTimeout(tick, 6000); })
          .catch(function (e) { if (/HTTP 5|Failed to fetch|NetworkError|Load failed|network/i.test(e.message) && Date.now() - t0 < 15 * 60000) setTimeout(tick, 9000); else no(e); });
      })();
    });
  }
  var FATAL = /Липсва|няма валиден ключ|Няма ключ|Непознат двигател|401|403|402|insufficient|credit|billing|quota|not available on the free|paid tier|PERMISSION_DENIED|API key/i;
  function runPart(p, i) {
    var e = eng(), asp = S.aspectUsed || aspect();
    var attempt = 0;
    function once() {
      if (stopFlag) { if (p.status === "run" && !p.job) p.status = "idle"; save(); render(); return Promise.resolve(false); }
      p.status = "run"; p.err = ""; save(); render();
      var startP = p.job ? Promise.resolve({ job: p.job }) : vapi({ action: "start", engine: e.id, prompt: p.prompt, first: p.first ? { path: p.first.path } : null, last: p.last && e.frames > 1 ? { path: p.last.path } : null, aspect: asp, duration: durFor(e), resolution: S.set.res });
      return startP.then(function (j) { p.job = j.job; save(); return poll(p.job, base() + "part-" + (i + 1) + "-" + Date.now() + ".mp4"); })
        .then(function (r) { p.path = r.path; p.url = r.url; p.status = "done"; p.job = null; p.err = ""; save(); render(); return true; })
        .catch(function (err) {
          p.job = null; p.err = err.message || "Грешка"; attempt++; p.tries = (p.tries || 0) + 1;
          if (FATAL.test(p.err)) { fatal = p.err; stopFlag = true; p.status = "err"; save(); render(); return false; }
          if (stopFlag) { p.status = "idle"; save(); render(); return false; }
          if (attempt < 3) { p.status = "run"; save(); render(); return sleep(5000 * attempt).then(once); }
          p.status = "err"; save(); render(); return false;
        });
    }
    return once();
  }
  function runAll() {
    if (running || stitching || !S.parts) return Promise.resolve();
    var e = eng(); if (!engines || !engines.length) { say("Няма настроен ключ за видео – вижте списъка с ключове."); return Promise.resolve(); }
    running = true; stopFlag = false; fatal = ""; S.final = null; finalBlob = null; S.aspectUsed = S.aspectUsed && S.parts.some(function (p) { return p.status === "done"; }) ? S.aspectUsed : aspect(); save(); leaveGuard(true); render();
    var job;
    if (S.mode === "build") {
      job = S.parts.reduce(function (pr, p, i) {
        return pr.then(function (okPrev) {
          if (okPrev === false || stopFlag) return false;
          if (p.status === "done") return true;
          var prep = Promise.resolve();
          if (i === 0) p.first = S.lot ? { path: S.lot.path, url: S.lot.url } : null;
          else { var prev = S.parts[i - 1]; prep = frameToStorage(prev.url, i).then(function (f) { p.first = f; }); }
          p.last = i === S.parts.length - 1 && S.photos[0] && e.frames > 1 ? { path: S.photos[0].path, url: S.photos[0].url } : null;
          return prep.then(function () { return runPart(p, i); });
        });
      }, Promise.resolve(true));
    } else {
      var queue = S.parts.map(function (p, i) { return i; }).filter(function (i) { return S.parts[i].status !== "done"; });
      var worker = function () { if (stopFlag || !queue.length) return Promise.resolve(); var i = queue.shift(); return runPart(S.parts[i], i).then(worker); };
      var ws = []; for (var k = 0; k < Math.min(CONC, queue.length || 1); k++) ws.push(worker());
      job = Promise.all(ws);
    }
    return job.catch(function (err) { fatal = err.message || String(err); }).then(function () {
      running = false; leaveGuard(false); var c = counts(); render();
      if (c.ok === c.n && c.n) return stitch();
      var msg = fatal ? "Спрях: " + esc(fatal) : stopFlag ? "Спряно. Готови " + c.ok + " от " + c.n + " части – натиснете „Продължи“." : "Готови " + c.ok + " от " + c.n + " части; " + c.err + " не успяха след 3 опита: " + esc(lastErr());
      if (S.auto || fatal) say(msg);
    });
  }
  function createVideo(auto) {
    if (running || stitching) return;
    if (auto) S.auto = true;
    if (S.mode === "walk") { if (S.photos.length < 2) { say("Изберете имот или прикачете поне 2 снимки."); return; } if (!S.parts) S.parts = walkParts(); }
    if (!S.parts) { say("Първо създайте празния парцел и сценария (бутоните в панела)."); return; }
    var est = estimate();
    if (!S.parts.some(function (p) { return p.status === "done"; })) say("Започвам: <b>" + est.n + " части</b> × " + durFor(eng()) + " сек → едно видео от ~" + est.sec + " сек (≈ $" + money(est.cost) + ", ~" + est.min + " мин). Частите вървят по " + CONC + " наведнъж; накрая ги сглобявам в едно видео с логото по средата.");
    save(); return detectAspect().then(runAll);
  }

  /* ---------- строеж: последен кадър от клип → начало на следващия ---------- */
  function lastFrame(url) {
    return new Promise(function (ok, no) {
      var v = document.createElement("video"); v.crossOrigin = "anonymous"; v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
      var done = false, t = setTimeout(function () { if (!done) { done = true; no(new Error("Кадърът не се зареди")); } }, 30000);
      v.onloadedmetadata = function () { try { v.currentTime = Math.max(0, (v.duration || 1) - 0.08); } catch (e) {} };
      v.onseeked = function () { if (done) return; done = true; clearTimeout(t); try { var c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0); c.toBlob(function (b) { b ? ok(b) : no(new Error("Кадърът не се записа")); }, "image/jpeg", 0.92); } catch (e) { no(e); } };
      v.onerror = function () { if (!done) { done = true; clearTimeout(t); no(new Error("Видеото не се отвори за кадър")); } };
    });
  }
  function frameToStorage(url, n) { var p = base() + "frame-" + n + "-" + Date.now() + ".jpg"; return lastFrame(url).then(function (b) { return D.upload(p, b); }).then(function () { return D.fileUrl(p); }).then(function (u) { return { path: p, url: u }; }); }

  /* ---------- сглобяване в едно видео: частите една след друга + лого по средата + „AI визуализация“ ---------- */
  var logoP = null;
  function logo() { return logoP || (logoP = new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = "/mobile/crm/assets/logo.png"; })); }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function pickMime() { var l = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]; for (var i = 0; i < l.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(l[i])) return l[i]; return ""; }
  function stitch() {
    if (stitching) return Promise.resolve();
    var parts = (S.parts || []).filter(function (p) { return p.status === "done" && p.path; });
    if (!parts.length) return Promise.resolve();
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { say("Този браузър не може да сглоби видеото. Отворете CRM в Chrome или Safari (iOS 15+)."); return Promise.resolve(); }
    stitching = true; stitchInfo = "подготвям частите"; leaveGuard(true); render();
    var urls = [], LG = null, total = 0;
    return refreshUrls().then(logo).then(function (im) { LG = im; })
      .then(function () {
        return parts.reduce(function (pr, p, k) { return pr.then(function () { stitchInfo = "свалям част " + (k + 1) + " от " + parts.length; render(); return fetch(p.url).then(function (r) { if (!r.ok) throw new Error("Част " + p.n + " не се свали (" + r.status + ")"); return r.blob(); }).then(function (b) { urls.push(URL.createObjectURL(b)); }); }); }, Promise.resolve());
      })
      .then(function () {
        var vids = urls.map(function (u) { var v = document.createElement("video"); v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto"; v.src = u; return v; });
        return Promise.all(vids.map(function (v) { return new Promise(function (ok, no) { if (v.readyState >= 1) return ok(); v.onloadedmetadata = function () { ok(); }; v.onerror = function () { no(new Error("Част не се отвори")); }; setTimeout(function () { no(new Error("Частите не се заредиха навреме")); }, 30000); }); })).then(function () { return vids; });
      })
      .then(function (vids) {
        vids.forEach(function (v) { total += v.duration || 0; });
        var W = Math.min(1080, vids[0].videoWidth || 1280), H = Math.round(W * (vids[0].videoHeight || 720) / (vids[0].videoWidth || 1280)); W -= W % 2; H -= H % 2;
        var cv = document.createElement("canvas"); cv.width = W; cv.height = H; var ctx = cv.getContext("2d");
        var stream = cv.captureStream(30), mime = pickMime();
        var rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: H >= 1000 || W >= 1000 ? 4000000 : 3000000 }) : new MediaRecorder(stream), chunks = [];
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        var ext = /mp4/.test(rec.mimeType || mime) ? "mp4" : "webm", cur = 0, raf = 0, played = 0, lastTick = 0;
        function draw() {
          var v = vids[cur]; if (!v) return;
          ctx.drawImage(v, 0, 0, W, H);
          if (LG) { var lw = Math.round(Math.min(W, H) * 0.62), lh = Math.round(lw * LG.naturalHeight / LG.naturalWidth); ctx.save(); ctx.globalAlpha = 0.42; ctx.shadowColor = "rgba(255,248,235,.9)"; ctx.shadowBlur = Math.round(W * 0.02); ctx.drawImage(LG, Math.round((W - lw) / 2), Math.round((H - lh) / 2), lw, lh); ctx.restore(); }
          var fs = Math.round(Math.min(W, H) * 0.034); ctx.font = "700 " + fs + "px 'Roboto Condensed',Arial,sans-serif"; var tw = ctx.measureText("AI визуализация").width;
          ctx.fillStyle = "rgba(60,10,20,.45)"; roundRect(ctx, W - tw - fs * 2.2, H - fs * 2.6, tw + fs * 1.4, fs * 1.7, fs * 0.85); ctx.fill();
          ctx.fillStyle = "rgba(255,243,220,.95)"; ctx.textBaseline = "middle"; ctx.fillText("AI визуализация", W - tw - fs * 1.5, H - fs * 1.75);
          var now = Date.now(); if (now - lastTick > 1000) { lastTick = now; stitchInfo = Math.min(Math.round(played + (v.currentTime || 0)), Math.round(total)) + " / " + Math.round(total) + " сек"; var b2 = box && box.querySelector(".ndv-prog b"); if (b2) b2.textContent = "Сглобявам видеото… " + stitchInfo; }
          raf = requestAnimationFrame(draw);
        }
        return new Promise(function (resolve, reject) {
          function playNext() {
            var v = vids[cur]; if (!v) { cancelAnimationFrame(raf); setTimeout(function () { try { rec.stop(); } catch (e) {} }, 120); return; }
            v.onended = function () { played += v.duration || 0; cur++; playNext(); };
            try { v.currentTime = 0; } catch (e) {}
            var p = v.play(); if (p && p.catch) p.catch(function (err) { reject(new Error("Възпроизвеждането спря: " + (err && err.message || ""))); });
          }
          rec.onstop = function () { resolve({ blob: new Blob(chunks, { type: (rec.mimeType || mime || "video/webm").split(";")[0] }), ext: ext }); };
          rec.onerror = function (e) { reject(new Error("Записът не успя")); };
          rec.start(500); draw(); playNext();
        });
      })
      .then(function (out) {
        finalBlob = out.blob; stitchInfo = "качвам готовото видео"; render();
        var p = base() + "ai-video-" + Date.now() + "." + out.ext;
        return D.upload(p, out.blob).then(function () { return D.shareUrls([p], 604800); }).then(function (m) { S.final = { path: p, url: m[p], ext: out.ext, size: out.blob.size, mime: out.blob.type, saved: false, at: new Date().toISOString() }; save(); })
          .catch(function (e) { S.final = { path: "", url: URL.createObjectURL(out.blob), ext: out.ext, size: out.blob.size, mime: out.blob.type, saved: false, local: true }; D.say("Видеото не се качи (" + (e.message || "") + ") – може да го свалите"); });
      })
      .then(function () { stitching = false; leaveGuard(false); urls.forEach(function (u) { URL.revokeObjectURL(u); }); render(); return S.prop && S.final && !S.final.local ? saveToProp() : null; })
      .then(function () { postVideo(); })
      .catch(function (e) { stitching = false; leaveGuard(false); urls.forEach(function (u) { URL.revokeObjectURL(u); }); render(); say("Частите са готови, но сглобяването не успя: " + esc(e.message || "") + ". Натиснете „Сглоби видеото“ отново."); });
  }
  function saveToProp() {
    if (!S.final || !S.prop || S.final.local) return Promise.resolve();
    return D.load("properties").then(function (l) {
      var p = l.filter(function (x) { return x.id === S.prop.id; })[0]; if (!p) throw new Error("Имотът не е намерен");
      p.videos = p.videos || []; p.videos.push({ name: "AI видео – " + (S.mode === "walk" ? "разходка" : "строеж") + "." + S.final.ext, path: S.final.path, size: S.final.size, mime: S.final.mime, at: new Date().toISOString(), ai: true });
      p.log = (p.log || []).slice(0, 49); p.log.unshift({ icon: "camera", text: "Тед: AI видео (" + (S.mode === "walk" ? "разходка" : "строеж") + ", " + S.parts.length + " части)", at: new Date().toISOString() });
      return D.put("properties", p);
    }).then(function () { S.final.saved = true; save(); render(); try { window.dispatchEvent(new CustomEvent("nd-data-changed")); } catch (e) {} }).catch(function (e) { D.say(e.message || "Не се записа в имота"); });
  }
  function postVideo() {
    if (!api0 || !S.final) return;
    say("<b>Готово – видеото е сглобено</b>" + (S.prop ? " за обява <b>" + esc(S.prop.code || "") + "</b> " + esc(S.prop.title || "") : "") + " (" + S.parts.filter(function (p) { return p.status === "done"; }).length + " части, логото е по средата).\n" +
      '<video src="' + esc(S.final.url) + '" controls playsinline style="width:100%;max-height:380px;border-radius:12px;background:#000;margin-top:6px"></video>' +
      '<a class="go" href="' + esc(S.final.url) + '" target="_blank" rel="noopener" download="ai-video-' + esc(code()) + "." + esc(S.final.ext || "mp4") + '">Свали видеото</a>' + (S.final.saved ? "\n✔ Записано в картата на имота (раздел „Видеа“)." : ""));
  }
  function share() {
    var go = function (blob) { var f = new File([blob], "ai-video-" + code() + "." + (S.final.ext || "mp4"), { type: blob.type || "video/mp4" }); if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: S.prop ? S.prop.title : "AI видео" }); return navigator.share({ url: S.final.url, title: S.prop ? S.prop.title : "AI видео" }); };
    (finalBlob ? Promise.resolve(finalBlob) : fetch(S.final.url).then(function (r) { return r.blob(); })).then(go).catch(function () {});
  }

  /* ---------- от чата: „направи видео разходка на обява #P-1001“ или прикачени снимки ---------- */
  function fromChat(v, files) {
    if (!A.use("video")) return;
    if (running || stitching) { say("Вече правя видео – изчакайте да свърши или натиснете „Стоп“."); return; }
    var keep = S.set; S = fresh(); S.set = keep; S.mode = v.mode === "build" ? "build" : "walk"; S.auto = true; save(); render();
    var prep;
    if (v.property && v.property.id) {
      S.prop = { id: v.property.id, code: v.property.code, title: v.property.title, city: v.property.city };
      say("Правя " + (S.mode === "walk" ? "видео разходка" : "видео на строежа") + " за обява <b>" + esc(v.property.code || "") + "</b> " + esc(v.property.title || "") + " от реалните снимки (" + (v.property.photos || "") + ").");
      prep = D.ready().then(function () { return D.load("properties"); }).then(function (l) { var p = l.filter(function (x) { return x.id === S.prop.id; })[0]; if (!p) throw new Error("Имотът не е намерен"); return photosFromProp(p); });
    } else if (files && files.length) {
      var imgs = [].filter.call(files, function (f) { return /^image\//.test(f.type); });
      if (!imgs.length) { say("Не виждам снимки в прикачените файлове."); return; }
      say("Правя " + (S.mode === "walk" ? "видео разходка" : "видео на строежа") + " от " + imgs.length + " прикачени снимки.");
      busy("Качвам снимките…");
      prep = uploadFiles(imgs).then(function (arr) { S.photos = arr; busy(); });
    } else { say("Кажете номера на обявата (#…) или прикачете снимки."); return; }
    prep.then(function () {
      save(); render();
      if (S.mode === "build") { if (!S.photos.length) throw new Error("Няма снимка"); say("За „строеж“ натиснете „1. Създай празен парцел“, после „2. Сценарий по клипове“ и „Генерирай“."); return; }
      if (S.photos.length < 2) throw new Error("За разходка са нужни поне 2 снимки");
      return autoRoute().then(function () { return createVideo(true); });
    }).catch(function (e) { busy(); say("Не успях: " + esc(e.message || "грешка")); });
  }
  window.NDVideo = { fromChat: fromChat, autoRoute: autoRoute, create: createVideo, stitch: stitch, state: function () { return S; } };

  /* ---------- събития ---------- */
  function bindBox() {
    box.addEventListener("change", function (e) {
      var t = e.target;
      if (t.matches("[data-prop]")) {
        if (running || stitching) { D.say("Изчакайте текущото видео"); render(); return; }
        var p = (render.props || []).filter(function (x) { return x.id === t.value; })[0]; S.prop = p ? { id: p.id, code: p.code, title: p.title, city: p.city } : null; S.lot = null; S.aspectAuto = ""; resetParts(); busy(p ? "Зареждам снимките…" : "");
        (p ? photosFromProp(p) : Promise.resolve(S.photos = [])).then(function () { save(); busy(); render(); return detectAspect(); });
      }
      if (t.matches("[data-room]")) { S.photos[+t.getAttribute("data-room")].room = t.value; resetParts(); render(); }
      if (t.matches("[data-set]")) { var k = t.getAttribute("data-set"); S.set[k] = k === "dur" ? +t.value : t.value; if (k === "aspect" || k === "engine") { (S.parts || []).forEach(function (p) { if (p.status !== "done") p.job = null; }); } save(); render(); }
    });
    box.addEventListener("input", function (e) { var t = e.target; if (t.matches("[data-pr]")) { S.parts[+t.getAttribute("data-pr")].prompt = t.value; save(); } });
    box.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      var i, a = b.getAttribute("data-a");
      if (b.hasAttribute("data-up")) { i = +b.getAttribute("data-up"); if (i > 0) { var x = S.photos.splice(i, 1)[0]; S.photos.splice(i - 1, 0, x); resetParts(); render(); } }
      else if (b.hasAttribute("data-dn")) { i = +b.getAttribute("data-dn"); if (i < S.photos.length - 1) { var y = S.photos.splice(i, 1)[0]; S.photos.splice(i + 1, 0, y); resetParts(); render(); } }
      else if (b.hasAttribute("data-rm")) { S.photos.splice(+b.getAttribute("data-rm"), 1); resetParts(); render(); }
      else if (b.hasAttribute("data-redo")) { var c = S.parts[+b.getAttribute("data-redo")]; c.status = "idle"; c.err = ""; c.url = ""; c.path = ""; c.job = null; S.final = null; save(); render(); }
      else if (a === "add") pickFiles(false);
      else if (a === "add1") pickFiles(true);
      else if (a === "route") autoRoute();
      else if (a === "create") createVideo(false);
      else if (a === "stitch") stitch();
      else if (a === "save") saveToProp();
      else if (a === "share") share();
      else if (a === "again") { resetParts(); render(); }
      else if (a === "lot") { busy("Правя празния парцел от снимката…"); vapi({ action: "lot", photo: { path: S.photos[0].path }, save: base() + "lot-" + Date.now() + ".png" }).then(function (j) { S.lot = { path: j.path, url: j.url }; resetParts(); render(); }).catch(function (er) { D.say(er.message); }).then(function () { busy(); }); }
      else if (a === "script") { busy("Пиша сценария по клипове…"); var prefs = {}; try { prefs = JSON.parse(localStorage.getItem("nd-ted-prefs") || "{}"); } catch (x2) {} vapi({ action: "script", photo: { path: S.photos[0].path }, title: S.prop && S.prop.title, city: S.prop && S.prop.city, aspect: aspect(), model: prefs.model || "" }).then(function (j) { S.parts = j.clips.map(function (c, k) { return { n: k + 1, title: c.title, bg: c.bg, prompt: c.prompt, status: "idle" }; }); S.final = null; save(); render(); say("Сценарий: <b>" + S.parts.length + " клипа</b>" + (j.model ? " (" + esc(j.model) + ")" : "") + ". Натиснете „Генерирай“ – правя ги един след друг и ги сглобявам в едно видео."); }).catch(function (er) { D.say(er.message); }).then(function () { busy(); }); }
    });
  }
  function loadEngines() {
    return vapi({ action: "engines" }).then(function (j) { engines = j.engines || []; gateway = j.gateway || null; if (engines.length && !engines.some(function (x) { return x.id === S.set.engine; })) { S.set.engine = engines[0].id; save(); } render(); }).catch(function () { engines = engines || []; render(); });
  }

  A.addSkill({
    id: "video", name: "AI Видео на имот", sub: "Едно готово видео от снимките на обявата",
    intro: function (api) {
      api0 = api;
      api.add("a", "<b>AI Видео на имот</b>\nИзберете обява (или прикачете снимки) и натиснете <b>„Създай видеото“</b>. Подреждам снимките като разходка – отвън, вход, хол, кухня, тераса, краен кадър. Правя плавен преход между всеки две снимки и накрая ги сглобявам в <b>едно готово видео</b> с логото по средата.\nМоже и от чата: „Направи видео разходка на обява #P-1001“.");
      box = document.createElement("div"); box.className = "ndv"; api.list().appendChild(box); bindBox(); render();
      D.ready().then(function () { return D.load("properties"); }).then(function (l) { render.props = l.filter(function (p) { return !p.archived; }).sort(function (a, b) { return String(b._updated).localeCompare(String(a._updated)); }).map(function (p) { return { id: p.id, code: p.code, title: p.title, city: p.city, pics: p.pics || [] }; }); render(); }).catch(function () {});
      Promise.all([loadEngines(), refreshUrls()]).then(function () {
        render();
        /* прекъснато генериране → продължава само */
        if (!running && !stitching && S.parts && S.parts.some(function (p) { return p.status === "run" || p.job; })) { say("Продължавам видеото, докъдето беше стигнало…"); runAll(); }
        else if (!running && !stitching && S.parts && S.auto && !S.final && S.parts.length && S.parts.every(function (p) { return p.status === "done"; })) stitch();
      });
    },
    footer: function () {
      return '<div class="nda-f ndv-f"><button type="button" data-a="walk"><span class="ib">' + I.walk + '</span>Разходка</button><button type="button" data-a="build"><span class="ib">' + I.build + '</span>Строеж</button>' +
        '<button type="button" data-a="go"><span class="ib">' + I.play + '</span>Създай</button><button type="button" data-a="stop"><span class="ib">' + I.stop + "</span>Стоп</button></div>";
    },
    bind: function (api, el) {
      api0 = api;
      el.querySelector(".nda-f").onclick = function (e) {
        var b = e.target.closest("[data-a]"); if (!b) return; var a = b.getAttribute("data-a");
        if (a === "walk" || a === "build") { if (running || stitching) { D.say("Изчакайте текущото видео"); return; } if (S.mode !== a) { S.mode = a; S.lot = null; resetParts(); if (a === "build" && S.photos.length > 1) S.photos = S.photos.slice(0, 1); save(); render(); } }
        else if (a === "go") createVideo(false);
        else if (a === "stop") { if (running) { stopFlag = true; D.say("Спирам – готовите части се пазят"); } }
      };
    }
  }, 2);
})();
