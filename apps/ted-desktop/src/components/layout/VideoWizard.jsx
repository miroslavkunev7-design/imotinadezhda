import React, { useState } from "react";
import Icon from "../Icon.jsx";
import { Modal } from "../ui.jsx";
import { ted } from "../../bridge.js";
import { fmtEUR } from "../../lib/format.js";
import VideoCard from "../agent/VideoCard.jsx";

const call = async (fn) => { try { return await fn(); } catch { return { ok: false, error: "Вътрешна грешка в програмата." }; } };

// „+ → Още → Видео на имот“: pick a property from CRM, let MAIN prepare the job (photos, order, engines), then the
// FEATURES VideoCard shows the engine/length/price approval, the progress and the finished MP4 (docs/CONTRACT.md §12).
export default function VideoWizard({ close, read, jobs, onJob, toast }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState({ status: "idle", items: [], error: "" });
  const [prep, setPrep] = useState({ status: "idle", error: "", candidates: null });
  const [jobId, setJobId] = useState(null);
  const job = jobId ? jobs[jobId] : null;

  async function search() {
    setSt({ status: "loading", items: [], error: "" });
    const r = await read("properties.search", q.trim() ? { text: q.trim().slice(0, 100) } : {});
    if (!r.ok) { setSt({ status: "error", items: [], error: r.error || "Търсенето не успя." }); return; }
    setSt({ status: "ok", items: Array.isArray(r.result) ? r.result : Array.isArray(r.result && r.result.properties) ? r.result.properties : [], error: "" });
  }
  async function prepare(code) {
    setPrep({ status: "loading", error: "", candidates: null });
    const r = await call(() => ted.video.prepare({ code: String(code).slice(0, 40) }));
    if (r && r.ok && r.job) { onJob(r.job); setJobId(r.job.id); setPrep({ status: "ok", error: "", candidates: null }); return; }
    setPrep({ status: "error", error: (r && r.error) || "Видеото не можа да се подготви.", candidates: r && Array.isArray(r.candidates) ? r.candidates : null });
  }

  return (
    <Modal title="Видео на имот" onClose={close} size="md">
      <div className="mb">
        {job ? <VideoCard job={job} onToast={toast} /> : <>
          <p className="help-p">AI разходка от снимките на обявата: Тед подрежда снимките, показва двигателя, дължината и приблизителната цена и започва само след „Започни (платено)“. Видео само от текст (без снимки) не се прави – първо поискайте AI снимка, после клип от нея.</p>
          <div className="hrow filt">
            <input id="vw-q" className="inp grow" value={q} autoFocus onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder="Код, име или адрес на имота" />
            <button className="b wine" onClick={search} disabled={st.status === "loading"}><Icon n="search" />Търси</button>
          </div>
          {st.status === "loading" ? <div className="empty"><i className="spin" /> Търся в CRM…</div> : null}
          {st.status === "error" ? <div className="err" role="alert">⚠️ {st.error}</div> : null}
          {st.status === "ok" && !st.items.length ? <div className="empty">Няма имоти по това търсене.</div> : null}
          {st.items.length || (prep.candidates && prep.candidates.length) ? <div className="clist">
            {(prep.candidates && prep.candidates.length ? prep.candidates : st.items).slice(0, 40).map((p, i) => (
              <button key={p.id || p.code || i} onClick={() => prepare(p.code || p.id)} disabled={prep.status === "loading"}>
                <span className="pick-em">🏠</span>
                <span className="pick-tx"><b>{p.title || p.code || "Имот"}</b><span className="meta">{[p.code, p.city, Number(p.price) ? fmtEUR(Number(p.price)) : ""].filter(Boolean).join(" · ")}</span></span>
                <small>Подготви видео</small>
              </button>
            ))}
          </div> : null}
          {prep.status === "loading" ? <div className="empty"><i className="spin" /> Подготвям снимките и цените…</div> : null}
          {prep.status === "error" ? <div className="err" role="alert">⚠️ {prep.error}</div> : null}
        </>}
      </div>
    </Modal>
  );
}
