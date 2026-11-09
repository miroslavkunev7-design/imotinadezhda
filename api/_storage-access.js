// Чисти помощници за файловете на Тед: устойчив път в частния bucket, разпознаване на JWT отказ и MIME за сваляне.
// Не пази и не връща подписани URL адреси.
"use strict";

const SB_HOST = "hyvwfsmjbaynozceookv.supabase.co";
const PREFIX = /^(ted-chat|clients|properties|ted)\//;

function safeStoragePath(input) {
  let p = String(input || "").trim().replace(/^\/+/, "");
  if (p.startsWith("nd-files/")) p = p.slice("nd-files/".length);
  if (/%[0-9a-fA-F]{2}/.test(p)) {
    try { p = decodeURIComponent(p); } catch (e) { return null; }
  }
  if (!p || p.length > 400 || p.includes("..") || /[\0\\]/.test(p)) return null;
  if (!PREFIX.test(p)) return null;
  if (!/^[\w.\-\/\u00A0-\uFFFF]+$/u.test(p)) return null;
  return p;
}

function pathFromReference(ref) {
  const s = String(ref || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return safeStoragePath(s);
  let url;
  try { url = new URL(s); } catch (e) { return null; }
  if (url.hostname !== SB_HOST && url.hostname !== "imotinadezhda.bg" && url.hostname !== "www.imotinadezhda.bg") return null;
  const m = url.pathname.match(/\/nd-files\/(.+)$/);
  return m ? safeStoragePath(m[1]) : null;
}

function isJwtFailure(status, body) {
  const t = String(body || "");
  if (/InvalidJWT|invalid jwt|JWSError|bad_jwt|JWT expired|invalid signature/i.test(t)) return true;
  return status === 401 && /jwt/i.test(t);
}

const MIME = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  wav: "audio/wav",
  webm: "audio/webm"
};

function mimeFromName(name, fallback) {
  const ext = (String(name || "").toLowerCase().match(/\.([a-z0-9]{1,8})$/) || [])[1];
  return (ext && MIME[ext]) || fallback || "application/octet-stream";
}

function contentDisposition(name, download) {
  const base = String(name || "file").replace(/[\r\n"]/g, "").slice(0, 160) || "file";
  const ascii = base.replace(/[^\x20-\x7E]/g, "_") || "file";
  return (download ? "attachment" : "inline") + '; filename="' + ascii + "\"; filename*=UTF-8''" + encodeURIComponent(base);
}

module.exports = { safeStoragePath, pathFromReference, isJwtFailure, mimeFromName, contentDisposition, SB_HOST };
