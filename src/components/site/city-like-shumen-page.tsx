/**
 * City page 1:1 with the design reference — used for every city (Варна, Бургас, Шумен, Нови пазар).
 * Content is fully dynamic per slug (photo, title, description, stats, quarters).
 */
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  MapPin,
  Home as HomeIcon,
  Wallet,
  Square,
  SlidersHorizontal,
  Search,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Building2,
  Compass,
} from "lucide-react";

import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import { SiteHeader } from "@/components/site/site-header";
import { SiteSeoFooter } from "@/components/site/site-seo-footer";
import { InstallCrmButton } from "@/components/site/install-crm-button";
import { citySeo } from "@/lib/site-config";
import { shouldPlayHeroVideo } from "@/lib/device-perf";

// Shumen quarter photo tiles (label baked into the image).
import qTsentar from "@/assets/shumen-quarters/tsentar.jpeg.asset.json";
import qTrakiya from "@/assets/shumen-quarters/trakiya.png.asset.json";
import qBoyan1 from "@/assets/shumen-quarters/boyan-1.png.asset.json";
import qBoyan2 from "@/assets/shumen-quarters/boyan-2.png.asset.json";
import qBolnitsata from "@/assets/shumen-quarters/bolnitsata.png.asset.json";
import qHerson from "@/assets/shumen-quarters/herson.png.asset.json";
import qPazara from "@/assets/shumen-quarters/pazara.png.asset.json";
import qDobrudzhanski from "@/assets/shumen-quarters/dobrudzhanski.png.asset.json";
import qPozharnata from "@/assets/shumen-quarters/pozharnata.png.asset.json";
import qVoenno from "@/assets/shumen-quarters/voenno.png.asset.json";

// Only quarters with a real photo tile have image set — the rest render as empty burgundy cards with title.
const SHUMEN_QUARTERS: Array<{ slug: string; name: string; image: string; fill?: boolean }> = [
  { slug: "tsentar",            name: "Център",            image: qTsentar.url },
  { slug: "boyan-balgaranov-1", name: "Боян Българанов 1", image: qBoyan1.url },
  { slug: "boyan-balgaranov-2", name: "Боян Българанов 2", image: qBoyan2.url },
  { slug: "bolnitsata",         name: "Болницата",         image: qBolnitsata.url },
  { slug: "trakiya",            name: "Тракия",            image: "" },
  { slug: "herson",             name: "Херсон",            image: "" },
  { slug: "pazara",             name: "Пазара",            image: "" },
  { slug: "dobrudzhanski",      name: "Добруджански",      image: "" },
  { slug: "pozharnata",         name: "Пожарната",         image: "" },
  { slug: "voenno-uchilishte",  name: "Военно училище",    image: "" },
];
// Silence unused-import warnings for the remaining quarter pointers (kept for future use).
void qTrakiya; void qHerson; void qPazara; void qDobrudzhanski; void qPozharnata; void qVoenno;

export type CityHomeProps = {
  citySlug: string;
  cityLabel: string;
  cityDescription: string;
  heroVideoUrl?: string;
  heroVideoWebmUrl?: string;
  heroPosterUrl?: string;
  panoramaUrl: string;
  regionLabel?: string;
  stats: { population: string; area: string; activeProperties: string };
  quarters: Array<{ name: string; slug: string; count: number; image: string }>;
  quarterCounts?: Record<string, number>;
  aroundCount?: number;
};

function LogoHeader() {
  return (
    <Link to="/" className="absolute top-0 left-0 z-50 hidden md:block" aria-label="Имоти Надежда — начало">
      <div className="nadezhda-marble-bg w-52 md:w-64 pt-5 pb-6 px-5 nadezhda-top-logo-curve shadow-2xl relative border-b-4 border-r-4 border-[#c59441] flex items-center justify-center">
        <img src={logoNadezhda} alt="Имоти Надежда" className="h-20 md:h-24 w-auto drop-shadow-sm" />
      </div>
    </Link>
  );
}

function HeaderNav() {
  return (
    <div className="absolute top-0 right-0 p-6 md:p-8 hidden md:flex gap-6 lg:gap-8 text-white text-base lg:text-lg z-50 font-sans-nadezhda items-center drop-shadow-md">
      <Link to="/search" search={{ status: "sale" } as never} className="hover:text-yellow-400 border-b-2 border-yellow-400 pb-1 font-bold">За продажба</Link>
      <Link to="/search" search={{ status: "rent" } as never} className="hover:text-yellow-400 font-bold">Под наем</Link>
      <Link to="/about" className="hover:text-yellow-400 font-bold">За нас</Link>
      <Link to="/login" search={{ redirect: "/admin" } as never} aria-label="Профил">
        <User className="border-2 border-white rounded-full p-1.5 w-10 h-10 hover:text-yellow-400 hover:border-yellow-400 cursor-pointer" />
      </Link>
    </div>
  );
}

/* Clean quarter card — matches the reference 1:1 */
function QuarterCard({ image, title, count, slug, citySlug, cityLabel, fill }: { image: string; title: string; count: number; slug: string; citySlug: string; cityLabel: string; fill?: boolean }) {
  return (
    <Link
      to="/cities/$slug/districts/$district"
      params={{ slug: citySlug, district: slug } as never}
      className={`group block font-sans-nadezhda quarter-card${citySlug === "shumen" ? " quarter-card--photo-label" : ""}${image ? " quarter-card--has-image" : " quarter-card--no-image"}${fill ? " quarter-card--fill" : ""}`}
    >
      <div className="quarter-card__image">
        {image ? (
          <img
            src={image}
            alt={`Имоти в квартал ${title}, ${cityLabel}`}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        ) : (
          <div className="absolute inset-0 nadezhda-dark-red-bg" />
        )}
      </div>
      <span className="quarter-card__pill">
        <MapPin aria-hidden /> {count} имота
      </span>
      <h3 className="quarter-card__title">{title}</h3>
      <FleurOrnament />
      <span className="quarter-card__arrow" aria-hidden>
        <ArrowRight className="w-5 h-5" strokeWidth={2.4} />
      </span>
    </Link>
  );
}

function AroundCityCard({
  citySlug,
  cityLabel,
  aroundCount,
}: {
  citySlug: string;
  cityLabel: string;
  aroundCount?: number;
}) {
  const oblastHint =
    citySlug === "burgas" ? "Курорти и села"
    : citySlug === "varna" ? "Села в областта"
    : citySlug === "novi-pazar" ? "Села в общината"
    : "Села в областта";
  return (
    <Link
      to="/cities/$slug/around"
      params={{ slug: citySlug } as never}
      className="group relative overflow-hidden rounded-2xl border border-[#c9a84c] nadezhda-dark-red-bg px-4 py-4 text-white shadow-lg transition hover:brightness-110"
    >
      <Compass className="mb-2 h-7 w-7 text-[#f4d07d] transition group-hover:scale-110" />
      <div className="font-serif-nadezhda text-lg font-bold leading-tight">Около {cityLabel}</div>
      <div className="mt-1 text-[11px] text-[#f4d07d]/95">
        {aroundCount ? `${aroundCount} имота · ${oblastHint}` : oblastHint}
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-white/90">
        Отвори картата <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

function FleurOrnament() {
  return (
    <span className="quarter-card__ornament" aria-hidden>
      <svg viewBox="0 0 20 24" fill="currentColor">
        <path d="M10 0c1.4 2 1.4 4-.5 5.5C11.5 6.5 12 8.2 11.4 10c1.6-.5 3-.2 3.6 1.4.6 1.7-.3 3.3-2.4 3.8 1.3.8 2 2.2 1.6 3.7-.4 1.5-2 2.4-3.6 1.9L10 24l-.6-3.2c-1.6.5-3.2-.4-3.6-1.9-.4-1.5.3-2.9 1.6-3.7-2.1-.5-3-2.1-2.4-3.8.6-1.6 2-1.9 3.6-1.4C8 8.2 8.5 6.5 10.5 5.5 8.6 4 8.6 2 10 0z" />
      </svg>
    </span>
  );
}

/* Search bar under hero — one horizontal burgundy pill with 4 fields + buttons */
function HeroSearchBar({ citySlug, cityLabel }: { citySlug: string; cityLabel: string }) {
  const navigate = useNavigate();
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const submit = () => {
    const search: Record<string, string> = { city_slug: citySlug };
    if (type) search.property_type = type;
    if (price) search.price_max = price;
    if (area) search.area_min = area;
    navigate({ to: "/search", search: search as never });
  };
  return (
    <div className="city-search-bar w-full max-w-6xl mx-auto px-3 py-2 md:px-4 md:py-3 flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-0">
      <div className="grid grid-cols-2 md:grid-cols-4 flex-1 md:flex md:items-center">
        <div className="city-search-field">
          <MapPin className="w-5 h-5 flex-none" style={{ color: "#e8c974" }} />
          <div className="min-w-0">
            <div className="city-search-field__label">Град</div>
            <div className="city-search-field__value truncate">{cityLabel}</div>
          </div>
        </div>
        <div className="city-search-field">
          <HomeIcon className="w-5 h-5 flex-none" style={{ color: "#e8c974" }} />
          <div className="min-w-0 flex-1">
            <div className="city-search-field__label">Вид имот</div>
            <select value={type} onChange={(e) => setType(e.target.value)} className="city-search-field__value">
              <option value="">Всички</option>
              <option value="apartment">Апартамент</option>
              <option value="house">Къща</option>
              <option value="land">Парцел</option>
              <option value="office">Офис</option>
            </select>
          </div>
        </div>
        <div className="city-search-field">
          <Wallet className="w-5 h-5 flex-none" style={{ color: "#e8c974" }} />
          <div className="min-w-0 flex-1">
            <div className="city-search-field__label">Цена</div>
            <select value={price} onChange={(e) => setPrice(e.target.value)} className="city-search-field__value">
              <option value="">Без значение</option>
              <option value="50000">до 50 000 €</option>
              <option value="100000">до 100 000 €</option>
              <option value="150000">до 150 000 €</option>
              <option value="250000">до 250 000 €</option>
            </select>
          </div>
        </div>
        <div className="city-search-field">
          <Square className="w-5 h-5 flex-none" style={{ color: "#e8c974" }} />
          <div className="min-w-0 flex-1">
            <div className="city-search-field__label">Площ</div>
            <select value={area} onChange={(e) => setArea(e.target.value)} className="city-search-field__value">
              <option value="">Без значение</option>
              <option value="40">над 40 m²</option>
              <option value="70">над 70 m²</option>
              <option value="100">над 100 m²</option>
              <option value="150">над 150 m²</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 md:pl-2 md:border-l md:border-[rgba(232,201,116,0.22)]">
        <button type="button" onClick={submit} className="city-search-btn">
          <SlidersHorizontal className="w-4 h-4" /> Филтри
        </button>
        <button type="button" onClick={submit} className="city-search-btn city-search-btn--gold">
          <Search className="w-4 h-4" /> Търси
        </button>
      </div>
    </div>
  );
}

function FeatureIcon({ Icon, title, desc }: { Icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-4 md:gap-5 font-sans-nadezhda group">
      <Icon className="w-10 h-10 md:w-12 md:h-12 text-[#c59441] group-hover:scale-110 transition duration-300 flex-none" />
      <div>
        <div className="font-bold text-[#600f1c] text-base md:text-lg mb-0.5 md:mb-1">{title}</div>
        <div className="text-xs md:text-sm text-gray-500 leading-tight">{desc}</div>
      </div>
    </div>
  );
}

export function CityLikeShumenPage(p: CityHomeProps) {
  const regionLabel = p.regionLabel ?? "България";
  const hasHeroVideo = Boolean(p.heroVideoUrl);
  const [allowHeroVideo, setAllowHeroVideo] = useState(true);
  useEffect(() => { setAllowHeroVideo(shouldPlayHeroVideo()); }, []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.6, 240);
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };
  return (
    <div className={`min-h-screen relative nadezhda-marble-bg text-[#31020c] font-sans-nadezhda overflow-x-hidden ${hasHeroVideo ? "city-page--video-hero" : ""}`}>
      <SiteHeader overlay={hasHeroVideo} />

      {/* Hero burgundy panel — split: photo left, info right */}
      <section className={`city-hero-panel relative pt-24 md:pt-28 lg:pt-24 pb-10 md:pb-14 lg:pb-12 px-4 md:px-10 lg:px-14 ${hasHeroVideo ? "city-hero-panel--with-video" : ""}`}>
        <div className="city-hero-photo lg:absolute lg:inset-0 lg:z-0 aspect-[16/10] lg:aspect-auto w-full h-full">
          {p.heroVideoUrl && allowHeroVideo ? (
            <video
              className="city-hero-video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              disablePictureInPicture
              poster={p.panoramaUrl}
              aria-label={`Имоти в ${p.cityLabel} — панорама от Имоти Надежда`}
            >
              {p.heroVideoWebmUrl ? <source src={p.heroVideoWebmUrl} type="video/webm" /> : null}
              <source src={p.heroVideoUrl} type="video/mp4" />
            </video>
          ) : (
            <img src={p.panoramaUrl} alt={`Имоти в ${p.cityLabel} — панорама от Имоти Надежда`} className="w-full h-full object-cover block" loading="eager" />
          )}
        </div>
        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 md:gap-10 lg:gap-12 items-stretch">
          <div className="hidden lg:block" />
          <div className="text-white flex flex-col justify-center lg:min-h-[430px]">
            <div className="text-[#e8c974] text-[11px] md:text-xs tracking-[0.28em] uppercase font-bold mb-3">Имоти Надежда</div>
            <h1 className="text-5xl md:text-6xl lg:text-[80px] font-serif-nadezhda text-[#f0d78c] leading-none mb-4 md:mb-5">
              <span className="block text-2xl md:text-3xl lg:text-4xl text-[#f5ecc8] mb-2">Имоти в</span>
              {p.cityLabel}
            </h1>
            <p
              className="text-sm md:text-base text-[#f5ecc8]/85 leading-relaxed max-w-lg mb-5 md:mb-7"
              style={{ minHeight: "4.8em" }}
            >
              {citySeo(p.citySlug, p.cityLabel).intro} {p.cityDescription}
            </p>
            <div className="h-px w-full bg-gradient-to-r from-[#c9a84c]/60 via-[#c9a84c]/30 to-transparent mb-5 md:mb-7" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="city-stat">
                <Users className="city-stat__icon" />
                <div className="city-stat__value">{p.stats.population}</div>
                <div className="city-stat__label">жители</div>
              </div>
              <div className="city-stat">
                <Square className="city-stat__icon" />
                <div className="city-stat__value">{p.stats.area}</div>
                <div className="city-stat__label">площ</div>
              </div>
              <div className="city-stat">
                <MapPin className="city-stat__icon" />
                <div className="city-stat__value">{regionLabel}</div>
                <div className="city-stat__label">регион</div>
              </div>
              <div className="city-stat">
                <Building2 className="city-stat__icon" />
                <div className="city-stat__value">{p.stats.activeProperties}</div>
                <div className="city-stat__label">активни имота</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search bar — overlaps the hero bottom */}
      <div className="relative z-20 -mt-8 md:-mt-10 px-4 max-w-7xl mx-auto">
        <HeroSearchBar citySlug={p.citySlug} cityLabel={p.cityLabel} />
      </div>

      {/* Quarters section — title column left + horizontal scroll of cards */}
      <section className="max-w-7xl mx-auto mt-8 md:mt-10 lg:mt-6 px-4 pb-10 md:pb-14 lg:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(180px,220px)] gap-4 md:gap-5 items-stretch">
          <div className="relative city-scroll-wrap order-1">
            <button
              type="button"
              aria-label="Предишни квартали"
              onClick={() => scrollBy(-1)}
              className="city-scroll-btn city-scroll-btn--left hidden sm:inline-flex"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={2.6} />
            </button>
            <button
              type="button"
              aria-label="Следващи квартали"
              onClick={() => scrollBy(1)}
              className="city-scroll-btn city-scroll-btn--right hidden sm:inline-flex"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={2.6} />
            </button>
            <div
              ref={scrollRef}
              className="flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory pb-3 [scrollbar-width:thin] scroll-smooth"
            >
              {(p.citySlug === "shumen"
                ? SHUMEN_QUARTERS.map((fixed) => {
                    const dbMatch = p.quarters.find((x) => x.slug === fixed.slug);
                    return {
                      slug: fixed.slug,
                      name: dbMatch?.name ?? fixed.name,
                      image: fixed.image,
                      count: p.quarterCounts?.[fixed.slug] ?? dbMatch?.count ?? 0,
                      fill: fixed.fill,
                    };
                  })
                : p.quarters.map((q) => ({
                    slug: q.slug,
                    name: q.name,
                    image: q.image,
                    count: p.quarterCounts?.[q.slug] ?? q.count ?? 0,
                    fill: false,
                  }))
              ).map((q) => (
                <div key={q.slug} className="snap-start shrink-0 w-[70%] sm:w-[38%] md:w-[26%] lg:w-[calc((100%-4*1.25rem)/5)]">
                  <QuarterCard image={q.image} title={q.name} count={q.count} slug={q.slug} citySlug={p.citySlug} cityLabel={p.cityLabel} fill={q.fill} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4 order-2">
            <h2 className="text-2xl md:text-[26px] lg:text-[28px] font-serif-nadezhda text-[#2a0810] leading-tight">
              Избери <span className="text-[#c9a84c] italic">квартал</span>
              <span className="block text-[#2a0810]"> в гр. {p.cityLabel}</span>
            </h2>
            <Link
              to="/cities/$slug"
              params={{ slug: p.citySlug } as never}
              className="inline-flex items-center justify-between gap-3 px-5 py-4 rounded-2xl font-bold text-white nadezhda-dark-red-bg border border-[#c9a84c] shadow-lg hover:brightness-110 transition text-sm"
            >
              <span className="text-left leading-tight">Виж всички<br />квартали</span>
              <ArrowRight className="w-4 h-4 flex-none" />
            </Link>
            <AroundCityCard
              citySlug={p.citySlug}
              cityLabel={p.cityLabel}
              aroundCount={p.aroundCount}
            />
          </div>
        </div>
      </section>
      <SiteSeoFooter />
      <InstallCrmButton />
    </div>
  );
}

export default CityLikeShumenPage;
