// Таблица с референции (Visual Master Board) — състояние на одобренията и етапите.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import { looseDb } from "@/lib/supabase-loose-db";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

function actorName(claims: unknown): string {
  const c = claims as { email?: string; user_metadata?: { full_name?: string } } | undefined;
  return c?.user_metadata?.full_name || c?.email || "CRM потребител";
}

export type BoardState = {
  route: string;
  approved: boolean;
  approved_by_name: string | null;
  approved_at: string | null;
  stage_flags: Record<string, boolean>;
  match_percent: number | null;
  notes: string | null;
};

export const listBoardState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BoardState[]> => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { data, error } = await looseDb(context.supabase)
      .from("visual_board_pages")
      .select("route, approved, approved_by_name, approved_at, stage_flags, match_percent, notes");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      route: r.route,
      approved: Boolean(r.approved),
      approved_by_name: r.approved_by_name ?? null,
      approved_at: r.approved_at ?? null,
      stage_flags: (r.stage_flags ?? {}) as Record<string, boolean>,
      match_percent: r.match_percent == null ? null : Number(r.match_percent),
      notes: r.notes ?? null,
    }));
  });

export const setBoardApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { route: string; approved: boolean }) => d)
  .handler(async ({ data, context }): Promise<BoardState> => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const row = {
      route: data.route,
      approved: data.approved,
      approved_by: data.approved ? context.userId : null,
      approved_by_name: data.approved ? actorName(context.claims) : null,
      approved_at: data.approved ? new Date().toISOString() : null,
    };
    const { data: saved, error } = await looseDb(context.supabase)
      .from("visual_board_pages")
      .upsert(row, { onConflict: "route" })
      .select("route, approved, approved_by_name, approved_at, stage_flags, match_percent, notes")
      .single();
    if (error) throw new Error(error.message);
    return {
      route: saved.route,
      approved: Boolean(saved.approved),
      approved_by_name: saved.approved_by_name ?? null,
      approved_at: saved.approved_at ?? null,
      stage_flags: (saved.stage_flags ?? {}) as Record<string, boolean>,
      match_percent: saved.match_percent == null ? null : Number(saved.match_percent),
      notes: saved.notes ?? null,
    };
  });

export const setBoardProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      route: string;
      stage_flags: Record<string, boolean>;
      match_percent?: number | null;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }): Promise<BoardState> => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { data: saved, error } = await looseDb(context.supabase)
      .from("visual_board_pages")
      .upsert(
        {
          route: data.route,
          stage_flags: data.stage_flags,
          match_percent: data.match_percent ?? null,
          notes: data.notes ?? null,
        },
        { onConflict: "route" },
      )
      .select("route, approved, approved_by_name, approved_at, stage_flags, match_percent, notes")
      .single();
    if (error) throw new Error(error.message);
    return {
      route: saved.route,
      approved: Boolean(saved.approved),
      approved_by_name: saved.approved_by_name ?? null,
      approved_at: saved.approved_at ?? null,
      stage_flags: (saved.stage_flags ?? {}) as Record<string, boolean>,
      match_percent: saved.match_percent == null ? null : Number(saved.match_percent),
      notes: saved.notes ?? null,
    };
  });

export type BoardStage = {
  id: string;
  route: string;
  title: string;
  detail: string | null;
  position: number;
  done: boolean;
  done_by_name: string | null;
  done_at: string | null;
};

const STAGE_COLS = "id, route, title, detail, position, done, done_by_name, done_at";

function mapStage(r: Record<string, unknown>): BoardStage {
  return {
    id: String(r.id),
    route: String(r.route),
    title: String(r.title),
    detail: (r.detail as string | null) ?? null,
    position: Number(r.position ?? 0),
    done: Boolean(r.done),
    done_by_name: (r.done_by_name as string | null) ?? null,
    done_at: (r.done_at as string | null) ?? null,
  };
}

export const listBoardStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { route: string }) => d)
  .handler(async ({ data, context }): Promise<BoardStage[]> => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { data: rows, error } = await looseDb(context.supabase)
      .from("visual_board_stages")
      .select(STAGE_COLS)
      .eq("route", data.route)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => mapStage(r as Record<string, unknown>));
  });

export const addBoardStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { route: string; title: string; detail?: string | null }) => d)
  .handler(async ({ data, context }): Promise<BoardStage> => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const title = data.title.trim();
    if (!title) throw new Error("Стадият трябва да има име.");
    const { data: last } = await looseDb(context.supabase)
      .from("visual_board_stages")
      .select("position")
      .eq("route", data.route)
      .order("position", { ascending: false })
      .limit(1);
    const nextPos = (last?.[0]?.position ?? 0) + 1;
    const { data: saved, error } = await looseDb(context.supabase)
      .from("visual_board_stages")
      .insert({
        route: data.route,
        title,
        detail: data.detail?.trim() || null,
        position: nextPos,
        created_by: context.userId,
      })
      .select(STAGE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return mapStage(saved as Record<string, unknown>);
  });

export const setBoardStageDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; done: boolean }) => d)
  .handler(async ({ data, context }): Promise<BoardStage> => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { data: saved, error } = await looseDb(context.supabase)
      .from("visual_board_stages")
      .update({
        done: data.done,
        done_by_name: data.done ? actorName(context.claims) : null,
        done_at: data.done ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .select(STAGE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return mapStage(saved as Record<string, unknown>);
  });

export const deleteBoardStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { error } = await looseDb(context.supabase).from("visual_board_stages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
