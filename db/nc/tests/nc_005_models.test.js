// Изолиран тест на nc_005 (CAD/BIM и 3D модели, TASK-009) върху nc_001…nc_004 в PGlite (Postgres в процеса, без мрежа).
// НЕ докосва Supabase. Средата е имитирана точно както в nc_dryrun.test.js (роли, auth.uid()/auth.jwt(), storage.objects, nd_staff).
// Проверява: права (служител/администратор/посетител/изпълнител), неизменимост на версиите, идемпотентност, NC409, остарял изпълнител,
// публикуване и връщане към предишна версия, отмяна, публичните функции (без пътища) и обратния скрипт (up → down → up → down).
// Стартиране: PGLITE=/tmp/pg17/node_modules/@electric-sql/pglite node db/nc/tests/nc_005_models.test.js
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const { PGlite } = require(process.env.PGLITE || "@electric-sql/pglite");
const SQL = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const ADMIN = "00000000-0000-4000-8000-000000000001", BROKER = "00000000-0000-4000-8000-000000000002", VISITOR = "00000000-0000-4000-8000-000000000009";
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
  try { await fn(); } catch (e) { assert.strictEqual(e.code, code, label + ": очакван SQLSTATE " + code + ", получен " + e.code + " (" + e.message + ")"); return e; }
  assert.fail(label + ": очаквана грешка " + code + ", но мина");
}
async function t(name, fn) {
  try { await fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", name, e.message]); try { await db.exec("rollback"); } catch (x) {} }
}
const SHA = (c) => c.repeat(64);
const count = async () => ({
  rel: (await q("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','i','S')"))[0].n,
  fn: (await q("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"))[0].n,
  trg: (await q("select count(*)::int n from pg_trigger where not tgisinternal"))[0].n,
  pol: (await q("select count(*)::int n from pg_policies"))[0].n
});

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
  for (const f of ["nc_001_new_construction.sql", "nc_002_jobs_rpc.sql", "nc_003_hardening.sql", "nc_004_import.sql"]) await db.exec(SQL(f));
  const before = await count();

  await t("M5 nc_005 се прилага без грешка върху nc_001…nc_004", async () => { await db.exec(SQL("nc_005_cad_models.sql")); });

  let P, B, B2, POTHER, BOTHER;
  const mkJob = async (key, building, pid, uid) => (await as("authenticated", uid || ADMIN, () => q("select nd_job_create('cad_convert',$1,$2,$3) as r", [key, pid || P.id, JSON.stringify({ building_id: building, sha256: SHA("a"), bytes: 1000 })])))[0].r.id;
  const claim = async (id, w) => (await svc("select id from nd_job_claim_id($1, array['cad_inspect','cad_convert'], $2)", [id, w]))[0].id;
  const model = (pid, job, over) => Object.assign({ fidelity: "exact", source_format: "ifc", source_sha256: SHA("a"), source_bytes: 1000,
    glb_path: `projects/${pid}/private/derived/models/${job}/a1-model.glb`, glb_sha256: SHA("b"), glb_bytes: 4096,
    poster_path: `projects/${pid}/private/derived/models/${job}/a1-poster.jpg`,
    stats: { triangles: 120, units_mapped: 2, floors_mapped: 2 }, report: { status: "VERIFIED", units: "m" }, mapping: { floors: [], units: [] } }, over || {});
  const register = (job, w, m, res) => svc("select nd_model_register($1,$2,$3,$4) as r", [job, w, JSON.stringify(m), JSON.stringify(res || { stats: { triangles: 120 } })]).then((r) => r[0].r);
  const publish = (uid, job, b, exp, rb) => as("authenticated", uid, async () => (await q("select nd_model_publish($1,$2,$3,$4) as r", [job, b, exp === undefined ? null : exp, !!rb]))[0].r);
  const ready = async (key, building, pid, over) => { const j = await mkJob(key, building, pid); await claim(j, "gha:1.1"); const r = await register(j, "gha:1.1", model(pid || P.id, j, over)); return { job: j, r }; };

  await t("D1 основа: проект с 2 сгради + друг проект; задача за модел създава само администратор (брокер → 42501)", async () => {
    await as("authenticated", BROKER, async () => {
      P = (await q("insert into nd_projects(name, data) values ('TEST-Модели', '{\"title\":\"TEST-Модели\"}') returning *"))[0];
      B = (await q("insert into nd_buildings(project_id, name) values ($1,'TEST-Сграда A') returning *", [P.id]))[0];
      B2 = (await q("insert into nd_buildings(project_id, name) values ($1,'TEST-Сграда B') returning *", [P.id]))[0];
      POTHER = (await q("insert into nd_projects(name, data) values ('TEST-Друг', '{\"title\":\"TEST-Друг\"}') returning *"))[0];
      BOTHER = (await q("insert into nd_buildings(project_id, name) values ($1,'TEST-Чужда') returning *", [POTHER.id]))[0];
    });
    await fails("42501", () => mkJob("cad_convert:test:broker:0001", B.id, P.id, BROKER), "брокер пуска cad_convert");
    await fails("42501", () => as("authenticated", BROKER, () => q("select nd_job_create('cad_inspect','cad_inspect:test:broker:0001',$1,'{}'::jsonb)", [P.id])), "брокер пуска cad_inspect");
  });

  let J1, M1;
  await t("D2 изпълнителят записва версия 1 и задачата става review в ЕДНА стъпка; повторът връща същото (replayed), без втори ред", async () => {
    J1 = await mkJob("cad_convert:test:b1:0001", B.id);
    assert.strictEqual(await claim(J1, "gha:100.1"), J1);
    const r = await register(J1, "gha:100.1", model(P.id, J1));
    assert.strictEqual(r.replayed, false); assert.strictEqual(r.version, 1); assert.strictEqual(r.job_status, "review"); M1 = r.model_id;
    const j = (await svc("select status, locked_by, result from nd_jobs where id=$1", [J1]))[0];
    assert.strictEqual(j.status, "review"); assert.strictEqual(j.locked_by, null); assert.strictEqual(j.result.model_version, 1); assert.strictEqual(j.result.building_id, B.id);
    const again = await register(J1, "gha:100.1", model(P.id, J1));
    assert.strictEqual(again.replayed, true); assert.strictEqual(again.model_id, M1);
    assert.strictEqual((await svc("select count(*)::int n from nd_models where job_id=$1", [J1]))[0].n, 1);
    const m = (await svc("select status, created_by, version from nd_models where id=$1", [M1]))[0];
    assert.strictEqual(m.status, "review"); assert.strictEqual(m.created_by, ADMIN);
  });

  await t("D3 служител не пише в nd_models (42501); посетител и anon не четат нищо; служител чете (RLS)", async () => {
    await fails("42501", () => as("authenticated", BROKER, () => q("update nd_models set status='published' where id=$1", [M1])), "update от брокер");
    await fails("42501", () => as("authenticated", ADMIN, () => q("update nd_models set status='published', published_at=now() where id=$1", [M1])), "update от администратор (пряко)");
    await fails("42501", () => as("authenticated", ADMIN, () => q("delete from nd_models where id=$1", [M1])), "delete от администратор");
    await fails("42501", () => as("authenticated", ADMIN, () => q("insert into nd_models(project_id,building_id,version,job_id,fidelity,source_format,source_sha256,source_bytes,glb_path,glb_sha256,glb_bytes) values ($1,$2,9,$3,'exact','ifc',$4,1,'x',$4,100)", [P.id, B.id, J1, SHA("c")])), "insert от администратор");
    assert.strictEqual((await as("authenticated", BROKER, () => q("select count(*)::int n from nd_models")))[0].n, 1);
    assert.strictEqual((await as("authenticated", VISITOR, () => q("select count(*)::int n from nd_models")))[0].n, 0);
    await fails("42501", () => as("anon", null, () => q("select count(*) from nd_models")), "anon select");
  });

  await t("D4 версията е неизменима дори за изпълнителя: файл/хеш/отчет не се сменят (42501); непозволен преход → 22023", async () => {
    await fails("42501", () => svc("update nd_models set glb_sha256=$2 where id=$1", [M1, SHA("f")]), "смяна на хеш");
    await fails("42501", () => svc("update nd_models set report='{\"status\":\"X\"}'::jsonb where id=$1", [M1]), "смяна на отчет");
    await fails("42501", () => svc("update nd_models set version=7 where id=$1", [M1]), "смяна на версия");
    await fails("22023", () => svc("update nd_models set status='retired' where id=$1", [M1]), "review → retired");
  });

  await t("D5 пътят на файла е заключен към проекта и задачата (23514): чужд проект, друга папка, друга задача, оригинал вместо производна", async () => {
    const j = await mkJob("cad_convert:test:b1:path1", B.id); await claim(j, "gha:101.1");
    for (const bad of [`projects/${POTHER.id}/private/derived/models/${j}/a1-model.glb`, `projects/${P.id}/public/models/${j}/a1-model.glb`,
      `projects/${P.id}/private/derived/models/${J1}/a1-model.glb`, `projects/${P.id}/private/cad/a1-model.glb`, `projects/${P.id}/private/derived/models/${j}/sub/a1-model.glb`,
      `projects/${P.id}/private/derived/models/${j}/model.ifc`])
      await fails("23514", () => register(j, "gha:101.1", model(P.id, j, { glb_path: bad })), "път " + bad.slice(-40));
    await fails("23514", () => register(j, "gha:101.1", model(P.id, j, { report: { investor: "X" } })), "забранен ключ в отчета");
    await fails("23514", () => register(j, "gha:101.1", model(P.id, j, { glb_bytes: 99999999999 })), "прекален размер");
    await fails("23514", () => register(j, "gha:101.1", model(P.id, j, { fidelity: "photo" })), "непознат вид точност");
    assert.strictEqual((await svc("select status from nd_jobs where id=$1", [j]))[0].status, "running", "нищо не е записано; задачата е още при изпълнителя");
    await svc("select nd_job_fail_final($1,'gha:101.1','[TEST] край',null)", [j]);
  });

  await t("D6 остарял изпълнител (задачата е взета отново от друг) не записва нищо (42501); чужд изпълнител също", async () => {
    const j = await mkJob("cad_convert:test:b1:stale1", B.id); await claim(j, "gha:200.1");
    await svc("update nd_jobs set heartbeat_at = now() - interval '2 hours', locked_at = now() - interval '2 hours' where id=$1", [j]);
    assert.strictEqual(await claim(j, "gha:201.1"), null, "първото взимане само връща спрялата задача в опашката (с изчакване)");
    await svc("update nd_jobs set next_attempt_at = now() where id=$1", [j]);
    assert.strictEqual(await claim(j, "gha:201.1"), j);
    await fails("42501", () => register(j, "gha:200.1", model(P.id, j)), "остарял изпълнител");
    await fails("42501", () => svc("select nd_job_fail_final($1,'gha:200.1','x',null)", [j]), "остарял изпълнител – неуспех");
    await fails("42501", () => svc("select nd_job_finish($1,'gha:200.1','done','{}'::jsonb,null,0)", [j]), "остарял изпълнител – край");
    assert.strictEqual((await svc("select count(*)::int n from nd_models where job_id=$1", [j]))[0].n, 0);
    const r = await register(j, "gha:201.1", model(P.id, j)); assert.strictEqual(r.version, 2);
  });

  await t("D7 служител не може да вика функциите на изпълнителя и на публичния път (42501)", async () => {
    for (const sql of ["select nd_model_register(gen_random_uuid(),'w','{}'::jsonb,'{}'::jsonb)", "select nd_job_fail_final(gen_random_uuid(),'w','x',null)",
      "select nd_cad_job_touch(gen_random_uuid(),'{}'::jsonb)", "select nd_model_resolve('x','glb')"]) {
      await fails("42501", () => as("authenticated", ADMIN, () => q(sql)), sql.slice(7, 30));
      await fails("42501", () => as("anon", null, () => q(sql)), "anon " + sql.slice(7, 30));
    }
    await fails("42501", () => as("anon", null, () => q("select nd_model_publish(gen_random_uuid(),'x',null,false)")), "anon publish");
  });

  await t("D8 публикуване: брокер → 42501; чужда сграда → 42501; администратор → published, задачата → done; повторът е безопасен", async () => {
    await fails("42501", () => publish(BROKER, J1, B.id, 0), "брокер публикува");
    await fails("42501", () => publish(ADMIN, J1, B2.id, 0), "друга сграда");
    await fails("P0002", () => publish(ADMIN, "00000000-0000-4000-8000-0000000000aa", B.id, 0), "няма такава задача");
    await fails("NC409", () => publish(ADMIN, J1, B.id, 5), "очаквана публикувана версия 5, а няма публикувана");
    const r = await publish(ADMIN, J1, B.id, 0);
    assert.strictEqual(r.model_public, true); assert.strictEqual(r.version, 1); assert.strictEqual(r.previous_version, null); assert.strictEqual(r.replayed, false);
    const j = (await svc("select status, result from nd_jobs where id=$1", [J1]))[0];
    assert.strictEqual(j.status, "done"); assert.strictEqual(j.result.published.version, 1);
    const m = (await svc("select status, published_by from nd_models where id=$1", [M1]))[0];
    assert.strictEqual(m.status, "published"); assert.strictEqual(m.published_by, ADMIN);
    const again = await publish(ADMIN, J1, B.id, 1); assert.strictEqual(again.replayed, true); assert.strictEqual(again.version, 1);
  });

  await t("D9 публичният път дава файл САМО за публикуван проект с публикувана версия; публичният списък е без пътища и отчети", async () => {
    assert.strictEqual((await svc("select nd_model_resolve($1,'glb') as r", [B.id]))[0].r, null, "проектът е чернова → няма модел навън");
    assert.deepStrictEqual((await as("anon", null, () => q("select nd_public_models('test-modeli') as r")))[0].r, {});
    await svc("update nd_projects set status='published', slug='test-modeli' where id=$1", [P.id]);
    const r = (await svc("select nd_model_resolve($1,'glb') as r", [B.id]))[0].r;
    assert.strictEqual(r.path, `projects/${P.id}/private/derived/models/${J1}/a1-model.glb`); assert.strictEqual(r.version, 1);
    assert.strictEqual((await svc("select nd_model_resolve($1,'poster') as r", [B.id]))[0].r.path.endsWith("a1-poster.jpg"), true);
    assert.strictEqual((await svc("select nd_model_resolve($1,'glb') as r", [B2.id]))[0].r, null, "сграда без публикувана версия");
    const pub = (await as("anon", null, () => q("select nd_public_models('test-modeli') as r")))[0].r;
    assert.deepStrictEqual(Object.keys(pub), [B.id]);
    assert.deepStrictEqual(Object.keys(pub[B.id]).sort(), ["bytes", "fidelity", "floors", "poster", "published_at", "triangles", "units", "version"]);
    assert.strictEqual(pub[B.id].units, 2); assert.strictEqual(pub[B.id].fidelity, "exact"); assert.ok(!/projects\/|derived|\.glb/.test(JSON.stringify(pub)), "без пътища");
  });

  let J2, J3;
  await t("D10 нова версия: предишната публикувана става retired; една публикувана на сграда; разминаване на очакваната версия → NC409", async () => {
    J2 = (await svc("select job_id from nd_models where building_id=$1 and version=2", [B.id]))[0].job_id;
    await fails("NC409", () => publish(ADMIN, J2, B.id, 0), "друг междувременно е публикувал v1");
    const r = await publish(ADMIN, J2, B.id, 1);
    assert.strictEqual(r.version, 2); assert.strictEqual(r.previous_version, 1);
    const rows = await svc("select version, status from nd_models where building_id=$1 order by version", [B.id]);
    assert.deepStrictEqual(rows, [{ version: 1, status: "retired" }, { version: 2, status: "published" }]);
    assert.strictEqual((await svc("select nd_model_resolve($1,'glb') as r", [B.id]))[0].r.version, 2);
  });

  await t("D11 по-стара версия НЕ презаписва по-нова (NC409); връщане назад е изрично (rollback) и работи; после пак напред", async () => {
    await fails("NC409", () => publish(ADMIN, J1, B.id, 2, false), "v1 върху v2 без rollback");
    assert.strictEqual((await svc("select nd_model_resolve($1,'glb') as r", [B.id]))[0].r.version, 2, "нищо не е сменено");
    const r = await publish(ADMIN, J1, B.id, 2, true);
    assert.strictEqual(r.version, 1); assert.strictEqual(r.previous_version, 2);
    assert.strictEqual((await svc("select nd_model_resolve($1,'glb') as r", [B.id]))[0].r.version, 1);
    assert.deepStrictEqual(await svc("select version, status from nd_models where building_id=$1 order by version", [B.id]), [{ version: 1, status: "published" }, { version: 2, status: "retired" }]);
    await publish(ADMIN, J2, B.id, 1);
    assert.strictEqual((await svc("select nd_model_resolve($1,'glb') as r", [B.id]))[0].r.version, 2);
  });

  await t("D12 отменена задача в преглед → моделът става rejected и не се публикува (NC409)", async () => {
    const x = await ready("cad_convert:test:b1:cancel1", B.id); J3 = x.job;
    assert.strictEqual(x.r.version, 3);
    await as("authenticated", ADMIN, () => q("select nd_job_cancel($1)", [J3]));
    assert.strictEqual((await svc("select status from nd_models where job_id=$1", [J3]))[0].status, "rejected");
    await fails("NC409", () => publish(ADMIN, J3, B.id, 2), "отхвърлен модел");
    assert.strictEqual((await svc("select nd_model_resolve($1,'glb') as r", [B.id]))[0].r.version, 2);
  });

  await t("D13 сваляне от сайта: брокер → 42501; грешна очаквана версия → NC409; успех → няма модел навън; повторът не променя нищо", async () => {
    await fails("42501", () => as("authenticated", BROKER, () => q("select nd_model_unpublish($1,2)", [B.id])), "брокер сваля");
    await fails("NC409", () => as("authenticated", ADMIN, () => q("select nd_model_unpublish($1,1)", [B.id])), "очаквана v1, а е v2");
    const r = (await as("authenticated", ADMIN, () => q("select nd_model_unpublish($1,2) as r", [B.id])))[0].r;
    assert.strictEqual(r.changed, true); assert.strictEqual(r.previous_version, 2);
    assert.strictEqual((await svc("select nd_model_resolve($1,'glb') as r", [B.id]))[0].r, null);
    assert.deepStrictEqual((await as("anon", null, () => q("select nd_public_models('test-modeli') as r")))[0].r, {});
    const again = (await as("authenticated", ADMIN, () => q("select nd_model_unpublish($1,0) as r", [B.id])))[0].r; assert.strictEqual(again.changed, false);
    await publish(ADMIN, J2, B.id, 0);
  });

  await t("D14 версиите са по сграда; моделът не може да се запише за сграда от друг проект (22023/23503)", async () => {
    const x = await ready("cad_convert:test:b2:0001", B2.id);
    assert.strictEqual(x.r.version, 1, "втората сграда започва от 1");
    const j = await mkJob("cad_convert:test:other:0001", BOTHER.id); await claim(j, "gha:300.1");   // задача в проект P, но сградата е от друг проект
    const e = await register(j, "gha:300.1", model(P.id, j)).then(() => null, (err) => err);
    assert.ok(e && ["P0002", "23503", "22023"].includes(e.code), "очакван отказ, получено " + (e && e.code));
    assert.strictEqual((await svc("select count(*)::int n from nd_models where job_id=$1", [j]))[0].n, 0);
  });

  await t("D15 окончателен неуспех (повреден файл) не се повтаря; обикновеният неуспех се връща в опашката; бележката важи само за чакаща задача", async () => {
    const a = (await as("authenticated", ADMIN, () => q("select nd_job_create('cad_inspect','cad_inspect:test:final:0001',$1,'{\"sha256\":\"x\"}'::jsonb) as r", [P.id])))[0].r.id;
    assert.strictEqual((await svc("select nd_cad_job_touch($1,'{\"dispatched_at\":\"2026-11-11T00:00:00Z\"}'::jsonb) as r", [a]))[0].r, true);
    await claim(a, "gha:400.1");
    assert.strictEqual((await svc("select nd_cad_job_touch($1,'{\"x\":1}'::jsonb) as r", [a]))[0].r, false, "работеща задача не се пипа");
    const r = (await svc("select nd_job_fail_final($1,'gha:400.1','[FILE_CORRUPT] Файлът е повреден','{\"error_code\":\"FILE_CORRUPT\"}'::jsonb) as r", [a]))[0].r;
    assert.strictEqual(r.status, "failed");
    const j = (await svc("select status, attempts, error, result, progress from nd_jobs where id=$1", [a]))[0];
    assert.strictEqual(j.status, "failed"); assert.strictEqual(j.attempts, 1); assert.ok(/FILE_CORRUPT/.test(j.error)); assert.strictEqual(j.progress.dispatched_at, "2026-11-11T00:00:00Z");
    const b = (await as("authenticated", ADMIN, () => q("select nd_job_create('cad_inspect','cad_inspect:test:retry:0001',$1,'{}'::jsonb) as r", [P.id])))[0].r.id;
    await claim(b, "gha:401.1");
    await svc("select id from nd_job_finish($1,'gha:401.1','failed',null,'[STORAGE_FAILED] временно',0)", [b]);
    assert.strictEqual((await svc("select status from nd_jobs where id=$1", [b]))[0].status, "queued", "временен неуспех → нов опит");
    const imp = (await as("authenticated", BROKER, () => q("select nd_job_create('import','import:test:nofinal:0001',$1,'{}'::jsonb) as r", [P.id])))[0].r.id;
    await svc("select id from nd_job_claim_id($1, array['import'], 'w1')", [imp]);
    await fails("P0002", () => svc("select nd_job_fail_final($1,'w1','x',null)", [imp]), "окончателният неуспех е само за cad_*");
  });

  await t("D16 изтриване на сграда отнася версиите ѝ (каскада); задачите остават; историята на другата сграда е непокътната", async () => {
    await as("authenticated", ADMIN, () => q("delete from nd_buildings where id=$1", [B2.id]));
    assert.strictEqual((await svc("select count(*)::int n from nd_models where building_id=$1", [B2.id]))[0].n, 0);
    assert.strictEqual((await svc("select count(*)::int n from nd_jobs where idempotency_key='cad_convert:test:b2:0001'"))[0].n, 1);
    assert.strictEqual((await svc("select count(*)::int n from nd_models where building_id=$1", [B.id]))[0].n, 3);
  });

  await t("D17 обратен скрипт: nc_005_down маха само своето (броят обекти = преди nc_005); данните на модула остават; up → down → up → down; после nc_001_down минава", async () => {
    const jobsBefore = (await svc("select count(*)::int n from nd_jobs"))[0].n, unitsProj = (await svc("select count(*)::int n from nd_projects"))[0].n;
    await db.exec(SQL("nc_005_cad_models_down.sql"));
    assert.deepStrictEqual(await count(), before, "след down обектите са точно както преди nc_005");
    assert.strictEqual((await svc("select count(*)::int n from nd_jobs"))[0].n, jobsBefore, "задачите остават");
    assert.strictEqual((await svc("select count(*)::int n from nd_projects"))[0].n, unitsProj, "проектите остават");
    assert.strictEqual((await q("select count(*)::int n from pg_trigger where tgname='nd_models_job_sync'"))[0].n, 0);
    await as("authenticated", ADMIN, () => q("select nd_job_cancel(id) from nd_jobs where status in ('queued','review') limit 1"));   // nd_jobs работи и без тригера
    await db.exec(SQL("nc_005_cad_models.sql"));
    assert.strictEqual((await svc("select count(*)::int n from nd_models"))[0].n, 0);
    await db.exec(SQL("nc_005_cad_models_down.sql"));
    assert.deepStrictEqual(await count(), before);
    await db.exec(SQL("nc_005_cad_models_down.sql"));   // повторното изпълнение е безопасно (if exists)
    await db.exec(SQL("nc_001_down.sql"));
    assert.strictEqual((await q("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'nd_%' and c.relkind='r'"))[0].n, 1, "остава само nd_staff");
  });

  await t("D18 nc_001_down без nc_005_down спира цял (няма CASCADE) и не променя нищо", async () => {
    for (const f of ["nc_001_new_construction.sql", "nc_002_jobs_rpc.sql", "nc_003_hardening.sql", "nc_004_import.sql", "nc_005_cad_models.sql"]) await db.exec(SQL(f));
    let err = null; try { await db.exec(SQL("nc_001_down.sql")); } catch (e) { err = e; try { await db.exec("rollback"); } catch (x) {} }
    assert.ok(err, "nc_001_down трябва да откаже, докато nd_models съществува");
    assert.strictEqual((await q("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('nd_models','nd_jobs','nd_projects')"))[0].n, 3);
    await db.exec(SQL("nc_005_cad_models_down.sql")); await db.exec(SQL("nc_001_down.sql"));
  });

  const pg = (await q("select version() v"))[0].v.split(" on ")[0];
  const pass = results.filter((r) => r[0] === "PASS").length, total = results.length;
  console.log("Среда: " + pg + " (PGlite, изолирано, без мрежа)\n");
  results.forEach((r) => console.log(r[0] + "  " + r[1] + (r[2] ? "\n      → " + r[2] : "")));
  console.log("\nРЕЗУЛТАТ: " + pass + "/" + total);
  process.exit(pass === total ? 0 : 1);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
