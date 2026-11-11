/* ИМОТИ НАДЕЖДА CRM · Ново строителство · „Импорт на проект“ (TASK-006).
   Самостоятелен файл: единственият глобален обект е window.NCImport = { open(opts), version }.
   opts = { projectId: string|null, onDone: function(projectId) }.
   Поток: избор (файлове / папка / ZIP) → качване в projects/<id>/private/imports/<import>/… със сесията на служителя
   (до 6 MB – обикновено; над 6 MB – възобновяемо качване TUS) → imports.start → напредък с jobs.status (и отмяна) →
   преглед (полета с източник, конфликти, липси, предупреждения, предложени записи – нищо не се записва преди потвърждение) →
   imports.apply → onDone(projectId). Сървърът е същият, който ползва и Тед: POST /api/tools с токена на служителя.
   Стил: същият стъклен вид с преливащ блясък като прозореца „Сканиране“ (crm-scan.js) и секциите на NDUI; без нови шрифтове и blur.
   Тематични снимки (TASK-003, D6): ph27 – файлове/преглед, ph24 – обработка; само в горната лента, никога зад списъци и таблици. */
(function () {
  "use strict";
  if (window.NCImport) return;
  var VERSION = "1.1.0";
  var MB = 1048576, MAX_FILES = 2000, MAX_BYTES = 40 * MB, SMALL = 6 * MB, TUS_CHUNK = 6 * MB, POLL_MS = 2500;
  var CARD_W = 1060, CARD_H = 660, ZMAX = 1.4, LAST = "nci-last:";
  var SKIP = /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|\._[^/]*)$|(^|\/)__MACOSX\//i;
  var IMG = { up: "/mobile/crm/assets/nd/ph27", proc: "/mobile/crm/assets/nd/ph24" };

  var css = [
    ".nci-ov{position:fixed;inset:0;z-index:95;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(120% 90% at 50% 0%,rgba(110,14,34,.82),rgba(20,2,7,.94));font-family:var(--cond,'Roboto Condensed'),system-ui,sans-serif}",
    ".nci-ov[hidden],.nci-ov [hidden]{display:none!important}",
    "html.rail .nci-ov{left:var(--rail,112px)}",
    ".nci-card:focus{outline:0}",
    ".nci-card{position:relative;display:flex;flex-direction:column;width:min(1060px,100%);max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);border-radius:26px;overflow:hidden;background:linear-gradient(165deg,rgba(122,16,38,.97) 0%,rgba(74,8,24,.97) 48%,rgba(42,4,14,.98) 100%);border:1.5px solid #d9a95a;box-shadow:0 0 0 1px rgba(255,226,160,.18) inset,0 0 28px rgba(227,178,94,.5),0 24px 60px rgba(10,0,4,.7);color:#fbefe0}",
    ".nci-card::before{content:\"\";position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;background:linear-gradient(115deg,rgba(255,236,190,.16) 0%,rgba(255,236,190,0) 28%,rgba(255,236,190,0) 72%,rgba(255,214,150,.12) 100%)}",
    ".nci-card>*{position:relative;z-index:1}",
    ".nci-hero{position:relative;flex:0 0 auto;min-height:112px;padding:16px 70px 14px 24px;overflow:hidden;isolation:isolate;background:linear-gradient(180deg,rgba(96,10,30,.96),rgba(58,6,20,.94));border-bottom:1.5px solid rgba(227,178,94,.6);box-shadow:0 6px 18px rgba(10,0,4,.35)}",
    ".nci-hero-img{position:absolute;right:0;top:0;bottom:0;width:54%;z-index:-1;background-size:cover;background-position:center;filter:saturate(1.05) contrast(1.05) brightness(.92);-webkit-mask-image:linear-gradient(270deg,#000 40%,rgba(0,0,0,.6) 70%,transparent 100%);mask-image:linear-gradient(270deg,#000 40%,rgba(0,0,0,.6) 70%,transparent 100%)}",
    ".nci-hero h3{margin:0;max-width:60%;font:700 25px/1.15 var(--serif,Georgia),serif;background:linear-gradient(180deg,#fff3d2,#f0c77c 55%,#c9913f);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 3px rgba(20,0,6,.7))}",
    ".nci-hero p{margin:6px 0 0;max-width:56%;font:400 15px/1.35 var(--cond,'Roboto Condensed'),sans-serif;color:#f8e6d2;text-shadow:0 1px 3px rgba(20,0,6,.85)}",
    ".nci-steps{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;max-width:62%}",
    ".nci-steps span{padding:4px 10px;border-radius:12px;font:700 12.5px/1 var(--cond,'Roboto Condensed'),sans-serif;color:#f3dcc0;background:rgba(40,4,12,.55);box-shadow:0 0 0 1px rgba(227,178,94,.5)}",
    ".nci-steps span.on{color:#4e0912;background:linear-gradient(180deg,#fbe3a6,#e2b25f 60%,#c48b3a);box-shadow:0 0 0 1.5px #ffe7b0,0 0 12px rgba(255,200,120,.75)}",
    ".nci-steps span.ok{color:#d8f0c6;background:rgba(40,70,24,.55);box-shadow:0 0 0 1px rgba(150,200,110,.6)}",
    ".nci-close{position:absolute;right:14px;top:14px;z-index:2;width:40px;height:40px;border:0;border-radius:50%;display:grid;place-items:center;cursor:pointer;font:700 20px/1 sans-serif;color:#4e0912;background:radial-gradient(circle at 35% 28%,#fff6dc,#f0c77c 60%,#c48b3a);box-shadow:0 0 0 1.5px #ffe7b0,0 0 14px rgba(255,200,120,.75)}",
    ".nci-body{flex:1 1 auto;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:16px 20px 8px}",
    ".nci-foot{flex:0 0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:10px;padding:12px 20px 14px;border-top:1px solid rgba(227,178,94,.5);background:linear-gradient(180deg,rgba(58,6,20,.6),rgba(36,3,12,.92))}",
    ".nci-foot .grow{flex:1 1 200px;font:600 14px/1.35 var(--cond,'Roboto Condensed'),sans-serif;color:#f6dcb6}",
    ".nci-b{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 20px;border:0;border-radius:22px;cursor:pointer;font:700 15.5px/1 var(--cond,'Roboto Condensed'),sans-serif;color:#fbe9cf;background:linear-gradient(180deg,rgba(150,26,52,.95),rgba(84,8,26,.95));box-shadow:0 0 0 1.5px #d9a95a,0 0 10px rgba(255,200,120,.4);transition:transform .2s,box-shadow .2s}",
    ".nci-b:hover{transform:translateY(-1px);box-shadow:0 0 0 1.5px #ffe0a0,0 0 18px rgba(255,214,150,.85)}",
    ".nci-b.pri{color:#4e0912;background:linear-gradient(180deg,#fff0c4,#f0c77c 50%,#c9913f);box-shadow:0 0 0 1.5px #ffe7b0,0 0 16px rgba(255,200,120,.7)}",
    ".nci-b.rm{color:#ffd9d9}",
    ".nci-b:disabled{opacity:.5;cursor:not-allowed;transform:none}",
    ".nci-b svg{width:18px;height:18px;flex:0 0 auto}",
    ".nci-drop{display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px 16px;border-radius:22px;border:2.5px dashed rgba(160,26,51,.5);background:linear-gradient(180deg,rgba(255,253,249,.92),rgba(251,239,229,.9));box-shadow:0 0 10px rgba(255,226,190,.8);text-align:center}",
    ".nci-drop.over{border-color:#a3213a;box-shadow:0 0 0 2px #edc47a,0 0 18px rgba(255,190,120,.7)}",
    ".nci-drop b{font:700 18px/1.2 var(--cond,'Roboto Condensed'),sans-serif;color:#8d1530}",
    ".nci-drop small{font:400 14px/1.35 var(--cond,'Roboto Condensed'),sans-serif;color:#3a1a14}",
    ".nci-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}",
    ".nci-fld{display:grid;gap:6px;margin:0 0 14px}",
    ".nci-fld label{font:700 14px/1 var(--cond,'Roboto Condensed'),sans-serif;color:#f6d48e}",
    ".nci-in{box-sizing:border-box;width:100%;height:44px;border:0;border-radius:22px;padding:0 16px;font:400 16px/1 var(--cond,'Roboto Condensed'),sans-serif;color:#1f1111;background:linear-gradient(180deg,#fffdf9,#fcf2e8);box-shadow:0 0 0 1.5px rgba(222,184,150,.8),0 2px 4px rgba(140,70,40,.08)}",
    ".nci-in:focus{outline:0;box-shadow:0 0 0 2px #d9a95a,0 0 10px rgba(217,169,90,.55)}",
    ".nci-in.sm{height:34px;border-radius:17px;padding:0 10px;font-size:14px;width:auto;min-width:0}",
    ".nci-in.bad{box-shadow:0 0 0 2.5px #c81a3a,0 0 10px rgba(200,26,58,.35)}",
    ".nci-panel{margin:0 0 14px;padding:12px 14px;border-radius:20px;background:linear-gradient(180deg,rgba(255,252,249,.97),rgba(252,240,231,.95));box-shadow:0 0 0 1px rgba(226,176,120,.45),0 0 14px rgba(255,230,204,.9)}",
    ".nci-panel h4{margin:0 0 8px;font:700 16px/1.2 var(--serif,Georgia),serif;color:#6b0a1c}",
    ".nci-note{margin:0 0 12px;padding:10px 14px;border-radius:16px;font:600 14px/1.4 var(--cond,'Roboto Condensed'),sans-serif;color:#6b0a1c;background:linear-gradient(180deg,rgba(255,251,247,.9),rgba(251,238,227,.9));box-shadow:0 0 0 1px rgba(227,178,94,.45)}",
    ".nci-note.warn{color:#7a3b00;background:#fff6e5;box-shadow:0 0 0 1px rgba(230,160,60,.6)}",
    ".nci-note.err{color:#8a1020;background:#fff0f0;box-shadow:0 0 0 1px rgba(200,26,58,.45)}",
    ".nci-note.ok{color:#2f5e1e;background:#f3faea;box-shadow:0 0 0 1px rgba(120,170,90,.6)}",
    ".nci-note small{display:block;margin-top:4px;font-weight:400;color:#6b4a40}",
    ".nci-list{display:grid;gap:6px;margin:0;padding:0;list-style:none}",
    ".nci-list li{display:flex;align-items:center;gap:10px;min-height:38px;padding:6px 12px;border-radius:14px;background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1px rgba(227,178,94,.45);font:400 14px/1.25 var(--cond,'Roboto Condensed'),sans-serif}",
    ".nci-list li .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#2b1414}",
    ".nci-list li .tg{flex:0 0 auto;padding:3px 8px;border-radius:10px;font:700 12px/1 var(--cond,'Roboto Condensed'),sans-serif;color:#6b0a1c;background:rgba(237,196,122,.25)}",
    ".nci-list li .tg.bad{color:#8a1020;background:#ffe5e5}.nci-list li .tg.ok{color:#2f5e1e;background:#e8f5dc}.nci-list li .tg.info{color:#4e3a7a;background:#efeafd}",
    ".nci-list li .sz{flex:0 0 auto;color:#6b4a40;font-size:13px}",
    ".nci-bar{position:relative;height:12px;border-radius:6px;overflow:hidden;background:rgba(20,2,7,.55);box-shadow:inset 0 0 0 1px rgba(227,178,94,.55)}",
    ".nci-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,#a3213a,#d9a95a,#f3cf86);box-shadow:0 0 10px rgba(243,207,134,.8);transition:width .3s}",
    ".nci-bar.ind i{width:35%!important;animation:nciInd 1.4s ease-in-out infinite alternate}",
    "@keyframes nciInd{from{left:0}to{left:65%}}",
    ".nci-stat{display:flex;justify-content:space-between;gap:10px;margin:8px 0 14px;font:600 14px/1.3 var(--cond,'Roboto Condensed'),sans-serif;color:#fbe9cf}",
    ".nci-phases{display:grid;gap:8px;margin:0 0 14px}",
    ".nci-phases div{display:flex;align-items:center;gap:10px;font:600 15px/1.3 var(--cond,'Roboto Condensed'),sans-serif;color:#d9bfa4}",
    ".nci-phases div b{flex:0 0 26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;color:#f3dcc0;background:rgba(40,4,12,.6);box-shadow:0 0 0 1.5px rgba(227,178,94,.6)}",
    ".nci-phases div.on{color:#fff3dc}.nci-phases div.on b{color:#4e0912;background:linear-gradient(180deg,#fbe3a6,#e2b25f 60%,#c48b3a);box-shadow:0 0 0 1.5px #ffe7b0,0 0 10px rgba(255,200,120,.7)}",
    ".nci-phases div.ok b{color:#fff;background:#4f8a32;box-shadow:none}",
    ".nci-scan{position:relative;overflow:hidden;border-radius:18px;padding:12px;background:linear-gradient(180deg,#fffdf9,#f3e1d1);box-shadow:0 0 0 2px #e3b25e,0 0 16px rgba(227,178,94,.45)}",
    ".nci-scan .ln{position:absolute;left:-4%;right:-4%;height:3px;top:0;background:linear-gradient(90deg,transparent,#f3cf86 15%,#fff6d8 50%,#f3cf86 85%,transparent);box-shadow:0 0 14px 4px rgba(243,207,134,.85),0 0 40px 10px rgba(180,36,70,.35);animation:nciScan 1.7s ease-in-out infinite alternate;pointer-events:none}",
    "@keyframes nciScan{from{top:2%}to{top:97%}}",
    "@media (prefers-reduced-motion:reduce){.nci-scan .ln,.nci-bar.ind i{animation:none}}",
    ".nci-tabs{display:flex;gap:6px;overflow-x:auto;margin:0 0 12px;padding:2px 2px 6px;scrollbar-width:thin}",
    ".nci-tabs button{flex:0 0 auto;min-height:36px;padding:0 14px;border:0;border-radius:18px;cursor:pointer;font:700 14px/1 var(--cond,'Roboto Condensed'),sans-serif;color:#fbe9cf;background:linear-gradient(180deg,rgba(150,26,52,.95),rgba(84,8,26,.95));box-shadow:0 0 0 1.2px #d9a95a,0 0 8px rgba(255,200,120,.3)}",
    ".nci-tabs button.on{color:#4e0912;background:linear-gradient(180deg,#fff0c4,#f0c77c 50%,#c9913f);box-shadow:0 0 0 1.5px #ffe7b0,0 0 12px rgba(255,200,120,.7)}",
    ".nci-tabs button .n{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:9px;font-size:12px;background:rgba(255,255,255,.3)}",
    ".nci-tabs button.alert .n{color:#fff;background:#c81a3a}",
    ".nci-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin:0 0 14px}",
    ".nci-kpis div{padding:10px 12px;border-radius:16px;background:linear-gradient(180deg,#fffbf7,#fbeee3);box-shadow:0 0 0 1px rgba(226,176,120,.55),0 0 10px rgba(255,226,190,.8)}",
    ".nci-kpis span{display:block;font:700 12.5px/1.1 var(--cond,'Roboto Condensed'),sans-serif;color:#6b0a1c}",
    ".nci-kpis b{display:block;margin-top:6px;font:700 22px/1 var(--serif,Georgia),serif;color:#4e0912}",
    ".nci-kpis div.alert{box-shadow:0 0 0 1.5px #c81a3a,0 0 10px rgba(200,26,58,.25)}",
    ".nci-tw{overflow:auto;border-radius:16px;box-shadow:0 0 0 1px rgba(226,176,120,.55);background:#fffdf9}",
    ".nci-t{width:100%;border-collapse:collapse;font:400 13.5px/1.25 var(--cond,'Roboto Condensed'),sans-serif}",
    ".nci-t th{position:sticky;top:0;z-index:1;padding:8px 8px;text-align:left;font-weight:700;color:#fff3dc;background:linear-gradient(180deg,#8d1530,#55071a);white-space:nowrap}",
    ".nci-t td{padding:6px 8px;border-top:1px solid rgba(226,176,120,.35);vertical-align:middle;white-space:nowrap}",
    ".nci-t tr.off td{opacity:.5}",
    ".nci-t td.num{text-align:right;font-variant-numeric:tabular-nums}",
    ".nci-v{cursor:help;border-bottom:1px dotted rgba(141,21,48,.5)}",
    ".nci-v.man{color:#4e3a7a}.nci-v.der{color:#7a3b00}",
    ".nci-c{color:#c81a3a;font-weight:700}",
    ".nci-src{display:block;font-size:11.5px;color:#6b4a40}",
    ".nci-tip{white-space:normal;max-width:280px;margin-top:2px;padding:3px 6px;border-radius:8px;background:rgba(237,196,122,.22);text-align:left}",
    ".nci-cf{margin:0 0 12px;padding:12px 14px;border-radius:18px;background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1.5px rgba(200,26,58,.35),0 0 10px rgba(255,226,190,.8)}",
    ".nci-cf.done{box-shadow:0 0 0 1.5px rgba(120,170,90,.6)}",
    ".nci-cf p{margin:0 0 8px;font:700 14.5px/1.3 var(--cond,'Roboto Condensed'),sans-serif;color:#4e0912}",
    ".nci-cf label{display:flex;align-items:center;gap:8px;margin:4px 0;font:400 14px/1.3 var(--cond,'Roboto Condensed'),sans-serif;cursor:pointer}",
    ".nci-cf label small{color:#6b4a40}",
    ".nci-chk{width:20px;height:20px;accent-color:#8d1530;flex:0 0 auto;cursor:pointer}",
    ".nci-cards{display:none}",
    "@media (max-height:700px) and (min-width:721px){.nci-ov{padding:10px}.nci-card{max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px)}.nci-hero{min-height:92px;padding:12px 66px 10px 22px}.nci-hero h3{font-size:22px}.nci-hero p{font-size:14px;margin-top:4px}.nci-steps{margin-top:7px}.nci-body{padding:12px 18px 6px}.nci-foot{padding:9px 18px 11px}.nci-b{min-height:40px}}",
    "@media (max-width:720px){.nci-ov{padding:0;align-items:stretch}.nci-card{max-height:none;height:100%;border-radius:0;border-width:0}.nci-hero{min-height:104px;padding:14px 60px 12px 16px}.nci-hero h3{font-size:20px;max-width:70%}.nci-hero p{max-width:66%;font-size:13.5px}.nci-steps{max-width:72%}.nci-hero-img{width:58%}.nci-body{padding:12px 12px 6px}.nci-foot{padding:10px 12px calc(12px + env(safe-area-inset-bottom,0px))}.nci-foot .nci-b{flex:1 1 auto}.nci-desk{display:none}.nci-cards{display:grid;gap:8px}}",
    ".nci-u{padding:10px 12px;border-radius:16px;background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1px rgba(227,178,94,.5);font:400 14px/1.35 var(--cond,'Roboto Condensed'),sans-serif}",
    ".nci-u.off{opacity:.55}",
    ".nci-u .h{display:flex;align-items:center;gap:8px;font-weight:700;color:#4e0912}",
    ".nci-u .g{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;margin-top:6px}",
    ".nci-tw,.nci-panel,.nci-kpis div,.nci-cf,.nci-u,.nci-list li,.nci-note,.nci-drop,.nci-scan{color:#1f1111}",
    ".nci-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}"
  ].join("\n");

  /* ---------- общи помощници ---------- */
  var U = function () { return window.NDUI || {}; };
  function esc(s) { return U().esc ? U().esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function say(m) { if (window.ND && ND.say) ND.say(m); }
  function size(b) { return b >= MB ? (b / MB).toFixed(b >= 10 * MB ? 0 : 1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; }
  function num(v) { return v == null ? "—" : String(v).replace(".", ","); }
  function money(v) { return v == null ? "—" : new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 2 }).format(v) + " €"; }
  function hex(buf) { var a = new Uint8Array(buf), s = ""; for (var i = 0; i < a.length; i++) s += (a[i] < 16 ? "0" : "") + a[i].toString(16); return s; }
  function sha256(data) { return crypto.subtle.digest("SHA-256", data).then(hex); }
  function uuid() { if (crypto.randomUUID) return crypto.randomUUID(); var b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; var h = hex(b); return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20); }
  function safeName(n) { return (String(n || "file").split("/").pop().normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^[._]+/, "").slice(-80)) || "file"; }
  function sleep(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function img(base) { return "image-set(url(" + base + ".webp) type(\"image/webp\"),url(" + base + ".jpg) type(\"image/jpeg\"))"; }
  var ICON = {
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
    zip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
  };

  /* ---------- сървър: същият gateway като останалия CRM ---------- */
  function api(tool, input) {
    return ND.token().then(function (tok) {
      if (!tok) throw Object.assign(new Error("Сесията е изтекла – влезте отново в CRM"), { code: "AUTH_REQUIRED" });
      return fetch("/api/tools", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ tool: tool, input: input }) });
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "Сървърът не отговори (HTTP " + r.status + ")" }; }).then(function (j) {
        if (r.ok && j.ok) return j.result;
        var msg = String(j.error || "Грешка"), m = /\s*\[([A-Z_]+) · ([\w-]+)\]\s*$/.exec(msg);
        var e = new Error(m ? msg.slice(0, m.index) : msg === "Invalid input" ? "Невалидни данни: " + (j.issues || []).slice(0, 3).map(function (x) { return (x.path || []).join(".") + " " + x.message; }).join("; ") : msg);
        e.status = r.status; e.code = m ? m[1] : r.status === 401 ? "AUTH_REQUIRED" : r.status === 403 ? "FORBIDDEN" : r.status === 409 ? "DB_CONFLICT" : r.status >= 500 ? "INTERNAL_ERROR" : "INVALID_PACKAGE";
        e.corr = m ? m[2] : null; e.retryable = r.status >= 500 || r.status === 0; throw e;
      });
    }, function (e) { if (e && e.code) throw e; throw Object.assign(new Error("Няма връзка със сървъра"), { code: "NETWORK", retryable: true }); });
  }

  /* ---------- качване: обикновено (≤ 6 MB) или възобновяемо TUS (над 6 MB, на парчета по 6 MB) ---------- */
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function uploadSmall(path, file) {
    return ND.sb().storage.from("nd-files").upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" }).then(function (r) {
      if (r.error && !/exist|duplicate|409/i.test(String(r.error.message || r.error.statusCode || r.error.error || ""))) throw Object.assign(new Error("Качването не успя: " + (r.error.message || "")), { code: "STORAGE_FAILED", retryable: true });
      return true;
    });
  }
  function tusUpload(path, file, onBytes, isStopped) {
    var c = ND.sb(), base = (c.storageUrl || (c.supabaseUrl ? c.supabaseUrl + "/storage/v1" : "")), key = c.supabaseKey;
    if (!base || !key) return uploadSmall(path, file).then(function () { onBytes(file.size); });
    var memo = "nci-tus:" + path + ":" + file.size;
    return ND.token().then(function (tok) {
      var H = function (x) { return Object.assign({ Authorization: "Bearer " + tok, apikey: key, "Tus-Resumable": "1.0.0" }, x || {}); };
      function create() {
        return fetch(base + "/upload/resumable", { method: "POST", headers: H({ "Upload-Length": String(file.size), "x-upsert": "false", "Upload-Metadata": "bucketName " + b64("nd-files") + ",objectName " + b64(path) + ",contentType " + b64(file.type || "application/octet-stream") + ",cacheControl " + b64("3600") }) }).then(function (r) {
          if (r.status === 409) return null;                                   // вече е качен (същото име = същото съдържание: SHA в името)
          if (r.status !== 201) throw Object.assign(new Error("Възобновяемото качване не започна (HTTP " + r.status + ")"), { code: "STORAGE_FAILED", retryable: true });
          var loc = r.headers.get("Location"); if (!loc) throw Object.assign(new Error("Липсва адрес за качване"), { code: "STORAGE_FAILED" });
          loc = /^https?:/.test(loc) ? loc : new URL(loc, base).href; try { localStorage.setItem(memo, loc); } catch (e) { /* без памет */ }
          return { loc: loc, off: 0 };
        });
      }
      function resume() {
        var loc = null; try { loc = localStorage.getItem(memo); } catch (e) { loc = null; }
        if (!loc) return create();
        return fetch(loc, { method: "HEAD", headers: H() }).then(function (r) { var o = Number(r.headers.get("Upload-Offset")); if (r.ok && isFinite(o)) return { loc: loc, off: o }; try { localStorage.removeItem(memo); } catch (e) { /* */ } return create(); }, create);
      }
      function send(st, tries) {
        if (!st) { onBytes(file.size); return true; }
        if (st.off >= file.size) { try { localStorage.removeItem(memo); } catch (e) { /* */ } onBytes(file.size); return true; }
        if (isStopped()) throw Object.assign(new Error("Качването е спряно"), { code: "CANCELLED" });
        onBytes(st.off);
        return fetch(st.loc, { method: "PATCH", headers: H({ "Upload-Offset": String(st.off), "Content-Type": "application/offset+octet-stream" }), body: file.slice(st.off, Math.min(file.size, st.off + TUS_CHUNK)) }).then(function (r) {
          if (r.status !== 204 && r.status !== 200) throw Object.assign(new Error("HTTP " + r.status), { retry: r.status >= 500 || r.status === 409 });
          return send({ loc: st.loc, off: Number(r.headers.get("Upload-Offset")) || Math.min(file.size, st.off + TUS_CHUNK) }, 0);
        }).catch(function (e) {
          if (e.code === "CANCELLED" || (tries || 0) >= 5) throw e.code ? e : Object.assign(new Error("Връзката прекъсна – натиснете „Опитай отново“, качването ще продължи оттам"), { code: "NETWORK", retryable: true });
          return sleep(1000 * Math.pow(2, tries || 0)).then(function () { return fetch(st.loc, { method: "HEAD", headers: H() }); }).then(function (r) { return send({ loc: st.loc, off: Number(r.headers.get("Upload-Offset")) || st.off }, (tries || 0) + 1); }, function () { return send(st, (tries || 0) + 1); });
        });
      }
      return resume().then(function (st) { return send(st, 0); });
    });
  }

  /* ---------- състояние на диалога ---------- */
  var S = null, ov = null;
  function boot() { if (document.getElementById("nci-css")) return; var st = document.createElement("style"); st.id = "nci-css"; st.textContent = css; document.head.appendChild(st); }
  function open(opts) {
    if (!window.ND || !ND.token || !ND.sb) { console.error("NCImport: ND (crm-data.js) липсва"); return; }
    boot();
    opts = opts || {};
    S = { projectId: opts.projectId || null, onDone: typeof opts.onDone === "function" ? opts.onDone : null, title: "", crid: uuid(), files: [], stage: "idle", tab: "sum", stop: false, job: null, jobId: null, preview: null, edit: null, err: null, admin: false, busy: false };
    if (!ov) {
      ov = document.createElement("div"); ov.className = "nci-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Импорт на проект");
      document.body.appendChild(ov);
      ov.addEventListener("click", onClick); ov.addEventListener("change", onChange); ov.addEventListener("input", onInput);
      ov.addEventListener("dragover", function (e) { var d = e.target.closest && e.target.closest(".nci-drop"); if (d) { e.preventDefault(); d.classList.add("over"); } });
      ov.addEventListener("dragleave", function (e) { var d = e.target.closest && e.target.closest(".nci-drop"); if (d) d.classList.remove("over"); });
      ov.addEventListener("drop", onDrop);
      document.addEventListener("keydown", function (e) {
        if (!ov || ov.hidden) return;
        if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); tryClose(); return; }
        if (e.key === "Tab") {                                                   // фокусът остава в прозореца
          var f = [].filter.call(ov.querySelectorAll("button:not([disabled]),input:not([disabled]),[tabindex='0']"), function (x) { return x.offsetParent !== null; });
          if (!f.length) return;
          if (!ov.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); }
          else if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      }, true);
      addEventListener("resize", fit);
      addEventListener("beforeunload", function (e) { if (ov && !ov.hidden && S && (S.stage === "upload" || S.stage === "commit")) { e.preventDefault(); e.returnValue = ""; } });
    }
    ov.hidden = false; document.documentElement.classList.add("locked");
    try { ND.sb().rpc("nd_is_admin").then(function (r) { S.admin = r && r.data === true; if (S.stage === "review") render(); }); } catch (e) { /* по подразбиране – не */ }
    if (S.projectId) api("projects.get", { id: S.projectId }).then(function (r) { S.title = (r.project.data && r.project.data.title) || r.project.name || ""; S.pstatus = r.project.status; render(); }).catch(function () { /* името не е задължително */ });
    if (S.projectId) findLast(S);
    render();
    var c = ov.querySelector(".nci-card"); if (c) c.focus({ preventScroll: true });
  }
  /* незавършен анализ за този проект (прозорецът е затворен по време на обработка) → предложение „Продължи“ */
  function lastJob(pid, v) {
    try { if (v === undefined) return JSON.parse(localStorage.getItem(LAST + pid) || "null"); if (v) localStorage.setItem(LAST + pid, JSON.stringify(v)); else localStorage.removeItem(LAST + pid); } catch (e) { /* без памет */ }
    return null;
  }
  function findLast(my) {
    var l = lastJob(my.projectId); if (!l || !l.id) return;
    api("jobs.status", { id: l.id }).then(function (j) {
      if (S !== my || my.stage !== "idle") return;
      if (["queued", "running", "review"].indexOf(j.status) < 0) { lastJob(my.projectId, null); return; }
      my.resume = { id: j.id, status: j.status, corr: j.correlation_id, at: l.at, files: (j.progress && j.progress.files_total) || l.files || 0 }; render();
    }).catch(function () { /* няма достъп / изтрита задача → без предложение */ });
  }
  /* на компютър: прозорецът расте според реално измереното свободно място (до ×1.4), без изрязване; на телефон – цял екран */
  function fit() {
    if (!ov || ov.hidden) return;
    var card = ov.querySelector(".nci-card"); if (!card) return;
    if (innerWidth <= 720) { card.style.zoom = ""; card.style.maxHeight = ""; return; }
    var r = ov.getBoundingClientRect(), pad = innerHeight <= 700 ? 20 : 32, aw = r.width - pad, ah = r.height - pad;
    var z = Math.max(1, Math.min(ZMAX, aw / CARD_W, ah / CARD_H));
    card.style.zoom = z > 1.001 ? String(Math.round(z * 1000) / 1000) : "";
    card.style.maxHeight = Math.floor(ah / (z > 1.001 ? z : 1)) + "px";
  }
  function closeNow() { S && (S.stop = true); if (ov) { ov.hidden = true; ov.innerHTML = ""; } document.documentElement.classList.remove("locked"); }
  function tryClose() {
    if (!S) return closeNow();
    if (S.stage === "upload" && !confirm("Качването ще спре. Вече качените файлове остават (може да продължите по-късно със същите файлове). Да затворя ли?")) return;
    if (S.stage === "review" && S.dirty && !confirm("Промените в прегледа няма да се запазят. Черновата остава за преглед по-късно. Да затворя ли?")) return;
    closeNow();
  }

  /* ---------- изглед ---------- */
  var STEPS = [["idle", "Файлове"], ["upload", "Качване"], ["process", "Анализ"], ["review", "Преглед"], ["done", "Чернова"]];
  function hero(title, sub, pic) {
    var order = ["idle", "select", "upload", "process", "review", "commit", "done"], at = order.indexOf(S.stage);
    var steps = STEPS.map(function (s) { var i = order.indexOf(s[0]), on = s[0] === S.stage || (S.stage === "select" && s[0] === "idle") || (S.stage === "commit" && s[0] === "review"); return '<span class="' + (on ? "on" : i < at ? "ok" : "") + '">' + s[1] + "</span>"; }).join("");
    return '<div class="nci-hero"><div class="nci-hero-img" style="background-image:url(' + pic + '.jpg);background-image:' + img(pic) + '"></div>' +
      "<h3>" + esc(title) + "</h3><p>" + sub + '</p><div class="nci-steps" aria-hidden="true">' + steps + '</div><button type="button" class="nci-close" data-a="close" aria-label="Затвори">✕</button></div>';
  }
  function render() {
    if (!ov || !S) return;
    var h = "", body = "", foot = "", st = S.stage, proj = S.title ? "Проект „" + esc(S.title) + "“" : S.projectId ? "Проект" : "Нов проект (чернова)";
    if (st === "idle" || st === "select") {
      h = hero("Импорт на проект", proj + " · изберете папката, файловете или ZIP архива на пакета. Нищо не се публикува – резултатът е чернова за преглед.", IMG.up);
      body = (S.projectId ? "" : '<div class="nci-fld"><label for="nci-title">Име на новия проект *</label><input class="nci-in" id="nci-title" data-k="title" maxlength="200" placeholder="напр. TEST-Жилищна сграда" value="' + esc(S.title) + '"></div>') +
        '<div class="nci-drop" data-drop="1"><b>Пуснете тук папка, файлове или ZIP</b><small>PDF, JPG/PNG/WebP/AVIF, XLSX/ODS/CSV, DWG/DXF/IFC, GLB/glTF, JSON/TXT · до ' + MAX_FILES + " файла · до 40 MB на файл</small>" +
        '<div class="nci-row"><button type="button" class="nci-b" data-a="pick-files">' + ICON.file + 'Файлове</button><button type="button" class="nci-b" data-a="pick-folder">' + ICON.folder + 'Папка</button><button type="button" class="nci-b" data-a="pick-zip">' + ICON.zip + "ZIP архив</button></div></div>";
      if (st === "idle" && S.resume) body = '<div class="nci-note warn" role="status">Има незавършен импорт за този проект (№ ' + esc(S.resume.corr || "") + (S.resume.files ? " · " + S.resume.files + " файла" : "") + (S.resume.at ? " · започнат " + esc(new Date(S.resume.at).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })) : "") + ") – " + (S.resume.status === "review" ? "анализът е готов и чака преглед." : "анализът още върви на сървъра.") +
        '<div class="nci-row" style="justify-content:flex-start;margin-top:8px"><button type="button" class="nci-b pri" data-a="resume">' + (S.resume.status === "review" ? "Към прегледа" : "Продължи") + '</button><button type="button" class="nci-b" data-a="forget">Скрий</button></div></div>' + body;
      if (st === "select") body += fileList();
      else body += '<p class="nci-note" style="margin-top:14px">Препоръчана структура: <b>project-info/ · unit-data/ · floor-plans/ · unit-plans/ · visualizations/ · source-model/ · documents/</b>. Статусите не се внасят (всички нови обекти са Свободни); цената се смята от системата (площ × цена на кв.м).</p>';
      var okF = S.files.filter(function (f) { return f.ok; });
      foot = '<span class="grow" aria-live="polite">' + (st === "select" ? okF.length + " файла за качване · " + size(okF.reduce(function (s, f) { return s + f.size; }, 0)) : "Още няма избрани файлове") + "</span>" +
        (st === "select" ? '<button type="button" class="nci-b rm" data-a="clear">Изчисти</button>' : "") + '<button type="button" class="nci-b" data-a="close">Затвори</button>' +
        '<button type="button" class="nci-b pri" data-a="start"' + (st === "select" && okF.length && (S.projectId || S.title.trim().length >= 2) ? "" : " disabled") + ">Започни импорта</button>";
    } else if (st === "upload") {
      var tot = S.files.filter(function (f) { return f.ok; }), bt = tot.reduce(function (s, f) { return s + f.size; }, 0), bd = tot.reduce(function (s, f) { return s + (f.done || 0); }, 0), nd = tot.filter(function (f) { return f.status === "up"; }).length;
      h = hero(S.hashing ? "Подготовка на файловете" : "Качване на файловете", proj + " · файловете отиват в частната папка на проекта. Процентът е по реално качени байтове.", IMG.up);
      body = '<div class="nci-bar' + (S.hashing ? " ind" : "") + '"><i style="width:' + (bt ? Math.round((bd / bt) * 100) : 0) + '%"></i></div><div class="nci-stat" aria-live="polite"><span>' +
        (S.hashing ? "Контролни суми (SHA-256): " + S.hashed + " / " + tot.length : "Качени: " + nd + " / " + tot.length + " файла · " + size(bd) + " от " + size(bt)) + "</span><span>" + esc(S.current || "") + "</span></div>" + fileList(true);
      foot = '<span class="grow">Може да спрете – вече качените файлове се пазят и при повтор не се качват отново.</span><button type="button" class="nci-b rm" data-a="stop">Спри</button>';
    } else if (st === "process") {
      var j = S.job || {}, p = j.progress || {}, ph = p.phase || (j.status === "queued" ? "queued" : "files");
      h = hero("Анализ на пакета", proj + " · проверка, класификация, извличане и сравнение. Обработката е на сървъра на парчета – може да затворите прозореца, задачата продължава.", IMG.proc);
      var phases = [["files", "Проверка на файловете, SHA-256 и дубликати; класификация и извличане"], ["ai", "AI предложения за неразпознати файлове (само предложения)"], ["analyze", "Нормализиране, конфликти, липси и разлика спрямо проекта"]];
      var idx = phases.map(function (x) { return x[0]; }).indexOf(ph);
      body = '<div class="nci-phases">' + phases.map(function (x, i) { return '<div class="' + (i === idx ? "on" : i < idx ? "ok" : "") + '"><b>' + (i < idx ? "✓" : i + 1) + "</b>" + esc(x[1]) + "</div>"; }).join("") + "</div>" +
        '<div class="nci-bar' + (p.files_total ? "" : " ind") + '"><i style="width:' + (p.files_total ? Math.round((p.files_done / p.files_total) * 100) : 0) + '%"></i></div>' +
        '<div class="nci-stat" aria-live="polite"><span>' + (j.status === "queued" && !p.files_total ? "Чака ред за обработка…" : p.files_total ? "Файлове: " + p.files_done + " / " + p.files_total + (p.bytes_total ? " · " + size(p.bytes_done || 0) + " от " + size(p.bytes_total) : "") : "Започва…") + "</span><span>" + esc(p.phase_bg || "") + "</span></div>" +
        (j.retry_at ? '<p class="nci-note warn">Временен проблем (' + esc(j.error || "") + ') – нов опит автоматично около ' + esc(new Date(j.retry_at).toLocaleTimeString("bg-BG")) + "<small>Опит " + j.attempts + " от " + j.max_attempts + "</small></p>" : "") +
        (S.offline ? '<p class="nci-note warn">Няма връзка – проверката ще продължи, когато връзката се върне.</p>' : "") +
        (j.cancel_requested ? '<p class="nci-note warn">Отмяната е поискана – спира след текущото парче.</p>' : "") +
        '<div class="nci-scan"><div class="ln"></div>' + fileList(true, true) + "</div>";
      foot = '<span class="grow">Задача № ' + esc(j.correlation_id || "") + '</span><button type="button" class="nci-b rm" data-a="cancel-job"' + (j.cancel_requested ? " disabled" : "") + '>Отмени импорта</button><button type="button" class="nci-b" data-a="close">Затвори (продължава)</button>';
    } else if (st === "review" || st === "commit") {
      h = hero("Преглед на черновата", proj + " · проверете предложените записи. Нищо не е записано, докато не натиснете „Запиши черновата“. Нищо не се публикува.", IMG.up);
      body = review();
      var bl = blockers(), sel = S.edit ? S.preview.units.filter(function (u) { return S.edit.units[u.ref].on; }).length : 0;
      foot = '<span class="grow" aria-live="polite">' + (bl.length ? "Остават " + bl.length + " неща за решаване: " + esc(bl.slice(0, 2).join("; ")) + (bl.length > 2 ? "…" : "") : sel + " обекта ще бъдат записани като чернова") + "</span>" +
        '<button type="button" class="nci-b rm" data-a="cancel-job">Отмени импорта</button><button type="button" class="nci-b" data-a="close">Затвори</button>' +
        '<button type="button" class="nci-b pri" data-a="apply"' + (bl.length || st === "commit" || !S.preview.importable ? " disabled" : "") + ">" + (st === "commit" ? "Записване…" : "Запиши черновата") + "</button>";
    } else if (st === "done") {
      var r = S.applied || {}, c = r.created || {}, u2 = r.updated || {};
      h = hero("Черновата е записана", proj + " · проектът остава ЧЕРНОВА. Публикуването е отделно действие на администратор.", IMG.up);
      body = '<p class="nci-note ok">Създадени: ' + (c.buildings || 0) + " сгради, " + (c.floors || 0) + " етажа, " + (c.units || 0) + " обекта · обновени: " + (u2.units || 0) + " обекта" + (u2.project ? ", данни на проекта" : "") + (r.replayed ? " (вече беше записано – нищо не е дублирано)" : "") + "</p>" +
        ((r.downstream || []).length ? '<div class="nci-panel"><h4>Заявки към TASK-009</h4><ul class="nci-list">' + r.downstream.map(function (d) { return '<li><span class="nm">' + esc(d.file_id) + " · проверка на CAD/BIM</span>" + (d.ok ? '<span class="tg info">чака изпълнител</span>' : '<span class="tg bad">' + esc(d.error || "грешка") + "</span>") + "</li>"; }).join("") + "</ul></div>" : "") +
        '<p class="nci-note">Всички обекти са със статус „Свободен“. Цените са изчислени от системата (площ × цена на кв.м); ръчните цени са с причина. Източникът на всяко поле е записан в обекта.</p>';
      foot = '<button type="button" class="nci-b" data-a="close">Затвори</button>' + (S.onDone ? '<button type="button" class="nci-b pri" data-a="open-project">Отвори проекта</button>' : '');
    } else if (st === "cancelled") {
      h = hero("Импортът е отменен", proj + " · нищо не е записано в проекта.", IMG.up);
      body = '<p class="nci-note">Качените файлове остават в частната папка на проекта (не са публични). Може да започнете нов импорт по всяко време.</p>';
      foot = '<button type="button" class="nci-b" data-a="close">Затвори</button><button type="button" class="nci-b pri" data-a="restart">Нов импорт</button>';
    } else if (st === "error") {
      var e = S.err || {};
      h = hero("Импортът не завърши", proj + " · нищо не е записано в проекта.", IMG.up);
      body = '<p class="nci-note err">' + esc(e.message || "Грешка") + "<small>" + (e.code ? "Код: " + esc(e.code) : "") + (e.corr ? " · № " + esc(e.corr) : "") + "</small></p>" +
        (e.code === "DB_CONFLICT" ? '<p class="nci-note">Проектът е променен след анализа. Пуснете анализа отново – той ще сравни пакета с актуалното състояние.</p>' : "") +
        (e.code === "AUTH_REQUIRED" ? '<p class="nci-note">Влезте отново в CRM и опитайте пак.</p>' : "") +
        (e.code === "FORBIDDEN" ? '<p class="nci-note">Нямате право за това действие (напр. в публикуван проект импорт прави само администратор).</p>' : "");
      foot = '<button type="button" class="nci-b" data-a="close">Затвори</button>' + (e.retry ? '<button type="button" class="nci-b pri" data-a="' + e.retry + '">' + (e.retry === "rerun" ? "Пусни анализа отново" : "Опитай отново") + "</button>" : "");
    }
    var sc = ov.querySelector(".nci-body"), y = sc ? sc.scrollTop : 0;
    var hadFocus = ov.contains(document.activeElement);
    ov.innerHTML = '<div class="nci-card" tabindex="-1">' + h + '<div class="nci-body">' + body + '</div><div class="nci-foot">' + foot + "</div></div>";
    fit();
    var nb = ov.querySelector(".nci-body"); if (nb && S.keepScroll) nb.scrollTop = y; S.keepScroll = false;
    if (hadFocus && !ov.contains(document.activeElement)) ov.querySelector(".nci-card").focus({ preventScroll: true });
  }
  function fileList(compact, server) {
    if (server && !S.files.length) return '<p class="nci-note" style="margin:0">Файловете вече са в частната папка на проекта – анализът върви на сървъра.</p>';
    var fs = S.files.slice(0, 400);
    var tag = function (f) {
      if (!f.ok) return '<span class="tg bad">' + esc(f.reason) + "</span>";
      if (server) return "";
      return f.status === "up" ? '<span class="tg ok">качен</span>' : f.status === "uping" ? '<span class="tg">качва се…</span>' : f.sha ? '<span class="tg">готов</span>' : "";
    };
    return '<ul class="nci-list" style="margin-top:' + (compact ? "0" : "14px") + '">' + fs.map(function (f) { return '<li><span class="nm" title="' + esc(f.rel) + '">' + esc(f.rel) + '</span><span class="sz">' + size(f.size) + "</span>" + tag(f) + "</li>"; }).join("") +
      (S.files.length > fs.length ? "<li><span class=\"nm\">… и още " + (S.files.length - fs.length) + " файла</span></li>" : "") + "</ul>";
  }

  /* ---------- избор на файлове ---------- */
  function pick(mode) {
    var inp = document.createElement("input"); inp.type = "file"; inp.multiple = mode !== "zip";
    if (mode === "folder" && "webkitdirectory" in inp) { inp.webkitdirectory = true; inp.setAttribute("webkitdirectory", ""); }
    if (mode === "zip") inp.accept = ".zip,application/zip";
    inp.style.cssText = "position:fixed;left:-999px;top:0;opacity:0";
    document.body.appendChild(inp);
    inp.onchange = function () { var fs = [].slice.call(inp.files || []); inp.remove(); addFiles(fs.map(function (f) { return { file: f, rel: f.webkitRelativePath || f.name }; })); };
    inp.click();
  }
  function onDrop(e) {
    var d = e.target.closest && e.target.closest(".nci-drop"); if (!d) return;
    e.preventDefault(); d.classList.remove("over");
    var items = e.dataTransfer && e.dataTransfer.items, out = [], jobs = [];
    function walk(entry, pre) {
      if (entry.isFile) return new Promise(function (ok) { entry.file(function (f) { out.push({ file: f, rel: pre + f.name }); ok(); }, ok); });
      if (entry.isDirectory) return new Promise(function (ok) { var rd = entry.createReader(), all = []; (function more() { rd.readEntries(function (es) { if (!es.length) return Promise.all(all.map(function (x) { return walk(x, pre + entry.name + "/"); })).then(ok); all = all.concat([].slice.call(es)); more(); }, ok); })(); });
      return Promise.resolve();
    }
    if (items && items.length && items[0].webkitGetAsEntry) { [].forEach.call(items, function (it) { var en = it.webkitGetAsEntry(); if (en) jobs.push(walk(en, "")); }); Promise.all(jobs).then(function () { addFiles(out); }); }
    else addFiles([].slice.call((e.dataTransfer && e.dataTransfer.files) || []).map(function (f) { return { file: f, rel: f.name }; }));
  }
  function addFiles(list) {
    var seen = {}; S.files.forEach(function (f) { seen[f.rel] = 1; });
    list.forEach(function (x) {
      var rel = String(x.rel || x.file.name).replace(/\\/g, "/").replace(/^\/+/, "");
      if (seen[rel] || SKIP.test(rel)) return; seen[rel] = 1;
      var f = { file: x.file, rel: rel, size: x.file.size, ok: true, reason: "" };
      if (/(^|\/)\.\.(\/|$)/.test(rel) || /[\u0000-\u001f]/.test(rel)) { f.ok = false; f.reason = "невалидно име"; }
      else if (!x.file.size) { f.ok = false; f.reason = "празен файл"; }
      else if (x.file.size > MAX_BYTES) { f.ok = false; f.reason = "над 40 MB"; }
      S.files.push(f);
    });
    var okN = 0; S.files.forEach(function (f) { if (f.ok && ++okN > MAX_FILES) { f.ok = false; f.reason = "над " + MAX_FILES + " файла"; } });
    S.files.sort(function (a, b) { return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0; });
    S.stage = S.files.length ? "select" : "idle"; render();
  }

  /* ---------- качване и старт ---------- */
  function start() {
    var title = (S.title || "").trim();
    if (!S.projectId && title.length < 2) { say("Въведете име на проекта"); return; }
    S.stage = "upload"; S.stop = false; S.hashing = true; S.hashed = 0; render();
    var files = S.files.filter(function (f) { return f.ok; });
    var p = S.projectId ? Promise.resolve() : api("projects.create_draft", { title: title, client_request_id: S.crid }).then(function (r) { S.projectId = r.id; });
    p.then(function () {
      // SHA-256 в браузъра: детерминирана папка на импорта и пътища (повтор със същите файлове = същата папка = продължение)
      return files.reduce(function (pr, f) { return pr.then(function () { if (S.stop) return; if (f.sha) { S.hashed++; return; } S.current = f.rel; return f.file.arrayBuffer().then(sha256).then(function (h) { f.sha = h; S.hashed++; if (S.hashed % 5 === 0 || S.hashed === files.length) render(); }); }); }, Promise.resolve());
    }).then(function () {
      if (S.stop) throw Object.assign(new Error("Спряно"), { code: "CANCELLED" });
      return sha256(new TextEncoder().encode(S.projectId + "|" + JSON.stringify(files.map(function (f) { return [f.rel, f.size, f.sha]; }))));
    }).then(function (h) {
      S.importId = h.slice(0, 32); S.hashing = false;
      files.forEach(function (f, i) { f.path = "projects/" + S.projectId + "/private/imports/" + S.importId + "/" + String(i).padStart(4, "0") + "-" + f.sha.slice(0, 8) + "-" + safeName(f.rel); });
      render();
      var lastPaint = 0;
      return files.reduce(function (pr, f) {
        return pr.then(function () {
          if (S.stop) throw Object.assign(new Error("Спряно"), { code: "CANCELLED" });
          if (f.status === "up") return;
          f.status = "uping"; S.current = f.rel; render();
          var bytes = function (b) { f.done = b; if (Date.now() - lastPaint > 400) { lastPaint = Date.now(); S.keepScroll = true; render(); } };
          var go = f.size <= SMALL ? uploadSmall(f.path, f.file).then(function () { bytes(f.size); }) : tusUpload(f.path, f.file, bytes, function () { return S.stop; });
          return go.then(function () { f.status = "up"; f.done = f.size; });
        });
      }, Promise.resolve());
    }).then(function () {
      S.current = "";
      return api("imports.start", { project_id: S.projectId, files: files.map(function (f) { return { path: f.path, name: f.rel, size: f.size, sha256: f.sha }; }) });
    }).then(function (r) {
      S.jobId = r.job_id; S.stage = "process"; S.job = { status: r.status, correlation_id: r.correlation_id, progress: {} };
      lastJob(S.projectId, { id: r.job_id, at: new Date().toISOString(), files: files.length });
      render(); poll();
    }).catch(function (e) {
      if (e.code === "CANCELLED") { S.stage = "select"; render(); return; }
      fail(e, "upload");
    });
  }
  function fail(e, retry) { S.err = { message: (e && e.message) || String(e), code: e && e.code, corr: e && e.corr, retry: e && (e.retryable || e.code === "NETWORK" || e.code === "STORAGE_FAILED" || e.code === "DOWNSTREAM_UNAVAILABLE") ? retry : e && e.code === "DB_CONFLICT" ? "rerun" : null }; S.stage = "error"; render(); }

  /* ---------- напредък: по едно извикване, всяко придвижва задачата с едно парче ---------- */
  function poll() {
    var my = S, id = S.jobId;
    if (!id || my.stop) return;
    api("jobs.status", { id: id }).then(function (j) {
      if (S !== my || my.stop) return;
      my.offline = false; my.job = j;
      if (j.status === "queued" || j.status === "running") { S.keepScroll = true; render(); setTimeout(poll, POLL_MS); return; }
      if (j.status === "review" || j.status === "done") return loadPreview(j);
      if (j.status === "cancelled") { my.stage = "cancelled"; render(); return; }
      fail({ message: j.error || "Анализът не завърши", code: j.error_code, corr: j.correlation_id, retryable: true }, "rerun");
    }).catch(function (e) {
      if (S !== my || my.stop) return;
      if (e.code === "NETWORK" || e.retryable) { my.offline = true; render(); setTimeout(poll, POLL_MS * 2); return; }   // прекъсната връзка → нов опит
      fail(e, "poll");
    });
  }
  function loadPreview(j) {
    var all = [], my = S;
    function page(off) {
      return api("jobs.result", { id: j.id, view: "full", offset: off, limit: 1000 }).then(function (r) {
        all = all.concat(r.result.units);
        if (all.length < r.result.page.total) return page(off + 1000);
        r.result.units = all; return r;
      });
    }
    return page(0).then(function (r) {
      if (S !== my) return;
      if (j.status === "done") { my.applied = Object.assign({ replayed: true }, r.applied || {}); my.stage = "done"; render(); return; }
      my.preview = r.result; my.edit = initEdit(r.result); my.stage = "review"; my.tab = (r.result.conflicts.length ? "conf" : "sum"); render();
    }).catch(function (e) { fail(e, "poll"); });
  }

  /* ---------- прегледът: решенията на човека ---------- */
  function initEdit(p) {
    var E = { units: {}, buildings: {}, project: {}, conflicts: {}, floors: {}, down: {} };
    p.buildings.forEach(function (b) { E.buildings[b.ref] = { name: b.name || "" }; });
    p.floors.forEach(function (f) { E.floors[f.ref] = { plan: !!(f.plan && f.plan.include) }; });
    p.units.forEach(function (u) {
      var v = {}; ["area_total", "area_net", "terrace_area", "price_per_m2", "rooms", "beds", "baths", "exposure"].forEach(function (k) { v[k] = u.fields[k] && u.fields[k].value != null ? u.fields[k].value : null; });
      E.units[u.ref] = { on: !!u.include, v: v, level: null, code: u.code, plan: !!(u.plan && u.plan.include), override: false, reason: u.override_offer ? u.override_offer.reason : "по преценка" };
    });
    Object.keys(p.project).forEach(function (k) { E.project[k] = { on: !!p.project[k].include, v: p.project[k].value }; });
    p.conflicts.forEach(function (c) { E.conflicts[c.conflict_id] = { choice: null, manual: "" }; });
    return E;
  }
  function conflictOf(id) { return S.preview.conflicts.filter(function (c) { return c.conflict_id === id; })[0]; }
  function unitConflicts(u) { return S.preview.conflicts.filter(function (c) { return c.unit_ref === u.ref; }); }
  function resolved(c) { var e = S.edit.conflicts[c.conflict_id]; return !!(e && e.choice != null); }
  function blockers() {
    if (!S.preview || !S.edit) return [];
    var out = [], p = S.preview, E = S.edit, usedB = {};
    p.units.forEach(function (u) {
      var e = E.units[u.ref]; if (!e.on) return;
      unitConflicts(u).forEach(function (c) { if (!resolved(c)) out.push(u.code + ": " + c.message); });
      if (!u.floor_ref && (e.level == null || e.level === "")) out.push(u.code + ": липсва етаж");
      if (u.building_ref) usedB[u.building_ref] = 1;
      if (!u.building_ref && !buildingFor(u)) out.push(u.code + ": липсва сграда");
      if (e.v.area_net != null && e.v.area_total != null && e.v.area_net > e.v.area_total) out.push(u.code + ": чиста площ > обща");
      if (e.override && (!(u.override_offer) || String(e.reason || "").trim().length < 3)) out.push(u.code + ": ръчна цена без причина");
    });
    Object.keys(usedB).forEach(function (r) { if (!String(E.buildings[r].name || "").trim()) out.push("име на сграда"); });
    Object.keys(p.project).forEach(function (k) { var pf = p.project[k]; if (E.project[k].on && pf.conflict && !resolved(conflictOf(pf.conflict))) out.push("проект: " + k); });
    return out;
  }
  function buildingFor(u) { if (u.building_ref) return u.building_ref; var c = unitConflicts(u).filter(function (x) { return x.field === "building"; })[0]; if (!c || !resolved(c)) return null; var name = String(c.sources[S.edit.conflicts[c.conflict_id].choice] ? c.sources[S.edit.conflicts[c.conflict_id].choice].value : "").trim(); var m = S.preview.buildings.filter(function (b) { return String(b.name || "").toLowerCase() === name.toLowerCase(); })[0]; return m ? m.ref : name ? "mb_" + name.replace(/[^A-Za-zА-Яа-я0-9]/g, "").slice(0, 20) : null; }
  function srcText(s) { return s ? [s.n, s.s && s.s !== s.n ? s.s : null, s.c].filter(Boolean).join(" · ") : ""; }
  function cell(u, k, fmt) {
    var f = u.fields[k], e = S.edit.units[u.ref], v = e.v[k];
    if (f && f.conflict && !resolved(conflictOf(f.conflict))) return '<span class="nci-c" title="Различни стойности в източниците – решете в „Конфликти“">⚠ избор</span>';
    if (v == null) return "—";
    var cand = f && f.candidates ? f.candidates.filter(function (c) { return typeof c.v === "number" ? Math.abs(c.v - v) < 0.005 : String(c.v) === String(v); })[0] : null;
    var cls = cand ? (f.rule ? "der" : "") : "man", t = cand ? "Източник: " + srcText(cand.src) + (cand.raw != null ? " · сурово: „" + cand.raw + "“" : "") + (f.rule ? " · правило: " + f.rule : "") : "Ръчна стойност (ще се запише с автор и час)";
    var old = u.diff && u.diff[k] ? '<span class="nci-src">беше ' + esc(fmt(u.diff[k].old)) + "</span>" : "";
    return '<span class="nci-v ' + cls + '" title="' + esc(t) + '">' + esc(fmt(v)) + "</span>" + old;
  }
  function review() {
    var p = S.preview, E = S.edit, tabs = [["sum", "Обобщение", 0], ["units", "Обекти", p.units.length], ["conf", "Конфликти", p.conflicts.filter(function (c) { return !resolved(c); }).length, true], ["miss", "Липсващи", p.missing.length, p.missing.some(function (m) { return m.blocking; })], ["warn", "Предупреждения", p.warnings.length], ["files", "Файлове", p.files.length]];
    var h = '<div class="nci-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (S.tab === t[0]) + '" class="' + (S.tab === t[0] ? "on" : "") + (t[3] && t[2] ? " alert" : "") + '" data-a="tab" data-v="' + t[0] + '">' + t[1] + (t[0] !== "sum" ? '<span class="n">' + t[2] + "</span>" : "") + "</button>"; }).join("") + "</div>";
    if (!p.importable) h += '<p class="nci-note err">В пакета няма данни за запис' + (p.error_code ? " (" + esc(p.error_code) + ")" : "") + ". Вижте „Файлове“ за причините.</p>";
    if (S.tab === "sum") {
      var c = p.counts;
      h += '<div class="nci-kpis"><div><span>Нови обекти</span><b>' + c.units_create + "</b></div><div><span>Обновени</span><b>" + c.units_update + "</b></div><div><span>Без промяна</span><b>" + c.units_unchanged + "</b></div><div><span>Нови сгради / етажи</span><b>" + c.buildings_new + " / " + c.floors_new + '</b></div><div class="' + (c.conflicts ? "alert" : "") + '"><span>Конфликти</span><b>' + c.conflicts + '</b></div><div class="' + (c.missing_blocking ? "alert" : "") + '"><span>Липси (задължителни)</span><b>' + c.missing + " (" + c.missing_blocking + ")</b></div><div><span>Файлове (дубликати)</span><b>" + c.files + " (" + c.duplicate + ")</b></div><div><span>Свързани планове</span><b>" + c.plans_linked + "</b></div></div>";
      var bs = p.buildings;
      if (bs.length) h += '<div class="nci-panel"><h4>Сгради / входове</h4>' + bs.map(function (b) { return '<div class="nci-fld"><label for="nci-b-' + b.ref + '">' + (b.action === "match" ? "Съществуваща сграда" : "Нова сграда") + (b.name_src ? " · източник: " + esc(srcText(b.name_src)) : b.evidence ? " · " + esc(b.evidence) : "") + '</label><input class="nci-in' + (String(E.buildings[b.ref].name).trim() ? "" : " bad") + '" id="nci-b-' + b.ref + '" data-k="bname" data-ref="' + b.ref + '" maxlength="120" value="' + esc(E.buildings[b.ref].name) + '"' + (b.action === "match" ? " readonly" : "") + ' placeholder="въведете име, напр. Вход А"></div>'; }).join("") + "</div>";
      var pk = Object.keys(p.project);
      if (pk.length) h += '<div class="nci-panel"><h4>Данни за проекта от пакета</h4><div class="nci-tw"><table class="nci-t"><tr><th>Приеми</th><th>Поле</th><th>В проекта</th><th>От пакета</th><th>Източник</th></tr>' + pk.map(function (k) { var f = p.project[k]; return "<tr><td><input type=\"checkbox\" class=\"nci-chk\" data-k=\"pfield\" data-ref=\"" + k + '"' + (E.project[k].on ? " checked" : "") + (f.changed ? "" : " disabled") + ' aria-label="Приеми ' + esc(k) + '"></td><td>' + esc(LABEL[k] || k) + "</td><td>" + esc(show(f.current)) + "</td><td>" + (f.conflict && !resolved(conflictOf(f.conflict)) ? '<span class="nci-c">⚠ избор</span>' : esc(show(E.project[k].v))) + '</td><td><span class="nci-src">' + esc(f.candidates && f.candidates[0] ? srcText(f.candidates[0].src) : "") + "</span></td></tr>"; }).join("") + "</table></div></div>";
      h += '<div class="nci-panel"><h4>Правила на импорта</h4><ul class="nci-list">' + (p.rules_applied || []).map(function (r) { return '<li><span class="nm" style="white-space:normal">' + esc(r) + "</span></li>"; }).join("") + "</ul></div>";
    } else if (S.tab === "units") {
      var head = "<tr><th>Запис</th><th>Код</th><th>Действие</th><th>Етаж</th><th>Обща</th><th>Чиста</th><th>Тераса</th><th>Стаи</th><th>Цена/м²</th><th>План</th><th>Бележки</th></tr>";
      var ACT = { create: "нов", update: "обновяване", unchanged: "без промяна", excluded: "изключен" };
      var fl = {}; p.floors.forEach(function (f) { fl[f.ref] = f; });
      var rows = p.units.map(function (u) {
        var e = E.units[u.ref], can = u.action === "create" || u.action === "update";
        var floor = u.floor_ref ? esc(fl[u.floor_ref] ? (fl[u.floor_ref].label || fl[u.floor_ref].level) : "?") : '<input class="nci-in sm' + (e.on && (e.level == null || e.level === "") ? " bad" : "") + '" type="number" min="-5" max="200" style="width:70px" data-k="level" data-ref="' + u.ref + '" value="' + (e.level == null ? "" : e.level) + '" aria-label="Етаж за ' + esc(u.code) + '">';
        var notes = u.notes.map(function (n) { return n.issue; }).concat(u.status_src ? ["в източника: „" + u.status_src.v + "“ (не се внася)"] : []);
        var offer = u.override_offer && can ? '<label style="display:flex;gap:6px;align-items:center;white-space:normal"><input type="checkbox" class="nci-chk" data-k="override" data-ref="' + u.ref + '"' + (e.override ? " checked" : "") + "> ръчна цена " + money(u.override_offer.price_total) + "</label>" + (e.override ? '<input class="nci-in sm" style="width:100%;margin-top:4px" data-k="reason" data-ref="' + u.ref + '" maxlength="300" value="' + esc(e.reason) + '" aria-label="Причина за ръчна цена">' : "") : "";
        return { u: u, e: e, can: can, floor: floor, notes: notes, offer: offer, act: ACT[u.action] || u.action };
      });
      h += '<p class="nci-note">Задръжте курсора върху стойност (на телефон – докоснете я), за да видите източника (файл · лист · клетка). Лилаво = ръчна стойност, кафяво = изведена по правило. Статусите не се внасят – всички нови обекти са „Свободен“.</p>';
      h += '<div class="nci-tw nci-desk"><table class="nci-t">' + head + rows.map(function (r) {
        var u = r.u; return '<tr class="' + (r.e.on ? "" : "off") + '"><td><input type="checkbox" class="nci-chk" data-k="unit" data-ref="' + u.ref + '"' + (r.e.on ? " checked" : "") + (r.can ? "" : " disabled") + ' aria-label="Запиши ' + esc(u.code) + '"></td><td><b>' + esc(u.code) + "</b></td><td>" + esc(r.act) + "</td><td>" + r.floor + '</td><td class="num">' + cell(u, "area_total", num) + '</td><td class="num">' + cell(u, "area_net", num) + '</td><td class="num">' + cell(u, "terrace_area", num) + '</td><td class="num">' + cell(u, "rooms", num) + '</td><td class="num">' + cell(u, "price_per_m2", money) + "</td><td>" + (u.plan ? '<label title="' + esc(u.plan.evidence) + '"><input type="checkbox" class="nci-chk" data-k="uplan" data-ref="' + u.ref + '"' + (r.e.plan ? " checked" : "") + "> " + esc(u.plan.name) + "</label>" : "—") + '</td><td style="white-space:normal;min-width:180px">' + esc(r.notes.join("; ")) + r.offer + "</td></tr>";
      }).join("") + "</table></div>";
      h += '<div class="nci-cards">' + rows.map(function (r) {
        var u = r.u; return '<div class="nci-u' + (r.e.on ? "" : " off") + '"><div class="h"><input type="checkbox" class="nci-chk" data-k="unit" data-ref="' + u.ref + '"' + (r.e.on ? " checked" : "") + (r.can ? "" : " disabled") + ' aria-label="Запиши ' + esc(u.code) + '">' + esc(u.code) + ' <span class="nci-src">· ' + esc(r.act) + '</span></div><div class="g"><span>Етаж: ' + r.floor + "</span><span>Обща: " + cell(u, "area_total", num) + "</span><span>Чиста: " + cell(u, "area_net", num) + "</span><span>Цена/м²: " + cell(u, "price_per_m2", money) + "</span><span>Стаи: " + cell(u, "rooms", num) + "</span><span>План: " + (u.plan ? esc(u.plan.name) : "—") + "</span></div>" + (r.notes.length ? '<div class="nci-src">' + esc(r.notes.join("; ")) + "</div>" : "") + r.offer + "</div>";
      }).join("") + "</div>";
    } else if (S.tab === "conf") {
      if (!p.conflicts.length) h += '<p class="nci-note ok">Няма конфликти между източниците.</p>';
      h += p.conflicts.map(function (c) {
        var e = E.conflicts[c.conflict_id], u = c.unit_ref ? p.units.filter(function (x) { return x.ref === c.unit_ref; })[0] : null;
        var opts = c.sources.map(function (s, i) { return '<label><input type="radio" class="nci-chk" name="cf-' + c.conflict_id + '" data-k="cf" data-ref="' + c.conflict_id + '" data-v="' + i + '"' + (e.choice === i ? " checked" : "") + "> <b>" + esc(show(s.value)) + (s.field ? " (" + esc(LABEL[s.field] || s.field) + ")" : "") + "</b> <small>" + esc(srcText(s)) + (s.row ? " · ред " + s.row : "") + "</small></label>"; }).join("");
        var excl = u ? '<label><input type="radio" class="nci-chk" name="cf-' + c.conflict_id + '" data-k="cf" data-ref="' + c.conflict_id + '" data-v="x"' + (e.choice === "x" ? " checked" : "") + "> Не записвай обекта „" + esc(u.code) + "“</label>" : "";
        return '<div class="nci-cf' + (e.choice != null ? " done" : "") + '"><p>' + esc(c.message) + "</p>" + opts + excl + "</div>";
      }).join("");
    } else if (S.tab === "miss") {
      if (!p.missing.length) h += '<p class="nci-note ok">Няма липсващи данни.</p>';
      h += '<ul class="nci-list">' + p.missing.map(function (m) { return '<li><span class="tg' + (m.blocking ? " bad" : "") + '">' + (m.blocking ? "задължително" : "за по-късно") + '</span><span class="nm" style="white-space:normal">' + esc(m.message) + "</span></li>"; }).join("") + "</ul>";
      h += '<p class="nci-note" style="margin-top:12px">„За по-късно“ не пречи на записа на черновата, но проектът няма да може да се публикува, докато не са попълнени (площ и цена на кв.м).</p>';
    } else if (S.tab === "warn") {
      h += '<ul class="nci-list">' + p.warnings.map(function (w) { return '<li><span class="tg info">' + esc(w.code) + '</span><span class="nm" style="white-space:normal">' + esc(w.message) + "</span></li>"; }).join("") + "</ul>";
      if ((p.derived || []).length) h += '<div class="nci-panel" style="margin-top:12px"><h4>Изведени стойности</h4><ul class="nci-list">' + p.derived.map(function (d) { return '<li><span class="nm" style="white-space:normal">' + esc((LABEL[d.field] || d.field) + ": " + d.rule + " · " + d.count + " бр.") + "</span></li>"; }).join("") + "</ul></div>";
    } else if (S.tab === "files") {
      var ST = { ok: ["ok", "обработен"], duplicate: ["", "дубликат"], rejected: ["bad", "отказан"], stored_only: ["info", "само се пази"], ignored: ["", "пропуснат"] };
      h += '<div class="nci-tw"><table class="nci-t"><tr><th>Файл</th><th>Вид</th><th>Предназначение</th><th>Увереност</th><th>Възможности</th><th>Състояние</th><th>Бележки</th>' + (S.admin ? "<th>TASK-009</th>" : "") + "</tr>" + p.files.map(function (f) {
        var s = ST[f.status] || ["", f.status], dn = (p.downstream || []).filter(function (d) { return d.file_id === f.file_id; })[0];
        var notes = (f.issues || []).map(function (i) { return i.message; }).concat(f.pdf ? ["PDF: " + (f.pdf.kind_bg || f.pdf.kind) + ", стр. " + f.pdf.pages] : []).concat(f.image && f.image.w ? [f.image.w + "×" + f.image.h + " px"] : []).concat(f.ai_suggestion && !f.ai_suggestion.skipped ? ["AI предложение: " + (f.ai_suggestion.purpose_bg || f.ai_suggestion.title) + " (" + f.ai_suggestion.confidence + ") – не е приложено"] : []).concat(f.downstream ? ["за " + f.downstream] : []);
        return '<tr><td title="' + esc(f.source_name + " · SHA-256 " + (f.sha256 || "—")) + '">' + esc(f.source_name.split("/").slice(-2).join("/")) + "</td><td>" + esc(f.type_bg || f.detected_type || "—") + "</td><td>" + esc(f.purpose_bg || "") + '</td><td class="num">' + (f.confidence == null ? "—" : Math.round(f.confidence * 100) + "%") + "</td><td>" + esc((f.capabilities || []).join(", ")) + '</td><td><span class="tg ' + s[0] + '">' + s[1] + '</span></td><td style="white-space:normal;min-width:200px">' + esc(notes.join("; ")) + "</td>" +
          (S.admin ? "<td>" + (dn ? '<label><input type="checkbox" class="nci-chk" data-k="down" data-ref="' + f.file_id + '"' + (E.down[f.file_id] ? " checked" : "") + "> заяви проверка</label>" : "") + "</td>" : "") + "</tr>";
      }).join("") + "</table></div>";
      h += '<p class="nci-note" style="margin-top:12px">CAD/BIM и 3D файловете се пазят като източник; подробната проверка и конверсията са в TASK-009. Заявка за проверка прави само администратор – тя ще чака изпълнител, докато той не е готов.</p>';
    }
    return h;
  }
  var LABEL = { title: "Име", city: "Град", hood: "Квартал", address: "Адрес", description: "Описание", stage: "Етап", stage_percent: "Готовност %", expected_completion: "Очаквано завършване", advantages: "Предимства", area_total: "Обща площ", area_net: "Чиста площ", terrace_area: "Тераса", price_per_m2: "Цена на кв.м", building: "Сграда", floor: "Етаж", code: "Код", rooms: "Стаи", beds: "Спални", baths: "Бани", exposure: "Изложение" };
  function show(v) { return v == null || v === "" ? "—" : Array.isArray(v) ? v.join(", ") : String(v); }

  /* решение на конфликт → стойности в черновата */
  function applyChoice(c, choice) {
    var E = S.edit, e = E.conflicts[c.conflict_id]; e.choice = choice;
    var u = c.unit_ref ? S.preview.units.filter(function (x) { return x.ref === c.unit_ref; })[0] : null;
    if (choice === "x") { if (u) E.units[u.ref].on = false; return; }
    var s = c.sources[choice];
    if (c.scope === "project") { E.project[c.field].v = s.value; E.project[c.field].on = true; return; }
    if (!u) return;
    var ue = E.units[u.ref];
    if (c.kind === "duplicate_unit_code") {
      ue.on = true;   // взимат се стойностите от избрания ред
      Object.keys(u.fields).forEach(function (k) { var cand = (u.fields[k].candidates || []).filter(function (x) { return x.src && x.src.r === s.row; })[0]; ue.v[k] = cand ? cand.v : null; });
      return;
    }
    if (c.kind === "net_gt_total") { if (s.field === "area_total") { ue.v.area_total = s.value; ue.v.area_net = null; } else { ue.v.area_net = s.value; ue.v.area_total = null; } return; }
    if (c.field === "floor" || c.field === "building") return;
    ue.v[c.field] = s.value; ue.on = u.action === "create" || u.action === "update";
  }
  /* прегледаната чернова → accept за imports.apply (същата форма, която сървърът проверява и за Тед) */
  function buildAccept() {
    var p = S.preview, E = S.edit, units = [], usedF = {}, usedB = {}, newF = {}, newB = {}, resolvedIds = [];
    p.units.forEach(function (u) {
      var e = E.units[u.ref]; if (!e.on) return;
      var bref = buildingFor(u), fref = u.floor_ref;
      if (!fref) { fref = "mf_" + bref + "_" + Number(e.level); newF[fref] = { ref: fref, building_ref: bref, level: Number(e.level) }; }
      if (bref && bref.indexOf("mb_") === 0) { var c = unitConflicts(u).filter(function (x) { return x.field === "building"; })[0]; newB[bref] = { ref: bref, name: String(c.sources[E.conflicts[c.conflict_id].choice].value).trim() }; }
      usedF[fref] = 1; usedB[bref] = 1;
      var o = { ref: u.ref, floor_ref: fref, code: e.code };
      Object.keys(e.v).forEach(function (k) { if (e.v[k] != null && e.v[k] !== "") o[k] = e.v[k]; });
      if (e.override && u.override_offer) { o.price_override = true; o.price_total = u.override_offer.price_total; o.price_override_reason = String(e.reason).trim().slice(0, 300); }
      if (u.plan && e.plan) o.plan_file_id = u.plan.file_id;
      units.push(o);
      unitConflicts(u).forEach(function (cc) { if (resolved(cc)) resolvedIds.push(cc.conflict_id); });
    });
    var floors = p.floors.filter(function (f) { return usedF[f.ref]; }).map(function (f) { var o = { ref: f.ref, building_ref: f.building_ref, level: f.level }; if (f.label) o.label = f.label; if (f.plan && E.floors[f.ref].plan) o.plan_file_id = f.plan.file_id; usedB[f.building_ref] = 1; return o; })
      .concat(Object.keys(newF).map(function (k) { return newF[k]; }));
    var buildings = p.buildings.filter(function (b) { return usedB[b.ref]; }).map(function (b) { return { ref: b.ref, name: String(E.buildings[b.ref].name).trim() }; }).concat(Object.keys(newB).map(function (k) { return newB[k]; }));
    var project = {}; Object.keys(E.project).forEach(function (k) { if (E.project[k].on && E.project[k].v != null) { project[k] = E.project[k].v; var pf = p.project[k]; if (pf.conflict) resolvedIds.push(pf.conflict); } });
    var down = Object.keys(E.down).filter(function (k) { return E.down[k]; });
    return { project: project, buildings: buildings, floors: floors, units: units, resolved: resolvedIds, downstream: down };
  }
  function apply() {
    if (blockers().length || S.stage !== "review") return;
    S.stage = "commit"; render();
    api("imports.apply", { job_id: S.jobId, confirm: true, accept: buildAccept() }).then(function (r) {
      S.applied = r; S.stage = "done"; S.dirty = false; render();
      lastJob(S.projectId, null);
    }).catch(function (e) { if (e.code === "CONFLICT_REQUIRES_REVIEW") { S.stage = "review"; say(e.message); render(); return; } fail(e, e.code === "DB_CONFLICT" ? "rerun" : "apply-again"); });
  }

  /* ---------- събития ---------- */
  function onClick(e) {
    var v = e.target.closest && e.target.closest(".nci-v");                    // източникът на стойност – и на телефон (без курсор)
    if (v) { var nx = v.nextElementSibling; if (nx && nx.classList.contains("nci-tip")) { nx.remove(); return; } var tip = document.createElement("span"); tip.className = "nci-src nci-tip"; tip.textContent = v.getAttribute("title") || ""; v.parentNode.insertBefore(tip, v.nextSibling); return; }
    var b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
    var a = b.getAttribute("data-a");
    if (a === "close") return tryClose();
    if (a === "pick-files") return pick("files");
    if (a === "pick-folder") return pick("folder");
    if (a === "pick-zip") return pick("zip");
    if (a === "clear") { S.files = []; S.stage = "idle"; return render(); }
    if (a === "start") return start();
    if (a === "stop") { S.stop = true; return; }
    if (a === "tab") { S.tab = b.getAttribute("data-v"); return render(); }
    if (a === "apply") return apply();
    if (a === "apply-again") { S.stage = "review"; return apply(); }
    if (a === "cancel-job") {
      if (!S.jobId) return tryClose();
      if (!confirm("Да отменя ли импорта? Нищо не се записва в проекта.")) return;
      return api("jobs.cancel", { id: S.jobId }).then(function (r) { if (r.status === "cancelled") { lastJob(S.projectId, null); S.stage = "cancelled"; render(); } else { S.job = Object.assign({}, S.job, { cancel_requested: true }); S.stage = "process"; render(); setTimeout(poll, POLL_MS); } }).catch(function (x) { fail(x, null); });
    }
    if (a === "upload") { S.stage = "select"; S.err = null; return start(); }
    if (a === "resume" && S.resume) { S.jobId = S.resume.id; S.stage = "process"; S.job = { status: S.resume.status, correlation_id: S.resume.corr, progress: {} }; S.resume = null; render(); return poll(); }
    if (a === "forget") { S.resume = null; return render(); }
    if (a === "poll") { S.stage = "process"; render(); return poll(); }
    if (a === "rerun") {
      S.stage = "process"; S.job = { status: "queued", progress: {} }; render();
      var fs = S.files.filter(function (f) { return f.ok && f.path; });
      if (!fs.length) { S.stage = "idle"; return render(); }
      return api("imports.start", { project_id: S.projectId, rerun: true, files: fs.map(function (f) { return { path: f.path, name: f.rel, size: f.size, sha256: f.sha }; }) }).then(function (r) { S.jobId = r.job_id; S.job.correlation_id = r.correlation_id; lastJob(S.projectId, { id: r.job_id, at: new Date().toISOString(), files: fs.length }); poll(); }).catch(function (x) { fail(x, "rerun"); });
    }
    if (a === "restart") { var keep = { projectId: S.projectId, onDone: S.onDone }; return open(keep); }
    if (a === "open-project") { var pid = S.projectId, cb = S.onDone; closeNow(); if (cb) try { cb(pid); } catch (x) { console.error(x); } }
  }
  function onChange(e) {
    var t = e.target, k = t.getAttribute && t.getAttribute("data-k"), ref = t.getAttribute && t.getAttribute("data-ref");
    if (!k || !S || !S.edit && k !== "title") return;
    var E = S.edit; S.dirty = true; S.keepScroll = true;
    if (k === "unit") E.units[ref].on = t.checked;
    else if (k === "uplan") E.units[ref].plan = t.checked;
    else if (k === "override") E.units[ref].override = t.checked;
    else if (k === "pfield") E.project[ref].on = t.checked;
    else if (k === "down") E.down[ref] = t.checked;
    else if (k === "cf") applyChoice(conflictOf(ref), t.getAttribute("data-v") === "x" ? "x" : Number(t.getAttribute("data-v")));
    else if (k === "level") E.units[ref].level = t.value === "" ? null : Math.round(Number(t.value));
    else return;
    render();
  }
  function onInput(e) {
    var t = e.target, k = t.getAttribute && t.getAttribute("data-k"), ref = t.getAttribute && t.getAttribute("data-ref");
    if (k === "title") { S.title = t.value; var b = ov.querySelector('[data-a="start"]'); if (b) b.disabled = !(S.files.some(function (f) { return f.ok; }) && t.value.trim().length >= 2); return; }
    if (!S.edit) return;
    if (k === "bname") { S.edit.buildings[ref].name = t.value; t.classList.toggle("bad", !t.value.trim()); }
    else if (k === "reason") S.edit.units[ref].reason = t.value;
    else return;
    S.dirty = true;
    var g = ov.querySelector(".nci-foot .grow"), bl = blockers(), ap = ov.querySelector('[data-a="apply"]');
    if (g) g.textContent = bl.length ? "Остават " + bl.length + " неща за решаване: " + bl.slice(0, 2).join("; ") : "Готово за запис";
    if (ap) ap.disabled = !!bl.length || !S.preview.importable;
  }

  window.NCImport = { open: open, version: VERSION };
})();
