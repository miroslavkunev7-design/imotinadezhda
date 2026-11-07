// Общ модул за Google Gemini (не е endpoint: файловете с „_“ не се публикуват).
// Google спира старите модели (gemini-2.0-flash – 06.2026, gemini-2.5-flash връща 404 за нови ключове), затова
// моделите НЕ са закодирани: списъкът идва от Google (ListModels), подреждат се най-новите Flash модели и при
// 404 / лимит (429) / претоварване (503) автоматично се минава към следващия. Мъртвите и изчерпаните се помнят.
"use strict";
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const KEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
/* резерва, ако ListModels не отговори (официалните „-latest“ псевдоними винаги сочат актуален модел) */
const FALLBACK = {
  chat: ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
  tts: ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"],
  image: ["gemini-3.1-flash-image-preview", "gemini-3.1-flash-lite-image", "gemini-2.5-flash-image"]
};
const SKIP_TOKEN = "skip_thought_signature_validator";
let LIST = null, LIST_AT = 0, LIST_P = null;
const DEAD = new Map(), BUSY = new Map();

async function list() {
  if (LIST && Date.now() - LIST_AT < 15 * 60000) return LIST;
  if (LIST_P) return LIST_P;
  if (!KEY()) return [];
  LIST_P = (async () => {
    const out = []; let tok = "";
    for (let page = 0; page < 4; page++) {
      const r = await fetch(BASE + "/models?pageSize=1000" + (tok ? "&pageToken=" + encodeURIComponent(tok) : "") + "&key=" + encodeURIComponent(KEY()), { signal: AbortSignal.timeout(6000) });
      if (!r.ok) break;
      const j = await r.json().catch(() => ({}));
      (j.models || []).forEach((m) => out.push({ id: String(m.name || "").replace(/^models\//, ""), methods: m.supportedGenerationMethods || [], name: m.displayName || "" }));
      tok = j.nextPageToken || ""; if (!tok) break;
    }
    if (out.length) { LIST = out; LIST_AT = Date.now(); }
    return LIST || [];
  })().catch(() => LIST || []).finally(() => { LIST_P = null; });
  return LIST_P;
}

const ver = (id) => { const m = /^gemini-(\d+(?:\.\d+)?)/.exec(id); return m ? parseFloat(m[1]) : 0; };
const isPreview = (id) => /preview|-exp|\d{2}-\d{2}$|-\d{3}$/.test(id);
const isAlias = (id) => /-latest$/.test(id);
const NOT_TEXT = /(tts|image|embed|live|native-audio|audio|computer-use|robotics|aqa|learnlm|veo|imagen|omni|thinking|deep-research|customtools|nano|banana|lyria|gemma|-exp)/;

function rank(ids, kind) {
  const tier = (id) => {
    const lite = /lite/.test(id), flash = /flash/.test(id), pro = /pro/.test(id);
    if (kind === "fast") return lite ? 0 : flash ? 1 : pro ? 3 : 2;
    if (kind === "tts") return flash && !lite ? 0 : lite ? 1 : pro ? 2 : 3;
    return flash && !lite ? 0 : lite ? 1 : pro ? 3 : 2;
  };
  /* стабилни 3.x+ → псевдоними „-latest“ → стари 2.x (Google ги спира) → preview */
  const group = (id) => (isAlias(id) ? 1 : isPreview(id) ? 3 : ver(id) && ver(id) < 3 ? 2 : 0);
  return ids.slice().sort((a, b) => tier(a) - tier(b) || group(a) - group(b) || ver(b) - ver(a) || a.localeCompare(b));
}
/* подредени модели за даден вид работа: chat (Flash), fast (Flash Lite първо), tts, image */
async function models(kind) {
  kind = kind || "chat";
  const all = await list();
  let ids;
  if (kind === "tts") ids = all.filter((m) => /tts/.test(m.id) && m.methods.includes("generateContent")).map((m) => m.id);
  else if (kind === "image") ids = all.filter((m) => /image/.test(m.id) && /flash/.test(m.id) && m.methods.includes("generateContent")).map((m) => m.id);
  else ids = all.filter((m) => /^gemini-/.test(m.id) && m.methods.includes("generateContent") && !NOT_TEXT.test(m.id) && /(flash|pro)/.test(m.id)).map((m) => m.id);
  const fb = FALLBACK[kind === "fast" ? "chat" : kind] || FALLBACK.chat;
  if (!ids.length) ids = fb.slice();
  ids = rank(ids, kind);
  /* в чата: най-много 4 Flash + 2 Flash Lite + 1 Pro, за да не губим време */
  if (kind === "chat" || kind === "fast") {
    const fl = ids.filter((i) => /flash/.test(i) && !/lite/.test(i)).slice(0, 4), li = ids.filter((i) => /lite/.test(i)).slice(0, 2), pr = ids.filter((i) => /pro/.test(i)).slice(0, 1);
    ids = kind === "fast" ? li.concat(fl, pr) : fl.concat(li, pr);
  }
  const now = Date.now();
  const alive = ids.filter((i) => !(DEAD.get(i) > now));
  const free = alive.filter((i) => !(BUSY.get(i) > now));
  return (free.length ? free.concat(alive.filter((i) => !free.includes(i))) : alive.length ? alive : ids).slice(0, 8);
}

function retryAfter(j, msg) {
  const d = ((j && j.error && j.error.details) || []).find((x) => x && x.retryDelay);
  const s = d ? parseFloat(String(d.retryDelay)) : parseFloat((String(msg).match(/retry in ([\d.]+)\s*s/i) || [])[1] || "0");
  return isFinite(s) ? s : 0;
}
/* вид на грешката: dead (моделът го няма), quota (лимит), busy (претоварен), bad (грешна заявка) */
function classify(model, status, j) {
  const msg = (j && j.error && j.error.message) || "HTTP " + status;
  if (status === 404 || /no longer available|not found for api|is not found|not supported for generatecontent|has been (deprecated|discontinued|retired)|unsupported model/i.test(msg)) { DEAD.set(model, Date.now() + 6 * 3600000); return { kind: "dead", msg }; }
  if (status === 429) {
    const wait = retryAfter(j, msg), daily = /per ?day|limit: ?0|RequestsPerDay/i.test(msg + JSON.stringify((j && j.error && j.error.details) || []));
    BUSY.set(model, Date.now() + (daily ? 3600000 : Math.max(15, wait || 30) * 1000));
    return { kind: "quota", msg, wait, daily };
  }
  if (status >= 500) { BUSY.set(model, Date.now() + 30000); return { kind: "busy", msg }; }
  return { kind: "bad", msg };
}
/* настройки според поколението: при Gemini 3+ температурата остава по подразбиране (Google препоръчва 1.0), мисленето е „ниско“ за бързина */
function genConfig(model, gc, opts) {
  const c = Object.assign({}, gc || {});
  const v = ver(model);
  if (v >= 3 || isAlias(model)) delete c.temperature;
  if (v >= 3 && opts && opts.thinking && !c.thinkingConfig) c.thinkingConfig = { thinkingLevel: opts.thinking };
  return c;
}
async function post(model, body, ms) {
  const r = await fetch(BASE + "/models/" + model + ":generateContent?key=" + encodeURIComponent(KEY()), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(3000, ms || 55000)) });
  const j = await r.json().catch(() => ({}));
  return { r, j };
}
/* една заявка с автоматично минаване по моделите. body.generationConfig се донастройва за всеки модел.
   opts: { kind, models, start, budgetMs, deadline, thinking } → { json, model, index, tried } */
async function request(body, opts) {
  opts = opts || {};
  if (!KEY()) { const e = new Error("Няма настроен GEMINI_API_KEY"); e.status = 500; throw e; }
  const ids = opts.models && opts.models.length ? opts.models : await models(opts.kind || "chat");
  const deadline = opts.deadline || Date.now() + (opts.budgetMs || 50000);
  const tried = []; let last = null;
  for (let i = opts.start || 0; i < ids.length; i++) {
    const model = ids[i];
    let b = Object.assign({}, body, { generationConfig: genConfig(model, body.generationConfig, opts) });
    /* друг модел от предишната стъпка → подписите на мисленето се заменят (иначе Gemini 3 връща 400) */
    if (opts.prev && model !== opts.prev && Array.isArray(b.contents)) b.contents = b.contents.map((c) => c.role === "model" ? Object.assign({}, c, { parts: (c.parts || []).map((p) => (p.functionCall || p.thoughtSignature ? Object.assign({}, p, { thoughtSignature: SKIP_TOKEN }) : p)) }) : c);
    for (let attempt = 0; attempt < 3; attempt++) {
      const left = deadline - Date.now(); if (left < 2500) break;
      let r, j;
      try { ({ r, j } = await post(model, b, left)); } catch (e) { last = { kind: "busy", msg: String(e.message || e) }; tried.push(model + ": " + last.msg.slice(0, 80)); break; }
      if (r.ok) {
        const c = (j.candidates || [])[0];
        if (!c && j.promptFeedback && j.promptFeedback.blockReason) { const e = new Error("Заявката е блокирана от Google (" + j.promptFeedback.blockReason + ")"); e.status = 400; throw e; }
        return { json: j, model, index: i, tried };
      }
      const cl = classify(model, r.status, j); last = cl;
      /* грешна настройка за този модел (мислене / температура / JSON) → махаме я и опитваме пак */
      if (cl.kind === "bad" && attempt < 2 && /thinking|temperature|response_?mime|responseMimeType/i.test(cl.msg) && (b.generationConfig.thinkingConfig || b.generationConfig.temperature != null || b.generationConfig.responseMimeType)) {
        const g = Object.assign({}, b.generationConfig); if (/thinking/i.test(cl.msg)) delete g.thinkingConfig; else if (/temperature/i.test(cl.msg)) delete g.temperature; else delete g.responseMimeType; b = Object.assign({}, b, { generationConfig: g }); continue;
      }
      if (cl.kind === "quota" && !cl.daily && attempt === 0 && cl.wait > 0 && cl.wait <= 8 && deadline - Date.now() > cl.wait * 1000 + 4000) { await new Promise((ok) => setTimeout(ok, cl.wait * 1000 + 250)); continue; }
      tried.push(model + ": " + cl.msg.split("\n")[0].slice(0, 120));
      if (cl.kind === "bad" && !opts.anyError) { const e = new Error(cl.msg); e.status = 400; e.tried = tried; throw e; }
      break;
    }
  }
  const e = new Error(last ? (last.kind === "quota" ? "Лимитът на Gemini е изчерпан" + (last.daily ? " за днес" : " – опитайте след малко") : last.msg) : "Gemini не отговори");
  e.status = last && last.kind === "quota" ? 429 : 502; e.quota = !!(last && last.kind === "quota"); e.tried = tried; throw e;
}
const textOf = (j) => ((((j.candidates || [])[0] || {}).content || {}).parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
function parseJson(t) { const s = String(t || "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim(); try { return JSON.parse(s); } catch (e) { const m = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/); if (m) return JSON.parse(m[0]); throw new Error("AI върна невалиден отговор"); } }
/* удобна обвивка: generate({ parts | contents, system, json, tools, temperature, maxTokens, kind, budgetMs }) → { text, data, model } */
async function generate(o) {
  const body = { contents: o.contents || [{ role: "user", parts: o.parts }] };
  if (o.system) body.system_instruction = { parts: [{ text: o.system }] };
  if (o.tools) body.tools = o.tools;
  body.generationConfig = {};
  if (o.temperature != null) body.generationConfig.temperature = o.temperature;
  if (o.json) body.generationConfig.responseMimeType = "application/json";
  if (o.maxTokens) body.generationConfig.maxOutputTokens = o.maxTokens;
  const res = await request(body, { kind: o.kind, models: o.models, budgetMs: o.budgetMs, deadline: o.deadline, thinking: o.thinking || "low" });
  const text = textOf(res.json);
  return { text, data: o.json ? parseJson(text) : undefined, model: res.model, raw: res.json };
}
/* гласово съобщение → текст. iPhone записва audio/mp4, Chrome – audio/webm: при отказ опитваме съвместим MIME */
async function transcribe(audio, prompt, o) {
  let mime = String(audio.mime || "").split(";")[0].toLowerCase();
  if (/^audio\/(x-m4a|m4a|x-mp4)$/.test(mime)) mime = "audio/mp4";
  const alts = { "audio/mp4": ["audio/aac", "audio/mp3"], "audio/webm": ["audio/ogg"], "audio/x-wav": ["audio/wav"], "audio/mpeg": ["audio/mp3"], "audio/3gpp": ["audio/aac"] };
  const tryMimes = [mime].concat(alts[mime] || []);
  let lastErr = null;
  for (const m of tryMimes) {
    try {
      const r = await generate({ parts: [{ text: prompt }, { inline_data: { mime_type: m, data: audio.data } }], temperature: 0, kind: "chat", budgetMs: (o && o.budgetMs) || 25000, thinking: "minimal" });
      return r.text.replace(/^["„“]+|["“”]+$/g, "").trim();
    } catch (e) { lastErr = e; if (!(e.status === 400 && /mime|format|audio|unsupported|invalid argument/i.test(String(e.message)))) break; }
  }
  throw lastErr || new Error("Разпознаването не успя");
}
/* при смяна на модела по средата на разговор с инструменти: подписите на „мисленето“ от другия модел не са валидни */
function resign(contents) {
  (contents || []).forEach((c) => { if (c.role === "model") (c.parts || []).forEach((p) => { if (p.functionCall || p.thoughtSignature) p.thoughtSignature = SKIP_TOKEN; }); });
  return contents;
}
module.exports = { cfg: (m, gc, o) => genConfig(m, gc, o || { thinking: "low" }), KEY, list, models, request, generate, transcribe, textOf, parseJson, resign, classify, ver, DEAD, BUSY, FALLBACK };
