import { useMemo, useState } from "react";
import { Calculator, ExternalLink, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AGENCY, buildTelUrl, buildWhatsAppUrl, calcMonthlyPayment } from "@/lib/contact-config";

export function MortgageCalculator({ price, currency = "EUR", propertyTitle }: { price: number; currency?: string; propertyTitle?: string }) {
  const [down, setDown] = useState(Math.round(price * 0.2));
  const [years, setYears] = useState(25);
  const [rate, setRate] = useState(3.2);

  const principal = Math.max(0, price - down);
  const monthly = useMemo(() => calcMonthlyPayment(principal, rate, years), [principal, rate, years]);
  const total = monthly * years * 12;
  const interest = total - principal;

  const fmt = (n: number) =>
    `${currency === "EUR" ? "€" : currency === "BGN" ? "лв." : currency} ${new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 0 }).format(Math.round(n))}`;

  const waMsg = `Здравейте! Интересувам се от ипотечен кредит за имот${propertyTitle ? ` "${propertyTitle}"` : ""}. Цена: ${fmt(price)}, самоучастие: ${fmt(down)}, срок: ${years} години.`;

  return (
    <div className="marble-dark-panel space-y-4 rounded-[20px] p-5 text-primary-foreground shadow-[0_22px_45px_rgba(60,10,20,0.3)]">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-[1.6rem] leading-none text-primary-foreground">Ипотечен калкулатор</div>
          <div className="mt-1 text-sm text-primary/85">Ориентировъчна месечна вноска</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label={`Самоучастие: ${fmt(down)}`} min={0} max={Math.round(price * 0.9)} step={1000} value={down} onChange={setDown} />
        <Slider label={`Срок: ${years} години`} min={5} max={35} step={1} value={years} onChange={setYears} />
        <Slider label={`Лихва: ${rate.toFixed(2)}%`} min={1} max={8} step={0.1} value={rate} onChange={(v) => setRate(Number(v.toFixed(2)))} />
        <div className="flex flex-col gap-1 rounded-[14px] border border-primary/25 bg-background/8 px-4 py-3">
          <span className="text-sm text-primary/85">Кредит</span>
          <span className="font-display text-xl">{fmt(principal)}</span>
        </div>
      </div>

      <div className="rounded-[16px] border border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-amber-300/5 p-4">
        <div className="text-sm text-primary/85">Месечна вноска</div>
        <div className="mt-1 font-display text-[2.6rem] leading-none text-amber-200">{fmt(monthly)}</div>
        <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-primary/80">
          <div>Общо за периода: <strong className="text-primary-foreground">{fmt(total)}</strong></div>
          <div>Лихви: <strong className="text-primary-foreground">{fmt(interest)}</strong></div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button asChild className="gold-cta-button h-12 rounded-[12px] text-sm">
          <a href={AGENCY.mortgagePartnerUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" /> Вземи кредит
          </a>
        </Button>
        <Button asChild variant="outline" className="marble-action-button h-12 rounded-[12px] border-primary/30 bg-transparent text-sm text-primary-foreground">
          <a href={buildTelUrl()}>
            <Phone className="h-4 w-4" /> Обади се
          </a>
        </Button>
        <Button asChild variant="outline" className="marble-action-button h-12 rounded-[12px] border-emerald-400/40 bg-emerald-500/10 text-sm text-primary-foreground hover:bg-emerald-500/20">
          <a href={buildWhatsAppUrl(waMsg)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        </Button>
      </div>
      <p className="text-[11px] text-primary/60">
        * Изчисленията са ориентировъчни. Финалните условия зависят от одобрението на банката.
      </p>
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 rounded-[14px] border border-primary/25 bg-background/8 px-4 py-3">
      <span className="text-sm text-primary/85">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[var(--color-primary)]" />
    </label>
  );
}
