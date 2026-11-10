// ПЪЛЕН тест от край до край (TASK-009): истинският код на сайта (api/_nc-cad.js) + истинската схема (nc_001…nc_005 в PGlite) +
// ИСТИНСКИЯТ изпълнител (Python, отделен процес, истинско HTTP с HMAC, истинско конвертиране с IfcOpenShell / ezdxf / pypdf).
//   качен файл → cad.inspect → изпълнител → отчет → models.request → изпълнител → GLB + изглед → проверка на сървъра → версия „чака преглед“
//   → models.get (преглед) → models.publish → /model/<сграда> → публиката получава точно проверения файл.
// Нужни: PGlite и папката на изпълнителя с инсталирани зависимости. Липсва ли нещо – тестът се пропуска с ясно съобщение.
//   NC_WORKER_DIR=/home/claude/nc-worker PGLITE=/tmp/pg17/node_modules/@electric-sql/pglite node api/_nc-cad-e2e.test.js
"use strict";
const assert = require("assert"), crypto = require("crypto"), fs = require("fs"), os = require("os"), path = require("path"), http = require("http");
const { spawn, spawnSync } = require("child_process");
process.env.SUPABASE_SERVICE_ROLE_KEY = "TEST-SERVICE-ROLE-NOT-A-REAL-KEY";
process.env.NC_WORKER_GH_TOKEN = "TEST-GH-TOKEN-NOT-A-REAL-TOKEN";
process.env.NC_WORKER_GH_REPO = "test-owner/test-nc-worker";
const K = require("./_nc-cad-testkit.js");
process.env.NC_WORKER_SECRET = K.SECRET;
const L = require("./_nc-cad-lib.js"), NC = require("./_nc-tools.js"), CAD = require("./_nc-cad.js");
const { ADMIN, BROKER, SECRET } = K;
let n = 0; const done = (name) => { n++; console.log("PASS  " + name); };
const skip = (why) => { console.log("SKIP  " + why); console.log("\n0/0 минали (пропуснат)"); };
const WORKER = process.env.NC_WORKER_DIR || [path.join(__dirname, "..", "..", "nc-worker"), "/home/claude/nc-worker"].find((p) => fs.existsSync(path.join(p, "ncworker", "__main__.py")));
const PY = process.env.NC_PYTHON || "python3";
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const get = (url) => new Promise((res, rej) => http.get(url, (x) => { const ch = []; x.on("data", (c) => ch.push(c)); x.on("end", () => res({ status: x.statusCode, headers: x.headers, body: Buffer.concat(ch) })); }).on("error", rej));

(async () => {
  if (!WORKER) return skip("няма папка на изпълнителя (задайте NC_WORKER_DIR)");
  const dep = spawnSync(PY, ["-c", "import ifcopenshell, ezdxf, pypdf, numpy, shapely, PIL"], { cwd: WORKER });
  if (dep.status !== 0) return skip("зависимостите на изпълнителя не са инсталирани (pip install -r requirements.txt)");
  const kit = await K.create();
  if (!kit) return skip("няма PGlite (задайте PGLITE=<път до @electric-sql/pglite>)");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nc-e2e-"));
  const fx = spawnSync(PY, ["-m", "ncworker", "fixtures", tmp], { cwd: WORKER, encoding: "utf8" });
  assert.strictEqual(fx.status, 0, "служебните файлове не се генерираха: " + fx.stderr);
  const STRUCT = JSON.parse(fs.readFileSync(path.join(tmp, "TEST-structure.json"), "utf8"));
  const base = await kit.listen(CAD), { B } = kit;
  const S = await kit.seed(STRUCT), PID = S.P.id, BID = S.B.id;
  const cadPath = (name) => "projects/" + PID + "/private/cad/" + name;
  for (const f of fs.readdirSync(tmp)) if (/^TEST-.*\.(ifc|dxf|glb|gltf|pdf|dwg)$/.test(f)) kit.put(cadPath(f), fs.readFileSync(path.join(tmp, f)));
  const run = (uid, tool, input) => { const t = NC.tools[tool], p = t.input.safeParse(input); assert.ok(p.success, tool + ": " + JSON.stringify(p.error && p.error.issues)); return t.run(kit.ctx(uid), p.data); };
  const job = async (id) => (await kit.svc("select * from nd_jobs where id=$1", [id]))[0];

  /* „GitHub Actions“: всяко повикване пуска истинския изпълнител като отделен процес със същите променливи, които дава workflow-ът */
  const runs = new Map(), workerLogs = []; let seq = 9000;
  const startWorker = (jobId) => {
    const p = new Promise((resolve) => {
      const env = { PATH: process.env.PATH, HOME: process.env.HOME || tmp, LANG: "C.UTF-8", NC_SITE_URL: base, NC_WORKER_SECRET: SECRET, NC_JOB_ID: jobId || "", NC_RUN: String(++seq) + ".1" };
      const c = spawn(PY, ["-m", "ncworker", "run"], { cwd: WORKER, env });
      let out = ""; c.stdout.on("data", (d) => { out += d; }); c.stderr.on("data", (d) => { out += d; });
      c.on("close", (code) => { workerLogs.push(out); resolve({ code, out }); });
    });
    if (jobId) runs.set(jobId, p);
    return p;
  };
  B.onDispatch = startWorker;
  const wait = async (jobId) => { const r = await runs.get(jobId); assert.strictEqual(r.code, 0, "изпълнителят завърши с грешка: " + r.out.slice(-600)); return r; };
  const inspect = async (name) => { const r = await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath(name) }); assert.ok(r.created && r.dispatched, name); await wait(r.job_id); return { id: r.job_id, job: await job(r.job_id) }; };

  /* 1. IFC: проверка */
  const iIfc = await inspect("TEST-building.ifc");
  assert.strictEqual(iIfc.job.status, "done", iIfc.job.error);
  let R = iIfc.job.result;
  assert.deepStrictEqual([R.format, R.version, R.is_3d, R.convertible, R.units.to_m], ["ifc", "IFC4", true, true, 0.001]);
  assert.deepStrictEqual(R.storeys.map((s) => [s.name, s.elevation_m]), [["Етаж 1", 0], ["Етаж 2", 3], ["Етаж 3", 6]]);
  assert.ok(R.spaces.count === 9 && R.spaces.zones === 3 && R.openings === 9 && R.is_external.walls_total === 15 && R.is_external.walls_with_flag === 10);
  assert.ok(R.private_metadata.header_author_present === true && !JSON.stringify(R).includes("TEST-AUTHOR") && !JSON.stringify(R).includes("example.invalid"), "авторът се отбелязва, но стойността не се пази");
  assert.ok(R.coordinates.far_from_origin === true && R.source_sha256 === sha(fs.readFileSync(path.join(tmp, "TEST-building.ifc"))) && R.sandbox && R.sandbox.env === "scrubbed" && R.sandbox.shell === false);
  assert.ok(R.tools.IfcOpenShell && R.worker.name === L.GENERATOR);
  const st = await run(BROKER, "jobs.status", { id: iIfc.id }); assert.strictEqual(st.state, "succeeded");
  done("IFC → cad.inspect → истинският изпълнител: схема IFC4, mm→m, 3 етажа с коти 0/3/6 m, 9 помещения, 9 отвора, IsExternal 10/15; авторът не се пази; хешът на източника е записан");

  /* 2. IFC: конверсия → версия „чака преглед“ */
  const control = [{ label: "дължина по чертеж", axis: "length", meters: 12.0 }, { label: "ширина с балкона", axis: "width", meters: 9.2 }, { label: "височина", axis: "height", meters: 9.25 }];
  const m1 = await run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-building.ifc"), mapping: { control } });
  await wait(m1.job_id);
  let j = await job(m1.job_id); assert.strictEqual(j.status, "review", j.error);
  let M = (await kit.svc("select * from nd_models where job_id=$1", [m1.job_id]))[0];
  assert.deepStrictEqual([M.version, M.status, M.fidelity, M.source_format], [1, "review", "exact", "ifc"]);
  assert.deepStrictEqual([M.stats.triangles, M.stats.units_mapped, M.stats.units_total, M.stats.floors_mapped, M.stats.floors_total], [480, 6, 6, 3, 3]);
  const dims = M.report.bbox.dimensions_m; assert.deepStrictEqual([dims.length, dims.width, dims.height], [12, 9.2, 9.25], "мащабът е запазен (сграда, завъртяна на 30° и геореферирана)");
  assert.deepStrictEqual(M.report.control_dimensions.filter((c) => c.origin === "администратор").map((c) => c.result), ["PASS", "PASS", "PASS"]);
  assert.deepStrictEqual(M.report.control_dimensions.filter((c) => c.axis === "storey_height").map((c) => c.model_m), [3, 3], "етажните височини са запазени");
  assert.ok(Math.abs(M.report.origin.offset_m[0] - 475003.196) < 0.01 && M.report.axes.model.startsWith("Y нагоре"), "началото и осите са записани");
  assert.deepStrictEqual([M.report.floor_count.result, M.report.missing_geometry.length, M.report.conversion_check.scale_preserved, M.report.optimization.surface_preserved], ["PASS", 0, true, true]);
  assert.deepStrictEqual(M.report.public_safe.excluded_by_class, { IfcBuildingElementProxy: 3, IfcFurnishingElement: 3 });
  assert.deepStrictEqual([M.report.public_safe.is_external.interior_dropped, M.report.public_safe.unit_volumes], [6, 6], "вътрешните стени и врати не са в модела; обектите са по един обем");
  assert.deepStrictEqual(M.mapping.units.map((u) => [u.code, u.volume]), [["TEST-101", true], ["TEST-102", true], ["TEST-201", true], ["TEST-202", true], ["TEST-301", true], ["TEST-302", true]]);
  assert.ok(M.mapping.units.find((u) => u.code === "TEST-202").method.includes("space_name"), "кодът с кирилско „Т“ и интервал е съвпаднал по нормализация");
  assert.deepStrictEqual(M.mapping.checks.map((c) => [c.check, c.result]).slice(0, 2), [["storey_order", "PASS"], ["unit_floor", "PASS"]]);
  assert.ok(M.poster_path && M.report.poster.from_model === true && M.report.performance.payload_bytes === Number(M.glb_bytes) && M.report.sandbox.env === "scrubbed");
  const stored = B.storage.get(M.glb_path); assert.strictEqual(sha(stored), M.glb_sha256);
  const v = L.validateGlb(stored, { strict: true, unitIds: new Set(STRUCT.units.map((u) => u.id)), floorIds: new Set(STRUCT.floors.map((f) => f.id)) }); assert.deepStrictEqual(v.errors, []);
  const gtxt = stored.subarray(20, 20 + stored.readUInt32LE(12)).toString("utf8");
  ["TEST-AUTHOR", "TEST-ORGANIZATION", "example.invalid", "Мебел", "Вътрешна врата", "Преградна", "Дневна", "Спалня"].forEach((x) => assert.ok(!gtxt.includes(x), "в публичния файл има „" + x + "“"));
  done("IFC → models.request → истинска конверсия: версия 1 „exact“, 480 триъгълника, 6/6 обекта и 3/3 етажа свързани, размери 12.00 × 9.20 × 9.25 m = контролните, отвори изрязани, вътрешните елементи изключени, изглед от модела; сървърът приема файла");

  /* 3. преглед от екипа → публикуване → публичният път дава точно този файл */
  const mg = await run(BROKER, "models.get", { building_id: BID, preview: true });
  const prev = await get(mg.selected.preview_url); assert.strictEqual(sha(prev.body), M.glb_sha256, "прегледът на екипа е същият файл");
  assert.strictEqual((await get(base + "/model/" + BID)).status, 404, "преди публикуване");
  await run(ADMIN, "models.publish", { job_id: m1.job_id, building_id: BID, confirm: true, expected_published_version: 0 });
  await kit.publishProject(PID, "test-e2e-3d");
  const red = await get(base + "/model/" + BID); assert.strictEqual(red.status, 302);
  const pubFile = await get(red.headers.location); assert.strictEqual(sha(pubFile.body), M.glb_sha256);
  const pr = await get(base + "/model/" + BID + "/poster"); assert.strictEqual(pr.status, 302);
  const poster = await get(pr.headers.location); assert.ok(poster.body[0] === 0xff && poster.body[1] === 0xd8 && poster.body.length > 5000, "изгледът е JPEG, нарисуван от модела");
  const idx = (await kit.as("anon", null, () => kit.q("select nd_public_models('test-e2e-3d') as r")))[0].r[BID];
  assert.deepStrictEqual([idx.version, idx.units, idx.floors, idx.fidelity, idx.poster, idx.triangles], [1, 6, 3, "exact", true, 480]);
  done("преглед от екипа (60 s адрес) → models.publish → /model/<сграда> и /model/<сграда>/poster → публиката получава точно проверения GLB и изгледа; публичният списък е без пътища");

  /* 4. DXF */
  const iDxf = await inspect("TEST-3d.dxf"); R = iDxf.job.result;
  assert.deepStrictEqual([R.format, R.is_3d, R.convertible, R.units.insunits, R.units.to_m], ["dxf", true, true, 4, 0.001]);
  assert.ok(R.layers.some((l) => l.name === "FLOOR_1") && R.blocks.some((b) => b.name === "TEST-COLUMN") && R.layouts.some((l) => l.paper) && R.content_3d.faces_and_meshes >= 50 && R.content_3d.with_thickness === 1);
  assert.deepStrictEqual(R.dependencies.filter((d) => d.kind === "xref").map((d) => [d.name, d.resolved]), [["TEST-xref-missing.dwg", false]], "липсващата външна препратка е отчетена – само име, без път");
  assert.ok(R.fonts.includes("TESTFONT-MISSING.SHX") && !JSON.stringify(R).includes("C:\\\\TEST"));
  const mD = await run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-3d.dxf") }); await wait(mD.job_id);
  M = (await kit.svc("select * from nd_models where job_id=$1", [mD.job_id]))[0];
  assert.deepStrictEqual([M.version, M.fidelity, M.source_format, M.stats.floors_mapped, M.stats.units_mapped], [2, "exact", "dxf", 2, 1]);
  assert.deepStrictEqual([M.report.bbox.dimensions_m.length, M.report.bbox.dimensions_m.width, M.report.bbox.dimensions_m.height], [12, 8, 7.2]);
  const i2d = await inspect("TEST-2d.dxf"); assert.deepStrictEqual([i2d.job.result.is_3d, i2d.job.result.convertible], [false, false]); assert.ok(/Чертежът е 2D/.test(i2d.job.result.convert_reason_bg));
  const e2d = await run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-2d.dxf") }).then(() => null, (e) => e); assert.ok(e2d && e2d.status === 400 && /NEEDS_SOURCE/.test(e2d.message), "2D чертеж не става модел");
  const iAc = await inspect("TEST-acis.dxf"); assert.ok(iAc.job.result.convertible === false && /ACIS/.test(iAc.job.result.convert_reason_bg));
  done("DXF: единици, слоеве, блокове, оформления, липсваща външна препратка и шрифт (само имена); 3D DXF → модел „exact“ (версия 2) със слоеве FLOOR_/UNIT_; 2D и само-ACIS чертеж → честен отказ");

  /* 5. GLB като източник */
  const iGlb = await inspect("TEST-source-ok.glb"); R = iGlb.job.result;
  assert.ok(R.convertible && R.gltf.triangles === 36 && R.gltf.private_metadata.length >= 3 && R.gltf.cameras === 1);
  const mG = await run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-source-ok.glb") }); await wait(mG.job_id);
  M = (await kit.svc("select * from nd_models where job_id=$1", [mG.job_id]))[0];
  assert.deepStrictEqual([M.version, M.fidelity, M.source_format, M.stats.units_mapped, M.stats.textures], [3, "conceptual", "glb", 2, 1], "мрежов файл без контролни размери е „conceptual“");
  const gs = B.storage.get(M.glb_path), gj = gs.subarray(20, 20 + gs.readUInt32LE(12)).toString("utf8");
  ["TEST-COPYRIGHT", "TEST-Exporter", "test-author", "Users", "secret_note", "ElementId", "cameras", "TEST-texture.png"].forEach((x) => assert.ok(!gj.includes(x), "в публичния файл е останало „" + x + "“"));
  const iDr = await inspect("TEST-source-draco.glb"); assert.ok(iDr.job.result.convertible === false && /Draco/.test(iDr.job.result.convert_reason_bg));
  const iEx = await inspect("TEST-source-external.glb"); assert.deepStrictEqual(iEx.job.result.missing, ["TEST-missing-texture.png"], "липсващата текстура е отчетена");
  const iGt = await inspect("TEST-external.gltf"); assert.ok(iGt.job.result.convertible === false && iGt.job.result.missing.length === 1);
  const rT = await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-source-truncated.glb") }); await wait(rT.job_id);
  j = await job(rT.job_id); assert.deepStrictEqual([j.status, j.attempts], ["failed", 1]); assert.ok(/^\[FILE_CORRUPT\]/.test(j.error), j.error);
  const rB = await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-source-badindex.glb") }); await wait(rB.job_id);
  assert.ok(/^\[FILE_CORRUPT\] Индекс на триъгълник извън върховете/.test((await job(rB.job_id)).error));
  done("GLB източник: личните метаданни се отчитат и НЕ влизат в публичния файл (автор, генератор, extras, камера, имена); модел „conceptual“; Draco → отказ с причина; липсваща текстура/външен файл → отчетени; отрязан и с лош индекс → безопасен окончателен неуспех");

  /* 6. PDF и DWG */
  const iPv = await inspect("TEST-vector.pdf"); R = iPv.job.result;
  assert.deepStrictEqual([R.is_vector, R.is_scan, R.convertible, R.exact_cad, R.pages[0].kind], [true, false, false, false, "vector"]);
  assert.ok(R.pages[0].geometry.straight_segments > 50 && R.calibration.verified_by_dimension === true && R.calibration.detected_scales[0] === "1:100");
  assert.ok(R.calibration.checks.some((c) => c.label === "10.00" && c.measured_m === 10 && c.result === "PASS"), "надписан размер 10.00 = измерена линия 100 mm при 1:100");
  const iPs = await inspect("TEST-scan.pdf"); R = iPs.job.result;
  assert.deepStrictEqual([R.is_vector, R.is_scan, R.convertible, R.exact_cad, R.pages[0].kind, R.pages[0].text.ocr_layer, R.calibration.verified_by_dimension], [false, true, false, false, "scan", true, false]);
  assert.ok(R.geometry_evidence.straight_segments === 0 && R.text_evidence.ocr_text_ops === 1 && /НЕ се възстановяват като оригинален DWG/.test(R.warnings.join(" ")) && /не е доказателство/.test(R.pages[0].scale_source_bg));
  const ePdf = await run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-vector.pdf") }).then(() => null, (e) => e); assert.ok(ePdf && /NEEDS_SOURCE/.test(ePdf.message));
  const iDw = await inspect("TEST-fake.dwg"); R = iDw.job.result;
  assert.deepStrictEqual([R.format, R.version, R.convertible, R.content_readable], ["dwg", "AutoCAD 2018 (AC1032)", false, false]); assert.ok(/DXF.*IFC/.test(R.convert_reason_bg));
  done("PDF: векторен ≠ сканиран; мащабът се потвърждава с надписан размер срещу измерена линия; при скан – OCR е отделно и не е доказателство, не е CAD; от PDF модел не се прави. DWG: версия по подпис, честно „нужен е DXF/IFC“");

  /* 7. идемпотентност при повторно пускане + периодичното изравняване */
  const before = JSON.stringify(await kit.svc("select id, status, attempts, result from nd_jobs order by created_at")), models = (await kit.svc("select count(*)::int n from nd_models"))[0].n;
  const again = await startWorker(m1.job_id); assert.strictEqual(again.code, 0); assert.ok(/"event": "nothing_to_do"/.test(again.out), again.out.slice(-300));
  assert.strictEqual(JSON.stringify(await kit.svc("select id, status, attempts, result from nd_jobs order by created_at")), before, "повторното пускане не променя нищо");
  assert.strictEqual((await kit.svc("select count(*)::int n from nd_models"))[0].n, models);
  const empty = await startWorker(""); assert.strictEqual(empty.code, 0); assert.ok(/"event": "queue_empty"/.test(empty.out));
  B.onDispatch = null;
  kit.put(cadPath("TEST-late.ifc"), fs.readFileSync(path.join(tmp, "TEST-building-nospaces.ifc")));
  const late = await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-late.ifc") });
  const rec = await startWorker(""); assert.strictEqual(rec.code, 0);
  j = await job(late.job_id); assert.strictEqual(j.status, "done", "пускане без job_id взима най-старата чакаща задача");
  assert.ok(j.result.missing.some((m) => /няма помещения/.test(m)), "IFC без помещения → отчетено като липса");
  done("идемпотентност: повторно пускане за приключила задача → „няма работа“, без промяна в базата; пускане без job_id (периодично изравняване) взима най-старата чакаща или завършва чисто при празна опашка");

  /* 8. нищо тайно в логовете на изпълнителя */
  const all = workerLogs.join("\n");
  assert.ok(!all.includes(SECRET) && !all.includes("TEST-SERVICE") && !all.includes("TEST-GH-TOKEN"), "тайна в лога на изпълнителя");
  assert.ok(!/\/s\/(get|put)\//.test(all) && !/v1=[a-f0-9]{64}/.test(all) && !/projects\/[a-z0-9]+\/private/.test(all), "подписан адрес, подпис или път в лога");
  assert.ok(all.split("\n").filter((l) => l.startsWith("{")).every((l) => { try { JSON.parse(l); return true; } catch (e) { return false; } }), "логът е структуриран (JSON на ред)");
  done("логът на изпълнителя е структуриран и без тайни, подписи, подписани адреси и пътища в хранилището");

  await kit.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\n" + n + "/" + n + " минали");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
