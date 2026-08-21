import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/site-header";
import { PAGE_SEO, siteUrl } from "@/lib/site-config";
import { SiteSeoFooter } from "@/components/site/site-seo-footer";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: PAGE_SEO.about.title },
      { name: "description", content: PAGE_SEO.about.description },
      { property: "og:title", content: PAGE_SEO.about.title },
      { property: "og:description", content: PAGE_SEO.about.description },
      { property: "og:url", content: siteUrl("/about") },
    ],
    links: [{ rel: "canonical", href: siteUrl("/about") }],
  }),
  component: AboutPage,
});

const STATS = [
  { value: "15+", label: "Години опит" },
  { value: "2 500+", label: "Успешни сделки" },
  { value: "85 000+", label: "Имота под наем" },
  { value: "4", label: "Града" },
];

const TEAM = [
  { name: "Надежда Илджева", role: "Управител", phone: "+359 899 620 262", email: "agenciq_nadejdi@abv.bg" },
  { name: "Мирослав Кънев", role: "Старши консултант", phone: "+359 899 620 262", email: "office@nadezhda.bg" },
  { name: "Мария Иванова", role: "Консултант", phone: "+359 88 123 4567", email: "m.ivanova@nadezhda.bg" },
  { name: "Георги Николаев", role: "Консултант", phone: "+359 89 456 7890", email: "g.nikolaev@nadezhda.bg" },
];

function AboutPage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#fbf6ea] to-white">
      <SiteHeader active="about" />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-8">
        <section className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.32em] text-[#C9A84C]">Имоти Надежда</p>
            <h1 className="mt-2 font-display text-4xl text-[#8B1A2B] md:text-5xl">За нас — Имоти Надежда</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#2b1418]/85">
              Имоти Надежда е водеща агенция за недвижими имоти в Шумен, Варна, Бургас и Нови пазар.
              Предлагаме пълно съдействие при покупка, продажба и наем на имоти с индивидуален
              подход и грижа за всеки клиент.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-[#2b1418]/85">
              {[
                "Персонален консултант за всеки клиент",
                "360° виртуални турове на имоти",
                "Пълна правна и финансова подкрепа",
                "Гарантирана безопасност на сделката",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 flex-none rounded-full bg-[#C9A84C]" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-[#8B1A2B] to-[#5e0f1d] shadow-[0_30px_80px_-30px_rgba(139,26,43,0.5)]" />
        </section>

        <div className="mt-12 grid grid-cols-2 gap-3 rounded-2xl border border-[#C9A84C]/40 bg-white p-6 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display text-3xl font-bold text-[#8B1A2B] md:text-4xl">{s.value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-[#2b1418]/60">{s.label}</div>
            </div>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="font-display text-2xl text-[#8B1A2B] md:text-3xl">Нашите консултанти</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((p) => (
              <div key={p.name} className="rounded-2xl border border-[#C9A84C]/40 bg-white p-5 shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#8B1A2B]/10">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth={1.5}>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                </div>
                <h3 className="mt-3 text-center font-display text-base text-[#8B1A2B]">{p.name}</h3>
                <p className="text-center text-xs text-[#2b1418]/60">{p.role}</p>
                <div className="mt-3 space-y-1 text-center text-xs">
                  <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="block text-[#8B1A2B] hover:underline">{p.phone}</a>
                  <a href={`mailto:${p.email}`} className="block text-[#2b1418]/70 hover:underline">{p.email}</a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <SiteSeoFooter />
    </div>
  );
}