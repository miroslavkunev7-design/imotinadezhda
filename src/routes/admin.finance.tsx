import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, FileText, TrendingUp, Coins } from "lucide-react";

export const Route = createFileRoute("/admin/finance")({ component: FinanceAdmin });

type Contract = { id: string; title: string; contract_type: string; status: string; client_id: string | null; property_id: string | null; created_at: string };
type Mortgage = { id: string; full_name: string; phone: string; email: string | null; monthly_income: number | null; status: string; created_at: string };
type Property = { id: string; price: number | null; currency: string | null };

function FinanceAdmin() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [mortgages, setMortgages] = useState<Mortgage[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(0.03);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, m, p, s] = await Promise.all([
        supabase.from("generated_contracts").select("id,title,contract_type,status,client_id,property_id,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("mortgage_applications").select("id,full_name,phone,email,monthly_income,status,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("properties").select("id,price,currency"),
        supabase.from("agency_settings").select("commission_rate").eq("singleton", true).maybeSingle(),
      ]);
      if (c.error) toast.error(c.error.message);
      if (m.error) toast.error(m.error.message);
      setContracts((c.data as Contract[]) ?? []);
      setMortgages((m.data as Mortgage[]) ?? []);
      setProperties((p.data as Property[]) ?? []);
      if (s.data?.commission_rate != null) setCommissionRate(Number(s.data.commission_rate));
      setLoading(false);
    })();
  }, []);

  const saveCommission = async (next: number) => {
    const { error } = await supabase.from("agency_settings").update({ commission_rate: next }).eq("singleton", true);
    if (error) return toast.error(error.message);
    setCommissionRate(next);
    toast.success(`Комисионата е обновена на ${(next * 100).toFixed(2)}%`);
  };

  const stats = useMemo(() => {
    const propMap = new Map(properties.map(p => [p.id, p]));
    let contractsValue = 0;
    let commissionTotal = 0;
    for (const c of contracts) {
      if (c.status === "signed" || c.status === "active") {
        const p = c.property_id ? propMap.get(c.property_id) : null;
        if (p?.price) {
          contractsValue += Number(p.price);
          commissionTotal += Number(p.price) * commissionRate;
        }
      }
    }
    const mortgageVolume = mortgages.reduce((s, m) => s + (Number(m.monthly_income) || 0), 0);
    return {
      contractsValue,
      commissionTotal,
      contractsActive: contracts.filter(c => c.status === "signed" || c.status === "active").length,
      contractsDraft: contracts.filter(c => c.status === "draft").length,
      mortgageCount: mortgages.length,
      mortgageVolume,
    };
  }, [contracts, mortgages, properties]);

  const fmt = (n: number) => new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl text-amber-100">Финанси</h1>
        <p className="text-sm text-amber-100/60">Договори, комисионни и ипотечни заявки.</p>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-amber-500/20 p-10 text-center text-amber-100/60">Зареждане...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat icon={<TrendingUp className="h-5 w-5" />} label="Стойност договори" value={fmt(stats.contractsValue)} />
            <Stat icon={<Coins className="h-5 w-5" />} label={`Комисионни (${(commissionRate * 100).toFixed(0)}%)`} value={fmt(stats.commissionTotal)} accent />
            <Stat icon={<FileText className="h-5 w-5" />} label="Активни / Чернови" value={`${stats.contractsActive} / ${stats.contractsDraft}`} />
            <Stat icon={<Wallet className="h-5 w-5" />} label="Ипотечни заявки" value={String(stats.mortgageCount)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Последни договори">
              {contracts.length === 0 ? <Empty>Все още няма договори.</Empty> : (
                <ul className="divide-y divide-amber-500/15">
                  {contracts.slice(0, 10).map(c => {
                    const prop = c.property_id ? properties.find(p => p.id === c.property_id) : null;
                    const value = prop?.price ? Number(prop.price) : 0;
                    return (
                      <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-amber-100">{c.title}</div>
                          <div className="text-xs text-amber-100/55">{c.contract_type} · {new Date(c.created_at).toLocaleDateString("bg-BG")}</div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${c.status === "signed" ? "bg-emerald-500/20 text-emerald-200" : c.status === "draft" ? "bg-amber-500/20 text-amber-200" : "bg-sky-500/20 text-sky-200"}`}>{c.status}</span>
                          {value > 0 && <span className="mt-1 text-xs text-amber-100/70">{fmt(value)}</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Ипотечни заявки">
              {mortgages.length === 0 ? <Empty>Няма заявки.</Empty> : (
                <ul className="divide-y divide-amber-500/15">
                  {mortgages.slice(0, 10).map(m => (
                    <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-amber-100">{m.full_name}</div>
                        <div className="text-xs text-amber-100/55">{m.phone} · {new Date(m.created_at).toLocaleDateString("bg-BG")}</div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${m.status === "approved" ? "bg-emerald-500/20 text-emerald-200" : m.status === "rejected" ? "bg-rose-500/20 text-rose-200" : "bg-amber-500/20 text-amber-200"}`}>{m.status}</span>
                        {m.monthly_income && <span className="mt-1 text-xs text-amber-100/70">{fmt(Number(m.monthly_income))}/мес</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 backdrop-blur ${accent ? "border-amber-400/60 bg-gradient-to-br from-amber-500/20 to-amber-300/10" : "border-amber-500/20 bg-[rgba(20,4,8,0.6)]"}`}>
      <div className="flex items-center gap-2 text-amber-300">{icon}<span className="text-xs uppercase text-amber-100/70">{label}</span></div>
      <div className="mt-2 font-display text-2xl text-amber-100">{value}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-amber-500/20 bg-[rgba(20,4,8,0.6)] p-4 backdrop-blur">
      <h2 className="mb-3 font-display text-lg text-amber-100">{title}</h2>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center text-sm text-amber-100/55">{children}</div>;
}
