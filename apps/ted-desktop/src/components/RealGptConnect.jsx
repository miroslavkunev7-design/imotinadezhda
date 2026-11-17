import React, { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { Modal } from "./ui.jsx";
import { ted } from "../bridge.js";
import { RG_LIMITS, RG_NEW_ACCOUNT_CODES } from "../lib/consts.js";

// "Sign in with ChatGPT": the sign-in itself happens in the system browser; MAIN waits for the
// callback. This dialog only starts it, waits, and shows the real result.
export default function RealGptConnect({ close, rg, onStatus, onSignOut, onManage }) {
  const [step, setStep] = useState(rg.connected ? "done" : "intro");
  const [error, setError] = useState("");
  const [errCode, setErrCode] = useState("");
  const [fresh, setFresh] = useState(false); // true right after a sign-in in this dialog
  const waiting = useRef(false);

  useEffect(() => () => { if (waiting.current) Promise.resolve(ted.realgpt.cancelSignIn()).catch(() => {}); }, []);

  // newAccount: a fresh registration - another ChatGPT account, or the saved one was removed in ChatGPT.
  async function signIn(newAccount) {
    setStep("wait"); setError(""); setErrCode(""); waiting.current = true;
    let r;
    try { r = await ted.realgpt.signIn(newAccount === true ? { newAccount: true } : undefined); } catch { r = { ok: false, error: "Входът с ChatGPT не успя.", code: "internal" }; }
    waiting.current = false;
    if (r && r.ok) { onStatus(r.status || { connected: true }); setFresh(true); setStep("done"); return; }
    setError(r && r.code === "cancelled" ? "" : (r && r.error) || "Входът с ChatGPT не успя.");
    setErrCode((r && r.code) || "");
    setStep(rg.connected ? "done" : "intro");
  }
  // Offered after failures a fresh registration can fix, and always to a connected user.
  const otherAccount = (label) => <p className="p0"><button className="lnk" onClick={() => signIn(true)} data-testid="rg-new-account">{label}</button> – нов вход в браузъра; ще изберете акаунт и ще разрешите достъпа отново.</p>;
  const fixable = RG_NEW_ACCOUNT_CODES.includes(errCode);
  const cancel = () => { Promise.resolve(ted.realgpt.cancelSignIn()).catch(() => {}); };

  const planOff = rg.planEnabled === false;
  const title = step === "wait" ? "Real GPT · вход в браузъра" : step === "done" ? (planOff ? "Real GPT · планът не е разрешен" : "Използвате своя ChatGPT план") : "Real GPT";
  const continueBtn = <button className="b wine" onClick={() => signIn(false)} data-testid="rg-continue"><Icon n="external" />Продължи с ChatGPT</button>;
  const foot = step === "intro" ? <><button className="b" onClick={close}>Отказ</button>{continueBtn}</>
    : step === "wait" ? <button className="b" onClick={cancel}>Отказ</button>
      : <><button className="b" onClick={onSignOut}>Прекъсни връзката</button>{planOff ? continueBtn : <button className="b wine" onClick={close}>{fresh ? "Разбрах" : "Готово"}</button>}</>;
  return (
    <Modal title={title} onClose={close} size="sm" foot={foot}>
      <div className="mb">
        {step === "intro" && <>
          <p className="p0">Използвайте платения си ChatGPT абонамент в Тед. Входът става на страницата на OpenAI в браузъра ви – с Google, Apple, Microsoft или имейл, както влизате в ChatGPT. Тед не вижда паролата ви.</p>
          {error ? <div className="err" role="alert">⚠️ {error}</div> : null}
          {fixable ? otherAccount("Вход с друг ChatGPT акаунт или нова регистрация") : null}
          <div className="mem"><Icon n="check" /><div className="tx"><b>Какво получава Тед</b><small>име, имейл и право да ползва плана ви за отговори</small></div></div>
          <div className="mem"><Icon n="lock" /><div className="tx"><b>Какво НЕ получава</b><small>историята, паметта, файловете и GPT-тата ви в ChatGPT</small></div></div>
          <div className="mem"><Icon n="info" /><div className="tx"><b>Само разговор</b><small>Real GPT не вижда и не променя CRM, казусите и паметта на Тед. Каквото напишете или прикачите, се изпраща към OpenAI през вашия акаунт.</small></div></div>
          <div className="mem"><Icon n="shield" /><div className="tx"><b>Лимит</b><small>отговорите се броят от лимита на абонамента ви; при изчерпване спират</small></div></div>
          <div className="info">{RG_LIMITS} Входът с ChatGPT за външни програми е в предварителна версия на OpenAI и може да се промени.</div>
        </>}
        {step === "wait" && <div className="rg-wait"><i className="spin" /><div><b>Чакаме входа в браузъра…</b><div className="meta">Страницата за вход на OpenAI е отворена в браузъра ви – изберете „Continue with Google“, „Continue with Apple“ или друг начин, както обикновено. Програмата чака до 5 минути.</div></div></div>}
        {step === "done" && <>
          {error ? <div className="err" role="alert">⚠️ {error}</div> : null}
          {planOff
            ? <div className="err" role="alert">⚠️ Свързани сте, но използването на ChatGPT плана НЕ е разрешено. Натиснете „Продължи с ChatGPT“ и го разрешете, за да получавате отговори.</div>
            : <div className="verify" data-testid="rg-connected"><Icon n="check" /><span><b>Real GPT е свързан.</b> Отговорите се броят от лимита на вашия ChatGPT план.</span></div>}
          <dl className="kv rg-kv"><dt>Акаунт</dt><dd>{rg.email || "—"}</dd><dt>План</dt><dd>{planOff ? "не е разрешен" : "разрешен"}</dd><dt>Модели</dt><dd>от вашия акаунт – избират се от менюто „Модел“</dd></dl>
          {!planOff && onManage ? <p className="p0"><button className="lnk" onClick={onManage}>Управление на лимита</button> – страницата за използването на плана в ChatGPT.</p> : null}
          {otherAccount("Смени ChatGPT акаунта")}
          <div className="info">{RG_LIMITS}</div>
        </>}
      </div>
    </Modal>
  );
}
