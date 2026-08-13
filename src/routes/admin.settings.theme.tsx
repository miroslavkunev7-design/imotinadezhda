import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Palette, Save, RotateCcw, Loader2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ColorTokenGrid } from "@/components/admin/theme/color-token-grid";
import { PresetPicker } from "@/components/admin/theme/preset-picker";
import { DevicePreview } from "@/components/admin/theme/device-preview";

import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PRESETS,
  DEFAULT_TOKENS,
  FONT_OPTIONS,
  type ThemePresets,
  type ThemeTokens,
} from "@/lib/theme/tokens";
import { broadcastThemeUpdate } from "@/components/theme-provider";
import { saveTheme } from "@/lib/theme/theme.functions";

export const Route = createFileRoute("/admin/settings/theme")({ component: Page });

function Page() {
  const save = useServerFn(saveTheme);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["theme_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("theme_settings")
        .select("tokens, presets")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return {
        tokens: { ...DEFAULT_TOKENS, ...((data?.tokens as Partial<ThemeTokens>) ?? {}) } as ThemeTokens,
        presets: { ...DEFAULT_PRESETS, ...((data?.presets as Partial<ThemePresets>) ?? {}) } as ThemePresets,
      };
    },
  });

  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_TOKENS);
  const [presets, setPresets] = useState<ThemePresets>(DEFAULT_PRESETS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setTokens(data.tokens);
      setPresets(data.presets);
    }
  }, [data]);

  // Live apply on every change (no save needed for preview).
  useEffect(() => {
    broadcastThemeUpdate(tokens, presets);
  }, [tokens, presets]);

  async function handleSave() {
    setSaving(true);
    try {
      await save({ data: { tokens, presets } });
      toast.success("Темата е запазена и е приложена на целия сайт.");
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Грешка при запазване";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setTokens(DEFAULT_TOKENS);
    setPresets(DEFAULT_PRESETS);
    toast.info("Възстановени са оригиналните цветове. Натисни Запази, за да приложиш.");
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
              <Palette className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-amber-100">Дизайн на CRM</h1>
              <p className="text-sm text-amber-100/60">
                Цветове, шрифтове и дизайн пресети за целия сайт и CRM.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-amber-500/30 bg-transparent text-amber-100 hover:bg-amber-500/10"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Възстанови
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || isLoading}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Запази темата
            </Button>
          </div>
        </div>

        <Tabs defaultValue="colors" className="w-full">
          <TabsList className="bg-[rgba(20,4,8,0.55)]">
            <TabsTrigger value="colors">Цветове и шрифтове</TabsTrigger>
            <TabsTrigger value="presets">Дизайн пресети</TabsTrigger>
            <TabsTrigger value="preview">Responsive Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="colors" className="space-y-4 pt-4">
            <div className="rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.4)] p-4">
              <h2 className="mb-3 font-display text-lg text-amber-100">Цветове</h2>
              <p className="mb-3 text-xs text-amber-100/60">
                Промените се прилагат веднага. Натисни „Запази темата", за да ги направиш постоянни за всички.
                Auto-contrast гарантира че текстът никога няма да изчезне на фона.
              </p>
              <ColorTokenGrid tokens={tokens} onChange={setTokens} />
            </div>

            <div className="rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.4)] p-4">
              <h2 className="mb-3 font-display text-lg text-amber-100">Шрифтове</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-amber-100/80">Шрифт за заглавия</Label>
                  <select
                    value={tokens.fontHeading}
                    onChange={(e) => setTokens({ ...tokens, fontHeading: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-amber-500/30 bg-black/30 px-3 py-2 text-sm text-amber-100"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f} className="bg-black">
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-amber-100/80">Шрифт за текст</Label>
                  <select
                    value={tokens.fontBody}
                    onChange={(e) => setTokens({ ...tokens, fontBody: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-amber-500/30 bg-black/30 px-3 py-2 text-sm text-amber-100"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f} className="bg-black">
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-amber-100/80">
                    Размер на основния текст ({tokens.fontSizeBase}px)
                  </Label>
                  <input
                    type="range"
                    min={12}
                    max={20}
                    step={1}
                    value={tokens.fontSizeBase}
                    onChange={(e) =>
                      setTokens({ ...tokens, fontSizeBase: Number(e.target.value) })
                    }
                    className="mt-3 w-full accent-amber-400"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="presets" className="pt-4">
            <div className="rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.4)] p-4">
              <PresetPicker presets={presets} onChange={setPresets} />
            </div>
          </TabsContent>

          <TabsContent value="preview" className="pt-4">
            <div className="rounded-2xl border border-amber-500/25 bg-[rgba(20,4,8,0.4)] p-4">
              <DevicePreview />
            </div>
          </TabsContent>
        </Tabs>
    </div>
  );
}
