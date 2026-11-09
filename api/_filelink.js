// /f/<document id>.<ext>?k=<expiry>.<signature> (rewrite → /api/tools?file=…, no extra function) – short, stable link to a CRM document for the chat (Тед и агентът в n8n).
// Long Supabase signed links get corrupted when an AI copies them, so Тед gives this short link instead:
// the signature (HMAC with the server key) proves Тед issued it; on open it redirects to a fresh 10-minute signed link.
"use strict";
const crypto = require("crypto");
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
  const path = rows[0] && rows[0].data && rows[0].data.path;
  if (!path) return page(res, 404, "Документът не е намерен.");
  const s = await fetch(SB_URL + "/storage/v1/object/sign/nd-files/" + String(path).split("/").map(encodeURIComponent).join("/"), { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, H), body: JSON.stringify({ expiresIn: 600 }) }).catch(() => null);
  const j = s && s.ok ? await s.json().catch(() => ({})) : {};
  const signedURL = j.signedURL || j.signedUrl;
  if (!signedURL) return page(res, 404, "Файлът не е достъпен.");
  res.statusCode = 302; res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", SB_URL + "/storage/v1" + (signedURL.startsWith("/") ? "" : "/") + signedURL);
  res.end();
};
module.exports.sig = sig;
