// Voice helpers: reading answers aloud through ted.voice.tts and recording the microphone for
// ted.voice.transcribe. No audio leaves the renderer except through the bridge.
import { ted } from "../bridge.js";
import { blobToBase64 } from "./files.js";
import { plainText } from "./format.js";

// Long answers are read in parts: a short first part for a quick start, then parts of up to 900 chars.
export function chunksOf(text) {
  const sentences = String(text).match(/[^.!?…;:\n]+[.!?…;:\n]*\s*/g) || [String(text)];
  const out = []; let cur = ""; let lim = 260;
  for (let x of sentences) {
    if (cur && (cur + x).length > lim) { out.push(cur.trim()); cur = ""; lim = 900; }
    while (x.length > 900) { out.push(x.slice(0, 900).trim()); x = x.slice(900); lim = 900; }
    cur += x;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

// One player for the whole app: starting a new text stops the previous one.
export function createSpeaker() {
  const audio = new Audio();
  let run = 0;
  let urls = [];
  let done = null;

  function cleanup() {
    audio.onended = null; audio.onerror = null;
    try { audio.pause(); } catch { /* nothing is playing */ }
    urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
  }
  function finish(result) {
    cleanup();
    const d = done; done = null;
    if (d) d(result);
  }
  function stop() { run++; finish({ ok: true, stopped: true }); }

  // Resolves when the reading ends: {ok:true} | {ok:true, stopped:true} | {ok:false, error}.
  function speak(text, { voice, style } = {}) {
    stop();
    const mine = ++run;
    const parts = chunksOf(plainText(text));
    if (!parts.length) return Promise.resolve({ ok: true });
    const pending = {};
    const get = (i) => {
      if (i >= parts.length) return Promise.resolve(null);
      if (!pending[i]) {
        pending[i] = ted.voice.tts({ text: parts[i], voice, style }).then((r) => {
          if (!r || !r.ok) throw new Error((r && r.error) || "Гласът не е наличен.");
          const url = URL.createObjectURL(new Blob([r.wav], { type: "audio/wav" }));
          if (mine === run) urls.push(url); else URL.revokeObjectURL(url);
          return url;
        });
      }
      return pending[i];
    };
    return new Promise((resolve) => {
      done = resolve;
      const fail = (e) => { if (mine === run) finish({ ok: false, error: String((e && e.message) || "Гласът не може да бъде възпроизведен.") }); };
      const play = (i) => {
        if (mine !== run) return;
        if (i >= parts.length) { finish({ ok: true }); return; }
        get(i).then((url) => {
          if (mine !== run) return;
          audio.onended = () => play(i + 1);
          audio.onerror = () => fail(new Error("Аудиото не може да бъде възпроизведено."));
          audio.src = url;
          audio.play().catch(fail);
          get(i + 1).catch(() => {}); // prepare the next part while this one plays
        }).catch(fail);
      };
      play(0);
    });
  }

  return { speak, stop };
}

const MIC_ERRORS = {
  NotAllowedError: "Микрофонът не е разрешен. Разрешете достъпа в Windows: Настройки → Поверителност и защита → Микрофон.",
  SecurityError: "Микрофонът не е разрешен за програмата.",
  NotFoundError: "Не е открит микрофон на този компютър.",
  NotReadableError: "Микрофонът се използва от друга програма.",
};

// Starts recording. {ok:true, stop(), cancel()} | {ok:false, error}. stop() -> {ok, mime, data} (base64).
export async function startRecorder({ maxMs = 120000, onLimit } = {}) {
  if (!navigator.mediaDevices || !window.MediaRecorder) return { ok: false, error: "Записът от микрофона не е наличен." };
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { return { ok: false, error: MIC_ERRORS[e && e.name] || "Микрофонът не стартира." }; }
  const type = ["audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
  let rec;
  try { rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); }
  catch { stream.getTracks().forEach((t) => t.stop()); return { ok: false, error: "Записът от микрофона не стартира." }; }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const release = () => { clearTimeout(timer); stream.getTracks().forEach((t) => t.stop()); };
  const stopped = new Promise((resolve) => { rec.onstop = resolve; rec.onerror = resolve; });
  const timer = setTimeout(() => { if (onLimit) onLimit(); }, maxMs);
  rec.start();

  async function stop() {
    if (rec.state !== "inactive") rec.stop();
    await stopped;
    release();
    const blob = new Blob(chunks, { type: "audio/webm" });
    if (!blob.size) return { ok: false, error: "Записът е празен – опитайте отново." };
    return { ok: true, mime: "audio/webm", data: await blobToBase64(blob) };
  }
  function cancel() {
    try { if (rec.state !== "inactive") rec.stop(); } catch { /* already stopped */ }
    release();
  }
  return { ok: true, stop, cancel };
}
