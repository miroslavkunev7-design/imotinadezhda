import { useState } from "react";
import { X, Send, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MORTGAGE_PARTNERS } from "@/lib/contact-config";
import { toast } from "sonner";

type ClientLite = {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: string | null;
  notes?: string | null;
};

export function MortgageSendModal({ client, onClose }: { client: ClientLite; onClose: () => void }) {
  const [extra, setExtra] = useState("");

  const sendTo = (partner: (typeof MORTGAGE_PARTNERS)[number]) => {
    if (!partner.email) {
      toast.error(`Имейлът на ${partner.name} още не е добавен`);
      return;
    }
    const subject = `Кандидатура за ипотечен кредит — ${client.full_name}`;
    const lines = [
      `Здравей, ${partner.name},`,
      "",
      "Изпращам Ви клиент за ипотечен кредит:",
      "",
      `Име: ${client.full_name}`,
      client.phone ? `Телефон: ${client.phone}` : null,
      client.email ? `Имейл: ${client.email}` : null,
      client.budget_min || client.budget_max
        ? `Бюджет: ${client.budget_min ?? "?"} – ${client.budget_max ?? "?"} ${client.currency ?? "EUR"}`
        : null,
      client.notes ? `\nБележки: ${client.notes}` : null,
      extra ? `\nДопълнително:\n${extra}` : null,
      "",
      "Поздрави,",
      "Имоти Надежда",
    ].filter(Boolean).join("\n");
    const href = `mailto:${partner.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
    window.location.href = href;
    toast.success(`Отворено е писмо до ${partner.name}`);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl border border-amber-500/30 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-primary/15 bg-gradient-to-r from-[#66081c] to-[#4a0613] px-5 py-4 text-amber-100">
          <div>
            <div className="font-display text-xl">Пусни кандидатура за кредит</div>
            <div className="text-xs text-amber-200/80">{client.full_name}</div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Допълнителен коментар (по избор)</span>
            <textarea
              rows={3}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="Напр. желан размер на кредита, срок, специфики…"
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {MORTGAGE_PARTNERS.map((p) => (
              <Button key={p.id} onClick={() => sendTo(p)} className="gold-cta-button h-auto justify-start py-3">
                <Send className="h-4 w-4" />
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-semibold">Изпрати към {p.name}</span>
                  <span className="text-[10px] opacity-80"><Mail className="mr-1 inline h-3 w-3" />{p.email}</span>
                </div>
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            * Скоро ще се изпраща автоматично през сървърен имейл. Засега отваря Вашия имейл клиент с предварително попълнено съобщение.
          </p>
        </div>
      </div>
    </div>
  );
}
