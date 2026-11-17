// Тед за Windows - MAIN process entry: lifecycle, hardening and wiring of all modules.
// MAIN is the only place that talks to the network and the only place that holds credentials.
import { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, protocol, safeStorage, screen, session as electronSession, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createLog } from "./log.js";
import { createSecureStore } from "./store/secure-file.js";
import { createSettings } from "./store/settings.js";
import { createChats } from "./store/chats.js";
import { createHttp } from "./backend/http.js";
import { createSession } from "./backend/session.js";
import { createAssistant } from "./backend/assistant.js";
import { createTools } from "./backend/tools.js";
import { createEmail } from "./backend/email.js";
import { createVoice } from "./backend/voice.js";
import { createRealGpt } from "./realgpt/index.js";
import { APP_URL, SCHEME, registerAppProtocol } from "./protocol.js";
import { installSecurity } from "./security.js";
import { createMainWindow, TITLE } from "./window.js";
import { createAppApi, registerIpc } from "./ipc.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// Development only: TED_DEV_URL=http://localhost:5173 loads the Vite dev server instead of app://ted/.
function devServerUrl() {
  if (app.isPackaged || !process.env.TED_DEV_URL) return null;
  try {
    const u = new URL(process.env.TED_DEV_URL);
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1") ? u : null;
  } catch { return null; }
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
    const http = createHttp({ log, userAgent: `TedDesktop/${app.getVersion()}` });

    const session = createSession({ http, secureStore, log, onChange: (state) => push("ted:auth.changed", state) });
    const assistant = createAssistant({ session, log });
    const tools = createTools({ session, log });
    const voice = createVoice({ session });
    const chats = createChats({ secureStore, userId: () => { const s = session.state(); return s.status === "signedIn" ? s.user.id : null; } });

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

    const security = installSecurity({ app, session: electronSession.defaultSession, shell, log, devOrigin });
    const realgpt = createRealGpt({
      http, secureStore, log,
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
  });
}

// One instance only: a second launch focuses the existing window. This also keeps two processes
// from racing on the rotating Supabase refresh token.
if (app.requestSingleInstanceLock()) start();
else app.quit();
