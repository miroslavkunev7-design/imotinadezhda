import { useEffect, useState } from "react";
import { fetchMortgageRates, fetchSetting, saveSetting } from "../api";

type BankAsset = { id: string; name: string; brandHex: string; luxuryUrl: string };

const SEED: BankAsset[] = [
  { id: "dsk", name: "ДСК", brandHex: "#e30613", luxuryUrl: "/bank/assets/image-1.png" },
  { id: "ubb", name: "ОББ", brandHex: "#0033a0", luxuryUrl: "/bank/assets/image-2.jpg" },
  { id: "unicredit", name: "UniCredit", brandHex: "#e2001a", luxuryUrl: "/bank/assets/image-3.png" },
  { id: "fibank", name: "Fibank", brandHex: "#00a3e0", luxuryUrl: "/bank/assets/image-4.jpg" }
];

export function BankPanel({ toast }: { toast: (m: string) => void }) {
  const [banks, setBanks] = useState<BankAsset[]>(SEED);
  const [rates, setRates] = useState<Array<Record<string, unknown>>>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchSetting<{ banks?: BankAsset[] }>("bank_luxury_assets");
        if (data?.banks?.length) setBanks(data.banks);
        setRates(await fetchMortgageRates());
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  async function save() {
    try {
      await saveSetting("bank_luxury_assets", { banks });
      toast("Bank luxury assets saved");
      await window.imotiSettings?.previewNavigate("/bank/");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    }
  }

  async function pick() {
    const file = await window.imotiSettings?.openImage();
    if (!file) return;
    setBanks((b) => b.map((x, i) => i === idx ? { ...x, luxuryUrl: file.dataUrl } : x));
  }

  const cur = banks[idx];

  return (
    <div>
      <div className="card">
        <h3>Bank luxury storefronts</h3>
        <div className="grid2">
          <div>
            {banks.map((b, i) => (
              <button key={b.id} type="button" className={"page-btn" + (i === idx ? " active" : "")} onClick={() => setIdx(i)}>
                {b.name}<small>{b.brandHex}</small>
              </button>
            ))}
          </div>
          {cur && (
            <div>
              <label className="field"><span>Name</span>
                <input value={cur.name} onChange={(e) => setBanks((b) => b.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
              </label>
              <label className="field" style={{ marginTop: 10 }}><span>Brand hex</span>
                <input type="color" value={cur.brandHex} onChange={(e) => setBanks((b) => b.map((x, i) => i === idx ? { ...x, brandHex: e.target.value } : x))} />
              </label>
              <label className="field" style={{ marginTop: 10 }}><span>Luxury asset URL</span>
                <textarea value={cur.luxuryUrl} onChange={(e) => setBanks((b) => b.map((x, i) => i === idx ? { ...x, luxuryUrl: e.target.value } : x))} />
              </label>
              <div className="actions">
                <button type="button" className="ghost" onClick={pick}>Replace image</button>
                <button type="button" className="primary" onClick={save}>Save bank assets</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="card">
        <h3>Live mortgage rates (read-only)</h3>
        <p className="muted">From mortgage_rates — refresh via existing cron / docs pipeline.</p>
        <table className="table">
          <thead><tr><th>Bank</th><th>Product</th><th>Rate</th></tr></thead>
          <tbody>
            {rates.slice(0, 40).map((r, i) => (
              <tr key={i}>
                <td>{String(r.bank || r.bank_name || "")}</td>
                <td>{String(r.product || r.product_name || r.name || "")}</td>
                <td>{String(r.rate ?? r.annual_rate ?? r.apr ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
