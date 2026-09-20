// Автоматизация №15 — API слой (typed RPC) за модула „Реактивиране на клиенти“.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const listReactivationEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; campaign?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("reactivation_enrollments")
      .select(
        "id, created_at, updated_at, campaign_code, client_id, contact_name, contact_email, contact_phone, channel, status, step_no, next_action_at, last_sent_at, inactive_days, score, score_reason, ai_summary, revived_at, revived_reason, opted_out_at, attempts, error, clients:client_id(full_name, client_type, deposit_amount)",
      )
      .order("score", { ascending: false })
      .limit(400);
    if (data.status) q = q.eq("status", data.status);
    if (data.campaign) q = q.eq("campaign_code", data.campaign);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listReactivationMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enrollmentId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("reactivation_messages")
      .select(
        "id, created_at, enrollment_id, client_id, campaign_code, step_no, channel, subject, body, recipient, status, ai_used, model, replied_at, error",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.enrollmentId) q = q.eq("enrollment_id", data.enrollmentId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listReactivationCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listCampaigns } = await import("@/lib/reactivation.server");
    return listCampaigns();
  });

export const listReactivationTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listTemplates } = await import("@/lib/reactivation.server");
    return listTemplates();
  });

export const listReactivationEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("reactivation_events")
      .select(
        "id, created_at, action, status, message, actor, campaign_code, enrollment_id, client_id",
      )
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listReactivationClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("clients")
      .select("id, full_name, email, phone, client_type, updated_at, deposit_amount")
      .order("updated_at", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getReactivationConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getReactivationSettings, getReactivationJobState } =
      await import("@/lib/reactivation.server");
    return { settings: await getReactivationSettings(), job: await getReactivationJobState() };
  });

export const saveReactivationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveReactivationSettings } = await import("@/lib/reactivation.server");
    return saveReactivationSettings(data as any);
  });

export const getReactivationAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getReactivationAnalytics } = await import("@/lib/reactivation.server");
    return getReactivationAnalytics();
  });

export const enrollClientFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { clientId: string; campaignCode?: string; channel?: string; sendNow?: boolean }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { enrollClient, sendNextStep } = await import("@/lib/reactivation.server");
    const actor = actorEmail(context.claims) ?? "crm";
    const created = await enrollClient({ ...data, actor, startNow: data.sendNow });
    if (data.sendNow) return sendNextStep(created.id, actor);
    return created;
  });

export const autoEnrollDormantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { autoEnrollDormant } = await import("@/lib/reactivation.server");
    return autoEnrollDormant(data.limit);
  });

export const sendReactivationStepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enrollmentId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { sendNextStep } = await import("@/lib/reactivation.server");
    return sendNextStep(data.enrollmentId, actorEmail(context.claims));
  });

export const generateReactivationSummaryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enrollmentId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateAiSummary } = await import("@/lib/reactivation.server");
    return generateAiSummary(data.enrollmentId, actorEmail(context.claims));
  });

export const setReactivationStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enrollmentId: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { setEnrollmentStatus } = await import("@/lib/reactivation.server");
    return setEnrollmentStatus(data.enrollmentId, data.status, actorEmail(context.claims));
  });

export const markReactivationRevivedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enrollmentId: string; reason?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { markRevived } = await import("@/lib/reactivation.server");
    return markRevived(data.enrollmentId, data.reason ?? null, actorEmail(context.claims));
  });

export const registerReactivationReplyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enrollmentId: string; note?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { registerReply } = await import("@/lib/reactivation.server");
    return registerReply(data.enrollmentId, data.note ?? null, actorEmail(context.claims));
  });

export const runReactivationSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runReactivationSweep } = await import("@/lib/reactivation.server");
    return runReactivationSweep(data.limit);
  });

export const resumeReactivationJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeReactivationJob } = await import("@/lib/reactivation.server");
    return resumeReactivationJob();
  });
