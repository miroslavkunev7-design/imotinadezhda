import React, { useEffect, useRef } from "react";
import ColorIcon from "../ColorIcon.jsx";
import { CaseList, ChatSections, NAV } from "./Sidebar.jsx";
import logo from "../../assets/logo.png";

// ChatGPT phone drawer (refs 13/14): „Тед“ + round search · Планирани, Проекти, Библиотека, Плъгини, Агенти,
// Персонализиране · Закачено · чатове · „Вижте всички…“ · bottom: pill „Чат“ (new chat) and the avatar.
const ORDER = ["scheduled", "projects", "library", "plugins", "agents"];

export default function PhoneDrawer(p) {
  const { drawer, setDrawer, view, me, onMe, meOpen, onNew, onSearch, openView, onPersonal, cases, caseView, openCase, newCase, onCaseMenu, refreshCases,
    pinned, recent, total, chatRow, fold, setFold } = p;
  const rows = ORDER.map((v) => NAV.find((n) => n.v === v));
  const ref = useRef(null);
  // Keyboard (review): the open drawer takes the focus, Esc closes it (unless a menu or dialog over it takes the Esc)
  // and the focus returns to „Меню“.
  useEffect(() => {
    if (!drawer) return undefined;
    const menuBtn = () => document.querySelector('.top.ph [aria-label="Меню"]');
    const first = ref.current && ref.current.querySelector("button");
    if (first && !(ref.current.contains(document.activeElement))) first.focus();
    const k = (e) => {
      if (e.key !== "Escape" || document.querySelector(".pop, .modal")) return;
      setDrawer(false);
      const b = menuBtn(); if (b) b.focus();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [drawer]);
  return (
    <aside ref={ref} className={"side cg ph-drawer" + (drawer ? " open" : "")} aria-label="Странична лента">
      <div className="drawer-head">
        <div className="logo-tile sm"><img src={logo} alt="Имоти Надежда" /></div>
        <b className="side-name">Тед</b>
        <button className="drawer-search" onClick={onSearch} aria-label="Търсене в чатовете" data-testid="side-search"><ColorIcon n="search" /></button>
      </div>
      <div className="side-scroll">
        <nav className="side-nav flat">
          {rows.map((n) => <React.Fragment key={n.v}>
            <button className={"nav" + (view === n.v || (n.v === "projects" && view === "case") ? " on" : "")} onClick={() => openView(n.v)} data-testid={n.tid}><ColorIcon n={n.icon} /><span>{n.name}</span></button>
            {n.v === "projects" && cases.items.length ? <CaseList cases={cases} caseView={caseView} view={view} openCase={openCase} newCase={newCase} onCaseMenu={onCaseMenu} refreshCases={refreshCases} onAll={() => openView("projects")} /> : null}
          </React.Fragment>)}
          <button className="nav" onClick={onPersonal} data-testid="side-personal"><ColorIcon n="sliders" /><span>Персонализиране</span></button>
        </nav>
        <ChatSections phone pinned={pinned} recent={recent} total={total} chatRow={chatRow} fold={fold} setFold={setFold} onAll={onSearch} />
      </div>
      <div className="drawer-foot">
        <button className="drawer-new" onClick={onNew} data-testid="drawer-new"><ColorIcon n="newchat" />Чат</button>
        <button className="me drawer-me" onClick={onMe} aria-label="Профил" aria-expanded={!!meOpen} data-testid="me-btn">{me}</button>
      </div>
    </aside>
  );
}
