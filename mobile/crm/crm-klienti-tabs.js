/* Client card tabs: Редактирай / Нов клиент, Срещи, Документи, Калкулатор, Сделка, Всички активности.
   All records are real (Supabase via crm-data.js) and use the shared form window (crm-ui.js). */
(function () {
  "use strict";
  var U = window.NDUI, D = window.ND;
  var esc = U.esc, ic = U.ic, fld = U.fld, row = U.row, section = U.section, money = U.money;
  var K = null; /* page hooks: {list(), refresh(), reopen(id), say()} */

  var TYPES = ["Апартамент", "Мезонет", "Ателие / Таван", "Къща", "Етаж от къща", "Вила", "Парцел", "Земеделска земя", "Офис", "Магазин", "Заведение", "Склад", "Гараж", "Паркомясто", "Хотел", "Промишлен имот"];
  var STATUSES = ["Активен", "Потенциален", "В процес", "Неактивен"];
  var SOURCES = ["Сайт / Запитване", "Препоръка", "Телефонно обаждане", "Facebook", "Imot.bg", "OLX", "Друго"];
  var STAGES = ["Нова", "Оглед", "Оферта", "Предварителен договор", "Нотариус", "Приключена", "Отказана"];
  var EVT = [["meeting", "Среща с клиент"], ["viewing", "Оглед на имот"], ["bank", "Банка / кредит"], ["documents", "Подготовка на документи"], ["deal", "Сделка / договор"], ["task", "Задача"]];
  var PAY = ["", "Кеш", "Банков кредит", "Кеш + кредит", "Неизвестно"];
  var TIMEF = ["", "Спешно – до 1 месец", "1–3 месеца", "3–6 месеца", "Над 6 месеца", "Само се ориентира"];
  var PRIO = ["", "Горещ", "Топъл", "Студен"];
  var CONTACT = ["", "Телефон", "Viber", "WhatsApp", "Имейл", "SMS"];
  var FLOORP = ["", "Без значение", "Не първи", "Не последен", "Не първи и не последен", "Само първи / партер", "Висок етаж"];
  var PL = window.NDPlaces;
  function pick(list, v) { v = String(v == null ? "" : v).trim().toLowerCase(); if (!v) return ""; return list.filter(function (x) { return x && (x.toLowerCase() === v || x.toLowerCase().indexOf(v) === 0 || v.indexOf(x.toLowerCase()) === 0); })[0] || ""; }
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
    ["cat", "name", "phone", "email", "egn", "type", "city", "hood", "budget", "status", "source", "notes", "contact_at", "broker", "rooms", "areaMin", "floorPref", "payment", "timeframe", "priority", "contactPref", "nextContact", "must", "leadType", "leadSource", "leadLink", "isOwner", "ownerPrice", "ownerPaid", "ownerComm", "ownerIban", "ownerAddr", "ownerShare", "contractDate", "contractUntil", "exclusive", "ownerNotes", "ownerProps", "credit", "creditIncome", "docRows", "num"].forEach(function (k) { if (c[k] !== undefined) o[k] = c[k]; });
    return o;
  }
  function after(c) { return K.refresh().then(function () { if (c) K.reopen(c.id); }); }

  /* ---------- Редактирай / Нов клиент ---------- */
  function fromScan(f) {
    f = f || {}; var o = {}, t = function (v) { return v == null ? "" : String(v).trim(); };
    ["name", "phone", "email", "egn", "city", "hood"].forEach(function (k) { if (t(f[k])) o[k] = t(f[k]); });
    if (f.cat === "sales" || f.cat === "rent") o.cat = f.cat;
    var ty = TYPES.filter(function (x) { return x.toLowerCase() === t(f.type).toLowerCase(); })[0]; if (ty) o.type = ty;
    var b = Number(String(f.budget == null ? "" : f.budget).replace(/[^\d.]/g, "")); if (b > 0) o.budget = b;
    var src = SOURCES.filter(function (x) { return t(f.source) && x.toLowerCase().indexOf(t(f.source).toLowerCase()) >= 0; })[0];
    if (src) o.source = src; else if (t(f.source)) o.source = "Друго";
    var notes = [t(f.notes), t(f.summary) ? "Сканиран документ: " + t(f.summary) : "", !src && t(f.source) ? "Източник: " + t(f.source) : ""].filter(Boolean).join("\n");
    if (notes) o.notes = notes;
    var nn = function (v) { var x = Number(String(v == null ? "" : v).replace(/[^\d.]/g, "")); return x > 0 ? x : null; };
    if (nn(f.rooms)) o.rooms = nn(f.rooms); if (nn(f.areaMin)) o.areaMin = nn(f.areaMin);
    [["payment", PAY], ["timeframe", TIMEF], ["priority", PRIO], ["contactPref", CONTACT], ["floorPref", FLOORP]].forEach(function (x) { var v = pick(x[1], f[x[0]]); if (v) o[x[0]] = v; });
    if (t(f.must)) o.must = t(f.must);
    if (PL && o.city) { o.city = PL.city(o.city); if (o.hood) o.hood = PL.hood(o.city, o.hood); }
    return o;
  }
  function attachScan(c, file) {
    if (!file) return Promise.resolve();
    var path = "clients/" + c.id + "/" + Date.now() + "-scan-" + (file.name || "scan").replace(/[^\w.\-]+/g, "_").slice(-60);
    return D.upload(path, file).then(function () {
      return D.put("documents", { client_id: c.id, client: c.name, name: file.name || "Сканиран документ", folder: "Сканиран документ", path: path, mime: file.type, size: file.size, at: new Date().toISOString() });
    }).then(function () { return log(c, "file-text", "Сканиран документ: " + (file.name || "")); }).catch(function () {});
  }
  function hoodOpts(city) { return PL ? (PL.PLACES[PL.city(city)] || []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") : ""; }
  function edit(c, cat, scanned, scanFile) {
    var isNew = !c;
    c = c || Object.assign({ cat: cat || "sales", status: "Активен", source: scanned ? "Друго" : SOURCES[0], type: TYPES[0] }, fromScan(scanned));
    var G = U.group;
    var html =
      G("Основна информация", "user", "nd/ph17.jpg",
        fld({ id: "k-name", label: "Име", icon: "user-round", value: c.name, required: true, wide: true }) +
        fld({ id: "k-phone", label: "Телефон", icon: "phone", value: c.phone, type: "tel", required: true }) +
        fld({ id: "k-mail", label: "Имейл", icon: "mail", value: c.email, type: "email" }) +
        fld({ id: "k-egn", label: "ЕГН", icon: "id-card", value: c.egn }), { lw: 120 }) +
      G("Какво търси", "house", "nd/ph12.jpg",
        fld({ id: "k-cat", label: "Търси", icon: "tag", type: "select", value: c.cat, options: [["sales", "Покупка"], ["rent", "Наем"]] }) +
        fld({ id: "k-type", label: "Вид имот", icon: "house", type: "select", value: c.type, options: TYPES }) +
        fld({ id: "k-city", label: "Град", icon: "pin", value: c.city, ph: "напр. Варна", list: "k-cities" }) +
        fld({ id: "k-hood", label: "Квартал", icon: "pin", value: c.hood, ph: "напр. Левски", list: "k-hoods" }) +
        '<datalist id="k-cities">' + (PL ? PL.cities : []).map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + '</datalist><datalist id="k-hoods">' + hoodOpts(c.city) + "</datalist>" +
        fld({ id: "k-budget", label: "Бюджет €", icon: "coins", value: c.budget, type: "number", ph: "напр. 200000", wide: true }), { lw: 120 }) +
      G("Предпочитания и срокове", "sparkles", "nd/ph05.jpg",
        fld({ id: "k-rooms", label: "Стаи – поне", icon: "bed-double", value: c.rooms, type: "number" }) +
        fld({ id: "k-area", label: "Площ от м²", icon: "m2", value: c.areaMin, type: "number" }) +
        fld({ id: "k-floor", label: "Етаж", icon: "building-2", type: "select", value: c.floorPref || "", options: FLOORP.map(function (x) { return [x, x || "—"]; }) }) +
        fld({ id: "k-pay", label: "Плащане", icon: "coins", type: "select", value: c.payment || "", options: PAY.map(function (x) { return [x, x || "—"]; }) }) +
        fld({ id: "k-time", label: "Срок", icon: "clock", type: "select", value: c.timeframe || "", options: TIMEF.map(function (x) { return [x, x || "—"]; }) }) +
        fld({ id: "k-prio", label: "Приоритет", icon: "star", type: "select", value: c.priority || "", options: PRIO.map(function (x) { return [x, x || "—"]; }) }) +
        fld({ id: "k-cpref", label: "Връзка чрез", icon: "message-square", type: "select", value: c.contactPref || "", options: CONTACT.map(function (x) { return [x, x || "—"]; }) }) +
        fld({ id: "k-next", label: "Следващ контакт", icon: "calendar-check", value: c.nextContact, type: "date" }) +
        fld({ id: "k-must", label: "Задължително", icon: "badge-check", value: c.must, wide: true, ph: "напр. тераса, асансьор, паркинг, ново строителство" }), { lw: 120 }) +
      G("Статус и бележки", "shield", "nd/ph02.jpg",
        fld({ id: "k-status", label: "Статус", icon: "users", type: "select", value: c.status, options: STATUSES }) +
        fld({ id: "k-source", label: "Източник", icon: "tag", type: "select", value: c.source, options: SOURCES }) +
        fld({ id: "k-notes", label: "Бележки", icon: "file-text", value: c.notes, type: "ta", wide: true, ph: "Изисквания, предпочитания…" }), { lw: 120 });
    U.open({
      title: isNew ? (scanned ? "Нов клиент – сканиран" : "Нов клиент") : "Редакция – " + c.name, icon: isNew ? "user-plus" : "square-pen", photo: "nd/ph13.jpg", html: html,
      required: ["k-name", "k-phone"],
      ready: function (x) { var cs = x.q("k-city"), hl = x.q("k-hoods"); if (cs && hl) cs.addEventListener("input", function () { hl.innerHTML = hoodOpts(cs.value); }); },
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
        if (PL && o.city) { o.city = PL.city(o.city); o.hood = PL.hood(o.city, o.hood); }
        var nm = function (id) { var v = g(id).replace(/\s/g, "").replace(",", "."); return v === "" ? null : Number(v); };
        o.rooms = nm("k-rooms"); o.areaMin = nm("k-area"); o.floorPref = g("k-floor"); o.payment = g("k-pay"); o.timeframe = g("k-time");
        o.priority = g("k-prio"); o.contactPref = g("k-cpref"); o.nextContact = g("k-next"); o.must = g("k-must");
        if (isNew) o.contact_at = new Date().toISOString();
        return D.put("clients", o).then(function (saved) {
          return log(saved, isNew ? "user-plus" : "square-pen", isNew ? (scanned ? "Създаден клиент от сканиране" : "Създаден клиент") : "Обновени данни на клиента").then(function () { return isNew ? attachScan(saved, scanFile) : null; }).then(function () {
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


  /* ---------- big "Бележки" block on the client card: write, dictate, save ---------- */
  function notesBlock() {
    var ta = document.getElementById("m-notes"); if (!ta || ta._nd) return; ta._nd = true;
    var st = document.getElementById("m-nstate"), save = document.getElementById("m-nsave"), mic = document.getElementById("m-nmic"), stamp = document.getElementById("m-nstamp");
    function cur() { var w = ta.closest("[data-id]"), id = w && w.dataset.id; return id ? (K.list() || []).filter(function (x) { return x.id === id; })[0] : null; }
    function dirty() { st.textContent = ta.value !== (ta.dataset.orig || "") ? "• незапазено" : ""; }
    ta.addEventListener("input", dirty);
    stamp.onclick = function () {
      var d = new Date(), t = ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
      ta.value = (ta.value.replace(/\s+$/, "") + (ta.value.trim() ? "\n\n" : "") + "— " + t + ": "); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); dirty();
    };
    save.onclick = function () {
      var c = cur(); if (!c) return;
      var o = strip(c); o.notes = ta.value.trim(); save.disabled = true; st.textContent = "Записване…";
      D.put("clients", o).then(function () {
        c.notes = o.notes; ta.dataset.orig = ta.value;
        return D.put("activities", { client_id: c.id, client: c.name, icon: "file-pen", text: "Обновени бележки", at: new Date().toISOString() }).catch(function () {});
      }).then(function () { st.textContent = "✔ Запазено"; K.say("Бележките са запазени"); setTimeout(function () { if (st.textContent === "✔ Запазено") st.textContent = ""; }, 2500); return K.refresh().then(function () { K.reopen(c.id); }); })
        .catch(function (e) { st.textContent = "Грешка"; K.say("Грешка при запис: " + ((e && e.message) || e)); })
        .then(function () { save.disabled = false; });
    };
    /* dictation: tap, speak, tap again – the text is added to the notes */
    var rec = null, chunks = [], stream = null, t0 = 0;
    function mm() { var c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]; for (var i = 0; i < c.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i]; return ""; }
    function label(t) { mic.querySelector("span").textContent = t; }
    mic.onclick = function () {
      if (rec && rec.state === "recording") { rec.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { K.say("Браузърът не поддържа запис на глас"); return; }
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (s) {
        stream = s; chunks = []; var type = mm();
        rec = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          mic.classList.remove("rec"); stream.getTracks().forEach(function (t) { t.stop(); });
          if (Date.now() - t0 < 700 || !chunks.length) { label("Диктувай"); return; }
          var mime = (rec.mimeType || type || "audio/webm").split(";")[0], r = new FileReader();
          label("Разпознавам…"); mic.disabled = true;
          r.onload = function () {
            D.token().then(function (tok) {
              return fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok }, body: JSON.stringify({ mime: mime, data: String(r.result).split(",")[1] }) });
            }).then(function (x) { return x.json(); }).then(function (j) {
              if (j.ok && j.text) { ta.value = ta.value.replace(/\s+$/, "") + (ta.value.trim() && !/: $/.test(ta.value) ? "\n" : (ta.value && !/ $/.test(ta.value) ? " " : "")) + j.text; dirty(); }
              else K.say(j.error || "Не чух ясно – опитайте пак");
            }).catch(function () { K.say("Няма връзка"); }).then(function () { mic.disabled = false; label("Диктувай"); });
          };
          r.readAsDataURL(new Blob(chunks, { type: mime }));
        };
        rec.start(); t0 = Date.now(); mic.classList.add("rec"); label("■ Спри");
        setTimeout(function () { if (rec && rec.state === "recording") rec.stop(); }, 180000);
      }).catch(function () { K.say("Разрешете микрофона за сайта"); });
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", notesBlock); else notesBlock();
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
        U.group(editing ? "Редакция на среща" : "Нова среща", "calendar-check", "nd/ph01.jpg",
        fld({ id: "m-type", label: "Вид", icon: "tag", type: "select", value: e.type, options: EVT }) +
        fld({ id: "m-date", label: "Дата", icon: "calendar", value: e.date, type: "date", required: true }) +
        fld({ id: "m-title", label: "Заглавие", icon: "pencil", value: e.title, required: true, wide: true, ph: "напр. Оглед – апартамент, Левски" }) +
        fld({ id: "m-from", label: "От", icon: "clock", value: e.from, type: "time" }) + fld({ id: "m-to", label: "До", icon: "clock", value: e.to, type: "time" }) +
        fld({ id: "m-prop", label: "Имот", icon: "house", value: e.prop, wide: true, ph: "напр. P-1048 · Тристаен, Шумен" }) +
        fld({ id: "m-desc", label: "Описание", icon: "file-text", value: e.desc, type: "ta", wide: true }), { lw: 110 });
    }
    var ctx;
    var o = {
      title: "Срещи – " + c.name, icon: "calendar-check", photo: "nd/ph16.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Запиши срещата", keepOpen: true,
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
    /* credit document checklist (crm-doclists.js) */
    if (window.NDDocs) {
      return window.NDDocs.client(c, {
        say: function (m) { K.say(m); },
        save: function (patch) { var o = strip(c); Object.keys(patch).forEach(function (k) { o[k] = patch[k]; }); return D.put("clients", o); },
        onUpload: function (title, n) { log(c, "file-text", "Прикачен документ: " + title + (n > 1 ? " (" + n + " файла)" : "")); }
      });
    }
    var list = [], ctx;
    function form() {
      return '<div class="wide" id="k-dlist">' + section("Документи на клиента", "file-text", list.map(function (d) {
        return row("file-text", d.name, (d.folder || "Документ") + " · " + Math.max(1, Math.round((d.size || 0) / 1024)) + " KB", U.bgDate(d.at),
          '<button type="button" data-open="' + esc(d.id) + '" aria-label="Отвори">' + ic("eye") + '</button><button type="button" class="rm" data-rm="' + esc(d.id) + '" aria-label="Изтрий">' + ic("trash-2") + "</button>");
      }), "Още няма качени документи.") + "</div>" +
        U.group("Прикачи файл", "upload", "nd/ph20.jpg",
        fld({ id: "d-type", label: "Вид", icon: "tag", type: "select", value: DOCT[0], options: DOCT, wide: true }) +
        U.filebox("d-file", "Прикачи файл", "PDF, снимка, Word… · плъзнете или изберете", { nameId: "d-fname", icon: "upload" }), { lw: 110, one: true });
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
      title: "Документи – " + c.name, icon: "file-text", photo: "nd/ph06.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Качи", keepOpen: true,
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
    var G = U.group;
    var html = G("Параметри", "calculator", "nd/ph05.jpg",
      fld({ id: "c-price", label: rent ? "Месечен наем (€)" : "Цена на имота (€)", icon: "coins", value: c.budget || "", type: "number" }) +
      fld({ id: "c-comm", label: rent ? "Комисионна (брой наеми)" : "Комисионна (%)", icon: "handshake", value: rent ? 1 : 3, type: "number", step: "0.1" }) +
      fld({ id: "c-vat", label: "ДДС (%)", icon: "landmark", value: 20, type: "number" }) +
      (rent ? "" :
        fld({ id: "c-down", label: "Самоучастие (%)", icon: "coins", value: 20, type: "number" }) +
        fld({ id: "c-rate", label: "Годишна лихва (%)", icon: "landmark", value: 4.5, type: "number", step: "0.01" }) +
        fld({ id: "c-years", label: "Срок (години)", icon: "calendar", value: 30, type: "number" })), { lw: 170 }) +
      G("Резултат", "coins", null, '<div class="ndres" id="c-res"></div>', { one: true });
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
      title: "Калкулатор – " + c.name, icon: "calculator", photo: "nd/ph09.jpg", html: html, saveText: "Запиши в активността", keepOpen: true,
      ready: function (x) { ctx = x; compute(); x.body.oninput = compute; },
      onSave: function () {
        var r = compute();
        return log(c, "calculator", "Изчисление: цена " + money(r.price) + " €, комисионна с ДДС " + money(r.comm) + " €").then(function () { K.say("Изчислението е записано в активността"); return false; });
      }
    });
  }


  /* ---------- Собственик: the client as owner – his data, properties and the amount due to him ---------- */
  function owner(c) {
    var G = U.group, props = [], ctx;
    var due = function (o) { var a = Number(o.ownerPrice) || 0, b = Number(o.ownerPaid) || 0; return a ? money(Math.max(0, a - b)) + " €" : "—"; };
    function form() {
      var mine = props.filter(function (p) { return (p.client || "") === c.name || (c.ownerProps || []).indexOf(p.code) >= 0; });
      return '<div class="wide">' + section("Имоти на собственика (" + mine.length + ")", "house", mine.map(function (p) {
          return row("house", (p.num ? "И#" + p.num + " · " : "") + (p.title || p.code), [p.city, p.hood].filter(Boolean).join(", ") + (p.price ? " · " + money(p.price) + " €" : "") + (p.ownerPrice ? " · към собственика " + money(p.ownerPrice) + " €" : ""), p.status || "",
            '<a href="crm-imoti.html#' + esc(p.id) + '" aria-label="Отвори имота">' + ic("arrow-r") + "</a>");
        }), "Още няма имоти с този собственик – посочете го в картата на имота.") + "</div>" +
        G("Данни на собственика", "user-round", "nd/ph14.jpg",
          fld({ id: "w-is", label: "Собственик на имот", icon: "user", type: "select", value: c.isOwner ? "1" : "", options: [["", "Не"], ["1", "Да"]] }) +
          fld({ id: "w-share", label: "Дял от имота %", icon: "layout-grid", value: c.ownerShare, type: "number" }) +
          fld({ id: "w-addr", label: "Адрес за кореспонденция", icon: "map-pin-house", value: c.ownerAddr, wide: true }) +
          fld({ id: "w-props", label: "Кодове на имоти", icon: "house", value: (c.ownerProps || []).join(", "), wide: true, ph: "напр. P-1001, P-1005", list: "w-plist" }) +
          '<datalist id="w-plist">' + props.map(function (p) { return '<option value="' + esc(p.code) + '">' + esc(p.title || "") + "</option>"; }).join("") + "</datalist>", { lw: 160 }) +
        G("Сума към собственика", "coins", "nd/ph16.jpg",
          fld({ id: "w-price", label: "Сума към собственика €", icon: "coins", value: c.ownerPrice, type: "number" }) +
          fld({ id: "w-paid", label: "Платено €", icon: "circle-dollar-sign", value: c.ownerPaid, type: "number" }) +
          '<div class="ef"><label class="el">Остатък</label><b id="w-due" style="font:700 26px var(--serif);color:#7a0f22">' + due(c) + "</b></div>" +
          fld({ id: "w-comm", label: "Комисионна от него %", icon: "coins", value: c.ownerComm, type: "number", step: "0.1" }) +
          fld({ id: "w-iban", label: "IBAN за плащане", icon: "landmark", value: c.ownerIban, wide: true }), { lw: 160 }) +
        G("Договор за посредничество", "file-pen", "nd/ph04.jpg",
          fld({ id: "w-cdate", label: "Подписан на", icon: "calendar", value: c.contractDate, type: "date" }) +
          fld({ id: "w-cuntil", label: "Валиден до", icon: "calendar-check", value: c.contractUntil, type: "date" }) +
          fld({ id: "w-excl", label: "Ексклузив", icon: "star", type: "select", value: c.exclusive ? "1" : "", options: [["", "Не"], ["1", "Да"]] }) +
          fld({ id: "w-notes", label: "Бележки", icon: "file-text", value: c.ownerNotes, type: "ta", wide: true }), { lw: 160 });
    }
    U.open({ title: "Собственик – " + c.name, icon: "user-round", photo: "nd/ph13.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Запази",
      ready: function (x) { ctx = x; D.load("properties").then(function (l) { props = l; x.rerender(form()); }).catch(function () { x.rerender(form()); }); },
      ready2: function () { var a = ctx.q("w-price"), b = ctx.q("w-paid"), d = ctx.q("w-due"); [a, b].forEach(function (e) { if (e) e.addEventListener("input", function () { d.textContent = due({ ownerPrice: ctx.num("w-price"), ownerPaid: ctx.num("w-paid") }); }); }); },
      onSave: function (g) {
        var n = function (id) { var v = g(id).replace(/\s/g, "").replace(",", "."); return v === "" ? null : Number(v); };
        var o = strip(c);
        Object.assign(o, { isOwner: g("w-is") === "1", ownerShare: n("w-share"), ownerAddr: g("w-addr"), ownerProps: g("w-props").split(/[,;\s]+/).filter(Boolean),
          ownerPrice: n("w-price"), ownerPaid: n("w-paid"), ownerComm: n("w-comm"), ownerIban: g("w-iban"), contractDate: g("w-cdate"), contractUntil: g("w-cuntil"), exclusive: g("w-excl") === "1", ownerNotes: g("w-notes") });
        return D.put("clients", o).then(function (s) { return log(s, "user-round", "Обновени данни като собственик"); }).then(function () { K.say("Данните за собственика са запазени"); return after(c); });
      } });
  }
  /* ---------- Сделка ---------- */
  function deal(c) {
    var list = [], ctx, editing = null;
    function form(d) {
      d = d || { title: (c.cat === "rent" ? "Наем – " : "Покупка – ") + c.name, stage: STAGES[0], commission_pct: c.cat === "rent" ? "" : 3, amount: c.budget || "" };
      return '<div class="wide" id="k-deals">' + section("Сделки на клиента", "handshake", list.map(function (x) {
        var ct = U.commTotal(x), com = ct ? " · комисионна " + money(ct) + " €" : "";
        return row("handshake", x.title, (x.stage || "") + (x.amount ? " · " + money(x.amount) + " €" : "") + com + (x.property ? " · " + x.property : ""), x.deadline ? "до " + U.bgDate(x.deadline + "T00:00") : "",
          '<button type="button" data-ed="' + esc(x.id) + '" aria-label="Редактирай">' + ic("pencil") + '</button><button type="button" class="rm" data-rm="' + esc(x.id) + '" aria-label="Изтрий">' + ic("trash-2") + "</button>");
      }), "Още няма сделки с този клиент.") + "</div>" +
        U.group(editing ? "Редакция на сделка" : "Нова сделка", "handshake", "nd/ph18.jpg",
        fld({ id: "s-title", label: "Сделка", icon: "handshake", value: d.title, required: true, wide: true }) +
        fld({ id: "s-prop", label: "Имот", icon: "house", value: d.property, ph: "напр. P-1048 · Тристаен, Шумен" }) +
        fld({ id: "s-stage", label: "Етап", icon: "tag", type: "select", value: d.stage, options: STAGES }) +
        fld({ id: "s-amount", label: "Сума (€)", icon: "coins", value: d.amount, type: "number" }) +
        fld({ id: "s-dead", label: "Краен срок", icon: "calendar", value: d.deadline, type: "date" }) +
        fld({ id: "s-note", label: "Бележка", icon: "file-text", value: d.note, type: "ta", wide: true }), { lw: 120 }) +
        U.commHtml(d) + U.calcHtml(c.cat === "rent", true);
    }
    function bind() {
      if (ctx.q("cm-res")) U.commBind(ctx, "s-amount");
      if (ctx.q("k-res")) U.calcBind(ctx, "s-amount", null);
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
      title: "Сделка – " + c.name, icon: "handshake", photo: "nd/ph11.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Запиши сделката", keepOpen: true,
      required: ["s-title"],
      ready: function (x) { ctx = x; D.load("deals", { client_id: c.id }).then(function (l) { list = l; x.rerender(form()); }); },
      ready2: bind,
      onSave: function (g) {
        var n = function (id) { var v = g(id).replace(/\s/g, "").replace(",", "."); return v === "" ? null : Number(v); };
        var d = editing || {};
        var isNew = !editing;
        Object.assign(d, { client_id: c.id, client: c.name, title: g("s-title"), property: g("s-prop"), stage: g("s-stage"), amount: n("s-amount"), deadline: g("s-dead"), note: g("s-note") }, U.commSave(ctx, n("s-amount")));
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
        U.group("Нова активност", "pencil", "nd/ph04.jpg",
        fld({ id: "a-type", label: "Вид", icon: "tag", type: "select", value: "phone", options: ACTT, wide: true }) +
        fld({ id: "a-text", label: "Описание", icon: "pencil", value: "", required: true, wide: true, ph: "напр. Обсъдени параметри на имот" }), { lw: 120, one: true });
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
      title: "Активност – " + c.name, icon: "clock", photo: "nd/ph15.jpg", html: '<div class="wide ndempty">Зареждане…</div>', saveText: "Добави", keepOpen: true,
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
    owner: owner,
    init: function (hooks) { K = hooks; },
    saveField: function (c, patch) {
      var o = strip(c); Object.keys(patch).forEach(function (k) { o[k] = patch[k]; });
      if (PL && patch.city !== undefined) { o.city = PL.city(o.city); if (o.hood) o.hood = PL.hood(o.city, o.hood); }
      if (PL && patch.hood !== undefined && o.city) o.hood = PL.hood(o.city, o.hood);
      return D.put("clients", o).then(function () { Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return o; });
    },
    OPTS: { TYPES: TYPES, STATUSES: STATUSES, SOURCES: SOURCES, PAY: PAY, TIMEF: TIMEF, PRIO: PRIO, CONTACT: CONTACT, FLOORP: FLOORP },
    edit: edit, meetings: meetings, docs: docs, calc: calc, deal: deal, acts: acts, log: log, strip: strip
  };
})();
