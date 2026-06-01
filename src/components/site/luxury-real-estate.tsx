import { useState as useReactState, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

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
import { MortgageRangeBand } from "@/components/site/mortgage-range-band";

type NavKey = "sale" | "rent" | "about";

const topNav: Array<{ key: "sale" | "rent" | "about"; label: string; to: string; search?: Record<string, string> }> = [
  { key: "sale", label: "За продажба", to: "/search", search: { status: "sale" } },
  { key: "rent", label: "Под наем", to: "/search", search: { status: "rent" } },
  { key: "about", label: "За нас", to: "/about" },
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

export function LuxuryHeader({ active = "sale" }: { active?: NavKey; dark?: boolean }) {
  const navigate = useNavigate();
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoClick = (e: React.MouseEvent) => {
    // Always intercept the click so the Link doesn't navigate away
    // and reset our counter mid-sequence.
    e.preventDefault();
    e.stopPropagation();
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      navigate({ to: "/login", search: { redirect: "/admin" } as any });
      return;
    }

    // Single click → go home after a short window for additional clicks.
    clickTimerRef.current = setTimeout(() => {
      const count = clickCountRef.current;
      clickCountRef.current = 0;
      if (count === 1) {
        navigate({ to: "/" });
      }
      // count === 2: do nothing (user almost triple-clicked); they can retry
    }, 450);
  };

  return (
    <header
      className="relative z-30 w-full"
      style={{
        filter: "drop-shadow(0 6px 18px rgba(120,30,40,0.28))",
      }}
    >
      {/* Marble panel with curved bottom (chupka) */}
      <div
        className="relative"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, #fffaf0 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, #e8d098 0%, transparent 60%), linear-gradient(180deg, #fbf6ea 0%, #f4e6c4 50%, #ecd9a8 100%)",
          clipPath:
            "path('M0,0 L100%,0 L100%,calc(100% - 28px) Q50%,100% 0,calc(100% - 28px) Z')",
          WebkitClipPath:
            "path('M0,0 L100%,0 L100%,calc(100% - 28px) Q50%,100% 0,calc(100% - 28px) Z')",
        }}
      >
        {/* Subtle marble veining */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent 0 80px, rgba(180,140,70,0.18) 80px 81px, transparent 81px 160px), repeating-linear-gradient(75deg, transparent 0 120px, rgba(120,80,30,0.12) 120px 121px, transparent 121px 240px)",
          }}
        />
        {/* Top gold hairline */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, #b8893a 15%, #f3d27a 50%, #b8893a 85%, transparent)",
          }}
        />
        {/* Gold curve trace along the chupka */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 w-full"
          viewBox="0 0 1440 32"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="goldCurve" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#b8893a" stopOpacity="0" />
              <stop offset="20%" stopColor="#d4a84a" />
              <stop offset="50%" stopColor="#f6dc8e" />
              <stop offset="80%" stopColor="#d4a84a" />
              <stop offset="100%" stopColor="#b8893a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,4 L1440,4 L1440,4 Q720,32 0,4 Z"
            fill="none"
            stroke="url(#goldCurve)"
            strokeWidth="1.5"
          />
          <path
            d="M0,7 Q720,34 1440,7"
            fill="none"
            stroke="url(#goldCurve)"
            strokeWidth="0.8"
            opacity="0.55"
          />
        </svg>

        <div className="relative mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 pb-6 pt-2 md:px-10 md:pb-8 md:pt-3">
          <Link
            to="/"
            className="flex shrink-0 items-center select-none"
            onClick={handleLogoClick}
            aria-label="Начало (троен клик за админ вход)"
          >
            <img
              src={logoNadezhda}
              alt="Недвижими имоти Надежда"
              draggable={false}
              className="h-12 w-auto object-contain md:h-14 lg:h-[68px]"
            />
          </Link>

          <nav className="flex items-center gap-4 md:gap-8 lg:gap-10">
            {topNav.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                search={item.search as any}
                className={cn(
                  "relative font-display text-sm text-primary transition hover:text-primary/80 md:text-base lg:text-lg",
                  active === item.key &&
                    "after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:bg-[#c9a24a]",
                )}
              >
                {item.label}
              </Link>
            ))}
            <button
              className="text-primary transition hover:text-primary/70"
              aria-label="Профил"
            >
              <User className="h-5 w-5 md:h-6 md:w-6" />
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}



type SearchOption = { value: string; label: string };

const propertyTypeOptions: SearchOption[] = [
  { value: "", label: "Всички" },
  { value: "apartment", label: "Апартамент" },
  { value: "house", label: "Къща" },
  { value: "office", label: "Офис" },
  { value: "land", label: "Парцел" },
  { value: "commercial", label: "Търговски" },
];

function SearchBar({
  cities = [],
  quarters = [],
  initial,
}: {
  cities?: Array<{ slug: string; name: string }>;
  quarters?: Array<{ slug: string; name: string }>;
  initial?: { city_slug?: string; quarter_slug?: string; property_type?: string; price_min?: string; price_max?: string; area_min?: string; area_max?: string };
}) {
  // navigation handled via window.location.href in handleSearch
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [city, setCity] = useReactState(initial?.city_slug ?? (cities[0]?.slug ?? ""));
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [quarter, setQuarter] = useReactState(initial?.quarter_slug ?? "");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [ptype, setPtype] = useReactState(initial?.property_type ?? "apartment");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [priceMin, setPriceMin] = useReactState(initial?.price_min ?? "200000");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [priceMax, setPriceMax] = useReactState(initial?.price_max ?? "500000");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [areaMin, setAreaMin] = useReactState(initial?.area_min ?? "100");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [areaMax, setAreaMax] = useReactState(initial?.area_max ?? "200");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (city) params.set("city_slug", city);
    if (quarter) params.set("quarter_slug", quarter);
    if (ptype) params.set("property_type", ptype);
    if (priceMin) params.set("price_min", priceMin);
    if (priceMax) params.set("price_max", priceMax);
    if (areaMin) params.set("area_min", areaMin);
    if (areaMax) params.set("area_max", areaMax);
    if (typeof window !== "undefined") {
      window.location.href = `/search?${params.toString()}`;
    }
  };

  const cityOptions = cities.length ? cities : [
    { slug: "burgas", name: "Бургас" },
    { slug: "varna", name: "Варна" },
    { slug: "shumen", name: "Шумен" },
    { slug: "novi-pazar", name: "Нов пазар" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-[1180px]">
      {/* Floating gold "Search" button */}
      <button
        type="button"
        onClick={handleSearch}
        className="gold-cta-button absolute -top-5 right-4 z-30 flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold md:-top-7 md:right-6 md:h-12 md:px-7 md:text-base lg:right-10"
      >
        <Search className="h-4 w-4 md:h-5 md:w-5" /> Търси
      </button>

      <div className="marble-light-panel grid w-full grid-cols-2 gap-1 rounded-[18px] p-2 md:grid-cols-[1fr_1fr_1fr_1.1fr_1.1fr_auto] md:items-stretch md:gap-0 md:rounded-[22px] md:p-3">
        <SelectCell icon={MapPin} label="Град" value={city} onChange={setCity}
          options={cityOptions.map((c) => ({ value: c.slug, label: c.name }))} />
        <SelectCell icon={House} label="Квартал" value={quarter} onChange={setQuarter}
          options={[{ value: "", label: "Всички" }, ...quarters.map((q) => ({ value: q.slug, label: q.name }))]} />
        <div className="col-span-2 md:col-span-1 md:contents">
          <SelectCell icon={Building2} label="Вид имот" value={ptype} onChange={setPtype}
            options={propertyTypeOptions} />
        </div>
        <RangeCell icon={LandPlot} label="Цена" minVal={priceMin} maxVal={priceMax}
          onMin={setPriceMin} onMax={setPriceMax} suffix="€" />
        <RangeCell icon={Ruler} label="Площ" minVal={areaMin} maxVal={areaMax}
          onMin={setAreaMin} onMax={setAreaMax} suffix="m²" />
        <button
          type="button"
          className="marble-action-button hidden h-full min-h-[60px] items-center justify-center gap-2 rounded-[14px] border border-primary/35 bg-primary/5 px-5 text-primary transition hover:bg-primary/10 md:flex"
          onClick={handleSearch}
        >
          <SlidersHorizontal className="h-5 w-5" />
          <span className="font-display text-base">Филтри</span>
        </button>
      </div>
    </div>
  );
}

function SelectCell({
  icon: Icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SearchOption[];
}) {
  return (
    <label className="flex min-h-[54px] items-center gap-2 border-primary/15 px-2 md:min-h-[60px] md:gap-3 md:border-r md:px-3">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-primary/35 bg-primary/8 text-primary md:h-11 md:w-11">
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wide text-primary/70 md:text-[11px]">{label}</div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="-ml-1 mt-0.5 w-full appearance-none bg-transparent font-display text-sm text-primary outline-none md:text-lg"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <ChevronDown className="h-3.5 w-3.5 flex-none text-primary/70 md:h-4 md:w-4" />
    </label>
  );
}

function RangeCell({
  icon: Icon,
  label,
  minVal,
  maxVal,
  onMin,
  onMax,
  suffix,
}: {
  icon: typeof MapPin;
  label: string;
  minVal: string;
  maxVal: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  suffix: string;
}) {
  return (
    <div className="flex min-h-[54px] items-center gap-2 border-primary/15 px-2 md:min-h-[60px] md:gap-3 md:border-r md:px-3">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-primary/35 bg-primary/8 text-primary md:h-11 md:w-11">
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wide text-primary/70 md:text-[11px]">{label}</div>
        <div className="flex items-center gap-1 text-primary">
          <span className="text-[10px] text-primary/60 md:text-[11px]">от</span>
          <input value={minVal} onChange={(e) => onMin(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-12 bg-transparent font-display text-sm outline-none placeholder:text-primary/40 md:w-16 md:text-base" />
          <span className="text-[10px] text-primary/60 md:text-[11px]">{suffix}</span>
          <span className="mx-0.5 text-primary/40">·</span>
          <span className="text-[10px] text-primary/60 md:text-[11px]">до</span>
          <input value={maxVal} onChange={(e) => onMax(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-12 bg-transparent font-display text-sm outline-none placeholder:text-primary/40 md:w-16 md:text-base" />
          <span className="text-[10px] text-primary/60 md:text-[11px]">{suffix}</span>
        </div>
      </div>
    </div>
  );
}

function CityCard({ name, image, href, params }: { name: string; image: string; href: "/cities/$slug"; params: { slug: string } }) {
  return (
    <Link to={href} params={params} className="marble-city-card group block overflow-hidden rounded-[16px] md:rounded-[18px]">
      <div className="relative aspect-[1.1/1] overflow-hidden rounded-[16px] border border-primary/25 shadow-[0_18px_38px_rgba(77,25,31,0.28)] md:aspect-[1.45/1] md:rounded-[18px] lg:aspect-[1.65/1]">
        <img src={image} alt={name} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" loading="lazy" />
        <div className="marble-wave-glow" />
        {/* Burgundy marble bottom panel */}
        <div className="marble-burgundy-bottom absolute inset-x-0 bottom-0 flex items-center justify-between px-3 py-2 md:px-5 md:py-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.16em] text-[#8a5a1c] md:gap-1.5 md:text-[11px] md:tracking-[0.18em]">
              <MapPin className="h-3 w-3 text-[#a87622] md:h-3.5 md:w-3.5" />
              <span>Виж града</span>
            </div>
            <div className="font-display text-base leading-tight text-[#2a1208] md:text-2xl lg:text-[1.75rem]">{name}</div>
          </div>
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-[#b3801f]/60 bg-[#f3e3b4]/40 text-[#7a4a10] transition group-hover:bg-[#e8c069] group-hover:text-[#2a1208] md:h-10 md:w-10">
            <ChevronRight className="h-3.5 w-3.5 -rotate-45 md:h-4 md:w-4" />
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

export function ListingCard({
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
  const cityOpts = cityList.map((c) => ({ slug: c.slug, name: c.name }));
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

        <div className="relative z-20 mx-auto mt-auto w-full max-w-[1440px] px-2 pt-10 md:px-6">
          <SearchBar cities={cityOpts} />
        </div>


        <section className="relative z-10 mx-auto mt-5 w-full max-w-[1420px] px-2 md:px-6 lg:mt-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
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
    <main
      className="luxury-page bg-[#150409] text-primary-foreground lg:flex lg:flex-col lg:overflow-hidden"
      style={{ minHeight: "100vh" }}
    >
      <style>{`
        @media (min-width: 1024px) {
          .luxury-page { height: 100vh; max-height: 100vh; }
        }
      `}</style>

      {/* Hero card */}
      <section className="relative px-4 pt-4 md:px-8 md:pt-4 lg:flex-[0_0_auto]">
        <div className="relative mx-auto max-w-[1480px]">
          {/* Outer gold glow */}
          <div
            aria-hidden
            className="absolute -inset-[2px] rounded-[30px] opacity-90"
            style={{
              background: "linear-gradient(135deg, rgba(232,196,119,0.55), rgba(184,137,58,0.15) 40%, rgba(232,196,119,0.55))",
              filter: "blur(0.5px)",
            }}
          />
          <div className="relative overflow-hidden rounded-[28px] shadow-[0_40px_90px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(232,196,119,0.35)_inset]">
            <div className="grid md:grid-cols-[1.02fr_0.98fr]">
              {/* LEFT: hero image + marble logo corner */}
              <div className="relative min-h-[420px] md:min-h-[460px] lg:min-h-[clamp(380px,52vh,540px)]">
                <img src={heroImage} alt={city.name} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "center 35%" }} />
                <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 55%, rgba(20,3,7,0.85) 100%)" }} />
                {/* Marble logo badge with S-curve flare swoosh */}
                <div
                  className="absolute left-0 top-0 z-10 h-[210px] w-[430px] md:h-[240px] md:w-[500px] lg:h-[260px] lg:w-[540px]"
                  style={{
                    background:
                      "radial-gradient(ellipse at 18% 8%, #fffaf0 0%, transparent 55%), linear-gradient(155deg, #fbf6ea 0%, #f4e6c4 55%, #ecd9a8 100%)",
                    clipPath: "path('M0 0 L70% 0 C80% 0 86% 8% 84% 20% C82% 32% 92% 40% 100% 44% C90% 50% 76% 56% 68% 66% C58% 78% 54% 90% 42% 96% C30% 100% 14% 100% 0 100% Z')",
                    WebkitClipPath: "path('M0 0 L70% 0 C80% 0 86% 8% 84% 20% C82% 32% 92% 40% 100% 44% C90% 50% 76% 56% 68% 66% C58% 78% 54% 90% 42% 96% C30% 100% 14% 100% 0 100% Z')",
                    boxShadow: "inset 0 -2px 14px rgba(184,137,58,0.28)",
                  }}
                >
                  <Link to="/" className="absolute left-8 top-7 md:left-12 md:top-9">
                    <img src={logoNadezhda} alt="ИЛДЖ.ИА" className="h-[74px] w-auto object-contain md:h-[90px] lg:h-[98px]" />
                  </Link>
                </div>
                {/* Gold edge tracing the S-curve flare */}
                <svg aria-hidden className="pointer-events-none absolute left-0 top-0 z-20 h-[260px] w-[540px] md:h-[280px]" viewBox="0 0 540 270" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="goldEdgeCity" x1="0" x2="1">
                      <stop offset="0%" stopColor="#b8893a" stopOpacity="0" />
                      <stop offset="40%" stopColor="#e8c477" />
                      <stop offset="70%" stopColor="#f8e3a0" />
                      <stop offset="100%" stopColor="#b8893a" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,0 L378,0 C432,0 464,22 454,54 C443,87 497,108 540,119 C496,131 410,148 367,178 C314,212 292,240 227,256 C164,270 82,270 0,270" fill="none" stroke="url(#goldEdgeCity)" strokeWidth="2.5" />
                  <path d="M395,8 C436,12 462,32 450,60 C440,90 497,114 540,124" fill="none" stroke="url(#goldEdgeCity)" strokeWidth="1.2" opacity="0.7" />
                </svg>
              </div>

              {/* RIGHT: burgundy panel — deep dark wine to match mockup */}
              <div
                className="relative flex flex-col px-8 py-6 md:px-12 md:py-7"
                style={{
                  background:
                    "radial-gradient(ellipse at 30% 12%, rgba(95,18,32,0.45), transparent 55%), linear-gradient(135deg, #350810 0%, #180307 100%)",
                }}
              >
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: `url(${marbleBg})`, backgroundSize: "cover", mixBlendMode: "screen" }} />
                <div className="relative mb-6 flex items-center justify-end gap-7 text-[14px] md:gap-10 md:text-[14.5px]">
                  {topNav.map((item) => (
                    <Link key={item.key} to={item.to} search={item.search as any} className="text-primary-foreground/90 transition hover:text-[#e8c477]">
                      {item.label}
                    </Link>
                  ))}
                  <button aria-label="Профил" className="rounded-full border border-[#c9a24a]/30 p-1.5 text-primary-foreground/90 transition hover:border-[#e8c477] hover:text-[#e8c477]">
                    <User className="h-5 w-5" />
                  </button>
                </div>
                <p className="relative font-display text-[11.5px] uppercase tracking-[0.32em] text-[#c9a24a]">За града</p>
                <h1 className="relative mt-2 font-display text-[3.2rem] leading-[0.95] text-[#e8c477] md:text-[4.2rem] xl:text-[4.6rem]" style={{ textShadow: "0 2px 24px rgba(232,196,119,0.18)" }}>
                  {city.name}
                </h1>
                {city.description && (
                  <p className="relative mt-4 max-w-[480px] text-[13.5px] leading-[1.65] text-primary-foreground/85 md:text-[14px]">{city.description}</p>
                )}
                <div className="relative mt-5 h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(201,162,74,0.6) 50%, transparent)" }} />
                <div className="relative mt-5 grid grid-cols-4 gap-3">
                  <StatItem icon={User} value={city.population ? `~${new Intl.NumberFormat("bg-BG").format(city.population)}` : "—"} label="жители" />
                  <StatItem icon={Square} value={city.area_km2 ? `${city.area_km2} km²` : "—"} label="площ" />
                  <StatItem icon={MapPin} value={city.region ?? "—"} label="регион" />
                  <StatItem icon={Building2} value={`${properties.length || 850}+`} label="активни имота" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Inline burgundy search bar — tucked into the hero so they read as one piece */}
      <section className="relative z-30 mx-auto -mt-12 w-full max-w-[1440px] px-4 md:-mt-14 md:px-8 lg:-mt-16 lg:flex-[0_0_auto]">
        <CitySearchBar citySlug={city.slug} cityName={city.name} />
      </section>

      {/* Marble quarters strip */}
      <section className="relative mx-auto mt-5 w-full max-w-[1480px] px-4 pb-6 md:mt-6 md:px-8 md:pb-6 lg:flex-1 lg:min-h-0 lg:flex lg:items-stretch">
        <div
          className="relative w-full overflow-hidden rounded-[24px] p-5 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.5),0_0_0_1px_rgba(232,196,119,0.35)_inset] md:p-6"
          style={{ backgroundImage: `url(${marbleBg})`, backgroundSize: "cover" }}
        >
          <div className="grid h-full gap-5 md:grid-cols-[260px_1fr] md:items-center md:gap-7">
            <div className="flex flex-col gap-4">
              <h2 className="font-display text-[1.6rem] leading-tight text-[#2a050b] md:text-[1.85rem]">
                Избери квартал<br />в гр. {city.name}
              </h2>
              <Link
                to="/cities/$slug"
                params={{ slug: city.slug }}
                className="inline-flex items-center justify-between gap-3 rounded-[14px] px-5 py-3 font-display text-[14px] text-primary-foreground shadow-[0_14px_30px_-8px_rgba(77,8,20,0.6)] transition hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #4d0814 0%, #2a050b 100%)",
                  border: "1px solid rgba(232,196,119,0.55)",
                  boxShadow: "0 14px 30px -8px rgba(77,8,20,0.55), inset 0 0 0 1px rgba(232,196,119,0.18)",
                }}
              >
                <span className="leading-tight">Виж всички<br />квартали</span>
                <ChevronRight className="h-5 w-5 text-[#e8c477]" />
              </Link>
            </div>
            <QuartersScroller quarters={quarters} citySlug={city.slug} fallbackImage={burgasHero} />
          </div>
        </div>
      </section>

      {properties.length > 0 && (
        <section className="relative mx-auto max-w-[1480px] px-4 pb-20 md:px-8 lg:hidden">
          <h2 className="mb-6 font-display text-[2.4rem] text-primary-foreground md:text-[3rem]">Активни имоти в {city.name}</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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

function CitySearchBar({ citySlug, cityName }: { citySlug: string; cityName: string }) {
  const handleSearch = () => {
    const params = new URLSearchParams();
    if (citySlug) params.set("city_slug", citySlug);
    if (typeof window !== "undefined") window.location.href = `/search?${params.toString()}`;
  };
  const Field = ({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) => (
    <button
      type="button"
      onClick={handleSearch}
      className="group flex flex-1 items-center gap-3 px-4 py-2 text-left transition hover:bg-white/[0.03] md:px-5"
    >
      <Icon className="h-[18px] w-[18px] flex-none text-[#c9a24a]" />
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#c9a24a]/90">{label}</div>
        <div className="truncate text-[14px] text-primary-foreground/95">{value}</div>
      </div>
      <ChevronDown className="ml-auto h-4 w-4 text-[#c9a24a]/70" />
    </button>
  );
  return (
    <div
      className="relative flex items-stretch overflow-hidden rounded-[22px] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.6)]"
      style={{
        background: "radial-gradient(ellipse at 20% 0%, rgba(95,18,32,0.45), transparent 60%), linear-gradient(135deg, #350810 0%, #180307 100%)",
        border: "1px solid rgba(232,196,119,0.45)",
        boxShadow: "0 30px 70px -15px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(232,196,119,0.18), inset 0 1px 0 rgba(255,220,150,0.12)",
      }}
    >
      <div className="flex flex-1 flex-wrap items-stretch md:flex-nowrap divide-x divide-[#c9a24a]/20">
        <Field icon={MapPin} label="Град" value={cityName} />
        <Field icon={House} label="Вид имот" value="Всички" />
        <Field icon={LandPlot} label="Цена" value="Без значение" />
        <Field icon={Ruler} label="Площ" value="Без значение" />
      </div>
      <div className="flex items-center gap-2 border-l border-[#c9a24a]/25 px-3 md:px-4">
        <button
          type="button"
          onClick={handleSearch}
          className="inline-flex items-center gap-2 rounded-[14px] border border-[#c9a24a]/40 px-4 py-2.5 text-[13px] text-primary-foreground/95 transition hover:bg-white/[0.05]"
        >
          <SlidersHorizontal className="h-4 w-4 text-[#c9a24a]" />
          <span className="font-display">Филтри</span>
        </button>
        <button
          type="button"
          onClick={handleSearch}
          className="inline-flex items-center gap-2 rounded-[14px] px-5 py-2.5 text-[13.5px] font-semibold text-[#2a050b] transition hover:brightness-105"
          style={{
            background: "linear-gradient(135deg, #f8e3a0 0%, #e8c477 50%, #b8893a 100%)",
            boxShadow: "0 8px 20px -6px rgba(184,137,58,0.6), inset 0 1px 0 rgba(255,255,255,0.35)",
          }}
        >
          <Search className="h-4 w-4" />
          <span className="font-display">Търси</span>
        </button>
      </div>
    </div>
  );
}

function StatItem({ icon: Icon, value, label }: { icon: typeof User; value: string; label: string }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[#e8c477]"
        style={{
          background: "linear-gradient(135deg, rgba(232,196,119,0.12), rgba(184,137,58,0.04))",
          border: "1px solid rgba(201,162,74,0.45)",
          boxShadow: "inset 0 0 0 1px rgba(232,196,119,0.08), 0 4px 12px rgba(0,0,0,0.25)",
        }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="mt-1 font-display text-[1.25rem] leading-tight text-[#e8c477]">{value}</div>
      <div className="text-[12px] leading-tight text-primary-foreground/75">{label}</div>
    </div>
  );
}

function QuartersScroller({ quarters, citySlug, fallbackImage }: { quarters: Array<{ id: string; slug: string; name: string; image_url?: string | null; properties_count?: number | null }>; citySlug: string; fallbackImage: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-quarter-card]");
    const step = (card?.offsetWidth ?? 280) + 16;
    el.scrollBy({ left: dir * step * 2, behavior: "smooth" });
  };
  return (
    <div className="relative mt-6">
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Предишни"
        className="absolute left-2 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-[rgba(102,8,28,0.92)] text-primary-foreground shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:scale-105 md:flex"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Следващи"
        className="absolute right-2 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-[rgba(102,8,28,0.92)] text-primary-foreground shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:scale-105 md:flex"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
      <div
        ref={ref}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3"
        style={{ scrollbarWidth: "thin" }}
      >
        {quarters.map((q) => (
          <Link
            key={q.id}
            to="/cities/$slug/districts/$district"
            params={{ slug: citySlug, district: q.slug }}
            data-quarter-card
            className="block w-[170px] flex-none snap-start md:w-[185px]"
          >
            <MarblePropertyCard title={q.name} count={q.properties_count ?? 0} image={q.image_url || fallbackImage} />
          </Link>
        ))}
      </div>
    </div>
  );
}


function DistrictMapCard({ name }: { name: string }) {
  return (
    <aside className="overflow-hidden rounded-[26px] border border-primary/20 bg-card shadow-[0_24px_55px_rgba(88,40,18,0.18)]">
      <div className="relative h-[520px] overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(135deg,#6b6256 0%,#7a7062 35%,#5d5448 70%,#4a4338 100%)" }} />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(20,18,15,0.55) 1px, transparent 1px), linear-gradient(rgba(20,18,15,0.55) 1px, transparent 1px), linear-gradient(45deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px, 26px 26px, 14px 14px",
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-[36%]"
          style={{
            background: "linear-gradient(135deg,#1b4d62 0%,#0f3a4f 55%,#0b2c3d 100%)",
            clipPath: "polygon(35% 0,100% 0,100% 100%,0 100%)",
          }}
        />
        <div
          className="absolute"
          style={{
            top: "18%", left: "32%", width: "44%", height: "62%",
            background: "rgba(122,17,37,0.78)",
            border: "1.5px solid rgba(196,140,72,0.65)",
            clipPath: "polygon(20% 0,80% 6%,100% 32%,92% 68%,72% 96%,38% 100%,8% 78%,0 40%)",
            boxShadow: "0 0 30px rgba(122,17,37,0.45) inset",
          }}
        />
        <div className="absolute font-display tracking-[0.18em] text-primary-foreground" style={{ top: "44%", left: "44%", fontSize: "2rem", textShadow: "0 2px 8px rgba(0,0,0,0.55)" }}>
          {name.toUpperCase()}
        </div>
      </div>
      <div className="marble-dark-panel flex items-center justify-center px-4 py-5">
        <Button className="h-12 rounded-[14px] border border-[var(--color-secondary)]/60 bg-transparent px-6 text-base text-primary-foreground hover:bg-white/5">
          <MapPin className="mr-2 h-5 w-5 text-[var(--color-secondary)]" />
          Виж на картата
        </Button>
      </div>
    </aside>
  );
}

function DistrictListingCard({ p, location, fallback }: { p: QuarterData["properties"][number]; location: string; fallback: string }) {
  const tag = p.is_featured ? "ТОП ОФЕРТА" : "НОВО";
  return (
    <Link to="/properties/$propertyId" params={{ propertyId: p.id }} className="block">
      <article className="marble-hover-card group flex h-full flex-col overflow-hidden rounded-[20px] border border-primary/18 bg-card shadow-[0_18px_42px_rgba(93,39,22,0.16)]">
        <div className="relative aspect-[1.05/0.82] overflow-hidden">
          <img src={p.cover_image_url || fallback} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
          <span className="absolute left-3 top-3 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-primary-foreground shadow">{tag}</span>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-primary shadow">
            <Heart className="h-4 w-4" />
          </button>
          <div className="marble-wave-glow" />
        </div>
        <div className="flex flex-1 flex-col gap-2.5 px-4 pb-4 pt-3">
          <h3 className="font-display text-[1.2rem] leading-tight text-accent-foreground">{p.title}</h3>
          <p className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" />{location}
          </p>
          <div className="flex items-center gap-3 border-t border-primary/10 pt-2.5 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Square className="h-3.5 w-3.5 text-primary" />{p.area_sqm ?? "—"} м²</span>
            <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5 text-primary" />{p.bedrooms ?? 0}</span>
            <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5 text-primary" />{p.bathrooms ?? 0}</span>
          </div>
          <div className="mt-auto flex items-center justify-between pt-1">
            <div className="font-display text-[1.45rem] text-accent-foreground">{formatPrice(p.price, p.currency ?? "EUR")}</div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

type QuarterData = {
  city: { id: string; slug: string; name: string };
  quarter: { id: string; slug: string; name: string; description?: string | null; image_url?: string | null; properties_count?: number | null; avg_price_per_sqm?: number | null };
  properties: Array<{ id: string; title: string; price: number; currency?: string | null; area_sqm?: number | null; bedrooms?: number | null; bathrooms?: number | null; cover_image_url?: string | null; is_featured?: boolean }>;
  gallery?: Array<{ id: string; url: string; is_cover?: boolean; display_order?: number | null }>;
};

export function DistrictPage({ data }: { data?: QuarterData } = {}) {
  const city = data?.city ?? { id: "x", slug: "burgas", name: "Бургас" };
  const quarter = data?.quarter ?? { id: "x", slug: "lazur", name: "Лазур", description: "Един от най-предпочитаните квартали в Бургас – с морска панорама, близост до Морската градина и всички удобства за модерен начин на живот.", image_url: null, properties_count: 312 };
  const properties = data?.properties ?? [];
  const count = quarter.properties_count ?? properties.length;

  return (
    <main className="luxury-page min-h-screen bg-background" style={{ backgroundImage: `url(${marbleBg})`, backgroundSize: "cover" }}>
      {/* Compact split header: marble logo badge left + small burgundy nav strip top-right */}
      <header className="relative">
        <div className="relative h-[90px] md:h-[110px]">
          {/* Marble logo badge with gold curve */}
          <Link to="/" className="absolute left-6 top-3 z-20 md:left-10 md:top-4">
            <img src={logoNadezhda} alt="ИЛДЖ.ИА" className="h-14 w-auto object-contain md:h-[72px]" />
          </Link>
          <svg aria-hidden className="absolute left-0 top-0 z-10 h-full w-[55%]" viewBox="0 0 800 110" preserveAspectRatio="none">
            <defs>
              <linearGradient id="goldEdge2" x1="0" x2="1">
                <stop offset="0%" stopColor="#b8893a" stopOpacity="0" />
                <stop offset="35%" stopColor="#e8c477" />
                <stop offset="65%" stopColor="#f6dc8e" />
                <stop offset="100%" stopColor="#b8893a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M800,50 Q500,80 250,98 Q120,108 0,110" fill="none" stroke="url(#goldEdge2)" strokeWidth="2.5" />
            <path d="M800,62 Q500,92 250,108 Q120,118 0,120" fill="none" stroke="url(#goldEdge2)" strokeWidth="1" opacity="0.5" />
          </svg>
          {/* Burgundy nav strip on the right */}
          <div
            className="absolute right-0 top-0 z-10 flex h-full items-center gap-7 rounded-bl-[60px] px-8 text-[15px] text-primary-foreground md:gap-10 md:px-12"
            style={{
              background: "linear-gradient(135deg, #4d0814 0%, #2a050b 100%)",
              clipPath: "polygon(8% 0, 100% 0, 100% 100%, 0 100%)",
              width: "55%",
            }}
          >
            <div className="ml-auto flex items-center gap-7 md:gap-10">
              {topNav.map((item) => (
                <Link key={item.key} to={item.to} search={item.search as any} className="font-medium text-white drop-shadow-sm hover:text-[#e8c477]">
                  {item.label}
                </Link>
              ))}
              <button aria-label="Профил" className="text-white drop-shadow-sm hover:text-[#e8c477]">
                <User className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="relative px-3 pb-12 md:px-6 md:pb-16">
        <div className="mx-auto mt-4 grid max-w-[1460px] gap-6 px-2 md:px-4 xl:grid-cols-[270px_1fr_360px] xl:items-start">
          <aside className="marble-dark-panel rounded-[22px] p-6 text-primary-foreground shadow-[0_22px_45px_rgba(60,10,20,0.32)]">
            <div className="mb-5 text-center font-display text-[1.55rem] text-primary-foreground">Бързи филтри</div>
            <div className="space-y-6">
              <div>
                <div className="mb-3 border-b border-[var(--color-secondary)]/30 pb-2 text-[15px] uppercase tracking-[0.06em] text-[var(--color-secondary)]">Тип имот</div>
                <div className="space-y-2.5 text-[15px]">
                  {["Апартамент", "Многостаен", "Къща", "Парцел", "Офис", "Магазин"].map((item) => (
                    <label key={item} className="flex items-center gap-3">
                      <input type="checkbox" className="h-[18px] w-[18px] rounded-sm border border-[var(--color-secondary)]/60 bg-transparent accent-[var(--color-secondary)]" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-3 text-[15px] uppercase tracking-[0.06em] text-[var(--color-secondary)]">Цена</div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-sm text-primary-foreground/70">От</span>
                    <div className="flex-1 rounded-[10px] border border-[var(--color-secondary)]/40 bg-black/15 px-3 py-2 text-sm">€</div>
                    <div className="flex-1 rounded-[10px] border border-[var(--color-secondary)]/40 bg-black/15 px-3 py-2 text-sm">€</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-sm text-primary-foreground/70">До</span>
                    <div className="flex-1 rounded-[10px] border border-[var(--color-secondary)]/40 bg-black/15 px-3 py-2 text-sm">€</div>
                  </div>
                </div>
              </div>
              <Button className="h-12 w-full rounded-[12px] border border-[var(--color-secondary)] bg-transparent text-[15px] text-[var(--color-secondary)] hover:bg-[var(--color-secondary)]/10">
                Приложи филтрите
              </Button>
            </div>
          </aside>

          <div className="space-y-5">
            <div className="rounded-[24px] border border-primary/10 bg-card/90 p-6 shadow-[0_18px_45px_rgba(92,41,20,0.12)] md:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                <Link to="/" className="hover:text-primary">Начало</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link to="/cities/$slug" params={{ slug: city.slug }} className="hover:text-primary">{city.name}</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-accent-foreground">{quarter.name}</span>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-[640px]">
                  <h1 className="font-display text-[2.6rem] leading-tight text-accent-foreground md:text-[3.2rem]">
                    {quarter.name}, гр. {city.name}
                  </h1>
                  <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
                    {quarter.description || `Един от най-предпочитаните квартали в ${city.name} – с морска панорама, близост до Морската градина и всички удобства за модерен начин на живот.`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="flex min-w-[110px] flex-col items-center rounded-[16px] border border-primary/15 bg-background px-5 py-3 shadow-sm">
                    <House className="h-5 w-5 text-primary" />
                    <div className="mt-1 font-display text-[1.6rem] leading-none text-accent-foreground">{count}</div>
                    <div className="text-xs text-muted-foreground">имота</div>
                  </div>
                  <button className="flex min-w-[110px] flex-col items-center rounded-[16px] border border-primary/15 bg-background px-5 py-3 shadow-sm transition hover:border-primary/40">
                    <Heart className="h-5 w-5 text-primary" />
                    <div className="mt-1 text-[13px] font-medium text-accent-foreground">Добави</div>
                    <div className="text-xs text-muted-foreground">в любими</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-primary/10 bg-card/90 px-5 py-3 shadow-sm">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>Сортирай по:</span>
                <button className="inline-flex items-center gap-2 rounded-[10px] border border-primary/20 bg-background px-3 py-1.5 text-accent-foreground">
                  Най-нови <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button aria-label="Грид изглед" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-primary/25 bg-primary/10 text-primary">
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
                <button aria-label="Списък изглед" className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-primary/15 bg-background text-muted-foreground hover:text-primary">
                  <Ruler className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {properties.length === 0 ? (
                <div className="rounded-[20px] bg-card p-10 text-center text-muted-foreground sm:col-span-2 xl:col-span-4">
                  Все още няма публикувани имоти в този квартал.
                </div>
              ) : (
                properties.map((p) => (
                  <DistrictListingCard key={p.id} p={p} location={`${quarter.name}, гр. ${city.name}`} fallback={burgasHero} />
                ))
              )}
            </div>

            {data?.gallery && data.gallery.length > 0 ? (
              <div className="rounded-[24px] border border-primary/10 bg-card/90 p-6 shadow-sm md:p-8">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-display text-[1.8rem] text-accent-foreground">Галерия — {quarter.name}</h2>
                  <span className="text-sm text-muted-foreground">{data.gallery.length} снимки</span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {data.gallery.map((img) => (
                    <div key={img.id} className="overflow-hidden rounded-[14px] border border-primary/15 shadow-sm">
                      <img src={img.url} alt={quarter.name} className="h-40 w-full object-cover transition duration-500 hover:scale-105" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DistrictMapCard name={quarter.name} />
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
            <MortgageRangeBand
              price={Number(property.price) || 0}
              currency={property.currency ?? "EUR"}
              propertyId={property.id}
              propertyTitle={property.title}
            />
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

