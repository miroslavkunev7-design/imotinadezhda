import React from "react";
import Icon from "../Icon.jsx";

// The ChatGPT plan route refused Ted's tools even after the corrected resend (code "tools_unsupported",
// docs/CONTRACT.md §8.2, §9.6). Never silent and never another engine: the employee sees what OpenAI refused and may
// send the same question again without tools („Само текст“, this answer only).
export default function ToolsUnsupportedCard({ refused, onTextOnly }) {
  const r = refused && typeof refused === "object" ? refused : null;
  const what = r ? [r.param ? "параметър „" + String(r.param).slice(0, 80) + "“" : "", r.code ? "код " + String(r.code).slice(0, 80) : "", r.status ? "HTTP " + Number(r.status) : ""].filter(Boolean).join(" · ") : "";
  return (
    <div className="card tools-no" data-testid="tools-unsupported" role="group" aria-label="Инструментите не се приеха">
      <h4><Icon n="plug" />Планът на ChatGPT не прие инструментите на Тед</h4>
      <p className="p0">OpenAI отказа заявката с инструменти (CRM, интернет и файловете на този компютър) за този модел. Нищо не е изпълнено и нищо не е превключено към друг изкуствен интелект.</p>
      {r ? <div className="refused" data-testid="tools-refused">
        <b>Какво отказа OpenAI:</b> {what || "заявката с инструменти"}
        {r.message ? <div className="refused-m">„{String(r.message).slice(0, 300)}“</div> : null}
      </div> : null}
      <div className="acts">
        <button className="b wine" onClick={onTextOnly}><Icon n="chat" />Само текст</button>
      </div>
      <div className="note">„Само текст“ изпраща същия въпрос пак към вашия ChatGPT – този път без CRM, интернет и файлове (само за този отговор). Можете да изберете и друг модел от плана си в менюто „Модел“.</div>
    </div>
  );
}
