import {
  Banknote,
  Bath,
  BedDouble,
  Building2,
  Calculator,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Heart,
  History,
  Home,
  Image as ImageIcon,
  Info,
  Landmark,
  MapPin,
  Phone,
  Printer,
  Scale,
  Share2,
  Shield,
  Bookmark,
  Layers3,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import { CrmModalShell } from "./CrmModalShell";
import { formatImotiPrice } from "./imoti-demo-data";
import type { ImotiDetailTab, ImotiProperty } from "./imoti-types";

const TABS: Array<{ key: ImotiDetailTab; label: string; icon: typeof Home }> = [
  { key: "basic", label: "Основна информация", icon: Home },
  { key: "media", label: "Снимки и медия", icon: ImageIcon },
  { key: "features", label: "Характеристики", icon: Layers3 },
  { key: "location", label: "Локация", icon: MapPin },
  { key: "documents", label: "Документи", icon: FileText },
  { key: "owner", label: "Собственик", icon: UserRound },
  { key: "history", label: "История", icon: History },
  { key: "deal", label: "Сделка", icon: HandshakeIcon },
  { key: "contract", label: "Договор", icon: Scale },
  { key: "bank", label: "Банка", icon: Landmark },
];

function HandshakeIcon(props: { size?: number; strokeWidth?: number }) {
  return <Building2 {...props} />;
}

function TabContent({
  tab,
  property,
  onJumpBank,
}: {
  tab: ImotiDetailTab;
  property: ImotiProperty;
  onJumpBank: () => void;
}) {
  switch (tab) {
    case "basic":
      return (
        <div className="crm-imoti-detail__split">
          <div className="crm-imoti-panel">
            <h3>
              <Home size={16} /> Основна информация
            </h3>
            <p>{property.description}</p>
            <div className="crm-imoti-feature-grid">
              {property.features.map((f) => (
                <div key={f.label} className="crm-imoti-feature">
                  <span>{f.label}</span>
                  <strong>{f.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <aside className="crm-imoti-side">
            <div className="crm-imoti-panel crm-imoti-panel--accent">
              <h4>Цена и разходи</h4>
              <div className="crm-imoti-money">
                <span>Официална цена</span>
                <strong>{formatImotiPrice(property)}</strong>
              </div>
              <div className="crm-imoti-money">
                <span>Цена към собственика</span>
                <strong>€ {Math.round(property.price * 0.875).toLocaleString("bg-BG")}</strong>
              </div>
              <div className="crm-imoti-money">
                <span>Комисионна 3%</span>
                <strong>€ {Math.round(property.price * 0.03).toLocaleString("bg-BG")}</strong>
              </div>
            </div>
            <div className="crm-imoti-panel">
              <h4>Бързи действия</h4>
              <div className="crm-imoti-quick">
                <button type="button" onClick={onJumpBank}>
                  <Calculator size={14} /> Изчисли вноска
                </button>
                <button type="button">
                  <Shield size={14} /> Провери ЦКР
                </button>
                <button type="button">
                  <Scale size={14} /> Нотариус
                </button>
                <button type="button" onClick={onJumpBank}>
                  <Landmark size={14} /> Банки
                </button>
              </div>
            </div>
          </aside>
        </div>
      );
    case "media":
      return (
        <div className="crm-imoti-panel">
          <h3>
            <ImageIcon size={16} /> Снимки и медия · {property.gallery.length} файла
          </h3>
          <div className="crm-imoti-media-grid">
            {property.gallery.map((src, i) => (
              <img key={`${src}-${i}`} src={src} alt="" />
            ))}
          </div>
        </div>
      );
    case "features":
      return (
        <div className="crm-imoti-panel">
          <h3>
            <Layers3 size={16} /> Характеристики
          </h3>
          <div className="crm-imoti-big-stats">
            <div>
              <strong>{property.areaSqm}</strong>
              <span>m² площ</span>
            </div>
            <div>
              <strong>{property.rooms}</strong>
              <span>стаи</span>
            </div>
            <div>
              <strong>{property.baths}</strong>
              <span>бани</span>
            </div>
            <div>
              <strong>{property.floor}</strong>
              <span>етаж</span>
            </div>
          </div>
          <div className="crm-imoti-feature-grid">
            {property.features.map((f) => (
              <div key={f.label} className="crm-imoti-feature">
                <span>{f.label}</span>
                <strong>{f.value}</strong>
              </div>
            ))}
          </div>
        </div>
      );
    case "location":
      return (
        <div className="crm-imoti-panel">
          <h3>
            <MapPin size={16} /> Локация
          </h3>
          <p>
            {property.city}, {property.quarter}. Точният адрес е поверителен и се показва само на
            упълномощени служители.
          </p>
        </div>
      );
    case "documents":
      return (
        <div className="crm-imoti-panel">
          <h3>
            <FileText size={16} /> Документи
          </h3>
          <div className="crm-imoti-accordion">
            <details open>
              <summary>Нотариални актове — 2 документа</summary>
              <p>Примерни файлове за демонстрация. Реалното хранилище се връзва към Supabase.</p>
            </details>
            <details>
              <summary>Скици и схеми — 1 документ</summary>
              <p>Качи или снимай документ от тук.</p>
            </details>
            <details>
              <summary>Данъчни оценки — 0 документа</summary>
              <p>Няма качени файлове.</p>
            </details>
          </div>
        </div>
      );
    case "owner":
      return (
        <div className="crm-imoti-panel">
          <h3>
            <UserRound size={16} /> Собственик (поверително)
          </h3>
          <div className="crm-imoti-feature-grid">
            <div className="crm-imoti-feature">
              <span>Име</span>
              <strong>Скрито · достъп по права</strong>
            </div>
            <div className="crm-imoti-feature">
              <span>Телефон</span>
              <strong>•••••</strong>
            </div>
            <div className="crm-imoti-feature">
              <span>Официална цена</span>
              <strong>{formatImotiPrice(property)}</strong>
            </div>
            <div className="crm-imoti-feature">
              <span>Цена към собственика</span>
              <strong>€ {Math.round(property.price * 0.875).toLocaleString("bg-BG")}</strong>
            </div>
          </div>
        </div>
      );
    case "history":
      return (
        <div className="crm-imoti-panel">
          <h3>
            <History size={16} /> История
          </h3>
          <ul className="crm-imoti-timeline">
            <li>
              <CalendarClock size={14} /> Създаден запис · днес · Мирослав Канев
            </li>
            <li>
              <ImageIcon size={14} /> Качени снимки · днес
            </li>
            <li>
              <Banknote size={14} /> Зададена официална цена · днес
            </li>
          </ul>
        </div>
      );
    case "deal":
      return (
        <div className="crm-imoti-panel">
          <h3>
            <Building2 size={16} /> Сделка
          </h3>
          <p>Статус: Запитване → Оглед → Оферта → … → Приключена.</p>
          <div className="crm-imoti-steps">
            {["Запитване", "Оглед", "Оферта", "Преговори", "Резервация", "Предварителен"].map(
              (s, i) => (
                <span key={s} className={i === 0 ? "is-on" : undefined}>
                  {s}
                </span>
              ),
            )}
          </div>
        </div>
      );
    case "contract":
      return (
        <div className="crm-imoti-panel">
          <h3>
            <Scale size={16} /> Договор
          </h3>
          <p>Шаблони: посредничество, собственик, купувач, наем, предварителен, депозит/капаро.</p>
          <button type="button" className="crm-imoti-primary">
            Създай договор
          </button>
        </div>
      );
    case "bank":
      return (
        <div className="crm-imoti-panel">
          <h3>
            <Landmark size={16} /> Банка · кредитно досие
          </h3>
          <div className="crm-imoti-banks">
            {["ДСК", "УниКредит", "ОББ", "Пощенска", "Райфайзен", "ПИБ"].map((b) => (
              <button key={b} type="button" className="crm-imoti-bank">
                <strong>{b}</strong>
                <span>Провери оферти</span>
              </button>
            ))}
          </div>
        </div>
      );
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
}

export function ImotiDetailModal({
  open,
  property,
  onClose,
}: {
  open: boolean;
  property: ImotiProperty | null;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<ImotiDetailTab>("basic");
  const [imageIdx, setImageIdx] = useState(0);

  const gallery = property?.gallery ?? [];
  const current = gallery[imageIdx] ?? property?.coverUrl ?? "";

  const stats = useMemo(() => {
    if (!property) return [];
    return [
      { icon: Home, label: `${property.areaSqm} m²` },
      { icon: BedDouble, label: `${property.rooms} стаи` },
      { icon: Bath, label: `${property.baths} бани` },
      { icon: Building2, label: `Етаж ${property.floor}` },
      { icon: CalendarClock, label: String(property.year) },
      { icon: Info, label: property.condition },
    ];
  }, [property]);

  if (!property) return null;

  return (
    <CrmModalShell
      open={open}
      title={property.title}
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      onClose={onClose}
      zIndex={70}
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
          <button type="button" className="crm-imoti-icon-btn" aria-label="Любим">
            <Heart size={15} />
          </button>
        </>
      }
    >
      <div className="crm-imoti-detail">
        <div className="crm-imoti-detail__hero">
          <div className="crm-imoti-gallery">
            <div className="crm-imoti-gallery__main">
              <img src={current} alt="" />
              <span className="crm-imoti-card__badge">{property.typeLabel}</span>
              <span className="crm-imoti-gallery__count">
                {imageIdx + 1} / {gallery.length || 1}
              </span>
              <button
                type="button"
                className="crm-imoti-row__arrow crm-imoti-row__arrow--left"
                aria-label="Предишна"
                onClick={() =>
                  setImageIdx((i) => (gallery.length ? (i - 1 + gallery.length) % gallery.length : 0))
                }
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="crm-imoti-row__arrow crm-imoti-row__arrow--right"
                aria-label="Следваща"
                onClick={() => setImageIdx((i) => (gallery.length ? (i + 1) % gallery.length : 0))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="crm-imoti-gallery__thumbs">
              {gallery.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  className={i === imageIdx ? "is-on" : undefined}
                  onClick={() => setImageIdx(i)}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          </div>

          <div className="crm-imoti-detail__summary">
            <h2>{property.title}</h2>
            <p className="crm-imoti-card__loc">
              <MapPin size={14} /> {property.city}, {property.quarter}
            </p>
            <div className="crm-imoti-detail__price">
              {formatImotiPrice(property)}
              <small>Официална цена</small>
            </div>
            <div className="crm-imoti-detail__stats">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <span key={s.label}>
                    <Icon size={14} /> {s.label}
                  </span>
                );
              })}
            </div>
            <div className="crm-imoti-detail__actions">
              <button type="button" className="crm-imoti-primary">
                <Phone size={14} /> Свържи се с брокер
              </button>
              <button type="button" className="crm-imoti-ghost">
                <Bookmark size={14} /> Запази
              </button>
              <button type="button" className="crm-imoti-ghost">
                <Share2 size={14} /> Сподели
              </button>
              <button type="button" className="crm-imoti-ghost">
                <Printer size={14} /> Печат
              </button>
            </div>
          </div>
        </div>

        <div className="crm-imoti-tabs" role="tablist" aria-label="Табове на имота">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? "is-active" : undefined}
                onClick={() => setTab(t.key)}
              >
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="crm-imoti-detail__tabbody" role="tabpanel">
          <TabContent tab={tab} property={property} onJumpBank={() => setTab("bank")} />
        </div>
      </div>
    </CrmModalShell>
  );
}
