import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden — admin only");
}

// ============ CLIENTS ============
export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("*, cities:search_city_id(name, slug), quarters:search_quarter_id(name), brokers:assigned_broker_id(full_name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const clientSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  full_name: z.string().min(2).max(200),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  client_type: z.enum(["buyer", "seller", "tenant", "landlord"]).default("buyer"),
  status: z.enum(["active", "inactive", "closed"]).default("active"),
  search_city_id: z.string().uuid().optional().nullable(),
  search_quarter_id: z.string().uuid().optional().nullable(),
  search_property_type: z.string().max(40).optional().nullable(),
  search_status: z.enum(["sale", "rent"]).optional().nullable(),
  budget_min: z.number().optional().nullable(),
  budget_max: z.number().optional().nullable(),
  currency: z.string().max(8).default("EUR"),
  rooms_min: z.number().int().optional().nullable(),
  rooms_max: z.number().int().optional().nullable(),
  area_min: z.number().optional().nullable(),
  area_max: z.number().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  assigned_broker_id: z.string().uuid().optional().nullable(),
});

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => clientSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...payload } = data;
    if (payload.email === "") payload.email = null;
    const op = id
      ? supabaseAdmin.from("clients").update(payload).eq("id", id).select().single()
      : supabaseAdmin.from("clients").insert({ ...payload, created_by: context.userId }).select().single();
    const { data: row, error } = await op;
    if (error) throw new Error(error.message);

    // Auto-match if buyer with search criteria
    if (row && row.client_type === "buyer") {
      await runMatchForClient(row.id);
    }
    return row;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClientDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("client_documents").select("*").eq("client_id", data.client_id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    client_id: z.string().uuid(),
    document_type: z.string().min(1).max(64),
    file_url: z.string().url(),
    file_name: z.string().min(1).max(255),
    file_size: z.number().int().optional().nullable(),
    mime_type: z.string().max(120).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("client_documents").insert({ ...data, uploaded_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("client_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ BROKERS ============
export const listBrokers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("brokers").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const brokerSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  user_id: z.preprocess((v) => (v === "" ? null : v), z.string().uuid().optional().nullable()),
  full_name: z.string().min(2).max(200),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  phone: z.string().max(40).optional().nullable(),
  photo_url: z.string().url().optional().nullable().or(z.literal("")),
  license_number: z.string().max(100).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const upsertBroker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => brokerSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...payload } = data;
    if (payload.email === "") payload.email = null;
    if (payload.photo_url === "") payload.photo_url = null;
    const op = id
      ? supabaseAdmin.from("brokers").update(payload).eq("id", id).select().single()
      : supabaseAdmin.from("brokers").insert(payload).select().single();
    const { data: row, error } = await op;
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBroker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("brokers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignBrokerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: "broker" as any });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

// ============ MATCHING ============
async function runMatchForClient(clientId: string) {
  const { data: client } = await supabaseAdmin.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!client || client.client_type !== "buyer") return [];
  let q = supabaseAdmin.from("properties").select("id, price, area_sqm, rooms, city_id, quarter_id, property_type, status, title")
    .eq("is_published", true);
  if (client.search_city_id) q = q.eq("city_id", client.search_city_id);
  if (client.search_quarter_id) q = q.eq("quarter_id", client.search_quarter_id);
  if (client.search_property_type) q = q.eq("property_type", client.search_property_type as any);
  if (client.search_status) q = q.eq("status", client.search_status as any);
  const { data: props } = await q;
  if (!props) return [];
  const matches: any[] = [];
  for (const p of props) {
    const m = scoreMatch(client, p);
    if (m.score >= 50) matches.push({ property_id: p.id, client_id: clientId, score: m.score, match_reasons: m.reasons });
  }
  if (matches.length) {
    await supabaseAdmin.from("property_matches").upsert(matches, { onConflict: "property_id,client_id" });
  }
  return matches;
}

async function runMatchForProperty(propertyId: string) {
  const { data: prop } = await supabaseAdmin.from("properties").select("*").eq("id", propertyId).maybeSingle();
  if (!prop) return [];
  let q = supabaseAdmin.from("clients").select("*").eq("client_type", "buyer").eq("status", "active");
  const { data: clients } = await q;
  if (!clients) return [];
  const matches: any[] = [];
  for (const c of clients) {
    if (c.search_city_id && c.search_city_id !== prop.city_id) continue;
    if (c.search_quarter_id && c.search_quarter_id !== prop.quarter_id) continue;
    if (c.search_property_type && c.search_property_type !== prop.property_type) continue;
    if (c.search_status && c.search_status !== prop.status) continue;
    const m = scoreMatch(c, prop);
    if (m.score >= 50) matches.push({ property_id: propertyId, client_id: c.id, score: m.score, match_reasons: m.reasons });
  }
  if (matches.length) {
    await supabaseAdmin.from("property_matches").upsert(matches, { onConflict: "property_id,client_id" });
  }
  return matches;
}

function scoreMatch(client: any, prop: any) {
  let score = 0;
  const reasons: string[] = [];
  if (client.search_city_id && client.search_city_id === prop.city_id) { score += 25; reasons.push("Същият град"); }
  if (client.search_quarter_id && client.search_quarter_id === prop.quarter_id) { score += 20; reasons.push("Същият квартал"); }
  if (client.search_property_type === prop.property_type) { score += 15; reasons.push("Същият тип имот"); }
  if (client.search_status === prop.status) { score += 10; reasons.push("Същият статус (продажба/наем)"); }
  const price = Number(prop.price);
  if (Number.isFinite(price)) {
    const minOk = client.budget_min == null || price >= Number(client.budget_min);
    const maxOk = client.budget_max == null || price <= Number(client.budget_max);
    if (minOk && maxOk) { score += 20; reasons.push("В бюджета"); }
    else if (client.budget_max && price <= Number(client.budget_max) * 1.1) { score += 10; reasons.push("Близо до бюджета"); }
  }
  const rooms = prop.rooms;
  if (rooms && (client.rooms_min || client.rooms_max)) {
    const minOk = !client.rooms_min || rooms >= client.rooms_min;
    const maxOk = !client.rooms_max || rooms <= client.rooms_max;
    if (minOk && maxOk) { score += 10; reasons.push("Подходящ брой стаи"); }
  }
  return { score, reasons };
}

export const triggerMatchForProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ property_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const matches = await runMatchForProperty(data.property_id);
    return { matches: matches.length };
  });

export const listMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("property_matches")
      .select("*, properties:property_id(title, price, currency, cover_image_url, cities:city_id(name)), clients:client_id(full_name, phone, email)")
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const newMatchesCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { count } = await supabaseAdmin
      .from("property_matches").select("id", { count: "exact", head: true }).eq("status", "new");
    return { count: count ?? 0 };
  });

export const updateMatchStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["new", "contacted", "interested", "rejected"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("property_matches").update({ status: data.status, notified: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CONTRACTS ============
export const listContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("generated_contracts")
      .select("*, clients:client_id(full_name), properties:property_id(title)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("generated_contracts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
