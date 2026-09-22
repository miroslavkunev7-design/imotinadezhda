import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Home,
  MapPin,
  Search,
  SlidersHorizontal,
  Square,
  WalletCards,
} from "lucide-react";

import brushAsset from "@/assets/brush-search-bar.png.asset.json";
import { getCities } from "@/lib/catalog.functions";
import { ANY, buildSearchQuery, type SearchFilters } from "@/lib/search-query";

/** Оригиналните пропорции на изображението — не се променят. */
const BRUSH_ASPECT = "1634 / 898";

type Option = { label: string; value: string };

const TYPE_OPTIONS: Option[] = [
  { label: "Всички", value: ANY },
  { label: "Апартамент", value: "apartment" },
  { label: "Къща", value: "house" },
  { label: "Офис", value: "office" },
  { label: "Земя", value: "land" },
  { label: "Търговски", value: "commercial" },
];

const PRICE_OPTIONS: Option[] = [
  { label: "Без значение", value: ANY },
  { label: "до 100 000", value: "0-100000" },
  { label: "100 000 – 200 000", value: "100000-200000" },
  { label: "200 000 – 500 000", value: "200000-500000" },
  { label: "над 500 000", value: "500000-" },
];

const AREA_OPTIONS: Option[] = [
  { label: "Без значение", value: ANY },
  { label: "до 60 m²", value: "0-60" },
  { label: "60 – 100 m²", value: "60-100" },
  { label: "100 – 200 m²", value: "100-200" },
  { label: "над 200 m²", value: "200-" },
];

const STATUS_OPTIONS: Option[] = [
  { label: "Всички", value: ANY },
  { label: "Продажба", value: "sale" },
  { label: "Наем", value: "rent" },
];

type FilterSelectProps = {
  id: string;
  label: string;
  icon: React.ReactNode;
  options: Option[];
  value: string;
  open: boolean;
  onToggle: (id: string) => void;
  onChange: (value: string) => void;
};

/** Интерактивен филтър — самостоятелен React компонент със собствено меню. */
function FilterSelect({
  id,
  label,
  icon,
  options,
  value,
  open,
  onToggle,
  onChange,
}: FilterSelectProps) {
  const current = options.find((option) => option.value === value) ?? options[0];
  return (
    <div className="relative flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-white/90">{icon}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onToggle(id);
        }}
        className="flex min-w-0 flex-col items-start text-left leading-tight"
      >
        <span className="text-[9px] uppercase tracking-[0.04em] text-white/70 sm:text-[10px] md:text-xs">
          {label}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-white sm:text-sm md:text-base">
          <span className="truncate">{current?.label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-white/80 md:h-4 md:w-4" />
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-44 overflow-y-auto bg-[#5c0f1d] p-1 text-white shadow-2xl ring-1 ring-[#C9A84C]/50 md:w-52"
        >
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(option.value);
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#7a1226] ${
                  option.value === value ? "bg-[#7a1226] text-[#F6D98A]" : ""
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function BrushSearchBar({
  className = "",
  defaultCitySlug,
  defaultCityLabel,
}: {
  className?: string;
  defaultCitySlug?: string;
  defaultCityLabel?: string;
}) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const { data: cities } = useQuery({
    queryKey: ["brush-search-cities"],
    queryFn: () => getCities(),
    staleTime: 5 * 60 * 1000,
  });

  const cityOptions: Option[] = [
    { label: "Всички градове", value: ANY },
    ...(defaultCitySlug && !(cities ?? []).some((city: any) => city.slug === defaultCitySlug)
      ? [{ label: defaultCityLabel ?? defaultCitySlug, value: defaultCitySlug }]
      : []),
    ...(cities ?? []).map((city: any) => ({
      label: city.name as string,
      value: city.slug as string,
    })),
  ];

  const [filters, setFilters] = useState<SearchFilters>({
    city: defaultCitySlug ?? ANY,
    type: ANY,
    price: ANY,
    area: ANY,
    status: ANY,
  });

  useEffect(() => {
    const onDocDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpenId(null);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const set = (key: keyof typeof filters) => (value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setOpenId(null);
  };

  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  const runSearch = () => {
    navigate({ to: "/search", search: buildSearchQuery(filters) as never });
  };
  return (
    <div
      ref={rootRef}
      className={`relative w-full ${className}`}
      style={{ aspectRatio: BRUSH_ASPECT }}
      onClick={(event) => event.stopPropagation()}
    >
      {/* Изображението на четката 1:1 — без SVG, без clip-path, без border-radius */}
      <img
        src={brushAsset.url}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
        draggable={false}
      />

      {/* Overlay с интерактивните филтри — точно върху долната лента на четката */}
      <div className="absolute inset-x-[7%] bottom-[8%] top-auto flex h-[13%] items-center justify-between gap-2 md:gap-4">
        <FilterSelect
          id="city"
          label="Град"
          icon={<MapPin className="h-4 w-4 md:h-5 md:w-5" />}
          options={cityOptions}
          value={filters.city}
          open={openId === "city"}
          onToggle={toggle}
          onChange={set("city")}
        />
        <FilterSelect
          id="type"
          label="Вид имот"
          icon={<Home className="h-4 w-4 md:h-5 md:w-5" />}
          options={TYPE_OPTIONS}
          value={filters.type}
          open={openId === "type"}
          onToggle={toggle}
          onChange={set("type")}
        />
        <FilterSelect
          id="price"
          label="Цена"
          icon={<WalletCards className="h-4 w-4 md:h-5 md:w-5" />}
          options={PRICE_OPTIONS}
          value={filters.price}
          open={openId === "price"}
          onToggle={toggle}
          onChange={set("price")}
        />
        <FilterSelect
          id="area"
          label="Площ"
          icon={<Square className="h-4 w-4 md:h-5 md:w-5" />}
          options={AREA_OPTIONS}
          value={filters.area}
          open={openId === "area"}
          onToggle={toggle}
          onChange={set("area")}
        />

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpenId(null);
            setShowMore((value) => !value);
          }}
          aria-expanded={showMore}
          className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-white sm:text-sm md:text-base"
        >
          <SlidersHorizontal className="h-4 w-4 md:h-5 md:w-5" />
          <span className="hidden sm:inline">Филтри</span>
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            runSearch();
          }}
          className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-white sm:text-sm md:text-base"
        >
          <Search className="h-4 w-4 md:h-5 md:w-5" />
          <span>Търси</span>
        </button>
      </div>

      {/* Допълнителни филтри — извън четката, за да не се променя визията */}
      {showMore ? (
        <div className="absolute -bottom-14 left-[7%] z-20 flex items-center gap-3 bg-[#5c0f1d]/95 px-4 py-2 text-white ring-1 ring-[#C9A84C]/50">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/70">Сделка</span>
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, status: option.value }))}
              className={`px-2 py-1 text-sm ${
                filters.status === option.value ? "bg-[#7a1226] text-[#F6D98A]" : "text-white/85"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default BrushSearchBar;
