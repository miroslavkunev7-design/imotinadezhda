import React, { useEffect, useRef, useState } from "react";
import Icon from "../Icon.jsx";
import { Modal } from "../ui.jsx";
import { ted } from "../../bridge.js";
import { fmtDate, fmtSize } from "../../lib/format.js";
import { blobToBase64 } from "../../lib/files.js";
import FileCard from "../agent/FileCard.jsx";

const call = async (fn) => { try { return await fn(); } catch { return { ok: false, error: "Вътрешна грешка в програмата." }; } };
const ORIGIN = { user: "прикачен", ted: "направен на този компютър", web: "от интернет", crm: "от CRM" };
const MAX_ADD = 20 * 1048576;

// The „Папка“ of a Проект (docs/CONTRACT.md §8.12): every file of the project kept on this computer – attachments of its
// chats, documents and photos Ted made, saved answers. „Изтегли папката“ = one ZIP made here and saved where you pick;
// „Запази в сайта“ = the files into the CRM at the project's client or a property, only after your approval.
export default function ProjectFolder({ kase, chats, openChat, toast, onExport, onSaveCrm }) {
  const [st, setSt] = useState({ status: "loading", items: [], total: 0, error: "" });
  const [busy, setBusy] = useState("");
  const pick = useRef(null);
  const caseId = kase.id;

  async function load() {
    const r = await call(() => ted.library.list({ caseId, limit: 500 }));
    if (r && r.ok) setSt({ status: "ok", items: Array.isArray(r.items) ? r.items : [], total: (r.items || []).reduce((n, f) => n + (f.size || 0), 0), error: "", memoryOnly: !!r.memoryOnly });
    else setSt((s) => ({ ...s, status: "error", error: (r && r.error) || "Папката не се зареди." }));
  }
  useEffect(() => { load(); const un = ted.library.onChange(() => load()); return () => { if (typeof un === "function") un(); }; }, [caseId]);

  async function add(list) {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    setBusy("add");
    const errors = [];
    let n = 0;
    for (const f of picked) {
      if (f.size > MAX_ADD) { errors.push("„" + f.name + "“ е над 20 MB."); continue; }
      const data = await blobToBase64(f);
      const r = await call(() => ted.files.add({ name: f.name, mime: f.type || "", data, caseId, caseTitle: String(kase.title || "").slice(0, 160) }));
      if (r && r.ok) n++; else errors.push((r && r.error) || "„" + f.name + "“ не беше добавен.");
    }
    setBusy("");
    toast([n ? "📁 В папката: " + n + (n === 1 ? " файл." : " файла.") : "", ...errors].filter(Boolean).join(" "));
    load();
  }
  async function takeOut(f) {
    const r = await call(() => ted.projects.assign({ caseId: null, fileIds: [f.id] }));
    if (r && r.ok) { setSt((s) => ({ ...s, items: s.items.filter((x) => x.id !== f.id) })); toast("Файлът е махнат от папката (остава в Библиотеката)."); }
    else toast((r && r.error) || "Файлът не беше махнат.");
  }
  async function zip() {
    setBusy("zip");
    await onExport(kase);
    setBusy("");
  }

  const items = st.items;
  return (
    <div className="pf" data-testid="project-folder">
      <div className="pf-head">
        <div className="pf-sum"><Icon n="folder" /><span><b>{items.length ? items.length + (items.length === 1 ? " файл" : " файла") : "Празна папка"}</b>{items.length ? <small>{fmtSize(st.total)} на този компютър</small> : <small>Файловете на проекта се събират тук</small>}</span></div>
        <div className="pf-acts">
          <button className="b" onClick={() => pick.current && pick.current.click()} disabled={!!busy}>{busy === "add" ? <i className="spin" /> : <Icon n="upload" />}Добави файлове</button>
          <button className="b" onClick={zip} disabled={!items.length || !!busy} data-testid="folder-zip">{busy === "zip" ? <i className="spin" /> : <Icon n="download" />}Изтегли папката</button>
          <button className="b wine" onClick={() => onSaveCrm(kase, items)} disabled={!items.length || !!busy} data-testid="folder-crm"><Icon n="upload" />Запази в сайта</button>
        </div>
        <input ref={pick} className="file-in" type="file" multiple data-testid="folder-in" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>
      {st.memoryOnly ? <div className="info">Windows не позволи шифровано запазване на този компютър – папката се пази само докато програмата е отворена.</div> : null}
      {st.status === "loading" ? <div className="empty"><i className="spin" /> Зареждам папката…</div> : null}
      {st.status === "error" ? <div className="err" role="alert">⚠️ {st.error} <button className="b" onClick={load}><Icon n="refresh" />Опитай отново</button></div> : null}
      {st.status === "ok" && !items.length ? (
        <div className="empty pf-empty">Още няма файлове. Прикачените файлове в чатовете на проекта, документите и снимките, които Тед прави в тях, и запазените отговори (<Icon n="folderPlus" cls="sm16" /> под отговора) идват тук сами. Може и: „Тед, събирай всичко за този клиент в папката на проекта“.</div>
      ) : null}
      {items.length ? (
        <ul className="pf-list">
          {items.map((f) => {
            const c = f.chatId ? chats.find((x) => x.id === f.chatId) : null;
            return (
              <li key={f.id} className="pf-it" data-testid="folder-item">
                <FileCard file={f} compact onToast={toast} />
                <div className="pf-meta">
                  <small>{[fmtDate(f.createdAt), ORIGIN[f.origin] || ""].filter(Boolean).join(" · ")}</small>
                  <span className="hrow">
                    {c ? <button className="lnk" onClick={() => openChat(c.id)}>Отвори чата</button> : null}
                    <button className="lnk" onClick={() => takeOut(f)} data-testid="folder-remove">Махни от папката</button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="note">Папката е на този компютър (шифрована, като Библиотеката). „Изтегли папката“ прави един ZIP и го записва там, където изберете. „Запази в сайта“ качва файловете в CRM при клиента на проекта или при имот – само след вашето потвърждение.</div>
    </div>
  );
}

// „Запази в сайта“: the card that shows EXACTLY which files go where. Nothing is uploaded before „Запиши в CRM“, and MAIN
// asks once more in a Windows dialog (the page alone can never upload).
export function SaveToCrmModal({ kase, files, onClose, toast }) {
  const [to, setTo] = useState(kase.client ? "client" : "property");
  const [client, setClient] = useState(String(kase.client || ""));
  const [code, setCode] = useState("");
  const [chosen, setChosen] = useState(() => new Set(files.map((f) => f.id)));
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const list = files.filter((f) => chosen.has(f.id));
  const target = to === "property" ? { propertyCode: code.trim().toUpperCase().slice(0, 40) } : { clientName: client.trim().slice(0, 120), ...(kase.client_id && client.trim() === String(kase.client || "") ? { clientId: String(kase.client_id) } : {}) };
  const ready = list.length && (to === "property" ? !!target.propertyCode : !!target.clientName);
  const photos = list.filter((f) => f.kind === "image").length;

  async function go() {
    setBusy(true);
    const r = await call(() => ted.projects.saveToCrm({ caseId: kase.id, caseTitle: String(kase.title || "").slice(0, 160), fileIds: list.map((f) => f.id), target }));
    setBusy(false);
    if (r && r.canceled) { toast("Отказано – нищо не е качено."); return; }
    if (!r || !Array.isArray(r.results)) { toast((r && r.error) || "Файловете не бяха записани."); return; }
    setRes(r);
  }
  const toggle = (id) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <Modal title="Запази папката в сайта" onClose={onClose} size="md" foot={res ? <button className="b wine" onClick={onClose}>Готово</button> : <>
      <button className="b" onClick={onClose}>Отказ</button>
      <button className="b wine" onClick={go} disabled={!ready || busy} data-testid="crm-save-go">{busy ? <i className="spin" /> : <Icon n="upload" />}Запиши в CRM ({list.length})</button></>}>
      <div className="mb">
        {res ? (
          <div data-testid="crm-save-result">
            <div className={res.failed ? "err" : "verify"}><Icon n={res.failed ? "info" : "check"} /><span><b>{res.saved} записани</b>{res.failed ? ", " + res.failed + " неуспешни" : ""} при {res.target}. Статусите са от отговорите на сървъра.</span></div>
            <ul className="steps">{res.results.map((x) => <li key={x.id} data-ok={x.ok ? "1" : "0"}><span className={"dot d-" + (x.ok ? "succeeded" : "failed")}><Icon n={x.ok ? "check" : "x"} /></span><span>{x.name}<small>{x.ok ? "записано: " + (x.savedTo || res.target) : (x.error || "неуспешно") + (x.maybeExecuted ? " – може да е изпълнено, проверете в CRM" : "")}</small></span></li>)}</ul>
          </div>
        ) : <>
          <p className="p0 lead">Проект „{kase.title}“. Изберете къде в CRM да отидат файловете:</p>
          <div className="seg crm-to" role="tablist">
            <button className={to === "client" ? "on" : ""} onClick={() => setTo("client")} role="tab" aria-selected={to === "client"}>При клиент</button>
            <button className={to === "property" ? "on" : ""} onClick={() => setTo("property")} role="tab" aria-selected={to === "property"}>При имот</button>
          </div>
          {to === "client"
            ? <div className="fld"><label htmlFor="crm-client">Клиент в CRM</label><input id="crm-client" className="inp" value={client} maxLength={120} onChange={(e) => setClient(e.target.value)} placeholder="Име на клиента" /><small className="meta">Файловете отиват в документите на клиента, папка „Проект: {String(kase.title || "").slice(0, 60)}“.</small></div>
            : <div className="fld"><label htmlFor="crm-prop">Код на имота</label><input id="crm-prop" className="inp" value={code} maxLength={40} onChange={(e) => setCode(e.target.value)} placeholder="Код от CRM (P-…)" /><small className="meta">Снимките ({photos}) отиват в галерията на имота (с логото на агенцията), другите файлове – в документите му.</small></div>}
          <div className="sec-h">Файлове ({list.length} от {files.length})</div>
          <div className="crm-files">{files.map((f) => (
            <label key={f.id} className="crm-file"><input type="checkbox" checked={chosen.has(f.id)} onChange={() => toggle(f.id)} /><span className="ell">{f.name}</span><small>{fmtSize(f.size || 0)}</small></label>
          ))}</div>
          <div className="info">Нищо не се качва, преди да натиснете „Запиши в CRM“ и да потвърдите в прозореца на Windows. Записът е като „Запази в CRM“ в чата: файловете се качват в хранилището на CRM и се свързват с клиента или имота.</div>
        </>}
      </div>
    </Modal>
  );
}
