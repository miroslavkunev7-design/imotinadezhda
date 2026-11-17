import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { Modal } from "./ui.jsx";
import { ted } from "../bridge.js";
import { RG_LIMITS } from "../lib/consts.js";

// "Sign in with ChatGPT": the sign-in itself happens in the system browser; MAIN waits for the
// callback. This dialog only starts it, waits, and shows the real result.
export default function RealGptConnect({ close, rg, onStatus, onSignOut }) {
  const [step, setStep] = useState(rg.connected ? "done" : "intro");
  const [error, setError] = useState("");
  const waiting = useRef(false);

  useEffect(() => () => { if (waiting.current) ted.realgpt.cancelSignIn(); }, []);

  async function signIn() {
    setStep("wait"); setError(""); waiting.current = true;
    let r;
    try { r = await ted.realgpt.signIn(); } catch { r = { ok: false, error: "Входът с ChatGPT не успя.", code: "internal" }; }
    waiting.current = false;
    if (r && r.ok) { onStatus(r.status || { connected: true }); setStep("done"); return; }
    setError(r && r.code === "cancelled" ? "" : (r && r.error) || "Входът с ChatGPT не успя.");
    setStep("intro");
  }
  const cancel = () => { ted.realgpt.cancelSignIn(); };

  const title = step === "wait" ? "Real GPT · вход в браузъра" : step === "done" ? "Real GPT · свързан" : "Real GPT";
  const foot = step === "intro" ? <><button className="b" onClick={close}>Отказ</button><button className="b wine" onClick={signIn}><Icon n="external" />Вход с ChatGPT</button></>
    : step === "wait" ? <button className="b" onClick={cancel}>Отказ</button>
      : <><button className="b" onClick={onSignOut}>Прекъсни връзката</button><button className="b wine" onClick={close}>Готово</button></>;
  return (
    <Modal title={title} onClose={close} size="sm" foot={foot}>
      <div className="mb">
        {step === "intro" && <>
          <p className="p0">Използвайте платения си ChatGPT абонамент в Тед. Входът става на страницата на OpenAI в браузъра ви. Тед не вижда паролата ви.</p>
          {error ? <div className="err" role="alert">⚠️ {error}</div> : null}
          <div className="mem"><Icon n="check" /><div className="tx"><b>Какво получава Тед</b><small>име, имейл и право да ползва плана ви за отговори</small></div></div>
          <div className="mem"><Icon n="lock" /><div className="tx"><b>Какво НЕ получава</b><small>историята, паметта, файловете и GPT-тата ви в ChatGPT</small></div></div>
          <div className="mem"><Icon n="info" /><div className="tx"><b>Само разговор</b><small>Real GPT не вижда и не променя CRM, казусите и паметта на Тед. Каквото напишете или прикачите, се изпраща към OpenAI през вашия акаунт.</small></div></div>
          <div className="mem"><Icon n="shield" /><div className="tx"><b>Лимит</b><small>отговорите се броят от лимита на абонамента ви; при изчерпване спират</small></div></div>
          <div className="info">{RG_LIMITS} Входът с ChatGPT за външни програми е в предварителна версия на OpenAI и може да се промени.</div>
        </>}
        {step === "wait" && <div className="rg-wait"><i className="spin" /><div><b>Чакаме входа в браузъра…</b><div className="meta">Страницата за вход на OpenAI е отворена в браузъра ви. Програмата чака до 5 минути.</div></div></div>}
        {step === "done" && <>
          <div className="verify"><Icon n="check" /><span><b>Real GPT е свързан.</b> {rg.planEnabled === false ? "Използването на ChatGPT плана НЕ е разрешено – влезте отново и го разрешете, за да получавате отговори." : "Отговорите се броят от лимита на вашия план."}</span></div>
          <dl className="kv rg-kv"><dt>Акаунт</dt><dd>{rg.email || "—"}</dd><dt>План</dt><dd>{rg.planEnabled === false ? "не е разрешен" : "разрешен"}</dd><dt>Модели</dt><dd>от вашия акаунт – избират се от менюто „Модел“</dd></dl>
          <div className="info">{RG_LIMITS}</div>
        </>}
      </div>
    </Modal>
  );
}
