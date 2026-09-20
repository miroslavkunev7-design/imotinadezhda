// Автоматизация №11 — API слой (typed RPC) за модула „AI Описание на имот“.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

const COPY_SELECT =
  "id, created_at, updated_at, property_id, template_code, channel, language, version, title, body, short_text, bullets, seo_title, seo_description, seo_keywords, slug, hashtags, status, quality_score, seo_score, issues, word_count, ai_used, model, applied_at, approved_at, properties:property_id(id, title, price, currency, cover_image_url, is_published, cities:city_id(name), quarters:quarter_id(name))";

export const listPropertyCopy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { status?: string; channel?: string; propertyId?: string } | undefined) => d ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("property_copy")
      .select(COPY_SELECT)
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    if (data.channel) q = q.eq("channel", data.channel);
    if (data.propertyId) q = q.eq("property_id", data.propertyId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listCopyTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getTemplates } = await import("@/lib/copy.server");
    return getTemplates();
  });

export const listCopyProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("properties")
      .select(
        "id, title, price, currency, description, is_published, updated_at, cities:city_id(name), quarters:quarter_id(name)",
      )
      .order("updated_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCopyEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("copy_events")
      .select(
        "id, created_at, action, status, message, actor, property_id, properties:property_id(id, title)",
      )
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCopyConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getCopySettings, getCopyJobState } = await import("@/lib/copy.server");
    return { settings: await getCopySettings(), job: await getCopyJobState() };
  });

export const saveCopyConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveCopySettings } = await import("@/lib/copy.server");
    return saveCopySettings(data as any);
  });

export const getCopyAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getCopyAnalytics } = await import("@/lib/copy.server");
    return getCopyAnalytics();
  });

export const generateCopyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { propertyId: string; templateCode?: string; useAi?: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generatePropertyCopy } = await import("@/lib/copy.server");
    return generatePropertyCopy({
      propertyId: data.propertyId,
      templateCode: data.templateCode,
      useAi: data.useAi,
      actor: actorEmail(context.claims) ?? "crm",
      createdBy: context.userId,
    });
  });

export const setCopyStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { copyId: string; status: "draft" | "approved" | "rejected" }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { setCopyStatus } = await import("@/lib/copy.server");
    return setCopyStatus({
      ...data,
      actor: actorEmail(context.claims) ?? "crm",
      userId: context.userId,
    });
  });

export const updateCopyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { copyId: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { updateCopy } = await import("@/lib/copy.server");
    return updateCopy({
      copyId: data.copyId,
      patch: data.patch as any,
      actor: actorEmail(context.claims) ?? "crm",
    });
  });

export const applyCopyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { copyId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { applyCopy } = await import("@/lib/copy.server");
    return applyCopy({ copyId: data.copyId, actor: actorEmail(context.claims) ?? "crm" });
  });

export const queueCopyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { propertyIds: string[]; templateCode?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { queueProperties } = await import("@/lib/copy.server");
    return queueProperties({
      propertyIds: data.propertyIds,
      templateCode: data.templateCode,
      requestedBy: context.userId,
    });
  });

export const runCopyQueueNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runCopyQueue } = await import("@/lib/copy.server");
    return runCopyQueue(data.limit);
  });

export const resumeCopyJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeCopyJob } = await import("@/lib/copy.server");
    return resumeCopyJob();
  });
