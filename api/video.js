// /api/video – „AI Видео на имот“ за Тед. Клипове от снимки (първи + последен кадър) за разходка из имота и ускорен „строеж“.
// Двигатели (ключовете са само във Vercel):
//   • Kling 3.0 и Veo 3.1 Fast през Vercel AI Gateway (AI_GATEWAY_API_KEY / VERCEL_AI_GATEWAY_KEY или OIDC) – плаща се от gateway кредитите
//   • Google Gemini Omni Flash (GEMINI_API_KEY, платен план) – Interactions API, фонов режим
//   • OpenAI Sora 2 (OPENAI_API_KEY) – само първи кадър
// Всяка снимка първо се изрязва точно във формата на клипа (9:16 → 720×1280, 16:9 → 1280×720, _frames.js) и се кешира в nd-files.
// POST JSON + Authorization: Bearer <CRM token>: engines | route | script | lot | start | status
// GET ?diag=<временен ключ от nd_secrets 'video_diag'>&do=keys|frame|start|status – самопроверка на живо (без пароли/ключове в отговора).
"use strict";
const crypto = require("crypto");
const FR = require("./_frames.js");
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const E = (k) => process.env[k] || "";
const GKEY = () => E("GEMINI_API_KEY") || E("GOOGLE_GENERATIVE_AI_API_KEY");
const SR = () => E("SUPABASE_SERVICE_ROLE_KEY") || E("SUPABASE_SECRET_KEY");
const OMNI_MODELS = () => Array.from(new Set([E("ND_OMNI_MODEL"), "gemini-omni-1.2-flash", "gemini-omni-1.1-flash"].filter(Boolean)));
const IMG_MODELS = ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview"];
const TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const GAPI = "https://generativelanguage.googleapis.com/v1beta";
const GW = "https://ai-gateway.vercel.sh";
const GW_VIDEO = {
  kling: { id: "kling", model: "klingai/kling-v3.0-i2v", name: "Kling 3.0", price: 0.17, durs: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], note: "моделът от видеото – начален и краен кадър" },
  veo: { id: "veo", model: "google/veo-3.1-fast-generate-001", name: "Google Veo 3.1 Fast", price: 0.10, durs: [4, 6, 8], note: "начален и краен кадър, 4/6/8 сек" }
};
const NEG = "people, person, hands, text, captions, subtitles, distorted walls, warped furniture, morphing objects, melting, flicker, extra rooms, fisheye distortion, blurry";
let LLM = null; try { LLM = require("./_llm.js"); } catch (e) {}

function send(res, s, b) { res.statusCode = s; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(b)); }
async function readBody(req) { if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body; const ch = []; for await (const c of req) ch.push(c); return JSON.parse(Buffer.concat(ch).toString("utf8")); }
async function isStaff(token) {
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } }); if (!u.ok) return false;
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}
const encPath = (p) => String(p).split("/").map(encodeURIComponent).join("/");
const safe = (p) => String(p || "").replace(/\.\./g, "").replace(/^\/+/, "").replace(/[^\w.\-\/а-яА-Я ]+/g, "_").slice(0, 180);
const userSt = (tok) => ({ h: () => ({ apikey: SB_KEY, Authorization: "Bearer " + tok }) });
const srSt = () => ({ h: () => ({ apikey: SR(), Authorization: "Bearer " + SR() }) });
const short = (x) => String(x == null ? "" : x).replace(/AIza[\w-]{20,}|sk-[\w-]{10,}|vck_[\w-]{10,}/g, "•••").slice(0, 400);

/* ---------- хранилище (nd-files) ---------- */
async function getObj(st, p) {
  const r = await fetch(SB_URL + "/storage/v1/object/nd-files/" + encPath(p), { headers: st.h() });
  if (r.status === 400 || r.status === 404) return null;
  if (!r.ok) throw new Error("Файлът не е достъпен (" + r.status + ")");
  return { buf: Buffer.from(await r.arrayBuffer()), mime: (r.headers.get("content-type") || "").split(";")[0] };
}
async function putObj(st, p, buf, mime) {
  const r = await fetch(SB_URL + "/storage/v1/object/nd-files/" + encPath(p), { method: "POST", headers: Object.assign(st.h(), { "Content-Type": mime, "x-upsert": "true" }), body: buf });
  if (!r.ok) throw new Error("Качването не успя (" + r.status + ")");
}
async function signUrl(st, p, secs) {
  const r = await fetch(SB_URL + "/storage/v1/object/sign/nd-files/" + encPath(p), { method: "POST", headers: Object.assign(st.h(), { "Content-Type": "application/json" }), body: JSON.stringify({ expiresIn: secs || 86400 }) });
  const j = await r.json().catch(() => ({})); return j.signedURL ? SB_URL + "/storage/v1" + j.signedURL : null;
}
/* изображение от bucket (path), интернет (url) или подадено (data) → { data(base64), mime } */
async function image(st, src) {
  if (!src) return null;
  if (src.data) return { data: src.data, mime: src.mime || "image/jpeg" };
  let buf, mime;
  if (src.path) { const o = await getObj(st, src.path); if (!o) throw new Error("Снимката липсва: " + src.path); buf = o.buf; mime = o.mime; }
  else if (src.url && /^https?:/.test(src.url)) { const r = await fetch(src.url); if (!r.ok) throw new Error("Снимката не е достъпна (" + r.status + ")"); buf = Buffer.from(await r.arrayBuffer()); mime = (r.headers.get("content-type") || "").split(";")[0]; }
  else throw new Error("Няма снимка");
  if (buf.length > 15 * 1048576) throw new Error("Снимката е над 15 MB");
  if (!/^image\//.test(mime || "")) mime = /\.png$/i.test(src.path || src.url || "") ? "image/png" : "image/jpeg";
  return { data: buf.toString("base64"), mime, buf };
}
/* кадър точно във формата на клипа; кешира се в ted/video/frames/ */
async function frame(st, src, aspect, noCrop) {
  if (!src) return null;
  if (noCrop || src.data) { const im = await image(st, src); return { data: im.data, mime: im.mime }; }
  const key = crypto.createHash("sha1").update(String(src.path || src.url)).digest("hex").slice(0, 20);
  const fpath = "ted/video/frames/" + key + "-" + aspect.replace(":", "x") + ".jpg";
  const cached = await getObj(st, fpath).catch(() => null);
  if (cached && cached.buf.length > 1000) return { data: cached.buf.toString("base64"), mime: "image/jpeg", path: fpath, cached: true };
  const im = await image(st, src);
  let out = null;
  if (/jpe?g/i.test(im.mime) || (im.buf[0] === 0xff && im.buf[1] === 0xd8)) { try { out = FR.prep(im.buf, aspect, 90); } catch (e) { out = null; } }
  if (!out) return { data: im.data, mime: im.mime, uncropped: true }; /* PNG/WebP – изпраща се както е */
  await putObj(st, fpath, out, "image/jpeg").catch(() => {});
  return { data: Buffer.from(out).toString("base64"), mime: "image/jpeg", path: fpath };
}

/* ---------- Vercel AI Gateway: кой ключ работи (проверка на кредитите) ---------- */
let gwCache = null;
async function gwAuth(req, fresh) {
  if (!fresh && gwCache && Date.now() - gwCache.at < 5 * 60000) return gwCache;
  const cands = [["AI_GATEWAY_API_KEY", E("AI_GATEWAY_API_KEY"), "api-key"], ["VERCEL_AI_GATEWAY_KEY", E("VERCEL_AI_GATEWAY_KEY"), "api-key"], ["AI_GATEWAY_KEY", E("AI_GATEWAY_KEY"), "api-key"]];
  const oidc = E("VERCEL_OIDC_TOKEN") || (req && req.headers && req.headers["x-vercel-oidc-token"]) || "";
  if (oidc) cands.push(["OIDC", oidc, "oidc"]);
  const tried = [];
  for (const c of cands) {
    if (!c[1]) continue;
    try {
      const r = await fetch(GW + "/v1/credits", { headers: { Authorization: "Bearer " + c[1], "ai-gateway-protocol-version": "0.0.1", "ai-gateway-auth-method": c[2] } });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.balance !== undefined) { gwCache = { ok: true, token: c[1], method: c[2], name: c[0], balance: j.balance, used: j.total_used, tried, at: Date.now() }; return gwCache; }
      tried.push(c[0] + ": " + r.status + " " + short((j.error && (j.error.message || j.error)) || j.message || ""));
    } catch (e) { tried.push(c[0] + ": " + short(e.message)); }
  }
  gwCache = { ok: false, err: tried.length ? tried.join("; ") : "няма ключ", tried, at: Date.now() };
  return gwCache;
}
const gwHeaders = (auth, model) => ({ "Content-Type": "application/json", Authorization: "Bearer " + auth.token, "ai-gateway-protocol-version": "0.0.1", "ai-gateway-auth-method": auth.method, "ai-video-model-specification-version": "4", "ai-model-id": model });
const gwErr = (j, s) => short((j && j.error && (j.error.message || j.error)) || (j && j.message) || JSON.stringify(j || {}) || "HTTP " + s);
const nearest = (arr, v) => arr.reduce((a, x) => (Math.abs(x - v) < Math.abs(a - v) ? x : a), arr[0]);
async function gwStart(auth, spec, first, last, b, aspect) {
  if (!auth.ok) throw new Error("Vercel AI Gateway: няма валиден ключ (" + auth.err + ")");
  if (!first) throw new Error("Нужен е начален кадър");
  const body = { prompt: String(b.prompt || "").slice(0, 2400), n: 1, aspectRatio: aspect, duration: nearest(spec.durs, +b.duration || 5), generateAudio: false,
    frameImages: [{ image: { type: "file", mediaType: first.mime, data: first.data }, frameType: "first_frame" }].concat(last ? [{ image: { type: "file", mediaType: last.mime, data: last.data }, frameType: "last_frame" }] : []) };
  if (spec.id === "kling") body.providerOptions = { klingai: { mode: b.resolution === "1080p" ? "pro" : "std", negativePrompt: NEG } };
  const r = await fetch(GW + "/v4/ai/video-model/start", { method: "POST", headers: gwHeaders(auth, spec.model), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.operation === undefined) throw new Error(spec.name + " (Gateway " + r.status + "): " + gwErr(j, r.status));
  return { job: "gw:" + spec.model + "|" + Buffer.from(JSON.stringify(j.operation)).toString("base64url"), warnings: (j.warnings || []).map((w) => w.details || w.message || w.feature).filter(Boolean) };
}
async function gwStatus(auth, model, op) {
  if (!auth.ok) throw new Error("Vercel AI Gateway: няма валиден ключ");
  const r = await fetch(GW + "/v4/ai/video-model/status", { method: "POST", headers: gwHeaders(auth, model), body: JSON.stringify({ operation: op }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Gateway " + r.status + ": " + gwErr(j, r.status));
  if (j.status === "pending") return { done: false, status: "pending" };
  if (j.status === "error" || j.status === "cancelled") throw new Error("Генерирането не успя: " + short(j.error || j.status));
  const v = (j.videos || [])[0]; if (!v) throw new Error("Готово, но без видео в отговора");
  let buf;
  if (v.type === "base64") buf = Buffer.from(v.data, "base64");
  else if (v.type === "url") { const d = await fetch(v.url); if (!d.ok) throw new Error("Видеото не може да се свали (" + d.status + ")"); buf = Buffer.from(await d.arrayBuffer()); }
  else throw new Error("Неочакван формат на видеото (" + v.type + ")");
  return { done: true, buf, mime: v.mediaType || "video/mp4" };
}

/* ---------- Google Gemini Omni (Interactions API, фонов режим) ---------- */
async function omniStart(first, last, b, aspect) {
  if (!GKEY()) throw new Error("Липсва GEMINI_API_KEY");
  const dur = Math.max(3, Math.min(last ? 10 : 15, Math.round(+b.duration || 5)));
  const input = [];
  if (first) input.push({ type: "image", data: first.data, mime_type: first.mime });
  if (last) input.push({ type: "image", data: last.data, mime_type: last.mime });
  input.push({ type: "text", text: String(b.prompt || "").trim() || "Smooth cinematic camera move." });
  const rf = { type: "video", aspect_ratio: aspect, resolution: /^(360p|720p|1080p|4k)$/.test(b.resolution || "") ? b.resolution : "720p", duration: dur + "s" };
  const H = Object.assign({ "Content-Type": "application/json", "x-goog-api-key": GKEY() }, E("ND_OMNI_REV") || b.rev ? { "Api-Revision": E("ND_OMNI_REV") || b.rev } : {});
  let lastErr = "";
  for (const model of (b.model ? [b.model] : OMNI_MODELS())) {
    const r = await fetch(GAPI + "/interactions", { method: "POST", headers: H, body: JSON.stringify({ model, input, response_format: rf, background: true }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.id) return { job: "omni:" + j.id, status: j.status || "in_progress", model };
    lastErr = r.status + " " + short((j.error && j.error.message) || JSON.stringify(j));
    if (!(r.status === 404 || /not found|not supported|unknown model|is not available|invalid model/i.test(lastErr))) break;
  }
  throw new Error("Google Omni: " + lastErr);
}
function findVideo(j) {
  const out = [];
  (j.steps || []).forEach((s) => (s.content || []).forEach((c) => { if (c && c.type === "video") out.push(c); }));
  if (j.output_video) out.push(j.output_video);
  (j.output || []).forEach((c) => { if (c && c.type === "video") out.push(c); });
  return out[out.length - 1] || null;
}
async function omniStatus(id) {
  const r = await fetch(GAPI + "/interactions/" + encodeURIComponent(id), { headers: { "x-goog-api-key": GKEY() } });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error("Google Omni " + r.status + ": " + short((j.error && j.error.message) || ""));
  const st = j.status || "in_progress";
  if (st === "failed" || st === "cancelled" || st === "incomplete") throw new Error("Google Omni не успя: " + short((j.errors || []).map((e) => [e.code, e.message].filter(Boolean).join(" ")).join("; ") || st));
  if (st !== "completed") return { done: false, status: st };
  const v = findVideo(j); if (!v) throw new Error("Готово, но без видео в отговора");
  let buf;
  if (v.data) buf = Buffer.from(v.data, "base64");
  else if (v.uri) { const u = /:download/.test(v.uri) ? v.uri : v.uri.replace(/\/$/, "") + ":download?alt=media"; const d = await fetch(u, { headers: { "x-goog-api-key": GKEY() } }); if (!d.ok) throw new Error("Видеото не може да се свали (" + d.status + ")"); buf = Buffer.from(await d.arrayBuffer()); }
  else throw new Error("Видеото няма данни");
  return { done: true, buf, mime: v.mime_type || "video/mp4" };
}

/* ---------- OpenAI Sora 2 ---------- */
async function soraStart(first, b, aspect) {
  const secs = nearest([4, 8, 12], +b.duration || 8);
  const fd = new FormData();
  fd.append("model", E("ND_SORA_MODEL") || "sora-2"); fd.append("prompt", String(b.prompt || "").trim());
  fd.append("size", aspect === "16:9" ? "1280x720" : "720x1280"); fd.append("seconds", String(secs));
  if (first) fd.append("input_reference", new Blob([Buffer.from(first.data, "base64")], { type: first.mime }), "first.jpg");
  const r = await fetch("https://api.openai.com/v1/videos", { method: "POST", headers: { Authorization: "Bearer " + E("OPENAI_API_KEY") }, body: fd });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error("Sora: " + short((j.error && j.error.message) || "HTTP " + r.status));
  return { job: "sora:" + j.id, status: j.status || "queued" };
}
async function soraStatus(id) {
  const H = { Authorization: "Bearer " + E("OPENAI_API_KEY") };
  const r = await fetch("https://api.openai.com/v1/videos/" + encodeURIComponent(id), { headers: H });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error("Sora: " + short((j.error && j.error.message) || "HTTP " + r.status));
  if (j.status === "failed") throw new Error("Sora не успя: " + short((j.error && j.error.message) || ""));
  if (j.status !== "completed") return { done: false, status: j.status, progress: j.progress };
  const d = await fetch("https://api.openai.com/v1/videos/" + encodeURIComponent(id) + "/content", { headers: H }); if (!d.ok) throw new Error("Видеото не може да се свали (" + d.status + ")");
  return { done: true, buf: Buffer.from(await d.arrayBuffer()), mime: "video/mp4" };
}

/* ---------- двигатели, старт, статус ---------- */
async function engines(req) {
  const out = [], gw = await gwAuth(req);
  if (gw.ok) Object.keys(GW_VIDEO).forEach((k) => { const s = GW_VIDEO[k]; out.push({ id: s.id, name: s.name + " (Vercel AI Gateway)", note: s.note, price: s.price, frames: 2, durs: s.durs }); });
  if (GKEY()) out.push({ id: "omni", name: "Google Omni Flash", note: "нужен е платен Gemini ключ", price: 0.10, frames: 2, durs: [3, 4, 5, 6, 7, 8, 9, 10] });
  if (E("OPENAI_API_KEY")) out.push({ id: "sora", name: "OpenAI Sora 2", note: "само начален кадър", price: 0.10, frames: 1, durs: [4, 8, 12] });
  return { engines: out, gateway: gw.ok ? { ok: true, balance: gw.balance, via: gw.name } : { ok: false, error: gw.err } };
}
async function start(st, b, req) {
  const eng = String(b.engine || "omni"), aspect = b.aspect === "16:9" ? "16:9" : "9:16";
  const first = await frame(st, b.first, aspect, b.noCrop), last = b.last ? await frame(st, b.last, aspect, b.noCrop) : null;
  if (GW_VIDEO[eng]) return gwStart(await gwAuth(req), GW_VIDEO[eng], first, last, b, aspect);
  if (eng === "sora") { if (!E("OPENAI_API_KEY")) throw new Error("Липсва OPENAI_API_KEY"); return soraStart(first, b, aspect); }
  if (eng === "omni") return omniStart(first, last, b, aspect);
  throw new Error("Непознат двигател: " + eng);
}
async function status(job, req) {
  let m;
  if ((m = /^omni:(.+)$/.exec(job || ""))) return omniStatus(m[1]);
  if ((m = /^sora:(.+)$/.exec(job || ""))) return soraStatus(m[1]);
  if ((m = /^gw:([^|]+)\|(.+)$/.exec(job || ""))) return gwStatus(await gwAuth(req), m[1], JSON.parse(Buffer.from(m[2], "base64url").toString("utf8")));
  throw new Error("Невалидна задача");
}

/* ---------- сценарий „строеж“ (форматът на автора), празен парцел, подредба на снимките ---------- */
const BUILD_RULES =
  "You write shot lists for ultra-realistic AI construction time-lapse videos of a real property, exactly in this format. " +
  "The viewer sees the SAME property transform from untouched empty land into the finished building and garden shown in the photo. " +
  "Rules: 5–7 clips; each clip 5–7 seconds; every clip continues EXACTLY from the previous clip's end state (last frame = next first frame); " +
  "the camera never moves ([CAMERA LOCK]) and the environment, walls, background, horizon, weather, time of day and lighting stay identical ([MASTER ENVIRONMENT LOCK]); " +
  "the final clip ends on the finished property exactly as in the photo. Typical order: survey and marking → clearing and leveling → excavation → foundations/pool shell → walls and structure → finishes, pool water, paving → landscaping, furniture, lighting. " +
  "Each clip's 'prompt' must follow this exact template, in English:\n" +
  "[MASTER ENVIRONMENT LOCK]. [CAMERA LOCK].\n\nSTARTING STATE: <continue exactly from the previous clip: …>\n\nTRANSFORMATION: <what workers/machinery realistically do, at authentic accelerated time-lapse speed>\n\nENDING STATE: <the new state, clearly visible>\n\n" +
  "Preserve the exact same architecture, background, environment layout, camera perspective, weather, time of day, and lighting established in the master environment. Do not redesign unrelated parts of the scene.\n\n" +
  "Ultra-realistic authentic time-lapse footage, realistic human movement, physically believable activity, detailed ground textures, consistent scale, seamless visual continuity, {ASPECT}.\n" +
  "For clip 1 the STARTING STATE describes the untouched empty outdoor property with bare dusty earth (no luxury features) and workers entering to survey. " +
  "Return ONLY JSON: {\"clips\":[{\"n\":1,\"title\":\"CLIP 1 — SURVEY AND MARKING\",\"duration\":\"5–7 seconds\",\"start\":\"…\",\"transformation\":\"…\",\"end\":\"…\",\"continuity\":\"…\",\"prompt\":\"…\",\"bg\":\"кратко описание на клипа на български\"}]}";
async function gemText(parts, model) {
  const r = await fetch(GAPI + "/models/" + model + ":generateContent?key=" + encodeURIComponent(GKEY()), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.4, responseMimeType: "application/json" } }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
  return ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || "").join("");
}
function parseJson(t) { try { return JSON.parse(t); } catch (e) { const m = String(t).match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error("Невалиден отговор от модела"); } }
async function script(st, b) {
  const img = await image(st, b.photo); if (!img) throw new Error("Нужна е снимка на готовия имот");
  const aspect = b.aspect === "16:9" ? "16:9 horizontal" : "9:16 vertical";
  const user = "Property: " + (b.title || "") + (b.city ? ", " + b.city : "") + (b.notes ? ". Notes: " + b.notes : "") + ". Write the shot list for this exact property (the photo shows the finished result). Use {ASPECT} = \"" + aspect + "\".";
  let text = null, used = null;
  const m = LLM && b.model ? LLM.pick(b.model) : null;
  if (m && m.vision && m.provider !== "gemini") {
    try { text = await LLM.chat(m, { system: BUILD_RULES, msgs: [{ role: "user", text: user, files: [{ mime: img.mime, data: img.data }] }], tools: [], run: async () => ({}), maxSteps: 1, temperature: 0.4 }); used = m.id; } catch (e) { text = null; }
  }
  if (!text) { for (const mm of TEXT_MODELS) { try { text = await gemText([{ text: BUILD_RULES + "\n\n" + user }, { inline_data: { mime_type: img.mime, data: img.data } }], mm); used = mm; break; } catch (e) { if (mm === TEXT_MODELS[TEXT_MODELS.length - 1]) throw e; } } }
  const j = parseJson(text); const clips = (j.clips || []).filter((c) => c && c.prompt).slice(0, 8).map((c, i) => Object.assign({ n: i + 1 }, c, { prompt: String(c.prompt).replace(/\{ASPECT\}/g, aspect) }));
  if (!clips.length) throw new Error("Моделът не върна клипове");
  return { clips, model: used };
}
async function lot(st, b) {
  const img = await image(st, b.photo); if (!img) throw new Error("Нужна е снимка на имота");
  const prompt = "Edit this photo into the MASTER ENVIRONMENT for a construction time-lapse: show the exact same plot as untouched empty land BEFORE anything was built – bare dusty earth, no building, no pool, no garden, no furniture, no luxury features. " +
    "Keep the identical camera perspective, framing, boundary/perimeter walls (unfinished if any), neighbouring buildings, horizon, distant background, weather, time of day and lighting. Photorealistic, same resolution, nothing else changed.";
  let last = null;
  for (const m of IMG_MODELS) {
    try {
      const r = await fetch(GAPI + "/models/" + m + ":generateContent?key=" + encodeURIComponent(GKEY()), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: img.mime, data: img.data } }] }], generationConfig: { responseModalities: ["IMAGE"] } }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
      const p = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find((x) => x.inlineData || x.inline_data); if (!p) throw new Error("Няма изображение в отговора");
      const d = p.inlineData || p.inline_data, mime = d.mimeType || d.mime_type || "image/png", buf = Buffer.from(d.data, "base64");
      const path = safe(b.save || ("ted/video/lot-" + Date.now() + ".png")); await putObj(st, path, buf, mime);
      return { path, url: await signUrl(st, path), mime };
    } catch (e) { last = e; }
  }
  throw last || new Error("Не успях да създам парцела");
}
const ROOM_IDS = ["out", "entry", "living", "dining", "kitchen", "stairs", "bedroom", "bath", "patio", "pool", "garden", "final", "other"];
async function route(st, b) {
  const ph = (b.photos || []).filter((x) => x && x.data).slice(0, 30); if (ph.length < 2) throw new Error("Нужни са поне 2 снимки");
  let land = 0; ph.forEach((x) => { const s = FR.jpegSize(Buffer.from(x.data, "base64")); if (s && s.w > s.h) land++; });
  const aspect = land * 2 >= ph.length ? "16:9" : "9:16";
  if (!GKEY()) return { order: ph.map((x, k) => ({ i: k, room: k === 0 ? "out" : k === ph.length - 1 ? "final" : "other" })), aspect };
  const parts = [{ text: "These are listing photos of ONE property, numbered 0.." + (ph.length - 1) + " in the order given. Task 1: label each photo with one room id from: " + ROOM_IDS.join(", ") + " (out = exterior/street/facade, final = an exterior or aerial view suitable as the closing shot, other = anything else). " +
    "Task 2: order ALL photos as a walkthrough route for a real-estate video: start outside, then the entrance, living room, dining, kitchen, staircase, bedrooms, bathrooms, covered patio, pool/garden, and finish with a final exterior view. Keep adjacent rooms next to each other so each pair blends naturally; use every photo exactly once. " +
    "Return ONLY JSON: {\"order\":[{\"i\":<photo index>,\"room\":\"<id>\"}]}" }];
  ph.forEach((x, k) => { parts.push({ text: "Photo " + k + ":" }); parts.push({ inline_data: { mime_type: x.mime || "image/jpeg", data: x.data } }); });
  let text = null; for (const m of TEXT_MODELS) { try { text = await gemText(parts, m); break; } catch (e) { if (m === TEXT_MODELS[TEXT_MODELS.length - 1]) throw e; } }
  const j = parseJson(text); const seen = {}; const order = [];
  (j.order || []).forEach((o) => { const i = +o.i; if (i >= 0 && i < ph.length && !seen[i]) { seen[i] = 1; order.push({ i, room: ROOM_IDS.includes(o.room) ? o.room : "other" }); } });
  ph.forEach((x, k) => { if (!seen[k]) order.push({ i: k, room: "other" }); });
  if (order.length && order[0].room === "other") order[0].room = "out"; if (order.length > 1 && !/^(final|out|garden|pool)$/.test(order[order.length - 1].room)) order[order.length - 1].room = "final";
  return { order, aspect };
}

/* ---------- самопроверка (временен ключ в nd_secrets, изтича сам) ---------- */
async function diagOk(t) {
  if (!t || !SR()) return false;
  const r = await fetch(SB_URL + "/rest/v1/nd_secrets?key=eq.video_diag&select=value", { headers: srSt().h() }).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => []) : []; const v = j[0] && j[0].value;
  return !!(v && v.token && v.token === t && Date.parse(v.until) > Date.now());
}
async function diag(req, res, q) {
  if (!(await diagOk(q.get("diag")))) return send(res, 403, { ok: false, error: "forbidden" });
  const st = srSt(), d = q.get("do");
  try {
    if (d === "keys") {
      const gw = await gwAuth(req, true), host = (() => { try { return new URL(E("AI_GATEWAY_URL")).host; } catch (e) { return E("AI_GATEWAY_URL") ? "(не е URL)" : ""; } })();
      return send(res, 200, { ok: true, keys: { GEMINI: !!GKEY(), AI_GATEWAY_API_KEY: !!E("AI_GATEWAY_API_KEY"), VERCEL_AI_GATEWAY_KEY: !!E("VERCEL_AI_GATEWAY_KEY"), AI_GATEWAY_KEY: !!E("AI_GATEWAY_KEY"), AI_GATEWAY_URL_host: host, OPENAI: !!E("OPENAI_API_KEY"), ANTHROPIC: !!E("ANTHROPIC_API_KEY"), OIDC_env: !!E("VERCEL_OIDC_TOKEN"), OIDC_header: !!req.headers["x-vercel-oidc-token"], SERVICE_ROLE: !!SR() }, gateway: gw.ok ? { ok: true, via: gw.name, balance: gw.balance, used: gw.used, tried: gw.tried } : { ok: false, tried: gw.tried } });
    }
    if (d === "frame") { const f = await frame(st, { path: q.get("path") }, q.get("aspect") || "9:16"); return send(res, 200, { ok: true, path: f.path || null, cached: !!f.cached, bytes: Buffer.from(f.data, "base64").length, uncropped: !!f.uncropped }); }
    if (d === "start") {
      const b = { engine: q.get("engine") || "omni", prompt: q.get("prompt") || "Smoothly blend from the first image into the second image and keep the camera stable and make the transitions seamless. Then, follow the camera path through the property.", first: { path: q.get("first") }, last: q.get("last") ? { path: q.get("last") } : null, aspect: q.get("aspect") || "9:16", duration: +q.get("dur") || 5, resolution: q.get("res") || "720p", noCrop: q.get("crop") === "0", model: q.get("model") || "", rev: q.get("rev") || "" };
      return send(res, 200, Object.assign({ ok: true }, await start(st, b, req)));
    }
    if (d === "status") {
      const s = await status(q.get("job"), req);
      if (!s.done) return send(res, 200, { ok: true, done: false, status: s.status });
      const path = "ted/video/diag/clip-" + Date.now() + ".mp4"; await putObj(st, path, s.buf, s.mime || "video/mp4");
      return send(res, 200, { ok: true, done: true, path, size: s.buf.length, mime: s.mime, url: await signUrl(st, path, 3600) });
    }
    return send(res, 400, { ok: false, error: "do=?" });
  } catch (e) { return send(res, 200, { ok: false, error: short(e.message || e) }); }
}

module.exports = async (req, res) => {
  if (req.method === "GET") { const q = new URL(req.url, "http://x").searchParams; if (q.get("diag")) return diag(req, res, q); return send(res, 405, { ok: false, error: "POST only" }); }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok || !(await isStaff(tok).catch(() => false))) return send(res, 401, { ok: false, error: "Само за екипа на CRM" });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  const st = userSt(tok);
  try {
    if (b.action === "engines") return send(res, 200, Object.assign({ ok: true }, await engines(req)));
    if (b.action === "route") return send(res, 200, Object.assign({ ok: true }, await route(st, b)));
    if (b.action === "script") { if (!GKEY() && !(LLM && b.model)) throw new Error("Няма ключ за AI (GEMINI_API_KEY)"); return send(res, 200, Object.assign({ ok: true }, await script(st, b))); }
    if (b.action === "lot") { if (!GKEY()) throw new Error("Празният парцел се прави с Gemini – липсва GEMINI_API_KEY"); return send(res, 200, Object.assign({ ok: true }, await lot(st, b))); }
    if (b.action === "start") return send(res, 200, Object.assign({ ok: true }, await start(st, b, req)));
    if (b.action === "status") {
      const s = await status(b.job, req);
      if (!s.done) return send(res, 200, { ok: true, done: false, status: s.status, progress: s.progress || null });
      const path = safe(b.save || ("ted/video/clip-" + Date.now() + ".mp4"));
      await putObj(st, path, s.buf, s.mime || "video/mp4");
      return send(res, 200, { ok: true, done: true, path, url: await signUrl(st, path), size: s.buf.length, mime: s.mime || "video/mp4" });
    }
    return send(res, 400, { ok: false, error: "Непознато действие" });
  } catch (e) { return send(res, 502, { ok: false, error: short(e.message || e) }); }
};
