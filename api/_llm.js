// Доставчици на модели за Тед. Един и същ цикъл „модел → инструменти → резултат → отговор“ за:
//  - Gemini (GEMINI_API_KEY)                 - OpenAI / ChatGPT (OPENAI_API_KEY)
//  - Anthropic / Claude (ANTHROPIC_API_KEY)  - Ollama (OLLAMA_URL [+OLLAMA_KEY], OpenAI-съвместим /v1)
//  - OpenRouter (OPENROUTER_API_KEY – има и безплатни модели „:free“)
// Ключовете са само във Vercel. Списъкът с модели може да се настрои с *_MODELS (запетая: id|Име|описание).
"use strict";
const E = (k) => process.env[k] || "";
function parseList(s, def) {
  const src = String(s || "").trim();
  const items = (src ? src.split(",") : def).map((x) => String(x).trim()).filter(Boolean).map((x) => { const p = x.split("|"); return { id: p[0].trim(), name: (p[1] || p[0]).trim(), note: (p[2] || "").trim() }; });
  return items;
}
/* Каталог: само доставчиците, за които има ключ */
function catalog() {
  const out = [];
  if (E("GEMINI_API_KEY") || E("GOOGLE_GENERATIVE_AI_API_KEY")) parseList(E("GEMINI_MODELS"), ["gemini-2.5-flash|Gemini 2.5 Flash|бърз, безплатен лимит, снимки и PDF", "gemini-2.5-pro|Gemini 2.5 Pro|по-умен за сложни анализи и договори"]).forEach((m) => out.push(Object.assign({ provider: "gemini", vision: true, pdf: true }, m)));
  if (E("OPENAI_API_KEY")) parseList(E("OPENAI_MODELS"), ["gpt-4.1-mini|ChatGPT 4.1 mini|бърз и евтин", "gpt-4.1|ChatGPT 4.1|по-силен"]).forEach((m) => out.push(Object.assign({ provider: "openai", vision: true, pdf: false }, m)));
  if (E("ANTHROPIC_API_KEY")) parseList(E("ANTHROPIC_MODELS"), ["claude-sonnet-4-5|Claude Sonnet 4.5|много добър за текст и документи", "claude-haiku-4-5|Claude Haiku 4.5|бърз"]).forEach((m) => out.push(Object.assign({ provider: "anthropic", vision: true, pdf: true }, m)));
  if (E("OPENROUTER_API_KEY")) parseList(E("OPENROUTER_MODELS"), ["meta-llama/llama-3.3-70b-instruct:free|Llama 3.3 70B (OpenRouter)|безплатен, без снимки"]).forEach((m) => out.push(Object.assign({ provider: "openrouter", vision: false, pdf: false }, m)));
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
    const key = E("GEMINI_API_KEY") || E("GOOGLE_GENERATIVE_AI_API_KEY");
    const conv = msgs.map((m) => { const parts = [{ text: m.text || "(без текст)" }]; (m.files || []).forEach((f) => { if (/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.mime)) parts.push({ inline_data: { mime_type: f.mime, data: f.data } }); }); return { role: m.role === "assistant" ? "model" : "user", parts }; });
    for (let step = 0; step < maxSteps; step++) {
      const last = stop(step) && step > 0; if (last) conv[conv.length - 1].parts.push({ text: STOP });
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model.id + ":generateContent?key=" + encodeURIComponent(key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ system_instruction: { parts: [{ text: system }] }, contents: conv, generationConfig: { temperature } }, last || !tools.length ? {} : { tools: [{ function_declarations: tools }] })) });
      const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
      const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
      const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);
      if (!calls.length) return parts.map((p) => p.text || "").join("").trim();
      conv.push({ role: "model", parts });
      const results = await Promise.all(calls.map(async (c) => ({ functionResponse: { name: c.name, response: { result: await run({ name: c.name, args: c.args || {} }) } } })));
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
  const base = model.provider === "openai" ? "https://api.openai.com/v1" : model.provider === "openrouter" ? "https://openrouter.ai/api/v1" : E("OLLAMA_URL").replace(/\/+$/, "") + (/\/v1$/.test(E("OLLAMA_URL")) ? "" : "/v1");
  const key = model.provider === "openai" ? E("OPENAI_API_KEY") : model.provider === "openrouter" ? E("OPENROUTER_API_KEY") : (E("OLLAMA_KEY") || "ollama");
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
    const r = await fetch(base + "/chat/completions", { method: "POST", headers, body: JSON.stringify(Object.assign({ model: model.id, messages: conv, temperature }, last || !otools.length ? {} : { tools: otools, tool_choice: "auto" })) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || "HTTP " + r.status);
    const msg = ((j.choices || [])[0] || {}).message || {}; const calls = msg.tool_calls || [];
    if (!calls.length) return String(msg.content || "").trim();
    conv.push({ role: "assistant", content: msg.content || null, tool_calls: calls });
    for (const c of calls) { let args = {}; try { args = JSON.parse(c.function.arguments || "{}"); } catch (e) {} const res = await run({ name: c.function.name, args }); conv.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(res).slice(0, 60000) }); }
  }
  return null;
}
module.exports = { catalog, pick, chat, toSchema };
