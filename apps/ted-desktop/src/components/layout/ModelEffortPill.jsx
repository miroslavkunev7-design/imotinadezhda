import React from "react";
import Icon from "../Icon.jsx";
import { It, Pop } from "../ui.jsx";
import { EFFORTS, RG_LIMITS, effortName, provEm } from "../../lib/consts.js";

// The model list: shared by the top-bar model button („Тед ▾“ / „Real GPT · … ▾“) and „Разширени → Модел ›“.
export function ModelItems({ m, close }) {
  const { S, patch, models, modelsErr, refreshModels, rg, rgModels, rgErr, loadRgModels, openRealGpt, rgSignOut, manageUsage } = m;
  return <>
    <div className="grp">Тед Асистент · Сървър</div>
    <It em="🤖" title="По подразбиране" sub="моделът, който сървърът на Тед избира сам" check={S.engine === "server" && !S.model} onClick={() => { patch({ engine: "server", model: "" }); close(); }} />
    {models.map((x) => <It key={x.id} em={provEm(x.provider)} title={x.name} sub={[x.note, x.vision ? "снимки" : "", x.pdf ? "PDF" : ""].filter(Boolean).join(" · ")} prov={x.provider} check={S.engine === "server" && S.model === x.id} onClick={() => { patch({ engine: "server", model: x.id }); close(); }} />)}
    {modelsErr ? <div className="info pop-info">Списъкът с модели не се зареди: {modelsErr} <button className="lnk" onClick={refreshModels}>Опитай отново</button></div> : null}
    <div className="grp">🔗 Real GPT · вашият ChatGPT план</div>
    {!rg.connected ? <It em="🔗" title="Продължи с ChatGPT" sub="вход с вашия ChatGPT акаунт в браузъра" prov="ChatGPT план" onClick={() => { close(); openRealGpt(); }} /> : <>
      <div className="seg-l">{rg.email || "ChatGPT акаунт"} · модели от вашия акаунт</div>
      {rg.planEnabled === false ? <div className="info pop-info">Използването на ChatGPT плана не е разрешено. <button className="lnk" onClick={() => { close(); openRealGpt(); }}>Продължи с ChatGPT</button> и го разрешете.</div>
        : <div className="rg-use" data-testid="rg-use">Използва вашия ChatGPT план<button className="lnk" onClick={manageUsage}>Управление на лимита</button></div>}
      {rgModels.map((x) => <It key={x.slug} em="✴️" title={x.displayName} sub={x.slug} check={S.engine === "realgpt" && S.rgModel === x.slug} onClick={() => { patch({ engine: "realgpt", rgModel: x.slug }); close(); }} />)}
      {rgErr ? <div className="info pop-info">{rgErr} <button className="lnk" onClick={loadRgModels}>Опитай отново</button></div> : null}
      <It icon="logout" title="Прекъсни връзката" sub="изход от ChatGPT акаунта в програмата" onClick={rgSignOut} />
    </>}
    <div className="info pop-info">{RG_LIMITS}</div>
  </>;
}

// „Усилие ›“: Real GPT only. „Стандартно“ sends nothing; an effort the model does not take is dropped by MAIN (with a note).
export function EffortItems({ S, set, rgOn, close }) {
  if (!rgOn) return <It icon="bulb" title="Усилие" sub="само за Real GPT – сървърът на Тед избира сам колко да мисли" disabled />;
  return <>
    <It em="⚖️" title="Стандартно" sub="както реши моделът – нищо не се изпраща" check={!S.rgEffort} onClick={() => { set("rgEffort", ""); close(); }} />
    {EFFORTS.map((e) => <It key={e.id} em={e.id === "none" ? "⚡" : e.id === "xhigh" ? "🧠" : "💭"} title={e.name} sub={e.id === "none" ? "без размисъл, най-бързо (Instant)" : "размисъл: " + e.name.toLowerCase() + " (Thinking)"} check={S.rgEffort === e.id} onClick={() => { set("rgEffort", e.id); close(); }} />)}
  </>;
}

// The composer pill „<модел> · <усилие> ▾“ (ChatGPT „5.6 Terra Medium ▾“).
export function EffortPill({ label, effort, onClick, open }) {
  return (
    <button className="cpill effort-pill" data-testid="effort-pill" onClick={onClick} aria-haspopup="menu" aria-expanded={!!open} title="Модел и усилие (Разширени)">
      <span><b>{label}</b>{effort ? " · " + effort : ""}</span><Icon n="chev" cls="sm14" />
    </button>
  );
}

// „Разширени ▾“: Модел › and Усилие ›, opened in place with „Назад“ (works the same on the phone sheet).
export function AdvancedPop({ pop, onClose, sub, setSub, m, rgOn, modelLabel }) {
  const back = <It icon="chevL" title="Назад" onClick={() => setSub(null)} />;
  return (
    <Pop pop={pop} onClose={onClose} width={360} align="right">
      {sub === "model" ? <>{back}<div className="sep" /><ModelItems m={m} close={onClose} /></>
        : sub === "effort" ? <>{back}<div className="hd">Усилие<small>колко да мисли моделът</small></div><EffortItems S={m.S} set={m.set} rgOn={rgOn} close={onClose} /></>
          : <>
            <div className="hd">Разширени</div>
            <It icon="bot" title="Модел" sub={modelLabel} right={<Icon n="chevR" />} onClick={() => setSub("model")} />
            <It icon="bulb" title="Усилие" sub={rgOn ? effortName(m.S.rgEffort) : "само за Real GPT"} right={<Icon n="chevR" />} onClick={() => setSub("effort")} />
          </>}
    </Pop>
  );
}
