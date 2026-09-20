import { useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Calculator, ShieldCheck, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateClientDeal } from "@/lib/crm.functions";
import {
  TERM_YEARS_OPTIONS,
  MIN_TERM_YEARS,
  MAX_TERM_YEARS,
  clampTermYears,
  calcLoan,
  assessCcr,
  calcNotaryFees,
  CCR_STATUS_LABEL,
  DEFAULT_LOCAL_TAX_RATE,
  money,
  type Currency,
  type CcrStatus,
} from "@/lib/mortgage-calc";

const iC = "w-full rounded border border-input bg-background px-3 py-2 text-sm";

function num(v: string | number | undefined) {
  const n = Number(
    String(v ?? "")
      .replace(/[^\d.,-]/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
}

export function MortgageCalculatorModal({
  client,
  onClose,
  onSaved,
  defaults,
}: {
  client?: any;
  onClose: () => void;
  onSaved?: () => void;
  defaults?: { price?: number; ratePercent?: number; years?: number; currency?: Currency };
}) {
  const saved = client?.mortgage_data?.calc ?? {};

  const [currency, setCurrency] = useState<Currency>(saved.currency ?? defaults?.currency ?? "EUR");
  const [price, setPrice] = useState<string>(String(saved.price ?? defaults?.price ?? ""));
  const [downPayment, setDownPayment] = useState<string>(String(saved.down_payment ?? ""));
  const [rate, setRate] = useState<string>(
    String(saved.rate ?? defaults?.ratePercent ?? client?.mortgage_data?.rate ?? "2.45"),
  );
  const [years, setYears] = useState<number>(
    clampTermYears(
      Number(saved.years ?? defaults?.years ?? client?.mortgage_data?.term_years ?? 25),
    ),
  );
  const [monthlyFees, setMonthlyFees] = useState<string>(String(saved.monthly_fees ?? ""));

  // ЦКР
  const [netIncome, setNetIncome] = useState<string>(String(saved.net_income ?? ""));
  const [obligations, setObligations] = useState<string>(String(saved.obligations ?? ""));
  const [cardLimits, setCardLimits] = useState<string>(String(saved.card_limits ?? ""));
  const [activeLoans, setActiveLoans] = useState<string>(String(saved.active_loans ?? "0"));
  const [dependants, setDependants] = useState<string>(String(saved.dependants ?? "0"));
  const [ccrStatus, setCcrStatus] = useState<CcrStatus>(
    (saved.ccr_status as CcrStatus) ?? "regular",
  );

  // Нотариални такси
  const [taxValuation, setTaxValuation] = useState<string>(String(saved.tax_valuation ?? ""));
  const [localTaxRate, setLocalTaxRate] = useState<string>(
    String(saved.local_tax_rate ?? DEFAULT_LOCAL_TAX_RATE),
  );
  const [withMortgage, setWithMortgage] = useState<boolean>(saved.with_mortgage ?? true);
  const [splitFees, setSplitFees] = useState<boolean>(saved.split_fees ?? false);

  const [busy, setBusy] = useState(false);

  const loan = useMemo(
    () =>
      calcLoan({
        price: num(price),
        downPayment: num(downPayment),
        ratePercent: num(rate),
        years,
        monthlyFees: num(monthlyFees),
      }),
    [price, downPayment, rate, years, monthlyFees],
  );

  const ccr = useMemo(
    () =>
      assessCcr({
        netIncome: num(netIncome),
        existingObligations: num(obligations),
        cardLimits: num(cardLimits),
        activeLoans: num(activeLoans),
        dependants: num(dependants),
        status: ccrStatus,
        newPayment: loan.monthlyTotal,
      }),
    [netIncome, obligations, cardLimits, activeLoans, dependants, ccrStatus, loan.monthlyTotal],
  );

  const notary = useMemo(
    () =>
      calcNotaryFees({
        price: num(price),
        taxValuation: num(taxValuation),
        loanAmount: loan.principal,
        currency,
        localTaxRate: num(localTaxRate) || DEFAULT_LOCAL_TAX_RATE,
        withMortgage,
        splitFees,
      }),
    [price, taxValuation, loan.principal, currency, localTaxRate, withMortgage, splitFees],
  );

  const save = async () => {
    if (!client?.id) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await updateClientDeal({
        data: {
          id: client.id,
          mortgage_data: {
            ...(client.mortgage_data ?? {}),
            amount: String(loan.principal),
            rate: String(num(rate)),
            term_years: String(years),
            calc: {
              currency,
              price: num(price),
              down_payment: num(downPayment),
              rate: num(rate),
              years,
              monthly_fees: num(monthlyFees),
              net_income: num(netIncome),
              obligations: num(obligations),
              card_limits: num(cardLimits),
              active_loans: num(activeLoans),
              dependants: num(dependants),
              ccr_status: ccrStatus,
              tax_valuation: num(taxValuation),
              local_tax_rate: num(localTaxRate) || DEFAULT_LOCAL_TAX_RATE,
              with_mortgage: withMortgage,
              split_fees: splitFees,
              result: {
                monthly_payment: loan.monthlyPayment,
                monthly_total: loan.monthlyTotal,
                total_interest: loan.totalInterest,
                ltv: loan.ltv,
                apr: loan.aprPercent,
                ccr_score: ccr.score,
                ccr_dti: ccr.dti,
                notary_total: notary.total,
              },
              updated_at: new Date().toISOString(),
            },
          } as any,
        },
      });
      toast.success("Изчислението е записано към клиента");
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Грешка при запис");
    } finally {
      setBusy(false);
    }
  };

  const verdictColor =
    ccr.verdict === "approve"
      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700"
      : ccr.verdict === "review"
        ? "border-amber-500/50 bg-amber-500/10 text-amber-700"
        : "border-red-500/50 bg-red-500/10 text-red-700";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[#8B1A2B]/55 p-4 pb-24 sm:items-center sm:pb-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-2xl bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl text-accent-foreground">
              <Calculator className="h-5 w-5" /> ЦКР / Кредитен калкулатор
            </h2>
            <p className="text-sm text-muted-foreground">
              {client?.full_name ? `${client.full_name} · ` : ""}вноска, ЦКР оценка и нотариални
              такси
            </p>
          </div>
          <button onClick={onClose} aria-label="Затвори">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Параметри на кредита */}
        <section className="mb-5 rounded-xl border border-border p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Параметри на кредита
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Валута">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className={iC}
              >
                <option value="EUR">EUR</option>
                <option value="BGN">BGN</option>
              </select>
            </Field>
            <Field label="Цена на имота">
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={iC}
                placeholder="150000"
                inputMode="decimal"
              />
            </Field>
            <Field label="Самоучастие">
              <input
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
                className={iC}
                placeholder="30000"
                inputMode="decimal"
              />
            </Field>
            <Field label="Лихва %">
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className={iC}
                placeholder="2.45"
                inputMode="decimal"
              />
            </Field>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Срок на кредита
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={years}
                  onChange={(e) => setYears(clampTermYears(Number(e.target.value)))}
                  className="rounded border border-input bg-background px-2 py-1 text-sm"
                >
                  {TERM_YEARS_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y} {y === 1 ? "година" : "години"}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">{years * 12} вноски</span>
              </div>
            </div>
            <input
              type="range"
              min={MIN_TERM_YEARS}
              max={MAX_TERM_YEARS}
              step={1}
              value={years}
              onChange={(e) => setYears(clampTermYears(Number(e.target.value)))}
              className="w-full accent-[#8B1A2B]"
              aria-label="Срок в години"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{MIN_TERM_YEARS} г.</span>
              <span>{MAX_TERM_YEARS} г.</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Месечни такси/застраховки">
              <input
                value={monthlyFees}
                onChange={(e) => setMonthlyFees(e.target.value)}
                className={iC}
                placeholder="25"
                inputMode="decimal"
              />
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Размер на кредита" value={money(loan.principal, currency)} />
            <Stat label="Месечна вноска" value={money(loan.monthlyPayment, currency)} strong />
            <Stat label="Вноска с такси" value={money(loan.monthlyTotal, currency)} />
            <Stat label="LTV" value={`${loan.ltv}%`} />
            <Stat label="Общо лихви" value={money(loan.totalInterest, currency)} />
            <Stat label="Общо платено" value={money(loan.totalPaid, currency)} />
            <Stat label="ГПР (прибл.)" value={`${loan.aprPercent.toFixed(2)}%`} />
            <Stat label="Срок" value={`${loan.years} г. / ${loan.months} м.`} />
          </div>
        </section>

        {/* ЦКР */}
        <section className="mb-5 rounded-xl border border-border p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> ЦКР оценка
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Нетен месечен доход">
              <input
                value={netIncome}
                onChange={(e) => setNetIncome(e.target.value)}
                className={iC}
                placeholder="2500"
                inputMode="decimal"
              />
            </Field>
            <Field label="Вноски по други кредити">
              <input
                value={obligations}
                onChange={(e) => setObligations(e.target.value)}
                className={iC}
                placeholder="200"
                inputMode="decimal"
              />
            </Field>
            <Field label="Лимити карти/овърдрафт">
              <input
                value={cardLimits}
                onChange={(e) => setCardLimits(e.target.value)}
                className={iC}
                placeholder="3000"
                inputMode="decimal"
              />
            </Field>
            <Field label="Активни кредити (брой)">
              <input
                value={activeLoans}
                onChange={(e) => setActiveLoans(e.target.value)}
                className={iC}
                inputMode="numeric"
              />
            </Field>
            <Field label="Издържани лица">
              <input
                value={dependants}
                onChange={(e) => setDependants(e.target.value)}
                className={iC}
                inputMode="numeric"
              />
            </Field>
            <Field label="Статус по ЦКР">
              <select
                value={ccrStatus}
                onChange={(e) => setCcrStatus(e.target.value as CcrStatus)}
                className={iC}
              >
                {(Object.keys(CCR_STATUS_LABEL) as CcrStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {CCR_STATUS_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className={`mt-4 rounded-lg border p-3 ${verdictColor}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-base">
                {ccr.verdictLabel} · скор {ccr.score}/100
              </strong>
              <span className="text-sm">
                Вноски/доход: {ccr.dti}% · макс. вноска {money(ccr.maxPayment, currency)}
              </span>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-foreground/80">
              {ccr.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
              <li>Остатък след вноски и издръжка: {money(ccr.freeCash, currency)}</li>
            </ul>
          </div>
        </section>

        {/* Нотариални такси */}
        <section className="mb-5 rounded-xl border border-border p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Stamp className="h-4 w-4" /> Нотариални такси (автоматично)
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Данъчна оценка">
              <input
                value={taxValuation}
                onChange={(e) => setTaxValuation(e.target.value)}
                className={iC}
                placeholder="90000"
                inputMode="decimal"
              />
            </Field>
            <Field label="Местен данък %">
              <input
                value={localTaxRate}
                onChange={(e) => setLocalTaxRate(e.target.value)}
                className={iC}
                inputMode="decimal"
              />
            </Field>
            <Field label="Договорна ипотека">
              <button
                type="button"
                onClick={() => setWithMortgage((v) => !v)}
                className={`${iC} text-left font-semibold`}
              >
                {withMortgage ? "Да — включена" : "Не"}
              </button>
            </Field>
            <Field label="Такси 50/50">
              <button
                type="button"
                onClick={() => setSplitFees((v) => !v)}
                className={`${iC} text-left font-semibold`}
              >
                {splitFees ? "Разделени по равно" : "За купувача"}
              </button>
            </Field>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Такса</th>
                  <th className="py-2">Основа</th>
                  <th className="py-2 text-right">Сума</th>
                </tr>
              </thead>
              <tbody>
                {notary.lines.map((l) => (
                  <tr key={l.key} className="border-b border-border/60">
                    <td className="py-2 text-foreground">{l.label}</td>
                    <td className="py-2 text-xs text-muted-foreground">{l.note ?? "—"}</td>
                    <td className="py-2 text-right font-medium text-foreground">
                      {money(l.amount, currency)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-semibold text-foreground">Общо</td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {notary.percentOfPrice}% от цената
                  </td>
                  <td className="py-2 text-right font-bold text-foreground">
                    {money(notary.total, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Материален интерес: {money(notary.interest, currency)} · купувач{" "}
            {money(notary.buyerTotal, currency)} · продавач {money(notary.sellerTotal, currency)}
          </p>
        </section>

        <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap justify-end gap-2 border-t border-border bg-card px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" onClick={onClose}>
            Затвори
          </Button>
          {client?.id && (
            <Button type="button" disabled={busy} onClick={save} className="gold-cta-button">
              {busy ? "Запис…" : "Запази към клиента"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

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

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 ${strong ? "border-[#C9A84C] bg-[#C9A84C]/10" : "border-border"}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`mt-1 ${strong ? "text-lg font-bold" : "text-sm font-semibold"} text-foreground`}
      >
        {value}
      </div>
    </div>
  );
}
