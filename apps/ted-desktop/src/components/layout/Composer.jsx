import React, { useEffect, useState } from "react";
import Icon from "../Icon.jsx";
import { hintOf } from "../../lib/consts.js";
import { extOf, fmtClock, fmtSize, now } from "../../lib/format.js";
import { EffortPill } from "./ModelEffortPill.jsx";

function RecBar({ rec }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(t); }, []);
  return rec === "busy"
    ? <div className="recbar live"><i />Разпознавам записа…</div>
    : <div className="recbar"><i />● Записвам {fmtClock(now() - rec.t0)} · натиснете ⏹ за край</div>;
}

const fileSub = (f) => (f.kind === "ref" ? "препратка към CRM" : f.kind === "text" ? "текст · " + f.text.length + " знака" + (f.cut ? " (съкратен)" : "")
  : f.kind === "lib" ? "от Библиотеката" : f.kind === "doc" && f.text != null ? fmtSize(f.size) + " · текст " + f.text.length + " знака" : fmtSize(f.size));
const fileTag = (f) => (f.kind === "ref" ? "CRM" : (extOf(f.name) || "file").slice(0, 4).toUpperCase());

// ChatGPT composer: tags above the text (armed hints, Проект, Агент), the text, then „+“ · pill „модел · усилие“ ·
// mic · round button (voice mode when empty, send with text/files, stop while busy).
export default function Composer(p) {
  const { phone, S, mode, input, setInput, files, setFiles, taRef, rec, busy, onSend, onStop, onMic, onVoice, onPlus, plusOpen, onDropFiles,
    hints, dropHint, curCase, dropCase, role, dropRole, pill, disc, home, above, canvasTag } = p;
  const tags = hints.length || curCase || role || canvasTag;
  return (
    <div className={"dock" + (home ? " in-home" : "")}>
      {above}
      <div className="compose" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropFiles(e.dataTransfer.files); }}>
        {files.length ? (
          <div className="cfiles">{files.map((f) => (
            <div className="cfile" key={f.id}>
              {f.thumb ? <img src={f.thumb} alt="" /> : <span className={"ficon " + (f.kind === "ref" ? "ref" : extOf(f.name))}>{fileTag(f)}</span>}
              <div className="cfile-tx"><span>{f.name}</span><small>{fileSub(f)}</small></div>
              <button className="x" onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))} aria-label="Премахни"><Icon n="x" /></button>
            </div>))}</div>
        ) : null}
        {tags ? <div className="ctags">
          {hints.map((h) => { const x = hintOf(h); return x ? <span className="ctag hint" key={h} data-testid={"hint-" + h}><Icon n={x.icon} cls="sm14" />{x.name}<button onClick={() => dropHint(h)} aria-label={"Махни „" + x.name + "“"}>×</button></span> : null; })}
          {curCase ? <span className="ctag" data-testid="case-pill"><Icon n="folder" cls="sm14" />Казус: {curCase.title}{dropCase ? <button onClick={dropCase} aria-label="Махни казуса">×</button> : null}</span> : null}
          {role ? <span className="ctag" data-testid="role-pill">{role.em} {role.short}<button onClick={dropRole} aria-label="Махни ролята">×</button></span> : null}
          {canvasTag ? <span className="ctag" data-testid="canvas-pill" title="Текстът на Canvas отива с въпроса към Real GPT"><Icon n="pencil" cls="sm14" />Canvas: {canvasTag.title}<button onClick={canvasTag.drop} aria-label="Затвори Canvas">×</button></span> : null}
        </div> : null}
        {rec ? <RecBar rec={rec} /> : (
          <textarea id="composer" ref={taRef} rows={1} value={input} placeholder={mode.ph} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && S.enterSend && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(); } }}
            onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); onDropFiles(e.clipboardData.files); } }} />
        )}
        <div className="crow">
          <button className="cbtn c-plus" onClick={onPlus} aria-label="Добави" aria-expanded={!!plusOpen} title="Добави снимки и файлове, инструменти, проект"><Icon n="plus" /></button>
          <span className="spacer" />
          <EffortPill label={pill.label} effort={pill.effort} onClick={pill.onClick} open={pill.open} />
          <button className={"cbtn c-mic" + (rec ? " rec" : "")} onClick={onMic} disabled={rec === "busy"} aria-label={rec ? "Спри диктовката" : "Диктовка"} title="Диктовка">{rec ? <Icon n="stopsq" fill="currentColor" /> : <Icon n="mic" />}</button>
          {/* The second click of a double-click on "Изпрати" lands here (the button swaps while busy): it must not stop the request. */}
          {busy ? <button className="snd" onClick={(e) => { if (e.detail > 1) return; onStop(); }} aria-label="Спри" title="Спри"><Icon n="stopsq" fill="currentColor" /></button>
            : (input.trim() || files.length) ? <button className="snd" onClick={() => onSend()} aria-label="Изпрати"><Icon n="up" /></button>
              : <button className="snd" onClick={onVoice} aria-label="Гласов режим" title="Гласов режим"><Icon n="wave" /></button>}
        </div>
      </div>
      {disc}
    </div>
  );
}
