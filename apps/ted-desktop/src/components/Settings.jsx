import React, { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { Modal, Opt, Sw } from "./ui.jsx";
import { ted } from "../bridge.js";
import { EFFORTS, RG_LIMITS, SESSION_NOTE, SPEAK, STYLES, VOICES, provEm } from "../lib/consts.js";
import { fmtDate } from "../lib/format.js";

const TABS = [
  ["general", "⚙️", "Общи"], ["model", "🧠", "Модел"], ["voice", "🔊", "Глас"], ["dict", "🎙️", "Диктовка"], ["memory", "🔖", "Памет"],
  ["apps", "🔌", "Свързани услуги"], ["data", "🗄️", "Данни"], ["account", "👤", "Акаунт"], ["about", "💻", "За програмата"],
];
const KIND = { fact: "запомнен факт", message: "от разговор", summary: "резюме" };
// A bridge call that never rejects: an IPC failure becomes an ordinary error result.
const call = async (fn) => { try { return await fn(); } catch { return { ok: false, error: "Вътрешна грешка в програмата." }; } };

// Memory lives on Ted's server (the same one the website uses): search, remember, forget.
function MemoryPane({ read, toast }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState({ status: "idle", items: [], error: "" });
  const [fact, setFact] = useState("");
  const [saving, setSaving] = useState(false);

  async function search() {
    const query = q.trim();
    if (!/[\p{L}\p{N}]{3,}/u.test(query)) { setSt({ status: "error", items: [], error: "Напишете поне една дума с 3 или повече букви." }); return; }
    setSt({ status: "loading", items: [], error: "" });
    const r = await read("memory.search", { query: query.slice(0, 200), limit: 20 });
    if (!r.ok) { setSt({ status: "error", items: [], error: r.error || "Търсенето не успя." }); return; }
    setSt({ status: "ok", items: Array.isArray(r.result && r.result.items) ? r.result.items : [], error: "" });
  }
  async function remember() {
    const text = fact.trim();
    if (!text || saving) return;
    setSaving(true);
    const r = await call(() => ted.memory.remember({ text: text.slice(0, 1500) }));
    setSaving(false);
    if (r && r.ok) { setFact(""); toast("🔖 Запомнено в паметта на Тед."); } else toast((r && r.error) || "Не успях да запомня.");
  }
  async function forget(m) {
    const r = await call(() => ted.memory.forget({ id: String(m.id), preview: String(m.text || "").slice(0, 300) }));
    if (r && r.ok) { setSt((s) => ({ ...s, items: s.items.filter((x) => x.id !== m.id) })); toast("Забравено."); }
    else if (r && !r.canceled) toast(r.error || "Не успях да забравя.");
  }

  return <>
    <h3>Памет</h3><p className="lead">Паметта на Тед е на сървъра и е същата като в сайта. Тук можете да търсите в нея, да добавите факт и да забравите запомнен факт.</p>
    <div className="hrow mem-search">
      <input id="mem-q" className="inp grow" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} placeholder="Търси в паметта… (напр. име на клиент)" />
      <button className="b wine" onClick={search} disabled={st.status === "loading"}><Icon n="search" />Търси</button>
    </div>
    {st.status === "loading" ? <div className="empty"><i className="spin" /> Търся…</div> : null}
    {st.status === "error" ? <div className="err" role="alert">⚠️ {st.error}</div> : null}
    {st.status === "ok" && !st.items.length ? <div className="empty">Няма съвпадения в паметта.</div> : null}
    {st.items.map((m) => (
      <div className="mem" key={m.id} data-testid="mem-item"><Icon n="bookmark" />
        <div className="tx">{m.text}<small>{[KIND[m.kind] || m.kind, m.at ? fmtDate(m.at) : "", m.case_id ? "по казус" : ""].filter(Boolean).join(" · ")}</small></div>
        {m.kind === "fact" ? <button className="b" onClick={() => forget(m)}>Забрави</button> : null}
      </div>
    ))}
    <div className="sec-h mt">Запомни…</div>
    <div className="fld"><textarea id="mem-new" className="inp" value={fact} maxLength={1500} onChange={(e) => setFact(e.target.value)} placeholder="Напр. „Предпочитам кратки отговори с точни суми в евро.“" /></div>
    <button className="b wine" onClick={remember} disabled={!fact.trim() || saving}>{saving ? <i className="spin" /> : <Icon n="bookmark" />}Запомни</button>
    <div className="info">Тед сам записва разговорите в паметта си на сървъра. „Забрави“ изтрива само запомнени факти (след потвърждение) – не клиенти, имоти или документи, и не записите от разговори.</div>
  </>;
}

function AboutPane({ S, set, toast, onConn }) {
  const [info, setInfo] = useState(null);
  const [boot, setBoot] = useState(null);
  const [check, setCheck] = useState(null);
  useEffect(() => {
    let off = false;
    ted.app.info().then((i) => { if (!off) setInfo(i); }).catch(() => {});
    ted.app.getLaunchAtLogin().then((r) => { if (!off) setBoot(!!(r && r.enabled)); }).catch(() => {});
    return () => { off = true; };
  }, []);
  async function setLaunch(on) {
    const r = await call(() => ted.app.setLaunchAtLogin(on));
    setBoot(!!(r && r.enabled));
    if (!r || !r.ok) toast((r && r.error) || "Настройката не можа да се промени.");
  }
  async function setCompact(on) {
    const r = await call(() => ted.app.setCompact(on));
    if (r && r.ok) set("compact", on); else toast("Размерът на прозореца не можа да се смени.");
  }
  async function logs() { const r = await call(() => ted.app.openLogs()); if (!r || !r.ok) toast((r && r.error) || "Папката с логове не можа да се отвори."); }
  async function verify() {
    setCheck({ status: "loading" });
    const t0 = Date.now();
    const r = await call(() => ted.api.models());
    onConn(r);
    setCheck(r && r.ok ? { status: "ok", text: "Сървърът на Тед отговори за " + (Date.now() - t0) + " ms · " + (Array.isArray(r.models) ? r.models.length : 0) + " модела." } : { status: "bad", text: (r && r.error) || "Няма връзка със сървъра." });
  }
  return <>
    <h3>За програмата</h3><p className="lead">Тед за Windows – програмата на „Имоти Надежда“. Работи със същия сървър и права като Тед в сайта.</p>
    <dl className="kv about-kv"><dt>Версия</dt><dd data-testid="app-version">{info ? info.version : "…"}</dd><dt>Издание</dt><dd>{info ? (info.packaged ? "инсталирана програма" : "версия за разработка") : "…"}</dd></dl>
    <Opt title="Стартирай с Windows" sub="Тед се отваря при влизане в Windows"><Sw id="sw-boot" on={!!boot} dis={boot === null} set={setLaunch} /></Opt>
    <Opt title="Компактен прозорец" sub="Тесен прозорец с подредба като на телефон"><Sw id="sw-compact" on={!!S.compact} set={setCompact} /></Opt>
    <Opt title="Папка с логове" sub="Технически записи без текста на разговорите"><button className="b" onClick={logs}><Icon n="folder" />Отвори</button></Opt>
    <Opt title="Проверка на връзката" sub="Заявка за списъка с модели към сървъра на Тед"><button className="b" onClick={verify} disabled={check && check.status === "loading"}>{check && check.status === "loading" ? <i className="spin" /> : <Icon n="refresh" />}Провери</button></Opt>
    {check && check.status === "ok" ? <div className="verify" data-testid="conn-ok"><Icon n="check" /><span>{check.text}</span></div> : null}
    {check && check.status === "bad" ? <div className="err" role="alert">⚠️ {check.text}</div> : null}
    <div className="info">Програмата не съдържа пароли и ключове. Всяко действие минава през сървъра на сайта със същите проверки на правата. Няма автоматично обновяване – новите версии се инсталират ръчно.</div>
  </>;
}

export default function Settings({ phone, S, set, patch, tab, setTab, close, user, chats, setChats, active, toast, testVoice, speaking, models, modelsErr, refreshModels, rg, rgModels, rgErr, openRealGpt, rgSignOut, read, conn, onConn, exportChat, deleteChat, clearLocal, setConfirm, logout, remembered, manageUsage }) {
  const archived = chats.filter((c) => c.archived);
  const [ptab, setPtab] = useState(tab && tab !== "general" ? tab : null);
  const login = user.email || user.phoneMasked || "—";

  const pane = (
    <div className="pane" data-pane={tab}>
      {tab === "general" && <>
        <h3>Общи</h3><p className="lead">Как изглежда и се държи чатът.</p>
        <Opt title="По-едри букви"><Sw id="sw-big" on={S.big} set={(v) => set("big", v)} /></Opt>
        <Opt title="Enter изпраща" sub="Shift + Enter за нов ред"><Sw id="sw-enter" on={S.enterSend} set={(v) => set("enterSend", v)} /></Opt>
        <Opt title="Показвай действията" sub="Стъпките на Тед под всеки отговор. Неуспешните стъпки и промените в CRM се показват винаги."><Sw id="sw-acts" on={S.showActs} set={(v) => set("showActs", v)} /></Opt>
        <Opt title="🎨 Визия" sub="Имоти Надежда – бордо и злато"><span className="meta">Заключена</span></Opt>
      </>}
      {tab === "model" && <>
        <h3>Модел</h3><p className="lead">Списъкът идва от сървъра на Тед. Под всеки отговор пише реално използваният модел.</p>
        <div className="sec-h">Тед (сървър)</div>
        <button className={"radio" + (S.engine === "server" && !S.model ? " on" : "")} onClick={() => patch({ engine: "server", model: "" })}><span className="rd" /><span className="tx"><b>По подразбиране</b><small>моделът, който сървърът на Тед избира сам</small></span></button>
        {models.map((m) => <button key={m.id} className={"radio" + (S.engine === "server" && S.model === m.id ? " on" : "")} onClick={() => patch({ engine: "server", model: m.id })}><span className="rd" /><span className="tx"><b>{m.name}</b><small>{[m.note, m.vision ? "снимки" : "без снимки", m.pdf ? "PDF" : "без PDF"].filter(Boolean).join(" · ")}</small></span><span className="prov">{provEm(m.provider)} {m.provider}</span></button>)}
        {modelsErr ? <div className="err" role="alert">⚠️ Списъкът с модели не се зареди: {modelsErr} <button className="b" onClick={refreshModels}><Icon n="refresh" />Опитай отново</button></div> : null}
        <div className="sec-h mt">🔗 Real GPT <small>вашият ChatGPT план · само разговор, без достъп до CRM</small></div>
        {!rg.connected ? <button className="radio" onClick={openRealGpt}><span className="rd" /><span className="tx"><b>🔗 Продължи с ChatGPT</b><small>Не е свързан · вход в браузъра с Google, Apple, Microsoft или имейл</small></span><span className="prov">ChatGPT план</span></button> : <>
          {rg.planEnabled === false
            ? <div className="err">⚠️ Използването на ChatGPT плана не е разрешено. <button className="b wine" onClick={openRealGpt}>Продължи с ChatGPT</button></div>
            : <div className="verify"><Icon n="check" /><span>Използва вашия ChatGPT план · <button className="lnk" onClick={manageUsage}>Управление на лимита</button></span></div>}
          {rgModels.map((m) => <button key={m.slug} className={"radio" + (S.engine === "realgpt" && S.rgModel === m.slug ? " on" : "")} disabled={rg.planEnabled === false} onClick={() => patch({ engine: "realgpt", rgModel: m.slug })}><span className="rd" /><span className="tx"><b>{m.displayName}</b><small>{m.slug} · от вашия акаунт</small></span><span className="prov">ChatGPT план</span></button>)}
          {rgErr ? <div className="err" role="alert">⚠️ {rgErr}</div> : null}
          <Opt title="🧠 Ниво на мислене" sub="По избор. Изпраща се само ако изберете ниво; ако моделът не го поддържа, програмата го казва.">
            <select id="rg-eff" className="inp auto" value={S.rgEffort || ""} onChange={(e) => set("rgEffort", e.target.value)}><option value="">По подразбиране</option>{EFFORTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Opt>
          <Opt title={rg.email || "ChatGPT акаунт"} sub="Свързан акаунт"><button className="b" onClick={openRealGpt}>Смени акаунта</button><button className="b" onClick={rgSignOut}>Прекъсни връзката</button></Opt>
        </>}
        <div className="rg-na"><span>ℹ️</span><span>{RG_LIMITS}</span></div>
      </>}
      {tab === "voice" && <>
        <h3>Глас</h3><p className="lead">Как звучи Тед, когато чете отговорите.</p>
        <div className="sec-h">Глас на Тед</div>
        {VOICES.map((v) => <button key={v.id} className={"radio" + (S.voice === v.id ? " on" : "")} onClick={() => set("voice", v.id)}><span className="rd" /><span className="tx"><b>{v.name}</b></span></button>)}
        <div className="sec-h">Стил на говорене</div>
        {STYLES.map((v) => <button key={v.id} className={"radio" + (S.style === v.id ? " on" : "")} onClick={() => set("style", v.id)}><span className="rd" /><span className="tx"><b>{v.name}</b></span></button>)}
        <div className="sec-h">Кога да говори</div>
        {SPEAK.map((v) => <button key={v.id} className={"radio" + (S.speak === v.id ? " on" : "")} onClick={() => set("speak", v.id)}><span className="rd" /><span className="tx"><b>{v.name}</b></span></button>)}
        <button className="b wine" onClick={testVoice}><Icon n={speaking ? "stopsq" : "speaker"} />{speaking ? "Спри" : "Пробвай гласа"}</button>
        <div className="info">Гласът се създава от сървъра на Тед. Текстът на отговора се изпраща там, за да бъде прочетен.</div>
      </>}
      {tab === "dict" && <>
        <h3>Диктовка</h3><p className="lead">Гласовите съобщения се превръщат в текст.</p>
        <Opt title="Изпращай гласовия въпрос веднага" sub="Без преглед на разпознатия текст"><Sw id="sw-ds" on={S.dictSend} set={(v) => set("dictSend", v)} /></Opt>
        <div className="info"><b>Бележки.</b> Микрофонът се включва само когато натиснете бутона и докато записвате. Записът (до 2 минути) се изпраща към сървъра на Тед за разпознаване. Ако Windows не разрешава микрофона, програмата го казва.</div>
      </>}
      {tab === "memory" && <MemoryPane read={read} toast={toast} />}
      {tab === "apps" && <>
        <h3>Свързани услуги</h3><p className="lead">Услугите, с които работи програмата.</p>
        <div className="conn"><span className="ci"><Icon n="home" /></span><div className="tx"><b>CRM „Имоти Надежда“</b><small>{user.name ? user.name + " · " : ""}{login}</small></div>
          <span className={"status " + (conn === "ok" ? "st-succeeded" : conn === "off" ? "st-failed" : "st-queued")}>{conn === "ok" ? "Свързано" : conn === "off" ? "Няма връзка" : "Проверява се"}</span></div>
        <div className="conn"><span className="ci"><Icon n="link" /></span><div className="tx"><b>Real GPT</b><small>{rg.connected ? (rg.email || "ChatGPT акаунт") + (rg.planEnabled === false ? " · планът не е разрешен" : " · планът е разрешен") : "Вашият платен ChatGPT план · не е свързан"}</small></div>
          {rg.connected ? <button className="b" onClick={rgSignOut}>Прекъсни</button> : <button className="b wine" onClick={openRealGpt}>Продължи с ChatGPT</button>}</div>
        <div className="info">Пощата за изпращане, n8n и хранилището за файлове се управляват от CRM на сайта. Програмата ги използва през сървъра на Тед и не пази техни настройки.</div>
      </>}
      {tab === "data" && <>
        <h3>Данни</h3><p className="lead">Чатовете на този компютър: експорт, архив и изтриване.</p>
        <Opt title="Експорт на текущия чат" sub="Markdown файл на място по ваш избор"><button className="b" disabled={!active} onClick={() => exportChat(active)}><Icon n="download" />Експорт</button></Opt>
        <div className="sec-h mt">Архивирани чатове</div>
        {archived.map((c) => <div className="mem" key={c.id}><Icon n="archive" /><div className="tx">{c.title}</div><button className="b" onClick={() => setChats((x) => x.map((y) => (y.id === c.id ? { ...y, archived: false } : y)))}>Възстанови</button><button className="b" onClick={() => deleteChat(c)}>Изтрий</button></div>)}
        {!archived.length ? <div className="empty">Няма архивирани чатове.</div> : null}
        <Opt title="🗃️ Архивирай всички чатове"><button className="b" onClick={() => setConfirm({ title: "Архивиране на всички чатове?", text: "Всички чатове ще отидат в архива. Можете да ги върнете оттук.", ok: () => setChats((x) => x.map((y) => ({ ...y, archived: true }))) })}>Архивирай</button></Opt>
        <Opt title="Изтрий данните на този компютър" sub="Всички запазени тук чатове на вашия профил"><button className="b" onClick={clearLocal}><Icon n="trash" />Изтрий</button></Opt>
        <div className="info">Чатовете се пазят шифровано само на този компютър. Изтриването им тук не променя CRM и паметта на Тед на сървъра – там разговорите остават, както в сайта.</div>
      </>}
      {tab === "account" && <>
        <h3>Акаунт</h3><p className="lead">Профилът, с който сте влезли в CRM.</p>
        <dl className="kv"><dt>Име</dt><dd>{user.name || "—"}</dd><dt>Вход</dt><dd>{login}</dd><dt>Агенция</dt><dd>Имоти Надежда</dd></dl>
        <div className="hrow mt"><button className="b wine" onClick={logout}><Icon n="logout" />Изход</button></div>
        {remembered === false ? <div className="err" role="note" data-testid="session-note-settings">🔐 {SESSION_NOTE}</div> : null}
        <div className="info">Изходът прекратява сесията на този компютър. Запазените тук чатове остават за следващото ви влизане.</div>
      </>}
      {tab === "about" && <AboutPane S={S} set={set} toast={toast} onConn={onConn} />}
    </div>
  );

  if (phone) {
    const cur = TABS.find((t) => t[0] === ptab);
    return (
      <Modal title={cur ? cur[1] + " " + cur[2] : "Настройки"} onClose={close}>
        {cur ? <div className="set-ph"><button className="back-b" onClick={() => setPtab(null)}><Icon n="arrowL" />Назад</button>{pane}</div>
          : <div className="set-list">{TABS.map(([k, ic, l]) => <button key={k} className="set-row" onClick={() => { setTab(k); setPtab(k); }}><span className="tem">{ic}</span><span className="tx">{l}</span><Icon n="chevR" /></button>)}</div>}
      </Modal>
    );
  }
  return (
    <Modal title="Настройки" onClose={close}>
      <div className="set">
        <div className="tabs" role="tablist">{TABS.map(([k, ic, l]) => <button key={k} role="tab" aria-selected={tab === k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}><span className="tem">{ic}</span>{l}</button>)}</div>
        {pane}
      </div>
    </Modal>
  );
}
