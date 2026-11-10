// ИМОТИ НАДЕЖДА · TASK-009 · помощник САМО за тестовете (не се зарежда от сайта; името започва с „_“ → не е Vercel функция).
// Истинска база в процеса (PGlite) с истинските миграции nc_001…nc_005 + имитация на Supabase отпред:
//   - ctx.sb (JWT на служителя): from().select().eq().like().order().limit().maybeSingle() и rpc() → SQL с роля authenticated (RLS важи);
//   - service role REST/RPC и storage (обект, обхват, подписване за теглене и качване) → прихваща се global.fetch;
//   - GitHub „workflow_dispatch“ → записва се (и по желание пуска истинския изпълнител).
// Без мрежа навън. Ключовете са очевидно тестови.
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto"), http = require("http");

const SB = "https://hyvwfsmjbaynozceookv.supabase.co";
const ADMIN = "00000000-0000-4000-8000-000000000001", BROKER = "00000000-0000-4000-8000-000000000002", VISITOR = "00000000-0000-4000-8000-000000000009";
const SECRET = "TEST-NC-WORKER-SECRET-NOT-A-REAL-ONE-0123456789";
const SQL = (f) => fs.readFileSync(path.join(__dirname, "..", "db", "nc", f), "utf8");

function findPglite() {
  for (const p of [process.env.PGLITE, "@electric-sql/pglite", "/tmp/pg17/node_modules/@electric-sql/pglite", "/home/claude/audit/pgtest/node_modules/@electric-sql/pglite"]) {
    if (!p) continue;
    try { return require(p); } catch (e) { /* следващият */ }
  }
  return null;
}

async function create(opts) {
  opts = opts || {};
  const lib = findPglite();
  if (!lib) return null;
  const db = new lib.PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    grant all on storage.objects to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create table public.nd_staff (user_id uuid primary key, role text not null default 'broker', created_at timestamptz not null default now());
    alter table public.nd_staff enable row level security;
    create function public.nd_is_staff() returns boolean language sql stable security definer set search_path to 'public' as $$ select exists (select 1 from public.nd_staff where user_id = auth.uid()) $$;
    create function public.nd_is_admin() returns boolean language sql stable security definer set search_path to 'public' as $$ select exists (select 1 from public.nd_staff where user_id = auth.uid() and role = 'admin') $$;
    revoke execute on function public.nd_is_staff(), public.nd_is_admin() from anon;
    create function public.nd_touch() returns trigger language plpgsql set search_path to 'public' as $$ begin new.updated_at = now(); return new; end $$;
    insert into public.nd_staff(user_id, role) values ('${ADMIN}','admin'), ('${BROKER}','broker');
  `);
  for (const f of ["nc_001_new_construction.sql", "nc_002_jobs_rpc.sql", "nc_003_hardening.sql", "nc_004_import.sql"].concat(opts.without005 ? [] : ["nc_005_cad_models.sql"])) await db.exec(SQL(f));

  /* една връзка → заявките се редят една след друга */
  let chain = Promise.resolve();
  const lock = (fn) => { const p = chain.then(fn, fn); chain = p.then(() => null, () => null); return p; };
  const as = (role, uid, fn) => lock(async () => {
    await db.exec("begin");
    try {
      await db.exec("set local role " + role);
      await db.query("select set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, email: uid.slice(-4) + "@test.local", role }) : ""]);
      const out = await fn();
      await db.exec("commit");
      return out;
    } catch (e) { await db.exec("rollback"); throw e; }
  });
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  const svc = (sql, params) => as("service_role", null, () => q(sql, params));
  const pgErr = (e) => ({ code: String(e.code || "XX000"), message: String(e.message || e), details: e.detail || null });

  async function callRpc(role, uid, fn, args) {
    if (!/^[a-z_][a-z0-9_]*$/.test(fn)) return { error: { code: "PGRST202", message: "bad name" } };
    const meta = await lock(() => q("select t.typtype, p.proargnames as names, (select array_agg(format_type(x, null) order by o) from unnest(p.proargtypes) with ordinality u(x, o)) as types from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype where n.nspname = 'public' and p.proname = $1", [fn]));
    if (!meta.length) return { error: { code: "PGRST202", message: "Could not find the function public." + fn } };
    const keys = Object.keys(args || {});
    if (keys.some((k) => !/^[a-z_][a-z0-9_]*$/.test(k))) return { error: { code: "PGRST202", message: "bad arg" } };
    const named = keys.map((k, i) => k + " => $" + (i + 1)).join(", ");
    const typeOf = (k) => { const i = (meta[0].names || []).indexOf(k); return i >= 0 && meta[0].types ? String(meta[0].types[i]) : ""; };
    const lit = (x) => '"' + String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    const vals = keys.map((k) => { const v = args[k]; if (v === null || typeof v !== "object") return v; return /\[\]$/.test(typeOf(k)) && Array.isArray(v) ? "{" + v.map(lit).join(",") + "}" : JSON.stringify(v); });
    try {
      const rows = await as(role, uid, () => q(meta[0].typtype === "c" ? "select row_to_json(x) as r from public." + fn + "(" + named + ") x" : "select public." + fn + "(" + named + ") as r", vals));
      return { data: rows.length ? rows[0].r : null, error: null };
    } catch (e) { return { data: null, error: pgErr(e) }; }
  }

  /* --- ctx.sb: малка имитация на supabase-js под ролята на служителя --- */
  function sbFor(uid) {
    class Q {
      constructor(t) { this.t = t; this.w = []; this.p = []; this.cols = "*"; }
      select(c) { this.cols = c || "*"; return this; }
      eq(k, v) { this.p.push(v); this.w.push(k + " = $" + this.p.length); return this; }
      like(k, v) { this.p.push(v); this.w.push(k + " like $" + this.p.length); return this; }
      order(k, o) { this.o = k + (o && o.ascending === false ? " desc" : " asc"); return this; }
      limit(n) { this.l = n; return this; }
      maybeSingle() { this.one = true; return this; }
      then(res, rej) {
        if (!/^nd_[a-z_]+$/.test(this.t)) return Promise.resolve({ data: null, error: { code: "42P01", message: "?" } }).then(res, rej);
        const sql = "select " + this.cols + " from public." + this.t + (this.w.length ? " where " + this.w.join(" and ") : "") + (this.o ? " order by " + this.o : "") + (this.l ? " limit " + this.l : "");
        return as("authenticated", uid, () => q(sql, this.p)).then((rows) => ({ data: this.one ? rows[0] || null : rows, error: null }), (e) => ({ data: null, error: pgErr(e) })).then(res, rej);
      }
    }
    return { from: (t) => new Q(t), rpc: (fn, a) => callRpc("authenticated", uid, fn, a) };
  }
  const ctx = (uid) => ({ sb: sbFor(uid), userId: uid, user: { id: uid }, token: "TEST-JWT-" + uid.slice(-4) });

  /* --- service role: REST, RPC, storage, GitHub --- */
  const B = { storage: new Map(), meta: new Map(), dispatches: [], calls: [], signed: new Map(), failStorage: 0, noRange: false, ghStatus: 204, onDispatch: null, base: null, now: () => Date.now() };
  const resp = (status, body, headers) => new Response(body === null ? null : typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body), { status, headers: Object.assign({ "content-type": "application/json" }, headers || {}) });
  const etagOf = (p) => (B.meta.get(p) || {}).etag || crypto.createHash("md5").update(B.storage.get(p)).digest("hex");
  const put = (p, buf) => { B.storage.set(p, Buffer.from(buf)); B.meta.set(p, { etag: crypto.createHash("md5").update(buf).digest("hex") }); };
  const signUrl = (kind, p, ttl) => { const t = crypto.randomBytes(12).toString("hex"); B.signed.set(t, { kind, path: p, exp: B.now() + ttl * 1000 }); return (B.base || "http://127.0.0.1:1") + "/s/" + kind + "/" + t; };
  const FILTER = { eq: (c, v, p) => { p.push(v); return c + " = $" + p.length; }, lte: (c, v, p) => { p.push(v); return c + " <= $" + p.length; }, is: (c, v) => c + " is " + (v === "false" ? "false" : v === "true" ? "true" : "null"),
    in: (c, v, p) => { const xs = v.replace(/^\(|\)$/g, "").split(","); return c + " in (" + xs.map((x) => { p.push(x); return "$" + p.length; }).join(",") + ")"; } };

  async function fakeFetch(url, o) {
    o = o || {}; const u = new URL(url), method = o.method || "GET";
    B.calls.push(method + " " + u.host + u.pathname.replace(/^\/(rest|storage)\/v1\//, "/"));
    if (u.host === "api.github.com") {
      const m = /^\/repos\/([^/]+\/[^/]+)\/actions\/workflows\/([^/]+)\/dispatches$/.exec(u.pathname);
      const body = JSON.parse(o.body || "{}"), auth = (o.headers || {}).Authorization || "";
      B.dispatches.push({ repo: m && m[1], workflow: m && decodeURIComponent(m[2]), ref: body.ref, inputs: body.inputs, auth_ok: /^Bearer TEST-GH-TOKEN/.test(auth) });
      if (B.ghStatus === 204 && B.onDispatch) B.onDispatch(body.inputs && body.inputs.job_id);
      return resp(B.ghStatus, B.ghStatus === 204 ? null : { message: "TEST" });
    }
    if (u.origin !== SB) throw new Error("неочаквана мрежа: " + u.origin);
    if (!/^Bearer TEST-SERVICE-ROLE/.test((o.headers || {}).Authorization || "")) return resp(401, { message: "no key" });
    if (u.pathname.startsWith("/storage/v1/object/sign/nd-files/")) {
      const p = decodeURIComponent(u.pathname.slice("/storage/v1/object/sign/nd-files/".length));
      if (!B.storage.has(p)) return resp(400, { error: "not_found" });
      return resp(200, { signedURL: signUrl("get", p, JSON.parse(o.body || "{}").expiresIn || 60) });
    }
    if (u.pathname.startsWith("/storage/v1/object/upload/sign/nd-files/")) {
      const p = decodeURIComponent(u.pathname.slice("/storage/v1/object/upload/sign/nd-files/".length));
      return resp(200, { url: signUrl("put", p, 7200) });
    }
    if (u.pathname.startsWith("/storage/v1/object/nd-files/")) {
      const p = decodeURIComponent(u.pathname.slice("/storage/v1/object/nd-files/".length));
      if (B.failStorage > 0) { B.failStorage--; return resp(500, { error: "TEST" }); }
      if (!B.storage.has(p)) return resp(400, { error: "not_found" });
      const buf = B.storage.get(p), r = /^bytes=(\d+)-(\d+)$/.exec((o.headers || {}).Range || "");
      if (r && !B.noRange) { const a = Number(r[1]), b = Math.min(Number(r[2]), buf.length - 1); return resp(206, buf.subarray(a, b + 1), { "content-range": "bytes " + a + "-" + b + "/" + buf.length, "content-length": String(b - a + 1), etag: '"' + etagOf(p) + '"' }); }
      return resp(200, buf, { "content-length": String(buf.length), etag: '"' + etagOf(p) + '"' });
    }
    if (u.pathname.startsWith("/rest/v1/rpc/")) {
      const r = await callRpc("service_role", null, u.pathname.slice(13), JSON.parse(o.body || "{}"));
      if (r.error) return resp(r.error.code === "PGRST202" ? 404 : r.error.code === "42501" ? 403 : 400, r.error);
      return resp(200, r.data === undefined ? null : JSON.stringify(r.data));
    }
    if (u.pathname.startsWith("/rest/v1/nd_")) {
      const t = u.pathname.slice(9), p = [], w = [];
      let cols = "*", order = "", limit = "";
      for (const [k, v] of u.searchParams) {
        if (k === "select") cols = v.split(",").map((c) => (/^[a-z_]+$/.test(c) ? c : null)).filter(Boolean).join(",") || "*";
        else if (k === "order") order = " order by " + v.replace(/[^a-z_.,]/g, "").replace(".desc", " desc").replace(".asc", "");
        else if (k === "limit") limit = " limit " + parseInt(v, 10);
        else { const m = /^([a-z]+)\.(.*)$/s.exec(v); if (!m || !FILTER[m[1]] || !/^[a-z_]+$/.test(k)) return resp(400, { code: "PGRST100", message: "filter" }); w.push(FILTER[m[1]](k, m[2], p)); }
      }
      try { return resp(200, await svc("select " + cols + " from public." + t + (w.length ? " where " + w.join(" and ") : "") + order + limit, p)); } catch (e) { return resp(e.code === "42P01" ? 404 : 400, pgErr(e)); }
    }
    return resp(404, { message: "?" });
  }
  const realFetch = global.fetch;
  global.fetch = fakeFetch;

  /* --- истински HTTP отпред (само за пълния тест с изпълнителя и за прегледа): обратни повиквания + подписани адреси + /model/ --- */
  let server = null;
  async function listen(CAD, extra) {
    server = http.createServer(async (req, res) => {
      try {
        const u = new URL(req.url, "http://127.0.0.1");
        const m = /^\/s\/(get|put)\/([a-f0-9]{24})$/.exec(u.pathname);
        if (m) {
          const s = B.signed.get(m[2]);
          if (!s || s.kind !== m[1] || s.exp < B.now()) { res.statusCode = 400; return res.end("expired"); }
          if (m[1] === "get" && req.method === "GET") { const buf = B.storage.get(s.path); if (!buf) { res.statusCode = 404; return res.end(""); } res.setHeader("Content-Length", buf.length); res.setHeader("Access-Control-Allow-Origin", "*"); return res.end(buf); }
          if (m[1] === "put" && req.method === "PUT") { const ch = []; for await (const c of req) ch.push(c); put(s.path, Buffer.concat(ch)); res.setHeader("Content-Type", "application/json"); return res.end('{"Key":"ok"}'); }
          res.statusCode = 405; return res.end("");
        }
        if (u.pathname === "/api/tools" && req.method === "POST" && u.searchParams.has("ncw")) return CAD.workerCallback(req, res);
        if (u.pathname === "/api/tools" && req.method === "GET" && u.searchParams.has("model")) return CAD.publicModel(req, res);
        const pm = /^\/model\/([a-z0-9]{8,64})(\/poster)?$/.exec(u.pathname);
        if (pm) { req.url = "/api/tools?model=" + pm[1] + (pm[2] ? "/poster" : ""); return CAD.publicModel(req, res); }
        if (extra && (await extra(req, res, u))) return;
        res.statusCode = 404; res.end("");
      } catch (e) { res.statusCode = 500; res.end(String(e && e.message)); }
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    B.base = "http://127.0.0.1:" + server.address().port;
    return B.base;
  }
  const close = async () => { global.fetch = realFetch; if (server) await new Promise((r) => server.close(r)); await db.close().catch(() => null); };

  /* --- служебни данни: проект, сграда, етажи, обекти (TEST-…) --- */
  async function seed(structure) {
    const P = (await as("authenticated", BROKER, () => q("insert into nd_projects(name, data) values ('TEST-Проект 3D', '{\"title\":\"TEST-Проект 3D\"}') returning *")))[0];
    const bid = structure ? structure.building_id : null;
    const Bd = (await svc(bid ? "insert into nd_buildings(id, project_id, name) values ($2,$1,'TEST-Сграда') returning *" : "insert into nd_buildings(project_id, name) values ($1,'TEST-Сграда') returning *", bid ? [P.id, bid] : [P.id]))[0];
    const floors = [], units = [];
    for (const f of (structure ? structure.floors : [{ level: 1, label: "Етаж 1" }, { level: 2, label: "Етаж 2" }])) {
      floors.push((await svc(f.id ? "insert into nd_floors(id, project_id, building_id, level, label) values ($4,$1,$2,$3,$5) returning *" : "insert into nd_floors(project_id, building_id, level, label) values ($1,$2,$3,$4) returning *", f.id ? [P.id, Bd.id, f.level, f.id, f.label] : [P.id, Bd.id, f.level, f.label]))[0]);
    }
    for (const x of (structure ? structure.units : [{ code: "TEST-101", floor: 0 }, { code: "TEST-201", floor: 1 }])) {
      const fid = x.floor_id || floors[x.floor].id;
      units.push((await svc(x.id ? "insert into nd_units(id, project_id, building_id, floor_id, code, area_total, price_per_m2) values ($5,$1,$2,$3,$4,50,1000) returning *" : "insert into nd_units(project_id, building_id, floor_id, code, area_total, price_per_m2) values ($1,$2,$3,$4,50,1000) returning *", x.id ? [P.id, Bd.id, fid, x.code, x.id] : [P.id, Bd.id, fid, x.code]))[0]);
    }
    return { P, B: Bd, floors, units };
  }
  const publishProject = (pid, slug) => svc("update nd_projects set status='published', slug=$2 where id=$1", [pid, slug]);

  return { db, as, q, svc, ctx, B, put, listen, close, seed, publishProject, SB, ADMIN, BROKER, VISITOR, SECRET };
}

module.exports = { create, findPglite, ADMIN, BROKER, VISITOR, SECRET, SB };
