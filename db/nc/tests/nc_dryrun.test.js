// Изолиран dry-run на черновите nc_001 (v2) / nc_002 (v2) / nc_001_down в PGlite (Postgres в процеса, без мрежа).
// НЕ докосва Supabase. Средата на Supabase е имитирана: роли anon/authenticated/service_role,
// auth.uid()/auth.jwt(), storage.objects, nd_staff + nd_is_staff()/nd_is_admin()/nd_touch() (копие на живите дефиниции).
// Съдържа и регресии за всички находки от независимата проверка (H1–H19, S1–S15, J1–J3).
// Стартиране: npm i @electric-sql/pglite && node nc_dryrun.test.js   (PGLITE=<път до пакета> за друга версия)
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const { PGlite } = require(process.env.PGLITE || "@electric-sql/pglite");
const SQL = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const ADMIN = "00000000-0000-4000-8000-000000000001", BROKER = "00000000-0000-4000-8000-000000000002",
  BROKER2 = "00000000-0000-4000-8000-000000000003", VISITOR = "00000000-0000-4000-8000-000000000009";
const results = [];
let db;

async function as(role, uid, fn) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [uid ? JSON.stringify({ sub: uid, email: uid.slice(-4) + "@test.local", role }) : ""]);
    const out = await fn();
    await db.exec("commit");
    return out;
  } catch (e) { await db.exec("rollback"); throw e; }
}
const q = async (sql, params) => (await db.query(sql, params)).rows;
const svc = (sql, params) => as("service_role", null, () => q(sql, params));
async function fails(code, fn, label) {
  // 23001 (restrict_violation, PG 18) и 23503 (PG 17) са едно и също нарушение на RESTRICT
  try { await fn(); } catch (e) { if (code === "23503" && e.code === "23001") return e; assert.strictEqual(e.code, code, label + ": очакван SQLSTATE " + code + ", получен " + e.code + " (" + e.message + ")"); return e; }
  assert.fail(label + ": очаквана грешка " + code + ", но мина");
}
async function t(name, fn) {
  try { await fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name, e.message]); try { await db.exec("rollback"); } catch (x) {} }
}
const ver = async (id) => (await svc("select version from nd_units where id=$1", [id]))[0].version;
const setStatus = (role, uid, unit, to, ver, ev, note) =>
  as(role, uid, async () => (await q("select nd_unit_set_status($1,$2,$3,$4,$5) as r", [unit, to, ver, ev || null, note || null]))[0].r);

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
    insert into public.nd_staff(user_id, role) values ('${ADMIN}','admin'), ('${BROKER}','broker'), ('${BROKER2}','broker');
    create table public.nd_properties (id text primary key, data jsonb not null default '{}'::jsonb);
    insert into public.nd_properties values ('p1', '{"status":"Публикуван"}');
  `);
  const baseline = (await q("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','i','S')"))[0].n;
  const baseFn = (await q("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"))[0].n;

  await t("M1 nc_001 (v2) се прилага без грешка", async () => { await db.exec(SQL("nc_001_new_construction.sql")); });
  await t("M2 nc_002 (v2) се прилага без грешка", async () => { await db.exec(SQL("nc_002_jobs_rpc.sql")); });
  await t("M3 nc_003 (втвърдяване след втората проверка) се прилага без грешка", async () => { await db.exec(SQL("nc_003_hardening.sql")); });
  /* снимка на схемата ПРЕДИ nc_004: функции (с подпис, вид, search_path, права), таблици/колони, политики, тригери, ограничения → за проверката на nc_004_import_down.sql */
  const catalog = async () => (await q(`
    select 'fn ' || p.oid::regprocedure::text || ' secdef=' || p.prosecdef || ' cfg=' || coalesce(array_to_string(p.proconfig, ','), '') || ' acl=' || coalesce(array_to_string(p.proacl, ','), '') as x
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
    union all select 'col ' || c.table_name || '.' || c.column_name || ' ' || c.data_type || ' ' || c.is_nullable || ' ' || coalesce(c.column_default, '') from information_schema.columns c where c.table_schema = 'public'
    union all select 'pol ' || schemaname || '.' || tablename || '.' || policyname || ' ' || cmd || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '') from pg_policies
    union all select 'trg ' || tgrelid::regclass::text || '.' || tgname from pg_trigger where not tgisinternal
    union all select 'con ' || conrelid::regclass::text || '.' || conname || ' ' || pg_get_constraintdef(oid) from pg_constraint where connamespace = 'public'::regnamespace
    union all select 'acl ' || c.oid::regclass::text || ' ' || coalesce(array_to_string(c.relacl, ','), '') from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','v','S')
    order by 1`)).map((r) => r.x);
  const before004 = await catalog();
  let added004 = [];
  await t("M4 nc_004 (импорт, TASK-006) се прилага без грешка", async () => { await db.exec(SQL("nc_004_import.sql")); });
  await t("M5 nc_004 добавя САМО 4 функции (нищо друго в схемата не се променя); SECURITY DEFINER – само със search_path=''", async () => {
    const after = await catalog(), added = after.filter((x) => !before004.includes(x)), removed = before004.filter((x) => !after.includes(x));
    added004 = added;
    assert.deepStrictEqual(removed, [], "nc_004 не маха и не променя нищо съществуващо");
    assert.deepStrictEqual(added.map((x) => x.split(" ")[1].replace(/\(.*$/, "")).sort(), ["nd_import_apply", "nd_import_job_begin", "nd_import_job_done", "nd_job_claim_id"]);
    added.forEach((x) => {
      const acl = x.replace(/^.* acl=/, "");
      assert.ok(/ cfg=search_path=""/.test(x), "search_path='' : " + x);
      assert.ok(acl && !/(^|,)=X\//.test(acl), "без PUBLIC execute: " + x);
      assert.ok(!/(^|,)anon=X/.test(acl), "без anon: " + x);
    });
    assert.ok(added.find((x) => /nd_job_claim_id/.test(x) && /secdef=true/.test(x) && !/authenticated=X/.test(x)), "claim_id: само service_role");
    assert.ok(added.find((x) => /nd_import_apply/.test(x) && /secdef=false/.test(x)), "nd_import_apply е SECURITY INVOKER (записът е под правата на служителя)");
  });

  let P, P2, B, B2, F, F2, U1, U2, U3, V1;
  const planPath = (pid, code) => `projects/${pid}/private/units/${code}/plan.pdf`;

  await t("T1 брокер създава чернова; status/slug/version не са му достъпни като колони (42501); без тях → draft", async () => {
    await fails("42501", () => as("authenticated", BROKER, () => q("insert into nd_projects(name, status) values ('x','published')")), "status column");
    await fails("42501", () => as("authenticated", BROKER, () => q("insert into nd_projects(name, slug) values ('x','hack')")), "slug column");
    await as("authenticated", BROKER, async () => {
      P = (await q("insert into nd_projects(name, data) values ('Тест', $1) returning *", [JSON.stringify({ title: "TEST-Проект", city: "Шумен", price_policy: { basis: "total" } })]))[0];
      assert.strictEqual(P.status, "draft"); assert.strictEqual(P.slug, null); assert.strictEqual(P.version, 1); assert.strictEqual(P.content_rev, 1);
      B = (await q("insert into nd_buildings(project_id, name) values ($1,'Сграда A') returning *", [P.id]))[0];
      F = (await q("insert into nd_floors(project_id, building_id, level, label, data) values ($1,$2,3,'Етаж 3',$3) returning *", [P.id, B.id, JSON.stringify({ plan: { private: `projects/${P.id}/private/plans/floor-3.pdf` }, polygons: [{ unit_code: "A3-02", points: [[0, 0], [1, 0], [1, 1]] }] })]))[0];
      P2 = (await q("insert into nd_projects(name, data) values ('Друг', '{\"title\":\"P2\"}') returning *"))[0];
      B2 = (await q("insert into nd_buildings(project_id, name) values ($1,'Сграда B') returning *", [P2.id]))[0];
      F2 = (await q("insert into nd_floors(project_id, building_id, level) values ($1,$2,1) returning *", [P2.id, B2.id]))[0];
    });
  });

  await t("S10/H8 в JSON никъде няма инвеститор/строител/изпълнител – дори вложено (23514); невалидни полигони → 23514", async () => {
    await fails("23514", () => as("authenticated", BROKER, () => q("update nd_projects set data = data || '{\"investor\":\"X\"}' where id=$1", [P.id])), "top-level");
    await fails("23514", () => as("authenticated", BROKER, () => q("update nd_projects set data = data || '{\"advantages\":[{\"builder\":\"X\"}]}' where id=$1", [P.id])), "nested");
    await fails("23514", () => as("authenticated", BROKER, () => q("update nd_projects set data = data || '{\"Строител\":\"X\"}' where id=$1", [P.id])), "кирилица");
    await fails("23514", () => as("authenticated", BROKER, () => q("update nd_floors set data = data || '{\"polygons\":[{\"unit_code\":\"A\",\"points\":[[0,0],[1,1]],\"investor\":\"x\"}]}' where id=$1", [F.id])), "polygon keys");
    await fails("23514", () => as("authenticated", BROKER, () => q("update nd_floors set data = data || '{\"plan\":{\"private\":\"projects/OTHER/private/plans/x.pdf\"}}' where id=$1", [F.id])), "plan path other project");
  });

  await t("T2 обща цена = обща площ × цена/м² (102.70 × 2100 = 215670); 0 €/м² → 23514; чиста > обща → 23514", async () => {
    await as("authenticated", BROKER, async () => {
      U1 = (await q("insert into nd_units(project_id, building_id, floor_id, code, area_total, area_net, price_per_m2, data) values ($1,$2,$3,'A3-02',102.70,88.10,2100,$4) returning *", [P.id, B.id, F.id, JSON.stringify({ rooms: 3, plan: { private: planPath(P.id, "A3-02") } })]))[0];
      assert.strictEqual(Number(U1.price_total), 215670); assert.strictEqual(U1.status, "free"); assert.strictEqual(U1.version, 1);
      U2 = (await q("insert into nd_units(project_id, building_id, floor_id, code, area_total, price_per_m2) values ($1,$2,$3,'A3-03',60,2000) returning *", [P.id, B.id, F.id]))[0];
      U3 = (await q("insert into nd_units(project_id, building_id, floor_id, code, area_total, price_per_m2, data) values ($1,$2,$3,'A3-04',50,2000,$4) returning *", [P.id, B.id, F.id, JSON.stringify({ plan: { private: planPath(P.id, "A3-04") } })]))[0];
    });
    await fails("23514", () => as("authenticated", BROKER, () => q("insert into nd_units(project_id, building_id, floor_id, code, area_total, price_per_m2) values ($1,$2,$3,'Z0',50,0)", [P.id, B.id, F.id])), "zero price");
    await fails("23514", () => as("authenticated", BROKER, () => q("insert into nd_units(project_id, building_id, floor_id, code, area_total, area_net) values ($1,$2,$3,'Z1',50,60)", [P.id, B.id, F.id])), "net>total");
    await fails("23514", () => as("authenticated", BROKER, () => q("insert into nd_units(project_id, building_id, floor_id, code) values ($1,$2,$3,'public')", [P.id, B.id, F.id])), "reserved code");
    const n = (await as("authenticated", BROKER, () => q("select price_total from nd_units where id=$1", [U1.id])))[0];
    assert.strictEqual(Number(n.price_total), 215670);
  });

  await t("S4 ръчна цена само с причина (23514); H14 смяна на основата total→net преизчислява всички без override", async () => {
    await fails("23514", () => as("authenticated", BROKER, () => q("update nd_units set price_override=true, price_total=1 where id=$1", [U2.id])), "override без причина");
    await as("authenticated", BROKER, () => q("update nd_units set price_override=true, price_total=100000, price_override_reason='промоция по договор' where id=$1", [U2.id]));
    await as("authenticated", BROKER, () => q("update nd_projects set data = jsonb_set(data,'{price_policy,basis}','\"net\"') where id=$1", [P.id]));
    const rows = await as("authenticated", BROKER, () => q("select code, price_total from nd_units where project_id=$1 order by code", [P.id]));
    assert.strictEqual(Number(rows.find((r) => r.code === "A3-02").price_total), 185010);   // 88.10 × 2100
    assert.strictEqual(Number(rows.find((r) => r.code === "A3-03").price_total), 100000);   // override остава
    assert.strictEqual(rows.find((r) => r.code === "A3-04").price_total, null);            // няма чиста площ → нищо не се измисля
    await as("authenticated", BROKER, () => q("update nd_projects set data = jsonb_set(data,'{price_policy,basis}','\"total\"') where id=$1", [P.id]));
    const back = await as("authenticated", BROKER, () => q("select price_total from nd_units where id=$1", [U1.id]));
    assert.strictEqual(Number(back[0].price_total), 215670);
    const hist = await as("authenticated", BROKER, () => q("select field, old_value, new_value from nd_unit_changes where unit_id=$1 and field='price_total' order by id", [U1.id]));
    assert.ok(hist.length >= 2, "история на цената");
  });

  await t("T4/H1/H2 директна смяна на статус е невъзможна: колона без право (42501), и с set_config('nd.rpc'), и през ON CONFLICT", async () => {
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_units set status='sold' where id=$1", [U1.id])), "direct");
    await fails("42501", () => as("authenticated", ADMIN, () => q("update nd_units set status='sold' where id=$1", [U1.id])), "direct admin");
    await fails("42501", () => as("authenticated", BROKER, async () => { await q("select set_config('nd.rpc','1',true)"); return q("update nd_units set status='sold' where id=$1", [U1.id]); }), "GUC bypass");
    await fails("42501", () => as("authenticated", BROKER, () => q("insert into nd_units(project_id, building_id, floor_id, code) values ($1,$2,$3,'A3-02') on conflict (project_id, code) do update set status='sold'", [P.id, B.id, F.id])), "on conflict");
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_units set version=99 where id=$1", [U1.id])), "version column");
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_projects set content_rev=1 where id=$1", [P.id])), "content_rev column");
  });

  await t("H3 съставни ключове: обект не се мести в друг проект/етаж; обект върху етаж на друга сграда → 23503", async () => {
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_units set project_id=$2 where id=$1", [U1.id, P2.id])), "move project (column)");
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_units set floor_id=$2 where id=$1", [U1.id, F2.id])), "move floor (column)");
    await fails("23503", () => as("authenticated", BROKER, () => q("insert into nd_units(project_id, building_id, floor_id, code) values ($1,$2,$3,'X1')", [P.id, B.id, F2.id])), "floor of other building");
    await fails("23503", () => as("authenticated", BROKER, () => q("insert into nd_floors(project_id, building_id, level) values ($1,$2,7)", [P.id, B2.id])), "floor: building of other project");
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_floors set building_id=$2 where id=$1", [F.id, B2.id])), "move floor to other building");
  });

  await t("T5 брокер: free → reserved през RPC (нов подпис); версия +1; история; заявки за производни в същата транзакция", async () => {
    const ev = "11111111-1111-4111-8111-111111111111";
    V1 = await ver(U1.id);   // версията е нараснала при преизчисленията на цената по-горе
    const r = await setStatus("authenticated", BROKER, U1.id, "reserved", V1, ev);
    assert.strictEqual(r.ok, true); assert.strictEqual(r.status, "reserved"); assert.strictEqual(r.version, V1 + 1); assert.strictEqual(r.replayed, false);
    const evs = await as("authenticated", BROKER, () => q("select * from nd_unit_events where unit_id=$1", [U1.id]));
    assert.strictEqual(evs.length, 1); assert.strictEqual(evs[0].from_status, "free"); assert.strictEqual(evs[0].to_status, "reserved");
    const jobs = await svc("select idempotency_key, kind, actor_kind, status from nd_jobs where idempotency_key like 'pd:%' order by idempotency_key");
    assert.ok(jobs.some((j) => j.idempotency_key === `pd:u:${U1.id}:1:reserved`), "заявка за обект с подпис 1:reserved");
    assert.ok(jobs.some((j) => j.idempotency_key.startsWith(`pd:f:${F.id}:`)), "заявка за етажния план");
    assert.ok(jobs.every((j) => j.actor_kind === "system" && j.status === "queued"));
    U1 = (await as("authenticated", BROKER, () => q("select * from nd_units where id=$1", [U1.id])))[0];
    assert.ok(U1.status_changed_at);
  });

  await t("T6 повтор със същия event_id → replayed; C9 без event_id ключът се извежда → повторът е безопасен", async () => {
    const r = await setStatus("authenticated", BROKER, U1.id, "reserved", V1, "11111111-1111-4111-8111-111111111111");
    assert.strictEqual(r.replayed, true); assert.strictEqual(r.version, V1 + 1);
    const v3 = await ver(U3.id);
    const a = await setStatus("authenticated", BROKER, U3.id, "reserved", v3);
    const b = await setStatus("authenticated", BROKER, U3.id, "reserved", v3);
    assert.strictEqual(a.replayed, false); assert.strictEqual(b.replayed, true); assert.strictEqual(a.event_id, b.event_id);
    assert.strictEqual((await as("authenticated", BROKER, () => q("select count(*)::int n from nd_unit_events where unit_id=$1", [U3.id])))[0].n, 1, "без двойна история");
  });

  await t("T7 грешки: чужд event_id → 23505; стара версия → 40001; същият статус / непознат / 'deposited' → 22023", async () => {
    await fails("23505", async () => setStatus("authenticated", BROKER, U2.id, "sold", await ver(U2.id), "11111111-1111-4111-8111-111111111111"), "event reuse");
    await fails("NC409", () => setStatus("authenticated", BROKER, U2.id, "reserved", 99, "22222222-2222-4222-8222-222222222222"), "version");
    await fails("22023", () => setStatus("authenticated", BROKER, U1.id, "reserved", V1 + 1, "33333333-3333-4333-8333-333333333333"), "same status");
    await fails("22023", () => setStatus("authenticated", BROKER, U1.id, "bogus", V1 + 1, "33333333-3333-4333-8333-333333333334"), "bad status");
    await fails("22023", () => setStatus("authenticated", BROKER, U1.id, "deposited", V1 + 1, "33333333-3333-4333-8333-333333333335"), "deposited не е одобрен");
  });

  await t("T8 брокер не може → sold и не връща назад (42501); админ може; връщане без причина → 22023", async () => {
    await fails("42501", () => setStatus("authenticated", BROKER, U1.id, "sold", V1 + 1), "broker sold");
    await fails("42501", () => setStatus("authenticated", BROKER, U1.id, "free", V1 + 1, null, "причина"), "broker back");
    const r = await setStatus("authenticated", ADMIN, U1.id, "sold", V1 + 1);
    assert.strictEqual(r.status, "sold");
    await fails("22023", () => setStatus("authenticated", ADMIN, U1.id, "reserved", r.version), "back no note");
    const b = await setStatus("authenticated", ADMIN, U1.id, "reserved", r.version, null, "отказана сделка");
    assert.strictEqual(b.status, "reserved");
    const s = await setStatus("authenticated", ADMIN, U1.id, "sold", b.version);
    U1.version = s.version;
    assert.strictEqual((await as("authenticated", BROKER, () => q("select count(*)::int n from nd_unit_events where unit_id=$1", [U1.id])))[0].n, 4);
  });

  await t("T9 едновременни промени: втората със стара версия → 40001; S3 обект с история не се трие (23503)", async () => {
    const v = (await as("authenticated", BROKER, () => q("select version from nd_units where id=$1", [U2.id])))[0].version;
    await setStatus("authenticated", BROKER, U2.id, "reserved", v, "77777777-7777-4777-8777-777777777771");
    await fails("NC409", () => setStatus("authenticated", BROKER2, U2.id, "reserved", v, "77777777-7777-4777-8777-777777777772"), "stale");
    await fails("23503", () => as("authenticated", ADMIN, () => q("delete from nd_units where id=$1", [U1.id])), "delete unit with history");
    await fails("23503", () => as("authenticated", ADMIN, () => q("delete from nd_projects where id=$1", [P.id])), "delete project with history");
    const del = await as("authenticated", BROKER, () => q("delete from nd_units where id=$1 returning id", [U1.id]));
    assert.strictEqual(del.length, 0, "брокерът не трие (RLS)");
  });

  await t("T10 анонимен и не-служител: нищо не четат, нищо не сменят; служител не пише история/задачи/производни директно", async () => {
    await fails("42501", () => as("anon", null, () => q("select * from nd_units")), "anon select");
    await fails("42501", () => as("anon", null, () => q("select nd_unit_set_status('x','sold',1)")), "anon rpc");
    assert.strictEqual((await as("authenticated", VISITOR, () => q("select * from nd_units"))).length, 0);
    await fails("42501", () => setStatus("authenticated", VISITOR, U3.id, "reserved", 1), "visitor rpc");
    await fails("42501", () => as("authenticated", BROKER, () => q("insert into nd_unit_events(unit_id,event_id,to_status) values ($1,gen_random_uuid(),'sold')", [U3.id])), "events");
    await fails("42501", () => as("authenticated", BROKER, () => q("insert into nd_jobs(kind, idempotency_key) values ('import','direct-insert-1')")), "jobs");
    await fails("42501", () => as("authenticated", ADMIN, () => q("insert into nd_plan_files(project_id, unit_id, kind, sig, path, mime, stamped) values ($1,$2,'unit_stamp','1:sold',$3,'image/jpeg',true)", [P.id, U1.id, `projects/${P.id}/private/derived/u-${U1.id}-stamp-v1.jpg`])), "plan files");
    await fails("42501", () => as("anon", null, () => q("select nd_plan_resolve('unit',$1)", [U1.id])), "anon plan resolve");
  });

  await t("S9/T11 публикуване: само проверено съдържание; редакция след прегледа го обезсилва; брокер → 42501", async () => {
    let p = (await as("authenticated", ADMIN, () => q("select * from nd_projects where id=$1", [P.id])))[0];
    await fails("42501", () => as("authenticated", BROKER, () => q("select nd_project_set_status($1,'published',$2,'test-proekt')", [P.id, p.version])), "broker publish");
    await fails("42501", () => as("authenticated", ADMIN, () => q("update nd_projects set status='published' where id=$1", [P.id])), "direct publish");
    await fails("42501", () => as("authenticated", BROKER, () => q("select nd_project_mark_reviewed($1,$2)", [P.id, p.content_rev])), "broker review");
    let r = await as("authenticated", ADMIN, async () => (await q("select nd_project_set_status($1,'published',$2,'test-proekt') as r", [P.id, p.version]))[0].r);
    assert.strictEqual(r.ok, false); assert.ok(r.issues.some((i) => /не е отбелязано като проверено/.test(i)));
    await as("authenticated", ADMIN, () => q("select nd_project_mark_reviewed($1,$2)", [P.id, p.content_rev]));
    await as("authenticated", BROKER, () => q("update nd_units set area_net=45 where id=$1", [U3.id]));   // промяна след прегледа
    p = (await as("authenticated", ADMIN, () => q("select * from nd_projects where id=$1", [P.id])))[0];
    assert.ok(p.content_rev > p.reviewed_rev, "content_rev е нараснал");
    r = await as("authenticated", ADMIN, async () => (await q("select nd_project_set_status($1,'published',$2,'test-proekt') as r", [P.id, p.version]))[0].r);
    assert.strictEqual(r.ok, false);
    await fails("NC409", () => as("authenticated", ADMIN, () => q("select nd_project_mark_reviewed($1,$2)", [P.id, p.reviewed_rev])), "stale review");
    await as("authenticated", ADMIN, () => q("select nd_project_mark_reviewed($1,$2)", [P.id, p.content_rev]));
    await fails("22023", () => as("authenticated", ADMIN, () => q("select nd_project_set_status($1,'published',$2,'Bad Slug!')", [P.id, p.version])), "bad slug");
    r = await as("authenticated", ADMIN, async () => (await q("select nd_project_set_status($1,'published',$2,'test-proekt') as r", [P.id, p.version]))[0].r);
    assert.strictEqual(r.ok, true); assert.strictEqual(r.status, "published");
  });

  await t("R2 публикуван проект: брокер мени описание, но не цени/площи/нови обекти/основа (42501); админ може", async () => {
    await as("authenticated", BROKER, () => q("update nd_projects set data = data || '{\"description\":\"нов текст\"}' where id=$1", [P.id]));
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_units set price_per_m2=1 where id=$1", [U3.id])), "price");
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_units set price_override=true, price_total=1, price_override_reason='xxx' where id=$1", [U3.id])), "override");
    await fails("42501", () => as("authenticated", BROKER, () => q("insert into nd_units(project_id, building_id, floor_id, code) values ($1,$2,$3,'N1')", [P.id, B.id, F.id])), "new unit");
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_projects set data = jsonb_set(data,'{price_policy,basis}','\"net\"') where id=$1", [P.id])), "basis");
    await as("authenticated", BROKER, () => q("update nd_units set data = data || '{\"exposure\":\"юг\"}' where id=$1", [U3.id]));
    await as("authenticated", ADMIN, () => q("update nd_units set price_per_m2=2050 where id=$1", [U3.id]));
  });

  await t("H5/H15/S8 производни: пише само изпълнителят; stamped=false и път извън derived/ → 23514; сервира се само за сегашния подпис", async () => {
    const u = (await as("authenticated", ADMIN, () => q("select * from nd_units where id=$1", [U1.id])))[0]; // sold, plan_rev 1
    const sig = `${u.plan_rev}:${u.status}`;
    await fails("23514", () => svc("insert into nd_plan_files(project_id, unit_id, kind, sig, path, mime, stamped) values ($1,$2,'unit_stamp',$3,$4,'image/jpeg',false)", [P.id, U1.id, sig, `projects/${P.id}/private/derived/u1-stamp.jpg`]), "unstamped");
    await fails("23514", () => svc("insert into nd_plan_files(project_id, unit_id, kind, sig, path, mime, stamped) values ($1,$2,'unit_stamp',$3,$4,'image/jpeg',true)", [P.id, U1.id, sig, planPath(P.id, "A3-02")]), "original path");
    await fails("23514", () => svc("insert into nd_plan_files(project_id, unit_id, kind, sig, path, mime, stamped) values ($1,$2,'unit_stamp',$3,$4,'application/pdf',true)", [P.id, U1.id, sig, `projects/${P.id}/private/derived/u1.pdf`]), "pdf");
    assert.strictEqual((await svc("select nd_plan_resolve('unit',$1) r", [U1.id]))[0].r, null, "без производна → нищо");
    await fails("NC409", () => svc("insert into nd_plan_files(project_id, unit_id, kind, sig, path, mime, stamped) values ($1,$2,'unit_stamp','1:reserved',$3,'image/jpeg',true)", [P.id, U1.id, `projects/${P.id}/private/derived/u1-stamp-1-reserved.jpg`]), "C06 производна за НЕсегашен статус");
    await fails("NC409", () => svc("insert into nd_plan_files(project_id, unit_id, kind, sig, path, mime, stamped) values ($1,$2,'unit_wm',$3,$4,'image/jpeg',true)", [P.id, U1.id, sig, `projects/${P.id}/private/derived/u1-wm-as-sold.jpg`]), "C06 вид „воден знак“ за продаден обект");
    await svc("insert into nd_plan_files(project_id, unit_id, kind, sig, path, mime, stamped) values ($1,$2,'unit_stamp',$3,$4,'image/jpeg',true)", [P.id, U1.id, sig, `projects/${P.id}/private/derived/u1-stamp-1-sold.jpg`]);
    const r = (await svc("select nd_plan_resolve('unit',$1) r", [U1.id]))[0].r;
    assert.ok(r && r.path.endsWith("u1-stamp-1-sold.jpg") && r.kind === "unit_stamp");
    await fails("NC409", () => svc("insert into nd_plan_files(project_id, unit_id, kind, sig, path, mime, stamped) values ($1,$2,'unit_wm','1:free',$3,'image/jpeg',true)", [P.id, U3.id, `projects/${P.id}/private/derived/u3-wm-1-free.jpg`]), "U3 е reserved → производна за free не се приема");
    // нов оригинал → plan_rev +1 → старата производна отпада
    await as("authenticated", ADMIN, () => q("update nd_units set data = jsonb_set(data,'{plan,private}',to_jsonb($2::text)) where id=$1", [U1.id, planPath(P.id, "A3-02-v2")]));
    assert.strictEqual((await svc("select nd_plan_resolve('unit',$1) r", [U1.id]))[0].r, null, "нов план → нова производна е нужна");
    assert.ok((await svc("select 1 from nd_jobs where idempotency_key=$1", [`pd:u:${U1.id}:2:sold`])).length === 1, "заявка за новата производна");
  });

  await t("T12 публичен RPC: само изброени полета; без път към план; продаден без цена; капариран без панорами; has_plan по подпис", async () => {
    await svc("insert into nd_project_media(project_id, kind, path) values ($1,'cover',$2)", [P.id, `projects/${P.id}/public/cover.jpg`]);
    await svc("insert into nd_project_media(project_id, unit_id, kind, path) values ($1,$2,'tour',$3)", [P.id, U3.id, `projects/${P.id}/private/tours/a3-04/pano1.jpg`]);
    const r = await as("anon", null, async () => (await q("select nd_public_project('test-proekt') as r"))[0].r);
    const txt = JSON.stringify(r);
    assert.ok(!/private\/(plans|units|cad|imports|tours)/.test(txt), "няма частен път");
    assert.ok(!/investor|builder|contractor|reviewed|client|deal|note/i.test(txt));
    assert.strictEqual(r.title, "TEST-Проект"); assert.ok(r.cover.endsWith("/public/cover.jpg"));
    const sold = r.units.find((u) => u.code === "A3-02"), res = r.units.find((u) => u.code === "A3-04");
    assert.strictEqual(sold.status, "sold"); assert.strictEqual(sold.price_total, null); assert.strictEqual(sold.has_plan, false); assert.strictEqual(sold.plan_kind, "stamped");
    assert.strictEqual(res.status, "reserved"); assert.strictEqual(res.tour_count, 0); assert.ok(res.price_total !== null);
    assert.strictEqual(r.buildings[0].floors[0].polygons[0].unit_code, "A3-02");
    assert.strictEqual(r.buildings[0].floors[0].has_plan, false);
    assert.strictEqual((await as("anon", null, async () => (await q("select nd_public_project('nyama-takav') as r"))[0].r)), null);
    assert.strictEqual((await as("anon", null, () => q("select nd_public_projects() as r"))).length, 1);
  });

  await t("H6/H7/S11/S12 storage: само вписана от админ медия под /public/; LIKE-трикове не минават; брокер не вписва медия", async () => {
    await fails("42501", () => as("authenticated", BROKER, () => q("insert into nd_project_media(project_id, kind, path) values ($1,'gallery',$2)", [P.id, `projects/${P.id}/public/g1.jpg`])), "broker media");
    await fails("23514", () => as("authenticated", ADMIN, () => q("insert into nd_project_media(project_id, kind, path) values ($1,'gallery',$2)", [P.id, `projects/${P.id}/private/units/public/plan.pdf`])), "private/…/public");
    await fails("23514", () => as("authenticated", ADMIN, () => q("insert into nd_project_media(project_id, kind, path) values ($1,'gallery',$2)", [P.id, `projects/${P2.id}/public/x.jpg`])), "other project");
    await fails("23503", () => as("authenticated", ADMIN, () => q("insert into nd_project_media(project_id, building_id, kind, path) values ($1,$2,'model',$3)", [P.id, B2.id, `projects/${P.id}/public/m.glb`])), "building of other project (FK)");
    await as("authenticated", ADMIN, () => q("insert into nd_project_media(project_id, kind, path) values ($1,'gallery',$2)", [P.id, `projects/${P.id}/public/g1.jpg`]));
    const paths = [`projects/${P.id}/public/cover.jpg`, `projects/${P.id}/public/g1.jpg`, `projects/${P.id}/public/unlisted.jpg`,
      `projects/${P.id}/private/units/public/plan.pdf`, `projects/${P.id}/private/public/x.jpg`, `projects/${P.id}/private/tours/a3-04/pano1.jpg`,
      `projects/${P.id}/private/derived/u1-stamp-1-sold.jpg`, planPath(P.id, "A3-02"), `projects/${P2.id}/public/cover.jpg`];
    await svc("delete from storage.objects");
    for (const n of paths) await svc("insert into storage.objects(bucket_id, name) values ('nd-files', $1)", [n]);
    const vis = (await as("anon", null, () => q("select name from storage.objects order by name"))).map((x) => x.name.split("/").slice(2).join("/"));
    assert.deepStrictEqual(vis, ["public/cover.jpg", "public/g1.jpg"]);
    assert.strictEqual((await svc("select nd_is_public_project_file($1) ok", [`projects/${P.id}/private/units/public/plan.pdf`]))[0].ok, false);
    await as("authenticated", ADMIN, () => q("delete from nd_project_media where path=$1", [`projects/${P.id}/public/g1.jpg`]));
    assert.strictEqual((await as("anon", null, () => q("select name from storage.objects"))).length, 1, "премахната медия → невидима");
  });

  await t("пано: само за свободен обект в публикуван проект; след капариране → нищо", async () => {
    const u = (await as("authenticated", ADMIN, () => q("select * from nd_units where id=$1", [U3.id])))[0]; // reserved
    assert.strictEqual((await svc("select nd_pano_resolve($1,0) r", [U3.id]))[0].r, null);
    const back = await setStatus("authenticated", ADMIN, U3.id, "free", u.version, null, "отказано капаро");
    await svc("insert into nd_plan_files(project_id, unit_id, kind, sig, path, mime, stamped) values ($1,$2,'unit_wm','1:free',$3,'image/jpeg',true)", [P.id, U3.id, `projects/${P.id}/private/derived/u3-wm-1-free.jpg`]);
    const r = (await svc("select nd_pano_resolve($1,0) r", [U3.id]))[0].r;
    assert.ok(r && r.path.endsWith("pano1.jpg"));
    assert.strictEqual((await svc("select nd_pano_resolve($1,1) r", [U3.id]))[0].r, null);
    const pub = await as("anon", null, async () => (await q("select nd_public_project('test-proekt') as r"))[0].r);
    assert.strictEqual(pub.units.find((x) => x.code === "A3-04").tour_count, 1);
    assert.strictEqual(pub.units.find((x) => x.code === "A3-04").has_plan, true, "производната за 1:free вече важи");
    await setStatus("authenticated", BROKER, U3.id, "reserved", back.version);
    assert.strictEqual((await svc("select nd_pano_resolve($1,0) r", [U3.id]))[0].r, null);
    assert.strictEqual((await svc("select nd_plan_resolve('unit',$1) r", [U3.id]))[0].r, null, "капариран → производната за free не се сервира");
  });

  await t("C09/C10 байтовете: служител не пише в private/derived/; в public/ и private/tours/ – само админ; останалото остава както досега", async () => {
    // имитация на живите „nd files staff *“ политики: служител пише в целия bucket
    await db.exec(`create policy "nd files staff insert" on storage.objects for insert to authenticated with check (bucket_id = 'nd-files' and public.nd_is_staff());
                   create policy "nd files staff update" on storage.objects for update to authenticated using (bucket_id = 'nd-files' and public.nd_is_staff());
                   create policy "nd files staff delete" on storage.objects for delete to authenticated using (bucket_id = 'nd-files' and public.nd_is_staff());
                   create policy "nd files staff select" on storage.objects for select to authenticated using (bucket_id = 'nd-files' and public.nd_is_staff());`);
    const ins = (role, uid, name) => as(role, uid, () => q("insert into storage.objects(bucket_id, name) values ('nd-files', $1)", [name]));
    await fails("42501", () => ins("authenticated", BROKER, `projects/${P.id}/private/derived/x.jpg`), "broker → derived");
    await fails("42501", () => ins("authenticated", ADMIN, `projects/${P.id}/private/derived/x.jpg`), "admin → derived");
    await fails("42501", () => ins("authenticated", BROKER, `projects/${P.id}/public/x.jpg`), "broker → public");
    await fails("42501", () => ins("authenticated", BROKER, `projects/${P.id}/private/tours/a/x.jpg`), "broker → tours");
    await ins("authenticated", ADMIN, `projects/${P.id}/public/admin.jpg`);
    await ins("authenticated", BROKER, `projects/${P.id}/private/units/A3-02/plan-new.jpg`);
    await ins("authenticated", BROKER, `properties/P-1001/photos/1.jpg`);
    await ins("authenticated", BROKER, `clients/c1/doc.pdf`);
    await ins("service_role", null, `projects/${P.id}/private/derived/ok.jpg`);
    const upd = await as("authenticated", BROKER, () => q("update storage.objects set name = name where name like $1 returning name", [`projects/${P.id}/private/derived/%`]));
    assert.strictEqual(upd.length, 0, "брокер не презаписва производна");
    const del = await as("authenticated", BROKER, () => q("delete from storage.objects where name like $1 returning name", [`projects/${P.id}/public/%`]));
    assert.strictEqual(del.length, 0, "брокер не трие публична медия");
  });

  await t("A19 изведеният event_id е личен: чужд повтор не е „ok“; F02 варианти на забранения ключ се отказват; G07 брокер не отменя системна задача", async () => {
    const v = await ver(U3.id);   // U3 е reserved (от BROKER, без event_id)
    await fails("NC409", () => setStatus("authenticated", BROKER2, U3.id, "reserved", v - 1), "чужд повтор със стара версия");
    for (const k of ["investor_name", "investorName", " investor", "ИНВЕСТИТОР", "Строителя", "builder-company"]) {
      await fails("23514", () => as("authenticated", BROKER, () => q("update nd_buildings set data = jsonb_build_object($2::text, 'x') where id=$1", [B2.id, k])), "ключ " + k);
    }
    await as("authenticated", BROKER, () => q("update nd_buildings set data = '{\"construction_stage\":\"груб строеж\",\"етап_на_строителството\":\"покрив\"}' where id=$1", [B2.id]));
    const sys = (await svc("select id from nd_jobs where actor_kind='system' and status='queued' limit 1"))[0];
    if (sys) await fails("42501", () => as("authenticated", BROKER, () => q("select nd_job_cancel($1)", [sys.id])), "broker cancels system job");
    await fails("42501", () => as("authenticated", BROKER, () => q("select nd_job_create('plan_derivative','xx:fake:key:1',$1,'{}')", [P.id])), "G01 plan_derivative е само системен");
  });

  await t("етажен план: подписът зависи от статусите; производна за стар подпис не се сервира", async () => {
    const sig = (await svc("select nd_floor_plan_sig($1) s", [F.id]))[0].s;
    await svc("insert into nd_plan_files(project_id, floor_id, kind, sig, path, mime, stamped) values ($1,$2,'floor',$3,$4,'image/png',true)", [P.id, F.id, sig, `projects/${P.id}/private/derived/floor-${F.id}.png`]);
    assert.ok((await svc("select nd_plan_resolve('floor',$1) r", [F.id]))[0].r);
    const u = (await as("authenticated", ADMIN, () => q("select * from nd_units where id=$1", [U2.id])))[0];
    await setStatus("authenticated", ADMIN, U2.id, "sold", u.version);
    assert.strictEqual((await svc("select nd_plan_resolve('floor',$1) r", [F.id]))[0].r, null, "статусите се смениха → етажният план чака нова производна");
    assert.notStrictEqual((await svc("select nd_floor_plan_sig($1) s", [F.id]))[0].s, sig);
  });

  await t("архив: публичният RPC и storage спират веднага", async () => {
    const p = (await as("authenticated", ADMIN, () => q("select * from nd_projects where id=$1", [P.id])))[0];
    await as("authenticated", ADMIN, () => q("select nd_project_set_status($1,'archived',$2,null)", [P.id, p.version]));
    assert.strictEqual((await as("anon", null, () => q("select name from storage.objects"))).length, 0);
    assert.strictEqual((await as("anon", null, async () => (await q("select nd_public_project('test-proekt') as r"))[0].r)), null);
    assert.strictEqual((await svc("select nd_plan_resolve('unit',$1) r", [U1.id]))[0].r, null);
  });

  let J;
  await t("H9/S7 задачи: само през nd_job_create; тежките – само админ; повтор връща същата; чужд ключ → 23505; статус/резултат не идват от клиента", async () => {
    await fails("42501", () => as("authenticated", BROKER, () => q("insert into nd_jobs(kind, idempotency_key, status, result) values ('import','imp:hack:1','review','{\"x\":1}')")), "direct insert");
    const a = await as("authenticated", BROKER, async () => (await q("select nd_job_create('import','imp:abc:v1',$1,'{\"files\":[\"a.xlsx\"]}') r", [P.id]))[0].r);
    assert.strictEqual(a.created, true); assert.strictEqual(a.status, "queued"); J = a;
    const b = await as("authenticated", BROKER, async () => (await q("select nd_job_create('import','imp:abc:v1',$1,'{}') r", [P.id]))[0].r);
    assert.strictEqual(b.created, false); assert.strictEqual(b.id, a.id);
    await fails("23505", () => as("authenticated", BROKER2, () => q("select nd_job_create('import','imp:abc:v1',$1,'{}')", [P.id])), "foreign key reuse");
    await fails("42501", () => as("authenticated", BROKER, () => q("select nd_job_create('cad_convert','cad:abc:v1',$1,'{}')", [P.id])), "heavy by broker");
    await fails("22023", () => as("authenticated", BROKER, () => q("select nd_job_create('import','pd:u:x:1:free',$1,'{}')", [P.id])), "reserved prefix");
    await fails("22023", () => as("authenticated", BROKER, () => q("select nd_job_create('import','imp:inv:1',$1,'{\"meta\":{\"investor\":\"x\"}}')", [P.id])), "investor in input");
    const h = await as("authenticated", ADMIN, async () => (await q("select nd_job_create('cad_convert','cad:abc:v1',$1,'{}') r", [P.id]))[0].r);
    assert.strictEqual(h.created, true);
    const row = (await as("authenticated", ADMIN, () => q("select * from nd_jobs where id=$1", [h.id])))[0];
    assert.strictEqual(Number(row.budget_usd), 0); assert.strictEqual(row.max_attempts, 2); assert.strictEqual(row.actor_kind, "user");
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_jobs set status='done' where id=$1", [J.id])), "direct update");
    await fails("42501", () => as("authenticated", BROKER, () => q("select nd_job_claim(array['import'],'w1')")), "staff claim");
    assert.strictEqual((await as("authenticated", BROKER, () => q("update nd_job_kinds set budget_usd=5 where kind='import' returning kind"))).length, 0, "бюджета мени само админ");
  });

  await t("H11/J1 изпълнителят връща в опашката само СВОИТЕ видове и само след прага на вида; J3 спиране ≠ опит", async () => {
    const cad = (await svc("select * from nd_jobs where kind='cad_convert'"))[0];
    const c = (await svc("select id from nd_job_claim(array['cad_convert','cad_inspect','tour_render'],'heavy-1')"))[0];
    assert.strictEqual(c.id, cad.id);
    await svc("update nd_jobs set heartbeat_at = now() - interval '20 minutes', locked_at = now() - interval '20 minutes' where id=$1", [cad.id]);
    await svc("select nd_job_claim(array['import','plan_derivative'],'light-1')");
    let row = (await svc("select * from nd_jobs where id=$1", [cad.id]))[0];
    assert.strictEqual(row.status, "running", "лекият изпълнител не пипа тежката задача");
    await svc("select nd_job_claim(array['cad_convert'],'heavy-2')");  // 20 мин < 3600 s праг за cad_convert
    row = (await svc("select * from nd_jobs where id=$1", [cad.id]))[0];
    assert.strictEqual(row.status, "running", "под прага на вида → не се връща");
    await svc("update nd_jobs set heartbeat_at = now() - interval '2 hours' where id=$1", [cad.id]);
    await svc("select nd_job_claim(array['cad_convert'],'heavy-2')");
    row = (await svc("select * from nd_jobs where id=$1", [cad.id]))[0];
    assert.ok(["queued", "running"].includes(row.status));
    assert.strictEqual(row.crash_count, 1); assert.strictEqual(row.attempts, row.status === "running" ? 1 : 0, "спирането не изгаря опит");
    assert.strictEqual((await svc("select nd_job_heartbeat($1,'heavy-1',null) stop", [cad.id]))[0].stop, true, "старият изпълнител получава 'спри'");
  });

  await t("H12/J2 парчета: nd_job_yield връща задачата веднага, без разход на опит; брои парчета; отмяната спира при следващото парче", async () => {
    let j = (await svc("select * from nd_job_claim(array['import'],'light-1')"))[0];
    assert.strictEqual(j.id, J.id); assert.strictEqual(j.attempts, 1);
    for (let i = 0; i < 5; i++) {
      await svc("select nd_job_yield($1,'light-1',$2)", [J.id, JSON.stringify({ step: i })]);
      j = (await svc("select * from nd_job_claim(array['import'],'light-1')"))[0];
      assert.strictEqual(j.id, J.id, "същата задача се взима пак");
    }
    assert.strictEqual(j.attempts, 1, "5 парчета = 1 опит"); assert.strictEqual(j.chunks, 5); assert.strictEqual(j.status, "running");
    await fails("42501", () => svc("select nd_job_yield($1,'someone-else',null)", [J.id]), "чужд изпълнител");
    const can = await as("authenticated", BROKER, async () => (await q("select nd_job_cancel($1) r", [J.id]))[0].r);
    assert.strictEqual(can.cancel_requested, true);
    assert.strictEqual((await svc("select nd_job_heartbeat($1,'light-1',null) stop", [J.id]))[0].stop, true);
    j = (await svc("select * from nd_job_yield($1,'light-1',null)", [J.id]))[0];
    assert.strictEqual(j.status, "cancelled");
  });

  await t("бюджет и край: разход над бюджета → failed без нов опит; failed с оставащи опити → queued; done записва резултата", async () => {
    const x = await as("authenticated", ADMIN, async () => (await q("select nd_job_create('import','imp:budget:1',$1,'{}') r", [P.id]))[0].r);
    let j = (await svc("select * from nd_job_claim(array['import'],'w')"))[0];
    assert.strictEqual(j.id, x.id);
    j = (await svc("select * from nd_job_finish($1,'w','done','{\"ok\":1}',null,0.5)", [x.id]))[0];
    assert.strictEqual(j.status, "failed"); assert.ok(/бюджет/.test(j.error));
    await svc("update nd_job_kinds set budget_usd=1 where kind='import'");
    const y = await as("authenticated", ADMIN, async () => (await q("select nd_job_create('import','imp:budget:2',$1,'{}') r", [P.id]))[0].r);
    j = (await svc("select * from nd_job_claim(array['import'],'w')"))[0];
    j = (await svc("select * from nd_job_finish($1,'w','failed',null,'грешка',0.1)", [y.id]))[0];
    assert.strictEqual(j.status, "queued"); assert.strictEqual(j.attempts, 1); assert.ok(new Date(j.next_attempt_at) > new Date());
    await svc("update nd_jobs set next_attempt_at=now() where id=$1", [y.id]);
    j = (await svc("select * from nd_job_claim(array['import'],'w')"))[0];
    j = (await svc("select * from nd_job_finish($1,'w','done','{\"rows\":3}',null,0.2)", [y.id]))[0];
    assert.strictEqual(j.status, "done"); assert.strictEqual(j.result.rows, 3); assert.strictEqual(Number(j.cost_usd), 0.3);
    await fails("42501", () => svc("select nd_job_finish($1,'w','done',null,null,0)", [y.id]), "finish twice");
  });

  await t("H10 екипът вижда задачите (екипен модел), но не и служебните колони за писане", async () => {
    const rows = await as("authenticated", BROKER2, () => q("select id, kind, status from nd_jobs"));
    assert.ok(rows.length >= 3);
    await fails("42501", () => as("authenticated", BROKER2, () => q("update nd_jobs set budget_usd=100 where id=$1", [J.id])), "budget");
  });

  await t("content_rev расте при промяна на обект/сграда/етаж; версията на проекта – само при промяна на самия проект", async () => {
    const before = (await as("authenticated", ADMIN, () => q("select version, content_rev from nd_projects where id=$1", [P2.id])))[0];
    await as("authenticated", BROKER, () => q("update nd_buildings set name='Сграда B2' where id=$1", [B2.id]));
    await as("authenticated", BROKER, () => q("insert into nd_units(project_id, building_id, floor_id, code) values ($1,$2,$3,'B1-01')", [P2.id, B2.id, F2.id]));
    const after = (await as("authenticated", ADMIN, () => q("select version, content_rev from nd_projects where id=$1", [P2.id])))[0];
    assert.strictEqual(after.version, before.version); assert.strictEqual(after.content_rev, before.content_rev + 2);
    await as("authenticated", BROKER, () => q("update nd_projects set name='Друг 2' where id=$1", [P2.id]));
    const last = (await as("authenticated", ADMIN, () => q("select version, content_rev from nd_projects where id=$1", [P2.id])))[0];
    assert.strictEqual(last.version, before.version + 1); assert.strictEqual(last.content_rev, before.content_rev + 3);
  });

  /* ---------- TASK-006 · nc_004: импорт ---------- */
  let PI, JI;
  const reviewJob = async (uid, pid, key) => {
    const r = await as("authenticated", uid, () => q("select nd_job_create('import',$1,$2,'{}'::jsonb) as r", [key, pid]));
    const id = r[0].r.id;
    const c = await svc("select id from nd_job_claim_id($1, array['import'], 'w-test')", [id]);
    assert.strictEqual(c[0].id, id, "claim_id взима точно тази задача");
    await svc("select id from nd_job_finish($1, 'w-test', 'review', '{\"state\":\"needs_review\"}'::jsonb, null, 0)", [id]);
    return id;
  };
  const rev = async (pid) => (await svc("select content_rev from nd_projects where id=$1", [pid]))[0].content_rev;
  const applyAs = (role, uid, job, pid, r, payload) => as(role, uid, async () => (await q("select nd_import_apply($1,$2,$3,$4) as r", [job, pid, r, JSON.stringify(payload)]))[0].r);
  const imp = (pid) => `projects/${pid}/private/imports/aaaaaaaa11112222/0001-plan.png`;
  const payload1 = (pid) => ({ buildings: [{ ref: "b1", name: "TEST-Вход А", data: { import: { job: "j", src: { name: "f1:Обекти!B4" } } } }],
    floors: [{ ref: "f1", building_ref: "b1", level: 1, label: null, data: { import: { src: { level: "f1:Обекти!C4" } } } }],
    units: [{ ref: "u1", floor_ref: "f1", code: "TEST-I1", area_total: 102.70, area_net: 88.10, price_per_m2: 2100, price_override: false, status: "sold", data: { rooms: 3, plan: { private: imp(pid) }, import: { src: { area_total: "f1:Обекти!D4" } } } },
            { ref: "u2", floor_ref: "f1", code: "TEST-I2", area_total: 60, price_override: true, price_total: 120000, price_override_reason: "по импорт – обща цена от файла", data: { import: { manual: { price_total: { by: "x" } } } } }] });

  await t("I1 nc_004: изпълнителят взима ТОЧНО своята задача (claim_id); повторно – нищо; служител не може да вика claim_id (42501)", async () => {
    await as("authenticated", BROKER, async () => { PI = (await q("insert into nd_projects(name, data) values ('TEST-Импорт', '{\"title\":\"TEST-Импорт\"}') returning *"))[0]; });
    const r = await as("authenticated", BROKER, () => q("select nd_job_create('import','import:test:claim:0001',$1,'{}'::jsonb) as r", [PI.id]));
    const id = r[0].r.id;
    const c1 = await svc("select id, status, locked_by from nd_job_claim_id($1, array['import'], 'w-1')", [id]);
    assert.strictEqual(c1[0].id, id); assert.strictEqual(c1[0].status, "running");
    const c2 = await svc("select id from nd_job_claim_id($1, array['import'], 'w-2')", [id]);
    assert.strictEqual(c2[0].id, null, "заета задача не се взима втори път");
    await fails("42501", () => as("authenticated", BROKER, () => q("select nd_job_claim_id($1, array['import'], 'x')", [id])), "служител");
    // спрял изпълнител → връща се в опашката с изчакване (не веднага), опитът не се брои
    await svc("update nd_jobs set heartbeat_at = now() - interval '10 minutes' where id=$1", [id]);
    const c3 = await svc("select id from nd_job_claim_id($1, array['import'], 'w-3')", [id]);
    assert.strictEqual(c3[0].id, null);
    const st = (await svc("select status, crash_count, next_attempt_at > now() as later from nd_jobs where id=$1", [id]))[0];
    assert.deepStrictEqual([st.status, st.crash_count, st.later], ["queued", 1, true]);
  });

  await t("I2 nc_004: прекият опит да се маркира импорт като записан без nd_import_apply → 42501; чужд служител не записва (42501)", async () => {
    JI = await reviewJob(BROKER, PI.id, "import:test:apply:0001");
    await fails("42501", () => as("authenticated", BROKER, () => q("select nd_import_job_done($1, '{}'::jsonb)", [JI])), "direct done");
    await fails("42501", async () => applyAs("authenticated", BROKER2, JI, PI.id, await rev(PI.id), payload1(PI.id)), "чужд брокер");
    await fails("42501", () => applyAs("anon", null, JI, PI.id, 1, payload1(PI.id)), "анонимен");
    assert.strictEqual((await svc("select status from nd_jobs where id=$1", [JI]))[0].status, "review");
  });

  await t("I3 nc_004: брокер записва черновата в ЕДНА транзакция под своите права; статусът винаги free; цената смята базата; ръчна цена с причина; произход в data.import; задача → done", async () => {
    const r = await applyAs("authenticated", BROKER, JI, PI.id, await rev(PI.id), payload1(PI.id));
    assert.deepStrictEqual(r.created, { buildings: 1, floors: 1, units: 2 }); assert.strictEqual(r.replayed, false);
    const u = await svc("select code, status, price_total, price_override, data from nd_units where project_id=$1 order by code", [PI.id]);
    assert.strictEqual(u.length, 2); assert.ok(u.every((x) => x.status === "free"), "статусът не идва от импорта");
    assert.strictEqual(Number(u[0].price_total), 215670, "102,70 × 2100 = 215 670 (смята базата)");
    assert.strictEqual(Number(u[1].price_total), 120000); assert.strictEqual(u[1].price_override, true);
    assert.strictEqual(u[0].data.import.ref, "u1"); assert.strictEqual(u[0].data.import.src.area_total, "f1:Обекти!D4");
    const j = (await svc("select status, result from nd_jobs where id=$1", [JI]))[0];
    assert.strictEqual(j.status, "done"); assert.deepStrictEqual(j.result.applied.created, { buildings: 1, floors: 1, units: 2 });
    const pd = await svc("select count(*)::int n from nd_jobs where kind='plan_derivative' and project_id=$1", [PI.id]);
    assert.ok(pd[0].n >= 1, "планът поражда заявка за производна (TASK-007 механизъм)");
  });

  await t("I4 nc_004: повтор на същия запис → същата разписка, без дубликати (идемпотентно)", async () => {
    const r = await applyAs("authenticated", BROKER, JI, PI.id, 1, payload1(PI.id));
    assert.strictEqual(r.replayed, true); assert.deepStrictEqual(r.created, { buildings: 1, floors: 1, units: 2 });
    assert.strictEqual((await svc("select count(*)::int n from nd_units where project_id=$1", [PI.id]))[0].n, 2);
    assert.strictEqual((await svc("select count(*)::int n from nd_buildings where project_id=$1", [PI.id]))[0].n, 1);
  });

  await t("I5 nc_004: стара версия на проекта → NC409 и НИЩО не е записано; грешка в средата на записа → връщане на всичко (без частичен запис)", async () => {
    const J2 = await reviewJob(BROKER, PI.id, "import:test:apply:0002");
    const p2 = { buildings: [{ ref: "b9", name: "TEST-Вход Б" }], floors: [{ ref: "f9", building_ref: "b9", level: 2 }], units: [{ ref: "u9", floor_ref: "f9", code: "TEST-I9", area_total: 50 }] };
    await fails("NC409", async () => applyAs("authenticated", BROKER, J2, PI.id, (await rev(PI.id)) - 1, p2), "content_rev");
    const bad = JSON.parse(JSON.stringify(p2)); bad.units.push({ ref: "u10", floor_ref: "f9", code: "TEST-I10", area_total: 50, area_net: 60 });
    await fails("23514", async () => applyAs("authenticated", BROKER, J2, PI.id, await rev(PI.id), bad), "net>total в средата");
    const forb = JSON.parse(JSON.stringify(p2)); forb.units[0].data = { investor: "TEST" };
    await fails("23514", async () => applyAs("authenticated", BROKER, J2, PI.id, await rev(PI.id), forb), "забранено поле");
    assert.strictEqual((await svc("select count(*)::int n from nd_buildings where project_id=$1", [PI.id]))[0].n, 1, "няма частично записана сграда");
    assert.strictEqual((await svc("select count(*)::int n from nd_units where project_id=$1", [PI.id]))[0].n, 2);
    assert.strictEqual((await svc("select status from nd_jobs where id=$1", [J2]))[0].status, "review", "задачата чака преглед");
    // обновяване на съществуващ обект: само при същата версия
    const u1 = (await svc("select id, version from nd_units where project_id=$1 and code='TEST-I1'", [PI.id]))[0];
    const upd = { units_update: [{ id: u1.id, expected_version: u1.version + 5, set: { area_total: 103.1 }, data_patch: {} }] };
    await fails("NC409", async () => applyAs("authenticated", BROKER, J2, PI.id, await rev(PI.id), upd), "стара версия на обект");
    const ok = await applyAs("authenticated", BROKER, J2, PI.id, await rev(PI.id), { units_update: [{ id: u1.id, expected_version: u1.version, set: { area_total: 103.1 }, data_patch: { import: { job: "J2" } } }] });
    assert.strictEqual(ok.updated.units, 1);
    const after = (await svc("select area_total, price_total, status from nd_units where id=$1", [u1.id]))[0];
    assert.strictEqual(Number(after.area_total), 103.1); assert.strictEqual(Number(after.price_total), 216510); assert.strictEqual(after.status, "free");
  });

  await t("I6 nc_004: отменен импорт не се записва (NC409); в ПУБЛИКУВАН проект брокер не добавя обекти (42501, всичко се връща), администратор – да", async () => {
    const J3 = await reviewJob(BROKER, PI.id, "import:test:apply:0003");
    await as("authenticated", BROKER, () => q("select nd_job_cancel($1)", [J3]));
    await fails("NC409", async () => applyAs("authenticated", BROKER, J3, PI.id, await rev(PI.id), { units: [] }), "отменен");
    await svc("update nd_projects set status='published', slug='test-import-pub' where id=$1", [PI.id]);
    const J4 = await reviewJob(BROKER, PI.id, "import:test:apply:0004");
    const fl = (await svc("select id from nd_floors where project_id=$1 limit 1", [PI.id]))[0];
    const p4 = { units: [{ ref: "u4", floor_id: fl.id, code: "TEST-I4", area_total: 70 }] };
    await fails("42501", async () => applyAs("authenticated", BROKER, J4, PI.id, await rev(PI.id), p4), "брокер в публикуван");
    assert.strictEqual((await svc("select count(*)::int n from nd_units where project_id=$1", [PI.id]))[0].n, 2);
    const J5 = await reviewJob(ADMIN, PI.id, "import:test:apply:0005");
    const r5 = await applyAs("authenticated", ADMIN, J5, PI.id, await rev(PI.id), p4);
    assert.strictEqual(r5.created.units, 1);
    await svc("update nd_projects set status='draft', slug=null where id=$1", [PI.id]);
  });

  await t("I7 nc_004: 3000 обекта в една транзакция (време се записва; лимитът на живата база е 8 s за authenticated)", async () => {
    const J6 = await reviewJob(BROKER, PI.id, "import:test:apply:0006");
    const units = []; for (let k = 0; k < 3000; k++) units.push({ ref: "u" + k, floor_ref: "fb" + (k % 30), code: "TEST-B" + k, area_total: 50 + (k % 40), area_net: 40, price_per_m2: 1800 + k % 300, data: { rooms: 2, import: { src: { area_total: "f1:Лист!D" + (k + 2) } } } });
    const floors = []; for (let k = 0; k < 30; k++) floors.push({ ref: "fb" + k, building_ref: "bb", level: k });
    const t0 = Date.now();
    const r = await applyAs("authenticated", BROKER, J6, PI.id, await rev(PI.id), { buildings: [{ ref: "bb", name: "TEST-Блок Б" }], floors, units });
    const ms = Date.now() - t0;
    assert.strictEqual(r.created.units, 3000);
    results.push(["INFO", "I7 време за 3000 обекта в PGlite: " + ms + " ms (PGlite е по-бавен от истинския Postgres)"]);
  });

  await t("I8 nc_004_import_down.sql: схемата се връща ТОЧНО както преди nc_004; данните (проекти, обекти, задачи) остават; импортът спира с 42883 (→ 503); повторно nc_004 → работи", async () => {
    const cnt = async () => (await svc("select (select count(*) from nd_projects)::int p, (select count(*) from nd_units)::int u, (select count(*) from nd_jobs)::int j, (select count(*) from nd_buildings)::int b"))[0];
    const c0 = await cnt(), pre = await catalog();               // (между M4 и тук други тестове добавят свои обекти – сравнява се спрямо момента преди връщането)
    await db.exec(SQL("nc_004_import_down.sql"));
    const now = await catalog();
    assert.deepStrictEqual(now.filter((x) => !pre.includes(x)), [], "връщането не добавя нищо");
    assert.deepStrictEqual(pre.filter((x) => !now.includes(x)), added004, "маха ТОЧНО 4-те обекта на nc_004 и нищо друго");
    assert.deepStrictEqual(before004.filter((x) => !now.includes(x)), [], "всичко отпреди nc_004 е на мястото си");
    assert.deepStrictEqual(await cnt(), c0, "данните са непокътнати");
    const J7 = await (async () => { const r = await as("authenticated", BROKER, () => q("select nd_job_create('import','import:test:down:0007',$1,'{}'::jsonb) as r", [PI.id])); return r[0].r.id; })();
    await fails("42883", () => applyAs("authenticated", BROKER, J7, PI.id, 1, { units: [] }), "без nc_004 записът не съществува");
    await db.exec(SQL("nc_004_import_down.sql"));                       // повторното връщане е безопасно (if exists)
    await db.exec(SQL("nc_004_import.sql"));
    assert.deepStrictEqual((await catalog()).filter((x) => !now.includes(x)), added004, "nc_004 се прилага отново – същите 4 функции със същите права");
    const c = await svc("select id from nd_job_claim_id($1, array['import'], 'w-down')", [J7]);
    assert.strictEqual(c[0].id, J7, "след повторното прилагане изпълнителят работи");
  });

  await t("H18/S13 съществуващите таблици са непипнати; повторно прилагане върху заварена схема спира шумно (42723/42P07)", async () => {
    assert.deepStrictEqual(await q("select * from nd_properties"), [{ id: "p1", data: { status: "Публикуван" } }]);
    const nProj = (await q("select count(*)::int n from nd_projects"))[0].n;
    let code = null; try { await db.exec(SQL("nc_001_new_construction.sql")); } catch (e) { code = e.code; }
    await db.exec("rollback").catch(() => {});
    assert.ok(code === "42723" || code === "42P07", "повторното прилагане трябва да спре, получено: " + code);
    assert.strictEqual((await q("select count(*)::int n from nd_projects"))[0].n, nProj, "данните са непокътнати");
    await db.exec("rollback").catch(() => {});
  });

  await t("T17 обратен скрипт: up → down → up → down; нищо чуждо не остава, нищо чуждо не е пипнато", async () => {
    await db.exec(SQL("nc_001_down.sql"));
    const n1 = (await q("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','i','S')"))[0].n;
    const f1 = (await q("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"))[0].n;
    assert.strictEqual(n1, baseline); assert.strictEqual(f1, baseFn);
    assert.strictEqual((await q("select count(*)::int n from pg_policies where tablename='objects' and policyname='nd public project files'"))[0].n, 0);
    await db.exec(SQL("nc_001_new_construction.sql")); await db.exec(SQL("nc_002_jobs_rpc.sql"));
    assert.strictEqual((await q("select count(*)::int n from nd_projects"))[0].n, 0);
    await db.exec(SQL("nc_001_down.sql"));
    assert.deepStrictEqual(await q("select * from nd_properties"), [{ id: "p1", data: { status: "Публикуван" } }]);
    assert.strictEqual((await q("select count(*)::int n from nd_staff"))[0].n, 3);
  });

  const pg = (await q("select version() v"))[0].v.split(" on ")[0];
  const pass = results.filter((r) => r[0] === "PASS").length, total = results.filter((r) => r[0] !== "INFO").length;
  console.log("Среда: " + pg + " (PGlite, изолирано, без мрежа)\n");
  results.forEach((r) => console.log(r[0] + "  " + r[1] + (r[2] ? "\n      → " + r[2] : "")));
  console.log("\nРЕЗУЛТАТ: " + pass + "/" + total);
  process.exit(pass === total ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
