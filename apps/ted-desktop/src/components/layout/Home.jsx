import React from "react";
import Icon from "../Icon.jsx";

// Home chips: ChatGPT's three (Създай изображение, Пиши или редактирай, Потърси нещо) + Тед's own (Намери имот,
// Прегледай документи, Прикачи имот) + „Още ▾“ (the six example groups). A chip only fills or arms the composer –
// nothing is sent.
export function HomeChips({ c, phone }) {
  const chips = [
    ["image", "Създай изображение", c.image, "hint-chip"],
    ["pencil", "Пиши или редактирай", c.write, ""],
    ["globe", "Потърси нещо", c.search, "hint-chip"],
    ["home", "Намери имот", c.findProp, ""],
    ["doc", "Прегледай документи", c.docs, ""],
    ["clip", "Прикачи имот", c.attachProp, ""],
  ];
  return (
    <div className={"chips home-chips" + (phone ? " ph" : "")} data-testid="home-chips" aria-label="Предложения">
      {chips.map(([ic, t, fn, cls]) => <button key={t} className={"chip chip-s " + cls} onClick={fn}><Icon n={ic} />{t}</button>)}
      <button className="chip chip-s" onClick={c.more} aria-haspopup="menu"><Icon n="dots" />Още<Icon n="chev" cls="sm14" /></button>
    </div>
  );
}

// Plugin rows under the composer in „Работа“ (ChatGPT Work, ref 01): icon, name, one line, status or „Свържи“.
export function HomePlugins({ rows }) {
  return (
    <div className="home-plugins" data-testid="home-plugins" aria-label="Свързани услуги">
      {rows.map((r) => (
        <div className="hp-row" key={r.id}>
          <span className="hp-ic"><Icon n={r.icon} /></span>
          <b>{r.name}</b>
          <span className="hp-d">{r.desc}</span>
          {r.action ? <button className="lnk hp-a" onClick={r.action.fn}>{r.action.label}</button> : <span className={"status " + r.st}>{r.status}</span>}
        </div>
      ))}
    </div>
  );
}

// Centred greeting (ChatGPT „Hey, Alvin. Ready to dive in?“ / „What would you like to work on?“), the composer in the
// middle (desktop), chips; Работа adds the plugin list. Phone keeps the composer at the bottom (ChatGPT phone app).
export default function Home({ phone, title, sub, caseBanner, sessNote, composer, chips, plugins, disc }) {
  if (phone) return (
    <div className="home ph cg">
      {caseBanner}
      <h1>{title}</h1>
      {sub ? <p className="sub">{sub}</p> : null}
      {sessNote}
    </div>
  );
  return (
    <div className="home cg">
      {caseBanner}
      <h1>{title}</h1>
      {sub ? <p className="sub">{sub}</p> : null}
      {composer}
      {plugins}
      {chips}
      {sessNote}
      {disc ? <div className="home-disc">{disc}</div> : null}
    </div>
  );
}
