// Уеб версия на Тед (imotinadezhda.bg/mobile/ted/) – същият интерфейс window.ted, но в браузъра.
// Отваря се от сайта („Пълна версия“) и се инсталира от Google Chrome като програма (Mac и Windows).
// Истински: вход (CRM), чат с Тед (/api/assistant), CRM, казуси, памет, имейл, глас, файлове, библиотека, проекти,
// планирани задачи (докато прозорецът е отворен). ChatGPT: отваря chatgpt.com в нов прозорец (вашия акаунт).
// Само в програмата за компютър: Real GPT агентът, видеото, браузърът на агента, балончето, обновяванията.
import { createHttp } from "../../electron/backend/http.js";
import { createSession } from "../../electron/backend/session.js";
import { createAssistant } from "../../electron/backend/assistant.js";
import { createTools } from "../../electron/backend/tools.js";
import { createVoice } from "../../electron/backend/voice.js";
import { createEmail } from "../../electron/backend/email.js";

const VERSION = typeof __TED_VERSION__ !== "undefined" ? __TED_VERSION__ : "web";
const DESKTOP_ONLY = "Това е само в програмата „Тед“ за компютър.";
const MB = 1024 * 1024;

/* ---------- малко хранилище: localStorage за настройки и сесия, IndexedDB за чатове и файлове ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem("ted-web:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ted-web:" + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem("ted-web:" + k); } catch { /* ignore */ } },
};
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open("ted-web", 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv"); if (!d.objectStoreNames.contains("files")) d.createObjectStore("files"); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function idb(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => { const tx = d.transaction(store, mode); const s = tx.objectStore(store); const q = fn(s); tx.oncomplete = () => res(q && "result" in q ? q.result : undefined); tx.onerror = () => rej(tx.error); });
}
const kvGet = (k) => idb("kv", "readonly", (s) => s.get(k)).catch(() => undefined);
const kvSet = (k, v) => idb("kv", "readwrite", (s) => s.put(v, k)).catch(() => undefined);

const secureStore = { available: () => true, read: (k) => LS.get("secure:" + k, null), write: (k, v) => LS.set("secure:" + k, v), remove: (k) => LS.del("secure:" + k) };
const log = { info() {}, warn() {}, error() {} };

/* ---------- събития ---------- */
function hub() { const s = new Set(); return { on(cb) { if (typeof cb !== "function") return () => {}; s.add(cb); return () => s.delete(cb); }, emit(p) { s.forEach((cb) => { try { cb(p); } catch { /* ignore */ } }); } }; }
const authHub = hub(), libHub = hub(), dueHub = hub(), noop = () => () => {};

/* ---------- помощни ---------- */
const b64ToBytes = (b64) => { const s = atob(String(b64 || "")); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
const bytesToB64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const rid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
function kindOf(name, mime) {
  const n = String(name || "").toLowerCase(), m = String(mime || "");
  if (/^image\//.test(m)) return "image"; if (/^video\//.test(m)) return "video";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx")) return "docx"; if (n.endsWith(".xlsx")) return "xlsx"; if (n.endsWith(".csv")) return "csv";
  if (/^text\//.test(m) || /\.(txt|md|json|html?)$/.test(n)) return "text";
  return "other";
}
function download(name, blob) {
  const u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u; a.download = name || "file"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
const ask = (message, detail, opts = {}) => Promise.resolve(window.confirm(String(message) + (detail ? "\n\n" + detail : "") + (opts.okLabel ? "\n\n(OK = " + opts.okLabel + ")" : "")));
async function makeThumb(blob) {
  try {
    const bmp = await createImageBitmap(blob); const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); const url = c.toDataURL("image/jpeg", 0.72); return url.length < 24 * 1024 * 1.4 ? url : undefined;
  } catch { return undefined; }
}

export function createWebBridge() {
  const http = createHttp({ fetchImpl: (u, i) => fetch(u, i), log });
  const session = createSession({ http, secureStore, log, onChange: (st) => authHub.emit(st) });
  session.init();
  const assistant = createAssistant({ session, log });
  const tools = createTools({ session, log, http });
  const voice = createVoice({ session });
  const email = createEmail({ tools, confirm: ask });
  const written = (r) => (r.ok ? { ok: true, result: r.result } : { ok: false, error: r.error, ...(r.maybeExecuted ? { maybeExecuted: true } : {}) });
  const uid = () => { const s = session.state(); return s.status === "signedIn" ? s.user.id : "anon"; };

  /* ---- файлове и библиотека (IndexedDB, за влезлия служител) ---- */
  const libKey = () => "lib:" + uid();
  async function libRefs() { return (await kvGet(libKey())) || []; }
  async function libSave(refs) { await kvSet(libKey(), refs); libHub.emit(); }
  async function addFile({ name, mime, data, chatId, temporary, caseId, caseTitle, origin = "user" }) {
    const bytes = data instanceof Uint8Array ? data : b64ToBytes(data);
    if (!bytes.length || bytes.length > 20 * MB) return { ok: false, error: "Файлът е празен, повреден или по-голям от 20 MB.", code: "invalid" };
    const id = rid("f_"), blob = new Blob([bytes], { type: mime || "application/octet-stream" }), kind = kindOf(name, mime);
    const ref = { id, name: String(name).slice(0, 180), mime: mime || "application/octet-stream", size: bytes.length, kind, origin, createdAt: Date.now(),
      ...(chatId ? { chatId } : {}), ...(caseId && !temporary ? { caseId, caseTitle } : {}) };
    if (kind === "image") { const t = await makeThumb(blob); if (t) ref.thumb = t; }
    await idb("files", "readwrite", (s) => s.put(blob, id)).catch(() => undefined);
    if (!temporary) { const refs = await libRefs(); refs.unshift(ref); await libSave(refs.slice(0, 2000)); }
    else { tempRefs.set(id, ref); }
    return { ok: true, file: ref };
  }
  const tempRefs = new Map();
  async function refOf(id) { return tempRefs.get(id) || (await libRefs()).find((r) => r.id === id) || null; }
  async function blobOf(id) { return idb("files", "readonly", (s) => s.get(id)).catch(() => null); }

  /* ---- планирани задачи: проверка всяка минута, докато прозорецът е отворен ---- */
  const schedKey = () => "sched:" + uid();
  const schedList = () => LS.get(schedKey(), []);
  setInterval(() => {
    const now = Date.now(); const items = schedList(); let changed = false;
    items.forEach((t) => { const due = Number(t.nextAt || t.at || 0); if (t.enabled !== false && due && due <= now && !t.firedAt) { t.firedAt = now; changed = true; dueHub.emit({ task: t, missed: now - due > 5 * 60000 }); } });
    if (changed) LS.set(schedKey(), items);
  }, 60000);

  const openWin = (url) => { const w = window.open(url, "_blank", "noopener"); return w ? { ok: true } : { ok: false, error: "Браузърът спря новия прозорец – разрешете изскачащите прозорци." }; };
  const chatgptUrl = (prompt) => { const q = String(prompt || "").trim(); return q && q.length < 7000 ? "https://chatgpt.com/?q=" + encodeURIComponent(q) : "https://chatgpt.com/"; };

  return {
    web: true,
    app: {
      info: async () => ({ version: VERSION, platform: /Mac/i.test(navigator.platform || "") ? "darwin" : /Win/i.test(navigator.platform || "") ? "win32" : "web", packaged: true, web: true }),
      setCompact: async () => ({ ok: true }),
      getLaunchAtLogin: async () => ({ enabled: false }),
      setLaunchAtLogin: async () => ({ ok: false, enabled: false, error: DESKTOP_ONLY }),
      openLogs: async () => ({ ok: false, error: DESKTOP_ONLY }),
      openExternal: async (url) => (/^(https:|mailto:)/i.test(String(url)) ? openWin(String(url)) : { ok: false, error: "Невалиден адрес." }),
      copy: async (text) => { try { await navigator.clipboard.writeText(String(text)); return { ok: true }; } catch { return { ok: false }; } },
      saveFile: async ({ suggestedName, text, base64 } = {}) => {
        const blob = base64 != null ? new Blob([b64ToBytes(base64)]) : new Blob([String(text || "")], { type: "text/plain;charset=utf-8" });
        download(suggestedName || "Тед.txt", blob); return { ok: true, path: "Изтегляния/" + (suggestedName || "Тед.txt") };
      },
      storage: async () => { try { const e = await navigator.storage.estimate(); return { ok: true, bytes: e.usage || 0, quota: e.quota || 0 }; } catch { return { ok: true, bytes: 0 }; } },
      clearTemp: async () => { tempRefs.clear(); return { ok: true }; },
      reportProblem: async () => openWin("mailto:kuneto77@abv.bg?subject=" + encodeURIComponent("Тед (уеб) – проблем")),
    },
    auth: {
      state: async () => session.state(),
      login: (args) => session.login(args),
      logout: () => session.logout(),
      onChange: (cb) => authHub.on(cb),
    },
    api: {
      models: (opts) => assistant.models({ fresh: !!(opts && opts.fresh) }),
      chat: (args) => assistant.chat(args),
      cancel: (id) => assistant.cancel(id),
    },
    crm: { read: (tool, input) => tools.read(tool, input || {}) },
    cases: {
      create: async (args = {}) => {
        const title = String(args.title || "").trim(); if (!title || title.length > 160) return { ok: false, error: "Въведете заглавие на казуса (до 160 знака)." };
        const input = { title }; if (args.clientName && String(args.clientName).trim()) input.client_name = String(args.clientName).trim();
        const r = await tools.call("cases.create", input); if (!r.ok) return written(r);
        const res = r.result && typeof r.result === "object" ? r.result : {}; return { ok: true, result: { id: res.id, title: res.title } };
      },
    },
    memory: {
      remember: async (args = {}) => { const text = String(args.text || "").trim(); if (!text) return { ok: false, error: "Въведете текст за запомняне (до 1500 знака)." }; const input = { text: text.slice(0, 1500) }; if (args.caseId) input.case_id = args.caseId; return written(await tools.call("memory.remember", input)); },
      forget: async (args = {}) => {
        const preview = String(args.preview || "").replace(/\s+/g, " ").trim().slice(0, 300);
        if (!(await ask("Да забрави ли Тед това?", (preview ? "„" + preview + "“\n\n" : "") + "Фактът ще бъде изтрит от паметта на Тед на сървъра."))) return { ok: false, canceled: true };
        const r = await tools.call("memory.forget", { id: args.id }); return r.ok ? { ok: true } : written(r);
      },
    },
    email: { confirmSend: (args) => email.confirmSend(args || {}) },
    voice: { tts: (args) => voice.tts(args || {}), transcribe: (args) => voice.transcribe(args || {}) },
    store: {
      getSettings: async () => LS.get("settings", {}),
      setSettings: async (patch) => { const s = Object.assign({}, LS.get("settings", {}), patch && typeof patch === "object" ? patch : {}); LS.set("settings", s); return s; },
      loadChats: async () => ({ chats: (await kvGet("chats:" + uid())) || [] }),
      saveChats: async (list) => { await kvSet("chats:" + uid(), Array.isArray(list) ? list : []); return { ok: true }; },
      clearLocal: async () => { if (!(await ask("Да изтрия ли чатовете в този браузър?", "Изтриват се само чатовете на този компютър."))) return { ok: false, canceled: true }; await kvSet("chats:" + uid(), []); return { ok: true }; },
    },
    realgpt: {
      status: async () => ({ connected: false }),
      signIn: async () => ({ ok: false, error: "В уеб версията ChatGPT се отваря в нов прозорец с вашия акаунт (бутон „Отвори в ChatGPT“). Връзката Real GPT вътре в Тед е в програмата за компютър.", code: "unsupported" }),
      cancelSignIn: async () => ({ ok: true }),
      signOut: async () => ({ ok: true, revoked: true }),
      models: async () => ({ ok: false, error: DESKTOP_ONLY, code: "unsupported" }),
      send: async () => ({ ok: false, error: DESKTOP_ONLY, code: "unsupported" }),
      cancel: async () => ({ ok: true }),
      onDelta: noop,
      consent: async () => ({ ok: true, consent: null }),
      setConsent: async (c) => ({ ok: true, consent: c }),
      approve: async () => ({ ok: false, error: DESKTOP_ONLY }),
      onEvent: noop,
      openInChatGpt: async (args = {}) => { if (args.prompt) { try { await navigator.clipboard.writeText(String(args.prompt)); } catch { /* ignore */ } } return openWin(args.bare ? "https://chatgpt.com/" : chatgptUrl(args.prompt)); },
    },
    files: {
      add: (args = {}) => addFile(args),
      read: async ({ id, max } = {}) => {
        const ref = await refOf(id), blob = await blobOf(id); if (!ref || !blob) return { ok: false, error: "Файлът не е намерен.", code: "missing" };
        if (max && blob.size > max) return { ok: false, error: "Файлът е твърде голям за преглед.", code: "too_big" };
        return { ok: true, name: ref.name, mime: ref.mime, size: blob.size, data: await blob.arrayBuffer() };
      },
      extract: async ({ id } = {}) => {
        const ref = await refOf(id), blob = await blobOf(id); if (!ref || !blob) return { ok: false, error: "Файлът не е намерен.", code: "missing" };
        if (ref.kind !== "text" && ref.kind !== "csv") return { ok: false, error: "В уеб версията се четат само текстови файлове – другите отиват към Тед като файлове.", code: "unsupported" };
        const text = await blob.text(); return { ok: true, doc: { name: ref.name, kind: ref.kind, text: text.slice(0, 60000), truncated: text.length > 60000 } };
      },
      open: async (id) => { const b = await blobOf(id); if (!b) return { ok: false, error: "Файлът не е намерен." }; const u = URL.createObjectURL(b); window.open(u, "_blank"); setTimeout(() => URL.revokeObjectURL(u), 60000); return { ok: true }; },
      save: async (id) => { const ref = await refOf(id), b = await blobOf(id); if (!ref || !b) return { ok: false, error: "Файлът не е намерен." }; download(ref.name, b); return { ok: true, path: "Изтегляния/" + ref.name }; },
      forget: async (id) => { tempRefs.delete(id); return { ok: true }; },
    },
    browse: {
      test: async () => ({ ok: false, error: DESKTOP_ONLY, code: "off" }),
      image: async ({ url } = {}) => {
        try { const r = await fetch(String(url), { referrerPolicy: "no-referrer" }); if (!r.ok) return { ok: false, error: "Снимката не се зареди.", code: "http" }; const b = await r.blob(); return { ok: true, mime: b.type, size: b.size, data: await b.arrayBuffer() }; }
        catch { return { ok: false, error: "Снимката не се зареди.", code: "network" }; }
      },
    },
    video: {
      prepare: async () => ({ ok: false, error: DESKTOP_ONLY, code: "unsupported" }),
      start: async () => ({ ok: false, error: DESKTOP_ONLY, code: "unsupported" }),
      cancel: async () => ({ ok: true }),
      finish: async () => ({ ok: false, error: DESKTOP_ONLY }),
      onEvent: noop,
    },
    library: {
      list: async ({ kind, q, limit, caseId } = {}) => {
        let items = await libRefs();
        if (kind) items = items.filter((r) => r.kind === kind);
        if (caseId) items = items.filter((r) => r.caseId === caseId);
        if (q) { const k = String(q).toLowerCase(); items = items.filter((r) => r.name.toLowerCase().includes(k)); }
        const totalBytes = items.reduce((a, r) => a + (r.size || 0), 0);
        return { ok: true, items: items.slice(0, Math.min(500, limit || 500)), totalBytes, count: items.length };
      },
      remove: async (id) => { if (!(await ask("Да изтрия ли файла от библиотеката?"))) return { ok: false, canceled: true }; await libSave((await libRefs()).filter((r) => r.id !== id)); await idb("files", "readwrite", (s) => s.delete(id)).catch(() => undefined); return { ok: true }; },
      clear: async () => { if (!(await ask("Да изтрия ли всички файлове от библиотеката в този браузър?"))) return { ok: false, canceled: true }; const refs = await libRefs(); await libSave([]); await Promise.all(refs.map((r) => idb("files", "readwrite", (s) => s.delete(r.id)).catch(() => undefined))); return { ok: true }; },
      onChange: (cb) => libHub.on(cb),
    },
    projects: {
      assign: async ({ caseId, caseTitle, fileIds } = {}) => { const ids = new Set(fileIds || []); const refs = await libRefs(); refs.forEach((r) => { if (ids.has(r.id)) { if (caseId) { r.caseId = caseId; r.caseTitle = caseTitle; } else { delete r.caseId; delete r.caseTitle; } } }); await libSave(refs); return { ok: true, files: refs.filter((r) => ids.has(r.id)) }; },
      saveAnswer: async ({ caseId, caseTitle, chatId, title, text } = {}) => { const bytes = new TextEncoder().encode(String(text || "")); return addFile({ name: (String(title || "Отговор").slice(0, 120)) + ".md", mime: "text/markdown", data: bytes, chatId, caseId, caseTitle, origin: "ted" }); },
      exportZip: async () => ({ ok: false, error: "ZIP на папката е в програмата за компютър. Тук изтеглете файловете един по един.", code: "unsupported" }),
      saveToCrm: async () => ({ ok: false, error: "Записът на папката в CRM е в програмата за компютър.", code: "unsupported" }),
    },
    scheduled: {
      list: async () => ({ ok: true, items: schedList() }),
      save: async (task) => { if (!task || typeof task !== "object") return { ok: false, error: "Невалидна задача.", code: "invalid" }; const items = schedList(); const item = { ...task, id: task.id || rid("t_") }; delete item.firedAt; const i = items.findIndex((x) => x.id === item.id); if (i >= 0) items[i] = item; else items.push(item); LS.set(schedKey(), items); return { ok: true, item }; },
      remove: async (id) => { LS.set(schedKey(), schedList().filter((x) => x.id !== id)); return { ok: true }; },
      onDue: (cb) => dueHub.on(cb),
    },
    updates: {
      state: async () => ({ status: "disabled", auto: false, version: VERSION, note: "Уеб версията винаги е последната." }),
      check: async () => ({ status: "none", auto: false, version: VERSION }),
      setAuto: async () => ({ status: "disabled", auto: false, version: VERSION }),
      download: async () => ({ ok: false, error: "Уеб версията се обновява сама." }),
      install: async () => ({ ok: false, error: "Уеб версията се обновява сама." }),
      onChange: noop,
    },
    window: {
      bubble: async () => ({ ok: false, error: DESKTOP_ONLY }),
      miniChat: async () => ({ ok: false, error: DESKTOP_ONLY }),
      restore: async () => ({ ok: true, mode: "normal" }),
      state: async () => ({ mode: "normal" }),
      onMode: noop,
    },
    chatgpt: {
      open: async (args = {}) => openWin(chatgptUrl(args.prompt || "")),
      setBounds: async () => ({ ok: true }),
      reload: async () => ({ ok: true }),
      openInBrowser: async (args = {}) => openWin(chatgptUrl(args.prompt || "")),
      close: async () => ({ ok: true }),
      clipboardImage: async () => ({ ok: false, error: DESKTOP_ONLY }),
      onState: noop,
    },
  };
}
