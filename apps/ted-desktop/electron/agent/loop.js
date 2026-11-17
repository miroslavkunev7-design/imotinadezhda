// The Real GPT agent (docs/CONTRACT.md §9): the GPT model of the employee's ChatGPT plan is the brain, Ted's own
// tools are the hands. One answer = up to N rounds of POST /v1/responses (stateless: the whole input is resent),
// each round's function calls executed here one by one through the gate, their results appended as
// function_call_output items. Steps, files, approvals, canvas versions, e-mail drafts and video jobs are pushed to
// the renderer as AgentEvents; statuses come only from real results.
import { apiFailure, fail, RgError, serverError, toFailure } from "../realgpt/errors.js";
import { assertRequest, buildInput, EFFORTS, outputItems, outputText } from "../realgpt/responses.js";
import { approvalJson, approvalTitle, asksConfirm, classify, inputLines, NEVER, normalizeInput, stripConfirm, toolLabel } from "./gate.js";
import { buildInstructions } from "./instructions.js";
import { buildTools, callName, crmTools } from "./tools-spec.js";
import { FILE_REF } from "./uploads.js";
import { createDocument } from "../docs/create.js";

// Step names of the server tools that make files (images, translations, PDFs) – the rest read „CRM: <tool>“.
const GEN_LABEL = {
  "images.generate": ["image", "Генерирам снимка"], "images.download": ["image", "Тегля снимки"],
  "documents.translate": ["doc", "Превеждам документ"], "documents.merge": ["doc", "Обединявам документи"],
  "documents.split": ["doc", "Разделям документ"], "documents.create_pdf": ["doc", "Правя PDF"], "files.to_pdf": ["doc", "Правя PDF от файловете"],
};

export const LIMITS = {
  chat: { rounds: 8, calls: 40, wallMs: 6 * 60_000, read_page: 20, fetch_image: 12 },
  work: { rounds: 20, calls: 100, wallMs: 30 * 60_000, read_page: 60, fetch_image: 30 },
};
export const LIMIT_TEXT = "Достигнат е лимитът на стъпките за един отговор";
export const OUTPUT_CAP = 20_000;
export const APPROVAL_TIMEOUT_MS = 10 * 60_000;
const CUT = "…(съкратено)";
const KIND_BG = { image: "снимка", pdf: "PDF", docx: "Word", xlsx: "Excel", csv: "CSV", text: "текст", video: "видео", other: "файл" };

export const humanSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function capOutput(value, cap = OUTPUT_CAP) {
  let s;
  try { s = JSON.stringify(value); } catch { s = JSON.stringify({ ok: false, error: "Резултатът не може да се предаде." }); }
  return s.length > cap ? s.slice(0, cap - CUT.length) + CUT : s;
}

// Messages from the renderer -> model messages: attached files become text lines, the open Canvas goes with the
// last user message.
export function prepareMessages(messages, { files, canvas } = {}) {
  const out = messages.map((m) => {
    if (m.role !== "user" || !Array.isArray(m.files) || !m.files.length) return { role: m.role, text: m.text, ...(m.images ? { images: m.images } : {}) };
    const lines = m.files.map((id) => {
      const ref = files && files.ref(id);
      return ref
        ? `[Прикачен файл: ${ref.name} · ${KIND_BG[ref.kind] || "файл"} · ${humanSize(ref.size)} · file:${ref.id}${ref.note ? ` · ${ref.note}` : ""}]`
        : `[Прикачен файл: file:${id} · не е намерен на този компютър]`;
    });
    return { role: "user", text: [m.text, ...lines].filter((x) => x && String(x).trim()).join("\n"), ...(m.images ? { images: m.images } : {}) };
  });
  if (canvas && typeof canvas.text === "string" && canvas.text.trim()) {
    const last = out.map((m) => m.role).lastIndexOf("user");
    if (last >= 0) {
      const body = canvas.text.length > 60_000 ? canvas.text.slice(0, 60_000) + CUT : canvas.text;
      out[last] = { ...out[last], text: `${out[last].text}\n\n[Отворен Canvas „${String(canvas.title || "Без заглавие").slice(0, 120)}“ · версия ${Number(canvas.version) || 1}]\n${body}\n[/Canvas]` };
    }
  }
  return out;
}

const stripIds = (items) => items.map((it) => {
  if (!it || typeof it !== "object" || !("id" in it)) return it;
  const { id: _drop, ...rest } = it;
  return rest;
});

function flattenTools(tools) {
  const out = [];
  for (const t of tools || []) if (t.type === "namespace") out.push(...t.tools); else out.push(t);
  return out;
}

const hostPath = (url) => {
  try { const u = new URL(url); return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 90); } catch { return String(url).slice(0, 90); }
};

// ---- URL provenance (CONTRACT §9.3 rule 8) ---------------------------------------------------------------------
// read_page / fetch_image run without a card only for URLs the model did NOT build: URLs that appeared verbatim in the
// employee's messages or in the output of a function of this answer (search results, links/images of pages read,
// CRM results). Once CRM data, a read document, the Проект or an earlier answer is in the context, any other URL
// (a model-built one could carry that data to a third party) needs a „web“ approval card with the full address.
export const URL_MAX = 2048;
const URL_RE = /https?:\/\/[^\s"'<>\\^`{|}]+/gi;
export function normUrl(raw) {
  try {
    const u = new URL(String(raw));
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.href;
  } catch { return null; }
}
// Every URL in a text, also without trailing punctuation („…/обява.“ → „…/обява“).
export function urlsIn(text, add) {
  for (const m of String(text || "").matchAll(URL_RE)) {
    const raw = m[0].slice(0, URL_MAX + 1);
    for (const v of [raw, raw.replace(/[.,;:!?…»“”"')\]]+$/, "")]) { const n = normUrl(v); if (n) add(n); }
  }
}
// Personal data in a search query: e-mails and runs of ≥ 8 digits (phones, ЕГН, IBAN parts).
export function personalTokens(query) {
  const s = String(query || "");
  return [...(s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []), ...(s.match(/\d(?:[\s\-./]?\d){7,}/g) || [])];
}

// Every function call kind -> step kind (§8.3)
const TAINTING = new Set(["crm", "read_document", "listings_find", "video_walk"]);
const STEP_KIND = { web_search: "web_search", read_page: "read_page", fetch_image: "fetch_image", create_document: "doc", read_document: "read_doc", update_canvas: "canvas", video_walk: "video", listings_find: "listings" };

export function createAgent({
  tools, files, uploads, pages = null, search = null, video = null, http, confirm, getSettings = () => ({}), log,
  now = Date.now, approvalTimeoutMs = APPROVAL_TIMEOUT_MS, newId = () => Math.random().toString(16).slice(2, 10),
}) {
  const pending = new Map(); // requestId -> Map(approvalId -> {resolve, approval})
  const remembered = new Map(); // model -> {noEffort, flat, noIds}

  function memo(model) {
    if (!remembered.has(model)) remembered.set(model, { noEffort: false, flat: false, noIds: false });
    return remembered.get(model);
  }

  function approve({ requestId, approvalId, decision, options } = {}) {
    const p = pending.get(requestId);
    const entry = p && p.get(approvalId);
    if (!entry) return { ok: false, error: "Това одобрение вече не е активно." };
    if (!["allow", "deny", "allow_all"].includes(decision)) return { ok: false, error: "Невалиден избор." };
    if (decision === "allow_all" && !entry.approval.allowAll) return { ok: false, error: "„Разреши всички“ не важи за това действие." };
    let opts;
    if (entry.approval.kind === "video" && decision !== "deny") {
      const v = entry.approval.video || {};
      const engine = (v.engines || []).find((e) => e.id === (options && options.engine));
      const duration = Number(options && options.duration);
      if (!engine || !(engine.durs || []).includes(duration)) return { ok: false, error: "Изберете двигател и дължина от списъка." };
      opts = { engine: engine.id, duration };
    }
    p.delete(approvalId);
    entry.resolve({ decision, options: opts });
    return { ok: true };
  }

  function cancelApprovals(requestId) {
    const p = pending.get(requestId);
    if (!p) return;
    for (const entry of p.values()) entry.resolve({ decision: "deny", cancelled: true });
    pending.delete(requestId);
  }

  async function run(req) {
    const shared = { partial: () => ({}) };
    try {
      return await core(req, shared);
    } catch (e) {
      const out = toFailure(e, shared.partial());
      if (out.code === "internal" && log) log.error("agent.failed", { message: String((e && e.message) || e).slice(0, 300) });
      return out;
    }
  }

  async function core(req, shared) {
    const { requestId, model, messages, signal, stream, emit = () => {} } = req;
    const settings = getSettings() || {};
    const browseOn = !!(search && pages) && !(settings.browse && settings.browse.enabled === false);
    const hints = Array.isArray(req.hints) ? req.hints : [];
    const modeKey = req.mode === "work" || hints.includes("research") ? "work" : "chat";
    const limits = LIMITS[modeKey];
    const started = now();
    const steps = new Map();
    const made = [];
    const texts = [];
    const fullText = () => texts.filter((t) => t && t.trim()).join("\n\n");
    const partial = () => ({ ...(fullText() ? { text: fullText() } : {}), steps: [...steps.values()].map((s) => ({ ...s })), files: made.map((f) => ({ ...f })) });
    shared.partial = partial;
    const state = { allowAll: false, allowWeb: false, canvasVersion: Number(req.canvas && req.canvas.version) || 0, calls: 0, read_page: 0, fetch_image: 0, limitHit: false };
    const send = (ev) => { try { emit(ev); } catch { /* window gone */ } };
    const fileOpts = { chatId: req.chatId, temporary: !!req.temporary };
    // URL provenance: known URLs and whether private data is already in the context (see URL_MAX above).
    const known = new Set();
    const addKnown = (u) => { if (known.size < 20000) known.add(u); };
    const userText = (Array.isArray(messages) ? messages : []).filter((m) => m && m.role === "user").map((m) => String(m.text || "")).join("\n");
    urlsIn(userText, addKnown);
    const userDigits = userText.replace(/\D/g, "");
    const userLower = userText.toLowerCase();
    state.tainted = !!req.caseId || !!(req.canvas && typeof req.canvas.text === "string" && req.canvas.text.trim())
      || (Array.isArray(messages) && messages.some((m) => m && (m.role === "assistant" || (Array.isArray(m.files) && m.files.length))));

    // ---- steps, files, approvals ------------------------------------------------------------------------
    function step({ kind, label, tool, mutating }) {
      const s = { id: `s${steps.size + 1}`, kind, label: String(label).slice(0, 200), status: "run", startedAt: new Date(now()).toISOString(), ...(tool ? { tool } : {}), ...(mutating ? { mutating: true } : {}) };
      steps.set(s.id, s);
      send({ type: "step", step: { ...s } });
      const set = (status, detail) => {
        s.status = status;
        if (detail) s.detail = String(detail).slice(0, 300);
        if (status === "ok" || status === "fail" || status === "denied") s.endedAt = new Date(now()).toISOString();
        send({ type: "step", step: { ...s } });
      };
      return { id: s.id, ok: (d) => set("ok", d), fail: (d) => set("fail", d), wait: () => set("wait"), run: () => set("run"), denied: () => set("denied", "отказано") };
    }
    const subStep = (label) => {
      const s = step({ kind: "upload", label });
      return { done: (ok, detail) => (ok ? s.ok(detail) : s.fail(detail)) };
    };
    function addFile(spec, stepId) {
      const r = files.add({ ...spec, ...fileOpts });
      if (!r.ok) return r;
      made.push(r.file);
      send({ type: "file", file: { ...r.file }, stepId });
      return r;
    }
    function ask(approval, s) {
      const id = `ap_${newId()}`;
      const full = { id, ...approval };
      s.wait();
      return new Promise((resolve) => {
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          pending.get(requestId)?.delete(id);
          s.run();
          resolve(v);
        };
        const timer = setTimeout(() => finish({ decision: "deny", timeout: true }), approvalTimeoutMs);
        const onAbort = () => finish({ decision: "deny", cancelled: true });
        signal?.addEventListener("abort", onAbort, { once: true });
        if (!pending.has(requestId)) pending.set(requestId, new Map());
        pending.get(requestId).set(id, { approval: full, resolve: finish });
        send({ type: "approval", approval: full });
        if (signal?.aborted) onAbort();
      });
    }

    // ---- server files in results -> local files ----------------------------------------------------------
    async function download(url, maxBytes) {
      const res = await http.request({ url, method: "GET", as: "arrayBuffer", timeoutMs: maxBytes > 60 * 1048576 ? 600_000 : 120_000 });
      if (!res.ok || !res.buffer) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(res.buffer);
      if (buf.length > maxBytes) throw new Error("too large");
      return { buffer: buf, mime: String((res.headers && res.headers["content-type"]) || "").split(";")[0] };
    }
    async function materialize(result, s) {
      const seen = new Map();
      let count = 0;
      const savedTo = result && typeof result.saved_to === "string" ? result.saved_to : undefined;
      async function walk(node, depth) {
        if (!node || typeof node !== "object" || depth > 4 || count >= 20) return;
        if (Array.isArray(node)) { for (const x of node) await walk(x, depth + 1); return; }
        if (typeof node.download_url === "string" && /^https:\/\//.test(node.download_url)) {
          const url = node.download_url;
          let id = seen.get(url);
          if (!id) {
            count++;
            try {
              const isVideo = /^video\//.test(String(node.mime || ""));
              const got = await download(url, isVideo ? 300 * 1048576 : 50 * 1048576);
              const name = String(node.name || node.file || (node.path ? String(node.path).split("/").pop() : "") || "файл");
              const r = addFile({ name, mime: node.mime || got.mime, data: got.buffer, origin: "crm", savedTo, crm: { documentId: node.document_id, path: node.path }, maxBytes: 300 * 1048576 }, s.id);
              if (r.ok) id = r.file.id;
            } catch (e) {
              if (log) log.warn("agent.download_failed", { message: String((e && e.message) || e).slice(0, 80) });
            }
            if (id) seen.set(url, id);
          }
          if (id) node.download_url = `file:${id}`;
        }
        for (const [k, v] of Object.entries(node)) if (k !== "download_url" && v && typeof v === "object") await walk(v, depth + 1);
      }
      await walk(result, 0);
      return result;
    }

    // ---- function execution ----------------------------------------------------------------------------
    const crmAllowed = new Set(crmTools(await tools.manifest().catch(() => null)).map((t) => t.name));

    async function runCrm(args) {
      const tool = String((args && args.tool) || "");
      let input = args && args.input && typeof args.input === "object" && !Array.isArray(args.input) ? args.input : {};
      if (!crmAllowed.has(tool)) {
        if (tool === "email.send") return { ok: false, error: "email.send не е достъпен: подготви писмото с email.preview – служителят го изпраща от картата в програмата." };
        if (NEVER.has(tool)) return { ok: false, error: tool === "video.create" ? "За видео ползвай video_walk." : "Този инструмент не е достъпен от програмата." };
        return { ok: false, error: `Непознат инструмент на CRM: ${tool.slice(0, 60)}` };
      }
      input = normalizeInput(stripConfirm(input));
      const cls = classify(tool, input);
      // Plain step names for the server's file makers (CONTRACT §8.3: „Генерирам снимка“); every other tool: „CRM: …“.
      const own = GEN_LABEL[tool];
      const s = step({ kind: own ? own[0] : "crm", label: own ? own[1] : `CRM: ${toolLabel(tool)}`, tool, mutating: cls !== "auto" });
      let confirmed = false;

      async function askConfirm(kind) {
        const d = await ask({ kind, title: approvalTitle(tool), tool, lines: inputLines(input), json: approvalJson(input), allowAll: false }, s);
        if (d.decision === "deny") return false;
        const yes = await confirm(`${approvalTitle(tool)}`, `Инструмент: ${tool}\n\n${approvalJson(input, 3000)}\n\nДействието е важно и може да не може да бъде отменено.`, { okLabel: "Потвърждавам", cancelLabel: "Отказ" });
        return !!yes;
      }

      if (cls === "approval" && !state.allowAll) {
        const d = await ask({ kind: "crm_write", title: approvalTitle(tool), tool, lines: inputLines(input), json: approvalJson(input), allowAll: true }, s);
        if (d.decision === "deny") { s.denied(); return { ok: false, error: d.timeout ? "Няма отговор от служителя 10 минути – действието не е изпълнено." : "Служителят отказа." }; }
        if (d.decision === "allow_all") state.allowAll = true;
      } else if (cls === "confirm") {
        if (!(await askConfirm("confirm"))) { s.denied(); return { ok: false, error: "Служителят отказа." }; }
        confirmed = true;
      }
      let sendInput = confirmed ? { ...input, confirm: true } : input;
      try {
        if (uploads.hasRefs(sendInput)) sendInput = await uploads.resolve(sendInput, subStep);
      } catch (e) {
        s.fail(e.message);
        return { ok: false, error: e.message };
      }
      let r = await tools.call(tool, sendInput);
      if (!r.ok && !confirmed && asksConfirm(r)) {
        // Refused before execution: the employee decides, then exactly one retry with confirm:true.
        if (!(await askConfirm("confirm"))) { s.denied(); return { ok: false, error: "Служителят отказа." }; }
        r = await tools.call(tool, { ...sendInput, confirm: true });
      }
      if (!r.ok) {
        if (r.maybeExecuted) {
          s.fail("може да е изпълнено – проверете в CRM");
          return { ok: false, maybeExecuted: true, error: `${r.error} Не е ясно дали действието е изпълнено – проверете в CRM.` };
        }
        s.fail(r.error);
        return { ok: false, error: r.error, ...(r.status ? { status: r.status } : {}) };
      }
      const result = r.result && typeof r.result === "object" ? structuredClone(r.result) : r.result;
      if (tool === "email.preview" && result && typeof result === "object") send({ type: "email", email: result });
      if (result && typeof result === "object") await materialize(result, s);
      s.ok();
      return { ok: true, result };
    }

    // A „web“ card: the employee sees the full address (or query) before it leaves the PC. -> true when allowed.
    async function askWeb(s, title, lines) {
      if (state.allowWeb) return true;
      const d = await ask({ kind: "web", title, lines, allowAll: true }, s);
      if (d.decision === "deny") { s.denied(); return false; }
      if (d.decision === "allow_all") state.allowWeb = true;
      return true;
    }
    // read_page / fetch_image: -> null when the URL may be fetched, else the function output.
    async function urlGate(url, s) {
      const raw = String(url || "");
      if (raw.length > URL_MAX) { s.fail("адресът е твърде дълъг"); return { ok: false, error: `Адресът е над ${URL_MAX} знака и не се отваря.` }; }
      const n = normUrl(raw);
      if (!n || known.has(n) || !state.tainted) return null;
      const allowed = await askWeb(s, "Тед иска да отвори адрес, който сам е съставил", [["Адрес", raw], ["Защо питаме", "Адресът не е от вашите съобщения, от търсенето или от прочетена страница, а в разговора има данни от CRM или файлове."]]);
      return allowed ? null : { ok: false, error: "Служителят не разреши този адрес. Ползвай адреси от търсенето или от прочетените страници." };
    }
    async function runLocal(name, args) {
      const web = (v) => ({ untrusted: true, source: "web", ...v });
      if (name === "web_search") {
        if (!browseOn) return { ok: false, error: "Интернетът е изключен в Настройки → Браузър." };
        const q = String((args && args.query) || "").slice(0, 300);
        const s = step({ kind: "web_search", label: `Търся в интернет: ${q}` });
        // After private data entered the context, a query with phones/e-mails/ЕГН that the employee did not type
        // goes out only after a card.
        const foreign = state.tainted ? personalTokens(q).filter((t) => !(t.includes("@") ? userLower.includes(t.toLowerCase()) : userDigits.includes(t.replace(/\D/g, "")))) : [];
        if (foreign.length && !(await askWeb(s, "Тед иска да търси в интернет с лични данни", [["Търсене", q], ["Лични данни", foreign.join(", ")]]))) {
          return { ok: false, error: "Служителят не разреши търсене с тези данни." };
        }
        const r = await search({ query: q, n: args && args.n }, { signal });
        if (r.ok) s.ok(`${r.results.length} резултата`); else s.fail(r.error);
        return web(r);
      }
      if (name === "read_page") {
        if (!browseOn) return { ok: false, error: "Интернетът е изключен в Настройки → Браузър." };
        if (state.read_page >= limits.read_page) return { ok: false, error: `${LIMIT_TEXT} (четене на страници: ${limits.read_page}).` };
        state.read_page++;
        const s = step({ kind: "read_page", label: `Чета страница: ${hostPath(args && args.url)}` });
        const blockedUrl = await urlGate(args && args.url, s);
        if (blockedUrl) return blockedUrl;
        const maxChars = Math.max(1000, Math.min(40000, Number(args && args.maxChars) || 20000));
        const r = await pages.readPage({ url: args && args.url, maxChars }, { signal });
        if (!r.ok) { s.fail(r.error); return web(r); }
        if (r.file) {
          const f = addFile({ name: r.file.name, mime: r.file.mime, data: r.file.buffer, origin: "web", sourceUrl: r.file.sourceUrl }, s.id);
          if (!f.ok) { s.fail(f.error); return { ok: false, error: f.error }; }
          s.ok("PDF файл");
          return web({ ok: true, url: r.url, file: `file:${f.file.id}`, name: f.file.name, kind: "pdf", note: "Страницата е PDF – прочети го с read_document." });
        }
        s.ok(r.title ? r.title.slice(0, 80) : undefined);
        // The text is cut so the whole result fits the output limit of this function.
        const page = { ok: true, url: r.url, title: r.title, phones: r.phones, emails: r.emails, prices: r.prices, images: r.images.slice(0, 40), links: r.links.slice(0, 80) };
        const room = Math.max(1000, maxChars + 8000 - JSON.stringify(page).length - 200);
        return web({ ...page, text: r.text.slice(0, Math.min(maxChars, room)), truncated: r.truncated || r.text.length > Math.min(maxChars, room) });
      }
      if (name === "fetch_image") {
        if (!browseOn) return { ok: false, error: "Интернетът е изключен в Настройки → Браузър." };
        if (state.fetch_image >= limits.fetch_image) return { ok: false, error: `${LIMIT_TEXT} (снимки от интернет: ${limits.fetch_image}).` };
        state.fetch_image++;
        const s = step({ kind: "fetch_image", label: `Изтеглям снимка: ${hostPath(args && args.url)}` });
        const blockedUrl = await urlGate(args && args.url, s);
        if (blockedUrl) return blockedUrl;
        const r = await pages.fetchImage({ url: args && args.url }, { signal });
        if (!r.ok) { s.fail(r.error); return web(r); }
        const f = addFile({ name: r.file.name, mime: r.file.mime, data: r.file.buffer, origin: "web", sourceUrl: r.file.sourceUrl }, s.id);
        if (!f.ok) { s.fail(f.error); return { ok: false, error: f.error }; }
        s.ok();
        return web({ ok: true, file: `file:${f.file.id}`, name: f.file.name, mime: f.file.mime, sourceUrl: r.file.sourceUrl });
      }
      if (name === "create_document") {
        const fmt = String((args && args.format) || "").toLowerCase();
        const title = String((args && args.title) || "Документ").slice(0, 120);
        const s = step({ kind: "doc", label: `Правя документ: ${title}.${fmt || "?"}` });
        try {
          const images = (id) => {
            const f = files.get(id);
            return f && f.ref.kind === "image" ? { buffer: f.bytes, mime: f.ref.mime } : null;
          };
          const doc = await createDocument(args, { images });
          const f = addFile({ name: doc.name, mime: doc.mime, data: doc.buffer, origin: "ted", pages: doc.pages, sheets: doc.sheets, maxBytes: 60 * 1048576 }, s.id);
          if (!f.ok) { s.fail(f.error); return { ok: false, error: f.error }; }
          s.ok(`${f.file.name} · ${humanSize(f.file.size)}`);
          return { ok: true, file: { id: `file:${f.file.id}`, name: f.file.name, size: f.file.size, ...(doc.pages ? { pages: doc.pages } : {}), ...(doc.sheets ? { sheets: doc.sheets } : {}) } };
        } catch (e) {
          s.fail(e.message);
          return { ok: false, error: e.code === "invalid" ? e.message : "Документът не можа да бъде направен." };
        }
      }
      if (name === "read_document") {
        const m = FILE_REF.exec(String((args && args.file) || ""));
        const ref = m && files.ref(m[1]);
        if (!ref) return { ok: false, error: "Файлът не е намерен. Подай го като \"file:<id>\"." };
        const s = step({ kind: "read_doc", label: `Чета файла: ${ref.name}` });
        const r = await files.extract(ref.id);
        if (!r.ok) { s.fail(r.error); return { ok: false, error: r.error, ...(ref.kind === "image" ? { note: "За снимки ползвай crm analyze_image с path \"file:<id>\"." } : {}) }; }
        s.ok(r.doc.pages ? `${r.doc.pages} стр.` : undefined);
        const d = r.doc;
        return { ok: true, name: d.name, kind: d.kind, ...(d.pages ? { pages: d.pages } : {}), ...(d.sheets ? { sheets: d.sheets.map((x) => ({ name: x.name, rows: x.rows.length })) } : {}), text: d.text, truncated: d.truncated, ...(d.note ? { note: d.note.replace("file:<id>", `file:${ref.id}`) } : {}) };
      }
      if (name === "update_canvas") {
        const text = String((args && args.text) || "");
        if (!text.trim() || text.length > 200_000) return { ok: false, error: "Текстът за Canvas е празен или над 200 000 знака." };
        const label = String((args && args.label) || "нова версия").slice(0, 80);
        const s = step({ kind: "canvas", label: `Canvas: ${label}` });
        state.canvasVersion += 1;
        send({ type: "canvas", canvas: { ...(args.title ? { title: String(args.title).slice(0, 120) } : {}), text, label } });
        s.ok();
        return { ok: true, version: state.canvasVersion };
      }
      if (name === "video_walk") {
        if (!video) return { ok: false, error: "Видео не е достъпно в тази версия." };
        const s = step({ kind: "video", label: "Видео на имот" });
        const fileIds = (Array.isArray(args && args.files) ? args.files : []).map((x) => (FILE_REF.exec(String(x)) || [])[1]).filter(Boolean);
        const prep = await video.prepare({ code: args && args.code, fileIds, prompt: args && args.prompt, chatId: req.chatId, temporary: !!req.temporary });
        if (!prep.ok) {
          if (prep.job) send({ type: "video", job: prep.job });
          s.fail(prep.error);
          return { ok: false, status: prep.code, error: prep.error, ...(prep.candidates ? { candidates: prep.candidates } : {}) };
        }
        const job = prep.job;
        send({ type: "video", job });
        const d = await ask({
          kind: "video", title: "Платено AI видео", allowAll: false,
          lines: [["Имот", job.source.title || job.source.code || "прикачени снимки"], ["Части", String(job.parts.length)], ["Формат", job.aspect]],
          video: { engines: job.engines, gateway: job.gateway, parts: job.parts.length, aspect: job.aspect, defaults: job.defaults },
        }, s);
        if (d.decision === "deny") {
          await video.cancel({ jobId: job.id });
          s.denied();
          return { ok: false, status: "denied", error: d.timeout ? "Няма отговор от служителя – видеото не е започнато." : "Служителят отказа видеото." };
        }
        const st = await video.start({ jobId: job.id, engine: d.options.engine, duration: d.options.duration });
        if (!st.ok) { s.fail(st.error); return { ok: false, status: st.code || "failed", error: st.error }; }
        s.ok("започна");
        const cur = video.get(job.id) || job;
        return { ok: true, status: "started", parts: cur.parts.length, est: cur.est, note: "Видеото се прави на сървъра и се показва в картата на видеото; не твърди, че е готово." };
      }
      if (name === "listings_find") {
        const a = args && typeof args === "object" ? args : {};
        const tool = a.url || a.text ? "listings.collect_page" : "listings.find_owners";
        const input = Object.fromEntries(Object.entries(a).filter(([k, v]) => ["place", "region", "site", "url", "text"].includes(k) && v != null && v !== "").map(([k, v]) => [k, String(v).slice(0, k === "text" ? 20000 : 300)]));
        const s = step({ kind: "listings", label: tool === "listings.collect_page" ? "Събирам обяви в „Събрани“" : `Търся собственици: ${input.place || input.region || ""}`, tool, mutating: true });
        if (!state.allowAll) {
          const d = await ask({ kind: "crm_write", title: approvalTitle(tool), tool, lines: inputLines(input), json: approvalJson(input), allowAll: true }, s);
          if (d.decision === "deny") { s.denied(); return { ok: false, error: "Служителят отказа." }; }
          if (d.decision === "allow_all") state.allowAll = true;
        }
        const r = await tools.call(tool, input);
        if (!r.ok) { s.fail(r.maybeExecuted ? "може да е изпълнено – проверете в CRM" : r.error); return { ok: false, error: r.error, ...(r.maybeExecuted ? { maybeExecuted: true } : {}) }; }
        s.ok();
        return { ok: true, result: r.result };
      }
      return { ok: false, error: "Непознат инструмент" };
    }

    async function execute(call) {
      const name = callName(call);
      if (!name) return { cap: OUTPUT_CAP, value: { ok: false, error: "Непознат инструмент" } };
      let args;
      try { args = call.arguments ? JSON.parse(call.arguments) : {}; } catch { return { cap: OUTPUT_CAP, value: { ok: false, error: "Аргументите не са валиден JSON." } }; }
      if (!args || typeof args !== "object" || Array.isArray(args)) args = {};
      try {
        const value = name === "crm" ? await runCrm(args) : await runLocal(name, args);
        const cap = name === "read_document" ? 64_000 : name === "read_page" ? Math.min(48_000, (Number(args.maxChars) || 20000) + 8000) : OUTPUT_CAP;
        // What the model now sees: URLs in it are not model-built; CRM data and documents taint the context.
        urlsIn(capOutput(value, cap), addKnown);
        if (TAINTING.has(name)) state.tainted = true;
        return { cap, value };
      } catch (e) {
        if (signal?.aborted) throw new RgError("aborted");
        if (log) log.error("agent.tool_failed", { tool: name, message: String((e && e.message) || e).slice(0, 200) });
        const kind = STEP_KIND[name] || "crm";
        step({ kind, label: `Грешка: ${name}` }).fail("вътрешна грешка");
        return { cap: OUTPUT_CAP, value: { ok: false, error: "Вътрешна грешка при изпълнението." } };
      }
    }

    // ---- context: project (case) and role ---------------------------------------------------------------
    let kase = null;
    if (req.caseId) {
      const s = step({ kind: "crm", label: "CRM: казуси.преглед", tool: "cases.get" });
      const r = await tools.call("cases.get", { id: req.caseId });
      if (r.ok) { kase = r.result; s.ok(); state.tainted = true; } else s.fail(r.error);
    }
    const role = req.role ? await tools.rolePrompt(req.role).catch(() => null) : null;

    let effort = req.effort;
    if (hints.includes("thinking") && (!effort || ["none", "minimal", "low", "medium"].includes(effort))) effort = "high";
    if (effort != null && !EFFORTS.includes(effort)) effort = undefined;
    const manifest = await tools.manifest().catch(() => null);
    const base = {
      model,
      // The employee's own text (Настройки → Персонализиране) and nick come with the request or from the settings.
      instructions: buildInstructions({
        mode: modeKey, hints, kase, role, browse: browseOn,
        nick: req.nick || (typeof settings.nick === "string" ? settings.nick : ""),
        custom: req.custom || (typeof settings.instructions === "string" ? settings.instructions : ""),
      }),
      input: buildInput(prepareMessages(messages, { files, canvas: req.canvas })),
      store: false,
      stream: true,
      tools: buildTools({ manifest, browse: browseOn }),
    };
    if (effort) base.reasoning = { effort };

    // ---- rounds --------------------------------------------------------------------------------------------
    const m = memo(model);
    const tried = { effort: false, flat: false, ids: false };
    let effortIgnored = false;

    function bodyFor() {
      let b = { ...base };
      if (m.noEffort && b.reasoning) { delete b.reasoning; effortIgnored = true; }
      if (m.flat) b.tools = flattenTools(b.tools);
      if (m.noIds) b.input = stripIds(b.input);
      return assertRequest(b);
    }

    async function roundTrip() {
      for (;;) {
        const body = bodyFor();
        const prefix = fullText() ? `${fullText()}\n\n` : "";
        const r = await stream(body, prefix);
        if (r.ok || r.status !== 400) return r;
        const { code, param } = serverError(r.error);
        const p = String(param || "");
        const message = String((r.error && r.error.error && r.error.error.message) || "");
        if (p.startsWith("reasoning") && body.reasoning && !tried.effort) { tried.effort = true; m.noEffort = true; continue; }
        const toolsIssue = p.startsWith("tools") || /namespace/i.test(p) || (!p && code === "subscription_sharing_unsupported_capability" && /tool|namespace|function/i.test(message || "tool"));
        if (toolsIssue) {
          if (!m.flat && !tried.flat) { tried.flat = true; m.flat = true; continue; }
          return { ok: false, toolsUnsupported: true, status: 400, error: r.error };
        }
        if (p.startsWith("input") && !tried.ids && !m.noIds) { tried.ids = true; m.noIds = true; continue; }
        return r;
      }
    }

    let limitedInfo = null;
    let finalRound = false;
    for (let round = 1; ; round++) {
      if (signal?.aborted) throw new RgError("aborted");
      const r = await roundTrip();
      if (!r.ok) {
        if (r.toolsUnsupported) {
          if (log) log.warn("agent.tools_unsupported", { model });
          return fail("tools_unsupported", null, partial());
        }
        return apiFailure(r.status, r.error, partial());
      }
      const outcome = r.outcome;
      const roundText = outcome.text || (outcome.kind === "completed" ? outputText(outcome.response) : "");
      texts.push(roundText);
      if (outcome.kind === "incomplete") {
        return fullText() ? { ...partial(), ok: true, text: fullText(), model: outcome.response?.model || model, incomplete: true, ...(effortIgnored ? { effortIgnored: true } : {}) } : fail("incomplete", outcome.reason, partial());
      }
      if (outcome.kind === "failed") return apiFailure(0, { error: outcome.error }, partial(), "failed");
      if (outcome.kind !== "completed") return fail("stream_interrupted", null, partial());

      const items = outputItems(outcome);
      const calls = items.filter((i) => i && i.type === "function_call");
      const answerModel = typeof outcome.response?.model === "string" ? outcome.response.model : model;
      if (!calls.length || finalRound) {
        if (calls.length && finalRound && log) log.warn("agent.calls_after_limit", { n: calls.length });
        let text = fullText();
        if (!text && limitedInfo) text = `Търсенето спря на лимита: ${limitedInfo.rounds} кръга / ${limitedInfo.calls} извиквания. Напишете „продължи“, за да продължа.`;
        if (!text && !made.length) return fail("empty", null, partial());
        return {
          ...partial(), ok: true, text: text || "Готово – вижте файловете по-долу.", model: answerModel,
          ...(effortIgnored ? { effortIgnored: true } : {}), ...(limitedInfo ? { limited: limitedInfo } : {}),
        };
      }

      // Echo the model's own items verbatim, then one output per call.
      for (const it of items) {
        if (it.type === "function_call" || (it.type === "message" && it.role === "assistant")) base.input.push(it);
        else if (it.type === "reasoning" && it.encrypted_content) base.input.push(it);
      }
      const capReached = () => state.calls >= limits.calls || now() - started > limits.wallMs || round >= limits.rounds;
      for (const call of calls) {
        let out;
        if (capReached()) {
          state.limitHit = true;
          out = capOutput({ ok: false, error: LIMIT_TEXT });
        } else {
          state.calls++;
          const { cap, value } = await execute(call);
          out = capOutput(value, cap);
        }
        base.input.push({ type: "function_call_output", call_id: String(call.call_id), output: out });
      }
      if (state.limitHit) {
        limitedInfo = { rounds: round, calls: state.calls };
        send({ type: "limit", rounds: round, calls: state.calls });
        finalRound = true;
      }
    }
  }

  async function runSafe(req) {
    try {
      return await run(req);
    } finally {
      cancelApprovals(req.requestId);
    }
  }

  return { run: runSafe, approve, cancelApprovals };
}
