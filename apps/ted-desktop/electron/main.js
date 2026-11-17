// Тед за Windows - MAIN process entry: lifecycle, hardening and wiring of all modules.
// MAIN is the only place that talks to the network and the only place that holds credentials.
import { app, BrowserWindow, Menu, Notification, clipboard, dialog, ipcMain, nativeImage, net, protocol, safeStorage, screen, session as electronSession, shell as electronShell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createLog } from "./log.js";
import { createSecureStore } from "./store/secure-file.js";
import { createSettings } from "./store/settings.js";
import { createChats } from "./store/chats.js";
import { createHttp, wrapNetFetch } from "./backend/http.js";
import { createSession } from "./backend/session.js";
import { createAssistant } from "./backend/assistant.js";
import { createTools } from "./backend/tools.js";
import { createEmail } from "./backend/email.js";
import { createVoice } from "./backend/voice.js";
import { createRealGpt } from "./realgpt/index.js";
import { createLibrary } from "./library.js";
import { createFiles } from "./files.js";
import { createProjects } from "./projects.js";
import { readDocument } from "./docs/read.js";
import { createBrowser, createSessionGuard } from "./browse/net.js";
import { webSearch } from "./browse/search.js";
import { createPages } from "./browse/page.js";
import { createImageProvenance } from "./browse/provenance.js";
import { createUploads } from "./agent/uploads.js";
import { createAgent } from "./agent/loop.js";
import { guardTools } from "./agent/gate.js";
import { createVideo } from "./video/flow.js";
import { createScheduled } from "./scheduled.js";
import { createUpdater } from "./updater.js";
import { APP_URL, CSP, META_CSP, SCHEME, registerAppProtocol } from "./protocol.js";
import { disableSpellChecker, installSecurity } from "./security.js";
import { createBubbleWindow, createMainWindow, TITLE } from "./window.js";
import { BUBBLE_URL, createBubbleController, registerBubbleIpc } from "./bubble.js";
import { createAppApi, registerIpc } from "./ipc.js";
import { SMOKE_TIMEOUT_MS, guardRendererRequests, parseSmokeArgs, prepareSmoke, recordingShell, removeSmokeProfile, runSmoke, writeSmokeReport } from "./smoke.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// Thumbnails in MAIN (nativeImage decodes PNG and JPEG): a ≤ 24 KB data URL for FileRef.thumb.
function makeThumb(buffer) {
  const img = nativeImage.createFromBuffer(buffer);
  if (img.isEmpty()) return null;
  const { width } = img.getSize();
  const small = width > 256 ? img.resize({ width: 256, quality: "good" }) : img;
  for (const q of [72, 55, 40]) {
    const url = `data:image/jpeg;base64,${small.toJPEG(q).toString("base64")}`;
    if (url.length <= 24 * 1024 * 1.37) return url;
  }
  return null;
}

// ≤ 512 px JPEG (base64) of a listing photo for the AI route order of the video flow, with the original size.
function videoThumb(buffer) {
  const img = nativeImage.createFromBuffer(buffer);
  if (img.isEmpty()) return null;
  const { width, height } = img.getSize();
  const k = Math.min(1, 512 / Math.max(width, height));
  const small = k < 1 ? img.resize({ width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)), quality: "good" }) : img;
  return { data: small.toJPEG(80).toString("base64"), width, height };
}

// Development only: TED_DEV_URL=http://localhost:5173 loads the Vite dev server instead of app://ted/.
function devServerUrl() {
  if (app.isPackaged || !process.env.TED_DEV_URL) return null;
  try {
    const u = new URL(process.env.TED_DEV_URL);
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1") ? u : null;
  } catch { return null; }
}

// --smoke-test (see electron/smoke.js): temporary profile, self-check, JSON report, exit 0/1.
const smoke = parseSmokeArgs(process.argv);

let smokeEnded = false;
function endSmoke(report) {
  if (smokeEnded) return;
  smokeEnded = true;
  let code = 1;
  try { code = writeSmokeReport(smoke, report); } catch (e) { process.stderr.write(`ted-smoke: report not written: ${e && e.message}\n`); }
  for (const w of BrowserWindow.getAllWindows()) w.destroy();
  removeSmokeProfile(smoke);
  app.exit(code);
}

function start() {
  app.enableSandbox();
  protocol.registerSchemesAsPrivileged([SCHEME]);
  app.setAppUserModelId("bg.imotinadezhda.ted");

  let ui = null; // { win, setCompact } once the window exists
  let bubble = null; // „Балонче“ controller (electron/bubble.js) once the window exists
  const currentWindow = () => (ui && !ui.win.isDestroyed() ? ui.win : null);
  const push = (channel, payload) => {
    const win = currentWindow();
    if (win && !win.webContents.isDestroyed()) win.webContents.send(channel, payload);
  };

  // A second launch brings the normal window back (also from the bubble or the mini chat).
  app.on("second-instance", () => {
    const win = currentWindow();
    if (!win) return;
    if (bubble && bubble.mode() !== "normal") { bubble.restore(); return; }
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  // A real quit (bubble menu „Затвори Тед“, update install) is never turned into „back to the bubble“.
  app.on("before-quit", () => { if (bubble) bubble.setQuitting(); });
  app.on("window-all-closed", () => app.quit());

  app.whenReady().then(() => {
    if (smoke) {
      const t = setTimeout(() => endSmoke({ ok: false, checks: [{ name: `finished within ${SMOKE_TIMEOUT_MS / 1000} s`, ok: false }] }), SMOKE_TIMEOUT_MS);
      t.unref();
    }
    const userData = app.getPath("userData");
    const log = createLog({ dir: path.join(userData, "logs") });
    process.on("uncaughtException", (e) => log.error("main.uncaught", { message: String((e && e.message) || e), stack: String((e && e.stack) || "") }));
    process.on("unhandledRejection", (e) => log.error("main.unhandled_rejection", { message: String((e && e.message) || e) }));
    log.info("app.start", { version: app.getVersion(), packaged: app.isPackaged, platform: process.platform });

    // No reload / view-source / devtools accelerators in the installed program.
    if (app.isPackaged) Menu.setApplicationMenu(null);

    const dev = devServerUrl();
    const devOrigin = dev ? dev.origin : null;

    const settings = createSettings({ file: path.join(userData, "settings.json") });
    const windowState = createSettings({ file: path.join(userData, "window-state.json") });
    const secureStore = createSecureStore({ dir: path.join(userData, "secure"), safeStorage });
    // All backend traffic goes through Chromium's network stack (Windows proxy and certificate store)
    // in an in-memory partition: no cookies, no disk cache, nothing shared with the renderer.
    // net sends no Origin/Referer header (verified by --smoke-test against a local echo server).
    const backendSession = electronSession.fromPartition("ted-backend");
    disableSpellChecker(backendSession);
    const backendFetch = wrapNetFetch((url, init) => backendSession.fetch(url, init));
    const userAgent = `TedDesktop/${app.getVersion()}`;
    const http = createHttp({ fetchImpl: backendFetch, log, userAgent });

    let realgpt = null;
    let onUserChange = null; // set once the per-user stores exist
    // Every sign-in/sign-out (also expiry) detaches Real GPT from the previous CRM user: running answers and an open
    // ChatGPT sign-in stop, and the decrypted ChatGPT tokens leave memory. The connection belongs to one CRM user.
    const session = createSession({
      http, secureStore, log,
      onChange: (state) => {
        if (realgpt) realgpt.detach();
        if (onUserChange) onUserChange();
        push("ted:auth.changed", state);
      },
    });
    const crmUserId = () => { const s = session.state(); return s.status === "signedIn" ? s.user.id : null; };
    const assistant = createAssistant({ session, log });
    // http: the public GETs of the tool manifest and role prompts (no token is attached there).
    const tools = createTools({ session, log, http });
    const voice = createVoice({ session });
    const chats = createChats({ secureStore, userId: crmUserId });

    // Native confirmation for anything that sends or deletes. "Cancel" is the default button.
    async function confirm(message, detail, opts = {}) {
      // From the bubble the mini chat opens first: the dialog needs a visible owner window.
      if (bubble) { try { await bubble.beforeDialog(); } catch { /* the dialog is shown anyway */ } }
      const options = {
        type: "question", title: TITLE, message: String(message), detail: String(detail || ""),
        buttons: [opts.okLabel || "Да", opts.cancelLabel || "Отказ"], defaultId: 1, cancelId: 1, noLink: true,
      };
      const win = currentWindow();
      const r = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
      return r.response === 0;
    }
    const email = createEmail({ tools, confirm });

    // ---- agent: files, internet, documents, video (docs/CONTRACT.md §9–§12) ----
    const library = createLibrary({ dir: path.join(userData, "library"), secureStore, owner: crmUserId, log });
    const files = createFiles({
      library, tempRoot: app.getPath("temp"), shell: electronShell, dialog, getWindow: currentWindow, confirm,
      makeThumb, log, onChange: () => push("ted:library.changed"), documentsDir: () => app.getPath("documents"), readDoc: readDocument,
    });
    files.cleanStaleTemp();
    app.on("will-quit", () => files.clearTemp());

    // Internet of the agent: a separate in-memory session that never carries a token, cookie or the page origin;
    // every request and redirect hop is checked against the SSRF rules before it is sent (browse/net.js).
    const browseSession = electronSession.fromPartition("ted-browse");
    disableSpellChecker(browseSession);
    const browseGuard = createSessionGuard({ getSettings: () => settings.get(), log });
    browseGuard.install(browseSession.webRequest);
    const chromeUa = String(app.userAgentFallback || "").replace(/\s(Electron|ted-desktop|Ted Imoti Nadezhda|TedImotiNadezhda)\/\S+/gi, "").trim();
    const browser = createBrowser({
      fetchImpl: (url, init) => browseSession.fetch(url, { ...init, credentials: "omit", cache: "no-store", redirect: "follow" }),
      getSettings: () => settings.get(),
      userAgent: `${chromeUa} TedDesktop/${app.getVersion()}`.trim(),
      resolveProxy: (url) => browseSession.resolveProxy(url),
      ipOf: browseGuard.ipOf,
      resolved: browseGuard.resolved,
      watch: browseGuard.watch,
      log,
    });
    const pages = createPages({ browser, getSettings: () => settings.get() });
    // Picture addresses MAIN handed to the window as tool results (browse.image loads only these without a click).
    const imageProvenance = createImageProvenance();
    const uploads = createUploads({ session, files, log });
    // Project folders (§8.12): ZIP on this computer, „Запази в сайта“ only after the employee's approval.
    const projects = createProjects({
      files, uploads, tools: guardTools(tools), session, dialog, getWindow: currentWindow, confirm,
      documentsDir: () => app.getPath("documents"), log,
    });
    const video = createVideo({ session, http, tools, files, uploads, thumb: videoThumb, emit: (job) => push("ted:video.event", job), log });
    // Real GPT uses ONLY the employee's ChatGPT plan (docs/CONTRACT.md §9.6): the agent gets no Ted server chat engine,
    // no server search fallback, no AI video, and a CRM transport that refuses every tool running another AI.
    const agent = createAgent({
      tools: guardTools(tools), files, uploads, pages, http, confirm, log, projects,
      search: (args, opts) => webSearch(browser, args, opts),
      getSettings: () => settings.get(),
    });

    const notify = (title, body) => {
      if (smoke || !Notification.isSupported()) return;
      const n = new Notification({ title: String(title).slice(0, 120), body: String(body || "").slice(0, 300), silent: false });
      n.on("click", () => {
        if (bubble && bubble.mode() !== "normal") { bubble.restore(); return; }
        const win = currentWindow(); if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
      });
      n.show();
    };
    const scheduled = createScheduled({ secureStore, owner: crmUserId, notify, emitDue: (d) => push("ted:scheduled.due", d), getSettings: () => settings.get(), log });
    const updater = createUpdater({
      loadUpdater: async () => (await import("electron-updater")).default.autoUpdater,
      getSession: (name) => electronSession.fromPartition(name, { cache: false }),
      app, settings, log, smoke: !!smoke, platform: process.platform, packaged: app.isPackaged,
      emit: (state) => push("ted:updates.changed", state),
    });

    // In a smoke run links are only recorded, never opened in the system browser.
    const shell = smoke ? recordingShell() : electronShell;
    const external = smoke ? guardRendererRequests(electronSession.defaultSession.webRequest) : null;
    const security = installSecurity({ app, session: electronSession.defaultSession, shell, log, devOrigin });
    realgpt = createRealGpt({
      http, secureStore, log,
      owner: crmUserId, // the ChatGPT connection is stored per CRM user ("realgpt-<id>")
      dataDir: path.join(userData, "realgpt"),
      // The sign-in page opens in the system browser, through the same https-only gate as every link.
      openExternal: async (url) => {
        const r = await security.openExternal(url);
        if (!r.ok) throw new Error(r.error);
      },
      emit: (event, payload) => {
        if (event === "realgpt:delta") push("ted:realgpt.delta", payload);
        else if (event === "realgpt:event") {
          imageProvenance.observe(payload);
          if (bubble && payload && payload.type === "approval") bubble.attention(); // the bubble shows „!“
          push("ted:realgpt.event", payload);
        }
      },
      agent,
    });
    // Files, videos and scheduled tasks belong to the signed-in CRM user, like the chats and Real GPT.
    onUserChange = () => {
      imageProvenance.clear();
      files.detach();
      video.detach();
      scheduled.ownerChanged();
    };

    const appApi = createAppApi({
      app, shell, clipboard, dialog,
      getWindow: currentWindow,
      setCompact: (on) => (ui ? ui.setCompact(on) : { ok: false }),
      openExternal: security.openExternal,
      logDir: log.dir,
      chatsFile: path.join(userData, "secure", "chats.bin"),
      files,
    });
    // „Балонче“ (0.1.6): the window modes; the bubble's pulse/badge follow the answers in flight.
    const windowApi = {
      bubble: () => (bubble ? bubble.toBubble() : { ok: false, mode: "normal" }),
      miniChat: () => (bubble ? bubble.miniChat() : { ok: false, mode: "normal" }),
      restore: () => (bubble ? bubble.restore() : { ok: false, mode: "normal" }),
      state: () => ({ mode: bubble ? bubble.mode() : "normal" }),
    };
    const isMainSender = (event) => {
      const win = currentWindow();
      return !!win && !!event && !!event.sender && event.sender.id === win.webContents.id;
    };
    const observe = (channel) => {
      if (!bubble) return null;
      if (channel === "ted:realgpt.approve") { bubble.decided(); return null; } // „!“ off: the employee decided
      return channel === "ted:api.chat" || channel === "ted:realgpt.send" ? bubble.track() : null;
    };
    registerIpc({ ipcMain, isTrusted: security.isApp, isMainSender, observe, log, appApi, session, assistant, tools, email, voice, settings, chats, realgpt, confirm, files, video, scheduled, updater, browser, pages, projects, imageProvenance, windowApi });

    registerAppProtocol({ protocol, root: path.join(app.getAppPath(), "dist") });
    session.init();
    ui = createMainWindow({
      BrowserWindow, screen, Menu, log,
      state: windowState,
      preload: path.join(here, "preload.cjs"),
      url: dev ? dev.href : APP_URL,
      packaged: app.isPackaged,
    });
    // The bubble window is made only when the employee presses „Балонче“ (never in a smoke run).
    const bubbleUrl = dev ? new URL("bubble.html", dev.href).href : BUBBLE_URL;
    bubble = createBubbleController({
      screen, main: ui.win, setFloating: ui.setFloating, store: windowState, log,
      makeBubbleWindow: () => createBubbleWindow({ BrowserWindow, preload: path.join(here, "preload-bubble.cjs"), url: bubbleUrl, packaged: app.isPackaged, log, platform: process.platform }),
      popupMenu: (win, items) => Menu.buildFromTemplate(items).popup({ window: win }),
      quit: () => app.quit(),
      onMode: (mode) => push("ted:window.mode", { mode }),
    });
    registerBubbleIpc({ ipcMain, controller: bubble, isBubbleUrl: (u) => u === bubbleUrl, log });
    if (!smoke) {
      // Scheduled tasks run only while the program is open; updates are checked 20 s after start, then every 6 h.
      ui.win.webContents.once("did-finish-load", () => {
        setTimeout(() => scheduled.start(), 5000).unref?.();
        updater.start();
      });
    }

    if (smoke) {
      runSmoke({
        win: ui.win, appUrl: APP_URL, csp: CSP, metaCsp: META_CSP,
        appFetch: (url) => net.fetch(url), backendFetch, createHttp, shell, external,
        windowCount: () => BrowserWindow.getAllWindows().length,
        bubbleOpen: () => !!bubble.bubbleWindow(),
        shot: smoke.shot,
        info: {
          userAgent,
          updater: updater.state().status === "disabled" ? "off" : "on",
          meta: { version: app.getVersion(), packaged: app.isPackaged, platform: process.platform, arch: process.arch, electron: process.versions.electron, chrome: process.versions.chrome },
        },
      }).then(endSmoke, (e) => endSmoke({ ok: false, checks: [{ name: "smoke run completed", ok: false, detail: String(e) }] }));
    }
  }).catch((e) => {
    if (smoke) { endSmoke({ ok: false, checks: [{ name: "program started", ok: false, detail: String((e && e.stack) || e) }] }); return; }
    // A start-up failure must be visible, not a background process without a window.
    dialog.showErrorBox(TITLE, "Програмата не можа да стартира.\n\n" + String((e && e.message) || e));
    app.quit();
  });
}

// One instance only: a second launch focuses the existing window. This also keeps two processes
// from racing on the rotating Supabase refresh token. A smoke run uses its own temporary profile.
if (smoke) prepareSmoke(app, smoke);
if (app.requestSingleInstanceLock()) start();
else app.quit();
