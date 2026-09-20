import { useState, type ReactElement } from "react";
import { useNavigate } from "@tanstack/react-router";

import "./shumen-imposed-page.css";
import { BrushShape, BRUSH_SHAPE_URL } from "@/components/site/brush-shape";
import { BrushSearchBar } from "@/components/site/brush-search-bar";
import image3 from "@/assets/shumen-page/image-3.png.asset.json";
import image6 from "@/assets/shumen-page/image-6.png.asset.json";
import image10 from "@/assets/shumen-page/image-10.png.asset.json";
import image11 from "@/assets/shumen-page/image-11.png.asset.json";
import image12 from "@/assets/shumen-page/image-12.png.asset.json";
import image13 from "@/assets/shumen-page/image-13.png.asset.json";
import image14 from "@/assets/shumen-page/image-14.png.asset.json";
import image15 from "@/assets/shumen-page/image-15.png.asset.json";
import shumen2026Mp4 from "@/assets/shumen-2026.mp4.asset.json";
import shumen2026Webm from "@/assets/shumen-2026.webm.asset.json";
import varnaMp4 from "@/assets/varna-2026.mp4.asset.json";
import varnaWebm from "@/assets/varna-2026.webm.asset.json";
import burgasMp4 from "@/assets/burgas-hero-2026.mp4.asset.json";
import burgasWebm from "@/assets/burgas-hero-2026.webm.asset.json";
import varnaPhoto from "@/assets/city-photos/varna.jpeg.asset.json";
import burgasPhoto from "@/assets/city-photos/burgas.jpeg.asset.json";

const ASSETS = {
  logo: image6.url,
  chatBg: image3.url,
  center: image10.url,
  trakia: image11.url,
  boyan1: image12.url,
  boyan2: image13.url,
  hospital: image14.url,
  heroPanel: image15.url,
};

type IconName =
  | "tag"
  | "key"
  | "users"
  | "user"
  | "pin"
  | "home"
  | "wallet"
  | "square"
  | "sliders"
  | "building"
  | "message"
  | "search"
  | "chevron"
  | "close"
  | "send"
  | "layers"
  | "ruler";

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactElement> = {
    tag: (
      <>
        <path d="M20 13 12.5 20.5a2.1 2.1 0 0 1-3 0l-6-6a2.1 2.1 0 0 1 0-3L11 4h7v7Z" />
        <circle cx="15" cy="8" r="1.3" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 8-8m-3 3 2 2m-5 1 2 2M7.5 11.2l-3-3" />
      </>
    ),
    users: (
      <>
        <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    pin: (
      <>
        <path d="M20 10c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.6" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v11h14V10M9 21v-7h6v7" />
      </>
    ),
    wallet: (
      <>
        <path d="M4 6h15a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" />
        <path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z" />
        <path d="M6 8h5" />
      </>
    ),
    square: <rect x="3" y="3" width="18" height="18" rx="1" />,
    sliders: (
      <>
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
        <path d="M1 14h6M9 8h6M17 16h6" />
      </>
    ),
    building: <path d="M4 22V5h10v17M14 9h6v13M7 8h4M7 12h4M7 16h4M17 12h1M17 16h1M2 22h20" />,
    message: <path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1-5a9 9 0 1 1 18-5Z" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    chevron: <path d="m7 9 5 5 5-5" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </>
    ),
    ruler: (
      <>
        <path d="M15.5 2.5 21.5 8.5a1.5 1.5 0 0 1 0 2.1L10.6 21.5a1.5 1.5 0 0 1-2.1 0L2.5 15.5a1.5 1.5 0 0 1 0-2.1L13.4 2.5a1.5 1.5 0 0 1 2.1 0Z" />
        <path d="m7 11 2 2m2-4 2 2m2-4 2 2" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

type Neighborhood = {
  key: string;
  slug: string;
  name: string;
  count: number;
  /** Ready-made brush card PNG (Shumen). */
  cardImage?: string;
  /** Photo used when the card is rendered in React (Varna / Burgas). */
  photo?: string;
};

export type CityImposedConfig = {
  citySlug: string;
  cityLabel: string;
  heroVideoMp4: string;
  heroVideoWebm?: string;
  cityOptions: string[];
  neighborhoods: Neighborhood[];
  /** Baked brush panel PNG (Shumen only). Without it the panel is rendered in React. */
  heroPanelImage?: string;
  heroCopy?: string;
  stats?: { population: string; area: string; region: string; active: string };
};

const SHUMEN_NEIGHBORHOODS: Neighborhood[] = [
  { key: "center", slug: "centar", name: "ЦЕНТЪР", count: 12, cardImage: ASSETS.center },
  { key: "trakia", slug: "trakia", name: "ТРАКИЯ", count: 18, cardImage: ASSETS.trakia },
  {
    key: "boyan1",
    slug: "boyan-balgaranov-1",
    name: "БОЯН БЪЛГАРАНОВ 1",
    count: 10,
    cardImage: ASSETS.boyan1,
  },
  {
    key: "boyan2",
    slug: "boyan-balgaranov-2",
    name: "БОЯН БЪЛГАРАНОВ 2",
    count: 8,
    cardImage: ASSETS.boyan2,
  },
  { key: "hospital", slug: "bolnica", name: "БОЛНИЦА", count: 6, cardImage: ASSETS.hospital },
];

export const SHUMEN_CONFIG: CityImposedConfig = {
  citySlug: "shumen",
  cityLabel: "Шумен",
  heroVideoMp4: shumen2026Mp4.url,
  heroVideoWebm: shumen2026Webm.url,
  cityOptions: ["Шумен", "Варна", "Бургас", "Търговище"],
  neighborhoods: SHUMEN_NEIGHBORHOODS,
};

type DropdownConfig = {
  id: "city" | "quarter" | "type" | "price" | "area";
  icon: IconName;
  label: string;
  options: string[];
};

/** Етикет на град → slug за /search */
const CITY_SLUG_BY_LABEL: Record<string, string> = {
  Шумен: "shumen",
  Варна: "varna",
  Бургас: "burgas",
  Търговище: "targovishte",
  "Нови пазар": "novi-pazar",
};

const PROPERTY_TYPE_BY_LABEL: Record<string, string> = {
  Апартамент: "apartment",
  Къща: "house",
};

const PRICE_RANGES: Record<string, { min?: string; max?: string }> = {
  "до 100 000": { max: "100000" },
  "100 000 - 200 000": { min: "100000", max: "200000" },
  "200 000 - 500 000": { min: "200000", max: "500000" },
  "над 500 000": { min: "500000" },
};

const AREA_RANGES: Record<string, { min?: string; max?: string }> = {
  "до 60 m²": { max: "60" },
  "60 - 100 m²": { min: "60", max: "100" },
  "100 - 200 m²": { min: "100", max: "200" },
  "над 200 m²": { min: "200" },
};

function Dropdown({
  id,
  icon,
  label,
  value,
  options,
  open,
  onToggle,
  onChoose,
}: DropdownConfig & {
  value: string;
  open: boolean;
  onToggle: (id: DropdownConfig["id"]) => void;
  onChoose: (id: DropdownConfig["id"], value: string) => void;
}) {
  return (
    <div className={`search-control ${open ? "open" : ""}`}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle(id);
        }}
        className="absolute inset-0 z-10"
        aria-expanded={open}
        aria-label={label}
      />
      <Icon name={icon} />
      <div className="min-w-0">
        <div className="filter-label">{label}</div>
        <div className="filter-value">{value}</div>
      </div>
      <Icon name="chevron" className="chevron" />
      {open ? (
        <div className="dropdown-menu">
          {options.map((option) => (
            <button
              type="button"
              key={option}
              className={`dropdown-option ${option === value ? "selected" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onChoose(id, option);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CityImposedPage({ config }: { config: CityImposedConfig }) {
  const navigate = useNavigate();
  const [openDropdown, setOpenDropdown] = useState<DropdownConfig["id"] | null>(null);
  const [filters, setFilters] = useState({
    city: config.cityLabel,
    quarter: "Всички",
    type: "Всички",
    price: "Без значение",
    area: "Без значение",
  });

  const [modal, setModal] = useState<Neighborhood | null>(null);
  const [neighborhoodPage, setNeighborhoodPage] = useState(0);
  const neighborhoodsPerPage = 5;
  const neighborhoodPages = Math.ceil(config.neighborhoods.length / neighborhoodsPerPage);
  const visibleNeighborhoods = config.neighborhoods.slice(
    neighborhoodPage * neighborhoodsPerPage,
    (neighborhoodPage + 1) * neighborhoodsPerPage,
  );

  const dropdowns: DropdownConfig[] = [
    { id: "city", icon: "pin", label: "Град", options: config.cityOptions },
    {
      id: "quarter",
      icon: "home",
      label: "Квартал",
      options: ["Всички", ...config.neighborhoods.map((n) => n.name)],
    },
    { id: "type", icon: "building", label: "Вид имот", options: ["Всички", "Апартамент", "Къща"] },
    {
      id: "price",
      icon: "layers",
      label: "Цена",
      options: [
        "Без значение",
        "до 100 000",
        "100 000 - 200 000",
        "200 000 - 500 000",
        "над 500 000",
      ],
    },
    {
      id: "area",
      icon: "ruler",
      label: "Площ",
      options: ["Без значение", "до 60 m²", "60 - 100 m²", "100 - 200 m²", "над 200 m²"],
    },
  ];

  const choose = (id: DropdownConfig["id"], value: string) => {
    setFilters((prev) => ({ ...prev, [id]: value }));
    setOpenDropdown(null);
  };

  const runSearch = () => {
    const search: Record<string, string> = {
      city_slug: CITY_SLUG_BY_LABEL[filters.city] ?? config.citySlug,
    };
    if (filters.quarter !== "Всички") {
      const quarter = config.neighborhoods.find((n) => n.name === filters.quarter);
      if (quarter) search.quarter_slug = quarter.slug;
    }
    if (filters.type !== "Всички")
      search.property_type = PROPERTY_TYPE_BY_LABEL[filters.type] ?? filters.type;
    const price = PRICE_RANGES[filters.price];
    if (price?.min) search.price_min = price.min;
    if (price?.max) search.price_max = price.max;
    const area = AREA_RANGES[filters.area];
    if (area?.min) search.area_min = area.min;
    if (area?.max) search.area_max = area.max;
    navigate({ to: "/search", search });
  };

  return (
    <div
      className={`shumen-imposed quick-hero${config.heroPanelImage ? "" : " react-panel"}`}
      style={{ ["--brush-shape" as string]: `url(${BRUSH_SHAPE_URL})` } as React.CSSProperties}
    >
      <main className="app-root" onClick={() => setOpenDropdown(null)}>
        <div className="lower-landscape" />
        <section className="hero">
          <div className="hero-photo">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              controls={false}
              tabIndex={-1}
              aria-label={`Видео от ${config.cityLabel}`}
              ref={(el) => {
                // iOS/Safari понякога игнорират autoplay атрибута — форсираме play()
                if (el && el.paused) el.play().catch(() => {});
              }}
            >
              {config.heroVideoWebm ? (
                <source src={config.heroVideoWebm} type="video/webm" />
              ) : null}
              <source src={config.heroVideoMp4} type="video/mp4" />
            </video>
          </div>

          {/* Лого върху бордо мазка — горе централно */}
          <button type="button" className="logo-brush" onClick={() => navigate({ to: "/" })}>
            <BrushShape
              aria-hidden="true"
              tone="burgundy"
              variant="badge"
              stretch
              className="hero-logo-badge"
            />
            <img src={ASSETS.logo} className="logo-image-src" alt="Имоти Надежда" />
          </button>

          {/* Кръгъл бутон за профил — горе вдясно */}
          <button
            type="button"
            className="hero-account"
            aria-label="Профил"
            onClick={(event) => {
              event.stopPropagation();
              navigate({ to: "/login" });
            }}
          >
            <Icon name="user" />
          </button>

          <h1 className="sr-only-title">Имоти в {config.cityLabel}</h1>

          {/* БЪРЗО ТЪРСЕНЕ — четката 1:1 с интерактивни филтри върху нея */}
          <div className="brush-search-slot">
            <BrushSearchBar defaultCitySlug={config.citySlug} defaultCityLabel={config.cityLabel} />
          </div>
        </section>

        <section className="neighborhood-section">
          <h2 className="section-title">
            Избери <span>квартал</span> в гр. {config.cityLabel}
          </h2>

          <div className="cards-wrap">
            <button
              type="button"
              className="neighborhood-pager prev"
              aria-label="Предишни квартали"
              disabled={neighborhoodPage === 0}
              onClick={() => setNeighborhoodPage((page) => Math.max(0, page - 1))}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div className="cards-row">
              {visibleNeighborhoods.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="neighborhood-card"
                  onClick={() => setModal(item)}
                >
                  {item.cardImage ? (
                    <img className="card-photo" src={item.cardImage} alt={item.name} />
                  ) : (
                    <span className="card-react" aria-hidden="true">
                      <span
                        className="card-react-photo"
                        style={{ backgroundImage: `url(${item.photo ?? ""})` }}
                      />
                      <span className="card-react-brush">
                        <span className="card-react-name">{item.name}</span>
                        <span className="card-react-count">
                          <Icon name="pin" /> {item.count} ИМОТА
                        </span>
                        <span className="card-react-cta">Разгледай →</span>
                      </span>
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="neighborhood-pager next"
              aria-label="Следващи квартали"
              disabled={neighborhoodPage === neighborhoodPages - 1}
              onClick={() =>
                setNeighborhoodPage((page) => Math.min(neighborhoodPages - 1, page + 1))
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </section>

        {modal ? (
          <div className="modal-backdrop" onClick={() => setModal(null)}>
            <article className="modal-card" onClick={(event) => event.stopPropagation()}>
              <div className="modal-content">
                <h2 className="text-3xl font-bold mb-4">{modal.name}</h2>
                <p>Разгледайте всички активни предложения в този квартал.</p>
                <button
                  className="mt-6 bg-red-900 text-white px-6 py-2 rounded"
                  onClick={() =>
                    navigate({
                      to: "/cities/$slug/districts/$district",
                      params: { slug: config.citySlug, district: modal.slug },
                    })
                  }
                >
                  Разгледай
                </button>
                <button
                  className="mt-6 ml-3 px-6 py-2 rounded border"
                  onClick={() => setModal(null)}
                >
                  Затвори
                </button>
              </div>
            </article>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export function ShumenImposedPage() {
  return <CityImposedPage config={SHUMEN_CONFIG} />;
}

export const VARNA_CONFIG: CityImposedConfig = {
  citySlug: "varna",
  cityLabel: "Варна",
  heroVideoMp4: varnaMp4.url,
  heroVideoWebm: varnaWebm.url,
  cityOptions: ["Варна", "Шумен", "Бургас", "Търговище"],
  heroCopy:
    "Агенция Имоти Надежда предлага апартаменти, къщи, парцели и офиси за продажба и под наем във Варна. Морската столица на България — най-големият град на Черноморието, водещ туристически, пристанищен и икономически център с динамичен пазар на имоти.",
  stats: { population: "≈ 335 000", area: "238 km²", region: "Североизточен", active: "83" },
  neighborhoods: [
    { key: "centar", slug: "centar", name: "ЦЕНТЪР", count: 24, photo: varnaPhoto.url },
    { key: "chayka", slug: "chayka", name: "ЧАЙКА", count: 16, photo: varnaPhoto.url },
    { key: "levski", slug: "levski", name: "ЛЕВСКИ", count: 14, photo: varnaPhoto.url },
    {
      key: "vl-varnenchik",
      slug: "vladislav-varnenchik",
      name: "ВЛ. ВАРНЕНЧИК",
      count: 18,
      photo: varnaPhoto.url,
    },
    { key: "asparuhovo", slug: "asparuhovo", name: "АСПАРУХОВО", count: 11, photo: varnaPhoto.url },
  ],
};

export const BURGAS_CONFIG: CityImposedConfig = {
  citySlug: "burgas",
  cityLabel: "Бургас",
  heroVideoMp4: burgasMp4.url,
  heroVideoWebm: burgasWebm.url,
  cityOptions: ["Бургас", "Варна", "Шумен", "Търговище"],
  heroCopy:
    "Агенция Имоти Надежда предлага апартаменти, къщи, парцели и офиси за продажба и под наем в Бургас. Водещият черноморски град в Югоизточна България с разширена Морска градина, модернизирано пристанище и активно строителство в Меден рудник, Славейков и Сарафово.",
  stats: { population: "≈ 200 000", area: "482 km²", region: "Югоизточен", active: "76" },
  neighborhoods: [
    { key: "centar", slug: "centar", name: "ЦЕНТЪР", count: 21, photo: burgasPhoto.url },
    {
      key: "meden-rudnik",
      slug: "meden-rudnik",
      name: "МЕДЕН РУДНИК",
      count: 19,
      photo: burgasPhoto.url,
    },
    { key: "slaveykov", slug: "slaveykov", name: "СЛАВЕЙКОВ", count: 15, photo: burgasPhoto.url },
    { key: "zornitsa", slug: "zornitsa", name: "ЗОРНИЦА", count: 12, photo: burgasPhoto.url },
    { key: "sarafovo", slug: "sarafovo", name: "САРАФОВО", count: 9, photo: burgasPhoto.url },
  ],
};

export function VarnaImposedPage() {
  return <CityImposedPage config={VARNA_CONFIG} />;
}

export function BurgasImposedPage() {
  return <CityImposedPage config={BURGAS_CONFIG} />;
}
