import type { ThemeMode } from "./UtilityDock";

const BG: Record<ThemeMode, string> = {
  dark: "/crm-home-locked/bg-dark.jpg",
  /* House on LEFT so 2×2 cards on the right don't cover the villa */
  light: "/crm-home-locked/bg-light-house-left.jpg",
};

export function SceneBackdrop({ theme }: { theme: ThemeMode }) {
  const url = BG[theme];

  return (
    <img
      key={`bg-${theme}`}
      src={url}
      alt=""
      className="crm-locked-fallback-bg"
      data-theme-bg={theme}
      decoding="async"
      fetchPriority="high"
    />
  );
}
