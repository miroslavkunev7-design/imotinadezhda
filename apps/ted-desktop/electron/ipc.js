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

// The "app" group: everything that needs Electron APIs, injected so the module stays testable.
export function createAppApi({ app, shell, clipboard, dialog, getWindow, setCompact, openExternal, logDir, writeFile = fs.promises.writeFile }) {
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
    out.push(images.length
      ? { role: m.role, text: m.text, images: images.map((im) => ({ mime: im.mime, data: im.data })) }
      : { role: m.role, text: m.text });
  }
  return out;
}

export function createHandlers({ appApi, session, assistant, tools, email, voice, settings, chats, realgpt, confirm }) {
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
    "ted:store.setSettings": (patch) => (isObj(patch) && size(patch) <= 64 * KB ? settings.set(patch) : settings.get()),
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
      if (!messages || !isStr(args.requestId, 100, 1) || !isStr(args.model, 100, 1) || !optStr(args.effort, 20) || !optStr(args.instructions, 20000)) {
        return { ok: false, error: "Невалидна заявка към Real GPT.", code: "invalid" };
      }
      const r = await realgpt.send({
        requestId: args.requestId, messages, model: args.model,
        effort: args.effort || undefined, instructions: args.instructions || undefined,
      });
      if (r && r.ok) {
        return {
          ok: true, text: String(r.text || ""), model: String(r.model || args.model),
          ...(r.incomplete ? { incomplete: true } : {}),
          ...(r.effortIgnored ? { effortIgnored: true } : {}), // the route does not support the chosen effort
        };
      }
      return rgError(r, r && typeof r.text === "string" && r.text ? { text: r.text } : {});
    },
    "ted:realgpt.cancel": async (requestId) => {
      if (!isStr(requestId, 100, 1)) return bad();
      await realgpt.cancel(requestId);
      return { ok: true };
    },
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
