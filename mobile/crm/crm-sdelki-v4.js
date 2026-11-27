/* CRM · Сделки – табличен изглед и „Карта на сделка“ (27.11)
   • бутон „Карти / Таблица“ в филтрите; изборът се помни на устройството;
   • таблицата: №, снимка, сделка/имот, локация, етап, цена на имота, комисионна/приход, очакван приход, „Отвори ›“,
     отдолу обобщение „Общо очаквани приходи · Общи приходи · Удръжки“ (по видимите сделки, без отказаните);
   • от таблицата „Отвори“ показва картата на сделката: снимка и финален резултат, ключови суми, приходи/удръжки/печалба,
     динамични графи (Агенция · Собственик · Клиент) с молив за промяна и „+ Добави графа“, етап на сделката, дата и статус,
     бутони Преизчисли · Запази като шаблон · Дублирай · Документи · Експорт PDF · Експорт Excel · Запази промените.
   Данните са същите сделки (nd_deals); допълнителните графи се пазят в полето dyn на сделката. */
(function () {
  "use strict";
  var KINDS = ["Продажба", "Покупка", "Наем", "Отдаване под наем", "Замяна", "Лизинг"];
  var PHASES = ["Резервация", "Предварителен договор", "Банка / Одобрение", "Нотариус", "Приключване"];
  var STATUS = ["В процес", "Приключена", "Отказана"];
  var COLS = [["a", "Агенция", "briefcase-business", "Общо за агенцията"], ["o", "Собственик", "user-round", "Нетна сума към собственика"], ["c", "Клиент", "user", "Общо плащане от клиента"]];
  var LSV = "nd_deals_view", LST = "nd_deal_tpl";
  var view = "cards", last = { vl: [], all: [] }, cur = null, urls = {}, asked = {}, docs = null;
  try { view = localStorage.getItem(LSV) === "table" ? "table" : "cards"; } catch (e) {}

  function A() { return window.NDDealsAPI || {}; }
  function $(id) { return document.getElementById(id); }
  function n(v) { v = Number(String(v == null ? "" : v).replace(/\s/g, "").replace(",", ".")); return isFinite(v) ? v : 0; }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ic(x) { return '<svg class="i"><use href="#' + x + '"/></svg>'; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function m(v) { var U = window.NDUI || {}; v = r2(Number(v) || 0); return (U.money ? U.money(v) : String(v)) + " €"; }
  function ms(v) { return (v < 0 ? "− " : "") + m(Math.abs(v)); }
  function say(t) { var D = window.ND; if (D && D.say) D.say(t); }
  function oflow() { return document.querySelector(".oflow"); }
  function deal(id) { return (A().map || {})[id]; }
  function pad(i) { return ("000" + i).slice(-4); }
  /* номер на сделката – по реда на създаване */
  function nums() {
    var map = A().map || {}, l = Object.keys(map).map(function (k) { return map[k]; });
    l.sort(function (a, b) { return String(a._created || a._updated || "").localeCompare(String(b._created || b._updated || "")) || String(a.id).localeCompare(String(b.id)); });
    var o = {}; l.forEach(function (d, i) { o[d.id] = d.num || i + 1; }); return o;
  }
  /* имотът на сделката от списъка с имоти (И#номер, код или заглавие) */
  function prop(d) {
    var ps = A().props || [], t = String(d.property || ""); if (!t || !ps.length) return null;
    var mm = t.match(/И#\s*(\d+)/);
    return ps.filter(function (p) { return mm ? String(p.num) === mm[1] : (p.code && t.indexOf(p.code) >= 0) || (p.title && t.indexOf(p.title) === 0); })[0] || null;
  }
  function loc(d, p) {
    if (p) { var l = [p.city, p.hood].filter(Boolean).join(", ") || p.address || p.title; if (l) return l; }
    var t = String(d.property || "").replace(/^И#\s*\d+\s*·\s*/, "").replace(/^[A-ZА-Я]-?\d+\s*·\s*/, "");
    return t || "—";
  }
  function photo(d, p, i) {
    var path = p && p.pics && p.pics.length ? (p.pics[p.cover || 0] || p.pics[0]) : null;
    if (path && urls[path]) return urls[path];
    var ph = A().ph || [], img = A().img || function (x) { return "assets/" + x; };
    return img(ph[i % (ph.length || 1)] || "card-properties.jpg");
  }
  function signPics(list) {
    var D = window.ND; if (!D || !D.fileUrls) return;
    var need = []; list.forEach(function (d) { var p = prop(d); if (!p || !p.pics || !p.pics.length) return; var path = p.pics[p.cover || 0] || p.pics[0]; if (!urls[path] && !asked[path]) { asked[path] = 1; need.push(path); } });
    if (!need.length) return;
    D.fileUrls(need).then(function (o) { Object.keys(o || {}).forEach(function (k) { urls[k] = o[k]; }); paint(); if (cur) card(); }).catch(function () {});
  }
  function stCls(st) { return A().cls ? A().cls(st) : "wine"; }
  function chip(st) { return A().chip ? A().chip(st) : '<span class="v3-chip">' + esc(st) + "</span>"; }
  function refused(d) { return /Отказ/i.test(d.stage || ""); }

  /* ---------- сметката на сделката ---------- */
  function draft(d) { var x = {}; try { x = JSON.parse(JSON.stringify(d.dyn || {})); } catch (e) {} x.ov = x.ov || {}; x.rows = x.rows || {}; COLS.forEach(function (c) { x.rows[c[0]] = x.rows[c[0]] || []; }); return x; }
  function calc(d, x) {
    x = x || draft(d);
    var c = (A().com || function () { return { buyer: 0, seller: 0, mode: "pct", cb: 0, price: 0 }; })(d), p = prop(d), ov = x.ov || {};
    var P = n(d.amount) || 0, area = n(d.area) || (p ? n(p.area) : 0), loan = n(d.loan);
    var o = function (k, def) { return ov[k] != null && ov[k] !== "" ? n(ov[k]) : def; };
    var b = o("a_client", c.buyer), s = o("a_markup", c.seller), cons = Math.abs(o("a_cons", 0));
    var price = o("c_price", P), oprice = o("o_price", P ? P - s : 0), cl = o("c_loan", loan);
    var cust = function (k) { return (x.rows[k] || []).map(function (r, i) { return { k: k + ":" + i, l: r.l || "Графа", v: (r.s < 0 ? -1 : 1) * Math.abs(n(r.v)), ded: r.s < 0, cust: i, col: k }; }); };
    var rows = {
      a: [{ k: "a_client", l: "Комисионна от клиент", v: b, sub: c.cb ? c.cb + "%" : "" }, { k: "a_markup", l: c.mode === "pct" ? "Комисионна от продавач" : "Горница", v: s }, { k: "a_cons", l: "Дял от консултант", v: -cons, ded: 1 }].concat(cust("a")),
      o: [{ k: "o_price", l: "Договорена цена", v: oprice }, { k: "o_vat", l: "ДДС", v: -Math.abs(o("o_vat", 0)), ded: 1 }, { k: "o_tax", l: "Данък печалба", v: -Math.abs(o("o_tax", 0)), ded: 1 }, { k: "o_ded", l: "Удръжка", v: -Math.abs(o("o_ded", 0)), ded: 1 }].concat(cust("o")),
      c: [{ k: "c_price", l: "Покупна цена", v: price }, { k: "c_loan", l: "Банков кредит", v: cl, info: 1 }, { k: "c_own", l: "Самоучастие", v: Math.max(0, price - cl), info: 1, ro: 1 }, { k: "c_comm", l: "Комисионна", v: b, ro: 1 }].concat(cust("c"))
    };
    var tot = {}; COLS.forEach(function (k) { tot[k[0]] = rows[k[0]].reduce(function (a, r) { return a + (r.info ? 0 : r.v); }, 0); });
    var vatP = n(d.vat), inc = 0, ded = 0;
    rows.a.forEach(function (r) { if (r.v >= 0) inc += r.v; else ded -= r.v; });
    var vat = (b + s) * vatP / 100; ded += vat;
    return { rows: rows, tot: tot, inc: inc, ded: ded, vat: vat, net: inc - ded, P: price, area: area, loan: cl, own: Math.max(0, price - cl), oprice: oprice, b: b, s: s, c: c, p: p };
  }

  /* ---------- филтри: Карти / Таблица ---------- */
  function setView(v) {
    view = v; try { localStorage.setItem(LSV, v); } catch (e) {}
    [].forEach.call(document.querySelectorAll("#v3-view [data-view]"), function (b) { var on = b.getAttribute("data-view") === v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    var f = oflow(); if (f) f.classList.toggle("v4-tbon", v === "table");
    paint();
  }
  function render(vl, all) { last.vl = vl || []; last.all = all || []; signPics(last.all); paint(); if (cur && !deal(cur.id)) close(); }

  function paint() {
    var box = $("v4-tbl"); if (!box) return;
    if (view !== "table") { box.hidden = true; return; }
    box.hidden = false;
    var N = nums(), list = last.vl, T = { inc: 0, ded: 0, net: 0 };
    var head = '<div class="v4-tr v4-th"><span>№</span><span></span><span>Сделка / имот</span><span>Локация</span><span>Етап</span><span>Цена на имота</span><span>Комисионна / приход</span><span>Очакван приход</span><span></span></div>';
    var rows = list.map(function (d, i) {
      var k = calc(d), p = k.p, pct = k.P ? r2(k.inc / k.P * 100) : (k.c.cb || 0);
      if (!refused(d)) { T.inc += k.inc; T.ded += k.ded; T.net += k.net; }
      return '<div class="v4-tr" data-open="' + esc(d.id) + '" data-stage="' + stCls(d.stage) + '">' +
        '<span class="v4-no">' + pad(N[d.id] || i + 1) + "</span>" +
        '<span class="v4-th-img" style="background-image:url(\'' + esc(photo(d, p, i)) + '\')"></span>' +
        '<span class="v4-ti"><b>' + esc(d.title || "Сделка") + "</b><small>" + esc((d.kind || "Сделка") + (d.client ? " · " + d.client : "")) + "</small></span>" +
        '<span class="v4-loc">' + ic("pin") + "<em>" + esc(loc(d, p)) + "</em></span>" +
        '<span class="v4-st">' + chip(d.stage) + "</span>" +
        '<span class="v4-num" data-l="Цена на имота"><b>' + (k.P ? m(k.P) : d.loan ? m(d.loan) : "—") + "</b>" + (!k.P && d.loan ? "<small>кредит</small>" : k.area && k.P ? "<small>" + m(k.P / k.area) + "/м²</small>" : "") + "</span>" +
        '<span class="v4-num" data-l="Комисионна / приход"><b>' + (k.inc ? m(k.inc) : "—") + "</b><small>" + (pct ? String(pct).replace(".", ",") + "%" : "&nbsp;") + "</small></span>" +
        '<span class="v4-exp" data-l="Очакван приход"><i>' + m(k.net) + "</i></span>" +
        '<span class="v4-go"><button type="button" class="v4-open" data-open="' + esc(d.id) + '">Отвори ' + ic("chev-r") + "</button></span></div>";
    }).join("");
    box.innerHTML = '<div class="v4-tw">' + head + (rows || '<div class="v4-none">Няма сделки по избраните филтри.</div>') + "</div>" +
      '<div class="v4-tot"><div class="v4-big">' + ic("coins") + "<div><span>Общо очаквани приходи</span><b>" + m(T.net) + "</b></div></div>" +
      '<div class="v4-sm"><span>Общи приходи</span><b>' + m(T.inc) + '</b></div><div class="v4-sm"><span>Удръжки</span><b>' + (T.ded ? "− " : "") + m(T.ded) + "</b></div></div>";
  }

  /* ---------- „Карта на сделка“ ---------- */
  function phaseOf(d, x) {
    if (x.phase != null) return +x.phase;
    var st = d.stage || ""; return /Приключ/.test(st) ? 4 : /Нотариус/.test(st) ? 3 : /Предварителен/.test(st) ? (d.loan || /кредит/i.test(d.payment || "") ? 2 : 1) : 0;
  }
  function statusOf(st) { return /Приключ/.test(st || "") ? 1 : /Отказ/.test(st || "") ? 2 : 0; }
  function open(id) {
    var d = deal(id); if (!d) return;
    cur = { id: id, x: draft(d), kind: d.kind || "Продажба", stage: d.stage || "Нова", date: d.d_deal || d.d_notary || d.d_pre || "", docs: false, add: false, edit: null };
    var f = oflow(); f.classList.add("v4-cardon"); card();
    setTimeout(function () { var h = $("v4-card"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30);
  }
  function close() {
    cur = null; var f = oflow(); if (f) f.classList.remove("v4-cardon"); var h = $("v4-card"); if (h) { h.hidden = true; h.innerHTML = ""; }
    setTimeout(function () { var t = $("v4-tbl"); if (t && !t.hidden) t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 30);
  }
  function live() { var d = deal(cur.id) || {}; var o = Object.assign({}, d, { kind: cur.kind, stage: cur.stage }); return o; }
  function rowHtml(r) {
    var ed = cur.edit === r.k;
    var val = ed ? '<input class="v4-in" type="number" inputmode="decimal" step="0.01" data-in="' + esc(r.k) + '" value="' + esc(r2(Math.abs(r.v)) || "") + '" placeholder="0">'
      : '<b class="' + (r.ded && r.v < 0 ? "neg" : r.info ? "inf" : "") + '">' + (r.info ? m(r.v) : ms(r.v)) + "</b>";
    return '<div class="v4-r' + (r.info ? " info" : "") + '"><span>' + esc(r.l) + (r.sub ? " <em>(" + esc(r.sub) + ")</em>" : "") + (r.info ? " <em>в т.ч.</em>" : "") + "</span>" + val +
      (r.ro ? '<i class="v4-pen ro"></i>' : '<button type="button" class="v4-pen" data-pen="' + esc(r.k) + '" aria-label="Промени ' + esc(r.l) + '" title="Промени">' + ic(ed ? "check" : "pencil") + "</button>") +
      (r.cust != null ? '<button type="button" class="v4-rx" data-rx="' + esc(r.k) + '" aria-label="Махни графата" title="Махни">' + ic("x") + "</button>" : "") + "</div>";
  }
  function card() {
    var h = $("v4-card"); if (!h || !cur) return; var d0 = deal(cur.id); if (!d0) { close(); return; }
    var d = live(), k = calc(d, cur.x), p = k.p, N = nums(), ph = phaseOf(d, cur.x), st = statusOf(cur.stage);
    var meta = [];
    if (p && (p.floor || p.floor === 0)) meta.push(ic("building-2") + "ет. " + esc(p.floor));
    if (p && p.rooms) meta.push(ic("bed-double") + esc(p.rooms) + (/\d/.test(String(p.rooms)) && !/стай/i.test(String(p.rooms)) ? " стаи" : ""));
    if (k.area) meta.push(ic("m2") + esc(String(r2(k.area)).replace(".", ",")) + " м²");
    var chipC = function (icon, lab, v, sub) { return '<div class="v4-k">' + ic(icon) + "<div><span>" + esc(lab) + "</span><b>" + v + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</div></div>"; };
    var tpl = null; try { tpl = JSON.parse(localStorage.getItem(LST) || "null"); } catch (e) {}
    var hasCust = COLS.some(function (c) { return (cur.x.rows[c[0]] || []).length; });
    h.hidden = false;
    h.innerHTML =
      '<div class="v4-ch"><h3>' + ic("handshake") + "<span>Карта на сделка <em>№ " + pad(N[cur.id] || 1) + "</em></span></h3>" +
      '<label class="v4-kind">' + ic("tag") + '<span><small>Вид сделка</small><b>' + esc(cur.kind) + "</b></span>" + ic("chev-d") + '<select id="v4-kind" aria-label="Вид сделка">' + KINDS.map(function (x) { return '<option' + (x === cur.kind ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + "</select></label>" +
      '<button type="button" class="v4-ib" data-act="full" title="Всички полета на сделката" aria-label="Всички полета на сделката">' + ic("square-pen") + '</button><button type="button" class="v4-ib v4-x" data-act="close" title="Затвори" aria-label="Затвори картата">' + ic("x") + "</button></div>" +
      '<div class="v4-top"><section class="v4-hero"><div class="v4-hph" style="background-image:url(\'' + esc(photo(d, p, 0)) + '\')"></div>' +
      '<div class="v4-hin"><small>' + esc(d.title || "Сделка") + "</small><h4>" + esc(loc(d, p)) + "</h4>" + (meta.length ? '<p class="v4-meta">' + meta.join("<i>·</i>") + "</p>" : "") +
      '<span class="v4-pill s' + st + '"><i></i>' + STATUS[st] + "</span>" +
      '<div class="v4-final"><span>Финален резултат от сделката</span><b>' + ms(k.net) + "</b></div></div>" +
      '<div class="v4-ks">' +
      chipC("coins", "Продажна цена", k.P ? m(k.P) : "—", k.P && k.area ? m(k.P / k.area) + "/м²" : "") +
      chipC("user-round", "Цена за собственика", k.oprice ? m(k.oprice) : "—", "") +
      chipC("landmark", "Банков кредит", k.loan ? m(k.loan) : "—", k.loan && k.P ? "самоучастие " + m(k.own) : "") +
      chipC("tag", k.c.mode === "pct" ? "От продавача" : "Горница", k.s ? m(k.s) : "—", k.s && k.area ? m(k.s / k.area) + "/м²" : "") +
      chipC("handshake", "Комисионна" + (k.c.cb ? " (" + String(k.c.cb).replace(".", ",") + "%)" : ""), k.b ? m(k.b) : "—", "") +
      "</div></section>" +
      '<aside class="v4-sum"><div class="v4-s"><span>' + ic("circle-dollar-sign") + 'Общи приходи</span><b>' + m(k.inc) + '</b></div><div class="v4-s neg"><span>' + ic("landmark") + "Удръжки и данъци</span><b>" + (k.ded ? "− " : "") + m(k.ded) + "</b>" + (k.vat ? "<small>в т.ч. ДДС " + m(k.vat) + "</small>" : "") + '</div><div class="v4-s big"><span>' + ic("badge-check") + "Нетна печалба</span><b>" + ms(k.net) + "</b></div></aside></div>" +
      '<section class="v4-dyn"><h4>' + ic("sliders-horizontal") + "Динамични графи по сделката</h4><div class=\"v4-cols\">" +
      COLS.map(function (c) { return '<div class="v4-col c-' + c[0] + '"><div class="v4-chd">' + ic(c[2]) + "<b>" + c[1] + "</b></div>" + k.rows[c[0]].map(rowHtml).join("") + '<div class="v4-r tot"><span>' + c[3] + "</span><b>" + ms(k.tot[c[0]]) + "</b></div></div>"; }).join("") + "</div>" +
      (cur.add ? '<div class="v4-addf"><label class="v4-f"><small>Към</small><select id="v4-ac">' + COLS.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + "</option>"; }).join("") + '</select></label>' +
        '<label class="v4-f w"><small>Име на графата</small><input id="v4-al" type="text" maxlength="60" placeholder="напр. Такса оценка"></label>' +
        '<label class="v4-f"><small>Сума (€)</small><input id="v4-av" type="number" inputmode="decimal" step="0.01" placeholder="0"></label>' +
        '<label class="v4-f"><small>Вид</small><select id="v4-as"><option value="1">+ Приход</option><option value="-1">− Удръжка</option></select></label>' +
        '<button type="button" class="v4-btn hot" data-act="addok">' + ic("plus") + "Добави</button></div>"
        : '<div class="v4-addr"><button type="button" class="v4-add" data-act="add">' + ic("plus") + "Добави графа</button>" + (tpl && !hasCust ? '<button type="button" class="v4-add lt" data-act="tpl">' + ic("bookmark-plus") + "Приложи шаблон</button>" : "") + "</div>") +
      "</section>" +
      '<section class="v4-step"><h4>' + ic("calendar-check") + "Етап на сделката</h4><ol class=\"v4-ol\">" +
      PHASES.map(function (t, i) { return '<li class="' + (i < ph ? "done" : i === ph ? "on" : "") + '"><button type="button" data-ph="' + i + '"><i>' + (i < ph ? ic("check") : i + 1) + "</i><span>" + t + "</span></button></li>"; }).join("") + "</ol>" +
      '<div class="v4-sf"><label class="v4-f"><small>' + ic("calendar") + 'Дата на сделката</small><input id="v4-date" type="date" value="' + esc(cur.date) + '"></label>' +
      '<label class="v4-f"><small>' + ic("tag") + 'Статус</small><select id="v4-st">' + STATUS.map(function (t, i) { return '<option value="' + i + '"' + (i === st ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select></label>" +
      '<div class="v4-stg"><small>Етап в CRM</small>' + chip(cur.stage) + "</div></div></section>" +
      (cur.docs ? '<section class="v4-docs"><h4>' + ic("file-text") + 'Документи по сделката</h4><div id="v4-dl" class="v4-dl"><p class="v4-mut">Зареждане…</p></div><label class="v4-btn up">' + ic("plus") + 'Прикачи документ<input id="v4-up" type="file" multiple hidden></label></section>' : "") +
      '<div class="v4-acts">' +
      '<button type="button" class="v4-btn" data-act="calc">' + ic("rotate-cw") + "Преизчисли</button>" +
      '<button type="button" class="v4-btn" data-act="tplsave">' + ic("bookmark-plus") + "Запази като шаблон</button>" +
      '<button type="button" class="v4-btn" data-act="dup">' + ic("copy") + "Дублирай сделка</button>" +
      '<button type="button" class="v4-btn' + (cur.docs ? " on" : "") + '" data-act="docs">' + ic("file-text") + "Документи</button>" +
      '<button type="button" class="v4-btn" data-act="pdf">' + ic("file-down") + "Експорт PDF</button>" +
      '<button type="button" class="v4-btn" data-act="xls">' + ic("sheet") + "Експорт Excel</button>" +
      '<button type="button" class="v4-btn hot" data-act="save">' + ic("save") + "Запази промените</button></div>";
    if (cur.docs) loadDocs();
    if (cur.edit) { var inp = h.querySelector('[data-in="' + cur.edit + '"]'); if (inp) { inp.focus(); inp.select(); } }
  }
  function commitEdit() {
    if (!cur || !cur.edit) return; var h = $("v4-card"), inp = h && h.querySelector('[data-in="' + cur.edit + '"]'), k = cur.edit;
    if (inp) {
      var v = inp.value.trim();
      if (k.indexOf(":") > 0) { var a = k.split(":"), r = cur.x.rows[a[0]][+a[1]]; if (r) r.v = Math.abs(n(v)); }
      else if (v === "") delete cur.x.ov[k]; else cur.x.ov[k] = Math.abs(n(v));
    }
    cur.edit = null;
  }

  /* ---------- документи по сделката ---------- */
  function loadDocs() {
    var D = window.ND, box = $("v4-dl"); if (!D || !box) return;
    var show = function () {
      var d = deal(cur.id) || {}, l = (docs || []).filter(function (x) { return x.deal_id === cur.id || (d.client_id && x.client_id === d.client_id); });
      box.innerHTML = l.length ? l.map(function (x) { return '<button type="button" class="v4-doc" data-doc="' + esc(x.path) + '">' + ic("file-text") + "<span><b>" + esc(x.name) + "</b><small>" + esc((x.folder || "Документ") + (x.at ? " · " + String(x.at).slice(0, 10).split("-").reverse().join(".") : "")) + "</small></span>" + ic("chev-r") + "</button>"; }).join("") : '<p class="v4-mut">Още няма документи към тази сделка.</p>';
    };
    if (docs) { show(); return; }
    D.load("documents").then(function (l) { docs = l || []; if (cur && cur.docs) show(); }).catch(function () { box.innerHTML = '<p class="v4-mut">Документите не се заредиха.</p>'; });
  }
  function upload(files) {
    var D = window.ND, d = deal(cur.id) || {}; if (!D || !files.length) return;
    say("Качване…");
    [].slice.call(files).reduce(function (pr, f) {
      return pr.then(function () {
        var path = "deals/" + cur.id + "/" + Date.now() + "-" + f.name.replace(/[^\w.\-]+/g, "_").slice(-80);
        return D.upload(path, f).then(function () { return D.put("documents", { client_id: d.client_id || null, client: d.client || "", deal_id: cur.id, name: f.name, folder: "Сделка", path: path, mime: f.type, size: f.size, at: new Date().toISOString() }); }).then(function (s) { (docs = docs || []).unshift(s); });
      });
    }, Promise.resolve()).then(function () { say("Документът е прикачен"); if (cur) card(); }).catch(function () {});
  }

  /* ---------- експорт ---------- */
  function table(d, k) {
    var L = [["Сделка", d.title || ""], ["Вид", cur.kind], ["Етап", cur.stage], ["Имот", d.property || ""], ["Локация", loc(d, k.p)], ["Дата на сделката", cur.date || ""],
      ["Продажна цена", k.P], ["Цена за собственика", k.oprice], ["Банков кредит", k.loan], ["Самоучастие", k.own], ["Горница / от продавача", k.s], ["Комисионна от клиент", k.b],
      ["Общи приходи", k.inc], ["Удръжки и данъци", -k.ded], ["Нетна печалба", k.net]];
    COLS.forEach(function (c) { k.rows[c[0]].forEach(function (r) { L.push([c[1] + " – " + r.l + (r.info ? " (в т.ч.)" : ""), r.v]); }); L.push([c[3], k.tot[c[0]]]); });
    return L;
  }
  function exportXls() {
    var d = live(), k = calc(d, cur.x), N = nums();
    var q = function (v) { v = typeof v === "number" ? String(r2(v)).replace(".", ",") : String(v == null ? "" : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var csv = "﻿" + [["Карта на сделка № " + pad(N[cur.id] || 1), ""]].concat(table(d, k)).map(function (r) { return r.map(q).join(";"); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "sdelka-" + pad(N[cur.id] || 1) + ".csv";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function exportPdf() {
    var d = live(), k = calc(d, cur.x), N = nums(), w = window.open("", "_blank");
    if (!w) { say("Разрешете изскачащите прозорци за експорт в PDF"); return; }
    var cell = function (v) { return typeof v === "number" ? ms(v) : esc(v); };
    var sec = COLS.map(function (c) { return "<h3>" + c[1] + "</h3><table>" + k.rows[c[0]].map(function (r) { return "<tr" + (r.info ? ' class="i"' : "") + "><td>" + esc(r.l) + (r.info ? " (в т.ч.)" : "") + "</td><td>" + ms(r.v) + "</td></tr>"; }).join("") + '<tr class="t"><td>' + c[3] + "</td><td>" + ms(k.tot[c[0]]) + "</td></tr></table>"; }).join("");
    w.document.write('<!doctype html><html lang="bg"><head><meta charset="utf-8"><title>Сделка № ' + pad(N[cur.id] || 1) + '</title><style>body{font:14px/1.45 Arial,sans-serif;color:#1a0a0c;margin:28px}h1{font:700 24px Georgia,serif;color:#6b0d1d;margin:0 0 4px}h2{font:700 18px Georgia,serif;margin:18px 0 6px;color:#6b0d1d}h3{margin:14px 0 4px;color:#6b0d1d;font-size:15px}table{width:100%;border-collapse:collapse}td{padding:5px 8px;border-bottom:1px solid #e8d3b5}td+td{text-align:right;white-space:nowrap;font-weight:700}tr.t td{border-top:2px solid #c99a4e;font-weight:800}tr.i td{color:#7a5d55}.big{display:flex;gap:14px;margin:14px 0}.big div{flex:1;border:1.5px solid #d9a254;border-radius:12px;padding:10px 12px}.big b{display:block;font-size:20px;color:#6b0d1d}.mut{color:#7a5d55}</style></head><body>' +
      "<h1>Карта на сделка № " + pad(N[cur.id] || 1) + '</h1><div class="mut">Недвижими имоти „Надежда“ · ' + new Date().toLocaleDateString("bg-BG") + "</div>" +
      "<h2>" + esc(d.title || "Сделка") + "</h2><table>" + table(d, k).slice(0, 12).map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + cell(r[1]) + "</td></tr>"; }).join("") + "</table>" +
      '<div class="big"><div>Общи приходи<b>' + m(k.inc) + "</b></div><div>Удръжки и данъци<b>" + (k.ded ? "− " : "") + m(k.ded) + "</b></div><div>Нетна печалба<b>" + ms(k.net) + "</b></div></div>" + sec +
      "<script>setTimeout(function(){print()},300)<\/script></body></html>");
    w.document.close();
  }

  /* ---------- запис ---------- */
  function syncStage(i) {
    var st = cur.stage;
    if (i === 4) st = "Приключена"; else if (i === 3) st = "Нотариус"; else if (i === 1 || i === 2) st = "Предварителен договор";
    else if (/Предварителен|Нотариус|Приключ|Отказ/.test(st)) st = "Оферта";
    cur.stage = st;
  }
  function save() {
    commitEdit();
    var d = deal(cur.id), D = window.ND; if (!d || !D) return;
    d.kind = cur.kind; d.stage = cur.stage; d.d_deal = cur.date || ""; d.dyn = JSON.parse(JSON.stringify(cur.x));
    var k = calc(d, cur.x); d.net_profit = r2(k.net);
    var b = document.querySelector('#v4-card [data-act="save"]'); if (b) b.disabled = true;
    D.put("deals", d).then(function () { say("Сделката е обновена"); var id = cur && cur.id; if (A().reinit) A().reinit(function () { if (cur && id && deal(id)) card(); }); else card(); })
      .catch(function () { if (b) b.disabled = false; });
  }
  function dup() {
    var d = deal(cur.id), D = window.ND; if (!d || !D) return;
    var c = JSON.parse(JSON.stringify(d)); delete c.id; Object.keys(c).forEach(function (k) { if (k.charAt(0) === "_") delete c[k]; });
    c.title = (d.title || "Сделка") + " (копие)"; c.dyn = cur.x; c.kind = cur.kind;
    D.put("deals", c).then(function (s) { say("Сделката е дублирана"); if (A().reinit) A().reinit(function () { if (s && s.id && deal(s.id)) open(s.id); }); });
  }

  function onClick(e) {
    if (!cur) return;
    var t = e.target, act = t.closest("[data-act]"), pen = t.closest("[data-pen]"), rx = t.closest("[data-rx]"), ph = t.closest("[data-ph]"), doc = t.closest("[data-doc]");
    if (pen) { var key = pen.getAttribute("data-pen"); if (cur.edit === key) { commitEdit(); } else { commitEdit(); cur.edit = key; } card(); return; }
    if (rx) { commitEdit(); var a = rx.getAttribute("data-rx").split(":"); cur.x.rows[a[0]].splice(+a[1], 1); card(); return; }
    if (ph) { commitEdit(); var i = +ph.getAttribute("data-ph"); cur.x.phase = i; syncStage(i); card(); return; }
    if (doc) { var D = window.ND, path = doc.getAttribute("data-doc"); if (window.NDDocs && window.NDDocs.view) { window.NDDocs.view($("v4-card"), [{ path: path, name: doc.querySelector("b").textContent }], 0); return; } var w = window.open("", "_blank"); D.fileUrl(path).then(function (u) { if (w) w.location = u; }); return; }
    if (!act) return; var v = act.getAttribute("data-act");
    if (v === "close") { close(); return; }
    commitEdit();
    if (v === "full") { var id = cur.id; close(); setView("cards"); setTimeout(function () { if (A().edit) A().edit(id); }, 60); return; }
    if (v === "add") { cur.add = true; card(); var l = $("v4-al"); if (l) l.focus(); return; }
    if (v === "addok") {
      var col = $("v4-ac").value, lab = $("v4-al").value.trim(), val = n($("v4-av").value), sg = +$("v4-as").value;
      if (!lab) { $("v4-al").focus(); say("Въведете име на графата"); return; }
      cur.x.rows[col].push({ l: lab, v: Math.abs(val), s: sg < 0 ? -1 : 1 }); cur.add = false; card(); return;
    }
    if (v === "tpl") { try { var tp = JSON.parse(localStorage.getItem(LST) || "null"); if (tp) { COLS.forEach(function (c) { cur.x.rows[c[0]] = (tp.rows && tp.rows[c[0]] || []).map(function (r) { return { l: r.l, v: r.v, s: r.s }; }); }); ["a_cons", "o_vat", "o_tax", "o_ded"].forEach(function (k) { if (tp.ov && tp.ov[k] != null) cur.x.ov[k] = tp.ov[k]; }); say("Шаблонът е приложен"); } } catch (er) {} card(); return; }
    if (v === "tplsave") { var ov = {}; ["a_cons", "o_vat", "o_tax", "o_ded"].forEach(function (k) { if (cur.x.ov[k] != null) ov[k] = cur.x.ov[k]; }); try { localStorage.setItem(LST, JSON.stringify({ rows: cur.x.rows, ov: ov, kind: cur.kind })); say("Шаблонът е запазен – ще го видите при „+ Добави графа“ в нова карта"); } catch (er) { say("Шаблонът не е запазен"); } return; }
    if (v === "calc") { Object.keys(cur.x.ov).forEach(function (k) { if (cur.x.ov[k] === "" || cur.x.ov[k] == null) delete cur.x.ov[k]; }); card(); say("Сметката е преизчислена"); return; }
    if (v === "dup") { dup(); return; }
    if (v === "docs") { cur.docs = !cur.docs; card(); if (cur.docs) setTimeout(function () { var s = document.querySelector("#v4-card .v4-docs"); if (s) s.scrollIntoView({ behavior: "smooth", block: "center" }); }, 40); return; }
    if (v === "pdf") { exportPdf(); return; }
    if (v === "xls") { exportXls(); return; }
    if (v === "save") { save(); return; }
  }
  function onChange(e) {
    if (!cur) return; var t = e.target;
    if (t.id === "v4-kind") { cur.kind = t.value; card(); }
    else if (t.id === "v4-date") cur.date = t.value;
    else if (t.id === "v4-st") { var s = +t.value; if (s === 1) { cur.stage = "Приключена"; cur.x.phase = 4; } else if (s === 2) cur.stage = "Отказана"; else { var p = phaseOf(deal(cur.id) || {}, cur.x); cur.stage = ["Оферта", "Предварителен договор", "Предварителен договор", "Нотариус", "Нотариус"][p === 4 ? 3 : p]; if (cur.x.phase === 4) cur.x.phase = 3; } card(); }
    else if (t.id === "v4-up") upload(t.files);
  }
  function onKey(e) {
    if (!cur) return;
    if (e.target.matches && e.target.matches("[data-in]")) { if (e.key === "Enter") { e.preventDefault(); commitEdit(); card(); } else if (e.key === "Escape") { cur.edit = null; card(); } }
  }

  function boot() {
    var vb = $("v3-view"), tb = $("v4-tbl"), cd = $("v4-card"); if (!vb || !tb || !cd) { setTimeout(boot, 80); return; }
    vb.addEventListener("click", function (e) { var b = e.target.closest("[data-view]"); if (b) { if (cur) close(); setView(b.getAttribute("data-view")); } });
    tb.addEventListener("click", function (e) { var r = e.target.closest("[data-open]"); if (r) open(r.getAttribute("data-open")); });
    cd.addEventListener("click", onClick); cd.addEventListener("change", onChange); cd.addEventListener("keydown", onKey);
    cd.addEventListener("focusout", function (e) { if (cur && cur.edit && e.target.matches && e.target.matches("[data-in]")) setTimeout(function () { if (cur && cur.edit && !(document.activeElement && document.activeElement.matches && document.activeElement.matches("[data-in]"))) { commitEdit(); card(); } }, 120); });
    setView(view);
    if (A().refresh) A().refresh();
  }
  window.NDDeals4 = { render: render, open: open, close: close, view: function () { return view; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
