import React from "react";
import Icon from "../Icon.jsx";
import ColorIcon from "../ColorIcon.jsx";
import logo from "../../assets/logo.png";

// Rows shared by the desktop sidebar and the phone drawer (ChatGPT desktop order: Проекти, Планирани, Библиотека,
// Плъгини, Агенти). `view` ids of App.jsx. `icon` names a full-colour art of ColorIcon.jsx (0.1.5).
export const NAV = [
  { v: "projects", icon: "folder", name: "Проекти", tid: "side-projects", title: "Казусите на Тед – теми с памет на сървъра" },
  { v: "scheduled", icon: "clock", name: "Планирани", tid: "side-scheduled", title: "Напомняния и задачи по график + календарът в CRM" },
  { v: "library", icon: "library", name: "Библиотека", tid: "side-library", title: "Снимки, документи и видео от чатовете" },
  { v: "plugins", icon: "plug", name: "Плъгини", tid: "side-plugins", title: "Свързани услуги: CRM, ChatGPT план, интернет, имейл, календар" },
  { v: "agents", icon: "bot", name: "Агенти", tid: "side-agents", title: "Умения и роли на Тед" },
];
const CASES_SHOWN = 5;

const chev = (folded) => <Icon n="chev" cls={"sec-chev" + (folded ? " folded" : "")} />;

// Up to five open cases under „Проекти“ (+ „Нов проект…“); the „…“ menu of a case is unchanged.
export function CaseList({ cases, caseView, view, openCase, newCase, onCaseMenu, refreshCases, onAll }) {
  const shown = cases.items.slice(0, CASES_SHOWN);
  return (
    <div className="side-list sub" data-testid="case-list">
      {shown.map((cs) => (
        <div key={cs.id} className={"row" + (view === "case" && caseView && caseView.id === cs.id ? " on" : "")}>
          <button className="t row-ic" onClick={() => openCase(cs.id)} title={cs.title}><ColorIcon n="folder" /><span className="ell">{cs.title}</span></button>
          <button className="more" aria-label="Опции на казуса" onClick={(e) => onCaseMenu(e, cs)}><Icon n="dots" /></button>
        </div>
      ))}
      {cases.items.length > CASES_SHOWN ? <div className="row"><button className="t row-ic" onClick={onAll}><ColorIcon n="more" />Всички проекти ({cases.items.length})</button></div> : null}
      <div className="row"><button className="t row-ic" onClick={newCase}><ColorIcon n="folderPlus" />Нов проект…</button></div>
      {cases.status === "loading" ? <div className="grp-day">Зареждам казусите…</div> : null}
      {cases.status === "error" ? <div className="grp-day side-err">Казусите не се заредиха. <button className="lnk" onClick={refreshCases}>Опитай отново</button></div> : null}
    </div>
  );
}

// Pinned chats and the newest chats (ChatGPT „Recents“) with „Вижте всички…“.
export function ChatSections({ pinned, recent, total, chatRow, fold, setFold, onAll, phone }) {
  return <>
    {pinned.length ? <>
      <div className="sec" data-testid="side-pinned"><button className="sec-t" onClick={() => setFold((f) => ({ ...f, pinned: !f.pinned }))} aria-expanded={!fold.pinned}>{phone ? "Закачено" : "Закачени"}{chev(fold.pinned)}</button></div>
      {!fold.pinned ? <div className="side-list">{pinned.map(chatRow)}</div> : null}
    </> : null}
    <div className="sec" data-testid="side-chats"><button className="sec-t" onClick={() => setFold((f) => ({ ...f, chats: !f.chats }))} aria-expanded={!fold.chats}>Чатове{chev(fold.chats)}</button></div>
    {!fold.chats ? (
      <div className="side-list">
        {recent.map(chatRow)}
        {!total ? <div className="grp-day">Още няма чатове на този компютър.</div> : null}
        {total ? <div className="row"><button className="t row-ic all-b" onClick={onAll} data-testid="side-all"><ColorIcon n="search" />Вижте всички…</button></div> : null}
      </div>
    ) : null}
  </>;
}

// Desktop sidebar (ChatGPT desktop, ref 06): header · Нов чат · Търсене · Проекти(+казуси) · Планирани · Библиотека ·
// Плъгини · Агенти · Закачени · Чатове · профил. Collapsed = icon rail of the same rows.
export default function Sidebar(p) {
  const { S, setMini, drawer, setDrawer, view, active, me, onMe, meOpen, onNew, onSearch, openView, cases, caseView, openCase, newCase, onCaseMenu, refreshCases,
    pinned, recent, total, chatRow, fold, setFold } = p;
  const on = (v) => (view === v || (v === "projects" && view === "case") ? " on" : "");
  return (
    <aside className={"side cg" + (S.mini ? " min" : "") + (drawer ? " open" : "")} aria-label="Странична лента">
      <div className="side-top side-head">
        <div className="logo-tile sm"><img src={logo} alt="Имоти Надежда" /></div>
        <b className="side-name">Тед</b>
        <button className="ibtn" onClick={onSearch} aria-label="Търсене в чатовете" title="Търсене (Ctrl K)" data-testid="side-search-ic"><ColorIcon n="search" /></button>
        <button className="ibtn collapse-btn" onClick={() => setMini(!S.mini)} aria-label={S.mini ? "Отвори лентата" : "Затвори лентата"} title="Ctrl+Shift+S" data-testid="side-toggle"><Icon n="sidebar" /></button>
        {drawer ? <button className="ibtn" onClick={() => setDrawer(false)} aria-label="Затвори"><Icon n="x" /></button> : null}
      </div>
      <nav className="side-nav">
        <button className={"nav n-new" + (view === "chat" && !active ? " on" : "")} onClick={onNew} data-testid="side-new" title="Нов чат"><ColorIcon n="newchat" /><span>Нов чат</span><kbd>Ctrl ⇧ O</kbd></button>
        <button className="nav n-search" onClick={onSearch} data-testid="side-search" title="Търсене в чатовете"><ColorIcon n="search" /><span>Търсене в чатовете</span><kbd>Ctrl K</kbd></button>
      </nav>
      <div className="side-scroll">
        <nav className="side-nav flat">
          {NAV.slice(0, 1).map((n) => <button key={n.v} className={"nav" + on(n.v)} onClick={() => openView(n.v)} data-testid={n.tid} title={n.title}><ColorIcon n={n.icon} /><span>{n.name}</span></button>)}
        </nav>
        {!S.mini ? <CaseList cases={cases} caseView={caseView} view={view} openCase={openCase} newCase={newCase} onCaseMenu={onCaseMenu} refreshCases={refreshCases} onAll={() => openView("projects")} /> : null}
        <nav className="side-nav flat">
          {NAV.slice(1).map((n) => <button key={n.v} className={"nav" + on(n.v)} onClick={() => openView(n.v)} data-testid={n.tid} title={n.title}><ColorIcon n={n.icon} /><span>{n.name}</span></button>)}
        </nav>
        <ChatSections pinned={pinned} recent={recent} total={total} chatRow={chatRow} fold={fold} setFold={setFold} onAll={onSearch} />
      </div>
      <button className="me" onClick={onMe} aria-label="Профил" aria-expanded={!!meOpen} data-testid="me-btn">{me}</button>
    </aside>
  );
}
