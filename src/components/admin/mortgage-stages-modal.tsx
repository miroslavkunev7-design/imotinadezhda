import { useState } from "react";
import { toast } from "sonner";
import { X, Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateClientDeal } from "@/lib/crm.functions";

const STAGES: { key: string; label: string }[] = [
  { key: "consult", label: "Консултация и предварителна оценка" },
  { key: "documents", label: "Събиране на документи (доходи, лична карта, имот)" },
  { key: "bank_apply", label: "Подаване в банка" },
  { key: "appraisal", label: "Оценка на имота" },
  { key: "approval", label: "Одобрение от банката" },
  { key: "contract", label: "Подписване на договор за кредит" },
  { key: "notary", label: "Нотариална сделка" },
  { key: "disbursement", label: "Усвояване на кредита" },
];

type StageData = { done?: boolean; notes?: string; completed_at?: string };
type MortgageData = {
  bank?: string;
  amount?: string;
  rate?: string;
  term_years?: string;
  general_notes?: string;
  stages?: Record<string, StageData>;
};

export function MortgageStagesModal({
  client,
  onClose,
  onSaved,
}: {
  client: any;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const initial: MortgageData = client.mortgage_data ?? {};
  const [data, setData] = useState<MortgageData>({
    bank: initial.bank ?? "",
    amount: initial.amount ?? "",
    rate: initial.rate ?? "",
    term_years: initial.term_years ?? "",
    general_notes: initial.general_notes ?? "",
    stages: initial.stages ?? {},
  });
  const [busy, setBusy] = useState(false);

  const setStage = (key: string, patch: Partial<StageData>) => {
    setData((d) => ({
      ...d,
      stages: { ...(d.stages ?? {}), [key]: { ...(d.stages?.[key] ?? {}), ...patch } },
    }));
  };

  const toggleDone = (key: string) => {
    const current = data.stages?.[key]?.done;
    setStage(key, { done: !current, completed_at: !current ? new Date().toISOString() : undefined });
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateClientDeal({
        data: {
          id: client.id,
          deal_stage: "mortgage",
          mortgage_data: data as any,
        },
      });
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка");
    } finally {
      setBusy(false);
    }
  };

  const completed = STAGES.filter((s) => data.stages?.[s.key]?.done).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/55 p-4" onClick={onClose}>
      <div
        data-crm-light-modal
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 text-[#2a0a12] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-[#31020c]">Ипотечен кредит</h2>
            <p className="text-sm text-[#5a3a3f]">{client.full_name} · {completed}/{STAGES.length} етапа завършени</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 rounded-lg border border-border p-3 md:grid-cols-4">
          <Field label="Банка"><input value={data.bank ?? ""} onChange={(e) => setData({ ...data, bank: e.target.value })} className={iC} placeholder="напр. ОББ" /></Field>
          <Field label="Сума"><input value={data.amount ?? ""} onChange={(e) => setData({ ...data, amount: e.target.value })} className={iC} placeholder="150 000 EUR" /></Field>
          <Field label="Лихва %"><input value={data.rate ?? ""} onChange={(e) => setData({ ...data, rate: e.target.value })} className={iC} placeholder="2.5" /></Field>
          <Field label="Срок (год.)"><input value={data.term_years ?? ""} onChange={(e) => setData({ ...data, term_years: e.target.value })} className={iC} placeholder="25" /></Field>
        </div>

        <div className="space-y-2">
          {STAGES.map((s, idx) => {
            const st = data.stages?.[s.key] ?? {};
            return (
              <div key={s.key} className={`rounded-lg border p-3 ${st.done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleDone(s.key)}
                    className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border ${st.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"}`}
                    aria-label="toggle"
                  >
                    {st.done ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3 opacity-30" />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-[#31020c]">{idx + 1}. {s.label}</div>
                      {st.completed_at && st.done && (
                        <span className="text-xs text-muted-foreground">{new Date(st.completed_at).toLocaleDateString("bg-BG")}</span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={st.notes ?? ""}
                      onChange={(e) => setStage(s.key, { notes: e.target.value })}
                      placeholder="Бележки за етапа…"
                      className="mt-2 w-full rounded border border-[#8B1A2B]/25 bg-white px-3 py-2 text-sm text-[#2a0a12]"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <Field label="Общи бележки">
            <textarea rows={3} value={data.general_notes ?? ""} onChange={(e) => setData({ ...data, general_notes: e.target.value })} className={iC} />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Отказ</Button>
          <Button type="button" disabled={busy} onClick={save} className="gold-cta-button">{busy ? "Запис…" : "Запази"}</Button>
        </div>
      </div>
    </div>
  );
}

const iC = "w-full rounded border border-[#8B1A2B]/25 bg-white px-3 py-2 text-sm text-[#2a0a12]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#5a3a3f]">{label}</span>
      {children}
    </label>
  );
}
