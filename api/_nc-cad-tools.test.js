// Тест: инструментите и обратните повиквания на TASK-009 през ИСТИНСКИЯ код на api/_nc-cad.js срещу ИСТИНСКАТА схема (nc_001…nc_005)
// в база в процеса (PGlite). Supabase REST/storage и GitHub са подменени (global.fetch) – без мрежа. Ключовете са очевидно тестови.
// Покрива: права, размер, неподдържан/повреден файл, идемпотентност, NC409, подпис на изпълнителя, остарял изпълнител, отмяна, нов опит,
// проверка на готовия файл от сървъра, публикуване/връщане, защитения публичен път и че никъде не излизат тайни или пътища.
//   PGLITE=/tmp/pg17/node_modules/@electric-sql/pglite node api/_nc-cad-tools.test.js      (без PGlite тестът се пропуска с ясно съобщение)
"use strict";
const assert = require("assert"), crypto = require("crypto");
process.env.SUPABASE_SERVICE_ROLE_KEY = "TEST-SERVICE-ROLE-NOT-A-REAL-KEY";
process.env.NC_WORKER_GH_TOKEN = "TEST-GH-TOKEN-NOT-A-REAL-TOKEN";
process.env.NC_WORKER_GH_REPO = "test-owner/test-nc-worker";
const K = require("./_nc-cad-testkit.js");
process.env.NC_WORKER_SECRET = K.SECRET;
const L = require("./_nc-cad-lib.js"), F = require("./_nc-cad-fixtures.js"), NC = require("./_nc-tools.js"), CAD = require("./_nc-cad.js");
const { ADMIN, BROKER, VISITOR, SECRET } = K;
let n = 0; const done = (name) => { n++; console.log("PASS  " + name); };
const SECRETS = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.NC_WORKER_GH_TOKEN, SECRET];
const logs = []; const origErr = console.error; console.error = (...a) => { logs.push(a.map(String).join(" ")); };

(async () => {
  const kit = await K.create();
  if (!kit) { console.log("SKIP  няма PGlite (задайте PGLITE=<път до @electric-sql/pglite>) – тестът с истинската схема е пропуснат"); console.log("\n0/0 минали (пропуснат)"); return; }
  const base = await kit.listen(CAD);
  const { B } = kit;
  const run = async (uid, tool, input) => { const t = NC.tools[tool]; const p = t.input.safeParse(input); if (!p.success) { const e = new Error("Invalid input: " + JSON.stringify(p.error.issues)); e.status = 400; throw e; } return t.run(kit.ctx(uid), p.data); };
  const fails = async (status, re, fn, label) => { try { await fn(); } catch (e) { assert.strictEqual(e.status, status, label + ": очакван HTTP " + status + ", получен " + e.status + " (" + e.message + ")"); if (re) assert.ok(re.test(e.message), label + ": " + e.message); return e; } assert.fail(label + ": очаквана грешка " + status); };
  const outputs = [];
  const keep = (x) => { outputs.push(JSON.stringify(x)); return x; };
  const noLeak = (x, label) => { const s = JSON.stringify(x); assert.ok(!/projects\/[a-z0-9]{8,}\/|private\/|derived\/|supabase\.co|TEST-SERVICE|TEST-GH-TOKEN/.test(s), label + ": изтича път или ключ: " + s.slice(0, 300)); };
  let runSeq = 1000;
  const mkRes = () => { const h = {}; return { statusCode: 200, headers: h, setHeader(k, v) { h[k.toLowerCase()] = v; }, end(b) { this.body = b; } }; };
  async function cb(action, payload, o) {
    o = o || {};
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload), ts = String(o.ts || Math.floor(Date.now() / 1000));
    const headers = Object.assign({ "x-nc-timestamp": ts, "x-nc-signature": o.sig !== undefined ? o.sig : L.sign(o.secret || SECRET, ts, o.signAction || action, o.signBody || raw) }, o.headers || {});
    const req = { method: "POST", url: "/api/tools?ncw=" + action, headers, body: o.objectBody ? JSON.parse(raw) : raw }, res = mkRes();
    await CAD.workerCallback(req, res);
    return keep({ status: res.statusCode, body: res.body ? JSON.parse(res.body) : {}, headers: res.headers });
  }
  const pathOf = (url) => { const m = /\/s\/(?:get|put)\/([a-f0-9]{24})$/.exec(url); return m && B.signed.get(m[1]); };
  const job = async (id) => (await kit.svc("select * from nd_jobs where id=$1", [id]))[0];
  const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
  const pub = async (url) => { const res = mkRes(); await CAD.publicModel({ method: "GET", url }, res); return res; };

  const S = await kit.seed(), PID = S.P.id, BID = S.B.id;
  const other = await kit.seed();
  const cadPath = (name, pid) => "projects/" + (pid || PID) + "/private/cad/" + name;
  const IFC = Buffer.concat([F.HEADS.ifc, Buffer.from("/* TEST-IFC-1 */")]), IFC2 = Buffer.concat([F.HEADS.ifc, Buffer.from("/* TEST-IFC-2 */")]);
  kit.put(cadPath("TEST-building.ifc"), IFC); kit.put(cadPath("TEST-plan.pdf"), F.HEADS.pdf); kit.put(cadPath("TEST-drawing.dwg"), F.HEADS.dwg2018);
  kit.put(cadPath("TEST-photo-renamed.ifc"), F.HEADS.jpeg); kit.put(cadPath("TEST-2d.dxf"), F.HEADS.dxf); kit.put(cadPath("TEST-other.ifc"), IFC2);
  kit.put(cadPath("TEST-foreign.ifc", other.P.id), IFC);

  /* 1 */
  ["cad.inspect", "models.request", "models.publish", "models.unpublish", "models.get", "jobs.status", "jobs.result", "jobs.cancel"].forEach((k) => assert.ok(NC.names.includes(k), k));
  assert.ok(/Вход: \{project_id\*, path\*, rerun\}/.test(NC.tools["cad.inspect"].description));
  assert.ok(/PDF и 2D чертеж НЕ стават 3D модел/.test(NC.tools["cad.inspect"].description) && /Геометрия не се измисля/.test(NC.tools["models.request"].description));
  done("регистър: 5-те инструмента на TASK-009 са в същия регистър на /api/tools с описание за агента; тежките правила са в описанието");

  /* 2 */
  await fails(403, /само администратор.*FORBIDDEN/, () => run(BROKER, "cad.inspect", { project_id: PID, path: cadPath("TEST-building.ifc") }), "брокер");
  await fails(404, /Проектът не е намерен/, () => run(VISITOR, "cad.inspect", { project_id: PID, path: cadPath("TEST-building.ifc") }), "не-служител не вижда проекта (RLS)");
  await fails(404, /Проектът не е намерен/, () => run(ADMIN, "cad.inspect", { project_id: "ffffffffffffffffffffffffffffffff", path: "projects/ffffffffffffffffffffffffffffffff/private/cad/x.ifc" }), "няма проект");
  await fails(404, /не е намерен в хранилището.*FILE_NOT_FOUND/, () => run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-missing.ifc") }), "няма файл");
  await fails(400, /Invalid input/, () => run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-foreign.ifc", other.P.id) }), "файл от друг проект");
  const eU = await fails(400, /Изображение: .*само за справка.*FILE_UNSUPPORTED/, () => run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-photo-renamed.ifc") }), "снимка с име .ifc");
  assert.ok(!/projects\//.test(eU.message));
  const lim = L.LIMITS.inputBytes.ifc; L.LIMITS.inputBytes.ifc = 100;
  await fails(400, /FILE_TOO_LARGE/, () => run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-building.ifc") }), "над лимита");
  L.LIMITS.inputBytes.ifc = lim;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY; process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  await fails(503, /само в продукционната среда/, () => run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-building.ifc") }), "без service role");
  process.env.SUPABASE_SERVICE_ROLE_KEY = sr;
  await kit.svc("update nd_projects set status='archived' where id=$1", [other.P.id]);
  await fails(409, /архивиран/, () => run(ADMIN, "cad.inspect", { project_id: other.P.id, path: cadPath("TEST-foreign.ifc", other.P.id) }), "архивиран проект");
  assert.strictEqual((await kit.svc("select count(*)::int n from nd_jobs"))[0].n, 0, "нито един отказ не е създал задача");
  assert.strictEqual(B.dispatches.length, 0);
  done("cad.inspect – откази без задача: брокер 403, не-служител/няма проект 404, няма файл 404, чужд проект 400, снимка с име .ifc 400 (по съдържание), над лимита 400, без service role 503, архивиран 409");

  /* 3 */
  const i1 = keep(await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-building.ifc") }));
  assert.ok(i1.ok && i1.created && !i1.idempotent && i1.dispatched && i1.state === "queued" && i1.format === "ifc" && i1.bytes === IFC.length && /^cad-/.test(i1.correlation_id));
  assert.ok(/Чака изпълнител: повикан е/.test(i1.waiting_bg)); noLeak(i1, "cad.inspect");
  let j = await job(i1.job_id);
  assert.strictEqual(j.kind, "cad_inspect"); assert.strictEqual(j.idempotency_key, "cad_inspect:" + PID + ":" + sha(IFC)); assert.strictEqual(j.input.sha256, sha(IFC)); assert.strictEqual(j.input.sha_kind, "sha256");
  assert.strictEqual(j.actor_user_id, ADMIN); assert.ok(j.progress.dispatched_at && j.progress.dispatch_ok === true);
  assert.deepStrictEqual(B.dispatches, [{ repo: "test-owner/test-nc-worker", workflow: "nc-worker.yml", ref: "main", inputs: { job_id: i1.job_id }, auth_ok: true }], "към GitHub отива само job_id");
  const i1b = keep(await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-building.ifc") }));
  assert.ok(i1b.job_id === i1.job_id && i1b.idempotent && !i1b.created); assert.strictEqual(B.dispatches.length, 1, "повторът не вика изпълнителя втори път (току-що е повикан)");
  // втори администратор за същия файл получава същата задача (не „ключът е зает“)
  const ADMIN2 = "00000000-0000-4000-8000-000000000007"; await kit.svc("insert into nd_staff(user_id, role) values ($1,'admin')", [ADMIN2]);
  assert.strictEqual((await run(ADMIN2, "cad.inspect", { project_id: PID, path: cadPath("TEST-building.ifc") })).job_id, i1.job_id);
  // заявка, оставена от импорта (TASK-006: imports.apply → downstream) със същия ключ → същата задача, а изпълнителят се вика сега
  const t6 = (await kit.as("authenticated", ADMIN, () => kit.q("select nd_job_create('cad_inspect',$1,$2,$3) as r", ["cad_inspect:" + PID + ":" + sha(IFC2), PID, JSON.stringify({ path: cadPath("TEST-other.ifc"), sha256: sha(IFC2), type: "ifc", file_id: "f3", import_job: "x" })])))[0].r.id;
  const i2 = await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-other.ifc") });
  assert.ok(i2.job_id === t6 && i2.idempotent && i2.dispatched); assert.strictEqual(B.dispatches.length, 2); assert.strictEqual(B.dispatches[1].inputs.job_id, t6);
  done("cad.inspect: job_id веднага; ключът е sha256 на файла; към GitHub отива само job_id; повтор и втори администратор → същата задача; заявката от импорта (TASK-006) се поема със същия ключ");

  /* 4 */
  B.ghStatus = 500; kit.put(cadPath("TEST-gh500.ifc"), Buffer.concat([F.HEADS.ifc, Buffer.from("gh500")]));
  const g5 = keep(await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-gh500.ifc") }));
  assert.ok(g5.created && g5.dispatched === false && /не отговори на повикването/.test(g5.waiting_bg)); assert.strictEqual((await job(g5.job_id)).status, "queued");
  B.ghStatus = 204;
  const tok = process.env.NC_WORKER_GH_TOKEN; process.env.NC_WORKER_GH_TOKEN = "";
  kit.put(cadPath("TEST-nocfg.ifc"), Buffer.concat([F.HEADS.ifc, Buffer.from("nocfg")]));
  const nd = B.dispatches.length, g6 = keep(await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-nocfg.ifc") }));
  assert.ok(g6.created && g6.dispatched === false && /още не е настроен/.test(g6.waiting_bg)); assert.strictEqual(B.dispatches.length, nd, "без настройка няма повикване");
  let st = keep(await run(BROKER, "jobs.status", { id: g6.job_id }));
  assert.ok(st.waiting_for_worker && /Чака изпълнител: още не е настроен/.test(st.waiting_bg) && st.state === "queued"); noLeak(st, "jobs.status");
  process.env.NC_WORKER_GH_TOKEN = tok;
  await kit.svc("update nd_jobs set progress = progress || jsonb_build_object('dispatched_at', (now() - interval '10 minutes')::text) where id=$1", [g6.job_id]);
  st = await run(BROKER, "jobs.status", { id: g6.job_id });
  assert.ok(st.dispatched && /повикан е/.test(st.waiting_bg)); assert.strictEqual(B.dispatches[B.dispatches.length - 1].inputs.job_id, g6.job_id, "jobs.status повиква изпълнителя отново");
  const before = B.dispatches.length; await run(BROKER, "jobs.status", { id: g6.job_id }); assert.strictEqual(B.dispatches.length, before, "не по-често от веднъж на 5 минути");
  await kit.svc("update nd_jobs set progress = '{}'::jsonb where id=$1", [g5.job_id]);
  assert.strictEqual(await CAD.tick(), 1, "резервното побутване вика изпълнителя за чакаща задача без повикване");
  done("изпълнителят не отговаря / не е настроен → честно „чака изпълнител“, задачата остава в опашката; jobs.status и tick() го повикват отново (най-много веднъж на 5 мин)");

  /* 5 */
  const good = { job_id: i1.job_id, run: "555.1" };
  for (const [label, o, status] of [["без подпис", { sig: "" }, 401], ["чужда тайна", { secret: "TEST-ANOTHER-SECRET-0123456789-abcdef" }, 401], ["подпис за друго действие", { signAction: "beat" }, 401],
    ["променено тяло", { signBody: JSON.stringify({ job_id: i1.job_id, run: "555.2" }) }, 401], ["стар час (10 мин)", { ts: Math.floor(Date.now() / 1000) - 600 }, 401], ["час от бъдещето", { ts: Math.floor(Date.now() / 1000) + 600 }, 401],
    ["вече разглобен JSON (не text/plain)", { objectBody: true }, 415]]) {
    const r = await cb("claim", good, o); assert.strictEqual(r.status, status, label); assert.deepStrictEqual(Object.keys(r.body).sort(), ["error", "ok"], label + ": без подробности");
  }
  assert.strictEqual((await cb("steal", good)).status, 404); assert.strictEqual((await cb("claim", { job_id: "x", run: "1.1" })).status, 400); assert.strictEqual((await cb("claim", { job_id: i1.job_id, run: "../../etc" })).status, 400);
  assert.strictEqual((await cb("claim", "{не е json")).status, 400); assert.strictEqual((await cb("claim", "[1]")).status, 400);
  assert.strictEqual((await cb("claim", { job_id: "00000000-0000-4000-8000-0000000000ff", run: "1.1" })).status, 404);
  assert.strictEqual((await cb("claim", JSON.stringify({ job_id: i1.job_id, run: "1.1", pad: "x".repeat(L.LIMITS.callbackBodyBytes) }))).status, 413);
  const ws = process.env.NC_WORKER_SECRET; process.env.NC_WORKER_SECRET = ""; assert.strictEqual((await cb("claim", good)).status, 503); process.env.NC_WORKER_SECRET = ws;
  assert.strictEqual((await job(i1.job_id)).status, "queued", "нито едно невалидно повикване не е пипнало задачата");
  done("обратни повиквания: без/грешен подпис, чужда тайна, друго действие, променено тяло, стар или бъдещ час → 401 без подробности; не text/plain 415; непознато действие 404; лош вход 400; твърде голямо 413; без тайна 503");

  /* 6 */
  const c1 = await cb("claim", { job_id: i1.job_id, run: "600.1" });
  assert.strictEqual(c1.status, 200); assert.ok(c1.body.claimed && c1.body.job.kind === "cad_inspect" && c1.body.job.attempt === 1);
  assert.deepStrictEqual([c1.body.source.format, c1.body.source.version, c1.body.source.bytes, c1.body.source.sha256, c1.body.source.name], ["ifc", "IFC4", IFC.length, sha(IFC), "TEST-building.ifc"]);
  assert.ok(c1.body.source.url.startsWith(base + "/s/get/") && c1.body.source.ttl === 300 && !c1.body.upload && !c1.body.structure, "проверката не получава адрес за качване");
  assert.strictEqual(pathOf(c1.body.source.url).path, cadPath("TEST-building.ifc")); assert.ok(pathOf(c1.body.source.url).exp - Date.now() <= 300000);
  assert.ok(c1.body.limits.minutes === L.LIMITS.inspectMinutes && c1.body.heartbeat_secs === 30 && c1.body.dwg_converter_allowed === false);
  j = await job(i1.job_id); assert.deepStrictEqual([j.status, j.locked_by, j.progress.phase], ["running", "gha:600.1", "claimed"]);
  assert.ok(!JSON.stringify(c1.body).includes("private/cad"), "пътят в хранилището не се праща на изпълнителя – само подписан адрес");
  const c1b = await cb("claim", { job_id: i1.job_id, run: "600.1" }); assert.ok(c1b.body.claimed && c1b.body.source.url !== c1.body.source.url, "същото пускане пита пак → нови адреси");
  const c1c = await cb("claim", { job_id: i1.job_id, run: "601.1" }); assert.deepStrictEqual([c1c.body.claimed, c1c.body.reason], [false, "taken"]);
  // пулс с напредък; „чужд“ пулс казва „спри“
  let b1 = await cb("beat", { job_id: i1.job_id, run: "600.1", progress: { phase: "inspect", pct: 40, note: "C:\\Users\\x\\secret.txt", extra: { deep: 1 } } });
  assert.deepStrictEqual(b1.body, { ok: true, cancel: false });
  j = await job(i1.job_id); assert.deepStrictEqual([j.progress.phase, j.progress.phase_bg, j.progress.pct, j.progress.note], ["inspect", "Проверка на файла", 40, "secret.txt"]);
  assert.strictEqual((await cb("beat", { job_id: i1.job_id, run: "601.1", progress: {} })).body.cancel, true, "задачата не е на този изпълнител → спри");
  st = await run(BROKER, "jobs.status", { id: i1.job_id }); assert.ok(st.state === "running" && !st.waiting_for_worker && st.progress.phase_bg === "Проверка на файла");
  done("взимане на задачата: подписан адрес за теглене (300 s) без път, sha256, лимити, пулс; същото пускане пита пак безопасно; друго пускане – „взета“; пулсът записва реалната фаза");

  /* 7 */
  const rep = { format: "ifc", version: "IFC4", is_3d: true, is_vector: true, convertible: true, units: { length: "MILLIMETRE", to_m: 0.001 }, summary_bg: "TEST: 3 етажа", storeys: [{ guid: "TEST-GUID-1", name: "Етаж 1", elevation_m: 0 }],
    author: "TEST-AUTHOR", path: "/home/test/x.ifc", investor: "TEST-INV", nested: { organization: "TEST-ORG", file: "C:\\TEST\\a.ifc", ok: true }, warnings: ["TEST предупреждение от test.user@example.invalid"] };
  assert.strictEqual((await cb("finish", { job_id: i1.job_id, run: "601.1", outcome: "ok", report: rep, source: { sha256: sha(IFC), bytes: IFC.length } })).status, 409, "остарял/чужд изпълнител");
  assert.strictEqual((await cb("finish", { job_id: i1.job_id, run: "600.1", outcome: "ok", report: rep, source: {} })).status, 400, "без хеш на източника");
  assert.strictEqual((await cb("finish", { job_id: i1.job_id, run: "600.1", outcome: "maybe", report: rep, source: { sha256: sha(IFC) } })).status, 400);
  const f1 = await cb("finish", { job_id: i1.job_id, run: "600.1", outcome: "ok", report: rep, source: { sha256: sha(IFC), bytes: IFC.length, format: "ifc" } });
  assert.deepStrictEqual(f1.body, { ok: true, status: "done" });
  j = await job(i1.job_id); assert.strictEqual(j.status, "done"); assert.strictEqual(j.locked_by, null);
  assert.ok(j.result.convertible === true && j.result.state === "succeeded" && j.result.source_sha256 === sha(IFC) && j.result.nested.ok === true);
  ["author", "path", "investor"].forEach((k) => assert.ok(!(k in j.result), k + " не влиза в базата")); assert.ok(!("organization" in j.result.nested)); assert.strictEqual(j.result.nested.file, "a.ifc"); assert.ok(/\[имейл\]/.test(j.result.warnings[0]));
  assert.deepStrictEqual((await cb("finish", { job_id: i1.job_id, run: "600.1", outcome: "ok", report: rep, source: { sha256: sha(IFC) } })).body, { ok: true, replayed: true, status: "done" }, "повтор на същото отчитане");
  st = keep(await run(BROKER, "jobs.status", { id: i1.job_id })); assert.ok(st.state === "succeeded" && /models\.request/.test(st.next)); noLeak(st, "jobs.status done");
  const rs = keep(await run(BROKER, "jobs.result", { id: i1.job_id })); assert.ok(rs.result.convertible === true && rs.result.storeys[0].name === "Етаж 1"); noLeak(rs, "jobs.result");
  done("отчитане на проверка: остарял изпълнител 409; отчетът се чисти (автор, път, забранени ключове, имейл) и влиза в nd_jobs.result; повторът е безопасен; jobs.status/jobs.result са без пътища");

  /* 8 */
  const c5 = await cb("claim", { job_id: g5.job_id, run: "610.1" }); assert.ok(c5.body.claimed);
  assert.deepStrictEqual((await cb("finish", { job_id: g5.job_id, run: "610.1", outcome: "failed", error_code: "FILE_CORRUPT", error: "IFC файлът не се чете /home/x/y/z.ifc", retryable: false })).body, { ok: true, status: "failed", retry: false });
  j = await job(g5.job_id); assert.deepStrictEqual([j.status, j.attempts], ["failed", 1]); assert.ok(/^\[FILE_CORRUPT\] IFC файлът не се чете z\.ifc$/.test(j.error), j.error);
  st = await run(BROKER, "jobs.status", { id: g5.job_id }); assert.deepStrictEqual([st.state, st.error_code, st.retryable], ["failed", "FILE_CORRUPT", false]);
  const c6 = await cb("claim", { job_id: g6.job_id, run: "611.1" }); assert.ok(c6.body.claimed);
  assert.strictEqual((await cb("finish", { job_id: g6.job_id, run: "611.1", outcome: "failed", error_code: "STORAGE_FAILED", error: "мрежата", retryable: true })).body.retry, true);
  j = await job(g6.job_id); assert.strictEqual(j.status, "queued", "временна грешка → нов опит"); assert.ok(new Date(j.next_attempt_at) > new Date());
  assert.deepStrictEqual((await cb("claim", { job_id: g6.job_id, run: "612.1" })).body.reason, "not_due", "преди изчакването не се взима");
  st = await run(BROKER, "jobs.status", { id: g6.job_id }); assert.ok(st.retry_at && st.error_code === "STORAGE_FAILED");
  assert.strictEqual((await cb("finish", { job_id: g6.job_id, run: "611.1", outcome: "failed", error_code: "TEST_UNKNOWN_CODE" })).status, 409);
  done("неуспех: повреден файл → окончателно (без нов опит, с код и чист текст); временна грешка → връщане в опашката с изчакване; непознат код не минава");

  /* 9 */
  const i3 = await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-other.ifc") });
  await cb("claim", { job_id: i3.job_id, run: "620.1" });
  const cx = keep(await run(ADMIN, "jobs.cancel", { id: i3.job_id })); assert.ok(cx.cancel_requested && cx.status === "running");
  assert.strictEqual((await cb("beat", { job_id: i3.job_id, run: "620.1", progress: { phase: "inspect" } })).body.cancel, true, "пулсът съобщава отмяната");
  assert.deepStrictEqual((await cb("finish", { job_id: i3.job_id, run: "620.1", outcome: "cancelled" })).body, { ok: true, status: "cancelled" });
  assert.strictEqual((await job(i3.job_id)).status, "cancelled");
  assert.deepStrictEqual((await cb("claim", { job_id: i3.job_id, run: "621.1" })).body.reason, "finished", "повторно пускане за приключила задача → няма работа (идемпотентно)");
  const i3r = await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-other.ifc") }); assert.ok(i3r.created && i3r.revision === 1 && i3r.job_id !== i3.job_id, "след отмяна същият файл → нова ревизия");
  assert.ok((await job(i3r.job_id)).idempotency_key.endsWith(":r1"));
  const i3x = await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-building.ifc"), rerun: true }); assert.ok(i3x.created && i3x.revision === 1, "rerun:true → нова проверка");
  done("отмяна: jobs.cancel → пулсът казва „спри“ → задачата е cancelled; ново пускане за приключила задача не прави нищо; същият файл след отмяна или с rerun → нова ревизия");

  /* 10 */
  await fails(403, /само администратор/, () => run(BROKER, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-building.ifc") }), "брокер");
  await fails(404, /Сградата не е намерена/, () => run(ADMIN, "models.request", { project_id: PID, building_id: "ffffffffffffffffffffffffffffffff", path: cadPath("TEST-building.ifc") }), "няма сграда");
  await kit.svc("update nd_projects set status='draft' where id=$1", [other.P.id]);
  await fails(403, /друг проект/, () => run(ADMIN, "models.request", { project_id: PID, building_id: other.B.id, path: cadPath("TEST-building.ifc") }), "сграда от друг проект");
  await fails(400, /От PDF не се прави 3D модел.*NEEDS_SOURCE/, () => run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-plan.pdf") }), "PDF");
  await fails(400, /DWG \(AutoCAD 2018 \(AC1032\)\) не се конвертира.*NEEDS_DXF_OR_IFC/, () => run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-drawing.dwg") }), "DWG без конвертор");
  await fails(409, /първо пуснете cad\.inspect.*NOT_INSPECTED/, () => run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-2d.dxf") }), "непроверен файл");
  const d2 = await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-2d.dxf") });
  await fails(409, /още върви/, () => run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-2d.dxf") }), "проверката още върви");
  await cb("claim", { job_id: d2.job_id, run: "630.1" });
  await cb("finish", { job_id: d2.job_id, run: "630.1", outcome: "ok", report: { format: "dxf", is_3d: false, convertible: false, convert_reason_bg: "Чертежът е 2D (няма височини) – TEST" }, source: { sha256: sha(F.HEADS.dxf), bytes: F.HEADS.dxf.length } });
  await fails(400, /не може да се направи 3D модел: Чертежът е 2D.*NEEDS_SOURCE/, () => run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-2d.dxf") }), "2D чертеж");
  assert.strictEqual((await kit.svc("select count(*)::int n from nd_jobs where kind='cad_convert'"))[0].n, 0, "нито един отказ не е създал задача за конверсия");
  done("models.request – откази без задача: брокер 403, чужда сграда 403, PDF 400, DWG без конвертор 400, непроверен файл 409, проверка в ход 409, 2D чертеж 400 (с причината от проверката)");

  /* 11 */
  const mapping = { units: [{ code: "TEST-101", refs: ["TEST-GUID-SPACE-1"] }], control: [{ label: "дължина по чертеж", axis: "length", meters: 12 }] };
  const m1 = keep(await run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-building.ifc"), mapping }));
  assert.ok(m1.created && m1.dispatched && m1.state === "queued"); noLeak(m1, "models.request");
  j = await job(m1.job_id); assert.strictEqual(j.kind, "cad_convert"); assert.strictEqual(j.input.building_id, BID); assert.strictEqual(j.input.inspect_job, i1.job_id); assert.deepStrictEqual(j.input.mapping, mapping);
  assert.ok(j.idempotency_key.startsWith("cad_convert:" + BID + ":" + sha(IFC) + ":m"));
  assert.strictEqual((await run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-building.ifc"), mapping })).job_id, m1.job_id, "същият вход → същата задача");
  const m1o = await run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-building.ifc") }); assert.ok(m1o.created && m1o.job_id !== m1.job_id, "друго съответствие → друга задача");
  const cc = await cb("claim", { job_id: m1.job_id, run: "700.1" });
  assert.ok(cc.body.claimed && cc.body.job.kind === "cad_convert");
  assert.deepStrictEqual(cc.body.structure, { building_id: BID, floors: S.floors.map((f) => ({ id: f.id, level: f.level, label: f.label })), units: S.units.map((u) => ({ id: u.id, code: u.code, floor_id: u.floor_id })) });
  assert.ok(!/price|status|area/.test(JSON.stringify(cc.body.structure)), "към изпълнителя не отиват цени и статуси");
  assert.deepStrictEqual(cc.body.mapping, mapping); assert.ok(cc.body.limits.minutes === L.LIMITS.convertMinutes && cc.body.limits.glb_bytes === L.LIMITS.glbOutBytes);
  const glbPath = "projects/" + PID + "/private/derived/models/" + m1.job_id + "/a1-model.glb", posterPath = glbPath.replace("model.glb", "poster.jpg");
  assert.strictEqual(pathOf(cc.body.upload.glb.url).path, glbPath); assert.strictEqual(pathOf(cc.body.upload.poster.url).path, posterPath); assert.strictEqual(pathOf(cc.body.upload.glb.url).kind, "put");
  const ids = { f1: S.floors[0].id, f2: S.floors[1].id, u1: S.units[0].id, u2: S.units[1].id };
  const GLB = F.testModel(ids), POSTER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7)]);
  const crep = { status: "EXACT", units: { source: { length: "MILLIMETRE" }, model: "m" }, origin: { offset_m: [1, 2, 0] }, axes: { model: "Y нагоре" }, bbox: { dimensions_m: { length: 12, width: 8, height: 6 } },
    control_dimensions: [{ label: "дължина", axis: "length", source_m: 12, model_m: 12, result: "PASS" }], missing_geometry: [], warnings: ["TEST предупреждение"], source_triangles: 48, author: "TEST", tools: { IfcOpenShell: "0.9.0" } };
  const cmap = { version: 1, floors: [{ floor_id: ids.f1, level: 1, method: "label" }], units: [{ unit_id: ids.u1, code: "TEST-101", method: "zone" }], rules: ["TEST"], path: "x" };
  const fin = (jobId, runId, glb, extra) => cb("finish", Object.assign({ job_id: jobId, run: runId, outcome: "ok", report: crep, mapping: cmap, glb: { bytes: glb.length, sha256: sha(glb), path: "projects/" + other.P.id + "/public/evil.glb" }, source: { sha256: sha(IFC), bytes: IFC.length, format: "ifc" } }, extra || {}));
  // сървърът проверява сам качения файл
  assert.deepStrictEqual((await fin(m1.job_id, "700.1", GLB)).body, { ok: true, status: "failed", reason: "ARTIFACT_INVALID" }, "файлът не е качен");
  j = await job(m1.job_id); assert.ok(j.status === "failed" && /ARTIFACT_INVALID/.test(j.error) && /не е качен/.test(j.error));
  const again = async (label, glbBuf, tweak, runId) => {
    const r = await run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-building.ifc"), mapping, rerun: true });
    const c = await cb("claim", { job_id: r.job_id, run: runId }); assert.ok(c.body.claimed, label);
    kit.put(pathOf(c.body.upload.glb.url).path, glbBuf);
    return { id: r.job_id, res: await fin(r.job_id, runId, tweak && tweak.reported ? tweak.reported : glbBuf, tweak && tweak.extra), poster: pathOf(c.body.upload.poster.url).path };
  };
  let a = await again("авторски надпис", F.testModel(ids, { mutate: (g) => { g.asset.copyright = "TEST"; } }), null, "701.1");
  assert.strictEqual(a.res.body.reason, "ARTIFACT_INVALID"); assert.ok(/авторски надпис/.test((await job(a.id)).error)); assert.ok((await job(a.id)).result.artifact_errors.length >= 1);
  a = await again("хешът не съвпада", GLB, { reported: F.testModel(ids, { mutate: (g) => { g.nodes[0].name = "x"; } }) }, "702.1"); assert.ok(/не съвпада с отчетения/.test((await job(a.id)).error));
  a = await again("обект от друга сграда", F.testModel(Object.assign({}, ids, { u1: other.units[0].id })), null, "703.1"); assert.ok(/не е от тази сграда/.test((await job(a.id)).error));
  a = await again("Draco", F.testModel(ids, { mutate: (g) => { g.extensionsRequired = ["KHR_draco_mesh_compression"]; g.extensionsUsed = ["KHR_draco_mesh_compression"]; } }), null, "704.1"); assert.ok(/Draco/.test((await job(a.id)).error));
  a = await again("друг източник", GLB, { extra: { source: { sha256: "f".repeat(64), bytes: 5, format: "ifc" } } }, "705.1"); assert.strictEqual(a.res.body.reason, "SOURCE_CHANGED");
  assert.strictEqual((await kit.svc("select count(*)::int n from nd_models"))[0].n, 0, "нито един невалиден резултат не е станал версия");
  done("models.request + взимане: структурата на сградата (без цени/статуси), съответствието и адреси за качване; сървърът САМ тегли и проверява готовия файл: липсващ, с авторски надпис, с друг хеш, с чужд обект, с Draco, от друг източник → отказ, без версия");

  /* 12 */
  const okJob = await again("валиден", GLB, null, "710.1");
  assert.deepStrictEqual(okJob.res.body, { ok: true, status: "review", model_version: 1, replayed: false });
  let M = (await kit.svc("select * from nd_models where job_id=$1", [okJob.id]))[0];
  assert.deepStrictEqual([M.version, M.status, M.fidelity, M.source_format, M.source_sha256, M.glb_sha256, Number(M.glb_bytes), M.poster_path], [1, "review", "exact", "ifc", sha(IFC), sha(GLB), GLB.length, null]);
  assert.strictEqual(M.glb_path, "projects/" + PID + "/private/derived/models/" + okJob.id + "/a1-model.glb", "пътят е сметнат от сървъра; подаденият от изпълнителя път е пренебрегнат");
  assert.deepStrictEqual([M.stats.triangles, M.stats.units_mapped, M.stats.floors_mapped, M.stats.units_total, M.stats.floors_total, M.stats.source_triangles], [48, 2, 2, 2, 2, 48]);
  assert.deepStrictEqual(M.stats.bbox.size, [12, 6, 8]); assert.ok(!("unit_ids" in M.stats) && !("author" in M.report) && !("path" in M.mapping) && M.report.tools.IfcOpenShell === "0.9.0");
  j = await job(okJob.id); assert.deepStrictEqual([j.status, j.result.state, j.result.model_version, j.result.fidelity], ["review", "needs_review", 1, "exact"]);
  assert.deepStrictEqual((await fin(okJob.id, "710.1", GLB)).body, { ok: true, replayed: true, status: "review" }, "повтор на отчитането → същото, без втора версия");
  assert.strictEqual((await fin(okJob.id, "799.1", GLB)).status, 409, "друго пускане след края → нищо");
  st = keep(await run(BROKER, "jobs.status", { id: okJob.id })); assert.ok(st.requires_review && st.state === "needs_review" && /models\.publish само след изрично/.test(st.next)); noLeak(st, "jobs.status review");
  // с изглед (poster) и мрежов източник: „exact“ не се приема за GLB
  const g2 = await run(ADMIN, "models.request", { project_id: PID, building_id: BID, path: cadPath("TEST-building.ifc"), mapping, rerun: true });
  const c2 = await cb("claim", { job_id: g2.job_id, run: "711.1" }); kit.put(pathOf(c2.body.upload.glb.url).path, GLB); kit.put(pathOf(c2.body.upload.poster.url).path, POSTER);
  const f2 = await fin(g2.job_id, "711.1", GLB, { poster: { bytes: POSTER.length, sha256: sha(POSTER) }, source: { sha256: sha(IFC), bytes: IFC.length, format: "glb" } });
  assert.strictEqual(f2.body.model_version, 2);
  M = (await kit.svc("select * from nd_models where job_id=$1", [g2.job_id]))[0]; assert.deepStrictEqual([M.fidelity, M.source_format, M.poster_path.endsWith("a1-poster.jpg")], ["verified", "glb", true]);
  done("приет резултат: нова версия „чака преглед“ с данни от проверката на СЪРВЪРА (триъгълници, размери, свързани обекти/етажи), чист отчет; повторът не прави втора версия; „exact“ не се приема за мрежов източник");

  /* 13 */
  await fails(404, /Сградата не е намерена/, () => run(BROKER, "models.get", { building_id: "ffffffffffffffffffffffffffffffff" }), "няма сграда");
  let mg = keep(await run(BROKER, "models.get", { building_id: BID }));
  assert.deepStrictEqual([mg.published_version, mg.versions.length, mg.versions[0].version, mg.versions[0].status_bg, mg.selected.version], [null, 2, 2, "Чака преглед", 2]);
  assert.ok(mg.selected.report.status === "EXACT" && mg.selected.mapping.units[0].code === "TEST-101" && mg.selected.has_poster === true && !mg.selected.preview_url); noLeak(mg, "models.get");
  mg = await run(BROKER, "models.get", { building_id: BID, version: 1, preview: true });
  assert.ok(mg.selected.version === 1 && mg.selected.preview_url.startsWith(base + "/s/get/") && mg.selected.preview_expires_in === 60);
  assert.strictEqual(pathOf(mg.selected.preview_url).path, "projects/" + PID + "/private/derived/models/" + okJob.id + "/a1-model.glb"); assert.ok(pathOf(mg.selected.preview_url).exp - Date.now() <= 60000);
  await fails(404, /Няма такава версия/, () => run(BROKER, "models.get", { building_id: BID, version: 9 }), "няма версия");
  assert.strictEqual((await kit.as("authenticated", VISITOR, () => kit.q("select count(*)::int n from nd_models")))[0].n, 0, "не-служител не вижда версии");
  done("models.get: екипът вижда версиите, отчета и съответствието; адрес за преглед само при поискване (60 s); без пътища; не-служител не вижда нищо");

  /* 14 */
  await fails(400, /Invalid input/, () => run(ADMIN, "models.publish", { job_id: okJob.id, building_id: BID }), "без потвърждение");
  await fails(403, /само от администратор.*FORBIDDEN/, () => run(BROKER, "models.publish", { job_id: okJob.id, building_id: BID, confirm: true }), "брокер");
  await fails(403, /друга сграда/, () => run(ADMIN, "models.publish", { job_id: okJob.id, building_id: other.B.id, confirm: true }), "друга сграда");
  await fails(404, /няма готов модел/, () => run(ADMIN, "models.publish", { job_id: i1.job_id, building_id: BID, confirm: true }), "задача без модел");
  await fails(409, /сменен от друг.*DB_CONFLICT/, () => run(ADMIN, "models.publish", { job_id: okJob.id, building_id: BID, confirm: true, expected_published_version: 3 }), "NC409");
  assert.strictEqual((await pub("/api/tools?model=" + BID)).statusCode, 404, "преди публикуване навън няма модел");
  const p1 = keep(await run(ADMIN, "models.publish", { job_id: okJob.id, building_id: BID, confirm: true, expected_published_version: 0 }));
  assert.deepStrictEqual([p1.model_public, p1.version, p1.previous_version, p1.replayed], [true, 1, null, false]); noLeak(p1, "models.publish");
  assert.strictEqual((await job(okJob.id)).status, "done", "одобрената задача е приключена");
  assert.strictEqual((await run(ADMIN, "models.publish", { job_id: okJob.id, building_id: BID, confirm: true })).replayed, true);
  assert.strictEqual((await pub("/api/tools?model=" + BID)).statusCode, 404, "проектът е чернова → моделът не излиза навън");
  await kit.publishProject(PID, "test-proekt-3d");
  let r = await pub("/api/tools?model=" + BID);
  assert.strictEqual(r.statusCode, 302); assert.ok(r.headers.location.startsWith(base + "/s/get/"));
  assert.deepStrictEqual([r.headers["cache-control"], r.headers["x-robots-tag"], r.headers["referrer-policy"]], ["no-store, max-age=0", "noindex", "no-referrer"]);
  assert.strictEqual(pathOf(r.headers.location).path, "projects/" + PID + "/private/derived/models/" + okJob.id + "/a1-model.glb"); assert.ok(pathOf(r.headers.location).exp - Date.now() <= 60000, "подписът важи 60 s");
  const viaHttp = await new Promise((res, rej) => require("http").get(base + "/model/" + BID, (x) => { const ch = []; x.on("data", (c) => ch.push(c)); x.on("end", () => res({ status: x.statusCode, loc: x.headers.location })); }).on("error", rej));
  assert.strictEqual(viaHttp.status, 302, "/model/<сграда> през HTTP");
  const bytes = await new Promise((res, rej) => require("http").get(viaHttp.loc, (x) => { const ch = []; x.on("data", (c) => ch.push(c)); x.on("end", () => res(Buffer.concat(ch))); }).on("error", rej));
  assert.strictEqual(sha(bytes), sha(GLB), "публиката получава точно проверения оптимизиран файл");
  assert.strictEqual((await pub("/api/tools?model=" + BID + "/poster")).statusCode, 404, "версия 1 няма изглед");
  for (const bad of ["../../etc/passwd", "x", BID + "/../y", BID + "/original", ""]) assert.strictEqual((await pub("/api/tools?model=" + encodeURIComponent(bad))).statusCode, 400, "невалиден адрес: " + bad);
  assert.strictEqual((await pub("/api/tools?model=" + other.B.id)).statusCode, 404, "сграда без модел");
  const pubIdx = (await kit.as("anon", null, () => kit.q("select nd_public_models('test-proekt-3d') as r")))[0].r;
  assert.deepStrictEqual(Object.keys(pubIdx), [BID]); assert.deepStrictEqual([pubIdx[BID].version, pubIdx[BID].units, pubIdx[BID].floors, pubIdx[BID].fidelity, pubIdx[BID].poster], [1, 2, 2, "exact", false]); noLeak(pubIdx, "nd_public_models");
  done("публикуване: без потвърждение 400, брокер 403, друга сграда 403, NC409 → 409; навън само за публикуван проект + публикувана версия: /model/<сграда> → 302 към подписан адрес (60 s, no-store, noindex); публиката получава точно проверения файл; невалидни адреси 400");

  /* 15 */
  const p2 = await run(ADMIN, "models.publish", { job_id: g2.job_id, building_id: BID, confirm: true, expected_published_version: 1 });
  assert.deepStrictEqual([p2.version, p2.previous_version], [2, 1]); assert.ok(/предишната v1 е запазена/.test(p2.message));
  assert.strictEqual(pathOf((await pub("/api/tools?model=" + BID)).headers.location).path.includes(g2.job_id), true);
  assert.strictEqual((await pub("/api/tools?model=" + BID + "/poster")).statusCode, 302, "версия 2 има изглед, нарисуван от модела");
  await fails(409, /по-нова версия.*rollback/, () => run(ADMIN, "models.publish", { job_id: okJob.id, building_id: BID, confirm: true, expected_published_version: 2 }), "по-стара върху по-нова");
  const rb = await run(ADMIN, "models.publish", { job_id: okJob.id, building_id: BID, confirm: true, expected_published_version: 2, rollback: true });
  assert.deepStrictEqual([rb.version, rb.previous_version], [1, 2]);
  assert.strictEqual(pathOf((await pub("/api/tools?model=" + BID)).headers.location).path.includes(okJob.id), true, "връщането назад сменя само указателя към предишната неизменима версия");
  await fails(403, /само от администратор/, () => run(BROKER, "models.unpublish", { building_id: BID, expected_published_version: 1, confirm: true }), "брокер сваля");
  await fails(409, /DB_CONFLICT/, () => run(ADMIN, "models.unpublish", { building_id: BID, expected_published_version: 2, confirm: true }), "NC409 при сваляне");
  const un = keep(await run(ADMIN, "models.unpublish", { building_id: BID, expected_published_version: 1, confirm: true })); assert.deepStrictEqual([un.model_public, un.changed, un.previous_version], [false, true, 1]);
  assert.strictEqual((await pub("/api/tools?model=" + BID)).statusCode, 404);
  mg = await run(BROKER, "models.get", { building_id: BID }); assert.deepStrictEqual(mg.versions.map((v) => [v.version, v.status]), [[2, "retired"], [1, "retired"]]);
  assert.strictEqual(B.storage.get(cadPath("TEST-building.ifc")).equals(IFC), true, "оригиналният файл е непокътнат");
  done("версии: нова публикувана → старата се пази; по-стара върху по-нова само с rollback (иначе 409); връщането назад работи; сваляне от сайта; оригиналът е непокътнат");

  /* 16 */
  kit.put(cadPath("TEST-changed.ifc"), Buffer.concat([F.HEADS.ifc, Buffer.from("v1")]));
  const ch = await run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-changed.ifc") });
  kit.put(cadPath("TEST-changed.ifc"), Buffer.concat([F.HEADS.ifc, Buffer.from("v2-different")]));
  assert.deepStrictEqual((await cb("claim", { job_id: ch.job_id, run: "800.1" })).body, { ok: true, claimed: false, status: "failed", reason: "SOURCE_CHANGED" });
  assert.ok(/SOURCE_CHANGED/.test((await job(ch.job_id)).error));
  const evil = (await kit.as("authenticated", ADMIN, () => kit.q("select nd_job_create('cad_inspect','cad_inspect:test:evil:path:0001',$1,$2) as r", [PID, JSON.stringify({ path: "projects/" + other.P.id + "/private/cad/TEST-foreign.ifc" })])))[0].r.id;
  assert.strictEqual((await cb("claim", { job_id: evil, run: "801.1" })).body.reason, "INVALID_INPUT", "задача с път извън проекта не получава адрес");
  const evil2 = (await kit.as("authenticated", ADMIN, () => kit.q("select nd_job_create('cad_inspect','cad_inspect:test:evil:path:0002',$1,$2) as r", [PID, JSON.stringify({ path: "projects/" + PID + "/private/cad/../../../" + other.P.id + "/private/cad/TEST-foreign.ifc" })])))[0].r.id;
  assert.strictEqual((await cb("claim", { job_id: evil2, run: "802.1" })).body.reason, "INVALID_INPUT", "път с „..“");
  B.failStorage = 1; kit.put(cadPath("TEST-flaky.ifc"), Buffer.concat([F.HEADS.ifc, Buffer.from("flaky")]));
  await fails(503, /STORAGE_FAILED/, () => run(ADMIN, "cad.inspect", { project_id: PID, path: cadPath("TEST-flaky.ifc") }), "хранилището не отговаря");
  done("сменен файл след заявката → SOURCE_CHANGED (окончателно); път извън проекта или с „..“ в задачата → без адрес; временен отказ на хранилището → 503 без задача");

  /* 17 */
  const all = outputs.join("\n") + "\n" + logs.join("\n") + "\n" + JSON.stringify(B.dispatches) + "\n" + JSON.stringify(await kit.svc("select input, progress, result, error from nd_jobs")) + JSON.stringify(await kit.svc("select stats, report, mapping from nd_models"));
  SECRETS.forEach((s) => assert.ok(!all.includes(s), "тайна в изход, лог или база"));
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}\./.test(all), "няма JWT в изходите");
  assert.ok(logs.every((l) => !/https?:\/\//.test(l) && !/projects\//.test(l)), "логовете са без адреси и пътища: " + logs.join(" | ").slice(0, 300));
  done("никъде – в отговори, логове, повиквания към GitHub, задачи и версии – няма ключ, тайна, токен или подписан адрес от сървъра");

  await kit.close();

  /* 18 */
  const kit2 = await K.create({ without005: true });
  const S2 = await kit2.seed(); kit2.put("projects/" + S2.P.id + "/private/cad/TEST.ifc", IFC);
  const run2 = (uid, tool, input) => NC.tools[tool].run(kit2.ctx(uid), NC.tools[tool].input.safeParse(input).data);
  const e1 = await run2(ADMIN, "models.get", { building_id: S2.B.id }).then(() => null, (e) => e); assert.ok(e1 && e1.status === 503 && /MIGRATION_MISSING/.test(e1.message));
  const e2 = await run2(ADMIN, "models.publish", { job_id: "00000000-0000-4000-8000-0000000000aa", building_id: S2.B.id, confirm: true }).then(() => null, (e) => e); assert.ok(e2 && e2.status === 503);
  const ok2 = await run2(ADMIN, "cad.inspect", { project_id: S2.P.id, path: "projects/" + S2.P.id + "/private/cad/TEST.ifc" }); assert.ok(ok2.created, "проверката не зависи от nc_005");
  assert.strictEqual((await pub("/api/tools?model=" + S2.B.id)).statusCode, 404);
  await kit2.close();
  done("без миграция nc_005 (или след обратния скрипт): models.* → 503 „липсва миграцията“, /model/ → 404, cad.inspect продължава да създава задача; нищо друго не се чупи");

  console.error = origErr;
  console.log("\n" + n + "/" + n + " минали");
})().catch((e) => { console.error = origErr; console.error("FATAL", e); process.exit(1); });
