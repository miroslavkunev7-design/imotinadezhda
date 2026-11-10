// ИМОТИ НАДЕЖДА · Ново строителство · TASK-009 · CAD/BIM проверка и истински 3D модел на сграда.
//   инструменти (същият регистър на /api/tools, същият токен на служителя, същият одит): cad.inspect, models.request, models.publish,
//                models.unpublish, models.get; допълва jobs.status за тежките задачи (кога е повикан изпълнителят, какво следва).
//   изпълнител:  тежката работа НЕ върви тук. Сайтът само повиква GitHub Actions (workflow_dispatch с job_id) и отговаря на неговите
//                подписани (HMAC) повиквания POST /api/tools?ncw=claim|beat|finish|next. Ключът за базата остава само на сървъра:
//                изпълнителят получава краткотраен подписан адрес за теглене на входа и подписани адреси за качване на резултата.
//   публика:     /model/<сграда> → /api/tools?model=<сграда> → базата решава при ВСЯКО отваряне (публикуван проект + публикувана версия)
//                → подписан адрес за 60 s към ОПТИМИЗИРАНИЯ GLB. Оригиналът (IFC/DXF/DWG/GLB) никога не излиза.
// Не е отделна Vercel функция (името започва с „_“) – зарежда се от api/_nc-tools.js.
"use strict";
const crypto = require("crypto");
const C = require("./_nc-contracts.js");
const L = require("./_nc-cad-lib.js");

const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const BUCKET = "nd-files";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const WSECRET = () => process.env.NC_WORKER_SECRET || "";
const GH = () => ({ token: process.env.NC_WORKER_GH_TOKEN || "", repo: process.env.NC_WORKER_GH_REPO || "", ref: process.env.NC_WORKER_GH_REF || "main", wf: process.env.NC_WORKER_GH_WORKFLOW || "nc-worker.yml" });
const DWG_ON = () => process.env.NC_WORKER_DWG === "1";          // изпълнителят има разрешен DWG конвертор (по подразбиране – не)
const KINDS = ["cad_inspect", "cad_convert"];
const STATE = { queued: "queued", running: "running", review: "needs_review", done: "succeeded", failed: "failed", cancelled: "cancelled" };
const PHASE_BG = { dispatched: "Изпълнителят е повикан", claimed: "Изпълнителят започна", download: "Теглене на файла", detect: "Разпознаване на формата", inspect: "Проверка на файла",
  convert: "Конверсия към 3D модел", optimize: "Оптимизация на модела", validate: "Проверка на размери и съответствие", poster: "Изглед от модела", upload: "Качване на резултата", report: "Отчитане" };

const corrOf = (jobId) => (jobId ? "cad-" + String(jobId).slice(0, 8) : "c-" + crypto.randomBytes(4).toString("hex"));
/* грешка за gateway-а: HTTP статус + безопасен текст, завършващ с [КОД · корелация] (същата форма като при импорта) */
function CErr(code, message, http, corr) {
  const e = new Error((message || L.ERR[code] || "Грешка") + " [" + code + " · " + (corr || corrOf()) + "]");
  e.status = http; e.code = code; e.retryable = L.RETRYABLE.has(code); return e;
}
const bg = (msg) => /[а-я]/i.test(msg) && !/permission denied|row-level security/i.test(msg);
function dbErr(error, corr, fallback) {
  const code = String((error && error.code) || ""), msg = String((error && error.message) || "");
  if (code === "PGRST202" || code === "42883" || code === "42P01" || code === "PGRST205") return CErr("MIGRATION_MISSING", null, 503, corr);
  if (code === "NC409" || code === "40001") return CErr("DB_CONFLICT", bg(msg) ? msg.slice(0, 200) : "Данните са променени от друг – презаредете", 409, corr);
  if (code === "42501") return CErr("FORBIDDEN", bg(msg) ? msg.slice(0, 200) : "Нямате право за това действие", 403, corr);
  if (code === "P0002") return CErr("FILE_NOT_FOUND", bg(msg) ? msg.slice(0, 200) : "Не е намерено", 404, corr);
  if (code === "23505") return CErr("DB_CONFLICT", bg(msg) ? msg.slice(0, 200) : "Записът вече съществува", 409, corr);
  if (code === "54000") return CErr("LIMIT_EXCEEDED", "Твърде много задачи за кратко време – изчакайте няколко минути", 429, corr);
  if (["22023", "23514", "22P02", "23502", "23503"].includes(code)) return CErr("INVALID_INPUT", bg(msg) ? msg.slice(0, 200) : "Невалидни данни", 400, corr);
  return CErr("INTERNAL_ERROR", fallback || "Грешка в базата", 500, corr);
}

/* ---------- service role (само на сървъра; ключът никога не излиза към браузъра или към изпълнителя) ---------- */
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
const objUrl = (p) => SB_URL + "/storage/v1/object/" + BUCKET + "/" + encPath(p);
/* началото на файла (за разпознаване по съдържание) + размер и etag, с една заявка */
async function head(p, n) {
  const r = await fetch(objUrl(p), { headers: H({ Range: "bytes=0-" + (n - 1) }) }).catch(() => null);
  if (!r) return { ok: false, code: "failed" };
  if (r.status === 400 || r.status === 404) { try { await r.body.cancel(); } catch (e) { /* затваряне */ } return { ok: false, code: "not_found" }; }
  if (!r.ok) { try { await r.body.cancel(); } catch (e) { /* */ } return { ok: false, code: "failed" }; }
  const cr = /\/(\d+)\s*$/.exec(String(r.headers.get("content-range") || ""));
  const size = cr ? Number(cr[1]) : Number(r.headers.get("content-length") || 0);
  const chunks = []; let got = 0;
  const reader = r.body.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(Buffer.from(value)); got += value.length; if (got >= n) { try { await reader.cancel(); } catch (e) { /* */ } break; } }
  return { ok: true, size: size || got, etag: String(r.headers.get("etag") || "").replace(/^W\/|"/g, "").slice(0, 80) || null, buf: Buffer.concat(chunks).subarray(0, n) };
}
async function stream(p, max, onChunk) {
  const r = await fetch(objUrl(p), { headers: H() }).catch(() => null);
  if (!r) return { ok: false, code: "failed" };
  if (r.status === 400 || r.status === 404) return { ok: false, code: "not_found" };
  if (!r.ok) return { ok: false, code: "failed" };
  let n = 0; const reader = r.body.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > max) { try { await reader.cancel(); } catch (e) { /* */ } return { ok: false, code: "too_large" }; } onChunk(Buffer.from(value)); }
  return { ok: true, bytes: n };
}
async function hashObject(p, max) { const h = crypto.createHash("sha256"); const r = await stream(p, max, (b) => h.update(b)); return r.ok ? { ok: true, bytes: r.bytes, sha256: h.digest("hex") } : r; }
async function download(p, max) { const chunks = []; const r = await stream(p, max, (b) => chunks.push(b)); return r.ok ? { ok: true, buf: Buffer.concat(chunks) } : r; }
const absSigned = (u) => (/^https?:/.test(u) ? u : SB_URL + "/storage/v1" + (u.startsWith("/") ? "" : "/") + u);
async function signGet(p, ttl) {
  const r = await rest("/storage/v1/object/sign/" + BUCKET + "/" + encPath(p), { method: "POST", body: JSON.stringify({ expiresIn: ttl }) });
  const u = r.ok && r.data && (r.data.signedURL || r.data.signedUrl);
  return u ? absSigned(u) : null;
}
async function signPut(p) {
  const r = await rest("/storage/v1/object/upload/sign/" + BUCKET + "/" + encPath(p), { method: "POST", headers: { "x-upsert": "true" }, body: "{}" });
  const u = r.ok && r.data && (r.data.url || r.data.signedURL || r.data.signedUrl);
  return u ? absSigned(u) : null;
}
async function isAdmin(ctx) { try { const r = await ctx.sb.rpc("nd_is_admin"); return r.data === true; } catch (e) { return false; } }

/* ---------- повикване на изпълнителя (GitHub Actions) ---------- */
const workerConfigured = () => { const g = GH(); return !!(g.token && /^[\w.-]{1,100}\/[\w.-]{1,100}$/.test(g.repo) && WSECRET().length >= 24); };
async function dispatch(jobId) {
  const g = GH();
  if (!workerConfigured()) return { ok: false, reason: "not_configured" };
  const r = await fetch("https://api.github.com/repos/" + g.repo + "/actions/workflows/" + encodeURIComponent(g.wf) + "/dispatches", { method: "POST",
    headers: { Authorization: "Bearer " + g.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "imotinadezhda-nc", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: g.ref, inputs: { job_id: String(jobId) } }) }).catch(() => null);
  const ok = !!r && r.status === 204;
  if (r && r.body) { try { await r.body.cancel(); } catch (e) { /* */ } }
  if (!ok) console.error("nc cad dispatch failed", corrOf(jobId), r ? r.status : "network");     // без токен, без адрес на хранилището
  await rpc("nd_cad_job_touch", { p_id: jobId, p_patch: { phase: "dispatched", dispatched_at: new Date().toISOString(), dispatch_ok: ok } });
  return ok ? { ok: true } : { ok: false, reason: r ? "http_" + r.status : "network" };
}
const waitingBg = (d) => (d && d.ok ? "Чака изпълнител: повикан е (GitHub Actions) – обработката започва до минута-две; следете jobs.status"
  : d && d.reason === "not_configured" ? "Чака изпълнител: още не е настроен на сървъра (липсват тайните му) – задачата е записана; нищо не е обработено"
  : "Чака изпълнител: не отговори на повикването – задачата е записана; jobs.status ще го повика отново");
/* резервно „побутване“ (по избор: един ред в tick() на api/push.js): повиква изпълнителя за чакащи задачи без скорошно повикване */
async function tick() {
  if (!SR() || !workerConfigured()) return 0;
  const r = await rest("/rest/v1/nd_jobs?kind=in.(cad_inspect,cad_convert)&status=eq.queued&cancel_requested=is.false&next_attempt_at=lte." + encodeURIComponent(new Date().toISOString()) + "&select=id,progress&order=created_at&limit=10");
  let n = 0;
  for (const j of Array.isArray(r.data) ? r.data : []) {
    const at = j.progress && j.progress.dispatched_at ? new Date(j.progress.dispatched_at).getTime() : 0;
    if (Date.now() - at < L.LIMITS.redispatchSec * 1000 || n >= 3) continue;
    if ((await dispatch(j.id)).ok) n++;
  }
  return n;
}

/* ---------- източник: съществува ли, какъв е по съдържание, колко е голям, отпечатък ---------- */
async function sourceInfo(path, corr, purpose) {
  const h = await head(path, 4096);
  if (!h.ok) throw h.code === "not_found" ? CErr("FILE_NOT_FOUND", "Файлът не е намерен в хранилището – първо го качете в проекта", 404, corr) : CErr("STORAGE_FAILED", "Хранилището не отговори – опитайте отново", 503, corr);
  const s = L.sniff(h.buf, path);
  if (!s.inspect) throw CErr("FILE_UNSUPPORTED", s.label_bg + ": " + (s.reason_bg || "не се поддържа"), 400, corr);
  const max = L.LIMITS.inputBytes[s.format] || 0;
  if (h.size > max) throw CErr("FILE_TOO_LARGE", s.label_bg + " е " + Math.ceil(h.size / L.MB) + " MB – най-много " + Math.round(max / L.MB) + " MB", 400, corr);
  if (purpose === "convert") {
    if (s.format === "pdf") throw CErr("NEEDS_SOURCE", "От PDF не се прави 3D модел: планът няма височини, а сканираният PDF не е CAD. Нужен е IFC, 3D DXF или GLB", 400, corr);
    if (s.format === "dwg" && !DWG_ON()) throw CErr("NEEDS_DXF_OR_IFC", "DWG (" + (s.version || "неизвестна версия") + ") не се конвертира: изпълнителят няма разрешен DWG конвертор. Изнесете чертежа като DXF или IFC", 400, corr);
  }
  let fp, kind = "sha256";
  if (h.size <= L.LIMITS.hashInlineBytes) {
    const x = await hashObject(path, L.LIMITS.hashInlineBytes + 1);
    if (!x.ok) throw CErr("STORAGE_FAILED", "Файлът не се прочете – опитайте отново", 503, corr);
    fp = x.sha256;
  } else { fp = L.sha256("storage:" + (h.etag || "") + ":" + h.size + ":" + path); kind = "storage"; }
  return { bytes: h.size, etag: h.etag, format: s.format, version: s.version, label_bg: s.label_bg, fp, sha_kind: kind, name: scrubName(path) };
}
const scrubName = (p) => String(p).split("/").pop().replace(/[\u0000-\u001f\u007f<>"'`\\]/g, "_").slice(0, 120);

async function projectOf(ctx, id, corr) {
  const r = await ctx.sb.from("nd_projects").select("id,status").eq("id", id).maybeSingle();
  if (r.error) throw dbErr(r.error, corr);
  if (!r.data) throw CErr("FILE_NOT_FOUND", "Проектът не е намерен", 404, corr);
  if (r.data.status === "archived") throw CErr("DB_CONFLICT", "Проектът е архивиран", 409, corr);
  return r.data;
}
async function existingJobs(ctx, kind, base, corr) {
  const r = await ctx.sb.from("nd_jobs").select("id,status,idempotency_key,created_at,progress,result").eq("kind", kind).like("idempotency_key", base + "%").order("created_at", { ascending: false }).limit(50);
  if (r.error) throw dbErr(r.error, corr);
  return (r.data || []).filter((j) => j.idempotency_key === base || /^:r\d+$/.test(j.idempotency_key.slice(base.length)));
}
const nextRev = (rows, base) => rows.reduce((m, j) => { const r = /:r(\d+)$/.exec(j.idempotency_key.slice(base.length)); return Math.max(m, r ? parseInt(r[1], 10) : 0); }, 0) + (rows.length ? 1 : 0);
async function startJob(ctx, kind, base, projectId, input, rerun, corr0) {
  const rows = await existingJobs(ctx, kind, base, corr0), latest = rows[0];
  if (latest && !rerun && !["failed", "cancelled"].includes(latest.status)) {
    let d = null;
    const at = latest.progress && latest.progress.dispatched_at ? new Date(latest.progress.dispatched_at).getTime() : 0;
    if (latest.status === "queued" && Date.now() - at > L.LIMITS.redispatchSec * 1000) d = await dispatch(latest.id);
    return { ok: true, job_id: latest.id, state: STATE[latest.status] || latest.status, status: latest.status, idempotent: true, created: false, dispatched: d ? d.ok : !!at,
      waiting_bg: latest.status === "queued" ? waitingBg(d || { ok: !!at }) : null, correlation_id: corrOf(latest.id), next: "jobs.status" };
  }
  const rev = nextRev(rows, base);
  const jr = await ctx.sb.rpc("nd_job_create", { p_kind: kind, p_key: rev ? base + ":r" + rev : base, p_project_id: projectId, p_input: Object.assign({}, input, { rev }) });
  if (jr.error) throw dbErr(jr.error, corr0);
  const j = jr.data || {};
  const d = j.created ? await dispatch(j.id) : { ok: false, reason: "exists" };
  return { ok: true, job_id: j.id, state: STATE[j.status] || j.status, status: j.status, idempotent: !j.created, created: !!j.created, revision: rev, dispatched: d.ok,
    waiting_bg: j.status === "queued" ? waitingBg(d.reason === "exists" ? { ok: true } : d) : null, format: input.format, bytes: input.bytes, correlation_id: corrOf(j.id), next: "jobs.status" };
}

/* ---------- инструменти ---------- */
const RUN = {
  "cad.inspect": async (ctx, i) => {
    const corr = corrOf();
    if (!SR()) throw CErr("WORKER_UNAVAILABLE", "Проверката на файлове работи само в продукционната среда", 503, corr);
    await projectOf(ctx, i.project_id, corr);
    if (!(await isAdmin(ctx))) throw CErr("FORBIDDEN", "Проверка на CAD/BIM файл пуска само администратор", 403, corr);
    const src = await sourceInfo(i.path, corr, "inspect");
    return startJob(ctx, "cad_inspect", L.inspectKey(i.project_id, src.fp), i.project_id,
      { path: i.path, sha256: src.fp, sha_kind: src.sha_kind, bytes: src.bytes, etag: src.etag, format: src.format, name: src.name }, !!i.rerun, corr);
  },

  "models.request": async (ctx, i) => {
    const corr = corrOf();
    if (!SR()) throw CErr("WORKER_UNAVAILABLE", "Конверсията към 3D модел работи само в продукционната среда", 503, corr);
    await projectOf(ctx, i.project_id, corr);
    if (!(await isAdmin(ctx))) throw CErr("FORBIDDEN", "Конверсия към 3D модел пуска само администратор", 403, corr);
    const b = await ctx.sb.from("nd_buildings").select("id,project_id").eq("id", i.building_id).maybeSingle();
    if (b.error) throw dbErr(b.error, corr);
    if (!b.data) throw CErr("FILE_NOT_FOUND", "Сградата не е намерена", 404, corr);
    if (b.data.project_id !== i.project_id) throw CErr("FORBIDDEN", "Сградата е от друг проект", 403, corr);
    const src = await sourceInfo(i.path, corr, "convert");
    // конверсия само на ПРОВЕРЕН файл, за който проверката е казала „може 3D“ (стъпка 7 от процеса)
    const insp = await existingJobs(ctx, "cad_inspect", L.inspectKey(i.project_id, src.fp), corr);
    const good = insp.find((j) => j.status === "done" && j.result && j.result.convertible === true);
    if (!good) {
      const done = insp.find((j) => j.status === "done");
      if (done) throw CErr("NEEDS_SOURCE", "Проверката показа, че от този файл не може да се направи 3D модел: " + L.scrub((done.result && done.result.convert_reason_bg) || "няма 3D геометрия", 240), 400, corr);
      if (insp.some((j) => j.status === "queued" || j.status === "running")) throw CErr("NOT_INSPECTED", "Проверката на файла още върви – изчакайте (jobs.status) и опитайте пак", 409, corr);
      throw CErr("NOT_INSPECTED", "Файлът още не е проверен – първо пуснете cad.inspect за него", 409, corr);
    }
    const mapping = i.mapping || {};
    return startJob(ctx, "cad_convert", L.convertKey(i.building_id, src.fp, mapping), i.project_id,
      { building_id: i.building_id, path: i.path, sha256: src.fp, sha_kind: src.sha_kind, bytes: src.bytes, etag: src.etag, format: src.format, name: src.name, inspect_job: good.id, mapping }, !!i.rerun, corr);
  },

  "models.publish": async (ctx, i) => {
    const corr = corrOf(i.job_id);
    const r = await ctx.sb.rpc("nd_model_publish", { p_job_id: i.job_id, p_building_id: i.building_id, p_expected_published: i.expected_published_version === undefined ? null : i.expected_published_version, p_rollback: !!i.rollback });
    if (r.error) throw dbErr(r.error, corr, "Публикуването не успя – нищо не е променено");
    const d = r.data || {};
    return { building_id: d.building_id, model_public: true, version: d.version, previous_version: d.previous_version || null, replayed: !!d.replayed,
      message: d.replayed ? "Тази версия вече е публикувана" : "Версия " + d.version + " е публична през /model/" + d.building_id + (d.previous_version ? " (предишната v" + d.previous_version + " е запазена за връщане)" : ""), correlation_id: corr };
  },

  "models.unpublish": async (ctx, i) => {
    const corr = corrOf();
    const r = await ctx.sb.rpc("nd_model_unpublish", { p_building_id: i.building_id, p_expected_published: i.expected_published_version });
    if (r.error) throw dbErr(r.error, corr, "Свалянето не успя – нищо не е променено");
    const d = r.data || {};
    return { building_id: d.building_id, model_public: false, previous_version: d.previous_version || null, changed: !!d.changed, correlation_id: corr };
  },

  "models.get": async (ctx, i) => {
    const corr = corrOf();
    const b = await ctx.sb.from("nd_buildings").select("id,project_id").eq("id", i.building_id).maybeSingle();
    if (b.error) throw dbErr(b.error, corr);
    if (!b.data) throw CErr("FILE_NOT_FOUND", "Сградата не е намерена", 404, corr);
    const r = await ctx.sb.from("nd_models").select("id,version,status,fidelity,source_format,glb_bytes,stats,job_id,created_at,published_at,retired_at").eq("building_id", i.building_id).order("version", { ascending: false }).limit(200);
    if (r.error) throw dbErr(r.error, corr);
    const rows = r.data || [], pub = rows.find((m) => m.status === "published");
    const view = (m) => ({ version: m.version, status: m.status, status_bg: { review: "Чака преглед", published: "Публикуван", retired: "Свален (пази се)", rejected: "Отхвърлен" }[m.status], fidelity: m.fidelity,
      source_format: m.source_format, bytes: Number(m.glb_bytes), triangles: (m.stats && m.stats.triangles) || null, floors_mapped: (m.stats && m.stats.floors_mapped) || 0, units_mapped: (m.stats && m.stats.units_mapped) || 0,
      units_total: (m.stats && m.stats.units_total) == null ? null : m.stats.units_total, job_id: m.job_id, created_at: m.created_at, published_at: m.published_at || null, retired_at: m.retired_at || null });
    const pick = i.version ? rows.find((m) => m.version === i.version) : pub || rows.find((m) => m.status === "review") || rows.find((m) => m.status !== "rejected") || null;
    if (i.version && !pick) throw CErr("FILE_NOT_FOUND", "Няма такава версия на модела", 404, corr);
    let selected = null;
    if (pick) {
      const f = await ctx.sb.from("nd_models").select("id,version,report,mapping,stats,glb_path,poster_path,glb_sha256,source_sha256").eq("id", pick.id).maybeSingle();
      if (f.error) throw dbErr(f.error, corr);
      const m = f.data || {};
      selected = Object.assign(view(pick), { glb_sha256: m.glb_sha256, source_sha256: m.source_sha256, stats: stripKeys(m.stats), report: m.report || {}, mapping: m.mapping || {}, has_poster: !!m.poster_path });
      if (i.preview) {
        if (!SR()) throw CErr("WORKER_UNAVAILABLE", "Прегледът на модела работи само в продукционната среда", 503, corr);
        const u = m.glb_path ? await signGet(m.glb_path, L.LIMITS.previewTtlSec) : null;
        if (!u) throw CErr("STORAGE_FAILED", "Файлът на модела не е достъпен в момента", 503, corr);
        selected.preview_url = u; selected.preview_expires_in = L.LIMITS.previewTtlSec;
      }
    }
    return { building_id: i.building_id, published_version: pub ? pub.version : null, versions: rows.map(view), selected, correlation_id: corr };
  }
};
const stripKeys = (s) => { const o = Object.assign({}, s || {}); delete o.unit_ids; delete o.floor_ids; return o; };

/* ---------- jobs.status за тежките задачи: честно „чака изпълнител“, повторно повикване, какво следва ---------- */
async function decorate(v) {
  const p = v.progress || {};
  if (p.phase && PHASE_BG[p.phase] && !p.phase_bg) v.progress = Object.assign({}, p, { phase_bg: PHASE_BG[p.phase] });
  if (v.status === "queued" && !v.cancel_requested) {
    const at = p.dispatched_at ? new Date(p.dispatched_at).getTime() : 0, due = !v.retry_at;
    let d = { ok: !!at && p.dispatch_ok !== false, reason: workerConfigured() ? "network" : "not_configured" };
    if (due && SR() && Date.now() - at > L.LIMITS.redispatchSec * 1000) d = await dispatch(v.id);
    v.waiting_for_worker = true; v.waiting_bg = waitingBg(d); v.dispatched = d.ok;
  } else { v.waiting_for_worker = false; v.waiting_bg = null; }
  if (v.status === "review" && v.kind === "cad_convert") v.next = "models.get (преглед на версията) → models.publish само след изрично „Да“ от администратор";
  if (v.status === "done" && v.kind === "cad_inspect") v.next = "jobs.result → ако convertible: models.request";
  v.correlation_id = corrOf(v.id);
  return v;
}
async function basicStatus(ctx, i) {
  const r = await ctx.sb.from("nd_jobs").select("id,kind,status,project_id,progress,attempts,max_attempts,error,cancel_requested,next_attempt_at,created_at,updated_at,finished_at").eq("id", i.id).maybeSingle();
  if (r.error) throw dbErr(r.error, corrOf(i.id));
  if (!r.data) throw CErr("FILE_NOT_FOUND", "Задачата не е намерена", 404, corrOf(i.id));
  const j = r.data, err = String(j.error || ""), m = /^\[([A-Z_]+)\]\s*/.exec(err);
  return { id: j.id, kind: j.kind, status: j.status, state: STATE[j.status] || j.status, project_id: j.project_id, progress: j.progress || {}, attempts: j.attempts, max_attempts: j.max_attempts,
    error_code: m ? m[1] : (j.status === "failed" ? "INTERNAL_ERROR" : null), error: err ? err.replace(/^\[[A-Z_]+\]\s*/, "").slice(0, 300) : null,
    retry_at: j.status === "queued" && j.next_attempt_at && new Date(j.next_attempt_at).getTime() > Date.now() ? j.next_attempt_at : null, cancel_requested: !!j.cancel_requested,
    requires_review: j.status === "review", created_at: j.created_at, updated_at: j.updated_at, finished_at: j.finished_at || null };
}
function wrapJobs(run) {
  const orig = run["jobs.status"];
  run["jobs.status"] = async (ctx, i) => {
    const v = orig ? await orig(ctx, i) : await basicStatus(ctx, i);
    return v && KINDS.includes(v.kind) ? decorate(v) : v;
  };
  return run;
}

/* ---------- обратни повиквания на изпълнителя: POST /api/tools?ncw=claim|beat|finish|next ---------- */
const UUID = C.patterns.UUID, RUN_ID = /^[0-9]{1,20}\.[0-9]{1,4}$/;
async function rawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (req.body !== undefined && req.body !== null) return null;        // вече разглобен JSON → точните байтове ги няма; изпълнителят праща text/plain
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > L.LIMITS.callbackBodyBytes) return null; chunks.push(Buffer.from(c)); }
  return Buffer.concat(chunks).toString("utf8");
}
async function jobRow(id) {
  const r = await rest("/rest/v1/nd_jobs?id=eq." + encodeURIComponent(id) + "&select=id,kind,status,project_id,input,attempts,locked_by,cancel_requested,next_attempt_at,result");
  return r.ok && Array.isArray(r.data) ? r.data[0] || null : undefined;      // undefined = базата не отговори
}
const failText = (code, text) => "[" + code + "] " + L.scrub(text || L.ERR[code] || "Грешка", 300);
const failFinal = (job, worker, code, text, result) => rpc("nd_job_fail_final", { p_id: job.id, p_worker: worker, p_error: failText(code, text), p_result: result || { state: "failed", error_code: code, correlation_id: corrOf(job.id) } });
const modelBase = (job) => "projects/" + job.project_id + "/private/derived/models/" + job.id + "/a" + job.attempts + "-";
const pathOk = (p, pid) => typeof p === "string" && C.patterns.PRIVATE_PATH.test(p) && C.pathInProject(p, pid) && !/\.\.|\/\/|%|\\/.test(p);

async function structureOf(job) {
  const pid = encodeURIComponent(job.project_id), bid = encodeURIComponent(job.input.building_id || "");
  const [b, f, u] = await Promise.all([
    rest("/rest/v1/nd_buildings?id=eq." + bid + "&project_id=eq." + pid + "&select=id"),
    rest("/rest/v1/nd_floors?building_id=eq." + bid + "&select=id,level,label&order=level"),
    rest("/rest/v1/nd_units?building_id=eq." + bid + "&select=id,code,floor_id&order=code&limit=5000")]);
  if (!b.ok || !f.ok || !u.ok) return undefined;
  if (!Array.isArray(b.data) || !b.data[0]) return null;
  return { building_id: job.input.building_id, floors: (f.data || []).map((x) => ({ id: x.id, level: x.level, label: x.label || null })), units: (u.data || []).map((x) => ({ id: x.id, code: x.code, floor_id: x.floor_id })) };
}

const CB = {
  /* най-старата чакаща задача (за ръчно пускане без job_id и за периодичното изравняване) – нищо не взима */
  next: async () => {
    const r = await rest("/rest/v1/nd_jobs?kind=in.(cad_inspect,cad_convert)&status=eq.queued&cancel_requested=is.false&next_attempt_at=lte." + encodeURIComponent(new Date().toISOString()) + "&select=id&order=created_at&limit=1");
    if (!r.ok) return [503, { ok: false, error: "db" }];
    return [200, { ok: true, job_id: (r.data && r.data[0] && r.data[0].id) || null }];
  },

  claim: async (b, worker) => {
    const c = await rpc("nd_job_claim_id", { p_id: b.job_id, p_kinds: KINDS, p_worker: worker });
    if (!c.ok) return [c.data && (c.data.code === "PGRST202" || c.data.code === "42883") ? 503 : 503, { ok: false, error: "db" }];
    let job = c.data && c.data.id ? c.data : null;
    if (!job) {
      const j = await jobRow(b.job_id);
      if (j === undefined) return [503, { ok: false, error: "db" }];
      if (!j || !KINDS.includes(j.kind)) return [404, { ok: false, error: "unknown_job" }];
      if (!(j.status === "running" && j.locked_by === worker))        // вече приключила, отменена, взета от друг или още в изчакване → нищо за правене
        return [200, { ok: true, claimed: false, status: j.status, reason: j.status === "queued" ? (j.cancel_requested ? "cancelled" : "not_due") : j.status === "running" ? "taken" : "finished" }];
      job = j;                                                         // същото пускане пита пак → същият отговор с нови адреси
    }
    const inp = job.input || {}, corr = corrOf(job.id);
    const stop = async (code, text) => { await failFinal(job, worker, code, text); return [200, { ok: true, claimed: false, status: "failed", reason: code }]; };
    if (!pathOk(inp.path, job.project_id)) return stop("INVALID_INPUT", "Пътят на файла не е в папката на проекта");
    const h = await head(inp.path, 4096);
    if (!h.ok) { if (h.code === "not_found") return stop("FILE_NOT_FOUND", "Файлът вече не е в хранилището"); await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: "failed", p_result: null, p_error: failText("STORAGE_FAILED"), p_cost_usd: 0 }); return [200, { ok: true, claimed: false, status: "queued", reason: "STORAGE_FAILED" }]; }
    if ((inp.etag && h.etag && inp.etag !== h.etag) || (inp.bytes && h.size !== inp.bytes)) return stop("SOURCE_CHANGED");
    const s = L.sniff(h.buf, inp.path);
    if (!s.inspect) return stop("FILE_UNSUPPORTED", s.label_bg + ": " + (s.reason_bg || "не се поддържа"));
    if (h.size > (L.LIMITS.inputBytes[s.format] || 0)) return stop("FILE_TOO_LARGE", s.label_bg + " е " + Math.ceil(h.size / L.MB) + " MB");
    const out = { ok: true, claimed: true, job: { id: job.id, kind: job.kind, attempt: job.attempts, correlation_id: corr },
      source: { bytes: h.size, sha256: inp.sha_kind === "storage" ? null : inp.sha256 || null, format: s.format, version: s.version, name: scrubName(inp.path), ttl: L.LIMITS.sourceTtlSec },
      limits: { input_bytes: L.LIMITS.inputBytes[s.format], glb_bytes: L.LIMITS.glbOutBytes, poster_bytes: L.LIMITS.posterBytes, triangles: L.LIMITS.triangles, nodes: L.LIMITS.nodes,
        minutes: job.kind === "cad_convert" ? L.LIMITS.convertMinutes : L.LIMITS.inspectMinutes, report_bytes: 200 * 1024 },
      heartbeat_secs: L.LIMITS.heartbeatSec, dwg_converter_allowed: DWG_ON() };
    if (job.kind === "cad_convert") {
      const st = await structureOf(job);
      if (st === undefined) { await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: "failed", p_result: null, p_error: failText("STORAGE_FAILED", "Базата не отговори"), p_cost_usd: 0 }); return [200, { ok: true, claimed: false, status: "queued", reason: "STORAGE_FAILED" }]; }
      if (!st) return stop("INVALID_INPUT", "Сградата вече не съществува");
      out.structure = st; out.mapping = inp.mapping || {};
      const base = modelBase(job), [g, p] = await Promise.all([signPut(base + "model.glb"), signPut(base + "poster.jpg")]);
      if (!g) { await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: "failed", p_result: null, p_error: failText("STORAGE_FAILED", "Адресът за качване не се издаде"), p_cost_usd: 0 }); return [200, { ok: true, claimed: false, status: "queued", reason: "STORAGE_FAILED" }]; }
      out.upload = { glb: { url: g, method: "PUT", content_type: "model/gltf-binary" }, poster: p ? { url: p, method: "PUT", content_type: "image/jpeg" } : null };
    }
    const src = await signGet(inp.path, L.LIMITS.sourceTtlSec);
    if (!src) { await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: "failed", p_result: null, p_error: failText("STORAGE_FAILED", "Адресът за теглене не се издаде"), p_cost_usd: 0 }); return [200, { ok: true, claimed: false, status: "queued", reason: "STORAGE_FAILED" }]; }
    out.source.url = src;
    await rpc("nd_job_heartbeat", { p_id: job.id, p_worker: worker, p_progress: { phase: "claimed", phase_bg: PHASE_BG.claimed, correlation_id: corr } });
    return [200, out];
  },

  beat: async (b, worker) => {
    const p = L.cleanReport(b.progress || {}, { maxArray: 20, maxKeys: 12, maxString: 120, maxDepth: 2 }) || {};
    const phase = typeof p.phase === "string" && PHASE_BG[p.phase] ? p.phase : "convert";
    const prog = { phase, phase_bg: PHASE_BG[phase], pct: Math.max(0, Math.min(100, Math.round(Number(p.pct) || 0))), note: typeof p.note === "string" ? p.note : null, correlation_id: corrOf(b.job_id) };
    const r = await rpc("nd_job_heartbeat", { p_id: b.job_id, p_worker: worker, p_progress: prog });
    if (!r.ok) return [503, { ok: false, error: "db" }];
    return [200, { ok: true, cancel: r.data === true }];        // true = поискана е отмяна ИЛИ задачата вече не е на този изпълнител → спри и изчисти
  },

  finish: async (b, worker) => {
    const job = await jobRow(b.job_id);
    if (job === undefined) return [503, { ok: false, error: "db" }];
    if (!job || !KINDS.includes(job.kind)) return [404, { ok: false, error: "unknown_job" }];
    const corr = corrOf(job.id);
    if (!(job.status === "running" && job.locked_by === worker)) {
      // повтор на вече прието отчитане (мрежата е прекъснала след записа) → същият отговор; иначе – остарял изпълнител, нищо не се записва
      const done = ["review", "done"].includes(job.status) && job.result && job.result.reported_by === worker;
      return done ? [200, { ok: true, replayed: true, status: job.status }] : [409, { ok: false, error: "stale", status: job.status }];
    }
    const outcome = String(b.outcome || "");
    if (outcome === "cancelled") { const r = await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: "cancelled", p_result: null, p_error: failText("CANCELLED"), p_cost_usd: 0 }); return r.ok ? [200, { ok: true, status: "cancelled" }] : [409, { ok: false, error: "stale" }]; }
    if (outcome === "failed") {
      const code = L.ERR[b.error_code] ? b.error_code : "INTERNAL_ERROR", rep = b.report ? L.fitJson(L.cleanReport(b.report), 60000, ["format", "version", "warnings"]) : null;
      const res = Object.assign({ state: "failed", error_code: code, correlation_id: corr, reported_by: worker }, rep ? { report: rep } : {});
      const r = L.RETRYABLE.has(code) && b.retryable !== false
        ? await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: "failed", p_result: res, p_error: failText(code, b.error), p_cost_usd: 0 })
        : await failFinal(job, worker, code, b.error, res);
      return r.ok ? [200, { ok: true, status: "failed", retry: L.RETRYABLE.has(code) && b.retryable !== false }] : [409, { ok: false, error: "stale" }];
    }
    if (outcome !== "ok" || !b.report || typeof b.report !== "object") return [400, { ok: false, error: "bad_outcome" }];
    const inp = job.input || {}, srcSha = b.source && /^[a-f0-9]{64}$/.test(String(b.source.sha256 || "")) ? b.source.sha256 : null;
    if (!srcSha) return [400, { ok: false, error: "source_hash_required" }];
    if (inp.sha_kind !== "storage" && inp.sha256 && inp.sha256 !== srcSha) { await failFinal(job, worker, "SOURCE_CHANGED", "Изпълнителят е обработил различен файл от заявения"); return [200, { ok: true, status: "failed", reason: "SOURCE_CHANGED" }]; }

    if (job.kind === "cad_inspect") {
      const rep = L.fitJson(L.cleanReport(b.report), 60000, ["format", "version", "units", "is_vector", "is_3d", "convertible", "convert_reason_bg", "summary_bg", "warnings", "dependencies"]);
      const result = Object.assign({}, rep, { state: "succeeded", convertible: b.report.convertible === true, source_sha256: srcSha, source_bytes: Number(b.source.bytes) || inp.bytes || null, correlation_id: corr, reported_by: worker });
      const r = await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: "done", p_result: result, p_error: null, p_cost_usd: 0 });
      return r.ok ? [200, { ok: true, status: "done" }] : [409, { ok: false, error: "stale" }];
    }

    // cad_convert: сървърът НЕ вярва на изпълнителя за пътища и съдържание – пътят се смята тук, файлът се тегли и проверява тук
    const glbPath = modelBase(job) + "model.glb", posterPath = modelBase(job) + "poster.jpg";
    const bad = async (text, extra) => { await failFinal(job, worker, "ARTIFACT_INVALID", text, Object.assign({ state: "failed", error_code: "ARTIFACT_INVALID", correlation_id: corr, reported_by: worker }, extra || {})); return [200, { ok: true, status: "failed", reason: "ARTIFACT_INVALID" }]; };
    const st = await structureOf(job);
    if (st === undefined) return [503, { ok: false, error: "db" }];
    if (!st) return bad("Сградата вече не съществува");
    const g = await download(glbPath, L.LIMITS.glbOutBytes);
    if (!g.ok) return g.code === "failed" ? [503, { ok: false, error: "storage" }] : bad(g.code === "too_large" ? "Моделът е над " + Math.round(L.LIMITS.glbOutBytes / L.MB) + " MB" : "Файлът на модела не е качен");
    const sha = L.sha256(g.buf);
    if (!b.glb || b.glb.sha256 !== sha || Number(b.glb.bytes) !== g.buf.length) return bad("Каченият модел не съвпада с отчетения (хеш/размер)");
    const v = L.validateGlb(g.buf, { strict: true, unitIds: new Set(st.units.map((u) => u.id)), floorIds: new Set(st.floors.map((f) => f.id)) });
    if (!v.ok) return bad(v.errors.slice(0, 3).join("; "), { artifact_errors: v.errors });
    let poster = null;
    if (b.poster) { const p = await download(posterPath, L.LIMITS.posterBytes); if (p.ok && p.buf.length > 200 && p.buf[0] === 0xff && p.buf[1] === 0xd8 && L.sha256(p.buf) === b.poster.sha256) poster = posterPath; }
    const fmt = ["ifc", "dxf", "dwg", "glb", "gltf"].includes(String(b.source.format)) ? String(b.source.format) : null;
    if (!fmt) return bad("Непознат формат на източника");
    let fidelity = String(b.report.status || "").toLowerCase();
    if (!["exact", "verified", "conceptual"].includes(fidelity)) fidelity = "conceptual";
    if ((fmt === "glb" || fmt === "gltf") && fidelity === "exact") fidelity = "verified";       // мрежов файл не е авторитетен BIM/CAD източник
    const stats = Object.assign(stripKeys(v.stats), { units_total: st.units.length, floors_total: st.floors.length, source_triangles: Number(b.report.source_triangles) || null });
    delete stats.textures_detail;
    const report = L.fitJson(Object.assign(L.cleanReport(b.report), { textures: v.stats.textures_detail, artifact_warnings: v.warnings }), 200 * 1024, ["status", "units", "origin", "axes", "bbox", "floors", "control_dimensions", "missing_geometry", "warnings", "source_hash", "tools"]);
    const mapping = L.fitJson(L.cleanReport(b.mapping || {}, { maxArray: 4000, maxKeys: 60 }), 480 * 1024, ["floors", "rules"]);
    const model = { fidelity, source_format: fmt, source_sha256: srcSha, source_bytes: Number(b.source.bytes) || inp.bytes || 1, glb_path: glbPath, glb_sha256: sha, glb_bytes: g.buf.length, poster_path: poster, stats, report, mapping };
    const result = { state: "needs_review", format: fmt, fidelity, stats: { bytes: stats.bytes, triangles: stats.triangles, bbox: stats.bbox, units_mapped: stats.units_mapped, units_total: stats.units_total, floors_mapped: stats.floors_mapped, floors_total: stats.floors_total },
      warnings: (report.warnings || []).slice(0, 20), correlation_id: corr, reported_by: worker };
    const r = await rpc("nd_model_register", { p_job_id: job.id, p_worker: worker, p_model: model, p_result: result });
    if (!r.ok) {
      const code = r.data && r.data.code;
      if (code === "42501") return [409, { ok: false, error: "stale" }];
      if (code === "PGRST202" || code === "42883") { await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: "failed", p_result: null, p_error: failText("MIGRATION_MISSING"), p_cost_usd: 0 }); return [200, { ok: true, status: "failed", reason: "MIGRATION_MISSING" }]; }
      return bad("Версията не се записа (" + String(code || r.status) + ")");
    }
    return [200, { ok: true, status: r.data.cancelled ? "cancelled" : "review", model_version: r.data.version || null, replayed: !!r.data.replayed }];
  }
};

async function workerCallback(req, res) {
  const send = (status, body) => { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Robots-Tag", "noindex"); res.end(JSON.stringify(body)); };
  try {
    let u; try { u = new URL(req.url, "https://imotinadezhda.bg"); } catch (e) { return send(400, { ok: false, error: "bad_request" }); }
    const action = String(u.searchParams.get("ncw") || "");
    if (!CB[action]) return send(404, { ok: false, error: "unknown_action" });
    if (!SR() || WSECRET().length < 24) return send(503, { ok: false, error: "not_configured" });
    const raw = await rawBody(req);
    if (raw === null || raw.length > L.LIMITS.callbackBodyBytes) return send(raw === null ? 415 : 413, { ok: false, error: raw === null ? "send_text_plain" : "too_large" });
    const v = L.verify(WSECRET(), req.headers["x-nc-timestamp"], action, raw, req.headers["x-nc-signature"]);
    if (!v.ok) return send(401, { ok: false, error: "unauthorized" });           // без подробности защо
    let b; try { b = JSON.parse(raw); } catch (e) { return send(400, { ok: false, error: "bad_json" }); }
    if (!b || typeof b !== "object" || Array.isArray(b)) return send(400, { ok: false, error: "bad_json" });
    if (action === "next") { const [s, o] = await CB.next(); return send(s, o); }
    if (!UUID.test(String(b.job_id || "")) || !RUN_ID.test(String(b.run || ""))) return send(400, { ok: false, error: "bad_input" });
    const [status, out] = await CB[action](b, "gha:" + b.run);
    return send(status, out);
  } catch (e) {
    console.error("nc cad callback failed", String((e && e.message) || e).slice(0, 120));     // без тяло, подпис и адреси
    return send(500, { ok: false, error: "internal" });
  }
}

/* ---------- публично отваряне: /model/<сграда> и /model/<сграда>/poster ---------- */
async function publicModel(req, res) {
  const deny = (code) => { res.statusCode = code; res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.setHeader("X-Robots-Tag", "noindex"); res.end(code === 404 ? "Няма достъпен 3D модел" : "Невалидна заявка"); };
  let u; try { u = new URL(req.url, "https://imotinadezhda.bg"); } catch (e) { return deny(400); }
  const m = /^([a-z0-9]{8,64})(?:[:/](poster))?$/.exec(String(u.searchParams.get("model") || ""));
  if (!m) return deny(400);
  if (!SR()) return deny(404);
  const r = await rpc("nd_model_resolve", { p_building_id: m[1], p_what: m[2] || "glb" });
  if (!r.ok || !r.data || typeof r.data !== "object" || !r.data.path) return deny(404);
  const signed = await signGet(r.data.path, L.LIMITS.publicTtlSec);
  if (!signed) return deny(404);
  res.statusCode = 302; res.setHeader("Location", signed); res.setHeader("Cache-Control", "no-store, max-age=0"); res.setHeader("X-Robots-Tag", "noindex"); res.setHeader("Referrer-Policy", "no-referrer"); res.end();
}

module.exports = { RUN, wrapJobs, workerCallback, publicModel, tick, dispatch, workerConfigured, decorate, CErr, dbErr, corrOf, KINDS, PHASE_BG, _internals: { head, sourceInfo, modelBase, pathOk } };
