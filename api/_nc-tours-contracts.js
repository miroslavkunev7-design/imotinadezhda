// ИМОТИ НАДЕЖДА · Ново строителство · TASK-010 · договори на инструментите за интериор, 3D разходка и 360° панорами.
// Същият валидатор (safeParse) като api/_nc-contracts.js; добавят се в C.CONTRACTS при зареждане на api/_nc-tours.js
// (без промяна на _nc-contracts.js – там вече е само tours.request). Изпълнението е в api/_nc-tours.js.
// role: staff = всеки служител (nd_is_staff, проверява gateway-ят); admin = nd_is_admin (проверява се в инструмента).
"use strict";
const C = require("./_nc-contracts.js");
const { schema, S } = C;
const P = C.patterns;

const id = (o) => S("string", Object.assign({ pattern: P.ID, max: 64 }, o));
const HEX64 = /^[a-f0-9]{64}$/;
const ROOM = /^[a-z][a-z0-9_-]{0,39}$/;
const IDEM = /^[A-Za-z0-9:._-]{8,120}$/;
const confirm = S("literalTrue", { required: true });
const ANGLE = (o) => S("number", Object.assign({ min: 0, max: 359.999 }, o));
const SIZE = (max) => (d, k) => (d[k] && JSON.stringify(d[k]).length > max ? [k + " е твърде голям (над " + Math.round(max / 1024) + " KB)"] : []);

const CONTRACTS = {
  "interior.geometry_save": {
    role: "admin", description: "Записва ЧЕРНОВА на геометрията на апартамент (стаи, стени, отвори, височини, ориентация – nd.unit_geometry.v1) от проверен източник (план с размери, IFC/DXF, TASK-009). Проверява я и връща грешки, липси (BLOCKED) и статистика; нищо не се „досеща“. Вход: {unit_id*, geometry*, source*(plan_manual|ifc|dxf|task009), source_ref}.",
    input: schema({ unit_id: id({ required: true }), geometry: S("object", { required: true }), source: S("string", { required: true, enum: ["plan_manual", "ifc", "dxf", "task009"] }), source_ref: S("string", { max: 300 }) }, (d) => SIZE(250000)(d, "geometry")),
    output: "{ ok, state:'draft'|'invalid', geometry_id, version, sha256, errors[], blocked[], warnings[], stats, existed, next }", errors: [400, 403, 404, 503], idem: "същата геометрия (sha256) за същия план → същата чернова"
  },
  "interior.geometry_verify": {
    role: "admin", description: "Потвърждава прегледаната геометрия (само без грешки и липси). След това тя е неизменяема; предишната проверена става „заменена“, а сцените/панорамите/публикуваното по нея – „остарели“. Вход: {geometry_id*, expected_sha256*, confirm*}.",
    input: schema({ geometry_id: id({ required: true }), expected_sha256: S("string", { required: true, pattern: HEX64 }), confirm }),
    output: "{ ok, geometry_id, version, status:'verified', stale:{…} }", errors: [400, 403, 404, 409, 503], idem: "повтор върху вече потвърдена със същата сума → replayed"
  },
  "interior.style_save": {
    role: "staff", description: "Записва нова версия на стила на интериора – за апартамент (unit_id) или за цяла сграда (building_id); без двете = по подразбиране за проекта. Стилът не може да пипа стени, отвори, височини и площи. Вход: {project_id*, unit_id | building_id, brief*{style_system(modern_classic|minimalist|scandinavian|japandi|mediterranean|custom), style_name, palette[#hex], materials[], furniture_preferences[], lighting(warm|neutral|cool), must_keep[], must_avoid[], conceptual_elements_allowed}}.",
    input: schema({ project_id: id({ required: true }), unit_id: id(), building_id: id(), brief: S("object", { required: true }) }, (d) => (d.unit_id && d.building_id ? ["подай unit_id ИЛИ building_id"] : []).concat(SIZE(12000)(d, "brief"))),
    output: "{ ok, style_id, version, sha256, style_system, existed }", errors: [400, 404, 503], idem: "същият стил (sha256) като последния → existed:true"
  },
  "interior.prepare": {
    role: "admin", description: "Подготвя 3D сцена на интериора върху ПРОВЕРЕНАТА геометрия: архитектура (замразена), материали по стила, примерни мебели в реален мащаб без да пречат на врати и пътища, светлина, неутрален фон зад прозорците, навигация и гледни точки по стаи. Лека и детерминистична – изпълнява се веднага (без задача). Без проверена геометрия → state:'blocked'. Вход: {unit_id*, geometry_id, style_id, idempotency_key, expected_version}.",
    input: schema({ unit_id: id({ required: true }), geometry_id: id(), style_id: id(), idempotency_key: S("string", { pattern: IDEM }), expected_version: S("int", { min: 0, max: 100000 }) }),
    output: "{ ok, job_id:null, state:'needs_review'|'draft'|'blocked'|'invalid', scene_version_id, version, sha256, issues[], warnings[], stats, requires_review, error_code, retryable, correlation_id }", errors: [400, 403, 404, 409, 503],
    idem: "ключ по подразбиране = обект + сума на геометрията + сума на стила + версия на строителя → същите входове дават същата сцена (replayed)"
  },
  "interior.get_scene": { role: "staff", description: "Връща записана 3D сцена (за прегледа в CRM). Вход: {scene_version_id*}.", input: schema({ scene_version_id: id({ required: true }) }), output: "{ scene_version_id, status, sha256, issues[], warnings[], scene }", errors: [400, 403, 404], idem: "само четене" },
  "interior.validate": {
    role: "admin", description: "Проверява сцената наново спрямо СЕГАШНАТА геометрия и библиотеката: архитектурата е непроменена, мебелите са с лиценз и реален размер, не влизат в стени и не пречат на врати, всички стаи са достижими. Без проблеми → „за преглед“. Вход: {scene_version_id*}.",
    input: schema({ scene_version_id: id({ required: true }) }), output: "{ ok, state, status, issues[], warnings[] }", errors: [400, 403, 404, 409], idem: "безопасен повтор"
  },
  "interior.approve": {
    role: "admin", description: "Човешки преглед на сцената: approve (одобрена – може окончателен рендер и публикуване) или reject. Вход: {scene_version_id*, decision*(approve|reject), note, confirm*}.",
    input: schema({ scene_version_id: id({ required: true }), decision: S("string", { required: true, enum: ["approve", "reject"] }), note: S("string", { max: 1000 }), confirm }),
    output: "{ ok, scene_version_id, status }", errors: [400, 403, 404, 409], idem: "повтор на същото решение → replayed"
  },
  "tour.render": {
    role: "admin", description: "Стартира набор 360° панорами за апартамент (задача tour_render): source scene_render (рендер от одобрената/прегледаната сцена – в браузъра на администратора в CRM) или photo / designer_render (качване на ИСТИНСКИ равноправоъгълни панорами 2:1 по стаи). quality preview (2048×1024) или final (4096×2048, само от одобрена сцена). Връща job_id веднага; всеки файл се отчита с tour.report. По-стара незавършена заявка за същия апартамент се отменя. Вход: {unit_id*, source*, quality, scene_version_id, rooms[], idempotency_key*, want_uploads}.",
    input: schema({ unit_id: id({ required: true }), source: S("string", { required: true, enum: ["scene_render", "photo", "designer_render"] }), quality: S("string", { enum: ["preview", "final"], default: "preview" }), scene_version_id: id(),
      rooms: S("array", { min: 1, max: 30, items: S("string", { pattern: ROOM }) }), idempotency_key: S("string", { required: true, pattern: IDEM }), want_uploads: S("boolean") }),
    output: "{ ok, job_id, state:'running', panorama_set_id, version, rooms[{room_id,name,node}], uploads?{prefix,pattern}, out_width, requires_review:false, correlation_id, next:'tour.report' }", errors: [400, 403, 404, 409, 503],
    idem: "idempotency_key → същият набор и същата задача (replayed)"
  },
  "tour.report": {
    role: "admin", description: "Отчита един качен файл (панорама на стая) за набора: сървърът го проверява (JPEG/PNG, 2:1, размер, цялост), прави производна без EXIF и миниатюра, записва го за стаята и придвижва задачата. Остарял отговор (друга задача, отменен набор, стара ревизия) → 409 и файлът се маха. Повреден/грешен файл → отказ без повтаряне (retryable:false). Вход: {job_id*, panorama_set_id*, room_id*, rev*, upload_path*}.",
    input: schema({ job_id: S("uuid", { required: true }), panorama_set_id: id({ required: true }), room_id: S("string", { required: true, pattern: ROOM }), rev: S("int", { required: true, min: 1, max: 1000 }),
      upload_path: S("string", { required: true, pattern: P.TOUR_PATH, noDotDot: true, max: 400 }) }),
    output: "{ ok, job_id, state, progress:{rooms_done, rooms_total}, panorama_set_id, item:{room_id,status,w,h,bytes}, warnings[], requires_review, error_code, retryable, correlation_id }", errors: [400, 403, 404, 409, 503],
    idem: "rev расте за всяко ново качване на стаята; същата или по-стара ревизия → 409 (остарял отговор)"
  },
  "tour.edit": {
    role: "admin", description: "Подрежда панорамите (n на /pano/) и задава посоката им (yaw_offset – накъде гледа средата на снимката спрямо плана), началния поглед и преходите към съседни стаи (само през реални врати). Вход: {panorama_set_id*, expected_version*, order[], items[{room_id*, yaw_offset, start_yaw, hotspots[{to_room*, yaw*, pitch*}]}]}.",
    input: schema({ panorama_set_id: id({ required: true }), expected_version: S("int", { required: true, min: 1 }), order: S("array", { min: 1, max: 30, items: S("string", { pattern: ROOM }) }),
      items: S("array", { max: 30, items: { room_id: S("string", { required: true, pattern: ROOM }), yaw_offset: ANGLE(), start_yaw: ANGLE(), hotspots: S("array", { max: 12, items: { to_room: S("string", { required: true, pattern: ROOM }), yaw: ANGLE({ required: true }), pitch: S("number", { required: true, min: -89, max: 89 }) } }) } }) }),
    output: "{ ok, panorama_set_id, edit_version, status }", errors: [400, 403, 404, 409], idem: "expected_version → 409 при чужда редакция"
  },
  "tour.validate": {
    role: "admin", description: "Проверява набора преди преглед: всички стаи имат производна (сумата съвпада с файла), преходите водят само към съседни стаи през врати, посоките съвпадат с плана. Без проблеми → „за преглед“. Вход: {panorama_set_id*}.",
    input: schema({ panorama_set_id: id({ required: true }) }), output: "{ ok, state:'needs_review'|'needs_input', issues[], warnings[] }", errors: [400, 403, 404, 409, 503], idem: "безопасен повтор"
  },
  "tour.publish": {
    role: "admin", description: "Публикува разходката на апартамента: проверен набор панорами и/или одобрена 3D сцена (връщането към стара версия е публикуване на старата). Предишната остава в историята. Публиката я вижда само докато апартаментът е Свободен и проектът е публикуван. Вход: {unit_id*, panorama_set_id, scene_version_id, expected_version* (сегашната публикувана версия, 0 ако няма), confirm*}.",
    input: schema({ unit_id: id({ required: true }), panorama_set_id: id(), scene_version_id: id(), expected_version: S("int", { required: true, min: 0 }), confirm }, (d) => (d.panorama_set_id || d.scene_version_id ? [] : ["подай panorama_set_id и/или scene_version_id"])),
    output: "{ ok, tour_version_id, version, previous, media, published:true }", errors: [400, 403, 404, 409], idem: "expected_version → 409 при чужда промяна"
  },
  "tour.unpublish": {
    role: "admin", description: "Сваля разходката на апартамента от сайта (данните и файловете остават за връщане). Вход: {unit_id*, expected_version*, reason*, confirm*}.",
    input: schema({ unit_id: id({ required: true }), expected_version: S("int", { required: true, min: 1 }), reason: S("string", { required: true, min: 3, max: 300 }), confirm }),
    output: "{ ok, changed, version, media_removed }", errors: [400, 403, 404, 409], idem: "expected_version"
  },
  "tour.get": {
    role: "staff", description: "Състояние на интериора и разходката на апартамент: версии на геометрията, стилове, сцени, набори панорами (с напредък), публикувани версии и какво следва. Без пътища до файлове. view=summary (за агента) или full (с геометрията и миниатюрите – за CRM). Вход: {unit_id*, view}.",
    input: schema({ unit_id: id({ required: true }), view: S("string", { enum: ["summary", "full"], default: "summary" }) }),
    output: "{ unit, geometry[], styles[], scenes[], sets[], tours[], published, blocked[], next[] }", errors: [400, 403, 404], idem: "само четене"
  },
  "tour.get_authorized_asset": {
    role: "staff", description: "Временен (60 s) подписан адрес към частна панорама на набора – за преглед от екипа (и на капарирани/продадени). Вход: {panorama_set_id*, room_id*, kind(pano|src)}.",
    input: schema({ panorama_set_id: id({ required: true }), room_id: S("string", { required: true, pattern: ROOM }), kind: S("string", { enum: ["pano", "src"], default: "pano" }) }),
    output: "{ url, expires_in:60 }", errors: [400, 403, 404], idem: "само четене"
  }
};

module.exports = { CONTRACTS, patterns: { HEX64, ROOM, IDEM } };
