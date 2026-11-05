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
    "source (откъде е контактът, ако личи), rooms (минимум стаи, число или null), areaMin (минимална площ м² или null), " +
    "payment ('Кеш'/'Банков кредит'/'Кеш + кредит' или ''), timeframe ('Спешно – до 1 месец'/'1–3 месеца'/'3–6 месеца'/'Над 6 месеца'/'Само се ориентира' или ''), " +
    "priority ('Горещ' ако е спешно и готов, 'Топъл', 'Студен' или ''), contactPref ('Телефон'/'Viber'/'WhatsApp'/'Имейл'/'SMS' или ''), " +
    "floorPref ('Не първи'/'Не последен'/'Не първи и не последен'/'Висок етаж'/'Без значение' или ''), must (задължителни изисквания, напр. 'тераса, асансьор'), notes (кратко резюме на български на всичко полезно за работата с клиента: изисквания, срокове, разговори, адрес, бележки), " +
    "summary (едно изречение какво е документът).",
  property:
    "Ти си асистент на агенция за недвижими имоти в България. Анализирай прикаченото изображение/документ " +
    "(обява, нотариален акт, скица, снимка на имот, скрийншот). Извлечи САМО видимата информация – не измисляй. " +
    "Върни JSON с полетата: title (кратко заглавие, напр. 'Тристаен апартамент'), deal ('sale' или 'rent'), type (Апартамент/Къща/Парцел/Офис/Магазин/Гараж), " +
    "price (число в евро или null), area (м², число или null), rooms, beds, baths (числа или null), floor (текст), year (число или null), " +
    "build (Тухла/Панел/ЕПК/Монолит/Гредоред/Сглобяема/Друго или ''), region, city, hood, address, client (собственик, ако се вижда), " +
    "expo (изложение: Юг/Изток/Запад/Север/Юг-Изток/Юг-Запад/Изток-Запад/Север-Юг или ''), heat (ТЕЦ/Газ/Ток / климатици/Термопомпа/Камина / печка/Локално парно или ''), " +
    "parking (Няма/Паркомясто/Гараж/Подземен паркинг/В двора или ''), elevator (true/false/null), terraces (брой или null), act (Акт 16/Акт 15/Акт 14/В строеж/Без акт или ''), " +
    "cond (Ново строителство/Обзаведен/Необзаведен/За ремонт или ''), features (кратко изброяване на предимствата, напр. 'гледка, след ремонт, тиха улица'), " +
    "desc (описание на български на всичко полезно за имота), summary (едно изречение какво е документът).",
  folder:
    "Ти си асистент на агенция за недвижими имоти „Имоти Надежда“ в България. Получаваш папка с имот: името на папката, текста на описа " +
    "(написан от брокера след оглед) и няколко снимки. Извлечи САМО информацията, която реално я има – не измисляй. " +
    "Върни JSON с полетата: title (кратко заглавие, напр. 'Тристаен апартамент в кв. Тракия'), deal ('sale' или 'rent'), " +
    "type (Апартамент/Къща/Парцел/Офис/Магазин/Гараж), area (м², число или null), rooms, beds, baths (числа или null), floor (напр. '3 / 6'), " +
    "year (число или null), build (Тухла/Панел/ЕПК/Монолит/Гредоред/Сглобяема/Друго или ''), region, city, hood (квартал), address (точен адрес, ако го има), " +
    "expo (изложение: Юг/Изток/Запад/Север/Юг-Изток/Юг-Запад/Изток-Запад/Север-Юг или ''), heat (ТЕЦ/Газ/Ток / климатици/Термопомпа/Камина / печка/Локално парно или ''), " +
    "parking (Няма/Паркомясто/Гараж/Подземен паркинг/В двора или ''), elevator (true/false/null), terraces (брой или null), act (Акт 16/Акт 15/Акт 14/В строеж/Без акт или ''), " +
    "cond (Ново строителство/Обзаведен/Необзаведен/За ремонт или ''), features (кратко изброяване на предимствата, напр. 'гледка, след ремонт, тиха улица'), " +
    "ownerName (име на собственика), ownerPhones (масив с телефоните на собственика), ownerPrice (цената към собственика – по-малката от цените, написани в описа; обявената за купувача е по-високата; число в евро или null), " +
    "officialPrice (обявената цена за купувача, ако е посочена в описа, число в евро или null), " +
    "publicDesc (ново продаващо описание на български за публикуване, 5–10 изречения: тип, площ, разпределение, етаж, състояние, предимства и квартал; " +
    "БЕЗ точен адрес, улица, номер или вход, БЕЗ името и телефона на собственика и БЕЗ цената към собственика; завърши с „За оглед: 0898977370“), " +
    "summary (едно изречение какво съдържа папката)."
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
  const kind = b.kind === "property" ? "property" : b.kind === "folder" ? "folder" : "client";
  const mime = String(b.mime || "");
  const MIME_OK = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|text\/plain)$/;
  if (kind === "folder") {
    if (!b.text && !b.data && !(Array.isArray(b.images) && b.images.length)) return send(res, 400, { ok: false, error: "Папката е празна." });
    if (b.data && !MIME_OK.test(mime)) return send(res, 400, { ok: false, error: "Неподдържан файл с опис." });
  } else if (!b.data || !MIME_OK.test(mime)) return send(res, 400, { ok: false, error: "Поддържат се снимки (JPG, PNG, WEBP, HEIC), PDF и текст." });
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return send(res, 500, { ok: false, error: "Няма настроен ключ за анализ (GEMINI_API_KEY)." });
  const parts = [{ text: PROMPTS[kind] + (b.name ? " Име на файла: " + String(b.name).slice(0, 120) : "") }];
  if (kind === "folder") {
    parts.push({ text: "Име на папката: " + String(b.folder || "(няма)").slice(0, 200) + "\n\nОПИС:\n" + String(b.text || "(няма текстов опис)").slice(0, 30000) });
    (Array.isArray(b.images) ? b.images : []).slice(0, 4).forEach((im) => { if (im && im.data && MIME_OK.test(String(im.mime))) parts.push({ inline_data: { mime_type: String(im.mime), data: im.data } }); });
  }
  if (b.data) parts.push({ inline_data: { mime_type: mime, data: b.data } });
  const body = {
    contents: [{ role: "user", parts }],
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
