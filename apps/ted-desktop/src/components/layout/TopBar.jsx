import React from "react";
import Icon from "../Icon.jsx";
import { MODES } from "../../lib/consts.js";

const TEMP_TITLE = "Временен чат – не се пази на този компютър";
const MODE_TIP = "Чат и Работа могат всичко. „Работа“ позволява по-дълги задачи с много стъпки (Real GPT) и показва свързаните услуги. С Тед (сървър) важат лимитите на сървъра – превключването сменя само началния екран.";

// Segmented Чат | Работа (ChatGPT Chat | Work).
// Keyboard as a WAI-ARIA tablist: ←/→ (and Home/End) move to the other mode and focus it; only the selected tab is
// in the Tab order. aria-controls = the main area that the mode changes.
export function ModeToggle({ mode, setMode, cls }) {
  const onKey = (e) => {
    const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')];
    let i = tabs.indexOf(document.activeElement); // from the focused tab (WAI-ARIA), else from the selected one
    if (i < 0) i = MODES.findIndex((m) => m.id === mode);
    let j = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % MODES.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + MODES.length) % MODES.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = MODES.length - 1;
    if (j == null) return;
    e.preventDefault();
    setMode(MODES[j].id);
    if (tabs[j]) tabs[j].focus();
  };
  return (
    <div className={"seg mode-seg" + (cls ? " " + cls : "")} role="tablist" aria-label="Режим" data-testid="mode-toggle" title={MODE_TIP} onKeyDown={onKey}>
      {MODES.map((m) => <button key={m.id} role="tab" id={"mode-tab-" + m.id + (cls ? "-" + cls : "")} aria-selected={mode === m.id} aria-controls="main-area" tabIndex={mode === m.id ? 0 : -1} className={mode === m.id ? "on" : ""} onClick={() => setMode(m.id)}>{m.name}</button>)}
    </div>
  );
}

// ChatGPT desktop top bar: [sidebar] [model ▾] ······ [Чат | Работа] ······ [⏳ Временен] […] [план]. Phone: burger,
// model, ⏳, new chat, „…“ (Чат | Работа sits in the model menu, as in the ChatGPT phone app).
export default function TopBar({ phone, mini, chat, view, temp, setTemp, modelLabel, onModel, modelOpen, mode, setMode, rgOn, manageUsage, onMenu, onExpand, onNewChat, onChatMenu }) {
  if (phone) return (
    <header className="top ph">
      <button className="ibtn burger" onClick={onMenu} aria-label="Меню"><Icon n="menu" /></button>
      <button className="mtitle" onClick={onModel} aria-haspopup="menu" aria-expanded={!!modelOpen} data-testid="model-btn">{chat && chat.temporary ? "⏳ " : ""}<span>{modelLabel}</span><Icon n="chev" cls="sm16" /></button>
      <span className="spacer" />
      {!chat && view === "chat" ? <button className={"ibtn tmp-i" + (temp ? " on" : "")} onClick={() => setTemp(!temp)} aria-label="Временен чат" aria-pressed={temp} title={TEMP_TITLE}>⏳</button> : null}
      <button className="ibtn" onClick={onNewChat} aria-label="Нов чат"><Icon n="newchat" /></button>
      {chat ? <button className="ibtn" onClick={onChatMenu} aria-label="Опции на разговора"><Icon n="dots" /></button> : null}
    </header>
  );
  return (
    <header className="top cg">
      <div className="top-l">
        <button className="ibtn burger" onClick={onMenu} aria-label="Меню"><Icon n="menu" /></button>
        {/* No sidebar toggle here: the collapsed sidebar (rail) shows its own, ChatGPT has only one. */}
        {/* Narrow windows drop the „Real GPT · “ prefix so the model itself stays readable (the full name is the title). */}
        <button className="mtitle top-model" onClick={onModel} aria-haspopup="menu" aria-expanded={!!modelOpen} data-testid="model-btn" title={modelLabel}>{chat && chat.temporary ? "⏳ " : ""}<span>{String(modelLabel).startsWith("Real GPT · ") ? <><i className="ml-pfx">Real GPT · </i>{String(modelLabel).slice(11)}</> : modelLabel}</span><Icon n="chev" cls="sm16" /></button>
      </div>
      <ModeToggle mode={mode} setMode={setMode} />
      <div className="top-r">
        {chat && chat.temporary ? <span className="tmp-tag">⏳ Временен чат</span> : null}
        {!chat && view === "chat" ? <button className={"tmp" + (temp ? " on" : "")} onClick={() => setTemp(!temp)} title={TEMP_TITLE} aria-pressed={temp}>⏳<span>Временен</span></button> : null}
        {chat ? <button className="ibtn" onClick={onChatMenu} aria-label="Опции на разговора"><Icon n="dots" /></button> : null}
        <button className="ibtn newc" onClick={onNewChat} aria-label="Нов чат"><Icon n="newchat" /></button>
        {rgOn ? <span className="rg-ind" data-testid="rg-ind">Използва вашия ChatGPT план<button className="lnk" onClick={manageUsage}>Управление на лимита</button></span> : null}
      </div>
    </header>
  );
}
