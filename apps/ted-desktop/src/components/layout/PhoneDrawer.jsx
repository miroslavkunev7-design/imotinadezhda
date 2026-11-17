import React from "react";
import Icon from "../Icon.jsx";
import { CaseList, ChatSections, NAV } from "./Sidebar.jsx";
import logo from "../../assets/logo.png";

// ChatGPT phone drawer (refs 13/14): „Тед“ + round search · Планирани, Проекти, Библиотека, Плъгини, Агенти,
// Персонализиране · Закачено · чатове · „Вижте всички…“ · bottom: pill „Чат“ (new chat) and the avatar.
const ORDER = ["scheduled", "projects", "library", "plugins", "agents"];

export default function PhoneDrawer(p) {
  const { drawer, view, me, onMe, meOpen, onNew, onSearch, openView, onPersonal, cases, caseView, openCase, newCase, onCaseMenu, refreshCases,
    pinned, recent, total, chatRow, fold, setFold } = p;
  const rows = ORDER.map((v) => NAV.find((n) => n.v === v));
  return (
    <aside className={"side cg ph-drawer" + (drawer ? " open" : "")} aria-label="Странична лента">
      <div className="drawer-head">
        <div className="logo-tile sm"><img src={logo} alt="Имоти Надежда" /></div>
        <b className="side-name">Тед</b>
        <button className="drawer-search" onClick={onSearch} aria-label="Търсене в чатовете" data-testid="side-search"><Icon n="search" /></button>
      </div>
      <div className="side-scroll">
        <nav className="side-nav flat">
          {rows.map((n) => <React.Fragment key={n.v}>
            <button className={"nav" + (view === n.v || (n.v === "projects" && view === "case") ? " on" : "")} onClick={() => openView(n.v)} data-testid={n.tid}><Icon n={n.icon} /><span>{n.name}</span></button>
            {n.v === "projects" && cases.items.length ? <CaseList cases={cases} caseView={caseView} view={view} openCase={openCase} newCase={newCase} onCaseMenu={onCaseMenu} refreshCases={refreshCases} onAll={() => openView("projects")} /> : null}
          </React.Fragment>)}
          <button className="nav" onClick={onPersonal} data-testid="side-personal"><Icon n="sliders" /><span>Персонализиране</span></button>
        </nav>
        <ChatSections phone pinned={pinned} recent={recent} total={total} chatRow={chatRow} fold={fold} setFold={setFold} onAll={onSearch} />
      </div>
      <div className="drawer-foot">
        <button className="drawer-new" onClick={onNew} data-testid="drawer-new"><Icon n="newchat" />Чат</button>
        <button className="me drawer-me" onClick={onMe} aria-label="Профил" aria-expanded={!!meOpen} data-testid="me-btn">{me}</button>
      </div>
    </aside>
  );
}
