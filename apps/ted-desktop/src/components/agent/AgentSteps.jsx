import React, { useEffect, useId, useState } from "react";
import Icon from "../Icon.jsx";
import { STEP_DOT, STEP_TEXT, activitySummary, currentStep, firstStart, fmtDur, stepTime, stepsSummary } from "../../lib/agent.js";

// The activity of a Real GPT answer as in ChatGPT (docs/CONTRACT.md §8.3, §16): while it runs ONE line with the current
// step and the elapsed time (a soft shimmer); when it is done ONE collapsed line that counts the real steps
// („Претърси интернет 6 пъти и прочете 4 страници · 1 неуспешна · 1 мин 26 с ›“). A click opens the full list of
// steps with their real statuses and closes it again. Approval cards and errors are NOT inside this line – the shell
// shows them under it, always visible. After the answer a step still in "run" was cut off and is shown as such.
// Props: steps, live (the answer still runs), since (ms: when the answer started), writing (text is streaming).
export function useTicker(on, ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [on, ms]);
  return now;
}

const cleanSteps = (steps) => (Array.isArray(steps) ? steps : []).filter((s) => s && typeof s === "object" && s.id != null)
  .map((s) => ({ ...s, label: String(s.label || "Стъпка"), tool: typeof s.tool === "string" ? s.tool : "", detail: typeof s.detail === "string" ? s.detail : "" }));

export default function AgentSteps({ steps, live, since, writing }) {
  // Steps come live from MAIN or back from a saved chat: anything malformed is skipped, labels are text only.
  const list = cleanSteps(steps);
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const now = useTicker(!!live);
  if (!list.length && !live) return null;
  const sum = stepsSummary(list, !!live);
  const act = activitySummary(list, !!live);
  const cur = live ? currentStep(list) : null;
  const t0 = Number(since) > 0 ? Number(since) : firstStart(list);
  const time = live ? (t0 ? fmtDur(now - t0) : "") : act.ms != null ? fmtDur(act.ms) : "";
  const line = live
    ? cur ? (cur.status === "wait" ? "Чака вашето решение: " + cur.label : cur.label) : writing ? "Пиша отговора…" : "Мисля…"
    : act.text || "Готово";
  const icon = live ? null : act.failed || act.cut ? "info" : act.denied && !act.done ? "x" : "check";
  const maybe = list.some((s) => s.status === "fail" && /може да е изпълнено/.test(s.detail || ""));
  return (
    <div className={"act" + (live ? " live" : " done") + (open ? " open" : "") + (!live && (act.failed || act.cut) ? " warn" : "")}
      data-testid="agent-steps" data-state={live ? "running" : "done"}>
      <button className="act-line" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={list.length ? open : undefined}
        aria-controls={open ? bodyId : undefined} disabled={!list.length} data-testid="activity-line"
        title={list.length ? (open ? "Скрий стъпките" : "Покажи всички стъпки") : undefined}>
        <span className={"act-ic" + (icon ? " ai-" + icon : "")} aria-hidden="true">{live ? <i className="act-orb" /> : <Icon n={icon} />}</span>
        {/* Done: the counted head may be cut with „…“ on a narrow window, the honest tail („1 неуспешна“) never (review). */}
        {live || !act.tail.length
          ? <span className={"act-t" + (live ? " shimmer" : "")} data-testid="activity-text">{line}</span>
          : <span className="act-t split" data-testid="activity-text"><span className="act-h">{act.head}</span><span className="act-tail">{(act.head ? " · " : "") + act.tail.join(" · ")}</span></span>}
        {!live && act.changed ? <span className="act-tag">промени в CRM</span> : null}
        {time ? <span className="act-time" data-testid="activity-time">{time}</span> : null}
        {list.length ? <Icon n="chevR" cls="act-chev" /> : null}
      </button>
      {open && list.length ? (
        <div className="act-body" id={bodyId} data-testid="activity-body">
          <div className="run-h">
            <span className={"status st-" + sum.status} data-testid="steps-status">{sum.label}</span>
            <b className="run-t">Изпълнение · {list.length} {list.length === 1 ? "стъпка" : "стъпки"}</b>
            {sum.changed ? <span className="ribbon">промени в CRM</span> : null}
          </div>
          <ul className="steps">
            {list.map((st) => {
              const cutOff = !live && st.status === "run";
              const dot = cutOff ? "cancelled" : STEP_DOT[st.status] || "queued";
              const meta = [
                st.tool && !st.label.includes(st.tool) ? st.tool : "",
                cutOff ? "прекъснато – проверете резултата" : STEP_TEXT[st.status] || st.status,
                st.mutating && st.status === "ok" ? "променя данни" : "",
                st.detail && st.detail !== STEP_TEXT[st.status] ? st.detail : "",
                stepTime(st),
              ].filter(Boolean);
              return (
                <li key={st.id} data-status={st.status} data-kind={st.kind || ""}>
                  <span className={"dot d-" + dot}>
                    {st.status === "run" && live ? <i className="spin" /> : <Icon n={st.status === "ok" ? "check" : st.status === "wait" ? "clock" : cutOff ? "info" : "x"} />}
                  </span>
                  <span className="ag-st">{st.label}<small>{meta.join(" · ")}</small></span>
                </li>
              );
            })}
          </ul>
          <div className="verify"><Icon n="shield" /><span>Статусите идват от реалните резултати на инструментите. Промени и записи в CRM и имейл винаги минават през вашето потвърждение.</span></div>
        </div>
      ) : null}
      {/* Never folded away: an action that may have run although it failed. */}
      {maybe ? <div className="note act-note" role="note" data-testid="maybe-step">Някое действие може да е изпълнено въпреки грешката – проверете в CRM, преди да опитате отново.</div> : null}
    </div>
  );
}

// The same line for an answer without tools (text only): „Мисля…“ with the elapsed time until the first words come.
export function ThinkingLine({ since }) {
  const now = useTicker(true);
  const t0 = Number(since) > 0 ? Number(since) : null;
  return (
    <div className="act live think" data-testid="thinking-line">
      <div className="act-line static"><span className="act-ic" aria-hidden="true"><i className="act-orb" /></span>
        <span className="act-t shimmer">Мисля…</span>{t0 ? <span className="act-time">{fmtDur(now - t0)}</span> : null}</div>
    </div>
  );
}
