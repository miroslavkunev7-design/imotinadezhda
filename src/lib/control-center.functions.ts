// Автоматизация №20 — API слой (typed RPC) за „Контролен Център и Анализи“.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const getControlCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { days?: number }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getControlCenterBoard } = await import("@/lib/control-center.server");
    return getControlCenterBoard(Number(data?.days ?? 30));
  });

export const saveKpiTargetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveTarget } = await import("@/lib/control-center.server");
    return saveTarget(data as never);
  });

export const deleteKpiTargetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { deleteTarget } = await import("@/lib/control-center.server");
    return deleteTarget(data.id);
  });

export const takeKpiSnapshotFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { takeSnapshot } = await import("@/lib/control-center.server");
    return takeSnapshot(actorEmail(context.claims));
  });

export const generateKpiBriefingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { days?: number }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateBriefing } = await import("@/lib/control-center.server");
    return generateBriefing(Number(data?.days ?? 30), actorEmail(context.claims));
  });

export const deleteKpiBriefingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { deleteBriefing } = await import("@/lib/control-center.server");
    return deleteBriefing(data.id);
  });

export const saveCcSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveCcSettings } = await import("@/lib/control-center.server");
    return saveCcSettings(data as never);
  });

export const runCcSweepNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runControlCenterSweep } = await import("@/lib/control-center.server");
    return runControlCenterSweep();
  });

export const resumeCcJobFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeCcJob } = await import("@/lib/control-center.server");
    return resumeCcJob();
  });

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getAdminDashboard: loadDashboard } = await import("@/lib/control-center.server");
    return loadDashboard();
  });
