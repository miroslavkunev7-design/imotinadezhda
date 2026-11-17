// The gate of the Real GPT agent (docs/CONTRACT.md §9.3): the model can never approve its own writes.
// Every CRM call is classified here from the REAL tool name and input (never from model text):
//   auto      – reads (and email.preview, which only prepares a draft) run without a card
//   generate  – files made into Ted's own folder „Тед“ (PDFs, downloaded photos) without any CRM target
//   approval  – every other write: an in-app ApprovalCard (allow / deny / allow for the rest of this answer)
//   confirm   – destructive or publishing tools: the card AND the native Windows dialog; MAIN injects confirm:true
//   never     – email.send (only through the EmailCard), cases.log_turn, video.create (the video flow owns it)
//   ai        – tools whose server code runs ANOTHER artificial intelligence (Gemini, Vercel AI Gateway, …): Real GPT
//               uses only the employee's ChatGPT plan, so these are not offered and are refused here (CONTRACT §9.6)
import { isMutating } from "../backend/tools.js";

export const NEVER = new Set(["email.send", "cases.log_turn", "video.create"]);

// Server tools that call another AI, checked against the server code (api/_ted-skills.js, api/_owners.js,
// api/collect.js, api/_nc-import.js, api/scan.js – see CONTRACT §9.6). Value = what GPT does instead (told to the
// model when it still names one). They never reach /api/tools from Real GPT: not in the tool list, refused by
// classify() and by the guarded transport (guardTools) as a third layer.
export const SERVER_AI = new Map([
  ["documents.extract_text", "Прочети файла сам: прикачените снимки и PDF са приложени към съобщението, а Word/Excel/CSV/текст – с read_document. Документ от CRM: documents.download_link, после read_document."],
  ["documents.translate", "Преведи текста сам (прочети го с read_document или от приложения PDF/снимка) и върни превода с create_document."],
  ["documents.bank_statements_pack", "Намери извлеченията с documents.find, провери периодите сам (documents.download_link + read_document) и ги обедини с documents.merge."],
  ["images.generate", "Снимки не се правят оттук: подготви точна заявка и я покажи с open_in_chatgpt (kind:\"image\") – служителят я отваря в ChatGPT със своя план."],
  ["analyze_image", "Разгледай снимката сам – прикачените снимки са приложени към съобщението."],
  ["analyze_document", "Прочети документа сам – прикачените PDF и снимки са приложени към съобщението, другите файлове се четат с read_document."],
  ["listings.find_owners", "Търси сам: web_search и read_page в страниците с обяви (imot.bg, olx.bg, alo.bg …) и прецени по текста кои са от собственици."],
  ["listings.collect_page", "Прочети страницата с read_page и подбери обявите сам; покажи ги в отговора."],
  ["video.create", "Видео не се прави оттук: подготви заявката и я покажи с open_in_chatgpt (kind:\"video\")."],
  ["imports.start", "Импортът на ново строителство разпознава файловете с AI на сървъра – направете го в CRM на сайта."],
  ["jobs.status", "Състоянието на задачи следи с models.get, tour.get или jobs.result (jobs.status може да продължи AI обработка на сървъра)."],
]);
// Inputs that switch an otherwise plain server tool to AI work: MAIN always sends these values in Real GPT.
// documents.merge delegates to filesToPdf on the server, which classifies with Gemini when group_by_type is set – today
// the server drops the key, but purity must not depend on a server-side input list (review).
export const AI_OFF_INPUT = { "documents.inspect": { classify: false }, "files.to_pdf": { group_by_type: false }, "documents.merge": { group_by_type: false } };
export const AI_REFUSED = "Този инструмент ползва друг изкуствен интелект на сървъра на Тед и не е достъпен в Real GPT (само вашият ChatGPT план).";

// The same name as the server would read it, plus the spellings a model might try (case, spaces, invisible
// characters, "-", "/", "_" instead of the dot). Only for refusing: an unknown name never reaches the server anyway.
export function canonicalTool(tool) {
  return String(tool == null ? "" : tool).normalize("NFKC").replace(/[\s​-‏⁠﻿]+/g, "").toLowerCase();
}
const squash = (s) => s.replace(/[._/\\:-]+/g, "");
const AI_KEYS = new Map([...SERVER_AI.keys()].map((n) => [squash(n), n]));
// -> the server-AI tool a name means (any spelling), or null.
export function serverAiName(tool) {
  const c = squash(canonicalTool(tool));
  return AI_KEYS.get(c) || AI_KEYS.get(c.replace(/^ted/, "")) || null;
}
export const isServerAi = (tool) => serverAiName(tool) !== null;
// -> null when the call may go out, else the function output for the model.
export function aiRefusal(tool, input) {
  const name = String(tool || "");
  const ai = serverAiName(name);
  if (ai) return { ok: false, error: AI_REFUSED, instead: SERVER_AI.get(ai) };
  const off = AI_OFF_INPUT[name];
  if (off && input && typeof input === "object") {
    for (const [k, v] of Object.entries(off)) if (k in input && boolPresent(input[k]) !== v) return { ok: false, error: AI_REFUSED, instead: `Изпрати го без ${k} – прецени съдържанието сам.` };
  }
  return null;
}
// The AI switches of AI_OFF_INPUT set to their plain value (a copy; other tools unchanged).
export function aiOff(tool, input) {
  const off = AI_OFF_INPUT[String(tool || "")];
  if (!off || !input || typeof input !== "object" || Array.isArray(input)) return input;
  return { ...input, ...off };
}
// The CRM transport handed to the agent: a server-AI tool (any spelling) or an AI switch never leaves this computer.
export function guardTools(tools) {
  return {
    ...tools,
    call: async (tool, input) => {
      const refused = aiRefusal(tool, input);
      if (refused) return { ok: false, error: `${refused.error} ${refused.instead}`, code: "ai_refused", maybeExecuted: false };
      return tools.call(tool, input);
    },
  };
}
export const CONFIRM = new Set([
  "clients.delete", "calendar.delete", "properties.set_status", "units.set_status", "projects.publish", "projects.archive",
  "projects.mark_reviewed", "projects.set_media", "imports.apply", "models.publish", "models.unpublish", "tour.publish",
  "tour.unpublish", "interior.approve",
]);
// Reads by nature, whatever their names say (CONTRACT §9.3 rule 1).
// (documents.inspect only without `classify` – AI_OFF_INPUT.)
export const AUTO_EXTRA = new Set([
  "email.preview", "documents.inspect", "contacts.resolve", "audit.recent", "nc.help", "projects.list", "projects.get",
  "units.list", "units.get", "models.get", "tour.get", "jobs.result", "memory.search", "documents.download_link",
]);
// Files made into Ted's own folder „Тед“ without a CRM target; none of them runs an AI (files.to_pdf only without
// `group_by_type`). images.generate and documents.translate ran Gemini/AI Gateway – they are SERVER_AI now.
export const GENERATE = new Set(["images.download", "documents.merge", "documents.split", "documents.create_pdf", "files.to_pdf"]);
// Rule 3 by name even if a future server rule would call them reads.
export const ALWAYS_APPROVAL = new Set(["files.attach", "documents.attach", "memory.remember", "memory.forget", "contracts.generate"]);
const TARGET_KEYS = ["client_id", "client_name", "property_id", "property_code", "doc_id", "doc_ids"];

const hasValue = (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length);

// The server's schema coerces booleans (api/_ted-skills.js: `v === true || v === "true" || v === 1`), so the gate must
// read them the same way – and a little wider ("1"), so that no spelling the server may accept slips past a card.
// Booleans that decide the class of a call; MAIN sends the normalised boolean, never the model's spelling.
export const GATE_BOOLEANS = ["save_to_property"];
export const asBool = (v) => v === true || v === "true" || v === 1 || v === "1";
const boolPresent = (v) => v !== undefined && v !== null && v !== "" && v !== false && v !== "false" && v !== 0 && v !== "0";

// -> a copy of the input with every GATE_BOOLEANS key as a real boolean (absent/empty keys stay absent).
export function normalizeInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const out = { ...input };
  for (const k of GATE_BOOLEANS) {
    if (!(k in out)) continue;
    if (out[k] === undefined || out[k] === null || out[k] === "") delete out[k];
    else out[k] = asBool(out[k]) || boolPresent(out[k]);
  }
  return out;
}

// Mirrors the server's chatSources (api/_ted-skills.js): a bare string that is not a storage path of the chat/CRM
// folders nor an http(s) URL is taken as a CRM document id, and so is an object with document_id/doc_id, or with id
// but no path/url. A CRM document as the source files the result at that document's client → a card.
// "file:<id>" refs are files of this program (uploads.js turns them into ted-chat/ paths).
const STORAGE_PATH = /^(ted-chat|clients|properties|ted|nd-files)\//;
const LOCAL_REF = /^file:[a-z0-9_-]{8,64}$/;
export function isDocSource(f) {
  if (typeof f === "string") {
    if (!f || LOCAL_REF.test(f)) return false;
    return !(STORAGE_PATH.test(f) || /^https?:/i.test(f));
  }
  if (f && typeof f === "object" && !Array.isArray(f)) {
    if (hasValue(f.document_id) || hasValue(f.doc_id)) return true;
    return !(f.path || f.url || f.download_url) && hasValue(f.id);
  }
  return false;
}

// Removes every model-supplied `confirm` (at any depth of plain objects).
export function stripConfirm(input) {
  if (Array.isArray(input)) return input.map(stripConfirm);
  if (!input || typeof input !== "object") return input;
  const out = {};
  for (const [k, v] of Object.entries(input)) if (k !== "confirm") out[k] = stripConfirm(v);
  return out;
}

// -> "auto" | "generate" | "approval" | "confirm" | "never" | "ai"
export function classify(tool, input = {}) {
  const name = String(tool || "");
  if (NEVER.has(name)) return "never";
  if (aiRefusal(name, input)) return "ai";
  if (CONFIRM.has(name)) return "confirm";
  if (ALWAYS_APPROVAL.has(name)) return "approval";
  if (GENERATE.has(name)) {
    const i = input && typeof input === "object" ? input : {};
    const saves = boolPresent(i.save_to_property);
    if (saves) return "approval";
    for (const k of TARGET_KEYS) if (hasValue(i[k])) return "approval";
    // A CRM document as the source files the result at that document's client (files.to_pdf with doc_ids,
    // files:["<uuid>"], files:[{id}], paths:["<uuid>"] …) – the same reading as the server's chatSources.
    for (const k of ["files", "paths"]) if (Array.isArray(i[k]) && i[k].some(isDocSource)) return "approval";
    return "generate";
  }
  if (AUTO_EXTRA.has(name) || !isMutating(name)) return "auto";
  return "approval";
}

// A refusal that asks for confirmation before anything ran: HTTP 412, or HTTP 400 with an issue at ["confirm"].
export function asksConfirm(result) {
  if (!result || result.ok) return false;
  if (result.status === 412) return true;
  return result.status === 400 && Array.isArray(result.issues) && result.issues.some((i) => Array.isArray(i && i.path) && i.path.length === 1 && i.path[0] === "confirm");
}

// ---- Bulgarian labels for steps and cards (built from the real tool name and input) ------------------------

// In Real GPT the one who asks is the employee's own ChatGPT (Тед is only the program and its tools – review (c)).
export const AGENT_NAME = "ChatGPT";

const GROUPS = {
  clients: "клиенти", properties: "имоти", calendar: "календар", deals: "сделки", companies: "фирми", brokers: "брокери",
  documents: "документи", calc: "калкулатор", rates: "курсове", reports: "справки", rentals: "наеми", inquiries: "запитвания",
  collected: "събрани", images: "снимки", files: "файлове", contacts: "контакти", email: "имейл", contracts: "договори",
  video: "видео", memory: "памет", cases: "проекти", audit: "одит", listings: "обяви", nc: "ново строителство",
  projects: "ново строителство", buildings: "сгради", floors: "етажи", units: "обекти", imports: "импорт", jobs: "задачи",
  interior: "интериор", tour: "тур", tours: "турове", cad: "чертежи", models: "3D модели",
};
const ACTIONS = {
  search: "търсене", get: "преглед", create: "създаване", update: "промяна", delete: "изтриване", add_note: "бележка",
  set_status: "статус", match: "съвпадения", list: "списък", download_link: "линк", mortgage: "ипотека", commission: "комисиона",
  yield: "доходност", live: "днес", summary: "обобщение", find: "намиране", inspect: "проверка", merge: "обединяване",
  split: "разделяне", extract_text: "текст", translate: "превод", bank_statements_pack: "банкови извлечения", create_pdf: "PDF",
  mark_paid: "плащане", add_employee: "служител", download: "изтегляне", generate: "генериране", attach: "запис на файл",
  to_pdf: "към PDF", resolve: "контакт", preview: "чернова", send: "изпращане", remember: "запомняне", forget: "забравяне",
  recent: "последни", find_owners: "търсене на собственици", collect_page: "събиране от страница", help: "помощ",
  assign: "възлагане", publish: "публикуване", unpublish: "сваляне", archive: "архив", mark_reviewed: "прегледан",
  set_media: "медия", create_draft: "чернова", upsert: "запис", start: "старт", status: "състояние", result: "резултат",
  cancel: "отказ", apply: "прилагане", approve: "одобрение", render: "изобразяване", report: "отчет", edit: "редакция",
  validate: "проверка", request: "заявка",
};
const SPECIAL = { analyze_image: "анализ на снимка", analyze_document: "анализ на документ" };

export function toolLabel(tool) {
  const name = String(tool || "");
  if (SPECIAL[name]) return SPECIAL[name];
  const [g, a] = name.split(".");
  return a ? `${GROUPS[g] || g}.${ACTIONS[a] || a}` : name;
}

const KEY_LABELS = {
  name: "Име", full_name: "Име", phone: "Телефон", email: "Имейл", client_name: "Клиент", client_id: "Клиент (id)",
  property_code: "Имот", property_id: "Имот (id)", title: "Заглавие", text: "Текст", note: "Бележка", status: "Статус",
  price: "Цена", city: "Град", hood: "Квартал", address: "Адрес", start: "Начало", end: "Край", at: "Кога", date: "Дата",
  when: "Кога", query: "Търсене", id: "Запис (id)", path: "Файл", files: "Файлове", type: "Вид", kind: "Вид", amount: "Сума",
  budget: "Бюджет", cat: "Категория", description: "Описание", fields: "Полета", target: "Език", prompt: "Описание",
  place: "Място", region: "Област", url: "Адрес", folder: "Папка", doc_ids: "Документи", case_id: "Казус", to_email: "До",
  subject: "Тема", body: "Текст", source_path: "Снимка", aspect: "Формат",
  // 0.1.5 property upload: every field of properties.create in Bulgarian on the card.
  deal: "Сделка", area: "Площ (м²)", rooms: "Стаи", beds: "Спални", baths: "Бани", floor: "Етаж", desc: "Описание",
  cond: "Състояние", client: "Собственик", urls: "Снимки", page_url: "Страница", max: "Най-много",
};

// Values the employee must read on a card in Bulgarian, not as machine words (review: „Сделка: sale“, „Цена: 99000“).
const VALUE_LABELS = {
  deal: { sale: "продажба", rent: "наем" },
  cat: { sales: "продажби", rent: "наеми" },
};
const MONEY_KEYS = new Set(["price", "budget", "amount"]);
const money = (n) => `${new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 2 }).format(n).replace(/\u00a0/g, " ")} €`;
function valueLabel(k, v) {
  if (typeof v === "string" && VALUE_LABELS[k] && VALUE_LABELS[k][v]) return VALUE_LABELS[k][v];
  if (MONEY_KEYS.has(k) && (typeof v === "number" || (typeof v === "string" && /^\d+(\.\d+)?$/.test(v))) && Number.isFinite(Number(v))) return money(Number(v));
  if (k === "area" && (typeof v === "number" || (typeof v === "string" && /^\d+(\.\d+)?$/.test(v)))) return `${String(v).replace(".", ",")} м²`;
  return v;
}

// A value on the card: never silently cut – a long value ends with „…(още N знака)“ and the card also carries the
// exact JSON (approvalJson) behind „Точните данни“.
export const LINE_MAX = 300;
const short = (v, max = LINE_MAX) => {
  let s = typeof v === "string" ? v : JSON.stringify(v);
  if (s === undefined) s = String(v);
  s = s.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…(още ${s.length - max} знака)` : s;
};

// Identifying and target fields first, whatever order the model chose.
const FIRST = ["id", "client_id", "client_name", "property_id", "property_code", "doc_id", "doc_ids", "to", "to_email", "email", "phone", "name", "full_name", "save_to_property"];
const rank = (k) => { const i = FIRST.indexOf(k); return i < 0 ? FIRST.length : i; };

// [[label, value]] of EVERY field of an input (identifying/target fields first; file paths shown by name). Past
// `max` lines one more line says how many fields are left – they are in approvalJson.
export function inputLines(input, max = 40) {
  const entries = Object.entries(input && typeof input === "object" ? input : {})
    .filter(([k, v]) => k !== "confirm" && v !== undefined && v !== null && v !== "")
    .map((e, i) => [e, i])
    .sort((a, b) => rank(a[0][0]) - rank(b[0][0]) || a[1] - b[1])
    .map(([e]) => e);
  const lines = [];
  for (const [k, v] of entries.slice(0, max)) {
    let value = v;
    if (Array.isArray(v) && v.every((x) => x && typeof x === "object" && (x.name || x.path))) value = v.map((x) => x.name || String(x.path).split("/").pop()).join(", ");
    else if (Array.isArray(v) && v.length && v.every((x) => typeof x === "string")) value = v.join(", ");
    else value = valueLabel(k, v);
    lines.push([KEY_LABELS[k] || k, short(value)]);
  }
  if (entries.length > max) lines.push(["…", `още ${entries.length - max} полета – вижте „Точните данни“`]);
  return lines;
}

// The exact input that will be sent (pretty JSON) for the card's „Точните данни“; a cut is always marked.
export const JSON_MAX = 20_000;
export function approvalJson(input, max = JSON_MAX) {
  let s;
  try { s = JSON.stringify(input === undefined ? {} : input, null, 2); } catch { s = "{}"; }
  return s.length > max ? `${s.slice(0, max)}\n…(още ${s.length - max} знака)` : s;
}

const VERB = {
  create: "да създаде", update: "да промени", delete: "да изтрие", add_note: "да добави бележка", set_status: "да смени статуса",
  attach: "да запише файл в CRM", remember: "да запомни", forget: "да забрави", generate: "да направи", mark_paid: "да отбележи плащане",
  assign: "да възложи", publish: "да публикува", unpublish: "да свали от сайта", archive: "да архивира", apply: "да приложи",
  approve: "да одобри", find_owners: "да потърси собственици и да ги запише в „Събрани“", collect_page: "да събере обяви в „Събрани“",
};

// The card's title from the real tool and input. extra.photos = photos of this computer going into a gallery.
export function approvalTitle(tool, input, extra) {
  const name = String(tool || "");
  const i = input && typeof input === "object" ? input : {};
  const code = typeof i.property_code === "string" && i.property_code ? i.property_code.slice(0, 40) : "";
  if (name === "images.download") {
    const n = extra && extra.photos;
    if (n) return `${AGENT_NAME} иска да добави ${n === 1 ? "1 снимка" : `${n} снимки`} в галерията${code ? ` на имот ${code}` : " на имот"}`;
    return `${AGENT_NAME} иска сървърът на Тед да изтегли снимки${code ? ` в галерията на имот ${code}` : ""}`;
  }
  if (name === "cases.create") return `${AGENT_NAME} иска да създаде проект „${short(i.title || "без име", 80)}“`;
  if (name === "files.attach" && (code || i.client_name || i.client_id)) return `${AGENT_NAME} иска да запише файл в CRM при ${code ? `имот ${code}` : `клиент ${short(i.client_name || i.client_id, 80)}`}`;
  const [g, a] = name.split(".");
  const verb = VERB[a];
  return verb ? `${AGENT_NAME} иска ${verb}: ${GROUPS[g] || g}` : `${AGENT_NAME} иска да изпълни действие в CRM: ${toolLabel(tool)}`;
}
