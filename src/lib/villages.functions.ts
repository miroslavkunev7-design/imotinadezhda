import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/auth/assert-admin";

const OBLAST_LABEL: Record<string, string> = { shumen: "Шумен", varna: "Варна", burgas: "Бургас" };

export type VillageRow = {
  id: string;
  name: string;
  slug: string;
  oblast_slug: string;
  municipality_slug: string | null;
  distance_km: number | null;
  property_count: number;
};

export const getVillagesAround = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ citySlug: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: city, error: cityError } = await supabaseAdmin
      .from("cities")
      .select("slug, name")
      .eq("slug", data.citySlug)
      .eq("is_published", true)
      .maybeSingle();
    if (cityError) throw new Error(cityError.message);
    if (!city) return null;

    const { data: municipalityRows, error: municipalityError } = await supabaseAdmin
      .from("villages")
      .select("id, name, slug, oblast_slug, municipality_slug, distance_km")
      .eq("municipality_slug", data.citySlug)
      .order("distance_km", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (municipalityError) throw new Error(municipalityError.message);

    let rows = municipalityRows ?? [];
    let municipality: string | null = rows.length ? data.citySlug : null;
    if (!rows.length) {
      const { data: oblastRows, error: oblastError } = await supabaseAdmin
        .from("villages")
        .select("id, name, slug, oblast_slug, municipality_slug, distance_km")
        .eq("oblast_slug", data.citySlug)
        .order("distance_km", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (oblastError) throw new Error(oblastError.message);
      rows = oblastRows ?? [];
      municipality = null;
    }

    // Live property counts per village.
    const villageIds = (rows ?? []).map((v) => v.id);
    const countsByVillage = new Map<string, number>();
    if (villageIds.length) {
      const { data: props } = await supabaseAdmin
        .from("properties")
        .select("village_id")
        .eq("is_published", true)
        .in("village_id", villageIds);
      for (const p of props ?? []) {
        if (!p.village_id) continue;
        countsByVillage.set(p.village_id, (countsByVillage.get(p.village_id) ?? 0) + 1);
      }
    }

    const villages: VillageRow[] = (rows ?? []).map((v) => ({
      ...v,
      property_count: countsByVillage.get(v.id) ?? 0,
    }));

    return {
      cityLabel: city.name,
      oblast: rows[0]?.oblast_slug ?? null,
      municipality,
      villages,
    };
  });

// Haversine in km.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function geocodeNominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=bg&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ImotiNadezhda/1.0 (contact: agenciq_nadejdi@abv.bg)" },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr.length) return null;
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  } catch {
    return null;
  }
}

/**
 * Admin-only: backfill lat/lng + distance_km for villages with missing coordinates.
 * Processes up to `limit` villages per call (default 40) to stay within edge timeouts.
 * Call repeatedly until { processed: 0 } is returned.
 */
export const backfillVillageCoords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        oblast: z.enum(["shumen", "varna", "burgas"]).optional(),
        limit: z.number().int().min(1).max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pull city centers for distance calc.
    const { data: cities } = await supabaseAdmin
      .from("cities")
      .select("slug, lat, lng")
      .in("slug", ["shumen", "varna", "burgas"]);
    const cityCenters: Record<string, { lat: number; lng: number }> = {};
    for (const c of cities ?? []) {
      if (c.lat != null && c.lng != null)
        cityCenters[c.slug] = { lat: Number(c.lat), lng: Number(c.lng) };
    }

    let query = supabaseAdmin
      .from("villages")
      .select("id, name, oblast_slug")
      .is("lat", null)
      .limit(data.limit ?? 40);
    if (data.oblast) query = query.eq("oblast_slug", data.oblast);
    const { data: villages, error } = await query;
    if (error) throw new Error(error.message);

    let processed = 0;
    let geocoded = 0;
    for (const v of villages ?? []) {
      const oblastLabel = OBLAST_LABEL[v.oblast_slug] ?? "";
      const center = cityCenters[v.oblast_slug];
      const q = `${v.name}, ${oblastLabel} област, България`;
      const coords = await geocodeNominatim(q);
      processed++;
      if (!coords) {
        // mark as attempted (set distance_km = 9999 to avoid re-trying forever)
        await supabaseAdmin.from("villages").update({ distance_km: 9999 }).eq("id", v.id);
        continue;
      }
      const dist = center ? haversineKm(center.lat, center.lng, coords.lat, coords.lng) : null;
      await supabaseAdmin
        .from("villages")
        .update({
          lat: coords.lat,
          lng: coords.lng,
          distance_km: dist ? Math.round(dist * 10) / 10 : null,
        })
        .eq("id", v.id);
      geocoded++;
      // Respect Nominatim 1 req/sec policy.
      await new Promise((r) => setTimeout(r, 1100));
    }

    // Count remaining
    let remQ = supabaseAdmin
      .from("villages")
      .select("id", { count: "exact", head: true })
      .is("lat", null);
    if (data.oblast) remQ = remQ.eq("oblast_slug", data.oblast);
    const { count: remaining } = await remQ;
    return { processed, geocoded, remaining: remaining ?? 0 };
  });
