import React from "react";
import Icon from "../Icon.jsx";
import { Modal } from "../ui.jsx";

// The one question before Real GPT may use Ted's hands (docs/CONTRACT.md §8.2): asked once per ChatGPT account,
// stored by MAIN (never in settings). onDecide("all" | "text"); closing the dialog = onDecide(null), nothing is sent.
export default function ConsentModal({ account, onDecide }) {
  const pick = (c) => { if (typeof onDecide === "function") onDecide(c); };
  return (
    <Modal title="Real GPT и инструментите на Тед" onClose={() => pick(null)} size="sm"
      foot={<><button className="b" onClick={() => pick("text")}>Само текст</button><button className="b wine" onClick={() => pick("all")}>Разбирам</button></>}>
      <div className="mb consent" data-testid="consent-modal">
        <p className="p0 consent-q">Real GPT ще ползва CRM, интернет и файловете, които прикачите, през вашия ChatGPT акаунт.</p>
        {account ? <p className="consent-acc"><Icon n="user" cls="sm16" />{account}</p> : null}
        <ul className="consent-ul">
          <li><Icon n="globe" />Търси и чете страници в интернет от този компютър – без пароли, бисквитки и данни от CRM.</li>
          <li><Icon n="doc" />Чете прикачените файлове и прави документи, снимки и видео; файловете се пазят в Библиотеката.</li>
          <li><Icon n="home" />Чете CRM „Имоти Надежда“ с вашите права – това, което сървърът на Тед ви позволява.</li>
          <li><Icon n="shield" />Промени в CRM, имейл и платено видео винаги искат вашето потвърждение в програмата.</li>
        </ul>
        <div className="info">Текстът на разговора и прочетеното минават през вашия ChatGPT акаунт (OpenAI). „Само текст“ = отговори без CRM, интернет и четене на файлове. Изборът важи за този ChatGPT акаунт и се променя от Настройки → Безопасност.</div>
      </div>
    </Modal>
  );
}
