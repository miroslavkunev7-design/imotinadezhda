import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import { resolveServerDb } from "@/lib/supabase-server-db";

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

export const VIEWING_STATUSES = ["planned", "confirmed", "done", "cancelled", "no_show"] as const;
export type ViewingStatus = (typeof VIEWING_STATUSES)[number];

export const VIEWING_STATUS_LABEL: Record<ViewingStatus, string> = {
  planned: "Планиран",
  confirmed: "Потвърден",
  done: "Проведен",
  cancelled: "Отказан",
  no_show: "Недошъл",
};

const uuid = z.string().uuid();
const optUuid = uuid.optional().nullable();
const statusSchema = z.enum(VIEWING_STATUSES);

const viewingSchema = z.object({
  id: optUuid,
  client_id: optUuid,
  property_id: optUuid,
  archived_property_id: optUuid,
  broker_id: uuid,
  scheduled_at: z.string().min(10).max(40),
  location: z.string().max(500).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  property_title: z.string().max(300).optional().nullable(),
  status: statusSchema.default("planned"),
});

const SELECT =
  "id, client_id, property_id, archived_property_id, broker_id, broker_task_id, scheduled_at, location, notes, property_title, status, reminded_day_before_at, reminded_hours_before_at, created_at, updated_at, clients:client_id(full_name, phone, email), brokers:broker_id(full_name, phone, email), properties:property_id(title, address)";
const SELECT_PLAIN =
  "id, client_id, property_id, archived_property_id, broker_id, broker_task_id, scheduled_at, location, notes, property_title, status, reminded_day_before_at, reminded_hours_before_at, created_at, updated_at";

function scopeBroker<T extends { eq: (c: string, v: string) => T }>(q: T, access: { isAdmin: boolean; brokerId: string | null }) {
  if (!access.isAdmin && access.brokerId) return q.eq("broker_id", access.brokerId);
  return q;
}

function relName(rel: { full_name?: string } | { full_name?: string }[] | null | undefined) {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0]?.full_name ?? null : rel.full_name ?? null;
}

async function syncBrokerTask(
  db: ReturnType<typeof resolveServerDb>,
  viewing: {
    id: string;
    broker_id: string;
    client_id: string | null;
    scheduled_at: string;
    location: string | null;
    notes: string | null;
    property_title: string | null;
    status: string;
    broker_task_id: string | null;
  },
  userId: string,
  clientName?: string | null,
) {
  const done = ["done", "cancelled", "no_show"].includes(viewing.status);
  const title = `Оглед — ${clientName || "клиент"}${viewing.property_title ? ` · ${viewing.property_title}` : ""}`;
  const payload: Record<string, unknown> = {
    broker_id: viewing.broker_id,
    client_id: viewing.client_id,
    title,
    description: [viewing.location, viewing.notes].filter(Boolean).join("\n") || null,
    due_at: viewing.scheduled_at,
    task_type: "viewing",
    is_completed: done,
    completed_at: done ? new Date().toISOString() : null,
    reminder_minutes: 120,
    reminded_at: new Date().toISOString(),
    auto_action_log: {
      kind: "viewing",
      viewing_id: viewing.id,
      end_at: new Date(new Date(viewing.scheduled_at).getTime() + 60 * 60 * 1000).toISOString(),
    },
  };

  if (viewing.broker_task_id) {
    const { error } = await db.from("broker_tasks").update(payload as never).eq("id", viewing.broker_task_id);
    if (!error) return viewing.broker_task_id;
  }

  const insert = { ...payload, created_by: userId };
  let { data, error } = await db.from("broker_tasks").insert(insert as never).select("id").maybeSingle();
  if (error && /client_id/i.test(error.message)) {
    const { client_id: _c, ...rest } = insert;
    ({ data, error } = await db.from("broker_tasks").insert(rest as never).select("id").maybeSingle());
  }
  if (error || !data) return viewing.broker_task_id;
  await db.from("viewings").update({ broker_task_id: data.id } as never).eq("id", viewing.id);
  return data.id as string;
}

export const listViewings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        from: z.string().max(40).optional(),
        to: z.string().max(40).optional(),
        broker_id: optUuid,
        client_id: optUuid,
        status: statusSchema.optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase) as any;
    const access = await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    let q = db.from("viewings").select(SELECT).order("scheduled_at", { ascending: true });
    q = scopeBroker(q, access);
    if (data.from) q = q.gte("scheduled_at", data.from);
    if (data.to) q = q.lte("scheduled_at", data.to);
    if (data.broker_id) q = q.eq("broker_id", data.broker_id);
    if (data.client_id) q = q.eq("client_id", data.client_id);
    if (data.status) q = q.eq("status", data.status);
    let { data: rows, error } = await q;
    if (error) {
      let plain = db.from("viewings").select(SELECT_PLAIN).order("scheduled_at", { ascending: true });
      plain = scopeBroker(plain, access);
      if (data.from) plain = plain.gte("scheduled_at", data.from);
      if (data.to) plain = plain.lte("scheduled_at", data.to);
      if (data.broker_id) plain = plain.eq("broker_id", data.broker_id);
      if (data.client_id) plain = plain.eq("client_id", data.client_id);
      if (data.status) plain = plain.eq("status", data.status);
      const retry = await plain;
      if (retry.error) throw new Error(error.message);
      rows = retry.data;
    }
    return rows ?? [];
  });

export const upsertViewing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => viewingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase) as any;
    const access = await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    if (!access.isAdmin && access.brokerId && data.broker_id !== access.brokerId) {
      throw new Error("Можете да насрочвате огледи само към своя график.");
    }

    let propertyTitle = data.property_title?.trim() || null;
    if (!propertyTitle && data.property_id) {
      const { data: prop } = await db.from("properties").select("title, address").eq("id", data.property_id).maybeSingle();
      propertyTitle = prop?.title ?? prop?.address ?? null;
    }
    if (!propertyTitle && data.archived_property_id) {
      const { data: arch } = await db.from("archived_properties").select("title, address").eq("id", data.archived_property_id).maybeSingle();
      propertyTitle = arch?.title ?? arch?.address ?? null;
    }

    const scheduledAt = new Date(data.scheduled_at).toISOString();
    const clean: Record<string, unknown> = {
      client_id: data.client_id ?? null,
      property_id: data.property_id ?? null,
      archived_property_id: data.archived_property_id ?? null,
      broker_id: data.broker_id,
      scheduled_at: scheduledAt,
      location: data.location?.trim() || null,
      notes: data.notes?.trim() || null,
      property_title: propertyTitle,
      status: data.status ?? "planned",
      updated_at: new Date().toISOString(),
    };

    const op = data.id
      ? db.from("viewings").update(clean).eq("id", data.id).select(SELECT).maybeSingle()
      : db.from("viewings").insert({ ...clean, created_by: context.userId }).select(SELECT).maybeSingle();
    const { data: row, error } = await op;
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Огледът не беше записан.");

    const clientName = relName(row.clients);
    await syncBrokerTask(
      db,
      {
        id: row.id,
        broker_id: row.broker_id,
        client_id: row.client_id,
        scheduled_at: row.scheduled_at,
        location: row.location,
        notes: row.notes,
        property_title: row.property_title,
        status: row.status,
        broker_task_id: row.broker_task_id,
      },
      context.userId,
      clientName,
    );

    const { data: fresh } = await db.from("viewings").select(SELECT).eq("id", row.id).maybeSingle();
    return fresh ?? row;
  });

export const setViewingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, status: statusSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase) as any;
    const access = await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    let q = db.from("viewings").select(SELECT).eq("id", data.id);
    q = scopeBroker(q, access);
    const { data: current, error: readErr } = await q.maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Огледът не е намерен.");

    const { data: row, error } = await db
      .from("viewings")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select(SELECT)
      .maybeSingle();
    if (error) throw new Error(error.message);

    await syncBrokerTask(
      db,
      {
        id: row.id,
        broker_id: row.broker_id,
        client_id: row.client_id,
        scheduled_at: row.scheduled_at,
        location: row.location,
        notes: row.notes,
        property_title: row.property_title,
        status: row.status,
        broker_task_id: row.broker_task_id,
      },
      context.userId,
      relName(row.clients),
    );
    return row;
  });

export const deleteViewing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase) as any;
    const access = await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    let q = db.from("viewings").select("id, broker_task_id, broker_id").eq("id", data.id);
    q = scopeBroker(q, access);
    const { data: row, error: readErr } = await q.maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!row) throw new Error("Огледът не е намерен.");
    if (row.broker_task_id) await db.from("broker_tasks").delete().eq("id", row.broker_task_id);
    const { error } = await db.from("viewings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getViewingStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = resolveServerDb(context.supabase) as any;
    const access = await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);
    const end7 = new Date(startToday);
    end7.setDate(end7.getDate() + 7);
    const from30 = new Date(startToday);
    from30.setDate(from30.getDate() - 30);

    let q = db
      .from("viewings")
      .select("id, status, scheduled_at, broker_id, brokers:broker_id(full_name)")
      .gte("scheduled_at", from30.toISOString())
      .lt("scheduled_at", end7.toISOString());
    q = scopeBroker(q, access);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{
      id: string;
      status: ViewingStatus;
      scheduled_at: string;
      broker_id: string;
      brokers?: { full_name?: string } | { full_name?: string }[] | null;
    }>;

    const todayIso = startToday.toISOString();
    const tomorrowIso = endToday.toISOString();
    const weekIso = end7.toISOString();

    const today = list.filter((v) => v.scheduled_at >= todayIso && v.scheduled_at < tomorrowIso);
    const upcoming7 = list.filter(
      (v) => v.scheduled_at >= todayIso && v.scheduled_at < weekIso && ["planned", "confirmed"].includes(v.status),
    );
    const last30 = list.filter((v) => v.scheduled_at >= from30.toISOString() && v.scheduled_at < tomorrowIso);
    const decided = last30.filter((v) => v.status !== "cancelled");
    const confirmedish = decided.filter((v) => v.status === "confirmed" || v.status === "done");
    const noShows = last30.filter((v) => v.status === "no_show");

    const byBrokerMap = new Map<string, { name: string; total: number; noShows: number; confirmed: number }>();
    for (const v of last30) {
      const name = Array.isArray(v.brokers) ? v.brokers[0]?.full_name : v.brokers?.full_name;
      const cur = byBrokerMap.get(v.broker_id) ?? {
        name: name || "Брокер",
        total: 0,
        noShows: 0,
        confirmed: 0,
      };
      cur.total++;
      if (v.status === "no_show") cur.noShows++;
      if (v.status === "confirmed" || v.status === "done") cur.confirmed++;
      byBrokerMap.set(v.broker_id, cur);
    }

    return {
      todayCount: today.length,
      today,
      upcoming7Count: upcoming7.length,
      confirmationRate: decided.length ? Math.round((confirmedish.length / decided.length) * 100) : 0,
      noShowCount: noShows.length,
      byBroker: Array.from(byBrokerMap.values()).sort((a, b) => b.total - a.total),
    };
  });

export const processViewingReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const { runViewingReminders } = await import("@/lib/viewings-reminders.server");
    return runViewingReminders();
  });
