// read_page and fetch_image (docs/CONTRACT.md §10.1). GET only, through createBrowser() (SSRF rules, size and time
// caps). Facebook/Instagram and robots.txt are handled like the server's api/_web.js.
import { BrowseError, SOCIAL, SOCIAL_REASON } from "./net.js";
import { decodeBody, extractPage } from "./extract.js";

export const PAGE_MAX_BYTES = 5 * 1048576;
export const IMAGE_MAX_BYTES = 8 * 1048576;
const HTML_TYPES = /^(text\/html|text\/plain|application\/xhtml\+xml)\b/i;

// Magic bytes -> mime of the files fetch_image accepts.
export function sniffMedia(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  if (/^GIF8[79]a$/.test(buf.toString("latin1", 0, 6))) return "image/gif";
  if (buf.toString("latin1", 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

// Parses robots.txt like the server: groups for "*" (and for our own name), Disallow prefixes, "*" wildcards cut.
export function robotsAllows(txt, pathname, agent = "teddesktop") {
  let applies = false;
  let inGroup = false;
  const disallow = [];
  const allow = [];
  for (const line of String(txt).split(/\r?\n/)) {
    const l = line.replace(/#.*/, "").trim();
    if (!l) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(l);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!inGroup) applies = false;
      inGroup = true;
      if (value === "*" || value.toLowerCase().includes(agent)) applies = true;
    } else {
      inGroup = false;
      if (!applies || !value) continue;
      if (key === "disallow") disallow.push(value.replace(/\*.*$/, ""));
      else if (key === "allow") allow.push(value.replace(/\*.*$/, ""));
    }
  }
  const longest = (list) => list.filter((p) => p && pathname.startsWith(p)).reduce((a, b) => Math.max(a, b.length), -1);
  const d = longest(disallow);
  return d < 0 || longest(allow) >= d;
}

export function createPages({ browser, getSettings = () => ({}), now = Date.now }) {
  const robotsCache = new Map(); // origin -> {txt, at}

  async function robotsOk(u, signal) {
    const s = (getSettings() || {}).browse || {};
    if (s.robots === false) return true;
    const cached = robotsCache.get(u.origin);
    let txt = cached && now() - cached.at < 3600_000 ? cached.txt : null;
    if (txt == null) {
      try {
        const r = await browser.get(`${u.origin}/robots.txt`, { maxBytes: 512 * 1024, timeoutMs: 5000, accept: "text/plain", signal });
        txt = r.status >= 200 && r.status < 300 ? decodeBody(r.buffer, r.contentType) : "";
      } catch {
        txt = ""; // no robots.txt (or unreachable): allowed, as on the server
      }
      robotsCache.set(u.origin, { txt, at: now() });
      if (robotsCache.size > 200) robotsCache.delete(robotsCache.keys().next().value);
    }
    return robotsAllows(txt, u.pathname + u.search);
  }

  // -> {ok:true, url, title, text, truncated, links, images, phones, emails, prices}
  //  | {ok:true, file:{buffer, mime, name, sourceUrl}} for a PDF  | {ok:false, code, error}
  async function readPage({ url, maxChars = 20000 } = {}, { signal } = {}) {
    let u;
    try { u = new URL(String(url)); } catch { return { ok: false, code: "invalid_url", error: "Невалиден адрес." }; }
    if (SOCIAL.test(u.hostname)) return { ok: false, code: "social", blocked: true, error: SOCIAL_REASON };
    const limit = Math.max(1000, Math.min(40000, Number(maxChars) || 20000));
    try {
      if (!(await robotsOk(u, signal))) return { ok: false, code: "robots", blocked: true, error: "Сайтът забранява автоматично четене на тази страница (robots.txt)." };
      const r = await browser.get(u.href, { maxBytes: PAGE_MAX_BYTES, timeoutMs: 20_000, accept: "text/html,application/xhtml+xml,text/plain;q=0.9,application/pdf;q=0.8,*/*;q=0.5", signal });
      if (r.status >= 400) return { ok: false, code: "http", error: `Страницата върна грешка ${r.status}.`, url: r.url };
      const media = sniffMedia(r.buffer);
      if (media === "application/pdf" || /application\/pdf/i.test(r.contentType)) {
        return { ok: true, url: r.url, file: { buffer: r.buffer, mime: "application/pdf", name: nameFromUrl(r.url, "pdf"), sourceUrl: r.url } };
      }
      if (r.contentType && !HTML_TYPES.test(r.contentType) && media) {
        return { ok: false, code: "not_html", error: "Това е снимка, не страница – използвай fetch_image.", url: r.url };
      }
      if (r.contentType && !HTML_TYPES.test(r.contentType)) return { ok: false, code: "not_html", error: `Страницата не е текст (${r.contentType.split(";")[0]}).`, url: r.url };
      const html = decodeBody(r.buffer, r.contentType);
      return { ok: true, url: r.url, ...extractPage(html, r.url, limit) };
    } catch (e) {
      if (e instanceof BrowseError) return { ok: false, code: e.code, error: e.message };
      throw e;
    }
  }

  // -> {ok:true, file:{buffer, mime, name, sourceUrl}} | {ok:false, code, error}
  async function fetchImage({ url } = {}, { signal } = {}) {
    let u;
    try { u = new URL(String(url)); } catch { return { ok: false, code: "invalid_url", error: "Невалиден адрес." }; }
    if (SOCIAL.test(u.hostname) && !/(^|\.)(fbcdn\.net|cdninstagram\.com)$/i.test(u.hostname)) return { ok: false, code: "social", error: SOCIAL_REASON };
    try {
      const r = await browser.get(u.href, { maxBytes: IMAGE_MAX_BYTES, timeoutMs: 20_000, accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,application/pdf;q=0.9", signal });
      if (r.status >= 400) return { ok: false, code: "http", error: `Адресът върна грешка ${r.status}.` };
      const mime = sniffMedia(r.buffer);
      if (!mime) return { ok: false, code: "not_image", error: "Това не е снимка (JPEG, PNG, WEBP, GIF) или PDF." };
      return { ok: true, file: { buffer: r.buffer, mime, name: nameFromUrl(r.url, mime.split("/")[1].replace("jpeg", "jpg")), sourceUrl: r.url } };
    } catch (e) {
      if (e instanceof BrowseError) return { ok: false, code: e.code, error: e.message };
      throw e;
    }
  }

  return { readPage, fetchImage, robotsOk };
}

export function nameFromUrl(url, ext) {
  let base = "";
  try {
    const u = new URL(url);
    base = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || u.hostname);
  } catch { base = "файл"; }
  base = base.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 80) || "файл";
  return `${base}.${ext}`;
}
