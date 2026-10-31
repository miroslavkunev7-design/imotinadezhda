import { useCallback, useState, startTransition } from "react";
import { Building2, CalendarClock, Handshake, Users } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import "./crm-home-locked.css";
import { BottomMenuSheet } from "./BottomMenuSheet";
import { BrokerBadge } from "./BrokerBadge";
import { GlassStatCard } from "./GlassStatCard";
import { LockedLogo } from "./LockedLogo";
import { LockedNav, type NavKey } from "./LockedNav";
import { NotificationsPanel } from "./NotificationsPanel";
import { SceneBackdrop } from "./SceneBackdrop";
import { UtilityDock, type ThemeMode } from "./UtilityDock";

const CARDS = [
  {
    title: "Клиенти",
    value: 1,
    photoUrl: "/crm-home-locked/card-klienti.jpg",
    to: "/admin/clients",
    icon: <Users size={18} strokeWidth={1.6} />,
  },
  {
    title: "Активни имоти",
    value: 1,
    photoUrl: "/crm-home-locked/card-imoti.jpg",
    to: "/admin/properties",
    icon: <Building2 size={18} strokeWidth={1.6} />,
  },
  {
    title: "Активни сделки",
    value: 0,
    photoUrl: "/crm-home-locked/card-sdelki.jpg",
    to: "/admin/deals",
    icon: <Handshake size={18} strokeWidth={1.6} />,
  },
  {
    title: "Огледи",
    value: 0,
    photoUrl: "/crm-home-locked/card-ogledi.jpg",
    to: "/admin/viewings",
    icon: <CalendarClock size={18} strokeWidth={1.6} />,
  },
] as const;

const NAV_ROUTES: Record<NavKey, string> = {
  home: "/crm-home-locked",
  clients: "/admin/clients",
  properties: "/admin/properties",
  ai: "/admin/omnibot",
  calendar: "/admin/calendar",
};

export function CrmHomeLockedPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [activeNav, setActiveNav] = useState<NavKey>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const onSelectNav = useCallback(
    (key: NavKey) => {
      setActiveNav(key);
      if (key !== "home") {
        void navigate({ to: NAV_ROUTES[key] });
      }
    },
    [navigate],
  );

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
          <LockedNav active={activeNav} onSelect={onSelectNav} />
        </header>

        <main className="crm-locked-main">
          <section className="crm-locked-grid" aria-label="CRM показатели">
            {CARDS.map((card) => (
              <GlassStatCard key={card.title} {...card} />
            ))}
          </section>
        </main>

        <footer className="crm-locked-bottom">
          <BrokerBadge />
          <UtilityDock
            theme={theme}
            onToggleTheme={onToggleTheme}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onOpenMenu={() => setMenuOpen(true)}
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
        onSelect={onSelectNav}
      />
    </div>
  );
}
