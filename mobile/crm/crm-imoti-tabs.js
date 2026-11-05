/* Property forms for the Имоти page: Нов имот / Редакция (with real photo and document upload),
   Още филтри. Uses the shared form window (crm-ui.js) and Supabase (crm-data.js). */
(function () {
  "use strict";
  var U = window.NDUI, D = window.ND;
  var esc = U.esc, ic = U.ic, fld = U.fld, row = U.row, section = U.section;
  var P = null; /* page hooks */
  var TYPES = ["Апартамент", "Къща", "Парцел", "Офис", "Магазин", "Гараж"];
  var STATUS = ["Чернова", "Активен", "Публикуван", "Резервиран", "Продаден", "Архивиран"];
  var COND = ["Ново строителство", "Обзаведен", "Необзаведен", "За ремонт", "Без строеж"];
  var BUILD = ["Тухла", "Панел", "ЕПК", "Монолит", "Гредоред", "Сглобяема", "Друго"];

  function nextCode(list) {
    var max = 1000;
    list.forEach(function (p) { var m = /^P-(\d+)$/.exec(p.code || ""); if (m) max = Math.max(max, +m[1]); });
    return "P-" + (max + 1);
  }
  function stored(p) {
    var o = {};
    ["code", "title", "deal", "type", "price", "area", "rooms", "beds", "baths", "floor", "build", "year", "cond", "status", "region", "city", "hood", "address", "client", "desc", "pics", "cover", "docs", "log"].forEach(function (k) { if (p[k] !== undefined) o[k] = p[k]; });
    if (p.id) o.id = p.id;
    return o;
  }
  function addLog(p, icon, text) {
    p.log = (p.log || []).slice(0, 49);
    p.log.unshift({ icon: icon, text: text, at: new Date().toISOString() });
  }

  function fromScan(f) {
    f = f || {}; var o = {}, t = function (v) { return v == null ? "" : String(v).trim(); }, n = function (v) { var x = Number(String(v == null ? "" : v).replace(/[^\d.]/g, "")); return x > 0 ? x : null; };
    ["title", "floor", "region", "city", "hood", "address", "client", "desc"].forEach(function (k) { if (t(f[k])) o[k] = t(f[k]); });
    if (f.deal === "sale" || f.deal === "rent") o.deal = f.deal;
    var ty = TYPES.filter(function (x) { return x.toLowerCase() === t(f.type).toLowerCase(); })[0]; if (ty) o.type = ty;
    var bu = BUILD.filter(function (x) { return x.toLowerCase() === t(f.build).toLowerCase(); })[0]; if (bu) o.build = bu;
    ["price", "area", "rooms", "beds", "baths", "year"].forEach(function (k) { var v = n(f[k]); if (v != null) o[k] = v; });
    if (t(f.summary)) o.desc = [o.desc, "Сканиран документ: " + t(f.summary)].filter(Boolean).join("\n");
    return o;
  }
  function edit(p, scanned, scanFile) {
    var isNew = !p, list = P.list();
    p = p ? JSON.parse(JSON.stringify(stored(p))) : Object.assign({ code: nextCode(list), deal: "sale", type: TYPES[0], status: "Чернова", cond: COND[0], pics: [], docs: [], log: [] }, fromScan(scanned));
    p.pics = p.pics || []; p.docs = p.docs || [];
    var pendingPics = [], pendingDocs = [], removed = [], ctx;
    if (scanFile) { if (/^image\//.test(scanFile.type)) pendingPics.push({ file: scanFile, url: URL.createObjectURL(scanFile), name: scanFile.name || "scan.jpg" }); else pendingDocs.push({ file: scanFile, name: scanFile.name || "scan.pdf" }); }
    var clientNames = P.clientNames();
    function picsHtml() {
      var cells = p.pics.map(function (path, i) {
        return '<div class="ph' + (i === (p.cover || 0) ? " cover" : "") + '" data-pi="' + i + '" style="background-image:url(' + (U.img(path)) + ')" title="Натиснете, за да е основна снимка"><button type="button" data-rmpic="' + i + '" aria-label="Премахни снимката">' + ic("trash-2") + "</button></div>";
      }).concat(pendingPics.map(function (f) { return '<div class="ph" style="background-image:url(' + f.url + ')"></div>'; }));
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
          fld({ id: "p-price", label: "Цена €", icon: "coins", value: p.price, type: "number", required: true }) +
          fld({ id: "p-status", label: "Статус", icon: "megaphone", type: "select", value: p.status, options: STATUS }), { lw: 110 }) +
        G("Характеристики", "ruler", "nd/ph03.jpg",
          fld({ id: "p-area", label: "Площ м²", icon: "m2", value: p.area, type: "number" }) +
          fld({ id: "p-rooms", label: "Стаи", icon: "bed-double", value: p.rooms, type: "number" }) +
          fld({ id: "p-beds", label: "Спални", icon: "bed-double", value: p.beds, type: "number" }) +
          fld({ id: "p-baths", label: "Бани", icon: "bath", value: p.baths, type: "number" }) +
          fld({ id: "p-floor", label: "Етаж", icon: "building-2", value: p.floor, ph: "напр. 3 / 6" }) +
          fld({ id: "p-year", label: "Година", icon: "calendar", value: p.year, type: "number" }) +
          fld({ id: "p-build", label: "Строителство", icon: "brick-wall", type: "select", value: p.build || BUILD[0], options: BUILD }) +
          fld({ id: "p-cond", label: "Състояние", icon: "sparkles", type: "select", value: p.cond, options: COND }), { lw: 130 }) +
        G("Локация", "pin", "nd/ph19.jpg",
          fld({ id: "p-region", label: "Област", icon: "map", value: p.region, ph: "напр. Варна" }) +
          fld({ id: "p-city", label: "Град", icon: "pin", value: p.city, required: true, ph: "напр. Варна" }) +
          fld({ id: "p-hood", label: "Квартал", icon: "pin", value: p.hood, ph: "напр. Левски" }) +
          fld({ id: "p-addr", label: "Адрес", icon: "map-pin-house", value: p.address }), { lw: 110 }) +
        G("Собственик и описание", "user", "nd/ph14.jpg",
          fld({ id: "p-client", label: "Собственик", icon: "user", value: p.client, list: "p-clients", wide: true }) +
          '<datalist id="p-clients">' + clientNames.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist>" +
          fld({ id: "p-desc", label: "Описание", icon: "file-text", value: p.desc, type: "ta", wide: true }), { lw: 130, one: true }) +
        G("Снимки (" + (p.pics.length + pendingPics.length) + ")", "camera", null,
          picsHtml() + U.filebox("p-picin", "Добави снимки", "JPG / PNG · натиснете снимка, за да е основна", { icon: "image", accept: "image/*" }), { one: true }) +
        docsHtml() +
        G("Прикачи документи", "upload", "nd/ph20.jpg", U.filebox("p-docin", "Прикачи файл", "Нотариален акт, скица, данъчна оценка… · плъзнете или изберете"), { one: true });
    }
    function collect(g) {
      var n = function (id) { var v = g(id).replace(/\s/g, "").replace(",", "."); return v === "" ? null : Number(v); };
      p.title = g("p-title"); p.deal = g("p-deal"); p.type = g("p-type"); p.price = n("p-price"); p.area = n("p-area");
      p.rooms = n("p-rooms"); p.beds = n("p-beds"); p.baths = n("p-baths"); p.floor = g("p-floor"); p.build = g("p-build"); p.year = n("p-year");
      p.cond = g("p-cond"); p.status = g("p-status"); p.region = g("p-region") || g("p-city"); p.city = g("p-city"); p.hood = g("p-hood");
      p.address = g("p-addr"); p.client = g("p-client"); p.desc = g("p-desc");
    }
    function rerender() { collect(ctx.get); ctx.rerender(html()); }
    function bind() {
      var pi = ctx.q("p-picin"), di = ctx.q("p-docin");
      if (pi) pi.onchange = function () { [].forEach.call(pi.files, function (f) { pendingPics.push({ file: f, url: URL.createObjectURL(f), name: f.name }); }); rerender(); };
      if (di) di.onchange = function () { [].forEach.call(di.files, function (f) { pendingDocs.push({ file: f, name: f.name }); }); rerender(); };
      var ph = ctx.q("p-pics");
      if (ph) ph.onclick = function (e) {
        var rm = e.target.closest("[data-rmpic]");
        if (rm) { var i = +rm.getAttribute("data-rmpic"); removed.push(p.pics[i]); p.pics.splice(i, 1); if ((p.cover || 0) >= p.pics.length) p.cover = 0; rerender(); return; }
        var c = e.target.closest("[data-pi]"); if (c) { p.cover = +c.getAttribute("data-pi"); rerender(); }
      };
      var dc = ctx.q("p-docs");
      if (dc) dc.onclick = function (e) {
        var o = e.target.closest("[data-opendoc]"), r = e.target.closest("[data-rmdoc]");
        if (o) { var w = window.open("", "_blank"); D.fileUrl(p.docs[+o.getAttribute("data-opendoc")].path).then(function (u) { if (w) w.location = u; else location.href = u; }); }
        if (r) { var i = +r.getAttribute("data-rmdoc"); removed.push(p.docs[i].path); p.docs.splice(i, 1); rerender(); }
      };
    }
    U.open({
      title: isNew ? (scanned ? "Сканиран имот " : "Нов имот ") + p.code : "Редакция – " + (p.title || p.code), icon: isNew ? "house-plus" : "square-pen", photo: "nd/ph17.jpg", html: html(),
      required: ["p-title", "p-price", "p-city"],
      validate: function (g) { if (!(Number(g("p-price").replace(/\s/g, "").replace(",", ".")) >= 0)) return "Цената трябва да е число."; },
      ready: function (x) { ctx = x; bind(); }, ready2: bind,
      onSave: function (g) {
        collect(g);
        var base = "properties/" + (p.code || D.newId()) + "/";
        var up = pendingPics.reduce(function (pr, f) {
          return pr.then(function () {
            var path = base + "photos/" + Date.now() + "-" + f.name.replace(/[^\w.\-]+/g, "_").slice(-60);
            return D.upload(path, f.file).then(function () { p.pics.push(path); });
          });
        }, Promise.resolve());
        up = pendingDocs.reduce(function (pr, f) {
          return pr.then(function () {
            var path = base + "docs/" + Date.now() + "-" + f.name.replace(/[^\w.\-]+/g, "_").slice(-60);
            return D.upload(path, f.file).then(function () { p.docs.push({ name: f.name, path: path, size: f.file.size, mime: f.file.type, at: new Date().toISOString() }); });
          });
        }, up);
        return up.then(function () {
          if (removed.length) removed.forEach(function (x) { D.removeFile(x).catch(function () {}); });
          addLog(p, isNew ? "pencil" : "square-pen", isNew ? "Създаден имот " + p.code : "Редакция на имота" + (pendingPics.length ? " · +" + pendingPics.length + " снимки" : ""));
          return D.put("properties", p);
        }).then(function (s) {
          P.say(isNew ? "Имотът е добавен" : "Имотът е запазен");
          return P.refresh().then(function () { P.reopen(s.id); });
        });
      },
      onDelete: isNew ? null : function () {
        return D.del("properties", p.id).then(function () {
          (p.pics || []).concat((p.docs || []).map(function (d) { return d.path; })).forEach(function (x) { D.removeFile(x).catch(function () {}); });
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

  function more(cur, apply) {
    cur = cur || {};
    U.open({
      title: "Още филтри", icon: "sliders-horizontal", photo: "nd/ph15.jpg", saveText: "Приложи",
      html: U.group("Допълнителни филтри", "sliders-horizontal", "nd/ph10.jpg", fld({ id: "x-beds", label: "Спални – поне", icon: "bed-double", value: cur.beds, type: "number" }) +
        fld({ id: "x-baths", label: "Бани – поне", icon: "bath", value: cur.baths, type: "number" }) +
        fld({ id: "x-client", label: "Собственик / клиент", icon: "user", value: cur.client, list: "x-clients" }) +
        '<datalist id="x-clients">' + P.clientNames().map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist>" +
        fld({ id: "x-fav", label: "Само любими", icon: "heart", type: "select", value: cur.fav ? "1" : "", options: [["", "Не"], ["1", "Да"]] }) +
        fld({ id: "x-photos", label: "Само със снимки", icon: "camera", type: "select", value: cur.photos ? "1" : "", options: [["", "Не"], ["1", "Да"]] }), { lw: 150, one: true }),
      onSave: function (g) {
        var n = function (id) { var v = g(id); return v === "" ? null : Number(v); };
        apply({ beds: n("x-beds"), baths: n("x-baths"), client: g("x-client"), fav: g("x-fav") === "1", photos: g("x-photos") === "1" });
      },
      onDelete: function () { apply(null); }
    });
    var del = document.querySelector("#nd-f-del span"); if (del) del.textContent = "Изчисти";
  }

  window.NDProps = { init: function (h) { P = h; }, edit: edit, setStatus: setStatus, more: more, stored: stored };
})();
