/* Тед skill #2 "Събиране на имоти и клиенти": reads public listing pages (Имоти.бг, OLX, Alo, Bazar, …) and pasted
   posts / screenshots from Facebook groups, keeps only private ads without agencies (by the keywords), with phone (+ photos for
   properties), and people who search or offer in comments. Results are kept in nd_collected; "Запамети в архив" moves them
   into Имоти (status Архивиран) or Клиенти (Търси / Продава се). */
(function () {
  "use strict";
  var D = window.ND, A = window.NDAsh, U = window.NDUI;
  if (!D || !A || !U) return;
  var esc = A.esc;
  var running = false, stopFlag = false, items = [], settings = { sites: "", keywords: "без посредник, от собственик, без комисионна, лично", props: true, clients: true };
  var css =
    ".ndc-set{display:grid;gap:8px;padding:10px 12px 12px;border-radius:18px;background:linear-gradient(160deg,rgba(255,250,246,.97),rgba(251,236,224,.94));border:1px solid rgba(227,178,94,.75);box-shadow:0 0 10px rgba(255,214,150,.4);align-self:stretch;position:relative;overflow:hidden;isolation:isolate}" +
    ".ndc-set:after{content:'';position:absolute;right:0;top:0;bottom:0;width:50%;background:url(/mobile/crm/assets/nd/ph15.jpg) center/cover;opacity:.35;z-index:-1;-webkit-mask-image:linear-gradient(270deg,#000 25%,transparent);mask-image:linear-gradient(270deg,#000 25%,transparent)}" +
    ".ndc-set label{font:700 13px 'Roboto Condensed',Arial,sans-serif;color:#6b0a1c}.ndc-set textarea,.ndc-set input[type=text]{width:100%;box-sizing:border-box;border-radius:12px;border:1.5px solid #e3b25e;background:rgba(255,253,250,.95);padding:8px 10px;font:15px/1.3 'Roboto Condensed',Arial,sans-serif;color:#3a0c12}" +
    ".ndc-set textarea{min-height:70px;resize:vertical}.ndc-chk{display:flex;gap:14px;font:600 14px 'Roboto Condensed',Arial,sans-serif;color:#3a0c12}.ndc-chk input{accent-color:#7a0f22;width:18px;height:18px;vertical-align:middle}" +
    ".ndc-it{align-self:stretch;display:grid;grid-template-columns:86px 1fr;gap:10px;padding:9px;border-radius:16px;background:linear-gradient(180deg,#fffdf9,#fbefe5);border:1px solid rgba(227,178,94,.75);box-shadow:0 0 8px rgba(255,214,150,.4);font:14px/1.3 'Roboto Condensed',Arial,sans-serif;color:#3a0c12}" +
    ".ndc-it .ph{width:86px;height:86px;border-radius:12px;background:#f1e2d2 center/cover;display:grid;place-items:center;color:#8d1530;font-weight:700;font-size:12px;text-align:center}" +
    ".ndc-it b{display:block;font-size:15px;color:#4e0912}.ndc-it .mt{color:#6b4a40;font-size:13px}.ndc-it .tg{display:inline-block;padding:1px 8px;border-radius:9px;font-size:11.5px;font-weight:700;color:#fff3dc;background:linear-gradient(180deg,#b42446,#7a0f22);margin-right:4px}" +
    ".ndc-it .tg.g{background:linear-gradient(180deg,#4f9a2a,#2b6a10)}.ndc-it .tg.o{background:linear-gradient(180deg,#e0a02c,#b0730e)}" +
    ".ndc-it .ac{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap}.ndc-it .ac button,.ndc-it .ac a{flex:1;min-width:84px;height:34px;border-radius:12px;border:1.5px solid #e3b25e;background:linear-gradient(180deg,#fffcf9,#fbefe5);color:#6b0a1c;font:700 13px 'Roboto Condensed',Arial,sans-serif;display:grid;place-items:center;text-decoration:none;cursor:pointer}" +
    ".ndc-it .ac .sv{background:linear-gradient(180deg,#b42446,#7a0f22 55%,#4f0716);color:#fff3dc;border-color:#edc47a}.ndc-it .ac .sv:disabled{opacity:.6}" +
    ".ndc-f{grid-template-columns:repeat(4,1fr)!important}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var I = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    paste: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>'
  };
  function n(v) { return v == null || v === "" ? "" : new Intl.NumberFormat("bg-BG").format(v); }
  function norm(t) { return String(t || "").toLowerCase().replace(/[^a-zа-я0-9]+/gi, " ").trim().slice(0, 120); }
  function dupKey(x) { return String(x.phone || "").split(",")[0].trim() + "|" + norm(x.text || x.title); }
  function loadAll() {
    return D.ready().then(function () { return D.load("collected"); }).then(function (l) {
      var s = l.filter(function (x) { return x.kind === "settings"; })[0]; if (s) settings = Object.assign(settings, s);
      items = l.filter(function (x) { return x.kind !== "settings"; }).sort(function (a, b) { return String(b.collected_at).localeCompare(String(a.collected_at)); });
    }).catch(function () {});
  }
  function saveSettings() { settings.kind = "settings"; settings.id = "settings"; return D.put("collected", settings).catch(function () {}); }
  function tok() { return D.token(); }
  function call(body) {
    return tok().then(function (t) { return fetch("/api/collect", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify(body) }); })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); });
  }
  function label(x) { return x.kind === "wanted" ? '<span class="tg o">Търси</span>' : x.kind === "seller" ? '<span class="tg o">Продава се</span>' : '<span class="tg">Имот</span>'; }
  function card(x, i) {
    var meta = [x.city, x.hood].filter(Boolean).join(", "), meta2 = [x.type, x.area ? x.area + " м²" : "", x.floor ? "ет. " + x.floor : ""].filter(Boolean).join(" · ");
    return '<div class="nda-m a ndc-it" data-ci="' + esc(x.id) + '"><span class="ph" style="' + (x.photos && x.photos[0] ? "background-image:url(" + esc(x.photos[0]) + ")" : "") + '">' + (x.photos && x.photos[0] ? "" : (x.kind === "property" ? "без снимка" : "клиент")) + "</span><span>" +
      "<span>№ " + (items.length - i) + " " + label(x) + (x.saved ? '<span class="tg g">В архив</span>' : "") + "</span><b>" + esc(x.title || x.wants || "Обява") + "</b>" +
      '<span class="mt">' + esc(meta) + (meta2 ? " · " + esc(meta2) : "") + "</span><br>" + (x.price ? "<b>" + n(x.price) + " €</b>" : "") +
      '<span class="mt">☎ <a href="tel:' + esc(String(x.phone || "").split(",")[0].replace(/\s/g, "")) + '">' + esc(x.phone) + "</a>" + (x.name ? " · " + esc(x.name) : "") + "</span><br>" +
      '<span class="mt">' + esc(x.source || "") + " · " + esc(U.bgDate(x.collected_at)) + "</span></span>" +
      '<span class="ac"><button type="button" data-cv="' + esc(x.id) + '">Преглед</button><button type="button" data-ce="' + esc(x.id) + '">Редактирай</button>' +
      (x.link ? '<a href="' + esc(x.link) + '" target="_blank" rel="noopener">Линк</a>' : "") + '<button type="button" class="sv" data-cs="' + esc(x.id) + '"' + (x.saved ? " disabled" : "") + ">" + (x.saved ? "Запаметено" : "Запамети в архив") + "</button></span></div>";
  }
  var api0 = null;
  function showList(api) {
    [].forEach.call(api.list().querySelectorAll(".ndc-it,.ndc-hd"), function (e) { e.remove(); });
    var h = api.add("a", "<b>Събрани (" + items.length + ")</b> – имоти: " + items.filter(function (x) { return x.kind === "property"; }).length + ", търсят: " + items.filter(function (x) { return x.kind === "wanted"; }).length + ", продават (без снимки): " + items.filter(function (x) { return x.kind === "seller"; }).length);
    h.classList.add("ndc-hd");
    var html = items.slice(0, 120).map(card).join("");
    var box = document.createElement("div"); box.innerHTML = html;
    while (box.firstChild) api.list().appendChild(box.firstChild);
    api.list().scrollTop = api.list().scrollHeight;
  }
  function byId(id) { return items.filter(function (x) { return x.id === id; })[0]; }
  function view(x) {
    if (A.hide) A.hide();
    U.open({ title: x.title || "Обява", icon: "eye", photo: "nd/ph07.jpg", saveText: "Затвори",
      html: U.group("Обява", "file-text", null, '<div class="wide" style="font:400 22px/1.45 var(--cond);white-space:pre-line">' + esc((x.wants ? "Търси: " + x.wants + "\n\n" : "") + (x.text || "")) + "</div>" +
        '<div class="wide" style="font:400 20px/1.4 var(--cond)">' + esc([x.city, x.hood, x.type, x.area ? x.area + " м²" : "", x.floor, x.price ? n(x.price) + " €" : "", "☎ " + x.phone, x.name, x.source].filter(Boolean).join(" · ")) + (x.link ? '<br><a href="' + esc(x.link) + '" target="_blank" rel="noopener">' + esc(x.link) + "</a>" : "") + "</div>", { one: true }) +
        (x.photos && x.photos.length ? U.group("Снимки (" + x.photos.length + ")", "camera", null, '<div class="ndphotos">' + x.photos.map(function (u) { return '<div class="ph" style="background-image:url(' + esc(u) + ')"></div>'; }).join("") + "</div>", { one: true }) : ""),
      onSave: function () { if (A.show) A.show(); } });
  }
  function edit(x) {
    if (A.hide) A.hide();
    var f = U.fld;
    U.open({ title: "Редакция – " + (x.title || "обява"), icon: "square-pen", photo: "nd/ph05.jpg", saveText: "Запази",
      html: U.group("Данни", "house", null,
        f({ id: "c-title", label: "Заглавие", icon: "house", value: x.title, wide: true }) + f({ id: "c-kind", label: "Тип", icon: "tag", type: "select", value: x.kind, options: [["property", "Имот"], ["wanted", "Търси"], ["seller", "Продава се"]] }) +
        f({ id: "c-deal", label: "Сделка", icon: "tag", type: "select", value: x.deal, options: [["sale", "Продажба"], ["rent", "Наем"]] }) +
        f({ id: "c-type", label: "Вид имот", icon: "house", value: x.type }) + f({ id: "c-city", label: "Град", icon: "pin", value: x.city }) + f({ id: "c-hood", label: "Квартал", icon: "pin", value: x.hood }) +
        f({ id: "c-area", label: "Площ м²", icon: "m2", value: x.area, type: "number" }) + f({ id: "c-floor", label: "Етаж", icon: "building-2", value: x.floor }) +
        f({ id: "c-price", label: "Цена €", icon: "coins", value: x.price, type: "number" }) + f({ id: "c-phone", label: "Телефон", icon: "phone", value: x.phone }) +
        f({ id: "c-name", label: "Име", icon: "user", value: x.name }) + f({ id: "c-wants", label: "Какво търси / предлага", icon: "sparkles", value: x.wants, wide: true }) +
        f({ id: "c-text", label: "Текст", icon: "file-text", value: x.text, type: "ta", wide: true }), { lw: 140 }),
      onSave: function (g) {
        var num = function (id) { var v = g(id).replace(/\s/g, "").replace(",", "."); return v === "" ? null : Number(v); };
        Object.assign(x, { title: g("c-title"), kind: g("c-kind"), deal: g("c-deal"), type: g("c-type"), city: g("c-city"), hood: g("c-hood"), area: num("c-area"), floor: g("c-floor"), price: num("c-price"), phone: g("c-phone"), name: g("c-name"), wants: g("c-wants"), text: g("c-text") });
        return D.put("collected", x).then(function () { D.say("Записано"); if (A.show) A.show(); if (api0) showList(api0); });
      } });
  }
  function archive(x, btn) {
    btn.disabled = true; btn.textContent = "Записване…";
    var P = window.NDPlaces, city = P ? P.city(x.city) : x.city, hood = P ? P.hood(city, x.hood) : x.hood;
    var done = function (what) { x.saved = true; x.saved_as = what; return D.put("collected", x).then(function () { D.say(what === "property" ? "Имотът е в архива на Имоти" : "Клиентът е записан в Клиенти"); if (api0) showList(api0); }); };
    var p;
    if (x.kind === "property") {
      var code = "C-" + Date.now().toString(36).toUpperCase();
      p = call({ action: "photos", code: code, urls: x.photos || [] }).then(function (r) {
        return D.put("properties", { code: code, title: x.title || ((x.type || "Имот") + (city ? ", " + city : "")), deal: x.deal || "sale", type: x.type || "Апартамент", price: x.price, area: x.area, rooms: x.rooms, floor: x.floor,
          city: city, region: city, hood: hood, client: x.name || "", ownerPhone: x.phone, privDesc: (x.text || "") + (x.link ? "\nИзточник: " + x.link : ""), desc: "", status: "Архивиран",
          source: x.source, sourceLink: x.link, pics: (r && r.paths) || [], docs: [], log: [{ icon: "archive", text: "Събран от " + (x.source || "интернет") + " (без посредник)", at: new Date().toISOString() }] });
      }).then(function () { return done("property"); });
    } else {
      p = D.put("clients", { name: x.name || ("Клиент – " + (x.source || "интернет")), phone: String(x.phone || "").split(",")[0].trim(), cat: x.deal === "rent" ? "rent" : "sales", type: x.type || "Апартамент", city: city, hood: hood, budget: x.kind === "wanted" ? x.price : null,
        status: "Потенциален", source: /facebook/i.test(x.source || "") ? "Facebook" : /имоти\.бг|imot/i.test(x.source || "") ? "Imot.bg" : /olx/i.test(x.source || "") ? "OLX" : "Друго",
        leadType: x.kind === "wanted" ? "Търси" : "Продава се", leadSource: x.source, leadLink: x.link,
        notes: (x.kind === "wanted" ? "Търси: " : "Предлага: ") + (x.wants || x.title || "") + "\n" + (x.text || "") + "\nОткъде: " + (x.source || "") + (x.link ? " – " + x.link : ""), contact_at: new Date().toISOString() }).then(function () { return done("client"); });
    }
    p.catch(function (e) { btn.disabled = false; btn.textContent = "Запамети в архив"; D.say("Грешка: " + ((e && e.message) || e)); });
  }
  function addFound(api, list) {
    var keys = {}; items.forEach(function (x) { keys[dupKey(x)] = 1; });
    var fresh = list.filter(function (x) { var k = dupKey(x); if (keys[k]) return false; keys[k] = 1; return true; });
    return fresh.reduce(function (pr, x) { return pr.then(function () { return D.put("collected", x).then(function (s) { items.unshift(s); }); }); }, Promise.resolve()).then(function () { return fresh.length; });
  }
  function runAll(api, startBtn) {
    var kw = (settings.keywords || "").split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!kw.length) { api.add("a", "⚠ Въведете поне една ключова дума – без нея събирането не стартира."); return; }
    var urls = (settings.sites || "").split(/\s+/).map(function (s) { return s.trim(); }).filter(function (s) { return /^https?:\/\//.test(s); });
    if (!urls.length) { api.add("a", "⚠ Добавете поне един линк към сайт с обяви или група (по един на ред). За пост от Facebook използвайте „Постави пост“."); return; }
    running = true; stopFlag = false; startBtn.disabled = true;
    var queue = urls.map(function (u) { return { url: u, depth: 0, root: u }; }), seen = {}, perRoot = {}, total = 0, log = api.add("a", "▶ Събиране… 0 страници", "wait");
    var pages = 0;
    function next() {
      if (stopFlag || !queue.length || pages >= 60) {
        running = false; startBtn.disabled = false; log.classList.remove("wait");
        log.textContent = (stopFlag ? "■ Спряно." : "✔ Готово.") + " Прегледани страници: " + pages + ", нови записи: " + total + ".";
        showList(api); return;
      }
      var q = queue.shift(); if (seen[q.url]) return next(); seen[q.url] = 1; pages++;
      log.textContent = "▶ " + pages + ": " + q.url.replace(/^https?:\/\//, "").slice(0, 60) + "…";
      call({ url: q.url, keywords: kw, properties: settings.props, clients: settings.clients }).then(function (r) {
        if (!r.ok) { api.add("a", "• " + esc(q.url.replace(/^https?:\/\//, "").slice(0, 50)) + ": " + esc(r.reason || r.error || "грешка")); return; }
        perRoot[q.root] = (perRoot[q.root] || 0) + 1;
        var host = ""; try { host = new URL(q.root).hostname; } catch (e) {}
        if (q.depth === 0) {
          (r.detailLinks || []).slice(0, 20).forEach(function (u) { try { if (new URL(u).hostname === host) queue.push({ url: u, depth: 1, root: q.root }); } catch (e) {} });
          if (r.nextPage && (perRoot[q.root + "#p"] = (perRoot[q.root + "#p"] || 0) + 1) <= 3) queue.push({ url: r.nextPage, depth: 0, root: q.root });
        }
        return addFound(api, r.items || []).then(function (k) { total += k; if (k) api.add("a", "• " + esc(r.title || q.url).slice(0, 70) + ": +" + k + " (агенции пропуснати: " + ((r.skipped || {}).agency || 0) + ", без телефон: " + ((r.skipped || {}).noPhone || 0) + ")"); });
      }).catch(function (e) { api.add("a", "• Грешка: " + esc((e && e.message) || e)); }).then(function () { setTimeout(next, 400); });
    }
    next();
  }
  function paste(api) {
    if (A.hide) A.hide();
    var kw = (settings.keywords || "").split(/[,;\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
    U.open({ title: "Постави пост / коментари", icon: "file-text", photo: "nd/ph11.jpg", saveText: "Анализирай",
      html: U.group("Пост от група (Facebook и др.)", "message-square", null,
        U.fld({ id: "p-src", label: "Откъде", icon: "globe", value: "Facebook", list: "p-srcs" }) + '<datalist id="p-srcs"><option value="Facebook"><option value="Имоти.бг"><option value="OLX"><option value="Viber група"><option value="Друг сайт"></datalist>' +
        U.fld({ id: "p-link", label: "Линк към поста", icon: "link", value: "" }) +
        U.fld({ id: "p-text", label: "Текст на поста и коментарите", icon: "file-text", type: "ta", wide: true, ph: "Копирайте целия пост и коментарите…" }) +
        U.filebox("p-shots", "Снимки на екрана (по избор)", "до 4 снимки на поста", { icon: "image", accept: "image/*" }), { one: true, lw: 150 }),
      onSave: function (g) {
        if (!kw.length) { D.say("Въведете ключова дума в настройките"); return false; }
        var fl = document.getElementById("p-shots"), files = fl && fl.files ? [].slice.call(fl.files, 0, 4) : [];
        return Promise.all(files.map(function (f) { return new Promise(function (ok) { var r = new FileReader(); r.onload = function () { var im = new Image(); im.onload = function () { var k = Math.min(1, 1400 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = im.width * k; c.height = im.height * k; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok({ mime: "image/jpeg", data: c.toDataURL("image/jpeg", .85).split(",")[1] }); }; im.onerror = function () { ok(null); }; im.src = r.result; }; r.readAsDataURL(f); }); }))
          .then(function (shots) {
            if (A.show) A.show(); var w = api.add("a", "Анализирам поста", "wait");
            return call({ text: g("p-text"), url: "", shots: shots.filter(Boolean), keywords: kw, source: g("p-src") || "Facebook", properties: settings.props, clients: settings.clients }).then(function (r) {
              w.classList.remove("wait");
              if (!r.ok) { w.textContent = r.error || "Грешка"; return; }
              (r.items || []).forEach(function (x) { if (g("p-link")) x.link = g("p-link"); x.source = g("p-src") || "Facebook"; });
              return addFound(api, r.items || []).then(function (k) { w.textContent = "✔ Намерени нови: " + k + " (агенции пропуснати: " + ((r.skipped || {}).agency || 0) + ", без телефон: " + ((r.skipped || {}).noPhone || 0) + ", без ключова дума: " + ((r.skipped || {}).noKeyword || 0) + ")"; showList(api); });
            });
          });
      } });
  }

  A.addSkill({
    id: "collect", name: "Събиране на имоти и клиенти", sub: "Частни обяви без посредник и клиенти от групи и сайтове", embed: true, icon: "🔎", order: 2,
    intro: function (api) {
      api0 = api;
      var box = api.add("a", "<b>Събиране на имоти и клиенти</b>\nЧета публичните страници, които посочите, и пазя само обяви от собственици (без агенции) с телефон и снимки, както и хора, които търсят или предлагат в коментари. Facebook групите изискват вход – копирайте поста през „Постави пост“.");
      var set = document.createElement("div"); set.className = "ndc-set";
      set.innerHTML = '<label>Сайтове и групи (по един линк на ред)</label><textarea id="ndc-sites" placeholder="https://www.imot.bg/obiavi/prodazhbi/grad-shumen\nhttps://www.olx.bg/nedvizhimi-imoti/shumen/\nhttps://www.facebook.com/groups/…"></textarea>' +
        '<label>Ключови думи * (задължително)</label><input type="text" id="ndc-kw" placeholder="без посредник, от собственик, без комисионна">' +
        '<div class="ndc-chk"><label><input type="checkbox" id="ndc-p"> Имоти</label><label><input type="checkbox" id="ndc-c"> Клиенти (търсят / продават)</label></div>';
      api.list().appendChild(set);
      var sites = set.querySelector("#ndc-sites"), kw = set.querySelector("#ndc-kw"), cp = set.querySelector("#ndc-p"), cc = set.querySelector("#ndc-c");
      function fill() { sites.value = settings.sites || ""; kw.value = settings.keywords || ""; cp.checked = settings.props !== false; cc.checked = settings.clients !== false; }
      fill();
      [sites, kw, cp, cc].forEach(function (el) { el.addEventListener("change", function () { settings.sites = sites.value; settings.keywords = kw.value; settings.props = cp.checked; settings.clients = cc.checked; saveSettings(); }); });
      loadAll().then(function () { fill(); if (items.length) showList(api); });
    },
    footer: function () {
      return '<div class="nda-f ndc-f"><button type="button" data-a="start"><span class="ib">' + I.play + '</span>Старт</button><button type="button" data-a="stop"><span class="ib">' + I.stop + '</span>Стоп</button>' +
        '<button type="button" data-a="paste"><span class="ib">' + I.paste + '</span>Постави пост</button><button type="button" data-a="list"><span class="ib">' + I.list + "</span>Събрани</button></div>";
    },
    bind: function (api, el) {
      api0 = api;
      el.querySelector(".nda-f").onclick = function (e) {
        var b = e.target.closest("[data-a]"); if (!b) return; var a = b.getAttribute("data-a");
        if (a === "start") { if (!running) runAll(api, b); }
        else if (a === "stop") { if (running) { stopFlag = true; D.say("Спирам след текущата страница"); } }
        else if (a === "paste") paste(api);
        else if (a === "list") loadAll().then(function () { showList(api); });
      };
      if (api.list()._ndc) return; api.list()._ndc = true;
      api.list().addEventListener("click", function (e) {
        var v = e.target.closest("[data-cv]"), ed = e.target.closest("[data-ce]"), sv = e.target.closest("[data-cs]");
        if (v) view(byId(v.getAttribute("data-cv")));
        if (ed) edit(byId(ed.getAttribute("data-ce")));
        if (sv && !sv.disabled) archive(byId(sv.getAttribute("data-cs")), sv);
      });
    }
  }, 1);
})();
