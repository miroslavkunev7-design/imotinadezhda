/* "Публикувай навсякъде": small window with a checklist of the places where a property is published –
   imotinadezhda.bg (exact city / settlement / neighbourhood page), the agency's Facebook page (connected with Facebook login),
   and the property portals (prepared text is copied and the portal's "new ad" page opens; the ad link is kept on the property). */
(function () {
  "use strict";
  var U = window.NDUI, D = window.ND;
  if (!U || !D) return;
  var esc = U.esc;
  /* [key, name, new-ad page, login page] – the login page is what "Свържи" opens */
  var PORTALS = [
    ["imotbg", "Имоти.бг", "https://www.imot.bg/pcgi/imot.cgi?act=11", "https://www.imot.bg/pcgi/imot.cgi?act=5"],
    ["olx", "OLX.bg", "https://www.olx.bg/adding/", "https://www.olx.bg/account/"],
    ["alo", "Alo.bg", "https://www.alo.bg/users/addnew", "https://www.alo.bg/users/login"],
    ["bazar", "Bazar.bg", "https://bazar.bg/obiava/dobavi", "https://bazar.bg/login"],
    ["homes", "Homes.bg", "https://www.homes.bg/", "https://www.homes.bg/login"],
    ["imotinet", "Imoti.net", "https://www.imoti.net/bg/", "https://www.imoti.net/bg/login"],
    ["address", "Address.bg", "https://address.bg/", "https://address.bg/login"]
  ];
  var CONN = null; /* connected portals (nd_prefs "portals") */
  function loadConn() { return CONN ? Promise.resolve(CONN) : D.pref("portals", {}).then(function (c) { CONN = c || {}; return CONN; }); }
  function saveConn() { return D.setPref("portals", CONN || {}).catch(function () {}); }
  var css = ".ndp-l{display:grid;gap:10px}.ndp-r{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:44px 1fr auto;gap:4px 14px;align-items:center;padding:14px 18px;border-radius:22px;background:linear-gradient(180deg,#fffdf9,#fbefe5);box-shadow:0 0 0 1.5px rgba(227,178,94,.6),0 0 12px rgba(255,226,190,.7)}" +
    ".ndp-r:before{content:'';position:absolute;top:0;right:0;bottom:0;width:50%;z-index:-1;background:var(--ph) center/cover;opacity:.55;-webkit-mask-image:linear-gradient(270deg,#000 30%,transparent);mask-image:linear-gradient(270deg,#000 30%,transparent)}" +
    ".ndp-r input[type=checkbox]{width:30px;height:30px;accent-color:#7a0f22}.ndp-r b{font:700 25px/1.1 var(--serif);color:#690608}.ndp-r small{display:block;font:400 19px/1.3 var(--cond);color:#6b4a40;margin-top:3px}" +
    ".ndp-r .st{font:700 18px var(--cond);padding:4px 12px;border-radius:14px;white-space:nowrap}.ndp-r .st.ok{color:#fff;background:linear-gradient(#83b93b,#3b7c0b 60%,#286900)}.ndp-r .st.no{color:#8a4b00;background:linear-gradient(#fff6d6,#ffe39a)}" +
    ".ndp-r .lk{grid-column:2/4;display:none;gap:8px}.ndp-r.on .lk{display:flex}.ndp-r{padding:10px 16px!important}.ndp-r small{font-size:17px!important}.ndp-r b{font-size:23px!important}.ndp-r .lk input{flex:1;height:44px;border-radius:14px;border:1.5px solid #e3b25e;background:#fffdfa;padding:0 12px;font:20px var(--cond)}" +
    ".ndp-b{height:44px;padding:0 16px;border-radius:14px;border:1.5px solid #edc47a;background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);color:#fff3dc;font:700 19px var(--cond);cursor:pointer;white-space:nowrap}.ndp-b.alt{background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;border-color:#e3b25e}" +
    ".ndp-b.fb{background:linear-gradient(180deg,#3b6fd8,#1f4fb0);border-color:#9fc0ff}.ndp-b.sm{height:38px;padding:0 14px;font-size:17px}.ndp-b.alt{background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;border-color:#e3b25e}.ndp-ac{display:flex;align-items:center;gap:8px}.ndp-r.conn{box-shadow:0 0 0 1.5px rgba(59,124,11,.45),0 0 10px rgba(131,185,59,.35)}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  function tok() { return D.token(); }
  function fb(body) { return tok().then(function (t) { return fetch("/api/fb", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(body) }); }).then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); }); }
  function where(p) {
    var parts = [];
    if (p.place && p.place !== p.city) parts.push((p.city ? "обл. " + p.city + " → " : "") + p.place);
    else if (p.city) parts.push(p.city);
    if (p.hood) parts.push("кв. " + p.hood);
    return parts.join(" → ") || "няма посочено място";
  }
  /* the public page of a property, in its city (phone and desktop versions of the site) */
  function siteUrl(p) {
    var slug = { "Шумен": "shumen", "Варна": "varna", "Бургас": "burgas" }[p.city] || "shumen";
    return "/mobile/ilj.html#/property/" + encodeURIComponent(p.id) + "/" + slug;
  }
  function adText(p) {
    return [(p.title || p.type || "Имот") + " – " + where(p).replace(/ → /g, ", "),
      p.price ? "Цена: " + U.money(p.price) + " €" + (p.deal === "rent" ? " / мес." : "") : "",
      [p.area ? p.area + " м²" : "", p.rooms ? p.rooms + " стаи" : "", p.floor ? "етаж " + p.floor : "", p.build || "", p.year ? p.year + " г." : ""].filter(Boolean).join(", "),
      "", p.desc || "", "", "За оглед: 0898 977 370 – Недвижими Имоти Надежда", "Номер на обявата: " + (p.code || "")].filter(function (x, i, a) { return x !== "" || a[i - 1] !== ""; }).join("\n");
  }
  var fbCfg = null;
  function loadFbSdk(appId) {
    return new Promise(function (ok, bad) {
      if (window.FB) return ok();
      window.fbAsyncInit = function () { window.FB.init({ appId: appId, cookie: true, xfbml: false, version: "v21.0" }); ok(); };
      var s = document.createElement("script"); s.src = "https://connect.facebook.net/bg_BG/sdk.js"; s.async = true; s.onerror = function () { bad(new Error("Facebook не се зарежда")); }; document.head.appendChild(s);
    });
  }
  function connectFb(done) {
    if (!fbCfg || !fbCfg.appId) { D.say("Нужно е Facebook приложение – вижте указанието в прозореца"); return; }
    loadFbSdk(fbCfg.appId).then(function () {
      window.FB.login(function (r) {
        if (!r.authResponse) { D.say("Входът във Facebook е отказан"); return; }
        fb({ action: "connect", userToken: r.authResponse.accessToken }).then(function (j) {
          if (!j.ok) { D.say(j.error || "Грешка"); return; }
          var pages = j.pages || []; if (!pages.length) { D.say("Профилът няма Facebook страници"); return; }
          var pick = pages.length === 1 ? pages[0] : null;
          if (!pick) { var names = pages.map(function (p, i) { return (i + 1) + ". " + p.name; }).join("\n"); var n = parseInt(window.prompt("Изберете страницата на агенцията (номер):\n" + names, "1"), 10); pick = pages[n - 1]; }
          if (!pick) return;
          fb({ action: "select", pageId: pick.id }).then(function (s) { if (s.ok) { fbCfg.page = s.page; D.say("Свързана страница: " + s.page.name); done(); } else D.say(s.error || "Грешка"); });
        });
      }, { scope: "pages_show_list,pages_manage_posts,pages_read_engagement" });
    }).catch(function (e) { D.say(e.message); });
  }
  function open(p, h) {
    h = h || {};
    p.portals = p.portals || {};
    var ctx;
    function rowsHtml() {
      var site = p.status === "Публикуван", fp = fbCfg && fbCfg.page, fbDone = p.portals.facebook;
      return '<div class="ndp-l">' +
        '<label class="ndp-r" style="--ph:url(' + U.img("nd/ph07.jpg") + ')"><input type="checkbox" data-pc="site" ' + (site ? "" : "checked") + '><span><b>imotinadezhda.bg</b><small>Отива точно на страницата: ' + esc(where(p)) + "</small></span>" + (site ? '<span class="st ok">Публикуван</span>' : '<span class="st no">Не е</span>') + "</label>" +
        '<div class="ndp-r" style="--ph:url(' + U.img("nd/ph18.jpg") + ')"><input type="checkbox" data-pc="facebook" ' + (fp && !fbDone ? "checked" : "") + (fp ? "" : " disabled") + '><span><b>Facebook страница</b><small>' +
          (fp ? "Свързана: " + esc(fp.name) : fbCfg && fbCfg.appId ? "Не е свързана – натиснете „Свържи Facebook“" : "За автоматично публикуване е нужно Facebook приложение (App ID) – пишете на администратора") + "</small></span>" +
          (fbDone ? '<a class="st ok" href="' + esc(fbDone.link || "#") + '" target="_blank" rel="noopener">Публикуван</a>' : fp && fbCfg.via === "n8n" ? '<span class="st no">Не е</span>' : fp ? '<button type="button" class="ndp-b alt" data-fbx>Прекъсни</button>' : '<button type="button" class="ndp-b fb" data-fbc' + (fbCfg && fbCfg.appId ? "" : " disabled") + ">Свържи Facebook</button>") + "</div>" +
        PORTALS.map(function (x, i) {
          var d = p.portals[x[0]];
          var con = CONN && CONN[x[0]];
          return '<div class="ndp-r' + (d ? " on" : "") + (con ? " conn" : "") + '" style="--ph:url(' + U.img("nd/ph" + ("0" + ((i * 3) % 20 + 1)).slice(-2) + ".jpg") + ')"><input type="checkbox" data-pc="' + x[0] + '"' + (con && !d ? " checked" : "") + "><span><b>" + esc(x[1]) + "</b><small>" + (d ? "Публикувана на " + esc(U.bgDate(d.at)) : con ? "Свързан профил · при публикуване се отваря формата за нова обява с готовия текст" : "Не е свързан – натиснете „Свържи“, влезте в профила си и той остава свързан") + "</small></span>" +
            '<span class="ndp-ac">' + (con ? '<button type="button" class="ndp-b alt sm" data-pdx="' + x[0] + '">Изключи</button>' : '<button type="button" class="ndp-b sm" data-pcn="' + x[0] + '">Свържи</button>') + (d ? '<span class="st ok">Публикуван</span>' : '<span class="st no">Не е</span>') + "</span>" +
            '<div class="lk"><input type="url" data-pl="' + x[0] + '" placeholder="линк към обявата в ' + esc(x[1]) + '" value="' + esc((d && d.link) || "") + '"></div></div>';
        }).join("") + "</div>";
    }
    U.open({ title: "Публикувай навсякъде – " + (p.code || ""), icon: "megaphone", photo: "nd/ph11.jpg", saveText: "Публикувай избраните",
      html: U.group("Къде да се публикува", "megaphone", null, '<div class="wide" id="ndp-box">Зареждане…</div>', { one: true }),
      ready: function (x) {
        ctx = x;
        Promise.all([fb({ action: "config" }).then(function (c) { fbCfg = c && c.ok ? c : { appId: null }; }).catch(function () { fbCfg = { appId: null }; }), loadConn()]).then(function () { var b = ctx.q("ndp-box"); if (b) b.innerHTML = rowsHtml(); if (ctx.refit) setTimeout(ctx.refit, 30); });
        ctx.body.addEventListener("change", function (e) { var c = e.target.closest("[data-pc]"); if (c) { var r = c.closest(".ndp-r"); if (r && r.querySelector(".lk")) { r.classList.toggle("on", c.checked || !!r.querySelector("[data-pl]").value); if (ctx.refit) ctx.refit(); } } });
        ctx.body.addEventListener("click", function (e) {
          if (e.target.closest("[data-fbc]")) { e.preventDefault(); connectFb(function () { ctx.q("ndp-box").innerHTML = rowsHtml(); if (ctx.refit) ctx.refit(); }); }
          var cn = e.target.closest("[data-pcn]"), dx = e.target.closest("[data-pdx]");
          if (cn) { e.preventDefault(); var k = cn.getAttribute("data-pcn"), px = PORTALS.filter(function (x) { return x[0] === k; })[0]; window.open(px[3] || px[2], "_blank", "noopener"); CONN[k] = { at: new Date().toISOString() }; saveConn(); ctx.q("ndp-box").innerHTML = rowsHtml(); if (ctx.refit) ctx.refit(); D.say("Влезте в профила си в " + px[1] + " – остава свързан"); return; }
          if (dx) { e.preventDefault(); delete CONN[dx.getAttribute("data-pdx")]; saveConn(); ctx.q("ndp-box").innerHTML = rowsHtml(); if (ctx.refit) ctx.refit(); return; }
          if (e.target.closest("[data-fbx]")) { e.preventDefault(); fb({ action: "disconnect" }).then(function () { fbCfg.page = null; ctx.q("ndp-box").innerHTML = rowsHtml(); D.say("Facebook страницата е изключена"); }); }
        });
      },
      onSave: function () {
        var b = ctx.body, chk = function (k) { var el = b.querySelector('[data-pc="' + k + '"]'); return el && el.checked && !el.disabled; };
        [].forEach.call(b.querySelectorAll("[data-pl]"), function (el) { var k = el.getAttribute("data-pl"); if (el.value.trim()) p.portals[k] = Object.assign({ at: new Date().toISOString() }, p.portals[k], { link: el.value.trim() }); });
        var jobs = Promise.resolve(), text = adText(p), opened = 0;
        if (chk("site")) { var w = window.open("", "_blank"); jobs = jobs.then(function () { return h.publishSite ? h.publishSite() : null; }).then(function () { if (w) w.location = siteUrl(p); }, function (e) { if (w) w.close(); throw e; }); }
        if (chk("facebook")) jobs = jobs.then(function () { return fb({ action: "post", id: p.id }).then(function (r) { if (r.ok) { p.portals.facebook = { at: new Date().toISOString(), link: r.link }; D.say("Публикувано във Facebook (" + r.photos + " снимки)"); } else D.say(r.error || "Facebook: грешка"); }); });
        PORTALS.forEach(function (x) { if (chk(x[0])) { opened++; try { navigator.clipboard.writeText(text); } catch (e) {} window.open(x[2], "_blank"); if (!p.portals[x[0]]) p.portals[x[0]] = { at: new Date().toISOString(), link: "" }; } });
        if (opened) D.say("Текстът на обявата е копиран – поставете го в отворените страници");
        return jobs.then(function () { return h.save ? h.save({ portals: p.portals }) : null; });
      } });
  }
  /* Facebook страницата: директно публикуване и синхрон (архив/сваляне → скрит пост, публикуване → видим, изтриване → изтрит) */
  function fbPost(id, force) { return fb({ action: "post", id: id, force: !!force }); }
  function fbSync(o, op) {
    var pid = o && o.fb && o.fb.post_id;
    if (!pid) return Promise.resolve(null);
    return fb({ action: "sync", op: op, postId: pid }).then(function (r) { if (r && !r.ok) D.say(r.error || "Facebook: грешка"); return r; }).catch(function () { return null; });
  }
  window.NDPublish = { open: open, where: where, adText: adText, siteUrl: siteUrl, fbPost: fbPost, fbSync: fbSync };
})();
