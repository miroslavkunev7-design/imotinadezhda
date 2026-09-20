// Автоматизация №5 — API слой (typed RPC) за CRM.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

const admin = async () =>
  (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;

export const listFollowupSequences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listSequences } = await import("@/lib/followup.server");
    return listSequences();
  });

export const listFollowupEnrollments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; leadId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    let q = (await admin())
      .from("followup_enrollments")
      .select(
        "id, created_at, status, current_step, next_run_at, reason, stop_reason, completed_at, followup_sequences:sequence_id(id, name, trigger_type), leads:lead_id(id, full_name, email, phone, status, lead_type, desired_city, followup_opt_out, followup_count, last_followup_at, qualification_grade)",
      )
      .order("next_run_at", { ascending: true })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    if (data.leadId) q = q.eq("lead_id", data.leadId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listFollowupMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leadId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    let q = (await admin())
      .from("followup_messages")
      .select(
        "id, created_at, step_no, channel, subject, status, error, ai_used, model, sent_at, opened_at, clicked_at, replied_at, leads:lead_id(id, full_name, email), followup_sequences:sequence_id(name)",
      )
      .order("created_at", { ascending: false })
      .limit(150);
    if (data.leadId) q = q.eq("lead_id", data.leadId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const enrollLeadInFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leadId: string; sequenceId?: string; trigger?: string }) =>
    z
      .object({
        leadId: z.string().uuid(),
        sequenceId: z.string().uuid().optional(),
        trigger: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { enrollLead } = await import("@/lib/followup.server");
    return enrollLead(data.leadId, {
      sequenceId: data.sequenceId,
      trigger: data.trigger,
      reason: "Ръчно от CRM",
    });
  });

export const stopFollowupEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason?: string }) =>
    z.object({ id: z.string().uuid(), reason: z.string().max(200).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { stopEnrollment } = await import("@/lib/followup.server");
    return stopEnrollment(
      data.id,
      data.reason ?? `Спряно ръчно (${actorEmail(context.claims) ?? "CRM"})`,
    );
  });

export const runFollowupStepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runEnrollmentStep } = await import("@/lib/followup.server");
    return runEnrollmentStep(data.id, { force: true });
  });

export const runFollowupSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runFollowupSweep } = await import("@/lib/followup.server");
    return runFollowupSweep(data.limit);
  });

export const getFollowupAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { followupAnalytics } = await import("@/lib/followup.server");
    return followupAnalytics();
  });

export const getFollowupConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getFollowupSettings, getJobState } = await import("@/lib/followup.server");
    const [settings, job] = await Promise.all([getFollowupSettings(), getJobState()]);
    return { settings, job };
  });

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  ai_enabled: z.boolean().optional(),
  batch_size: z.number().int().min(1).max(100).optional(),
  max_steps: z.number().int().min(1).max(12).optional(),
  min_hours_between: z.number().int().min(0).max(336).optional(),
  stop_on_reply: z.boolean().optional(),
  auto_enroll_no_response: z.boolean().optional(),
  auto_enroll_after_send: z.boolean().optional(),
  auto_enroll_dormant: z.boolean().optional(),
  dormant_days: z.number().int().min(7).max(720).optional(),
  reactivation_limit_per_run: z.number().int().min(1).max(100).optional(),
  lease_seconds: z.number().int().min(30).max(3600).optional(),
});

export const saveFollowupConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveFollowupSettings } = await import("@/lib/followup.server");
    return saveFollowupSettings(data);
  });

export const resumeFollowupJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeJob } = await import("@/lib/followup.server");
    return resumeJob();
  });

const stepSchema = z.object({
  id: z.string().uuid().optional(),
  sequence_id: z.string().uuid(),
  step_no: z.number().int().min(1).max(12),
  delay_hours: z.number().int().min(0).max(2000),
  channel: z.enum(["email", "sms", "viber", "whatsapp", "call"]),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(5).max(4000),
  is_active: z.boolean().optional(),
});

export const saveFollowupStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => stepSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { error } = await (await admin())
      .from("followup_steps")
      .upsert(data, { onConflict: "sequence_id,step_no" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleFollowupSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; is_active: boolean }) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { error } = await (await admin())
      .from("followup_sequences")
      .update({ is_active: data.is_active, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
