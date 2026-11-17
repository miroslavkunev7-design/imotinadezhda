// app://ted/ - serves the built renderer (dist/) from inside the app package. Never file://.
// Every response carries the CSP and nosniff; only known file types are served.
import fs from "node:fs";
import path from "node:path";

export const APP_SCHEME = "app";
export const APP_HOST = "ted";
export const APP_ORIGIN = "app://ted";
export const APP_URL = "app://ted/index.html";

// Registered before app "ready": a standard + secure scheme makes app://ted a secure context
// (needed for the microphone) with a real origin for CSP 'self'.
export const SCHEME = { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } };

// The renderer has no network at all (connect-src 'none'); everything goes through window.ted.
export const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self' data: blob:", "font-src 'self'",
  "media-src 'self' blob:", "connect-src 'none'", "frame-src 'none'", "worker-src 'none'", "object-src 'none'",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join("; ");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".wav": "audio/wav", ".mp3": "audio/mpeg",
};

const headers = (type) => ({
  "Content-Type": type,
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-cache",
});

const plain = (status, text) => new Response(text, { status, headers: headers("text/plain; charset=utf-8") });

// Maps a request URL to a file inside root, or null when it is not ours or tries to leave root.
export function resolveAsset(root, requestUrl) {
  let u;
  try { u = new URL(requestUrl); } catch { return null; }
  if (u.protocol !== APP_SCHEME + ":" || u.hostname !== APP_HOST) return null;
  let rel;
  try { rel = decodeURIComponent(u.pathname); } catch { return null; }
  if (/[\0\\:]/.test(rel) || rel.split("/").includes("..")) return null;
  if (rel === "/" || rel === "") rel = "/index.html";
  const base = path.resolve(root);
  const file = path.resolve(base, "." + rel);
  return file.startsWith(base + path.sep) ? file : null;
}

export function createAppHandler({ root, readFile = fs.promises.readFile }) {
  return async function handle(request) {
    if (request.method !== "GET" && request.method !== "HEAD") return plain(405, "Method not allowed");
    const file = resolveAsset(root, request.url);
    if (!file) return plain(403, "Forbidden");
    const type = MIME[path.extname(file).toLowerCase()];
    if (!type) return plain(404, "Not found");
    try {
      const data = await readFile(file);
      return new Response(request.method === "HEAD" ? null : data, { status: 200, headers: headers(type) });
    } catch {
      return plain(404, "Not found");
    }
  };
}

export function registerAppProtocol({ protocol, root }) {
  protocol.handle(APP_SCHEME, createAppHandler({ root }));
}
