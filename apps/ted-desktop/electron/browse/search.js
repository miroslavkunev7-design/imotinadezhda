// web_search: the DuckDuckGo HTML endpoint, parsed locally (no API key). Bing/Google result pages are never
// fetched (their terms forbid scraping). A challenge or rate-limit page is reported honestly.
import { BrowseError } from "./net.js";
import { decodeBody, decodeEntities } from "./extract.js";

export const SEARCH_URL = "https://html.duckduckgo.com/html/";
export const RATE_LIMITED = "Търсачката временно ограничи заявките – опитайте след малко.";

const clean = (html) => decodeEntities(String(html).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

// DuckDuckGo wraps result links as //duckduckgo.com/l/?uddg=<encoded url>&rut=…; ads go through y.js.
export function resultUrl(href) {
  const raw = decodeEntities(String(href || ""));
  try {
    const u = new URL(raw, "https://duckduckgo.com");
    if (/(^|\.)duckduckgo\.com$/.test(u.hostname)) {
      if (u.pathname === "/y.js") return null; // advertisement
      const target = u.searchParams.get("uddg");
      if (!target) return null;
      const t = new URL(target);
      return t.protocol === "http:" || t.protocol === "https:" ? t.href : null;
    }
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function isChallenge(status, html) {
  return status === 202 || status === 403 || status === 429 || /anomaly(\.js|-modal)|bots use DuckDuckGo|challenge-form/i.test(String(html).slice(0, 200_000));
}

// -> [{title, url, snippet}]
export function parseResults(html, n = 8) {
  const out = [];
  const seen = new Set();
  const blocks = String(html).split(/<div[^>]+class="[^"]*\bresult\b/).slice(1);
  for (const block of blocks) {
    const head = block.slice(0, 200);
    if (/result--ad\b/.test(head)) continue;
    const a = /<a[^>]+class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
      /<a[^>]+href="([^"]+)"[^>]+class="[^"]*\bresult__a\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    if (!a) continue;
    const url = resultUrl(a[1]);
    if (!url || seen.has(url)) continue;
    const sn = /<(?:a|div|td)[^>]+class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/i.exec(block);
    seen.add(url);
    out.push({ title: clean(a[2]).slice(0, 200), url, snippet: sn ? clean(sn[1]).slice(0, 400) : "" });
    if (out.length >= n) break;
  }
  return out;
}

// browser = createBrowser(); -> {ok:true, query, results} | {ok:false, code, error}
export async function webSearch(browser, { query, n = 8 } = {}, { signal } = {}) {
  const q = String(query || "").replace(/\s+/g, " ").trim();
  if (!q || q.length > 300) return { ok: false, code: "invalid", error: "Въведете какво да търся (до 300 знака)." };
  const count = Math.max(1, Math.min(10, Number(n) || 8));
  let page;
  try {
    page = await browser.get(`${SEARCH_URL}?q=${encodeURIComponent(q)}&kl=bg-bg`, { maxBytes: 2 * 1048576, timeoutMs: 20_000, accept: "text/html", signal });
  } catch (e) {
    if (e instanceof BrowseError) return { ok: false, code: e.code, error: e.message };
    throw e;
  }
  const html = decodeBody(page.buffer, page.contentType);
  if (isChallenge(page.status, html)) return { ok: false, code: "rate_limited", error: RATE_LIMITED };
  if (page.status >= 400) return { ok: false, code: "http", error: `Търсачката върна грешка ${page.status}.` };
  const results = parseResults(html, count);
  return { ok: true, query: q, engine: "DuckDuckGo", results, ...(results.length ? {} : { note: "Няма намерени резултати." }) };
}
