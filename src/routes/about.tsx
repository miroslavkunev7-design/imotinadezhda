import { createFileRoute } from "@tanstack/react-router";
import { LuxuryHeader } from "@/components/site/luxury-real-estate";
import { AGENCY, AGENCY_PHONES, buildTelUrl, buildWhatsAppUrl } from "@/lib/contact-config";
import aboutSofa from "@/assets/about-sofa.jpeg";
import logoNadezhda from "@/assets/logo-nadezhda-red.png";

import {
  ShieldCheck,
  Sparkles,
  UserCheck,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Home,
  Building2,
  Award,
  Key,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "За нас — Недвижими имоти Имоти Надежда" },
      {
        name: "description",
        content:
          "Доверен партньор за недвижими имоти в Шумен и региона. Професионализъм, сигурност и индивидуален подход при всяка сделка.",
      },
      { property: "og:title", content: "За нас — Имоти Надежда" },
      { property: "og:description", content: "Доверен партньор за недвижими имоти в Шумен и региона." },
      { property: "og:url", content: "https://imotinadezhda.lovable.app/about" },
    ],
    links: [
      { rel: "canonical", href: "https://imotinadezhda.lovable.app/about" },
    ],
  }),
  component: AboutPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-primary">Възникна грешка: {String(error)}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Страницата не е намерена.</div>,
});

const values = [
  {
    icon: UserCheck,
    title: "Професионализъм",
    text: "Екип от опитни консултанти на ваше разположение.",
  },
  {
    icon: ShieldCheck,
    title: "Сигурност",
    text: "Гарантираме безопасност при всяка сделка.",
  },
  {
    icon: Sparkles,
    title: "Индивидуален подход",
    text: "Намираме най-доброто решение според вашите нужди.",
  },
];

const stats = [
  { icon: Key, value: "85 000+", label: "имота под наем" },
  { icon: Home, value: "366+", label: "имота за продажба" },
  { icon: Building2, value: "2 500+", label: "имота за продажба" },
  { icon: Award, value: "15+", label: "години опит" },
];

function AboutPage() {
  return (
    <div className="luxury-page relative flex h-screen max-h-screen w-full flex-col overflow-hidden bg-background">
      <LuxuryHeader active="about" />

      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col overflow-hidden px-4 pt-4 pb-4 md:px-8 md:pt-6 md:pb-6">
        <div className="grid flex-1 grid-cols-1 gap-5 overflow-hidden lg:grid-cols-[1.05fr_1fr] lg:gap-7">
          {/* Burgundy info card */}
          <article className="marble-dark-panel relative overflow-y-auto rounded-3xl ring-1 ring-[#C9A84C]/40">
            {/* Gold corner ornaments */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-4 top-4 h-10 w-10 rounded-tl-2xl border-l-2 border-t-2 border-[#C9A84C]/70" />
              <div className="absolute right-4 top-4 h-10 w-10 rounded-tr-2xl border-r-2 border-t-2 border-[#C9A84C]/70" />
              <div className="absolute bottom-4 left-4 h-10 w-10 rounded-bl-2xl border-b-2 border-l-2 border-[#C9A84C]/70" />
              <div className="absolute bottom-4 right-4 h-10 w-10 rounded-br-2xl border-b-2 border-r-2 border-[#C9A84C]/70" />
            </div>

            <div className="relative p-6 md:p-8">
              <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[#C9A84C]">Запознай се</p>
              <h1 className="mt-1 font-display text-3xl text-[#C9A84C] md:text-4xl">За нас</h1>
              <div className="mt-3 h-px w-24 bg-gradient-to-r from-[#C9A84C] to-transparent" />
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-[#fdf6e3]/90 md:text-[15px]">
                Недвижими имоти <span className="text-[#C9A84C]">Имоти Надежда</span> е доверен партньор в
                сферата на недвижимите имоти в Шумен и региона. Работим с мисията да предоставяме
                най-доброто обслужване, лоялност и сигурност при всяка сделка.
              </p>

              <ul className="mt-6 space-y-4">
                {values.map((v) => (
                  <li key={v.title} className="flex items-start gap-4">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C9A84C]/60 bg-[#C9A84C]/10 text-[#C9A84C]">
                      <v.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-display text-base text-[#C9A84C] md:text-lg">{v.title}</div>
                      <div className="text-sm text-[#fdf6e3]/85">{v.text}</div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Contact block */}
              <div className="mt-6 grid gap-3 rounded-2xl border border-[#C9A84C]/35 bg-[#5e0f1d]/45 p-4">
                <div className="font-display text-sm uppercase tracking-[0.2em] text-[#C9A84C]">Свържете се с нас</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AGENCY_PHONES.map((p) => (
                    <div key={p.tel} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#5e0f1d]/60 px-3 py-2">
                      <a
                        href={buildTelUrl(p.tel)}
                        className="inline-flex items-center gap-2 text-sm text-[#fdf6e3] hover:text-[#C9A84C]"
                      >
                        <Phone className="h-4 w-4 text-[#C9A84C]" />
                        {p.display}
                      </a>
                      <a
                        href={buildWhatsAppUrl("Здравейте, имам въпрос относно имот.", p.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-[#C9A84C]/50 px-2.5 py-1 text-xs text-[#C9A84C] hover:bg-[#C9A84C]/15"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-[#fdf6e3]/85 md:text-sm">
                  <a href={`mailto:${AGENCY.email}`} className="inline-flex items-center gap-2 hover:text-[#C9A84C]">
                    <Mail className="h-4 w-4 text-[#C9A84C]" /> {AGENCY.email}
                  </a>
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#C9A84C]" /> {AGENCY.address}
                  </span>
                </div>
              </div>
            </div>
          </article>

          {/* Sofa image with logo plaque */}
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-[#C9A84C]/40 shadow-[0_30px_80px_-30px_rgba(139,26,43,0.45)]">
            <img
              src={aboutSofa}
              alt="Луксозен интериор Имоти Надежда"
              className="h-full w-full object-cover"
              loading="lazy"
              width={1280}
              height={896}
            />
            <div className="absolute right-4 top-4 rounded-xl bg-white/90 px-3 py-2 ring-1 ring-[#C9A84C]/50 backdrop-blur md:right-6 md:top-6">
              <img src={logoNadezhda} alt="Имоти Надежда" className="h-10 w-auto md:h-12" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <section className="mt-4 grid flex-none grid-cols-2 gap-3 rounded-2xl border border-[#C9A84C]/45 bg-[#fbf6ea] p-4 md:mt-5 md:grid-cols-4 md:gap-6 md:p-5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3 md:flex-col md:items-center md:text-center">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8B1A2B]/10 text-[#8B1A2B] md:h-11 md:w-11">
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-xl text-[#8B1A2B] md:text-2xl">{s.value}</div>
                <div className="text-xs text-[#2b1418]/75 md:text-sm">{s.label}</div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
