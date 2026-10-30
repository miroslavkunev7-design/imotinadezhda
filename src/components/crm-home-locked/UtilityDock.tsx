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
  return (
    <div className="crm-locked-dock">
      {theme === "light" ? (
        <button
          type="button"
          className="crm-locked-fab"
          aria-label="Превключи към тъмна тема"
          onClick={onToggleTheme}
        >
          <Sun size={20} strokeWidth={1.7} />
        </button>
      ) : (
        <button
          type="button"
          className="crm-locked-fab"
          aria-label="Превключи към светла тема"
          onClick={onToggleTheme}
        >
          <Moon size={20} strokeWidth={1.7} />
        </button>
      )}
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
