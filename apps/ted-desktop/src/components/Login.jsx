import React, { useState } from "react";
import { ted } from "../bridge.js";
import avatar from "../assets/avatar.webp";
import logo from "../assets/logo.png";

// Sign-in with the CRM account. The password lives only in this field until it is handed to MAIN once.
export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const id = identifier.trim();
    if (!id || !password) { setError("Въведете имейл или телефон и парола."); return; }
    setBusy(true); setError("");
    const secret = password;
    setPassword("");
    let r;
    try { r = await ted.auth.login({ identifier: id, password: secret }); }
    catch { r = { ok: false, error: "Входът не успя. Опитайте отново." }; }
    setBusy(false);
    if (r && r.ok) onLogin(r.user);
    else setError((r && r.error) || "Входът не успя. Опитайте отново.");
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit} aria-label="Вход в Тед" noValidate>
        <div className="login-logo"><img src={logo} alt="Имоти Надежда" /></div>
        <span className="login-av"><img src={avatar} alt="" /></span>
        <h1>Вход в Тед</h1>
        <p className="login-sub">Влезте с акаунта си в CRM на „Имоти Надежда“. Тед има същите права като вас в сайта.</p>
        <div className="fld"><label htmlFor="lg-id">Имейл или телефон</label>
          <input id="lg-id" className="inp" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" autoFocus disabled={busy} maxLength={200} /></div>
        <div className="fld"><label htmlFor="lg-pw">Парола</label>
          <input id="lg-pw" className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={busy} maxLength={200} /></div>
        {error ? <div className="err" role="alert">⚠️ {error}</div> : null}
        <button className="b wine login-btn" type="submit" disabled={busy}>{busy ? <><i className="spin" />Влизане…</> : "Вход"}</button>
        <p className="login-note">Паролата не се пази на този компютър. Запазва се само шифрована сесия за вашия профил в Windows.</p>
      </form>
    </div>
  );
}
