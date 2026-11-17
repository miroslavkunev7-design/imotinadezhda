import React from "react";
import { ROLES, SKILLS } from "../../lib/consts.js";

// Агенти = „Умения и роли“: the server modes of Ted (the same as on the website) and the built-in CRM skills.
export default function AgentsPage({ S, setRole, openSkill }) {
  return (
    <div className="page"><div className="page-in" data-testid="agents-page">
      <div className="page-h"><h1>Агенти</h1><p>Умения и роли на Тед. Тед избира ролята автоматично според въпроса. Ръчният избор тук важи, докато не върнете „Автоматично“.</p></div>
      <div className="sheet">
        <div className="sec-h">Роля на Тед</div>
        <div className="grid-cards">{ROLES.map((r) => <button key={r.id} className={"gcard" + (S.role === r.id ? " on" : "")} onClick={() => setRole(r)}><span className="em">{r.em}</span><span><b>{r.name}</b><small>{r.sub}</small></span></button>)}</div>
        <div className="sec-h mt">Вградени умения <small>работят в CRM на сайта</small></div>
        <div className="grid-cards">{SKILLS.map((s) => <button key={s.id} className="gcard" onClick={() => openSkill(s.id)}><span className="em">{s.em}</span><span><b>{s.name}</b><small>{s.sub}</small></span></button>)}</div>
        <div className="info">Ролите са режимите на сървъра на Тед (същите като в сайта). С разрешени инструменти Real GPT получава текста на избраната роля като указание. Магазин за GPTs няма.</div>
      </div>
    </div></div>
  );
}
