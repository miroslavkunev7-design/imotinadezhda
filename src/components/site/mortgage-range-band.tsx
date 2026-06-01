import { useState } from "react";
import { Calculator, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calcMonthlyPayment } from "@/lib/contact-config";
import { MortgageApplyModal } from "./mortgage-apply-modal";

export function MortgageRangeBand({
  price,
  currency = "EUR",
  propertyId,
  propertyTitle,
  downPaymentPct = 0.2,
  rate = 3.2,
}: {
  price: number;
  currency?: string;
  propertyId?: string;
  propertyTitle?: string;
  downPaymentPct?: number;
  rate?: number;
}) {
  const [open, setOpen] = useState(false);
  const principal = Math.max(0, price - price * downPaymentPct);

  // Аннуитет: повече години → по-малка месечна вноска.
  // Затова "от" = 30 години (по-малка), "до" = 20 години (по-голяма).
  const monthlyMin = calcMonthlyPayment(principal, rate, 30);
  const monthlyMax = calcMonthlyPayment(principal, rate, 20);

  const fmt = (n: number) => {
    const symbol = currency === "EUR" ? "€" : currency === "BGN" ? "лв." : currency;
    return `${symbol} ${new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 0 }).format(Math.round(n))}`;
  };

  return (
    <>
      <div className="marble-dark-panel overflow-hidden rounded-[20px] p-5 text-primary-foreground shadow-[0_22px_45px_rgba(60,10,20,0.3)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-amber-950 shadow-[0_8px_20px_rgba(180,120,20,0.4)]">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-primary/70">Месечна вноска</div>
              <div className="font-display text-[2rem] leading-tight text-amber-200 md:text-[2.4rem]">
                от {fmt(monthlyMin)} до {fmt(monthlyMax)}
              </div>
              <div className="mt-1 text-xs text-primary/75">
                При 20% самоучастие, лихва {rate.toFixed(2)}%, срок 20–30 години
              </div>
            </div>
          </div>
          <Button
            onClick={() => setOpen(true)}
            className="gold-cta-button h-14 rounded-[14px] px-6 text-sm md:text-base"
          >
            Кандидатствай за ипотечен кредит <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
      <MortgageApplyModal
        open={open}
        onClose={() => setOpen(false)}
        propertyId={propertyId}
        propertyTitle={propertyTitle}
      />
    </>
  );
}
