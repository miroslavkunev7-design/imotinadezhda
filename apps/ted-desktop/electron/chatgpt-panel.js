// „ChatGPT панел“ (0.1.7, docs/CONTRACT.md §23). OpenAI gives image generation to no external program on the
// Sign-in-with-ChatGPT route, so pictures are made in ChatGPT itself, with the employee's own plan – but INSIDE Ted:
// chatgpt.com is shown in an Electron WebContentsView attached to the main window, placed by MAIN over a placeholder
// element of the renderer (the renderer reports its rectangle; it never touches the page).
//
// The panel is the one documented exception to „MAIN-only network with host allowlists“: it is the official site in
// its own sandboxed, persistent session partition (one per CRM user), with
//   - no preload, contextIsolation, sandbox, no Node, no <webview>, DevTools only when not packaged;
//   - a normal Chrome user agent (no „Electron“ / program token, Chrome's reduced version „Chrome/<major>.0.0.0“, the
//     low-entropy client hints Chrome sends, Accept-Language from the same locale as navigator.languages – Google
//     refuses sign-in from embedded agents);
//   - top-level pages only on chatgpt.com, openai.com (and their subdomains) and the exact sign-in hosts of Google,
//     Apple and Microsoft; frames inside a page may load from https (Cloudflare check, sign-in and payment widgets –
//     like the page's own pictures and scripts); any other https page goes to the system browser (security.js
//     openExternal) only when the employee's own click/key in the panel started it from an allowed page – otherwise
//     the panel shows a note with „Отвори в браузъра“; anything else is dropped;
//   - pop-ups of the sign-in providers as small child windows of a FIXED shape (the page's window features are
//     ignored) in the same partition, at most two; a blank one stays invisible until it reaches an allowed page and
//     is destroyed when it is sent anywhere else; every other pop-up is handled like a link (above);
//   - every permission refused except ChatGPT's own copy button (clipboard-sanitized-write); downloads only from
//     ChatGPT/OpenAI after the employee's click, only pictures and documents, only through the save dialog, marked as
//     downloaded (Mark-of-the-Web) on Windows; no access to the app's IPC, files, CRM tokens or OpenAI tokens.
// Ted never reads or scrapes the page (OpenAI forbids automated extraction): the employee copies a finished picture
// himself (right click → „Копирай изображението“ or ChatGPT's copy button) and „📋 Добави снимката в чата“ reads
// the clipboard in MAIN – only on that click.
//
// Pure helpers + a controller with every Electron object injected (no electron import), unit-tested with fakes
// (tests/unit/chatgpt-panel.test.js).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CHATGPT_HOME, CHATGPT_HOST } from "./agent/chatgpt-link.js";
import { MOTW, RUNNABLE as APP_RUNNABLE } from "./files.js";

export const PANEL_PARTITION_PREFIX = "persist:chatgpt-";
// Top-level pages: these domains and every subdomain of them (chatgpt.com, *.chatgpt.com, openai.com, auth.openai.com …).
export const PANEL_DOMAINS = ["chatgpt.com", "openai.com"];
// The sign-in providers the owner uses – exact hosts only (no subdomains, no look-alikes).
export const SIGNIN_HOSTS = [
  "accounts.google.com", "accounts.google.bg", "accounts.youtube.com", // Google sign-in and its cookie hops
  "appleid.apple.com", "idmsa.apple.com", // Sign in with Apple
  "login.microsoftonline.com", "login.live.com", "login.microsoft.com", "account.live.com", // Microsoft
];
// Pop-ups that open as a child window of the panel (sign-in); every other pop-up goes to the system browser.
export const POPUP_HOSTS = [...SIGNIN_HOSTS, "auth.openai.com"];
// The only permission the page gets: ChatGPT's own „copy“ button (writing a picture or text to the clipboard).
export const PANEL_PERMISSIONS = ["clipboard-sanitized-write"];
export const CLIPBOARD_MAX = 8 * 1024 * 1024; // the PNG read from the clipboard
export const CLIPBOARD_MAX_PIXELS = 50000000;
export const MIN_SIDE = 40; // a smaller rectangle hides the view
export const TITLE_BAR = 36; // the view never covers the title bar and Windows' caption buttons
export const URL_MAX = 32768;
export const EXTERNAL_GAP_MS = 1500; // at most one page sent to the system browser per 1,5 s
// A page may hand an address to the system browser only this soon after the employee's own click or key in the panel
// (one address per click; like a browser's pop-up blocker). Without it the panel shows a note with a button.
export const GESTURE_MS = 2000;
export const MAX_CHILDREN = 2;      // sign-in windows open at the same time
export const BLANK_CHILD_MS = 15000; // a blank sign-in window that reaches no allowed page by then is destroyed
// What a download from the panel may be (ChatGPT's pictures and documents) – an allowlist; files.js RUNNABLE (the
// app's own list of types Windows would run) and the panel's list below are checked as well.
export const DOWNLOADABLE = /\.(png|jpe?g|webp|gif|pdf|docx|xlsx|pptx|csv|txt|md|json|mp3|mp4|wav)$/i;
// Where a download may come from: ChatGPT / OpenAI and OpenAI's file host (pictures, files of an answer).
export const DOWNLOAD_DOMAINS = ["chatgpt.com", "openai.com", "oaiusercontent.com"];
// File types Windows would run (in addition to files.js RUNNABLE): never downloaded from the panel.
const RUNNABLE = /\.(exe|com|bat|cmd|scr|pif|cpl|msi|msp|mst|dll|sys|lnk|url|hta|js|jse|mjs|vbs|vbe|wsf|wsh|ps1|psm1|psd1|reg|inf|jar|appref-ms|application|gadget|scf|msc|msix|appx)$/i;
// Input that counts as the employee's own action (Chromium's user activation: a press of a mouse button or a key).
const ACTIVATING = new Set(["mouseDown", "mouseUp", "rawKeyDown", "keyDown", "gestureTap", "touchStart", "touchEnd"]);

const str = (v) => (typeof v === "string" ? v : "");

// The program's own Chromium user agent without the „Electron/…“ and program tokens, with Chrome's reduced version
// (desktop Chrome sends „Chrome/<major>.0.0.0“, User-Agent Reduction): what Chrome itself sends.
export function chromeUserAgent(fallback) {
  return str(fallback).replace(/\s(Electron|ted-desktop|Ted Imoti Nadezhda|TedImotiNadezhda|TedDesktop)\/\S+/gi, "")
    .replace(/\bChrome\/(\d+)\.\d+\.\d+\.\d+\b/, "Chrome/$1.0.0.0").replace(/\s{2,}/g, " ").trim();
}

// Accept-Language from the program's locale – the same source Electron gives navigator.languages – as Electron wants it
// (plain language codes; Electron adds the q-values itself: „en-US,en“ -> „en-US,en;q=0.9“).
export function acceptLanguages(locale) {
  const l = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/.test(str(locale)) ? str(locale) : "en-US";
  return [...new Set([l, l.split("-")[0]])].join(",");
}

// The low-entropy client hints Chrome sends on every https request (Electron sends none, but the page's JS sees
// navigator.userAgentData): the same brands, in Chromium's own GREASE order for this major version (Chromium without
// a brand: [GREASE, Chromium] for an even major, [Chromium, GREASE] for an odd one).
const GREASE_CHARS = [" ", "(", ":", "-", ".", "/", ")", ";", "=", "?", "_"];
const GREASE_VERSIONS = ["8", "99", "24"];
export function clientHints(userAgent, platform) {
  const m = /\bChrome\/(\d+)\./.exec(str(userAgent));
  if (!m) return null;
  const major = Number(m[1]);
  const grease = `"Not${GREASE_CHARS[major % GREASE_CHARS.length]}A${GREASE_CHARS[(major + 1) % GREASE_CHARS.length]}Brand";v="${GREASE_VERSIONS[major % GREASE_VERSIONS.length]}"`;
  const chromium = `"Chromium";v="${major}"`;
  const plat = platform === "win32" ? "Windows" : platform === "darwin" ? "macOS" : "Linux";
  return { "sec-ch-ua": (major % 2 === 0 ? [grease, chromium] : [chromium, grease]).join(", "), "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": `"${plat}"` };
}
export function withClientHints(headers, hints) {
  const h = headers && typeof headers === "object" ? { ...headers } : {};
  if (!hints) return h;
  const have = new Set(Object.keys(h).map((k) => k.toLowerCase()));
  for (const [k, v] of Object.entries(hints)) if (!have.has(k)) h[k] = v;
  return h;
}

// One persistent partition per CRM user (like the Real GPT connection): another employee signing in to Ted on the
// same computer never sees this employee's ChatGPT.
export function panelPartition(ownerId) {
  return PANEL_PARTITION_PREFIX + crypto.createHash("sha256").update(String(ownerId)).digest("hex").slice(0, 16);
}

export function hostAllowed(host) {
  const h = str(host).toLowerCase();
  if (!h || h.length > 253) return false;
  return PANEL_DOMAINS.some((d) => h === d || h.endsWith("." + d)) || SIGNIN_HOSTS.includes(h);
}

// A page the panel may show at top level -> the parsed URL, else null. https only, no user/password, no port,
// the host on the list (the WHATWG parser already lower-cases it and turns an IDN into punycode).
export function pageUrl(value) {
  if (typeof value !== "string" || !value || value.length > URL_MAX) return null;
  let u;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port !== "") return null;
  return hostAllowed(u.hostname) ? u : null;
}

// A frame inside a page: https (any host, like the page's pictures and scripts), about:blank/srcdoc, blob:, data:.
export function frameUrlAllowed(value) {
  if (typeof value !== "string" || !value || value.length > URL_MAX) return false;
  if (value === "about:blank" || value === "about:srcdoc") return true;
  let u;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol === "https:") return !u.username && !u.password;
  return u.protocol === "blob:" || u.protocol === "data:";
}

// An https address the system browser may receive (security.js openExternal checks it again).
export function externalHttps(value) {
  if (typeof value !== "string" || !value || value.length > 8192) return null;
  let u;
  try { u = new URL(value); } catch { return null; }
  return u.protocol === "https:" && u.hostname && !u.username && !u.password ? u.href : null;
}

// window.open from the panel: "child" (a sign-in window of the panel), "external" (an https page for the system
// browser, under the rules of a link) or "deny".
export function popupKind(value) {
  if (value === "" || value === "about:blank") return "child"; // a sign-in library opens a blank window and navigates it (checked then; invisible until then)
  const u = pageUrl(value);
  if (u && POPUP_HOSTS.includes(u.hostname)) return "child";
  return externalHttps(value) ? "external" : "deny";
}

const onDomain = (host, domains) => { const h = str(host).toLowerCase(); return !!h && domains.some((d) => h === d || h.endsWith("." + d)); };
// Where a download comes from -> the host to name in the save dialog, or null (refused): https of ChatGPT/OpenAI or
// OpenAI's file host (no user part, no port), blob: made by such a page, data: only for the panel's own
// „Запази изображението като…“ (mine).
export function downloadSource(value, mine = false) {
  if (typeof value !== "string" || !value || value.length > URL_MAX * 64) return null;
  if (/^data:/i.test(value)) return mine ? "ChatGPT" : null;
  let u;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol === "blob:") { try { u = new URL(u.pathname); } catch { return null; } }
  if (u.protocol !== "https:" || u.username || u.password || u.port !== "") return null;
  return onDomain(u.hostname, DOWNLOAD_DOMAINS) ? u.hostname : null;
}
const extOf = (name) => { const m = /\.([A-Za-z0-9-]{1,20})$/.exec(str(name)); return m ? m[1].toLowerCase() : ""; };
export const downloadAllowed = (name) => DOWNLOADABLE.test(str(name)) && !RUNNABLE.test(str(name)) && !APP_RUNNABLE.test(str(name));

export function panelPermission(permission, origin) {
  return PANEL_PERMISSIONS.includes(permission) && !!pageUrl(str(origin));
}

// The WebContentsView of the panel: the hardened preferences of window.js, no preload, its own session.
export function panelWebPreferences({ session, packaged } = {}) {
  return {
    ...(session ? { session } : {}),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    webviewTag: false,
    navigateOnDragDrop: false,
    spellcheck: false,
    safeDialogs: true,
    devTools: !packaged,
  };
}

// The placeholder's rectangle from the renderer (CSS px of the main window) -> clean numbers, or null.
export function cleanBounds(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  if (![r.x, r.y, r.width, r.height].every(num) || typeof r.visible !== "boolean") return null;
  const c = (v, lo, hi) => Math.round(Math.min(Math.max(v, lo), hi));
  return { x: c(r.x, 0, 20000), y: c(r.y, 0, 20000), width: c(r.width, 0, 20000), height: c(r.height, 0, 20000), visible: r.visible };
}

// chatgpt.com/?q=<prompt> is opened the way a link from another site arrives (a navigation started by a blank local
// page, Sec-Fetch-Site: cross-site): chatgpt.com then only fills the prompt in and never sends it by itself – the
// employee presses „Изпрати“ there. The address itself is exactly the one chatgpt-link.js built.
export function bootstrapUrl(target) {
  const esc = str(target).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="0;url=${esc}"><title>ChatGPT</title><body style="background:#fff">`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

const two = (n) => String(n).padStart(2, "0");
export const CLIPBOARD_EMPTY = "В клипборда няма снимка. В ChatGPT: десен бутон върху снимката → „Копирай изображението“ (или бутона за копиране под нея), после натиснете „📋 Добави снимката в чата“.";
export const CLIPBOARD_BIG = "Снимката в клипборда е твърде голяма (над 8 MB като PNG) – копирайте по-малка или я запазете и я прикачете като файл.";

export const CLIPBOARD_SOURCE_MAX = 64 * 1024 * 1024; // a clipboard entry is not even read past this

// PNG width/height straight from the IHDR chunk (when nativeImage cannot decode it).
function pngSize(buf) {
  if (!buf || buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
function clipResult(png, width, height, now) {
  if (width < 1 || height < 1 || !png || !png.length) return { ok: false, code: "empty", error: CLIPBOARD_EMPTY };
  if (width * height > CLIPBOARD_MAX_PIXELS || png.length > CLIPBOARD_MAX) return { ok: false, code: "too_large", error: CLIPBOARD_BIG };
  const d = now instanceof Date ? now : new Date(now);
  const name = `Снимка от ChatGPT ${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}.${two(d.getMinutes())}.png`;
  const data = png.buffer.slice(png.byteOffset, png.byteOffset + png.length);
  return { ok: true, name, mime: "image/png", size: png.length, width, height, data };
}

// The clipboard's picture -> a PNG for the composer, exactly like an attached file (the renderer re-encodes it).
// Electron 45: clipboard.read() -> ClipboardItem[] (types, getType(type) -> Blob); the picture is taken as image/png
// (or another image type, turned into PNG with nativeImage). Older Electron: clipboard.readImage() -> NativeImage.
export async function readClipboardImage(clipboard, nativeImage = null, now = new Date()) {
  if (clipboard && typeof clipboard.read === "function") {
    let items = [];
    try { items = await clipboard.read(); } catch { items = []; }
    for (const item of Array.isArray(items) ? items : []) {
      const types = Array.isArray(item && item.types) ? item.types.map(String) : [];
      const type = types.includes("image/png") ? "image/png" : types.find((t) => /^image\/(jpeg|webp|gif|bmp)$/i.test(t));
      if (!type) continue;
      let blob = null;
      try { blob = await item.getType(type); } catch { blob = null; }
      if (!blob || typeof blob.arrayBuffer !== "function" || !blob.size) continue;
      if (blob.size > CLIPBOARD_SOURCE_MAX) return { ok: false, code: "too_large", error: CLIPBOARD_BIG };
      const buf = Buffer.from(await blob.arrayBuffer());
      let img = null;
      try { img = nativeImage && typeof nativeImage.createFromBuffer === "function" ? nativeImage.createFromBuffer(buf) : null; } catch { img = null; }
      const decoded = img && typeof img.isEmpty === "function" && !img.isEmpty() ? img.getSize() : null;
      if (type === "image/png") {
        const sz = decoded || pngSize(buf);
        if (!sz) continue;
        return clipResult(buf, Number(sz.width) || 0, Number(sz.height) || 0, now);
      }
      if (!decoded) continue; // a format nativeImage cannot read
      let png = null;
      try { png = img.toPNG(); } catch { png = null; }
      return clipResult(png, Number(decoded.width) || 0, Number(decoded.height) || 0, now);
    }
    return { ok: false, code: "empty", error: CLIPBOARD_EMPTY };
  }
  let img = null;
  try { img = clipboard && typeof clipboard.readImage === "function" ? clipboard.readImage() : null; } catch { img = null; }
  if (!img || typeof img.isEmpty !== "function" || img.isEmpty()) return { ok: false, code: "empty", error: CLIPBOARD_EMPTY };
  const size = typeof img.getSize === "function" ? img.getSize() : { width: 0, height: 0 };
  const width = Number(size && size.width) || 0;
  const height = Number(size && size.height) || 0;
  if (width < 1 || height < 1) return { ok: false, code: "empty", error: CLIPBOARD_EMPTY };
  if (width * height > CLIPBOARD_MAX_PIXELS) return { ok: false, code: "too_large", error: CLIPBOARD_BIG };
  let png = null;
  try { png = img.toPNG(); } catch { png = null; }
  return clipResult(png, width, height, now);
}

function safeName(value) {
  const name = str(value).replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").replace(/^[.\s]+/, "").trim().slice(0, 120);
  return name || "chatgpt";
}
const hostOf = (value) => { try { const u = new URL(str(value)); return u.protocol === "https:" ? u.hostname : null; } catch { return null; } };

// The fixed shape of a sign-in window. Nothing of the page's window.open features is used (frame, transparency,
// always-on-top, position, opacity, focusability … would otherwise come from the page).
export function childShape({ parent, packaged = true, show = true } = {}) {
  return {
    width: 520, height: 720, minWidth: 360, minHeight: 480, center: true, ...(parent ? { parent } : {}), modal: false,
    show, frame: true, transparent: false, alwaysOnTop: false, skipTaskbar: false, closable: true, movable: true,
    minimizable: true, maximizable: true, resizable: true, focusable: true, opacity: 1, hasShadow: true, kiosk: false,
    fullscreen: false, fullscreenable: false, titleBarStyle: "default", autoHideMenuBar: true, title: "Вход – ChatGPT",
    backgroundColor: "#ffffff", webPreferences: panelWebPreferences({ packaged }),
  };
}

// The controller. Injected: WebContentsView, BrowserWindow (the sign-in windows), fromPartition(name) -> session,
// getWindow() -> the main BrowserWindow, windowFor(contents) -> the window to own a menu or a pop-up, Menu, clipboard,
// nativeImage, openExternal(url) (security.js), owner() -> CRM user id | null, userAgent, locale, platform, packaged,
// documentsDir(), emit(state), log, onShortcut(name), now(), setTimer(fn, ms), writeFile(path, text) (Mark-of-the-Web).
export function createChatGptPanel({
  WebContentsView, BrowserWindow = null, fromPartition, getWindow, windowFor, Menu, clipboard, nativeImage = null, openExternal, owner, userAgent,
  locale = "en-US", platform = process.platform, packaged = true, documentsDir = () => "", emit = () => {}, log = null, onShortcut = null,
  now = Date.now, setTimer = (fn, ms) => { const t = setTimeout(fn, ms); if (t && typeof t.unref === "function") t.unref(); return t; },
  writeFile = (file, text) => fs.writeFileSync(file, text),
}) {
  let cur = null;       // {view, wc, partition, attached, loaded, crashed}
  let open = false;     // the employee has the panel open
  let mode = "normal";  // the window mode of „Балонче“ (§22): the view shows only in the normal window
  let want = null;      // the last rectangle the renderer reported
  let made = 0;         // views created in this run (the smoke test checks 0)
  let lastExternal = 0;
  let lastInput = -Infinity; // the employee's last click/key in a panel page (input-event, MAIN sees only real input)
  let inputUsed = true;      // one address per click
  let pending = null;        // the https address of the last note, for its „Отвори в браузъра“ (never sent to the renderer)
  let blockedOn = null;      // the panel page's address (without #) when the note appeared
  let menuDownload = null;   // {url, at}: the employee's own „Запази изображението като…“
  const st = { visible: false, loading: false, host: null, error: null, blocked: null };
  const sessions = new Set();    // panel sessions of this run
  const configured = new WeakSet();
  const hardened = new WeakSet();
  const children = new Map();    // sign-in pop-up windows: win -> {win, wc, reached, timer}
  const hints = clientHints(userAgent, platform);
  const warn = (event, fields) => { if (log) log.warn(event, fields); };

  const state = () => ({ open, visible: st.visible, loading: st.loading, host: st.host, error: st.error, blocked: st.blocked });
  const push = () => { try { emit(state()); } catch { /* the window is gone */ } };
  const gone = (c) => !c || !c.wc || (typeof c.wc.isDestroyed === "function" && c.wc.isDestroyed());

  function pathOf(s) {
    try { return typeof s.getStoragePath === "function" ? s.getStoragePath() : s.storagePath || null; } catch { return null; }
  }
  // Is this web contents one of the panel's (the view or a sign-in pop-up)? Decided by its session.
  function owns(contents) {
    let s = null;
    try { s = contents && contents.session; } catch { s = null; }
    if (!s) return false;
    for (const p of sessions) {
      if (s === p) return true;
      const a = pathOf(s);
      const b = pathOf(p);
      if (a && b && a === b) return true;
    }
    return false;
  }

  // An https page the panel does not show goes to the system browser (at most one per 1,5 s); nothing else leaves.
  function toBrowser(url) {
    const href = externalHttps(url);
    if (!href) return false;
    const t = now();
    if (t - lastExternal < EXTERNAL_GAP_MS) return false;
    lastExternal = t;
    Promise.resolve(openExternal(href)).catch(() => {});
    return true;
  }
  // The employee's own click or key in a panel page (the view or a sign-in window). Script, timers and frames that
  // nobody clicked produce no input event.
  function noteInput(input) {
    if (input && ACTIVATING.has(input.type)) { lastInput = now(); inputUsed = false; }
  }
  function takeGesture() {
    if (inputUsed || now() - lastInput > GESTURE_MS) return false;
    inputUsed = true;
    return true;
  }
  const pageNoHash = () => { try { return cur && !gone(cur) ? str(cur.wc.getURL()).split("#")[0] : null; } catch { return null; } };
  // A page the panel does not show. user: the employee's own click on an allowed page started it -> the system browser
  // right away; otherwise (script, a timer, a frame of another site, a redirect) the note with „Отвори в браузъра“.
  // from: the web contents it happened in – a blank sign-in window sent elsewhere is destroyed.
  function refused(url, { user = false, from = null, canOpen = true } = {}) {
    const host = hostOf(url);
    warn("chatgpt_panel.blocked", { host: host || String(url).split(":")[0].slice(0, 20), user: !!user });
    const href = canOpen ? externalHttps(url) : null;
    const sent = user && href ? toBrowser(href) : false;
    pending = href && !sent ? href : null;
    st.blocked = host ? { host, external: sent, canOpen: !!pending } : null;
    blockedOn = pageNoHash();
    if (from) dropBlankChild(from);
    push();
  }
  // The note goes away once the employee moves on in ChatGPT (another page or conversation).
  function clearBlocked(url, sameDocument) {
    if (!st.blocked) return false;
    if (sameDocument && str(url).split("#")[0] === blockedOn) return false;
    st.blocked = null; pending = null; blockedOn = null;
    return true;
  }
  // Who started a navigation: a top frame on an allowed page (the view, or the opener of a sign-in window).
  function byAllowedPage(initiator) {
    try { return !!initiator && initiator.parent == null && !!pageUrl(str(initiator.url)); } catch { return false; }
  }

  function contextMenu(contents, p) {
    const q = p || {};
    const groups = [];
    if (q.mediaType === "image" && q.hasImageContents !== false) {
      const g = [{ label: "Копирай изображението", click: () => { try { contents.copyImageAt(q.x, q.y); } catch { /* gone */ } } }];
      if (/^(https:|blob:|data:image\/)/i.test(str(q.srcURL))) g.push({ label: "Запази изображението като…", click: () => { menuDownload = { url: q.srcURL, at: now() }; try { contents.downloadURL(q.srcURL); } catch { /* gone */ } } });
      groups.push(g);
    }
    if (q.isEditable) {
      const f = q.editFlags || {};
      groups.push([
        { label: "Изрежи", enabled: f.canCut !== false, click: () => contents.cut() },
        { label: "Копирай", enabled: f.canCopy !== false, click: () => contents.copy() },
        { label: "Постави", enabled: f.canPaste !== false, click: () => contents.paste() },
        { label: "Избери всичко", click: () => contents.selectAll() },
      ]);
    } else if (str(q.selectionText).trim()) {
      groups.push([{ label: "Копирай", click: () => contents.copy() }]);
    }
    const link = externalHttps(q.linkURL);
    if (link) {
      groups.push([
        { label: "Отвори връзката в браузъра", click: () => { lastExternal = 0; toBrowser(link); } },
        { label: "Копирай адреса на връзката", click: () => { try { Promise.resolve(clipboard.writeText(link)).catch(() => {}); } catch { /* clipboard busy */ } } },
      ]);
    }
    if (!groups.length || !Menu) return;
    const items = groups.flatMap((g, i) => (i ? [{ type: "separator" }, ...g] : g));
    try { Menu.buildFromTemplate(items).popup({ window: (windowFor && windowFor(contents)) || getWindow() || undefined }); } catch { /* no window */ }
  }

  // ---- sign-in windows ----
  const childOf = (contents) => { for (const r of children.values()) if (r.wc === contents) return r; return null; };
  function destroyChild(r) {
    children.delete(r.win);
    try { if (!r.win.isDestroyed()) r.win.destroy(); } catch { /* gone */ }
  }
  // A blank sign-in window that is sent to a page outside the list never shows: it is destroyed (finding: an empty
  // „Вход – ChatGPT“ window was left behind).
  function dropBlankChild(contents) {
    const r = childOf(contents);
    if (r && !r.reached) destroyChild(r);
  }
  const childVisible = (r) => r.reached && open && mode === "normal";
  function showChildren() {
    for (const r of children.values()) {
      try { if (r.win.isDestroyed()) continue; if (childVisible(r)) { if (!r.win.isVisible()) r.win.show(); } else if (r.win.isVisible()) r.win.hide(); } catch { /* gone */ }
    }
  }
  // createWindow of the pop-up: a BrowserWindow of the FIXED shape around the web contents Chromium made (with the
  // panel's preferences, in the panel's partition). A blank one stays hidden until it reaches an allowed page.
  function makeChild(opener, webContents, blank) {
    const parent = (windowFor && windowFor(opener)) || getWindow() || undefined;
    const r = { win: null, wc: null, reached: !blank, timer: null };
    const win = new BrowserWindow({ ...childShape({ parent, packaged, show: !blank && open && mode === "normal" }), webContents });
    r.win = win;
    r.wc = win.webContents;
    children.set(win, r);
    win.on("closed", () => { children.delete(win); });
    r.wc.on("did-navigate", (_e, url) => {
      if (r.reached || !pageUrl(str(url))) return;
      r.reached = true;
      showChildren();
    });
    if (blank) r.timer = setTimer(() => { if (!r.reached && children.has(win)) { warn("chatgpt_panel.blank_popup_dropped", {}); destroyChild(r); } }, BLANK_CHILD_MS);
    return r.wc;
  }

  // The rules for every web contents of the panel's partition (the view and its sign-in pop-ups). security.js hands
  // these over instead of the app's own rules (which allow only app://ted).
  function harden(contents) {
    if (!contents || hardened.has(contents)) return;
    hardened.add(contents);
    contents.on("input-event", (_event, input) => noteInput(input));
    contents.on("will-navigate", (event, url) => {
      const target = (event && event.url) || url;
      if (pageUrl(target)) return;
      event.preventDefault();
      refused(target, { user: byAllowedPage(event && event.initiator) && takeGesture(), from: contents });
    });
    contents.on("will-redirect", (event, url, _inPlace, isMainFrame) => {
      const target = (event && event.url) || url;
      const main = event && typeof event.isMainFrame === "boolean" ? event.isMainFrame : isMainFrame !== false;
      if (main ? !pageUrl(target) : !frameUrlAllowed(target)) { event.preventDefault(); if (main) refused(target, { from: contents }); }
    });
    contents.on("will-frame-navigate", (event) => {
      if (event && event.isMainFrame === false && !frameUrlAllowed(event.url)) event.preventDefault();
    });
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.setWindowOpenHandler((details) => {
      const d = details && typeof details === "object" ? details : {};
      const url = str(d.url);
      const kind = popupKind(url);
      if (kind === "child") {
        if (typeof BrowserWindow !== "function") { warn("chatgpt_panel.popup_denied", { scheme: "child" }); return { action: "deny" }; }
        if (!open) { warn("chatgpt_panel.popup_denied", { scheme: "closed" }); return { action: "deny" }; } // a closed panel opens nothing
        if (children.size >= MAX_CHILDREN) { warn("chatgpt_panel.popup_limit", { open: children.size }); return { action: "deny" }; }
        const blank = url === "" || url === "about:blank";
        return {
          action: "allow",
          overrideBrowserWindowOptions: { webPreferences: panelWebPreferences({ packaged }) },
          createWindow: (options) => makeChild(contents, options && options.webContents, blank),
        };
      }
      if (kind === "external") {
        // Like a link: the browser only for the employee's click on an allowed page (the referrer names the frame
        // that opened it; a frame of another site or a noreferrer pop-up -> the note). A form (POST) is never
        // re-sent as a plain address.
        const ref = d.referrer && typeof d.referrer === "object" ? str(d.referrer.url) : "";
        const post = d.postBody != null;
        refused(url, { user: !post && !!pageUrl(ref) && takeGesture(), canOpen: !post });
      } else warn("chatgpt_panel.popup_denied", { scheme: url.split(":")[0].slice(0, 20) });
      return { action: "deny" };
    });
    contents.on("context-menu", (_event, params) => contextMenu(contents, params));
  }

  // ---- downloads ----
  function refuseDownload(event, why, src, name) {
    event.preventDefault();
    warn("chatgpt_panel.download_refused", { why, ext: extOf(name).slice(0, 12) });
    st.blocked = { host: src || "ChatGPT", external: false, canOpen: false, download: true };
    pending = null;
    blockedOn = pageNoHash();
    push();
  }
  function onDownload(event, item) {
    let url = "";
    try { url = str(item.getURL()); } catch { url = ""; }
    let name = "chatgpt";
    try { name = safeName(item.getFilename()); } catch { /* keep the default */ }
    let gesture = false;
    try { gesture = typeof item.hasUserGesture === "function" && item.hasUserGesture() === true; } catch { gesture = false; }
    const mine = !!menuDownload && menuDownload.url === url && now() - menuDownload.at < 30000;
    if (mine) menuDownload = null;
    const src = downloadSource(url, mine);
    let shown = src;
    if (!shown) { try { const u = new URL(url); shown = u.protocol === "blob:" ? hostOf(u.pathname) : hostOf(url); } catch { shown = null; } }
    if (!src) return refuseDownload(event, "source", shown, name);
    if (!gesture && !mine) return refuseDownload(event, "gesture", shown, name); // a frame or a script nobody clicked
    if (!downloadAllowed(name)) return refuseDownload(event, "type", shown, name);
    const ext = extOf(name);
    // No setSavePath: Electron asks with the save dialog – nothing is written without the employee's choice; the
    // dialog names where the file comes from and keeps its type.
    try {
      item.setSaveDialogOptions({
        title: `Запази файла от ${src}`, buttonLabel: "Запази", defaultPath: path.join(String(documentsDir() || ""), name),
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      });
    } catch { /* the dialog still asks */ }
    let checked = false;
    const savedOk = () => { let p = ""; try { p = str(item.getSavePath()); } catch { p = ""; } return { p, ok: !p || downloadAllowed(path.basename(p)) }; };
    try {
      item.on("updated", () => {
        if (checked) return;
        const s = savedOk();
        if (!s.p) return;
        checked = true;
        if (!s.ok) { warn("chatgpt_panel.download_refused", { why: "saved_type", ext: extOf(s.p).slice(0, 12) }); try { item.cancel(); } catch { /* done */ } }
      });
      item.once("done", (_e, state) => {
        const s = savedOk();
        if (state !== "completed" || !s.p) return;
        if (!s.ok) { warn("chatgpt_panel.download_refused", { why: "saved_type", ext: extOf(s.p).slice(0, 12) }); return; }
        // Mark-of-the-Web, like the app's own exports (files.js): SmartScreen and Office Protected View treat it as
        // downloaded from the internet.
        if (platform === "win32") {
          let host = "about:internet";
          try { const u = new URL(url); if (u.protocol === "https:") host = u.origin + "/"; } catch { /* about:internet */ }
          try { writeFile(`${s.p}:Zone.Identifier`, `${MOTW}HostUrl=${host}\r\n`); } catch (e) { warn("chatgpt_panel.motw_failed", { message: String((e && e.message) || e).slice(0, 80) }); }
        }
      });
    } catch { /* an item without events (tests): the dialog still asks */ }
  }

  function configure(ses) {
    if (configured.has(ses)) return;
    configured.add(ses);
    try { if (typeof ses.setSpellCheckerLanguages === "function") ses.setSpellCheckerLanguages([]); if (typeof ses.setSpellCheckerEnabled === "function") ses.setSpellCheckerEnabled(false); } catch { /* nothing to download either */ }
    if (userAgent) ses.setUserAgent(userAgent, acceptLanguages(locale));
    // The client hints Chrome sends (sec-ch-ua, -mobile, -platform) – the same brands the page's JS sees.
    if (hints && ses.webRequest && typeof ses.webRequest.onBeforeSendHeaders === "function") {
      ses.webRequest.onBeforeSendHeaders({ urls: ["https://*/*"] }, (details, callback) => {
        callback({ requestHeaders: withClientHints(details && details.requestHeaders, hints) });
      });
    }
    ses.setPermissionRequestHandler((contents, permission, callback, details) => {
      const d = details || {};
      callback(panelPermission(permission, d.requestingUrl || d.securityOrigin || (contents && typeof contents.getURL === "function" ? contents.getURL() : "")));
    });
    ses.setPermissionCheckHandler((_contents, permission, origin, details) => panelPermission(permission, origin || (details && (details.requestingUrl || details.securityOrigin)) || ""));
    ses.setDevicePermissionHandler(() => false);
    ses.on("will-download", onDownload);
  }

  function destroyChildren() {
    for (const r of [...children.values()]) destroyChild(r);
    children.clear();
  }

  function destroyView() {
    const c = cur;
    cur = null;
    st.visible = false; st.loading = false; st.host = null; st.error = null; st.blocked = null;
    pending = null; blockedOn = null;
    destroyChildren();
    if (!c) return;
    const win = getWindow();
    try { if (c.attached && win && !win.isDestroyed()) win.contentView.removeChildView(c.view); } catch { /* the window is gone */ }
    try { if (!gone(c)) c.wc.close(); } catch { /* already closed */ }
  }

  function ensureView() {
    const who = owner();
    if (!who) return null;
    const partition = panelPartition(who);
    if (cur && (cur.partition !== partition || gone(cur))) destroyView();
    if (cur) return cur;
    const win = getWindow();
    if (!win || win.isDestroyed()) return null;
    const ses = fromPartition(partition);
    sessions.add(ses);
    configure(ses);
    const view = new WebContentsView({ webPreferences: panelWebPreferences({ session: ses, packaged }) });
    const wc = view.webContents;
    harden(wc); // security.js does it already when the contents is created; this keeps the view safe on its own too
    try { if (userAgent) wc.setUserAgent(userAgent); } catch { /* the session's agent applies */ }
    try { view.setBackgroundColor("#ffffff"); } catch { /* default */ }
    view.setVisible(false);
    const c = { view, wc, partition, attached: false, loaded: false };
    const mine = () => cur === c;
    wc.on("did-start-loading", () => { if (mine()) { st.loading = true; push(); } });
    wc.on("did-stop-loading", () => { if (mine()) { st.loading = false; push(); } });
    wc.on("did-navigate", (_e, url) => { if (mine()) { st.host = hostOf(url); st.error = null; clearBlocked(url, false); push(); } });
    wc.on("did-navigate-in-page", (_e, url, isMainFrame) => { if (mine() && isMainFrame !== false) { st.host = hostOf(url); clearBlocked(url, true); push(); } });
    wc.on("did-fail-load", (_e, code, description, _url, isMainFrame) => {
      if (!mine() || isMainFrame === false || code === -3) return; // -3: aborted (a refused redirect, a new navigation)
      warn("chatgpt_panel.load_failed", { errorCode: code, description: str(description).slice(0, 80) });
      st.error = "ChatGPT не се зареди (" + (str(description) || "грешка " + code) + "). Проверете връзката и натиснете ↻.";
      push();
    });
    wc.on("render-process-gone", (_e, details) => {
      if (!mine()) return;
      warn("chatgpt_panel.renderer_gone", { reason: details && details.reason });
      c.crashed = true;
      st.error = "Страницата на ChatGPT спря. Натиснете ↻, за да я заредите отново.";
      push();
    });
    // Ctrl+Shift+B works from the panel too (focus is in the page there): Ted goes into the bubble.
    wc.on("before-input-event", (event, input) => {
      if (input && input.type === "keyDown" && (input.control || input.meta) && input.shift && !input.alt && (input.code === "KeyB" || str(input.key).toLowerCase() === "b")) {
        event.preventDefault();
        if (typeof onShortcut === "function") onShortcut("bubble");
      }
    });
    if (typeof win.once === "function") win.once("closed", destroyView);
    cur = c;
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
    try { if (win && !win.isDestroyed()) win.contentView.removeChildView(c.view); } catch { /* gone */ }
    c.attached = false;
  }

  function zoom() {
    const win = getWindow();
    try { const z = win && win.webContents && win.webContents.getZoomFactor(); return Number.isFinite(z) && z > 0 ? z : 1; } catch { return 1; }
  }
  // The view shows only while the panel is open, the window is the normal one and the renderer reports a visible,
  // large enough rectangle (it reports visible:false while a menu, dialog, preview or the like would be covered).
  function apply() {
    const c = cur;
    if (!c || gone(c)) { if (st.visible) { st.visible = false; push(); } return; }
    const show = open && mode === "normal" && !!want && want.visible && want.width >= MIN_SIDE && want.height >= MIN_SIDE;
    if (show) {
      const z = zoom();
      const y = Math.max(want.y, TITLE_BAR);
      c.view.setBounds({ x: Math.round(want.x * z), y: Math.round(y * z), width: Math.round(want.width * z), height: Math.round((want.height - (y - want.y)) * z) });
    }
    c.view.setVisible(show);
    if (st.visible !== show) { st.visible = show; push(); }
  }

  function load(c, href) {
    c.loaded = true;
    c.crashed = false;
    st.error = null; st.blocked = null; pending = null; blockedOn = null;
    let viaLink = false;
    try { const u = new URL(href); viaLink = u.hostname === CHATGPT_HOST && u.searchParams.has("q"); } catch { viaLink = false; }
    Promise.resolve(c.wc.loadURL(viaLink ? bootstrapUrl(href) : href)).catch(() => { /* aborted: a refused redirect or a newer navigation */ });
  }

  // url: an address MAIN built (chatgpt-link.js), or null = show the panel as it was (chatgpt.com the first time).
  function openPanel({ url = null } = {}) {
    let target = null;
    if (url != null) {
      target = pageUrl(url);
      if (!target) return { ok: false, code: "invalid", error: "Този адрес не се отваря в панела ChatGPT." };
    }
    if (!owner()) return { ok: false, code: "signed_out", error: "Влезте в CRM, за да отворите ChatGPT." };
    const c = ensureView();
    if (!c) return { ok: false, code: "unavailable", error: "Панелът ChatGPT не можа да се отвори." };
    attach(c);
    open = true;
    if (target) load(c, target.href);
    else if (!c.loaded || c.crashed) load(c, CHATGPT_HOME);
    apply();
    showChildren();
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

  // × / „Назад“: the view leaves the window (the page is kept for the next open); sign-in windows are closed with it.
  function close() {
    open = false;
    want = null;
    apply();
    if (cur) detachView(cur);
    destroyChildren();
    st.blocked = null; pending = null; blockedOn = null;
    push();
    return { ok: true };
  }

  function reload() {
    if (!open) return { ok: false, code: "closed" };
    const c = cur && !gone(cur) ? cur : null;
    if (!c) return openPanel({});
    if (c.crashed || !c.loaded) { load(c, CHATGPT_HOME); return { ok: true }; }
    st.error = null; st.blocked = null; pending = null; blockedOn = null;
    try { c.wc.reload(); } catch { load(c, CHATGPT_HOME); }
    push();
    return { ok: true };
  }

  // The page of the panel in the system browser: the same chatgpt.com address without a prompt parameter (a prompt
  // must never be sent by itself), anything else (a sign-in page) -> chatgpt.com.
  // {blocked:true}: the note's „Отвори в браузъра“ – the https address MAIN refused last (kept here, never sent to the
  // renderer), only now, on the employee's click.
  async function openInBrowser(args) {
    if (args && args.blocked === true) {
      const href = pending;
      if (!href) return { ok: false, code: "none", error: "Няма връзка за отваряне – натиснете я отново в ChatGPT." };
      pending = null;
      lastExternal = now();
      let r = null;
      try { r = await openExternal(href); } catch { r = null; }
      if (st.blocked) st.blocked = { ...st.blocked, external: !!(r && r.ok), canOpen: false };
      push();
      return r && r.ok ? { ok: true } : { ok: false, error: (r && r.error) || "Браузърът не можа да се отвори." };
    }
    let href = CHATGPT_HOME;
    try {
      const u = cur && !gone(cur) ? pageUrl(cur.wc.getURL()) : null;
      if (u && (u.hostname === CHATGPT_HOST || u.hostname.endsWith("." + CHATGPT_HOST))) {
        u.searchParams.delete("q"); u.searchParams.delete("prompt"); u.hash = "";
        href = u.href;
      }
    } catch { href = CHATGPT_HOME; }
    const r = await openExternal(href);
    return r && r.ok ? { ok: true } : { ok: false, error: (r && r.error) || "Браузърът не можа да се отвори." };
  }

  function setWindowMode(m) {
    mode = m === "bubble" || m === "mini" ? m : "normal";
    apply();
    showChildren(); // sign-in windows hide with the panel in the bubble / mini chat and come back with it
  }

  // A CRM sign-in/sign-out: this employee's ChatGPT page leaves the window (its partition stays on disk, his own).
  function detach() {
    open = false;
    want = null;
    destroyView();
    push();
  }

  return {
    owns, harden, open: openPanel, setBounds, close, reload, openInBrowser, setWindowMode, detach, destroy: detach,
    clipboardImage: () => readClipboardImage(clipboard, nativeImage, new Date(now())),
    state, created: () => made, view: () => (cur ? cur.view : null), children: () => [...children.keys()],
  };
}
