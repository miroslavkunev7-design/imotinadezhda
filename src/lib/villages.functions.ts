import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Mapping: city slug → which oblast / municipality to query.
const CITY_TO_OBLAST: Record<string, { oblast: string; municipality?: string; label: string }> = {
  shumen: { oblast: "shumen", label: "Шумен" },
  varna: { oblast: "varna", label: "Варна" },
  burgas: { oblast: "burgas", label: "Бургас" },
  "novi-pazar": { oblast: "shumen", municipality: "novi-pazar", label: "Нови пазар" },
};

export type VillageRow = { id: string; name: string; slug: string; oblast_slug: string; municipality_slug: string | null };

export const getVillagesAround = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ citySlug: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const cfg = CITY_TO_OBLAST[data.citySlug];
    if (!cfg) return { cityLabel: data.citySlug, oblast: null, municipality: null, villages: [] as VillageRow[] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("villages")
      .select("id, name, slug, oblast_slug, municipality_slug")
      .eq("oblast_slug", cfg.oblast)
      .order("name", { ascending: true });
    if (cfg.municipality) q = q.eq("municipality_slug", cfg.municipality);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return {
      cityLabel: cfg.label,
      oblast: cfg.oblast,
      municipality: cfg.municipality ?? null,
      villages: (rows ?? []) as VillageRow[],
    };
  });
