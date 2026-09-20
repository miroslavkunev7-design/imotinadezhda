// Автоматизация №18 — API слой (typed RPC) за модула „Маркетинг автоматизация“.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const getMarketingBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const m = await import("@/lib/marketing-auto.server");
    const [channels, campaigns, budgets, analytics, events, settings, job] = await Promise.all([
      m.listChannels(),
      m.listCampaigns(),
      m.listBudgets(),
      m.getMarketingAnalytics(),
      m.listMarketingEvents(),
      m.getMarketingSettings(),
      m.getMarketingJobState(),
    ]);
    return { channels, campaigns, budgets, analytics, events, settings, job };
  });

export const listAdCreativesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listCreatives } = await import("@/lib/marketing-auto.server");
    return listCreatives(data.campaignId);
  });

export const listAdSpendFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listSpend } = await import("@/lib/marketing-auto.server");
    return listSpend(data.campaignId);
  });

export const listAdAttributionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listAttributions } = await import("@/lib/marketing-auto.server");
    return listAttributions(data.campaignId);
  });

export const listAdPropertiesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("properties")
      .select("id, title, price, currency, city_id, cities(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({ ...p, city: p.cities?.name ?? null }));
  });

export const saveAdCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveCampaign } = await import("@/lib/marketing-auto.server");
    return saveCampaign(data as any, actorEmail(context.claims));
  });

export const setAdCampaignStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { setCampaignStatus } = await import("@/lib/marketing-auto.server");
    return setCampaignStatus(data.id, data.status, actorEmail(context.claims));
  });

export const saveAdCreativeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveCreative } = await import("@/lib/marketing-auto.server");
    return saveCreative(data as any, actorEmail(context.claims));
  });

export const deleteAdCreativeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { deleteCreative } = await import("@/lib/marketing-auto.server");
    return deleteCreative(data.id);
  });

export const generateAdCreativesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { campaignId: string; extra?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateCreatives } = await import("@/lib/marketing-auto.server");
    return generateCreatives(data.campaignId, data.extra ?? null, actorEmail(context.claims));
  });

export const recordAdSpendFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { recordSpend } = await import("@/lib/marketing-auto.server");
    return recordSpend({ ...(data as any), actor: actorEmail(context.claims) });
  });

export const saveAdBudgetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveBudget } = await import("@/lib/marketing-auto.server");
    return saveBudget(data as any);
  });

export const saveMarketingConfigFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveMarketingSettings } = await import("@/lib/marketing-auto.server");
    return saveMarketingSettings(data as any);
  });

export const runMarketingSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runMarketingSweep } = await import("@/lib/marketing-auto.server");
    return runMarketingSweep();
  });

export const resumeMarketingJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeMarketingJob } = await import("@/lib/marketing-auto.server");
    return resumeMarketingJob();
  });

export const generateBudgetAdviceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateBudgetAdvice } = await import("@/lib/marketing-auto.server");
    return generateBudgetAdvice(actorEmail(context.claims));
  });
