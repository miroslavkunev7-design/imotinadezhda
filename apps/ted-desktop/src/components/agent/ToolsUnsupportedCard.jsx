import React from "react";
import Icon from "../Icon.jsx";

// The ChatGPT plan route refused Ted's tools even after the corrected resend (code "tools_unsupported",
// docs/CONTRACT.md §8.2). Never silent: the employee chooses Ted's server engine or a text-only answer.
export default function ToolsUnsupportedCard({ onServer, onTextOnly }) {
  return (
    <div className="card tools-no" data-testid="tools-unsupported" role="group" aria-label="Инструментите не се приеха">
      <h4><Icon n="plug" />Планът на ChatGPT не прие инструментите на Тед</h4>
      <p className="p0">Real GPT не можа да ползва CRM, интернет и файловете в този отговор – OpenAI отказа заявката с инструменти. Нищо не е изпълнено и нищо не е превключено без вас.</p>
      <div className="acts">
        <button className="b wine" onClick={onServer}><Icon n="refresh" />Отговори с Тед (сървъра)</button>
        <button className="b" onClick={onTextOnly}><Icon n="chat" />Само текст</button>
      </div>
      <div className="note">„Отговори с Тед (сървъра)“ изпраща същия въпрос към Тед на imotinadezhda.bg (със същите инструменти и правила като в сайта) и отговорът се отбелязва така. „Само текст“ = Real GPT без CRM, интернет и файлове; инструментите се връщат от Настройки → Безопасност.</div>
    </div>
  );
}
