import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import Md from "./Md.jsx";
import { ted } from "../bridge.js";
import { safeFileName } from "../lib/chat.js";
import { safeSvg, splitSvg, svgDataUrl } from "../lib/svg.js";

// Read-only „Преглед“: Markdown through the existing Md component and the model's SVG drawings after
// sanitising (lib/svg.js), shown as <img> – no iframe, no HTML, no CSP change.
export function CanvasPreview({ text, copy }) {
  const parts = splitSvg(text);
  if (!parts.length) return <div className="empty">Документът е празен.</div>;
  return (
    <div className="cv-prev" data-testid="canvas-preview">
      {parts.map((p, i) => {
        if (p.type === "md") return <Md key={i} text={p.text} copy={copy} />;
        const clean = safeSvg(p.text);
        return clean
          ? <figure className="cv-fig" key={i}><img className="cv-svg" src={svgDataUrl(clean)} alt="Диаграма от Тед" /></figure>
          : <div className="note" key={i}>Тази графика не е показана: съдържа елементи, които програмата не изпълнява.</div>;
      })}
    </div>
  );
}

const EXPORTS = [["docx", "Word (.docx)"], ["pdf", "PDF (.pdf)"], ["md", "Markdown (.md)"]];

// Side document with versions (docs/CONTRACT.md §15, §16). The employee's edits and Тед's edits (update_canvas →
// a NEW version „Тед: <label>“) never overwrite each other: the version selector keeps every one.
// Props: {cv, setCv, toast, copy, onExport(format)}; cv = {title, kind, versions:[{v, text, at, label}], cur}.
// draft (a ref from the shell): the unsaved text, so the shell keeps it as a version when this chat's Canvas is put aside.
export default function Canvas({ cv, setCv, toast, copy, onExport, draft }) {
  const cur = cv.versions.find((v) => v.v === cv.cur) || cv.versions[0];
  const [txt, setTxt] = useState(cur.text);
  const [mode, setMode] = useState("edit");      // "edit" | "view"
  const [menu, setMenu] = useState(false);
  const base = useRef({ v: cur.v, text: cur.text }); // the version the text area was loaded from
  const txtRef = useRef(txt); txtRef.current = txt;
  const dirty = txt !== base.current.text;
  useEffect(() => { if (draft) draft.current = dirty ? txt : null; });
  useEffect(() => () => { if (draft) draft.current = null; }, []);
  const agentMade = cv.versions.some((v) => /^Тед:/.test(v.label || ""));

  // A different version on screen (the selector, or Тед added one). Unsaved typing is kept as its own version.
  useEffect(() => {
    const was = base.current;
    const mine = txtRef.current;
    if (was.v !== cur.v && mine !== was.text) {
      setCv((c) => {
        if (!c) return c;
        const v = Math.max(...c.versions.map((x) => x.v)) + 1;
        return { ...c, versions: [...c.versions, { v, text: mine, at: Date.now(), label: "ваша незапазена редакция" }] };
      });
      toast((/^Тед:/.test(cur.label || "") ? "Тед добави нова версия. " : "") + "Вашите незапазени промени са запазени като отделна версия.");
    }
    base.current = { v: cur.v, text: cur.text };
    setTxt(cur.text);
  }, [cv.cur, cur.text, cv.title]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (!e.target.closest || !e.target.closest(".cv-exp")) setMenu(false); };
    const k = (e) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", k); };
  }, [menu]);

  // Saves the typed text as a new version; returns true when something was saved.
  const commit = (quiet) => {
    if (txt === cur.text) { if (!quiet) toast("Няма промени за запазване."); return false; }
    const v = Math.max(...cv.versions.map((x) => x.v)) + 1;
    base.current = { v, text: txt };
    setCv((c) => (c ? { ...c, versions: [...c.versions, { v, text: txt, at: Date.now(), label: "ръчна редакция" }], cur: v } : c));
    if (!quiet) toast("Нова версия " + v);
    return true;
  };
  async function saveMd() {
    let r;
    try { r = await ted.app.saveFile({ suggestedName: safeFileName(cv.title, cv.kind === "code" ? "txt" : "md"), text: txt }); }
    catch { r = { ok: false, error: "Файлът не можа да се запише." }; }
    if (r && r.ok) toast("✅ Запазено: " + r.path);
    else if (r && !r.canceled) toast(r.error || "Файлът не можа да се запише.");
  }
  // Word/PDF go through the agent's create_document when the shell can (Real GPT with tools); the shell decides.
  function exportAs(format) {
    setMenu(false);
    const saved = commit(true); // the export uses the text as it is on screen
    if (typeof onExport !== "function") { saveMd(); return; }
    if (saved) setTimeout(() => onExport(format), 60); else onExport(format);
  }

  return (
    <section className="canvas" aria-label="Canvas" data-testid="canvas">
      <div className="cv-h">
        <b>{cv.title}</b>
        <select id="cv-ver" value={cv.cur} onChange={(e) => setCv({ ...cv, cur: +e.target.value })} aria-label="Версия">{cv.versions.map((v) => <option key={v.v} value={v.v}>Версия {v.v}{v.label ? " · " + v.label : ""}</option>)}</select>
        <div className="seg cv-mode" role="tablist" aria-label="Изглед">
          <button role="tab" aria-selected={mode === "edit"} className={mode === "edit" ? "on" : ""} onClick={() => setMode("edit")}>Редакция</button>
          <button role="tab" aria-selected={mode === "view"} className={mode === "view" ? "on" : ""} onClick={() => setMode("view")}>Преглед</button>
        </div>
        <button className="ibtn" onClick={() => commit(false)} title="Запази версия" aria-label="Запази версия"><Icon n="check" /></button>
        <button className="ibtn" onClick={() => copy(txt)} title="Копирай" aria-label="Копирай"><Icon n="copy" /></button>
        <span className="cv-exp">
          <button className="ibtn" onClick={() => setMenu((x) => !x)} title="Експорт" aria-label="Експорт" aria-expanded={menu}><Icon n="download" /></button>
          {menu ? (
            <div className="cv-menu" role="menu">
              {EXPORTS.map(([f, l]) => <button key={f} role="menuitem" className="it" onClick={() => exportAs(f)}><Icon n={f === "md" ? "doc" : "file"} /><span className="tx">{l}</span></button>)}
            </div>
          ) : null}
        </span>
        <button className="ibtn" onClick={() => setCv(null)} title="Затвори" aria-label="Затвори Canvas"><Icon n="x" /></button>
      </div>
      <div className="cv-body">
        {mode === "view"
          ? <CanvasPreview text={txt} copy={copy} />
          : <textarea id="cv-txt" className={cv.kind === "code" ? "code" : ""} value={txt} onChange={(e) => setTxt(e.target.value)} spellCheck={false} />}
      </div>
      <div className="cv-foot">{dirty ? "Незапазени промени – ✓ ги пази като нова версия. " : ""}{agentMade ? "Тед добавя нови версии и не презаписва старите. " : ""}Работен текст на този компютър; версиите се пазят, докато панелът е отворен.</div>
    </section>
  );
}
