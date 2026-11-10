// Тест на модул „Ново строителство“ (чист node + assert, без мрежа).  node api/_nc-tools.test.js
"use strict";
const assert = require("assert");
const N = require("./_nc-tools.js"), C = require("./_nc-contracts.js");
const JPEG = require("./_vendor/jpeg-js"), { PNG } = require("./_vendor/pngjs/lib/png.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("PASS  " + name); };
const img = (w, h, rgb) => { const d = Buffer.alloc(w * h * 4); for (let i = 0; i < w * h; i++) { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255; } return { data: d, width: w, height: h }; };
const px = (buf, x, y) => { const j = JPEG.decode(buf, { useTArray: true, formatAsRGBA: true }); const o = (y * j.width + x) * 4; return [j.data[o], j.data[o + 1], j.data[o + 2], j.width, j.height]; };

t("регистърът е в същата форма като _ted-skills (description, input.safeParse, run) и носи входа в описанието", () => {
  assert.ok(N.names.length >= 15);
  N.names.forEach((k) => { const x = N.tools[k]; assert.ok(typeof x.run === "function" && typeof x.input.safeParse === "function" && /Вход: \{/.test(x.description), k); assert.ok(C.CONTRACTS[k], "без договор: " + k); });
  assert.ok(!N.names.some((k) => /^(cad|models)\./.test(k)), "неизпълнени инструменти не се обявяват (TASK-009)");
  ["tours.request", "interior.prepare", "tour.render", "tour.report", "tour.publish", "tour.get"].forEach((k) => assert.ok(N.names.includes(k), "TASK-010 инструмент: " + k));
  ["imports.start", "imports.apply", "jobs.status", "jobs.result", "jobs.cancel"].forEach((k) => assert.ok(N.names.includes(k), "TASK-006 инструмент: " + k));
  assert.ok(/unit_id\*.*to\*\(free\|reserved\|sold\).*confirm\*\(true\)/.test(N.tools["units.set_status"].description));
});

t("живият handler вика tool.input.safeParse – правилата важат през него", () => {
  const P = "0123456789abcdef0123456789abcdef";
  const sp = (k, i) => N.tools[k].input.safeParse(i).success;
  assert.ok(sp("units.set_status", { unit_id: P, to: "reserved", expected_version: 1, confirm: true }));
  assert.ok(!sp("units.set_status", { unit_id: P, to: "reserved", expected_version: 1 }), "без потвърждение");
  assert.ok(!sp("units.set_status", { unit_id: P, to: "deposited", expected_version: 1, confirm: true }));
  assert.ok(!sp("units.upsert", { project_id: P, building_id: P, floor_id: P, code: "A1", investor: "x" }));
  assert.ok(!sp("units.upsert", { project_id: P, building_id: P, floor_id: P, code: "A1", price_total: 5 }), "цена без override");
  assert.ok(!sp("projects.publish", { id: P, expected_version: 1, slug: "ok-slug" }), "публикуване без потвърждение");
});

t("грешки от базата → HTTP статус и ясен текст; вътрешни подробности не излизат", () => {
  const f = N._fail;
  assert.strictEqual(f({ code: "NC409", message: "Променен е от друг – презаредете" }).status, 409);
  assert.strictEqual(f({ code: "42501", message: "Само администратор може да направи тази промяна" }).status, 403);
  assert.strictEqual(f({ code: "42501", message: "permission denied for table nd_units" }).message, "Нямате право за това действие");
  assert.strictEqual(f({ code: "P0002", message: "Обектът не е намерен" }).status, 404);
  assert.strictEqual(f({ code: "23505", message: 'duplicate key value violates unique constraint "nd_units_project_id_code_key"' }).message, "В проекта вече има обект с този код");
  assert.strictEqual(f({ code: "23514", message: 'violates check constraint "nd_units_data_clean"' }).message, "В модула не се пази инвеститор, строител или изпълнител");
  const e = f({ code: "XX000", message: "internal: relation public.secret_table at character 15" });
  assert.strictEqual(e.status, 500); assert.ok(!/secret_table/.test(e.message));
});

t("производна за свободен обект: JPG/PNG → JPEG с воден знак; PDF и повреден файл → без производна (никога оригиналът)", () => {
  const jpg = Buffer.from(JPEG.encode(img(600, 400, [250, 250, 250]), 90).data);
  const d = N.makeDerivative(jpg, null);
  assert.ok(d.ok && d.mime === "image/jpeg" && !d.buf.equals(jpg));
  const c = px(d.buf, 300, 200), e = px(d.buf, 5, 5);
  assert.ok(e[0] > 240, "ъгълът е непроменен"); assert.ok(c[3] === 600 && c[4] === 400);
  const png = PNG.sync.write(Object.assign(new PNG({ width: 300, height: 200 }), { data: img(300, 200, [255, 255, 255]).data }));
  assert.ok(N.makeDerivative(png, null).ok);
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj<<>>endobj\n");
  const r = N.makeDerivative(pdf, null); assert.strictEqual(r.ok, false); assert.ok(!r.buf);
  assert.strictEqual(N.makeDerivative(Buffer.from([0xff, 0xd8, 1, 2, 3]), null).ok, false, "повреден JPEG");
});

t("етажен план: обектите, които не са свободни, са ПЛЪТНО закрити; свободните остават видими", () => {
  const base = img(800, 400, [255, 255, 255]);
  for (let y = 100; y < 300; y++) for (let x = 100; x < 300; x++) { const o = (y * 800 + x) * 4; base.data[o] = 0; base.data[o + 1] = 0; base.data[o + 2] = 255; }   // „разпределение“ на продаден обект (синьо)
  for (let y = 100; y < 300; y++) for (let x = 500; x < 700; x++) { const o = (y * 800 + x) * 4; base.data[o] = 0; base.data[o + 1] = 160; base.data[o + 2] = 0; }   // свободен обект (зелено)
  const jpg = Buffer.from(JPEG.encode(base, 95).data);
  const d = N.makeDerivative(jpg, [[[0.125, 0.25], [0.375, 0.25], [0.375, 0.75], [0.125, 0.75]]]);
  assert.ok(d.ok);
  for (const [x, y] of [[110, 110], [200, 200], [290, 290], [101, 299]]) { const p = px(d.buf, x, y); assert.ok(p[2] < 90 && p[0] > 50 && p[0] < 140, "закрито на " + x + "," + y + " → " + p.slice(0, 3)); }
  const g = px(d.buf, 520, 120); assert.ok(g[1] > 120 && g[0] < 60, "свободният обект е видим: " + g.slice(0, 3));
});

(async () => {
  const call = async (url) => { const h = {}; const res = { setHeader: (k, v) => { h[k] = v; }, end: (b) => { res.body = b; }, statusCode: 0 }; await N.publicFile({ url }, res); return { code: res.statusCode, h, body: res.body }; };
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const u of ["/api/tools?plan=unit:../../etc", "/api/tools?plan=project:0123456789abcdef", "/api/tools?pano=0123456789abcdef:999", "/api/tools?plan="]) { const r = await call(u); assert.strictEqual(r.code, 400, u); assert.strictEqual(r.h["Cache-Control"], "no-store"); }
  const r = await call("/api/tools?plan=unit:0123456789abcdef0123456789abcdef");
  assert.strictEqual(r.code, 404); assert.ok(!r.h.Location);
  console.log("PASS  без ключ / без запис в базата → 404, без пренасочване");
  n++; console.log("\n" + n + "/" + n + " минали");
})().catch((e) => { console.error(e); process.exit(1); });
