import { Building2, Calculator, Check, Info, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { bankMeta, type CreditBlockData } from "@/lib/banks-catalog";
import { monthlyPayment } from "@/lib/mortgage-rates";

const TERM_OPTIONS = [10, 15, 20, 25, 30, 35];

export function CreditBlock({
  data,
  onChangeBank,
  onOpenDetail,
  onUpdate,
}: {
  data: CreditBlockData;
  onChangeBank?: () => void;
  onOpenDetail?: () => void;
  /** Локални промени по сума/срок (опционално се записват от родителя). */
  onUpdate?: (next: CreditBlockData) => void;
}) {
  const meta = bankMeta(data.bank);
  const fg = meta.dark ? "#3d2f00" : "#ffffff";
  const [amount, setAmount] = useState(data.amount);
  const [down, setDown] = useState(data.downPayment);
  const [years, setYears] = useState(data.years);
  const [rate, setRate] = useState(data.rate);

  const loan = Math.max(0, amount);
  const downPct = amount + down > 0 ? (down / (amount + down)) * 100 : 0;
  const payment = useMemo(() => monthlyPayment(loan, rate, years), [loan, rate, years]);

  const push = (patch: Partial<CreditBlockData>) => {
    const next: CreditBlockData = {
      bank: data.bank,
      amount,
      downPayment: down,
      years,
      rate,
      payment,
      savedAt: data.savedAt,
      ...patch,
    };
    if (patch.amount !== undefined) setAmount(patch.amount);
    if (patch.downPayment !== undefined) setDown(patch.downPayment);
    if (patch.years !== undefined) setYears(patch.years);
    if (patch.rate !== undefined) setRate(patch.rate);
    onUpdate?.({
      ...next,
      payment: monthlyPayment(
        patch.amount ?? amount,
        patch.rate ?? rate,
        patch.years ?? years,
      ),
    });
  };

  const maxLoan = Math.max(amount + down, 50_000);
  const sliderPct = Math.min(100, Math.max(0, (amount / maxLoan) * 100));

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)]"
      style={{ borderColor: `${meta.color}55`, ["--bank" as string]: meta.color }}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        className="flex w-full items-stretch overflow-hidden text-left"
      >
        <div
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5"
          style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}cc)`, color: fg }}
        >
          <Building2 className="h-4 w-4 flex-none opacity-90" />
          <span className="truncate text-sm font-bold tracking-wide">Кредитен блок</span>
          <span className="opacity-70">›</span>
        </div>
        <div
          className="relative w-[38%] min-w-[120px] shrink-0 overflow-hidden"
          style={{ backgroundColor: meta.color }}
        >
          <div
            className="absolute inset-0 opacity-35"
            style={{
              background:
                "radial-gradient(circle at 70% 40%, rgba(255,255,255,0.45), transparent 55%)",
            }}
          />
          <div className="relative flex h-full items-center justify-end px-3 py-2">
            <span className="text-right text-[10px] font-bold uppercase leading-tight" style={{ color: fg }}>
              {meta.short ?? meta.name}
              <br />
              <span className="font-semibold opacity-80">клон</span>
            </span>
          </div>
        </div>
      </button>

      <div className="space-y-3 p-3">
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500">Избрана банка</span>
          <button
            type="button"
            onClick={onChangeBank}
            className="flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold"
              style={{ backgroundColor: meta.color, color: fg }}
            >
              {(meta.short ?? meta.name).slice(0, 3)}
            </span>
            <span className="flex-1 truncate">{data.bank}</span>
            <span className="text-zinc-400">▾</span>
          </button>
        </label>

        <div className="space-y-1.5">
          <div className="flex items-end justify-between gap-2">
            <label className="flex-1 space-y-1">
              <span className="text-[11px] font-semibold text-zinc-500">Сума на кредита</span>
              <input
                value={amount ? amount.toLocaleString("bg-BG") : ""}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\s/g, "").replace(",", ".")) || 0;
                  push({ amount: n });
                }}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[color:var(--bank)]"
              />
            </label>
            <span className="pb-2 text-sm font-semibold text-zinc-500">€</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Намали"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-600"
              onClick={() => push({ amount: Math.max(0, amount - 1000) })}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <div className="relative h-2 flex-1 rounded-full bg-zinc-100">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${sliderPct}%`, backgroundColor: meta.color }}
              />
              <input
                type="range"
                min={0}
                max={maxLoan}
                step={1000}
                value={amount}
                onChange={(e) => push({ amount: Number(e.target.value) })}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
              />
            </div>
            <button
              type="button"
              aria-label="Увеличи"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 text-zinc-600"
              onClick={() => push({ amount: amount + 1000 })}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-zinc-500">Самоучастие</span>
            <div className="flex items-center gap-1 rounded-xl border border-zinc-200 px-2 py-1.5">
              <input
                value={down ? down.toLocaleString("bg-BG") : ""}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\s/g, "").replace(",", ".")) || 0;
                  push({ downPayment: n });
                }}
                className="w-full bg-transparent text-sm font-semibold outline-none"
              />
              <span className="text-xs text-zinc-400">€</span>
            </div>
            <span className="text-[10px] text-zinc-400">{downPct.toFixed(1)}%</span>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-zinc-500">Срок</span>
            <select
              value={years}
              onChange={(e) => push({ years: Number(e.target.value) })}
              className="w-full rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm font-semibold outline-none"
            >
              {TERM_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y} години
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-zinc-500">Лихва</span>
            <select
              value={rate}
              onChange={(e) => push({ rate: Number(e.target.value) })}
              className="w-full rounded-xl border border-zinc-200 bg-white px-2 py-1.5 text-sm font-semibold outline-none"
            >
              {[rate, 2.25, 2.45, 2.75, 3.0, 3.25, 3.5]
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort((a, b) => a - b)
                .map((r) => (
                  <option key={r} value={r}>
                    {r.toFixed(2)}%
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
            >
              <Calculator className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500">
                Месечна вноска <Info className="h-3 w-3 opacity-50" />
              </div>
              <div className="truncate text-xl font-extrabold" style={{ color: meta.color }}>
                {payment.toLocaleString("bg-BG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                €
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-100 px-3 py-2.5">
            <div className="mb-1 text-[11px] font-semibold text-zinc-500">Условия по кредита</div>
            <ul className="space-y-1">
              {(meta.conditions ?? []).slice(0, 3).map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-[11px] leading-snug text-zinc-700">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-none" style={{ color: meta.color }} />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
