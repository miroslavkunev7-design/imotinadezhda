import { Building2, Calendar, Home, Users } from "lucide-react";

export type NavKey = "home" | "clients" | "properties" | "calendar";

const ITEMS: { key: NavKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Начало", icon: Home },
  { key: "clients", label: "Клиенти", icon: Users },
  { key: "properties", label: "Имоти", icon: Building2 },
  { key: "calendar", label: "Календар", icon: Calendar },
];

export function LockedNav({
  active,
  onSelect,
}: {
  active: NavKey;
  onSelect: (key: NavKey) => void;
}) {
  return (
    <nav className="crm-locked-nav" aria-label="CRM навигация">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            className={
              isActive ? "crm-locked-nav__item crm-locked-nav__item--active" : "crm-locked-nav__item"
            }
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(item.key)}
          >
            <Icon size={28} strokeWidth={1.75} className="crm-locked-nav__icon" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export { ITEMS as LOCKED_NAV_ITEMS };
