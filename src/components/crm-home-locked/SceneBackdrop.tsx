import type { ThemeMode } from "./UtilityDock";

const BG: Record<ThemeMode, string> = {
  dark: "/crm-home-locked/bg-dark.jpg",
  /* Warm-wood villa LEFT + pool/garden RIGHT (deep dusk grade via CSS) */
  light: "/crm-home-locked/bg-light-wood-left.jpg",
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
