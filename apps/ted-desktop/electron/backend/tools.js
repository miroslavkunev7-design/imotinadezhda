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

// http (optional): the plain allowlisted client, for the public GETs below (no token is ever attached there).
// A failed public GET (manifest, role prompt) is not repeated for 5 minutes: no identical requests in a loop.
export const RETRY_AFTER_MS = 5 * 60_000;

export function createTools({ session, log, http, now = Date.now }) {
  let manifestCache = null;
  let manifestFailedAt = -Infinity;
  let manifestLoading = null;
  const rolePrompts = new Map();
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
    // zod issues (400) are kept for MAIN's gate: an issue at ["confirm"] means "ask the employee first" (§9.3).
    const issues = res.status === 400 && j && Array.isArray(j.issues)
      ? j.issues.slice(0, 20).map((i) => ({ path: Array.isArray(i && i.path) ? i.path.slice(0, 6).map(String) : [], message: String((i && i.message) || "").slice(0, 200) }))
      : undefined;
    return { ok: false, error: errorText(res.status, j), status: res.status, code: "http", maybeExecuted: res.status >= 500, ...(issues ? { issues } : {}) };
  }

  // GET /api/tools: [{name, description}] of every server tool (public list, no token). Cached for the run.
  async function manifest() {
    if (manifestCache) return manifestCache;
    if (!http || now() - manifestFailedAt < RETRY_AFTER_MS) return null;
    // Two calls at once (the agent asks twice per answer) share one request.
    if (!manifestLoading) {
      manifestLoading = (async () => {
        try {
          const res = await http.request({ url: SITE + "/api/tools", method: "GET", timeoutMs: 20000 });
          const list = res.ok && res.json && Array.isArray(res.json.tools) ? res.json.tools : null;
          if (!list) { manifestFailedAt = now(); return null; }
          manifestCache = list
            .filter((t) => t && TOOL_NAME.test(String(t.name)) && String(t.name).length <= 64)
            .map((t) => ({ name: String(t.name), description: String(t.description || "").slice(0, 600) }));
          return manifestCache;
        } catch (e) {
          manifestFailedAt = now();
          if (log) log.warn("tools.manifest_failed", { code: e && e.code });
          return null;
        } finally {
          manifestLoading = null;
        }
      })();
    }
    return manifestLoading;
  }

  // GET /api/tools?mode=<id>: the public role prompt of a server mode ("Умения и роли"). Cached for the run.
  async function rolePrompt(mode) {
    const id = String(mode || "");
    if (!/^[a-z0-9_-]{1,40}$/i.test(id) || !http) return null;
    if (rolePrompts.has(id)) {
      const hit = rolePrompts.get(id);
      if (!(hit && hit.failedAt)) return hit;
      if (now() - hit.failedAt < RETRY_AFTER_MS) return null;
    }
    try {
      const res = await http.request({ url: `${SITE}/api/tools?mode=${encodeURIComponent(id)}`, method: "GET", timeoutMs: 15000 });
      const j = res.ok && res.json && res.json.ok ? res.json : null;
      const out = j && typeof j.prompt === "string" ? { name: String(j.name || id).slice(0, 80), prompt: j.prompt.slice(0, 12000) } : null;
      rolePrompts.set(id, out);
      return out;
    } catch {
      rolePrompts.set(id, { failedAt: now() });
      return null;
    }
  }

  async function read(tool, input) {
    if (!READ_SET.has(tool)) {
      return { ok: false, error: "Този инструмент не е разрешен за четене от програмата.", code: "forbidden" };
    }
    return call(tool, input);
  }

  return { read, call, manifest, rolePrompt };
}
