// Автоматизация №19 — API слой (typed RPC) за модула „AI Прогнозиране на Продавачи“.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const getSellerBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const m = await import("@/lib/seller-predict.server");
    const [prospects, rules, signals, outreach, analytics, events, settings, job] =
      await Promise.all([
        m.listProspects(),
        m.listSignalRules(),
        m.listSignals(),
        m.listOutreach(),
        m.getSellerAnalytics(),
        m.listSellerEvents(),
        m.getSellerSettings(),
        m.getSellerJobState(),
      ]);
    return { prospects, rules, signals, outreach, analytics, events, settings, job };
  });

export const saveSellerProspectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveProspect } = await import("@/lib/seller-predict.server");
    return saveProspect(data as any, actorEmail(context.claims));
  });

export const setSellerProspectStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { setProspectStatus } = await import("@/lib/seller-predict.server");
    return setProspectStatus(data.id, data.status, actorEmail(context.claims));
  });

export const deleteSellerProspectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { deleteProspect } = await import("@/lib/seller-predict.server");
    return deleteProspect(data.id);
  });

export const scoreSellerProspectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { scoreProspect } = await import("@/lib/seller-predict.server");
    return scoreProspect(data.id, actorEmail(context.claims));
  });

export const rescoreSellersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { rescoreAll } = await import("@/lib/seller-predict.server");
    return rescoreAll(actorEmail(context.claims));
  });

export const predictSellerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateAiPrediction } = await import("@/lib/seller-predict.server");
    return generateAiPrediction(data.id, actorEmail(context.claims));
  });

export const generateSellerMessageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; channel: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateOutreachMessage } = await import("@/lib/seller-predict.server");
    return generateOutreachMessage(data.id, data.channel, actorEmail(context.claims));
  });

export const addSellerSignalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prospect_id: string; signal_code: string; value?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { addSignal } = await import("@/lib/seller-predict.server");
    return addSignal(data, actorEmail(context.claims));
  });

export const removeSellerSignalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { removeSignal } = await import("@/lib/seller-predict.server");
    return removeSignal(data.id);
  });

export const saveSellerRuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveSignalRule } = await import("@/lib/seller-predict.server");
    return saveSignalRule(data as any);
  });

export const logSellerOutreachFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { logOutreach } = await import("@/lib/seller-predict.server");
    return logOutreach(data as any, actorEmail(context.claims));
  });

export const discoverSellersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { discoverProspects } = await import("@/lib/seller-predict.server");
    return discoverProspects(actorEmail(context.claims));
  });

export const saveSellerSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveSellerSettings } = await import("@/lib/seller-predict.server");
    return saveSellerSettings(data as any);
  });

export const runSellerSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runSellerSweep } = await import("@/lib/seller-predict.server");
    return runSellerSweep();
  });

export const resumeSellerJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeSellerJob } = await import("@/lib/seller-predict.server");
    return resumeSellerJob();
  });
