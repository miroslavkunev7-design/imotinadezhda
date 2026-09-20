// Автоматизация №3 — API слой (typed RPC) за CRM.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const listQualifiedLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; grade?: string; search?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("leads")
      .select(
        "id, created_at, full_name, phone, email, message, channel, lead_type, status, qualification_status, qualification_score, qualification_grade, qualified_at, budget_min, budget_max, currency, desired_city, desired_district, desired_property_type, rooms_min, area_min, area_max, timeframe, financing, motivation, ai_summary, properties:property_id(title), clients:client_id(id, full_name)",
      )
      .order("qualification_score", { ascending: false, nullsFirst: false })
      .limit(300);
    if (data.status) q = q.eq("qualification_status", data.status);
    if (data.grade) q = q.eq("qualification_grade", data.grade);
    if (data.search)
      q = q.or(
        `full_name.ilike.%${data.search}%,phone.ilike.%${data.search}%,email.ilike.%${data.search}%,desired_city.ilike.%${data.search}%`,
      );
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getQualificationHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leadId: string }) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("lead_qualifications")
      .select("*")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const runQualification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leadId: string; answers?: Record<string, unknown> | null }) =>
    z
      .object({
        leadId: z.string().uuid(),
        answers: z.record(z.string(), z.unknown()).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { qualifyLead } = await import("@/lib/qualification.server");
    return qualifyLead(data.leadId, {
      source: data.answers ? "manual" : "auto",
      actor: actorEmail(context.claims),
      answers: data.answers ?? null,
    });
  });

export const runQualificationBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { qualifyPending } = await import("@/lib/qualification.server");
    return qualifyPending(data.limit ?? 25);
  });

export const getQualificationAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { qualificationAnalytics } = await import("@/lib/qualification.server");
    return qualificationAnalytics();
  });

export const getQualificationConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getQualificationSettings } = await import("@/lib/qualification.server");
    return getQualificationSettings();
  });

export const saveQualificationConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        enabled: z.boolean().optional(),
        ai_enabled: z.boolean().optional(),
        auto_on_capture: z.boolean().optional(),
        qualified_threshold: z.number().int().min(10).max(100).optional(),
        nurture_threshold: z.number().int().min(0).max(99).optional(),
        weights: z
          .object({
            budget: z.number().int().min(0).max(100),
            timeframe: z.number().int().min(0).max(100),
            financing: z.number().int().min(0).max(100),
            location: z.number().int().min(0).max(100),
            contactability: z.number().int().min(0).max(100),
            engagement: z.number().int().min(0).max(100),
          })
          .partial()
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveQualificationSettings } = await import("@/lib/qualification.server");
    return saveQualificationSettings(data as never);
  });
