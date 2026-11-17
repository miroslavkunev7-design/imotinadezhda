// Attachments for a message. Images are re-encoded in the renderer (<= 1400 px JPEG), PDFs go as they
// are, small text files are inlined into the message text. MAIN validates everything again.
import { uid } from "./format.js";

export const LIMITS = { files: 3, base64: Math.floor(3.8 * 1024 * 1024), inlineChars: 20000, serverText: 8000 };

const IS_TEXT = /\.(txt|md|csv)$/i;
const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isImage = (f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name);
const isText = (f) => IS_TEXT.test(f.name) || /^text\/(plain|markdown|csv)$/.test(f.type);

const readDataUrl = (blob) => new Promise((resolve, reject) => {
  const fr = new FileReader();
  fr.onload = () => resolve(String(fr.result));
  fr.onerror = () => reject(new Error("read"));
  fr.readAsDataURL(blob);
});
export const blobToBase64 = async (blob) => (await readDataUrl(blob)).split(",")[1] || "";

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

async function toItem(file) {
  const base = { id: uid("f_"), name: file.name || "файл", size: file.size };
  if (isPdf(file)) return { ...base, kind: "pdf", mime: "application/pdf", data: await blobToBase64(file) };
  if (isText(file)) {
    const text = (await file.text()).replace(/\u0000/g, "");
    return { ...base, kind: "text", text: text.slice(0, LIMITS.inlineChars), cut: text.length > LIMITS.inlineChars };
  }
  if (isImage(file)) {
    const im = await loadImage(file);
    const data = scaled(im, 1400, 0.85).split(",")[1] || "";
    return { ...base, name: base.name.replace(/\.(png|webp|gif|bmp|jpeg)$/i, ".jpg"), kind: "image", mime: "image/jpeg", data, size: Math.round(data.length * 0.75), thumb: scaled(im, 320, 0.7) };
  }
  return null;
}

const uploaded = (list) => list.filter((f) => f.kind !== "ref");
export const base64Total = (list) => list.reduce((n, f) => n + (f.data ? f.data.length : 0), 0);

// Adds picked/dropped/pasted files to the current list. Returns the accepted items and Bulgarian
// messages for everything that was refused (nothing is silently dropped).
export async function addFiles(fileList, current) {
  const items = [];
  const errors = [];
  for (const file of Array.from(fileList || [])) {
    const have = uploaded(current).length + items.length;
    if (have >= LIMITS.files) { errors.push(`Най-много ${LIMITS.files} файла на съобщение – „${file.name}“ не е добавен.`); continue; }
    let item = null;
    try { item = await toItem(file); } catch { errors.push(`Файлът „${file.name}“ не можа да се прочете.`); continue; }
    if (!item) { errors.push(`Файлът „${file.name}“ не се поддържа. Приемат се снимки, PDF и текст (.txt, .md, .csv).`); continue; }
    if (item.kind !== "text" && !item.data) { errors.push(`Файлът „${file.name}“ е празен.`); continue; }
    if (base64Total(current) + base64Total(items) + base64Total([item]) > LIMITS.base64) {
      errors.push(`Файловете са твърде големи (общо над 3,8 MB) – „${file.name}“ не е добавен.`); continue;
    }
    items.push(item);
  }
  return { items, errors };
}

// Message text as it is sent: typed text + CRM reference lines + inlined text files.
// With a limit (server engine: 8000 chars per message) the inlined part is shortened and marked.
export function composeText(text, files, limit) {
  let out = String(text || "").trim();
  const refs = files.filter((f) => f.kind === "ref").map((f) => f.line);
  if (refs.length) out += (out ? "\n\n" : "") + refs.join("\n");
  let cut = false;
  for (const f of files.filter((x) => x.kind === "text")) {
    const head = (out ? "\n\n" : "") + `[Прикачен файл „${f.name}“ – съдържание:]\n`;
    let body = f.text;
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

// What stays in the local history for an attachment (no file content).
export const chipOf = (f) => ({ id: f.id, name: f.name, size: f.size || 0, kind: f.kind, ...(f.thumb ? { thumb: f.thumb } : {}) });
