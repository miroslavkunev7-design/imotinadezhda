import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  ChevronLeft,
  ChevronRight,
  Heart,
  Home,
  Mail,
  MapPin,
  Phone,
  Search,
  Share2,
  SlidersHorizontal,
  Square,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import brandBrush from "@/assets/mobile-opa/nadezhda-brand-brush.png";
import wineBrush from "@/assets/mobile-opa/wine-section-brush.png";
import { PropertyInquiryForm } from "@/components/site/property-inquiry-form";
import { AGENCY } from "@/lib/contact-config";
import { shareProperty, useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

const formatPrice = (value: number | string, currency = "EUR") => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Цена при запитване";
  const symbol = currency === "BGN" ? "лв." : currency === "EUR" ? "€" : currency;
  return `${new Intl.NumberFormat("bg-BG").format(amount)} ${symbol}`;
};

function MobileBrandHeader({ backTo }: { backTo?: string }) {
  return (
    <header className="sticky top-0 z-40 flex min-h-16 items-center gap-2 border-b border-[#7f1026]/15 bg-[#fffaf4]/95 px-3 py-2 shadow-sm backdrop-blur md:hidden">
      {backTo ? (
        <Link
          to={backTo}
          aria-label="Назад"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#8b1a2b]/20 bg-white text-[#8b1a2b]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : null}
      <Link to="/" aria-label="Имоти Надежда — начало" className="min-w-0 flex-1">
        <img src={brandBrush} alt="Недвижими имоти Надежда" className="h-12 w-auto max-w-full object-contain" />
      </Link>
      <Link
        to="/search"
        search={{ favorites: "1" } as never}
        aria-label="Любими имоти"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#8b1a2b]/20 bg-white text-[#8b1a2b]"
      >
        <Heart className="h-5 w-5" />
      </Link>
      <Link
        to="/login"
        aria-label="CRM профил"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8b1a2b] text-white"
      >
        <User className="h-5 w-5" />
      </Link>
    </header>
  );
}

type MobileCityProps = {
  citySlug: string;
  cityLabel: string;
  cityDescription: string;
  panoramaUrl: string;
  regionLabel: string;
  stats: { population: string; area: string; activeProperties: string };
  quarters: Array<{ name: string; slug: string; count: number; image: string }>;
};

export function MobileCityScreen({
  citySlug,
  cityLabel,
  cityDescription,
  panoramaUrl,
  regionLabel,
  stats,
  quarters,
}: MobileCityProps) {
  const navigate = useNavigate();
  const [propertyType, setPropertyType] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [areaMin, setAreaMin] = useState("");

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate({
      to: "/search",
      search: {
        city_slug: citySlug,
        ...(propertyType ? { property_type: propertyType } : {}),
        ...(priceMax ? { price_max: priceMax } : {}),
        ...(areaMin ? { area_min: areaMin } : {}),
      } as never,
    });
  };

  return (
    <main className="min-h-[100dvh] bg-[#f8f2e8] pb-[max(2rem,env(safe-area-inset-bottom))] text-[#3d1119] md:hidden">
      <MobileBrandHeader />
      <section className="relative isolate min-h-[26rem] overflow-hidden">
        <img src={panoramaUrl} alt={cityLabel} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/30 to-[#5b0718]/95" />
        <div className="relative flex min-h-[26rem] flex-col justify-end px-5 pb-6 pt-12 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f5d88a]">Град</p>
          <h1 className="mt-1 font-serif-nadezhda text-5xl font-bold leading-none">{cityLabel}</h1>
          {regionLabel ? <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#f5d88a]">{regionLabel}</p> : null}
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/90">{cityDescription}</p>
          <dl className="mt-5 grid grid-cols-2 gap-2">
            {[
              ["Активни имоти", stats.activeProperties],
              ["Квартали", String(quarters.length)],
              ["Население", stats.population],
              ["Площ", stats.area],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/20 bg-black/25 p-3 backdrop-blur-sm">
                <dt className="text-[10px] uppercase tracking-wider text-white/70">{label}</dt>
                <dd className="mt-1 text-base font-bold">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <form onSubmit={submitSearch} className="relative z-10 -mt-2 mx-3 rounded-3xl border border-[#c59441]/45 bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#760f23]">
          <Search className="h-4 w-4" /> Търси в {cityLabel}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-[#760f23]/70">
            Вид имот
            <select
              value={propertyType}
              onChange={(event) => setPropertyType(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#8b1a2b]/20 bg-[#fffaf4] px-3 py-2.5 text-sm text-[#3d1119]"
            >
              <option value="">Всички</option>
              <option value="apartment">Апартамент</option>
              <option value="house">Къща</option>
              <option value="land">Парцел</option>
              <option value="office">Офис</option>
              <option value="commercial">Търговски</option>
            </select>
          </label>
          <label className="text-xs text-[#760f23]/70">
            Цена до (€)
            <input
              value={priceMax}
              onChange={(event) => setPriceMax(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Без лимит"
              className="mt-1 w-full rounded-xl border border-[#8b1a2b]/20 bg-[#fffaf4] px-3 py-2.5 text-sm text-[#3d1119]"
            />
          </label>
          <label className="col-span-2 text-xs text-[#760f23]/70">
            Минимална площ (м²)
            <input
              value={areaMin}
              onChange={(event) => setAreaMin(event.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Без минимум"
              className="mt-1 w-full rounded-xl border border-[#8b1a2b]/20 bg-[#fffaf4] px-3 py-2.5 text-sm text-[#3d1119]"
            />
          </label>
        </div>
        <button type="submit" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#8b1a2b] py-3 text-sm font-bold text-white">
          <Search className="h-4 w-4" /> Покажи имотите
        </button>
      </form>

      <section className="px-3 pt-7">
        <div className="relative mb-4 overflow-hidden rounded-xl px-5 py-3 text-white">
          <img src={wineBrush} alt="" aria-hidden className="absolute inset-0 h-full w-full object-fill" />
          <h2 className="relative font-serif-nadezhda text-2xl font-bold">Квартали на {cityLabel}</h2>
        </div>
        {quarters.length ? (
          <div className="grid grid-cols-2 gap-3">
            {quarters.map((quarter) => (
              <Link
                key={quarter.slug}
                to="/cities/$slug/districts/$district"
                params={{ slug: citySlug, district: quarter.slug }}
                className="group overflow-hidden rounded-2xl border border-[#c59441]/35 bg-white shadow-md"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#6a1020]">
                  {quarter.image ? (
                    <img src={quarter.image} alt={quarter.name} loading="lazy" className="h-full w-full object-cover transition group-active:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[#f5d88a]">
                      <Building2 className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-bold leading-tight">{quarter.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-[#8b1a2b]/70">
                    <Home className="h-3 w-3" /> {quarter.count} имота
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-[#c59441]/30 bg-white p-6 text-center text-sm">
            Все още няма публикувани квартали.
          </p>
        )}
      </section>
    </main>
  );
}

export function MobileDistrictScreen({ data }: { data: any }) {
  const { city, quarter } = data;
  const properties = data.properties ?? [];
  const favorites = useFavorites();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [type, setType] = useState("");
  const [sort, setSort] = useState<"new" | "price-asc" | "price-desc">("new");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const propertyTypes = useMemo(
    () => Array.from(new Set(properties.map((property: any) => property.property_type).filter(Boolean))) as string[],
    [properties],
  );
  const visible = useMemo(() => {
    const filtered = properties.filter(
      (property: any) =>
        (!type || property.property_type === type) &&
        (!favoritesOnly || favorites.has(property.id)),
    );
    if (sort === "price-asc") return [...filtered].sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-desc") return [...filtered].sort((a, b) => Number(b.price) - Number(a.price));
    return filtered;
  }, [favorites, favoritesOnly, properties, sort, type]);

  return (
    <main className="min-h-[100dvh] bg-[#f8f2e8] pb-[max(2rem,env(safe-area-inset-bottom))] text-[#3d1119] md:hidden">
      <MobileBrandHeader backTo={`/cities/${city.slug}`} />
      <section className="relative isolate min-h-64 overflow-hidden">
        {quarter.image_url ? (
          <img src={quarter.image_url} alt={quarter.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-[#3d0711]/30 to-[#5b0718]/95" />
        <div className="relative flex min-h-64 flex-col justify-end px-5 pb-5 text-white">
          <p className="flex items-center gap-1 text-xs uppercase tracking-widest text-[#f5d88a]">
            <MapPin className="h-3.5 w-3.5" /> {city.name}
          </p>
          <h1 className="mt-1 font-serif-nadezhda text-4xl font-bold">{quarter.name}</h1>
          {quarter.description ? <p className="mt-2 line-clamp-3 text-sm text-white/85">{quarter.description}</p> : null}
          <p className="mt-3 text-sm font-bold">{properties.length} публикувани имота</p>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-[#8b1a2b]/10 bg-[#f8f2e8]/95 px-3 py-3 backdrop-blur">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <label className="sr-only" htmlFor="mobile-district-sort">Сортиране</label>
          <select
            id="mobile-district-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            className="min-w-0 rounded-xl border border-[#8b1a2b]/20 bg-white px-3 py-2.5 text-sm font-semibold"
          >
            <option value="new">Най-нови</option>
            <option value="price-asc">Най-ниска цена</option>
            <option value="price-desc">Най-висока цена</option>
          </select>
          <button
            type="button"
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly((value) => !value)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border",
              favoritesOnly ? "border-[#8b1a2b] bg-[#8b1a2b] text-white" : "border-[#8b1a2b]/20 bg-white text-[#8b1a2b]",
            )}
          >
            <Heart className={cn("h-5 w-5", favoritesOnly && "fill-current")} />
          </button>
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8b1a2b] text-white"
          >
            {filtersOpen ? <X className="h-5 w-5" /> : <SlidersHorizontal className="h-5 w-5" />}
          </button>
        </div>
        {filtersOpen ? (
          <div className="mt-2 rounded-2xl border border-[#8b1a2b]/15 bg-white p-3 shadow-lg">
            <label className="text-xs font-semibold text-[#8b1a2b]/70">
              Тип имот
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="mt-1 w-full rounded-xl border border-[#8b1a2b]/20 bg-[#fffaf4] px-3 py-2.5 text-sm"
              >
                <option value="">Всички налични типове</option>
                {propertyTypes.map((propertyType) => (
                  <option key={propertyType} value={propertyType}>{propertyType}</option>
                ))}
              </select>
            </label>
            <Link
              to="/search"
              search={{ city_slug: city.slug, quarter_slug: quarter.slug, ...(type ? { property_type: type } : {}) } as never}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#8b1a2b] py-2.5 text-sm font-bold text-white"
            >
              <Search className="h-4 w-4" /> Разширено търсене
            </Link>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3 p-3">
        {visible.map((property: any) => (
          <article key={property.id} className="relative overflow-hidden rounded-2xl border border-[#c59441]/35 bg-white shadow-md">
            <Link to="/properties/$propertyId" params={{ propertyId: property.id }} className="block">
              <div className="aspect-[4/3] bg-[#6a1020]">
                {property.cover_image_url ? (
                  <img src={property.cover_image_url} alt={property.title} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#f5d88a]"><Building2 className="h-9 w-9" /></div>
                )}
              </div>
              <div className="p-3">
                <p className="text-base font-bold text-[#8b1a2b]">{formatPrice(property.price, property.currency)}</p>
                <h2 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight">{property.title}</h2>
                <p className="mt-2 flex flex-wrap gap-x-2 text-[11px] text-[#3d1119]/65">
                  {property.area_sqm ? <span>{property.area_sqm} м²</span> : null}
                  {property.rooms ? <span>{property.rooms} стаи</span> : null}
                </p>
              </div>
            </Link>
            <button
              type="button"
              aria-label={favorites.has(property.id) ? "Премахни от любими" : "Добави в любими"}
              onClick={() => favorites.toggle(property.id)}
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#8b1a2b] shadow"
            >
              <Heart className={cn("h-5 w-5", favorites.has(property.id) && "fill-current")} />
            </button>
          </article>
        ))}
        {!visible.length ? (
          <p className="col-span-2 rounded-2xl border border-[#c59441]/30 bg-white p-8 text-center text-sm">
            Няма имоти по избраните филтри.
          </p>
        ) : null}
      </section>
    </main>
  );
}

export function MobilePropertyScreen({ data }: { data: any }) {
  const { property, broker } = data;
  const favorites = useFavorites();
  const gallery = (
    data.images?.length
      ? data.images.map((image: any) => image.url)
      : [property.cover_image_url]
  ).filter(Boolean);
  const [photoIndex, setPhotoIndex] = useState(0);
  const cityName = property.cities?.name ?? "";
  const citySlug = property.cities?.slug ?? "";
  const quarterName = property.quarters?.name ?? "";
  const quarterSlug = property.quarters?.slug ?? "";
  const brokerName = broker?.full_name?.trim() || AGENCY.name;
  const brokerPhoneDisplay = broker?.phone?.trim() || AGENCY.phoneDisplay;
  const brokerPhoneTel = `+${brokerPhoneDisplay.replace(/[^\d]/g, "").replace(/^0/, "359")}`;
  const brokerEmail = broker?.email?.trim() || AGENCY.email;
  const backTo = citySlug && quarterSlug
    ? `/cities/${citySlug}/districts/${quarterSlug}`
    : citySlug
      ? `/cities/${citySlug}`
      : "/";

  const onShare = async () => {
    const result = await shareProperty({
      title: property.title,
      text: `${property.title} — ${cityName}`,
      url: window.location.href,
    });
    if (result === "copied") toast.success("Линкът е копиран");
    if (result === "failed") toast.error("Споделянето не е възможно");
  };

  const facts = [
    property.area_sqm != null ? { label: "Площ", value: `${property.area_sqm} м²`, icon: Square } : null,
    property.rooms != null ? { label: "Стаи", value: String(property.rooms), icon: Home } : null,
    property.bedrooms != null ? { label: "Спални", value: String(property.bedrooms), icon: BedDouble } : null,
    property.bathrooms != null ? { label: "Бани", value: String(property.bathrooms), icon: Bath } : null,
    property.floor != null ? { label: "Етаж", value: `${property.floor}${property.total_floors ? `/${property.total_floors}` : ""}`, icon: Building2 } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; icon: typeof Square }>;

  return (
    <main className="min-h-[100dvh] bg-[#f8f2e8] pb-[calc(10.5rem+env(safe-area-inset-bottom))] text-[#3d1119] md:hidden">
      <MobileBrandHeader backTo={backTo} />
      <section className="relative aspect-[4/3] overflow-hidden bg-[#5b0718]">
        {gallery.length ? (
          <img src={gallery[photoIndex]} alt={`${property.title} — снимка ${photoIndex + 1}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[#f5d88a]"><Building2 className="h-14 w-14" /></div>
        )}
        <div className="absolute inset-x-0 top-0 flex justify-between p-3">
          <button
            type="button"
            onClick={() => {
              const added = favorites.toggle(property.id);
              toast.success(added ? "Добавено в любими" : "Премахнато от любими");
            }}
            aria-label={favorites.has(property.id) ? "Премахни от любими" : "Добави в любими"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#8b1a2b] shadow"
          >
            <Heart className={cn("h-5 w-5", favorites.has(property.id) && "fill-current")} />
          </button>
          <button type="button" onClick={onShare} aria-label="Сподели имота" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#8b1a2b] shadow">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
        {gallery.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Предишна снимка"
              onClick={() => setPhotoIndex((photoIndex - 1 + gallery.length) % gallery.length)}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Следваща снимка"
              onClick={() => setPhotoIndex((photoIndex + 1) % gallery.length)}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1 text-xs text-white">
              {photoIndex + 1}/{gallery.length}
            </span>
          </>
        ) : null}
      </section>

      <div className="space-y-4 p-4">
        <section>
          <p className="flex items-center gap-1 text-xs text-[#8b1a2b]/70">
            <MapPin className="h-3.5 w-3.5" /> {quarterName ? `${quarterName}, ` : ""}{cityName}
          </p>
          <h1 className="mt-2 font-serif-nadezhda text-3xl font-bold leading-tight text-[#640f20]">{property.title}</h1>
          <p className="mt-3 text-3xl font-bold text-[#8b1a2b]">{formatPrice(property.price, property.currency)}</p>
          {property.area_sqm ? (
            <p className="text-xs text-[#3d1119]/60">
              {formatPrice(Math.round(Number(property.price) / Number(property.area_sqm)), property.currency)} / м²
            </p>
          ) : null}
        </section>

        {facts.length ? (
          <dl className="grid grid-cols-3 gap-2">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-2xl border border-[#c59441]/35 bg-white p-3 text-center shadow-sm">
                <fact.icon className="mx-auto h-5 w-5 text-[#8b1a2b]" />
                <dd className="mt-1 text-sm font-bold">{fact.value}</dd>
                <dt className="text-[10px] uppercase text-[#3d1119]/55">{fact.label}</dt>
              </div>
            ))}
          </dl>
        ) : null}

        {property.description ? (
          <section className="rounded-2xl border border-[#c59441]/35 bg-white p-4 shadow-sm">
            <h2 className="font-serif-nadezhda text-2xl font-bold text-[#640f20]">Описание</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#3d1119]/80">{property.description}</p>
          </section>
        ) : null}

        <section className="rounded-2xl bg-[#5b0718] p-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-[#f5d88a] bg-[#3d0711]">
              {broker?.photo_url ? <img src={broker.photo_url} alt={brokerName} className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-[#f5d88a]" />}
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-serif-nadezhda text-xl font-bold text-[#f5d88a]">{brokerName}</h2>
              <p className="text-xs text-white/70">{broker ? "Брокер" : "Старши консултант"}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a href={`tel:${brokerPhoneTel}`} className="flex items-center justify-center gap-2 rounded-xl bg-[#f5d88a] py-3 text-sm font-bold text-[#3d0711]">
              <Phone className="h-4 w-4" /> Позвъни
            </a>
            <a href={`mailto:${brokerEmail}`} className="flex items-center justify-center gap-2 rounded-xl border border-[#f5d88a]/60 py-3 text-sm font-bold">
              <Mail className="h-4 w-4" /> Имейл
            </a>
          </div>
        </section>

        {property.address || cityName ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([property.address, quarterName, cityName, "Bulgaria"].filter(Boolean).join(", "))}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-2xl border border-[#c59441]/35 bg-white p-4 text-sm font-semibold shadow-sm"
          >
            <span className="flex min-w-0 items-center gap-2"><MapPin className="h-5 w-5 shrink-0 text-[#8b1a2b]" /><span className="truncate">{property.address || `${quarterName}, ${cityName}`}</span></span>
            <ChevronRight className="h-5 w-5 shrink-0" />
          </a>
        ) : null}

        <section id="mobile-inquiry" className="scroll-mt-20">
          <PropertyInquiryForm propertyId={property.id} propertyTitle={property.title} compact />
        </section>

        {data.similar?.length ? (
          <section>
            <h2 className="font-serif-nadezhda text-2xl font-bold text-[#640f20]">Подобни имоти</h2>
            <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
              {data.similar.map((similar: any) => (
                <Link key={similar.id} to="/properties/$propertyId" params={{ propertyId: similar.id }} className="w-[72%] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#c59441]/35 bg-white shadow">
                  <div className="aspect-[4/3] bg-[#5b0718]">
                    {similar.cover_image_url ? <img src={similar.cover_image_url} alt={similar.title} loading="lazy" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-[#8b1a2b]">{formatPrice(similar.price, similar.currency)}</p>
                    <p className="mt-1 line-clamp-2 text-sm">{similar.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <nav className="fixed inset-x-0 z-[80] grid grid-cols-2 gap-2 border-t border-[#8b1a2b]/15 bg-[#fffaf4]/96 p-3 shadow-[0_-8px_24px_rgba(61,7,17,0.12)] backdrop-blur md:hidden" style={{ bottom: "calc(74px + env(safe-area-inset-bottom, 0px))" }}>
        <a href={`tel:${brokerPhoneTel}`} className="flex items-center justify-center gap-2 rounded-xl border border-[#8b1a2b] py-3 text-sm font-bold text-[#8b1a2b]">
          <Phone className="h-4 w-4" /> Позвъни
        </a>
        <a href="#mobile-inquiry" className="flex items-center justify-center gap-2 rounded-xl bg-[#8b1a2b] py-3 text-sm font-bold text-white">
          <Mail className="h-4 w-4" /> Запитване
        </a>
      </nav>
    </main>
  );
}
