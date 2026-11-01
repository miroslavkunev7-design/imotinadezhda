import { Bell, Menu, Moon, Sun } from "lucide-react";

export type ThemeMode = "dark" | "light";

export function UtilityDock({
  theme,
  onToggleTheme,
  onOpenNotifications,
  onOpenMenu,
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenNotifications: () => void;
  onOpenMenu: () => void;
}) {
  const isLight = theme === "light";

  return (
    <div className="crm-locked-dock">
      <button
        type="button"
        className={`crm-locked-fab crm-locked-fab--theme${isLight ? "" : " crm-locked-fab--theme-active"}`}
        aria-label={isLight ? "Нощна версия" : "Дневна версия"}
        title={isLight ? "Нощна версия" : "Дневна версия"}
        onClick={onToggleTheme}
      >
        {isLight ? (
          <Sun size={20} strokeWidth={1.7} />
        ) : (
          <Moon size={20} strokeWidth={1.7} />
        )}
      </button>
      <button
        type="button"
        className="crm-locked-fab"
        aria-label="Известия"
        onClick={onOpenNotifications}
      >
        <Bell size={20} strokeWidth={1.7} />
      </button>
      <button
        type="button"
        className="crm-locked-fab crm-locked-fab--menu"
        aria-label="Отвори меню"
        onClick={onOpenMenu}
      >
        <Menu size={22} strokeWidth={1.8} />
      </button>
    </div>
  );
}
