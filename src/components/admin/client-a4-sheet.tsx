import { X, Phone, Mail, Calendar, Printer, User } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Широк A4 тефтер (лежащ формат 297×210) за един клиент.
 * Ляво: клиентско поле с данните. Заглавие: Име – Фамилия – Телефон.
 */
export function ClientA4Sheet({ client, onClose }: { client: any; onClose: () => void }) {
  if (!client) return null;

  const parts = String(client.full_name ?? "")
    .trim()
    .split(/\s+/);
  const firstName = parts[0] ?? "—";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
  const phone = client.phone ?? "—";

  const fmt = (v?: string | null) =>
    v
      ? new Date(v).toLocaleDateString("bg-BG", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  const criteria: string[] = [
    client.desired_type,
    client.desired_city,
    client.desired_rooms ? `${client.desired_rooms} стаи` : null,
    client.budget_max ? `до ${Number(client.budget_max).toLocaleString("bg-BG")} EUR` : null,
  ].filter(Boolean) as string[];

  return (
    <div
      className="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-[#8B1A2B]/55 p-4 pb-24 sm:items-center sm:pb-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[1180px] rounded-2xl bg-[#f7f2e6] p-4 shadow-2xl sm:p-6"
      >
        {/* Заглавна лента */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="handwriting text-3xl leading-tight text-[#3c141a] sm:text-4xl">
              {firstName}
              {lastName ? <span className="text-[#7a1226]"> {lastName}</span> : null}
              <span className="text-[#3c141a]/40"> — </span>
              <span className="text-[#7a1226]">{phone}</span>
            </h2>
            <p className="text-xs uppercase tracking-[0.25em] text-[#3c141a]/50">
              Клиентски лист · A4
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> Печат
            </Button>
            <button onClick={onClose} aria-label="Затвори" className="text-[#3c141a]">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Самият A4 лист — лежащ формат */}
        <div className="relative w-full overflow-hidden rounded-xl border border-[#3c141a]/15 bg-[#fffdf6] shadow-[0_25px_45px_-20px_rgba(0,0,0,0.55)] sm:aspect-[297/210]">
          <div className="grid h-full grid-cols-1 sm:grid-cols-[minmax(260px,32%)_1fr]">
            {/* Ляво клиентско поле */}
            <aside className="border-b border-[#3c141a]/10 bg-[#f3ead6] p-5 sm:border-b-0 sm:border-r">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#7a1226] text-lg font-bold text-[#F6D98A]">
                  {(firstName[0] ?? "?").toUpperCase()}
                  {(lastName[0] ?? "").toUpperCase()}
                </div>
                <div>
                  <div className="handwriting text-2xl leading-none text-[#3c141a]">
                    {client.full_name}
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-[#3c141a]/50">
                    Клиент
                  </div>
                </div>
              </div>

              <dl className="space-y-3 text-sm text-[#3c141a]">
                <Row
                  icon={<Phone className="h-4 w-4 opacity-50" />}
                  label="Телефон"
                  value={phone}
                />
                <Row
                  icon={<Mail className="h-4 w-4 opacity-50" />}
                  label="Имейл"
                  value={client.email ?? "—"}
                />
                <Row
                  icon={<Calendar className="h-4 w-4 opacity-50" />}
                  label="Първи контакт"
                  value={fmt(client.created_at)}
                />
                <Row
                  icon={<User className="h-4 w-4 opacity-50" />}
                  label="Статус"
                  value={client.status ?? "—"}
                />
              </dl>

              <div className="mt-5 border-t border-[#3c141a]/10 pt-4">
                <div className="mb-1 text-[11px] uppercase tracking-widest text-[#3c141a]/50">
                  Депозит
                </div>
                <div className="handwriting text-xl text-[#7a1226]">
                  {client.deposit_amount
                    ? `${Number(client.deposit_amount).toLocaleString("bg-BG")} ${client.deposit_currency ?? "EUR"}`
                    : "няма"}
                </div>
                {client.deposit_date && (
                  <div className="text-xs text-[#3c141a]/60">от {fmt(client.deposit_date)}</div>
                )}
              </div>

              {client.mortgage_data?.bank && (
                <div className="mt-4 rounded-lg border border-[#7a1226]/20 bg-white/60 p-3">
                  <div className="text-[11px] uppercase tracking-widest text-[#3c141a]/50">
                    Банка
                  </div>
                  <div className="handwriting text-lg text-[#3c141a]">
                    {client.mortgage_data.bank}
                  </div>
                </div>
              )}
            </aside>

            {/* Дясна част — редове на тефтера */}
            <section className="relative h-full overflow-y-auto p-6">
              <div
                className="pointer-events-none absolute inset-0 opacity-45"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, transparent 0 31px, rgba(60,20,26,0.12) 31px 32px)",
                }}
              />
              <div className="relative">
                <Block title="Търси">
                  {criteria.length ? (
                    <ul className="handwriting space-y-1 text-lg">
                      {criteria.map((c, i) => (
                        <li key={i}>– {c}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="handwriting text-lg opacity-70">– Няма въведени критерии</p>
                  )}
                </Block>

                <Block title="Харесал имот">
                  <p className="handwriting text-lg opacity-85">{client.interest_note || "—"}</p>
                </Block>

                <Block title="Бележки">
                  <p className="handwriting whitespace-pre-line text-lg opacity-85">
                    {client.notes || "—"}
                  </p>
                </Block>

                <Block title="Свободно поле">
                  <div className="h-24" />
                </Block>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">{icon}</span>
      <div>
        <dt className="text-[11px] uppercase tracking-widest text-[#3c141a]/50">{label}</dt>
        <dd className="handwriting text-lg leading-tight">{value}</dd>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="handwriting mb-1 text-xl font-bold text-[#3c141a] underline decoration-[#3c141a]/20 underline-offset-4">
        {title}:
      </h3>
      <div className="text-[#3c141a]">{children}</div>
    </div>
  );
}
