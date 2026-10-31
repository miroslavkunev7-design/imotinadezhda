import type { ThemeMode } from "./UtilityDock";

const BG: Record<ThemeMode, string> = {
  dark: "/crm-home-locked/bg-dark.jpg",
  light: "/crm-home-locked/bg-light.jpg",
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
