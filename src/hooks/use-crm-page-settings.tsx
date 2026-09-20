import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DEFAULT_PAGE_SETTINGS,
  mergeSettings,
  pageKeyFromPath,
  type PageSettings,
} from "@/lib/crm-page-settings/types";
import { looseDb } from "@/lib/supabase-loose-db";

type Ctx = {
  pageKey: string;
  settings: PageSettings;
  /** Локална (жива) промяна — още не е записана. */
  patch: (fn: (s: PageSettings) => PageSettings) => void;
  save: () => Promise<void>;
  saveGlobal: () => Promise<void>;
  reset: () => Promise<void>;
  /** Изчиства само подредбата/размерите и добавените блокчета. */
  resetBlocksOnly: () => void;
  discard: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  loaded: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  previewMode: boolean;
  setPreviewMode: (v: boolean) => void;
};

const PageSettingsContext = createContext<Ctx | null>(null);

export function CrmPageSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const pageKey = pageKeyFromPath(path);

  const [saved, setSaved] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  // История за Undo/Redo (само в паметта, до 50 стъпки).
  const [past, setPast] = useState<PageSettings[]>([]);
  const [future, setFuture] = useState<PageSettings[]>([]);

  const clearHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  // Зареждане: първо глобалните (за екипа), после личните отгоре.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setDirty(false);
    setEditMode(false);
    setPreviewMode(false);
    setPast([]);
    setFuture([]);
    (async () => {
      const { data } = await looseDb(supabase)
        .from("crm_page_customizations")
        .select("settings, scope")
        .eq("page_key", pageKey);
      if (cancelled) return;
      const global = data?.find((r) => r.scope === "global")?.settings;
      const own = data?.find((r) => r.scope === "user")?.settings;
      const base = mergeSettings(global);
      const next = own ? mergeSettings({ ...(base as object), ...(own as object) }) : base;
      setSaved(next);
      setSettings(next);
      setLoaded(true);
    })().catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [pageKey, user?.id]);

  const patch = useCallback((fn: (s: PageSettings) => PageSettings) => {
    setSettings((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      setPast((h) => [...h, prev].slice(-50));
      setFuture([]);
      return next;
    });
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    setPast((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1]!;
      setSettings((cur) => {
        setFuture((f) => [cur, ...f].slice(0, 50));
        return prev;
      });
      setDirty(true);
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0]!;
      setSettings((cur) => {
        setPast((h) => [...h, cur].slice(-50));
        return next;
      });
      setDirty(true);
      return f.slice(1);
    });
  }, []);

  const save = useCallback(async () => {
    if (!user) throw new Error("Няма влязъл потребител");
    // Частичният уникален индекс (scope='user') не позволява ON CONFLICT,
    // затова записваме ръчно: select → update / insert.
    const { data: existing, error: selErr } = await looseDb(supabase)
      .from("crm_page_customizations")
      .select("id")
      .eq("user_id", user.id)
      .eq("page_key", pageKey)
      .eq("scope", "user")
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    const { error } = existing
      ? await looseDb(supabase)
          .from("crm_page_customizations")
          .update({ settings: settings as never })
          .eq("id", existing.id)
      : await looseDb(supabase)
          .from("crm_page_customizations")
          .insert({
            user_id: user.id,
            page_key: pageKey,
            scope: "user",
            settings: settings as never,
          });
    if (error) {
      console.error("[CRM settings] save failed", error);
      throw new Error(error.message);
    }
    setSaved(settings);
    setDirty(false);
  }, [pageKey, settings, user]);

  const saveGlobal = useCallback(async () => {
    const { data: existing } = await looseDb(supabase)
      .from("crm_page_customizations")
      .select("id")
      .eq("page_key", pageKey)
      .eq("scope", "global")
      .maybeSingle();
    const { error } = existing
      ? await looseDb(supabase)
          .from("crm_page_customizations")
          .update({ settings: settings as never })
          .eq("id", existing.id)
      : await looseDb(supabase)
          .from("crm_page_customizations")
          .insert({ page_key: pageKey, scope: "global", settings: settings as never });
    if (error) throw new Error(error.message);
    setSaved(settings);
    setDirty(false);
  }, [pageKey, settings]);

  const reset = useCallback(async () => {
    if (user) {
      await looseDb(supabase)
        .from("crm_page_customizations")
        .delete()
        .eq("user_id", user.id)
        .eq("page_key", pageKey);
    }
    setSaved(DEFAULT_PAGE_SETTINGS);
    setSettings(DEFAULT_PAGE_SETTINGS);
    setDirty(false);
    clearHistory();
  }, [clearHistory, pageKey, user]);

  const resetBlocksOnly = useCallback(() => {
    patch((s) => ({ ...s, blocks: {}, custom: [] }));
  }, [patch]);

  const discard = useCallback(() => {
    setSettings(saved);
    setDirty(false);
    clearHistory();
  }, [clearHistory, saved]);

  const value = useMemo<Ctx>(
    () => ({
      pageKey,
      settings,
      patch,
      save,
      saveGlobal,
      reset,
      resetBlocksOnly,
      discard,
      undo,
      redo,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      dirty,
      loaded,
      editMode,
      setEditMode,
      previewMode,
      setPreviewMode,
    }),
    [
      pageKey,
      settings,
      patch,
      save,
      saveGlobal,
      reset,
      resetBlocksOnly,
      discard,
      undo,
      redo,
      past.length,
      future.length,
      dirty,
      loaded,
      editMode,
      previewMode,
    ],
  );

  return <PageSettingsContext.Provider value={value}>{children}</PageSettingsContext.Provider>;
}

export function useCrmPageSettings(): Ctx {
  const ctx = useContext(PageSettingsContext);
  if (!ctx) throw new Error("useCrmPageSettings must be used inside CrmPageSettingsProvider");
  return ctx;
}

/**
 * Стил за фоновата снимка: „cover“/„contain“/повторение + увеличение (zoom)
 * и точна позиция по X/Y, без никакви ефекти върху самата снимка.
 */
export function pageBackgroundStyle(s: PageSettings, url: string): React.CSSProperties {
  const fit = s.bg.repeat ? "repeat" : s.bg.fit;
  const zoom = Math.max(100, s.bg.zoom || 100);
  const size =
    fit === "repeat" ? "auto" : fit === "contain" ? `${zoom}% auto` : `${zoom}% ${zoom}%`;
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: size,
    backgroundRepeat: fit === "repeat" ? "repeat" : "no-repeat",
    backgroundPosition: `${s.bg.posX}% ${s.bg.posY}%`,
    backgroundAttachment: "fixed",
  };
}

/** CSS променливи, които се прилагат върху обвивката на съдържанието. */
export function pageSettingsStyle(s: PageSettings): React.CSSProperties {
  const style: Record<string, string> = {
    "--crm-readable-bg": s.colors.panel,
    "--crm-readable-bg-strong": s.colors.panel,
    "--crm-readable-bg-alt": s.colors.panel,
    "--crm-readable-text": s.colors.text,
    "--crm-readable-header": s.colors.heading,
    "--crm-readable-header-text": s.colors.accentText,
    "--crm-readable-border": s.colors.border,
    "--crm-readable-muted": s.colors.optionText,
    "--crm-panel": s.colors.panel,
    "--crm-panel-strong": s.colors.panel,
    "--crm-border": s.colors.border,
    "--crm-accent": s.colors.accent,
    "--crm-text": s.colors.text,
    "--card": s.colors.panel,
    "--card-foreground": s.colors.text,
    "--primary": s.colors.accent,
    "--primary-foreground": s.colors.accentText,
    "--border": s.colors.border,
    "--radius": `${s.fonts.radius}px`,
    "--font-display": `"${s.fonts.heading}", serif`,
    "--font-sans": `"${s.fonts.body}", ui-sans-serif, system-ui`,
    fontSize: `${s.fonts.sizeBase}px`,
  };
  return style as React.CSSProperties;
}
