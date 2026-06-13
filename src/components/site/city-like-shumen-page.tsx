/**
 * Generic city homepage that mirrors the Шумен layout 1:1 — used for Варна, Бургас, Нови пазар.
 * Props supply the city-specific copy (label, description, video, quarter list, stats).
 */
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  MapPin,
  Home as HomeIcon,
  Wallet,
  Square,
  SlidersHorizontal,
  Search,
  ChevronDown,
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
import { SiteHeader } from "@/components/site/site-header";
import { InstallCrmButton } from "@/components/site/install-crm-button";

export type CityHomeProps = {
  citySlug: string;
  cityLabel: string;
  cityDescription: string;
  heroVideoUrl: string;
  heroPosterUrl: string;
  panoramaUrl: string;
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

function TopFloatSearch({ defaultCity }: { defaultCity: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = () => {
    const trimmed = q.trim().toLowerCase();
    const cityMap: Record<string, string> = {
      шумен: "shumen", shumen: "shumen",
      бургас: "burgas", burgas: "burgas",
      варна: "varna", varna: "varna",
      "нови пазар": "novi-pazar", "novi pazar": "novi-pazar",
    };
    const city_slug = cityMap[trimmed] ?? defaultCity;
    navigate({ to: "/search", search: { city_slug } as never });
  };
  return (
    <div className="absolute top-6 md:top-8 left-1/2 -translate-x-1/2 w-[92%] max-w-[500px] z-40 flex bg-white rounded-full overflow-hidden shadow-2xl border border-gray-200 h-12 md:h-14 font-sans-nadezhda">
      <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} type="text" placeholder="Търсене на град..." className="px-5 md:px-6 py-2 flex-1 outline-none text-black text-sm md:text-base bg-white" />
      <button onClick={submit} className="nadezhda-dark-red-bg px-5 md:px-8 text-white font-bold flex items-center justify-center gap-2 hover:brightness-110 transition">
        <Search className="text-yellow-500 w-4 h-4 md:w-5 md:h-5" />
        <span className="hidden sm:inline">Търси</span>
      </button>
    </div>
  );
}

function CityInfoBox({ p }: { p: CityHomeProps }) {
  return (
    <div className="absolute right-4 md:right-8 lg:right-12 top-28 md:top-40 lg:top-44 w-[92%] max-w-[420px] lg:max-w-[450px] p-6 md:p-7 lg:p-8 rounded-3xl text-white font-sans-nadezhda z-30">
      <div className="aspect-square md:aspect-auto md:h-36 lg:h-40 rounded-2xl overflow-hidden mb-5 md:mb-6 relative">
        <img src={p.panoramaUrl} alt={p.cityLabel} className="w-full h-full object-cover" />
      </div>
      <div className="text-yellow-500 text-[11px] tracking-[0.22em] mb-2 uppercase font-bold">За града</div>
      <h1 className="text-4xl md:text-5xl font-serif-nadezhda text-[#ebd197] mb-3 md:mb-4">{p.cityLabel}</h1>
      <p className="text-sm md:text-base text-gray-300 mb-5 md:mb-6 leading-relaxed">{p.cityDescription}</p>
      <div className="flex justify-between border-t border-yellow-500/30 pt-5 md:pt-6 mb-6 md:mb-8 gap-2">
        <Stat icon={<UserCheck className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />} value={p.stats.population} label="жители" />
        <Stat icon={<Square className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />} value={p.stats.area} label="площ" />
        <Stat icon={<MapPin className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />} value="Стратегическо" label="местоположение" />
        <Stat icon={<HomeIcon className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />} value={p.stats.activeProperties} label="активни имота" />
      </div>
      <Link to="/cities/$slug" params={{ slug: p.citySlug } as never} className="w-full nadezhda-gold-bg text-black font-bold py-3 md:py-4 text-base md:text-lg rounded-xl shadow-lg flex items-center justify-center gap-3 hover:brightness-110 transition">
        Разгледай имоти в {p.cityLabel} <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
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

function MainSearchBar({ citySlug, cityLabel }: { citySlug: string; cityLabel: string }) {
  const navigate = useNavigate();
  return (
    <div className="nadezhda-dark-red-bg p-4 md:p-5 rounded-3xl border border-[#c59441] shadow-2xl text-white text-sm font-sans-nadezhda w-full lg:w-[750px]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-5">
        <Field icon={<MapPin className="text-yellow-500 w-5 h-5" />} label="Град" value={cityLabel} border />
        <Field icon={<HomeIcon className="text-yellow-500 w-5 h-5" />} label="Вид имот" value="Всички" border />
        <Field icon={<Wallet className="text-yellow-500 w-5 h-5" />} label="Цена" value="Без значение" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-center">
        <div className="md:col-span-2">
          <Field icon={<Square className="text-yellow-500 w-5 h-5" />} label="Площ" value="Без значение" />
        </div>
        <button onClick={() => navigate({ to: "/search", search: { city_slug: citySlug } as never })} className="w-full nadezhda-gold-bg text-black font-bold rounded-xl px-4 py-3 text-base flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition">
          <SlidersHorizontal className="w-4 h-4" /> Филтри
        </button>
      </div>
    </div>
  );
}

function Field({ icon, label, value, border }: { icon: React.ReactNode; label: string; value: string; border?: boolean }) {
  return (
    <div className={`flex px-2 md:px-4 items-center gap-3 ${border ? "md:border-r border-gray-600/50" : ""}`}>
      <span className="flex-none">{icon}</span>
      <div className="w-full min-w-0">
        <div className="text-xs text-gray-300">{label}</div>
        <div className="font-bold flex justify-between items-center w-full text-sm md:text-base truncate">
          {value} <ChevronDown className="w-3 h-3 flex-none" />
        </div>
      </div>
    </div>
  );
}

function NeighborhoodCard({ image, title, count, slug, citySlug, cityLabel }: { image: string; title: string; count: number; slug: string; citySlug: string; cityLabel: string }) {
  return (
    <Link to="/cities/$slug/districts/$district" params={{ slug: citySlug, district: slug } as never} className="group block rounded-2xl overflow-hidden bg-white border border-[#eaddc4] shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 font-sans-nadezhda">
      <div className="relative h-28 md:h-32 overflow-hidden">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full nadezhda-dark-red-bg" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#4f0314]/78 via-[#4f0314]/50 to-[#4f0314]/18" />
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-full bg-[#5e0f1d]/55 px-3 py-2 backdrop-blur-[1px]">
          <h3 className="text-center font-serif-nadezhda text-[15px] font-bold leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] md:text-[17px]">{title}</h3>
        </div>
        <div className="absolute top-3 right-3 nadezhda-gold-bg text-[#260108] text-[11px] md:text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1">
          <HomeIcon className="w-3 h-3" /> {count}
        </div>
      </div>
      <div className="nadezhda-marble-bg px-4 py-3 md:px-5 md:py-4 border-t border-[#eaddc4] relative">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[#600f1c]/70 text-xs">
            <MapPin className="text-[#c59441] w-3.5 h-3.5" /> {cityLabel}
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

function HeroVideoOrImage({ videoUrl, posterUrl, alt }: { videoUrl: string; posterUrl: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !videoUrl) {
    return <img src={posterUrl} alt={alt} className="absolute inset-0 w-full h-full object-cover" />;
  }
  return (
    <video src={videoUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" poster={posterUrl} onError={() => setFailed(true)} />
  );
}

export function CityLikeShumenPage(p: CityHomeProps) {
  return (
    <div className="min-h-screen relative nadezhda-marble-bg text-[#31020c] font-sans-nadezhda overflow-x-hidden">
      <div className="md:hidden"><SiteHeader /></div>

      <div className="relative">
        <div className="hidden md:block"><TopFloatSearch defaultCity={p.citySlug} /></div>
        <div className="h-[600px] md:h-[680px] lg:h-[720px] w-full relative overflow-hidden">
          <HeroVideoOrImage videoUrl={p.heroVideoUrl} posterUrl={p.heroPosterUrl} alt={p.cityLabel} />
          <div className="absolute inset-0" />
          <LogoHeader />
          <HeaderNav />
          <CityInfoBox p={p} />
        </div>

        <div className="max-w-7xl mx-auto -mt-14 md:-mt-16 relative z-30 flex justify-center lg:justify-end lg:pr-[480px] px-4">
          <MainSearchBar citySlug={p.citySlug} cityLabel={p.cityLabel} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-14 md:mt-20 px-4 pb-12 md:pb-16">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 md:mb-8 gap-3">
          <h2 className="text-2xl md:text-3xl font-serif-nadezhda text-[#600f1c] font-bold flex items-center gap-3 md:gap-4">
            <MapIcon className="text-[#c59441] w-6 h-6 md:w-7 md:h-7" /> Квартали в {p.cityLabel}
          </h2>
          <Link to="/cities/$slug" params={{ slug: p.citySlug } as never} className="text-[#600f1c] hover:underline font-sans-nadezhda text-sm font-bold flex items-center gap-2">
            Виж всички квартали <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mb-10 md:mb-12">
          {p.quarters.map((q) => (
            <NeighborhoodCard key={q.slug} image={q.image} title={q.name} count={q.count} slug={q.slug} citySlug={p.citySlug} cityLabel={p.cityLabel} />
          ))}

          <Link to="/cities/$slug/around" params={{ slug: p.citySlug } as never} className="group block rounded-2xl overflow-hidden border border-[#eaddc4] shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 font-sans-nadezhda nadezhda-dark-red-bg">
            <div className="relative h-28 md:h-32 flex flex-col items-center justify-center text-center px-3">
              <Compass className="w-8 h-8 md:w-9 md:h-9 text-[#f4d07d] mb-1.5 group-hover:scale-110 transition" />
              <h3 className="font-serif-nadezhda text-[15px] md:text-[17px] font-bold text-white leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                Около {p.cityLabel}
              </h3>
              <span className="mt-1.5 text-[11px] md:text-xs text-[#f4d07d]/95">Села около {p.cityLabel}</span>
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
          <Link to="/cities/$slug" params={{ slug: p.citySlug } as never} className="nadezhda-dark-red-bg text-white py-3 md:py-4 px-6 md:px-10 text-base md:text-lg rounded-full font-bold shadow-xl flex items-center gap-3 hover:brightness-125 transition">
            <HomeIcon className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />
            Виж всички квартали в {p.cityLabel}
            <ArrowRight className="text-yellow-500 w-5 h-5 md:w-6 md:h-6" />
          </Link>
        </div>

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

export default CityLikeShumenPage;
