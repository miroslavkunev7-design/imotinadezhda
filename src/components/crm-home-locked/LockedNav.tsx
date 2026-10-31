import { Building2, Calendar, Home, Sparkles, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type NavKey = "home" | "clients" | "properties" | "ai" | "calendar";

export const NAV_ROUTES: Record<NavKey, string> = {
  home: "/crm-home-locked",
  clients: "/admin/clients",
  properties: "/admin/properties",
  ai: "/admin/omnibot",
  calendar: "/admin/calendar",
};

const ITEMS: { key: NavKey; label: string; icon: typeof Home; to: string }[] = [
  { key: "home", label: "Начало", icon: Home, to: NAV_ROUTES.home },
  { key: "clients", label: "Клиенти", icon: Users, to: NAV_ROUTES.clients },
  { key: "properties", label: "Имоти", icon: Building2, to: NAV_ROUTES.properties },
  { key: "ai", label: "AI асистент", icon: Sparkles, to: NAV_ROUTES.ai },
  { key: "calendar", label: "Календар", icon: Calendar, to: NAV_ROUTES.calendar },
];

export function LockedNav({ active }: { active: NavKey }) {
  return (
    <nav className="crm-locked-nav" aria-label="CRM навигация">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <Link
            key={item.key}
            to={item.to}
            className={
              isActive ? "crm-locked-nav__item crm-locked-nav__item--active" : "crm-locked-nav__item"
            }
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={20} strokeWidth={1.6} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export { ITEMS as LOCKED_NAV_ITEMS };
