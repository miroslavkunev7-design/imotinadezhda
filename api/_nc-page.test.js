// TASK-008 · страницата на проект „Ново строителство“ (CRM + публична) – автоматични тестове без мрежа и без браузър.
// node --test api/_nc-page.test.js
// Зарежда истинските mobile/crm/crm-nc.js, mobile/crm/crm-nc-staff.js и mobile/nc.js във vm с минимален DOM;
// всички данни са служебни (TEST-…): 1 сграда, 3 етажа, апартаменти в трите статуса.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const FILES = ["mobile/crm/crm-nc.js", "mobile/crm/crm-nc-staff.js", "mobile/crm/crm-nc-3d.js", "mobile/crm/crm-nc.css", "mobile/crm/crm-nc.html", "mobile/nc.js", "mobile/nc.html", "mobile/nc.css"];

/* ---------- минимален браузър ---------- */
function makeWin(search, extra) {
  const listeners = {};
  const toast = { textContent: "", classList: { add() {}, remove() {} } };
  const doc = {
    readyState: "loading", documentElement: { classList: { contains: () => false, add() {}, remove() {}, toggle() {} }, style: { setProperty() {} }, clientWidth: 1024 },
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); }, removeEventListener() {},
    getElementById: (id) => (id === "toast" ? toast : null), querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ setAttribute() {}, appendChild() {}, style: {} }),
    head: { appendChild() {} }, body: { classList: { toggle() {} }, appendChild() {} }, contains: () => true, title: "",
  };
  const win = Object.assign({
    document: doc, location: { search: search || "", pathname: "/mobile/crm/crm-nc.html", origin: "https://imotinadezhda.bg" },
    history: { pushState() {}, replaceState() {} }, addEventListener() {}, matchMedia: () => ({ matches: false }), innerHeight: 900,
    URLSearchParams, Intl, Promise, setTimeout, clearTimeout, console, crypto: require("crypto").webcrypto,
  }, extra || {});
  win.window = win; win.self = win;
  win._fire = (t) => (listeners[t] || []).forEach((f) => f());
  return win;
}
function load(win, files) { const ctx = vm.createContext(win); files.forEach((f) => vm.runInContext(read(f), ctx, { filename: f })); return ctx; }
/* ядро + адаптер; NC.boot се подменя, за да хванем адаптера без DOM */
function withAdapter(search, adapterFile, extra) {
  const win = makeWin(search, extra);
  load(win, ["mobile/crm/crm-nc.js"]);
  let A = null; win.NC.boot = (a) => { A = a; };
  load(win, [adapterFile]); win._fire("DOMContentLoaded");
  assert.ok(A, "адаптерът не се регистрира");
  return { win, NC: win.NC, A };
}

/* ---------- служебни данни ---------- */
const id = (s) => (s + "0000000000000000000000000000").slice(0, 28);
const B = id("bldtest"), F0 = id("flrtest0"), F1 = id("flrtest1"), F2 = id("flrtest2"), P = id("prjtest");
function model(over) {
  const u = (code, fl, status, a, ppm, x) => Object.assign({ id: id("unt" + code.toLowerCase().replace(/[^a-z0-9]/g, "")), code, building_id: B, floor_id: fl, status, area_total: a, area_net: a ? +(a * 0.87).toFixed(2) : null,
    terrace_area: 5, price_per_m2: ppm, price_total: a && ppm && status !== "sold-hidden" ? Math.round(a * ppm) : null, rooms: 2, beds: 1, baths: 1, exposure: "Юг", has_plan: true, version: 1 }, x || {});
  const M = {
    project: { id: P, key: P, slug: "test-proekt", title: "TEST Проект", city: "ТЕСТ-град", hood: "ТЕСТ-кв.", address: "ТЕСТ ул. 1", stage: "rough", expected_completion: "ТЕСТ 2099", advantages: [], status: "published", location: null },
    buildings: [{ id: B, name: "TEST Сграда", sort: 0 }],
    floors: [{ id: F0, building_id: B, level: 0, label: "Партер", has_plan: false }, { id: F1, building_id: B, level: 1, has_plan: true, polygons: [] }, { id: F2, building_id: B, level: 2, has_plan: false }],
    units: [u("T0-01", F0, "free", 55.5, 1150, { rooms: 1, exposure: "Север" }), u("T1-01", F1, "free", 71.1, 1199.5, { rooms: 3 }), u("T1-02", F1, "reserved", 88.8, 1240, { rooms: 3, exposure: "Запад" }),
      u("T1-03", F1, "sold", 93.4, null, { rooms: 4, price_total: null }), u("T2-01", F2, "free", 120.15, 1310, { rooms: 4, price_override: true, price_total: 149999, price_override_reason: "по преценка" }),
      u("T2-02", F2, "free", 64.25, null, { rooms: 2, price_total: null, exposure: null })],
    cover: null, gallery: [], files: [], models: {}, tours: {},
  };
  return Object.assign(M, over || {});
}
const uid = (M, code) => M.units.find((x) => x.code === code).id;
const staffA = { mode: "staff", shareUrl: () => null, canMortgage: () => true };
const pubA = { mode: "public", shareUrl: (M) => "https://imotinadezhda.bg/mobile/nc.html?p=" + M.project.slug, canMortgage: () => false };

/* =================================================================== */
test("филтри: етаж, стаи, площ, цена, изложение, статус, сграда, код – всеки връща точно съвпадащите", () => {
  const { NC } = withAdapter("", "mobile/nc.js"); const M = model(); NC._test.use(pubA, M);
  const n = (f) => M.units.filter((u) => NC._test.match(u, f)).map((u) => u.code).sort().join(",");
  assert.strictEqual(n({ f: F1 }), "T1-01,T1-02,T1-03");
  assert.strictEqual(n({ r: "3" }), "T1-01,T1-02");
  assert.strictEqual(n({ r: "5" }), "", "5+ стаи");
  assert.strictEqual(n({ a: "70-90" }), "T1-01,T1-02");
  assert.strictEqual(n({ p: "80000-120000" }), "T1-01,T1-02");
  assert.strictEqual(n({ p: "0-1000000000" }).split(",").length, 4, "без цена (продаден/невъведена) не минава ценови филтър");
  assert.strictEqual(n({ e: "Запад" }), "T1-02");
  assert.strictEqual(n({ s: "reserved" }), "T1-02");
  assert.strictEqual(n({ s: "sold" }), "T1-03");
  assert.strictEqual(n({ b: B, s: "free" }), "T0-01,T1-01,T2-01,T2-02");
  assert.strictEqual(n({ q: "t2" }), "T2-01,T2-02");
});

test("подредба: цена възходящо/низходящо (без цена накрая), площ, етаж", () => {
  const { NC } = withAdapter("", "mobile/nc.js"); const M = model(); NC._test.use(pubA, M); const S = NC.state;
  S.flt = { o: "pasc" }; assert.deepStrictEqual(NC._test.filtered().map((u) => u.code).slice(0, 4), ["T0-01", "T1-01", "T1-02", "T2-01"]);
  S.flt = { o: "pdesc" }; const d = NC._test.filtered().map((u) => u.code); assert.strictEqual(d[0], "T2-01"); assert.ok(["T1-03", "T2-02"].includes(d[d.length - 1]));
  S.flt = { o: "area" }; assert.strictEqual(NC._test.filtered()[0].code, "T2-01");
  S.flt = { o: "floor" }; assert.strictEqual(NC._test.filtered()[0].code, "T0-01");
  S.flt = {};
});

test("адрес (deep link): чете проект/таб/обект/филтри; отхвърля невалидни идентификатори; пише само идентификатори", () => {
  const M = model();
  const q = "?p=" + P + "&tab=plans&u=" + uid(M, "T1-02") + "&f=" + F1 + "&fs=reserved&fr=3&pl=unit";
  const { NC } = withAdapter(q, "mobile/nc.js");
  const o = NC._test.fromUrl();
  assert.strictEqual(o.view, "project"); assert.strictEqual(o.key, P); assert.strictEqual(o.tab, "plans"); assert.strictEqual(o.u, uid(M, "T1-02")); assert.strictEqual(o.pmode, "unit");
  assert.strictEqual(JSON.stringify(o.flt), JSON.stringify({ r: "3", s: "reserved" }));
  const bad = withAdapter("?p=" + P + "&tab=evil&u=%3Cscript%3E&f=..%2Fprivate", "mobile/nc.js").NC._test.fromUrl();
  assert.strictEqual(bad.tab, "overview"); assert.strictEqual(bad.u, null); assert.strictEqual(bad.f, null);
  // запис: само идентификатори, без токени/пътища; неявно избраният обект не влиза в адреса
  NC._test.use(pubA, M); Object.assign(NC.state, { view: "project", key: P, tab: "units", u: uid(M, "T1-01"), f: F1, b: B, flt: { s: "free" }, pmode: "floor" });
  const url = NC._test.toUrl();
  assert.ok(/^\/mobile\/crm\/crm-nc\.html\?p=[a-z0-9]+&tab=units&b=[a-z0-9]+&f=[a-z0-9]+&u=[a-z0-9]+&fs=free$/.test(url), url);
  assert.ok(!/token|private|sig=|http/i.test(url));
});

test("споделено състояние: невалиден/изтрит обект → безопасен друг избор и съобщение; етаж и сграда следват обекта", () => {
  const { NC, win } = withAdapter("", "mobile/nc.js"); const M = model(); NC._test.use(pubA, M);
  Object.assign(NC.state, { u: id("untdeleted"), b: null, f: null, cmp: [] });
  NC._test.validate(true);
  assert.ok(M.units.some((u) => u.id === NC.state.u), "избран е съществуващ обект");
  assert.strictEqual(M.units.find((u) => u.id === NC.state.u).status, "free", "по подразбиране – първият свободен");
  assert.ok(/вече не е наличен/.test(win.document.getElementById("toast").textContent));
  Object.assign(NC.state, { u: uid(M, "T1-02"), b: null, f: F0 }); NC._test.validate(false);
  assert.strictEqual(NC.state.f, F1, "етажът следва избрания обект"); assert.strictEqual(NC.state.b, B);
  Object.assign(NC.state, { u: null, f: F2 }); NC._test.validate(false);
  assert.strictEqual(M.units.find((u) => u.id === NC.state.u).floor_id, F2, "избран етаж без обект → първият обект от етажа");
});

test("карта „Избран апартамент“: голяма площ, фиксирана цена/м², обща цена по формулата; ръчна цена с причина; продаден публично без цена", () => {
  const { NC } = withAdapter("", "mobile/nc.js"); const M = model();
  NC._test.use(pubA, M); NC.state.cmp = [];
  let h = NC._test.unitCard(M.units.find((u) => u.code === "T1-01"), "overview");
  assert.ok(/71,10 м<sup>2<\/sup>/.test(h), "площ"); assert.ok(/1 199,50 €/.test(h), "цена/м²"); assert.ok(/85 284 €/.test(h), "обща = round(71.1 × 1199.5)");
  assert.ok(/Площ × цена на м², изчислено от системата/.test(h));
  h = NC._test.unitCard(M.units.find((u) => u.code === "T2-01"), "overview");
  assert.ok(/Обща цена \(ръчна\)/.test(h) && /149 999 €/.test(h) && /по преценка/.test(h), "ръчна цена с причина");
  h = NC._test.unitCard(M.units.find((u) => u.code === "T1-03"), "overview");
  assert.ok(/Продаден – цената не се показва/.test(h)); assert.ok(!/€<\/b><\/div><div class="tot"/.test(h));
  h = NC._test.unitCard(M.units.find((u) => u.code === "T2-02"), "overview");
  assert.ok(/Цената още не е въведена/.test(h), "липсваща цена – честно празно");
  assert.ok(!/инвеститор|строител(?!ств)|изпълнител/i.test(h));
  // екипът вижда цената на продаден
  NC._test.use(staffA, M); h = NC._test.unitCard(Object.assign({}, M.units[1], { status: "sold" }), "overview");
  assert.ok(/1 199,50 €/.test(h));
});

test("Капариран / Продаден: голям червен печат без файл на плана; „оригинал“ само за екипа", () => {
  const { NC } = withAdapter("", "mobile/nc.js"); const M = model(); NC._test.use(pubA, M);
  const r = NC._test.lockedHtml(M.units.find((u) => u.code === "T1-02")), s = NC._test.lockedHtml(M.units.find((u) => u.code === "T1-03"));
  assert.ok(/class="nc-stamp"[^>]*>КАПАРИРАН</.test(r)); assert.ok(/class="nc-stamp"[^>]*>ПРОДАДЕН</.test(s));
  assert.ok(!/<img|\/plan\/|private/.test(r + s), "без изображение и без път към план");
  assert.ok(!/data-act="orig"/.test(r));
  NC._test.use(staffA, M); assert.ok(/data-act="orig"/.test(NC._test.lockedHtml(M.units.find((u) => u.code === "T1-02"))));
});

test("всичко от базата минава през escape (няма HTML инжекция)", () => {
  const { NC } = withAdapter("", "mobile/nc.js"); const M = model(); NC._test.use(pubA, M);
  const evil = Object.assign({}, M.units[0], { code: '<img src=x onerror="alert(1)">', exposure: "<b>x</b>" });
  const h = NC._test.unitCard(evil, "overview");
  assert.ok(!/<img src=x/.test(h) && /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/.test(h));
});

test("действия: сравнение само с 2+, любими честно недостъпни, споделяне само за публикуван, брошура само публичен файл „Брошура…“", () => {
  const { NC } = withAdapter("", "mobile/nc.js"); const M = model(); NC._test.use(staffA, M); NC.state.cmp = []; NC.state.u = M.units[0].id;
  let h = NC._test.actsHtml();
  assert.ok(/data-act="compare" aria-disabled="true"/.test(h)); assert.ok(/data-act="fav" aria-disabled="true"/.test(h)); assert.ok(/data-act="share" aria-disabled="true"/.test(h));
  assert.ok(/data-act="brochure" aria-disabled="true"/.test(h));
  assert.ok(/data-act="location"(?! aria-disabled)/.test(h), "адресът е въведен → действието е налично");
  NC.state.cmp = [M.units[0].id, M.units[1].id]; M.files = [{ title: "Брошура TEST", path: "projects/" + P + "/public/files/b.pdf", access: "public" }, { title: "Брошура (оригинал)", access: "private" }];
  h = NC._test.actsHtml();
  assert.ok(/data-act="compare"(?! aria-disabled)/.test(h)); assert.ok(/data-act="brochure"(?! aria-disabled)/.test(h));
  assert.strictEqual(NC._test.brochure().access, "public");
  NC._test.use(pubA, M); h = NC._test.actsHtml(); assert.ok(/data-act="share"(?! aria-disabled)/.test(h)); assert.ok(/data-act="mortgage" aria-disabled="true"/.test(h), "калкулаторът е само в CRM");
});

test("местоположение: OSM с координатите или търсене по адреса; морски проект → морска илюстрация; без данни → честно празно", () => {
  const { NC } = withAdapter("", "mobile/nc.js"); const M = model(); NC._test.use(pubA, M);
  assert.strictEqual(NC.mapUrl({ location: { lat: 42.1, lng: 27.6 } }), "https://www.openstreetmap.org/?mlat=42.1&mlon=27.6#map=16/42.1/27.6");
  assert.strictEqual(NC.mapUrl({ address: "ТЕСТ ул. 1", city: "Бургас" }), "https://www.openstreetmap.org/search?query=" + encodeURIComponent("ТЕСТ ул. 1, Бургас"));
  assert.strictEqual(NC.mapUrl({}), null);
  assert.ok(NC.seaside({ city: "Созопол" }) && NC.seaside({ hood: "Слънчев бряг" }) && !NC.seaside({ city: "София", hood: "Драгалевци" }));
  NC.state.tab = "contacts"; let h = NC._test.panel();
  assert.ok(/id="nc-loc"/.test(h) && /ph45\.webp/.test(h) && /Търси адреса в картата/.test(h));
  M.project.city = "Созопол"; h = NC._test.panel(); assert.ok(/ph53\.webp/.test(h), "морски проект");
  Object.assign(M.project, { city: null, hood: null, address: null }); h = NC._test.panel(); assert.ok(/Местоположението на проекта още не е въведено/.test(h) && !/data-act="map"/.test(h));
});

test("9-те таба се показват; без инвеститор/строител/изпълнител; табовете не викат сървъра (няма fetch при смяна)", () => {
  let calls = 0; const { NC } = withAdapter("", "mobile/nc.js", { fetch: () => { calls++; return Promise.reject(new Error("no")); } }); const M = model(); NC._test.use(pubA, M);
  assert.strictEqual(JSON.stringify(NC.dict.TABS.map((t) => t[1])), JSON.stringify(["Общ преглед", "Апартаменти", "Разпределения", "3D Сграда", "360° Разходка", "Строителство", "Галерия", "Документи", "Контакти"]));
  NC.state.u = M.units[0].id; NC.state.f = F0; NC.state.b = B; NC.state.flt = {};
  NC.dict.TABS.forEach((t) => { NC.state.tab = t[0]; const h = NC._test.panel(); assert.ok(h.length > 200, t[0]); assert.ok(!/инвеститор|строител(?!ств)|строителна фирма|изпълнител/i.test(h.replace(/<[^>]+>/g, " ")), t[0]); assert.ok(!/Разделът не може да се покаже/.test(h), t[0]); });
  assert.strictEqual(calls, 0);
});

test("Строителство: етап само ако е въведен; актове и снимки от строежа – честно празно; процент не се показва публично", () => {
  const { NC } = withAdapter("", "mobile/nc.js"); const M = model(); M.project.stage_percent = 40; NC._test.use(pubA, M); NC.state.tab = "build";
  let h = NC._test.panel();
  assert.ok(/aria-current="step"/.test(h) && /Груб строеж/.test(h)); assert.ok(!/40 %/.test(h)); assert.ok(/само при документално потвърждение/.test(h)); assert.ok(/Няма отбелязани снимки от строежа/.test(h));
  NC._test.use(staffA, M); assert.ok(/40 %/.test(NC._test.panel()), "екипът вижда процента с обяснение");
  M.project.stage = null; NC._test.use(pubA, M); h = NC._test.panel(); assert.ok(/Етапът на строителството не е въведен/.test(h) && !/aria-current="step"/.test(h));
});

test("3D / 360: без модел и без панорами – честно състояние с илюстрация и надпис „не е този проект“, не статична снимка като 3D", () => {
  const { NC } = withAdapter("", "mobile/nc.js"); const M = model(); NC._test.use(pubA, M); NC.state.u = M.units[1].id; NC.state.b = B; NC.state.f = F1;
  NC.state.tab = "b3d"; let h = NC._test.panel();
  assert.ok(/още не е подготвен/.test(h) && /ph28\.webp/.test(h) && /Илюстрация – не е този проект/.test(h) && !/id="nc-3d"/.test(h));
  NC.state.tab = "tour"; h = NC._test.panel(); assert.ok(/ph38\.webp/.test(h) && /още не са подготвени/.test(h) && !/id="nc-pano"/.test(h));
  NC.state.u = M.units[2].id; h = NC._test.panel(); assert.ok(/КАПАРИРАН/.test(h) && !/id="nc-pano"/.test(h), "капариран: печат, без панорами");
  M.models[B] = 1; NC.state.tab = "b3d"; h = NC._test.panel(); assert.ok(/id="nc-3d"/.test(h) && /role="application"/.test(h));
});

test("кука TASK-009/010: window.NCModel / window.NCTour се ползват вместо вградения визуализатор (със собствения си this)", async () => {
  const NCModel = { name: "TEST-009", n: 0, building() { this.n++; return {}; } };
  const { NC } = withAdapter("", "mobile/nc.js", { NCModel, NCTour: { name: "TEST-010", panorama() { return {}; } } });
  const L = await NC.engine("model"); assert.strictEqual(L.name, "TEST-009"); assert.strictEqual(L.webglOk(), true); L.building({}, {}); assert.strictEqual(NCModel.n, 1);
  assert.strictEqual((await NC.engine("tour")).name, "TEST-010");
});

test("публичен адаптер: планове и панорами само през /plan/ и /pano/; капариран/продаден – без адрес; споделяне без лични данни", async () => {
  const { A } = withAdapter("", "mobile/nc.js"); const M = model();
  const free = M.units.find((u) => u.code === "T1-01"), res = M.units.find((u) => u.code === "T1-02"), sold = M.units.find((u) => u.code === "T1-03");
  assert.strictEqual((await A.unitPlan(free)).url, "/plan/unit/" + free.id);
  assert.strictEqual((await A.unitPlan(res)).url, null); assert.strictEqual((await A.unitPlan(sold)).url, null);
  assert.strictEqual((await A.floorPlan(M.floors[1])).url, "/plan/floor/" + F1);
  assert.strictEqual(JSON.stringify((await A.tourItems(Object.assign({}, free, { tour_count: 2 }))).map((x) => x.url)), JSON.stringify(["/pano/" + free.id + "/0", "/pano/" + free.id + "/1"]));
  assert.strictEqual((await A.tourItems(Object.assign({}, res, { tour_count: 2 }))).length, 0);
  const su = A.shareUrl(M, free); assert.strictEqual(su, "https://imotinadezhda.bg/mobile/nc.html?p=test-proekt&u=" + free.id);
  assert.strictEqual(A.canMortgage(), false); assert.strictEqual(A.mode, "public");
});

test("публичен адаптер: проект само по валиден slug; продаденият идва от сървъра без цена и остава без цена", async () => {
  const sent = [];
  const fetch = (url, o) => { sent.push({ url, body: o && o.body }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(/nd_public_project$/.test(url) ? {
    id: P, slug: "test-proekt", title: "TEST", buildings: [{ id: B, name: "TEST Сграда", floors: [{ id: F1, level: 1, has_plan: true, polygons: [] }], model: null }],
    units: [{ id: id("unts"), code: "S1", building_id: B, floor_id: F1, status: "sold", price_total: null, price_per_m2: null, has_plan: true, tour_count: 0 }], files: [], gallery: [] } : []) }); };
  const { A } = withAdapter("", "mobile/nc.js", { fetch });
  assert.strictEqual(await A.project("<bad slug>"), null); assert.strictEqual(sent.length, 0, "невалиден slug не стига до сървъра");
  const M = await A.project("test-proekt");
  assert.strictEqual(M.units[0].price_total, null); assert.strictEqual(M.project.location, null);
  assert.ok(sent.every((s) => /\/rest\/v1\/rpc\/nd_public_project$|\/storage\/v1\/object\/sign\/nd-files$/.test(s.url)));
});

test("публични форми: валидиране (име, телефон или имейл, бъдеща дата) и запитване през съществуващия nd_public_inquiry", async () => {
  const sent = []; const fetch = (url, o) => { sent.push({ url, body: JSON.parse(o.body) }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(true) }); };
  const { NC, A } = withAdapter("", "mobile/nc.js", { fetch });
  const M = model(); NC._test.use(A, M);
  const html = A.contactForms(M, M.units[0]);
  assert.ok(/id="nc-inquiry"/.test(html) && /id="nc-viewing"/.test(html) && /ph29\.webp/.test(html) && /ph33\.webp/.test(html));
  assert.ok(/Политиката за поверителност/.test(html));
  assert.ok(NC.validPhoneOrMail("0888 123 456", "") && NC.validPhoneOrMail("", "a@b.bg") && !NC.validPhoneOrMail("12", "x@"));
  assert.ok(/^\d{4}-\d\d-\d\d$/.test(NC.util.today()));
  const d = new Date(); assert.strictEqual(NC.util.today(), d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), "местна дата, не UTC");
});

test("двойно изпращане: bindForm изпраща само веднъж при 3 бързи натискания", async () => {
  const { NC } = withAdapter("", "mobile/nc.js");
  const handlers = {}, btn = { disabled: false, innerHTML: "x" }, err = { textContent: "" };
  const form = { _b: 0, addEventListener: (t, f) => { handlers[t] = f; }, querySelector: (q) => (q === ".nc-ferr" ? err : q === '[type="submit"]' ? btn : null), querySelectorAll: () => [], setAttribute() {}, removeAttribute() {}, innerHTML: "" };
  let n = 0; NC.bindForm(form, () => null, () => { n++; return new Promise((ok) => setTimeout(() => ok("Изпратено."), 30)); });
  const ev = { preventDefault() {} }; handlers.submit(ev); handlers.submit(ev); handlers.submit(ev);
  await new Promise((r) => setTimeout(r, 80));
  assert.strictEqual(n, 1); assert.ok(/Изпратено/.test(form.innerHTML));
});

test("служебен адаптер: 409 → „Някой друг промени записа … презаредени“ и презареждане; токенът е само в Authorization", async () => {
  const sent = []; let reloads = 0;
  const ND = { token: () => Promise.resolve("TEST-JWT"), ready: () => Promise.resolve(), sb: () => ({ rpc: () => Promise.resolve({ data: false }) }) };
  const fetch = (url, o) => { sent.push({ url, o }); return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ ok: false, error: "NC409" }) }); };
  const win = makeWin("", { ND, fetch, NDUI: {} }); load(win, ["mobile/crm/crm-nc.js"]);
  let A = null; win.NC.boot = (a) => { A = a; }; load(win, ["mobile/crm/crm-nc-staff.js"]); win._fire("DOMContentLoaded");
  win.NC.reload = () => { reloads++; return Promise.resolve(); };
  await assert.rejects(A.project(id("prjtest")), (e) => /Някой друг промени записа/.test(e.message) && /презаредени/.test(e.message));
  assert.strictEqual(sent[0].url, "/api/tools"); assert.strictEqual(sent[0].o.headers.Authorization, "Bearer TEST-JWT"); assert.ok(!/TEST-JWT/.test(sent[0].url + sent[0].o.body));
  assert.ok(/"tool":"projects.get"/.test(sent[0].o.body));
  assert.ok(/Импорт на проект/.test(A.listActs()), "бутонът „Импорт“ е видим за екипа");
  assert.ok(!/projects\/[^"]*\/public\//.test(A.listActs()));
});

test("статични проверки: няма ранно зареждане на импорта, мащабът не е забранен, three.js е локален, няма тайни, всички снимки съществуват и се ползват", () => {
  const html = read("mobile/crm/crm-nc.html"), pub = read("mobile/nc.html");
  assert.ok(!/crm-nc-import\.js/.test(html), "импортът (TASK-006) се зарежда при натискане, не при отваряне");
  [html, pub].forEach((h) => { assert.ok(!/user-scalable\s*=\s*no|maximum-scale/i.test(h)); assert.ok(/<html lang="bg">/.test(h)); });
  const all = FILES.map(read).join("\n");
  assert.ok(!/cdn\.|unpkg|jsdelivr|cdnjs|googleapis\.com\/ajax/i.test(all), "без външни CDN");
  assert.ok(/from "\/mobile\/vendor\/three\/r187\/nd-three\.min\.js"/.test(read("mobile/crm/crm-nc-3d.js")) && fs.existsSync(path.join(ROOT, "mobile/vendor/three/r187/nd-three.min.js")));
  assert.ok(!/sb_secret_|service_role|SUPABASE_SERVICE|eyJhbGciOi/.test(all), "без тайни в браузъра");
  assert.ok(!/инвеститор|строител(?!ств)|строителна фирма|изпълнител|investor|builder|contractor/i.test(FILES.filter((f) => /\.(js|html)$/.test(f)).map(read).join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1")), "без инвеститор/строител в модула");
  // снимки: всяка от PH съществува; в assets/nd/ph21+ няма неизползвани
  const used = new Set((all.match(/nd\/ph\d\d\.webp/g) || []).map((x) => x.slice(3)));
  const win = makeWin(""); load(win, ["mobile/crm/crm-nc.js"]); Object.values(win.NC.PH).forEach((p) => used.add(p.slice(3)));
  used.forEach((f) => assert.ok(fs.existsSync(path.join(ROOT, "mobile/crm/assets/nd", f)), "липсва " + f));
  /* „неизползвана“ е снимка, която не я ползва НИКОЙ модул в дървото: същата папка споделят и TASK-006 (crm-nc-import.js – ph24/ph27, разширението се добавя в кода),
     TASK-009 (nc-model.js) и TASK-010 (nc-tour.js, crm-nc-tour.js) – след сливането техните снимки не са „чужди“. */
  const stems = new Set([...used].map((f) => f.slice(0, 4)));
  (function walk(d) { fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach((e) => { const r = d + "/" + e.name;
    if (e.isDirectory()) { if (!/^(vendor|assets|node_modules)$/.test(e.name)) walk(r); }
    else if (/\.(js|html|css)$/.test(e.name)) (read(r).match(/nd\/ph\d\d/g) || []).forEach((x) => stems.add(x.slice(3))); }); })("mobile");
  const extra = fs.readdirSync(path.join(ROOT, "mobile/crm/assets/nd")).filter((f) => /^ph(2[1-9]|[3-5]\d)\./.test(f) && !stems.has(f.slice(0, 4)));
  assert.deepStrictEqual(extra, [], "копирани, но неизползвани снимки");
  const map = /\["(\d\d)"(?:,"\d\d")*\]\.forEach/.exec(pub); assert.ok(map, "публичната карта IMG");
  const pubList = pub.match(/\["\d\d"(?:,"\d\d")*\]/)[0].match(/\d\d/g); Object.values(win.NC.PH).forEach((p) => assert.ok(pubList.includes(p.slice(5, 7)), "публичната страница не знае " + p));
});
