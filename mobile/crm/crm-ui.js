/* Imoti Nadezhda CRM — shared form window (same look as the Компании form: wine title bar,
   photo strip, two-column cream glass fields, gold-glow buttons). Used for every card tab. */
(function () {
  "use strict";
  var SYM = "<symbol id=\"plus\" viewBox=\"0 0 24 24\"> <path d=\"M5 12h14\"/> <path d=\"M12 5v14\"/></symbol><symbol id=\"pencil\" viewBox=\"0 0 24 24\"> <path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"/> <path d=\"m15 5 4 4\"/></symbol><symbol id=\"camera\" viewBox=\"0 0 24 24\"> <path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\"/> <circle cx=\"12\" cy=\"13\" r=\"3\"/></symbol><symbol id=\"image\" viewBox=\"0 0 24 24\"> <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"/> <circle cx=\"9\" cy=\"9\" r=\"2\"/> <path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"/></symbol><symbol id=\"eye\" viewBox=\"0 0 24 24\"> <path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/> <circle cx=\"12\" cy=\"12\" r=\"3\"/></symbol><symbol id=\"archive\" viewBox=\"0 0 24 24\"> <rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\"/> <path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\"/> <path d=\"M10 12h4\"/></symbol><symbol id=\"circle-check\" viewBox=\"0 0 24 24\"> <circle cx=\"12\" cy=\"12\" r=\"10\"/> <path d=\"m9 12 2 2 4-4\"/></symbol><symbol id=\"ruler\" viewBox=\"0 0 24 24\"> <path d=\"M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z\"/> <path d=\"m14.5 12.5 2-2\"/> <path d=\"m11.5 9.5 2-2\"/> <path d=\"m8.5 6.5 2-2\"/> <path d=\"m17.5 15.5 2-2\"/></symbol><symbol id=\"bed-double\" viewBox=\"0 0 24 24\"> <path d=\"M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8\"/> <path d=\"M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4\"/> <path d=\"M12 4v6\"/> <path d=\"M2 18h20\"/></symbol><symbol id=\"bath\" viewBox=\"0 0 24 24\"> <path d=\"M10 4 8 6\"/> <path d=\"M17 19v2\"/> <path d=\"M2 12h20\"/> <path d=\"M7 19v2\"/> <path d=\"M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5\"/></symbol><symbol id=\"m2\" viewBox=\"0 0 24 24\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"15\" rx=\"2\"/><path d=\"M8 3v4M16 3v4\"/><text x=\"12\" y=\"17.2\" font-size=\"8.5\" text-anchor=\"middle\" fill=\"currentColor\" stroke=\"none\" font-family=\"Arial,sans-serif\" font-weight=\"700\">m\u00b2</text></symbol><symbol id=\"share-2\" viewBox=\"0 0 24 24\"> <circle cx=\"18\" cy=\"5\" r=\"3\"/> <circle cx=\"6\" cy=\"12\" r=\"3\"/> <circle cx=\"18\" cy=\"19\" r=\"3\"/> <line x1=\"8.59\" x2=\"15.42\" y1=\"13.51\" y2=\"17.49\"/> <line x1=\"15.41\" x2=\"8.59\" y1=\"6.51\" y2=\"10.49\"/></symbol><symbol id=\"map-pin-house\" viewBox=\"0 0 24 24\"> <path d=\"M15 22a1 1 0 0 1-1-1v-4a1 1 0 0 1 .445-.832l3-2a1 1 0 0 1 1.11 0l3 2A1 1 0 0 1 22 17v4a1 1 0 0 1-1 1z\"/> <path d=\"M18 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 .601.2\"/> <path d=\"M18 22v-3\"/> <circle cx=\"10\" cy=\"10\" r=\"3\"/></symbol><symbol id=\"upload\" viewBox=\"0 0 24 24\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><path d=\"M17 8l-5-5-5 5\"/><path d=\"M12 3v12\"/></symbol>";
  var CSS = [
    "#nd-fback{z-index:61}",
    "#nd-fwin{z-index:62;background:#f6dcc4}",
    "#nd-fwin .mscroll{background:linear-gradient(180deg,#fff7ef 0%,#fbe8d7 60%,#f6d8bf 100%)}",
    "html.desk #nd-fwin .mscroll{overflow-y:auto}",
    "#nd-fwin .fctl{top:12px;right:12px}",
    "html:not(.desk) #nd-fwin .fctl{top:calc(var(--fz,.37)*16px);right:calc(var(--fz,.37)*18px)}",
    "html:not(.desk) #nd-fwin .fctl .mbtn{width:calc(var(--fz,.37)*62px);height:calc(var(--fz,.37)*62px);font-size:calc(var(--fz,.37)*32px)}",
    "#nd-fwin .fcv{position:relative;width:1024px;padding:0 0 26px}",
    "#nd-fwin .f-bar{position:sticky;top:0;z-index:4;height:96px;display:flex;align-items:center;gap:30px;padding-left:40px;padding-right:170px;color:#fff3dc;background:linear-gradient(180deg,#9a1a33 0%,#74101f 45%,#4f0716 100%);border-bottom:2px solid #e9bd6f;box-shadow:inset 0 2px 3px rgba(255,170,180,.45),0 4px 10px rgba(60,5,15,.3)}",
    "#nd-fwin .f-bar svg.i{font-size:56px;color:#f3cf86;stroke-width:1.6;flex:0 0 auto}",
    "#nd-fwin .f-bar h2{font:700 44px/1.05 var(--serif);text-shadow:0 2px 3px rgba(30,0,8,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "#nd-fwin .f-photo{height:170px;margin:0;background-size:cover;background-position:center;-webkit-mask-image:linear-gradient(0deg,transparent 0,#000 45%);mask-image:linear-gradient(0deg,transparent 0,#000 45%)}",
    "#nd-fwin .f-body{display:grid;grid-template-columns:1fr 1fr;gap:4px 30px;padding:0 36px}",
    "#nd-fwin .f-body .ef.wide,#nd-fwin .f-body .wide{grid-column:1/-1}",
    "#nd-fwin .ef{margin-bottom:22px}",
    "#nd-fwin .el{display:flex;align-items:center;gap:22px;font:700 27px/1 var(--cond);color:#6b0a1c;margin-bottom:10px}",
    "#nd-fwin .el svg.i{font-size:38px;color:#7b1020;stroke-width:1.7;flex:0 0 auto}",
    "#nd-fwin .in{width:100%;box-sizing:border-box;height:56px;border:0;border-radius:16px;padding:0 18px;font:400 25px/1 var(--cond);color:#1f1111;background:linear-gradient(180deg,#fffdf9,#fcf2e8);box-shadow:0 0 0 1.5px rgba(222,184,150,.7),0 2px 4px rgba(140,70,40,.15),inset 0 1px 0 #fff;-webkit-appearance:none;appearance:none;outline:0}",
    "#nd-fwin .in:focus{box-shadow:0 0 0 2px #d9a95a,0 0 10px rgba(217,169,90,.55)}",
    "#nd-fwin .in.ta{height:140px;padding:14px 18px;resize:none;line-height:1.35;font-family:var(--cond)}",
    "#nd-fwin .in.bad{box-shadow:0 0 0 2.5px #c81a3a,0 0 10px rgba(200,26,58,.35)}",
    "#nd-fwin .selw{position:relative;display:block}",
    "#nd-fwin .selw svg.i{position:absolute;right:16px;top:50%;margin-top:-14px;font-size:28px;color:#5a0a12;stroke-width:2.4;pointer-events:none}",
    "#nd-fwin .selw .in{padding-right:52px;cursor:pointer}",
    "#nd-fwin .ev-err{min-height:34px;padding:0 36px;font:700 24px/1.3 var(--cond);color:#b0102e}",
    "#nd-fwin .ev-acts{display:flex;justify-content:center;flex-wrap:wrap;gap:26px;padding:6px 28px 0}",
    "#nd-fwin .ea{height:72px;min-width:220px;padding:0 34px;border:0;border-radius:36px;display:flex;align-items:center;justify-content:center;gap:16px;font:700 29px/1 var(--cond);color:#6b0a1c;cursor:pointer;background:linear-gradient(180deg,#fffcf9 0%,#fbefe5 100%);box-shadow:0 3px 7px rgba(140,70,40,.28),0 0 0 1px rgba(231,196,160,.6),0 0 12px rgba(255,230,200,.8),inset 0 1px 0 #fff}",
    "#nd-fwin .ea svg.i{font-size:36px;stroke-width:1.9}",
    "#nd-fwin .ea.hot{min-width:340px;color:#fff;font-weight:400;background:linear-gradient(180deg,#a3213a 0%,#7a0f22 42%,#55071a 100%);border:2px solid #edc47a;box-shadow:0 0 0 1px rgba(255,236,190,.5),0 0 16px rgba(255,190,120,.7),inset 0 2px 3px rgba(255,170,180,.5)}",
    "#nd-fwin .ea.del{min-width:0;color:#a30d26}",
    "#nd-fwin .ea[hidden]{display:none}",
    "#nd-fwin .ea:disabled{opacity:.6}",
    /* list blocks inside a tab (same glass rows as Последна активност) */
    "#nd-fwin .ndsec{grid-column:1/-1;margin:0 0 22px;border-radius:24px;overflow:hidden;background:linear-gradient(180deg,rgba(255,252,249,.97),rgba(252,240,231,.95));box-shadow:0 0 0 1px rgba(226,176,120,.55),0 0 14px rgba(255,226,190,.9),0 5px 12px rgba(120,50,20,.18)}",
    "#nd-fwin .ndsec>h3{display:flex;align-items:center;gap:20px;height:64px;margin:0;padding:0 70px 0 30px;color:#fff3dc;font:700 31px/1 var(--serif);background:linear-gradient(100deg,#55071a 0%,#8d1530 45%,#b42446 70%,#7a1022 100%);box-shadow:inset 0 2px 3px rgba(255,170,180,.45),0 3px 0 #e6b866;clip-path:polygon(0 0,100% 0,92% 100%,0 100%);width:fit-content;min-width:52%;border-radius:24px 0 60px 0}",
    "#nd-fwin .ndsec>h3 svg.i{font-size:36px;color:#f3cf86}",
    "#nd-fwin .ndrow{display:flex;align-items:center;gap:24px;min-height:74px;padding:10px 26px;border-top:1px solid rgba(226,176,120,.35);font:400 25px/1.2 var(--cond);color:#1f1111}",
    "#nd-fwin .ndrow:first-of-type{border-top:0}",
    "#nd-fwin .ndrow>svg.i{font-size:38px;color:#7b1020;stroke-width:1.8;flex:0 0 auto}",
    "#nd-fwin .ndrow .tx{flex:1;min-width:0}",
    "#nd-fwin .ndrow .tx b{display:block;font:700 26px/1.15 var(--cond);color:#5e0a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "#nd-fwin .ndrow .tx span{display:block;color:#5b4038;font-size:23px;margin-top:4px}",
    "#nd-fwin .ndrow .tm{white-space:nowrap;color:#5b4038;font-size:22px}",
    "#nd-fwin .ndrow button,#nd-fwin .ndrow a.rb{flex:0 0 auto;width:56px;height:56px;border:0;border-radius:50%;display:grid;place-items:center;font-size:28px;color:#6b0a1c;cursor:pointer;text-decoration:none;background:linear-gradient(180deg,#fffcf9,#fbefe5);box-shadow:0 2px 5px rgba(140,70,40,.25),0 0 0 1px rgba(231,196,160,.6)}",
    "#nd-fwin .ndrow button.rm{color:#a30d26}",
    "#nd-fwin .ndempty{padding:26px 30px;font:400 24px/1.35 var(--cond);color:#6b4a40}",
    "#nd-fwin .ndres div{transition:transform .25s ease,box-shadow .25s ease}",
    "#nd-fwin .ndres div:hover{transform:translateY(-2px);box-shadow:0 0 0 1px rgba(237,196,122,.9),0 0 20px rgba(255,214,160,.95),0 8px 16px rgba(120,50,20,.16)}",
    "#nd-fwin .ndres div.big{position:relative;overflow:hidden}",
    "#nd-fwin .ndres div.big::after{content:\"\";position:absolute;top:0;bottom:0;left:-60%;width:45%;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,236,200,.28),rgba(255,255,255,0));transform:skewX(-18deg);animation:ndShine 4.5s ease-in-out infinite;pointer-events:none}",
    "@keyframes ndShine{0%,55%{left:-60%}100%{left:130%}}",
    "#nd-fwin .cm-pay{transition:transform .25s ease,box-shadow .25s ease}",
    "#nd-fwin .cm-pay:hover{transform:translateY(-2px);box-shadow:0 0 0 1.5px rgba(237,196,122,.95),0 0 18px rgba(255,214,160,.95),0 6px 12px rgba(120,50,20,.15)}",
    "#nd-fwin .cm-chk{transition:background .25s ease,box-shadow .25s ease,transform .2s ease}",
    "#nd-fwin .cm-chk:active{transform:scale(.92)}",
    "#nd-fwin .cm-vat{transition:box-shadow .25s ease,transform .2s ease}",
    "#nd-fwin .cm-vat:hover{box-shadow:0 0 0 2px #f5d58f,0 0 24px rgba(255,196,130,.85),inset 0 1px 0 rgba(255,255,255,.3)}",
    "@media (prefers-reduced-motion:reduce){#nd-fwin .ndres div.big::after{animation:none;display:none}}",
    "#nd-fwin .cm-vatw{position:relative;display:flex;align-items:center;gap:16px;flex-wrap:wrap}",
    "#nd-fwin .cm-vat{display:inline-flex;align-items:center;gap:14px;height:78px;padding:0 28px;border:0;border-radius:40px;cursor:pointer;font:700 27px/1 var(--cond);color:#fbefe4;background:linear-gradient(180deg,#a3213a,#55071a);box-shadow:0 0 0 2px #edc47a,0 0 16px rgba(255,190,120,.6),inset 0 1px 0 rgba(255,255,255,.25);white-space:nowrap}",
    "#nd-fwin .cm-vat .i{width:30px;height:30px;stroke:#f5d58f}",
    "#nd-fwin .cm-menu{position:absolute;left:0;top:90px;z-index:5;display:flex;flex-direction:column;min-width:280px;padding:10px;border-radius:26px;background:linear-gradient(180deg,rgba(255,252,248,.98),rgba(251,238,227,.97));box-shadow:0 0 0 1.5px rgba(227,178,94,.7),0 0 18px rgba(255,226,190,.95),0 10px 24px rgba(80,20,10,.25)}",
    "#nd-fwin .cm-menu[hidden]{display:none}",
    "#nd-fwin .cm-menu button{height:66px;padding:0 22px;border:0;border-radius:18px;background:none;text-align:left;cursor:pointer;font:700 27px/1 var(--cond);color:#5a0a18}",
    "#nd-fwin .cm-menu button:hover{background:linear-gradient(90deg,rgba(237,196,122,.35),rgba(255,255,255,0))}",
    "#nd-fwin .cm-pays{grid-column:1/-1;display:grid;gap:14px;margin:0 0 22px}",
    "#nd-fwin .cm-pay{display:flex;align-items:center;gap:20px;padding:14px 20px;border-radius:24px;background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1.5px rgba(227,178,94,.55),0 0 10px rgba(255,226,190,.8),0 3px 6px rgba(120,50,20,.12)}",
    "#nd-fwin .cm-chk{flex:none;position:relative;width:62px;height:62px;border-radius:50%;border:0;cursor:pointer;background:#fffaf4;box-shadow:inset 0 0 0 3px rgba(163,33,58,.55),0 0 10px rgba(255,226,190,.9)}",
    "#nd-fwin .cm-chk.half{background:linear-gradient(90deg,#a3213a 50%,#fffaf4 50%);box-shadow:inset 0 0 0 3px #a3213a,0 0 0 2px #edc47a,0 0 12px rgba(255,190,120,.6)}",
    "#nd-fwin .cm-chk.on{background:linear-gradient(180deg,#a3213a,#55071a);box-shadow:0 0 0 2px #edc47a,0 0 14px rgba(255,190,120,.7)}",
    "#nd-fwin .cm-chk.on::after{content:\"\";position:absolute;left:21px;top:13px;width:14px;height:26px;border:solid #fbefe4;border-width:0 5px 5px 0;transform:rotate(45deg)}",
    "#nd-fwin .cm-pt{flex:1;min-width:0}",
    "#nd-fwin .cm-pt b{display:block;font:700 27px/1.1 var(--cond);color:#5a0a18}",
    "#nd-fwin .cm-pt span{display:block;margin-top:6px;font:700 30px/1.1 var(--serif);color:#4e0912}",
    "#nd-fwin .cm-in{flex:0 0 240px}",
    "#nd-fwin .cm-in small{display:block;margin:0 0 6px 6px;font:700 21px/1 var(--cond);color:#6b0a1c}",
    "#nd-fwin .cm-in .in{width:100%}",
    "#nd-fwin .ndres{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:0 0 22px}",
    "#nd-fwin .ndres div{border-radius:22px;padding:18px 22px;background:linear-gradient(180deg,#fffbf7,#fbeee3);box-shadow:0 0 0 1px rgba(226,176,120,.55),0 0 12px rgba(255,226,190,.9)}",
    "#nd-fwin .ndres div span{display:block;font:700 24px/1 var(--cond);color:#6b0a1c}",
    "#nd-fwin .ndres div b{display:block;margin-top:10px;font:700 38px/1 var(--serif);color:#4e0912}",
    "#nd-fwin .ndres div.big{grid-column:1/-1;background:linear-gradient(180deg,#a3213a,#55071a);box-shadow:0 0 0 2px #edc47a,0 0 16px rgba(255,190,120,.6)}",
    "#nd-fwin .ndres div.big span,#nd-fwin .ndres div.big b{color:#fff3dc}",
    "#nd-fwin .ndfile{display:flex;align-items:center;justify-content:center;gap:18px;height:96px;border-radius:22px;font:700 27px/1 var(--cond);color:#6b0a1c;cursor:pointer;background:linear-gradient(180deg,#fffdf9,#fcf2e8);box-shadow:0 0 0 2px rgba(222,184,150,.8),0 0 12px rgba(255,226,190,.9);border:2px dashed rgba(180,120,70,.55)}",
    "#nd-fwin .ndfile svg.i{font-size:40px;color:#7b1020}",
    "#nd-fwin .ndfile input{position:absolute;width:1px;height:1px;opacity:0}",
    "#nd-fwin .ndphotos{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:0 0 22px}",
    "#nd-fwin .ndphotos .ph{position:relative;aspect-ratio:4/3;border-radius:18px;background:#f3e1d1 center/cover;box-shadow:0 0 0 1px rgba(226,176,120,.6),0 0 10px rgba(255,226,190,.8)}",
    "#nd-fwin .ndphotos .ph button{position:absolute;right:8px;top:8px;width:44px;height:44px;border:0;border-radius:50%;font-size:24px;display:grid;place-items:center;color:#a30d26;background:rgba(255,250,246,.92);box-shadow:0 2px 5px rgba(0,0,0,.3)}",
    "#nd-fwin .ndphotos .ph.cover{box-shadow:0 0 0 3px #e3b25e,0 0 14px rgba(227,178,94,.8)}",
    "#nd-fwin .ndphotos .ph{touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;transition:transform .2s,box-shadow .2s,opacity .2s}",
    "#nd-fwin .ndphotos .ph.drag{opacity:.35;transform:scale(.96)}",
    "#nd-fwin .ndphotos .ph.new::before{content:'нова';position:absolute;left:10px;bottom:8px;padding:4px 10px;border-radius:12px;font:700 15px/1 var(--cond);color:#fff3dc;background:linear-gradient(180deg,#a3213a,#55071a);box-shadow:0 0 0 1px #edc47a}",
    "#nd-fwin .ndphotos .ph-main,#nd-fwin .ndphotos .ph-n{position:absolute;left:8px;top:8px;padding:5px 11px;border-radius:14px;font:700 17px/1 var(--cond);color:#6b0a1c;background:linear-gradient(180deg,#ffe9a3,#f3c65c);box-shadow:0 0 0 1.5px #fff1b8,0 0 10px rgba(255,200,90,.7)}",
    "#nd-fwin .ndphotos .ph-n{color:#fff3dc;background:rgba(80,10,20,.72);box-shadow:0 0 0 1px rgba(237,196,122,.7)}",
    ".ph.ghost{position:fixed;z-index:9999;pointer-events:none;border-radius:18px;background:#f3e1d1 center/cover;box-shadow:0 0 0 3px #e3b25e,0 14px 28px rgba(30,0,8,.45);transform:rotate(-2deg) scale(1.04);opacity:.95}",
    /* small '+ Нов' pill used on list pages (same glass button look) */
    ".nd-new{position:absolute;right:22px;top:12px;z-index:3;height:46px;padding:0 22px;border:1.5px solid #e3b25e;border-radius:23px;display:flex;align-items:center;gap:10px;font:700 22px/1 var(--cond);color:#fff3dc;cursor:pointer;background:linear-gradient(180deg,#a3213a 0%,#7a0f22 42%,#55071a 100%);box-shadow:0 0 0 1px rgba(255,236,190,.5),0 0 14px rgba(255,190,120,.7),inset 0 2px 3px rgba(255,170,180,.5)}",
    ".nd-new svg.i{font-size:26px;stroke-width:2.4}",
    /* ---- section cards like the broker card: wine ribbon header + blended photo + inline fields ---- */
    "#nd-fwin,#nd-fwin *,.nd-auth,.nd-auth *{-webkit-text-size-adjust:100%;text-size-adjust:100%}",
    "#nd-fwin .ndg{grid-column:1/-1;position:relative;margin:0 0 22px;border-radius:28px;overflow:hidden;padding:76px 0 20px;min-height:170px;background:linear-gradient(180deg,rgba(255,250,244,.97),rgba(252,238,226,.96));border:1.5px solid rgba(255,255,255,.95);box-shadow:0 0 0 1px rgba(226,176,120,.45),0 0 18px rgba(255,230,204,.95),0 8px 18px rgba(120,50,20,.18),inset 0 1px 0 #fff}",
    "#nd-fwin .ndg-h,#nd-fwin .ndsec>h3{position:absolute;left:-1px;top:-1px;height:60px;display:flex;align-items:center;gap:20px;margin:0;padding:0 70px 0 32px;color:#fff3dc;font:700 30px/1 var(--serif);white-space:nowrap;background:linear-gradient(100deg,#55071a 0%,#8d1530 45%,#b42446 70%,#7a1022 100%);border-radius:28px 0 60px 0;box-shadow:inset 0 2px 3px rgba(255,170,180,.45),0 3px 0 #e6b866,0 6px 12px rgba(60,5,15,.25);text-shadow:0 2px 3px rgba(30,0,8,.5);clip-path:polygon(0 0,100% 0,88% 100%,0 100%);width:auto;min-width:0}",
    "#nd-fwin .ndg-h svg.i,#nd-fwin .ndsec>h3 svg.i{font-size:36px;color:#fff1de;stroke-width:1.8}",
    "#nd-fwin .ndg-img{position:absolute;right:0;left:auto;top:0;bottom:0;width:50%;background-size:cover;background-position:center;opacity:.92;-webkit-mask-image:linear-gradient(270deg,#000 25%,rgba(0,0,0,.55) 60%,transparent 100%);mask-image:linear-gradient(270deg,#000 25%,rgba(0,0,0,.55) 60%,transparent 100%)}",
    "#nd-fwin .ndg-f{position:relative;margin-left:26px;padding:0 24px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:16px 22px;align-items:center}",
    "#nd-fwin .ndg.noimg .ndg-f{margin-left:26px}",
    "#nd-fwin .ndg.one .ndg-f{grid-template-columns:1fr}",
    "#nd-fwin .ndg .ef{display:grid;grid-template-columns:var(--lw,128px) 1fr;align-items:center;gap:12px;margin:0;min-width:0}",
    "#nd-fwin .ndg .ef.wide{grid-column:1/-1}",
    "#nd-fwin .ndg .ef.top{align-items:start}",
    "#nd-fwin .ndg .el{margin:0;gap:10px;font:400 24px/1.1 var(--cond);color:#1f1111;text-shadow:0 0 6px #fff8f0,0 0 3px #fff8f0,0 0 1px #fff}.ndg .in{background:rgba(255,253,250,.94)}.ndg-h{z-index:2}#nd-fwin .ndsec>h3{z-index:2}#nd-fwin .ndsec>.ndrow,#nd-fwin .ndsec>.ndempty{position:relative;z-index:1;background:linear-gradient(90deg,rgba(255,253,249,.97) 0%,rgba(255,250,244,.93) 55%,rgba(251,239,229,.78) 100%)}.ndsec-img{opacity:.85}",
    "#nd-fwin .ndg .el svg.i{display:none}",
    "#nd-fwin .ndg .in{height:52px;border-radius:26px;font-size:24px;padding:0 20px}",
    "#nd-fwin .ndg .in.ta{height:120px;border-radius:22px;padding:12px 18px}",
    "#nd-fwin .ndg .selw svg.i{display:block}",
    "#nd-fwin .ndg .ndres,#nd-fwin .ndg .ndphotos,#nd-fwin .ndg .ndfile,#nd-fwin .ndg>.ndrows{grid-column:1/-1;margin:0}",
    /* rows like the documents list: separate glass pills */
    "#nd-fwin .ndsec{position:relative;padding:72px 0 14px;border-radius:28px;border:1.5px solid rgba(255,255,255,.95);box-shadow:0 0 0 1px rgba(226,176,120,.45),0 0 18px rgba(255,230,204,.95),0 8px 18px rgba(120,50,20,.18),inset 0 1px 0 #fff}",
    "#nd-fwin .ndrow{margin:0 18px 12px;min-height:80px;padding:10px 18px 10px 22px;border:0;border-radius:22px;background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1.5px rgba(227,178,94,.55),0 0 10px rgba(255,226,190,.8),0 3px 6px rgba(120,50,20,.12)}",
    "#nd-fwin .ndrow:first-of-type{border-top:0}",
    "#nd-fwin .ndrow button,#nd-fwin .ndrow a.rb{width:58px;height:58px;background:radial-gradient(circle at 35% 28%,#fffdf9,#fbefe5 60%,#f3dcc4);box-shadow:0 0 0 1.5px rgba(227,178,94,.6),0 0 10px rgba(255,214,150,.6),0 2px 5px rgba(120,50,20,.2)}",
    "#nd-fwin .ndempty{margin:0 18px;padding:18px 22px;border-radius:20px;background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 1px rgba(227,178,94,.35)}",
    "#nd-fwin .ndfile{flex-direction:column;gap:8px;height:auto;min-height:118px;padding:16px;border:2.5px dashed rgba(160,26,51,.55);box-shadow:0 0 10px rgba(255,226,190,.8);color:#8d1530;font-size:30px}",
    "#nd-fwin .ndfile .row1{display:flex;align-items:center;gap:16px}",
    "#nd-fwin .ndfile small{font:400 23px/1.2 var(--cond);color:#3a1a14}",
    "#nd-fwin .ndfile svg.i{font-size:46px;color:#8d1530}",
    "html:not(.desk){background:#efc19c}",
    ""
  ].join("\n");

  function boot() {
    if (document.getElementById("nd-ui-css")) return;
    var st = document.createElement("style"); st.id = "nd-ui-css"; st.textContent = CSS; document.head.appendChild(st);
    var need = /<symbol id="([^"]+)"/g, m, defs = "";
    while ((m = need.exec(SYM))) {
      if (!document.getElementById(m[1])) {
        var end = SYM.indexOf("</symbol>", m.index) + 9;
        defs += SYM.slice(m.index, end);
      }
    }
    if (defs) {
      var d = document.createElement("div");
      d.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + defs + "</svg>";
      document.body.insertBefore(d.firstChild, document.body.firstChild);
    }
  }
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  var ic = function (n) { return '<svg class="i"><use href="#' + n + '"/></svg>'; };
  var img = function (n) { return (window.IMG && window.IMG[n]) || "assets/" + n; };

  /* one field — identical markup to the Компании form */
  function fld(o) {
    var id = o.id, v = o.value == null ? "" : o.value, ph = esc(o.ph || "");
    var lab = '<label class="el" for="' + id + '">' + ic(o.icon || "pencil") + esc(o.label) + (o.required ? " *" : "") + "</label>";
    var inp;
    if (o.type === "ta") inp = '<textarea class="in ta" id="' + id + '" placeholder="' + ph + '">' + esc(v) + "</textarea>";
    else if (o.type === "select")
      inp = '<span class="selw"><select class="in" id="' + id + '">' + (o.options || []).map(function (x) {
        var val = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x;
        return '<option value="' + esc(val) + '"' + (String(val) === String(v) ? " selected" : "") + ">" + esc(t) + "</option>";
      }).join("") + "</select>" + ic("chev-d") + "</span>";
    else inp = '<input class="in" id="' + id + '" type="' + (o.type || "text") + '" value="' + esc(v) + '" placeholder="' + ph + '"' + (o.step ? ' step="' + o.step + '"' : "") + (o.list ? ' list="' + o.list + '"' : "") + (o.type === "number" ? ' inputmode="decimal"' : "") + ">";
    return '<div class="ef' + (o.wide ? " wide" : "") + '">' + lab + inp + "</div>";
  }

  var W, back, ctlFull, cv, scroll, cur = null, full = false, last = null;
  function build() {
    boot();
    back = document.createElement("div"); back.className = "mback"; back.id = "nd-fback"; back.hidden = true;
    W = document.createElement("section"); W.className = "mwin fwin"; W.id = "nd-fwin"; W.hidden = true;
    W.setAttribute("role", "dialog"); W.setAttribute("aria-modal", "true"); W.setAttribute("aria-labelledby", "nd-f-title");
    W.innerHTML =
      '<div class="mctl fctl"><button type="button" class="mbtn" id="nd-f-full" aria-label="На цял екран" title="На цял екран">' + ic("maximize-2") + "</button>" +
      '<button type="button" class="mbtn" id="nd-f-close" aria-label="Затвори" title="Затвори">' + ic("x") + "</button></div>" +
      '<div class="mscroll" id="nd-fscroll"><form class="fcv" id="nd-fcv" novalidate>' +
      '<header class="f-bar"><svg class="i" id="nd-f-ic"><use href="#file-text"/></svg><h2 id="nd-f-title"></h2></header>' +
      '<div class="f-photo" id="nd-f-photo"></div><div class="f-body" id="nd-f-body"></div><p class="ev-err" id="nd-f-err" role="alert"></p>' +
      '<div class="ev-acts"><button type="button" class="ea del" id="nd-f-del" hidden>' + ic("trash-2") + "<span>Изтрий</span></button>" +
      '<button type="button" class="ea" id="nd-f-cancel">Отказ</button><button type="submit" class="ea hot" id="nd-f-save">' + ic("save") + "<span>Запази</span></button></div>" +
      "</form></div>";
    document.body.appendChild(back); document.body.appendChild(W);
    cv = W.querySelector("#nd-fcv"); scroll = W.querySelector("#nd-fscroll"); ctlFull = W.querySelector("#nd-f-full");
    back.addEventListener("click", close);
    W.querySelector("#nd-f-close").addEventListener("click", close);
    W.querySelector("#nd-f-cancel").addEventListener("click", close);
    ctlFull.addEventListener("click", function () { setFull(!full); });
    W.querySelector("#nd-f-del").addEventListener("click", function () {
      var b = this, s = b.querySelector("span");
      if (!b.dataset.ok) { b.dataset.ok = "1"; s.textContent = "Потвърди"; setTimeout(function () { delete b.dataset.ok; s.textContent = "Изтрий"; }, 2500); return; }
      delete b.dataset.ok; s.textContent = "Изтрий";
      if (cur && cur.onDelete) Promise.resolve(cur.onDelete()).then(function (r) { if (r !== false) close(); });
    });
    cv.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!cur || !cur.onSave) { close(); return; }
      [].forEach.call(cv.querySelectorAll(".bad"), function (x) { x.classList.remove("bad"); });
      var err = W.querySelector("#nd-f-err"); err.textContent = "";
      var miss = (cur.required || []).filter(function (id) { var el = q(id); if (el && !String(el.value).trim()) { el.classList.add("bad"); return true; } return false; });
      if (miss.length) { err.textContent = "Моля, попълнете задължителните полета."; return; }
      var bad = cur.validate && cur.validate(get);
      if (bad) { err.textContent = bad; return; }
      var btn = W.querySelector("#nd-f-save"); btn.disabled = true;
      Promise.resolve(cur.onSave(get)).then(function (r) { btn.disabled = false; if (r !== false && !(cur && cur.keepOpen)) close(); }, function (x) {
        btn.disabled = false; err.textContent = "Грешка при запис: " + ((x && x.message) || x);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (W.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    }, true);
    addEventListener("resize", fit);
  }
  function q(id) { return W.querySelector("#" + id); }
  function get(id) { var el = q(id); return el ? String(el.value).trim() : ""; }
  function num(id) { var v = get(id).replace(/\s/g, ""); if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) v = v.replace(/,/g, ""); v = v.replace(",", "."); return v === "" ? null : Number(v); }

  function fit() {
    if (!W || W.hidden || inlineHost) return;
    var root = document.documentElement, desk = root.classList.contains("desk");
    if (desk) {
      var vw = root.clientWidth - (window.NDRAIL || 0), dh = parseFloat(getComputedStyle(root).getPropertyValue("--dockH")) || (window.NDRAIL ? 0 : 100), ah = innerHeight - dh - 14;
      var aw = full ? vw - 16 : Math.min(vw * (window.NDRAIL ? 0.8 : 0.6), window.NDRAIL ? 1500 : 1100), av = full ? ah - 8 : ah * (window.NDRAIL ? 0.97 : 0.94), z = Math.min(aw / 1024, window.NDRAIL ? 1.45 : 1.1), w = 1024 * z, h = Math.min(av, (cv.offsetHeight || 1000) * z);
      W.style.width = w + "px"; W.style.height = h + "px"; W.style.left = (vw - w) / 2 + "px"; W.style.top = Math.max(6, (ah - h) / 2) + "px";
      cv.style.zoom = z;
    } else {
      W.style.width = W.style.height = W.style.left = W.style.top = W.style.bottom = "";
      var zz = W.clientWidth / 1024; cv.style.zoom = zz; W.style.setProperty("--fz", zz);
      if (!full) {
        var avail = W.getBoundingClientRect().height, need = cv.getBoundingClientRect().height + 2;
        if (need < avail) { W.style.bottom = "auto"; W.style.height = need + "px"; }
      }
    }
  }
  function setFull(v) {
    full = v; W.classList.toggle("full", v);
    ctlFull.innerHTML = ic(v ? "minimize-2" : "maximize-2");
    ctlFull.setAttribute("aria-label", v ? "Възстанови размера" : "На цял екран"); ctlFull.title = ctlFull.getAttribute("aria-label");
    fit(); setTimeout(fit, 280);
  }
  var inlineHost = null;
  function open(o) {
    if (!W) build();
    cur = o; last = document.activeElement;
    /* inline: the window lives inside a page element (the Сделки page) instead of floating over it */
    if (o.inline && o.inline !== inlineHost) { inlineHost = o.inline; inlineHost.appendChild(W); W.classList.add("inline"); W.removeAttribute("aria-modal"); W.setAttribute("role", "region"); }
    else if (!o.inline && inlineHost) { inlineHost = null; document.body.appendChild(W); W.classList.remove("inline"); W.setAttribute("role", "dialog"); W.setAttribute("aria-modal", "true"); }
    q("nd-f-title").textContent = o.title || "";
    q("nd-f-ic").innerHTML = '<use href="#' + (o.icon || "file-text") + '"/>';
    q("nd-f-photo").style.backgroundImage = o.photo ? "url(" + img(o.photo) + ")" : "none";
    q("nd-f-photo").style.display = o.photo ? "" : "none";
    q("nd-f-body").oninput = null; q("nd-f-body").innerHTML = o.html || "";
    q("nd-f-err").textContent = "";
    q("nd-f-del").hidden = !o.onDelete;
    var sv = q("nd-f-save"); sv.hidden = !!o.noSave; sv.querySelector("span").textContent = o.saveText || "Запази";
    q("nd-f-cancel").textContent = o.cancelText || (o.noSave ? "Затвори" : "Отказ");
    W.hidden = false;
    if (inlineHost) { W.classList.add("show"); }
    else { back.hidden = false; document.documentElement.classList.add("locked"); fit(); scroll.scrollTop = 0; requestAnimationFrame(function () { back.classList.add("show"); W.classList.add("show"); fit(); }); }
    if (o.ready) o.ready({ q: q, get: get, num: num, body: q("nd-f-body"), refit: fit, rerender: function (h) { q("nd-f-body").innerHTML = h; if (o.ready2) o.ready2(); fit(); } });
    setTimeout(function () { var f = W.querySelector("#nd-f-body .in"); if (f && o.focus !== false && !matchMedia("(pointer:coarse)").matches) f.focus({ preventScroll: true }); }, 80);
    return { q: q, get: get, num: num, close: close, refit: fit };
  }
  function close() {
    if (!W || W.hidden) return;
    if (inlineHost) { var oi = cur; if (oi && oi.onClose) oi.onClose(); return; }
    W.classList.remove("show"); back.classList.remove("show");
    var o = cur; cur = null;
    setTimeout(function () { W.hidden = true; back.hidden = true; setFull(false); }, 230);
    var other = document.querySelector(".mwin.show:not(#nd-fwin)");
    if (!other) document.documentElement.classList.remove("locked");
    if (o && o.onClose) o.onClose();
    if (last && last.focus) last.focus({ preventScroll: true });
  }

  /* section card: ribbon header, blended photo on the left, inline label/field rows */
  var DEFPH = ["nd/ph01.jpg", "nd/ph02.jpg", "nd/ph03.jpg", "nd/ph04.jpg", "nd/ph05.jpg", "nd/ph06.jpg", "nd/ph07.jpg", "nd/ph08.jpg", "nd/ph09.jpg", "nd/ph10.jpg", "nd/ph11.jpg", "nd/ph12.jpg", "nd/ph14.jpg", "nd/ph15.jpg", "nd/ph16.jpg", "nd/ph18.jpg", "nd/ph19.jpg", "nd/ph20.jpg"];
  function defPhoto(t) { var h = 0; t = String(t || ""); for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return DEFPH[h % DEFPH.length]; }
  function group(title, icon, photo, inner, opts) {
    opts = opts || {}; if (!photo && !opts.noPhoto) photo = defPhoto(title);
    return '<div class="ndg' + (photo ? "" : " noimg") + (opts.one ? " one" : "") + '"' + (opts.lw ? ' style="--lw:' + opts.lw + 'px"' : "") + '><div class="ndg-h">' + ic(icon) + esc(title) + "</div>" +
      (photo ? '<div class="ndg-img" style="background-image:url(' + img(photo) + ')"></div>' : "") + '<div class="ndg-f">' + inner + "</div></div>";
  }
  function filebox(id, title, sub, opts) {
    opts = opts || {};
    return '<label class="ndfile" style="position:relative"><span class="row1">' + ic(opts.icon || "upload") + "<span" + (opts.nameId ? ' id="' + opts.nameId + '"' : "") + ">" + esc(title) + "</span></span><small>" + esc(sub || "Плъзнете файл тук или изберете от устройството") + '</small><input type="file" id="' + id + '"' + (opts.accept ? ' accept="' + opts.accept + '"' : "") + " multiple></label>";
  }
  /* list section in the same glass look */
  function section(title, icon, rows, empty) {
    return '<div class="ndsec"><div class="ndg-img ndsec-img" style="background-image:url(' + img(defPhoto(title)) + ')"></div><h3>' + ic(icon) + esc(title) + "</h3>" + (rows && rows.length ? rows.join("") : '<div class="ndempty">' + esc(empty || "Няма записи.") + "</div>") + "</div>";
  }
  function row(icon, title, sub, tm, btns) {
    return '<div class="ndrow">' + ic(icon) + '<div class="tx"><b>' + esc(title) + "</b>" + (sub ? "<span>" + esc(sub) + "</span>" : "") + "</div>" + (tm ? '<span class="tm">' + esc(tm) + "</span>" : "") + (btns || "") + "</div>";
  }
  var money = function (n) { return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Math.round(n * 100) / 100).replace(/ | /g, " "); };
  var bgDate = function (d) { d = d instanceof Date ? d : new Date(d); if (isNaN(d)) return ""; return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear(); };
  var bgDateTime = function (d) { d = d instanceof Date ? d : new Date(d); if (isNaN(d)) return ""; return bgDate(d) + ", " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); };

  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
  /* bank module over any page (same overlay as in the client card) */
  var bankBox = null;
  function bank(params) {
    boot();
    if (!document.getElementById("nd-bank-css")) {
      var st = document.createElement("style"); st.id = "nd-bank-css";
      st.textContent = ".nd-bank{position:fixed;inset:0;z-index:80;background:rgba(40,5,12,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .22s}.nd-bank.show{opacity:1}.nd-bank[hidden]{display:none}.nd-bank iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent}";
      document.head.appendChild(st);
      addEventListener("message", function (e) { if (e.data && e.data.type === "crm-bank-close") closeBank(); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && bankBox && !bankBox.hidden) { e.stopImmediatePropagation(); closeBank(); } }, true);
    }
    if (!bankBox) {
      bankBox = document.createElement("div"); bankBox.className = "nd-bank"; bankBox.setAttribute("role", "dialog"); bankBox.setAttribute("aria-modal", "true"); bankBox.setAttribute("aria-label", "Банков модул");
      bankBox.innerHTML = '<iframe title="Банков модул" allow="fullscreen; clipboard-write"></iframe>'; document.body.appendChild(bankBox);
    }
    var q = "embed=1"; Object.keys(params || {}).forEach(function (k) { if (params[k] != null && params[k] !== "") q += "&" + k + "=" + encodeURIComponent(params[k]); });
    bankBox.querySelector("iframe").src = "bank.html?" + q; bankBox.hidden = false;
    requestAnimationFrame(function () { bankBox.classList.add("show"); });
  }
  function closeBank() { if (!bankBox) return; bankBox.classList.remove("show"); setTimeout(function () { bankBox.hidden = true; bankBox.querySelector("iframe").src = "about:blank"; }, 220); }
  /* calculator block used inside the deal windows: price and commission come from the deal fields */
  function calcHtml(rent, noComm) {
    return group(noComm ? "Кредитен калкулатор" : "Калкулатор", "calculator", "nd/ph09.jpg",
      (noComm ? "" : fld({ id: "k-vat", label: "ДДС върху комисионната (%)", icon: "landmark", value: 20, type: "number" })) +
      (rent ? "" : fld({ id: "k-down", label: "Самоучастие (%)", icon: "coins", value: 20, type: "number" }) +
        fld({ id: "k-rate", label: "Годишна лихва (%)", icon: "landmark", value: 2.5, type: "number", step: "0.01" }) +
        fld({ id: "k-years", label: "Срок (години)", icon: "calendar", value: 30, type: "number" })) +
      '<div class="ndres wide" id="k-res"></div>', { lw: 170 });
  }
  function calcBind(ctx, priceId, commId, rentId) {
    function n(id) { var v = ctx.num(id); return v == null || isNaN(v) ? 0 : v; }
    function r2(x) { return Math.round(x * 100) / 100; }
    function run() {
      var res = ctx.q("k-res"); if (!res) return;
      var price = n(priceId), cp = commId ? n(commId) : 0, vat = n("k-vat"), comm = price * cp / 100, cv = comm * vat / 100;
      var h = !commId ? "" : "<div><span>Комисионна без ДДС</span><b>" + money(r2(comm)) + " €</b></div><div><span>ДДС</span><b>" + money(r2(cv)) + " €</b></div>" +
        '<div class="big"><span>Комисионна с ДДС</span><b>' + money(r2(comm + cv)) + " €</b></div>";
      if (ctx.q("k-down")) {
        var L = price * (1 - n("k-down") / 100), i = n("k-rate") / 100 / 12, m = Math.round(n("k-years") * 12);
        var pay = m > 0 ? (i === 0 ? L / m : L * i / (1 - Math.pow(1 + i, -m))) : 0;
        h += "<div><span>Размер на кредита</span><b>" + money(r2(L)) + " €</b></div>" +
          '<div class="big"><span>Месечна вноска</span><b>' + money(r2(pay)) + " €</b></div>" +
          "<div><span>Обща сума за връщане</span><b>" + money(r2(pay * m)) + " €</b></div><div><span>Обща лихва</span><b>" + money(r2(pay * m - L)) + " €</b></div>";
      }
      res.innerHTML = h;
    }
    run(); if (ctx.body) { if (!ctx.body._calcRun) ctx.body.addEventListener("input", function () { ctx.body._calcRun(); }); ctx.body._calcRun = run; }
    return run;
  }
  /* agency commission block of a deal: buyer % (1–50), seller by % / € per m² over the price / fixed € on top,
     VAT as a button with a dropdown, paid parts with check circles that come off the total */
  var CM_SM = [["pct", "% Ком."], ["sqm", "Цена на кв.м."], ["eur", "Горница в €"]];
  var CM_VAT = [[0, "Без ДДС"], [9, "ДДС 9%"], [20, "ДДС 20%"]];
  function cmPcts() { var a = [["", "—"]]; for (var i = 0.5; i <= 10; i += 0.5) a.push([String(i), String(i).replace(".", ",") + " %"]); for (var j = 11; j <= 50; j++) a.push([String(j), j + " %"]); return a; }
  function cmNorm(d) {
    d = d || {}; var o = { cb: d.comm_buyer_pct, sm: d.comm_seller_mode || "pct", sv: d.comm_seller_val, area: d.area, vat: d.vat == null ? 0 : d.vat, pb: d.paid_buyer, ps: d.paid_seller };
    if (d.comm_buyer_pct == null && d.comm_seller_val == null && d.commission_pct) {
      if (/Продавача|Наемодателя/.test(d.comm_from || "")) o.sv = d.commission_pct; else o.cb = d.commission_pct;
      if (d.paid) o.pb = d.paid;
    }
    return o;
  }
  function cmCalc(price, o) {
    var P = Number(price) || 0, n = function (v) { v = Number(v); return isNaN(v) ? 0 : v; };
    var b = P * n(o.cb) / 100, s = o.sm === "sqm" ? n(o.sv) * n(o.area) : o.sm === "eur" ? n(o.sv) : P * n(o.sv) / 100;
    var net = b + s, vat = net * n(o.vat) / 100, k = 1 + n(o.vat) / 100;
    var paid = Math.min(n(o.pb), b * k) + Math.min(n(o.ps), s * k);
    return { buyer: b, seller: s, net: net, vat: vat, gross: net + vat, paid: paid, left: Math.max(0, net + vat - paid), k: k };
  }
  function commTotal(d) { if (d && d.comm_total != null) return Number(d.comm_total) || 0; return d && d.amount && d.commission_pct ? d.amount * d.commission_pct / 100 : 0; }
  function commHtml(d) {
    var o = cmNorm(d), vatT = (CM_VAT.filter(function (x) { return x[0] === Number(o.vat); })[0] || CM_VAT[0])[1];
    var pay = function (k, t) { return '<div class="cm-pay" data-k="' + k + '"><button type="button" class="cm-chk" data-chk="' + k + '" aria-label="Платено изцяло – ' + t + '"></button>' +
      '<div class="cm-pt"><b>' + t + '</b><span id="cm-' + k + '-due">—</span></div><label class="cm-in"><small>Взето (€)</small><input class="in" id="cm-p' + k + '" type="number" inputmode="decimal" value="' + esc(k === "b" ? (o.pb == null ? "" : o.pb) : (o.ps == null ? "" : o.ps)) + '" placeholder="0"></label></div>'; };
    return group("Комисионна за агенцията", "coins", "nd/ph09.jpg",
      fld({ id: "cm-cb", label: "Комисионна от купувача", icon: "user", type: "select", value: o.cb == null ? "" : String(Number(o.cb)), options: cmPcts() }) +
      fld({ id: "cm-sm", label: "Комисионна от продавача", icon: "user-round", type: "select", value: o.sm, options: CM_SM }) +
      fld({ id: "cm-sv", label: "Стойност", icon: "coins", value: o.sv, type: "number", step: "0.01" }) +
      fld({ id: "cm-area", label: "Площ (м²)", icon: "house", value: o.area, type: "number" }) +
      '<div class="ef wide cm-vatw"><input type="hidden" id="cm-vat" value="' + esc(o.vat) + '"><button type="button" class="cm-vat" id="cm-vatb" aria-haspopup="true" aria-expanded="false">' + ic("landmark") + '<span>' + esc(vatT) + '</span>' + ic("chev-d") + '</button>' +
      '<div class="cm-menu" id="cm-vatm" hidden>' + CM_VAT.map(function (x) { return '<button type="button" data-vat="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div></div>" +
      '<div class="wide cm-pays">' + pay("b", "От купувача") + pay("s", "От продавача") + "</div>" +
      '<div class="ndres wide" id="cm-res"></div>', { lw: 170 });
  }
  function commRead(ctx) {
    var n = function (id) { var v = ctx.num(id); return v == null || isNaN(v) ? null : v; };
    return { cb: n("cm-cb"), sm: ctx.get("cm-sm") || "pct", sv: n("cm-sv"), area: n("cm-area"), vat: n("cm-vat") || 0, pb: n("cm-pb"), ps: n("cm-ps") };
  }
  /* fields to store on the deal (old commission_pct / paid kept in sync for the summary screens) */
  function commSave(ctx, price) {
    var o = commRead(ctx), r = cmCalc(price, o);
    return { comm_buyer_pct: o.cb, comm_seller_mode: o.sm, comm_seller_val: o.sv, area: o.area, vat: o.vat, paid_buyer: o.pb, paid_seller: o.ps,
      comm_total: Math.round(r.net * 100) / 100, comm_gross: Math.round(r.gross * 100) / 100, paid: Math.round(r.paid * 100) / 100,
      commission_pct: price ? Math.round(r.net / price * 10000) / 100 : null, comm_from: o.cb && r.seller ? "Двете страни" : r.seller ? "Продавача" : o.cb ? "Купувача" : "" };
  }
  function commBind(ctx, priceId) {
    var q = ctx.q, body = ctx.body, r2 = function (x) { return Math.round(x * 100) / 100; };
    var LBL = { pct: "Комисионна от продавача (%)", sqm: "Горница за нас на кв.м. (€/м²)", eur: "Горница (€)" };
    function run() {
      var res = q("cm-res"); if (!res) return;
      var o = commRead(ctx), P = ctx.num(priceId) || 0, r = cmCalc(P, o);
      var lab = q("cm-sv") && q("cm-sv").parentNode.querySelector("label"); if (lab) lab.lastChild.nodeValue = LBL[o.sm];
      var af = q("cm-area") && q("cm-area").closest(".ef"); if (af) af.style.display = o.sm === "sqm" ? "" : "none";
      [["b", r.buyer], ["s", r.seller]].forEach(function (x) {
        var due = x[1] * r.k, got = ctx.num("cm-p" + x[0]) || 0, el = q("cm-" + x[0] + "-due"), ch = body.querySelector('[data-chk="' + x[0] + '"]');
        if (el) el.textContent = due ? money(r2(due)) + " €" + (got > 0 && got < due ? " · остават " + money(r2(due - got)) + " €" : "") : "—";
        if (ch) ch.className = "cm-chk" + (due && got >= due - 0.005 ? " on" : got > 0 ? " half" : "");
      });
      var t = function (l, v, c) { return "<div" + (c ? ' class="' + c + '"' : "") + "><span>" + l + "</span><b>" + money(r2(v)) + " €</b></div>"; };
      res.innerHTML = t("Комисионна общо", r.net) + (o.vat ? t("ДДС " + o.vat + "%", r.vat) : "") +
        (o.vat ? t("Общо с ДДС", r.gross) : "") + t("Платено", r.paid) + t("Остава за плащане", r.left, "big");
    }
    body._cmRun = run;
    if (body._cmBound) { run(); return run; } body._cmBound = 1;
    body.addEventListener("input", function () { if (body._cmRun) body._cmRun(); }); body.addEventListener("change", function () { if (body._cmRun) body._cmRun(); });
    body.addEventListener("click", function (e) { if (!q("cm-res")) return;
      var vb = e.target.closest("#cm-vatb"), vo = e.target.closest("[data-vat]"), ch = e.target.closest("[data-chk]"), m = q("cm-vatm");
      if (vb) { e.preventDefault(); m.hidden = !m.hidden; vb.setAttribute("aria-expanded", String(!m.hidden)); return; }
      if (vo) { e.preventDefault(); q("cm-vat").value = vo.getAttribute("data-vat"); q("cm-vatb").querySelector("span").textContent = vo.textContent; m.hidden = true; q("cm-vatb").setAttribute("aria-expanded", "false"); run(); return; }
      if (ch) {
        e.preventDefault(); var k = ch.getAttribute("data-chk"), r = cmCalc(ctx.num(priceId) || 0, commRead(ctx)), due = r2((k === "b" ? r.buyer : r.seller) * r.k), inp = q("cm-p" + k);
        inp.value = ch.classList.contains("on") ? "" : (due || ""); run(); return;
      }
      if (m && !m.hidden && !e.target.closest(".cm-vatw")) m.hidden = true;
    });
    run(); return run;
  }

  /* ---------- desktop: the bottom menu becomes a side panel on the left ---------- */
  var RAIL = 112;
  function sideRail() {
    var root = document.documentElement, dock = document.getElementById("dock");
    if (!dock) return;
    var side = document.getElementById("ndside");
    function build() {
      if (side) return side;
      side = document.createElement("aside"); side.id = "ndside"; side.setAttribute("aria-label", "Меню");
      var logo = document.querySelector(".logo-img, img.logo") || null;
      var top = document.createElement("a"); top.className = "sb-logo"; top.href = "/"; top.title = "Към сайта";
      top.innerHTML = '<img src="' + (logo ? logo.getAttribute("src") : "assets/logo.png") + '" alt="Недвижими Имоти Надежда">';
      side.appendChild(top);
      var nav = document.createElement("nav"); nav.className = "sb-nav"; nav.setAttribute("aria-label", "Основна навигация");
      [].forEach.call(dock.querySelectorAll(".nv"), function (b) { var c = b.cloneNode(true); c.classList.add("sb-i"); nav.appendChild(c); });
      side.appendChild(nav);
      var foot = document.createElement("div"); foot.className = "sb-foot";
      foot.innerHTML = '<button type="button" class="sb-ted" data-ted title="Тед Асистент"><img src="assets/ash-bot.png" alt=""><span>Тед</span></button>';
      side.appendChild(foot);
      document.body.appendChild(side);
      side.addEventListener("click", function (e) { if (e.target.closest("[data-ted]") && window.NDAsh) { e.preventDefault(); NDAsh.open(); } });
      /* warm the next pages while the pointer is over the menu */
      side.addEventListener("mouseover", function (e) { var b = e.target.closest(".nv[data-href]"); if (!b || b._pf) return; b._pf = 1; var l = document.createElement("link"); l.rel = "prefetch"; l.href = b.getAttribute("data-href"); document.head.appendChild(l); });
      return side;
    }
    function apply() {
      var desk = root.clientWidth >= 1024 && root.clientWidth / innerHeight >= 1.2;
      var was = window.NDRAIL || 0;
      window.NDRAIL = desk ? RAIL : 0;
      root.style.setProperty("--rail", window.NDRAIL + "px");
      root.classList.toggle("rail", desk);
      if (desk) build();
      if (was !== window.NDRAIL) dispatchEvent(new Event("resize"));
    }
    apply(); addEventListener("resize", apply);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sideRail); else sideRail();

  /* ---------- premium drop-down menus: every <select> opens our own glass list on desktop (phones keep the native sheet) ---------- */
  (function () {
    var box = null, sel = null, items = [], hl = -1;
    function fine() { return matchMedia("(pointer:fine)").matches && !matchMedia("(max-width:768px)").matches; }
    function closeMenu() { if (box) { box.remove(); box = null; } if (sel) { sel.classList.remove("ndm-open"); } sel = null; items = []; hl = -1; document.removeEventListener("pointerdown", onDoc, true); window.removeEventListener("resize", closeMenu); window.removeEventListener("scroll", closeMenu, true); }
    function onDoc(e) { if (box && !box.contains(e.target) && e.target !== sel) closeMenu(); }
    function place(anchor) {
      var r = anchor.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, w = Math.max(220, Math.min(r.width, 420)), h = box.offsetHeight;
      var left = Math.min(Math.max(8, r.left), vw - w - 8), below = vh - r.bottom - 10, top;
      if (h <= below || below >= r.top - 10) { top = r.bottom + 6; box.style.maxHeight = Math.min(520, below) + "px"; box.classList.remove("up"); }
      else { top = Math.max(8, r.top - 6 - Math.min(h, r.top - 16)); box.style.maxHeight = Math.min(520, r.top - 16) + "px"; box.classList.add("up"); }
      box.style.left = left + "px"; box.style.top = top + "px"; box.style.width = w + "px";
    }
    function pick(i) { var o = items[i], s0 = sel; if (!o || o.disabled || !s0) return; var v = o.value, changed = s0.value !== v; s0.value = v; closeMenu(); if (changed) { s0.dispatchEvent(new Event("input", { bubbles: true })); s0.dispatchEvent(new Event("change", { bubbles: true })); } }
    function render(q) {
      var list = box.querySelector(".ndm-l"); list.innerHTML = ""; items = []; hl = -1;
      var ql = (q || "").toLowerCase(), groups = sel.querySelectorAll("optgroup"), any = false;
      function add(o) { if (o.hidden) return; var t = o.textContent.trim(); if (ql && t.toLowerCase().indexOf(ql) < 0) return; var b = document.createElement("button"); b.type = "button"; b.textContent = t || "—"; if (o.disabled) b.disabled = true; if (o.selected) { b.classList.add("on"); } b.setAttribute("data-i", items.length); items.push(o); list.appendChild(b); any = true; }
      if (groups.length) { [].forEach.call(sel.children, function (c) { if (c.tagName === "OPTGROUP") { var g = document.createElement("div"); g.className = "ndm-g"; g.textContent = c.label; list.appendChild(g); [].forEach.call(c.children, add); } else add(c); }); }
      else [].forEach.call(sel.options, add);
      if (!any) { var e = document.createElement("div"); e.className = "ndm-g"; e.textContent = "Няма съвпадения"; list.appendChild(e); }
      var on = list.querySelector("button.on"); if (on) hl = +on.getAttribute("data-i");
    }
    function openMenu(s, anchor) {
      closeMenu(); sel = s; sel.classList.add("ndm-open");
      box = document.createElement("div"); box.className = "ndmenu"; box.setAttribute("role", "listbox");
      var many = sel.options.length > 8;
      box.innerHTML = (many ? '<div class="ndm-q"><input type="text" placeholder="Търси…" aria-label="Търси в списъка"></div>' : "") + '<div class="ndm-l"></div>';
      document.body.appendChild(box); render("");
      box.addEventListener("click", function (e) { var b = e.target.closest("button[data-i]"); if (b) pick(+b.getAttribute("data-i")); });
      box.addEventListener("keydown", keys);
      var qi = box.querySelector(".ndm-q input"); if (qi) { qi.addEventListener("input", function () { render(qi.value); }); }
      place(anchor); var on = box.querySelector("button.on"); if (on) on.scrollIntoView({ block: "center" });
      setTimeout(function () { (qi || box.querySelector("button")) && (qi || box.querySelector("button")).focus({ preventScroll: true }); }, 0);
      document.addEventListener("pointerdown", onDoc, true); window.addEventListener("resize", closeMenu); window.addEventListener("scroll", closeMenu, true);
    }
    function keys(e) {
      var bs = box.querySelectorAll("button[data-i]"); if (!bs.length) return;
      var cur = [].findIndex.call(bs, function (b) { return b.classList.contains("hl"); }); if (cur < 0) cur = [].findIndex.call(bs, function (b) { return b.classList.contains("on"); });
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); var n = e.key === "ArrowDown" ? Math.min(bs.length - 1, cur + 1) : Math.max(0, cur - 1); bs.forEach(function (b) { b.classList.remove("hl"); }); bs[n].classList.add("hl"); bs[n].scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter") { e.preventDefault(); if (cur >= 0) pick(+bs[cur].getAttribute("data-i")); }
      else if (e.key === "Escape") { e.preventDefault(); var s0 = sel; closeMenu(); s0 && s0.focus(); }
    }
    document.addEventListener("mousedown", function (e) {
      if (!fine()) return;
      var s = e.target.closest && e.target.closest("select"); if (!s || s.multiple || s.size > 1 || s.disabled || s.dataset.native != null) return;
      e.preventDefault();
      var anchor = s.closest(".fld, .selw, .dsw, .w, .ef, .ndl-sel > div, .input-wrap, .city-select") || s;
      if (box && sel === s) { closeMenu(); return; }
      openMenu(s, anchor);
    }, true);
    document.addEventListener("keydown", function (e) { if (!fine()) return; var s = document.activeElement; if (s && s.tagName === "SELECT" && (e.key === "Enter" || e.key === " " || e.altKey && e.key === "ArrowDown")) { e.preventDefault(); openMenu(s, s.closest(".fld, .selw, .dsw, .w, .ef, .ndl-sel > div, .input-wrap, .city-select") || s); } });
    window.NDMenuClose = closeMenu;
  })();
  window.NDUI = { commHtml: commHtml, commBind: commBind, commSave: commSave, commTotal: commTotal, calcHtml: calcHtml, calcBind: calcBind, open: open, close: close, fld: fld, section: section, row: row, esc: esc, ic: ic, img: img, money: money, bgDate: bgDate, bgDateTime: bgDateTime, boot: boot, bank: bank, group: group, filebox: filebox };
})();
