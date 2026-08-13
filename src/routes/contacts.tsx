import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { siteUrl } from "@/lib/site-config";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Контакти — Имоти Надежда" },
      { name: "description", content: "Свържете се с Имоти Надежда — телефон, имейл и офиси в Шумен, Варна и Бургас." },
      { property: "og:title", content: "Контакти — Имоти Надежда" },
      { property: "og:description", content: "Свържете се с нашия екип." },
      { property: "og:url", content: siteUrl("/contacts") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/contacts") }],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.message) {
      toast.error("Моля попълнете име и съобщение.");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("inquiries").insert({
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      message: form.message,
      source: "contacts_page",
      status: "new",
    } as never);
    setSending(false);
    if (error) {
      toast.error("Грешка при изпращане. Опитайте отново.");
      return;
    }
    toast.success("Изпратихте съобщението успешно. Ще се свържем скоро.");
    setForm({ name: "", email: "", phone: "", message: "" });
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#fbf6ea] to-white">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 md:px-8">
        <h1 className="font-display text-4xl text-[#8B1A2B] md:text-5xl">Контакти</h1>
        <p className="mt-2 text-[15px] text-[#2b1418]/80">Пишете ни, обадете се или заповядайте в офиса.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-[#C9A84C]/40 bg-white p-6">
            <div>
              <div className="text-xs uppercase tracking-widest text-[#2b1418]/60">Централен офис</div>
              <div className="mt-1 font-display text-lg text-[#8B1A2B]">гр. Шумен, ул. „Съединение" 5</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#2b1418]/60">Телефон</div>
              <a href="tel:+359899620262" className="mt-1 block font-display text-lg text-[#8B1A2B] hover:underline">+359 899 620 262</a>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#2b1418]/60">Имейл</div>
              <a href="mailto:office@nadezhda.bg" className="mt-1 block font-display text-lg text-[#8B1A2B] hover:underline">office@nadezhda.bg</a>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#2b1418]/60">Работно време</div>
              <div className="mt-1 text-sm text-[#2b1418]/80">Пон – Пет: 09:00 – 18:00<br/>Съб: 10:00 – 14:00</div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[#C9A84C]/40 bg-white p-6">
            <h2 className="font-display text-lg text-[#8B1A2B]">Изпратете съобщение</h2>
            <input required placeholder="Име" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-[#C9A84C]/40 bg-[#fbf6ea] px-3 py-2 text-sm text-[#2b1418] outline-none focus:border-[#8B1A2B]" />
            <input type="email" placeholder="Имейл" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-[#C9A84C]/40 bg-[#fbf6ea] px-3 py-2 text-sm text-[#2b1418] outline-none focus:border-[#8B1A2B]" />
            <input placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-lg border border-[#C9A84C]/40 bg-[#fbf6ea] px-3 py-2 text-sm text-[#2b1418] outline-none focus:border-[#8B1A2B]" />
            <textarea required rows={5} placeholder="Съобщение" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-lg border border-[#C9A84C]/40 bg-[#fbf6ea] px-3 py-2 text-sm text-[#2b1418] outline-none focus:border-[#8B1A2B]" />
            <button type="submit" disabled={sending}
              className="w-full rounded-lg bg-[#8B1A2B] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60">
              {sending ? "Изпращане…" : "Изпрати"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}