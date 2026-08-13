import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin, assertAdminOrOwnBroker, assertCrmAccess } from "@/lib/auth/crm-access";
import { resolveServerDb, type ServerDb } from "@/lib/supabase-server-db";
import { resolveSupabaseServiceKey } from "@/lib/supabase-env";

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

type CrmCtx = { userId: string; supabase: ServerDb; claims: unknown };

function crmDb(ctx: CrmCtx) {
  return resolveServerDb(ctx.supabase);
}

function serviceAdmin() {
  if (!resolveSupabaseServiceKey()) {
    throw new Error("Липсва SUPABASE_SERVICE_ROLE_KEY — service role key е нужен за тази операция.");
  }
  return supabaseAdmin;
}

// ============ CLIENTS ============
export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = crmDb(context);
    const access = await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    let q = db
      .from("clients")
      .select("*, cities:search_city_id(name, slug), quarters:search_quarter_id(name), brokers:assigned_broker_id(full_name)")
      .order("created_at", { ascending: false });
    if (!access.isAdmin) {
      if (access.brokerId) q = q.eq("assigned_broker_id", access.brokerId);
      else q = q.eq("created_by", context.userId);
    }
    const { data, error } = await q;
    if (error) {
      const plain = db.from("clients").select("*").order("created_at", { ascending: false });
      const scoped = !access.isAdmin
        ? (access.brokerId
          ? plain.eq("assigned_broker_id", access.brokerId)
          : plain.eq("created_by", context.userId))
        : plain;
      const retry = await scoped;
      if (retry.error) throw new Error(retry.error.message);
      return retry.data ?? [];
    }
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
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { id, ...payload } = data;
    if (payload.email === "") payload.email = null;
    const op = id
      ? db.from("clients").update(payload).eq("id", id).select().single()
      : db.from("clients").insert({ ...payload, created_by: context.userId }).select().single();
    const { data: row, error } = await op;
    if (error) throw new Error(error.message);

    // Auto-match if buyer with search criteria
    if (row && row.client_type === "buyer") {
      await runMatchForClient(row.id, db);
    }
    return row;
  });

export const updateClientDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      deal_stage: z.string().max(40).nullable().optional(),
      deal_started_at: z.string().datetime().nullable().optional(),
      mortgage_data: z.record(z.string(), z.any()).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { id, ...payload } = data;
    const { data: row, error } = await db
      .from("clients").update(payload).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { error } = await db.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Депозит + харесан имот за клиент. */
export const updateClientDepositInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      deposit_amount: z.number().nonnegative().nullable().optional(),
      deposit_currency: z.string().max(8).nullable().optional(),
      deposit_date: z.string().max(20).nullable().optional(),
      deposit_method: z.string().max(40).nullable().optional(),
      deposit_status: z.string().max(40).nullable().optional(),
      deposit_note: z.string().max(2000).nullable().optional(),
      interest_property_id: z.string().uuid().nullable().optional(),
      interest_note: z.string().max(2000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const { id, ...payload } = data;
    const { data: row, error } = await db
      .from("clients")
      .update(payload as never)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Търсене на публикувани/вътрешни имоти за връзка към клиент. */
export const searchPropertiesForLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().max(120).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    let q = db
      .from("properties")
      .select("id, title, price, currency, area_sqm, rooms, is_published, cities:city_id(name)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data.q?.trim()) q = q.ilike("title", `%${data.q.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getClientDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { data: rows, error } = await db
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
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { error } = await db.from("client_documents").insert({ ...data, uploaded_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { error } = await db.from("client_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ BROKERS ============
export const listBrokers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = crmDb(context);
    const access = await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    let q = db.from("brokers").select("*").order("created_at", { ascending: false });
    if (!access.isAdmin) {
      if (!access.brokerId) throw new Error("Forbidden — admin only");
      q = q.eq("id", access.brokerId);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const brokerSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  user_id: z.preprocess(
    (v) => {
      if (v === "" || v === undefined || v === null) return null;
      if (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())) {
        return v.trim();
      }
      return null;
    },
    z.string().uuid().nullable(),
  ),
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
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { id, ...payload } = data;
    if (payload.email === "") payload.email = null;
    if (payload.photo_url === "") payload.photo_url = null;
    const op = id
      ? db.from("brokers").update(payload).eq("id", id).select().single()
      : db.from("brokers").insert(payload).select().single();
    const { data: row, error } = await op;
    if (error) throw new Error(error.message);
    return row;
  });

export const createBrokerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    email: z.string().email().max(200),
    password: z.string().min(8).max(200),
    full_name: z.string().min(2).max(200),
    phone: z.string().max(40).optional().nullable(),
    photo_url: z.string().url().optional().nullable().or(z.literal("")),
    license_number: z.string().max(100).optional().nullable(),
    bio: z.string().max(2000).optional().nullable(),
    is_active: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));

    // 1) Create auth user (email confirmed so the broker can sign in immediately)
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPassword = data.password.trim();
    const { data: created, error: authErr } = await serviceAdmin().auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (authErr || !created?.user) throw new Error(authErr?.message ?? "Грешка при създаване на акаунта");
    const newUserId = created.user.id;


    // 2) Insert broker row linked to the new auth user
    const { data: row, error } = await db.from("brokers").insert({
      user_id: newUserId,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone || null,
      photo_url: data.photo_url || null,
      license_number: data.license_number || null,
      bio: data.bio || null,
      is_active: data.is_active,
    }).select().single();

    if (error) {
      // Rollback the auth user if broker insert fails
      await serviceAdmin().auth.admin.deleteUser(newUserId).catch(() => {});
      throw new Error(error.message);
    }

    const { error: roleErr } = await db
      .from("user_roles")
      .insert({ user_id: newUserId, role: "broker" as any });
    if (roleErr && !roleErr.message.includes("duplicate")) {
      console.warn("[createBrokerAccount] broker role insert:", roleErr.message);
    }

    return row;
  });

export const deleteBroker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { error } = await db.from("brokers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignBrokerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { error } = await db.from("user_roles").insert({ user_id: data.user_id, role: "broker" as any });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

// ============ BROKER ROLES MANAGEMENT ============
const ROLE_VALUES = ["admin", "boss", "head_broker", "secretary", "broker", "consultant", "rental_dept", "agent", "user"] as const;
export type BrokerRole = typeof ROLE_VALUES[number];

// ============ ADMIN: RESET BROKER PASSWORD (without old) ============
export const resetBrokerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    broker_id: z.string().uuid(),
    new_password: z.string().min(8).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    // 1) Validate password complexity
    const p = data.new_password;
    if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) {
      throw new Error("Паролата трябва да съдържа малка, главна буква и цифра");
    }
    // 2) Find the broker's auth user_id
    const { data: broker, error: bErr } = await db
      .from("brokers").select("user_id, full_name, email").eq("id", data.broker_id).maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!broker?.user_id) throw new Error("Брокерът няма свързан акаунт за вход");
    // 3) Update via Auth Admin API (no old password required)
    const { error: upErr } = await serviceAdmin().auth.admin.updateUserById(broker.user_id, { password: p });
    if (upErr) throw new Error(upErr.message);
    return { ok: true, email: broker.email };
  });

export const getBrokerRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { data: rows, error } = await db
      .from("user_roles").select("role").eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => r.role as BrokerRole);
  });

export const setBrokerRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    user_id: z.string().uuid(),
    roles: z.array(z.enum(ROLE_VALUES)).min(0).max(8),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    // Replace all roles for this user atomically
    const { error: delErr } = await db.from("user_roles").delete().eq("user_id", data.user_id);
    if (delErr) throw new Error(delErr.message);
    if (data.roles.length > 0) {
      const rows = data.roles.map((role) => ({ user_id: data.user_id, role: role as any }));
      const { error: insErr } = await db.from("user_roles").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true, roles: data.roles };
  });

// ============ MATCHING ============
async function runMatchForClient(clientId: string, db: ServerDb) {
  const { data: client } = await db.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (!client || client.client_type !== "buyer") return [];
  let q = db.from("properties").select("id, price, area_sqm, rooms, city_id, quarter_id, property_type, status, title")
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
    await db.from("property_matches").upsert(matches, { onConflict: "property_id,client_id" });
  }
  return matches;
}

async function runMatchForProperty(propertyId: string, db: ServerDb) {
  const { data: prop } = await db.from("properties").select("*").eq("id", propertyId).maybeSingle();
  if (!prop) return [];
  let q = db.from("clients").select("*").eq("client_type", "buyer").eq("status", "active");
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
    await db.from("property_matches").upsert(matches, { onConflict: "property_id,client_id" });
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
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const matches = await runMatchForProperty(data.property_id, db);
    return { matches: matches.length };
  });

export const listMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { data, error } = await db
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
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { count } = await db
      .from("property_matches").select("id", { count: "exact", head: true }).eq("status", "new");
    return { count: count ?? 0 };
  });

export const updateMatchStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["new", "contacted", "interested", "rejected"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { error } = await db.from("property_matches").update({ status: data.status, notified: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CONTRACTS ============
export const listContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { data, error } = await db
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
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { error } = await db.from("generated_contracts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ BROKER DETAILS (admin) ============
export const getBrokerDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ broker_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdminOrOwnBroker(context.userId, data.broker_id, context.supabase, authEmail(context.claims));
    const [{ data: broker }, { data: clients }, { data: tasks }] = await Promise.all([
      db.from("brokers").select("*").eq("id", data.broker_id).maybeSingle(),
      db
        .from("clients")
        .select("id, full_name, phone, email, client_type, status, cities:search_city_id(name)")
        .eq("assigned_broker_id", data.broker_id)
        .order("created_at", { ascending: false }),
      db
        .from("broker_tasks")
        .select("*, clients:client_id(full_name, phone, email)")
        .eq("broker_id", data.broker_id)
        .order("is_completed", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);
    if (!broker) throw new Error("Брокерът не е намерен");
    return { broker, clients: clients ?? [], tasks: tasks ?? [] };
  });

const taskSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  broker_id: z.string().uuid(),
  client_id: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(300),
  description: z.string().max(2000).optional().nullable(),
  task_type: z.enum(["general", "message_client", "call_client", "meeting"]).default("general"),
  due_at: z.string().optional().nullable(),
  is_completed: z.boolean().optional(),
});

export const upsertBrokerTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => taskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdminOrOwnBroker(context.userId, data.broker_id, context.supabase, authEmail(context.claims));
    const { id, ...payload } = data;
    const op = id
      ? db.from("broker_tasks").update(payload).eq("id", id).select().single()
      : db.from("broker_tasks").insert({ ...payload, created_by: context.userId }).select().single();
    const { data: row, error } = await op;
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleBrokerTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_completed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    const { data: taskRow } = await db
      .from("broker_tasks")
      .select("broker_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!taskRow?.broker_id) throw new Error("Задачата не е намерена");
    await assertAdminOrOwnBroker(context.userId, taskRow.broker_id, context.supabase, authEmail(context.claims));
    const patch: any = {
      is_completed: data.is_completed,
      completed_at: data.is_completed ? new Date().toISOString() : null,
    };
    if (data.is_completed) {
      const { data: task } = await db
        .from("broker_tasks")
        .select("*, clients:client_id(full_name)")
        .eq("id", data.id)
        .maybeSingle();
      if (task && (task.task_type === "message_client" || task.task_type === "call_client")) {
        patch.auto_action_log = {
          performed_at: new Date().toISOString(),
          type: task.task_type,
          client: task.clients?.full_name ?? null,
          note: task.task_type === "message_client"
            ? `Автоматично отбелязано като изпратено съобщение до ${task.clients?.full_name ?? "клиента"}`
            : `Автоматично отбелязано като проведено обаждане до ${task.clients?.full_name ?? "клиента"}`,
        };
      }
    }
    const { error } = await db.from("broker_tasks").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBrokerTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    const { data: taskRow } = await db
      .from("broker_tasks")
      .select("broker_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!taskRow?.broker_id) throw new Error("Задачата не е намерена");
    await assertAdminOrOwnBroker(context.userId, taskRow.broker_id, context.supabase, authEmail(context.claims));
    const { error } = await db.from("broker_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignClientToBroker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ broker_id: z.string().uuid(), client_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertAdminOrOwnBroker(context.userId, data.broker_id, context.supabase, authEmail(context.claims));
    const { error } = await db
      .from("clients")
      .update({ assigned_broker_id: data.broker_id })
      .eq("id", data.client_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unassignClientFromBroker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ client_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    const { data: client } = await db
      .from("clients")
      .select("assigned_broker_id")
      .eq("id", data.client_id)
      .maybeSingle();
    if (!client?.assigned_broker_id) throw new Error("Клиентът не е намерен");
    await assertAdminOrOwnBroker(context.userId, client.assigned_broker_id, context.supabase, authEmail(context.claims));
    const { error } = await db
      .from("clients")
      .update({ assigned_broker_id: null })
      .eq("id", data.client_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUnassignedClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = crmDb(context);
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const { data, error } = await db
      .from("clients")
      .select("id, full_name, phone, email, client_type, cities:search_city_id(name)")
      .is("assigned_broker_id", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

