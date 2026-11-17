import React, { useEffect, useState } from "react";
import Icon from "../Icon.jsx";
import { ted } from "../../bridge.js";
import { fmtDate } from "../../lib/format.js";

// Проекти (ChatGPT Projects) = the cases of Ted's server: topics with their own memory, also visible on the website.
// 0.1.5: every project also has a FOLDER on this computer (docs/CONTRACT.md §8.12) – the count comes from the library.
export default function ProjectsPage({ cases, chats, openCase, newCase, newChatIn, refreshCases }) {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    let off = false;
    const load = async () => {
      let r; try { r = await ted.library.list({ limit: 500 }); } catch { r = null; }
      if (off || !r || !r.ok) return;
      const c = {};
      for (const f of r.items || []) if (f.caseId) c[f.caseId] = (c[f.caseId] || 0) + 1;
      setCounts(c);
    };
    load();
    const un = ted.library.onChange(load);
    return () => { off = true; if (typeof un === "function") un(); };
  }, []);
  return (
    <div className="page"><div className="page-in" data-testid="projects-page">
      <div className="page-h"><h1>Проекти</h1><button className="b wine" onClick={newCase}><Icon n="folderPlus" />Нов проект</button>
        <p>Проектите са казусите на Тед – теми с памет на сървъра. Всичко, казано в чат по казуса, се помни там и се вижда и в сайта. Всеки проект има и папка на този компютър с файловете си.</p></div>
      <div className="sheet">
        {cases.status === "loading" ? <div className="empty"><i className="spin" /> Зареждам казусите…</div> : null}
        {cases.status === "error" ? <div className="err" role="alert">⚠️ {cases.error} <button className="b" onClick={refreshCases}><Icon n="refresh" />Опитай отново</button></div> : null}
        {cases.status === "ok" && !cases.items.length ? <div className="empty">Няма отворени казуси. Натиснете „Нов проект“.</div> : null}
        {cases.items.map((cs) => {
          const n = chats.filter((c) => c.caseId === cs.id && !c.archived && !c.temporary).length;
          const f = counts[cs.id] || 0;
          return (
            <div className="task" key={cs.id} data-testid="project-item">
              <span className="ti"><Icon n="folder" /></span>
              <div className="tx"><b>{cs.title}</b><small>{[cs.client, cs.updated_at ? "обновен " + fmtDate(cs.updated_at) : "", n ? n + " чата на този компютър" : "", f ? f + (f === 1 ? " файл в папката" : " файла в папката") : ""].filter(Boolean).join(" · ") || "Казус с памет на сървъра на Тед"}</small></div>
              <div className="acts">
                <button className="b" onClick={() => openCase(cs.id)}><Icon n="folder" />Отвори</button>
                <button className="b" onClick={() => openCase(cs.id, "folder")} data-testid="project-folder-btn"><Icon n="archive" />Папка{f ? " (" + f + ")" : ""}</button>
                <button className="b wine" onClick={() => newChatIn(cs.id)}><Icon n="newchat" />Нов чат</button>
              </div>
            </div>
          );
        })}
      </div>
    </div></div>
  );
}
