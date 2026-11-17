// The gate of the Real GPT agent (docs/CONTRACT.md §9.3): the model can never approve its own writes.
// Every CRM call is classified here from the REAL tool name and input (never from model text):
//   auto      – reads (and email.preview, which only prepares a draft) run without a card
//   generate  – files made into Ted's own folder „Тед“ (images, translations, PDFs) without any CRM target
//   approval  – every other write: an in-app ApprovalCard (allow / deny / allow for the rest of this answer)
//   confirm   – destructive or publishing tools: the card AND the native Windows dialog; MAIN injects confirm:true
//   never     – email.send (only through the EmailCard), cases.log_turn, video.create (the video flow owns it)
import { isMutating } from "../backend/tools.js";

export const NEVER = new Set(["email.send", "cases.log_turn", "video.create"]);
export const CONFIRM = new Set([
  "clients.delete", "calendar.delete", "properties.set_status", "units.set_status", "projects.publish", "projects.archive",
  "projects.mark_reviewed", "projects.set_media", "imports.apply", "models.publish", "models.unpublish", "tour.publish",
  "tour.unpublish", "interior.approve",
]);
// Reads by nature, whatever their names say (CONTRACT §9.3 rule 1).
export const AUTO_EXTRA = new Set([
  "email.preview", "documents.inspect", "documents.extract_text", "analyze_image", "analyze_document", "contacts.resolve",
  "audit.recent", "nc.help", "projects.list", "projects.get", "units.list", "units.get", "models.get", "tour.get", "jobs.status",
  "jobs.result", "memory.search", "documents.download_link",
]);
export const GENERATE = new Set(["images.generate", "images.download", "documents.translate", "documents.merge", "documents.split", "documents.create_pdf", "files.to_pdf"]);
// Rule 3 by name even if a future server rule would call them reads.
export const ALWAYS_APPROVAL = new Set(["files.attach", "documents.attach", "memory.remember", "memory.forget", "contracts.generate", "documents.bank_statements_pack", "listings.find_owners", "listings.collect_page"]);
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

// -> "auto" | "generate" | "approval" | "confirm" | "never"
export function classify(tool, input = {}) {
  const name = String(tool || "");
  if (NEVER.has(name)) return "never";
  if (CONFIRM.has(name)) return "confirm";
  if (ALWAYS_APPROVAL.has(name)) return "approval";
  if (GENERATE.has(name)) {
    const i = input && typeof input === "object" ? input : {};
    const saves = boolPresent(i.save_to_property);
    if (saves) return "approval";
    for (const k of TARGET_KEYS) {
      if (!hasValue(i[k])) continue;
      // images.generate may READ a property photo (property_code + photo_index) as long as nothing is saved there.
      if (name === "images.generate" && k === "property_code" && !saves) continue;
      return "approval";
    }
    // A CRM document as the source files the result at that document's client (documents.translate with doc_id,
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

const GROUPS = {
  clients: "клиенти", properties: "имоти", calendar: "календар", deals: "сделки", companies: "фирми", brokers: "брокери",
  documents: "документи", calc: "калкулатор", rates: "курсове", reports: "справки", rentals: "наеми", inquiries: "запитвания",
  collected: "събрани", images: "снимки", files: "файлове", contacts: "контакти", email: "имейл", contracts: "договори",
  video: "видео", memory: "памет", cases: "казуси", audit: "одит", listings: "обяви", nc: "ново строителство",
  projects: "проекти", buildings: "сгради", floors: "етажи", units: "обекти", imports: "импорт", jobs: "задачи",
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
};

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

export function approvalTitle(tool) {
  const [g, a] = String(tool || "").split(".");
  const verb = VERB[a];
  return verb ? `Тед иска ${verb}: ${GROUPS[g] || g}` : `Тед иска да изпълни действие в CRM: ${toolLabel(tool)}`;
}
