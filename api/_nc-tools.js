// ИМОТИ НАДЕЖДА · Ново строителство (проект → сграда → етаж → обект) · инструменти за /api/tools (TASK-007).
// Не е отделна Vercel функция (името започва с „_“) – зарежда се от api/tools.js, както _ted-skills.js.
// CRM екраните и Тед викат ЕДИН и същи код тук; правата се пазят в базата (RLS + права по колони + RPC).
// Статус на обект се сменя само през RPC nd_unit_set_status. Оригинален план никога не се връща към агента или публиката.
"use strict";
const C = require("./_nc-contracts.js");
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "nd-files";
const BG = C.STATUS_BG;

class ToolError extends Error { constructor(m, status = 400) { super(m); this.status = status; } }

/* ---------- грешки от базата → ясен отговор ---------- */
function fail(error, fallback) {
  const code = String((error && error.code) || "");
  const http = C.SQLSTATE_HTTP[code] || (code === "PGRST116" ? 404 : 500);
  let msg = String((error && error.message) || fallback || "Грешка в базата");
  if (code === "23505") msg = /nd_units_project_id_code_key/.test(msg) ? "В проекта вече има обект с този код" : /building_id_level/.test(msg) ? "В сградата вече има етаж с това ниво" : /slug/.test(msg) ? "Този адрес (slug) вече е зает" : "Записът вече съществува";
  else if (code === "23514") msg = /data_clean/.test(msg) ? "В модула не се пази инвеститор, строител или изпълнител" : /override/.test(msg) ? "Ръчна цена изисква обща цена и причина" : /net_le_total/.test(msg) ? "Чистата площ не може да е по-голяма от общата" : /code_fmt/.test(msg) ? "Невалиден код на обект" : /plan_path/.test(msg) ? "Планът трябва да е в папката на същия проект" : "Невалидни данни";
  else if (code === "23503" || code === "23001") msg = /unit_events/.test(msg) ? "Обект с история на статусите не се трие – архивирайте проекта" : "Свързаният запис липсва или се използва";
  else if (code === "42501" && /permission denied|row-level security/i.test(msg)) msg = "Нямате право за това действие";
  else if (http === 500) msg = fallback || "Грешка в базата";
  const e = new ToolError(msg, http); e.code = code; if (error && error.details) e.detail = String(error.details).slice(0, 80);
  return e;
}
const must = (r, fb) => { if (r.error) throw fail(r.error, fb); return r.data; };
const num = (v) => (v === null || v === undefined ? null : Number(v));

/* ---------- изгледи без частни пътища (за UI списъци и за агента) ---------- */
const planOf = (data) => (data && data.plan && typeof data.plan.private === "string" ? data.plan.private : null);
function unitView(u) {
  const d = u.data || {};
  return { id: u.id, code: u.code, project_id: u.project_id, building_id: u.building_id, floor_id: u.floor_id,
    status: u.status, status_bg: BG[u.status], version: u.version, status_changed_at: u.status_changed_at || null,
    area_total: num(u.area_total), area_net: num(u.area_net), terrace_area: num(u.terrace_area),
    price_per_m2: num(u.price_per_m2), price_total: num(u.price_total), price_override: !!u.price_override,
    price_override_reason: u.price_override_reason || null, currency: u.currency,
    rooms: d.rooms ?? null, beds: d.beds ?? null, baths: d.baths ?? null, exposure: d.exposure || null, interior_style: d.interior_style || null,
    has_plan: !!planOf(d), plan_rev: u.plan_rev, updated_at: u.updated_at };
}
const floorView = (f) => ({ id: f.id, project_id: f.project_id, building_id: f.building_id, level: f.level, label: f.label || null,
  has_plan: !!planOf(f.data), plan_rev: f.plan_rev, polygons: (f.data && f.data.polygons) || [], plan_w: (f.data && f.data.plan_w) || null, plan_h: (f.data && f.data.plan_h) || null, updated_at: f.updated_at });
const buildingView = (b) => ({ id: b.id, project_id: b.project_id, name: b.name || null, sort: b.sort, style: (b.data && b.data.style) || null, updated_at: b.updated_at });
function projectView(p) {
  const d = Object.assign({}, p.data || {}); delete d.client_request_id;
  return { id: p.id, slug: p.slug, name: p.name, status: p.status, version: p.version, content_rev: p.content_rev, reviewed_rev: p.reviewed_rev,
    reviewed: p.reviewed_rev != null && p.reviewed_rev === p.content_rev, reviewed_at: p.reviewed_at || null, status_changed_at: p.status_changed_at || null,
    data: d, created_at: p.created_at, updated_at: p.updated_at };
}
const counts = (units) => { const c = { units: units.length, free: 0, reserved: 0, sold: 0 }; units.forEach((u) => { if (c[u.status] !== undefined) c[u.status]++; }); return c; };

async function one(ctx, table, id, what) {
  const r = await ctx.sb.from(table).select("*").eq("id", id).maybeSingle();
  if (r.error) throw fail(r.error);
  if (!r.data) throw new ToolError(what + " не е намерен", 404);
  return r.data;
}

/* ---------- изпълнение ---------- */
const RUN = {
  "nc.help": async (ctx, i) => {
    const list = Object.keys(RUN).filter((k) => !i.tool || k === i.tool).map((k) => ({ name: k, role: C.CONTRACTS[k].role, description: C.CONTRACTS[k].description, input: describeFields(C.CONTRACTS[k].input.fields), output: C.CONTRACTS[k].output }));
    if (i.tool && !list.length) throw new ToolError("Няма такъв инструмент в модула", 404);
    return { module: "Ново строителство", statuses: BG, rules: ["Статус се сменя само с units.set_status и изрично потвърждение (confirm:true).", "Оригинални планове не се изпращат и не се дават като линк.", "В модула няма инвеститор, строител, строителна фирма и изпълнител.", "Цената на обект = площ × цена на кв.м и се смята от системата.", "Импорт на проектен пакет: projects.create_draft (ако проектът е нов) → imports.start → jobs.status (повтаряй, докато state не е needs_review/needs_input) → jobs.result (view=summary) → imports.apply само след изрично „Да“ от човек. Импортът не внася статуси и не публикува."], tools: list };
  },

  "projects.list": async (ctx, i) => {
    let q = ctx.sb.from("nd_projects").select("*").order("updated_at", { ascending: false }).limit(300);
    if (i.status) q = q.eq("status", i.status);
    let rows = must(await q);
    if (i.text) { const t = i.text.toLocaleLowerCase("bg"); rows = rows.filter((p) => [p.name, p.slug, p.data && p.data.title, p.data && p.data.city, p.data && p.data.hood].some((v) => String(v || "").toLocaleLowerCase("bg").includes(t))); }
    if (!rows.length) return [];
    const ids = rows.map((p) => p.id);
    const [units, blds, flrs] = await Promise.all([
      ctx.sb.from("nd_units").select("project_id,status").in("project_id", ids).limit(20000),
      ctx.sb.from("nd_buildings").select("project_id").in("project_id", ids).limit(5000),
      ctx.sb.from("nd_floors").select("project_id").in("project_id", ids).limit(10000)]);
    const U = must(units), B = must(blds), F = must(flrs);
    return rows.map((p) => ({ id: p.id, slug: p.slug, name: p.name, title: (p.data && p.data.title) || p.name, status: p.status, version: p.version,
      city: (p.data && p.data.city) || null, hood: (p.data && p.data.hood) || null, reviewed: p.reviewed_rev != null && p.reviewed_rev === p.content_rev, updated_at: p.updated_at,
      counts: Object.assign({ buildings: B.filter((x) => x.project_id === p.id).length, floors: F.filter((x) => x.project_id === p.id).length }, counts(U.filter((x) => x.project_id === p.id))) }));
  },

  "projects.get": async (ctx, i) => {
    const p = await one(ctx, "nd_projects", i.id, "Проектът");
    const [b, f, u, m] = await Promise.all([
      ctx.sb.from("nd_buildings").select("*").eq("project_id", p.id).order("sort").order("name"),
      ctx.sb.from("nd_floors").select("*").eq("project_id", p.id).order("level", { ascending: false }),
      ctx.sb.from("nd_units").select("*").eq("project_id", p.id).order("code").limit(5000),
      ctx.sb.from("nd_project_media").select("id,kind,path,title,sort,building_id,unit_id").eq("project_id", p.id).order("sort")]);
    const units = must(u);
    // панорамите са частни (private/tours) – към агента не се връща пътят, само броят
    const media = must(m).map((x) => (x.kind === "tour" ? { id: x.id, kind: x.kind, unit_id: x.unit_id, title: x.title, sort: x.sort } : x));
    return { project: projectView(p), counts: counts(units), buildings: must(b).map(buildingView), floors: must(f).map(floorView), units: units.map(unitView), media };
  },

  "projects.create_draft": async (ctx, i) => {
    const { client_request_id, ...fields } = i;
    if (client_request_id) {
      const ex = must(await ctx.sb.from("nd_projects").select("id,status,version").eq("data->>client_request_id", client_request_id).limit(1));
      if (ex.length) return { id: ex[0].id, status: ex[0].status, version: ex[0].version, existed: true };
    }
    const data = Object.assign({}, fields, client_request_id ? { client_request_id } : {});
    if (!data.price_policy) data.price_policy = { basis: "total" };
    const p = must(await ctx.sb.from("nd_projects").insert({ name: fields.title, data }).select("id,status,version").single());
    return { id: p.id, status: p.status, version: p.version, existed: false };
  },

  "projects.update": async (ctx, i) => {
    const cur = await one(ctx, "nd_projects", i.id, "Проектът");
    if (cur.version !== i.expected_version) throw new ToolError("Проектът е променен от друг – презаредете", 409);
    const data = Object.assign({}, cur.data, i.fields);
    const rows = must(await ctx.sb.from("nd_projects").update({ name: i.fields.title || cur.name, data }).eq("id", i.id).eq("version", i.expected_version).select("id,version,content_rev"));
    if (!rows.length) throw new ToolError("Проектът е променен от друг – презаредете", 409);
    return rows[0];
  },

  "projects.mark_reviewed": async (ctx, i) => must(await ctx.sb.rpc("nd_project_mark_reviewed", { p_id: i.id, p_expected_content_rev: i.expected_content_rev })),
  "projects.publish": async (ctx, i) => must(await ctx.sb.rpc("nd_project_set_status", { p_id: i.id, p_to: "published", p_expected_version: i.expected_version, p_slug: i.slug || null })),
  "projects.archive": async (ctx, i) => must(await ctx.sb.rpc("nd_project_set_status", { p_id: i.id, p_to: "archived", p_expected_version: i.expected_version, p_slug: null })),

  "projects.set_media": async (ctx, i) => {
    await one(ctx, "nd_projects", i.project_id, "Проектът");
    let del = ctx.sb.from("nd_project_media").delete().eq("project_id", i.project_id).eq("kind", i.kind);
    if (i.kind === "model") del = del.eq("building_id", i.building_id);
    if (i.kind === "tour") del = del.eq("unit_id", i.unit_id);
    const keep = i.items.map((x) => x.path);
    if (keep.length) del = del.not("path", "in", "(" + keep.map((p) => '"' + p.replace(/"/g, "") + '"').join(",") + ")");
    must(await del.select("id"));
    if (keep.length) {
      const rows = i.items.map((x, n) => ({ project_id: i.project_id, kind: i.kind, path: x.path, title: x.title || null, sort: x.sort ?? n, building_id: i.kind === "model" ? i.building_id : null, unit_id: i.kind === "tour" ? i.unit_id : null }));
      const existing = must(await ctx.sb.from("nd_project_media").select("id,path").in("path", keep));
      const fresh = rows.filter((r) => !existing.some((e) => e.path === r.path));
      if (fresh.length) must(await ctx.sb.from("nd_project_media").insert(fresh).select("id"));
      for (const e of existing) { const r = rows.find((x) => x.path === e.path); must(await ctx.sb.from("nd_project_media").update({ title: r.title, sort: r.sort }).eq("id", e.id).select("id")); }
    }
    const n = must(await ctx.sb.from("nd_project_media").select("id").eq("project_id", i.project_id).eq("kind", i.kind)).length;
    if (keep.length && !n) throw new ToolError("Само администратор задава публичната медия", 403);
    return { project_id: i.project_id, kind: i.kind, count: n };
  },

  "buildings.upsert": async (ctx, i) => {
    if (!i.id) {
      const b = must(await ctx.sb.from("nd_buildings").insert({ project_id: i.project_id, name: i.name, sort: i.sort ?? 0, data: i.style ? { style: i.style } : {} }).select("*").single());
      return buildingView(b);
    }
    const cur = await one(ctx, "nd_buildings", i.id, "Сградата");
    if (cur.project_id !== i.project_id) throw new ToolError("Сграда не се мести в друг проект", 403);
    if (i.expected_updated_at && new Date(i.expected_updated_at).getTime() !== new Date(cur.updated_at).getTime()) throw new ToolError("Сградата е променена от друг – презаредете", 409);
    const data = Object.assign({}, cur.data, i.style !== undefined ? { style: i.style } : {});
    const rows = must(await ctx.sb.from("nd_buildings").update({ name: i.name, sort: i.sort ?? cur.sort, data }).eq("id", i.id).eq("updated_at", cur.updated_at).select("*"));
    if (!rows.length) throw new ToolError("Сградата е променена от друг – презаредете", 409);
    return buildingView(rows[0]);
  },

  "floors.upsert": async (ctx, i) => {
    const b = await one(ctx, "nd_buildings", i.building_id, "Сградата");
    if (!C.pathInProject(i.plan_path, b.project_id)) throw new ToolError("Планът трябва да е в папката на същия проект", 400);
    const patch = (base) => {
      const d = Object.assign({}, base);
      if (i.plan_path) d.plan = Object.assign({}, d.plan, { private: i.plan_path });
      if (i.plan_w) d.plan_w = i.plan_w; if (i.plan_h) d.plan_h = i.plan_h;
      if (i.polygons) d.polygons = i.polygons.map((p) => ({ unit_code: p.unit_code, points: p.points }));
      return d;
    };
    let row;
    if (!i.id) row = must(await ctx.sb.from("nd_floors").insert({ project_id: b.project_id, building_id: b.id, level: i.level, label: i.label || null, data: patch({}) }).select("*").single());
    else {
      const cur = await one(ctx, "nd_floors", i.id, "Етажът");
      if (cur.building_id !== b.id) throw new ToolError("Етаж не се мести в друга сграда", 403);
      if (i.expected_updated_at && new Date(i.expected_updated_at).getTime() !== new Date(cur.updated_at).getTime()) throw new ToolError("Етажът е променен от друг – презаредете", 409);
      const rows = must(await ctx.sb.from("nd_floors").update({ level: i.level, label: i.label ?? cur.label, data: patch(cur.data) }).eq("id", i.id).eq("updated_at", cur.updated_at).select("*"));
      if (!rows.length) throw new ToolError("Етажът е променен от друг – презаредете", 409);
      row = rows[0];
    }
    await kick(ctx);
    return floorView(row);
  },

  "units.list": async (ctx, i) => {
    let q = ctx.sb.from("nd_units").select("*").eq("project_id", i.project_id).order("code").limit(5000);
    if (i.building_id) q = q.eq("building_id", i.building_id);
    if (i.floor_id) q = q.eq("floor_id", i.floor_id);
    if (i.status) q = q.eq("status", i.status);
    return must(await q).map(unitView);
  },

  "units.get": async (ctx, i) => {
    const u = await one(ctx, "nd_units", i.id, "Обектът");
    const [ev, ch] = await Promise.all([
      ctx.sb.from("nd_unit_events").select("event_id,from_status,to_status,by_email,note,client_id,deal_id,at").eq("unit_id", u.id).order("at", { ascending: false }).limit(100),
      ctx.sb.from("nd_unit_changes").select("field,old_value,new_value,by_email,at").eq("unit_id", u.id).order("at", { ascending: false }).limit(200)]);
    // пътят към оригиналния план не се връща (и в историята) – само че планът е сменен
    const changes = must(ch).map((c) => (c.field === "plan" ? { field: "plan", old_value: c.old_value ? "(план)" : null, new_value: c.new_value ? "(нов план)" : null, by_email: c.by_email, at: c.at } : c));
    return { unit: unitView(u), events: must(ev), changes };
  },

  "units.upsert": async (ctx, i) => {
    const cols = (base) => {
      const o = {};
      ["code", "area_total", "area_net", "terrace_area", "price_per_m2"].forEach((k) => { if (i[k] !== undefined) o[k] = i[k]; });
      if (i.price_override !== undefined) {
        o.price_override = !!i.price_override;
        if (i.price_override) { o.price_total = i.price_total; o.price_override_reason = i.price_override_reason; } else o.price_override_reason = null;
      }
      const d = Object.assign({}, base);
      ["rooms", "beds", "baths", "exposure", "interior_style"].forEach((k) => { if (i[k] !== undefined) d[k] = i[k]; });
      if (i.plan_path) d.plan = Object.assign({}, d.plan, { private: i.plan_path });
      o.data = d;
      return o;
    };
    let row;
    if (!i.id) row = must(await ctx.sb.from("nd_units").insert(Object.assign({ project_id: i.project_id, building_id: i.building_id, floor_id: i.floor_id }, cols({}))).select("*").single());
    else {
      const cur = await one(ctx, "nd_units", i.id, "Обектът");
      if (cur.project_id !== i.project_id || cur.building_id !== i.building_id || cur.floor_id !== i.floor_id) throw new ToolError("Обект не се мести в друг етаж, сграда или проект", 403);
      if (cur.version !== i.expected_version) throw new ToolError("Обектът е променен от друг – презаредете", 409);
      const rows = must(await ctx.sb.from("nd_units").update(cols(cur.data)).eq("id", i.id).eq("version", i.expected_version).select("*"));
      if (!rows.length) throw new ToolError("Обектът е променен от друг – презаредете", 409);
      row = rows[0];
    }
    await kick(ctx);
    return unitView(row);
  },

  "units.set_status": async (ctx, i) => {
    const r = must(await ctx.sb.rpc("nd_unit_set_status", { p_unit_id: i.unit_id, p_to: i.to, p_expected_version: i.expected_version, p_event_id: i.event_id || null, p_note: i.note || null, p_client_id: i.client_id || null, p_deal_id: i.deal_id || null }));
    await kick(ctx);
    return { unit: { id: r.unit_id, code: r.code, status: r.status, status_bg: BG[r.status], version: r.version, floor_id: r.floor_id }, event_id: r.event_id, replayed: !!r.replayed };
  }
};

function describeFields(fields) {
  return Object.entries(fields).map(([k, s]) => k + (s.required ? "*" : "") + (s.enum ? "(" + s.enum.join("|") + ")" : s.type === "literalTrue" ? "(true)" : s.type === "array" ? "[]" : "")).join(", ");
}

/* ---------- производни на плановете (лека задача, без нова функция и без нов cron) ----------
   Свободен обект → копие с воден знак. Капариран/Продаден → НЯМА файл (публиката вижда само печата).
   Етаж → копие с воден знак, в което обектите, които не са свободни, са плътно закрити; ако такъв обект няма
   очертание върху плана, производна не се прави (по-добре без план, отколкото с изтекъл).
   PDF/DWG не се обработват тук – без растер няма публичен план. Оригиналът никога не се връща. */
async function svc(path, opts) {
  if (!SR()) return null;
  const r = await fetch(SB_URL + path, Object.assign({}, opts, { headers: Object.assign({ apikey: SR(), Authorization: "Bearer " + SR(), "Content-Type": "application/json" }, (opts && opts.headers) || {}) })).catch(() => null);
  if (!r || !r.ok) return null;
  const t = await r.text().catch(() => "");
  try { return t ? JSON.parse(t) : true; } catch (e) { return true; }
}
const rpc = (fn, args) => svc("/rest/v1/rpc/" + fn, { method: "POST", body: JSON.stringify(args || {}) });

/* storage със сървърния ключ: служител няма право да пише в private/derived/ (политика в базата) */
const encPath = (p) => String(p).split("/").map(encodeURIComponent).join("/");
async function svcDownload(p, maxBytes) {
  if (!SR()) return null;
  const H = { apikey: SR(), Authorization: "Bearer " + SR() };
  let r = await fetch(SB_URL + "/storage/v1/object/" + BUCKET + "/" + encPath(p), { headers: H }).catch(() => null);
  if (!r || !r.ok) {
    const s = await svc("/storage/v1/object/sign/" + BUCKET + "/" + encPath(p), { method: "POST", body: JSON.stringify({ expiresIn: 60 }) });
    const signed = s && (s.signedURL || s.signedUrl);
    if (!signed) return null;
    r = await fetch(/^https?:/.test(signed) ? signed : SB_URL + "/storage/v1" + (signed.startsWith("/") ? "" : "/") + signed).catch(() => null);
    if (!r || !r.ok) return null;
  }
  const b = Buffer.from(await r.arrayBuffer());
  return b.length && b.length <= maxBytes ? b : null;
}
async function svcUpload(p, buf, mime) {
  if (!SR()) return false;
  const r = await fetch(SB_URL + "/storage/v1/object/" + BUCKET + "/" + encPath(p), { method: "POST", headers: { apikey: SR(), Authorization: "Bearer " + SR(), "Content-Type": mime, "x-upsert": "false", "Cache-Control": "no-store" }, body: buf }).catch(() => null);
  return !!(r && r.ok);
}
const svcRemove = (p) => svc("/storage/v1/object/" + BUCKET + "/" + encPath(p), { method: "DELETE" });
/* записва реда за производната; ако статусът/планът се е сменил междувременно, базата отказва (40001) и файлът се маха */
async function savePlanFile(row) {
  const ok = await svc("/rest/v1/nd_plan_files", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
  if (!ok) await svcRemove(row.path);
  return !!ok;
}

function fillPolygon(im, pts, rgb) {
  const P = pts.map((p) => [p[0] * im.w, p[1] * im.h]);
  const y0 = Math.max(0, Math.floor(Math.min(...P.map((p) => p[1])))), y1 = Math.min(im.h - 1, Math.ceil(Math.max(...P.map((p) => p[1]))));
  for (let y = y0; y <= y1; y++) {
    const xs = [], yc = y + 0.5;
    for (let a = 0, b = P.length - 1; a < P.length; b = a++) {
      const [xa, ya] = P[a], [xb, yb] = P[b];
      if ((ya > yc) !== (yb > yc)) xs.push(xa + ((yc - ya) / (yb - ya)) * (xb - xa));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.floor(xs[k]) - 1), xb = Math.min(im.w - 1, Math.ceil(xs[k + 1]) + 1);
      for (let x = xa; x <= xb; x++) { const o = (y * im.w + x) * 4; im.d[o] = rgb[0]; im.d[o + 1] = rgb[1]; im.d[o + 2] = rgb[2]; im.d[o + 3] = 255; }
    }
  }
}
function decodeRaster(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) { const { PNG } = require("./_vendor/pngjs/lib/png.js"); const p = PNG.sync.read(buf); return { w: p.width, h: p.height, d: p.data }; }
  if (buf[0] === 0xff && buf[1] === 0xd8) { const j = require("./_vendor/jpeg-js").decode(buf, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 60, maxMemoryUsageInMB: 512 }); return { w: j.width, h: j.height, d: j.data }; }
  return null;
}
/* чиста функция (без мрежа) – изпитва се отделно */
function makeDerivative(buf, mask) {
  let im = null;
  try { im = decodeRaster(buf); } catch (e) { return { ok: false, reason: "Файлът на плана е повреден" }; }
  if (!im) return { ok: false, reason: "Планът не е JPG/PNG – нужна е растерна версия" };
  if (im.w < 50 || im.h < 50) return { ok: false, reason: "Планът е твърде малък" };
  let src = buf;
  if (mask && mask.length) {
    mask.forEach((pts) => fillPolygon(im, pts, [92, 10, 30]));
    for (let k = 3; k < im.d.length; k += 4) im.d[k] = 255;
    src = Buffer.from(require("./_vendor/jpeg-js").encode({ data: im.d, width: im.w, height: im.h }, 92).data);
  }
  let out = null;
  try { out = require("./_wm.js").stamp(src, mask && mask.length ? "image/jpeg" : (buf[0] === 0x89 ? "image/png" : "image/jpeg")); } catch (e) { out = null; }
  if (!out || out.stamped !== true || out.mime !== "image/jpeg") return { ok: false, reason: "Водният знак не можа да се постави" };
  return { ok: true, buf: out.buf, mime: "image/jpeg" };
}

async function runPlanJob(ctx, job) {
  const inp = job.input || {}, tag = String(job.id).slice(0, 8) + "-" + Date.now().toString(36);
  if (inp.scope === "unit") {
    const rows = await svc("/rest/v1/nd_units?id=eq." + encodeURIComponent(inp.unit_id) + "&select=id,project_id,status,plan_rev,data");
    const u = Array.isArray(rows) ? rows[0] : null;
    if (!u) return { status: "done", result: { skipped: "няма такъв обект" } };
    const sig = u.plan_rev + ":" + u.status;
    if (sig !== inp.sig) return { status: "done", result: { skipped: "остаряла заявка" } };
    if (u.status !== "free") return { status: "done", result: { locked: true } };   // капариран/продаден: без файл
    const src = planOf(u.data); if (!src) return { status: "done", result: { skipped: "няма план" } };
    const buf = await svcDownload(src, 15 * 1048576); if (!buf) return { status: "failed", error: "Оригиналът не се чете (или е над 15 MB)" };
    const d = makeDerivative(buf, null); if (!d.ok) return { status: "done", result: { locked: true, reason: d.reason } };
    const path = "projects/" + u.project_id + "/private/derived/u-" + u.id + "-wm-" + u.plan_rev + "-" + tag + ".jpg";
    if (!(await svcUpload(path, d.buf, d.mime))) return { status: "failed", error: "Качването на производната не успя" };
    if (!(await savePlanFile({ project_id: u.project_id, unit_id: u.id, kind: "unit_wm", sig, path, mime: d.mime, stamped: true, job_id: job.id }))) return { status: "done", result: { skipped: "статусът или планът се смениха междувременно" } };
    return { status: "done", result: { kind: "unit_wm", sig } };
  }
  if (inp.scope === "floor") {
    // една заявка връща подписа, плана, очертанията и статусите – няма разминаване между четенето им
    const f = await rpc("nd_floor_plan_input", { p_floor_id: inp.floor_id });
    if (!f || typeof f !== "object" || !f.sig) return { status: "done", result: { skipped: "няма такъв етаж" } };
    if (f.sig !== inp.sig) return { status: "done", result: { skipped: "остаряла заявка" } };
    if (!f.plan) return { status: "done", result: { skipped: "няма план" } };
    const polys = Array.isArray(f.polygons) ? f.polygons : [], mask = [];
    for (const u of (f.units || []).filter((x) => x.status !== "free")) {
      const p = polys.filter((x) => x.unit_code === u.code);
      if (!p.length) return { status: "done", result: { locked: true, reason: "обект " + u.code + " няма очертание върху етажния план" } };
      p.forEach((x) => mask.push(x.points));
    }
    const buf = await svcDownload(f.plan, 15 * 1048576); if (!buf) return { status: "failed", error: "Оригиналът не се чете (или е над 15 MB)" };
    const d = makeDerivative(buf, mask); if (!d.ok) return { status: "done", result: { locked: true, reason: d.reason } };
    const pid = String(f.plan).split("/")[1];
    const path = "projects/" + pid + "/private/derived/f-" + inp.floor_id + "-" + tag + ".jpg";
    if (!(await svcUpload(path, d.buf, d.mime))) return { status: "failed", error: "Качването на производната не успя" };
    if (!(await savePlanFile({ project_id: pid, floor_id: inp.floor_id, kind: "floor", sig: f.sig, path, mime: d.mime, stamped: true, job_id: job.id }))) return { status: "done", result: { skipped: "статусите се смениха междувременно" } };
    return { status: "done", result: { kind: "floor", sig: f.sig, masked: mask.length } };
  }
  return { status: "done", result: { skipped: "непознат обхват" } };
}

/* до 4 чакащи заявки за производни, най-много ~12 s; грешка тук никога не чупи действието на служителя */
async function kick(ctx) {
  if (!SR()) return 0;
  const worker = "tools:" + String(ctx.userId || "").slice(0, 8) + ":" + Date.now().toString(36), t0 = Date.now();
  let n = 0;
  try {
    while (n < 4 && Date.now() - t0 < 12000) {
      const job = await rpc("nd_job_claim", { p_kinds: ["plan_derivative"], p_worker: worker });
      if (!job || !job.id) break;
      let out; try { out = await runPlanJob(ctx, job); } catch (e) { out = { status: "failed", error: String((e && e.message) || e).slice(0, 300) }; }
      await rpc("nd_job_finish", { p_id: job.id, p_worker: worker, p_status: out.status, p_result: out.result || null, p_error: out.error || null, p_cost_usd: 0 });
      n++;
    }
  } catch (e) { /* остава в опашката; следващото действие ще го вземе */ }
  return n;
}

/* ---------- публично отваряне на план / панорама: /plan/unit/<id>, /plan/floor/<id>, /pano/<unit>/<n> ----------
   Статусът се проверява в базата при ВСЯКО отваряне; файлът се дава с подписан линк за 60 секунди. */
async function publicFile(req, res) {
  const deny = (code) => { res.statusCode = code; res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.setHeader("X-Robots-Tag", "noindex"); res.end(code === 404 ? "Няма достъпен план" : "Невалидна заявка"); };
  let u; try { u = new URL(req.url, "https://imotinadezhda.bg"); } catch (e) { return deny(400); }
  const plan = String(u.searchParams.get("plan") || ""), pano = String(u.searchParams.get("pano") || "");
  if (u.searchParams.has("model")) { if (CAD) return CAD.publicModel(req, res); return deny(404); }   // TASK-009: /model/<сграда>
  let r = null;
  if (plan) { const m = /^(unit|floor)[:/]([a-z0-9]{8,64})$/.exec(plan); if (!m) return deny(400); r = await rpc("nd_plan_resolve", { p_scope: m[1], p_id: m[2] }); }
  else if (pano) { const m = /^([a-z0-9]{8,64})[:/]([0-9]{1,2})$/.exec(pano); if (!m) return deny(400); r = await rpc("nd_pano_resolve", { p_unit_id: m[1], p_n: parseInt(m[2], 10) }); }
  else return deny(400);
  if (!r || typeof r !== "object" || !r.path) return deny(404);
  const enc = String(r.path).split("/").map(encodeURIComponent).join("/");
  const s = await svc("/storage/v1/object/sign/" + BUCKET + "/" + enc, { method: "POST", body: JSON.stringify({ expiresIn: 60 }) });
  const signed = s && (s.signedURL || s.signedUrl);
  if (!signed) return deny(404);
  const abs = /^https?:/.test(signed) ? signed : SB_URL + "/storage/v1" + (signed.startsWith("/") ? "" : "/") + signed;
  res.statusCode = 302; res.setHeader("Location", abs); res.setHeader("Cache-Control", "no-store, max-age=0"); res.setHeader("X-Robots-Tag", "noindex"); res.setHeader("Referrer-Policy", "no-referrer"); res.end();
}

/* ---------- TASK-006 · импорт на проектен пакет (същият регистър, същият токен; един импорт за CRM и Тед) ---------- */
let IMP = null;
try { IMP = require("./_nc-import.js"); Object.keys(IMP.RUN).forEach((k) => { if (C.CONTRACTS[k] && !RUN[k]) RUN[k] = IMP.RUN[k]; }); } catch (e) { console.error("nc import not loaded", e && e.message); }

/* ---------- TASK-009 · CAD/BIM проверка и 3D модели (същият регистър; тежката работа върви извън сайта – виж _nc-cad.js) ---------- */
let CAD = null;
try { CAD = require("./_nc-cad.js"); Object.keys(CAD.RUN).forEach((k) => { if (C.CONTRACTS[k] && !RUN[k]) RUN[k] = CAD.RUN[k]; }); CAD.wrapJobs(RUN); } catch (e) { console.error("nc cad not loaded", e && e.message); }

/* ---------- регистър (същата форма като в _ted-skills.js) ---------- */
const tools = {};
Object.keys(RUN).forEach((name) => {
  const c = C.CONTRACTS[name];
  tools[name] = { description: c.description + " Вход: {" + describeFields(c.input.fields) + "}. Роля: " + c.role + ".", input: c.input, run: RUN[name] };
});
const names = Object.keys(tools);
const SPEC = names.map((n) => "- " + n + ": " + tools[n].description).join("\n");

module.exports = { tools, names, SPEC, publicFile, ToolError, makeDerivative, fillPolygon, kick, runPlanJob, _fail: fail, importTick: (ms) => (IMP ? IMP.tick(ms) : Promise.resolve(0)),
  workerCallback: (req, res) => { if (CAD) return CAD.workerCallback(req, res); res.statusCode = 404; res.setHeader("Cache-Control", "no-store"); res.end(""); }, cadTick: () => (CAD ? CAD.tick() : Promise.resolve(0)) };
