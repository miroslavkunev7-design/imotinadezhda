/* Client card tabs: Редактирай / Нов клиент, Срещи, Документи, Калкулатор, Сделка, Всички активности.
   All records are real (Supabase via crm-data.js) and use the shared form window (crm-ui.js). */
(function () {
  "use strict";
  var U = window.NDUI, D = window.ND;
  var esc = U.esc, ic = U.ic, fld = U.fld, row = U.row, section = U.section, money = U.money;
  var K = null; /* page hooks: {list(), refresh(), reopen(id), say()} */

  var TYPES = ["Апартамент", "Къща", "Парцел", "Офис", "Магазин", "Гараж"];
  var STATUSES = ["Активен", "Потенциален", "В процес", "Неактивен"];
  var SOURCES = ["Сайт / Запитване", "Препоръка", "Телефонно обаждане", "Facebook", "Imot.bg", "OLX", "Друго"];
  var STAGES = ["Нова", "Оглед", "Оферта", "Предварителен договор", "Нотариус", "Приключена", "Отказана"];
  var EVT = [["meeting", "Среща с клиент"], ["viewing", "Оглед на имот"], ["bank", "Банка / кредит"], ["documents", "Подготовка на документи"], ["deal", "Сделка / договор"], ["task", "Задача"]];
  var DOCT = ["Лична карта", "Договор", "Нотариален акт", "Скица", "Удостоверение", "Банкови документи", "Друго"];
  var ACTT = [["phone", "Телефонен разговор"], ["mail", "Имейл"], ["users", "Среща"], ["file-text", "Документ"], ["pencil", "Бележка"]];

  function iso(d) { d = d || new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function log(c, icon, text) {
    return D.put("activities", { client_id: c.id, client: c.name, icon: icon, text: text, at: new Date().toISOString() }).then(function () {
      c.contact_at = new Date().toISOString();
      return D.put("clients", strip(c));
    }).catch(function () {});
  }
  /* keep only stored client fields */
  function strip(c) {
    var o = { id: c.id };
    ["cat", "name", "phone", "email", "egn", "type", "city", "hood", "budget", "status", "source", "notes", "contact_at", "broker"].forEach(function (k) { if (c[k] !== undefined) o[k] = c[k]; });
    return o;
  }
  function after(c) { return K.refresh().then(function () { if (c) K.reopen(c.id); }); }

  /* ---------- Редактирай / Нов клиент ---------- */
  function edit(c, cat) {
    var isNew = !c;
    c = c || { cat: cat || "sales", status: "Активен", source: SOURCES[0], type: TYPES[0] };
    var html =
      fld({ id: "k-name", label: "Име и фамилия", icon: "user-round", value: c.name, required: true, wide: true }) +
      fld({ id: "k-phone", label: "Телефон", icon: "phone", value: c.phone, type: "tel", required: true }) +
      fld({ id: "k-mail", label: "Имейл", icon: "mail", value: c.email, type: "email" }) +
      fld({ id: "k-cat", label: "Клиентът търси", icon: "tag", type: "select", value: c.cat, options: [["sales", "Покупка"], ["rent", "Наем"]] }) +
      fld({ id: "k-type", label: "Вид имот", icon: "house", type: "select", value: c.type, options: TYPES }) +
      fld({ id: "k-city", label: "Град / Област", icon: "pin", value: c.city, ph: "напр. Варна" }) +
      fld({ id: "k-hood", label: "Квартал", icon: "pin", value: c.hood, ph: "напр. Левски" }) +
      fld({ id: "k-budget", label: "Бюджет (€)", icon: "coins", value: c.budget, type: "number", ph: "напр. 200000" }) +
      fld({ id: "k-egn", label: "ЕГН", icon: "id-card", value: c.egn }) +
      fld({ id: "k-status", label: "Статус", icon: "users", type: "select", value: c.status, options: STATUSES }) +
      fld({ id: "k-source", label: "Източник", icon: "tag", type: "select", value: c.source, options: SOURCES }) +
      fld({ id: "k-notes", label: "Бележки", icon: "file-text", value: c.notes, type: "ta", wide: true, ph: "Изисквания, предпочитания…" });
    U.open({
      title: isNew ? "Нов клиент" : "Редакция – " + c.name, icon: isNew ? "user-plus" : "square-pen", photo: "field-home.webp", html: html,
      required: ["k-name", "k-phone"],
      validate: function (g) {
        var m = g("k-mail");
        if (m && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return "Проверете имейла.";
        if (g("k-budget") && !(Number(g("k-budget").replace(",", ".")) >= 0)) return "Бюджетът трябва да е число.";
      },
      onSave: function (g) {
        var o = strip(c);
        o.name = g("k-name"); o.phone = g("k-phone"); o.email = g("k-mail"); o.cat = g("k-cat"); o.type = g("k-type");
        o.city = g("k-city"); o.hood = g("k-hood"); o.budget = g("k-budget") ? Number(g("k-budget").replace(",", ".")) : null;
        o.egn = g("k-egn"); o.status = g("k-status"); o.source = g("k-source"); o.notes = g("k-notes");
        if (isNew) o.contact_at = new Date().toISOString();
        return D.put("clients", o).then(function (saved) {
          return log(saved, isNew ? "user-plus" : "square-pen", isNew ? "Създаден клиент" : "Обновени данни на клиента").then(function () {
            K.say(isNew ? "Клиентът е добавен" : "Промените са запазени");
            return after(saved);
          });
        });
      },
      onDelete: isNew ? null : function () {
        return D.del("clients", c.id).then(function () { K.say("Клиентът е изтрит"); K.closeCard(); return K.refresh(); });
      }
    });
  }

  /* ---------- Срещи (events shared with Календар) ---------- */
  function meetings(c) {
    var list = [], editing = null;
    function rows() {
      var mine = list.filter(function (e) { return e.client_id === c.id || e.client === c.name; })
        .sort(function (a, b) { return (a.date + a.from).localeCompare(b.date + b.from); });
      return section("Срещи и огледи", "calendar-check", mine.map(function (e) {
        var t = (EVT.filter(function (x) { return x[0] === e.type; })[0] || EVT[0])[1];
        return row("calendar-check", e.title || t, t + (e.prop ? " · " + e.prop : "") + (e.desc ? " · " + e.desc : ""), U.bgDate(e.date + "T00:00") + " " + (e.from || "") + (e.to ? "–" + e.to : ""),
          '<button type="button" data-ed="' + esc(e.id) + '" aria-label="Редактирай">' + ic("pencil") + '</button><button type="button" class="rm" data-rm="' + esc(e.id) + '" aria-label="Изтрий">' + ic("trash-2") + "</button>");
      }), "Още няма уговорени срещи с този клиент.");
    }
    function form(e) {
      e = e || { type: "meeting", date: iso(), from: "10:00", to: "11:00" };
      return '<div class="wide" id="k-mlist">' + rows() + "</div>" +
        fld({ id: "m-type", label: "Вид", icon: "tag", type: "select", value: e.type, options: EVT }) +
        fld({ id: "m-title", label: "Заглавие", icon: "pencil", value: e.title, required: true, ph: "напр. Оглед – апартамент, Левски" }) +
        fld({ id: "m-date", label: "Дата", icon: "calendar", value: e.date, type: "date", required: true }) +
        '<div class="ef"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
        fld({ id: "m-from", label: "От", icon: "clock", value: e.from, type: "time" }) + fld({ id: "m-to", label: "До", icon: "clock", value: e.to, type: "time" }) + "</div></div>" +
        fld({ id: "m-prop", label: "Имот", icon: "house", value: e.prop, wide: true, ph: "напр. P-1048 · Тристаен апартамент, Шумен" }) +
        fld({ id: "m-desc", label: "Описание", icon: "file-text", value: e.desc, type: "ta", wide: true });
    }
    var ctx;
    var o = {
      title: "Срещи – " + c.name, icon: "calendar-check", photo: "k-meeting.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Запиши срещата", keepOpen: true,
      required: ["m-title", "m-date"],
      ready: function (x) { ctx = x; D.load("events").then(function (l) { list = l; x.rerender(form()); }); },
      ready2: bind,
      onSave: function (g) {
        var e = editing || { id: D.newId() };
        Object.assign(e, { type: g("m-type"), title: g("m-title"), date: g("m-date"), from: g("m-from"), to: g("m-to"), client: c.name, client_id: c.id, prop: g("m-prop"), desc: g("m-desc"), extra: e.extra || "" });
        var isNew = !editing;
        return D.put("events", e).then(function () {
          if (isNew) list.push(e);
          editing = null;
          K.say(isNew ? "Срещата е записана в календара" : "Срещата е обновена");
          log(c, "calendar-check", (isNew ? "Уговорена: " : "Променена: ") + e.title + " – " + U.bgDate(e.date + "T00:00") + " " + (e.from || ""));
          ctx.rerender(form());
          return false;
        });
      }
    };
    function bind() {
      var box = ctx.q("k-mlist"); if (!box) return;
      box.onclick = function (ev) {
        var r = ev.target.closest("[data-rm]"), ed = ev.target.closest("[data-ed]");
        if (r) {
          var id = r.getAttribute("data-rm");
          if (!r.dataset.ok) { r.dataset.ok = 1; r.style.boxShadow = "0 0 0 3px #c81a3a"; K.say("Натиснете отново за изтриване"); setTimeout(function () { delete r.dataset.ok; r.style.boxShadow = ""; }, 2500); return; }
          D.del("events", id).then(function () { list = list.filter(function (x) { return x.id !== id; }); K.say("Срещата е изтрита"); ctx.rerender(form(editing)); });
        } else if (ed) {
          editing = list.filter(function (x) { return x.id === ed.getAttribute("data-ed"); })[0] || null;
          ctx.rerender(form(editing));
          var t = ctx.q("m-title"); if (t) t.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
    }
    U.open(o);
  }

  /* ---------- Документи (files in private storage) ---------- */
  function docs(c) {
    var list = [], ctx;
    function form() {
      return '<div class="wide" id="k-dlist">' + section("Документи на клиента", "file-text", list.map(function (d) {
        return row("file-text", d.name, (d.folder || "Документ") + " · " + Math.max(1, Math.round((d.size || 0) / 1024)) + " KB", U.bgDate(d.at),
          '<button type="button" data-open="' + esc(d.id) + '" aria-label="Отвори">' + ic("eye") + '</button><button type="button" class="rm" data-rm="' + esc(d.id) + '" aria-label="Изтрий">' + ic("trash-2") + "</button>");
      }), "Още няма качени документи.") + "</div>" +
        fld({ id: "d-type", label: "Вид документ", icon: "tag", type: "select", value: DOCT[0], options: DOCT }) +
        '<div class="ef"><span class="el">' + ic("upload") + 'Файл</span><label class="ndfile" style="position:relative">' + ic("upload") + '<span id="d-fname">Изберете файл (PDF, снимка, Word…)</span><input type="file" id="d-file" multiple></label></div>';
    }
    function bind() {
      var f = ctx.q("d-file");
      if (f) f.onchange = function () { ctx.q("d-fname").textContent = f.files.length ? [].map.call(f.files, function (x) { return x.name; }).join(", ") : "Изберете файл"; };
      var box = ctx.q("k-dlist"); if (!box) return;
      box.onclick = function (ev) {
        var op = ev.target.closest("[data-open]"), rm = ev.target.closest("[data-rm]");
        if (op) {
          var d = list.filter(function (x) { return x.id === op.getAttribute("data-open"); })[0];
          var w = window.open("", "_blank");
          D.fileUrl(d.path).then(function (u) { if (w) w.location = u; else location.href = u; });
        } else if (rm) {
          if (!rm.dataset.ok) { rm.dataset.ok = 1; rm.style.boxShadow = "0 0 0 3px #c81a3a"; K.say("Натиснете отново за изтриване"); setTimeout(function () { delete rm.dataset.ok; rm.style.boxShadow = ""; }, 2500); return; }
          var dd = list.filter(function (x) { return x.id === rm.getAttribute("data-rm"); })[0];
          D.removeFile(dd.path).then(function () { return D.del("documents", dd.id); }).then(function () {
            list = list.filter(function (x) { return x.id !== dd.id; }); K.say("Документът е изтрит"); log(c, "trash-2", "Изтрит документ: " + dd.name); ctx.rerender(form());
          });
        }
      };
    }
    U.open({
      title: "Документи – " + c.name, icon: "file-text", photo: "k-documents.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Качи", keepOpen: true,
      ready: function (x) { ctx = x; D.load("documents", { client_id: c.id }).then(function (l) { list = l.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }); x.rerender(form()); }); },
      ready2: bind,
      validate: function () { var f = ctx.q("d-file"); if (!f || !f.files.length) return "Изберете файл за качване."; if ([].some.call(f.files, function (x) { return x.size > 20 * 1024 * 1024; })) return "Файлът е по-голям от 20 MB."; },
      onSave: function (g) {
        var files = [].slice.call(ctx.q("d-file").files), type = g("d-type");
        return files.reduce(function (p, file) {
          return p.then(function () {
            var safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
            var path = "clients/" + c.id + "/" + Date.now() + "-" + safe;
            return D.upload(path, file).then(function () {
              var d = { client_id: c.id, client: c.name, name: file.name, folder: type, path: path, mime: file.type, size: file.size, at: new Date().toISOString() };
              return D.put("documents", d).then(function (s) { list.unshift(s); });
            });
          });
        }, Promise.resolve()).then(function () {
          K.say(files.length > 1 ? "Документите са качени" : "Документът е качен");
          log(c, "file-text", "Качен документ: " + files.map(function (x) { return x.name; }).join(", "));
          ctx.rerender(form());
          return false;
        });
      }
    });
  }

  /* ---------- Калкулатор (commission + mortgage, real math) ---------- */
  function calc(c) {
    var ctx, rent = c.cat === "rent";
    var html =
      fld({ id: "c-price", label: rent ? "Месечен наем (€)" : "Цена на имота (€)", icon: "coins", value: c.budget || "", type: "number" }) +
      fld({ id: "c-comm", label: rent ? "Комисионна (брой наеми)" : "Комисионна (%)", icon: "handshake", value: rent ? 1 : 3, type: "number", step: "0.1" }) +
      fld({ id: "c-vat", label: "ДДС (%)", icon: "landmark", value: 20, type: "number" }) +
      (rent ? "" :
        fld({ id: "c-down", label: "Самоучастие (%)", icon: "coins", value: 20, type: "number" }) +
        fld({ id: "c-rate", label: "Годишна лихва (%)", icon: "landmark", value: 4.5, type: "number", step: "0.01" }) +
        fld({ id: "c-years", label: "Срок (години)", icon: "calendar", value: 30, type: "number" })) +
      '<div class="ndres" id="c-res"></div>';
    function r2(n) { return Math.round(n * 100) / 100; }
    function compute() {
      var n = function (id) { var v = ctx.num(id); return v == null || isNaN(v) ? 0 : v; };
      var price = n("c-price"), vat = n("c-vat"), comm = rent ? price * n("c-comm") : price * n("c-comm") / 100, cv = comm * vat / 100;
      var h = '<div><span>Комисионна без ДДС</span><b>' + money(r2(comm)) + ' €</b></div><div><span>ДДС</span><b>' + money(r2(cv)) + " €</b></div>" +
        '<div class="big"><span>Комисионна с ДДС</span><b>' + money(r2(comm + cv)) + " €</b></div>";
      if (!rent) {
        var L = price * (1 - n("c-down") / 100), i = n("c-rate") / 100 / 12, m = Math.round(n("c-years") * 12);
        var pay = m > 0 ? (i === 0 ? L / m : L * i / (1 - Math.pow(1 + i, -m))) : 0;
        h += '<div><span>Размер на кредита</span><b>' + money(r2(L)) + ' €</b></div><div><span>Самоучастие</span><b>' + money(r2(price - L)) + " €</b></div>" +
          '<div class="big"><span>Месечна вноска</span><b>' + money(r2(pay)) + " €</b></div>" +
          '<div><span>Обща сума за връщане</span><b>' + money(r2(pay * m)) + ' €</b></div><div><span>Обща лихва</span><b>' + money(r2(pay * m - L)) + " €</b></div>";
      }
      var res = ctx.q("c-res"); if (res) res.innerHTML = h;
      return { price: price, comm: r2(comm + cv) };
    }
    U.open({
      title: "Калкулатор – " + c.name, icon: "calculator", photo: "k-bank.jpg", html: html, saveText: "Запиши в активността", keepOpen: true,
      ready: function (x) { ctx = x; compute(); x.body.oninput = compute; },
      onSave: function () {
        var r = compute();
        return log(c, "calculator", "Изчисление: цена " + money(r.price) + " €, комисионна с ДДС " + money(r.comm) + " €").then(function () { K.say("Изчислението е записано в активността"); return false; });
      }
    });
  }

  /* ---------- Сделка ---------- */
  function deal(c) {
    var list = [], ctx, editing = null;
    function form(d) {
      d = d || { title: (c.cat === "rent" ? "Наем – " : "Покупка – ") + c.name, stage: STAGES[0], commission_pct: c.cat === "rent" ? "" : 3, amount: c.budget || "" };
      return '<div class="wide" id="k-deals">' + section("Сделки на клиента", "handshake", list.map(function (x) {
        var com = x.amount && x.commission_pct ? " · комисионна " + money(x.amount * x.commission_pct / 100) + " €" : "";
        return row("handshake", x.title, (x.stage || "") + (x.amount ? " · " + money(x.amount) + " €" : "") + com + (x.property ? " · " + x.property : ""), x.deadline ? "до " + U.bgDate(x.deadline + "T00:00") : "",
          '<button type="button" data-ed="' + esc(x.id) + '" aria-label="Редактирай">' + ic("pencil") + '</button><button type="button" class="rm" data-rm="' + esc(x.id) + '" aria-label="Изтрий">' + ic("trash-2") + "</button>");
      }), "Още няма сделки с този клиент.") + "</div>" +
        fld({ id: "s-title", label: "Сделка", icon: "handshake", value: d.title, required: true, wide: true }) +
        fld({ id: "s-prop", label: "Имот", icon: "house", value: d.property, ph: "напр. P-1048 · Тристаен, Шумен" }) +
        fld({ id: "s-stage", label: "Етап", icon: "tag", type: "select", value: d.stage, options: STAGES }) +
        fld({ id: "s-amount", label: "Сума (€)", icon: "coins", value: d.amount, type: "number" }) +
        fld({ id: "s-comm", label: "Комисионна (%)", icon: "coins", value: d.commission_pct, type: "number", step: "0.1" }) +
        fld({ id: "s-dead", label: "Краен срок", icon: "calendar", value: d.deadline, type: "date" }) +
        fld({ id: "s-paid", label: "Платено (€)", icon: "coins", value: d.paid, type: "number" }) +
        fld({ id: "s-note", label: "Бележка", icon: "file-text", value: d.note, type: "ta", wide: true });
    }
    function bind() {
      var box = ctx.q("k-deals"); if (!box) return;
      box.onclick = function (ev) {
        var rm = ev.target.closest("[data-rm]"), ed = ev.target.closest("[data-ed]");
        if (rm) {
          if (!rm.dataset.ok) { rm.dataset.ok = 1; rm.style.boxShadow = "0 0 0 3px #c81a3a"; K.say("Натиснете отново за изтриване"); setTimeout(function () { delete rm.dataset.ok; rm.style.boxShadow = ""; }, 2500); return; }
          var id = rm.getAttribute("data-rm");
          D.del("deals", id).then(function () { list = list.filter(function (x) { return x.id !== id; }); K.say("Сделката е изтрита"); ctx.rerender(form(editing)); });
        } else if (ed) {
          editing = list.filter(function (x) { return x.id === ed.getAttribute("data-ed"); })[0] || null;
          ctx.rerender(form(editing));
          var t = ctx.q("s-title"); if (t) t.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
    }
    U.open({
      title: "Сделка – " + c.name, icon: "handshake", photo: "k-deal.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Запиши сделката", keepOpen: true,
      required: ["s-title"],
      ready: function (x) { ctx = x; D.load("deals", { client_id: c.id }).then(function (l) { list = l; x.rerender(form()); }); },
      ready2: bind,
      onSave: function (g) {
        var n = function (id) { var v = g(id).replace(/\s/g, "").replace(",", "."); return v === "" ? null : Number(v); };
        var d = editing || {};
        var isNew = !editing;
        Object.assign(d, { client_id: c.id, client: c.name, title: g("s-title"), property: g("s-prop"), stage: g("s-stage"), amount: n("s-amount"), commission_pct: n("s-comm"), deadline: g("s-dead"), paid: n("s-paid"), note: g("s-note") });
        return D.put("deals", d).then(function (s) {
          if (isNew) list.push(s);
          editing = null;
          K.say(isNew ? "Сделката е записана" : "Сделката е обновена");
          log(c, "handshake", (isNew ? "Нова сделка: " : "Сделка – ") + s.title + " (" + s.stage + ")");
          ctx.rerender(form());
          return false;
        });
      }
    });
  }

  /* ---------- Всички активности ---------- */
  function acts(c) {
    var list = [], ctx;
    function form() {
      return '<div class="wide" id="k-alist">' + section("Всички активности", "clock", list.map(function (a) {
        return row(a.icon || "clock", a.text, "", U.bgDateTime(a.at), '<button type="button" class="rm" data-rm="' + esc(a.id) + '" aria-label="Изтрий">' + ic("trash-2") + "</button>");
      }), "Още няма записана активност.") + "</div>" +
        fld({ id: "a-type", label: "Вид", icon: "tag", type: "select", value: "phone", options: ACTT }) +
        fld({ id: "a-text", label: "Описание", icon: "pencil", value: "", required: true, ph: "напр. Обсъдени параметри на имот" });
    }
    function bind() {
      var box = ctx.q("k-alist"); if (!box) return;
      box.onclick = function (ev) {
        var rm = ev.target.closest("[data-rm]"); if (!rm) return;
        if (!rm.dataset.ok) { rm.dataset.ok = 1; rm.style.boxShadow = "0 0 0 3px #c81a3a"; K.say("Натиснете отново за изтриване"); setTimeout(function () { delete rm.dataset.ok; rm.style.boxShadow = ""; }, 2500); return; }
        var id = rm.getAttribute("data-rm");
        D.del("activities", id).then(function () { list = list.filter(function (x) { return x.id !== id; }); ctx.rerender(form()); K.refresh(); });
      };
    }
    U.open({
      title: "Активност – " + c.name, icon: "clock", photo: "k-notepad.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Добави", keepOpen: true,
      required: ["a-text"],
      ready: function (x) { ctx = x; D.load("activities", { client_id: c.id }).then(function (l) { list = l.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }); x.rerender(form()); }); },
      ready2: bind,
      onSave: function (g) {
        var t = ACTT.filter(function (x) { return x[0] === g("a-type"); })[0];
        var text = t[1] + " – " + g("a-text");
        return D.put("activities", { client_id: c.id, client: c.name, icon: t[0], text: text, at: new Date().toISOString() }).then(function (s) {
          list.unshift(s); c.contact_at = s.at; D.put("clients", strip(c)).catch(function () {});
          K.say("Активността е добавена"); ctx.rerender(form()); K.refresh();
          return false;
        });
      },
      onClose: function () { K.refresh().then(function () { K.reopen(c.id); }); }
    });
  }

  window.NDKTabs = {
    init: function (hooks) { K = hooks; },
    edit: edit, meetings: meetings, docs: docs, calc: calc, deal: deal, acts: acts, log: log, strip: strip
  };
})();
