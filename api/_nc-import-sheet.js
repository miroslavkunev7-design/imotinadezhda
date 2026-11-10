// ИМОТИ НАДЕЖДА · импорт (TASK-006) · таблици: XLSX (ZIP + XML), ODS (ZIP + content.xml) и CSV.
// Собствен минимален четец (няма package.json; за XLSX няма библиотека във vendor). Пази произхода на всяка клетка:
// лист + адрес (A1). Не изпълнява формули – взима само записаната стойност; формула без стойност → празно + бележка.
// XML: без DTD/външни обекти (разпознават се само стандартните &amp; &lt; &gt; &quot; &apos; и &#…;).
"use strict";
const Z = require("./_nc-import-zip.js");

const LIMITS = Object.freeze({ sheets: 50, rows: 20000, cols: 200, cells: 600000, xmlBytes: 60 * 1048576 });

const colName = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const colIndex = (letters) => { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e === "amp") return "&"; if (e === "lt") return "<"; if (e === "gt") return ">"; if (e === "quot") return '"'; if (e === "apos") return "'";
    const cp = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : "";
  });
}
function attrs(s) { const o = {}; const re = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g; let m; while ((m = re.exec(s))) o[m[1]] = decodeEntities(m[3] != null ? m[3] : m[4]); return o; }
const local = (n) => n.slice(n.indexOf(":") + 1);
/* поточен токенизатор: cb(kind, name, attrs, text); kind = open|close|self|text */
function scanXml(xml, cb) {
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[\s\S]*?>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^>]*?)?)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[1] != null) { cb("text", null, null, m[1]); continue; }
    if (m[3]) { if (m[2]) cb("close", m[3]); else if (m[5]) cb("self", m[3], m[4] || ""); else cb("open", m[3], m[4] || ""); continue; }
    if (m[6] != null) cb("text", null, null, decodeEntities(m[6]));
  }
}

function sheetOut(name) { return { name: String(name || "Лист").slice(0, 100), rows: [], cells: 0 }; }
function put(sh, r, c, cell, issues) {
  if (r >= LIMITS.rows || c >= LIMITS.cols) { if (!sh._cut) { sh._cut = true; issues.push({ code: "limit", message: "Лист „" + sh.name + "“ е по-голям от лимита (" + LIMITS.rows + " реда × " + LIMITS.cols + " колони) – останалото не се чете" }); } return; }
  if (++sh.cells > LIMITS.cells) return;
  while (sh.rows.length <= r) sh.rows.push([]);
  sh.rows[r][c] = Object.assign({ ref: colName(c) + (r + 1) }, cell);
}

/* XLSX → { ok, sheets:[{ name, rows:[[{ref, v, t}]] }], issues } */
function readXlsx(buf) {
  const issues = [];
  const zz = Z.openZip(buf, { maxEntries: 5000, maxTotal: 200 * 1048576 });
  if (!zz.ok) return { ok: false, sheets: [], issues: zz.z.issues.length ? zz.z.issues : [{ code: "corrupt", message: "Повреден XLSX" }], unsafe: zz.z.unsafe };
  const rd = (n) => { const b = zz.read(n, LIMITS.xmlBytes); return b ? b.toString("utf8") : null; };
  const wb = rd("xl/workbook.xml");
  if (!wb) return { ok: false, sheets: [], issues: [{ code: "corrupt", message: "XLSX без работна книга (xl/workbook.xml)" }] };
  if (zz.has("xl/vbaProject.bin")) issues.push({ code: "macro", message: "Файлът съдържа макроси – те НЕ се изпълняват, четат се само стойностите" });
  const rels = {}; const rx = rd("xl/_rels/workbook.xml.rels") || "";
  scanXml(rx, (k, n, a) => { if ((k === "self" || k === "open") && local(n) === "Relationship") { const o = attrs(a); rels[o.Id] = o.Target; } });
  const list = [];
  scanXml(wb, (k, n, a) => { if ((k === "self" || k === "open") && local(n) === "sheet") { const o = attrs(a); const rid = Object.keys(o).find((x) => /(^|:)id$/.test(x) && x !== "sheetId"); list.push({ name: o.name, target: rels[o[rid]] }); } });
  if (list.length > LIMITS.sheets) issues.push({ code: "limit", message: "Работната книга има " + list.length + " листа – четат се първите " + LIMITS.sheets });
  const sst = [];
  const ss = rd("xl/sharedStrings.xml");
  if (ss) {
    let cur = null, inT = false, depthR = 0, inPh = false;
    scanXml(ss, (k, n, a, t) => {
      const ln = n && local(n);
      if (k === "open" && ln === "si") cur = "";
      else if (k === "close" && ln === "si") { sst.push(cur || ""); cur = null; }
      else if (k === "self" && ln === "si") sst.push("");
      else if (k === "open" && ln === "rPh") inPh = true; else if (k === "close" && ln === "rPh") inPh = false;
      else if (k === "open" && ln === "t") inT = true; else if (k === "close" && ln === "t") inT = false;
      else if (k === "text" && inT && !inPh && cur != null) cur += t;
      void depthR;
    });
  }
  const sheets = [];
  for (const s of list.slice(0, LIMITS.sheets)) {
    if (!s.target) continue;
    const path = s.target.startsWith("/") ? s.target.slice(1) : "xl/" + s.target.replace(/^\.\//, "");
    const xml = rd(path.replace(/\/\.\.\//g, "/"));
    const sh = sheetOut(s.name);
    if (!xml) { issues.push({ code: "corrupt", message: "Липсва лист „" + sh.name + "“" }); continue; }
    let r = -1, c = -1, cell = null, inV = false, inT = false, inF = false, inIs = false;
    scanXml(xml, (k, n, a, t) => {
      const ln = n && local(n);
      if (k === "open" && ln === "row") { const o = attrs(a); r = o.r ? parseInt(o.r, 10) - 1 : r + 1; c = -1; return; }
      if ((k === "open" || k === "self") && ln === "c") {
        const o = attrs(a); const m = o.r && /^([A-Z]{1,3})(\d{1,7})$/.exec(o.r);
        if (m) { c = colIndex(m[1]); r = parseInt(m[2], 10) - 1; } else c++;
        cell = { t: o.t || "n", v: null, f: false, txt: "" };
        if (k === "self") cell = null;
        return;
      }
      if (!cell) return;
      if (k === "open" && ln === "v") inV = true; else if (k === "close" && ln === "v") inV = false;
      else if ((k === "open") && ln === "f") { inF = true; cell.f = true; } else if (k === "self" && ln === "f") cell.f = true; else if (k === "close" && ln === "f") inF = false;
      else if (k === "open" && ln === "is") inIs = true; else if (k === "close" && ln === "is") inIs = false;
      else if (k === "open" && ln === "t") inT = true; else if (k === "close" && ln === "t") inT = false;
      else if (k === "text") { if (inV) cell.vtxt = (cell.vtxt || "") + t; else if (inIs && inT) cell.txt += t; void inF; }
      else if (k === "close" && ln === "c") {
        const raw = cell.vtxt != null ? cell.vtxt.trim() : null; let v = null, ty = "s";
        if (cell.t === "s") { const i = parseInt(raw, 10); v = Number.isInteger(i) && i >= 0 && i < sst.length ? sst[i] : null; }
        else if (cell.t === "inlineStr") v = cell.txt;
        else if (cell.t === "str") v = raw;
        else if (cell.t === "b") { v = raw === "1"; ty = "b"; }
        else if (cell.t === "e") { v = null; ty = "e"; }
        else if (raw != null && raw !== "") { const num = Number(raw); if (isFinite(num)) { v = num; ty = "n"; } else v = raw; }
        if (cell.f && (raw == null || raw === "") && cell.t !== "inlineStr") ty = "f0";
        if (v !== null && v !== "" || ty === "f0" || ty === "e") put(sh, r, c, { v: typeof v === "string" ? v : v, t: ty }, issues);
        cell = null;
      }
    });
    sheets.push(sh);
  }
  return { ok: true, sheets, issues };
}

/* ODS → същата форма; повторените празни клетки/редове не се разгъват (защита от „number-*-repeated=1048576“) */
function readOds(buf) {
  const issues = [];
  const zz = Z.openZip(buf, { maxEntries: 5000, maxTotal: 200 * 1048576 });
  if (!zz.ok) return { ok: false, sheets: [], issues: zz.z.issues, unsafe: zz.z.unsafe };
  const b = zz.read("content.xml", LIMITS.xmlBytes);
  if (!b) return { ok: false, sheets: [], issues: [{ code: "corrupt", message: "ODS без content.xml" }] };
  const sheets = []; let sh = null, r = -1, c = 0, rowRep = 1, cell = null, rowCells = [];
  const flushRow = () => {
    const has = rowCells.some((x) => x && x.v != null && x.v !== "");
    if (!has) { r += rowRep; return; }
    for (let k = 0; k < Math.min(rowRep, 50); k++) { r++; rowCells.forEach((x, ci) => { if (x) put(sh, r, ci, { v: x.v, t: x.t }, issues); }); }
    if (rowRep > 50) r += rowRep - 50;
  };
  scanXml(b.toString("utf8"), (k, n, a, t) => {
    const ln = n && local(n);
    if (k === "open" && ln === "table") { if (sheets.length >= LIMITS.sheets) { sh = null; return; } sh = sheetOut(attrs(a)["table:name"]); sheets.push(sh); r = -1; return; }
    if (!sh) return;
    if (k === "close" && ln === "table") { sh = null; return; }
    if ((k === "open" || k === "self") && ln === "table-row") { rowRep = Math.min(parseInt(attrs(a)["table:number-rows-repeated"] || "1", 10) || 1, 2000000); rowCells = []; c = 0; if (k === "self") flushRow(); return; }
    if (k === "close" && ln === "table-row") { flushRow(); return; }
    if ((k === "open" || k === "self") && (ln === "table-cell" || ln === "covered-table-cell")) {
      const o = attrs(a); const rep = Math.min(parseInt(o["table:number-columns-repeated"] || "1", 10) || 1, 100000);
      const vt = o["office:value-type"];
      cell = { rep, v: null, t: "s", txt: "", num: vt === "float" || vt === "percentage" || vt === "currency" ? Number(o["office:value"]) : null, bool: vt === "boolean" ? o["office:boolean-value"] === "true" : null };
      if (k === "self") { c += rep; cell = null; }
      return;
    }
    if (!cell) return;
    if (k === "open" && ln === "p" && cell.txt) cell.txt += "\n";
    else if (k === "self" && ln === "s") cell.txt += " ";
    else if (k === "text") cell.txt += t;
    else if (k === "close" && (ln === "table-cell" || ln === "covered-table-cell")) {
      let v = cell.txt.trim() === "" ? null : cell.txt.trim(), ty = "s";
      if (cell.num != null && isFinite(cell.num)) { v = cell.num; ty = "n"; } else if (cell.bool != null) { v = cell.bool; ty = "b"; }
      if (v != null) for (let k2 = 0; k2 < Math.min(cell.rep, 50); k2++) rowCells[c + k2] = { v, t: ty };
      c += cell.rep; cell = null;
    }
  });
  return { ok: true, sheets, issues };
}

/* CSV: UTF-8 (с/без BOM), иначе Windows-1251; разделител ; , или табулация; кавички по RFC 4180 */
function decodeText(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { text: buf.slice(3).toString("utf8"), enc: "utf-8-bom" };
  if (buf[0] === 0xff && buf[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(buf.slice(2)), enc: "utf-16le" };
  try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(buf), enc: "utf-8" }; } catch (e) { /* не е UTF-8 */ }
  return { text: new TextDecoder("windows-1251").decode(buf), enc: "windows-1251" };
}
function readCsv(buf, name) {
  const issues = [];
  const { text, enc } = decodeText(buf);
  if (enc === "windows-1251") issues.push({ code: "encoding", message: "Файлът е в кодировка Windows-1251 – прочетен е като кирилица" });
  const head = text.slice(0, 20000).split(/\r?\n/).slice(0, 20);
  const score = (d) => head.reduce((s, l) => s + (l.split(d).length - 1), 0);
  const delim = [";", "\t", ","].map((d) => [d, score(d)]).sort((a, b) => b[1] - a[1])[0][0];
  const sh = sheetOut(String(name || "CSV").split("/").pop());
  let r = 0, c = 0, f = "", q = false, i = 0, started = false;
  const end = () => { const v = f.trim(); if (v !== "") put(sh, r, c, { v, t: "s" }, issues); f = ""; c++; started = false; };
  for (; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
    if (ch === '"' && !started && f.trim() === "") { q = true; started = true; f = ""; continue; }
    if (ch === delim) { end(); continue; }
    if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; end(); r++; c = 0; if (r >= LIMITS.rows) { issues.push({ code: "limit", message: "CSV е по-дълъг от " + LIMITS.rows + " реда – останалото не се чете" }); break; } continue; }
    f += ch; if (ch.trim()) started = true;
  }
  if (f !== "" || c > 0) end();
  return { ok: true, sheets: [sh], issues, delimiter: delim, encoding: enc };
}

module.exports = { readXlsx, readOds, readCsv, decodeText, scanXml, attrs, decodeEntities, colName, colIndex, LIMITS };
