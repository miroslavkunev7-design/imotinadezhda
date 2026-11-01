import { useState, type FormEvent } from "react";
import { Mail, Phone } from "lucide-react";

import { AGENCY } from "@/lib/contact-config";
import { submitInquiry } from "@/lib/catalog.functions";
import { cn } from "@/lib/utils";

type PropertyInquiryFormProps = {
  propertyId?: string;
  propertyTitle?: string;
  compact?: boolean;
};

export function PropertyInquiryForm({
  propertyId,
  propertyTitle,
  compact = false,
}: PropertyInquiryFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    propertyTitle ? `Здравейте, интересувам се от "${propertyTitle}". ` : "",
  );
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      await submitInquiry({
        data: {
          property_id: propertyId ?? null,
          name,
          email,
          phone: phone || undefined,
          message: message || undefined,
        },
      });

      try {
        const params = new URLSearchParams(window.location.search);
        await fetch("/api/public/leads/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: name,
            email,
            phone: phone || null,
            message: message || null,
            channel: propertyId ? "property_page" : "website",
            source: document.referrer || "imotinadezhda.bg",
            property_id: propertyId ?? null,
            utm_source: params.get("utm_source"),
            utm_medium: params.get("utm_medium"),
            utm_campaign: params.get("utm_campaign"),
            referrer: document.referrer || null,
            landing_path: window.location.pathname,
          }),
        });
      } catch {
        // CRM lead automation is supplementary; the persisted inquiry is authoritative.
      }

      setStatus("ok");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Грешка при изпращане");
    }
  };

  return (
    <aside
      className={cn(
        "marble-dark-panel space-y-4 text-primary-foreground shadow-[0_22px_45px_rgba(139,26,43,0.3)]",
        compact ? "rounded-2xl p-4" : "rounded-[20px] p-5",
      )}
    >
      <div>
        <div
          className={cn(
            "font-display leading-none text-primary-foreground",
            compact ? "text-2xl" : "text-[1.8rem]",
          )}
        >
          Изпрати запитване
        </div>
        <div className="mt-1 text-sm text-primary/85">
          Ще се свържем с вас възможно най-бързо.
        </div>
      </div>

      {status === "ok" ? (
        <div role="status" className="rounded-[14px] bg-primary-foreground/10 p-4 text-base">
          Благодарим! Получихме запитването ви.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Име"
            className="w-full rounded-xl border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60"
          />
          <input
            required
            type="email"
            maxLength={200}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Имейл"
            className="w-full rounded-xl border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60"
          />
          <input
            type="tel"
            maxLength={40}
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Телефон (по избор)"
            className="w-full rounded-xl border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60"
          />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Съобщение"
            maxLength={2000}
            rows={compact ? 3 : 4}
            className="w-full rounded-xl border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60"
          />
          {error ? (
            <div role="alert" className="text-sm text-destructive-foreground">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={status === "sending"}
            className="gold-cta-button flex h-13 w-full items-center justify-center rounded-xl px-4 text-base font-bold disabled:opacity-60"
          >
            {status === "sending" ? "Изпращане…" : "Изпрати запитване"}
          </button>
        </form>
      )}

      <div className="space-y-2 border-t border-primary/15 pt-3 text-sm">
        <a href={`tel:${AGENCY.phone}`} className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-primary" />
          {AGENCY.phoneDisplay}
        </a>
        <a href={`mailto:${AGENCY.email}`} className="flex items-center gap-3 break-all">
          <Mail className="h-5 w-5 text-primary" />
          {AGENCY.email}
        </a>
      </div>
    </aside>
  );
}
