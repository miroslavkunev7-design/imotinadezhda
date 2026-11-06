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
    "publicDesc (ново продаващо описание на български за публикуване, 5–10 изречения, с хубави емоджи като в iPhone в началото на редовете и при ключовите неща – напр. 🏡 за имота, 📐 площ, 🛏 стаи, 🏢 етаж, 🌞 изложение, 🔑 състояние, 📍 квартал, ✨ предимства; подредено на кратки редове; тип, площ, разпределение, етаж, състояние, предимства и квартал; " +
    "БЕЗ точен адрес, улица, номер или вход, БЕЗ името и телефона на собственика и БЕЗ цената към собственика; завърши с „📞 За оглед: 0898 977 370“), " +
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

/* Чужди логота / надписи върху снимка: откриване (кутии 0–1000) и почистване с Gemini image edit */
const LOGO_PROMPT = "Намери на снимката на имота всички наложени логота, водни знаци, стикери с име на агенция, надписи с телефон или уебсайт и QR кодове " +
  "(наложени графично или залепени/отпечатани табелки с име на агенция). НЕ отбелязвай обикновени предмети, картини по стените, телевизори, етикети на уреди. " +
  "Върни JSON: {\"boxes\":[{\"box\":[ymin,xmin,ymax,xmax],\"label\":\"кратко описание\"}]} с координати 0–1000. Ако няма – {\"boxes\":[]}.";
const CLEAN_MODELS = ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview"];
async function gem(key, model, body) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status); return j;
}
async function logos(res, key, b) {
  if (b.kind === "logos") {
    for (const model of MODELS) {
      try {
        const j = await gem(key, model, { contents: [{ role: "user", parts: [{ text: LOGO_PROMPT }, { inline_data: { mime_type: b.mime, data: b.data } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } });
        const t = ((j.candidates || [])[0] || {}).content?.parts?.map((p) => p.text || "").join("") || "{}";
        let o = JSON.parse(t.replace(/^```json|```$/g, "").trim()); if (Array.isArray(o)) o = { boxes: o };
        const boxes = (o.boxes || []).map((x) => ({ box: (x.box || x.box_2d || []).map(Number), label: String(x.label || "").slice(0, 60) })).filter((x) => x.box.length === 4 && x.box.every((v) => v >= 0 && v <= 1000) && x.box[2] > x.box[0] && x.box[3] > x.box[1]);
        return send(res, 200, { ok: true, boxes, model });
      } catch (e) { /* try next */ }
    }
    return send(res, 200, { ok: true, boxes: [], note: "detect failed" });
  }
  const where = (b.boxes || []).map((x) => "[" + x.box.join(",") + "] " + (x.label || "")).join("; ");
  const prompt = "Премахни от снимката САМО наложените логота, водни знаци, стикери и надписи на агенции" + (where ? " (приблизителни области ymin,xmin,ymax,xmax 0–1000: " + where + ")" : "") +
    ". На тяхно място възстанови естествено фона (стена, мебели, под, небе) така, сякаш никога не са били там. Не променяй нищо друго – кадър, цветове, светлина, предмети и размери остават същите.";
  let last = "";
  for (const model of CLEAN_MODELS) {
    try {
      const j = await gem(key, model, { contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: b.mime, data: b.data } }] }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } });
      const part = (((j.candidates || [])[0] || {}).content?.parts || []).find((p) => (p.inline_data || p.inlineData) && (p.inline_data || p.inlineData).data);
      if (part) { const d = part.inline_data || part.inlineData; return send(res, 200, { ok: true, mime: d.mime_type || d.mimeType || "image/png", data: d.data, model }); }
      last = "без изображение";
    } catch (e) { last = String(e.message || e); }
  }
  return send(res, 200, { ok: false, error: "Почистването не успя: " + last });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  const auth = String(req.headers["authorization"] || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !(await isStaff(token).catch(() => false))) return send(res, 401, { ok: false, error: "Влезте в CRM, за да сканирате." });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  if (b.kind === "classify") {
    /* Кой документ е това? – избира графа от подадения списък (key/title) или предлага ново име */
    const rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 80).map((r) => ({ key: String(r.key || "").slice(0, 40), title: String(r.title || "").slice(0, 120), group: String(r.group || "").slice(0, 80) }));
    if (!b.data || !/^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|text\/plain)$/.test(String(b.mime || ""))) return send(res, 400, { ok: false, error: "Нужен е файл" });
    const k = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!k) return send(res, 200, { ok: true, fields: null, note: "no key" });
    const prompt = "Ти си асистент на агенция за недвижими имоти в България. Прикаченият файл е документ на клиент/имот за кредит или сделка. Определи КАКЪВ документ е и в коя графа от списъка попада. " +
      "Списък с графи (key → title, група):\n" + rows.map((r) => r.key + " → " + r.title + (r.group ? " [" + r.group + "]" : "")).join("\n") +
      "\n\nВърни JSON: {\"key\": ключ от списъка или \"\" ако никоя графа не пасва, \"title\": кратко име на документа на български (напр. „Удостоверение за доходи“), \"confidence\": 0–1, \"summary\": едно изречение какво е документът, на кого е и дата ако се вижда, \"person\": име на лицето в документа ако има}. Не измисляй – ако не се разчита, confidence е нисък." + (b.name ? " Име на файла: " + String(b.name).slice(0, 120) : "");
    let last = "";
    for (const model of MODELS) {
      try {
        const j = await gem(k, model, { contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: b.mime, data: b.data } }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } });
        const t = ((j.candidates || [])[0] || {}).content?.parts?.map((p) => p.text || "").join("") || "{}";
        let f = JSON.parse(t.replace(/^```json|```$/g, "").trim()); if (Array.isArray(f)) f = f[0] || {};
        return send(res, 200, { ok: true, fields: { key: String(f.key || ""), title: String(f.title || "").slice(0, 120), confidence: Number(f.confidence) || 0, summary: String(f.summary || "").slice(0, 300), person: String(f.person || "").slice(0, 80) }, model });
      } catch (e) { last = String(e.message || e); }
    }
    return send(res, 200, { ok: true, fields: null, note: last });
  }
  if (b.kind === "logos" || b.kind === "clean") {
    if (!b.data || !/^image\/(jpeg|png|webp)$/.test(String(b.mime || ""))) return send(res, 400, { ok: false, error: "Нужна е снимка" });
    const k = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!k) return send(res, 200, { ok: true, boxes: [], note: "no key" });
    return logos(res, k, b);
  }
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
