import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { safeAdmin } from "@/integrations/supabase/safe-admin";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getCities = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await safeAdmin
    .from("cities")
    .eq("is_published", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const CITY_OBLAST: Record<string, { oblast: string; municipality?: string }> = {
  shumen: { oblast: "shumen" },
  varna: { oblast: "varna" },
  burgas: { oblast: "burgas" },
  "novi-pazar": { oblast: "shumen", municipality: "novi-pazar" },
};

export const getCityBySlug = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { data: city, error } = await safeAdmin
      .from("cities")
      .select("*")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!city) return null;

    const [{ data: quarters }, { data: properties }, { data: liveProps }] = await Promise.all([
      safeAdmin
        .from("quarters")
        .select("id, slug, name, description, image_url, avg_price_per_sqm, properties_count, display_order")
        .eq("city_id", city.id)
        .eq("is_published", true)
        .order("display_order"),
      safeAdmin
        .from("properties")
        .select("id, title, price, currency, area_sqm, rooms, bedrooms, bathrooms, cover_image_url, is_featured, property_type, status, quarter_id")
        .eq("city_id", city.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(12),
      safeAdmin
        .from("properties")
        .select("quarter_id")
        .eq("city_id", city.id)
        .eq("is_published", true),
    ]);

    // Live per-quarter counts
    const countsByQuarterId = new Map<string, number>();
    for (const p of liveProps ?? []) {
      if (!p.quarter_id) continue;
      countsByQuarterId.set(p.quarter_id, (countsByQuarterId.get(p.quarter_id) ?? 0) + 1);
    }
    const quarterCounts: Record<string, number> = {};
    for (const q of quarters ?? []) {
      quarterCounts[q.slug] = countsByQuarterId.get(q.id) ?? 0;
    }

    // Live "around" count — properties tied to a village in this city's oblast
    let aroundCount = 0;
    const cfg = CITY_OBLAST[data.slug];
    if (cfg) {
      let vq = safeAdmin.from("villages").select("id").eq("oblast_slug", cfg.oblast);
      if (cfg.municipality) vq = vq.eq("municipality_slug", cfg.municipality);
      const { data: villageRows } = await vq;
      const villageIds = (villageRows ?? []).map((v) => v.id);
      if (villageIds.length) {
        const { count } = await safeAdmin
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("is_published", true)
          .in("village_id", villageIds);
        aroundCount = count ?? 0;
      }
    }

    const quartersWithLiveCounts = (quarters ?? []).map((q) => ({
      ...q,
      properties_count: quarterCounts[q.slug] ?? 0,
    }));

    return {
      city,
      quarters: quartersWithLiveCounts,
      properties: properties ?? [],
      quarterCounts,
      aroundCount,
      activePropertiesTotal: (liveProps ?? []).length,
    };
  });


export const getFeaturedProperties = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await safeAdmin
    .from("properties")
    .select("id, title, price, currency, area_sqm, rooms, bedrooms, bathrooms, cover_image_url, property_type, status, city_id, cities:city_id(name, slug)")
    .eq("is_published", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getPropertyById = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: property, error } = await supabaseAdmin
      .from("properties")
      .select("*, cities:city_id(name, slug), quarters:quarter_id(name, slug)")
      .eq("id", data.id)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!property) return null;
    const { data: images } = await supabaseAdmin
      .from("property_images")
      .select("id, url, is_cover, display_order")
      .eq("property_id", property.id)
      .order("display_order");
    // Resolve broker: prefer explicit broker_id, fall back to the uploader
    // (created_by → brokers.user_id) for legacy rows.
    let broker: { id: string; full_name: string; email: string | null; phone: string | null; photo_url: string | null } | null = null;
    const brokerId = (property as any).broker_id as string | null | undefined;
    const createdBy = (property as any).created_by as string | null | undefined;
    if (brokerId) {
      const { data: b } = await supabaseAdmin
        .from("brokers")
        .select("id, full_name, email, phone, photo_url")
        .eq("id", brokerId)
        .maybeSingle();
      if (b) broker = b;
    }
    if (!broker && createdBy) {
      const { data: b } = await supabaseAdmin
        .from("brokers")
        .select("id, full_name, email, phone, photo_url")
        .eq("user_id", createdBy)
        .eq("is_active", true)
        .maybeSingle();
      if (b) broker = b;
    }
    return { property, images: images ?? [], broker };
  });


export const submitInquiry = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        property_id: z.string().uuid().optional().nullable(),
        name: z.string().min(2).max(120),
        email: z.string().email().max(200),
        phone: z.string().max(40).optional(),
        message: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("inquiries").insert({
      property_id: data.property_id ?? null,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      message: data.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getQuarterBySlug = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ citySlug: z.string().min(1).max(64), quarterSlug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { data: city } = await supabaseAdmin
      .from("cities").select("id, slug, name").eq("slug", data.citySlug).maybeSingle();
    if (!city) return null;
    const { data: quarter } = await supabaseAdmin
      .from("quarters").select("*").eq("city_id", city.id).eq("slug", data.quarterSlug).maybeSingle();
    if (!quarter) return null;
    const [{ data: properties }, { data: gallery }] = await Promise.all([
      supabaseAdmin
        .from("properties")
        .select("id, title, price, currency, area_sqm, rooms, bedrooms, bathrooms, cover_image_url, property_type, status, is_featured")
        .eq("quarter_id", quarter.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("quarter_images")
        .select("id, url, is_cover, display_order")
        .eq("quarter_id", quarter.id)
        .order("display_order"),
    ]);
    return { city, quarter, properties: properties ?? [], gallery: gallery ?? [] };
  });

export const searchProperties = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({
      city_slug: z.string().max(64).optional().nullable(),
      quarter_slug: z.string().max(64).optional().nullable(),
      property_type: z.string().max(32).optional().nullable(),
      status: z.enum(["sale", "rent"]).optional().nullable(),
      price_min: z.coerce.number().nonnegative().optional().nullable(),
      price_max: z.coerce.number().nonnegative().optional().nullable(),
      area_min: z.coerce.number().nonnegative().optional().nullable(),
      area_max: z.coerce.number().nonnegative().optional().nullable(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    let cityId: string | null = null;
    let quarterId: string | null = null;
    if (data.city_slug) {
      const { data: c } = await supabaseAdmin.from("cities").select("id").eq("slug", data.city_slug).maybeSingle();
      cityId = c?.id ?? null;
    }
    if (data.quarter_slug && cityId) {
      const { data: q } = await supabaseAdmin.from("quarters").select("id").eq("city_id", cityId).eq("slug", data.quarter_slug).maybeSingle();
      quarterId = q?.id ?? null;
    }
    let q = supabaseAdmin
      .from("properties")
      .select("id, title, price, currency, area_sqm, rooms, bedrooms, bathrooms, cover_image_url, property_type, status, cities:city_id(name, slug)")
      .eq("is_published", true);
    if (cityId) q = q.eq("city_id", cityId);
    if (quarterId) q = q.eq("quarter_id", quarterId);
    if (data.property_type) q = q.eq("property_type", data.property_type as any);
    if (data.status) q = q.eq("status", data.status);
    if (data.price_min != null) q = q.gte("price", data.price_min);
    if (data.price_max != null) q = q.lte("price", data.price_max);
    if (data.area_min != null) q = q.gte("area_sqm", data.area_min);
    if (data.area_max != null) q = q.lte("area_sqm", data.area_max);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(60);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getQuartersByCity = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ city_slug: z.string().max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { data: c } = await supabaseAdmin.from("cities").select("id").eq("slug", data.city_slug).maybeSingle();
    if (!c) return [];
    const { data: rows } = await supabaseAdmin
      .from("quarters")
      .select("id, slug, name")
      .eq("city_id", c.id)
      .eq("is_published", true)
      .order("display_order");
    return rows ?? [];
  });
