import {
  Banknote,
  Bath,
  BedDouble,
  Building2,
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
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CreditBlock } from "@/components/admin/credit-block";
import type { CreditBlockData } from "@/lib/banks-catalog";

import { CrmModalShell } from "./CrmModalShell";
import { ImotiBankModal } from "./ImotiBankModal";
import { formatImotiPrice } from "./imoti-demo-data";
import {
  FEATURE_EMOJI,
  IMOTI_MODULE_BG,
  IMOTI_SECTION_BG,
  type ImotiDetailTab,
  type ImotiProperty,
} from "./imoti-types";

const TABS: Array<{ key: ImotiDetailTab; label: string; icon: typeof Home }> = [
  { key: "basic", label: "Основна информация", icon: Home },
  { key: "media", label: "Снимки и медия", icon: ImageIcon },
  { key: "features", label: "Характеристики", icon: Layers3 },
  { key: "location", label: "Локация", icon: MapPin },
  { key: "documents", label: "Документи", icon: FileText },
  { key: "owner", label: "Собственик", icon: UserRound },
  { key: "history", label: "История", icon: History },
  { key: "deal", label: "Сделка", icon: Building2 },
  { key: "contract", label: "Договор", icon: Scale },
  { key: "bank", label: "Банка", icon: Landmark },
];

function featureEmoji(label: string): string {
  return FEATURE_EMOJI[label] ?? "🔹";
}

function SectionPanel({
  tab,
  children,
  className = "",
  bgUrl,
}: {
  tab: ImotiDetailTab;
  children: ReactNode;
  className?: string;
  bgUrl?: string;
}) {
  const bg = bgUrl ?? IMOTI_SECTION_BG[tab];
  return (
    <div
      className={`crm-imoti-panel crm-imoti-panel--section crm-imoti-panel--${tab}${className ? ` ${className}` : ""}`}
      style={{ ["--crm-imoti-section-bg" as string]: `url(${bg})` }}
    >
      {children}
    </div>
  );
}

function TabContent({
  tab,
  property,
  onJump,
  loanOpen,
  onToggleLoan,
  onOpenBank,
  onUpdateCreditBlock,
}: {
  tab: ImotiDetailTab;
  property: ImotiProperty;
  onJump: (t: ImotiDetailTab) => void;
  loanOpen: boolean;
  onToggleLoan: () => void;
  onOpenBank: () => void;
  onUpdateCreditBlock: (block: CreditBlockData) => void;
}) {
  const monthly = Math.round((property.price * 0.0045) / 10) * 10;

  switch (tab) {
    case "basic":
      return (
        <div className="crm-imoti-detail__split">
          <SectionPanel tab="basic">
            <h3>
              <span className="crm-imoti-emoji" aria-hidden>
                🏠
              </span>{" "}
              Основна информация
            </h3>
            <p>{property.description}</p>
            <div className="crm-imoti-feature-grid">
              {property.features.map((f) => (
                <div key={f.label} className="crm-imoti-feature">
                  <span className="crm-imoti-feature__emoji" aria-hidden>
                    {featureEmoji(f.label)}
                  </span>
                  <span>{f.label}</span>
                  <strong>{f.value}</strong>
                </div>
              ))}
            </div>
          </SectionPanel>
          <div className="crm-imoti-detail__midshot" aria-hidden>
            <img src={property.gallery[1] ?? property.coverUrl} alt="" />
          </div>
          <aside className="crm-imoti-side">
            <SectionPanel
              tab="basic"
              className="crm-imoti-panel--accent crm-imoti-panel--module-price"
              bgUrl={IMOTI_MODULE_BG.price}
            >
              <h4>
                <span className="crm-imoti-emoji" aria-hidden>
                  🪙
                </span>{" "}
                Цена и разходи
              </h4>
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
              <div className="crm-imoti-money crm-imoti-money--total">
                <span>Общо по сделката</span>
                <strong>€ {Math.round(property.price * 0.905).toLocaleString("bg-BG")}</strong>
              </div>
              {property.creditBlock ? (
                <div className="crm-imoti-credit-wrap">
                  <CreditBlock
                    data={property.creditBlock}
                    onChangeBank={onOpenBank}
                    onOpenDetail={onOpenBank}
                    onUpdate={onUpdateCreditBlock}
                  />
                </div>
              ) : (
                <button type="button" className="crm-imoti-primary crm-imoti-bank-cta" onClick={onOpenBank}>
                  <Landmark size={15} /> Банка
                </button>
              )}
            </SectionPanel>
            <SectionPanel
              tab="bank"
              className="crm-imoti-panel--module-quick"
              bgUrl={IMOTI_MODULE_BG.quick}
            >
              <h4>
                <span className="crm-imoti-emoji" aria-hidden>
                  ⚡
                </span>{" "}
                Бързи действия
              </h4>
              <div className="crm-imoti-quick">
                <button type="button" onClick={onToggleLoan}>
                  <span aria-hidden>🧮</span> Изчисли вноска
                </button>
                <button type="button" onClick={() => onJump("bank")}>
                  <span aria-hidden>🛡</span> Провери ЦКР
                </button>
                <button type="button" onClick={() => onJump("contract")}>
                  <span aria-hidden>⚖️</span> Нотариус
                </button>
                <button type="button" onClick={onOpenBank}>
                  <span aria-hidden>🏦</span> Банки
                </button>
              </div>
              {loanOpen ? (
                <div className="crm-imoti-loan">
                  <p>
                    Примерна месечна вноска при 80% финансиране · ~{" "}
                    <strong>€ {monthly.toLocaleString("bg-BG")}</strong>
                  </p>
                </div>
              ) : null}
            </SectionPanel>
          </aside>
        </div>
      );
    case "media":
      return (
        <SectionPanel tab="media">
          <h3>
            <ImageIcon size={16} /> Снимки и медия · {property.gallery.length} файла
          </h3>
          <div className="crm-imoti-media-grid">
            {property.gallery.map((src, i) => (
              <img key={`${src}-${i}`} src={src} alt="" />
            ))}
          </div>
        </SectionPanel>
      );
    case "features":
      return (
        <SectionPanel tab="features">
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
                <span className="crm-imoti-feature__emoji" aria-hidden>
                  {featureEmoji(f.label)}
                </span>
                <span>{f.label}</span>
                <strong>{f.value}</strong>
              </div>
            ))}
          </div>
        </SectionPanel>
      );
    case "location":
      return (
        <SectionPanel tab="location">
          <h3>
            <MapPin size={16} /> Локация
          </h3>
          <p>
            {property.city}, {property.quarter}. Точният адрес е поверителен и се показва само на
            упълномощени служители.
          </p>
        </SectionPanel>
      );
    case "documents":
      return (
        <SectionPanel tab="documents">
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
        </SectionPanel>
      );
    case "owner":
      return (
        <SectionPanel tab="owner">
          <h3>
            <UserRound size={16} /> Собственик (поверително)
          </h3>
          <div className="crm-imoti-feature-grid">
            <div className="crm-imoti-feature">
              <span className="crm-imoti-feature__emoji" aria-hidden>
                {featureEmoji("Име")}
              </span>
              <span>Име</span>
              <strong>Скрито · достъп по права</strong>
            </div>
            <div className="crm-imoti-feature">
              <span className="crm-imoti-feature__emoji" aria-hidden>
                {featureEmoji("Телефон")}
              </span>
              <span>Телефон</span>
              <strong>•••••</strong>
            </div>
            <div className="crm-imoti-feature">
              <span className="crm-imoti-feature__emoji" aria-hidden>
                {featureEmoji("Официална цена")}
              </span>
              <span>Официална цена</span>
              <strong>{formatImotiPrice(property)}</strong>
            </div>
            <div className="crm-imoti-feature">
              <span className="crm-imoti-feature__emoji" aria-hidden>
                {featureEmoji("Цена към собственика")}
              </span>
              <span>Цена към собственика</span>
              <strong>€ {Math.round(property.price * 0.875).toLocaleString("bg-BG")}</strong>
            </div>
          </div>
          {property.descriptionOwner ? (
            <div className="crm-imoti-owner-note">
              <h4>Лично описание</h4>
              <p>{property.descriptionOwner}</p>
            </div>
          ) : (
            <p>Няма лично описание за този имот.</p>
          )}
        </SectionPanel>
      );
    case "history":
      return (
        <SectionPanel tab="history">
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
        </SectionPanel>
      );
    case "deal":
      return (
        <SectionPanel tab="deal">
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
        </SectionPanel>
      );
    case "contract":
      return (
        <SectionPanel tab="contract">
          <h3>
            <Scale size={16} /> Договор
          </h3>
          <p>Шаблони: посредничество, собственик, купувач, наем, предварителен, депозит/капаро.</p>
          <button type="button" className="crm-imoti-primary">
            Създай договор
          </button>
        </SectionPanel>
      );
    case "bank":
      return (
        <SectionPanel tab="bank">
          <h3>
            <Landmark size={16} /> Банка · кредитно досие
          </h3>
          {property.creditBlock ? (
            <div className="crm-imoti-credit-wrap">
              <CreditBlock
                data={property.creditBlock}
                onChangeBank={onOpenBank}
                onOpenDetail={onOpenBank}
                onUpdate={onUpdateCreditBlock}
              />
            </div>
          ) : (
            <>
              <p>
                Отвори банковия модул — избери банка, попълни графата и запази кредитен блок към
                този имот.
              </p>
              <button type="button" className="crm-imoti-primary" onClick={onOpenBank}>
                <Landmark size={14} /> Отвори Банка
              </button>
            </>
          )}
        </SectionPanel>
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
  onToggleFavorite,
  onNavigate: _onNavigate,
  onSaveCreditBlock,
}: {
  open: boolean;
  property: ImotiProperty | null;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onNavigate: (target: "clients" | "calendar") => void;
  onSaveCreditBlock: (propertyId: string, block: CreditBlockData) => void;
}) {
  void _onNavigate;
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<ImotiDetailTab>("basic");
  const [imageIdx, setImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [brokerOpen, setBrokerOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) {
      setLightboxOpen(false);
      setImageIdx(0);
      setTab("basic");
    }
  }, [open, property?.id]);

  const gallery = property?.gallery ?? [];
  const galleryLen = gallery.length;
  const current = gallery[imageIdx] ?? property?.coverUrl ?? "";

  useEffect(() => {
    if (!lightboxOpen) return;
    const len = galleryLen;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxOpen(false);
        return;
      }
      if (e.key === "ArrowLeft") {
        setImageIdx((i) => (len ? (i - 1 + len) % len : 0));
      }
      if (e.key === "ArrowRight") {
        setImageIdx((i) => (len ? (i + 1) % len : 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, galleryLen]);

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

  const stepImage = (dir: -1 | 1) => {
    setImageIdx((i) => (galleryLen ? (i + dir + galleryLen) % galleryLen : 0));
  };

  const share = async () => {
    const text = `${property.title} · ${formatImotiPrice(property)} · ${property.city}, ${property.quarter}`;
    try {
      await navigator.clipboard.writeText(text);
      setToast("Копирано в клипборда");
    } catch {
      setToast("Неуспешно копиране");
    }
  };

  const printDetail = () => {
    window.print();
  };

  return (
    <CrmModalShell
      open={open}
      title={property.title}
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      onClose={onClose}
      zIndex={70}
      className="crm-imoti-shell--detail-merge"
      headerLeft={<span className="crm-imoti-shell__brand-spacer" aria-hidden />}
      headerRight={
        <>
          <button
            type="button"
            className={`crm-imoti-icon-btn${property.favorite ? " is-fav" : ""}`}
            aria-label="Любим"
            onClick={() => onToggleFavorite(property.id)}
          >
            <Heart size={15} fill={property.favorite ? "currentColor" : "none"} />
          </button>
        </>
      }
    >
      <div className="crm-imoti-detail">
        <div className="crm-imoti-detail__hero crm-imoti-detail__hero--melt">
          <div className="crm-imoti-gallery">
            <div className="crm-imoti-gallery__main">
              <button
                type="button"
                className="crm-imoti-gallery__open"
                aria-label="Отвори снимка на цял екран"
                onClick={() => setLightboxOpen(true)}
              >
                <img src={current} alt="" />
              </button>
              <span className="crm-imoti-card__badge">{property.typeLabel}</span>
              <span className="crm-imoti-gallery__count">
                {imageIdx + 1} / {galleryLen || 1}
              </span>
              <button
                type="button"
                className="crm-imoti-row__arrow crm-imoti-row__arrow--left"
                aria-label="Предишна"
                onClick={(e) => {
                  e.stopPropagation();
                  stepImage(-1);
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="crm-imoti-row__arrow crm-imoti-row__arrow--right"
                aria-label="Следваща"
                onClick={(e) => {
                  e.stopPropagation();
                  stepImage(1);
                }}
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
                  onClick={() => {
                    setImageIdx(i);
                    setLightboxOpen(true);
                  }}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          </div>

          <div className="crm-imoti-detail__summary">
            <div
              className="crm-imoti-detail__summary-melt"
              style={{ backgroundImage: `url(${current})` }}
              aria-hidden
            />
            <div className="crm-imoti-detail__summary-body">
              <h2>{property.title}</h2>
              <p className="crm-imoti-detail__loc">
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
                      <Icon size={15} strokeWidth={1.8} /> {s.label}
                    </span>
                  );
                })}
              </div>
              <div className="crm-imoti-detail__actions">
                <button
                  type="button"
                  className="crm-imoti-primary crm-imoti-primary--gold"
                  onClick={() => setBrokerOpen(true)}
                >
                  <Phone size={14} /> Свържи се с брокер
                </button>
                <button
                  type="button"
                  className="crm-imoti-ghost crm-imoti-ghost--gold"
                  onClick={() => onToggleFavorite(property.id)}
                >
                  <Bookmark size={14} /> {property.favorite ? "Запазен" : "Запази"}
                </button>
                <button
                  type="button"
                  className="crm-imoti-ghost crm-imoti-ghost--gold"
                  onClick={() => void share()}
                >
                  <Share2 size={14} /> Сподели
                </button>
                <button
                  type="button"
                  className="crm-imoti-ghost crm-imoti-ghost--gold"
                  onClick={printDetail}
                >
                  <Printer size={14} /> Печат
                </button>
              </div>
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
          <TabContent
            tab={tab}
            property={property}
            onJump={setTab}
            loanOpen={loanOpen}
            onToggleLoan={() => setLoanOpen((v) => !v)}
            onOpenBank={() => setBankOpen(true)}
            onUpdateCreditBlock={(block) => onSaveCreditBlock(property.id, block)}
          />
        </div>
      </div>

      <ImotiBankModal
        open={bankOpen}
        property={property}
        onClose={() => setBankOpen(false)}
        onSaveCreditBlock={(block) => onSaveCreditBlock(property.id, block)}
      />

      {brokerOpen ? (
        <div className="crm-imoti-sheet" role="dialog" aria-label="Контакт с брокер">
          <div className="crm-imoti-sheet__card">
            <button
              type="button"
              className="crm-imoti-icon-btn"
              aria-label="Затвори"
              onClick={() => setBrokerOpen(false)}
            >
              <X size={14} />
            </button>
            <img src="/crm-home-locked/avatar-miroslav.jpg" alt="" className="crm-imoti-avatar" />
            <strong>Мирослав Канев</strong>
            <span>Брокер · Имоти Надежда</span>
            <a className="crm-imoti-primary" href="tel:+359888000000">
              <Phone size={14} /> +359 888 000 000
            </a>
            <a className="crm-imoti-ghost" href="mailto:miroslav@imotinadezhda.bg">
              miroslav@imotinadezhda.bg
            </a>
          </div>
        </div>
      ) : null}

      {toast ? <div className="crm-imoti-toast">{toast}</div> : null}

      {lightboxOpen ? (
        <div
          className="crm-imoti-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Галерия на цял екран"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            className="crm-imoti-lightbox__close"
            aria-label="Затвори"
            onClick={() => setLightboxOpen(false)}
          >
            <X size={18} />
          </button>
          <button
            type="button"
            className="crm-imoti-lightbox__nav crm-imoti-lightbox__nav--prev"
            aria-label="Предишна"
            onClick={(e) => {
              e.stopPropagation();
              stepImage(-1);
            }}
          >
            <ChevronLeft size={28} />
          </button>
          <img
            src={current}
            alt=""
            className="crm-imoti-lightbox__img"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="crm-imoti-lightbox__nav crm-imoti-lightbox__nav--next"
            aria-label="Следваща"
            onClick={(e) => {
              e.stopPropagation();
              stepImage(1);
            }}
          >
            <ChevronRight size={28} />
          </button>
          <span className="crm-imoti-lightbox__count">
            {imageIdx + 1} / {galleryLen || 1}
          </span>
        </div>
      ) : null}
    </CrmModalShell>
  );
}
