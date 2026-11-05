/* Global CRM windows available on every page: Сделки, Документи, Отчети (bottom menu),
   Известия, Търсене, Настройки (header), Калкулатор, Всички дейности. Real data via crm-data.js. */
(function () {
  "use strict";
  var U = window.NDUI, D = window.ND;
  var esc = U.esc, ic = U.ic, fld = U.fld, row = U.row, section = U.section, money = U.money;
  var STAGES = ["Нова", "Оглед", "Оферта", "Предварителен договор", "Нотариус", "Приключена", "Отказана"];
  function say(m) { D.say(m); }
  function iso(d) { d = d || new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function confirmBtn(b, fn) {
    if (!b.dataset.ok) { b.dataset.ok = 1; b.style.boxShadow = "0 0 0 3px #c81a3a"; say("Натиснете отново за изтриване"); setTimeout(function () { delete b.dataset.ok; b.style.boxShadow = ""; }, 2500); return; }
    fn();
  }
  function go(url) { if (window.goTo) window.goTo(url); else location.href = url; }

  /* ---------- Сделки ---------- */
  function deals(opts) {
    opts = opts || {};
    var list = [], clients = [], ctx, editing = null;
    function form(d) {
      d = d || { stage: STAGES[0], commission_pct: 3 };
      var rows = list.slice().sort(function (a, b) { return String(b._updated).localeCompare(String(a._updated)); }).map(function (x) {
        var com = x.amount && x.commission_pct ? " · комисионна " + money(x.amount * x.commission_pct / 100) + " €" : "";
        return row("handshake", x.title, (x.client ? x.client + " · " : "") + (x.stage || "") + (x.amount ? " · " + money(x.amount) + " €" : "") + com, x.deadline ? "до " + U.bgDate(x.deadline + "T00:00") : "",
          '<button type="button" data-ed="' + esc(x.id) + '" aria-label="Редактирай">' + ic("pencil") + '</button><button type="button" class="rm" data-rm="' + esc(x.id) + '" aria-label="Изтрий">' + ic("trash-2") + "</button>");
      });
      return '<div class="wide" id="g-deals">' + section("Всички сделки (" + list.length + ")", "handshake", rows, "Още няма сделки.") + "</div>" +
        U.group(editing ? "Редакция на сделка" : "Нова сделка", "handshake", "nd/ph18.jpg",
        fld({ id: "s-title", label: "Сделка", icon: "handshake", value: d.title, required: true, wide: true, ph: "напр. Продажба – тристаен, Шумен" }) +
        fld({ id: "s-client", label: "Клиент", icon: "user", type: "select", value: d.client_id || "", options: [["", "— без клиент —"]].concat(clients.map(function (c) { return [c.id, c.name]; })) }) +
        fld({ id: "s-prop", label: "Имот", icon: "house", value: d.property }) +
        fld({ id: "s-stage", label: "Етап", icon: "tag", type: "select", value: d.stage, options: STAGES }) +
        fld({ id: "s-amount", label: "Сума (€)", icon: "coins", value: d.amount, type: "number" }) +
        fld({ id: "s-comm", label: "Комисионна (%)", icon: "coins", value: d.commission_pct, type: "number", step: "0.1" }) +
        fld({ id: "s-dead", label: "Краен срок", icon: "calendar", value: d.deadline, type: "date" }) +
        fld({ id: "s-paid", label: "Платено (€)", icon: "coins", value: d.paid, type: "number" }) +
        fld({ id: "s-note", label: "Бележка", icon: "file-text", value: d.note, type: "ta", wide: true }), { lw: 120 });
    }
    function bind() {
      var box = ctx.q("g-deals"); if (!box) return;
      box.onclick = function (e) {
        var rm = e.target.closest("[data-rm]"), ed = e.target.closest("[data-ed]");
        if (rm) confirmBtn(rm, function () { var id = rm.getAttribute("data-rm"); D.del("deals", id).then(function () { list = list.filter(function (x) { return x.id !== id; }); say("Сделката е изтрита"); ctx.rerender(form()); }); });
        if (ed) { editing = list.filter(function (x) { return x.id === ed.getAttribute("data-ed"); })[0]; ctx.rerender(form(editing)); var t = ctx.q("s-title"); if (t) t.scrollIntoView({ behavior: "smooth", block: "center" }); }
      };
    }
    U.open({
      title: "Сделки", icon: "handshake", photo: "nd/ph11.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Запиши сделката", keepOpen: true, required: ["s-title"],
      ready: function (x) { ctx = x; D.ready().then(function () { return Promise.all([D.load("deals"), D.load("clients")]); }).then(function (r) { list = r[0]; clients = r[1]; x.rerender(form()); if (opts.focusNew) { var t = x.q("s-title"); if (t) t.scrollIntoView({ block: "center" }); } }); },
      ready2: bind,
      onSave: function (g) {
        var n = function (id) { var v = g(id).replace(/\s/g, "").replace(",", "."); return v === "" ? null : Number(v); };
        var c = clients.filter(function (x) { return x.id === g("s-client"); })[0];
        var d = editing || {}, isNew = !editing;
        Object.assign(d, { title: g("s-title"), client_id: c ? c.id : null, client: c ? c.name : "", property: g("s-prop"), stage: g("s-stage"), amount: n("s-amount"), commission_pct: n("s-comm"), deadline: g("s-dead"), paid: n("s-paid"), note: g("s-note") });
        return D.put("deals", d).then(function (s) {
          if (isNew) list.push(s); editing = null;
          if (c) D.put("activities", { client_id: c.id, client: c.name, icon: "handshake", text: (isNew ? "Нова сделка: " : "Сделка – ") + s.title + " (" + s.stage + ")", at: new Date().toISOString() }).catch(function () {});
          say(isNew ? "Сделката е записана" : "Сделката е обновена"); ctx.rerender(form()); return false;
        });
      }
    });
  }

  /* ---------- Документи (all files) ---------- */
  function documents() {
    var docs = [], props = [], ctx;
    function form() {
      var all = docs.map(function (d) { return { name: d.name, sub: (d.folder || "Документ") + (d.client ? " · " + d.client : ""), at: d.at, path: d.path, id: d.id, kind: "doc" }; })
        .concat([].concat.apply([], props.map(function (p) { return (p.docs || []).map(function (d) { return { name: d.name, sub: "Имот " + (p.code || "") + " · " + (p.title || ""), at: d.at, path: d.path }; }); })))
        .sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
      return '<div class="wide" id="g-docs">' + section("Всички документи (" + all.length + ")", "file-text", all.map(function (d, i) {
        return row("file-text", d.name, d.sub, U.bgDate(d.at), '<button type="button" data-open="' + esc(d.path) + '" aria-label="Отвори">' + ic("eye") + "</button>" + (d.kind === "doc" ? '<button type="button" class="rm" data-rm="' + esc(d.id) + '" aria-label="Изтрий">' + ic("trash-2") + "</button>" : ""));
      }), "Още няма качени документи.") + "</div>" +
        U.group("Прикачи файл", "upload", "nd/ph20.jpg",
        fld({ id: "d-type", label: "Вид", icon: "tag", type: "select", value: "Друго", options: ["Договор", "Нотариален акт", "Скица", "Удостоверение", "Фактура", "Банкови документи", "Друго"], wide: true }) +
        U.filebox("d-file", "Прикачи файл", "Плъзнете файл тук или изберете от устройството", { nameId: "d-fname" }), { lw: 110, one: true });
    }
    function bind() {
      var f = ctx.q("d-file"); if (f) f.onchange = function () { ctx.q("d-fname").textContent = f.files.length ? [].map.call(f.files, function (x) { return x.name; }).join(", ") : "Изберете файл"; };
      var box = ctx.q("g-docs"); if (!box) return;
      box.onclick = function (e) {
        var op = e.target.closest("[data-open]"), rm = e.target.closest("[data-rm]");
        if (op) { var w = window.open("", "_blank"); D.fileUrl(op.getAttribute("data-open")).then(function (u) { if (w) w.location = u; else location.href = u; }); }
        if (rm) confirmBtn(rm, function () {
          var d = docs.filter(function (x) { return x.id === rm.getAttribute("data-rm"); })[0];
          D.removeFile(d.path).then(function () { return D.del("documents", d.id); }).then(function () { docs = docs.filter(function (x) { return x.id !== d.id; }); say("Документът е изтрит"); ctx.rerender(form()); });
        });
      };
    }
    U.open({
      title: "Документи", icon: "file-text", photo: "nd/ph06.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Качи", keepOpen: true,
      ready: function (x) { ctx = x; D.ready().then(function () { return Promise.all([D.load("documents"), D.load("properties")]); }).then(function (r) { docs = r[0]; props = r[1]; x.rerender(form()); }); },
      ready2: bind,
      validate: function () { var f = ctx.q("d-file"); if (!f || !f.files.length) return "Изберете файл за качване."; },
      onSave: function (g) {
        var files = [].slice.call(ctx.q("d-file").files), type = g("d-type");
        return files.reduce(function (p, file) {
          return p.then(function () {
            var path = "general/" + Date.now() + "-" + file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
            return D.upload(path, file).then(function () { return D.put("documents", { client_id: null, name: file.name, folder: type, path: path, mime: file.type, size: file.size, at: new Date().toISOString() }); }).then(function (s) { docs.unshift(s); });
          });
        }, Promise.resolve()).then(function () { say("Документът е качен"); ctx.rerender(form()); return false; });
      }
    });
  }

  /* ---------- Отчети ---------- */
  function reports() {
    var ctx;
    U.open({
      title: "Отчети", icon: "chart", photo: "nd/ph18.jpg", html: '<div class="wide ndempty">Изчисляване…</div>', noSave: true,
      ready: function (x) {
        ctx = x;
        D.ready().then(function () { return Promise.all([D.load("clients"), D.load("properties"), D.load("deals"), D.load("events"), D.load("activities")]); }).then(function (r) {
          var cl = r[0], pr = r[1], dl = r[2], ev = r[3], ac = r[4];
          var now = new Date(), m0 = iso(new Date(now.getFullYear(), now.getMonth(), 1)), today = iso(now);
          var active = pr.filter(function (p) { return ["Архивиран", "Продаден"].indexOf(p.status) < 0; });
          var won = dl.filter(function (d) { return d.stage === "Приключена"; }), lost = dl.filter(function (d) { return d.stage === "Отказана"; });
          var open = dl.filter(function (d) { return ["Приключена", "Отказана"].indexOf(d.stage) < 0; });
          var sum = function (a, f) { return a.reduce(function (s, d) { return s + (Number(f(d)) || 0); }, 0); };
          var comm = function (d) { return d.amount && d.commission_pct ? d.amount * d.commission_pct / 100 : 0; };
          var tile = function (l, v, big) { return '<div' + (big ? ' class="big"' : "") + "><span>" + esc(l) + "</span><b>" + esc(v) + "</b></div>"; };
          var stages = STAGES.map(function (s) { var n = dl.filter(function (d) { return d.stage === s; }).length; return n ? row("tag", s, money(sum(dl.filter(function (d) { return d.stage === s; }), function (d) { return d.amount; })) + " €", n + " бр.") : ""; }).filter(Boolean);
          var stat = {}; pr.forEach(function (p) { stat[p.status || "Чернова"] = (stat[p.status || "Чернова"] || 0) + 1; });
          x.rerender(
            '<div class="ndg noimg one"><div class="ndg-h">' + ic("chart") + 'Обобщение</div><div class="ndg-f"><div class="ndres">' +
            tile("Клиенти – покупка", cl.filter(function (c) { return c.cat !== "rent"; }).length) + tile("Клиенти – наем", cl.filter(function (c) { return c.cat === "rent"; }).length) +
            tile("Активни имоти", active.length) + tile("Публикувани имоти", pr.filter(function (p) { return p.status === "Публикуван"; }).length) +
            tile("Отворени сделки", open.length) + tile("Приключени сделки", won.length) +
            tile("Очаквана комисионна (отворени)", money(sum(open, comm)) + " €", true) +
            tile("Реализирана комисионна", money(sum(won, comm)) + " €") + tile("Платено по сделки", money(sum(dl, function (d) { return d.paid; })) + " €") +
            tile("Успеваемост", won.length + lost.length ? Math.round(won.length * 100 / (won.length + lost.length)) + "%" : "—") +
            tile("Събития този месец", ev.filter(function (e) { return e.date >= m0; }).length) +
            tile("Предстоящи събития", ev.filter(function (e) { return e.date >= today; }).length) + tile("Активности този месец", ac.filter(function (a) { return String(a.at).slice(0, 10) >= m0; }).length) +
            "</div></div></div>" +
            section("Сделки по етапи", "handshake", stages, "Още няма сделки.") +
            section("Имоти по статус", "house", Object.keys(stat).map(function (k) { return row("house", k, "", stat[k] + " бр."); }), "Още няма имоти.")
          );
        });
      }
    });
  }

  /* ---------- Известия ---------- */
  function notifications() {
    U.open({
      title: "Известия", icon: "bell", photo: "nd/ph01.jpg", html: '<div class="wide ndempty">Зареждане…</div>', noSave: true,
      ready: function (x) {
        D.ready().then(function () { return Promise.all([D.load("events"), D.load("deals")]); }).then(function (r) {
          var today = iso(), wk = iso(new Date(Date.now() + 7 * 864e5));
          var ev = r[0].filter(function (e) { return e.date >= today && e.date <= wk; }).sort(function (a, b) { return (a.date + a.from).localeCompare(b.date + b.from); });
          var dl = r[1].filter(function (d) { return d.deadline && ["Приключена", "Отказана"].indexOf(d.stage) < 0 && d.deadline <= wk; }).sort(function (a, b) { return a.deadline.localeCompare(b.deadline); });
          x.rerender(
            '<div class="wide" id="g-ntf">' +
            section("Събития – следващите 7 дни", "calendar-check", ev.map(function (e) { return row("calendar-check", e.title, (e.client || "") + (e.prop ? " · " + e.prop : ""), (e.date === today ? "днес" : U.bgDate(e.date + "T00:00")) + " " + (e.from || ""), '<button type="button" data-go="crm-kalendar.html" aria-label="Към календара">' + ic("chev-r") + "</button>"); }), "Няма предстоящи събития.") +
            section("Срокове по сделки", "handshake", dl.map(function (d) { return row(d.deadline < today ? "circle-x" : "handshake", d.title, (d.client || "") + " · " + d.stage, (d.deadline < today ? "просрочен " : "до ") + U.bgDate(d.deadline + "T00:00")); }), "Няма наближаващи срокове.") +
            "</div>");
          var b = x.q("g-ntf"); if (b) b.onclick = function (e) { var g = e.target.closest("[data-go]"); if (g) go(g.getAttribute("data-go")); };
          [].forEach.call(document.querySelectorAll(".bell b"), function (el) { el.textContent = ev.length + dl.length || ""; el.hidden = !(ev.length + dl.length); });
        });
      }
    });
  }

  /* ---------- Търсене ---------- */
  function search() {
    var data = null, ctx;
    function results(q) {
      q = q.toLocaleLowerCase("bg").trim();
      if (!data) return '<div class="ndempty">Зареждане…</div>';
      if (q.length < 2) return '<div class="ndempty">Въведете поне 2 символа.</div>';
      var has = function (o, ks) { return ks.some(function (k) { return String(o[k] || "").toLocaleLowerCase("bg").indexOf(q) >= 0; }); };
      var hits = [];
      data[0].filter(function (c) { return has(c, ["name", "phone", "email", "city", "hood"]); }).forEach(function (c) { hits.push(row("user", c.name, "Клиент · " + (c.phone || "") + (c.city ? " · " + c.city : ""), "", '<button type="button" data-go="crm-klienti.html#' + esc(c.id) + '">' + ic("chev-r") + "</button>")); });
      data[1].filter(function (p) { return has(p, ["code", "title", "city", "hood", "client"]); }).forEach(function (p) { hits.push(row("house", p.title, "Имот " + (p.code || "") + " · " + (p.city || "") + (p.price ? " · " + money(p.price) + " €" : ""), "", '<button type="button" data-go="crm-imoti.html#' + esc(p.id) + '">' + ic("chev-r") + "</button>")); });
      data[2].filter(function (c) { return has(c, ["name", "phone", "email"]) || (c.emps || []).some(function (e) { return has(e, ["name"]); }); }).forEach(function (c) { hits.push(row("building-2", c.name, "Компания" + (c.phone ? " · " + c.phone : ""), "", '<button type="button" data-go="crm-kompanii.html#' + esc(c.id) + '">' + ic("chev-r") + "</button>")); });
      data[3].filter(function (b) { return has(b, ["name", "phone", "email"]); }).forEach(function (b) { hits.push(row("user-round", b.name, "Брокер · " + (b.phone || ""), "", '<button type="button" data-go="crm-brokeri.html#' + esc(b.id) + '">' + ic("chev-r") + "</button>")); });
      return section("Резултати (" + hits.length + ")", "search", hits, "Няма намерени записи.");
    }
    U.open({
      title: "Търсене", icon: "search", photo: "nd/ph10.jpg", html: U.group("Търсене в CRM", "search", null, fld({ id: "g-q", label: "Търси", icon: "search", type: "search", wide: true, ph: "клиент, имот, компания, брокер, телефон…" }), { lw: 90, one: true }) + '<div class="wide" id="g-res"></div>', noSave: true,
      ready: function (x) {
        ctx = x;
        var inp = x.q("g-q"), out = x.q("g-res");
        inp.oninput = function () { out.innerHTML = results(inp.value); };
        out.onclick = function (e) { var g = e.target.closest("[data-go]"); if (g) { U.close(); go(g.getAttribute("data-go")); } };
        setTimeout(function () { inp.focus(); }, 120);
        D.ready().then(function () { return Promise.all([D.load("clients"), D.load("properties"), D.load("companies"), D.load("brokers")]); }).then(function (r) { data = r; out.innerHTML = results(inp.value); });
      }
    });
  }

  /* ---------- Настройки (account) ---------- */
  function settings() {
    D.ready().then(function () {
      var u = D.user || {};
      U.open({
        title: "Настройки", icon: "settings", html:
          '<div class="ndres"><div class="big"><span>Влезли сте като</span><b>' + esc(u.email || "") + "</b></div></div>" +
          section("Акаунт", "user-round", [
            row("lock", "Смяна на парола", "Ще получите имейл с линк за нова парола", "", '<button type="button" data-a="pw" aria-label="Смени паролата">' + ic("mail") + "</button>"),
            row("x", "Изход от CRM", "Излизане от този акаунт на това устройство", "", '<button type="button" class="rm" data-a="out" aria-label="Изход">' + ic("x") + "</button>")
          ]),
        noSave: true,
        ready: function (x) {
          x.body.onclick = function (e) {
            var a = e.target.closest("[data-a]"); if (!a) return;
            if (a.getAttribute("data-a") === "out") D.signOut();
            if (a.getAttribute("data-a") === "pw") window.supabase && D.resetPassword(u.email).then(function (m) { say(m); });
          };
        }
      });
    });
  }

  /* ---------- Калкулатор (no client) ---------- */
  function calculator() {
    var ctx;
    var html = U.group("Параметри", "calculator", "nd/ph05.jpg", fld({ id: "c-price", label: "Цена на имота (€)", icon: "coins", value: 200000, type: "number" }) +
      fld({ id: "c-comm", label: "Комисионна (%)", icon: "handshake", value: 3, type: "number", step: "0.1" }) +
      fld({ id: "c-vat", label: "ДДС (%)", icon: "landmark", value: 20, type: "number" }) +
      fld({ id: "c-down", label: "Самоучастие (%)", icon: "coins", value: 20, type: "number" }) +
      fld({ id: "c-rate", label: "Годишна лихва (%)", icon: "landmark", value: 4.5, type: "number", step: "0.01" }) +
      fld({ id: "c-years", label: "Срок (години)", icon: "calendar", value: 30, type: "number" }), { lw: 170 }) + U.group("Резултат", "coins", null, '<div class="ndres" id="c-res"></div>', { one: true });
    function compute() {
      var n = function (id) { var v = ctx.num(id); return v == null || isNaN(v) ? 0 : v; }, r2 = function (v) { return Math.round(v * 100) / 100; };
      var price = n("c-price"), comm = price * n("c-comm") / 100, cv = comm * n("c-vat") / 100;
      var L = price * (1 - n("c-down") / 100), i = n("c-rate") / 100 / 12, m = Math.round(n("c-years") * 12), pay = m > 0 ? (i === 0 ? L / m : L * i / (1 - Math.pow(1 + i, -m))) : 0;
      var res = ctx.q("c-res"); if (!res) return;
      res.innerHTML = '<div><span>Комисионна без ДДС</span><b>' + money(r2(comm)) + ' €</b></div><div><span>ДДС</span><b>' + money(r2(cv)) + ' €</b></div><div class="big"><span>Комисионна с ДДС</span><b>' + money(r2(comm + cv)) + " €</b></div>" +
        '<div><span>Размер на кредита</span><b>' + money(r2(L)) + ' €</b></div><div><span>Самоучастие</span><b>' + money(r2(price - L)) + ' €</b></div><div class="big"><span>Месечна вноска</span><b>' + money(r2(pay)) + " €</b></div>" +
        '<div><span>Обща сума за връщане</span><b>' + money(r2(pay * m)) + ' €</b></div><div><span>Обща лихва</span><b>' + money(r2(pay * m - L)) + " €</b></div>";
    }
    U.open({ title: "Калкулатор", icon: "calculator", photo: "nd/ph09.jpg", html: html, noSave: true, ready: function (x) { ctx = x; compute(); x.body.oninput = compute; } });
  }

  /* ---------- Всички дейности ---------- */
  function activities() {
    U.open({
      title: "Последни дейности", icon: "clock", photo: "nd/ph15.jpg", html: '<div class="wide ndempty">Зареждане…</div>', noSave: true,
      ready: function (x) {
        D.ready().then(function () { return D.load("activities"); }).then(function (l) {
          l.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
          x.rerender('<div class="wide" id="g-acts">' + section("Всички дейности (" + l.length + ")", "clock", l.slice(0, 300).map(function (a) {
            return row(a.icon || "clock", a.text, a.client || "", U.bgDateTime(a.at), a.client_id ? '<button type="button" data-go="crm-klienti.html#' + esc(a.client_id) + '">' + ic("chev-r") + "</button>" : "");
          }), "Още няма записана активност.") + "</div>");
          x.q("g-acts").onclick = function (e) { var g = e.target.closest("[data-go]"); if (g) { U.close(); go(g.getAttribute("data-go")); } };
        });
      }
    });
  }

  var NAV = { "Сделки": deals, "Документи": documents, "Отчети": reports };
  var MSG = { "Известия": notifications, "Търсене": search, "Настройки": settings, "Сделки": deals, "Нова сделка": function () { deals({ focusNew: true }); }, "Калкулатор": calculator, "Документи": documents, "Всички дейности": activities, "Банка": function () { U.bank({}); } };
  document.addEventListener("click", function (e) {
    if (!e.target.closest) return;
    var n = e.target.closest("[data-nav]");
    if (n && !n.getAttribute("data-href") && NAV[n.getAttribute("data-nav")]) { e.preventDefault(); e.stopImmediatePropagation(); NAV[n.getAttribute("data-nav")](); return; }
    var m = e.target.closest("[data-msg]");
    if (m && MSG[m.getAttribute("data-msg")]) { e.preventDefault(); e.stopImmediatePropagation(); MSG[m.getAttribute("data-msg")](); }
  }, true);

  window.NDGlobal = { deals: deals, documents: documents, reports: reports, notifications: notifications, search: search, settings: settings, calculator: calculator, activities: activities };

  /* badge on the bell: real count of today's events */
  D.ready().then(function () { return D.load("events"); }).then(function (l) {
    var t = iso(), n = l.filter(function (e) { return e.date === t; }).length;
    [].forEach.call(document.querySelectorAll(".bell b"), function (el) { el.textContent = n || ""; el.hidden = !n; });
  }).catch(function () {});
})();

/* every header logo opens the public start page – phones: the mobile home, computers: the desktop site */
(function () {
  function home() { return window.matchMedia("(max-width: 768px)").matches ? "/mobile/home.html" : "/"; }
  function wire() {
    [].forEach.call(document.querySelectorAll('a.logo-link, img.logo, img[src$="assets/logo.png"]'), function (el) {
      var a = el.closest("a") || el;
      if (a.tagName === "A") { a.href = home(); a.setAttribute("aria-label", "Начална страница на сайта"); }
      else { a.style.cursor = "pointer"; a.setAttribute("role", "link"); a.setAttribute("tabindex", "0"); a.setAttribute("aria-label", "Начална страница на сайта"); }
    });
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest('a.logo-link, img.logo, img[src$="assets/logo.png"]'); if (!el) return;
    e.preventDefault(); e.stopPropagation(); location.href = home();
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.matches && e.target.matches('img.logo, img[src$="assets/logo.png"]')) location.href = home(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();
  setTimeout(wire, 1500);
})();
