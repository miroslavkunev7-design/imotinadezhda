// 0.1.7 „ChatGPT панел“ (docs/CONTRACT.md §23): the panel controller with plain fakes (no Electron binary, no network).
import { describe, it, expect } from "vitest";
import {
  BLANK_CHILD_MS, CLIPBOARD_MAX, EXTERNAL_GAP_MS, GESTURE_MS, MAX_CHILDREN, PANEL_PARTITION_PREFIX, SIGNIN_HOSTS, TITLE_BAR,
  acceptLanguages, bootstrapUrl, childShape, chromeUserAgent, cleanBounds, clientHints, createChatGptPanel, downloadAllowed,
  downloadSource, frameUrlAllowed, hostAllowed, pageUrl, panelPartition, panelPermission, panelWebPreferences, popupKind,
  readClipboardImage, withClientHints,
} from "../../electron/chatgpt-panel.js";
import { RUNNABLE as APP_RUNNABLE } from "../../electron/files.js";
import { installSecurity } from "../../electron/security.js";
import { chatgptUrl } from "../../electron/agent/chatgpt-link.js";

const FALLBACK = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Ted Imoti Nadezhda/0.1.7 Chrome/156.0.8078.100 Electron/45.3.3 Safari/537.36";
const UA = chromeUserAgent(FALLBACK);

function emitter(target) {
  const handlers = {};
  target.handlers = handlers;
  target.on = (ev, fn) => { (handlers[ev] ||= []).push(fn); return target; };
  target.once = target.on;
  target.fire = (ev, ...args) => (handlers[ev] || []).forEach((fn) => fn(...args));
  return target;
}
const event = (extra = {}) => ({ prevented: false, preventDefault() { this.prevented = true; }, ...extra });

function fakeSession(name) {
  const s = emitter({ name, storagePath: "/profile/Partitions/" + name.replace("persist:", ""), ua: null, spell: [] });
  s.setUserAgent = (ua, al) => { s.ua = ua; s.al = al; };
  s.webRequest = { onBeforeSendHeaders: (filter, fn) => { s.headersFilter = filter; s.headers = fn; } };
  s.setPermissionRequestHandler = (fn) => { s.request = fn; };
  s.setPermissionCheckHandler = (fn) => { s.check = fn; };
  s.setDevicePermissionHandler = (fn) => { s.device = fn; };
  s.setSpellCheckerLanguages = (l) => s.spell.push(["languages", l]);
  s.setSpellCheckerEnabled = (on) => s.spell.push(["enabled", on]);
  return s;
}

// A web contents of the panel (the view's, or a pop-up's that Chromium made).
function fakeContents(session) {
  const wc = emitter({ loads: [], url: "", closed: false, ua: null, copied: [], downloads: [], edits: [] });
  wc.session = session;
  wc.setWindowOpenHandler = (fn) => { wc.openHandler = fn; };
  wc.loadURL = (url) => { wc.loads.push(url); wc.url = url; return Promise.resolve(); };
  wc.reload = () => { wc.loads.push("reload"); };
  wc.getURL = () => wc.url;
  wc.setUserAgent = (ua) => { wc.ua = ua; };
  wc.isDestroyed = () => wc.closed;
  wc.close = () => { wc.closed = true; };
  wc.copyImageAt = (x, y) => wc.copied.push([x, y]);
  wc.downloadURL = (u) => wc.downloads.push(u);
  for (const k of ["cut", "copy", "paste", "selectAll"]) wc[k] = () => wc.edits.push(k);
  return wc;
}
const click = (wc) => { wc.fire("input-event", event(), { type: "mouseDown" }); wc.fire("input-event", event(), { type: "mouseUp" }); };
const TOP = { url: "https://chatgpt.com/c/1", parent: null }; // the panel page's own top frame as a navigation's initiator

function rig({ owner = "crm-user-1", packaged = true, zoom = 1, locale, platform = "win32", withBrowserWindow = true } = {}) {
  const sessions = {};
  const views = [];
  const opened = [];
  const menus = [];
  const states = [];
  const shortcuts = [];
  const created = [];
  const windows = [];
  const timers = [];
  const written = [];
  let who = owner;
  let now = 1000000;
  const win = emitter({
    destroyed: false, isDestroyed() { return this.destroyed; },
    contentView: { children: [], addChildView(v) { this.children.push(v); }, removeChildView(v) { this.children = this.children.filter((x) => x !== v); } },
    webContents: { getZoomFactor: () => zoom },
  });
  class WebContentsView {
    constructor(options) {
      this.options = options;
      this.visible = null;
      this.bounds = null;
      this.webContents = fakeContents(options.webPreferences.session);
      views.push(this);
    }
    setVisible(v) { this.visible = v; }
    setBounds(b) { this.bounds = { ...b }; }
    setBackgroundColor(c) { this.bg = c; }
  }
  class BrowserWindow {
    constructor(options) {
      emitter(this);
      this.options = options;
      this.destroyed = false;
      this.visible = !!options.show;
      this.webContents = options.webContents;
      windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    destroy() { if (this.destroyed) return; this.destroyed = true; this.webContents.closed = true; this.fire("closed"); }
    isVisible() { return this.visible; }
    show() { this.visible = true; }
    hide() { this.visible = false; }
  }
  const clip = { image: null, text: [] };
  const panel = createChatGptPanel({
    WebContentsView,
    ...(withBrowserWindow ? { BrowserWindow } : {}),
    ...(locale ? { locale } : {}),
    platform,
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    writeFile: (file, text) => written.push({ file, text }),
    fromPartition: (name) => (sessions[name] ||= fakeSession(name)),
    getWindow: () => win,
    windowFor: () => win,
    Menu: { buildFromTemplate: (items) => ({ popup: (opts) => menus.push({ items, opts }) }) },
    clipboard: { readImage: () => clip.image, writeText: (t) => clip.text.push(t) },
    openExternal: async (url) => { opened.push(url); return { ok: true }; },
    owner: () => who,
    userAgent: UA,
    packaged,
    documentsDir: () => "C:/Users/test/Documents",
    emit: (s) => states.push(s),
    onShortcut: (n) => shortcuts.push(n),
    now: () => now,
  });
  // window.open from a panel contents as Electron does it: the handler, then (allowed) Chromium's new contents is
  // hardened by security.js and handed to createWindow with the options Electron built (here: the page's features).
  const popup = (opener, details) => {
    const res = opener.openHandler(details);
    if (res.action !== "allow") return { res, win: null, guest: null };
    const guest = fakeContents(opener.session);
    panel.harden(guest);
    const back = res.createWindow({ webContents: guest, ...res.overrideBrowserWindowOptions, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, closable: false, x: 0, y: 0, opacity: 0.05, focusable: false });
    return { res, win: windows.at(-1), guest: back };
  };
  return {
    panel, win, views, sessions, opened, menus, states, shortcuts, clip, created, windows, timers, written, popup,
    setOwner: (o) => { who = o; }, tick: (ms) => { now += ms; },
    view: () => views[views.length - 1], wc: () => views[views.length - 1].webContents,
  };
}

describe("hosts and addresses", () => {
  it("top-level pages: chatgpt.com, openai.com and their subdomains, and the exact sign-in hosts", () => {
    for (const u of ["https://chatgpt.com/", "https://chatgpt.com/c/68f1-abc", "https://www.chatgpt.com/", "https://CHATGPT.COM/", "https://chatgpt.com:443/",
      "https://auth.openai.com/log-in", "https://openai.com/", "https://help.openai.com/en/", "https://sora.chatgpt.com/",
      "https://accounts.google.com/o/oauth2/v2/auth?x=1", "https://accounts.google.bg/accounts/SetSID", "https://accounts.youtube.com/accounts/SetSID",
      "https://appleid.apple.com/auth/authorize", "https://idmsa.apple.com/appleauth/", "https://login.microsoftonline.com/common/oauth2", "https://login.live.com/oauth20_authorize.srf",
    ]) expect(pageUrl(u), u).not.toBeNull();
  });

  it("refuses look-alikes, userinfo, ports, other schemes, IDN homographs and everything else", () => {
    for (const u of [
      "http://chatgpt.com/", "https://chatgpt.com:8443/", "https://chatgpt.com:444/", "https://user:pw@chatgpt.com/", "https://user@chatgpt.com/",
      "https://chatgpt.com@evil.example/", "https://evil.example\\@chatgpt.com/", "https://evil.example/#@chatgpt.com", "https://evil.example/?u=https://chatgpt.com/",
      "https://chatgpt.com.evil.example/", "https://evilchatgpt.com/", "https://chatgpt.co/", "https://chatgpt.com./", "https://chatgpt.com%2eevil.example/",
      "https://xn--chatgt-l0g.com/", "https://chatgpт.com/", "https://сhatgpt.com/", "https://openai.com.evil.example/", "https://notopenai.com/",
      "https://evil.accounts.google.com/", "https://accounts.google.com.evil.example/", "https://mail.google.com/", "https://google.com/", "https://apple.com/",
      "https://login.microsoftonline.com.evil.example/", "https://127.0.0.1/", "https://[::1]/", "https://localhost/",
      "javascript:alert(1)", "data:text/html,<b>x</b>", "file:///C:/Windows/win.ini", "about:blank", "chrome://settings", "app://ted/index.html",
      "blob:https://chatgpt.com/0f0e", "ws://chatgpt.com/", "wss://chatgpt.com/", "ftp://chatgpt.com/", "", "chatgpt.com", "https://" + "a".repeat(40000) + ".chatgpt.com/",
      null, undefined, 42, {},
    ]) expect(pageUrl(u), String(u).slice(0, 80)).toBeNull();
    expect(hostAllowed("chatgpt.com.")).toBe(false);
    expect(SIGNIN_HOSTS).not.toContain("google.com");
  });

  it("frames inside a page: https (Cloudflare check, widgets), about:blank/srcdoc, blob:, data: – never file:, http:, chrome:", () => {
    for (const u of ["https://challenges.cloudflare.com/cdn-cgi/x", "https://accounts.google.com/gsi/iframe", "about:blank", "about:srcdoc", "blob:https://chatgpt.com/1", "data:text/html,x"]) expect(frameUrlAllowed(u), u).toBe(true);
    for (const u of ["http://example.com/", "file:///C:/x", "chrome://gpu", "javascript:alert(1)", "https://u:p@example.com/", "app://ted/", "ftp://x/", "", null]) expect(frameUrlAllowed(u), String(u)).toBe(false);
  });

  it("pop-ups: sign-in windows of the providers are children of the panel; other https goes to the browser; the rest nowhere", () => {
    expect(popupKind("about:blank")).toBe("child");
    expect(popupKind("")).toBe("child");
    for (const u of ["https://accounts.google.com/gsi/select", "https://appleid.apple.com/auth/authorize", "https://login.live.com/x", "https://auth.openai.com/authorize"]) expect(popupKind(u), u).toBe("child");
    for (const u of ["https://chatgpt.com/share/1", "https://example.com/page", "https://evil.accounts.google.com/", "https://accounts.google.com.evil.example/"]) expect(popupKind(u), u).toBe("external");
    for (const u of ["http://example.com/", "javascript:alert(1)", "data:text/html,x", "file:///C:/x", "mailto:a@b.bg", "https://u:p@example.com/"]) expect(popupKind(u), u).toBe("deny");
  });

  it("a normal Chrome user agent: no Electron and program tokens, Chrome's reduced version „<major>.0.0.0“", () => {
    expect(UA).toBe("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36");
    expect(chromeUserAgent("Mozilla/5.0 (X11) ted-desktop/0.1.7 Chrome/1 Electron/45 Safari/537.36 TedDesktop/0.1.7")).toBe("Mozilla/5.0 (X11) Chrome/1 Safari/537.36");
    expect(chromeUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ted-desktop/0.1.6 Chrome/156.0.8078.100 Electron/45.3.3 Safari/537.36"))
      .toBe("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36");
    expect(UA).not.toMatch(/Electron|Ted|ted-desktop|8078/i);
  });

  it("client hints like Chrome's (the brands the page's JS sees) and Accept-Language from the program's locale", () => {
    // Electron 45 / Chromium 156: navigator.userAgentData.brands = [Not:A-Brand 8, Chromium 156] (real run).
    expect(clientHints(UA, "win32")).toEqual({ "sec-ch-ua": '"Not:A-Brand";v="8", "Chromium";v="156"', "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"' });
    expect(clientHints("Chrome/157.0.0.0", "darwin")).toEqual({ "sec-ch-ua": '"Chromium";v="157", "Not-A.Brand";v="99"', "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"macOS"' });
    expect(clientHints("no version", "win32")).toBeNull();
    const h = withClientHints({ Accept: "*/*", "Sec-CH-UA": "kept" }, clientHints(UA, "linux"));
    expect(h).toEqual({ Accept: "*/*", "Sec-CH-UA": "kept", "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Linux"' });
    // Electron wants plain codes and adds the q-values itself (a q-value here gave „bg;q=0.9;q=0.9“ on the wire).
    expect(acceptLanguages("bg")).toBe("bg");
    expect(acceptLanguages("en-US")).toBe("en-US,en");
    expect(acceptLanguages("bg-BG")).toBe("bg-BG,bg");
    for (const bad of ["", null, "bg;q=0.9", "x".repeat(40), "bg,en"]) expect(acceptLanguages(bad), String(bad)).toBe("en-US,en");
    for (const l of ["bg", "en-US", "de-DE"]) expect(acceptLanguages(l)).not.toMatch(/q=/);
  });

  it("chatgpt.com/?q= goes through a blank local page (a link from another site): the address inside is exactly chatgpt-link's", () => {
    const target = chatgptUrl("Снимка на хол \"с кавички\" <b> & ' (тест)");
    const boot = bootstrapUrl(target);
    expect(boot.startsWith("data:text/html;charset=utf-8,")).toBe(true);
    const html = decodeURIComponent(boot.slice("data:text/html;charset=utf-8,".length));
    const m = /<meta http-equiv="refresh" content="0;url=([^"]*)">/.exec(html);
    expect(m).not.toBeNull();
    const back = m[1].replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, "\"").replace(/&amp;/g, "&");
    expect(back).toBe(target);
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
    expect(html).not.toMatch(/<script/i);
  });
});

describe("partition, preferences and permissions", () => {
  it("one persistent partition per CRM user – never the app's session", () => {
    const a = panelPartition("crm-user-1");
    expect(a.startsWith(PANEL_PARTITION_PREFIX)).toBe(true);
    expect(a).toMatch(/^persist:chatgpt-[0-9a-f]{16}$/);
    expect(panelPartition("crm-user-2")).not.toBe(a);
    expect(panelPartition("crm-user-1")).toBe(a);
    expect(a).not.toContain("crm-user-1");
  });

  it("the view: no preload, isolated, sandboxed, no Node, no <webview>, DevTools only when not packaged", async () => {
    const r = rig();
    expect(r.panel.created()).toBe(0);
    expect(r.panel.open({ url: "https://chatgpt.com/" })).toEqual({ ok: true });
    const prefs = r.view().options.webPreferences;
    expect(prefs).not.toHaveProperty("preload");
    expect(prefs).toMatchObject({ contextIsolation: true, sandbox: true, nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false, webviewTag: false, webSecurity: true, allowRunningInsecureContent: false, devTools: false, spellcheck: false });
    expect(prefs.session.name).toBe(panelPartition("crm-user-1"));
    expect(r.panel.created()).toBe(1);
    expect(panelWebPreferences({ packaged: false }).devTools).toBe(true);
    const ses = r.sessions[panelPartition("crm-user-1")];
    expect(ses.ua).toBe(UA);
    expect(ses.al).toBe("en-US,en");
    expect(r.wc().ua).toBe(UA);
    expect(ses.spell).toEqual([["languages", []], ["enabled", false]]);
    // Every https request of the partition gets the client hints (without overwriting what Chromium sent).
    expect(ses.headersFilter).toEqual({ urls: ["https://*/*"] });
    let got = null;
    ses.headers({ url: "https://chatgpt.com/", requestHeaders: { "User-Agent": UA } }, (v) => { got = v; });
    expect(got.requestHeaders).toEqual({ "User-Agent": UA, "sec-ch-ua": '"Not:A-Brand";v="8", "Chromium";v="156"', "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"' });
    const bg = rig({ locale: "bg" });
    bg.panel.open({});
    expect(bg.sessions[panelPartition("crm-user-1")].al).toBe("bg");
  });

  it("every permission is refused except ChatGPT's own copy button on its own pages", () => {
    const r = rig();
    r.panel.open({});
    const ses = r.sessions[panelPartition("crm-user-1")];
    const ask = (permission, requestingUrl) => { let got = null; ses.request(r.wc(), permission, (v) => { got = v; }, { requestingUrl }); return got; };
    expect(ask("clipboard-sanitized-write", "https://chatgpt.com/c/1")).toBe(true);
    for (const p of ["media", "notifications", "geolocation", "clipboard-read", "fullscreen", "openExternal", "midi", "pointerLock", "display-capture", "local-network-access", "storage-access", "hid", "serial", "usb", "unknown"]) {
      expect(ask(p, "https://chatgpt.com/"), p).toBe(false);
    }
    expect(ask("clipboard-sanitized-write", "https://evil.example/")).toBe(false);
    expect(ask("clipboard-sanitized-write", "app://ted/index.html")).toBe(false);
    expect(ses.check(r.wc(), "clipboard-sanitized-write", "https://chatgpt.com")).toBe(true);
    expect(ses.check(r.wc(), "media", "https://chatgpt.com")).toBe(false);
    expect(ses.check(r.wc(), "clipboard-sanitized-write", "https://evil.example")).toBe(false);
    expect(ses.device()).toBe(false);
    expect(panelPermission("clipboard-sanitized-write", "https://auth.openai.com")).toBe(true);
    expect(panelPermission("clipboard-read", "https://chatgpt.com")).toBe(false);
  });

  // A DownloadItem as Electron 45 gives it (hasUserGesture: a click on the page; false for script, frames, downloadURL).
  const dlItem = (url, name, gesture = true) => emitter({
    url, name, gesture, opts: null, path: null, saved: "", cancelled: false,
    getURL() { return this.url; }, getFilename() { return this.name; }, hasUserGesture() { return this.gesture; },
    setSaveDialogOptions(o) { this.opts = o; }, setSavePath(p) { this.path = p; }, getSavePath() { return this.saved; }, cancel() { this.cancelled = true; },
  });
  const dl = (r, item) => { const e = event(); r.sessions[panelPartition("crm-user-1")].fire("will-download", e, item, r.wc()); return e.prevented; };

  it("downloads: only ChatGPT/OpenAI, only after a click, only pictures and documents, only through the save dialog", () => {
    const r = rig();
    r.panel.open({});
    const png = dlItem("https://files.oaiusercontent.com/file-abc?sig=1", "ChatGPT Image.png");
    expect(dl(r, png)).toBe(false);
    expect(png.path).toBeNull(); // no save path: the save dialog asks
    expect(png.opts).toMatchObject({ title: "Запази файла от files.oaiusercontent.com", buttonLabel: "Запази", filters: [{ name: "PNG", extensions: ["png"] }] });
    expect(png.opts.defaultPath.replace(/\\/g, "/")).toBe("C:/Users/test/Documents/ChatGPT Image.png");
    expect(dl(r, dlItem("blob:https://chatgpt.com/2c1f-9", "report.pdf"))).toBe(false);
    expect(dl(r, dlItem("https://chatgpt.com/backend-api/files/x", "table.xlsx"))).toBe(false);
    // Programs and every other type Windows would run or mount (the app's own files.js list too), macro documents.
    for (const bad of ["setup.exe", "x.msi", "run.bat", "a.ps1", "x.lnk", "x.js", "evil.scr", "Ted-update.iso", "disk.img", "d.vhd", "d.vhdx", "help.chm", "addin.xll", "a.xlam",
      "report.docm", "macro.xlsm", "deck.pptm", "x.settingcontent-ms", "x.sct", "x.wsc", "x.psc1", "x.ocx", "x.drv", "x.vb", "x.one", "x.appinstaller", "x.library-ms", "x.html", "x.svg", "x.zip", "noext"]) {
      const it2 = dlItem("https://chatgpt.com/f", bad);
      expect(dl(r, it2), bad).toBe(true);
      expect(it2.opts).toBeNull();
    }
    expect(r.states.at(-1).blocked).toEqual({ host: "chatgpt.com", external: false, canOpen: false, download: true });
    // Another site (a frame of any https host), a blob of another site, a data: address of the page, a user part, a port.
    for (const src of ["https://thirdparty.example/Ted-update.png", "blob:https://thirdparty.example/1", "data:image/png;base64,AAAA", "https://u@chatgpt.com/x", "https://chatgpt.com:8443/x", "http://chatgpt.com/x", "file:///C:/x.png", "https://chatgpt.com.evil.example/x"]) {
      expect(dl(r, dlItem(src, "image.png")), src).toBe(true);
    }
    expect(r.states.at(-1).blocked).toMatchObject({ host: "chatgpt.com.evil.example", download: true });
    // No click on the page (a script, a frame, a timer) -> refused.
    expect(dl(r, dlItem("https://chatgpt.com/f", "image.png", false))).toBe(true);
    // The panel's own „Запази изображението като…“ (downloadURL has no gesture) -> allowed, data: pictures too.
    r.wc().fire("context-menu", event(), { mediaType: "image", hasImageContents: true, x: 1, y: 1, srcURL: "data:image/png;base64,iVBOR" });
    r.menus.at(-1).items[1].click();
    const mine = dlItem("data:image/png;base64,iVBOR", "download.png", false);
    expect(dl(r, mine)).toBe(false);
    expect(mine.opts.title).toBe("Запази файла от ChatGPT");
    expect(dl(r, dlItem("data:image/png;base64,iVBOR", "download.png", false))).toBe(true); // only that one click
    for (const ok of ["a.png", "a.JPG", "a.jpeg", "a.webp", "a.gif", "a.pdf", "a.docx", "a.xlsx", "a.pptx", "a.csv", "a.txt", "a.md", "a.json", "a.mp4", "a.mp3", "a.wav"]) expect(downloadAllowed(ok), ok).toBe(true);
    for (const n of ["x.iso", "x.docm", "x.chm", "x.xll", "x.settingcontent-ms"]) expect(APP_RUNNABLE.test(n), n).toBe(true); // the app's own list
    expect(downloadSource("blob:https://sdmntprwestus.oaiusercontent.com/1")).toBe("sdmntprwestus.oaiusercontent.com");
    expect(downloadSource("https://evil-oaiusercontent.com/x")).toBeNull();
    expect(downloadSource("data:image/png;base64,AA", true)).toBe("ChatGPT");
  });

  it("downloads: a type changed in the save dialog is cancelled; a finished one gets the Mark-of-the-Web on Windows", () => {
    const r = rig();
    r.panel.open({});
    const item = dlItem("https://files.oaiusercontent.com/f", "picture.png");
    dl(r, item);
    item.saved = "C:/Users/test/Documents/picture.png";
    item.fire("updated");
    expect(item.cancelled).toBe(false);
    item.fire("done", event(), "completed");
    expect(r.written).toEqual([{ file: "C:/Users/test/Documents/picture.png:Zone.Identifier", text: "[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=https://files.oaiusercontent.com/\r\n" }]);
    const renamed = dlItem("https://files.oaiusercontent.com/f", "picture.png");
    dl(r, renamed);
    renamed.saved = "C:/Users/test/Documents/picture.exe";
    renamed.fire("updated");
    expect(renamed.cancelled).toBe(true);
    renamed.fire("done", event(), "cancelled");
    expect(r.written).toHaveLength(1);
    const blob = dlItem("blob:https://chatgpt.com/1", "a.pdf");
    dl(r, blob);
    blob.saved = "C:/x/a.pdf";
    blob.fire("done", event(), "completed");
    expect(r.written.at(-1).text).toBe("[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=about:internet\r\n");
    // Not on Linux/macOS (no alternate data streams there).
    const lin = rig({ platform: "linux" });
    lin.panel.open({});
    const l = dlItem("https://chatgpt.com/f", "a.png");
    dl(lin, l);
    l.saved = "/home/u/a.png";
    l.fire("done", event(), "completed");
    expect(lin.written).toEqual([]);
  });
});

describe("navigation of the panel's pages", () => {
  it("allowed pages load; another https page goes to the browser only after the employee's click on an allowed page; other schemes go nowhere", () => {
    const r = rig();
    r.panel.open({});
    const wc = r.wc();
    const nav = (url, initiator = TOP) => { const e = event({ url, initiator }); wc.fire("will-navigate", e, url); return e.prevented; };
    expect(nav("https://chatgpt.com/c/1")).toBe(false);
    expect(nav("https://auth.openai.com/log-in")).toBe(false);
    expect(nav("https://accounts.google.com/v3/signin/identifier")).toBe(false);
    // A script / timer of the page with no click (finding: location.href pushed pages into the browser): only the note.
    expect(nav("https://example.org/a?n=1")).toBe(true);
    expect(r.opened).toEqual([]);
    expect(r.states.at(-1).blocked).toEqual({ host: "example.org", external: false, canOpen: true });
    // The employee clicks a link on the page -> the system browser, once per click.
    click(wc);
    expect(nav("https://example.com/article")).toBe(true);
    expect(r.opened).toEqual(["https://example.com/article"]);
    expect(r.states.at(-1).blocked).toEqual({ host: "example.com", external: true, canOpen: false });
    r.tick(EXTERNAL_GAP_MS + 1);
    expect(nav("https://example.org/second")).toBe(true); // the same click again: used up
    expect(r.opened).toHaveLength(1);
    expect(r.states.at(-1).blocked).toEqual({ host: "example.org", external: false, canOpen: true });
    click(wc);
    r.tick(GESTURE_MS + 1);
    expect(nav("https://example.org/late")).toBe(true); // too long after the click
    expect(r.opened).toHaveLength(1);
    // A click, but the navigation comes from a frame of another site (e.g. an embedded widget) or no frame at all.
    click(wc);
    expect(nav("https://example.org/f", { url: "https://thirdparty.example/frame", parent: { url: "https://chatgpt.com/" } })).toBe(true);
    expect(nav("https://example.org/g", { url: "https://thirdparty.example/", parent: null })).toBe(true);
    expect(nav("https://example.org/h", null)).toBe(true);
    expect(nav("https://example.org/i", { get url() { throw new Error("gone"); }, parent: null })).toBe(true);
    expect(r.opened).toHaveLength(1);
    expect(nav("https://example.net/next")).toBe(true); // the click was not used by the frames above …
    expect(r.opened).toEqual(["https://example.com/article", "https://example.net/next"]); // … so the page's own link gets it
    r.tick(EXTERNAL_GAP_MS + 1);
    click(wc);
    for (const u of ["javascript:alert(1)", "file:///C:/x", "http://example.com/", "data:text/html,x", "app://ted/index.html", "https://chatgpt.com@evil.example/"]) {
      expect(nav(u), u).toBe(true);
    }
    expect(r.opened).toHaveLength(2); // an address with a user part is never handed on
    expect(r.states.at(-1).blocked).toEqual({ host: "evil.example", external: false, canOpen: false });
  });

  it("the note: „Отвори в браузъра“ opens the refused address only on that click; it goes away when the employee moves on", async () => {
    const r = rig();
    r.panel.open({});
    const wc = r.wc();
    wc.url = "https://chatgpt.com/c/1";
    const nav = (url) => { const e = event({ url, initiator: TOP }); wc.fire("will-navigate", e, url); return e.prevented; };
    expect(await r.panel.openInBrowser({ blocked: true })).toMatchObject({ ok: false, code: "none" });
    nav("https://example.org/billing");
    expect(r.opened).toEqual([]);
    expect(r.states.at(-1).blocked).toEqual({ host: "example.org", external: false, canOpen: true });
    expect(JSON.stringify(r.states)).not.toContain("billing"); // the address itself never goes to the renderer
    expect(await r.panel.openInBrowser({ blocked: true })).toEqual({ ok: true });
    expect(r.opened).toEqual(["https://example.org/billing"]);
    expect(r.states.at(-1).blocked).toEqual({ host: "example.org", external: true, canOpen: false });
    expect(await r.panel.openInBrowser({ blocked: true })).toMatchObject({ ok: false, code: "none" }); // once
    // Finding: the note never cleared – now the next page or conversation in ChatGPT clears it (not a #hash or the same page).
    wc.fire("did-navigate-in-page", event(), "https://chatgpt.com/c/1#x", true);
    expect(r.states.at(-1).blocked).not.toBeNull();
    wc.fire("did-navigate-in-page", event(), "https://chatgpt.com/c/2", false); // a frame
    expect(r.states.at(-1).blocked).not.toBeNull();
    wc.fire("did-navigate-in-page", event(), "https://chatgpt.com/c/2", true);
    expect(r.states.at(-1).blocked).toBeNull();
    nav("https://example.org/x");
    expect(r.states.at(-1).blocked).not.toBeNull();
    wc.fire("did-navigate", event(), "https://chatgpt.com/c/3");
    expect(r.states.at(-1).blocked).toBeNull();
    expect(await r.panel.openInBrowser({ blocked: true })).toMatchObject({ ok: false, code: "none" });
    nav("https://example.org/y");
    r.panel.reload();
    expect(r.states.at(-1).blocked).toBeNull();
    nav("https://example.org/z");
    r.panel.close();
    expect(await r.panel.openInBrowser({ blocked: true })).toMatchObject({ ok: false, code: "none" });
  });

  it("redirects: the main frame only to allowed pages (never opened outside by itself); frames to https/about/blob/data", () => {
    const r = rig();
    r.panel.open({});
    const wc = r.wc();
    const red = (url, isMainFrame) => { const e = event({ url, isMainFrame }); wc.fire("will-redirect", e, url, false, isMainFrame); return e.prevented; };
    expect(red("https://accounts.google.com/signin", true)).toBe(false);
    click(wc);
    expect(red("https://evil.example/phish", true)).toBe(true);
    expect(r.opened).toEqual([]);
    expect(r.states.at(-1).blocked).toEqual({ host: "evil.example", external: false, canOpen: true });
    expect(red("https://challenges.cloudflare.com/x", false)).toBe(false);
    expect(red("file:///C:/x", false)).toBe(true);
    const frame = (url, isMainFrame) => { const e = event({ url, isMainFrame }); wc.fire("will-frame-navigate", e); return e.prevented; };
    expect(frame("https://js.stripe.com/v3/", false)).toBe(false);
    expect(frame("http://example.com/", false)).toBe(true);
    expect(frame("chrome://settings", false)).toBe(true);
    expect(frame("https://evil.example/", true)).toBe(false); // the main frame is will-navigate's
    const wv = event();
    wc.fire("will-attach-webview", wv);
    expect(wv.prevented).toBe(true);
  });

  it("pop-ups: sign-in windows of a FIXED shape (the page's features ignored), at most two, closed with the panel", () => {
    const r = rig();
    r.panel.open({});
    const wc = r.wc();
    const g = r.popup(wc, { url: "https://accounts.google.com/gsi/select?client_id=x", features: "frame=no,transparent=yes,alwaysOnTop=yes,x=0,y=0", referrer: { url: "https://chatgpt.com/", policy: "strict-origin-when-cross-origin" } });
    expect(g.res.action).toBe("allow");
    expect(g.res.overrideBrowserWindowOptions.webPreferences).not.toHaveProperty("preload");
    expect(g.res.overrideBrowserWindowOptions.webPreferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false, devTools: false });
    const o = g.win.options;
    expect(o.webContents).toBe(g.guest);
    expect(o).toMatchObject({ parent: r.win, width: 520, height: 720, frame: true, transparent: false, alwaysOnTop: false, skipTaskbar: false, closable: true, movable: true, focusable: true, opacity: 1, kiosk: false, fullscreen: false, show: true });
    expect(o).not.toHaveProperty("x");
    expect(o).not.toHaveProperty("y");
    expect(o.webPreferences).not.toHaveProperty("preload");
    expect(childShape({}).frame).toBe(true);
    expect(r.panel.children()).toEqual([g.win]);
    // A second one is fine, a third is refused (finding: 15 windows in a row).
    const b = r.popup(wc, { url: "about:blank", features: "" });
    expect(b.res.action).toBe("allow");
    expect(r.popup(wc, { url: "about:blank" }).res).toEqual({ action: "deny" });
    expect(r.panel.children()).toHaveLength(MAX_CHILDREN);
    b.win.destroy();
    expect(r.panel.children()).toHaveLength(1);
    // × closes the sign-in windows too (they no longer outlive the panel).
    r.panel.close();
    expect(g.win.destroyed).toBe(true);
    expect(r.panel.children()).toEqual([]);
    // A closed panel's page opens nothing.
    expect(r.popup(wc, { url: "https://accounts.google.com/x" }).res).toEqual({ action: "deny" });
    // Without an injected BrowserWindow (fixed shape impossible) nothing opens.
    const nb = rig({ withBrowserWindow: false });
    nb.panel.open({});
    expect(nb.wc().openHandler({ url: "https://accounts.google.com/x" })).toEqual({ action: "deny" });
  });

  it("a blank pop-up stays invisible until it reaches an allowed page; sent elsewhere or left blank it is destroyed", () => {
    const r = rig();
    r.panel.open({});
    const wc = r.wc();
    // document.write into a blank window (finding: a fake „Тед“ login over everything) – it is never shown.
    const a = r.popup(wc, { url: "about:blank", features: "alwaysOnTop=yes" });
    expect(a.win.options.show).toBe(false);
    expect(a.win.visible).toBe(false);
    a.guest.fire("did-navigate", event(), "about:blank");
    expect(a.win.visible).toBe(false);
    a.guest.fire("did-navigate", event(), "https://accounts.google.com/o/oauth2/v2/auth?x=1");
    expect(a.win.visible).toBe(true);
    // The bubble hides it with the panel, the normal window brings it back.
    r.panel.setWindowMode("bubble");
    expect(a.win.visible).toBe(false);
    r.panel.setWindowMode("normal");
    expect(a.win.visible).toBe(true);
    a.win.destroy();
    // Finding: window.open("") then w.location = "https://example.org/billing" left an empty „Вход – ChatGPT“ window.
    const b = r.popup(wc, { url: "" });
    const e = event({ url: "https://example.org/billing", initiator: TOP });
    b.guest.fire("will-navigate", e, e.url);
    expect(e.prevented).toBe(true);
    expect(b.win.destroyed).toBe(true);
    expect(r.panel.children()).toEqual([]);
    expect(r.states.at(-1).blocked).toEqual({ host: "example.org", external: false, canOpen: true }); // no click: the note
    // With the employee's click it goes to the browser (and the blank window still goes away).
    const c = r.popup(wc, { url: "" });
    click(wc);
    const e2 = event({ url: "https://example.org/billing", initiator: TOP });
    c.guest.fire("will-navigate", e2, e2.url);
    expect(c.win.destroyed).toBe(true);
    expect(r.opened).toEqual(["https://example.org/billing"]);
    // A sign-in window that already shows its provider stays when one of its links is refused.
    const d = r.popup(wc, { url: "https://accounts.google.com/x" });
    const e3 = event({ url: "https://example.org/help", initiator: { url: "https://accounts.google.com/x", parent: null } });
    d.guest.fire("will-navigate", e3, e3.url);
    expect(e3.prevented).toBe(true);
    expect(d.win.destroyed).toBe(false);
    // Left blank: destroyed after BLANK_CHILD_MS.
    const f = r.popup(wc, { url: "about:blank" });
    const t = r.timers.at(-1);
    expect(t.ms).toBe(BLANK_CHILD_MS);
    t.fn();
    expect(f.win.destroyed).toBe(true);
    expect(d.win.destroyed).toBe(false);
    // The CRM user changes: every sign-in window goes.
    r.panel.detach();
    expect(d.win.destroyed).toBe(true);
  });

  it("other pop-ups: an https page like a link (click + an allowed opener), a form never re-sent, the rest nowhere", () => {
    const r = rig();
    r.panel.open({});
    const wc = r.wc();
    const op = (url, ref = "https://chatgpt.com/", extra = {}) => wc.openHandler({ url, referrer: { url: ref, policy: "strict-origin-when-cross-origin" }, ...extra });
    // No click (finding: window.open by a script or a timer reached the browser).
    expect(op("https://example.com/x")).toEqual({ action: "deny" });
    expect(r.opened).toEqual([]);
    expect(r.states.at(-1).blocked).toEqual({ host: "example.com", external: false, canOpen: true });
    // A click on a link of the page (target=_blank) -> the browser.
    click(wc);
    expect(op("https://example.com/x")).toEqual({ action: "deny" });
    expect(r.opened).toEqual(["https://example.com/x"]);
    r.tick(EXTERNAL_GAP_MS + 1);
    // A frame of another site (finding: a third-party iframe's timed window.open), or a noreferrer pop-up: the note only.
    click(wc);
    expect(op("https://example.org/from-frame", "https://thirdparty.example/")).toEqual({ action: "deny" });
    expect(op("https://example.org/noref", "")).toEqual({ action: "deny" });
    expect(op("https://example.org/nodetails", undefined, { referrer: null })).toEqual({ action: "deny" });
    // A form (POST) into a pop-up is not re-sent as a plain address.
    expect(op("https://example.org/post", "https://chatgpt.com/", { postBody: { data: [] } })).toEqual({ action: "deny" });
    expect(r.states.at(-1).blocked).toEqual({ host: "example.org", external: false, canOpen: false });
    expect(r.opened).toHaveLength(1);
    expect(op("https://example.net/later")).toEqual({ action: "deny" }); // the click was still unused
    expect(r.opened).toEqual(["https://example.com/x", "https://example.net/later"]);
    for (const u of ["javascript:alert(1)", "file:///C:/x", "http://example.com/", "data:text/html,x", "mailto:a@b.bg"]) {
      expect(op(u), u).toEqual({ action: "deny" });
    }
    expect(r.opened).toHaveLength(2);
  });

  it("the page's right-click menu: copy a picture, save it, edit text, links to the browser", () => {
    const r = rig();
    r.panel.open({});
    const wc = r.wc();
    wc.fire("context-menu", event(), { mediaType: "image", hasImageContents: true, x: 120, y: 340, srcURL: "https://files.oaiusercontent.com/x.png" });
    const m = r.menus.at(-1);
    expect(m.items.map((i) => i.label)).toEqual(["Копирай изображението", "Запази изображението като…"]);
    expect(m.opts.window).toBe(r.win);
    m.items[0].click();
    expect(wc.copied).toEqual([[120, 340]]);
    m.items[1].click();
    expect(wc.downloads).toEqual(["https://files.oaiusercontent.com/x.png"]);
    wc.fire("context-menu", event(), { isEditable: true, editFlags: { canCut: true, canCopy: true, canPaste: true } });
    const e = r.menus.at(-1);
    expect(e.items.map((i) => i.label)).toEqual(["Изрежи", "Копирай", "Постави", "Избери всичко"]);
    e.items.forEach((i) => i.click());
    expect(wc.edits).toEqual(["cut", "copy", "paste", "selectAll"]);
    wc.fire("context-menu", event(), { linkURL: "https://example.com/source", selectionText: "текст" });
    const l = r.menus.at(-1);
    expect(l.items.map((i) => i.label || i.type)).toEqual(["Копирай", "separator", "Отвори връзката в браузъра", "Копирай адреса на връзката"]);
    l.items[2].click();
    l.items[3].click();
    expect(r.opened).toEqual(["https://example.com/source"]);
    expect(r.clip.text).toEqual(["https://example.com/source"]);
    const before = r.menus.length;
    wc.fire("context-menu", event(), { linkURL: "javascript:alert(1)" });
    expect(r.menus).toHaveLength(before); // nothing to offer: no menu
  });

  it("Ctrl+Shift+B inside the page puts Ted into the bubble", () => {
    const r = rig();
    r.panel.open({});
    const e = event();
    r.wc().fire("before-input-event", e, { type: "keyDown", control: true, shift: true, alt: false, code: "KeyB", key: "B" });
    expect(e.prevented).toBe(true);
    expect(r.shortcuts).toEqual(["bubble"]);
    const other = event();
    r.wc().fire("before-input-event", other, { type: "keyDown", control: true, shift: false, code: "KeyB", key: "b" });
    expect(other.prevented).toBe(false);
  });
});

describe("open, bounds, window modes, close", () => {
  it("open: only an allowed address, only with a CRM user; ?q= through the blank page, the rest directly; reopening keeps the page", () => {
    const r = rig({ owner: null });
    expect(r.panel.open({})).toMatchObject({ ok: false, code: "signed_out" });
    r.setOwner("crm-user-1");
    expect(r.panel.open({ url: "https://evil.example/" })).toMatchObject({ ok: false, code: "invalid" });
    expect(r.panel.open({ url: "javascript:alert(1)" })).toMatchObject({ ok: false, code: "invalid" });
    expect(r.views).toHaveLength(0);
    const q = chatgptUrl("фасада на къща вечер");
    expect(r.panel.open({ url: q })).toEqual({ ok: true });
    expect(r.wc().loads).toEqual([bootstrapUrl(q)]);
    expect(r.win.contentView.children).toEqual([r.view()]);
    expect(r.view().visible).toBe(false); // until the renderer reports where the placeholder is
    expect(r.panel.open({})).toEqual({ ok: true });
    expect(r.wc().loads).toHaveLength(1); // as it was
    expect(r.panel.open({ url: "https://chatgpt.com/" })).toEqual({ ok: true });
    expect(r.wc().loads.at(-1)).toBe("https://chatgpt.com/");
    expect(r.views).toHaveLength(1);
  });

  it("bounds: the placeholder's rectangle (× zoom), never over the title bar; hidden while covered, too small, closed, or in the bubble / mini chat", () => {
    const r = rig({ zoom: 1.25 });
    r.panel.open({});
    expect(r.panel.setBounds({ x: 820, y: 163, width: 546, height: 605, visible: true })).toEqual({ ok: true });
    expect(r.view().visible).toBe(true);
    expect(r.view().bounds).toEqual({ x: 1025, y: 204, width: 683, height: 756 });
    expect(r.states.at(-1)).toMatchObject({ open: true, visible: true });
    r.panel.setBounds({ x: 0, y: 0, width: 400, height: 860, visible: true });
    expect(r.view().bounds.y).toBe(Math.round(TITLE_BAR * 1.25));
    expect(r.view().bounds.height).toBe(Math.round((860 - TITLE_BAR) * 1.25));
    r.panel.setBounds({ x: 820, y: 163, width: 546, height: 605, visible: false }); // a dialog covers it
    expect(r.view().visible).toBe(false);
    r.panel.setBounds({ x: 820, y: 163, width: 39, height: 605, visible: true });
    expect(r.view().visible).toBe(false);
    r.panel.setBounds({ x: 820, y: 163, width: 546, height: 605, visible: true });
    expect(r.view().visible).toBe(true);
    r.panel.setWindowMode("bubble");
    expect(r.view().visible).toBe(false);
    r.panel.setWindowMode("mini");
    r.panel.setBounds({ x: 0, y: 90, width: 400, height: 500, visible: true });
    expect(r.view().visible).toBe(false);
    r.panel.setWindowMode("normal");
    expect(r.view().visible).toBe(true);
    for (const bad of [null, [], "x", { x: 1, y: 2, width: 3, height: 4 }, { x: "1", y: 2, width: 300, height: 400, visible: true }, { x: NaN, y: 2, width: 300, height: 400, visible: true }, { x: 1, y: 2, width: Infinity, height: 400, visible: true }, { x: 1, y: 2, width: 300, height: 400, visible: "yes" }]) {
      expect(r.panel.setBounds(bad), JSON.stringify(bad)).toEqual({ ok: false, code: "invalid" });
    }
    expect(cleanBounds({ x: -50, y: 99999, width: 1e9, height: 3.6, visible: true })).toEqual({ x: 0, y: 20000, width: 20000, height: 4, visible: true });
    expect(r.panel.close()).toEqual({ ok: true });
    expect(r.view().visible).toBe(false);
    expect(r.win.contentView.children).toEqual([]);
    r.panel.setBounds({ x: 820, y: 163, width: 546, height: 605, visible: true });
    expect(r.view().visible).toBe(false); // closed stays closed
    expect(r.states.at(-1)).toMatchObject({ open: false, visible: false });
    expect(r.panel.reload()).toEqual({ ok: false, code: "closed" });
  });

  it("a CRM sign-in/sign-out: this employee's page leaves the window; the next employee gets his own partition", () => {
    const r = rig();
    r.panel.open({});
    const first = r.view();
    r.panel.setBounds({ x: 820, y: 163, width: 546, height: 605, visible: true });
    r.panel.detach();
    expect(first.webContents.closed).toBe(true);
    expect(r.win.contentView.children).toEqual([]);
    expect(r.states.at(-1)).toMatchObject({ open: false, visible: false, host: null });
    r.setOwner("crm-user-2");
    r.panel.open({});
    expect(r.view()).not.toBe(first);
    expect(r.view().options.webPreferences.session.name).toBe(panelPartition("crm-user-2"));
    // The owner changed without a detach (defence in depth): a new view in the new partition.
    r.setOwner("crm-user-3");
    const before = r.view();
    r.panel.open({});
    expect(before.webContents.closed).toBe(true);
    expect(r.view().options.webPreferences.session.name).toBe(panelPartition("crm-user-3"));
  });

  it("state: loading, host, load errors and a crashed page (↻ loads chatgpt.com again)", () => {
    const r = rig();
    r.panel.open({});
    r.panel.setBounds({ x: 820, y: 163, width: 546, height: 605, visible: true });
    const wc = r.wc();
    wc.fire("did-start-loading");
    expect(r.states.at(-1).loading).toBe(true);
    wc.fire("did-navigate", event(), "https://accounts.google.com/v3/signin");
    expect(r.states.at(-1).host).toBe("accounts.google.com");
    wc.fire("did-navigate-in-page", event(), "https://chatgpt.com/c/1", true);
    expect(r.states.at(-1).host).toBe("chatgpt.com");
    wc.fire("did-stop-loading");
    expect(r.states.at(-1).loading).toBe(false);
    wc.fire("did-fail-load", event(), -3, "ERR_ABORTED", "https://evil.example/", true);
    expect(r.states.at(-1).error).toBeNull();
    wc.fire("did-fail-load", event(), -105, "ERR_NAME_NOT_RESOLVED", "https://chatgpt.com/", true);
    expect(r.states.at(-1).error).toMatch(/ChatGPT не се зареди \(ERR_NAME_NOT_RESOLVED\)/);
    wc.fire("render-process-gone", event(), { reason: "crashed" });
    expect(r.states.at(-1).error).toMatch(/спря/);
    expect(r.panel.reload()).toEqual({ ok: true });
    expect(wc.loads.at(-1)).toBe("https://chatgpt.com/");
    expect(r.panel.reload()).toEqual({ ok: true });
    expect(wc.loads.at(-1)).toBe("reload");
    for (const s of r.states) expect(Object.keys(s).sort()).toEqual(["blocked", "error", "host", "loading", "open", "visible"]);
  });

  it("„Отвори в браузъра“: the same chatgpt.com page without a prompt parameter; a sign-in page -> chatgpt.com", async () => {
    const r = rig();
    expect(await r.panel.openInBrowser()).toEqual({ ok: true });
    expect(r.opened.at(-1)).toBe("https://chatgpt.com/");
    r.panel.open({});
    r.wc().url = "https://chatgpt.com/c/68f1?q=" + encodeURIComponent("тайна заявка") + "&model=x#frag";
    await r.panel.openInBrowser();
    expect(r.opened.at(-1)).toBe("https://chatgpt.com/c/68f1?model=x");
    r.wc().url = "https://auth.openai.com/log-in?state=abc";
    await r.panel.openInBrowser();
    expect(r.opened.at(-1)).toBe("https://chatgpt.com/");
    r.wc().url = bootstrapUrl("https://chatgpt.com/?q=x");
    await r.panel.openInBrowser();
    expect(r.opened.at(-1)).toBe("https://chatgpt.com/");
  });
});

describe("owns() – which web contents get the panel's rules", () => {
  it("decides by the session: the panel's partition (also another wrapper of it), never the app's", () => {
    const r = rig();
    r.panel.open({});
    const ses = r.sessions[panelPartition("crm-user-1")];
    expect(r.panel.owns({ session: ses })).toBe(true);
    expect(r.panel.owns({ session: { storagePath: ses.storagePath } })).toBe(true);
    expect(r.panel.owns({ session: { storagePath: "/profile" } })).toBe(false);
    expect(r.panel.owns({ session: { storagePath: null } })).toBe(false);
    expect(r.panel.owns({})).toBe(false);
    expect(r.panel.owns(null)).toBe(false);
    expect(r.panel.owns({ get session() { throw new Error("gone"); } })).toBe(false);
  });

  it("security.js: panel contents get the panel's rules instead of the app's; a failing delegate leaves the app's", () => {
    const appEvents = {};
    const app = { on: (ev, fn) => { appEvents[ev] = fn; } };
    const defaultSession = { on() {}, setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDevicePermissionHandler() {}, setSpellCheckerLanguages() {}, setSpellCheckerEnabled() {} };
    const hardened = [];
    const mine = { session: "panel" };
    const delegate = { owns: (c) => c.session === "panel" || (c.session === "boom" ? (() => { throw new Error("x"); })() : false), harden: (c) => { if (c.failHarden) throw new Error("x"); hardened.push(c); } };
    installSecurity({ app, session: defaultSession, shell: { openExternal: async () => {} }, log: { warn() {}, error() {} }, devOrigin: null, delegate });
    const contents = (extra) => emitter({ setWindowOpenHandler(fn) { this.openHandler = fn; }, ...extra });
    const panelC = contents(mine);
    appEvents["web-contents-created"]({}, panelC);
    expect(hardened).toEqual([panelC]);
    expect(panelC.handlers["will-navigate"]).toBeUndefined(); // the app's guard (app://ted only) is not on it
    const appC = contents({ session: "default" });
    appEvents["web-contents-created"]({}, appC);
    expect(appC.handlers["will-navigate"]).toHaveLength(1);
    const e = event({ url: "https://chatgpt.com/" });
    appC.fire("will-navigate", e, "https://chatgpt.com/");
    expect(e.prevented).toBe(true); // the main window can never navigate to chatgpt.com
    for (const odd of [contents({ session: "boom" }), contents({ session: "panel", failHarden: true })]) {
      appEvents["web-contents-created"]({}, odd);
      expect(odd.handlers["will-navigate"]).toHaveLength(1);
      expect(typeof odd.openHandler).toBe("function");
    }
  });
});

describe("„📋 Добави снимката в чата“ – the clipboard in MAIN", () => {
  // Electron 45: clipboard.read() -> ClipboardItem[] {types, getType(type) -> Blob}.
  const item = (types, bytes) => ({ types, getType: async (t) => { if (!types.includes(t)) throw new Error("NotFound"); return new Blob([bytes]); } });
  const pngBytes = (w, h, extra = 0) => { const b = Buffer.alloc(33 + extra); b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4); b.writeUInt32BE(13, 8); b.write("IHDR", 12, "latin1"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  const clip45 = (items) => ({ read: async () => items });
  const decoder = (sizes) => ({ createFromBuffer: (buf) => { const s = sizes(buf); return { isEmpty: () => !s, getSize: () => s, toPNG: () => pngBytes(s.width, s.height, 100) }; } });

  it("Electron 45: the first image/png entry; JPEG/WEBP turned into PNG; text only = empty", async () => {
    const shot = pngBytes(1024, 768, 2000);
    const r = await readClipboardImage(clip45([item(["text/html", "image/png"], shot)]), null, new Date(2026, 10, 18, 9, 5));
    expect(r).toMatchObject({ ok: true, name: "Снимка от ChatGPT 2026-11-18 09.05.png", mime: "image/png", size: shot.length, width: 1024, height: 768 });
    expect(r.data).toBeInstanceOf(ArrayBuffer);
    expect(Buffer.from(r.data).equals(shot)).toBe(true);
    const jpg = await readClipboardImage(clip45([item(["image/jpeg"], Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]))]), decoder(() => ({ width: 640, height: 400 })));
    expect(jpg).toMatchObject({ ok: true, mime: "image/png", width: 640, height: 400 });
    expect(await readClipboardImage(clip45([item(["image/webp"], Buffer.from([1, 2, 3]))]), decoder(() => null))).toMatchObject({ ok: false, code: "empty" });
    expect(await readClipboardImage(clip45([item(["text/plain"], Buffer.from("текст"))]))).toMatchObject({ ok: false, code: "empty" });
    expect(await readClipboardImage(clip45([]))).toMatchObject({ ok: false, code: "empty" });
    expect(await readClipboardImage({ read: async () => { throw new Error("busy"); } })).toMatchObject({ ok: false, code: "empty" });
    expect(await readClipboardImage(clip45([item(["image/png"], Buffer.alloc(0))]))).toMatchObject({ ok: false, code: "empty" });
    expect(await readClipboardImage(clip45([item(["image/png"], Buffer.from("not a png at all"))]))).toMatchObject({ ok: false, code: "empty" });
  });

  it("Electron 45: over 8 MB as PNG or over 50 megapixels -> too_large", async () => {
    expect(await readClipboardImage(clip45([item(["image/png"], pngBytes(2000, 2000, CLIPBOARD_MAX))])))
      .toMatchObject({ ok: false, code: "too_large" });
    expect(await readClipboardImage(clip45([item(["image/png"], pngBytes(10000, 6000))]))).toMatchObject({ ok: false, code: "too_large" });
    expect(await readClipboardImage(clip45([item(["image/png"], pngBytes(100, 100, CLIPBOARD_MAX - 40))]))).toMatchObject({ ok: true });
  });

  const img = (w, h, bytes) => ({ isEmpty: () => w === 0, getSize: () => ({ width: w, height: h }), toPNG: () => Buffer.alloc(bytes, 7) });
  it("older Electron (clipboard.readImage): the same limits", async () => {
    expect(await readClipboardImage({ readImage: () => null })).toMatchObject({ ok: false, code: "empty" });
    expect(await readClipboardImage({ readImage: () => img(0, 0, 0) })).toMatchObject({ ok: false, code: "empty" });
    expect(await readClipboardImage({ readImage: () => { throw new Error("busy"); } })).toMatchObject({ ok: false, code: "empty" });
    expect(await readClipboardImage({ readImage: () => img(10, 10, 0) })).toMatchObject({ ok: false, code: "empty" });
    expect(await readClipboardImage({ readImage: () => img(800, 600, CLIPBOARD_MAX + 1) })).toMatchObject({ ok: false, code: "too_large" });
    expect(await readClipboardImage({ readImage: () => img(10000, 6000, 100) })).toMatchObject({ ok: false, code: "too_large" });
    const r = await readClipboardImage({ readImage: () => img(1024, 1024, 5000) }, null, new Date(2026, 10, 18, 9, 5));
    expect(r).toMatchObject({ ok: true, size: 5000, width: 1024, height: 1024 });
    expect(new Uint8Array(r.data)[0]).toBe(7);
    expect(await readClipboardImage(null)).toMatchObject({ ok: false, code: "empty" });
  });

  it("the controller reads it only when asked (the click)", async () => {
    const r = rig();
    let reads = 0;
    const panel = r.panel;
    expect(await panel.clipboardImage()).toMatchObject({ ok: false, code: "empty" });
    r.clip.image = { isEmpty: () => { reads++; return false; }, getSize: () => ({ width: 10, height: 10 }), toPNG: () => Buffer.from([1, 2, 3]) };
    expect(reads).toBe(0);
    expect(await panel.clipboardImage()).toMatchObject({ ok: true, size: 3 });
    expect(reads).toBe(1);
  });
});
