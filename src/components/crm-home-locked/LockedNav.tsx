import { Building2, Calendar, ChevronDown, Home, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type NavKey = "home" | "clients" | "properties" | "calendar";

export type PropertyMenuKey =
  | "rentals"
  | "archive"
  | "upload"
  | "deposits";

export const PROPERTY_MENU: { key: PropertyMenuKey; label: string }[] = [
  { key: "rentals", label: "Управление на наеми" },
  { key: "archive", label: "Архив Имоти" },
  { key: "upload", label: "Качване на имот" },
  { key: "deposits", label: "Депозирани/Капарирани Имоти" },
];

const ITEMS: { key: NavKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Начало", icon: Home },
  { key: "clients", label: "Клиенти", icon: Users },
  { key: "properties", label: "Имоти", icon: Building2 },
  { key: "calendar", label: "Календар", icon: Calendar },
];

export function LockedNav({
  active,
  onSelect,
  onSelectPropertyMenu,
}: {
  active: NavKey;
  onSelect: (key: NavKey) => void;
  onSelectPropertyMenu: (key: PropertyMenuKey) => void;
}) {
  const [propsOpen, setPropsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!propsOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setPropsOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPropsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [propsOpen]);

  return (
    <nav className="crm-locked-nav" aria-label="CRM навигация">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;

        if (item.key === "properties") {
          return (
            <div
              key={item.key}
              className="crm-locked-nav__dropdown"
              ref={wrapRef}
            >
              <button
                type="button"
                className={
                  isActive || propsOpen
                    ? "crm-locked-nav__item crm-locked-nav__item--active"
                    : "crm-locked-nav__item"
                }
                aria-haspopup="menu"
                aria-expanded={propsOpen}
                onClick={() => setPropsOpen((v) => !v)}
              >
                <Icon size={28} strokeWidth={1.75} className="crm-locked-nav__icon" />
                <span className="crm-locked-nav__label-row">
                  {item.label}
                  <ChevronDown size={14} strokeWidth={2.2} aria-hidden />
                </span>
              </button>
              {propsOpen ? (
                <div className="crm-locked-nav__menu" role="menu" aria-label="Имоти">
                  {PROPERTY_MENU.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      role="menuitem"
                      className="crm-locked-nav__menu-item"
                      onClick={() => {
                        setPropsOpen(false);
                        onSelectPropertyMenu(opt.key);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        }

        return (
          <button
            key={item.key}
            type="button"
            className={
              isActive ? "crm-locked-nav__item crm-locked-nav__item--active" : "crm-locked-nav__item"
            }
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              setPropsOpen(false);
              onSelect(item.key);
            }}
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
