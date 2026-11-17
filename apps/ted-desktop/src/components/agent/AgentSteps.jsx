import React, { useState } from "react";
import Icon from "../Icon.jsx";
import { STEP_DOT, STEP_TEXT, stepTime, stepsSummary } from "../../lib/agent.js";

const SHOWN = 5; // a finished answer with many steps shows the first ones and „Покажи всички“

// The „Изпълнение“ card of a Real GPT answer (docs/CONTRACT.md §8.3, §16): plain Bulgarian steps with the real
// status of each tool call. live = the answer is still running (a step in "run" spins); after the answer a step
// still in "run" was cut off and is shown as such – never as done.
export default function AgentSteps({ steps, live }) {
  // Steps come live from MAIN or back from a saved chat: anything malformed is skipped, labels are text only.
  const list = (Array.isArray(steps) ? steps : []).filter((s) => s && typeof s === "object" && s.id != null)
    .map((s) => ({ ...s, label: String(s.label || "Стъпка"), tool: typeof s.tool === "string" ? s.tool : "", detail: typeof s.detail === "string" ? s.detail : "" }));
  const [all, setAll] = useState(false);
  if (!list.length) return null;
  const sum = stepsSummary(list, !!live);
  const cut = !live && !all && list.length > SHOWN + 1;
  const shown = cut ? list.slice(0, SHOWN) : list;
  const maybe = list.some((s) => s.status === "fail" && /може да е изпълнено/.test(s.detail || ""));
  return (
    <div className="card run agent-steps" data-testid="agent-steps">
      <div className="run-h">
        <span className={"status st-" + sum.status} data-testid="steps-status">{sum.label}</span>
        <b className="run-t">Изпълнение</b>
        {sum.changed ? <span className="ribbon">промени в CRM</span> : null}
      </div>
      <ul className="steps">
        {shown.map((st) => {
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
      {cut ? <button className="lnk ag-more" onClick={() => setAll(true)}>Покажи всички ({list.length})</button> : null}
      {maybe ? <div className="note">Някое действие може да е изпълнено въпреки грешката – проверете в CRM, преди да опитате отново.</div> : null}
      <div className="verify"><Icon n="shield" /><span>Статусите идват от реалните резултати на инструментите. Промени в CRM, имейл и платено видео винаги минават през вашето потвърждение.</span></div>
    </div>
  );
}
