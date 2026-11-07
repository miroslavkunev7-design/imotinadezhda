// Памет на Тед: дългосрочни факти за брокера/агенцията + „казуси“ (проекти) с неограничена история.
// Таблици: nd_ted_cases (казуси), nd_ted_memory (съобщения, факти, резюмета). Всичко минава през token-а на служителя (RLS).
// Контекст за всеки отговор: факти (до 60) + данни за казуса + последните съобщения + по-стари съобщения по ключови думи (retrieval).
"use strict";
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const RECENT = 24, RELATED = 10, FACTS = 60, SUMMARY_EVERY = 24;
const H = (token, extra) => Object.assign({ apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, extra || {});
async function q(token, path, init) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, Object.assign({}, init || {}, { headers: H(token, init && init.headers) }));
  if (r.status === 204) return null;
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error((j && (j.message || j.error)) || "HTTP " + r.status); e.status = r.status; throw e; }
  return j;
}
const enc = encodeURIComponent;
const STOP = /^(и|в|на|за|от|с|със|да|не|се|по|до|при|към|е|са|че|ли|ще|го|му|ѝ|ги|им|ми|ти|ни|ви|как|какво|кой|коя|кое|кои|това|тази|този|тези|един|една|едно|или|но|а|ако|ама|само|още|вече|тук|там|the|and|for|with)$/i;
function keywords(text, n) { const seen = {}; return String(text || "").toLocaleLowerCase("bg").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.test(w) && !seen[w] && (seen[w] = 1)).sort((a, b) => b.length - a.length).slice(0, n || 4); }
const missing = (e) => e && (e.status === 404 || /relation .* does not exist|Could not find the table/i.test(e.message || ""));

async function load(token, userId, caseId, question) {
  const out = { facts: [], kase: null, recent: [], related: [], enabled: true };
  try {
    out.facts = (await q(token, "nd_ted_memory?select=id,content,created_at&kind=eq.fact&case_id=is.null&order=created_at.desc&limit=" + FACTS)) || [];
    if (caseId) {
      const c = await q(token, "nd_ted_cases?select=*&id=eq." + enc(caseId)); out.kase = c && c[0] ? c[0] : null;
      if (out.kase) {
        out.recent = ((await q(token, "nd_ted_memory?select=id,role,content,created_at&kind=eq.message&case_id=eq." + enc(caseId) + "&order=created_at.desc&limit=" + RECENT)) || []).reverse();
        out.caseFacts = (await q(token, "nd_ted_memory?select=content&kind=eq.fact&case_id=eq." + enc(caseId) + "&order=created_at.desc&limit=40")) || [];
      }
    }
    const kw = keywords(question, 4);
    if (kw.length) {
      const scope = caseId ? "case_id=eq." + enc(caseId) : "case_id=is.null";
      const or = "or=(" + kw.map((w) => "content.ilike.*" + enc(w.replace(/[%_*,()]/g, "")) + "*").join(",") + ")";
      const skip = new Set(out.recent.map((m) => m.id));
      out.related = ((await q(token, "nd_ted_memory?select=id,role,content,created_at,kind&kind=in.(message,summary)&" + scope + "&" + or + "&order=created_at.desc&limit=" + (RELATED + RECENT))) || []).filter((m) => !skip.has(m.id)).slice(0, RELATED).reverse();
    }
  } catch (e) { if (missing(e)) out.enabled = false; else console.error("ted memory load", e.message); }
  return out;
}
function contextText(m, user) {
  if (!m.enabled) return "";
  const lines = [];
  if (m.facts.length) lines.push("ДЪЛГОСРОЧНА ПАМЕТ (факти, които служителят ти е казал да помниш – ползвай ги без да ги повтаряш излишно):\n" + m.facts.map((f) => "• " + f.content).join("\n"));
  if (m.kase) {
    lines.push("АКТИВЕН КАЗУС: „" + m.kase.title + "“ (id " + m.kase.id + (m.kase.client ? ", клиент: " + m.kase.client : "") + (m.kase.status ? ", статус: " + m.kase.status : "") + "). Всичко по този казус се помни завинаги; надграждай върху вече известното и не започвай отначало." +
      (m.kase.summary ? "\nРЕЗЮМЕ НА КАЗУСА ДОСЕГА:\n" + m.kase.summary : "") + (m.caseFacts && m.caseFacts.length ? "\nФАКТИ ПО КАЗУСА:\n" + m.caseFacts.map((f) => "• " + f.content).join("\n") : ""));
  }
  if (m.related.length) lines.push("ПО-СТАРИ ЗАПИСИ ОТ ПАМЕТТА, свързани с въпроса:\n" + m.related.map((x) => "[" + String(x.created_at).slice(0, 10) + " " + (x.kind === "summary" ? "резюме" : x.role === "user" ? "служител" : "Тед") + "] " + String(x.content).slice(0, 600)).join("\n"));
  lines.push("Инструменти за паметта: memory.remember (запомни факт – когато служителят каже „запомни“, „имай предвид“, или научиш трайно важен факт: предпочитания, правила на агенцията, важни данни за клиент/сделка), memory.search (потърси в паметта), cases.list / cases.create / cases.update (казуси).");
  return "\n\n" + lines.join("\n\n");
}
/* историята на казуса се подава като съобщения преди текущите (за да е естествен разговорът) */
function historyMsgs(m) { return (m.recent || []).map((x) => ({ role: x.role === "assistant" ? "assistant" : "user", text: String(x.content || "").slice(0, 4000) })); }

async function save(token, userId, caseId, userText, answer, opts) {
  try {
    const rows = [];
    if (userText) rows.push({ user_id: userId, case_id: caseId || null, kind: "message", role: "user", content: String(userText).slice(0, 8000), meta: opts && opts.meta || null });
    if (answer) rows.push({ user_id: userId, case_id: caseId || null, kind: "message", role: "assistant", content: String(answer).slice(0, 12000), meta: opts && opts.meta || null });
    if (rows.length) await q(token, "nd_ted_memory", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows) });
    if (caseId) {
      await q(token, "nd_ted_cases?id=eq." + enc(caseId), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ updated_at: new Date().toISOString(), last_message: String(userText || "").slice(0, 200) }) });
      const cnt = await q(token, "nd_ted_memory?select=id&kind=eq.message&case_id=eq." + enc(caseId), { headers: { Prefer: "count=exact", Range: "0-0" } }).catch(() => null);
      return { count: Array.isArray(cnt) ? null : null };
    }
  } catch (e) { if (!missing(e)) console.error("ted memory save", e.message); }
  return null;
}
/* автоматично резюме на казуса на всеки SUMMARY_EVERY съобщения (един евтин LLM разговор) */
async function maybeSummarize(token, caseId, LLM) {
  try {
    const r = await fetch(SB_URL + "/rest/v1/nd_ted_memory?select=id&kind=eq.message&case_id=eq." + enc(caseId), { headers: H(token, { Prefer: "count=exact", Range: "0-0" }) });
    const total = Number(String(r.headers.get("content-range") || "").split("/")[1] || 0);
    if (!total || total % SUMMARY_EVERY !== 0) return null;
    const c = (await q(token, "nd_ted_cases?select=id,title,summary&id=eq." + enc(caseId)))[0]; if (!c) return null;
    const msgs = ((await q(token, "nd_ted_memory?select=role,content&kind=eq.message&case_id=eq." + enc(caseId) + "&order=created_at.desc&limit=" + SUMMARY_EVERY)) || []).reverse();
    const model = LLM.catalog().filter((m) => m.provider === "gemini").sort((a, b) => (/lite/.test(a.id) ? -1 : 1))[0] || LLM.catalog()[0]; if (!model) return null;
    const text = await LLM.chat(model, { system: "Ти водиш паметта на казус в агенция за имоти. Обнови резюмето: факти, хора, имоти, суми, срокове, решения, отворени въпроси и следващи стъпки. Кратко, по точки, на български, без въведение. До 2500 знака.", msgs: [{ role: "user", text: "ДОСЕГАШНО РЕЗЮМЕ:\n" + (c.summary || "(няма)") + "\n\nНОВИ СЪОБЩЕНИЯ:\n" + msgs.map((m) => (m.role === "user" ? "Служител: " : "Тед: ") + String(m.content).slice(0, 1500)).join("\n") }], tools: [], run: async () => ({}), maxSteps: 1 });
    if (text) { await q(token, "nd_ted_cases?id=eq." + enc(caseId), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ summary: String(text).slice(0, 4000) }) }); await q(token, "nd_ted_memory", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ case_id: caseId, kind: "summary", role: "assistant", content: String(text).slice(0, 4000) }) }); }
    return text;
  } catch (e) { return null; }
}
module.exports = { load, contextText, historyMsgs, save, maybeSummarize, keywords };
