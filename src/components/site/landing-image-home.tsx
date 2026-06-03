import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import landing from "@/assets/landing-master.png.asset.json";
import navbarDesktop from "@/assets/navbar-desktop.png.asset.json";
import cityBurgas from "@/assets/city-card-burgas.png.asset.json";
import cityVarna from "@/assets/city-card-varna.png.asset.json";
import cityShumen from "@/assets/city-card-shumen.png.asset.json";
import cityNoviPazar from "@/assets/city-card-novi-pazar.png.asset.json";
import logoUrl from "@/assets/logo-nadezhda.png";
import { getQuartersByCity } from "@/lib/catalog.functions";

type Hotspot = {
  to: string;
  search?: Record<string, string>;
  label: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

// Mobile-only navbar + city-card hotspots (kept for mobile image overlay).
const HOTSPOTS: Hotspot[] = [
  { to: "/", label: "Начало", left: 2.1, right: 71.8, top: 1.3, bottom: 82.2 },
  { to: "/search", search: { status: "sale" }, label: "За продажба", left: 43.2, right: 43.7, top: 7.1, bottom: 88.4 },
  { to: "/search", search: { status: "rent" }, label: "Под наем", left: 60.3, right: 27.2, top: 7.1, bottom: 88.4 },
  { to: "/about", label: "За нас", left: 75.6, right: 15.1, top: 7.1, bottom: 88.4 },
  { to: "/login", search: { redirect: "/admin" }, label: "Профил", left: 94.2, right: 1.6, top: 7.1, bottom: 88.4 },
  { to: "/cities/$slug", label: "Бургас", left: 4.6, right: 74.7, top: 61.9, bottom: 17.6 },
  { to: "/cities/$slug", label: "Варна", left: 26.4, right: 52.9, top: 61.9, bottom: 17.6 },
  { to: "/cities/$slug", label: "Шумен", left: 48.1, right: 31.2, top: 61.9, bottom: 17.6 },
  { to: "/cities/$slug", label: "Нов Пазар", left: 69.9, right: 9.4, top: 61.9, bottom: 17.6 },
];

const CITY_SLUGS = ["burgas", "varna", "shumen", "novi-pazar"];
const SEARCH_BAR = { left: 4.6, right: 1.6, top: 52.6, bottom: 41.2 };

const CITIES = [
  { slug: "burgas", name: "Бургас", img: cityBurgas.url },
  { slug: "varna", name: "Варна", img: cityVarna.url },
  { slug: "shumen", name: "Шумен", img: cityShumen.url },
  { slug: "novi-pazar", name: "Нов Пазар", img: cityNoviPazar.url },
];

const PROPERTY_TYPES = [
  { value: "apartment", label: "Апартамент" },
  { value: "house", label: "Къща" },
  { value: "land", label: "Парцел" },
  { value: "commercial", label: "Бизнес" },
];

const NAV_LINKS: { to: string; label: string; search?: Record<string, string> }[] = [
  { to: "/", label: "Начало" },
  { to: "/search", label: "За продажба", search: { status: "sale" } },
  { to: "/search", label: "Под наем", search: { status: "rent" } },
  { to: "/about", label: "За нас" },
];

export function LandingImageHome() {
  const navigate = useNavigate();
  const [city, setCity] = useState("");
  const [quarter, setQuarter] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: quarters = [] } = useQuery({
    queryKey: ["quarters", city],
    queryFn: () => (city ? getQuartersByCity({ data: { city_slug: city } }) : Promise.resolve([])),
    enabled: !!city,
  });

  const buildSearch = () => {
    const search: Record<string, string> = {};
    if (city) search.city_slug = city;
    if (quarter) search.quarter_slug = quarter;
    if (propertyType) search.property_type = propertyType;
    if (priceMin) search.price_min = priceMin;
    if (priceMax) search.price_max = priceMax;
    if (areaMin) search.area_min = areaMin;
    if (areaMax) search.area_max = areaMax;
    return search;
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate({ to: "/search", search: buildSearch() as never });
  };

  return (
    <>
      {/* ===================== DESKTOP (lg+) — real working clone ===================== */}
      <main
        className="hidden lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-hidden"
        style={{ background: "linear-gradient(180deg, #fbf6ea 0%, #ffffff 60%, #f4e9d0 100%)" }}
      >
        <h1 className="sr-only">Недвижими имоти Надежда — Луксозни имоти в България</h1>
        <p className="sr-only">
          Агенция Надежда предлага премиум недвижими имоти в Бургас, Варна, Шумен и Нов Пазар.
          Специализирани сме в луксозни апартаменти, къщи и инвестиционни оферти за продажба и под наем.
        </p>

        {/* Skip link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[#8B1A2B] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-[#C9A84C]"
        >
          Прескочи към съдържанието
        </a>

        {/* Navbar — smaller PNG panel pinned to the top */}
        <nav aria-label="Основна навигация" className="relative z-20 mx-auto w-full max-w-[1100px] flex-none px-4 pt-3">
          <div className="relative">
            <img
              src={navbarDesktop.url}
              alt=""
              role="presentation"
              className="block h-auto w-full select-none"
              style={{ maxHeight: 64 }}
              draggable={false}
            />
            <ul className="contents">
              {[
                { to: "/", label: "Начало", left: 2.1, right: 71.8 },
                { to: "/search", search: { status: "sale" }, label: "За продажба", left: 43.2, right: 43.7 },
                { to: "/search", search: { status: "rent" }, label: "Под наем", left: 60.3, right: 27.2 },
                { to: "/about", label: "За нас", left: 75.6, right: 15.1 },
                { to: "/login", search: { redirect: "/admin" }, label: "Профил", left: 90.5, right: 1.6 },
              ].map((h) => (
                <li key={h.label} className="contents">
                  <Link
                    to={h.to as never}
                    search={h.search as never}
                    aria-label={h.label}
                    className="group absolute top-[10%] bottom-[10%] flex items-center justify-center rounded-md transition-colors duration-150 hover:bg-white/10 focus-visible:bg-[#5e0f1d] focus-visible:shadow-[0_0_0_2px_#C9A84C] focus-visible:outline-none"
                    style={{ left: `${h.left}%`, right: `${h.right}%`, minHeight: 44 }}
                  >
                    <span className="sr-only">{h.label}</span>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none select-none px-1 text-[11px] font-semibold uppercase tracking-wider text-white opacity-0 group-focus-visible:opacity-100"
                    >
                      {h.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Hero — fullscreen background, contains search + city cards */}
        <section
          className="relative -mt-3 flex flex-1 flex-col items-center justify-between overflow-hidden px-8 pb-8 pt-6"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(251,246,234,0.55) 0%, rgba(255,255,255,0.35) 50%, rgba(244,233,208,0.55) 100%), url(${landing.url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Decorative gold lines */}
          <span aria-hidden className="pointer-events-none absolute left-0 right-0 top-12 mx-auto h-px max-w-[1180px]" style={{ background: "linear-gradient(90deg, transparent, #C9A84C66, transparent)" }} />
          <span aria-hidden className="pointer-events-none absolute left-0 right-0 bottom-10 mx-auto h-px max-w-[1180px]" style={{ background: "linear-gradient(90deg, transparent, #C9A84C66, transparent)" }} />


          {/* Search bar */}
          <form
            onSubmit={onSubmit}
            className="relative z-10 mx-auto mt-6 flex w-full max-w-[1180px] items-stretch rounded-2xl border border-[#C9A84C]/70 shadow-[0_20px_60px_-20px_rgba(94,15,29,0.45)]"
            style={{ background: "linear-gradient(180deg, #fbf6ea 0%, #f4e9d0 100%)" }}
          >
            <DesktopField label="Град" className="flex-[1.1]">
              <select
                aria-label="Град"
                value={city}
                onChange={(e) => { setCity(e.target.value); setQuarter(""); }}
                className="w-full cursor-pointer appearance-none bg-transparent text-[15px] font-medium text-[#2b1418] outline-none"
              >
                <option value="">Всички</option>
                {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </DesktopField>

            <DesktopField label="Квартал" className="flex-[1.1]">
              <select
                aria-label="Квартал"
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                disabled={!city}
                className="w-full cursor-pointer appearance-none bg-transparent text-[15px] font-medium text-[#2b1418] outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Всички</option>
                {(quarters as any[]).map((q) => <option key={q.slug} value={q.slug}>{q.name}</option>)}
              </select>
            </DesktopField>

            <DesktopField label="Вид имот" className="flex-[1.1]">
              <select
                aria-label="Вид имот"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full cursor-pointer appearance-none bg-transparent text-[15px] font-medium text-[#2b1418] outline-none"
              >
                <option value="">Всички</option>
                {PROPERTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </DesktopField>

            <DesktopField label="Цена (€)" className="flex-[1.3]">
              <div className="flex w-full items-center gap-1">
                <input aria-label="Цена от" type="number" inputMode="numeric" min={0} placeholder="от" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="w-full min-w-0 bg-transparent text-[15px] font-medium text-[#2b1418] outline-none placeholder:text-[#2b1418]/40" />
                <span className="text-[#2b1418]/40">–</span>
                <input aria-label="Цена до" type="number" inputMode="numeric" min={0} placeholder="до" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="w-full min-w-0 bg-transparent text-[15px] font-medium text-[#2b1418] outline-none placeholder:text-[#2b1418]/40" />
              </div>
            </DesktopField>

            <DesktopField label="Площ (m²)" className="flex-[1.2]" last>
              <div className="flex w-full items-center gap-1">
                <input aria-label="Площ от" type="number" inputMode="numeric" min={0} placeholder="от" value={areaMin} onChange={(e) => setAreaMin(e.target.value)} className="w-full min-w-0 bg-transparent text-[15px] font-medium text-[#2b1418] outline-none placeholder:text-[#2b1418]/40" />
                <span className="text-[#2b1418]/40">–</span>
                <input aria-label="Площ до" type="number" inputMode="numeric" min={0} placeholder="до" value={areaMax} onChange={(e) => setAreaMax(e.target.value)} className="w-full min-w-0 bg-transparent text-[15px] font-medium text-[#2b1418] outline-none placeholder:text-[#2b1418]/40" />
              </div>
            </DesktopField>

            <button
              type="submit"
              className="flex items-center gap-2 rounded-r-2xl px-8 font-display text-[15px] uppercase tracking-[0.16em] text-white transition-colors"
              style={{ background: "linear-gradient(135deg, #8B1A2B 0%, #5e0f1d 100%)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              Търси
            </button>

            <button
              type="button"
              aria-label="Още филтри"
              onClick={() => setMoreOpen((v) => !v)}
              className="ml-px flex items-center justify-center rounded-r-2xl border-l border-[#C9A84C]/40 bg-white px-4 text-[#8B1A2B] hover:bg-[#fbf6ea]"
            >
              ⋯
            </button>
          </form>

          {moreOpen && (
            <div className="absolute left-1/2 top-[160px] z-20 -translate-x-1/2 rounded-xl border border-[#C9A84C]/60 bg-white/95 p-4 text-sm text-[#2b1418] shadow-xl backdrop-blur">
              Допълнителните филтри са в страницата с резултати.{" "}
              <Link to="/search" search={buildSearch() as never} className="text-[#8B1A2B] underline">Отвори търсене →</Link>
            </div>
          )}

          {/* City cards — parchment scroll PNGs as-is */}
          <div className="relative z-10 mx-auto mt-6 grid w-full max-w-[1180px] grid-cols-4 gap-6">
            {CITIES.map((c) => (
              <Link
                key={c.slug}
                to="/cities/$slug"
                params={{ slug: c.slug } as never}
                aria-label={`Имоти в ${c.name}`}
                className="group block transition-transform duration-300 hover:-translate-y-1 focus:outline-none focus:-translate-y-1"
              >
                <img
                  src={c.img}
                  alt={`Свитък — имоти в ${c.name}`}
                  className="block h-auto w-full select-none drop-shadow-[0_15px_25px_rgba(94,15,29,0.35)] transition-[filter] duration-300 group-hover:drop-shadow-[0_20px_35px_rgba(201,168,76,0.5)]"
                  draggable={false}
                />
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* ===================== MOBILE / TABLET (< lg) — locked image mode ===================== */}
      <main className="relative w-full lg:hidden" style={{ backgroundColor: "#1a0d10" }}>
        <h1 className="sr-only">Недвижими имоти Надежда — Луксозни имоти в България</h1>
        <p className="sr-only">
          Агенция Надежда предлага премиум недвижими имоти в Бургас, Варна, Шумен и Нов Пазар.
        </p>

        <div className="relative mx-auto w-full" style={{ maxWidth: 1402 }}>
          <div className="relative w-full" style={{ aspectRatio: "1402 / 1122" }}>
            <img
              src={landing.url}
              alt="Недвижими имоти Надежда — начална страница"
              className="absolute inset-0 h-full w-full select-none"
              draggable={false}
              style={{ objectFit: "fill" }}
              fetchPriority="high"
            />

            {HOTSPOTS.map((h, i) => {
              const isCity = h.to === "/cities/$slug";
              const cityIndex = isCity
                ? HOTSPOTS.filter((x, j) => x.to === "/cities/$slug" && j <= i).length - 1
                : -1;
              const params = isCity ? { slug: CITY_SLUGS[cityIndex] } : undefined;
              return (
                <Link
                  key={`${h.label}-${i}`}
                  to={h.to as never}
                  params={params as never}
                  search={h.search as never}
                  aria-label={h.label}
                  className="absolute block rounded-md transition-colors duration-150 hover:bg-white/5 focus:bg-white/10 focus:outline-none"
                  style={{ left: `${h.left}%`, right: `${h.right}%`, top: `${h.top}%`, bottom: `${h.bottom}%` }}
                />
              );
            })}

            <form
              onSubmit={onSubmit}
              className="absolute flex items-stretch gap-0"
              style={{ left: `${SEARCH_BAR.left}%`, right: `${SEARCH_BAR.right}%`, top: `${SEARCH_BAR.top}%`, bottom: `${SEARCH_BAR.bottom}%` }}
            >
              <select aria-label="Град" value={city} onChange={(e) => { setCity(e.target.value); setQuarter(""); }} className="h-full cursor-pointer appearance-none bg-transparent px-2 text-[#2b1418] outline-none focus:bg-white/40" style={{ flexBasis: "15.6%" }}>
                <option value="">Град</option>
                {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
              <select aria-label="Квартал" value={quarter} onChange={(e) => setQuarter(e.target.value)} disabled={!city} className="h-full cursor-pointer appearance-none bg-transparent px-2 text-[#2b1418] outline-none focus:bg-white/40 disabled:cursor-not-allowed disabled:opacity-60" style={{ flexBasis: "13.6%" }}>
                <option value="">Квартал</option>
                {(quarters as any[]).map((q) => <option key={q.slug} value={q.slug}>{q.name}</option>)}
              </select>
              <select aria-label="Вид имот" value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="h-full cursor-pointer appearance-none bg-transparent px-2 text-[#2b1418] outline-none focus:bg-white/40" style={{ flexBasis: "13.7%" }}>
                <option value="">Вид имот</option>
                {PROPERTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <div className="flex h-full items-center gap-1 px-2" style={{ flexBasis: "19.1%" }}>
                <input aria-label="Цена от" type="number" inputMode="numeric" min={0} placeholder="от" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="h-full w-full min-w-0 bg-transparent text-[#2b1418] outline-none placeholder:text-[#2b1418]/50 focus:bg-white/40" />
                <span className="text-[#2b1418]/60">–</span>
                <input aria-label="Цена до" type="number" inputMode="numeric" min={0} placeholder="до" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="h-full w-full min-w-0 bg-transparent text-[#2b1418] outline-none placeholder:text-[#2b1418]/50 focus:bg-white/40" />
              </div>
              <div className="flex h-full items-center gap-1 px-2" style={{ flexBasis: "16.1%" }}>
                <input aria-label="Площ от" type="number" inputMode="numeric" min={0} placeholder="от" value={areaMin} onChange={(e) => setAreaMin(e.target.value)} className="h-full w-full min-w-0 bg-transparent text-[#2b1418] outline-none placeholder:text-[#2b1418]/50 focus:bg-white/40" />
                <span className="text-[#2b1418]/60">–</span>
                <input aria-label="Площ до" type="number" inputMode="numeric" min={0} placeholder="до" value={areaMax} onChange={(e) => setAreaMax(e.target.value)} className="h-full w-full min-w-0 bg-transparent text-[#2b1418] outline-none placeholder:text-[#2b1418]/50 focus:bg-white/40" />
              </div>
              <button type="submit" aria-label="Търси" className="h-full cursor-pointer bg-transparent text-transparent hover:bg-white/10 focus:bg-white/15 focus:outline-none" style={{ flexBasis: "13.2%" }}>Търси</button>
              <button type="button" aria-label="Още филтри" onClick={() => setMoreOpen((v) => !v)} className="h-full cursor-pointer bg-transparent text-transparent hover:bg-white/10 focus:bg-white/15 focus:outline-none" style={{ flexBasis: "6.8%" }}>Още</button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}

function DesktopField({
  label,
  children,
  className,
  last,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  last?: boolean;
}) {
  return (
    <label className={`flex flex-col justify-center gap-0.5 px-5 py-3 ${last ? "" : "border-r border-[#C9A84C]/30"} ${className ?? ""}`}>
      <span className="font-display text-[10px] uppercase tracking-[0.18em] text-[#8B1A2B]/70">{label}</span>
      {children}
    </label>
  );
}

export default LandingImageHome;
