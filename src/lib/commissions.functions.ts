// Автоматизация №17 — API слой (typed RPC) за модула „Комисионни“.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const listCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; month?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("commissions")
      .select(
        "id, created_at, updated_at, deal_id, rule_code, deal_type, currency, base_amount, percent, gross_amount, vat_percent, vat_amount, total_amount, broker_amount, agency_amount, broker_id, status, approved_at, invoice_number, invoiced_at, paid_at, paid_amount, period_month, ai_summary, calc_note, deals:deal_id(deal_number, title, status, closed_at), brokers:broker_id(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(400);
    if (data.status) q = q.eq("status", data.status);
    if (data.month) q = q.eq("period_month", `${data.month}-01`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listCommissionSplitsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commissionId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("commission_splits")
      .select(
        "id, created_at, commission_id, broker_id, role, name, share_percent, amount, status, paid_at, note, brokers:broker_id(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.commissionId) q = q.eq("commission_id", data.commissionId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listCommissionPayoutsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("commission_payouts")
      .select(
        "id, created_at, commission_id, broker_id, amount, currency, method, reference, paid_at, period_month, note, brokers:broker_id(full_name)",
      )
      .order("paid_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCommissionRulesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listCommissionRules } = await import("@/lib/commissions.server");
    return listCommissionRules();
  });

export const saveCommissionRuleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveCommissionRule } = await import("@/lib/commissions.server");
    return saveCommissionRule(data);
  });

export const listCommissionEventsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("commission_events")
      .select("id, created_at, commission_id, deal_id, action, status, message, actor")
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCommissionDealsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("deals")
      .select(
        "id, deal_number, title, deal_type, status, price, agreed_price, currency, closed_at, broker_id",
      )
      .order("closed_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCommissionConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getCommissionSettings, getCommissionJobState } =
      await import("@/lib/commissions.server");
    return { settings: await getCommissionSettings(), job: await getCommissionJobState() };
  });

export const saveCommissionConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveCommissionSettings } = await import("@/lib/commissions.server");
    return saveCommissionSettings(data as any);
  });

export const getCommissionAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getCommissionAnalytics } = await import("@/lib/commissions.server");
    return getCommissionAnalytics();
  });

export const calculateCommissionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { dealId: string; ruleCode?: string | null; baseOverride?: number | null }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { calculateForDeal } = await import("@/lib/commissions.server");
    return calculateForDeal(data.dealId, actorEmail(context.claims), {
      ruleCode: data.ruleCode ?? null,
      baseOverride: data.baseOverride ?? null,
    });
  });

export const setCommissionStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commissionId: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { setCommissionStatus } = await import("@/lib/commissions.server");
    return setCommissionStatus(data.commissionId, data.status, actorEmail(context.claims));
  });

export const issueCommissionInvoiceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commissionId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { issueInvoice } = await import("@/lib/commissions.server");
    return issueInvoice(data.commissionId, actorEmail(context.claims));
  });

export const registerCommissionPayoutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      commissionId: string;
      splitId?: string | null;
      amount: number;
      method?: string;
      reference?: string | null;
      note?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { registerPayout } = await import("@/lib/commissions.server");
    return registerPayout({ ...data, actor: actorEmail(context.claims) });
  });

export const addCommissionSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      commissionId: string;
      role?: string;
      name?: string | null;
      brokerId?: string | null;
      sharePercent?: number | null;
      amount?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { addCommissionSplit } = await import("@/lib/commissions.server");
    return addCommissionSplit(data);
  });

export const removeCommissionSplitFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { splitId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { removeCommissionSplit } = await import("@/lib/commissions.server");
    return removeCommissionSplit(data.splitId);
  });

export const generateCommissionSummaryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { commissionId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateCommissionSummary } = await import("@/lib/commissions.server");
    return generateCommissionSummary(data.commissionId, actorEmail(context.claims));
  });

export const runCommissionSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runCommissionSweep } = await import("@/lib/commissions.server");
    return runCommissionSweep(data.limit);
  });

export const resumeCommissionJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeCommissionJob } = await import("@/lib/commissions.server");
    return resumeCommissionJob();
  });
