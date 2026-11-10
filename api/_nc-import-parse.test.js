// Тест: таблици (XLSX/ODS/CSV), разпознаване по съдържание и нормализиране (TASK-006). Чист node + assert, без мрежа.
//   node api/_nc-import-parse.test.js
"use strict";
const assert = require("assert");
const S = require("./_nc-import-sheet.js"), D = require("./_nc-import-detect.js"), N = require("./_nc-import-norm.js"), F = require("./_nc-import-fixtures.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("PASS  " + name); };

t("XLSX (ZIP + XML): споделени и вградени низове, числа, формула с/без записана стойност, адрес на всяка клетка; два листа", () => {
  const x = F.makeXlsx([{ name: "Обекти", rows: [["Обект", "Етаж", "Обща площ"], ["TEST-A1", 1, 102.7], ["TEST-A2", { f: "B2+1", v: 2 }, { f: "C2*2" }], ["A&B <x>", "", ""]] }, { name: "Втори", rows: [["TEST"]] }], { absTarget: true });
  const r = S.readXlsx(x);
  assert.ok(r.ok); assert.strictEqual(r.sheets.length, 2); assert.strictEqual(r.sheets[0].name, "Обекти"); assert.strictEqual(r.sheets[1].rows[0][0].v, "TEST", "абсолютен Target");
  const rows = r.sheets[0].rows;
  assert.deepStrictEqual([rows[0][0].v, rows[0][0].ref], ["Обект", "A1"]);
  assert.deepStrictEqual([rows[1][2].v, rows[1][2].t, rows[1][2].ref], [102.7, "n", "C2"]);
  assert.strictEqual(rows[2][1].v, 2, "формула – записаната стойност");
  assert.strictEqual(rows[2][2].t, "f0", "формула без стойност → отбелязана, не пресметната");
  assert.strictEqual(rows[3][0].v, "A&B <x>", "XML същности");
});

t("XLSX: макроси се отбелязват (не се изпълняват); повреден XLSX → ясна грешка", () => {
  const files = [{ name: "xl/workbook.xml", data: '<workbook><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>' }, { name: "xl/_rels/workbook.xml.rels", data: '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>' },
    { name: "xl/worksheets/sheet1.xml", data: '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row></sheetData></worksheet>' }, { name: "xl/vbaProject.bin", data: "TEST" }];
  const r = S.readXlsx(F.makeZip(files)); assert.ok(r.ok && r.issues.some((i) => i.code === "macro"));
  assert.strictEqual(S.readXlsx(F.makeZip([{ name: "x.txt", data: "x" }])).ok, false);
});

t("ODS: стойности и адреси; повторени празни редове/колони (1 048 000 × 1024) не се разгъват", () => {
  const r = S.readOds(F.makeOds([{ name: "Лист1", rows: [["Апартамент", "Етаж", "Чиста площ"], ["TEST-B1", 2, 64.5]] }]));
  assert.ok(r.ok); const rows = r.sheets[0].rows;
  assert.deepStrictEqual([rows[1][0].v, rows[1][2].v, rows[1][2].ref], ["TEST-B1", 64.5, "C2"]);
  assert.ok(rows.length < 10, "празните повторения не се разгъват");
});

t("CSV: UTF-8 с BOM, Windows-1251, разделител „;“/„,“/таб, кавички с „;“ вътре", () => {
  const a = S.readCsv(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Обект;Цена на кв.м\r\n"TEST;A1";"2 100,50"\r\n')]), "a.csv");
  assert.strictEqual(a.sheets[0].rows[1][0].v, "TEST;A1"); assert.strictEqual(a.sheets[0].rows[1][1].ref, "B2"); assert.strictEqual(a.delimiter, ";");
  const cp = Buffer.from([0xce, 0xe1, 0xe5, 0xea, 0xf2, 0x2c, 0xc5, 0xf2, 0xe0, 0xe6, 0x0a, 0x41, 0x31, 0x2c, 0x33]);   // „Обект,Етаж\nA1,3“ в cp1251
  const b = S.readCsv(cp, "b.csv"); assert.strictEqual(b.encoding, "windows-1251"); assert.strictEqual(b.sheets[0].rows[0][1].v, "Етаж"); assert.strictEqual(b.delimiter, ",");
  const c = S.readCsv(Buffer.from("Обект\tЕтаж\nTEST\t1\n"), "c.tsv"); assert.strictEqual(c.delimiter, "\t");
});

t("разпознаване по СЪДЪРЖАНИЕ: сигнатури; разширение ≠ съдържание → отказ; изпълним/скрипт/HTML → карантина; SVG/непознат → само се пази", () => {
  const pdf = F.makePdf("vector");
  assert.strictEqual(D.sniff(pdf, "a.pdf").type, "pdf");
  const fake = D.sniff(pdf, "снимка.jpg"); assert.ok(fake.rejected && /не съответства/.test(fake.reason), "PDF с разширение .jpg");
  assert.strictEqual(D.sniff(F.makePng(10, 10), "x.png").type, "png");
  assert.strictEqual(D.sniff(F.makeJpeg(16, 16), "x.jpeg").type, "jpeg");
  assert.strictEqual(D.sniff(F.makeXlsx([{ name: "A", rows: [["x"]] }]), "x.xlsx").type, "xlsx");
  assert.ok(D.sniff(F.makeXlsx([{ name: "A", rows: [["x"]] }]), "x.zip").rejected, "XLSX с разширение .zip");
  assert.strictEqual(D.sniff(F.makeOds([{ name: "A", rows: [["x"]] }]), "x.ods").type, "ods");
  assert.strictEqual(D.sniff(F.DWG, "m.dwg").type, "dwg");
  assert.strictEqual(D.sniff(Buffer.from(F.DXF), "m.dxf").type, "dxf");
  assert.strictEqual(D.sniff(Buffer.from(F.IFC), "m.ifc").type, "ifc");
  assert.strictEqual(D.sniff(F.makeGlb(), "m.glb").type, "glb");
  for (const [b, nm] of [[Buffer.from("MZ\x90\0\x03"), "setup.pdf"], [Buffer.from("#!/bin/sh\nrm -rf /\n"), "run.txt"], [Buffer.from("<!doctype html><script>x</script>"), "a.html"]]) assert.ok(D.sniff(b, nm).rejected, nm);
  assert.ok(D.sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), "a.svg").unsupported);
  assert.ok(D.sniff(Buffer.from([1, 2, 3, 0, 5, 6, 7, 8, 9, 10]), "a.xyz").unsupported);
  assert.ok(D.sniff(Buffer.alloc(0), "a.pdf").rejected, "празен файл");
});

t("PDF: векторен срещу сканиран; криптиран → само се пази; брой страници", () => {
  const v = D.pdfInfo(F.makePdf("vector")); assert.strictEqual(v.kind, "vector"); assert.ok(v.path_ops >= 20 && v.text_ops >= 1 && v.pages === 1);
  const s = D.pdfInfo(F.makePdf("scan")); assert.strictEqual(s.kind, "scan"); assert.strictEqual(s.text_ops, 0); assert.ok(s.images >= 1);
  assert.strictEqual(D.pdfInfo(F.makePdf("vector", { encrypt: true })).kind, "encrypted");
  assert.strictEqual(D.pdfInfo(F.makePdf("vector", { deflate: false })).kind, "vector", "некомпресиран поток");
});

t("изображения: размери без измислени факти; CAD/BIM/GLB: само основен преглед (версия, единици, брой етажи) за TASK-009", () => {
  assert.deepStrictEqual(D.imageInfo(F.makePng(120, 90), "png"), { w: 120, h: 90 });
  const j = D.imageInfo(F.makeJpeg(160, 90), "jpeg"); assert.strictEqual(j.w, 160); assert.strictEqual(j.h, 90);
  const dx = D.dxfInfo(Buffer.from(F.DXF)); assert.strictEqual(dx.acadver, "AC1027"); assert.strictEqual(dx.units, "мм"); assert.strictEqual(dx.layers, 2);
  const ifc = D.ifcInfo(Buffer.from(F.IFC)); assert.deepStrictEqual([ifc.schema, ifc.buildings, ifc.storeys, ifc.spaces], ["IFC4", 1, 2, 1]);
  const g = D.glbInfo(F.makeGlb()); assert.ok(g.valid); assert.strictEqual(g.version, "2.0");
  const g2 = D.glbInfo(F.makeGlb("../../secret.bin")); assert.ok(!g2.valid && g2.unsafe_dependencies.length === 1, "опасна външна зависимост");
  assert.deepStrictEqual(D.CAPS.dwg, ["store", "inspect", "downstream_cad"]); assert.ok(!D.CAPS.dwg.includes("extract"), "без фалшиво извличане");
});

t("класификация: папка + име + съдържание, с увереност и доказателства; непознатото е „Неразпознат“", () => {
  const xl = D.classify("P/unit-data/x.xlsx", { type: "xlsx" }, { sheet: { units: 5, fields: 4 } });
  assert.strictEqual(xl.purpose, "unit_inventory"); assert.ok(xl.confidence >= 0.9 && xl.evidence.length);
  assert.strictEqual(D.classify("P/floor-plans/etazh-3.pdf", { type: "pdf" }, {}).purpose, "floor_plan");
  assert.strictEqual(D.classify("Разпределение A1.png", { type: "png" }, {}).purpose, "unit_plan");
  assert.strictEqual(D.classify("P/source-model/m.ifc", { type: "ifc" }, {}).purpose, "source_model");
  const u = D.classify("IMG_0001.jpg", { type: "jpeg" }, {}); assert.strictEqual(u.purpose, "unknown"); assert.ok(u.confidence < 0.5);
});

t("JSON за проекта: само по схема nd-project-info/1; инвеститор/строител се пропускат; друг JSON не се ползва", () => {
  const ok = D.projectJson(Buffer.from(JSON.stringify({ schema: "nd-project-info/1", title: "TEST", city: "TEST-Град", builder: "X", Инвеститор: "Y", extra: 1, stage_percent: 140 })));
  assert.ok(ok.ok); assert.deepStrictEqual(ok.fields, { title: "TEST", city: "TEST-Град" }); assert.deepStrictEqual(ok.forbidden.sort(), ["builder", "Инвеститор"].sort()); assert.ok(ok.ignored.includes("stage_percent"));
  assert.strictEqual(D.projectJson(Buffer.from('{"title":"x"}')).ok, false);
  assert.strictEqual(D.projectJson(Buffer.from("not json")), null);
});

t("числа: десетична запетая, хиляди с интервал/точка, „м²“, „€“; двусмислено („2,100“, „2.100“) → null + причина; ≤0 → отказ", () => {
  const v = (s, k) => N.parseNumber(s, k || "area").value;
  assert.strictEqual(v("102,70"), 102.7); assert.strictEqual(v("102.70 м²"), 102.7); assert.strictEqual(v("88,10 кв.м"), 88.1);
  assert.strictEqual(v("2 100 €", "money"), 2100); assert.strictEqual(v("1.234,56", "money"), 1234.56); assert.strictEqual(v("1,234.56", "money"), 1234.56); assert.strictEqual(v("2 050,00", "money"), 2050);
  for (const s of ["2,100", "2.100", "12 34", "abc", "1,2,3"]) { const r = N.parseNumber(s, "money"); assert.strictEqual(r.value, null, s); assert.ok(r.issue, s); }
  for (const s of ["0", "-5", "-0,5"]) { const r = N.parseNumber(s, "area"); assert.strictEqual(r.value, null, s); assert.ok(/нулева|отрицателна/.test(r.issue), s); }
  assert.strictEqual(N.parseNumber(102.69999999999999, "area", "n").value, 102.7, "артефакт на плаваща запетая");
  assert.strictEqual(N.parseNumber("2 100 лв.", "money").currency, "BGN");
  assert.strictEqual(N.parseNumber("3", "int").value, 3); assert.strictEqual(N.parseNumber("2.5", "int").value, null);
});

t("валута: EUR без промяна; BGN → EUR по фиксирания курс като ИЗВЕДЕНА стойност с правило; друга валута → null", () => {
  assert.deepStrictEqual(N.toEur(2100, "EUR"), { value: 2100 });
  const b = N.toEur(3911.66, "BGN"); assert.strictEqual(b.value, 2000); assert.ok(b.derived && /1\.95583/.test(b.rule));
  assert.strictEqual(N.toEur(2000, "USD").value, null);
});

t("етажи: „Партер“→0, „сутерен“→-1, „2-ри“, „ет. 3“, „III“; „мансарда“, „1-2“, „гараж“ → null + причина", () => {
  const f = (s) => N.parseFloor(s).value;
  assert.strictEqual(f("Партер"), 0); assert.strictEqual(f("сутерен"), -1); assert.strictEqual(f("2-ри"), 2); assert.strictEqual(f("ет. 3"), 3); assert.strictEqual(f("III"), 3); assert.strictEqual(f("Етаж 12"), 12); assert.strictEqual(f(4), 4);
  for (const s of ["мансарда", "1-2", "гараж", "7.5", 7.5, "201"]) { assert.strictEqual(f(s), null, String(s)); }
});

t("кодове: почистване без промяна на смисъла; ключ за сравнение (кирилица/латиница, тирета) открива дубликати; запазени думи → отказ", () => {
  assert.deepStrictEqual(N.parseCode("  TEST-A1 "), { code: "TEST-A1", key: "TESTA1" });
  assert.strictEqual(N.parseCode("А-1").key, N.parseCode("A 1").key, "кирилско А = латинско A, тире = интервал");
  assert.strictEqual(N.parseCode("№ 5").code, "5");
  assert.ok(N.parseCode("public").issue); assert.ok(N.parseCode("x".repeat(21)).issue); assert.ok(N.parseCode("A/1").issue); assert.ok(N.parseCode(1.5).issue);
});

t("заглавия: BG/EN варианти; „Площ“ и „Застроена площ“ са двусмислени (не се внасят); инвеститор/строител → забранени; цена/кв.м ≠ обща цена", () => {
  const h = (s) => (N.headerField(s) || {}).field;
  assert.strictEqual(h("Обект"), "code"); assert.strictEqual(h("Ап. №"), "code"); assert.strictEqual(h("Етаж"), "floor"); assert.strictEqual(h("Обща площ (м²)"), "area_total"); assert.strictEqual(h("Чиста площ"), "area_net");
  assert.strictEqual(h("Тераса"), "terrace_area"); assert.strictEqual(h("Стаи"), "rooms"); assert.strictEqual(h("Спални"), "beds"); assert.strictEqual(h("Бани"), "baths"); assert.strictEqual(h("Изложение"), "exposure");
  assert.strictEqual(h("Цена на кв.м"), "price_per_m2"); assert.strictEqual(h("€/м²"), "price_per_m2"); assert.strictEqual(h("Price per m2"), "price_per_m2"); assert.strictEqual(h("Цена"), "price_total_src"); assert.strictEqual(h("Обща цена"), "price_total_src");
  assert.strictEqual(h("Площ"), "ambiguous"); assert.strictEqual(h("Застроена площ"), "ambiguous"); assert.strictEqual(h("Статус"), "status_src");
  for (const s of ["Инвеститор", "Строител", "Изпълнител", "Строителна фирма", "Investor", "Developer"]) assert.strictEqual(h(s), "forbidden", s);
  assert.strictEqual(N.headerField("Цена (лв./кв.м)").currency, "BGN");
});

t("изложение и етап: стандартни стойности; непознато изложение се пази както е; непознат етап → null", () => {
  assert.strictEqual(N.parseExposure("ю-и").value, "Юг-Изток"); assert.strictEqual(N.parseExposure("SW").value, "Юг-Запад"); assert.strictEqual(N.parseExposure("към парка").value, "към парка");
  assert.strictEqual(N.parseStage("Акт 14").value, "act14"); assert.strictEqual(N.parseStage("груб строеж").value, "rough"); assert.strictEqual(N.parseStage("нещо").value, null);
  assert.strictEqual(N.roomsFromType("Тристаен").value, 3); assert.strictEqual(N.roomsFromType("Мезонет").value, null);
});

t("таблица → обекти: заглавният ред се намира и под заглавие; непознати/забранени/двусмислени колони се изброяват; данни за проекта „поле → стойност“", () => {
  const x = S.readXlsx(F.testPackage()[0].data).sheets[0];
  const u = N.tableToUnits(x);
  assert.strictEqual(u.kind, "units"); assert.strictEqual(u.header.row, 3); assert.strictEqual(u.rows.length, 7);
  assert.strictEqual(u.header.extra.forbidden[0].header, "Инвеститор");
  assert.strictEqual(u.rows[0].cells.code.raw, "TEST-A1"); assert.strictEqual(u.rows[0].cells.area_total.ref, "D4");
  const p = N.tableToUnits({ name: "Проект", rows: [[{ v: "Име на проекта", ref: "A1" }, { v: "TEST", ref: "B1" }], [{ v: "Град", ref: "A2" }, { v: "TEST-Град", ref: "B2" }]] });
  assert.strictEqual(p.kind, "project"); assert.strictEqual(p.project.city.ref, "B2");
});

console.log("\n" + n + "/" + n + " минали");
