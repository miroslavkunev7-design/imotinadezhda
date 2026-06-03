import { useEffect, useState } from "react";

import logoScrollBanner from "@/assets/logo-scroll-banner.png";

export type LogoSettings = {
  src: string;
  top: number;   // px
  left: number;  // px
  height: number; // px
};

const KEY = "ildja:logo-settings:v1";

export const defaultLogoSettings: LogoSettings = {
  src: logoScrollBanner,
  top: 0,
  left: 0,
  height: 220,
};

function read(): LogoSettings {
  if (typeof window === "undefined") return defaultLogoSettings;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultLogoSettings;
    const parsed = JSON.parse(raw) as Partial<LogoSettings>;
    return { ...defaultLogoSettings, ...parsed };
  } catch {
    return defaultLogoSettings;
  }
}

const EVENT = "ildja:logo-settings-changed";

export function useLogoSettings() {
  const [settings, setSettings] = useState<LogoSettings>(defaultLogoSettings);

  useEffect(() => {
    setSettings(read());
    const onChange = () => setSettings(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = (patch: Partial<LogoSettings>) => {
    const next = { ...read(), ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
    setSettings(next);
  };

  const reset = () => {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
    setSettings(defaultLogoSettings);
  };

  return { settings, update, reset };
}
