// /api/collect — "Събиране на имоти и клиенти": reads a public listings page (or a pasted post / screenshot),
// finds private ads (no agencies) and people who search, and returns them as structured records.
// action "photos": copies the photos of a collected ad into the CRM storage (nd-files) for "Запамети в архив".
const WEB = require("./_web.js");
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";

function send(res, s, b) { res.statusCode = s; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(b)); }
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = []; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function isStaff(token) {
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } });
  if (!u.ok) return false;
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}
const AGENCY = /агенци|брокер|комисион|посредни|real\s*estate|имоти\s+[„"]?[А-ЯA-Z]|ипотечен\s+консултант|офис\s+за\s+недвижими|наш\s+екип|предлагаме\s+на\s+нашите\s+клиенти/i;
const PHONE = /(?:\+|00)?(?:359[\s\-\/.]*|0)\(?\d{2,3}\)?(?:[\s\-\/.]*\d){5,7}/g;
function normPhone(p) { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("00359")) d = d.slice(5); else if (d.startsWith("359")) d = d.slice(3); if (!d.startsWith("0")) d = "0" + d; return d; }
function site(u) { try { const h = new URL(u).hostname.replace(/^www\./, ""); return /imot\.bg/.test(h) ? "Имоти.бг" : /olx\./.test(h) ? "OLX" : /alo\.bg/.test(h) ? "Alo.bg" : /bazar\.bg/.test(h) ? "Bazar.bg" : /imoti\.net/.test(h) ? "Imoti.net" : /homes\.bg/.test(h) ? "Homes.bg" : /facebook|fb\./.test(h) ? "Facebook" : h; } catch (e) { return "Друг сайт"; } }

const PROMPT = "Ти си асистент на агенция за недвижими имоти в България. По-долу е съдържанието на страница с обяви, пост/коментари от група или текст от снимка на екрана. " +
  "Намери ВСЯКА отделна обява, пост или коментар, свързан с имот. За всеки върни обект: " +
  "kind ('property' – някой продава/дава под наем свой имот; 'wanted' – някой ТЪРСИ да купи/наеме), seller ('private' – собственик/частно лице, 'agency' – агенция/брокер/посредник, 'unknown'), " +
  "deal ('sale'|'rent'), title (кратко заглавие), type (Апартамент/Мезонет/Къща/Етаж от къща/Вила/Парцел/Земеделска земя/Офис/Магазин/Заведение/Склад/Гараж/Паркомясто/Хотел/Промишлен имот), " +
  "rooms (число или null), city, hood, area (м², число или null), floor (текст), price (число в евро; ако е в лева раздели на 1.95583; null ако няма), " +
  "phones (масив с телефоните, както са написани), name (име на човека, ако го има), text (пълният текст на обявата/поста, до 1500 знака), " +
  "wants (при 'wanted' – какво търси: вид, квартал, бюджет, срок), images (масив с номерата [i] на снимките от СПИСЪКА СНИМКИ, които са към тази обява), " +
  "link (линк към самата обява, ако има в СПИСЪКА ЛИНКОВЕ), posted (дата, ако се вижда). " +
  "Агенция е, ако се споменава агенция, брокер, комисионна, посредник, офис, или е фирмена обява. Не измисляй – само реално видимото. " +
  "Върни JSON {\"items\":[...], \"detailLinks\":[до 25 линка към отделни обяви от тази страница, на които може да има телефон и снимки], \"nextPage\": линк към следваща страница или null}.";

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  const auth = String(req.headers["authorization"] || ""); const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !(await isStaff(token).catch(() => false))) return send(res, 401, { ok: false, error: "Влезте в CRM." });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }

  /* copy photos of an ad into nd-files */
  if (b.action === "photos") {
    const out = [];
    for (const [i, u] of (Array.isArray(b.urls) ? b.urls : []).slice(0, 30).entries()) {
      try {
        const r = await fetch(u, { headers: { "User-Agent": WEB.UA }, signal: AbortSignal.timeout(12000) });
        const ct = r.headers.get("content-type") || "";
        if (!r.ok || !/^image\//.test(ct)) continue;
        const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 15e6) continue;
        const path = "properties/" + String(b.code || "collected").replace(/[^\w\-]/g, "_") + "/photos/" + Date.now() + "-" + i + "." + (/png/.test(ct) ? "png" : /webp/.test(ct) ? "webp" : "jpg");
        const up = await fetch(SB_URL + "/storage/v1/object/nd-files/" + path, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": ct, "x-upsert": "true" }, body: buf });
        if (up.ok) out.push(path);
      } catch (e) {}
    }
    return send(res, 200, { ok: true, paths: out });
  }

  const keywords = (Array.isArray(b.keywords) ? b.keywords : String(b.keywords || "").split(/[,;\n]/)).map((k) => String(k).trim().toLowerCase()).filter(Boolean);
  if (!keywords.length) return send(res, 400, { ok: false, error: "Въведете поне една ключова дума (напр. „без посредник“, „от собственик“)." });
  const want = { property: b.properties !== false, wanted: b.clients !== false };

  let page = { url: b.url || "", title: "", text: String(b.text || "").slice(0, 40000), images: [], links: [] };
  if (b.url) {
    try { page = await WEB.readPage(b.url, 45000); } catch (e) { return send(res, 200, { ok: false, blocked: true, reason: "Не успях да отворя страницата: " + String(e.message || e) }); }
    if (page.blocked) return send(res, 200, { ok: false, blocked: true, reason: page.reason, url: b.url });
  }
  const parts = [{ text: PROMPT + "\n\nИЗТОЧНИК: " + (page.url || "поставен текст") + "\nЗАГЛАВИЕ: " + (page.title || "") +
    "\n\nСНИМКИ:\n" + page.images.map((x, i) => "[" + i + "] " + x).join("\n") + "\n\nЛИНКОВЕ:\n" + page.links.slice(0, 200).join("\n") + "\n\nСЪДЪРЖАНИЕ:\n" + page.text }];
  (Array.isArray(b.shots) ? b.shots : []).slice(0, 4).forEach((s) => { if (s && s.data && /^image\//.test(s.mime)) parts.push({ inline_data: { mime_type: s.mime, data: s.data } }); });
  let ai;
  try {
    /* модел: по подразбиране Flash; при лимит (429) – Flash Lite, който има по-голям безплатен лимит */
    const models = b.model === "lite" ? ["gemini-flash-lite-latest", "gemini-2.5-flash"] : ["gemini-2.5-flash", "gemini-flash-lite-latest"];
    let r, j;
    for (const m of models) {
      r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + encodeURIComponent(WEB.key()), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } })
      });
      j = await r.json(); if (r.ok || r.status !== 429) break;
    }
    if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
    const t = (((j.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || "").join("") || "{}";
    ai = JSON.parse(t.replace(/^```json|```$/g, "").trim());
  } catch (e) { return send(res, 502, { ok: false, error: "Анализът не успя: " + String(e.message || e) }); }

  const src = b.source || site(page.url || "");
  const accepted = [], skipped = { agency: 0, noPhone: 0, noPhoto: 0, noKeyword: 0, other: 0 };
  for (const it of (ai.items || [])) {
    const text = String(it.text || "") + " " + String(it.title || "") + " " + String(it.wants || "");
    const phones = [...new Set([].concat(it.phones || []).concat(text.match(PHONE) || []).map(normPhone).filter((p) => p.length >= 9 && p.length <= 11))];
    const kind = it.kind === "wanted" ? "wanted" : "property";
    if (!want[kind]) { skipped.other++; continue; }
    if (it.seller === "agency" || AGENCY.test(text)) { skipped.agency++; continue; }
    const low = (text + " " + (page.title || "")).toLowerCase();
    const kwHit = keywords.some((k) => low.includes(k)) || (b.text && keywords.some((k) => String(b.text).toLowerCase().includes(k)));
    if (!kwHit) { skipped.noKeyword++; continue; }
    if (!phones.length) { skipped.noPhone++; continue; }
    const photos = (it.images || []).map((i) => (typeof i === "number" ? page.images[i] : /^https?:/.test(String(i)) ? String(i) : page.images[parseInt(i, 10)])).filter(Boolean).slice(0, 30);
    let k2 = kind;
    if (kind === "property" && !photos.length && !(b.shots && b.shots.length)) { if (!want.wanted) { skipped.noPhoto++; continue; } k2 = "seller"; } /* "имам двустаен, 0888…" без снимки → клиент „Продава се“ */
    accepted.push({
      kind: k2, deal: it.deal === "rent" ? "rent" : "sale", title: it.title || "", type: it.type || "", rooms: it.rooms || null, city: it.city || "", hood: it.hood || "",
      area: Number(it.area) || null, floor: it.floor || "", price: Number(it.price) || null, phone: phones.join(", "), name: it.name || "", text: String(it.text || "").slice(0, 3000),
      wants: it.wants || "", photos, link: it.link || page.url || "", source: src, posted: it.posted || "", collected_at: new Date().toISOString()
    });
  }
  return send(res, 200, { ok: true, url: page.url, title: page.title, items: accepted, skipped, detailLinks: (ai.detailLinks || []).filter((x) => /^https?:/.test(x)).slice(0, 25), nextPage: ai.nextPage && /^https?:/.test(ai.nextPage) ? ai.nextPage : null });
};
