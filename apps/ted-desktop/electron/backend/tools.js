// CRM tools gateway (POST /api/tools). The renderer reaches only read() with the READ_ONLY allowlist;
// call() is MAIN-internal and used by the few dedicated, validated write channels. Nothing is retried.
import { SITE } from "./config.js";

export const READ_ONLY = [
  "clients.search", "clients.get", "properties.search", "properties.match", "calendar.list", "deals.list",
  "companies.search", "brokers.list", "documents.list", "documents.find", "documents.download_link",
  "calc.mortgage", "calc.commission", "calc.yield", "rates.live", "reports.summary", "memory.search",
  "cases.list", "cases.get", "inquiries.list", "rentals.list", "collected.list",
];
const READ_SET = new Set(READ_ONLY);

// CONTRACT §2: a tool is mutating unless its name marks it as a read. The words are matched on whole
// name segments ("listings.collect_page" is not a "list").
const READ_NAME = /(^|[._])(search|list|get|calc|find|inspect|match|live|summary|recent|preview)([._]|$)/;
// Two corrections of the name rule, checked against the server code: pure reads without a marker word,
// and one tool that is named like a read but saves the found listings into "Събрани".
const ALSO_READS = new Set(["documents.extract_text", "contacts.resolve", "analyze_image", "analyze_document", "nc.help", "jobs.status", "jobs.result"]);
const WRITES_DESPITE_NAME = new Set(["listings.find_owners"]);

export function isMutating(tool) {
  if (READ_SET.has(tool) || ALSO_READS.has(tool)) return false;
  if (WRITES_DESPITE_NAME.has(tool)) return true;
  return !READ_NAME.test(String(tool));
}

const TOOL_NAME = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)?$/;
const MAX_INPUT_BYTES = 256 * 1024;
const TIMEOUT_MS = 100000;

// The server answers most tool errors in Bulgarian; its generic English ones get a Bulgarian lead-in.
function errorText(status, json) {
  const raw = json && typeof json.error === "string" ? json.error.trim().slice(0, 500) : "";
  if (raw && /[А-Яа-я]/.test(raw)) return raw;
  if (status === 403) return "Този профил няма достъп до CRM.";
  if (status === 404) return "Сървърът не познава този инструмент.";
  if (status === 400) return "Невалидни данни за заявката." + (raw ? ` (${raw})` : "");
  return `Грешка от сървъра (HTTP ${status})` + (raw ? `: ${raw}` : ".");
}

export function createTools({ session, log }) {
  async function call(tool, input) {
    const payload = input == null ? {} : input;
    let size = Infinity;
    try { size = JSON.stringify(payload).length; } catch { /* not serialisable */ }
    if (typeof tool !== "string" || tool.length > 64 || !TOOL_NAME.test(tool) ||
        typeof payload !== "object" || Array.isArray(payload) || size > MAX_INPUT_BYTES) {
      return { ok: false, error: "Невалидна заявка към CRM.", code: "invalid", maybeExecuted: false };
    }
    let res;
    try {
      res = await session.authed({ url: SITE + "/api/tools", method: "POST", json: { tool, input: payload }, timeoutMs: TIMEOUT_MS });
    } catch (e) {
      // sent === false: the request never left this computer, so nothing can have run.
      const code = ["auth", "timeout", "aborted", "network"].includes(e.code) ? e.code : "network";
      if (log) log.warn("tools.failed", { tool, code });
      return { ok: false, error: e.message || "Няма връзка със сървъра.", code, maybeExecuted: code !== "auth" && e.sent !== false };
    }
    const j = res.json;
    if (res.ok && j && j.ok === true) return { ok: true, result: j.result };
    if (log) log.warn("tools.error", { tool, status: res.status });
    if (res.status === 401) return { ok: false, error: "Сесията е изтекла – влезте отново.", status: 401, code: "auth", maybeExecuted: false };
    // CONTRACT §2: a 4xx is a refusal before execution; any 5xx (even with a JSON error, e.g. an SMTP
    // timeout after the message data was sent) leaves the outcome unknown.
    return { ok: false, error: errorText(res.status, j), status: res.status, code: "http", maybeExecuted: res.status >= 500 };
  }

  async function read(tool, input) {
    if (!READ_SET.has(tool)) {
      return { ok: false, error: "Този инструмент не е разрешен за четене от програмата.", code: "forbidden" };
    }
    return call(tool, input);
  }

  return { read, call };
}
