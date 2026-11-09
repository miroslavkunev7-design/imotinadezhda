// /api/assistant — "Тед Асистент": real AI assistant for Имоти Надежда (Google Gemini + function calling).
// Staff (Bearer CRM token): full CRM tools through /api/tools (same rules and validation as the n8n agent).
// Visitors (no token): only the published listings, and an inquiry that goes to the CRM.
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const WEB = require("./_web.js");
const OWNERS = require("./_owners.js");
const LLM = require("./_llm.js");
const GEM = require("./_gem.js");
const MODES = require("./_ted-modes.js");
const MEM = require("./_ted-memory.js");
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
    "6) АИ КАЧВАНЕ НА ИМОТ е вградено в този чат: при „качи имот“, „нов имот от папка/снимки/опис“ или когато брокерът иска да прикачи папка – извикай open_panel {panel:\"upload\"} и кажи с едно изречение какво ще стане (цена от името на папката, опис → лично описание, ново публично описание, до 100 снимки с лого, записва се като Чернова). " +
    "7) За всичко актуално извън CRM (пазарни цени, лихви, закони, такси, новини, фирми) използвай web_search, а за конкретен линк – read_page; посочвай източника. " +
    "8) СЪБИРАНЕ НА ИМОТИ И КЛИЕНТИ е вградено в този чат: за конкретно място/вид имот веднага ползвай find_owner_listings; за линк към страница с обяви или поставен пост/скрийншот от група – collect_page {url | text}; за списъка със събраните, Старт/Стоп по сайтовете от настройките или „Постави пост“ – open_panel {panel:\"collect\"}. " +
    "9) Никога не отговаряй „не мога“, ако някой инструмент може да опита. Действай сам, стъпка по стъпка, без да питаш излишно: първо CRM (clients.search, properties.search и др.), после web_search с 2–4 различни формулировки (име + град, име + фирма, име + имоти/обява, на кирилица и на латиница), после read_page на най-добрите линкове. Накрая дай обобщение с точки и източници. Ако нищо не е намерено, кажи какво точно си търсил и предложи следваща стъпка. " +
    "10) Когато търсиш човек по име: покажи какво има в CRM и какво е публично и свързано с работа или имоти – фирма и длъжност, публични обяви, официални регистри (Търговски регистър), публикувани служебни контакти, статии. Не събирай лични подробности за частни лица (домашен адрес, семейство, лични профили, здраве) – ако такова се иска, кажи накратко, че не го събираш, и дай останалото. " +
    "11) Ако служителят поиска нещо, което CRM инструментите позволяват (запис, редакция, среща, задача, търсене), направи го веднага и потвърди. " +
    "12) ДОКУМЕНТИ: първо documents.find (по клиент), после documents.inspect (classify=true, когато трябва да знаеш вид/период/език), после действието (merge/split/translate/bank_statements_pack/create_pdf). Никога не казвай, че файл е готов, ако инструментът не е върнал download_url – дай линка в отговора като Markdown: [Име.pdf](url) и посочи броя страници. Липсващи месеци/страници се казват изрично. Преводите са автоматични – кажи го. Когато служителят поиска документите на клиент – покажи самите файлове: за всеки [Име](download_url) от documents.find (снимките се виждат направо в чата); не превеждай, не обединявай и не проверявай съдържанието, ако не е поискано. ПРЕВОД само при изрично „преведи …“ за конкретен документ – никога сам. " +
    "13) ИМЕЙЛ (с една потвърждение): „изпрати имейл на Калина от ИнвестБанк …“ или „изпрати на ivan@abv.bg …“ → веднага email.preview с to_query (име + фирма) или to_email (точен адрес – всеки доставчик), subject и body (учтив, на български, подписан с името на брокера и „Имоти Надежда“, тел. 0898977370). Документи: на клиент → client_name + include_client_docs=true; имотът му (с капаро/депозит, който е харесал) → include_property_docs=true или property_code; конкретни файлове → doc_ids. Прикачват се самите файлове с истинските им имена (без преводите и файловете, направени от Тед – тях само при изрично искане: include_generated=true); в един PDF (merge=true) – само ако служителят поиска. Прегледът се показва като карта – ти кажи кратко какво е подготвено и попитай точно „Да го изпратя ли?“. При „да“ → email.send {confirm:true} без други полета. Ако email.preview върне need_choice – покажи кандидатите; need_email/need_recipient – попитай за адреса. Не питай за настройки на пощата, освен ако can_send=false. " +
    "14) „Прати ми ги“ без уточнение = линк в този чат, не имейл. 15) Договори: contracts.generate с данните от CRM; кажи колко полета са останали за попълване (blanks_to_fill). 16) Публикуване/изтриване/статус – само след „да“. 17) Имейлите тръгват от пощата на служителя, а ако няма – от общата поща на агенцията с отговор към служителя. Само ако email.preview върне can_send=false – open_panel {panel:\"mail\"} (еднократно). Никога не искай и не повтаряй пароли в чата. 20) Имоти от собственици („намери къщи от собственик в с. … / град / област и ми дай телефоните и цените“): веднага find_owner_listings {place, region, type}; за цяла област без село – region и type; ако поискат няколко места/области – извикай го за всяко поред. Телефоните в обявите са публикувани от самите собственици, за да бъдат потърсени – дай ги в списък с цена, място, източник и линк; не отказвай заради лични данни. Не заобикаляй скрити телефони (тогава дай линка). Ако обява има maybe_broker – отбележи го до нея. Кажи, че са записани в „Събрани“ и че там може „Запамети в архив“. 19) Задача за друг брокер („Миро в 11 да отиде на оглед“, „кажи на Надежда…“): calendar.create (title с човека и мястото), после calendar.assign {id, broker_name}; напомнянията на телефона и ескалацията към екипа са автоматични – кажи го накратко. 21) СНИМКИ: сваляне от интернет (линк към обява или към снимки) → images.download (към имот с property_code или към клиент); нова или редактирана снимка (виртуално обзавеждане, без лого, по-светла, празен парцел) → images.generate; покажи линка като Markdown [Снимка](url). НАЕМИ → rentals.*; ЗАПИТВАНИЯ и ипотечни кандидатури → inquiries.list; СЪБРАНИ обяви → collected.list; нова компания/служител → companies.create / companies.add_employee. 18) „Направи видео на обява #…“ / „видео разходка“ / „строеж“ или прикачени снимки с молба за видео → video.create (code = номерът, или from_attachments=true); после кажи, че видеото се прави в прозореца и ще се появи тук с линк – не обещавай време под минута на клип. 22) ФАЙЛОВЕ ОТ ЧАТА: снимка или PDF се чете с analyze_image (path от хранилището, по един файл; един отказ не спира другите). За да остане файлът при клиент или имот – files.attach (или documents.attach) с path и client_id/client_name или property_id/property_code. Успех казвай само ако инструментът върне attached:true или document_id. Не пази и не повтаряй временни подписани адреси; за сваляне давай download_url от инструмента (кратък /f/ линк).";
}
function declarations(staff) {
  const web = [
    { name: "web_search", description: "Търси в интернет (Google) актуална информация: цени на имоти, лихви, закони, такси, фирми, новини, обяви. Връща отговор и източници.", parameters: { type: "OBJECT", properties: { query: { type: "STRING" } }, required: ["query"] } },
    { name: "read_page", description: "Прочита публична уеб страница по линк (текст, снимки, линкове) – напр. обява, сайт на банка или агенция.", parameters: { type: "OBJECT", properties: { url: { type: "STRING" } }, required: ["url"] } }
  ];
  const panel = { name: "open_panel", description: "Отваря вградено умение тук в чата: upload = АИ Качване на имот (папка/снимки/опис → попълнена карта „Нов имот“); collect = Събиране на имоти и клиенти (сайтове, Старт/Стоп, Постави пост, Събрани); mail = настройка на „Моята поща за изпращане“ (ABV, Gmail…); video = AI Видео на имот.",
    parameters: { type: "OBJECT", properties: { panel: { type: "STRING", enum: ["upload", "collect", "mail", "video"] } }, required: ["panel"] } };
  const collect = { name: "collect_page", description: "Събиране от конкретен източник: чете публична страница с обяви (url) или поставен текст на пост от група (text) и пази само частните обяви без агенции (с телефон) и хората, които търсят/предлагат. Записва ги в „Събрани“.",
    parameters: { type: "OBJECT", properties: { url: { type: "STRING" }, text: { type: "STRING" }, source: { type: "STRING", description: "напр. Facebook, OLX, Имоти.бг" }, keywords: { type: "STRING", description: "ключови думи, по подразбиране: без посредник, от собственик, без комисионна, лично" } } } };
  if (staff) return web.concat([panel, collect, { name: "find_owner_listings", description: "Намира в интернет обяви на имоти ОТ СОБСТВЕНИЦИ (без агенции) за всяко село, град или област в България: заглавие, цена, площ, телефон (ако е публикуван в обявата), линк, източник. Записва ги в „Събрани“. Ползвай при „намери имоти/къщи/апартаменти от собственик в …“, „дай телефоните и цените“.",
    parameters: { type: "OBJECT", properties: { place: { type: "STRING", description: "Село или град, напр. „Ново село“" }, region: { type: "STRING", description: "Област, напр. „Велико Търново“" }, type: { type: "STRING", description: "къща, апартамент, парцел, вила, земя…" }, deal: { type: "STRING", enum: ["sale", "rent"] }, max_price: { type: "NUMBER" } } } }, { name: "crm", description: "Изпълнява CRM инструмент от списъка и връща резултата като JSON.",
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
      if (a.tool === "email.preview" && j.ok && j.result && j.result.draft_saved) { ctx.email = j.result; if (!j.result.can_send) ctx.ui = { panel: "mail" }; }
      if (a.tool === "email.send" && j.ok && j.result && j.result.need_setup) ctx.ui = { panel: "mail" };
      if (j && j.ok && j.result && j.result.start_video) ctx.video = j.result.start_video; else if (j && j.start_video) ctx.video = j.start_video;
      return j;
    }
    if (call.name === "open_panel") { if (!ctx.staff) return { ok: false, error: "Само за служители" }; const p = ["upload", "collect", "mail", "video"].includes(a.panel) ? a.panel : "upload"; ctx.ui = { panel: p }; ctx.actions.push("отворено: " + ({ upload: "АИ Качване на имот", collect: "Събиране на имоти и клиенти", mail: "Моята поща", video: "AI Видео" })[p]); return { ok: true, opened: p, note: "Панелът се показва под отговора в чата." }; }
    if (call.name === "collect_page") {
      if (!ctx.staff) return { ok: false, error: "Само за служители" };
      if (!a.url && !a.text) return { ok: false, error: "Дай линк (url) или текст на поста (text)." };
      const r = await fetch(ctx.origin + "/api/collect", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + ctx.token }, body: JSON.stringify({ url: a.url || "", text: a.text || "", source: a.source || "", keywords: a.keywords || "без посредник, от собственик, без комисионна, лично", properties: true, clients: true }) });
      const j = await r.json().catch(() => ({ ok: false, error: "HTTP " + r.status }));
      ctx.actions.push("събиране: " + String(a.url || a.source || "пост").replace(/^https?:\/\//, "").slice(0, 40));
      let saved = 0;
      if (j && j.ok && Array.isArray(j.items) && j.items.length) {
        /* запис в „Събрани“ (nd_collected) без дубликати – същият ключ като в умението: телефон + текст */
        try {
          const nk = (x) => String(x.phone || "").split(",")[0].trim() + "|" + String(x.text || x.title || "").toLowerCase().replace(/[^a-zа-я0-9]+/gi, " ").trim().slice(0, 120);
          const ex = await fetch(SB_URL + "/rest/v1/nd_collected?select=data", { headers: { apikey: SB_KEY, Authorization: "Bearer " + ctx.token } }).then((r2) => r2.ok ? r2.json() : []);
          const have = new Set((ex || []).map((r2) => nk(r2.data || {})));
          const rows = j.items.filter((x) => !have.has(nk(x))).map((x) => ({ name: x.title || x.name || "Обява", data: Object.assign({}, x, { source: a.source || x.source || "", found_by: "Тед" }) }));
          if (rows.length) { const w = await fetch(SB_URL + "/rest/v1/nd_collected", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + ctx.token, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(rows) }); if (w.ok) saved = rows.length; }
        } catch (e) {}
        if (!ctx.ui) ctx.ui = { panel: "collect" };
      }
      return j && j.ok ? { ok: true, found: (j.items || []).length, saved_to_collected: saved, skipped: j.skipped || {}, items: (j.items || []).slice(0, 20).map((x) => ({ kind: x.kind, title: x.title, price: x.price, city: x.city, hood: x.hood, phone: x.phone, name: x.name, link: x.link, wants: x.wants || undefined })), note: "Записани са в „Събрани“; оттам „Запамети в архив“ ги прехвърля в Имоти/Клиенти. Панелът „Събиране“ се показва под отговора." } : j;
    }
    if (call.name === "web_search") { const r = await WEB.webSearch(a.query || ""); ctx.actions.push("интернет: " + String(a.query || "").slice(0, 40)); (ctx.sources = ctx.sources || []).push(...r.sources); return { ok: true, ...r }; }
    if (call.name === "find_owner_listings") { if (!ctx.staff) return { ok: false, error: "Само за служители" }; const r = await OWNERS.findOwners(ctx, a); ctx.actions.push("обяви от собственици: " + [a.place, a.region].filter(Boolean).join(", ").slice(0, 40)); (r.items || []).slice(0, 8).forEach((x) => { if (x.link) (ctx.sources = ctx.sources || []).push({ title: x.title || x.source, url: x.link }); }); return r; }
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
  const T0 = Date.now();
  /* OIDC токенът на проекта: Vercel AI Gateway работи с него без отделен ключ (резерва, ако Gemini е изчерпан) */
  if (!process.env.VERCEL_OIDC_TOKEN && req.headers["x-vercel-oidc-token"]) process.env.VERCEL_OIDC_TOKEN = String(req.headers["x-vercel-oidc-token"]);
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  const auth = String(req.headers["authorization"] || ""); const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const user = await staffOf(token).catch(() => null);
  if (!user) return send(res, 401, { ok: false, error: "Тед Асистент работи само в CRM – влезте в профила си." });
  /* списък с моделите, за които има ключ (за менюто в чата) */
  if (b.action === "owners") { /* проверка на инструмента без чат */ return send(res, 200, await OWNERS.findOwners({ token, staff: true, origin: "https://" + (req.headers["x-forwarded-host"] || req.headers.host || "imotinadezhda.bg") }, b)); }
  if (b.action === "models") return send(res, 200, { ok: true, models: LLM.catalog().map((m) => ({ id: m.id, name: m.name, note: m.note, provider: m.provider, vision: m.vision, pdf: m.pdf })), modes: MODES.list(), n8n: process.env.N8N_AGENT_URL ? String(process.env.N8N_AGENT_URL) : null });
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
  let voiceErr = "";
  if (audio) {
    try { transcript = await GEM.transcribe(audio, "Транскрибирай дословно гласовото съобщение (най-често на български). Върни САМО текста, без кавички и коментари. Имената на квартали, улици и хора пиши правилно. Ако няма говор, върни празен низ.", { budgetMs: 25000 }); }
    catch (e) { transcript = ""; voiceErr = e.quota ? "Лимитът на Gemini за разпознаване на глас е изчерпан – опитайте след минута или напишете съобщението." : "Разпознаването на гласа не успя (" + String(e.message || e).slice(0, 120) + ")."; }
    if (!transcript) return send(res, 200, { ok: true, text: voiceErr || "Не успях да чуя ясно съобщението – опитайте отново, по-близо до микрофона.", transcript: "", actions: [], staff: ctx.staff });
    lastMsg.text = transcript + (lastMsg.text && lastMsg.text !== "(гласово съобщение)" ? "\n" + lastMsg.text : "");
    lastMsg.files = lastMsg.files.filter((f) => f !== audio);
  }
  const clean = msgs.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", text: String(m.text || "").slice(0, 8000), files: (Array.isArray(m.files) ? m.files : []).slice(0, 3).filter((f) => f && f.data && /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.mime)).map((f) => ({ mime: f.mime, data: f.data })) }))
    .filter((c, i0) => !(i0 === 0 && c.role === "assistant"));
  if (!clean.length) return send(res, 400, { ok: false, error: "Празно съобщение" });
  /* памет + казус + експертен режим (само за служители) */
  const caseId = ctx.staff && b.case_id ? String(b.case_id).slice(0, 64) : null;
  const lastUser = clean.filter((m) => m.role === "user").slice(-1)[0];
  /* експертната роля: избраната в чата или разпозната от въпроса (всички роли са вградени в „Чат с Тед“) */
  const mode = ctx.staff ? (String(b.mode || "").slice(0, 32) || MODES.detect(lastUser ? lastUser.text : "")) : "";
  const mem = ctx.staff ? await MEM.load(ctx.token, user.id, caseId, lastUser ? lastUser.text : "") : { enabled: false, facts: [], recent: [], related: [] };
  const system = systemPrompt(ctx.staff, user || {}, b.page) + (ctx.staff ? MODES.ALL : "") + MODES.prompt(mode) + MEM.contextText(mem, user) + (caseId && mem.kase ? "\nТекущ case_id: " + caseId + " (подавай го на memory.remember за факти по казуса)." : "");
  const convo = caseId && mem.kase && mem.recent.length ? MEM.historyMsgs(mem).concat(clean.slice(-1)) : clean;
  const tools = declarations(ctx.staff);
  /* „Да“ след подготвен имейл → изпраща се веднага (без AI – бързо, без лимит, точно показаното) */
  const AFFIRM = /^\s*(да|да,?\s*(изпрати|прати|изпращай|го изпрати|го прати)(\s+го)?|изпрати(\s+го)?|прати(\s+го)?|ок|окей|потвърждавам|давай|yes)\s*[.!]*\s*$/i;
  const prevA = convo.filter((m) => m.role === "assistant").slice(-1)[0];
  if (ctx.staff && lastUser && AFFIRM.test(lastUser.text || "") && !(lastUser.files || []).length && prevA && /изпратя ли/i.test(prevA.text || "")) {
    const r = await fetch(ctx.origin + "/api/tools", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + ctx.token }, body: JSON.stringify({ tool: "email.send", input: { confirm: true } }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({ ok: false, error: "HTTP " + r.status })) : { ok: false, error: "няма връзка" };
    const res2 = j.ok && j.result ? j.result : null;
    const out = res2 && res2.sent ? "✔ Изпратено до " + (res2.to_name ? res2.to_name + " <" + res2.to + ">" : res2.to) + " от " + res2.from + (res2.via && /агенцията/.test(res2.via) ? " (" + res2.via + ")" : "") + ".\nТема: " + res2.subject + (res2.attachments && res2.attachments.length ? "\nПрикачени: " + res2.attachments.join(", ") : "")
      : res2 && res2.need_setup ? res2.reason + (res2.mailto ? "\n[Изпрати от моята поща](" + res2.mailto + ")" : "") : "Имейлът не е изпратен: " + ((j && j.error) || "грешка");
    if (mem.enabled) await MEM.save(ctx.token, user.id, caseId, lastUser.text, out, { meta: { tool: "email.send" } }).catch(() => null);
    return send(res, 200, { ok: true, text: out, transcript, actions: ["email.send" + (res2 && res2.sent ? "" : " ✗")], staff: true, ui: res2 && res2.need_setup ? { panel: "mail" } : null });
  }
  /* избраният модел (Gemini сам минава по всички живи Gemini модели), после другите доставчици с ключ: при изчерпан лимит Тед не спира */
  const order = [chosen];
  if (chosen.provider !== "gemini") { const g = LLM.catalog().find((m) => m.provider === "gemini"); if (g) order.push(g); }
  LLM.catalog().filter((m) => m.provider !== "gemini" && m.id !== chosen.id && !order.some((o) => o.id === m.id)).forEach((m) => order.push(m));
  /* действия, които променят данни: след тях не сменяме модела (за да не се повтори запис или изпращане) */
  const MUTATING = /\.(create|update|delete|set_status|add_note|send|generate|merge|split|translate|bank_statements_pack|create_pdf|assign|remember|mark_paid|add_employee|attach)$|^video\.|^събиране/;
  const T_END = T0 + 108000; /* лимитът на функцията е 120 s */
  let lastErr = "", quota = false;
  for (const model of order) {
    const left = T_END - Date.now(); if (left < 8000) break;
    let real = null;
    try {
      const text = await LLM.chat(model, { system, msgs: convo, tools, run: (c) => runTool(c, ctx), budgetMs: Math.min(80000, left - 6000), onModel: (id) => { real = id; } });
      if (text === null) return send(res, 200, { ok: true, text: "Задачата изисква твърде много стъпки – разделете я на по-малки.", actions: ctx.actions, staff: ctx.staff, model: model.id, ui: ctx.ui || null });
      const out = text || "Не успях да формулирам отговор – опитайте отново.";
      if (ctx.staff && mem.enabled && lastUser) { await MEM.save(ctx.token, user.id, caseId, lastUser.text, out, { meta: { mode: mode || null, model: real || model.id } }).catch(() => null); if (caseId && mem.kase) await MEM.maybeSummarize(ctx.token, caseId, LLM).catch(() => null); }
      /* бележка под отговора само когато наистина е отговорил друг доставчик (напр. лимитът на Gemini е изчерпан) */
      const note = model.provider !== chosen.provider ? (quota ? "Лимитът на " + chosen.name + " е изчерпан – отговори " + model.name : chosen.name + " не отговори – отговори " + model.name) : null;
      return send(res, 200, { ok: true, text: out + (ctx.sources && ctx.sources.length ? "\n\nИзточници:\n" + ctx.sources.filter((x, i0, a) => x.url && a.findIndex((y) => y.url === x.url) === i0).slice(0, 6).map((x) => "• " + (x.title || x.url) + " – " + x.url).join("\n") : ""), transcript, actions: ctx.actions, staff: ctx.staff, listings: ctx.listings || null, video: ctx.video || null, ui: ctx.ui || null, email: ctx.email || null, mode: mode || null, model: real || model.id, model_name: model.name, fallback: note });
    } catch (e) { lastErr = String(e.message || e); if (e.quota) quota = true; if (ctx.actions.some((a) => MUTATING.test(String(a).replace(/ ✗$/, "")))) break; }
  }
  /* безплатен лимит: презарежда се сам – без съобщения за плащане */
  if (quota || /credit|billing|payment|funds|purchase|quota|exhaust|limit|кредит/i.test(lastErr)) return send(res, 200, { ok: false, quota: true, error: "Безплатният лимит на Gemini за момента е изчерпан – презарежда се автоматично. Опитайте отново след минута." });
  try { require("./_monitor.js").report({ event: "assistant_error", errorCode: quota ? "quota" : "assistant_failed", endpoint: "/api/assistant", requestId: String(req.headers["x-vercel-id"] || "") }); } catch (e2) {}
  return send(res, 502, { ok: false, error: "AI асистентът не отговори: " + lastErr });
};
