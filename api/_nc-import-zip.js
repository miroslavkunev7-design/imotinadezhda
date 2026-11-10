// ИМОТИ НАДЕЖДА · Ново строителство · импорт (TASK-006) – четене на ZIP архив с правила за безопасност.
// Чист JS (само вграденият zlib на Node), без мрежа и без запис на диск: архивът се чете в паметта.
// Правила (06_SECURITY_STORAGE/ARCHIVE_SAFETY.md): отказ при „../“, абсолютен път, буква на диск, символна връзка,
// криптиране, дублирани имена, разминаване между локалното и централното име, твърде много файлове,
// твърде голям общ размер, подозрително голямо съотношение на компресия (zip bomb) и повреден архив.
// Вложени архиви НЕ се разархивират (лимит на вложеност = 1) – само се пазят като файл.
"use strict";
const zlib = require("zlib");

const MB = 1048576;
const LIMITS = Object.freeze({
  maxEntries: 2000,          // файлове в един архив
  maxTotal: 400 * MB,        // сбор на разархивираните размери
  maxEntry: 40 * MB,         // един файл след разархивиране (= лимитът за четене на сървъра)
  maxRatio: 200,             // разархивиран / компресиран размер за файлове над 1 MB
  ratioFloor: 1 * MB,
  maxNameBytes: 400,
  maxDepth: 12
});
const NESTED = /\.(zip|rar|7z|tar|tgz|gz|bz2|xz|zipx|cab|iso|jar|war|apk)$/i;
const IGNORED = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$|\._[^/]*$)/i;

let CRC = null;
function crc32(buf) {
  if (!CRC) { CRC = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; } }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function utf8Valid(b) { try { new TextDecoder("utf-8", { fatal: true }).decode(b); return true; } catch (e) { return false; } }
/* име на файл в архива: UTF-8 (флаг 11 или валиден UTF-8), иначе OEM кодова страница (BG Windows = cp866) */
function decodeName(raw, flags, extra) {
  const up = extraField(extra, 0x7075);                      // Info-ZIP Unicode Path: версия 1, crc32 на старото име, UTF-8 име
  if (up && up.length > 5 && up[0] === 1 && up.readUInt32LE(1) === crc32(raw)) return { name: up.slice(5).toString("utf8"), enc: "utf8-extra" };
  if (flags & 0x800) return { name: raw.toString("utf8"), enc: "utf8" };
  if (utf8Valid(raw)) return { name: raw.toString("utf8"), enc: "utf8?" };
  try { return { name: new TextDecoder("ibm866").decode(raw), enc: "cp866" }; } catch (e) { return { name: raw.toString("latin1"), enc: "latin1" }; }
}
function extraField(extra, id) {
  for (let i = 0; i + 4 <= extra.length;) {
    const h = extra.readUInt16LE(i), n = extra.readUInt16LE(i + 2);
    if (i + 4 + n > extra.length) return null;
    if (h === id) return extra.slice(i + 4, i + 4 + n);
    i += 4 + n;
  }
  return null;
}

/* нормализира пътя в архива; връща { path } или { unsafe: причина } */
function safeEntryPath(name) {
  if (/[\u0000-\u001f\u007f]/.test(name)) return { unsafe: "контролни знаци в името" };
  const s = name.replace(/\\/g, "/");
  if (s.startsWith("/")) return { unsafe: "абсолютен път" };
  if (/^[A-Za-z]:/.test(s)) return { unsafe: "път с буква на диск" };
  const segs = [];
  for (const g of s.split("/")) {
    if (g === "" || g === ".") continue;
    if (g === "..") return { unsafe: "излизане от папката (../)" };
    if (/^\.\.+$/.test(g.trim())) return { unsafe: "излизане от папката (../)" };
    segs.push(g);
  }
  if (!segs.length) return { path: "", dir: true };
  if (segs.length > LIMITS.maxDepth) return { unsafe: "твърде дълбока структура на папките" };
  return { path: segs.join("/"), dir: s.endsWith("/") };
}

function findEocd(buf) {
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i--) if (buf.readUInt32LE(i) === 0x06054b50) return i;
  return -1;
}

/* Списък на файловете в архива + присъда за безопасност. Не разархивира нищо.
   → { ok, unsafe, encrypted, entries:[{ index, name, path, method, csize, usize, crc, lho, flags, dir, nested, ignored, unsupported, too_large }], issues:[{ code, message, name }] } */
function listZip(buf, limits) {
  const L = Object.assign({}, LIMITS, limits || {});
  const issues = [], entries = [];
  const out = (o) => Object.assign({ ok: false, unsafe: false, encrypted: false, entries, issues }, o);
  const bad = (code, message, name) => { issues.push({ code, message, name: name || null }); };
  if (!Buffer.isBuffer(buf) || buf.length < 22) { bad("corrupt", "Архивът е празен или повреден"); return out({ corrupt: true }); }
  const e = findEocd(buf);
  if (e < 0) { bad("corrupt", "Архивът е повреден (липсва краят на архива)"); return out({ corrupt: true }); }
  let count = buf.readUInt16LE(e + 10), cdSize = buf.readUInt32LE(e + 12), cdOff = buf.readUInt32LE(e + 16);
  if (buf.readUInt16LE(e + 4) !== 0 || buf.readUInt16LE(e + 6) !== 0) { bad("unsupported", "Многотомен архив не се поддържа"); return out({ unsafe: true }); }
  if (count === 0xffff || cdOff === 0xffffffff || cdSize === 0xffffffff) {             // ZIP64
    const loc = e - 20;
    if (loc < 0 || buf.readUInt32LE(loc) !== 0x07064b50) { bad("corrupt", "Повреден ZIP64 архив"); return out({ corrupt: true }); }
    const z = Number(buf.readBigUInt64LE(loc + 8));
    if (z < 0 || z + 56 > buf.length || buf.readUInt32LE(z) !== 0x06064b50) { bad("corrupt", "Повреден ZIP64 архив"); return out({ corrupt: true }); }
    count = Number(buf.readBigUInt64LE(z + 32)); cdSize = Number(buf.readBigUInt64LE(z + 40)); cdOff = Number(buf.readBigUInt64LE(z + 48));
  }
  if (count > L.maxEntries) { bad("too_many", "Архивът съдържа " + count + " файла – разрешени са до " + L.maxEntries); return out({ unsafe: true }); }
  if (cdOff + cdSize > buf.length) { bad("corrupt", "Архивът е повреден (непълен списък на файловете)"); return out({ corrupt: true }); }
  let p = cdOff, total = 0;
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) { bad("corrupt", "Архивът е повреден (запис " + (i + 1) + ")"); return out({ corrupt: true }); }
    const madeBy = buf.readUInt16LE(p + 4), flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10);
    let crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const ext = buf.readUInt32LE(p + 38); let lho = buf.readUInt32LE(p + 42);
    if (p + 46 + nl + xl + cl > buf.length) { bad("corrupt", "Архивът е повреден (име " + (i + 1) + ")"); return out({ corrupt: true }); }
    const raw = buf.slice(p + 46, p + 46 + nl), extra = buf.slice(p + 46 + nl, p + 46 + nl + xl);
    p += 46 + nl + xl + cl;
    if (nl > L.maxNameBytes) { bad("unsafe_name", "Твърде дълго име на файл в архива"); return out({ unsafe: true }); }
    if (usize === 0xffffffff || csize === 0xffffffff || lho === 0xffffffff) {
      const z = extraField(extra, 0x0001); let k = 0;
      const rd = () => { if (!z || k + 8 > z.length) return null; const v = Number(z.readBigUInt64LE(k)); k += 8; return v; };
      if (usize === 0xffffffff) usize = rd(); if (csize === 0xffffffff) csize = rd(); if (lho === 0xffffffff) lho = rd();
      if (usize == null || csize == null || lho == null) { bad("corrupt", "Повреден ZIP64 запис"); return out({ corrupt: true }); }
    }
    const { name } = decodeName(raw, flags, extra);
    const sp = safeEntryPath(name);
    if (sp.unsafe) { bad("unsafe_path", "Опасен път в архива: " + sp.unsafe, name.slice(0, 120)); return out({ unsafe: true }); }
    const host = madeBy >>> 8, mode = (ext >>> 16) & 0xffff;
    if (host === 3 && (mode & 0xf000) === 0xa000) { bad("symlink", "Символна връзка в архива", sp.path); return out({ unsafe: true }); }
    if (flags & 0x1 || method === 99) { bad("encrypted", "Архивът е защитен с парола (криптиран) – не се разархивира", sp.path); return out({ unsafe: true, encrypted: true }); }
    const dir = sp.dir || (sp.path === "");
    const key = sp.path.toLocaleLowerCase("bg");
    if (!dir) {
      if (seen.has(key)) { bad("duplicate_name", "Два файла с едно и също име в архива", sp.path); return out({ unsafe: true }); }
      seen.add(key);
    }
    if (lho + 30 > buf.length) { bad("corrupt", "Архивът е повреден (отместване)", sp.path); return out({ corrupt: true }); }
    const ent = { index: i, name: sp.path, path: sp.path, method, csize, usize, crc, lho, flags, dir,
      nested: !dir && NESTED.test(sp.path), ignored: !dir && IGNORED.test(sp.path), unsupported: !dir && method !== 0 && method !== 8, too_large: !dir && usize > L.maxEntry };
    if (!dir) {
      total += usize;
      if (total > L.maxTotal) { bad("bomb_total", "Разархивираният размер надхвърля " + Math.round(L.maxTotal / MB) + " MB"); return out({ unsafe: true }); }
      if (usize > L.ratioFloor && (csize === 0 || usize / csize > L.maxRatio)) { bad("bomb_ratio", "Подозрително голяма компресия (zip bomb)", sp.path); return out({ unsafe: true }); }
      if (method === 0 && csize !== usize) { bad("corrupt", "Несъответствие на размерите", sp.path); return out({ corrupt: true }); }
      if (ent.unsupported) bad("method", "Неподдържан метод на компресия (" + method + ")", sp.path);
      if (ent.too_large) bad("too_large", "Файлът в архива е над " + Math.round(L.maxEntry / MB) + " MB", sp.path);
      if (ent.nested) bad("nested", "Вложен архив – не се разархивира (лимит на вложеност 1)", sp.path);
    }
    entries.push(ent);
  }
  return out({ ok: true });
}

/* Разархивира ЕДИН файл с твърд таван на изхода; проверява локалното име, размера и CRC.
   → { ok:true, buf } | { ok:false, code, message } */
function extractEntry(buf, ent, maxOut) {
  const cap = Math.min(maxOut || LIMITS.maxEntry, LIMITS.maxEntry);
  if (ent.dir) return { ok: false, code: "dir", message: "Папка" };
  if (ent.unsupported) return { ok: false, code: "method", message: "Неподдържан метод на компресия" };
  if (ent.usize > cap) return { ok: false, code: "too_large", message: "Файлът е твърде голям" };
  const p = ent.lho;
  if (p + 30 > buf.length || buf.readUInt32LE(p) !== 0x04034b50) return { ok: false, code: "corrupt", message: "Повреден локален запис" };
  const nl = buf.readUInt16LE(p + 26), xl = buf.readUInt16LE(p + 28), lflags = buf.readUInt16LE(p + 6);
  const lname = decodeName(buf.slice(p + 30, p + 30 + nl), lflags, buf.slice(p + 30 + nl, p + 30 + nl + xl)).name;
  const lsp = safeEntryPath(lname);
  if (lsp.unsafe || lsp.path !== ent.path) return { ok: false, code: "name_mismatch", message: "Името в локалния запис се различава от списъка (опасен архив)" };
  if (lflags & 0x1) return { ok: false, code: "encrypted", message: "Криптиран файл" };
  const start = p + 30 + nl + xl, end = start + ent.csize;
  if (end > buf.length) return { ok: false, code: "corrupt", message: "Непълен файл в архива" };
  let out;
  try {
    out = ent.method === 0 ? Buffer.from(buf.slice(start, end)) : zlib.inflateRawSync(buf.slice(start, end), { maxOutputLength: Math.max(1, ent.usize) + 1, finishFlush: zlib.constants.Z_SYNC_FLUSH });
  } catch (e) {
    return /ERR_BUFFER_TOO_LARGE|larger than|maxOutputLength/i.test(String((e && e.code) || "") + String((e && e.message) || ""))
      ? { ok: false, code: "bomb_size", message: "Файлът се разархивира до повече от обявения размер (zip bomb)" }
      : { ok: false, code: "corrupt", message: "Файлът в архива е повреден" };
  }
  if (out.length !== ent.usize) return { ok: false, code: out.length > ent.usize ? "bomb_size" : "corrupt", message: out.length > ent.usize ? "Файлът се разархивира до повече от обявения размер (zip bomb)" : "Размерът не съответства" };
  if (crc32(out) !== ent.crc) return { ok: false, code: "crc", message: "Контролната сума (CRC) не съвпада – файлът е повреден" };
  return { ok: true, buf: out };
}

/* за вътрешни ZIP-базирани формати (XLSX/ODS/DOCX): карта име → запис, със същите лимити */
function openZip(buf, limits) {
  const z = listZip(buf, limits);
  if (!z.ok) return { ok: false, z };
  const by = new Map(); z.entries.forEach((e) => { if (!e.dir) by.set(e.path, e); });
  return { ok: true, z, names: [...by.keys()], read: (name, max) => { const e = by.get(name); if (!e) return null; const r = extractEntry(buf, e, max); return r.ok ? r.buf : null; }, has: (n) => by.has(n) };
}

module.exports = { listZip, extractEntry, openZip, safeEntryPath, crc32, LIMITS, NESTED, IGNORED };
