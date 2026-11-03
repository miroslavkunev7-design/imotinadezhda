import { ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { IMOTI_FILTER_CITIES, quartersForImotiCity } from "./imoti-city-quarters";
import type { ImotiProperty, ImotiSortKey } from "./imoti-types";

export type ImotiFilters = {
  city: string;
  quarter: string;
  typeLabel: string;
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
  sort: ImotiSortKey;
};

export const EMPTY_IMOTI_FILTERS: ImotiFilters = {
  city: "",
  quarter: "",
  typeLabel: "",
  priceMin: "",
  priceMax: "",
  areaMin: "",
  areaMax: "",
  sort: "newest",
};

type MenuPos = { top: number; left: number; minWidth: number };

function useMenuPos(open: boolean, anchorRef: RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<MenuPos | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.bottom + 6, left: r.left, minWidth: Math.max(r.width, 160) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  return pos;
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = useMenuPos(open, btnRef);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const display = value || "всички";

  return (
    <div className={`crm-imoti-dd${open ? " is-open" : ""}`}>
      <button
        ref={btnRef}
        type="button"
        className={`crm-imoti-chip${value ? " is-active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        {label}: {display} <ChevronDown size={12} />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className="crm-imoti-dd__menu"
              role="listbox"
              style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: pos.minWidth, zIndex: 200 }}
            >
              <button
                type="button"
                role="option"
                className={!value ? "is-on" : undefined}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                всички
              </button>
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  className={value === opt ? "is-on" : undefined}
                  onClick={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>,
            document.querySelector(".crm-locked-root") ?? document.body,
          )
        : null}
    </div>
  );
}

function RangeDropdown({
  label,
  min,
  max,
  unit,
  onMin,
  onMax,
}: {
  label: string;
  min: string;
  max: string;
  unit: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = useMenuPos(open, btnRef);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const summary =
    min || max ? `${min || "…"} – ${max || "…"} ${unit}` : `от/до ${unit}`;

  return (
    <div className={`crm-imoti-dd${open ? " is-open" : ""}`}>
      <button
        ref={btnRef}
        type="button"
        className={`crm-imoti-chip${min || max ? " is-active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        {label}: {summary} <ChevronDown size={12} />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className="crm-imoti-dd__menu crm-imoti-dd__menu--range"
              style={{ position: "fixed", top: pos.top, left: pos.left, minWidth: Math.max(pos.minWidth, 200), zIndex: 200 }}
            >
              <label>
                От
                <input
                  type="number"
                  inputMode="numeric"
                  value={min}
                  onChange={(e) => onMin(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label>
                До
                <input
                  type="number"
                  inputMode="numeric"
                  value={max}
                  onChange={(e) => onMax(e.target.value)}
                  placeholder="∞"
                />
              </label>
            </div>,
            document.querySelector(".crm-locked-root") ?? document.body,
          )
        : null}
    </div>
  );
}

const SORT_LABELS: Record<ImotiSortKey, string> = {
  newest: "Най-нови първо",
  "price-asc": "Цена ↑",
  "price-desc": "Цена ↓",
  "area-desc": "Площ ↓",
};

export function ImotiFilterBar({
  properties,
  filters,
  onChange,
}: {
  properties: ImotiProperty[];
  filters: ImotiFilters;
  onChange: (next: ImotiFilters) => void;
}) {
  const cities = useMemo(() => [...IMOTI_FILTER_CITIES], []);
  const quarters = useMemo(() => quartersForImotiCity(filters.city), [filters.city]);
  const types = useMemo(
    () => [...new Set(properties.map((p) => p.typeLabel))].sort(),
    [properties],
  );

  const [sortOpen, setSortOpen] = useState(false);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortPos = useMenuPos(sortOpen, sortBtnRef);

  useEffect(() => {
    if (!sortOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (sortBtnRef.current?.contains(t) || sortMenuRef.current?.contains(t)) return;
      setSortOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [sortOpen]);

  return (
    <div className="crm-imoti-chips">
      <FilterDropdown
        label="Град"
        value={filters.city}
        options={cities}
        onChange={(city) => onChange({ ...filters, city, quarter: "" })}
      />
      <FilterDropdown
        label="Квартал"
        value={filters.quarter}
        options={quarters}
        onChange={(quarter) => onChange({ ...filters, quarter })}
      />
      <FilterDropdown
        label="Тип имот"
        value={filters.typeLabel}
        options={types}
        onChange={(typeLabel) => onChange({ ...filters, typeLabel })}
      />
      <RangeDropdown
        label="Цена"
        min={filters.priceMin}
        max={filters.priceMax}
        unit="€"
        onMin={(priceMin) => onChange({ ...filters, priceMin })}
        onMax={(priceMax) => onChange({ ...filters, priceMax })}
      />
      <RangeDropdown
        label="Площ"
        min={filters.areaMin}
        max={filters.areaMax}
        unit="m²"
        onMin={(areaMin) => onChange({ ...filters, areaMin })}
        onMax={(areaMax) => onChange({ ...filters, areaMax })}
      />
      <div className={`crm-imoti-dd${sortOpen ? " is-open" : ""}`}>
        <button
          ref={sortBtnRef}
          type="button"
          className="crm-imoti-chip is-active"
          onClick={(e) => {
            e.stopPropagation();
            setSortOpen((v) => !v);
          }}
        >
          <SlidersHorizontal size={12} /> {SORT_LABELS[filters.sort]}{" "}
          <ChevronDown size={12} />
        </button>
        {sortOpen && sortPos
          ? createPortal(
              <div
                ref={sortMenuRef}
                className="crm-imoti-dd__menu"
                role="listbox"
                style={{
                  position: "fixed",
                  top: sortPos.top,
                  left: sortPos.left,
                  minWidth: sortPos.minWidth,
                  zIndex: 200,
                }}
              >
                {(Object.keys(SORT_LABELS) as ImotiSortKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    className={filters.sort === key ? "is-on" : undefined}
                    onClick={() => {
                      onChange({ ...filters, sort: key });
                      setSortOpen(false);
                    }}
                  >
                    {SORT_LABELS[key]}
                  </button>
                ))}
              </div>,
              document.querySelector(".crm-locked-root") ?? document.body,
            )
          : null}
      </div>
    </div>
  );
}

export function applyImotiFilters(
  properties: ImotiProperty[],
  filters: ImotiFilters,
  query: string,
  dealTab: "all" | "sale" | "rent",
): ImotiProperty[] {
  const q = query.trim().toLowerCase();
  const priceMin = filters.priceMin ? Number(filters.priceMin) : null;
  const priceMax = filters.priceMax ? Number(filters.priceMax) : null;
  const areaMin = filters.areaMin ? Number(filters.areaMin) : null;
  const areaMax = filters.areaMax ? Number(filters.areaMax) : null;

  const list = properties.filter((p) => {
    if (dealTab !== "all" && p.deal !== dealTab) return false;
    if (filters.city && p.city !== filters.city) return false;
    if (filters.quarter && p.quarter !== filters.quarter) return false;
    if (filters.typeLabel && p.typeLabel !== filters.typeLabel) return false;
    if (priceMin !== null && !Number.isNaN(priceMin) && p.price < priceMin) return false;
    if (priceMax !== null && !Number.isNaN(priceMax) && p.price > priceMax) return false;
    if (areaMin !== null && !Number.isNaN(areaMin) && p.areaSqm < areaMin) return false;
    if (areaMax !== null && !Number.isNaN(areaMax) && p.areaSqm > areaMax) return false;
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.quarter.toLowerCase().includes(q) ||
      p.typeLabel.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  });

  list.sort((a, b) => {
    switch (filters.sort) {
      case "newest":
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "area-desc":
        return b.areaSqm - a.areaSqm;
      default: {
        const _exhaustive: never = filters.sort;
        return _exhaustive;
      }
    }
  });

  return list;
}
