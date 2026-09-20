// Автоматизация №9 — API слой (typed RPC) за модула „Управление на документи“.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";

function actorEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

const uuidish = z.string().uuid().nullish();

export const listDocumentRequirements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listRequirements } = await import("@/lib/documents.server");
    return listRequirements();
  });

export const saveDocumentRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        id: uuidish,
        code: z.string().min(2).max(60).optional(),
        name: z.string().min(2).max(160).optional(),
        description: z.string().max(600).nullish(),
        scope: z.enum(["client", "property", "deal"]).optional(),
        category: z.string().max(40).optional(),
        is_required: z.boolean().optional(),
        ai_check: z.boolean().optional(),
        valid_months: z.number().int().min(1).max(120).nullish(),
        sort_order: z.number().int().min(1).max(999).optional(),
        is_active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { id, ...patch } = data;
    const { saveRequirement } = await import("@/lib/documents.server");
    return saveRequirement(id ?? null, patch as Record<string, unknown>);
  });

export const listDocumentItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({ status: z.string().max(30).nullish(), clientId: uuidish, propertyId: uuidish })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listDocuments } = await import("@/lib/documents.server");
    return listDocuments({
      status: data.status ?? null,
      clientId: data.clientId ?? null,
      propertyId: data.propertyId ?? null,
    });
  });

export const getDocumentChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({ clientId: uuidish, propertyId: uuidish, category: z.string().max(40).nullish() })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { checklistFor } = await import("@/lib/documents.server");
    return checklistFor({
      clientId: data.clientId ?? null,
      propertyId: data.propertyId ?? null,
      category: data.category ?? null,
    });
  });

export const createDocumentRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        clientId: uuidish,
        propertyId: uuidish,
        requirementCodes: z.array(z.string().max(60)).min(1).max(30),
        dueDays: z.number().int().min(1).max(120).nullish(),
        message: z.string().max(600).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { createRequests, requestLink } = await import("@/lib/documents.server");
    const res = await createRequests({ ...data, createdBy: context.userId });
    return {
      created: res.created,
      requests: res.requests.map((r: any) => ({ ...r, link: requestLink(r.share_token) })),
    };
  });

export const listDocumentRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z.object({ status: z.string().max(30).nullish() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { listRequests, requestLink } = await import("@/lib/documents.server");
    const rows = await listRequests(data.status ?? null);
    return rows.map((r: any) => ({ ...r, link: requestLink(r.share_token) }));
  });

export const cancelDocumentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { cancelRequest } = await import("@/lib/documents.server");
    return cancelRequest(data.id);
  });

export const registerDocumentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        requirementCode: z.string().max(60).nullish(),
        clientId: uuidish,
        propertyId: uuidish,
        title: z.string().max(200).nullish(),
        fileName: z.string().min(1).max(240),
        storagePath: z.string().max(400).nullish(),
        fileUrl: z.string().max(1000).nullish(),
        fileSize: z.number().int().min(0).nullish(),
        mimeType: z.string().max(120).nullish(),
        issuedAt: z.string().max(20).nullish(),
        notes: z.string().max(600).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { registerDocument } = await import("@/lib/documents.server");
    return registerDocument({ ...data, uploadedBy: context.userId, source: "crm" });
  });

export const reviewDocumentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "in_review"]),
        reason: z.string().max(600).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { reviewDecision } = await import("@/lib/documents.server");
    return reviewDecision(
      data.id,
      data.decision,
      data.reason ?? null,
      actorEmail(context.claims) ?? context.userId,
    );
  });

export const aiReviewDocumentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z.object({ id: z.string().uuid(), text: z.string().max(20000).nullish() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { aiReviewDocument } = await import("@/lib/documents.server");
    return aiReviewDocument(data.id, data.text ?? null);
  });

export const documentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { signedUrlFor } = await import("@/lib/documents.server");
    return signedUrlFor(data.id);
  });

export const deleteDocumentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { deleteDocument } = await import("@/lib/documents.server");
    return deleteDocument(data.id);
  });

export const documentsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { documentsAnalytics, listDocumentEvents, getDocumentSettings, getDocumentJobState } =
      await import("@/lib/documents.server");
    const [analytics, events, settings, job] = await Promise.all([
      documentsAnalytics(),
      listDocumentEvents(120),
      getDocumentSettings(),
      getDocumentJobState(),
    ]);
    return { analytics, events, settings, job };
  });

export const saveDocumentsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z
      .object({
        enabled: z.boolean().optional(),
        ai_enabled: z.boolean().optional(),
        batch_size: z.number().int().min(1).max(50).optional(),
        due_days: z.number().int().min(1).max(120).optional(),
        reminder_days: z.number().int().min(1).max(60).optional(),
        max_reminders: z.number().int().min(0).max(10).optional(),
        expiry_warning_days: z.number().int().min(1).max(365).optional(),
        max_file_mb: z.number().int().min(1).max(100).optional(),
        auto_approve_confidence: z.number().int().min(0).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { saveDocumentSettings } = await import("@/lib/documents.server");
    return saveDocumentSettings(data);
  });

export const runDocumentsAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) =>
    z.object({ limit: z.number().int().min(1).max(50).nullish() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { runDocumentsQueue } = await import("@/lib/documents.server");
    return runDocumentsQueue(data.limit ?? undefined);
  });

export const resumeDocumentsAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { resumeDocumentJob } = await import("@/lib/documents.server");
    return resumeDocumentJob();
  });

export const importLegacyDocumentFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const { importLegacyDocuments } = await import("@/lib/documents.server");
    return importLegacyDocuments();
  });

export const listDocumentPickers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCrmAccess(context.userId, context.supabase, actorEmail(context.claims));
    const [{ data: clients }, { data: properties }] = await Promise.all([
      context.supabase
        .from("clients")
        .select("id, full_name, email, phone")
        .order("created_at", { ascending: false })
        .limit(300),
      context.supabase
        .from("properties")
        .select("id, title, price, city_id, cities(name)")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    const propertyRows = (properties ?? []).map((p: any) => ({
      ...p,
      city: p.cities?.name ?? null,
    }));
    return { clients: clients ?? [], properties: propertyRows };
  });
