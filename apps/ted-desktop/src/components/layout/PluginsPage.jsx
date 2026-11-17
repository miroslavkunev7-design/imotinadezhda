import React from "react";
import Icon from "../Icon.jsx";
import { Sw } from "../ui.jsx";
import { openCrm } from "../Cards.jsx";
import { BROWSE_DEF } from "../../lib/consts.js";
import { fmtDate } from "../../lib/format.js";

// The real connections of the program (ChatGPT „Plugins“). Every status comes from a real request or setting;
// „Свържи/Прекъсни“ only where the program can really connect or disconnect.
// pl = {user, conn, checkConn, rg, consent, openRealGpt, rgSignOut, S, patch, cal, checkCal, openBrowser}
const browseOf = (S) => ({ ...BROWSE_DEF, ...(S.browse && typeof S.browse === "object" ? S.browse : {}) });

export function pluginRows(pl) {
  const b = browseOf(pl.S);
  const login = pl.user.email || pl.user.phoneMasked || "";
  return [
    { id: "crm", icon: "home", name: "CRM „Имоти Надежда“", desc: "Клиенти, имоти, документи и действия според правата ви" + (login ? " · " + login : ""),
      st: pl.conn === "ok" ? "st-succeeded" : pl.conn === "off" ? "st-failed" : "st-queued", status: pl.conn === "ok" ? "Свързано" : pl.conn === "off" ? "Няма връзка" : "Проверява се" },
    { id: "chatgpt", icon: "link", name: "ChatGPT план (Real GPT)", desc: pl.rg.connected ? (pl.rg.email || "ChatGPT акаунт") + (pl.rg.planEnabled === false ? " · планът не е разрешен" : " · отговаря през вашия план") : "Отговори през вашия платен ChatGPT план",
      st: pl.rg.connected && pl.rg.planEnabled !== false ? "st-succeeded" : "st-queued", status: pl.rg.connected ? (pl.rg.planEnabled === false ? "Не е разрешен" : "Свързан") : "Не е свързан",
      ...(pl.rg.connected ? {} : { action: { label: "Свържи", fn: pl.openRealGpt } }) },
    { id: "web", icon: "globe", name: "Интернет", desc: "Търсене и четене на страници от този компютър (Real GPT); Тед (сървър) търси през сървъра",
      st: b.enabled ? "st-succeeded" : "st-cancelled", status: b.enabled ? "Включен" : "Изключен" },
    { id: "mail", icon: "mail", name: "Имейл през CRM", desc: "Изпраща от „Моята поща“ в CRM – винаги след потвърждение", st: "st-queued", status: "в CRM",
      action: { label: "Отвори CRM", fn: openCrm } },
    { id: "cal", icon: "calendar", name: "Календар през CRM", desc: pl.cal.status === "ok" ? pl.cal.text : "Огледи и срещи от календара в CRM",
      st: pl.cal.status === "ok" ? "st-succeeded" : pl.cal.status === "error" ? "st-failed" : "st-queued", status: pl.cal.status === "ok" ? "Свързан" : pl.cal.status === "error" ? "Грешка" : pl.cal.status === "loading" ? "Проверява се" : "Непроверен" },
  ];
}

export function PluginList({ pl }) {
  const b = browseOf(pl.S);
  const consentTxt = pl.consent === "all" ? "инструментите на Тед са разрешени" : pl.consent === "text" ? "само текст" : "инструментите още не са разрешени";
  return <>
    <div className="conn" data-plugin="crm"><span className="ci"><Icon n="home" /></span><div className="tx"><b>CRM „Имоти Надежда“</b><small>{pl.user.name ? pl.user.name + " · " : ""}{pl.user.email || pl.user.phoneMasked || "—"}</small></div>
      <span className={"status " + (pl.conn === "ok" ? "st-succeeded" : pl.conn === "off" ? "st-failed" : "st-queued")}>{pl.conn === "ok" ? "Свързано" : pl.conn === "off" ? "Няма връзка" : "Проверява се"}</span>
      <button className="b" onClick={pl.checkConn}><Icon n="refresh" />Проверка</button></div>
    <div className="conn" data-plugin="chatgpt"><span className="ci"><Icon n="link" /></span><div className="tx"><b>ChatGPT план (Real GPT)</b><small>{pl.rg.connected ? (pl.rg.email || "ChatGPT акаунт") + (pl.rg.planEnabled === false ? " · планът не е разрешен" : " · планът е разрешен") + (consentTxt ? " · " + consentTxt : "") : "Вашият платен ChatGPT план · не е свързан"}</small></div>
      {pl.rg.connected ? <button className="b" onClick={pl.rgSignOut}>Прекъсни</button> : <button className="b wine" onClick={pl.openRealGpt}>Свържи</button>}</div>
    <div className="conn" data-plugin="web"><span className="ci"><Icon n="globe" /></span><div className="tx"><b>Интернет</b><small>Real GPT търси (DuckDuckGo) и чете страници от този компютър, без пароли и бисквитки. Тед (сървър) търси през сървъра.{b.blocked.length ? " · блокирани сайтове: " + b.blocked.length : ""}</small></div>
      <Sw id="sw-browse-pl" on={b.enabled} set={(v) => pl.patch({ browse: { ...b, enabled: v } })} />
      <button className="b" onClick={pl.openBrowser}>Настройки</button></div>
    <div className="conn" data-plugin="mail"><span className="ci"><Icon n="mail" /></span><div className="tx"><b>Имейл през CRM</b><small>Пощата се настройва в CRM („Моята поща“). Тед изпраща само след вашето потвърждение в прозорец на Windows.</small></div>
      <button className="b" onClick={openCrm}><Icon n="external" />Отвори CRM</button></div>
    <div className="conn" data-plugin="cal"><span className="ci"><Icon n="calendar" /></span><div className="tx"><b>Календар през CRM</b><small>{pl.cal.status === "ok" ? pl.cal.text + (pl.cal.at ? " · проверено " + fmtDate(pl.cal.at) : "") : pl.cal.status === "error" ? "⚠️ " + pl.cal.error : pl.cal.status === "loading" ? "Проверявам…" : "Огледи и срещи от календара в CRM – само за четене тук"}</small></div>
      <button className="b" onClick={pl.checkCal} disabled={pl.cal.status === "loading"}><Icon n="refresh" />Провери</button></div>
    <div className="info">Тук са само истинските връзки на програмата. Магазин за GPTs, Sites и Codex няма – ролите на Тед са в „Агенти“.</div>
  </>;
}

export default function PluginsPage({ pl }) {
  return (
    <div className="page"><div className="page-in" data-testid="plugins-page">
      <div className="page-h"><h1>Плъгини</h1><p>Услугите, с които работи Тед, и истинското им състояние.</p></div>
      <div className="sheet"><PluginList pl={pl} /></div>
    </div></div>
  );
}
