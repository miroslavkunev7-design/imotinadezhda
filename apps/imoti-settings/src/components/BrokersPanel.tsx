import { useEffect, useState, type FormEvent } from "react";
import { createBrokerProfile, listBrokers, type BrokerCard } from "../api";

type Props = { toast: (msg: string) => void; walkthrough?: boolean };

export function BrokersPanel({ toast, walkthrough }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [office, setOffice] = useState("Шумен");
  const [title, setTitle] = useState("Брокер");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<BrokerCard[]>([]);
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  async function refresh() {
    try {
      const rows = await listBrokers();
      setList(rows);
    } catch {
      /* walkthrough / offline */
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (walkthrough) {
      toast("Walkthrough: broker create needs real staff session + SERVICE_ROLE on server");
      return;
    }
    if (!email.trim() || !password || password.length < 8) {
      toast("Имейл + парола (≥8) са задължителни");
      return;
    }
    setBusy(true);
    try {
      const res = await createBrokerProfile({
        email: email.trim(),
        password,
        name: name.trim() || email.trim().split("@")[0],
        phone: phone.trim(),
        office,
        title
      });
      setLastCreated(res.email);
      setPassword("");
      toast(`Създаден брокер: ${res.email} — може да влезе в CRM`);
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>Брокери — профили от Settings</h3>
      <p className="muted">
        Админът въвежда имейл + парола. Сървърът създава Auth потребител (staff/broker), ред в{" "}
        <code>nd_staff</code> и CRM карта в <code>nd_brokers</code>. Service role остава само на{" "}
        <code>/api/brokers</code> — никога в Electron.
      </p>

      <form onSubmit={(e) => void submit(e)}>
        <div className="grid2">
          <label className="field">
            <span>Имейл (login)</span>
            <input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            <span>Парола</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </label>
          <label className="field">
            <span>Име</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Име и фамилия" />
          </label>
          <label className="field">
            <span>Телефон</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+359 …" />
          </label>
          <label className="field">
            <span>Титла</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Офис</span>
            <select value={office} onChange={(e) => setOffice(e.target.value)}>
              <option>Шумен</option>
              <option>Варна</option>
              <option>Бургас</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Създаване…" : "Създай Auth + CRM карта"}
          </button>
        </div>
      </form>

      {lastCreated && (
        <p className="muted" style={{ marginTop: 12 }}>
          Последно създаден: <strong>{lastCreated}</strong> — влиза с тези данни в CRM.
        </p>
      )}

      <h3 style={{ marginTop: 22 }}>Съществуващи брокери</h3>
      {list.length === 0 ? (
        <div className="empty">Няма заредени карти (или няма staff сесия).</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Име</th>
              <th>Имейл</th>
              <th>Офис</th>
              <th>Активен</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.email || "—"}</td>
                <td>{b.office || "—"}</td>
                <td>{b.active === false ? "не" : "да"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
