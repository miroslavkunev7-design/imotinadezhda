// ИМОТИ НАДЕЖДА · Ново строителство · TASK-009 · чисти функции (без мрежа и без база) за CAD/BIM и 3D модели:
// разпознаване на формат по СЪДЪРЖАНИЕ (не по име), подпис на обратните повиквания на изпълнителя (HMAC),
// проверка на публичния GLB (структура, разширения, външни препратки, лични метаданни, размери) и почистване на отчетите.
// Не е отделна Vercel функция (името започва с „_“). Изпитва се с api/_nc-cad.test.js.
"use strict";
const crypto = require("crypto");

const MB = 1048576;
const LIMITS = {
  inputBytes: { ifc: 150 * MB, ifczip: 150 * MB, dxf: 100 * MB, dwg: 100 * MB, glb: 100 * MB, gltf: 20 * MB, pdf: 60 * MB },
  hashInlineBytes: 64 * MB,        // до толкова сайтът сам смята sha256 при заявката; над това – отпечатък от хранилището, а sha256 идва от изпълнителя
  glbOutBytes: 64 * MB,            // = ограничението nd_models.glb_bytes
  posterBytes: 2 * MB,
  jsonChunkBytes: 16 * MB,
  triangles: 4000000, nodes: 20000,
  callbackSkewSec: 300, callbackBodyBytes: 900 * 1024,
  sourceTtlSec: 300, publicTtlSec: 60, previewTtlSec: 60,
  heartbeatSec: 30, redispatchSec: 300,
  inspectMinutes: 12, convertMinutes: 45
};

/* грешки: код → кратък текст за човека. Кодът стои в nd_jobs.error като „[КОД] текст“. */
const ERR = {
  FILE_NOT_FOUND: "Файлът не е намерен", FILE_TOO_LARGE: "Файлът е твърде голям", FILE_UNSUPPORTED: "Неподдържан файл", FILE_CORRUPT: "Файлът е повреден или непълен",
  NEEDS_SOURCE: "За 3D модел е нужен IFC, 3D DXF или GLB", NEEDS_DXF_OR_IFC: "DWG не се конвертира тук – нужен е DXF или IFC", NO_3D_GEOMETRY: "Във файла няма 3D геометрия – модел не се прави",
  MISSING_REFERENCES: "Липсват външни файлове, от които зависи моделът", SOURCE_CHANGED: "Файлът е сменен след заявката – пуснете я отново", ARCHIVE_UNSAFE: "Опасен архив",
  LIMIT_EXCEEDED: "Надхвърлен лимит", TIMEOUT: "Времето за обработка изтече", ARTIFACT_INVALID: "Готовият модел не мина проверката", STORAGE_FAILED: "Грешка в хранилището",
  WORKER_UNAVAILABLE: "Изпълнителят не е наличен", DB_CONFLICT: "Конфликт на версии", FORBIDDEN: "Нямате право", INVALID_INPUT: "Невалидни данни", NOT_INSPECTED: "Файлът още не е проверен",
  MIGRATION_MISSING: "Липсва миграцията за 3D модели (nc_005) в базата", CANCELLED: "Отменено", INTERNAL_ERROR: "Вътрешна грешка"
};
const RETRYABLE = new Set(["STORAGE_FAILED", "WORKER_UNAVAILABLE", "INTERNAL_ERROR"]);

/* ---------- 1. формат по съдържание ---------- */
const DWG_VERSIONS = { AC1006: "R10", AC1009: "R11/R12", AC1012: "R13", AC1014: "R14", AC1015: "2000", AC1018: "2004", AC1021: "2007", AC1024: "2010", AC1027: "2013", AC1032: "2018" };
const FORMAT_BG = { ifc: "IFC (BIM модел)", ifczip: "IFC в архив (ifcZIP)", dxf: "DXF чертеж", dwg: "DWG чертеж", glb: "GLB 3D модел", gltf: "glTF 3D модел", pdf: "PDF документ",
  image: "Изображение", zip: "Архив", ifcxml: "IFC-XML", unknown: "Непознат файл" };
const ascii = (buf, a, b) => buf.subarray(a, Math.min(b, buf.length)).toString("latin1");
/* buf = началото на файла (поне първите ~1 KB; повече е по-добре). nameHint се ползва само за ifcZIP срещу обикновен архив. */
function sniff(buf, nameHint) {
  const out = (format, o) => Object.assign({ format, label_bg: FORMAT_BG[format], version: null, inspect: false, convert: "no", reason_bg: null }, o || {});
  if (!buf || buf.length < 8) return out("unknown", { reason_bg: "Файлът е празен или твърде къс" });
  const head = ascii(buf, 0, 4096), t = head.replace(/^\uFEFF|^\xEF\xBB\xBF/, "").replace(/^\s+/, "");
  if (buf.readUInt32LE(0) === 0x46546c67) {
    const v = buf.readUInt32LE(4);
    if (v !== 2) return out("glb", { version: String(v), reason_bg: "GLB версия " + v + " не се поддържа – нужен е glTF 2.0" });
    return out("glb", { version: "2.0", inspect: true, convert: "yes" });
  }
  const pdf = head.slice(0, 1024).indexOf("%PDF-");
  if (pdf >= 0) return out("pdf", { version: (/%PDF-(\d\.\d)/.exec(head) || [])[1] || null, inspect: true, reason_bg: "PDF се проверява (векторен или сканиран, мащаб, надписи), но не съдържа височини – 3D модел от PDF не се прави" });
  if (/^AC1\d{3}/.test(head)) {
    const code = head.slice(0, 6);
    return out("dwg", { version: DWG_VERSIONS[code] ? "AutoCAD " + DWG_VERSIONS[code] + " (" + code + ")" : code, inspect: true, convert: "maybe", reason_bg: "DWG се разпознава по версия; конверсия има само ако изпълнителят разполага с разрешен конвертор – иначе е нужен DXF или IFC" });
  }
  if (head.startsWith("AutoCAD Binary DXF")) return out("dxf", { version: "binary", inspect: true, convert: "maybe" });
  if (/^ISO-10303-21\s*;/.test(t)) {
    const m = /FILE_SCHEMA\s*\(\s*\(\s*'([^']{1,40})'/i.exec(head);
    return out("ifc", { version: m ? m[1].toUpperCase() : null, inspect: true, convert: "yes" });
  }
  if (/^(?:999\r?\n[^\n]*\r?\n\s*)*0\r?\n\s*SECTION\b/.test(t)) return out("dxf", { version: (/\$ACADVER\r?\n\s*1\r?\n\s*(AC\d{4})/.exec(head) || [])[1] || null, inspect: true, convert: "maybe" });
  if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 3 || buf[2] === 5 || buf[2] === 7)) {
    if (/\.ifczip$/i.test(String(nameHint || ""))) return out("ifczip", { inspect: true, convert: "yes" });
    return out("zip", { reason_bg: "Архивите се разопаковат от импорта на проект (imports.start) – тук се подава самият IFC/DXF/GLB/PDF файл" });
  }
  if (/^<\?xml|^<ifc|^<ex:iso_10303_28/i.test(t)) return out(/ifc|iso_10303_28/i.test(head) ? "ifcxml" : "unknown", { reason_bg: "XML вариантът на IFC не се поддържа – изнесете IFC (STEP, .ifc)" });
  if (t[0] === "{" && /"asset"\s*:/.test(head)) return out("gltf", { version: (/"version"\s*:\s*"(\d\.\d)"/.exec(head) || [])[1] || null, inspect: true, convert: "maybe", reason_bg: "glTF с външни файлове не може да се зареди сам – качете GLB (един файл)" });
  if ((buf[0] === 0xff && buf[1] === 0xd8) || head.startsWith("\x89PNG") || head.startsWith("GIF8") || (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") || head.startsWith("II*\0") || head.startsWith("MM\0*"))
    return out("image", { reason_bg: "Снимка или визуализация е само за справка: от нея не се възстановява точна геометрия и 3D модел не се прави" });
  return out("unknown", { reason_bg: "Форматът не е разпознат по съдържание. Поддържат се IFC, DXF, DWG (само проверка), GLB/glTF и PDF (само проверка)" });
}

/* ---------- 2. подпис на обратните повиквания (изпълнител → сайт) ---------- */
function sign(secret, ts, action, body) {
  return "v1=" + crypto.createHmac("sha256", String(secret)).update(String(ts) + "\n" + String(action) + "\n").update(body).digest("hex");
}
function verify(secret, ts, action, body, sig, nowSec) {
  if (!secret || String(secret).length < 24) return { ok: false, reason: "not_configured" };
  if (!/^\d{9,11}$/.test(String(ts || ""))) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs((nowSec == null ? Math.floor(Date.now() / 1000) : nowSec) - Number(ts)) > LIMITS.callbackSkewSec) return { ok: false, reason: "stale_timestamp" };
  if (!/^v1=[a-f0-9]{64}$/.test(String(sig || ""))) return { ok: false, reason: "bad_signature" };
  const a = Buffer.from(sign(secret, ts, action, body)), b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/* ---------- 3. почистване на отчетите (преди да влязат в базата и да стигнат до екрана) ---------- */
const BAD_KEY = /(invest|builder|developer|contractor|construction[_ ]?compan|инвеститор|строител|изпълнител|строителна)/iu;   // по-широко от nd_nc_clean: такъв ключ просто се изпуска
const PRIVATE_KEY = /^(path|paths|url|uri|signed|signedurl|token|authorization|author|authors|organization|organisation|email|user|username|hostname|computer|originating_system|preprocessor_version)$/i;
function scrub(s, max) {
  return String(s)
    .replace(/[A-Za-z]:\\(?:[^\\\s"'<>|]+\\)*([^\\\s"'<>|]*)/g, "$1")          // C:\Users\…\файл.dwg → файл.dwg
    .replace(/(?:\\\\|\/)(?:[^\/\\\s"'<>|]+[\/\\]){2,}([^\/\\\s"'<>|]*)/g, "$1")   // /home/…/файл или \\server\share\файл → файл
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[имейл]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .slice(0, max || 400);
}
function cleanReport(v, opts, depth) {
  const o = Object.assign({ maxArray: 300, maxKeys: 200, maxString: 400, maxDepth: 8 }, opts || {}), d = depth || 0;
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return scrub(v, o.maxString);
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  if (d >= o.maxDepth || typeof v !== "object") return null;
  if (Array.isArray(v)) return v.slice(0, o.maxArray).map((x) => cleanReport(x, o, d + 1));
  const out = {};
  for (const k of Object.keys(v).slice(0, o.maxKeys)) {
    if (BAD_KEY.test(k) || PRIVATE_KEY.test(k) || k.length > 60) continue;
    out[k] = cleanReport(v[k], o, d + 1);
  }
  return out;
}
/* ако след почистването отчетът пак е над лимита – остава кратката му част с бележка (никога не се отказва целият резултат) */
function fitJson(obj, maxBytes, keep) {
  if (Buffer.byteLength(JSON.stringify(obj)) <= maxBytes) return obj;
  const small = {}; (keep || []).forEach((k) => { if (obj[k] !== undefined) small[k] = obj[k]; });
  small.truncated = true;
  return Buffer.byteLength(JSON.stringify(small)) <= maxBytes ? small : { truncated: true };
}

/* ---------- 4. проверка на GLB за публикуване ---------- */
// Разширения, които локалният three.js (r187, GLTFLoader без външни декодери) зарежда сам. Всичко друго се отказва изрично.
const GLB_EXT_OK = new Set(["KHR_materials_emissive_strength", "KHR_materials_unlit", "KHR_materials_transmission", "KHR_materials_ior", "KHR_materials_clearcoat", "KHR_materials_specular",
  "KHR_materials_volume", "KHR_materials_sheen", "KHR_texture_transform", "KHR_mesh_quantization", "KHR_lights_punctual"]);
const GLB_EXT_BG = { KHR_draco_mesh_compression: "Draco компресия", EXT_meshopt_compression: "Meshopt компресия", KHR_texture_basisu: "KTX2/Basis текстури", EXT_texture_webp: "WebP текстури", EXT_texture_avif: "AVIF текстури", MSFT_texture_dds: "DDS текстури" };
const NODE_EXTRAS = new Set(["unit_id", "unit_code", "floor_id", "floor_level", "nd_kind"]);
const SAFE_NAME = /^[\p{L}\p{N} ._:#+()\-]{0,80}$/u;
const GENERATOR = "imotinadezhda-nc-worker";
const PRIVATE_STR = /([A-Za-z]:\\|\\\\[\w.-]+\\|\/(?:Users|home|var|mnt|Volumes|tmp)\/|file:|https?:\/\/|[\w.+-]+@[\w-]+\.[\w-]+)/;
function imageSize(b) {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), mime: "image/png" };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) { o++; continue; }
      const m = b[o + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(o + 7), h: b.readUInt16BE(o + 5), mime: "image/jpeg" };
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { o += 2; continue; }
      o += 2 + b.readUInt16BE(o + 2);
    }
    return { w: 0, h: 0, mime: "image/jpeg" };
  }
  return null;
}
/* strict:true = проверка на готовия ПУБЛИЧЕН файл (нашият изпълнител го е писал): без чужди метаданни, без extras извън позволените.
   strict:false = само структурна проверка (за теста и за сравнение). Връща { ok, errors[], warnings[], stats }. */
function validateGlb(buf, opts) {
  const o = Object.assign({ strict: true, maxBytes: LIMITS.glbOutBytes, unitIds: null, floorIds: null }, opts || {});
  const errors = [], warnings = [], stats = { bytes: buf ? buf.length : 0 };
  const fail = (m) => { errors.push(m); return { ok: false, errors, warnings, stats }; };
  if (!Buffer.isBuffer(buf) || buf.length < 20) return fail("файлът е твърде къс за GLB");
  if (buf.length > o.maxBytes) return fail("GLB е над " + Math.round(o.maxBytes / MB) + " MB");
  if (buf.readUInt32LE(0) !== 0x46546c67) return fail("липсва подписът glTF");
  if (buf.readUInt32LE(4) !== 2) return fail("поддържа се само glTF 2.0");
  if (buf.readUInt32LE(8) !== buf.length) return fail("дължината в заглавието не съвпада с файла (отрязан или дописан файл)");
  const jl = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) return fail("първото парче не е JSON");
  if (jl > LIMITS.jsonChunkBytes || 20 + jl > buf.length) return fail("невалидна дължина на JSON парчето");
  let g; try { g = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8")); } catch (e) { return fail("JSON парчето не се чете"); }
  if (!g || typeof g !== "object" || !g.asset || String(g.asset.version) !== "2.0") return fail("липсва asset.version 2.0");
  let bin = null, off = 20 + jl;
  if (off + 8 <= buf.length) {
    const bl = buf.readUInt32LE(off);
    if (buf.readUInt32LE(off + 4) !== 0x004e4942 || off + 8 + bl > buf.length) return fail("невалидно двоично парче");
    bin = buf.subarray(off + 8, off + 8 + bl); off += 8 + bl;
  }
  if (off !== buf.length) return fail("излишни данни след последното парче");
  const arr = (k) => (Array.isArray(g[k]) ? g[k] : []);
  // разширения
  const used = [].concat(g.extensionsUsed || [], g.extensionsRequired || []).filter((x, i, a) => typeof x === "string" && a.indexOf(x) === i);
  for (const x of used) if (!GLB_EXT_OK.has(x)) errors.push("разширение, което прегледът не зарежда: " + x + (GLB_EXT_BG[x] ? " (" + GLB_EXT_BG[x] + ")" : ""));
  // буфери и изображения: всичко вътре във файла
  if (arr("buffers").length > 1) errors.push("повече от един буфер");
  arr("buffers").forEach((b) => { if (b && b.uri !== undefined) errors.push("външен или вграден като текст буфер (uri) – липсваща външна препратка"); });
  if (arr("buffers").length && !bin) errors.push("липсва двоичното парче");
  if (bin && arr("buffers")[0] && arr("buffers")[0].byteLength > bin.length) errors.push("буферът е по-къс от обявеното");
  const views = arr("bufferViews");
  views.forEach((v, i) => { if (!v || v.buffer !== 0 || !(v.byteLength > 0) || (v.byteOffset || 0) + v.byteLength > (bin ? bin.length : 0)) errors.push("bufferView " + i + " излиза извън файла"); });
  let texBytes = 0; const texList = [];
  arr("images").forEach((im, i) => {
    if (!im || im.uri !== undefined) { errors.push("изображение " + i + " сочи към външен файл – липсваща текстура"); return; }
    const v = views[im.bufferView];
    if (!v || !bin) { errors.push("изображение " + i + " няма данни"); return; }
    const s = imageSize(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength));
    if (!s) { errors.push("изображение " + i + " не е PNG/JPEG"); return; }
    if (s.w > 4096 || s.h > 4096) warnings.push("текстура " + i + " е " + s.w + "×" + s.h + " – над 4096 px");
    const mem = Math.round(s.w * s.h * 4 * 1.333); texBytes += mem; texList.push({ w: s.w, h: s.h, mime: s.mime, file_bytes: v.byteLength, gpu_bytes_est: mem });
  });
  // достъпници, мрежи, триъгълници, размери
  const acc = arr("accessors"), CT = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, TN = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  acc.forEach((a, i) => {
    if (!a || !CT[a.componentType] || !TN[a.type] || !(a.count >= 0)) { errors.push("достъпник " + i + " е невалиден"); return; }
    if (a.sparse) { errors.push("достъпник " + i + " е „sparse“ – не се поддържа"); return; }
    const v = views[a.bufferView]; if (!v) { errors.push("достъпник " + i + " няма bufferView"); return; }
    const stride = v.byteStride || CT[a.componentType] * TN[a.type];
    if ((a.byteOffset || 0) + (a.count ? (a.count - 1) * stride + CT[a.componentType] * TN[a.type] : 0) > v.byteLength) errors.push("достъпник " + i + " излиза извън данните");
  });
  let tris = 0, verts = 0, prims = 0;
  arr("meshes").forEach((m, mi) => (m && Array.isArray(m.primitives) ? m.primitives : []).forEach((p) => {
    prims++;
    const pa = acc[p.attributes && p.attributes.POSITION];
    if (!pa || pa.type !== "VEC3") { errors.push("мрежа " + mi + " няма върхове (POSITION)"); return; }
    if (!Array.isArray(pa.min) || !Array.isArray(pa.max)) errors.push("мрежа " + mi + ": липсват min/max на върховете");
    verts += pa.count;
    const mode = p.mode === undefined ? 4 : p.mode;
    if (mode !== 4) { warnings.push("мрежа " + mi + " не е от триъгълници (mode " + mode + ")"); return; }
    if (p.indices !== undefined) {
      const ia = acc[p.indices]; if (!ia) { errors.push("мрежа " + mi + ": липсват индекси"); return; }
      tris += Math.floor(ia.count / 3);
      if (bin && errors.length === 0 && ia.count <= 3000000) {   // индексите сочат само към съществуващи върхове
        const v = views[ia.bufferView], base = (v.byteOffset || 0) + (ia.byteOffset || 0); let mx = 0;
        if (ia.componentType === 5125) for (let k = 0; k < ia.count; k++) { const x = bin.readUInt32LE(base + k * 4); if (x > mx) mx = x; }
        else if (ia.componentType === 5123) for (let k = 0; k < ia.count; k++) { const x = bin.readUInt16LE(base + k * 2); if (x > mx) mx = x; }
        else if (ia.componentType === 5121) for (let k = 0; k < ia.count; k++) { const x = bin[base + k]; if (x > mx) mx = x; }
        if (ia.count && mx >= pa.count) errors.push("мрежа " + mi + ": индекс извън върховете");
      }
    } else tris += Math.floor(pa.count / 3);
  }));
  if (!prims || !tris) errors.push("във файла няма триъгълници");
  if (tris > LIMITS.triangles) errors.push("твърде много триъгълници (" + tris + " > " + LIMITS.triangles + ")");
  const nodes = arr("nodes");
  if (nodes.length > LIMITS.nodes) errors.push("твърде много възли (" + nodes.length + ")");
  // размери в света: обхождане на сцената с матриците на възлите
  const bbox = worldBox(g, acc);
  if (!bbox) errors.push("размерите на модела не могат да се определят");
  // смислово съответствие и лични данни
  const units = new Set(), floors = new Set(); let badExtras = 0, badNames = 0;
  const checkName = (x) => { if (x && x.name !== undefined && (typeof x.name !== "string" || !SAFE_NAME.test(x.name))) badNames++; };
  nodes.forEach((n) => {
    if (!n) return; checkName(n);
    const e = n.extras;
    if (e === undefined) return;
    if (!e || typeof e !== "object" || Array.isArray(e)) { badExtras++; return; }
    for (const k of Object.keys(e)) if (!NODE_EXTRAS.has(k)) badExtras++;
    if (typeof e.unit_id === "string") units.add(e.unit_id);
    if (typeof e.floor_id === "string") floors.add(e.floor_id);
    if (o.unitIds && e.unit_id !== undefined && !o.unitIds.has(e.unit_id)) errors.push("възел сочи към обект, който не е от тази сграда");
    if (o.floorIds && e.floor_id !== undefined && !o.floorIds.has(e.floor_id)) errors.push("възел сочи към етаж, който не е от тази сграда");
  });
  if (o.strict) {
    ["meshes", "materials", "scenes", "textures", "images", "cameras", "animations", "skins", "samplers", "accessors", "bufferViews", "buffers"].forEach((k) => arr(k).forEach((x) => { if (x && x.extras !== undefined) badExtras++; checkName(x); }));
    if (g.extras !== undefined || g.asset.extras !== undefined) badExtras++;
    if (g.asset.copyright !== undefined) errors.push("в модела има поле за авторски надпис (asset.copyright)");
    if (g.asset.generator !== GENERATOR) errors.push("моделът не е минал през оптимизатора на изпълнителя (asset.generator)");
    if (badExtras) errors.push("в модела има допълнителни метаданни (extras) извън позволените: " + badExtras);
    if (badNames) errors.push("в модела има имена с непозволени знаци: " + badNames);
    if (arr("cameras").length) errors.push("в модела има камери от източника");
    const flat = JSON.stringify(Object.assign({}, g, { accessors: undefined, bufferViews: undefined }));
    if (PRIVATE_STR.test(flat)) errors.push("в модела има път към файл, адрес или имейл");
  }
  Object.assign(stats, { nodes: nodes.length, meshes: arr("meshes").length, primitives: prims, materials: arr("materials").length, textures: arr("textures").length, images: arr("images").length,
    animations: arr("animations").length, triangles: tris, vertices: verts, bbox, extensions: used, texture_gpu_bytes_est: texBytes, textures_detail: texList.slice(0, 40),
    units_mapped: units.size, floors_mapped: floors.size, unit_ids: [...units], floor_ids: [...floors] });
  return { ok: errors.length === 0, errors: errors.slice(0, 30), warnings: warnings.slice(0, 30), stats };
}
/* --- матрици 4×4 (колонен ред, както в glTF) --- */
function matMul(a, b) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function matOf(n) {
  if (Array.isArray(n.matrix) && n.matrix.length === 16) return n.matrix.map(Number);
  const t = n.translation || [0, 0, 0], q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1], [x, y, z, w] = q;
  return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1];
}
function worldBox(g, acc) {
  const nodes = Array.isArray(g.nodes) ? g.nodes : [], meshes = Array.isArray(g.meshes) ? g.meshes : [];
  const scene = (Array.isArray(g.scenes) ? g.scenes : [])[g.scene || 0];
  const roots = scene && Array.isArray(scene.nodes) ? scene.nodes : nodes.map((_, i) => i);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; let seen = 0;
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const walk = (i, M, depth) => {
    const n = nodes[i]; if (!n || depth > 64 || ++seen > 200000) return;
    const W = matMul(M, matOf(n));
    const m = meshes[n.mesh];
    (m && Array.isArray(m.primitives) ? m.primitives : []).forEach((p) => {
      const a = acc[p.attributes && p.attributes.POSITION]; if (!a || !Array.isArray(a.min) || !Array.isArray(a.max)) return;
      for (let c = 0; c < 8; c++) {
        const v = [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]];
        for (let r = 0; r < 3; r++) { const x = W[r] * v[0] + W[4 + r] * v[1] + W[8 + r] * v[2] + W[12 + r]; if (x < mn[r]) mn[r] = x; if (x > mx[r]) mx[r] = x; }
      }
    });
    (Array.isArray(n.children) ? n.children : []).forEach((c) => walk(c, W, depth + 1));
  };
  roots.forEach((r) => walk(r, I, 0));
  if (!isFinite(mn[0]) || !isFinite(mx[0])) return null;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return { min: mn.map(r3), max: mx.map(r3), size: [r3(mx[0] - mn[0]), r3(mx[1] - mn[1]), r3(mx[2] - mn[2])] };
}

/* ---------- 5. ключ за повторяемост ---------- */
const sha256 = (x) => crypto.createHash("sha256").update(x).digest("hex");
function stable(v) { return v === null || typeof v !== "object" ? JSON.stringify(v) : Array.isArray(v) ? "[" + v.map(stable).join(",") + "]" : "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}"; }
function inspectKey(projectId, fp, rev) { return "cad_inspect:" + projectId + ":" + fp + (rev ? ":r" + rev : ""); }
function convertKey(buildingId, fp, mapping, rev) {
  const has = mapping && Object.keys(mapping).some((k) => Array.isArray(mapping[k]) && mapping[k].length);
  return "cad_convert:" + buildingId + ":" + fp + (has ? ":m" + sha256(stable(mapping)).slice(0, 12) : "") + (rev ? ":r" + rev : "");
}

module.exports = { MB, LIMITS, ERR, RETRYABLE, FORMAT_BG, DWG_VERSIONS, sniff, sign, verify, scrub, cleanReport, fitJson, validateGlb, worldBox, imageSize, GLB_EXT_OK, GLB_EXT_BG, NODE_EXTRAS, GENERATOR, sha256, stable, inspectKey, convertKey };
