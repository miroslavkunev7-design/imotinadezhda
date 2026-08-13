/**
 * Имоти Надежда — Pixel-perfect homepage built from the reference HTML (View 3: City Shumen).
 * Structure / spacing / shadows / colors are 1:1 with the reference; content is fully branded.
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  MapPin,
  Home as HomeIcon,
  Wallet,
  Square,
  SlidersHorizontal,
  ArrowRight,
  Map as MapIcon,
  ShieldCheck,
  UserCheck,
  Award,
  Trophy,
  User,
  Compass,
} from "lucide-react";

import logoNadezhda from "@/assets/logo-nadezhda-red.png";
import shumenHeroVideo from "@/assets/shumen-hero.mp4.asset.json";
import cityShumen from "@/assets/city-shumen.jpeg";
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
import { SiteHeader } from "@/components/site/site-header";
import { AutoPlayVideo } from "@/components/site/auto-play-video";
import { resolveAssetUrl } from "@/lib/asset-url";
import { InstallCrmButton } from "@/components/site/install-crm-button";
const shumenPanorama = { url: cityShumen };


/* ---------------- Шумен квартали ---------------- */
const SHUMEN_QUARTERS: Array<{ name: string; slug: string; count: number; image: string }> = [
  { name: "Център",             slug: "tsentar",            count: 64, image: resolveAssetUrl(qTsentar) },
  { name: "Тракия",             slug: "trakiya",            count: 58, image: resolveAssetUrl(qTrakiya) },
  { name: "Боян Българанов 1",  slug: "boyan-balgaranov-1", count: 31, image: resolveAssetUrl(qBoyan1) },
  { name: "Боян Българанов 2",  slug: "boyan-balgaranov-2", count: 28, image: resolveAssetUrl(qBoyan2) },
  { name: "Болницата",          slug: "bolnitsata",         count: 22, image: resolveAssetUrl(qBolnitsata) },
  { name: "Херсон",             slug: "herson",             count: 25, image: resolveAssetUrl(qHerson) },
  { name: "Пазара",             slug: "pazara",             count: 19, image: resolveAssetUrl(qPazara) },
  { name: "Добруджански",       slug: "dobrudzhanski",      count: 43, image: resolveAssetUrl(qDobrudzhanski) },
  { name: "Пожарната",          slug: "pozharnata",         count: 14, image: resolveAssetUrl(qPozharnata) },
  { name: "Военно училище",     slug: "voenno-uchilishte",  count: 11, image: resolveAssetUrl(qVoenno) },
];

/* ---------------- Logo header (top-left) — desktop only ---------------- */
function LogoHeader() {
  return (
    <Link to="/" className="absolute top-0 left-0 z-50 hidden md:block" aria-label="Имоти Надежда — начало">
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


/* ---------------- Header nav (top-right) ---------------- */
function HeaderNav() {
  return (
    <div className="absolute top-0 right-0 p-6 md:p-8 hidden md:flex gap-6 lg:gap-8 text-white text-base lg:text-lg z-50 font-sans-nadezhda items-center drop-shadow-md">
      <Link to="/search" search={{ status: "sale" } as never} className="hover:text-yellow-400 border-b-2 border-yellow-400 pb-1 font-bold">
        За продажба
      </Link>
      <Link to="/search" search={{ status: "rent" } as never} className="hover:text-yellow-400 font-bold">
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

/* ---------------- Shumen info box (overlay on hero, right side) ---------------- */
function ShumenInfoBox({ activePropertiesTotal }: { activePropertiesTotal?: number }) {
  const activeLabel =
    activePropertiesTotal != null ? String(activePropertiesTotal) : "—";
  return (
    <div className="absolute right-4 md:right-8 lg:right-12 top-28 md:top-40 lg:top-44 w-[92%] max-w-[420px] lg:max-w-[450px] p-6 md:p-7 lg:p-8 rounded-3xl text-white font-sans-nadezhda z-30">
      <div className="aspect-square md:aspect-auto md:h-36 lg:h-40 rounded-2xl overflow-hidden mb-5 md:mb-6 relative">
        <img src={shumenPanorama.url} alt="Шумен" className="w-full h-full object-cover" />
      </div>
      <div className="text-yellow-500 text-[11px] tracking-[0.22em] mb-2 uppercase font-bold">За града</div>
      <h1 className="text-4xl md:text-5xl font-serif-nadezhda text-[#ebd197] mb-3 md:mb-4">Шумен</h1>
      <p className="text-sm md:text-base text-gray-300 mb-5 md:mb-6 leading-relaxed">
        Исторически и модерен град в сърцето на Североизточна България. Благоприятна среда за инвестиции, живот и бизнес.
      </p>
      <div className="flex justify-between border-t border-yellow-500/30 pt-5 md:pt-6 mb-6 md:mb-8 gap-2">
        <Stat icon={<UserCheck className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />} value="≈ 85 000" label="жители" />
        <Stat icon={<Square className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />} value="436 km²" label="площ" />
        <Stat icon={<MapPin className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />} value="Стратегическо" label="местоположение" />
        <Stat icon={<HomeIcon className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />} value={activeLabel} label="активни имота" />
      </div>
      <Link
        to="/cities/$slug"
        params={{ slug: "shumen" } as never}
        className="w-full nadezhda-gold-bg text-black font-bold py-3 md:py-4 text-base md:text-lg rounded-xl shadow-lg flex items-center justify-center gap-3 hover:brightness-110 transition"
      >
        Разгледай имоти в Шумен <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
      </Link>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="text-center flex flex-col items-center">
      <div className="mb-1 md:mb-2">{icon}</div>
      <div className="font-bold text-[11px] md:text-xs">{value}</div>
      <div className="text-[9px] md:text-[10px] text-gray-400 mt-1">{label}</div>
    </div>
  );
}

/* ---------------- Main search bar (functional filters) ---------------- */
function MainSearchBar() {
  const navigate = useNavigate();
  const [city, setCity] = useState("shumen");
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const submit = () => {
    const search: Record<string, string> = { city_slug: city };
    if (type) search.property_type = type;
    if (price) search.price_max = price;
    if (area) search.area_min = area;
    navigate({ to: "/search", search: search as never });
  };
  return (
    <div className="nadezhda-dark-red-bg p-4 md:p-5 rounded-3xl border border-[#c59441] shadow-2xl text-white text-sm font-sans-nadezhda w-full lg:w-[750px]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-5">
        <SelectField icon={<MapPin className="text-yellow-500 w-5 h-5" />} label="Град" value={city} onChange={setCity} border
          options={[
            { value: "shumen", label: "Шумен" },
            { value: "varna", label: "Варна" },
            { value: "burgas", label: "Бургас" },
            { value: "novi-pazar", label: "Нови пазар" },
          ]}
        />
        <SelectField icon={<HomeIcon className="text-yellow-500 w-5 h-5" />} label="Вид имот" value={type} onChange={setType} border
          options={[
            { value: "", label: "Всички" },
            { value: "apartment", label: "Апартамент" },
            { value: "house", label: "Къща" },
            { value: "land", label: "Парцел" },
            { value: "office", label: "Офис" },
          ]}
        />
        <SelectField icon={<Wallet className="text-yellow-500 w-5 h-5" />} label="Цена" value={price} onChange={setPrice}
          options={[
            { value: "", label: "Без значение" },
            { value: "50000", label: "до 50 000 €" },
            { value: "100000", label: "до 100 000 €" },
            { value: "150000", label: "до 150 000 €" },
            { value: "250000", label: "до 250 000 €" },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-center">
        <div className="md:col-span-2">
          <SelectField icon={<Square className="text-yellow-500 w-5 h-5" />} label="Площ" value={area} onChange={setArea}
            options={[
              { value: "", label: "Без значение" },
              { value: "50", label: "над 50 м²" },
              { value: "80", label: "над 80 м²" },
              { value: "100", label: "над 100 м²" },
              { value: "150", label: "над 150 м²" },
            ]}
          />
        </div>
        <button
          onClick={submit}
          className="w-full nadezhda-gold-bg text-black font-bold rounded-xl px-4 py-3 text-base flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition"
        >
          <SlidersHorizontal className="w-4 h-4" /> Филтри
        </button>
      </div>
    </div>
  );
}

function SelectField({
  icon, label, value, onChange, options, border,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  border?: boolean;
}) {
  return (
    <div className={`flex px-2 md:px-4 items-center gap-3 ${border ? "md:border-r border-gray-600/50" : ""}`}>
      <span className="flex-none">{icon}</span>
      <div className="w-full min-w-0">
        <div className="text-xs text-gray-300">{label}</div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-white font-bold text-sm md:text-base outline-none appearance-none cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-black">
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ---------------- Neighborhood card — SHUMEN variant ---------------- */
function NeighborhoodCardShumen({ image, title, count, slug }: { image: string; title: string; count: number; slug: string }) {
  return (
    <Link
      to="/cities/$slug/districts/$district"
      params={{ slug: "shumen", district: slug } as never}
      className="group block rounded-2xl overflow-hidden bg-white border border-[#eaddc4] shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 font-sans-nadezhda"
    >
      <div className="relative h-28 md:h-32 overflow-hidden">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
        <h3 className="absolute inset-x-3 bottom-3 text-center font-serif-nadezhda text-[16px] md:text-[18px] font-bold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          {title}
        </h3>
        <div className="absolute top-3 right-3 nadezhda-gold-bg text-[#260108] text-[11px] md:text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1">
          <HomeIcon className="w-3 h-3" /> {count}
        </div>
      </div>

      <div className="nadezhda-marble-bg px-4 py-3 md:px-5 md:py-4 border-t border-[#eaddc4] relative">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[#600f1c]/70 text-xs">
            <MapPin className="text-[#c59441] w-3.5 h-3.5" /> Шумен
          </span>
          <span className="flex items-center gap-1 text-[#c59441] text-xs font-bold opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            Виж <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
        <span className="absolute left-4 right-4 bottom-0 h-[2px] bg-gradient-to-r from-[#600f1c] to-[#c59441] scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500" />
      </div>
    </Link>
  );
}



/* ---------------- Feature strip (bottom) ---------------- */
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

/* ==================== MAIN PAGE ==================== */
function HeroVideoOrImage({
  videoUrl,
  posterUrl,
  alt,
}: {
  videoUrl: string;
  posterUrl: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !videoUrl) {
    return <img src={posterUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" loading="eager" decoding="async" />;
  }
  return (
    <AutoPlayVideo
      src={videoUrl}
      poster={posterUrl}
      onPermanentError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full"
    />
  );
}

export type ShumenHomePageProps = {
  quarterCounts?: Record<string, number>;
  aroundCount?: number;
  activePropertiesTotal?: number;
};

export function ShumenHomePage({ quarterCounts, aroundCount, activePropertiesTotal }: ShumenHomePageProps = {}) {
  const quartersWithLive = SHUMEN_QUARTERS.map((q) => ({
    ...q,
    count: quarterCounts?.[q.slug] ?? 0,
  }));
  return (
    <div className="min-h-screen relative nadezhda-marble-bg text-[#31020c] font-sans-nadezhda overflow-x-hidden">
      {/* Unified top header — all viewports */}
      <SiteHeader />
      {/* HERO */}

      <div className="relative">
        <div className="h-[600px] md:h-[680px] lg:h-[720px] w-full relative overflow-hidden">
          <HeroVideoOrImage videoUrl={resolveAssetUrl(shumenHeroVideo)} posterUrl={shumenPanorama.url} alt="Шумен" />
          <div className="absolute inset-0" />
          <ShumenInfoBox activePropertiesTotal={activePropertiesTotal} />
        </div>

        {/* Main search bar (overlapping hero bottom, right-aligned) */}
        <div className="max-w-7xl mx-auto -mt-14 md:-mt-16 relative z-30 flex justify-center lg:justify-end lg:pr-[480px] px-4">
          <MainSearchBar />
        </div>
      </div>

      {/* Quarters section */}
      <div className="max-w-7xl mx-auto mt-14 md:mt-20 px-4 pb-12 md:pb-16">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 md:mb-8 gap-3">
          <h2 className="text-2xl md:text-3xl font-serif-nadezhda text-[#600f1c] font-bold flex items-center gap-3 md:gap-4">
            <MapIcon className="text-[#c59441] w-6 h-6 md:w-7 md:h-7" /> Квартали в Шумен
          </h2>
          <Link
            to="/cities/$slug"
            params={{ slug: "shumen" } as never}
            className="text-[#600f1c] hover:underline font-sans-nadezhda text-sm font-bold flex items-center gap-2"
          >
            Виж всички квартали <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mb-10 md:mb-12">
          {quartersWithLive.map((q) => (
            <NeighborhoodCardShumen key={q.slug} image={q.image} title={q.name} count={q.count} slug={q.slug} />
          ))}

          {/* Around Shumen — villages in the oblast */}
          <Link
            to="/cities/$slug/around"
            params={{ slug: "shumen" } as never}
            className="group block rounded-2xl overflow-hidden border border-[#eaddc4] shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 font-sans-nadezhda nadezhda-dark-red-bg"
          >
            <div className="relative h-28 md:h-32 flex flex-col items-center justify-center text-center px-3">
              <Compass className="w-8 h-8 md:w-9 md:h-9 text-[#f4d07d] mb-1.5 group-hover:scale-110 transition" />
              <h3 className="font-serif-nadezhda text-[15px] md:text-[17px] font-bold text-white leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                Около Шумен
              </h3>
              <span className="mt-1.5 text-[11px] md:text-xs text-[#f4d07d]/95">
                {aroundCount != null ? `${aroundCount} имота в селата` : "Села в област Шумен"}
              </span>
            </div>
            <div className="nadezhda-marble-bg px-4 py-3 md:px-5 md:py-4 border-t border-[#eaddc4]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#600f1c]/70">Виж всички</span>
                <span className="flex items-center gap-1 text-[#c59441] font-bold">
                  Отвори <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </Link>
        </div>

        <div className="flex justify-center mb-12 md:mb-16">
          <Link
            to="/cities/$slug"
            params={{ slug: "shumen" } as never}
            className="nadezhda-dark-red-bg text-white py-3 md:py-4 px-6 md:px-10 text-base md:text-lg rounded-full font-bold shadow-xl flex items-center gap-3 hover:brightness-125 transition"
          >
            <HomeIcon className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />
            Виж всички квартали в Шумен
            <ArrowRight className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />
          </Link>
        </div>

        {/* Feature strip */}
        <div className="border border-[#eaddc4] rounded-3xl nadezhda-marble-bg p-6 md:p-10 lg:p-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 shadow-lg">
          <FeatureIcon Icon={ShieldCheck} title="Доверие и сигурност" desc="Прозрачност във всяка сделка" />
          <FeatureIcon Icon={UserCheck} title="Персонален подход" desc="Индивидуално отношение към всеки клиент" />
          <FeatureIcon Icon={Award} title="Богат избор" desc="Голямо разнообразие от имоти в региона" />
          <FeatureIcon Icon={Trophy} title="Професионализъм" desc="Опитен екип с доказани резултати" />
        </div>
      </div>
      <InstallCrmButton />
    </div>
  );
}

export default ShumenHomePage;
