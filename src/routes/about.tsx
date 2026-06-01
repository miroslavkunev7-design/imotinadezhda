import { createFileRoute } from "@tanstack/react-router";
import { LuxuryHeader } from "@/components/site/luxury-real-estate";
import { AGENCY, AGENCY_PHONES, buildTelUrl, buildWhatsAppUrl } from "@/lib/contact-config";
import aboutSofa from "@/assets/about-sofa.jpeg";
import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import marbleBg from "@/assets/marble-bg.png";
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
      { title: "За нас — Недвижими имоти ИЛДЖ.ИА" },
      {
        name: "description",
        content:
          "Доверен партньор за недвижими имоти в Бургас и региона. Професионализъм, сигурност и индивидуален подход при всяка сделка.",
      },
      { property: "og:title", content: "За нас — ИЛДЖ.ИА" },
      { property: "og:description", content: "Доверен партньор за недвижими имоти в Бургас и региона." },
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
    <div
      className="relative min-h-screen w-full overflow-hidden bg-secondary"
      style={{
        backgroundImage: `url(${marbleBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <LuxuryHeader active="about" />

      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pt-6 pb-10 md:px-10 md:pt-10 md:pb-16">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
          {/* Burgundy info card */}
          <article className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-[0_30px_80px_-30px_rgba(80,12,20,0.55)] ring-1 ring-[hsl(var(--gold))]/30">
            {/* Gold corner ornaments */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-4 top-4 h-10 w-10 border-l-2 border-t-2 border-[hsl(var(--gold))]/70 rounded-tl-2xl" />
              <div className="absolute right-4 top-4 h-10 w-10 border-r-2 border-t-2 border-[hsl(var(--gold))]/70 rounded-tr-2xl" />
              <div className="absolute left-4 bottom-4 h-10 w-10 border-l-2 border-b-2 border-[hsl(var(--gold))]/70 rounded-bl-2xl" />
              <div className="absolute right-4 bottom-4 h-10 w-10 border-r-2 border-b-2 border-[hsl(var(--gold))]/70 rounded-br-2xl" />
            </div>

            <div className="relative p-6 md:p-10">
              <h1 className="font-display text-3xl text-[hsl(var(--gold))] md:text-4xl">За нас</h1>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-primary-foreground/90 md:text-base">
                Недвижими имоти <span className="text-[hsl(var(--gold))]">ИЛДЖ.ИА</span> е доверен партньор в
                сферата на недвижимите имоти в Бургас и региона. Работим с мисията да предоставяме на
                нашите клиенти най-доброто обслужване, лоялност и сигурност при всяка сделка.
              </p>

              <ul className="mt-8 space-y-5">
                {values.map((v) => (
                  <li key={v.title} className="flex items-start gap-4">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--gold))]/60 bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))]">
                      <v.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="font-display text-base text-[hsl(var(--gold))] md:text-lg">
                        {v.title}
                      </div>
                      <div className="text-sm text-primary-foreground/85">{v.text}</div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Contact block */}
              <div className="mt-8 grid gap-3 rounded-2xl border border-[hsl(var(--gold))]/30 bg-black/15 p-4 md:p-5">
                <div className="font-display text-sm text-[hsl(var(--gold))] md:text-base">Свържете се с нас</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {AGENCY_PHONES.map((p) => (
                    <div key={p.tel} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/20 px-3 py-2">
                      <a
                        href={buildTelUrl(p.tel)}
                        className="inline-flex items-center gap-2 text-sm text-primary-foreground hover:text-[hsl(var(--gold))]"
                      >
                        <Phone className="h-4 w-4 text-[hsl(var(--gold))]" />
                        {p.display}
                      </a>
                      <a
                        href={buildWhatsAppUrl("Здравейте, имам въпрос относно имот.", p.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--gold))]/50 px-2.5 py-1 text-xs text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/15"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-primary-foreground/85 md:text-sm">
                  <a href={`mailto:${AGENCY.email}`} className="inline-flex items-center gap-2 hover:text-[hsl(var(--gold))]">
                    <Mail className="h-4 w-4 text-[hsl(var(--gold))]" /> {AGENCY.email}
                  </a>
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[hsl(var(--gold))]" /> {AGENCY.address}
                  </span>
                </div>
              </div>
            </div>
          </article>

          {/* Sofa image with logo plaque */}
          <div className="relative overflow-hidden rounded-3xl ring-1 ring-[hsl(var(--gold))]/30 shadow-[0_30px_80px_-30px_rgba(80,12,20,0.45)]">
            <img
              src={aboutSofa}
              alt="Луксозен интериор ИЛДЖ.ИА"
              className="h-full w-full object-cover"
              loading="lazy"
              width={1280}
              height={896}
            />
            <div className="absolute right-4 top-4 rounded-xl bg-secondary/85 px-3 py-2 ring-1 ring-[hsl(var(--gold))]/40 backdrop-blur md:right-6 md:top-6">
              <img src={logoNadezhda} alt="ИЛДЖ.ИА" className="h-10 w-auto md:h-14" />
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <section className="mt-8 grid grid-cols-2 gap-3 rounded-2xl border border-[hsl(var(--gold))]/40 bg-secondary/80 p-4 backdrop-blur md:mt-10 md:grid-cols-4 md:gap-6 md:p-6">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3 md:flex-col md:items-center md:text-center">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary md:h-12 md:w-12">
                <s.icon className="h-5 w-5 md:h-6 md:w-6" />
              </span>
              <div>
                <div className="font-display text-xl text-primary md:text-3xl">{s.value}</div>
                <div className="text-xs text-primary/80 md:text-sm">{s.label}</div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
