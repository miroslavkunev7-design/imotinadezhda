// Attachments for a message. Images are re-encoded in the renderer (<= 1400 px JPEG), PDFs and other files keep
// their bytes, small text files are inlined into the message text. MAIN validates everything again.
//
// Per engine (docs/CONTRACT.md §8.1, §10.3, §15 „+“ menu):
// - Тед (сървър): images/PDF as files (<= 3, 3,8 MB together), Word/Excel/CSV/TXT/MD as their local text
//   (read on this computer with ted.files.extract), nothing else.
// - Real GPT with the tools consent: any document type <= 20 MB, <= 10 files and 60 MB per message, stored in MAIN
//   with ted.files.add (the model reads them with read_document). Without the consent: images and text only (0.1.2).
import { uid } from "./format.js";

export const LIMITS = {
  files: 3, base64: Math.floor(3.8 * 1024 * 1024), inlineChars: 20000, serverText: 8000,
  rgFiles: 10, rgFileBytes: 20 * 1024 * 1024, rgTotalBytes: 60 * 1024 * 1024,
};

const TEXT_EXT = /\.(txt|md|csv|json)$/i;
const DOC_EXT = /\.(docx|xlsx)$/i;
const OLD_OFFICE = /\.(doc|xls|ppt)$/i;
// Programs and scripts are never attached (same idea as RUNNABLE in electron/ipc.js).
const RUNNABLE = /\.(exe|msi|msp|mst|bat|cmd|com|scr|pif|cpl|msc|ps1|psm1|psd1|vbs|vbe|js|jse|mjs|wsf|wsh|hta|lnk|url|reg|inf|jar|dll|sys|appref-ms|application|gadget|scf|sh|apk|appx|msix)$/i;
const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f) => /^image\/(jpeg|png|webp|gif|bmp)$/.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name);
const isText = (f) => TEXT_EXT.test(f.name) || /^text\/(plain|markdown|csv)$/.test(f.type);
const isVideo = (f) => f.type === "video/mp4" || /\.mp4$/i.test(f.name);
const DOC_MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const readDataUrl = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result));
  fr.onerror = () => reject(new Error("read"));
  fr.readAsDataURL(blob);
});
export const blobToBase64 = async (blob) => (await readDataUrl(blob)).split(",")[1] || "";
export const b64Bytes = (b64) => Math.floor(String(b64 || "").length * 0.75);

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image")); };
    im.src = url;
  });
}

function scaled(im, maxSide, quality) {
  const k = Math.min(1, maxSide / Math.max(im.width, im.height));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(im.width * k));
  cv.height = Math.max(1, Math.round(im.height * k));
  const g = cv.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); // transparent PNG -> white, not black
  g.drawImage(im, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", quality);
}

// The local text of a Word/Excel file (MAIN engine of read_document): a temporary store entry, read, forgotten.
// `files` = {add, extract, forget} of window.ted, or null in a build without them.
async function localText(name, mime, data, files) {
  if (!files) return { text: null, note: "" };
  let id = null;
  try {
    const a = await files.add({ name, mime, data, temporary: true });
    if (!a || !a.ok || !a.file) return { text: null, note: (a && a.error) || "" };
    id = a.file.id;
    const r = await files.extract({ id });
    if (!r || !r.ok || !r.doc) return { text: null, note: (r && r.error) || "" };
    const d = r.doc;
    let text = String(d.text || "");
    if (!text && Array.isArray(d.sheets)) text = d.sheets.map((s) => "# " + s.name + "\n" + (s.rows || []).map((row) => row.join("\t")).join("\n")).join("\n\n");
    return { text, note: d.note || "", truncated: !!d.truncated };
  } catch { return { text: null, note: "" }; }
  finally { if (id) Promise.resolve(files.forget(id)).catch(() => {}); }
}

async function toItem(file, files) {
  const base = { id: uid("f_"), name: file.name || "файл", size: file.size };
  if (RUNNABLE.test(base.name)) return { refused: "runnable" };
  if (isPdf(file)) return { ...base, kind: "pdf", mime: "application/pdf", data: await blobToBase64(file) };
  if (isText(file)) {
    const text = (await file.text()).replace(/\u0000/g, "");
    return { ...base, kind: "text", mime: file.type || "text/plain", text: text.slice(0, LIMITS.inlineChars), cut: text.length > LIMITS.inlineChars };
  }
  if (isImage(file)) {
    const im = await loadImage(file);
    const data = scaled(im, 1400, 0.85).split(",")[1] || "";
    return { ...base, name: base.name.replace(/\.(png|webp|gif|bmp|jpeg)$/i, ".jpg"), kind: "image", mime: "image/jpeg", data, size: b64Bytes(data), thumb: scaled(im, 320, 0.7) };
  }
  if (DOC_EXT.test(base.name)) {
    const ext = base.name.split(".").pop().toLowerCase();
    const mime = DOC_MIME[ext];
    const data = await blobToBase64(file);
    const t = await localText(base.name, mime, data, files);
    const text = t.text == null ? null : t.text.slice(0, LIMITS.inlineChars);
    return { ...base, kind: "doc", ext, mime, data, text, cut: !!(t.text && (t.text.length > LIMITS.inlineChars || t.truncated)), note: t.note };
  }
  if (isVideo(file)) return { ...base, kind: "video", mime: "video/mp4", data: await blobToBase64(file) };
  // Anything else: kept as bytes; Real GPT can store it in CRM (files.attach) but cannot read it.
  return { ...base, kind: "other", mime: file.type || "application/octet-stream", data: await blobToBase64(file), old: OLD_OFFICE.test(base.name) };
}

const uploaded = (list) => list.filter((f) => f.kind !== "ref");
// Bytes that go to Ted's server as files (images and PDF only).
export const base64Total = (list) => list.reduce((n, f) => n + ((f.kind === "image" || f.kind === "pdf") && f.data ? f.data.length : 0), 0);
const bytesTotal = (list) => list.reduce((n, f) => n + (f.data ? b64Bytes(f.data) : f.size || 0), 0);

// Adds picked/dropped/pasted files to the current list. Returns the accepted items and Bulgarian messages for
// everything that was refused (nothing is silently dropped). opts: {engine:"server"|"realgpt", files: ted.files|null}.
export async function addFiles(fileList, current, opts) {
  const o = opts || {};
  const rg = o.engine === "realgpt";
  const items = [];
  const errors = [];
  const maxFiles = rg ? LIMITS.rgFiles : LIMITS.files;
  for (const file of Array.from(fileList || [])) {
    const have = uploaded(current).length + items.length;
    if (have >= maxFiles) { errors.push(`Най-много ${maxFiles} файла на съобщение – „${file.name}“ не е добавен.`); continue; }
    if (rg && file.size > LIMITS.rgFileBytes) { errors.push(`Файлът „${file.name}“ е над 20 MB и не е добавен.`); continue; }
    let item = null;
    try { item = await toItem(file, o.files || null); } catch { errors.push(`Файлът „${file.name}“ не можа да се прочете.`); continue; }
    if (!item || item.refused) { errors.push(`Файлът „${file.name}“ не се поддържа – програми и скриптове не се прикачват.`); continue; }
    if (item.kind !== "text" && !item.data) { errors.push(`Файлът „${file.name}“ е празен.`); continue; }
    if (!rg) {
      if (item.kind === "video" || item.kind === "other") {
        errors.push(`Файлът „${file.name}“ не се поддържа от Тед (сървър). Приемат се снимки, PDF, Word (.docx), Excel (.xlsx) и текст (.txt, .md, .csv).` +
          (item.old ? " Старите .doc/.xls запазете като .docx/.xlsx." : " Real GPT приема и други файлове."));
        continue;
      }
      if (item.kind === "doc" && item.text == null) { errors.push(`Текстът на „${file.name}“ не можа да се прочете на този компютър.${item.note ? " " + item.note : ""}`); continue; }
      if (base64Total(current) + base64Total(items) + base64Total([item]) > LIMITS.base64) {
        errors.push(`Файловете са твърде големи (общо над 3,8 MB) – „${file.name}“ не е добавен.`); continue;
      }
    } else if (bytesTotal(uploaded(current)) + bytesTotal(items) + bytesTotal([item]) > LIMITS.rgTotalBytes) {
      errors.push(`Файловете са твърде големи (общо над 60 MB) – „${file.name}“ не е добавен.`); continue;
    }
    items.push(item);
  }
  return { items, errors };
}

// Why these attachments cannot go with the chosen engine right now (null = they can). `tools` = Real GPT may read
// files (consent "all" and a 0.1.3 bridge).
export function engineProblem(engine, list, tools) {
  const up = uploaded(list);
  if (engine === "realgpt") {
    if (up.length > LIMITS.rgFiles) return `Най-много ${LIMITS.rgFiles} файла на съобщение.`;
    if (!tools && up.some((f) => f.kind !== "image" && f.kind !== "text" && !(f.kind === "doc" && f.text != null))) {
      return "Real GPT приема само снимки и текст без инструментите на Тед. Разрешете ги (Настройки → Безопасност), за да чете PDF и други файлове – или за PDF изберете модел на Тед (сървър).";
    }
    return null;
  }
  const bad = up.find((f) => f.kind === "video" || f.kind === "other" || f.kind === "lib" || (f.kind === "doc" && f.text == null));
  if (bad) return `„${bad.name}“ не може да се изпрати към Тед (сървър). Приемат се снимки, PDF, Word, Excel и текст – или изберете Real GPT.`;
  if (up.filter((f) => f.kind === "image" || f.kind === "pdf").length > LIMITS.files) return `Тед (сървър) приема до ${LIMITS.files} снимки или PDF на съобщение.`;
  if (base64Total(up) > LIMITS.base64) return "Файловете са твърде големи за Тед (сървър) (общо над 3,8 MB).";
  return null;
}

// Message text as it is sent: typed text + CRM reference lines + inlined text files.
// With a limit (server engine: 8000 chars per message) the inlined part is shortened and marked.
// inlineDocs: also inline the local text of Word/Excel files (server engine, or Real GPT without file tools).
export function composeText(text, files, limit, inlineDocs = true) {
  let out = String(text || "").trim();
  const refs = files.filter((f) => f.kind === "ref").map((f) => f.line);
  if (refs.length) out += (out ? "\n\n" : "") + refs.join("\n");
  let cut = false;
  for (const f of files.filter((x) => x.kind === "text" || (inlineDocs && x.kind === "doc" && x.text != null))) {
    const head = (out ? "\n\n" : "") + `[Прикачен файл „${f.name}“ – съдържание:]\n`;
    let body = f.text;
    if (f.kind === "doc" && f.cut) body += "\n[…съкратено]";
    if (limit) {
      const tail = "\n[…съкратено]";
      const room = limit - out.length - head.length - tail.length;
      if (room < 40) { cut = true; continue; }
      if (body.length > room) { body = body.slice(0, room) + tail; cut = true; }
    }
    out += head + body;
  }
  return { text: out, cut };
}

// A library file picked from „Последни файлове ›“: Real GPT gets its store id, nothing is copied.
export const libItem = (ref) => ({ id: uid("f_"), kind: "lib", fileId: ref.id, name: ref.name || "файл", size: ref.size || 0, mime: ref.mime || "", libKind: ref.kind || "other", ...(ref.thumb ? { thumb: ref.thumb } : {}) });

// What stays in the local history for an attachment (no file content).
export const chipOf = (f) => ({ id: f.id, name: f.name, size: f.size || 0, kind: f.kind, ...(f.thumb ? { thumb: f.thumb } : {}), ...(f.fileId ? { fileId: f.fileId } : {}) });
