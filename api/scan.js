// /api/scan — reads a photo or file (ID card, business card, screenshot of a chat/ad, notary deed, listing…)
// with Google Gemini and returns the data found on it as CRM fields.
// POST JSON { kind: "client" | "property", mime, data (base64), name }  + Authorization: Bearer <CRM token>
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

const PROMPTS = {
  client:
    "Ти си асистент на агенция за недвижими имоти в България. Анализирай внимателно прикаченото изображение/документ " +
    "(може да е лична карта, визитка, снимка на бележка, скрийншот от чат, имейл, обява, договор и др.). " +
    "Извлечи САМО информация, която реално се вижда в документа – не измисляй. " +
    "Върни JSON с полетата: name (име и фамилия), phone, email, egn (ЕГН ако се вижда), cat ('sales' ако търси покупка, 'rent' ако търси наем, иначе ''), " +
    "type (Апартамент/Къща/Парцел/Офис/Магазин/Гараж или ''), city, hood (квартал), budget (число в евро или null), " +
    "source (откъде е контактът, ако личи), notes (кратко резюме на български на всичко полезно за работата с клиента: изисквания, срокове, разговори, адрес, бележки), " +
    "summary (едно изречение какво е документът).",
  property:
    "Ти си асистент на агенция за недвижими имоти в България. Анализирай прикаченото изображение/документ " +
    "(обява, нотариален акт, скица, снимка на имот, скрийншот). Извлечи САМО видимата информация – не измисляй. " +
    "Върни JSON с полетата: title (кратко заглавие, напр. 'Тристаен апартамент'), deal ('sale' или 'rent'), type (Апартамент/Къща/Парцел/Офис/Магазин/Гараж), " +
    "price (число в евро или null), area (м², число или null), rooms, beds, baths (числа или null), floor (текст), year (число или null), " +
    "build (Тухла/Панел/ЕПК/Монолит/Гредоред/Сглобяема/Друго или ''), region, city, hood, address, client (собственик, ако се вижда), " +
    "desc (описание на български на всичко полезно за имота), summary (едно изречение какво е документът)."
};

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function isStaff(token) {
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } });
  if (!u.ok) return false;
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  const auth = String(req.headers["authorization"] || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !(await isStaff(token).catch(() => false))) return send(res, 401, { ok: false, error: "Влезте в CRM, за да сканирате." });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  const kind = b.kind === "property" ? "property" : "client";
  const mime = String(b.mime || "");
  if (!b.data || !/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|text\/plain)$/.test(mime)) return send(res, 400, { ok: false, error: "Поддържат се снимки (JPG, PNG, WEBP, HEIC), PDF и текст." });
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return send(res, 500, { ok: false, error: "Няма настроен ключ за анализ (GEMINI_API_KEY)." });
  const body = {
    contents: [{ role: "user", parts: [{ text: PROMPTS[kind] + (b.name ? " Име на файла: " + String(b.name).slice(0, 120) : "") }, { inline_data: { mime_type: mime, data: b.data } }] }],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
  };
  let lastErr = "";
  for (const model of MODELS) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const j = await r.json();
      if (!r.ok) { lastErr = (j.error && j.error.message) || "HTTP " + r.status; continue; }
      const text = ((j.candidates || [])[0] || {}).content?.parts?.map((p) => p.text || "").join("") || "";
      let fields;
      try { fields = JSON.parse(text.replace(/^```json|```$/g, "").trim()); } catch (e) { lastErr = "Неразчетен отговор"; continue; }
      if (Array.isArray(fields)) fields = fields[0] || {};
      return send(res, 200, { ok: true, kind, model, fields });
    } catch (e) { lastErr = String(e.message || e); }
  }
  return send(res, 502, { ok: false, error: "Анализът не успя: " + lastErr });
};
