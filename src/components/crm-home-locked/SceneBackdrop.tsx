import type { ThemeMode } from "./UtilityDock";

const BG: Record<ThemeMode, string> = {
  dark: "/crm-home-locked/bg-dark.jpg",
  /* Deep-blue dusk, house LEFT — cards sit on garden/pool to the right */
  light: "/crm-home-locked/bg-light-dusk-left.jpg",
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
