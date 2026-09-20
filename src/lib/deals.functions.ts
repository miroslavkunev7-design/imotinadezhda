// Автоматизация №10 — API слой (typed RPC) за CRM модула „Сделки“.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

const DEAL_SELECT =
  "id, created_at, updated_at, deal_number, title, deal_type, stage_code, status, price, agreed_price, currency, deposit_amount, deposit_paid_at, commission_percent, commission_amount, commission_paid, mortgage_needed, mortgage_bank, mortgage_approved_at, preliminary_contract_at, notary_name, notary_office, notary_at, notary_confirmed, deed_number, closed_at, lost_reason, probability, expected_close_at, risk_level, risk_note, ai_summary, ai_next_step, ai_updated_at, stage_entered_at, last_activity_at, notes, client_id, property_id, owner_id, broker_id, clients:client_id(id, full_name, phone, email), properties:property_id(id, title, price, currency, cover_image_url)";

export const listDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; stage?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("deals")
      .select(DEAL_SELECT)
      .order("last_activity_at", { ascending: false })
      .limit(400);
    if (data.status) q = q.eq("status", data.status);
    if (data.stage) q = q.eq("stage_code", data.stage);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listDealStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listStages } = await import("@/lib/deals.server");
    return listStages();
  });

export const listDealTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dealId?: string; status?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("deal_tasks")
      .select(
        "id, created_at, deal_id, stage_code, title, description, status, due_at, done_at, auto_generated, sort_order, deals:deal_id(id, title, deal_number)",
      )
      .order("due_at", { ascending: true })
      .limit(400);
    if (data.dealId) q = q.eq("deal_id", data.dealId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listDealEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dealId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("deal_events")
      .select(
        "id, created_at, deal_id, action, from_stage, to_stage, status, message, actor, deals:deal_id(id, title, deal_number)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.dealId) q = q.eq("deal_id", data.dealId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getDealsConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getDealSettings, getDealJobState } = await import("@/lib/deals.server");
    return { settings: await getDealSettings(), job: await getDealJobState() };
  });

export const saveDealsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        enabled: z.boolean().optional(),
        ai_enabled: z.boolean().optional(),
        auto_tasks: z.boolean().optional(),
        batch_size: z.number().int().min(1).max(50).optional(),
        default_commission: z.number().min(0).max(20).optional(),
        stall_days: z.number().int().min(1).max(90).optional(),
        notary_reminder_days: z.number().int().min(1).max(30).optional(),
        task_reminder_days: z.number().int().min(0).max(30).optional(),
        number_prefix: z.string().min(1).max(10).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveDealSettings } = await import("@/lib/deals.server");
    return saveDealSettings(data);
  });

export const getDealsAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { dealsAnalytics } = await import("@/lib/deals.server");
    return dealsAnalytics();
  });

export const createDealFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        title: z.string().max(200).nullish(),
        dealType: z.enum(["sale", "rent"]).optional(),
        clientId: z.string().uuid().nullish(),
        propertyId: z.string().uuid().nullish(),
        ownerId: z.string().uuid().nullish(),
        brokerId: z.string().uuid().nullish(),
        price: z.number().nonnegative().nullish(),
        agreedPrice: z.number().nonnegative().nullish(),
        currency: z.string().max(6).nullish(),
        commissionPercent: z.number().min(0).max(20).nullish(),
        mortgageNeeded: z.boolean().optional(),
        expectedCloseAt: z.string().nullish(),
        notes: z.string().max(4000).nullish(),
        stageCode: z.string().max(40).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { createDeal } = await import("@/lib/deals.server");
    return createDeal({ ...data, createdBy: context.userId });
  });

export const updateDealFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().max(200).nullish(),
        price: z.number().nonnegative().nullish(),
        agreedPrice: z.number().nonnegative().nullish(),
        currency: z.string().max(6).nullish(),
        depositAmount: z.number().nonnegative().nullish(),
        depositPaidAt: z.string().nullish(),
        commissionPercent: z.number().min(0).max(20).nullish(),
        commissionPaid: z.boolean().optional(),
        mortgageNeeded: z.boolean().optional(),
        mortgageBank: z.string().max(160).nullish(),
        mortgageApprovedAt: z.string().nullish(),
        preliminaryContractAt: z.string().nullish(),
        notaryName: z.string().max(160).nullish(),
        notaryOffice: z.string().max(200).nullish(),
        notaryAt: z.string().nullish(),
        notaryConfirmed: z.boolean().optional(),
        deedNumber: z.string().max(80).nullish(),
        expectedCloseAt: z.string().nullish(),
        brokerId: z.string().uuid().nullish(),
        riskLevel: z.enum(["low", "medium", "high"]).optional(),
        riskNote: z.string().max(1000).nullish(),
        notes: z.string().max(4000).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { updateDeal } = await import("@/lib/deals.server");
    return updateDeal({ ...data, actor: actorEmail(context.claims) ?? "CRM" });
  });

export const moveDealStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        id: z.string().uuid(),
        stageCode: z.string().min(2).max(40),
        force: z.boolean().optional(),
        note: z.string().max(500).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { moveStage } = await import("@/lib/deals.server");
    return moveStage({ ...data, actor: actorEmail(context.claims) ?? "CRM" });
  });

export const checkDealRequirements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; stageCode: string }) =>
    z.object({ id: z.string().uuid(), stageCode: z.string().min(2).max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { checkStageRequirements } = await import("@/lib/deals.server");
    return checkStageRequirements(data.id, data.stageCode);
  });

export const addDealTaskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        dealId: z.string().uuid(),
        title: z.string().min(2).max(200),
        description: z.string().max(2000).nullish(),
        dueAt: z.string().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { addDealTask } = await import("@/lib/deals.server");
    return addDealTask({ ...data, actor: actorEmail(context.claims) ?? "CRM" });
  });

export const setDealTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z.object({ id: z.string().uuid(), status: z.enum(["open", "done", "skipped"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { setTaskStatus } = await import("@/lib/deals.server");
    return setTaskStatus({ ...data, actor: actorEmail(context.claims) ?? "CRM" });
  });

export const analyzeDealFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { analyzeDeal } = await import("@/lib/deals.server");
    return analyzeDeal(data.id);
  });

export const runDealsSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runDealsSweep } = await import("@/lib/deals.server");
    return runDealsSweep(data.limit);
  });

export const resumeDealsJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeDealJob } = await import("@/lib/deals.server");
    return resumeDealJob();
  });

export const listDealPickers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const [clients, properties, brokers] = await Promise.all([
      admin
        .from("clients")
        .select("id, full_name, phone")
        .order("created_at", { ascending: false })
        .limit(300),
      admin
        .from("properties")
        .select("id, title, price, currency")
        .order("created_at", { ascending: false })
        .limit(300),
      admin.from("brokers").select("id, full_name").limit(100),
    ]);
    return {
      clients: (clients.data ?? []) as {
        id: string;
        full_name: string | null;
        phone: string | null;
      }[],
      properties: (properties.data ?? []) as {
        id: string;
        title: string | null;
        price: number | null;
        currency: string | null;
      }[],
      brokers: (brokers.data ?? []) as { id: string; full_name: string | null }[],
    };
  });
