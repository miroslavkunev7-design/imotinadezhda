// TASK-010 · nc_006 в изолирана база (PGlite) върху nc_001…nc_004 (+ nc_005, ако съществува) и обратният скрипт.
// node --test api/_nc-tours-db.test.js   (PGLITE=<път до @electric-sql/pglite> при нужда)
"use strict";
const test = require("node:test"), assert = require("assert");
const K = require("./_nc-tours-testkit.js"), T = require("./_nc-tours-core.js"), F = require("./_nc-tours-fixtures.js");

const PG = K.loadPg();
async function fails(code, p, label) {
  try { await p; } catch (e) { if (code === "23503" && e.code === "23001") return e; assert.strictEqual(e.code, code, (label || "") + ": очакван " + code + ", получен " + e.code + " (" + e.message + ")"); return e; }
  assert.fail((label || "") + ": очаквана грешка " + code + ", но мина");
}

test("nc_006 – схема, права, неизменяемост, верига на остаряване, публикуване, публичен изглед, обратен скрипт", { skip: !PG && "няма PGlite" }, async (t) => {
  const k = await K.makeDb();
  const { as, q, rpc, ADMIN, BROKER, OUTSIDER } = k;
  const svc = (fn, a) => rpc("service_role", null, fn, a);
  let P, B, Fl, U1, U2, G1, G1b, S1, SET1, SET2, J1;

  await t.test("M6 nc_006 се прилага върху " + k.applied.join(", "), async () => {
    const n = (await q("select count(*)::int n from pg_tables where schemaname='public' and tablename in ('nd_unit_geometry','nd_style_briefs','nd_scene_versions','nd_pano_sets','nd_tour_versions')"))[0].n;
    assert.strictEqual(n, 5);
  });

  await t.test("подготовка: TEST проект, сграда, етаж, два обекта (като служител)", async () => {
    await as("authenticated", BROKER, async () => {
      P = (await q("insert into nd_projects(name, data) values ('TEST-Тур', $1) returning *", [JSON.stringify({ title: "TEST-Проект за разходка" })]))[0];
      B = (await q("insert into nd_buildings(project_id, name) values ($1,'TEST Сграда') returning *", [P.id]))[0];
      Fl = (await q("insert into nd_floors(project_id, building_id, level) values ($1,$2,3) returning *", [P.id, B.id]))[0];
      U1 = (await q("insert into nd_units(project_id, building_id, floor_id, code, area_total, area_net, terrace_area, price_per_m2, data) values ($1,$2,$3,'TEST-A1',61.5,52.17,6.94,2000,$4) returning *", [P.id, B.id, Fl.id, JSON.stringify({ rooms: 2, plan: { private: "projects/" + P.id + "/private/units/TEST-A1/plan.png" } })]))[0];
      U2 = (await q("insert into nd_units(project_id, building_id, floor_id, code, area_total, price_per_m2) values ($1,$2,$3,'TEST-B2',89,2000) returning *", [P.id, B.id, Fl.id]))[0];
    });
    assert.ok(U1.id && U2.id);
  });

  await t.test("права: служител НЕ пише директно (42501); анонимен не чете; служител чете", async () => {
    const g = F.testA1(), v = T.validateGeometry(g);
    await fails("42501", as("authenticated", ADMIN, () => q("insert into nd_unit_geometry(project_id, unit_id, version, source, geometry, sha256) values ($1,$2,1,'plan_manual',$3,$4)", [P.id, U1.id, JSON.stringify(g), v.sha256])), "admin direct insert");
    await fails("42501", as("anon", null, () => q("select * from nd_unit_geometry")), "anon read");
    await fails("42501", as("authenticated", ADMIN, () => q("select nd_tour_geom_save($1,$2::jsonb,$3,'plan_manual',null,'{}'::jsonb,$4,'x')", [U1.id, JSON.stringify(g), v.sha256, ADMIN])), "rpc само за service role");
    const rows = await as("authenticated", BROKER, () => q("select count(*)::int n from nd_unit_geometry"));
    assert.strictEqual(rows[0].n, 0);
    await fails("42501", rpc("authenticated", OUTSIDER, "nd_tour_state", { p_unit_id: U1.id }), "не-служител");
  });

  await t.test("геометрия: запис (идемпотентен), потвърждение само без липси, грешна сума → NC409, неизменяема след проверка", async () => {
    const g = F.testA1(), v = T.validateGeometry(g);
    const val = { ok: v.ok, errors: v.errors, blocked: v.blocked, warnings: v.warnings, stats: v.stats };
    G1 = await svc("nd_tour_geom_save", { p_unit_id: U1.id, p_geometry: g, p_sha: v.sha256, p_source: "plan_manual", p_source_ref: "plan_rev 1", p_validation: val, p_actor: ADMIN, p_email: "a@test.local" });
    assert.strictEqual(G1.version, 1); assert.strictEqual(G1.status, "draft"); assert.strictEqual(G1.existed, false);
    const again = await svc("nd_tour_geom_save", { p_unit_id: U1.id, p_geometry: g, p_sha: v.sha256, p_source: "plan_manual", p_source_ref: null, p_validation: val, p_actor: ADMIN, p_email: "a@test.local" });
    assert.strictEqual(again.id, G1.id); assert.strictEqual(again.existed, true);
    /* непълна геометрия (без височини) не се потвърждава */
    const nh = F.testNoHeights(), vn = T.validateGeometry(nh);
    const Gn = await svc("nd_tour_geom_save", { p_unit_id: U2.id, p_geometry: nh, p_sha: vn.sha256, p_source: "plan_manual", p_source_ref: null, p_validation: { ok: vn.ok, blocked: vn.blocked }, p_actor: ADMIN, p_email: "a@test.local" });
    await fails("22023", svc("nd_tour_geom_verify", { p_id: Gn.id, p_expected_sha: vn.sha256, p_actor: ADMIN, p_email: "a" }), "blocked");
    await fails("NC409", svc("nd_tour_geom_verify", { p_id: G1.id, p_expected_sha: "0".repeat(64), p_actor: ADMIN, p_email: "a" }), "грешна сума");
    const r = await svc("nd_tour_geom_verify", { p_id: G1.id, p_expected_sha: v.sha256, p_actor: ADMIN, p_email: "a@test.local" });
    assert.strictEqual(r.status, "verified");
    const rr = await svc("nd_tour_geom_verify", { p_id: G1.id, p_expected_sha: v.sha256, p_actor: ADMIN, p_email: "a@test.local" });
    assert.strictEqual(rr.replayed, true);
    await fails("42501", as("service_role", null, () => q("update nd_unit_geometry set geometry = jsonb_set(geometry, '{default_height_m}', '3') where id = $1", [G1.id])), "геометрията е неизменяема");
    await fails("42501", as("service_role", null, () => q("update nd_unit_geometry set status = 'draft' where id = $1", [G1.id])), "обратно в чернова");
  });

  await t.test("стил: версии по обект и по сграда; неизменяем", async () => {
    const b1 = T.validateStyle({ style_system: "scandinavian" }), b2 = T.validateStyle({ style_system: "japandi" });
    const s1 = await svc("nd_tour_style_save", { p_project_id: P.id, p_building_id: null, p_unit_id: U1.id, p_brief: b1.normalized, p_sha: b1.sha256, p_actor: BROKER, p_email: "b" });
    const s1b = await svc("nd_tour_style_save", { p_project_id: P.id, p_building_id: null, p_unit_id: U1.id, p_brief: b1.normalized, p_sha: b1.sha256, p_actor: BROKER, p_email: "b" });
    assert.strictEqual(s1b.id, s1.id); assert.strictEqual(s1b.existed, true);
    const s2 = await svc("nd_tour_style_save", { p_project_id: P.id, p_building_id: B.id, p_unit_id: null, p_brief: b2.normalized, p_sha: b2.sha256, p_actor: BROKER, p_email: "b" });
    assert.strictEqual(s2.version, 1);
    const s3 = await svc("nd_tour_style_save", { p_project_id: P.id, p_building_id: null, p_unit_id: U1.id, p_brief: b2.normalized, p_sha: b2.sha256, p_actor: BROKER, p_email: "b" });
    assert.strictEqual(s3.version, 2);
    await fails("42501", as("service_role", null, () => q("update nd_style_briefs set brief = brief where id = $1", [s1.id])), "стилът е неизменяем");
    k.style1 = s1; k.b1 = b1;
  });

  await t.test("сцена: само от проверена геометрия и със същата сума; идемпотентна; неизменяема; преходи", async () => {
    const built = T.buildScene(F.testA1(), k.b1.normalized, { unit_id: U1.id, geometry_id: G1.id, geometry_version: 1, style_id: k.style1.id, style_version: 1 });
    assert.ok(built.ok && !built.issues.length, JSON.stringify(built.issues));
    const bad = JSON.parse(JSON.stringify(built.scene)); bad.inputs.geometry_sha256 = "f".repeat(64);
    await fails("NC409", svc("nd_tour_scene_save", { p_unit_id: U1.id, p_geometry_id: G1.id, p_style_id: k.style1.id, p_scene: bad, p_sha: built.sha256, p_status: "review", p_issues: [], p_warnings: [], p_idem: "scene:test:bad1", p_actor: ADMIN, p_email: "a" }), "друга геометрия");
    S1 = await svc("nd_tour_scene_save", { p_unit_id: U1.id, p_geometry_id: G1.id, p_style_id: k.style1.id, p_scene: built.scene, p_sha: built.sha256, p_status: "review", p_issues: [], p_warnings: built.warnings, p_idem: "scene:test:0001", p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(S1.status, "review"); assert.strictEqual(S1.version, 1);
    const rep = await svc("nd_tour_scene_save", { p_unit_id: U1.id, p_geometry_id: G1.id, p_style_id: k.style1.id, p_scene: built.scene, p_sha: built.sha256, p_status: "review", p_issues: [], p_warnings: [], p_idem: "scene:test:0001", p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(rep.id, S1.id); assert.strictEqual(rep.replayed, true);
    await fails("42501", as("service_role", null, () => q("update nd_scene_versions set scene = jsonb_set(scene, '{furniture}', '[]') where id = $1", [S1.id])), "сцената е неизменяема");
    await fails("NC409", svc("nd_tour_scene_status", { p_id: S1.id, p_to: "rejected", p_issues: [], p_note: "x", p_actor: ADMIN, p_email: "a" }).then(() => svc("nd_tour_scene_status", { p_id: S1.id, p_to: "approved", p_issues: [], p_note: null, p_actor: ADMIN, p_email: "a" })), "отхвърлена сцена не се одобрява");
    const S1b = await svc("nd_tour_scene_save", { p_unit_id: U1.id, p_geometry_id: G1.id, p_style_id: k.style1.id, p_scene: built.scene, p_sha: built.sha256, p_status: "review", p_issues: [], p_warnings: [], p_idem: "scene:test:0002", p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(S1b.version, 2); S1 = S1b;
    await svc("nd_tour_scene_status", { p_id: S1.id, p_to: "approved", p_issues: [], p_note: "ok", p_actor: ADMIN, p_email: "a" });
    const st = await as("service_role", null, () => q("select status, reviewed_at from nd_scene_versions where id=$1", [S1.id]));
    assert.strictEqual(st[0].status, "approved"); assert.ok(st[0].reviewed_at);
  });

  await t.test("набор панорами: задача, остарял отговор (ревизия/задача/отменен) → NC409, редакция с версия, преглед", async () => {
    const job = await rpc("authenticated", ADMIN, "nd_job_create", { p_kind: "tour_render", p_key: "tour:test:set1:preview", p_project_id: P.id, p_input: { unit_id: U1.id } });
    J1 = job.id;
    await fails("42501", rpc("authenticated", BROKER, "nd_job_create", { p_kind: "tour_render", p_key: "tour:test:broker", p_project_id: P.id, p_input: {} }), "брокер не пуска рендер");
    const rooms = ["hall", "living", "bedroom"];
    SET1 = await svc("nd_tour_set_create", { p_unit_id: U1.id, p_geometry_id: G1.id, p_scene_id: S1.id, p_source: "scene_render", p_quality: "preview", p_rooms: rooms, p_items: {}, p_job_id: J1, p_idem: "set:test:0001", p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(SET1.status, "rendering");
    const base = (r) => ({ room_id: r, name: r, type: "x", status: "ready", path: "projects/" + P.id + "/private/tours/" + U1.id + "/" + SET1.id + "/" + r + "-aaaa.jpg", w: 2048, h: 1024, yaw_offset: 0, hotspots: [], thumb: "data:image/jpeg;base64,AAAA" });
    let r = await svc("nd_tour_set_put", { p_set_id: SET1.id, p_job_id: J1, p_room_id: "hall", p_rev: 1, p_item: base("hall") });
    assert.deepStrictEqual([r.ready, r.total, r.all_ready], [1, 3, false]);
    await fails("NC409", svc("nd_tour_set_put", { p_set_id: SET1.id, p_job_id: J1, p_room_id: "hall", p_rev: 1, p_item: base("hall") }), "същата ревизия = остарял");
    await fails("NC409", svc("nd_tour_set_put", { p_set_id: SET1.id, p_job_id: "00000000-0000-4000-8000-0000000000ff", p_room_id: "living", p_rev: 1, p_item: base("living") }), "друга задача");
    await fails("22023", svc("nd_tour_set_put", { p_set_id: SET1.id, p_job_id: J1, p_room_id: "bath", p_rev: 1, p_item: base("bath") }), "стая извън набора");
    await svc("nd_tour_set_put", { p_set_id: SET1.id, p_job_id: J1, p_room_id: "living", p_rev: 1, p_item: base("living") });
    await fails("22023", svc("nd_tour_set_finish", { p_set_id: SET1.id, p_to: "review", p_issues: [], p_reason: null }), "непълен набор");
    r = await svc("nd_tour_set_put", { p_set_id: SET1.id, p_job_id: J1, p_room_id: "bedroom", p_rev: 1, p_item: base("bedroom") });
    assert.strictEqual(r.all_ready, true);
    const e1 = await svc("nd_tour_set_edit", { p_set_id: SET1.id, p_expected: 1, p_order: ["living", "hall", "bedroom"], p_items: { living: { yaw_offset: 0, start_yaw: 90, path: "projects/HACK/x.jpg" } } });
    assert.strictEqual(e1.edit_version, 2);
    await fails("NC409", svc("nd_tour_set_edit", { p_set_id: SET1.id, p_expected: 1, p_order: null, p_items: {} }), "стара версия на редакцията");
    const pth = await rpc("authenticated", BROKER, "nd_tour_paths", { p_set_id: SET1.id });
    assert.ok(/living-aaaa\.jpg$/.test(pth.items.living.path), "пътят не се подменя от редакцията");
    const fin = await svc("nd_tour_set_finish", { p_set_id: SET1.id, p_to: "review", p_issues: [], p_reason: null });
    assert.strictEqual(fin.status, "review"); assert.strictEqual(fin.validated, true);
    /* нова заявка отменя незавършената по-стара; отговор към отменения набор → NC409 */
    const j2 = await rpc("authenticated", ADMIN, "nd_job_create", { p_kind: "tour_render", p_key: "tour:test:set2:preview", p_project_id: P.id, p_input: {} });
    SET2 = await svc("nd_tour_set_create", { p_unit_id: U1.id, p_geometry_id: G1.id, p_scene_id: S1.id, p_source: "scene_render", p_quality: "final", p_rooms: ["hall"], p_items: {}, p_job_id: j2.id, p_idem: "set:test:0002", p_actor: ADMIN, p_email: "a" });
    const j3 = await rpc("authenticated", ADMIN, "nd_job_create", { p_kind: "tour_render", p_key: "tour:test:set3:preview", p_project_id: P.id, p_input: {} });
    const SET3 = await svc("nd_tour_set_create", { p_unit_id: U1.id, p_geometry_id: G1.id, p_scene_id: S1.id, p_source: "scene_render", p_quality: "preview", p_rooms: ["hall"], p_items: {}, p_job_id: j3.id, p_idem: "set:test:0003", p_actor: ADMIN, p_email: "a" });
    assert.deepStrictEqual(SET3.cancelled, [SET2.id]);
    const js = await as("service_role", null, () => q("select status, cancel_requested from nd_jobs where id=$1", [j2.id]));
    assert.strictEqual(js[0].status, "cancelled"); assert.strictEqual(js[0].cancel_requested, true);
    await fails("NC409", svc("nd_tour_set_put", { p_set_id: SET2.id, p_job_id: j2.id, p_room_id: "hall", p_rev: 1, p_item: base("hall") }), "отговор към отменен набор");
    k.SET3 = SET3; k.j3 = j3.id;
  });

  await t.test("публикуване: NC409 при стара версия; медия за /pano/; nd_public_tour – свободен (стаи + карта), капариран (само печат); връщане и сваляне", async () => {
    await fails("NC409", svc("nd_tour_publish", { p_unit_id: U1.id, p_set_id: SET1.id, p_scene_id: S1.id, p_expected: 5, p_viewer: "nc-tour@1", p_actor: ADMIN, p_email: "a" }), "очаквана версия");
    await fails("NC409", svc("nd_tour_publish", { p_unit_id: U1.id, p_set_id: k.SET3.id, p_scene_id: null, p_expected: 0, p_viewer: "nc-tour@1", p_actor: ADMIN, p_email: "a" }), "непроверен набор");
    const pub = await svc("nd_tour_publish", { p_unit_id: U1.id, p_set_id: SET1.id, p_scene_id: S1.id, p_expected: 0, p_viewer: "nc-tour@1", p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(pub.version, 1); assert.strictEqual(pub.media, 3);
    const media = await as("service_role", null, () => q("select path, sort, title from nd_project_media where unit_id=$1 and kind='tour' order by sort", [U1.id]));
    assert.deepStrictEqual(media.map((m) => m.title), ["living", "hall", "bedroom"]);
    /* проектът не е публикуван → публиката не вижда нищо */
    let pt = await rpc("anon", null, "nd_public_tour", { p_unit_id: U1.id });
    assert.strictEqual(pt, null);
    await as("service_role", null, () => q("update nd_projects set status='published', slug='test-tur' where id=$1", [P.id]));
    pt = await rpc("anon", null, "nd_public_tour", { p_unit_id: U1.id });
    assert.strictEqual(pt.locked, false); assert.strictEqual(pt.tour.rooms.length, 3);
    assert.deepStrictEqual(pt.tour.rooms.map((x) => [x.n, x.room_id]), [[0, "living"], [1, "hall"], [2, "bedroom"]]);
    assert.ok(pt.tour.minimap.rooms.length === 6 && pt.tour.scene && pt.tour.scene.navigation && !pt.tour.scene.inputs, "сцена без входните идентификатори");
    assert.ok(!JSON.stringify(pt).includes("/private/"), "без частни пътища");
    const pr = await svc("nd_pano_resolve", { p_unit_id: U1.id, p_n: 1 });
    assert.ok(/hall-aaaa\.jpg$/.test(pr.path), "n съвпада с реда на стаите");
    /* капариран: само „заключено“ – без стаи, карта, сцена, миниатюри; /pano/ – нищо */
    await setStatus(k, U1.id, "reserved");
    pt = await rpc("anon", null, "nd_public_tour", { p_unit_id: U1.id });
    assert.deepStrictEqual(Object.keys(pt).sort(), ["code", "locked", "status", "unit_id"]); assert.strictEqual(pt.locked, true);
    assert.strictEqual(await svc("nd_pano_resolve", { p_unit_id: U1.id, p_n: 0 }), null);
    const staff = await rpc("authenticated", BROKER, "nd_tour_state", { p_unit_id: U1.id });
    assert.strictEqual(staff.tours[0].status, "published", "екипът вижда всичко и при капариран");
    await setStatus(k, U1.id, "free", "TEST връщане");
    /* връщане към по-стара версия: нов набор → публикуване → обратно към SET1 */
    const fin3 = await (async () => { const it = { room_id: "hall", name: "hall", status: "ready", path: "projects/" + P.id + "/private/tours/" + U1.id + "/" + k.SET3.id + "/hall-bbbb.jpg", w: 2048, h: 1024, yaw_offset: 0, hotspots: [] }; await svc("nd_tour_set_put", { p_set_id: k.SET3.id, p_job_id: k.j3, p_room_id: "hall", p_rev: 1, p_item: it }); return svc("nd_tour_set_finish", { p_set_id: k.SET3.id, p_to: "review", p_issues: [], p_reason: null }); })();
    assert.strictEqual(fin3.status, "review");
    const p2 = await svc("nd_tour_publish", { p_unit_id: U1.id, p_set_id: k.SET3.id, p_scene_id: S1.id, p_expected: 1, p_viewer: "nc-tour@1", p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(p2.version, 2);
    let st = await rpc("authenticated", BROKER, "nd_tour_state", { p_unit_id: U1.id });
    assert.deepStrictEqual(st.tours.map((x) => x.status), ["published", "superseded"]);
    assert.strictEqual(st.sets.find((x) => x.id === SET1.id).status, "superseded");
    const back = await svc("nd_tour_publish", { p_unit_id: U1.id, p_set_id: SET1.id, p_scene_id: S1.id, p_expected: 2, p_viewer: "nc-tour@1", p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(back.version, 3); assert.strictEqual(back.media, 3);
    st = await rpc("authenticated", BROKER, "nd_tour_state", { p_unit_id: U1.id });
    assert.strictEqual(st.sets.find((x) => x.id === SET1.id).status, "published");
    assert.strictEqual(st.sets.find((x) => x.id === k.SET3.id).status, "superseded", "по-новият набор остава в историята (не се трие)");
    const un = await svc("nd_tour_unpublish", { p_unit_id: U1.id, p_expected: 3, p_reason: "TEST", p_actor: ADMIN });
    assert.strictEqual(un.media_removed, 3);
    pt = await rpc("anon", null, "nd_public_tour", { p_unit_id: U1.id });
    assert.strictEqual(pt.tour, null);
    const again = await svc("nd_tour_publish", { p_unit_id: U1.id, p_set_id: SET1.id, p_scene_id: S1.id, p_expected: 0, p_viewer: "nc-tour@1", p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(again.version, 4);
  });

  await t.test("остаряване по верига: смяна на плана на обекта → геометрия stale → сцени/набори/публикувано stale → публичните файлове изчезват", async () => {
    await as("authenticated", ADMIN, () => q("update nd_units set data = jsonb_set(data, '{plan,private}', to_jsonb($2::text)) where id=$1", [U1.id, "projects/" + P.id + "/private/units/TEST-A1/plan-v2.png"]));
    const st = await rpc("authenticated", BROKER, "nd_tour_state", { p_unit_id: U1.id });
    assert.strictEqual(st.geometry[0].status, "stale");
    assert.ok(st.scenes.every((s) => s.status === "stale" || s.status === "rejected") && st.scenes.some((s) => s.status === "stale"), JSON.stringify(st.scenes.map((s) => s.status)));
    assert.strictEqual(st.tours[0].status, "stale"); assert.strictEqual(st.media_count, 0);
    const pt = await rpc("anon", null, "nd_public_tour", { p_unit_id: U1.id });
    assert.strictEqual(pt.tour, null);
    await fails("NC409", svc("nd_tour_scene_status", { p_id: S1.id, p_to: "review", p_issues: [], p_note: null, p_actor: ADMIN, p_email: "a" }), "остаряла сцена");
    /* нова версия на геометрията (по новия план) → нова верига */
    const g = F.testA1(), v = T.validateGeometry(g);
    G1b = await svc("nd_tour_geom_save", { p_unit_id: U1.id, p_geometry: g, p_sha: v.sha256, p_source: "plan_manual", p_source_ref: "plan_rev 2", p_validation: { ok: true, blocked: [] }, p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(G1b.version, 2); assert.strictEqual(G1b.existed, false);
    const r = await svc("nd_tour_geom_verify", { p_id: G1b.id, p_expected_sha: v.sha256, p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(r.status, "verified");
  });

  await t.test("нова проверена версия на геометрията → старата superseded, нейните сцени stale (B2)", async () => {
    const g = F.testB2(), v = T.validateGeometry(g);
    const a = await svc("nd_tour_geom_save", { p_unit_id: U2.id, p_geometry: g, p_sha: v.sha256, p_source: "ifc", p_source_ref: "TEST-IFC v1", p_validation: { ok: true, blocked: [] }, p_actor: ADMIN, p_email: "a" });
    await svc("nd_tour_geom_verify", { p_id: a.id, p_expected_sha: v.sha256, p_actor: ADMIN, p_email: "a" });
    const built = T.buildScene(g, {}, { unit_id: U2.id, geometry_id: a.id });
    const sc = await svc("nd_tour_scene_save", { p_unit_id: U2.id, p_geometry_id: a.id, p_style_id: null, p_scene: built.scene, p_sha: built.sha256, p_status: "review", p_issues: [], p_warnings: [], p_idem: "scene:test:b2v1", p_actor: ADMIN, p_email: "a" });
    const g2 = F.testB2(); g2.default_height_m = 2.8; const v2 = T.validateGeometry(g2);
    const b = await svc("nd_tour_geom_save", { p_unit_id: U2.id, p_geometry: g2, p_sha: v2.sha256, p_source: "ifc", p_source_ref: "TEST-IFC v2", p_validation: { ok: true, blocked: [] }, p_actor: ADMIN, p_email: "a" });
    const res = await svc("nd_tour_geom_verify", { p_id: b.id, p_expected_sha: v2.sha256, p_actor: ADMIN, p_email: "a" });
    assert.strictEqual(res.stale[a.id].scenes, 1);
    const st = await rpc("authenticated", BROKER, "nd_tour_state", { p_unit_id: U2.id });
    assert.deepStrictEqual(st.geometry.filter((x) => x.source === "ifc").map((x) => x.status), ["verified", "superseded"]);
    assert.strictEqual(st.scenes.find((x) => x.id === sc.id).status, "stale");
    await fails("NC409", svc("nd_tour_scene_save", { p_unit_id: U2.id, p_geometry_id: a.id, p_style_id: null, p_scene: built.scene, p_sha: built.sha256, p_status: "review", p_issues: [], p_warnings: [], p_idem: "scene:test:b2v1b", p_actor: ADMIN, p_email: "a" }), "сцена върху заменена геометрия");
  });

  await t.test("обратен скрипт: down → up → down; nc_001…004 остават непокътнати", async () => {
    const before = (await q("select count(*)::int n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname not like 'nd_tour%' and p.proname <> 'nd_public_tour'"))[0].n;
    await k.db.exec(K.SQL("nc_006_tours_down.sql"));
    const gone = (await q("select count(*)::int n from pg_tables where schemaname='public' and tablename in ('nd_unit_geometry','nd_style_briefs','nd_scene_versions','nd_pano_sets','nd_tour_versions')"))[0].n;
    assert.strictEqual(gone, 0);
    const fn = (await q("select count(*)::int n from pg_proc where proname like 'nd_tour%' or proname = 'nd_public_tour'"))[0].n;
    assert.strictEqual(fn, 0);
    const trg = (await q("select count(*)::int n from pg_trigger where tgname = 'nd_tour_units_after'"))[0].n;
    assert.strictEqual(trg, 0);
    const after = (await q("select count(*)::int n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public'"))[0].n;
    assert.strictEqual(after, before);
    /* обектите и задачите на nc_001…004 са непокътнати и работят */
    const u = await as("authenticated", BROKER, () => q("select count(*)::int n from nd_units"));
    assert.strictEqual(u[0].n, 2);
    await as("authenticated", ADMIN, () => q("update nd_units set data = data || '{\"rooms\":3}' where id=$1", [U2.id]));
    await k.db.exec(K.SQL("nc_006_tours.sql"));
    await k.db.exec(K.SQL("nc_006_tours_down.sql"));
    await k.db.exec(K.SQL("nc_006_tours.sql"));
    assert.strictEqual((await q("select count(*)::int n from nd_unit_geometry"))[0].n, 0);
  });
});

async function setStatus(k, unitId, to, note) {
  const v = (await k.as("service_role", null, () => k.q("select version from nd_units where id=$1", [unitId])))[0].version;
  return k.rpc("authenticated", k.ADMIN, "nd_unit_set_status", { p_unit_id: unitId, p_to: to, p_expected_version: v, p_event_id: null, p_note: note || null, p_client_id: null, p_deal_id: null });
}
