import React, { useEffect, useState } from "react";
import Icon from "../Icon.jsx";
import { Avatar, Modal, Opt, Sw } from "../ui.jsx";
import { ted } from "../../bridge.js";
import { BROWSE_DEF, EFFORTS, NOTIFY_DEF, README_URL, RG_LIMITS, ROLES, SESSION_NOTE, SPEAK, STYLES, VOICES, provEm } from "../../lib/consts.js";
import { fmtDate, fmtSize, initials } from "../../lib/format.js";
import { openCrm } from "../Cards.jsx";
import { PluginList } from "./PluginsPage.jsx";

// Settings in the order of the ChatGPT app (refs 08–12). Every 0.1.2 pane keeps its data-pane key; new ones are added.
export const SET_GROUPS = [
  { name: "Направете Тед по ваш избор", rows: [["personal", "sliders", "Персонализиране"], ["memory", "bookmark", "Памет"], ["apps", "plug", "Плъгини"]] },
  { name: "Акаунт", rows: [["account", "mail", "Имейл"], ["chatgpt", "link", "ChatGPT акаунт"], ["usage", "sheet", "Използване и лимити"]] },
  { name: "Тема", rows: [["theme", "moon", "Външен вид"], ["accent", "palette", "Акцентен цвят"]] },
  { name: "Настройки на приложението", rows: [["general", "gear", "Общи"], ["model", "bot", "Модел"], ["notify", "bell", "Известия"], ["voice", "speaker", "Глас"], ["dict", "mic", "Диктовка"], ["safety", "shield", "Безопасност"],
    ["security", "lock", "Сигурност и вход"], ["browser", "globe", "Браузър"], ["storage", "archive", "Съхранение"], ["data", "table", "Контрол на данните"]] },
  { name: "За помощ", rows: [["report", "flag", "Съобщете за проблем"], ["helpc", "help", "Помощен център"], ["privacy", "eye", "Център за поверителност"], ["about", "info", "Относно"]] },
];
const ROWS = SET_GROUPS.flatMap((g) => g.rows);
const rowName = (k) => (ROWS.find((r) => r[0] === k) || [k, "", k])[2];
export const SHORTCUTS = [["Нов чат", "Ctrl + Shift + O"], ["Търсене в чатовете", "Ctrl + K"], ["Скрий/покажи лентата", "Ctrl + Shift + S"], ["Копирай последния отговор", "Ctrl + Shift + C"],
  ["Към полето за писане", "Shift + Esc"], ["Бърз прозорец", "Ctrl + Shift + Space"], ["Помощ", "Ctrl + /"], ["Нов ред", "Shift + Enter"]];
const KIND = { fact: "запомнен факт", message: "от разговор", summary: "резюме" };
// A bridge call that never rejects: an IPC failure becomes an ordinary error result.
const call = async (fn) => { try { return await fn(); } catch { return { ok: false, error: "Вътрешна грешка в програмата." }; } };
const H = ({ k, lead }) => <><h3>{rowName(k)}</h3>{lead ? <p className="lead">{lead}</p> : null}</>;

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
    <H k="memory" lead="Паметта на Тед е на сървъра и е същата като в сайта. Тук можете да търсите в нея, да добавите факт и да забравите запомнен факт." />
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

// Персонализиране: what Ted calls you, your own instructions (Real GPT appends them after the program's rules, which they
// can never switch off), a copy into Ted's server memory, and the default role.
function PersonalPane({ S, patch, set, toast }) {
  const [nick, setNick] = useState(S.nick || "");
  const [ins, setIns] = useState(S.instructions || "");
  const dirty = nick !== (S.nick || "") || ins !== (S.instructions || "");
  const save = () => { patch({ nick: nick.trim().slice(0, 60), instructions: ins.slice(0, 1500) }); toast("Запазено."); };
  async function toMemory() {
    const text = [nick.trim() ? "Обръщай се към мен с „" + nick.trim() + "“." : "", ins.trim()].filter(Boolean).join(" ");
    if (!text) { toast("Няма какво да се запомни."); return; }
    const r = await call(() => ted.memory.remember({ text: text.slice(0, 1500) }));
    toast(r && r.ok ? "🔖 Запомнено в паметта на Тед (сървъра)." : (r && r.error) || "Не успях да запомня.");
  }
  return <>
    <H k="personal" lead="Как Тед да се обръща към вас и какво да спазва. Указанията се добавят след правилата на програмата и не могат да ги изключат." />
    <div className="fld"><label htmlFor="set-nick">Как да ви нарича Тед</label><input id="set-nick" className="inp" maxLength={60} value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Напр. Мария" /></div>
    <div className="fld"><label htmlFor="set-instr">Вашите указания <small className="meta">({ins.length}/1500)</small></label>
      <textarea id="set-instr" className="inp" maxLength={1500} value={ins} onChange={(e) => setIns(e.target.value)} placeholder="Напр. „Отговаряй кратко, цените в евро, винаги предлагай следваща стъпка.“" /></div>
    <div className="hrow"><button className="b wine" onClick={save} disabled={!dirty}><Icon n="check" />Запази</button>
      <button className="b" onClick={toMemory}><Icon n="bookmark" />Запомни в паметта на Тед</button></div>
    <div className="info">Real GPT получава указанията с всеки въпрос. Тед (сървърът) ги научава, когато натиснете „Запомни в паметта на Тед“ – паметта му е обща със сайта.</div>
    <div className="sec-h mt">Роля по подразбиране</div>
    <select id="set-role" className="inp auto" value={S.role} onChange={(e) => set("role", e.target.value)}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.em} {r.name}</option>)}</select>
  </>;
}

// Real GPT tools consent (kept by MAIN per CRM user and ChatGPT account, never in settings).
function ConsentBlock({ rg, consent, setConsent }) {
  if (!rg.connected) return <div className="info">Свържете Real GPT, за да изберете дали да ползва инструментите на Тед.</div>;
  return <>
    <Opt title="Инструментите на Тед за Real GPT" sub={consent === "all" ? "Разрешени: Real GPT ползва CRM, интернет и файловете, които прикачите, през вашия ChatGPT акаунт." : consent === "text" ? "Само текст: без CRM, интернет и четене на файлове." : "Още не е избрано – ще ви попитаме при първия въпрос."}>
      <span className="hrow"><button className={"b" + (consent === "all" ? " wine" : "")} onClick={() => setConsent("all")} disabled={consent === "all"}>Разреши</button>
        <button className={"b" + (consent === "text" ? " wine" : "")} onClick={() => setConsent("text")} disabled={consent === "text"}>Само текст</button></span></Opt>
  </>;
}

function UpdatesBlock({ upd, act }) {
  if (!upd) return <div className="upd-box" data-testid="updates"><div className="sec-h">Обновления</div><div className="empty"><i className="spin" /> Проверявам състоянието…</div></div>;
  const v = upd.available && upd.available.version;
  const text = {
    disabled: "Автоматичното обновяване работи само в инсталираната програма за Windows.",
    idle: "Още не е проверявано.",
    checking: "Проверявам за нова версия…",
    none: "Имате последната версия.",
    available: "Има нова версия" + (v ? " " + v : "") + "." + (upd.auto ? " Изтегля се автоматично." : " Натиснете „Изтегли“."),
    downloading: "Изтеглям версия" + (v ? " " + v : "") + "… " + (upd.progress ? Math.round(upd.progress.percent || 0) + " %" : ""),
    // When auto is off, MAIN sets autoInstallOnAppQuit=false: nothing installs at quit, only the button does.
    ready: "Версия" + (v ? " " + v : "") + " е изтеглена и проверена. " + (upd.auto ? "Ще се инсталира при затваряне на програмата." : "Ще се инсталира, когато натиснете „Рестартирай и обнови“."),
    error: "Проверката не успя" + (upd.error ? ": " + upd.error : "."),
  }[upd.status] || "";
  const off = upd.supported === false || upd.status === "disabled";
  return (
    <div className="upd-box" data-testid="updates">
      <div className="sec-h">Обновления</div>
      <dl className="kv"><dt>Версия</dt><dd>{upd.version || "…"}</dd><dt>Последна проверка</dt><dd>{upd.lastCheck ? fmtDate(upd.lastCheck) : "—"}</dd></dl>
      <div className={"upd-st st-" + upd.status} data-testid="upd-status">{text}</div>
      {upd.status === "downloading" && upd.progress ? <div className="lw-bar" aria-hidden="true"><i style={{ width: Math.min(100, upd.progress.percent || 0) + "%" }} /></div> : null}
      <Opt title="Автоматично изтегляне и инсталиране" sub="Новата версия се изтегля сама и се инсталира при затваряне на програмата"><Sw id="sw-upd-auto" on={!!upd.auto} dis={off} set={act.setAuto} /></Opt>
      <div className="hrow mt">
        <button className="b" onClick={act.check} disabled={off || upd.status === "checking" || upd.status === "downloading"}>{upd.status === "checking" ? <i className="spin" /> : <Icon n="refresh" />}Провери сега</button>
        {upd.status === "available" && !upd.auto ? <button className="b wine" onClick={act.download} data-testid="upd-download"><Icon n="download" />Изтегли</button> : null}
        {upd.status === "ready" ? <button className="b wine" onClick={act.install}><Icon n="download" />Рестартирай и обнови</button> : null}
      </div>
      <div className="info">Обновленията идват от страницата с издания на програмата в GitHub. Контролната сума (SHA-512) от latest.yml пази само от повреден файл; програмата не е подписана с код-сертификат, така че не се проверява кой е публикувал изданието.</div>
    </div>
  );
}

function AboutPane({ onConn }) {
  const [info, setInfo] = useState(null);
  const [check, setCheck] = useState(null);
  useEffect(() => { let off = false; ted.app.info().then((i) => { if (!off) setInfo(i); }).catch(() => {}); return () => { off = true; }; }, []);
  async function verify() {
    setCheck({ status: "loading" });
    const t0 = Date.now();
    const r = await call(() => ted.api.models());
    onConn(r);
    setCheck(r && r.ok ? { status: "ok", text: "Сървърът на Тед отговори за " + (Date.now() - t0) + " ms · " + (Array.isArray(r.models) ? r.models.length : 0) + " модела." } : { status: "bad", text: (r && r.error) || "Няма връзка със сървъра." });
  }
  return <>
    <H k="about" lead="Тед за Windows – програмата на „Имоти Надежда“. Работи със същия сървър и права като Тед в сайта." />
    <dl className="kv about-kv"><dt>Версия</dt><dd data-testid="app-version">{info ? info.version : "…"}</dd><dt>Издание</dt><dd>{info ? (info.packaged ? "инсталирана програма" : "версия за разработка") : "…"}</dd></dl>
    <Opt title="Проверка на връзката" sub="Заявка за списъка с модели към сървъра на Тед"><button className="b" onClick={verify} disabled={check && check.status === "loading"}>{check && check.status === "loading" ? <i className="spin" /> : <Icon n="refresh" />}Провери</button></Opt>
    {check && check.status === "ok" ? <div className="verify" data-testid="conn-ok"><Icon n="check" /><span>{check.text}</span></div> : null}
    {check && check.status === "bad" ? <div className="err" role="alert">⚠️ {check.text}</div> : null}
    <div className="sec-h mt">Лицензи</div>
    <p className="help-p">Програмата е с лиценз MIT. Използва Electron, React, Vite и библиотеките за документи и обновяване (docx, pdfkit, write-excel-file, read-excel-file, mammoth, unpdf, electron-updater), всяка със свой свободен лиценз (MIT, BSD-2-Clause, Apache-2.0); текстовете на тези лицензи са в архива на програмата (resources\app.asar, папка node_modules). Лицензът на Тед и на шрифтовете е в папката resources\licenses. Шрифтовете Roboto Condensed и PT Serif са с лиценз SIL Open Font License 1.1.</p>
    <div className="info">Програмата не съдържа пароли и ключове. Всяко действие минава през сървъра на сайта със същите проверки на правата.</div>
  </>;
}

function BrowserPane({ S, patch, toast }) {
  const b = { ...BROWSE_DEF, ...(S.browse && typeof S.browse === "object" ? S.browse : {}) };
  const [blocked, setBlocked] = useState((b.blocked || []).join("\n"));
  const [url, setUrl] = useState("");
  const [test, setTest] = useState(null);
  const put = (x) => patch({ browse: { ...b, ...x } });
  function saveBlocked() {
    const hosts = [...new Set(blocked.split(/[\s,;]+/).map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter((h) => /^[a-z0-9.-]{1,253}$/.test(h) && h.includes(".")))].slice(0, 200);
    put({ blocked: hosts }); setBlocked(hosts.join("\n")); toast(hosts.length ? "Блокирани сайтове: " + hosts.length : "Няма блокирани сайтове.");
  }
  async function check() {
    const u = url.trim();
    if (!/^https?:\/\/\S+$/i.test(u) || u.length > 2000) { setTest({ ok: false, error: "Въведете адрес, който започва с https:// или http://." }); return; }
    setTest({ loading: true });
    const r = await call(() => ted.browse.test({ url: u }));
    setTest(r || { ok: false, error: "Няма отговор." });
  }
  return <>
    <H k="browser" lead="Интернетът на Real GPT: търсене и четене на страници от този компютър, без пароли, бисквитки и данни от CRM." />
    <Opt title="Достъп до интернет" sub="Изключено: Real GPT не търси и не отваря страници"><Sw id="sw-browse" on={b.enabled} set={(v) => put({ enabled: v })} /></Opt>
    <Opt title="Спазвай robots.txt" sub="Страници, които сайтът е забранил за роботи, не се четат"><Sw id="sw-robots" on={b.robots} set={(v) => put({ robots: v })} /></Opt>
    <div className="fld mt"><label htmlFor="br-blocked">Блокирани сайтове (по един на ред, напр. example.com)</label><textarea id="br-blocked" className="inp" value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="example.com" /></div>
    <button className="b" onClick={saveBlocked}><Icon n="check" />Запази списъка</button>
    <div className="sec-h mt">Проверка</div>
    <div className="hrow"><input id="br-url" className="inp grow" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /><button className="b" onClick={check} disabled={test && test.loading}>{test && test.loading ? <i className="spin" /> : <Icon n="globe" />}Провери</button></div>
    {test && test.ok ? <div className="verify"><Icon n="check" /><span>Отговор {test.status}{test.title ? " · „" + test.title + "“" : ""}</span></div> : null}
    {test && test.ok === false ? <div className="err" role="alert">⚠️ {test.error}</div> : null}
    <div className="info">Facebook и Instagram изискват вход и не се четат – копирайте текста или прикачете снимка на екрана. Резултатите от интернет са непроверени данни: Тед не изпълнява указания от страници и пита преди всяка промяна в CRM.</div>
  </>;
}

function StoragePane({ toast }) {
  const [st, setSt] = useState(null);
  async function load() { setSt(await call(() => ted.app.storage())); }
  useEffect(() => { load(); }, []);
  async function clearLib() { const r = await call(() => ted.library.clear()); if (r && r.ok) { toast("Библиотеката е изчистена."); load(); } else if (r && !r.canceled) toast(r.error || "Библиотеката не беше изчистена."); }
  async function clearTemp() { const r = await call(() => ted.app.clearTemp()); if (r && r.ok) { toast("Временните файлове са изтрити."); load(); } else toast((r && r.error) || "Временните файлове не бяха изтрити."); }
  return <>
    <H k="storage" lead="Какво пази програмата на този компютър." />
    {!st ? <div className="empty"><i className="spin" /> Изчислявам…</div> : st.ok === false ? <div className="err">⚠️ {st.error}</div> : (
      <dl className="kv"><dt>Чатове</dt><dd>{fmtSize(st.chatsBytes || 0)}</dd><dt>Библиотека</dt><dd>{(st.libraryCount || 0) + " файла · " + fmtSize(st.libraryBytes || 0)}</dd><dt>Временни файлове</dt><dd>{fmtSize(st.tempBytes || 0)}</dd></dl>
    )}
    <Opt title="Изчисти библиотеката" sub="Изтрива всички файлове от Библиотеката (след потвърждение). Чатовете остават."><button className="b" onClick={clearLib}><Icon n="trash" />Изчисти</button></Opt>
    <Opt title="Изчисти временните файлове" sub="Копията, отворени с „Отвори“, в папката за временни файлове"><button className="b" onClick={clearTemp}><Icon n="trash" />Изчисти</button></Opt>
    <div className="info">Чатовете и Библиотеката са шифровани за вашия потребител в Windows. Изтриването тук не променя CRM и паметта на Тед на сървъра.</div>
  </>;
}

export default function SettingsView(p) {
  const { phone, S, set, patch, tab, setTab, close, user, chats, setChats, active, toast, testVoice, speaking, models, modelsErr, refreshModels, rg, rgModels, rgErr,
    openRealGpt, rgSignOut, read, onConn, exportChat, deleteChat, clearLocal, setConfirm, logout, remembered, manageUsage, consent, setConsent, pl, upd, updAct, signOutAll } = p;
  const archived = chats.filter((c) => c.archived);
  const [ptab, setPtab] = useState(tab && tab !== "general" ? tab : null);
  const [boot, setBoot] = useState(null);
  const login = user.email || user.phoneMasked || "—";
  const notify = { ...NOTIFY_DEF, ...(S.notify && typeof S.notify === "object" ? S.notify : {}) };
  useEffect(() => { let off = false; ted.app.getLaunchAtLogin().then((r) => { if (!off) setBoot(!!(r && r.enabled)); }).catch(() => {}); return () => { off = true; }; }, []);
  async function setLaunch(on) { const r = await call(() => ted.app.setLaunchAtLogin(on)); setBoot(!!(r && r.enabled)); if (!r || !r.ok) toast((r && r.error) || "Настройката не можа да се промени."); }
  async function setCompact(on) { const r = await call(() => ted.app.setCompact(on)); if (r && r.ok) set("compact", on); else toast("Размерът на прозореца не можа да се смени."); }
  async function report() {
    const r = await call(() => ted.app.reportProblem()); if (!r || !r.ok) toast((r && r.error) || "Не успях да отворя логовете.");
  }
  async function openLogs() {
    const r = await call(() => ted.app.openLogs()); if (!r || !r.ok) toast((r && r.error) || "Папката с логове не можа да се отвори.");
  }
  const value = { account: login, chatgpt: rg.connected ? rg.email || "свързан" : "не е свързан", theme: "Имоти Надежда", accent: "Бордо и злато", general: "Български" };

  const pane = (
    <div className="pane" data-pane={tab}>
      {tab === "personal" && <PersonalPane S={S} patch={patch} set={set} toast={toast} />}
      {tab === "memory" && <MemoryPane read={read} toast={toast} />}
      {tab === "apps" && <><H k="apps" lead="Услугите, с които работи програмата, и истинското им състояние." /><PluginList pl={pl} /></>}
      {tab === "account" && <>
        <H k="account" lead="Профилът, с който сте влезли в CRM." />
        <dl className="kv"><dt>Име</dt><dd>{user.name || "—"}</dd><dt>Вход</dt><dd>{login}</dd><dt>Агенция</dt><dd>Имоти Надежда</dd></dl>
        <div className="hrow mt"><button className="b wine" onClick={logout}><Icon n="logout" />Изход</button></div>
        {remembered === false ? <div className="err" role="note" data-testid="session-note-settings">🔐 {SESSION_NOTE}</div> : null}
        <div className="info">Изходът прекратява сесията на този компютър. Запазените тук чатове остават за следващото ви влизане.</div>
      </>}
      {tab === "chatgpt" && <>
        <H k="chatgpt" lead="Real GPT отговаря през вашия платен ChatGPT план (Sign in with ChatGPT)." />
        {!rg.connected ? <button className="radio" onClick={openRealGpt}><span className="rd" /><span className="tx"><b>🔗 Продължи с ChatGPT</b><small>Не е свързан · вход в браузъра с Google, Apple, Microsoft или имейл</small></span><span className="prov">ChatGPT план</span></button> : <>
          <dl className="kv"><dt>Акаунт</dt><dd>{rg.email || "ChatGPT акаунт"}</dd><dt>План</dt><dd>{rg.planEnabled === false ? "използването не е разрешено" : "разрешен за тази програма"}</dd></dl>
          {rg.planEnabled === false ? <div className="err">⚠️ Използването на ChatGPT плана не е разрешено. <button className="b wine" onClick={openRealGpt}>Продължи с ChatGPT</button></div> : null}
          <div className="hrow mt"><button className="b" onClick={openRealGpt}>Смени акаунта</button><button className="b" onClick={rgSignOut}>Прекъсни връзката</button></div>
          <div className="sec-h mt">Инструменти</div>
          <ConsentBlock rg={rg} consent={consent} setConsent={setConsent} />
        </>}
        <div className="rg-na"><span>ℹ️</span><span>{RG_LIMITS}</span></div>
      </>}
      {tab === "usage" && <>
        <H k="usage" lead="Лимитите на Real GPT са тези на вашия ChatGPT план." />
        <Opt title="Използване на ChatGPT плана" sub="Страницата за лимити в ChatGPT (отваря се в браузъра)"><button className="b" onClick={manageUsage}><Icon n="external" />Управление на лимита</button></Opt>
        <div className="info">Снимките и видеото се правят от сървъра на Тед (Gemini, AI видео) и се плащат от агенцията, не от ChatGPT плана. Видеото винаги иска потвърждение с цената преди старт. Тед (сървър) има свои лимити – когато свършат, програмата го казва.</div>
      </>}
      {tab === "model" && <>
        <H k="model" lead="Списъкът идва от сървъра на Тед. Под всеки отговор пише реално използваният модел." />
        <div className="sec-h">Тед Асистент · Сървър</div>
        <button className={"radio" + (S.engine === "server" && !S.model ? " on" : "")} onClick={() => patch({ engine: "server", model: "" })}><span className="rd" /><span className="tx"><b>По подразбиране</b><small>моделът, който сървърът на Тед избира сам</small></span></button>
        {models.map((m) => <button key={m.id} className={"radio" + (S.engine === "server" && S.model === m.id ? " on" : "")} onClick={() => patch({ engine: "server", model: m.id })}><span className="rd" /><span className="tx"><b>{m.name}</b><small>{[m.note, m.vision ? "снимки" : "без снимки", m.pdf ? "PDF" : "без PDF"].filter(Boolean).join(" · ")}</small></span><span className="prov">{provEm(m.provider)} {m.provider}</span></button>)}
        {modelsErr ? <div className="err" role="alert">⚠️ Списъкът с модели не се зареди: {modelsErr} <button className="b" onClick={refreshModels}><Icon n="refresh" />Опитай отново</button></div> : null}
        <div className="sec-h mt">🔗 Real GPT <small>вашият ChatGPT план</small></div>
        {!rg.connected ? <button className="radio" onClick={openRealGpt}><span className="rd" /><span className="tx"><b>🔗 Продължи с ChatGPT</b><small>Не е свързан · вход в браузъра с Google, Apple, Microsoft или имейл</small></span><span className="prov">ChatGPT план</span></button> : <>
          {rg.planEnabled === false
            ? <div className="err">⚠️ Използването на ChatGPT плана не е разрешено. <button className="b wine" onClick={openRealGpt}>Продължи с ChatGPT</button></div>
            : <div className="verify"><Icon n="check" /><span>Използва вашия ChatGPT план · <button className="lnk" onClick={manageUsage}>Управление на лимита</button></span></div>}
          {rgModels.map((m) => <button key={m.slug} className={"radio" + (S.engine === "realgpt" && S.rgModel === m.slug ? " on" : "")} disabled={rg.planEnabled === false} onClick={() => patch({ engine: "realgpt", rgModel: m.slug })}><span className="rd" /><span className="tx"><b>{m.displayName}</b><small>{m.slug} · от вашия акаунт</small></span><span className="prov">ChatGPT план</span></button>)}
          {rgErr ? <div className="err" role="alert">⚠️ {rgErr}</div> : null}
          <Opt title="🧠 Усилие (ниво на мислене)" sub="По избор. Изпраща се само ако изберете ниво; ако моделът не го поддържа, програмата го казва.">
            <select id="rg-eff" className="inp auto" value={S.rgEffort || ""} onChange={(e) => set("rgEffort", e.target.value)}><option value="">Стандартно</option>{EFFORTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Opt>
          <Opt title={rg.email || "ChatGPT акаунт"} sub="Свързан акаунт"><button className="b" onClick={openRealGpt}>Смени акаунта</button><button className="b" onClick={rgSignOut}>Прекъсни връзката</button></Opt>
        </>}
        <div className="rg-na"><span>ℹ️</span><span>{RG_LIMITS}</span></div>
      </>}
      {tab === "theme" && <>
        <H k="theme" lead="Визията на програмата е тази на „Имоти Надежда“." />
        <button className="radio on" aria-pressed="true"><span className="rd" /><span className="tx"><b>Имоти Надежда</b><small>бордо стъкло, злато и снимката на дома</small></span></button>
        <div className="info">Светла и тъмна тема с цветовете на агенцията не са направени, затова няма избор „Система/Светла/Тъмна“.</div>
      </>}
      {tab === "accent" && <>
        <H k="accent" lead="Акцентният цвят на бутоните и рамките." />
        <button className="radio on" aria-pressed="true"><span className="rd" /><span className="tx"><b>Бордо и злато</b><small>цветовете на „Имоти Надежда“</small></span></button>
        <div className="info">Други акценти не се предлагат, за да остане визията на агенцията еднаква навсякъде.</div>
      </>}
      {tab === "general" && <>
        <H k="general" lead="Как изглежда и се държи програмата." />
        <Opt title="Език" sub="Езикът на програмата"><span className="meta">Български</span></Opt>
        <Opt title="Стартирай с Windows" sub="Тед се отваря при влизане в Windows"><Sw id="sw-boot" on={!!boot} dis={boot === null} set={setLaunch} /></Opt>
        <Opt title="Компактен прозорец" sub="Тесен прозорец с подредба като на телефон"><Sw id="sw-compact" on={!!S.compact} set={setCompact} /></Opt>
        <Opt title="По-едри букви"><Sw id="sw-big" on={S.big} set={(v) => set("big", v)} /></Opt>
        <Opt title="Enter изпраща" sub="Shift + Enter за нов ред"><Sw id="sw-enter" on={S.enterSend} set={(v) => set("enterSend", v)} /></Opt>
        <Opt title="Показвай действията" sub="Стъпките на Тед под всеки отговор. Неуспешните стъпки и промените в CRM се показват винаги."><Sw id="sw-acts" on={S.showActs} set={(v) => set("showActs", v)} /></Opt>
        <UpdatesBlock upd={upd} act={updAct} />
      </>}
      {tab === "notify" && <>
        <H k="notify" lead="Кога програмата да ви известява." />
        <Opt title="Планирани задачи" sub="Известие на Windows, когато дойде време за напомняне или задача (задачите се изпълняват и без него)"><Sw id="sw-n-sched" on={notify.scheduled} set={(v) => patch({ notify: { ...notify, scheduled: v } })} /></Opt>
        <Opt title="Нова версия" sub="Лента в прозореца, когато новата версия е изтеглена и готова"><Sw id="sw-n-upd" on={notify.updates} set={(v) => patch({ notify: { ...notify, updates: v } })} /></Opt>
      </>}
      {tab === "voice" && <>
        <H k="voice" lead="Как звучи Тед, когато чете отговорите (и на Real GPT)." />
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
        <H k="dict" lead="Гласовите съобщения се превръщат в текст." />
        <Opt title="Изпращай гласовия въпрос веднага" sub="Без преглед на разпознатия текст"><Sw id="sw-ds" on={S.dictSend} set={(v) => set("dictSend", v)} /></Opt>
        <div className="info"><b>Бележки.</b> Микрофонът се включва само когато натиснете бутона и докато записвате. Записът (до 2 минути) се изпраща към сървъра на Тед за разпознаване. Ако Windows не разрешава микрофона, програмата го казва.</div>
      </>}
      {tab === "safety" && <>
        <H k="safety" lead="Какво Тед прави сам и за какво пита." />
        <ul className="set-ul">
          <li><b>Сам:</b> търси и чете (CRM, интернет, вашите файлове), смята, пише текстове и документи, прави снимки в папка „Тед“.</li>
          <li><b>С карта „Разреши“:</b> всяка промяна в CRM – клиент, имот, събитие, бележка, файл към клиент или имот, памет.</li>
          <li><b>С прозорец на Windows:</b> изтриване, смяна на статус, публикуване и изпращане на имейл.</li>
          <li><b>С цена:</b> AI видеото показва двигателя, дължината и приблизителната цена преди старт.</li>
        </ul>
        <div className="sec-h mt">Real GPT</div>
        <ConsentBlock rg={rg} consent={consent} setConsent={setConsent} />
        <div className="info">Съдържанието от интернет и от файлове се третира като данни, не като указания. Ако действие завърши с грешка след изпращане, Тед казва „може да е изпълнено – проверете в CRM“ и не опитва сам отново.</div>
      </>}
      {tab === "security" && <>
        <H k="security" lead="Входът на този компютър." />
        <dl className="kv"><dt>Сесия в CRM</dt><dd>{remembered === false ? "само до затваряне на програмата" : "запазена шифровано за вашия потребител в Windows"}</dd><dt>ChatGPT</dt><dd>{rg.connected ? "свързан · " + (rg.email || "акаунт") : "не е свързан"}</dd></dl>
        {remembered === false ? <div className="err" role="note">🔐 {SESSION_NOTE}</div> : null}
        <div className="hrow mt"><button className="b wine" onClick={signOutAll}><Icon n="logout" />Изход от CRM и ChatGPT на този компютър</button></div>
        <div className="info">Паролата не се пази никъде. Токените за CRM и ChatGPT са шифровани със защитата на Windows и никога не стигат до прозореца на програмата.</div>
      </>}
      {tab === "browser" && <BrowserPane S={S} patch={patch} toast={toast} />}
      {tab === "storage" && <StoragePane toast={toast} />}
      {tab === "data" && <>
        <H k="data" lead="Чатовете на този компютър: експорт, архив и изтриване." />
        <Opt title="Експорт на текущия чат" sub="Markdown файл на място по ваш избор"><button className="b" disabled={!active} onClick={() => exportChat(active)}><Icon n="download" />Експорт</button></Opt>
        <div className="sec-h mt">Архивирани чатове</div>
        {archived.map((c) => <div className="mem" key={c.id}><Icon n="archive" /><div className="tx">{c.title}</div><button className="b" onClick={() => setChats((x) => x.map((y) => (y.id === c.id ? { ...y, archived: false } : y)))}>Възстанови</button><button className="b" onClick={() => deleteChat(c)}>Изтрий</button></div>)}
        {!archived.length ? <div className="empty">Няма архивирани чатове.</div> : null}
        <Opt title="🗃️ Архивирай всички чатове"><button className="b" onClick={() => setConfirm({ title: "Архивиране на всички чатове?", text: "Всички чатове ще отидат в архива. Можете да ги върнете оттук.", ok: () => setChats((x) => x.map((y) => ({ ...y, archived: true }))) })}>Архивирай</button></Opt>
        <Opt title="Изтрий данните на този компютър" sub="Всички запазени тук чатове на вашия профил"><button className="b" onClick={clearLocal}><Icon n="trash" />Изтрий</button></Opt>
        {rg.connected && consent === "all" ? <Opt title="Отмени съгласието за инструменти" sub="Real GPT отново отговаря само с текст – без CRM, интернет и файлове"><button className="b" onClick={() => setConsent("text")}>Отмени</button></Opt> : null}
        <div className="info">Чатовете се пазят шифровано само на този компютър. Изтриването им тук не променя CRM и паметта на Тед на сървъра – там разговорите остават, както в сайта.</div>
      </>}
      {tab === "report" && <>
        <H k="report" lead="Нещо не работи както трябва?" />
        <p className="help-p">Натиснете бутона: ще се отвори папката с техническите записи (без текста на разговорите, паролите и токените) и нов имейл с версията на програмата. Опишете какво направихте и прикачете файла main.log.</p>
        <div className="hrow"><button className="b wine" onClick={report}><Icon n="flag" />Съобщи за проблем</button>
          <button className="b" onClick={openLogs}><Icon n="folder" />Папка с логове</button></div>
      </>}
      {tab === "helpc" && <>
        <H k="helpc" lead="Ръководството и клавишните комбинации." />
        <Opt title="Ръководство на Тед за Windows" sub="README в GitHub – инсталиране, възможности, ограничения"><button className="b" onClick={() => Promise.resolve(ted.app.openExternal(README_URL)).catch(() => {})}><Icon n="external" />Отвори</button></Opt>
        <Opt title="CRM на сайта" sub="Отваря се в браузъра"><button className="b" onClick={openCrm}><Icon n="external" />Отвори</button></Opt>
        <div className="sec-h mt">Клавишни комбинации</div>
        <dl className="kv">{SHORTCUTS.map(([a, b]) => <React.Fragment key={a}><dt>{a}</dt><dd>{b}</dd></React.Fragment>)}</dl>
      </>}
      {tab === "privacy" && <>
        <H k="privacy" lead="Какво пази програмата и с кого говори." />
        <ul className="set-ul">
          <li><b>Паролата</b> се изпраща само към входа на imotinadezhda.bg и не се записва никъде.</li>
          <li><b>Сесиите</b> за CRM и ChatGPT са шифровани със защитата на Windows за вашия потребител.</li>
          <li><b>Чатовете и Библиотеката</b> са шифровани на този компютър и разделени по профил.</li>
          <li><b>Мрежа:</b> imotinadezhda.bg и услугата за вход на сайта; при Real GPT – OpenAI (auth.openai.com, api.openai.com); интернетът на Real GPT – без пароли и бисквитки; обновленията – само от GitHub.</li>
          <li><b>Логове:</b> само технически събития – без текста на съобщенията, файловете и токените.</li>
          <li>Няма реклами, статистики за употреба и изпращане на сривове.</li>
        </ul>
        <button className="b" onClick={() => Promise.resolve(ted.app.openExternal(README_URL)).catch(() => {})}><Icon n="external" />Пълният текст в ръководството</button>
      </>}
      {tab === "about" && <AboutPane onConn={onConn} />}
    </div>
  );

  const list = (
    <div className="set-list sv-list">
      <div className="set-prof"><Avatar text={initials(user.name, user.email)} /><span className="me-txt"><b>{user.name || "Профил"}</b><small>{login}</small></span></div>
      {SET_GROUPS.map((g) => (
        <div className="set-grp" key={g.name} role="group" aria-label={g.name}>
          <div className="set-grp-h">{g.name}</div>
          {g.rows.map(([k, ic, l]) => (
            <button key={k} className={"set-row" + (!phone && tab === k ? " on" : "")} aria-current={!phone && tab === k ? "page" : undefined} data-row={k} onClick={() => { setTab(k); setPtab(k); }}>
              <Icon n={ic} /><span className="tx">{l}</span>{value[k] ? <small className="set-val">{value[k]}</small> : null}{phone ? <Icon n="chevR" /> : null}
            </button>
          ))}
        </div>
      ))}
      <button className="set-row danger" onClick={logout} data-row="logout"><Icon n="logout" /><span className="tx">Излизане от акаунта</span></button>
    </div>
  );

  if (phone) {
    return (
      <Modal title={ptab ? rowName(ptab) : "Настройки"} onClose={close}>
        {ptab ? <div className="set-ph"><button className="back-b" onClick={() => setPtab(null)}><Icon n="arrowL" />Назад</button>{pane}</div> : list}
      </Modal>
    );
  }
  return (
    <Modal title="Настройки" onClose={close}>
      <div className="set setv">{list}{pane}</div>
    </Modal>
  );
}
