// TASK-010 · чисти функции: геометрия, стил → материали, сцена, колизии/навигация, горещи точки, панорами. node --test api/_nc-tours-core.test.js
"use strict";
const test = require("node:test"), assert = require("assert");
const T = require("./_nc-tours-core.js"), A = require("./_nc-tours-assets.js"), F = require("./_nc-tours-fixtures.js");

const A1 = () => F.testA1(), B2 = () => F.testB2();
const built = { a: T.buildScene(A1(), { style_system: "scandinavian" }, { unit_id: "TESTA1" }), b: T.buildScene(B2(), { style_system: "japandi" }, { unit_id: "TESTB2" }) };

test("010.007–012 геометрия: валидна A1 и B2, контролна сума, ориентация, отвори по стените", () => {
  for (const g of [A1(), B2()]) { const v = T.validateGeometry(g); assert.ok(v.ok, v.errors.join("; ")); assert.deepStrictEqual(v.blocked, []); assert.match(v.sha256, /^[a-f0-9]{64}$/); }
  assert.notStrictEqual(T.validateGeometry(A1()).sha256, T.validateGeometry(B2()).sha256);
  assert.strictEqual(T.validateGeometry(A1()).stats.exposure, "Юг / Изток");
});

test("010.014 / 010.119 липсваща архитектурна информация → BLOCKED, сцена не се прави (не се досещаме)", () => {
  const nh = T.validateGeometry(F.testNoHeights());
  assert.ok(nh.ok && nh.blocked.length === 5);
  assert.strictEqual(T.buildScene(F.testNoHeights(), {}, {}).state, "blocked");
  const g = A1(); delete g.north_deg; assert.ok(T.validateGeometry(g).blocked.some((x) => /ориентация/.test(x)));
  const g2 = A1(); g2.openings = g2.openings.filter((o) => o.id !== "d_sto"); assert.ok(T.validateGeometry(g2).blocked.some((x) => /storage не е свързано/.test(x)));
  const g3 = A1(); g3.openings = g3.openings.filter((o) => o.id !== "entr"); assert.ok(T.validateGeometry(g3).blocked.some((x) => /входна врата/.test(x)));
});

test("010.008–011 невалидни данни се отказват (повторен id, отвор извън стената, отвор не на границата, самопресичане)", () => {
  const g = A1(); g.rooms.push(Object.assign({}, g.rooms[0])); assert.ok(T.validateGeometry(g).errors.some((e) => /повторен id/.test(e)));
  const g2 = A1(); g2.openings[0].offset_m = 8.0; assert.ok(T.validateGeometry(g2).errors.some((e) => /извън стената/.test(e)));
  const g3 = A1(); g3.openings.find((o) => o.id === "d_bed").rooms = ["hall", "bath"]; assert.ok(T.validateGeometry(g3).errors.some((e) => /не е на границата на bath/.test(e)));
  const g4 = A1(); g4.rooms[0].polygon = [[0, 0], [2, 2], [2, 0], [0, 2]]; assert.ok(T.validateGeometry(g4).errors.some((e) => /самопресича/.test(e)));
  const g5 = A1(); g5.openings[1].height_m = 3.5; g5.walls.find((w) => w.id === "w_bh").height_m = 2.7; assert.ok(T.validateGeometry(g5).errors.some((e) => /по-висок от стената/.test(e)));
});

test("010.112 / 010.015 / 010.025 геометрията е неизменяема при стилизиране; стилът не може да пипа архитектурата", () => {
  const g = A1(), before = T.canon(g);
  const s = T.buildScene(g, { style_system: "mediterranean", palette: ["#ffffff", "#aa5533"] }, {});
  assert.strictEqual(T.canon(g), before, "входната геометрия не е променена");
  assert.strictEqual(T.canon(s.scene.architecture), T.canon(T.architectureOf(g)), "архитектурният слой = точно копие");
  const frozen = T.deepFreeze(JSON.parse(JSON.stringify(g)));
  assert.throws(() => { "use strict"; frozen.walls[0].a[0] = 9; }, TypeError);
  assert.throws(() => { "use strict"; T.materialsFor(frozen, { style_system: "minimalist" }); frozen.rooms[0].height_m = 9; }, TypeError);
  const bad = T.validateStyle({ style_system: "japandi", walls: [], extras: { height_m: 3 } });
  assert.ok(!bad.ok && /не може да променя архитектурата/.test(bad.errors[0]));
  /* подменена архитектура в сцената → проверката я хваща */
  const t = JSON.parse(JSON.stringify(built.a.scene)); t.architecture.walls[0].b[0] += 0.5;
  assert.ok(T.validateScene(t, A1()).issues.some((x) => x.code === "ARCH_MODIFIED"));
});

test("010.016–020 слоевете са отделни; 010.021–022 сцената сочи геометрията и е възпроизводима", () => {
  const s = built.a.scene;
  ["architecture", "materials", "furniture", "lighting", "backdrop", "navigation"].forEach((k) => assert.ok(s[k], k));
  assert.strictEqual(s.inputs.geometry_sha256, T.validateGeometry(A1()).sha256);
  const again = T.buildScene(A1(), { style_system: "scandinavian" }, { unit_id: "TESTA1" });
  assert.strictEqual(again.sha256, built.a.sha256, "същите входове → същата сцена");
  assert.notStrictEqual(T.buildScene(A1(), { style_system: "japandi" }, { unit_id: "TESTA1" }).sha256, built.a.sha256);
});

test("010.113 / 010.023–024 / 010.026 стил → материали: различен по апартамент и по сграда; собствена палитра; версия (сума)", () => {
  const m = (sys) => T.materialsFor(A1(), { style_system: sys });
  assert.strictEqual(m("scandinavian").surfaces["room:living:floor"], "oak_light_planks");
  assert.strictEqual(m("mediterranean").surfaces["room:living:floor"], "terracotta_tiles");
  assert.strictEqual(m("modern_classic").surfaces["room:bath:floor"], "tile_marble");
  assert.strictEqual(m("minimalist").surfaces["room:terrace:floor"], "deck_wpc");
  assert.ok(!m("minimalist").surfaces["room:terrace:ceiling"], "тераса без таван");
  const c = T.materialsFor(A1(), { style_system: "custom", palette: ["#112233", "#445566", "#778899"] });
  assert.strictEqual(c.defs[c.surfaces["room:living:wall"]].color, "#112233");
  const v1 = T.validateStyle({ style_system: "japandi" }), v2 = T.validateStyle({ style_system: "japandi", lighting: "cool" });
  assert.ok(v1.ok && v2.ok && v1.sha256 !== v2.sha256);
  assert.ok(!T.validateStyle({ style_system: "baroque" }).ok);
  assert.ok(!T.validateStyle({ materials: ["scraped_texture_from_web"] }).ok, "само елементи от библиотеката");
  assert.ok(!T.validateStyle({ backdrop: "sea_view" }).ok, "реална гледка без източник се отказва");
});

test("010.005 / 010.027–028 библиотеката: всеки елемент с произход, лиценз, реални размери, формат, бюджет, сума", () => {
  const m = A.licenseMatrix();
  assert.ok(m.assets.length >= 60);
  m.assets.forEach((a) => { assert.deepStrictEqual(a.issues, [], a.id); assert.ok(a.license && a.provenance && a.checksum && a.format); });
  built.a.scene.furniture.forEach((f) => { const c = A.CATALOG.furniture[f.asset]; assert.deepStrictEqual([f.w, f.d, f.h], [c.dims_m.w, c.dims_m.d, c.dims_m.h]); assert.strictEqual(f.conceptual, true); });
  assert.strictEqual(A.CATALOG.furniture.bed_double.dims_m.d, 2.1); assert.strictEqual(A.CATALOG.furniture.sofa_3.dims_m.w, 2.2);
  const t = JSON.parse(JSON.stringify(built.a.scene)); t.furniture[0].w = 0.5;
  assert.ok(T.validateScene(t, A1()).issues.some((x) => x.code === "ASSET_SCALE"));
  const u = JSON.parse(JSON.stringify(built.a.scene)); u.furniture[0].asset = "downloaded_sofa";
  assert.ok(T.validateScene(u, A1()).issues.some((x) => x.code === "ASSET_UNLICENSED"));
});

test("010.029–031 / 010.114 колизии и навигация: мебели извън стени и врати, пътищата са проходими, решетката не минава през стени", () => {
  for (const [s, g] of [[built.a, A1()], [built.b, B2()]]) {
    assert.deepStrictEqual(s.issues, [], JSON.stringify(s.issues));
    const v = T.validateScene(s.scene, g); assert.ok(v.ok, JSON.stringify(v.issues));
    assert.strictEqual(s.scene.navigation.nodes.length, g.rooms.length);
    assert.ok(s.scene.navigation.edges.filter((e) => e.walkable).length >= g.rooms.length - 1);
  }
  const env = T._.envOf(A1());
  built.a.scene.furniture.forEach((f) => env.walls.forEach((w) => assert.ok(!T._.rectsOverlap(T._.furnRect(f), w, 0.004), f.id + " в стена")));
  /* мебел преместена в стена / пред врата → хваща се */
  const t = JSON.parse(JSON.stringify(built.a.scene)); const sofa = t.furniture.find((f) => f.asset === "sofa_3"); sofa.x = 4.9;
  assert.ok(T.validateScene(t, A1()).issues.some((x) => x.code === "FURN_IN_WALL" || x.code === "FURN_OUTSIDE"));
  const t2 = JSON.parse(JSON.stringify(built.a.scene)); const wd = t2.furniture.find((f) => f.asset === "wardrobe_100" && f.room_id === "hall"); wd.x = 4.05; wd.y = 0.6; wd.rot = 0;
  assert.ok(T.validateScene(t2, A1()).issues.some((x) => x.code === "DOOR_BLOCKED" || x.code === "FURN_OVERLAP"));
  /* подменена решетка (проход през стена) → NAV_MISMATCH / NAV_THROUGH_WALL */
  const t3 = JSON.parse(JSON.stringify(built.a.scene)); t3.navigation.rle = [t3.navigation.w * t3.navigation.h].concat([]); t3.navigation.rle = [0, t3.navigation.w * t3.navigation.h];
  const i3 = T.validateScene(t3, A1()).issues.map((x) => x.code); assert.ok(i3.includes("NAV_MISMATCH") && i3.includes("NAV_THROUGH_WALL"));
  /* камерата никога не започва в препятствие (010.046) */
  const N = built.a.scene.navigation, grid = T._.unrle(N.rle, N.w * N.h), st = N.nodes.find((n) => n.id === N.start);
  const [ci, cj] = T._.cellOf(N, [st.x, st.y]); assert.strictEqual(grid[cj * N.w + ci], 1); assert.strictEqual(st.room_id, "hall");
});

test("010.120 различно разпределение (Г-образен B2 с 2 спални, коридор, кухня, баня + WC) минава същия процес", () => {
  const s = built.b.scene;
  assert.strictEqual(s.architecture.rooms.length, 10);
  assert.ok(s.furniture.filter((f) => f.asset === "bed_double").length === 2);
  assert.ok(s.furniture.some((f) => f.asset === "kitchen_run_240" && f.room_id === "kitchen"));
  assert.ok(s.navigation.edges.find((e) => e.via === "d_b2").walkable, "до спалня 2 се стига");
  assert.strictEqual(s.materials.style_system, "japandi");
});

test("010.033–036 фон зад прозорците: неутрален и отбелязан, източник/версия записани; „реална гледка“ без източник → грешка", () => {
  const b = built.a.scene.backdrop;
  assert.strictEqual(b.policy, "neutral"); assert.match(b.label, /не е реалната гледка/); assert.strictEqual(b.source, null); assert.strictEqual(b.version, 1);
  const t = JSON.parse(JSON.stringify(built.a.scene)); t.backdrop = { policy: "verified", label: "Гледка към морето", source: null };
  assert.ok(T.validateScene(t, A1()).issues.some((x) => x.code === "BACKDROP_UNVERIFIED"));
  assert.match(built.a.scene.labels.furniture, /Примерно обзавеждане/);
});

test("010.115 / 010.055–056 горещи точки: само към съседни стаи през врати; посоката отговаря на плана", () => {
  const nav = built.a.scene.navigation, hs = T.hotspotsFor(nav, ["hall", "living", "bedroom", "bath"]);
  assert.deepStrictEqual(hs.hall.map((h) => h.to_room).sort(), ["bath", "bedroom", "living", "storage"]);
  assert.strictEqual(hs.hall.find((h) => h.to_room === "storage").enabled, false, "стая без панорама → изключен преход");
  const items = ["hall", "living"].map((r) => ({ room_id: r, yaw_offset: 0, hotspots: hs[r].filter((h) => h.to_room === "hall" || h.to_room === "living").map((h) => ({ to_room: h.to_room, yaw: h.yaw, pitch: h.pitch })) }));
  assert.ok(T.validateHotspots(items, nav, "scene_render").ok);
  const bad = JSON.parse(JSON.stringify(items)); bad[1].hotspots.push({ to_room: "bath", yaw: 10, pitch: -20 });
  assert.ok(T.validateHotspots(bad, nav, "photo").issues.some((x) => x.code === "HOTSPOT_INVALID"), "living ↔ bath нямат врата");
  const rot = JSON.parse(JSON.stringify(items)); rot[0].hotspots[0].yaw = (rot[0].hotspots[0].yaw + 120) % 360;
  assert.ok(T.validateHotspots(rot, nav, "photo").issues.some((x) => x.code === "ORIENTATION"));
  const self = JSON.parse(JSON.stringify(items)); self[0].hotspots.push({ to_room: "hall", yaw: 0, pitch: 0 });
  assert.ok(T.validateHotspots(self, nav, "photo").issues.some((x) => x.code === "HOTSPOT_SELF"));
});

test("панорама: 2:1, размер, повреден файл, PNG; производна без EXIF + миниатюра", () => {
  const ok = F.testPano(2048, 1024);
  assert.deepStrictEqual(T.imageInfo(ok).w, 2048);
  assert.strictEqual(T.checkPano(F.testPano(2000, 1024), "preview").code, "NOT_EQUIRECT");
  assert.strictEqual(T.checkPano(F.testPano(1024, 512), "preview").code, "TOO_SMALL");
  assert.strictEqual(T.checkPano(ok, "final").code, "TOO_SMALL", "окончателният е поне 4096");
  assert.strictEqual(T.checkPano(Buffer.from("not an image at all, really not one"), "preview").code, "FILE_UNSUPPORTED");
  assert.strictEqual(T.checkPano(Buffer.alloc(26 * 1048576, 1), "preview").code, "FILE_TOO_LARGE");
  const broken = Buffer.concat([ok.subarray(0, 4000), Buffer.alloc(200, 0)]);
  const bd = T.panoDerivative(broken, "preview"); assert.strictEqual(bd.ok, false); assert.ok(["FILE_CORRUPT", "FILE_UNSUPPORTED"].includes(bd.code), bd.code);
  const exif = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]), Buffer.from("Exif\0\0GPS-TEST"), ok.subarray(2)]);
  const d = T.panoDerivative(exif, "preview");
  assert.ok(d.ok, d.message); assert.strictEqual(d.w, 2048); assert.strictEqual(d.h, 1024);
  assert.ok(!d.buf.includes(Buffer.from("GPS-TEST")), "метаданните са махнати");
  assert.match(d.thumb, /^data:image\/jpeg;base64,/); assert.ok(d.thumb.length < 40000);
  const big = T.panoDerivative(F.testPano(4096, 2048, { png: true }), "preview"); assert.ok(big.ok); assert.strictEqual(big.w, 2048, "предварителният е 2048");
});

test("010.104–105 размер на сцената и бюджет на текстурите (измерено)", () => {
  for (const s of [built.a, built.b]) {
    const bytes = Buffer.byteLength(JSON.stringify(s.scene));
    assert.ok(bytes < 120000, "сцена " + bytes + " B");
    assert.ok(s.scene.stats.texture_px <= 8 * 256 * 256, "процедурни текстури " + s.scene.stats.texture_px + " px");
    assert.ok(s.scene.stats.triangles < 5000, "триъгълници " + s.scene.stats.triangles);
  }
});
