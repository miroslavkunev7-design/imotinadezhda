// Изолиран тест на nc_007 (публикуване с чиста площ) върху nc_001…nc_006 в PGlite (Postgres в процеса, без мрежа).
// НЕ докосва Supabase. Средата е имитирана както в nc_dryrun.test.js.
// Стартиране: PGLITE=/tmp/pg17/node_modules/@electric-sql/pglite node db/nc/tests/nc_007_publish.test.js
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const { PGlite } = require(process.env.PGLITE || "@electric-sql/pglite");
const SQL = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const ADMIN = "00000000-0000-4000-8000-000000000001", BROKER = "00000000-0000-4000-8000-000000000002";
const results = []; let db;
async function as(role, uid, fn) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, email: uid.slice(-4) + "@test.local", role }) : ""]);
    const out = await fn(); await db.exec("commit"); return out;
  } catch (e) { await db.exec("rollback"); throw e; }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
async function fails(code, fn, label) {
  try { await fn(); } catch (e) { assert.strictEqual(e.code, code, label + ": очакван " + code + ", получен " + e.code + " (" + e.message + ")"); return e; }
  assert.fail(label + ": очаквана грешка " + code + ", но мина");
}
async function t(name, fn) { try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name, e.message]); try { await db.exec("rollback"); } catch (x) {} } }
const def = async () => (await q("select md5(pg_get_functiondef('public.nd_project_set_status(text,text,integer,text)'::regprocedure)) m, (select string_agg(grantee || ':' || privilege_type, ',' order by grantee) from information_schema.routine_privileges where routine_name='nd_project_set_status') g"))[0];

(async () => {
  db = new PGlite();
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
  for (const f of ["nc_001_new_construction.sql", "nc_002_jobs_rpc.sql", "nc_003_hardening.sql", "nc_004_import.sql", "nc_005_cad_models.sql", "nc_006_tours.sql"]) await db.exec(SQL(f));
  const d0 = await def();
  let P, B, F;
  const proj = async () => (await as("authenticated", ADMIN, () => q("select * from nd_projects where id=$1", [P.id])))[0];
  const publish = async (slug) => { const p = await proj(); return (await as("authenticated", ADMIN, () => q("select nd_project_set_status($1,'published',$2,$3) as r", [P.id, p.version, slug || "shumen-kv-366"])))[0].r; };
  const review = async () => { const p = await proj(); await as("authenticated", ADMIN, () => q("select nd_project_mark_reviewed($1,$2)", [P.id, p.content_rev])); };

  await t("N0 подготовка: проект с 2 апартамента само с ЧИСТА площ и цена (както проектът в Шумен)", async () => {
    await as("authenticated", BROKER, async () => {
      P = (await q("insert into nd_projects(name, data) values ('Шумен', '{\"title\":\"Жилищна сграда\",\"city\":\"Шумен\",\"price_policy\":{\"basis\":\"net\"}}') returning *"))[0];
      B = (await q("insert into nd_buildings(project_id, name) values ($1,'Сграда') returning *", [P.id]))[0];
      F = (await q("insert into nd_floors(project_id, building_id, level) values ($1,$2,1) returning *", [P.id, B.id]))[0];
      await q("insert into nd_units(project_id, building_id, floor_id, code, area_net, price_per_m2) values ($1,$2,$3,'Ап. 1',72.51,1550), ($1,$2,$3,'Ап. 2',64.05,1550)", [P.id, B.id, F.id]);
    });
    const u = await as("authenticated", BROKER, () => q("select code, area_total, area_net, price_total from nd_units where project_id=$1 order by code", [P.id]));
    assert.strictEqual(u.length, 2); assert.strictEqual(u[0].area_total, null); assert.strictEqual(Number(u[0].price_total), 112391); assert.strictEqual(Number(u[1].price_total), 99278);
    await review();
  });
  await t("N1 преди nc_007: публикуването отказва „2 обекта без площ или цена“", async () => {
    const r = await publish(); assert.strictEqual(r.ok, false); assert.ok(JSON.stringify(r.issues).includes("2 обекта без площ или цена"), JSON.stringify(r));
  });
  await t("N2 nc_007 се прилага; правата върху функцията са същите", async () => {
    await db.exec(SQL("nc_007_publish_net_area.sql")); const d = await def(); assert.notStrictEqual(d.m, d0.m); assert.strictEqual(d.g, d0.g);
  });
  await t("N3 брокер пак не може да публикува (42501); лош slug → 22023; остаряла версия → NC409", async () => {
    const p = await proj();
    await fails("42501", () => as("authenticated", BROKER, () => q("select nd_project_set_status($1,'published',$2,'shumen-kv-366')", [P.id, p.version])), "broker");
    await fails("22023", () => as("authenticated", ADMIN, () => q("select nd_project_set_status($1,'published',$2,'Bad Slug!')", [P.id, p.version])), "slug");
    await fails("NC409", () => as("authenticated", ADMIN, () => q("select nd_project_set_status($1,'published',$2,'shumen-kv-366')", [P.id, p.version + 5])), "version");
  });
  await t("N4 обект без НИКАКВА площ или без цена пак спира публикуването", async () => {
    await as("authenticated", BROKER, () => q("insert into nd_units(project_id, building_id, floor_id, code) values ($1,$2,$3,'Ап. 3')", [P.id, B.id, F.id]));
    await review(); let r = await publish(); assert.strictEqual(r.ok, false); assert.ok(JSON.stringify(r.issues).includes("1 обекта без площ или цена"), JSON.stringify(r));
    await as("authenticated", BROKER, () => q("update nd_units set area_net=50 where project_id=$1 and code='Ап. 3'", [P.id]));
    await review(); r = await publish(); assert.strictEqual(r.ok, false, "площ без цена");
    await as("authenticated", BROKER, () => q("update nd_units set price_per_m2=1550 where project_id=$1 and code='Ап. 3'", [P.id]));
  });
  await t("N5 непрегледано съдържание пак спира публикуването", async () => {
    await review(); await as("authenticated", BROKER, () => q("update nd_projects set data = data || '{\"description\":\"Промяна след прегледа\"}' where id=$1", [P.id]));
    const r = await publish(); assert.strictEqual(r.ok, false); assert.strictEqual(r.issues.length, 1, JSON.stringify(r)); assert.ok(JSON.stringify(r.issues).includes("проверено"), JSON.stringify(r));
  });
  await t("N6 с чиста площ + цена + преглед → публикуван; публичните функции го връщат без вътрешни полета", async () => {
    await review(); const r = await publish(); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.status, "published"); assert.strictEqual(r.slug, "shumen-kv-366");
    const pub = (await as("anon", null, () => q("select nd_public_project('shumen-kv-366') as r")))[0].r;
    assert.ok(pub && pub.units && pub.units.length === 3); assert.strictEqual(Number(pub.units[0].area_net), 72.51); assert.strictEqual(Number(pub.units[0].price_total), 112391);
    const list = (await as("anon", null, () => q("select * from nd_public_projects()")));
    assert.ok(JSON.stringify(list).includes("shumen-kv-366"));
  });
  await t("N7 връщане в чернова работи; обратният скрипт връща старото правило (md5 = преди) и правата", async () => {
    let p = await proj(); await as("authenticated", ADMIN, () => q("select nd_project_set_status($1,'draft',$2,null)", [P.id, p.version]));
    assert.strictEqual((await as("anon", null, () => q("select nd_public_project('shumen-kv-366') as r")))[0].r, null);
    await db.exec(SQL("nc_007_publish_net_area_down.sql")); const d = await def(); assert.strictEqual(d.m, d0.m); assert.strictEqual(d.g, d0.g);
    const r = await publish(); assert.strictEqual(r.ok, false);
  });
  await t("N8 up → down → up е повторяемо", async () => {
    await db.exec(SQL("nc_007_publish_net_area.sql")); await db.exec(SQL("nc_007_publish_net_area_down.sql")); await db.exec(SQL("nc_007_publish_net_area.sql"));
    const r = await publish(); assert.strictEqual(r.ok, true, JSON.stringify(r));
  });
  const pg = (await q("select version() v"))[0].v.split(" on ")[0];
  const pass = results.filter((r) => r[0] === "PASS").length, total = results.length;
  console.log("Среда: " + pg + " (PGlite, изолирано, без мрежа)\n");
  results.forEach((r) => console.log(r[0] + "  " + r[1] + (r[2] ? "\n      → " + r[2] : "")));
  console.log("\nРЕЗУЛТАТ: " + pass + "/" + total);
  process.exit(pass === total ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
