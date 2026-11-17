import React, { useId, useState } from "react";
import Icon from "./Icon.jsx";
import { Modal } from "./ui.jsx";
import { ExtLink } from "./Md.jsx";
import { ted } from "../bridge.js";
import { CRM_URL, PANEL_TEXT, SKILLS } from "../lib/consts.js";
import { actionsSummary, recipientText } from "../lib/chat.js";
import { fmtEUR } from "../lib/format.js";

export const openCrm = () => Promise.resolve(ted.app.openExternal(CRM_URL)).catch(() => {});

// What Ted on the server did for this answer, as ONE collapsed line like ChatGPT's activity („Тед изпълни 3 действия ·
// 1 неуспешно ›“); a click shows every action with the status the server returned. Nothing is animated or invented.
export function ActionsCard({ actions }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const sum = actionsSummary(actions);
  const bad = actions.filter((a) => !a.ok).length;
  const n = actions.length;
  const line = (n - bad ? "Тед изпълни " + (n - bad) + (n - bad === 1 ? " действие" : " действия") : "Нищо не е изпълнено")
    + (bad ? " · " + bad + (bad === 1 ? " неуспешно" : " неуспешни") : "");
  return (
    <div className={"act done srv" + (open ? " open" : "") + (bad ? " warn" : "")} data-testid="actions-card" data-state="done">
      <button className="act-line" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={open ? bodyId : undefined}
        data-testid="activity-line" title={open ? "Скрий действията" : "Покажи всички действия"}>
        <span className={"act-ic ai-" + (bad ? "info" : "check")} aria-hidden="true"><Icon n={bad ? "info" : "check"} /></span>
        <span className="act-t" data-testid="activity-text">{line}</span>
        {sum.changed ? <span className="act-tag">промени в CRM</span> : null}
        <Icon n="chevR" cls="act-chev" />
      </button>
      {open ? (
        <div className="act-body" id={bodyId} data-testid="activity-body">
          <div className="run-h">
            <span className={"status st-" + sum.status}>{sum.label}</span>
            <b className="run-t">Действия на Тед</b>
            {sum.changed ? <span className="ribbon">промени в CRM</span> : null}
          </div>
          <ul className="steps">
            {actions.map((a, i) => (
              <li key={i} data-ok={a.ok ? "1" : "0"}>
                <span className={"dot d-" + (a.ok ? "succeeded" : "failed")}><Icon n={a.ok ? "check" : "x"} /></span>
                <span>{a.label}<small>{a.kind === "tool" && a.tool !== a.label ? a.tool + " · " : ""}{a.ok ? (a.mutating ? "изпълнено · променя данни" : "изпълнено") : "неуспешно"}</small></span>
              </li>
            ))}
          </ul>
          <div className="verify"><Icon n="shield" /><span>Статусите са върнати от сървъра на Тед.</span></div>
        </div>
      ) : null}
    </div>
  );
}

const sizeKb = (kb) => (kb >= 1024 ? (kb / 1024).toFixed(1).replace(".", ",") + " MB" : kb + " KB");

// Prepared e-mail (server tool email.preview). Sending always goes through the native confirmation in MAIN.
export function EmailCard({ m, block, busy, onSend, onEdit }) {
  const e = m.email;
  const files = Array.isArray(e.attachments) ? e.attachments : [];
  const state = m.emailState;
  return (
    <div className="card mailc" data-testid="email-card">
      <h4><Icon n="mail" />Имейл · чернова</h4>
      <dl className="kv">
        <dt>До</dt><dd>{recipientText(e.to)}</dd>
        <dt>Тема</dt><dd>{e.subject || "(без тема)"}</dd>
        {e.property && e.property.code ? <><dt>Имот</dt><dd>{e.property.code}{e.property.title ? " – " + e.property.title : ""}</dd></> : null}
      </dl>
      <div className="formula mail-body">{e.body || ""}</div>
      {files.length ? (
        <div className="mail-files">{files.map((a, i) => {
          const label = "📄 " + (a.name || "файл") + (a.pages ? " · " + a.pages + " стр." : "") + (a.size_kb ? " · " + sizeKb(a.size_kb) : "");
          return /^https:\/\//i.test(a.download_url || "") ? <ExtLink key={i} href={a.download_url}>{label}</ExtLink> : <span key={i}>{label}</span>;
        })}</div>
      ) : null}
      <div className="note">
        {e.can_send
          ? <>Изпраща се от <b>{e.from || ""}</b>{e.sender === "agency" && e.reply_to ? " · отговорите идват на " + e.reply_to : ""}</>
          : <>Няма поща за изпращане. Настройва се веднъж в „Моята поща“ в CRM на сайта. <button className="lnk" onClick={openCrm}>Отвори CRM</button></>}
      </div>
      {state === "sent" ? (
        <div className="verify"><Icon n="check" /><span><b>Изпратено.</b> Резултатът от сървъра е в следващото съобщение.</span></div>
      ) : (
        <>
          <div className="acts">
            <button className="b wine" disabled={!!block || busy} onClick={onSend}>{busy ? <i className="spin" /> : null}✅ Да, изпрати</button>
            <button className="b" disabled={busy} onClick={onEdit}>✏️ Промени</button>
          </div>
          {busy ? <div className="note">Потвърдете изпращането в прозореца на програмата…</div>
            : block ? <div className="note" data-testid="email-block">{block}</div>
              : <div className="note">Преди изпращане програмата ще поиска потвърждение. Изпраща се последната чернова, запазена на сървъра.</div>}
        </>
      )}
    </div>
  );
}

// The CRM skills of the website (0.1.5, owner: „ChatGPT може да ги прави, така че и той трябва да може“): what this
// program does itself and what truly needs the website, with the reason. Nothing is shown as started or done here.
export const SKILL_HERE = {
  upload: { here: true, start: "Качи имота тук", text: "Тед качва имота и тук: опишете го (сделка, вид, цена, площ, град, адрес) и прикачете снимките. Тед пита за липсващото, пише описанието, показва резюме и записва имота като чернова – после снимките в галерията му. Всеки запис е след вашето „Разреши“ (Real GPT с разрешени инструменти; Тед на сървъра също може да създаде имота)." },
  video: { here: true, start: "Направи видеото тук", rgStart: "Подготви заявка за ChatGPT", text: "AI видеото на имот се прави и тук: „+ → Още → Видео на имот“ (с Тед на сървъра – карта с двигател, дължина и цена преди старт). С Real GPT видеото се прави в приложението ChatGPT с вашия план." ,
    rgText: "С Real GPT видеото се прави в приложението ChatGPT с вашия план (Sora): Тед подготвя заявката, а вие я отваряте в ChatGPT с един клик. AI видеото на сървъра на Тед (друг AI) не се ползва с Real GPT." },
  collect: { here: true, start: "Потърси обяви тук", crm: "Отвори „Събрани“ в CRM", why: "записът в „Събрани“ е само в сайта", text: "Тед търси обяви от собственици тук (интернет от вашия компютър) и ги показва в отговора с линк, цена и телефон. Само записът им в „Събрани“ остава в CRM на сайта, защото там сайтът ги разпознава с друг AI." },
  mail: { here: false, text: "„Моята поща“ се настройва веднъж в CRM на сайта – там се въвежда паролата на пощата, а тази програма не пази пароли за поща. След това Тед изпраща имейлите от вашата поща и оттук (с карта и потвърждение)." },
};

// A skill panel the server engine asked for (ui.panel). The program does the skill itself where it can (buttons) and
// opens the website only for what needs it, saying why.
export function PanelCard({ panel, video, onUpload, onVideo, onCollect, rgOn }) {
  const id = video && !panel ? "video" : panel;
  const name = PANEL_TEXT[id] || "Това умение";
  const info = SKILL_HERE[id] || null;
  const go = id === "upload" ? onUpload : id === "video" ? onVideo : id === "collect" ? onCollect : null;
  const here = !!(info && info.here && go);
  return (
    <div className="card" data-testid="panel-card">
      <h4><Icon n={id === "video" ? "video" : id === "upload" ? "upload" : "external"} />{name}</h4>
      <div className="note panel-note">{info ? (rgOn && info.rgText) || info.text : "Това умение работи в CRM на сайта – програмата не показва резултата от него."}</div>
      <div className="acts">
        {here ? <button className="b wine" onClick={go} data-testid="panel-here">{(rgOn && info.rgStart) || info.start}</button> : null}
        <CrmLink info={info} here={here} />
      </div>
    </div>
  );
}

// „Отвори в CRM“ only for what truly needs the website: a full button when the skill is not done here, a small link
// with the reason for the one part that stays on the site (e.g. „Събрани“), nothing otherwise (0.1.5 review).
function CrmLink({ info, here }) {
  if (!here) return <button className="b wine" onClick={openCrm} data-testid="open-crm"><Icon n="external" />Отвори в CRM</button>;
  if (!info || !info.crm) return null;
  return <span className="crm-why"><button className="lnk" onClick={openCrm} data-testid="open-crm">{info.crm}</button> – {info.why}</span>;
}

// Published listings returned by the server (rare for staff). Text only: the program loads no remote images.
export function ListingCards({ items, onAttach }) {
  return (
    <div className="props">{items.slice(0, 12).map((p, i) => (
      <div className="prop" key={p.id || p.code || i}>
        <div className="pb">
          {p.code ? <span className="tag">{p.code}</span> : null}
          <b>{p.title || "Имот"}</b>
          <span className="meta">{[p.city, p.hood, p.area ? p.area + " м²" : "", p.rooms ? p.rooms + " стаи" : ""].filter(Boolean).join(" · ")}</span>
          {Number.isFinite(Number(p.price)) && p.price ? <span className="price">{fmtEUR(Number(p.price))}</span> : null}
          <div className="acts"><button className="b" onClick={() => onAttach(p)}><Icon n="clip" />Прикачи</button></div>
        </div>
      </div>))}
    </div>
  );
}

export function SkillPanel({ id, close, onStart, rgOn }) {
  const s = SKILLS.find((x) => x.id === id) || SKILLS[0];
  const info = SKILL_HERE[s.id] || null;
  const here = !!(info && info.here && onStart);
  return (
    <Modal title={s.em + " " + s.name} onClose={close} size="sm" foot={<><button className="b" onClick={close}>Затвори</button>
      {here ? <button className="b wine" onClick={() => onStart(s.id)} data-testid="skill-here">{(rgOn && info.rgStart) || info.start}</button> : null}
      {here ? null : <CrmLink info={info} here={false} />}</>}>
      <div className="mb">
        <p className="skill-sub">{s.sub}</p>
        <div className="info">{info ? (rgOn && info.rgText) || info.text : "Това умение работи в CRM на сайта."}</div>
        {here && info.crm ? <p className="skill-crm"><CrmLink info={info} here /></p> : null}
      </div>
    </Modal>
  );
}

// One line that is sent with the message so Ted can open the record with his own tools.
export function propRef(p) {
  const bits = [p.code || p.id, p.title, Number(p.price) ? fmtEUR(Number(p.price)) : "", p.city, p.area ? p.area + " м²" : ""].filter(Boolean);
  return "[Имот " + bits.join(" · ") + "]";
}
