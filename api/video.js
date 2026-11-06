// /api/video – „AI Видео на имот“ за Тед. Генерира кратки клипове от снимки (първи + последен кадър) и ускорен „строеж“
// по сценарий, със същите промптове като в обучителните видеа. Двигатели: Google Gemini Omni Flash (ключът GEMINI_API_KEY,
// Interactions API, фонов режим) и OpenAI Sora 2 (OPENAI_API_KEY, само първи кадър). Ключовете са само във Vercel.
// POST JSON + Authorization: Bearer <CRM token>. Действия:
//   engines  → наличните двигатели и ориентировъчни цени
//   script   → сценарий за „строеж“ по снимка на имота (формат CLIP N — … / Start / Transformation / End / Continuity / Prompt)
//   lot      → „празен парцел“ (master environment) от снимката на готовия имот (Gemini image)
//   start    → пуска генерирането на един клип { engine, prompt, first, last, aspect, duration, resolution } → { job }
//   status   → проверява клип; при готовност сваля видеото, качва го в nd-files на подадения път и връща подписан линк
"use strict";
const SB_URL = "https://hyvwfsmjbaynozceookv.supabase.co";
const SB_KEY = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
const E = (k) => process.env[k] || "";
const GKEY = () => E("GEMINI_API_KEY") || E("GOOGLE_GENERATIVE_AI_API_KEY");
const OMNI = E("ND_OMNI_MODEL") || "gemini-omni-1.1-flash";
const IMG_MODELS = ["gemini-2.5-flash-image", "gemini-2.5-flash-image-preview"];
const TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
const GAPI = "https://generativelanguage.googleapis.com/v1beta";
const REV = { "Api-Revision": "2026-05-20" };
let LLM = null; try { LLM = require("./_llm.js"); } catch (e) {}

function send(res, s, b) { res.statusCode = s; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(b)); }
async function readBody(req) { if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body; const ch = []; for await (const c of req) ch.push(c); return JSON.parse(Buffer.concat(ch).toString("utf8")); }
async function isStaff(token) {
  const u = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } }); if (!u.ok) return false;
  const r = await fetch(SB_URL + "/rest/v1/rpc/nd_is_staff", { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" });
  return r.ok && (await r.json()) === true;
}
const sbH = (tok) => ({ apikey: SB_KEY, Authorization: "Bearer " + tok });
const encPath = (p) => String(p).split("/").map(encodeURIComponent).join("/");
/* изображение от нашия bucket (path), от интернет (url) или подадено направо (data) → { data(base64), mime } */
async function image(tok, src) {
  if (!src) return null;
  if (src.data) return { data: src.data, mime: src.mime || "image/jpeg" };
  let r;
  if (src.path) r = await fetch(SB_URL + "/storage/v1/object/nd-files/" + encPath(src.path), { headers: sbH(tok) });
  else if (src.url && /^https?:/.test(src.url)) r = await fetch(src.url);
  else throw new Error("Няма снимка");
  if (!r.ok) throw new Error("Снимката не е достъпна (" + r.status + ")");
  const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 12 * 1048576) throw new Error("Снимката е над 12 MB");
  const ct = (r.headers.get("content-type") || "").split(";")[0];
  return { data: buf.toString("base64"), mime: /^image\//.test(ct) ? ct : (/\.png$/i.test(src.path || src.url || "") ? "image/png" : "image/jpeg") };
}
async function upload(tok, p, buf, mime) {
  const r = await fetch(SB_URL + "/storage/v1/object/nd-files/" + encPath(p), { method: "POST", headers: Object.assign(sbH(tok), { "Content-Type": mime, "x-upsert": "true" }), body: buf });
  if (!r.ok) throw new Error("Качването не успя (" + r.status + ")");
}
async function signed(tok, p, secs) {
  const r = await fetch(SB_URL + "/storage/v1/object/sign/nd-files/" + encPath(p), { method: "POST", headers: Object.assign(sbH(tok), { "Content-Type": "application/json" }), body: JSON.stringify({ expiresIn: secs || 86400 }) });
  const j = await r.json().catch(() => ({})); return j.signedURL ? SB_URL + "/storage/v1" + j.signedURL : null;
}
const safe = (p) => String(p || "").replace(/\.\./g, "").replace(/^\/+/, "").replace(/[^\w.\-\/а-яА-Я ]+/g, "_").slice(0, 180);

/* ---------- двигатели ---------- */
function engines() {
  const out = [];
  if (GKEY()) out.push({ id: "omni", name: "Google Omni Flash", note: "първи и последен кадър, 9:16, звук; ~0,10 $/сек (720p)", frames: 2, durations: [4, 6, 8, 10], res: ["720p", "1080p"] });
  if (E("OPENAI_API_KEY")) out.push({ id: "sora", name: "OpenAI Sora 2", note: "само първи кадър; 4/8/12 сек; ~0,10 $/сек", frames: 1, durations: [4, 8, 12], res: ["720p"] });
  return out;
}

/* ---------- Omni (Interactions API, фонов режим) ---------- */
async function omniStart(tok, b) {
  const first = await image(tok, b.first), last = await image(tok, b.last);
  const dur = Math.max(3, Math.min(10, Math.round(+b.duration || 6)));
  const input = [];
  if (first) input.push({ type: "image", data: first.data, mime_type: first.mime });
  if (last) input.push({ type: "image", data: last.data, mime_type: last.mime });
  let text = String(b.prompt || "").trim(); if (!text) throw new Error("Липсва промпт");
  if (first && last) text = "The first image is the exact first frame and the second image is the exact last frame of the video. " + text;
  else if (first) text = "The image is the exact first frame of the video. " + text;
  text += " Duration: " + dur + " seconds." + (b.audio === false ? " No dialogue, no music." : "");
  input.push({ type: "text", text });
  const rf = { type: "video", aspect_ratio: b.aspect === "16:9" ? "16:9" : "9:16", resolution: /^(360p|720p|1080p|4k)$/.test(b.resolution || "") ? b.resolution : "720p" };
  const body = { model: OMNI, input, response_format: Object.assign({ duration: dur + "s" }, rf), background: true };
  const call = (bd) => fetch(GAPI + "/interactions", { method: "POST", headers: Object.assign({ "Content-Type": "application/json", "x-goog-api-key": GKEY() }, REV), body: JSON.stringify(bd) });
  let r = await call(body), j = await r.json().catch(() => ({}));
  if (!r.ok && r.status === 400 && /duration/i.test(JSON.stringify(j))) { body.response_format = rf; r = await call(body); j = await r.json().catch(() => ({})); } /* полето за дължина не се поддържа → остава в текста */
  if (!r.ok) throw new Error(((j.error && j.error.message) || JSON.stringify(j).slice(0, 300) || "HTTP " + r.status));
  if (!j.id) throw new Error("Omni не върна идентификатор на задачата");
  return { job: "omni:" + j.id, status: j.status || "in_progress" };
}
function findVideo(j) {
  const out = [];
  (j.steps || []).forEach((s) => (s.content || []).forEach((c) => { if (c && c.type === "video") out.push(c); }));
  if (j.output_video) out.push(j.output_video);
  (j.output || []).forEach((c) => { if (c && c.type === "video") out.push(c); });
  return out[out.length - 1] || null;
}
async function omniStatus(id) {
  const r = await fetch(GAPI + "/interactions/" + encodeURIComponent(id), { headers: Object.assign({ "x-goog-api-key": GKEY() }, REV) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
  const st = j.status || "in_progress";
  if (st === "failed" || st === "cancelled" || st === "incomplete") throw new Error("Генерирането не успя: " + ((j.errors || []).map((e) => e.message || e.code).join("; ") || st));
  if (st !== "completed") return { done: false, status: st };
  const v = findVideo(j); if (!v) throw new Error("Готово, но без видео в отговора");
  let buf;
  if (v.data) buf = Buffer.from(v.data, "base64");
  else if (v.uri) {
    const u = /:download/.test(v.uri) ? v.uri : v.uri.replace(/\/$/, "") + ":download?alt=media";
    const d = await fetch(u, { headers: { "x-goog-api-key": GKEY() } }); if (!d.ok) throw new Error("Видеото не може да се свали (" + d.status + ")");
    buf = Buffer.from(await d.arrayBuffer());
  } else throw new Error("Видеото няма данни");
  return { done: true, buf, mime: v.mime_type || "video/mp4", usage: j.usage || null };
}

/* ---------- Sora 2 (OpenAI Videos API) ---------- */
async function soraStart(tok, b) {
  const first = await image(tok, b.first);
  const secs = [4, 8, 12].reduce((a, x) => Math.abs(x - (+b.duration || 8)) < Math.abs(a - (+b.duration || 8)) ? x : a, 8);
  const fd = new FormData();
  fd.append("model", E("ND_SORA_MODEL") || "sora-2"); fd.append("prompt", String(b.prompt || "").trim());
  fd.append("size", b.aspect === "16:9" ? "1280x720" : "720x1280"); fd.append("seconds", String(secs));
  if (first) fd.append("input_reference", new Blob([Buffer.from(first.data, "base64")], { type: first.mime }), "first.jpg");
  const r = await fetch("https://api.openai.com/v1/videos", { method: "POST", headers: { Authorization: "Bearer " + E("OPENAI_API_KEY") }, body: fd });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
  return { job: "sora:" + j.id, status: j.status || "queued" };
}
async function soraStatus(id) {
  const H = { Authorization: "Bearer " + E("OPENAI_API_KEY") };
  const r = await fetch("https://api.openai.com/v1/videos/" + encodeURIComponent(id), { headers: H });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
  if (j.status === "failed") throw new Error("Генерирането не успя: " + ((j.error && j.error.message) || ""));
  if (j.status !== "completed") return { done: false, status: j.status, progress: j.progress };
  const d = await fetch("https://api.openai.com/v1/videos/" + encodeURIComponent(id) + "/content", { headers: H }); if (!d.ok) throw new Error("Видеото не може да се свали (" + d.status + ")");
  return { done: true, buf: Buffer.from(await d.arrayBuffer()), mime: "video/mp4" };
}

/* ---------- сценарий „строеж“ (форматът на автора) и празен парцел ---------- */
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
  return (((j.candidates || [])[0] || {}).content || {}).parts.map((p) => p.text || "").join("");
}
function parseJson(t) { try { return JSON.parse(t); } catch (e) { const m = String(t).match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error("Невалиден отговор от модела"); } }
async function script(tok, b) {
  const img = await image(tok, b.photo); if (!img) throw new Error("Нужна е снимка на готовия имот");
  const aspect = b.aspect === "16:9" ? "16:9 horizontal" : "9:16 vertical";
  const user = "Property: " + (b.title || "") + (b.city ? ", " + b.city : "") + (b.notes ? ". Notes: " + b.notes : "") + ". Write the shot list for this exact property (the photo shows the finished result). Use {ASPECT} = \"" + aspect + "\".";
  let text = null, used = null;
  /* избран модел (Claude / ChatGPT / …) ако вижда снимки; иначе Gemini */
  const m = LLM && b.model ? LLM.pick(b.model) : null;
  if (m && m.vision && m.provider !== "gemini") {
    try { text = await LLM.chat(m, { system: BUILD_RULES, msgs: [{ role: "user", text: user, files: [{ mime: img.mime, data: img.data }] }], tools: [], run: async () => ({}), maxSteps: 1, temperature: 0.4 }); used = m.id; } catch (e) { text = null; }
  }
  if (!text) { for (const mm of TEXT_MODELS) { try { text = await gemText([{ text: BUILD_RULES + "\n\n" + user }, { inline_data: { mime_type: img.mime, data: img.data } }], mm); used = mm; break; } catch (e) { if (mm === TEXT_MODELS[TEXT_MODELS.length - 1]) throw e; } } }
  const j = parseJson(text); const clips = (j.clips || []).filter((c) => c && c.prompt).slice(0, 8).map((c, i) => Object.assign({ n: i + 1 }, c, { prompt: String(c.prompt).replace(/\{ASPECT\}/g, aspect) }));
  if (!clips.length) throw new Error("Моделът не върна клипове");
  return { clips, model: used };
}
async function lot(tok, b) {
  const img = await image(tok, b.photo); if (!img) throw new Error("Нужна е снимка на имота");
  const prompt = "Edit this photo into the MASTER ENVIRONMENT for a construction time-lapse: show the exact same plot as untouched empty land BEFORE anything was built – bare dusty earth, no building, no pool, no garden, no furniture, no luxury features. " +
    "Keep the identical camera perspective, framing, boundary/perimeter walls (unfinished if any), neighbouring buildings, horizon, distant background, weather, time of day and lighting. Photorealistic, same resolution, nothing else changed.";
  let last = null;
  for (const m of IMG_MODELS) {
    try {
      const r = await fetch(GAPI + "/models/" + m + ":generateContent?key=" + encodeURIComponent(GKEY()), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: img.mime, data: img.data } }] }], generationConfig: { responseModalities: ["IMAGE"] } }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
      const p = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find((x) => x.inlineData || x.inline_data); if (!p) throw new Error("Няма изображение в отговора");
      const d = p.inlineData || p.inline_data, mime = d.mimeType || d.mime_type || "image/png", buf = Buffer.from(d.data, "base64");
      const path = safe(b.save || ("ted/video/lot-" + Date.now() + ".png")); await upload(tok, path, buf, mime);
      return { path, url: await signed(tok, path), mime };
    } catch (e) { last = e; }
  }
  throw last || new Error("Не успях да създам парцела");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok || !(await isStaff(tok).catch(() => false))) return send(res, 401, { ok: false, error: "Само за екипа на CRM" });
  let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { ok: false, error: "Невалидни данни" }); }
  try {
    if (b.action === "engines") return send(res, 200, { ok: true, engines: engines(), omni: OMNI });
    if (!GKEY() && !E("OPENAI_API_KEY")) return send(res, 500, { ok: false, error: "Няма ключ за видео (GEMINI_API_KEY или OPENAI_API_KEY във Vercel)." });
    if (b.action === "script") return send(res, 200, Object.assign({ ok: true }, await script(tok, b)));
    if (b.action === "lot") return send(res, 200, Object.assign({ ok: true }, await lot(tok, b)));
    if (b.action === "start") {
      const eng = b.engine === "sora" ? "sora" : "omni";
      if (eng === "omni" && !GKEY()) throw new Error("Липсва GEMINI_API_KEY");
      if (eng === "sora" && !E("OPENAI_API_KEY")) throw new Error("Липсва OPENAI_API_KEY");
      return send(res, 200, Object.assign({ ok: true, engine: eng }, eng === "sora" ? await soraStart(tok, b) : await omniStart(tok, b)));
    }
    if (b.action === "status") {
      const m = String(b.job || "").match(/^(omni|sora):(.+)$/); if (!m) throw new Error("Невалидна задача");
      const st = m[1] === "sora" ? await soraStatus(m[2]) : await omniStatus(m[2]);
      if (!st.done) return send(res, 200, { ok: true, done: false, status: st.status, progress: st.progress || null });
      const path = safe(b.save || ("ted/video/clip-" + Date.now() + ".mp4"));
      await upload(tok, path, st.buf, st.mime || "video/mp4");
      return send(res, 200, { ok: true, done: true, path, url: await signed(tok, path), size: st.buf.length, mime: st.mime || "video/mp4", usage: st.usage || null });
    }
    return send(res, 400, { ok: false, error: "Непознато действие" });
  } catch (e) { return send(res, 502, { ok: false, error: String(e.message || e).slice(0, 400) }); }
};
