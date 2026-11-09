// Доставчици на модели за Тед. Един и същ цикъл „модел → инструменти → резултат → отговор“ за:
//  - Gemini (GEMINI_API_KEY)                 - OpenAI / ChatGPT (OPENAI_API_KEY)
//  - Anthropic / Claude (ANTHROPIC_API_KEY)  - Ollama (OLLAMA_URL [+OLLAMA_KEY], OpenAI-съвместим /v1)
//  - OpenRouter (OPENROUTER_API_KEY – има и безплатни модели „:free“)
//  - (Vercel AI Gateway chat моделите са махнати от каталога; видео gateway е в api/video.js)
// Ключовете са само във Vercel. Списъкът с модели може да се настрои с *_MODELS (запетая: id|Име|описание).
"use strict";
const E = (k) => process.env[k] || "";
const GEM = require("./_gem.js");
/* Vercel AI Gateway (кредити във Vercel): OpenAI-съвместим адрес, модели "anthropic/…", "openai/…" */
/* официалното име е AI_GATEWAY_API_KEY; AI_GATEWAY_KEY/AI_GATEWAY_URL може да са останали от старата Lovable връзка – ползват се последни и само към vercel.sh */
/* във Vercel функциите ключ не е нужен: AI Gateway приема OIDC токена на проекта (x-vercel-oidc-token / VERCEL_OIDC_TOKEN) */
const GW_KEY = () => E("AI_GATEWAY_API_KEY") || E("VERCEL_AI_GATEWAY_KEY") || E("AI_GATEWAY_KEY") || E("VERCEL_OIDC_TOKEN");
const GW_URL = () => { const u = E("AI_GATEWAY_URL"); const b = /^https:\/\/[^/]*vercel\.sh/.test(u) ? u.replace(/\/+$/, "") : "https://ai-gateway.vercel.sh/v1"; return /\/v1$/.test(b) ? b : b + "/v1"; };
function parseList(s, def) {
  const src = String(s || "").trim();
  const items = (src ? src.split(",") : def).map((x) => String(x).trim()).filter(Boolean).map((x) => { const p = x.split("|"); return { id: p[0].trim(), name: (p[1] || p[0]).trim(), note: (p[2] || "").trim() }; });
  return items;
}
/* Каталог: само доставчиците, за които има ключ */
function catalog() {
  const out = [];
  /* Gemini: псевдонимите „-latest“ сочат винаги най-новия модел; реалният модел се избира автоматично от _gem.js (ListModels) */
  if (E("GEMINI_API_KEY") || E("GOOGLE_GENERATIVE_AI_API_KEY")) parseList(E("GEMINI_MODELS"), ["gemini-flash-lite-latest|Тед – личен безплатен агент (Gemini Flash Lite)|по подразбиране: клиенти, имоти, календар, качване; свърши ли лимитът – сам минава на безплатния Gemini Flash", "gemini-flash-latest|Gemini Flash (безплатен) – по-силен|за по-тежки задачи; свърши ли лимитът – сам минава на Flash Lite"]).forEach((m) => out.push(Object.assign({ provider: "gemini", vision: true, pdf: true }, m)));
  if (E("OPENAI_API_KEY")) parseList(E("OPENAI_MODELS"), ["gpt-4.1-mini|ChatGPT 4.1 mini|бърз и евтин", "gpt-4.1|ChatGPT 4.1|по-силен"]).forEach((m) => out.push(Object.assign({ provider: "openai", vision: true, pdf: false }, m)));
  if (E("ANTHROPIC_API_KEY")) parseList(E("ANTHROPIC_MODELS"), ["claude-sonnet-4-5|Claude Sonnet 4.5|много добър за текст и документи", "claude-haiku-4-5|Claude Haiku 4.5|бърз"]).forEach((m) => out.push(Object.assign({ provider: "anthropic", vision: true, pdf: true }, m)));
  if (E("OPENROUTER_API_KEY")) parseList(E("OPENROUTER_MODELS"), ["meta-llama/llama-3.3-70b-instruct:free|Llama 3.3 70B (OpenRouter)|безплатен, без снимки"]).forEach((m) => out.push(Object.assign({ provider: "openrouter", vision: false, pdf: false }, m)));
  /* Chat през Vercel AI Gateway е изключен: OIDC/ключовете сами не добавят chat модели в пикъра/резерва.
     Видео (kling/veo) остава в api/video.js. Директните openai/anthropic/openrouter/ollama/gemini са по-горе. */
  if (E("OLLAMA_URL")) parseList(E("OLLAMA_MODELS"), ["llama3.1:8b|Ollama Llama 3.1|локален, безплатен"]).forEach((m) => out.push(Object.assign({ provider: "ollama", vision: false, pdf: false }, m)));
  return out;
}
function pick(id) { const c = catalog(); return c.find((m) => m.id === id) || c[0] || null; }

/* ---- схема на инструментите: от Gemini-формата (OBJECT/STRING) към JSON Schema ---- */
function toSchema(p) {
  if (!p || typeof p !== "object") return p;
  const o = {}; Object.keys(p).forEach((k) => { o[k] = p[k]; });
  if (typeof o.type === "string") o.type = o.type.toLowerCase();
  if (o.properties) { const pr = {}; Object.keys(o.properties).forEach((k) => { pr[k] = toSchema(o.properties[k]); }); o.properties = pr; }
  if (o.items) o.items = toSchema(o.items);
  return o;
}
const dataUrl = (f) => "data:" + f.mime + ";base64," + f.data;

/* ---- общ цикъл. msgs: [{role:'user'|'assistant', text, files:[{mime,data}]}], tools: Gemini declarations, run(call{name,args}) → резултат ---- */
async function chat(model, opts) {
  const { system, msgs, tools, run, maxSteps = 10, budgetMs = 38000, temperature = 0.3 } = opts;
  const t0 = Date.now();
  const stop = (step) => step === maxSteps - 1 || Date.now() - t0 > budgetMs;
  const STOP = "Спри с инструментите и дай окончателния отговор с това, което вече намери (с точки и източници).";
  if (model.provider === "gemini") {
    /* избраният модел + всички живи Gemini модели (най-новите първо); при 404/лимит/претоварване стъпката минава на следващия, без да започва отначало */
    /* личният безплатен агент (Flash Lite) → първо всички Lite модели, после Flash; избран по-силен модел → първо той, после резервите */
    const lite = /lite/.test(model.id), live = await GEM.models(lite ? "fast" : "chat");
    const ids = [];
    const want = /-latest$/.test(model.id) ? (lite ? [model.id].concat(live) : live) : [model.id].concat(live);
    want.concat(lite ? [] : GEM.FALLBACK.chat).forEach((i) => { if (!ids.includes(i)) ids.push(i); });
    const deadline = t0 + budgetMs + 15000;
    const conv = msgs.map((m) => { const parts = [{ text: m.text || "(без текст)" }]; (m.files || []).forEach((f) => { if (/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.mime)) parts.push({ inline_data: { mime_type: f.mime, data: f.data } }); }); return { role: m.role === "assistant" ? "model" : "user", parts }; });
    let idx = 0, usedModel = null;
    for (let step = 0; step < maxSteps; step++) {
      const last = stop(step) && step > 0; if (last) conv[conv.length - 1].parts.push({ text: STOP });
      const body = Object.assign({ system_instruction: { parts: [{ text: system }] }, contents: conv, generationConfig: { temperature } }, last || !tools.length ? {} : { tools: [{ function_declarations: tools }] });
      const res = await GEM.request(body, { models: ids, start: idx, deadline, thinking: "low", anyError: true, prev: usedModel });
      if (usedModel && res.model !== usedModel) GEM.resign(conv);
      idx = res.index; usedModel = res.model; opts.onModel && opts.onModel(res.model);
      const cand = (res.json.candidates || [])[0] || {};
      const parts = (cand.content || {}).parts || [];
      const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);
      if (!calls.length) {
        const text = parts.filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
        /* празен/повреден отговор (MALFORMED_FUNCTION_CALL и др.) → още един опит със следващия модел */
        if (!text && idx + 1 < ids.length && step < maxSteps - 1) { idx++; continue; }
        return text;
      }
      conv.push({ role: "model", parts });
      const results = await Promise.all(calls.map(async (c) => ({ functionResponse: Object.assign(c.id ? { id: c.id } : {}, { name: c.name, response: { result: await run({ name: c.name, args: c.args || {} }) } }) })));
      conv.push({ role: "user", parts: results });
    }
    return null;
  }
  if (model.provider === "anthropic") {
    const key = E("ANTHROPIC_API_KEY");
    const conv = msgs.map((m) => { const c = []; (m.files || []).forEach((f) => { if (/^image\/(jpeg|png|webp|gif)$/.test(f.mime)) c.push({ type: "image", source: { type: "base64", media_type: f.mime, data: f.data } }); else if (f.mime === "application/pdf") c.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }); }); c.push({ type: "text", text: m.text || "(без текст)" }); return { role: m.role === "assistant" ? "assistant" : "user", content: c }; });
    const atools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: toSchema(t.parameters) || { type: "object", properties: {} } }));
    for (let step = 0; step < maxSteps; step++) {
      const last = stop(step) && step > 0; if (last) conv[conv.length - 1].content.push({ type: "text", text: STOP });
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify(Object.assign({ model: model.id, max_tokens: 4096, system, messages: conv, temperature }, last || !atools.length ? {} : { tools: atools })) });
      const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
      const content = j.content || [], uses = content.filter((c) => c.type === "tool_use");
      if (!uses.length) return content.filter((c) => c.type === "text").map((c) => c.text).join("").trim();
      conv.push({ role: "assistant", content });
      const results = await Promise.all(uses.map(async (u) => ({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(await run({ name: u.name, args: u.input || {} })).slice(0, 60000) })));
      conv.push({ role: "user", content: results });
    }
    return null;
  }
  /* OpenAI-съвместими: OpenAI, OpenRouter, Ollama */
  const base = model.provider === "openai" ? "https://api.openai.com/v1" : model.provider === "openrouter" ? "https://openrouter.ai/api/v1" : model.provider === "gateway" ? GW_URL() : E("OLLAMA_URL").replace(/\/+$/, "") + (/\/v1$/.test(E("OLLAMA_URL")) ? "" : "/v1");
  const key = model.provider === "openai" ? E("OPENAI_API_KEY") : model.provider === "openrouter" ? E("OPENROUTER_API_KEY") : model.provider === "gateway" ? GW_KEY() : (E("OLLAMA_KEY") || "ollama");
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + key }; if (model.provider === "openrouter") { headers["HTTP-Referer"] = "https://imotinadezhda.bg"; headers["X-Title"] = "Имоти Надежда – Тед"; }
  const conv = [{ role: "system", content: system }].concat(msgs.map((m) => {
    const imgs = (m.files || []).filter((f) => /^image\/(jpeg|png|webp|gif)$/.test(f.mime)), pdfs = (m.files || []).filter((f) => f.mime === "application/pdf");
    let text = m.text || "(без текст)"; if (pdfs.length) text += "\n(прикачен PDF – този модел не чете PDF; за документи ползвайте Gemini или Claude)";
    if (model.vision && imgs.length && m.role !== "assistant") return { role: "user", content: [{ type: "text", text }].concat(imgs.map((f) => ({ type: "image_url", image_url: { url: dataUrl(f) } }))) };
    return { role: m.role === "assistant" ? "assistant" : "user", content: text };
  }));
  const otools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: toSchema(t.parameters) || { type: "object", properties: {} } } }));
  for (let step = 0; step < maxSteps; step++) {
    const last = stop(step) && step > 0; if (last) conv.push({ role: "user", content: STOP });
    const payload = JSON.stringify(Object.assign({ model: model.id, messages: conv, temperature }, last || !otools.length ? {} : { tools: otools, tool_choice: "auto" }));
    let r = await fetch(base + "/chat/completions", { method: "POST", headers, body: payload });
    /* AI Gateway: ако старият ключ е невалиден, опитваме с OIDC токена на проекта */
    if (model.provider === "gateway" && (r.status === 401 || r.status === 403) && E("VERCEL_OIDC_TOKEN") && headers.Authorization !== "Bearer " + E("VERCEL_OIDC_TOKEN")) { headers.Authorization = "Bearer " + E("VERCEL_OIDC_TOKEN"); r = await fetch(base + "/chat/completions", { method: "POST", headers, body: payload }); }
    const j = await r.json().catch(() => ({})); if (!r.ok) { const er = new Error(String((j.error && (j.error.message || j.error)) || "HTTP " + r.status)); er.quota = r.status === 429 || r.status === 402; throw er; }
    const msg = ((j.choices || [])[0] || {}).message || {}; const calls = msg.tool_calls || [];
    if (!calls.length) return String(msg.content || "").trim();
    conv.push({ role: "assistant", content: msg.content || null, tool_calls: calls });
    for (const c of calls) { let args = {}; try { args = JSON.parse(c.function.arguments || "{}"); } catch (e) {} const res = await run({ name: c.function.name, args }); conv.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(res).slice(0, 60000) }); }
  }
  return null;
}
module.exports = { catalog, pick, chat, toSchema };
