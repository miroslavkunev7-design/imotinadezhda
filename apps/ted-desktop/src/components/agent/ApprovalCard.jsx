import React, { useState } from "react";
import Icon from "../Icon.jsx";
import VideoChoice, { initialChoice } from "./VideoChoice.jsx";

const TITLES = { crm_write: "Промяна в CRM", confirm: "Важна промяна в CRM", video: "Платено AI видео", web: "Адрес в интернет" };
const KINDS = new Set(["confirm", "video", "web"]);

// An approval the Real GPT agent waits for (docs/CONTRACT.md §8.3, §9.3). The model can never answer it: only
// these buttons do. decision = "allow" | "deny" | "allow_all" | "allow_host"; options (video only) = {engine, duration}.
// "allow_all" covers only the remaining CRM writes (kind crm_write) or web addresses (kind web) of THIS answer – never
// confirm-class tools, e-mail or video. "allow_host" (kind web with `allowHost`, MAIN names the site in `host`) = that
// site until the end of the chat. A „strict“ web card (personal data in the address / query: `allowAll:false`, no
// `allowHost`/`host`, CONTRACT §9.3 rule 8) shows only „Разреши“ and „Откажи“. `json` = the exact input that will be
// sent, behind „Точните данни“.
export default function ApprovalCard({ approval, onDecide, busy }) {
  const ap = approval || {};
  const kind = KINDS.has(ap.kind) ? ap.kind : "crm_write";
  const v = ap.video || {};
  const [choice, setChoice] = useState(() => initialChoice(v.engines, v.defaults));
  const lines = Array.isArray(ap.lines) ? ap.lines.filter((l) => Array.isArray(l) && l.length >= 2) : [];
  const decide = (d, opt) => { if (!busy && typeof onDecide === "function") onDecide(d, opt); };
  const engines = Array.isArray(v.engines) ? v.engines : [];
  const strict = kind === "web" && !ap.allowAll && !(ap.allowHost && ap.host);

  return (
    <div className={"card approval ap-" + kind} data-testid="approval-card" data-kind={kind} {...(strict ? { "data-strict": "1" } : {})} role="group" aria-label={ap.title || TITLES[kind]}>
      <h4><Icon n={kind === "video" ? "film" : kind === "web" ? "globe" : "shield"} />{ap.title || TITLES[kind]}{ap.tool ? <span className="ap-tool">{ap.tool}</span> : null}</h4>
      {lines.length ? <dl className="kv ap-kv">{lines.map(([k, val], i) => <React.Fragment key={i}><dt>{String(k)}</dt><dd>{String(val)}</dd></React.Fragment>)}</dl> : null}
      {typeof ap.json === "string" && ap.json ? (
        <details className="ap-json" data-testid="approval-json"><summary>Точните данни, които ще се изпратят</summary><pre>{ap.json}</pre></details>
      ) : null}
      {kind === "video" ? (engines.length
        ? <VideoChoice engines={engines} gateway={v.gateway} parts={v.parts} aspect={v.aspect} value={choice} onChange={setChoice} disabled={busy} idp={"ap-" + String(ap.id || "").slice(-8)} />
        : <div className="err">⚠️ На сървъра няма настроен ключ за AI видео – видео не може да се направи.</div>) : null}
      <div className="acts">
        {kind === "video" ? (
          <button className="b wine" disabled={busy || !engines.length} onClick={() => decide("allow", { engine: choice.engine, duration: choice.duration })}>{busy ? <i className="spin" /> : <Icon n="play" />}Започни (платено)</button>
        ) : (
          <button className="b wine" disabled={busy} onClick={() => decide("allow")}>{busy ? <i className="spin" /> : <Icon n="check" />}Разреши</button>
        )}
        {kind === "web" && ap.allowHost && ap.host ? <button className="b" data-testid="ap-allow-host" disabled={busy} title={"Без нови въпроси за " + String(ap.host) + " до края на този чат"} onClick={() => decide("allow_host")}>Разреши за този сайт</button> : null}
        {(kind === "crm_write" || kind === "web") && ap.allowAll ? <button className="b" data-testid="ap-allow-all" disabled={busy} onClick={() => decide("allow_all")}>{kind === "web" ? "Разреши всички адреси до края на отговора" : "Разреши всички в този отговор"}</button> : null}
        <button className="b" disabled={busy} onClick={() => decide("deny")}><Icon n="x" />Откажи</button>
      </div>
      <div className="note">
        {kind === "confirm" ? "След „Разреши“ Windows ще покаже още едно потвърждение с точното действие. "
          : kind === "video" ? "Започва се само с този бутон. Вече започнати части на сървъра може да се таксуват и при спиране. "
            : kind === "web" ? (strict ? "Нищо не е изпратено. В адреса или търсенето има лични данни, които не сте написали вие – проверете ги. "
              : "Нищо не е изпратено. Адресът е съставен от ChatGPT, а в чата има данни от CRM или файлове – проверете го. ")
              : "Чака вашето решение – нищо не е променено. "}
        Без отговор до 10 минути = отказ.
      </div>
    </div>
  );
}
