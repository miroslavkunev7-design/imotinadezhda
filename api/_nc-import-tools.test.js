// Тест: инструментите на импорта през истинския код на api/_nc-import.js (адаптери със service role, взимане/парче/край на задачата,
// идемпотентност, фонов режим, отмяна, срив и нов опит, запис, повтор, права, изтичане на пътища) – срещу фалшив Supabase в паметта.
// Без мрежа: fetch и ctx.sb са подменени. Ключовете са очевидно тестови.   node api/_nc-import-tools.test.js
"use strict";
const assert = require("assert");
process.env.SUPABASE_SERVICE_ROLE_KEY = "TEST-SERVICE-ROLE-NOT-A-REAL-KEY";
const I = require("./_nc-import.js"), E = require("./_nc-import-engine.js"), F = require("./_nc-import-fixtures.js"), NC = require("./_nc-tools.js");
let n = 0; const done = (name) => { n++; console.log("PASS  " + name); };
const SB = "https://hyvwfsmjbaynozceookv.supabase.co";
const ADMIN = "00000000-0000-4000-8000-000000000001", BROKER = "00000000-0000-4000-8000-000000000002", BROKER2 = "00000000-0000-4000-8000-000000000003";
const ROLE = { [ADMIN]: "admin", [BROKER]: "broker", [BROKER2]: "broker" };
const PID = "0123456789abcdef0123456789abcdef", PUB = "fedcba9876543210fedcba9876543210";

/* ---------- фалшив бекенд ---------- */
const B = { storage: new Map(), jobs: new Map(), projects: new Map(), units: [], buildings: [], floors: [], calls: [], hasClaimId: true, hasApply: true, failGet: 0, applyPayloads: [] };
const now = () => new Date().toISOString();
B.projects.set(PID, { id: PID, name: "TEST-ПРОЕКТ", status: "draft", version: 1, content_rev: 1, data: { title: "TEST-ПРОЕКТ" } });
B.projects.set(PUB, { id: PUB, name: "TEST-ПУБЛИКУВАН", status: "published", version: 2, content_rev: 3, data: {} });
const KINDS = { import: { max_attempts: 3, admin: false, heavy: false }, cad_inspect: { max_attempts: 3, admin: true, heavy: true } };
const resp = (status, body, headers) => new Response(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body), { status, headers: Object.assign({ "content-type": "application/json" }, headers || {}) });
function claimRow(j, worker) { Object.assign(j, { status: "running", attempts: j.attempts + 1, locked_by: worker, locked_at: now(), heartbeat_at: now(), updated_at: now() }); return Object.assign({}, j); }
global.fetch = async (url, o) => {
  o = o || {}; const u = new URL(url); const method = o.method || "GET";
  B.calls.push(method + " " + u.pathname.replace(/^\/(rest|storage)\/v1\//, ""));
  if (u.origin === "https://imotinadezhda.bg" && u.pathname === "/api/scan") return resp(200, { ok: true, fields: { key: "floor_plan", title: "TEST-план", confidence: 0.63, person: "TEST-Лице", summary: "TEST" }, model: "TEST-MODEL" });
  if (u.origin !== SB) throw new Error("неочаквана мрежа: " + url);
  if (!/^Bearer TEST-SERVICE-ROLE/.test((o.headers || {}).Authorization || "")) return resp(401, { message: "no key" });
  if (u.pathname.startsWith("/storage/v1/object/nd-files/")) {
    const p = decodeURIComponent(u.pathname.slice("/storage/v1/object/nd-files/".length));
    if (method === "GET") { if (B.failGet > 0) { B.failGet--; return resp(500, { error: "TEST" }); } return B.storage.has(p) ? resp(200, B.storage.get(p), { "content-length": String(B.storage.get(p).length) }) : resp(400, { error: "not_found" }); }
    if (method === "POST") { if (o.headers["x-upsert"] === "false" && B.storage.has(p)) return resp(409, { error: "Duplicate" }); B.storage.set(p, Buffer.from(o.body)); return resp(200, { Key: p }); }
  }
  const body = o.body ? JSON.parse(o.body) : {};
  if (u.pathname.startsWith("/rest/v1/rpc/")) {
    const fn = u.pathname.slice(13), j = body.p_id && B.jobs.get(body.p_id);
    if (fn === "nd_job_claim_id") {
      if (!B.hasClaimId) return resp(404, { code: "PGRST202", message: "Could not find the function" });
      if (!j || j.status !== "queued" || j.cancel_requested || new Date(j.next_attempt_at) > new Date()) return resp(200, { id: null });
      return resp(200, claimRow(j, body.p_worker));
    }
    if (fn === "nd_job_claim") { const q = [...B.jobs.values()].filter((x) => body.p_kinds.includes(x.kind) && x.status === "queued" && !x.cancel_requested && new Date(x.next_attempt_at) <= new Date()).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0]; return resp(200, q ? claimRow(q, body.p_worker) : { id: null }); }
    if (fn === "nd_job_heartbeat") { if (!j || j.status !== "running" || j.locked_by !== body.p_worker) return resp(200, true); j.heartbeat_at = now(); if (body.p_progress) j.progress = body.p_progress; return resp(200, j.cancel_requested); }
    if (fn === "nd_job_yield") { if (!j || j.locked_by !== body.p_worker) return resp(403, { code: "42501" }); Object.assign(j, j.cancel_requested ? { status: "cancelled", finished_at: now() } : { status: "queued", attempts: Math.max(j.attempts - 1, 0), chunks: j.chunks + 1, next_attempt_at: now() }, { locked_by: null, progress: body.p_progress || j.progress }); return resp(200, j); }
    if (fn === "nd_job_finish") {
      if (!j || j.locked_by !== body.p_worker) return resp(403, { code: "42501" });
      if (body.p_status === "failed" && j.attempts < j.max_attempts && !j.cancel_requested) Object.assign(j, { status: "queued", error: body.p_error, locked_by: null, next_attempt_at: new Date(Date.now() + 60000).toISOString() });
      else Object.assign(j, { status: j.cancel_requested && body.p_status !== "done" ? "cancelled" : body.p_status, result: body.p_result || j.result, error: body.p_error, locked_by: null, finished_at: now() });
      return resp(200, j);
    }
    return resp(404, { code: "PGRST202" });
  }
  const table = u.pathname.slice(9), eq = (k) => { const v = u.searchParams.get(k); return v && v.startsWith("eq.") ? v.slice(3) : null; };
  if (table === "nd_projects") return resp(200, [...B.projects.values()].filter((p) => p.id === eq("id")));
  if (table === "nd_buildings") return resp(200, B.buildings.filter((x) => x.project_id === eq("project_id")));
  if (table === "nd_floors") return resp(200, B.floors.filter((x) => x.project_id === eq("project_id")).map((x) => Object.assign({}, x, { plan: x.data.plan || null })));
  if (table === "nd_units") return resp(200, B.units.filter((x) => x.project_id === eq("project_id")).map((x) => Object.assign({}, x, { d: x.data })));
  if (table === "nd_jobs") return resp(200, [...B.jobs.values()].filter((x) => x.kind === "import" && x.project_id === eq("project_id") && x.id !== (u.searchParams.get("id") || "").slice(4) && ["review", "done"].includes(x.status)).map((x) => ({ id: x.id, h: (x.result || {}).source_hashes || null })));
  return resp(404, { message: "?" });
};
let jseq = 0;
const uuid = () => "00000000-0000-4000-9000-" + String(++jseq).padStart(12, "0");
function sbFor(uid) {
  const staff = !!ROLE[uid], admin = ROLE[uid] === "admin";
  class Q {
    constructor(t) { this.t = t; this.f = []; }
    select() { return this; } eq(k, v) { this.f.push((r) => String(r[k]) === String(v)); return this; } like(k, pat) { const pre = pat.replace(/%$/, ""); this.f.push((r) => String(r[k]).startsWith(pre)); return this; }
    order(k, o) { this.ord = [k, o && o.ascending === false ? -1 : 1]; return this; } limit(x) { this.lim = x; return this; } maybeSingle() { this.one = true; return this; }
    then(res, rej) {
      const src = this.t === "nd_jobs" ? [...B.jobs.values()] : this.t === "nd_projects" ? [...B.projects.values()] : [];
      let rows = staff ? src.filter((r) => this.f.every((f) => f(r))).map((r) => JSON.parse(JSON.stringify(r))) : [];
      if (this.ord) rows.sort((a, b) => (a[this.ord[0]] < b[this.ord[0]] ? -this.ord[1] : this.ord[1]));
      if (this.lim) rows = rows.slice(0, this.lim);
      return Promise.resolve({ data: this.one ? rows[0] || null : rows, error: null }).then(res, rej);
    }
  }
  const E2 = (code, message) => ({ data: null, error: { code, message } });
  return {
    from: (t) => new Q(t),
    rpc: async (fn, a) => {
      if (fn === "nd_is_admin") return { data: admin, error: null };
      if (fn === "nd_job_create") {
        const k = KINDS[a.p_kind]; if (!k) return E2("22023", "Непознат вид задача"); if (k.admin && !admin) return E2("42501", "Този вид задача се пуска само от администратор");
        if (!/^[A-Za-z0-9:._-]{8,200}$/.test(a.p_key)) return E2("22023", "Невалиден ключ за повторяемост");
        if (JSON.stringify(a.p_input).length > 65536) return E2("22023", "Невалидни входни данни");
        const ex = [...B.jobs.values()].find((j) => j.idempotency_key === a.p_key);
        if (ex) return ex.actor_user_id !== uid ? E2("23505", "Ключът вече е използван") : { data: { ok: true, created: false, id: ex.id, kind: ex.kind, status: ex.status }, error: null };
        const j = { id: uuid(), kind: a.p_kind, idempotency_key: a.p_key, status: "queued", project_id: a.p_project_id, input: a.p_input, progress: {}, result: {}, error: null, attempts: 0, max_attempts: k.max_attempts, chunks: 0, crash_count: 0, next_attempt_at: now(), locked_by: null, heartbeat_at: null, cancel_requested: false, actor_user_id: uid, created_at: now() + ":" + jseq, updated_at: now() };
        B.jobs.set(j.id, j); return { data: { ok: true, created: true, id: j.id, kind: j.kind, status: j.status }, error: null };
      }
      if (fn === "nd_job_cancel") {
        const j = B.jobs.get(a.p_id); if (!j) return E2("P0002", "Задачата не е намерена");
        if (j.actor_user_id !== uid && !admin) return E2("42501", "Само авторът или администратор отменя задача");
        if (["done", "failed", "cancelled"].includes(j.status)) return { data: { ok: true, id: j.id, status: j.status, changed: false }, error: null };
        if (["queued", "review"].includes(j.status)) Object.assign(j, { status: "cancelled", cancel_requested: true }); else j.cancel_requested = true;
        return { data: { ok: true, id: j.id, status: j.status, changed: true, cancel_requested: j.cancel_requested }, error: null };
      }
      if (fn === "nd_import_apply") {
        if (!B.hasApply) return E2("PGRST202", "Could not find the function public.nd_import_apply");
        B.applyPayloads.push(JSON.parse(JSON.stringify(a)));
        const j = B.jobs.get(a.p_job_id), p = B.projects.get(a.p_project_id);
        if (j.actor_user_id !== uid && !admin) return E2("42501", "Само авторът на импорта или администратор записва черновата");
        if (j.status === "done") return { data: Object.assign({ replayed: true }, j.result.applied), error: null };
        if (j.status !== "review") return E2("NC409", "Импортът не чака преглед");
        if (p.content_rev !== a.p_expected_content_rev) return E2("NC409", "Проектът е променен след анализа – пуснете анализа отново");
        if (p.status === "published" && !admin && (a.p_payload.units || []).length) return E2("42501", "В публикуван проект обект добавя само администратор");
        const receipt = { project_id: p.id, job_id: j.id, created: { buildings: a.p_payload.buildings.length, floors: a.p_payload.floors.length, units: a.p_payload.units.length }, updated: { units: a.p_payload.units_update.length, floors: a.p_payload.floors_update.length, project: !!a.p_payload.project }, at: now() };
        a.p_payload.units.forEach((x) => B.units.push({ id: uuid().replace(/-/g, ""), project_id: p.id, code: x.code, status: "free", version: 1, data: x.data }));
        p.content_rev += 1 + a.p_payload.units.length; j.status = "done"; j.result = Object.assign({}, j.result, { applied: receipt });
        return { data: Object.assign({ replayed: false }, receipt), error: null };
      }
      return E2("PGRST202", "?");
    }
  };
}
const ctxFor = (uid) => ({ sb: sbFor(uid), userId: uid, user: { id: uid }, token: "TEST-USER-TOKEN-" + uid.slice(-4) });
const run = (uid, tool, input) => { const t = NC.tools[tool], v = t.input.safeParse(input); if (!v.success) { const e = new Error("Invalid input: " + JSON.stringify(v.error.issues)); e.status = 400; throw e; } return t.run(ctxFor(uid), v.data); };
const fails = async (status, fn, re) => { try { await fn(); } catch (e) { assert.strictEqual(e.status, status, e.message); if (re) assert.ok(re.test(e.message), e.message); return e; } assert.fail("очаквана грешка " + status); };
const upload = (pkg, pid, imp) => pkg.map((f, i) => { const p = "projects/" + pid + "/private/imports/" + imp + "/" + String(i).padStart(4, "0") + "-" + E.safeName(f.name); B.storage.set(p, f.data); return { path: p, name: f.name, size: f.data.length }; });
async function pollToEnd(uid, id) { let s, k = 0; do { s = await run(uid, "jobs.status", { id }); k++; } while (["queued", "running"].includes(s.status) && k < 60); return { s, k }; }
const noLeak = (o, label) => { const t = JSON.stringify(o); assert.ok(!/\/private\/|TEST-SERVICE-ROLE|TEST-USER-TOKEN|TEST-Лице/.test(t), "изтичане в " + label + ": " + (t.match(/.{40}(\/private\/|TEST-SERVICE|TEST-USER|TEST-Лице).{40}/) || [""])[0]); };

(async () => {
  /* 1. регистър и договори */
  ["imports.start", "imports.apply", "jobs.status", "jobs.result", "jobs.cancel"].forEach((k) => { assert.ok(NC.tools[k] && /Вход: \{/.test(NC.tools[k].description), k); });
  assert.ok(/jobs\.status/.test(NC.tools["imports.start"].description) && /не се публикува/.test(NC.tools["imports.start"].description));
  const big = []; for (let i = 0; i < 2001; i++) big.push({ path: "projects/" + PID + "/private/imports/aaaaaaaa/" + i + ".pdf", name: i + ".pdf" });
  assert.ok(!NC.tools["imports.start"].input.safeParse({ project_id: PID, files: big }).success, "2001 файла");
  assert.ok(!NC.tools["imports.start"].input.safeParse({ project_id: PID, files: [{ path: "projects/" + PUB + "/private/imports/aaaaaaaa/x.pdf", name: "x.pdf" }] }).success, "файл от друг проект");
  assert.ok(!NC.tools["imports.start"].input.safeParse({ project_id: PID, files: [{ path: "projects/" + PID + "/private/plans/x.pdf", name: "x.pdf" }] }).success, "само папката imports");
  assert.ok(!NC.tools["imports.start"].input.safeParse({ project_id: PID, files: [{ path: "projects/" + PID + "/private/imports/aaaaaaaa/x.pdf", name: "x.pdf", size: 41943041 }] }).success, "над 40 MB");
  assert.ok(!NC.tools["imports.start"].input.safeParse({ project_id: PID, files: [{ path: "properties/X/photos/a.jpg", name: "a.jpg" }] }).success, "никога под properties/…/photos");
  assert.ok(!NC.tools["imports.apply"].input.safeParse({ job_id: uuid(), confirm: true, accept: { units: [{ ref: "u1", floor_ref: "f1", code: "A1", meta: { deep: [{ Строител: "TEST" }] } }] } }).success, "вложен забранен ключ");
  assert.ok(!NC.tools["imports.apply"].input.safeParse({ job_id: uuid(), use_proposed: true }).success, "без confirm");
  done("регистър + договори: 5 инструмента с описания за агента; 2001 файла, чужд проект, път извън imports/, над 40 MB, photos/, вложен „Строител“, без потвърждение → отказ");

  /* 2. imports.start: идемпотентност, без service role, публикуван/архивиран проект */
  const files = upload(F.testPackage(), PID, "aaaaaaaabbbbbbbbccccccccdddddddd");
  const s1 = await run(BROKER, "imports.start", { project_id: PID, files });
  assert.ok(s1.ok && s1.created && s1.job_id && s1.state === "queued" && /^imp-/.test(s1.correlation_id));
  const s2 = await run(BROKER, "imports.start", { project_id: PID, files: files.slice().reverse() });
  assert.strictEqual(s2.job_id, s1.job_id); assert.strictEqual(s2.idempotent, true);
  const key = B.jobs.get(s1.job_id).idempotency_key; assert.ok(key.startsWith("import:" + PID + ":" + BROKER + ":"), "ключът е записан в задачата");
  assert.ok(JSON.stringify(B.jobs.get(s1.job_id).input).length < 2000, "входът на задачата е малък (списъкът е в storage)");
  await fails(404, () => run(BROKER, "imports.start", { project_id: "99999999999999999999999999999999", files: [{ path: "projects/99999999999999999999999999999999/private/imports/aaaaaaaa/x.pdf", name: "x" }] }));
  await fails(403, () => run(BROKER, "imports.start", { project_id: PUB, files: [{ path: "projects/" + PUB + "/private/imports/aaaaaaaa/x.pdf", name: "x.pdf" }] }), /FORBIDDEN/);
  const saved = process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await fails(503, () => run(BROKER, "imports.start", { project_id: PID, files }), /DOWNSTREAM_UNAVAILABLE/);
  process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  done("imports.start: job_id веднага; същите файлове (в друг ред) → същата задача; ключът се пази; без проект 404; брокер в публикуван 403; без service role 503");

  /* 3. jobs.status придвижва по едно парче; реален напредък; claim по id */
  const st = await pollToEnd(BROKER, s1.job_id);
  assert.strictEqual(st.s.status, "review"); assert.strictEqual(st.s.state, "needs_input"); assert.ok(st.s.requires_review);
  assert.ok(B.calls.filter((c) => c === "POST rpc/nd_job_claim_id").length >= 1 && !B.calls.includes("POST rpc/nd_job_claim"));
  assert.strictEqual(st.s.progress.files_done, 13); assert.strictEqual(st.s.progress.files_total, 13); assert.ok(st.s.counts.units === 7);
  noLeak(st.s, "jobs.status");
  done("jobs.status: придвижва своята задача (nd_job_claim_id) до преглед за " + st.k + " извиквания; напредъкът е файлове n/N; без пътища");

  /* 4. jobs.result: кратко резюме за агента и пълна чернова на страници за CRM; без пътища/лични данни от AI */
  const rs = await run(BROKER, "jobs.result", { id: s1.job_id });
  assert.strictEqual(rs.result.counts.units, 7); assert.ok(rs.result.conflicts.length >= 2 && rs.result.conflicts[0].sources.length >= 2); assert.ok(/CRM/.test(rs.result.hint));
  const rf = await run(BROKER, "jobs.result", { id: s1.job_id, view: "full", offset: 2, limit: 3 });
  assert.strictEqual(rf.result.units.length, 3); assert.deepStrictEqual(rf.result.page, { offset: 2, limit: 3, total: 7 });
  noLeak(rs, "jobs.result summary"); noLeak(rf, "jobs.result full");
  const ai = rf.result.files.filter((f) => f.ai_suggestion);
  assert.ok(ai.every((f) => !JSON.stringify(f.ai_suggestion).includes("TEST-Лице")), "„person“ от класификатора не се пази");
  done("jobs.result: резюме (агент) и пълна чернова на страници (CRM); без пътища към оригиналите, без лични данни от AI");

  /* 5. imports.apply: чужд служител 403; use_proposed при нерешени конфликти 409; прегледаната чернова → запис; повтор → същото */
  await fails(403, () => run(BROKER2, "imports.apply", { job_id: s1.job_id, confirm: true, use_proposed: true }), /FORBIDDEN/);
  await fails(409, () => run(BROKER, "imports.apply", { job_id: s1.job_id, confirm: true, use_proposed: true }), /CONFLICT_REQUIRES_REVIEW/);
  const pv = (await run(BROKER, "jobs.result", { id: s1.job_id, view: "full", limit: 1000 })).result;
  const acc = I.acceptFromPreview(pv);
  await fails(409, () => run(BROKER, "imports.apply", { job_id: s1.job_id, confirm: true, accept: acc }), /нерешени конфликти/);
  const a1c = pv.units.find((u) => u.code === "TEST-A1").fields.area_total.conflict;
  acc.resolved = [a1c]; acc.units.find((u) => u.code === "TEST-A1").area_total = 103.1; acc.units.find((u) => u.code === "TEST-A2").area_net = 63.05;
  const ap = await run(BROKER, "imports.apply", { job_id: s1.job_id, confirm: true, accept: acc });
  assert.ok(ap.ok && !ap.replayed && ap.published === false && ap.created.units === 5);
  const pay = B.applyPayloads[B.applyPayloads.length - 1];
  assert.strictEqual(pay.p_expected_content_rev, 1); assert.ok(!/"status"\s*:/.test(JSON.stringify(pay.p_payload)));
  assert.ok(/^f\d+:TEST-доп\.csv!D2$/.test(pay.p_payload.units.find((u) => u.code === "TEST-A1").data.import.src.area_total), "избраният от човека източник (CSV клетка D2) е записан като произход");
  const man = pay.p_payload.units.find((u) => u.code === "TEST-A2").data.import.manual.area_net;
  assert.ok(man.by === BROKER && man.at, "ръчна промяна: кой и кога");
  assert.ok(pay.p_payload.units.every((u) => !u.data.plan || u.data.plan.private.startsWith("projects/" + PID + "/private/imports/")));
  noLeak(ap, "imports.apply");
  const ap2 = await run(BROKER, "imports.apply", { job_id: s1.job_id, confirm: true, accept: acc });
  assert.ok(ap2.replayed); assert.strictEqual(B.units.filter((u) => u.project_id === PID).length, 5, "повторът не дублира обекти");
  assert.strictEqual((await run(BROKER, "jobs.status", { id: s1.job_id })).state, "succeeded");
  assert.ok(B.storage.has("projects/" + PID + "/private/derived/imports/" + s1.job_id + "/apply.json"));
  done("imports.apply: чужд служител 403; нерешени конфликти 409; запис в една RPC под JWT; без статус; ръчната стойност с кой/кога; повтор → същото, без дубликати");

  /* 6. отмяна; запис след отмяна 409; нов анализ след отмяна → нова ревизия */
  const s3 = await run(BROKER, "imports.start", { project_id: PID, files, rerun: true });
  assert.ok(s3.created && s3.revision >= 1 && s3.job_id !== s1.job_id);
  const c = await run(BROKER, "jobs.cancel", { id: s3.job_id }); assert.strictEqual(c.state, "cancelled"); assert.ok(c.changed);
  await fails(409, () => run(BROKER, "imports.apply", { job_id: s3.job_id, confirm: true, use_proposed: true }), /отменен/);
  await fails(403, () => run(BROKER2, "jobs.cancel", { id: s1.job_id }), /FORBIDDEN/);
  const s4 = await run(BROKER, "imports.start", { project_id: PID, files });
  assert.ok(s4.created && s4.job_id !== s3.job_id, "след отменена задача същият пакет → нова ревизия");
  done("jobs.cancel: веднага за чакаща; запис след отмяна 409; чужд служител не отменя; след отмяна същият пакет създава нова ревизия");

  /* 7. срив при четене от storage → неуспешно парче, автоматичен нов опит с изчакване; после довършва */
  B.failGet = 1;
  const p1 = await run(BROKER, "jobs.status", { id: s4.job_id });
  assert.strictEqual(p1.status, "queued"); assert.strictEqual(p1.error_code, "STORAGE_FAILED"); assert.ok(p1.retryable && p1.retry_at);
  B.jobs.get(s4.job_id).next_attempt_at = new Date(Date.now() - 1000).toISOString();
  const end4 = await pollToEnd(BROKER, s4.job_id); assert.strictEqual(end4.s.status, "review");
  done("срив на четенето → честно състояние (STORAGE_FAILED, нов опит в " + p1.retry_at.slice(11, 19) + "); после продължава и завършва");

  /* 8. фонов режим (waitUntil): отговорът е веднага, парчето върви след него */
  const pending = []; globalThis[Symbol.for("@vercel/request-context")] = { get: () => ({ waitUntil: (pp) => pending.push(pp) }) };
  const clean = upload([{ name: "P/unit-data/u.csv", data: Buffer.from("Обект;Вход;Етаж;Обща площ;Чиста площ;Цена на кв.м\nTEST-W1;А;1;70,5;60;2000\nTEST-W2;А;2;80;70;2100\n") }, { name: "P/source-model/m.ifc", data: Buffer.from(F.IFC) }], PID, "eeeeeeeeffffffff");
  const s5 = await run(ADMIN, "imports.start", { project_id: PID, files: clean });
  assert.strictEqual(pending.length, 1, "imports.start пуска първото парче във фонов режим"); await Promise.all(pending.splice(0));
  const w = await run(ADMIN, "jobs.status", { id: s5.job_id });
  assert.strictEqual(w.state, "needs_review"); assert.ok(!w.advancing);
  delete globalThis[Symbol.for("@vercel/request-context")];
  done("фонов режим: imports.start/jobs.status отговарят веднага, парчето върви чрез waitUntil");

  /* 9. Тед: use_proposed при чиста чернова; заявка към TASK-009 (само админ) → „чака изпълнител“ */
  const ifcId = (await run(ADMIN, "jobs.result", { id: s5.job_id })).result.downstream[0].file_id;
  const t1 = await run(ADMIN, "imports.apply", { job_id: s5.job_id, confirm: true, use_proposed: true, accept: { downstream: [ifcId] } });
  assert.ok(t1.ok && t1.created.units === 2 && t1.downstream[0].ok);
  const dj = await run(ADMIN, "jobs.status", { id: t1.downstream[0].job_id });
  assert.strictEqual(dj.kind, "cad_inspect"); assert.ok(dj.waiting_for_worker && /Чака изпълнител/.test(dj.waiting_bg)); assert.strictEqual(dj.state, "queued");
  noLeak(dj, "cad job status");
  const again = await run(ADMIN, "imports.apply", { job_id: s5.job_id, confirm: true, use_proposed: true, accept: { downstream: [ifcId] } });
  assert.strictEqual(again.downstream[0].job_id, t1.downstream[0].job_id, "повторна заявка → същата задача");
  done("Тед: use_proposed записва чиста чернова; заявка за проверка в TASK-009 → задача cad_inspect „чака изпълнител“ (не е изпълнена); повтор → същата");

  /* 10. без миграция nc_004: запис 503, нищо не се записва; без nd_job_claim_id → резервен nd_job_claim */
  B.hasApply = false; B.hasClaimId = false;
  const s6 = await run(BROKER, "imports.start", { project_id: PID, files: upload([{ name: "u.csv", data: Buffer.from("Обект;Вход;Етаж;Обща площ\nTEST-Z1;А;9;50\n") }], PID, "1111111122222222") });
  const z = await pollToEnd(BROKER, s6.job_id); assert.strictEqual(z.s.status, "review"); assert.ok(B.calls.includes("POST rpc/nd_job_claim"), "резервно взимане");
  const before = B.units.length;
  await fails(503, () => run(BROKER, "imports.apply", { job_id: s6.job_id, confirm: true, use_proposed: true }), /nc_004/);
  assert.strictEqual(B.units.length, before); assert.strictEqual(B.jobs.get(s6.job_id).status, "review");
  B.hasApply = true; B.hasClaimId = true;
  done("без nc_004: записът връща 503 и нищо не пише; jobs.status минава на резервния nd_job_claim");

  /* 11. Тед от чата: файл в ted-chat/ се копира като неизменим източник в папката на проекта */
  B.storage.set("ted-chat/2026-11/TEST-chat.csv", Buffer.from("Обект;Вход;Етаж;Обща площ;Цена на кв.м\nTEST-T1;А;3;66;1999\n"));
  const s7 = await run(BROKER, "imports.start", { project_id: PID, files: [{ path: "ted-chat/2026-11/TEST-chat.csv", name: "TEST-chat.csv" }] });
  await pollToEnd(BROKER, s7.job_id);
  const copied = [...B.storage.keys()].filter((k) => k.startsWith("projects/" + PID + "/private/imports/" + s7.import_id + "/_ted/"));
  assert.strictEqual(copied.length, 1); assert.ok(B.storage.get(copied[0]).equals(B.storage.get("ted-chat/2026-11/TEST-chat.csv")));
  done("Тед: прикаченият в чата файл се копира в projects/<id>/private/imports/<import>/_ted/ (същите байтове, SHA-256 в манифеста)");

  /* 12. изгледът на задача не издава входа (пътища) за нито един вид */
  for (const j of B.jobs.values()) noLeak(await run(ADMIN, "jobs.status", { id: j.id }), "jobs.status " + j.kind);
  noLeak(await run(ADMIN, "jobs.result", { id: t1.downstream[0].job_id }), "jobs.result cad");
  done("никой изглед на задача (импорт или TASK-009) не връща пътища, ключове или токени");

  console.log("\n" + n + "/" + n + " минали");
})().catch((e) => { console.error(e); process.exit(1); });
