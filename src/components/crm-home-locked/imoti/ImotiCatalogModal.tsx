import {
  BedDouble,
  ChevronLeft,
  ChevronRight,
  Filter,
  Grid2X2,
  LayoutList,
  MapPin,
  Maximize2,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { CrmModalShell } from "./CrmModalShell";
import { formatImotiPrice } from "./imoti-demo-data";
import {
  applyImotiFilters,
  EMPTY_IMOTI_FILTERS,
  ImotiFilterBar,
  type ImotiFilters,
} from "./ImotiFilterBar";
import { listingStatusLabel, type ImotiDeal, type ImotiProperty } from "./imoti-types";

function PropertyMiniCard({
  property,
  onOpen,
  onToggleFavorite,
}: {
  property: ImotiProperty;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const shortId = property.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || property.id.slice(0, 8);
  const bedrooms = Math.max(1, property.rooms - 1);

  return (
    <div className="crm-imoti-card crm-imoti-card--poster">
      <button type="button" className="crm-imoti-card__hit" onClick={onOpen}>
        <div
          className="crm-imoti-card__media"
          style={{ backgroundImage: `url(${property.coverUrl})` }}
        >
          <span className="crm-imoti-card__id">ID: {shortId}</span>
          <span className="crm-imoti-card__status">
            {listingStatusLabel(property.listingStatus)}
          </span>
          <div className="crm-imoti-card__melt">
            <strong>{property.title}</strong>
            <span className="crm-imoti-card__loc">
              <MapPin size={13} strokeWidth={2.2} /> {property.city}, {property.quarter}
            </span>
            <div className="crm-imoti-card__specs">
              <span>
                <Maximize2 size={13} strokeWidth={2.2} /> {property.areaSqm} кв.м
              </span>
              <span>
                <BedDouble size={13} strokeWidth={2.2} /> {bedrooms} спални
              </span>
            </div>
            <span className="crm-imoti-card__price">{formatImotiPrice(property)}</span>
          </div>
        </div>
      </button>
      <button
        type="button"
        className={`crm-imoti-card__fab${property.favorite ? " is-on" : ""}`}
        aria-label={property.favorite ? "Премахни от любими" : "Добави в любими"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
      >
        <Plus size={11} strokeWidth={2.6} />
        <Star size={12} strokeWidth={2.2} fill={property.favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

function PropertyRow({
  title,
  items,
  onOpen,
  onToggleFavorite,
}: {
  title: string;
  items: ImotiProperty[];
  onOpen: (p: ImotiProperty) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: -1 | 1) => {
    scroller.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section className="crm-imoti-row">
      <div className="crm-imoti-row__head">
        <h3>
          {title} <span className="crm-imoti-row__count">{items.length}</span>
        </h3>
        <button type="button" className="crm-imoti-link">
          Виж всички <ChevronRight size={14} />
        </button>
      </div>
      <div className="crm-imoti-row__track-wrap">
        <button
          type="button"
          className="crm-imoti-row__arrow crm-imoti-row__arrow--left"
          aria-label="Назад"
          onClick={() => scrollBy(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="crm-imoti-row__track" ref={scroller}>
          {items.length ? (
            items.map((p) => (
              <PropertyMiniCard
                key={p.id}
                property={p}
                onOpen={() => onOpen(p)}
                onToggleFavorite={() => onToggleFavorite(p.id)}
              />
            ))
          ) : (
            <p className="crm-imoti-empty">Няма имоти за този филтър.</p>
          )}
        </div>
        <button
          type="button"
          className="crm-imoti-row__arrow crm-imoti-row__arrow--right"
          aria-label="Напред"
          onClick={() => scrollBy(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}

export function ImotiCatalogModal({
  open,
  properties,
  onClose,
  onOpenProperty,
  onAddProperty,
  onToggleFavorite,
  onNavigate: _onNavigate,
}: {
  open: boolean;
  properties: ImotiProperty[];
  onClose: () => void;
  onOpenProperty: (property: ImotiProperty) => void;
  onAddProperty: () => void;
  onToggleFavorite: (id: string) => void;
  onNavigate: (target: "clients" | "calendar") => void;
}) {
  void _onNavigate;
  const [expanded, setExpanded] = useState(false);
  const [dealTab, setDealTab] = useState<ImotiDeal | "all">("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ImotiFilters>(EMPTY_IMOTI_FILTERS);
  const [view, setView] = useState<"grid" | "list">("grid");
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => applyImotiFilters(properties, filters, query, dealTab),
    [properties, filters, query, dealTab],
  );

  const activeCount = filtered.filter((p) => p.listingStatus !== "archive").length;
  const sales = filtered.filter((p) => p.deal === "sale");
  const rents = filtered.filter((p) => p.deal === "rent");

  return (
    <CrmModalShell
      open={open}
      title="Имоти"
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      onClose={onClose}
      zIndex={60}
      headerLeft={<span className="crm-imoti-shell__brand-spacer" aria-hidden />}
      headerCenter={null}
      headerRight={null}
      className="crm-imoti-shell--catalog-merge"
    >
      <div className="crm-imoti-catalog">
        <div className="crm-imoti-catalog__hero">
          <div className="crm-imoti-catalog__hero-photo" aria-hidden />
          <div className="crm-imoti-catalog__hero-veil" aria-hidden />
          <div className="crm-imoti-catalog__intro">
            <div>
              <h2>Имоти</h2>
              <p>Всички имоти в портфолиото · {activeCount} активни</p>
            </div>
            <button
              type="button"
              className="crm-imoti-primary"
              onClick={(e) => {
                e.stopPropagation();
                onAddProperty();
              }}
            >
              <Plus size={16} /> Добави имот
            </button>
          </div>
        </div>

        <div className="crm-imoti-catalog__main">
          <div className="crm-imoti-toolbar">
            <div className="crm-imoti-searchbar">
              <Search size={16} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Търси по локация, тип, цена, ключова дума..."
              />
              <button
                type="button"
                className="crm-imoti-filter-btn"
                onClick={() => setFilters(EMPTY_IMOTI_FILTERS)}
                title="Изчисти филтри"
              >
                <Filter size={14} /> Филтри
              </button>
            </div>

            <div className="crm-imoti-chips-row">
              <ImotiFilterBar properties={properties} filters={filters} onChange={setFilters} />
              <div className="crm-imoti-deal-tabs">
                <button
                  type="button"
                  className={dealTab === "all" ? "is-active" : undefined}
                  onClick={() => setDealTab("all")}
                >
                  Всички
                </button>
                <button
                  type="button"
                  className={dealTab === "sale" ? "is-active" : undefined}
                  onClick={() => setDealTab("sale")}
                >
                  Продажби
                </button>
                <button
                  type="button"
                  className={dealTab === "rent" ? "is-active" : undefined}
                  onClick={() => setDealTab("rent")}
                >
                  Наеми
                </button>
              </div>
              <span className="crm-imoti-view-toggle">
                <button
                  type="button"
                  className={`crm-imoti-icon-btn${view === "grid" ? " crm-imoti-icon-btn--on" : ""}`}
                  aria-label="Мрежа"
                  onClick={() => setView("grid")}
                >
                  <Grid2X2 size={14} />
                </button>
                <button
                  type="button"
                  className={`crm-imoti-icon-btn${view === "list" ? " crm-imoti-icon-btn--on" : ""}`}
                  aria-label="Списък"
                  onClick={() => setView("list")}
                >
                  <LayoutList size={14} />
                </button>
              </span>
            </div>
          </div>

          <div className={view === "list" ? "crm-imoti-catalog--list" : undefined}>
            {(dealTab === "all" || dealTab === "sale") && (
              <PropertyRow
                title="Продажби"
                items={sales}
                onOpen={onOpenProperty}
                onToggleFavorite={onToggleFavorite}
              />
            )}
            {(dealTab === "all" || dealTab === "rent") && (
              <PropertyRow
                title="Наеми"
                items={rents}
                onOpen={onOpenProperty}
                onToggleFavorite={onToggleFavorite}
              />
            )}
          </div>
        </div>
      </div>
    </CrmModalShell>
  );
}
