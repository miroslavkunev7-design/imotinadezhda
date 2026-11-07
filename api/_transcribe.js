// /api/transcribe — turns a short voice recording into Bulgarian text (Gemini). CRM staff only.
const GEM = require("./_gem.js");
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = []; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function send(res, s, b) { res.statusCode = s; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(b)); }
async function isStaff(token) {
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } });
  if (!u.ok) return false;
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}
module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  const auth = String(req.headers["authorization"] || ""); const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !(await isStaff(token).catch(() => false))) return send(res, 401, { ok: false, error: "Влезте в CRM." });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  let mime = String(b.mime || ""); if (/^audio\/(x-m4a|m4a)$/.test(mime)) mime = "audio/mp4";
  if (!b.data || !/^audio\//.test(mime)) return send(res, 400, { ok: false, error: "Няма запис" });
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return send(res, 500, { ok: false, error: "Няма ключ" });
  try {
    const text = await GEM.transcribe({ mime, data: b.data }, "Транскрибирай дословно диктуваната бележка на брокер на недвижими имоти (на български). Сложи правилна пунктуация, числата и цените пиши с цифри, имената на квартали и хора – правилно. Върни САМО текста.", { budgetMs: 24000 });
    return send(res, 200, { ok: true, text });
  } catch (e) { return send(res, e.quota ? 429 : 502, { ok: false, error: e.quota ? "Лимитът на Gemini за разпознаване е изчерпан – опитайте след минута." : String(e.message || e) }); }
};
