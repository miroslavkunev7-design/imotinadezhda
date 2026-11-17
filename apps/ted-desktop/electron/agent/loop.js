// The Real GPT agent (docs/CONTRACT.md §9): the GPT model of the employee's ChatGPT plan is the brain – and the only
// AI: no tool here calls another AI (§9.6: no Ted server chat, no Gemini/AI Gateway tools, no server search, no
// AI video). Ted's own tools are the hands. One answer = up to N rounds of POST /v1/responses (stateless: the whole input is resent),
// each round's function calls executed here one by one through the gate, their results appended as
// function_call_output items. Steps, files, approvals, canvas versions, e-mail drafts and „Отвори в ChatGPT“ cards are
// pushed to the renderer as AgentEvents; statuses come only from real results.
import { apiFailure, fail, RgError, serverError, toFailure } from "../realgpt/errors.js";
import { assertRequest, buildInput, EFFORTS, outputItems, outputText } from "../realgpt/responses.js";
import { aiOff, aiRefusal, approvalJson, approvalTitle, asksConfirm, classify, inputLines, NEVER, normalizeInput, stripConfirm, toolLabel } from "./gate.js";
import { CHATGPT_PROMPT_MAX, HANDOFF_KINDS, cleanPrompt, fitsLink } from "./chatgpt-link.js";
import { buildInstructions } from "./instructions.js";
import { buildTools, callName, crmTools } from "./tools-spec.js";
import { FILE_REF } from "./uploads.js";
import { PHOTO_MAX, PHOTO_MIN_BYTES } from "../projects.js";
import { createDocument } from "../docs/create.js";

// Step names of the server tools that make files (PDFs, downloaded photos; none runs an AI) – the rest read „CRM: <tool>“.
const GEN_LABEL = {
  // images.download WITHOUT a CRM target: the server downloads web photos into Ted's folder „Тед“ (with a target the
  // step is „Добавям снимки в галерията“ – genLabel below).
  "images.download": ["fetch_image", "Сървърът тегли снимки в папка „Тед“"], "documents.merge": ["doc", "Обединявам документи"],
  "documents.split": ["doc", "Разделям документ"], "documents.create_pdf": ["doc", "Правя PDF"], "files.to_pdf": ["doc", "Правя PDF от файловете"],
};
// open_in_chatgpt cards per answer (each is only a card; nothing opens without a click).
export const HANDOFF_MAX = 6;
// project_folder export_zip: ZIP files kept per answer (each a full copy of the folder, up to 500 MB).
export const ZIP_PER_ANSWER = 2;
// The site's gallery (api/_ted-skills.js images.download): photos of 15 000 bytes or less are skipped, 30 at most.
export { PHOTO_MAX, PHOTO_MIN_BYTES };
const photoCount = (input) => (Array.isArray(input && input.urls) ? input.urls.filter((u) => FILE_REF.test(String(u))).length : 0);
// The „Файлове“ line of a folder card: whole names only, never cut mid-name; the rest is counted (review F6).
export function fileListLine(list, max = 600) {
  const names = [];
  let len = 0;
  for (const f of list) {
    const n = `„${f.name}“`;
    if (names.length && len + n.length + 2 > max) break;
    names.push(n); len += n.length + 2;
  }
  const rest = list.length - names.length;
  return `${list.length}: ${names.join(", ")}${rest ? ` …и още ${rest} – вижте „Точните данни“` : ""}`;
}
const HANDOFF_BG = { image: "снимка", video: "видео", research: "проучване", other: "заявка" };

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

// What the model SEES of attached files (CONTRACT §9.6): images as input_image and PDFs as input_file, read by GPT
// itself – no server analysis. Newest messages first within these budgets (raw bytes; base64 adds a third); a file
// over a budget stays a text line and the model reads it with read_document.
export const MEDIA = { images: 8, imageBytes: 20 * 1048576, oneImage: 8 * 1048576, docs: 5, docBytes: 16 * 1048576, onePdf: 10 * 1048576 };
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Messages from the renderer -> model messages: attached files become text lines (+ the image/PDF itself when it
// fits), the open Canvas goes with the last user message. media:false = text lines only.
export function prepareMessages(messages, { files, canvas, media = true } = {}) {
  // Pass 1, newest message first: which files go along as input_image / input_file.
  const attach = new Map(); // `${messageIndex}:${fileId}` -> "image" | "doc" | "over"
  const left = { images: MEDIA.images, imageBytes: MEDIA.imageBytes, docs: MEDIA.docs, docBytes: MEDIA.docBytes };
  for (let i = messages.length - 1; i >= 0 && media && files; i--) {
    const m = messages[i];
    if (!m || m.role !== "user" || !Array.isArray(m.files)) continue;
    let perImages = Array.isArray(m.images) ? m.images.length : 0;
    let perDocs = 0;
    for (const id of m.files) {
      const ref = files.ref(id);
      if (!ref) continue;
      const isImage = ref.kind === "image" && IMAGE_MIMES.has(ref.mime);
      const isPdf = ref.kind === "pdf" && ref.mime === "application/pdf";
      if (!isImage && !isPdf) continue;
      const size = Number(ref.size) || 0;
      const fits = isImage
        ? size > 0 && size <= MEDIA.oneImage && size <= left.imageBytes && left.images > 0 && perImages < MEDIA.images
        : size > 0 && size <= MEDIA.onePdf && size <= left.docBytes && left.docs > 0 && perDocs < MEDIA.docs;
      const entry = fits && typeof files.get === "function" ? files.get(id) : null;
      if (!entry || !entry.bytes || !entry.bytes.length) { attach.set(`${i}:${id}`, "over"); continue; }
      if (isImage) { left.images--; left.imageBytes -= entry.bytes.length; perImages++; attach.set(`${i}:${id}`, "image"); }
      else { left.docs--; left.docBytes -= entry.bytes.length; perDocs++; attach.set(`${i}:${id}`, "doc"); }
    }
  }
  const out = messages.map((m, i) => {
    if (m.role !== "user" || !Array.isArray(m.files) || !m.files.length) return { role: m.role, text: m.text, ...(m.images ? { images: m.images } : {}) };
    const images = Array.isArray(m.images) ? [...m.images] : [];
    const docs = [];
    const lines = m.files.map((id) => {
      const ref = files && files.ref(id);
      if (!ref) return `[Прикачен файл: file:${id} · не е намерен на този компютър]`;
      const how = attach.get(`${i}:${id}`);
      let tail = "";
      if (how === "image" || how === "doc") {
        const entry = files.get(id);
        const data = Buffer.from(entry.bytes).toString("base64");
        if (how === "image") { images.push({ mime: ref.mime, data }); tail = " · снимката е приложена към съобщението"; }
        else { docs.push({ name: String(ref.name || "документ.pdf").slice(0, 180), mime: "application/pdf", data }); tail = " · PDF-ът е приложен към съобщението"; }
      } else if (how === "over") {
        tail = ref.kind === "pdf" ? " · не е приложен (над лимита за размер или брой) – прочети го с read_document" : " · не е приложена (над лимита за размер или брой)";
      }
      return `[Прикачен файл: ${ref.name} · ${KIND_BG[ref.kind] || "файл"} · ${humanSize(ref.size)} · file:${ref.id}${ref.note ? ` · ${ref.note}` : ""}${tail}]`;
    });
    return {
      role: "user", text: [m.text, ...lines].filter((x) => x && String(x).trim()).join("\n"),
      ...(images.length ? { images } : {}), ...(docs.length ? { docs } : {}),
    };
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

// The corrected resend when the plan route refuses input_file: every attached PDF becomes a note (read_document).
export function withoutDocs(items) {
  return items.map((it) => {
    if (!it || it.type !== "message" || !Array.isArray(it.content) || !it.content.some((c) => c && c.type === "input_file")) return it;
    return { ...it, content: it.content.map((c) => (c && c.type === "input_file" ? { type: "input_text", text: `[PDF „${String(c.filename || "").slice(0, 180)}“ не се прие като файл от плана – прочети го с read_document по file:<id> от реда за прикачения файл.]` } : c)) };
  });
}
const hasDocs = (items) => items.some((it) => it && Array.isArray(it.content) && it.content.some((c) => c && c.type === "input_file"));

// What OpenAI refused, for the employee (plain text, no markup): status, server code, the named parameter, message.
export function refusalOf(status, body) {
  const e = body && typeof body === "object" && body.error && typeof body.error === "object" ? body.error : (body && typeof body === "object" ? body : {});
  const clean = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : "");
  const out = { status: Number(status) || 0 };
  const code = clean(e.code, 80); const param = clean(e.param, 80); const message = clean(e.message || body?.detail, 300);
  if (code) out.code = code;
  if (param) out.param = param;
  if (message) out.message = message;
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
const TAINTING = new Set(["crm", "read_document"]);
const STEP_KIND = { web_search: "web_search", read_page: "read_page", fetch_image: "fetch_image", create_document: "doc", read_document: "read_doc", update_canvas: "canvas", open_in_chatgpt: "chatgpt", project_folder: "folder" };
// project_folder (0.1.5, CONTRACT §8.12): the folder of a Проект on this computer.
export const FOLDER_ACTIONS = ["create", "add", "list", "export_zip", "save_to_crm"];
export const FOLDER_ADD_MAX = 50;
// cases.get of the selected Проект is read again only after this time or after a CRM change (no identical requests).
export const CASE_TTL_MS = 90_000;

// tools = the guarded CRM transport (gate.js guardTools); search = the local DuckDuckGo search only – there is no
// server fallback and no other AI behind any of these (CONTRACT §9.6).
export function createAgent({
  tools, files, uploads, pages = null, search = null, http, confirm, getSettings = () => ({}), log, projects = null,
  now = Date.now, approvalTimeoutMs = APPROVAL_TIMEOUT_MS, newId = () => Math.random().toString(16).slice(2, 10),
}) {
  const pending = new Map(); // requestId -> Map(approvalId -> {resolve, approval})
  const remembered = new Map(); // model -> {noEffort, flat, noIds}
  const caseCache = new Map(); // caseId -> {at, value}: cases.get of the selected Проект (CASE_TTL_MS)

  function memo(model) {
    if (!remembered.has(model)) remembered.set(model, { noEffort: false, flat: false, noIds: false, noDocs: false });
    return remembered.get(model);
  }

  function approve({ requestId, approvalId, decision, options } = {}) {
    const p = pending.get(requestId);
    const entry = p && p.get(approvalId);
    if (!entry) return { ok: false, error: "Това одобрение вече не е активно." };
    if (!["allow", "deny", "allow_all"].includes(decision)) return { ok: false, error: "Невалиден избор." };
    if (decision === "allow_all" && !entry.approval.allowAll) return { ok: false, error: "„Разреши всички“ не важи за това действие." };
    p.delete(approvalId);
    entry.resolve({ decision });
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
    const state = { allowAll: false, allowWeb: false, canvasVersion: Number(req.canvas && req.canvas.version) || 0, calls: 0, read_page: 0, fetch_image: 0, handoffs: 0, limitHit: false, zips: new Map() };
    const send = (ev) => { try { emit(ev); } catch { /* window gone */ } };
    // caseId/caseTitle: files made in a chat of a Проект go into its folder (set once the case is read below).
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
    function addFile(spec, stepId, { project = true } = {}) {
      const opts = project ? fileOpts : { chatId: fileOpts.chatId, temporary: fileOpts.temporary };
      const r = files.add({ ...spec, ...opts });
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

    // A copy of an input for the approval card: "file:<id>" -> „<name>“ (the id stays in „Точните данни“).
    function namedRefs(v, depth = 0) {
      if (depth > 6) return v;
      if (typeof v === "string") {
        const m = FILE_REF.exec(v);
        const ref = m && files.ref(m[1]);
        return ref ? `„${ref.name}“` : v;
      }
      if (Array.isArray(v)) return v.map((x) => namedRefs(x, depth + 1));
      if (!v || typeof v !== "object") return v;
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, namedRefs(x, depth + 1)]));
    }
    // ["file:<id>" | https…] -> the same list with every file of this program as a signed link of its CRM copy.
    async function signedFileUrls(urls) {
      const paths = new Map();
      for (const u of urls) {
        const m = FILE_REF.exec(String(u));
        if (m && !paths.has(u)) paths.set(u, (await uploads.ensure(m[1], subStep)).path);
      }
      if (!projects || typeof projects.signed !== "function") throw new Error("Снимките от чата не могат да се подготвят за CRM.");
      const links = await projects.signed([...new Set(paths.values())]);
      return urls.map((u) => (paths.has(u) ? links.get(paths.get(u)) : u)).filter((u) => typeof u === "string" && /^https?:\/\//.test(u));
    }

    async function runCrm(args) {
      const tool = String((args && args.tool) || "");
      let input = args && args.input && typeof args.input === "object" && !Array.isArray(args.input) ? args.input : {};
      // Another AI on Ted's server (any spelling of the name): refused before anything else, with what to do instead.
      const ai = aiRefusal(tool, {});
      if (ai) return ai;
      if (!crmAllowed.has(tool)) {
        if (tool === "email.send") return { ok: false, error: "email.send не е достъпен: подготви писмото с email.preview – служителят го изпраща от картата в програмата." };
        if (NEVER.has(tool)) return { ok: false, error: "Този инструмент не е достъпен от програмата." };
        return { ok: false, error: `Непознат инструмент на CRM: ${tool.slice(0, 60)}` };
      }
      // The AI switches of plain tools (documents.inspect classify, files.to_pdf group_by_type) are always off.
      input = aiOff(tool, normalizeInput(stripConfirm(input)));
      // Photos of this program for a property's gallery: the site skips photos of 15 KB or less and takes at most 30
      // at once (api/_ted-skills.js images.download) – such photos are left out BEFORE the card, so the card shows
      // exactly what is sent and the model hears which were skipped (review F12).
      let skippedPhotos = [];
      if (tool === "images.download" && Array.isArray(input.urls) && input.urls.some((u) => FILE_REF.test(String(u)))) {
        const keep = [];
        for (const u of input.urls) {
          const m = FILE_REF.exec(String(u));
          const ref = m && files.ref(m[1]);
          if (ref && (ref.size || 0) <= PHOTO_MIN_BYTES) skippedPhotos.push({ name: ref.name, why: "15 KB или по-малка – сайтът не приема толкова малки снимки в галерията" });
          else if (keep.length >= PHOTO_MAX) skippedPhotos.push({ name: ref ? ref.name : String(u), why: `над ${PHOTO_MAX} снимки наведнъж – изпрати ги с второ извикване` });
          else keep.push(u);
        }
        if (!keep.length) return { ok: false, error: "Няма снимки за галерията.", skipped: skippedPhotos };
        input = { ...input, urls: keep, max: keep.length };
      }
      const cls = classify(tool, input);
      // Files of THIS computer going to a CRM record (photos into a gallery, files.attach of a chat file): always their
      // own card, never covered by an earlier „Разреши всички“ (review F4).
      const localToCrm = cls === "approval" && uploads.hasRefs(input);
      // Plain step names for the server's file makers (CONTRACT §8.3: „Правя PDF“); every other tool: „CRM: …“.
      const own = tool === "images.download" && cls === "approval"
        ? ["image", `Добавям снимки в галерията${input.property_code ? ` на имот ${String(input.property_code).slice(0, 40)}` : ""}`]
        : GEN_LABEL[tool];
      const s = step({ kind: own ? own[0] : "crm", label: own ? own[1] : `CRM: ${toolLabel(tool)}`, tool, mutating: cls !== "auto" });
      let confirmed = false;

      // The card names files of this program by their names („снимка.jpg“), not by "file:<id>".
      const shown = namedRefs(input);
      async function askConfirm(kind) {
        const d = await ask({ kind, title: approvalTitle(tool), tool, lines: inputLines(shown), json: approvalJson(input), allowAll: false }, s);
        if (d.decision === "deny") return false;
        const yes = await confirm(`${approvalTitle(tool)}`, `Инструмент: ${tool}\n\n${approvalJson(input, 3000)}\n\nДействието е важно и може да не може да бъде отменено.`, { okLabel: "Потвърждавам", cancelLabel: "Отказ" });
        return !!yes;
      }

      // The server fetches web addresses of images.download itself: an address the model built in a context with CRM
      // data needs the same „web“ card as read_page/fetch_image (CONTRACT §9.3 rule 8, review F10).
      if (tool === "images.download") {
        const web = [...(Array.isArray(input.urls) ? input.urls : []), input.page_url].filter((u) => typeof u === "string" && /^https?:\/\//i.test(u));
        const foreign = state.tainted ? web.filter((u) => { const n = normUrl(u); return !n || !known.has(n); }) : [];
        if (foreign.length) {
          const allowed = await askWeb(s, "ChatGPT иска сървърът на Тед да изтегли адрес, който сам е съставил", [
            ["Адрес", foreign.slice(0, 5).join("\n") + (foreign.length > 5 ? `\n…и още ${foreign.length - 5}` : "")],
            ["Защо питаме", "Адресът не е от вашите съобщения, от търсенето или от прочетена страница, а в разговора има данни от CRM или файлове. Сървърът на Тед ще го отвори."]]);
          if (!allowed) return { ok: false, error: "Служителят не разреши този адрес. Ползвай адреси от търсенето или от прочетените страници." };
        }
      }

      if (cls === "approval" && (!state.allowAll || localToCrm)) {
        const d = await ask({ kind: "crm_write", title: approvalTitle(tool, input, { photos: photoCount(input) }), tool, lines: inputLines(shown), json: approvalJson(input), allowAll: !localToCrm }, s);
        if (d.decision === "deny") { s.denied(); return { ok: false, error: d.timeout ? "Няма отговор от служителя 10 минути – действието не е изпълнено." : "Служителят отказа." }; }
        if (d.decision === "allow_all" && !localToCrm) state.allowAll = true;
      } else if (cls === "confirm") {
        if (!(await askConfirm("confirm"))) { s.denied(); return { ok: false, error: "Служителят отказа." }; }
        confirmed = true;
      }
      let sendInput = confirmed ? { ...input, confirm: true } : input;
      try {
        // Photos of the chat into a property's gallery (0.1.5): images.download takes web links, so every "file:<id>"
        // in `urls` is uploaded to the CRM storage and replaced with a 15-minute signed link of that copy. The server
        // downloads it like any photo (no AI) and adds it to the gallery with the agency's logo.
        if (tool === "images.download" && Array.isArray(sendInput.urls) && sendInput.urls.some((u) => FILE_REF.test(String(u)))) {
          sendInput = { ...sendInput, urls: await signedFileUrls(sendInput.urls) };
        }
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
      // A CRM change may change the selected Проект (facts, summary): read it again next time.
      if (cls !== "auto") caseCache.clear();
      const result = r.result && typeof r.result === "object" ? structuredClone(r.result) : r.result;
      if (tool === "email.preview" && result && typeof result === "object") send({ type: "email", email: result });
      if (result && typeof result === "object") await materialize(result, s);
      // Photos into a gallery: the step says how many the server really stored (it may skip some).
      if (tool === "images.download" && cls === "approval" && result && Number.isFinite(Number(result.downloaded))) {
        const n = Number(result.downloaded);
        const sent = Array.isArray(input.urls) ? input.urls.length : n;
        if (n < sent) s.fail(`записани ${n} от ${sent} снимки – проверете галерията в CRM`); else s.ok(`${n} ${n === 1 ? "снимка" : "снимки"} в галерията`);
      } else s.ok();
      return { ok: true, result, ...(skippedPhotos.length ? { skipped: skippedPhotos } : {}) };
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
      const allowed = await askWeb(s, "ChatGPT иска да отвори адрес, който сам е съставил", [["Адрес", raw], ["Защо питаме", "Адресът не е от вашите съобщения, от търсенето или от прочетена страница, а в разговора има данни от CRM или файлове."]]);
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
        if (foreign.length && !(await askWeb(s, "ChatGPT иска да търси в интернет с лични данни", [["Търсене", q], ["Лични данни", foreign.join(", ")]]))) {
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
        // Provenance for pictures in the answer (CONTRACT §8.3 `images`): only these exact https addresses (from the
        // page, not from the model) are shown inline by the renderer; any other picture stays a chip until a click.
        const shown = page.images.filter((u) => typeof u === "string" && /^https:\/\//i.test(u) && u.length <= 2048);
        if (shown.length) send({ type: "images", urls: shown });
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
        if (!r.ok) { s.fail(r.error); return { ok: false, error: r.error, ...(ref.kind === "image" ? { note: "Снимките не се четат като текст: прикачените снимки са приложени към съобщението – разгледай ги директно." } : {}) }; }
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
      if (name === "open_in_chatgpt") {
        // Only a card: the employee reads (and may edit) the prompt and opens chatgpt.com with a click. Nothing is
        // created here and nothing opens by itself.
        const kind = HANDOFF_KINDS.includes(args && args.kind) ? args.kind : "other";
        const prompt = cleanPrompt(args && args.prompt);
        if (!prompt) return { ok: false, error: "Липсва заявката (prompt)." };
        if (prompt.length > CHATGPT_PROMPT_MAX) return { ok: false, error: `Заявката е над ${CHATGPT_PROMPT_MAX} знака – съкрати я.` };
        if (state.handoffs >= HANDOFF_MAX) return { ok: false, error: `Най-много ${HANDOFF_MAX} заявки за ChatGPT в един отговор.` };
        state.handoffs++;
        const s = step({ kind: "chatgpt", label: `Заявка за ChatGPT: ${HANDOFF_BG[kind]}` });
        send({ type: "chatgpt", handoff: { id: `cg_${newId()}`, kind, prompt } });
        s.ok("картата е показана – нищо не е отворено");
        const link = fitsLink(prompt);
        return {
          ok: true, shown: true, opened: false, ...(link ? {} : { tooLongForLink: true }),
          note: link
            ? "Служителят вижда карта с тази заявка и бутон „Отвори в ChatGPT“. Нищо не е създадено и нищо не е отворено – не твърди, че има снимка или видео; кажи му да натисне бутона и да продължи в ChatGPT."
            : "Заявката е твърде дълга за директен линк: картата предлага „Копирай и отвори ChatGPT“ – служителят я поставя там сам. Нищо не е създадено и нищо не е отворено. Следващия път пиши по-кратка заявка (до около 1300 знака на кирилица).",
        };
      }
      if (name === "project_folder") return runFolder(args || {});
      return { ok: false, error: "Непознат инструмент" };
    }

    // ---- project_folder (CONTRACT §8.12): the folder of a Проект on this computer ----------------------------------
    // create = cases.create through the gate (card); add/list/export_zip = local only; save_to_crm = card, then upload
    // and the plain server tools (files.attach / images.download). Nothing leaves the PC without the employee's card.
    const seenProjects = new Map(); // id -> {id, title, client}
    async function resolveProject(ref) {
      const key = String(ref || "").trim().slice(0, 160);
      const own = req.caseId ? { id: req.caseId, title: (kase && kase.kase && kase.kase.title) || "", client: (kase && kase.kase && kase.kase.client) || "", clientId: (kase && kase.kase && kase.kase.client_id) || "" } : null;
      if (!key) {
        if (own) return { ok: true, project: own };
        if (state.project) return { ok: true, project: state.project };
        return { ok: false, error: "Кой проект? Подай project (id или заглавие) – или създай нов с action:\"create\"." };
      }
      if (own && (key === own.id || key.toLowerCase() === String(own.title).toLowerCase())) return { ok: true, project: own };
      if (seenProjects.has(key)) return { ok: true, project: seenProjects.get(key) };
      const r = await runCrm({ tool: "cases.list", input: { status: "all", query: key.slice(0, 120) } });
      const list = r.ok && r.result && Array.isArray(r.result.cases) ? r.result.cases : [];
      const byId = list.find((c) => c && c.id === key);
      const exact = list.filter((c) => c && String(c.title || "").toLowerCase() === key.toLowerCase());
      const hit = byId || (exact.length === 1 ? exact[0] : list.length === 1 ? list[0] : null);
      if (!hit) {
        if (!r.ok) return r;
        return list.length
          ? { ok: false, error: "Няколко проекта отговарят – попитай служителя кой и подай id.", candidates: list.slice(0, 8).map((c) => ({ id: c.id, title: c.title, client: c.client })) }
          : { ok: false, error: `Няма проект „${key}“. Създай го с action:"create" (служителят одобрява).` };
      }
      const p = { id: String(hit.id), title: String(hit.title || ""), client: String(hit.client || "") };
      seenProjects.set(p.id, p);
      return { ok: true, project: p };
    }
    const fileIdsOf = (list) => (Array.isArray(list) ? list : []).map((x) => FILE_REF.exec(String(x || ""))).filter(Boolean).map((m) => m[1]);

    async function runFolder(args) {
      const action = String(args.action || "");
      if (!FOLDER_ACTIONS.includes(action)) return { ok: false, error: `Непознато действие на папката. Позволени: ${FOLDER_ACTIONS.join(", ")}.` };
      if (!projects) return { ok: false, error: "Папките на проектите не са достъпни в тази програма." };
      if (req.temporary && action !== "list") return { ok: false, error: "Във временен чат файловете не се пазят – папка не може да се попълни. Помоли служителя да продължи в обикновен чат." };
      if (action === "create") {
        const title = String(args.project || args.title || "").trim().slice(0, 160);
        if (!title) return { ok: false, error: "Липсва заглавието на новия проект (project)." };
        const input = { title };
        if (args.client_id) input.client_id = String(args.client_id).slice(0, 80);
        if (args.client_name) input.client_name = String(args.client_name).slice(0, 120);
        if (args.description) input.description = String(args.description).slice(0, 4000);
        const r = await runCrm({ tool: "cases.create", input }); // a CRM write: the employee's card (gate rule 3)
        if (!r.ok) return r;
        const made = { id: String((r.result && r.result.id) || ""), title: String((r.result && r.result.title) || title), client: input.client_name || "" };
        if (!made.id) return { ok: false, error: "Сървърът не върна id на проекта." };
        seenProjects.set(made.id, made);
        // A chat outside any Проект: what Ted makes from now on in this answer goes into the new folder.
        if (!req.caseId) { state.project = made; fileOpts.caseId = made.id; fileOpts.caseTitle = made.title; }
        return { ok: true, project: made, note: req.caseId ? "Проектът е създаден в CRM. Добави файлове в папката му с action:\"add\" и project:<id>." : "Проектът е създаден в CRM. Файловете, които направиш оттук нататък в този отговор, отиват в папката му; по-ранни добави с action:\"add\"." };
      }
      const pr = await resolveProject(args.project);
      if (!pr.ok) return pr;
      const p = pr.project;
      const label = (what) => `Папка „${String(p.title || "проект").slice(0, 60)}“: ${what}`;
      if (action === "add") {
        const ids = fileIdsOf(args.files).slice(0, FOLDER_ADD_MAX);
        if (!ids.length) return { ok: false, error: "Подай файловете като files:[\"file:<id>\", …]." };
        const s = step({ kind: "folder", label: label(`добавям ${ids.length === 1 ? "1 файл" : `${ids.length} файла`}`) });
        const out = files.assign(ids, { caseId: p.id, caseTitle: p.title });
        if (!out.length) { s.fail("файловете не са намерени"); return { ok: false, error: "Файловете не са намерени на този компютър." }; }
        s.ok(`${out.length} в папката`);
        return { ok: true, project: { id: p.id, title: p.title }, added: out.map((f) => f.name), missing: ids.length - out.length, folder_count: files.list({ caseId: p.id, limit: 500 }).count };
      }
      if (action === "list") {
        const s = step({ kind: "folder", label: label("преглед") });
        const l = files.list({ caseId: p.id, limit: 100 });
        s.ok(`${l.count} ${l.count === 1 ? "файл" : "файла"}`);
        return { ok: true, project: { id: p.id, title: p.title, client: p.client || undefined }, count: l.count, total: humanSize(l.totalBytes || 0),
          files: l.items.map((f) => ({ file: `file:${f.id}`, name: f.name, kind: f.kind, size: humanSize(f.size || 0), createdAt: f.createdAt, origin: f.origin, ...(f.savedTo ? { savedTo: f.savedTo } : {}) })) };
      }
      if (action === "export_zip") {
        // One ZIP per folder state and at most ZIP_PER_ANSWER per answer (review F9): a looping model cannot fill
        // the disk with copies of a 500 MB folder.
        const now0 = files.list({ caseId: p.id, limit: 500 });
        const key = `${p.id}|${now0.count}|${now0.totalBytes || 0}`;
        const prev = state.zips.get(key);
        if (prev) return { ok: true, file: `file:${prev.id}`, name: prev.name, count: prev.count, reused: true, note: "Този ZIP вече е направен в този отговор и папката не се е променила – картата му е показана." };
        if (state.zips.size >= ZIP_PER_ANSWER) return { ok: false, error: `Най-много ${ZIP_PER_ANSWER} ZIP файла в един отговор – служителят може да изтегли папката от страницата на проекта („Изтегли папката“).` };
        const s = step({ kind: "folder", label: label("правя ZIP") });
        const z = await projects.zip({ caseId: p.id, title: p.title, client: p.client || "" });
        if (!z.ok) { s.fail(z.error); return { ok: false, error: z.error }; }
        // The ZIP itself is not put into the folder (no archive inside the archive next time).
        const f = addFile({ name: z.name, mime: "application/zip", data: z.buffer, origin: "ted", maxBytes: 520 * 1048576 }, s.id, { project: false });
        if (!f.ok) { s.fail(f.error); return { ok: false, error: f.error }; }
        state.zips.set(key, { id: f.file.id, name: f.file.name, count: z.count });
        s.ok(`${z.count} файла · ${humanSize(f.file.size)}`);
        return { ok: true, file: `file:${f.file.id}`, name: f.file.name, count: z.count, note: "Служителят вижда карта на ZIP файла с „Запази…“ – записва го там, където избере. Нищо не е изпратено." };
      }
      // save_to_crm: the folder (or the named files) into the CRM at a client or a property – only after the card.
      const all = files.list({ caseId: p.id, limit: 500 }).items;
      const wanted = fileIdsOf(args.files);
      const chosen = wanted.length ? all.filter((f) => wanted.includes(f.id)) : all;
      if (!chosen.length) return { ok: false, error: wanted.length ? "Тези файлове не са в папката на проекта – добави ги първо с action:\"add\"." : "Папката на проекта е празна." };
      if (chosen.length > 50) return { ok: false, error: "Най-много 50 файла наведнъж – подай files с част от тях." };
      // A client given by id is named on the card by the CRM's own record, never by a name the model wrote (review F3).
      let target = args.property_code ? { propertyCode: String(args.property_code) } : null;
      if (!target && args.client_id) {
        const id = String(args.client_id).slice(0, 80);
        const got = await runCrm({ tool: "clients.get", input: { id } });
        const crmName = got.ok && got.result && got.result.client && typeof got.result.client.name === "string" ? got.result.client.name.trim().slice(0, 120) : "";
        target = { clientId: id, clientName: crmName };
      }
      // The project's own client comes from the CRM (cases.get / cases.list), so its name is the CRM's.
      if (!target) target = args.client_name ? { clientName: String(args.client_name) } : p.clientId ? { clientId: p.clientId, clientName: p.client || "" } : p.client ? { clientName: p.client } : null;
      const t = projects.targetOf(target);
      if (!t) return { ok: false, error: "При кой клиент или имот да се запишат файловете? Подай client_name, client_id или property_code." };
      const s = step({ kind: "crm", label: `CRM: папка „${String(p.title || "").slice(0, 50)}“ → ${t.label}`, tool: "files.attach", mutating: true });
      // Always its own card with every file and the target – an earlier „Разреши всички“ never covers an upload of
      // this computer's files (review F4); the card itself offers no „Разреши всички“.
      {
        const d = await ask({
          kind: "crm_write", title: `ChatGPT иска да запише папката „${String(p.title || "").slice(0, 80)}“ в CRM`, tool: "files.attach", allowAll: false,
          lines: [["Проект", p.title || p.id], ["Къде", t.kind === "property" ? `${t.label} – снимките в галерията, другите файлове в документите` : `${t.label} – в документите, папка „Проект: ${p.title}“`],
            ["Файлове", fileListLine(chosen)]],
          json: approvalJson({ project: { id: p.id, title: p.title }, target: t.input, files: chosen.map((f) => ({ file: `file:${f.id}`, name: f.name, size: f.size })) }),
        }, s);
        if (d.decision === "deny") { s.denied(); return { ok: false, error: d.timeout ? "Няма отговор от служителя 10 минути – нищо не е записано." : "Служителят отказа – нищо не е записано." }; }
      }
      const r = await projects.upload({ fileIds: chosen.map((f) => f.id), target, folderName: `Проект: ${p.title}`.slice(0, 80), onStep: subStep });
      if (!r.results) { s.fail(r.error); return { ok: false, error: r.error }; }
      const maybe = r.results.some((x) => x.maybeExecuted);
      if (r.failed) s.fail(`${r.saved} записани, ${r.failed} неуспешни${maybe ? " – може да е изпълнено, проверете в CRM" : ""}`); else s.ok(`${r.saved} записани при ${t.label}`);
      if (r.saved) caseCache.clear();
      return { ok: r.saved > 0, saved: r.saved, failed: r.failed, target: t.label, results: r.results.map((x) => ({ name: x.name, ok: x.ok, ...(x.savedTo ? { savedTo: x.savedTo } : {}), ...(x.error ? { error: x.error } : {}), ...(x.maybeExecuted ? { maybeExecuted: true } : {}) })) };
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
      const hit = caseCache.get(req.caseId);
      const r = hit && now() - hit.at < CASE_TTL_MS ? { ok: true, result: structuredClone(hit.value) } : await tools.call("cases.get", { id: req.caseId });
      if (r.ok) {
        kase = r.result; s.ok(); state.tainted = true;
        if (!hit || now() - hit.at >= CASE_TTL_MS) { caseCache.set(req.caseId, { at: now(), value: structuredClone(r.result) }); if (caseCache.size > 20) caseCache.delete(caseCache.keys().next().value); }
      } else s.fail(r.error);
      // Files Ted makes in a chat of this Проект go into its folder (never in a temporary chat: those are not kept).
      if (!req.temporary) { fileOpts.caseId = String(req.caseId).slice(0, 64); fileOpts.caseTitle = String((kase && kase.kase && kase.kase.title) || "").slice(0, 160); }
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
    const tried = { effort: false, flat: false, ids: false, docs: false };
    let effortIgnored = false;

    function bodyFor() {
      let b = { ...base };
      if (m.noEffort && b.reasoning) { delete b.reasoning; effortIgnored = true; }
      if (m.flat) b.tools = flattenTools(b.tools);
      if (m.noIds) b.input = stripIds(b.input);
      if (m.noDocs) b.input = withoutDocs(b.input);
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
        // An attached PDF (input_file) the route does not take: once without it – GPT then reads it with read_document.
        const filesIssue = (p.startsWith("input") || /input_file|file_data|\bfile/i.test(message)) && hasDocs(body.input);
        if (filesIssue && !tried.docs && !m.noDocs) { tried.docs = true; m.noDocs = true; continue; }
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
          // No switch to any other engine: the employee sees what OpenAI refused and may retry without tools.
          const refused = refusalOf(r.status, r.error);
          if (log) log.warn("agent.tools_unsupported", { model, code: refused.code, param: refused.param });
          return fail("tools_unsupported", null, { ...partial(), refused });
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
