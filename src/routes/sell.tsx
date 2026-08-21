import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PAGE_SEO, siteUrl } from "@/lib/site-config";
import { SiteSeoFooter } from "@/components/site/site-seo-footer";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: PAGE_SEO.sell.title },
      { name: "description", content: PAGE_SEO.sell.description },
      { property: "og:title", content: PAGE_SEO.sell.title },
      { property: "og:description", content: PAGE_SEO.sell.description },
      { property: "og:url", content: siteUrl("/sell") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/sell") }],
  }),
  component: SellPage,
});

const PROPERTY_TYPES = ["Апартамент", "Къща", "Парцел", "Офис", "Магазин", "Гараж", "Друго"];
const CITIES = ["Шумен", "Варна", "Бургас", "Нови пазар"];

function SellPage() {
  const [form, setForm] = useState({
    name: "", phone: "", email: "",
    city: CITIES[0], quarter: "", property_type: PROPERTY_TYPES[0],
    area: "", price: "", description: "",
  });
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast.error("Моля попълнете име и телефон.");
      return;
    }
    setSending(true);
    const message = [
      `Продажба — ${form.property_type} в ${form.city}${form.quarter ? ", " + form.quarter : ""}`,
      form.area && `Площ: ${form.area} м²`,
      form.price && `Очаквана цена: ${form.price} €`,
      form.description && `Описание: ${form.description}`,
    ].filter(Boolean).join("\n");
    const res = await fetch("/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        message,
        source: "sell",
        channel: "web",
        page_url: "/sell",
      }),
    });
    setSending(false);
    if (!res.ok) {
      toast.error("Грешка при изпращане. Опитайте отново.");
      return;
    }
    toast.success("Заявката е изпратена. Ще се свържем с Вас за безплатна оценка.");
    setForm({ ...form, name: "", phone: "", email: "", quarter: "", area: "", price: "", description: "" });
  }

  const inputCls = "w-full rounded-lg border border-[#C9A84C]/40 bg-[#fbf6ea] px-3 py-2 text-sm text-[#2b1418] outline-none focus:border-[#8B1A2B]";

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#fbf6ea] to-white">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 md:px-8">
        <h1 className="font-display text-4xl text-[#8B1A2B] md:text-5xl">Продай имот с Имоти Надежда</h1>
        <p className="mt-2 text-[15px] text-[#2b1418]/80">
          Попълнете формата — екипът на Имоти Надежда ще се свърже с Вас за безплатна оценка и публикуване на обявата в Шумен, Варна, Бургас или Нови пазар.
        </p>

        <form onSubmit={submit} className="mt-8 grid gap-3 rounded-2xl border border-[#C9A84C]/40 bg-white p-6 sm:grid-cols-2">
          <input required placeholder="Име *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          <input required placeholder="Телефон *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
          <input type="email" placeholder="Имейл" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${inputCls} sm:col-span-2`} />

          <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls}>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="Квартал" value={form.quarter} onChange={(e) => setForm({ ...form, quarter: e.target.value })} className={inputCls} />

          <select value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })} className={inputCls}>
            {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input type="number" placeholder="Площ (м²)" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className={inputCls} />

          <input type="number" placeholder="Очаквана цена (€)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`${inputCls} sm:col-span-2`} />
          <textarea rows={4} placeholder="Кратко описание" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} sm:col-span-2`} />

          <button type="submit" disabled={sending} className="sm:col-span-2 rounded-lg bg-[#8B1A2B] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60">
            {sending ? "Изпращане…" : "Изпрати за оценка"}
          </button>
        </form>
      </div>
      <SiteSeoFooter />
    </div>
  );
}