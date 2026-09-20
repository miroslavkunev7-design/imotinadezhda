import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Check, Circle, Paperclip, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateClientDeal } from "@/lib/crm.functions";
import { MortgageDocsModal } from "@/components/admin/mortgage-docs-modal";
import { MortgageCalculatorModal } from "@/components/admin/mortgage-calculator-modal";
import {
  getLiveRate,
  monthlyPayment,
  fmtRateDate,
  INCOME_ORIGIN_LABEL,
  type IncomeOrigin,
} from "@/lib/mortgage-rates";

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
  income_origin?: IncomeOrigin;
  rate_date?: string;
  rate_manual?: boolean;
  rate_valid_from?: string;
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
    income_origin: initial.income_origin ?? "bg",
    rate_date: initial.rate_date ?? new Date().toISOString().slice(0, 10),
    rate_manual: initial.rate_manual ?? false,
    rate_valid_from: initial.rate_valid_from,
    general_notes: initial.general_notes ?? "",
    stages: initial.stages ?? {},
  });
  const [busy, setBusy] = useState(false);

  // Лайф лихва по ден + произход на дохода
  const live = useMemo(
    () =>
      getLiveRate(
        data.bank,
        (data.income_origin ?? "bg") as IncomeOrigin,
        new Date(data.rate_date || new Date().toISOString().slice(0, 10)),
      ),
    [data.bank, data.income_origin, data.rate_date],
  );

  useEffect(() => {
    if (data.rate_manual) return;
    const next = live.rate.toFixed(2);
    if (data.rate === next && data.rate_valid_from === live.validFrom) return;
    setData((d) => (d.rate_manual ? d : { ...d, rate: next, rate_valid_from: live.validFrom }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.rate, live.validFrom, data.rate_manual]);

  const payment = monthlyPayment(
    Number(String(data.amount ?? "").replace(/[^\d.]/g, "")),
    Number(data.rate) || live.rate,
    Number(data.term_years) || 0,
  );
  const [docsOpen, setDocsOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  const setStage = (key: string, patch: Partial<StageData>) => {
    setData((d) => ({
      ...d,
      stages: { ...(d.stages ?? {}), [key]: { ...(d.stages?.[key] ?? {}), ...patch } },
    }));
  };

  const toggleDone = (key: string) => {
    const current = data.stages?.[key]?.done;
    setStage(key, {
      done: !current,
      completed_at: !current ? new Date().toISOString() : undefined,
    });
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#8B1A2B]/55 p-4 pb-24 sm:pb-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-accent-foreground">Ипотечен кредит</h2>
            <p className="text-sm text-muted-foreground">
              {client.full_name} · {completed}/{STAGES.length} етапа завършени
            </p>
          </div>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 rounded-lg border border-border p-3 md:grid-cols-4">
          <Field label="Банка">
            <input
              value={data.bank ?? ""}
              onChange={(e) => setData({ ...data, bank: e.target.value })}
              className={iC}
              placeholder="напр. ОББ"
            />
          </Field>
          <Field label="Сума">
            <input
              value={data.amount ?? ""}
              onChange={(e) => setData({ ...data, amount: e.target.value })}
              className={iC}
              placeholder="150 000 EUR"
            />
          </Field>
          <Field label="Лихва %">
            <input
              value={data.rate ?? ""}
              onChange={(e) => setData({ ...data, rate: e.target.value, rate_manual: true })}
              className={iC}
              placeholder="2.5"
            />
          </Field>
          <Field label="Срок (год.)">
            <input
              value={data.term_years ?? ""}
              onChange={(e) => setData({ ...data, term_years: e.target.value })}
              className={iC}
              placeholder="25"
            />
          </Field>
        </div>

        {/* Лайф лихва по дата/ден и произход на дохода */}
        <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Произход на дохода">
              <select
                value={data.income_origin ?? "bg"}
                onChange={(e) =>
                  setData({
                    ...data,
                    income_origin: e.target.value as IncomeOrigin,
                    rate_manual: false,
                  })
                }
                className={iC}
              >
                <option value="bg">{INCOME_ORIGIN_LABEL.bg}</option>
                <option value="foreign">{INCOME_ORIGIN_LABEL.foreign}</option>
              </select>
            </Field>
            <Field label="Лихва към ден">
              <input
                type="date"
                value={data.rate_date ?? ""}
                onChange={(e) =>
                  setData({ ...data, rate_date: e.target.value, rate_manual: false })
                }
                className={iC}
              />
            </Field>
            <Field label="Автоматична лихва">
              <button
                type="button"
                onClick={() =>
                  setData((d) =>
                    d.rate_manual ? { ...d, rate_manual: false } : { ...d, rate_manual: true },
                  )
                }
                className="w-full rounded border border-input bg-background px-3 py-2 text-sm font-semibold"
              >
                {data.rate_manual ? "Ръчно (включи авто)" : "Авто (включена)"}
              </button>
            </Field>
          </div>
          <div className="text-xs text-muted-foreground">
            Лайф лихва: <strong className="text-foreground">{live.rate.toFixed(2)}%</strong> ·{" "}
            {INCOME_ORIGIN_LABEL[(data.income_origin ?? "bg") as IncomeOrigin]} · валидна от{" "}
            {fmtRateDate(live.validFrom)}
            {live.fallback ? " · базова таблица (банката е без собствена ставка)" : ""}
            {payment ? ` · вноска ~${payment.toLocaleString("bg-BG")} / месец` : ""}
          </div>
        </div>

        <div className="space-y-2">
          {STAGES.map((s, idx) => {
            const st = data.stages?.[s.key] ?? {};
            return (
              <div
                key={s.key}
                className={`rounded-lg border p-3 ${st.done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleDone(s.key)}
                    className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border ${st.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"}`}
                    aria-label="toggle"
                  >
                    {st.done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Circle className="h-3 w-3 opacity-30" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-foreground">
                        {idx + 1}. {s.label}
                      </div>
                      {st.completed_at && st.done && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(st.completed_at).toLocaleDateString("bg-BG")}
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      value={st.notes ?? ""}
                      onChange={(e) => setStage(s.key, { notes: e.target.value })}
                      placeholder="Бележки за етапа…"
                      className="mt-2 w-full rounded border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <Field label="Общи бележки">
            <textarea
              rows={3}
              value={data.general_notes ?? ""}
              onChange={(e) => setData({ ...data, general_notes: e.target.value })}
              className={iC}
            />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-5 flex flex-wrap justify-end gap-2 border-t border-border bg-card px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" onClick={() => setCalcOpen(true)}>
            <Calculator className="mr-1 h-4 w-4" /> ЦКР / Калкулатор
          </Button>
          <Button type="button" variant="outline" onClick={() => setDocsOpen(true)}>
            <Paperclip className="mr-1 h-4 w-4" /> Документи
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Отказ
          </Button>
          <Button type="button" disabled={busy} onClick={save} className="gold-cta-button">
            {busy ? "Запис…" : "Запази"}
          </Button>
        </div>
      </div>

      {calcOpen && (
        <MortgageCalculatorModal
          client={client}
          onClose={() => setCalcOpen(false)}
          onSaved={onSaved}
          defaults={{
            ratePercent: Number(data.rate) || live.rate,
            years: Number(data.term_years) || 25,
          }}
        />
      )}

      {docsOpen && (
        <MortgageDocsModal client={client} onClose={() => setDocsOpen(false)} onChanged={onSaved} />
      )}
    </div>
  );
}

const iC = "w-full rounded border border-input bg-background px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
