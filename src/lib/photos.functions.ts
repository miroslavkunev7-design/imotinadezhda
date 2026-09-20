// Автоматизация №12 — API слой (typed RPC) за модула „AI Обработка на снимки“.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

const ASSET_SELECT =
  "id, created_at, updated_at, property_id, source_image_id, source_url, preset_code, kind, version, result_url, storage_path, width, height, bytes, status, quality_score, issues, ai_used, provider, model, duration_ms, error, applied_at, approved_at, properties:property_id(id, title, price, currency, cover_image_url, is_published, cities:city_id(name), quarters:quarter_id(name))";

export const listPhotoAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { status?: string; kind?: string; propertyId?: string } | undefined) => d ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("photo_assets")
      .select(ASSET_SELECT)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.propertyId) q = q.eq("property_id", data.propertyId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listPhotoPresetsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getPhotoPresets } = await import("@/lib/photos.server");
    return getPhotoPresets();
  });

/** Имоти + техните оригинални снимки (за избор в дашборда). */
export const listPhotoSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const [{ data: props, error: pErr }, { data: imgs, error: iErr }] = await Promise.all([
      db
        .from("properties")
        .select(
          "id, title, price, currency, cover_image_url, is_published, updated_at, cities:city_id(name), quarters:quarter_id(name)",
        )
        .order("updated_at", { ascending: false })
        .limit(200),
      db
        .from("property_images")
        .select("id, url, property_id, is_cover, display_order")
        .order("display_order", { ascending: true })
        .limit(1000),
    ]);
    if (pErr) throw new Error(pErr.message);
    if (iErr) throw new Error(iErr.message);
    const byProp = new Map<string, any[]>();
    for (const img of imgs ?? []) {
      const list = byProp.get(img.property_id) ?? [];
      if (!String(img.url).includes("/ai/")) list.push(img);
      byProp.set(img.property_id, list);
    }
    return (props ?? []).map((p: any) => ({ ...p, images: byProp.get(p.id) ?? [] }));
  });

export const listPhotoEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("photo_events")
      .select(
        "id, created_at, action, status, message, actor, property_id, properties:property_id(id, title)",
      )
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPhotoConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getPhotoSettings, getPhotoJobState } = await import("@/lib/photos.server");
    return { settings: await getPhotoSettings(), job: await getPhotoJobState() };
  });

export const savePhotoConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { savePhotoSettings } = await import("@/lib/photos.server");
    return savePhotoSettings(data as any);
  });

export const getPhotoAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getPhotoAnalytics } = await import("@/lib/photos.server");
    return getPhotoAnalytics();
  });

export const processPhotoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      propertyId: string;
      sourceUrl: string;
      sourceImageId?: string | null;
      presetCode?: string;
      extraPrompt?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { processPhoto } = await import("@/lib/photos.server");
    return processPhoto({
      propertyId: data.propertyId,
      sourceUrl: data.sourceUrl,
      sourceImageId: data.sourceImageId ?? null,
      presetCode: data.presetCode,
      extraPrompt: data.extraPrompt ?? null,
      actor: actorEmail(context.claims) ?? "crm",
      createdBy: context.userId,
    });
  });

export const queuePhotosFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      items: Array<{ propertyId: string; sourceUrl: string; sourceImageId?: string | null }>;
      presetCode?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { queuePhotos } = await import("@/lib/photos.server");
    return queuePhotos({
      items: data.items,
      presetCode: data.presetCode,
      requestedBy: context.userId,
    });
  });

export const setPhotoStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assetId: string; status: "ready" | "approved" | "rejected" }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { setPhotoStatus } = await import("@/lib/photos.server");
    return setPhotoStatus({
      ...data,
      actor: actorEmail(context.claims) ?? "crm",
      userId: context.userId,
    });
  });

export const applyPhotoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assetId: string; asCover?: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { applyPhoto } = await import("@/lib/photos.server");
    return applyPhoto({
      assetId: data.assetId,
      asCover: data.asCover,
      actor: actorEmail(context.claims) ?? "crm",
    });
  });

export const deletePhotoAssetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assetId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { deletePhotoAsset } = await import("@/lib/photos.server");
    return deletePhotoAsset({ assetId: data.assetId, actor: actorEmail(context.claims) ?? "crm" });
  });

export const runPhotoQueueNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runPhotoQueue } = await import("@/lib/photos.server");
    return runPhotoQueue(data.limit);
  });

export const resumePhotoJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumePhotoJob } = await import("@/lib/photos.server");
    return resumePhotoJob();
  });
