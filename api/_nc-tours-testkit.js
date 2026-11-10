// ИМОТИ НАДЕЖДА · TASK-010 · САМО ЗА ТЕСТОВЕ: изолирана база (PGlite – Postgres в процеса, без мрежа) с nc_001…nc_006
// и средата на Supabase (роли anon/authenticated/service_role, auth.uid()/auth.jwt(), storage.objects, nd_staff/nd_is_staff/nd_is_admin
// – копие на живите дефиниции, както в db/nc/tests/nc_dryrun.test.js). НЕ докосва Supabase, Vercel или n8n.
// Дава и фалшив клиент (rpc + малко from().select().eq()) и фалшиво хранилище със същите правила за запис като nc_003.
"use strict";
const fs = require("fs"), path = require("path");

const CANDIDATES = [process.env.PGLITE, "/tmp/pg17/node_modules/@electric-sql/pglite", "/home/claude/audit/pgtest/node_modules/@electric-sql/pglite", "@electric-sql/pglite"].filter(Boolean);
function loadPg() { for (const c of CANDIDATES) { try { return require(c); } catch (e) { /* следващ */ } } return null; }
const SQLDIR = path.join(__dirname, "..", "db", "nc");
const SQL = (f) => fs.readFileSync(path.join(SQLDIR, f), "utf8");
const ADMIN = "00000000-0000-4000-8000-000000000001", BROKER = "00000000-0000-4000-8000-000000000002", BROKER2 = "00000000-0000-4000-8000-000000000003", OUTSIDER = "00000000-0000-4000-8000-000000000009";
const BOOT = `
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
  insert into public.nd_staff(user_id, role) values ('${ADMIN}','admin'), ('${BROKER}','broker'), ('${BROKER2}','broker');
  create table public.nd_properties (id text primary key, data jsonb not null default '{}'::jsonb);
`;
const BASE = ["nc_001_new_construction.sql", "nc_002_jobs_rpc.sql", "nc_003_hardening.sql", "nc_004_import.sql"];
const optional005 = () => fs.readdirSync(SQLDIR).filter((f) => /^nc_005_.*\.sql$/.test(f) && !/_down\.sql$/.test(f)).sort();

async function makeDb(opts) {
  const P = loadPg(); if (!P) return null;
  const db = new P.PGlite();
  await db.exec(BOOT);
  const applied = BASE.concat(optional005());
  for (const f of applied) await db.exec(SQL(f));
  if (!(opts && opts.skip006)) await db.exec(SQL("nc_006_tours.sql"));
  const types = new Map();
  async function as(role, uid, fn) {
    await db.exec("begin");
    try {
      await db.exec(`set local role ${role}`);
      const claims = role === "service_role" ? { role: "service_role" } : uid ? { sub: uid, email: uid.slice(-4) + "@test.local", role } : null;
      await db.query("select set_config('request.jwt.claims', $1, true)", [claims ? JSON.stringify(claims) : ""]);
      const out = await fn();
      await db.exec("commit");
      return out;
    } catch (e) { await db.exec("rollback"); throw e; }
  }
  const q = async (sql, params) => (await db.query(sql, params)).rows;
  async function argTypes(fn) {
    if (types.has(fn)) return types.get(fn);
    const r = await db.query("select p.proargnames as n, (select array_agg(format_type(t, null) order by i) from unnest(p.proargtypes) with ordinality as x(t, i)) as t, format_type(p.prorettype, null) as ret from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = $1", [fn]);
    if (!r.rows.length) { const e = new Error("Could not find the function public." + fn); e.code = "PGRST202"; throw e; }
    const m = {}; (r.rows[0].n || []).forEach((n, i) => { m[n] = r.rows[0].t[i]; }); Object.defineProperty(m, "__ret", { value: r.rows[0].ret });
    types.set(fn, m); return m;
  }
  /* извикване като PostgREST: именувани аргументи; грешките идват с .code (SQLSTATE) и .message */
  async function rpc(role, uid, fn, args) {
    const T = await argTypes(fn), keys = Object.keys(args || {});
    for (const k of keys) if (!T[k]) { const e = new Error("Could not find the function public." + fn + " with argument " + k); e.code = "PGRST202"; throw e; }
    const vals = keys.map((k) => { const v = args[k]; return v === undefined || v === null ? null : typeof v === "object" ? JSON.stringify(v) : v; });
    const call = "public." + fn + "(" + keys.map((k, i) => k + " => $" + (i + 1) + "::" + T[k]).join(", ") + ")";
    const sql = T.__ret === "void" ? "select " + call + " is null as r" : "select to_jsonb(" + call + ") as r";
    const rows = await as(role, uid, () => q(sql, vals));
    return rows[0] ? (T.__ret === "void" ? null : rows[0].r) : null;
  }
  /* фалшив supabase-js клиент за ctx.sb (само нужното) */
  function client(role, uid) {
    const wrap = (p) => p.then((data) => ({ data, error: null }), (e) => ({ data: null, error: { code: e.code, message: e.message, details: e.detail } }));
    return {
      rpc: (fn, args) => wrap(rpc(role, uid, fn, args)),
      from: (table) => {
        const f = []; let cols = "*", single = false;
        const b = {
          select: (c) => { cols = c || "*"; return b; }, eq: (c, v) => { f.push([c, v]); return b; },
          maybeSingle: () => { single = true; return b; },
          then: (res, rej) => wrap(as(role, uid, () => q("select " + (cols === "*" ? "*" : cols.split(",").map((x) => '"' + x.trim() + '"').join(",")) + " from public." + table + (f.length ? " where " + f.map((x, i) => '"' + x[0] + '" = $' + (i + 1)).join(" and ") : ""), f.map((x) => x[1])))).then((r) => (r.error ? r : { data: single ? r.data[0] || null : r.data, error: null })).then(res, rej)
        };
        return b;
      },
      storage: { from: () => ({ createSignedUrl: (p, secs) => Promise.resolve(STORE.has(p) && canRead(role, uid, p) ? { data: { signedUrl: "https://test.invalid/sign/" + encodeURIComponent(p) + "?exp=" + secs }, error: null } : { data: null, error: { message: "Object not found" } }) }) }
    };
  }
  /* хранилище: правилата на nc_003 FX1 – служител не пише в derived/; в public/ и private/tours/ – само админ; service role – навсякъде */
  const STORE = new Map();
  const isAdmin = (uid) => uid === ADMIN, isStaff = (uid) => [ADMIN, BROKER, BROKER2].includes(uid);
  function canWrite(role, uid, p) {
    if (role === "service_role") return true;
    if (!isStaff(uid)) return false;
    const s = p.split("/");
    if (s[0] !== "projects") return true;
    if (s[2] === "private" && s[3] === "derived") return false;
    if (s[2] === "public" || (s[2] === "private" && s[3] === "tours")) return isAdmin(uid);
    return true;
  }
  const canRead = (role, uid) => role === "service_role" || isStaff(uid);
  const storage = {
    put(role, uid, p, buf) { if (!canWrite(role, uid, p)) { const e = new Error("new row violates row-level security policy"); e.status = 403; throw e; } if (STORE.has(p)) { const e = new Error("The resource already exists"); e.status = 409; throw e; } STORE.set(p, Buffer.from(buf)); return true; },
    get: (p) => STORE.get(p) || null, del: (p) => STORE.delete(p), has: (p) => STORE.has(p), list: () => Array.from(STORE.keys()), map: STORE
  };
  return { db, as, q, rpc, client, storage, SQL, applied, ADMIN, BROKER, BROKER2, OUTSIDER };
}

module.exports = { makeDb, loadPg, SQL, ADMIN, BROKER, BROKER2, OUTSIDER };
