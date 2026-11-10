// Тест на чистите функции за CAD/BIM и 3D модели (TASK-009): формат по съдържание, подпис на изпълнителя, проверка на публичния GLB,
// почистване на отчетите, ключове за повторяемост, договори. Без мрежа и без база.   node api/_nc-cad.test.js
"use strict";
const assert = require("assert");
const fs = require("fs"), path = require("path");
const L = require("./_nc-cad-lib.js"), C = require("./_nc-contracts.js"), F = require("./_nc-cad-fixtures.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("PASS  " + name); };
const P = "0123456789abcdef0123456789abcdef", P2 = "fedcba9876543210fedcba9876543210";

t("формат по СЪДЪРЖАНИЕ, не по име: IFC (схема), DXF (текстов, с коментар, двоичен), DWG (версия), PDF, GLB, glTF", () => {
  const s = (k, name) => L.sniff(F.HEADS[k], name);
  assert.deepStrictEqual([s("ifc").format, s("ifc").version, s("ifc").convert], ["ifc", "IFC4", "yes"]);
  assert.strictEqual(s("ifc2x3").version, "IFC2X3");
  assert.deepStrictEqual([s("dxf").format, s("dxf").version], ["dxf", "AC1032"]);
  assert.strictEqual(s("dxfComment").format, "dxf"); assert.strictEqual(s("dxfBinary").version, "binary");
  assert.deepStrictEqual([s("dwg2018").format, s("dwg2018").version, s("dwg2018").convert], ["dwg", "AutoCAD 2018 (AC1032)", "maybe"]);
  assert.strictEqual(s("dwg2000").version, "AutoCAD 2000 (AC1015)"); assert.strictEqual(s("dwgUnknown").version, "AC1099");
  assert.deepStrictEqual([s("pdf").format, s("pdf").version, s("pdf").inspect, s("pdf").convert], ["pdf", "1.7", true, "no"]);
  assert.ok(/не съдържа височини/.test(s("pdf").reason_bg));
  const g = L.sniff(F.testModel()); assert.deepStrictEqual([g.format, g.version, g.convert], ["glb", "2.0", "yes"]);
  assert.strictEqual(L.sniff(F.glb([{ name: "a", box: [0, 0, 0, 1, 1, 1] }], { version: 1 })).inspect, false, "GLB версия 1 се отказва");
  assert.strictEqual(s("gltf").format, "gltf");
  // името лъже: файл „plan.ifc“, който е PDF, е PDF; „model.glb“, който е DWG, е DWG
  assert.strictEqual(L.sniff(F.HEADS.pdf, "plan.ifc").format, "pdf"); assert.strictEqual(L.sniff(F.HEADS.dwg2018, "model.glb").format, "dwg");
});

t("неподдържано и повредено → изричен отказ с причина: снимка, архив, IFC-XML, изпълним файл, празен файл", () => {
  for (const k of ["jpeg", "png", "zip", "ifcxml", "exe", "empty"]) { const r = L.sniff(F.HEADS[k], "x." + k); assert.strictEqual(r.inspect, false, k); assert.ok(r.reason_bg && r.reason_bg.length > 10, k + " има причина"); }
  assert.ok(/само за справка/.test(L.sniff(F.HEADS.jpeg).reason_bg), "снимката не става модел");
  assert.strictEqual(L.sniff(F.HEADS.zip, "TEST.ifczip").format, "ifczip"); assert.strictEqual(L.sniff(F.HEADS.zip, "TEST.zip").format, "zip");
  assert.strictEqual(L.sniff(F.HEADS.ifcxml).format, "ifcxml");
});

t("подпис на изпълнителя (HMAC): верен минава; друга тайна, друго действие, променено тяло, стар час, лош формат → отказ", () => {
  const S = "TEST-SECRET-0123456789-abcdefghij", now = 1800000000, body = '{"job_id":"x"}';
  const sig = L.sign(S, now, "claim", body);
  assert.ok(/^v1=[a-f0-9]{64}$/.test(sig));
  assert.deepStrictEqual(L.verify(S, String(now), "claim", body, sig, now), { ok: true });
  assert.strictEqual(L.verify(S, String(now), "claim", body, sig, now + 299).ok, true);
  assert.strictEqual(L.verify(S, String(now), "claim", body, sig, now + 301).reason, "stale_timestamp");
  assert.strictEqual(L.verify(S, String(now), "claim", body, sig, now - 301).reason, "stale_timestamp");
  assert.strictEqual(L.verify(S + "x", String(now), "claim", body, sig, now).reason, "bad_signature");
  assert.strictEqual(L.verify(S, String(now), "finish", body, sig, now).reason, "bad_signature", "подпис за claim не важи за finish");
  assert.strictEqual(L.verify(S, String(now), "claim", body + " ", sig, now).reason, "bad_signature");
  assert.strictEqual(L.verify(S, String(now + 1), "claim", body, sig, now).reason, "bad_signature", "часът е част от подписа");
  assert.strictEqual(L.verify(S, "abc", "claim", body, sig, now).reason, "bad_timestamp");
  assert.strictEqual(L.verify(S, String(now), "claim", body, "v1=zz", now).reason, "bad_signature");
  assert.strictEqual(L.verify(S, String(now), "claim", body, undefined, now).reason, "bad_signature");
  assert.strictEqual(L.verify("", String(now), "claim", body, sig, now).reason, "not_configured");
  assert.strictEqual(L.verify("short", String(now), "claim", body, L.sign("short", now, "claim", body), now).reason, "not_configured", "къса тайна не се приема");
});

t("публичен GLB: валиден файл минава; размери, триъгълници, свързани етажи и обекти се смятат от самия файл", () => {
  const v = L.validateGlb(F.testModel());
  assert.deepStrictEqual(v.errors, []); assert.strictEqual(v.ok, true);
  assert.strictEqual(v.stats.triangles, 48); assert.strictEqual(v.stats.vertices, 32); assert.strictEqual(v.stats.nodes, 5);
  assert.deepStrictEqual(v.stats.bbox, { min: [-6, 0, -4], max: [6, 6, 4], size: [12, 6, 8] });
  assert.strictEqual(v.stats.units_mapped, 2); assert.strictEqual(v.stats.floors_mapped, 2);
  // матриците на възлите влизат в размерите (мащаб ×2 и преместване)
  const moved = L.validateGlb(F.testModel(null, { mutate: (g) => { g.nodes[0].scale = [2, 2, 2]; g.nodes[0].translation = [10, 0, 0]; } }));
  assert.deepStrictEqual(moved.stats.bbox.size, [24, 12, 16]); assert.deepStrictEqual(moved.stats.bbox.min, [-2, 0, -8]);
});

t("публичен GLB: повреден файл пада безопасно – отрязан, дописан, грешен подпис, лош JSON, индекс извън върховете, данни извън файла", () => {
  const ok = F.testModel();
  const bad = (buf, re) => { const v = L.validateGlb(buf); assert.strictEqual(v.ok, false); assert.ok(re.test(v.errors.join("; ")), v.errors.join("; ")); };
  bad(ok.subarray(0, ok.length - 40), /дължината в заглавието/); bad(Buffer.concat([ok, Buffer.from("TEST")]), /дължината в заглавието/);
  bad(Buffer.concat([Buffer.from("XXXX"), ok.subarray(4)]), /подписът glTF/); bad(Buffer.alloc(10), /твърде къс/); bad(Buffer.alloc(0), /твърде къс/);
  const j = Buffer.from(ok); j.write("{{{{", 20); bad(j, /JSON парчето не се чете/);
  bad(F.testModel(null, { mutate: (g) => { g.accessors[1].count = 3; g.accessors[0].count = 2; } }), /индекс извън върховете/);
  bad(F.testModel(null, { mutate: (g) => { g.bufferViews[0].byteLength = 99999; } }), /излиза извън файла/);
  bad(F.testModel(null, { mutate: (g) => { g.meshes = []; g.nodes.forEach((x) => delete x.mesh); } }), /няма триъгълници/);
  bad(F.glb([{ name: "a", box: [0, 0, 0, 1, 1, 1] }], { version: 3 }), /само glTF 2\.0/);
  assert.strictEqual(L.validateGlb("не е буфер").ok, false);
});

t("публичен GLB: компресиращи разширения се отказват изрично (прегледът няма декодери); позволените минават", () => {
  for (const [ext, bg] of [["KHR_draco_mesh_compression", "Draco"], ["EXT_meshopt_compression", "Meshopt"], ["KHR_texture_basisu", "KTX2"]]) {
    const v = L.validateGlb(F.testModel(null, { mutate: (g) => { g.extensionsUsed = [ext]; g.extensionsRequired = [ext]; } }));
    assert.strictEqual(v.ok, false); assert.ok(v.errors.some((e) => e.includes(ext) && e.includes(bg)), ext);
  }
  assert.strictEqual(L.validateGlb(F.testModel(null, { mutate: (g) => { g.extensionsUsed = ["KHR_materials_unlit"]; } })).ok, true);
  assert.strictEqual(L.validateGlb(F.testModel(null, { mutate: (g) => { g.extensionsUsed = ["TEST_unknown_ext"]; } })).ok, false);
});

t("публичен GLB: липсваща текстура / външен файл се открива; вградена текстура се измерва (памет)", () => {
  const ext = L.validateGlb(F.testModel(null, { mutate: (g) => { g.images = [{ uri: "textures/TEST-missing.png" }]; } }));
  assert.ok(ext.errors.some((e) => /външен файл – липсваща текстура/.test(e)));
  const buf = L.validateGlb(F.testModel(null, { mutate: (g) => { g.buffers[0].uri = "TEST.bin"; } }));
  assert.ok(buf.errors.some((e) => /липсваща външна препратка/.test(e)));
  // 1×1 PNG заглавие, обявено като 2048×1024, вградено в двоичната част
  const png = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]).copy(png); png.writeUInt32BE(2048, 16); png.writeUInt32BE(1024, 20);
  assert.deepStrictEqual(L.imageSize(png), { w: 2048, h: 1024, mime: "image/png" });
});

t("публичен GLB: лични и чужди метаданни не минават – автор, генератор, extras, камери, пътища, имейл, непозволени имена", () => {
  const bad = (mutate, re) => { const v = L.validateGlb(F.testModel(null, { mutate })); assert.strictEqual(v.ok, false, String(re)); assert.ok(re.test(v.errors.join("; ")), v.errors.join("; ")); };
  bad((g) => { g.asset.copyright = "TEST-COPYRIGHT"; }, /авторски надпис/);
  bad((g) => { g.asset.generator = "TEST-Exporter 1.0"; }, /не е минал през оптимизатора/);
  bad((g) => { g.nodes[1].extras.source_file = "x"; }, /extras\) извън позволените/);
  bad((g) => { g.meshes[0].extras = { ElementId: 5 }; }, /extras\) извън позволените/);
  bad((g) => { g.extras = { author: "TEST" }; }, /extras\) извън позволените/);
  bad((g) => { g.cameras = [{ type: "perspective", perspective: { yfov: 1, znear: 1 } }]; }, /камери/);
  bad((g) => { g.materials[0].name = "C:\\Users\\test\\wall.mat"; }, /непозволени знаци|път към файл/);
  bad((g) => { g.nodes[1].name = "test@example.invalid"; }, /непозволени знаци|имейл/);
  bad((g) => { g.scenes[0].name = "https://example.invalid/x"; }, /непозволени знаци|адрес/);
  // без строгия режим същият файл е структурно валиден (за сравнение)
  assert.strictEqual(L.validateGlb(F.testModel(null, { mutate: (g) => { g.asset.copyright = "TEST"; } }), { strict: false }).ok, true);
});

t("публичен GLB: възел може да сочи само към обект/етаж от СЪЩАТА сграда", () => {
  const ids = { unitIds: new Set(["testunit101000000000000000000000", "testunit201000000000000000000000"]), floorIds: new Set(["testfloor00000000000000000000001", "testfloor00000000000000000000002"]) };
  assert.strictEqual(L.validateGlb(F.testModel(), ids).ok, true);
  const v = L.validateGlb(F.testModel({ u1: "чуждобект0000000000000000000000".replace(/[^a-z0-9]/g, "x") }), ids);
  assert.ok(v.errors.some((e) => /обект, който не е от тази сграда/.test(e)));
  assert.ok(L.validateGlb(F.testModel({ f2: "otherfloor0000000000000000000002" }), ids).errors.some((e) => /етаж, който не е от тази сграда/.test(e)));
});

t("публичен GLB: лимити – размер, триъгълници, възли", () => {
  assert.ok(L.validateGlb(F.testModel(), { maxBytes: 100 }).errors[0].includes("над"));
  const many = L.validateGlb(F.testModel(null, { mutate: (g) => { g.accessors[1].count = (L.LIMITS.triangles + 1) * 3; } }));
  assert.ok(many.errors.some((e) => /твърде много триъгълници/.test(e)));
});

t("истински файл от изпълнителя (IFC → GLB, служебна TEST сграда) минава строгата проверка на сървъра", () => {
  const p = path.join(__dirname, "_nc-cad-fixtures", "TEST-ifc-building.glb");
  assert.ok(fs.existsSync(p), "липсва " + p);
  const v = L.validateGlb(fs.readFileSync(p), { strict: true });
  assert.deepStrictEqual(v.errors, []);
  assert.strictEqual(v.stats.units_mapped, 6); assert.strictEqual(v.stats.floors_mapped, 3); assert.strictEqual(v.stats.triangles, 480);
  const s = v.stats.bbox.size.slice().sort((a, b) => a - b);
  assert.ok(Math.abs(s[0] - 9.25) < 0.002, "височина 9.25 m (Y нагоре): " + s[0]);
  assert.deepStrictEqual(v.stats.extensions, []); assert.strictEqual(v.stats.texture_gpu_bytes_est, 0);
});

t("отчетите се чистят преди базата: пътища → само име, имейл → скрит, забранени и лични ключове отпадат, дълбочина и размер са ограничени", () => {
  assert.strictEqual(L.scrub("C:\\Users\\ivan\\Desktop\\TEST.dwg"), "TEST.dwg");
  assert.strictEqual(L.scrub("/home/ivan/work/TEST.ifc и \\\\server\\share\\dir\\TEST2.ifc"), "TEST.ifc и TEST2.ifc");
  assert.strictEqual(L.scrub("от test.user@example.invalid"), "от [имейл]");
  const r = L.cleanReport({ format: "ifc", author: "TEST", Organization: "TEST", path: "/x/y", investor: "X", "строител": "Y", contractor_name: "Z", nested: { url: "https://x", ok: 1, inf: Infinity, deep: { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } } },
    list: Array.from({ length: 500 }, (_, i) => i), text: "я".repeat(1000), name: "C:\\TEST\\a.ifc" });
  assert.deepStrictEqual(Object.keys(r).sort(), ["format", "list", "name", "nested", "text"]);
  assert.strictEqual(r.list.length, 300); assert.strictEqual(r.text.length, 400); assert.strictEqual(r.name, "a.ifc"); assert.strictEqual(r.nested.inf, null); assert.strictEqual(r.nested.url, undefined);
  assert.ok(C.FORBIDDEN_KEYS.test("investor") && !("investor" in r));
  const big = L.fitJson({ status: "EXACT", huge: "x".repeat(5000) }, 1000, ["status"]); assert.deepStrictEqual(big, { status: "EXACT", truncated: true });
  assert.deepStrictEqual(L.fitJson({ a: 1 }, 1000, []), { a: 1 });
});

t("ключ за повторяемост: същият файл → същата задача; друг mapping → друга; ключът минава правилото на базата", () => {
  const sha = "a".repeat(64), re = /^[A-Za-z0-9:._-]{8,200}$/;
  assert.strictEqual(L.inspectKey(P, sha), "cad_inspect:" + P + ":" + sha);
  assert.strictEqual(L.inspectKey(P, sha, 2), "cad_inspect:" + P + ":" + sha + ":r2");
  const a = L.convertKey(P, sha, {}), b = L.convertKey(P, sha, { units: [{ code: "TEST-101", refs: ["x"] }] }), b2 = L.convertKey(P, sha, { units: [{ refs: ["x"], code: "TEST-101" }] });
  assert.strictEqual(a, "cad_convert:" + P + ":" + sha); assert.notStrictEqual(a, b); assert.strictEqual(b, b2, "редът на ключовете не променя ключа");
  assert.strictEqual(L.convertKey(P, sha, { units: [], storeys: [] }), a, "празен mapping = без mapping");
  [a, b, L.convertKey(P, sha, { units: [{ code: "x", refs: ["y"] }] }, 3), L.inspectKey(P, sha, 12)].forEach((k) => assert.ok(re.test(k) && k.length <= 200, k));
});

t("договори: 5 инструмента на TASK-009; пътят е само в папката на СЪЩИЯ проект; потвърждение за публикуване; mapping без повторения", () => {
  const sp = (k, i) => C.CONTRACTS[k].input.safeParse(i);
  ["cad.inspect", "models.request", "models.publish", "models.unpublish", "models.get"].forEach((k) => { assert.ok(C.CONTRACTS[k], k); assert.ok(C.CONTRACTS[k].description.length > 60); });
  assert.deepStrictEqual(["cad.inspect", "models.request", "models.publish", "models.unpublish"].map((k) => C.CONTRACTS[k].role), ["admin", "admin", "admin", "admin"]);
  const cad = "projects/" + P + "/private/cad/TEST.ifc";
  assert.ok(sp("cad.inspect", { project_id: P, path: cad }).success);
  assert.ok(sp("cad.inspect", { project_id: P, path: "projects/" + P + "/private/imports/abcdef0123456789/TEST.dxf", rerun: true }).success);
  for (const bad of ["projects/" + P2 + "/private/cad/TEST.ifc", "projects/" + P + "/public/TEST.glb", "projects/" + P + "/private/derived/models/x/a.glb", "projects/" + P + "/private/tours/a.jpg",
    "projects/" + P + "/private/cad/../../x", "projects/" + P + "/private/cad/a%2e%2e/b", "ted-chat/TEST.ifc", "/etc/passwd", "projects/" + P + "/private/cad/a\\b"])
    assert.ok(!sp("cad.inspect", { project_id: P, path: bad }).success, "трябва да се откаже: " + bad);
  assert.ok(!sp("models.request", { project_id: P, building_id: P, path: "projects/" + P2 + "/private/cad/TEST.ifc" }).success);
  assert.ok(sp("models.request", { project_id: P, building_id: P, path: cad, mapping: { storeys: [{ ref: "Етаж 1", level: 1 }], units: [{ code: "TEST-101", refs: ["2O2Fr$t4X7Zf8NOew3FLOH"] }], control: [{ label: "дължина", axis: "length", meters: 12 }] } }).success);
  assert.ok(!sp("models.request", { project_id: P, building_id: P, path: cad, mapping: { units: [{ code: "TEST-101", refs: ["a"] }, { code: "test 101", refs: ["b"] }] } }).success, "един код два пъти");
  assert.ok(!sp("models.request", { project_id: P, building_id: P, path: cad, mapping: { control: [{ label: "x", axis: "diagonal", meters: 5 }] } }).success);
  assert.ok(!sp("models.request", { project_id: P, building_id: P, path: cad, mapping: { control: [{ label: "x", axis: "length", meters: 0 }] } }).success);
  assert.ok(!sp("models.request", { project_id: P, building_id: P, path: cad, mapping: { units: [{ code: "TEST-101", refs: ["a"], investor: "x" }] } }).success, "забранен ключ вложено");
  const J = "00000000-0000-4000-8000-0000000000aa";
  assert.ok(sp("models.publish", { job_id: J, building_id: P, confirm: true, expected_published_version: 0, rollback: false }).success);
  assert.ok(!sp("models.publish", { job_id: J, building_id: P }).success, "без потвърждение");
  assert.ok(!sp("models.publish", { job_id: "x", building_id: P, confirm: true }).success);
  assert.ok(!sp("models.unpublish", { building_id: P, confirm: true }).success, "без очаквана версия");
  assert.ok(sp("models.get", { building_id: P, version: 2, preview: true }).success);
});

t("лимитите са определени на едно място и са последователни (вход, изход, време, пулс, подписани адреси)", () => {
  const X = L.LIMITS;
  ["ifc", "ifczip", "dxf", "dwg", "glb", "gltf", "pdf"].forEach((k) => assert.ok(X.inputBytes[k] > 0 && X.inputBytes[k] <= 150 * L.MB, k));
  assert.strictEqual(X.glbOutBytes, 67108864, "= ограничението в nd_models.glb_bytes");
  assert.ok(X.publicTtlSec === 60 && X.previewTtlSec === 60 && X.sourceTtlSec <= 600 && X.callbackSkewSec === 300 && X.heartbeatSec < 180 / 2);
  assert.ok(X.convertMinutes * 60 <= 3600 && X.inspectMinutes * 60 <= 900, "под прага за „спрял изпълнител“ на вида задача (nd_job_kinds.stale_secs)");
  Object.keys(L.ERR).forEach((k) => assert.ok(/[а-я]/i.test(L.ERR[k]), k));
});

console.log("\n" + n + "/" + n + " минали");
