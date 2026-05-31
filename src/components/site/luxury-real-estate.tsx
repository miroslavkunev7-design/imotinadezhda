import { useState as useReactState, useRef } from "react";
import { Link } from "@tanstack/react-router";

import {
  Bath,
  BedDouble,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  House,
  LandPlot,
  Mail,
  MapPin,
  Phone,
  Ruler,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trees,
  User,
  Box,
} from "lucide-react";

import burgasHero from "@/assets/burgas-hero.jpeg";
import burgasPier from "@/assets/burgas-pier.jpeg";
import burgundyTerrace from "@/assets/burgundy-terrace-hero.jpeg";
import homeHero from "@/assets/home-hero-living.jpeg";
import cityShumen from "@/assets/city-shumen.jpeg";
import cityBurgas from "@/assets/city-burgas.jpeg";
import cityVarna from "@/assets/city-varna.jpeg";
import cityNoviPazar from "@/assets/city-novi-pazar.jpeg";
import marbleBg from "@/assets/marble-bg.png";
import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import headerPanel from "@/assets/site-header-panel.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavKey = "sale" | "rent" | "about";

const topNav = [
  { key: "sale" as const, label: "За продажба" },
  { key: "rent" as const, label: "Под наем" },
  { key: "about" as const, label: "За нас" },
];

export const citySlugImages: Record<string, string> = {
  shumen: cityShumen,
  burgas: cityBurgas,
  varna: cityVarna,
  "novi-pazar": cityNoviPazar,
};

const homeCities: Array<{ name: string; image: string; href: "/cities/$slug"; params: { slug: string } }> = [
  { name: "Шумен", image: cityShumen, href: "/cities/$slug", params: { slug: "shumen" } },
  { name: "Варна", image: cityVarna, href: "/cities/$slug", params: { slug: "varna" } },
  { name: "Бургас", image: cityBurgas, href: "/cities/$slug", params: { slug: "burgas" } },
  { name: "Нов пазар", image: cityNoviPazar, href: "/cities/$slug", params: { slug: "novi-pazar" } },
];

const burgasDistricts = [
  { name: "Лазур", count: 312, image: burgasHero },
  { name: "Славейков", count: 278, image: homeHero },
  { name: "Изгрев", count: 185, image: burgasHero },
  { name: "Възраждане", count: 246, image: homeHero },
  { name: "Център", count: 164, image: burgasHero },
];

const listingCards = [
  { title: "Тристаен апартамент", price: "€ 245 000", size: "110 m²", beds: 3, baths: 2, image: burgasHero, tag: "НОВО" },
  { title: "Четиристаен апартамент", price: "€ 310 000", size: "140 m²", beds: 3, baths: 2, image: homeHero, tag: "ТОП ОФЕРТА" },
  { title: "Двустаен апартамент", price: "€ 168 000", size: "75 m²", beds: 1, baths: 1, image: burgasHero, tag: "" },
  { title: "Многостаен апартамент", price: "€ 420 000", size: "178 m²", beds: 4, baths: 3, image: homeHero, tag: "" },
];

const propertyThumbs = [burgasHero, homeHero, burgasHero, homeHero, burgasHero, homeHero];

const propertyFacts = [
  { icon: LandPlot, label: "Цена", value: "€ 245 000", sub: "€ 2 450 / м²" },
  { icon: Square, label: "Площ", value: "100 m²" },
  { icon: Building2, label: "Етаж", value: "8 от 9" },
  { icon: House, label: "Стаи", value: "3" },
  { icon: BedDouble, label: "Спални", value: "2" },
  { icon: Bath, label: "Бани", value: "1" },
  { icon: Sparkles, label: "Изложение", value: "Юг/Изток" },
];

const amenityList = ["Панорамна гледка", "Тераса", "Климатик", "Обзаведен", "СОТ", "Контролиран достъп"];

function LuxuryHeader({ active = "sale" }: { active?: NavKey; dark?: boolean }) {
  return (
    <header
      className="relative z-30 w-full"
      style={{
        backgroundImage: `url(${headerPanel})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#f7f1e6",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 pb-6 pt-3 md:px-10 md:pb-8 md:pt-4">
        <Link to="/" className="flex shrink-0 items-center">
          <img
            src={logoNadezhda}
            alt="Недвижими имоти Надежда"
            className="h-16 w-auto object-contain md:h-20 lg:h-24"
          />
        </Link>

        <nav className="flex items-center gap-5 md:gap-10">
          {topNav.map((item) => (
            <a
              key={item.key}
              href="#"
              className={cn(
                "relative font-display text-base text-primary transition hover:text-primary/80 md:text-lg",
                active === item.key &&
                  "after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:bg-primary",
              )}
            >
              {item.label}
            </a>
          ))}
          <button
            className="text-primary transition hover:text-primary/70"
            aria-label="Профил"
          >
            <User className="h-6 w-6" />
          </button>
        </nav>
      </div>
    </header>
  );
}

function SearchBar({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("marble-dark-panel relative z-20 mx-auto grid w-full max-w-[1380px] gap-3 rounded-[24px] p-4 shadow-[0_18px_40px_rgba(56,10,20,0.35)] lg:grid-cols-[1fr_1fr_1.1fr_1.1fr_1.1fr_auto_auto] lg:items-center lg:gap-0 lg:px-5 lg:py-4", compact && "max-w-[1340px]")}>
      <FilterCell icon={MapPin} label="Град" value="Бургас" />
      <FilterCell icon={House} label="Квартал" value="Лазур" />
      <FilterCell icon={Building2} label="Вид имот" value="Апартамент" />
      <FilterCell icon={LandPlot} label="Цена" value="от 200 000 €" sub="до 500 000 €" />
      <FilterCell icon={Ruler} label="Площ" value="от 100 m²" sub="до 200 m²" />
      <Button variant="outline" className="marble-action-button h-12 justify-center rounded-[14px] border-primary/30 bg-transparent px-5 text-base text-primary-foreground hover:bg-white/8 lg:h-14 lg:px-6">
        <SlidersHorizontal className="h-5 w-5" /> Филтри
      </Button>
      <Button className="gold-cta-button h-12 justify-center rounded-[14px] px-6 text-base lg:h-14 lg:px-7">
        <Search className="h-5 w-5" /> Търси
      </Button>
    </div>
  );
}

function FilterCell({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-primary/12 pr-4 md:border-r md:px-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-primary/80">{label}</div>
        <div className="font-display text-xl leading-tight text-primary-foreground">{value}</div>
        {sub ? <div className="text-sm text-primary-foreground/75">{sub}</div> : null}
      </div>
      <ChevronDown className="ml-auto h-4 w-4 text-primary/80" />
    </div>
  );
}

function CityCard({ name, image, href, params }: { name: string; image: string; href: "/cities/$slug"; params: { slug: string } }) {
  return (
    <Link to={href} params={params} className="marble-city-card group block overflow-hidden rounded-[18px] bg-card text-card-foreground">
      <div className="relative aspect-[1.5/1] overflow-hidden rounded-[18px] border border-primary/20 bg-card shadow-[0_18px_35px_rgba(77,25,31,0.18)] lg:aspect-[1.7/1]">
        <img src={image} alt={name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" loading="lazy" />
        <div className="marble-wave-glow" />
        <div className="absolute inset-x-0 bottom-0 h-[44%] bg-[linear-gradient(180deg,transparent_0%,rgba(255,247,236,0.9)_44%,rgba(255,247,236,0.98)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-5">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-accent-foreground/70">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Виж града</span>
            </div>
            <div className="font-display text-[2rem] leading-none text-accent-foreground">{name}</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-background/80 text-accent-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function MarblePropertyCard({
  title,
  count,
  image,
}: {
  title: string;
  count: number;
  image: string;
}) {
  return (
    <article className="marble-hover-card group overflow-hidden rounded-[18px] border border-primary/18 bg-card shadow-[0_18px_35px_rgba(77,25,31,0.15)]">
      <div className="relative aspect-[1.04/1] overflow-hidden">
        <img src={image} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]" loading="lazy" />
        <div className="marble-wave-glow" />
      </div>
      <div className="relative bg-card px-5 py-4">
        <div className="mb-2 font-display text-[1.15rem] text-accent-foreground">{title}</div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{count} имота</span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20"><ChevronRight className="h-4 w-4" /></span>
        </div>
      </div>
    </article>
  );
}

function ListingCard({
  title,
  price,
  size,
  beds,
  baths,
  image,
  tag,
  location,
}: {
  title: string;
  price: string;
  size: string;
  beds: number;
  baths: number;
  image: string;
  tag: string;
  location?: string;
}) {
  return (
    <article className="marble-hover-card group overflow-hidden rounded-[20px] border border-primary/18 bg-card shadow-[0_20px_45px_rgba(93,39,22,0.16)]">
      <div className="relative aspect-[1.08/0.82] overflow-hidden">
        <img src={image} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        {tag ? <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold tracking-[0.08em] text-primary-foreground">{tag}</span> : null}
        <button className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-primary shadow">
          <Heart className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-[rgba(102,8,28,0.88)] px-3.5 py-1.5 text-xs font-semibold tracking-[0.08em] text-primary-foreground shadow-[0_8px_22px_rgba(60,10,20,0.45)] backdrop-blur-sm transition hover:bg-[rgba(122,18,38,0.95)]"
          aria-label="3D виртуален оглед"
        >
          <Box className="h-3.5 w-3.5 text-primary" />
          3D Виртуален оглед
        </button>
        <div className="marble-wave-glow" />
      </div>
      <div className="space-y-3 px-4 pb-5 pt-4">
        <div>
          <h3 className="font-display text-[1.35rem] leading-snug text-accent-foreground">{title}</h3>
          {location ? <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 text-primary" />{location}</p> : null}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Square className="h-4 w-4 text-primary" />{size}</span>
          <span className="inline-flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-primary" />{beds}</span>
          <span className="inline-flex items-center gap-1.5"><Bath className="h-4 w-4 text-primary" />{baths}</span>
        </div>
        <div className="font-display text-[1.9rem] text-accent-foreground">{price}</div>
      </div>
    </article>
  );
}


function AgentCard() {
  return (
    <aside className="marble-dark-panel space-y-4 rounded-[20px] p-5 text-primary-foreground shadow-[0_22px_45px_rgba(60,10,20,0.3)]">
      <div className="flex items-center gap-4">
        <div className="h-18 w-18 flex h-18 w-18 items-center justify-center rounded-full border-2 border-primary bg-background/20 text-primary">
          <User className="h-8 w-8" />
        </div>
        <div>
          <div className="font-display text-[1.8rem] leading-none text-primary-foreground">Мария Иванова</div>
          <div className="mt-1 text-lg text-primary/85">Старши консултант</div>
        </div>
      </div>
      <div className="space-y-3 text-lg">
        <div className="flex items-center gap-3"><Phone className="h-5 w-5 text-primary" />+359 88 123 4567</div>
        <div className="flex items-center gap-3 break-all"><Mail className="h-5 w-5 text-primary" />m.ivanova@ildja.bg</div>
      </div>
      <Button className="gold-cta-button h-14 w-full rounded-[14px] text-lg">Запази час за оглед</Button>
      <Button variant="outline" className="marble-action-button h-14 w-full rounded-[14px] border-primary/30 bg-transparent text-lg text-primary-foreground hover:bg-white/6">Запитване</Button>
    </aside>
  );
}

function DetailCard() {
  return (
    <aside className="marble-dark-panel rounded-[20px] p-6 text-primary-foreground shadow-[0_22px_45px_rgba(60,10,20,0.28)]">
      <h3 className="mb-4 font-display text-[2rem] text-primary-foreground">Детайли за имота</h3>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 text-base md:text-lg">
        <dt className="text-primary/78">Тип имот:</dt><dd>Апартамент</dd>
        <dt className="text-primary/78">Вид строителство:</dt><dd>Тухла</dd>
        <dt className="text-primary/78">Година на строителство:</dt><dd>2015</dd>
        <dt className="text-primary/78">Етаж:</dt><dd>8 от 9</dd>
        <dt className="text-primary/78">Асансьор:</dt><dd>Да</dd>
        <dt className="text-primary/78">Отопление:</dt><dd>Електричество</dd>
        <dt className="text-primary/78">Паркиране:</dt><dd>Възможност за покупка на подземно паркомясто</dd>
        <dt className="text-primary/78">Мазе:</dt><dd>Да</dd>
        <dt className="text-primary/78">Такса поддръжка:</dt><dd>€ 45 / месец</dd>
      </dl>
    </aside>
  );
}

function MapCard({ district = false }: { district?: boolean }) {
  return (
    <aside className="overflow-hidden rounded-[22px] border border-primary/15 bg-card shadow-[0_20px_45px_rgba(91,41,18,0.16)]">
      <div className="p-4">
        <div className="font-display text-[1.8rem] text-accent-foreground">Локация</div>
        <p className="mt-1 text-base text-muted-foreground">кв. Лазур, гр. Бургас</p>
      </div>
      <div className="relative h-[300px] overflow-hidden border-y border-primary/10 bg-[linear-gradient(135deg,rgba(215,203,186,0.85),rgba(231,224,210,0.92))]">
        <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(90deg, rgba(120,106,94,0.18) 1px, transparent 1px), linear-gradient(rgba(120,106,94,0.18) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className={cn("absolute inset-y-0 right-[12%] w-[22%] bg-[linear-gradient(180deg,rgba(56,136,180,0.6),rgba(34,125,180,0.78))]", district ? "w-[28%]" : "")} />
        {district ? <div className="absolute inset-y-[12%] right-[18%] w-[28%] rounded-[40%] bg-[rgba(120,15,38,0.5)] border border-[rgba(120,15,38,0.4)]" /> : null}
        <div className={cn("absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card text-primary shadow-[0_0_0_8px_rgba(122,17,37,0.18)]", district && "left-[58%] top-[58%]") }>
          <MapPin className="h-6 w-6" />
        </div>
        {district ? <div className="absolute left-[48%] top-[58%] -translate-x-1/2 -translate-y-1/2 font-display text-[2.3rem] tracking-[0.12em] text-card-foreground/75">ЛАЗУР</div> : null}
      </div>
      <div className="p-4">
        <Button className="marble-dark-panel h-14 w-full rounded-[14px] text-lg text-primary-foreground">Виж на картата</Button>
      </div>
    </aside>
  );
}

type HomeCity = { name: string; image?: string | null; slug: string };
type FeaturedListing = {
  id: string;
  title: string;
  price: number | string;
  currency?: string | null;
  area_sqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  cover_image_url?: string | null;
  city_slug?: string | null;
  city_name?: string | null;
};

function formatPrice(p: number | string, currency = "EUR") {
  const num = typeof p === "string" ? Number(p) : p;
  if (!Number.isFinite(num)) return String(p);
  const sym = currency === "EUR" ? "€" : currency === "BGN" ? "лв." : currency;
  return `${sym} ${new Intl.NumberFormat("bg-BG").format(num)}`;
}

export function HomePage({ cities, featured }: { cities?: HomeCity[]; featured?: FeaturedListing[] } = {}) {
  const cityList = (cities && cities.length ? cities : homeCities.map((c) => ({ name: c.name, image: c.image, slug: c.params.slug })))
    .map((c) => ({ ...c, image: citySlugImages[c.slug] || c.image || burgasHero }));
  return (
    <main className="luxury-page flex min-h-screen flex-col bg-background text-foreground">
      <section
        className="relative flex flex-1 flex-col overflow-hidden px-3 pb-6 pt-0 md:px-6 lg:h-screen lg:max-h-screen lg:pb-4"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(247,241,230,0) 0%, rgba(247,241,230,0) 30%, rgba(247,241,230,0.85) 92%, rgba(247,241,230,1) 100%), url(${homeHero})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <LuxuryHeader active="sale" />

        <div className="relative z-20 mx-auto mt-auto w-full max-w-[1440px] px-2 pt-6 md:px-6">
          <SearchBar />
        </div>

        <section className="relative z-10 mx-auto mt-5 w-full max-w-[1420px] px-2 md:px-6 lg:mt-6">
          <div className="grid gap-3 md:grid-cols-4 lg:gap-4">
            {cityList.map((city) => (
              <CityCard
                key={city.slug}
                name={city.name}
                image={city.image}
                href="/cities/$slug"
                params={{ slug: city.slug }}
              />
            ))}
          </div>
        </section>
      </section>

      {featured && featured.length > 0 && (
        <section className="relative mx-auto mt-12 w-full max-w-[1420px] px-4 pb-16 md:mt-16 md:px-6">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-display text-[2.4rem] text-accent-foreground md:text-[3rem]">Подбрани имоти</h2>
            <span className="text-sm text-muted-foreground">{featured.length} оферти</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featured.map((f) => (
              <Link key={f.id} to="/properties/$propertyId" params={{ propertyId: f.id }} className="block">
                <ListingCard
                  title={f.title}
                  price={formatPrice(f.price, f.currency ?? "EUR")}
                  size={`${f.area_sqm ?? "—"} m²`}
                  beds={f.bedrooms ?? 0}
                  baths={f.bathrooms ?? 0}
                  image={f.cover_image_url || burgasHero}
                  tag={f.city_name ?? ""}
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

type CityData = {
  city: {
    slug: string;
    name: string;
    description?: string | null;
    hero_image_url?: string | null;
    region?: string | null;
    population?: number | null;
    area_km2?: number | null;
  };
  quarters: Array<{ id: string; slug: string; name: string; image_url?: string | null; properties_count?: number | null }>;
  properties: Array<{ id: string; title: string; price: number | string; currency?: string | null; area_sqm?: number | null; bedrooms?: number | null; bathrooms?: number | null; cover_image_url?: string | null }>;
};

export function CityPage({ data }: { data?: CityData } = {}) {
  const city = data?.city ?? { slug: "burgas", name: "Бургас", description: "Модерен морски град с богата история, динамична икономика, развита инфраструктура и отлични възможности за живот и инвестиции.", hero_image_url: null, region: "Югоизточен", population: 210000, area_km2: 253 };
  const quarters = data?.quarters ?? burgasDistricts.map((d, i) => ({ id: String(i), slug: d.name.toLowerCase(), name: d.name, image_url: d.image, properties_count: d.count }));
  const properties = data?.properties ?? [];
  const heroImage = city.hero_image_url || (city.slug === "burgas" ? burgasPier : burgasHero);

  return (
    <main className="luxury-page min-h-screen bg-[radial-gradient(circle_at_top,rgba(77,8,20,0.35),transparent_42%),#17060b] text-primary-foreground">
      <section className="relative overflow-hidden px-3 pb-8 md:px-6 md:pb-16">
        <LuxuryHeader active="sale" dark />
        <div className="relative mx-auto mt-2 max-w-[1450px] px-2 md:px-6">
          <div className="overflow-hidden rounded-[30px] border border-primary/20 bg-[linear-gradient(135deg,rgba(52,4,14,0.96),rgba(24,4,8,0.97))] shadow-[0_28px_70px_rgba(0,0,0,0.35)]">
            <div className="grid md:grid-cols-[1.1fr_0.9fr]">
              <div className="relative min-h-[360px] md:min-h-[560px]">
                <img src={heroImage} alt={city.name} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.15)_0%,rgba(39,4,10,0.28)_70%,rgba(39,4,10,0.44)_100%)]" />
              </div>
              <div className="flex flex-col justify-center px-6 py-10 md:px-12">
                <p className="font-display text-lg uppercase tracking-[0.18em] text-primary/85">За града</p>
                <h1 className="mt-2 font-display text-[4.2rem] leading-none text-primary md:text-[5.4rem]">{city.name}</h1>
                {city.description && (
                  <p className="mt-6 max-w-[560px] text-xl leading-[1.8] text-primary-foreground/90 md:text-[1.95rem]">{city.description}</p>
                )}
                <div className="mt-8 h-px w-full bg-primary/25" />
                <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                  <StatItem icon={User} value={city.population ? `~${new Intl.NumberFormat("bg-BG").format(city.population)}` : "—"} label="жители" />
                  <StatItem icon={Square} value={city.area_km2 ? `${city.area_km2} km²` : "—"} label="площ" />
                  <StatItem icon={MapPin} value={city.region ?? "—"} label="регион" />
                  <StatItem icon={Building2} value={`${properties.length}+`} label="активни имота" />
                </div>
              </div>
            </div>
            <div className="px-4 pb-4 md:px-8 md:pb-6">
              <SearchBar compact />
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto mt-[-14px] max-w-[1450px] px-3 pb-10 md:mt-[-22px] md:px-6 md:pb-16">
        <div className="overflow-hidden rounded-[34px] bg-card p-5 shadow-[0_26px_65px_rgba(0,0,0,0.24)] md:p-8" style={{ backgroundImage: `url(${marbleBg})`, backgroundSize: "cover" }}>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <h2 className="font-display text-[2.6rem] leading-tight text-accent-foreground md:text-[3.4rem]">Избери квартал в гр. {city.name}</h2>
            <p className="text-base text-muted-foreground md:max-w-md">Разгледай всички {quarters.length} квартала с реални снимки и активни обяви.</p>
          </div>
          <QuartersScroller quarters={quarters} citySlug={city.slug} fallbackImage={burgasHero} />
        </div>
      </section>


      {properties.length > 0 && (
        <section className="relative mx-auto max-w-[1450px] px-3 pb-16 md:px-6">
          <h2 className="mb-6 font-display text-[2.4rem] text-primary-foreground md:text-[3rem]">Активни имоти в {city.name}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {properties.map((p) => (
              <Link key={p.id} to="/properties/$propertyId" params={{ propertyId: p.id }} className="block">
                <ListingCard
                  title={p.title}
                  price={formatPrice(p.price, p.currency ?? "EUR")}
                  size={`${p.area_sqm ?? "—"} m²`}
                  beds={p.bedrooms ?? 0}
                  baths={p.bathrooms ?? 0}
                  image={p.cover_image_url || burgasHero}
                  tag=""
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function StatItem({ icon: Icon, value, label }: { icon: typeof User; value: string; label: string }) {
  return (
    <div className="border-l border-primary/25 pl-5 first:border-l-0 first:pl-0">
      <Icon className="mb-4 h-10 w-10 text-primary" />
      <div className="font-display text-[2rem] text-primary-foreground">{value}</div>
      <div className="mt-2 text-lg text-primary-foreground/82">{label}</div>
    </div>
  );
}

type QuarterData = {
  city: { id: string; slug: string; name: string };
  quarter: { id: string; slug: string; name: string; description?: string | null; image_url?: string | null; properties_count?: number | null };
  properties: Array<{ id: string; title: string; price: number; currency?: string | null; area_sqm?: number | null; bedrooms?: number | null; bathrooms?: number | null; cover_image_url?: string | null; is_featured?: boolean }>;
};

export function DistrictPage({ data }: { data?: QuarterData } = {}) {
  const city = data?.city ?? { id: "x", slug: "burgas", name: "Бургас" };
  const quarter = data?.quarter ?? { id: "x", slug: "lazur", name: "Лазур", description: "Един от най-предпочитаните квартали с морска панорама.", image_url: null, properties_count: 0 };
  const properties = data?.properties ?? [];
  const heroImg = quarter.image_url || burgundyTerrace;

  return (
    <main className="luxury-page min-h-screen bg-background" style={{ backgroundImage: `url(${marbleBg})`, backgroundSize: "cover" }}>
      <section className="relative px-3 pb-12 md:px-6 md:pb-16">
        <LuxuryHeader active="sale" />
        <div className="relative mx-auto mt-[-18px] max-w-[1460px] px-2 md:px-6">
          <div className="overflow-hidden rounded-[30px] border border-primary/20 shadow-[0_24px_55px_rgba(88,40,18,0.16)]">
            <img src={heroImg} alt={`${quarter.name} ${city.name}`} className="h-[350px] w-full object-cover md:h-[520px]" />
          </div>
          <div className="relative z-30 mx-auto mt-[-42px] md:mt-[-54px]">
            <SearchBar />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-[-8px] max-w-[1460px] px-4 pb-10 md:px-6 md:pb-16">
        <div className="grid gap-8 xl:grid-cols-[270px_1fr_360px] xl:items-start">
          <aside className="marble-dark-panel rounded-[20px] p-5 text-primary-foreground shadow-[0_22px_45px_rgba(60,10,20,0.28)]">
            <div className="mb-5 font-display text-[2rem] text-primary-foreground">Бързи филтри</div>
            <div className="space-y-6">
              <div>
                <div className="mb-4 border-b border-primary/20 pb-3 text-lg text-primary/90">Тип имот</div>
                <div className="space-y-3 text-lg">
                  {["Апартамент", "Многостаен", "Къща", "Парцел", "Офис", "Магазин"].map((item) => (
                    <label key={item} className="flex items-center gap-3">
                      <input type="checkbox" className="h-5 w-5 rounded border-primary/40 bg-transparent accent-[var(--color-primary)]" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-4 text-lg text-primary/90">Цена</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[12px] border border-primary/25 bg-background/5 px-4 py-3">От €</div>
                  <div className="rounded-[12px] border border-primary/25 bg-background/5 px-4 py-3">До €</div>
                </div>
              </div>
              <Button className="gold-cta-button h-14 w-full rounded-[14px] text-lg">Приложи филтрите</Button>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="rounded-[26px] bg-card p-5 shadow-[0_18px_45px_rgba(92,41,20,0.12)] md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-base text-muted-foreground">
                    <Link to="/" className="hover:text-primary">Начало</Link><ChevronRight className="h-4 w-4" />
                    <Link to="/cities/$slug" params={{ slug: city.slug }} className="hover:text-primary">{city.name}</Link>
                    <ChevronRight className="h-4 w-4" /><span>{quarter.name}</span>
                  </div>
                  <h1 className="font-display text-[3.4rem] leading-none text-accent-foreground md:text-[4.4rem]">{quarter.name}, гр. {city.name}</h1>
                  {quarter.description ? (
                    <p className="mt-4 max-w-[760px] text-lg leading-8 text-muted-foreground md:text-[1.35rem]">{quarter.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-[18px] border border-primary/14 bg-background px-5 py-4 shadow-sm">
                    <div className="inline-flex items-center gap-3"><House className="h-5 w-5 text-primary" /><span className="font-display text-[1.9rem] text-accent-foreground">{properties.length}</span></div>
                    <div className="text-base text-muted-foreground">имота</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
              {properties.length === 0 ? (
                <div className="md:col-span-2 2xl:col-span-4 rounded-[20px] bg-card p-10 text-center text-muted-foreground">Все още няма публикувани имоти в този квартал.</div>
              ) : (
                properties.map((p) => (
                  <Link key={p.id} to="/properties/$propertyId" params={{ propertyId: p.id }} className="block">
                    <ListingCard
                      title={p.title}
                      price={formatPrice(p.price, p.currency ?? "EUR")}
                      size={`${p.area_sqm ?? "—"} m²`}
                      beds={p.bedrooms ?? 0}
                      baths={p.bathrooms ?? 0}
                      image={p.cover_image_url || burgasHero}
                      tag={p.is_featured ? "ТОП ОФЕРТА" : ""}
                      location={`${quarter.name}, гр. ${city.name}`}
                    />
                  </Link>
                ))
              )}
            </div>
          </div>

          <MapCard district />
        </div>
      </section>
    </main>
  );
}

type PropertyData = {
  property: {
    id: string; title: string; description?: string | null; price: number; currency?: string | null;
    area_sqm?: number | null; rooms?: number | null; bedrooms?: number | null; bathrooms?: number | null;
    floor?: number | null; total_floors?: number | null; year_built?: number | null;
    property_type?: string | null; status?: string | null; address?: string | null; amenities?: string[] | null;
    cover_image_url?: string | null; is_featured?: boolean;
    cities?: { name: string; slug: string } | null;
    quarters?: { name: string; slug: string } | null;
  };
  images: Array<{ id: string; url: string; is_cover?: boolean; display_order?: number | null }>;
};

export function PropertyPage({ data }: { data?: PropertyData } = {}) {
  if (!data) {
    return (
      <main className="luxury-page min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-3xl text-accent-foreground">Имотът не е намерен</h1>
          <Link to="/" className="mt-4 inline-block text-primary underline">Към началната страница</Link>
        </div>
      </main>
    );
  }
  const { property, images } = data;
  const gallery = (images.length ? images.map((i) => i.url) : [property.cover_image_url || burgasHero]).filter(Boolean) as string[];
  const cityName = property.cities?.name ?? "—";
  const citySlug = property.cities?.slug ?? "";
  const quarterName = property.quarters?.name ?? "";
  const priceStr = formatPrice(property.price, property.currency ?? "EUR");
  const pricePerSqm = property.area_sqm ? formatPrice(Math.round(Number(property.price) / Number(property.area_sqm)), property.currency ?? "EUR") + " / м²" : undefined;

  const facts = [
    { icon: LandPlot, label: "Цена", value: priceStr, sub: pricePerSqm },
    property.area_sqm ? { icon: Square, label: "Площ", value: `${property.area_sqm} m²` } : null,
    (property.floor != null) ? { icon: Building2, label: "Етаж", value: `${property.floor}${property.total_floors ? ` от ${property.total_floors}` : ""}` } : null,
    property.rooms ? { icon: House, label: "Стаи", value: String(property.rooms) } : null,
    property.bedrooms ? { icon: BedDouble, label: "Спални", value: String(property.bedrooms) } : null,
    property.bathrooms ? { icon: Bath, label: "Бани", value: String(property.bathrooms) } : null,
    property.year_built ? { icon: Sparkles, label: "Година", value: String(property.year_built) } : null,
  ].filter(Boolean) as Array<{ icon: typeof LandPlot; label: string; value: string; sub?: string }>;

  return (
    <main className="luxury-page min-h-screen bg-background" style={{ backgroundImage: `url(${marbleBg})`, backgroundSize: "cover" }}>
      <section className="relative px-3 pb-10 md:px-6 md:pb-16">
        <LuxuryHeader active="sale" />
        <div className="relative mx-auto mt-[-18px] max-w-[1460px] px-2 md:px-6">
          <div className="overflow-hidden rounded-[30px] border border-primary/20 shadow-[0_24px_55px_rgba(88,40,18,0.16)]">
            <img src={gallery[0]} alt={property.title} className="h-[340px] w-full object-cover md:h-[500px]" />
          </div>
          <div className="relative z-30 mx-auto mt-[-42px] md:mt-[-54px]">
            <SearchBar />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1460px] px-4 pb-12 md:px-6 md:pb-18">
        <div className="grid gap-8 xl:grid-cols-[1fr_340px] xl:items-start">
          <div className="space-y-6">
            <div className="rounded-[28px] bg-card p-5 shadow-[0_20px_45px_rgba(91,41,18,0.14)] md:p-8">
              <div className="mb-5 flex flex-wrap items-center gap-3 text-base text-muted-foreground">
                <Link to="/" className="hover:text-primary">Начало</Link><ChevronRight className="h-4 w-4" />
                {citySlug ? <Link to="/cities/$slug" params={{ slug: citySlug }} className="hover:text-primary">{cityName}</Link> : <span>{cityName}</span>}
                {quarterName ? <><ChevronRight className="h-4 w-4" /><span>{quarterName}</span></> : null}
                <ChevronRight className="h-4 w-4" /><span className="line-clamp-1">{property.title}</span>
              </div>
              {property.is_featured ? <div className="mb-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold tracking-[0.08em] text-primary-foreground">ТОП ОФЕРТА</div> : null}
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <h1 className="font-display text-[3rem] leading-tight text-accent-foreground md:text-[4.1rem]">{property.title}</h1>
                  <p className="mt-2 inline-flex items-center gap-2 text-xl text-muted-foreground"><MapPin className="h-5 w-5 text-primary" />{quarterName ? `кв. ${quarterName}, ` : ""}гр. {cityName}</p>
                </div>
                <div className="flex flex-wrap gap-5 text-base text-muted-foreground">
                  <button className="inline-flex items-center gap-2"><Heart className="h-5 w-5 text-primary" />Добави в любими</button>
                  <button className="inline-flex items-center gap-2"><Share2 className="h-5 w-5 text-primary" />Сподели</button>
                </div>
              </div>
              <div className="mt-8 grid gap-5 border-t border-primary/10 pt-6 sm:grid-cols-2 xl:grid-cols-7">
                {facts.map((fact) => {
                  const Icon = fact.icon;
                  return (
                    <div key={fact.label} className="space-y-2">
                      <div className="inline-flex items-center gap-2 text-base text-muted-foreground"><Icon className="h-5 w-5 text-primary" />{fact.label}</div>
                      <div className="font-display text-[2rem] leading-none text-accent-foreground">{fact.value}</div>
                      {fact.sub ? <div className="text-base text-muted-foreground">{fact.sub}</div> : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {gallery.length > 0 ? (
              <div className="rounded-[28px] bg-card p-4 shadow-[0_20px_45px_rgba(91,41,18,0.14)] md:p-5">
                <PropertyGallery images={gallery} title={property.title} />
              </div>
            ) : null}

            {property.description ? (
              <div className="rounded-[28px] bg-card p-5 shadow-[0_20px_45px_rgba(91,41,18,0.14)] md:p-8">
                <h2 className="font-display text-[2.4rem] text-accent-foreground md:text-[3rem]">Описание</h2>
                <div className="mt-4 space-y-4 text-lg leading-8 text-muted-foreground md:text-[1.16rem] whitespace-pre-line">{property.description}</div>
                {property.amenities && property.amenities.length > 0 ? (
                  <div className="mt-8 grid gap-5 sm:grid-cols-3 xl:grid-cols-6">
                    {property.amenities.map((item) => (
                      <div key={item} className="flex flex-col items-center gap-3 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/16 bg-background text-primary"><Trees className="h-6 w-6" /></div>
                        <div className="font-display text-lg text-accent-foreground">{item}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <InquiryForm propertyId={property.id} propertyTitle={property.title} />
            <MapCard />
          </div>
        </div>
      </section>
    </main>
  );
}

function PropertyGallery({ images, title }: { images: string[]; title: string }) {
  const [idx, setIdx] = useGalleryIndex(images.length);
  return (
    <>
      <div className="relative overflow-hidden rounded-[24px]">
        <img src={images[idx]} alt={`${title} – снимка ${idx + 1}`} className="h-[320px] w-full object-cover md:h-[520px]" />
        {images.length > 1 ? (
          <>
            <button onClick={() => setIdx((idx - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-[rgba(102,8,28,0.88)] text-primary-foreground shadow-lg"><ChevronLeft className="h-6 w-6" /></button>
            <button onClick={() => setIdx((idx + 1) % images.length)} className="absolute right-4 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-[rgba(102,8,28,0.88)] text-primary-foreground shadow-lg"><ChevronRight className="h-6 w-6" /></button>
          </>
        ) : null}
        <div className="absolute bottom-4 left-4 rounded-[12px] bg-[rgba(53,12,18,0.9)] px-4 py-2 text-primary-foreground">{idx + 1} / {images.length}</div>
      </div>
      {images.length > 1 ? (
        <div className="mt-4 grid grid-cols-6 gap-3">
          {images.slice(0, 6).map((thumb, i) => (
            <button key={`${thumb}-${i}`} onClick={() => setIdx(i)} className={cn("overflow-hidden rounded-[12px] border", i === idx ? "border-primary" : "border-primary/12")}>
              <img src={thumb} alt={`Снимка ${i + 1}`} className="h-18 w-full object-cover md:h-24" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function useGalleryIndex(len: number): [number, (n: number) => void] {
  const [idx, setIdx] = useReactState(0);
  if (idx >= len && len > 0) setIdx(0);
  return [idx, setIdx];
}

function InquiryForm({ propertyId, propertyTitle }: { propertyId?: string; propertyTitle?: string }) {
  const [name, setName] = useReactState("");
  const [email, setEmail] = useReactState("");
  const [phone, setPhone] = useReactState("");
  const [message, setMessage] = useReactState(propertyTitle ? `Здравейте, интересувам се от "${propertyTitle}". ` : "");
  const [status, setStatus] = useReactState<"idle" | "sending" | "ok" | "error">("idle");
  const [err, setErr] = useReactState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending"); setErr(null);
    try {
      const { submitInquiry } = await import("@/lib/catalog.functions");
      await submitInquiry({ data: { property_id: propertyId ?? null, name, email, phone: phone || undefined, message: message || undefined } });
      setStatus("ok");
      setName(""); setEmail(""); setPhone(""); setMessage("");
    } catch (e: any) {
      setStatus("error"); setErr(e?.message ?? "Грешка при изпращане");
    }
  };

  return (
    <aside className="marble-dark-panel space-y-4 rounded-[20px] p-5 text-primary-foreground shadow-[0_22px_45px_rgba(60,10,20,0.3)]">
      <div>
        <div className="font-display text-[1.8rem] leading-none text-primary-foreground">Изпрати запитване</div>
        <div className="mt-1 text-base text-primary/85">Ще се свържем с вас възможно най-бързо.</div>
      </div>
      {status === "ok" ? (
        <div className="rounded-[14px] bg-primary-foreground/10 p-4 text-base">Благодарим! Получихме запитването ви.</div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Име" className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60" />
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Имейл" className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон (по избор)" className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Съобщение" rows={4} className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60" />
          {err ? <div className="text-sm text-destructive-foreground">{err}</div> : null}
          <Button type="submit" disabled={status === "sending"} className="gold-cta-button h-14 w-full rounded-[14px] text-lg">{status === "sending" ? "Изпращане…" : "Изпрати запитване"}</Button>
        </form>
      )}
      <div className="space-y-2 border-t border-primary/15 pt-3 text-base">
        <div className="flex items-center gap-3"><Phone className="h-5 w-5 text-primary" />+359 88 123 4567</div>
        <div className="flex items-center gap-3 break-all"><Mail className="h-5 w-5 text-primary" />office@imotinadezhda.bg</div>
      </div>
    </aside>
  );
}

