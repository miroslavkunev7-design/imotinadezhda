import React, { useEffect, useState } from "react";
import { Modal } from "./ui.jsx";
import { propRef } from "./Cards.jsx";
import { fmtEUR, fmtDate, uid } from "../lib/format.js";

const SHOWN = 50;

// Real CRM search (read-only tool properties.search). The chosen properties are attached as TEXT
// reference lines; Ted then opens the records with his own tools on the server.
export function AttachProp({ close, read, onAttach }) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [deal, setDeal] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [st, setSt] = useState({ status: "loading", items: [], error: "" });
  const [sel, setSel] = useState({});

  async function search() {
    setSt({ status: "loading", items: [], error: "" });
    const input = {};
    if (q.trim()) input.text = q.trim().slice(0, 100);
    if (city.trim()) input.city = city.trim().slice(0, 80);
    if (deal) input.deal = deal;
    if (Number(maxPrice) > 0) input.max_price = Number(maxPrice);
    const r = await read("properties.search", input);
    if (!r.ok) { setSt({ status: "error", items: [], error: r.error || "Търсенето не успя." }); return; }
    const list = Array.isArray(r.result) ? r.result : Array.isArray(r.result && r.result.properties) ? r.result.properties : [];
    setSt({ status: "ok", items: list, error: "" });
  }
  useEffect(() => { search(); }, []);

  const keyOf = (p, i) => String(p.id || p.code || i);
  const chosen = st.items.filter((p, i) => sel[keyOf(p, i)]);
  return (
    <Modal title="Прикачи имот" onClose={close} size="md" foot={<><button className="b" onClick={close}>Отказ</button><button className="b wine" disabled={!chosen.length} onClick={() => onAttach(chosen.slice(0, 6))}>Прикачи избраното{chosen.length ? " (" + chosen.length + ")" : ""}</button></>}>
      <div className="mb">
        <div className="hrow filt">
          <input id="ap-q" className="inp grow" value={q} autoFocus onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder="Име, адрес, код или собственик" />
          <input id="ap-city" className="inp narrow" value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder="Град" />
          <select id="ap-deal" className="inp narrow" value={deal} onChange={(e) => setDeal(e.target.value)} aria-label="Вид сделка"><option value="">Продажба и наем</option><option value="sale">Продажба</option><option value="rent">Наем</option></select>
          <input id="ap-price" className="inp narrow" type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder="Цена до (€)" />
          <button className="b wine" onClick={search} disabled={st.status === "loading"}>Търси</button>
        </div>
        {st.status === "loading" ? <div className="empty"><i className="spin" /> Търся в CRM…</div> : null}
        {st.status === "error" ? <div className="err" role="alert">⚠️ {st.error} <button className="b" onClick={search}>Опитай отново</button></div> : null}
        {st.status === "ok" ? (
          <div className="prop-pick">
            {st.items.slice(0, SHOWN).map((p, i) => {
              const k = keyOf(p, i);
              return (
                <label key={k}><input type="checkbox" checked={!!sel[k]} onChange={(e) => setSel((s) => ({ ...s, [k]: e.target.checked }))} />
                  <span className="pick-em">🏠</span>
                  <span className="pick-tx"><b>{p.title || p.code || "Имот"}</b><span className="meta">{[p.code, p.city, p.hood, Number(p.price) ? fmtEUR(Number(p.price)) : "", p.area ? p.area + " м²" : "", p.status].filter(Boolean).join(" · ")}</span></span></label>
              );
            })}
            {!st.items.length ? <div className="empty">Няма имоти по тези условия.</div> : null}
          </div>
        ) : null}
        {st.status === "ok" && st.items.length > SHOWN ? <div className="note">Показани са първите {SHOWN} от {st.items.length}. Стеснете търсенето.</div> : null}
        <div className="info">Към съобщението се добавя текстов ред с кода и заглавието на имота – не файлове. Тед отваря данните със своите инструменти в CRM.</div>
      </div>
    </Modal>
  );
}

export const propFile = (p) => ({ id: uid("f_"), kind: "ref", name: [p.code, p.title].filter(Boolean).join(" · ") || "Имот", size: 0, line: propRef(p) });

// Real documents list (read-only tool documents.list). A document is attached as a TEXT reference line.
export function DocsModal({ close, read, onAttach }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState({ status: "loading", items: [], error: "" });

  async function load() {
    setSt({ status: "loading", items: [], error: "" });
    const r = await read("documents.list", {});
    if (!r.ok) { setSt({ status: "error", items: [], error: r.error || "Списъкът не се зареди." }); return; }
    const list = Array.isArray(r.result) ? r.result : Array.isArray(r.result && r.result.documents) ? r.result.documents : [];
    setSt({ status: "ok", items: list, error: "" });
  }
  useEffect(() => { load(); }, []);

  const needle = q.trim().toLocaleLowerCase("bg");
  const list = st.items.filter((d) => !needle || [d.name, d.client, d.folder].join(" ").toLocaleLowerCase("bg").includes(needle));
  const ext = (name) => { const s = String(name || ""); return s.includes(".") ? s.split(".").pop().toLowerCase().slice(0, 4) : "file"; };
  return (
    <Modal title="Документи" onClose={close} size="md">
      <div className="search-in"><input id="doc-q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси по име, клиент или папка…" /></div>
      <div className="mb">
        {st.status === "loading" ? <div className="empty"><i className="spin" /> Зареждам документите от CRM…</div> : null}
        {st.status === "error" ? <div className="err" role="alert">⚠️ {st.error} <button className="b" onClick={load}>Опитай отново</button></div> : null}
        {st.status === "ok" ? (
          <div className="clist">
            {list.slice(0, 80).map((d, i) => (
              <button key={d.id || i} onClick={() => onAttach({ id: uid("f_"), kind: "ref", name: d.name || "Документ", size: 0, line: "[Документ id " + d.id + " · " + (d.name || "") + (d.client ? " · клиент " + d.client : "") + "]" })}>
                <span className={"ficon sm-ic " + ext(d.name)}>{ext(d.name).toUpperCase()}</span>
                <span className="pick-tx"><b>{d.name || "Документ"}</b><span className="meta">{[d.client, d.folder, d.at ? fmtDate(d.at) : ""].filter(Boolean).join(" · ")}</span></span>
                <small>Прикачи</small>
              </button>
            ))}
            {!list.length ? <div className="empty">Няма документи{needle ? " по това търсене" : ""}.</div> : null}
          </div>
        ) : null}
        {st.status === "ok" && list.length > 80 ? <div className="note">Показани са първите 80 от {list.length}. Стеснете търсенето.</div> : null}
        <div className="info">Към съобщението се добавя текстов ред с номера и името на документа. Самият файл не се изпраща оттук – Тед го отваря в CRM.</div>
      </div>
    </Modal>
  );
}
