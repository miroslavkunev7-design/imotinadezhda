import { FormEvent, useState } from "react";
import { signIn } from "../api";

export function Login({ onOk, onWalkthrough }: { onOk: () => void; onWalkthrough?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await signIn(email.trim(), password);
      onOk();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>Imoti Nadezhda Settings</h1>
        <p>Sign in with your CRM broker account</p>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field" style={{ marginTop: 10 }}>
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <div className="err">{err}</div>
        <div className="actions">
          <button className="primary" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Signing in…" : "Enter Settings"}
          </button>
        </div>
        {onWalkthrough && (
          <div className="actions" style={{ marginTop: 8 }}>
            <button className="ghost" type="button" style={{ width: "100%" }} onClick={onWalkthrough}>
              Continue in walkthrough mode (mock staff)
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
