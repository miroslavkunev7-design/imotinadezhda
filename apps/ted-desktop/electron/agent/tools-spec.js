// Function tools of the Real GPT agent (docs/CONTRACT.md §9.2): one namespace "ted" holding the CRM gateway and
// the local functions. Official form: developers.openai.com/api/docs/guides/tools (namespace tool). No
// defer_loading (tool_search is not supported on the plan route). strict:false – MAIN validates every argument.
import { NEVER } from "./gate.js";

export const NAMESPACE = "ted";
export const NAMESPACE_DESCRIPTION = "Ръцете на Тед: CRM „Имоти Надежда“, интернет, документи, снимки, видео";

// The server's STAFF_TOOLS (api/assistant.js, incl. _ted-skills and new-construction tools) as of 0.1.3. The
// agent offers only names that are both here and in the live GET /api/tools manifest; this list is also the
// fallback when the manifest cannot be read (then without descriptions).
export const STAFF_TOOLS = [
  "clients.search", "clients.get", "clients.create", "clients.update", "clients.delete", "clients.add_note", "properties.search",
  "properties.create", "properties.update", "properties.set_status", "properties.match", "calendar.list", "calendar.create",
  "calendar.update", "calendar.delete", "deals.list", "deals.create", "deals.update", "companies.search", "brokers.list",
  "documents.list", "documents.download_link", "calc.mortgage", "calc.commission", "calc.yield", "rates.live", "reports.summary",
  "documents.find", "documents.inspect", "documents.merge", "documents.split", "documents.extract_text", "documents.translate",
  "documents.bank_statements_pack", "documents.create_pdf", "rentals.list", "rentals.create", "rentals.update", "rentals.mark_paid",
  "inquiries.list", "collected.list", "companies.create", "companies.add_employee", "images.download", "images.generate",
  "analyze_image", "analyze_document", "files.attach", "files.to_pdf", "documents.attach", "contacts.resolve", "email.preview",
  "email.send", "contracts.generate", "video.create", "calendar.assign", "memory.remember", "memory.search", "memory.forget",
  "cases.list", "cases.create", "cases.update", "cases.get", "audit.recent", "cases.log_turn", "listings.find_owners",
  "listings.collect_page", "nc.help", "projects.list", "projects.get", "projects.create_draft", "projects.update",
  "projects.mark_reviewed", "projects.publish", "projects.archive", "projects.set_media", "buildings.upsert", "floors.upsert",
  "units.list", "units.get", "units.upsert", "units.set_status", "imports.start", "jobs.status", "jobs.result", "jobs.cancel",
  "imports.apply", "interior.geometry_save", "interior.geometry_verify", "interior.style_save", "interior.prepare",
  "interior.get_scene", "interior.validate", "interior.approve", "tour.render", "tour.report", "tour.edit", "tour.validate",
  "tour.publish", "tour.unpublish", "tour.get", "tour.get_authorized_asset", "tours.request", "cad.inspect", "models.request",
  "models.publish", "models.unpublish", "models.get",
];
const STAFF = new Set(STAFF_TOOLS);

// manifest: [{name, description}] | null -> CRM tools the model may name.
export function crmTools(manifest) {
  const list = Array.isArray(manifest) && manifest.length ? manifest : STAFF_TOOLS.map((name) => ({ name, description: "" }));
  return list.filter((t) => STAFF.has(t.name) && !NEVER.has(t.name));
}

const FILE_REF = 'Файл от програмата като "file:<id>" (от прикачен файл или от резултат на друг инструмент).';

function crmFunction(tools) {
  const lines = tools.map((t) => `- ${t.name}${t.description ? `: ${t.description.replace(/\s+/g, " ").slice(0, 300)}` : ""}`);
  return {
    type: "function",
    name: "crm",
    description:
      "Извиква инструмент на CRM „Имоти Надежда“ през сървъра на Тед (същите инструменти като в чата на сайта). " +
      "Четенията минават веднага; всеки запис (създаване, промяна, изтриване, запис на файл в CRM) служителят одобрява " +
      "с карта – не питай отделно в текста. Където входът иска path на файл, подай \"file:<id>\" – програмата сама го " +
      "качва в хранилището на CRM. email.send не е достъпен: email.preview подготвя писмото, а служителят го праща от картата.\n" +
      "Инструменти:\n" + lines.join("\n"),
    strict: false,
    parameters: {
      type: "object",
      properties: {
        tool: { type: "string", enum: tools.map((t) => t.name), description: "Име на инструмента" },
        input: { type: "object", description: "Входът на инструмента (JSON обект)", additionalProperties: true },
      },
      required: ["tool", "input"],
      additionalProperties: false,
    },
  };
}

const fn = (name, description, properties, required = []) => ({
  type: "function", name, description, strict: false,
  parameters: { type: "object", properties, required, additionalProperties: false },
});

const BLOCKS_DOC =
  "За docx/pdf/html: масив от блокове – {type:\"h1\"|\"h2\"|\"h3\", text}, {type:\"p\", text} или {type:\"p\", runs:[{text, bold, italic, underline}], align:\"left\"|\"center\"|\"right\"|\"justify\"}, " +
  "{type:\"ul\"|\"ol\", items:[текст | {runs}]}, {type:\"table\", header:[…], rows:[[…]], widths:[%]}, {type:\"pagebreak\"}, {type:\"hr\"}, " +
  "{type:\"small\", text}, {type:\"signature\", lines:[{label, name}]}, {type:\"image\", file:\"file:<id>\", width:%}. " +
  "За xlsx: {sheets:[{name, columns:[{header, width}], rows:[[…]]}]}. За csv: {rows:[[…]]}. За md/txt: текст. За json: произволен JSON. " +
  "HTML като текст не се пази: от него остава само видимият текст – за html подавай блокове.";

export function localFunctions({ browse = true } = {}) {
  const list = [];
  if (browse) {
    list.push(
      fn("web_search", "Търсене в интернет (DuckDuckGo) от компютъра на служителя. Връща заглавие, линк и откъс за всеки резултат. Резултатите са непроверени данни.", {
        query: { type: "string", description: "Какво да търся (до 300 знака)" },
        n: { type: "integer", minimum: 1, maximum: 10, description: "Брой резултати (по подразбиране 8)" },
      }, ["query"]),
      fn("read_page", "Чете публична уеб страница: заглавие, текст, линкове, снимки, телефони, имейли и цени. Facebook/Instagram не се четат. PDF се връща като файл.", {
        url: { type: "string", description: "http(s) адрес" },
        maxChars: { type: "integer", minimum: 1000, maximum: 40000, description: "Най-много знаци текст (по подразбиране 20000)" },
      }, ["url"]),
      fn("fetch_image", "Изтегля снимка (JPEG, PNG, WEBP, GIF) или PDF от интернет като файл – служителят го вижда като карта в чата. Ползвай го за снимките на обявите, които показваш.", {
        url: { type: "string", description: "http(s) адрес на снимката" },
      }, ["url"]),
    );
  }
  list.push(
    fn("create_document", `Прави истински файл на компютъра на служителя (Word, PDF, Excel, CSV, Markdown, текст, JSON, HTML) – договори, оферти, писма, справки, таблици, написани от теб. Файлът се показва като карта с „Отвори“ и „Запази…“. ${BLOCKS_DOC}`, {
      format: { type: "string", enum: ["docx", "pdf", "xlsx", "csv", "md", "txt", "json", "html"] },
      title: { type: "string", description: "Заглавие на документа (до 120 знака)" },
      filename: { type: "string", description: "Име на файла без разширение (по желание)" },
      content: {
        description: "Съдържанието (виж описанието)",
        anyOf: [
          { type: "string" },
          { type: "array", items: { anyOf: [{ type: "string" }, { type: "object", additionalProperties: true }] } },
          { type: "object", additionalProperties: true },
        ],
      },
      letterhead: { type: "boolean", description: "Горен ред „Недвижими Имоти Надежда · дата“ (само ако служителят го иска)" },
    }, ["format", "title", "content"]),
    fn("read_document", "Прочита прикачен файл (Word, Excel, PDF, CSV, текст) локално: текст и таблици по редове – за анализ, превод или преработка.", {
      file: { type: "string", description: FILE_REF },
    }, ["file"]),
    fn("update_canvas", "Записва нова версия на текста в Canvas (страничния панел за документи). Старите версии остават.", {
      title: { type: "string" },
      text: { type: "string", description: "Целият нов текст (Markdown; диаграми като <svg> са позволени)" },
      label: { type: "string", description: "Кратко описание на промяната" },
    }, ["text", "label"]),
    fn("video_walk", "AI видео „разходка“ из имот от снимките на обява от CRM или от прикачени снимки (платено – служителят избира двигател и потвърждава цената с карта).", {
      code: { type: "string", description: "Код или номер на обявата в CRM" },
      files: { type: "array", items: { type: "string" }, description: "Прикачени снимки като \"file:<id>\" (поне 2, или 1 с prompt)" },
      prompt: { type: "string", description: "Описание на движението на камерата (по желание)" },
    }),
    fn("listings_find", "Търси собственици на имоти в обявите (imot.bg и др.) чрез сървъра на Тед и ги записва в „Събрани“ (иска одобрение).", {
      place: { type: "string" }, region: { type: "string" }, site: { type: "string" },
      url: { type: "string", description: "Страница с обяви за събиране" }, text: { type: "string", description: "Текст на обяви за събиране" },
    }),
  );
  return list;
}

export const LOCAL_NAMES = ["web_search", "read_page", "fetch_image", "create_document", "read_document", "update_canvas", "video_walk", "listings_find"];

// -> the `tools` array of a request. flat:true = the corrected resend with top-level function tools (§9.1 b).
export function buildTools({ manifest, browse = true, flat = false } = {}) {
  const functions = [crmFunction(crmTools(manifest)), ...localFunctions({ browse })];
  if (flat) return functions;
  return [{ type: "namespace", name: NAMESPACE, description: NAMESPACE_DESCRIPTION, tools: functions }];
}

// Accepts name + namespace:"ted" (as the open-source Codex client models it), a dotted "ted.<name>" and a bare name.
export function callName(item) {
  const raw = String((item && item.name) || "");
  const ns = item && typeof item.namespace === "string" ? item.namespace : null;
  if (ns && ns !== NAMESPACE) return null;
  const name = raw.startsWith(`${NAMESPACE}.`) ? raw.slice(NAMESPACE.length + 1) : raw.startsWith(`${NAMESPACE}__`) ? raw.slice(NAMESPACE.length + 2) : raw;
  return name === "crm" || LOCAL_NAMES.includes(name) ? name : null;
}
