import { useCallback, useState, startTransition } from "react";
import {
  Archive,
  Building2,
  Calendar,
  CalendarClock,
  Handshake,
  KeyRound,
  Upload,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

import "./crm-home-locked.css";
import { AiAssistChat, AiAssistFab } from "./AiAssistChat";
import { BottomMenuSheet } from "./BottomMenuSheet";
import { BrokerBadge } from "./BrokerBadge";
import { GlassStatCard } from "./GlassStatCard";
import { IMOTI_DEMO } from "./imoti/imoti-demo-data";
import { ImotiCatalogModal } from "./imoti/ImotiCatalogModal";
import { ImotiDetailModal } from "./imoti/ImotiDetailModal";
import { ImotiUploadModal } from "./imoti/ImotiUploadModal";
import type { ImotiProperty } from "./imoti/imoti-types";
import { LockedLogo } from "./LockedLogo";
import {
  LockedNav,
  type NavKey,
  type PropertyMenuKey,
} from "./LockedNav";
import { NotificationsPanel, type NoticeSection } from "./NotificationsPanel";
import { SceneBackdrop } from "./SceneBackdrop";
import { SectionSheet, type SectionSheetData } from "./SectionSheet";
import { UtilityDock, type ThemeMode } from "./UtilityDock";

const CARDS: SectionSheetData[] = [
  {
    title: "Клиенти",
    value: 1,
    photoUrl: "/crm-home-locked/card-klienti.jpg",
    description: "Картотека с клиенти, бележки и следващи стъпки.",
    icon: <Users size={18} strokeWidth={1.6} />,
  },
  {
    title: "Имоти",
    value: 1,
    photoUrl: "/crm-home-locked/card-imoti.jpg",
    description: "Активни обяви, снимки и статуси на имотите.",
    icon: <Building2 size={18} strokeWidth={1.6} />,
  },
  {
    title: "Активни сделки",
    value: 0,
    photoUrl: "/crm-home-locked/card-sdelki.jpg",
    description: "Сделки по етапи до нотариус и комисионни.",
    icon: <Handshake size={18} strokeWidth={1.6} />,
  },
  {
    title: "Огледи",
    value: 0,
    photoUrl: "/crm-home-locked/card-ogledi.jpg",
    description: "Насрочване на огледи и напомняния.",
    icon: <CalendarClock size={18} strokeWidth={1.6} />,
  },
];

const NAV_SECTIONS: Partial<Record<NavKey, SectionSheetData>> = {
  clients: CARDS[0],
  properties: CARDS[1],
  calendar: {
    title: "Календар",
    value: "Днес",
    photoUrl: "/crm-home-locked/card-ogledi.jpg",
    description: "Календар с огледи, срещи и задачи на брокера.",
    icon: <Calendar size={18} strokeWidth={1.6} />,
  },
};

const PROPERTY_SECTIONS: Record<PropertyMenuKey, SectionSheetData> = {
  rentals: {
    title: "Управление на наеми",
    value: "Наеми",
    photoUrl: "/crm-home-locked/card-imoti.jpg",
    description: "Договори за наем, наематели, срокове и плащания.",
    icon: <KeyRound size={18} strokeWidth={1.6} />,
  },
  archive: {
    title: "Архив Имоти",
    value: "Архив",
    photoUrl: "/crm-home-locked/card-imoti.jpg",
    description: "Архивирани и приключени имоти за справка.",
    icon: <Archive size={18} strokeWidth={1.6} />,
  },
  upload: {
    title: "Качване на имот",
    value: "Нов",
    photoUrl: "/crm-home-locked/card-imoti.jpg",
    description: "Добави нов имот със снимки, цена и описание.",
    icon: <Upload size={18} strokeWidth={1.6} />,
  },
  deposits: {
    title: "Депозирани/Капарирани Имоти",
    value: "Капари",
    photoUrl: "/crm-home-locked/card-sdelki.jpg",
    description: "Имоти с депозит или капаро — статуси и следващи стъпки.",
    icon: <Wallet size={18} strokeWidth={1.6} />,
  },
};

const NOTICE_SECTIONS: Record<NoticeSection, SectionSheetData> = {
  ogledi: CARDS[3],
  sdelki: CARDS[2],
};

const PROFILE_SHEET: SectionSheetData = {
  title: "Мирослав Канев",
  value: "Брокер",
  photoUrl: "/crm-home-locked/avatar-miroslav.jpg",
  description: "Профил на брокера — контакти, активност и настройки на акаунта.",
  subtitle: "CRM профил",
  icon: <UserRound size={18} strokeWidth={1.6} />,
};

export function CrmHomeLockedPage() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [activeNav, setActiveNav] = useState<NavKey>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [section, setSection] = useState<SectionSheetData | null>(null);
  const [imotiOpen, setImotiOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [properties, setProperties] = useState<ImotiProperty[]>(() => [...IMOTI_DEMO]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedProperty = selectedId
    ? (properties.find((p) => p.id === selectedId) ?? null)
    : null;

  const closeOverlays = useCallback(() => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setAiOpen(false);
    setSection(null);
  }, []);

  const openImotiCatalog = useCallback(() => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setAiOpen(false);
    setSection(null);
    setSelectedId(null);
    setUploadOpen(false);
    setActiveNav("properties");
    setImotiOpen(true);
  }, []);

  const closeImotiCatalog = useCallback(() => {
    setImotiOpen(false);
    setSelectedId(null);
    setUploadOpen(false);
    setActiveNav("home");
  }, []);

  const onSelectNav = useCallback((key: NavKey) => {
    setActiveNav(key);
    setMenuOpen(false);
    setNotificationsOpen(false);
    setAiOpen(false);
    setUploadOpen(false);
    if (key === "home") {
      setSection(null);
      setImotiOpen(false);
      setSelectedId(null);
      return;
    }
    if (key === "properties") {
      setSection(null);
      setSelectedId(null);
      setImotiOpen(true);
      return;
    }
    setImotiOpen(false);
    setSelectedId(null);
    setSection(NAV_SECTIONS[key] ?? null);
  }, []);

  const navigateFromImoti = useCallback((target: "clients" | "calendar") => {
    setImotiOpen(false);
    setSelectedId(null);
    setUploadOpen(false);
    setActiveNav(target);
    setSection(NAV_SECTIONS[target] ?? null);
  }, []);

  const onSelectPropertyMenu = useCallback((key: PropertyMenuKey) => {
    setActiveNav("properties");
    setMenuOpen(false);
    setNotificationsOpen(false);
    setAiOpen(false);
    setSelectedId(null);
    if (key === "upload") {
      setSection(null);
      setImotiOpen(true);
      setUploadOpen(true);
      return;
    }
    setImotiOpen(false);
    setUploadOpen(false);
    setSection(PROPERTY_SECTIONS[key]);
  }, []);

  const openMenu = useCallback(() => {
    setNotificationsOpen(false);
    setAiOpen(false);
    setSection(null);
    setMenuOpen(true);
  }, []);

  const onToggleTheme = useCallback(() => {
    startTransition(() => {
      setTheme((t) => (t === "light" ? "dark" : "light"));
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setProperties((list) =>
      list.map((p) => (p.id === id ? { ...p, favorite: !p.favorite } : p)),
    );
  }, []);

  const imotiValue = properties.length;

  return (
    <div className="crm-locked-root" data-theme={theme}>
      <SceneBackdrop theme={theme} />
      <div className="crm-locked-ui">
        <header className="crm-locked-top">
          <div className="crm-locked-top__spacer" aria-hidden />
          <LockedNav
            active={activeNav}
            onSelect={onSelectNav}
            onSelectPropertyMenu={onSelectPropertyMenu}
          />
          <LockedLogo onClick={() => onSelectNav("home")} />
        </header>

        <main className="crm-locked-main">
          {theme === "light" ? (
            <div className="crm-locked-brand-copy">
              <p className="crm-locked-brand-copy__line">Недвижими имоти</p>
              <p className="crm-locked-brand-copy__name">
                <span className="crm-locked-brand-copy__dot" aria-hidden />
                Надежда
                <span className="crm-locked-brand-copy__dot" aria-hidden />
              </p>
            </div>
          ) : null}
          <section className="crm-locked-grid" aria-label="CRM показатели">
            {CARDS.map((card) => (
              <GlassStatCard
                key={card.title}
                title={card.title}
                value={card.title === "Имоти" ? imotiValue : card.value}
                photoUrl={card.photoUrl}
                icon={card.icon}
                onOpen={() => {
                  if (card.title === "Имоти") {
                    openImotiCatalog();
                    return;
                  }
                  setMenuOpen(false);
                  setNotificationsOpen(false);
                  setAiOpen(false);
                  setImotiOpen(false);
                  setSelectedId(null);
                  setUploadOpen(false);
                  setSection(card);
                }}
              />
            ))}
          </section>
        </main>

        <footer className="crm-locked-bottom">
          <div className="crm-locked-bottom__left">
            <AiAssistFab
              active={aiOpen}
              onToggle={() => {
                setMenuOpen(false);
                setNotificationsOpen(false);
                setSection(null);
                setAiOpen((v) => !v);
              }}
            />
            <BrokerBadge
              onOpen={() => {
                setMenuOpen(false);
                setNotificationsOpen(false);
                setAiOpen(false);
                setSection(PROFILE_SHEET);
              }}
            />
            <AiAssistChat
              open={aiOpen}
              onClose={() => setAiOpen(false)}
              onSkill={(id) => {
                if (id === "upload-property") {
                  setAiOpen(false);
                  setImotiOpen(true);
                  setActiveNav("properties");
                  setUploadOpen(true);
                }
              }}
            />
          </div>
          <UtilityDock
            theme={theme}
            onToggleTheme={onToggleTheme}
            onOpenNotifications={() => {
              setMenuOpen(false);
              setAiOpen(false);
              setSection(null);
              setNotificationsOpen(true);
            }}
            onOpenMenu={openMenu}
          />
        </footer>
      </div>

      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onOpenSection={(key) => setSection(NOTICE_SECTIONS[key])}
      />
      <BottomMenuSheet
        open={menuOpen}
        active={activeNav}
        onClose={() => setMenuOpen(false)}
        onSelect={onSelectNav}
      />
      <SectionSheet open={section !== null} data={section} onClose={closeOverlays} />
      <ImotiCatalogModal
        open={imotiOpen}
        properties={properties}
        onClose={closeImotiCatalog}
        onOpenProperty={(property) => setSelectedId(property.id)}
        onAddProperty={() => setUploadOpen(true)}
        onToggleFavorite={toggleFavorite}
        onNavigate={navigateFromImoti}
      />
      <ImotiDetailModal
        key={selectedProperty?.id ?? "imoti-detail"}
        open={selectedProperty !== null}
        property={selectedProperty}
        onClose={() => setSelectedId(null)}
        onToggleFavorite={toggleFavorite}
        onNavigate={navigateFromImoti}
        onSaveCreditBlock={(propertyId, block) => {
          setProperties((list) =>
            list.map((p) => (p.id === propertyId ? { ...p, creditBlock: block } : p)),
          );
        }}
      />
      <ImotiUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSave={(property) => {
          setProperties((list) => [property, ...list]);
          setSelectedId(property.id);
          setImotiOpen(true);
        }}
      />
    </div>
  );
}
