import { useCallback, useState, startTransition } from "react";
import {
  Building2,
  Calendar,
  CalendarClock,
  Handshake,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import "./crm-home-locked.css";
import { BottomMenuSheet } from "./BottomMenuSheet";
import { BrokerBadge } from "./BrokerBadge";
import { GlassStatCard } from "./GlassStatCard";
import { LockedLogo } from "./LockedLogo";
import { LockedNav, type NavKey } from "./LockedNav";
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
    title: "Активни имоти",
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
  ai: {
    title: "AI асистент",
    value: "24/7",
    photoUrl: "/crm-home-locked/card-imoti.jpg",
    description: "AI помощник за запитвания, описания и следващи действия в CRM.",
    icon: <Sparkles size={18} strokeWidth={1.6} />,
  },
  calendar: {
    title: "Календар",
    value: "Днес",
    photoUrl: "/crm-home-locked/card-ogledi.jpg",
    description: "Календар с огледи, срещи и задачи на брокера.",
    icon: <Calendar size={18} strokeWidth={1.6} />,
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
  const [section, setSection] = useState<SectionSheetData | null>(null);

  const closeOverlays = useCallback(() => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setSection(null);
  }, []);

  const onSelectNav = useCallback(
    (key: NavKey) => {
      setActiveNav(key);
      setMenuOpen(false);
      setNotificationsOpen(false);
      if (key === "home") {
        setSection(null);
        return;
      }
      setSection(NAV_SECTIONS[key] ?? null);
    },
    [],
  );

  const openMenu = useCallback(() => {
    setNotificationsOpen(false);
    setSection(null);
    setMenuOpen(true);
  }, []);

  const onToggleTheme = useCallback(() => {
    startTransition(() => {
      setTheme((t) => (t === "light" ? "dark" : "light"));
    });
  }, []);

  return (
    <div className="crm-locked-root" data-theme={theme}>
      <SceneBackdrop theme={theme} />
      <div className="crm-locked-ui">
        <header className="crm-locked-top">
          <LockedLogo onClick={() => onSelectNav("home")} />
          <LockedNav active={activeNav} onSelect={onSelectNav} />
        </header>

        <main className="crm-locked-main">
          <section className="crm-locked-grid" aria-label="CRM показатели">
            {CARDS.map((card) => (
              <GlassStatCard
                key={card.title}
                title={card.title}
                value={card.value}
                photoUrl={card.photoUrl}
                icon={card.icon}
                onOpen={() => {
                  setMenuOpen(false);
                  setNotificationsOpen(false);
                  setSection(card);
                }}
              />
            ))}
          </section>
        </main>

        <footer className="crm-locked-bottom">
          <BrokerBadge
            onOpen={() => {
              setMenuOpen(false);
              setNotificationsOpen(false);
              setSection(PROFILE_SHEET);
            }}
          />
          <UtilityDock
            theme={theme}
            onToggleTheme={onToggleTheme}
            onOpenNotifications={() => {
              setMenuOpen(false);
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
    </div>
  );
}
