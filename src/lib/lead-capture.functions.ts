import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import { resolveServerDb, type ServerDb } from "@/lib/supabase-server-db";
import { ingestLead } from "@/lib/lead-capture";

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

async function gate(ctx: { userId: string; supabase: ServerDb; claims: unknown }) {
  await assertCrmAccess(ctx.userId, ctx.supabase, authEmail(ctx.claims));
  return resolveServerDb(ctx.supabase) as ServerDb & { from: (t: string) => any };
}

function hoursAgo(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

export const listLeadDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await gate(context);
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const [{ data: inquiries, error: inqErr }, { data: brokers }, { data: mortgages }] = await Promise.all([
      db
        .from("inquiries")
        .select("id, name, email, phone, message, status, notes, created_at, source, channel, intent, urgency, score, city_hint, budget_min, budget_max, client_id, assigned_broker_id, duplicate_of, page_url, ai_summary, first_response_at, property_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(400),
      db.from("brokers").select("id, full_name, is_active").eq("is_active", true).order("full_name"),
      db.from("mortgage_applications").select("*").order("created_at", { ascending: false }).limit(80),
    ]);
    if (inqErr) throw new Error(inqErr.message);

    const propertyIds = [...new Set((inquiries ?? []).map((r: any) => r.property_id).filter(Boolean))];
    const { data: props } = propertyIds.length
      ? await db.from("properties").select("id, title").in("id", propertyIds)
      : { data: [] as { id: string; title: string }[] };
    const propMap = new Map((props ?? []).map((p: any) => [p.id, p.title]));
    const brokerMap = new Map((brokers ?? []).map((b: any) => [b.id, b.full_name]));
    const rows = (inquiries ?? []).map((r: any) => ({
      ...r,
      properties: r.property_id ? { title: propMap.get(r.property_id) ?? null } : null,
      brokers: r.assigned_broker_id ? { full_name: brokerMap.get(r.assigned_broker_id) ?? null } : null,
    }));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;

    const bySource: Record<string, number> = {};
    const byIntent: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let scoreSum = 0;
    for (const r of rows) {
      const src = r.source || "website";
      const intent = r.intent || "other";
      const ch = r.channel || "web";
      bySource[src] = (bySource[src] ?? 0) + 1;
      byIntent[intent] = (byIntent[intent] ?? 0) + 1;
      byChannel[ch] = (byChannel[ch] ?? 0) + 1;
      const day = String(r.created_at).slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + 1;
      scoreSum += Number(r.score ?? 0);
    }

    const open = rows.filter((r: any) => r.status !== "closed");
    return {
      inquiries: rows,
      brokers: brokers ?? [],
      mortgages: mortgages ?? [],
      analytics: {
        total90: rows.length,
        newToday: rows.filter((r: any) => new Date(r.created_at) >= todayStart).length,
        new7d: rows.filter((r: any) => new Date(r.created_at).getTime() >= weekAgo).length,
        open: open.length,
        unassigned: open.filter((r: any) => !r.assigned_broker_id).length,
        duplicates: rows.filter((r: any) => r.duplicate_of).length,
        avgScore: rows.length ? Math.round(scoreSum / rows.length) : 0,
        slaOverdue: open.filter((r: any) => r.status === "new" && hoursAgo(r.created_at) >= 1).length,
        bySource,
        byIntent,
        byChannel,
        byDay,
      },
    };
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "in_progress", "closed"]).optional(),
        notes: z.string().max(4000).optional(),
        assigned_broker_id: z.string().uuid().nullable().optional(),
        first_response: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.assigned_broker_id !== undefined) patch.assigned_broker_id = data.assigned_broker_id;
    if (data.first_response) patch.first_response_at = new Date().toISOString();
    const { error } = await db.from("inquiries").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await db.from("lead_events").insert({
      inquiry_id: data.id,
      kind: data.status ? "status" : data.assigned_broker_id !== undefined ? "assigned" : "note",
      payload: patch,
    });
    return { ok: true };
  });

export const captureManualLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(2).max(120),
        phone: z.string().max(40).optional(),
        email: z.union([z.literal(""), z.string().email()]).optional(),
        message: z.string().max(2000).optional(),
        source: z.enum(["phone", "email", "facebook", "manual", "other"]).default("phone"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await gate(context);
    const result = await ingestLead({
      name: data.name,
      phone: data.phone,
      email: data.email,
      message: data.message,
      source: data.source,
      channel: data.source === "phone" ? "phone" : data.source === "email" ? "email" : data.source === "facebook" ? "messenger" : "crm",
      raw: { captured_by: context.userId },
    });
    if (!result.ok) throw new Error("Празен запис");
    return result;
  });

export const listLeadEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inquiry_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    const { data: events, error } = await db
      .from("lead_events")
      .select("*")
      .eq("inquiry_id", data.inquiry_id)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return events ?? [];
  });
