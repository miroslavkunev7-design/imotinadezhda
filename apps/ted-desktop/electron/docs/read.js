// read_document / ted.files.extract (docs/CONTRACT.md §10.3): text of files the user attached, read locally.
// DOCX: mammoth (BSD-2-Clause); XLSX: read-excel-file (MIT); PDF: unpdf (MIT, bundles pdf.js Apache-2.0);
// CSV/TXT/MD/JSON/HTML: here. Tables are kept as rows so the model can compute with them.
import { decodeEntities, htmlToText } from "../browse/extract.js";
import { DocError } from "./blocks.js";

export const MAX_TEXT = 60_000;
export const MAX_ROWS = 2000;
export const MAX_COLS = 50;

const cellText = (v) => (v == null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
const clipRows = (rows) => rows.slice(0, MAX_ROWS).map((r) => (Array.isArray(r) ? r : [r]).slice(0, MAX_COLS).map((v) => (v == null ? null : typeof v === "number" || typeof v === "boolean" ? v : cellText(v))));
const rowsText = (rows) => rows.map((r) => r.map(cellText).join("\t")).join("\n");

function finish(doc, text) {
  const full = String(text || "").replace(/\r\n?/g, "\n");
  const truncated = full.length > MAX_TEXT || !!doc.truncated;
  return { ...doc, text: full.slice(0, MAX_TEXT), truncated };
}

const utf8 = (buf) => new TextDecoder("utf-8").decode(buf).replace(/^﻿/, "");

// CSV with "," or ";" (whichever the first line uses more), quotes and a BOM.
export function parseCsv(text) {
  const s = String(text).replace(/^﻿/, "");
  const first = s.split(/\r?\n/, 1)[0] || "";
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
      if (rows.length > MAX_ROWS) break;
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// mammoth HTML -> text with every table replaced by its rows (tab-separated) + the tables as row lists.
function docxHtmlToParts(html) {
  const sheets = [];
  const cellText = (c) => decodeEntities(c.replace(/<\/p>\s*<p[^>]*>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const withMarks = String(html).replace(/<table\b[\s\S]*?<\/table>/gi, (table) => {
    const rows = [...table.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((r) => [...r[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => cellText(c[1])));
    sheets.push({ name: `Таблица ${sheets.length + 1}`, rows: clipRows(rows) });
    return `<p>[[TED-TABLE-${sheets.length - 1}]]</p>`;
  });
  const text = htmlToText(withMarks.replace(/<li\b[^>]*>/gi, "<li>• "), 10_000_000)
    .replace(/\[\[TED-TABLE-(\d+)\]\]/g, (_, i) => `${sheets[Number(i)].name}:\n${rowsText(sheets[Number(i)].rows)}`);
  return { text, sheets };
}

// buffer + kind ("docx"|"xlsx"|"pdf"|"csv"|"text") + name -> DocText. Throws DocError("unsupported") for other kinds.
export async function readDocument({ buffer, kind, name = "файл", mime = "" }) {
  const base = { name, kind };
  if (kind === "docx") {
    const { default: mammoth } = await import("mammoth");
    const out = await mammoth.convertToHtml({ buffer });
    const { text, sheets } = docxHtmlToParts(out.value);
    return finish({ ...base, ...(sheets.length ? { sheets } : {}) }, text);
  }
  if (kind === "xlsx") {
    const { default: readXlsxFile } = await import("read-excel-file/node");
    const list = await readXlsxFile(buffer);
    let truncated = false;
    const sheets = list.map((s) => {
      if (s.data.length > MAX_ROWS || s.data.some((r) => r.length > MAX_COLS)) truncated = true;
      return { name: String(s.sheet), rows: clipRows(s.data) };
    });
    return finish({ ...base, sheets, truncated }, sheets.map((s) => `## ${s.name}\n${rowsText(s.rows)}`).join("\n\n"));
  }
  if (kind === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [String(text || "")];
    const joined = pages.map((p, i) => (pages.length > 1 ? `--- стр. ${i + 1} ---\n${p}` : p)).join("\n\n");
    const doc = { ...base, pages: totalPages };
    if (!joined.replace(/---\s*стр\.\s*\d+\s*---/g, "").trim()) {
      doc.note = "Сканиран PDF без текст – за разпознаване ползвай crm analyze_document с file:<id>";
    }
    try { await pdf.destroy(); } catch { /* nothing to free */ }
    return finish(doc, joined);
  }
  if (kind === "csv") {
    const all = parseCsv(utf8(buffer));
    const rows = clipRows(all);
    return finish({ ...base, sheets: [{ name: "CSV", rows }], truncated: all.length > MAX_ROWS }, rowsText(rows));
  }
  if (kind === "text") {
    const raw = utf8(buffer);
    const isHtml = /html/.test(mime) || /\.html?$/i.test(name) || /^\s*<(!doctype|html)/i.test(raw);
    return finish(base, isHtml ? htmlToText(raw, 10_000_000) : raw);
  }
  throw new DocError("Този вид файл не може да се прочете като текст.", "unsupported");
}
