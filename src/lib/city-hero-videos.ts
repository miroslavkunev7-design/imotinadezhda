export type CityHeroVideoSources = {
  mp4: string;
  webm?: string;
  /** Smaller legacy clip if 2026 CDN asset fails. */
  legacyMp4?: string;
};

/** Same-origin 4K loops in /public/clips — Lovable /__l5e masters currently 404. */
export const CITY_HERO_VIDEOS: Record<string, CityHeroVideoSources> = {
  burgas: { mp4: "/clips/burgas-hero-4k.mp4" },
  varna: { mp4: "/clips/varna-hero-4k.mp4" },
  shumen: { mp4: "/clips/shumen-hero-4k.mp4" },
  "novi-pazar": { mp4: "/clips/novi-pazar-hero-4k.mp4" },
};

export function getCityHeroVideo(slug: string): CityHeroVideoSources | null {
  return CITY_HERO_VIDEOS[slug] ?? null;
}

/** Primary mp4: skip dead Lovable /__l5e URLs so the page never waits on a 404. */
export function resolveCityHeroMp4(slug: string, dbUrl?: string | null): string {
  const bundled = getCityHeroVideo(slug);
  const local = bundled?.mp4 ?? bundled?.legacyMp4 ?? "";
  const db = dbUrl?.trim();
  if (db && !db.includes("/__l5e/")) return db;
  return local;
}

export function resolveCityHeroWebm(slug: string): string | undefined {
  return getCityHeroVideo(slug)?.webm;
}

export function resolveCityHeroLegacyMp4(slug: string): string | undefined {
  return getCityHeroVideo(slug)?.legacyMp4;
}

/** @deprecated Use resolveCityHeroMp4 — kept for existing imports. */
export const cityVideoFallbacks: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_HERO_VIDEOS).map(([slug, sources]) => [slug, sources.mp4]),
);
