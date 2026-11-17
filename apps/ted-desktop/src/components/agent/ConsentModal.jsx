import React from "react";
import Icon from "../Icon.jsx";
import { Modal } from "../ui.jsx";

// The one question before Real GPT may use Ted's hands (docs/CONTRACT.md §8.2, §9.6): asked once per ChatGPT account,
// stored by MAIN (never in settings). onDecide("all" | "text"); closing the dialog = onDecide(null), nothing is sent.
export const CONSENT_TEXT = "Real GPT ползва само вашия ChatGPT план. Тед дава достъп до CRM, интернет и файловете на този компютър; друг изкуствен интелект не се ползва.";

export default function ConsentModal({ account, onDecide }) {
  const pick = (c) => { if (typeof onDecide === "function") onDecide(c); };
  return (
    <Modal title="Real GPT и инструментите на Тед" onClose={() => pick(null)} size="sm"
      foot={<><button className="b" onClick={() => pick("text")}>Само текст</button><button className="b wine" onClick={() => pick("all")}>Разбирам</button></>}>
      <div className="mb consent" data-testid="consent-modal">
        <p className="p0 consent-q">{CONSENT_TEXT}</p>
        {account ? <p className="consent-acc"><Icon n="user" cls="sm16" />{account}</p> : null}
        <ul className="consent-ul">
          <li><Icon n="globe" />Търси и чете страници в интернет от този компютър – без пароли, бисквитки и данни от CRM.</li>
          <li><Icon n="doc" />Вижда прикачените снимки и PDF, чете Word и Excel и прави документи на този компютър; файловете се пазят в Библиотеката.</li>
          <li><Icon n="home" />Чете CRM „Имоти Надежда“ с вашите права; промени, записи и имейл в CRM винаги искат вашето потвърждение.</li>
          <li><Icon n="image" />Снимки и видео се правят в приложението ChatGPT с вашия план – Тед подготвя заявката, вие я отваряте.</li>
        </ul>
        <div className="info">Мисленето, анализът и преводът са на вашия ChatGPT (OpenAI); Gemini, Тед на сървъра и AI видео не се ползват в Real GPT. Единственото изключение е гласът: „Чуй“, диктовката и гласовият режим са на сървъра на Тед (Google Gemini) – тръгват само когато ги пуснете и програмата пита първо. „Само текст“ = отговори без CRM, интернет и файлове. Изборът важи за този ChatGPT акаунт и се променя от Настройки → Безопасност.</div>
      </div>
    </Modal>
  );
}
