/* ИМОТИ НАДЕЖДА · TASK-008 · „Ново строителство“ – режим за екипа (CRM).
   Четене: /api/tools (projects.list / projects.get / units.get) + четене под RLS (само там, където инструментът нарочно не дава път:
   оригинален план, панорами, дати на медията). Запис: САМО през /api/tools (статус – само units.set_status с изрично потвърждение).
   Токенът отива само в заглавката Authorization, никога в адрес. Правата реално се пазят от сървъра; бутоните само ги отразяват. */
(function () {
  "use strict";
  var NC = window.NC; if (!NC) return;
  var U = NC.util, esc = U.esc, ic = U.ic, F = NC.find, D = NC.dict;
  var admin = false, MEDIA = {}, SIG = {};
  var ID = /^[a-z0-9]{8,64}$/;

  /* ---------- сървър ---------- */
  function tool(name, input) {
    return ND.token().then(function (t) {
      if (!t) throw new Error("Влезте отново в CRM.");
      return fetch("/api/tools", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + t }, body: JSON.stringify({ tool: name, input: input || {} }) });
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "Сървърът върна " + r.status }; }).then(function (j) {
        if (r.ok && j.ok) return j.result;
        var e = new Error(msg(r.status, j)); e.status = r.status; e.issues = j.issues; throw e;
      });
    }, function (e) { if (e && e.status) throw e; throw new Error(e && e.message && /Влезте/.test(e.message) ? e.message : "Няма връзка със сървъра."); });
  }
  function msg(st, j) {
    var m = (j && j.error) || "";
    if (st === 409) return "Някой друг промени записа междувременно – данните са презаредени. Прегледайте ги и опитайте отново.";
    if (st === 403) return m && !/no CRM access/i.test(m) ? m : "Нямате право за това действие.";
    if (st === 401) return "Сесията изтече – влезте отново в CRM.";
    if (st === 404) return m || "Записът не е намерен.";
    if (st === 400 && j && j.issues) return "Невалидни данни: " + j.issues.slice(0, 4).map(function (i) { return (i.path || []).join(".") + " – " + i.message; }).join("; ");
    return m || "Грешка (" + st + ").";
  }
  function call(name, input) { return tool(name, input).catch(function (e) { if (e.status === 409) NC.reload(); throw e; }); }
  function sb() { return ND.sb(); }
  function sign(paths) { paths = paths.filter(function (p) { return p && !SIG[p]; }); if (!paths.length) return Promise.resolve(SIG); return ND.fileUrls(paths).then(function (m) { Object.keys(m).forEach(function (k) { SIG[k] = m[k]; }); return SIG; }); }
  function kindOf(p) { return /\.(mp4|webm|mov)$/i.test(p || "") ? "video" : "image"; }
  function ext(file) { var t = (file && file.type) || ""; if (/jpeg/.test(t)) return "jpg"; if (/png/.test(t)) return "png"; if (/pdf/.test(t)) return "pdf"; if (/webp/.test(t)) return "webp"; if (/mp4/.test(t)) return "mp4"; if (/webm/.test(t)) return "webm"; var m = /\.([a-z0-9]{2,5})$/i.exec(file && file.name || ""); return m ? m[1].toLowerCase() : "bin"; }
  function stamp() { return Date.now().toString(36); }

  /* ---------- модел за екипа ---------- */
  function build(R, rows) {
    var p = R.project, d = p.data || {};
    var md = {}; (rows || []).forEach(function (r) { md[r.id] = r; });
    var M = {
      project: { id: p.id, key: p.id, slug: p.slug, title: d.title || p.name, city: d.city, hood: d.hood, address: d.address, description: d.description, stage: d.stage, stage_percent: d.stage_percent,
        expected_completion: d.expected_completion, advantages: Array.isArray(d.advantages) ? d.advantages : [], price_basis: (d.price_policy && d.price_policy.basis) || "total", location: d.location || null,
        status: p.status, version: p.version, content_rev: p.content_rev, reviewed: p.reviewed, reviewed_at: p.reviewed_at, updated_at: p.updated_at, status_changed_at: p.status_changed_at, data: d },
      buildings: R.buildings.slice().sort(function (a, b) { return (a.sort - b.sort) || String(a.name).localeCompare(String(b.name), "bg"); }),
      floors: R.floors, units: R.units, cover: null, gallery: [], files: [], models: {}, tours: {}
    };
    MEDIA = { models: {} };
    R.media.forEach(function (m) {
      if (m.kind === "cover") M.cover = { path: m.path, title: m.title, url: SIG[m.path] };
      else if (m.kind === "gallery") M.gallery.push({ path: m.path, title: m.title, url: SIG[m.path], type: kindOf(m.path), sort: m.sort });
      else if (m.kind === "file") M.files.push({ path: m.path, title: m.title, access: "public", date: md[m.id] && md[m.id].created_at });
      else if (m.kind === "model") { M.models[m.building_id] = (M.models[m.building_id] || 0) + 1; if (!MEDIA.models[m.building_id]) MEDIA.models[m.building_id] = m.path; }
      else if (m.kind === "tour") M.tours[m.unit_id] = (M.tours[m.unit_id] || 0) + 1;
    });
    if (M.cover && !M.cover.url) M.cover = null;
    M.gallery = M.gallery.filter(function (g) { return g.url; });
    /* документи само за екипа: оригиналните планове (пътят се чете при отваряне, не се показва) */
    M.units.forEach(function (u) { if (u.has_plan) M.files.push({ title: "Оригинален план – " + u.code, access: "private", ref: { unit: u.id }, kindLabel: "План (оригинал)" }); });
    M.floors.forEach(function (f) { if (f.has_plan) M.files.push({ title: "Оригинален етажен план – " + F.bName(R.buildings.filter(function (b) { return b.id === f.building_id; })[0]) + ", " + F.floorName(f), access: "private", ref: { floor: f.id }, kindLabel: "Етажен план (оригинал)" }); });
    return M;
  }
  function privPath(ref) {
    var t = ref.unit ? "nd_units" : "nd_floors", id = ref.unit || ref.floor;
    return sb().from(t).select("id,data").eq("id", id).maybeSingle().then(function (r) { if (r.error) throw new Error("Планът не може да се прочете."); var dd = r.data && r.data.data; return dd && dd.plan && typeof dd.plan.private === "string" ? dd.plan.private : null; });
  }
  function planOf(ref) {
    return privPath(ref).then(function (p) {
      if (!p) return { url: null, why: "Няма качен оригинал." };
      if (/\.pdf$/i.test(p)) return { url: null, why: "Оригиналът е PDF – отворете го от раздел „Документи“. За публичен план е нужен JPG или PNG." };
      return ND.fileUrl(p).then(function (u) { return { url: u, label: "Оригинал – вижда се само от екипа" }; });
    });
  }

  var A = {
    mode: "staff",
    init: function () { return ND.ready().then(function () { return sb().rpc("nd_is_admin"); }).then(function (r) { admin = !!(r && r.data === true); document.body.classList.toggle("nc-admin", admin); }); },
    list: function () {
      return tool("projects.list", {}).then(function (list) {
        var ids = list.map(function (p) { return p.id; });
        var cov = ids.length ? sb().from("nd_project_media").select("project_id,path").eq("kind", "cover").in("project_id", ids).then(function (r) { return r.error ? [] : r.data || []; }) : Promise.resolve([]);
        return cov.then(function (cs) { return sign(cs.map(function (c) { return c.path; })).then(function () { var m = {}; cs.forEach(function (c) { m[c.project_id] = SIG[c.path]; }); return list.map(function (p) { return Object.assign({ key: p.id, cover_url: m[p.id] || null }, p); }); }); });
      });
    },
    project: function (key) {
      if (!ID.test(String(key))) return Promise.resolve(null);
      return tool("projects.get", { id: key }).then(function (R) {
        var paths = R.media.filter(function (m) { return m.path && (m.kind === "cover" || m.kind === "gallery"); }).map(function (m) { return m.path; });
        return Promise.all([sign(paths), sb().from("nd_project_media").select("id,created_at").eq("project_id", R.project.id).then(function (r) { return r.error ? [] : r.data; })]).then(function (x) { return build(R, x[1]); });
      }).catch(function (e) { if (e.status === 404) return null; throw e; });
    },
    unitPlan: function (u) { return planOf({ unit: u.id }); },
    floorPlan: function (f) { return planOf({ floor: f.id }); },
    fileUrl: function (f) { if (f.ref) return privPath(f.ref).then(function (p) { return p ? ND.fileUrl(p) : null; }); return ND.fileUrl(f.path); },
    modelUrl: function (b) { var p = MEDIA.models[b.id]; return p ? ND.fileUrl(p) : Promise.resolve(null); },
    tourItems: function (u) {
      return sb().from("nd_project_media").select("path,title,sort").eq("kind", "tour").eq("unit_id", u.id).order("sort").then(function (r) {
        var rows = r.error ? [] : r.data || [];
        return ND.fileUrls(rows.map(function (x) { return x.path; })).then(function (m) { return rows.map(function (x, i) { return { url: m[x.path], title: x.title || "Помещение " + (i + 1) }; }); });
      });
    },
    shareUrl: function (M, u) { var p = M.project; return p.status === "published" && p.slug ? location.origin + "/mobile/nc.html?p=" + encodeURIComponent(p.slug) + (u ? "&u=" + encodeURIComponent(u.id) : "") : null; },
    canMortgage: function () { return !!(window.NDUI && NDUI.calcHtml); },
    acts: {}
  };

  /* ---------- бутони на екипа ---------- */
  function b(act, icon, text, o) { return NC.ui.btn(act, icon, text, Object.assign({ cls: "sm" }, o || {})); }
  /* КУКА към TASK-006: „Импорт“ зарежда crm-nc-import.js (window.NCImport = {open({projectId, onDone})}) едва при натискане –
     без заявка при всяко отваряне на страницата; ако файлът още не е качен на сайта, казваме го честно. */
  var IMP = null;
  function loadImport() {
    if (window.NCImport && typeof NCImport.open === "function") return Promise.resolve(window.NCImport);
    if (IMP) return IMP;
    IMP = new Promise(function (ok, no) {
      var sc = document.createElement("script"); sc.src = "crm-nc-import.js"; sc.async = true;
      sc.onload = function () { if (window.NCImport && typeof NCImport.open === "function") ok(window.NCImport); else { IMP = null; no(new Error("Импортът не се зареди.")); } };
      sc.onerror = function () { IMP = null; sc.remove(); no(new Error("Импортът на проекти (TASK-006) още не е качен на сайта.")); };
      document.head.appendChild(sc);
    });
    return IMP;
  }
  NC.loadImport = loadImport;
  function importBtn() { return b("import", "upload", "Импорт на проект"); }
  A.listActs = function () { return '<div class="nc-seg">' + b("newproj", "plus", "Нов проект", { cls: "sm hot" }) + importBtn() + "</div>"; };
  A.emptyListActs = function () { return b("newproj", "plus", "Нов проект", { cls: "hot" }) + importBtn(); };
  A.staffBar = function (M) {
    var p = M.project, it = function (act, icon, text, o) { return '<button type="button" role="menuitem" data-act="' + act + '"' + (o || "") + ">" + ic(icon) + "<span>" + esc(text) + "</span></button>"; };
    var h = it("editproj", "square-pen", "Редактирай проекта") + it("addbld", "building-2", "Добави сграда") + it("import", "upload", "Импорт на проект") + it("refresh", "refresh-cw", "Обнови данните");
    if (admin) {
      if (!p.reviewed && p.status !== "archived") h += it("review", "badge-check", "Отбележи като проверен");
      if (p.status !== "published") h += it("publish", "megaphone", "Публикувай");
      if (p.status === "published") h += it("archive", "archive", "Архивирай");
    }
    if (p.status === "published" && p.slug) h += '<a role="menuitem" href="' + esc("/mobile/nc.html?p=" + encodeURIComponent(p.slug)) + '" target="_blank" rel="noopener">' + ic("external-link") + "<span>Публична страница</span></a>";
    if (!admin) h += '<p class="nc-mnote">Проверка, публикуване и архив – само администратор.</p>';
    return '<div class="nc-smenu"><button type="button" class="nc-btn sm gold" data-act="smenu" aria-haspopup="true" aria-expanded="false">' + ic("pencil") + "<span>Действия на екипа</span>" + ic("chev-d") + '</button><div class="nc-smenu-l" role="menu" aria-label="Действия на екипа" hidden>' + h + "</div></div>";
  };
  A.unitActs = function (u) {
    return '<div class="sact" role="group" aria-label="Действия на екипа за ' + esc(u.code) + '">' + b("status", "tag", "Смени статус", { data: 'data-unit="' + esc(u.id) + '"', cls: "sm hot" }) + b("editunit", "square-pen", "Редактирай", { data: 'data-unit="' + esc(u.id) + '"' }) +
      b("uplan", "upload", u.has_plan ? "Смени плана" : "Качи план", { data: 'data-unit="' + esc(u.id) + '"' }) + b("history", "history", "История", { data: 'data-unit="' + esc(u.id) + '"' }) + "</div>";
  };
  A.heroActs = function () { return admin ? b("cover", "upload", "Качи корица", { cls: "sm gold" }) : ""; };
  A.galleryActs = function () { return admin ? b("galmanage", "image", "Управлявай галерията и корицата", { cls: "sm" }) : '<p class="nc-note">Публичната медия се задава от администратор.</p>'; };
  A.docsActs = function () { return admin ? b("docadd", "upload", "Добави публичен документ", { cls: "sm" }) : ""; };
  A.unitsEmptyActs = function () { var M = NC.model(); return M && M.buildings.length ? b("addunit", "plus", "Нов апартамент", { cls: "hot" }) : b("addbld", "building-2", "Добави сграда", { cls: "hot" }); };
  A.planActs = function (f, u) {
    if (!f) return "";
    return '<div class="nc-dtools" role="group" aria-label="Планове – екип">' + b("fplan", "upload", f.has_plan ? "Смени етажния план" : "Качи етажен план", { data: 'data-floor="' + esc(f.id) + '"' }) +
      (f.has_plan ? b("outline", "pen-tool", "Очертай апартаментите", { data: 'data-floor="' + esc(f.id) + '"' }) : "") + (u ? b("uplan", "upload", (u.has_plan ? "Смени плана на " : "Качи план на ") + u.code, { data: 'data-unit="' + esc(u.id) + '"' }) : "") +
      '</div><p class="nc-note" style="color:#3b0a0e">Оригиналите отиват в частна папка на проекта. PDF се приема като оригинал за екипа, но публичен план се прави само от JPG/PNG. Публичното копие с воден знак се генерира от сървъра.</p>';
  };
  A.structHtml = function (M) {
    var h = '<div class="nc-bsec"><h3>' + ic("building-2") + "Сгради и етажи (екип)</h3>";
    if (!M.buildings.length) return h + NC.ui.empty("building-2", "Няма сгради", "Добавете първата сграда на проекта.", b("addbld", "plus", "Добави сграда", { cls: "hot" })) + "</div>";
    M.buildings.forEach(function (bd) {
      var fl = F.floorsOf(bd.id);
      h += '<section class="nc-fsec"><h4>' + ic("building-2") + esc(F.bName(bd)) + '<span class="c">' + b("editbld", "square-pen", "Сграда", { data: 'data-b="' + esc(bd.id) + '"' }) + b("addfloor", "plus", "Етаж", { data: 'data-b="' + esc(bd.id) + '"' }) + "</span></h4>" +
        '<div class="nc-ul">' + (fl.length ? fl.map(function (f) {
          return '<div class="nc-u" style="grid-template-columns:minmax(0,1fr) auto;cursor:default"><span class="code">' + esc(F.floorName(f)) + ' <small style="font:400 20px var(--cond);color:#5b4038">' + esc(F.unitsOf(f.id).length + " обекта · " + (f.has_plan ? "има план" : "без план") + ((f.polygons || []).length ? " · " + f.polygons.length + " очертания" : "")) + "</small></span>" +
            '<span style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' + b("editfloor", "square-pen", "Етаж", { data: 'data-floor="' + esc(f.id) + '"' }) + b("addunit", "plus", "Апартамент", { data: 'data-floor="' + esc(f.id) + '"' }) + b("fplan", "upload", "План", { data: 'data-floor="' + esc(f.id) + '"' }) + "</span></div>";
        }).join("") : '<p class="nc-note" style="padding:14px 20px">Няма етажи.</p>') + "</div></section>";
    });
    return h + "</div>";
  };
  /* оглед в CRM: съществуващият инструмент calendar.create (същата бизнес логика като Календар и Тед) */
  A.contactForms = function (M, u) {
    var today = U.today();
    var f = NC.formHtml("nc-viewing", "Запази оглед (Календар)", "calendar-check",
      NC.input("v-date", "Дата", "date", { req: true, min: today, value: today }) + NC.input("v-from", "От", "time", { req: true, value: "10:00" }) + NC.input("v-to", "До", "time", { req: true, value: "11:00" }) +
      '<label class="nc-fl" for="v-client">Клиент (по избор)<select id="v-client"><option value="">— без клиент —</option></select></label>' +
      NC.input("v-unit", "Апартамент", "select", { value: u ? u.id : "", options: [["", "— целият проект —"]].concat(M.units.map(function (x) { return [x.id, x.code + " – " + D.ST[x.status]]; })) }) +
      NC.input("v-note", "Бележка", "ta", { wide: true, max: 2000 }), "Запази огледа",
      "Записва се в „Календар“ (и в картата на клиента, ако е избран) – същият инструмент като в Календара и при Тед.", NC.PH.viewing);
    var info = NC.ui.card("Запитвания от сайта", "mail", null, '<p class="nc-note">Запитванията и заявките за оглед от публичната страница на проекта влизат автоматично в CRM като клиент + активност (същата логика като обявите на сайта) и се виждат в „Клиенти“. Формата за запитване е само на публичната страница.</p>', "");
    return f + info;
  };
  A.afterPanel = function (tab, M) {
    if (tab !== "contacts") return;
    var form = document.getElementById("nc-viewing"); if (!form) return;
    ND.load("clients").then(function (cl) { var s = document.getElementById("v-client"); if (!s) return; cl.slice().sort(function (a, c) { return String(a.name || "").localeCompare(String(c.name || ""), "bg"); }).slice(0, 2000).forEach(function (c) { var o = document.createElement("option"); o.value = c.id; o.textContent = (c.num ? "К#" + c.num + " · " : "") + (c.name || "Без име"); s.appendChild(o); }); }).catch(function () {});
    NC.bindForm(form, function (fm) {
      var d = fm.querySelector("#v-date"), fr = fm.querySelector("#v-from"), to = fm.querySelector("#v-to");
      if (!/^\d{4}-\d\d-\d\d$/.test(d.value)) return { msg: "Изберете дата.", el: d };
      if (d.value < U.today()) return { msg: "Датата не може да е в миналото.", el: d };
      if (!/^\d\d:\d\d$/.test(fr.value)) return { msg: "Въведете начален час.", el: fr };
      if (!/^\d\d:\d\d$/.test(to.value) || to.value <= fr.value) return { msg: "Крайният час трябва да е след началния.", el: to };
    }, function (fm) {
      var uu = F.unit(fm.querySelector("#v-unit").value), m = NC.model(), prop = (m.project.title || "Проект") + (uu ? " · " + uu.code : "");
      var input = { type: "viewing", title: ("Оглед – " + prop).slice(0, 200), date: fm.querySelector("#v-date").value, from: fm.querySelector("#v-from").value, to: fm.querySelector("#v-to").value, prop: prop.slice(0, 200) };
      var cid = fm.querySelector("#v-client").value; if (cid) input.client_id = cid;
      var note = fm.querySelector("#v-note").value.trim(); if (note) input.desc = note.slice(0, 2000);
      return tool("calendar.create", input).then(function () { return "Огледът е записан в Календара за " + input.date.split("-").reverse().join(".") + ", " + input.from + "–" + input.to + "."; });
    });
  };

  /* ---------- прозорци (същите като в останалите CRM карти: NDUI.open / fld / group) ---------- */
  var fld = function (o) { return NDUI.fld(o); }, grp = function (t, i, ph, h, o) { return NDUI.group(t, i, ph || null, h, Object.assign({ noPhoto: !ph }, o || {})); };
  function num(ctx, id) { var v = ctx.num(id); return v == null || isNaN(v) ? null : v; }
  function pre(h) { return '<div class="nc-pre">' + h + "</div>"; }
  var STAGE_OPTS = [["", "— не е въведен —"]].concat(D.STAGES);

  A.acts.refresh = function () { NC.reload().then(function () { U.say("Данните са обновени."); }); };
  A.acts.import = function (a) {
    if (a && a.getAttribute("aria-busy") === "true") return;
    if (a) a.setAttribute("aria-busy", "true");
    loadImport().then(function () { if (a) a.removeAttribute("aria-busy"); openImport(); }, function (e) { if (a) a.removeAttribute("aria-busy"); U.say(e.message); });
  };
  function openImport() {
    var m = NC.model(); NCImport.open({ projectId: m && NC.state.view === "project" ? m.project.id : null, onDone: function (pid) { if (pid && ID.test(pid)) { if (m && pid === m.project.id) NC.reload(); else NC.open(pid); } else NC.reloadList(); } });
  }
  A.acts.newproj = function () { projForm(null); };
  A.acts.editproj = function () { projForm(NC.model().project); };
  function projForm(p) {
    var d = p || {}, loc = d.location || {};
    var html = grp("Основни данни", "building-2", null, fld({ id: "p-title", label: "Заглавие", required: true, value: d.title || "", wide: true }) + fld({ id: "p-city", label: "Град", value: d.city || "" }) + fld({ id: "p-hood", label: "Квартал", value: d.hood || "" }) +
      fld({ id: "p-address", label: "Адрес", value: d.address || "", wide: true }) + (p ? fld({ id: "p-desc", label: "Описание", type: "ta", value: d.description || "", wide: true }) : ""), { lw: 150 }) +
      (p ? grp("Строителство", "hard-hat", null, fld({ id: "p-stage", label: "Етап", type: "select", value: d.stage || "", options: STAGE_OPTS }) + fld({ id: "p-pct", label: "Процент (екип)", type: "number", value: d.stage_percent == null ? "" : d.stage_percent }) +
        fld({ id: "p-done", label: "Очаквано завършване", value: d.expected_completion || "", ph: "напр. 4. трим. 2027", wide: true }), { lw: 190 }) +
        grp("Предимства и цена", "gem", null, fld({ id: "p-adv", label: "Предимства (по едно на ред, до 20)", type: "ta", value: (d.advantages || []).join("\n"), wide: true }) +
          fld({ id: "p-basis", label: "Основа за цената", type: "select", value: d.price_basis || "total", options: [["total", "Обща площ × цена/м²"], ["net", "Чиста площ × цена/м²"]], wide: true }) +
          fld({ id: "p-lat", label: "Ширина (lat)", type: "number", step: "0.000001", value: loc.lat == null ? "" : loc.lat }) + fld({ id: "p-lng", label: "Дължина (lng)", type: "number", step: "0.000001", value: loc.lng == null ? "" : loc.lng }), { lw: 190 }) +
        pre("Процентът се пази за екипа и <b>не се показва публично</b>, докато няма одобрена методика. В проекта няма полета за инвеститор, строител или изпълнител.") : pre("Създава се <b>чернова</b>. Публикуване – само администратор, след преглед."));
    var ctx;
    NDUI.open({ title: p ? "Редакция на проекта" : "Нов проект – чернова", icon: "building-2", inline: false, view: false, html: html, saveText: p ? "Запази" : "Създай черновата", required: ["p-title"],
      ready: function (x) { ctx = x; },
      validate: function (g) {
        if (g("p-title").length < 2) return "Заглавието трябва да е поне 2 знака.";
        if (!p) return;
        var pct = num(ctx, "p-pct"); if (pct != null && (pct < 0 || pct > 100 || pct % 1)) return "Процентът е цяло число от 0 до 100.";
        var la = num(ctx, "p-lat"), ln = num(ctx, "p-lng"); if ((la == null) !== (ln == null)) return "Въведете и двете координати или нито една."; if (la != null && (Math.abs(la) > 90 || Math.abs(ln) > 180)) return "Невалидни координати.";
        if (g("p-adv").split("\n").filter(function (s) { return s.trim(); }).length > 20) return "Най-много 20 предимства.";
      },
      onSave: function (g) {
        if (!p) return call("projects.create_draft", { title: g("p-title"), city: g("p-city") || undefined, hood: g("p-hood") || undefined, address: g("p-address") || undefined, client_request_id: U.uuid() })
          .then(function (r) { U.say(r.existed ? "Черновата вече съществуваше – отворена е." : "Черновата е създадена."); NC.open(r.id); });
        var f = { title: g("p-title"), price_policy: { basis: g("p-basis") } };
        ["p-city:city", "p-hood:hood", "p-address:address", "p-desc:description", "p-done:expected_completion", "p-stage:stage"].forEach(function (x) { var k = x.split(":"), v = g(k[0]); if (v) f[k[1]] = v; });
        var pct = num(ctx, "p-pct"); if (pct != null) f.stage_percent = pct;
        var adv = g("p-adv").split("\n").map(function (s) { return s.trim().slice(0, 120); }).filter(Boolean); f.advantages = adv;
        var la = num(ctx, "p-lat"), ln = num(ctx, "p-lng"); if (la != null) f.location = { lat: la, lng: ln };
        return call("projects.update", { id: p.id, expected_version: p.version, fields: f }).then(function () { U.say("Проектът е записан."); return NC.reload(); });
      } });
  }
  A.acts.addbld = function () { bldForm(null); };
  A.acts.editbld = function (a) { bldForm(F.bldg(a.getAttribute("data-b"))); };
  function bldForm(bd) {
    var m = NC.model();
    NDUI.open({ title: bd ? "Сграда – " + F.bName(bd) : "Нова сграда", icon: "building-2", inline: false, view: false, saveText: "Запази", required: ["b-name"],
      html: grp("Сграда / вход", "building-2", null, fld({ id: "b-name", label: "Име", required: true, value: bd ? bd.name || "" : "", ph: "напр. Сграда А / Вход 1" }) + fld({ id: "b-sort", label: "Подредба", type: "number", value: bd ? bd.sort : m.buildings.length }), { lw: 150 }),
      validate: function (g) { var s = Number(g("b-sort") || 0); if (!isFinite(s) || s < 0 || s > 999 || s % 1) return "Подредбата е цяло число от 0 до 999."; },
      onSave: function (g) { var i = { project_id: m.project.id, name: g("b-name"), sort: Number(g("b-sort") || 0) }; if (bd) { i.id = bd.id; i.expected_updated_at = bd.updated_at; } return call("buildings.upsert", i).then(function () { U.say("Сградата е записана."); return NC.reload(); }); } });
  }
  A.acts.addfloor = function (a) { floorForm(null, a.getAttribute("data-b")); };
  A.acts.editfloor = function (a) { var f = F.floor(a.getAttribute("data-floor")); floorForm(f, f.building_id); };
  function floorForm(f, bid) {
    NDUI.open({ title: f ? "Етаж – " + F.floorName(f) : "Нов етаж – " + F.bName(F.bldg(bid)), icon: "layers", inline: false, view: false, saveText: "Запази", required: ["f-level"],
      html: grp("Етаж", "layers", null, fld({ id: "f-level", label: "Ниво", type: "number", value: f ? f.level : "", ph: "-1 гараж, 0 партер, 1, 2…" }) + fld({ id: "f-label", label: "Надпис (по избор)", value: f ? f.label || "" : "" }), { lw: 170 }),
      validate: function (g) { var l = Number(g("f-level")); if (!/^-?\d+$/.test(g("f-level")) || l < -5 || l > 200) return "Нивото е цяло число от -5 до 200."; },
      onSave: function (g) { var i = { building_id: bid, level: Number(g("f-level")) }; if (g("f-label")) i.label = g("f-label"); if (f) { i.id = f.id; i.expected_updated_at = f.updated_at; } return call("floors.upsert", i).then(function () { U.say("Етажът е записан."); return NC.reload(); }); } });
  }
  A.acts.addunit = function (a) { var fid = a.getAttribute("data-floor") || NC.state.f; unitForm(null, fid); };
  A.acts.editunit = function (a) { var u = F.unit(a.getAttribute("data-unit")); unitForm(u, u.floor_id); };
  function unitForm(u, fid) {
    var m = NC.model(), f = F.floor(fid);
    if (!f) { U.say("Първо добавете етаж."); return; }
    var ov = !!(u && u.price_override), ctx;
    var html = grp("Апартамент", "house", null,
      fld({ id: "u-code", label: "Код", required: true, value: u ? u.code : "", ph: "напр. А1-02" }) +
      (u ? '<div class="ef"><span class="el">Сграда / етаж</span><span class="vv" style="display:block;font:700 24px var(--cond)">' + esc(F.bName(F.bldg(f.building_id)) + " · " + F.floorName(f)) + "</span></div>"
        : fld({ id: "u-floor", label: "Етаж", type: "select", value: f.id, options: m.floors.slice().sort(function (x, y) { return x.level - y.level; }).map(function (x) { return [x.id, F.bName(F.bldg(x.building_id)) + " · " + F.floorName(x)]; }) })) +
      fld({ id: "u-rooms", label: "Стаи", type: "number", value: u && u.rooms != null ? u.rooms : "" }) + fld({ id: "u-beds", label: "Спални", type: "number", value: u && u.beds != null ? u.beds : "" }) +
      fld({ id: "u-baths", label: "Бани", type: "number", value: u && u.baths != null ? u.baths : "" }) + fld({ id: "u-exp", label: "Изложение", value: u ? u.exposure || "" : "", ph: "напр. Юг/Изток" }), { lw: 150 }) +
      grp("Площи", "ruler", null, fld({ id: "u-at", label: "Обща площ (м²)", type: "number", step: "0.01", value: u && u.area_total != null ? u.area_total : "" }) + fld({ id: "u-an", label: "Чиста площ (м²)", type: "number", step: "0.01", value: u && u.area_net != null ? u.area_net : "" }) +
        fld({ id: "u-tr", label: "Тераса (м²)", type: "number", step: "0.01", value: u && u.terrace_area != null ? u.terrace_area : "" }), { lw: 190 }) +
      grp("Цена", "coins", NC.PH.offer, '<div class="nc-sw" role="group" aria-label="Начин на цената"><button type="button" data-pm="m2" aria-pressed="' + !ov + '">на кв.м</button><button type="button" data-pm="man" aria-pressed="' + ov + '">ръчна цена</button></div>' +
        fld({ id: "u-ppm", label: "Цена на м² (€)", type: "number", step: "0.01", value: u && u.price_per_m2 != null ? u.price_per_m2 : "" }) +
        '<div class="ef" id="u-manw"' + (ov ? "" : " hidden") + ">" + fld({ id: "u-tot", label: "Обща цена (€)", type: "number", step: "1", value: u && u.price_override && u.price_total != null ? u.price_total : "" }) + fld({ id: "u-why", label: "Причина", value: u && u.price_override_reason ? u.price_override_reason : "по преценка" }) + "</div>" +
        '<div class="nc-calc" id="u-calc" aria-live="polite"></div>', { lw: 190 }) +
      pre("Общата цена се смята от системата: " + (m.project.price_basis === "net" ? "чиста" : "обща") + " площ × цена на м², закръглено до 1 €. Ръчна цена – само с причина. Статусът се сменя отделно („Смени статус“).");
    function calc() {
      var c = ctx.q("u-calc"); if (!c) return;
      var man = ctx.body.querySelector('[data-pm="man"]').getAttribute("aria-pressed") === "true";
      if (man) { c.textContent = "Ръчна обща цена: " + (U.eur(num(ctx, "u-tot")) || "—"); return; }
      var a = num(ctx, m.project.price_basis === "net" ? "u-an" : "u-at"), pp = num(ctx, "u-ppm");
      c.textContent = a && pp ? "Обща цена (изчислява се от системата): " + U.eur(Math.round(a * pp)) : "Въведете площ и цена на м² – общата цена се изчислява автоматично.";
    }
    NDUI.open({ title: u ? "Редакция – " + u.code : "Нов апартамент", icon: "house", inline: false, view: false, html: html, saveText: "Запази", required: ["u-code"],
      ready: function (x) { ctx = x; x.body.addEventListener("input", calc); x.body.addEventListener("click", function (e) { var t = e.target.closest("[data-pm]"); if (!t) return; e.preventDefault(); x.body.querySelectorAll("[data-pm]").forEach(function (k) { k.setAttribute("aria-pressed", k === t); }); x.q("u-manw").hidden = t.getAttribute("data-pm") !== "man"; calc(); }); calc(); },
      validate: function (g) {
        if (!/^[A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9._\- ]{0,19}$/.test(g("u-code"))) return "Кодът: до 20 знака – букви, цифри, точка, тире, интервал.";
        var at = num(ctx, "u-at"), an = num(ctx, "u-an"), tr = num(ctx, "u-tr"), pp = num(ctx, "u-ppm");
        if (at != null && at <= 0) return "Общата площ трябва да е над 0."; if (an != null && an <= 0) return "Чистата площ трябва да е над 0."; if (tr != null && tr < 0) return "Терасата не може да е отрицателна.";
        if (at != null && an != null && an > at) return "Чистата площ не може да е по-голяма от общата.";
        if (pp != null && pp <= 0) return "Цената на м² трябва да е над 0 (0 не е цена).";
        ["u-rooms", "u-beds", "u-baths"].forEach(function () {}); var r = num(ctx, "u-rooms"); if (r != null && (r < 0 || r > 20 || r % 1)) return "Стаите са цяло число до 20.";
        if (ctx.body.querySelector('[data-pm="man"]').getAttribute("aria-pressed") === "true") { var t = num(ctx, "u-tot"); if (!t || t <= 0) return "Въведете ръчна обща цена над 0."; if (g("u-why").length < 3) return "Причината трябва да е поне 3 знака."; }
      },
      onSave: function (g) {
        var ff = u ? f : F.floor(g("u-floor")) || f;
        var i = { project_id: m.project.id, building_id: ff.building_id, floor_id: ff.id, code: g("u-code") };
        if (u) { i.id = u.id; i.expected_version = u.version; }
        [["u-rooms", "rooms"], ["u-beds", "beds"], ["u-baths", "baths"]].forEach(function (k) { var v = num(ctx, k[0]); if (v != null) i[k[1]] = v; });
        [["u-at", "area_total"], ["u-an", "area_net"], ["u-tr", "terrace_area"], ["u-ppm", "price_per_m2"]].forEach(function (k) { var v = num(ctx, k[0]); if (v != null) i[k[1]] = Math.round(v * 100) / 100; });
        if (g("u-exp")) i.exposure = g("u-exp");
        var man = ctx.body.querySelector('[data-pm="man"]').getAttribute("aria-pressed") === "true";
        if (man) { i.price_override = true; i.price_total = Math.round(num(ctx, "u-tot")); i.price_override_reason = g("u-why"); } else i.price_override = false;
        return call("units.upsert", i).then(function (r) { U.say("Апартаментът е записан."); return NC.reload().then(function () { NC.select.unit(r.id, true); }); });
      } });
  }

  /* смяна на статус: изрично потвърждение какво точно ще се промени; връщане назад – с причина; 409 → презареждане */
  A.acts.status = function (a) {
    var u = F.unit(a.getAttribute("data-unit")); if (!u) return;
    var R = ["free", "reserved", "sold"], from = R.indexOf(u.status), ev = U.uuid(), ctx;
    var opts = R.filter(function (s) { return s !== u.status; }).map(function (s) {
      var back = R.indexOf(s) < from, ok = admin || (u.status === "free" && s === "reserved");
      return '<label class="nc-fl" style="flex-direction:row;align-items:center;gap:14px;' + (ok ? "" : "opacity:.55") + '"><input type="radio" name="st-to" value="' + s + '"' + (ok ? "" : " disabled") + ' style="width:30px;height:30px;min-height:0;accent-color:#7a0f22"> ' + D.ST[s] + (back ? " (връщане назад)" : "") + (ok ? "" : " – само администратор") + "</label>";
    }).join("");
    var EXPL = {
      reserved: "Публично: цената остава видима; разпределението и панорамите се заменят с печат „КАПАРИРАН“ (сървърът спира плана при следващото отваряне).",
      sold: "Публично: цената се скрива; разпределението и панорамите се заменят с печат „ПРОДАДЕН“.",
      free: "Публично: цената и разпределението с воден знак отново се показват."
    };
    var html = grp("Нов статус на " + u.code, "tag", null, '<p class="nc-pre">Сега: <b>' + esc(D.ST[u.status]) + "</b>. Промяната се записва в историята (кой и кога) и важи веднага за CRM, Тед и публичната страница.</p>" + opts +
      '<div class="nc-pre" id="st-ex" aria-live="polite">Изберете нов статус.</div>' + fld({ id: "st-note", label: "Причина / бележка", type: "ta", wide: true, ph: "задължителна при връщане назад" }), { one: true });
    NDUI.open({ title: "Смяна на статус – " + u.code, icon: "tag", inline: false, view: false, html: html, saveText: "Потвърди смяната", photo: NC.PH.status,
      ready: function (x) { ctx = x; x.body.addEventListener("change", function () { var t = x.body.querySelector('[name="st-to"]:checked'); if (!t) return; var back = R.indexOf(t.value) < from; x.q("st-ex").innerHTML = "<b>" + esc(u.code + ": " + D.ST[u.status] + " → " + D.ST[t.value]) + ".</b> " + esc(EXPL[t.value]) + (back ? " <b>Връщането изисква причина.</b>" : ""); }); },
      validate: function (g) { var t = ctx.body.querySelector('[name="st-to"]:checked'); if (!t) return "Изберете нов статус."; if (R.indexOf(t.value) < from && g("st-note").length < 3) return "Връщането на статус изисква причина (поне 3 знака)."; },
      onSave: function (g) {
        var t = ctx.body.querySelector('[name="st-to"]:checked').value, i = { unit_id: u.id, to: t, expected_version: u.version, event_id: ev, confirm: true }; if (g("st-note")) i.note = g("st-note").slice(0, 1000);
        return call("units.set_status", i).then(function (r) { U.say(r.replayed ? "Промяната вече беше записана." : u.code + " е „" + D.ST[t] + "“."); return NC.reload(); });
      } });
  };
  A.acts.history = function (a) {
    var u = F.unit(a.getAttribute("data-unit"));
    var w = NDUI.open({ title: "История – " + u.code, icon: "history", inline: false, view: false, noSave: true, photo: NC.PH.report, html: '<div class="ndempty">Зареждане…</div>',
      ready: function (x) {
        tool("units.get", { id: u.id }).then(function (r) {
          var FN = { area_total: "Обща площ", area_net: "Чиста площ", terrace_area: "Тераса", price_per_m2: "Цена на м²", price_total: "Обща цена", price_override: "Ръчна цена", price_override_reason: "Причина за цена", code: "Код", plan: "План" };
          var ev = (r.events || []).map(function (e) { return NDUI.row("tag", (e.from_status ? D.ST[e.from_status] + " → " : "") + D.ST[e.to_status], (e.by_email || "") + (e.note ? " · " + e.note : ""), U.fdate(e.at)); });
          var ch = (r.changes || []).map(function (c) { return NDUI.row("pencil", FN[c.field] || c.field, (c.old_value == null ? "—" : c.old_value) + " → " + (c.new_value == null ? "—" : c.new_value) + (c.by_email ? " · " + c.by_email : ""), U.fdate(c.at)); });
          x.rerender(NDUI.section("Статуси", "tag", ev, "Няма промени на статуса.") + NDUI.section("Площи, цени и план", "ruler", ch, "Няма промени."));
        }).catch(function (e) { x.rerender('<div class="ndempty">' + esc(e.message) + "</div>"); });
      } });
    return w;
  };

  /* качване на план: оригиналът отива в частната папка на проекта; публичната производна се прави от сървъра */
  function upDialog(title, note, accept, onFile, photo) {
    var ctx;
    NDUI.open({ title: title, icon: "upload", inline: false, view: false, saveText: "Качи", photo: photo || NC.PH.media, html: grp("Файл", "upload", null, NDUI.filebox("nc-file", "Изберете файл", note, { accept: accept, nameId: "nc-fname" }), { one: true }) + pre(note),
      ready: function (x) { ctx = x; var fi = x.q("nc-file"); fi.removeAttribute("multiple"); fi.addEventListener("change", function () { x.q("nc-fname").textContent = fi.files[0] ? fi.files[0].name : "Изберете файл"; }); },
      validate: function () { var fi = ctx.q("nc-file"), f = fi.files[0]; if (!f) return "Изберете файл."; if (accept.split(",").indexOf(f.type) < 0) return "Неподдържан вид файл."; if (f.size > 40 * 1048576) return "Файлът е над 40 MB."; },
      onSave: function () { return onFile(ctx.q("nc-file").files[0]); } });
  }
  function dims(file) { return new Promise(function (ok) { if (!/^image\//.test(file.type)) return ok(null); var u = URL.createObjectURL(file), im = new Image(); im.onload = function () { ok({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(u); }; im.onerror = function () { ok(null); URL.revokeObjectURL(u); }; im.src = u; }); }
  var PLAN_NOTE = "JPG, PNG или PDF, до 40 MB. Оригиналът е само за екипа. Публичен план се прави само от JPG/PNG до 15 MB (с воден знак за свободен апартамент); за капариран/продаден публиката вижда само печат.";
  A.acts.uplan = function (a) {
    var u = F.unit(a.getAttribute("data-unit")), m = NC.model();
    upDialog("План на " + u.code, PLAN_NOTE, "image/jpeg,image/png,application/pdf", function (file) {
      var code = /^[A-Za-z0-9._-]{1,20}$/.test(u.code) ? u.code : u.id;
      var path = "projects/" + m.project.id + "/private/units/" + code + "/plan-" + stamp() + "." + ext(file);
      return ND.upload(path, file).then(function () { return call("units.upsert", { project_id: m.project.id, building_id: u.building_id, floor_id: u.floor_id, id: u.id, expected_version: u.version, plan_path: path }); })
        .then(function () { U.say(/pdf/.test(file.type) ? "PDF планът е качен (само за екипа). За публичен план качете JPG/PNG." : "Планът е качен. Публичното копие се подготвя от сървъра."); return NC.reload(); });
    }, NC.PH.planUp);
  };
  A.acts.fplan = function (a) {
    var f = F.floor(a.getAttribute("data-floor")), m = NC.model();
    upDialog("Етажен план – " + F.bName(F.bldg(f.building_id)) + ", " + F.floorName(f), PLAN_NOTE + " Очертайте апартаментите след качване – без очертания публичен етажен план не се прави, ако има капарирани/продадени.", "image/jpeg,image/png,application/pdf", function (file) {
      var path = "projects/" + m.project.id + "/private/plans/floor-" + f.id + "-" + stamp() + "." + ext(file);
      return Promise.all([ND.upload(path, file), dims(file)]).then(function (r) { var i = { building_id: f.building_id, id: f.id, level: f.level, plan_path: path, expected_updated_at: f.updated_at }; if (r[1]) { i.plan_w = r[1].w; i.plan_h = r[1].h; } return call("floors.upsert", i); })
        .then(function () { U.say("Етажният план е качен."); return NC.reload(); });
    }, NC.PH.planUp);
  };

  /* очертаване на апартаментите върху етажния план (полигони 0..1) → floors.upsert polygons */
  A.acts.outline = function (a) {
    var f = F.floor(a.getAttribute("data-floor")), V = NC.currentViewer();
    if (!V || NC.state.pmode !== "floor" || NC.state.f !== f.id) { NC.state.f = f.id; NC.state.pmode = "floor"; NC.refreshPanel(); U.say("Планът е отворен – натиснете отново „Очертай апартаментите“."); return; }
    var polys = (f.polygons || []).map(function (p) { return { unit_code: p.unit_code, points: p.points.map(function (q) { return [q[0], q[1]]; }) }; }), cur = [], el = V.el;
    var us = F.unitsOf(f.id);
    var bar = document.createElement("div"); bar.className = "nc-dtools nc-drawbar"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Очертаване");
    bar.innerHTML = '<label>Апартамент: <select id="nc-dcode">' + us.map(function (x) { return '<option value="' + esc(x.code) + '">' + esc(x.code) + "</option>"; }).join("") + "</select></label>" +
      b("d-undo", "undo", "Отмени точка") + b("d-close", "check", "Затвори очертанието") + b("d-del", "trash-2", "Изтрий очертанието на избрания") + b("d-save", "save", "Запази очертанията", { cls: "sm hot" }) + b("d-cancel", "x", "Откажи") +
      '<span class="nc-note" id="nc-dhint" style="color:#3b0a0e">Щракнете върху плана, за да добавите точки (поне 3), после „Затвори очертанието“.</span>';
    el.parentNode.insertBefore(bar, el.nextSibling); el.classList.add("nc-draw");
    if (!us.length) { U.say("На етажа няма апартаменти за очертаване."); }
    var sv = V.svg;
    function draw() {
      var st = V.state(), W = st.W, H = st.H;
      V.setPolys(polys.map(function (p) { var x = us.filter(function (z) { return z.code === p.unit_code; })[0]; return x ? { id: x.id, code: x.code, status: x.status, pts: p.points } : null; }).filter(Boolean));
      sv.insertAdjacentHTML("beforeend", (cur.length ? '<polygon class="cur" points="' + cur.map(function (q) { return q[0] * W + "," + q[1] * H; }).join(" ") + '"></polygon>' : "") + cur.map(function (q) { return '<circle class="pt" r="' + 6 / st.s + '" cx="' + q[0] * W + '" cy="' + q[1] * H + '"></circle>'; }).join(""));
    }
    var dn = null;
    function pd(e) { dn = { x: e.clientX, y: e.clientY }; }
    function pu(e) { if (!dn || e.target.closest(".ctl") || Math.abs(e.clientX - dn.x) + Math.abs(e.clientY - dn.y) > 6) { dn = null; return; } dn = null; var p = V.pt(e), q = V.toImage(p.x, p.y); if (q[0] < 0 || q[0] > 1 || q[1] < 0 || q[1] > 1) return; cur.push([Math.round(q[0] * 10000) / 10000, Math.round(q[1] * 10000) / 10000]); draw(); }
    el.addEventListener("pointerdown", pd, true); el.addEventListener("pointerup", pu, true);
    var oldPick = V.opts.onPick; V.opts.onPick = null;
    function end() { el.removeEventListener("pointerdown", pd, true); el.removeEventListener("pointerup", pu, true); V.opts.onPick = oldPick; bar.remove(); el.classList.remove("nc-draw"); }
    bar.addEventListener("click", function (e) {
      var t = e.target.closest("[data-act]"); if (!t) return; e.stopPropagation(); var k = t.getAttribute("data-act"), code = bar.querySelector("#nc-dcode") && bar.querySelector("#nc-dcode").value;
      if (k === "d-undo") { cur.pop(); draw(); }
      else if (k === "d-close") { if (cur.length < 3) { U.say("Нужни са поне 3 точки."); return; } polys = polys.filter(function (p) { return p.unit_code !== code; }); polys.push({ unit_code: code, points: cur }); cur = []; draw(); U.say("Очертанието на " + code + " е готово (още не е записано)."); }
      else if (k === "d-del") { polys = polys.filter(function (p) { return p.unit_code !== code; }); draw(); }
      else if (k === "d-cancel") { end(); NC.refreshPanel(); }
      else if (k === "d-save") { t.disabled = true; call("floors.upsert", { building_id: f.building_id, id: f.id, level: f.level, polygons: polys, expected_updated_at: f.updated_at }).then(function () { end(); U.say("Очертанията са записани."); return NC.reload(); }, function (x) { t.disabled = false; U.say(x.message); }); }
    }, true);
    draw();
  };

  /* преглед, публикуване, архив (само администратор; сървърът проверява отново) */
  A.acts.review = function () {
    var p = NC.model().project;
    NDUI.open({ title: "Отбележи проекта като проверен", icon: "badge-check", inline: false, view: false, saveText: "Потвърждавам прегледа",
      html: pre("Потвърждавате, че сте прегледали съдържанието на <b>" + esc(p.title) + "</b> (версия на съдържанието " + esc(p.content_rev) + "). Всяка следваща промяна прави отметката невалидна и проектът трябва да се прегледа отново преди публикуване."),
      onSave: function () { return call("projects.mark_reviewed", { id: p.id, expected_content_rev: p.content_rev, confirm: true }).then(function () { U.say("Проектът е отбелязан като проверен."); return NC.reload(); }); } });
  };
  function slugify(t) { var M = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya" }; return String(t || "").toLowerCase().split("").map(function (c) { return M[c] != null ? M[c] : c; }).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "proekt"; }
  A.acts.publish = function () {
    var p = NC.model().project, ctx;
    NDUI.open({ title: "Публикуване на проекта", icon: "megaphone", inline: false, view: false, saveText: "Публикувай", required: ["pub-slug"],
      html: grp("Публичен адрес", "globe", null, fld({ id: "pub-slug", label: "Адрес (slug)", value: p.slug || slugify(p.title), wide: true, ph: "латински букви, цифри и тире" }), { one: true }) +
        '<div class="nc-pre">Адрес: <b id="pub-url"></b><ul><li>Публикува се само проверено съдържание (без промени след прегледа).</li><li>Всички обекти трябва да имат площ и цена.</li><li>Ако сървърът откаже, ще видите точния списък с липсите.</li></ul></div><div id="pub-issues" aria-live="assertive"></div>',
      ready: function (x) { ctx = x; function u() { x.q("pub-url").textContent = location.origin + "/mobile/nc.html?p=" + x.q("pub-slug").value.trim(); } x.q("pub-slug").addEventListener("input", u); u(); },
      validate: function (g) { if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(g("pub-slug"))) return "Адресът: 3–61 знака – малки латински букви, цифри и тире."; },
      onSave: function (g) {
        return call("projects.publish", { id: p.id, expected_version: p.version, slug: g("pub-slug"), confirm: true }).then(function (r) {
          if (r && r.ok === false) { ctx.q("pub-issues").innerHTML = '<div class="nc-issues" role="alert"><b>Сървърът отказа публикуването. Липсва:</b><ul>' + (r.issues || []).map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul></div>"; return false; }
          U.say("Проектът е публикуван: /mobile/nc.html?p=" + r.slug); return NC.reload();
        });
      } });
  };
  A.acts.archive = function () {
    var p = NC.model().project;
    NDUI.open({ title: "Архивиране на проекта", icon: "archive", inline: false, view: false, saveText: "Архивирай",
      html: pre("Проектът <b>" + esc(p.title) + "</b> ще изчезне от публичния сайт (страницата и плановете връщат „няма“). Данните остават в CRM."),
      onSave: function () { return call("projects.archive", { id: p.id, expected_version: p.version, confirm: true }).then(function () { U.say("Проектът е архивиран."); return NC.reload(); }); } });
  };

  /* публична медия (само администратор): корица, галерия, документи – файловете в public/ на проекта, вписани през projects.set_media */
  A.acts.cover = function () {
    var m = NC.model();
    upDialog("Корица на проекта", "JPG, PNG или WebP – реална визуализация или снимка на проекта. Вижда се публично след публикуване.", "image/jpeg,image/png,image/webp", function (file) {
      var path = "projects/" + m.project.id + "/public/media/cover-" + stamp() + "." + ext(file);
      return ND.upload(path, file).then(function () { return call("projects.set_media", { project_id: m.project.id, kind: "cover", items: [{ path: path, title: "Корица" }], confirm: true }); }).then(function () { U.say("Корицата е записана."); return NC.reload(); });
    });
  };
  A.acts.galmanage = function () {
    var m = NC.model(), ctx;
    var list = m.gallery.map(function (g, i) { return '<label class="nc-fl" style="flex-direction:row;align-items:center;gap:14px"><input type="checkbox" data-keep="' + i + '" checked style="width:28px;height:28px;min-height:0;accent-color:#7a0f22"> ' + esc(g.title || g.path.split("/").pop()) + "</label>"; }).join("");
    NDUI.open({ title: "Галерия на проекта", icon: "image", inline: false, view: false, saveText: "Запази галерията",
      html: grp("Текущи (" + m.gallery.length + ")", "image", null, list || '<p class="nc-note">Няма изображения.</p>', { one: true }) + grp("Добави", "upload", null, NDUI.filebox("nc-gfile", "Изберете снимки или видео", "JPG, PNG, WebP, MP4, WebM – реални визуализации, снимки или видео на проекта", { accept: "image/jpeg,image/png,image/webp,video/mp4,video/webm", nameId: "nc-gname" }) + fld({ id: "g-title", label: "Заглавие за новите", value: "", wide: true }), { one: true }) + (m.cover ? "" : pre("Корицата се качва с бутона „Качи корица“ в „Общ преглед“.")),
      ready: function (x) { ctx = x; var fi = x.q("nc-gfile"); fi.addEventListener("change", function () { x.q("nc-gname").textContent = fi.files.length ? fi.files.length + " файла" : "Изберете снимки или видео"; }); },
      validate: function () { var fs = [].slice.call(ctx.q("nc-gfile").files); if (fs.some(function (f) { return f.size > 40 * 1048576; })) return "Файл над 40 MB."; if (ctx.body.querySelectorAll("[data-keep]:checked").length + fs.length > 60) return "Най-много 60 елемента."; },
      onSave: function (g) {
        var keep = [].slice.call(ctx.body.querySelectorAll("[data-keep]:checked")).map(function (c) { var it = m.gallery[+c.getAttribute("data-keep")]; return { path: it.path, title: it.title || undefined }; });
        var fs = [].slice.call(ctx.q("nc-gfile").files), title = g("g-title").slice(0, 120);
        return fs.reduce(function (pr, f, i) { return pr.then(function () { var path = "projects/" + m.project.id + "/public/media/g-" + stamp() + "-" + i + "." + ext(f); return ND.upload(path, f).then(function () { keep.push({ path: path, title: (title ? title + (fs.length > 1 ? " " + (i + 1) : "") : f.name).slice(0, 120) }); }); }); }, Promise.resolve())
          .then(function () { return call("projects.set_media", { project_id: m.project.id, kind: "gallery", items: keep.map(function (k, i) { return { path: k.path, title: k.title, sort: i }; }), confirm: true }); }).then(function () { U.say("Галерията е записана."); return NC.reload(); });
      } });
  };
  A.acts.docadd = function () {
    var m = NC.model(), ctx;
    NDUI.open({ title: "Публичен документ", icon: "file-text", inline: false, view: false, saveText: "Качи", required: ["d-title"], photo: NC.PH.docs,
      html: grp("Документ", "file-text", null, fld({ id: "d-title", label: "Име", wide: true, ph: "напр. Брошура на проекта" }) + NDUI.filebox("nc-dfile", "Изберете файл", "PDF, JPG или PNG – вижда се публично, когато проектът е публикуван", { accept: "application/pdf,image/jpeg,image/png", nameId: "nc-dname" }), { one: true }) + pre("Не качвайте тук лични данни, договори или вътрешни документи – всичко тук е публично. Брошурата се разпознава по име, започващо с „Брошура“."),
      ready: function (x) { ctx = x; var fi = x.q("nc-dfile"); fi.removeAttribute("multiple"); fi.addEventListener("change", function () { x.q("nc-dname").textContent = fi.files[0] ? fi.files[0].name : "Изберете файл"; }); },
      validate: function () { var f = ctx.q("nc-dfile").files[0]; if (!f) return "Изберете файл."; if (f.size > 40 * 1048576) return "Файлът е над 40 MB."; },
      onSave: function (g) {
        var f = ctx.q("nc-dfile").files[0], path = "projects/" + m.project.id + "/public/files/" + stamp() + "." + ext(f);
        var items = m.files.filter(function (x) { return x.access === "public"; }).map(function (x, i) { return { path: x.path, title: x.title || undefined, sort: i }; });
        return ND.upload(path, f).then(function () { items.push({ path: path, title: g("d-title").slice(0, 120), sort: items.length }); return call("projects.set_media", { project_id: m.project.id, kind: "file", items: items, confirm: true }); }).then(function () { U.say("Документът е добавен."); return NC.reload(); });
      } });
  };
  /* ипотечен калкулатор: съществуващият модул на CRM (NDUI.calcHtml / calcBind), цената идва от апартамента */
  A.acts.mortgage = function () {
    var u = F.unit(NC.state.u); if (!u || !u.price_total) { U.say("Избраният апартамент няма цена."); return; }
    NDUI.open({ title: "Ипотечен калкулатор – " + u.code, icon: "calculator", inline: false, view: false, noSave: true, photo: NC.PH.price,
      html: NDUI.group("Цена", "coins", null, NDUI.fld({ id: "k-price", label: "Цена на апартамента (€)", type: "number", value: u.price_total, wide: true }), { noPhoto: true, one: true }) + NDUI.calcHtml(false, true),
      ready: function (x) { NDUI.calcBind(x, "k-price", null); } });
  };

  /* ---------- старт ---------- */
  function go() { NC.assetBase = "assets/"; NC.boot(A); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
