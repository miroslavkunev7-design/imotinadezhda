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
  /* глас и стил от настройките на чата (Gemini TTS гласове) */
  const VOICES = ["Charon", "Achernar", "Despina", "Puck", "Kore", "Aoede", "Leda", "Zephyr", "Enceladus", "Callirrhoe"];
  const voice = VOICES.includes(String(b.voice || "")) ? String(b.voice) : "Charon";
  const STYLE = { calm: "Прочети на български с топъл, спокоен и ясен глас, с естествено темпо:", brief: "Прочети на български делово, ясно и малко по-бързо, без излишни паузи:", slow: "Прочети на български бавно, отчетливо и ясно, с малки паузи между изреченията:" };
  const style = STYLE[String(b.style || "")] || STYLE.calm;
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) return fail(500, "Няма ключ");
  /* наличните гласови модели се откриват от Google (имената на preview моделите се сменят); Flash преди Pro */
  let models = MODELS.slice();
  try {
    const lr = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=" + encodeURIComponent(key));
    const lj = await lr.json();
    const found = (lj.models || []).map((m) => String(m.name || "").replace(/^models\//, "")).filter((n) => /tts/i.test(n));
    if (found.length) models = found.sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || (/preview/.test(a) - /preview/.test(b)) || b.localeCompare(a)).concat(MODELS.filter((m) => !found.includes(m)));
  } catch (e) {}
  let last = "";
  const errs = [];
  for (const model of models.slice(0, 5)) {
    for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: style + "\n" + text }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } }
        })
      });
      const j = await r.json();
      if (!r.ok) {
        last = (j.error && j.error.message) || "HTTP " + r.status;
        const wait = r.status === 429 ? Math.ceil(parseFloat((last.match(/retry in ([\d.]+)\s*s/i) || [])[1] || "0")) : 0;
        if (r.status === 429 && attempt === 0 && wait > 0 && wait <= 12) { await new Promise((ok) => setTimeout(ok, wait * 1000 + 300)); continue; }
        errs.push(model + ": " + last.split("\n")[0].slice(0, 160)); break;
      }
      const part = (((j.candidates || [])[0] || {}).content || {}).parts?.find((p) => p.inlineData || p.inline_data);
      const d = part && (part.inlineData || part.inline_data);
      if (!d || !d.data) { errs.push(model + ": няма аудио"); break; }
      const rate = Number((/rate=(\d+)/.exec(d.mimeType || d.mime_type || "") || [])[1]) || 24000;
      const out = wav(Buffer.from(d.data, "base64"), rate);
      res.statusCode = 200; res.setHeader("Content-Type", "audio/wav"); res.setHeader("Cache-Control", "no-store"); res.setHeader("Content-Length", out.length);
      return res.end(out);
    } catch (e) { errs.push(model + ": " + String(e.message || e).slice(0, 160)); break; }
    }
  }
  return fail(502, "Гласът не е наличен: " + (errs.join(" | ") || last));
};
