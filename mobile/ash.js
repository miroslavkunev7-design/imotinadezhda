/* Тед Асистент – round burgundy button (bottom right) on every page + chat window with a skill picker at the top.
   The chat is real: /api/assistant (Gemini). Signed-in staff get full CRM tools; visitors get published listings + inquiry.
   Other scripts add skills with NDAsh.addSkill({...}) (the CRM adds "АИ Качване на имот" as the first one). */
(function () {
  "use strict";
  if (window.NDAsh) return;
  try { if (window.self !== window.top && /[?&]inframe=1/.test(location.search)) return; } catch (e) {}
  var SB_KEY_STORE = "nd-crm-auth", SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co", SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
  var BOT = "/mobile/crm/assets/ash-bot.png";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var I = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10a7 7 0 0 1-14 0M12 17v5M8 22h8"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    spk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
    clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>'
  };
  var css =
    ".nda-fab{position:fixed;right:14px;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:2147483000;width:60px;height:60px;border-radius:50%;border:0;padding:0;cursor:pointer;display:grid;place-items:center;" +
    "background:radial-gradient(circle at 35% 28%,#b0213f,#7a0f22 55%,#4a0613);box-shadow:0 0 0 2px #edc47a,0 0 18px rgba(255,190,120,.75),0 8px 18px rgba(40,4,12,.45);-webkit-tap-highlight-color:transparent}" +
    ".nda-fab img{width:42px;height:42px;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(40,0,10,.45))}.nda-fab:active{transform:scale(.95)}.nda-fab[hidden]{display:none}" +
    ".nda-win{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));top:max(60px,env(safe-area-inset-top,0px));z-index:2147483001;display:flex;flex-direction:column;max-width:560px;margin:0 auto;border-radius:26px;overflow:hidden;" +
    "background:linear-gradient(165deg,rgba(255,251,247,.97),rgba(251,236,224,.95));border:1.5px solid #e3b25e;box-shadow:0 0 0 1px rgba(255,236,190,.6) inset,0 0 26px rgba(227,178,94,.55),0 24px 60px rgba(30,0,8,.55);font-family:'Roboto Condensed',Arial,system-ui,sans-serif;-webkit-text-size-adjust:100%;text-align:left}" +
    "@media(min-width:900px){.nda-win{left:auto;right:24px;width:440px;top:auto;height:min(680px,calc(100vh - 48px));bottom:24px}}" +
    ".nda-win[hidden]{display:none}.nda-win *{box-sizing:border-box}" +
    ".nda-h{position:relative;display:flex;align-items:center;gap:10px;padding:12px 12px 12px 14px;background:linear-gradient(120deg,#9a1a33,#6b0a1c 60%,#4f0716);color:#fff3dc;border-bottom:1.5px solid #e3b25e}" +
    ".nda-av{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 28%,#b0213f,#7a0f22 55%,#4a0613);box-shadow:0 0 0 1.5px #edc47a,0 0 12px rgba(255,214,150,.7)}.nda-av img{width:32px;height:32px;object-fit:contain}" +
    ".nda-t{flex:1;min-width:0}.nda-t b{display:block;font:700 18px/1.1 Georgia,serif;color:#fff3dc}" +
    ".nda-skill{margin-top:4px;display:inline-flex;align-items:center;gap:6px;max-width:100%;height:30px;padding:0 10px 0 12px;border-radius:15px;border:1px solid rgba(243,207,134,.75);background:rgba(255,255,255,.12);color:#ffe9b8;font:700 14px 'Roboto Condensed',Arial,sans-serif;cursor:pointer;box-shadow:0 0 10px rgba(243,207,134,.35)}" +
    ".nda-skill svg{width:16px;height:16px;flex:none}.nda-skill span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".nda-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.nda-model{background:linear-gradient(180deg,rgba(255,247,227,.22),rgba(243,207,134,.18))}.nda-model i{width:8px;height:8px;border-radius:50%;background:#7de86a;box-shadow:0 0 6px #7de86a;flex:none;font-style:normal}" +
    ".nda-menu.models button em{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:9px;font:700 11px/1.5 'Roboto Condensed',Arial,sans-serif;font-style:normal;color:#fff3dc;background:linear-gradient(180deg,#a3213a,#55071a)}" +
    ".nda-fb{font:400 12px 'Roboto Condensed',Arial,sans-serif;color:#8a6a3a;margin:2px 0 0}" +
    ".nda-x{flex:none;width:38px;height:38px;border-radius:50%;border:1.5px solid #edc47a;background:linear-gradient(180deg,#fff7e3,#f3cf86);color:#6b0a1c;display:grid;place-items:center;cursor:pointer;padding:0}.nda-x svg{width:18px;height:18px}" +
    ".nda-menu{position:absolute;left:66px;top:70px;z-index:3;min-width:260px;max-width:calc(100% - 78px);padding:8px;border-radius:18px;background:linear-gradient(180deg,rgba(255,251,247,.99),rgba(251,236,224,.98));border:1.5px solid #e3b25e;box-shadow:0 0 18px rgba(227,178,94,.55),0 14px 30px rgba(40,4,12,.4)}" +
    ".nda-menu[hidden]{display:none}.nda-menu button{display:block;width:100%;text-align:left;padding:10px 12px;border:0;border-radius:12px;background:transparent;color:#4e0912;font:700 16px 'Roboto Condensed',Arial,sans-serif;cursor:pointer}" +
    ".nda-menu button small{display:block;font-weight:400;font-size:12.5px;color:#6b4a40;margin-top:2px}.nda-menu button.on{background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1px rgba(227,178,94,.7),0 0 10px rgba(255,214,150,.6)}" +
    ".nda-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 12px;display:flex;flex-direction:column;gap:10px}" +
    ".nda-m{max-width:88%;padding:10px 13px;border-radius:18px;font:400 15px/1.4 'Roboto Condensed',Arial,sans-serif;color:#3a0c12;white-space:pre-line;word-wrap:break-word}" +
    ".nda-m.a{align-self:flex-start;background:linear-gradient(180deg,#fffdf9,#fbefe5);border:1px solid rgba(227,178,94,.75);box-shadow:0 0 10px rgba(255,214,150,.35);border-top-left-radius:6px}" +
    ".nda-m.u{align-self:flex-end;background:linear-gradient(160deg,#9a1a33,#6b0a1c);color:#fff3dc;border:1px solid #e3b25e;border-top-right-radius:6px}" +
    ".nda-m.wait{opacity:.8}.nda-m.wait:after{content:'…';animation:ndaDots 1s steps(3) infinite}@keyframes ndaDots{0%{content:'.'}50%{content:'..'}100%{content:'...'}}" +
    ".nda-m table{margin-top:6px;border-collapse:collapse;width:100%;font-size:14px}.nda-m td{padding:3px 6px 3px 0;vertical-align:top;white-space:normal}.nda-m td:first-child{color:#8d1530;font-weight:700;white-space:nowrap}" +
    ".nda-m a.go{display:inline-block;margin-top:8px;padding:8px 14px;border-radius:14px;background:linear-gradient(150deg,#fff0aa,#f3a518);color:#640319;font-weight:700;text-decoration:none;box-shadow:0 0 10px rgba(255,200,90,.6)}" +
    ".nda-m .acts{display:block;margin-top:6px;font-size:12px;color:#8d6a50}" +
    ".nda-f{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px 12px 12px;border-top:1px solid rgba(227,178,94,.6);background:rgba(255,248,240,.85)}" +
    ".nda-f button{display:flex;flex-direction:column;align-items:center;gap:5px;padding:9px 4px;border-radius:16px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;font:700 13.5px/1.15 'Roboto Condensed',Arial,sans-serif;cursor:pointer;box-shadow:0 0 10px rgba(255,214,150,.45)}" +
    ".nda-f button:disabled{opacity:.5}.nda-f button span.ib{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff3dc;background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);box-shadow:0 0 0 1.5px #edc47a,0 0 8px rgba(255,190,120,.55)}.nda-f button span.ib svg{width:18px;height:18px}" +
    ".nda-c{display:flex;align-items:flex-end;gap:8px;padding:10px 12px 12px;border-top:1px solid rgba(227,178,94,.6);background:rgba(255,248,240,.85)}" +
    ".nda-c textarea{flex:1;min-height:44px;max-height:120px;resize:none;border-radius:16px;border:1.5px solid #e3b25e;background:#fffdfa;padding:11px 12px;font:16px/1.3 'Roboto Condensed',Arial,sans-serif;color:#3a0c12;outline:none;box-shadow:inset 0 1px 3px rgba(80,20,10,.08)}" +
    ".nda-c textarea:focus{box-shadow:0 0 0 2px rgba(227,178,94,.5)}" +
    ".nda-c button{flex:none;width:44px;height:44px;border-radius:50%;border:1.5px solid #e3b25e;display:grid;place-items:center;cursor:pointer;padding:0}.nda-c button svg{width:20px;height:20px}" +
    ".nda-c .att{background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c}.nda-c .snd{background:linear-gradient(150deg,#fff0aa,#f3a518);color:#640319;box-shadow:0 0 10px rgba(255,200,90,.6)}" +
    ".nda-c .mic{background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c}.nda-c .mic.rec{background:radial-gradient(circle at 35% 30%,#e0425f,#a3112f 60%,#6b0a1c);color:#fff;border-color:#ffd27a;animation:ndaRec 1.2s ease-in-out infinite}" +
    "@keyframes ndaRec{0%,100%{box-shadow:0 0 0 0 rgba(224,66,95,.55),0 0 12px rgba(255,190,120,.6)}50%{box-shadow:0 0 0 9px rgba(224,66,95,0),0 0 18px rgba(255,190,120,.9)}}" +
    ".nda-c textarea.rec{color:#a3112f;font-weight:700}" +
    ".nda-dl{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:6px 12px;margin:2px 0;border-radius:14px;font-weight:700;color:#5a0a18;text-decoration:none;background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1.5px rgba(227,178,94,.8),0 0 10px rgba(255,214,150,.6);word-break:break-all}.nda-dl:hover{box-shadow:0 0 0 1.5px #f6d68c,0 0 16px rgba(255,214,150,.9)}.nda-say{display:inline-grid;place-items:center;vertical-align:middle;width:30px;height:30px;margin:6px 0 0 6px;float:right;border-radius:50%;border:1.5px solid #e3b25e;background:radial-gradient(circle at 35% 28%,#b0213f,#7a0f22 55%,#4a0613);color:#fff3dc;cursor:pointer;padding:0;box-shadow:0 0 8px rgba(255,190,120,.6)}" +
    ".nda-say svg{width:16px;height:16px}.nda-say.on{background:linear-gradient(150deg,#fff0aa,#f3a518);color:#640319;animation:ndaRec 1.2s ease-in-out infinite}.nda-say.ld{opacity:.6}" +
    ".nda-files{padding:0 12px;display:flex;gap:6px;flex-wrap:wrap;background:rgba(255,248,240,.85)}.nda-files span{font:12px 'Roboto Condensed',Arial,sans-serif;padding:3px 8px;border-radius:10px;border:1px solid #e3b25e;color:#6b0a1c;background:#fff}";

  /* ---- token of the CRM session (same browser) ---- */
  function token() {
    if (window.ND && window.ND.token && window.ND.user) return window.ND.token().catch(function () { return ""; });
    var s = null; try { s = JSON.parse(localStorage.getItem(SB_KEY_STORE) || "null"); } catch (e) {}
    if (!s || !s.access_token) return Promise.resolve("");
    if (!s.expires_at || s.expires_at * 1000 > Date.now() + 60000) return Promise.resolve(s.access_token);
    return fetch(SB_URL + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (n) {
        if (!n || !n.access_token) return "";
        try { localStorage.setItem(SB_KEY_STORE, JSON.stringify(Object.assign({}, s, n, { expires_at: Math.floor(Date.now() / 1000) + (n.expires_in || 3600) }))); } catch (e) {}
        return n.access_token;
      }).catch(function () { return ""; });
  }
  function fileData(f) {
    return new Promise(function (ok) {
      var r = new FileReader();
      r.onload = function () {
        if (f.type === "application/pdf") return ok({ mime: f.type, data: String(r.result).split(",")[1] });
        var im = new Image(); im.onload = function () { var k = Math.min(1, 1400 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = im.width * k; c.height = im.height * k; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok({ mime: "image/jpeg", data: c.toDataURL("image/jpeg", .85).split(",")[1] }); };
        im.onerror = function () { ok(null); }; im.src = r.result;
      };
      r.onerror = function () { ok(null); }; r.readAsDataURL(f);
    });
  }
  /* history: [{role:'user'|'assistant', text, files?}] -> {ok,text,actions,staff} */
  var models = null, modelId = (function () { try { return localStorage.getItem("nd-ted-model") || ""; } catch (e) { return ""; } })();
  function loadModels() {
    if (models) return Promise.resolve(models);
    return token().then(function (tk) { return fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify({ action: "models" }) }); })
      .then(function (r) { return r.json(); }).then(function (j) { models = ((j && j.models) || []).concat([N8N_OPT]); return models; }).catch(function () { models = [N8N_OPT]; return models; });
  }
  var N8N_OPT = { id: "n8n", name: "Агент n8n", note: "вашият агент от n8n (моделите са в n8n)", provider: "n8n", vision: false, pdf: false };
  function curModel() { return (models || []).filter(function (m) { return m.id === modelId; })[0] || (models || [])[0] || null; }
  function setModel(id, quiet) {
    modelId = id || ""; try { if (id) localStorage.setItem("nd-ted-model", id); } catch (e) {}
    var m = curModel(), mk = win && win.querySelector(".nda-model"); if (!mk) return;
    mk.querySelector("span").textContent = m ? m.name : "Модел"; mk.title = m ? m.name + (m.note ? " – " + m.note : "") : "Модел";
    if (m && !quiet) add("bot", "Избран модел: <b>" + esc(m.name) + "</b>" + (m.note ? " – " + esc(m.note) : "") + (m.pdf ? "" : " · без PDF") + (m.vision ? "" : " · без снимки"));
  }
  function renderModels() {
    var cur = curModel(), PROV = { gemini: "Google", openai: "OpenAI", anthropic: "Anthropic", openrouter: "OpenRouter", ollama: "Ollama", n8n: "n8n" };
    menu.innerHTML = (models && models.length ? models.map(function (m) { return '<button type="button" data-m="' + esc(m.id) + '"' + (cur && cur.id === m.id ? ' class="on"' : "") + ">" + esc(m.name) + "<em>" + (PROV[m.provider] || m.provider) + "</em><small>" + esc(m.note || "") + (m.pdf ? "" : " · без PDF") + (m.vision ? "" : " · без снимки") + "</small></button>"; }).join("") : '<button type="button" disabled>Няма настроени модели<small>Ключовете се добавят във Vercel (GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, OLLAMA_URL)</small></button>');
  }
  /* вашият агент в n8n (същият като в публичния сайт): текстът отива към webhook-а, n8n ползва /api/tools с токена на брокера */
  var N8N_URL = "https://imotinadezhda.app.n8n.cloud/webhook/94ba7a03-92cc-41d0-ab0f-549d1d4d4560", N8N_SID = (function () { try { var k = "nd-ted-n8n-sid", v = localStorage.getItem(k); if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); localStorage.setItem(k, v); } return v; } catch (e) { return "s" + Date.now(); } })();
  function askN8n(history) {
    var last = history[history.length - 1] || {}, text = String(last.text || "").trim();
    if (!text) return Promise.resolve({ ok: false, error: "Агентът в n8n приема текст – за снимки, файлове и глас изберете Gemini или друг модел." });
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 60000);
    return token().then(function (tok) {
      return fetch(N8N_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text + ((last.files || []).length ? "\n(прикачени файлове: " + last.files.map(function (f) { return f.name; }).join(", ") + ")" : ""), sessionId: N8N_SID, accessToken: tok || null, toolsUrl: location.origin + "/api/tools" }), signal: ctrl.signal });
    }).then(function (r) { if (!r.ok) throw new Error("агентът върна HTTP " + r.status); return r.json(); })
      .then(function (d) { if (Array.isArray(d)) d = d[0]; var out = d && (d.output || d.text || d.answer); if (typeof out !== "string" || !out.trim()) throw new Error("невалиден отговор от агента"); return { ok: true, text: out, actions: [], model: "n8n", model_name: "Агент n8n" }; })
      .catch(function (e) { return { ok: false, error: e && e.name === "AbortError" ? "Агентът в n8n не отговори навреме." : "Агент n8n: " + ((e && e.message) || e) }; })
      .then(function (j) { clearTimeout(timer); return j; });
  }
  function ask(history) {
    if (modelId === "n8n") return askN8n(history);
    return token().then(function (tok) {
      var h = { "Content-Type": "application/json" }; if (tok) h.Authorization = "Bearer " + tok;
      return fetch("/api/assistant", { method: "POST", headers: h, body: JSON.stringify({ messages: history, page: document.title, model: modelId || undefined }) });
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); })
      .catch(function (e) { return { ok: false, error: "Няма връзка (" + ((e && e.message) || e) + ")" }; });
  }

  /* ---- widget ---- */
  var skills = [], skill = null, win, fab, list, menu, foot, booted = false, hist = [];
  var STORE = "nd-ash-chat";
  try { hist = JSON.parse(sessionStorage.getItem(STORE) || "[]") || []; } catch (e) { hist = []; }
  function save() { try { sessionStorage.setItem(STORE, JSON.stringify(hist.slice(-30).map(function (m) { return { role: m.role, text: m.text }; }))); } catch (e) {} }
  function add(role, html, cls) { var m = document.createElement("div"); m.className = "nda-m " + role + (cls ? " " + cls : ""); m.innerHTML = html; list.appendChild(m); if (role === "a" && cls !== "wait") speaker(m); list.scrollTop = list.scrollHeight; return m; }

  /* ---- listen to an answer (Gemini TTS, falls back to the phone's own Bulgarian voice) ---- */
  var player = null, playingBtn = null;
  function stopAll() {
    if (player) { try { player.pause(); } catch (e) {} }
    try { speechSynthesis.cancel(); } catch (e) {}
    if (playingBtn) playingBtn.classList.remove("on", "ld"); playingBtn = null;
  }
  function plain(el) { var c = el.cloneNode(true); [].forEach.call(c.querySelectorAll(".nda-say,.acts,a.go"), function (x) { x.remove(); }); [].forEach.call(c.querySelectorAll("tr"), function (tr) { tr.appendChild(document.createTextNode(". ")); }); return c.textContent.replace(/[•✔📁📎🎤]/g, " ").replace(/\s+/g, " ").trim(); }
  function speakLocal(text, btn) {
    try {
      var u = new SpeechSynthesisUtterance(text); u.lang = "bg-BG"; u.rate = 1;
      var v = speechSynthesis.getVoices().filter(function (x) { return /^bg/i.test(x.lang); })[0]; if (v) u.voice = v;
      u.onend = u.onerror = function () { if (playingBtn === btn) stopAll(); };
      btn.classList.remove("ld"); btn.classList.add("on"); speechSynthesis.speak(u);
    } catch (e) { stopAll(); }
  }
  function speaker(m) {
    if (m.querySelector(".nda-say")) return;
    var b = document.createElement("button"); b.type = "button"; b.className = "nda-say"; b.setAttribute("aria-label", "Чуй отговора"); b.title = "Чуй"; b.innerHTML = I.spk;
    b.onclick = function () {
      if (playingBtn === b) { stopAll(); return; }
      stopAll(); playingBtn = b; b.classList.add("ld");
      if (!player) player = new Audio();
      /* unlock audio inside the tap (iPhone) */
      try { player.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA="; var pp = player.play(); if (pp && pp.catch) pp.catch(function () {}); } catch (e) {}
      var text = plain(m);
      var go = function (url) {
        if (playingBtn !== b) return;
        player.src = url; player.onended = function () { if (playingBtn === b) stopAll(); };
        b.classList.remove("ld"); b.classList.add("on");
        var p = player.play(); if (p && p.catch) p.catch(function () { speakLocal(text, b); });
      };
      if (b._url) return go(b._url);
      token().then(function (tk) { return fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify({ text: text }) }); })
        .then(function (r) { if (!r.ok) throw new Error("tts"); return r.blob(); })
        .then(function (bl) { b._url = URL.createObjectURL(bl); go(b._url); })
        .catch(function () { if (playingBtn === b) speakLocal(text, b); });
    };
    m.appendChild(b);
  }
  /* markdown links and bare URLs become real links; PDF links get a download badge */
  function fmt(t) {
    var h = esc(t).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|\n)[*-] /g, "$1• ");
    h = h.replace(/\[([^\]]{1,120})\]\((https?:[^)\s]+)\)/g, function (m, a, u) { return '<a class="nda-dl" href="' + u + '" target="_blank" rel="noopener">' + (/\.pdf/i.test(a + u) ? "📄 " : "🔗 ") + a + "</a>"; });
    h = h.replace(/(^|[^"'>=])(https?:\/\/[^\s<)]+)/g, function (m, pre, u) { return pre + '<a class="nda-dl" href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https?:\/\//, "").slice(0, 60) + (u.length > 68 ? "…" : "") + "</a>"; });
    return h;
  }

  var chatSkill = {
    id: "chat", name: "Чат с Тед Асистент", sub: "Клиенти, имоти, календар, сделки, изчисления",
    intro: function (api) {
      if (hist.length) hist.forEach(function (m) { api.add(m.role === "user" ? "u" : "a", fmt(m.text)); });
      else api.add("a", "Здравейте! Аз съм <b>Тед Асистент</b> на Имоти Надежда.\nПитайте ме за клиенти, имоти, огледи, сделки, ипотека или комисионна – работя с реалните данни в CRM." +
        "\nНапример: „Намери тристайни в Шумен до 100 000 €“, „Добави клиент Мария, 0888…, търси двустаен под наем във Варна“, „Какво имам утре?“");
    },
    footer: function () {
      return '<div class="nda-files"></div><div class="nda-c"><button type="button" class="att" aria-label="Прикачи снимка или PDF">' + I.clip + '</button><textarea rows="1" placeholder="Съобщение…" aria-label="Съобщение до Тед Асистент"></textarea><button type="button" class="mic" aria-label="Гласово съобщение">' + I.mic + '</button><button type="button" class="snd" aria-label="Изпрати">' + I.send + "</button></div>";
    },
    bind: function (api, el) {
      var ta = el.querySelector("textarea"), files = [], fl = el.querySelector(".nda-files"), busy = false;
      function showFiles() { fl.innerHTML = files.map(function (f) { return "<span>" + esc(f.name) + "</span>"; }).join(""); }
      function go(voice) {
        var text = ta.value.trim(); if ((!text && !files.length && !voice) || busy) return;
        busy = true; ta.value = ""; var fs = files; files = []; showFiles();
        var ub = api.add("u", voice ? "🎤 Гласово съобщение (" + voice.dur + ")" : fmt(text || "Прикачени файлове") + (fs.length ? "\n📎 " + fs.map(function (f) { return esc(f.name); }).join(", ") : ""));
        var w = api.add("a", voice ? "Слушам" : "Мисля", "wait");
        Promise.all(fs.map(fileData)).then(function (fd) {
          var cur = { role: "user", text: voice ? "(гласово съобщение)" : (text || "Анализирай прикачените файлове."), files: fd.filter(Boolean).concat(voice ? [{ mime: voice.mime, data: voice.data }] : []) };
          var send = hist.slice(-14).map(function (m) { return { role: m.role, text: m.text }; }).concat([cur]);
          return ask(send).then(function (j) {
            w.classList.remove("wait"); busy = false;
            if (!j.ok) { w.innerHTML = esc(j.error || "Грешка"); return; }
            w.innerHTML = fmt(j.text) + (j.actions && j.actions.length ? '<span class="acts">✔ ' + esc(j.actions.join(" · ")) + "</span>" : "") + (j.fallback ? '<div class="nda-fb">' + esc(j.fallback) + "</div>" : ""); speaker(w);
            if (voice && j.transcript) { ub.innerHTML = "🎤 „" + esc(j.transcript) + "“"; cur.text = j.transcript; }
            if (!voice || j.transcript) { hist.push({ role: "user", text: cur.text }, { role: "assistant", text: j.text }); save(); }
            if (voice) { var sb = w.querySelector(".nda-say"); if (sb) sb.click(); } /* a voice question gets a spoken answer */
            if (j.actions && j.actions.some(function (a) { return !/search|list|get|calc|rates|summary|match|✗/.test(a); })) try { window.dispatchEvent(new CustomEvent("nd-data-changed")); } catch (e) {}
          });
        });
      }
      el.querySelector(".snd").onclick = function () { go(); };
      /* ---- voice message: tap the microphone, speak, tap again to send ---- */
      var mic = el.querySelector(".mic"), rec = null, chunks = [], t0 = 0, tick = null, stream = null;
      function mm() { var c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"]; for (var i = 0; i < c.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i]; return ""; }
      function dur() { var s = Math.round((Date.now() - t0) / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
      function endRec() { clearInterval(tick); mic.classList.remove("rec"); mic.innerHTML = I.mic; ta.classList.remove("rec"); ta.readOnly = false; ta.value = ""; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      mic.onclick = function () {
        if (busy) return;
        if (rec && rec.state === "recording") { rec.stop(); return; }
        if (!navigator.mediaDevices || !window.MediaRecorder) { api.add("a", "Този браузър не поддържа запис на глас. Отворете сайта в Safari или Chrome."); return; }
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (st) {
          stream = st; chunks = []; var type = mm();
          rec = type ? new MediaRecorder(st, { mimeType: type }) : new MediaRecorder(st);
          rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          rec.onstop = function () {
            var d = dur(), mime = (rec.mimeType || type || "audio/webm").split(";")[0]; endRec();
            if (Date.now() - t0 < 700 || !chunks.length) return;
            var blob = new Blob(chunks, { type: mime }), r = new FileReader();
            r.onload = function () { go({ mime: mime, data: String(r.result).split(",")[1], dur: d }); };
            r.readAsDataURL(blob);
          };
          rec.start(); t0 = Date.now(); stopAll();
          mic.classList.add("rec"); mic.innerHTML = I.stop; ta.classList.add("rec"); ta.readOnly = true; ta.value = "● Записвам 0:00";
          tick = setInterval(function () { ta.value = "● Записвам " + dur(); if (Date.now() - t0 > 120000) rec.stop(); }, 500);
        }).catch(function () { api.add("a", "Няма достъп до микрофона. Разрешете микрофона за този сайт в настройките на браузъра."); });
      };
      ta.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } };
      ta.oninput = function () { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; };
      el.querySelector(".att").onclick = function () {
        var i = document.createElement("input"); i.type = "file"; i.multiple = true; i.accept = "image/*,application/pdf"; i.style.cssText = "position:fixed;left:-999px;opacity:0"; document.body.appendChild(i);
        i.onchange = function () { files = files.concat([].slice.call(i.files || [])).slice(0, 3); i.remove(); showFiles(); }; i.click();
      };
    }
  };
  skills.push(chatSkill);

  var api = { add: function (r, h, c) { return add(r, h, c); }, esc: esc, list: function () { return list; } };
  function setSkill(s) {
    skill = s; win.querySelector(".nda-skill span").textContent = s.name; list.innerHTML = "";
    foot.innerHTML = s.footer ? s.footer() : ""; s.intro(api); if (s.bind) s.bind(api, foot);
  }
  function renderMenu() { menu.innerHTML = skills.map(function (s, i) { return '<button type="button" role="option" data-i="' + i + '" class="' + (s === skill ? "on" : "") + '">' + esc(s.name) + "<small>" + esc(s.sub || "") + "</small></button>"; }).join(""); }
  function boot() {
    if (booted) return; booted = true;
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    fab = document.createElement("button"); fab.type = "button"; fab.className = "nda-fab"; fab.setAttribute("aria-label", "Тед Асистент"); fab.title = "Тед Асистент";
    fab.innerHTML = '<img src="' + BOT + '" alt="">';
    win = document.createElement("section"); win.className = "nda-win"; win.hidden = true; win.setAttribute("role", "dialog"); win.setAttribute("aria-label", "Тед Асистент");
    win.innerHTML = '<header class="nda-h"><span class="nda-av"><img src="' + BOT + '" alt=""></span><div class="nda-t"><b>Тед Асистент</b><div class="nda-row"><button type="button" class="nda-skill" aria-haspopup="listbox" aria-expanded="false"><span></span>' + I.chev + '</button><button type="button" class="nda-skill nda-model" aria-haspopup="listbox" aria-expanded="false" title="Модел на изкуствения интелект"><i></i><span>Модел</span>' + I.chev + "</button></div></div>" +
      '<button type="button" class="nda-x" aria-label="Затвори">' + I.x + '</button><div class="nda-menu" role="listbox" hidden></div></header><div class="nda-list" aria-live="polite"></div><div class="nda-foot"></div>';
    document.body.appendChild(fab); document.body.appendChild(win);
    list = win.querySelector(".nda-list"); menu = win.querySelector(".nda-menu"); foot = win.querySelector(".nda-foot");
    var sk = win.querySelector(".nda-skill:not(.nda-model)"), mk = win.querySelector(".nda-model");
    sk.onclick = function (e) { e.stopPropagation(); menu.classList.remove("models"); menu.style.top = ""; renderMenu(); menu.hidden = !menu.hidden; sk.setAttribute("aria-expanded", String(!menu.hidden)); };
    /* меню с моделите: списъкът идва от сървъра (само доставчици с ключ); изборът се помни за този брокер */
    mk.onclick = function (e) { e.stopPropagation(); if (!menu.hidden && menu.classList.contains("models")) { menu.hidden = true; return; } loadModels().then(function () { menu.classList.add("models"); renderModels(); menu.style.top = (mk.offsetTop + mk.offsetHeight + 8) + "px"; menu.hidden = false; mk.setAttribute("aria-expanded", "true"); }); };
    menu.onclick = function (e) {
      var mb = e.target.closest("[data-m]"); if (mb) { menu.hidden = true; setModel(mb.getAttribute("data-m")); return; }
      var b = e.target.closest("[data-i]"); if (!b) return; menu.hidden = true; setSkill(skills[+b.getAttribute("data-i")]); };
    win.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target) && !sk.contains(e.target) && !mk.contains(e.target)) menu.hidden = true; });
    loadModels().then(function () { setModel(modelId, true); });
    fab.onclick = function () { win.hidden = false; fab.hidden = true; if (!skill) setSkill(skills[0]); if (skill.open) skill.open(api); };
    win.querySelector(".nda-x").onclick = function () { win.hidden = true; fab.hidden = false; };
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !win.hidden) { win.hidden = true; fab.hidden = false; } });
    if (/\/mobile\/crm\//.test(location.pathname)) { fab.style.bottom = "calc(96px + env(safe-area-inset-bottom,0px))"; fab.style.zIndex = "45";
      var sync = function () { fab.style.visibility = document.documentElement.classList.contains("locked") ? "hidden" : ""; };
      new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); sync(); }
    hideOnCrmRoute(); addEventListener("hashchange", hideOnCrmRoute);
  }
  /* the old desktop CRM (#/crm…) has its own assistant panel connected to the same API */
  function hideOnCrmRoute() { var crm = /^#\/crm/.test(location.hash || "") && !/\/mobile\/crm\//.test(location.pathname); fab.style.display = crm ? "none" : ""; if (crm) win.hidden = true; }

  window.NDAsh = {
    ask: ask, token: token, esc: esc, fmt: fmt,
    addSkill: function (s, first) { if (typeof first === "number") skills.splice(Math.min(first, skills.length), 0, s); else if (first) skills.unshift(s); else skills.push(s); if (booted && !skill) setSkill(skills[0]); },
    open: function () { boot(); fab.click(); },
    hide: function () { if (win && !win.hidden) { win.hidden = true; fab.hidden = false; } },
    show: function () { if (win) { win.hidden = false; fab.hidden = true; list.scrollTop = list.scrollHeight; } },
    boot: boot
  };
  if (!window.NDAshNoWidget) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot(); }
})();
