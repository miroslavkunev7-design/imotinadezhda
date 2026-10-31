import { useCallback, useState, startTransition } from "react";
import { Building2, CalendarClock, Handshake, Users } from "lucide-react";

import "./crm-home-locked.css";
import { BottomMenuSheet } from "./BottomMenuSheet";
import { BrokerBadge } from "./BrokerBadge";
import { GlassStatCard } from "./GlassStatCard";
import { LockedLogo } from "./LockedLogo";
import { LockedNav, type NavKey } from "./LockedNav";
import { NotificationsPanel } from "./NotificationsPanel";
import { SceneBackdrop } from "./SceneBackdrop";
import { SectionSheet, type SectionSheetData } from "./SectionSheet";
import { UtilityDock, type ThemeMode } from "./UtilityDock";

const CARDS: SectionSheetData[] = [
  {
    title: "Клиенти",
    value: 1,
    photoUrl: "/crm-home-locked/card-klienti.jpg",
    to: "/admin/clients",
    description: "Отвори таба с клиенти — картотека, бележки и следващи стъпки.",
    icon: <Users size={18} strokeWidth={1.6} />,
  },
  {
    title: "Активни имоти",
    value: 1,
    photoUrl: "/crm-home-locked/card-imoti.jpg",
    to: "/admin/properties",
    description: "Отвори таба с активни имоти — обяви, снимки и статуси.",
    icon: <Building2 size={18} strokeWidth={1.6} />,
  },
  {
    title: "Активни сделки",
    value: 0,
    photoUrl: "/crm-home-locked/card-sdelki.jpg",
    to: "/admin/deals",
    description: "Отвори таба със сделки — етапи до нотариус и комисионни.",
    icon: <Handshake size={18} strokeWidth={1.6} />,
  },
  {
    title: "Огледи",
    value: 0,
    photoUrl: "/crm-home-locked/card-ogledi.jpg",
    to: "/admin/viewings",
    description: "Отвори таба с огледи — насрочване и напомняния.",
    icon: <CalendarClock size={18} strokeWidth={1.6} />,
  },
];

export function CrmHomeLockedPage() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [activeNav] = useState<NavKey>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [section, setSection] = useState<SectionSheetData | null>(null);

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
          <LockedLogo />
          <LockedNav active={activeNav} />
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
                onOpen={() => setSection(card)}
              />
            ))}
          </section>
        </main>

        <footer className="crm-locked-bottom">
          <BrokerBadge />
          <UtilityDock
            theme={theme}
            onToggleTheme={onToggleTheme}
            onOpenNotifications={() => {
              setMenuOpen(false);
              setSection(null);
              setNotificationsOpen(true);
            }}
            onOpenMenu={() => {
              setNotificationsOpen(false);
              setSection(null);
              setMenuOpen(true);
            }}
          />
        </footer>
      </div>

      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
      <BottomMenuSheet
        open={menuOpen}
        active={activeNav}
        onClose={() => setMenuOpen(false)}
      />
      <SectionSheet
        open={section !== null}
        data={section}
        onClose={() => setSection(null)}
      />
    </div>
  );
}
