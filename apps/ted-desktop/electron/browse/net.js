// Internet access of the agent (docs/CONTRACT.md §10.1): GET requests from the user's PC to public web pages, in
// MAIN, through Electron net on the separate in-memory session "ted-browse". This module never carries a CRM or
// OpenAI token: http.js (with its host allowlist for token-bearing calls) is not used here at all.
//
// Every hop is checked before it is sent: http/https only, no credentials in the URL, ports 80/443/8080/8443,
// a public-looking host name, and every address the name resolves to must be public (no loopback, private,
// link-local, CGNAT, multicast/reserved or IPv4-mapped forms of these). In the program the check runs inside the
// session's webRequest.onBeforeRequest (so redirects followed by Chromium are checked too, ≤ 5 hops). DNS-rebinding
// guard: the address Chromium actually connected to (webRequest onBeforeRedirect / onResponseStarted, every hop) is
// checked as soon as it is known – a private one aborts the fetch before any body is read and cancels the next hop.
// Residual risk (README): that address is known only after the request was sent, so a blind request to a local
// service can still leave; behind a proxy, names are resolved by the proxy and the connected address is the
// proxy's, so only the pre-resolve check applies. Results are untrusted data.
import dns from "node:dns";
import net from "node:net";

export const MAX_REDIRECTS = 5;
const PORTS = new Set(["", "80", "443", "8080", "8443"]);
const BAD_SUFFIX = /\.(local|lan|internal|home|corp|localhost|arpa|intranet|private|test|invalid|example)$/i;
export const SOCIAL = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com)$/i;
export const SOCIAL_REASON = "Facebook/Instagram изискват вход в профил – страницата не може да се прочете автоматично. Копирайте текста на поста или направете снимка на екрана и я прикачете.";

export class BrowseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BrowseError";
    this.code = code;
  }
}

function v4ToInt(ip) {
  const p = ip.split(".").map(Number);
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}
const inV4 = (n, base, bits) => bits === 0 || (n >>> (32 - bits)) === (v4ToInt(base) >>> (32 - bits));
const V4_BLOCKED = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function expandV6(ip) {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const n = v4ToInt(v4[1]);
    s = s.slice(0, -v4[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.includes("::") ? s.split("::") : [s, null];
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const fill = tail === null ? [] : Array(8 - h.length - t.length).fill("0");
  return [...h, ...fill, ...t].map((x) => parseInt(x || "0", 16));
}

// True for every address that is not plainly public unicast.
export function isPrivateIp(ip) {
  const kind = net.isIP(String(ip).replace(/^\[|\]$/g, "").split("%")[0]);
  if (kind === 4) {
    const n = v4ToInt(ip);
    return V4_BLOCKED.some(([base, bits]) => inV4(n, base, bits));
  }
  if (kind === 6) {
    const w = expandV6(ip);
    if (w.length !== 8 || w.some((x) => !Number.isFinite(x))) return true;
    if (w.every((x) => x === 0)) return true; // ::
    if (w.slice(0, 7).every((x) => x === 0) && w[7] === 1) return true; // ::1
    // IPv4-mapped ::ffff:a.b.c.d, IPv4-compatible ::a.b.c.d, NAT64 64:ff9b::/96 -> check the IPv4 part
    if ((w.slice(0, 5).every((x) => x === 0) && (w[5] === 0xffff || w[5] === 0)) || (w[0] === 0x64 && w[1] === 0xff9b && w.slice(2, 6).every((x) => x === 0))) {
      const v4 = `${w[6] >> 8}.${w[6] & 255}.${w[7] >> 8}.${w[7] & 255}`;
      return isPrivateIp(v4);
    }
    if ((w[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((w[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((w[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
    if ((w[0] & 0xff00) === 0xff00) return true; // multicast
    if (w[0] === 0x2001 && w[1] === 0x0db8) return true; // documentation
    if (w[0] === 0x2002) return isPrivateIp(`${w[1] >> 8}.${w[1] & 255}.${w[2] >> 8}.${w[2] & 255}`); // 6to4
    if (w[0] === 0x2001 && w[1] === 0) return true; // Teredo
    return false;
  }
  return true;
}

export function hostBlocked(hostname, blocked = []) {
  const h = String(hostname).toLowerCase().replace(/\.$/, "");
  return blocked.some((b) => {
    const x = String(b || "").toLowerCase().trim().replace(/^\*?\./, "").replace(/\.$/, "");
    return x && (h === x || h.endsWith("." + x));
  });
}

// Static checks of one URL (no DNS). -> URL; throws BrowseError.
export function checkUrl(value, { blocked = [] } = {}) {
  let u;
  try { u = new URL(String(value)); } catch { throw new BrowseError("invalid_url", "Невалиден адрес."); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new BrowseError("invalid_url", "Разрешени са само http и https адреси.");
  if (u.username || u.password) throw new BrowseError("invalid_url", "Адреси с потребител и парола не се отварят.");
  if (!PORTS.has(u.port)) throw new BrowseError("blocked", "Този порт не е разрешен (само 80, 443, 8080, 8443).");
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (net.isIP(host.replace(/^\[|\]$/g, ""))) {
    if (isPrivateIp(host)) throw new BrowseError("private", "Адреси от локалната мрежа и на този компютър не се отварят.");
  } else if (!host.includes(".") || BAD_SUFFIX.test(host) || !/^[a-z0-9.-]+$/i.test(host) || host.length > 253) {
    throw new BrowseError("private", "Това не е публичен адрес в интернет.");
  }
  if (hostBlocked(host, blocked)) throw new BrowseError("blocked", "Сайтът е в списъка със забранени (Настройки → Браузър).");
  return u;
}

// checkUrl + DNS: every resolved address must be public.
export async function checkTarget(value, { blocked = [], lookup = dns.promises.lookup } = {}) {
  const u = checkUrl(value, { blocked });
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) return u;
  let addrs;
  try {
    addrs = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new BrowseError("dns", `Адресът „${host}“ не може да бъде намерен.`);
  }
  const list = (Array.isArray(addrs) ? addrs : [addrs]).map((a) => (typeof a === "string" ? a : a && a.address)).filter(Boolean);
  if (!list.length) throw new BrowseError("dns", `Адресът „${host}“ не може да бъде намерен.`);
  if (list.some(isPrivateIp)) throw new BrowseError("private", "Адресът води към локалната мрежа или към този компютър и не се отваря.");
  return u;
}

// The session guard installed by main.js on the "ted-browse" partition.
// onBeforeRequest: checks every request and every redirect hop Chromium follows (≤ 5 per request id; checked
// with Electron 45: session.fetch with redirect "follow" passes each hop through it, and a cancel ends the fetch
// with net::ERR_BLOCKED_BY_CLIENT). onBeforeRedirect/onResponseStarted: the final address of a request and the
// IP Chromium connected to (session.fetch answers carry no `url`, so the browser asks resolved()).
// onBeforeSendHeaders strips credentials and the page origin for any other request of the session; requests of
// session.fetch do not pass through that hook (checked with Electron 45), so createBrowser itself never sets
// Authorization, Cookie, Origin or Referer and always fetches with credentials "omit".
export function createSessionGuard({ getSettings = () => ({}), lookup = dns.promises.lookup, log, now = Date.now } = {}) {
  const hops = new Map(); // request id -> redirects so far
  const poisoned = new Set(); // request ids that connected to a private address: every further hop is cancelled
  const watchers = new Map(); // first URL -> Set(fn(ip) -> false to ignore, e.g. behind a proxy)
  const ips = new Map(); // url -> {ip, at}
  const firstUrl = new Map(); // request id -> the URL it started with
  const ends = new Map(); // first URL -> {url, ip, at} of the latest hop
  const blockedHosts = () => {
    const b = (getSettings() || {}).browse;
    return b && Array.isArray(b.blocked) ? b.blocked : [];
  };

  const remember = (map, key, value) => {
    map.set(key, value);
    if (map.size > 500) map.delete(map.keys().next().value);
  };

  async function beforeRequest(details) {
    const id = details && details.id;
    if (id != null && !firstUrl.has(id)) remember(firstUrl, id, String(details.url));
    const n = hops.get(id) || 0;
    if (n > MAX_REDIRECTS || poisoned.has(id)) return { cancel: true };
    try {
      await checkTarget(details.url, { blocked: blockedHosts(), lookup });
      return {};
    } catch (e) {
      if (log) log.warn("browse.blocked", { code: e.code, host: (() => { try { return new URL(details.url).hostname; } catch { return ""; } })() });
      return { cancel: true };
    }
  }
  // The connected address of a hop (redirect or answer): a private one is reported to the fetch that started it.
  function connected(details) {
    if (!details || !details.ip || !isPrivateIp(String(details.ip))) return;
    const start = firstUrl.get(details.id);
    const fns = start && watchers.get(start);
    let act = false; // only fetches of createBrowser are watched (they know whether they went DIRECT)
    if (fns) for (const fn of fns) { try { if (fn(String(details.ip)) !== false) act = true; } catch { act = true; } }
    if (act) {
      if (details.id != null) poisoned.add(details.id);
      if (log) log.warn("browse.rebinding", { host: (() => { try { return new URL(details.url).hostname; } catch { return ""; } })() });
    }
  }
  function beforeRedirect(details) {
    hops.set(details.id, (hops.get(details.id) || 0) + 1);
    const start = firstUrl.get(details.id);
    if (start && details.redirectURL) remember(ends, start, { url: String(details.redirectURL), ip: null, at: now() });
    connected(details);
  }
  function responseStarted(details) {
    if (details && details.url && details.ip) remember(ips, details.url, { ip: String(details.ip), at: now() });
    const start = details && firstUrl.get(details.id);
    if (start && details.url) remember(ends, start, { url: String(details.url), ip: details.ip ? String(details.ip) : null, at: now() });
    connected(details);
  }
  function finished(details) {
    hops.delete(details && details.id);
    firstUrl.delete(details && details.id);
    poisoned.delete(details && details.id);
  }
  // createBrowser registers the URL it is about to fetch; fn(ip) is called when that fetch (or any of its hops)
  // connects to a private address. -> unwatch()
  function watch(url, fn) {
    const key = String(url);
    if (!watchers.has(key)) watchers.set(key, new Set());
    watchers.get(key).add(fn);
    return () => { const set = watchers.get(key); if (set) { set.delete(fn); if (!set.size) watchers.delete(key); } };
  }
  // -> {url (final, after redirects), ip} of the latest request that started at `url`, or null.
  const resolved = (url) => {
    const e = ends.get(url);
    return e && now() - e.at < 120_000 ? { url: e.url, ip: e.ip } : null;
  };
  // Removes credentials, cookies and the page origin from every request of the session.
  function beforeSendHeaders(details) {
    const headers = { ...(details.requestHeaders || {}) };
    for (const k of Object.keys(headers)) if (/^(authorization|cookie|origin|referer)$/i.test(k)) delete headers[k];
    return { requestHeaders: headers };
  }
  const ipOf = (url) => {
    const e = ips.get(url);
    return e && now() - e.at < 120_000 ? e.ip : null;
  };

  function install(webRequest) {
    webRequest.onBeforeRequest((details, cb) => { beforeRequest(details).then(cb, () => cb({ cancel: true })); });
    webRequest.onBeforeSendHeaders((details, cb) => cb(beforeSendHeaders(details)));
    webRequest.onBeforeRedirect((details) => beforeRedirect(details));
    webRequest.onResponseStarted((details) => responseStarted(details));
    webRequest.onCompleted((details) => { responseStarted(details); finished(details); });
    webRequest.onErrorOccurred((details) => finished(details));
  }
  return { install, beforeRequest, beforeRedirect, responseStarted, beforeSendHeaders, finished, ipOf, resolved, watch };
}

// Reads a response body with a byte cap. -> Buffer; throws BrowseError("too_large").
export async function readCapped(res, maxBytes, signal) {
  const len = Number(res.headers && (typeof res.headers.get === "function" ? res.headers.get("content-length") : res.headers["content-length"]));
  if (Number.isFinite(len) && len > maxBytes) throw new BrowseError("too_large", `Файлът е твърде голям (над ${Math.round(maxBytes / 1048576)} MB).`);
  if (!res.body || typeof res.body.getReader !== "function") {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new BrowseError("too_large", `Файлът е твърде голям (над ${Math.round(maxBytes / 1048576)} MB).`);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  const stop = () => reader.cancel().catch(() => {});
  signal?.addEventListener("abort", stop, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) { stop(); throw new BrowseError("too_large", `Файлът е твърде голям (над ${Math.round(maxBytes / 1048576)} MB).`); }
      chunks.push(Buffer.from(value));
    }
  } finally {
    signal?.removeEventListener("abort", stop);
  }
  return Buffer.concat(chunks);
}

// fetchImpl(url, init) = the ted-browse session fetch (redirects followed by Chromium, each hop checked by the
// session guard). Tests inject a fake fetch that may answer 3xx; those redirects are followed here, checked hop
// by hop with the same rules. resolveProxy(url) -> "DIRECT" | "PROXY …"; ipOf(url) -> connected IP or null.
// watch(url, fn) = the session guard's watch (fn(ip) when a hop of that fetch connected to a private address).
export function createBrowser({ fetchImpl, lookup = dns.promises.lookup, getSettings = () => ({}), userAgent = "TedDesktop", resolveProxy = async () => "DIRECT", ipOf = () => null, resolved = () => null, watch = () => () => {}, log }) {
  const blockedHosts = () => {
    const b = (getSettings() || {}).browse;
    return b && Array.isArray(b.blocked) ? b.blocked : [];
  };

  // -> {url, status, contentType, buffer}
  async function get(url, { maxBytes = 5 * 1048576, timeoutMs = 20_000, accept = "*/*", signal } = {}) {
    let target = await checkTarget(url, { blocked: blockedHosts(), lookup });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const onAbort = () => ctl.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    let rebound = false;
    const unwatch = [];
    const isDirect = async (u) => { try { return /^DIRECT\b/i.test(String(await resolveProxy(u)) || "DIRECT"); } catch { return true; } };
    const rebinding = () => {
      if (log) log.warn("browse.rebinding", { host: (() => { try { return new URL(target.href).hostname; } catch { return ""; } })() });
      return new BrowseError("private", "Адресът се оказа в локалната мрежа – резултатът е отхвърлен.");
    };
    try {
      for (let hop = 0; ; hop++) {
        let res;
        // Behind a proxy the connected address is the proxy's: then only the pre-resolve check applies.
        const directHop = await isDirect(target.href);
        unwatch.push(watch(target.href, () => {
          if (!directHop) return false;
          rebound = true;
          ctl.abort();
          return true;
        }));
        try {
          res = await fetchImpl(target.href, {
            method: "GET", signal: ctl.signal, redirect: "follow", credentials: "omit", cache: "no-store",
            headers: { "User-Agent": userAgent, "Accept-Language": "bg,en;q=0.8", Accept: accept },
          });
        } catch (e) {
          if (rebound) throw rebinding();
          if (ctl.signal.aborted) throw new BrowseError(signal?.aborted ? "aborted" : "timeout", signal?.aborted ? "Спряно." : "Страницата не отговори навреме.");
          const msg = String((e && e.message) || "");
          // The session guard cancelled a hop (private address, blocked site or too many redirects).
          if (/ERR_BLOCKED_BY_CLIENT/.test(msg)) throw new BrowseError("blocked", "Адресът е блокиран: локална мрежа, забранен сайт или твърде много пренасочвания.");
          throw new BrowseError("network", `Страницата не може да се отвори (${(msg || "мрежова грешка").replace(/^net::/, "").slice(0, 60)}).`);
        }
        if (rebound) throw rebinding();
        const loc = res.headers && (typeof res.headers.get === "function" ? res.headers.get("location") : res.headers.location);
        if (res.status >= 300 && res.status < 400 && loc) {
          if (hop >= MAX_REDIRECTS) throw new BrowseError("redirects", "Твърде много пренасочвания.");
          target = await checkTarget(new URL(loc, target.href).href, { blocked: blockedHosts(), lookup });
          continue;
        }
        const end = resolved(target.href);
        const finalUrl = res.url || (end && end.url) || target.href;
        // The final address after Chromium's own redirects must pass the same rules.
        await checkTarget(finalUrl, { blocked: blockedHosts(), lookup });
        const direct = await isDirect(finalUrl);
        // Checked BEFORE the body is read (the guard has the connected address once the answer started).
        const early = direct ? (end && end.ip) || ipOf(finalUrl) : null;
        if (rebound || (early && isPrivateIp(early))) throw rebinding();
        let buffer;
        try {
          buffer = await readCapped(res, maxBytes, ctl.signal);
        } catch (e) {
          if (rebound) throw rebinding();
          throw e;
        }
        const ip = direct ? (resolved(target.href) || {}).ip || ipOf(finalUrl) : null;
        if (rebound || (ip && isPrivateIp(ip))) throw rebinding();
        const ct = res.headers && (typeof res.headers.get === "function" ? res.headers.get("content-type") : res.headers["content-type"]);
        return { url: finalUrl, status: res.status, contentType: String(ct || ""), buffer };
      }
    } catch (e) {
      if (e instanceof BrowseError) throw e;
      if (rebound) throw rebinding();
      if (ctl.signal.aborted) throw new BrowseError(signal?.aborted ? "aborted" : "timeout", signal?.aborted ? "Спряно." : "Страницата не отговори навреме.");
      throw new BrowseError("network", "Страницата не може да се отвори.");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      for (const u of unwatch) u();
    }
  }
  return { get };
}
