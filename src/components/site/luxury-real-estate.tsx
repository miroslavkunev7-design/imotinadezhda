import { useEffect, useState as useReactState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import {
  Award,
  Bath,
  BedDouble,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Handshake,
  Heart,
  House,
  LandPlot,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
  Search,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trees,
  Trophy,
  User,
  Box,
} from "lucide-react";

import burgasHero from "@/assets/burgas-hero.jpeg";
import burgasPier from "@/assets/burgas-pier.jpeg";
import homeHero from "@/assets/home-hero-living.jpeg";
import cityShumen from "@/assets/city-shumen.jpeg";
import cityBurgas from "@/assets/city-burgas.jpeg";
import cityVarna from "@/assets/city-varna.jpeg";
import cityNoviPazar from "@/assets/city-novi-pazar.jpeg";
import cityCardBurgas from "@/assets/city-card-burgas.png.asset.json";
import cityCardVarna from "@/assets/city-card-varna.png.asset.json";
import cityCardShumen from "@/assets/city-card-shumen.png.asset.json";
import cityCardNoviPazar from "@/assets/city-card-novi-pazar.png.asset.json";

import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MortgageRangeBand } from "@/components/site/mortgage-range-band";
import { SiteHeader, type SiteNavKey } from "@/components/site/site-header";
import { GoldDustLayer } from "@/components/site/gold-dust-card";

// Route external images through a CDN proxy to bypass cross-origin resource policy blocks.
function proxyImage(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.includes("images.weserv.nl")) return url;
  try {
    const u = new URL(url);
    const stripped = u.host + u.pathname + (u.search || "");
    return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}`;
  } catch {
    return url;
  }
}


type NavKey = SiteNavKey;

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


/**
 * Backwards-compatible alias for the old per-section LuxuryHeader. Every page
 * now renders the unified <SiteHeader />, but existing imports keep working.
 */
export function LuxuryHeader({ active = "sale" }: { active?: NavKey; dark?: boolean }) {
  return <SiteHeader active={active} />;
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
  variant = "light",
}: {
  cities?: Array<{ slug: string; name: string }>;
  quarters?: Array<{ slug: string; name: string }>;
  initial?: { city_slug?: string; quarter_slug?: string; property_type?: string; price_min?: string; price_max?: string; area_min?: string; area_max?: string };
  variant?: "light" | "burgundy";
}) {
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

  const navigate = useNavigate();
  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (city) params.city_slug = city;
    if (quarter) params.quarter_slug = quarter;
    if (ptype) params.property_type = ptype;
    if (priceMin) params.price_min = priceMin;
    if (priceMax) params.price_max = priceMax;
    if (areaMin) params.area_min = areaMin;
    if (areaMax) params.area_max = areaMax;
    navigate({ to: "/search", search: params as never });
  };

  const cityOptions = cities.length ? cities : [
    { slug: "burgas", name: "Бургас" },
    { slug: "varna", name: "Варна" },
    { slug: "shumen", name: "Шумен" },
    { slug: "novi-pazar", name: "Нов пазар" },
  ];

  const isBurgundy = variant === "burgundy";

  void isBurgundy; // variant kept for API compatibility; design is unified now

  return (
    <div className="relative mx-auto w-full max-w-[1320px]">
      <div
        className="relative flex w-full items-stretch gap-0 overflow-visible rounded-full border px-2 py-2 md:px-3 md:py-2"
        style={{
          background: "linear-gradient(180deg, #8B1A2B 0%, #6e1422 100%)",
          borderColor: "rgba(201,168,76,0.55)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(201,168,76,0.12)",
        }}
      >
        <div className="flex flex-1 flex-wrap items-stretch md:flex-nowrap">
          <PillCell icon={MapPin} label="Град" value={city} onChange={setCity}
            options={cityOptions.map((c) => ({ value: c.slug, label: c.name }))} />
          <PillDivider />
          <PillCell icon={House} label="Квартал" value={quarter} onChange={setQuarter}
            options={[{ value: "", label: "Всички" }, ...quarters.map((q) => ({ value: q.slug, label: q.name }))]} />
          <PillDivider />
          <PillCell icon={Building2} label="Вид имот" value={ptype} onChange={setPtype}
            options={propertyTypeOptions} />
          <PillDivider />
          <PillRangeCell icon={LandPlot} label="Цена" minVal={priceMin} maxVal={priceMax}
            onMin={setPriceMin} onMax={setPriceMax} suffix="€" />
          <PillDivider />
          <PillRangeCell icon={Ruler} label="Площ" minVal={areaMin} maxVal={areaMax}
            onMin={setAreaMin} onMax={setAreaMax} suffix="m²" />
        </div>

        <div className="flex flex-none items-center gap-2 pl-2 md:gap-3 md:pl-3">
          <button
            type="button"
            onClick={handleSearch}
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 font-display text-sm font-semibold transition hover:brightness-110 md:h-12 md:px-7 md:text-base"
            style={{
              background: "linear-gradient(180deg, #E3BF66 0%, #C9A84C 60%, #A8852E 100%)",
              color: "#5E0F1D",
              boxShadow: "0 6px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            <Search className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.25} />
            <span className="uppercase tracking-wide">Търси</span>
          </button>
          <button
            type="button"
            className="hidden items-center gap-1.5 px-1 font-display text-[12px] text-[#C9A84C] transition hover:text-white md:inline-flex md:text-[13px]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="leading-tight">
              Още
              <br />
              филтри
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PillDivider() {
  return (
    <span aria-hidden className="my-2 hidden w-px self-stretch md:inline-block" style={{ backgroundColor: "rgba(201,168,76,0.35)" }} />
  );
}

function PillCell({
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
  const [open, setOpen] = useReactState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div
      className="relative flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 md:gap-3 md:px-4 md:py-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Icon className="h-4 w-4 flex-none md:h-5 md:w-5" style={{ color: "#C9A84C" }} strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#C9A84C] md:text-[10px]">{label}</div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="-ml-px mt-0.5 flex w-full items-center justify-between gap-2 bg-transparent text-left font-display text-sm text-white outline-none md:text-[15px]"
        >
          <span className="truncate">{selected?.label ?? "—"}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 flex-none text-[#C9A84C] transition md:h-4 md:w-4", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div
          role="listbox"
          className="absolute left-2 right-2 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl border bg-white py-1 text-[#2b1418] shadow-[0_18px_45px_rgba(0,0,0,0.25)]"
          style={{ borderColor: "rgba(201,168,76,0.5)" }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm transition hover:bg-amber-50",
                option.value === value && "bg-amber-50 font-semibold text-[#8B1A2B]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PillRangeCell({
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
    <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 md:gap-3 md:px-4 md:py-2">
      <Icon className="h-4 w-4 flex-none md:h-5 md:w-5" style={{ color: "#C9A84C" }} strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#C9A84C] md:text-[10px]">{label}</div>
        <div className="mt-0.5 flex items-center gap-1 font-display text-[12px] text-white md:text-[13px]">
          <span className="text-white/70">от</span>
          <input
            value={minVal}
            onChange={(e) => onMin(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-12 bg-transparent outline-none placeholder:text-white/40 md:w-16"
          />
          <span className="text-white/60">-</span>
          <span className="text-white/70">до</span>
          <input
            value={maxVal}
            onChange={(e) => onMax(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-12 bg-transparent outline-none placeholder:text-white/40 md:w-16"
          />
          <span className="text-white/70">{suffix}</span>
        </div>
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
  const [open, setOpen] = useReactState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className="relative flex min-h-[54px] items-center gap-2 border-primary/15 px-2 md:min-h-[60px] md:gap-3 md:border-r md:px-3"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-primary/35 bg-primary/8 text-primary md:h-11 md:w-11">
        <Icon className="h-4 w-4 md:h-5 md:w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wide text-primary/70 md:text-[11px]">{label}</div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="-ml-1 mt-0.5 flex w-full items-center justify-between gap-2 bg-transparent text-left font-display text-sm text-primary outline-none md:text-lg"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="truncate">{selected?.label ?? "—"}</span>
        </button>
      </div>
      <ChevronDown className={cn("h-3.5 w-3.5 flex-none text-primary/70 transition md:h-4 md:w-4", open && "rotate-180")} />
      {open && (
        <div
          role="listbox"
          className="absolute left-12 right-2 top-[calc(100%-4px)] z-50 overflow-hidden rounded-xl border border-amber-500/35 bg-white py-1 text-primary shadow-[0_18px_45px_rgba(139,26,43,0.16)] md:left-16"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm transition hover:bg-amber-50",
                option.value === value && "bg-amber-50 font-semibold text-primary",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
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
    <div className="flex min-h-[54px] items-center gap-1.5 border-primary/15 px-1.5 md:min-h-[60px] md:gap-3 md:border-r md:px-3">
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-primary/35 bg-primary/8 text-primary md:h-11 md:w-11">
        <Icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-medium uppercase tracking-wide text-primary/70 md:text-[11px]">{label}</div>
        <div className="flex items-center gap-0.5 text-primary md:gap-1">
          <span className="text-[9px] text-primary/60 md:text-[11px]">от</span>
          <input value={minVal} onChange={(e) => onMin(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-8 bg-transparent font-display text-[11px] outline-none placeholder:text-primary/40 md:w-16 md:text-base" />
          <span className="hidden text-[9px] text-primary/60 md:inline md:text-[11px]">{suffix}</span>
          <span className="mx-0.5 text-primary/40">·</span>
          <span className="text-[9px] text-primary/60 md:text-[11px]">до</span>
          <input value={maxVal} onChange={(e) => onMax(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-8 bg-transparent font-display text-[11px] outline-none placeholder:text-primary/40 md:w-16 md:text-base" />
          <span className="text-[9px] text-primary/60 md:text-[11px]">{suffix}</span>
        </div>
      </div>
    </div>
  );
}


const cityPhotos: Record<string, string> = {
  burgas: cityPhotoBurgas.url,
  varna: cityPhotoVarna.url,
  shumen: cityPhotoShumen.url,
  "novi-pazar": cityPhotoNoviPazar.url,
};

function CityCard({ name, href, params }: { name: string; image?: string; href: "/cities/$slug"; params: { slug: string } }) {
  const photo = cityPhotos[params.slug] ?? cityPhotoBurgas.url;
  const curlId = `curlTL-${params.slug}`;
  return (
    <Link
      to={href}
      params={params}
      aria-label={name}
      className="group relative block aspect-[3/2] w-full overflow-visible transition-transform duration-500 hover:-translate-y-1"
    >
      {/* Card frame: thin gold border on near-black */}
      <div
        className="relative h-full w-full overflow-hidden rounded-[18px] border border-[#C9A84C]/80 bg-[#0f0a0b] shadow-[0_24px_50px_-18px_rgba(0,0,0,0.7)]"
      >
        {/* Photo */}
        <img
          src={photo}
          alt={name}
          className="block h-full w-full select-none object-cover transition duration-700 group-hover:scale-[1.04]"
          draggable={false}
          loading="lazy"
        />
        {/* Bottom dark gradient — ~40% */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/55 to-transparent" />

        {/* Top-left "ВИЖ ГРАДА" pill (offset right of curl) */}
        <div className="absolute left-14 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-md backdrop-blur-sm">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-[#C9A84C]" aria-hidden>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
          </svg>
          ВИЖ ГРАДА
        </div>

        {/* Bottom-left city name + fleur ornament */}
        <div className="absolute bottom-5 left-6 right-24">
          <div
            className="font-serif text-4xl font-bold uppercase leading-none tracking-[0.04em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-5xl"
            style={{ fontFamily: '"Cormorant Garamond", "Playfair Display", Georgia, serif' }}
          >
            {name}
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[#C9A84C]">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#C9A84C]" />
            <span className="text-base leading-none">⚜</span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#C9A84C]" />
          </div>
        </div>

        {/* Bottom-right bordeaux circle arrow */}
        <div className="absolute bottom-5 right-5 grid h-12 w-12 place-items-center rounded-full border border-[#C9A84C]/70 bg-[#8B1A2B] text-white shadow-[0_6px_14px_rgba(0,0,0,0.6)] transition group-hover:scale-110">
          <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-white" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </div>

        {/* Parchment curl — top-left only */}
        <svg viewBox="0 0 80 80" className="pointer-events-none absolute -left-px -top-px h-16 w-16" aria-hidden>
          <defs>
            <linearGradient id={curlId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f5e5b8" />
              <stop offset="55%" stopColor="#d9b56a" />
              <stop offset="100%" stopColor="#7a5821" />
            </linearGradient>
          </defs>
          {/* peeled triangle revealing parchment */}
          <path d="M0,0 L70,0 C40,8 8,40 0,70 Z" fill={`url(#${curlId})`} />
          {/* subtle dark shadow underline along curl edge */}
          <path d="M70,0 C40,8 8,40 0,70" fill="none" stroke="#3a2710" strokeWidth="0.9" opacity="0.55" />
        </svg>
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
    <article
      className="marble-hover-card group flex flex-col overflow-hidden rounded-[14px] border border-[#dc2626]/40 shadow-[0_14px_30px_rgba(139, 26, 43,0.18)]"
      style={{
        background:
          "linear-gradient(180deg, rgba(252,246,232,0.98), rgba(245,234,210,0.97))",
      }}
    >
      <div className="relative aspect-[1.3/1] overflow-hidden p-1.5">
        <img
          src={proxyImage(image) || burgasHero}
          alt={title}
          className="h-full w-full rounded-[10px] object-cover transition duration-500 group-hover:scale-[1.04]"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (!img.dataset.fellBack) {
              img.dataset.fellBack = "1";
              img.src = burgasHero;
            }
          }}
        />
        <GoldDustLayer />
      </div>
      <div className="relative px-3 pb-3 pt-1">
        <div className="font-display text-[1rem] leading-tight text-[#4A4A4A] md:text-[1.1rem]">{title}</div>
        <div className="mt-1 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[10.5px] text-[#525252] md:text-[11.5px]">
            <MapPin className="h-3 w-3 text-[#b91c1c]" />
            {count} имота
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#dc2626]/60 text-[#525252]">
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
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
    <article className="marble-hover-card group overflow-hidden rounded-[20px] border border-primary/18 bg-card shadow-[0_20px_45px_rgba(139, 26, 43,0.16)]">
      <div className="relative aspect-[1.08/0.82] overflow-hidden">
        <img src={image} alt={title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        {tag ? <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold tracking-[0.08em] text-primary-foreground">{tag}</span> : null}
        <button type="button" aria-label="Добави в любими" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-primary shadow">
          <Heart className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-[rgba(225,29,72,0.88)] px-3.5 py-1.5 text-xs font-semibold tracking-[0.08em] text-primary-foreground shadow-[0_8px_22px_rgba(139, 26, 43,0.45)] backdrop-blur-sm transition hover:bg-[rgba(225,29,72,0.95)]"
          aria-label="3D виртуален оглед"
        >
          <Box className="h-3.5 w-3.5 text-primary" />
          3D Виртуален оглед
        </button>
        <div className="marble-wave-glow" />
        <GoldDustLayer />
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
    <aside className="marble-dark-panel space-y-4 rounded-[20px] p-5 text-primary-foreground shadow-[0_22px_45px_rgba(139, 26, 43,0.3)]">
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
    <aside className="marble-dark-panel rounded-[20px] p-6 text-primary-foreground shadow-[0_22px_45px_rgba(139, 26, 43,0.28)]">
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
    <aside className="overflow-hidden rounded-[22px] border border-primary/15 bg-card shadow-[0_20px_45px_rgba(139, 26, 43,0.16)]">
      <div className="p-4">
        <div className="font-display text-[1.8rem] text-accent-foreground">Локация</div>
        <p className="mt-1 text-base text-muted-foreground">кв. Лазур, гр. Бургас</p>
      </div>
      <div className="relative h-[300px] overflow-hidden border-y border-primary/10 bg-[linear-gradient(135deg,rgba(212,212,212,0.85),rgba(229,229,229,0.92))]">
        <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(90deg, rgba(120,106,94,0.18) 1px, transparent 1px), linear-gradient(rgba(120,106,94,0.18) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className={cn("absolute inset-y-0 right-[12%] w-[22%] bg-[linear-gradient(180deg,rgba(56,136,180,0.6),rgba(34,125,180,0.78))]", district ? "w-[28%]" : "")} />
        {district ? <div className="absolute inset-y-[12%] right-[18%] w-[28%] rounded-[40%] bg-[rgba(225,29,72,0.5)] border border-[rgba(225,29,72,0.4)]" /> : null}
        <div className={cn("absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card text-primary shadow-[0_0_0_8px_rgba(225,29,72,0.18)]", district && "left-[58%] top-[58%]") }>
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

export function HomePage({
  cities,
  featured,
  layout,
}: {
  cities?: HomeCity[];
  featured?: FeaturedListing[];
  layout?: Array<{ id: string; visible: boolean }> | null;
} = {}) {
  const cityList = (cities && cities.length ? cities : homeCities.map((c) => ({ name: c.name, image: c.image, slug: c.params.slug })))
    .map((c) => ({ ...c, image: citySlugImages[c.slug] || c.image || burgasHero }));
  const cityOpts = cityList.map((c) => ({ slug: c.slug, name: c.name }));

  // Default order if no saved layout
  const defaults: Array<{ id: string; visible: boolean }> = [
    { id: "hero-search-mobile", visible: true },
    { id: "hero-search-desktop", visible: true },
    { id: "cities-grid", visible: true },
    { id: "trust-strip", visible: true },
  ];
  const known = new Set(defaults.map((d) => d.id));
  const sections = (() => {
    if (!layout || !Array.isArray(layout)) return defaults;
    const seen = new Set<string>();
    const out: Array<{ id: string; visible: boolean }> = [];
    for (const s of layout) {
      if (known.has(s.id) && !seen.has(s.id)) {
        out.push({ id: s.id, visible: !!s.visible });
        seen.add(s.id);
      }
    }
    for (const d of defaults) if (!seen.has(d.id)) out.push(d);
    return out;
  })();

  const sectionNode = (id: string) => {
    switch (id) {
      case "hero-search-mobile":
        return (
          <div
            key={id}
            data-section-id="hero-search-mobile"
            className="relative z-20 mx-auto mt-4 w-full max-w-[1440px] px-4 md:mt-7 md:px-8 lg:hidden"
          >
            <SearchBar cities={cityOpts} variant="burgundy" />
          </div>

        );
      case "hero-search-desktop":
        return (
          <div key={id} data-section-id="hero-search-desktop" className="mb-4 hidden lg:block">
            <SearchBar cities={cityOpts} variant="burgundy" />
          </div>
        );
      case "cities-grid":
        return (
          <div key={id} data-section-id="cities-grid" className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
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
        );
      case "trust-strip":
        return <TrustStrip key={id} />;
      default:
        return null;
    }
  };

  const visible = sections.filter((s) => s.visible);
  const mobileSections = visible.filter((s) => s.id === "hero-search-mobile");
  const desktopSections = visible.filter((s) => s.id !== "hero-search-mobile");

  const heroSections = desktopSections.filter((s) => s.id !== "trust-strip");
  const belowSections = desktopSections.filter((s) => s.id === "trust-strip");

  return (
    <main className="luxury-page flex h-screen flex-col overflow-hidden bg-[#0f0a0b] text-foreground">
      <section
        className="relative flex flex-1 min-h-0 flex-col pb-3 pt-0"
        style={{
          backgroundImage: `url(${homeHero})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <LuxuryHeader active="sale" />

        {mobileSections.map((s) => sectionNode(s.id))}

        <section className="relative z-10 mx-auto mt-auto w-full max-w-[1420px] px-4 pt-3 md:px-8 md:pt-5">
          {heroSections.map((s) => sectionNode(s.id))}
        </section>
      </section>
      <div className="flex-none">
        {belowSections.map((s) => sectionNode(s.id))}
      </div>
    </main>
  );
}



function TrustStrip() {
  const items = [
    { Icon: Shield, title: "Сигурност", desc: "Вашата сделка е на сигурно място" },
    { Icon: Award, title: "Коректност", desc: "Работим честно и прозрачно" },
    { Icon: Handshake, title: "Доверие", desc: "Дългосрочни отношения с нашите клиенти" },
    { Icon: MapPin, title: "Локално знание", desc: "Най-добри оферти във всеки град" },
  ];
  return (
    <section data-section-id="trust-strip" className="bg-[#0f0a0b] py-3 md:py-5">
      <div className="mx-auto flex w-full max-w-[1420px] flex-col items-stretch gap-8 px-4 md:px-8 lg:flex-row lg:items-center lg:gap-10">
        <div className="grid flex-1 grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          {items.map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full border md:h-12 md:w-12"
                style={{ borderColor: "rgba(201,168,76,0.55)", backgroundColor: "rgba(201,168,76,0.08)" }}
              >
                <Icon className="h-5 w-5 md:h-6 md:w-6" style={{ color: "#C9A84C" }} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="font-display text-base font-semibold text-white md:text-lg">{title}</div>
                <div className="mt-1 text-[12px] leading-snug text-white/65 md:text-[13px]">{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="inline-flex h-12 flex-none items-center justify-center gap-2 self-start rounded-full border px-6 font-display text-sm text-white transition hover:brightness-110 md:h-14 md:px-8 md:text-base lg:self-auto"
          style={{
            background: "linear-gradient(180deg, #8B1A2B 0%, #5E0F1D 100%)",
            borderColor: "rgba(201,168,76,0.6)",
            boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
          }}
        >
          <MessageCircle className="h-4 w-4 md:h-5 md:w-5" style={{ color: "#C9A84C" }} strokeWidth={2} />
          <span>Чат с консултант</span>
        </button>
      </div>
    </section>
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
  const city = data?.city ?? {
    slug: "shumen",
    name: "Шумен",
    description:
      "Исторически и модерен град в сърцето на Североизточна България. Благоприятна среда за инвестиции, за живот и бизнес.",
    hero_image_url: null,
    region: "Стратегическо местоположение",
    population: 85000,
    area_km2: 436,
  };
  const quarters =
    data?.quarters && data.quarters.length
      ? data.quarters
      : burgasDistricts.map((d, i) => ({
          id: String(i),
          slug: d.name.toLowerCase(),
          name: d.name,
          image_url: d.image,
          properties_count: d.count,
        }));
  const properties = data?.properties ?? [];

  const heroImage =
    (city.hero_image_url && !/^https?:/i.test(city.hero_image_url)
      ? city.hero_image_url
      : citySlugImages[city.slug]) || cityShumen;

  const fmt = (n: number) => new Intl.NumberFormat("bg-BG").format(n);

  return (
    <main className="min-h-screen bg-[#fbf6ea] text-[#2b1418]">
      {/* HERO with overlay navbar */}
      <section className="relative">
        <div className="relative h-[68vh] min-h-[540px] w-full overflow-hidden md:h-[72vh]">
          <img src={heroImage} alt={city.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-[#5e0f1d]/40" />

          {/* Overlay navbar */}
          <div className="absolute inset-x-0 top-0 z-30">
            <LuxuryHeader active="sale" />
          </div>


          {/* Right-side overlays */}
          <div className="absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col gap-4 p-4 pt-[120px] md:p-6 md:pt-[130px]">
            {/* FILTER PANEL */}
            <div
              className="rounded-2xl p-3.5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
              style={{ background: "linear-gradient(135deg,#8B1A2B 0%,#5e0f1d 100%)" }}
            >
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Град", value: city.name, icon: MapPin },
                  { label: "Вид имот", value: "Всички", icon: House },
                  { label: "Цена", value: "Без значение", icon: LandPlot },
                ].map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl bg-[#5e0f1d]/80 px-2.5 py-2 text-left ring-1 ring-[#C9A84C]/20 transition hover:bg-[#5e0f1d]"
                  >
                    <f.icon className="h-3.5 w-3.5 flex-none text-[#C9A84C]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[8.5px] uppercase tracking-[0.12em] text-[#C9A84C]/90">{f.label}</div>
                      <div className="truncate text-[11px] text-white">{f.value}</div>
                    </div>
                    <ChevronDown className="h-3 w-3 flex-none text-[#C9A84C]/80" />
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="col-span-2 flex items-center gap-1.5 rounded-xl bg-[#5e0f1d]/80 px-2.5 py-2 text-left ring-1 ring-[#C9A84C]/20 transition hover:bg-[#5e0f1d]"
                >
                  <Square className="h-3.5 w-3.5 flex-none text-[#C9A84C]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[8.5px] uppercase tracking-[0.12em] text-[#C9A84C]/90">Площ</div>
                    <div className="truncate text-[11px] text-white">Без значение</div>
                  </div>
                  <ChevronDown className="h-3 w-3 flex-none text-[#C9A84C]/80" />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-[#5e0f1d] transition hover:brightness-105"
                  style={{
                    background: "linear-gradient(180deg,#E8C766 0%,#C9A84C 100%)",
                    boxShadow: "0 6px 16px rgba(201,168,76,0.45), inset 0 1px 0 rgba(255,255,255,0.45)",
                  }}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Филтри
                </button>
              </div>
            </div>

            {/* CITY INFO CARD */}
            <div
              className="mt-auto overflow-hidden rounded-2xl text-white shadow-[0_24px_60px_rgba(0,0,0,0.35)] ring-1 ring-[#C9A84C]/25"
              style={{ background: "linear-gradient(135deg,#8B1A2B 0%,#5e0f1d 100%)" }}
            >
              <div className="flex gap-3 p-3.5 md:gap-4 md:p-4">
                <img src={heroImage} alt="" className="h-24 w-24 flex-none rounded-xl object-cover ring-1 ring-[#C9A84C]/30" loading="lazy" decoding="async" />
                <div className="min-w-0">
                  <div className="text-[9.5px] uppercase tracking-[0.22em] text-[#C9A84C]">За града</div>
                  <h1 className="mt-1 font-display text-[2.2rem] leading-none text-white">{city.name}</h1>
                  <p className="mt-2 line-clamp-3 text-[11px] leading-snug text-white/85">{city.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1 border-t border-[#C9A84C]/15 px-3 py-3">
                {[
                  {
                    icon: User,
                    val: city.population ? `≈ ${fmt(city.population)}` : "—",
                    label: "жители",
                  },
                  {
                    icon: Square,
                    val: city.area_km2 ? `${fmt(city.area_km2)} km²` : "—",
                    label: "площ",
                  },
                  { icon: MapPin, val: "Стратегическо", label: "местоположение" },
                  { icon: Building2, val: `${properties.length || 327}`, label: "активни имота" },
                ].map((s, i) => (
                  <div key={i} className="flex flex-col items-center text-center">
                    <s.icon className="h-4 w-4 text-[#C9A84C]" />
                    <div className="mt-1 text-[11.5px] font-semibold leading-tight text-white">{s.val}</div>
                    <div className="text-[9px] leading-tight text-white/70">{s.label}</div>
                  </div>
                ))}
              </div>
              <Link
                to="/search"
                search={{ city_slug: city.slug } as never}
                className="flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-semibold text-[#5e0f1d] transition hover:brightness-105"
                style={{
                  background: "linear-gradient(180deg,#E8C766 0%,#C9A84C 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
                }}
              >
                Разгледай имоти в {city.name}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* NEIGHBORHOODS */}
      <section className="bg-[#F5E6D3] px-4 py-10 md:px-8">
        <div className="mx-auto max-w-[1480px]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl text-[#8B1A2B] md:text-2xl">
              <Compass className="h-5 w-5 text-[#C9A84C]" />
              Квартали в {city.name}
            </h2>
            <Link
              to="/cities/$slug"
              params={{ slug: city.slug }}
              className="text-sm text-[#8B1A2B] transition hover:underline"
            >
              Виж всички квартали →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-4">
            {quarters.slice(0, 5).map((q, i) => {
              const remote = q.image_url || "";
              const usesRemote = remote && !/^https?:/i.test(remote);
              const fallbacks = [cityShumen, cityBurgas, cityVarna, cityNoviPazar, heroImage];
              const img = usesRemote ? remote : fallbacks[i % fallbacks.length];
              return (
                <Link
                  key={q.id}
                  to="/cities/$slug/districts/$district"
                  params={{ slug: city.slug, district: q.slug }}
                  className="group overflow-hidden rounded-xl border border-[#C9A84C]/40 bg-white shadow-[0_8px_24px_rgba(139,26,43,0.10)] transition hover:shadow-[0_14px_32px_rgba(139,26,43,0.18)]"
                >
                  <div className="relative aspect-[1.25/1] overflow-hidden">
                    <img
                      src={img}
                      alt={q.name}
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                      loading="lazy"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-[70%]"
                      style={{
                        background: "linear-gradient(180deg, transparent 0%, rgba(94,15,29,0.85) 100%)",
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="font-display text-[1rem] leading-tight text-white">{q.name}</div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-[11px] text-white/90">
                          <MapPin className="h-3 w-3 text-[#C9A84C]" />
                          {q.properties_count ?? 0} имота
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-[#C9A84C]" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <Link
            to="/cities/$slug"
            params={{ slug: city.slug }}
            className="mx-auto mt-7 flex max-w-[720px] items-center justify-center gap-3 rounded-xl px-6 py-3.5 font-display text-[14px] text-white shadow-[0_14px_32px_rgba(139,26,43,0.30)] transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#8B1A2B 0%,#5e0f1d 100%)" }}
          >
            <House className="h-4 w-4 text-[#C9A84C]" />
            Виж всички квартали в {city.name}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-[#F5E6D3] px-4 pb-12 md:px-8">
        <div className="mx-auto max-w-[1480px] rounded-2xl border border-[#C9A84C]/40 bg-[#fbf6ea] p-5 md:p-7">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
            {[
              { icon: Shield, title: "Доверие и сигурност", desc: "Прозрачност във всяка сделка" },
              { icon: User, title: "Персонален подход", desc: "Индивидуално отношение към всеки клиент" },
              { icon: Award, title: "Богат избор", desc: "Голямо разнообразие от имоти в региона" },
              { icon: Trophy, title: "Професионализъм", desc: "Опитен екип с доказани резултати" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-[#C9A84C]/50 bg-[#fdf6e3] text-[#C9A84C]">
                  <f.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-[15px] leading-tight text-[#8B1A2B]">{f.title}</div>
                  <div className="mt-1 text-[12px] leading-snug text-[#2b1418]/70">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function StatItem({ icon: Icon, value, label }: { icon: typeof User; value: string; label: string }) {
  return (
    <div className="flex flex-col items-start gap-1 md:gap-2">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#ef4444] md:h-11 md:w-11 md:rounded-[10px]"
        style={{
          background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(185,28,28,0.04))",
          border: "1px solid rgba(220,38,38,0.45)",
          boxShadow: "inset 0 0 0 1px rgba(239,68,68,0.08), 0 4px 12px rgba(139, 26, 43,0.25)",
        }}
      >
        <Icon className="h-[14px] w-[14px] md:h-[18px] md:w-[18px]" />
      </div>
      <div className="mt-0.5 font-display text-[0.85rem] leading-tight text-[#ef4444] md:mt-1 md:text-[1.25rem]">{value}</div>
      <div className="text-[10px] leading-tight text-[#e5e5e5]/90 md:text-[12.5px]">{label}</div>
    </div>
  );
}

function QuartersScroller({ quarters, citySlug, fallbackImage }: { quarters: Array<{ id: string; slug: string; name: string; image_url?: string | null; properties_count?: number | null }>; citySlug: string; fallbackImage: string }) {
  const visible = quarters.slice(0, 5);
  const localCycle = [burgasHero, burgasPier, cityBurgas, homeHero, fallbackImage];
  return (
    <div className="relative grid grid-cols-2 gap-2.5 md:grid-cols-5 md:gap-3">
      {visible.map((q, idx) => {
        // External image_urls (e.g. realistimo) are blocked cross-origin, so prefer
        // a local fallback image cycled by index for visual variety.
        const remote = q.image_url || "";
        const usesLocal = !remote || /^https?:\/\//i.test(remote);
        const img = usesLocal ? localCycle[idx % localCycle.length] : remote;
        return (
          <Link
            key={q.id}
            to="/cities/$slug/districts/$district"
            params={{ slug: citySlug, district: q.slug }}
            className="block"
          >
            <MarblePropertyCard title={q.name} count={q.properties_count ?? 0} image={img} />
          </Link>
        );
      })}
    </div>
  );
}


function DistrictMapCard({ name }: { name: string }) {
  return (
    <aside className="overflow-hidden rounded-[26px] border border-primary/20 bg-card shadow-[0_24px_55px_rgba(88,40,18,0.18)]">
      <div className="relative h-[520px] overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(135deg,#525252 0%,#737373 35%,#404040 70%,#525252 100%)" }} />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(139, 26, 43,0.55) 1px, transparent 1px), linear-gradient(rgba(139, 26, 43,0.55) 1px, transparent 1px), linear-gradient(45deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
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
            background: "rgba(225,29,72,0.78)",
            border: "1.5px solid rgba(220,38,38,0.65)",
            clipPath: "polygon(20% 0,80% 6%,100% 32%,92% 68%,72% 96%,38% 100%,8% 78%,0 40%)",
            boxShadow: "0 0 30px rgba(225,29,72,0.45) inset",
          }}
        />
        <div className="absolute font-display tracking-[0.18em] text-primary-foreground" style={{ top: "44%", left: "44%", fontSize: "2rem", textShadow: "0 2px 8px rgba(139, 26, 43,0.55)" }}>
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
      <article className="marble-hover-card group flex h-full flex-col overflow-hidden rounded-[20px] border border-primary/18 bg-card shadow-[0_18px_42px_rgba(139, 26, 43,0.16)]">
        <div className="relative aspect-[1.05/0.82] overflow-hidden">
          <img src={p.cover_image_url || fallback} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
          <span className="absolute left-3 top-3 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-primary-foreground shadow">{tag}</span>
          <button type="button" aria-label="Добави в любими" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-primary shadow">
            <Heart className="h-4 w-4" />
          </button>
          <div className="marble-wave-glow" />
          <GoldDustLayer />
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
    <main className="luxury-page min-h-screen bg-background" style={{ backgroundImage: `none`, backgroundSize: "cover" }}>
      <LuxuryHeader active="sale" />



      <section className="relative px-3 pb-12 md:px-6 md:pb-16">
        <div className="mx-auto mt-4 grid max-w-[1460px] gap-6 px-2 pt-[120px] md:px-4 md:pt-[180px] xl:grid-cols-[270px_1fr_360px] xl:items-start xl:pt-[230px]">
          <aside className="marble-dark-panel rounded-[22px] p-6 text-primary-foreground shadow-[0_22px_45px_rgba(139, 26, 43,0.32)]">
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
                    <div className="flex-1 rounded-[10px] border border-[var(--color-secondary)]/40 bg-[#8B1A2B]/12 px-3 py-2 text-sm">€</div>
                    <div className="flex-1 rounded-[10px] border border-[var(--color-secondary)]/40 bg-[#8B1A2B]/12 px-3 py-2 text-sm">€</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-sm text-primary-foreground/70">До</span>
                    <div className="flex-1 rounded-[10px] border border-[var(--color-secondary)]/40 bg-[#8B1A2B]/12 px-3 py-2 text-sm">€</div>
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

  const mainFact = facts[0];
  const restFacts = facts.slice(1);

  return (
    <main className="luxury-page flex h-screen flex-col overflow-hidden bg-background">
      <LuxuryHeader active="sale" />

      <div className="mx-auto w-full max-w-[1460px] flex-shrink-0 px-4 pt-3 md:px-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">Начало</Link><ChevronRight className="h-3.5 w-3.5" />
          {citySlug ? <Link to="/cities/$slug" params={{ slug: citySlug }} className="hover:text-primary">{cityName}</Link> : <span>{cityName}</span>}
          {quarterName ? <><ChevronRight className="h-3.5 w-3.5" /><span>{quarterName}</span></> : null}
          <ChevronRight className="h-3.5 w-3.5" /><span className="line-clamp-1 text-accent-foreground">{property.title}</span>
        </div>
      </div>

      <section className="mx-auto flex w-full max-w-[1460px] flex-1 min-h-0 flex-col px-4 py-3 md:px-6 md:py-4">
        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[1.55fr_1fr]">
          {/* LEFT — Gallery */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-[24px] bg-card p-3 shadow-[0_18px_38px_rgba(139,26,43,0.12)] md:p-4">
            <PropertyGallery images={gallery} title={property.title} />
          </div>

          {/* RIGHT — Price panel + facts + CTA + description */}
          <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
            {/* Title + price card */}
            <div className="flex-shrink-0 rounded-[24px] bg-card p-4 shadow-[0_18px_38px_rgba(139,26,43,0.12)] md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {property.is_featured ? <div className="mb-2 inline-flex rounded-full bg-primary px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-primary-foreground">ТОП ОФЕРТА</div> : null}
                  <h1 className="font-display text-2xl leading-tight text-accent-foreground md:text-[2rem]">{property.title}</h1>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4 text-primary" />{quarterName ? `кв. ${quarterName}, ` : ""}гр. {cityName}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 text-muted-foreground">
                  <button aria-label="Любими" className="rounded-full border border-primary/20 p-2 hover:bg-primary/5"><Heart className="h-4 w-4 text-primary" /></button>
                  <button aria-label="Сподели" className="rounded-full border border-primary/20 p-2 hover:bg-primary/5"><Share2 className="h-4 w-4 text-primary" /></button>
                </div>
              </div>

              {mainFact ? (
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-primary/10 pt-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{mainFact.label}</div>
                    <div className="font-display text-3xl leading-none text-primary md:text-[2.4rem]">{mainFact.value}</div>
                    {mainFact.sub ? <div className="mt-1 text-xs text-muted-foreground">{mainFact.sub}</div> : null}
                  </div>
                </div>
              ) : null}

              {restFacts.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-primary/10 pt-3 sm:grid-cols-4">
                  {restFacts.slice(0, 6).map((fact) => {
                    const Icon = fact.icon;
                    return (
                      <div key={fact.label} className="rounded-[12px] border border-primary/10 bg-background/40 px-2 py-2">
                        <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary" />{fact.label}</div>
                        <div className="mt-0.5 font-display text-base leading-tight text-accent-foreground">{fact.value}</div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Description (scrollable) */}
            {property.description ? (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-[24px] bg-card p-4 shadow-[0_18px_38px_rgba(139,26,43,0.12)] md:p-5">
                <h2 className="font-display text-lg text-accent-foreground md:text-xl">Описание</h2>
                <div className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{property.description}</div>
                {property.amenities && property.amenities.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-primary/10 pt-3">
                    {property.amenities.map((item) => (
                      <span key={item} className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-background/40 px-2.5 py-1 text-xs text-accent-foreground">
                        <Trees className="h-3 w-3 text-primary" />{item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* CTA row */}
            <div className="flex flex-shrink-0 gap-2">
              <Button asChild className="gold-cta-button h-11 flex-1 rounded-[12px] text-sm">
                <a href="#inquiry"><Mail className="mr-1.5 h-4 w-4" />Запитване</a>
              </Button>
              <Button asChild variant="outline" className="h-11 flex-1 rounded-[12px] border-primary/30 text-sm">
                <a href="tel:+359881234567"><Phone className="mr-1.5 h-4 w-4" />Обади се</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Off-screen anchor — inquiry form available via deeper nav; keep page within viewport */}
      <div id="inquiry" className="sr-only">
        <InquiryForm propertyId={property.id} propertyTitle={property.title} />
        <MortgageRangeBand price={Number(property.price) || 0} currency={property.currency ?? "EUR"} propertyId={property.id} propertyTitle={property.title} />
      </div>
    </main>
  );
}

function PropertyGallery({ images, title }: { images: string[]; title: string }) {
  const [idx, setIdx] = useGalleryIndex(images.length);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px]">
        <img src={images[idx]} alt={`${title} – снимка ${idx + 1}`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
        {images.length > 1 ? (
          <>
            <button type="button" aria-label="Предишна снимка" onClick={() => setIdx((idx - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-[rgba(225,29,72,0.88)] text-primary-foreground shadow-lg"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" aria-label="Следваща снимка" onClick={() => setIdx((idx + 1) % images.length)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-[rgba(225,29,72,0.88)] text-primary-foreground shadow-lg"><ChevronRight className="h-5 w-5" /></button>
          </>
        ) : null}
        <div className="absolute bottom-3 left-3 rounded-[10px] bg-[rgba(53,12,18,0.85)] px-3 py-1 text-xs text-primary-foreground">{idx + 1} / {images.length}</div>
      </div>
      {images.length > 1 ? (
        <div className="grid flex-shrink-0 grid-cols-6 gap-2">
          {images.slice(0, 6).map((thumb, i) => (
            <button key={`${thumb}-${i}`} type="button" aria-label={`Покажи снимка ${i + 1} от ${title}`} aria-current={i === idx} onClick={() => setIdx(i)} className={cn("overflow-hidden rounded-[8px] border", i === idx ? "border-primary" : "border-primary/12")}>
              <img src={thumb} alt={`${title} – снимка ${i + 1}`} className="h-14 w-full object-cover md:h-16" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function useGalleryIndex(len: number): [number, (n: number) => void] {
  const [idx, setIdx] = useReactState(0);
  // Reset to 0 if the gallery shrinks below the current index (effect, not render).
  useEffect(() => {
    if (idx >= len && len > 0) setIdx(0);
  }, [idx, len]);
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
    <aside className="marble-dark-panel space-y-4 rounded-[20px] p-5 text-primary-foreground shadow-[0_22px_45px_rgba(139, 26, 43,0.3)]">
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

