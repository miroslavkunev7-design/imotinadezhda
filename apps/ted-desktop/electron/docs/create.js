// create_document (docs/CONTRACT.md §10.2): validates the model's arguments and produces the file bytes in MAIN.
// No network and nothing on disk here; the caller puts the result into the files store.
import { htmlToText } from "../browse/extract.js";
import { blocksToHtml, blocksToText, DocError, escHtml, MAX_BLOCKS, MAX_CHARS, normalizeBlocks } from "./blocks.js";
import { renderDocx } from "./docx.js";
import { renderPdf } from "./pdf.js";
import { renderCsv, renderXlsx } from "./xlsx.js";

export const FORMATS = {
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "docx" },
  pdf: { mime: "application/pdf", kind: "pdf" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "xlsx" },
  csv: { mime: "text/csv", kind: "csv" },
  md: { mime: "text/markdown", kind: "text" },
  txt: { mime: "text/plain", kind: "text" },
  json: { mime: "application/json", kind: "text" },
  html: { mime: "text/html", kind: "text" },
};

// Windows-safe file name with the format's extension; Cyrillic is kept.
export function fileName(title, filename, format) {
  const base = String(filename || title || "Документ")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 110) || "Документ";
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(base) ? `${base}_` : base;
  return `${reserved}.${format}`;
}

// HTML written by the model as a string is never kept as HTML (a regex sanitizer can always be outwitted: nested tags,
// "/" between attributes, <meta refresh>). Only its visible text survives: headings h1–h3 and list items keep their
// role, everything else becomes paragraphs, and the file is rendered by blocksToHtml – our own <head> with the CSP
// first and every character of the model escaped. (htmlToText is linear – no regex backtracking on hostile input.)
const H_MARK = "\uE000";
export function htmlToBlocks(html) {
  const marked = String(html)
    .slice(0, 6_000_000)
    .replace(/<h([1-3])\b[^<>]{0,2000}>/gi, (_m, n) => `\n${H_MARK}h${n}${H_MARK}`)
    .replace(/<\/h[1-3]\s*>/gi, "\n")
    .replace(/<li\b[^<>]{0,2000}>/gi, "\n• ");
  const text = htmlToText(marked, MAX_CHARS - 1000);
  const blocks = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const h = new RegExp(`^${H_MARK}(h[1-3])${H_MARK}\\s*(.*)$`).exec(t);
    if (h) { if (h[2].trim()) blocks.push({ type: h[1], text: h[2].replaceAll(H_MARK, "").trim() }); continue; }
    blocks.push({ type: "p", text: t.replaceAll(H_MARK, "") });
    if (blocks.length >= MAX_BLOCKS) break;
  }
  return blocks;
}

const textOf = (content) => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return blocksToText(normalizeBlocks(content));
  if (content && typeof content === "object" && typeof content.text === "string") return content.text;
  throw new DocError("Съдържанието на текстовия файл трябва да е текст.");
};

// args = {format, title, filename?, content, letterhead?}; images(id) -> {buffer, mime} | null.
// -> {buffer, name, mime, kind, pages?, sheets?}; throws DocError.
export async function createDocument(args, { images = () => null, now = new Date() } = {}) {
  const a = args && typeof args === "object" ? args : {};
  const format = String(a.format || "").toLowerCase();
  const spec = FORMATS[format];
  if (!spec) throw new DocError("Непознат формат. Възможни: docx, pdf, xlsx, csv, md, txt, json, html.");
  const title = String(a.title || "").trim().slice(0, 120) || "Документ";
  if (a.filename != null && String(a.filename).length > 120) throw new DocError("Името на файла е твърде дълго.");
  const name = fileName(title, a.filename, format);
  const letterhead = a.letterhead === true;
  const base = { name, mime: spec.mime, kind: spec.kind };

  if (format === "pdf") {
    const out = await renderPdf({ title, blocks: normalizeBlocks(a.content), letterhead, images, now });
    return { ...base, buffer: out.buffer, pages: out.pages };
  }
  if (format === "docx") {
    const out = await renderDocx({ title, blocks: normalizeBlocks(a.content), letterhead, images, now });
    return { ...base, buffer: out.buffer };
  }
  if (format === "xlsx") {
    const out = await renderXlsx(a.content);
    return { ...base, buffer: out.buffer, sheets: out.sheets.length };
  }
  if (format === "csv") return { ...base, ...renderCsv(a.content) };
  if (format === "json") {
    let text;
    try { text = JSON.stringify(a.content === undefined ? null : a.content, null, 2); } catch { throw new DocError("Съдържанието не е валиден JSON."); }
    if (text.length > 4_000_000) throw new DocError("Файлът е твърде голям.");
    return { ...base, buffer: Buffer.from(text + "\n", "utf8") };
  }
  if (format === "html") {
    const blocks = typeof a.content === "string" ? htmlToBlocks(a.content) : normalizeBlocks(a.content);
    const html = blocksToHtml({ title, blocks, letterhead, now, images });
    if (html.length > 6_000_000) throw new DocError("Файлът е твърде голям.");
    return { ...base, buffer: Buffer.from(html, "utf8") };
  }
  const text = textOf(a.content);
  if (text.length > 4_000_000) throw new DocError("Файлът е твърде голям.");
  // .txt gets a BOM so Notepad and older editors read the Cyrillic as UTF-8.
  const body = format === "txt" ? "﻿" + text.replace(/\r?\n/g, "\r\n") : text;
  return { ...base, buffer: Buffer.from(body, "utf8") };
}

export { DocError, escHtml };
