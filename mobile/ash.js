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
    "background:radial-gradient(circle at 36% 30%,#fffbea 0%,#fff3c4 16%,#f6cf6c 50%,#e0a63a 78%,#c98a22 100%);box-shadow:inset 0 2px 5px rgba(255,255,255,.8),inset 0 -6px 12px rgba(150,85,10,.38),0 0 0 2px #edc47a,0 0 18px rgba(255,190,120,.75),0 8px 18px rgba(40,4,12,.45);-webkit-tap-highlight-color:transparent;transition:transform .25s,box-shadow .25s}" +
    ".nda-fab:hover{box-shadow:inset 0 2px 5px rgba(255,255,255,.8),inset 0 -6px 12px rgba(150,85,10,.38),0 0 0 2px #f6d68c,0 0 28px rgba(255,200,120,.95),0 10px 22px rgba(40,4,12,.5)}" +
    ".nda-fab img{width:42px;height:42px;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(40,0,10,.45))}.nda-fab:active{transform:scale(.95)}.nda-fab[hidden]{display:none}" +
    /* брояч на непрочетените известия от задачите – същата точка като при балончетата на CRM Чат (crm-chatheads.js, .nch-h .n) */
    "#ndside .sb-ted{position:relative}#ndside .sb-ted .n{right:auto!important;left:calc(50% + 8px);top:0!important}" +
    ".nda-fab .n,#ndside .sb-ted .n{position:absolute;right:-6px;top:-6px;min-width:24px;height:24px;padding:0 6px;box-sizing:border-box;border-radius:12px;display:grid;place-items:center;font:700 13px/1 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#fff;text-shadow:none;background:radial-gradient(circle at 35% 30%,#e0405f,#a3132f 60%,#6a0a1d);border:1.5px solid #f6d993;box-shadow:0 0 10px rgba(255,120,140,.9);pointer-events:none}" +
    ".nda-win{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));top:max(60px,env(safe-area-inset-top,0px));z-index:2147483001;display:flex;flex-direction:column;max-width:560px;margin:0 auto;border-radius:28px;overflow:hidden;" +
    "border:1.5px solid transparent;background:radial-gradient(90% 55% at 100% 0%,rgba(243,207,134,.26),rgba(243,207,134,0) 62%) padding-box,radial-gradient(80% 50% at 0% 100%,rgba(161,33,57,.09),rgba(161,33,57,0) 65%) padding-box,linear-gradient(165deg,rgba(255,252,247,.95),rgba(251,238,224,.93)) padding-box,linear-gradient(150deg,#ffe9a3 0%,#e3b25e 26%,#a12139 56%,#e3b25e 82%,#ffe9a3 100%) border-box;-webkit-backdrop-filter:blur(20px) saturate(1.2);backdrop-filter:blur(20px) saturate(1.2);box-shadow:inset 0 0 0 1px rgba(255,240,205,.6),0 0 30px rgba(227,178,94,.5),0 30px 70px -12px rgba(30,0,8,.62);transform-origin:100% 100%;animation:ndaIn .46s cubic-bezier(.2,.9,.3,1.1);font-family:'Roboto Condensed','Roboto Condensed Local',Arial,system-ui,sans-serif;-webkit-text-size-adjust:100%;text-align:left}" +
    "@media(min-width:900px){.nda-win{left:auto;right:24px;width:440px;top:auto;height:min(680px,calc(100vh - 48px));bottom:24px}}" +
    ".nda-win[hidden]{display:none}.nda-win *{box-sizing:border-box}" +
    ".nda-h{position:relative;z-index:3;display:flex;align-items:center;gap:12px;padding:14px 12px 16px 14px;color:#fff3dc;background:radial-gradient(120% 170% at 100% 0%,rgba(255,214,150,.3),rgba(255,214,150,0) 48%),radial-gradient(90% 130% at 0% 100%,rgba(30,0,8,.42),rgba(30,0,8,0) 62%),linear-gradient(125deg,#b0233f 0%,#7a0f22 40%,#5e0a1a 70%,#42061a 100%);border-bottom:1.5px solid #e3b25e;border-bottom-right-radius:34px;box-shadow:inset 0 1px 0 rgba(255,233,163,.35),0 10px 22px -12px rgba(94,10,26,.6),0 4px 16px -6px rgba(227,178,94,.55)}" +
    /* златна извита лента в ъгъла и бавен блясък, който преминава през заглавието (само декорация) */
    ".nda-h:before,.nda-h:after,.nda-set .sh:before{content:'';position:absolute;left:0;top:0;right:0;bottom:0;z-index:-1;border-bottom-right-radius:inherit;pointer-events:none}" +
    ".nda-h:before,.nda-set .sh:before{background:radial-gradient(circle at 104% -70%,rgba(243,207,134,0) 0 132px,rgba(255,233,163,.8) 133px 134.5px,rgba(243,207,134,0) 136px),radial-gradient(circle at 104% -70%,rgba(243,207,134,0) 0 147px,rgba(243,207,134,.3) 148px 149px,rgba(243,207,134,0) 150px);filter:drop-shadow(0 0 4px rgba(255,214,150,.7))}" +
    ".nda-h:after{background:linear-gradient(105deg,rgba(255,233,163,0) 38%,rgba(255,233,163,.14) 47%,rgba(255,255,255,.2) 50%,rgba(255,233,163,.14) 53%,rgba(255,233,163,0) 62%) no-repeat;background-size:260% 100%;background-position:100% 0;animation:ndaSheen 8s ease-in-out infinite}" +
    ".nda-av{position:relative;flex:none;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 36% 30%,#fffbea 0%,#fff3c4 16%,#f6cf6c 50%,#e0a63a 78%,#c98a22 100%);box-shadow:inset 0 2px 4px rgba(255,255,255,.8),inset 0 -5px 10px rgba(150,85,10,.38),0 0 0 1.5px #edc47a,0 0 0 4px rgba(243,207,134,.16),0 0 18px rgba(255,214,150,.75)}" +
    ".nda-av:before{content:'';position:absolute;left:-6px;top:-6px;right:-6px;bottom:-6px;border-radius:50%;pointer-events:none;background:conic-gradient(rgba(255,233,163,0) 0deg,rgba(255,244,200,.95) 60deg,rgba(255,233,163,0) 130deg,rgba(255,233,163,0) 200deg,rgba(243,207,134,.75) 260deg,rgba(255,233,163,0) 330deg);-webkit-mask:radial-gradient(closest-side,transparent calc(100% - 2.6px),#000 calc(100% - 2px));mask:radial-gradient(closest-side,transparent calc(100% - 2.6px),#000 calc(100% - 2px));animation:ndaSpin 7s linear infinite}" +
    ".nda-av img{position:relative;width:36px;height:36px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(110,50,0,.35))}" +
    ".nda-t{flex:1;min-width:0}.nda-t b{display:block;font:700 19px/1.15 Georgia,'PT Serif Local',serif;letter-spacing:.3px;color:#fff3dc;background:linear-gradient(180deg,#fffaf0 20%,#ffe9a3 62%,#f3cf86 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1px 1px rgba(30,0,6,.55)) drop-shadow(0 0 10px rgba(255,214,150,.3))}" +
    ".nda-skill{margin-top:5px;display:inline-flex;align-items:center;gap:6px;max-width:100%;height:30px;padding:0 10px 0 13px;border-radius:15px;border:1px solid rgba(243,207,134,.8);background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,.05));color:#ffe9b8;font:700 14px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 0 12px rgba(243,207,134,.35);transition:box-shadow .25s,background .25s}" +
    ".nda-skill:hover{background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.1));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 18px rgba(243,207,134,.6)}" +
    ".nda-skill svg{width:16px;height:16px;flex:none}.nda-skill span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".nda-fb{font:400 12px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#8a6a3a;margin:2px 0 0}" +
    /* кръгло бутонче „настройки“ и панелът с настройки на чата (блокове с бутони отгоре) */
    ".nda-gear{flex:none;width:38px;height:38px;border-radius:50%;border:1.5px solid #edc47a;background:radial-gradient(circle at 35% 28%,#c42a4a,#7a0f22 58%,#4a0613);color:#ffe9b8;display:grid;place-items:center;cursor:pointer;padding:0;box-shadow:inset 0 1px 1px rgba(255,255,255,.3),0 0 12px rgba(243,207,134,.5);transition:transform .25s,box-shadow .25s}.nda-gear svg{width:19px;height:19px}.nda-gear:hover{transform:rotate(40deg)}.nda-gear.on{background:linear-gradient(180deg,#fff7e3,#f3cf86);color:#6b0a1c}" +
    ".nda-set{position:absolute;left:0;right:0;top:0;bottom:0;z-index:4;display:flex;flex-direction:column;background:linear-gradient(180deg,#fffaf5 0%,#f6e4d2 100%)}.nda-set[hidden]{display:none}" +
    ".nda-set .sh{position:relative;z-index:1;display:flex;align-items:center;gap:10px;padding:14px 12px 14px 16px;background:radial-gradient(120% 170% at 100% 0%,rgba(255,214,150,.3),rgba(255,214,150,0) 48%),radial-gradient(90% 130% at 0% 100%,rgba(30,0,8,.42),rgba(30,0,8,0) 62%),linear-gradient(125deg,#b0233f 0%,#7a0f22 40%,#5e0a1a 70%,#42061a 100%);color:#fff3dc;border-bottom:1.5px solid #e3b25e;border-bottom-right-radius:34px;box-shadow:inset 0 1px 0 rgba(255,233,163,.35),0 4px 16px -6px rgba(227,178,94,.55)}.nda-set .sh b{flex:1;font:700 18px/1.1 Georgia,'PT Serif Local',serif}" +
    ".nda-tabs{display:flex;gap:6px;padding:10px 12px 0;flex-wrap:wrap}.nda-tabs button{flex:1 1 auto;min-width:0;height:40px;padding:0 10px;border:1.5px solid rgba(227,178,94,.8);border-radius:14px;background:linear-gradient(180deg,#fffdf9,#fbefe5);color:#4e0912;font:700 14px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 0 8px rgba(255,214,150,.5)}.nda-tabs button svg{width:16px;height:16px}.nda-tabs button.on{background:linear-gradient(180deg,#a3213a,#55071a);color:#fff3dc;box-shadow:0 0 0 1px #edc47a,0 0 12px rgba(255,214,160,.8)}" +
    ".nda-sb{flex:1;overflow:auto;padding:12px 12px 16px}.nda-sec{margin:0 0 12px;padding:12px;border-radius:18px;background:linear-gradient(160deg,rgba(255,251,247,.98),rgba(251,236,224,.95));box-shadow:0 0 0 1px rgba(237,196,122,.85),0 0 14px rgba(255,214,160,.7)}.nda-sec h4{margin:0 0 8px;font:700 15px Georgia,'PT Serif Local',serif;color:#7a0f22;display:flex;align-items:center;gap:8px}.nda-sec h4 svg{width:16px;height:16px}.nda-sec p{margin:0 0 8px;font:400 13px/1.4 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#5a3a33}" +
    ".nda-opt{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;margin:0 0 6px;border:0;border-radius:14px;background:rgba(255,255,255,.65);color:#2b1414;text-align:left;cursor:pointer;font:700 15px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;box-shadow:inset 0 0 0 1px rgba(227,178,94,.5)}.nda-opt small{display:block;font-weight:400;font-size:12.5px;color:#6b4a40;margin-top:1px}.nda-opt .d{flex:1;min-width:0}.nda-opt i{width:18px;height:18px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 2px #c9a060;background:#fff}.nda-opt.on{background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1.5px #edc47a,0 0 12px rgba(255,214,160,.8)}.nda-opt.on i{background:radial-gradient(circle at 40% 35%,#ffd36a,#a3213a 60%);box-shadow:0 0 0 2px #edc47a}" +
    ".nda-opt em{font:700 11px/1.5 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;font-style:normal;padding:1px 7px;border-radius:9px;color:#fff3dc;background:linear-gradient(180deg,#a3213a,#55071a);flex:none}.nda-opt .pl{flex:none;width:34px;height:34px;border-radius:50%;border:1.5px solid #edc47a;background:#fff;color:#7a0f22;display:grid;place-items:center;cursor:pointer}.nda-opt .pl svg{width:16px;height:16px}" +
    ".nda-sw{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;margin:0 0 6px;border-radius:14px;background:rgba(255,255,255,.65);box-shadow:inset 0 0 0 1px rgba(227,178,94,.5);font:700 15px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#2b1414;cursor:pointer}.nda-sw small{display:block;font-weight:400;font-size:12.5px;color:#6b4a40}.nda-sw .tg{flex:none;width:46px;height:26px;border-radius:13px;background:#d9c7b8;position:relative;transition:background .2s}.nda-sw .tg:after{content:'';position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:left .2s}.nda-sw.on .tg{background:linear-gradient(180deg,#a3213a,#55071a)}.nda-sw.on .tg:after{left:23px;background:#f3cf86}" +
    ".nda-sub{margin:4px 0 8px 28px}.nda-sub .nda-opt{padding:7px 10px;font-size:14px}" +
    ".nda-win.big .nda-m{font-size:17px}.nda-win.big .nda-c textarea{font-size:17px}" +
    ".nda-x{flex:none;width:38px;height:38px;border-radius:50%;border:1.5px solid #edc47a;background:radial-gradient(circle at 35% 28%,#fffbe6,#f6d68c 55%,#e3b25e);color:#6b0a1c;display:grid;place-items:center;cursor:pointer;padding:0;box-shadow:inset 0 -2px 4px rgba(150,85,10,.25),inset 0 1px 2px #fff,0 0 12px rgba(255,214,150,.6);transition:transform .25s,box-shadow .25s}.nda-x svg{width:18px;height:18px}" +
    ".nda-x:hover{transform:rotate(90deg);box-shadow:inset 0 -2px 4px rgba(150,85,10,.25),inset 0 1px 2px #fff,0 0 18px rgba(255,214,150,.9)}.nda-gear:hover{box-shadow:inset 0 1px 1px rgba(255,255,255,.3),0 0 18px rgba(243,207,134,.8)}" +
    ".nda-menu{position:absolute;left:72px;top:80px;z-index:3;min-width:260px;max-width:calc(100% - 84px);padding:8px;border-radius:20px;border:1.5px solid transparent;background:linear-gradient(180deg,rgba(255,252,247,.97),rgba(251,238,224,.96)) padding-box,linear-gradient(140deg,#ffe9a3,#e3b25e 40%,#a12139) border-box;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 0 22px rgba(227,178,94,.5),0 18px 36px -10px rgba(40,4,12,.45);animation:ndaPop .22s ease-out}" +
    ".nda-menu[hidden]{display:none}.nda-menu button{display:block;width:100%;text-align:left;padding:10px 12px;border:0;border-radius:12px;background:transparent;color:#4e0912;font:700 16px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;cursor:pointer}" +
    ".nda-menu button small{display:block;font-weight:400;font-size:12.5px;color:#6b4a40;margin-top:2px}.nda-menu button:hover,.nda-case-i:hover{background:rgba(255,255,255,.72);box-shadow:inset 0 0 0 1px rgba(227,178,94,.45)}.nda-menu button.on{background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1px rgba(227,178,94,.7),0 0 10px rgba(255,214,150,.6)}" +
    ".nda-list{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 14px 18px;display:flex;flex-direction:column;gap:12px;background:radial-gradient(80% 45% at 0% 0%,rgba(243,207,134,.16),rgba(243,207,134,0) 70%),radial-gradient(70% 40% at 100% 100%,rgba(161,33,57,.07),rgba(161,33,57,0) 70%);scrollbar-width:thin;scrollbar-color:rgba(201,138,34,.55) transparent}" +
    ".nda-list::-webkit-scrollbar,.nda-sb::-webkit-scrollbar,.nda-case-pop::-webkit-scrollbar{width:8px}.nda-list::-webkit-scrollbar-thumb,.nda-sb::-webkit-scrollbar-thumb,.nda-case-pop::-webkit-scrollbar-thumb{border-radius:8px;border:2px solid transparent;background:linear-gradient(180deg,#f3cf86,#c98a22) padding-box}.nda-sb,.nda-case-pop{scrollbar-width:thin;scrollbar-color:rgba(201,138,34,.55) transparent}" +
    ".nda-m{position:relative;max-width:86%;padding:11px 14px;border-radius:20px;font:400 15px/1.45 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#3a0c12;white-space:pre-line;word-wrap:break-word;animation:ndaMsg .38s cubic-bezier(.2,.8,.2,1)}" +
    ".nda-m.a{align-self:flex-start;border:1px solid transparent;border-radius:6px 22px 22px 18px;background:linear-gradient(160deg,rgba(255,255,255,.97),rgba(255,247,236,.94)) padding-box,linear-gradient(140deg,#f3cf86,rgba(227,178,94,.3) 50%,#e3b25e) border-box;box-shadow:inset 3px 0 0 rgba(227,178,94,.9),inset 0 1px 0 #fff,0 10px 22px -14px rgba(94,10,26,.45),0 0 16px rgba(255,214,150,.38)}.nda-m.a b{color:#7a0f22}" +
    ".nda-m.u{align-self:flex-end;color:#fff3dc;border:1px solid transparent;border-radius:22px 6px 18px 22px;background:linear-gradient(150deg,#b0233f 0%,#8a1129 45%,#5e0a1a 100%) padding-box,linear-gradient(140deg,#ffe9a3,#e3b25e 50%,#a8741f) border-box;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 10px 20px -12px rgba(94,10,26,.7),0 0 14px rgba(227,178,94,.35);text-shadow:0 1px 1px rgba(40,0,8,.35)}" +
    ".nda-m.bot{align-self:center;max-width:92%;padding:6px 14px;border-radius:14px;font-size:13px;color:#7a5a3a;text-align:center;background:rgba(255,250,240,.72);box-shadow:inset 0 0 0 1px rgba(227,178,94,.45),0 0 10px rgba(255,214,150,.3)}" +
    ".nda-m.wait{opacity:.8}.nda-m.wait:after{content:'…';animation:ndaDots 1s steps(3) infinite}@keyframes ndaDots{0%{content:'.'}50%{content:'..'}100%{content:'...'}}" +
    ".nda-m table{margin-top:6px;border-collapse:collapse;width:100%;font-size:14px}.nda-m td{padding:3px 6px 3px 0;vertical-align:top;white-space:normal}.nda-m td:first-child{color:#8d1530;font-weight:700;white-space:nowrap}" +
    ".nda-m a.go{display:inline-block;margin-top:8px;padding:8px 14px;border-radius:14px;background:linear-gradient(150deg,#fff0aa,#f3a518);color:#640319;font-weight:700;text-decoration:none;box-shadow:0 0 10px rgba(255,200,90,.6)}" +
    ".nda-m .acts{display:block;margin-top:6px;font-size:12px;color:#8d6a50}" +
    ".nda-f{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:10px 12px 12px;border-top:1px solid rgba(227,178,94,.6);background:rgba(255,248,240,.85)}" +
    ".nda-f button{display:flex;flex-direction:column;align-items:center;gap:5px;padding:9px 4px;border-radius:16px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;font:700 13.5px/1.15 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;cursor:pointer;box-shadow:0 0 10px rgba(255,214,150,.45)}" +
    ".nda-f button:disabled{opacity:.5}.nda-f button span.ib{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff3dc;background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);box-shadow:0 0 0 1.5px #edc47a,0 0 8px rgba(255,190,120,.55)}.nda-f button span.ib svg{width:18px;height:18px}" +
    ".nda-foot{position:relative;background:linear-gradient(180deg,rgba(255,251,245,.8),rgba(251,238,224,.96));box-shadow:0 -12px 24px -20px rgba(94,10,26,.5)}.nda-foot:empty{display:none}" +
    ".nda-foot:before{content:'';position:absolute;left:16px;right:16px;top:0;height:1.5px;pointer-events:none;background:linear-gradient(90deg,rgba(227,178,94,0),#e3b25e 18%,#ffe9a3 50%,#e3b25e 82%,rgba(227,178,94,0));box-shadow:0 0 8px rgba(255,214,150,.8)}.nda-foot>.nda-f{background:transparent;border-top:0}" +
    ".nda-c{display:flex;align-items:flex-end;gap:8px;padding:8px 12px 12px}" +
    ".nda-c textarea{flex:1;min-height:44px;max-height:120px;resize:none;border-radius:22px;border:1.5px solid transparent;background:linear-gradient(180deg,#fffefb,#fff8ef) padding-box,linear-gradient(135deg,#f3cf86,#e3b25e 45%,#d9a24a) border-box;padding:11px 16px;font:16px/1.3 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#3a0c12;outline:none;box-shadow:inset 0 2px 4px rgba(94,10,26,.07),0 0 10px rgba(255,214,150,.35);transition:box-shadow .2s}" +
    ".nda-c textarea:focus{box-shadow:inset 0 2px 4px rgba(94,10,26,.07),0 0 0 3px rgba(243,207,134,.38),0 0 18px rgba(255,214,150,.7)}.nda-c textarea::placeholder{color:#a08070}" +
    ".nda-c button{flex:none;width:44px;height:44px;border-radius:50%;border:1.5px solid #e3b25e;display:grid;place-items:center;cursor:pointer;padding:0;transition:transform .2s,box-shadow .2s}.nda-c button svg{width:20px;height:20px}.nda-c button:active{transform:scale(.93)}" +
    ".nda-c .att,.nda-c .mic{background:linear-gradient(180deg,#fffefb,#fbeee0);color:#7a0f22;border-color:#edc47a;box-shadow:inset 0 1px 0 #fff,0 3px 8px -3px rgba(94,10,26,.28),0 0 10px rgba(255,214,150,.45)}.nda-c .att:hover,.nda-c .mic:hover{box-shadow:inset 0 1px 0 #fff,0 3px 8px -3px rgba(94,10,26,.28),0 0 16px rgba(255,214,150,.85)}" +
    ".nda-c .snd{background:radial-gradient(circle at 35% 28%,#fffbe6 0%,#ffe9a3 22%,#f3c85f 55%,#d99a2b 100%);color:#5e0a1a;border-color:#f6d68c;box-shadow:inset 0 -3px 6px rgba(150,85,10,.3),inset 0 2px 3px rgba(255,255,255,.85),0 0 0 3px rgba(243,207,134,.22),0 0 16px rgba(255,190,90,.75)}.nda-c .snd:hover{transform:scale(1.06);box-shadow:inset 0 -3px 6px rgba(150,85,10,.3),inset 0 2px 3px rgba(255,255,255,.85),0 0 0 4px rgba(243,207,134,.3),0 0 24px rgba(255,190,90,.95)}" +
    ".nda-c .mic.rec{background:radial-gradient(circle at 35% 30%,#e0425f,#a3112f 60%,#6b0a1c);color:#fff;border-color:#ffd27a;animation:ndaRec 1.2s ease-in-out infinite}" +
    "@keyframes ndaRec{0%,100%{box-shadow:0 0 0 0 rgba(224,66,95,.55),0 0 12px rgba(255,190,120,.6)}50%{box-shadow:0 0 0 9px rgba(224,66,95,0),0 0 18px rgba(255,190,120,.9)}}" +
    ".nda-c textarea.rec{color:#a3112f;font-weight:700}" +
    ".nda-dl{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:7px 13px;margin:3px 0;border-radius:14px;font-weight:700;color:#5e0a1a;text-decoration:none;background:linear-gradient(180deg,#fffefb,#fbeee0);box-shadow:0 0 0 1.5px rgba(227,178,94,.85),inset 0 1px 0 #fff,0 4px 10px -4px rgba(94,10,26,.25),0 0 12px rgba(255,214,150,.55);word-break:break-all;transition:transform .2s,box-shadow .2s}.nda-dl:hover{transform:translateY(-1px);box-shadow:0 0 0 1.5px #f6d68c,inset 0 1px 0 #fff,0 6px 14px -4px rgba(94,10,26,.3),0 0 18px rgba(255,214,150,.9)}.nda-say{display:inline-grid;place-items:center;vertical-align:middle;width:30px;height:30px;margin:6px 0 0 6px;float:right;border-radius:50%;border:1.5px solid #e3b25e;background:radial-gradient(circle at 35% 28%,#c42a4a,#7a0f22 58%,#4a0613);color:#fff3dc;cursor:pointer;padding:0;box-shadow:inset 0 1px 1px rgba(255,255,255,.3),0 0 10px rgba(255,190,120,.6)}" +
    ".nda-img{display:block;max-width:100%;max-height:260px;margin:8px 0 2px;border-radius:16px;border:1.5px solid #edc47a;box-shadow:0 8px 18px -10px rgba(94,10,26,.5),0 0 14px rgba(255,214,150,.55);object-fit:cover}.nda-say svg{width:16px;height:16px}.nda-say.on{background:linear-gradient(150deg,#fff0aa,#f3a518);color:#640319;animation:ndaRec 1.2s ease-in-out infinite}.nda-say.ld{opacity:.6}" +
    /* преглед на файл в самия прозорец (снимка, PDF, Word/Excel) – без нова страница */
    ".nda-view{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;background:linear-gradient(165deg,rgba(255,251,247,.97),rgba(251,236,224,.96));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}" +
    ".nda-view .vh{display:flex;align-items:center;gap:8px;padding:12px 12px 10px;background:radial-gradient(120% 170% at 100% 0%,rgba(255,214,150,.3),rgba(255,214,150,0) 48%),radial-gradient(90% 130% at 0% 100%,rgba(30,0,8,.42),rgba(30,0,8,0) 62%),linear-gradient(125deg,#b0233f 0%,#7a0f22 40%,#5e0a1a 70%,#42061a 100%);color:#fff3e2;border-bottom:1.5px solid #e3b25e;box-shadow:0 4px 14px rgba(60,0,12,.35)}" +
    ".nda-view .vh b{flex:1;min-width:0;font:700 15px/1.25 Georgia,'PT Serif Local',serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".nda-view .vh button{flex:none;display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 12px;border-radius:17px;border:1.5px solid #edc47a;background:linear-gradient(180deg,#fff7e3,#f3cf86);color:#6b0a1c;font:700 13px/1 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;cursor:pointer;box-shadow:0 0 10px rgba(255,214,150,.55)}" +
    ".nda-view .vh button:hover{box-shadow:0 0 0 1px #fff1b8,0 0 16px rgba(255,214,150,.9)}.nda-view .vh .vx{width:34px;padding:0;justify-content:center;font-size:15px}" +
    ".nda-view .vb{position:relative;flex:1;min-height:0;margin:12px;border-radius:18px;overflow:auto;background:#fffdf9;box-shadow:0 0 0 1.5px rgba(227,178,94,.8),0 0 16px rgba(255,214,150,.6);display:flex;align-items:center;justify-content:center;-webkit-overflow-scrolling:touch}" +
    ".nda-view .vb img{max-width:100%;max-height:100%;object-fit:contain;display:block}.nda-view .vb iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}" +
    ".nda-view .vmsg{padding:20px;text-align:center;color:#6b4a40;font:15px/1.45 Georgia,'PT Serif Local',serif}" +
    ".nda-view .vnav{display:flex;gap:6px;overflow-x:auto;padding:0 12px 12px;-webkit-overflow-scrolling:touch}" +
    ".nda-view .vnav button{flex:none;max-width:170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:32px;padding:0 12px;border-radius:16px;border:1.5px solid rgba(227,178,94,.8);background:linear-gradient(180deg,#fffdf9,#fbefe5);color:#5a0a18;font:700 12.5px/1 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;cursor:pointer}" +
    ".nda-view .vnav button.on{background:linear-gradient(180deg,#fff7e3,#f3cf86);box-shadow:0 0 10px rgba(255,214,150,.75)}" +
    ".nda-files{padding:0 12px;display:flex;gap:6px;flex-wrap:wrap}" +
    ".nda-case{position:relative;padding:10px 12px 0}" +
    ".nda-case-btn{border:1px solid transparent;border-radius:14px;padding:5px 12px;background:linear-gradient(180deg,#fffefb,#fbeee0) padding-box,linear-gradient(135deg,#f3cf86,#e3b25e 50%,#c98a22) border-box;color:#6b0a1c;font:400 13px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;cursor:pointer;box-shadow:inset 0 1px 0 #fff,0 2px 6px -2px rgba(94,10,26,.22),0 0 10px rgba(255,214,150,.4);transition:transform .2s,box-shadow .2s}.nda-case-btn:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 #fff,0 4px 10px -3px rgba(94,10,26,.25),0 0 14px rgba(255,214,150,.75)}" +
    ".nda-case-btn.on{background:linear-gradient(180deg,#b0233f,#5e0a1a) padding-box,linear-gradient(135deg,#ffe9a3,#e3b25e) border-box;color:#fff3dc;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 0 12px rgba(255,190,120,.6)}" +
    ".nda-case-pop{position:absolute;left:12px;right:12px;bottom:calc(100% + 8px);z-index:5;max-height:300px;overflow:auto;padding:8px;border-radius:20px;border:1.5px solid transparent;background:linear-gradient(180deg,rgba(255,252,247,.97),rgba(251,238,224,.96)) padding-box,linear-gradient(140deg,#ffe9a3,#e3b25e 40%,#a12139) border-box;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 0 22px rgba(255,214,150,.55),0 16px 32px -10px rgba(60,10,20,.4);animation:ndaPop .22s ease-out}" +
    ".nda-case-h{font:700 13px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#8a6a3a;padding:4px 8px 6px}" +
    ".nda-case-i{display:block;width:100%;text-align:left;padding:8px 10px;border:0;border-radius:12px;background:transparent;color:#4e0912;font:700 15px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;cursor:pointer}" +
    ".nda-case-i small{display:block;font-weight:400;font-size:12px;color:#8a6a3a}" +
    ".nda-case-i.on{background:rgba(163,33,58,.12);box-shadow:inset 0 0 0 1px #e3b25e}" +
    ".nda-case-i.new{color:#a3213a}" +
    ".nda-case-err{padding:6px 10px;font:12px Arial;color:#c0392b}" +
    ".nda-files span{font:12px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;padding:3px 8px;border-radius:10px;border:1px solid #e3b25e;color:#6b0a1c;background:#fff}" +
    /* вградени умения в „Чат с Тед“: бутон „Умения“ до казуса, панели вътре в разговора, настройка на пощата */
    ".nda-case{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.nda-case-btn b{font-weight:700}.nda-case-btn.role{max-width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".nda-case-g{font:700 12px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#8a6a3a;padding:8px 8px 4px;text-transform:uppercase;letter-spacing:.04em}" +
    ".nda-emb{align-self:stretch}.nda-emb .nda-f{border:1.5px solid rgba(227,178,94,.8);border-radius:18px;box-shadow:0 0 0 1px rgba(255,236,190,.55) inset,0 0 12px rgba(255,214,150,.5);background:linear-gradient(160deg,rgba(255,250,246,.97),rgba(251,236,224,.94))}" +
    ".nda-pnl{align-self:stretch;display:grid;gap:8px;padding:12px;border-radius:18px;background:linear-gradient(160deg,rgba(255,250,246,.97),rgba(251,236,224,.94));border:1.5px solid rgba(227,178,94,.8);box-shadow:0 0 0 1px rgba(255,236,190,.55) inset,0 0 12px rgba(255,214,150,.5);font:14px/1.35 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#3a0c12}" +
    ".nda-pnl h5{margin:0;font:700 16px Georgia,'PT Serif Local',serif;color:#7a0f22}.nda-pnl label{font:700 13px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#6b0a1c}.nda-pnl input,.nda-pnl select{width:100%;box-sizing:border-box;height:42px;border-radius:12px;border:1.5px solid #e3b25e;background:rgba(255,253,250,.95);padding:0 10px;font:16px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;color:#3a0c12;outline:none}" +
    ".nda-pnl .st{padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.65);box-shadow:inset 0 0 0 1px rgba(227,178,94,.5)}.nda-pnl .hn{font-size:12.5px;color:#6b4a40}.nda-pnl .row{display:flex;gap:8px}.nda-pnl .row button{flex:1;height:42px;border-radius:14px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;font:700 15px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;cursor:pointer;box-shadow:0 0 10px rgba(255,214,150,.45)}" +
    ".nda-mc{display:block;margin-top:8px;padding:10px 12px;border-radius:16px;background:linear-gradient(160deg,rgba(255,252,248,.98),rgba(251,236,224,.95));box-shadow:0 0 0 1.5px rgba(227,178,94,.8),0 0 12px rgba(255,214,150,.55);white-space:normal}" +
    ".nda-mc dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0 0 8px;font-size:14px}.nda-mc dt{color:#8d1530;font-weight:700}.nda-mc dd{margin:0;word-break:break-word}.nda-mc pre{margin:0 0 8px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px rgba(227,178,94,.45);font:14px/1.4 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;white-space:pre-wrap;max-height:180px;overflow:auto}" +
    ".nda-mc .fl{display:flex;flex-direction:column;gap:4px;margin:0 0 8px}.nda-mc .row{display:flex;gap:8px}.nda-mc .row button{flex:1;height:42px;border-radius:14px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;font:700 15px 'Roboto Condensed','Roboto Condensed Local',Arial,sans-serif;cursor:pointer;box-shadow:0 0 10px rgba(255,214,150,.45)}.nda-mc .row button.pri{background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);color:#fff3dc;border-color:#edc47a}.nda-mc .row button:disabled{opacity:.5}.nda-mc .snd-from{font-size:12.5px;color:#6b4a40;margin:0 0 8px}" +
    ".nda-pnl .agw{display:flex;align-items:center;gap:8px}.nda-pnl .agw[hidden]{display:none}" +
    ".nda-pnl .row button.pri{background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);color:#fff3dc;border-color:#edc47a;box-shadow:0 0 0 1px rgba(255,236,190,.5),0 0 12px rgba(255,190,120,.6)}.nda-pnl .row button:disabled{opacity:.55}.nda-pnl .er{color:#c0392b;font-weight:700}" +
    /* премиум движение: меко отваряне на прозореца, плавно появяване на съобщенията и менютата */
    "@keyframes ndaIn{0%{opacity:0;transform:translateY(22px) scale(.94)}60%{opacity:1}100%{opacity:1;transform:none}}@keyframes ndaMsg{from{opacity:0;transform:translateY(8px)}}@keyframes ndaPop{from{opacity:0;transform:translateY(6px) scale(.98)}}" +
    "@keyframes ndaSpin{to{transform:rotate(360deg)}}@keyframes ndaSheen{0%,55%{background-position:100% 0}100%{background-position:0 0}}" +
    "@media (prefers-reduced-motion:reduce){.nda-win,.nda-m,.nda-menu,.nda-case-pop,.nda-av:before,.nda-h:after{animation:none}}";

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
  /* any=true (агентът в n8n): и други файлове (Word, Excel, аудио…) минават както са, вместо да се изпуснат */
  function fileData(f, any) {
    return new Promise(function (ok) {
      var r = new FileReader();
      r.onload = function () {
        var raw = { name: f.name, mime: f.type || "application/octet-stream", data: String(r.result).split(",")[1] };
        if (f.type === "application/pdf" || (any && !/^image\//.test(f.type))) return ok(raw);
        var im = new Image(); im.onload = function () { var k = Math.min(1, 1400 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = im.width * k; c.height = im.height * k; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok({ name: f.name, mime: "image/jpeg", data: c.toDataURL("image/jpeg", .85).split(",")[1] }); };
        im.onerror = function () { ok(any ? raw : null); }; im.src = r.result;
      };
      r.onerror = function () { ok(null); }; r.readAsDataURL(f);
    });
  }
  /* history: [{role:'user'|'assistant', text, files?}] -> {ok,text,actions,staff} */
  /* ---- настройки на чата (пазят се за този брокер в браузъра) ---- */
  var PREF_KEY = "nd-ted-prefs", DEFP = { voice: "male", autoSpeak: "voice", style: "calm", model: "", n8nModel: "", big: false, enterSend: true, showActions: true, dictAuto: true, keepHist: true };
  var prefs = (function () { try { return Object.assign({}, DEFP, JSON.parse(localStorage.getItem(PREF_KEY) || "{}")); } catch (e) { return Object.assign({}, DEFP); } })();
  try { var oldM = localStorage.getItem("nd-ted-model"); if (oldM && !prefs.model) prefs.model = oldM; } catch (e) {}
  /* еднократно: всички започват с личния безплатен агент (Flash Lite); по-силен модел се избира ръчно от ⚙ → Модел */
  if (!prefs.free1) { prefs.model = ""; prefs.free1 = true; try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); localStorage.removeItem("nd-ted-model"); } catch (e) {} }
  var modelId = prefs.model || "";
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) {} if (window.ND && window.ND.setPref && window.ND.user) { try { window.ND.setPref("ted:" + window.ND.user.id, prefs).catch(function () {}); } catch (e) {} } }
  function applyPrefs() { if (win) win.classList.toggle("big", !!prefs.big); modelId = prefs.model || ""; }
  var VOICES = [
    { id: "male", name: "Мъжки – спокоен", note: "сегашният глас на Тед", g: "Charon" },
    { id: "female", name: "Женски – мек", note: "топъл, спокоен, същият начин на изразяване", g: "Achernar" },
    { id: "female2", name: "Женски – гладък", note: "по-плътен и уверен", g: "Despina" },
    { id: "male2", name: "Мъжки – енергичен", note: "по-бодър и бърз", g: "Puck" }
  ];
  var STYLES = [["calm", "Спокоен и топъл"], ["brief", "Кратък и делови"], ["slow", "Бавен и ясен (за диктовка на клиент)"]];
  var N8N_OPT = { id: "n8n", name: "Агент n8n", note: "вашият агент от n8n (моделите са вързани вътре в n8n)", provider: "n8n", vision: true, pdf: true, sub: [["", "По подразбиране (както е в n8n)"], ["gpt", "ChatGPT"], ["claude", "Claude"], ["ollama", "Ollama (локален)"], ["gemini", "Gemini"]] };
  var models = null;
  function loadModels() {
    if (models) return Promise.resolve(models);
    return token().then(function (tk) { return fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify({ action: "models" }) }); })
      .then(function (r) { return r.json(); }).then(function (j) { if (j && j.n8n) N8N_URL = j.n8n; models = ((j && j.models) || []).concat(j && j.n8n ? [N8N_OPT] : []); if (modelId === "n8n" && !(j && j.n8n)) { prefs.model = ""; modelId = ""; savePrefs(); } return models; }).catch(function () { models = []; return models; });
  }
  function curModel() { return (models || []).filter(function (m) { return m.id === modelId; })[0] || (models || [])[0] || null; }
  function setModel(id, quiet) {
    prefs.model = id || ""; modelId = prefs.model; savePrefs();
    var m = curModel(); if (m && !quiet) add("bot", "Избран модел: <b>" + esc(m.name) + "</b>" + (m.note ? " – " + esc(m.note) : "") + (m.pdf ? "" : " · без PDF") + (m.vision ? "" : " · без снимки"));
  }
  var setTab = "voice";
  function renderSettings() {
    var sb = win.querySelector(".nda-set"), PROV = { gemini: "Google", openai: "OpenAI", anthropic: "Anthropic", openrouter: "OpenRouter", ollama: "Ollama", n8n: "n8n" };
    var TABS = [["voice", "Глас", I.spk], ["model", "Модел", "🧠"], ["chat", "Чат", "💬"], ["dict", "Диктовка", "🎤"]];
    var sw = function (k, t, sub) { return '<div class="nda-sw' + (prefs[k] ? " on" : "") + '" data-sw="' + k + '" role="switch" aria-checked="' + !!prefs[k] + '"><div>' + t + (sub ? "<small>" + sub + "</small>" : "") + '</div><span class="tg"></span></div>'; };
    var html = '<div class="sh"><b>Настройки на чата</b><button type="button" class="nda-x" data-sx aria-label="Затвори настройките">' + I.x + "</button></div>" +
      '<div class="nda-tabs">' + TABS.map(function (t) { return '<button type="button" data-st="' + t[0] + '"' + (setTab === t[0] ? ' class="on"' : "") + ">" + (t[2].length > 2 ? t[2] : "<span>" + t[2] + "</span>") + t[1] + "</button>"; }).join("") + "</div><div class=\"nda-sb\">";
    if (setTab === "voice") {
      html += '<div class="nda-sec"><h4>' + I.spk + "Глас на Тед</h4><p>Същият начин на изразяване, различен тембър. Натиснете ▶, за да чуете.</p>" +
        VOICES.map(function (v) { return '<button type="button" class="nda-opt' + (prefs.voice === v.id ? " on" : "") + '" data-voice="' + v.id + '"><i></i><span class="d">' + esc(v.name) + "<small>" + esc(v.note) + '</small></span><span class="pl" data-play="' + v.id + '" title="Чуй">' + I.spk + "</span></button>"; }).join("") + "</div>" +
        '<div class="nda-sec"><h4>Стил на говорене</h4>' + STYLES.map(function (x) { return '<button type="button" class="nda-opt' + (prefs.style === x[0] ? " on" : "") + '" data-style="' + x[0] + '"><i></i><span class="d">' + x[1] + "</span></button>"; }).join("") + "</div>" +
        '<div class="nda-sec"><h4>Кога да говори</h4>' + [["voice", "Само след гласов въпрос"], ["always", "Чете всеки отговор на глас"], ["never", "Никога – само бутона ▶"]].map(function (x) { return '<button type="button" class="nda-opt' + (prefs.autoSpeak === x[0] ? " on" : "") + '" data-auto="' + x[0] + '"><i></i><span class="d">' + x[1] + "</span></button>"; }).join("") + "</div>";
    } else if (setTab === "model") {
      var cur = curModel();
      html += '<div class="nda-sec"><h4>Модел на изкуствения интелект</h4><p>Активен: <b>' + esc(cur ? cur.name : "—") + "</b>. По подразбиране е личният безплатен агент – за клиенти, имоти, календар и качване. За тежки задачи изберете по-силен модел тук; изборът се помни.</p>" +
        (models || []).map(function (m) {
          var on = cur && cur.id === m.id;
          return '<button type="button" class="nda-opt' + (on ? " on" : "") + '" data-m="' + esc(m.id) + '"><i></i><span class="d">' + esc(m.name) + "<small>" + esc(m.note || "") + (m.pdf ? "" : " · без PDF") + (m.vision ? "" : " · без снимки") + "</small></span><em>" + (PROV[m.provider] || m.provider) + "</em></button>" +
            (m.sub && on ? '<div class="nda-sub">' + m.sub.map(function (x) { return '<button type="button" class="nda-opt' + (prefs.n8nModel === x[0] ? " on" : "") + '" data-n8nm="' + esc(x[0]) + '"><i></i><span class="d">' + esc(x[1]) + "</span></button>"; }).join("") + "</div>" : "");
        }).join("") + "</div>";
    } else if (setTab === "chat") {
      html += '<div class="nda-sec"><h4>Чат</h4>' + sw("big", "По-едри букви", "по-четливо на телефон") + sw("enterSend", "Enter изпраща", "Shift+Enter – нов ред") + sw("showActions", "Показвай какво е направил", "списък с изпълнените действия под отговора") + sw("keepHist", "Помни разговора между страниците", "историята се пази за сесията") + "</div>" +
        '<div class="nda-sec"><h4>История</h4><button type="button" class="nda-opt" data-clear><i></i><span class="d">Изчисти разговора<small>започва на чисто</small></span></button></div>';
    } else {
      html += '<div class="nda-sec"><h4>Диктовка</h4><p>Микрофонът в чата и във всяко поле за бележка разпознава дословно на български.</p>' + sw("dictAuto", "Изпращай гласовия въпрос веднага", "иначе първо виждате текста и го пращате вие") + "</div>" +
        '<div class="nda-sec"><h4>Бележки</h4><p>Във всяка графа за бележка/описание в CRM има микрофон – докоснете, говорете, докоснете пак; текстът се добавя при курсора.</p></div>';
    }
    html += "</div>";
    sb.innerHTML = html;
    sb.onclick = function (e) {
      var t;
      if (e.target.closest("[data-sx]")) { sb.hidden = true; win.querySelector(".nda-gear").classList.remove("on"); return; }
      if ((t = e.target.closest("[data-st]"))) { setTab = t.getAttribute("data-st"); renderSettings(); return; }
      if ((t = e.target.closest("[data-play]"))) { e.stopPropagation(); previewVoice(t.getAttribute("data-play"), t); return; }
      if ((t = e.target.closest("[data-voice]"))) { prefs.voice = t.getAttribute("data-voice"); savePrefs(); renderSettings(); return; }
      if ((t = e.target.closest("[data-style]"))) { prefs.style = t.getAttribute("data-style"); savePrefs(); renderSettings(); return; }
      if ((t = e.target.closest("[data-auto]"))) { prefs.autoSpeak = t.getAttribute("data-auto"); savePrefs(); renderSettings(); return; }
      if ((t = e.target.closest("[data-n8nm]"))) { prefs.n8nModel = t.getAttribute("data-n8nm"); savePrefs(); renderSettings(); return; }
      if ((t = e.target.closest("[data-m]"))) { setModel(t.getAttribute("data-m"), true); renderSettings(); return; }
      if ((t = e.target.closest("[data-sw]"))) { var k = t.getAttribute("data-sw"); prefs[k] = !prefs[k]; savePrefs(); applyPrefs(); renderSettings(); return; }
      if (e.target.closest("[data-clear]")) { hist = []; save(); try { N8N_SID = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); localStorage.setItem("nd-ted-n8n-sid", N8N_SID); } catch (x) {} list.innerHTML = ""; sb.hidden = true; win.querySelector(".nda-gear").classList.remove("on"); add("bot", "Разговорът е изчистен."); return; }
    };
  }
  function voiceOf(id) { return VOICES.filter(function (v) { return v.id === id; })[0] || VOICES[0]; }
  function previewVoice(id, btn) {
    var v = voiceOf(id); btn.style.opacity = ".5";
    token().then(function (tk) { return fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify({ text: "Здравейте, аз съм Тед – асистентът на Имоти Надежда. С този глас ще ви чета отговорите.", voice: v.g, style: prefs.style }) }); })
      .then(function (r) { if (!r.ok) throw new Error("tts"); return r.blob(); })
      .then(function (bl) { if (!player) player = new Audio(); player.src = URL.createObjectURL(bl); return player.play(); })
      .catch(function () { try { var u = new SpeechSynthesisUtterance("Здравейте, аз съм Тед."); u.lang = "bg-BG"; speechSynthesis.speak(u); } catch (e) {} })
      .then(function () { btn.style.opacity = ""; });
  }
  /* вашият агент в n8n (същият като в публичния сайт): текстът отива към webhook-а, n8n ползва /api/tools с токена на брокера */
  /* агентът в n8n се показва само когато във Vercel има N8N_AGENT_URL (т.е. когато потокът работи) */
  var N8N_DEFAULT = "https://imotinadezhda.app.n8n.cloud/webhook/488c6f8e-791b-4f42-8869-3e12c62ccca5";
  var N8N_URL = "", N8N_SID = (function () { try { var k = "nd-ted-n8n-sid", v = localStorage.getItem(k); if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); localStorage.setItem(k, v); } return v; } catch (e) { return "s" + Date.now(); } })();
  /* прикачени файлове и глас към агента (само за влезли служители): качват се в nd-files/ted-chat/<гггг-мм>/ (както bank.html),
     получават линк за 7 дни и отиват към n8n в блок [ATTACHMENTS] в текста + поле "attachments" */
  var N8N_MAX_FILES = 6, N8N_MAX_MB = 20, ATT_RE = /\n*\[ATTACHMENTS\][\s\S]*?\[\/ATTACHMENTS\]\n*/g;
  var AUTO_TXT = /^(\(гласово съобщение\)|Анализирай прикачените файлове\.)$/;
  var EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf", "audio/webm": "webm", "audio/mp4": "m4a", "audio/aac": "aac", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav" };
  function isN8n() { return modelId === "n8n" || !!(skill && skill.id === "n8n"); }
  function kindOf(m) { return /^image\//.test(m) ? "image" : m === "application/pdf" ? "pdf" : /^audio\//.test(m) ? "audio" : "file"; }
  function uErr(msg) { var e = new Error(msg); e.user = true; return e; }
  function b64Blob(data, mime) { var bin = atob(data), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); }
  function upFile(tok, f) {
    var mime = f.mime || "application/octet-stream", d = new Date(), kind = kindOf(mime);
    var ext = EXT[mime] || ((/\.([a-z0-9]{1,6})$/i.exec(f.name || "") || [])[1] || "bin").toLowerCase();
    var rnd = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    var path = "ted-chat/" + d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + rnd + "." + ext;
    var name = f.name || (kind === "audio" ? "гласово-съобщение." + ext : "файл." + ext), H = { apikey: SB_KEY, Authorization: "Bearer " + tok };
    return fetch(SB_URL + "/storage/v1/object/nd-files/" + path, { method: "POST", headers: Object.assign({ "Content-Type": mime, "x-upsert": "true" }, H), body: b64Blob(f.data, mime) })
      .then(function (r) {
        if (!r.ok) throw uErr("Файлът „" + name + "“ не се качи" + (r.status === 401 || r.status === 403 ? " – нямате права за качване (влезте отново в CRM)." : " (HTTP " + r.status + "). Опитайте отново."));
        return fetch(SB_URL + "/storage/v1/object/sign/nd-files/" + path, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ expiresIn: 604800 }) });
      })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        var su = j && (j.signedURL || j.signedUrl); if (!su) throw uErr("Файлът „" + name + "“ е качен, но не се получи линк за агента. Опитайте отново.");
        return { kind: kind, name: name, mime: mime, url: /^https?:/.test(su) ? su : SB_URL + "/storage/v1" + su };
      });
  }
  function attHint(att) {
    var k = {}, h = []; att.forEach(function (a) { k[a.kind] = 1; });
    if (k.image) h.push("снимки → analyze_image");
    if (k.pdf) h.push("PDF → analyze_document");
    if (k.audio) h.push("гласово съобщение/аудио → първо transcribe_audio, после отговори на казаното");
    if (k.file) h.push("други файлове → parse_document или pdf_convert");
    return "(Прикачени файлове – линковете са в блока ATTACHMENTS, валидни 7 дни: " + h.join("; ") + ".)";
  }
  /* „Да“ след подготвен имейл → изпраща се веднага (както в Тед на сайта): без AI, точно показаното – email.send {confirm:true} */
  var N8N_AFFIRM = /^\s*(да|да,?\s*(изпрати|прати|изпращай|го изпрати|го прати)(\s+го)?|изпрати(\s+го)?|прати(\s+го)?|ок|окей|потвърждавам|давай|yes)\s*[.!]*\s*$/i;
  function lastAssistantText(history) {
    var a = history.slice(0, -1).filter(function (m) { return m && m.role === "assistant"; }).slice(-1)[0]; if (a && a.text) return a.text;
    var el = list ? [].slice.call(list.querySelectorAll(".nda-m.a")).filter(function (x) { return !x.classList.contains("wait"); }).pop() : null;
    return el ? el.textContent : "";
  }
  function sendDraft(tok) {
    return fetch("/api/tools", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ tool: "email.send", input: { confirm: true } }) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); })
      .then(function (j) {
        var x = j && j.ok && j.result ? j.result : null;
        var out = x && x.sent ? "✔ Изпратено до " + (x.to_name ? x.to_name + " <" + x.to + ">" : x.to) + " от " + x.from + (x.via && /агенцията/.test(x.via) ? " (" + x.via + ")" : "") + ".\nТема: " + x.subject + (x.attachments && x.attachments.length ? "\nПрикачени: " + x.attachments.join(", ") : "")
          : x && x.need_setup ? x.reason + (x.mailto ? "\n[Изпрати от моята поща](" + x.mailto + ")" : "") : "Имейлът не е изпратен: " + ((j && j.error) || "грешка");
        return { ok: true, text: out, actions: ["email.send" + (x && x.sent ? "" : " ✗")], model: "n8n", model_name: "n8n Agent", ui: x && x.need_setup ? { panel: "mail" } : undefined };
      });
  }
  /* глас → текст с Gemini (/api/transcribe, безплатно), както в Тед на сайта; при грешка записът отива към агента както досега */
  function hear(tok, f) {
    return fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ mime: f.mime, data: f.data }) })
      .then(function (r) { return r.json(); }).then(function (j) { return j && j.ok && j.text ? String(j.text).trim() : ""; }).catch(function () { return ""; });
  }
  function askN8n(history, extra) {
    extra = extra || {};
    var last = history[history.length - 1] || {}, text = String(last.text || "").trim(), fl = (last.files || []).filter(function (f) { return f && f.data; });
    var ctrl = new AbortController(), timer = null, heard = "";
    return token().then(function (tok) {
      var att = [];
      if (!tok) { /* посетител без вход: както досега – само текст */
        if (!text || (fl.length && AUTO_TXT.test(text))) throw uErr("Агентът в n8n приема текст – за снимки, файлове и глас изберете Gemini или друг модел.");
        text += fl.length ? "\n(прикачени файлове: " + fl.map(function (f) { return f.name || f.mime; }).join(", ") + ")" : "";
        return [tok, text, att];
      }
      if (!fl.length && N8N_AFFIRM.test(text) && /изпратя ли/i.test(lastAssistantText(history))) return sendDraft(tok).then(function (r) { return { done: r }; });
      if (!text && !fl.length) throw uErr("Напишете съобщение или прикачете файл.");
      var aud = fl.filter(function (f) { return /^audio\//.test(String(f.mime)); });
      return Promise.all(aud.map(function (f) { return hear(tok, f); })).then(function (tx) {
        var got = tx.filter(Boolean).join("\n");
        if (got) { heard = got; fl = fl.filter(function (f) { return aud.indexOf(f) < 0; }); text = !text || AUTO_TXT.test(text) ? got : got + "\n" + text; }
        if (fl.length > N8N_MAX_FILES) throw uErr("Към агента в n8n могат да се прикачат най-много " + N8N_MAX_FILES + " файла наведнъж (сега са " + fl.length + ").");
        var big = fl.filter(function (f) { return f.data.length * 3 / 4 > N8N_MAX_MB * 1048576; })[0];
        if (big) throw uErr("Файлът „" + (big.name || "запис") + "“ е " + (big.data.length * 3 / 4 / 1048576).toFixed(1) + " MB – агентът в n8n приема файлове до " + N8N_MAX_MB + " MB.");
        return Promise.all(fl.map(function (f) { return upFile(tok, f); })).then(function (a) {
          att = a;
          if (!text) text = att.every(function (x) { return x.kind === "audio"; }) ? "(гласово съобщение)" : "Анализирай прикачените файлове.";
          if (att.length) text += "\n\n" + attHint(att) + "\n[ATTACHMENTS]\n" + JSON.stringify(att) + "\n[/ATTACHMENTS]";
          return [tok, text, att];
        });
      });
    }).then(function (x) {
      if (x && x.done) return x;
      var att = x[2]; timer = setTimeout(function () { ctrl.abort(); }, att.length ? 180000 : 150000);
      return fetch(N8N_URL || N8N_DEFAULT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: x[1], sessionId: N8N_SID, accessToken: x[0] || null, toolsUrl: location.origin + "/api/tools", model: prefs.n8nModel || undefined, mode: extra.mode || undefined, case_id: extra.case_id || undefined, page: document.title, attachments: att.length ? att : undefined }), signal: ctrl.signal });
    }).then(function (r) { if (r && r.done) return r; if (!r.ok) throw new Error("агентът върна HTTP " + r.status); return r.json(); })
      .then(function (d) {
        if (d && d.done) return d.done;
        if (Array.isArray(d)) d = d[0]; var out = d && (d.output || d.text || d.answer); if (typeof out === "string") out = out.replace(ATT_RE, "\n").trim(); if (typeof out !== "string" || !out) throw new Error("невалиден отговор от агента");
        /* имейл карта, панели, видео, действия и ролята идват от n8n в същия вид като от Тед на сайта */
        return { ok: true, text: out, actions: Array.isArray(d.actions) ? d.actions : [], model: "n8n", model_name: d.model_name || "n8n Agent", mode: d.mode || undefined,
          email: d.email && typeof d.email === "object" ? d.email : undefined, ui: d.ui && typeof d.ui === "object" ? d.ui : undefined, video: d.video || undefined,
          transcript: heard || (d && typeof d.transcript === "string" && d.transcript.trim() ? d.transcript.trim() : undefined) };
      })
      .catch(function (e) { return { ok: false, error: e && e.user ? e.message : e && e.name === "AbortError" ? "Агентът в n8n не отговори навреме." : "Агент n8n: " + ((e && e.message) || e) }; })
      .then(function (j) { clearTimeout(timer); return j; });
  }
  function ask(history, extra) {
    if (modelId === "n8n" || (skill && skill.id === "n8n")) return askN8n(history, extra);
    extra = extra || {};
    return token().then(function (tok) {
      var h = { "Content-Type": "application/json" }; if (tok) h.Authorization = "Bearer " + tok;
      return fetch("/api/assistant", { method: "POST", headers: h, body: JSON.stringify({ messages: history, page: document.title, model: modelId || undefined, mode: extra.mode || undefined, case_id: extra.case_id || undefined }) });
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); })
      .catch(function (e) { return { ok: false, error: "Няма връзка (" + ((e && e.message) || e) + ")" }; });
  }

  /* ---- казуси (проекти с безкрайна памет): активният казус се пази за брокера; историята му идва от сървъра ---- */
  var staffCtx;
  var CASE_KEY = "nd-ted-case", curCase = null; try { curCase = JSON.parse(localStorage.getItem(CASE_KEY) || "null"); } catch (e) { curCase = null; }
  function tool(name, input) {
    return token().then(function (tk) { return fetch("/api/tools", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify({ tool: name, input: input || {} }) }); })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); });
  }
  function setCase(c) { curCase = c || null; try { if (c) localStorage.setItem(CASE_KEY, JSON.stringify(c)); else localStorage.removeItem(CASE_KEY); } catch (e) {} }
  /* ---- widget ---- */
  var skills = [], skill = null, win, fab, list, menu, foot, booted = false, hist = [];
  var STORE = "nd-ash-chat";
  try { hist = JSON.parse(sessionStorage.getItem(STORE) || "[]") || []; } catch (e) { hist = []; }
  function save() { try { sessionStorage.setItem(STORE, JSON.stringify(hist.slice(-30).map(function (m) { return { role: m.role, text: m.text }; }))); } catch (e) {} }
  /* Преглед на файл от чата в карта в самия прозорец на Тед (снимка, PDF, Word/Excel през вграден визуализатор) – без нова страница */
  function isFileUrl(u) { return /imotinadezhda\.bg\/f\/|\/storage\/v1\/object\/(sign|public)\/|\/webhook\/ted-media\?|\.(pdf|jpe?g|png|webp|gif|heic|docx?|xlsx?|pptx?|txt|csv)(\?|#|&|$)/i.test(String(u || "")); }
  function fileKind(u, name) { var s = (String(name || "") + " " + String(u || "").split("#")[0]).toLowerCase(); if (/\.(jpe?g|png|webp|gif|heic)(\b|$)/.test(s)) return "img"; if (/\.pdf(\b|$)/.test(s)) return "pdf"; if (/\.(docx?|xlsx?|pptx?)(\b|$)/.test(s)) return "doc"; return "other"; }
  function viewFiles(items, idx) {
    if (!win || !items.length) return;
    var old = win.querySelector(".nda-view"); if (old) old.remove();
    var v = document.createElement("div"); v.className = "nda-view"; v.setAttribute("role", "dialog"); v.setAttribute("aria-label", "Преглед на файл"); win.appendChild(v);
    function show(i) {
      idx = i; var f = items[idx], k = fileKind(f.url, f.name);
      v.innerHTML = '<div class="vh"><b title="' + esc(f.name) + '">' + esc(f.name) + (items.length > 1 ? " · " + (idx + 1) + "/" + items.length : "") + "</b>" +
        '<button type="button" data-vdl>Изтегли</button><button type="button" data-vnew>Нов прозорец</button><button type="button" class="vx" data-vx aria-label="Затвори">✕</button></div>' +
        '<div class="vb">' + (k === "img" ? '<img src="' + esc(f.url) + '" alt="' + esc(f.name) + '">' :
          k === "pdf" ? '<iframe src="' + esc(f.url) + '#toolbar=1&view=FitH" title="' + esc(f.name) + '"></iframe>' :
          k === "doc" ? '<iframe src="https://docs.google.com/gview?embedded=1&url=' + encodeURIComponent(f.url) + '" title="' + esc(f.name) + '"></iframe>' :
          '<div class="vmsg">Този вид файл не може да се покаже тук.<br>Натиснете „Изтегли“.</div>') + "</div>" +
        (items.length > 1 ? '<div class="vnav">' + items.map(function (x, j) { return '<button type="button" data-vi="' + j + '"' + (j === idx ? ' class="on"' : "") + ">" + esc(x.name) + "</button>"; }).join("") + "</div>" : "");
      var im = v.querySelector(".vb img"); if (im) im.onerror = function () { v.querySelector(".vb").innerHTML = '<div class="vmsg">Файлът не се отвори – линкът може да е изтекъл.<br>Поискайте нов линк от Тед.</div>'; };
    }
    v.onclick = function (e) {
      if (e.target.closest("[data-vx]")) { v.remove(); return; }
      var vi = e.target.closest("[data-vi]"); if (vi) { show(+vi.getAttribute("data-vi")); return; }
      var f = items[idx];
      if (e.target.closest("[data-vnew]")) { window.open(f.url, "_blank", "noopener"); return; }
      if (e.target.closest("[data-vdl]")) { var a = document.createElement("a"); a.href = f.url; a.download = f.name || "file"; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
    };
    show(idx || 0);
  }
  function fileClick(e) {
    var a = e.target.closest && e.target.closest("a[href]"); if (!a || !list || !list.contains(a) || !isFileUrl(a.href)) return;
    e.preventDefault();
    var box = a.closest(".nda-m") || list, seen = {}, items = [];
    [].forEach.call(box.querySelectorAll("a[href]"), function (x) {
      if (!isFileUrl(x.href) || seen[x.href]) return; seen[x.href] = 1;
      var name = (x.classList.contains("nda-dl") ? x.textContent : "").replace(/^[\s\u{1F4C4}\u{1F5BC}\u{FE0F}\u{1F517}]+/u, "").trim();
      items.push({ url: x.href, name: name || decodeURIComponent((x.href.split("?")[0].split("/").pop() || "Файл")) });
    });
    var i = 0; items.forEach(function (it, j) { if (it.url === a.href) i = j; });
    viewFiles(items, i);
  }
  function add(role, html, cls) { var m = document.createElement("div"); m.className = "nda-m " + role + (cls ? " " + cls : ""); m.innerHTML = html; list.appendChild(m); if (role === "a" && cls !== "wait") speaker(m); list.scrollTop = list.scrollHeight; return m; }

  /* ---- резултатите от планираните задачи на Тед (напомняния, повтарящи се задачи, промени по сайтове) идват тук, в чата, вместо в Telegram.
     Само за влезли служители: на всеки 60 s (докато страницата е видима) и при отваряне на прозореца питаме n8n (ted-inbox) за непрочетените;
     всяко идва като съобщение от Тед в историята, а докато прозорецът е затворен – брояч върху бутона. Грешките са тихи (най-много едно предупреждение). ---- */
  var INBOX_URL = "https://imotinadezhda.app.n8n.cloud/webhook/ted-inbox", INBOX_SEEN = "nd-ted-inbox-seen", INBOX_UNREAD = "nd-ted-inbox-unread";
  var inboxBusy = false, inboxOff = false, inboxWarned = false, inboxTimer = null, inboxLast = 0;
  function inboxToken() {
    /* CRM: сесията от Supabase клиента (след проверката за служител); иначе само валиден запазен токен – без собствено опресняване */
    if (window.ND && window.ND.token) return window.ND.user ? window.ND.token().then(function (t) { return t || ""; }, function () { return ""; }) : Promise.resolve("");
    var s = null; try { s = JSON.parse(localStorage.getItem(SB_KEY_STORE) || "null"); } catch (e) {}
    return Promise.resolve(s && s.access_token && (!s.expires_at || s.expires_at * 1000 > Date.now() + 30000) ? s.access_token : "");
  }
  function inboxUnread() { try { return +sessionStorage.getItem(INBOX_UNREAD) || 0; } catch (e) { return 0; } }
  function inboxBadge(n) {
    try { if (n) sessionStorage.setItem(INBOX_UNREAD, String(n)); else sessionStorage.removeItem(INBOX_UNREAD); } catch (e) {}
    /* бутонът на Тед: кръглият долу вдясно, а на компютър – „Тед“ в лявата лента на CRM */
    [fab, document.querySelector("#ndside .sb-ted")].forEach(function (el) {
      if (!el) return;
      var b = el.querySelector(".n");
      if (!n) { if (b) b.remove(); el.setAttribute("aria-label", "Тед Асистент"); return; }
      if (!b) { b = document.createElement("span"); b.className = "n"; b.setAttribute("aria-hidden", "true"); el.appendChild(b); }
      b.textContent = n > 99 ? "99+" : String(n);
      el.setAttribute("aria-label", "Тед Асистент – " + n + (n === 1 ? " ново известие" : " нови известия"));
    });
  }
  function inboxShow(items) {
    var seen = []; try { seen = JSON.parse(localStorage.getItem(INBOX_SEEN) || "[]") || []; } catch (e) {}
    var key = function (it) { return String(it.id) + "|" + String(it.created_at || ""); };
    var fresh = items.filter(function (it) { return it && it.id != null && seen.indexOf(key(it)) < 0 && (it.title || it.text); });
    if (!fresh.length) return;
    var live = !!(list && (skill === chatSkill || skill === n8nSkill));
    fresh.forEach(function (it) {
      var text = String(it.title || "").trim() + (it.title && it.text ? "\n" : "") + String(it.text || "").trim();
      seen.push(key(it)); hist.push({ role: "assistant", text: text });
      if (live) add("a", fmt(text));
    });
    save();
    try { localStorage.setItem(INBOX_SEEN, JSON.stringify(seen.slice(-200))); } catch (e) {}
    if (!win || win.hidden) inboxBadge(inboxUnread() + fresh.length);
  }
  function inboxPoll(force) {
    if (inboxOff || inboxBusy || window.NDAshNoWidget) return;
    if (!force && (document.visibilityState === "hidden" || Date.now() - inboxLast < 20000)) return;
    inboxBusy = true;
    inboxToken().then(function (tk) {
      if (!tk) return;
      inboxLast = Date.now();
      return fetch(INBOX_URL, { method: "GET", headers: { Authorization: "Bearer " + tk }, cache: "no-store" }).then(function (r) {
        if (r.status === 401 || r.status === 403 || r.status === 404) { inboxOff = true; throw new Error("HTTP " + r.status); }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then(function (j) { if (j && j.ok && Array.isArray(j.items) && j.items.length) inboxShow(j.items); });
    }).catch(function (e) {
      if (!inboxWarned) { inboxWarned = true; try { console.warn("Тед: известията от задачите не се заредиха –", (e && e.message) || e); } catch (x) {} }
    }).then(function () { inboxBusy = false; });
  }
  function inboxOpened() { inboxBadge(0); inboxPoll(true); }
  function inboxStart() {
    if (inboxTimer || window.NDAshNoWidget) return;
    inboxBadge(inboxUnread());
    setTimeout(function () { inboxBadge(inboxUnread()); inboxPoll(true); }, 2500);
    setTimeout(function () { if (!inboxLast) inboxPoll(true); }, 10000);
    inboxTimer = setInterval(function () { inboxBadge(inboxUnread()); inboxPoll(false); }, 60000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") inboxPoll(false); });
  }

  /* ---- listen to an answer (Gemini TTS, falls back to the phone's own Bulgarian voice) ---- */
  var player = null, playingBtn = null;
  function stopAll() {
    if (player) { try { player.pause(); } catch (e) {} }
    try { speechSynthesis.cancel(); } catch (e) {}
    if (playingBtn) playingBtn.classList.remove("on", "ld"); playingBtn = null;
  }
  function plain(el) { var c = el.cloneNode(true); [].forEach.call(c.querySelectorAll(".nda-say,.acts,a.go,.nda-mc,.nda-img"), function (x) { x.remove(); }); [].forEach.call(c.querySelectorAll("tr"), function (tr) { tr.appendChild(document.createTextNode(". ")); }); return c.textContent.replace(/[•✔📁📎🎤]/g, " ").replace(/\s+/g, " ").trim(); }
  function speakLocal(text, btn) {
    try {
      var u = new SpeechSynthesisUtterance(text); u.lang = "bg-BG"; u.rate = 1;
      var v = speechSynthesis.getVoices().filter(function (x) { return /^bg/i.test(x.lang); })[0]; if (v) u.voice = v;
      u.onend = u.onerror = function () { if (playingBtn === btn) stopAll(); };
      btn.classList.remove("ld"); btn.classList.add("on"); speechSynthesis.speak(u);
    } catch (e) { stopAll(); }
  }
  /* iPhone пуска звук само след докосване: „отключваме“ плейъра и гласа на телефона в самото докосване (микрофон / изпрати / ▶) */
  var SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
  function unlockAudio() {
    if (!player) player = new Audio();
    try { if (!playingBtn) { player.src = SILENT; var pp = player.play(); if (pp && pp.catch) pp.catch(function () {}); } } catch (e) {}
    try { if (window.speechSynthesis && !speechSynthesis.speaking) { var u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } } catch (e) {}
  }
  /* дългите отговори се четат на части: първата е къса (бърз старт), следващата се подготвя, докато тече предишната */
  function chunksOf(text) {
    var ss = String(text).match(/[^.!?…;:\n]+[.!?…;:\n]*\s*/g) || [String(text)], out = [], cur = "", lim = 260;
    ss.forEach(function (x) { if (cur && (cur + x).length > lim) { out.push(cur.trim()); cur = ""; lim = 900; } while (x.length > 1000) { out.push(x.slice(0, 1000)); x = x.slice(1000); } cur += x; });
    if (cur.trim()) out.push(cur.trim());
    return out.filter(Boolean);
  }
  function ttsUrl(text) {
    return token().then(function (tk) { return fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify({ text: text, voice: voiceOf(prefs.voice).g, style: prefs.style }) }); })
      .then(function (r) { if (!r.ok) throw new Error("tts " + r.status); return r.blob(); }).then(function (bl) { return URL.createObjectURL(bl); });
  }
  function speaker(m) {
    if (m.querySelector(".nda-say")) return;
    var b = document.createElement("button"); b.type = "button"; b.className = "nda-say"; b.setAttribute("aria-label", "Чуй отговора"); b.title = "Чуй"; b.innerHTML = I.spk;
    b.onclick = function () {
      if (playingBtn === b) { stopAll(); return; }
      stopAll(); unlockAudio(); playingBtn = b; b.classList.add("ld");
      var parts = b._parts || (b._parts = chunksOf(plain(m))), urls = b._urls || (b._urls = []), pend = {};
      if (!parts.length) { stopAll(); return; }
      function get(i) { if (i >= parts.length) return Promise.resolve(null); if (urls[i]) return Promise.resolve(urls[i]); if (!pend[i]) pend[i] = ttsUrl(parts[i]).then(function (u) { urls[i] = u; return u; }); return pend[i]; }
      function play(i) {
        if (playingBtn !== b) return;
        if (i >= parts.length) { stopAll(); return; }
        get(i).then(function (url) {
          if (playingBtn !== b) return;
          player.onended = function () { play(i + 1); };
          player.onerror = function () { if (playingBtn === b) speakLocal(parts.slice(i).join(" "), b); };
          player.src = url; b.classList.remove("ld"); b.classList.add("on");
          var p = player.play(); if (p && p.catch) p.catch(function () { if (playingBtn === b) speakLocal(parts.slice(i).join(" "), b); });
          get(i + 1).catch(function () {});
        }).catch(function () { if (playingBtn === b) speakLocal(parts.slice(i).join(" "), b); });
      }
      play(0);
    };
    m.appendChild(b);
  }
  /* markdown links and bare URLs become real links; PDF links get a download badge */
  function fmt(t) {
    var h = esc(t).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|\n)[*-] /g, "$1• ");
    h = h.replace(/\[([^\]]{1,120})\]\((https?:[^)\s]+)\)/g, function (m, a, u) { var im = /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u.split("#")[0]); return '<a class="nda-dl" href="' + u + '" target="_blank" rel="noopener">' + (/\.pdf/i.test(a + u) ? "📄 " : im ? "🖼️ " : "🔗 ") + a + "</a>" + (im ? '<a href="' + u + '" target="_blank" rel="noopener"><img class="nda-img" src="' + u + '" alt="" loading="lazy"></a>' : ""); });
    h = h.replace(/(^|[^"'>=])(https?:\/\/[^\s<)]+)/g, function (m, pre, u) { return pre + '<a class="nda-dl" href="' + u + '" target="_blank" rel="noopener">' + u.replace(/^https?:\/\//, "").slice(0, 60) + (u.length > 68 ? "…" : "") + "</a>"; });
    return h;
  }

  function caseIntro(api, s) {
    if (curCase) {
      if (s && s.intro0) s.intro0(api);
      var w = api.add("a", "📁 Казус <b>" + esc(curCase.title) + "</b> – зареждам паметта…", "wait");
      tool("cases.get", { id: curCase.id }).then(function (j) {
        w.remove();
        if (!j.ok) { api.add("a", "Казусът не се зареди (" + esc(j.error || "") + "). Продължаваме в общ разговор."); setCase(null); renderCaseBar(); return; }
        var k = j.result.kase || {}; if (k.title) { curCase.title = k.title; setCase(curCase); renderCaseBar(); }
        api.add("a", "📁 Казус <b>" + esc(k.title || curCase.title) + "</b>" + (k.client ? " · " + esc(k.client) : "") + (k.summary ? "\n<b>Резюме:</b> " + esc(String(k.summary).slice(0, 700)) : "") + "\nВсичко тук се помни без ограничение. Продължете откъдето сте спрели.");
        (j.result.messages || []).slice(-20).forEach(function (m) { api.add(m.role === "user" ? "u" : "a", fmt(m.text)); });
        list.scrollTop = list.scrollHeight;
      });
      return;
    }
    if (s && s.intro0) { s.intro0(api); return; }
    if (hist.length) hist.forEach(function (m) { api.add(m.role === "user" ? "u" : "a", fmt(m.text)); });
    else api.add("a", "Здравейте! Аз съм <b>Тед Асистент</b> на Имоти Надежда.\nПитайте ме за клиенти, имоти, огледи, сделки, ипотека или комисионна – работя с реалните данни в CRM." +
      "\nНапример: „Намери тристайни в Шумен до 100 000 €“, „Добави клиент Мария, 0888…, търси двустаен под наем във Варна“, „Какво имам утре?“\nКажете „запомни …“ и ще го помня завинаги; от 📁 можете да отворите казус с безкрайна памет." +
      (staffCtx ? "\nВсичко е тук, в чата: <b>качване на имот</b> от папка (📎 или „качи имот“), <b>събиране на обяви</b> от собственици, <b>имейли</b> от вашата поща (ABV, Gmail…), и роли – юрист, секретар, старши брокер, анализатор, търговец. Избирам ролята сама или от „✨ Умения и роли“." : ""));
  }
  function renderCaseBar() {
    var b = foot && foot.querySelector(".nda-case-btn"); if (!b) return;
    b.innerHTML = "📁 " + (curCase ? "Казус: <b>" + esc(curCase.title) + "</b>" : "Общ разговор") + " ▾";
    b.classList.toggle("on", !!curCase);
  }
  function openCases(api) {
    var pop = foot.querySelector(".nda-case-pop"); if (!pop) return;
    if (!pop.hidden && pop._kind === "case") { pop.hidden = true; return; }
    pop._kind = "case"; pop.hidden = false; pop.innerHTML = '<div class="nda-case-h">Казуси – проекти с безкрайна памет</div><div class="nda-case-l">Зареждане…</div>';
    tool("cases.list", { status: "open" }).then(function (j) {
      var cs = j.ok ? (j.result.cases || []) : [];
      pop.querySelector(".nda-case-l").innerHTML =
        '<button type="button" class="nda-case-i' + (!curCase ? " on" : "") + '" data-case="">💬 Общ разговор<small>без казус, с дългосрочна памет</small></button>' +
        cs.map(function (c) { return '<button type="button" class="nda-case-i' + (curCase && curCase.id === c.id ? " on" : "") + '" data-case="' + esc(c.id) + '" data-title="' + esc(c.title) + '">📁 ' + esc(c.title) + "<small>" + esc((c.client ? c.client + " · " : "") + (c.updated_at ? String(c.updated_at).slice(0, 10) : "")) + "</small></button>"; }).join("") +
        (j.ok ? "" : '<div class="nda-case-err">' + esc(j.error || "Паметта не е налична") + "</div>") +
        '<button type="button" class="nda-case-i new" data-new="1">＋ Нов казус…<small>име и по желание клиент</small></button>';
    });
    pop.onclick = function (e) {
      var n = e.target.closest("[data-new]"), c = e.target.closest("[data-case]"); if (!n && !c) return;
      pop.hidden = true;
      if (n) {
        var title = prompt("Име на казуса (напр. „Сделка Иванови – апартамент Тракия“ или „Спор за наем – Петров“):"); if (!title || !title.trim()) return;
        var client = prompt("Клиент по казуса (име от CRM) – по желание:") || "";
        var w = api.add("a", "Създавам казус…", "wait");
        tool("cases.create", { title: title.trim(), client_name: client.trim() || undefined }).then(function (j) { w.remove(); if (!j.ok) { api.add("a", "Казусът не се създаде: " + esc(j.error || "")); return; } setCase({ id: j.result.id, title: j.result.title }); renderCaseBar(); list.innerHTML = ""; caseIntro(api, skill); });
        return;
      }
      var id = c.getAttribute("data-case");
      setCase(id ? { id: id, title: c.getAttribute("data-title") } : null); renderCaseBar(); list.innerHTML = ""; caseIntro(api, skill);
    };
  }
  /* преглед на подготвения имейл: получател, тема, текст, PDF файлове и бутони „Да, изпрати“ / „Промени“ */
  function emailCard(w, e, onYes, onEdit) {
    var c = document.createElement("div"); c.className = "nda-mc";
    c.innerHTML = '<dl><dt>До</dt><dd>' + esc((e.to && e.to.name ? e.to.name + " " : "") + "<" + (e.to && e.to.email || "") + ">") + "</dd><dt>Тема</dt><dd>" + esc(e.subject || "") + "</dd>" + (e.property && e.property.code ? "<dt>Имот</dt><dd>" + esc(e.property.code + (e.property.title ? " – " + e.property.title : "")) + "</dd>" : "") + "</dl>" +
      "<pre>" + esc(e.body || "") + "</pre>" +
      ((e.attachments || []).length ? '<div class="fl">' + e.attachments.map(function (a) { return a.download_url ? '<a class="nda-dl" href="' + esc(a.download_url) + '" target="_blank" rel="noopener">📄 ' + esc(a.name) + (a.pages ? " · " + a.pages + " стр." : "") + " · " + (a.size_kb >= 1024 ? (a.size_kb / 1024).toFixed(1) + " MB" : a.size_kb + " KB") + "</a>" : "<span>📄 " + esc(a.name) + "</span>"; }).join("") + "</div>" : "") +
      '<div class="snd-from">' + (e.can_send ? "Изпраща се от <b>" + esc(e.from || "") + "</b>" + (e.sender === "agency" && e.reply_to ? " · отговорите идват на " + esc(e.reply_to) : "") : "Няма поща за изпращане – попълнете я веднъж по-долу.") + "</div>" +
      '<div class="row"><button type="button" class="pri" data-y' + (e.can_send ? "" : " disabled") + '>✅ Да, изпрати</button><button type="button" data-e>✏️ Промени</button></div>';
    c.querySelector("[data-y]").onclick = function () { [].forEach.call(c.querySelectorAll("button"), function (b) { b.disabled = true; }); onYes(); };
    c.querySelector("[data-e]").onclick = function () { onEdit(); };
    var sb = w.querySelector(".nda-say"); w.insertBefore(c, sb || null);
  }
  var chatSkill = {
    id: "chat", name: "Чат с Тед Асистент", sub: "Клиенти, имоти, календар, сделки, изчисления",
    intro: function (api) { caseIntro(api, this); },
    footer: function () {
      return '<div class="nda-case"><button type="button" class="nda-case-btn" aria-haspopup="listbox"></button><button type="button" class="nda-case-btn role" aria-haspopup="listbox" hidden></button><div class="nda-case-pop" hidden></div></div><div class="nda-files"></div><div class="nda-c"><button type="button" class="att" aria-label="Прикачи снимка или PDF">' + I.clip + '</button><textarea rows="1" placeholder="Съобщение…" aria-label="Съобщение до Тед Асистент"></textarea><button type="button" class="mic" aria-label="Гласово съобщение">' + I.mic + '</button><button type="button" class="snd" aria-label="Изпрати">' + I.send + "</button></div>";
    },
    bind: function (api, el) {
      var ta = el.querySelector("textarea"), files = [], fl = el.querySelector(".nda-files"), busy = false, me = this;
      if (!staffCtx) el.querySelector(".nda-case").hidden = true;
      renderCaseBar(); el.querySelector(".nda-case-btn").onclick = function (e) { e.stopPropagation(); openCases(api); };
      var rb = el.querySelector(".nda-case-btn.role"); rb.hidden = !staffCtx; renderRoleBtn(); rb.onclick = function (e) { e.stopPropagation(); openSkills(api); };
      if (me.placeholder) ta.placeholder = me.placeholder;
      function showFiles() { fl.innerHTML = files.map(function (f) { return "<span>" + esc(f.name) + "</span>"; }).join(""); }
      function go(voice) {
        var text = ta.value.trim(); if ((!text && !files.length && !voice) || busy) return;
        busy = true; ta.value = ""; ta.style.height = ""; var fs = files; files = []; showFiles();
        var ub = api.add("u", voice ? "🎤 Гласово съобщение (" + voice.dur + ")" : fmt(text || "Прикачени файлове") + (fs.length ? "\n📎 " + fs.map(function (f) { return esc(f.name); }).join(", ") : ""));
        var w = api.add("a", voice ? "Слушам" : "Мисля", "wait");
        var anyF = isN8n();
        Promise.all(fs.map(function (f) { return fileData(f, anyF); })).then(function (fd) {
          var cur = { role: "user", text: voice ? "(гласово съобщение)" : (text || "Анализирай прикачените файлове."), files: fd.filter(Boolean).concat(voice ? [{ mime: voice.mime, data: voice.data }] : []) };
          /* в казус историята идва от паметта на сървъра – пращаме само текущото съобщение */
          var send = (curCase ? [] : hist.slice(-14).map(function (m) { return { role: m.role, text: m.text }; })).concat([cur]);
          return ask(send, { mode: curMode || me.mode || "", case_id: curCase ? curCase.id : "" }).then(function (j) {
            w.classList.remove("wait"); busy = false;
            if (!j.ok) { w.innerHTML = esc(j.error || "Грешка"); return; }
            var rl = !curMode && j.mode && MODE_BY[j.mode] ? MODE_BY[j.mode][4] + " " + MODE_BY[j.mode][1].split(" – ")[0] : "";
            w.innerHTML = fmt(j.text) + (prefs.showActions && ((j.actions && j.actions.length) || rl) ? '<span class="acts">' + (rl ? esc(rl) + (j.actions && j.actions.length ? " · " : "") : "") + (j.actions && j.actions.length ? "✔ " + esc(j.actions.join(" · ")) : "") + "</span>" : "") + (j.fallback ? '<div class="nda-fb">' + esc(j.fallback) + "</div>" : ""); speaker(w);
            if (voice && j.transcript) { ub.innerHTML = "🎤 „" + esc(j.transcript) + "“"; cur.text = j.transcript; }
            if ((!voice || j.transcript) && !curCase) { hist.push({ role: "user", text: cur.text }, { role: "assistant", text: j.text }); save(); }
            if ((voice && prefs.autoSpeak !== "never") || prefs.autoSpeak === "always") { var sb = w.querySelector(".nda-say"); if (sb) sb.click(); } /* гласов въпрос → гласов отговор (според настройката) */
            if (j.actions && j.actions.some(function (a) { return !/search|list|get|calc|rates|summary|match|✗/.test(a); })) try { window.dispatchEvent(new CustomEvent("nd-data-changed")); } catch (e) {}
            if (j.video && window.NDVideo) try { window.NDVideo.fromChat(j.video, fs); } catch (e) {} /* „направи видео на обява #…“ → умението „AI Видео на имот“ */
            if (j.email) { emailCard(w, j.email, function () { ta.value = "Да"; go(); }, function () { ta.value = "Промени имейла: "; ta.focus(); }); list.scrollTop = list.scrollHeight; }
            if (j.ui && j.ui.panel && !j.video) openUi(j.ui.panel); /* вградените умения се отварят тук, в чата */
          });
        });
      }
      el.querySelector(".snd").onclick = function () { if (prefs.autoSpeak === "always") unlockAudio(); go(); };
      /* ---- voice message: tap the microphone, speak, tap again to send ---- */
      var mic = el.querySelector(".mic"), rec = null, chunks = [], t0 = 0, tick = null, stream = null;
      function mm() { var c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"]; for (var i = 0; i < c.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i]; return ""; }
      function dur() { var s = Math.round((Date.now() - t0) / 1000); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
      function endRec() { clearInterval(tick); mic.classList.remove("rec"); mic.innerHTML = I.mic; ta.classList.remove("rec"); ta.readOnly = false; ta.value = ""; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      mic.onclick = function () {
        if (busy) return;
        if (rec && rec.state === "recording") { if (prefs.autoSpeak !== "never") unlockAudio(); rec.stop(); return; }
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
      ta.onkeydown = function (e) { if (e.key === "Enter" && !e.shiftKey && prefs.enterSend) { e.preventDefault(); go(); } };
      ta.oninput = function () { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; };
      function pickChat() {
        var n8 = isN8n(); /* агентът в n8n: до 6 файла, и Word/Excel/аудио */
        var i = document.createElement("input"); i.type = "file"; i.multiple = true; i.accept = n8 ? "image/*,application/pdf,audio/*,.doc,.docx,.xls,.xlsx,.csv,.txt,.odt,.ods,.rtf" : "image/*,application/pdf"; i.style.cssText = "position:fixed;left:-999px;opacity:0"; document.body.appendChild(i);
        i.onchange = function () { files = files.concat([].slice.call(i.files || [])).slice(0, n8 ? N8N_MAX_FILES : 3); i.remove(); showFiles(); }; i.click();
      }
      el.querySelector(".att").onclick = function (e) {
        var up = embedded.filter(function (x) { return x.id === "upload"; })[0];
        if (!staffCtx || !up || !up.pick) return pickChat();
        e.stopPropagation();
        var pop = el.querySelector(".nda-case-pop"); if (!pop) return pickChat();
        if (!pop.hidden && pop._kind === "att") { pop.hidden = true; return; }
        pop._kind = "att"; pop.hidden = false;
        pop.innerHTML = '<div class="nda-case-h">Прикачи</div>' +
          '<button type="button" class="nda-case-i" data-at="chat">📎 Снимка или PDF към Тед<small>въпрос по документ, снимка, договор</small></button>' +
          '<div class="nda-case-g">АИ Качване на имот → „Нов имот“</div>' +
          '<button type="button" class="nda-case-i" data-at="folder">📁 Папка на имота<small>снимки, видеа и опис – цената от името на папката</small></button>' +
          '<button type="button" class="nda-case-i" data-at="files">🖼️ Снимки и опис<small>или .zip на папката (iPhone)</small></button>' +
          '<button type="button" class="nda-case-i" data-at="camera">📸 Снимай имота</button>';
        pop.onclick = function (ev) { var t = ev.target.closest("[data-at]"); if (!t) return; pop.hidden = true; var k = t.getAttribute("data-at"); if (k === "chat") pickChat(); else up.pick(api, k); };
      };
    }
  };
  skills.push(chatSkill);
  /* „n8n Agent“: самият агент от n8n (същият разговорен прозорец; отговаря агентът в n8n). Иначе името остава „Тед“. */
  var n8nSkill = Object.create(chatSkill);
  n8nSkill.id = "n8n"; n8nSkill.name = "Чат с n8n Agent"; n8nSkill.sub = "Самият агент от n8n – реалните данни в CRM"; n8nSkill.placeholder = "Пишете на n8n Agent…"; n8nSkill.crmOnly = true; /* само в CRM (за служители), не и в публичния сайт */
  n8nSkill.intro0 = function (api) {
    if (hist.length) hist.forEach(function (m) { api.add(m.role === "user" ? "u" : "a", fmt(m.text)); });
    else api.add("a", "Здравейте! Аз съм <b>n8n Agent</b> – агентът на Имоти Надежда в n8n.\nРаботя с реалните данни в CRM: клиенти, имоти, огледи, публикуване във Facebook, запис на клиент от Чат.\nПриемам текст, снимки, PDF и други файлове (📎) и гласови съобщения (🎤).");
  };
  skills.push(n8nSkill);
  /* експертните роли са вградени в „Чат с Тед“ (бутон „Роля“ до казуса); без избор Тед разпознава ролята от въпроса (api/_ted-modes.js) */
  var MODES = [
    ["lawyer", "Юрист – правен помощник", "Казуси, договори, рискове, документи", "⚖️ <b>Юрист</b>. Опишете казуса (факти, хора, имот, документи, срокове) – ще дам правна квалификация, рисковете, вариантите и готови проекти на документи. Работя по българското право и помня казуса, ако го отворите от 📁.", "⚖️"],
    ["secretary", "Секретар – договори и кризи", "Документи, писма, графици, трудни ситуации", "🗂️ <b>Секретар</b>. Кажете какво трябва: договор, писмо, протокол, среща – или опишете лошата ситуация и ще дам какво да кажете сега, какво да не казвате и следващите 3 стъпки, с готов текст за изпращане.", "🗂️"],
    ["senior", "Старши брокер (25+ г.)", "Оценки, сделки, банки, нотариус, ДДС, данъци", "🏛️ <b>Старши брокер</b> с 25+ години практика. Питайте за оценка на имот, стратегия за продажба, сделката стъпка по стъпка, нотариус и такси, ипотека, фактури и ДДС, данъци – ще получите конкретни числа и „какво бих направил аз“.", "🏛️"],
    ["analyst", "Анализатор", "Пазар, доходност, отчети на агенцията", "📊 <b>Анализатор</b>. Пазарен анализ по квартал, сравнение на имоти, доходност и сценарии, отчети от CRM (фуния, конверсии, комисионни) – с таблици, извод най-отгоре и източници. Мога да ги направя и в PDF.", "📊"],
    ["sales", "Търговец – умни предложения", "Подбор, аргументи, възражения, следваща стъпка", "🤝 <b>Търговец</b>. Кажете за кого става дума (клиент от CRM) и какво търси – ще подбера имотите, ще обясня защо пасват на него, ще подготвя съобщение и ще предложа оглед с дата и час.", "🤝"],
    ["opener", "Започни разговор", "Първи контакт и поддържане на връзка", "👋 <b>Започни разговор</b>. Кажете с кого и защо (име от CRM, собственик, стар клиент) – ще подготвя 3 варианта за първо съобщение, сценарий за обаждане и какво да кажете при „не сега“.", "👋"],
    ["inquiry", "Отговори на запитване", "Готов отговор на клиентско запитване", "📨 <b>Отговор на запитване</b>. Поставете текста на запитването (или кажете за кой клиент/имот е) – ще проверя данните в CRM и ще дам готов отговор с факти, 1–2 подходящи предложения и покана за оглед.", "📨"]
  ];
  var MODE_BY = {}; MODES.forEach(function (m) { MODE_BY[m[0]] = m; });
  staffCtx = /\/mobile\/crm\//.test(location.pathname) || (function () { try { return !!localStorage.getItem(SB_KEY_STORE); } catch (e) { return false; } })();
  var MODE_KEY = "nd-ted-mode", curMode = ""; try { curMode = sessionStorage.getItem(MODE_KEY) || ""; if (!MODE_BY[curMode]) curMode = ""; } catch (e) {}
  function setMode(id) { curMode = MODE_BY[id] ? id : ""; try { if (curMode) sessionStorage.setItem(MODE_KEY, curMode); else sessionStorage.removeItem(MODE_KEY); } catch (e) {} renderRoleBtn(); }
  function renderRoleBtn() { var b = foot && foot.querySelector(".nda-case-btn.role"); if (!b) return; var m = MODE_BY[curMode]; b.innerHTML = (m ? m[4] + " <b>" + esc(m[1].split(" – ")[0]) + "</b>" : "✨ Умения и роли") + " ▾"; b.classList.toggle("on", !!m); }
  /* вградени умения (АИ Качване на имот, Събиране на имоти и клиенти): регистрират се с addSkill({embed:true}) и се отварят вътре в чата */
  var embedded = [];
  function openPanel(s) {
    if (!s) return;
    if (skill !== chatSkill && skill !== n8nSkill) setSkill(chatSkill); /* в n8n чата панелите се отварят на място */
    if (s.open) try { s.open(api); } catch (e) {}
    s.intro(api);
    if (s.footer) { var f = document.createElement("div"); f.className = "nda-emb"; f.innerHTML = s.footer(); list.appendChild(f); if (s.bind) s.bind(api, f); }
    list.scrollTop = list.scrollHeight;
  }
  function openUi(name) {
    if (name === "mail") return mailPanel();
    if (name === "video") { if (window.NDAsh && NDAsh.use) NDAsh.use("video"); return; }
    openPanel(embedded.filter(function (x) { return x.id === name; })[0]);
  }
  function openSkills(api) {
    var pop = foot.querySelector(".nda-case-pop"); if (!pop) return;
    if (!pop.hidden && pop._kind === "skills") { pop.hidden = true; return; }
    pop._kind = "skills"; pop.hidden = false;
    pop.innerHTML = (embedded.length ? '<div class="nda-case-h">Вградени умения</div>' + embedded.map(function (x) { return '<button type="button" class="nda-case-i" data-emb="' + esc(x.id) + '">' + (x.icon || "✨") + " " + esc(x.name) + "<small>" + esc(x.sub || "") + "</small></button>"; }).join("") : "") +
      '<button type="button" class="nda-case-i" data-emb="mail">✉️ Моята поща за изпращане<small>ABV, Gmail, Mail.bg… – Тед праща имейлите от вашата поща</small></button>' +
      '<div class="nda-case-g">Роля на Тед</div>' +
      '<button type="button" class="nda-case-i' + (!curMode ? " on" : "") + '" data-role="">✨ Автоматично<small>Тед избира сам: юрист, секретар, брокер, анализатор…</small></button>' +
      MODES.map(function (m) { return '<button type="button" class="nda-case-i' + (curMode === m[0] ? " on" : "") + '" data-role="' + m[0] + '">' + m[4] + " " + esc(m[1]) + "<small>" + esc(m[2]) + "</small></button>"; }).join("");
    pop.onclick = function (e) {
      var em = e.target.closest("[data-emb]"), ro = e.target.closest("[data-role]"); if (!em && !ro) return;
      pop.hidden = true;
      if (em) { openUi(em.getAttribute("data-emb")); return; }
      var id = ro.getAttribute("data-role"); setMode(id);
      if (id && MODE_BY[id]) api.add("a", MODE_BY[id][3] + "\n<small>Ролята остава, докато не изберете „Автоматично“.</small>"); else api.add("a", "✨ Автоматично – избирам ролята според въпроса.");
    };
  }
  /* „Моята поща за изпращане“ направо в чата: паролата отива само към /api/email (сървър → nd_secrets), никога не се връща в браузъра */
  var MAILP = [["domain", "Поща на домейна (@imotinadezhda.bg)"], ["abv", "ABV.bg"], ["gmail", "Gmail"], ["mailbg", "Mail.bg"], ["outlook", "Outlook / Hotmail"], ["yahoo", "Yahoo"], ["icloud", "iCloud"], ["custom", "Друг (ръчно)"]];
  var MAILHINT = { domain: "Препоръчано – стига до всички пощи (ABV, Gmail, Outlook, Yahoo…). Еднократно и безплатно: resend.com → регистрация → Domains → Add domain „imotinadezhda.bg“ (регион Ireland) → добавете показаните DNS записи в SuperHosting → Verify → API Keys → Create API key → поставете ключа (re_…) тук. Адрес: office@imotinadezhda.bg или ime@imotinadezhda.bg.", abv: "Внимание: ABV често отказва изпращане от сървъри. Ако „Тест“ върне отказ – изберете Gmail; писмата пак стигат до ABV адреси.", gmail: "Препоръчано. Нужна е „Парола за приложение“ (16 знака): myaccount.google.com → Сигурност → Потвърждаване в 2 стъпки (включете) → Пароли за приложения → създайте → поставете я тук.", mailbg: "Паролата на пощата в Mail.bg.", outlook: "Парола за приложение от Microsoft акаунта.", yahoo: "Парола за приложение (Account Security → App passwords).", icloud: "App-specific password от appleid.apple.com.", custom: "SMTP сървър, порт и парола от вашия доставчик." };
  function guessProv(e) { var d = String(e || "").split("@")[1] || ""; return /imotinadezhda\.bg$/i.test(d) ? "domain" : /abv\.bg$/i.test(d) ? "abv" : /gmail|googlemail/i.test(d) ? "gmail" : /(^|\.)mail\.bg$/i.test(d) ? "mailbg" : /outlook|hotmail|live\.|msn\./i.test(d) ? "outlook" : /yahoo/i.test(d) ? "yahoo" : /icloud|me\.com|mac\.com/i.test(d) ? "icloud" : ""; }
  function mailApi(body) { return token().then(function (t) { return fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(body) }); }).then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); }).catch(function (e) { return { ok: false, error: "Няма връзка" }; }); }
  function mailPanel() {
    if (skill !== chatSkill && skill !== n8nSkill) setSkill(chatSkill);
    var d = document.createElement("div"); d.className = "nda-pnl";
    d.innerHTML = '<h5>✉️ Моята поща за изпращане</h5><div class="st">Проверка…</div>' +
      '<label>Имейл адрес</label><input type="email" data-k="email" placeholder="ime@abv.bg" autocomplete="email">' +
      '<label>Доставчик</label><select data-k="prov">' + MAILP.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + "</option>"; }).join("") + "</select>" +
      '<label>Име на подателя</label><input type="text" data-k="name" placeholder="Име Фамилия">' +
      '<label data-k="passl">Парола (за приложения)</label><input type="password" data-k="pass" placeholder="••••••••" autocomplete="new-password">' +
      '<div data-k="custom" hidden><label>SMTP сървър</label><input type="text" data-k="host" placeholder="smtp.example.com"><label>Порт</label><input type="number" data-k="port" value="465"></div>' +
      '<label>Тестов имейл до (по избор)</label><input type="email" data-k="tto" placeholder="адрес за тестовото писмо – иначе до самата поща" autocomplete="off">' +
      '<label class="agw" data-k="agw" hidden><input type="checkbox" data-k="ag" style="width:20px;height:20px;accent-color:#7a0f22"> Обща поща на агенцията – за всички брокери без собствена поща</label>' +
      '<div class="hn" data-k="hint"></div><div class="row"><button type="button" data-m="test">Тест</button><button type="button" class="pri" data-m="save">Запази</button></div>';
    list.appendChild(d); list.scrollTop = list.scrollHeight;
    var q = function (k) { return d.querySelector('[data-k="' + k + '"]'); }, st = d.querySelector(".st");
    function refresh() { var dm = q("prov").value === "domain"; q("custom").hidden = q("prov").value !== "custom"; q("hint").textContent = MAILHINT[q("prov").value] || ""; q("passl").textContent = dm ? "API ключ от Resend" : "Парола (за приложения)"; q("pass").placeholder = dm ? "re_…" : "••••••••"; if (dm && !/@imotinadezhda\.bg$/i.test(q("email").value)) q("email").value = "office@imotinadezhda.bg"; }
    q("prov").onchange = refresh; q("email").oninput = function () { var g = guessProv(q("email").value); if (g) { q("prov").value = g; refresh(); } };
    q("prov").value = "abv"; refresh();
    try { if (window.ND && ND.broker && ND.broker.name) q("name").value = ND.broker.name; } catch (e) {}
    mailApi({ action: "get" }).then(function (r) {
      if (!r.ok) { st.innerHTML = '<span class="er">' + esc(r.error || "Грешка") + "</span>"; return; }
      if (r.admin) q("agw").hidden = false;

      if (r.settings) { st.innerHTML = "✅ Изпращате от <b>" + esc(r.settings.email) + "</b> (" + esc(r.settings.provider === "domain" ? "поща на домейна – до всички пощи" : r.settings.host || "") + "). Може да смените данните тук."; q("email").value = r.settings.email; q("prov").value = r.settings.provider || "custom"; if (r.settings.name) q("name").value = r.settings.name; if (r.settings.provider === "custom") { q("host").value = r.settings.host || ""; q("port").value = r.settings.port || 465; } refresh(); }
      else { st.innerHTML = r.agency ? "✅ Имейлите тръгват от общата поща на агенцията <b>" + esc(r.agency.email) + "</b> – отговорите идват на вашия имейл. Може да добавите и собствена поща." : "Няма настроена поща. Въведете адреса и паролата – имейлите ще тръгват <b>от вашата поща</b>."; if (r.account_email && !q("email").value) { q("email").value = r.account_email; var g = guessProv(r.account_email); if (g) { q("prov").value = g; refresh(); } } }
    });
    d.querySelector(".row").onclick = function (e) {
      var b = e.target.closest("[data-m]"); if (!b) return; var a = b.getAttribute("data-m");
      var body = { action: a === "save" ? "set" : "test", test_to: q("tto").value.trim() || undefined, scope: q("ag").checked ? "agency" : undefined, provider: q("prov").value, email: q("email").value.trim(), password: q("pass").value, name: q("name").value.trim(), host: q("host").value.trim(), port: Number(q("port").value) || 465 };
      [].forEach.call(d.querySelectorAll(".row button"), function (x) { x.disabled = true; }); st.textContent = "Свързване с пощата…";
      mailApi(body).then(function (r) {
        [].forEach.call(d.querySelectorAll(".row button"), function (x) { x.disabled = false; });
        if (!r.ok) { st.innerHTML = '<span class="er">' + esc(r.error || "Неуспешно") + "</span>"; return; }
        q("pass").value = "";
        st.innerHTML = r.warning ? "⚠️ Ключът е приет" + (a === "save" ? " и запазен" : "") + ". " + esc(r.warning) : a === "save" ? "✅ Запазено. Тед изпраща от <b>" + esc(r.settings.email) + "</b>. Напишете „изпрати“, за да тръгне имейлът." : "✅ Работи! Изпратих тестов имейл до <b>" + esc(r.sent_to || r.settings.email) + "</b> – проверете пощата. Натиснете „Запази“.";
      });
    };
  }
  var api = { add: function (r, h, c) { return add(r, h, c); }, esc: esc, list: function () { return list; } };
  function setSkill(s) {
    skill = s; win.querySelector(".nda-skill span").textContent = s.name; list.innerHTML = "";
    var tb = win.querySelector(".nda-t b"); if (tb) tb.textContent = s.id === "n8n" ? "n8n Agent" : "Тед Асистент";
    foot.innerHTML = s.footer ? s.footer() : ""; s.intro(api); if (s.bind) s.bind(api, foot);
  }
  function renderMenu() { var inCrm = /\/mobile\/crm\//.test(location.pathname); menu.innerHTML = skills.map(function (s, i) { if (s.crmOnly && !inCrm) return ""; return '<button type="button" role="option" data-i="' + i + '" class="' + (s === skill ? "on" : "") + '">' + esc(s.name) + "<small>" + esc(s.sub || "") + "</small></button>"; }).join(""); }
  function boot() {
    if (booted) return; booted = true;
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    fab = document.createElement("button"); fab.type = "button"; fab.className = "nda-fab"; fab.setAttribute("aria-label", "Тед Асистент"); fab.title = "Тед Асистент";
    fab.innerHTML = '<img src="' + BOT + '" alt="">';
    win = document.createElement("section"); win.className = "nda-win"; win.hidden = true; win.setAttribute("role", "dialog"); win.setAttribute("aria-label", "Тед Асистент");
    win.innerHTML = '<header class="nda-h"><span class="nda-av"><img src="' + BOT + '" alt=""></span><div class="nda-t"><b>Тед Асистент</b><button type="button" class="nda-skill" aria-haspopup="listbox" aria-expanded="false"><span></span>' + I.chev + "</button></div>" +
      '<button type="button" class="nda-gear" aria-label="Настройки на чата" title="Настройки"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
      '<button type="button" class="nda-x" aria-label="Затвори">' + I.x + '</button><div class="nda-menu" role="listbox" hidden></div></header><div class="nda-list" aria-live="polite"></div><div class="nda-foot"></div><div class="nda-set" hidden></div>';
    document.body.appendChild(fab); document.body.appendChild(win);
    list = win.querySelector(".nda-list"); menu = win.querySelector(".nda-menu"); foot = win.querySelector(".nda-foot");
    list.addEventListener("click", fileClick);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && win && !win.hidden) { var vw = win.querySelector(".nda-view"); if (vw) vw.remove(); } });
    var sk = win.querySelector(".nda-skill"), gear = win.querySelector(".nda-gear"), setBox = win.querySelector(".nda-set");
    sk.onclick = function (e) { e.stopPropagation(); renderMenu(); menu.hidden = !menu.hidden; sk.setAttribute("aria-expanded", String(!menu.hidden)); };
    menu.onclick = function (e) { var b = e.target.closest("[data-i]"); if (!b) return; menu.hidden = true; setSkill(skills[+b.getAttribute("data-i")]); };
    win.addEventListener("click", function (e) {
      if (!menu.hidden && !menu.contains(e.target) && !sk.contains(e.target)) menu.hidden = true;
      var pop = foot.querySelector(".nda-case-pop"); if (pop && !pop.hidden && !pop.contains(e.target) && !e.target.closest(".nda-case-btn,.att")) pop.hidden = true;
    });
    gear.onclick = function (e) { e.stopPropagation(); if (!setBox.hidden) { setBox.hidden = true; gear.classList.remove("on"); return; } loadModels().then(function () { renderSettings(); setBox.hidden = false; gear.classList.add("on"); }); };
    applyPrefs();
    fab.onclick = function () { win.hidden = false; fab.hidden = true; if (!skill) setSkill(skills[0]); if (skill.open) skill.open(api); inboxOpened(); };
    win.querySelector(".nda-x").onclick = function () { win.hidden = true; fab.hidden = false; };
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !win.hidden) { win.hidden = true; fab.hidden = false; } });
    if (/\/mobile\/crm\//.test(location.pathname)) { fab.style.bottom = "calc(96px + env(safe-area-inset-bottom,0px))"; fab.style.zIndex = "45";
      var sync = function () { fab.style.visibility = document.documentElement.classList.contains("locked") ? "hidden" : ""; };
      new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); sync(); }
    hideOnCrmRoute(); addEventListener("hashchange", hideOnCrmRoute);
    inboxStart();
  }
  /* the old desktop CRM (#/crm…) has its own assistant panel connected to the same API */
  function hideOnCrmRoute() { var crm = /^#\/crm/.test(location.hash || "") && !/\/mobile\/crm\//.test(location.pathname); fab.style.display = crm ? "none" : ""; if (crm) win.hidden = true; }

  window.NDAsh = {
    ask: ask, token: token, esc: esc, fmt: fmt,
    addSkill: function (s, first) { if (s && s.embed) { embedded.push(s); embedded.sort(function (a, b) { return (a.order || 9) - (b.order || 9); }); return; } if (typeof first === "number") skills.splice(Math.min(first, skills.length), 0, s); else if (first) skills.unshift(s); else skills.push(s); if (booted && !skill) setSkill(skills[0]); },
    open: function () { boot(); fab.click(); },
    use: function (id) { boot(); var s = skills.filter(function (x) { return x.id === id; })[0]; var em = !s && (embedded.filter(function (x) { return x.id === id; })[0] || id === "mail"); if (!s && !em) return false; win.hidden = false; fab.hidden = true; if (s) setSkill(s); else { if (!skill) setSkill(chatSkill); openUi(id); } inboxOpened(); return true; },
    panel: function (id) { return this.use(id); },
    hide: function () { if (win && !win.hidden) { win.hidden = true; fab.hidden = false; } },
    show: function () { if (win) { win.hidden = false; fab.hidden = true; list.scrollTop = list.scrollHeight; inboxOpened(); } },
    boot: boot
  };
  if (!window.NDAshNoWidget) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot(); }
})();
