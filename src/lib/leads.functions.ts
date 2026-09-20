import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function email(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { status?: string; channel?: string; search?: string } | undefined) => d ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, email(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("leads")
      .select("*, properties:property_id(title), clients:client_id(id, full_name)")
      .order("created_at", { ascending: false })
      .limit(400);
    if (data.status) q = q.eq("status", data.status);
    if (data.channel) q = q.eq("channel", data.channel);
    if (data.search)
      q = q.or(
        `full_name.ilike.%${data.search}%,phone.ilike.%${data.search}%,email.ilike.%${data.search}%`,
      );
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getLeadTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leadId: string }) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, email(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const [events, attempts] = await Promise.all([
      admin
        .from("lead_events")
        .select("*")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: false }),
      admin
        .from("contact_attempts")
        .select("*")
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: false }),
    ]);
    return { events: events.data ?? [], attempts: attempts.data ?? [] };
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id: string; status?: string; notes?: string; assigned_broker_id?: string | null }) =>
      z
        .object({
          id: z.string().uuid(),
          status: z.enum(["new", "contacted", "qualified", "converted", "lost", "spam"]).optional(),
          notes: z.string().max(4000).optional(),
          assigned_broker_id: z.string().uuid().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, email(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await (supabaseAdmin as any)
      .from("leads")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    if (patch.status) {
      await (supabaseAdmin as any)
        .from("lead_events")
        .insert({
          lead_id: id,
          event_type: "status_changed",
          detail: `Нов статус: ${patch.status}`,
          actor: email(context.claims),
        });
    }
    return { ok: true };
  });

export const createLeadManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        full_name: z.string().min(2).max(200),
        phone: z.string().max(40).optional().nullable(),
        email: z.string().email().max(200).optional().nullable().or(z.literal("")),
        message: z.string().max(4000).optional().nullable(),
        channel: z.string().max(40).default("manual"),
        source: z.string().max(120).optional().nullable(),
        property_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, email(context.claims));
    const { captureLead } = await import("@/lib/leads.server");
    return captureLead({ ...data, email: data.email || null });
  });

export const getLeadAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, email(context.claims));
    const { leadAnalytics } = await import("@/lib/leads.server");
    return leadAnalytics();
  });

export const getInstantContactSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, email(context.claims));
    const { getAutomationSettings } = await import("@/lib/leads.server");
    return getAutomationSettings();
  });

export const saveInstantContactSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        enabled: z.boolean().optional(),
        window_seconds: z.number().int().min(5).max(3600).optional(),
        channel: z.enum(["email", "sms", "whatsapp", "viber"]).optional(),
        ai_personalize: z.boolean().optional(),
        escalate_after_minutes: z.number().int().min(1).max(1440).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, email(context.claims));
    const { saveAutomationSettings } = await import("@/lib/leads.server");
    return saveAutomationSettings(data);
  });

export const retryFirstContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leadId: string }) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, email(context.claims));
    const { scheduleFirstContact } = await import("@/lib/leads.server");
    await scheduleFirstContact(data.leadId);
    return { ok: true };
  });

export const sweepInstantContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, email(context.claims));
    const { runInstantContactSweep } = await import("@/lib/leads.server");
    return runInstantContactSweep();
  });
