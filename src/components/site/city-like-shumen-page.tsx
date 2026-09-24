/**
 * City page 1:1 with the design reference — used for every city (Варна, Бургас, Шумен, Нови пазар).
 * Content is fully dynamic per slug (photo, title, description, stats, quarters).
 */
import { useState, useRef } from "react";
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
} from "lucide-react";

import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import { AutoPlayVideo } from "@/components/site/auto-play-video";
import { SiteHeader } from "@/components/site/site-header";
import { InstallCrmButton } from "@/components/site/install-crm-button";
import type { QuarterImageCredit } from "@/lib/quarter-image-map";

export type CityHomeProps = {
  citySlug: string;
  cityLabel: string;
  cityDescription: string;
  heroVideoUrl?: string;
  heroVideoWebmUrl?: string;
  heroVideoFallbackUrl?: string;
  heroPosterUrl?: string;
  panoramaUrl: string;
  regionLabel?: string;
  stats: { population: string; area: string; activeProperties: string };
  quarters: Array<{ name: string; slug: string; count: number; image: string; imageCredit?: QuarterImageCredit | null }>;
  quarterCounts?: Record<string, number>;
  aroundCount?: number;
};

function LogoHeader() {
  return (
    <Link
      to="/"
      className="absolute top-0 left-0 z-50 hidden md:block"
      aria-label="Имоти Надежда — начало"
    >
      <div className="nadezhda-marble-bg w-52 md:w-64 pt-5 pb-6 px-5 nadezhda-top-logo-curve shadow-2xl relative border-b-4 border-r-4 border-[#c59441] flex items-center justify-center">
        <img
          src={logoNadezhda}
          alt="Имоти Надежда"
          className="h-20 md:h-24 w-auto drop-shadow-sm"
        />
      </div>
    </Link>
  );
}

function HeaderNav() {
  return (
    <div className="absolute top-0 right-0 p-6 md:p-8 hidden md:flex gap-6 lg:gap-8 text-white text-base lg:text-lg z-50 font-sans-nadezhda items-center drop-shadow-md">
      <Link
        to="/search"
        search={{ status: "sale" } as never}
        className="hover:text-yellow-400 border-b-2 border-yellow-400 pb-1 font-bold"
      >
        За продажба
      </Link>
      <Link
        to="/search"
        search={{ status: "rent" } as never}
        className="hover:text-yellow-400 font-bold"
      >
        Под наем
      </Link>
      <Link to="/about" className="hover:text-yellow-400 font-bold">
        За нас
      </Link>
      <Link to="/login" search={{ redirect: "/admin" } as never} aria-label="Профил">
        <User className="border-2 border-white rounded-full p-1.5 w-10 h-10 hover:text-yellow-400 hover:border-yellow-400 cursor-pointer" />
      </Link>
    </div>
  );
}

/* Clean quarter card — matches the reference 1:1 */
function QuarterCard({
  image,
  imageCredit,
  title,
  count,
  slug,
  citySlug,
  fill,
}: {
  image: string;
  imageCredit?: QuarterImageCredit | null;
  title: string;
  count: number;
  slug: string;
  citySlug: string;
  fill?: boolean;
}) {
  return (
    <div className="relative">
      <Link
        to="/cities/$slug/districts/$district"
        params={{ slug: citySlug, district: slug } as never}
        className={`group block font-sans-nadezhda quarter-card${citySlug === "shumen" ? " quarter-card--photo-label" : ""}${image ? " quarter-card--has-image" : " quarter-card--no-image"}${fill ? " quarter-card--fill" : ""}`}
      >
        <div className="quarter-card__image">
          {image ? (
            <img
              src={image}
              alt={imageCredit?.altText ?? title}
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
      {image && imageCredit ? (
        <div className="absolute right-2 top-2 z-20 flex max-w-[90%] flex-wrap items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-[10px] font-medium leading-tight text-white shadow">
          <a href={imageCredit.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={"Снимка: " + imageCredit.sourceTitle + ", автор " + imageCredit.author} title={imageCredit.sourceTitle} className="underline underline-offset-2">
            Снимка: {imageCredit.author}
          </a>
          <span aria-hidden="true">·</span>
          <a href={imageCredit.licenseUrl} target="_blank" rel="license noopener noreferrer" aria-label={"Лиценз " + imageCredit.license + ", " + imageCredit.changes} title={imageCredit.changes} className="underline underline-offset-2">
            {imageCredit.license}
          </a>
          <span aria-hidden="true">· уеб версия</span>
        </div>
      ) : null}
    </div>
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
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="city-search-field__value"
            >
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
            <select
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="city-search-field__value"
            >
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
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="city-search-field__value"
            >
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

function FeatureIcon({
  Icon,
  title,
  desc,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
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
  const [videoFailed, setVideoFailed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.6, 240);
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };
  return (
    <div
      className={`min-h-screen relative nadezhda-marble-bg text-[#31020c] font-sans-nadezhda overflow-x-hidden ${hasHeroVideo ? "city-page--video-hero" : ""}`}
    >
      <div className="md:hidden">
        <SiteHeader overlay={hasHeroVideo} />
      </div>

      {/* Hero burgundy panel — split: photo left, info right */}
      <section
        className={`city-hero-panel relative pt-24 md:pt-28 lg:pt-24 pb-10 md:pb-14 lg:pb-12 px-4 md:px-10 lg:px-14 ${hasHeroVideo ? "city-hero-panel--with-video" : ""}`}
      >
        <LogoHeader />
        <HeaderNav />
        <div className="city-hero-photo lg:absolute lg:inset-0 lg:z-0 aspect-[16/10] lg:aspect-auto w-full h-full">
          {p.heroVideoUrl && !videoFailed ? (
            <AutoPlayVideo
              src={p.heroVideoUrl}
              webmSrc={p.heroVideoWebmUrl}
              fallbackSrc={p.heroVideoFallbackUrl}
              onPermanentError={() => setVideoFailed(true)}
              poster={p.panoramaUrl}
              className="city-hero-video absolute inset-0 h-full w-full"
              objectFit="cover"
              objectPosition="center"
            />
          ) : (
            <img
              src={p.panoramaUrl}
              alt={p.cityLabel}
              className="w-full h-full object-cover block"
              loading="eager"
            />
          )}
        </div>
        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 md:gap-10 lg:gap-12 items-stretch">
          <div className="hidden lg:block" />
          <div className="text-white flex flex-col justify-center lg:min-h-[430px]">
            <div className="text-[#e8c974] text-[11px] md:text-xs tracking-[0.28em] uppercase font-bold mb-3">
              За града
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-[80px] font-serif-nadezhda text-[#f0d78c] leading-none mb-4 md:mb-5">
              {p.cityLabel}
            </h1>
            <p
              className="text-sm md:text-base text-[#f5ecc8]/85 leading-relaxed max-w-lg mb-5 md:mb-7"
              style={{ minHeight: "4.8em" }}
            >
              {p.cityDescription}
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
              {p.quarters.length ? (
                p.quarters.map((q) => (
                  <div
                    key={q.slug}
                    className="snap-start shrink-0 w-[70%] sm:w-[38%] md:w-[26%] lg:w-[calc((100%-4*1.25rem)/5)]"
                  >
                    <QuarterCard
                      image={q.image}
                      imageCredit={q.imageCredit}
                      title={q.name}
                      count={q.count}
                      slug={q.slug}
                      citySlug={p.citySlug}
                      fill={false}
                    />
                  </div>
                ))
              ) : (
                <div className="flex min-h-44 w-full items-center justify-center rounded-2xl border border-[#C9A84C]/35 bg-white/75 px-6 text-center text-[#600f1c]/75">
                  Все още няма публикувани квартали за {p.cityLabel}.
                </div>
              )}
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
              <span className="text-left leading-tight">
                Виж всички
                <br />
                квартали
              </span>
              <ArrowRight className="w-4 h-4 flex-none" />
            </Link>
          </div>
        </div>
      </section>
      <InstallCrmButton />
    </div>
  );
}

export default CityLikeShumenPage;
