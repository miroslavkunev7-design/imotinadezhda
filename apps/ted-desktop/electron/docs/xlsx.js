// Spreadsheets of create_document: XLSX through write-excel-file (MIT) and CSV written here
// (UTF-8 with BOM and ";" separators, which Bulgarian Excel opens correctly with a double click).
import { DocError } from "./blocks.js";

export const MAX_ROWS = 20_000;
export const MAX_COLS = 100;

const cellValue = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  return String(typeof v === "object" ? JSON.stringify(v) : v).slice(0, 32000);
};

function sheetName(name, i, used) {
  let n = String(name || `Лист ${i + 1}`).replace(/[[\]:*?/\\]/g, " ").replace(/^'+|'+$/g, "").trim().slice(0, 31) || `Лист ${i + 1}`;
  let k = 2;
  while (used.has(n.toLowerCase())) n = `${n.slice(0, 27)} (${k++})`;
  used.add(n.toLowerCase());
  return n;
}

// content = {sheets:[{name, columns?:[{header, width?}], rows:[[…]]}]} -> normalised sheets
export function normalizeSheets(content) {
  const list = content && Array.isArray(content.sheets) ? content.sheets : content && Array.isArray(content.rows) ? [content] : null;
  if (!list || !list.length) throw new DocError("За таблица е нужно {sheets:[{name, rows:[[…]]}]}.");
  if (list.length > 50) throw new DocError("Твърде много листове (най-много 50).");
  const used = new Set();
  let total = 0;
  return list.map((s, i) => {
    const rows = Array.isArray(s && s.rows) ? s.rows : [];
    total += rows.length;
    if (rows.length > MAX_ROWS || total > MAX_ROWS) throw new DocError(`Твърде много редове (най-много ${MAX_ROWS}).`);
    const columns = Array.isArray(s && s.columns) ? s.columns.slice(0, MAX_COLS).map((c) => ({ header: String((c && c.header) ?? "").slice(0, 200), ...(c && Number(c.width) > 0 ? { width: Math.min(120, Number(c.width)) } : {}) })) : [];
    return {
      name: sheetName(s && s.name, i, used),
      columns,
      rows: rows.map((r) => (Array.isArray(r) ? r : [r]).slice(0, MAX_COLS).map(cellValue)),
    };
  });
}

export async function renderXlsx(content) {
  const sheets = normalizeSheets(content);
  const { default: writeXlsxFile } = await import("write-excel-file/node");
  const input = sheets.map((s) => {
    const header = s.columns.length ? [s.columns.map((c) => ({ value: c.header, fontWeight: "bold" }))] : [];
    const data = [...header, ...s.rows];
    const widthCols = s.columns.length ? s.columns.map((c) => (c.width ? { width: c.width } : {})) : undefined;
    return { data: data.length ? data : [[null]], sheet: s.name, ...(widthCols ? { columns: widthCols } : {}), ...(header.length ? { stickyRowsCount: 1 } : {}) };
  });
  const buffer = await writeXlsxFile(input).toBuffer();
  return { buffer: Buffer.from(buffer), sheets: sheets.map((s) => s.name) };
}

// A text cell that Excel would run as a formula gets a leading apostrophe (CSV injection).
function csvCell(v) {
  if (v == null) return "";
  let s = typeof v === "number" || typeof v === "boolean" ? String(v) : String(typeof v === "object" ? JSON.stringify(v) : v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function renderCsv(content) {
  const rows = content && Array.isArray(content.rows) ? content.rows : Array.isArray(content) ? content : null;
  if (!rows) throw new DocError("За CSV е нужно {rows:[[…]]}.");
  if (rows.length > MAX_ROWS) throw new DocError(`Твърде много редове (най-много ${MAX_ROWS}).`);
  const text = rows.map((r) => (Array.isArray(r) ? r : [r]).slice(0, MAX_COLS).map(csvCell).join(";")).join("\r\n");
  return { buffer: Buffer.from("﻿" + text + "\r\n", "utf8") };
}
