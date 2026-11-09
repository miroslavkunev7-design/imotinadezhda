// /f/<document id>.<ext>?k=<expiry>.<signature> (rewrite → /api/tools?file=…, no extra function) – short, stable link to a CRM document for the chat (Тед и агентът в n8n).
// Long Supabase signed links get corrupted when an AI copies them, so Тед gives this short link instead:
// the signature (HMAC with the server key) proves Тед issued it; on open the file is streamed with the right type.
"use strict";
const crypto = require("crypto");
const STORE = require("./_storage-access.js");
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SR = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

function sig(id, exp) { return crypto.createHmac("sha256", "nd-file-link:" + SR()).update(id + "." + exp).digest("hex").slice(0, 16); }
function page(res, status, text) {
  res.statusCode = status; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Cache-Control", "no-store");
  res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Имоти Надежда</title>' +
    '<body style="font:17px/1.5 Georgia,serif;background:#fbf3e8;color:#5c0a1e;display:flex;min-height:90vh;align-items:center;justify-content:center;text-align:center;padding:20px">' +
    '<div><b>' + text + '</b><br><small>Поискайте нов линк от Тед в CRM.</small></div></body>');
}

module.exports = async (req, res) => {
  const u = new URL(req.url, "https://imotinadezhda.bg");
  const file = String(u.searchParams.get("file") || u.pathname.split("/").pop() || "");
  const m = /^([a-z0-9]{8,64})(\.[a-z0-9]{1,6})?$/i.exec(file);
  const k = /^([a-z0-9]{4,10})\.([a-f0-9]{16})$/.exec(String(u.searchParams.get("k") || ""));
  if (!m || !k || !SR()) return page(res, 404, "Линкът не е валиден.");
  const id = m[1], exp = k[1];
  const a = Buffer.from(sig(id, exp)), b = Buffer.from(k[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return page(res, 404, "Линкът не е валиден.");
  if (parseInt(exp, 36) * 1000 < Date.now()) return page(res, 410, "Линкът е изтекъл.");
  const H = { apikey: SR(), Authorization: "Bearer " + SR() };
  const r = await fetch(SB_URL + "/rest/v1/nd_documents?id=eq." + encodeURIComponent(id) + "&select=data", { headers: H }).catch(() => null);
  const rows = r && r.ok ? await r.json().catch(() => []) : [];
  const data = rows[0] && rows[0].data;
  const path = data && data.path;
  if (!path || !STORE.safeStoragePath(path)) return page(res, 404, "Документът не е намерен.");
  const enc = String(path).split("/").map(encodeURIComponent).join("/");
  let obj = await fetch(SB_URL + "/storage/v1/object/nd-files/" + enc, { headers: H }).catch(() => null);
  if (!obj || !obj.ok) {
    const why = obj ? await obj.text().catch(() => "") : "";
    if (!obj || !STORE.isJwtFailure(obj.status, why)) return page(res, 404, "Файлът не е достъпен.");
    const s = await fetch(SB_URL + "/storage/v1/object/sign/nd-files/" + enc, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ expiresIn: 120 }) }).catch(() => null);
    const j = s && s.ok ? await s.json().catch(() => ({})) : {};
    const signedURL = j.signedURL || j.signedUrl;
    if (!signedURL) return page(res, 404, "Файлът не е достъпен.");
    const abs = /^https?:/.test(signedURL) ? signedURL : SB_URL + "/storage/v1" + (signedURL.startsWith("/") ? "" : "/") + signedURL;
    obj = await fetch(abs, { headers: { apikey: SR() } }).catch(() => null);
    if (!obj || !obj.ok) return page(res, 404, "Файлът не е достъпен.");
  }
  const buf = Buffer.from(await obj.arrayBuffer());
  if (!buf.length || buf.length > 40 * 1048576) return page(res, 404, "Файлът не е достъпен.");
  const name = data.name || path.split("/").pop() || "file";
  const mime = data.mime || STORE.mimeFromName(name);
  const dl = u.searchParams.get("dl") === "1";
  res.statusCode = 200;
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", String(buf.length));
  res.setHeader("Content-Disposition", STORE.contentDisposition(name, dl));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(buf);
};
module.exports.sig = sig;
