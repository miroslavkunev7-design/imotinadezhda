import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { ted } from "../bridge.js";
import { startRecorder } from "../lib/voice.js";
import { plainText } from "../lib/format.js";
import avatar from "../assets/avatar.webp";

// Voice conversation: microphone -> ted.voice.transcribe -> the normal chat -> ted.voice.tts.
// ask(question, done) sends the text; speak(text) resolves when the reading ends.
export default function VoiceMode({ close, toast, ask, speak, stopSpeak }) {
  const [st, setSt] = useState("idle");
  const [heard, setHeard] = useState("");
  const [answer, setAnswer] = useState("");
  const [problem, setProblem] = useState("");
  const recRef = useRef(null);
  const alive = useRef(true);

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    document.addEventListener("keydown", k);
    return () => {
      alive.current = false;
      document.removeEventListener("keydown", k);
      if (recRef.current) recRef.current.cancel();
      stopSpeak();
    };
  }, []);

  async function finishRecording() {
    const rec = recRef.current; recRef.current = null;
    if (!rec) return;
    setSt("thinking");
    const out = await rec.stop();
    if (!alive.current) return;
    if (!out.ok) { setProblem(out.error); setSt("idle"); return; }
    let t;
    try { t = await ted.voice.transcribe({ mime: out.mime, data: out.data }); } catch { t = null; }
    if (!alive.current) return;
    if (!t || !t.ok) { setProblem((t && t.error) || "Разпознаването не успя."); setSt("idle"); return; }
    const q = String(t.text || "").trim();
    if (!q) { setProblem("Не чух въпрос – опитайте отново."); setSt("idle"); return; }
    setHeard(q); setAnswer("");
    ask(q, async (a) => {
      if (!alive.current) return;
      setAnswer(a || "");
      if (!a) { setSt("idle"); return; }
      setSt("speaking");
      const r = await speak(a);
      if (!alive.current) return;
      if (r && !r.ok) toast(r.error);
      setSt((x) => (x === "speaking" ? "idle" : x));
    });
  }

  async function mic() {
    setProblem("");
    if (st === "thinking") return;
    if (st === "speaking") { stopSpeak(); setSt("idle"); return; }
    if (st === "listening") { finishRecording(); return; }
    setHeard(""); setAnswer(""); setSt("starting");
    const rec = await startRecorder({ maxMs: 120000, onLimit: () => finishRecording() });
    if (!alive.current) { if (rec.ok) rec.cancel(); return; }
    if (!rec.ok) { setProblem(rec.error); setSt("idle"); return; }
    recRef.current = rec; setSt("listening");
  }

  const label = { idle: "Натиснете микрофона и говорете", starting: "Включвам микрофона…", listening: "🎙️ Слушам… натиснете отново, когато сте готови", thinking: "💭 Тед работи…", speaking: "🔊 Тед говори…" }[st];
  const plain = plainText(answer);
  return (
    <div className="voice" role="dialog" aria-label="Гласов режим">
      <div className={"orb " + st}><img src={avatar} alt="" /></div>
      <h2>Гласов режим</h2>
      <p className="vl">{label}</p>
      {heard ? <p className="vq">„{heard}“</p> : null}
      {answer ? <p className="va">{plain.slice(0, 280)}{plain.length > 280 ? "…" : ""}</p> : null}
      {problem ? <p className="vn" role="alert">⚠️ {problem}</p> : null}
      <div className="vb">
        <button className={"micb " + st} aria-label="Микрофон" onClick={mic} disabled={st === "thinking" || st === "starting"}>{st === "listening" || st === "starting" ? <Icon n="stopsq" fill="currentColor" /> : <Icon n="mic" />}</button>
        <button className="end" aria-label="Край" onClick={close}><Icon n="x" /></button>
      </div>
      <p className="vn">Записът се изпраща за разпознаване към сървъра на Тед · Esc затваря</p>
    </div>
  );
}
