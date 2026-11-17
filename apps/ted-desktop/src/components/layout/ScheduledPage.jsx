import React, { useEffect, useState } from "react";
import Icon from "../Icon.jsx";
import { ted } from "../../bridge.js";
import { fmtDate } from "../../lib/format.js";
import { openCrm } from "../Cards.jsx";

const call = async (fn) => { try { return await fn(); } catch { return { ok: false, error: "Вътрешна грешка в програмата." }; } };
const REPEAT = [["none", "Веднъж"], ["daily", "Всеки ден"], ["weekdays", "В делнични дни"], ["weekly", "Всяка седмица"], ["monthly", "Всеки месец"]];
const repeatName = (id) => (REPEAT.find((r) => r[0] === id) || REPEAT[0])[1];
const pad = (n) => String(n).padStart(2, "0");
// <input type="datetime-local"> value in local time <-> ISO.
const toLocal = (iso) => { const d = new Date(iso || Date.now() + 3600000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const EMPTY = { title: "", kind: "reminder", text: "", engine: "server", repeat: "none", enabled: true };

// What calendar.list returned, whatever the exact field names (read-only list).
function calItems(result) {
  const r = result || {};
  const list = Array.isArray(r) ? r : Array.isArray(r.events) ? r.events : Array.isArray(r.items) ? r.items : Array.isArray(r.calendar) ? r.calendar : [];
  return list.map((e) => ({ title: e.title || e.name || e.summary || "Събитие", at: e.start || e.starts_at || e.at || e.date || e.when || "", who: e.client || e.client_name || e.with || "", where: e.location || e.place || e.address || "" }));
}

// Планирани (ChatGPT Scheduled): local reminders and prompts that run while the program is open (missed ones are
// only reported, never run silently) + the CRM calendar for the next 14 days (docs/CONTRACT.md §13).
export default function ScheduledPage({ read, toast, missed, onRunNow, onDismissMissed, rgReady }) {
  const [st, setSt] = useState({ status: "loading", items: [], error: "" });
  const [form, setForm] = useState(null);
  const [cal, setCal] = useState({ status: "loading", items: [], error: "" });

  async function load() {
    const r = await call(() => ted.scheduled.list());
    if (r && r.ok) setSt({ status: "ok", items: Array.isArray(r.items) ? r.items : [], error: "" });
    else setSt({ status: "error", items: [], error: (r && r.error) || "Задачите не се заредиха." });
  }
  async function loadCal() {
    setCal({ status: "loading", items: [], error: "" });
    const from = new Date(); const to = new Date(Date.now() + 14 * 86400000);
    const r = await read("calendar.list", { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    if (r.ok) setCal({ status: "ok", items: calItems(r.result), error: "" });
    else setCal({ status: "error", items: [], error: r.error || "Календарът не се зареди." });
  }
  useEffect(() => { load(); loadCal(); }, []);

  async function save() {
    const f = form;
    const title = f.title.trim(); const text = f.text.trim();
    if (!title) { toast("Въведете заглавие."); return; }
    if (f.kind === "prompt" && !text) { toast("Напишете какво да направи Тед."); return; }
    const at = new Date(f.at);
    if (Number.isNaN(at.getTime())) { toast("Изберете дата и час."); return; }
    const task = { ...(f.id ? { id: f.id } : {}), title: title.slice(0, 120), kind: f.kind, text: text.slice(0, 4000), engine: f.engine, at: at.toISOString(), repeat: f.repeat, enabled: !!f.enabled };
    const r = await call(() => ted.scheduled.save(task));
    if (r && r.ok) { setForm(null); toast(f.id ? "Задачата е променена." : "Задачата е планирана."); load(); }
    else toast((r && r.error) || "Задачата не беше записана.");
  }
  async function remove(t) {
    const r = await call(() => ted.scheduled.remove(t.id));
    if (r && r.ok) { setSt((s) => ({ ...s, items: s.items.filter((x) => x.id !== t.id) })); toast("Задачата е изтрита."); } else toast((r && r.error) || "Задачата не беше изтрита.");
  }
  async function toggle(t) {
    const r = await call(() => ted.scheduled.save({ ...t, enabled: !t.enabled }));
    if (r && r.ok) load(); else toast((r && r.error) || "Промяната не беше записана.");
  }
  const edit = (t) => setForm(t ? { ...EMPTY, ...t, at: toLocal(t.nextRun || t.at) } : { ...EMPTY, at: toLocal() });

  return (
    <div className="page"><div className="page-in" data-testid="scheduled-page">
      <div className="page-h"><h1>Планирани</h1><button className="b wine" onClick={() => edit(null)}><Icon n="plus" />Нова задача</button>
        <p>Напомняния и въпроси към Тед по график. Изпълняват се само докато програмата е отворена; пропуснатите не се пускат сами – показват се тук с „Изпълни сега“.</p></div>
      {missed.length ? <div className="sheet">
        <div className="sec-h">Пропуснати, докато програмата беше затворена</div>
        {missed.map((t) => <div className="task" key={t.id}><span className="ti"><Icon n="bell" /></span><div className="tx"><b>{t.title}</b><small>{t.kind === "prompt" ? "Въпрос към Тед" : "Напомняне"} · трябваше {fmtDate(t.nextRun || t.at)}</small></div>
          <div className="acts"><button className="b wine" onClick={() => onRunNow(t)}>Изпълни сега</button><button className="b" onClick={() => onDismissMissed(t.id)}>Пропусни</button></div></div>)}
      </div> : null}
      {form ? <div className="sheet sched-form">
        <div className="sec-h">{form.id ? "Промяна на задача" : "Нова задача"}</div>
        <div className="fld"><label htmlFor="sc-title">Заглавие</label><input id="sc-title" className="inp" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Напр. Седмична справка" /></div>
        <div className="hrow">
          <div className="seg">{[["reminder", "Напомняне"], ["prompt", "Въпрос към Тед"]].map(([k, l]) => <button key={k} className={form.kind === k ? "on" : ""} onClick={() => setForm({ ...form, kind: k })}>{l}</button>)}</div>
          {form.kind === "prompt" ? <select className="inp auto" value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value })} aria-label="Кой отговаря"><option value="server">Тед (сървър)</option><option value="realgpt" disabled={!rgReady}>Real GPT{rgReady ? "" : " (не е свързан)"}</option></select> : null}
        </div>
        <div className="fld mt"><label htmlFor="sc-text">{form.kind === "prompt" ? "Какво да направи Тед" : "Текст на напомнянето (по желание)"}</label><textarea id="sc-text" className="inp" maxLength={4000} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder={form.kind === "prompt" ? "Напр. Направи обобщена справка за агенцията за изминалата седмица" : ""} /></div>
        <div className="hrow">
          <div className="fld"><label htmlFor="sc-at">Кога</label><input id="sc-at" className="inp auto" type="datetime-local" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} /></div>
          <div className="fld"><label htmlFor="sc-rep">Повтаряне</label><select id="sc-rep" className="inp auto" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>{REPEAT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        </div>
        <div className="hrow"><button className="b wine" onClick={save}><Icon n="check" />Запази</button><button className="b" onClick={() => setForm(null)}>Отказ</button></div>
      </div> : null}
      <div className="sheet">
        <div className="sec-h">Задачи на този компютър</div>
        {st.status === "loading" ? <div className="empty"><i className="spin" /> Зареждам…</div> : null}
        {st.status === "error" ? <div className="err" role="alert">⚠️ {st.error}</div> : null}
        {st.status === "ok" && !st.items.length ? <div className="empty">Няма планирани задачи. Натиснете „Нова задача“.</div> : null}
        {st.items.map((t) => (
          <div className="task" key={t.id} data-testid="sched-item">
            <span className="ti"><Icon n={t.kind === "prompt" ? "chat" : "bell"} /></span>
            <div className="tx"><b>{t.title}</b><small>{[t.kind === "prompt" ? "Въпрос към " + (t.engine === "realgpt" ? "Real GPT" : "Тед (сървър)") : "Напомняне", repeatName(t.repeat), t.enabled ? "следващо: " + fmtDate(t.nextRun || t.at) : "изключена"].join(" · ")}</small>
              {t.lastResult ? <small>{t.lastResult.ok ? "Последно: изпълнено " + (t.lastRun ? fmtDate(t.lastRun) : "") : "Последно: не е изпълнено – " + (t.lastResult.error || "грешка")}</small> : null}</div>
            <div className="acts"><button className="b" onClick={() => toggle(t)}>{t.enabled ? "Изключи" : "Включи"}</button><button className="b" onClick={() => edit(t)}><Icon n="pencil" />Промени</button><button className="b" onClick={() => remove(t)}><Icon n="trash" />Изтрий</button></div>
          </div>
        ))}
      </div>
      <div className="sheet">
        <div className="sec-h">Календар в CRM <small>следващите 14 дни · само за четене</small></div>
        {cal.status === "loading" ? <div className="empty"><i className="spin" /> Зареждам календара от CRM…</div> : null}
        {cal.status === "error" ? <div className="err" role="alert">⚠️ {cal.error} <button className="b" onClick={loadCal}><Icon n="refresh" />Опитай отново</button></div> : null}
        {cal.status === "ok" && !cal.items.length ? <div className="empty">Няма събития в календара за следващите 14 дни.</div> : null}
        {cal.items.map((e, i) => <div className="mem" key={i}><Icon n="calendar" /><div className="tx">{e.title}<small>{[e.at ? (fmtDate(e.at) || String(e.at)) : "", e.who, e.where].filter(Boolean).join(" · ")}</small></div></div>)}
        <div className="hrow mt"><button className="b" onClick={openCrm}><Icon n="external" />Отвори календара в CRM</button><button className="b" onClick={loadCal}><Icon n="refresh" />Обнови</button></div>
      </div>
    </div></div>
  );
}
