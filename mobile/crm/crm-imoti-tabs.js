/* Property forms for the Имоти page: Нов имот / Редакция (with real photo and document upload),
   Още филтри. Uses the shared form window (crm-ui.js) and Supabase (crm-data.js). */
(function () {
  "use strict";
  var U = window.NDUI, D = window.ND;
  var PL = window.NDPlaces || { cities: [], PLACES: {}, city: function (x) { return String(x || "").trim(); }, hood: function (c, x) { return String(x || "").trim(); } };
  function placeOpts(c) { var R = (PL.REGION || {})[PL.city(c)]; if (!R) return ""; return [["Град", R.towns || []], ["Курорт", R.resorts || []], ["Село", R.villages || []]].map(function (g) { return g[1].map(function (n) { return '<option value="' + U.esc(n) + '">' + g[0] + "</option>"; }).join(""); }).join(""); }
  function hoodOpts(c) { return (PL.PLACES[PL.city(c)] || []).map(function (n) { return '<option value="' + U.esc(n) + '">'; }).join(""); }
  var esc = U.esc, ic = U.ic, fld = U.fld, row = U.row, section = U.section;
  var P = null; /* page hooks */
  var TYPES = ["Апартамент", "Мезонет", "Ателие / Таван", "Къща", "Етаж от къща", "Вила", "Парцел", "Земеделска земя", "Офис", "Магазин", "Заведение", "Склад", "Гараж", "Паркомясто", "Хотел", "Промишлен имот"];
  var STATUS = ["Чернова", "Активен", "Публикуван", "Резервиран", "Продаден", "Архивиран"];
  var COND = ["Ново строителство", "Обзаведен", "Необзаведен", "За ремонт", "Без строеж"];
  var EXPO = ["", "Юг", "Изток", "Запад", "Север", "Юг-Изток", "Юг-Запад", "Изток-Запад", "Север-Юг", "Север-Изток", "Север-Запад"];
  var HEAT = ["", "ТЕЦ", "Газ", "Ток / климатици", "Термопомпа", "Камина / печка", "Локално парно", "Без отопление"];
  var PARK = ["", "Няма", "Паркомясто", "Гараж", "Подземен паркинг", "В двора"];
  var ACT = ["", "Акт 16", "Акт 15", "Акт 14", "В строеж", "Без акт"];
  function pickL(list, v) { v = String(v == null ? "" : v).trim().toLowerCase(); if (!v) return ""; return list.filter(function (x) { return x && (x.toLowerCase() === v || x.toLowerCase().indexOf(v) === 0); })[0] || ""; }
  /* брокери от CRM – публикуваната обява показва картата на избрания брокер */
  var BRK = null;
  function loadBrokers() { if (BRK) return Promise.resolve(BRK); return D.ready().then(function () { return D.load("brokers"); }).then(function (l) { BRK = (l || []).filter(function (b) { return b && b.name && b.active !== false; }); return BRK; }).catch(function () { BRK = []; return BRK; }); }
  function myBroker() { var em = String((D.user && D.user.email) || "").toLowerCase(), l = BRK || []; return (l.filter(function (b) { return String(b.email || "").toLowerCase() === em; })[0] || l[0] || {}).id || ""; }
  function brokerOpts(cur) { var l = BRK || []; var o = l.map(function (b) { return [b.id, b.name + (b.title || b.role ? " – " + (b.title || b.role) : "")]; }); if (cur && !l.some(function (b) { return b.id === cur; })) o.unshift([cur, cur]); return o.length ? o : [["", "Зареждане…"]]; }
  var BUILD = ["Тухла", "Панел", "ЕПК", "Монолит", "Гредоред", "Сглобяема", "Друго"];

  function nextCode(list) {
    var max = 1000;
    list.forEach(function (p) { var m = /^P-(\d+)$/.exec(p.code || ""); if (m) max = Math.max(max, +m[1]); });
    return "P-" + (max + 1);
  }
  function stored(p) {
    var o = {};
    ["code", "title", "deal", "type", "price", "area", "rooms", "beds", "baths", "floor", "build", "year", "cond", "status", "region", "city", "hood", "address", "client", "desc", "ownerPrice", "ownerPhone", "privDesc", "exclusive", "videos", "ownerEmail", "ownerEgn", "ownerAddr", "ownerIban", "ownerShare", "coOwners", "ownerPaid", "ownerComm", "contractDate", "contractUntil", "ownerContact", "ownerNotes", "portals", "place", "num", "expo", "heat", "parking", "elevator", "terraces", "act", "keys", "commission", "freeFrom", "tour", "features", "docSituation", "docRows", "pics", "cover", "docs", "log", "broker", "stage", "archived"].forEach(function (k) { if (p[k] !== undefined) o[k] = p[k]; });
    if (p.id) o.id = p.id;
    return o;
  }
  function addLog(p, icon, text) {
    p.log = (p.log || []).slice(0, 49);
    p.log.unshift({ icon: icon, text: text, at: new Date().toISOString() });
  }

  function fromScan(f) {
    f = f || {}; var o = {}, t = function (v) { return v == null ? "" : String(v).trim(); }, n = function (v) { var x = Number(String(v == null ? "" : v).replace(/[^\d.]/g, "")); return x > 0 ? x : null; };
    ["title", "floor", "region", "city", "hood", "address", "client", "desc", "privDesc", "ownerPhone"].forEach(function (k) { if (t(f[k])) o[k] = t(f[k]); });
    if (f.deal === "sale" || f.deal === "rent") o.deal = f.deal;
    var ty = TYPES.filter(function (x) { return x.toLowerCase() === t(f.type).toLowerCase(); })[0]; if (ty) o.type = ty;
    var bu = BUILD.filter(function (x) { return x.toLowerCase() === t(f.build).toLowerCase(); })[0]; if (bu) o.build = bu;
    ["price", "ownerPrice", "area", "rooms", "beds", "baths", "year"].forEach(function (k) { var v = n(f[k]); if (v != null) o[k] = v; });
    [["expo", EXPO], ["heat", HEAT], ["parking", PARK], ["act", ACT]].forEach(function (x) { var v = pickL(x[1], f[x[0]]); if (v) o[x[0]] = v; });
    var co = pickL(COND, f.cond); if (co) o.cond = co;
    if (f.elevator === true || /^(да|yes|true)/i.test(String(f.elevator || ""))) o.elevator = true;
    var tr = n(f.terraces); if (tr) o.terraces = tr;
    if (t(f.features)) o.features = t(f.features);
    if (o.city) o.city = PL.city(o.city);
    if (o.hood) o.hood = PL.hood(o.city, o.hood);
    if (t(f.summary)) o.desc = [o.desc, "Сканиран документ: " + t(f.summary)].filter(Boolean).join("\n");
    return o;
  }
  function edit(p, scanned, scanFile, bundle, onSaved) {
    var isNew = !p, list = P.list(); loadBrokers();
    p = p ? JSON.parse(JSON.stringify(stored(p))) : Object.assign({ code: nextCode(list), deal: "sale", type: TYPES[0], status: "Чернова", cond: COND[0], pics: [], docs: [], log: [] }, fromScan(scanned));
    p.pics = p.pics || []; p.docs = p.docs || []; p.videos = p.videos || [];
    var pendingPics = [], pendingDocs = [], pendingVids = [], removed = [], ctx;
    /* one ordered gallery: saved photos and new ones together; the first is the main photo; drag to reorder */
    var gal = p.pics.map(function (path) { return { kind: "saved", path: path }; });
    if (p.cover > 0 && gal[p.cover]) gal.unshift(gal.splice(p.cover, 1)[0]);
    p.cover = 0;
    function addNew(f, wm) { var o = { kind: "new", file: f, url: URL.createObjectURL(f), name: f.name || "photo.jpg", wm: !!wm }; if (o.wm && window.NDScan) o.wmP = window.NDScan.watermark(f); pendingPics.push(o); gal.push(o); }
    if (bundle) {
      (bundle.pics || []).forEach(function (f) { addNew(f, true); });
      (bundle.videos || []).forEach(function (f) { pendingVids.push({ file: f, name: f.name }); });
      (bundle.docs || []).forEach(function (f) { pendingDocs.push({ file: f, name: f.name }); });
    }
    if (scanFile) { if (/^image\//.test(scanFile.type)) addNew(scanFile); else pendingDocs.push({ file: scanFile, name: scanFile.name || "scan.pdf" }); }
    var clientNames = P.clientNames();
    function syncPics() { p.pics = gal.filter(function (g) { return g.kind === "saved"; }).map(function (g) { return g.path; }); p.cover = 0; }
    /* press and drag a photo (mouse or finger) to move it; the list order is the gallery order */
    function dragSort(box) {
      var src = null, el = null, ghost = null, start = null, moved = false;
      box.addEventListener("pointerdown", function (e) {
        var c = e.target.closest("[data-pi]"); if (!c || e.target.closest("button") || (e.pointerType === "mouse" && e.button !== 0)) return;
        src = +c.getAttribute("data-pi"); el = c; start = [e.clientX, e.clientY]; moved = false;
        c.setPointerCapture && c.setPointerCapture(e.pointerId);
      });
      box.addEventListener("pointermove", function (e) {
        if (!el) return;
        if (!moved) { if (Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 8) return; moved = true; box._dragged = true; el.classList.add("drag"); ghost = el.cloneNode(true); ghost.className = "ph ghost"; ghost.style.width = el.offsetWidth + "px"; ghost.style.height = el.offsetHeight + "px"; document.body.appendChild(ghost); }
        e.preventDefault();
        ghost.style.left = (e.clientX - ghost.offsetWidth / 2) + "px"; ghost.style.top = (e.clientY - ghost.offsetHeight / 2) + "px";
        var over = document.elementFromPoint(e.clientX, e.clientY), t = over && over.closest && over.closest("#p-pics [data-pi]");
        if (!t || t === el) return;
        var kids = [].slice.call(box.querySelectorAll("[data-pi]")), a = kids.indexOf(el), b = kids.indexOf(t);
        if (a < 0 || b < 0) return;
        if (a < b) t.after(el); else t.before(el);
      });
      function end() {
        if (!el) return;
        if (moved) {
          var order = [].map.call(box.querySelectorAll("[data-pi]"), function (c) { return gal[+c.getAttribute("data-pi")]; });
          gal = order; syncPics(); el.classList.remove("drag"); if (ghost) ghost.remove(); ghost = null; rerender();
          setTimeout(function () { box._dragged = false; }, 50);
        }
        el = null; src = null;
      }
      box.addEventListener("pointerup", end); box.addEventListener("pointercancel", end);
    }
    function picsHtml() {
      var cells = gal.map(function (g, i) {
        return '<div class="ph' + (i === 0 ? " cover" : "") + (g.kind === "new" ? " new" : "") + '" data-pi="' + i + '" draggable="false" style="background-image:url(' + (g.kind === "saved" ? U.img(g.path) : g.url) + ')" title="Задръжте и влачете, за да смените реда; първата е основна">' +
          (i === 0 ? '<span class="ph-main">Основна</span>' : '<span class="ph-n">' + (i + 1) + "</span>") + '<button type="button" data-rmpic="' + i + '" aria-label="Премахни снимката">' + ic("trash-2") + "</button></div>";
      });
      return '<div class="ndphotos" id="p-pics">' + (cells.join("") || '<div class="ndempty" style="grid-column:1/-1">Няма качени снимки.</div>') + "</div>";
    }
    function docsHtml() {
      return '<div class="wide" id="p-docs">' + section("Документи на имота", "file-text", p.docs.map(function (d, i) {
        return row("file-text", d.name, Math.max(1, Math.round((d.size || 0) / 1024)) + " KB", U.bgDate(d.at), '<button type="button" data-opendoc="' + i + '" aria-label="Отвори">' + ic("eye") + '</button><button type="button" class="rm" data-rmdoc="' + i + '" aria-label="Изтрий">' + ic("trash-2") + "</button>");
      }).concat(pendingDocs.map(function (f) { return row("upload", f.name, "ще се качи при запис", ""); })), "Няма качени документи.") + "</div>";
    }
    function html() {
      var G = U.group;
      return G("Основни данни", "house", "nd/ph07.jpg",
          fld({ id: "p-title", label: "Заглавие", icon: "house", value: p.title, required: true, wide: true, ph: "напр. Тристаен апартамент" }) +
          fld({ id: "p-deal", label: "Сделка", icon: "tag", type: "select", value: p.deal, options: [["sale", "Продажба"], ["rent", "Наем"]] }) +
          fld({ id: "p-type", label: "Тип", icon: "house", type: "select", value: p.type, options: TYPES }) +
          fld({ id: "p-price", label: "Официална цена €", icon: "coins", value: p.price, type: "number", required: true }) +
          fld({ id: "p-status", label: "Статус", icon: "megaphone", type: "select", value: p.status, options: STATUS }) +
          fld({ id: "p-broker", label: "Брокер (качил обявата)", icon: "user-round", type: "select", value: p.broker || myBroker(), options: brokerOpts(p.broker), wide: true }), { lw: 110 }) +
        G("Характеристики", "ruler", "nd/ph03.jpg",
          fld({ id: "p-area", label: "Площ м²", icon: "m2", value: p.area, type: "number" }) +
          fld({ id: "p-rooms", label: "Стаи", icon: "bed-double", value: p.rooms, type: "number" }) +
          fld({ id: "p-beds", label: "Спални", icon: "bed-double", value: p.beds, type: "number" }) +
          fld({ id: "p-baths", label: "Бани", icon: "bath", value: p.baths, type: "number" }) +
          fld({ id: "p-floor", label: "Етаж", icon: "building-2", value: p.floor, ph: "напр. 3 / 6" }) +
          fld({ id: "p-year", label: "Година", icon: "calendar", value: p.year, type: "number" }) +
          fld({ id: "p-build", label: "Строителство", icon: "brick-wall", type: "select", value: p.build || BUILD[0], options: BUILD }) +
          fld({ id: "p-cond", label: "Състояние", icon: "sparkles", type: "select", value: p.cond, options: COND }), { lw: 130 }) +
        G("Удобства и условия", "sparkles", "nd/ph09.jpg",
          fld({ id: "p-expo", label: "Изложение", icon: "sparkles", type: "select", value: p.expo || "", options: EXPO.map(function (x) { return [x, x || "—"]; }) }) +
          fld({ id: "p-heat", label: "Отопление", icon: "zap", type: "select", value: p.heat || "", options: HEAT.map(function (x) { return [x, x || "—"]; }) }) +
          fld({ id: "p-park", label: "Паркиране", icon: "key-round", type: "select", value: p.parking || "", options: PARK.map(function (x) { return [x, x || "—"]; }) }) +
          fld({ id: "p-elev", label: "Асансьор", icon: "building-2", type: "select", value: p.elevator ? "1" : "", options: [["", "Не"], ["1", "Да"]] }) +
          fld({ id: "p-terr", label: "Тераси", icon: "layout-grid", value: p.terraces, type: "number" }) +
          fld({ id: "p-act", label: "Акт", icon: "badge-check", type: "select", value: p.act || "", options: ACT.map(function (x) { return [x, x || "—"]; }) }) +
          fld({ id: "p-keys", label: "Ключ при нас", icon: "key-round", type: "select", value: p.keys ? "1" : "", options: [["", "Не"], ["1", "Да"]] }) +
          fld({ id: "p-comm", label: "Комисионна %", icon: "circle-dollar-sign", value: p.commission, type: "number", step: "0.1" }) +
          fld({ id: "p-free", label: "Свободен от", icon: "calendar", value: p.freeFrom, ph: "напр. веднага / 01.02.2027" }) +
          fld({ id: "p-tour", label: "Видео / 3D тур", icon: "link", value: p.tour, ph: "линк" }) +
          fld({ id: "p-feat", label: "Предимства", icon: "star", value: p.features, wide: true, ph: "напр. гледка към морето, след ремонт, тиха улица" }), { lw: 120 }) +
        G("Локация", "pin", "nd/ph19.jpg",
          fld({ id: "p-region", label: "Област", icon: "map", value: p.region, ph: "напр. Варна" }) +
          fld({ id: "p-city", label: "Град", icon: "pin", type: "select", value: p.city || "", required: true, options: [["", "Изберете град"]].concat(PL.cities, p.city && PL.cities.indexOf(p.city) < 0 ? [p.city] : []) }) +
          fld({ id: "p-place", label: "Населено място", icon: "map", value: p.place || p.city, list: "p-places", ph: "град, курорт или село в областта" }) +
          '<datalist id="p-places">' + placeOpts(p.city) + "</datalist>" +
          fld({ id: "p-hood", label: "Квартал", icon: "pin", value: p.hood, list: "p-hoods", ph: "изберете или въведете" }) +
          '<datalist id="p-hoods">' + hoodOpts(p.city) + "</datalist>" +
          fld({ id: "p-addr", label: "Адрес", icon: "map-pin-house", value: p.address }), { lw: 110 }) +
        G("Собственик и описание", "user", "nd/ph14.jpg",
          fld({ id: "p-client", label: "Собственик", icon: "user", value: p.client, list: "p-clients", wide: true }) +
          '<datalist id="p-clients">' + clientNames.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist>" +
          fld({ id: "p-ophone", label: "Телефон на собственика", icon: "phone", value: p.ownerPhone, ph: "само за агенцията" }) +
          fld({ id: "p-oprice", label: "Цена към собственика €", icon: "coins", value: p.ownerPrice, type: "number" }) +
          fld({ id: "p-excl", label: "Ексклузив", icon: "star", type: "select", value: p.exclusive ? "1" : "", options: [["", "Не"], ["1", "Да – ексклузивен договор"]] }) +
          fld({ id: "p-desc", label: "Описание (публично)", icon: "file-text", value: p.desc, type: "ta", wide: true }) +
          fld({ id: "p-priv", label: "Лично описание (не се публикува)", icon: "lock", value: p.privDesc, type: "ta", wide: true }), { lw: 130, one: true }) +
        G("Снимки (" + (p.pics.length + pendingPics.length) + ")", "camera", null,
          picsHtml() + U.filebox("p-picin", "Добави снимки", "JPG / PNG · влачете снимките, за да смените реда; първата е основна", { icon: "image", accept: "image/*" }), { one: true }) +
        (p.videos.length || pendingVids.length ? '<div class="wide">' + section("Видеа (" + (p.videos.length + pendingVids.length) + ")", "camera", p.videos.map(function (v, i) {
          return row("camera", v.name, Math.max(1, Math.round((v.size || 0) / 1048576)) + " MB", U.bgDate(v.at), '<button type="button" class="rm" data-rmvid="' + i + '" aria-label="Изтрий">' + ic("trash-2") + "</button>");
        }).concat(pendingVids.map(function (f) { return row("upload", f.name, "ще се качи при запис", ""); })), "") + "</div>" : "") +
        docsHtml() +
        G("Прикачи документи", "upload", "nd/ph20.jpg", U.filebox("p-docin", "Прикачи файл", "Нотариален акт, скица, данъчна оценка… · плъзнете или изберете"), { one: true });
    }
    function collect(g) {
      var n = function (id) { var v = g(id).replace(/\s/g, "").replace(",", "."); return v === "" ? null : Number(v); };
      p.title = g("p-title"); p.deal = g("p-deal"); p.type = g("p-type"); p.price = n("p-price"); p.area = n("p-area");
      p.rooms = n("p-rooms"); p.beds = n("p-beds"); p.baths = n("p-baths"); p.floor = g("p-floor"); p.build = g("p-build"); p.year = n("p-year");
      p.cond = g("p-cond"); p.status = g("p-status"); p.city = PL.city(g("p-city")); p.place = g("p-place") || p.city; p.hood = PL.hood(p.city, g("p-hood")); p.region = g("p-region") || p.city;
      p.address = g("p-addr"); p.client = g("p-client"); p.desc = g("p-desc");
      if (ctx && ctx.q("p-broker") && g("p-broker")) p.broker = g("p-broker");
      if (ctx && ctx.q("p-expo")) { p.expo = g("p-expo"); p.heat = g("p-heat"); p.parking = g("p-park"); p.elevator = g("p-elev") === "1"; p.terraces = n("p-terr"); p.act = g("p-act");
        p.keys = g("p-keys") === "1"; p.commission = n("p-comm"); p.freeFrom = g("p-free"); p.tour = g("p-tour"); p.features = g("p-feat"); }
      if (ctx && ctx.q("p-priv")) { p.privDesc = g("p-priv"); p.ownerPhone = g("p-ophone"); p.ownerPrice = n("p-oprice"); p.exclusive = g("p-excl") === "1"; }
      if (window.NDScan && p.desc) p.desc = window.NDScan.publicText(p.desc);
    }
    function rerender() { collect(ctx.get); ctx.rerender(html()); }
    function bind() {
      var pi = ctx.q("p-picin"), di = ctx.q("p-docin");
      var cs = ctx.q("p-city"), hl = ctx.q("p-hoods"); if (cs && hl) cs.onchange = function () { hl.innerHTML = hoodOpts(cs.value); var pl = ctx.q("p-places"), pi2 = ctx.q("p-place"); if (pl) pl.innerHTML = placeOpts(cs.value); if (pi2 && (!pi2.value || PL.cities.indexOf(pi2.value) >= 0)) pi2.value = cs.value; var h = ctx.q("p-hood"); if (h && h.value) h.value = PL.hood(cs.value, h.value); };
      if (pi) pi.onchange = function () { [].forEach.call(pi.files, function (f) { addNew(f, true); }); rerender(); };
      if (di) di.onchange = function () { [].forEach.call(di.files, function (f) { pendingDocs.push({ file: f, name: f.name }); }); rerender(); };
      var ph = ctx.q("p-pics");
      if (ph) {
        ph.onclick = function (e) {
          var rm = e.target.closest("[data-rmpic]");
          if (rm) { var i = +rm.getAttribute("data-rmpic"), g = gal[i]; if (!g) return; if (g.kind === "saved") removed.push(g.path); else pendingPics.splice(pendingPics.indexOf(g), 1); gal.splice(i, 1); syncPics(); rerender(); return; }
          if (ph._dragged) { ph._dragged = false; return; }
          var c = e.target.closest("[data-pi]"); if (c) { var k = +c.getAttribute("data-pi"); if (k > 0) { gal.unshift(gal.splice(k, 1)[0]); syncPics(); rerender(); P.say("Основна снимка сменена"); } }
        };
        dragSort(ph);
      }
      [].forEach.call(document.querySelectorAll("[data-rmvid]"), function (b) { b.onclick = function () { var i = +b.getAttribute("data-rmvid"); removed.push(p.videos[i].path); p.videos.splice(i, 1); rerender(); }; });
      var dc = ctx.q("p-docs");
      if (dc) dc.onclick = function (e) {
        var o = e.target.closest("[data-opendoc]"), r = e.target.closest("[data-rmdoc]");
        if (o) { if (window.NDDocs && window.NDDocs.view) { window.NDDocs.view(ctx.body.closest("#nd-fwin") || ctx.body, p.docs.slice(), +o.getAttribute("data-opendoc")); return; } var w = window.open("", "_blank"); D.fileUrl(p.docs[+o.getAttribute("data-opendoc")].path).then(function (u) { if (w) w.location = u; else location.href = u; }); }
        if (r) { var i = +r.getAttribute("data-rmdoc"); removed.push(p.docs[i].path); p.docs.splice(i, 1); rerender(); }
      };
    }
    U.open({
      title: isNew ? (bundle ? "Имот от папка " : scanned ? "Сканиран имот " : "Нов имот ") + p.code : "Редакция – " + (p.title || p.code), icon: isNew ? "house-plus" : "square-pen", photo: "nd/ph17.jpg", html: html(),
      required: ["p-title", "p-price", "p-city"],
      validate: function (g) { if (!(Number(g("p-price").replace(/\s/g, "").replace(",", ".")) >= 0)) return "Цената трябва да е число."; },
      ready: function (x) { ctx = x; bind(); if (!BRK) loadBrokers().then(function () { if (ctx && ctx.q("p-broker")) rerender(); }); }, ready2: bind,
      onSave: function (g) {
        collect(g);
        var base = "properties/" + (p.code || D.newId()) + "/";
        var total = pendingPics.length, done = 0;
        var up = gal.reduce(function (pr, g, idx) {
          if (g.kind !== "new") return pr;
          return pr.then(function () {
            return (g.wm && window.NDScan ? (g.wmP || window.NDScan.watermark(g.file)) : Promise.resolve(g.file)).then(function (file) {
              var path = base + "photos/" + Date.now() + "-" + String(idx + 1).padStart(3, "0") + "-" + file.name.replace(/[^\w.\-]+/g, "_").slice(-60);
              return D.upload(path, file).then(function () { g.kind = "saved"; g.path = path; done++; if (total > 5 && done % 5 === 0) P.say("Качени снимки: " + done + " / " + total); });
            });
          });
        }, Promise.resolve()).then(function () { syncPics(); });
        up = pendingVids.reduce(function (pr, f) {
          return pr.then(function () {
            var path = base + "videos/" + Date.now() + "-" + f.name.replace(/[^\w.\-]+/g, "_").slice(-60);
            return D.upload(path, f.file).then(function () { p.videos.push({ name: f.name, path: path, size: f.file.size, mime: f.file.type, at: new Date().toISOString() }); })
              .catch(function () { P.say("Видеото „" + f.name + "“ не се качи (твърде голямо?)"); });
          });
        }, up);
        up = pendingDocs.reduce(function (pr, f) {
          return pr.then(function () {
            var path = base + "docs/" + Date.now() + "-" + f.name.replace(/[^\w.\-]+/g, "_").slice(-60);
            return D.upload(path, f.file).then(function () { p.docs.push({ name: f.name, path: path, size: f.file.size, mime: f.file.type, at: new Date().toISOString() }); });
          });
        }, up);
        return up.then(function () {
          if (removed.length) removed.forEach(function (x) { D.removeFile(x).catch(function () {}); });
          addLog(p, isNew ? "pencil" : "square-pen", isNew ? "Създаден имот " + p.code + (bundle ? " от папка" + (bundle.folder ? " „" + bundle.folder + "“" : "") : "") : "Редакция на имота" + (pendingPics.length ? " · +" + pendingPics.length + " снимки" : ""));
          return D.put("properties", p);
        }).then(function (s) {
          P.say(isNew ? "Имотът е добавен" : "Имотът е запазен");
          if (onSaved) try { onSaved(s, p); } catch (e) {}
          return P.refresh().then(function () { P.reopen(s.id); });
        });
      },
      onDelete: isNew ? null : function () {
        return D.del("properties", p.id).then(function () {
          (p.pics || []).concat((p.docs || []).concat(p.videos || []).map(function (d) { return d.path; })).forEach(function (x) { D.removeFile(x).catch(function () {}); });
          P.say("Имотът е изтрит"); P.closeCard(); return P.refresh();
        });
      }
    });
  }

  function setStatus(p, status) {
    var o = stored(p); o.status = status;
    addLog(o, status === "Публикуван" ? "megaphone" : "archive", "Статус: " + status);
    return D.put("properties", o).then(function () { P.say(status === "Публикуван" ? "Имотът е публикуван" : status === "Архивиран" ? "Имотът е архивиран" : "Статус: " + status); return P.refresh().then(function () { P.reopen(o.id); }); });
  }

  /* Статус на сделката за публикуван имот: Депозиран (остава на сайта), Капариран / Продаден (свалят се от сайта и отиват в архива) */
  function setStage(p, stage) {
    var o = stored(p); o.stage = stage || "";
    var off = stage === "Продаден" || stage === "Капариран";
    if (off) { o.status = "Архивиран"; o.archived = true; }
    addLog(o, stage === "Продаден" ? "archive" : "tag", stage ? "Статус: " + stage + (off ? " · обявата е свалена от сайта и е в архива" : " · обявата остава публикувана") : "Статусът на сделката е изчистен");
    return D.put("properties", o).then(function () { P.say(stage ? (off ? stage + " – свален от сайта, в архива" : "Депозиран – обявата остава на сайта") : "Статусът е изчистен"); return P.refresh().then(function () { P.reopen(o.id); }); });
  }
  /* „Запази в архив“: публикуван имот само се записва в архива (остава на сайта); непубликуван – става Архивиран */
  function archive(p) {
    var o = stored(p), keep = o.status === "Публикуван";
    if (keep) o.archived = true; else { o.status = "Архивиран"; o.archived = true; }
    addLog(o, "archive", keep ? "Запазен в архива – обявата остава публикувана" : "Статус: Архивиран");
    return D.put("properties", o).then(function () { P.say(keep ? "Запазен в архива – обявата остава на сайта" : "Имотът е архивиран"); return P.refresh().then(function () { P.reopen(o.id); }); });
  }
  function more(cur, apply) {
    cur = cur || {};
    U.open({
      title: "Още филтри", icon: "sliders-horizontal", photo: "nd/ph15.jpg", saveText: "Приложи",
      html: U.group("Допълнителни филтри", "sliders-horizontal", "nd/ph10.jpg", fld({ id: "x-beds", label: "Спални – поне", icon: "bed-double", value: cur.beds, type: "number" }) +
        fld({ id: "x-baths", label: "Бани – поне", icon: "bath", value: cur.baths, type: "number" }) +
        fld({ id: "x-client", label: "Собственик / клиент", icon: "user", value: cur.client, list: "x-clients" }) +
        '<datalist id="x-clients">' + P.clientNames().map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist>" +
        fld({ id: "x-fav", label: "Само любими", icon: "heart", type: "select", value: cur.fav ? "1" : "", options: [["", "Не"], ["1", "Да"]] }) +
        fld({ id: "x-photos", label: "Само със снимки", icon: "camera", type: "select", value: cur.photos ? "1" : "", options: [["", "Не"], ["1", "Да"]] }), { lw: 150, one: true }) +
        U.group("Площ, стаи и етаж", "ruler", "nd/ph03.jpg",
          fld({ id: "x-amin", label: "Площ от м²", icon: "m2", value: cur.areaMin, type: "number" }) +
          fld({ id: "x-amax", label: "Площ до м²", icon: "m2", value: cur.areaMax, type: "number" }) +
          fld({ id: "x-rooms", label: "Стаи – поне", icon: "bed-double", value: cur.rooms, type: "number" }) +
          fld({ id: "x-ymin", label: "Година от", icon: "calendar", value: cur.yearMin, type: "number" }) +
          fld({ id: "x-fmin", label: "Етаж от", icon: "building-2", value: cur.floorMin, type: "number" }) +
          fld({ id: "x-fmax", label: "Етаж до", icon: "building-2", value: cur.floorMax, type: "number" }), { lw: 120 }) +
        U.group("Удобства и условия", "sparkles", "nd/ph09.jpg",
          fld({ id: "x-build", label: "Строителство", icon: "brick-wall", type: "select", value: cur.build || "", options: [["", "Всички"]].concat(BUILD) }) +
          fld({ id: "x-expo", label: "Изложение", icon: "sparkles", type: "select", value: cur.expo || "", options: EXPO.map(function (x) { return [x, x || "Всички"]; }) }) +
          fld({ id: "x-heat", label: "Отопление", icon: "zap", type: "select", value: cur.heat || "", options: HEAT.map(function (x) { return [x, x || "Всички"]; }) }) +
          fld({ id: "x-park", label: "Паркиране", icon: "key-round", type: "select", value: cur.parking || "", options: PARK.map(function (x) { return [x, x || "Всички"]; }) }) +
          fld({ id: "x-act", label: "Акт", icon: "badge-check", type: "select", value: cur.act || "", options: ACT.map(function (x) { return [x, x || "Всички"]; }) }) +
          fld({ id: "x-elev", label: "Само с асансьор", icon: "building-2", type: "select", value: cur.elevator ? "1" : "", options: [["", "Не"], ["1", "Да"]] }) +
          fld({ id: "x-excl", label: "Само ексклузивни", icon: "star", type: "select", value: cur.exclusive ? "1" : "", options: [["", "Не"], ["1", "Да"]] }) +
          fld({ id: "x-keys", label: "Ключ при нас", icon: "key-round", type: "select", value: cur.keys ? "1" : "", options: [["", "Не"], ["1", "Да"]] }), { lw: 120 }),
      onSave: function (g) {
        var n = function (id) { var v = g(id); return v === "" ? null : Number(v); };
        apply({ beds: n("x-beds"), baths: n("x-baths"), client: g("x-client"), fav: g("x-fav") === "1", photos: g("x-photos") === "1",
          areaMin: n("x-amin"), areaMax: n("x-amax"), rooms: n("x-rooms"), yearMin: n("x-ymin"), floorMin: n("x-fmin"), floorMax: n("x-fmax"),
          build: g("x-build"), expo: g("x-expo"), heat: g("x-heat"), parking: g("x-park"), act: g("x-act"),
          elevator: g("x-elev") === "1", exclusive: g("x-excl") === "1", keys: g("x-keys") === "1" });
      },
      onDelete: function () { apply(null); }
    });
    var del = document.querySelector("#nd-f-del span"); if (del) del.textContent = "Изчисти";
  }


  /* ---------- Собственик: owner data, the amount due to the owner, contract ---------- */
  function owner(p0) {
    var p = JSON.parse(JSON.stringify(stored(p0))), G = U.group, f = fld, names = P.clientNames();
    var due = function () { var a = Number(p.ownerPrice) || 0, b = Number(p.ownerPaid) || 0; return a ? U.money(Math.max(0, a - b)) + " €" : "—"; };
    var html =
      G("Собственик", "user", "nd/ph14.jpg",
        f({ id: "o-name", label: "Име", icon: "user", value: p.client, list: "o-cl", wide: true }) + '<datalist id="o-cl">' + names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist>" +
        f({ id: "o-phone", label: "Телефон", icon: "phone", value: p.ownerPhone, type: "tel" }) + f({ id: "o-mail", label: "Имейл", icon: "mail", value: p.ownerEmail, type: "email" }) +
        f({ id: "o-egn", label: "ЕГН", icon: "id-card", value: p.ownerEgn }) + f({ id: "o-share", label: "Дял от имота %", icon: "layout-grid", value: p.ownerShare, type: "number" }) +
        f({ id: "o-addr", label: "Адрес за кореспонденция", icon: "map-pin-house", value: p.ownerAddr, wide: true }) +
        f({ id: "o-co", label: "Съсобственици", icon: "users", value: p.coOwners, wide: true, ph: "имена и телефони, ако има" }) +
        f({ id: "o-cpref", label: "Връзка чрез", icon: "message-square", type: "select", value: p.ownerContact || "", options: ["", "Телефон", "Viber", "WhatsApp", "Имейл", "SMS"].map(function (x) { return [x, x || "—"]; }) }), { lw: 150 }) +
      G("Сума към собственика", "coins", "nd/ph16.jpg",
        f({ id: "o-price", label: "Цена към собственика €", icon: "coins", value: p.ownerPrice, type: "number" }) + f({ id: "o-paid", label: "Платено на собственика €", icon: "circle-dollar-sign", value: p.ownerPaid, type: "number" }) +
        '<div class="ef"><label class="el">Остатък</label><b id="o-due" style="font:700 26px var(--serif);color:#7a0f22">' + due() + "</b></div>" +
        f({ id: "o-comm", label: "Комисионна от собственика %", icon: "coins", value: p.ownerComm, type: "number", step: "0.1" }) +
        f({ id: "o-iban", label: "IBAN за плащане", icon: "landmark", value: p.ownerIban, wide: true }), { lw: 170 }) +
      G("Договор за посредничество", "file-pen", "nd/ph04.jpg",
        f({ id: "o-cdate", label: "Подписан на", icon: "calendar", value: p.contractDate, type: "date" }) + f({ id: "o-cuntil", label: "Валиден до", icon: "calendar-check", value: p.contractUntil, type: "date" }) +
        f({ id: "o-excl", label: "Ексклузив", icon: "star", type: "select", value: p.exclusive ? "1" : "", options: [["", "Не"], ["1", "Да"]] }) +
        f({ id: "o-keys", label: "Ключ при нас", icon: "key-round", type: "select", value: p.keys ? "1" : "", options: [["", "Не"], ["1", "Да"]] }) +
        f({ id: "o-notes", label: "Бележки за собственика", icon: "file-text", value: p.ownerNotes, type: "ta", wide: true }), { lw: 150 }) +
      G("Опис от папката", "file-text", "nd/ph20.jpg",
        '<p class="wide" style="margin:0 0 10px;font:400 22px/1.35 var(--cond);color:#6b4a40">Текстът на описа, качен с имота. Вижда се само от нас – не се публикува.</p>' +
        f({ id: "o-priv", label: "Опис / лично описание", icon: "lock", value: p.privDesc, type: "ta", wide: true }), { lw: 150 });
    U.open({ title: "Собственик – " + (p.title || p.code), icon: "user", photo: "nd/ph13.jpg", html: html, saveText: "Запази",
      ready: function (x) { var a = x.q("o-price"), b = x.q("o-paid"), d = x.q("o-due"); [a, b].forEach(function (e) { if (e) e.addEventListener("input", function () { p.ownerPrice = Number(a.value) || 0; p.ownerPaid = Number(b.value) || 0; d.textContent = due(); }); }); },
      onSave: function (g) {
        var n = function (id) { var v = g(id).replace(/\s/g, "").replace(",", "."); return v === "" ? null : Number(v); };
        Object.assign(p, { client: g("o-name"), ownerPhone: g("o-phone"), ownerEmail: g("o-mail"), ownerEgn: g("o-egn"), ownerShare: n("o-share"), ownerAddr: g("o-addr"), coOwners: g("o-co"), ownerContact: g("o-cpref"),
          ownerPrice: n("o-price"), ownerPaid: n("o-paid"), ownerComm: n("o-comm"), ownerIban: g("o-iban"), contractDate: g("o-cdate"), contractUntil: g("o-cuntil"), exclusive: g("o-excl") === "1", keys: g("o-keys") === "1", ownerNotes: g("o-notes"), privDesc: g("o-priv") });
        addLog(p, "user", "Обновени данни за собственика");
        return D.put("properties", p).then(function (s) { P.say("Данните за собственика са запазени"); return P.refresh().then(function () { P.reopen(s.id); }); });
      } });
  }
  window.NDProps = { owner: owner, init: function (h) { P = h; }, ready: function () { return !!P; }, edit: edit, setStatus: setStatus, setStage: setStage, archive: archive, more: more, stored: stored };
})();
