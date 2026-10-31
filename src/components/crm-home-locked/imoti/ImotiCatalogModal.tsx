import {
  ArrowRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  Filter,
  Grid2X2,
  Heart,
  LayoutList,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { CrmModalShell } from "./CrmModalShell";
import { formatImotiPrice, IMOTI_DEMO } from "./imoti-demo-data";
import type { ImotiDeal, ImotiProperty } from "./imoti-types";

function PropertyMiniCard({
  property,
  onOpen,
}: {
  property: ImotiProperty;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="crm-imoti-card" onClick={onOpen}>
      <div className="crm-imoti-card__media">
        <img src={property.coverUrl} alt="" />
        <span className="crm-imoti-card__badge">{property.typeLabel}</span>
        <span className="crm-imoti-card__fav" aria-hidden>
          <Heart size={14} />
        </span>
      </div>
      <div className="crm-imoti-card__body">
        <strong>{property.title}</strong>
        <span className="crm-imoti-card__loc">
          <MapPin size={12} /> {property.city}, {property.quarter}
        </span>
        <span className="crm-imoti-card__price">{formatImotiPrice(property)}</span>
        <div className="crm-imoti-card__meta">
          <span>{property.areaSqm} m²</span>
          <span>{property.rooms} стаи</span>
          <span>Етаж {property.floor}</span>
        </div>
        <span className="crm-imoti-card__go" aria-hidden>
          <ArrowRight size={14} />
        </span>
      </div>
    </button>
  );
}

function PropertyRow({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: ImotiProperty[];
  onOpen: (p: ImotiProperty) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: -1 | 1) => {
    scroller.current?.scrollBy({ left: dir * 280, behavior: "smooth" });
  };

  return (
    <section className="crm-imoti-row">
      <div className="crm-imoti-row__head">
        <h3>{title}</h3>
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
          {items.map((p) => (
            <PropertyMiniCard key={p.id} property={p} onOpen={() => onOpen(p)} />
          ))}
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
  onClose,
  onOpenProperty,
}: {
  open: boolean;
  onClose: () => void;
  onOpenProperty: (property: ImotiProperty) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dealTab, setDealTab] = useState<ImotiDeal | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return IMOTI_DEMO.filter((p) => {
      if (dealTab !== "all" && p.deal !== dealTab) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.quarter.toLowerCase().includes(q) ||
        p.typeLabel.toLowerCase().includes(q)
      );
    });
  }, [dealTab, query]);

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
      headerCenter={
        <nav className="crm-imoti-topnav" aria-label="Имоти навигация">
          <button type="button" className="crm-imoti-topnav__item crm-imoti-topnav__item--active">
            Имоти
          </button>
          <button type="button" className="crm-imoti-topnav__item">
            Клиенти
          </button>
          <button type="button" className="crm-imoti-topnav__item">
            Календар
          </button>
        </nav>
      }
      headerRight={
        <>
          <button type="button" className="crm-imoti-icon-btn" aria-label="Търсене">
            <Search size={15} />
          </button>
          <button type="button" className="crm-imoti-icon-btn crm-imoti-icon-btn--dot" aria-label="Известия">
            <Bell size={15} />
          </button>
          <img
            src="/crm-home-locked/avatar-miroslav.jpg"
            alt=""
            className="crm-imoti-avatar"
          />
        </>
      }
    >
      <div className="crm-imoti-catalog">
        <div className="crm-imoti-catalog__intro">
          <div>
            <h2>Имоти</h2>
            <p>Всички имоти в портфолиото · {filtered.length} активни</p>
          </div>
          <button type="button" className="crm-imoti-primary">
            <Plus size={16} /> Добави имот
          </button>
        </div>

        <div className="crm-imoti-searchbar">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Търси по локация, тип, цена, ключова дума..."
          />
          <button type="button" className="crm-imoti-filter-btn">
            <Filter size={14} /> Филтри
          </button>
        </div>

        <div className="crm-imoti-chips">
          <button type="button" className="crm-imoti-chip">Град: всички</button>
          <button type="button" className="crm-imoti-chip">Квартал: всички</button>
          <button type="button" className="crm-imoti-chip">Тип имот: всички</button>
          <button type="button" className="crm-imoti-chip">Цена от/до €</button>
          <button type="button" className="crm-imoti-chip">Площ от/до m²</button>
          <button type="button" className="crm-imoti-chip">
            <SlidersHorizontal size={12} /> Най-нови първо
          </button>
          <span className="crm-imoti-view-toggle">
            <button type="button" className="crm-imoti-icon-btn crm-imoti-icon-btn--on" aria-label="Мрежа">
              <Grid2X2 size={14} />
            </button>
            <button type="button" className="crm-imoti-icon-btn" aria-label="Списък">
              <LayoutList size={14} />
            </button>
          </span>
        </div>

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

        {(dealTab === "all" || dealTab === "sale") && (
          <PropertyRow title="Продажби" items={sales} onOpen={onOpenProperty} />
        )}
        {(dealTab === "all" || dealTab === "rent") && (
          <PropertyRow title="Наеми" items={rents} onOpen={onOpenProperty} />
        )}
      </div>
    </CrmModalShell>
  );
}
