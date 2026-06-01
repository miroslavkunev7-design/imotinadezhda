import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function folderPath(year: number, cityName?: string | null, quarterName?: string | null, title?: string | null, id?: string) {
  const safe = (s?: string | null) => (s ?? "—").trim().replace(/[\/\\:*?"<>|]+/g, "-").slice(0, 60);
  return `${year}/${safe(cityName)}/${safe(quarterName)}/${safe(title) || id?.slice(0, 8) || "imot"}`;
}

/** Запазване на extracted listing в archived_properties (само админ). */
export const archiveExtracted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: src, error: srcErr } = await supabase
      .from("extracted_listings")
      .select("*, cities(name), quarters(name)")
      .eq("id", data.id)
      .single();
    if (srcErr || !src) throw new Error(srcErr?.message ?? "Не е намерена обявата");

    const year = new Date().getFullYear();
    const path = folderPath(year, (src as any).cities?.name, (src as any).quarters?.name, src.title, src.id);

    const { data: inserted, error } = await supabase
      .from("archived_properties")
      .insert({
        source_extracted_id: src.id,
        source_url: src.source_url,
        source: src.source,
        title: src.title ?? "Без заглавие",
        description: src.description,
        city_id: src.city_id,
        quarter_id: src.quarter_id,
        property_type: src.property_type,
        price: src.price,
        currency: src.currency ?? "EUR",
        area_sqm: src.area_sqm,
        rooms: src.rooms,
        bedrooms: src.bedrooms,
        contact_name: src.contact_name,
        phone: src.phone,
        seller_type: src.seller_type,
        images: src.images ?? [],
        raw_data: src.raw_data,
        drive_folder_path: path,
        archived_year: year,
        archived_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id, drive_folder_path: path };
  });

/** Списък архивирани имоти с филтри. */
export const listArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { city_id?: string; quarter_id?: string; year?: number; search?: string }) =>
    z.object({
      city_id: z.string().uuid().optional(),
      quarter_id: z.string().uuid().optional(),
      year: z.number().int().optional(),
      search: z.string().max(200).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("archived_properties")
      .select("*, cities(name), quarters(name)")
      .order("archived_at", { ascending: false })
      .limit(500);
    if (data.city_id) q = q.eq("city_id", data.city_id);
    if (data.quarter_id) q = q.eq("quarter_id", data.quarter_id);
    if (data.year) q = q.eq("archived_year", data.year);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Изтриване от архива. */
export const deleteArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("archived_properties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
