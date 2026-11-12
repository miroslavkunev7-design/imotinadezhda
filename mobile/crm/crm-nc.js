/* ИМОТИ НАДЕЖДА · TASK-008 · „Ново строителство“: списък с проекти и страница на проект с 9 таба.
   Общо ядро за CRM (crm-nc.html – данни през /api/tools и четене под RLS) и публичната страница (/mobile/nc.html – публични RPC).
   Правила: нищо не е измислено – всяка стойност идва от базата; липсващото е честно празно състояние;
   всеки текст от базата минава през esc(); в адреса се пазят само идентификатори (никога токен, път или подписан линк).
   Табовете са само състояние в браузъра – не викат сървъра и не пускат n8n. */
(function () {
  "use strict";
  var NC = (window.NC = window.NC || {});

  /* ---------------- помощни ---------------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ic(n) { return '<svg class="i" aria-hidden="true" focusable="false"><use href="#' + n + '"/></svg>'; }
  function nfmt(n, d) { if (n == null || n === "" || !isFinite(Number(n))) return null; return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(n)).replace(/[  ]/g, " "); }
  function eur(n) { if (n == null || !isFinite(Number(n))) return null; return nfmt(Math.round(Number(n)), 0) + " €"; }
  function eur2(n) { if (n == null || !isFinite(Number(n))) return null; return nfmt(n, Number(n) % 1 ? 2 : 0) + " €"; }
  function m2(n) { return n == null || !isFinite(Number(n)) ? null : nfmt(n, 2) + " м²"; }
  function fdate(s) { var d = new Date(s); if (!s || isNaN(d)) return ""; return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear(); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return [].slice.call((el || document).querySelectorAll(sel)); }
  function say(m) { if (window.ND && ND.say) ND.say(m); else { var t = document.getElementById("toast"); if (!t) return; t.textContent = m; t.classList.add("show"); clearTimeout(say._t); say._t = setTimeout(function () { t.classList.remove("show"); }, 3200); } }
  function uuid() { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); var h = "0123456789abcdef", s = ""; for (var i = 0; i < 32; i++) s += h[(Math.random() * 16) | 0]; return s.slice(0, 8) + "-" + s.slice(8, 12) + "-4" + s.slice(13, 16) + "-a" + s.slice(17, 20) + "-" + s.slice(20, 32); }
  /* днешната дата по МЕСТНОТО време (toISOString е в UTC и след полунощ дава вчера) */
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  NC.util = { esc: esc, ic: ic, eur: eur, eur2: eur2, m2: m2, fdate: fdate, say: say, uuid: uuid, nfmt: nfmt, today: today };

  /* ---------------- речник ---------------- */
  var TABS = [["overview", "Общ преглед", "house"], ["units", "Апартаменти", "layout-grid"], ["plans", "Разпределения", "layers"], ["b3d", "3D Сграда", "box"], ["tour", "360° Разходка", "r360"],
    ["build", "Строителство", "hard-hat"], ["gallery", "Галерия", "image"], ["docs", "Документи", "file-text"], ["contacts", "Контакти", "info"]];
  var TABIDS = TABS.map(function (t) { return t[0]; });
  var ST = { free: "Свободен", reserved: "Капариран", sold: "Продаден" };
  var STP = { free: "Свободни", reserved: "Капарирани", sold: "Продадени" };
  var STAGES = [["start", "Старт"], ["excavation", "Изкоп"], ["rough", "Груб строеж"], ["act14", "Акт 14"], ["act15", "Акт 15"], ["act16", "Акт 16"]];
  var STAGE_BG = {}; STAGES.forEach(function (s) { STAGE_BG[s[0]] = s[1]; });
  var PST = { draft: "Чернова", published: "Публикуван", archived: "Архивиран" };
  var ROOMS = { 1: "1 стая (едностаен)", 2: "2 стаи (двустаен)", 3: "3 стаи (тристаен)", 4: "4 стаи (четиристаен)" };
  var AREAS = [["0-50", "до 50 м²"], ["50-70", "50 – 70 м²"], ["70-90", "70 – 90 м²"], ["90-120", "90 – 120 м²"], ["120-100000", "над 120 м²"]];
  var PRICES = [["0-80000", "до 80 000 €"], ["80000-120000", "80 000 – 120 000 €"], ["120000-160000", "120 000 – 160 000 €"], ["160000-250000", "160 000 – 250 000 €"], ["250000-1000000000", "над 250 000 €"]];
  var SORTS = [["code", "По код"], ["pasc", "Цена: възходящо"], ["pdesc", "Цена: низходящо"], ["area", "Най-голяма площ"], ["floor", "По етаж"]];
  NC.dict = { TABS: TABS, ST: ST, STP: STP, STAGES: STAGES, PST: PST };
  /* декоративни снимки (TASK-003, само илюстрации; само в информационни блокове и прозорци – никога върху плана, 3D, 360 или корицата) */
  var PH = { info: "nd/ph44.webp", stage: "nd/ph22.webp", adv: "nd/ph21.webp", plans: "nd/ph24.webp", planUp: "nd/ph42.webp", floors3d: "nd/ph44.webp", rooms: "nd/ph23.webp",
    build: "nd/ph41.webp", gallery: "nd/ph39.webp", galleryEmpty: "nd/ph36.webp", docs: "nd/ph27.webp", agency: "nd/ph26.webp", inquiry: "nd/ph29.webp", viewing: "nd/ph33.webp",
    loc: "nd/ph45.webp", locSea: "nd/ph53.webp", compare: "nd/ph25.webp", price: "nd/ph34.webp", offer: "nd/ph47.webp", status: "nd/ph31.webp", report: "nd/ph35.webp",
    media: "nd/ph36.webp", empty3d: "nd/ph28.webp", empty360: "nd/ph38.webp", list: "nd/ph43.webp" };
  NC.PH = PH;
  /* морски проект (по града/квартала/адреса) → морска илюстрация за „Местоположение“; иначе – градска/планинска */
  var SEA = /(варна|бургас|созопол|несеб[ъa]р|поморие|приморско|царево|китен|лозенец|ахтопол|обзор|балчик|каварна|кранево|албена|златни пясъци|слънчев бряг|св(\.|ети)\s*влас|равда|черноморец|шкорпиловци|шабла|св(\.|ети)\s*константин|морск|плаж)/i;
  function seaside(p) { return SEA.test([p.city, p.hood, p.address].filter(Boolean).join(" ")); }
  NC.seaside = seaside;

  /* ---------------- състояние (споделено между табовете и в адреса) ---------------- */
  var S = { view: "list", key: null, tab: "overview", b: null, f: null, u: null, pmode: "floor", flt: {}, cmp: [], lf: "all", lq: "", hi: 0, gk: "all" };
  var A = null, M = null, LIST = null, root = null, VIEWER = null, loadedAt = 0, implicitU = false;
  NC.state = S;
  NC.model = function () { return M; };
  var FK = { fb: "b", ff: "f", fr: "r", fa: "a", fp: "p", fe: "e", fs: "s", fo: "o", fq: "q" };
  function fromUrl() {
    var q = new URLSearchParams(location.search), o = { flt: {} };
    o.key = q.get("p") || null; o.view = o.key ? "project" : "list";
    o.tab = TABIDS.indexOf(q.get("tab")) >= 0 ? q.get("tab") : "overview";
    o.b = q.get("b") || null; o.f = q.get("f") || null; o.u = q.get("u") || null; o.pmode = q.get("pl") === "unit" ? "unit" : "floor";
    Object.keys(FK).forEach(function (k) { var v = q.get(k); if (v) o.flt[FK[k]] = String(v).slice(0, 80); });
    o.lf = ["draft", "published", "archived"].indexOf(q.get("ls")) >= 0 ? q.get("ls") : "all"; o.lq = (q.get("lq") || "").slice(0, 100);
    ["b", "f", "u", "key"].forEach(function (k) { if (o[k] && !/^[a-z0-9-]{3,64}$/.test(o[k])) o[k] = null; });
    if (!o.key) o.view = "list";
    return o;
  }
  function toUrl() {
    var q = new URLSearchParams();
    if (S.view === "project" && S.key) {
      q.set("p", S.key); if (S.tab !== "overview") q.set("tab", S.tab);
      if (S.b) q.set("b", S.b); if (S.f) q.set("f", S.f); if (S.u && !implicitU) q.set("u", S.u); if (S.pmode === "unit") q.set("pl", "unit");
      Object.keys(FK).forEach(function (k) { var v = S.flt[FK[k]]; if (v) q.set(k, v); });
    } else { if (S.lf !== "all") q.set("ls", S.lf); if (S.lq) q.set("lq", S.lq); if (A && A.listQuery) A.listQuery(q); }
    var s = q.toString(); return location.pathname + (s ? "?" + s : "");
  }
  function sync(push) { var url = toUrl(); if (url === location.pathname + location.search) return; try { history[push ? "pushState" : "replaceState"]({ nc: 1 }, "", url); } catch (e) { /* без адрес – състоянието остава */ } }
  NC.sync = sync;

  /* ---------------- модел ---------------- */
  function bldg(id) { return M && M.buildings.filter(function (b) { return b.id === id; })[0]; }
  function floor(id) { return M && M.floors.filter(function (f) { return f.id === id; })[0]; }
  function unit(id) { return M && M.units.filter(function (u) { return u.id === id; })[0]; }
  function floorsOf(bid) { return M.floors.filter(function (f) { return f.building_id === bid; }).sort(function (a, b) { return b.level - a.level; }); }
  function unitsOf(fid) { return M.units.filter(function (u) { return u.floor_id === fid; }).sort(function (a, b) { return String(a.code).localeCompare(String(b.code), "bg"); }); }
  function floorName(f) { if (!f) return ""; if (f.label) return f.label; return f.level === 0 ? "Партер" : f.level === -1 ? "-1 Гараж" : f.level < 0 ? "Ниво " + f.level : "Етаж " + f.level; }
  function bName(b) { return b ? b.name || "Сграда" : ""; }
  function counts(list) { var c = { free: 0, reserved: 0, sold: 0 }; list.forEach(function (u) { if (c[u.status] != null) c[u.status]++; }); return c; }
  function orderUnits(list) {
    var bs = {}; M.buildings.forEach(function (b, i) { bs[b.id] = i; });
    var lv = {}; M.floors.forEach(function (f) { lv[f.id] = f.level; });
    return list.slice().sort(function (a, b) { return (bs[a.building_id] - bs[b.building_id]) || ((lv[a.floor_id] || 0) - (lv[b.floor_id] || 0)) || String(a.code).localeCompare(String(b.code), "bg"); });
  }
  function defaultUnit() { var o = orderUnits(M.units); var fr = o.filter(function (u) { return u.status === "free"; }); return (fr[0] || o[0] || {}).id || null; }
  function validate(notify) {
    if (!M) return;
    var lost = false;
    if (S.u && !unit(S.u)) { lost = true; S.u = null; }
    if (S.b && !bldg(S.b)) S.b = null;
    if (S.f && !floor(S.f)) S.f = null;
    var u = S.u && unit(S.u);
    if (u) { S.b = u.building_id; S.f = u.floor_id; }
    else if (S.f) { S.b = floor(S.f).building_id; var fu = unitsOf(S.f)[0]; if (fu) { S.u = fu.id; implicitU = true; } }
    else { var d = defaultUnit(); if (d) { S.u = d; implicitU = true; var du = unit(d); S.b = du.building_id; S.f = du.floor_id; } }
    if (!S.b && M.buildings[0]) S.b = M.buildings[0].id;
    if (!S.f && S.b) { var fl = floorsOf(S.b).slice().reverse(); var g = fl.filter(function (f) { return f.level >= 0; })[0] || fl[0]; S.f = g ? g.id : null; }
    S.cmp = S.cmp.filter(function (id) { return !!unit(id); });
    if (lost && notify) say("Избраният апартамент вече не е наличен – показан е друг.");
  }
  NC.find = { bldg: bldg, floor: floor, unit: unit, floorsOf: floorsOf, unitsOf: unitsOf, floorName: floorName, bName: bName };

  /* ---------------- общи части на изгледа ---------------- */
  function dot(s) { return '<i class="nc-dot ' + esc(s) + '" aria-hidden="true"></i>'; }
  function stChip(s) { return '<span class="nc-st ' + esc(s) + '">' + dot(s) + esc(ST[s] || s) + "</span>"; }
  function empty(icon, title, text, acts, cls) {
    return '<div class="nc-empty' + (cls ? " " + cls : "") + '" role="' + (cls === "err" ? "alert" : "status") + '">' + ic(icon) + "<h3>" + esc(title) + "</h3>" + (text ? "<p>" + esc(text) + "</p>" : "") + (acts ? '<div class="nc-acts">' + acts + "</div>" : "") + "</div>";
  }
  function btn(act, icon, text, o) {
    o = o || {}; var dis = o.disabled ? ' aria-disabled="true"' : "";
    return '<button type="button" class="nc-btn' + (o.cls ? " " + o.cls : "") + '" data-act="' + esc(act) + '"' + (o.data ? " " + o.data : "") + dis + (o.title ? ' title="' + esc(o.title) + '"' : "") + (o.label ? ' aria-label="' + esc(o.label) + '"' : "") + ">" + ic(icon) + "<span>" + esc(text) + "</span>" + (o.why ? '<span class="nc-why">' + esc(o.why) + "</span>" : "") + "</button>";
  }
  /* карта с лента-заглавие: същият механизъм като NDUI.group (класове .ndg/.ndg-h/.ndg-img/.ndg-f, маската от crm-ui.js);
     декоративната снимка е само от наличните assets/nd/phNN (PH по-горе) и само в информационни блокове */
  function card(title, icon, photo, inner, extraCls, head) {
    var h;
    if (window.NDUI && NDUI.group) h = NDUI.group(title, icon, photo || null, inner, { noPhoto: !photo, one: true });
    else h = '<div class="ndg' + (photo ? "" : " noimg") + ' one"><div class="ndg-h">' + ic(icon) + esc(title) + "</div>" + (photo ? '<div class="ndg-img" style="background-image:url(' + esc(NC.img(photo)) + ')"></div>' : "") + '<div class="ndg-f">' + inner + "</div></div>";
    h = h.replace('<div class="ndg', '<div class="' + (extraCls ? extraCls + " " : "") + 'ndg');
    if (head) h = h.replace('<div class="ndg-f">', '<div class="nc-hc">' + head + '</div><div class="ndg-f">');
    return h;
  }
  NC.img = function (p) { return (window.IMG && window.IMG[p]) || (NC.assetBase || "assets/") + p; };
  function row(icon, k, v, emp) { return '<div class="nc-row">' + ic(icon) + '<span class="k">' + esc(k) + '</span><span class="v' + (emp ? " emp" : "") + '">' + v + "</span></div>"; }
  NC.ui = { dot: dot, stChip: stChip, empty: empty, btn: btn, card: card, row: row };

  /* ---------------- списък с проекти ---------------- */
  function renderList() {
    setSub("Проекти, сгради и апартаменти");
    var staff = A.mode === "staff";
    var head = '<div class="nc-lhead"><h2>' + ic("building-2") + esc(A.listTitle || "Проекти – ново строителство") + "</h2>" +
      '<label class="nc-q"><span class="sr" hidden>Търси проект</span>' + ic("search") + '<input id="nc-q" type="search" placeholder="Търси по име, град, квартал…" autocomplete="off" aria-label="Търси проект по име, град или квартал" value="' + esc(S.lq) + '"></label>' +
      (staff ? '<div class="nc-seg" role="group" aria-label="Статус на проекта">' + [["all", "Всички"], ["draft", "Чернови"], ["published", "Публикувани"], ["archived", "Архив"]].map(function (x) { return '<button type="button" data-act="lfilt" data-v="' + x[0] + '" aria-pressed="' + (S.lf === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>" : "") +
      (A.listActs ? A.listActs() : "") + "</div>";
    if (LIST === null) { root.innerHTML = head + '<div class="nc-load" role="status"><span class="nc-spin" aria-hidden="true"></span>Зареждане на проектите…</div>'; return; }
    if (LIST && LIST.error) { root.innerHTML = head + empty("triangle-alert", "Проектите не се заредиха", LIST.error, btn("reload", "refresh-cw", "Опитай отново"), "err"); return; }
    var q = S.lq.toLocaleLowerCase("bg");
    var list = LIST.filter(function (p) { return (S.lf === "all" || p.status === S.lf) && (!q || [p.title, p.city, p.hood, p.slug].some(function (v) { return String(v || "").toLocaleLowerCase("bg").indexOf(q) >= 0; })); });
    var body;
    if (!LIST.length) body = card(staff ? "Още няма проекти" : A.emptyTitle || "Няма публикувани проекти", "building-2", PH.list, '<div class="nc-gempty" role="status"><p class="nc-note" style="max-width:56%">' + esc(staff ? "Създайте чернова на проект или внесете проектен пакет с „Импорт на проект“." : A.emptyText || "В момента няма публикувани проекти ново строителство.") + "</p>" + (A.emptyListActs ? '<div class="nc-btns">' + A.emptyListActs() + "</div>" : "") + '</div>', "nc-illu nc-lempty");
    else if (!list.length) body = empty("search", "Няма проекти по избраните критерии", "Променете търсенето или филтъра.", btn("lclear", "x", "Изчисти"));
    else body = '<div class="nc-grid">' + list.map(projCard).join("") + "</div>";
    root.innerHTML = head + body;
    var inp = $("#nc-q", root); if (inp) inp.addEventListener("input", function () { S.lq = inp.value.trim().slice(0, 100); clearTimeout(renderList._t); renderList._t = setTimeout(function () { var pos = inp.selectionStart; renderList(); sync(false); var i2 = $("#nc-q", root); if (i2) { i2.focus(); try { i2.setSelectionRange(pos, pos); } catch (e) {} } }, 250); });
  }
  function projCard(p) {
    var c = p.counts || {}, tags = "";
    if (A.mode === "staff") tags = '<span class="nc-badge ' + (p.status === "published" ? "pub" : p.status === "archived" ? "arch" : "") + '">' + esc(PST[p.status] || p.status) + "</span>" + (p.status !== "archived" ? (p.reviewed ? '<span class="nc-badge ok">' + ic("badge-check") + "Проверен</span>" : '<span class="nc-badge warn">Непроверен</span>') : "");
    var cv = p.cover_url ? '<div class="cv" style="background-image:url(&quot;' + esc(p.cover_url) + '&quot;)" role="img" aria-label="' + esc("Корица на " + (p.title || "проекта")) + '"></div>'
      : '<div class="cv none">' + ic("image") + "<span>Няма качена корица</span></div>";
    return '<button type="button" class="nc-pcard" data-act="open" data-key="' + esc(p.key) + '" aria-label="' + esc("Отвори проект " + (p.title || "")) + '">' + cv + (tags ? '<span class="tags">' + tags + "</span>" : "") +
      '<span class="bd"><h3>' + esc(p.title || "Без заглавие") + "</h3>" +
      ((p.city || p.hood) ? '<span class="loc">' + ic("pin") + esc([p.city, p.hood].filter(Boolean).join(", ")) + "</span>" : "") +
      (c.reserved == null ? '<span class="cnt"><span><b>' + dot("free") + esc(c.free || 0) + "</b>Свободни</span><span><b>" + esc(c.units || 0) + "</b>Общо обекти</span></span>"
        : '<span class="cnt"><span><b>' + dot("free") + esc(c.free || 0) + "</b>Свободни</span><span><b>" + dot("reserved") + esc(c.reserved) + "</b>Капарирани</span><span><b>" + dot("sold") + esc(c.sold) + "</b>Продадени</span></span>") +
      '<span class="meta">' + esc((c.units || 0) + " обекта" + (c.buildings != null ? " · " + c.buildings + " сгр. · " + c.floors + " ет." : "")) + "</span></span></button>";
  }

  /* ---------------- проект: лента, броячи, табове ---------------- */
  function setSub(t) { var s = document.getElementById("nc-sub"); if (s) s.textContent = t; }
  function headHtml() {
    var p = M.project, c = counts(M.units);
    var badges = (A.mode === "staff" ? '<span class="nc-badge ' + (p.status === "published" ? "pub" : p.status === "archived" ? "arch" : "") + '">' + esc(PST[p.status] || p.status) + "</span>" + (p.status !== "archived" ? '<span class="nc-badge ' + (p.reviewed ? "ok" : "warn") + '">' + (p.reviewed ? ic("badge-check") + "Проверен" : "Непроверен") + "</span>" : "") : "") +
      (p.stage && STAGE_BG[p.stage] ? '<span class="nc-badge">' + ic("hard-hat") + "Етап: " + esc(STAGE_BG[p.stage]) + "</span>" : "");
    var loc = [p.city, p.hood].filter(Boolean).join(", ");
    var stats = [["building-2", M.buildings.length, "Сгради"], ["layers", M.floors.length, "Етажа"], ["layout-grid", M.units.length, "Апартамента"], ["free", c.free, "Свободни"], ["reserved", c.reserved, "Капарирани"], ["sold", c.sold, "Продадени"]];
    return '<div class="nc-head"><div class="nc-strip">' + (A.staffBar ? '<div class="nc-smw">' + A.staffBar(M) + "</div>" : "") + '<button type="button" class="nc-back" data-act="back" aria-label="Назад към всички проекти" title="Всички проекти">' + ic("arrow-left") + "</button>" +
      "<h2>" + esc(p.title || "Проект без заглавие") + "</h2>" +
      '<div class="sub">' + (loc ? "<span>" + ic("pin") + esc(loc) + "</span>" : "") + (p.address ? "<span>" + esc(p.address) + "</span>" : "") + badges + "</div></div>" +
      '<div class="nc-stats" role="list" aria-label="Броячи на проекта">' + stats.map(function (s) {
        return '<div class="nc-stat" role="listitem">' + (ST[s[0]] ? dot(s[0]) : ic(s[0])) + "<b>" + esc(s[1]) + "</b><span>" + esc(s[2]) + "</span></div>";
      }).join("") + "</div></div>";
  }
  function tabsHtml() {
    return '<div class="nc-tabs" role="tablist" aria-label="Раздели на проекта">' + TABS.map(function (t) {
      var on = S.tab === t[0];
      return '<button type="button" role="tab" class="nc-tab" id="nc-t-' + t[0] + '" data-tab="' + t[0] + '" aria-selected="' + on + '" aria-controls="nc-panel" tabindex="' + (on ? 0 : -1) + '">' + ic(t[2]) + "<span>" + esc(t[1]) + "</span></button>";
    }).join("") + "</div>";
  }
  function renderProject() {
    setSub(M.project.title || "Проект");
    document.title = (M.project.title ? M.project.title + " · " : "") + "Ново строителство · Имоти Надежда";
    root.innerHTML = '<div class="nc-pv">' + headHtml() + tabsHtml() +
      '<section class="nc-panel" id="nc-panel" role="tabpanel" aria-labelledby="nc-t-' + S.tab + '" tabindex="-1">' + panelHtml() + "</section></div>";
    afterPanel();
  }
  NC.rerender = function () { if (S.view === "project" && M) { var sc = scroller().scrollTop; renderProject(); scroller().scrollTop = sc; } else if (S.view === "list") renderList(); };
  function scroller() { return document.documentElement.classList.contains("desk") ? root : document.scrollingElement || document.documentElement; }
  function refreshPanel() {
    var pn = $("#nc-panel", root); if (!pn) return renderProject();
    if (VIEWER && VIEWER.keep && VIEWER.keep()) { /* същият план – само маркировката и картата се обновяват */ updateCards(); VIEWER.mark(S.u); return; }
    if (S.tab === "b3d" && V3) { light3(); return; }
    pn.innerHTML = panelHtml(); pn.setAttribute("aria-labelledby", "nc-t-" + S.tab); afterPanel();
  }
  function updateCards() { $$(".nc-uc-slot", root).forEach(function (el) { el.innerHTML = unitCard(unit(S.u), el.getAttribute("data-v")); }); $$("[data-unit]", root).forEach(function (el) { if (el.classList.contains("nc-u") || el.hasAttribute("aria-pressed")) { var on = el.getAttribute("data-unit") === S.u; if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", on); el.classList.toggle("sel", on); } }); }
  function switchTab(t, push, focusTab) {
    if (TABIDS.indexOf(t) < 0) return;
    S.tab = t; destroyViewer();
    $$(".nc-tab", root).forEach(function (b) { var on = b.getAttribute("data-tab") === t; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focusTab) b.focus(); if (on && b.scrollIntoView && !document.documentElement.classList.contains("desk")) b.scrollIntoView({ block: "nearest", inline: "center" }); });
    var pn = $("#nc-panel", root); pn.setAttribute("aria-labelledby", "nc-t-" + t); pn.innerHTML = panelHtml(); afterPanel();
    sync(push);
  }
  function selectUnit(id, push) { if (!unit(id)) return; S.u = id; implicitU = false; validate(false); refreshPanel(); sync(push); }
  function selectFloor(fid, push) { var f = floor(fid); if (!f) return; S.f = fid; S.b = f.building_id; var us = unitsOf(fid); S.u = us[0] ? us[0].id : null; implicitU = !us[0]; destroyViewer(); var pn = $("#nc-panel", root); pn.innerHTML = panelHtml(); afterPanel(); sync(push); }
  NC.select = { unit: selectUnit, floor: selectFloor, tab: switchTab };

  function panelHtml() {
    try {
      switch (S.tab) {
        case "overview": return tOverview(); case "units": return tUnits(); case "plans": return tPlans(); case "b3d": return t3d(); case "tour": return tTour();
        case "build": return tBuild(); case "gallery": return tGallery(); case "docs": return tDocs(); case "contacts": return tContacts();
      }
    } catch (e) { if (window.console) console.warn("nc panel", e); return empty("triangle-alert", "Разделът не може да се покаже", "Опитайте да презаредите страницата.", btn("reload", "refresh-cw", "Презареди"), "err"); }
    return "";
  }
  function afterPanel() {
    destroy3();
    if (S.tab === "plans") mountPlan();
    if (S.tab === "b3d") mount3d();
    if (S.tab === "tour") mountPano();
    if (S.tab === "overview") heroBind();
    if (A.afterPanel) A.afterPanel(S.tab, M);
  }

  /* ---------------- „Избран апартамент“ (едно и също навсякъде) ---------------- */
  function unitCard(u, v) {
    var title = "Избран апартамент" + (u ? " – " + u.code : "");
    if (!u) return card(title, "house", null, '<div class="pick">' + ic("layout-grid") + (M.units.length ? "Изберете апартамент от списъка, плана или етажите." : "В проекта още няма въведени апартаменти.") + "</div>", "nc-uc");
    var f = floor(u.floor_id), b = bldg(u.building_id), sold = u.status === "sold";
    var areaB = u.area_total != null ? esc(nfmt(u.area_total, 2)) + " м<sup>2</sup>" : "—";
    var ppm = u.price_per_m2 != null ? esc(eur2(u.price_per_m2)) : "—";
    var tot;
    if (u.price_total != null) tot = '<div class="tot">' + ic("coins") + "<span>Обща цена" + (u.price_override ? " (ръчна)" : "") + ":</span><b>" + esc(eur(u.price_total)) + "</b></div>" +
      (u.price_override ? '<p class="tnote">Ръчно въведена цена' + (u.price_override_reason ? " – " + esc(u.price_override_reason) : "") + "</p>" : '<p class="tnote">Площ × цена на м², изчислено от системата</p>');
    else tot = '<div class="tot na">' + ic("coins") + "<b>" + (sold && A.mode === "public" ? "Продаден – цената не се показва" : sold ? "Продаден" : "Цената още не е въведена") + "</b></div>";
    var specs = [["bed-double", u.rooms != null ? u.rooms + (u.rooms === 1 ? " стая" : " стаи") : "—", u.beds != null ? u.beds + " спални" : ""], ["bath", u.baths != null ? u.baths + (u.baths === 1 ? " баня" : " бани") : "—", ""],
      ["umbrella", "Тераса", u.terrace_area != null ? m2(u.terrace_area) : "—"], ["sun", "Изложение", u.exposure || "—"]];
    var acts = "";
    if (v !== "plans") acts += btn("plan", "layers", "Виж разпределение", { cls: "hot" });
    if (A.mode === "public") acts += btn("viewing", "calendar-check", "Запази оглед") + btn("inquiry", "mail", "Изпрати запитване");
    else acts += btn("viewing", "calendar-check", "Запази оглед");
    acts += btn("cmp", "columns-2", S.cmp.indexOf(u.id) >= 0 ? "Махни от сравнение" : "Добави за сравнение", { data: 'data-unit="' + esc(u.id) + '"', cls: "sm" });
    var inner = '<div class="where">' + stChip(u.status) + "<span>Сграда: <b>" + esc(bName(b)) + "</b></span><span>Етаж: <b>" + esc(floorName(f)) + "</b></span></div>" + '<div class="big"><div><span>' + ic("ruler") + "Обща площ</span><b>" + areaB + "</b>" + (u.area_net != null ? "<small>Чиста площ " + esc(m2(u.area_net)) + "</small>" : "") + "</div>" +
      "<div><span>" + ic("coins") + "Цена на м²</span><small>(фиксирана)</small><b>" + (sold && A.mode === "public" ? "—" : ppm) + "</b></div></div>" + tot +
      '<div class="specs">' + specs.map(function (s) { return "<div>" + ic(s[0]) + "<span><b>" + esc(s[1]) + "</b>" + esc(s[2]) + "</span></div>"; }).join("") + "</div>" +

      '<div class="acts">' + acts + "</div>" + (A.unitActs ? A.unitActs(u) : "");
    return card(title, "house", null, inner, "nc-uc");
  }
  function ucSlot(v) { return '<div class="nc-uc-slot" data-v="' + esc(v || "") + '">' + unitCard(unit(S.u), v) + "</div>"; }
  NC.unitCard = unitCard;

  /* ---------------- 1. Общ преглед ---------------- */
  function media() { var a = []; if (M.cover) a.push({ url: M.cover.url, title: M.cover.title || "Корица на проекта", type: "image" }); (M.gallery || []).forEach(function (g) { if (g.url && g.type === "image") a.push(g); }); return a; }
  function tOverview() {
    var p = M.project, c = counts(M.units), ms = media();
    if (S.hi >= ms.length) S.hi = 0;
    var hero;
    if (!M.cover) hero = '<div class="nc-hero a-hero"><div class="none">' + ic("image") + "<h3>Няма качена корица на проекта</h3><p>Тук се показва реалната визуализация или снимка на резиденцията. Корицата се задава от администратор" + (A.mode === "public" ? "." : " в раздел „Галерия“.") + "</p>" + (A.heroActs ? A.heroActs() : "") + "</div></div>";
    else {
      var cur = ms[S.hi] || ms[0];
      hero = '<div class="nc-hero a-hero" aria-roledescription="галерия" aria-label="Снимки на проекта"><div class="stage">' +
        '<img id="nc-hero-img" src="' + esc(cur.url) + '" alt="' + esc(cur.title || p.title || "Проект") + '" decoding="async">' +
        '<span class="cap">' + ic("image") + '<span id="nc-hero-cap">' + esc(cur.title || "Корица на проекта") + "</span></span>" +
        '<button type="button" class="nc-round tr" data-act="herofull" aria-label="На цял екран" title="На цял екран">' + ic("maximize-2") + "</button>" +
        '<button type="button" class="nc-round tr2" data-tab="tour" aria-label="Към 360° разходка" title="360° разходка">' + ic("r360") + "</button>" +
        (ms.length > 1 ? '<button type="button" class="nc-round l" data-act="heroprev" aria-label="Предишна снимка">' + ic("chevron-left") + '</button><button type="button" class="nc-round r" data-act="heronext" aria-label="Следваща снимка">' + ic("chev-r") + "</button>" : "") +
        "</div>" + (ms.length > 1 ? '<div class="nc-thumbs" role="group" aria-label="Миниатюри">' + ms.map(function (m, i) { return '<button type="button" data-act="hero" data-i="' + i + '" aria-label="' + esc("Снимка " + (i + 1) + ": " + (m.title || "")) + '" aria-current="' + (i === S.hi) + '" style="background-image:url(&quot;' + esc(m.url) + '&quot;)"></button>'; }).join("") + "</div>" : "") + "</div>";
    }
    var info = card("Основна информация", "building-2", PH.info, '<div class="nc-rows">' +
      row("layout-grid", "Общо апартаменти:", esc(M.units.length)) + row("layers", "Етажи:", esc(M.floors.length)) + row("building-2", "Сгради:", esc(M.buildings.length)) +
      row("circle-check", "Свободни:", dot("free") + esc(c.free)) + row("lock", "Капарирани:", dot("reserved") + esc(c.reserved)) + row("tag", "Продадени:", dot("sold") + esc(c.sold)) +
      (p.expected_completion ? row("calendar", "Завършване:", esc(p.expected_completion)) : "") + "</div>", "a-info");
    var stage = card("Етап на завършване", "hard-hat", PH.stage, stepsHtml(p) + '<div class="nc-stage-ft">' + ic("calendar") + (p.expected_completion ? "<span>Очаквано завършване: <b>" + esc(p.expected_completion) + "</b></span>" : "<span>Очакваното завършване не е въведено.</span>") + "</div>", "a-stage");
    var adv = card("Предимства", "gem", PH.adv, (p.advantages && p.advantages.length ? '<ul class="nc-adv">' + p.advantages.map(function (a) { return "<li>" + ic("circle-check") + esc(a) + "</li>"; }).join("") + "</ul>" : '<p class="nc-note">Няма въведени предимства.</p>'), "a-adv");
    return '<div class="nc-ov">' + hero + '<div class="a-info">' + info + '</div><div class="a-unit">' + ucSlot("overview") + '</div><div class="a-stage">' + stage + '</div><div class="a-adv">' + adv + "</div>" + '<div class="a-acts">' + actsHtml() + "</div></div>";
  }
  function stepsHtml(p) {
    var k = STAGES.map(function (s) { return s[0]; }).indexOf(p.stage);
    return '<ol class="nc-steps" aria-label="Етапи на строителството">' + STAGES.map(function (s, i) {
      var cls = k < 0 ? "" : i < k ? "done" : i === k ? "cur" : "";
      return '<li class="nc-step ' + cls + '"' + (i === k ? ' aria-current="step"' : "") + "><i></i><span>" + esc(s[1]) + "</span></li>";
    }).join("") + "</ol>" + (k < 0 ? '<p class="nc-note">Етапът на строителството не е въведен.</p>' : "");
  }
  /* динамичните действия: всяко е реално или честно недостъпно (с причина) */
  function actsHtml() {
    var a = [], u = unit(S.u), br = brochure();
    function act(act, icon, text, o) { o = o || {}; a.push('<button type="button" class="nc-act' + (o.cls ? " " + o.cls : "") + '" data-act="' + act + '"' + (o.dis ? ' aria-disabled="true" title="' + esc(o.dis) + '"' : "") + ">" + ic(icon) + "<span>" + esc(text) + "</span>" + (o.dis ? "<small>" + esc(o.short || "недостъпно") + "</small>" : "") + "</button>"); }
    act("tab-tour", "r360", "Виртуална разходка (360°)");
    act("compare", "columns-2", "Сравни апартаменти" + (S.cmp.length ? " (" + S.cmp.length + ")" : ""), S.cmp.length < 2 ? { dis: "Изберете поне 2 апартамента („Добави за сравнение“)", short: "изберете 2+" } : null);
    act("mortgage", "calculator", "Калкулатор ипотека", A.canMortgage && A.canMortgage() ? (u && u.price_total ? null : { dis: "Избраният апартамент няма цена", short: "няма цена" }) : { dis: "Калкулаторът е наличен само в CRM", short: "само в CRM" });
    act("location", "map-pin-house", "Локация и среда", hasLoc(M.project) ? null : { dis: "Не е въведено местоположение на проекта", short: "няма адрес" });
    act("brochure", "download", "Изтегли брошура", br ? null : { dis: "Няма качена брошура (публичен файл с име „Брошура…“)", short: "няма брошура" });
    act("viewing", "calendar-check", "Запази оглед", { cls: "gold" });
    if (A.mode === "public") act("inquiry", "mail", "Изпрати запитване");
    act("share", "share-2", "Сподели", A.shareUrl && A.shareUrl(M, u) ? null : { dis: "Проектът не е публикуван – няма публичен адрес", short: "не е публикуван" });
    act("fav", "heart", "Добави в любими", { dis: "Любими за апартаменти от проект още няма в системата", short: "още няма" });
    return '<div class="nc-acts" role="group" aria-label="Действия">' + a.join("") + "</div>";
  }
  /* местоположение: само въведеното в проекта (координати или адрес); картата е OpenStreetMap в нов прозорец – без вградени външни скриптове */
  function hasLoc(p) { return !!((p.location && p.location.lat != null) || p.address || p.city); }
  function mapUrl(p) {
    var l = p.location;
    if (l && l.lat != null && l.lng != null) return "https://www.openstreetmap.org/?mlat=" + encodeURIComponent(l.lat) + "&mlon=" + encodeURIComponent(l.lng) + "#map=16/" + encodeURIComponent(l.lat) + "/" + encodeURIComponent(l.lng);
    var q = [p.address, p.hood, p.city].filter(Boolean).join(", ");
    return q ? "https://www.openstreetmap.org/search?query=" + encodeURIComponent(q) : null;
  }
  NC.mapUrl = mapUrl;
  function goForm(id) {
    if (S.tab !== "contacts") switchTab("contacts", true);
    setTimeout(function () { var f = document.getElementById(id); if (!f) return; if (f.scrollIntoView) f.scrollIntoView({ block: "start" }); var i = f.querySelector("input,select,textarea,button"); if (i) try { i.focus({ preventScroll: true }); } catch (x) { i.focus(); } }, 30);
  }
  function brochure() { return (M.files || []).filter(function (f) { return f.access === "public" && /брошур/i.test(f.title || "") && f.path; })[0] || null; }
  function heroBind() { /* миниатюрите и стрелките са през data-act */ }
  function heroShow(i) {
    var ms = media(); if (!ms.length) return; S.hi = (i + ms.length) % ms.length; var m = ms[S.hi];
    var img = $("#nc-hero-img", root); if (img) { img.src = m.url; img.alt = m.title || ""; }
    var cap = $("#nc-hero-cap", root); if (cap) cap.textContent = m.title || "Корица на проекта";
    $$(".nc-thumbs button", root).forEach(function (b, k) { b.setAttribute("aria-current", k === S.hi); });
  }

  /* ---------------- 2. Апартаменти ---------------- */
  function fopts() {
    var bs = M.buildings.map(function (b) { return [b.id, bName(b)]; });
    var fl = M.floors.filter(function (f) { return !S.flt.b || f.building_id === S.flt.b; }).sort(function (a, b) { return a.level - b.level; })
      .map(function (f) { return [f.id, (S.flt.b ? "" : bName(bldg(f.building_id)) + " · ") + floorName(f)]; });
    var rs = []; M.units.forEach(function (u) { if (u.rooms != null) { var k = u.rooms >= 5 ? "5" : String(u.rooms); if (rs.indexOf(k) < 0) rs.push(k); } }); rs.sort();
    var ex = []; M.units.forEach(function (u) { if (u.exposure && ex.indexOf(u.exposure) < 0) ex.push(u.exposure); }); ex.sort(function (a, b) { return a.localeCompare(b, "bg"); });
    return { b: bs, f: fl, r: rs.map(function (k) { return [k, k === "5" ? "5+ стаи (многостаен)" : ROOMS[k] || k + " стаи"]; }), a: AREAS, p: PRICES, e: ex.map(function (x) { return [x, x]; }), s: [["free", "Свободен"], ["reserved", "Капариран"], ["sold", "Продаден"]], o: SORTS };
  }
  var FL = [["b", "Сграда / вход", "building-2"], ["f", "Етаж", "layers"], ["r", "Стаи / тип", "bed-double"], ["a", "Площ", "ruler"], ["p", "Цена", "coins"], ["e", "Изложение", "sun"], ["s", "Статус", "circle-check"], ["o", "Подредба", "arrow-up-down"]];
  function match(u, f) {
    if (f.b && u.building_id !== f.b) return false;
    if (f.f && u.floor_id !== f.f) return false;
    if (f.r) { if (u.rooms == null) return false; if (f.r === "5" ? u.rooms < 5 : String(u.rooms) !== f.r) return false; }
    if (f.a) { var a = f.a.split("-"); if (u.area_total == null || u.area_total < +a[0] || u.area_total > +a[1]) return false; }
    if (f.p) { var p = f.p.split("-"); if (u.price_total == null || u.price_total < +p[0] || u.price_total > +p[1]) return false; }
    if (f.e && u.exposure !== f.e) return false;
    if (f.s && u.status !== f.s) return false;
    if (f.q && String(u.code).toLocaleLowerCase("bg").indexOf(String(f.q).toLocaleLowerCase("bg")) < 0) return false;
    return true;
  }
  function filtered() {
    var f = S.flt, list = M.units.filter(function (u) { return match(u, f); });
    var lv = {}; M.floors.forEach(function (x) { lv[x.id] = x.level; });
    var o = f.o || "code";
    if (o === "pasc" || o === "pdesc") list.sort(function (a, b) { var x = a.price_total, y = b.price_total; if (x == null) return 1; if (y == null) return -1; return o === "pasc" ? x - y : y - x; });
    else if (o === "area") list.sort(function (a, b) { return (b.area_total || 0) - (a.area_total || 0); });
    else if (o === "floor") list.sort(function (a, b) { return (lv[a.floor_id] - lv[b.floor_id]) || String(a.code).localeCompare(String(b.code), "bg"); });
    else list = orderUnits(list);
    return list;
  }
  function tUnits() {
    if (!M.units.length) return '<div class="nc-two"><div>' + empty("layout-grid", "Няма въведени апартаменти", A.mode === "staff" ? "Добавете сграда, етажи и апартаменти (или използвайте импорта, когато е наличен)." : "За този проект още няма публикувани апартаменти.", A.unitsEmptyActs ? A.unitsEmptyActs() : "") + (A.structHtml ? A.structHtml(M) : "") + '</div><div class="side">' + ucSlot("units") + "</div></div>";
    var o = fopts();
    var fh = '<div class="nc-filt" role="group" aria-label="Филтри на апартаментите">' + FL.map(function (x) {
      var k = x[0], opts = o[k] || [], cur = S.flt[k] || "", has = opts.some(function (y) { return y[0] === cur; });
      if (!has) cur = "";
      var val = cur ? opts.filter(function (y) { return y[0] === cur; })[0][1] : (k === "o" ? "По код" : "Всички");
      return '<label class="nc-f' + (cur && k !== "o" ? " set" : "") + '">' + ic(x[2]) + '<span class="ftx"><small class="flab">' + esc(x[1]) + '</small><span class="val">' + esc(val) + '</span></span><svg class="i chev" aria-hidden="true"><use href="#chev-d"/></svg>' +
        '<select data-flt="' + k + '" aria-label="' + esc(x[1]) + '"><option value="">' + (k === "o" ? "По код" : "Всички") + "</option>" + opts.map(function (y) { return '<option value="' + esc(y[0]) + '"' + (y[0] === cur ? " selected" : "") + ">" + esc(y[1]) + "</option>"; }).join("") + "</select></label>";
    }).join("") + '<label class="nc-f">' + ic("search") + '<span class="ftx"><small class="flab">Код</small><input id="nc-uq" data-flt="q" type="search" value="' + esc(S.flt.q || "") + '" placeholder="напр. А1-02" aria-label="Търси по код на апартамент" style="border:0;background:transparent;font:700 25px/1 var(--cond);color:#22090d;outline:0;width:100%"></span></label></div>';
    var list = filtered(), any = Object.keys(S.flt).some(function (k) { return k !== "o" && S.flt[k]; });
    var bar = '<div class="nc-fbar"><p class="nc-found" aria-live="polite">Намерени: <b>' + list.length + "</b> от " + M.units.length + "</p>" + (any ? btn("fclear", "x", "Изчисти филтрите", { cls: "sm" }) : "") +
      btn("compare", "columns-2", "Сравни" + (S.cmp.length ? " (" + S.cmp.length + ")" : ""), { cls: "sm" + (S.cmp.length >= 2 ? " hot" : ""), disabled: S.cmp.length < 2, title: S.cmp.length < 2 ? "Отбележете поне 2 апартамента" : "" }) + "</div>";
    var body;
    if (!list.length) body = empty("search", "Няма апартаменти по избраните филтри", "Променете или изчистете филтрите.", btn("fclear", "x", "Изчисти филтрите"));
    else if ((S.flt.o || "code") === "code" || S.flt.o === "floor") body = groupsHtml(list);
    else body = '<div class="nc-fsec"><div class="nc-ul">' + list.map(urow).join("") + "</div></div>";
    return '<div class="nc-two"><div>' + fh + bar + body + (A.structHtml ? A.structHtml(M) : "") + '</div><div class="side">' + ucSlot("units") + "</div></div>";
  }
  function groupsHtml(list) {
    var h = "";
    M.buildings.forEach(function (b) {
      var fl = floorsOf(b.id), inB = list.filter(function (u) { return u.building_id === b.id; }); if (!inB.length) return;
      h += '<div class="nc-bsec"><h3>' + ic("building-2") + esc(bName(b)) + "</h3>";
      fl.forEach(function (f) {
        var us = inB.filter(function (u) { return u.floor_id === f.id; }); if (!us.length) return;
        var c = counts(us);
        h += '<section class="nc-fsec" aria-label="' + esc(bName(b) + ", " + floorName(f)) + '"><h4>' + ic("layers") + esc(floorName(f)) + '<span class="c">' + ["free", "reserved", "sold"].map(function (s) { return c[s] ? "<span>" + dot(s) + c[s] + "</span>" : ""; }).join("") + '</span></h4><div class="nc-ul">' + us.map(urow).join("") + "</div></section>";
      });
      h += "</div>";
    });
    return h;
  }
  function urow(u) {
    var on = u.id === S.u, inC = S.cmp.indexOf(u.id) >= 0, pr;
    if (u.price_total != null) pr = '<span class="pr">' + esc(eur(u.price_total)) + (u.price_per_m2 != null ? "<small>" + esc(eur2(u.price_per_m2)) + " / м²</small>" : "") + "</span>";
    else pr = '<span class="pr na">' + (u.status === "sold" && A.mode === "public" ? "цената не се показва" : "няма цена") + "</span>";
    return '<div class="nc-u' + (on ? " sel" : "") + '" data-unit="' + esc(u.id) + '">' +
      '<label class="nc-cmpk' + (inC ? " on" : "") + '" title="Сравни"><input type="checkbox" data-act="cmpk" data-unit="' + esc(u.id) + '"' + (inC ? " checked" : "") + ' aria-label="' + esc("Сравни " + u.code) + '">' + ic("check") + "</label>" +
      '<button type="button" class="code" data-act="pick" data-unit="' + esc(u.id) + '" aria-pressed="' + on + '" style="border:0;background:none;text-align:left;cursor:pointer;padding:0">' + esc(u.code) + "</button>" + stChip(u.status) +
      '<span class="sp">' + (u.rooms != null ? "<span><b>" + esc(u.rooms) + "</b> " + (u.rooms === 1 ? "стая" : "стаи") + "</span>" : "") + (u.area_total != null ? "<span><b>" + esc(m2(u.area_total)) + "</b></span>" : "<span>площ: —</span>") +
      (u.terrace_area ? "<span>тераса " + esc(m2(u.terrace_area)) + "</span>" : "") + (u.exposure ? "<span>" + esc(u.exposure) + "</span>" : "") + "</span>" + pr + "</div>";
  }

  /* ---------------- 3. Разпределения ---------------- */
  function floorsNav() {
    var h = '<div class="nc-floors" role="group" aria-label="Етажи">';
    M.buildings.forEach(function (b) {
      var fl = floorsOf(b.id); if (!fl.length) return;
      if (M.buildings.length > 1) h += '<span class="bl">' + esc(bName(b)) + "</span>";
      fl.forEach(function (f) { h += '<button type="button" data-act="floor" data-floor="' + esc(f.id) + '" aria-pressed="' + (f.id === S.f) + '">' + esc(floorName(f)) + "</button>"; });
    });
    return h + "</div>";
  }
  function tPlans() {
    var f = floor(S.f), u = unit(S.u);
    if (!M.floors.length) return '<div class="nc-two"><div>' + empty("layers", "Няма въведени етажи", "Разпределенията се показват, след като в проекта има сгради, етажи и планове.") + '</div><div class="side">' + ucSlot("plans") + "</div></div>";
    var us = f ? unitsOf(f.id) : [];
    var canUnit = !!u, canFloor = !!(f && f.has_plan);
    if (S.pmode === "floor" && !canFloor && canUnit) S.pmode = "unit";
    var title = "Разпределение – " + (f ? (M.buildings.length > 1 ? bName(bldg(f.building_id)) + ", " : "") + floorName(f) : "");
    var modes = '<div class="nc-pmode" role="group" aria-label="Изглед на плана"><button type="button" data-act="pmode" data-v="floor" aria-pressed="' + (S.pmode === "floor") + '">' + ic("layers") + " Етажен план</button>" +
      '<button type="button" data-act="pmode" data-v="unit" aria-pressed="' + (S.pmode === "unit") + '"' + (u ? "" : " disabled") + ">" + ic("house") + " План на " + esc(u ? u.code : "апартамента") + "</button></div>";
    var codes = us.length ? '<div class="nc-ucodes" role="group" aria-label="Апартаменти на етажа">' + us.map(function (x) { return '<button type="button" data-act="pick" data-unit="' + esc(x.id) + '" aria-pressed="' + (x.id === S.u) + '">' + dot(x.status) + esc(x.code) + "</button>"; }).join("") + "</div>" : '<p class="nc-note" style="margin-top:12px">На този етаж няма въведени апартаменти.</p>';
    var inner = '<div class="nc-pl">' + floorsNav() + "<div>" + modes + '<div class="nc-vw" id="nc-vw" tabindex="0" role="application" aria-roledescription="преглед на план" aria-label="' + esc(title) + '. Плюс и минус – мащаб, стрелки – местене, 0 – начален изглед."></div>' + codes + (A.planActs ? A.planActs(f, u) : "") + "</div></div>";
    var pinfo = card("За разпределенията", "file-text", PH.plans, '<p class="nc-note">Свободен апартамент: публичният план е копие с воден знак, направено от сървъра. Капариран или продаден: публиката не получава план – показва се само печат със статуса.' + (A.mode === "staff" ? " Екипът вижда оригинала с кратък подписан линк (до 1 час)." : "") + "</p>", "nc-pinfo");
    return '<div class="nc-two"><div style="display:flex;flex-direction:column;gap:20px">' + card(title, "layers", null, inner, "nc-plc") + pinfo + '</div><div class="side">' + ucSlot("plans") + "</div></div>";
  }
  function destroyViewer() { if (VIEWER) { VIEWER.destroy(); VIEWER = null; } destroy3(); }
  function mountPlan() {
    destroyViewer();
    var el = $("#nc-vw", root); if (!el) return;
    var f = floor(S.f), u = unit(S.u);
    if (S.pmode === "floor") {
      if (!f || !f.has_plan) { el.innerHTML = '<div class="none">' + ic("layers") + "<b>За този етаж няма достъпен план</b><span>" + esc(A.mode === "staff" ? "Качете етажния план (JPG/PNG; PDF се приема само като оригинал за екипа)." : "Етажният план още не е публикуван.") + "</span></div>"; return; }
      el.innerHTML = '<div class="none" role="status"><span class="nc-spin" aria-hidden="true"></span><span>Зареждане на плана…</span></div>';
      A.floorPlan(f).then(function (r) {
        if (!document.contains(el)) return;
        if (!r || !r.url) { el.innerHTML = '<div class="none">' + ic("layers") + "<b>Планът не е достъпен</b><span>" + esc(r && r.why ? r.why : "Опитайте по-късно.") + "</span></div>"; return; }
        var polys = (f.polygons || []).map(function (p) { var x = M.units.filter(function (z) { return z.code === p.unit_code && z.floor_id === f.id; })[0]; return x ? { id: x.id, code: x.code, status: x.status, pts: p.points } : null; }).filter(Boolean);
        VIEWER = viewer(el, { src: r.url, label: r.label, polys: polys, sel: S.u, onPick: function (id) { selectUnit(id, true); }, keepKey: "f:" + f.id });
      }, function (e) { if (document.contains(el)) el.innerHTML = '<div class="none">' + ic("triangle-alert") + "<b>Планът не се зареди</b><span>" + esc(e && e.message || "") + "</span></div>"; });
      return;
    }
    if (!u) { el.innerHTML = '<div class="none">' + ic("house") + "<b>Изберете апартамент</b></div>"; return; }
    if (u.status !== "free" && !(A.mode === "staff" && S.showOrig === u.id)) { el.innerHTML = lockedHtml(u); return; }
    if (!u.has_plan) { el.innerHTML = '<div class="none">' + ic("house") + "<b>Няма " + (A.mode === "staff" ? "качен" : "публичен") + " план на " + esc(u.code) + "</b><span>" + esc(A.mode === "staff" ? "Качете плана на апартамента (JPG/PNG; PDF се пази само като оригинал за екипа)." : "Планът на апартамента още не е публикуван.") + "</span></div>"; return; }
    el.innerHTML = '<div class="none" role="status"><span class="nc-spin" aria-hidden="true"></span><span>Зареждане на плана…</span></div>';
    A.unitPlan(u).then(function (r) {
      if (!document.contains(el)) return;
      if (!r || !r.url) { el.innerHTML = '<div class="none">' + ic("house") + "<b>Планът не е достъпен</b><span>" + esc(r && r.why ? r.why : "") + "</span></div>"; return; }
      VIEWER = viewer(el, { src: r.url, label: r.label, polys: [], keepKey: "u:" + u.id });
    }, function (e) { if (document.contains(el)) el.innerHTML = '<div class="none">' + ic("triangle-alert") + "<b>Планът не се зареди</b><span>" + esc(e && e.message || "") + "</span></div>"; });
  }
  /* Капариран / Продаден: публиката не получава файл на плана – само печат, изграден от текст и CSS */
  function lockedHtml(u) {
    var w = (ST[u.status] || "").toUpperCase();
    return '<div class="nc-locked"><span class="nc-stamp" role="img" aria-label="' + esc("Печат: " + w) + '">' + esc(w) + "</span><p>Разпределението на апартамент " + esc(u.code) + " не се показва публично, защото е " + esc((ST[u.status] || "").toLowerCase()) + ".</p>" +
      (A.mode === "staff" && u.has_plan ? btn("orig", "eye", "Покажи оригинала (само за екипа)", { data: 'data-unit="' + esc(u.id) + '"' }) : "") + "</div>";
  }
  NC.lockedHtml = lockedHtml;

  /* преглед на план: мащаб, местене, цял екран, начален изглед, клавиатура и докосване; без външни библиотеки */
  function viewer(el, o) {
    var s = 1, tx = 0, ty = 0, W = 1, H = 1, fit = 1, ptrs = {}, start = null, moved = false, dead = false;
    el.innerHTML = '<div class="pan"><img alt="" draggable="false"><svg class="poly" aria-hidden="false"></svg></div><div class="labs" aria-hidden="true"></div>' +
      (o.label ? '<span class="lab">' + ic("eye") + esc(o.label) + "</span>" : "") +
      '<div class="ctl"><button type="button" data-v="in" aria-label="Приближи" title="Приближи">' + ic("zoom-in") + '</button><button type="button" data-v="out" aria-label="Отдалечи" title="Отдалечи">' + ic("zoom-out") +
      '</button><button type="button" data-v="fs" aria-label="На цял екран" title="На цял екран">' + ic("maximize-2") + '</button><button type="button" data-v="reset" aria-label="Начален изглед" title="Начален изглед">' + ic("rotate-ccw") + "</button></div>" +
      '<span class="hint">Плъзнете за местене · колелце или два пръста за мащаб</span>';
    var pan = el.querySelector(".pan"), img = pan.querySelector("img"), svg = pan.querySelector("svg"), labs = el.querySelector(".labs");
    labs.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:2";
    function apply() { pan.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")"; placeLabels(); }
    function vw() { return el.clientWidth || 1; } function vh() { return el.clientHeight || 1; }
    function reset() { fit = Math.min(vw() / W, vh() / H) * 0.96; s = fit; tx = (vw() - W * s) / 2; ty = (vh() - H * s) / 2; apply(); }
    function clamp() { var mw = W * s, mh = H * s, m = 60; tx = Math.min(Math.max(tx, Math.min(m, vw() - mw - m) - (mw > vw() ? 0 : 0)), Math.max(vw() - m, vw() - mw)); if (mw < vw()) tx = Math.min(Math.max(tx, -mw + m), vw() - m); ty = Math.min(Math.max(ty, -mh + m), vh() - m); }
    function zoomAt(k, cx, cy) { var ns = Math.min(Math.max(s * k, fit * 0.6), fit * 8); var r = ns / s; tx = cx - (cx - tx) * r; ty = cy - (cy - ty) * r; s = ns; clamp(); apply(); }
    function placeLabels() {
      labs.innerHTML = (o.polys || []).map(function (p) {
        var cx = 0, cy = 0; p.pts.forEach(function (q) { cx += q[0]; cy += q[1]; }); cx /= p.pts.length; cy /= p.pts.length;
        return '<span class="nc-plabel ' + (p.id === o.sel ? "sel" : esc(p.status)) + '" style="left:' + (tx + cx * W * s) + "px;top:" + (ty + cy * H * s) + 'px">' + esc(p.code) + "</span>";
      }).join("");
    }
    function drawPolys() {
      svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("width", W); svg.setAttribute("height", H);
      svg.innerHTML = (o.polys || []).map(function (p) {
        return '<polygon class="pu ' + esc(p.status) + (p.id === o.sel ? " sel" : "") + '" data-u="' + esc(p.id) + '" tabindex="0" role="button" aria-label="' + esc(p.code + " – " + (ST[p.status] || "")) + '" points="' + p.pts.map(function (q) { return (q[0] * W).toFixed(1) + "," + (q[1] * H).toFixed(1); }).join(" ") + '"></polygon>';
      }).join("");
    }
    img.onload = function () { if (dead) return; W = img.naturalWidth || 1; H = img.naturalHeight || 1; img.width = W; img.height = H; drawPolys(); reset(); if (o.onReady) o.onReady(api); };
    img.onerror = function () { if (dead) return; el.innerHTML = '<div class="none">' + ic("layers") + "<b>Няма достъпен план</b><span>Файлът не е наличен в момента (може статусът току-що да се е сменил).</span></div>"; };
    img.src = o.src;
    function onWheel(e) { e.preventDefault(); var r = el.getBoundingClientRect(), z = parseFloat(getComputedStyle(document.getElementById("canvas") || el).zoom) || 1; zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientX - r.left) / z, (e.clientY - r.top) / z); }
    function pt(e) { var r = el.getBoundingClientRect(), z = (r.width / (el.offsetWidth || r.width)) || 1; return { x: (e.clientX - r.left) / z, y: (e.clientY - r.top) / z }; }
    function down(e) { if (e.target.closest(".ctl")) return; el.setPointerCapture && el.setPointerCapture(e.pointerId); ptrs[e.pointerId] = pt(e); moved = false; start = { tx: tx, ty: ty, s: s, p: pt(e), d: dist(), m: mid() }; el.classList.add("drag"); }
    function dist() { var k = Object.keys(ptrs); if (k.length < 2) return 0; var a = ptrs[k[0]], b = ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
    function mid() { var k = Object.keys(ptrs); if (k.length < 2) return null; var a = ptrs[k[0]], b = ptrs[k[1]]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    function move(e) {
      if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = pt(e);
      var n = Object.keys(ptrs).length;
      if (n >= 2) { var d = dist(), m = mid(); if (!start.d) { start = { tx: tx, ty: ty, s: s, d: d, m: m }; return; } var ns = Math.min(Math.max(start.s * d / start.d, fit * 0.6), fit * 8), r = ns / start.s; s = ns; tx = m.x - (start.m.x - start.tx) * r; ty = m.y - (start.m.y - start.ty) * r; moved = true; clamp(); apply(); return; }
      var p = ptrs[e.pointerId]; var dx = p.x - start.p.x, dy = p.y - start.p.y; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true; tx = start.tx + dx; ty = start.ty + dy; clamp(); apply();
    }
    function up(e) {
      var wasMoved = moved; delete ptrs[e.pointerId]; el.classList.remove("drag");
      if (Object.keys(ptrs).length === 1) { var k = Object.keys(ptrs)[0]; start = { tx: tx, ty: ty, s: s, p: ptrs[k], d: 0 }; }
      if (!wasMoved && o.onPick && e.type === "pointerup") { var t = document.elementFromPoint(e.clientX, e.clientY), pu = t && t.closest && t.closest(".pu"); if (pu) o.onPick(pu.getAttribute("data-u")); }
    }
    function key(e) {
      if (e.target.closest(".ctl")) return;
      var pu = e.target.closest && e.target.closest(".pu");
      if (pu && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); if (o.onPick) o.onPick(pu.getAttribute("data-u")); return; }
      var c = { "+": 1, "=": 1, "-": -1, "_": -1 }[e.key];
      if (c) { e.preventDefault(); zoomAt(c > 0 ? 1.25 : 0.8, vw() / 2, vh() / 2); return; }
      if (e.key === "0") { e.preventDefault(); reset(); return; }
      var mv = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
      if (mv && e.target === el) { e.preventDefault(); tx += mv[0]; ty += mv[1]; clamp(); apply(); }
      if (e.key === "Escape" && el.classList.contains("fs")) { e.preventDefault(); fsToggle(false); }
    }
    function fsToggle(on) {
      if (el.requestFullscreen && !el.classList.contains("fs")) {
        if (on === false || document.fullscreenElement === el) { if (document.fullscreenElement) document.exitFullscreen(); return; }
        el.requestFullscreen().catch(function () { el.classList.add("fs"); setTimeout(reset, 50); });
        return;
      }
      el.classList.toggle("fs", on == null ? !el.classList.contains("fs") : on); setTimeout(reset, 50);
    }
    function onFs() { setTimeout(reset, 60); var b = el.querySelector('[data-v="fs"]'); if (b) b.setAttribute("aria-label", document.fullscreenElement === el ? "Изход от цял екран" : "На цял екран"); }
    function ctl(e) { var b = e.target.closest(".ctl button"); if (!b) return; var v = b.getAttribute("data-v"); if (v === "in") zoomAt(1.25, vw() / 2, vh() / 2); else if (v === "out") zoomAt(0.8, vw() / 2, vh() / 2); else if (v === "reset") reset(); else if (v === "fs") fsToggle(); }
    el.addEventListener("wheel", onWheel, { passive: false }); el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("keydown", key); el.addEventListener("click", ctl); document.addEventListener("fullscreenchange", onFs);
    var ro = window.ResizeObserver ? new ResizeObserver(function () { if (W > 1) reset(); }) : null; if (ro) ro.observe(el);
    var api = {
      keep: function () { var u = unit(S.u); return S.tab === "plans" && S.pmode === "floor" && o.keepKey === "f:" + S.f && u && u.floor_id === S.f; },
      mark: function (id) { o.sel = id; drawPolys(); placeLabels(); },
      reset: reset, zoom: function (k) { zoomAt(k, vw() / 2, vh() / 2); }, state: function () { return { s: s, tx: tx, ty: ty, fit: fit, W: W, H: H }; }, el: el, svg: svg, img: img, toImage: function (cx, cy) { return [(cx - tx) / s / W, (cy - ty) / s / H]; }, pt: pt,
      setPolys: function (p) { o.polys = p; drawPolys(); placeLabels(); }, opts: o,
      destroy: function () { dead = true; el.removeEventListener("wheel", onWheel); document.removeEventListener("fullscreenchange", onFs); if (ro) ro.disconnect(); if (document.fullscreenElement === el) document.exitFullscreen(); }
    };
    return api;
  }
  NC.viewer = viewer;
  NC.currentViewer = function () { return VIEWER; };
  NC.current3d = function () { return V3 || VP; };
  NC.currentTour = function () { return T10; };

  /* ---------------- 4. 3D Сграда (визуализатор по договора на TASK-009) ---------------- */
  var V3 = null, VP = null, NC3D = null, ENG = {};
  function lib3d() { if (!NC3D) NC3D = import((NC.libBase || "/mobile/crm/") + "crm-nc-3d.js"); return NC3D; }
  /* КУКА за визуализаторите на TASK-009 (3D модел) и TASK-010 (360° / разходка) – един договор с вградения crm-nc-3d.js:
     model: building(el, {url, units, floors, sel, floor, label, onPick, onReady(v), onError}) → {select, setFloor, onlyFloor, reset, view, rotate, zoom, fullscreen, selected, screenOf, info, destroy}
     tour:  panorama(el, {items:[{url,title}], index, onLoading, onShow(i), onError, onAuto}) → {show, look, zoom, reset, fullscreen, auto, index, destroy}
     Откъде: 1) window.NCModel / window.NCTour (обект със същите функции + по избор webglOk(), name), регистриран от /mobile/nc-model.js или /mobile/nc-tour.js;
     2) NC.ENGINE_URL = {model:"/mobile/nc-model.js", tour:"/mobile/nc-tour.js"} – ES модул със същите експорти;
     3) иначе – вграденият crm-nc-3d.js. Ако външният модул не се зареди, честно се минава на вградения (без фалшив 3D/360). */
  NC.ENGINE_URL = NC.ENGINE_URL || {};
  function engine(kind) {
    var fn = kind === "model" ? "building" : "panorama", g = kind === "model" ? window.NCModel : window.NCTour;
    function ok(L) { return L && typeof L[fn] === "function"; }
    function wrap(L, name) { return { name: L.name || name, webglOk: typeof L.webglOk === "function" ? function () { return L.webglOk(); } : function () { return true; }, building: typeof L.building === "function" ? L.building.bind(L) : null, panorama: typeof L.panorama === "function" ? L.panorama.bind(L) : null }; }
    if (ok(g)) return Promise.resolve(wrap(g, kind === "model" ? "TASK-009" : "TASK-010"));
    if (ENG[kind]) return ENG[kind];
    function builtin() { return lib3d().then(function (L) { return wrap(L, "nc-3d"); }); }
    var u = NC.ENGINE_URL[kind];
    ENG[kind] = u ? import(u).then(function (L) { return ok(L) ? wrap(L, kind === "model" ? "TASK-009" : "TASK-010") : builtin(); }, function () { ENG[kind] = null; return builtin(); }) : builtin();
    return ENG[kind];
  }
  NC.engine = engine;
  /* КУКА за пълния компонент на TASK-010 (проверено срещу истинските файлове в wt-010):
       mobile/nc-tour.js (ES модул): mount(el, {source, unit, staff, mode, side, onRoom}) → {destroy, reload, setMode, goRoom, fit, state}; publicSource({rpc, unitId, unit});
       mobile/crm/crm-nc-tour.js (класически скрипт): window.NCTourStaff = {source(unitId, {setId}), panel(el, unitId, {admin, say, onPreview}), lib()}.
     Включва се с window.NC_TOUR_LIB = "/mobile/nc-tour.js" (същото име, което чете и crm-nc-tour.js). Източникът идва от адаптера: A.tour10Source(L, unit, {setId});
     служебният панел (подготовка/публикуване на разходката) – от A.tour10Panel. Ако компонентът не се зареди – честно се минава на вградената 360° панорама. */
  var T10 = null, T10P = null;
  function cssOnce(href) { if (document.querySelector('link[data-nc-css="' + href + '"]')) return; var l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.setAttribute("data-nc-css", href); document.head.appendChild(l); }
  function tour10() {
    var u = window.NC_TOUR_LIB; if (!u || S.t10off) return null;
    if (!ENG.t10) { ENG.t10 = import(u).then(function (L) { if (!L || typeof L.mount !== "function") throw new Error("Компонентът за разходка няма mount()."); cssOnce(String(u).replace(/\.js(\?.*)?$/, ".css")); return L; }); ENG.t10.catch(function () { ENG.t10 = null; }); }
    return ENG.t10;
  }
  NC.tour10 = tour10;
  /* цял екран: Escape и повторно натискане излизат и от истинския Fullscreen API, и от резервния клас .fs; надписът на бутона следва състоянието */
  function fsSync(el, attr) {
    function upd() { if (!document.contains(el)) { document.removeEventListener("fullscreenchange", upd); return; } var on = document.fullscreenElement === el || el.classList.contains("fs"), b = el.querySelector("[" + attr + '="fs"]'); if (b) { b.setAttribute("aria-label", on ? "Изход от цял екран" : "На цял екран"); b.title = b.getAttribute("aria-label"); b.setAttribute("aria-pressed", on); } }
    document.addEventListener("fullscreenchange", upd);
    el.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.fullscreenElement === el) { e.preventDefault(); document.exitFullscreen(); } });
    return upd;
  }
  function destroy3() { if (V3) { try { V3.destroy(); } catch (e) {} V3 = null; } if (VP) { try { VP.destroy(); } catch (e) {} VP = null; } if (T10) { try { T10.destroy(); } catch (e) {} T10 = null; } if (T10P) { try { T10P.destroy(); } catch (e) {} T10P = null; } }
  function floorList() {
    var b = bldg(S.b), fl = b ? floorsOf(b.id) : [];
    if (!fl.length) return '<p class="nc-note">Няма въведени етажи.</p>';
    return '<div class="nc-flist" role="group" aria-label="Етажи">' + fl.map(function (f) { var c = counts(unitsOf(f.id)); return '<button type="button" data-act="floor3" data-floor="' + esc(f.id) + '" aria-pressed="' + (f.id === S.f) + '"><span>' + esc(floorName(f)) + '</span><span class="c">' + ["free", "reserved", "sold"].map(function (s) { return c[s] ? "<span>" + dot(s) + c[s] + "</span>" : ""; }).join("") + "</span></button>"; }).join("") + "</div>";
  }
  function unitChips(act) { var us = S.f ? unitsOf(S.f) : []; return us.length ? '<div class="nc-ucodes" role="group" aria-label="Апартаменти на етажа">' + us.map(function (x) { return '<button type="button" data-act="' + (act || "pick") + '" data-unit="' + esc(x.id) + '" aria-pressed="' + (x.id === S.u) + '">' + dot(x.status) + esc(x.code) + "</button>"; }).join("") + "</div>" : ""; }
  function bldgSel() {
    if (M.buildings.length < 2) return "";
    return '<label class="nc-sel">' + ic("building-2") + '<span class="val">' + esc(bName(bldg(S.b))) + '</span><svg class="i" aria-hidden="true"><use href="#chev-d"/></svg><select data-act="bsel" aria-label="Сграда">' + M.buildings.map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === S.b ? " selected" : "") + ">" + esc(bName(b)) + "</option>"; }).join("") + "</select></label>";
  }
  /* честно „още не е подготвено“; ph28 е само декорация (обобщена сграда), изрично отбелязана – не е този проект */
  function naHtml(icon, tag, title, text, list, tech, photo) {
    return '<div class="nc-na deco" role="status"><div class="nc-na-img" style="background-image:url(' + esc(NC.img(photo || PH.empty3d)) + ')" aria-hidden="true"></div><span class="nc-na-cap">Илюстрация – не е този проект</span>' +
      '<div class="nc-na-t"><span class="tag">' + ic(icon) + esc(tag) + "</span><h3>" + esc(title) + "</h3><p>" + text + "</p>" + (list ? "<ul>" + list.map(function (x) { return "<li>" + ic("circle-check") + esc(x) + "</li>"; }).join("") + "</ul>" : "") + (tech && A.mode === "staff" ? '<p class="tech">' + esc(tech) + "</p>" : "") + "</div></div>";
  }
  function t3d() {
    var b = bldg(S.b), has = b && (M.models || {})[b.id];
    var side = card("Избери етаж", "box", PH.floors3d, bldgSel() + floorList() + unitChips("pick3"), "nc-fsel nc-illu");
    var main;
    if (!b) main = empty("building-2", "Няма въведена сграда", "3D моделът се показва за сграда от проекта.");
    else if (!has) main = naHtml("box", "Интерактивен 3D модел", "3D моделът на " + (bName(b) || "сградата") + " още не е подготвен",
      "Тук се показва реалният 3D модел на сградата: завъртане на 360°, мащаб, местене, избор на етаж и апартамент с осветяване на точния обект и бутон към разпределението му. За тази сграда модел още не е качен – не показваме статична снимка вместо модел. Етажът и апартаментът вдясно остават избрани и в другите раздели.",
      ["Завъртане 360°", "Мащаб и местене", "Начален изглед", "Цял екран", "Докосване на телефон", "Осветяване на апартамента"], "Моделът се прави от IFC/DXF/GLB на сградата (TASK-009: проверка, конвертиране, преглед и публикуване от администратор) – визуализаторът е готов и ще го зареди автоматично (екипът вижда и версията за преглед).");
    else main = '<div class="nc-3d" id="nc-3d" tabindex="0" role="application" aria-roledescription="3D модел" aria-label="' + esc("3D модел на " + bName(b) + ". Стрелки наляво и надясно – завъртане, плюс и минус – мащаб, 0 – начален изглед.") + '">' +
      '<span class="tag3">' + ic("box") + "Интерактивен 3D модел</span>" +
      '<div class="ctl3" role="group" aria-label="Управление на 3D модела">' +
      [["rl", "rotate-ccw", "Завърти наляво"], ["rr", "refresh-cw", "Завърти надясно"], ["zi", "zoom-in", "Приближи"], ["zo", "zoom-out", "Отдалечи"], ["home", "house", "Начален изглед"], ["fs", "maximize-2", "На цял екран"]].map(function (x) { return '<button type="button" data-v3="' + x[0] + '" aria-label="' + x[2] + '" title="' + x[2] + '">' + ic(x[1]) + "</button>"; }).join("") + "</div>" +
      '<div class="st3" id="nc-3d-st" role="status"><span class="nc-spin" aria-hidden="true"></span><span>Зареждане на 3D модела…</span></div></div>' +
      '<div class="views3" role="group" aria-label="Готови изгледи">' + [["front", "Отпред"], ["right", "Отдясно"], ["back", "Отзад"], ["left", "Отляво"], ["top", "Отгоре"]].map(function (x) { return '<button type="button" data-v3="v-' + x[0] + '">' + esc(x[1]) + "</button>"; }).join("") +
      '<label class="only3"><input type="checkbox" id="nc-only3"' + (S.only3 ? " checked" : "") + "> Само избрания етаж</label></div>" +
      '<p class="nc-note n3" id="nc-3d-info" aria-live="polite"></p>';
    return '<div class="nc-two"><div>' + main + '</div><div class="side">' + side + ucSlot("b3d") + "</div></div>";
  }
  function mount3d() {
    var el = $("#nc-3d", root); if (!el) return;
    var b = bldg(S.b), stEl = $("#nc-3d-st", root);
    function fail(msg, icon) { if (!document.contains(el)) return; stEl.innerHTML = '<span class="none3">' + ic(icon || "triangle-alert") + "<b>" + esc(msg) + "</b></span>"; stEl.classList.add("err"); }
    var fsUpd = fsSync(el, "data-v3");
    engine("model").then(function (L) {
      if (!document.contains(el)) return;
      el.setAttribute("data-engine", L.name);
      if (!L.webglOk()) { fail("Този браузър или устройство не поддържа WebGL – 3D моделът не може да се покаже. Етажите и апартаментите вдясно работят.", "box"); return; }
      return A.modelUrl(b).then(function (url) {
        if (!document.contains(el)) return;
        var note = ""; if (url && typeof url === "object") { note = url.note || ""; url = url.url; }   /* TASK-009: {url, note} – напр. „версия 2, чака преглед (само екипът)“ */
        if (!url) { fail("Моделът не е достъпен в момента."); return; }
        var bu = M.units.filter(function (u) { return u.building_id === b.id; }), bf = floorsOf(b.id);
        destroy3();
        V3 = L.building(el, { url: url, units: bu, floors: bf, sel: S.u, floor: S.f, label: "3D модел на " + bName(b),
          onPick: function (id) { pick3(id); },
          onReady: function (v) { if (!document.contains(el)) return; stEl.hidden = true; v.onlyFloor(!!S.only3); var inf = $("#nc-3d-info", root), i = v.info;
            if (inf) inf.textContent = (note ? note + " · " : "") + (i.units ? "Свързани с апартаменти от проекта: " + i.units + " от " + bu.length + " апартамента на сградата" + (i.units < bu.length ? " – останалите нямат смислово съответствие в модела и не се осветяват." : ".") : "Моделът няма смислово съответствие с апартаментите (unit_id / unit_code / „unit:<код>“) – изборът на апартамент от модела е изключен, за да не се „познава“ по картинка."); },
          onError: function (m) { fail("3D моделът не се зареди: " + (m || "грешка"), "triangle-alert"); } });
      });
    }).catch(function (e) { fail("3D модулът не се зареди: " + ((e && e.message) || "грешка")); });
    el.addEventListener("click", function (e) { var x = e.target.closest("[data-v3]"); if (!x || !V3) return; var v = x.getAttribute("data-v3");
      if (v === "rl") V3.rotate(-20); else if (v === "rr") V3.rotate(20); else if (v === "zi") V3.zoom(0.8); else if (v === "zo") V3.zoom(1.25); else if (v === "home") V3.reset(); else if (v === "fs") { V3.fullscreen(); setTimeout(fsUpd, 80); } });
    el.addEventListener("keydown", function (e) { if (!V3 || e.target !== el) return; var k = e.key;
      if (k === "ArrowLeft") V3.rotate(-15); else if (k === "ArrowRight") V3.rotate(15); else if (k === "+" || k === "=") V3.zoom(0.8); else if (k === "-" || k === "_") V3.zoom(1.25); else if (k === "0") V3.reset(); else return; e.preventDefault(); });
    var vw = el.parentNode.querySelector(".views3"); if (vw) vw.addEventListener("click", function (e) { var x = e.target.closest("[data-v3]"); if (x && V3) V3.view(x.getAttribute("data-v3").slice(2)); });
    var only = $("#nc-only3", root); if (only) only.addEventListener("change", function () { S.only3 = only.checked; if (V3) V3.onlyFloor(S.only3); });
  }
  /* избор от модела или отвън – без да се презарежда моделът */
  function pick3(id) { var u = unit(id); if (!u) return; S.u = id; implicitU = false; S.f = u.floor_id; S.b = u.building_id; light3(); sync(true); }
  function light3() {
    updateCards();
    var side = $(".nc-fsel .ndg-f", root); if (side) side.innerHTML = bldgSel() + floorList() + unitChips("pick3");
    if (V3) { V3.setFloor(S.f); V3.select(S.u); }
  }

  /* ---------------- 5. 360° Разходка (панорами по договора на TASK-010) ---------------- */
  function tTour() {
    var u = unit(S.u), n = u ? (M.tours || {})[u.id] || 0 : 0;
    var pick = M.units.length ? '<label class="nc-sel">' + ic("house") + '<span class="val">' + esc(u ? "Апартамент " + u.code : "Изберете апартамент") + '</span><svg class="i" aria-hidden="true"><use href="#chev-d"/></svg><select data-act="usel" aria-label="Апартамент">' +
      orderUnits(M.units).map(function (x) { return '<option value="' + esc(x.id) + '"' + (u && x.id === u.id ? " selected" : "") + ">" + esc(x.code + " – " + (ST[x.status] || "")) + "</option>"; }).join("") + "</select></label>" : "";
    var det = u ? card("Апартамент " + u.code, "house", PH.rooms, '<div class="nc-rows">' + row("ruler", "Обща площ", esc(m2(u.area_total) || "—")) + row("layout-grid", "Чиста площ", esc(m2(u.area_net) || "—")) + row("umbrella", "Тераса", esc(m2(u.terrace_area) || "—")) + row("sun", "Изложение", esc(u.exposure || "—")) + "</div>" + '<div id="nc-rooms"></div>', "nc-rinfo") : "";
    var main, locked = u && u.status !== "free";
    /* компонентът на TASK-010: капариран/продаден първо показва печата на страницата; екипът го отваря изрично (както вградения преглед) */
    var use10 = !!(u && window.NC_TOUR_LIB && !S.t10off && A.tour10Source && (!locked || (A.mode === "staff" && S.showPano === u.id)));
    if (use10) return '<div class="nc-two"><div><div class="nc-t10" id="nc-t10" data-engine="TASK-010"><div class="nc-load" role="status"><span class="nc-spin" aria-hidden="true"></span>Зареждане на разходката…</div></div>' +
      (A.tour10Panel ? '<div class="nc-t10s" id="nc-t10-staff" aria-label="Разходка – подготовка (екип)"></div>' : "") + '</div><div class="side">' + pick + '<div id="nc-t10-side"></div>' + ucSlot("tour") + "</div></div>";
    if (!u) main = empty("house", "Изберете апартамент", "360° панорамите са по апартаменти.");
    else if (locked && !(A.mode === "staff" && S.showPano === u.id)) main = '<div class="nc-pano lockedp">' + lockedHtml(u).replace("Разпределението на апартамент", "Панорамите и разпределението на апартамент").replace('data-act="orig"', 'data-act="origpano"').replace("Покажи оригинала (само за екипа)", "Покажи панорамите (само за екипа)") + "</div>";
    else if (!n) main = naHtml("r360", "360° панорама", "360° панорамите за " + u.code + " още не са подготвени",
      "Тук се разглеждат 360° панорамите на апартамента: поглед във всички посоки с плъзгане или пръст, мащаб, избор на помещение и миниатюри, цял екран. За този апартамент панорами още няма – не показваме плоска снимка вместо панорама. Свободна 3D разходка (движение из апартамента) е отделен режим и се показва само ако за апартамента има реална 3D сцена.",
      ["Поглед 360°", "Мащаб", "Избор на помещение", "Миниатюри", "Цял екран", "Клавиатура"], "Панорамите (медия вид „tour“, private/tours) се подготвят по TASK-010; визуализаторът е готов и ги зарежда през /pano/<обект>/<n>.", PH.empty360);
    else main = '<div class="nc-pano" id="nc-pano" tabindex="0" role="application" aria-roledescription="360° панорама" aria-label="360° панорама. Стрелки – поглед, плюс и минус – мащаб, 0 – начален поглед.">' +
      '<span class="tag3">' + ic("r360") + '360° панорама</span><span class="plab" id="nc-plab">' + esc("Апартамент " + u.code) + "</span>" +
      '<div class="ctl3 h" role="group" aria-label="Управление на панорамата">' + [["l", "chevron-left", "Погледни наляво"], ["r", "chev-r", "Погледни надясно"], ["zi", "zoom-in", "Приближи"], ["zo", "zoom-out", "Отдалечи"], ["home", "rotate-ccw", "Начален поглед"], ["fs", "maximize-2", "На цял екран"]].map(function (x) { return '<button type="button" data-vp="' + x[0] + '" aria-label="' + x[2] + '" title="' + x[2] + '">' + ic(x[1]) + "</button>"; }).join("") + "</div>" +
      '<div class="st3" id="nc-pano-st" role="status"><span class="nc-spin" aria-hidden="true"></span><span>Зареждане на панорамата…</span></div></div>' +
      '<div class="nc-thumbs pth" id="nc-pth" role="group" aria-label="Помещения"></div><p class="nc-note n3" id="nc-pano-info" aria-live="polite"></p>';
    /* миниатюрна карта (одобрена референция 04): само разрешеният план на апартамента; точка за текущото помещение – само ако панорамата носи plan_xy (TASK-010) */
    var mini = u && n && (!locked || (A.mode === "staff" && S.showPano === u.id)) && u.has_plan ? '<div id="nc-mini-w" hidden>' + card("План и текущо помещение", "map", null, '<div class="nc-mini" id="nc-mini"></div>', "nc-minic") + "</div>" : "";
    return '<div class="nc-two"><div>' + main + '</div><div class="side">' + pick + mini + det + ucSlot("tour") + "</div></div>";
  }
  function miniInit(u, items) {
    var w = $("#nc-mini-w", root), box = $("#nc-mini", root); if (!w || !box) return;
    A.unitPlan(u).then(function (r) {
      if (!r || !r.url || !document.contains(box)) return;
      box.innerHTML = '<div class="pic"><img src="' + esc(r.url) + '" alt="' + esc("План на апартамент " + u.code) + '" decoding="async"><i class="pos" hidden aria-hidden="true"></i></div><p class="cur" aria-live="polite"></p>';
      var im = box.querySelector("img"); im.onerror = function () { w.hidden = true; };
      w.hidden = false; miniShow(items, VP && VP.index ? VP.index() : 0);
    }, function () {});
  }
  function miniShow(items, i) {
    var box = $("#nc-mini", root); if (!box) return; var c = box.querySelector(".cur"), p = box.querySelector(".pos"), it = items[i] || {}, xy = it.plan_xy;
    if (c) c.textContent = "Сега: " + (it.title || "Помещение " + (i + 1)) + " (" + (i + 1) + " от " + items.length + ")";
    if (p) { if (xy && isFinite(xy[0]) && isFinite(xy[1]) && xy[0] >= 0 && xy[0] <= 1 && xy[1] >= 0 && xy[1] <= 1) { p.hidden = false; p.style.left = xy[0] * 100 + "%"; p.style.top = xy[1] * 100 + "%"; } else p.hidden = true; }
  }
  /* източникът на TASK-010 се обвива: ако сървърът още няма функцията за разходката (404 – nc_006 не е пусната), честно се минава на вградения преглед
     на същите панорами (/pano/<обект>/<n>); при друга грешка компонентът сам показва „Опитай отново“. */
  function t10fallback(el) { return function (e) { if (e && (e.status === 404 || e.fallback) && !S.t10off) { S.t10off = true; setTimeout(function () { if (document.contains(el)) refreshPanelFull(); }, 0); } throw e; }; }
  function mountTour10(opt) {
    var el = $("#nc-t10", root), u = unit(S.u); if (!el || !u) return;
    var p = tour10(); if (!p) return; opt = opt || {};
    var info = { id: u.id, code: u.code, status: u.status, area_total: u.area_total, area_net: u.area_net, terrace_area: u.terrace_area, exposure: u.exposure, rooms: u.rooms };
    p.then(function (L) { return Promise.resolve(A.tour10Source(L, u, { setId: opt.setId })).then(function (src) {
      if (!document.contains(el)) return;
      if (!src) throw new Error("Компонентът няма източник за този режим.");
      if (T10) { try { T10.destroy(); } catch (e) {} T10 = null; }
      var load = src.load, wrapped = { load: function () { return Promise.resolve().then(function () { return load.call(src); }).catch(t10fallback(el)); }, panoUrl: function (r) { return src.panoUrl(r); } };
      el.innerHTML = "";
      T10 = L.mount(el, { source: wrapped, unit: info, staff: A.mode === "staff", mode: opt.mode || "auto", side: $("#nc-t10-side", root), onRoom: function () {} });
      var sp = $("#nc-t10-staff", root);
      if (sp && A.tour10Panel && !T10P) Promise.resolve(A.tour10Panel(sp, u, { onPreview: function (o) { mountTour10(o || {}); } })).then(function (h) { if (document.contains(sp)) T10P = h || null; else if (h && h.destroy) h.destroy(); }, function (e) { if (window.console) console.warn("TASK-010 панел:", e && e.message); });
    }); }).catch(function (e) { if (window.console) console.warn("TASK-010 разходка:", e && e.message); S.t10off = true; if (document.contains(el)) refreshPanelFull(); });
  }
  function mountPano() {
    if ($("#nc-t10", root)) { mountTour10(); return; }
    var el = $("#nc-pano", root); if (!el) return;
    var u = unit(S.u), stEl = $("#nc-pano-st", root);
    function fail(msg) { if (document.contains(el)) { stEl.hidden = false; stEl.classList.add("err"); stEl.innerHTML = '<span class="none3">' + ic("triangle-alert") + "<b>" + esc(msg) + "</b></span>"; } }
    var fsUpd = fsSync(el, "data-vp");
    Promise.all([engine("tour"), A.tourItems(u)]).then(function (r) {
      var L = r[0], items = (r[1] || []).filter(function (x) { return x && x.url; });
      if (!document.contains(el)) return;
      el.setAttribute("data-engine", L.name);
      if (!items.length) { fail("Панорамите не са достъпни в момента."); return; }
      if (!L.webglOk()) { fail("Този браузър или устройство не поддържа WebGL – 360° панорамата не може да се покаже."); return; }
      var th = $("#nc-pth", root), lab = $("#nc-plab", root), info = $("#nc-pano-info", root), rooms = $("#nc-rooms", root);
      th.innerHTML = items.map(function (x, i) { return '<button type="button" data-pi="' + i + '" aria-label="' + esc(x.title) + '" aria-current="' + (i === 0) + '"><img src="' + esc(x.url) + '" alt="" loading="lazy" decoding="async"><span>' + esc(x.title) + "</span></button>"; }).join("");
      if (rooms) rooms.innerHTML = '<label class="nc-fl" style="margin-top:14px">Избери помещение<select id="nc-room">' + items.map(function (x, i) { return '<option value="' + i + '">' + esc(x.title) + "</option>"; }).join("") + "</select></label>" + (items.length > 1 ? '<button type="button" class="nc-btn hot" id="nc-auto" aria-pressed="false" style="margin-top:14px;width:100%">' + ic("play") + "<span>Автоматична разходка</span></button>" : "");
      destroy3();
      VP = L.panorama(el, { items: items, index: 0,
        onLoading: function () { stEl.hidden = false; stEl.classList.remove("err"); stEl.innerHTML = '<span class="nc-spin" aria-hidden="true"></span><span>Зареждане на панорамата…</span>'; },
        onShow: function (i) { stEl.hidden = true; lab.textContent = "Апартамент " + u.code + " · " + items[i].title + (u.area_total ? " · " + m2(u.area_total) : ""); $$("button", th).forEach(function (b, k) { b.setAttribute("aria-current", k === i); }); var rs = $("#nc-room", root); if (rs) rs.value = String(i); if (info) info.textContent = "Помещение " + (i + 1) + " от " + items.length + ": " + items[i].title; miniShow(items, i); },
        onError: function () { fail("Панорамата не се зареди (може статусът на апартамента току-що да се е сменил)."); },
        onAuto: function (on) { var b = $("#nc-auto", root); if (b) { b.setAttribute("aria-pressed", on); b.querySelector("span").textContent = on ? "Спри автоматичната разходка" : "Автоматична разходка"; } } });
      miniInit(u, items);
      th.addEventListener("click", function (e) { var b = e.target.closest("[data-pi]"); if (b && VP) VP.show(+b.getAttribute("data-pi")); });
      var rs = $("#nc-room", root); if (rs) rs.addEventListener("change", function () { if (VP) VP.show(+rs.value); });
      var ab = $("#nc-auto", root); if (ab) ab.addEventListener("click", function () { if (VP) VP.auto(ab.getAttribute("aria-pressed") !== "true"); });
    }).catch(function (e) { fail("360° модулът не се зареди: " + ((e && e.message) || "грешка")); });
    el.addEventListener("click", function (e) { var x = e.target.closest("[data-vp]"); if (!x || !VP) return; var v = x.getAttribute("data-vp");
      if (v === "l") VP.look(-20); else if (v === "r") VP.look(20); else if (v === "zi") VP.zoom(-8); else if (v === "zo") VP.zoom(8); else if (v === "home") VP.reset(); else if (v === "fs") { VP.fullscreen(); setTimeout(fsUpd, 80); } });
    el.addEventListener("keydown", function (e) { if (!VP || e.target !== el) return; var k = e.key, m = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[k];
      if (m) VP.look(m[0], m[1]); else if (k === "+" || k === "=") VP.zoom(-8); else if (k === "-" || k === "_") VP.zoom(8); else if (k === "0") VP.reset(); else return; e.preventDefault(); });
  }

  /* ---------------- 6. Строителство ---------------- */
  function tBuild() {
    var p = M.project;
    var cur = card("Текущ етап", "hard-hat", PH.stage, stepsHtml(p) + '<div class="nc-stage-ft">' + (p.stage && STAGE_BG[p.stage] ? "<span>Етап (въведен от екипа): <b>" + esc(STAGE_BG[p.stage]) + "</b></span>" : "") +
      (p.expected_completion ? "<span>" + ic("calendar") + "Очаквано завършване: <b>" + esc(p.expected_completion) + "</b></span>" : "<span>Очакваното завършване не е въведено.</span>") + "</div>" +
      (A.mode === "staff" && p.stage_percent != null ? '<p class="nc-note" style="margin-top:14px">Процент, въведен от екипа: <b>' + esc(p.stage_percent) + " %</b>. Не се показва публично, докато няма одобрена методика за измерване на напредъка.</p>" : ""), "");
    var acts = card("Актове 14 / 15 / 16", "file-text", PH.build, '<p class="nc-note">Актовете се показват само при документално потвърждение. В системата още няма прикачени документи към етапите' + (p.stage && /^act/.test(p.stage) ? " – етапът по-горе е въведен от екипа, без прикачен акт." : ".") + "</p>", "");
    var photos = card("Снимки от строежа", "camera", null, '<p class="nc-note">Няма отбелязани снимки от строежа. Снимките в „Галерия“ не са разделени на визуализации и реални снимки от обекта, затова не се показват тук като снимки от строежа.</p>', "");
    var hist = card("История на обновяванията", "history", null, '<div class="nc-rows">' + (p.updated_at ? row("clock", "Последна промяна на данните:", esc(fdate(p.updated_at))) : "") + (p.status_changed_at ? row("megaphone", "Последна смяна на статуса на проекта:", esc(fdate(p.status_changed_at))) : "") + (p.reviewed_at && A.mode === "staff" ? row("badge-check", "Проверен от администратор:", esc(fdate(p.reviewed_at))) : "") + "</div>" + '<p class="nc-note" style="margin-top:10px">Подробна история на етапите на строежа още не се пази в системата.</p>', "");
    return '<div class="nc-two"><div style="display:flex;flex-direction:column;gap:20px">' + cur + photos + '</div><div class="side">' + acts + hist + "</div></div>";
  }

  /* ---------------- 7. Галерия ---------------- */
  function tGallery() {
    var items = []; if (M.cover) items.push({ url: M.cover.url, title: M.cover.title || "Корица на проекта", type: "image", cover: true });
    (M.gallery || []).forEach(function (g) { if (g.url) items.push(g); });
    var nv = items.filter(function (i) { return i.type === "video"; }).length;
    var seg = '<div class="nc-seg" role="group" aria-label="Вид медия" style="margin-bottom:16px">' + [["all", "Всички (" + items.length + ")"], ["image", "Изображения (" + (items.length - nv) + ")"], ["video", "Видео (" + nv + ")"]].map(function (x) { return '<button type="button" data-act="gk" data-v="' + x[0] + '" aria-pressed="' + (S.gk === x[0]) + '">' + esc(x[1]) + "</button>"; }).join("") + "</div>";
    var shown = items.filter(function (i) { return S.gk === "all" || i.type === S.gk; });
    var grid = !items.length ? card("Галерия на проекта", "image", PH.galleryEmpty, '<div class="nc-gempty" role="status"><h3>Няма качени снимки или видео</h3><p class="nc-note">' + esc(A.mode === "staff" ? "Публичната медия (реални визуализации, снимки и видео на проекта) се добавя от администратор." : "За този проект още няма публикувана медия.") + "</p>" + (A.galleryActs ? '<div class="nc-btns">' + A.galleryActs() + "</div>" : "") + "</div>", "nc-illu")
      : !shown.length ? empty("image", "Няма медия от този вид", "") :
      '<div class="nc-gal">' + shown.map(function (g) { var i = items.indexOf(g); return '<button type="button" class="nc-gi" data-act="lb" data-i="' + i + '" aria-label="' + esc("Отвори: " + (g.title || "медия")) + '">' + (g.type === "video" ? '<span style="display:grid;place-items:center;width:100%;height:100%;color:#f6d48e;font-size:80px">' + ic("play") + "</span>" : '<img src="' + esc(g.url) + '" alt="" loading="lazy" decoding="async">') + '<span class="k">' + ic(g.type === "video" ? "video" : "image") + (g.cover ? "Корица" : g.type === "video" ? "Видео" : "Изображение") + '</span><span class="t">' + esc(g.title || "") + "</span></button>"; }).join("") + "</div>";
    var note = '<div style="margin-top:18px">' + card("За медията", "info", PH.gallery, '<p class="nc-note" style="max-width:60%">Видът на всяко изображение (визуализация или реална снимка от строежа) още не се отбелязва в системата – затова не ги разделяме и не ги показваме като снимки от строежа.</p>', "nc-illu") + "</div>";
    NC._gal = items;
    return seg + grid + (items.length ? note : "") + (A.galleryActs && items.length ? '<div style="margin-top:16px">' + A.galleryActs() + "</div>" : "");
  }
  function lightbox(i) {
    var items = NC._gal || []; if (!items.length) return;
    var lb = document.getElementById("nc-lb"), last = document.activeElement;
    if (!lb) { lb = document.createElement("div"); lb.id = "nc-lb"; lb.className = "nc-lb"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Преглед на медия"); document.body.appendChild(lb); }
    function show(k) {
      i = (k + items.length) % items.length; var g = items[i];
      lb.innerHTML = '<div class="bar"><span class="t">' + esc((i + 1) + " / " + items.length + " · " + (g.title || "")) + '</span><button type="button" data-x="close" aria-label="Затвори">' + ic("x") + "</button></div>" +
        '<div class="media">' + (g.type === "video" ? '<video src="' + esc(g.url) + '" controls playsinline preload="metadata"></video>' : '<img src="' + esc(g.url) + '" alt="' + esc(g.title || "") + '">') + "</div>" +
        (items.length > 1 ? '<div class="nav"><button type="button" class="p" data-x="prev" aria-label="Предишна">' + ic("chevron-left") + '</button><button type="button" class="n" data-x="next" aria-label="Следваща">' + ic("chev-r") + "</button></div>" : "");
      var c = lb.querySelector('[data-x="close"]'); if (c) c.focus();
    }
    function close() { lb.hidden = true; document.removeEventListener("keydown", key, true); if (last && last.focus) last.focus(); }
    function key(e) { if (lb.hidden) return; if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } else if (e.key === "ArrowRight") show(i + 1); else if (e.key === "ArrowLeft") show(i - 1); else if (e.key === "Tab") { var f = $$("button,video", lb); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } }
    lb.onclick = function (e) { var b = e.target.closest("[data-x]"); if (!b) { if (e.target === lb) close(); return; } var x = b.getAttribute("data-x"); if (x === "close") close(); else show(i + (x === "next" ? 1 : -1)); };
    lb.hidden = false; document.addEventListener("keydown", key, true); show(i);
  }
  NC.lightbox = lightbox;

  /* ---------------- 8. Документи ---------------- */
  function ftype(p) { var m = /\.([a-z0-9]{2,5})$/i.exec(String(p || "")); return m ? m[1].toUpperCase() : "Файл"; }
  function tDocs() {
    var files = M.files || [];
    var info = card("Документи на проекта", "file-text", PH.docs, '<p class="nc-note" style="max-width:62%">Публичните документи се виждат от всеки посетител. ' + (A.mode === "staff" ? "Документите „Само за екипа“ (оригинални планове) никога не стават публични и се отварят с кратък подписан линк." : "") + " Версия на документите още не се води в системата.</p>", "");
    var rows = files.length ? '<div class="nc-docs" role="list">' + files.map(function (f, i) {
      return '<div class="nc-doc" role="listitem">' + ic(f.access === "public" ? "file-text" : "lock") + '<div class="tx"><b>' + esc(f.title || "Документ") + "</b><span><span>Вид: " + esc(f.kindLabel || ftype(f.path || f.name)) + "</span><span>Версия: —</span><span>Дата: " + esc(f.date ? fdate(f.date) : "—") + '</span><span class="nc-acc ' + (f.access === "public" ? "pub" : "priv") + '">' + (f.access === "public" ? "Публичен" : "Само за екипа") + "</span></span></div>" +
        '<div class="bt">' + btn("docview", "eye", "Преглед", { cls: "sm", data: 'data-i="' + i + '"' }) + btn("docdl", "download", "Изтегли", { cls: "sm", data: 'data-i="' + i + '"' }) + "</div></div>";
    }).join("") + "</div>" : empty("file-text", "Няма документи", A.mode === "staff" ? "Публичните документи се добавят от администратор." : "За този проект още няма публикувани документи.", A.docsActs ? A.docsActs() : "");
    return '<div style="display:flex;flex-direction:column;gap:18px">' + info + rows + (files.length && A.docsActs ? A.docsActs() : "") + "</div>";
  }

  /* ---------------- 9. Контакти ---------------- */
  function tContacts() {
    var u = unit(S.u);
    var ag = card("Отговорна агенция", "building-2", PH.agency, '<div class="nc-agency nc-rows">' + row("building-2", "Агенция:", "Недвижими имоти Надежда") +
      row("phone", "Телефон:", '<a href="tel:+359898977370">+359 898 977 370</a>') + row("mail", "Имейл:", '<a href="mailto:office@imotinadezhda.bg">office@imotinadezhda.bg</a>') +
      row("user", "Отговорен брокер:", "не е зададен за проекта", true) + "</div>", "");
    var forms = A.contactForms ? A.contactForms(M, u) : "";
    return '<div class="nc-two"><div style="display:flex;flex-direction:column;gap:20px">' + forms + locCard(M.project) + '</div><div class="side">' + ag + ucSlot("contacts") + "</div></div>";
  }
  /* „Местоположение“: само въведените град / квартал / адрес / координати; снимката е обща илюстрация (морска – само за проекти на морето), никога реалният адрес */
  function locCard(p) {
    var l = p.location, has = hasLoc(p), sea = seaside(p);
    var inner = has ? '<div class="nc-rows">' + (p.city ? row("pin", "Град:", esc(p.city)) : "") + (p.hood ? row("map", "Квартал:", esc(p.hood)) : "") + (p.address ? row("map-pin-house", "Адрес:", esc(p.address)) : "") +
      (l && l.lat != null ? row("globe", "Координати:", esc(Number(l.lat).toFixed(5) + ", " + Number(l.lng).toFixed(5))) : "") + "</div>" +
      '<div class="nc-btns">' + btn("map", "map", l && l.lat != null ? "Отвори картата" : "Търси адреса в картата", { cls: "hot", title: "OpenStreetMap – нов прозорец" }) + "</div>" +
      (l && l.lat != null ? "" : '<p class="nc-note" style="margin-top:12px">Точните координати още не са въведени – картата търси по адреса.</p>')
      : '<p class="nc-note">Местоположението на проекта още не е въведено.</p>';
    return '<div id="nc-loc" tabindex="-1">' + card("Местоположение", "map-pin-house", sea ? PH.locSea : PH.loc, inner, "nc-locc nc-illu") + "</div>";
  }

  /* ---------------- публичните форми (запитване / оглед) – общи за двата режима ---------------- */
  NC.formHtml = function (id, title, icon, fields, submit, note, photo) {
    return card(title, icon, photo || null, '<form class="nc-form" id="' + esc(id) + '" novalidate>' + fields + '<p class="nc-ferr wide" role="alert" aria-live="assertive"></p><div class="wide">' + '<button type="submit" class="nc-btn hot">' + ic(icon) + "<span>" + esc(submit) + "</span></button>" + "</div>" + (note ? '<p class="nc-note wide">' + note + "</p>" : "") + "</form>", "");
  };
  NC.input = function (id, label, type, o) {
    o = o || {}; var a = ' id="' + esc(id) + '" name="' + esc(id) + '"' + (o.req ? ' required aria-required="true"' : "") + (o.ac ? ' autocomplete="' + o.ac + '"' : "") + (o.min ? ' min="' + esc(o.min) + '"' : "") + (o.max ? ' maxlength="' + o.max + '"' : "") + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : "");
    var f = type === "ta" ? "<textarea" + a + ">" + esc(o.value || "") + "</textarea>" : type === "select" ? "<select" + a + ">" + (o.options || []).map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === o.value ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</select>" : '<input type="' + type + '"' + a + ' value="' + esc(o.value || "") + '">';
    return '<label class="nc-fl' + (o.wide ? " wide" : "") + '" for="' + esc(id) + '">' + esc(label) + (o.req ? " *" : "") + f + "</label>";
  };
  /* валидиране + защита от двойно изпращане; fn връща Promise */
  NC.bindForm = function (form, validate, fn) {
    if (!form || form._b) return; form._b = 1; var busy = false;
    form.addEventListener("submit", function (e) {
      e.preventDefault(); if (busy) return;
      var err = form.querySelector(".nc-ferr"); err.textContent = ""; $$("[aria-invalid]", form).forEach(function (x) { x.removeAttribute("aria-invalid"); });
      var v = validate(form); if (v) { err.textContent = v.msg; if (v.el) { v.el.setAttribute("aria-invalid", "true"); v.el.focus(); } return; }
      busy = true; var b = form.querySelector('[type="submit"]'), bt = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="nc-spin" aria-hidden="true" style="width:30px;height:30px;border-width:4px"></span><span>Изпращане…</span>'; form.setAttribute("aria-busy", "true");
      Promise.resolve().then(function () { return fn(form); }).then(function (okMsg) {
        form.innerHTML = '<div class="nc-ok wide" role="status" tabindex="-1">' + ic("circle-check") + "<span>" + esc(okMsg || "Изпратено.") + "</span></div>";
        var ok = form.querySelector(".nc-ok"); if (ok) ok.focus();
      }, function (x) { busy = false; b.disabled = false; b.innerHTML = bt; form.removeAttribute("aria-busy"); err.textContent = (x && x.message) || "Неуспешно изпращане – опитайте отново."; });
    });
  };
  NC.validPhoneOrMail = function (ph, em) { return String(ph || "").replace(/\D/g, "").length >= 6 || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(em || "").trim()); };

  /* ---------------- сравнение ---------------- */
  function compare() {
    var us = S.cmp.map(unit).filter(Boolean);
    if (us.length < 2) { say("Изберете поне 2 апартамента за сравнение."); return; }
    var R = [["Сграда", function (u) { return bName(bldg(u.building_id)); }], ["Етаж", function (u) { return floorName(floor(u.floor_id)); }], ["Статус", function (u) { return ST[u.status]; }],
      ["Стаи", function (u) { return u.rooms == null ? "—" : u.rooms; }], ["Спални", function (u) { return u.beds == null ? "—" : u.beds; }], ["Бани", function (u) { return u.baths == null ? "—" : u.baths; }],
      ["Обща площ", function (u) { return m2(u.area_total) || "—"; }], ["Чиста площ", function (u) { return m2(u.area_net) || "—"; }], ["Тераса", function (u) { return m2(u.terrace_area) || "—"; }],
      ["Изложение", function (u) { return u.exposure || "—"; }], ["Цена на м²", function (u) { return eur2(u.price_per_m2) || (u.status === "sold" && A.mode === "public" ? "не се показва" : "—"); }],
      ["Обща цена", function (u) { return eur(u.price_total) || (u.status === "sold" && A.mode === "public" ? "не се показва" : "—"); }]];
    var html = '<div class="nc-cmp"><table><thead><tr><th scope="col">Показател</th>' + us.map(function (u) { return '<th scope="col">' + esc(u.code) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      R.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + "</th>" + us.map(function (u) { return "<td>" + esc(r[1](u)) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
    NC.dialog({ title: "Сравнение на апартаменти", icon: "columns-2", photo: PH.compare, html: html, noSave: true });
  }
  /* прозорец: същият като в останалите CRM карти (NDUI.open) */
  NC.dialog = function (o) {
    if (window.NDUI && NDUI.open) return NDUI.open(Object.assign({ inline: false, view: false, focus: false }, o));
    alert(o.title); return null;
  };

  /* ---------------- събития ---------------- */
  function onClick(e) {
    var t = e.target;
    var tb = t.closest("[data-tab]"); if (tb && root.contains(tb)) { e.preventDefault(); switchTab(tb.getAttribute("data-tab"), true); return; }
    var a = t.closest("[data-act]"); if (!a || !root.contains(a)) {
      var ur = t.closest(".nc-u[data-unit]"); if (ur && !t.closest("label,button,input,a")) { selectUnit(ur.getAttribute("data-unit"), true); }
      return;
    }
    if (a.getAttribute("aria-disabled") === "true") { e.preventDefault(); var why = a.getAttribute("title"); if (why) say(why); return; }
    var act = a.getAttribute("data-act"), uid = a.getAttribute("data-unit");
    if (act === "cmpk" || a.tagName === "SELECT") return;
    if (act === "smenu") { e.preventDefault(); toggleMenu(a); return; }
    if (a.closest(".nc-smenu-l")) closeMenu();
    if (A.acts && A.acts[act]) { e.preventDefault(); A.acts[act](a, e); return; }
    switch (act) {
      case "open": e.preventDefault(); openProject(a.getAttribute("data-key"), true); return;
      case "back": e.preventDefault(); S.view = "list"; S.key = null; M = null; destroyViewer(); sync(true); document.title = "Ново строителство · Имоти Надежда"; if (LIST === null) loadList(); else renderList(); focusMain(); return;
      case "reload": e.preventDefault(); if (S.view === "list") loadList(); else openProject(S.key, false); return;
      case "lfilt": S.lf = a.getAttribute("data-v"); renderList(); sync(false); return;
      case "lclear": S.lf = "all"; S.lq = ""; renderList(); sync(false); return;
      case "pick": e.preventDefault(); selectUnit(uid, true); return;
      case "floor": e.preventDefault(); selectFloor(a.getAttribute("data-floor"), true); return;
      case "pmode": S.pmode = a.getAttribute("data-v"); destroyViewer(); var pn = $("#nc-panel", root); pn.innerHTML = panelHtml(); afterPanel(); sync(true); return;
      case "orig": S.showOrig = uid; mountPlan(); return;
      case "origpano": S.showPano = uid; refreshPanelFull(); return;
      case "pick3": e.preventDefault(); if (V3) pick3(uid); else selectUnit(uid, true); return;
      case "floor3": e.preventDefault(); var f3 = floor(a.getAttribute("data-floor")); if (!f3) return; if (V3) { S.f = f3.id; var u3 = unitsOf(f3.id)[0]; S.u = u3 ? u3.id : null; implicitU = !u3; light3(); sync(true); } else selectFloor(f3.id, true); return;
      case "plan": e.preventDefault(); var fu = floor(S.f); S.pmode = fu && fu.has_plan ? "floor" : "unit"; switchTab("plans", true); return;
      case "tab-tour": switchTab("tour", true); return;
      case "fclear": S.flt = {}; refreshUnits(); sync(true); return;
      case "cmp": toggleCmp(uid); return;
      case "compare": compare(); return;
      case "hero": heroShow(+a.getAttribute("data-i")); return;
      case "heroprev": heroShow(S.hi - 1); return;
      case "heronext": heroShow(S.hi + 1); return;
      case "herofull": NC._gal = media(); lightbox(S.hi); return;
      case "lb": lightbox(+a.getAttribute("data-i")); return;
      case "gk": S.gk = a.getAttribute("data-v"); refreshPanelFull(); return;
      case "location": e.preventDefault(); goForm("nc-loc"); return;
      case "map": var mu = mapUrl(M.project); if (mu) window.open(mu, "_blank", "noopener"); return;
      case "brochure": var br = brochure(); if (br) openFile(br, true); return;
      case "docview": openFile((M.files || [])[+a.getAttribute("data-i")], false); return;
      case "docdl": openFile((M.files || [])[+a.getAttribute("data-i")], true); return;
      case "share": share(); return;
      case "viewing": case "inquiry": e.preventDefault(); goForm(act === "viewing" ? "nc-viewing" : "nc-inquiry"); return;
    }
  }
  function toggleMenu(btn, force) {
    var l = btn.parentNode.querySelector(".nc-smenu-l"), open = force != null ? force : l.hidden;
    l.hidden = !open; btn.setAttribute("aria-expanded", open);
    if (open) { var f = l.querySelector("button,a"); if (f) f.focus(); }
  }
  function closeMenu(focusBtn) { $$(".nc-smenu-l", root).forEach(function (l) { if (!l.hidden) { l.hidden = true; var b = l.parentNode.querySelector('[data-act="smenu"]'); b.setAttribute("aria-expanded", "false"); if (focusBtn) b.focus(); } }); }
  document.addEventListener("click", function (e) { if (!e.target.closest || !e.target.closest(".nc-smenu")) closeMenu(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.querySelector(".nc-smenu-l:not([hidden])")) { e.preventDefault(); closeMenu(true); } });
  function refreshPanelFull() { destroyViewer(); var pn = $("#nc-panel", root); if (pn) { pn.innerHTML = panelHtml(); afterPanel(); } }
  NC.refreshPanel = refreshPanelFull;
  function refreshUnits() { var pn = $("#nc-panel", root); if (!pn) return; var a = document.activeElement, id = a && a.getAttribute && a.getAttribute("data-flt"); pn.innerHTML = panelHtml(); afterPanel(); if (id) { var n = pn.querySelector('[data-flt="' + id + '"]'); if (n) { n.focus(); if (n.setSelectionRange && n.value) try { n.setSelectionRange(n.value.length, n.value.length); } catch (x) {} } } }
  function toggleCmp(id) { if (!unit(id)) return; var k = S.cmp.indexOf(id); if (k >= 0) S.cmp.splice(k, 1); else { if (S.cmp.length >= 4) { say("Сравняват се най-много 4 апартамента."); return; } S.cmp.push(id); } updateCmpUi(); }
  function updateCmpUi() {
    $$(".nc-cmpk", root).forEach(function (l) { var i = l.querySelector("input"), on = S.cmp.indexOf(i.getAttribute("data-unit")) >= 0; i.checked = on; l.classList.toggle("on", on); });
    $$('[data-act="compare"]', root).forEach(function (b) { var ok = S.cmp.length >= 2; var sp = b.querySelector("span"); if (sp) sp.textContent = (b.classList.contains("nc-act") ? "Сравни апартаменти" : "Сравни") + (S.cmp.length ? " (" + S.cmp.length + ")" : ""); if (ok) { b.removeAttribute("aria-disabled"); b.removeAttribute("title"); var sm = b.querySelector("small"); if (sm) sm.remove(); } else { b.setAttribute("aria-disabled", "true"); b.setAttribute("title", "Изберете поне 2 апартамента"); } b.classList.toggle("hot", ok && b.classList.contains("nc-btn")); });
    updateCards();
  }
  function onChange(e) {
    var t = e.target;
    if (t.matches("[data-flt]") && t.tagName === "SELECT") { var k = t.getAttribute("data-flt"); if (t.value) S.flt[k] = t.value; else delete S.flt[k]; if (k === "b") delete S.flt.f; refreshUnits(); sync(true); return; }
    if (t.matches('[data-act="cmpk"]')) { toggleCmp(t.getAttribute("data-unit")); return; }
    if (t.matches('[data-act="bsel"]')) { var fl = floorsOf(t.value).slice().reverse(); var g = fl.filter(function (f) { return f.level >= 0; })[0] || fl[0]; if (g) selectFloor(g.id, true); else { S.b = t.value; S.f = null; S.u = null; refreshPanelFull(); sync(true); } return; }
    if (t.matches('[data-act="usel"]')) { selectUnit(t.value, true); return; }
  }
  function onInput(e) { var t = e.target; if (t.id === "nc-uq") { clearTimeout(onInput._t); onInput._t = setTimeout(function () { var v = t.value.trim().slice(0, 40); if (v) S.flt.q = v; else delete S.flt.q; refreshUnits(); sync(false); }, 300); } }
  function onKey(e) {
    var tb = e.target.closest && e.target.closest(".nc-tab"); if (!tb) return;
    var k = TABIDS.indexOf(tb.getAttribute("data-tab")), n = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: TABIDS.length - 1 }[e.key];
    if (n == null) return; e.preventDefault(); n = (n + TABIDS.length) % TABIDS.length; switchTab(TABIDS[n], true, true);
  }
  function focusMain() { try { root.focus({ preventScroll: true }); } catch (e) {} if (document.documentElement.classList.contains("desk")) root.scrollTop = 0; }

  function openFile(f, download) {
    if (!f) return;
    var w = download ? null : window.open("", "_blank");
    A.fileUrl(f).then(function (url) {
      if (!url) throw new Error("Файлът не е достъпен.");
      if (download) { var a = document.createElement("a"); a.href = url; a.download = f.title || "dokument"; a.rel = "noopener"; a.target = "_blank"; document.body.appendChild(a); a.click(); a.remove(); }
      else if (w) { w.opener = null; w.location = url; } else window.open(url, "_blank", "noopener");
    }).catch(function (x) { if (w) w.close(); say((x && x.message) || "Файлът не се отвори."); });
  }
  function share() {
    var url = A.shareUrl && A.shareUrl(M, unit(S.u)); if (!url) { say("Проектът не е публикуван – няма публичен адрес за споделяне."); return; }
    var title = M.project.title || "Ново строителство";
    if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { say("Публичният адрес е копиран."); }, function () { prompt("Публичен адрес:", url); });
    else prompt("Публичен адрес:", url);
  }

  /* ---------------- зареждане ---------------- */
  function loadList() {
    LIST = null; renderList();
    return A.list().then(function (l) { LIST = l || []; if (S.view === "list") renderList(); }, function (e) { LIST = { error: (e && e.message) || "Неизвестна грешка" }; if (S.view === "list") renderList(); });
  }
  function openProject(key, push, keepSel) {
    if (!key) return;
    var same = S.key === key && M;
    S.view = "project"; S.key = key;
    if (!keepSel && !same && push) { S.tab = "overview"; S.b = S.f = S.u = null; S.flt = {}; S.cmp = []; S.hi = 0; S.pmode = "floor"; implicitU = false; }
    destroyViewer();
    if (!same) { M = null; root.setAttribute("aria-busy", "true"); root.innerHTML = '<div class="nc-load" role="status"><span class="nc-spin" aria-hidden="true"></span>Зареждане на проекта…</div>'; }
    sync(push);
    return A.project(key).then(function (m) {
      root.removeAttribute("aria-busy");
      if (S.key !== key) return;
      if (!m) { M = null; setSub("Проектът не е намерен"); root.innerHTML = empty("search", "Проектът не е намерен", A.mode === "public" ? "Проектът не е публикуван или адресът е грешен." : "Може да е изтрит или адресът да е грешен.", btn("back", "arrow-left", "Към всички проекти")); return; }
      M = m; loadedAt = Date.now(); validate(true); renderProject(); sync(false);
      if (push) focusMain();
    }, function (e) {
      root.removeAttribute("aria-busy");
      root.innerHTML = empty("triangle-alert", "Проектът не се зареди", (e && e.message) || "Неизвестна грешка", btn("reload", "refresh-cw", "Опитай отново") + btn("back", "arrow-left", "Към всички проекти"), "err");
    });
  }
  /* презареждане на същия проект (след запис, при 409 или при връщане към страницата) – изборът се пази */
  NC.reload = function () { if (S.view !== "project" || !S.key) return loadList(); var key = S.key; return A.project(key).then(function (m) { if (S.key !== key) return; if (!m) { openProject(key, false); return; } M = m; loadedAt = Date.now(); validate(true); var sc = scroller().scrollTop; renderProject(); scroller().scrollTop = sc; }); };
  NC.reloadList = function () { return loadList(); };
  NC.open = function (key) { return openProject(key, true); };
  function applyUrl() {
    var o = fromUrl();
    S.tab = o.tab; S.b = o.b; S.f = o.f; S.u = o.u; S.pmode = o.pmode; S.flt = o.flt; S.lf = o.lf; S.lq = o.lq; implicitU = !o.u;
    if (o.view === "project") {
      if (S.key === o.key && M) { S.view = "project"; validate(true); var sc = scroller().scrollTop; destroyViewer(); renderProject(); scroller().scrollTop = sc; return; }
      openProject(o.key, false, true);
    } else { S.view = "list"; S.key = null; M = null; destroyViewer(); if (LIST === null) loadList(); else renderList(); }
  }


  /* ---------------- мащабиране: същите правила като страница „Имоти“ (платно 1024 на телефон; ≥ 2072 на компютър) ---------------- */
  function fitSetup() {
    var W = 1024, DOCK = 160, rt = document.documentElement, stage = document.getElementById("stage"), canvas = document.getElementById("canvas"),
      dock = document.getElementById("dock"), dockC = document.getElementById("dockCanvas"), top = document.querySelector(".nctop");
    if (!canvas || !top) return;
    var photo = top.querySelector(".photo"), ctrls = [].slice.call(top.querySelectorAll(".ctrl,.avatar,.nc-home")),
      texts = [].slice.call(top.querySelectorAll(".hero-title,.hero-sub")).map(function (el) { return { el: el, top: parseFloat(el.style.top) }; });
    function isDesk() { return rt.clientWidth >= 1024 && rt.clientWidth / innerHeight >= 1.2; }
    function fit() {
      var desk = isDesk(); rt.classList.toggle("desk", desk);
      if (desk) {
        var vw = rt.clientWidth - (window.NDRAIL || 0), vh = innerHeight, BW = 2072, BH = 1200, k = Math.min(vw / BW, vh / BH), Wc = vw / k, Hc = vh / k, exH = Hc - BH, exW = Wc - BW;
        /* шапката е с най-ниската височина, която CRM вече ползва (Сделки / Договори: 300 + …), за да остане място за таба */
        var Hh = 300 + Math.min(exH * 0.3, 100), G = 24 + Math.min(exW * 0.15, 80), xL = (Wc - 2000 - G) / 2;
        canvas.style.zoom = k; canvas.style.marginLeft = "0px"; canvas.style.width = Wc + "px"; canvas.style.height = Hc + "px"; canvas.style.paddingTop = Hh + "px";
        top.style.height = Hh + "px";
        texts.forEach(function (o, i) { o.el.style.top = ((i ? 292 : 218) + (Hh - 380) * 0.5) + "px"; });
        var ph = Hh * 1.55, pw = ph * 1.777; if (photo) { photo.style.width = pw + "px"; photo.style.left = (Wc - pw + 20) + "px"; photo.style.top = (30 - 0.16 * ph) + "px"; }
        ctrls.forEach(function (el) { if (el.dataset.l == null) el.dataset.l = parseFloat(getComputedStyle(el).left); el.style.left = (Wc - 1024 + (+el.dataset.l)) + "px"; });
        var lh = Hc - Hh - 84 - (window.NDRAIL || !dock ? 24 : 162);
        rt.style.setProperty("--G", G + "px"); rt.style.setProperty("--xL", xL + "px"); rt.style.setProperty("--lh", lh + "px");
        rt.style.setProperty("--vis", (lh + 20) + "px"); /* видимото място в стъкления прозорец (височина − вътрешни отстъпи) */
        if (dockC) { dockC.style.transform = "scale(" + k + ")"; dockC.style.left = ((vw - 1024 * k) / 2) + "px"; dock.style.height = (DOCK * k) + "px"; }
        stage.style.paddingBottom = "0px"; rt.style.setProperty("--dockH", (window.NDRAIL || !dock ? 0 : 118 * k) + "px");
        return;
      }
      canvas.style.width = canvas.style.height = canvas.style.paddingTop = ""; top.style.height = "";
      texts.forEach(function (o) { o.el.style.top = o.top + "px"; }); if (photo) photo.style.width = photo.style.left = photo.style.top = ""; ctrls.forEach(function (el) { el.style.left = ""; });
      var vw2 = rt.clientWidth - (window.NDRAIL || 0), k2 = vw2 / W;
      canvas.style.zoom = k2; canvas.style.marginLeft = "0px";
      rt.style.setProperty("--vis", Math.round(innerHeight / k2 - (dockC ? DOCK : 0)) + "px"); /* видимата височина на телефона в пикселите на платното (без долното меню) */
      if (dockC) { dockC.style.transform = "scale(" + k2 + ")"; dockC.style.left = "0px"; dock.style.height = (DOCK * k2) + "px"; stage.style.paddingBottom = (DOCK * k2) + "px"; rt.style.setProperty("--dockH", (118 * k2) + "px"); }
      else { stage.style.paddingBottom = "0px"; rt.style.setProperty("--dockH", "0px"); }
    }
    addEventListener("resize", fit); addEventListener("orientationchange", fit); fit();
    NC.fit = fit;
  }
  /* вътрешни функции за автоматичните тестове (api/_nc-page.test.js); не променят състоянието сами */
  NC._test = { fromUrl: fromUrl, toUrl: toUrl, match: match, filtered: filtered, validate: validate, counts: counts, unitCard: unitCard, lockedHtml: lockedHtml, actsHtml: actsHtml,
    panel: panelHtml, hasLoc: hasLoc, brochure: brochure, use: function (a, m) { A = a; M = m; }, implicit: function () { return implicitU; } };
  NC.boot = function (adapter) {
    A = adapter; NC.A = adapter; root = document.getElementById("nc-main"); fitSetup();
    root.classList.add("ncx");
    root.addEventListener("click", onClick); root.addEventListener("change", onChange); root.addEventListener("input", onInput); root.addEventListener("keydown", onKey);
    addEventListener("popstate", applyUrl);
    document.addEventListener("visibilitychange", function () { if (!document.hidden && S.view === "project" && M && Date.now() - loadedAt > 60000) NC.reload(); });
    return Promise.resolve(A.init ? A.init() : null).then(function () {
      root.removeAttribute("aria-busy");
      var o = fromUrl(); S.lf = o.lf; S.lq = o.lq;
      if (o.view === "project") { S.tab = o.tab; S.b = o.b; S.f = o.f; S.u = o.u; S.pmode = o.pmode; S.flt = o.flt; implicitU = !o.u; openProject(o.key, false, true); }
      else loadList();
    }, function (e) { root.removeAttribute("aria-busy"); root.innerHTML = empty("triangle-alert", "Модулът не се зареди", (e && e.message) || "", btn("reload", "refresh-cw", "Опитай отново"), "err"); });
  };
})();
