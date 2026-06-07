import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type CrmTheme = {
  preset?: string;
  surface: string;
  surfaceTo: string;
  accent: string;
  accentSoft: string;
  text: string;
  textMuted: string;
  border: string;
  // Optional fine-grained tokens (AI-настройваеми)
  sidebar?: string;
  sidebarTo?: string;
  sidebarText?: string;
  sidebarBorder?: string;
  heading?: string;
  heroBg?: string;
  fontFamily?: string;
};

export const CRM_THEME_PRESETS: Record<string, CrmTheme> = {
  burgundy: {
    preset: "burgundy",
    surface: "#1a0608",
    surfaceTo: "#3a0a12",
    accent: "#c9a04c",
    accentSoft: "rgba(201,160,76,0.18)",
    text: "#fde7b3",
    textMuted: "rgba(253,231,179,0.7)",
    border: "rgba(201,160,76,0.25)",
  },
  midnight: {
    preset: "midnight",
    surface: "#0b1220",
    surfaceTo: "#111e3a",
    accent: "#60a5fa",
    accentSoft: "rgba(96,165,250,0.18)",
    text: "#e2e8f0",
    textMuted: "rgba(226,232,240,0.7)",
    border: "rgba(96,165,250,0.25)",
  },
  forest: {
    preset: "forest",
    surface: "#06160f",
    surfaceTo: "#0d2e20",
    accent: "#34d399",
    accentSoft: "rgba(52,211,153,0.18)",
    text: "#d1fae5",
    textMuted: "rgba(209,250,229,0.7)",
    border: "rgba(52,211,153,0.25)",
  },
  royal: {
    preset: "royal",
    surface: "#140820",
    surfaceTo: "#2a1248",
    accent: "#c084fc",
    accentSoft: "rgba(192,132,252,0.18)",
    text: "#ede9fe",
    textMuted: "rgba(237,233,254,0.7)",
    border: "rgba(192,132,252,0.25)",
  },
  light: {
    preset: "light",
    surface: "#fdfaf5",
    surfaceTo: "#f5ede0",
    accent: "#8B1A2B",
    accentSoft: "rgba(139,26,43,0.12)",
    text: "#3a1a08",
    textMuted: "rgba(58,26,8,0.7)",
    border: "rgba(139,26,43,0.2)",
  },
  graphite: {
    preset: "graphite",
    surface: "#111111",
    surfaceTo: "#2a2a2a",
    accent: "#f59e0b",
    accentSoft: "rgba(245,158,11,0.18)",
    text: "#fafafa",
    textMuted: "rgba(250,250,250,0.65)",
    border: "rgba(245,158,11,0.25)",
  },
};

export const DEFAULT_CRM_THEME = CRM_THEME_PRESETS.burgundy;

export function useCrmTheme() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<CrmTheme>(DEFAULT_CRM_THEME);
  const [loaded, setLoaded] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }
    supabase
      .from("profiles")
      .select("crm_theme")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const raw = (data?.crm_theme ?? {}) as Partial<CrmTheme> & { preset?: string };
        if (raw && Object.keys(raw).length > 0) {
          const base = raw.preset && CRM_THEME_PRESETS[raw.preset] ? CRM_THEME_PRESETS[raw.preset] : DEFAULT_CRM_THEME;
          setTheme({ ...base, ...raw } as CrmTheme);
        } else {
          setTheme(DEFAULT_CRM_THEME);
        }
        setLoaded(true);
      });
  }, [user, reloadTick]);

  useEffect(() => {
    const handler = () => setReloadTick((t) => t + 1);
    window.addEventListener("crm-theme-changed", handler);
    return () => window.removeEventListener("crm-theme-changed", handler);
  }, []);

  const save = useCallback(
    async (next: CrmTheme) => {
      setTheme(next);
      if (!user) return;
      await supabase.from("profiles").update({ crm_theme: next as any }).eq("id", user.id);
    },
    [user],
  );

  return { theme, setTheme: save, loaded };
}

export function crmThemeStyle(t: CrmTheme): React.CSSProperties {
  return {
    // Expose as CSS variables so any nested element can opt in
    ["--crm-surface" as any]: t.surface,
    ["--crm-surface-to" as any]: t.surfaceTo,
    ["--crm-accent" as any]: t.accent,
    ["--crm-accent-soft" as any]: t.accentSoft,
    ["--crm-text" as any]: t.text,
    ["--crm-text-muted" as any]: t.textMuted,
    ["--crm-border" as any]: t.border,
  };
}
