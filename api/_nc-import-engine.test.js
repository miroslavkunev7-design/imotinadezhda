// Тест: двигател на импорта (TASK-006) – целият синтетичен ТЕСТОВ пакет от край до край на няколко парчета, срив и продължение,
// отмяна, дубликати, конфликти, липси, произход, план за запис (buildApply) и еднакъв резултат за CRM и Тед. Без мрежа.
//   node api/_nc-import-engine.test.js
"use strict";
const assert = require("assert");
const E = require("./_nc-import-engine.js"), F = require("./_nc-import-fixtures.js"), I = require("./_nc-import.js");
let n = 0; const done = (name) => { n++; console.log("PASS  " + name); };
const PID = "0123456789abcdef0123456789abcdef", IMP = "aaaaaaaabbbbbbbbccccccccdddddddd";

function harness(pkg, opts) {
  opts = opts || {};
  const store = new Map(), json = new Map(), log = { downloads: 0, uploads: [] };
  let clock = 0;
  const items = pkg.map((f, i) => { const p = "projects/" + PID + "/private/imports/" + IMP + "/" + String(i).padStart(4, "0") + "-" + E.safeName(f.name); store.set(p, f.data); return { path: p, name: f.name, size: f.data.length }; });
  const io = {
    now: () => clock, nowIso: () => "2026-11-11T00:00:00.000Z",
    readList: async () => ({ import_id: IMP, project_id: PID, items, ai: opts.ai !== false }),
    download: async (p, max) => { log.downloads++; clock += opts.msPerFile || 0; if (opts.failAt && log.downloads === opts.failAt) return { ok: false, code: "failed" }; return store.has(p) ? (store.get(p).length > max ? { ok: false, code: "too_large" } : { ok: true, buf: store.get(p) }) : { ok: false, code: "not_found" }; },
    upload: async (p, b) => { log.uploads.push(p); store.set(p, b); return true; },
    readJson: async (k) => (json.has(k) ? JSON.parse(json.get(k)) : null), writeJson: async (k, o) => { json.set(k, JSON.stringify(o)); return true; },
    snapshot: async () => opts.snap || ({ project: { id: PID, status: "draft", version: 1, content_rev: 1, data: { title: "TEST-ПРОЕКТ" } }, buildings: [], floors: [], units: [] }),
    previousHashes: async () => opts.prev || {}, heartbeat: async () => !!opts.cancel && log.downloads >= opts.cancel,
    ai: opts.ai ? async (e) => ({ purpose: "floor_plan", purpose_bg: "Етажен план", title: "TEST", confidence: 0.61, tool: "api/scan.js (kind: classify)", model: "TEST" }) : null
  };
  return { io, store, json, log, items, tick: (ms) => { clock += ms; } };
}
async function runAll(h, budget) { let r, c = 0; do { r = await E.runChunk({ id: "job-1" }, h.io, { budgetMs: budget || 18000 }); c++; h.tick(1); } while (r.status === "yield" && c < 100); return { r, chunks: c }; }

(async () => {
  /* 1. пълният ТЕСТОВ пакет на няколко парчета */
  const h1 = harness(F.testPackage(), { msPerFile: 4000 });
  const { r: r1, chunks } = await runAll(h1, 18000);
  assert.strictEqual(r1.status, "review"); assert.ok(chunks >= 3, "парчета: " + chunks);
  const p = r1.preview;
  assert.strictEqual(p.counts.files, 13); assert.strictEqual(p.counts.duplicate, 1);
  const byName = (s) => p.files.find((f) => f.source_name.endsWith(s));
  assert.strictEqual(byName("TEST-копие.png").status, "duplicate"); assert.strictEqual(byName("TEST-копие.png").duplicate_of, byName("TEST-A1.png").file_id);
  assert.strictEqual(byName("TEST-Етаж-1.pdf").pdf.kind, "vector"); assert.strictEqual(byName("TEST-scan-etazh-2.pdf").pdf.kind, "scan");
  ["TEST-model.dwg", "TEST-model.dxf", "TEST-model.ifc", "TEST-model.glb"].forEach((nm) => { const f = byName(nm); assert.strictEqual(f.downstream, "TASK-009", nm); assert.ok(!f.capabilities.includes("extract"), nm + ": без фалшиво извличане"); });
  assert.ok(p.files.every((f) => /^[a-f0-9]{64}$/.test(f.sha256 || "") || f.status === "rejected"), "SHA-256 за всеки файл");
  assert.ok(p.files.every((f) => f.confidence === null || (f.confidence >= 0 && f.confidence <= 1)), "увереност 0..1");
  assert.ok(JSON.stringify(p).indexOf("/private/") < 0, "в черновата няма пътища към оригиналите");
  done("пълен ТЕСТОВ пакет: " + chunks + " парчета; SHA-256, дубликат по съдържание, PDF вектор/скан, CAD/BIM/GLB само за TASK-009, без пътища в черновата");

  const U = (code) => p.units.find((u) => u.code === code);
  assert.strictEqual(U("TEST-A1").fields.area_total.value, null); assert.ok(U("TEST-A1").fields.area_total.conflict, "102,70 срещу 103,10 → конфликт");
  const c1 = p.conflicts.find((c) => c.conflict_id === U("TEST-A1").fields.area_total.conflict);
  assert.strictEqual(c1.sources.length, 2); assert.deepStrictEqual(c1.sources.map((s) => s.value).sort(), [102.7, 103.1]); assert.ok(c1.sources.every((s) => s.f && s.c), "източник: файл + клетка");
  assert.strictEqual(U("TEST-A5").include, false); assert.ok(p.conflicts.some((c) => c.kind === "duplicate_unit_code" && c.unit_ref === U("TEST-A5").ref));
  assert.strictEqual(U("TEST-A4").fields.area_total, undefined); assert.ok(p.missing.some((m) => m.ref === U("TEST-A4").ref && /отрицателна/.test(m.message)));
  assert.strictEqual(U("TEST-A6").floor_ref, null); assert.ok(p.missing.some((m) => m.ref === U("TEST-A6").ref && m.blocking && /мансарда/.test(m.message)));
  assert.ok(p.missing.some((m) => m.ref === U("TEST-A6").ref && /двусмислен разделител/.test(m.message)), "„2,100“ не става 2,1 €/м²");
  assert.strictEqual(U("TEST-A1").fields.price_per_m2.value, 2100); assert.strictEqual(U("TEST-A1").fields.area_net.value, 88.1);
  assert.strictEqual(U("TEST-A3").fields.price_per_m2, undefined); assert.strictEqual(U("TEST-A3").override_offer.price_total, 120000, "общата цена е само предложение за ръчна цена");
  assert.ok(p.warnings.some((w) => w.code === "STATUS_NOT_IMPORTED" && /TEST-A1/.test(w.message)));
  assert.ok(p.warnings.some((w) => w.code === "FORBIDDEN_COLUMN"));
  assert.ok(p.units.every((u) => !("status" in u) && !("price_total" in u.fields) && !Object.keys(u.fields).some((k) => /investor|builder|status/.test(k))), "в обектите няма статус, инвеститор или изчислена обща цена");
  assert.ok(!JSON.stringify(p.units).match(/"(status|investor|builder)"\s*:/), "никъде в обектите");
  assert.strictEqual(p.state, "needs_input");
  done("нормализиране и конфликти: конфликт на площи (2 източника с клетки), дублиран код, отрицателна площ, двусмислен етаж/разделител, статус и инвеститор не се внасят");

  assert.strictEqual(U("TEST-A1").plan.file_id, byName("TEST-A1.png").file_id); assert.strictEqual(U("TEST-A1").plan.confidence, 0.9);
  const f1 = p.floors.find((f) => f.level === 1); assert.strictEqual(f1.plan.file_id, byName("TEST-Етаж-1.pdf").file_id);
  assert.strictEqual(p.floors.find((f) => f.level === 0).label, "Партер");
  assert.strictEqual(p.project.city.value, "TEST-Град"); assert.strictEqual(p.project.city.include, true); assert.strictEqual(p.project.title.include, false, "не презаписва съществуващо име");
  assert.strictEqual(p.project.stage.value, "act14"); assert.ok(!("builder" in p.project));
  assert.ok(JSON.parse(h1.json.get("paths.json"))[byName("TEST-A1.png").file_id].path.startsWith("projects/" + PID + "/private/imports/"));
  done("планове: свързване само при точно съвпадение (код / номер на етаж); данни за проекта по схема; пътищата са само в сървърна карта");

  /* 2. срив по средата и продължение: същият резултат, без дублирани файлове */
  const h2 = harness(F.testPackage(), { msPerFile: 4000, failAt: 6 });
  let threw = null; try { await runAll(h2, 18000); } catch (e) { threw = e; }
  assert.ok(threw && threw.retryable && threw.code === "STORAGE_FAILED", "временна грешка при четене → повторим опит");
  const saved = JSON.parse(h2.json.get("state.json")); assert.ok(saved.qi > 0 && saved.qi < 13, "запазено е докъдето е стигнало");
  h2.io.download = harness(F.testPackage()).io.download.bind(null); // нов адаптер без срив
  const store2 = harness(F.testPackage());
  h2.io.download = store2.io.download;
  const { r: r2 } = await runAll(h2, 18000);
  assert.strictEqual(r2.status, "review");
  const strip = (x) => JSON.stringify(Object.assign({}, x, { job_id: null }));
  assert.strictEqual(strip(r2.preview.units), strip(p.units), "същите обекти след продължение");
  assert.strictEqual(r2.preview.files.length, 13, "без дублирани записи за файлове");
  done("срив по средата → повторим опит; продължава от последното запазено състояние със същия резултат");

  /* 3. отмяна: при поискана отмяна изпълнителят спира веднага и не пише чернова */
  const h3 = harness(F.testPackage(), { msPerFile: 9000, cancel: 1 });
  const r3 = await E.runChunk({ id: "job-1" }, h3.io, { budgetMs: 60000 });
  assert.strictEqual(r3.status, "stopped"); assert.ok(!h3.json.has("preview.json"));
  done("отмяна: спира на първия пулс, без чернова");

  /* 4. ZIP в пакета: безопасен архив се разархивира в projects/<id>/private/imports/<import>/_zip/…; опасен – отказан */
  const xlsx = F.testPackage()[0].data;
  const safeZip = F.makeZip([{ name: "PROJECT_PACKAGE/unit-data/TEST.xlsx", data: xlsx }, { name: "PROJECT_PACKAGE/unit-plans/TEST-A2.jpg", data: F.makeJpeg(64, 64) }, { name: "__MACOSX/._x", data: "x" }, { name: "PROJECT_PACKAGE/nested.zip", data: F.makeZip([{ name: "a.txt", data: "x" }]) }, { name: "PROJECT_PACKAGE/run.exe", data: Buffer.from("MZ\x90\0") }]);
  const evil = F.makeZip([{ name: "ok.txt", data: "x" }, { name: "../../etc/passwd", data: "TEST" }]);
  const bomb = F.makeZip([{ name: "zeros.bin", data: Buffer.alloc(25 * 1048576) }]);
  const h4 = harness([{ name: "TEST-пакет.zip", data: safeZip }, { name: "evil.zip", data: evil }, { name: "bomb.zip", data: bomb }]);
  const { r: r4 } = await runAll(h4);
  const fz = (s) => r4.preview.files.find((f) => f.source_name.endsWith(s));
  assert.strictEqual(fz("evil.zip").status, "rejected"); assert.ok(fz("evil.zip").issues.some((i) => i.code === "ARCHIVE_UNSAFE" && /\.\.\//.test(i.message)));
  assert.strictEqual(fz("bomb.zip").status, "rejected"); assert.ok(fz("bomb.zip").issues.some((i) => /zip bomb/.test(i.message)));
  assert.strictEqual(fz("unit-data/TEST.xlsx").purpose, "unit_inventory"); assert.strictEqual(fz("unit-data/TEST.xlsx").from_zip, fz("TEST-пакет.zip").file_id);
  assert.strictEqual(fz("nested.zip").status, "stored_only"); assert.strictEqual(fz("run.exe").status, "rejected");
  assert.ok(h4.log.uploads.every((u) => u.startsWith("projects/" + PID + "/private/imports/" + IMP + "/_zip/")), "разархивираното отива само в папката на импорта");
  assert.ok(!h4.log.uploads.some((u) => /run\.exe|_x$/.test(u)), "изпълнимото и системните не се записват");
  assert.strictEqual(r4.preview.units.length, 6, "обектите от XLSX в архива (TEST-A1…A6; A7 е само в CSV)");
  done("ZIP: безопасният се разархивира в папката на импорта; „../“ и zip bomb → отказ; вложен архив само се пази; .exe → карантина");

  /* 5. файл над 40 MB, липсващ файл, несъответствие на SHA-256 → отказ с причина, останалото продължава */
  const h5 = harness([{ name: "big.pdf", data: Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(41 * 1048576)]) }, { name: "u.csv", data: Buffer.from("Обект;Етаж;Обща площ\nTEST-C1;2;55\n") }]);
  h5.items.push({ path: "projects/" + PID + "/private/imports/" + IMP + "/9999-missing.pdf", name: "missing.pdf", size: 10 });
  h5.items[1].sha256 = "0".repeat(64);
  const { r: r5 } = await runAll(h5);
  const g = (s) => r5.preview.files.find((f) => f.source_name === s);
  assert.ok(g("big.pdf").issues.some((i) => i.code === "FILE_TOO_LARGE")); assert.ok(g("missing.pdf").issues.some((i) => /не е намерен/.test(i.message)));
  assert.ok(g("u.csv").issues.some((i) => /SHA-256/.test(i.message)) && g("u.csv").status === "rejected");
  assert.strictEqual(r5.preview.importable, false); assert.strictEqual(r5.preview.error_code, "INVALID_PACKAGE");
  done("над 40 MB, липсващ файл и подменено съдържание (SHA-256) → отказ с причина; нищо за запис → INVALID_PACKAGE");

  /* 6. обновяване на съществуващ проект: разлика, без промяна, вече внесен файл, нищо не се трие */
  const snap = { project: { id: PID, status: "draft", version: 3, content_rev: 7, data: { title: "TEST-ПРОЕКТ", city: "TEST-Стар-град" } },
    buildings: [{ id: "b0000000000000000000000000000001", name: "А" }], floors: [{ id: "f0000000000000000000000000000001", building_id: "b0000000000000000000000000000001", level: 1, label: null, updated_at: "2026-11-10T10:00:00.000000+00:00", has_plan: false }],
    units: [{ id: "u0000000000000000000000000000001", code: "TEST-A2", floor_id: "f0000000000000000000000000000001", building_id: "b0000000000000000000000000000001", status: "reserved", version: 4, area_total: 75.4, area_net: 63.2, terrace_area: null, price_per_m2: 1900, rooms: 2, beds: 1, baths: 1, exposure: "Юг-Изток" },
      { id: "u0000000000000000000000000000002", code: "TEST-OLD", floor_id: "f0000000000000000000000000000001", building_id: "b0000000000000000000000000000001", status: "free", version: 1, area_total: 40 }] };
  const sha = h1.store.size && require("./_nc-import-engine.js").sha256(F.testPackage()[1].data);
  const h6 = harness(F.testPackage().slice(0, 3), { snap, prev: { [sha]: "imp-11111111" } });
  const { r: r6 } = await runAll(h6);
  const q = r6.preview, a2 = q.units.find((u) => u.code === "TEST-A2");
  assert.strictEqual(a2.action, "update"); assert.deepStrictEqual(a2.diff, { price_per_m2: { old: 1900, new: 2000 } }); assert.strictEqual(a2.expected_version, 4);
  assert.ok(a2.notes.some((x) => /Капариран/.test(x.issue)), "статусът не се пипа");
  assert.strictEqual(q.buildings.find((b) => b.name === "А").action, "match");
  assert.ok(q.warnings.some((w) => w.code === "NOT_IN_PACKAGE" && /TEST-OLD/.test(w.message)));
  assert.ok(q.files.find((f) => f.source_name.endsWith(".csv")).previously_imported === "imp-11111111");
  assert.strictEqual(q.project.city.include, false, "различна стойност не презаписва по подразбиране"); assert.strictEqual(q.base.content_rev, 7);
  done("обновяване: разлика само по променените полета, съществуваща сграда, вече внесен файл (SHA-256), съществуващите обекти не се трият");

  /* 7. buildApply: решенията на човека → план за запис; произход; нерешени конфликти; чужди файлове; без статус */
  const paths = JSON.parse(h1.json.get("paths.json"));
  const who = { userId: "00000000-0000-4000-8000-000000000002", admin: false, now: "2026-11-11T10:00:00.000Z" };
  const acc = I.acceptFromPreview(p);
  assert.ok(!acc.units.some((u) => u.code === "TEST-A5" || u.code === "TEST-A6"), "изключените не се предлагат");
  assert.throws(() => I.buildApply(p, acc, who, paths), (e) => e.code === "CONFLICT_REQUIRES_REVIEW" && e.status === 409 && /TEST-A1/.test(e.message));
  const accR = JSON.parse(JSON.stringify(acc)); accR.resolved = [c1.conflict_id];
  const ua1 = accR.units.find((u) => u.code === "TEST-A1"); ua1.area_total = 102.7;
  const ua3 = accR.units.find((u) => u.code === "TEST-A3"); Object.assign(ua3, { price_override: true, price_total: 120000, price_override_reason: "по импорт – обща цена от файла" });
  const plan = I.buildApply(p, accR, who, paths).payload;
  assert.strictEqual(plan.buildings.length, 1); assert.strictEqual(plan.units.length, 5);
  const pa1 = plan.units.find((u) => u.code === "TEST-A1");
  assert.strictEqual(pa1.data.import.src.area_total, c1.sources.find((s) => s.value === 102.7).f + ":Обекти!D4", "произход: файл:лист!клетка");
  assert.ok(pa1.data.plan.private.startsWith("projects/" + PID + "/private/imports/"));
  assert.strictEqual(plan.units.find((u) => u.code === "TEST-A3").data.import.manual.price_total.by, who.userId, "ръчна цена: кой/кога");
  assert.ok(!JSON.stringify(plan).match(/"status"\s*:/), "статус никога не се подава към базата");
  const fake = JSON.parse(JSON.stringify(accR)); fake.units[0].plan_file_id = "f999";
  assert.throws(() => I.buildApply(p, fake, who, paths), (e) => e.code === "INVALID_PACKAGE");
  const extra = JSON.parse(JSON.stringify(accR)); extra.units.push({ ref: "u99", floor_ref: "f1", code: "TEST-НОВ" });
  assert.throws(() => I.buildApply(p, extra, who, paths), /не е предложен/);
  const down = JSON.parse(JSON.stringify(accR)); down.downstream = [byName("TEST-model.ifc").file_id];
  assert.throws(() => I.buildApply(p, down, who, paths), (e) => e.code === "FORBIDDEN" && e.status === 403);
  const dplan = I.buildApply(p, down, Object.assign({}, who, { admin: true }), paths);
  assert.strictEqual(dplan.downstream[0].kind, "cad_inspect"); assert.ok(/^cad_inspect:[a-z0-9]+:[a-f0-9]{64}$/.test(dplan.downstream[0].key));
  done("buildApply: нерешен конфликт → 409; произход по клетка; ръчна цена с кой/кога; без статус; чужд файл/нов обект → отказ; заявка към TASK-009 – само администратор");

  /* 8. CRM и Тед: един и същи запис от една и съща чернова */
  const clean = harness([{ name: "P/unit-data/u.csv", data: Buffer.from("Обект;Вход;Етаж;Обща площ;Чиста площ;Цена на кв.м\nTEST-D1;А;1;70,5;60;2000\nTEST-D2;А;2;80;70;2100\n") }]);
  const { r: rc } = await runAll(clean);
  assert.strictEqual(rc.preview.state, "needs_review");
  const crmAccept = { buildings: rc.preview.buildings.map((b) => ({ ref: b.ref, name: b.name })), floors: rc.preview.floors.map((f) => ({ ref: f.ref, building_ref: f.building_ref, level: f.level })),
    units: rc.preview.units.map((u) => ({ ref: u.ref, floor_ref: u.floor_ref, code: u.code, area_total: u.fields.area_total.value, area_net: u.fields.area_net.value, price_per_m2: u.fields.price_per_m2.value })), project: {}, resolved: [], downstream: [] };
  const pCrm = I.buildApply(rc.preview, crmAccept, who, JSON.parse(clean.json.get("paths.json"))).payload;
  const pTed = I.buildApply(rc.preview, I.acceptFromPreview(rc.preview), who, JSON.parse(clean.json.get("paths.json"))).payload;
  assert.deepStrictEqual(pTed, pCrm, "еднакъв план за запис");
  assert.deepStrictEqual(pTed.units.map((u) => u.data.import.manual), [{}, {}], "без ръчни промени");
  done("CRM ↔ Тед: една и съща чернова → идентичен план за запис (същата функция, същият резултат)");

  /* 9. AI предложение: само за неразпознати файлове, записва се като предложение, не сменя предназначението */
  const h9 = harness([{ name: "IMG_0001.png", data: F.makePng(80, 80) }, { name: "u.csv", data: Buffer.from("Обект;Етаж\nTEST-E1;1\n") }], { ai: true });
  const { r: r9 } = await runAll(h9);
  const im = r9.preview.files.find((f) => f.source_name === "IMG_0001.png");
  assert.strictEqual(im.purpose, "unknown"); assert.ok(im.ai_suggestion.suggestion_only && im.ai_suggestion.tool === "api/scan.js (kind: classify)");
  assert.ok(r9.preview.warnings.some((w) => w.code === "AI_SUGGESTION"));
  const h9b = harness([{ name: "IMG_0001.png", data: F.makePng(80, 80) }], { ai: false });
  assert.ok(!(await runAll(h9b)).r.preview.files[0].ai_suggestion, "без AI – детерминистично");
  done("AI (api/scan.js classify): само предложение с увереност; детерминистичният резултат не зависи от него");

  /* 10. 3000 обекта: в лимита на една чернова; над него се изключват честно */
  let csv = "Обект;Вход;Етаж;Обща площ;Цена на кв.м\n"; for (let k = 0; k < 3001; k++) csv += "TEST-" + k + ";А;" + (k % 20) + ";" + (50 + (k % 30)) + ";2000\n";
  const h10 = harness([{ name: "u.csv", data: Buffer.from(csv) }]);
  const t0 = Date.now(); const { r: r10 } = await runAll(h10); const ms = Date.now() - t0;
  assert.strictEqual(r10.preview.units.length, 3001); assert.strictEqual(r10.preview.units.filter((u) => u.include).length, 3000);
  assert.ok(r10.preview.warnings.some((w) => w.code === "LIMIT"));
  assert.ok(ms < 15000, "анализ на 3001 реда: " + ms + " ms");
  done("3001 реда: анализът е " + ms + " ms; над 3000 обекта в една чернова се изключват с предупреждение");

  console.log("\n" + n + "/" + n + " минали");
})().catch((e) => { console.error(e); process.exit(1); });
