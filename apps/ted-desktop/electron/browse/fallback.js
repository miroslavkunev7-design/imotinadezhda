// Search fallback: when the local DuckDuckGo search is refused from this PC (bot challenge, rate limit,
// network), the same query goes once to Ted's own server engine (/api/assistant), whose web_search runs
// Google Search through Gemini. The result says which engine answered, so the model and the employee
// both see it. The server keeps the exchange in Ted's memory like any other server-engine question.

// Local failures that are worth a second engine. Invalid input is not retried.
export const FALLBACK_CODES = new Set(["rate_limited", "network", "timeout", "http", "blocked"]);
export const SERVER_ENGINE = "Тед (сървъра) – Google през Gemini";
export const SERVER_NOTE = "Търсачката на компютъра отказа, затова търсенето мина през сървъра на Тед (Google през Gemini).";

const URL_RE = /https?:\/\/[^\s<>"'\])]+/g;

export function serverPrompt(query) {
  return "Потърси в интернет (web_search) и върни САМО списък с намерените резултати – за всеки: заглавие, " +
    "пълен линк, кратко описание и, ако ги има, цена, място и телефон. Без увод и без заключение. Заявка: " + query;
}

// The server answer is free text plus an „Източници:“ block of "• title – url" lines. -> [{title, url, snippet}]
export function parseServerAnswer(text, n = 8) {
  const out = [];
  const seen = new Set();
  const lines = String(text || "").split(/\r?\n/);
  for (let i = 0; i < lines.length && out.length < n; i++) {
    const line = lines[i];
    const urls = line.match(URL_RE);
    if (!urls) continue;
    for (const raw of urls) {
      let url;
      try {
        const u = new URL(raw.replace(/[.,;:]+$/, ""));
        if (u.protocol !== "http:" && u.protocol !== "https:") continue;
        url = u.href;
      } catch { continue; }
      if (seen.has(url)) continue;
      seen.add(url);
      const title = line.replace(URL_RE, "").replace(/^[\s•*\-–\d.)]+/, "").replace(/[\s–:-]+$/, "").trim();
      const next = lines[i + 1] && !URL_RE.test(lines[i + 1]) ? lines[i + 1].trim() : "";
      URL_RE.lastIndex = 0;
      out.push({ title: (title || new URL(url).hostname).slice(0, 200), url, snippet: next.slice(0, 400) });
      if (out.length >= n) break;
    }
  }
  return out;
}

// local(args, opts) -> DuckDuckGo result; assistant = createAssistant(...). Returns a search function with the
// same signature and result shape, plus `engine` and `note` when the server answered.
export function withServerFallback(local, assistant, { log, newId = () => "srch-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) } = {}) {
  return async function search(args, opts = {}) {
    const r = await local(args, opts);
    if (r && (r.ok || !FALLBACK_CODES.has(r.code))) return r;
    const q = String((args && args.query) || "").replace(/\s+/g, " ").trim();
    if (!q || !assistant || typeof assistant.chat !== "function") return r;
    const requestId = newId();
    const onAbort = () => { try { assistant.cancel(requestId); } catch { /* ignore */ } };
    if (opts.signal) {
      if (opts.signal.aborted) return r;
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }
    let s;
    try {
      s = await assistant.chat({ requestId, messages: [{ role: "user", text: serverPrompt(q) }] });
    } catch (e) {
      s = { ok: false, error: String((e && e.message) || e) };
    } finally {
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
    }
    if (!s || !s.ok) {
      if (log) log.warn("search.fallback_failed", { code: s && s.code });
      return { ...r, error: `${r.error} Резервното търсене през сървъра на Тед също не успя${s && s.error ? ": " + s.error : "."}` };
    }
    const n = Math.max(1, Math.min(10, Number(args && args.n) || 8));
    const results = parseServerAnswer(s.text, n);
    if (log) log.info("search.fallback_ok", { results: results.length });
    return {
      ok: true,
      query: q,
      engine: SERVER_ENGINE,
      results,
      answer: String(s.text || "").slice(0, 6000),
      note: SERVER_NOTE + (results.length ? "" : " Сървърът не върна линкове – виж текста в answer."),
    };
  };
}
