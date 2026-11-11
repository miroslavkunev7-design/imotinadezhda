// ИМОТИ НАДЕЖДА · Ново строителство · TASK-010 · индивидуални интериори, реална 3D разходка и 360° панорами – инструменти за /api/tools.
// Зарежда се от api/_nc-tools.js (същият регистър, същият токен на служителя, същата проверка nd_is_staff, същият одит в nd_audit);
// не е отделна Vercel функция (името започва с „_“). Тед (n8n → crm_tools) и CRM викат ЕДИН И СЪЩ код.
//   • Запис: само тук, след проверка на ролята (nd_is_admin през токена на служителя) и на входа, през RPC на nc_006 със service role;
//     актьорът винаги е от токена (ctx.userId), никога от входа.
//   • Тежка работа не се представя като мигновена: рендер/качване на панорами е задача tour_render (nd_jobs) – job_id веднага,
//     всеки файл се отчита с tour.report; jobs.status / jobs.cancel (TASK-006) показват напредъка и отменят.
//   • Изпълнителят на рендера е браузърът на администратора (mobile/nc-tour.js рендерира от СЪЩАТА сцена) или качване на
//     истински панорами; сървърът само проверява файла и прави производната (без EXIF) – n8n не рендерира нищо.
//   • Публиката получава само производните през съществуващия /pano/<обект>/<n> (TASK-007) и nd_public_tour() – за Свободен обект.
"use strict";
const crypto = require("crypto");
const C = require("./_nc-contracts.js");
const TC = require("./_nc-tours-contracts.js");
const T = require("./_nc-tours-core.js");

const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const BUCKET = "nd-files";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const VIEWER = "nc-tour@1";
const WORKER = (jobId) => "tour:" + jobId;
const ERR_BG = { FORBIDDEN: "Нямате право", NOT_FOUND: "Не е намерено", INVALID_INPUT: "Невалидни данни", GEOMETRY_MISSING: "Няма проверена геометрия", DB_CONFLICT: "Конфликт на версии",
  STALE_CALLBACK: "Остарял отговор", CANCELLED: "Отменено", STORAGE_FAILED: "Грешка в хранилището", DOWNSTREAM_UNAVAILABLE: "Услугата не е налична", INTERNAL_ERROR: "Вътрешна грешка" };
const RETRYABLE = new Set(["STORAGE_FAILED", "DOWNSTREAM_UNAVAILABLE", "INTERNAL_ERROR", "FILE_MISSING"]);

const corr = (x) => "tour-" + (x ? String(x).replace(/-/g, "").slice(0, 8) : crypto.randomBytes(4).toString("hex"));
function TErr(code, message, http, c) { const e = new Error(message + " [" + code + " · " + (c || corr()) + "]"); e.status = http; e.code = code; e.retryable = RETRYABLE.has(code); return e; }
function dbErr(error, c, fallback) {
  const code = String((error && error.code) || ""), msg = String((error && error.message) || "");
  const bg = /[а-я]/i.test(msg) ? msg.slice(0, 240) : null;
  if (code === "PGRST202" || code === "42883" || code === "42P01") return TErr("DOWNSTREAM_UNAVAILABLE", "Липсва миграцията за разходки (nc_006) в базата", 503, c);
  if (code === "NC409" || code === "40001" || code === "23505") return TErr("DB_CONFLICT", bg || "Данните са променени от друг – презаредете", 409, c);
  if (code === "42501") return TErr("FORBIDDEN", bg && !/permission denied|row-level/i.test(msg) ? bg : "Нямате право за това действие", 403, c);
  if (code === "P0002") return TErr("NOT_FOUND", bg || "Не е намерено", 404, c);
  if (code === "22023" || code === "23514" || code === "22P02" || code === "23502" || code === "23503") return TErr("INVALID_INPUT", bg || "Невалидни данни", 400, c);
  if (code === "54000") return TErr("DB_CONFLICT", bg || "Твърде много задачи за кратко време", 429, c);
  return TErr("INTERNAL_ERROR", fallback || "Грешка в базата", 500, c);
}

/* ---------- достъп със service role (само на сървъра) – подменя се в тестовете ---------- */
const encPath = (p) => String(p).split("/").map(encodeURIComponent).join("/");
const H = (extra) => Object.assign({ apikey: SR(), Authorization: "Bearer " + SR() }, extra || {});
const REAL = {
  ready: () => !!SR(),
  async rpc(fn, args) {
    const r = await fetch(SB_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: H({ "Content-Type": "application/json" }), body: JSON.stringify(args || {}) }).catch(() => null);
    if (!r) { const e = new Error("network"); e.code = "NETWORK"; throw e; }
    const t = await r.text().catch(() => ""); let d = null; try { d = t ? JSON.parse(t) : null; } catch (x) { d = t; }
    if (!r.ok) { const e = new Error((d && d.message) || "HTTP " + r.status); e.code = (d && d.code) || "HTTP" + r.status; e.detail = d && d.details; throw e; }
    return d;
  },
  async download(p, max) {
    const r = await fetch(SB_URL + "/storage/v1/object/" + BUCKET + "/" + encPath(p), { headers: H() }).catch(() => null);
    if (!r) return { ok: false, code: "STORAGE_FAILED" };
    if (r.status === 400 || r.status === 404) return { ok: false, code: "FILE_MISSING" };
    if (!r.ok) return { ok: false, code: "STORAGE_FAILED" };
    const len = Number(r.headers.get("content-length") || 0);
    if (len && len > max) { try { await r.body.cancel(); } catch (e) { /* */ } return { ok: false, code: "FILE_TOO_LARGE" }; }
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > max ? { ok: false, code: "FILE_TOO_LARGE" } : { ok: true, buf: b };
  },
  async upload(p, buf, mime) {
    const r = await fetch(SB_URL + "/storage/v1/object/" + BUCKET + "/" + encPath(p), { method: "POST", headers: H({ "Content-Type": mime, "x-upsert": "false", "Cache-Control": "no-store" }), body: buf }).catch(() => null);
    if (r && r.ok) return "ok";
    if (r && (r.status === 409 || r.status === 400)) { const t = await r.text().catch(() => ""); if (/exists|Duplicate/i.test(t)) return "exists"; }
    return "failed";
  },
  async remove(p) { const r = await fetch(SB_URL + "/storage/v1/object/" + BUCKET + "/" + encPath(p), { method: "DELETE", headers: H() }).catch(() => null); return !!(r && r.ok); }
};
let BACK = REAL;
function _setBackend(b) { BACK = b || REAL; }
async function svc(fn, args, c) { if (!BACK.ready()) throw TErr("DOWNSTREAM_UNAVAILABLE", "Сървърът няма ключ за записа (SUPABASE_SERVICE_ROLE_KEY)", 503, c); try { return await BACK.rpc(fn, args); } catch (e) { throw dbErr(e, c); } }
async function userRpc(ctx, fn, args, c) { const r = await ctx.sb.rpc(fn, args); if (r.error) throw dbErr(r.error, c); return r.data; }
async function requireAdmin(ctx, c) { const r = await ctx.sb.rpc("nd_is_admin"); if (!r || r.data !== true) throw TErr("FORBIDDEN", "Само администратор може да прави това (интериор, рендер, публикуване)", 403, c); }
const actor = (ctx) => ({ p_actor: ctx.userId, p_email: (ctx.user && ctx.user.email) || null });

/* ---------- изгледи ---------- */
const state = (ctx, unitId, c) => userRpc(ctx, "nd_tour_state", { p_unit_id: unitId }, c);
const verifiedOf = (st) => (st.geometry || []).find((g) => g.status === "verified") || null;
const names = (geom) => { const o = {}; geom.rooms.forEach((r) => { o[r.id] = r.name || T.ROOM_BG[r.type] || r.id; }); return o; };
function pickStyle(st) {
  const s = st.styles || [];
  return s.find((x) => x.scope === "unit") || s.find((x) => x.scope === "building") || s.find((x) => x.scope === "project") || null;
}
function summaryOf(st, full) {
  const g = st.geometry || [], vg = verifiedOf(st);
  const pub = (st.tours || []).find((t) => t.status === "published") || null;
  const blocked = [], next = [];
  if (!vg) {
    const d = g.find((x) => x.status === "draft");
    if (!d) { blocked.push("Няма въведена геометрия на апартамента (стаи, стени, отвори, височини) – без нея точен интериор и разходка не се правят."); next.push("interior.geometry_save"); }
    else if (d.validation && d.validation.blocked && d.validation.blocked.length) { blocked.push.apply(blocked, d.validation.blocked); next.push("interior.geometry_save (поправена)"); }
    else next.push("interior.geometry_verify");
  } else {
    const sc = (st.scenes || []).filter((s) => s.geometry_id === vg.id && !["stale", "superseded", "rejected"].includes(s.status));
    if (!sc.length) next.push("interior.prepare");
    else if (sc[0].status === "draft") next.push("interior.validate (има проблеми в сцената)");
    else if (sc[0].status === "review") next.push("interior.approve");
    const sets = (st.sets || []).filter((x) => x.geometry_id === vg.id);
    if (!sets.length && sc.length) next.push("tour.render");
    const rv = sets.find((x) => x.status === "review");
    if (rv) next.push("tour.publish");
  }
  const strip = (s) => { const o = Object.assign({}, s); if (!full) { o.items = Object.fromEntries(Object.entries(s.items || {}).map(([k, v]) => [k, Object.assign({}, v, { thumb: undefined, hotspots: (v.hotspots || []).length })])); } return o; };
  return {
    unit: st.unit, published: pub, blocked, next,
    geometry: g.map((x) => (full ? x : Object.assign({}, x, { geometry: undefined }))),
    styles: st.styles, scenes: st.scenes, sets: (st.sets || []).map(strip), tours: st.tours, media_count: st.media_count,
    labels: T.LABELS
  };
}
/* навигация без мебели (за набори от снимки, когато няма сцена) */
function navOf(geom, scene) {
  if (scene && scene.navigation) return scene.navigation;
  const b = T.buildScene(geom, { conceptual_elements_allowed: false }, {});
  return b.ok ? b.scene.navigation : null;
}
const prefixOf = (projectId, unitId, setId) => "projects/" + projectId + "/private/tours/" + unitId + "/" + setId;
async function cleanup(setId, keepPublished, c) {
  try {
    const p = await svc("nd_tour_paths", { p_set_id: setId }, c);
    if (keepPublished && p.published_media) return 0;
    let n = 0;
    for (const it of Object.values(p.items || {})) { for (const x of [it.path, it.src_path]) if (x) { if (await BACK.remove(x)) n++; } }
    return n;
  } catch (e) { return 0; }
}

/* ---------- инструменти ---------- */
const RUN = {
  "interior.geometry_save": async (ctx, i) => {
    const c = corr(i.unit_id); await requireAdmin(ctx, c);
    const v = T.validateGeometry(i.geometry);
    if (!v.ok) return { ok: false, state: "invalid", errors: v.errors.slice(0, 60), blocked: v.blocked, warnings: v.warnings, correlation_id: c, message: "Геометрията има грешки – нищо не е записано." };
    const r = await svc("nd_tour_geom_save", Object.assign({ p_unit_id: i.unit_id, p_geometry: i.geometry, p_sha: v.sha256, p_source: i.source, p_source_ref: i.source_ref || null,
      p_validation: { ok: v.ok, errors: v.errors, blocked: v.blocked, warnings: v.warnings, stats: v.stats } }, actor(ctx)), c);
    return { ok: true, state: r.status === "verified" ? "verified" : v.blocked.length ? "blocked" : "draft", geometry_id: r.id, version: r.version, status: r.status, sha256: v.sha256, existed: r.existed,
      blocked: v.blocked, warnings: v.warnings, stats: v.stats, correlation_id: c, next: v.blocked.length ? "Попълнете липсите (точна сцена не се прави)" : r.status === "verified" ? "interior.prepare" : "interior.geometry_verify" };
  },

  "interior.geometry_verify": async (ctx, i) => {
    const c = corr(i.geometry_id); await requireAdmin(ctx, c);
    const r = await svc("nd_tour_geom_verify", Object.assign({ p_id: i.geometry_id, p_expected_sha: i.expected_sha256 }, actor(ctx)), c);
    return { ok: true, geometry_id: r.id, version: r.version, status: r.status, replayed: !!r.replayed, stale: r.stale || {}, correlation_id: c, next: "interior.prepare" };
  },

  "interior.style_save": async (ctx, i) => {
    const c = corr(i.unit_id || i.building_id || i.project_id);
    const v = T.validateStyle(i.brief);
    if (!v.ok) return { ok: false, state: "invalid", errors: v.errors, warnings: v.warnings, correlation_id: c };
    const r = await svc("nd_tour_style_save", Object.assign({ p_project_id: i.project_id, p_building_id: i.building_id || null, p_unit_id: i.unit_id || null, p_brief: v.normalized, p_sha: v.sha256 }, actor(ctx)), c);
    return { ok: true, style_id: r.id, version: r.version, sha256: r.sha256, existed: r.existed, style_system: v.normalized.style_system, style_name: v.normalized.style_name, warnings: v.warnings, correlation_id: c };
  },

  "interior.prepare": async (ctx, i) => {
    const c = corr(i.unit_id); await requireAdmin(ctx, c);
    const st = await state(ctx, i.unit_id, c);
    const base = { job_id: null, scene_version_id: null, warnings: [], requires_review: false, retryable: false, correlation_id: c };
    let g = i.geometry_id ? (st.geometry || []).find((x) => x.id === i.geometry_id) : verifiedOf(st);
    if (!g || g.status !== "verified") {
      const why = !g ? "Няма проверена геометрия на апартамента – точна сцена не се прави (не се досещаме по снимки)." : "Геометрията е " + g.status + " – нужна е проверена текуща версия.";
      return Object.assign(base, { ok: false, state: "blocked", error_code: "GEOMETRY_MISSING", blocked: [why].concat(((st.geometry || []).find((x) => x.status === "draft") || { validation: {} }).validation.blocked || []) });
    }
    if (!g.geometry) throw TErr("INTERNAL_ERROR", "Геометрията не се прочете", 500, c);
    let style = i.style_id ? (st.styles || []).find((x) => x.id === i.style_id) : pickStyle(st);
    if (i.style_id && !style) throw TErr("NOT_FOUND", "Стилът не е за този апартамент, сградата му или проекта", 404, c);
    if (i.expected_version != null) { const last = (st.scenes || [])[0]; const cur = last ? last.version : 0; if (cur !== i.expected_version) throw TErr("DB_CONFLICT", "Има по-нова сцена (версия " + cur + ") – презаредете", 409, c); }
    const built = T.buildScene(g.geometry, style ? style.brief : {}, { project_id: st.unit.project_id, unit_id: i.unit_id, geometry_id: g.id, geometry_version: g.version, style_id: style ? style.id : null, style_version: style ? style.version : null });
    if (!built.ok) return Object.assign(base, { ok: false, state: built.state, error_code: built.state === "blocked" ? "GEOMETRY_MISSING" : "INVALID_INPUT", blocked: built.blocked, errors: built.errors });
    const key = i.idempotency_key || ("scene:" + i.unit_id + ":" + g.sha256.slice(0, 12) + ":" + (style ? style.sha256.slice(0, 12) : "default") + ":" + T.GENERATOR.replace(/[^A-Za-z0-9.-]/g, "-"));
    const status = built.issues.length ? "draft" : "review";
    const r = await svc("nd_tour_scene_save", Object.assign({ p_unit_id: i.unit_id, p_geometry_id: g.id, p_style_id: style ? style.id : null, p_scene: built.scene, p_sha: built.sha256, p_status: status,
      p_issues: built.issues, p_warnings: built.warnings.slice(0, 50), p_idem: key }, actor(ctx)), c);
    return Object.assign(base, { ok: true, state: r.status === "review" ? "needs_review" : r.status, scene_version_id: r.id, version: r.version, sha256: r.sha256, replayed: !!r.replayed,
      issues: built.issues, warnings: built.warnings, stats: built.scene.stats, requires_review: r.status === "review", style_system: built.scene.materials.style_system,
      labels: built.scene.labels, next: r.status === "review" ? "interior.approve" : "interior.validate" });
  },

  "interior.get_scene": async (ctx, i) => {
    const c = corr(i.scene_version_id);
    const r = await userRpc(ctx, "nd_tour_scene_get", { p_id: i.scene_version_id }, c);
    return { scene_version_id: r.id, unit_id: r.unit_id, version: r.version, status: r.status, sha256: r.sha256, issues: r.issues, warnings: r.warnings, scene: r.scene, correlation_id: c };
  },

  "interior.validate": async (ctx, i) => {
    const c = corr(i.scene_version_id); await requireAdmin(ctx, c);
    const s = await userRpc(ctx, "nd_tour_scene_get", { p_id: i.scene_version_id }, c);
    const st = await state(ctx, s.unit_id, c);
    const g = (st.geometry || []).find((x) => x.id === s.geometry_id);
    if (!g || g.status !== "verified") throw TErr("DB_CONFLICT", "Геометрията на сцената вече не е актуална – подгответе нова сцена", 409, c);
    const v = T.validateScene(s.scene, g.geometry);
    const r = await svc("nd_tour_scene_status", Object.assign({ p_id: s.id, p_to: "review", p_issues: v.issues, p_note: null }, actor(ctx)), c);
    return { ok: v.ok, scene_version_id: s.id, status: r.status, state: r.status === "review" ? "needs_review" : "draft", issues: v.issues, warnings: v.warnings, correlation_id: c };
  },

  "interior.approve": async (ctx, i) => {
    const c = corr(i.scene_version_id); await requireAdmin(ctx, c);
    const r = await svc("nd_tour_scene_status", Object.assign({ p_id: i.scene_version_id, p_to: i.decision === "approve" ? "approved" : "rejected", p_issues: [], p_note: i.note || null }, actor(ctx)), c);
    return { ok: true, scene_version_id: r.id, status: r.status, replayed: !!r.replayed, correlation_id: c, next: r.status === "approved" ? "tour.render (final) или tour.publish" : "interior.prepare" };
  },

  "tour.render": async (ctx, i) => {
    const c = corr(i.unit_id); await requireAdmin(ctx, c);
    const st = await state(ctx, i.unit_id, c), g = verifiedOf(st);
    if (!g) return { ok: false, state: "blocked", error_code: "GEOMETRY_MISSING", job_id: null, blocked: ["Няма проверена геометрия – панорамите се връзват със стаи и врати от нея."], retryable: false, correlation_id: c };
    let sceneId = i.scene_version_id || null, sceneRow = null, scene = null;
    if (sceneId) sceneRow = (st.scenes || []).find((x) => x.id === sceneId);
    else if (i.source === "scene_render") sceneRow = (st.scenes || []).find((x) => x.geometry_id === g.id && (i.quality === "final" ? ["approved", "published"] : ["review", "approved", "published"]).includes(x.status));
    if (i.source === "scene_render" && !sceneRow) return { ok: false, state: "blocked", error_code: "INVALID_INPUT", job_id: null, blocked: [i.quality === "final" ? "Няма одобрена сцена за окончателен рендер (interior.approve)." : "Няма подготвена сцена (interior.prepare)."], retryable: false, correlation_id: c };
    if (sceneRow) { sceneId = sceneRow.id; scene = (await userRpc(ctx, "nd_tour_scene_get", { p_id: sceneId }, c)).scene; }
    const nav = navOf(g.geometry, scene);
    if (!nav) throw TErr("INVALID_INPUT", "Навигацията по геометрията не се построи", 400, c);
    const nm = names(g.geometry), allRooms = g.geometry.rooms.map((r) => r.id);
    const rooms = i.rooms || allRooms;
    const bad = rooms.filter((r) => !allRooms.includes(r)); if (bad.length) throw TErr("INVALID_INPUT", "Няма такива помещения в геометрията: " + bad.join(", "), 400, c);
    if (new Set(rooms).size !== rooms.length) throw TErr("INVALID_INPUT", "Повторени помещения", 400, c);
    const hs = T.hotspotsFor(nav, rooms, nm), byRoom = {}; nav.nodes.forEach((n) => { byRoom[n.room_id] = n; });
    const items = {}; rooms.forEach((r) => { const n = byRoom[r], room = g.geometry.rooms.find((x) => x.id === r); items[r] = { room_id: r, name: nm[r], type: room.type, status: "pending", node: n ? { x: n.x, y: n.y, eye_h: n.eye_h } : null, yaw_offset: 0, start_yaw: n ? n.start_yaw : 0, hotspots: hs[r].map((h) => ({ to_room: h.to_room, yaw: h.yaw, pitch: h.pitch, label: h.label, via: h.via })) }; });
    /* задача (с правата на служителя: tour_render е само за администратор в базата) → веднага „в работа“ (изпълнителят е CRM/качването) */
    const job = await userRpc(ctx, "nd_job_create", { p_kind: "tour_render", p_key: ("tour:" + i.unit_id + ":" + i.idempotency_key).slice(0, 200), p_project_id: st.unit.project_id, p_input: { unit_id: i.unit_id, source: i.source, quality: i.quality, scene_version_id: sceneId, rooms } }, c);
    const jc = corr(job.id);
    let claimed = null; try { claimed = await svc("nd_job_claim_id", { p_id: job.id, p_kinds: ["tour_render"], p_worker: WORKER(job.id) }, jc); } catch (e) { claimed = null; }
    const set = await svc("nd_tour_set_create", Object.assign({ p_unit_id: i.unit_id, p_geometry_id: g.id, p_scene_id: sceneId, p_source: i.source, p_quality: i.quality, p_rooms: rooms, p_items: items, p_job_id: job.id, p_idem: "set:" + i.unit_id + ":" + i.idempotency_key }, actor(ctx)), jc);
    for (const old of set.cancelled || []) await cleanup(old, true, jc);
    if (claimed && claimed.id) { try { await svc("nd_job_heartbeat", { p_id: job.id, p_worker: WORKER(job.id), p_progress: { phase: "awaiting_files", phase_bg: "чака файлове", rooms_done: 0, rooms_total: rooms.length, panorama_set_id: set.id, correlation_id: jc } }, jc); } catch (e) { /* пулсът не е критичен */ } }
    const out = { ok: true, job_id: job.id, state: set.status === "rendering" ? "running" : set.status, panorama_set_id: set.id, version: set.version, replayed: !!set.replayed, source: i.source, quality: i.quality, out_width: T.QUALITY[i.quality].out,
      rooms: rooms.map((r) => ({ room_id: r, name: nm[r], node: items[r].node })), scene_version_id: sceneId, requires_review: false, cancelled_previous: set.cancelled || [], correlation_id: jc,
      next: "tour.report за всяка стая" + (i.source === "scene_render" ? " (рендерът се прави в CRM → 360° → „Рендер от 3D сцената“)" : " (качване в CRM → 360° → „Качи реални панорами“)") };
    if (i.want_uploads) out.uploads = { prefix: prefixOf(st.unit.project_id, i.unit_id, set.id) + "/src", pattern: "<prefix>/<room_id>-r<rev>.<jpg|png>" };
    return out;
  },

  "tour.report": async (ctx, i) => {
    const c = corr(i.job_id); await requireAdmin(ctx, c);
    const paths = await svc("nd_tour_paths", { p_set_id: i.panorama_set_id }, c);
    const st = await state(ctx, paths.unit_id, c), set = (st.sets || []).find((x) => x.id === i.panorama_set_id);
    const src = prefixOf(paths.project_id, paths.unit_id, i.panorama_set_id) + "/src/";
    const reject = (code, msg, http) => { throw TErr(code, msg, http, c); };
    if (!set) reject("NOT_FOUND", "Наборът не е намерен", 404);
    if (set.job_id !== i.job_id) { await BACK.remove(i.upload_path); reject("STALE_CALLBACK", "Остарял отговор: наборът е към друга задача", 409); }
    if (!set.rooms.includes(i.room_id)) reject("INVALID_INPUT", "Помещението не е в набора", 400);
    const m = new RegExp("^" + src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + i.room_id + "-r" + i.rev + "\\.(jpg|jpeg|png)$").exec(i.upload_path);
    if (!m) reject("INVALID_INPUT", "Файлът трябва да е качен в " + src + i.room_id + "-r" + i.rev + ".jpg", 400);
    const total = set.rooms.length;
    /* пулс: отмяна или загубена задача → спира, чисти и отказва */
    let stop = true; try { stop = await svc("nd_job_heartbeat", { p_id: i.job_id, p_worker: WORKER(i.job_id), p_progress: { phase: "validating_file", phase_bg: "проверка на файл", room_id: i.room_id, rooms_total: total, panorama_set_id: set.id, correlation_id: c } }, c); } catch (e) { stop = true; }
    if (stop || set.status !== "rendering") {
      try { await svc("nd_job_finish", { p_id: i.job_id, p_worker: WORKER(i.job_id), p_status: "cancelled", p_result: { panorama_set_id: set.id }, p_error: null, p_cost_usd: 0 }, c); } catch (e) { /* вече не е при нас */ }
      if (set.status === "rendering") await svc("nd_tour_set_finish", { p_set_id: set.id, p_to: "cancelled", p_issues: [], p_reason: "Отменено от екипа" }, c);
      await BACK.remove(i.upload_path); await cleanup(set.id, true, c);
      return { ok: false, job_id: i.job_id, state: "cancelled", error_code: "CANCELLED", retryable: false, panorama_set_id: set.id, message: "Задачата е отменена или заменена – файлът е премахнат, нищо не е записано.", correlation_id: c };
    }
    const dl = await BACK.download(i.upload_path, 25 * 1048576);
    if (!dl.ok) return { ok: false, job_id: i.job_id, state: "running", error_code: dl.code, retryable: RETRYABLE.has(dl.code), panorama_set_id: set.id, message: dl.code === "FILE_MISSING" ? "Файлът още не се вижда в хранилището" : dl.code === "FILE_TOO_LARGE" ? "Файлът е над 25 MB" : "Хранилището не отговори", correlation_id: c };
    const prev = (set.items || {})[i.room_id] || {};
    const d = T.panoDerivative(dl.buf, set.quality, { thumb_yaw: (+prev.start_yaw || 0) - (+prev.yaw_offset || 0) });
    if (!d.ok) {
      /* постоянна грешка: записва се като отказан файл за стаята, без повтаряне и без да се харчи опит на задачата */
      try { await svc("nd_tour_set_put", { p_set_id: set.id, p_job_id: i.job_id, p_room_id: i.room_id, p_rev: i.rev, p_item: { status: "rejected", error_code: d.code, message: d.message, at: new Date().toISOString() } }, c); } catch (e) { await BACK.remove(i.upload_path); throw e; }
      await BACK.remove(i.upload_path);
      return { ok: false, job_id: i.job_id, state: "running", error_code: d.code, retryable: false, panorama_set_id: set.id, item: { room_id: i.room_id, status: "rejected", message: d.message }, message: d.message + " – качете поправен файл.", correlation_id: c };
    }
    const out = prefixOf(paths.project_id, paths.unit_id, set.id) + "/" + i.room_id + "-" + d.sha256.slice(0, 12) + ".jpg";
    const up = await BACK.upload(out, d.buf, "image/jpeg");
    if (up === "failed") return { ok: false, job_id: i.job_id, state: "running", error_code: "STORAGE_FAILED", retryable: true, panorama_set_id: set.id, message: "Производната не се записа – опитайте пак", correlation_id: c };
    const keepSrc = set.source !== "scene_render";
    const item = { room_id: i.room_id, name: prev.name, type: prev.type, node: prev.node, status: "ready", path: out, src_path: keepSrc ? i.upload_path : null, w: d.w, h: d.h, bytes: d.bytes, sha256: d.sha256, src_sha256: d.src_sha256,
      src_w: d.src.w, src_h: d.src.h, thumb: d.thumb, flat: d.flat, quality: set.quality, at: new Date().toISOString() };
    let put;
    try { put = await svc("nd_tour_set_put", { p_set_id: set.id, p_job_id: i.job_id, p_room_id: i.room_id, p_rev: i.rev, p_item: item }, c); }
    catch (e) { if (up === "ok") await BACK.remove(out); await BACK.remove(i.upload_path); if (e.code === "DB_CONFLICT") throw TErr("STALE_CALLBACK", "Остарял отговор: " + e.message.replace(/ \[.*$/, ""), 409, c); throw e; }
    if (!keepSrc) await BACK.remove(i.upload_path);   // временният рендер се маха – пази се само производната
    if (put.prev_path && put.prev_path !== out) await BACK.remove(put.prev_path);
    const warnings = d.flat ? ["Панорамата на " + i.room_id + " е почти едноцветна – проверете я"] : [];
    let st2 = "running", req = false, issues = [];
    if (put.all_ready) {
      const v = await validateSet(ctx, paths.unit_id, set.id, c, false);
      issues = v.issues; st2 = v.ok ? "needs_review" : "needs_input"; req = v.ok;
      warnings.push.apply(warnings, v.warnings);
    } else { try { await svc("nd_job_heartbeat", { p_id: i.job_id, p_worker: WORKER(i.job_id), p_progress: { phase: "awaiting_files", phase_bg: "чака файлове", rooms_done: put.ready, rooms_total: put.total, panorama_set_id: set.id, correlation_id: c } }, c); } catch (e) { /* */ } }
    return { ok: true, job_id: i.job_id, state: st2, progress: { rooms_done: put.ready, rooms_total: put.total }, panorama_set_id: set.id, artifact_ids: [d.sha256], item: { room_id: i.room_id, status: "ready", w: d.w, h: d.h, bytes: d.bytes },
      issues, warnings, requires_review: req, retryable: false, error_code: null, correlation_id: c };
  },

  "tour.edit": async (ctx, i) => {
    const c = corr(i.panorama_set_id); await requireAdmin(ctx, c);
    const items = {}; (i.items || []).forEach((x) => { const o = {}; ["yaw_offset", "start_yaw"].forEach((k) => { if (x[k] != null) o[k] = x[k]; }); if (x.hotspots) o.hotspots = x.hotspots.map((h) => ({ to_room: h.to_room, yaw: h.yaw, pitch: h.pitch })); items[x.room_id] = o; });
    const r = await svc("nd_tour_set_edit", { p_set_id: i.panorama_set_id, p_expected: i.expected_version, p_order: i.order || null, p_items: items }, c);
    return { ok: true, panorama_set_id: r.id, edit_version: r.edit_version, status: r.status, correlation_id: c, next: "tour.validate" };
  },

  "tour.validate": async (ctx, i) => {
    const c = corr(i.panorama_set_id); await requireAdmin(ctx, c);
    const paths = await svc("nd_tour_paths", { p_set_id: i.panorama_set_id }, c);
    const v = await validateSet(ctx, paths.unit_id, i.panorama_set_id, c, true);
    return Object.assign({ correlation_id: c }, v, { state: v.ok ? "needs_review" : "needs_input", next: v.ok ? "tour.publish" : "tour.edit / нов файл" });
  },

  "tour.publish": async (ctx, i) => {
    const c = corr(i.unit_id); await requireAdmin(ctx, c);
    const r = await svc("nd_tour_publish", Object.assign({ p_unit_id: i.unit_id, p_set_id: i.panorama_set_id || null, p_scene_id: i.scene_version_id || null, p_expected: i.expected_version, p_viewer: VIEWER }, actor(ctx)), c);
    return { ok: true, published: true, tour_version_id: r.tour_version_id, version: r.version, previous: r.previous, media: r.media, panorama_set_id: r.pano_set_id, scene_version_id: r.scene_version_id, correlation_id: c,
      message: "Публикувано. Публиката вижда разходката само докато апартаментът е Свободен и проектът е публикуван." };
  },

  "tour.unpublish": async (ctx, i) => {
    const c = corr(i.unit_id); await requireAdmin(ctx, c);
    const r = await svc("nd_tour_unpublish", { p_unit_id: i.unit_id, p_expected: i.expected_version, p_reason: i.reason, p_actor: ctx.userId }, c);
    return { ok: true, changed: r.changed, version: r.version, media_removed: r.media_removed || 0, correlation_id: c };
  },

  "tour.get": async (ctx, i) => {
    const c = corr(i.unit_id);
    return Object.assign(summaryOf(await state(ctx, i.unit_id, c), i.view === "full"), { correlation_id: c });
  },

  "tour.get_authorized_asset": async (ctx, i) => {
    const c = corr(i.panorama_set_id);
    const p = await userRpc(ctx, "nd_tour_paths", { p_set_id: i.panorama_set_id }, c);
    const it = (p.items || {})[i.room_id]; const path = it && (i.kind === "src" ? it.src_path : it.path);
    if (!path) throw TErr("NOT_FOUND", "Няма файл за това помещение", 404, c);
    const r = await ctx.sb.storage.from(BUCKET).createSignedUrl(path, 60);
    if (r.error || !r.data || !r.data.signedUrl) throw TErr("NOT_FOUND", "Файлът не е достъпен", 404, c);
    const u = r.data.signedUrl;
    return { url: /^https?:/.test(u) ? u : SB_URL + "/storage/v1" + (u.startsWith("/") ? "" : "/") + u, expires_in: 60, correlation_id: c };
  },

  /* съществуващият договор от _nc-contracts.js: една стъпка за Тед/CRM */
  "tours.request": async (ctx, i) => {
    const c = corr(i.unit_id); await requireAdmin(ctx, c);
    const st = await state(ctx, i.unit_id, c);
    if (i.style) {
      const k = String(i.style).trim(), sys = Object.keys(T.STYLE_SYSTEMS).find((x) => x === k || T.STYLE_SYSTEMS[x].name.toLowerCase() === k.toLowerCase()) || "custom";
      await RUN["interior.style_save"](ctx, { project_id: st.unit.project_id, unit_id: i.unit_id, brief: { style_system: sys, style_name: sys === "custom" ? k.slice(0, 80) : undefined } });
    }
    const prep = await RUN["interior.prepare"](ctx, { unit_id: i.unit_id });
    if (i.mode === "scene" || !prep.ok) return Object.assign({ mode: i.mode }, prep);
    const r = await RUN["tour.render"](ctx, { unit_id: i.unit_id, source: "scene_render", quality: "preview", scene_version_id: prep.scene_version_id, rooms: i.rooms && i.rooms.length ? i.rooms : undefined, idempotency_key: ("req-" + prep.sha256.slice(0, 16) + (i.rooms && i.rooms.length ? "-" + i.rooms.join("_") : "")).slice(0, 120) });
    return Object.assign({ mode: i.mode, scene_version_id: prep.scene_version_id, scene_state: prep.state }, r);
  }
};

/* проверка на набор: файловете (сума), преходите (само през врати), посоките (спрямо плана) */
async function validateSet(ctx, unitId, setId, c, deep) {
  const st = await state(ctx, unitId, c), set = (st.sets || []).find((x) => x.id === setId);
  if (!set) throw TErr("NOT_FOUND", "Наборът не е намерен", 404, c);
  if (!["rendering", "review"].includes(set.status)) throw TErr("DB_CONFLICT", "Наборът е " + set.status + " – не се проверява", 409, c);
  const g = (st.geometry || []).find((x) => x.id === set.geometry_id);
  if (!g || g.status !== "verified") throw TErr("DB_CONFLICT", "Геометрията на набора вече не е актуална", 409, c);
  let scene = null; if (set.scene_version_id) scene = (await userRpc(ctx, "nd_tour_scene_get", { p_id: set.scene_version_id }, c)).scene;
  const nav = navOf(g.geometry, scene), issues = [], warnings = [];
  const missing = set.rooms.filter((r) => !set.items[r] || set.items[r].status !== "ready");
  missing.forEach((r) => issues.push({ code: "FILE_MISSING", message: "няма проверен файл за " + r }));
  if (deep && !missing.length) {
    const paths = await svc("nd_tour_paths", { p_set_id: setId }, c);
    for (const r of set.rooms) {
      const p = paths.items[r] && paths.items[r].path, dl = p ? await BACK.download(p, 30 * 1048576) : { ok: false };
      if (!dl.ok) { issues.push({ code: "ARTIFACT_MISSING", message: r + ": производната липсва в хранилището" }); continue; }
      if (T.shaBuf(dl.buf) !== set.items[r].sha256) issues.push({ code: "ARTIFACT_CHANGED", message: r + ": файлът е различен от проверения" });
      const inf = T.imageInfo(dl.buf); if (!inf || inf.w !== 2 * inf.h) issues.push({ code: "NOT_EQUIRECT", message: r + ": не е 2:1" });
    }
  }
  const hv = T.validateHotspots(set.rooms.map((r) => ({ room_id: r, yaw_offset: (set.items[r] && set.items[r].yaw_offset) || 0, hotspots: (set.items[r] && set.items[r].hotspots) || [] })), nav, set.source);
  issues.push.apply(issues, hv.issues); warnings.push.apply(warnings, hv.warnings);
  if (!missing.length) {
    const r = await svc("nd_tour_set_finish", { p_set_id: setId, p_to: "review", p_issues: issues, p_reason: null }, c);
    if (!issues.length && set.job && set.job.status === "running") {
      try { await svc("nd_job_finish", { p_id: set.job_id, p_worker: WORKER(set.job_id), p_status: "review", p_result: { panorama_set_id: setId, scene_version_id: set.scene_version_id, artifact_ids: set.rooms.map((x) => set.items[x].sha256), warnings, correlation_id: c }, p_error: null, p_cost_usd: 0 }, c); } catch (e) { /* задачата вече не е при нас – наборът е проверен */ }
    }
    return { ok: !issues.length && r.validated, panorama_set_id: setId, status: r.status, issues, warnings, requires_review: !issues.length };
  }
  return { ok: false, panorama_set_id: setId, status: set.status, issues, warnings, requires_review: false };
}

/* ---------- регистрация: договорите влизат в общия каталог; tours.request вече е там ---------- */
Object.keys(TC.CONTRACTS).forEach((k) => { if (!C.CONTRACTS[k]) C.CONTRACTS[k] = TC.CONTRACTS[k]; });

module.exports = { RUN, _setBackend, _validateSet: validateSet, VIEWER, ERR_BG };
