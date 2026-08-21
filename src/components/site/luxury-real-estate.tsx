import { cloneElement, useEffect, useRef, useState as useReactState, type ReactElement, type CSSProperties, type VideoHTMLAttributes } from "react";
import { shouldPlayHeroVideo } from "@/lib/device-perf";

// Auto-play helper with instant-poster + deferred video mount:
// 1. Renders the poster image immediately as a full-cover background so first
//    paint is effectively 0s (no waiting on the video network request).
// 2. Defers mounting the actual <video> element until after first paint
//    (requestIdleCallback / rAF fallback) so the hero image isn't blocked.
// 3. Uses preload="metadata" so the browser streams the clip instead of
//    fully buffering before playback can start.
// 4. Fades the video in over the poster once enough data is loaded (no flash).
function AutoPlayVideo(
  props: VideoHTMLAttributes<HTMLVideoElement> & {
    src?: string;
    fallbackSrc?: string;
    onPermanentError?: () => void;
    priority?: boolean;
  },
) {
  const { src, fallbackSrc, onPermanentError, onError, poster, className, style, preload, priority, ...videoProps } = props;
  const ref = useRef<HTMLVideoElement | null>(null);
  const [activeSrc, setActiveSrc] = useReactState(src);
  const [mountVideo, setMountVideo] = useReactState(!!priority);
  const [videoReady, setVideoReady] = useReactState(false);
  const [allowVideo, setAllowVideo] = useReactState(true);

  useEffect(() => {
    const ok = shouldPlayHeroVideo();
    setAllowVideo(ok);
    if (!ok) setMountVideo(false);
  }, [setAllowVideo, setMountVideo]);

  useEffect(() => {
    setActiveSrc(src);
    setVideoReady(false);
  }, [src, setActiveSrc, setVideoReady]);

  // Defer the <video> mount until after first paint so the poster shows instantly.
  // Skipped when `priority` is set (LCP hero) — we want the network request to
  // start on first paint, not after idle.
  useEffect(() => {
    if (!src || priority || !allowVideo) return;
    let cancelled = false;
    const schedule = (cb: () => void) => {
      const ric = (window as any).requestIdleCallback as
        | ((cb: () => void, opts?: { timeout: number }) => number)
        | undefined;
      if (typeof ric === "function") return ric(() => !cancelled && cb(), { timeout: 50 });
      return window.setTimeout(() => !cancelled && cb(), 0);
    };
    const raf = requestAnimationFrame(() => schedule(() => setMountVideo(true)));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src, setMountVideo, priority, allowVideo]);

  useEffect(() => {
    if (!mountVideo) return;
    const el = ref.current;
    if (!el || !activeSrc) return;
    el.muted = true;
    el.defaultMuted = true;
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    // Reduce browser overhead on laptops: no PiP button, no cast pipeline.
    try {
      (el as any).disablePictureInPicture = true;
      (el as any).disableRemotePlayback = true;
    } catch {}
    const tryPlay = () => {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          const resume = () => {
            el.play().catch(() => {});
            window.removeEventListener("touchstart", resume);
            window.removeEventListener("click", resume);
          };
          window.addEventListener("touchstart", resume, { once: true, passive: true });
          window.addEventListener("click", resume, { once: true });
        });
      }
    };
    // canplay (readyState >= 3) guarantees the browser has enough buffered
    // frames to start without stutter. loadeddata (>=2) triggers too early
    // on laptops with slow disks/CPUs and causes the visible jank.
    if (el.readyState >= 3) tryPlay();
    else el.addEventListener("canplay", tryPlay, { once: true });

    // Pause when off-screen so scrolling/tab-switching doesn't queue up
    // decode work that stalls the visible video.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.play().catch(() => {});
          } else {
            el.pause();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);

    const onVisibility = () => {
      if (document.hidden) el.pause();
      else el.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("canplay", tryPlay);
    };
  }, [activeSrc, mountVideo]);

  const handleError: VideoHTMLAttributes<HTMLVideoElement>["onError"] = (event) => {
    onError?.(event);
    if (fallbackSrc && activeSrc !== fallbackSrc) {
      setActiveSrc(fallbackSrc);
      return;
    }
    onPermanentError?.();
  };

  return (
    <div className={className} style={style}>
      {poster ? (
        <img
          src={typeof poster === "string" ? poster : undefined}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          fetchPriority="high"
        />
      ) : null}
      {mountVideo && activeSrc && allowVideo ? (
        <video
          key={activeSrc}
          ref={ref}
          {...videoProps}
          autoPlay
          loop
          muted
          playsInline
          preload={preload ?? (priority ? "auto" : "metadata")}
          poster={typeof poster === "string" ? poster : undefined}
          src={activeSrc}
          onError={handleError}
          onCanPlay={() => setVideoReady(true)}
          onEnded={(e) => {
            const v = e.currentTarget;
            try {
              v.currentTime = 0;
              void v.play();
            } catch {}
          }}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
          style={{ opacity: videoReady ? 1 : 0 }}
        />
      ) : null}
    </div>
  );
}
import { Link, useNavigate } from "@tanstack/react-router";
import { AGENCY } from "@/lib/contact-config";
import { useFavorites, shareProperty } from "@/hooks/use-favorites";
import { toast } from "sonner";

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
  X,
} from "lucide-react";

import burgasHero from "@/assets/burgas-hero.jpeg";
import burgasPier from "@/assets/burgas-pier.jpeg";
import homeHero from "@/assets/home-hero-living.jpeg";
import homeHeroVideo from "@/assets/home-hero-2026.mp4.asset.json";
import burgasHeroVideo from "@/assets/burgas-hero.mp4.asset.json";
import shumenHeroVideo from "@/assets/shumen-hero.mp4.asset.json";
import varnaHeroVideo from "@/assets/varna-hero.mp4.asset.json";
import cityShumen from "@/assets/city-shumen.jpeg";
import cityBurgas from "@/assets/city-burgas.jpeg";
import cityVarna from "@/assets/city-varna.jpeg";
import cityNoviPazar from "@/assets/city-novi-pazar.jpeg";
import shumenHeroMobile from "@/assets/shumen-hero-mobile.jpeg.asset.json";
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

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/asset-url";
import { MortgageRangeBand } from "@/components/site/mortgage-range-band";
import { SiteHeader, type SiteNavKey } from "@/components/site/site-header";
import { DistrictPriceMap } from "@/components/site/district-price-map";
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

const cityVideoFallbacks: Record<string, string> = {
  burgas: resolveAssetUrl(burgasHeroVideo),
  shumen: resolveAssetUrl(shumenHeroVideo),
  varna: resolveAssetUrl(varnaHeroVideo),
};

const shumenQuarterCards = [
  { name: "Център", slug: "tsentar", image_url: resolveAssetUrl(qTsentar), properties_count: 0 },
  { name: "Тракия", slug: "trakiya", image_url: resolveAssetUrl(qTrakiya), properties_count: 0 },
  { name: "Боян Българанов 1", slug: "boyan-balgaranov-1", image_url: resolveAssetUrl(qBoyan1), properties_count: 0 },
  { name: "Боян Българанов 2", slug: "boyan-balgaranov-2", image_url: resolveAssetUrl(qBoyan2), properties_count: 0 },
  { name: "Болницата", slug: "bolnitsata", image_url: resolveAssetUrl(qBolnitsata), properties_count: 0 },
  { name: "Херсон", slug: "herson", image_url: resolveAssetUrl(qHerson), properties_count: 0 },
  { name: "Пазара", slug: "pazara", image_url: resolveAssetUrl(qPazara), properties_count: 0 },
  { name: "Добруджански", slug: "dobrudzhanski", image_url: resolveAssetUrl(qDobrudzhanski), properties_count: 0 },
  { name: "Пожарната", slug: "pozharnata", image_url: resolveAssetUrl(qPozharnata), properties_count: 0 },
  { name: "Военно училище", slug: "voenno-uchilishte", image_url: resolveAssetUrl(qVoenno), properties_count: 0 },
];

function normalizeQuarterName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const homeCities: Array<{ name: string; image: string; href: "/cities/$slug"; params: { slug: string } }> = [
  { name: "Бургас", image: cityBurgas, href: "/cities/$slug", params: { slug: "burgas" } },
  { name: "Варна", image: cityVarna, href: "/cities/$slug", params: { slug: "varna" } },
  { name: "Шумен", image: cityShumen, href: "/cities/$slug", params: { slug: "shumen" } },
  { name: "Нови пазар", image: cityNoviPazar, href: "/cities/$slug", params: { slug: "novi-pazar" } },
];

const HOME_CITY_ORDER = ["burgas", "varna", "shumen", "novi-pazar"] as const;
const HOME_CITY_NAMES: Record<(typeof HOME_CITY_ORDER)[number], string> = {
  burgas: "Бургас",
  varna: "Варна",
  shumen: "Шумен",
  "novi-pazar": "Нови пазар",
};

function orderedCityOptions(cities: Array<{ slug: string; name: string }>) {
  const source = cities.length
    ? cities
    : HOME_CITY_ORDER.map((slug) => ({ slug, name: HOME_CITY_NAMES[slug] }));
  return [...source].sort((a, b) => {
    const ia = HOME_CITY_ORDER.indexOf(a.slug as (typeof HOME_CITY_ORDER)[number]);
    const ib = HOME_CITY_ORDER.indexOf(b.slug as (typeof HOME_CITY_ORDER)[number]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

// NOTE: removed mock arrays (burgasDistricts, listingCards, propertyThumbs,
// propertyFacts, amenityList) — replaced by live DB data via quarterCounts /
// catalog server fns.
const burgasDistricts: Array<{ name: string; count: number; image: string }> = [];


/**
 * Backwards-compatible alias for the old per-section LuxuryHeader. Every page
 * now renders the unified <SiteHeader />, but existing imports keep working.
 */
export function LuxuryHeader({
  active = "sale",
  overlay = false,
}: {
  active?: NavKey;
  dark?: boolean;
  overlay?: boolean;
}) {
  return <SiteHeader active={active} overlay={overlay} />;
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

  const cityOptions = orderedCityOptions(cities);

  const isBurgundy = variant === "burgundy";

  void isBurgundy; // variant kept for API compatibility; design is unified now

  return (
    <section className="max-w-[1250px] mx-auto relative z-20">
      {/* Mobile: 2-column grid of compact filter tiles */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <SearchField title="Град" value={city} onChange={setCity} tile
          options={cityOptions.map((c) => ({ value: c.slug, label: c.name }))} />
        <SearchField title="Квартал" value={quarter} onChange={setQuarter} tile
          options={[{ value: "", label: "Всички" }, ...quarters.map((q) => ({ value: q.slug, label: q.name }))]} />
        <SearchField title="Вид имот" value={ptype} onChange={setPtype} tile
          options={propertyTypeOptions} />
        <SearchRangeField title="Цена" minVal={priceMin} maxVal={priceMax}
          onMin={setPriceMin} onMax={setPriceMax} suffix="€" tile />
        <SearchRangeField title="Площ" minVal={areaMin} maxVal={areaMax}
          onMin={setAreaMin} onMax={setAreaMax} suffix="м²" tile />
        <button
          type="button"
          onClick={handleSearch}
          className="flex items-center justify-center gap-2 h-[68px] rounded-[20px] font-display font-bold text-[18px] transition active:brightness-95"
          style={{
            background: "#E6C97A",
            color: "#4A0018",
            boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
          }}
        >
          <Search className="h-5 w-5" strokeWidth={2.75} />
          <span>Търси</span>
        </button>
      </div>

      {/* Desktop: horizontal capsule */}
      <div
        className="hidden md:block rounded-[32px] overflow-hidden border border-white/10 backdrop-blur-xl shadow-[0_25px_50px_rgba(0,0,0,0.45)]"
        style={{ background: "linear-gradient(to right, #4b0018, #690020, #7a0028)" }}
      >
        <div className="grid grid-cols-6 divide-x divide-white/10">
          <SearchField title="Град" value={city} onChange={setCity}
            options={cityOptions.map((c) => ({ value: c.slug, label: c.name }))} />
          <SearchField title="Квартал" value={quarter} onChange={setQuarter}
            options={[{ value: "", label: "Всички" }, ...quarters.map((q) => ({ value: q.slug, label: q.name }))]} />
          <SearchField title="Вид имот" value={ptype} onChange={setPtype}
            options={propertyTypeOptions} />
          <SearchRangeField title="Цена" minVal={priceMin} maxVal={priceMax}
            onMin={setPriceMin} onMax={setPriceMax} suffix="€" />
          <SearchRangeField title="Площ" minVal={areaMin} maxVal={areaMax}
            onMin={setAreaMin} onMax={setAreaMax} suffix="м²" />
          <button
            type="button"
            onClick={handleSearch}
            className="flex items-center justify-center gap-3 font-display font-bold text-xl transition hover:brightness-110 hover:scale-[1.02]"
            style={{ background: "#e5bc76", color: "#4b0018" }}
          >
            <Search className="h-5 w-5" strokeWidth={2.5} />
            <span>Търси</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function QuickSearchCard({
  cities = [],
}: {
  cities?: Array<{ slug: string; name: string }>;
}) {
  const cityOptions = orderedCityOptions(cities);
  const [city, setCity] = useReactState(cityOptions[0]?.slug ?? "burgas");
  const [quarter, setQuarter] = useReactState("");
  const [ptype, setPtype] = useReactState("apartment");
  const [priceMin, setPriceMin] = useReactState("200000");
  const [priceMax, setPriceMax] = useReactState("500000");
  const [areaMin, setAreaMin] = useReactState("100");
  const [areaMax, setAreaMax] = useReactState("200");
  const navigate = useNavigate();

  const cityLabel = cityOptions.find((c) => c.slug === city)?.name ?? "Всички";
  const typeLabel = propertyTypeOptions.find((o) => o.value === ptype)?.label ?? "Всички";

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

  const tiles: Array<{ icon: typeof MapPin; label: string; value: string }> = [
    { icon: MapPin, label: "Град", value: cityLabel },
    { icon: House, label: "Квартал", value: quarter || "Всички" },
    { icon: Building2, label: "Вид имот", value: typeLabel },
    { icon: LandPlot, label: "Цена", value: `${priceMin} - ${priceMax}` },
    { icon: Ruler, label: "Площ", value: `${areaMin} - ${areaMax} m²` },
  ];

  return (
    <div
      className="rounded-[20px] px-2.5 py-2.5"
      style={{
        background: "linear-gradient(180deg, #3a0010 0%, #4b0018 100%)",
        border: "1px solid rgba(201,168,76,0.35)",
        boxShadow: "0 20px 45px rgba(0,0,0,0.45)",
      }}
    >
      <div
        className="text-center font-display text-[10px] font-semibold tracking-[0.22em] mb-1.5"
        style={{ color: "#E6C97A" }}
      >
        БЪРЗО ТЪРСЕНЕ
      </div>
      <div className="grid grid-cols-5 gap-1">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="flex flex-col items-center justify-start gap-0.5 rounded-[10px] px-0.5 py-1 text-center"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(201,168,76,0.25)",
              }}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-[8px]"
                style={{ border: "1px solid rgba(201,168,76,0.5)", color: "#E6C97A" }}
              >
                <Icon className="h-3 w-3" strokeWidth={1.8} />
              </span>
              <span className="text-[8px] uppercase tracking-[0.05em] text-white/70 leading-tight">{t.label}</span>
              <span className="text-[8px] font-semibold text-white leading-tight break-words w-full">{t.value}</span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleSearch}
        className="mt-2 flex w-full items-center justify-center gap-2 h-[36px] rounded-full font-display font-bold text-[13px] active:brightness-95 transition"
        style={{
          background: "linear-gradient(180deg, #EBCF83 0%, #C9A84C 100%)",
          color: "#4A0018",
          boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
        }}
      >
        <Search className="h-4 w-4" strokeWidth={2.75} />
        <span>Търси имот</span>
      </button>
      {/* Keep state referenced to satisfy TS */}
      <input type="hidden" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
      <input type="hidden" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
      <input type="hidden" value={areaMin} onChange={(e) => setAreaMin(e.target.value)} />
      <input type="hidden" value={areaMax} onChange={(e) => setAreaMax(e.target.value)} />
      <input type="hidden" value={city} onChange={(e) => setCity(e.target.value)} />
      <input type="hidden" value={quarter} onChange={(e) => setQuarter(e.target.value)} />
      <input type="hidden" value={ptype} onChange={(e) => setPtype(e.target.value)} />
    </div>
  );
}

function SearchField({
  title,
  value,
  onChange,
  options,
  tile = false,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  options: SearchOption[];
  tile?: boolean;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  if (tile) {
    return (
      <label
        className="relative flex flex-col justify-center gap-0.5 px-4 h-[68px] rounded-[20px] cursor-pointer overflow-hidden backdrop-blur-[20px]"
        style={{
          background: "rgba(90,0,29,0.85)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#D9B06F] font-display">
          {title}
        </span>
        <span className="text-white text-[14px] font-display font-medium truncate pr-5">
          {current?.label ?? "—"}
        </span>
        <ChevronDown aria-hidden className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#D9B06F]" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="relative flex flex-col justify-center gap-1 px-5 py-4 cursor-pointer group">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[#d9b06f] font-display">
        {title}
      </span>
      <span className="text-white text-sm md:text-base font-display truncate pr-6">
        {current?.label ?? "—"}
      </span>
      <ChevronDown aria-hidden className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#d9b06f]" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function SearchRangeField({
  title,
  minVal,
  maxVal,
  onMin,
  onMax,
  suffix,
  tile = false,
}: {
  title: string;
  minVal: string;
  maxVal: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  suffix: string;
  tile?: boolean;
}) {
  if (tile) {
    return (
      <div
        className="flex flex-col justify-center gap-0.5 px-4 h-[68px] rounded-[20px] backdrop-blur-[20px]"
        style={{
          background: "rgba(90,0,29,0.85)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#D9B06F] font-display">
          {title}
        </span>
        <div className="flex items-center gap-1 text-white text-[13px] font-display">
          <input
            type="text"
            inputMode="numeric"
            value={minVal}
            onChange={(e) => onMin(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full min-w-0 bg-transparent outline-none placeholder-white/40"
            placeholder="от"
          />
          <span className="text-white/40">—</span>
          <input
            type="text"
            inputMode="numeric"
            value={maxVal}
            onChange={(e) => onMax(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full min-w-0 bg-transparent outline-none placeholder-white/40"
            placeholder="до"
          />
          <span className="text-[#D9B06F] flex-none">{suffix}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col justify-center gap-1 px-5 py-4">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[#d9b06f] font-display">
        {title}
      </span>
      <div className="flex items-center gap-1.5 text-white text-sm md:text-base font-display">
        <input
          type="text"
          inputMode="numeric"
          value={minVal}
          onChange={(e) => onMin(e.target.value.replace(/[^0-9]/g, ""))}
          className="w-full min-w-0 bg-transparent outline-none placeholder-white/40"
          placeholder="от"
        />
        <span className="text-white/40">—</span>
        <input
          type="text"
          inputMode="numeric"
          value={maxVal}
          onChange={(e) => onMax(e.target.value.replace(/[^0-9]/g, ""))}
          className="w-full min-w-0 bg-transparent outline-none placeholder-white/40"
          placeholder="до"
        />
        <span className="text-[#d9b06f] flex-none">{suffix}</span>
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

function CityCard({ name, image, href, params }: { name: string; image: string; href: "/cities/$slug"; params: { slug: string } }) {
  return CityCardImpl({ name, image, href, params });
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
function CityCardImpl({ name, image, href, params }: { name: string; image: string; href: "/cities/$slug"; params: { slug: string } }) {
  return (
    <Link
      to={href}
      params={params}
      className="relative block overflow-hidden group cursor-pointer rounded-[34px] md:rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.35)] md:shadow-[0_15px_35px_rgba(0,0,0,0.3)]"
    >
      <img
        src={image}
        alt={`Имоти в ${name} — Имоти Надежда`}
        loading="lazy"
        className="h-[108px] md:h-[230px] w-full object-cover transition duration-500 md:group-hover:scale-110"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(50,0,15,0.95) 0%, rgba(50,0,15,0.50) 45%, transparent 100%)",
        }}
      />
      <div className="absolute bottom-2 left-2.5 right-2.5 md:bottom-6 md:left-6 md:right-6 flex justify-between items-end gap-2 md:gap-4">
        <div className="min-w-0">
          <p className="hidden md:block text-[#D9B06F] text-[18px] md:text-sm uppercase tracking-[0.15em] font-display">
            Виж града
          </p>
          <h3 className="text-white text-[18px] md:text-4xl leading-[1.02] font-display font-extrabold tracking-tight truncate">
            {name}
          </h3>
        </div>
        <span
          className="flex-none w-7 h-7 md:w-14 md:h-14 rounded-full flex items-center justify-center transition md:group-hover:bg-[#d9b06f] md:group-hover:text-[#4b0018]"
          style={{ border: "2px solid #D9B06F", color: "#D9B06F", background: "transparent" }}
          aria-hidden
        >
          <ChevronRight className="w-4 h-4 md:w-6 md:h-6" strokeWidth={2.6} />
        </span>
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
    <article className="group quarter-card font-sans-nadezhda">
      <div className="quarter-card__image" style={{ aspectRatio: "1.4 / 1" }}>
        <img
          src={proxyImage(image) || burgasHero}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="transition duration-500 group-hover:scale-[1.04]"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (!img.dataset.fellBack) {
              img.dataset.fellBack = "1";
              img.src = burgasHero;
            }
          }}
        />
      </div>
      <span className="quarter-card__pill">
        <MapPin aria-hidden /> {count} имота
      </span>
      <h3 className="quarter-card__title">{title}</h3>
      <FleurOrnament />
      <span className="quarter-card__arrow" aria-hidden>
        <ChevronRight className="w-5 h-5" strokeWidth={2.4} />
      </span>
    </article>
  );
}

export function ListingCard({
  id,
  title,
  price,
  size,
  beds,
  baths,
  image,
  tag,
  location,
}: {
  id?: string;
  title: string;
  price: string;
  size: string;
  beds: number;
  baths: number;
  image: string;
  tag: string;
  location?: string;
}) {
  const card = (
    <article className="marble-hover-card group overflow-hidden rounded-[20px] border border-primary/18 bg-card shadow-[0_20px_45px_rgba(139,26,43,0.16)] cursor-pointer">
      <div className="relative aspect-[1.08/0.82] overflow-hidden">
        <img
          src={resolveAssetUrl(image) || burgasHero}
          alt={title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget;
            if (el.src !== burgasHero) el.src = burgasHero;
          }}
        />
        {tag ? <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold tracking-[0.08em] text-primary-foreground">{tag}</span> : null}
        <button type="button" aria-label="Добави в любими" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-primary shadow">
          <Heart className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-[rgba(225,29,72,0.88)] px-3.5 py-1.5 text-xs font-semibold tracking-[0.08em] text-primary-foreground shadow-[0_8px_22px_rgba(139,26,43,0.45)] backdrop-blur-sm transition hover:bg-[rgba(225,29,72,0.95)]"
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
  if (!id) return card;
  return (
    <Link to="/properties/$propertyId" params={{ propertyId: id }} className="block">
      {card}
    </Link>
  );
}


function AgentCard() {
  return (
    <aside className="marble-dark-panel space-y-4 rounded-[20px] p-5 text-primary-foreground shadow-[0_22px_45px_rgba(139,26,43,0.3)]">
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
        <div className="flex items-center gap-3"><Phone className="h-5 w-5 text-primary" />{AGENCY.phoneDisplay}</div>
        <div className="flex items-center gap-3 break-all"><Mail className="h-5 w-5 text-primary" />{AGENCY.email}</div>
      </div>
      <Button asChild className="gold-cta-button h-14 w-full rounded-[14px] text-lg"><a href={`tel:${AGENCY.phone}`}>Запази час за оглед</a></Button>
      <Button asChild variant="outline" className="marble-action-button h-14 w-full rounded-[14px] border-primary/30 bg-transparent text-lg text-primary-foreground hover:bg-white/6"><a href={`mailto:${AGENCY.email}?subject=Запитване%20за%20имот`}>Запитване</a></Button>
    </aside>
  );
}

function DetailCard() {
  return (
    <aside className="marble-dark-panel rounded-[20px] p-6 text-primary-foreground shadow-[0_22px_45px_rgba(139,26,43,0.28)]">
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
    <aside className="overflow-hidden rounded-[22px] border border-primary/15 bg-card shadow-[0_20px_45px_rgba(139,26,43,0.16)]">
      <div className="p-4">
        <div className="font-display text-[1.8rem] text-accent-foreground">Локация</div>
        <p className="mt-1 text-base text-muted-foreground">кв. Лазур, гр. Бургас</p>
      </div>
      <div className="relative h-[300px] overflow-hidden border-y border-primary/10 bg-[linear-gradient(135deg,rgba(212,212,212,0.85),rgba(229,229,229,0.92))]">
        <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(90deg, rgba(120,106,94,0.18) 1px, transparent 1px), linear-gradient(rgba(120,106,94,0.18) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className={cn("absolute inset-y-0 right-[12%] w-[22%] bg-[linear-gradient(180deg,rgba(56,136,180,0.6),rgba(34,125,180,0.78))]", district ? "w-[28%]" : "")} />
        {district ? <div className="absolute inset-y-[12%] right-[18%] w-[28%] rounded-[40%] bg-[rgba(225,29,72,0.5)]" /> : null}
        <div className={cn("absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card text-primary shadow-[0_0_0_8px_rgba(225,29,72,0.18)]", district && "left-[58%] top-[58%]") }>
          <MapPin className="h-6 w-6" />
        </div>
        {district ? <div className="absolute left-[48%] top-[58%] -translate-x-1/2 -translate-y-1/2 font-display text-[2.3rem] tracking-[0.12em] text-card-foreground/75">ЛАЗУР</div> : null}
      </div>
      <div className="p-4">
        <Button asChild className="marble-dark-panel h-14 w-full rounded-[14px] text-lg text-primary-foreground"><a href="https://www.google.com/maps/search/?api=1&query=кв.+Лазур+Бургас" target="_blank" rel="noopener noreferrer">Виж на картата</a></Button>
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

type LayoutSection = {
  id: string;
  visible: boolean;
  props?: Record<string, string | number | boolean | null>;
};

function applySectionOverrides(node: ReactElement | null, props?: LayoutSection["props"]) {
  if (!node || !props) return node;
  const variantId = typeof props.sv_variant === "string" ? props.sv_variant : null;
  const w = typeof props.sv_width === "string" ? props.sv_width : undefined;
  const h = typeof props.sv_height === "string" ? props.sv_height : undefined;
  if (!variantId && !w && !h) return node;
  const existing = node.props as { className?: string; style?: CSSProperties };
  return cloneElement(node as ReactElement<{ className?: string; style?: CSSProperties }>, {
    className: [existing.className, variantId ? `sv-${variantId}` : ""].filter(Boolean).join(" "),
    style: {
      ...(existing.style ?? {}),
      ...(w ? { width: w, marginLeft: "auto", marginRight: "auto" } : {}),
      ...(h ? { height: h } : {}),
    },
  });
}

export function HomePage({
  cities,
  featured,
  layout,
}: {
  cities?: HomeCity[];
  featured?: FeaturedListing[];
  layout?: LayoutSection[] | null;
} = {}) {
  const cityList = HOME_CITY_ORDER.map((slug) => {
    const found = (cities && cities.length ? cities : homeCities.map((c) => ({ name: c.name, image: c.image, slug: c.params.slug }))).find((c) => c.slug === slug);
    return {
      slug,
      name: found?.name || HOME_CITY_NAMES[slug],
      image: citySlugImages[slug] || found?.image || burgasHero,
    };
  });
  const cityOpts = cityList.map((c) => ({ slug: c.slug, name: c.name }));

  // Default order if no saved layout
  const defaults: LayoutSection[] = [
    { id: "hero-search-mobile", visible: true },
    { id: "hero-search-desktop", visible: true },
    { id: "cities-grid", visible: true },
  ];
  const known = new Set(defaults.map((d) => d.id));
  const sections: LayoutSection[] = (() => {
    if (!layout || !Array.isArray(layout)) return defaults;
    const seen = new Set<string>();
    const out: LayoutSection[] = [];
    for (const s of layout) {
      if (known.has(s.id) && !seen.has(s.id)) {
        out.push({ id: s.id, visible: !!s.visible, props: s.props });
        seen.add(s.id);
      }
    }
    for (const d of defaults) if (!seen.has(d.id)) out.push(d);
    return out;
  })();

  const sectionNode = (id: string): ReactElement | null => {
    switch (id) {
      case "hero-search-mobile":
        return (
          <div
            key={id}
            data-section-id="hero-search-mobile"
            className="relative z-20 mx-auto w-full max-w-[520px] px-4 mt-[56vh] md:mt-7 md:px-8 lg:hidden"
          >
            <div className="md:hidden">
              <QuickSearchCard cities={cityOpts} />
            </div>
            <div className="hidden md:block">
              <SearchBar cities={cityOpts} variant="burgundy" />
            </div>
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
          <div key={id} data-section-id="cities-grid">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4 md:gap-4">
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
            <p className="mt-2 text-center text-[11px] tracking-[0.16em] text-white/70">
              Имоти Надежда · <span lang="en">imoti nadezhda</span>
            </p>
          </div>
        );
      case "trust-strip":
        return <TrustStrip key={id} />;
      default:
        return null;
    }
  };

  const renderSection = (s: LayoutSection) => applySectionOverrides(sectionNode(s.id), s.props);

  const visible = sections.filter((s) => s.visible);
  const heroSections = visible;

  return (
    <main className="luxury-page flex min-h-[100dvh] flex-col bg-[#0f0a0b] text-foreground md:h-[100dvh] md:overflow-hidden">
      {/* Paint-splash rough edge filter (mobile) */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
        <defs>
          <filter id="paintSplashEdge" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <section
        className="relative flex flex-1 min-h-0 flex-col pt-0 pb-[92px] md:pb-3"
      >
        {/* Mobile: static Shumen photo per design #5 */}
        <img
          src={resolveAssetUrl(shumenHeroMobile)}
          alt=""
          aria-hidden
          className="fixed inset-0 h-full w-full object-cover md:hidden"
          fetchPriority="high"
          decoding="async"
          style={{ objectPosition: "center 52%" }}
        />
        <AutoPlayVideo
          src={resolveAssetUrl(homeHeroVideo) || homeHero}
          poster={homeHero}
          preload="metadata"
          className="hidden md:absolute md:inset-0 md:block md:h-full md:w-full md:object-contain bg-[#0f0a0b]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/55 md:from-black/15 md:to-black/25" />
        <div className="relative z-10 flex flex-1 min-h-0 flex-col">
          <LuxuryHeader active="sale" overlay />

          <h1 className="sr-only">Имоти Надежда — недвижими имоти в Шумен, Варна, Бургас и Нови пазар</h1>
          <section className="relative z-10 mx-auto flex w-full max-w-[1420px] flex-col gap-[14px] px-4 md:mt-auto md:gap-0 md:px-8 md:pt-5">
            {heroSections.map((s) => renderSection(s))}
          </section>
        </div>
      </section>
    </main>
  );
}





export function TrustStrip() {
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
    hero_video_url?: string | null;
    region?: string | null;
    population?: number | null;
    area_km2?: number | null;
  };
  quarters: Array<{ id: string; slug: string; name: string; image_url?: string | null; properties_count?: number | null }>;
  properties: Array<{ id: string; title: string; price: number | string; currency?: string | null; area_sqm?: number | null; bedrooms?: number | null; bathrooms?: number | null; cover_image_url?: string | null }>;
};

const HERO_FILTER_FIELD =
  "hero-filter-field flex items-center gap-1.5 rounded-xl bg-[#5e0f1d]/85 px-2.5 py-2 text-left ring-1 ring-[#C9A84C]/30 transition hover:bg-[#5e0f1d] relative backdrop-blur-[2px]";

function HeroFilterSelect({
  icon: Icon,
  label,
  value,
  onChange,
  options,
  ariaLabel,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SearchOption[];
  ariaLabel: string;
}) {
  const [open, setOpen] = useReactState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div
      className={HERO_FILTER_FIELD}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Icon className="h-3.5 w-3.5 flex-none text-[#C9A84C]" />
      <div className="min-w-0 flex-1">
        <div className="text-[8.5px] uppercase tracking-[0.12em] text-[#C9A84C]/90">{label}</div>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="mt-0.5 flex w-full items-center justify-between gap-1 bg-transparent text-left outline-none"
        >
          <span className="truncate text-[11px] text-white">{selected?.label ?? "—"}</span>
          <ChevronDown className={cn("h-3 w-3 flex-none text-[#C9A84C]/80 transition", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[120] overflow-hidden rounded-2xl border border-[#C9A84C]/50 bg-[#fff9f0] py-1.5 text-[#2b1418] shadow-[0_18px_45px_rgba(0,0,0,0.38)]"
        >
          {options.map((option) => (
            <button
              key={option.value || "__all"}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "block w-full px-3 py-2.5 text-left text-[13px] font-medium text-[#3a1520] transition hover:bg-[#f5e6c8]",
                option.value === value && "bg-[#f0dcc0] font-semibold text-[#5e0f1d]",
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

function CityFilterPanel({
  citySlug,
  cityName,
  quarters,
}: {
  citySlug: string;
  cityName: string;
  quarters: Array<{ slug: string; name: string }>;
}) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [quarter, setQuarter] = useReactState("");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [ptype, setPtype] = useReactState("");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [priceMax, setPriceMax] = useReactState("");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [areaMin, setAreaMin] = useReactState("");
  const navigate = useNavigate();

  const submit = () => {
    const params: Record<string, string> = { city_slug: citySlug };
    if (quarter) params.quarter_slug = quarter;
    if (ptype) params.property_type = ptype;
    if (priceMax) params.price_max = priceMax;
    if (areaMin) params.area_min = areaMin;
    navigate({ to: "/search", search: params as never });
  };

  const fieldBase = HERO_FILTER_FIELD;

  return (
    <div className="hero-filter-shell overflow-visible rounded-2xl p-3.5 text-white">
      <div className="grid grid-cols-3 gap-2">
        {/* Град (fixed to current city) */}
        <div className={fieldBase}>
          <MapPin className="h-3.5 w-3.5 flex-none text-[#C9A84C]" />
          <div className="min-w-0 flex-1">
            <div className="text-[8.5px] uppercase tracking-[0.12em] text-[#C9A84C]/90">Град</div>
            <div className="truncate text-[11px] text-white">{cityName}</div>
          </div>
        </div>
        <HeroFilterSelect
          icon={House}
          label="Квартал"
          value={quarter}
          onChange={setQuarter}
          ariaLabel="Квартал"
          options={[{ value: "", label: "Всички" }, ...quarters.map((q) => ({ value: q.slug, label: q.name }))]}
        />
        <HeroFilterSelect
          icon={LandPlot}
          label="Вид имот"
          value={ptype}
          onChange={setPtype}
          ariaLabel="Вид имот"
          options={propertyTypeOptions}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {/* Цена до */}
        <label className={fieldBase}>
          <LandPlot className="h-3.5 w-3.5 flex-none text-[#C9A84C]" />
          <div className="min-w-0 flex-1">
            <div className="text-[8.5px] uppercase tracking-[0.12em] text-[#C9A84C]/90">Цена до</div>
            <input
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="€"
              className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/60"
            />
          </div>
        </label>
        {/* Площ от */}
        <label className={fieldBase}>
          <Square className="h-3.5 w-3.5 flex-none text-[#C9A84C]" />
          <div className="min-w-0 flex-1">
            <div className="text-[8.5px] uppercase tracking-[0.12em] text-[#C9A84C]/90">Площ от</div>
            <input
              value={areaMin}
              onChange={(e) => setAreaMin(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="m²"
              className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/60"
            />
          </div>
        </label>
        <button
          type="button"
          onClick={submit}
          className="hero-filter-submit flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-[#5e0f1d] transition hover:brightness-105 active:scale-[0.98]"
          style={{
            background: "linear-gradient(180deg,#E8C766 0%,#C9A84C 100%)",
            boxShadow: "0 6px 16px rgba(201,168,76,0.45), inset 0 1px 0 rgba(255,255,255,0.45)",
          }}
        >
          <Search className="h-3.5 w-3.5" />
          Търси
        </button>
      </div>
    </div>
  );
}

/**
 * Search panel for the homepage hero — identical visual style to CityFilterPanel
 * (used on /cities/$slug pages) but with a city selector instead of a fixed city.
 */
function HomeFilterPanel({
  cities = [],
}: {
  cities?: Array<{ slug: string; name: string }>;
}) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [city, setCity] = useReactState(cities[0]?.slug ?? "burgas");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [ptype, setPtype] = useReactState("");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [priceMax, setPriceMax] = useReactState("");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [areaMin, setAreaMin] = useReactState("");
  const navigate = useNavigate();

  const cityOptions = orderedCityOptions(cities);

  const submit = () => {
    const params: Record<string, string> = {};
    if (city) params.city_slug = city;
    if (ptype) params.property_type = ptype;
    if (priceMax) params.price_max = priceMax;
    if (areaMin) params.area_min = areaMin;
    navigate({ to: "/search", search: params as never });
  };

  const fieldBase = HERO_FILTER_FIELD;

  return (
    <div className="hero-filter-shell overflow-visible rounded-2xl p-3.5 text-white">
      <div className="grid grid-cols-3 gap-2">
        <HeroFilterSelect
          icon={MapPin}
          label="Град"
          value={city}
          onChange={setCity}
          ariaLabel="Град"
          options={cityOptions.map((c) => ({ value: c.slug, label: c.name }))}
        />
        <HeroFilterSelect
          icon={LandPlot}
          label="Вид имот"
          value={ptype}
          onChange={setPtype}
          ariaLabel="Вид имот"
          options={propertyTypeOptions}
        />
        {/* Цена до */}
        <label className={fieldBase}>
          <Building2 className="h-3.5 w-3.5 flex-none text-[#C9A84C]" />
          <div className="min-w-0 flex-1">
            <div className="text-[8.5px] uppercase tracking-[0.12em] text-[#C9A84C]/90">Цена до</div>
            <input
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="€"
              className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/60"
            />
          </div>
        </label>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {/* Площ от */}
        <label className={fieldBase}>
          <Square className="h-3.5 w-3.5 flex-none text-[#C9A84C]" />
          <div className="min-w-0 flex-1">
            <div className="text-[8.5px] uppercase tracking-[0.12em] text-[#C9A84C]/90">Площ от</div>
            <input
              value={areaMin}
              onChange={(e) => setAreaMin(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="m²"
              className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/60"
            />
          </div>
        </label>
        <button
          type="button"
          onClick={submit}
          className="hero-filter-submit col-span-2 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold text-[#5e0f1d] transition hover:brightness-105 active:scale-[0.98]"
          style={{
            background: "linear-gradient(180deg,#E8C766 0%,#C9A84C 100%)",
            boxShadow: "0 6px 16px rgba(201,168,76,0.45), inset 0 1px 0 rgba(255,255,255,0.45)",
          }}
        >
          <Search className="h-3.5 w-3.5" />
          Търси имот
        </button>
      </div>
    </div>
  );
}



export function CityPage({ data }: { data?: CityData } = {}) {
  const [videoFailed, setVideoFailed] = useReactState(false);
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
    city.slug === "shumen"
      ? shumenQuarterCards.map((local, i) => {
          const dbMatch = data?.quarters?.find(
            (q) => q.slug === local.slug || normalizeQuarterName(q.name) === normalizeQuarterName(local.name),
          );
          return {
            id: dbMatch?.id ?? `shumen-${i}`,
            ...local,
            properties_count: dbMatch?.properties_count ?? 0,
          };
        })
      : data?.quarters && data.quarters.length
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
  const fallbackVideo = cityVideoFallbacks[city.slug];
  const heroVideo = videoFailed ? null : (city.hero_video_url || fallbackVideo);

  const fmt = (n: number) => new Intl.NumberFormat("bg-BG").format(n);

  return (
    <main className="min-h-screen bg-[#fbf6ea] text-[#2b1418]">
      {/* HERO with overlay navbar */}
      <section className="relative">
        <div className="relative h-[100dvh] min-h-[640px] w-full overflow-hidden">

          {heroVideo ? (
            <AutoPlayVideo
              src={heroVideo}
              fallbackSrc={fallbackVideo}
              onPermanentError={() => setVideoFailed(true)}
              poster={typeof heroImage === "string" ? heroImage : undefined}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <img src={heroImage} alt={city.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
          )}
          <div aria-hidden className="absolute inset-0 md:bg-gradient-to-b md:from-black/35 md:via-transparent md:to-[#5e0f1d]/40" />

          {/* Overlay navbar */}
          <div className="absolute inset-x-0 top-0 z-30">
            <LuxuryHeader active="sale" overlay />
          </div>


          {/* Right-side overlays */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[60%] flex-col gap-3 overflow-y-auto p-3 md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:max-h-none md:w-full md:max-w-[480px] md:gap-4 md:p-6 md:pt-[130px]">
            {/* FILTER PANEL — wired to /search */}
            <CityFilterPanel
              citySlug={city.slug}
              cityName={city.name}
              quarters={quarters.map((q) => ({ slug: q.slug, name: q.name }))}
            />

            {/* CITY INFO CARD */}
            <div
              className="mt-auto overflow-hidden rounded-2xl text-white shadow-[0_24px_60px_rgba(0,0,0,0.35)] md:ring-1 md:ring-[#C9A84C]/25 bg-transparent md:[background:linear-gradient(135deg,#8B1A2B_0%,#5e0f1d_100%)]"
            >

              <div className="flex gap-3 p-3.5 md:gap-4 md:p-4">
                <img src={heroImage} alt="" className="h-24 w-24 flex-none rounded-xl object-cover ring-1 ring-[#C9A84C]/30" loading="lazy" decoding="async" />
                <div className="min-w-0">
                  <div className="text-[9.5px] uppercase tracking-[0.22em] text-[#C9A84C] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">За града</div>
                  <h1 className="mt-1 font-display text-[2.2rem] leading-none text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.55)]">{city.name}</h1>
                  <p className="mt-2 line-clamp-3 text-[11px] leading-snug text-white/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">{city.description}</p>
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
                    <div className="mt-1 text-[11.5px] font-semibold leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">{s.val}</div>
                    <div className="text-[9px] leading-tight text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">{s.label}</div>
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

      {/* NEIGHBORHOODS — overlaps the hero video */}
      <section className="relative z-20 -mt-32 md:-mt-48 px-4 py-10 md:px-8 md:pt-14 md:pb-12 rounded-t-[28px] shadow-[0_-20px_60px_rgba(0,0,0,0.45)]" style={{ background: "linear-gradient(180deg, rgba(94,15,29,0.92) 0%, #5e0f1d 30%, #4a0c17 100%)" }}>
        <div className="mx-auto max-w-[1480px]">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xl text-white md:text-2xl">
              <Compass className="h-5 w-5 text-[#C9A84C]" />
              Квартали в {city.name}
            </h2>
            <Link
              to="/cities/$slug"
              params={{ slug: city.slug }}
              className="text-sm text-[#C9A84C] transition hover:text-white hover:underline"
            >

              Виж всички квартали →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 md:gap-4">
            {quarters.map((q, i) => {
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
                      <h3 className="font-serif-nadezhda text-[15px] font-bold leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:text-base">
                        {q.name}
                      </h3>
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

            {/* Around-city tile: villages in the oblast/municipality */}
            <Link
              to="/cities/$slug/around"
              params={{ slug: city.slug }}
              className="group overflow-hidden rounded-xl border border-[#C9A84C]/60 bg-gradient-to-br from-[#8B1A2B] to-[#5e0f1d] shadow-[0_8px_24px_rgba(139,26,43,0.18)] transition hover:shadow-[0_14px_32px_rgba(139,26,43,0.28)]"
            >
              <div className="relative flex aspect-[1.25/1] flex-col items-center justify-center overflow-hidden p-3 text-center">
                <Compass className="mb-2 h-8 w-8 text-[#f4d07d] transition group-hover:scale-110" />
                <h3 className="font-serif-nadezhda text-[15px] font-bold leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:text-base">
                  Около {city.name}
                </h3>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#f4d07d]/95">
                  Села в района <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
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
        <Button asChild className="h-12 rounded-[14px] border border-[var(--color-secondary)]/60 bg-transparent px-6 text-base text-primary-foreground hover:bg-white/5">
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " Шумен")}`} target="_blank" rel="noopener noreferrer">
            <MapPin className="mr-2 h-5 w-5 text-[var(--color-secondary)]" />
            Виж на картата
          </a>
        </Button>
      </div>
    </aside>
  );
}

function DistrictListingCard({ p, location, fallback }: { p: QuarterData["properties"][number]; location: string; fallback: string }) {
  const tag = p.is_featured ? "ТОП ОФЕРТА" : "НОВО";
  return (
    <Link to="/properties/$propertyId" params={{ propertyId: p.id }} className="block">
      <article className="marble-hover-card group flex h-full flex-col overflow-hidden rounded-[20px] border border-primary/18 bg-card shadow-[0_18px_42px_rgba(139,26,43,0.16)]">
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
  city: { id: string; slug: string; name: string; lat?: number | null; lng?: number | null };
  quarter: { id: string; slug: string; name: string; description?: string | null; image_url?: string | null; properties_count?: number | null; avg_price_per_sqm?: number | null };
  properties: Array<{
    id: string;
    title: string;
    price: number;
    currency?: string | null;
    area_sqm?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    cover_image_url?: string | null;
    is_featured?: boolean;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  }>;
  gallery?: Array<{ id: string; url: string; is_cover?: boolean; display_order?: number | null }>;
  cityQuarters?: Array<{ name: string }>;
};

export function DistrictPage({ data }: { data?: QuarterData } = {}) {
  const city = data?.city ?? { id: "x", slug: "shumen", name: "Шумен" };
  const quarter = data?.quarter ?? { id: "x", slug: "centar", name: "Център", description: null, image_url: null, properties_count: 0 };
  const properties = data?.properties ?? [];
  const count = properties.length || quarter.properties_count || 0;
  const [districtVideoFailed, setDistrictVideoFailed] = useReactState(false);
  const districtFallbackVideo = cityVideoFallbacks[city.slug];
  const districtHeroVideo = districtVideoFailed ? null : districtFallbackVideo;
  const districtHeroPoster = (citySlugImages as Record<string, string>)[city.slug] || burgasHero;

  return (
    <main className="luxury-page nadezhda-marble-bg min-h-screen font-sans-nadezhda text-[#31020c]">
      <LuxuryHeader active="sale" overlay />

      <div className="relative top-0 w-full overflow-hidden h-[75vh] min-h-[520px] max-h-[780px] md:min-h-[600px]">
        {districtHeroVideo ? (
          <AutoPlayVideo
            src={districtHeroVideo}
            fallbackSrc={districtFallbackVideo}
            onPermanentError={() => setDistrictVideoFailed(true)}
            poster={districtHeroPoster}
            className="h-full w-full object-cover"
          />
        ) : (
          <img src={districtHeroPoster} alt={`${quarter.name}, ${city.name}`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/25" />
        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-7xl px-4 pb-8 pt-[clamp(150px,32vw,220px)]">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-white/85">
            <Link to="/" className="hover:text-white">Начало</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/cities/$slug" params={{ slug: city.slug }} className="hover:text-white">{city.name}</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="font-semibold text-[#f4d07d]">{quarter.name}</span>
          </div>
          <h1 className="max-w-4xl break-words font-serif-nadezhda text-3xl font-bold leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] md:text-5xl">
            Имоти в {quarter.name}
          </h1>
          <p className="mt-1 text-base font-semibold text-white/90 md:text-lg">гр. {city.name} — Имоти Надежда</p>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-5 max-w-7xl px-4">
        <DistrictSearchBar cityName={city.name} citySlug={city.slug} />
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-8 px-4 pb-24 lg:flex-row">
        <DistrictFilterSidebar citySlug={city.slug} quarterSlug={quarter.slug} />

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <p className="max-w-2xl text-base leading-relaxed text-[#3a1418]/80">
              {quarter.description || `Имоти Надежда предлага апартаменти и къщи в квартал ${quarter.name}, ${city.name} — продажба и под наем.`}
            </p>
            <div className="flex items-center gap-4 rounded-2xl border border-[#eaddc4] bg-white px-5 py-3 shadow-sm">
              <House className="h-7 w-7 text-[#c59441]" />
              <div>
                <div className="font-serif-nadezhda text-xl font-bold leading-none text-[#600f1c]">{count}</div>
                <div className="text-sm text-gray-500">имота</div>
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eaddc4] bg-[#fdfaf5] px-4 py-2 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Сортирай по:</span>
              <select className="cursor-pointer border-none bg-transparent text-base font-bold text-[#600f1c] outline-none">
                <option>Най-нови</option>
                <option>Най-евтини</option>
                <option>Най-скъпи</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {properties.length === 0 ? (
              <div className="rounded-2xl border border-[#eaddc4] bg-white p-10 text-center md:col-span-2">
                <p className="font-serif-nadezhda text-xl font-bold text-[#600f1c]">Все още няма обяви в {quarter.name}</p>
                <p className="mt-2 text-sm text-[#3a1418]/70">Разгледайте всички имоти в {city.name} или се върнете към кварталите.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Link to="/search" search={{ city_slug: city.slug } as never} className="nadezhda-gold-bg rounded-full px-5 py-2 text-sm font-bold text-[#2a0a12]">
                    Имоти в {city.name}
                  </Link>
                  <Link to="/cities/$slug" params={{ slug: city.slug }} className="rounded-full border border-[#8B1A2B] px-5 py-2 text-sm font-bold text-[#8B1A2B]">
                    Квартали
                  </Link>
                </div>
              </div>
            ) : (
              properties.map((p) => (
                <DistrictListingCard key={p.id} p={p} location={`${quarter.name}, гр. ${city.name}`} fallback={districtHeroPoster} />
              ))
            )}
          </div>

          {data?.gallery && data.gallery.length > 0 ? (
            <div className="mt-10 rounded-3xl border border-[#eaddc4] bg-[#fdfaf5] p-6 shadow-sm md:p-8">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-serif-nadezhda text-2xl font-bold text-[#600f1c]">Галерия — {quarter.name}</h2>
                <span className="text-sm text-gray-500">{data.gallery.length} снимки</span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {data.gallery.map((img) => (
                  <div key={img.id} className="overflow-hidden rounded-2xl border border-[#eaddc4] shadow-sm">
                    <img src={img.url} alt={quarter.name} className="h-40 w-full object-cover transition duration-500 hover:scale-105" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-8">
            <DistrictPriceMap
              quarterName={quarter.name}
              cityName={city.name}
              citySlug={city.slug}
              cityLat={city.lat}
              cityLng={city.lng}
              listings={properties}
              quarters={data?.cityQuarters ?? [{ name: quarter.name }]}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function DistrictSearchBar({ cityName, citySlug }: { cityName: string; citySlug: string }) {
  return (
    <div className="nadezhda-dark-red-bg flex flex-col gap-3 rounded-2xl border border-[#c59441] p-4 font-sans-nadezhda text-sm text-white shadow-2xl md:flex-row md:flex-wrap md:items-center lg:flex-nowrap">
      <div className="flex min-w-0 flex-1 items-center gap-3 border-white/15 px-2 md:border-r">
        <MapPin className="h-5 w-5 shrink-0 text-[#f4d07d]" />
        <div className="min-w-0">
          <div className="text-xs text-gray-300">Град</div>
          <div className="truncate text-base font-bold">{cityName}</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 border-white/15 px-2 md:border-r">
        <House className="h-5 w-5 shrink-0 text-[#f4d07d]" />
        <div className="min-w-0">
          <div className="text-xs text-gray-300">Вид имот</div>
          <div className="text-base font-bold">Всички</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 border-white/15 px-2 md:border-r">
        <LandPlot className="h-5 w-5 shrink-0 text-[#f4d07d]" />
        <div className="min-w-0">
          <div className="text-xs text-gray-300">Цена</div>
          <div className="text-base font-bold">Без значение</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 px-2">
        <Square className="h-5 w-5 shrink-0 text-[#f4d07d]" />
        <div className="min-w-0">
          <div className="text-xs text-gray-300">Площ</div>
          <div className="text-base font-bold">Без значение</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3 px-2">
        <Link to="/search" search={{ city_slug: citySlug } as never} className="nadezhda-gold-bg flex items-center gap-2 rounded-full px-6 py-3 text-base font-bold text-black shadow-lg transition hover:brightness-110">
          <Search className="h-4 w-4" /> Търси
        </Link>
      </div>
    </div>
  );
}

function DistrictFilterSidebar({ citySlug, quarterSlug }: { citySlug?: string; quarterSlug?: string }) {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useReactState<string>("");
  const [priceMin, setPriceMin] = useReactState("");
  const [priceMax, setPriceMax] = useReactState("");
  const types: Array<{ label: string; value: string }> = [
    { label: "Апартамент", value: "apartment" },
    { label: "Многостаен", value: "multiroom" },
    { label: "Къща", value: "house" },
    { label: "Парцел", value: "land" },
    { label: "Офис", value: "office" },
    { label: "Магазин", value: "shop" },
  ];
  const apply = () => {
    const params: Record<string, string> = {};
    if (citySlug) params.city_slug = citySlug;
    if (quarterSlug) params.quarter_slug = quarterSlug;
    if (selectedType) params.property_type = selectedType;
    if (priceMin) params.price_min = priceMin;
    if (priceMax) params.price_max = priceMax;
    navigate({ to: "/search", search: params as never });
  };
  return (
    <aside className="nadezhda-dark-red-bg w-full flex-shrink-0 rounded-3xl border border-[#c59441] p-6 text-white shadow-xl lg:sticky lg:top-28 lg:w-72 lg:self-start">
      <h3 className="font-serif-nadezhda mb-4 text-2xl font-bold">Бързи филтри</h3>
      <hr className="mb-6 border-gray-600/50" />
      <div className="mb-8">
        <div className="mb-3 text-lg text-gray-300">Тип имот</div>
        {types.map((t) => (
          <label key={t.value} className="mb-3 flex cursor-pointer items-center gap-3 transition hover:text-yellow-400">
            <input
              type="radio"
              name="ptype"
              value={t.value}
              checked={selectedType === t.value}
              onChange={() => setSelectedType(t.value === selectedType ? "" : t.value)}
              className="h-4 w-4 accent-[#f4d07d]"
            />
            <span className="text-sm">{t.label}</span>
          </label>
        ))}
      </div>
      <div className="mb-8">
        <div className="mb-3 text-lg text-gray-300">Цена</div>
        <div className="mb-3 flex items-center gap-3">
          <span className="w-6 text-sm">От</span>
          <div className="flex flex-1 items-center rounded-lg border border-gray-500 bg-black/20 p-2">
            <input
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="€"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-400"
            />
          </div>
        </div>
        <div className="mb-4 flex items-center gap-3">
          <span className="w-6 text-sm">До</span>
          <div className="flex flex-1 items-center rounded-lg border border-gray-500 bg-black/20 p-2">
            <input
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="€"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={apply}
        className="nadezhda-gold-bg mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-3 text-lg font-bold text-black shadow-lg transition hover:brightness-110"
      >
        Приложи филтрите <SlidersHorizontal className="h-4 w-4" />
      </button>
    </aside>
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
  broker?: { id: string; full_name: string; email: string | null; phone: string | null; photo_url: string | null } | null;
  similar?: Array<{
    id: string; title: string; price: number; currency?: string | null;
    area_sqm?: number | null; rooms?: number | null; bedrooms?: number | null; bathrooms?: number | null;
    cover_image_url?: string | null; property_type?: string | null;
    cities?: { name: string; slug: string } | null;
  }>;
};


export function PropertyPage({ data }: { data?: PropertyData } = {}) {
  if (!data) {
    return (
      <main className="luxury-page nadezhda-marble-bg flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif-nadezhda text-3xl text-[#600f1c]">Имотът не е намерен</h1>
          <Link to="/" className="mt-4 inline-block text-[#600f1c] underline">Към началната страница</Link>
        </div>
      </main>
    );
  }
  const { property, images, broker } = data;
  const similar = data.similar ?? [];
  const favs = useFavorites();
  // Resolve broker contact: fall back to the agency owner defaults when the
  // listing has no linked broker (legacy rows / direct admin uploads).
  const brokerName = broker?.full_name?.trim() || AGENCY.name;
  const brokerRole = broker ? "Брокер" : "Старши консултант";
  const brokerPhoneDisplay = broker?.phone?.trim() || AGENCY.phoneDisplay;
  const brokerPhoneTel = `+${brokerPhoneDisplay.replace(/[^\d]/g, "").replace(/^0/, "359")}`;
  const brokerEmail = broker?.email?.trim() || AGENCY.email;
  const brokerPhoto = broker?.photo_url?.trim() || "";

  const gallery = (images.length ? images.map((i) => i.url) : [property.cover_image_url || burgasHero]).filter(Boolean) as string[];
  const cityName = property.cities?.name ?? "—";
  const citySlug = property.cities?.slug ?? "";
  const quarterName = property.quarters?.name ?? "";
  const quarterSlug = property.quarters?.slug ?? "";
  const priceStr = formatPrice(property.price, property.currency ?? "EUR");
  const pricePerSqm = property.area_sqm ? formatPrice(Math.round(Number(property.price) / Number(property.area_sqm)), property.currency ?? "EUR") + " / м²" : undefined;

  const [propVideoFailed, setPropVideoFailed] = useReactState(false);
  const propFallbackVideo = cityVideoFallbacks[citySlug];
  const propHeroVideo = propVideoFailed ? null : propFallbackVideo;
  const propHeroPoster = (citySlugImages as Record<string, string>)[citySlug] || property.cover_image_url || burgasHero;

  return (
    <main className="luxury-page nadezhda-marble-bg min-h-screen font-sans-nadezhda text-[#31020c]">
      <LuxuryHeader active="sale" />

      {/* HERO — city video (replaces the big top image; gallery below is untouched) */}
      <div className="relative h-[550px] w-full">
        {propHeroVideo ? (
          <AutoPlayVideo
            src={propHeroVideo}
            fallbackSrc={propFallbackVideo}
            onPermanentError={() => setPropVideoFailed(true)}
            poster={propHeroPoster}
            className="h-full w-full object-cover"
          />
        ) : (
          <img src={propHeroPoster} alt={cityName} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
      </div>

      {/* Floating search bar */}
      <div className="relative z-10 mx-auto -mt-12 max-w-6xl px-4">
        <DistrictSearchBar cityName={cityName} />
      </div>

      <div className="site-main-below-header mx-auto mt-12 max-w-7xl px-4 pb-24">
        {/* Breadcrumb */}
        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <Link to="/" className="hover:text-black">Начало</Link>
          <ChevronRight className="h-3 w-3" />
          {citySlug ? <Link to="/cities/$slug" params={{ slug: citySlug }} className="hover:text-black">{cityName}</Link> : <span>{cityName}</span>}
          {quarterName ? (
            <>
              <ChevronRight className="h-3 w-3" />
              {quarterSlug ? <Link to="/cities/$slug/districts/$district" params={{ slug: citySlug, district: quarterSlug }} className="hover:text-black">{quarterName}</Link> : <span>{quarterName}</span>}
            </>
          ) : null}
          <ChevronRight className="h-3 w-3" />
          <span className="line-clamp-1 font-bold text-[#600f1c]">{property.title}</span>
        </div>

        <div className="flex flex-col gap-10 lg:flex-row">
          {/* LEFT */}
          <div className="flex-1">
            <div className="mb-6">
              {property.is_featured ? <span className="nadezhda-gold-bg mb-4 inline-block rounded-md px-4 py-2 text-xs font-bold tracking-wide text-black shadow">ТОП ОФЕРТА</span> : null}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-serif-nadezhda mb-3 text-3xl font-bold text-[#600f1c] md:text-4xl">{property.title}</h1>
                  <div className="text-lg text-gray-600">{quarterName ? `кв. ${quarterName}, ` : ""}гр. {cityName}</div>
                </div>
                <div className="flex gap-6">
                  <button
                    type="button"
                    onClick={() => {
                      const added = favs.toggle(property.id);
                      toast.success(added ? "Добавено в любими" : "Премахнато от любими");
                    }}
                    className={`flex items-center gap-2 transition ${favs.has(property.id) ? "text-red-500" : "text-gray-500 hover:text-red-500"}`}
                  >
                    <Heart className={`h-6 w-6 ${favs.has(property.id) ? "fill-red-500 text-red-500" : "text-[#c59441]"}`} />
                    <span className="text-left text-sm">{favs.has(property.id) ? "Премахни\nот любими" : "Добави\nв любими"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const url = typeof window !== "undefined" ? window.location.href : "";
                      const r = await shareProperty({ title: property.title, url, text: `${property.title} — ${cityName}` });
                      if (r === "copied") toast.success("Линкът е копиран");
                      else if (r === "failed") toast.error("Споделянето не е възможно");
                    }}
                    className="flex items-center gap-2 text-gray-500 transition hover:text-blue-500"
                  >
                    <Share2 className="h-6 w-6 text-[#c59441]" />
                    <span className="text-sm">Сподели</span>
                  </button>
                </div>
              </div>
            </div>

            {/* GALLERY — kept untouched (uses existing PropertyGallery for the property photos viewer) */}
            <div className="mb-10 overflow-hidden rounded-3xl border border-[#eaddc4] bg-card p-3 shadow-2xl" style={{ height: 620 }}>
              <PropertyGallery images={gallery} title={property.title} />
            </div>

            {/* Price + facts row */}
            <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b-2 border-gray-200 pb-8">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-gray-500"><LandPlot className="h-5 w-5 text-[#c59441]" /> Цена</div>
                <div className="font-serif-nadezhda mb-2 text-4xl font-bold text-[#600f1c]">{priceStr}</div>
                {pricePerSqm ? <div className="text-sm font-bold text-gray-500">{pricePerSqm}</div> : null}
              </div>
              <div className="flex flex-wrap gap-8 divide-x divide-gray-200 text-center">
                {[
                  property.area_sqm != null ? { icon: Square, label: "Площ", value: `${property.area_sqm} м²` } : null,
                  property.floor != null ? { icon: Building2, label: "Етаж", value: `${property.floor}${property.total_floors ? ` от ${property.total_floors}` : ""}` } : null,
                  property.rooms != null ? { icon: House, label: "Стаи", value: String(property.rooms) } : null,
                  property.bedrooms != null ? { icon: BedDouble, label: "Спални", value: String(property.bedrooms) } : null,
                  property.bathrooms != null ? { icon: Bath, label: "Бани", value: String(property.bathrooms) } : null,
                  property.year_built != null ? { icon: Compass, label: "Година", value: String(property.year_built) } : null,
                ].filter(Boolean).map((f: any, i) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.label} className={i === 0 ? "first:pl-0" : "pl-8"}>
                      <div className="mb-2 flex items-center justify-center gap-2 text-sm text-gray-500"><Icon className="h-5 w-5 text-[#c59441]" /> {f.label}</div>
                      <div className="text-xl font-bold">{f.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            {property.description ? (
              <div className="rounded-3xl border border-[#eaddc4] bg-[#fdfaf5] p-8 shadow-lg md:p-10">
                <h3 className="font-serif-nadezhda mb-6 text-3xl font-bold text-[#600f1c]">Описание</h3>
                <div className="mb-8 space-y-5 whitespace-pre-line text-lg leading-relaxed text-gray-700">
                  {property.description}
                </div>
                {property.amenities && property.amenities.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-8 sm:grid-cols-3 md:grid-cols-5">
                    {property.amenities.slice(0, 10).map((a) => (
                      <div key={a} className="flex flex-col items-center gap-3 p-4 text-center">
                        <Trees className="h-9 w-9 text-[#c59441]" />
                        <div className="text-sm font-bold leading-tight text-gray-700">{a}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* RIGHT — sticky sidebar */}
          <aside className="w-full flex-shrink-0 space-y-8 lg:w-[360px]">
            {/* Broker card */}
            <div className="nadezhda-dark-red-bg rounded-3xl border border-[#c59441] p-8 text-white shadow-2xl">
              <div className="mb-8 flex items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-[#c59441] bg-[#3a0010] shadow-lg">
                  {brokerPhoto ? (
                    <img src={brokerPhoto} alt={brokerName} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-[#c59441]" />
                  )}
                </div>
                <div>
                  <div className="font-serif-nadezhda mb-1 text-xl font-bold text-[#ebd197]">{brokerName}</div>
                  <div className="text-sm text-gray-300">{brokerRole}</div>
                </div>
              </div>
              <div className="mb-6 space-y-4 text-base">
                <a href={`tel:${brokerPhoneTel}`} className="flex items-center gap-4 hover:text-[#f4d07d]"><Phone className="h-5 w-5 text-[#f4d07d]" /> {brokerPhoneDisplay}</a>
                <a href={`mailto:${brokerEmail}`} className="flex items-center gap-4 break-all hover:text-[#f4d07d]"><Mail className="h-5 w-5 text-[#f4d07d]" /> {brokerEmail}</a>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <a href={`tel:${brokerPhoneTel}`} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#c59441]/60 bg-white/5 py-3 text-xs font-semibold text-white transition hover:bg-white/10" aria-label="Позвъни">
                  <Phone className="h-5 w-5 text-[#f4d07d]" /> Позвъни
                </a>
                <a href={`https://wa.me/${brokerPhoneTel.replace(/\D/g, "")}?text=${encodeURIComponent(`Здравейте, интересувам се от имот: ${property.title}`)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#25D366]/70 bg-[#25D366]/15 py-3 text-xs font-semibold text-white transition hover:bg-[#25D366]/25" aria-label="WhatsApp">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" /> WhatsApp
                </a>
                <a href={`viber://chat?number=%2B${brokerPhoneTel.replace(/\D/g, "")}`} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-[#7360f2]/70 bg-[#7360f2]/15 py-3 text-xs font-semibold text-white transition hover:bg-[#7360f2]/25" aria-label="Viber">
                  <MessageCircle className="h-5 w-5 text-[#a594ff]" /> Viber
                </a>
              </div>

              <a href="#inquiry" className="nadezhda-gold-bg mb-3 flex w-full items-center justify-center gap-3 rounded-xl py-4 text-lg font-bold text-black shadow-xl transition hover:brightness-110">
                Запази час за оглед
              </a>
              <a href="#inquiry" className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-[#c59441] bg-transparent py-4 text-lg font-bold text-white transition hover:bg-white/10">
                <Mail className="h-5 w-5" /> Запитване
              </a>
            </div>

            {/* Details card */}
            <div className="nadezhda-dark-red-bg rounded-3xl border border-[#c59441] p-8 text-white shadow-2xl">
              <h3 className="font-serif-nadezhda mb-6 text-2xl font-bold text-[#ebd197]">Детайли за имота</h3>
              <div className="space-y-4 text-sm">
                {[
                  property.property_type ? ["Тип имот:", property.property_type] : null,
                  property.year_built ? ["Година на строителство:", String(property.year_built)] : null,
                  property.floor != null ? ["Етаж:", `${property.floor}${property.total_floors ? ` от ${property.total_floors}` : ""}`] : null,
                  property.rooms != null ? ["Стаи:", String(property.rooms)] : null,
                  property.bedrooms != null ? ["Спални:", String(property.bedrooms)] : null,
                  property.bathrooms != null ? ["Бани:", String(property.bathrooms)] : null,
                  property.area_sqm != null ? ["Площ:", `${property.area_sqm} м²`] : null,
                  property.status ? ["Статус:", property.status] : null,
                  property.address ? ["Адрес:", property.address] : null,
                ].filter(Boolean).map((row: any) => (
                  <div key={row[0]} className="flex justify-between border-b border-gray-600/30 pb-3">
                    <span className="text-gray-400">{row[0]}</span>
                    <span className="w-1/2 text-right font-bold leading-tight">{row[1]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Location card */}
            <div className="nadezhda-marble-bg rounded-3xl border border-[#eaddc4] p-8 shadow-xl">
              <h3 className="font-serif-nadezhda mb-2 text-2xl font-bold text-[#600f1c]">Локация</h3>
              <div className="mb-6 text-base font-semibold text-gray-600">{quarterName ? `кв. ${quarterName}, ` : ""}гр. {cityName}</div>
              <div className="relative mb-6 h-56 overflow-hidden rounded-2xl border border-gray-300 shadow-inner">
                <div className="absolute inset-0 bg-gradient-to-br from-[#525252] via-[#737373] to-[#404040]" />
                <div className="absolute inset-0 bg-blue-100/30 mix-blend-color-burn" />
                <MapPin className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-red-700 drop-shadow-xl" />
              </div>
              <button className="nadezhda-dark-red-bg flex w-full items-center justify-center gap-3 rounded-xl py-4 text-lg font-bold text-white shadow-lg transition hover:brightness-125">
                <MapPin className="h-5 w-5 text-[#f4d07d]" /> Виж на картата
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Ипотечен диапазон */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <MortgageRangeBand price={Number(property.price) || 0} currency={property.currency ?? "EUR"} propertyId={property.id} propertyTitle={property.title} />
      </section>

      {/* Запитване */}
      <section id="inquiry" className="mx-auto max-w-7xl scroll-mt-28 px-4 pb-20">
        <div className="rounded-3xl border border-[#eaddc4] bg-[#fdfaf5] p-6 shadow-xl md:p-10">
          <h2 className="font-serif-nadezhda mb-2 text-3xl font-bold text-[#600f1c]">Запитване за този имот</h2>
          <p className="mb-6 text-base text-gray-600">Оставете данни за контакт и ще Ви върнем отговор още същия работен ден.</p>
          <InquiryForm propertyId={property.id} propertyTitle={property.title} />
        </div>
      </section>

      {/* Подобни имоти */}
      {similar.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-24">
          <h2 className="font-serif-nadezhda mb-8 text-3xl font-bold text-[#600f1c]">Подобни имоти в {cityName}</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => (
              <ListingCard
                key={s.id}
                id={s.id}
                title={s.title}
                price={formatPrice(s.price, s.currency ?? "EUR")}
                size={s.area_sqm ? `${s.area_sqm} м²` : "—"}
                beds={Number(s.bedrooms ?? s.rooms ?? 0)}
                baths={Number(s.bathrooms ?? 0)}
                image={s.cover_image_url || burgasHero}
                tag={s.property_type ?? "Имот"}
                location={s.cities?.name ?? cityName}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function PropertyGallery({ images, title }: { images: string[]; title: string }) {
  const [idx, setIdx] = useGalleryIndex(images.length);
  const [open, setOpen] = useReactState(false);
  const [mainLoaded, setMainLoaded] = useReactState(false);
  const [fsLoaded, setFsLoaded] = useReactState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { setMainLoaded(false); }, [idx, images]);
  useEffect(() => { if (open) setFsLoaded(false); }, [open, idx]);
  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const getFocusable = () => {
      const root = dialogRef.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("aria-hidden"));
    };
    // Move focus into the dialog on open.
    const focusTimer = window.setTimeout(() => {
      const nodes = getFocusable();
      (nodes[0] ?? dialogRef.current)?.focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowLeft") setIdx((idx - 1 + images.length) % images.length);
      else if (e.key === "ArrowRight") setIdx((idx + 1) % images.length);
      else if (e.key === "Home") { e.preventDefault(); setIdx(0); }
      else if (e.key === "End") { e.preventDefault(); setIdx(images.length - 1); }
      else if (e.key === "Tab") {
        const nodes = getFocusable();
        if (nodes.length === 0) { e.preventDefault(); dialogRef.current?.focus(); return; }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !dialogRef.current?.contains(active)) { e.preventDefault(); last.focus(); }
        } else {
          if (active === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(focusTimer);
      // Restore focus to the trigger when the dialog closes.
      opener?.focus?.();
    };
  }, [open, idx, images.length]);
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[18px] bg-black">
        <button ref={openerRef} type="button" onClick={() => setOpen(true)} aria-label="Отвори снимката на цял екран" className="absolute inset-0 h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
          <img src={images[idx]} alt={`${title} – снимка ${idx + 1}`} className={cn("absolute inset-0 h-full w-full object-contain transition-opacity duration-300", mainLoaded ? "opacity-100" : "opacity-0")} loading="lazy" decoding="async" onLoad={() => setMainLoaded(true)} onError={() => setMainLoaded(true)} />
          {!mainLoaded ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-white" aria-label="Зареждане" />
            </div>
          ) : null}
        </button>
        {images.length > 1 ? (
          <>
            <button type="button" aria-label="Предишна снимка" onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + images.length) % images.length); }} className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-[rgba(225,29,72,0.88)] text-primary-foreground shadow-lg"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" aria-label="Следваща снимка" onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % images.length); }} className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-[rgba(225,29,72,0.88)] text-primary-foreground shadow-lg"><ChevronRight className="h-5 w-5" /></button>
          </>
        ) : null}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-[10px] bg-[rgba(53,12,18,0.85)] px-3 py-1 text-xs text-primary-foreground">{idx + 1} / {images.length}</div>
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
      {open ? (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Галерия" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 focus:outline-none" onClick={() => setOpen(false)}>
          <img src={images[idx]} alt={`${title} – снимка ${idx + 1}`} className={cn("max-h-full max-w-full object-contain transition-opacity duration-300", fsLoaded ? "opacity-100" : "opacity-0")} onClick={(e) => e.stopPropagation()} onLoad={() => setFsLoaded(true)} onError={() => setFsLoaded(true)} />
          {!fsLoaded ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-label="Зареждане" />
            </div>
          ) : null}
          <button type="button" aria-label="Затвори" onClick={(e) => { e.stopPropagation(); setOpen(false); }} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="h-6 w-6" /></button>
          {images.length > 1 ? (
            <>
              <button type="button" aria-label="Предишна снимка" onClick={(e) => { e.stopPropagation(); setIdx((idx - 1 + images.length) % images.length); }} className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronLeft className="h-6 w-6" /></button>
              <button type="button" aria-label="Следваща снимка" onClick={(e) => { e.stopPropagation(); setIdx((idx + 1) % images.length); }} className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><ChevronRight className="h-6 w-6" /></button>
              <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm text-white">{idx + 1} / {images.length}</div>
            </>
          ) : null}
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

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending"); setErr(null);
    try {
      const hp = String(new FormData(e.currentTarget).get("website") ?? "");
      const { submitInquiry } = await import("@/lib/catalog.functions");
      await submitInquiry({ data: { property_id: propertyId ?? null, name, email, phone: phone || undefined, message: message || undefined, honeypot: hp } });
      setStatus("ok");
      setName(""); setEmail(""); setPhone(""); setMessage("");
    } catch (e: any) {
      setStatus("error"); setErr(e?.message ?? "Грешка при изпращане");
    }
  };

  return (
    <aside className="marble-dark-panel space-y-4 rounded-[20px] p-5 text-primary-foreground shadow-[0_22px_45px_rgba(139,26,43,0.3)]">
      <div>
        <div className="font-display text-[1.8rem] leading-none text-primary-foreground">Изпрати запитване</div>
        <div className="mt-1 text-base text-primary/85">Ще се свържем с вас възможно най-бързо.</div>
      </div>
      {status === "ok" ? (
        <div className="rounded-[14px] bg-primary-foreground/10 p-4 text-base">Благодарим! Получихме запитването ви.</div>
      ) : (
        <form onSubmit={onSubmit} className="relative space-y-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Име" className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60" />
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Имейл" className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон (по избор)" className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60" />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Съобщение" rows={4} className="w-full rounded-[12px] border border-primary/25 bg-background/10 px-4 py-3 text-primary-foreground placeholder:text-primary/60" />
          {err ? <div className="text-sm text-destructive-foreground">{err}</div> : null}
          <Button type="submit" disabled={status === "sending"} className="gold-cta-button h-14 w-full rounded-[14px] text-lg">{status === "sending" ? "Изпращане…" : "Изпрати запитване"}</Button>
        </form>
      )}
      <div className="space-y-2 border-t border-primary/15 pt-3 text-base">
        <div className="flex items-center gap-3"><Phone className="h-5 w-5 text-primary" />{AGENCY.phoneDisplay}</div>
        <div className="flex items-center gap-3 break-all"><Mail className="h-5 w-5 text-primary" />{AGENCY.email}</div>
      </div>
    </aside>
  );
}

