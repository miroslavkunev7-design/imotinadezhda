// Chat with Ted through the production endpoint POST /api/assistant (non-streaming, up to ~108 s).
// Requests are validated before anything leaves the machine and are NEVER retried automatically:
// a retry could repeat a CRM write. The only exception (one 401 refresh + retry) lives in session.authed.
import { SITE, PAGE } from "./config.js";
import { KNOWN_TOOLS, toolLabel } from "./labels.js";
import { isMutating } from "./tools.js";

export const LIMITS = { messages: 16, textChars: 8000, files: 3, base64Chars: Math.floor(3.8 * 1024 * 1024) };
const CHAT_TIMEOUT_MS = 115000; // server budget 108 s, function limit 120 s
const DOC_MIME = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
// Voice-note types the server transcribes; anything else it would silently drop.
const AUDIO_MIME = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|aac|m4a|x-m4a|3gpp|flac)$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const PANELS = ["upload", "collect", "mail", "video"];
// Server steps that are not CRM tools but still save data (found listings go into "Събрани").
const INFO_WRITES = /^(събиране|обяви от собственици)/;

function invalid(message) {
  const e = new Error(message);
  e.code = "invalid";
  return e;
}

const optionalId = (value, max, what) => {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || value.length > max) throw invalid(`Невалидна стойност за ${what}.`);
  return value;
};

function cleanFiles(files) {
  if (!Array.isArray(files)) throw invalid("Невалиден списък с файлове.");
  const out = [];
  let docs = 0;
  let audio = 0;
  for (const f of files) {
    if (!f || typeof f !== "object") throw invalid("Невалиден файл.");
    const mime = String(f.mime || "").split(";")[0].trim().toLowerCase(); // "audio/webm;codecs=opus" -> "audio/webm"
    const name = typeof f.name === "string" ? f.name.slice(0, 200) : "";
    if (DOC_MIME.test(mime)) docs++;
    else if (AUDIO_MIME.test(mime)) audio++;
    else throw invalid(`Файлът „${name || mime || "без име"}“ не се поддържа. Приемат се JPEG, PNG, WebP и PDF.`);
    if (typeof f.data !== "string" || !f.data || !BASE64.test(f.data)) throw invalid(`Файлът „${name || mime}“ е празен или повреден.`);
    out.push({ name, mime, data: f.data });
  }
  if (docs > LIMITS.files) throw invalid(`Най-много ${LIMITS.files} файла на съобщение.`);
  if (audio > 1) throw invalid("Само едно гласово съобщение наведнъж.");
  if (out.reduce((n, f) => n + f.data.length, 0) > LIMITS.base64Chars) throw invalid("Файловете са твърде големи (общо над 3,8 MB).");
  return out;
}

// Builds the request body or throws {code:"invalid", message}. Pure: no network, no state.
export function buildBody({ messages, model, mode, caseId } = {}) {
  if (!Array.isArray(messages) || !messages.length) throw invalid("Празно съобщение.");
  const case_id = optionalId(caseId, 64, "казус");
  // Inside a case the server rebuilds the history itself: only the current message is sent.
  const list = case_id ? messages.slice(-1) : messages;
  if (list.length > LIMITS.messages) throw invalid(`Най-много ${LIMITS.messages} съобщения в една заявка.`);

  const out = list.map((m, i) => {
    const last = i === list.length - 1;
    if (!m || typeof m !== "object" || (m.role !== "user" && m.role !== "assistant")) throw invalid("Невалидно съобщение.");
    if (typeof m.text !== "string") throw invalid("Невалиден текст на съобщение.");
    if (m.text.length > LIMITS.textChars) throw invalid(`Съобщението е твърде дълго (над ${LIMITS.textChars} знака).`);
    const hasFiles = m.files != null && !(Array.isArray(m.files) && !m.files.length);
    if (hasFiles && !last) throw invalid("Файлове се прикачват само към последното съобщение.");
    const files = hasFiles ? cleanFiles(m.files) : [];
    return files.length ? { role: m.role, text: m.text, files } : { role: m.role, text: m.text };
  });

  if (out[0].role !== "user") throw invalid("Разговорът трябва да започва със съобщение от служителя.");
  const current = out[out.length - 1];
  if (current.role !== "user") throw invalid("Последното съобщение трябва да е от служителя.");
  if (!current.text.trim() && !current.files) throw invalid("Празно съобщение.");

  const body = { messages: out, page: PAGE };
  const m1 = optionalId(model, 80, "модел");
  const m2 = optionalId(mode, 32, "роля");
  if (m1) body.model = m1;
  if (m2) body.mode = m2;
  if (case_id) body.case_id = case_id;
  return body;
}

// One server action string -> Action. A trailing " ✗" marks a failed step.
function parseAction(raw, names) {
  const s = String(raw);
  const failed = /\s✗$/.test(s);
  const name = failed ? s.replace(/\s✗$/, "") : s;
  if (name.includes(".") && names.has(name)) {
    return { raw: s, kind: "tool", tool: name, label: toolLabel(name), ok: !failed, mutating: isMutating(name) };
  }
  // Info steps arrive in Bulgarian already ("интернет: …", "страница: …", "отворено: …") and are shown as they are.
  return { raw: s, kind: "info", label: toolLabel(name), ok: !failed, mutating: INFO_WRITES.test(name) };
}

const text = (v) => (typeof v === "string" && v ? v : null);

// Server reply -> ChatResult (success shape). The renderer never sees raw HTTP.
export function normalize(json, durationMs, manifestNames) {
  const j = json && typeof json === "object" ? json : {};
  const names = manifestNames instanceof Set ? manifestNames : new Set(manifestNames || KNOWN_TOOLS);
  const panel = j.ui && typeof j.ui === "object" ? j.ui.panel : null;
  return {
    ok: true,
    text: typeof j.text === "string" ? j.text : "",
    transcript: typeof j.transcript === "string" ? j.transcript : null, // string only for voice messages
    actions: (Array.isArray(j.actions) ? j.actions : []).map((a) => parseAction(a, names)),
    mode: text(j.mode),
    model: text(j.model),
    modelName: text(j.model_name),
    fallback: text(j.fallback),
    email: j.email && typeof j.email === "object" && !Array.isArray(j.email) ? j.email : null,
    listings: Array.isArray(j.listings) ? j.listings : null,
    video: j.video && typeof j.video === "object" ? j.video : null,
    uiPanel: PANELS.includes(panel) ? panel : null,
    durationMs: Number(durationMs) || 0,
  };
}

const serverText = (json) => (json && typeof json.error === "string" && json.error.trim() ? json.error.trim().slice(0, 600) : "");

const THROWN = {
  timeout: "Тед не отговори навреме. Ако вече е започнал действие на сървъра, то може да е изпълнено – проверете в CRM.",
  aborted: "Изчакването е спряно. Ако Тед вече е започнал действие на сървъра, то може да бъде довършено – проверете в CRM.",
  network: "Няма връзка със сървъра.",
  auth: "Сесията е изтекла – влезте отново.",
};

function thrownResult(e) {
  const code = Object.hasOwn(THROWN, e.code) ? e.code : "network";
  // sent === false: the request never left this computer, so nothing can have run on the server.
  return { ok: false, error: THROWN[code], code, maybeExecuted: code !== "auth" && e.sent !== false };
}

export function createAssistant({ session, log }) {
  const inflight = new Map(); // requestId -> AbortController
  let manifest = null;        // Set of live tool names, loaded lazily
  let manifestLoading = null;

  // Live tools manifest (public GET). Best effort: until it arrives the built-in names are used.
  function loadManifest() {
    if (manifest || manifestLoading) return;
    manifestLoading = session.authed({ url: SITE + "/api/tools", timeoutMs: 10000 })
      .then((res) => {
        const tools = res.ok && res.json && Array.isArray(res.json.tools) ? res.json.tools : null;
        const names = tools ? tools.map((t) => t && t.name).filter((n) => typeof n === "string") : [];
        if (names.length) manifest = new Set(names);
      })
      .catch(() => {})
      .finally(() => { manifestLoading = null; });
  }

  async function chat(args) {
    const t0 = Date.now();
    const requestId = args && args.requestId;
    let body;
    try {
      if (typeof requestId !== "string" || !requestId || requestId.length > 100) throw invalid("Липсва идентификатор на заявката.");
      if (inflight.has(requestId)) throw invalid("Тази заявка вече се изпълнява.");
      body = buildBody(args);
    } catch (e) {
      return { ok: false, error: e.code === "invalid" ? e.message : "Невалидна заявка.", code: "invalid", maybeExecuted: false };
    }

    const ctrl = new AbortController();
    inflight.set(requestId, ctrl);
    loadManifest();
    let res;
    try {
      res = await session.authed({ url: SITE + "/api/assistant", method: "POST", json: body, timeoutMs: CHAT_TIMEOUT_MS, signal: ctrl.signal });
    } catch (e) {
      const out = thrownResult(e);
      if (log) log.warn("chat.failed", { requestId, code: out.code, ms: Date.now() - t0 });
      return out;
    } finally {
      inflight.delete(requestId);
    }

    const ms = Date.now() - t0;
    const j = res.json;
    if (res.ok && j && j.ok === true) {
      const out = normalize(j, ms, manifest || undefined);
      if (log) log.info("chat.ok", { requestId, ms, actions: out.actions.length, model: out.model });
      return out;
    }
    if (log) log.warn("chat.error", { requestId, status: res.status, quota: !!(j && j.quota), ms });
    if (res.status === 401) return { ok: false, error: THROWN.auth, code: "auth", status: 401, maybeExecuted: false };
    // A quota reply can come after the server already ran a step, and failed replies carry no action
    // list - so only a 4xx (rejected before execution) is known to have done nothing.
    const maybeExecuted = !(res.status >= 400 && res.status < 500);
    if (j && j.quota) {
      return { ok: false, error: serverText(j) || "Лимитът на AI модела е изчерпан за момента. Опитайте отново след минута.", code: "quota", status: res.status, maybeExecuted };
    }
    return { ok: false, error: serverText(j) || `Сървърът върна грешка (HTTP ${res.status}).`, code: "http", status: res.status, maybeExecuted };
  }

  function cancel(requestId) {
    const ctrl = inflight.get(requestId);
    if (ctrl) ctrl.abort();
    return { ok: true };
  }

  async function models() {
    let res;
    try {
      res = await session.authed({ url: SITE + "/api/assistant", method: "POST", json: { action: "models" }, timeoutMs: 20000 });
    } catch (e) {
      const out = thrownResult(e);
      return { ok: false, error: out.code === "timeout" ? "Сървърът не отговори навреме." : out.error, code: out.code };
    }
    const j = res.json;
    if (!(res.ok && j && j.ok === true && Array.isArray(j.models))) {
      if (res.status === 401) return { ok: false, error: THROWN.auth, code: "auth" };
      return { ok: false, error: serverText(j) || `Сървърът върна грешка (HTTP ${res.status}).`, code: "http" };
    }
    const str = (v) => (v == null ? "" : String(v));
    return {
      ok: true,
      models: j.models.filter((m) => m && m.id).map((m) => ({
        id: str(m.id), name: str(m.name), note: str(m.note), provider: str(m.provider), vision: !!m.vision, pdf: !!m.pdf,
      })),
      modes: (Array.isArray(j.modes) ? j.modes : []).filter((m) => m && m.id).map((m) => ({ id: str(m.id), name: str(m.name) })),
    };
  }

  return { models, chat, cancel };
}
