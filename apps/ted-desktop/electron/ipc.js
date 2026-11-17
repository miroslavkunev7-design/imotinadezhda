// IPC surface of MAIN: exactly one handler per window.ted function (channel "ted:<group>.<fn>").
// Every call is checked for its sender (the app's own page) and for argument types and sizes.
// Tokens and passwords never travel back: handlers return only the shapes of docs/CONTRACT.md §2.
import fs from "node:fs";
import path from "node:path";

const KB = 1024;
const MB = 1024 * KB;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
// File types that Windows would run; the app only ever saves documents.
const RUNNABLE = /\.(exe|com|bat|cmd|scr|pif|cpl|msi|msp|dll|lnk|url|hta|js|jse|vbs|vbe|wsf|wsh|ps1|psm1|reg|jar|appref-ms)$/i;

const isStr = (v, max, min = 0) => typeof v === "string" && v.length >= min && v.length <= max;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const optStr = (v, max) => v == null || isStr(v, max);
const size = (v) => { try { return JSON.stringify(v).length; } catch { return Infinity; } };
const bad = (error = "Невалидни данни.") => ({ ok: false, error, code: "invalid" });

function safeName(value) {
  const name = String(value == null ? "" : value).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 120);
  return name || "ted.txt";
}

const fileSize = (file) => { try { return fs.statSync(file).size; } catch { return 0; } };

// The "app" group: everything that needs Electron APIs, injected so the module stays testable.
// chatsFile: the encrypted chats file (Съхранение); files: the file store (library and temp sizes).
export function createAppApi({ app, shell, clipboard, dialog, getWindow, setCompact, openExternal, logDir, writeFile = fs.promises.writeFile, chatsFile, files }) {
  return {
    info: () => ({ version: app.getVersion(), platform: process.platform, packaged: app.isPackaged }),
    setCompact: (on) => setCompact(on),
    getLaunchAtLogin: () => ({ enabled: app.isPackaged && !!app.getLoginItemSettings().openAtLogin }),
    setLaunchAtLogin(on) {
      if (!app.isPackaged) return { ok: false, enabled: false, error: "Стартирането с Windows работи само в инсталираната програма." };
      app.setLoginItemSettings({ openAtLogin: on });
      return { ok: true, enabled: !!app.getLoginItemSettings().openAtLogin };
    },
    async openLogs() {
      fs.mkdirSync(logDir, { recursive: true });
      const error = await shell.openPath(logDir);
      return error ? { ok: false, error: "Папката с логове не можа да се отвори." } : { ok: true };
    },
    openExternal,
    copy(text) {
      clipboard.writeText(text);
      return { ok: true };
    },
    // Saves text or binary (base64) content where the user chooses in the native dialog.
    async saveFile(args) {
      const a = isObj(args) ? args : {};
      const hasText = typeof a.text === "string";
      const hasBinary = typeof a.base64 === "string";
      if (hasText === hasBinary) return bad("Няма съдържание за запис.");
      if (hasText ? a.text.length > 20 * MB : a.base64.length > 40 * MB || !BASE64.test(a.base64)) return bad("Съдържанието е твърде голямо или повредено.");
      const win = getWindow();
      const options = { title: "Запази като", buttonLabel: "Запази", defaultPath: path.join(app.getPath("documents"), safeName(a.suggestedName)) };
      const picked = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
      if (picked.canceled || !picked.filePath) return { ok: false, canceled: true };
      if (RUNNABLE.test(picked.filePath)) return { ok: false, error: "Програмата не записва изпълними файлове. Изберете друго име." };
      try {
        await writeFile(picked.filePath, hasText ? a.text : Buffer.from(a.base64, "base64"));
        return { ok: true, path: picked.filePath };
      } catch {
        return { ok: false, error: "Файлът не можа да се запише на избраното място." };
      }
    },
    storage() {
      const st = files ? files.storage() : { libraryBytes: 0, libraryCount: 0, tempBytes: 0 };
      return { ok: true, chatsBytes: chatsFile ? fileSize(chatsFile) : 0, libraryBytes: st.libraryBytes, libraryCount: st.libraryCount, tempBytes: st.tempBytes };
    },
    clearTemp() {
      if (files) files.clearTemp();
      return { ok: true };
    },
    // „Съобщете за проблем“: the logs folder (technical events only) + an e-mail draft in the user's own program.
    async reportProblem() {
      fs.mkdirSync(logDir, { recursive: true });
      await shell.openPath(logDir);
      const v = app.getVersion();
      const body = [
        "Опишете какво се случи и какво очаквахте:", "", "", "",
        `Версия: ${v}`, `Windows: ${process.platform === "win32" ? (process.getSystemVersion ? process.getSystemVersion() : "") : process.platform}`,
        "Прикачете main.log от папката, която се отвори (в него няма текст на съобщения, пароли или токени).",
      ].join("\n");
      await openExternal(`mailto:?subject=${encodeURIComponent(`Тед за Windows ${v} – проблем`)}&body=${encodeURIComponent(body)}`);
      return { ok: true };
    },
  };
}

// Real GPT results are copied field by field, so nothing beyond the contract can reach the renderer.
const rgStatus = (s) => {
  const out = { connected: !!(s && s.connected) };
  if (s && typeof s.email === "string") out.email = s.email;
  if (s && typeof s.planEnabled === "boolean") out.planEnabled = s.planEnabled;
  return out;
};
const rgError = (r, extra = {}) => ({ ok: false, error: String((r && r.error) || "Грешка в Real GPT."), code: String((r && r.code) || "error"), ...extra });

const FILE_ID = /^[a-z0-9_-]{8,64}$/;
const isId = (v) => typeof v === "string" && FILE_ID.test(v);
const HINTS = ["image", "search", "research", "thinking", "canvas", "video"];

function rgMessages(list) {
  if (!Array.isArray(list) || !list.length || list.length > 200) return null;
  const out = [];
  for (const m of list) {
    if (!isObj(m) || (m.role !== "user" && m.role !== "assistant") || !isStr(m.text, 400000)) return null;
    const images = m.images == null ? [] : m.images;
    if (!Array.isArray(images) || images.length > 8) return null;
    for (const im of images) {
      if (!isObj(im) || !/^image\/(jpeg|png|webp|gif)$/.test(im.mime) || !isStr(im.data, 12 * MB, 1) || !BASE64.test(im.data)) return null;
    }
    // CONTRACT §8.2: file ids only on user messages, ≤ 10 per message.
    const files = m.files == null ? [] : m.files;
    if (!Array.isArray(files) || files.length > 10 || !files.every(isId) || (files.length && m.role !== "user")) return null;
    const msg = { role: m.role, text: m.text };
    if (images.length) msg.images = images.map((im) => ({ mime: im.mime, data: im.data }));
    if (files.length) msg.files = [...files];
    out.push(msg);
  }
  return out;
}

// Optional agent fields of realgpt.send (§8.2/§8.11): -> object of the valid ones, or null when one is invalid.
function rgExtras(a) {
  const out = {};
  if (a.mode != null) { if (a.mode !== "chat" && a.mode !== "work") return null; out.mode = a.mode; }
  if (a.hints != null) {
    if (!Array.isArray(a.hints) || a.hints.length > 6 || !a.hints.every((h) => HINTS.includes(h))) return null;
    if (a.hints.length) out.hints = [...new Set(a.hints)];
  }
  if (a.canvas != null) {
    const c = a.canvas;
    if (!isObj(c) || !isStr(c.text, 200000) || !optStr(c.title, 200) || (c.version != null && !Number.isFinite(c.version))) return null;
    out.canvas = { title: String(c.title || ""), text: c.text, version: Number(c.version) || 1 };
  }
  if (a.caseId != null) { if (!isStr(a.caseId, 64, 1)) return null; out.caseId = a.caseId; }
  if (a.role != null) { if (!isStr(a.role, 40, 1) || !/^[a-z0-9_-]+$/i.test(a.role) || a.role === "auto") return null; out.role = a.role; }
  if (a.chatId != null) { if (!isStr(a.chatId, 64, 1)) return null; out.chatId = a.chatId; }
  if (a.temporary != null) { if (typeof a.temporary !== "boolean") return null; if (a.temporary) out.temporary = true; }
  return out;
}

// Settings the renderer may not write (updates.auto is MAIN's) or that MAIN reads and therefore validates.
export function cleanSettingsPatch(patch) {
  const p = { ...patch };
  delete p.updates;
  if ("browse" in p) {
    const b = isObj(p.browse) ? p.browse : {};
    const blocked = Array.isArray(b.blocked) ? b.blocked : [];
    p.browse = {
      enabled: b.enabled !== false,
      robots: b.robots !== false,
      blocked: [...new Set(blocked.filter((h) => typeof h === "string").map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*?\./, "")).filter((h) => /^[a-z0-9.-]{1,253}$/.test(h) && h.includes(".")))].slice(0, 200),
    };
  }
  if ("nick" in p) p.nick = typeof p.nick === "string" ? p.nick.slice(0, 60) : "";
  if ("instructions" in p) p.instructions = typeof p.instructions === "string" ? p.instructions.slice(0, 1500) : "";
  if ("mode" in p && p.mode !== "chat" && p.mode !== "work") p.mode = "chat";
  if ("notify" in p) p.notify = { scheduled: !(isObj(p.notify) && p.notify.scheduled === false), updates: !(isObj(p.notify) && p.notify.updates === false) };
  return p;
}

function decodeBase64(data, maxChars) {
  if (!isStr(data, maxChars, 1) || !BASE64.test(data)) return null;
  return Buffer.from(data, "base64");
}

const rgStep = (s) => (isObj(s) ? { ...s } : s);

export function createHandlers({ appApi, session, assistant, tools, email, voice, settings, chats, realgpt, confirm, files, video, scheduled, updater, browser }) {
  const chatInvalid = (error) => ({ ok: false, error, code: "invalid", maybeExecuted: false });
  // {ok:true, result} | {ok:false, error} for the dedicated write channels.
  const written = (r) => (r.ok ? { ok: true, result: r.result } : { ok: false, error: r.error, ...(r.maybeExecuted ? { maybeExecuted: true } : {}) });

  return {
    "ted:app.info": () => appApi.info(),
    "ted:app.setCompact": (on) => (typeof on === "boolean" ? appApi.setCompact(on) : bad()),
    "ted:app.getLaunchAtLogin": () => appApi.getLaunchAtLogin(),
    "ted:app.setLaunchAtLogin": (on) => (typeof on === "boolean" ? appApi.setLaunchAtLogin(on) : bad()),
    "ted:app.openLogs": () => appApi.openLogs(),
    "ted:app.openExternal": (url) => (isStr(url, 8192, 1) ? appApi.openExternal(url) : bad("Невалиден адрес.")),
    "ted:app.copy": (text) => (isStr(text, 4 * MB) ? appApi.copy(text) : bad()),
    "ted:app.saveFile": (args) => appApi.saveFile(args),
    "ted:app.storage": () => appApi.storage(),
    "ted:app.clearTemp": () => appApi.clearTemp(),
    "ted:app.reportProblem": () => appApi.reportProblem(),

    "ted:auth.state": () => session.state(),
    "ted:auth.login": (args) => (isObj(args)
      ? session.login({ identifier: args.identifier, password: args.password })
      : bad("Въведете телефон или имейл и парола.")),
    "ted:auth.logout": () => session.logout(),

    "ted:api.models": () => assistant.models(),
    "ted:api.chat": (args) => {
      if (!isObj(args) || size(args) > 6 * MB) return chatInvalid("Заявката е невалидна или твърде голяма.");
      return assistant.chat({ requestId: args.requestId, messages: args.messages, model: args.model, mode: args.mode, caseId: args.caseId });
    },
    "ted:api.cancel": (requestId) => (isStr(requestId, 100, 1) ? assistant.cancel(requestId) : bad()),

    // READ_ONLY allowlist is enforced inside tools.read before any network call.
    "ted:crm.read": (tool, input) => (isStr(tool, 64, 1) && (input == null || isObj(input)) ? tools.read(tool, input || {}) : bad()),

    "ted:cases.create": async (args) => {
      if (!isObj(args) || !isStr(args.title, 160) || !args.title.trim() || !optStr(args.clientName, 120)) return bad("Въведете заглавие на казуса (до 160 знака).");
      const input = { title: args.title.trim() };
      if (args.clientName && args.clientName.trim()) input.client_name = args.clientName.trim();
      const r = await tools.call("cases.create", input);
      if (!r.ok) return written(r);
      const res = isObj(r.result) ? r.result : {};
      return { ok: true, result: { id: res.id, title: res.title } };
    },
    "ted:memory.remember": async (args) => {
      if (!isObj(args) || !isStr(args.text, 1500) || !args.text.trim() || !optStr(args.caseId, 64)) return bad("Въведете текст за запомняне (до 1500 знака).");
      const input = { text: args.text.trim() };
      if (args.caseId) input.case_id = args.caseId;
      return written(await tools.call("memory.remember", input));
    },
    "ted:memory.forget": async (args) => {
      if (!isObj(args) || !isStr(args.id, 64, 1) || !optStr(args.preview, 4000)) return bad();
      const preview = String(args.preview || "").replace(/\s+/g, " ").trim().slice(0, 300);
      const yes = await confirm("Да забрави ли Тед това?", (preview ? `„${preview}“\n\n` : "") + "Фактът ще бъде изтрит от паметта на Тед на сървъра. Действието не може да бъде отменено.", { okLabel: "Забрави", cancelLabel: "Отказ" });
      if (!yes) return { ok: false, canceled: true };
      const r = await tools.call("memory.forget", { id: args.id });
      return r.ok ? { ok: true } : written(r);
    },

    "ted:email.confirmSend": (args) => (isObj(args) && size(args) <= 256 * KB
      ? email.confirmSend({ to: args.to, subject: args.subject, attachments: args.attachments })
      : bad()),

    "ted:voice.tts": (args) => (isObj(args) && size(args) <= 16 * KB ? voice.tts({ text: args.text, voice: args.voice, style: args.style }) : bad()),
    "ted:voice.transcribe": (args) => (isObj(args) && isStr(args.mime, 100) && isStr(args.data, 4 * MB) ? voice.transcribe({ mime: args.mime, data: args.data }) : bad()),

    "ted:store.getSettings": () => settings.get(),
    "ted:store.setSettings": (patch) => (isObj(patch) && size(patch) <= 64 * KB ? settings.set(cleanSettingsPatch(patch)) : settings.get()),
    "ted:store.loadChats": () => chats.load(),
    "ted:store.saveChats": (list) => (Array.isArray(list) && list.length <= 2000 && list.every(isObj) && size(list) <= 30 * MB
      ? chats.save(list)
      : bad("Чатовете не могат да бъдат записани (твърде много данни).")),
    "ted:store.clearLocal": async () => {
      const yes = await confirm("Изтриване на чатовете от този компютър",
        "Ще бъдат изтрити разговорите ви с Тед, запазени на този компютър. Данните в CRM и паметта на Тед на сървъра не се променят. Действието не може да бъде отменено.",
        { okLabel: "Изтрий", cancelLabel: "Отказ" });
      if (!yes) return { ok: false, canceled: true };
      chats.clear();
      return { ok: true };
    },

    "ted:realgpt.status": async () => rgStatus(await realgpt.status()),
    "ted:realgpt.signIn": async (opts) => {
      if (opts != null && (!isObj(opts) || (opts.newAccount !== undefined && typeof opts.newAccount !== "boolean"))) return bad();
      const r = await realgpt.signIn({ newAccount: !!(opts && opts.newAccount) });
      return r && r.ok ? { ok: true, status: rgStatus(r.status) } : rgError(r);
    },
    "ted:realgpt.cancelSignIn": async () => {
      await realgpt.cancelSignIn();
      return { ok: true };
    },
    "ted:realgpt.signOut": async () => {
      const r = await realgpt.signOut();
      // A failed local removal (secure store) must not look like success: the tokens are still saved.
      if (!(r && r.ok)) return rgError(r, { revoked: !!(r && r.revoked) });
      return { ok: true, revoked: !!r.revoked };
    },
    "ted:realgpt.models": async () => {
      const r = await realgpt.models();
      if (!(r && r.ok && Array.isArray(r.models))) return rgError(r);
      return { ok: true, models: r.models.filter((m) => m && m.slug).map((m) => ({ slug: String(m.slug), displayName: String(m.displayName || m.slug) })) };
    },
    "ted:realgpt.send": async (args) => {
      const messages = isObj(args) && size(args) <= 40 * MB ? rgMessages(args.messages) : null;
      const extras = messages ? rgExtras(args) : null;
      if (!messages || !extras || !isStr(args.requestId, 100, 1) || !isStr(args.model, 100, 1) || !optStr(args.effort, 20) || !optStr(args.instructions, 20000)) {
        return { ok: false, error: "Невалидна заявка към Real GPT.", code: "invalid" };
      }
      const r = await realgpt.send({
        requestId: args.requestId, messages, model: args.model,
        effort: args.effort || undefined, instructions: args.instructions || undefined,
        ...extras,
      });
      // Copied field by field: nothing beyond RgResult can reach the page.
      const agentFields = (x) => ({
        ...(Array.isArray(x.steps) ? { steps: x.steps.map(rgStep) } : {}),
        ...(Array.isArray(x.files) ? { files: x.files.map((f) => ({ ...f })) } : {}),
        ...(x.limited && isObj(x.limited) ? { limited: { rounds: Number(x.limited.rounds) || 0, calls: Number(x.limited.calls) || 0 } } : {}),
      });
      if (r && r.ok) {
        return {
          ok: true, text: String(r.text || ""), model: String(r.model || args.model),
          ...(r.incomplete ? { incomplete: true } : {}),
          ...(r.effortIgnored ? { effortIgnored: true } : {}), // the route does not support the chosen effort
          ...(r.toolsOff ? { toolsOff: true } : {}),
          ...agentFields(r),
        };
      }
      return rgError(r, { ...(r && typeof r.text === "string" && r.text ? { text: r.text } : {}), ...(r ? agentFields(r) : {}) });
    },
    "ted:realgpt.consent": async () => {
      const r = await realgpt.consent();
      return { ok: true, consent: r && (r.consent === "all" || r.consent === "text") ? r.consent : null, ...(r && typeof r.account === "string" ? { account: r.account } : {}) };
    },
    "ted:realgpt.setConsent": async (choice) => {
      if (choice !== "all" && choice !== "text" && choice !== null) return bad();
      const r = await realgpt.setConsent(choice);
      return r && r.ok ? { ok: true, consent: choice } : rgError(r);
    },
    "ted:realgpt.approve": (args) => {
      if (!isObj(args) || !isStr(args.requestId, 100, 1) || !isStr(args.approvalId, 100, 1) || !["allow", "deny", "allow_all"].includes(args.decision)) return bad();
      let options;
      if (args.options != null) {
        if (!isObj(args.options) || !isStr(args.options.engine, 40, 1) || !Number.isFinite(args.options.duration)) return bad();
        options = { engine: args.options.engine, duration: args.options.duration };
      }
      return realgpt.approve({ requestId: args.requestId, approvalId: args.approvalId, decision: args.decision, ...(options ? { options } : {}) });
    },
    "ted:realgpt.cancel": async (requestId) => {
      if (!isStr(requestId, 100, 1)) return bad();
      await realgpt.cancel(requestId);
      return { ok: true };
    },

    // ---- files (§8.1) ----
    "ted:files.add": (args) => {
      if (!isObj(args) || !isStr(args.name, 180, 1) || !optStr(args.mime, 120) || !optStr(args.chatId, 64) || (args.temporary != null && typeof args.temporary !== "boolean")) return bad();
      const data = decodeBase64(args.data, 28 * MB);
      if (!data) return bad("Файлът е празен, повреден или по-голям от 20 MB.");
      const r = files.add({ name: args.name, mime: args.mime || "", data, chatId: args.chatId || undefined, temporary: !!args.temporary, origin: "user" });
      return r.ok ? { ok: true, file: r.file } : { ok: false, error: r.error, code: r.code };
    },
    "ted:files.read": (args) => {
      if (!isObj(args) || !isId(args.id) || (args.max != null && !(Number.isFinite(args.max) && args.max > 0))) return bad();
      return files.read({ id: args.id, max: args.max == null ? undefined : Math.min(args.max, 150 * MB) });
    },
    "ted:files.extract": (args) => (isObj(args) && isId(args.id) ? files.extract(args.id) : bad()),
    "ted:files.open": (id) => (isId(id) ? files.open(id) : bad()),
    "ted:files.save": (id) => (isId(id) ? files.save(id) : bad()),
    "ted:files.forget": (id) => (isId(id) ? files.forget(id) : bad()),

    // ---- browse (§8.4): the settings check only; browsing itself runs inside the agent ----
    "ted:browse.test": async (args) => {
      if (!isObj(args) || !isStr(args.url, 2000, 1)) return bad("Невалиден адрес.");
      try {
        const r = await browser.get(args.url, { maxBytes: 2 * MB, timeoutMs: 20000, accept: "text/html,*/*;q=0.5" });
        const html = r.buffer.toString("utf8", 0, Math.min(r.buffer.length, 200000));
        const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
        return { ok: true, status: r.status, title: t ? t[1].replace(/\s+/g, " ").trim().slice(0, 200) : "" };
      } catch (e) {
        return { ok: false, error: e && e.message ? String(e.message) : "Страницата не може да се отвори.", code: (e && e.code) || "network" };
      }
    },

    // ---- video (§8.5) ----
    "ted:video.prepare": (args) => {
      if (!isObj(args) || !optStr(args.code, 60) || !optStr(args.prompt, 2400) || (args.fileIds != null && (!Array.isArray(args.fileIds) || args.fileIds.length > 30 || !args.fileIds.every(isId)))) return bad();
      if (!args.code && !(args.fileIds && args.fileIds.length) && !args.prompt) return bad("Посочете обява или снимки.");
      return video.prepare({ code: args.code || undefined, fileIds: args.fileIds || [], prompt: args.prompt || undefined });
    },
    "ted:video.start": (args) => (isObj(args) && isStr(args.jobId, 64, 1) && isStr(args.engine, 40, 1) && Number.isFinite(args.duration) ? video.start({ jobId: args.jobId, engine: args.engine, duration: args.duration }) : bad()),
    "ted:video.cancel": (args) => (isObj(args) && isStr(args.jobId, 64, 1) ? video.cancel({ jobId: args.jobId }) : bad()),
    "ted:video.finish": (args) => (isObj(args) && isStr(args.jobId, 64, 1) && isId(args.fileId) ? video.finish({ jobId: args.jobId, fileId: args.fileId }) : bad()),

    // ---- library (§8.6) ----
    "ted:library.list": (args) => {
      const a = args == null ? {} : args;
      if (!isObj(a) || !optStr(a.kind, 20) || !optStr(a.q, 200) || (a.limit != null && !Number.isFinite(a.limit))) return bad();
      return files.list({ kind: a.kind || undefined, q: a.q || undefined, limit: a.limit });
    },
    "ted:library.remove": (id) => (isId(id) ? files.remove(id) : bad()),
    "ted:library.clear": () => files.clear(),

    // ---- scheduled (§8.7) ----
    "ted:scheduled.list": () => scheduled.list(),
    "ted:scheduled.save": (task) => (isObj(task) && size(task) <= 16 * KB ? scheduled.save(task) : bad()),
    "ted:scheduled.remove": (id) => (isStr(id, 64, 1) ? scheduled.remove(id) : bad()),

    // ---- updates (§8.8) ----
    "ted:updates.state": () => updater.state(),
    "ted:updates.check": () => updater.check(),
    "ted:updates.setAuto": (on) => (typeof on === "boolean" ? updater.setAuto(on) : bad()),
    "ted:updates.download": () => updater.download(),
    "ted:updates.install": () => updater.install(),
  };
}

// isTrusted(url): true only for the app's own origin (see security.createOriginCheck).
export function registerIpc({ ipcMain, isTrusted, log, ...services }) {
  const handlers = createHandlers(services);
  for (const [channel, fn] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, ...args) => {
      const frame = event && event.senderFrame;
      if (!frame || frame.parent || !isTrusted(frame.url)) {
        if (log) log.warn("ipc.rejected", { channel });
        throw new Error("ted: forbidden sender");
      }
      try {
        return await fn(...args);
      } catch (e) {
        if (log) log.error("ipc.failed", { channel, message: String((e && e.message) || e) });
        return { ok: false, error: "Вътрешна грешка в програмата. Подробности има в логовете.", code: "internal" };
      }
    });
  }
  return Object.keys(handlers);
}
