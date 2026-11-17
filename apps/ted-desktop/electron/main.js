// Тед за Windows - MAIN process entry: lifecycle, hardening and wiring of all modules.
// MAIN is the only place that talks to the network and the only place that holds credentials.
import { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, net, protocol, safeStorage, screen, session as electronSession, shell as electronShell } from "electron";
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
import { APP_URL, CSP, META_CSP, SCHEME, registerAppProtocol } from "./protocol.js";
import { disableSpellChecker, installSecurity } from "./security.js";
import { createMainWindow, TITLE } from "./window.js";
import { createAppApi, registerIpc } from "./ipc.js";
import { SMOKE_TIMEOUT_MS, guardRendererRequests, parseSmokeArgs, prepareSmoke, recordingShell, removeSmokeProfile, runSmoke, writeSmokeReport } from "./smoke.js";

const here = path.dirname(fileURLToPath(import.meta.url));

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
  const currentWindow = () => (ui && !ui.win.isDestroyed() ? ui.win : null);
  const push = (channel, payload) => {
    const win = currentWindow();
    if (win && !win.webContents.isDestroyed()) win.webContents.send(channel, payload);
  };

  app.on("second-instance", () => {
    const win = currentWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
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
    // Every sign-in/sign-out (also expiry) detaches Real GPT from the previous CRM user: running answers and an open
    // ChatGPT sign-in stop, and the decrypted ChatGPT tokens leave memory. The connection belongs to one CRM user.
    const session = createSession({
      http, secureStore, log,
      onChange: (state) => {
        if (realgpt) realgpt.detach();
        push("ted:auth.changed", state);
      },
    });
    const crmUserId = () => { const s = session.state(); return s.status === "signedIn" ? s.user.id : null; };
    const assistant = createAssistant({ session, log });
    const tools = createTools({ session, log });
    const voice = createVoice({ session });
    const chats = createChats({ secureStore, userId: crmUserId });

    // Native confirmation for anything that sends or deletes. "Cancel" is the default button.
    async function confirm(message, detail, opts = {}) {
      const options = {
        type: "question", title: TITLE, message: String(message), detail: String(detail || ""),
        buttons: [opts.okLabel || "Да", opts.cancelLabel || "Отказ"], defaultId: 1, cancelId: 1, noLink: true,
      };
      const win = currentWindow();
      const r = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
      return r.response === 0;
    }
    const email = createEmail({ tools, confirm });

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
      emit: (event, payload) => { if (event === "realgpt:delta") push("ted:realgpt.delta", payload); },
    });

    const appApi = createAppApi({
      app, shell, clipboard, dialog,
      getWindow: currentWindow,
      setCompact: (on) => (ui ? ui.setCompact(on) : { ok: false }),
      openExternal: security.openExternal,
      logDir: log.dir,
    });
    registerIpc({ ipcMain, isTrusted: security.isApp, log, appApi, session, assistant, tools, email, voice, settings, chats, realgpt, confirm });

    registerAppProtocol({ protocol, root: path.join(app.getAppPath(), "dist") });
    session.init();
    ui = createMainWindow({
      BrowserWindow, screen, Menu, log,
      state: windowState,
      preload: path.join(here, "preload.cjs"),
      url: dev ? dev.href : APP_URL,
      packaged: app.isPackaged,
    });

    if (smoke) {
      runSmoke({
        win: ui.win, appUrl: APP_URL, csp: CSP, metaCsp: META_CSP,
        appFetch: (url) => net.fetch(url), backendFetch, createHttp, shell, external,
        windowCount: () => BrowserWindow.getAllWindows().length,
        shot: smoke.shot,
        info: {
          userAgent,
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
