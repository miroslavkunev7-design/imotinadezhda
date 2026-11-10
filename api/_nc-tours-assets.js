// ИМОТИ НАДЕЖДА · Ново строителство · TASK-010 · библиотека с 3D елементи за интериора (материали и мебели)
// Всички елементи са СОБСТВЕНИ процедурни модели: описани са тук с числа (кутии в реален мащаб, метри) и се генерират
// от кода в браузъра. Няма свалени, „изстъргани“ или чужди модели/текстури → няма лицензен риск.
// Всеки елемент има: произход, лиценз/разрешена употреба, реални размери, формат/версия, бюджет (триъгълници/текстура),
// контролна сума и етикети за стил/категория (04_SCENE_PIPELINE/ASSET_LIBRARY_RULES.md).
// Мебелите в сцената са ВИНАГИ „примерно обзавеждане“ – не са част от продажбата и не доказват геометрия.
"use strict";
const crypto = require("crypto");

const LIBRARY_ID = "nd-proc-v1";
const LIBRARY_VERSION = 1;
const LICENSE = "Собствен процедурен модел на „Имоти Надежда“ (генерира се от кода в хранилището, без външни файлове). Разрешена употреба: визуализации на сайта и в CRM.";
const PROVENANCE = "api/_nc-tours-assets.js (" + LIBRARY_ID + ")";

/* ---------- материали (цвят, грапавост, процедурен рисунък) ---------- */
// pattern: plain | planks | herringbone | tiles | grain | fabric ; scale_m – размер на мотива; tex: страна на процедурната текстура (px)
const M = (id, name, kind, color, o) => Object.assign({ id, name, kind, color, roughness: 0.8, metalness: 0, pattern: "plain", scale_m: 1, tex_px: 0 }, o || {});
const MATERIALS = [
  M("plaster_white", "Мазилка – бяла", "wall", "#f4f1ec", { roughness: 0.95 }),
  M("plaster_warm", "Мазилка – топло бяла", "wall", "#efe6da", { roughness: 0.95 }),
  M("plaster_greige", "Мазилка – грейдж", "wall", "#d9cfc2", { roughness: 0.95 }),
  M("lime_white", "Варова мазилка", "wall", "#f3eee4", { roughness: 1 }),
  M("ceiling_white", "Таван – бял", "ceiling", "#fbfaf8", { roughness: 1 }),
  M("oak_planks", "Дъб – дюшеме", "floor", "#c49a6c", { pattern: "planks", scale_m: 0.2, tex_px: 256, roughness: 0.6 }),
  M("oak_light_planks", "Светъл дъб – дюшеме", "floor", "#d8b98f", { pattern: "planks", scale_m: 0.18, tex_px: 256, roughness: 0.6 }),
  M("oak_herringbone", "Дъб – рибена кост", "floor", "#b88a5a", { pattern: "herringbone", scale_m: 0.6, tex_px: 256, roughness: 0.55 }),
  M("walnut_planks", "Орех – дюшеме", "floor", "#7a5236", { pattern: "planks", scale_m: 0.2, tex_px: 256, roughness: 0.55 }),
  M("concrete_light", "Шлайфан бетон – светъл", "floor", "#bdbab4", { pattern: "grain", scale_m: 1, tex_px: 128, roughness: 0.7 }),
  M("terracotta_tiles", "Теракота – плочки", "floor", "#b8643f", { pattern: "tiles", scale_m: 0.3, tex_px: 128, roughness: 0.8 }),
  M("tile_white", "Плочки – бели", "tile", "#eeeeea", { pattern: "tiles", scale_m: 0.3, tex_px: 128, roughness: 0.3 }),
  M("tile_grey_large", "Плочки – сиви, едър формат", "tile", "#a9a7a2", { pattern: "tiles", scale_m: 0.6, tex_px: 128, roughness: 0.35 }),
  M("tile_marble", "Плочки – бял мрамор", "tile", "#ecebe7", { pattern: "tiles", scale_m: 0.6, tex_px: 128, roughness: 0.2 }),
  M("tile_stone_greige", "Плочки – камък грейдж", "tile", "#b9ad9c", { pattern: "tiles", scale_m: 0.45, tex_px: 128, roughness: 0.5 }),
  M("tile_blue", "Плочки – синя глазура", "tile", "#3d6e96", { pattern: "tiles", scale_m: 0.15, tex_px: 128, roughness: 0.3 }),
  M("deck_wpc", "Терасна дъска", "floor", "#8c7b6b", { pattern: "planks", scale_m: 0.14, tex_px: 256, roughness: 0.8 }),
  M("wood_oak", "Дърво – дъб", "wood", "#b58b5c", { pattern: "grain", scale_m: 0.5, tex_px: 128, roughness: 0.55 }),
  M("wood_walnut", "Дърво – орех", "wood", "#6e4a33", { pattern: "grain", scale_m: 0.5, tex_px: 128, roughness: 0.5 }),
  M("wood_birch", "Дърво – бреза", "wood", "#dcc7a3", { pattern: "grain", scale_m: 0.5, tex_px: 128, roughness: 0.6 }),
  M("wood_olive", "Дърво – маслина", "wood", "#8f7a52", { pattern: "grain", scale_m: 0.5, tex_px: 128, roughness: 0.6 }),
  M("lacquer_white", "Лак – бял", "wood", "#f2f0ec", { roughness: 0.35 }),
  M("lacquer_black", "Лак – черен", "wood", "#2b2a29", { roughness: 0.4 }),
  M("fabric_cream", "Плат – крем", "textile", "#e8dccb", { pattern: "fabric", scale_m: 0.1, tex_px: 64, roughness: 1 }),
  M("fabric_grey", "Плат – светлосив", "textile", "#c7c5c1", { pattern: "fabric", scale_m: 0.1, tex_px: 64, roughness: 1 }),
  M("fabric_linen", "Лен – натурален", "textile", "#d6cbb7", { pattern: "fabric", scale_m: 0.1, tex_px: 64, roughness: 1 }),
  M("fabric_charcoal", "Плат – графит", "textile", "#4a4847", { pattern: "fabric", scale_m: 0.1, tex_px: 64, roughness: 1 }),
  M("fabric_burgundy", "Плат – бордо", "textile", "#7d1f2c", { pattern: "fabric", scale_m: 0.1, tex_px: 64, roughness: 1 }),
  M("fabric_sage", "Плат – градински чай", "textile", "#9aa98f", { pattern: "fabric", scale_m: 0.1, tex_px: 64, roughness: 1 }),
  M("fabric_terracotta", "Плат – теракота", "textile", "#b5654a", { pattern: "fabric", scale_m: 0.1, tex_px: 64, roughness: 1 }),
  M("metal_brass", "Месинг", "metal", "#b9975b", { roughness: 0.35, metalness: 0.8 }),
  M("metal_black", "Черен метал", "metal", "#262626", { roughness: 0.45, metalness: 0.6 }),
  M("metal_steel", "Стомана", "metal", "#b8bcbf", { roughness: 0.3, metalness: 0.8 }),
  M("ceramic_white", "Санитарен фаянс", "ceramic", "#fbfbfa", { roughness: 0.15 }),
  M("stone_counter", "Плот – камък", "stone", "#d8d4cc", { roughness: 0.3 }),
  M("plant_green", "Растение (стилизирано)", "plant", "#5d7d4b", { roughness: 0.9 }),
  M("glass", "Стъкло", "glass", "#cfe3ea", { roughness: 0.05, opacity: 0.25 })
];

/* ---------- мебели: реални размери (м) и части (кутии) ----------
   Локални координати: x – по ширината (w), y – по дълбочината (d, +y = лицето на мебелта), z – височина от пода.
   Част: [x, y, z, w, d, h, слот]; слотът се свързва с материал от стила (fabric | wood | metal | accent | ceramic | stone | plant | glass | white). */
const F = (id, name, category, w, d, h, parts, o) => Object.assign({ id, name, category, dims_m: { w, d, h }, parts }, o || {});
const FURNITURE = [
  F("sofa_3", "Диван, 3-местен", "seating", 2.2, 0.95, 0.85, [[0, -0.02, 0, 2.2, 0.91, 0.42, "fabric"], [0, -0.36, 0.42, 2.2, 0.23, 0.43, "fabric"], [-1.02, 0.02, 0.42, 0.16, 0.91, 0.2, "fabric"], [1.02, 0.02, 0.42, 0.16, 0.91, 0.2, "fabric"]]),
  F("armchair", "Фотьойл", "seating", 0.85, 0.85, 0.85, [[0, 0, 0, 0.85, 0.85, 0.42, "accent"], [0, -0.32, 0.42, 0.85, 0.21, 0.43, "accent"]]),
  F("coffee_table", "Холна маса", "table", 1.1, 0.6, 0.42, [[0, 0, 0.36, 1.1, 0.6, 0.06, "wood"], [-0.5, -0.24, 0, 0.05, 0.05, 0.36, "metal"], [0.5, -0.24, 0, 0.05, 0.05, 0.36, "metal"], [-0.5, 0.24, 0, 0.05, 0.05, 0.36, "metal"], [0.5, 0.24, 0, 0.05, 0.05, 0.36, "metal"]]),
  F("tv_unit", "ТВ шкаф", "storage", 1.8, 0.45, 1.3, [[0, 0, 0.05, 1.8, 0.45, 0.45, "wood"], [0, -0.19, 0.6, 1.4, 0.04, 0.7, "dark"]], { notes: "Тъмният правоъгълник е стилизиран екран" }),
  F("rug_living", "Килим", "textile", 2.0, 1.4, 0.01, [[0, 0, 0, 2.0, 1.4, 0.01, "textile"]], { floor_layer: true }),
  F("dining_table_4", "Маса за хранене (4)", "table", 1.4, 0.85, 0.75, [[0, 0, 0.71, 1.4, 0.85, 0.04, "wood"], [-0.64, -0.36, 0, 0.06, 0.06, 0.71, "wood"], [0.64, -0.36, 0, 0.06, 0.06, 0.71, "wood"], [-0.64, 0.36, 0, 0.06, 0.06, 0.71, "wood"], [0.64, 0.36, 0, 0.06, 0.06, 0.71, "wood"]], { clearance_m: 0.6 }),
  F("dining_chair", "Стол", "seating", 0.45, 0.5, 0.9, [[0, 0, 0.42, 0.45, 0.45, 0.05, "accent"], [0, -0.21, 0.47, 0.45, 0.05, 0.43, "accent"], [-0.19, 0.19, 0, 0.04, 0.04, 0.42, "metal"], [0.19, 0.19, 0, 0.04, 0.04, 0.42, "metal"], [-0.19, -0.19, 0, 0.04, 0.04, 0.42, "metal"], [0.19, -0.19, 0, 0.04, 0.04, 0.42, "metal"]]),
  F("kitchen_run_240", "Кухня – права, 240 см", "kitchen", 2.4, 0.62, 2.2, [[0, 0, 0, 2.4, 0.6, 0.86, "white"], [0, 0.01, 0.86, 2.4, 0.62, 0.04, "stone"], [0, -0.13, 1.45, 2.4, 0.35, 0.72, "white"], [0.5, 0.05, 0.9, 0.5, 0.4, 0.01, "dark"]], { notes: "Долни шкафове, плот, горни шкафове, стилизиран котлон" }),
  F("kitchen_run_180", "Кухня – права, 180 см", "kitchen", 1.8, 0.62, 2.2, [[0, 0, 0, 1.8, 0.6, 0.86, "white"], [0, 0.01, 0.86, 1.8, 0.62, 0.04, "stone"], [0, -0.13, 1.45, 1.8, 0.35, 0.72, "white"], [0.35, 0.05, 0.9, 0.5, 0.4, 0.01, "dark"]]),
  F("fridge", "Хладилник", "kitchen", 0.6, 0.65, 1.85, [[0, 0, 0, 0.6, 0.65, 1.85, "steel"]]),
  F("bed_double", "Спалня, 160×200", "bed", 1.7, 2.1, 1.0, [[0, 0.05, 0, 1.7, 2.0, 0.3, "wood"], [0, 0.05, 0.3, 1.6, 2.0, 0.22, "textile"], [0, -1.0, 0, 1.7, 0.1, 1.0, "fabric"], [0, 0.5, 0.52, 1.62, 1.0, 0.03, "accent"]]),
  F("bed_single", "Легло, 90×200", "bed", 1.0, 2.1, 0.9, [[0, 0.05, 0, 1.0, 2.0, 0.3, "wood"], [0, 0.05, 0.3, 0.9, 2.0, 0.2, "textile"], [0, -1.0, 0, 1.0, 0.1, 0.9, "fabric"]]),
  F("nightstand", "Нощно шкафче", "storage", 0.45, 0.4, 0.5, [[0, 0, 0.05, 0.45, 0.4, 0.45, "wood"]]),
  F("wardrobe_160", "Гардероб, 160 см", "storage", 1.6, 0.6, 2.2, [[0, 0, 0, 1.6, 0.6, 2.2, "white"], [0, 0.301, 1.0, 0.01, 0.005, 0.4, "metal"]]),
  F("wardrobe_100", "Гардероб, 100 см", "storage", 1.0, 0.6, 2.2, [[0, 0, 0, 1.0, 0.6, 2.2, "white"]]),
  F("desk", "Бюро", "table", 1.2, 0.6, 0.75, [[0, 0, 0.72, 1.2, 0.6, 0.03, "wood"], [-0.57, 0, 0, 0.04, 0.56, 0.72, "metal"], [0.57, 0, 0, 0.04, 0.56, 0.72, "metal"]]),
  F("bathtub", "Вана, 170×75", "bath", 1.7, 0.75, 0.58, [[0, 0, 0, 1.7, 0.75, 0.58, "ceramic"]]),
  F("shower_90", "Душ кабина, 90×90", "bath", 0.9, 0.9, 2.0, [[0, 0, 0, 0.9, 0.9, 0.06, "ceramic"], [0, 0.44, 0.06, 0.9, 0.01, 1.94, "glass"], [0.44, 0, 0.06, 0.01, 0.9, 1.94, "glass"]]),
  F("toilet", "Тоалетна чиния", "bath", 0.38, 0.62, 0.8, [[0, 0.06, 0, 0.36, 0.5, 0.42, "ceramic"], [0, -0.25, 0.3, 0.38, 0.12, 0.5, "ceramic"]]),
  F("vanity_60", "Мивка с шкаф и огледало, 60 см", "bath", 0.6, 0.46, 1.9, [[0, 0, 0.1, 0.6, 0.46, 0.7, "wood"], [0, 0, 0.8, 0.6, 0.46, 0.05, "ceramic"], [0, -0.22, 1.1, 0.6, 0.02, 0.8, "glass"]]),
  F("washbasin_45", "Мивка, 45 см", "bath", 0.45, 0.35, 0.85, [[0, 0, 0.7, 0.45, 0.35, 0.15, "ceramic"]]),
  F("washer", "Перална машина", "appliance", 0.6, 0.6, 0.85, [[0, 0, 0, 0.6, 0.6, 0.85, "white"]]),
  F("shoe_cabinet", "Шкаф за обувки", "storage", 0.8, 0.35, 1.0, [[0, 0, 0, 0.8, 0.35, 1.0, "wood"]]),
  F("bookshelf", "Етажерка", "storage", 0.8, 0.35, 1.8, [[0, 0, 0, 0.8, 0.35, 1.8, "wood"]]),
  F("plant_floor", "Растение в саксия (стилизирано)", "decor", 0.45, 0.45, 1.2, [[0, 0, 0, 0.36, 0.36, 0.4, "accent"], [0, 0, 0.4, 0.45, 0.45, 0.8, "plant"]]),
  F("outdoor_table", "Маса за тераса", "outdoor", 0.7, 0.7, 0.74, [[0, 0, 0.7, 0.7, 0.7, 0.04, "metal"], [0, 0, 0, 0.08, 0.08, 0.7, "metal"]]),
  F("outdoor_chair", "Стол за тераса", "outdoor", 0.5, 0.55, 0.85, [[0, 0, 0.42, 0.5, 0.5, 0.05, "metal"], [0, -0.24, 0.47, 0.5, 0.05, 0.38, "metal"], [0, 0, 0, 0.05, 0.05, 0.42, "metal"]])
];

const SLOT_KINDS = ["fabric", "wood", "metal", "accent", "textile", "ceramic", "stone", "plant", "glass", "white", "steel", "dark"];

function canon(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
}
const sha = (v) => crypto.createHash("sha256").update(canon(v)).digest("hex");

function withMeta(a, format) {
  const def = Object.assign({}, a);
  const tris = a.parts ? a.parts.length * 12 : 2;
  const out = Object.assign(def, {
    library: LIBRARY_ID, version: LIBRARY_VERSION, format, license: LICENSE, provenance: PROVENANCE, allowed: true,
    budget: { triangles: tris, texture_px: a.tex_px || 0 },
    tags: [a.kind || a.category].concat(a.tags || [])
  });
  out.checksum = sha(Object.assign({}, a, { format, library: LIBRARY_ID, version: LIBRARY_VERSION }));
  return Object.freeze(out);
}
const MAT = {}; MATERIALS.forEach((m) => { MAT[m.id] = withMeta(m, "nd-proc-material@1"); });
const FUR = {}; FURNITURE.forEach((f) => { FUR[f.id] = withMeta(f, "nd-proc-boxes@1"); });
const CATALOG = Object.freeze({ id: LIBRARY_ID, version: LIBRARY_VERSION, license: LICENSE, provenance: PROVENANCE, materials: Object.freeze(MAT), furniture: Object.freeze(FUR) });
const CATALOG_SHA = sha({ id: LIBRARY_ID, version: LIBRARY_VERSION, m: Object.keys(MAT).map((k) => MAT[k].checksum), f: Object.keys(FUR).map((k) => FUR[k].checksum) });

/* проверка на един елемент по ASSET_LIBRARY_RULES (връща списък с липси) */
function assetIssues(a) {
  const e = [];
  if (!a) return ["липсва"];
  if (!a.provenance) e.push("без произход");
  if (!a.license || a.allowed !== true) e.push("без лиценз/разрешение");
  if (!a.format || !a.version) e.push("без формат/версия");
  if (!a.budget) e.push("без бюджет");
  if (!/^[a-f0-9]{64}$/.test(a.checksum || "")) e.push("без контролна сума");
  if (!a.tags || !a.tags.length) e.push("без етикети");
  if (a.parts) {
    const d = a.dims_m || {};
    if (!(d.w > 0 && d.d > 0 && d.h > 0)) e.push("без реални размери");
    for (const p of a.parts) {
      if (p.length !== 7 || !SLOT_KINDS.includes(p[6])) { e.push("невалидна част"); break; }
      const [x, y, z, w, dd, h] = p;
      if (Math.abs(x) + w / 2 > d.w / 2 + 0.011 || Math.abs(y) + dd / 2 > d.d / 2 + 0.011 || z + h > d.h + 0.011 || z < 0) { e.push("част извън размерите"); break; }
    }
  }
  return e;
}
/* матрица лиценз/произход (13_TEMPLATES/ASSET_LICENSE_MATRIX.json) */
function licenseMatrix() {
  return { library: LIBRARY_ID, version: LIBRARY_VERSION, sha256: CATALOG_SHA, assets: Object.values(MAT).concat(Object.values(FUR)).map((a) => ({ id: a.id, name: a.name, type: a.parts ? "furniture" : "material", format: a.format, version: a.version, license: a.license, provenance: a.provenance, dims_m: a.dims_m || null, budget: a.budget, checksum: a.checksum, tags: a.tags, issues: assetIssues(a) })) };
}

module.exports = { CATALOG, CATALOG_SHA, LIBRARY_ID, LIBRARY_VERSION, assetIssues, licenseMatrix, canon, sha };
