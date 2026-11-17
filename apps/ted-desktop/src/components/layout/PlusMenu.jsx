import React, { useRef } from "react";
import Icon from "../Icon.jsx";
import { It, Pop } from "../ui.jsx";
import { HINTS } from "../../lib/consts.js";
import { fmtSize } from "../../lib/format.js";

// The composer „+“ menu in ChatGPT's order: Добави снимки и файлове · Последни файлове › · ── · Създай изображение ·
// Мислене · Задълбочено проучване · Търсене в мрежата · Още › · ── · Проекти ›. Submenus open in place („Назад“).
// Hints are optional: the user can always just type.
export default function PlusMenu({ pop, onClose, phone, sub, setSub, hints, onHint, rgOn, recent, onRecent, a, cases, curCase, onCase }) {
  // ChatGPT keeps the menu on one side of the composer: the side chosen for the root level is reused by every
  // sub-level, and the menu never covers the top bar (Чат | Работа).
  const placed = useRef({ pop: null, side: null });
  if (placed.current.pop !== pop) placed.current = { pop, side: null };
  const topBar = typeof document !== "undefined" ? document.querySelector(".shell .top") : null;
  const minTop = topBar ? Math.round(topBar.getBoundingClientRect().bottom) + 4 : 44;
  const back = <It icon="chevL" title="Назад" onClick={() => setSub(null)} />;
  let body;
  if (sub === "recent") {
    body = <>
      {back}<div className="hd">Последни файлове<small>от Библиотеката на този компютър</small></div>
      {recent.status === "loading" ? <div className="info pop-info"><i className="spin" /> Зареждам…</div> : null}
      {recent.status === "error" ? <div className="info pop-info">{recent.error}</div> : null}
      {recent.status === "ok" && !recent.items.length ? <div className="info pop-info">Още няма файлове. Тук се появяват снимките и документите, които Тед направи или вие прикачите.</div> : null}
      {(recent.items || []).map((f) => <It key={f.id} icon={f.kind === "image" ? "image" : f.kind === "video" ? "film" : "file"} title={f.name} sub={[f.kind, f.size ? fmtSize(f.size) : ""].filter(Boolean).join(" · ")} onClick={() => onRecent(f)} />)}
    </>;
  } else if (sub === "more") {
    body = <>
      {back}<div className="hd">Още</div>
      <It icon="pencil" title="Canvas" sub="празен документ встрани от чата" onClick={a.canvas} />
      <It icon="film" title="Видео на имот" sub="AI разходка от снимките на обявата · платено, с потвърждение" onClick={a.video} />
      <It icon="doc" title="Документи от CRM" sub="прикачва се препратка, не файлът" onClick={a.docs} />
      <It icon="home" title="Имот от CRM" sub="търсене в имотите на агенцията" onClick={a.prop} />
      <It icon="folderPlus" title="Нов проект" sub="казус с памет на сървъра на Тед" onClick={a.newCase} />
      <It icon="bot" title="Умения и роли" sub="ролите на Тед и вградените умения" onClick={a.agents} />
      <It icon="plug" title="Свързани услуги" sub="CRM, ChatGPT план, интернет, имейл, календар" onClick={a.plugins} />
    </>;
  } else if (sub === "projects") {
    body = <>
      {back}<div className="hd">Проекти<small>казуси с памет на сървъра на Тед</small></div>
      <It em="💬" title="Общ разговор" sub="без казус, с дългосрочната памет на Тед" check={!curCase} onClick={() => onCase(null)} />
      {cases.items.map((cs) => <It key={cs.id} icon="folder" title={cs.title} sub={cs.client || undefined} check={!!curCase && curCase.id === cs.id} onClick={() => onCase(cs.id)} />)}
      {cases.status === "error" ? <div className="info pop-info">Казусите не се заредиха: {cases.error}</div> : null}
      <It icon="folderPlus" title="Нов проект…" sub="име и по желание клиент" onClick={a.newCase} />
    </>;
  } else {
    body = <>
      {!phone ? <div className="hd">Добави</div> : null}
      <It icon="clip" title="Добави снимки и файлове" sub={rgOn ? "Real GPT: всякакви документи до 20 MB, до 10 файла" : "снимки и PDF (до 3), Word, Excel и текст"} onClick={a.files} />
      <It icon="file" title="Последни файлове" right={<Icon n="chevR" />} onClick={() => setSub("recent")} />
      <div className="sep" />
      {HINTS.map((h) => <It key={h.id} icon={h.icon} title={h.name} sub={rgOn ? undefined : "добавя се като начало на въпроса"} check={hints.includes(h.id)} onClick={() => onHint(h.id)} />)}
      <It icon="dots" title="Още" right={<Icon n="chevR" />} onClick={() => setSub("more")} />
      <div className="sep" />
      <It icon="folder" title="Проекти" sub={curCase ? "Казус: " + curCase.title : "Общ разговор"} right={<Icon n="chevR" />} onClick={() => setSub("projects")} />
    </>;
  }
  return <Pop key={sub || "root"} pop={pop} onClose={onClose} width={phone ? undefined : 330} minTop={minTop}
    side={placed.current.side || undefined} onPlaced={(s) => { if (!placed.current.side) placed.current.side = s; }}>{body}</Pop>;
}
