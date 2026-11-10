// ИМОТИ НАДЕЖДА · Ново строителство · импорт на проектен пакет (TASK-006) – двигател на парчета.
// Фази: проверка на файла (размер, сигнатура, разширение) → SHA-256 + дубликати → неизменим източник в storage →
// класификация (увереност + доказателства) → извличане → нормализиране → конфликти/липси → произход → преглед/разлика.
// Резултатът е ЧЕРНОВА за човешки преглед. Нищо не се записва в проекта и нищо не се публикува оттук.
// Всичкият вход/изход (storage, база, AI) е подаден отвън (io) → двигателят се изпитва изцяло без мрежа.
"use strict";
const crypto = require("crypto");
const Z = require("./_nc-import-zip.js");
const S = require("./_nc-import-sheet.js");
const D = require("./_nc-import-detect.js");
const N = require("./_nc-import-norm.js");

const ENGINE_VERSION = "nc-import/1";
const MB = 1048576;
const LIMITS = Object.freeze({ fileBytes: 40 * MB, files: 2000, manifest: 5000, chunkMs: 18000, marginMs: 2500, aiMax: 6, aiBytes: 3 * MB, previewUnits: 3000 });
const PHASE_BG = { files: "Проверка, класификация и извличане на файловете", ai: "AI предложения за неразпознати файлове", analyze: "Нормализиране, конфликти и разлика", done: "Готово за преглед" };
const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
const safeName = (n) => (String(n || "file").split("/").pop().normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^[._]+/, "").slice(-80) || "file");
const PLAN_TYPES = new Set(["pdf", "jpeg", "png"]);

/* ---------- състояние ---------- */
function initState(job, list) {
  return {
    v: 1, engine: ENGINE_VERSION, job_id: job.id, import_id: list.import_id, project_id: list.project_id, created_at: list.created_at || null,
    phase: "files", qi: 0,
    queue: list.items.map((x) => ({ k: x.path.startsWith("ted-chat/") ? "ted" : "up", path: x.path, name: x.name, size: x.size || null, sha: x.sha256 || null })),
    files: [], hashes: {}, ai_queue: [], ai_i: 0, bytes_done: 0, bytes_total: list.items.reduce((s, x) => s + (x.size || 0), 0), warnings: [], options: { ai: list.ai !== false }
  };
}
function progressOf(st) {
  return { phase: st.phase, phase_bg: PHASE_BG[st.phase], step: st.phase === "files" ? st.qi : st.phase === "ai" ? st.ai_i : st.queue.length, total: st.phase === "ai" ? st.ai_queue.length : st.queue.length,
    files_done: st.qi, files_total: st.queue.length, bytes_done: st.bytes_done, bytes_total: st.bytes_total, engine: ENGINE_VERSION };
}

/* ---------- един файл ---------- */
function fileEntry(st, item, extra) {
  const fid = "f" + (st.files.length + 1);
  return Object.assign({ file_id: fid, source_name: String(item.name || "").slice(0, 300), safe_name: safeName(item.name), size_bytes: 0, sha256: null, mime: null, detected_type: null,
    type_bg: null, ext: D.extOf(item.name), status: "ok", issues: [], evidence: [], capabilities: [], purpose: "unknown", purpose_bg: D.PURPOSE_BG.unknown, confidence: null,
    stored_at: null, _path: null }, extra || {});
}
async function processItem(st, item, io, mem) {
  const e = fileEntry(st, item, item.k === "zip" ? { from_zip: item.zip, zip_path: item.zpath } : {});
  st.files.push(e);
  if (st.files.length > LIMITS.manifest) { e.status = "rejected"; e.issues.push({ code: "INVALID_PACKAGE", message: "Твърде много файлове в пакета (над " + LIMITS.manifest + ")" }); return; }
  let buf = null;
  if (item.k === "zipmeta") { Object.assign(e, { status: "rejected", size_bytes: item.usize || 0 }); e.issues.push({ code: item.code, message: item.message }); return; }
  if (item.k === "zip") {
    if (!mem.zip || mem.zip.fid !== item.zip) {
      const z = st.files.find((f) => f.file_id === item.zip);
      const r = z && z._path ? await io.download(z._path, LIMITS.fileBytes) : null;
      if (!r || !r.ok || sha256(r.buf) !== z.sha256) { e.status = "rejected"; e.issues.push({ code: "STORAGE_FAILED", message: "Архивът не се прочете повторно (или е променен след качването)", retryable: true }); return; }
      mem.zip = { fid: item.zip, buf: r.buf, list: Z.listZip(r.buf) };
    }
    const ent = mem.zip.list.entries.find((x) => x.index === item.index);
    const r = ent ? Z.extractEntry(mem.zip.buf, ent, LIMITS.fileBytes) : { ok: false, code: "corrupt", message: "Липсва запис" };
    if (!r.ok) { e.status = "rejected"; e.size_bytes = item.usize || 0; e.issues.push({ code: r.code === "bomb_size" ? "ARCHIVE_UNSAFE" : r.code === "too_large" ? "FILE_TOO_LARGE" : "INVALID_PACKAGE", message: r.message }); return; }
    buf = r.buf;
  } else {
    const r = await io.download(item.path, LIMITS.fileBytes);
    if (!r || !r.ok) {
      e.status = "rejected";
      e.issues.push(r && r.code === "too_large" ? { code: "FILE_TOO_LARGE", message: "Файлът е над " + LIMITS.fileBytes / MB + " MB" } : r && r.code === "not_found" ? { code: "INVALID_PACKAGE", message: "Файлът не е намерен в хранилището (качването не е завършило?)" } : { code: "STORAGE_FAILED", message: "Файлът не се прочете от хранилището", retryable: true });
      if (r && r.code === "failed") throw Object.assign(new Error("storage read failed"), { retryable: true, code: "STORAGE_FAILED" });
      return;
    }
    buf = r.buf; e._path = item.path;
  }
  e.size_bytes = buf.length; st.bytes_done += buf.length;
  if (buf.length > LIMITS.fileBytes) { e.status = "rejected"; e.issues.push({ code: "FILE_TOO_LARGE", message: "Файлът е над " + LIMITS.fileBytes / MB + " MB" }); return; }
  e.sha256 = sha256(buf);
  if (item.sha && item.sha !== e.sha256) { e.status = "rejected"; e.issues.push({ code: "INVALID_PACKAGE", message: "Съдържанието в хранилището се различава от избрания файл (SHA-256) – не се обработва" }); return; }
  const det = D.sniff(buf, item.k === "zip" ? item.zpath : item.name);
  Object.assign(e, { detected_type: det.type, type_bg: det.type_bg, mime: det.mime, evidence: det.evidence.slice(), capabilities: det.rejected ? [] : (D.CAPS[det.type] || ["store"]).slice() });
  if (item.k === "zip" && Z.IGNORED.test(item.zpath)) { e.status = "ignored"; e.capabilities = []; e.issues.push({ code: "IGNORED", message: "Системен файл – пропуснат" }); return; }
  if (det.rejected) { e.status = "rejected"; e.issues.push({ code: "FILE_UNSUPPORTED", message: det.reason }); if (item.k === "up" || item.k === "ted") e.quarantined = true; return; }
  // дубликати по съдържание: в този пакет и в предишни импорти на проекта
  if (st.hashes[e.sha256]) { e.status = "duplicate"; e.duplicate_of = st.hashes[e.sha256]; e.purpose_bg = "Дубликат на " + st.hashes[e.sha256]; e.capabilities = ["store"]; e.issues.push({ code: "DUPLICATE_IMPORT", message: "Същото съдържание като " + st.hashes[e.sha256] + " – обработва се веднъж" }); return; }
  st.hashes[e.sha256] = e.file_id;
  const prev = mem.prev && mem.prev[e.sha256];
  if (prev) { e.previously_imported = prev; e.issues.push({ code: "DUPLICATE_IMPORT", message: "Този файл (SHA-256) вече е внесен в предишен импорт на проекта (" + prev + ")", info: true }); }
  // неизменим източник: файловете от архив и от чата на Тед се записват под projects/<id>/private/imports/<import>/ (сървърът)
  if (item.k === "zip" || item.k === "ted") {
    const base = "projects/" + st.project_id + "/private/imports/" + st.import_id + "/" + (item.k === "zip" ? "_zip/" + item.zip + "/" : "_ted/");
    const p = base + String(st.files.length).padStart(4, "0") + "-" + e.sha256.slice(0, 8) + "-" + e.safe_name;
    if (!(await io.upload(p, buf, det.mime))) throw Object.assign(new Error("storage write failed"), { retryable: true, code: "STORAGE_FAILED" });
    e._path = p;
  }
  e.stored_at = io.nowIso();
  if (det.unsupported) { e.status = "stored_only"; e.issues.push({ code: "FILE_UNSUPPORTED", message: det.reason, info: true }); }
  await inspect(st, e, buf, det, io, mem);
}

async function inspect(st, e, buf, det, io, mem) {
  const t = det.type, extra = {};
  if (t === "zip") {
    if (e.from_zip) { e.status = "stored_only"; e.issues.push({ code: "ARCHIVE_UNSAFE", message: "Вложен архив – не се разархивира (лимит на вложеност 1)", info: true }); Object.assign(e, D.classify(e.source_name, det, extra)); return; }
    const z = Z.listZip(buf);
    e.archive = { entries: z.entries.filter((x) => !x.dir).length, unsafe: !!z.unsafe, encrypted: !!z.encrypted, corrupt: !!z.corrupt };
    if (!z.ok) {
      e.status = "rejected";
      e.issues.push({ code: z.corrupt ? "INVALID_PACKAGE" : "ARCHIVE_UNSAFE", message: (z.encrypted ? "Архивът е защитен с парола – не се разархивира. " : "") + z.issues.map((x) => x.message + (x.name ? " (" + x.name + ")" : "")).join("; ") });
      return;
    }
    z.issues.filter((x) => x.code === "method").forEach((x) => e.issues.push({ code: "FILE_UNSUPPORTED", message: x.message + " – " + x.name, info: true }));
    let added = 0;
    for (const ent of z.entries) {
      if (ent.dir) continue;
      const name = e.source_name.replace(/\.zip$/i, "") + "/" + ent.path;
      if (ent.ignored) { e.ignored = (e.ignored || 0) + 1; continue; }
      if (ent.too_large || ent.unsupported) { st.queue.push({ k: "zipmeta", name, usize: ent.usize, code: ent.too_large ? "FILE_TOO_LARGE" : "FILE_UNSUPPORTED", message: ent.too_large ? "Файлът в архива е над 40 MB" : "Неподдържан метод на компресия" }); added++; continue; }
      st.queue.push({ k: "zip", zip: e.file_id, index: ent.index, zpath: ent.path, name, usize: ent.usize }); added++;
      st.bytes_total += ent.usize;
    }
    e.archive.expanded = added;
    e.evidence.push("архивът е безопасен: " + added + " файла за обработка");
    Object.assign(e, D.classify(e.source_name, det, extra), { purpose: "unknown", purpose_bg: "Архив (разархивиран)", confidence: 1 });
    return;
  }
  if (t === "xlsx" || t === "ods" || t === "csv") {
    const r = t === "xlsx" ? S.readXlsx(buf) : t === "ods" ? S.readOds(buf) : S.readCsv(buf, e.source_name);
    (r.issues || []).forEach((x) => e.issues.push({ code: x.code === "corrupt" ? "EXTRACT_FAILED" : "INFO", message: x.message, info: x.code !== "corrupt" }));
    if (!r.ok) { e.status = "rejected"; if (r.unsafe) e.issues.push({ code: "ARCHIVE_UNSAFE", message: "Таблицата е опасен/повреден ZIP" }); return; }
    const sheets = [];
    let units = 0, fields = 0, project = false;
    for (const sh of r.sheets) {
      const u = N.tableToUnits(sh);
      if (u.kind === "units") { units += u.rows.length; fields = Math.max(fields, u.header.fields); sheets.push({ name: sh.name, kind: "units", header: { row: u.header.row, columns: Object.values(u.header.map).map((x) => ({ ref: x.ref, header: x.header, field: x.field })), extra: u.header.extra }, rows: u.rows }); }
      else if (u.kind === "project") { project = true; sheets.push({ name: sh.name, kind: "project", project: u.project }); }
    }
    e.sheet = { sheets: r.sheets.length, unit_rows: units, recognized: sheets.map((x) => x.name + " (" + (x.kind === "units" ? x.rows.length + " реда" : "данни за проекта") + ")") };
    if (r.encoding) e.sheet.encoding = r.encoding;
    if (sheets.length) await io.writeJson("x-" + e.file_id + ".json", { file_id: e.file_id, sheets });
    e.has_extract = !!sheets.length;
    Object.assign(e, D.classify(e.source_name, det, { sheet: { units, fields, project } }));
    if (!sheets.length) e.issues.push({ code: "INFO", message: "Не е намерен заглавен ред с обекти (нужни са поне „Обект/Апартамент/Код“ и „Етаж“ или „Площ“ или „Цена на кв.м“)", info: true });
    return;
  }
  if (t === "pdf") {
    const p = D.pdfInfo(buf);
    e.pdf = { pages: p.pages, kind: p.kind, kind_bg: { vector: "векторен", scan: "сканиран", mixed: "смесен", encrypted: "криптиран", unknown: "неопределен" }[p.kind], confidence: p.confidence, text_chars: p.text_sample.length, images: p.images, evidence: p.evidence };
    if (p.kind === "encrypted") { e.status = "stored_only"; e.capabilities = ["store"]; e.issues.push({ code: "FILE_UNSUPPORTED", message: "Криптиран PDF – само се пази", info: true }); }
    else if (p.kind === "scan") { e.capabilities = ["store", "inspect"]; e.issues.push({ code: "INFO", message: "Сканиран PDF – текст не се извлича (OCR не е наличен детерминистично); при нужда – AI предложение, само за преглед", info: true }); }
    extra.pdf = p;
  } else if (["jpeg", "png", "webp", "avif", "heic", "gif"].includes(t)) {
    const im = D.imageInfo(buf, t);
    e.image = { w: im.w || null, h: im.h || null, exif: !!im.exif };
    if (im.exif) e.evidence.push("EXIF има, но не се ползва за факти");
  } else if (t === "dxf") { e.cad = Object.assign({ format: "DXF" }, D.dxfInfo(buf)); e.downstream = "TASK-009"; }
  else if (t === "dwg") { e.cad = { format: "DWG", version: buf.slice(0, 6).toString("latin1"), release: D.DWG_VER[buf.slice(0, 6).toString("latin1")] || null, note: "DWG не се разчита тук (лиценз/формат) – само версия; конверсия в TASK-009" }; e.downstream = "TASK-009"; }
  else if (t === "ifc") { e.cad = Object.assign({ format: "IFC" }, D.ifcInfo(buf)); e.downstream = "TASK-009"; }
  else if (t === "glb") { e.model = D.glbInfo(buf); e.downstream = "TASK-009"; if (!e.model.valid) e.issues.push({ code: "EXTRACT_FAILED", message: "GLB не минава основната проверка: " + e.model.issues.join("; "), info: true }); }
  else if (t === "gltf") {
    let j = null; try { j = JSON.parse(buf.toString("utf8")); } catch (x) { j = null; }
    e.model = j ? D.gltfJson(j) : { issues: ["невалиден JSON"] }; e.downstream = "TASK-009";
    mem.gltf = (mem.gltf || []).concat([e.file_id]);
  } else if (t === "json") {
    const pj = D.projectJson(buf);
    if (pj && pj.ok) {
      extra.project_json = true;
      await io.writeJson("x-" + e.file_id + ".json", { file_id: e.file_id, project: pj.fields });
      e.has_extract = true;
      if (pj.forbidden.length) e.issues.push({ code: "INFO", message: "Полета, които модулът не пази, са пропуснати: " + pj.forbidden.join(", "), info: true });
      if (pj.ignored.length) e.issues.push({ code: "INFO", message: "Непознати/невалидни полета – пропуснати: " + pj.ignored.slice(0, 10).join(", "), info: true });
    } else if (pj && pj.reason) e.issues.push({ code: "INFO", message: pj.reason, info: true });
  }
  Object.assign(e, D.classify(e.source_name, det, extra));
  if (e.purpose === "unknown" && e.status === "ok" && ["jpeg", "png", "webp", "pdf"].includes(t) && e.size_bytes <= LIMITS.aiBytes && st.ai_queue.length < LIMITS.aiMax) st.ai_queue.push(e.file_id);
}

/* ---------- парче работа ----------
   → { status: 'yield' | 'review' | 'stopped', progress, preview?, summary? }; хвърля грешка с retryable при временен проблем */
async function runChunk(job, io, opts) {
  opts = opts || {};
  const t0 = io.now(), budget = opts.budgetMs || LIMITS.chunkMs, left = () => budget - (io.now() - t0);
  let st = await io.readJson("state.json");
  if (!st) {
    const list = await io.readList();
    if (!list || !Array.isArray(list.items) || !list.items.length) throw Object.assign(new Error("Списъкът с файлове на импорта липсва"), { code: "STORAGE_FAILED", retryable: true });
    st = initState(job, list);
  }
  const mem = { prev: await io.previousHashes() };
  let lastBeat = io.now();
  const beat = async () => { if (io.now() - lastBeat < 8000) return false; lastBeat = io.now(); return io.heartbeat(progressOf(st)); };
  while (left() > LIMITS.marginMs) {
    if (st.phase === "files") {
      if (st.qi >= st.queue.length) { st.phase = st.options.ai && st.ai_queue.length && io.ai ? "ai" : "analyze"; continue; }
      const item = st.queue[st.qi];
      const est = item.size || item.usize || 0;
      if (st.qi > 0 && est > 8 * MB && left() < 9000) break;            // голям файл → в следващото парче
      await processItem(st, item, io, mem);
      st.qi++;
      if (await beat()) return { status: "stopped", progress: progressOf(st) };
      continue;
    }
    if (st.phase === "ai") {
      if (st.ai_i >= st.ai_queue.length) { st.phase = "analyze"; continue; }
      if (left() < 16000) break;
      const e = st.files.find((f) => f.file_id === st.ai_queue[st.ai_i]);
      st.ai_i++;
      if (!e || !e._path) continue;
      try {
        const r = await io.download(e._path, LIMITS.aiBytes);
        const s = r && r.ok && sha256(r.buf) === e.sha256 ? await io.ai(e, r.buf) : null;
        e.ai_suggestion = s ? Object.assign({ suggestion_only: true }, s) : { skipped: true, reason: "AI не върна предложение" };
      } catch (x) { e.ai_suggestion = { skipped: true, reason: "AI не е наличен" }; }
      continue;
    }
    if (st.phase === "analyze") {
      const snap = await io.snapshot();
      const extracts = {};
      for (const f of st.files) if (f.has_extract && f.status === "ok") extracts[f.file_id] = await io.readJson("x-" + f.file_id + ".json");
      const preview = buildPreview(st, extracts, snap, mem.prev);
      await io.writeJson("paths.json", st.files.reduce((o, f) => { if (f._path && f.status === "ok") o[f.file_id] = { path: f._path, sha256: f.sha256, type: f.detected_type }; return o; }, {}));
      await io.writeJson("preview.json", preview);
      st.phase = "done";
      await io.writeJson("state.json", st);
      return { status: "review", progress: progressOf(st), preview, summary: summaryOf(preview) };
    }
    break;
  }
  await io.writeJson("state.json", st);
  return { status: "yield", progress: progressOf(st) };
}

/* ---------- анализ: от извлечените редове към чернова за преглед ---------- */
const UNIT_FIELDS = ["area_total", "area_net", "terrace_area", "price_per_m2", "rooms", "beds", "baths", "exposure"];
const FIELD_BG = { code: "Код", building: "Сграда/вход", floor: "Етаж", area_total: "Обща площ", area_net: "Чиста площ", terrace_area: "Тераса", price_per_m2: "Цена на кв.м", rooms: "Стаи", beds: "Спални", baths: "Бани", exposure: "Изложение",
  title: "Име", city: "Град", hood: "Квартал", address: "Адрес", description: "Описание", stage: "Етап", expected_completion: "Очаквано завършване", advantages: "Предимства", stage_percent: "Готовност %" };
function srcOf(f, sheet, cell, row) { return { f: f.file_id, n: f.source_name.split("/").slice(-2).join("/"), s: sheet || null, c: cell || null, r: row || null }; }
const same = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 0.005 : String(a) === String(b));

function buildPreview(st, extracts, snap, prevMap) {
  const files = st.files, byId = {}; files.forEach((f) => { byId[f.file_id] = f; });
  const conflicts = [], missing = [], warnings = [], derived = {};
  let cid = 0; const C = (o) => { const c = Object.assign({ conflict_id: "c" + ++cid, status: "unresolved", resolution: null }, o); conflicts.push(c); return c.conflict_id; };
  const W = (code, message, extra) => warnings.push(Object.assign({ code, message }, extra || {}));
  const derive = (field, rule) => { const k = field + "|" + rule; derived[k] = derived[k] || { field, rule, version: N.RULES_VERSION, count: 0 }; derived[k].count++; };
  const projStatus = snap && snap.project ? snap.project.status : "draft";

  /* 1. редове от таблиците */
  const rows = [];
  for (const fid of Object.keys(extracts)) {
    const x = extracts[fid], f = byId[fid]; if (!x || !x.sheets) continue;
    for (const sh of x.sheets) {
      if (sh.kind !== "units") continue;
      const ex = sh.header.extra || {};
      (ex.forbidden || []).forEach((h) => W("FORBIDDEN_COLUMN", "Колона „" + h.header + "“ (" + f.source_name.split("/").pop() + " · " + sh.name + " · " + h.ref + ") не се внася – модулът не пази инвеститор/строител/изпълнител", { f: fid }));
      (ex.ambiguous || []).concat(ex.ignored || []).forEach((h) => W("COLUMN_NOT_IMPORTED", (h.note || "Колоната не се внася") + " (" + sh.name + " · " + h.ref + ")", { f: fid }));
      if ((ex.unknown || []).length) W("UNKNOWN_COLUMNS", "Непознати колони (не се внасят): " + ex.unknown.slice(0, 8).map((h) => "„" + h.header + "“").join(", ") + " – " + f.source_name.split("/").pop() + " · " + sh.name, { f: fid });
      const shBuilding = /^(вход|сграда|блок|секция|корпус)\s*\S{1,6}$/i.test(sh.name.trim()) ? sh.name.trim() : null;
      for (const r of sh.rows) {
        const cell = (k) => r.cells[k];
        const src = (k) => srcOf(f, sh.name, cell(k) ? cell(k).ref : null, r.row);
        const rec = { f, sheet: sh.name, row: r.row, fields: {}, notes: [] };
        const cc = cell("code"), pc = cc ? N.parseCode(cc.raw) : { code: null };
        if (!pc.code) { missing.push({ scope: "row", ref: f.source_name.split("/").pop() + " · " + sh.name + " · ред " + r.row, field: "code", message: pc.issue ? "Невалиден код: " + pc.issue : "Ред без код на обект – пропуснат", blocking: false }); continue; }
        rec.code = pc.code; rec.key = pc.key; rec.code_src = src("code");
        const put = (k, p, extra) => { if (p.value != null) rec.fields[k] = Object.assign({ v: p.value, src: src(k), raw: cell(k) ? cell(k).raw : null }, p.rule ? { rule: p.rule } : {}, extra || {}); if (p.rule) derive(k, p.rule); if (p.issue) rec.notes.push({ field: k, issue: p.issue, src: src(k), raw: cell(k) ? cell(k).raw : null }); };
        if (cell("building")) { const b = String(cell("building").raw).trim().slice(0, 120); if (b) rec.building = { v: b, src: src("building") }; }
        else if (shBuilding) { rec.building = { v: shBuilding, src: srcOf(f, sh.name, null, null), rule: "сграда от името на листа (" + N.RULES_VERSION + ")" }; derive("building", rec.building.rule); }
        if (cell("floor")) { const p = N.parseFloor(cell("floor").raw); if (p.value != null) rec.floor = { v: p.value, label: p.label || null, src: src("floor"), raw: cell("floor").raw }; if (p.rule) derive("floor", p.rule); if (p.issue) rec.notes.push({ field: "floor", issue: p.issue, src: src("floor"), raw: cell("floor").raw }); }
        for (const k of ["area_total", "area_net"]) if (cell(k)) put(k, N.parseNumber(cell(k).raw, "area", cell(k).t));
        if (cell("terrace_area")) { const raw = cell("terrace_area").raw; const p = String(raw).trim() === "0" || raw === 0 ? { value: 0 } : N.parseNumber(raw, "area", cell("terrace_area").t); put("terrace_area", p); }
        for (const k of ["rooms", "beds", "baths"]) if (cell(k)) put(k, N.parseNumber(cell(k).raw, "int", cell(k).t));
        if (!cell("rooms") && cell("type_src")) { const p = N.roomsFromType(cell("type_src").raw); if (p.value != null) { rec.fields.rooms = { v: p.value, src: src("type_src"), raw: cell("type_src").raw, rule: p.rule }; derive("rooms", p.rule); } }
        if (cell("exposure")) { const p = N.parseExposure(cell("exposure").raw); if (p.value != null) rec.fields.exposure = { v: p.value, src: src("exposure"), raw: cell("exposure").raw }; }
        const rowCur = r.currency ? (/eur|€|евро/i.test(r.currency.raw) ? "EUR" : /bgn|лв/i.test(r.currency.raw) ? "BGN" : "OTHER") : null;
        if (cell("price_per_m2")) {
          const p = N.parseNumber(cell("price_per_m2").raw, "money", cell("price_per_m2").t);
          if (p.value != null) {
            const cur = p.currency || cell("price_per_m2").header_currency || rowCur || "EUR";
            const e = N.toEur(p.value, cur === "OTHER" ? "USD" : cur);
            if (e.value != null) put("price_per_m2", { value: e.value, rule: e.rule || p.rule }, e.derived ? { derived: true, original: { value: p.value, currency: cur } } : {});
            else rec.notes.push({ field: "price_per_m2", issue: e.issue, src: src("price_per_m2"), raw: cell("price_per_m2").raw });
          } else if (p.issue) rec.notes.push({ field: "price_per_m2", issue: p.issue, src: src("price_per_m2"), raw: cell("price_per_m2").raw });
        }
        if (cell("price_total_src")) { const p = N.parseNumber(cell("price_total_src").raw, "total", cell("price_total_src").t); const cur = p.currency || cell("price_total_src").header_currency || rowCur || "EUR"; if (p.value != null) rec.total_src = { v: p.value, currency: cur, src: src("price_total_src"), raw: cell("price_total_src").raw, note: cell("price_total_src").note }; }
        if (cell("status_src")) { const s = N.STATUS_SRC(cell("status_src").raw); if (s && s !== "free") rec.status_src = { v: String(cell("status_src").raw).slice(0, 30), mapped: s, src: src("status_src") }; }
        rows.push(rec);
      }
    }
  }

  /* 2. групиране по ключ на кода; дубликати в един и същ лист; несъответствия между източници */
  const groups = new Map();
  rows.forEach((r) => { if (!groups.has(r.key)) groups.set(r.key, []); groups.get(r.key).push(r); });
  const units = [];
  let ui = 0;
  for (const [key, list] of groups) {
    const u = { ref: "u" + ++ui, key, code: list[0].code, code_sources: list.map((r) => r.code_src), action: "create", include: true, fields: {}, notes: [], conflicts: [] };
    const bySheet = {}; list.forEach((r) => { const k = r.f.file_id + "|" + r.sheet; (bySheet[k] = bySheet[k] || []).push(r); });
    const dupSheets = Object.values(bySheet).filter((a) => a.length > 1);
    if (dupSheets.length) {
      u.conflicts.push(C({ kind: "duplicate_unit_code", field: "code", unit_ref: u.ref, message: "Кодът „" + u.code + "“ се среща повече от веднъж в един и същ лист – изберете кой ред е верният", sources: dupSheets[0].map((r) => Object.assign({ value: r.code, row: r.row }, r.code_src)) }));
      u.include = false;
    }
    const codes = [...new Set(list.map((r) => r.code))];
    if (codes.length > 1) W("CODE_VARIANTS", "Обект „" + codes.join("“ / „") + "“ е записан по различен начин в източниците – използва се „" + u.code + "“", { unit: u.ref });
    const pick = (getter, field) => {
      const cand = []; list.forEach((r) => { const x = getter(r); if (x && x.v != null) cand.push(x); });
      const distinct = []; cand.forEach((x) => { if (!distinct.some((d) => same(d.v, x.v))) distinct.push(x); });
      const out = { value: null, candidates: cand.map((x) => ({ v: x.v, src: x.src, raw: x.raw == null ? null : x.raw })) };
      if (distinct.length === 1) { out.value = distinct[0].v; if (distinct[0].rule) out.rule = distinct[0].rule; if (distinct[0].label) out.label = distinct[0].label; if (distinct[0].derived) out.derived = true; if (distinct[0].original) out.original = distinct[0].original; }
      else if (distinct.length > 1 && !dupSheets.length) out.conflict = C({ kind: "field_mismatch", field, unit_ref: u.ref, message: (FIELD_BG[field] || field) + " на „" + u.code + "“ се различава в източниците", sources: cand.map((x) => Object.assign({ value: x.v }, x.src)) });
      if (out.conflict) u.conflicts.push(out.conflict);
      return out;
    };
    u.building = pick((r) => r.building, "building");
    u.floor = pick((r) => r.floor, "floor");
    UNIT_FIELDS.forEach((k) => { const p = pick((r) => r.fields[k], k); if (p.candidates.length) u.fields[k] = p; });
    list.forEach((r) => r.notes.forEach((n) => u.notes.push(n)));
    const at = u.fields.area_total, an = u.fields.area_net;
    if (at && an && at.value != null && an.value != null && an.value > at.value) {
      u.conflicts.push(C({ kind: "net_gt_total", field: "area_net", unit_ref: u.ref, message: "Чистата площ (" + an.value + ") е по-голяма от общата (" + at.value + ") при „" + u.code + "“ – нито една не се внася без решение",
        sources: [Object.assign({ value: at.value, field: "area_total" }, at.candidates[0].src), Object.assign({ value: an.value, field: "area_net" }, an.candidates[0].src)] }));
      at.blocked = true; an.blocked = true; at.value = null; an.value = null;
    }
    const tot = list.find((r) => r.total_src);
    if (tot) u.total_src = { value: tot.total_src.v, currency: tot.total_src.currency, src: tot.total_src.src, note: tot.total_src.note || null };
    const stat = list.find((r) => r.status_src);
    if (stat) { u.status_src = stat.status_src; W("STATUS_NOT_IMPORTED", "„" + u.code + "“: в източника пише „" + stat.status_src.v + "“ – статусът НЕ се внася; обектът се създава като Свободен (смяна само с units.set_status)", { unit: u.ref }); }
    if (!u.fields.price_per_m2 || u.fields.price_per_m2.value == null) {
      if (u.total_src && u.total_src.currency === "EUR") u.override_offer = { price_total: Math.round(u.total_src.value * 100) / 100, src: u.total_src.src, reason: "по импорт – обща цена от " + (u.total_src.src.n || "файла") + (u.total_src.src.c ? " · " + u.total_src.src.c : "") };
      const why = u.notes.find((n) => n.field === "price_per_m2");
      missing.push({ scope: "unit", ref: u.ref, code: u.code, field: "price_per_m2", blocking: false, message: (why ? "Невалидна цена на кв.м (" + why.issue + ")" : "Няма цена на кв.м") + (u.override_offer ? " – в източника има обща цена " + u.override_offer.price_total + " €; може да се приеме като РЪЧНА цена (с причина)" : "") });
    }
    if (!u.fields.area_total || u.fields.area_total.value == null) { const why = u.notes.find((n) => n.field === "area_total"); missing.push({ scope: "unit", ref: u.ref, code: u.code, field: "area_total", blocking: false, message: u.fields.area_total && u.fields.area_total.conflict ? "Обща площ – виж конфликта" : why ? "Невалидна обща площ (" + why.issue + ")" : "Няма обща площ" }); }
    units.push(u);
  }
  if (units.length > LIMITS.previewUnits) { W("LIMIT", "Пакетът има " + units.length + " обекта – в една чернова се приемат до " + LIMITS.previewUnits); units.slice(LIMITS.previewUnits).forEach((u) => { u.include = false; u.action = "excluded"; }); }

  /* 3. сгради и етажи; съвпадение със съществуващите в проекта */
  const exB = (snap && snap.buildings) || [], exF = (snap && snap.floors) || [], exU = (snap && snap.units) || [];
  const bkey = (s) => N.hnorm(s);
  const buildings = [], bByKey = {};
  const addB = (name, src) => {
    const k = name == null ? "" : bkey(name);
    if (bByKey[k]) return bByKey[k];
    const b = { ref: "b" + (buildings.length + 1), name: name, name_src: src || null, action: "create", id: null };
    const m = name != null ? exB.find((x) => bkey(x.name) === k) : (exB.length === 1 ? exB[0] : null);
    if (m) { b.action = "match"; b.id = m.id; b.name = m.name; if (name == null) b.evidence = "единствената сграда в проекта"; }
    else if (name == null) missing.push({ scope: "building", ref: b.ref, field: "name", blocking: true, message: exB.length > 1 ? "Източниците не посочват сграда, а проектът има " + exB.length + " – изберете/въведете сграда" : "Няма име на сграда/вход в източниците – въведете го" });
    buildings.push(b); bByKey[k] = b; return b;
  };
  const floors = [], fByKey = {};
  const addF = (b, level, label, src) => {
    const k = b.ref + "|" + level;
    if (fByKey[k]) { if (!fByKey[k].label && label) fByKey[k].label = label; return fByKey[k]; }
    const f = { ref: "f" + (floors.length + 1), building_ref: b.ref, level, label: label || null, src: src || null, action: "create", id: null };
    if (b.id) { const m = exF.find((x) => x.building_id === b.id && x.level === level); if (m) { f.action = "match"; f.id = m.id; f.label = m.label || f.label; f.updated_at = m.updated_at; f.has_plan = !!m.has_plan; } }
    floors.push(f); fByKey[k] = f; return f;
  };
  for (const u of units) {
    const bname = u.building.conflict ? null : u.building.value;
    const b = u.building.conflict ? null : addB(bname == null ? null : bname, u.building.candidates[0] ? u.building.candidates[0].src : null);
    u.building_ref = b ? b.ref : null;
    if (u.floor.value != null && b) { const fl = addF(b, u.floor.value, u.floor.label, u.floor.candidates[0].src); u.floor_ref = fl.ref; }
    else {
      u.floor_ref = null;
      if (!u.floor.conflict) missing.push({ scope: "unit", ref: u.ref, code: u.code, field: "floor", blocking: true, message: "Обект „" + u.code + "“ няма разпознат етаж" + (u.notes.find((n) => n.field === "floor") ? " (" + u.notes.find((n) => n.field === "floor").issue + ")" : "") + " – въведете етаж или изключете обекта" });
      u.include = false;
    }
    // съществуващ обект със същия ключ → обновяване (само променените полета) или „без промяна“
    const ex = exU.find((x) => N.codeKey(x.code) === u.key);
    if (ex) {
      u.id = ex.id; u.expected_version = ex.version; u.action = "update"; u.existing = { code: ex.code, floor_id: ex.floor_id, status: ex.status, has_plan: !!ex.has_plan, values: UNIT_FIELDS.reduce((o, k) => { o[k] = ex[k] == null ? null : ex[k]; return o; }, {}) };
      const diff = {};
      UNIT_FIELDS.forEach((k) => { const nv = u.fields[k] && u.fields[k].value; const ov = ex[k] == null ? null : ex[k]; if (nv != null && !same(nv, ov)) diff[k] = { old: ov, new: nv }; });
      u.diff = diff;
      const exFl = exF.find((x) => x.id === ex.floor_id);
      if (u.floor_ref) { const fl = floors.find((x) => x.ref === u.floor_ref); if (exFl && fl && (fl.id !== exFl.id)) { u.notes.push({ field: "floor", issue: "Обектът вече съществува на етаж " + exFl.level + " – етажът не се сменя от импорта" }); } }
      if (exFl) { const eb = buildings.find((x) => x.id === exFl.building_id) || addB(exB.find((x) => x.id === exFl.building_id) ? exB.find((x) => x.id === exFl.building_id).name : null, null); const ef = addF(eb, exFl.level, exFl.label, null); u.floor_ref = ef.ref; u.building_ref = eb.ref; }
      if (ex.status !== "free") u.notes.push({ field: "status", issue: "Обектът е „" + ({ reserved: "Капариран", sold: "Продаден" }[ex.status] || ex.status) + "“ – статусът не се пипа от импорта" });
      if (!Object.keys(diff).length) { u.action = "unchanged"; u.include = false; }
    }
    if (projStatus === "published") u.notes.push({ field: "project", issue: "Проектът е публикуван – обекти, площи и цени в него мени само администратор" });
  }
  // неизползвана сграда без име (напр. всички обекти са с конфликт) не се показва
  for (let i = buildings.length - 1; i >= 0; i--) if (!units.some((u) => u.building_ref === buildings[i].ref) && buildings[i].action === "create") { const r = buildings[i].ref; buildings.splice(i, 1); for (let k = missing.length - 1; k >= 0; k--) if (missing[k].ref === r) missing.splice(k, 1); }
  const notInPkg = exU.filter((x) => !units.some((u) => u.id === x.id)).map((x) => x.code);
  if (notInPkg.length) W("NOT_IN_PACKAGE", notInPkg.length + " съществуващи обекта ги няма в пакета – НЕ се трият: " + notInPkg.slice(0, 15).join(", ") + (notInPkg.length > 15 ? "…" : ""));

  /* 4. данни за проекта (JSON по схема и таблици „поле → стойност“) */
  const pc = {};
  for (const fid of Object.keys(extracts)) {
    const x = extracts[fid], f = byId[fid]; if (!x) continue;
    if (x.project) Object.keys(x.project).forEach((k) => { (pc[k] = pc[k] || []).push({ v: x.project[k], src: srcOf(f, null, "$." + k, null) }); });
    (x.sheets || []).filter((s) => s.kind === "project").forEach((s) => Object.keys(s.project).forEach((k) => {
      let v = s.project[k].value;
      if (k === "advantages") v = String(v).split(/[;\n•]+/).map((t) => t.trim().slice(0, 120)).filter(Boolean).slice(0, 20);
      (pc[k] = pc[k] || []).push({ v, src: srcOf(f, s.name, s.project[k].ref, null) });
    }));
  }
  const project = {};
  const cur = (snap && snap.project && snap.project.data) || {};
  for (const k of Object.keys(pc)) {
    let cand = pc[k];
    if (k === "stage") cand = cand.map((c) => { const p = N.parseStage(c.v); if (p.issue) W("PROJECT_FIELD", "Етап: " + p.issue); return Object.assign({}, c, { raw: c.v, v: p.value }); }).filter((c) => c.v != null);
    if (!cand.length) continue;
    const distinct = []; cand.forEach((c) => { if (!distinct.some((d) => JSON.stringify(d.v) === JSON.stringify(c.v))) distinct.push(c); });
    const pf = { value: null, candidates: cand, current: cur[k] == null ? null : cur[k] };
    if (distinct.length === 1) pf.value = distinct[0].v; else pf.conflict = C({ kind: "field_mismatch", field: k, unit_ref: null, scope: "project", message: (FIELD_BG[k] || k) + " на проекта се различава в източниците", sources: cand.map((c) => Object.assign({ value: c.v }, c.src)) });
    pf.changed = pf.value != null && JSON.stringify(pf.value) !== JSON.stringify(pf.current);
    pf.include = pf.changed && (pf.current == null || pf.current === "" || (Array.isArray(pf.current) && !pf.current.length));
    if (pf.changed && !pf.include) W("PROJECT_FIELD", (FIELD_BG[k] || k) + ": в пакета е различно от записаното в проекта – по подразбиране НЕ се презаписва (може да се избере в прегледа)");
    project[k] = pf;
  }

  /* 5. планове → предложения за връзка (само при точно съвпадение; иначе – за ръчно свързване) */
  const planFiles = files.filter((f) => f.status === "ok" && PLAN_TYPES.has(f.detected_type));
  const unitByKey = {}; units.forEach((u) => { unitByKey[u.key] = u; });
  const linkedUnit = {};
  for (const f of planFiles.filter((x) => x.purpose === "unit_plan")) {
    const base = f.source_name.split("/").pop().replace(/\.[a-z0-9]+$/i, "").replace(/^(план|plan|разпределение|layout|апартамент|ап|unit|обект)[\s._-]*/i, "");
    const k = N.codeKey(base), u = unitByKey[k];
    if (u) (linkedUnit[u.ref] = linkedUnit[u.ref] || []).push(f);
    else W("PLAN_UNLINKED", "План „" + f.source_name.split("/").pop() + "“ не е свързан с обект (името не съвпада точно с код) – свържете го ръчно по-късно", { f: f.file_id });
  }
  Object.keys(linkedUnit).forEach((ref) => {
    const u = units.find((x) => x.ref === ref), fs = linkedUnit[ref];
    if (fs.length > 1) { W("PLAN_AMBIGUOUS", "За „" + u.code + "“ има " + fs.length + " плана – нито един не е свързан автоматично", { unit: ref }); return; }
    u.plan = { file_id: fs[0].file_id, name: fs[0].source_name.split("/").pop(), type: fs[0].detected_type, confidence: 0.9, evidence: "името на файла съвпада точно с кода", include: true };
    if (fs[0].detected_type === "pdf") u.plan.note = "PDF план: в CRM се вижда, публичен план (с воден знак) – само от JPG/PNG";
  });
  for (const f of planFiles.filter((x) => x.purpose === "floor_plan")) {
    const nm = f.source_name.split("/").pop().replace(/\.[a-z0-9]+$/i, "").toLocaleLowerCase("bg");
    let lvl = null; const m = /(?:етаж|ет|etazh|etaj|floor|level|ниво)[\s._-]*(-?\d{1,3})(?!\d)/i.exec(nm) || /(?:^|[\s._-])(-?\d{1,3})[\s._-]*(?:ети|ет|етаж|floor)(?![a-zа-я])/i.exec(nm);
    if (m) lvl = parseInt(m[1], 10); else if (/партер|parter|ground/.test(nm)) lvl = 0; else if (/сутерен|suteren|basement/.test(nm)) lvl = -1;
    const cands = lvl == null ? [] : floors.filter((x) => x.level === lvl);
    if (cands.length === 1 && buildings.length === 1) {
      const fl = cands[0];
      if (fl.plan) { W("PLAN_AMBIGUOUS", "За етаж " + lvl + " има повече от един план – свързан е само първият", { f: f.file_id }); continue; }
      fl.plan = { file_id: f.file_id, name: f.source_name.split("/").pop(), type: f.detected_type, confidence: 0.75, evidence: "номер на етажа в името на файла", include: !fl.has_plan };
      if (fl.has_plan) W("PLAN_EXISTS", "Етаж " + lvl + " вече има план – новият НЕ го заменя по подразбиране", { f: f.file_id });
    } else W("PLAN_UNLINKED", "Етажен план „" + f.source_name.split("/").pop() + "“ не е свързан (" + (lvl == null ? "няма номер на етаж в името" : buildings.length > 1 ? "повече от една сграда" : "няма такъв етаж в черновата") + ")", { f: f.file_id });
  }

  /* 6. файлове за следващите задачи и общи бележки */
  const downstream = files.filter((f) => f.downstream && f.status === "ok").map((f) => ({ file_id: f.file_id, name: f.source_name.split("/").pop(), type: f.detected_type, task: f.downstream, capabilities: f.capabilities, note: "Пази се като източник; проверка/конверсия – TASK-009 (cad.inspect / models.request, само администратор)" }));
  const visuals = files.filter((f) => f.status === "ok" && f.purpose === "visualization").map((f) => ({ file_id: f.file_id, name: f.source_name.split("/").pop(), type: f.detected_type }));
  if (visuals.length) W("VISUALS_PRIVATE", visuals.length + " визуализации са запазени като частни файлове – публичната медия се задава отделно от администратор (projects.set_media)");
  files.filter((f) => f.ai_suggestion && !f.ai_suggestion.skipped).forEach((f) => W("AI_SUGGESTION", "AI предложение за „" + f.source_name.split("/").pop() + "“: " + (f.ai_suggestion.title || f.ai_suggestion.purpose_bg || "—") + " (увереност " + f.ai_suggestion.confidence + ") – само предложение, не е приложено", { f: f.file_id }));
  if (st.files.some((f) => f.quarantined)) W("QUARANTINE", "Има файлове в карантина (изпълними/скриптове/несъответствие) – не са обработени и не се свързват с нищо");

  const state = conflicts.some((c) => c.status === "unresolved") || missing.some((m) => m.blocking) ? "needs_input" : "needs_review";
  const fileView = files.map(publicFile);
  const counts = {
    files: files.length, ok: files.filter((f) => f.status === "ok").length, duplicate: files.filter((f) => f.status === "duplicate").length, rejected: files.filter((f) => f.status === "rejected").length,
    stored_only: files.filter((f) => f.status === "stored_only").length, ignored: files.filter((f) => f.status === "ignored").length,
    units: units.length, units_create: units.filter((u) => u.action === "create").length, units_update: units.filter((u) => u.action === "update").length, units_unchanged: units.filter((u) => u.action === "unchanged").length,
    units_included: units.filter((u) => u.include).length, buildings_new: buildings.filter((b) => b.action === "create").length, floors_new: floors.filter((f) => f.action === "create").length,
    conflicts: conflicts.length, missing: missing.length, missing_blocking: missing.filter((m) => m.blocking).length, warnings: warnings.length, plans_linked: units.filter((u) => u.plan).length + floors.filter((f) => f.plan).length
  };
  const importable = units.some((u) => u.action === "create" || u.action === "update") || Object.values(project).some((p) => p.changed);
  let error_code = null;
  if (!importable) error_code = files.some((f) => f.issues.some((i) => i.code === "ARCHIVE_UNSAFE")) ? "ARCHIVE_UNSAFE" : files.every((f) => f.status !== "ok") ? "INVALID_PACKAGE" : null;
  return {
    v: 1, engine: ENGINE_VERSION, rules: N.RULES_VERSION, job_id: st.job_id, import_id: st.import_id, project_id: st.project_id,
    base: { content_rev: snap && snap.project ? snap.project.content_rev : null, project_status: projStatus, project_version: snap && snap.project ? snap.project.version : null },
    state, requires_review: true, importable, error_code, counts,
    project, buildings, floors, units, conflicts, missing, warnings, derived: Object.values(derived), downstream, visuals,
    existing: { buildings: exB.map((b) => ({ id: b.id, name: b.name })), floors: exF.map((f) => ({ id: f.id, building_id: f.building_id, level: f.level, label: f.label || null, updated_at: f.updated_at, has_plan: !!f.has_plan })) },
    files: fileView,
    manifest: { import_id: st.import_id, job_id: st.job_id, engine: ENGINE_VERSION, source_hashes: files.filter((f) => f.sha256).map((f) => ({ file_id: f.file_id, sha256: f.sha256, size_bytes: f.size_bytes })), created_at: st.created_at },
    rules_applied: ["Статусът не се внася – всички нови обекти са Свободни", "Общата цена се смята от базата (площ × цена на кв.м); ръчна цена – само с price_override и причина", "Инвеститор/строител/изпълнител не се внасят", "Нищо не се публикува – резултатът е чернова"]
  };
}
/* изглед на файл без вътрешния път в storage (оригиналните пътища не излизат към клиента/агента) */
function publicFile(f) { const o = {}; Object.keys(f).forEach((k) => { if (k[0] !== "_") o[k] = f[k]; }); return o; }
function summaryOf(p) {
  return { import_id: p.import_id, state: p.state, importable: p.importable, error_code: p.error_code, counts: p.counts, source_hashes: p.manifest.source_hashes.map((h) => h.sha256) };
}

module.exports = { runChunk, buildPreview, initState, progressOf, summaryOf, publicFile, safeName, sha256, LIMITS, ENGINE_VERSION, PHASE_BG, FIELD_BG, UNIT_FIELDS };
