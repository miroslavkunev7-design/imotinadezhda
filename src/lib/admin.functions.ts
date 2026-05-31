import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "./admin.server";

export const adminListProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("properties")
      .select("id, title, price, currency, is_featured, is_published, property_type, status, created_at, cities:city_id(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListInquiries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("inquiries")
      .select("*, properties:property_id(title)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminGetStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [props, pubProps, feat, inq, newInq, cities] = await Promise.all([
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true }).eq("is_published", true),
      supabaseAdmin.from("properties").select("id", { count: "exact", head: true }).eq("is_featured", true),
      supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabaseAdmin.from("cities").select("id", { count: "exact", head: true }),
    ]);
    return {
      total_properties: props.count ?? 0,
      published_properties: pubProps.count ?? 0,
      featured_properties: feat.count ?? 0,
      total_inquiries: inq.count ?? 0,
      new_inquiries: newInq.count ?? 0,
      total_cities: cities.count ?? 0,
    };
  });

const propertyInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional().nullable(),
  city_id: z.string().uuid(),
  quarter_id: z.string().uuid().optional().nullable(),
  price: z.number().positive(),
  currency: z.string().min(2).max(8).default("EUR"),
  area_sqm: z.number().positive().optional().nullable(),
  rooms: z.number().int().optional().nullable(),
  bedrooms: z.number().int().optional().nullable(),
  bathrooms: z.number().int().optional().nullable(),
  floor: z.number().int().optional().nullable(),
  total_floors: z.number().int().optional().nullable(),
  year_built: z.number().int().optional().nullable(),
  property_type: z.enum(["apartment", "house", "office", "land", "commercial"]),
  status: z.enum(["sale", "rent"]),
  address: z.string().max(300).optional().nullable(),
  cover_image_url: z.string().url().max(1000).optional().nullable(),
  is_featured: z.boolean().default(false),
  is_published: z.boolean().default(true),
});

export const adminUpsertProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => propertyInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const payload = { ...data, created_by: context.userId };
    if (data.id) {
      const { id, ...rest } = payload;
      const { error } = await supabaseAdmin.from("properties").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin.from("properties").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const adminDeleteProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("properties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateInquiryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "in_progress", "closed"]),
      notes: z.string().max(2000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("inquiries").update({ status: data.status, notes: data.notes ?? null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListCitiesFlat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [{ data: cities }, { data: quarters }] = await Promise.all([
      supabaseAdmin.from("cities").select("id, slug, name").order("display_order"),
      supabaseAdmin.from("quarters").select("id, city_id, slug, name").order("display_order"),
    ]);
    return { cities: cities ?? [], quarters: quarters ?? [] };
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data, userId: context.userId };
  });
