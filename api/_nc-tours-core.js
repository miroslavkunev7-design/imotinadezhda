// ИМОТИ НАДЕЖДА · Ново строителство · TASK-010 · ядро без мрежа и без база (чисти функции – изпитват се отделно)
//   1) геометрия на апартамента (nd.unit_geometry.v1): проверка, липси → BLOCKED, контролна сума, граф на стаите;
//   2) стил (nd.style_brief.v1): проверка и стил → материали (стилът НЕ пипа архитектурата);
//   3) сцена (nd.scene.v1): детерминистичен строител – архитектура (замразено копие) | материали | мебели | осветление |
//      фон зад прозорците | навигация (решетка за ходене, камери по стаи, преходи през врати);
//   4) независима проверка на сцената (геометрия непроменена, мебели не влизат в стени/врати, пътищата са проходими);
//   5) горещи точки между стаи и проверка на ориентацията; 6) проверка и производна на равноправоъгълна панорама.
// Координати на плана: метри, x – надясно, y – нагоре по плана; посока (bearing) в градуси по часовника от +y на плана.
// north_deg = истинската посока (от север, по часовника) на +y на плана.
"use strict";
const crypto = require("crypto");
const A = require("./_nc-tours-assets.js");

const G_SCHEMA = "nd.unit_geometry.v1", S_SCHEMA = "nd.scene.v1", B_SCHEMA = "nd.style_brief.v1";
const GENERATOR = "nd-scene-gen@1";
const ROOM_TYPES = ["living", "living_kitchen", "kitchen", "dining", "bedroom", "child", "office", "bathroom", "wc", "hall", "corridor", "storage", "laundry", "terrace", "other"];
const ROOM_BG = { living: "Дневна", living_kitchen: "Дневна с кухня", kitchen: "Кухня", dining: "Трапезария", bedroom: "Спалня", child: "Детска стая", office: "Кабинет", bathroom: "Баня", wc: "Тоалетна", hall: "Входно антре", corridor: "Коридор", storage: "Килер", laundry: "Мокро помещение", terrace: "Тераса", other: "Помещение" };
const OPENING_TYPES = ["door", "window", "balcony_door", "passage"];
const PASSABLE = new Set(["door", "balcony_door", "passage"]);
const ID_RE = /^[a-z][a-z0-9_-]{0,39}$/;
const CELL = 0.1, BODY_R = 0.2, EYE_H = 1.6;
const LABELS = {
  furniture: "Примерно обзавеждане – мебелите и материалите са илюстрация, не са част от продажбата.",
  backdrop_neutral: "Неутрален фон зад прозорците – не е реалната гледка от апартамента.",
  photo: "Реална снимка 360°.",
  designer_render: "Визуализация 360° от дизайнер – примерно обзавеждане.",
  scene_render: "Рендер 360° от 3D сцената – примерно обзавеждане."
};

const canon = A.canon, sha = A.sha;
const shaBuf = (b) => crypto.createHash("sha256").update(b).digest("hex");
const r3 = (n) => Math.round(n * 1000) / 1000;
const fin = (n) => typeof n === "number" && isFinite(n);
function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach((k) => deepFreeze(o[k])); } return o; }
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------------- 2D геометрия ---------------- */
function area(p) { let s = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += (p[j][0] * p[i][1] - p[i][0] * p[j][1]); return s / 2; }
function centroid(p) { let x = 0, y = 0, a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const f = p[j][0] * p[i][1] - p[i][0] * p[j][1]; x += (p[j][0] + p[i][0]) * f; y += (p[j][1] + p[i][1]) * f; a += f; } if (Math.abs(a) < 1e-9) return [p[0][0], p[0][1]]; return [x / (3 * a), y / (3 * a)]; }
function pip(pt, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
function edgeDist(p, poly) { let m = Infinity; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) m = Math.min(m, segDist(p, poly[j], poly[i])); return m; }
function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
function segX(a, b, c, d) { const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d); return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9)); }
function selfIntersects(p) { const n = p.length; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue; if (segX(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true; } return false; }
const bearing = (dx, dy) => { let b = (Math.atan2(dx, dy) * 180) / Math.PI; if (b < 0) b += 360; return r3(b) % 360; };
const angDiff = (a, b) => { let d = ((a - b) % 360 + 540) % 360 - 180; return Math.abs(d); };
const dirOf = (deg) => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];
/* ориентиран правоъгълник: център c, ос u (по ширината), ос v (по дълбочината / лицето), полуразмери hw, hd */
function rect(c, th, w, d) { const v = dirOf(th), u = [v[1], -v[0]]; return { c, u, v, hw: w / 2, hd: d / 2, th }; }
function corners(R) { const { c, u, v, hw, hd } = R; return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c[0] + u[0] * hw * a + v[0] * hd * b, c[1] + u[1] * hw * a + v[1] * hd * b]); }
function inRect(p, R, pad) { const dx = p[0] - R.c[0], dy = p[1] - R.c[1]; return Math.abs(dx * R.u[0] + dy * R.u[1]) <= R.hw + (pad || 0) && Math.abs(dx * R.v[0] + dy * R.v[1]) <= R.hd + (pad || 0); }
function rectsOverlap(A1, B1, margin) {
  const m = margin || 0;
  for (const ax of [A1.u, A1.v, B1.u, B1.v]) {
    const pa = corners(A1).map((p) => p[0] * ax[0] + p[1] * ax[1]), pb = corners(B1).map((p) => p[0] * ax[0] + p[1] * ax[1]);
    if (Math.max(...pa) <= Math.min(...pb) + m || Math.max(...pb) <= Math.min(...pa) + m) return false;
  }
  return true;
}
function rectInPoly(R, poly, tol) {
  const t = tol == null ? 0.01 : tol;
  const cs = corners(R);
  if (!cs.every((p) => pip(p, poly) || edgeDist(p, poly) <= t)) return false;
  const S = Object.assign({}, R, { hw: Math.max(0, R.hw - t), hd: Math.max(0, R.hd - t) }), sc = corners(S);
  for (const v of poly) if (inRect(v, S, -1e-6)) return false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) for (let k = 0; k < 4; k++) if (segX(poly[j], poly[i], sc[k], sc[(k + 1) % 4])) return false;
  return true;
}
function wallRect(a, b, t, s0, s1) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; const m = (s0 + s1) / 2; return { c: [a[0] + u[0] * m, a[1] + u[1] * m], u, v: [-u[1], u[0]], hw: (s1 - s0) / 2, hd: t / 2 }; }

/* ---------------- 1. геометрия ---------------- */
const num = (v, lo, hi) => fin(v) && v >= lo && v <= hi;
const pt = (v) => Array.isArray(v) && v.length === 2 && fin(v[0]) && fin(v[1]) && Math.abs(v[0]) < 1000 && Math.abs(v[1]) < 1000;
function roomHeight(g, room) { return fin(room.height_m) ? room.height_m : fin(g.default_height_m) ? g.default_height_m : null; }
function wallLen(w) { return Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]); }
function openingCenter(w, o) { const L = wallLen(w), u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L], s = o.offset_m + o.width_m / 2; return [w.a[0] + u[0] * s, w.a[1] + u[1] * s]; }

function validateGeometry(g) {
  const errors = [], blocked = [], warnings = [];
  const E = (m) => errors.push(m), BL = (m) => blocked.push(m), W = (m) => warnings.push(m);
  if (!g || typeof g !== "object" || Array.isArray(g)) return { ok: false, errors: ["геометрията трябва да е обект"], blocked: [], warnings: [], stats: null, sha256: null };
  if (g.schema !== G_SCHEMA) E("schema трябва да е " + G_SCHEMA);
  if (g.units !== "m") E("units трябва да е \"m\" (метри)");
  if (g.north_deg == null) BL("липсва ориентация (north_deg) – посоката на плана спрямо севера");
  else if (!num(g.north_deg, 0, 360)) E("north_deg е между 0 и 360");
  if (g.default_height_m != null && !num(g.default_height_m, 2.0, 6.0)) E("default_height_m е между 2.0 и 6.0 м");
  const rooms = Array.isArray(g.rooms) ? g.rooms : (E("липсва rooms[]"), []);
  const walls = Array.isArray(g.walls) ? g.walls : (BL("липсват стени (walls[])"), []);
  const openings = Array.isArray(g.openings) ? g.openings : (BL("липсват отвори (openings[]) – врати и прозорци"), []);
  if (rooms.length > 60) E("твърде много помещения (макс. 60)");
  if (walls.length > 400) E("твърде много стени (макс. 400)");
  if (openings.length > 300) E("твърде много отвори (макс. 300)");
  const R = {}, Wm = {}, O = {};
  rooms.forEach((r, i) => {
    const at = "rooms[" + i + "]";
    if (!r || typeof r !== "object") return E(at + ": обект");
    if (!ID_RE.test(String(r.id || ""))) return E(at + ": невалиден id (малки латински букви, цифри, _ -)");
    if (R[r.id]) return E(at + ": повторен id " + r.id);
    if (!ROOM_TYPES.includes(r.type)) E(at + ": type е едно от " + ROOM_TYPES.join("|"));
    if (r.name != null && (typeof r.name !== "string" || r.name.length > 60)) E(at + ": name до 60 знака");
    if (!Array.isArray(r.polygon) || r.polygon.length < 3 || r.polygon.length > 64 || !r.polygon.every(pt)) return E(at + ": polygon – 3…64 точки [x,y] в метри");
    const a = Math.abs(area(r.polygon));
    if (a < 0.5) E(at + ": площта е под 0.5 м²");
    if (a > 500) E(at + ": площта е над 500 м²");
    if (selfIntersects(r.polygon)) E(at + ": контурът се самопресича");
    if (r.height_m != null && !num(r.height_m, 2.0, 6.0) && r.type !== "terrace") E(at + ": height_m е между 2.0 и 6.0 м");
    if (r.type !== "terrace" && roomHeight(g, r) == null) BL("няма височина за помещение " + r.id + " (height_m или default_height_m) – точна сцена не се прави");
    R[r.id] = r;
  });
  walls.forEach((w, i) => {
    const at = "walls[" + i + "]";
    if (!w || !ID_RE.test(String(w.id || ""))) return E(at + ": невалиден id");
    if (Wm[w.id]) return E(at + ": повторен id " + w.id);
    if (!pt(w.a) || !pt(w.b)) return E(at + ": a и b са точки [x,y]");
    if (wallLen(w) < 0.05) return E(at + ": стена по-къса от 5 см");
    if (!num(w.thickness_m, 0.05, 1.0)) E(at + ": thickness_m е между 0.05 и 1.0 м");
    if (w.height_m != null && !num(w.height_m, 0.3, 6.0)) E(at + ": height_m е между 0.3 и 6.0 м");
    Wm[w.id] = w;
  });
  openings.forEach((o, i) => {
    const at = "openings[" + i + "]";
    if (!o || !ID_RE.test(String(o.id || ""))) return E(at + ": невалиден id");
    if (O[o.id] || Wm[o.id] || R[o.id]) return E(at + ": повторен id " + o.id);
    if (!OPENING_TYPES.includes(o.type)) return E(at + ": type е едно от " + OPENING_TYPES.join("|"));
    const w = Wm[o.wall]; if (!w) return E(at + ": стена " + o.wall + " не съществува");
    if (!num(o.offset_m, 0, 100) || !num(o.width_m, 0.3, 6) || !num(o.height_m, 0.3, 6)) return E(at + ": offset_m, width_m (0.3–6), height_m (0.3–6) в метри");
    const sill = o.sill_m == null ? 0 : o.sill_m;
    if (!num(sill, 0, 3)) E(at + ": sill_m е между 0 и 3 м");
    if (o.offset_m + o.width_m > wallLen(w) + 1e-6) E(at + ": отворът излиза извън стената " + w.id);
    const wh = fin(w.height_m) ? w.height_m : null;
    if (wh != null && sill + o.height_m > wh + 1e-6) E(at + ": отворът е по-висок от стената " + w.id);
    if (!Array.isArray(o.rooms) || o.rooms.length < 1 || o.rooms.length > 2) return E(at + ": rooms – 1 или 2 помещения (или \"exterior\")");
    for (const r of o.rooms) if (r !== "exterior" && !R[r]) E(at + ": помещение " + r + " не съществува");
    if (PASSABLE.has(o.type) && sill > 0.05) E(at + ": врата/проход с праг над 5 см");
    if (o.type === "window" && !o.rooms.includes("exterior")) W(at + ": прозорецът не гледа навън (rooms без \"exterior\")");
    if (PASSABLE.has(o.type) && o.height_m < 1.9) W(at + ": отвор за минаване по-нисък от 1.90 м");
    /* отворът трябва да лежи на контура на помещенията си */
    const c = openingCenter(w, o), tol = (w.thickness_m || 0.2) / 2 + 0.15;
    for (const r of o.rooms) if (r !== "exterior" && R[r] && edgeDist(c, R[r].polygon) > tol) E(at + ": отворът не е на границата на " + r + " (" + r3(edgeDist(c, R[r].polygon)) + " м)");
    O[o.id] = o;
  });
  /* застъпване на отвори в една стена */
  Object.values(Wm).forEach((w) => {
    const os = Object.values(O).filter((o) => o.wall === w.id).sort((a, b) => a.offset_m - b.offset_m);
    for (let k = 1; k < os.length; k++) if (os[k].offset_m < os[k - 1].offset_m + os[k - 1].width_m - 1e-6) E("отворите " + os[k - 1].id + " и " + os[k].id + " се застъпват в стена " + w.id);
  });
  /* стени без помещение до тях – предупреждение */
  Object.values(Wm).forEach((w) => { const m = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]; if (!Object.values(R).some((r) => edgeDist(m, r.polygon) <= w.thickness_m / 2 + 0.15)) W("стена " + w.id + " не граничи с помещение"); });
  /* граф на помещенията през врати/проходи */
  const adj = {}; Object.keys(R).forEach((k) => { adj[k] = []; });
  Object.values(O).forEach((o) => { if (PASSABLE.has(o.type) && o.rooms.length === 2 && R[o.rooms[0]] && R[o.rooms[1]] && o.rooms[0] !== o.rooms[1]) { adj[o.rooms[0]].push({ to: o.rooms[1], via: o.id }); adj[o.rooms[1]].push({ to: o.rooms[0], via: o.id }); } });
  const entrance = O[g.entrance] && O[g.entrance].type === "door" ? O[g.entrance] : Object.values(O).find((o) => o.type === "door" && o.rooms.includes("exterior"));
  if (rooms.length && !entrance) BL("няма входна врата (entrance или врата към \"exterior\")");
  const startRoom = entrance ? entrance.rooms.find((r) => r !== "exterior") : null;
  if (startRoom && R[startRoom]) {
    const seen = new Set([startRoom]), q = [startRoom];
    while (q.length) { const x = q.shift(); for (const e of adj[x] || []) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); } }
    Object.keys(R).filter((k) => !seen.has(k)).forEach((k) => BL("помещение " + k + " не е свързано с входа през врата или проход"));
  }
  if (!Object.values(O).some((o) => o.type === "window" || o.type === "balcony_door")) W("няма прозорци");
  const stats = { rooms: Object.keys(R).length, walls: Object.keys(Wm).length, doors: Object.values(O).filter((o) => PASSABLE.has(o.type)).length, windows: Object.values(O).filter((o) => o.type === "window").length,
    area_m2: r3(Object.values(R).filter((r) => r.type !== "terrace").reduce((s, r) => s + Math.abs(area(r.polygon)), 0)), terrace_m2: r3(Object.values(R).filter((r) => r.type === "terrace").reduce((s, r) => s + Math.abs(area(r.polygon)), 0)),
    start_room: startRoom || null, exposure: exposureOf(g, Object.values(O), Wm, R) };
  return { ok: !errors.length, errors, blocked, warnings, stats, sha256: errors.length ? null : sha(g), adjacency: adj };
}
/* изложение по прозорците (истински посоки) */
function exposureOf(g, openings, Wm, R) {
  if (!fin(g.north_deg)) return null;
  const set = new Set();
  openings.filter((o) => (o.type === "window" || o.type === "balcony_door") && o.rooms.includes("exterior")).forEach((o) => {
    const w = Wm[o.wall], room = R[o.rooms.find((r) => r !== "exterior")]; if (!w || !room) return;
    const c = openingCenter(w, o), L = wallLen(w), n = [-(w.b[1] - w.a[1]) / L, (w.b[0] - w.a[0]) / L];
    const out = pip([c[0] + n[0] * 0.5, c[1] + n[1] * 0.5], room.polygon) ? [-n[0], -n[1]] : n;
    const t = (bearing(out[0], out[1]) + g.north_deg) % 360;
    set.add(["Север", "Изток", "Юг", "Запад"][Math.round(t / 90) % 4]);
  });
  return ["Юг", "Изток", "Запад", "Север"].filter((x) => set.has(x)).join(" / ") || null;
}

/* ---------------- 2. стил ---------------- */
const STYLE_SYSTEMS = {
  modern_classic: { name: "Модерна класика", floor: "oak_herringbone", wall: "plaster_warm", wet_floor: "tile_marble", wet_wall: "tile_marble", kitchen_floor: "oak_herringbone",
    slots: { fabric: "fabric_cream", textile: "fabric_cream", accent: "fabric_burgundy", wood: "wood_walnut", metal: "metal_brass", white: "lacquer_white", stone: "stone_counter", ceramic: "ceramic_white", plant: "plant_green", glass: "glass", steel: "metal_steel", dark: "lacquer_black" }, light: { color: "#ffe2bd", intensity: 1.0 } },
  minimalist: { name: "Минимализъм", floor: "concrete_light", wall: "plaster_white", wet_floor: "tile_grey_large", wet_wall: "tile_grey_large", kitchen_floor: "concrete_light",
    slots: { fabric: "fabric_grey", textile: "fabric_grey", accent: "fabric_charcoal", wood: "wood_oak", metal: "metal_black", white: "lacquer_white", stone: "stone_counter", ceramic: "ceramic_white", plant: "plant_green", glass: "glass", steel: "metal_steel", dark: "lacquer_black" }, light: { color: "#fff4e8", intensity: 1.0 } },
  scandinavian: { name: "Скандинавски", floor: "oak_light_planks", wall: "plaster_white", wet_floor: "tile_white", wet_wall: "tile_white", kitchen_floor: "oak_light_planks",
    slots: { fabric: "fabric_grey", textile: "fabric_linen", accent: "fabric_sage", wood: "wood_birch", metal: "metal_black", white: "lacquer_white", stone: "stone_counter", ceramic: "ceramic_white", plant: "plant_green", glass: "glass", steel: "metal_steel", dark: "lacquer_black" }, light: { color: "#fff6ea", intensity: 1.05 } },
  japandi: { name: "Джапанди", floor: "oak_planks", wall: "plaster_greige", wet_floor: "tile_stone_greige", wet_wall: "tile_stone_greige", kitchen_floor: "oak_planks",
    slots: { fabric: "fabric_linen", textile: "fabric_linen", accent: "fabric_charcoal", wood: "wood_walnut", metal: "metal_black", white: "wood_birch", stone: "tile_stone_greige", ceramic: "ceramic_white", plant: "plant_green", glass: "glass", steel: "metal_black", dark: "lacquer_black" }, light: { color: "#ffe9cc", intensity: 0.95 } },
  mediterranean: { name: "Средиземноморски", floor: "terracotta_tiles", wall: "lime_white", wet_floor: "tile_blue", wet_wall: "tile_white", kitchen_floor: "terracotta_tiles",
    slots: { fabric: "fabric_linen", textile: "fabric_cream", accent: "fabric_terracotta", wood: "wood_olive", metal: "metal_black", white: "lime_white", stone: "stone_counter", ceramic: "ceramic_white", plant: "plant_green", glass: "glass", steel: "metal_steel", dark: "lacquer_black" }, light: { color: "#ffe7c4", intensity: 1.05 } },
  custom: { name: "Собствена палитра", floor: "oak_planks", wall: "plaster_white", wet_floor: "tile_white", wet_wall: "tile_white", kitchen_floor: "oak_planks",
    slots: { fabric: "fabric_grey", textile: "fabric_cream", accent: "fabric_charcoal", wood: "wood_oak", metal: "metal_black", white: "lacquer_white", stone: "stone_counter", ceramic: "ceramic_white", plant: "plant_green", glass: "glass", steel: "metal_steel", dark: "lacquer_black" }, light: { color: "#fff2e2", intensity: 1.0 } }
};
const DEFAULT_STYLE = "minimalist";
const PREFS = ["no_tv", "no_rug", "no_plants", "bathtub", "shower", "desk", "armchair", "dining"];
const ARCH_KEYS = /^(walls?|rooms?|openings?|doors?|windows?|heights?|height_m|ceiling_height|polygons?|geometry|area|area_m2|balcon(y|ies)|terraces?|thickness(_m)?|north_deg|units|стен[аи]|помещени[ея]|врат[аи]|прозор(ец|ци)|височин[аи]|тераса|площ)$/iu;
const HEX = /^#[0-9a-f]{6}$/i;
function findArchKeys(v, path, out, d) {
  if (!v || typeof v !== "object" || d > 6) return out;
  if (Array.isArray(v)) { v.forEach((x, i) => findArchKeys(x, path + "[" + i + "]", out, d + 1)); return out; }
  Object.keys(v).forEach((k) => { if (ARCH_KEYS.test(k)) out.push(path + k); findArchKeys(v[k], path + k + ".", out, d + 1); });
  return out;
}
function validateStyle(b) {
  const errors = [], warnings = [];
  if (!b || typeof b !== "object" || Array.isArray(b)) return { ok: false, errors: ["стилът трябва да е обект"], warnings };
  const arch = findArchKeys(b, "", [], 0);
  if (arch.length) errors.push("стилът не може да променя архитектурата (стени, отвори, височини, площи, тераси): " + arch.slice(0, 5).join(", "));
  const sys = b.style_system || DEFAULT_STYLE;
  if (!STYLE_SYSTEMS[sys]) errors.push("style_system е едно от " + Object.keys(STYLE_SYSTEMS).join("|"));
  if (b.palette != null && (!Array.isArray(b.palette) || b.palette.length > 8 || !b.palette.every((c) => HEX.test(c)))) errors.push("palette – до 8 цвята #rrggbb");
  if (b.materials != null && (!Array.isArray(b.materials) || b.materials.length > 20 || !b.materials.every((m) => typeof m === "string" && A.CATALOG.materials[m]))) errors.push("materials – само позволени материали от библиотеката " + A.LIBRARY_ID);
  if (b.furniture_preferences != null && (!Array.isArray(b.furniture_preferences) || !b.furniture_preferences.every((p) => PREFS.includes(p)))) errors.push("furniture_preferences – само " + PREFS.join("|"));
  if (b.must_avoid != null && (!Array.isArray(b.must_avoid) || b.must_avoid.length > 30 || !b.must_avoid.every((x) => typeof x === "string" && (A.CATALOG.furniture[x] || A.CATALOG.materials[x])))) errors.push("must_avoid – само елементи от библиотеката");
  if (b.must_keep != null && (!Array.isArray(b.must_keep) || b.must_keep.length > 30 || !b.must_keep.every((x) => typeof x === "string" && x.length <= 80))) errors.push("must_keep – до 30 текста");
  if (b.lighting != null && !["warm", "neutral", "cool"].includes(b.lighting)) errors.push("lighting е warm|neutral|cool");
  if (b.style_name != null && (typeof b.style_name !== "string" || b.style_name.length > 80)) errors.push("style_name до 80 знака");
  if (b.backdrop != null && b.backdrop !== "neutral") errors.push("фон зад прозорците: засега само \"neutral\" – реална гледка се допуска само с проверен източник (снимка от апартамента), какъвто няма");
  if (b.conceptual_elements_allowed === false) warnings.push("conceptual_elements_allowed=false → сцената е без мебели (само архитектура и материали)");
  const norm = { schema: B_SCHEMA, style_system: sys, style_name: b.style_name || (STYLE_SYSTEMS[sys] || {}).name || sys, palette: b.palette || [], materials: b.materials || [], furniture_preferences: b.furniture_preferences || [],
    lighting: b.lighting || "warm", must_keep: b.must_keep || [], must_avoid: b.must_avoid || [], conceptual_elements_allowed: b.conceptual_elements_allowed !== false, backdrop: "neutral" };
  return { ok: !errors.length, errors, warnings, normalized: norm, sha256: errors.length ? null : sha(norm) };
}
const WET = new Set(["bathroom", "wc", "laundry"]);
/* стил → материали: ЧИСТА функция, получава замразена геометрия (не може да я промени) */
function materialsFor(geom, brief) {
  const S = STYLE_SYSTEMS[(brief && brief.style_system) || DEFAULT_STYLE];
  const custom = brief && brief.style_system === "custom" ? brief.palette || [] : [];
  const pick = (id) => { const want = (brief && brief.materials) || []; const m = A.CATALOG.materials[id]; const alt = want.find((x) => A.CATALOG.materials[x] && A.CATALOG.materials[x].kind === (m && m.kind)); return alt || id; };
  const defs = {}, surfaces = {};
  const use = (id, override) => { const m = A.CATALOG.materials[id]; defs[id] = Object.assign({ id, name: m.name, kind: m.kind, color: m.color, roughness: m.roughness, metalness: m.metalness, pattern: m.pattern, scale_m: m.scale_m, tex_px: m.tex_px, checksum: m.checksum }, m.opacity != null ? { opacity: m.opacity } : {}, override || {}); return id; };
  geom.rooms.forEach((r) => {
    const wet = WET.has(r.type), kit = r.type === "kitchen";
    let fl = r.type === "terrace" ? "deck_wpc" : wet ? S.wet_floor : kit ? S.kitchen_floor : S.floor;
    let wl = wet ? S.wet_wall : S.wall;
    fl = pick(fl); wl = pick(wl);
    surfaces["room:" + r.id + ":floor"] = use(fl, custom[1] && r.type !== "terrace" && !wet ? { color: custom[1] } : null);
    surfaces["room:" + r.id + ":wall"] = use(wl, custom[0] && !wet ? { color: custom[0] } : null);
    if (r.type !== "terrace") surfaces["room:" + r.id + ":ceiling"] = use("ceiling_white");
  });
  const slots = {};
  Object.keys(S.slots).forEach((k) => { slots[k] = use(S.slots[k]); });
  if (custom[2]) defs[slots.accent] = Object.assign({}, defs[slots.accent], { color: custom[2] });
  if (custom[3]) defs[slots.fabric] = Object.assign({}, defs[slots.fabric], { color: custom[3] });
  /* ако един материал е с два цвята (собствена палитра), ключът става уникален */
  return { surfaces, slots, defs, style_system: (brief && brief.style_system) || DEFAULT_STYLE, style_name: (brief && brief.style_name) || S.name };
}

/* ---------------- 3. мебели (детерминистично, без случайност) ---------------- */
const PROGRAM = {
  living: [["sofa_3", "wall", { req: true }], ["rug_living", "rug"], ["coffee_table", "front", { ref: "sofa_3", gap: 0.45 }], ["tv_unit", "opposite", { ref: "sofa_3", pref: "no_tv" }], ["armchair", "wall", { opt: "armchair" }], ["plant_floor", "corner", { pref: "no_plants" }]],
  living_kitchen: [["kitchen_run_240", "wall", { alt: "kitchen_run_180", solid: true }], ["fridge", "wall", { near: "kitchen" }], ["sofa_3", "wall", { req: true }], ["rug_living", "rug"], ["coffee_table", "front", { ref: "sofa_3", gap: 0.45 }],
    ["tv_unit", "opposite", { ref: "sofa_3", pref: "no_tv" }], ["dining_table_4", "free", { chairs: 4 }], ["plant_floor", "corner", { pref: "no_plants" }]],
  kitchen: [["kitchen_run_240", "wall", { alt: "kitchen_run_180", solid: true }], ["fridge", "wall", { near: "kitchen" }], ["dining_table_4", "free", { chairs: 4, minArea: 8 }]],
  dining: [["dining_table_4", "free", { chairs: 4 }], ["plant_floor", "corner", { pref: "no_plants" }]],
  bedroom: [["bed_double", "wall", { req: true, solid: true, alt: "bed_single" }], ["nightstand", "beside", { ref: "bed", side: -1 }], ["nightstand", "beside", { ref: "bed", side: 1 }], ["wardrobe_160", "wall", { alt: "wardrobe_100", solid: true }], ["desk", "wall", { opt: "desk" }], ["plant_floor", "corner", { pref: "no_plants" }]],
  child: [["bed_single", "wall", { req: true, solid: true }], ["desk", "wall", {}], ["wardrobe_100", "wall", { solid: true }], ["bookshelf", "wall", {}]],
  office: [["desk", "wall", { req: true }], ["bookshelf", "wall", {}], ["armchair", "wall", {}]],
  bathroom: [["bathtub", "wall", { alt: "shower_90", solid: true, swapPref: true }], ["toilet", "wall", { req: true, solid: true }], ["vanity_60", "wall", { solid: true }], ["washer", "wall", {}]],
  wc: [["toilet", "wall", { req: true, solid: true }], ["washbasin_45", "wall", {}]],
  laundry: [["washer", "wall", {}]],
  hall: [["shoe_cabinet", "wall", {}], ["wardrobe_100", "wall", { minArea: 4, solid: true }]],
  corridor: [["shoe_cabinet", "wall", { minArea: 3 }]],
  storage: [["bookshelf", "wall", {}]],
  terrace: [["outdoor_table", "free", { chairs: 2, chairAsset: "outdoor_chair" }], ["plant_floor", "corner", { pref: "no_plants" }]],
  other: []
};

/* околна среда за проверки: правоъгълници на стените (без отворите), зони пред врати и прозорци */
function envOf(g) {
  const W = {}; g.walls.forEach((w) => { W[w.id] = w; });
  const walls = [], wallsNav = [], doorZones = [], winZones = [], passRects = [];
  g.walls.forEach((w) => {
    const L = wallLen(w), os = g.openings.filter((o) => o.wall === w.id).sort((a, b) => a.offset_m - b.offset_m);
    const solid = (filter) => { const out = []; let s = 0; os.filter(filter).forEach((o) => { if (o.offset_m > s + 1e-6) out.push([s, o.offset_m]); s = Math.max(s, o.offset_m + o.width_m); }); if (L > s + 1e-6) out.push([s, L]); return out; };
    solid((o) => PASSABLE.has(o.type) || o.type === "window").forEach(([a, b]) => walls.push(Object.assign(wallRect(w.a, w.b, w.thickness_m, a, b), { wall: w.id })));
    os.filter((o) => o.type === "window").forEach((o) => walls.push(Object.assign(wallRect(w.a, w.b, w.thickness_m, o.offset_m, o.offset_m + o.width_m), { wall: w.id, window: o.id, low: o.sill_m || 0 })));
    solid((o) => PASSABLE.has(o.type)).forEach(([a, b]) => wallsNav.push({ a: [w.a[0] + (w.b[0] - w.a[0]) * a / L, w.a[1] + (w.b[1] - w.a[1]) * a / L], b: [w.a[0] + (w.b[0] - w.a[0]) * b / L, w.a[1] + (w.b[1] - w.a[1]) * b / L], ht: w.thickness_m / 2 }));
    os.forEach((o) => {
      const c = openingCenter(w, o), u = [(w.b[0] - w.a[0]) / L, (w.b[1] - w.a[1]) / L], n = [-u[1], u[0]];
      if (PASSABLE.has(o.type)) passRects.push(Object.assign(wallRect(w.a, w.b, w.thickness_m + 0.04, o.offset_m, o.offset_m + o.width_m), { id: o.id }));
      for (const s of [1, -1]) {
        const probe = [c[0] + n[0] * s * (w.thickness_m / 2 + 0.3), c[1] + n[1] * s * (w.thickness_m / 2 + 0.3)];
        const room = g.rooms.find((r) => o.rooms.includes(r.id) && pip(probe, r.polygon)); if (!room) continue;
        const depth = PASSABLE.has(o.type) ? (o.type === "passage" ? 0.6 : Math.max(0.9, o.width_m) + 0.1) : 0.5;
        const cc = [c[0] + n[0] * s * (w.thickness_m / 2 + depth / 2), c[1] + n[1] * s * (w.thickness_m / 2 + depth / 2)];
        const Z = { c: cc, u, v: [n[0] * s, n[1] * s], hw: (o.width_m + (PASSABLE.has(o.type) ? 0.2 : 0)) / 2, hd: depth / 2, opening: o.id, room: room.id, sill: o.sill_m || 0 };
        (PASSABLE.has(o.type) ? doorZones : winZones).push(Z);
      }
    });
  });
  return { walls, wallsNav, doorZones, winZones, passRects };
}
function fits(g, env, room, R, item, placed) {
  if (!rectInPoly(R, room.polygon, 0.012)) return "извън помещението";
  for (const w of env.walls) if (rectsOverlap(R, w, 0.004)) return "влиза в стена";
  for (const z of env.doorZones) if (rectsOverlap(R, z, 0.004)) return "пречи на врата";
  if (!item.floor_layer) for (const z of env.winZones) if (z.room === room.id && item.dims_m.h > z.sill - 0.02 && rectsOverlap(R, z, 0.004)) return "закрива прозорец";
  if (!item.floor_layer) for (const p of placed) if (!p.floor_layer && rectsOverlap(R, p.rect, 0.03)) return "застъпва " + p.asset;
  return null;
}
/* кандидати „до стена“: по ръбовете на помещението, от центъра на ръба навън */
function wallCandidates(room, item, gap, env, solid) {
  const P = room.polygon, ccw = area(P) > 0, out = [], w = item.dims_m.w, d = item.dims_m.d;
  const edges = [];
  const doorOn = (a, b) => !!env && env.doorZones.some((z) => z.room === room.id && segDist([z.c[0] - z.v[0] * z.hd, z.c[1] - z.v[1] * z.hd], a, b) < 0.25);
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L >= w) edges.push({ a, b, L, i, door: solid ? doorOn(a, b) : false }); }
  edges.sort((x, y) => (x.door - y.door) || y.L - x.L || x.i - y.i);
  for (const e of edges) {
    const u = [(e.b[0] - e.a[0]) / e.L, (e.b[1] - e.a[1]) / e.L], n = ccw ? [-u[1], u[0]] : [u[1], -u[0]], th = bearing(n[0], n[1]);
    const span = e.L - w, steps = Math.floor(span / 0.05), order = [];
    for (let k = 0; k <= steps; k++) order.push(k * 0.05);
    if (span - steps * 0.05 > 1e-6) order.push(span);
    order.sort((x, y) => Math.abs(x - span / 2) - Math.abs(y - span / 2) || x - y);
    for (const t of order) out.push({ c: [e.a[0] + u[0] * (t + w / 2) + n[0] * (gap + d / 2), e.a[1] + u[1] * (t + w / 2) + n[1] * (gap + d / 2)], th, edge: e.i });
  }
  return out;
}
function freeCandidates(room, item, margin) {
  const P = room.polygon, xs = P.map((p) => p[0]), ys = P.map((p) => p[1]), c0 = centroid(P);
  let best = 0, th = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > best + 1e-9) { best = L; th = bearing(b[0] - a[0], b[1] - a[1]); } }
  th = (th + 90) % 180; // по-дългата страна на масата по най-дългата стена
  const out = [];
  for (let x = Math.min(...xs) + margin; x <= Math.max(...xs) - margin + 1e-9; x += 0.1) for (let y = Math.min(...ys) + margin; y <= Math.max(...ys) - margin + 1e-9; y += 0.1) out.push({ c: [r3(x), r3(y)], th });
  out.sort((p, q) => Math.hypot(p.c[0] - c0[0], p.c[1] - c0[1]) - Math.hypot(q.c[0] - c0[0], q.c[1] - c0[1]) || p.c[0] - q.c[0] || p.c[1] - q.c[1]);
  return out;
}
function cornerCandidates(room, item) {
  const P = room.polygon, ccw = area(P) > 0, out = [], w = item.dims_m.w, d = item.dims_m.d;
  for (let i = 0; i < P.length; i++) {
    const p0 = P[(i + P.length - 1) % P.length], p = P[i], p1 = P[(i + 1) % P.length];
    const c = cross(p0, p, p1); if ((ccw && c <= 0) || (!ccw && c >= 0)) continue; // само изпъкнали ъгли
    const e1 = [(p[0] - p0[0]), (p[1] - p0[1])], e2 = [(p1[0] - p[0]), (p1[1] - p[1])], l1 = Math.hypot(...e1), l2 = Math.hypot(...e2);
    const a = [-e1[0] / l1, -e1[1] / l1], b = [e2[0] / l2, e2[1] / l2];
    out.push({ c: [p[0] + a[0] * (d / 2 + 0.05) + b[0] * (w / 2 + 0.05), p[1] + a[1] * (d / 2 + 0.05) + b[1] * (w / 2 + 0.05)], th: bearing(a[0], a[1]) });
  }
  return out;
}

/* ---------------- навигация: решетка за ходене ---------------- */
function navGrid(g, env, furniture, opts) {
  const o = opts || {}, cell = o.cell || CELL, r = o.r == null ? BODY_R : o.r;
  const pts = g.rooms.flatMap((x) => x.polygon);
  const x0 = Math.floor((Math.min(...pts.map((p) => p[0])) - 0.5) / cell) * cell, y0 = Math.floor((Math.min(...pts.map((p) => p[1])) - 0.5) / cell) * cell;
  const w = Math.ceil((Math.max(...pts.map((p) => p[0])) + 0.5 - x0) / cell), h = Math.ceil((Math.max(...pts.map((p) => p[1])) + 0.5 - y0) / cell);
  const only = o.room ? g.rooms.filter((x) => x.id === o.room) : g.rooms;
  const bb = only.map((x) => { const xs = x.polygon.map((p) => p[0]), ys = x.polygon.map((p) => p[1]); return { room: x, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; });
  const solids = furniture.filter((f) => !f.floor_layer).map((f) => f.rect);
  const grid = new Uint8Array(w * h), roomOf = new Int16Array(w * h).fill(-1);
  const idx = {}; g.rooms.forEach((x, i) => { idx[x.id] = i; });
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const p = [x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell];
    let inside = false;
    for (const b of bb) if (p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.y0 && p[1] <= b.y1 && pip(p, b.room.polygon)) { inside = true; roomOf[j * w + i] = idx[b.room.id]; break; }
    if (!inside && !o.room) for (const pr of env.passRects) if (inRect(p, pr, 0)) { inside = true; break; }
    if (!inside) continue;
    let ok = true;
    for (const s of env.wallsNav) if (segDist(p, s.a, s.b) < s.ht + r) { ok = false; break; }
    if (ok) for (const R of solids) if (inRect(p, R, r)) { ok = false; break; }
    if (ok) grid[j * w + i] = 1;
  }
  return { x0: r3(x0), y0: r3(y0), cell, w, h, grid, roomOf };
}
const cellOf = (N, p) => [Math.floor((p[0] - N.x0) / N.cell), Math.floor((p[1] - N.y0) / N.cell)];
const walk = (N, i, j) => i >= 0 && j >= 0 && i < N.w && j < N.h && N.grid[j * N.w + i] === 1;
function bfs(N, from, stopAt) {
  const dist = new Int32Array(N.w * N.h).fill(-1), q = [from[1] * N.w + from[0]];
  if (!walk(N, from[0], from[1])) return dist;
  dist[q[0]] = 0;
  for (let k = 0; k < q.length; k++) {
    const c = q[k], i = c % N.w, j = (c - i) / N.w;
    if (stopAt && stopAt(c)) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (walk(N, a, b) && dist[b * N.w + a] < 0) { dist[b * N.w + a] = dist[c] + 1; q.push(b * N.w + a); } }
  }
  return dist;
}
function nearestWalk(N, p, maxR, roomIdx) {
  const [ci, cj] = cellOf(N, p);
  for (let rr = 0; rr <= (maxR || 8); rr++) {
    let best = null, bd = Infinity;
    for (let j = cj - rr; j <= cj + rr; j++) for (let i = ci - rr; i <= ci + rr; i++) {
      if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== rr || !walk(N, i, j)) continue;
      if (roomIdx != null && N.roomOf[j * N.w + i] !== roomIdx && N.roomOf[j * N.w + i] !== -1) continue;
      const d = Math.hypot(i - ci, j - cj); if (d < bd) { bd = d; best = [i, j]; }
    }
    if (best) return best;
  }
  return null;
}
function rle(grid) { const out = []; let cur = 0, run = 0; for (let k = 0; k < grid.length; k++) { if (grid[k] === cur) run++; else { out.push(run); cur = grid[k]; run = 1; } } out.push(run); return out; }
function unrle(runs, n) { const g = new Uint8Array(n); let k = 0, v = 0; for (const r of runs) { if (v) g.fill(1, k, Math.min(n, k + r)); k += r; v ^= 1; } return g; }
/* преносимост на портите на едно помещение (врати → център) след поставяне на мебел */
function roomPassable(g, env, room, furniture) {
  const N = navGrid(g, env, furniture, { room: room.id });
  const ri = g.rooms.findIndex((x) => x.id === room.id);
  const gates = env.doorZones.filter((z) => z.room === room.id).map((z) => { const p = [z.c[0] + z.v[0] * (-z.hd + 0.25), z.c[1] + z.v[1] * (-z.hd + 0.25)]; return nearestWalk(N, p, 4, ri); });
  if (gates.some((x) => !x)) return false;
  if (gates.length < 1) return true;
  const d = bfs(N, gates[0]);
  if (!gates.every((c) => d[c[1] * N.w + c[0]] >= 0)) return false;
  /* от вратата трябва да се стига до по-голямата част от свободния под на помещението (мебелите не го разделят) */
  let all = 0, got = 0;
  for (let k = 0; k < N.grid.length; k++) if (N.grid[k] && N.roomOf[k] === ri) { all++; if (d[k] >= 0) got++; }
  return all === 0 || got >= 0.7 * all;
}

/* ---------------- 3. строител на сцената ---------------- */
function placeFurniture(g, env, brief, warnings) {
  const prefs = new Set((brief && brief.furniture_preferences) || []), avoid = new Set((brief && brief.must_avoid) || []);
  const placed = [];
  if (brief && brief.conceptual_elements_allowed === false) return placed;
  for (const room of g.rooms) {
    const prog = PROGRAM[room.type] || [], inRoom = [], ar = Math.abs(area(room.polygon));
    for (const [asset0, rule, op] of prog) {
      const o = op || {};
      if (o.pref && prefs.has(o.pref)) continue;
      if (o.opt && !prefs.has(o.opt)) continue;
      if (o.minArea && ar < o.minArea) continue;
      let list = [asset0].concat(o.alt ? [o.alt] : []);
      if (o.swapPref && prefs.has("shower")) list = list.slice().reverse();
      list = list.filter((a) => !avoid.has(a));
      let done = false;
      for (const aid of list) {
        const item = A.CATALOG.furniture[aid]; if (!item) continue;
        let cands = [];
        const ref = o.ref ? inRoom.find((p) => p.asset === o.ref || (o.ref === "bed" && /^bed_/.test(p.asset)) || (o.ref === "kitchen" && /^kitchen_/.test(p.asset))) : null;
        if (rule === "wall") {
          cands = wallCandidates(room, item, 0.02, env, !!o.solid);
          if (o.near) { const k = inRoom.find((p) => p.asset.startsWith(o.near)); if (k) cands.sort((a, b) => Math.hypot(a.c[0] - k.rect.c[0], a.c[1] - k.rect.c[1]) - Math.hypot(b.c[0] - k.rect.c[0], b.c[1] - k.rect.c[1])); }
        } else if (rule === "front" && ref) { const v = ref.rect.v; const off = ref.rect.hd + (o.gap || 0.4) + item.dims_m.d / 2; cands = [{ c: [ref.rect.c[0] + v[0] * off, ref.rect.c[1] + v[1] * off], th: ref.rect.th }]; }
        else if (rule === "rug") { const s = inRoom.find((p) => p.asset === "sofa_3"); if (s && !prefs.has("no_rug")) { const v = s.rect.v, off = s.rect.hd + 0.05 + item.dims_m.d / 2; cands = [{ c: [s.rect.c[0] + v[0] * off, s.rect.c[1] + v[1] * off], th: s.rect.th }]; } }
        else if (rule === "opposite" && ref) { const facing = (ref.rect.th + 180) % 360; cands = wallCandidates(room, item, 0.02, env, false).filter((c) => angDiff(c.th, facing) < 1).sort((a, b) => Math.abs((a.c[0] - ref.rect.c[0]) * ref.rect.u[0] + (a.c[1] - ref.rect.c[1]) * ref.rect.u[1]) - Math.abs((b.c[0] - ref.rect.c[0]) * ref.rect.u[0] + (b.c[1] - ref.rect.c[1]) * ref.rect.u[1])); }
        else if (rule === "beside" && ref) { const s = o.side, u = ref.rect.u, v = ref.rect.v, off = ref.rect.hw + item.dims_m.w / 2 + 0.03, back = -ref.rect.hd + item.dims_m.d / 2; cands = [{ c: [ref.rect.c[0] + u[0] * off * s + v[0] * back, ref.rect.c[1] + u[1] * off * s + v[1] * back], th: ref.rect.th }]; }
        else if (rule === "free") cands = freeCandidates(room, item, Math.min(item.dims_m.w, item.dims_m.d) / 2 + (item.clearance_m || 0.3));
        else if (rule === "corner") cands = cornerCandidates(room, item);
        let why = null;
        for (const c of cands.slice(0, 2500)) {
          const R = rect([r3(c.c[0]), r3(c.c[1])], c.th, item.dims_m.w, item.dims_m.d);
          why = fits(g, env, room, R, item, placed);
          if (why) continue;
          const extra = [];
          if (o.chairs) {
            const ca = A.CATALOG.furniture[o.chairAsset || "dining_chair"], u = R.u, v = R.v, sides = [];
            const along = o.chairs >= 4 ? [-0.35, 0.35] : [0];
            for (const s of [1, -1]) for (const t of along) sides.push({ c: [R.c[0] + u[0] * t + v[0] * s * (R.hd + 0.18), R.c[1] + u[1] * t + v[1] * s * (R.hd + 0.18)], th: (R.th + (s > 0 ? 180 : 0)) % 360 });
            for (const sc of sides) { const CR = rect([r3(sc.c[0]), r3(sc.c[1])], sc.th, ca.dims_m.w, ca.dims_m.d); if (fits(g, env, room, CR, ca, placed.concat([{ rect: R, asset: aid }], extra))) { extra.length = 0; break; } extra.push({ rect: CR, asset: ca.id, item: ca }); }
            if (extra.length !== sides.length) { why = "няма място за столовете"; continue; }
          }
          const cand = [{ rect: R, asset: aid, item, floor_layer: !!item.floor_layer }].concat(extra.map((x) => ({ rect: x.rect, asset: x.asset, item: x.item, floor_layer: false })));
          if (!item.floor_layer && !roomPassable(g, env, room, placed.concat(cand).map((p) => ({ rect: p.rect, floor_layer: p.floor_layer })))) { why = "затваря пътя през помещението"; continue; }
          cand.forEach((p) => { placed.push(p); inRoom.push(p); });
          done = true; break;
        }
        if (done) break;
      }
      if (!done && (o.req || rule === "wall") && list.length) warnings.push(ROOM_BG[room.type] + " " + room.id + ": " + A.CATALOG.furniture[list[0]].name + " не се събира без да пречи – пропуснат");
    }
  }
  return placed.map((p, k) => ({ id: "f" + (k + 1), asset: p.asset, room_id: g.rooms.find((r) => pip(p.rect.c, r.polygon)) ? g.rooms.find((r) => pip(p.rect.c, r.polygon)).id : null, x: r3(p.rect.c[0]), y: r3(p.rect.c[1]), rot: r3(p.rect.th), w: p.item.dims_m.w, d: p.item.dims_m.d, h: p.item.dims_m.h, floor_layer: !!p.floor_layer, conceptual: true }));
}
const furnRect = (f) => rect([f.x, f.y], f.rot, f.w, f.d);

function navigation(g, env, furniture, warnings) {
  const fr = furniture.map((f) => ({ rect: furnRect(f), floor_layer: f.floor_layer }));
  const N = navGrid(g, env, fr);
  /* разстояние до препятствие (BFS от непроходимите клетки) */
  const clr = new Int32Array(N.w * N.h).fill(-1), q = [];
  for (let k = 0; k < N.grid.length; k++) if (!N.grid[k]) { clr[k] = 0; q.push(k); }
  for (let k = 0; k < q.length; k++) { const c = q[k], i = c % N.w, j = (c - i) / N.w; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < N.w && b < N.h && clr[b * N.w + a] < 0) { clr[b * N.w + a] = clr[c] + 1; q.push(b * N.w + a); } } }
  const nodes = [];
  g.rooms.forEach((room, ri) => {
    const c0 = centroid(room.polygon); let best = -1, bs = -Infinity;
    for (let k = 0; k < N.grid.length; k++) if (N.grid[k] && N.roomOf[k] === ri) { const i = k % N.w, j = (k - i) / N.w, p = [N.x0 + (i + 0.5) * N.cell, N.y0 + (j + 0.5) * N.cell]; const s = Math.min(clr[k], 8) * N.cell - 0.35 * Math.hypot(p[0] - c0[0], p[1] - c0[1]); if (s > bs + 1e-9) { bs = s; best = k; } }
    let p, standing = true;
    if (best >= 0) { const i = best % N.w, j = (best - i) / N.w; p = [r3(N.x0 + (i + 0.5) * N.cell), r3(N.y0 + (j + 0.5) * N.cell)]; }
    else {
      standing = false;
      const z = env.doorZones.find((d) => d.room === room.id); p = z ? [r3(z.c[0] + z.v[0] * (-z.hd + 0.3)), r3(z.c[1] + z.v[1] * (-z.hd + 0.3))] : [r3(c0[0]), r3(c0[1])];
      warnings.push((room.name || room.id) + ": няма място за стоене в 3D (твърде малко) – гледната точка е при вратата");
    }
    /* начален поглед: към най-дългия свободен лъч (16 посоки) */
    let yaw = 0, far = -1;
    for (let k = 0; k < 16; k++) { const b = k * 22.5, d = dirOf(b); let L = 0; for (let s = 0.1; s < 12; s += 0.1) { const pp = [p[0] + d[0] * s, p[1] + d[1] * s], ij = cellOf(N, pp); const inRoomCell = ij[0] >= 0 && ij[1] >= 0 && ij[0] < N.w && ij[1] < N.h && N.roomOf[ij[1] * N.w + ij[0]] === ri; if (!inRoomCell) break; L = s; } if (L > far + 1e-9) { far = L; yaw = b; } }
    nodes.push({ id: "n-" + room.id, room_id: room.id, x: p[0], y: p[1], eye_h: EYE_H, start_yaw: yaw, standing });
  });
  const byRoom = {}; nodes.forEach((n) => { byRoom[n.room_id] = n; });
  const edges = [];
  g.openings.filter((o) => PASSABLE.has(o.type) && o.rooms.length === 2 && byRoom[o.rooms[0]] && byRoom[o.rooms[1]]).forEach((o) => {
    const a = byRoom[o.rooms[0]], b = byRoom[o.rooms[1]], w = g.walls.find((x) => x.id === o.wall), dc = openingCenter(w, o);
    const ca = nearestWalk(N, [a.x, a.y], 6), cb = nearestWalk(N, [b.x, b.y], 6);
    let len = null;
    if (ca && cb) { const d = bfs(N, ca); const v = d[cb[1] * N.w + cb[0]]; if (v >= 0) len = r3(v * N.cell); }
    const thr = !a.standing || !b.standing;
    if (len == null && !thr) warnings.push("няма проходим път " + a.room_id + " → " + b.room_id + " през " + o.id);
    edges.push({ from: a.id, to: b.id, via: o.id, door: [r3(dc[0]), r3(dc[1])], length_m: len, walkable: len != null });
  });
  const entrance = g.openings.find((o) => o.id === g.entrance) || g.openings.find((o) => o.type === "door" && o.rooms.includes("exterior"));
  const sr = entrance ? entrance.rooms.find((x) => x !== "exterior") : g.rooms[0] && g.rooms[0].id;
  return { cell: N.cell, x0: N.x0, y0: N.y0, w: N.w, h: N.h, body_r: BODY_R, rle: rle(N.grid), nodes, edges, start: byRoom[sr] ? byRoom[sr].id : nodes[0] && nodes[0].id, walkable_cells: N.grid.reduce((s, x) => s + x, 0) };
}

/* архитектурата: точно копие на проверената геометрия (без нищо добавено) */
function architectureOf(g) {
  const a = clone({ schema: g.schema, units: g.units, north_deg: g.north_deg, default_height_m: g.default_height_m == null ? null : g.default_height_m, entrance: g.entrance || null, rooms: g.rooms, walls: g.walls, openings: g.openings });
  return a;
}
/* inputs: { geometry_id, geometry_version, unit_id, project_id, style_id, style_version } */
function buildScene(geometry, brief, inputs) {
  const gv = validateGeometry(geometry);
  if (!gv.ok) return { ok: false, state: "invalid", errors: gv.errors, blocked: gv.blocked };
  if (gv.blocked.length) return { ok: false, state: "blocked", errors: [], blocked: gv.blocked };
  const bv = validateStyle(brief || {});
  if (!bv.ok) return { ok: false, state: "invalid", errors: bv.errors, blocked: [] };
  const g = deepFreeze(clone(geometry)), b = deepFreeze(bv.normalized);
  const warnings = gv.warnings.slice().concat(bv.warnings);
  const env = envOf(g);
  const materials = materialsFor(g, b);
  const furniture = placeFurniture(g, env, b, warnings);
  const nav = navigation(g, env, furniture, warnings);
  const S = STYLE_SYSTEMS[b.style_system], lc = b.lighting === "cool" ? "#eef4ff" : b.lighting === "neutral" ? "#fff8f0" : S.light.color;
  const lighting = { ambient: { color: "#ffffff", intensity: 0.35 }, hemisphere: { sky: "#fffaf2", ground: "#b9a58f", intensity: 0.75 },
    sun: { bearing_plan: r3(((180 - g.north_deg) % 360 + 360) % 360), elevation_deg: 38, intensity: 1.2, color: "#fff1dc" },
    rooms: g.rooms.filter((r) => r.type !== "terrace").map((r) => { const c = centroid(r.polygon); return { room_id: r.id, x: r3(c[0]), y: r3(c[1]), z: r3((roomHeight(g, r) || 2.7) - 0.25), color: lc, intensity: r3(S.light.intensity * (WET.has(r.type) ? 0.9 : 1)) }; }) };
  const scene = {
    schema: S_SCHEMA, generator: GENERATOR,
    inputs: Object.assign({ geometry_sha256: gv.sha256, style_sha256: bv.sha256, catalog: A.LIBRARY_ID, catalog_version: A.LIBRARY_VERSION, catalog_sha256: A.CATALOG_SHA }, inputs || {}),
    architecture: architectureOf(g),
    materials, furniture, lighting,
    assets: Object.fromEntries(Array.from(new Set(furniture.map((f) => f.asset))).sort().map((id) => [id, A.CATALOG.furniture[id].parts])),
    backdrop: { policy: "neutral", label: LABELS.backdrop_neutral, source: null, version: 1, colors: { top: "#dfe7ee", horizon: "#f3efe9", ground: "#cfc6ba" } },
    navigation: nav,
    labels: { furniture: LABELS.furniture, backdrop: LABELS.backdrop_neutral },
    stats: Object.assign({}, gv.stats, { furniture: furniture.length, triangles: furniture.reduce((s, f) => s + A.CATALOG.furniture[f.asset].budget.triangles, 0) + g.walls.length * 36 + g.rooms.length * 24, materials: Object.keys(materials.defs).length,
      texture_px: Object.values(materials.defs).reduce((s, m) => s + (m.tex_px || 0) * (m.tex_px || 0), 0) })
  };
  const v = validateScene(scene, geometry);
  return { ok: true, state: v.ok ? "needs_review" : "draft", scene, sha256: sha(scene), issues: v.issues, warnings: warnings.concat(v.warnings) };
}

/* ---------------- 4. независима проверка на сцената ---------------- */
function validateScene(scene, geometry) {
  const issues = [], warnings = [];
  const I = (code, m) => issues.push({ code, message: m });
  if (!scene || scene.schema !== S_SCHEMA) return { ok: false, issues: [{ code: "SCHEMA", message: "не е сцена " + S_SCHEMA }], warnings };
  const gv = validateGeometry(geometry);
  if (!gv.ok || gv.blocked.length) I("GEOMETRY_INVALID", "геометрията не е пълна/валидна");
  if (scene.inputs.geometry_sha256 !== gv.sha256) I("GEOMETRY_CHANGED", "сцената е за друга версия на геометрията");
  if (canon(scene.architecture) !== canon(architectureOf(geometry))) I("ARCH_MODIFIED", "архитектурният слой е различен от проверената геометрия (стени/отвори/височини)");
  if (scene.inputs.catalog !== A.LIBRARY_ID || scene.inputs.catalog_sha256 !== A.CATALOG_SHA) I("CATALOG_CHANGED", "библиотеката с елементи е друга версия");
  Object.values((scene.materials && scene.materials.defs) || {}).forEach((m) => { const c = A.CATALOG.materials[m.id]; if (!c || A.assetIssues(c).length || c.checksum !== m.checksum) I("ASSET_UNLICENSED", "материал без лиценз/произход: " + m.id); });
  if (!gv.ok) return { ok: false, issues, warnings };
  const g = geometry, env = envOf(g), placed = [];
  for (const f of scene.furniture || []) {
    const c = A.CATALOG.furniture[f.asset];
    if (!c || A.assetIssues(c).length) { I("ASSET_UNLICENSED", "мебел без лиценз/произход: " + f.asset); continue; }
    if (Math.abs(c.dims_m.w - f.w) > 1e-6 || Math.abs(c.dims_m.d - f.d) > 1e-6 || Math.abs(c.dims_m.h - f.h) > 1e-6) I("ASSET_SCALE", f.id + ": размерите не са реалните от библиотеката");
    if (!f.conceptual) I("NOT_LABELED", f.id + ": мебелта не е отбелязана като примерна");
    const room = g.rooms.find((r) => r.id === f.room_id);
    if (!room) { I("FURN_OUTSIDE", f.id + ": извън помещение"); continue; }
    const R = furnRect(f);
    if (!rectInPoly(R, room.polygon, 0.012)) I("FURN_OUTSIDE", f.id + " (" + f.asset + "): излиза извън " + room.id);
    for (const w of env.walls) if (rectsOverlap(R, w, 0.004)) { I("FURN_IN_WALL", f.id + " (" + f.asset + "): влиза в стена " + w.wall); break; }
    for (const z of env.doorZones) if (rectsOverlap(R, z, 0.004)) { I("DOOR_BLOCKED", f.id + " (" + f.asset + "): пречи на врата " + z.opening); break; }
    if (!f.floor_layer) for (const p of placed) if (!p.floor_layer && rectsOverlap(R, p.R, 0.03)) { I("FURN_OVERLAP", f.id + " застъпва " + p.id); break; }
    placed.push({ R, id: f.id, floor_layer: f.floor_layer });
  }
  const nav = scene.navigation;
  if (!nav || !Array.isArray(nav.rle) || !nav.nodes) I("NAV_MISSING", "липсва навигация");
  else {
    const N = { x0: nav.x0, y0: nav.y0, cell: nav.cell, w: nav.w, h: nav.h, grid: unrle(nav.rle, nav.w * nav.h) };
    /* решетката трябва да съвпада с пресметнатата от геометрията и мебелите (няма „ходене през стени“) */
    const ref = navGrid(g, env, (scene.furniture || []).map((f) => ({ rect: furnRect(f), floor_layer: f.floor_layer })));
    if (ref.w !== N.w || ref.h !== N.h || canon(rle(ref.grid)) !== canon(nav.rle)) I("NAV_MISMATCH", "решетката за ходене не отговаря на стените и мебелите");
    for (const s of env.wallsNav) { const steps = Math.ceil(Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) / 0.05); for (let k = 0; k <= steps; k++) { const p = [s.a[0] + (s.b[0] - s.a[0]) * k / steps, s.a[1] + (s.b[1] - s.a[1]) * k / steps], c = cellOf(N, p); if (walk(N, c[0], c[1])) { I("NAV_THROUGH_WALL", "проходима клетка върху стена"); k = steps + 1; } } }
    const ids = new Set(nav.nodes.map((n) => n.id));
    g.rooms.forEach((r) => { if (!nav.nodes.find((n) => n.room_id === r.id)) I("NODE_MISSING", "няма гледна точка за " + r.id); });
    nav.nodes.forEach((n) => { const c = cellOf(N, [n.x, n.y]); if (n.standing && !walk(N, c[0], c[1])) I("NODE_INVALID", n.id + ": камерата е в препятствие"); const room = g.rooms.find((r) => r.id === n.room_id); if (room && !pip([n.x, n.y], room.polygon)) I("NODE_INVALID", n.id + ": камерата е извън помещението"); });
    if (!ids.has(nav.start)) I("NODE_INVALID", "началната точка липсва");
    const seen = new Set([nav.start]), q = [nav.start];
    while (q.length) { const x = q.shift(); nav.edges.filter((e) => e.walkable !== false || true).forEach((e) => { const y = e.from === x ? e.to : e.to === x ? e.from : null; if (y && !seen.has(y)) { seen.add(y); q.push(y); } }); }
    nav.nodes.filter((n) => !seen.has(n.id)).forEach((n) => I("ROOM_UNREACHABLE", n.room_id + " не е достижимо от входа"));
    nav.edges.forEach((e) => { const o = g.openings.find((x) => x.id === e.via); if (!o || !PASSABLE.has(o.type)) I("EDGE_INVALID", "преход през несъществуваща врата " + e.via); });
    const stand = nav.nodes.filter((n) => n.standing);
    const st = nav.nodes.find((n) => n.id === nav.start);
    if (st && st.standing) {
      const d = bfs(N, cellOf(N, [st.x, st.y]));
      stand.forEach((n) => { const c = cellOf(N, [n.x, n.y]); if (d[c[1] * N.w + c[0]] < 0) I("WALK_BLOCKED", "в 3D не може да се стигне до " + n.room_id + " – мебели или стени затварят пътя"); });
    }
  }
  if (!scene.backdrop || (scene.backdrop.policy === "neutral" && !scene.backdrop.label)) I("BACKDROP_LABEL", "неутралният фон не е отбелязан");
  if (scene.backdrop && scene.backdrop.policy === "verified" && !(scene.backdrop.source && scene.backdrop.source.verified_by && scene.backdrop.source.provenance)) I("BACKDROP_UNVERIFIED", "„реална гледка“ без проверен източник");
  if (!scene.labels || !scene.labels.furniture) I("NOT_LABELED", "липсва надпис „примерно обзавеждане“");
  for (const f of scene.furniture || []) { const c = A.CATALOG.furniture[f.asset]; if (c && canon((scene.assets || {})[f.asset]) !== canon(c.parts)) { I("ASSET_PARTS", "частите на " + f.asset + " не са от библиотеката"); break; } }
  return { ok: !issues.length, issues, warnings };
}

/* ---------------- 5. горещи точки и ориентация ---------------- */
/* nodes: [{id, room_id, x, y, eye_h}], edges: [{from,to,via,door}] – връща за всяка стая преходите към съседните */
function hotspotsFor(nav, roomsInSet, names) {
  const nodes = {}; nav.nodes.forEach((n) => { nodes[n.id] = n; });
  const has = new Set(roomsInSet), out = {};
  roomsInSet.forEach((r) => { out[r] = []; });
  nav.edges.forEach((e) => {
    [[e.from, e.to], [e.to, e.from]].forEach(([a, b]) => {
      const A1 = nodes[a], B1 = nodes[b]; if (!A1 || !B1 || !has.has(A1.room_id)) return;
      const dx = e.door[0] - A1.x, dy = e.door[1] - A1.y, dist = Math.hypot(dx, dy);
      const pitch = -Math.max(8, Math.min(40, (Math.atan2(A1.eye_h || EYE_H, Math.max(0.3, dist)) * 180) / Math.PI));
      out[A1.room_id].push({ to_room: B1.room_id, via: e.via, yaw: bearing(dx, dy), pitch: r3(pitch), dist_m: r3(dist), label: (names && names[B1.room_id]) || B1.room_id, enabled: has.has(B1.room_id) });
    });
  });
  Object.keys(out).forEach((k) => out[k].sort((x, y) => x.yaw - y.yaw || (x.to_room < y.to_room ? -1 : 1)));
  return out;
}
/* items: [{room_id, yaw_offset, hotspots:[{to_room, yaw, pitch}]}] ; nav – граф от сцената или от геометрията */
function validateHotspots(items, nav, source) {
  const issues = [], warnings = [];
  const rooms = new Set(items.map((i) => i.room_id)), geo = hotspotsFor(nav, Array.from(rooms));
  const nodeRooms = new Set(nav.nodes.map((n) => n.room_id));
  items.forEach((it) => {
    if (!nodeRooms.has(it.room_id)) issues.push({ code: "ROOM_INVALID", message: "панорама за несъществуващо помещение " + it.room_id });
    if (!fin(it.yaw_offset) || it.yaw_offset < 0 || it.yaw_offset >= 360) issues.push({ code: "YAW_INVALID", message: it.room_id + ": yaw_offset е 0…360" });
    const seen = new Set();
    (it.hotspots || []).forEach((h) => {
      const g = (geo[it.room_id] || []).find((x) => x.to_room === h.to_room);
      if (h.to_room === it.room_id) issues.push({ code: "HOTSPOT_SELF", message: it.room_id + ": преход към самото помещение" });
      else if (!g) issues.push({ code: "HOTSPOT_INVALID", message: it.room_id + " → " + h.to_room + ": няма врата/проход между тези помещения" });
      else if (!rooms.has(h.to_room)) warnings.push(it.room_id + " → " + h.to_room + ": няма панорама на съседното помещение – преходът е изключен");
      if (seen.has(h.to_room)) issues.push({ code: "HOTSPOT_DUP", message: it.room_id + " → " + h.to_room + ": повторен преход" }); seen.add(h.to_room);
      if (!fin(h.yaw) || h.yaw < 0 || h.yaw >= 360 || !fin(h.pitch) || h.pitch < -89 || h.pitch > 89) issues.push({ code: "HOTSPOT_ANGLE", message: it.room_id + " → " + h.to_room + ": ъгъл извън граници" });
      else if (g && angDiff(h.yaw, g.yaw) > 45) issues.push({ code: "ORIENTATION", message: it.room_id + " → " + h.to_room + ": посоката (" + Math.round(h.yaw) + "°) не съвпада с вратата по плана (" + Math.round(g.yaw) + "°) – завъртете панорамата" });
    });
    if (source === "scene_render" && it.yaw_offset !== 0) issues.push({ code: "ORIENTATION", message: it.room_id + ": рендерът от сцената е винаги с yaw_offset 0" });
  });
  return { ok: !issues.length, issues, warnings };
}

/* ---------------- 6. панорама: заглавка, проверка, производна ---------------- */
function imageInfo(b) {
  if (!b || b.length < 24) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "png", mime: "image/png", w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const m = b[o + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
      const len = b.readUInt16BE(o + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type: "jpeg", mime: "image/jpeg", w: b.readUInt16BE(o + 7), h: b.readUInt16BE(o + 5), progressive: m === 0xc2 };
      if (len < 2) return null;
      o += 2 + len;
    }
    return null;
  }
  return null;
}
const QUALITY = { preview: { out: 2048, min: 2048 }, final: { out: 4096, min: 4096 } };
const MAX_BYTES = 25 * 1048576, MAX_W = 8192;
/* бърза проверка без декодиране */
function checkPano(buf, quality) {
  if (!buf || !buf.length) return { ok: false, code: "FILE_MISSING", message: "файлът липсва" };
  if (buf.length > MAX_BYTES) return { ok: false, code: "FILE_TOO_LARGE", message: "файлът е над 25 MB" };
  const inf = imageInfo(buf);
  if (!inf) return { ok: false, code: "FILE_UNSUPPORTED", message: "не е JPEG/PNG (или заглавката е повредена)" };
  if (Math.abs(inf.w - 2 * inf.h) > 1) return { ok: false, code: "NOT_EQUIRECT", message: "не е равноправоъгълна панорама 2:1 (" + inf.w + "×" + inf.h + ")" };
  const q = QUALITY[quality] || QUALITY.preview;
  if (inf.w < q.min) return { ok: false, code: "TOO_SMALL", message: "панорамата е по-малка от " + q.min + "×" + q.min / 2 + " за " + (quality === "final" ? "окончателен" : "предварителен") + " режим" };
  if (inf.w > MAX_W) return { ok: false, code: "TOO_LARGE", message: "панорамата е над " + MAX_W + " px широка" };
  return { ok: true, info: inf };
}
function decode(buf) {
  if (buf[0] === 0x89) { const { PNG } = require("./_vendor/pngjs/lib/png.js"); const p = PNG.sync.read(buf); return { w: p.width, h: p.height, d: p.data }; }
  const j = require("./_vendor/jpeg-js").decode(buf, { useTArray: true, formatAsRGBA: true, maxResolutionInMP: 40, maxMemoryUsageInMB: 700 });
  return { w: j.width, h: j.height, d: j.data };
}
function resample(im, W, H) {
  if (im.w === W && im.h === H) return im;
  const out = new Uint8Array(W * H * 4), sx = im.w / W, sy = im.h / H;
  for (let Y = 0; Y < H; Y++) {
    const y0 = Math.floor(Y * sy), y1 = Math.max(y0 + 1, Math.floor((Y + 1) * sy));
    for (let X = 0; X < W; X++) {
      const x0 = Math.floor(X * sx), x1 = Math.max(x0 + 1, Math.floor((X + 1) * sx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1; y++) { let o = (y * im.w + x0) * 4; for (let x = x0; x < x1; x++, o += 4) { r += im.d[o]; g += im.d[o + 1]; b += im.d[o + 2]; n++; } }
      const k = (Y * W + X) * 4; out[k] = r / n; out[k + 1] = g / n; out[k + 2] = b / n; out[k + 3] = 255;
    }
  }
  return { w: W, h: H, d: out };
}
/* производна за публиката: прекодиран JPEG (без EXIF/GPS/автор), ширина ≤ out, + миниатюра 256×128 */
function panoDerivative(buf, quality) {
  const c = checkPano(buf, quality); if (!c.ok) return c;
  let im;
  try { im = decode(buf); } catch (e) { return { ok: false, code: "FILE_CORRUPT", message: "файлът е повреден и не се декодира" }; }
  if (!im || im.w !== c.info.w || im.h !== c.info.h) return { ok: false, code: "FILE_CORRUPT", message: "файлът е повреден" };
  for (let k = 3; k < im.d.length; k += 4) im.d[k] = 255;
  const q = QUALITY[quality] || QUALITY.preview, W = Math.min(q.out, im.w), H = W / 2;
  const out = resample(im, W, H);
  const J = require("./_vendor/jpeg-js");
  const enc = Buffer.from(J.encode({ data: out.d, width: W, height: H }, 86).data);
  const th = resample(out, 256, 128), thumb = Buffer.from(J.encode({ data: th.d, width: 256, height: 128 }, 72).data);
  /* грубо отчитане на „празна“ панорама (едноцветна) – предупреждение, не грешка */
  let mn = 255, mx = 0; for (let k = 0; k < th.d.length; k += 4) { const v = th.d[k]; if (v < mn) mn = v; if (v > mx) mx = v; }
  return { ok: true, buf: enc, w: W, h: H, bytes: enc.length, sha256: shaBuf(enc), src_sha256: shaBuf(buf), src: c.info, thumb: "data:image/jpeg;base64," + thumb.toString("base64"), flat: mx - mn < 8 };
}

module.exports = {
  G_SCHEMA, S_SCHEMA, B_SCHEMA, GENERATOR, ROOM_TYPES, ROOM_BG, LABELS, STYLE_SYSTEMS, DEFAULT_STYLE, PREFS, QUALITY, CELL, BODY_R, EYE_H,
  validateGeometry, validateStyle, materialsFor, buildScene, validateScene, architectureOf, hotspotsFor, validateHotspots,
  imageInfo, checkPano, panoDerivative, resample, canon, sha, shaBuf, deepFreeze,
  _: { area, centroid, pip, segDist, rect, rectsOverlap, rectInPoly, envOf, navGrid, unrle, rle, cellOf, walk, bfs, furnRect, bearing, angDiff, placeFurniture }
};
