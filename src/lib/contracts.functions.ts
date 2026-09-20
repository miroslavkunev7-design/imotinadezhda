// Автоматизация №8 — API слой (typed RPC) за модула „Генериране на договори“.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

const varsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional();

export const listContractTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listTemplates } = await import("@/lib/contracts.server");
    return listTemplates();
  });

export const saveContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        code: z.string().max(60).nullish(),
        name: z.string().min(2).max(160).optional(),
        contract_type: z.string().max(40).optional(),
        category: z.string().max(40).optional(),
        template_content: z.string().min(10).max(40000).optional(),
        is_active: z.boolean().optional(),
        requires_signature: z.boolean().optional(),
        auto_trigger: z.enum(["none", "deposit", "deal", "rental", "viewing"]).optional(),
        notes: z.string().max(1000).nullish(),
        sort_order: z.number().int().min(1).max(999).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { id, ...patch } = data;
    const { saveTemplate } = await import("@/lib/contracts.server");
    return saveTemplate(id ?? null, patch as Record<string, unknown>);
  });

export const previewContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        templateId: z.string().uuid().nullish(),
        templateContent: z.string().max(40000).nullish(),
        clientId: z.string().uuid().nullish(),
        propertyId: z.string().uuid().nullish(),
        variables: varsSchema,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { buildVariables, renderTemplate } = await import("@/lib/contracts.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let content = data.templateContent ?? "";
    if (!content && data.templateId) {
      const { data: tpl } = await (supabaseAdmin as any)
        .from("contract_templates")
        .select("template_content")
        .eq("id", data.templateId)
        .maybeSingle();
      content = tpl?.template_content ?? "";
    }
    const vars = await buildVariables({
      clientId: data.clientId ?? null,
      propertyId: data.propertyId ?? null,
      extra: data.variables ?? {},
      docNumber: "ПРЕГЛЕД",
    });
    const rendered = renderTemplate(content, vars);
    return { ...rendered, variables: vars };
  });

export const listGeneratedContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; templateId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any)
      .from("generated_contracts")
      .select(
        "id, created_at, updated_at, title, doc_number, contract_type, status, ai_used, amount, currency, missing_fields, share_token, sent_at, viewed_at, signed_at, declined_at, expires_at, signer_name, signer_email, source, content, template_id, clients:client_id(id, full_name, email, phone), properties:property_id(id, title), contract_templates:template_id(name, code)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status) q = q.eq("status", data.status);
    if (data.templateId) q = q.eq("template_id", data.templateId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listContractQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("contract_queue")
      .select(
        "id, created_at, status, attempts, last_error, auto_send, processed_at, requested_by, template_code, contract_templates:template_id(name), clients:client_id(full_name), properties:property_id(title)",
      )
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listContractEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("contract_events")
      .select(
        "id, created_at, action, status, message, duration_ms, actor, generated_contracts:contract_id(title, doc_number)",
      )
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getContractsConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { getContractSettings, getContractJobState } = await import("@/lib/contracts.server");
    return { settings: await getContractSettings(), job: await getContractJobState() };
  });

export const saveContractsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        enabled: z.boolean().optional(),
        ai_enabled: z.boolean().optional(),
        auto_send: z.boolean().optional(),
        batch_size: z.number().int().min(1).max(50).optional(),
        retry_limit: z.number().int().min(1).max(10).optional(),
        expire_days: z.number().int().min(1).max(180).optional(),
        number_prefix: z.string().min(1).max(10).optional(),
        agency_name: z.string().min(2).max(120).optional(),
        agency_city: z.string().min(2).max(80).optional(),
        commission: z.number().min(0).max(20).optional(),
        term_months: z.number().int().min(1).max(120).optional(),
        reserve_days: z.number().int().min(1).max(180).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveContractSettings } = await import("@/lib/contracts.server");
    return saveContractSettings(data);
  });

export const getContractsAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { contractsAnalytics } = await import("@/lib/contracts.server");
    return contractsAnalytics();
  });

export const generateContractNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        templateId: z.string().uuid().nullish(),
        templateCode: z.string().max(60).nullish(),
        clientId: z.string().uuid().nullish(),
        propertyId: z.string().uuid().nullish(),
        variables: varsSchema,
        useAi: z.boolean().optional(),
        autoSend: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { generateContract } = await import("@/lib/contracts.server");
    return generateContract({
      ...data,
      source: "manual",
      actor: actorEmail(context.claims) ?? "crm",
    });
  });

export const enqueueContractJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        templateId: z.string().uuid().nullish(),
        templateCode: z.string().max(60).nullish(),
        clientId: z.string().uuid().nullish(),
        propertyId: z.string().uuid().nullish(),
        variables: varsSchema,
        autoSend: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { enqueueContract } = await import("@/lib/contracts.server");
    return enqueueContract({ ...data, requestedBy: actorEmail(context.claims) ?? "crm" });
  });

export const sendContractForSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { sendForSignature } = await import("@/lib/contracts.server");
    return sendForSignature(data.id, actorEmail(context.claims) ?? "crm");
  });

export const voidContractDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z.object({ id: z.string().uuid(), reason: z.string().min(2).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { voidContract } = await import("@/lib/contracts.server");
    return voidContract(data.id, data.reason, actorEmail(context.claims) ?? "crm");
  });

export const markContractSignedManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z.object({ id: z.string().uuid(), signatureName: z.string().min(2).max(160) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await (supabaseAdmin as any)
      .from("generated_contracts")
      .update({
        status: "signed",
        signed_at: now,
        updated_at: now,
        signature_name: data.signatureName,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await (supabaseAdmin as any).from("contract_events").insert({
      contract_id: data.id,
      action: "sign",
      message: `Ръчно отбелязан като подписан (${data.signatureName})`,
      actor: actorEmail(context.claims) ?? "crm",
    });
    return { ok: true };
  });

export const deleteGeneratedContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("generated_contracts")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runContractsQueueNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runContractsQueue } = await import("@/lib/contracts.server");
    return runContractsQueue(data.limit);
  });

export const resumeContractsJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeContractJob } = await import("@/lib/contracts.server");
    return resumeContractJob();
  });

/** Списъци за избор на клиент и имот в генератора. */
export const listContractPickers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [clients, properties] = await Promise.all([
      (supabaseAdmin as any)
        .from("clients")
        .select("id, full_name, email, phone")
        .order("full_name")
        .limit(500),
      (supabaseAdmin as any)
        .from("properties")
        .select("id, title, price, currency")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    return { clients: clients.data ?? [], properties: properties.data ?? [] };
  });
