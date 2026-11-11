// TASK-010 · инструментите през истинския регистър (_nc-tools.js) срещу nc_001…nc_006 в PGlite и фалшиво хранилище (правилата на nc_003).
// Пълен път за два TEST апартамента с различно разпределение: геометрия → стил → сцена → преглед → панорами (рендер/качване) → проверка → публикуване
// → публичен изглед; права, остарели отговори, отмяна, размер/повреден файл, NC409, остаряване, връщане. node --test api/_nc-tours.test.js
"use strict";
const test = require("node:test"), assert = require("assert");
const K = require("./_nc-tours-testkit.js"), F = require("./_nc-tours-fixtures.js"), T = require("./_nc-tours-core.js");
const NC = require("./_nc-tools.js"), TOURS = require("./_nc-tours.js");

const PG = K.loadPg();
async function call(ctx, name, input) {
  const tool = NC.tools[name]; assert.ok(tool, "няма инструмент " + name);
  const p = tool.input.safeParse(input);
  if (!p.success) { const e = new Error("Invalid input: " + JSON.stringify(p.error.issues)); e.status = 400; e.code = "INVALID_INPUT"; e.issues = p.error.issues; throw e; }
  return tool.run(ctx, p.data);
}
async function rejects(p, status, code, label) {
  try { await p; } catch (e) { assert.strictEqual(e.status, status, (label || "") + ": " + e.message); if (code) assert.strictEqual(e.code, code, (label || "") + ": " + e.message); return e; }
  assert.fail((label || "") + ": очаквана грешка " + status);
}

test("TASK-010 инструменти – пълен път за 2 апартамента + отрицателни случаи", { skip: !PG && "няма PGlite" }, async (t) => {
  const k = await K.makeDb();
  const store = k.storage;
  TOURS._setBackend({
    ready: () => true,
    rpc: (fn, a) => k.rpc("service_role", null, fn, a),
    download: async (p, max) => { const b = store.get(p); if (!b) return { ok: false, code: "FILE_MISSING" }; if (b.length > max) return { ok: false, code: "FILE_TOO_LARGE" }; return { ok: true, buf: b }; },
    upload: async (p, buf) => { try { store.put("service_role", null, p, buf); return "ok"; } catch (e) { return e.status === 409 ? "exists" : "failed"; } },
    remove: async (p) => store.del(p)
  });
  const ctx = (uid, email) => ({ sb: k.client("authenticated", uid), userId: uid, user: { id: uid, email }, token: "TEST" });
  const A = ctx(K.ADMIN, "admin@test.local"), BR = ctx(K.BROKER, "broker@test.local"), OUT = ctx(K.OUTSIDER, "x@test.local");
  const adminPut = (p, buf) => store.put("authenticated", K.ADMIN, p, buf);
  let P, B, U1, U2, G1, S1, R1, SETB;

  await t.test("подготовка (TEST проект, обекти TEST-A1 и TEST-B2)", async () => {
    await k.as("authenticated", K.BROKER, async () => {
      P = (await k.q("insert into nd_projects(name, data) values ('TEST', $1) returning *", [JSON.stringify({ title: "TEST-Проект 360" })]))[0];
      B = (await k.q("insert into nd_buildings(project_id, name) values ($1,'TEST Сграда') returning *", [P.id]))[0];
      const f = (await k.q("insert into nd_floors(project_id, building_id, level) values ($1,$2,2) returning *", [P.id, B.id]))[0];
      U1 = (await k.q("insert into nd_units(project_id, building_id, floor_id, code, area_total, area_net, terrace_area, price_per_m2, data) values ($1,$2,$3,'TEST-A1',61.5,52.17,6.94,2000,'{\"rooms\":2}') returning *", [P.id, B.id, f.id]))[0];
      U2 = (await k.q("insert into nd_units(project_id, building_id, floor_id, code, area_total, area_net, price_per_m2, data) values ($1,$2,$3,'TEST-B2',89.4,76.2,2000,'{\"rooms\":3}') returning *", [P.id, B.id, f.id]))[0];
    });
  });

  await t.test("договори: невалиден вход и забранени полета се отказват преди изпълнение", async () => {
    await rejects(call(A, "interior.geometry_save", { unit_id: "BAD ID", geometry: {}, source: "plan_manual" }), 400);
    await rejects(call(A, "interior.geometry_save", { unit_id: U1.id, geometry: { investor: "X" }, source: "plan_manual" }), 400);
    await rejects(call(A, "tour.report", { job_id: "00000000-0000-4000-8000-000000000000", panorama_set_id: "abcdefgh", room_id: "hall", rev: 1, upload_path: "projects/abcdefgh/private/plans/x.jpg" }), 400, null, "път извън private/tours");
    await rejects(call(A, "tour.publish", { unit_id: U1.id, expected_version: 0, confirm: true }), 400, null, "без какво");
    await rejects(call(A, "tour.publish", { unit_id: U1.id, panorama_set_id: "abcdefgh", expected_version: 0 }), 400, null, "без confirm");
  });

  await t.test("010.116 права: брокер не прави интериор/рендер/публикуване; не-служител не чете; брокер чете и записва стил", async () => {
    await rejects(call(BR, "interior.geometry_save", { unit_id: U1.id, geometry: F.testA1(), source: "plan_manual" }), 403, "FORBIDDEN");
    await rejects(call(BR, "interior.prepare", { unit_id: U1.id }), 403, "FORBIDDEN");
    await rejects(call(BR, "tour.render", { unit_id: U1.id, source: "photo", idempotency_key: "broker-try-1" }), 403, "FORBIDDEN");
    await rejects(call(OUT, "tour.get", { unit_id: U1.id }), 403, "FORBIDDEN");
    const g = await call(BR, "tour.get", { unit_id: U1.id });
    assert.ok(g.blocked.length && /Няма въведена геометрия/.test(g.blocked[0]));
    const s = await call(BR, "interior.style_save", { project_id: P.id, building_id: B.id, brief: { style_system: "japandi" } });
    assert.ok(s.ok && s.version === 1);
  });

  await t.test("010.119 без проверена геометрия → BLOCKED (нищо не се досеща); непълна геометрия се записва като чернова, но не се потвърждава", async () => {
    const r = await call(A, "interior.prepare", { unit_id: U1.id });
    assert.strictEqual(r.ok, false); assert.strictEqual(r.state, "blocked"); assert.strictEqual(r.error_code, "GEOMETRY_MISSING"); assert.strictEqual(r.scene_version_id, null);
    const bad = F.testA1(); bad.openings[0].wall = "nope";
    const inv = await call(A, "interior.geometry_save", { unit_id: U1.id, geometry: bad, source: "plan_manual" });
    assert.strictEqual(inv.ok, false); assert.strictEqual(inv.state, "invalid");
    const nh = await call(A, "interior.geometry_save", { unit_id: U1.id, geometry: F.testNoHeights(), source: "plan_manual", source_ref: "TEST план без височини" });
    assert.strictEqual(nh.state, "blocked"); assert.ok(nh.blocked.length === 5);
    await rejects(call(A, "interior.geometry_verify", { geometry_id: nh.geometry_id, expected_sha256: nh.sha256, confirm: true }), 400, "INVALID_INPUT");
    const r2 = await call(A, "tour.render", { unit_id: U1.id, source: "photo", idempotency_key: "nogeom-0001" });
    assert.strictEqual(r2.state, "blocked");
  });

  await t.test("010.122 A1: геометрия → потвърждение → стил (собствен на апартамента) → сцена → проверка → одобрение", async () => {
    G1 = await call(A, "interior.geometry_save", { unit_id: U1.id, geometry: F.testA1(), source: "plan_manual", source_ref: "TEST план A1, plan_rev 1" });
    assert.strictEqual(G1.state, "draft"); assert.strictEqual(G1.version, 2);
    await rejects(call(A, "interior.geometry_verify", { geometry_id: G1.geometry_id, expected_sha256: "0".repeat(64), confirm: true }), 409, "DB_CONFLICT");
    const v = await call(A, "interior.geometry_verify", { geometry_id: G1.geometry_id, expected_sha256: G1.sha256, confirm: true });
    assert.strictEqual(v.status, "verified");
    const st = await call(A, "interior.style_save", { project_id: P.id, unit_id: U1.id, brief: { style_system: "scandinavian", lighting: "warm" } });
    S1 = await call(A, "interior.prepare", { unit_id: U1.id });
    assert.strictEqual(S1.state, "needs_review", JSON.stringify(S1.issues)); assert.strictEqual(S1.style_system, "scandinavian", "стилът на апартамента е с предимство пред сградата");
    const again = await call(A, "interior.prepare", { unit_id: U1.id });
    assert.strictEqual(again.scene_version_id, S1.scene_version_id); assert.strictEqual(again.replayed, true); assert.strictEqual(again.sha256, S1.sha256);
    await rejects(call(A, "interior.prepare", { unit_id: U1.id, idempotency_key: "scene-new-0001", expected_version: 7 }), 409, "DB_CONFLICT");
    const sc = await call(BR, "interior.get_scene", { scene_version_id: S1.scene_version_id });
    assert.strictEqual(T.canon(sc.scene.architecture), T.canon(T.architectureOf(F.testA1())));
    const val = await call(A, "interior.validate", { scene_version_id: S1.scene_version_id });
    assert.ok(val.ok); assert.strictEqual(val.status, "review");
    const ap = await call(A, "interior.approve", { scene_version_id: S1.scene_version_id, decision: "approve", note: "TEST преглед", confirm: true });
    assert.strictEqual(ap.status, "approved");
    assert.ok(st.ok);
  });

  await t.test("010.070 / 010.072 / 010.076 / 010.118 рендер от сцената (preview): задача, напредък, отказ на лош файл без повтаряне, остарял отговор, преглед", async () => {
    R1 = await call(A, "tour.render", { unit_id: U1.id, source: "scene_render", quality: "preview", rooms: ["hall", "living", "bedroom"], idempotency_key: "a1-prev-0001", want_uploads: true });
    assert.strictEqual(R1.state, "running"); assert.ok(R1.job_id && R1.panorama_set_id); assert.strictEqual(R1.out_width, 2048);
    const again = await call(A, "tour.render", { unit_id: U1.id, source: "scene_render", quality: "preview", rooms: ["hall", "living", "bedroom"], idempotency_key: "a1-prev-0001", want_uploads: true });
    assert.strictEqual(again.panorama_set_id, R1.panorama_set_id); assert.strictEqual(again.job_id, R1.job_id); assert.strictEqual(again.replayed, true);
    const js = await call(BR, "jobs.status", { id: R1.job_id });
    assert.strictEqual(js.status, "running"); assert.strictEqual(js.progress.rooms_total, 3); assert.strictEqual(js.waiting_for_worker, false);
    const up = (room, rev, buf) => { const p = R1.uploads.prefix + "/" + room + "-r" + rev + ".jpg"; adminPut(p, buf); return p; };
    /* брокер не може да качи в private/tours (правилата на хранилището) */
    assert.throws(() => store.put("authenticated", K.BROKER, R1.uploads.prefix + "/hall-r9.jpg", Buffer.from("x")));
    let r = await call(A, "tour.report", { job_id: R1.job_id, panorama_set_id: R1.panorama_set_id, room_id: "hall", rev: 1, upload_path: up("hall", 1, F.testPano(2000, 1024)) });
    assert.strictEqual(r.ok, false); assert.strictEqual(r.error_code, "NOT_EQUIRECT"); assert.strictEqual(r.retryable, false);
    const broken = F.testPano(2048, 1024); r = await call(A, "tour.report", { job_id: R1.job_id, panorama_set_id: R1.panorama_set_id, room_id: "hall", rev: 2, upload_path: up("hall", 2, Buffer.concat([broken.subarray(0, 3000), Buffer.alloc(100)])) });
    assert.strictEqual(r.ok, false); assert.ok(["FILE_CORRUPT", "FILE_UNSUPPORTED"].includes(r.error_code)); assert.strictEqual(r.retryable, false);
    const j1 = await call(BR, "jobs.status", { id: R1.job_id }); assert.strictEqual(j1.attempts, 1, "лошите файлове не харчат опити"); assert.strictEqual(j1.status, "running");
    r = await call(A, "tour.report", { job_id: R1.job_id, panorama_set_id: R1.panorama_set_id, room_id: "hall", rev: 3, upload_path: up("hall", 3, F.testPano(2048, 1024)) });
    assert.ok(r.ok); assert.deepStrictEqual(r.progress, { rooms_done: 1, rooms_total: 3 }); assert.strictEqual(r.item.w, 2048);
    const stale = await rejects(call(A, "tour.report", { job_id: R1.job_id, panorama_set_id: R1.panorama_set_id, room_id: "hall", rev: 2, upload_path: up("hall", 2, F.testPano(2048, 1024)) }), 409, "STALE_CALLBACK");
    assert.ok(/по-нов/.test(stale.message));
    assert.ok(!store.list().some((p) => /\/src\//.test(p)), "временните рендери се махат (за scene_render се пази само производната)");
    await rejects(call(A, "tour.report", { job_id: R1.job_id, panorama_set_id: R1.panorama_set_id, room_id: "hall", rev: 4, upload_path: R1.uploads.prefix + "/living-r4.jpg" }), 400, "INVALID_INPUT", "път на друга стая");
    await call(A, "tour.report", { job_id: R1.job_id, panorama_set_id: R1.panorama_set_id, room_id: "living", rev: 1, upload_path: up("living", 1, F.testPano(2048, 1024, { hue: 2 })) });
    r = await call(A, "tour.report", { job_id: R1.job_id, panorama_set_id: R1.panorama_set_id, room_id: "bedroom", rev: 1, upload_path: up("bedroom", 1, F.testPano(4096, 2048, { hue: 4 })) });
    assert.strictEqual(r.state, "needs_review", JSON.stringify(r.issues)); assert.strictEqual(r.requires_review, true); assert.strictEqual(r.item.w, 2048, "предварителният е 2048 дори от 4096");
    const j2 = await call(BR, "jobs.status", { id: R1.job_id }); assert.strictEqual(j2.status, "review"); assert.strictEqual(j2.requires_review, true);
    const derived = store.list().filter((p) => p.startsWith(R1.uploads.prefix.replace(/\/src$/, "")));
    assert.strictEqual(derived.length, 3); derived.forEach((p) => assert.deepStrictEqual(T.imageInfo(store.get(p)).w, 2048));
  });

  await t.test("010.076 / 010.078 проверка на артефактите: подменен файл се хваща; редакция с NC409; публикуване", async () => {
    const v = await call(A, "tour.validate", { panorama_set_id: R1.panorama_set_id });
    assert.ok(v.ok, JSON.stringify(v.issues));
    const tg = await call(A, "tour.get", { unit_id: U1.id, view: "full" });
    const set = tg.sets.find((x) => x.id === R1.panorama_set_id);
    const p = Object.values((await k.rpc("service_role", null, "nd_tour_paths", { p_set_id: R1.panorama_set_id })).items)[0].path, orig = store.get(p);
    store.map.set(p, F.testPano(2048, 1024, { hue: 5 }));
    const v2 = await call(A, "tour.validate", { panorama_set_id: R1.panorama_set_id });
    assert.ok(!v2.ok && v2.issues.some((x) => x.code === "ARTIFACT_CHANGED"));
    store.map.set(p, orig);
    await rejects(call(A, "tour.edit", { panorama_set_id: R1.panorama_set_id, expected_version: 9, order: ["living", "hall", "bedroom"] }), 409, "DB_CONFLICT");
    const e = await call(A, "tour.edit", { panorama_set_id: R1.panorama_set_id, expected_version: set.edit_version, order: ["living", "hall", "bedroom"], items: [{ room_id: "living", start_yaw: 180 }] });
    assert.strictEqual(e.edit_version, set.edit_version + 1);
    const v3 = await call(A, "tour.validate", { panorama_set_id: R1.panorama_set_id }); assert.ok(v3.ok);
    await rejects(call(A, "tour.publish", { unit_id: U1.id, panorama_set_id: R1.panorama_set_id, scene_version_id: S1.scene_version_id, expected_version: 3, confirm: true }), 409, "DB_CONFLICT");
    const pub = await call(A, "tour.publish", { unit_id: U1.id, panorama_set_id: R1.panorama_set_id, scene_version_id: S1.scene_version_id, expected_version: 0, confirm: true });
    assert.strictEqual(pub.version, 1); assert.strictEqual(pub.media, 3);
    const j = await call(BR, "jobs.status", { id: R1.job_id }); assert.strictEqual(j.status, "done");
  });

  await t.test("010.123 / 010.068 / 010.066 публичен изглед: свободен → стаи, миниатюри, преходи, карта, сцена; капариран → само печат; /pano/ – нищо", async () => {
    await k.as("service_role", null, () => k.q("update nd_projects set status='published', slug='test-360' where id=$1", [P.id]));
    let pt = await k.rpc("anon", null, "nd_public_tour", { p_unit_id: U1.id });
    assert.deepStrictEqual(pt.tour.rooms.map((r) => r.room_id), ["living", "hall", "bedroom"]);
    assert.ok(pt.tour.rooms.every((r) => /^data:image\/jpeg;base64,/.test(r.thumb)));
    assert.ok(pt.tour.rooms.find((r) => r.room_id === "hall").hotspots.some((h) => h.to_room === "living"));
    assert.strictEqual(pt.tour.rooms.find((r) => r.room_id === "living").start_yaw, 180);
    assert.ok(pt.tour.scene && pt.tour.scene.furniture.length > 10 && pt.tour.minimap.rooms.length === 6);
    assert.match(pt.tour.label, /примерно обзавеждане/);
    assert.ok(!/private\//.test(JSON.stringify(pt)));
    const r1 = await k.rpc("service_role", null, "nd_pano_resolve", { p_unit_id: U1.id, p_n: 1 });
    assert.ok(store.has(r1.path) && /\/hall-/.test(r1.path));
    const v = (await k.as("service_role", null, () => k.q("select version from nd_units where id=$1", [U1.id])))[0].version;
    await k.rpc("authenticated", K.BROKER, "nd_unit_set_status", { p_unit_id: U1.id, p_to: "reserved", p_expected_version: v, p_event_id: null, p_note: null, p_client_id: null, p_deal_id: null });
    pt = await k.rpc("anon", null, "nd_public_tour", { p_unit_id: U1.id });
    assert.deepStrictEqual(pt, { unit_id: U1.id, code: "TEST-A1", locked: true, status: "reserved" });
    assert.strictEqual(await k.rpc("service_role", null, "nd_pano_resolve", { p_unit_id: U1.id, p_n: 0 }), null);
    const a = await call(BR, "tour.get_authorized_asset", { panorama_set_id: R1.panorama_set_id, room_id: "living" });
    assert.ok(/^https:\/\/test\.invalid\/sign\//.test(a.url) && a.expires_in === 60, "екипът вижда и при капариран (010.069)");
    await rejects(call(OUT, "tour.get_authorized_asset", { panorama_set_id: R1.panorama_set_id, room_id: "living" }), 403, "FORBIDDEN");
    await k.rpc("authenticated", K.ADMIN, "nd_unit_set_status", { p_unit_id: U1.id, p_to: "free", p_expected_version: v + 1, p_event_id: null, p_note: "TEST", p_client_id: null, p_deal_id: null });
  });

  await t.test("010.124 / 010.120 B2 (друго разпределение, стил по сграда): истински панорами (photo, final 4096), посока и преходи от човек, проверка, публикуване", async () => {
    const g = await call(A, "interior.geometry_save", { unit_id: U2.id, geometry: F.testB2(), source: "ifc", source_ref: "TEST-IFC B2 (служебен)" });
    await call(A, "interior.geometry_verify", { geometry_id: g.geometry_id, expected_sha256: g.sha256, confirm: true });
    const sc = await call(A, "interior.prepare", { unit_id: U2.id });
    assert.strictEqual(sc.state, "needs_review", JSON.stringify(sc.issues)); assert.strictEqual(sc.style_system, "japandi", "стилът на сградата");
    const rooms = ["hall", "corr", "living", "kitchen", "bed2"];
    SETB = await call(A, "tour.render", { unit_id: U2.id, source: "photo", quality: "final", rooms, idempotency_key: "b2-photo-0001", want_uploads: true });
    for (const r of rooms) {
      const p = SETB.uploads.prefix + "/" + r + "-r1.jpg"; adminPut(p, F.testPano(4096, 2048, { hue: rooms.indexOf(r) }));
      const out = await call(A, "tour.report", { job_id: SETB.job_id, panorama_set_id: SETB.panorama_set_id, room_id: r, rev: 1, upload_path: p });
      assert.ok(out.ok, JSON.stringify(out));
    }
    assert.ok(store.has(SETB.uploads.prefix + "/hall-r1.jpg"), "оригиналът на снимка се пази (частно)");
    let tg = await call(A, "tour.get", { unit_id: U2.id, view: "full" }), set = tg.sets.find((x) => x.id === SETB.panorama_set_id);
    /* човек завърта панорамата на коридора на 90° и добавя невалиден преход (коридор → спалня 2 нямат врата) */
    const corrHs = set.items.corr.hotspots.map((h) => ({ to_room: h.to_room, yaw: (h.yaw + 90) % 360, pitch: h.pitch })).concat([{ to_room: "bed2", yaw: 10, pitch: -20 }]);
    await call(A, "tour.edit", { panorama_set_id: SETB.panorama_set_id, expected_version: set.edit_version, items: [{ room_id: "corr", yaw_offset: 90, hotspots: corrHs }] });
    let v = await call(A, "tour.validate", { panorama_set_id: SETB.panorama_set_id });
    assert.ok(!v.ok && v.issues.some((x) => x.code === "HOTSPOT_INVALID") && v.issues.some((x) => x.code === "ORIENTATION"), JSON.stringify(v.issues));
    tg = await call(A, "tour.get", { unit_id: U2.id, view: "full" }); set = tg.sets.find((x) => x.id === SETB.panorama_set_id);
    const fixed = set.items.corr.hotspots.filter((h) => h.to_room !== "bed2").map((h) => ({ to_room: h.to_room, yaw: (h.yaw + 270) % 360, pitch: h.pitch }));
    await call(A, "tour.edit", { panorama_set_id: SETB.panorama_set_id, expected_version: set.edit_version, items: [{ room_id: "corr", yaw_offset: 90, hotspots: fixed }] });
    v = await call(A, "tour.validate", { panorama_set_id: SETB.panorama_set_id });
    assert.ok(v.ok, JSON.stringify(v.issues));
    const pub = await call(A, "tour.publish", { unit_id: U2.id, panorama_set_id: SETB.panorama_set_id, expected_version: 0, confirm: true });
    assert.strictEqual(pub.media, 5);
    const pt = await k.rpc("anon", null, "nd_public_tour", { p_unit_id: U2.id });
    assert.strictEqual(pt.tour.source, "photo"); assert.strictEqual(pt.tour.label, "Реална снимка 360°."); assert.strictEqual(pt.tour.scene, null, "без 3D сцена в тази публикация");
    assert.strictEqual(pt.tour.rooms.find((r) => r.room_id === "corr").yaw_offset, 90);
  });

  await t.test("010.073 / 010.079 отмяна: jobs.cancel → следващият отчет спира, файловете на набора се махат, нищо не се публикува", async () => {
    const r = await call(A, "tour.render", { unit_id: U1.id, source: "scene_render", quality: "final", rooms: ["hall", "living"], idempotency_key: "a1-final-0001", want_uploads: true });
    const p1 = r.uploads.prefix + "/hall-r1.jpg"; adminPut(p1, F.testPano(4096, 2048));
    const ok = await call(A, "tour.report", { job_id: r.job_id, panorama_set_id: r.panorama_set_id, room_id: "hall", rev: 1, upload_path: p1 });
    assert.ok(ok.ok);
    const c = await call(BR, "jobs.cancel", { id: r.job_id }).catch((e) => e);
    assert.ok(c instanceof Error && c.status === 403, "брокер не отменя чужда задача");
    const ca = await call(A, "jobs.cancel", { id: r.job_id });
    assert.strictEqual(ca.cancel_requested, true);
    const p2 = r.uploads.prefix + "/living-r1.jpg"; adminPut(p2, F.testPano(4096, 2048));
    const out = await call(A, "tour.report", { job_id: r.job_id, panorama_set_id: r.panorama_set_id, room_id: "living", rev: 1, upload_path: p2 });
    assert.strictEqual(out.state, "cancelled"); assert.strictEqual(out.retryable, false);
    assert.ok(!store.list().some((p) => p.includes("/" + r.panorama_set_id + "/")), "нищо от отменения набор не остава");
    assert.strictEqual((await call(BR, "jobs.status", { id: r.job_id })).status, "cancelled");
    const pt = await k.rpc("anon", null, "nd_public_tour", { p_unit_id: U1.id });
    assert.strictEqual(pt.tour.version, 1, "публикуваното е непроменено");
  });

  await t.test("010.073 отмяна без следващ отчет: jobs.cancel → tour.get затваря набора веднага и маха файловете му", async () => {
    const r = await call(A, "tour.render", { unit_id: U1.id, source: "photo", quality: "final", rooms: ["hall", "living"], idempotency_key: "a1-photo-cancel-01", want_uploads: true });
    const p1 = r.uploads.prefix + "/hall-r1.jpg"; adminPut(p1, F.testPano(4096, 2048));
    assert.ok((await call(A, "tour.report", { job_id: r.job_id, panorama_set_id: r.panorama_set_id, room_id: "hall", rev: 1, upload_path: p1 })).ok);
    assert.ok(store.list().some((p) => p.includes("/" + r.panorama_set_id + "/")), "има качен файл в набора");
    await call(A, "jobs.cancel", { id: r.job_id });
    const st = await call(BR, "tour.get", { unit_id: U1.id });
    const set = st.sets.find((x) => x.id === r.panorama_set_id);
    assert.strictEqual(set.status, "cancelled", "наборът е затворен без да чака tour.report");
    assert.ok(!store.list().some((p) => p.includes("/" + r.panorama_set_id + "/")), "файловете на отменения набор са махнати");
    assert.strictEqual((await call(BR, "jobs.status", { id: r.job_id })).status, "cancelled");
    assert.strictEqual(st.published.version, 1, "публикуваното е непроменено");
  });

  await t.test("010.078 нова заявка отменя по-старата; отговор от старата → отказан и файлът махнат", async () => {
    const r1 = await call(A, "tour.render", { unit_id: U1.id, source: "scene_render", quality: "preview", rooms: ["hall"], idempotency_key: "a1-race-0001", want_uploads: true });
    const r2 = await call(A, "tour.render", { unit_id: U1.id, source: "scene_render", quality: "preview", rooms: ["hall"], idempotency_key: "a1-race-0002", want_uploads: true });
    assert.deepStrictEqual(r2.cancelled_previous, [r1.panorama_set_id]);
    const p = r1.uploads.prefix + "/hall-r1.jpg"; adminPut(p, F.testPano(2048, 1024));
    const out = await call(A, "tour.report", { job_id: r1.job_id, panorama_set_id: r1.panorama_set_id, room_id: "hall", rev: 1, upload_path: p });
    assert.strictEqual(out.state, "cancelled"); assert.ok(!store.has(p));
    await call(A, "jobs.cancel", { id: r2.job_id });
  });

  await t.test("размер: файл над 25 MB → отказ (без да се декодира)", async () => {
    const r = await call(A, "tour.render", { unit_id: U1.id, source: "designer_render", quality: "preview", rooms: ["hall"], idempotency_key: "a1-big-0001", want_uploads: true });
    const p = r.uploads.prefix + "/hall-r1.jpg"; adminPut(p, Buffer.alloc(26 * 1048576, 7));
    const out = await call(A, "tour.report", { job_id: r.job_id, panorama_set_id: r.panorama_set_id, room_id: "hall", rev: 1, upload_path: p });
    assert.strictEqual(out.ok, false); assert.strictEqual(out.error_code, "FILE_TOO_LARGE"); assert.strictEqual(out.retryable, false);
    await call(A, "jobs.cancel", { id: r.job_id });
  });

  await t.test("010.128 / 010.129 проследимост до геометрията и връщане: нова геометрия → публикуваното става остаряло и се сваля; старият набор не се публикува върху новата", async () => {
    const tg = await call(A, "tour.get", { unit_id: U1.id });
    const pub = tg.published; assert.ok(pub && pub.geometry_id === G1.geometry_id && pub.scene_version_id === S1.scene_version_id && pub.pano_set_id === R1.panorama_set_id);
    const g2 = F.testA1(); g2.default_height_m = 2.8;
    const n = await call(A, "interior.geometry_save", { unit_id: U1.id, geometry: g2, source: "plan_manual", source_ref: "TEST ревизия" });
    const v = await call(A, "interior.geometry_verify", { geometry_id: n.geometry_id, expected_sha256: n.sha256, confirm: true });
    assert.strictEqual(v.stale[G1.geometry_id].tours, 1);
    const pt = await k.rpc("anon", null, "nd_public_tour", { p_unit_id: U1.id }); assert.strictEqual(pt.tour, null);
    await rejects(call(A, "tour.publish", { unit_id: U1.id, panorama_set_id: R1.panorama_set_id, expected_version: 0, confirm: true }), 409, "DB_CONFLICT");
    const s2 = await call(A, "interior.prepare", { unit_id: U1.id }); assert.strictEqual(s2.version, 2);
  });

  await t.test("Тед: tours.request (scene/pano) – една стъпка, честни състояния; nc.help ги описва", async () => {
    const r = await call(A, "tours.request", { unit_id: U2.id, mode: "scene", style: "Скандинавски" });
    assert.strictEqual(r.ok, true); assert.strictEqual(r.style_system, "scandinavian");
    const r2 = await call(A, "tours.request", { unit_id: U2.id, mode: "pano", rooms: ["hall", "corr"] });
    assert.ok(r2.job_id && r2.state === "running" && /рендерът се прави в CRM/.test(r2.next));
    await call(A, "jobs.cancel", { id: r2.job_id });
    const h = await call(BR, "nc.help", { tool: "tour.render" }); assert.ok(/tour_render|360/.test(h.tools[0].description));
  });
});

test("без nc_006 → 503 DOWNSTREAM_UNAVAILABLE (нищо не се записва)", { skip: !PG && "няма PGlite" }, async () => {
  const k = await K.makeDb({ skip006: true });
  TOURS._setBackend({ ready: () => true, rpc: (fn, a) => k.rpc("service_role", null, fn, a), download: async () => ({ ok: false }), upload: async () => "failed", remove: async () => true });
  const ctx = { sb: k.client("authenticated", K.ADMIN), userId: K.ADMIN, user: { email: "a@test.local" } };
  await rejects(call(ctx, "tour.get", { unit_id: "abcdefgh1" }), 503, "DOWNSTREAM_UNAVAILABLE");
  TOURS._setBackend(null);
});
