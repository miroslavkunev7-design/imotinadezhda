// /api/tts — reads a text of Тед Асистент aloud (Google Gemini TTS, Bulgarian) and returns audio/wav.
const MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"];
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = []; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
module.exports = async (req, res) => {
  const fail = (s, e) => { res.statusCode = s; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify({ ok: false, error: e })); };
  if (req.method !== "POST") return fail(405, "POST only");
  const auth = String(req.headers["authorization"] || ""); const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const SB = "https://hyvwfsmjbaynozceookv.supabase.co", K = "sb_publishable_wtwa6JU-FNbbRINe4A1lTA_DYQvINni";
  const okStaff = token && await fetch(SB + "/rest/v1/rpc/nd_is_staff", { method: "POST", headers: { apikey: K, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: "{}" }).then((r) => r.ok ? r.json() : false).catch(() => false);
  if (okStaff !== true) return fail(401, "Само за CRM");
  let b; try { b = await readBody(req); } catch (e) { return fail(400, "Невалидни данни"); }
  const text = String(b.text || "").replace(/\s+/g, " ").trim().slice(0, 2500);
  if (!text) return fail(400, "Няма текст");
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return fail(500, "Няма ключ");
  let last = "";
  for (const model of MODELS) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Прочети на български с топъл, спокоен и ясен глас, с естествено темпо:\n" + text }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } } }
        })
      });
      const j = await r.json();
      if (!r.ok) { last = (j.error && j.error.message) || "HTTP " + r.status; continue; }
      const part = (((j.candidates || [])[0] || {}).content || {}).parts?.find((p) => p.inlineData || p.inline_data);
      const d = part && (part.inlineData || part.inline_data);
      if (!d || !d.data) { last = "Няма аудио"; continue; }
      const rate = Number((/rate=(\d+)/.exec(d.mimeType || d.mime_type || "") || [])[1]) || 24000;
      const out = wav(Buffer.from(d.data, "base64"), rate);
      res.statusCode = 200; res.setHeader("Content-Type", "audio/wav"); res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Length", out.length);
      return res.end(out);
    } catch (e) { last = String(e.message || e); }
  }
  return fail(502, "Гласът не е наличен: " + last);
};
