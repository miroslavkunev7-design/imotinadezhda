import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/auth/assert-admin";

// ---------------- Page backgrounds (admin-managed, global) ----------------

export const listPageBackgrounds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("page_backgrounds")
      .select("page_key,image_url,updated_at");
    if (error) throw new Error(error.message);
    const map: Record<string, { image_url: string; updated_at: string }> = {};
    for (const row of data ?? []) {
      map[row.page_key] = { image_url: row.image_url, updated_at: row.updated_at };
    }
    return map;
  });

export const setPageBackground = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        page_key: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
        image_url: z.string().url().max(2048),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("page_backgrounds")
      .upsert({ page_key: data.page_key, image_url: data.image_url, updated_by: userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Per-user CRM background ----------------

export const setMyCrmBackground = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ image_url: z.string().url().max(2048).nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ crm_background_url: data.image_url })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Cities / Quarters card images ----------------

export const listCityCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("cities")
      .select("id,name,slug,hero_image_url,is_published,display_order")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listQuarterCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quarters")
      .select("id,name,slug,image_url,is_published,display_order,city_id")
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateCityCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        hero_image_url: z.string().url().max(2048).optional(),
        is_published: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabase } = context;
    const patch: { hero_image_url?: string; is_published?: boolean } = {};
    if (data.hero_image_url !== undefined) patch.hero_image_url = data.hero_image_url;
    if (data.is_published !== undefined) patch.is_published = data.is_published;
    const { error } = await supabase.from("cities").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateQuarterCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        image_url: z.string().url().max(2048).optional(),
        is_published: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabase } = context;
    const patch: { image_url?: string; is_published?: boolean } = {};
    if (data.image_url !== undefined) patch.image_url = data.image_url;
    if (data.is_published !== undefined) patch.is_published = data.is_published;
    const { error } = await supabase.from("quarters").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCityCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabase } = context;
    const { error } = await supabase.from("cities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQuarterCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabase } = context;
    const { error } = await supabase.from("quarters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createCityCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(120),
        slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
        hero_image_url: z.string().url().max(2048).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabase } = context;
    const { error } = await supabase
      .from("cities")
      .insert({ name: data.name, slug: data.slug, hero_image_url: data.hero_image_url ?? null, is_published: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createQuarterCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        city_id: z.string().uuid(),
        name: z.string().min(1).max(120),
        slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
        image_url: z.string().url().max(2048).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabase } = context;
    const { error } = await supabase
      .from("quarters")
      .insert({
        city_id: data.city_id,
        name: data.name,
        slug: data.slug,
        image_url: data.image_url ?? null,
        is_published: true,
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
