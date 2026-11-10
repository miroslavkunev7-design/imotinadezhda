// ИМОТИ НАДЕЖДА · импорт (TASK-006) · разпознаване на файл по СЪДЪРЖАНИЕ (сигнатура), не по разширение;
// честна карта на възможностите (store / inspect / extract / validate / downstream_cad / downstream_3d);
// основен преглед на PDF (вектор или сканиране), изображения (размери), DWG/DXF/IFC/GLB/glTF (без фалшива геометрия);
// класификация по предназначение с увереност и доказателства. Чисти функции, без мрежа.
"use strict";
const zlib = require("zlib");
const Z = require("./_nc-import-zip.js");

const EXT_OK = {
  pdf: ["pdf"], jpeg: ["jpg", "jpeg", "jpe"], png: ["png"], webp: ["webp"], avif: ["avif"], heic: ["heic", "heif"], gif: ["gif"],
  zip: ["zip"], xlsx: ["xlsx", "xlsm"], ods: ["ods"], docx: ["docx"], pptx: ["pptx"], odt: ["odt"], ole: ["xls", "doc", "ppt", "msg"],
  dwg: ["dwg"], dxf: ["dxf"], ifc: ["ifc"], glb: ["glb"], gltf: ["gltf"], json: ["json"], csv: ["csv", "tsv", "txt"], txt: ["txt", "md", "text", "rtf"],
  bin: ["bin"], rar: ["rar"], sevenz: ["7z"]
};
const MIME = { pdf: "application/pdf", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", heic: "image/heic", gif: "image/gif",
  zip: "application/zip", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ods: "application/vnd.oasis.opendocument.spreadsheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text", ole: "application/x-ole-storage", dwg: "image/vnd.dwg", dxf: "image/vnd.dxf", ifc: "application/x-step",
  glb: "model/gltf-binary", gltf: "model/gltf+json", json: "application/json", csv: "text/csv", txt: "text/plain", bin: "application/octet-stream",
  rar: "application/vnd.rar", sevenz: "application/x-7z-compressed", unknown: "application/octet-stream" };
/* какво реално прави TASK-006 с всеки вид (виж 07_FILE_FORMATS/CAPABILITY_MATRIX.csv) */
const CAPS = {
  pdf: ["store", "inspect", "extract"], jpeg: ["store", "inspect"], png: ["store", "inspect"], webp: ["store", "inspect"], avif: ["store", "inspect"],
  heic: ["store"], gif: ["store"], zip: ["store", "inspect", "validate"], xlsx: ["store", "inspect", "extract", "validate"], ods: ["store", "inspect", "extract", "validate"],
  csv: ["store", "inspect", "extract", "validate"], docx: ["store"], pptx: ["store"], odt: ["store"], ole: ["store"],
  dwg: ["store", "inspect", "downstream_cad"], dxf: ["store", "inspect", "downstream_cad"], ifc: ["store", "inspect", "downstream_cad", "downstream_3d"],
  glb: ["store", "inspect", "validate", "downstream_3d"], gltf: ["store", "inspect", "validate", "downstream_3d"], json: ["store", "validate"], txt: ["store"],
  bin: ["store"], rar: ["store"], sevenz: ["store"], unknown: ["store"]
};
const TYPE_BG = { pdf: "PDF", jpeg: "JPEG снимка", png: "PNG изображение", webp: "WebP изображение", avif: "AVIF изображение", heic: "HEIC снимка", gif: "GIF",
  zip: "ZIP архив", xlsx: "Excel таблица (XLSX)", ods: "Таблица (ODS)", csv: "CSV таблица", docx: "Word документ", pptx: "PowerPoint", odt: "Текстов документ (ODT)", ole: "Стар Office формат",
  dwg: "AutoCAD DWG", dxf: "AutoCAD DXF", ifc: "BIM модел (IFC)", glb: "3D модел (GLB)", gltf: "3D модел (glTF)", json: "JSON", txt: "Текст", bin: "Двоични данни (за glTF)",
  rar: "RAR архив", sevenz: "7z архив", exe: "Изпълним файл", script: "Скрипт", html: "HTML", svg: "SVG", unknown: "Непознат" };
const REJECT = new Set(["exe", "script", "html"]);
const DWG_VER = { AC1012: "R13", AC1014: "R14", AC1015: "2000", AC1018: "2004", AC1021: "2007", AC1024: "2010", AC1027: "2013", AC1032: "2018" };

const extOf = (name) => ((String(name || "").toLowerCase().match(/\.([a-z0-9]{1,6})$/) || [])[1] || "");
const ascii = (b, a, n) => b.slice(a, a + n).toString("latin1");
function looksText(b) {
  const n = Math.min(b.length, 8192); let bad = 0;
  for (let i = 0; i < n; i++) { const c = b[i]; if (c === 0) return false; if (c < 9 || (c > 13 && c < 32 && c !== 27)) bad++; }
  return bad <= n * 0.01;
}

/* → { type, mime, ext, ext_ok, evidence[], rejected?, reason? } */
function sniff(buf, name) {
  const ext = extOf(name), ev = [];
  let type = "unknown";
  if (!buf || !buf.length) return { type: "empty", mime: MIME.unknown, ext, ext_ok: false, evidence: ["празен файл"], rejected: true, reason: "Празен файл" };
  if (ascii(buf, 0, 5) === "%PDF-") { type = "pdf"; ev.push("сигнатура %PDF-"); }
  else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) { type = "jpeg"; ev.push("сигнатура JPEG (FF D8 FF)"); }
  else if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) { type = "png"; ev.push("сигнатура PNG"); }
  else if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 4) === "WEBP") { type = "webp"; ev.push("сигнатура RIFF/WEBP"); }
  else if (ascii(buf, 4, 4) === "ftyp") { const br = ascii(buf, 8, 4); type = /avi[fs]/.test(br) ? "avif" : /hei[cx]|mif1|msf1|hevc/.test(br) ? "heic" : "unknown"; ev.push("ISO BMFF марка " + br); }
  else if (/^GIF8[79]a/.test(ascii(buf, 0, 6))) { type = "gif"; ev.push("сигнатура GIF"); }
  else if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 3 || buf[2] === 5) && (buf[3] === 4 || buf[3] === 6)) {
    type = "zip"; ev.push("сигнатура ZIP (PK)");
    const z = Z.listZip(buf, { maxEntries: 5000, maxTotal: 1e12, maxRatio: 1e9 });
    const names = new Set((z.entries || []).map((e) => e.path));
    if (names.has("xl/workbook.xml")) { type = "xlsx"; ev.push("съдържа xl/workbook.xml"); }
    else if (names.has("word/document.xml")) { type = "docx"; ev.push("съдържа word/document.xml"); }
    else if ([...names].some((n) => n.startsWith("ppt/"))) { type = "pptx"; ev.push("съдържа ppt/"); }
    else if (names.has("mimetype") && names.has("content.xml")) {
      const me = z.entries.find((e) => e.path === "mimetype"); const r = me && Z.extractEntry(buf, me, 200);
      const mt = r && r.ok ? r.buf.toString("latin1") : "";
      if (/opendocument\.spreadsheet/.test(mt)) { type = "ods"; ev.push("mimetype " + mt); } else if (/opendocument\.text/.test(mt)) { type = "odt"; ev.push("mimetype " + mt); }
    }
  }
  else if (buf.length > 8 && buf.readUInt32BE(0) === 0xd0cf11e0 && buf.readUInt32BE(4) === 0xa1b11ae1) { type = "ole"; ev.push("сигнатура OLE (стар Office)"); }
  else if (/^AC10\d\d$/.test(ascii(buf, 0, 6))) { type = "dwg"; ev.push("сигнатура " + ascii(buf, 0, 6) + (DWG_VER[ascii(buf, 0, 6)] ? " (AutoCAD " + DWG_VER[ascii(buf, 0, 6)] + ")" : "")); }
  else if (ascii(buf, 0, 4) === "glTF") { type = "glb"; ev.push("сигнатура glTF (двоичен)"); }
  else if (ascii(buf, 0, 22) === "AutoCAD Binary DXF\r\n\x1a\0") { type = "dxf"; ev.push("двоичен DXF"); }
  else if (ascii(buf, 0, 2) === "MZ" || (buf[0] === 0x7f && ascii(buf, 1, 3) === "ELF") || buf.readUInt32BE(0) === 0xcafebabe || buf.readUInt32BE(0) === 0xfeedfacf) { type = "exe"; ev.push("изпълним файл"); }
  else if (buf[0] === 0x52 && ascii(buf, 0, 4) === "Rar!") { type = "rar"; ev.push("сигнатура RAR"); }
  else if (buf.length > 6 && buf.readUInt32BE(0) === 0x377abcaf && buf.readUInt16BE(4) === 0x271c) { type = "sevenz"; ev.push("сигнатура 7z"); }
  else if (looksText(buf)) {
    const head = buf.slice(0, 4096).toString("utf8").replace(/^﻿/, "");
    const t = head.trimStart();
    if (t.startsWith("ISO-10303-21;")) { type = "ifc"; ev.push("заглавие ISO-10303-21 (STEP/IFC)"); }
    else if (/^0\s*\r?\n\s*SECTION\b/.test(t) || /^\s*999\s*\r?\n/.test(t) && /\n\s*0\s*\r?\n\s*SECTION/.test(t)) { type = "dxf"; ev.push("текстов DXF (0/SECTION)"); }
    else if (/^#!/.test(t)) { type = "script"; ev.push("скрипт (#!)"); }
    else if (/^<!doctype html|^<html[\s>]/i.test(t) || /<script[\s>]/i.test(head)) { type = "html"; ev.push("HTML/скрипт"); }
    else if (/^<\?xml[\s\S]{0,200}<svg|^<svg[\s>]/i.test(t)) { type = "svg"; ev.push("SVG"); }
    else if (/^[{[]/.test(t)) {
      let j = null; try { j = buf.length <= 2 * 1048576 ? JSON.parse(buf.toString("utf8").replace(/^﻿/, "")) : null; } catch (e) { j = null; }
      if (j && typeof j === "object" && j.asset && typeof j.asset === "object" && j.asset.version) { type = "gltf"; ev.push("JSON с asset.version (glTF)"); }
      else if (j) { type = "json"; ev.push("валиден JSON"); } else { type = "txt"; ev.push("текст (невалиден JSON)"); }
    }
    else if (ext === "csv" || ext === "tsv") { type = "csv"; ev.push("текст с разширение ." + ext); }
    else { type = "txt"; ev.push("текст"); }
  }
  else if (ext === "bin") { type = "bin"; ev.push("двоични данни (.bin)"); }
  const allowed = EXT_OK[type] || [];
  let ext_ok = allowed.includes(ext);
  if (type === "txt" && ext === "csv") ext_ok = true;
  const out = { type, type_bg: TYPE_BG[type] || type, mime: MIME[type] || MIME.unknown, ext, ext_ok, evidence: ev };
  if (REJECT.has(type)) return Object.assign(out, { rejected: true, reason: "Изпълним файл, скрипт или HTML – не се приема (карантина)" });
  if (type === "svg") return Object.assign(out, { unsupported: true, reason: "SVG не се обработва (може да съдържа скрипт) – само се пази" });
  if (type === "unknown") return Object.assign(out, { unsupported: true, reason: "Непознат формат – само се пази, не се обработва" });
  if (!ext_ok) return Object.assign(out, { rejected: true, reason: "Разширението „." + (ext || "—") + "“ не съответства на съдържанието (" + (TYPE_BG[type] || type) + ") – файлът не се обработва" });
  return out;
}

/* ---------- преглед по вид ---------- */
function imageInfo(buf, type) {
  try {
    if (type === "png") return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (type === "gif") return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    if (type === "webp") {
      const f = ascii(buf, 12, 4);
      if (f === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
      if (f === "VP8L") { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
      if (f === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    }
    if (type === "jpeg") {
      let p = 2, exif = false;
      while (p + 9 < buf.length) {
        if (buf[p] !== 0xff) { p++; continue; }
        const m = buf[p + 1];
        if (m === 0xe1 && ascii(buf, p + 4, 4) === "Exif") exif = true;
        if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: buf.readUInt16BE(p + 7), h: buf.readUInt16BE(p + 5), exif };
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { p += 2; continue; }
        p += 2 + buf.readUInt16BE(p + 2);
      }
      return { exif };
    }
    if (type === "avif" || type === "heic") {
      const i = buf.indexOf("ispe", 0, "latin1");
      if (i > 0 && i + 16 <= buf.length) return { w: buf.readUInt32BE(i + 8), h: buf.readUInt32BE(i + 12) };
    }
  } catch (e) { /* нечетими размери */ }
  return {};
}

/* PDF: без изобразяване. Разархивира FlateDecode потоците (с таван), брои страници, текстови оператори,
   векторни пътища и картини → vector | scan | mixed, с увереност. Криптиран PDF → само се пази. */
function pdfInfo(buf) {
  const s = buf.toString("latin1");
  const out = { pages: 0, encrypted: /\/Encrypt\s*(<<|\d+\s+\d+\s+R)/.test(s.slice(-4096)) || /\/Encrypt\s/.test(s.slice(0, 2048)), text_ops: 0, path_ops: 0, images: 0, image_area: 0, text_sample: "", streams: 0, kind: null, confidence: 0, evidence: [] };
  if (out.encrypted) { out.kind = "encrypted"; out.evidence.push("PDF е защитен (криптиран) – не се анализира"); return out; }
  let inflated = 0; const texts = [];
  const scanContent = (c) => {
    out.text_ops += (c.match(/\bT[jJ]\b|'\s|"\s/g) || []).length;
    out.path_ops += (c.match(/(?:^|\s)(?:-?[\d.]+\s+){2}[ml](?=\s)|(?:^|\s)(?:-?[\d.]+\s+){4}re(?=\s)|(?:^|\s)(?:-?[\d.]+\s+){6}c(?=\s)/g) || []).length;
    const re = /\((?:\\.|[^\\)]){1,200}\)\s*Tj/g; let m;
    while ((m = re.exec(c)) && texts.join(" ").length < 4000) texts.push(m[0].slice(1, m[0].lastIndexOf(")")).replace(/\\(.)/g, "$1"));
  };
  const re = /<<([\s\S]{0,4000}?)>>\s*stream\r?\n/g; let m;
  while ((m = re.exec(s)) && out.streams < 2000) {
    out.streams++;
    const dict = m[1]; const start = m.index + m[0].length;
    const len = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
    let end = len ? start + parseInt(len[1], 10) : s.indexOf("endstream", start);
    if (end < start || end > buf.length) end = s.indexOf("endstream", start);
    if (end < 0) break;
    if (/\/Subtype\s*\/Image/.test(dict)) {
      out.images++;
      const w = /\/Width\s+(\d+)/.exec(dict), h = /\/Height\s+(\d+)/.exec(dict);
      if (w && h) out.image_area = Math.max(out.image_area, parseInt(w[1], 10) * parseInt(h[1], 10));
      re.lastIndex = end; continue;
    }
    let raw = buf.slice(start, end);
    if (/\/FlateDecode/.test(dict) && !/\/DecodeParms/.test(dict)) {
      if (inflated > 30 * 1048576) { re.lastIndex = end; continue; }
      try { raw = zlib.inflateSync(raw, { maxOutputLength: 10 * 1048576 }); inflated += raw.length; } catch (e) { re.lastIndex = end; continue; }
    } else if (/\/Filter/.test(dict)) { re.lastIndex = end; continue; }
    const c = raw.toString("latin1");
    if (/\/Type\s*\/ObjStm/.test(dict)) out.pages += (c.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
    else scanContent(c);
    re.lastIndex = end;
  }
  out.pages += (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  out.text_sample = texts.join(" ").replace(/\s+/g, " ").slice(0, 2000);
  const pages = Math.max(1, out.pages);
  if (out.images >= pages && out.text_ops === 0 && out.path_ops < 20) { out.kind = "scan"; out.confidence = 0.9; out.evidence.push("само картина/картини (" + out.images + ") без текст и линии – сканиран документ"); }
  else if (out.path_ops >= 20 || out.text_ops > 0) {
    if (out.images > 0 && out.image_area > 1500000) { out.kind = "mixed"; out.confidence = 0.6; out.evidence.push("векторни елементи и голяма картина"); }
    else { out.kind = "vector"; out.confidence = out.path_ops >= 20 ? 0.9 : 0.75; out.evidence.push("векторни пътища: " + out.path_ops + ", текстови оператори: " + out.text_ops); }
  } else { out.kind = "unknown"; out.confidence = 0.3; out.evidence.push("не може да се определи (компресия/формат)"); }
  return out;
}

function dxfInfo(buf) {
  const t = buf.slice(0, Math.min(buf.length, 8 * 1048576)).toString("utf8");
  const val = (key) => { const m = new RegExp("\\n\\s*9\\s*\\r?\\n\\s*\\" + key + "\\s*\\r?\\n\\s*\\d+\\s*\\r?\\n\\s*([^\\r\\n]+)").exec(t); return m ? m[1].trim() : null; };
  const UNITS = { 0: "без единици", 1: "инчове", 2: "футове", 4: "мм", 5: "см", 6: "м" };
  const ins = val("$INSUNITS");
  return { acadver: val("$ACADVER"), units: ins != null ? (UNITS[ins] || "код " + ins) : null, layers: (t.match(/\n\s*0\s*\r?\n\s*LAYER\s*\r?\n/g) || []).length, entities_sampled: (t.match(/\n\s*0\s*\r?\n\s*(LINE|LWPOLYLINE|POLYLINE|ARC|CIRCLE|INSERT|TEXT|MTEXT|HATCH)\s*\r?\n/g) || []).length, truncated: buf.length > 8 * 1048576 };
}
function ifcInfo(buf) {
  const t = buf.slice(0, Math.min(buf.length, 20 * 1048576)).toString("utf8");
  const sch = /FILE_SCHEMA\s*\(\s*\(\s*'([^']{1,40})'/i.exec(t);
  const cnt = (k) => (t.match(new RegExp("=\\s*" + k + "\\s*\\(", "gi")) || []).length;
  return { schema: sch ? sch[1] : null, buildings: cnt("IFCBUILDING"), storeys: cnt("IFCBUILDINGSTOREY"), spaces: cnt("IFCSPACE"), truncated: buf.length > 20 * 1048576 };
}
/* glTF: само проверка на структурата и на външните зависимости (буфери/текстури); геометрията е за TASK-009 */
function gltfJson(j) {
  const deps = [];
  [].concat(j.buffers || [], j.images || []).forEach((x) => { if (x && typeof x.uri === "string" && !/^data:/i.test(x.uri)) deps.push(x.uri.slice(0, 200)); });
  const badDep = deps.filter((u) => /^[a-z][\w+.-]*:/i.test(u) || u.startsWith("/") || u.split(/[\\/]/).includes(".."));
  return { version: String((j.asset && j.asset.version) || ""), meshes: (j.meshes || []).length, materials: (j.materials || []).length, images: (j.images || []).length, dependencies: deps, unsafe_dependencies: badDep };
}
function glbInfo(buf) {
  const o = { valid: false, issues: [] };
  if (buf.length < 20) { o.issues.push("твърде кратък"); return o; }
  const ver = buf.readUInt32LE(4), len = buf.readUInt32LE(8);
  if (ver !== 2) o.issues.push("версия " + ver + " (очаква се 2)");
  if (len !== buf.length) o.issues.push("дължината в заглавието (" + len + ") ≠ размера на файла (" + buf.length + ")");
  const jl = buf.readUInt32LE(12);
  if (ascii(buf, 16, 4) !== "JSON" || 20 + jl > buf.length) { o.issues.push("липсва JSON част"); return o; }
  let j = null; try { j = JSON.parse(buf.slice(20, 20 + jl).toString("utf8")); } catch (e) { o.issues.push("невалиден JSON"); return o; }
  Object.assign(o, gltfJson(j)); o.valid = !o.issues.length && !o.unsafe_dependencies.length;
  if (o.unsafe_dependencies.length) o.issues.push("опасни външни пътища");
  return o;
}

/* ---------- класификация по предназначение ---------- */
const PURPOSE_BG = { unit_inventory: "Списък с обекти", project_info: "Данни за проекта", floor_plan: "Етажен план", unit_plan: "План на обект",
  visualization: "Визуализация", source_model: "CAD/BIM модел (за TASK-009)", model_3d: "3D модел (за TASK-009)", document: "Документ", model_dependency: "Част от 3D модел", unknown: "Неразпознат" };
const FOLDERS = { "project-info": "project_info", "source-model": "source_model", visualizations: "visualization", visualisations: "visualization", "floor-plans": "floor_plan", "unit-plans": "unit_plan", "unit-data": "unit_inventory", documents: "document" };
const KW = [
  [/етажен|етаж|floor|level|ниво|партер|сутерен/i, "floor_plan"],
  [/разпределение|план|plan|layout|скица/i, "plan"],
  [/визуализ|render|рендер|viz|фасад|facade|exterior|interior|интериор|екстериор|изглед|perspective/i, "visualization"],
  [/цен|обекти|апартаменти|наличност|inventory|price|units|unit-list|списък/i, "unit_inventory"],
  [/проект|project|info|описание/i, "project_info"]
];
function norm(s) { return String(s || "").toLowerCase().replace(/[_]+/g, "-"); }
/* name = относителният път в пакета; det = sniff(); extra = { pdf, sheet:{units, project} } */
function classify(name, det, extra) {
  const ev = [], segs = String(name || "").split("/").map(norm), base = segs[segs.length - 1] || "";
  const t = det.type, isImg = ["jpeg", "png", "webp", "avif", "heic", "gif"].includes(t), isSheet = ["xlsx", "ods", "csv"].includes(t);
  let folder = null; for (const s of segs.slice(0, -1)) if (FOLDERS[s]) { folder = FOLDERS[s]; ev.push("папка „" + s + "“"); }
  let purpose = "unknown", conf = 0.2;
  const kw = KW.filter(([re]) => re.test(base.replace(/\.[a-z0-9]+$/i, ""))).map((x) => x[1]);
  if (["dwg", "dxf", "ifc"].includes(t)) { purpose = "source_model"; conf = 0.95; ev.push("CAD/BIM формат – подробностите са в TASK-009"); }
  else if (t === "glb" || t === "gltf") { purpose = "model_3d"; conf = 0.95; ev.push("3D формат – валидиране на структурата; геометрията е в TASK-009"); }
  else if (t === "bin") { purpose = "model_dependency"; conf = 0.5; ev.push("двоичен буфер (glTF зависимост)"); }
  else if (isSheet) {
    if (extra && extra.sheet && extra.sheet.units > 0) { purpose = "unit_inventory"; conf = 0.9; ev.push("разпознат заглавен ред със " + extra.sheet.fields + " познати колони"); }
    else if (extra && extra.sheet && extra.sheet.project) { purpose = "project_info"; conf = 0.8; ev.push("таблица „поле → стойност“ с данни за проекта"); }
    else { purpose = folder === "unit_inventory" ? "unit_inventory" : "document"; conf = folder === "unit_inventory" ? 0.4 : 0.3; ev.push("таблица без разпознат заглавен ред"); }
  } else if (t === "json") {
    if (extra && extra.project_json) { purpose = "project_info"; conf = 0.9; ev.push("JSON по схемата nd-project-info"); } else { purpose = "document"; conf = 0.3; ev.push("JSON без позната схема – не се използва за данни"); }
  } else if (isImg || t === "pdf") {
    const pdfTxt = extra && extra.pdf && extra.pdf.text_sample ? extra.pdf.text_sample : "";
    if (folder === "floor_plan" || folder === "unit_plan" || folder === "visualization") { purpose = folder; conf = 0.85; }
    else if (kw.includes("floor_plan") && (kw.includes("plan") || folder === null)) { purpose = "floor_plan"; conf = 0.6; ev.push("ключова дума в името (етаж/план)"); }
    else if (kw.includes("plan")) { purpose = "unit_plan"; conf = 0.5; ev.push("ключова дума в името (план/разпределение)"); }
    else if (kw.includes("visualization")) { purpose = "visualization"; conf = 0.6; ev.push("ключова дума в името (визуализация/фасада)"); }
    else if (t === "pdf" && /разпредел|етаж|план|м2|кв\.?\s?м/i.test(pdfTxt)) { purpose = "floor_plan"; conf = 0.45; ev.push("текст в PDF (план/етаж)"); }
    else if (folder === "document") { purpose = "document"; conf = 0.7; }
    else { purpose = "unknown"; conf = 0.25; ev.push("няма достатъчно признаци"); }
    if (folder && kw.length && !kw.some((k) => k === folder || (k === "plan" && /plan/.test(folder)))) { conf = Math.min(conf, 0.6); ev.push("името и папката не си съвпадат напълно"); }
  } else if (["docx", "pptx", "odt", "ole", "txt"].includes(t)) { purpose = "document"; conf = folder === "document" ? 0.8 : 0.5; ev.push("документ – само се пази"); }
  else if (t === "zip") { purpose = "unknown"; conf = 0.2; ev.push("архив"); }
  return { purpose, purpose_bg: PURPOSE_BG[purpose], confidence: Math.round(conf * 100) / 100, evidence: ev };
}

/* JSON с данни за проекта – приема се САМО по схема (07_FILE_FORMATS: „JSON/TXT само schema-валидирани“) */
const PROJECT_KEYS = { title: 200, city: 80, hood: 80, address: 300, description: 10000, stage: 40, stage_percent: 3, expected_completion: 40, advantages: 20 };
function projectJson(buf) {
  let j; try { j = JSON.parse(buf.toString("utf8").replace(/^﻿/, "")); } catch (e) { return null; }
  if (!j || typeof j !== "object" || Array.isArray(j)) return null;
  if (j.schema !== "nd-project-info/1") return { ok: false, reason: "JSON без поле schema = \"nd-project-info/1\" – не се използва" };
  const fields = {}, ignored = [], forbidden = [];
  for (const k of Object.keys(j)) {
    if (k === "schema") continue;
    if (/^(investors?|builders?|developers?|contractors?|construction[_ ]?company|инвеститор(и)?|строител(и)?|изпълнител(и)?|строителна[_ ]фирма)$/iu.test(k)) { forbidden.push(k); continue; }
    if (!(k in PROJECT_KEYS)) { ignored.push(k); continue; }
    const v = j[k];
    if (k === "advantages") { if (Array.isArray(v)) fields[k] = v.filter((x) => typeof x === "string").map((x) => x.trim().slice(0, 120)).filter(Boolean).slice(0, 20); }
    else if (k === "stage_percent") { if (Number.isInteger(v) && v >= 0 && v <= 100) fields[k] = v; else ignored.push(k); }
    else if (typeof v === "string" && v.trim()) fields[k] = v.trim().slice(0, PROJECT_KEYS[k]);
    else ignored.push(k);
  }
  return { ok: true, fields, ignored, forbidden };
}

module.exports = { sniff, imageInfo, pdfInfo, dxfInfo, ifcInfo, glbInfo, gltfJson, classify, projectJson, extOf, CAPS, MIME, TYPE_BG, PURPOSE_BG, EXT_OK, DWG_VER };
