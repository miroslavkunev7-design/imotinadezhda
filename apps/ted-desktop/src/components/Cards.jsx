import React from "react";
import Icon from "./Icon.jsx";
import { Modal } from "./ui.jsx";
import { ExtLink } from "./Md.jsx";
import { ted } from "../bridge.js";
import { CRM_URL, PANEL_TEXT, SKILLS } from "../lib/consts.js";
import { actionsSummary, recipientText } from "../lib/chat.js";
import { fmtEUR } from "../lib/format.js";

export const openCrm = () => ted.app.openExternal(CRM_URL);

// What Ted did for this answer. Every status is the one the server returned; nothing is animated.
export function ActionsCard({ actions }) {
  const sum = actionsSummary(actions);
  return (
    <div className="card run" data-testid="actions-card">
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

// Skills that live in the website CRM (upload, collect, mail, video): never shown as started or done here.
export function PanelCard({ panel, video }) {
  const name = PANEL_TEXT[panel] || (video ? PANEL_TEXT.video : "Това умение");
  return (
    <div className="card" data-testid="panel-card">
      <h4><Icon n={video || panel === "video" ? "video" : "external"} />{name}</h4>
      <div className="note panel-note">Това умение работи в CRM на сайта. Тази програма не го стартира и не показва резултата от него{video || panel === "video" ? " – видеото се прави и следи там" : ""}.</div>
      <div className="acts"><button className="b wine" onClick={openCrm}><Icon n="external" />Отвори CRM</button></div>
    </div>
  );
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

export function SkillPanel({ id, close }) {
  const s = SKILLS.find((x) => x.id === id) || SKILLS[0];
  return (
    <Modal title={s.em + " " + s.name} onClose={close} size="sm" foot={<><button className="b" onClick={close}>Затвори</button><button className="b wine" onClick={openCrm}><Icon n="external" />Отвори CRM</button></>}>
      <div className="mb">
        <p className="skill-sub">{s.sub}</p>
        <div className="info"><b>Това умение работи в CRM на сайта.</b> В програмата за Windows то не се стартира. Бутонът отваря CRM в браузъра ви, където влизате със същия акаунт.</div>
      </div>
    </Modal>
  );
}

// One line that is sent with the message so Ted can open the record with his own tools.
export function propRef(p) {
  const bits = [p.code || p.id, p.title, Number(p.price) ? fmtEUR(Number(p.price)) : "", p.city, p.area ? p.area + " м²" : ""].filter(Boolean);
  return "[Имот " + bits.join(" · ") + "]";
}
