// HTML -> clean text, title, links, image URLs, phones, e-mails and prices (read_page, read_document for .html).
// Pure functions without network; the same rules as the server's api/_web.js readPage, plus contact extraction.

// Charset from the Content-Type header or the first <meta> of the page; windows-1251 is common on .bg sites.
export function detectCharset(buffer, contentType = "") {
  const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(String(contentType || ""));
  if (fromHeader) return fromHeader[1].toLowerCase();
  const head = Buffer.from(buffer.subarray(0, 4096)).toString("latin1");
  const meta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head);
  if (meta) return meta[1].toLowerCase();
  if (head.charCodeAt(0) === 0xef && head.charCodeAt(1) === 0xbb && head.charCodeAt(2) === 0xbf) return "utf-8";
  return "utf-8";
}

export function decodeBody(buffer, contentType) {
  let charset = detectCharset(buffer, contentType);
  if (charset === "cp1251" || charset === "win-1251") charset = "windows-1251";
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", laquo: "«", raquo: "»", bdquo: "„", ldquo: "“", rdquo: "”", hellip: "…", euro: "€", copy: "©", reg: "®", deg: "°", sup2: "²", times: "×", middot: "·", bull: "•" };
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,8});/gi, (m, e) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp < 0x110000 && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : "";
    }
    return Object.hasOwn(NAMED, e.toLowerCase()) ? NAMED[e.toLowerCase()] : m;
  });
}

// Every pass here is linear in the input: a hostile page (an unclosed „<!--“, thousands of „<script“ or „<a“
// without their end, „1,111,111…“ without a currency) must never block MAIN's event loop. Comments and
// script/style/… are cut by an indexOf scan (unclosed → the rest is cut, as a browser would hide it); tag patterns
// stop at the next „<“ ([^<>]) and repetitions are bounded.
export const MAX_HTML = 6 * 1048576;
const HIDDEN = new Set(["script", "style", "noscript", "template", "svg", "head", "iframe"]);
const NAME_CHAR = /[a-z0-9-]/i;
export function stripInvisible(html) {
  const s = String(html).slice(0, MAX_HTML);
  const lower = s.toLowerCase();
  const out = []; // pieces joined once at the end (no long chains of string concatenation)
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) { out.push(s.slice(i)); break; }
    if (s.startsWith("<!--", lt)) {
      out.push(s.slice(i, lt), " ");
      const end = s.indexOf("-->", lt + 4);
      if (end < 0) break;
      i = end + 3;
      continue;
    }
    let j = lt + 1;
    while (j < s.length && j - lt < 20 && NAME_CHAR.test(s[j])) j++;
    const name = lower.slice(lt + 1, j);
    if (!HIDDEN.has(name)) { out.push(s.slice(i, j)); i = j; continue; }
    out.push(s.slice(i, lt), " ");
    // The matching end tag (not „</header“ for „<head“).
    let from = j;
    let end = -1;
    for (;;) {
      end = lower.indexOf(`</${name}`, from);
      if (end < 0 || !NAME_CHAR.test(lower[end + 2 + name.length] || "")) break;
      from = end + 2;
    }
    if (end < 0) {
      // <head> may legally stay open: drop only its tag. Every other hidden element hides the rest of the page.
      if (name === "head") { const gt = s.indexOf(">", j); i = gt < 0 ? s.length : gt + 1; continue; }
      break;
    }
    const gt = s.indexOf(">", end);
    i = gt < 0 ? s.length : gt + 1;
  }
  return out.join("");
}

export function htmlToText(html, maxChars = 40000) {
  const text = decodeEntities(stripInvisible(html)
    .replace(/<\/?(br|p|div|li|tr|h\d|section|article|header|footer|table|ul|ol|dt|dd|blockquote|pre)\b[^<>]*>/gi, "\n")
    .replace(/<t[dh]\b[^<>]*>/gi, "")
    .replace(/<\/t[dh]>/gi, "\t")
    .replace(/<[^<>]*>/g, " "))
    .replace(/ /g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/ *\t[ \t]*/g, "\t")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n +/g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)(\?|#|$)/i;
const NOT_PHOTO = /logo|icon|sprite|avatar|banner|pixel|placeholder|blank\.|spacer|loader|favicon/i;

function absolute(raw, base) {
  try {
    const u = new URL(decodeEntities(String(raw).trim()), base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? m[2] ?? m[3] ?? m[4] ?? "" : null;
};

export function extractImages(html, base, max = 60) {
  const out = new Set();
  const add = (u) => { if (u && !NOT_PHOTO.test(u) && out.size < max) out.add(u); };
  for (const m of String(html).slice(0, MAX_HTML).matchAll(/<meta\b[^<>]{0,4000}>/gi)) {
    const p = attr(m[0], "property") || attr(m[0], "name") || "";
    if (/^(og:image|twitter:image)$/i.test(p)) add(absolute(attr(m[0], "content") || "", base));
  }
  for (const m of String(html).slice(0, MAX_HTML).matchAll(/<(img|source)\b[^<>]{0,8000}>/gi)) {
    for (const name of ["data-src", "data-lazy", "data-original", "src"]) {
      const v = attr(m[0], name);
      const u = v && absolute(v, base);
      if (u && IMAGE_EXT.test(u)) { add(u); break; }
    }
    const set = attr(m[0], "srcset") || attr(m[0], "data-srcset");
    if (set) {
      const best = set.split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean).pop();
      const u = best && absolute(best, base);
      if (u && IMAGE_EXT.test(u)) add(u);
    }
  }
  return [...out];
}

// <a …>text</a>: the opening tag by a bounded pattern, its text up to the next „</a“ found by a forward-only
// pointer (so thousands of unclosed <a> stay linear); text further than 2000 characters away is not taken.
export function extractLinks(html, base, max = 200) {
  const seen = new Map();
  const s = String(html).slice(0, MAX_HTML);
  const lower = s.toLowerCase();
  let close = -2; // index of the next "</a" at or after the current tag; -1 = none left
  for (const m of s.matchAll(/<a\b[^<>]{0,4000}>/gi)) {
    const start = m.index + m[0].length;
    if (close !== -1 && close < start) close = lower.indexOf("</a", start);
    const inner = close >= 0 && close - start <= 2000 ? s.slice(start, close) : "";
    const href = attr(m[0], "href");
    if (!href || href.startsWith("#") || /^(javascript|mailto|tel):/i.test(href)) continue;
    const url = absolute(href, base);
    if (!url || seen.has(url)) continue;
    const text = decodeEntities(inner.replace(/<[^<>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 100);
    seen.set(url, text);
    if (seen.size >= max) break;
  }
  return [...seen].map(([url, text]) => (text ? { url, text } : { url }));
}

// Bulgarian phone numbers -> "+359XXXXXXXX(X)". National numbers start with 0 and have 8 or 9 more digits.
export function normalizePhone(raw) {
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("359")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("0")) return null;
  return d.length === 8 || d.length === 9 ? `+359${d}` : null;
}

const PHONE_PATTERNS = [
  /(?:\+|\b00)359[\s\-./()]{0,3}\d(?:[\s\-./()]{0,2}\d){7,8}\b/g,
  /(?<![\d.,+])0[2-9](?:[\s\-./]?\d){7,8}\b/g,
];
const DATE_LIKE = /^\d{1,2}[./]\d{1,2}[./]\d{2,4}/;

// -> normalised numbers in the order they appear in the text.
export function extractPhones(text, max = 30) {
  const found = [];
  const s = String(text);
  for (const re of PHONE_PATTERNS) {
    for (const m of s.matchAll(re)) {
      if (DATE_LIKE.test(m[0])) continue;
      const p = normalizePhone(m[0]);
      if (p) found.push([m.index, p]);
    }
  }
  // "тел.: 888 123 456", "GSM 0888…", "моб. 359 …": a number within 30 characters after the word.
  for (const m of s.matchAll(/(тел|tel|gsm|моб|mob|phone|телефон)[^\d+]{0,30}([+\d][\d\s\-./()]{6,20}\d)/gi)) {
    const digits = m[2].replace(/\D/g, "");
    const p = normalizePhone(digits.length === 9 && /^[89]/.test(digits) ? `0${digits}` : m[2]);
    if (p) found.push([m.index + m[0].length - m[2].length, p]);
  }
  const out = [];
  for (const [, p] of found.sort((a, b) => a[0] - b[0])) {
    if (!out.includes(p)) out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

export function extractEmails(text, max = 20) {
  const out = new Set();
  for (const m of String(text).matchAll(/[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,200}\.[A-Za-z]{2,24}\b/g)) {
    const e = m[0].toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg)$/.test(e) || /@\d+x\./.test(e)) continue;
    out.add(e);
    if (out.size >= max) break;
  }
  return [...out];
}

// Bounded repetitions: „1,111,111,…“ without a currency must not backtrack over the whole run from every comma.
const NUM = "\\d{1,3}(?:[ \\u00a0.,]\\d{3}){1,5}(?:[.,]\\d{1,2})?|\\d{1,12}(?:[.,]\\d{1,2})?";
const CUR = "€|EUR|евро|лв\\.?|лева|BGN|\\$|USD";
export function extractPrices(text, max = 30) {
  const out = new Set();
  const s = String(text).replace(/ /g, " ");
  const after = new RegExp(`(?:^|[^\\d])(${NUM})\\s?(${CUR})(?![A-Za-zА-Яа-я])`, "gi");
  const before = new RegExp(`(€|EUR|\\$|USD|BGN)\\s?(${NUM})`, "gi");
  for (const m of s.matchAll(after)) {
    out.add(`${m[1].trim()} ${m[2]}`);
    if (out.size >= max) return [...out];
  }
  for (const m of s.matchAll(before)) {
    out.add(`${m[2].trim()} ${m[1]}`);
    if (out.size >= max) return [...out];
  }
  for (const m of s.matchAll(new RegExp(`цена[^\\d]{0,20}(${NUM})`, "gi"))) {
    if ([...out].some((p) => p.startsWith(m[1].trim()))) continue;
    out.add(m[1].trim());
    if (out.size >= max) break;
  }
  return [...out];
}

export function extractTitle(html) {
  const s = String(html).slice(0, MAX_HTML);
  const lower = s.toLowerCase();
  let title = "";
  const at = lower.indexOf("<title");
  if (at >= 0) {
    const gt = s.indexOf(">", at);
    const end = gt < 0 ? -1 : lower.indexOf("</title", gt);
    if (end >= 0) title = s.slice(gt + 1, Math.min(end, gt + 1 + 4000));
  }
  if (!title.trim()) {
    for (const m of s.matchAll(/<meta\b[^<>]{0,4000}>/gi)) {
      if (/^og:title$/i.test(attr(m[0], "property") || "")) { title = attr(m[0], "content") || ""; break; }
    }
  }
  return decodeEntities(title.replace(/\s+/g, " ")).trim().slice(0, 300);
}

export function extractPage(html, base, maxChars = 20000) {
  const full = htmlToText(html, 400000);
  const text = full.slice(0, maxChars);
  return {
    title: extractTitle(html),
    text,
    truncated: full.length > text.length,
    links: extractLinks(html, base),
    images: extractImages(html, base),
    phones: extractPhones(full),
    emails: extractEmails(`${full} ${(String(html).match(/mailto:[^"'>\s]+/gi) || []).map((m) => decodeEntities(m.slice(7))).join(" ")}`),
    prices: extractPrices(full),
  };
}
