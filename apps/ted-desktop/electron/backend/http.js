// The single network egress of the app: Node's global fetch behind a host allowlist.
// Never sets Origin/Referer (the production login rejects foreign origins), never follows
// redirects, never retries. Timeouts and caller aborts map to typed errors.
import { ALLOWED_HOSTS } from "./config.js";

export class HttpError extends Error {
  // sent=false: the request certainly never reached the server (safe to say "nothing ran").
  constructor(code, message, sent) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.sent = sent;
  }
}

// Failures that happen before a connection exists (DNS, refused, unreachable, TLS trust).
const NOT_SENT = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "ENETDOWN", "EADDRNOTAVAIL",
  "UND_ERR_CONNECT_TIMEOUT", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID",
]);

function neverSent(err) {
  // fetch reports transport failures as TypeError("fetch failed", {cause}); a TypeError without a cause
  // means the request itself was malformed and was never put on the wire.
  if (err instanceof TypeError && err.cause === undefined) return true;
  for (let e = err, i = 0; e && i < 5; e = e.cause, i++) {
    const codes = [e.code, ...(Array.isArray(e.errors) ? e.errors.map((x) => x && x.code) : [])];
    if (codes.some((c) => NOT_SENT.has(c))) return true;
  }
  return false;
}

// Returns the parsed URL or throws HttpError("host"). https only; plain http is accepted solely for
// 127.0.0.1 and only when a test put that host on the allowlist.
export function checkUrl(url, allowedHosts = ALLOWED_HOSTS) {
  let u = null;
  try { u = new URL(String(url)); } catch { /* handled below */ }
  const loopback = u && u.protocol === "http:" && u.hostname === "127.0.0.1";
  const ok = u && (u.protocol === "https:" || loopback) && !u.username && !u.password &&
    allowedHosts.includes(u.hostname) && (loopback || u.port === "");
  if (!ok) throw new HttpError("host", "Адресът не е разрешен за тази програма.", false);
  return u;
}

function requestHeaders(headers, contentType) {
  const out = {};
  let hasType = false;
  for (const [k, v] of Object.entries(headers || {})) {
    const name = k.toLowerCase();
    if (v == null || name === "origin" || name === "referer") continue;
    if (name === "content-type") hasType = true;
    out[k] = String(v);
  }
  if (contentType && !hasType) out["Content-Type"] = contentType;
  return out;
}

// Plain lower-cased object that also answers .get(name), so both access styles work.
function responseHeaders(res) {
  const out = {};
  const h = res.headers;
  if (h && typeof h.forEach === "function") h.forEach((v, k) => { out[String(k).toLowerCase()] = v; });
  else for (const [k, v] of Object.entries(h || {})) out[k.toLowerCase()] = v;
  Object.defineProperty(out, "get", { value: (name) => out[String(name).toLowerCase()] ?? null });
  return out;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

export function createHttp({ fetchImpl = globalThis.fetch, log, allowedHosts = ALLOWED_HOSTS, userAgent } = {}) {
  async function request({ url, method = "GET", headers, json, form, body, timeoutMs, signal, as = "json" } = {}) {
    const u = checkUrl(url, allowedHosts);
    let payload = body;
    let type = null;
    if (json !== undefined) { payload = JSON.stringify(json); type = "application/json"; }
    else if (form !== undefined) { payload = new URLSearchParams(form).toString(); type = "application/x-www-form-urlencoded"; }
    const reqHeaders = requestHeaders(headers, type);
    if (userAgent && !Object.keys(reqHeaders).some((k) => k.toLowerCase() === "user-agent")) reqHeaders["User-Agent"] = userAgent;
    if (signal && signal.aborted) throw new HttpError("aborted", "Заявката е спряна.", false);

    const ctrl = new AbortController();
    let why = null;
    const timer = timeoutMs > 0 ? setTimeout(() => { why = why || "timeout"; ctrl.abort(); }, timeoutMs) : null;
    const onAbort = () => { why = why || "aborted"; ctrl.abort(); };
    if (signal) signal.addEventListener("abort", onAbort, { once: true });

    const t0 = Date.now();
    const meta = { method, host: u.hostname, path: u.pathname };
    let streaming = false;
    try {
      const res = await fetchImpl(u.href, {
        method, headers: reqHeaders, body: payload, signal: ctrl.signal, redirect: "manual", referrerPolicy: "no-referrer",
      });
      const out = { status: res.status, ok: res.status >= 200 && res.status < 300, headers: responseHeaders(res) };
      if (as === "stream" && out.ok) {
        // timeoutMs covers time-to-headers only; the caller's signal keeps aborting the body.
        streaming = true;
        out.body = res.body;
      } else if (as === "arrayBuffer" && out.ok) {
        out.buffer = await res.arrayBuffer();
      } else {
        // json/text, and every error body (error replies are JSON or short text).
        out.text = await res.text();
        if (as !== "text") out.json = parseJson(out.text);
      }
      if (log) log.info("http", { ...meta, status: out.status, ms: Date.now() - t0 });
      return out;
    } catch (e) {
      const code = why || "network";
      if (log) log.warn("http.failed", { ...meta, code, ms: Date.now() - t0 });
      if (code === "timeout") throw new HttpError("timeout", "Сървърът не отговори навреме.", true);
      if (code === "aborted") throw new HttpError("aborted", "Заявката е спряна.", true);
      throw new HttpError("network", "Няма връзка със сървъра.", !neverSent(e));
    } finally {
      if (timer) clearTimeout(timer);
      if (signal && !streaming) signal.removeEventListener("abort", onAbort);
    }
  }
  return { request };
}
