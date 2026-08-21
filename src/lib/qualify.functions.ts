import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aiChatCompletions, resolveAiProvider } from "@/lib/ai-provider";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import { resolveServerDb, type ServerDb } from "@/lib/supabase-server-db";
import {
  combineExtractions,
  extractFromFreeText,
  mergeExtractionIntoClient,
  parseAiQualificationJson,
  qualificationDbPatch,
  scoreClient,
  scoreInquiry,
  type ExtractedQualification,
  type LeadUrgency,
} from "@/lib/qualify-score";

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

type CrmCtx = { userId: string; supabase: ServerDb; claims: unknown };

function crmDb(ctx: CrmCtx) {
  return resolveServerDb(ctx.supabase);
}

const AI_EXTRACT_PROMPT = `Ти си асистент на агенция за недвижими имоти в България.
От свободния текст извлечи квалификация на клиента като JSON (без markdown), със следните полета:
{
  "budget_min": number|null,
  "budget_max": number|null,
  "currency": "EUR"|"BGN"|null,
  "city_name": string|null,
  "quarter_name": string|null,
  "client_type": "buyer"|"seller"|"tenant"|"landlord"|null,
  "search_status": "sale"|"rent"|null,
  "search_property_type": "apartment"|"house"|"office"|"land"|"commercial"|null,
  "rooms_min": number|null,
  "rooms_max": number|null,
  "urgency": "high"|"medium"|"low"|null,
  "intent_summary": string|null
}
Правила: ако няма данни — null. Не измисляй числа. Градове: Бургас, Варна, Шумен, Нови пазар.`;

async function extractWithAi(text: string): Promise<ExtractedQualification | null> {
  if (!resolveAiProvider() || text.trim().length < 8) return null;
  try {
    const res = await aiChatCompletions({
      temperature: 0.1,
      messages: [
        { role: "system", content: AI_EXTRACT_PROMPT },
        { role: "user", content: text.slice(0, 6000) },
      ],
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content ?? "";
    return parseAiQualificationJson(content);
  } catch {
    return null;
  }
}

function digits(phone?: string | null) {
  return (phone ?? "").replace(/\D/g, "");
}

async function resolvePlaceIds(
  db: ServerDb,
  extracted: ExtractedQualification,
): Promise<{ city_id: string | null; quarter_id: string | null }> {
  let city_id: string | null = null;
  let quarter_id: string | null = null;
  if (extracted.city_name) {
    const { data } = await db
      .from("cities")
      .select("id")
      .ilike("name", extracted.city_name.trim())
      .maybeSingle();
    city_id = data?.id ?? null;
  }
  if (extracted.quarter_name) {
    let q = db.from("quarters").select("id, city_id").ilike("name", extracted.quarter_name.trim());
    if (city_id) q = q.eq("city_id", city_id);
    const { data } = await q.limit(1);
    const row = Array.isArray(data) ? data[0] : data;
    quarter_id = row?.id ?? null;
    if (!city_id && row?.city_id) city_id = row.city_id;
  }
  return { city_id, quarter_id };
}

async function relatedInquiries(
  db: ServerDb,
  client: { phone?: string | null; email?: string | null },
) {
  const phone = digits(client.phone);
  const email = (client.email ?? "").trim().toLowerCase();
  const { data } = await db
    .from("inquiries")
    .select("id, message, notes, phone, email, property_id, status")
    .limit(200);
  const rows = data ?? [];
  return rows.filter((r) => {
    if (email && (r.email ?? "").trim().toLowerCase() === email) return true;
    const rp = digits(r.phone);
    return Boolean(phone && rp && (rp === phone || rp.endsWith(phone) || phone.endsWith(rp)));
  });
}

async function matchCountFor(db: ServerDb, clientId: string) {
  const { count } = await db
    .from("property_matches")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  return count ?? 0;
}

type ClientRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  client_type: string;
  status: string;
  search_city_id: string | null;
  search_quarter_id: string | null;
  search_property_type: string | null;
  search_status: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  notes: string | null;
  assigned_broker_id: string | null;
  rooms_min: number | null;
  rooms_max: number | null;
  updated_at: string;
  deal_stage: string | null;
  created_by: string | null;
  lead_score: number | null;
  lead_tier: string | null;
  lead_urgency: string | null;
  qualification_source: string | null;
  qualification_summary: string | null;
  qualification_breakdown: unknown;
  qualified_at: string | null;
  cities?: { name: string; slug: string } | null;
  quarters?: { name: string } | null;
  brokers?: { full_name: string } | null;
};

async function qualifyOneClient(
  db: ServerDb,
  client: ClientRow,
  opts: { useAi: boolean; applyFields: boolean },
) {
  const inquiries = await relatedInquiries(db, client);
  const inquiryText = inquiries
    .map((i) => [i.message, i.notes].filter(Boolean).join("\n"))
    .join("\n");
  const freeText = [client.notes, inquiryText].filter(Boolean).join("\n\n");
  let extracted = extractFromFreeText(freeText);
  let source: "ai" | "heuristic" = "heuristic";

  if (opts.useAi && freeText.trim().length >= 8) {
    const ai = await extractWithAi(freeText);
    if (ai) {
      extracted = combineExtractions(ai, extracted);
      source = "ai";
    }
  }

  const places = await resolvePlaceIds(db, extracted);
  const fieldPatch = opts.applyFields
    ? mergeExtractionIntoClient(client, extracted, places)
    : {};

  const merged = { ...client, ...fieldPatch };
  const matches = await matchCountFor(db, client.id);
  const scored = scoreClient({
    ...merged,
    match_count: matches,
    inquiry_count: inquiries.length,
    urgency: extracted.urgency as LeadUrgency | null,
  });
  const qPatch = qualificationDbPatch(scored, source);

  const { error } = await db
    .from("clients")
    .update({ ...fieldPatch, ...qPatch })
    .eq("id", client.id);
  if (error) throw new Error(error.message);

  return { id: client.id, ...qPatch, applied: fieldPatch };
}

async function qualifyOneInquiry(
  db: ServerDb,
  inquiry: {
    id: string;
    phone: string | null;
    email: string;
    message: string | null;
    notes: string | null;
    property_id: string | null;
    status: string;
  },
  useAi: boolean,
) {
  const freeText = [inquiry.message, inquiry.notes].filter(Boolean).join("\n");
  let extracted = extractFromFreeText(freeText);
  let source: "ai" | "heuristic" = "heuristic";
  if (useAi && freeText.trim().length >= 8) {
    const ai = await extractWithAi(freeText);
    if (ai) {
      extracted = combineExtractions(ai, extracted);
      source = "ai";
    }
  }
  const scored = scoreInquiry({ ...inquiry, extracted });
  const qPatch = qualificationDbPatch(scored, source);
  const { error } = await db.from("inquiries").update(qPatch).eq("id", inquiry.id);
  if (error) throw new Error(error.message);
  return { id: inquiry.id, ...qPatch };
}

export const listQualifiedLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = crmDb(context);
    const access = await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));

    let cq = db
      .from("clients")
      .select(
        "id, full_name, phone, email, client_type, status, search_city_id, search_quarter_id, search_property_type, search_status, budget_min, budget_max, currency, notes, assigned_broker_id, rooms_min, rooms_max, updated_at, deal_stage, created_by, lead_score, lead_tier, lead_urgency, qualification_source, qualification_summary, qualification_breakdown, qualified_at, created_at, cities:search_city_id(name, slug), quarters:search_quarter_id(name), brokers:assigned_broker_id(full_name)",
      )
      .order("lead_score", { ascending: false, nullsFirst: false });
    if (!access.isAdmin) {
      cq = access.brokerId
        ? cq.eq("assigned_broker_id", access.brokerId)
        : cq.eq("created_by", context.userId);
    }
    const { data: clients, error: cErr } = await cq;
    if (cErr) throw new Error(cErr.message);

    const { data: inquiries, error: iErr } = await db
      .from("inquiries")
      .select(
        "id, name, email, phone, message, notes, status, property_id, lead_score, lead_tier, lead_urgency, qualification_source, qualification_summary, qualification_breakdown, qualified_at, created_at, properties:property_id(title)",
      )
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(200);
    if (iErr) throw new Error(iErr.message);

    const { data: matchRows } = await db.from("property_matches").select("client_id");
    const matchCounts = new Map<string, number>();
    for (const m of matchRows ?? []) {
      matchCounts.set(m.client_id, (matchCounts.get(m.client_id) ?? 0) + 1);
    }

    const inquiryIndex = (inquiries ?? []).map((i) => ({
      email: (i.email ?? "").trim().toLowerCase(),
      phone: digits(i.phone),
    }));

    const clientRows = (clients ?? []).map((c) => {
      const email = (c.email ?? "").trim().toLowerCase();
      const phone = digits(c.phone);
      const fromSite = inquiryIndex.some(
        (i) =>
          (email && i.email === email) ||
          (phone && i.phone && (i.phone === phone || i.phone.endsWith(phone) || phone.endsWith(i.phone))),
      );
      return {
        ...c,
        match_count: matchCounts.get(c.id) ?? 0,
        origin: fromSite ? "сайт" : "CRM",
        city_name: (c.cities as { name?: string } | null)?.name ?? null,
        quarter_name: (c.quarters as { name?: string } | null)?.name ?? null,
        broker_name: (c.brokers as { full_name?: string } | null)?.full_name ?? null,
      };
    });

    const scoredClients = clientRows.filter((c) => c.lead_score != null);
    const avg =
      scoredClients.length > 0
        ? Math.round(
            scoredClients.reduce((s, c) => s + (c.lead_score ?? 0), 0) / scoredClients.length,
          )
        : 0;

    const byTier = {
      hot: clientRows.filter((c) => c.lead_tier === "hot").length,
      warm: clientRows.filter((c) => c.lead_tier === "warm").length,
      cold: clientRows.filter((c) => c.lead_tier === "cold").length,
      none: clientRows.filter((c) => !c.lead_tier).length,
    };

    const cityMap = new Map<string, { total: number; hot: number; avgAcc: number; scored: number }>();
    for (const c of clientRows) {
      const name = c.city_name ?? "Без град";
      const row = cityMap.get(name) ?? { total: 0, hot: 0, avgAcc: 0, scored: 0 };
      row.total += 1;
      if (c.lead_tier === "hot") row.hot += 1;
      if (c.lead_score != null) {
        row.avgAcc += c.lead_score;
        row.scored += 1;
      }
      cityMap.set(name, row);
    }
    const byCity = [...cityMap.entries()]
      .map(([name, v]) => ({
        name,
        total: v.total,
        hot: v.hot,
        avg: v.scored ? Math.round(v.avgAcc / v.scored) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const byOrigin = {
      site: clientRows.filter((c) => c.origin === "сайт").length,
      crm: clientRows.filter((c) => c.origin === "CRM").length,
    };
    const byType: Record<string, number> = {};
    for (const c of clientRows) {
      byType[c.client_type] = (byType[c.client_type] ?? 0) + 1;
    }

    return {
      aiAvailable: Boolean(resolveAiProvider()),
      clients: clientRows,
      inquiries: inquiries ?? [],
      analytics: {
        total: clientRows.length,
        scored: scoredClients.length,
        avg,
        byTier,
        byCity,
        byOrigin,
        byType,
        inquiriesScored: (inquiries ?? []).filter((i) => i.lead_score != null).length,
        inquiriesTotal: (inquiries ?? []).length,
      },
    };
  });

export const qualifyClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        clientId: z.string().uuid(),
        useAi: z.boolean().optional(),
        applyFields: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const { data: row, error } = await db
      .from("clients")
      .select("*")
      .eq("id", data.clientId)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Клиентът не е намерен");
    return qualifyOneClient(db, row as ClientRow, {
      useAi: data.useAi ?? true,
      applyFields: data.applyFields ?? true,
    });
  });

export const qualifyAllClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        useAi: z.boolean().optional(),
        applyFields: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    const access = await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const limit = data.limit ?? 80;
    let q = db.from("clients").select("*").order("updated_at", { ascending: false }).limit(limit);
    if (!access.isAdmin) {
      q = access.brokerId
        ? q.eq("assigned_broker_id", access.brokerId)
        : q.eq("created_by", context.userId);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let aiUsed = 0;
    let heuristic = 0;
    const errors: string[] = [];
    const useAi = Boolean(data.useAi);
    let aiBudget = useAi ? 12 : 0;

    for (const row of rows ?? []) {
      try {
        const allowAi = useAi && aiBudget > 0 && (row.notes ?? "").trim().length >= 8;
        if (allowAi) aiBudget -= 1;
        const result = await qualifyOneClient(db, row as ClientRow, {
          useAi: allowAi,
          applyFields: data.applyFields ?? true,
        });
        if (result.qualification_source === "ai") aiUsed += 1;
        else heuristic += 1;
      } catch (e) {
        errors.push(`${row.full_name}: ${e instanceof Error ? e.message : "грешка"}`);
      }
    }

    return { processed: (rows ?? []).length, aiUsed, heuristic, errors };
  });

export const qualifyInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ inquiryId: z.string().uuid(), useAi: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const { data: row, error } = await db
      .from("inquiries")
      .select("id, phone, email, message, notes, property_id, status")
      .eq("id", data.inquiryId)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Запитването не е намерено");
    return qualifyOneInquiry(db, row, data.useAi ?? true);
  });

export const qualifyAllInquiries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ useAi: z.boolean().optional(), limit: z.number().int().min(1).max(200).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const db = crmDb(context);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const { data: rows, error } = await db
      .from("inquiries")
      .select("id, phone, email, message, notes, property_id, status")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 80);
    if (error) throw new Error(error.message);

    let aiUsed = 0;
    let heuristic = 0;
    const errors: string[] = [];
    let aiBudget = data.useAi ? 12 : 0;

    for (const row of rows ?? []) {
      try {
        const allowAi = Boolean(data.useAi) && aiBudget > 0 && (row.message ?? "").trim().length >= 8;
        if (allowAi) aiBudget -= 1;
        const result = await qualifyOneInquiry(db, row, allowAi);
        if (result.qualification_source === "ai") aiUsed += 1;
        else heuristic += 1;
      } catch (e) {
        errors.push(`${row.email}: ${e instanceof Error ? e.message : "грешка"}`);
      }
    }
    return { processed: (rows ?? []).length, aiUsed, heuristic, errors };
  });

/** Cheap heuristic rescore after CRM save (no AI). */
export async function rescoreClientHeuristic(db: ServerDb, clientId: string) {
  const { data: row, error } = await db.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (error || !row) return;
  try {
    await qualifyOneClient(db, row as ClientRow, { useAi: false, applyFields: false });
  } catch {
    // scoring must not block client save
  }
}
