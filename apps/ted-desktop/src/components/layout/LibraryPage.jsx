import React, { useEffect, useState } from "react";
import Icon from "../Icon.jsx";
import { ted } from "../../bridge.js";
import { fmtDate, fmtSize } from "../../lib/format.js";
import FileCard from "../agent/FileCard.jsx";

const call = async (fn) => { try { return await fn(); } catch { return { ok: false, error: "Вътрешна грешка в програмата." }; } };

const FILTERS = [["all", "Всички"], ["image", "Снимки"], ["doc", "Документи"], ["video", "Видео"]];
const DOC_KINDS = ["pdf", "docx", "xlsx", "csv", "text", "other"];
const ORIGIN = { user: "прикачен от вас", ted: "направен от Тед", web: "от интернет", crm: "от CRM" };

// Библиотека (ChatGPT Library): every image, document and video Ted made or the user attached, kept encrypted on
// this computer with the chat it came from (docs/CONTRACT.md §8.6, §11).
export default function LibraryPage({ chats, openChat, toast }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [st, setSt] = useState({ status: "loading", items: [], total: 0, error: "" });

  async function load() {
    const r = await call(() => ted.library.list({ ...(q.trim() ? { q: q.trim().slice(0, 200) } : {}), limit: 500 }));
    if (r && r.ok) setSt({ status: "ok", items: Array.isArray(r.items) ? r.items : [], total: r.totalBytes || 0, error: "" });
    else setSt((s) => ({ ...s, status: "error", error: (r && r.error) || "Библиотеката не се зареди." }));
  }
  useEffect(() => { load(); }, [q]);
  useEffect(() => {
    const un = ted.library.onChange(() => load());
    return () => { if (typeof un === "function") un(); };
  }, [q]);

  async function remove(f) {
    const r = await call(() => ted.library.remove(f.id));
    if (r && r.ok) { setSt((s) => ({ ...s, items: s.items.filter((x) => x.id !== f.id) })); toast("Файлът е изтрит от Библиотеката."); }
    else if (r && !r.canceled) toast(r.error || "Файлът не беше изтрит.");
  }

  const list = st.items.filter((f) => filter === "all" || (filter === "doc" ? DOC_KINDS.includes(f.kind) : f.kind === filter));
  return (
    <div className="page"><div className="page-in" data-testid="library-page">
      <div className="page-h"><h1>Библиотека</h1><p>Снимките, документите и видеата, които Тед направи или вие прикачихте. Пазят се шифровано на този компютър, заедно с чата, от който са.</p></div>
      <div className="hrow">
        <div className="seg">{FILTERS.map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}</div>
        <input id="lib-q" className="inp grow lib-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси по име…" />
      </div>
      <div className="sheet">
        {st.status === "loading" ? <div className="empty"><i className="spin" /> Зареждам…</div> : null}
        {st.status === "error" ? <div className="err" role="alert">⚠️ {st.error} <button className="b" onClick={load}><Icon n="refresh" />Опитай отново</button></div> : null}
        {st.status === "ok" && !list.length ? <div className="empty">{st.items.length ? "Няма файлове от този вид." : "Още няма файлове. Тук ще се появяват снимките и документите от чатовете."}</div> : null}
        {list.length ? <div className="lib-grid">{list.map((f) => {
          const c = f.chatId ? chats.find((x) => x.id === f.chatId) : null;
          return (
            <div className="lib-it" key={f.id}>
              <FileCard file={f} onToast={toast} />
              <div className="lib-meta">
                <small>{[ORIGIN[f.origin] || "", f.createdAt ? fmtDate(f.createdAt) : ""].filter(Boolean).join(" · ")}</small>
                <span className="hrow">
                  {f.chatId ? (c ? <button className="lnk" onClick={() => openChat(c.id)}>Отвори чата</button> : <small className="meta">чатът е изтрит</small>) : null}
                  <button className="lnk" onClick={() => remove(f)}>Изтрий</button>
                </span>
              </div>
            </div>
          );
        })}</div> : null}
        {st.status === "ok" && st.items.length ? <div className="note">{st.items.length} файла · {fmtSize(st.total || 0)} на този компютър.</div> : null}
      </div>
    </div></div>
  );
}
