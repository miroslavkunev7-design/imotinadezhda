import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PRESETS,
  DEFAULT_TOKENS,
  TOKEN_TO_CSS_VAR,
  type ThemePresets,
  type ThemeTokens,
} from "@/lib/theme/tokens";

export function applyThemeToDocument(tokens: ThemeTokens, presets: ThemePresets) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(TOKEN_TO_CSS_VAR)) {
    const value = tokens[key as keyof ThemeTokens];
    if (typeof value === "string") root.style.setProperty(cssVar, value);
  }
  root.style.setProperty("--font-sans", `"${tokens.fontBody}", system-ui, sans-serif`);
  root.style.setProperty("--font-display", `"${tokens.fontHeading}", serif`);
  root.style.fontSize = `${tokens.fontSizeBase}px`;
  for (const [key, value] of Object.entries(presets)) {
    root.dataset[`preset${key.charAt(0).toUpperCase()}${key.slice(1)}`] = String(value);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("theme_settings")
          .select("tokens, presets")
          .eq("singleton", true)
          .maybeSingle();
        if (cancelled) return;
        const tokens = { ...DEFAULT_TOKENS, ...((data?.tokens as Partial<ThemeTokens>) ?? {}) };
        const presets = { ...DEFAULT_PRESETS, ...((data?.presets as Partial<ThemePresets>) ?? {}) };
        applyThemeToDocument(tokens, presets);
      } catch {
        applyThemeToDocument(DEFAULT_TOKENS, DEFAULT_PRESETS);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    // Live updates: any save broadcasts via storage event.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme_settings_updated") {
        try {
          const payload = JSON.parse(e.newValue ?? "{}");
          if (payload.tokens && payload.presets) {
            applyThemeToDocument(payload.tokens, payload.presets);
          }
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Render immediately — defaults are already in CSS, ThemeProvider just overrides.
  void ready;
  return <>{children}</>;
}

/** Broadcast a theme change to the current tab + other tabs. */
export function broadcastThemeUpdate(tokens: ThemeTokens, presets: ThemePresets) {
  applyThemeToDocument(tokens, presets);
  try {
    localStorage.setItem(
      "theme_settings_updated",
      JSON.stringify({ tokens, presets, at: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}
