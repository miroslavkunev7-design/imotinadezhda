import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import landing from "@/assets/landing-master.png.asset.json";
import { getQuartersByCity } from "@/lib/catalog.functions";

type Hotspot = {
  to: string;
  search?: Record<string, string>;
  label: string;
  // % positions in the 1402x1122 master image
  left: number;
  right: number;
  top: number;
  bottom: number;
};

// Navbar + city-card hotspots. Search-bar fields are replaced by a real form below.
const HOTSPOTS: Hotspot[] = [
  // Navbar
  { to: "/", label: "Начало", left: 2.1, right: 71.8, top: 1.3, bottom: 82.2 },
  { to: "/search", search: { status: "sale" }, label: "За продажба", left: 43.2, right: 43.7, top: 7.1, bottom: 88.4 },
  { to: "/search", search: { status: "rent" }, label: "Под наем", left: 60.3, right: 27.2, top: 7.1, bottom: 88.4 },
  { to: "/about", label: "За нас", left: 75.6, right: 15.1, top: 7.1, bottom: 88.4 },
  { to: "/login", search: { redirect: "/admin" }, label: "Профил", left: 94.2, right: 1.6, top: 7.1, bottom: 88.4 },

  // City cards
  { to: "/cities/$slug", label: "Бургас", left: 4.6, right: 74.7, top: 61.9, bottom: 17.6 },
  { to: "/cities/$slug", label: "Варна", left: 26.4, right: 52.9, top: 61.9, bottom: 17.6 },
  { to: "/cities/$slug", label: "Шумен", left: 48.1, right: 31.2, top: 61.9, bottom: 17.6 },
  { to: "/cities/$slug", label: "Нов Пазар", left: 69.9, right: 9.4, top: 61.9, bottom: 17.6 },
];

const CITY_SLUGS = ["burgas", "varna", "shumen", "novi-pazar"];

const CITIES = [
  { slug: "burgas", name: "Бургас" },
  { slug: "varna", name: "Варна" },
  { slug: "shumen", name: "Шумен" },
  { slug: "novi-pazar", name: "Нов Пазар" },
];

const PROPERTY_TYPES = [
  { value: "apartment", label: "Апартамент" },
  { value: "house", label: "Къща" },
  { value: "land", label: "Парцел" },
  { value: "commercial", label: "Бизнес" },
];

// Search-bar region in the master image (1402 × 1122).
// Form spans the full bar: left 4.6% → right 1.6%, top 52.6% → bottom 41.2%.
const SEARCH_BAR = { left: 4.6, right: 1.6, top: 52.6, bottom: 41.2 };

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

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const search: Record<string, string> = {};
    if (city) search.city_slug = city;
    if (quarter) search.quarter_slug = quarter;
    if (propertyType) search.property_type = propertyType;
    if (priceMin) search.price_min = priceMin;
    if (priceMax) search.price_max = priceMax;
    if (areaMin) search.area_min = areaMin;
    if (areaMax) search.area_max = areaMax;
    navigate({ to: "/search", search: search as never });
  };

  return (
    <main
      className="relative w-full lg:flex lg:h-[100dvh] lg:items-center lg:justify-center lg:overflow-hidden"
      style={{ backgroundColor: "#1a0d10" }}
    >
      <h1 className="sr-only">Недвижими имоти Надежда — Луксозни имоти в България</h1>
      <p className="sr-only">
        Агенция Надежда предлага премиум недвижими имоти в Бургас, Варна, Шумен и Нов Пазар.
        Специализирани сме в луксозни апартаменти, къщи и инвестиционни оферти за продажба и под наем.
      </p>

      <div
        className="relative mx-auto w-full lg:mx-0 lg:h-[100dvh] lg:w-auto"
        style={{ maxWidth: 1402 }}
      >
        <div
          className="relative w-full lg:h-[100dvh] lg:w-auto"
          style={{ aspectRatio: "1402 / 1122" }}
        >
          <img
            src={landing.url}
            alt="Недвижими имоти Надежда — начална страница"
            className="absolute inset-0 h-full w-full select-none"
            draggable={false}
            style={{ objectFit: "fill" }}
            fetchPriority="high"
          />

          {/* Navbar + city hotspots */}
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
                style={{
                  left: `${h.left}%`,
                  right: `${h.right}%`,
                  top: `${h.top}%`,
                  bottom: `${h.bottom}%`,
                }}
              />
            );
          })}

          {/* Real, working search bar — overlays the painted bar in the image */}
          <form
            onSubmit={onSubmit}
            className="absolute flex items-stretch gap-0"
            style={{
              left: `${SEARCH_BAR.left}%`,
              right: `${SEARCH_BAR.right}%`,
              top: `${SEARCH_BAR.top}%`,
              bottom: `${SEARCH_BAR.bottom}%`,
            }}
          >
            {/* Град — 14.9% (4.6→19.5) */}
            <select
              aria-label="Град"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setQuarter("");
              }}
              className="h-full cursor-pointer appearance-none bg-transparent px-2 text-[#2b1418] outline-none focus:bg-white/40"
              style={{ flexBasis: "15.6%" }}
            >
              <option value="">Град</option>
              {CITIES.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>

            {/* Квартал — 13.6% */}
            <select
              aria-label="Квартал"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              disabled={!city}
              className="h-full cursor-pointer appearance-none bg-transparent px-2 text-[#2b1418] outline-none focus:bg-white/40 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ flexBasis: "13.6%" }}
            >
              <option value="">Квартал</option>
              {quarters.map((q: any) => (
                <option key={q.slug} value={q.slug}>{q.name}</option>
              ))}
            </select>

            {/* Вид имот — 13.7% */}
            <select
              aria-label="Вид имот"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="h-full cursor-pointer appearance-none bg-transparent px-2 text-[#2b1418] outline-none focus:bg-white/40"
              style={{ flexBasis: "13.7%" }}
            >
              <option value="">Вид имот</option>
              {PROPERTY_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            {/* Цена (min/max) — 19.1% */}
            <div className="flex h-full items-center gap-1 px-2" style={{ flexBasis: "19.1%" }}>
              <input
                aria-label="Цена от"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="от"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="h-full w-full min-w-0 bg-transparent text-[#2b1418] outline-none placeholder:text-[#2b1418]/50 focus:bg-white/40"
              />
              <span className="text-[#2b1418]/60">–</span>
              <input
                aria-label="Цена до"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="до"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="h-full w-full min-w-0 bg-transparent text-[#2b1418] outline-none placeholder:text-[#2b1418]/50 focus:bg-white/40"
              />
            </div>

            {/* Площ (min/max) — 16.1% */}
            <div className="flex h-full items-center gap-1 px-2" style={{ flexBasis: "16.1%" }}>
              <input
                aria-label="Площ от"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="от"
                value={areaMin}
                onChange={(e) => setAreaMin(e.target.value)}
                className="h-full w-full min-w-0 bg-transparent text-[#2b1418] outline-none placeholder:text-[#2b1418]/50 focus:bg-white/40"
              />
              <span className="text-[#2b1418]/60">–</span>
              <input
                aria-label="Площ до"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="до"
                value={areaMax}
                onChange={(e) => setAreaMax(e.target.value)}
                className="h-full w-full min-w-0 bg-transparent text-[#2b1418] outline-none placeholder:text-[#2b1418]/50 focus:bg-white/40"
              />
            </div>

            {/* Търси — 13.2% */}
            <button
              type="submit"
              aria-label="Търси"
              className="h-full cursor-pointer bg-transparent text-transparent hover:bg-white/10 focus:bg-white/15 focus:outline-none"
              style={{ flexBasis: "13.2%" }}
            >
              Търси
            </button>

            {/* Още филтри — 6.8% */}
            <button
              type="button"
              aria-label="Още филтри"
              onClick={() => setMoreOpen((v) => !v)}
              className="h-full cursor-pointer bg-transparent text-transparent hover:bg-white/10 focus:bg-white/15 focus:outline-none"
              style={{ flexBasis: "6.8%" }}
            >
              Още
            </button>
          </form>

          {/* Optional "Още филтри" popover — appears below the bar without changing layout */}
          {moreOpen && (
            <div
              className="absolute z-10 rounded-xl border border-[#C9A84C]/60 bg-white/95 p-4 shadow-xl backdrop-blur"
              style={{
                left: `${SEARCH_BAR.left}%`,
                right: `${SEARCH_BAR.right}%`,
                top: `${100 - SEARCH_BAR.bottom + 0.5}%`,
              }}
            >
              <p className="text-sm text-[#2b1418]/80">
                Допълнителните филтри са налични в страницата с резултати.{" "}
                <Link to="/search" className="text-[#8B1A2B] underline">Отвори търсене →</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default LandingImageHome;
