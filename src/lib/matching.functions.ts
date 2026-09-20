// Автоматизация №4 — API слой (typed RPC) за CRM.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const listMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { status?: string; leadId?: string; minScore?: number } | undefined) => d ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("property_matches")
      .select(
        "id, created_at, score, grade, status, reasons, mismatches, breakdown, sent_at, responded_at, feedback, leads:lead_id(id, full_name, email, phone, qualification_grade, desired_city, budget_min, budget_max, currency, matching_opt_out, last_match_sent_at), properties:property_id(id, title, price, currency, rooms, area_sqm, cover_image_url, cities:city_id(name), quarters:quarter_id(name))",
      )
      .order("score", { ascending: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    if (data.leadId) q = q.eq("lead_id", data.leadId);
    if (data.minScore) q = q.gte("score", data.minScore);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listMatchSends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("match_sends")
      .select(
        "id, created_at, channel, subject, status, match_count, sent_at, opened_at, clicked_at, error, ai_used, model, leads:lead_id(id, full_name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const generateMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leadId: string }) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateMatchesForLead } = await import("@/lib/matching.server");
    const rows = await generateMatchesForLead(data.leadId, { source: "manual" });
    return {
      count: rows.length,
      top: rows.slice(0, 5).map((r) => ({ title: r.property.title, score: r.score })),
    };
  });

export const generateMatchesByProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { propertyId: string }) =>
    z.object({ propertyId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateMatchesForProperty } = await import("@/lib/matching.server");
    return { count: await generateMatchesForProperty(data.propertyId) };
  });

export const sendMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { leadId: string; force?: boolean; propertyIds?: string[] }) =>
    z
      .object({
        leadId: z.string().uuid(),
        force: z.boolean().optional(),
        propertyIds: z.array(z.string().uuid()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { sendMatchesToLead } = await import("@/lib/matching.server");
    return sendMatchesToLead(data.leadId, {
      force: data.force ?? false,
      propertyIds: data.propertyIds,
    });
  });

export const runMatchingBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(d?.limit ?? 20, 1), 100),
  }))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runMatchingSweep } = await import("@/lib/matching.server");
    return runMatchingSweep(data.limit);
  });

export const updateMatchStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "queued", "sent", "viewed", "interested", "rejected", "expired"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("property_matches")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMatchingAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { matchingAnalytics } = await import("@/lib/matching.server");
    return matchingAnalytics();
  });

export const getMatchingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getMatchingSettings } = await import("@/lib/matching.server");
    return getMatchingSettings();
  });

export const saveMatchingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveMatchingSettings } = await import("@/lib/matching.server");
    return saveMatchingSettings(data as never);
  });
