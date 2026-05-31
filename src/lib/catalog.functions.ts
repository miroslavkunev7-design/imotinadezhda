import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getCities = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("cities")
    .select("id, slug, name, name_en, description, hero_image_url, region, population, area_km2, stats, display_order")
    .eq("is_published", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getCityBySlug = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { data: city, error } = await supabaseAdmin
      .from("cities")
      .select("*")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!city) return null;

    const [{ data: quarters }, { data: properties }] = await Promise.all([
      supabaseAdmin
        .from("quarters")
        .select("id, slug, name, description, image_url, avg_price_per_sqm, properties_count, display_order")
        .eq("city_id", city.id)
        .eq("is_published", true)
        .order("display_order"),
      supabaseAdmin
        .from("properties")
        .select("id, title, price, currency, area_sqm, rooms, bedrooms, bathrooms, cover_image_url, is_featured, property_type, status, quarter_id")
        .eq("city_id", city.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);
    return { city, quarters: quarters ?? [], properties: properties ?? [] };
  });

export const getFeaturedProperties = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
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
    return { property, images: images ?? [] };
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
