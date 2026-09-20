// Автоматизация №13 — API слой (typed RPC) за модула „Отчети към собственици“.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const listOwnerReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; ownerId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("owner_reports")
      .select(
        "id, created_at, updated_at, owner_id, owner_name, owner_email, property_ids, template_code, period_start, period_end, status, metrics, summary, recommendations, html, subject, recipient, ai_used, model, token, sent_at, opened_at, open_count, error",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    if (data.ownerId) q = q.eq("owner_id", data.ownerId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listOwnerReportOwners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listOwnersWithProperties } = await import("@/lib/owner-reports.server");
    return listOwnersWithProperties();
  });

export const listOwnerReportTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("owner_report_templates")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listOwnerReportSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("owner_report_schedules")
      .select("*, owners:owner_id(id, full_name, email)")
      .order("next_run_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listOwnerReportEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("owner_report_events")
      .select("id, created_at, action, status, message, actor, report_id, owner_id")
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getOwnerReportConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getOwnerReportSettings, getOwnerReportJobState } =
      await import("@/lib/owner-reports.server");
    return { settings: await getOwnerReportSettings(), job: await getOwnerReportJobState() };
  });

export const saveOwnerReportConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveOwnerReportSettings } = await import("@/lib/owner-reports.server");
    return saveOwnerReportSettings(data as any);
  });

export const getOwnerReportAnalyticsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getOwnerReportAnalytics } = await import("@/lib/owner-reports.server");
    return getOwnerReportAnalytics();
  });

export const generateOwnerReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { ownerId: string; templateCode?: string; periodDays?: number; useAi?: boolean }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateOwnerReport } = await import("@/lib/owner-reports.server");
    return generateOwnerReport({ ...data, actor: actorEmail(context.claims) ?? "crm" });
  });

export const sendOwnerReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { sendOwnerReport } = await import("@/lib/owner-reports.server");
    return sendOwnerReport(data.reportId, actorEmail(context.claims));
  });

export const setOwnerReportStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { setOwnerReportStatus } = await import("@/lib/owner-reports.server");
    return setOwnerReportStatus(data.reportId, data.status, actorEmail(context.claims));
  });

export const saveOwnerReportScheduleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string | null;
      ownerId: string;
      templateCode?: string;
      frequency?: string;
      hour?: number;
      autoSend?: boolean;
      isActive?: boolean;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { upsertOwnerReportSchedule } = await import("@/lib/owner-reports.server");
    return upsertOwnerReportSchedule(data);
  });

export const deleteOwnerReportScheduleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { deleteOwnerReportSchedule } = await import("@/lib/owner-reports.server");
    return deleteOwnerReportSchedule(data.id);
  });

export const runOwnerReportSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runOwnerReportSweep } = await import("@/lib/owner-reports.server");
    return runOwnerReportSweep(data.limit);
  });

export const resumeOwnerReportJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeOwnerReportJob } = await import("@/lib/owner-reports.server");
    return resumeOwnerReportJob();
  });
