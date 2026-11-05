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
    /* small '+ Нов' pill used on list pages (same glass button look) */
    ".nd-new{position:absolute;right:22px;top:12px;z-index:3;height:46px;padding:0 22px;border:1.5px solid #e3b25e;border-radius:23px;display:flex;align-items:center;gap:10px;font:700 22px/1 var(--cond);color:#fff3dc;cursor:pointer;background:linear-gradient(180deg,#a3213a 0%,#7a0f22 42%,#55071a 100%);box-shadow:0 0 0 1px rgba(255,236,190,.5),0 0 14px rgba(255,190,120,.7),inset 0 2px 3px rgba(255,170,180,.5)}",
    ".nd-new svg.i{font-size:26px;stroke-width:2.4}",
    /* ---- section cards like the broker card: wine ribbon header + blended photo + inline fields ---- */
    "#nd-fwin,#nd-fwin *,.nd-auth,.nd-auth *{-webkit-text-size-adjust:100%;text-size-adjust:100%}",
    "#nd-fwin .ndg{grid-column:1/-1;position:relative;margin:0 0 22px;border-radius:28px;overflow:hidden;padding:76px 0 20px;min-height:170px;background:linear-gradient(180deg,rgba(255,250,244,.97),rgba(252,238,226,.96));border:1.5px solid rgba(255,255,255,.95);box-shadow:0 0 0 1px rgba(226,176,120,.45),0 0 18px rgba(255,230,204,.95),0 8px 18px rgba(120,50,20,.18),inset 0 1px 0 #fff}",
    "#nd-fwin .ndg-h,#nd-fwin .ndsec>h3{position:absolute;left:-1px;top:-1px;height:60px;display:flex;align-items:center;gap:20px;margin:0;padding:0 70px 0 32px;color:#fff3dc;font:700 30px/1 var(--serif);white-space:nowrap;background:linear-gradient(100deg,#55071a 0%,#8d1530 45%,#b42446 70%,#7a1022 100%);border-radius:28px 0 60px 0;box-shadow:inset 0 2px 3px rgba(255,170,180,.45),0 3px 0 #e6b866,0 6px 12px rgba(60,5,15,.25);text-shadow:0 2px 3px rgba(30,0,8,.5);clip-path:polygon(0 0,100% 0,88% 100%,0 100%);width:auto;min-width:0}",
    "#nd-fwin .ndg-h svg.i,#nd-fwin .ndsec>h3 svg.i{font-size:36px;color:#fff1de;stroke-width:1.8}",
    "#nd-fwin .ndg-img{position:absolute;left:0;top:60px;bottom:0;width:210px;background-size:cover;background-position:center;-webkit-mask-image:linear-gradient(90deg,#000 55%,transparent 100%);mask-image:linear-gradient(90deg,#000 55%,transparent 100%)}",
    "#nd-fwin .ndg-f{position:relative;margin-left:200px;padding:0 24px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:16px 22px;align-items:center}",
    "#nd-fwin .ndg.noimg .ndg-f{margin-left:26px}",
    "#nd-fwin .ndg.one .ndg-f{grid-template-columns:1fr}",
    "#nd-fwin .ndg .ef{display:grid;grid-template-columns:var(--lw,128px) 1fr;align-items:center;gap:12px;margin:0;min-width:0}",
    "#nd-fwin .ndg .ef.wide{grid-column:1/-1}",
    "#nd-fwin .ndg .ef.top{align-items:start}",
    "#nd-fwin .ndg .el{margin:0;gap:10px;font:400 24px/1.1 var(--cond);color:#1f1111}",
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
  function num(id) { var v = get(id).replace(/\s/g, "").replace(",", "."); return v === "" ? null : Number(v); }

  function fit() {
    if (!W || W.hidden) return;
    var root = document.documentElement, desk = root.classList.contains("desk");
    if (desk) {
      var vw = root.clientWidth, dh = parseFloat(getComputedStyle(root).getPropertyValue("--dockH")) || 100, ah = innerHeight - dh - 14;
      var aw = full ? vw - 16 : Math.min(vw * 0.6, 1100), av = full ? ah - 8 : ah * 0.94, z = Math.min(aw / 1024, 1.1), w = 1024 * z, h = Math.min(av, (cv.offsetHeight || 1000) * z);
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
  function open(o) {
    if (!W) build();
    cur = o; last = document.activeElement;
    q("nd-f-title").textContent = o.title || "";
    q("nd-f-ic").innerHTML = '<use href="#' + (o.icon || "file-text") + '"/>';
    q("nd-f-photo").style.backgroundImage = o.photo ? "url(" + img(o.photo) + ")" : "none";
    q("nd-f-photo").style.display = o.photo ? "" : "none";
    q("nd-f-body").oninput = null; q("nd-f-body").innerHTML = o.html || "";
    q("nd-f-err").textContent = "";
    q("nd-f-del").hidden = !o.onDelete;
    var sv = q("nd-f-save"); sv.hidden = !!o.noSave; sv.querySelector("span").textContent = o.saveText || "Запази";
    q("nd-f-cancel").textContent = o.cancelText || (o.noSave ? "Затвори" : "Отказ");
    back.hidden = false; W.hidden = false; document.documentElement.classList.add("locked");
    fit(); scroll.scrollTop = 0;
    requestAnimationFrame(function () { back.classList.add("show"); W.classList.add("show"); fit(); });
    if (o.ready) o.ready({ q: q, get: get, num: num, body: q("nd-f-body"), refit: fit, rerender: function (h) { q("nd-f-body").innerHTML = h; if (o.ready2) o.ready2(); fit(); } });
    setTimeout(function () { var f = W.querySelector("#nd-f-body .in"); if (f && o.focus !== false && !matchMedia("(pointer:coarse)").matches) f.focus({ preventScroll: true }); }, 80);
    return { q: q, get: get, num: num, close: close, refit: fit };
  }
  function close() {
    if (!W || W.hidden) return;
    W.classList.remove("show"); back.classList.remove("show");
    var o = cur; cur = null;
    setTimeout(function () { W.hidden = true; back.hidden = true; setFull(false); }, 230);
    var other = document.querySelector(".mwin.show:not(#nd-fwin)");
    if (!other) document.documentElement.classList.remove("locked");
    if (o && o.onClose) o.onClose();
    if (last && last.focus) last.focus({ preventScroll: true });
  }

  /* section card: ribbon header, blended photo on the left, inline label/field rows */
  function group(title, icon, photo, inner, opts) {
    opts = opts || {};
    return '<div class="ndg' + (photo ? "" : " noimg") + (opts.one ? " one" : "") + '"' + (opts.lw ? ' style="--lw:' + opts.lw + 'px"' : "") + '><div class="ndg-h">' + ic(icon) + esc(title) + "</div>" +
      (photo ? '<div class="ndg-img" style="background-image:url(' + img(photo) + ')"></div>' : "") + '<div class="ndg-f">' + inner + "</div></div>";
  }
  function filebox(id, title, sub, opts) {
    opts = opts || {};
    return '<label class="ndfile" style="position:relative"><span class="row1">' + ic(opts.icon || "upload") + "<span" + (opts.nameId ? ' id="' + opts.nameId + '"' : "") + ">" + esc(title) + "</span></span><small>" + esc(sub || "Плъзнете файл тук или изберете от устройството") + '</small><input type="file" id="' + id + '"' + (opts.accept ? ' accept="' + opts.accept + '"' : "") + " multiple></label>";
  }
  /* list section in the same glass look */
  function section(title, icon, rows, empty) {
    return '<div class="ndsec"><h3>' + ic(icon) + esc(title) + "</h3>" + (rows && rows.length ? rows.join("") : '<div class="ndempty">' + esc(empty || "Няма записи.") + "</div>") + "</div>";
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
  window.NDUI = { open: open, close: close, fld: fld, section: section, row: row, esc: esc, ic: ic, img: img, money: money, bgDate: bgDate, bgDateTime: bgDateTime, boot: boot, bank: bank, group: group, filebox: filebox };
})();
