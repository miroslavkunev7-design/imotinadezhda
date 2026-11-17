import React, { useEffect, useState } from "react";
import Icon from "../Icon.jsx";
import FileCard from "./FileCard.jsx";
import VideoChoice, { initialChoice } from "./VideoChoice.jsx";
import { ted } from "../../bridge.js";
import { fmtUsd, useVideoViaApproval } from "../../lib/agent.js";
import { ensureStitch, retryStitch, useStitch } from "../../lib/stitch.js";

const call = async (fn) => { try { return await fn(); } catch { return { ok: false, error: "Вътрешна грешка в програмата." }; } };
const PART = { idle: "чака", run: "прави се", done: "готова", err: "неуспешна" };
const DOT = { idle: "", run: "run", done: "ok", err: "err" };
const partFile = (p, i) => ({ id: p.fileId, name: (p.title || "Част " + (p.n || i + 1)).replace(/[:→]/g, " ").replace(/\s+/g, " ").trim() + ".mp4", kind: "video", mime: "video/mp4", origin: "crm" });

// AI video of a property (docs/CONTRACT.md §8.5, §12): engine/length/price → (paid) start → progress of the
// parts from MAIN's polling → stitching in this window → the finished clip as a FileCard. Statuses come only
// from MAIN's job (ted.video.onEvent → the shell passes the newest job); nothing here is animated or guessed.
// viaApproval (optional): the job waits for the agent's „Платено AI видео“ card, so no second start button here
// (also detected on its own from the agent events, see lib/agent.js).
export default function VideoCard({ job, onToast, viaApproval }) {
  const j = job && typeof job === "object" ? job : null;
  const parts = j && Array.isArray(j.parts) ? j.parts : [];
  const [choice, setChoice] = useState(() => initialChoice(j && j.engines, j && j.defaults));
  const [busy, setBusy] = useState("");
  const [showParts, setShowParts] = useState(false);
  const waitsInChat = useVideoViaApproval(j && j.id);
  const st = useStitch(j && j.id);
  const toast = (m) => { if (typeof onToast === "function") onToast(m); };
  useEffect(() => { if (j && j.status === "stitch") ensureStitch(j); }, [j && j.id, j && j.status]);
  if (!j || typeof j.id !== "string") return null;

  const engines = Array.isArray(j.engines) ? j.engines : [];
  const done = parts.filter((p) => p.status === "done").length;
  const errs = parts.filter((p) => p.status === "err").length;
  const engName = (engines.find((e) => e.id === j.engine) || {}).name || j.engine || "";
  const src = [j.source && j.source.code, j.source && j.source.title].filter(Boolean).join(" · ") || "снимки";

  async function start(engine, duration) {
    setBusy("start");
    const r = await call(() => ted.video.start({ jobId: j.id, engine, duration }));
    setBusy("");
    if (!r || !r.ok) toast((r && r.error) || "Видеото не започна.");
  }
  async function cancel() {
    setBusy("cancel");
    const r = await call(() => ted.video.cancel({ jobId: j.id }));
    setBusy("");
    if (r && r.ok) toast("Видеото е спряно. Вече започнатите части на сървъра може да са таксувани.");
  }

  const doneParts = parts.filter((p) => p.status === "done" && p.fileId);
  const partsList = (
    <div className="vid-parts">
      {parts.map((p, i) => (
        <div className="vid-part" key={p.n || i} data-status={p.status}>
          <span className={"vdot " + (DOT[p.status] || "")} aria-hidden="true" />
          <span className="vp-t">{p.title || "Част " + (p.n || i + 1)}<small>{[PART[p.status] || p.status, p.error || ""].filter(Boolean).join(" · ")}</small></span>
        </div>
      ))}
    </div>
  );
  const dots = <div className="vid-dots" aria-hidden="true">{parts.map((p, i) => <i key={p.n || i} className={DOT[p.status] || ""} title={p.title} />)}</div>;
  // The stitched clip is Ted's work even though it reached the store through files.add (origin "user" there).
  const finalFile = (st && st.status === "done" && st.file ? { ...st.file, origin: "ted" } : null)
    || (j.status === "done" && j.fileId ? { id: j.fileId, name: "AI видео" + (j.source && j.source.code ? " " + j.source.code : "") + ".mp4", kind: "video", mime: "video/mp4", origin: "ted" } : null);

  let body;
  if (j.status === "need_engine") {
    body = <div className="err" role="alert">⚠️ {j.error || "На сървъра няма настроен ключ за AI видео – видео не може да се направи, докато администраторът не добави ключ."}</div>;
  } else if (j.status === "approval") {
    body = viaApproval || waitsInChat
      ? <div className="info" data-testid="video-wait-approval">Изберете двигател и дължина в картата „Платено AI видео“ и натиснете „Започни (платено)“. Без това нищо не започва.</div>
      : engines.length ? <>
        <VideoChoice engines={engines} gateway={j.gateway} parts={parts.length} aspect={j.aspect} value={choice} onChange={setChoice} disabled={!!busy} idp={"vj-" + j.id.slice(-6)} />
        <div className="acts">
          <button className="b wine" disabled={!!busy} onClick={() => start(choice.engine, choice.duration)}>{busy === "start" ? <i className="spin" /> : <Icon n="play" />}Започни (платено)</button>
          <button className="b" disabled={!!busy} onClick={cancel}><Icon n="x" />Откажи</button>
        </div>
      </> : <div className="err">⚠️ Няма двигатели за видео на сървъра.</div>;
  } else if (j.status === "running") {
    body = <>
      <div className="vid-prog"><b data-testid="video-progress">Създавам видеото… готови {done} от {parts.length} части</b>
        <div className="lw-bar" aria-hidden="true"><i style={{ width: (parts.length ? Math.round((done / parts.length) * 100) : 0) + "%" }} /></div>{dots}</div>
      <div className="note">{[engName, j.duration ? j.duration + " сек на част" : "", j.est ? "≈ " + fmtUsd(j.est.cost) + " · около " + j.est.min + " мин" : ""].filter(Boolean).join(" · ")}. Частите се правят на сървъра; програмата трябва да остане отворена.</div>
      <div className="acts"><button className="b" disabled={!!busy} onClick={cancel}>{busy === "cancel" ? <i className="spin" /> : <Icon n="stopsq" />}Спри</button>
        <button className="lnk" onClick={() => setShowParts((x) => !x)}>{showParts ? "Скрий частите" : "Части"}</button></div>
      {showParts ? partsList : null}
    </>;
  } else if (j.status === "stitch") {
    const failed = st && st.status === "fail";
    body = <>
      <div className="vid-prog"><b data-testid="video-progress">{failed ? "Частите са готови, но сглобяването не успя" : "Сглобявам видеото…" + (st && st.info ? " " + st.info : "")}</b>
        {!failed ? <div className="lw-bar" aria-hidden="true"><i style={{ width: "100%" }} /></div> : null}{dots}</div>
      {failed ? <>
        <div className="err" role="alert">⚠️ {st.error}. Всяка част е запазена поотделно.</div>
        <div className="acts"><button className="b wine" onClick={() => retryStitch(j)}><Icon n="refresh" />Сглоби отново</button></div>
        <div className="vid-files">{doneParts.map((p, i) => <FileCard key={p.fileId} file={partFile(p, i)} compact onToast={onToast} />)}</div>
      </> : <div className="note">Сглобяването става в този прозорец (лого по средата и надпис „AI визуализация“) – не го минимизирайте, докато свърши.</div>}
    </>;
  } else if (j.status === "done") {
    body = <>
      <div className="verify"><Icon n="check" /><span><b>Готово</b> – {parts.length > 1 ? parts.length + " части в едно видео" : "клипът е готов"}. AI визуализация от снимките.</span></div>
      {finalFile ? <FileCard file={finalFile} onToast={onToast} /> : null}
    </>;
  } else if (j.status === "failed") {
    const canResume = !!(j.engine && j.duration && engines.some((e) => e.id === j.engine));
    body = <>
      <div className="err" role="alert">⚠️ {j.error || "Видеото не успя."}</div>
      {canResume && done < parts.length ? <div className="acts"><button className="b wine" disabled={!!busy} onClick={() => start(j.engine, j.duration)}>{busy === "start" ? <i className="spin" /> : <Icon n="refresh" />}Продължи ({parts.length - done} части, платено)</button></div> : null}
      {doneParts.length ? <div className="vid-files">{doneParts.map((p, i) => <FileCard key={p.fileId} file={partFile(p, i)} compact onToast={onToast} />)}</div> : null}
      {errs ? partsList : null}
    </>;
  } else if (j.status === "cancelled") {
    body = <>
      <div className="note">Видеото е спряно. Части, които вече бяха започнати на сървъра, може да са таксувани.</div>
      {doneParts.length ? <div className="vid-files">{doneParts.map((p, i) => <FileCard key={p.fileId} file={partFile(p, i)} compact onToast={onToast} />)}</div> : null}
    </>;
  } else {
    body = <div className="note">Състояние: {String(j.status || "неизвестно")}</div>;
  }

  return (
    <div className="card video-card" data-testid="video-card" data-status={j.status}>
      <h4><Icon n="film" />AI видео на имот<span className="meta vid-src">{src}{j.source && j.source.photos ? " · " + j.source.photos + " снимки" : ""}</span></h4>
      {body}
    </div>
  );
}
