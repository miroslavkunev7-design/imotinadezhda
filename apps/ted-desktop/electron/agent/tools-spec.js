// Function tools of the Real GPT agent (docs/CONTRACT.md §9.2): one namespace "ted" holding the CRM gateway and
// the local functions. Official form: developers.openai.com/api/docs/guides/tools (namespace tool). No
// defer_loading (tool_search is not supported on the plan route). strict:false – MAIN validates every argument.
import { AI_OFF_INPUT, NEVER, isServerAi } from "./gate.js";
import { CHATGPT_PROMPT_MAX } from "./chatgpt-link.js";

export const NAMESPACE = "ted";
export const NAMESPACE_DESCRIPTION = "Ръцете на Тед (без друг изкуствен интелект): CRM „Имоти Надежда“, интернет и файловете на този компютър";

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
  // 0.1.10 (27.11): new server skills – visits, deal finances, the done tick, the CRM mailbox, chats, agent limits.
  "visits.stats", "deals.finance", "calendar.done", "mail.list", "mail.read", "chats.list", "agents.usage",
];
const STAFF = new Set(STAFF_TOOLS);

// manifest: [{name, description}] | null -> CRM tools the model may name: the server's staff tools minus the ones only
// MAIN may call (NEVER) and minus every tool that runs another AI on Ted's server (SERVER_AI, CONTRACT §9.6).
export function crmTools(manifest) {
  const list = Array.isArray(manifest) && manifest.length ? manifest : STAFF_TOOLS.map((name) => ({ name, description: "" }));
  return list
    .filter((t) => t && STAFF.has(t.name) && !NEVER.has(t.name) && !isServerAi(t.name))
    .map((t) => (AI_OFF_INPUT[t.name] ? { ...t, description: `${t.description || ""} В Real GPT без ${Object.keys(AI_OFF_INPUT[t.name]).join(", ")} (AI на сървъра не се ползва).`.trim() } : t));
}

const FILE_REF = 'Файл от програмата като "file:<id>" (от прикачен файл или от резултат на друг инструмент).';

function crmFunction(tools) {
  const lines = tools.map((t) => `- ${t.name}${t.description ? `: ${t.description.replace(/\s+/g, " ").slice(0, 300)}` : ""}`);
  return {
    type: "function",
    name: "crm",
    description:
      "Извиква инструмент на CRM „Имоти Надежда“ (данните на агенцията: клиенти, имоти, календар, сделки, документи, наеми, " +
      "памет, казуси). Тук са само инструментите без изкуствен интелект на сървъра – анализа, превода, описанията и " +
      "текстовете правиш ти. Четенията минават веднага; всеки запис (създаване, промяна, изтриване, запис на файл в CRM) " +
      "служителят одобрява с карта – не питай отделно в текста. Където входът иска path на файл, подай \"file:<id>\" – " +
      "програмата сама го качва в хранилището на CRM. Снимки от чата в галерията на имот: images.download " +
      "{urls:[\"file:<id>\", …], property_code} (програмата ги качва и подава временна връзка). email.send не е достъпен: " +
      "email.preview подготвя писмото, а служителят го праща от картата.\n" +
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
      fn("read_page", "Чете публична уеб страница: заглавие, текст, линкове, снимки (images – адресите им можеш да покажеш в отговора като ![..](адрес)), телефони, имейли и цени. Facebook/Instagram не се четат. PDF се връща като файл.", {
        url: { type: "string", description: "http(s) адрес" },
        maxChars: { type: "integer", minimum: 1000, maximum: 40000, description: "Най-много знаци текст (по подразбиране 20000)" },
      }, ["url"]),
      fn("fetch_image", "Изтегля снимка (JPEG, PNG, WEBP, GIF) или PDF от интернет като файл – служителят го вижда като карта в чата и в Библиотеката. Ползвай го, когато трябва самият файл (запис в CRM, документ); за показване в отговора стигат адресите от read_page.", {
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
    fn("read_document", "Прочита файл на този компютър (Word, Excel, PDF, CSV, текст) без друг AI: текст и таблици по редове – за анализ, превод или преработка, които правиш ти. Прикачените снимки и PDF обикновено вече са приложени към съобщението – виж ги директно.", {
      file: { type: "string", description: FILE_REF },
    }, ["file"]),
    fn("update_canvas", "Записва нова версия на текста в Canvas (страничния панел за документи). Старите версии остават.", {
      title: { type: "string" },
      text: { type: "string", description: "Целият нов текст (Markdown; диаграми като <svg> са позволени)" },
      label: { type: "string", description: "Кратко описание на промяната" },
    }, ["text", "label"]),
    fn("project_folder", "Папка на проект (казус от CRM) на този компютър – всичко за един клиент или сделка на едно място: прикачени файлове, документите, които правиш, снимки, запазени отговори. create – нов проект (казус в CRM; служителят одобрява с карта); add – слага файлове \"file:<id>\" в папката (само на компютъра); list – какво има в папката; export_zip – един ZIP на папката (карта с „Запази…“); save_to_crm – записва файловете в CRM при клиента на проекта или при имот (служителят одобрява с карта; снимките към имот отиват в галерията му). Без project се ползва проектът на този чат.", {
      action: { type: "string", enum: ["create", "add", "list", "export_zip", "save_to_crm"] },
      project: { type: "string", description: "id или точното заглавие на проекта (create: заглавието на новия проект)" },
      files: { type: "array", items: { type: "string" }, description: "add: файловете като \"file:<id>\"; save_to_crm: по избор само тези файлове (иначе цялата папка)" },
      client_name: { type: "string", description: "create: клиент на новия проект; save_to_crm: клиент в CRM (по подразбиране клиентът на проекта)" },
      client_id: { type: "string", description: "id на клиент в CRM (по избор)" },
      property_code: { type: "string", description: "save_to_crm: код на имот (P-…) – снимките в галерията му, другите файлове в документите му" },
      description: { type: "string", description: "create: кратко начално описание на проекта" },
    }, ["action"]),
    fn("open_in_chatgpt", "Показва на служителя карта със заявка за приложението ChatGPT (неговия план): снимки, видео (Sora) и всичко друго, което не може да се направи оттук. Нищо не се отваря и нищо не се създава автоматично – служителят преглежда заявката и сам натиска „Отвори в ChatGPT“.", {
      prompt: { type: "string", description: `Точната заявка, която ще се постави в ChatGPT, на езика на служителя. За директен линк – до около 1300 знака на кирилица (или 4000 на латиница); по-дълга се копира ръчно. Най-много ${CHATGPT_PROMPT_MAX} знака.` },
      kind: { type: "string", enum: ["image", "video", "research", "other"], description: "Какво ще се прави в ChatGPT" },
    }, ["prompt", "kind"]),
  );
  return list;
}

export const LOCAL_NAMES = ["web_search", "read_page", "fetch_image", "create_document", "read_document", "update_canvas", "open_in_chatgpt", "project_folder"];

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
