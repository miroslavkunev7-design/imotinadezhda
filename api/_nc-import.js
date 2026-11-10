// ИМОТИ НАДЕЖДА · Ново строителство · ЕДИН импорт за CRM и за Тед (TASK-006): imports.start, imports.apply, jobs.status, jobs.result, jobs.cancel.
// Зарежда се от api/_nc-tools.js в същия регистър на /api/tools (същият токен на служителя, същата проверка nd_is_staff, същият одит).
// Не е отделна Vercel функция (името започва с „_“). Тежка работа не се представя като мигновена: imports.start връща job_id веднага,
// обработката върви на парчета ≤ 18 s, придвижвани от jobs.status (nd_job_claim_id / nd_job_yield / nd_job_finish със service role).
// Записът в проекта (imports.apply) е под JWT на служителя – RLS, права по колони и пазачът на базата важат – в една транзакция (nd_import_apply).
"use strict";
const crypto = require("crypto");
const C = require("./_nc-contracts.js");
const E = require("./_nc-import-engine.js");

const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SITE = "https://imotinadezhda.bg";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "nd-files";
const MB = 1048576;
const STALE_MS = 180000;
const STATE = { queued: "queued", running: "running", done: "succeeded", failed: "failed", cancelled: "cancelled" };
const ERR_BG = { AUTH_REQUIRED: "Нужен е вход", FORBIDDEN: "Нямате право", INVALID_PACKAGE: "Невалиден пакет", FILE_TOO_LARGE: "Файлът е твърде голям", FILE_UNSUPPORTED: "Неподдържан файл",
  ARCHIVE_UNSAFE: "Опасен архив", DUPLICATE_IMPORT: "Повторен импорт", CONFLICT_REQUIRES_REVIEW: "Има нерешени конфликти", EXTRACT_FAILED: "Извличането не успя", STORAGE_FAILED: "Грешка в хранилището",
  DB_CONFLICT: "Конфликт на версии", DOWNSTREAM_UNAVAILABLE: "Услугата не е налична", INTERNAL_ERROR: "Вътрешна грешка" };
const RETRYABLE = new Set(["STORAGE_FAILED", "DOWNSTREAM_UNAVAILABLE", "INTERNAL_ERROR"]);

const corrOf = (jobId) => (jobId ? "imp-" + String(jobId).slice(0, 8) : "c-" + crypto.randomBytes(4).toString("hex"));
/* грешка за gateway-а: HTTP статус + безопасно съобщение, завършващо с [КОД · корелация] (gateway-ят предава само текста) */
function IErr(code, message, http, corr) {
  const e = new Error(message + " [" + code + " · " + (corr || corrOf()) + "]");
  e.status = http; e.code = code; e.retryable = RETRYABLE.has(code); return e;
}
function dbErr(error, corr, fallback) {
  const code = String((error && error.code) || ""), msg = String((error && error.message) || "");
  if (code === "PGRST202" || code === "42883") return IErr("DOWNSTREAM_UNAVAILABLE", "Липсва миграцията за импорт (nc_004) в базата – записът не е възможен", 503, corr);
  if (code === "NC409" || code === "40001") return IErr("DB_CONFLICT", /[а-я]/i.test(msg) ? msg.slice(0, 200) : "Данните са променени от друг – пуснете анализа отново", 409, corr);
  if (code === "42501") return IErr("FORBIDDEN", /[а-я]/i.test(msg) && !/permission denied/i.test(msg) ? msg.slice(0, 200) : "Нямате право за това действие", 403, corr);
  if (code === "P0002") return IErr("INVALID_PACKAGE", /[а-я]/i.test(msg) ? msg.slice(0, 200) : "Не е намерено", 404, corr);
  if (code === "23505") return IErr("DB_CONFLICT", /nd_units_project_id_code_key/.test(msg) ? "В проекта вече има обект с такъв код – пуснете анализа отново" : /building_id_level/.test(msg) ? "В сградата вече има такъв етаж – пуснете анализа отново" : "Записът вече съществува", 409, corr);
  if (code === "23514" || code === "22023" || code === "22P02" || code === "23502") return IErr("INVALID_PACKAGE", /data_clean/.test(msg) ? "В модула не се пази инвеститор, строител или изпълнител" : /net_le_total/.test(msg) ? "Чистата площ не може да е по-голяма от общата" : /override/.test(msg) ? "Ръчна цена изисква обща цена и причина" : /code_fmt/.test(msg) ? "Невалиден код на обект" : /[а-я]/i.test(msg) ? msg.slice(0, 200) : "Невалидни данни", 400, corr);
  if (code === "57014") return IErr("DOWNSTREAM_UNAVAILABLE", "Записът отне твърде дълго – опитайте с по-малък пакет", 503, corr);
  return IErr("INTERNAL_ERROR", fallback || "Грешка в базата", 500, corr);
}

/* ---------- service role (само на сървъра; ключът никога не излиза към браузъра) ---------- */
const encPath = (p) => String(p).split("/").map(encodeURIComponent).join("/");
const H = (extra) => Object.assign({ apikey: SR(), Authorization: "Bearer " + SR() }, extra || {});
async function rest(path, opts) {
  const r = await fetch(SB_URL + path, Object.assign({}, opts, { headers: H(Object.assign({ "Content-Type": "application/json" }, (opts && opts.headers) || {})) })).catch(() => null);
  if (!r) return { ok: false, status: 0, data: null };
  const t = await r.text().catch(() => "");
  let data = null; try { data = t ? JSON.parse(t) : null; } catch (e) { data = t; }
  return { ok: r.ok, status: r.status, data };
}
const rpc = (fn, args) => rest("/rest/v1/rpc/" + fn, { method: "POST", body: JSON.stringify(args || {}) });
async function svcDownload(p, max) {
  const r = await fetch(SB_URL + "/storage/v1/object/" + BUCKET + "/" + encPath(p), { headers: H() }).catch(() => null);
  if (!r) return { ok: false, code: "failed" };
  if (r.status === 400 || r.status === 404) return { ok: false, code: "not_found" };
  if (!r.ok) return { ok: false, code: "failed" };
  const len = Number(r.headers.get("content-length") || 0);
  if (len && len > max) { try { await r.body.cancel(); } catch (e) { /* затваряне */ } return { ok: false, code: "too_large" }; }
  const chunks = []; let n = 0;
  const reader = r.body.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > max) { try { await reader.cancel(); } catch (e) { /* */ } return { ok: false, code: "too_large" }; } chunks.push(Buffer.from(value)); }
  return { ok: true, buf: Buffer.concat(chunks) };
}
async function svcUpload(p, buf, mime, upsert) {
  const r = await fetch(SB_URL + "/storage/v1/object/" + BUCKET + "/" + encPath(p), { method: "POST", headers: H({ "Content-Type": mime || "application/octet-stream", "x-upsert": upsert ? "true" : "false", "Cache-Control": "no-store" }), body: buf }).catch(() => null);
  return !!(r && r.ok);
}
const derivedBase = (pid, jobId) => "projects/" + pid + "/private/derived/imports/" + jobId + "/";
/* strict: временна грешка ≠ „няма файл“ (иначе задачата би започнала отначало) */
async function readJsonAt(p, strict) {
  const r = await svcDownload(p, 64 * MB);
  if (!r.ok) { if (strict && r.code !== "not_found") throw Object.assign(new Error("storage read failed"), { code: "STORAGE_FAILED", retryable: true }); return null; }
  try { return JSON.parse(r.buf.toString("utf8")); } catch (e) { if (strict) throw Object.assign(new Error("state corrupt"), { code: "STORAGE_FAILED", retryable: true }); return null; }
}
const writeJsonAt = (p, o) => svcUpload(p, Buffer.from(JSON.stringify(o), "utf8"), "application/json", true);

/* ---------- входно-изходен адаптер за двигателя (само service role; пътищата се проверяват още веднъж тук) ---------- */
const PURPOSE_ROWS = [["unit_inventory", "Списък с обекти / ценова листа"], ["project_info", "Данни за проекта"], ["floor_plan", "Етажен план"], ["unit_plan", "План (разпределение) на обект"],
  ["visualization", "Визуализация / рендер"], ["document", "Документ (договор, разрешително, друго)"]].map(([key, title]) => ({ key, title, group: "Импорт на проект" }));
function makeIo(job, opts) {
  const pid = job.project_id, base = derivedBase(pid, job.id), inp = job.input || {};
  const okRead = (p) => typeof p === "string" && !p.includes("..") && (p.startsWith("projects/" + pid + "/private/imports/") || p.startsWith("ted-chat/"));
  const okWrite = (p) => typeof p === "string" && !p.includes("..") && p.startsWith("projects/" + pid + "/private/imports/" + inp.import_id + "/");
  return {
    now: () => Date.now(), nowIso: () => new Date().toISOString(),
    readList: () => readJsonAt("projects/" + pid + "/private/derived/imports/" + inp.list + "/files.json", true),
    readJson: (k) => readJsonAt(base + k, true), writeJson: async (k, o) => { if (!(await writeJsonAt(base + k, o))) throw Object.assign(new Error("state write failed"), { code: "STORAGE_FAILED", retryable: true }); return true; },
    download: (p, max) => (okRead(p) ? svcDownload(p, max) : Promise.resolve({ ok: false, code: "not_found" })),
    upload: (p, b, mime) => (okWrite(p) ? svcUpload(p, b, mime, true) : Promise.resolve(false)),
    snapshot: () => snapshot(pid),
    previousHashes: async () => {
      const r = await rest("/rest/v1/nd_jobs?kind=eq.import&project_id=eq." + encodeURIComponent(pid) + "&id=neq." + job.id + "&status=in.(review,done)&select=id,h:result->source_hashes&limit=200");
      const m = {}; (Array.isArray(r.data) ? r.data : []).forEach((j) => (Array.isArray(j.h) ? j.h : []).forEach((h) => { if (typeof h === "string" && !m[h]) m[h] = "imp-" + String(j.id).slice(0, 8); }));
      return m;
    },
    heartbeat: async (progress) => { const r = await rpc("nd_job_heartbeat", { p_id: job.id, p_worker: opts.worker, p_progress: progress }); return !r.ok || r.data === true; },
    ai: opts.token ? async (entry, buf) => {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 14000);
      try {
        const r = await fetch(SITE + "/api/scan", { method: "POST", signal: ac.signal, headers: { "Content-Type": "application/json", Authorization: "Bearer " + opts.token },
          body: JSON.stringify({ kind: "classify", rows: PURPOSE_ROWS, mime: entry.mime, data: buf.toString("base64"), name: String(entry.source_name || "").split("/").pop().slice(0, 120) }) });
        const j = await r.json().catch(() => null);
        const f = j && j.ok && j.fields;
        if (!f) return null;
        const row = PURPOSE_ROWS.find((x) => x.key === f.key);
        // пазим само вида и увереността; „person“/„summary“ от класификатора НЕ се пазят (лични данни)
        return { purpose: row ? row.key : null, purpose_bg: row ? row.title : null, title: String(f.title || "").slice(0, 80), confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0)), tool: "api/scan.js (kind: classify)", model: String((j && j.model) || "").slice(0, 60), at: new Date().toISOString() };
      } catch (e) { return null; } finally { clearTimeout(t); }
    } : null
  };
}
async function snapshot(pid) {
  const enc = encodeURIComponent(pid);
  const [p, b, f, u] = await Promise.all([
    rest("/rest/v1/nd_projects?id=eq." + enc + "&select=id,name,status,version,content_rev,data"),
    rest("/rest/v1/nd_buildings?project_id=eq." + enc + "&select=id,name,sort&order=sort"),
    rest("/rest/v1/nd_floors?project_id=eq." + enc + "&select=id,building_id,level,label,updated_at,plan:data->plan"),
    rest("/rest/v1/nd_units?project_id=eq." + enc + "&select=id,code,floor_id,building_id,status,version,area_total,area_net,terrace_area,price_per_m2,price_override,d:data&limit=5000")]);
  if (!p.ok || !Array.isArray(p.data) || !p.data[0]) throw Object.assign(new Error("project read failed"), { code: "STORAGE_FAILED", retryable: true });
  const num = (v) => (v == null ? null : Number(v));
  return { project: p.data[0], buildings: b.data || [], floors: (f.data || []).map((x) => ({ id: x.id, building_id: x.building_id, level: x.level, label: x.label, updated_at: x.updated_at, has_plan: !!(x.plan && x.plan.private) })),
    units: (u.data || []).map((x) => ({ id: x.id, code: x.code, floor_id: x.floor_id, building_id: x.building_id, status: x.status, version: x.version, area_total: num(x.area_total), area_net: num(x.area_net), terrace_area: num(x.terrace_area), price_per_m2: num(x.price_per_m2),
      rooms: x.d && x.d.rooms != null ? x.d.rooms : null, beds: x.d && x.d.beds != null ? x.d.beds : null, baths: x.d && x.d.baths != null ? x.d.baths : null, exposure: (x.d && x.d.exposure) || null, has_plan: !!(x.d && x.d.plan && x.d.plan.private) })) };
}

/* ---------- изпълнител: едно парче ---------- */
const ret = (x) => (x && typeof x === "object" && x.id ? x : null);
async function claim(jobId, worker) {
  if (jobId) {
    const r = await rpc("nd_job_claim_id", { p_id: jobId, p_kinds: ["import"], p_worker: worker });
    if (r.ok) return ret(r.data);
    if (!(r.data && (r.data.code === "PGRST202" || r.data.code === "42883"))) return null;
  }
  const r = await rpc("nd_job_claim", { p_kinds: ["import"], p_worker: worker });   // резерва (без nc_004): най-старата чакаща задача за импорт
  return r.ok ? ret(r.data) : null;
}
async function advance(jobId, opts) {
  if (!SR()) return null;
  opts = opts || {};
  const worker = "imp:" + crypto.randomBytes(5).toString("hex");
  const job = await claim(jobId, worker);
  if (!job) return null;
  const corr = corrOf(job.id);
  try {
    const out = await E.runChunk(job, makeIo(job, { worker, token: opts.token }), { budgetMs: opts.budgetMs || E.LIMITS.chunkMs });
    if (out.status === "review") {
      await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: "review", p_result: Object.assign({ correlation_id: corr }, out.summary, { progress: out.progress }), p_error: null, p_cost_usd: 0 });
    } else {
      await rpc("nd_job_yield", { p_id: job.id, p_worker: worker, p_progress: Object.assign({ correlation_id: corr }, out.progress) });
    }
    return { id: job.id, status: out.status };
  } catch (e) {
    const code = (e && e.code && ERR_BG[e.code]) ? e.code : "INTERNAL_ERROR";
    console.error("nc import chunk failed", corr, code);           // без пътища, токени и съдържание
    await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: "failed", p_result: null, p_error: "[" + code + "] " + (ERR_BG[code] || "Грешка") + " – ще се опита отново автоматично, ако има оставащи опити", p_cost_usd: 0 });
    return { id: job.id, status: "failed" };
  }
}
/* фонов режим: ако средата на Vercel предоставя waitUntil (същото като @vercel/functions), иначе – синхронно в заявката */
function waitUntilFn() {
  try { const c = globalThis[Symbol.for("@vercel/request-context")]; const v = c && typeof c.get === "function" ? c.get() : null; return v && typeof v.waitUntil === "function" ? (p) => v.waitUntil(p) : null; } catch (e) { return null; }
}
/* резервно „побутване“ (виж отчета: един ред в tick() на api/push.js) – взима най-старата чакаща задача за импорт */
async function tick(budgetMs) { const r = await advance(null, { budgetMs: Math.min(budgetMs || 12000, E.LIMITS.chunkMs) }); return r ? 1 : 0; }

/* ---------- изгледи (без пътища, без входа на задачата) ---------- */
const JOB_COLS = "id,kind,status,project_id,progress,attempts,max_attempts,chunks,crash_count,error,cancel_requested,next_attempt_at,heartbeat_at,actor_user_id,created_at,updated_at,finished_at,result";
const HEAVY = new Set(["cad_inspect", "cad_convert", "tour_render"]);
function stripPaths(v, d) {
  if (d > 8 || v == null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => stripPaths(x, d + 1));
  const o = {}; Object.keys(v).forEach((k) => { if (!/path|url|signed/i.test(k)) o[k] = stripPaths(v[k], d + 1); }); return o;
}
function jobView(j, extra) {
  const res = j.result || {}, err = String(j.error || "");
  const m = /^\[([A-Z_]+)\]\s*/.exec(err);
  const stale = j.status === "running" && j.heartbeat_at && Date.now() - new Date(j.heartbeat_at).getTime() > STALE_MS;
  const v = {
    id: j.id, kind: j.kind, status: j.status,
    state: j.status === "review" ? (res.state || "needs_review") : STATE[j.status] || j.status,
    project_id: j.project_id || null, import_id: (res.import_id) || null,
    progress: stripPaths(((j.status === "review" || j.status === "done") && res.progress) || j.progress || {}, 0), attempts: j.attempts, max_attempts: j.max_attempts, chunks: j.chunks,
    error_code: m ? m[1] : (j.status === "failed" ? "INTERNAL_ERROR" : null), error: err ? err.replace(/^\[[A-Z_]+\]\s*/, "").slice(0, 300) : null,
    retryable: j.status === "queued" && !!err, retry_at: j.status === "queued" && j.next_attempt_at && new Date(j.next_attempt_at).getTime() > Date.now() ? j.next_attempt_at : null,
    cancel_requested: !!j.cancel_requested, stale: !!stale,
    waiting_for_worker: HEAVY.has(j.kind) && j.status === "queued", waiting_bg: HEAVY.has(j.kind) && j.status === "queued" ? "Чака изпълнител (" + (j.kind === "tour_render" ? "TASK-010" : "TASK-009") + ") – още няма такъв; нищо не е направено" : null,
    requires_review: j.status === "review", importable: j.kind === "import" ? (res.importable !== false) : null,
    counts: j.kind === "import" && res.counts ? res.counts : null,
    applied: j.status === "done" && res.applied ? stripPaths(res.applied, 0) : null,
    created_at: j.created_at, updated_at: j.updated_at, finished_at: j.finished_at || null,
    correlation_id: corrOf(j.id)
  };
  return Object.assign(v, extra || {});
}
async function readJob(ctx, id) {
  const r = await ctx.sb.from("nd_jobs").select(JOB_COLS).eq("id", id).maybeSingle();
  if (r.error) throw dbErr(r.error, corrOf(id));
  if (!r.data) throw IErr("INVALID_PACKAGE", "Задачата не е намерена", 404, corrOf(id));
  return r.data;
}
const canAdvance = (j) => j.kind === "import" && !j.cancel_requested && ((j.status === "queued" && new Date(j.next_attempt_at).getTime() <= Date.now() + 500) || (j.status === "running" && j.heartbeat_at && Date.now() - new Date(j.heartbeat_at).getTime() > STALE_MS));
async function isAdmin(ctx) { try { const r = await ctx.sb.rpc("nd_is_admin"); return r.data === true; } catch (e) { return false; } }

/* ---------- преглед → запис: чиста функция (изпитва се без база) ----------
   preview = черновата от двигателя; accept = прегледаната от човек версия (или acceptFromPreview за use_proposed);
   paths = server-only карта file_id → път. Връща { payload, downstream, issues } или хвърля IErr. */
const PROJECT_IMPORT_KEYS = ["title", "city", "hood", "address", "description", "stage", "stage_percent", "expected_completion", "advantages"];
function acceptFromPreview(p) {
  const units = p.units.filter((u) => u.include && (u.action === "create" || u.action === "update"));
  const project = {}; Object.keys(p.project || {}).forEach((k) => { const f = p.project[k]; if (f.include && f.value != null && !f.conflict) project[k] = f.value; });
  const usedF = new Set(units.map((u) => u.floor_ref)), floors = p.floors.filter((f) => usedF.has(f.ref));
  const usedB = new Set(floors.map((f) => f.building_ref)), buildings = p.buildings.filter((b) => usedB.has(b.ref));
  return {
    project,
    buildings: buildings.map((b) => ({ ref: b.ref, name: b.name })),
    floors: floors.map((f) => Object.assign({ ref: f.ref, building_ref: f.building_ref, level: f.level }, f.label ? { label: f.label } : {}, f.plan && f.plan.include ? { plan_file_id: f.plan.file_id } : {})),
    units: units.map((u) => { const o = { ref: u.ref, floor_ref: u.floor_ref, code: u.code }; E.UNIT_FIELDS.forEach((k) => { if (u.fields[k] && u.fields[k].value != null) o[k] = u.fields[k].value; }); if (u.plan && u.plan.include) o.plan_file_id = u.plan.file_id; return o; }),
    resolved: [], downstream: []
  };
}
function provKey(src) { return src ? src.f + ":" + (src.s ? src.s + "!" : "") + (src.c || "") : null; }
function buildApply(preview, accept, who, paths) {
  const corr = corrOf(preview.job_id), bad = (code, msg, http) => { throw IErr(code, msg, http || 400, corr); };
  const at = who.now || new Date().toISOString();
  const uById = {}; preview.units.forEach((u) => { uById[u.ref] = u; });
  const fById = {}; preview.floors.forEach((f) => { fById[f.ref] = f; });
  const bById = {}; preview.buildings.forEach((b) => { bById[b.ref] = b; });
  const ex = preview.existing || { buildings: [], floors: [] };
  const fileOk = (fid, types) => { const f = preview.files.find((x) => x.file_id === fid); const p = paths && paths[fid]; return f && f.status === "ok" && p && types.includes(f.detected_type) && C.pathInProject(p.path, preview.project_id) && p.path.startsWith("projects/" + preview.project_id + "/private/imports/") ? p.path : null; };
  const resolved = new Set(accept.resolved || []);
  const units = accept.units || [];
  // 1. обектите са само от черновата; без повторения
  const seen = new Set();
  for (const a of units) {
    const u = uById[a.ref];
    if (!u || !(u.action === "create" || u.action === "update")) bad("INVALID_PACKAGE", "Обект " + a.ref + " не е предложен от анализа");
    if (seen.has(a.ref)) bad("INVALID_PACKAGE", "Обект " + a.ref + " е подаден два пъти"); seen.add(a.ref);
  }
  const codes = new Map(); units.forEach((a) => { const k = require("./_nc-import-norm.js").codeKey(a.code); if (codes.has(k)) bad("CONFLICT_REQUIRES_REVIEW", "Два обекта с код „" + a.code + "“ в черновата"); codes.set(k, a.ref); });
  // 2. нерешени конфликти за включените обекти и полета на проекта
  const open = preview.conflicts.filter((c) => c.status === "unresolved" && !resolved.has(c.conflict_id) && ((c.unit_ref && seen.has(c.unit_ref)) || (c.scope === "project" && accept.project && accept.project[c.field] !== undefined)));
  if (open.length) bad("CONFLICT_REQUIRES_REVIEW", "Има нерешени конфликти: " + open.slice(0, 5).map((c) => c.message).join("; ") + (open.length > 5 ? " (+" + (open.length - 5) + ")" : ""), 409);
  // 3. сгради: съществуваща (по ref от черновата или по име) или нова; еднакви имена → една сграда
  const nk = (s) => String(s || "").toLocaleLowerCase("bg").replace(/\s+/g, " ").trim();
  const bTarget = {}, newB = [], newBByName = {};
  for (const b of accept.buildings || []) {
    const pb = bById[b.ref];
    if (pb && pb.action === "match" && pb.id) { bTarget[b.ref] = { id: pb.id }; continue; }
    const exm = ex.buildings.find((x) => nk(x.name) === nk(b.name));
    if (exm) { bTarget[b.ref] = { id: exm.id }; continue; }
    if (newBByName[nk(b.name)]) { bTarget[b.ref] = newBByName[nk(b.name)]; continue; }
    const t = { ref: b.ref }; newBByName[nk(b.name)] = t; bTarget[b.ref] = t;
    newB.push({ ref: b.ref, name: b.name.trim(), sort: b.sort || 0, data: { import: { job: preview.job_id, imp: preview.import_id, v: E.ENGINE_VERSION, src: pb && pb.name != null && nk(pb.name) === nk(b.name) ? { name: provKey(pb.name_src) } : {}, manual: pb && pb.name != null && nk(pb.name) === nk(b.name) ? {} : { name: { by: who.userId, at } } } } });
  }
  // 4. етажи
  const fTarget = {}, newF = [], newFByKey = {}, floorsUpd = [];
  for (const f of accept.floors || []) {
    const bt = bTarget[f.building_ref]; if (!bt) bad("INVALID_PACKAGE", "Етаж " + f.ref + ": неизвестна сграда " + f.building_ref);
    const pf = fById[f.ref];
    let exf = pf && pf.action === "match" && pf.id ? ex.floors.find((x) => x.id === pf.id) : null;
    if (!exf && bt.id) exf = ex.floors.find((x) => x.building_id === bt.id && x.level === f.level);
    const plan = f.plan_file_id ? fileOk(f.plan_file_id, ["pdf", "jpeg", "png"]) : null;
    if (f.plan_file_id && !plan) bad("INVALID_PACKAGE", "Етаж " + f.ref + ": файлът " + f.plan_file_id + " не е валиден план от този импорт");
    if (exf) {
      fTarget[f.ref] = { id: exf.id };
      if (plan) floorsUpd.push({ id: exf.id, expected_updated_at: exf.updated_at, plan_private: plan });
      continue;
    }
    const key = (bt.id || "ref:" + bt.ref) + "|" + f.level;
    if (newFByKey[key]) { fTarget[f.ref] = newFByKey[key]; continue; }
    const t = { ref: f.ref }; newFByKey[key] = t; fTarget[f.ref] = t;
    const manual = pf && pf.level === f.level ? {} : { level: { by: who.userId, at } };
    newF.push(Object.assign({ ref: f.ref, level: f.level, label: f.label || null, data: Object.assign(plan ? { plan: { private: plan } } : {}, { import: { job: preview.job_id, imp: preview.import_id, v: E.ENGINE_VERSION, src: pf && pf.src ? { level: provKey(pf.src) } : {}, manual } }) },
      bt.id ? { building_id: bt.id } : { building_ref: bt.ref }));
  }
  // 5. обекти: стойностите се сравняват с кандидатите от източниците → източник или ръчна промяна (кой/кога)
  const newU = [], updU = [];
  for (const a of units) {
    const u = uById[a.ref], ft = fTarget[a.floor_ref];
    if (!ft) bad("INVALID_PACKAGE", "Обект „" + a.code + "“: етаж " + a.floor_ref + " не е в черновата");
    const src = {}, manual = {}, derived = {};
    for (const k of E.UNIT_FIELDS) {
      if (a[k] === undefined || a[k] === null) continue;
      const pf = u.fields[k], cand = pf && pf.candidates ? pf.candidates.find((c) => (typeof c.v === "number" ? Math.abs(c.v - a[k]) < 0.005 : String(c.v) === String(a[k]))) : null;
      if (cand) { src[k] = provKey(cand.src); if (pf.rule) derived[k] = pf.rule; } else manual[k] = { by: who.userId, at };
    }
    if (a.code !== u.code) manual.code = { by: who.userId, at }; else src.code = provKey(u.code_sources[0]);
    if (u.floor && u.floor.value != null && u.floor_ref === a.floor_ref) src.floor = provKey(u.floor.candidates[0] && u.floor.candidates[0].src); else manual.floor = { by: who.userId, at };
    if (a.price_override) manual.price_total = Object.assign({ by: who.userId, at }, u.override_offer && Math.abs(u.override_offer.price_total - a.price_total) < 0.005 ? { from: provKey(u.override_offer.src) } : {});
    const plan = a.plan_file_id ? fileOk(a.plan_file_id, ["pdf", "jpeg", "png"]) : null;
    if (a.plan_file_id && !plan) bad("INVALID_PACKAGE", "Обект „" + a.code + "“: файлът " + a.plan_file_id + " не е валиден план от този импорт");
    if (plan) { if (u.plan && u.plan.file_id === a.plan_file_id) src.plan = a.plan_file_id; else manual.plan = { by: who.userId, at, file: a.plan_file_id }; }
    const prov = { job: preview.job_id, imp: preview.import_id, v: E.ENGINE_VERSION, src, manual, derived };
    const data = { import: prov }; ["rooms", "beds", "baths", "exposure"].forEach((k) => { if (a[k] != null) data[k] = a[k]; });
    if (plan) data.plan = { private: plan };
    if (u.action === "create") {
      newU.push(Object.assign({ ref: a.ref, code: a.code, area_total: a.area_total == null ? null : a.area_total, area_net: a.area_net == null ? null : a.area_net, terrace_area: a.terrace_area == null ? null : a.terrace_area,
        price_per_m2: a.price_per_m2 == null ? null : a.price_per_m2, price_override: !!a.price_override, price_total: a.price_override ? a.price_total : null, price_override_reason: a.price_override ? a.price_override_reason : null, data }, ft.id ? { floor_id: ft.id } : { floor_ref: ft.ref }));
    } else {
      // съществуващ обект: само променените колони; импортът никога не изтрива стойност, не сменя код, етаж или статус
      const old = (u.existing && u.existing.values) || {}, set = {};
      ["area_total", "area_net", "terrace_area", "price_per_m2"].forEach((k) => { if (a[k] != null && !(old[k] != null && Math.abs(Number(old[k]) - a[k]) < 0.005)) set[k] = a[k]; });
      if (a.price_override) { set.price_override = true; set.price_total = a.price_total; set.price_override_reason = a.price_override_reason; }
      const patch = { import: prov }; ["rooms", "beds", "baths", "exposure"].forEach((k) => { if (a[k] != null && String(old[k]) !== String(a[k])) patch[k] = a[k]; });
      if (plan) patch.plan = { private: plan };
      const na = set.area_net != null ? set.area_net : old.area_net, ta = set.area_total != null ? set.area_total : old.area_total;
      if (na != null && ta != null && Number(na) > Number(ta)) bad("INVALID_PACKAGE", "„" + u.code + "“: чистата площ ще стане по-голяма от общата");
      updU.push({ ref: a.ref, id: u.id, expected_version: u.expected_version, set, data_patch: patch });
    }
  }
  // 6. проект: само позволените полета, само подадените
  let project = null;
  if (accept.project && Object.keys(accept.project).length) {
    const dataPatch = {}, psrc = {}, pman = {};
    for (const k of PROJECT_IMPORT_KEYS) {
      if (accept.project[k] === undefined) continue;
      dataPatch[k] = accept.project[k];
      const pf = preview.project && preview.project[k];
      const c = pf && pf.candidates && pf.candidates.find((x) => JSON.stringify(x.v) === JSON.stringify(accept.project[k]));
      if (c) psrc[k] = provKey(c.src); else pman[k] = { by: who.userId, at };
    }
    if (Object.keys(dataPatch).length) { dataPatch.import = { job: preview.job_id, imp: preview.import_id, v: E.ENGINE_VERSION, src: psrc, manual: pman }; project = { data: dataPatch }; if (dataPatch.title) project.name = dataPatch.title; }
  }
  // 7. заявки към следващите задачи (TASK-009): само администратор, само файлове от черновата
  const downstream = [];
  for (const fid of accept.downstream || []) {
    const d = (preview.downstream || []).find((x) => x.file_id === fid);
    if (!d) bad("INVALID_PACKAGE", "Файл " + fid + " не е за следваща задача");
    if (!who.admin) bad("FORBIDDEN", "Заявка за проверка в TASK-009 прави само администратор", 403);
    const p = paths && paths[fid]; if (!p) bad("STORAGE_FAILED", "Пътят на файла не е намерен", 503);
    downstream.push({ file_id: fid, kind: "cad_inspect", key: "cad_inspect:" + preview.project_id + ":" + p.sha256, input: { path: p.path, sha256: p.sha256, type: p.type, file_id: fid, import_job: preview.job_id } });
  }
  if (!newB.length && !newF.length && !floorsUpd.length && !newU.length && !updU.length && !project && !downstream.length) bad("INVALID_PACKAGE", "Няма избрани записи – нищо не е записано");
  return { payload: { project, buildings: newB, floors: newF, floors_update: floorsUpd, units: newU, units_update: updU, meta: { job_id: preview.job_id, import_id: preview.import_id, engine: E.ENGINE_VERSION } }, downstream };
}

/* ---------- инструменти ---------- */
async function previewOf(job, corr) {
  const p = await readJsonAt(derivedBase(job.project_id, job.id) + "preview.json");
  if (!p) throw IErr("STORAGE_FAILED", "Черновата на импорта не се прочете", 503, corr);
  return p;
}
function summaryView(p) {
  const pick = (a, n) => a.slice(0, n);
  const byType = {}; p.files.forEach((f) => { const k = (f.detected_type || "—") + ":" + f.status; byType[k] = (byType[k] || 0) + 1; });
  return {
    import_id: p.import_id, state: p.state, importable: p.importable, error_code: p.error_code, counts: p.counts, base: p.base,
    project: Object.keys(p.project).reduce((o, k) => { o[k] = { value: p.project[k].value, current: p.project[k].current, include: p.project[k].include, conflict: p.project[k].conflict || null }; return o; }, {}),
    buildings: p.buildings.map((b) => ({ ref: b.ref, name: b.name, action: b.action })),
    floors: p.floors.map((f) => ({ ref: f.ref, building_ref: f.building_ref, level: f.level, label: f.label, action: f.action, plan: f.plan ? f.plan.name : null })),
    units_sample: pick(p.units, 25).map((u) => ({ ref: u.ref, code: u.code, action: u.action, include: u.include, floor_ref: u.floor_ref, area_total: u.fields.area_total ? u.fields.area_total.value : null, area_net: u.fields.area_net ? u.fields.area_net.value : null, price_per_m2: u.fields.price_per_m2 ? u.fields.price_per_m2.value : null, conflicts: u.conflicts })),
    conflicts: pick(p.conflicts, 40).map((c) => ({ conflict_id: c.conflict_id, kind: c.kind, field: c.field, unit_ref: c.unit_ref, message: c.message, sources: c.sources.map((s) => ({ value: s.value, file: s.n, sheet: s.s, cell: s.c })) })),
    missing: pick(p.missing, 40), warnings: pick(p.warnings, 40).map((w) => w.message), derived: p.derived, downstream: p.downstream,
    files_by_type: byType, rules_applied: p.rules_applied, more: { units: Math.max(0, p.units.length - 25), conflicts: Math.max(0, p.conflicts.length - 40), missing: Math.max(0, p.missing.length - 40), warnings: Math.max(0, p.warnings.length - 40) },
    hint: p.state === "needs_input" ? "Има конфликти или липсващи задължителни данни – прегледът в CRM ги решава; imports.apply с use_proposed:true ще откаже." : "Готово за преглед. Запис: imports.apply {job_id, confirm:true, use_proposed:true} – само след изрично потвърждение от човек."
  };
}
const RUN = {
  "imports.start": async (ctx, i) => {
    let corr = corrOf();
    if (!SR()) throw IErr("DOWNSTREAM_UNAVAILABLE", "Обработката на импорт работи само в продукционната среда", 503, corr);
    const pr = await ctx.sb.from("nd_projects").select("id,status").eq("id", i.project_id).maybeSingle();
    if (pr.error) throw dbErr(pr.error, corr);
    if (!pr.data) throw IErr("INVALID_PACKAGE", "Проектът не е намерен", 404, corr);
    if (pr.data.status === "archived") throw IErr("INVALID_PACKAGE", "Проектът е архивиран – импорт не се прави", 409, corr);
    if (pr.data.status === "published" && !(await isAdmin(ctx))) throw IErr("FORBIDDEN", "В публикуван проект импорт прави само администратор", 403, corr);
    const items = i.files.map((f) => ({ path: f.path, name: String(f.name).replace(/\\/g, "/").replace(/^\/+/, "").slice(0, 300), size: f.size || null, sha256: f.sha256 || null }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.path < b.path ? -1 : 1));
    const listHash = crypto.createHash("sha256").update(JSON.stringify(items.map((x) => [x.name, x.size, x.sha256 || x.path]))).digest("hex");
    const proj = items.find((x) => x.path.startsWith("projects/"));
    const importId = proj ? proj.path.split("/")[4] : listHash.slice(0, 32);
    const baseKey = "import:" + i.project_id + ":" + ctx.userId + ":" + listHash.slice(0, 48) + (i.ai === false ? ":na" : "");
    const ex = await ctx.sb.from("nd_jobs").select("id,status,idempotency_key,created_at").eq("kind", "import").like("idempotency_key", baseKey + "%").order("created_at", { ascending: false }).limit(50);
    if (ex.error) throw dbErr(ex.error, corr);
    const latest = (ex.data || [])[0];
    if (latest && !i.rerun && !["failed", "cancelled"].includes(latest.status))
      return { ok: true, job_id: latest.id, import_id: importId, state: STATE[latest.status] || (latest.status === "review" ? "needs_review" : latest.status), status: latest.status, idempotent: true, created: false, correlation_id: corrOf(latest.id), next: "jobs.status" };
    const rev = (ex.data || []).reduce((m, j) => { const r = /:r(\d+)$/.exec(j.idempotency_key); return Math.max(m, r ? parseInt(r[1], 10) : 0); }, 0) + ((ex.data || []).length ? 1 : 0);
    const key = rev ? baseKey + ":r" + rev : baseKey;
    const listId = crypto.createHash("sha256").update(ctx.userId + ":" + listHash).digest("hex").slice(0, 32);
    const list = { v: 1, import_id: importId, project_id: i.project_id, actor: ctx.userId, created_at: new Date().toISOString(), mode: i.mode || "new", ai: i.ai !== false, items };
    if (!(await writeJsonAt("projects/" + i.project_id + "/private/derived/imports/" + listId + "/files.json", list))) throw IErr("STORAGE_FAILED", "Списъкът с файлове не се записа – опитайте отново", 503, corr);
    const total = items.reduce((s, x) => s + (x.size || 0), 0);
    const jr = await ctx.sb.rpc("nd_job_create", { p_kind: "import", p_key: key, p_project_id: i.project_id, p_input: { import_id: importId, list: listId, files: items.length, bytes: total, mode: i.mode || "new", ai: i.ai !== false, rev } });
    if (jr.error) throw dbErr(jr.error, corr);
    const j = jr.data || {};
    corr = corrOf(j.id);
    const wu = waitUntilFn(); if (wu && j.created) wu(advance(j.id, { token: ctx.token }).catch(() => null));
    return { ok: true, job_id: j.id, import_id: importId, state: STATE[j.status] || j.status, status: j.status, idempotent: !j.created, created: !!j.created, revision: rev, files: items.length, bytes: total, correlation_id: corr, next: "jobs.status" };
  },

  "jobs.status": async (ctx, i) => {
    let j = await readJob(ctx, i.id);
    if (canAdvance(j) && SR()) {
      const p = advance(j.id, { token: ctx.token });
      const wu = waitUntilFn();
      if (wu) { wu(p.catch(() => null)); return jobView(j, { advancing: true }); }
      await p.catch(() => null);
      j = await readJob(ctx, i.id);
    }
    return jobView(j);
  },

  "jobs.result": async (ctx, i) => {
    const j = await readJob(ctx, i.id), corr = corrOf(j.id);
    if (j.kind !== "import") return { id: j.id, kind: j.kind, status: j.status, state: jobView(j).state, result: stripPaths(j.result || {}, 0), correlation_id: corr };
    if (j.status === "queued" || j.status === "running") throw IErr("CONFLICT_REQUIRES_REVIEW", "Анализът още не е готов – следете jobs.status", 409, corr);
    if (j.status === "failed") return { id: j.id, kind: j.kind, status: j.status, state: "failed", result: null, error: jobView(j).error, correlation_id: corr };
    if (j.status === "cancelled" && !j.result.counts) return { id: j.id, kind: j.kind, status: j.status, state: "cancelled", result: null, correlation_id: corr };
    const p = await previewOf(j, corr);
    const base = { id: j.id, kind: j.kind, status: j.status, state: jobView(j).state, applied: j.status === "done" ? stripPaths(j.result.applied || null, 0) : null, correlation_id: corr };
    if ((i.view || "summary") === "summary") return Object.assign(base, { result: summaryView(p) });
    const off = i.offset || 0, lim = i.limit || 500;
    const out = Object.assign({}, p, { units: p.units.slice(off, off + lim), page: { offset: off, limit: lim, total: p.units.length } });
    return Object.assign(base, { result: stripPaths(out, 0) });
  },

  "jobs.cancel": async (ctx, i) => {
    const corr = corrOf(i.id);
    const r = await ctx.sb.rpc("nd_job_cancel", { p_id: i.id });
    if (r.error) throw dbErr(r.error, corr);
    const d = r.data || {};
    return { id: d.id, status: d.status, state: STATE[d.status] || d.status, changed: !!d.changed, cancel_requested: !!d.cancel_requested, message: d.status === "running" ? "Ще спре след текущото парче; нищо не се записва в проекта" : d.changed ? "Отменено; нищо не е записано в проекта" : "Задачата вече е приключила", correlation_id: corr };
  },

  "imports.apply": async (ctx, i) => {
    const j = await readJob(ctx, i.job_id), corr = corrOf(j.id);
    if (j.kind !== "import") throw IErr("INVALID_PACKAGE", "Задачата не е импорт", 400, corr);
    const admin = await isAdmin(ctx);
    if (j.actor_user_id !== ctx.userId && !admin) throw IErr("FORBIDDEN", "Само авторът на импорта или администратор записва черновата", 403, corr);
    const wantsDown = i.accept && Array.isArray(i.accept.downstream) && i.accept.downstream.length;
    if (j.status === "done" && !wantsDown) return { ok: true, replayed: true, project_id: j.project_id, state: "succeeded", applied: stripPaths(j.result.applied || null, 0), published: false, correlation_id: corr };
    if (j.status !== "review" && j.status !== "done") throw IErr("DB_CONFLICT", j.status === "cancelled" ? "Импортът е отменен – нищо не се записва" : j.status === "failed" ? "Анализът не завърши успешно" : "Анализът още не е готов", 409, corr);
    if (!SR()) throw IErr("DOWNSTREAM_UNAVAILABLE", "Записът на импорт работи само в продукционната среда", 503, corr);
    const p = await previewOf(j, corr);
    const paths = await readJsonAt(derivedBase(j.project_id, j.id) + "paths.json");
    if (!paths) throw IErr("STORAGE_FAILED", "Картата на файловете не се прочете", 503, corr);
    const who = { userId: ctx.userId, admin, now: new Date().toISOString() };
    let receipt = null, replayed = false, down = [];
    if (j.status === "review") {
      if (!p.importable) throw IErr(p.error_code || "INVALID_PACKAGE", "В пакета няма данни за запис", 400, corr);
      const accept = i.use_proposed ? Object.assign(acceptFromPreview(p), { downstream: (i.accept && i.accept.downstream) || [] }) : i.accept;
      if (i.use_proposed && p.state === "needs_input") throw IErr("CONFLICT_REQUIRES_REVIEW", "Има нерешени конфликти или липсващи задължителни данни – прегледайте черновата в CRM", 409, corr);
      const plan = buildApply(p, accept, who, paths);
      const r = await ctx.sb.rpc("nd_import_apply", { p_job_id: j.id, p_project_id: j.project_id, p_expected_content_rev: p.base.content_rev, p_payload: plan.payload });
      if (r.error) throw dbErr(r.error, corr, "Записът не успя – нищо не е записано");
      receipt = r.data || {}; replayed = !!receipt.replayed;
      await writeJsonAt(derivedBase(j.project_id, j.id) + "apply.json", { receipt, by: ctx.userId, at: who.now, payload_counts: { buildings: plan.payload.buildings.length, floors: plan.payload.floors.length, units: plan.payload.units.length, units_update: plan.payload.units_update.length } }).catch(() => false);
      try { await require("./_nc-tools.js").kick(ctx); } catch (e) { /* производните на плановете ще се направят при следващо действие */ }
      down = plan.downstream;
    } else {
      down = buildApply(p, { units: [], downstream: i.accept.downstream }, who, paths).downstream;
      receipt = j.result.applied || null; replayed = true;
    }
    const downstream = [];
    for (const d of down) {
      const r = await ctx.sb.rpc("nd_job_create", { p_kind: d.kind, p_key: d.key, p_project_id: j.project_id, p_input: d.input });
      downstream.push(r.error ? { file_id: d.file_id, kind: d.kind, ok: false, error: dbErr(r.error, corr).message } : { file_id: d.file_id, kind: d.kind, ok: true, job_id: r.data.id, status: r.data.status, state: "queued", waiting_bg: "Чака изпълнител (TASK-009) – ще се обработи, когато има такъв" });
    }
    return { ok: true, project_id: j.project_id, state: "succeeded", replayed, created: receipt && receipt.created, updated: receipt && receipt.updated, downstream, published: false,
      message: "Черновата е записана. Нищо не е публикувано – публикуването е отделно действие на администратор (projects.publish).", correlation_id: corr };
  }
};

module.exports = { RUN, advance, tick, buildApply, acceptFromPreview, jobView, summaryView, stripPaths, makeIo, snapshot, waitUntilFn, IErr, dbErr, corrOf, PURPOSE_ROWS };
