// „Чатове“ (0.1.9, docs/CONTRACT.md §24): the agency's real Messenger (Meta Business Suite inbox of the page),
// Instagram Direct and WhatsApp Web inside Ted, in a rounded card next to the chat – the same native view as the
// ChatGPT panel (§23), with the same hardening:
//   - one persistent session partition per site AND per CRM user (the employee signs in once; another employee on the
//     same computer never sees it), no preload, contextIsolation, sandbox, no Node, no <webview>, a normal Chrome agent;
//   - top-level pages only on the site's own domains (and their subdomains); frames may load https (pictures, players);
//     every other https page goes to the system browser only after the employee's own click, else a note;
//   - pop-ups of the site's own domains (sign-in, a call window) as small child windows of a fixed shape, at most two;
//   - permissions: the site's own notifications (so Windows/macOS shows „new message“ like in Chrome), the copy button,
//     and the microphone for voice messages – nothing else (no camera, no location, no devices);
//   - downloads (pictures, documents, voice and video of a conversation) only from the site's domains, after the
//     employee's click, through the save dialog, Mark-of-the-Web on Windows.
// Ted never reads or scrapes the pages. The only thing MAIN looks at is the page TITLE the site itself sets for its
// browser tab („(3) WhatsApp“): its number is the badge on the round buttons. The views stay loaded in the background
// after the card is closed, so the number keeps coming; a CRM sign-out destroys them.
//
// Pure helpers + a controller with every Electron object injected (no electron import), unit-tested with fakes
// (tests/unit/social-panel.test.js).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { acceptLanguages, cleanBounds, clientHints, externalHttps, frameUrlAllowed, MIN_SIDE, panelWebPreferences, TITLE_BAR, withClientHints } from "./chatgpt-panel.js";
import { MOTW, RUNNABLE as APP_RUNNABLE } from "./files.js";

export const SOCIAL_PAGE_ID = "1447196405137713"; // the Facebook page „Недвижими Имоти • Надежда •“
export const SOCIAL_SITES = {
  messenger: { label: "Messenger", home: "https://business.facebook.com/latest/inbox/all/", domains: ["facebook.com", "messenger.com", "fb.com"] },
  instagram: { label: "Instagram", home: "https://www.instagram.com/direct/inbox/", domains: ["instagram.com", "facebook.com"] },
  whatsapp: { label: "WhatsApp", home: "https://web.whatsapp.com/", domains: ["whatsapp.com"] },
};
export const SOCIAL_KEYS = Object.keys(SOCIAL_SITES);
export const SOCIAL_PARTITION_PREFIX = "persist:social-";
export const SOCIAL_PERMISSIONS = ["notifications", "clipboard-sanitized-write"]; // + the microphone (audio only)
export const SOCIAL_DOWNLOAD_DOMAINS = ["facebook.com", "fbcdn.net", "fbsbx.com", "messenger.com", "instagram.com", "cdninstagram.com", "whatsapp.com", "whatsapp.net"];
export const SOCIAL_DOWNLOADABLE = /\.(png|jpe?g|webp|gif|heic|pdf|docx?|xlsx?|pptx?|csv|txt|zip|mp3|m4a|ogg|opus|wav|mp4|mov|webm)$/i;
export const SOCIAL_RADIUS = 18; // the rounded card: the native view's own corners
export const SOCIAL_GESTURE_MS = 2000;
export const SOCIAL_MAX_CHILDREN = 2;
export const SOCIAL_EXTERNAL_GAP_MS = 1500;
const RUNNABLE = /\.(exe|com|bat|cmd|scr|pif|cpl|msi|msp|mst|dll|sys|lnk|url|hta|js|jse|mjs|vbs|vbe|wsf|wsh|ps1|psm1|psd1|reg|inf|jar|appref-ms|application|gadget|scf|msc|msix|appx|dmg|pkg|app|command|sh)$/i;
const ACTIVATING = new Set(["mouseDown", "mouseUp", "rawKeyDown", "keyDown", "gestureTap", "touchStart", "touchEnd"]);
const URL_MAX = 32768;
const str = (v) => (typeof v === "string" ? v : "");
const onDomain = (host, domains) => { const h = str(host).toLowerCase(); return !!h && h.length <= 253 && domains.some((d) => h === d || h.endsWith("." + d)); };

export const siteOf = (key) => (Object.prototype.hasOwnProperty.call(SOCIAL_SITES, key) ? SOCIAL_SITES[key] : null);

export function socialPartition(site, ownerId) {
  return SOCIAL_PARTITION_PREFIX + site + "-" + crypto.createHash("sha256").update(String(ownerId)).digest("hex").slice(0, 16);
}

// A page the site's card may show at top level -> the parsed URL, else null (https, no user/password, no port).
export function sitePageUrl(site, value) {
  const s = siteOf(site);
  if (!s || typeof value !== "string" || !value || value.length > URL_MAX) return null;
  let u;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port !== "") return null;
  return onDomain(u.hostname, s.domains) ? u : null;
}

// The number the site puts in front of its tab title: „(3) WhatsApp“, „(12) Instagram“ -> 3 / 12, else 0.
export function unreadFromTitle(title) {
  const m = /^\s*\((\d{1,4})\+?\)/.exec(str(title));
  return m ? Math.min(Number(m[1]), 9999) : 0;
}

export function socialDownloadSource(value) {
  if (typeof value !== "string" || !value || value.length > URL_MAX * 64) return null;
  let u;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol === "blob:") { try { u = new URL(u.pathname); } catch { return null; } }
  if (u.protocol !== "https:" || u.username || u.password || u.port !== "") return null;
  return onDomain(u.hostname, SOCIAL_DOWNLOAD_DOMAINS) ? u.hostname : null;
}
export const socialDownloadAllowed = (name) => SOCIAL_DOWNLOADABLE.test(str(name)) && !RUNNABLE.test(str(name)) && !APP_RUNNABLE.test(str(name));

export function socialPermission(site, permission, origin, details) {
  if (!sitePageUrl(site, str(origin))) return false;
  if (SOCIAL_PERMISSIONS.includes(permission)) return true;
  if (permission === "media") {
    const d = details || {};
    const types = Array.isArray(d.mediaTypes) ? d.mediaTypes : d.mediaType ? [d.mediaType] : [];
    return types.length > 0 && types.every((t) => t === "audio");
  }
  return false;
}

const hostOf = (value) => { try { const u = new URL(str(value)); return u.protocol === "https:" ? u.hostname : null; } catch { return null; } };
const extOf = (name) => { const m = /\.([A-Za-z0-9-]{1,20})$/.exec(str(name)); return m ? m[1].toLowerCase() : ""; };
const safeName = (value) => str(value).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 120) || "file";

export function createSocialPanel({
  WebContentsView, BrowserWindow = null, fromPartition, getWindow, windowFor, Menu = null, clipboard = null, openExternal, owner, userAgent,
  locale = "en-US", platform = process.platform, packaged = true, documentsDir = () => "", emit = () => {}, log = null, onShortcut = null,
  onUnread = null, now = Date.now, writeFile = (file, text) => fs.writeFileSync(file, text),
}) {
  const views = new Map();   // site -> {site, view, wc, partition, attached, loaded, crashed, unread, children:Set}
  const sessions = new Map(); // session -> site
  const configured = new WeakSet();
  const hardened = new WeakSet();
  const hints = clientHints(userAgent, platform);
  let active = null;          // the site shown in the card
  let open = false;
  let mode = "normal";
  let want = null;
  let made = 0;
  let lastInput = -Infinity;
  let inputUsed = true;
  let lastExternal = 0;
  let pending = null;
  const st = { visible: false, loading: false, error: null, blocked: null };
  const warn = (event, fields) => { if (log) log.warn(event, fields); };
  const gone = (c) => !c || !c.wc || (typeof c.wc.isDestroyed === "function" && c.wc.isDestroyed());
  const unread = () => Object.fromEntries(SOCIAL_KEYS.map((k) => [k, views.has(k) ? views.get(k).unread || 0 : 0]));
  const state = () => ({ open, site: active, visible: st.visible, loading: st.loading, error: st.error, blocked: st.blocked, unread: unread(), signedIn: SOCIAL_KEYS.filter((k) => views.has(k)) });
  const push = () => { try { emit(state()); } catch { /* the window is gone */ } };

  function pathOf(s) { try { return typeof s.getStoragePath === "function" ? s.getStoragePath() : s.storagePath || null; } catch { return null; } }
  function siteOfContents(contents) {
    let s = null;
    try { s = contents && contents.session; } catch { s = null; }
    if (!s) return null;
    if (sessions.has(s)) return sessions.get(s);
    const a = pathOf(s);
    if (a) for (const [p, site] of sessions) if (pathOf(p) === a) return site;
    return null;
  }
  const owns = (contents) => !!siteOfContents(contents);

  function toBrowser(url) {
    const href = externalHttps(url);
    if (!href) return false;
    const t = now();
    if (t - lastExternal < SOCIAL_EXTERNAL_GAP_MS) return false;
    lastExternal = t;
    Promise.resolve(openExternal(href)).catch(() => {});
    return true;
  }
  function takeGesture() {
    if (inputUsed || now() - lastInput > SOCIAL_GESTURE_MS) return false;
    inputUsed = true;
    return true;
  }
  function refused(site, url, { user = false, canOpen = true } = {}) {
    const host = hostOf(url);
    warn("social_panel.blocked", { site, host: host || String(url).split(":")[0].slice(0, 20), user: !!user });
    const href = canOpen ? externalHttps(url) : null;
    const sent = user && href ? toBrowser(href) : false;
    pending = href && !sent ? href : null;
    if (site === active) { st.blocked = host ? { host, external: sent, canOpen: !!pending } : null; push(); }
  }

  function contextMenu(contents, p) {
    const q = p || {};
    const groups = [];
    if (q.isEditable) {
      const f = q.editFlags || {};
      groups.push([
        { label: "Изрежи", enabled: f.canCut !== false, click: () => contents.cut() },
        { label: "Копирай", enabled: f.canCopy !== false, click: () => contents.copy() },
        { label: "Постави", enabled: f.canPaste !== false, click: () => contents.paste() },
        { label: "Избери всичко", click: () => contents.selectAll() },
      ]);
    } else if (str(q.selectionText).trim()) groups.push([{ label: "Копирай", click: () => contents.copy() }]);
    if (q.mediaType === "image" && q.hasImageContents !== false) groups.push([{ label: "Копирай изображението", click: () => { try { contents.copyImageAt(q.x, q.y); } catch { /* gone */ } } }]);
    const link = externalHttps(q.linkURL);
    if (link) groups.push([
      { label: "Отвори връзката в браузъра", click: () => { lastExternal = 0; toBrowser(link); } },
      { label: "Копирай адреса на връзката", click: () => { try { if (clipboard) clipboard.writeText(link); } catch { /* busy */ } } },
    ]);
    if (!groups.length || !Menu) return;
    const items = groups.flatMap((g, i) => (i ? [{ type: "separator" }, ...g] : g));
    try { Menu.buildFromTemplate(items).popup({ window: (windowFor && windowFor(contents)) || getWindow() || undefined }); } catch { /* no window */ }
  }

  // A sign-in or call window of the site: a fixed shape, in the site's partition, closed with the card.
  function makeChild(c, opener, webContents) {
    const parent = (windowFor && windowFor(opener)) || getWindow() || undefined;
    const win = new BrowserWindow({
      width: 520, height: 720, minWidth: 360, minHeight: 480, center: true, ...(parent ? { parent } : {}), modal: false, show: true,
      frame: true, transparent: false, alwaysOnTop: false, fullscreenable: false, autoHideMenuBar: true, title: SOCIAL_SITES[c.site].label,
      backgroundColor: "#ffffff", webContents, webPreferences: panelWebPreferences({ packaged }),
    });
    c.children.add(win);
    win.on("closed", () => c.children.delete(win));
    return win.webContents;
  }

  function harden(contents) {
    if (!contents || hardened.has(contents)) return;
    const site = siteOfContents(contents);
    if (!site) return;
    hardened.add(contents);
    contents.on("input-event", (_e, input) => { if (input && ACTIVATING.has(input.type)) { lastInput = now(); inputUsed = false; } });
    contents.on("will-navigate", (event, url) => {
      const target = (event && event.url) || url;
      if (sitePageUrl(site, target)) return;
      event.preventDefault();
      refused(site, target, { user: takeGesture() });
    });
    contents.on("will-redirect", (event, url, _inPlace, isMainFrame) => {
      const target = (event && event.url) || url;
      const main = event && typeof event.isMainFrame === "boolean" ? event.isMainFrame : isMainFrame !== false;
      if (main ? !sitePageUrl(site, target) : !frameUrlAllowed(target)) { event.preventDefault(); if (main) refused(site, target); }
    });
    contents.on("will-frame-navigate", (event) => { if (event && event.isMainFrame === false && !frameUrlAllowed(event.url)) event.preventDefault(); });
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.setWindowOpenHandler((details) => {
      const d = details && typeof details === "object" ? details : {};
      const url = str(d.url);
      const c = views.get(site);
      if (c && sitePageUrl(site, url) && typeof BrowserWindow === "function" && c.children.size < SOCIAL_MAX_CHILDREN) {
        return { action: "allow", overrideBrowserWindowOptions: { webPreferences: panelWebPreferences({ packaged }) }, createWindow: (options) => makeChild(c, contents, options && options.webContents) };
      }
      if (externalHttps(url)) refused(site, url, { user: d.postBody == null && takeGesture(), canOpen: d.postBody == null });
      return { action: "deny" };
    });
    contents.on("context-menu", (_e, params) => contextMenu(contents, params));
  }

  function onDownload(site, event, item) {
    let url = "";
    try { url = str(item.getURL()); } catch { url = ""; }
    let name = "file";
    try { name = safeName(item.getFilename()); } catch { /* default */ }
    let gesture = false;
    try { gesture = typeof item.hasUserGesture === "function" && item.hasUserGesture() === true; } catch { gesture = false; }
    const src = socialDownloadSource(url);
    if (!src || !gesture || !socialDownloadAllowed(name)) {
      event.preventDefault();
      warn("social_panel.download_refused", { site, why: !src ? "source" : !gesture ? "gesture" : "type", ext: extOf(name).slice(0, 12) });
      if (site === active) { st.blocked = { host: hostOf(url) || SOCIAL_SITES[site].label, external: false, canOpen: false, download: true }; push(); }
      return;
    }
    const ext = extOf(name);
    try { item.setSaveDialogOptions({ title: `Запази файла от ${SOCIAL_SITES[site].label}`, buttonLabel: "Запази", defaultPath: path.join(String(documentsDir() || ""), name), filters: [{ name: ext.toUpperCase(), extensions: [ext] }] }); } catch { /* still asks */ }
    try {
      item.once("done", (_e, s) => {
        let p = "";
        try { p = str(item.getSavePath()); } catch { p = ""; }
        if (s !== "completed" || !p || platform !== "win32") return;
        try { writeFile(`${p}:Zone.Identifier`, `${MOTW}HostUrl=https://${src}/\r\n`); } catch { /* best effort */ }
      });
    } catch { /* no events (tests) */ }
  }

  function configure(site, ses) {
    if (configured.has(ses)) return;
    configured.add(ses);
    try { if (typeof ses.setSpellCheckerEnabled === "function") ses.setSpellCheckerEnabled(false); } catch { /* none */ }
    if (userAgent) ses.setUserAgent(userAgent, acceptLanguages(locale));
    if (hints && ses.webRequest && typeof ses.webRequest.onBeforeSendHeaders === "function") {
      ses.webRequest.onBeforeSendHeaders({ urls: ["https://*/*"] }, (details, callback) => callback({ requestHeaders: withClientHints(details && details.requestHeaders, hints) }));
    }
    ses.setPermissionRequestHandler((contents, permission, callback, details) => {
      const d = details || {};
      callback(socialPermission(site, permission, d.requestingUrl || d.securityOrigin || (contents && typeof contents.getURL === "function" ? contents.getURL() : ""), d));
    });
    ses.setPermissionCheckHandler((_c, permission, origin, details) => socialPermission(site, permission, origin || (details && (details.requestingUrl || details.securityOrigin)) || "", details));
    ses.setDevicePermissionHandler(() => false);
    ses.on("will-download", (event, item) => onDownload(site, event, item));
  }

  function setUnread(c, n) {
    if (c.unread === n) return;
    c.unread = n;
    push();
    if (typeof onUnread === "function") { try { onUnread(Object.values(unread()).reduce((a, b) => a + b, 0)); } catch { /* ignore */ } }
  }

  function ensureView(site) {
    const who = owner();
    if (!who || !siteOf(site)) return null;
    const partition = socialPartition(site, who);
    let c = views.get(site);
    if (c && (c.partition !== partition || gone(c))) { destroyView(site); c = null; }
    if (c) return c;
    const win = getWindow();
    if (!win || win.isDestroyed()) return null;
    const ses = fromPartition(partition);
    sessions.set(ses, site);
    configure(site, ses);
    const view = new WebContentsView({ webPreferences: { ...panelWebPreferences({ session: ses, packaged }), backgroundThrottling: false } });
    const wc = view.webContents;
    c = { site, view, wc, partition, attached: false, loaded: false, crashed: false, unread: 0, children: new Set() };
    views.set(site, c);
    harden(wc);
    try { if (userAgent) wc.setUserAgent(userAgent); } catch { /* the session's agent applies */ }
    try { view.setBackgroundColor("#ffffff"); } catch { /* default */ }
    try { if (typeof view.setBorderRadius === "function") view.setBorderRadius(SOCIAL_RADIUS); } catch { /* square corners */ }
    view.setVisible(false);
    const mine = () => views.get(site) === c;
    const isActive = () => mine() && active === site;
    wc.on("did-start-loading", () => { if (isActive()) { st.loading = true; push(); } });
    wc.on("did-stop-loading", () => { if (isActive()) { st.loading = false; push(); } });
    wc.on("did-navigate", () => { if (isActive()) { st.error = null; st.blocked = null; push(); } });
    wc.on("page-title-updated", (_e, title) => { if (mine()) setUnread(c, unreadFromTitle(title)); });
    wc.on("did-fail-load", (_e, code, description, _url, isMainFrame) => {
      if (!mine() || isMainFrame === false || code === -3) return;
      warn("social_panel.load_failed", { site, errorCode: code });
      if (isActive()) { st.error = SOCIAL_SITES[site].label + " не се зареди (" + (str(description) || "грешка " + code) + "). Проверете връзката и натиснете ↻."; push(); }
    });
    wc.on("render-process-gone", () => { if (!mine()) return; c.crashed = true; if (isActive()) { st.error = "Страницата на " + SOCIAL_SITES[site].label + " спря. Натиснете ↻."; push(); } });
    wc.on("before-input-event", (event, input) => {
      if (input && input.type === "keyDown" && (input.control || input.meta) && input.shift && !input.alt && (input.code === "KeyB" || str(input.key).toLowerCase() === "b")) {
        event.preventDefault();
        if (typeof onShortcut === "function") onShortcut("bubble");
      }
    });
    if (typeof win.once === "function") win.once("closed", () => destroyAll());
    made += 1;
    return c;
  }

  function attach(c) {
    if (c.attached) return;
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    win.contentView.addChildView(c.view);
    c.attached = true;
  }
  function detachView(c) {
    if (!c || !c.attached) return;
    const win = getWindow();
    try { c.view.setVisible(false); } catch { /* gone */ }
    try { if (win && !win.isDestroyed()) win.contentView.removeChildView(c.view); } catch { /* gone */ }
    c.attached = false;
  }
  function destroyView(site) {
    const c = views.get(site);
    views.delete(site);
    if (!c) return;
    for (const w of c.children) { try { if (!w.isDestroyed()) w.destroy(); } catch { /* gone */ } }
    detachView(c);
    try { if (!gone(c)) c.wc.close(); } catch { /* closed */ }
  }
  function destroyAll() { for (const k of [...views.keys()]) destroyView(k); }

  function zoom() {
    const win = getWindow();
    try { const z = win && win.webContents && win.webContents.getZoomFactor(); return Number.isFinite(z) && z > 0 ? z : 1; } catch { return 1; }
  }
  function apply() {
    const c = active ? views.get(active) : null;
    for (const [k, v] of views) if (k !== active && v.attached) detachView(v); // only the chosen site lies over the window
    if (!c || gone(c)) { if (st.visible) { st.visible = false; push(); } return; }
    const show = open && mode === "normal" && !!want && want.visible && want.width >= MIN_SIDE && want.height >= MIN_SIDE;
    if (show) {
      attach(c);
      const z = zoom();
      const y = Math.max(want.y, TITLE_BAR);
      c.view.setBounds({ x: Math.round(want.x * z), y: Math.round(y * z), width: Math.round(want.width * z), height: Math.round((want.height - (y - want.y)) * z) });
    }
    c.view.setVisible(show);
    for (const w of c.children) { try { if (show) { if (!w.isVisible()) w.show(); } else if (w.isVisible()) w.hide(); } catch { /* gone */ } }
    if (st.visible !== show) { st.visible = show; push(); }
  }

  function load(c, href) {
    c.loaded = true;
    c.crashed = false;
    st.error = null; st.blocked = null; pending = null;
    Promise.resolve(c.wc.loadURL(href)).catch(() => { /* aborted: a newer navigation */ });
  }

  function openPanel({ site } = {}) {
    const s = siteOf(site);
    if (!s) return { ok: false, code: "invalid", error: "Непознат чат." };
    if (!owner()) return { ok: false, code: "signed_out", error: "Влезте в CRM, за да отворите " + s.label + "." };
    const c = ensureView(site);
    if (!c) return { ok: false, code: "unavailable", error: s.label + " не можа да се отвори." };
    if (active !== site) { st.error = null; st.blocked = null; st.loading = false; pending = null; }
    active = site;
    open = true;
    if (!c.loaded || c.crashed) load(c, s.home);
    apply();
    push();
    return { ok: true };
  }
  function setBounds(raw) {
    const b = cleanBounds(raw);
    if (!b) return { ok: false, code: "invalid" };
    want = b;
    apply();
    return { ok: true };
  }
  // × : the card closes, the page stays loaded in the background (its number keeps coming).
  function close() {
    open = false;
    want = null;
    apply();
    for (const v of views.values()) detachView(v);
    st.blocked = null; pending = null;
    push();
    return { ok: true };
  }
  function reload() {
    const c = active ? views.get(active) : null;
    if (!open || !c) return { ok: false, code: "closed" };
    if (c.crashed || !c.loaded || gone(c)) return openPanel({ site: active });
    st.error = null; st.blocked = null;
    try { c.wc.reload(); } catch { load(c, SOCIAL_SITES[active].home); }
    push();
    return { ok: true };
  }
  async function openInBrowser(args) {
    if (args && args.blocked === true) {
      const href = pending;
      if (!href) return { ok: false, code: "none", error: "Няма връзка за отваряне." };
      pending = null;
      lastExternal = now();
      const r = await openExternal(href).catch(() => null);
      if (st.blocked) st.blocked = { ...st.blocked, external: !!(r && r.ok), canOpen: false };
      push();
      return r && r.ok ? { ok: true } : { ok: false, error: (r && r.error) || "Браузърът не можа да се отвори." };
    }
    const s = siteOf(active || (args && args.site));
    if (!s) return { ok: false, code: "invalid", error: "Няма отворен чат." };
    const r = await openExternal(s.home).catch(() => null);
    return r && r.ok ? { ok: true } : { ok: false, error: (r && r.error) || "Браузърът не можа да се отвори." };
  }
  function setWindowMode(m) { mode = m === "bubble" || m === "mini" ? m : "normal"; apply(); }
  // A CRM sign-in/sign-out: this employee's chats leave the program (their partitions stay on disk, his own).
  function detach() {
    open = false; want = null; active = null;
    destroyAll();
    st.visible = false; st.loading = false; st.error = null; st.blocked = null;
    push();
    if (typeof onUnread === "function") { try { onUnread(0); } catch { /* ignore */ } }
  }

  return { owns, harden, open: openPanel, setBounds, close, reload, openInBrowser, setWindowMode, detach, destroy: detach, state, created: () => made };
}
