// ИМОТИ НАДЕЖДА · Ново строителство · ДОГОВОРИ на инструментите (tools) за /api/tools
// Договорите (вход/изход/роля) на модула. Изпълнението е в api/_nc-tools.js. Файлът започва с „_“ → не е отделна Vercel функция.
//
// Как влизат в живия gateway (без нова Vercel функция – лимитът е 12 и е запълнен):
//   api/tools.js, след реда, който зарежда _ted-skills.js:
//     try { const NC = require("./_nc-tools.js"); Object.keys(NC.tools).forEach((k) => { if (!tools[k]) tools[k] = NC.tools[k]; }); } catch (e) { console.error("nc tools not loaded", e && e.message); }
//   Същият Bearer токен на служителя, същият nd_is_staff(), същият одит в nd_audit.
//   Всеки tool = { description, input: { safeParse }, run(ctx, input) } – както в _ted-skills.js.
//
// Валидаторът е надмножество на schema() от api/_ted-skills.js (същият safeParse договор),
// с добавени: int, uuid, pattern, вложени обекти (fields) и масиви с елементи (items).
"use strict";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[a-z0-9]{8,64}$/;                       // nd_* id (uuid без тирета)
const SLUG = /^[a-z0-9][a-z0-9-]{2,60}$/;
const UNIT_CODE = /^(?!(?:public|private|derived|plans|units|cad|imports|tours)$)[A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9._\- ]{0,19}$/iu; // C4: без запазени думи от пътищата
// частен път в bucket nd-files; ".." и обратна наклонена са забранени отделно.
// B1: api/_storage-access.js НЕ се разширява с "projects" – така /f/ линковете и файловите инструменти на Тед не могат да изнесат оригинален план.
// Модулът чете файловете си сам (със service role, след проверка на проекта и ролята).
const PRIVATE_PATH = /^projects\/[a-z0-9]{8,64}\/private\/(plans|units|cad|imports)\/[^\0\\%]{1,280}$/;
const IMPORT_PATH = /^(projects\/[a-z0-9]{8,64}\/private\/imports\/|ted-chat\/)[^\0\\%]{1,300}$/;
const PUBLIC_PATH = /^projects\/[a-z0-9]{8,64}\/public\/[^\0\\%]{1,280}$/;
const TOUR_PATH = /^projects\/[a-z0-9]{8,64}\/private\/tours\/[^\0\\%]{1,280}$/;
// C3: пътят трябва да е в СЪЩИЯ проект
const pathInProject = (p, projectId) => !p || String(p).split("/")[1] === projectId;
// Трите статуса от одобрените референции 01–04 (Свободни / Капарирани / Продадени). „Депозиран“ НЕ е включен.
const STATUSES = ["free", "reserved", "sold"];
const STATUS_BG = { free: "Свободен", reserved: "Капариран", sold: "Продаден" };

const S = (type, o) => Object.assign({ type }, o || {});

function check(spec, v, pathArr, issues) {
  const bad = (m) => { issues.push({ path: pathArr, message: m }); return undefined; };
  switch (spec.type) {
    case "string": case "uuid": {
      if (typeof v !== "string") return bad("string");
      const s = spec.trim === false ? v : v.trim();
      if (spec.type === "uuid" && !UUID.test(s)) return bad("uuid");
      if (spec.min && s.length < spec.min) return bad("min " + spec.min);
      if (spec.max && s.length > spec.max) return bad("max " + spec.max);
      if (spec.enum && !spec.enum.includes(s)) return bad("one of " + spec.enum.join("|"));
      if (spec.pattern && !spec.pattern.test(s)) return bad("pattern");
      if (spec.noDotDot && (s.includes("..") || s.includes("//") || s.includes("%") || s.includes("\\"))) return bad("path"); // C5: и кодирани „%2e%2e“
      return s;
    }
    case "number": case "int": {
      if (typeof v === "string" && v.trim() === "") return bad("number");
      const n = typeof v === "number" ? v : Number(v);
      if (!isFinite(n)) return bad("number");
      if (spec.type === "int" && !Number.isInteger(n)) return bad("integer");
      if (spec.min != null && n < spec.min) return bad("min " + spec.min);
      if (spec.max != null && n > spec.max) return bad("max " + spec.max);
      if (spec.gt != null && !(n > spec.gt)) return bad("> " + spec.gt);
      return n;
    }
    case "boolean": return v === true || v === "true" || v === 1;
    case "literalTrue": return v === true ? true : bad("must be true (изрично потвърждение)");
    case "array": {
      if (!Array.isArray(v)) return bad("array");
      if (spec.min && v.length < spec.min) return bad("min " + spec.min);
      if (spec.max && v.length > spec.max) return bad("max " + spec.max);
      if (!spec.items) return v;
      return v.map((x, i) => (spec.items.type ? check(spec.items, x, pathArr.concat(i), issues) : object(spec.items, x, pathArr.concat(i), issues)));
    }
    case "object": {
      if (!v || typeof v !== "object" || Array.isArray(v)) return bad("object");
      return spec.fields ? object(spec.fields, v, pathArr, issues) : v;
    }
    default: return bad("unknown type " + spec.type);
  }
}
function object(fields, input, pathArr, issues) {
  const out = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) { issues.push({ path: pathArr, message: "object" }); return out; }
  for (const k of Object.keys(fields)) {
    const s = fields[k], v = input[k];
    if (v === undefined || v === null || v === "") {
      if (s.required) issues.push({ path: pathArr.concat(k), message: "required" });
      else if (s.default !== undefined) out[k] = s.default;
      continue;
    }
    const r = check(s, v, pathArr.concat(k), issues);
    if (r !== undefined) out[k] = r;
  }
  // непознати ключове се изхвърлят (не стигат до базата); забранените се отказват изрично
  deepForbidden(input, pathArr, issues, 0);
  return out;
}
// C2: проверката е рекурсивна – и във вложени обекти и масиви
function deepForbidden(v, pathArr, issues, depth) {
  if (!v || typeof v !== "object" || depth > 8) return;
  if (Array.isArray(v)) { v.forEach((x, i) => deepForbidden(x, pathArr.concat(i), issues, depth + 1)); return; }
  for (const k of Object.keys(v)) {
    if (FORBIDDEN_KEYS.test(k)) issues.push({ path: pathArr.concat(k), message: "забранено поле в модула (без инвеститор/строител/изпълнител)" });
    else deepForbidden(v[k], pathArr.concat(k), issues, depth + 1);
  }
}
const FORBIDDEN_KEYS = /^(investors?|builders?|developers?|contractors?|construction[_ ]?company|инвеститор(и)?|строител(и)?|изпълнител(и)?|строителна[_ ]фирма)$/iu;

// C1: refine е ЧАСТ от safeParse – живият handler вика точно tool.input.safeParse(...)
function schema(fields, refine) {
  return { fields, safeParse(input) {
    const issues = []; const data = object(fields, input || {}, [], issues);
    if (!issues.length && refine) (refine(data) || []).forEach((m) => issues.push({ path: [], message: m }));
    return issues.length ? { success: false, error: { issues } } : { success: true, data };
  } };
}

/* ---------- общи части ---------- */
const id = (o) => S("string", Object.assign({ pattern: ID, max: 64 }, o));
const version = S("int", { required: true, min: 1 });
const confirm = S("literalTrue", { required: true });
const area = (o) => S("number", Object.assign({ gt: 0, max: 100000 }, o));
const money = (o) => S("number", Object.assign({ gt: 0, max: 1e9 }, o)); // цена 0 не е цена
const projectFields = {
  title: S("string", { max: 200 }), city: S("string", { max: 80 }), hood: S("string", { max: 80 }), address: S("string", { max: 300 }),
  description: S("string", { max: 10000 }),
  stage: S("string", { enum: ["start", "excavation", "rough", "act14", "act15", "act16"] }),
  stage_percent: S("int", { min: 0, max: 100 }),
  expected_completion: S("string", { max: 40 }),
  advantages: S("array", { max: 20, items: S("string", { max: 120 }) }),
  price_policy: S("object", { fields: { basis: S("string", { enum: ["total", "net"], default: "total" }) } }),
  location: S("object", { fields: { lat: S("number", { min: -90, max: 90 }), lng: S("number", { min: -180, max: 180 }) } })
};
const unitFields = {
  code: S("string", { pattern: UNIT_CODE, max: 20 }),
  rooms: S("int", { min: 0, max: 20 }), beds: S("int", { min: 0, max: 20 }), baths: S("int", { min: 0, max: 20 }),
  area_total: area(), area_net: area(), terrace_area: S("number", { min: 0, max: 100000 }),
  exposure: S("string", { max: 40 }),
  price_per_m2: money(),
  price_override: S("boolean"), price_total: money(), price_override_reason: S("string", { min: 3, max: 300 }),
  plan_path: S("string", { pattern: PRIVATE_PATH, noDotDot: true, max: 400 }),
  interior_style: S("string", { max: 80 })
};

/* импорт: прегледаната чернова (accept). Пътища от клиента НЕ се приемат – плановете се посочват с file_id от манифеста. */
const REF = /^[a-z][a-z0-9_-]{0,39}$/i;
const FILE_ID = /^f\d{1,5}$/;
const importProjectFields = { title: S("string", { min: 2, max: 200 }), city: S("string", { max: 80 }), hood: S("string", { max: 80 }), address: S("string", { max: 300 }), description: S("string", { max: 10000 }),
  stage: projectFields.stage, stage_percent: projectFields.stage_percent, expected_completion: S("string", { max: 40 }), advantages: projectFields.advantages };
const importUnitFields = {
  ref: S("string", { required: true, pattern: REF, max: 40 }), floor_ref: S("string", { required: true, pattern: REF, max: 40 }), code: S("string", { required: true, pattern: UNIT_CODE, max: 20 }),
  area_total: area(), area_net: area(), terrace_area: S("number", { min: 0, max: 100000 }), price_per_m2: money(),
  rooms: S("int", { min: 0, max: 20 }), beds: S("int", { min: 0, max: 20 }), baths: S("int", { min: 0, max: 20 }), exposure: S("string", { max: 40 }),
  price_override: S("boolean"), price_total: money(), price_override_reason: S("string", { min: 3, max: 300 }), plan_file_id: S("string", { pattern: FILE_ID })
};

/* ---------- каталог ----------
   role:  staff  = всеки служител (nd_is_staff);  admin = nd_is_admin (проверката е в базата)
   errors: HTTP кодове, които handler-ът връща като {ok:false,error}
   idem:  как се пази от повторно изпълнение                                   */
const CONTRACTS = {
  "nc.help": {
    role: "staff", description: "Описва инструментите на модул „Ново строителство“ и техните входове (за агента).",
    input: schema({ tool: S("string", { max: 60 }) }), output: "{ tools: [{ name, description, input }] }", errors: [400], idem: "само четене"
  },
  "projects.list": {
    role: "staff", description: "Списък проекти „ново строителство“ с броячи по статус на апартаментите.",
    input: schema({ status: S("string", { enum: ["draft", "published", "archived"] }), text: S("string", { max: 100 }) }),
    output: "[{ id, slug, name, status, version, city, hood, counts:{ buildings, floors, units, free, reserved, sold } }]", errors: [400], idem: "само четене"
  },
  "projects.get": {
    role: "staff", description: "Един проект със сгради, етажи и обекти. Вход: {id*}. НЕ връща пътища към оригинални планове – само has_plan и plan_rev (C10/B1).",
    input: schema({ id: id({ required: true }) }), output: "{ project, buildings[], floors[{…, has_plan, plan_rev}], units[{…, has_plan, plan_rev}], media[] }", errors: [400, 404], idem: "само четене"
  },
  "projects.create_draft": {
    role: "staff", description: "Създава ЧЕРНОВА на проект (никога публикуван).",
    input: schema(Object.assign({}, projectFields, { title: S("string", { required: true, min: 2, max: 200 }), client_request_id: S("uuid") })),
    output: "{ id, status:'draft', version:1, existed }", errors: [400], idem: "client_request_id (по избор): повтор със същия връща вече създадения проект"
  },
  "projects.update": {
    role: "staff", description: "Редактира полета на проект. Статусът НЕ се сменя оттук.",
    input: schema({ id: id({ required: true }), expected_version: version, fields: S("object", { required: true, fields: projectFields }) }),
    output: "{ id, version, content_rev }", errors: [400, 403, 404, 409], idem: "expected_version → при разминаване 409, нищо не се записва"
  },
  "projects.mark_reviewed": {
    role: "admin", description: "Отбелязва съдържанието като проверено от човек (RPC nd_project_mark_reviewed). Важи само за този content_rev – всяка следваща промяна го обезсилва. Вход: {id*, expected_content_rev*, confirm*}.",
    input: schema({ id: id({ required: true }), expected_content_rev: version, confirm }), output: "{ id, content_rev, reviewed_rev }", errors: [400, 403, 404, 409], idem: "expected_content_rev"
  },
  "projects.set_media": {
    role: "admin", description: "Задава публичната медия на проект: корица, галерия, файлове, 3D модел на сграда, панорами на обект (таблица nd_project_media). Вход: {project_id*, kind*(cover|gallery|file|model|tour), items*[{path*,title,sort}], building_id (за model), unit_id (за tour), confirm*}.",
    input: schema({
      project_id: id({ required: true }), kind: S("string", { required: true, enum: ["cover", "gallery", "file", "model", "tour"] }), building_id: id(), unit_id: id(),
      items: S("array", { required: true, max: 60, items: { path: S("string", { required: true, noDotDot: true, max: 300 }), title: S("string", { max: 120 }), sort: S("int", { min: 0, max: 999 }) } }), confirm
    }, (d) => {
      const e = [];
      if ((d.kind === "model") !== !!d.building_id) e.push("building_id се подава само за kind=model");
      if ((d.kind === "tour") !== !!d.unit_id) e.push("unit_id се подава само за kind=tour");
      if (d.kind === "cover" && d.items.length > 1) e.push("корицата е една");
      for (const it of d.items) {
        if (!(d.kind === "tour" ? TOUR_PATH : PUBLIC_PATH).test(it.path)) e.push("път извън " + (d.kind === "tour" ? "private/tours" : "public") + ": " + it.path);
        else if (!pathInProject(it.path, d.project_id)) e.push("файлът е от друг проект: " + it.path);
      }
      return e;
    }),
    output: "{ project_id, kind, count }", errors: [400, 403, 404], idem: "заменя целия списък за този kind (и сграда/обект) – повторът дава същия резултат"
  },
  "projects.publish": {
    role: "admin", description: "Публикува проверена чернова (само администратор, с изрично потвърждение). При липси връща списък, не публикува.",
    input: schema({ id: id({ required: true }), expected_version: version, slug: S("string", { pattern: SLUG }), confirm }),
    output: "{ ok:true, status:'published', slug, version } | { ok:false, issues:[...] }", errors: [400, 403, 404, 409], idem: "expected_version"
  },
  "projects.archive": {
    role: "admin", description: "Сваля проект от сайта (архив). Данните остават.",
    input: schema({ id: id({ required: true }), expected_version: version, confirm }), output: "{ ok:true, status:'archived', version }", errors: [400, 403, 404, 409], idem: "expected_version"
  },
  "buildings.upsert": {
    role: "staff", description: "Добавя или редактира сграда в проект.",
    input: schema({ project_id: id({ required: true }), id: id(), name: S("string", { required: true, max: 120 }), sort: S("int", { min: 0, max: 999 }), style: S("string", { max: 120 }), expected_updated_at: S("string", { max: 40 }) }),
    output: "{ id, project_id, name, updated_at }", errors: [400, 403, 404, 409], idem: "с id = обновяване (expected_updated_at → 409 при чужда промяна); без id = нова. Сграда не се мести в друг проект."
  },
  "floors.upsert": {
    role: "staff", description: "Добавя или редактира етаж (ниво, етикет, частен път към плана, полигони на апартаментите върху плана).",
    input: schema({
      building_id: id({ required: true }), id: id(), level: S("int", { required: true, min: -5, max: 200 }), label: S("string", { max: 60 }),
      plan_path: S("string", { pattern: PRIVATE_PATH, noDotDot: true, max: 400 }), plan_w: S("int", { min: 1, max: 20000 }), plan_h: S("int", { min: 1, max: 20000 }),
      polygons: S("array", { max: 200, items: { unit_code: S("string", { required: true, pattern: UNIT_CODE }), points: S("array", { required: true, min: 3, max: 200, items: S("array", { min: 2, max: 2, items: S("number", { min: 0, max: 1 }) }) }) } }),
      expected_updated_at: S("string", { max: 40 })
    }),
    output: "{ id, building_id, level, plan_rev, updated_at }", errors: [400, 403, 404, 409], idem: "уникално (building_id, level); с id building_id не се сменя (базата отказва); run() сверява plan_path с проекта на сградата (C3)"
  },
  "units.list": {
    role: "staff", description: "Апартаменти на проект (филтър по сграда, етаж, статус).",
    input: schema({ project_id: id({ required: true }), building_id: id(), floor_id: id(), status: S("string", { enum: STATUSES }) }),
    output: "[{ id, code, status, version, area_total, area_net, terrace_area, price_per_m2, price_total, rooms, floor_id }]", errors: [400], idem: "само четене"
  },
  "units.get": { role: "staff", description: "Един обект с историята на статусите и на цените/площите. Вход: {id*}. Без път към оригиналния план.", input: schema({ id: id({ required: true }) }), output: "{ unit, events[], changes[] }", errors: [400, 404], idem: "само четене" },
  "units.upsert": {
    role: "staff", description: "Добавя или редактира апартамент. Общата цена се смята от базата (площ × цена/м²); ръчна цена само с price_override и причина. Статусът НЕ се сменя оттук.",
    input: schema(Object.assign({ project_id: id({ required: true }), building_id: id({ required: true }), floor_id: id({ required: true }), id: id(), expected_version: S("int", { min: 1 }) }, unitFields), (d) => {
      const e = [];
      if (d.id && !d.expected_version) e.push("expected_version е задължителен при редакция");
      if (!d.id && !d.code) e.push("code е задължителен за нов обект");
      if (d.price_override && (d.price_total == null || !d.price_override_reason)) e.push("ръчна цена изисква price_total и причина");
      if (!d.price_override && d.price_total != null) e.push("price_total се изчислява от системата; за ръчна цена подай price_override:true и причина");
      if (d.area_net != null && d.area_total != null && d.area_net > d.area_total) e.push("чистата площ не може да е по-голяма от общата");
      if (!pathInProject(d.plan_path, d.project_id)) e.push("plan_path е от друг проект");
      return e;
    }),
    output: "{ id, code, version, price_total }", errors: [400, 404, 409], idem: "expected_version при редакция; уникално (project_id, code)"
  },
  "units.set_status": {
    role: "staff (sold и връщане назад: admin)", description: "Сменя статуса на апартамент: free|reserved|sold (Свободен|Капариран|Продаден). Единствената точка за UI и агент (RPC nd_unit_set_status). Изисква изрично потвърждение.",
    input: schema({ unit_id: id({ required: true }), to: S("string", { required: true, enum: STATUSES }), expected_version: version, event_id: S("uuid"), note: S("string", { max: 1000 }), client_id: S("string", { max: 64 }), deal_id: S("string", { max: 64 }), confirm }),
    output: "{ unit:{ id, code, status, version }, event_id, replayed }", errors: [400, 403, 404, 409],
    idem: "event_id е по избор (C9): ако липсва, базата го извежда от (unit_id, to, expected_version) → повторът е безопасен и без него; expected_version → 409 при чужда промяна"
  },
  "imports.start": {
    role: "staff (публикуван проект: само admin)",
    description: "Стартира импорт (анализ) на вече качени файлове за проект „Ново строителство“. Файловете са в projects/<project_id>/private/imports/<import_id>/… (качени от CRM) или прикачени в чата (ted-chat/…). За нов проект първо projects.create_draft. Връща job_id веднага; обработката върви на парчета – викай jobs.status на няколко секунди, всяко извикване придвижва задачата. Повтор със същите файлове връща същата задача (rerun:true = нов анализ). Нищо не се записва в проекта и нищо не се публикува – резултатът е чернова за преглед (jobs.result), записът е отделно с imports.apply.",
    input: schema({
      project_id: id({ required: true }), mode: S("string", { enum: ["new", "update"], default: "new" }), rerun: S("boolean"), ai: S("boolean", { default: true }),
      files: S("array", { required: true, min: 1, max: 2000, items: { path: S("string", { required: true, pattern: IMPORT_PATH, noDotDot: true, max: 400 }), name: S("string", { required: true, max: 300, trim: false }), mime: S("string", { max: 120 }), size: S("int", { min: 1, max: 41943040 }), sha256: S("string", { pattern: /^[a-f0-9]{64}$/ }) } })
    }, (d) => {
      const e = [], seen = new Set();
      let imp = null;
      for (const f of d.files) {
        if (seen.has(f.path)) e.push("файлът е подаден два пъти: " + f.path); seen.add(f.path);
        if (/[\u0000-\u001f\u007f]/.test(f.name) || f.name.split(/[\\/]/).includes("..")) e.push("невалидно име на файл: " + f.name.slice(0, 60));
        if (f.path.startsWith("projects/")) {
          const g = f.path.split("/");
          if (!pathInProject(f.path, d.project_id)) e.push("файлът е от друг проект: " + f.path);
          else if (!/^[a-z0-9]{8,64}$/.test(g[4] || "") || g.length < 6 || g.slice(5).some((x) => !x)) e.push("пътят трябва да е projects/<проект>/private/imports/<import_id>/<файл>: " + f.path);
          else if (imp && imp !== g[4]) e.push("файловете са от различни импорти (" + imp + " / " + g[4] + ")");
          else imp = g[4];
        }
      }
      return e;
    }),
    output: "{ ok, job_id, import_id, state:'queued'|…, idempotent, created, correlation_id }", errors: [400, 403, 404, 409, 503],
    idem: "idempotency_key = 'import:' + project_id + ':' + actor + ':' + sha256(сортиран списък име|размер|sha256) [+ ':r<n>' при rerun или след failed/cancelled] → повтор връща същия job_id; ключът се пази в nd_jobs.idempotency_key"
  },
  "imports.apply": {
    role: "staff – само авторът на импорта или admin (публикуван проект: само admin; заявки към TASK-009: само admin)",
    description: "Записва ПРЕГЛЕДАНАТА от човек чернова от импорта (сгради, етажи, обекти, връзки към планове, полета на проекта) в проекта – в една транзакция, под правата на служителя. Изисква изрично потвърждение (confirm:true). use_proposed:true = приема предложенията без промяна (отказва при нерешени конфликти или липсващи задължителни данни); иначе accept = прегледаната чернова от CRM. Статусът НЕ се внася (новите обекти са Свободни), обща цена не се приема освен като ръчна (price_override + причина), нищо не се публикува. Повтор върху вече записан импорт връща същия резултат.",
    input: schema({ job_id: S("uuid", { required: true }), confirm, use_proposed: S("boolean"), accept: S("object", { fields: {
      project: S("object", { fields: importProjectFields }),
      buildings: S("array", { max: 50, items: { ref: S("string", { required: true, pattern: REF, max: 40 }), name: S("string", { required: true, min: 1, max: 120 }), sort: S("int", { min: 0, max: 999 }) } }),
      floors: S("array", { max: 400, items: { ref: S("string", { required: true, pattern: REF, max: 40 }), building_ref: S("string", { required: true, pattern: REF, max: 40 }), level: S("int", { required: true, min: -5, max: 200 }), label: S("string", { max: 60 }), plan_file_id: S("string", { pattern: FILE_ID }) } }),
      units: S("array", { max: 3000, items: importUnitFields }),
      resolved: S("array", { max: 5000, items: S("string", { pattern: /^c\d{1,6}$/ }) }),
      downstream: S("array", { max: 200, items: S("string", { pattern: FILE_ID }) })
    } }) }, (d) => {
      const e = [];
      if (!d.use_proposed && !d.accept) e.push("подай accept (прегледаната чернова) или use_proposed:true");
      if (d.use_proposed && d.accept && (d.accept.units || d.accept.buildings || d.accept.floors || d.accept.project)) e.push("use_proposed и accept с данни не се подават заедно");
      for (const u of (d.accept && d.accept.units) || []) {
        if (u.price_override && (u.price_total == null || !u.price_override_reason)) e.push(u.ref + ": ръчна цена изисква price_total и причина");
        if (!u.price_override && u.price_total != null) e.push(u.ref + ": обща цена се смята от системата; ръчна цена – само с price_override:true и причина");
        if (u.area_net != null && u.area_total != null && u.area_net > u.area_total) e.push(u.ref + ": чистата площ не може да е по-голяма от общата");
      }
      return e;
    }),
    output: "{ ok, project_id, state:'succeeded', created:{ buildings, floors, units }, updated:{ units, floors, project }, downstream[], replayed, published:false, correlation_id }", errors: [400, 403, 404, 409, 503],
    idem: "задачата преминава review → done в СЪЩАТА транзакция (nd_import_apply); повтор върху done връща същата разписка; версия на проекта (content_rev) и на всеки обновяван обект → NC409 при чужда промяна"
  },
  "jobs.status": { role: "staff", description: "Състояние и реален напредък на задача (фаза, файлове n/N, байтове). Вход: {id*}. Отговаря веднага; за импорт придвижва обработката с едно парче (във фонов режим, ако средата позволява) – безопасно при повтор. Тежките задачи (TASK-009/010) показват „чака изпълнител“, докато няма такъв.", input: schema({ id: S("uuid", { required: true }) }), output: "{ id, kind, status, state, progress:{ phase, phase_bg, files_done, files_total, bytes_done, bytes_total }, attempts, error_code, error, retryable, retry_at, waiting_for_worker, requires_review, correlation_id }", errors: [400, 404], idem: "безопасен повтор (може да придвижи лека задача с едно парче)" },
  "jobs.result": { role: "staff", description: "Резултат от задача. За импорт: черновата за преглед – предложени сгради/етажи/обекти с източник (файл · лист · клетка) по поле, конфликти, липси, предупреждения, изведени стойности, файлове с вид/предназначение/увереност/възможности. view=summary (по подразбиране, кратко – за агента) или full (с offset/limit по обекти – за CRM). Без пътища към оригиналните файлове.", input: schema({ id: S("uuid", { required: true }), view: S("string", { enum: ["summary", "full"], default: "summary" }), offset: S("int", { min: 0, max: 100000 }), limit: S("int", { min: 1, max: 1000 }) }), output: "{ id, kind, status, state, result }", errors: [400, 404, 409, 503], idem: "само четене" },
  "jobs.cancel": { role: "staff (автор или admin; системна задача – само admin)", description: "Отменя задача: чакаща или чакаща преглед – веднага; работеща – спира след текущото парче. Нищо не се записва в проекта. Вход: {id*}.", input: schema({ id: S("uuid", { required: true }) }), output: "{ id, status, state, changed, cancel_requested }", errors: [400, 403, 404], idem: "повтор върху приключила задача не променя нищо" },
  "cad.inspect": {
    role: "admin", description: "Проверява CAD/BIM/PDF файл: формат, единици, слоеве, етажи – без конверсия. Тежка задача (външен изпълнител), бюджетът е по вид в nd_job_kinds. Вход: {project_id*, path*}. Връща job_id. (TASK-009)",
    input: schema({ project_id: id({ required: true }), path: S("string", { required: true, pattern: PRIVATE_PATH, noDotDot: true, max: 400 }) }, (d) => (pathInProject(d.path, d.project_id) ? [] : ["файлът е от друг проект"])), output: "{ job_id }", errors: [400, 403, 404], idem: "idempotency_key = 'cad_inspect:' + path + ':' + sha256"
  },
  "models.request": {
    role: "admin", description: "Стартира конверсия на проверен CAD/BIM файл към 3D модел за браузър (cad_convert, външен изпълнител). Вход: {project_id*, building_id*, path*}. Връща job_id; резултатът чака човешки преглед. (TASK-009)",
    input: schema({ project_id: id({ required: true }), building_id: id({ required: true }), path: S("string", { required: true, pattern: PRIVATE_PATH, noDotDot: true, max: 400 }) }, (d) => (pathInProject(d.path, d.project_id) ? [] : ["файлът е от друг проект"])),
    output: "{ job_id }", errors: [400, 403, 404], idem: "idempotency_key = 'cad_convert:' + building_id + ':' + sha256 на файла"
  },
  "models.publish": {
    role: "admin", description: "Прави проверен 3D модел публичен за сграда (след човешко одобрение). (TASK-009)",
    input: schema({ job_id: S("uuid", { required: true }), building_id: id({ required: true }), confirm }), output: "{ building_id, model_public }", errors: [400, 403, 404, 409], idem: "job_id"
  },
  "tours.request": {
    role: "admin", description: "Заявява интериор/разходка за обект: mode pano (360° панорами) или scene (свободна 3D сцена). Тежка задача с бюджет по вид. Вход: {unit_id*, mode*, style, rooms[]}. Връща job_id. (TASK-010)",
    input: schema({ unit_id: id({ required: true }), mode: S("string", { required: true, enum: ["pano", "scene"] }), style: S("string", { max: 80 }), rooms: S("array", { max: 30, items: S("string", { max: 60 }) }) }),
    output: "{ job_id }", errors: [400, 403, 404, 409], idem: "idempotency_key = 'tour:' + unit_id + ':' + mode + ':' + версия на входа"
  }
};

function validate(tool, input) {
  const c = CONTRACTS[tool];
  if (!c) return { success: false, error: { issues: [{ path: [], message: "unknown tool" }] } };
  return c.input.safeParse(input); // refine е вътре в safeParse (C1)
}

// SQLSTATE от базата → HTTP статус на /api/tools (ToolError(message, status))
// Конфликт на версии е NC409, НЕ 40001: PostgREST сам повтаря транзакции с 40001 (serialization_failure) и заявката увисва.
const SQLSTATE_HTTP = { "42501": 403, "P0002": 404, "NC409": 409, "40001": 409, "23505": 409, "23001": 409, "22023": 400, "23514": 400, "23503": 409, "22P02": 400 };

module.exports = { CONTRACTS, validate, schema, S, STATUSES, STATUS_BG, SQLSTATE_HTTP, pathInProject, FORBIDDEN_KEYS, patterns: { UUID, ID, SLUG, UNIT_CODE, PRIVATE_PATH, IMPORT_PATH, PUBLIC_PATH, TOUR_PATH, REF, FILE_ID } };
