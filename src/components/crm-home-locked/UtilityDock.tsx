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
        <span className="crm-locked-fab__emoji" aria-hidden>
          {isLight ? "🌙" : "☀️"}
        </span>
      </button>
      <button
        type="button"
        className="crm-locked-fab"
        aria-label="Известия"
        onClick={onOpenNotifications}
      >
        <span className="crm-locked-fab__emoji" aria-hidden>
          🔔
        </span>
      </button>
      <button
        type="button"
        className="crm-locked-fab crm-locked-fab--menu"
        aria-label="Отвори меню"
        onClick={onOpenMenu}
      >
        <span className="crm-locked-fab__emoji" aria-hidden>
          ☰
        </span>
      </button>
    </div>
  );
}
