import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiChatCompletions, resolveAiProvider } from "@/lib/ai-provider";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import {
  DEFAULT_CONTRACT_TEMPLATES,
  buildFillValues,
  fillPlaceholders,
  listUnfilled,
  suggestedTitle,
} from "@/lib/contracts";
import { resolveServerDb } from "@/lib/supabase-server-db";

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

const uuid = z.string().uuid();

async function seedTemplatesIfEmpty(db: ReturnType<typeof resolveServerDb>) {
  const { count, error } = await db
    .from("contract_templates")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) return;
  const { error: insErr } = await db.from("contract_templates").insert(
    DEFAULT_CONTRACT_TEMPLATES.map((t) => ({
      name: t.name,
      contract_type: t.contract_type,
      template_content: t.template_content,
      variables: t.variables,
      is_active: true,
    })),
  );
  if (insErr) throw new Error(insErr.message);
}

function nestedName(rel: unknown): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) {
    const first = rel[0] as { name?: unknown } | undefined;
    return typeof first?.name === "string" ? first.name : null;
  }
  if (
    typeof rel === "object" &&
    rel &&
    "name" in rel &&
    typeof (rel as { name?: unknown }).name === "string"
  ) {
    return (rel as { name: string }).name;
  }
  return null;
}

function asStr(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v;
  return null;
}

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function partyFrom(row: Record<string, unknown> | null | undefined) {
  if (!row) return null;
  return {
    full_name: String(row.full_name ?? ""),
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    id_number: (row.id_number as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    license_number: (row.license_number as string | null) ?? null,
  };
}

const AI_SYSTEM = `Ти си български консултант по документи за агенция за недвижими имоти „Имоти Надежда“.
Получаваш вече попълнен шаблон и бележки от брокера.
Правила:
1. НЕ променяй вече попълнени имена, ЕГН, адреси, цени, площи, дати.
2. Ако бележките съдържат данни за празните полета (________________) — попълни САМО тях.
3. Ако бележките искат допълнителни клаузи — добави ги в секция „ДРУГИ“ / „ДРУГИ УСЛОВИЯ“, без да триеш съществуващия текст.
4. Не измисляй ЕГН, лични данни или цени, които ги няма в шаблона или бележките.
5. Върни САМО пълния текст на документа, без markdown и без коментари.`;

export const listContractDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = resolveServerDb(context.supabase);
    const access = await assertCrmAccess(
      context.userId,
      context.supabase,
      authEmail(context.claims),
    );
    await seedTemplatesIfEmpty(db);

    let clientsQ = db
      .from("clients")
      .select(
        "id, full_name, phone, email, client_type, notes, deal_stage, assigned_broker_id, cities:search_city_id(name)",
      )
      .order("full_name")
      .limit(400);
    if (!access.isAdmin) {
      if (access.brokerId) clientsQ = clientsQ.eq("assigned_broker_id", access.brokerId);
      else clientsQ = clientsQ.eq("created_by", context.userId);
    }

    const contractsQ = db
      .from("generated_contracts")
      .select(
        "id, title, content, contract_type, status, client_id, property_id, template_id, created_at, updated_at, clients:client_id(full_name), properties:property_id(title), contract_templates:template_id(name)",
      )
      .order("created_at", { ascending: false })
      .limit(300);

    const [templates, clients, properties, owners, brokers, contracts, settings] =
      await Promise.all([
        db
          .from("contract_templates")
          .select("id, name, contract_type, is_active, variables")
          .eq("is_active", true)
          .order("name"),
        clientsQ,
        db
          .from("properties")
          .select(
            "id, title, price, currency, area_sqm, rooms, address, property_type, owner_id, broker_id, cities:city_id(name), quarters:quarter_id(name)",
          )
          .order("created_at", { ascending: false })
          .limit(300),
        db
          .from("owners")
          .select("id, full_name, id_number, address, phone")
          .order("full_name")
          .limit(300),
        db
          .from("brokers")
          .select("id, full_name, phone, license_number, is_active")
          .eq("is_active", true)
          .order("full_name"),
        contractsQ,
        db.from("agency_settings").select("commission_rate").eq("singleton", true).maybeSingle(),
      ]);

    if (templates.error) throw new Error(templates.error.message);
    let clientRows = clients.data ?? [];
    if (clients.error) {
      const plain = db
        .from("clients")
        .select("id, full_name, phone, email, client_type, notes, deal_stage, assigned_broker_id")
        .order("full_name")
        .limit(400);
      const scoped = !access.isAdmin
        ? access.brokerId
          ? plain.eq("assigned_broker_id", access.brokerId)
          : plain.eq("created_by", context.userId)
        : plain;
      const retry = await scoped;
      if (retry.error) throw new Error(clients.error.message);
      clientRows = (retry.data ?? []) as typeof clientRows;
    }
    if (contracts.error) throw new Error(contracts.error.message);

    const contractRows = contracts.data ?? [];
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const row of contractRows) {
      const t = String(row.contract_type || "other");
      const s = String(row.status || "draft");
      byType[t] = (byType[t] ?? 0) + 1;
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }
    const pending = (byStatus.pending_signature ?? 0) + (byStatus.pending ?? 0);

    return {
      templates: templates.data ?? [],
      clients: clientRows,
      properties: properties.error ? [] : (properties.data ?? []),
      owners: owners.error ? [] : (owners.data ?? []),
      brokers: brokers.error ? [] : (brokers.data ?? []),
      contracts: contractRows,
      commission_pct:
        settings.data?.commission_rate != null ? Number(settings.data.commission_rate) : 0.03,
      ai_available: !!resolveAiProvider(),
      analytics: {
        total: contractRows.length,
        by_type: Object.entries(byType).map(([type, count]) => ({ type, count })),
        by_status: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
        pending_signatures: pending,
        drafts: byStatus.draft ?? 0,
        finals: byStatus.final ?? 0,
        last: contractRows[0]
          ? {
              id: contractRows[0].id,
              title: contractRows[0].title,
              created_at: contractRows[0].created_at,
              contract_type: contractRows[0].contract_type,
            }
          : null,
      },
    };
  });

export const fillContractPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        template_id: uuid,
        client_id: uuid.optional().nullable(),
        property_id: uuid.optional().nullable(),
        owner_id: uuid.optional().nullable(),
        broker_id: uuid.optional().nullable(),
        notes: z.string().max(4000).optional().nullable(),
        use_ai: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));

    const { data: template, error: tErr } = await db
      .from("contract_templates")
      .select("*")
      .eq("id", data.template_id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!template) throw new Error("Шаблонът не е намерен.");

    const [clientRes, propRes, ownerRes, brokerRes, settings] = await Promise.all([
      data.client_id
        ? db
            .from("clients")
            .select("*, cities:search_city_id(name), quarters:search_quarter_id(name)")
            .eq("id", data.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      data.property_id
        ? db
            .from("properties")
            .select("*, cities:city_id(name), quarters:quarter_id(name)")
            .eq("id", data.property_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      data.owner_id
        ? db.from("owners").select("*").eq("id", data.owner_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      data.broker_id
        ? db.from("brokers").select("*").eq("id", data.broker_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      db.from("agency_settings").select("commission_rate").eq("singleton", true).maybeSingle(),
    ]);

    if (clientRes.error) throw new Error(clientRes.error.message);
    if (propRes.error) throw new Error(propRes.error.message);
    if (ownerRes.error) throw new Error(ownerRes.error.message);
    if (brokerRes.error) throw new Error(brokerRes.error.message);

    const client = clientRes.data as Record<string, unknown> | null;
    const property = propRes.data as Record<string, unknown> | null;

    let ownerRow = ownerRes.data as Record<string, unknown> | null;
    const propertyOwnerId = asStr(property?.owner_id);
    if (!ownerRow && propertyOwnerId) {
      const { data } = await db.from("owners").select("*").eq("id", propertyOwnerId).maybeSingle();
      ownerRow = data as Record<string, unknown> | null;
    }
    let brokerRow = brokerRes.data as Record<string, unknown> | null;
    const propertyBrokerId = asStr(property?.broker_id);
    if (!brokerRow && propertyBrokerId) {
      const { data } = await db
        .from("brokers")
        .select("*")
        .eq("id", propertyBrokerId)
        .maybeSingle();
      brokerRow = data as Record<string, unknown> | null;
    }
    const assignedBrokerId = asStr(client?.assigned_broker_id);
    if (!brokerRow && assignedBrokerId) {
      const { data } = await db
        .from("brokers")
        .select("*")
        .eq("id", assignedBrokerId)
        .maybeSingle();
      brokerRow = data as Record<string, unknown> | null;
    }

    const owner = ownerRow;
    const broker = brokerRow;

    const values = buildFillValues({
      client: client
        ? {
            full_name: asStr(client.full_name) ?? "",
            phone: asStr(client.phone),
            email: asStr(client.email),
            client_type: asStr(client.client_type),
            notes: asStr(client.notes),
            deal_stage: asStr(client.deal_stage),
            mortgage_data: client.mortgage_data,
            city: nestedName(client.cities),
            quarter: nestedName(client.quarters),
          }
        : null,
      property: property
        ? {
            title: asStr(property.title),
            address: asStr(property.address),
            price: asNum(property.price),
            currency: asStr(property.currency),
            area_sqm: asNum(property.area_sqm),
            rooms: asNum(property.rooms),
            property_type: asStr(property.property_type),
            city: nestedName(property.cities),
            quarter: nestedName(property.quarters),
            floor: asNum(property.floor),
          }
        : null,
      owner: partyFrom(owner as Record<string, unknown> | null),
      broker: partyFrom(broker as Record<string, unknown> | null),
      notes: data.notes,
      commission_pct:
        settings.data?.commission_rate != null ? Number(settings.data.commission_rate) : 0.03,
    });

    let content = fillPlaceholders(template.template_content, values);
    let aiUsed = false;
    let aiNote: string | null = null;

    if (data.use_ai) {
      if (!resolveAiProvider()) {
        aiNote = "AI не е конфигуриран — попълнен е само шаблонът.";
      } else {
        try {
          const res = await aiChatCompletions({
            temperature: 0.15,
            messages: [
              { role: "system", content: AI_SYSTEM },
              {
                role: "user",
                content: `ШАБЛОН:\n${content}\n\nБЕЛЕЖКИ:\n${data.notes?.trim() || "(няма допълнителни бележки)"}`,
              },
            ],
          });
          if (!res.ok) {
            aiNote = `AI върна ${res.status} — записан е шаблонът без AI.`;
          } else {
            const json = (await res.json()) as {
              choices?: Array<{ message?: { content?: string } }>;
            };
            const raw = json.choices?.[0]?.message?.content?.trim();
            if (raw) {
              content = raw
                .replace(/^```(?:text|markdown)?\s*/i, "")
                .replace(/```$/, "")
                .trim();
              aiUsed = true;
            } else {
              aiNote = "AI не върна текст — използван е шаблонът.";
            }
          }
        } catch (e: unknown) {
          aiNote = e instanceof Error ? e.message : "AI не успя — използван е шаблонът.";
        }
      }
    }

    return {
      template_id: template.id,
      contract_type: template.contract_type,
      title: suggestedTitle(template.name, asStr(client?.full_name), asStr(property?.title)),
      content,
      unfilled: listUnfilled(content).length,
      ai_used: aiUsed,
      ai_note: aiNote,
      resolved: {
        client_id: data.client_id ?? null,
        property_id: data.property_id ?? null,
        owner_id: (owner as { id?: string } | null)?.id ?? data.owner_id ?? null,
        broker_id: (broker as { id?: string } | null)?.id ?? data.broker_id ?? null,
      },
    };
  });

export const saveGeneratedContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.optional().nullable(),
        template_id: uuid.optional().nullable(),
        client_id: uuid.optional().nullable(),
        property_id: uuid.optional().nullable(),
        contract_type: z.string().min(1).max(64),
        title: z.string().min(2).max(200),
        content: z.string().min(20).max(80_000),
        status: z.enum(["draft", "final", "pending_signature", "signed"]).default("draft"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const { id, ...payload } = data;
    const row = {
      template_id: payload.template_id ?? null,
      client_id: payload.client_id ?? null,
      property_id: payload.property_id ?? null,
      contract_type: payload.contract_type,
      title: payload.title,
      content: payload.content,
      status: payload.status,
    };
    const op = id
      ? db.from("generated_contracts").update(row).eq("id", id).select().single()
      : db
          .from("generated_contracts")
          .insert({ ...row, created_by: context.userId })
          .select()
          .single();
    const { data: saved, error } = await op;
    if (error) throw new Error(error.message);
    return saved;
  });
