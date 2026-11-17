// Voice through the production endpoint /api/voice: text-to-speech (audio/wav) and dictation.
// Read-only for the CRM, but still never retried automatically (each call spends AI quota).
import { SITE } from "./config.js";

export const VOICES = ["Charon", "Achernar", "Despina", "Puck", "Kore", "Aoede", "Leda", "Zephyr", "Enceladus", "Callirrhoe"];
export const STYLES = ["calm", "brief", "slow"];
const MAX_TTS_CHARS = 1200;                              // the server reads at most this much per request
const MAX_AUDIO_BASE64 = Math.floor(3.8 * 1024 * 1024); // stays under the 4.5 MB request limit
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const fail = (code, error, status) => ({ ok: false, error, code, ...(status ? { status } : {}) });
const invalid = (error) => fail("invalid", error);

function thrown(e) {
  if (e.code === "auth") return fail("auth", "Сесията е изтекла – влезте отново.");
  if (e.code === "timeout") return fail("timeout", "Сървърът не отговори навреме.");
  return fail("network", "Няма връзка със сървъра.");
}

function httpError(res, fallback) {
  const j = res.json;
  const text = j && typeof j.error === "string" && j.error.trim() ? j.error.trim().slice(0, 400) : "";
  if (res.status === 401) return fail("auth", "Сесията е изтекла – влезте отново.", 401);
  // transcribe answers an exhausted quota with 429; tts (api/_tts.js) with 502 "…: лимитът е изчерпан…". Same code for both.
  const quota = res.status === 429 || (res.status === 502 && /лимитът е изчерпан/.test(text));
  return fail(quota ? "quota" : "http", text || `${fallback} (HTTP ${res.status}).`, res.status);
}

export function createVoice({ session }) {
  async function tts(args) {
    const a = args && typeof args === "object" ? args : {};
    const text = typeof a.text === "string" ? a.text.replace(/\s+/g, " ").trim() : "";
    if (!text) return invalid("Няма текст за прочитане.");
    if (text.length > MAX_TTS_CHARS) return invalid(`Текстът е твърде дълъг за едно прочитане (над ${MAX_TTS_CHARS} знака).`);
    if (a.voice != null && !VOICES.includes(a.voice)) return invalid("Непознат глас.");
    if (a.style != null && !STYLES.includes(a.style)) return invalid("Непознат стил на четене.");
    let res;
    try {
      res = await session.authed({
        url: SITE + "/api/voice?fn=tts", method: "POST",
        json: { text, voice: a.voice || undefined, style: a.style || undefined }, timeoutMs: 60000, as: "arrayBuffer",
      });
    } catch (e) { return thrown(e); }
    if (!res.ok) return httpError(res, "Гласът не е наличен");
    const type = String(res.headers["content-type"] || "");
    if (!/^audio\//.test(type) || !res.buffer || !res.buffer.byteLength) return fail("http", "Сървърът не върна аудио.", res.status);
    return { ok: true, wav: res.buffer };
  }

  async function transcribe(args) {
    const a = args && typeof args === "object" ? args : {};
    const mime = String(a.mime || "").split(";")[0].trim().toLowerCase(); // drop ";codecs=opus"
    if (!/^audio\/[a-z0-9.+-]+$/.test(mime)) return invalid("Записът не е аудио.");
    if (typeof a.data !== "string" || !a.data || !BASE64.test(a.data)) return invalid("Няма запис.");
    if (a.data.length > MAX_AUDIO_BASE64) return invalid("Записът е твърде дълъг.");
    let res;
    try {
      res = await session.authed({ url: SITE + "/api/voice?fn=transcribe", method: "POST", json: { mime, data: a.data }, timeoutMs: 45000 });
    } catch (e) { return thrown(e); }
    const j = res.json;
    if (!(res.ok && j && j.ok === true)) return httpError(res, "Разпознаването не успя");
    return { ok: true, text: typeof j.text === "string" ? j.text : "" };
  }

  return { tts, transcribe };
}
