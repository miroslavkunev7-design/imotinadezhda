// /api/assistant — "Тед Асистент": real AI assistant for Имоти Надежда (Google Gemini + function calling).
// Staff (Bearer CRM token): full CRM tools through /api/tools (same rules and validation as the n8n agent).
// Visitors (no token): only the published listings, and an inquiry that goes to the CRM.
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const WEB = require("./_web.js");
const LLM = require("./_llm.js");
const TOOLSPEC = "- clients.search: Search CRM clients by name/phone/email/city. Returns id, name, phone, email, cat (sales|rent), type, city, hood, budget, status. Input: { query: string, cat: [\"sales\", \"rent\"], limit: number }\n- clients.get: One client with activity, meetings (events), deals and documents. Input: { id: string }\n- clients.create: Create a client (cat: sales = търси покупка, rent = търси наем). Input: { name (задължително), phone, email, cat: \"sales\"|\"rent\", type, city, hood, budget (число), status, source, notes }\n- clients.update: Update client fields. Input: { id: string, и всяко поле от clients.create (по избор) }\n- clients.delete: Delete a client (requires confirm=true). Input: { id: string, confirm: true }\n- clients.add_note: Add an activity note to a client. Input: { client_id: string, body: string, kind: [\"phone\", \"mail\", \"users\", \"file-text\", \"pencil\"] }\n- properties.search: Search properties. Filters: text (title/code/city/hood/owner), city, deal (sale|rent), status, max_price, min_rooms. Input: { text: string, city: string, deal: [\"sale\", \"rent\"], status: string, max_price: number, min_rooms: number }\n- properties.create: Create a property (status Чернова). Code P-#### is assigned automatically. Input: { title (задължително), deal: \"sale\"|\"rent\", type, price, area, rooms, beds, baths, floor, region, city, hood, address, client, desc, cond }\n- properties.update: Edit property fields. Input: { id: string, и всяко поле от properties.create (по избор) }\n- properties.set_status: Set property status: Чернова, Активен, Публикуван, Резервиран, Продаден, Архивиран (requires confirm=true). Input: { id: string, status: [\"Чернова\", \"Активен\", \"Публикуван\", \"Резервиран\", \"Продаден\", \"Архивиран\"], confirm: true }\n- properties.match: Match properties to a client's needs (city, budget, deal, min_rooms) ranked by fit. Pass client_id to use that client's criteria. Input: { client_id: string, city: string, budget: number, deal: [\"sale\", \"rent\"], min_rooms: number }\n- calendar.list: List calendar events between from and to (YYYY-MM-DD). Types: meeting, viewing, bank, documents, deal, team, task. Input: { from: string, to: string, type: string }\n- calendar.create: Create a calendar event (shown in Календар and on the client card). date YYYY-MM-DD, from/to HH:MM. Input: { type: [\"meeting\", \"viewing\", \"bank\", \"documents\", \"deal\", \"team\", \"task\"], title: string, date: string, from: string, to: string, client_id: string, prop: string, desc: string }\n- calendar.update: Update or move an event. Input: { id: string, title: string, date: string, from: string, to: string, desc: string }\n- calendar.delete: Delete an event (requires confirm=true). Input: { id: string, confirm: true }\n- deals.list: List deals, optional stage (Нова, Оглед, Оферта, Предварителен договор, Нотариус, Приключена, Отказана) or client_id. Input: { stage: string, client_id: string }\n- deals.create: Create a deal for a client. Input: { title: string, client_id: string, property: string, stage: string, amount: number, commission_pct: number, deadline: string, note: string }\n- deals.update: Update a deal (stage, amount, paid, deadline…). Input: { id: string, title: string, stage: string, amount: number, commission_pct: number, paid: number, deadline: string, note: string }\n- companies.search: Search partner companies (banks, builders…) and their employees. Input: { query: string }\n- brokers.list: List brokers (team). Input: {}\n- documents.list: List documents (optional client_id). Input: { client_id: string }\n- documents.download_link: Signed download link (10 minutes) for a document id. Input: { id: string }\n- calc.mortgage: Annuity mortgage. annual_rate_pct must come from the user or the live rate (/api/rates) — never invented. Input: { principal: number, years: number, annual_rate_pct: number }\n- calc.commission: Commission with optional VAT %. Input: { price: number, commission_pct: number, vat_pct: number }\n- calc.yield: Gross/net rental yield. Input: { price: number, monthly_rent: number, annual_costs: number }\n- rates.live: Live ECB reference rates (6M EURIBOR, 3M EURIBOR, €STR). Input: {}\n- reports.summary: Totals: clients, active/published properties, open/closed deals, expected and realised commission, upcoming events. Input: {}";
const TED = (() => { try { return require("./_ted-skills.js"); } catch (e) { return { names: [], SPEC: "" }; } })();
const STAFF_TOOLS = ["clients.search", "clients.get", "clients.create", "clients.update", "clients.delete", "clients.add_note", "properties.search", "properties.create", "properties.update", "properties.set_status", "properties.match", "calendar.list", "calendar.create", "calendar.update", "calendar.delete", "deals.list", "deals.create", "deals.update", "companies.search", "brokers.list", "documents.list", "documents.download_link", "calc.mortgage", "calc.commission", "calc.yield", "rates.live", "reports.summary"];
STAFF_TOOLS.push(...TED.names.filter((n) => !STAFF_TOOLS.includes(n)));

function send(res, status, body) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)); }
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = []; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function staffOf(token) {
  if (!token) return null;
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } });
  if (!u.ok) return null;
  const user = await u.json();
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true ? user : null;
}
async function rpc(name, args) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + name, { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(args || {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.message) || "HTTP " + r.status);
  return j;
}
function today() { return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Sofia" }); }

function systemPrompt(staff, user, page) {
  const base = "Ти си „Тед Асистент“ на агенция за недвижими имоти „Имоти Надежда“ (Шумен, Варна, Бургас). Днес е " + today() + " (часова зона Europe/Sofia). " +
    "Отговаряй винаги на български, кратко, ясно и учтиво. Никога не измисляй данни, цени, имоти, хора или лихви – използвай инструментите. " +
    "Не даваш правни или финансови гаранции; при правни въпроси давай обща информация и препоръчай адвокат/нотариус.";
  if (!staff) return base + " Говориш с посетител на публичния сайт. Можеш да търсиш само публикуваните обяви (функция search_listings) и да изпратиш запитване към брокер (функция send_inquiry) – " +
    "преди send_inquiry поискай име и телефон и потвърждение. Телефон за контакт с агенцията: 0898977370. Не разкривай вътрешна информация. " +
    "За общи въпроси (квартали, цени на пазара, процедури, такси) можеш да използваш web_search и да посочиш източника.";
  return base + " Говориш със служител на агенцията (" + (user.email || "") + "), страница: " + (page || "CRM") + ". Имаш пълен достъп до CRM чрез функцията crm(tool, input_json). " +
    "Инструменти:\n" + TOOLSPEC + "\n" + TED.SPEC + "\n\nПравила: 1) За да намериш id, първо търси (clients.search / properties.search). 2) Изтриване и смяна на статус (confirm=true) – само след изрично „да“ от служителя в чата; преди това кажи точно какво ще направиш и попитай. " +
    "3) След всяко записване кажи кратко какво е направено (име/код, полета). 4) Датите са YYYY-MM-DD; „утре“, „в петък“ изчислявай от днешната дата. 5) Суми в евро. " +
    "6) За качване на имот от папка със снимки и опис насочи към skill „АИ Качване на имот“ (бутонът най-горе в асистента). " +
    "7) За всичко актуално извън CRM (пазарни цени, лихви, закони, такси, новини, фирми) използвай web_search, а за конкретен линк – read_page; посочвай източника. " +
    "8) За събиране на обяви от частни лица от сайтове насочи към skill „Събиране на имоти и клиенти“. " +
    "9) Никога не отговаряй „не мога“, ако някой инструмент може да опита. Действай сам, стъпка по стъпка, без да питаш излишно: първо CRM (clients.search, properties.search и др.), после web_search с 2–4 различни формулировки (име + град, име + фирма, име + имоти/обява, на кирилица и на латиница), после read_page на най-добрите линкове. Накрая дай обобщение с точки и източници. Ако нищо не е намерено, кажи какво точно си търсил и предложи следваща стъпка. " +
    "10) Когато търсиш човек по име: покажи какво има в CRM и какво е публично и свързано с работа или имоти – фирма и длъжност, публични обяви, официални регистри (Търговски регистър), публикувани служебни контакти, статии. Не събирай лични подробности за частни лица (домашен адрес, семейство, лични профили, здраве) – ако такова се иска, кажи накратко, че не го събираш, и дай останалото. " +
    "11) Ако служителят поиска нещо, което CRM инструментите позволяват (запис, редакция, среща, задача, търсене), направи го веднага и потвърди. " +
    "12) ДОКУМЕНТИ: първо documents.find (по клиент), после documents.inspect (classify=true, когато трябва да знаеш вид/период/език), после действието (merge/split/translate/bank_statements_pack/create_pdf). Никога не казвай, че файл е готов, ако инструментът не е върнал download_url – дай линка в отговора като Markdown: [Име.pdf](url) и посочи броя страници. Липсващи месеци/страници се казват изрично. Преводите са автоматични – кажи го. " +
    "13) ИМЕЙЛ: получателят се намира с contacts.resolve; при повече от един кандидат – покажи ги и попитай. Винаги първо email.preview и покажи получател, тема, текст и файловете; email.send (confirm=true) само след изрично „да“ в чата. Ако няма доставчик, дай mailto линка и линковете към файловете. " +
    "14) „Прати ми ги“ без уточнение = линк в този чат, не имейл. 15) Договори: contracts.generate с данните от CRM; кажи колко полета са останали за попълване (blanks_to_fill). 16) Публикуване/изтриване/статус – само след „да“. 17) Имейлите тръгват от собствената поща на служителя (настроена в CRM → Настройки → „Моята поща за изпращане“: abv.bg, Gmail, Mail.bg, Outlook…), не от общ адрес; ако email.preview върне can_send=false, кажи му да я настрои и предложи mailto линка. Никога не искай и не повтаряй пароли в чата.";
}
function declarations(staff) {
  const web = [
    { name: "web_search", description: "Търси в интернет (Google) актуална информация: цени на имоти, лихви, закони, такси, фирми, новини, обяви. Връща отговор и източници.", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
    { name: "read_page", description: "Прочита публична уеб страница по линк (текст, снимки, линкове) – напр. обява, сайт на банка или агенция.", parameters: { type: "OBJECT", properties: { url: { type: "STRING" } }, required: ["url"] } }
  ];
  if (staff) return web.concat([{ name: "crm", description: "Изпълнява CRM инструмент от списъка и връща резултата като JSON.",
    parameters: { type: "OBJECT", properties: { tool: { type: "STRING", enum: STAFF_TOOLS, description: "Име на инструмента" }, input_json: { type: "STRING", description: "Входът на инструмента като JSON обект, напр. {\"query\":\"Иван\"}" } }, required: ["tool", "input_json"] } }]);
  return [web[0]].concat([
    { name: "search_listings", description: "Търси сред публикуваните обяви на агенцията.", parameters: { type: "OBJECT", properties: {
      city: { type: "STRING", description: "Шумен, Варна, Бургас или Нови пазар" }, hood: { type: "STRING" }, deal: { type: "STRING", enum: ["sale", "rent"] }, type: { type: "STRING" },
      max_price: { type: "NUMBER" }, min_rooms: { type: "NUMBER" }, text: { type: "STRING" } } } },
    { name: "send_inquiry", description: "Изпраща запитване от посетителя към брокер (записва се в CRM).", parameters: { type: "OBJECT", properties: {
      name: { type: "STRING" }, phone: { type: "STRING" }, email: { type: "STRING" }, message: { type: "STRING" }, property: { type: "STRING", description: "код/заглавие на имота, ако има" },
      city: { type: "STRING" }, deal: { type: "STRING", enum: ["sale", "rent"] } }, required: ["name", "phone", "message"] } }
  ]);
}
async function runTool(call, ctx) {
  const a = call.args || {};
  try {
    if (call.name === "crm") {
      if (!ctx.staff) return { ok: false, error: "Няма достъп" };
      let input = {}; try { input = a.input_json ? JSON.parse(a.input_json) : {}; } catch (e) { return { ok: false, error: "input_json не е валиден JSON" }; }
      const r = await fetch(ctx.origin + "/api/tools", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + ctx.token }, body: JSON.stringify({ tool: a.tool, input }) });
      const j = await r.json().catch(() => ({ ok: false, error: "HTTP " + r.status }));
      ctx.actions.push(a.tool + (j.ok ? "" : " ✗"));
      return j;
    }
    if (call.name === "web_search") { const r = await WEB.webSearch(a.query || ""); ctx.actions.push("интернет: " + String(a.query || "").slice(0, 40)); (ctx.sources = ctx.sources || []).push(...r.sources); return { ok: true, ...r }; }
    if (call.name === "read_page") { const r = await WEB.readPage(String(a.url || ""), 20000); ctx.actions.push("страница: " + String(a.url || "").replace(/^https?:\/\//, "").slice(0, 40)); if (!r.blocked) (ctx.sources = ctx.sources || []).push({ title: r.title, url: r.url }); return { ok: !r.blocked, ...r, links: (r.links || []).slice(0, 60) }; }
    if (call.name === "search_listings") {
      const rows = await rpc("nd_public_listings");
      const k = (s) => String(s || "").toLowerCase().replace(/^(гр\.|кв\.|ж\.?к\.?)\s*/, "").trim();
      const out = (rows || []).filter((p) => (!a.city || k(p.city).startsWith(k(a.city).slice(0, 4))) && (!a.hood || k(p.hood) === k(a.hood)) && (!a.deal || p.deal === a.deal) &&
        (!a.type || k(p.type) === k(a.type)) && (!a.max_price || Number(p.price) <= a.max_price) && (!a.min_rooms || Number(p.rooms || 0) >= a.min_rooms) &&
        (!a.text || [p.title, p.descr, p.hood, p.code].join(" ").toLowerCase().includes(String(a.text).toLowerCase())))
        .slice(0, 12).map((p) => ({ id: p.id, code: p.code, title: p.title, deal: p.deal, type: p.type, price: p.price, area: p.area, rooms: p.rooms, city: p.city, hood: p.hood }));
      ctx.listings = out;
      return { ok: true, count: out.length, listings: out };
    }
    if (call.name === "send_inquiry") {
      if (!a.name || !a.phone) return { ok: false, error: "Нужни са име и телефон" };
      await rpc("nd_public_inquiry", { p: { kind: "inquiry", name: a.name, phone: a.phone, email: a.email || "", message: "[Тед Асистент] " + (a.message || ""), property: a.property || "", city: a.city || "", deal: a.deal || "" } });
      ctx.actions.push("send_inquiry");
      return { ok: true, saved: true };
    }
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
  return { ok: false, error: "Непозната функция" };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  const auth = String(req.headers["authorization"] || ""); const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const user = await staffOf(token).catch(() => null);
  if (!user) return send(res, 401, { ok: false, error: "Тед Асистент работи само в CRM – влезте в профила си." });
  /* списък с моделите, за които има ключ (за менюто в чата) */
  if (b.action === "models") return send(res, 200, { ok: true, models: LLM.catalog().map((m) => ({ id: m.id, name: m.name, note: m.note, provider: m.provider, vision: m.vision, pdf: m.pdf })), n8n: process.env.N8N_AGENT_URL ? String(process.env.N8N_AGENT_URL) : null });
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const chosen = LLM.pick(String(b.model || ""));
  if (!chosen) return send(res, 500, { ok: false, error: "Няма настроен ключ за AI (GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY…)." });
  const ctx = { staff: !!user, token, actions: [], origin: "https://" + (req.headers["x-forwarded-host"] || req.headers.host || "imotinadezhda.bg") };
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-16);
  /* voice message: transcribe it first (Bulgarian), then it is handled like a typed message */
  let transcript = null;
  const lastMsg = msgs[msgs.length - 1];
  const AUDIO = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|aac|m4a|x-m4a|3gpp|flac)$/;
  const audio = lastMsg && Array.isArray(lastMsg.files) ? lastMsg.files.find((f) => f && f.data && AUDIO.test(String(f.mime))) : null;
  if (audio && !key) return send(res, 200, { ok: true, text: "Гласовите съобщения се разпознават с Gemini – няма настроен GEMINI_API_KEY.", transcript: "", actions: [], staff: ctx.staff });
  if (audio) {
    try {
      const mime = /^audio\/(x-m4a|m4a)$/.test(audio.mime) ? "audio/mp4" : audio.mime;
      const tr = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(key), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Транскрибирай дословно гласовото съобщение (най-често на български). Върни САМО текста, без кавички и коментари. Имената на квартали, улици и хора пиши правилно. Ако няма говор, върни празен низ." }, { inline_data: { mime_type: mime, data: audio.data } }] }], generationConfig: { temperature: 0 } })
      });
      const tj = await tr.json();
      transcript = (((tj.candidates || [])[0] || {}).content || {}).parts?.map((p) => p.text || "").join("").trim() || "";
    } catch (e) { transcript = ""; }
    if (!transcript) return send(res, 200, { ok: true, text: "Не успях да чуя ясно съобщението – опитайте отново, по-близо до микрофона.", transcript: "", actions: [], staff: ctx.staff });
    lastMsg.text = transcript + (lastMsg.text && lastMsg.text !== "(гласово съобщение)" ? "\n" + lastMsg.text : "");
    lastMsg.files = lastMsg.files.filter((f) => f !== audio);
  }
  const clean = msgs.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", text: String(m.text || "").slice(0, 8000), files: (Array.isArray(m.files) ? m.files : []).slice(0, 3).filter((f) => f && f.data && /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.mime)).map((f) => ({ mime: f.mime, data: f.data })) }))
    .filter((c, i0) => !(i0 === 0 && c.role === "assistant"));
  if (!clean.length) return send(res, 400, { ok: false, error: "Празно съобщение" });
  const system = systemPrompt(ctx.staff, user || {}, b.page);
  const tools = declarations(ctx.staff);
  /* избраният модел, после резервните Gemini модели (ако има ключ) */
  const order = [chosen].concat(LLM.catalog().filter((m) => m.provider === "gemini" && m.id !== chosen.id && /flash/.test(m.id)));
  if (key && !order.some((m) => m.id === "gemini-2.0-flash")) order.push({ id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "gemini", vision: true, pdf: true });
  let lastErr = "";
  for (const model of order) {
    try {
      const text = await LLM.chat(model, { system, msgs: clean, tools, run: (c) => runTool(c, ctx) });
      if (text === null) return send(res, 200, { ok: true, text: "Задачата изисква твърде много стъпки – разделете я на по-малки.", actions: ctx.actions, staff: ctx.staff, model: model.id });
      const out = text || "Не успях да формулирам отговор – опитайте отново.";
      return send(res, 200, { ok: true, text: out + (ctx.sources && ctx.sources.length ? "\n\nИзточници:\n" + ctx.sources.filter((x, i0, a) => x.url && a.findIndex((y) => y.url === x.url) === i0).slice(0, 6).map((x) => "• " + (x.title || x.url) + " – " + x.url).join("\n") : ""), transcript, actions: ctx.actions, staff: ctx.staff, listings: ctx.listings || null, model: model.id, model_name: model.name, fallback: model.id !== chosen.id ? chosen.name + " не отговори – отговори " + model.name : null });
    } catch (e) { lastErr = String(e.message || e); if (ctx.actions.length) break; }
  }
  return send(res, 502, { ok: false, error: "AI асистентът не отговори: " + lastErr });
};
