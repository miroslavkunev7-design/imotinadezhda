// Wiring test for electron/main.js. The real "electron" module is replaced by plain-object fakes
// (the Electron binary is never started); every other module is the real one. No network is used.
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const el = vi.hoisted(() => {
  const state = {};
  function reset({ packaged = true, lock = true } = {}) {
    Object.assign(state, {
      packaged, lock, calls: [], appEvents: {}, ipc: new Map(), protocolHandlers: {}, windows: [], sessionHandlers: {},
      dialogs: [], dialogResponse: 1, opened: [], ready: null, userData: null, appPath: null, partitions: {}, netFetches: [],
    });
  }
  reset();
  const note = (name, ...args) => state.calls.push([name, ...args]);

  class BrowserWindow {
    constructor(options) {
      this.options = options;
      this.events = {};
      this.sent = [];
      this.focused = false;
      this.minimized = false;
      this.webContents = { id: state.windows.length + 1, on: () => {}, once: () => {}, send: (channel, payload) => this.sent.push([channel, payload]), isDestroyed: () => false };
      this.visible = false;
      this.top = null;
      state.windows.push(this);
    }
    on(event, fn) { this.events[event] = fn; }
    once(event, fn) { this.events[event] = fn; }
    loadURL(url) { this.url = url; return Promise.resolve(); }
    getBounds() { return this.bounds ? { ...this.bounds } : { x: 0, y: 0, width: this.options.width, height: this.options.height }; }
    getNormalBounds() { return this.getBounds(); }
    setBounds(b) { this.bounds = { ...b }; }
    hide() { this.visible = false; this.hidden = true; }
    showInactive() { this.visible = true; this.inactive = true; }
    setAlwaysOnTop(on, level) { this.top = on ? level || "floating" : null; }
    unmaximize() {}
    maximize() {}
    setFullScreen() {}
    isDestroyed() { return false; }
    isMinimized() { return this.minimized; }
    isMaximized() { return false; }
    isFullScreen() { return false; }
    restore() { this.minimized = false; }
    show() { this.shown = true; this.visible = true; }
    focus() { this.focused = true; }
  }

  const module = {
    app: {
      get isPackaged() { return state.packaged; },
      requestSingleInstanceLock: () => { note("lock"); return state.lock; },
      enableSandbox: () => note("enableSandbox"),
      setAppUserModelId: (id) => note("appUserModelId", id),
      whenReady: () => { note("whenReady"); return Promise.resolve(); },
      on: (event, fn) => { state.appEvents[event] = fn; },
      quit: () => note("quit"),
      getVersion: () => "0.1.0",
      getPath: (name) => (name === "userData" ? state.userData : state.userData + "-" + name),
      getAppPath: () => state.appPath,
      getLocale: () => "bg", // 0.1.7: the ChatGPT panel's Accept-Language follows the program's locale
      getLoginItemSettings: () => ({ openAtLogin: false }),
      setLoginItemSettings: () => {},
      userAgentFallback: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ted-desktop/0.1.0 Chrome/156.0.0.0 Electron/45.3.3 Safari/537.36",
    },
    // 0.1.3: Windows notifications (scheduled tasks) and thumbnails in MAIN.
    Notification: class { static isSupported() { return false; } on() {} show() {} },
    nativeImage: { createFromBuffer: () => ({ isEmpty: () => true }) },
    BrowserWindow,
    // 0.1.7 „ChatGPT панел“: the view is made only when the employee opens the panel (never at start).
    WebContentsView: class { constructor(options) { state.calls.push(["webContentsView", options]); this.webContents = { on() {}, setWindowOpenHandler() {}, loadURL: async () => {}, isDestroyed: () => false }; } setVisible() {} setBounds() {} setBackgroundColor() {} },
    Menu: { setApplicationMenu: (menu) => note("menu", menu), buildFromTemplate: () => ({ popup: () => {} }) },
    clipboard: { writeText: (text) => note("clipboard", text) },
    dialog: {
      showMessageBox: async (...args) => { state.dialogs.push(args); return { response: state.dialogResponse }; },
      showSaveDialog: async () => ({ canceled: true }),
      showErrorBox: (title, content) => note("errorBox", title, content),
    },
    ipcMain: { handle: (channel, fn) => state.ipc.set(channel, fn) },
    protocol: {
      registerSchemesAsPrivileged: (schemes) => note("schemes", schemes),
      handle: (scheme, fn) => { state.protocolHandlers[scheme] = fn; },
    },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (s) => Buffer.from("enc1:" + Buffer.from(String(s), "utf8").toString("hex")),
      decryptString: (b) => Buffer.from(Buffer.from(b).toString("utf8").slice(5), "hex").toString("utf8"),
    },
    screen: { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }], getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }) },
    net: { fetch: async (url) => { state.netFetches.push(["net", String(url)]); throw new Error("network must not be used in this test"); } },
    session: {
      // Backend traffic: Electron net through an in-memory partition (session.fetch).
      fromPartition: (name) => {
        if (!state.partitions[name]) {
          state.partitions[name] = {
            spell: [],
            fetch: async (url, init) => { state.netFetches.push([name, String(url), init]); throw new Error("network must not be used in this test"); },
            setSpellCheckerLanguages: (l) => state.partitions[name].spell.push(["languages", l]),
            setSpellCheckerEnabled: (on) => state.partitions[name].spell.push(["enabled", on]),
            // ted-browse (agent internet) and electron-updater install request filters on their own sessions.
            webRequest: Object.fromEntries(["onBeforeRequest", "onBeforeSendHeaders", "onBeforeRedirect", "onResponseStarted", "onCompleted", "onErrorOccurred"]
              .map((k) => [k, (fn) => { (state.partitions[name].hooks ||= {})[k] = fn; }])),
            resolveProxy: async () => "DIRECT",
          };
        }
        return state.partitions[name];
      },
      defaultSession: {
        setSpellCheckerLanguages: (l) => note("defaultSpell", "languages", l),
        setSpellCheckerEnabled: (on) => note("defaultSpell", "enabled", on),
        on: (event, fn) => { state.sessionHandlers[event] = fn; },
        setPermissionRequestHandler: (fn) => { state.sessionHandlers.request = fn; },
        setPermissionCheckHandler: (fn) => { state.sessionHandlers.check = fn; },
        setDevicePermissionHandler: (fn) => { state.sessionHandlers.device = fn; },
      },
    },
    shell: { openExternal: async (url) => { state.opened.push(url); }, openPath: async () => "" },
  };
  return { state, reset, module: { ...module, default: module } };
});

vi.mock("electron", () => el.module);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ted-core-main-"));
const listenersBefore = { uncaughtException: process.listeners("uncaughtException"), unhandledRejection: process.listeners("unhandledRejection") };
let run = 0;

// Imports a fresh copy of main.js against a fresh fake Electron.
async function boot({ packaged = true, lock = true, devUrl } = {}) {
  el.reset({ packaged, lock });
  const base = path.join(tmp, "run" + ++run);
  el.state.userData = path.join(base, "userData");
  el.state.appPath = path.join(base, "app");
  fs.mkdirSync(path.join(el.state.appPath, "dist"), { recursive: true });
  fs.writeFileSync(path.join(el.state.appPath, "dist", "index.html"), "<!doctype html><title>Тед</title>");
  if (devUrl === undefined) delete process.env.TED_DEV_URL; else process.env.TED_DEV_URL = devUrl;
  dropProcessListeners();
  vi.resetModules();
  await import("../../electron/main.js");
  await new Promise((r) => setTimeout(r, 20)); // let the whenReady() continuation run
  return el.state;
}

// The app's page in the MAIN window (0.1.6: MAIN also checks the sender is that window, not the bubble window).
const fromApp = { senderFrame: { url: "app://ted/index.html", parent: null }, get sender() { return el.state.windows[0] && el.state.windows[0].webContents; } };

// main.js installs process-level error loggers; do not leave them in the test worker.
function dropProcessListeners() {
  for (const event of ["uncaughtException", "unhandledRejection"]) {
    for (const l of process.listeners(event)) if (!listenersBefore[event].includes(l)) process.removeListener(event, l);
  }
}

beforeEach(() => { delete process.env.TED_DEV_URL; });
afterEach(dropProcessListeners);
afterAll(() => {
  delete process.env.TED_DEV_URL;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("main.js", () => {
  it("hardens the app before ready and wires one window on app://ted/", async () => {
    const s = await boot();
    const order = s.calls.map((c) => c[0]);
    expect(order.slice(0, 5)).toEqual(["lock", "enableSandbox", "schemes", "appUserModelId", "whenReady"]);
    expect(s.calls.find((c) => c[0] === "schemes")[1]).toEqual([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
    expect(s.calls).toContainEqual(["menu", null]); // packaged: no application menu
    expect(order).not.toContain("quit");

    expect(s.windows).toHaveLength(1);
    const win = s.windows[0];
    expect(win.url).toBe("app://ted/index.html");
    expect(win.options.webPreferences).toMatchObject({ contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false, spellcheck: false, devTools: false });
    expect(win.options.webPreferences.preload).toMatch(/electron[\\/]preload\.cjs$/);
    expect(fs.existsSync(win.options.webPreferences.preload)).toBe(true);
    expect(win.options).toMatchObject({ titleBarStyle: "hidden", minWidth: 360, minHeight: 560, width: 1366, height: 860 });

    // Security handlers are installed on the default session and for every web contents.
    expect(Object.keys(s.sessionHandlers).sort()).toEqual(["check", "device", "request", "will-download"]);
    expect(typeof s.appEvents["web-contents-created"]).toBe("function");
    expect(typeof s.appEvents["window-all-closed"]).toBe("function");

    // No spell-checker anywhere (it would download dictionaries from Google at start-up).
    expect(s.calls.filter((c) => c[0] === "defaultSpell")).toEqual([["defaultSpell", "languages", []], ["defaultSpell", "enabled", false]]);
    // in-memory partitions (no "persist:" prefix): the backend and, separately, the agent's internet (0.1.3)
    expect(Object.keys(s.partitions)).toEqual(["ted-backend", "ted-browse"]);
    expect(s.partitions["ted-backend"].spell).toEqual([["languages", []], ["enabled", false]]);
    expect(s.partitions["ted-browse"].spell).toEqual([["languages", []], ["enabled", false]]);
    // The browse session checks every request (SSRF rules) and strips credentials (electron/browse/net.js).
    expect(Object.keys(s.partitions["ted-browse"].hooks).sort()).toEqual(["onBeforeRedirect", "onBeforeRequest", "onBeforeSendHeaders", "onCompleted", "onErrorOccurred", "onResponseStarted"]);
    expect(s.partitions["ted-backend"].hooks).toBeUndefined();
  });

  it("sends backend requests through Electron net (partition fetch): no cookies, no cache, no redirects", async () => {
    const realFetch = globalThis.fetch;
    let nodeFetches = 0;
    globalThis.fetch = async () => { nodeFetches++; throw new Error("Node fetch must not be used by the program"); };
    try {
      const s = await boot();
      // The login is the first request that needs the network; the fake transport fails it, so nothing is sent.
      const r = await s.ipc.get("ted:auth.login")(fromApp, { identifier: "a@example.com", password: "x" });
      expect(r).toMatchObject({ ok: false });
      expect(nodeFetches).toBe(0);
      expect(s.netFetches).toHaveLength(1);
      const [partition, url, init] = s.netFetches[0];
      expect(partition).toBe("ted-backend");
      expect(url).toBe("https://imotinadezhda.bg/api/register");
      expect(init).toMatchObject({ method: "POST", redirect: "manual", credentials: "omit", cache: "no-store" });
      expect(Object.keys(init.headers).map((k) => k.toLowerCase()).sort()).toEqual(["content-type", "user-agent"]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("serves the renderer through the app protocol with the CSP header", async () => {
    const s = await boot();
    const res = await s.protocolHandlers.app(new Request("app://ted/index.html"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>Тед</title>");
    expect(res.headers.get("content-security-policy")).toContain("connect-src 'none'");
    expect((await s.protocolHandlers.app(new Request("app://ted/..%2F..%2Fpackage.json"))).status).toBe(403);
  });

  it("registers all 82 IPC channels + the 7 bubble channels and answers the app's own page only", async () => {
    const s = await boot();
    // CONTRACT §2 + §8 + §22 + §23: 86 window.ted functions minus 9 subscriptions (0.1.5: + browse.image, + 4 projects; 0.1.6: + 4 window; 0.1.7: + 6 chatgpt)
    expect([...s.ipc.keys()].filter((c) => c.startsWith("ted:"))).toHaveLength(82);
    expect([...s.ipc.keys()].filter((c) => c.startsWith("ted-bubble:")).sort()).toEqual(["ted-bubble:click", "ted-bubble:dragEnd", "ted-bubble:dragMove", "ted-bubble:dragStart", "ted-bubble:menu", "ted-bubble:openNormal", "ted-bubble:ready"]);
    expect(s.ipc.size).toBe(89);
    expect(await s.ipc.get("ted:app.info")(fromApp)).toEqual({ version: "0.1.0", platform: process.platform, packaged: true });
    expect(await s.ipc.get("ted:auth.state")(fromApp)).toEqual({ status: "signedOut" });
    expect(await s.ipc.get("ted:store.loadChats")(fromApp)).toEqual({ chats: [] });
    expect(await s.ipc.get("ted:store.setSettings")(fromApp, { big: true })).toEqual({ big: true });
    expect(JSON.parse(fs.readFileSync(path.join(s.userData, "settings.json"), "utf8"))).toEqual({ big: true });
    expect(await s.ipc.get("ted:realgpt.status")(fromApp)).toEqual({ connected: false });
    await expect(s.ipc.get("ted:auth.state")({ senderFrame: { url: "https://evil.example/" } })).rejects.toThrow("forbidden");
    await expect(s.ipc.get("ted:auth.state")({ senderFrame: { url: "http://localhost:5173/" } })).rejects.toThrow("forbidden");
  });

  it("signed out: CRM calls fail locally with code auth and never reach the network", async () => {
    const realFetch = globalThis.fetch;
    let fetched = 0;
    globalThis.fetch = async () => { fetched++; throw new Error("network must not be used in this test"); };
    try {
      const s = await boot();
      expect(await s.ipc.get("ted:crm.read")(fromApp, "cases.list", {})).toMatchObject({ ok: false, code: "auth" });
      expect(await s.ipc.get("ted:crm.read")(fromApp, "clients.delete", { id: "1" })).toMatchObject({ ok: false, code: "forbidden" });
      expect(await s.ipc.get("ted:api.chat")(fromApp, { requestId: "r1", messages: [{ role: "user", text: "здравей" }] })).toMatchObject({ ok: false, code: "auth", maybeExecuted: false });
      expect(await s.ipc.get("ted:api.models")(fromApp)).toMatchObject({ ok: false, code: "auth" });
      expect(await s.ipc.get("ted:voice.tts")(fromApp, { text: "здравей" })).toMatchObject({ ok: false, code: "auth" });
      expect(await s.ipc.get("ted:store.saveChats")(fromApp, [{ id: 1 }])).toMatchObject({ ok: false });
      expect(await s.ipc.get("ted:auth.logout")(fromApp)).toEqual({ ok: true });
      // Real GPT is bound to the CRM user: signed out, nothing is connected and nothing can be started.
      expect(await s.ipc.get("ted:realgpt.status")(fromApp)).toEqual({ connected: false });
      expect(await s.ipc.get("ted:realgpt.signIn")(fromApp)).toMatchObject({ ok: false, code: "signed_out" });
      expect(await s.ipc.get("ted:realgpt.models")(fromApp)).toMatchObject({ ok: false, code: "signed_out" });
      expect(await s.ipc.get("ted:realgpt.send")(fromApp, { requestId: "r1", model: "m", messages: [{ role: "user", text: "x" }] })).toMatchObject({ ok: false, code: "signed_out" });
      expect(fetched).toBe(0);
      expect(s.netFetches).toEqual([]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("uses native Bulgarian dialogs with Cancel as the default button", async () => {
    const s = await boot();
    s.dialogResponse = 1; // "Отказ"
    expect(await s.ipc.get("ted:memory.forget")(fromApp, { id: "m1", preview: "факт" })).toEqual({ ok: false, canceled: true });
    expect(await s.ipc.get("ted:email.confirmSend")(fromApp, { to: { email: "a@example.com", name: "А" }, subject: "Тема", attachments: [] })).toEqual({ ok: false, canceled: true });
    expect(await s.ipc.get("ted:store.clearLocal")(fromApp)).toEqual({ ok: false, canceled: true });
    expect(s.dialogs).toHaveLength(3);
    const [win, options] = s.dialogs[1];
    expect(win).toBe(s.windows[0]);
    expect(options).toMatchObject({ message: "Изпращане на имейл", buttons: ["Изпрати", "Отказ"], defaultId: 1, cancelId: 1, noLink: true });
    expect(options.detail).toContain("А <a@example.com>");
    expect(s.dialogs[0][1].buttons).toEqual(["Забрави", "Отказ"]);
    expect(s.dialogs[2][1].buttons).toEqual(["Изтрий", "Отказ"]);
    s.dialogResponse = 0; // confirmed, but nobody is signed in: still nothing is deleted on a server
    expect(await s.ipc.get("ted:store.clearLocal")(fromApp)).toEqual({ ok: true });
  });

  it("opens only https: and mailto: links in the system browser", async () => {
    const s = await boot();
    expect(await s.ipc.get("ted:app.openExternal")(fromApp, "https://imotinadezhda.bg/crm")).toEqual({ ok: true });
    expect(await s.ipc.get("ted:app.openExternal")(fromApp, "file:///C:/Windows/System32/calc.exe")).toMatchObject({ ok: false });
    expect(await s.ipc.get("ted:app.openExternal")(fromApp, "javascript:alert(1)")).toMatchObject({ ok: false });
    expect(s.opened).toEqual(["https://imotinadezhda.bg/crm"]);
  });

  it("a second launch focuses the existing window", async () => {
    const s = await boot();
    const win = s.windows[0];
    win.minimized = true;
    s.appEvents["second-instance"]();
    expect(win.minimized).toBe(false);
    expect(win.focused).toBe(true);
    expect(s.windows).toHaveLength(1);
  });

  // 0.1.6 „Балонче“: the bubble window exists only after the employee asks for it, gets its own preload and page,
  // and can reach neither the window.ted channels nor its own from anywhere else.
  it("Балонче: a lazy bubble window with its own preload; the channels of each window are refused from the other", async () => {
    const s = await boot();
    expect(s.windows).toHaveLength(1); // nothing at start (and never in a smoke run)
    expect(await s.ipc.get("ted:window.state")(fromApp)).toEqual({ mode: "normal" });
    const going = s.ipc.get("ted:window.bubble")(fromApp);
    await new Promise((r) => setTimeout(r, 10));
    expect(s.windows).toHaveLength(2);
    const bw = s.windows[1];
    expect(bw.url).toBe("app://ted/bubble.html");
    expect(bw.options).toMatchObject({ width: 64, height: 64, frame: false, transparent: true, skipTaskbar: true, alwaysOnTop: true, resizable: false, show: false, focusable: true });
    expect(bw.options.webPreferences).toMatchObject({ contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false, devTools: false });
    expect(bw.options.webPreferences.preload).toMatch(/electron[\\/]preload-bubble\.cjs$/);
    expect(fs.existsSync(bw.options.webPreferences.preload)).toBe(true);
    bw.events["ready-to-show"]();
    expect(await going).toEqual({ ok: true, mode: "bubble" });
    expect(s.windows[0].hidden).toBe(true);
    expect(bw.inactive).toBe(true); // shown without taking the focus
    expect(bw.top).toBe("floating");
    expect(s.windows[0].sent).toContainEqual(["ted:window.mode", { mode: "bubble" }]);

    const fromBubble = { senderFrame: { url: "app://ted/bubble.html", parent: null }, sender: bw.webContents };
    // The bubble page is of the same origin, but window.ted channels answer only the main window.
    await expect(s.ipc.get("ted:auth.state")(fromBubble)).rejects.toThrow("forbidden");
    await expect(s.ipc.get("ted:crm.read")(fromBubble, "cases.list", {})).rejects.toThrow("forbidden");
    // And the bubble channels answer only the bubble page in the bubble window.
    await expect(s.ipc.get("ted-bubble:click")(fromApp)).rejects.toThrow("forbidden");
    await expect(s.ipc.get("ted-bubble:click")({ senderFrame: { url: "app://ted/index.html", parent: null }, sender: bw.webContents })).rejects.toThrow("forbidden");
    expect(await s.ipc.get("ted-bubble:ready")(fromBubble)).toEqual({ mode: "bubble", unread: 0, working: false, attention: false, side: "right" });
    // Click -> the mini chat: the main window, always on top, next to the bubble; the bubble hides.
    expect(await s.ipc.get("ted-bubble:click")(fromBubble)).toEqual({ ok: true, mode: "mini" });
    expect(s.windows[0].top).toBe("floating");
    expect(s.windows[0].bounds).toMatchObject({ width: 400, height: 640 });
    expect(bw.visible).toBe(false);
    // „Нормален прозорец“ from the main window.
    expect(await s.ipc.get("ted:window.restore")(fromApp, "ignored", { x: 1 })).toEqual({ ok: true, mode: "normal" });
    expect(s.windows[0].top).toBe(null);
    expect(s.windows[0].bounds).toEqual({ x: 0, y: 0, width: 1366, height: 860 });
  });

  it("quits immediately when another instance already runs", async () => {
    const s = await boot({ lock: false });
    expect(s.calls.map((c) => c[0])).toEqual(["lock", "quit"]);
    expect(s.windows).toHaveLength(0);
    expect(s.ipc.size).toBe(0);
  });

  it("a start-up failure is shown to the user and the app quits instead of running without a window", async () => {
    const s = await boot();
    expect(s.calls.map((c) => c[0])).not.toContain("errorBox"); // the normal start shows no error
    // Break the start: userData cannot be resolved.
    el.reset();
    el.state.userData = null;
    el.state.appPath = null;
    dropProcessListeners();
    vi.resetModules();
    await import("../../electron/main.js");
    await new Promise((r) => setTimeout(r, 20));
    const box = el.state.calls.find((c) => c[0] === "errorBox");
    expect(box[1]).toBe("Тед – Имоти Надежда");
    expect(box[2]).toMatch(/^Програмата не можа да стартира\./);
    expect(el.state.calls.map((c) => c[0])).toContain("quit");
    expect(el.state.windows).toHaveLength(0);
  });

  it("development: loads TED_DEV_URL, keeps the menu and trusts that origin for IPC", async () => {
    const s = await boot({ packaged: false, devUrl: "http://localhost:5173" });
    expect(s.windows[0].url).toBe("http://localhost:5173/");
    expect(s.windows[0].options.webPreferences.devTools).toBe(true);
    expect(s.calls.map((c) => c[0])).not.toContain("menu");
    expect(await s.ipc.get("ted:auth.state")({ senderFrame: { url: "http://localhost:5173/" }, sender: s.windows[0].webContents })).toEqual({ status: "signedOut" });
    await expect(s.ipc.get("ted:auth.state")({ senderFrame: { url: "http://localhost:9999/" } })).rejects.toThrow("forbidden");
  });

  it("ignores TED_DEV_URL when packaged or when it is not a local http address", async () => {
    expect((await boot({ packaged: true, devUrl: "http://localhost:5173" })).windows[0].url).toBe("app://ted/index.html");
    expect((await boot({ packaged: false, devUrl: "https://evil.example/app" })).windows[0].url).toBe("app://ted/index.html");
    expect((await boot({ packaged: false, devUrl: "not a url" })).windows[0].url).toBe("app://ted/index.html");
  });
});
