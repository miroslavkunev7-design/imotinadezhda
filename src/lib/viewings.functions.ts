// Автоматизация №6 — API слой (typed RPC) за CRM модула „Огледи“.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

const VIEWING_LIST_SELECT =
  "id, created_at, scheduled_at, duration_min, status, outcome, outcome_notes, rating, feedback, feedback_at, location, notes, source, token, agent_name, agent_email, agent_phone, contact_name, contact_email, contact_phone, reschedule_count, reminders_sent, ai_used, confirmed_at, cancelled_at, cancel_reason, lead_id, property_id, leads:lead_id(id, full_name, email, phone, status, qualification_grade), properties:property_id(id, title, price, currency, rooms, area_sqm, cover_image_url, cities:city_id(name), quarters:quarter_id(name))";

export const listViewings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { status?: string; scope?: "upcoming" | "past" | "all"; leadId?: string } | undefined) =>
      d ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any).from("viewings").select(VIEWING_LIST_SELECT).limit(300);
    if (data.status) q = q.eq("status", data.status);
    if (data.leadId) q = q.eq("lead_id", data.leadId);
    if (data.scope === "past")
      q = q
        .lt("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: false });
    else if (data.scope === "all") q = q.order("scheduled_at", { ascending: false });
    else
      q = q
        .gte("scheduled_at", new Date(Date.now() - 3600_000).toISOString())
        .order("scheduled_at", { ascending: true });
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listViewingReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("viewing_reminders")
      .select(
        "id, created_at, kind, channel, scheduled_at, sent_at, status, recipient, subject, body, ai_used, model, error, viewing_id, viewings:viewing_id(id, scheduled_at, contact_name, status, properties:property_id(title))",
      )
      .order("scheduled_at", { ascending: false })
      .limit(150);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getViewingsConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getViewingSettings, getViewingJobState } = await import("@/lib/viewings.server");
    return { settings: await getViewingSettings(), job: await getViewingJobState() };
  });

export const saveViewingsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        enabled: z.boolean().optional(),
        ai_enabled: z.boolean().optional(),
        send_invite: z.boolean().optional(),
        reminder_24h: z.boolean().optional(),
        reminder_2h: z.boolean().optional(),
        feedback_request: z.boolean().optional(),
        agent_brief: z.boolean().optional(),
        batch_size: z.number().int().min(1).max(100).optional(),
        feedback_delay_hours: z.number().int().min(0).max(72).optional(),
        auto_no_show_hours: z.number().int().min(1).max(168).optional(),
        min_lead_hours: z.number().int().min(0).max(72).optional(),
        slot_days_ahead: z.number().int().min(1).max(30).optional(),
        quiet_start: z.number().int().min(0).max(23).optional(),
        quiet_end: z.number().int().min(0).max(23).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveViewingSettings } = await import("@/lib/viewings.server");
    return saveViewingSettings(data);
  });

export const getViewingsAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { viewingsAnalytics } = await import("@/lib/viewings.server");
    return viewingsAnalytics();
  });

export const suggestViewingSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { agentId?: string | null; days?: number; limit?: number } | undefined) => d ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { suggestSlots } = await import("@/lib/viewings.server");
    return suggestSlots({ agentId: data.agentId ?? null, days: data.days, limit: data.limit });
  });

export const createViewing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        leadId: z.string().uuid().nullish(),
        clientId: z.string().uuid().nullish(),
        propertyId: z.string().uuid().nullish(),
        agentId: z.string().uuid().nullish(),
        agentName: z.string().max(160).nullish(),
        agentEmail: z.string().email().nullish(),
        agentPhone: z.string().max(60).nullish(),
        contactName: z.string().max(160).nullish(),
        contactEmail: z.string().email().nullish(),
        contactPhone: z.string().max(60).nullish(),
        scheduledAt: z.string().min(10),
        durationMin: z.number().int().min(15).max(240).optional(),
        location: z.string().max(300).nullish(),
        notes: z.string().max(2000).nullish(),
        autoConfirm: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { scheduleViewing } = await import("@/lib/viewings.server");
    const res = await scheduleViewing({ ...data, source: "crm", createdBy: context.userId });
    if (!res.ok) throw new Error(res.reason ?? "Огледът не беше създаден");
    return res;
  });

export const updateViewingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["confirm", "cancel", "reschedule", "complete", "no_show"]),
        scheduledAt: z.string().min(10).optional(),
        reason: z.string().max(500).optional(),
        outcome: z.string().max(60).optional(),
        notes: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const v = await import("@/lib/viewings.server");
    const by = actorEmail(context.claims) ?? "CRM";
    if (data.action === "confirm") return v.confirmViewing(data.id, by);
    if (data.action === "cancel") return v.cancelViewing(data.id, data.reason ?? "Без причина", by);
    if (data.action === "reschedule") {
      if (!data.scheduledAt) throw new Error("Липсва нов час");
      const res = await v.rescheduleViewing(data.id, data.scheduledAt, by);
      if (!res.ok) throw new Error(res.reason ?? "Пренасрочването не успя");
      return res;
    }
    return v.setViewingOutcome(
      data.id,
      data.outcome ?? (data.action === "no_show" ? "no_show" : "completed"),
      data.notes ?? null,
      data.action === "no_show" ? "no_show" : "completed",
    );
  });

export const runViewingReminderNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runReminder } = await import("@/lib/viewings.server");
    return runReminder(data.id, { force: true });
  });

export const runViewingsSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runViewingsSweep } = await import("@/lib/viewings.server");
    return runViewingsSweep(data.limit);
  });

export const resumeViewingsJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeViewingJob } = await import("@/lib/viewings.server");
    return resumeViewingJob();
  });
