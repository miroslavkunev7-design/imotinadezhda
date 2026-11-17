import React, { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { ted } from "../bridge.js";
import { safeFileName } from "../lib/chat.js";

// Local side editor with versions. Nothing here calls a model: edits are the user's own.
export default function Canvas({ cv, setCv, toast, copy }) {
  const cur = cv.versions.find((v) => v.v === cv.cur) || cv.versions[0];
  const [txt, setTxt] = useState(cur.text);
  useEffect(() => { setTxt(cur.text); }, [cv.cur, cv.title]);

  const commit = () => {
    if (txt === cur.text) { toast("Няма промени за запазване."); return; }
    const v = Math.max(...cv.versions.map((x) => x.v)) + 1;
    setCv({ ...cv, versions: [...cv.versions, { v, text: txt, at: Date.now(), label: "ръчна редакция" }], cur: v });
    toast("Нова версия " + v);
  };
  async function saveFile() {
    const r = await ted.app.saveFile({ suggestedName: safeFileName(cv.title, cv.kind === "code" ? "txt" : "md"), text: txt });
    if (r && r.ok) toast("✅ Запазено: " + r.path);
    else if (r && !r.canceled) toast(r.error || "Файлът не можа да се запише.");
  }

  return (
    <section className="canvas" aria-label="Canvas">
      <div className="cv-h">
        <b>{cv.title}</b>
        <select id="cv-ver" value={cv.cur} onChange={(e) => setCv({ ...cv, cur: +e.target.value })} aria-label="Версия">{cv.versions.map((v) => <option key={v.v} value={v.v}>Версия {v.v}{v.label ? " · " + v.label : ""}</option>)}</select>
        <button className="ibtn" onClick={commit} title="Запази версия" aria-label="Запази версия"><Icon n="check" /></button>
        <button className="ibtn" onClick={() => copy(txt)} title="Копирай" aria-label="Копирай"><Icon n="copy" /></button>
        <button className="ibtn" onClick={saveFile} title="Запази като файл" aria-label="Запази като файл"><Icon n="download" /></button>
        <button className="ibtn" onClick={() => setCv(null)} title="Затвори" aria-label="Затвори Canvas"><Icon n="x" /></button>
      </div>
      <div className="cv-body"><textarea id="cv-txt" className={cv.kind === "code" ? "code" : ""} value={txt} onChange={(e) => setTxt(e.target.value)} spellCheck={false} /></div>
      <div className="cv-foot">Работен текст на този компютър. Версиите се пазят, докато панелът е отворен.</div>
    </section>
  );
}
