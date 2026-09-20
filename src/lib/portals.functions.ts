// Автоматизация №7 — API слой (typed RPC) за модула „Портали“.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const listPortalsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listPortals } = await import("@/lib/portals.server");
    return listPortals();
  });

export const listPortalListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; portalId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("portal_listings")
      .select(
        "id, created_at, updated_at, status, external_id, external_url, ai_title, ai_used, price_at_publish, attempts, last_error, published_at, last_synced_at, portal_id, property_id, listing_portals:portal_id(name, code, kind), properties:property_id(id, title, price, currency, status, is_published, cover_image_url, cities:city_id(name))",
      )
      .order("updated_at", { ascending: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    if (data.portalId) q = q.eq("portal_id", data.portalId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listPortalLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("portal_sync_log")
      .select(
        "id, created_at, action, status, http_status, message, duration_ms, listing_portals:portal_id(name), properties:property_id(title)",
      )
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPortalsConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getPortalSettings, getPortalJobState } = await import("@/lib/portals.server");
    return { settings: await getPortalSettings(), job: await getPortalJobState() };
  });

export const savePortalsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        enabled: z.boolean().optional(),
        ai_enabled: z.boolean().optional(),
        auto_queue: z.boolean().optional(),
        auto_remove_sold: z.boolean().optional(),
        require_cover_image: z.boolean().optional(),
        batch_size: z.number().int().min(1).max(100).optional(),
        min_price: z.number().min(0).max(10_000_000).optional(),
        retry_limit: z.number().int().min(1).max(10).optional(),
        resync_hours: z.number().int().min(1).max(720).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { savePortalSettings } = await import("@/lib/portals.server");
    return savePortalSettings(data);
  });

export const savePortalSettingsRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(2).max(120).optional(),
        is_active: z.boolean().optional(),
        kind: z.enum(["feed", "api", "manual"]).optional(),
        feed_format: z.enum(["xml", "json", "csv"]).optional(),
        feed_token: z.string().max(200).nullish(),
        endpoint_url: z.string().url().max(500).nullish(),
        auth_type: z.enum(["none", "bearer", "basic", "header"]).optional(),
        credentials_env: z.string().max(200).nullish(),
        auth_header: z.string().max(120).nullish(),
        max_listings: z.number().int().min(1).max(2000).optional(),
        price_markup: z.number().min(-50).max(50).optional(),
        ai_copy: z.boolean().optional(),
        notes: z.string().max(1000).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { id, ...patch } = data;
    const { savePortal } = await import("@/lib/portals.server");
    await savePortal(id, patch as Record<string, unknown>);
    return { ok: true };
  });

export const getPortalsAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { portalsAnalytics } = await import("@/lib/portals.server");
    return portalsAnalytics();
  });

export const queuePortalProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { portalId?: string; propertyIds?: string[] } | undefined) =>
    z
      .object({
        portalId: z.string().uuid().optional(),
        propertyIds: z.array(z.string().uuid()).max(500).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { queueProperties } = await import("@/lib/portals.server");
    return queueProperties(data);
  });

export const pushPortalListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { pushListing } = await import("@/lib/portals.server");
    return pushListing(data.id);
  });

export const markPortalListingPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        id: z.string().uuid(),
        externalUrl: z.string().url().max(500).nullish(),
        externalId: z.string().max(120).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await (supabaseAdmin as any)
      .from("portal_listings")
      .update({
        status: "published",
        published_at: now,
        last_synced_at: now,
        updated_at: now,
        external_url: data.externalUrl ?? null,
        external_id: data.externalId ?? null,
        last_error: null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePortalListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await (supabaseAdmin as any)
      .from("portal_listings")
      .update({ status: "removed", removed_at: now, updated_at: now })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runPortalsSyncNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runPortalsSync } = await import("@/lib/portals.server");
    return runPortalsSync(data.limit);
  });

export const resumePortalsJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumePortalJob } = await import("@/lib/portals.server");
    return resumePortalJob();
  });
