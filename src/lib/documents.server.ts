// Автоматизация №9 — Управление на документи: чеклисти, събиране по линк,
// AI проверка/извличане на данни, срокове на валидност, напомняния и аналитика.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions, listAiProviders } from "@/lib/ai-provider";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, a?: unknown) => any;
    storage: any;
  };

export const SITE_URL = "https://imotinadezhda.bg";
export const BUCKET = "crm-documents";
const JOB_KEY = "documents_collect";

export class GatewayDenied extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GatewayDenied";
  }
}

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type DocumentSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  batch_size: number;
  lease_seconds: number;
  due_days: number;
  reminder_days: number;
  max_reminders: number;
  expiry_warning_days: number;
  max_file_mb: number;
  auto_approve_confidence: number;
};

export const DEFAULT_DOCUMENTS: DocumentSettings = {
  enabled: true,
  ai_enabled: true,
  batch_size: 10,
  lease_seconds: 300,
  due_days: 7,
  reminder_days: 3,
  max_reminders: 3,
  expiry_warning_days: 30,
  max_file_mb: 25,
  auto_approve_confidence: 0,
};

export async function getDocumentSettings(): Promise<DocumentSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", "documents")
    .maybeSingle();
  return { ...DEFAULT_DOCUMENTS, ...((data?.value ?? {}) as Partial<DocumentSettings>) };
}

export async function saveDocumentSettings(
  patch: Partial<DocumentSettings>,
): Promise<DocumentSettings> {
  const next = { ...(await getDocumentSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: "documents", value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

// ------------------------------------------------------------------
// Фонова задача: single-flight + circuit breaker
// ------------------------------------------------------------------
export async function getDocumentJobState() {
  const { data } = await db().from("automation_jobs").select("*").eq("key", JOB_KEY).maybeSingle();
  return {
    key: JOB_KEY,
    paused: Boolean(data?.paused),
    paused_reason: (data?.paused_reason ?? null) as string | null,
    paused_at: (data?.paused_at ?? null) as string | null,
    last_run_at: (data?.last_run_at ?? null) as string | null,
    locked_until: (data?.locked_until ?? null) as string | null,
    stats: (data?.stats ?? {}) as Record<string, number | string | boolean | null>,
  };
}

async function claimJob(leaseSeconds: number): Promise<boolean> {
  const { data, error } = await db().rpc("claim_automation_job", {
    _key: JOB_KEY,
    _lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(`Не може да се заеме задачата: ${error.message}`);
  return Boolean(data);
}

async function releaseJob(stats: Record<string, number | string | boolean | null>) {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        locked_until: null,
        last_run_at: new Date().toISOString(),
        stats,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
}

export async function pauseDocumentJob(reason: string) {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        paused: true,
        paused_reason: reason,
        paused_at: new Date().toISOString(),
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
}

export async function resumeDocumentJob() {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        paused: false,
        paused_reason: null,
        paused_at: null,
        locked_until: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  return getDocumentJobState();
}

async function logEvent(entry: {
  document_id?: string | null;
  request_id?: string | null;
  action: string;
  status?: string;
  message?: string | null;
  meta?: unknown;
  duration_ms?: number | null;
  actor?: string;
}) {
  await db()
    .from("document_events")
    .insert({
      document_id: entry.document_id ?? null,
      request_id: entry.request_id ?? null,
      action: entry.action,
      status: entry.status ?? "ok",
      message: entry.message ?? null,
      meta: (entry.meta ?? null) as never,
      duration_ms: entry.duration_ms ?? null,
      actor: entry.actor ?? "automation",
    });
}

// ------------------------------------------------------------------
// Изисквания (чеклисти)
// ------------------------------------------------------------------
export async function listRequirements(activeOnly = false) {
  let q = db().from("document_requirements").select("*").order("sort_order", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveRequirement(id: string | null, patch: Record<string, unknown>) {
  if (id) {
    const { data, error } = await db()
      .from("document_requirements")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await db()
    .from("document_requirements")
    .insert(patch)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// ------------------------------------------------------------------
// Заявки за документи (събиране от клиента по линк)
// ------------------------------------------------------------------
export type RequestInput = {
  clientId?: string | null;
  propertyId?: string | null;
  requirementCodes: string[];
  dueDays?: number | null;
  message?: string | null;
  createdBy?: string | null;
};

export async function createRequests(input: RequestInput) {
  const settings = await getDocumentSettings();
  const reqs = await listRequirements(true);
  const dueDays = input.dueDays ?? settings.due_days;
  const dueAt = new Date(Date.now() + dueDays * 86400000).toISOString();
  const nextReminder = new Date(Date.now() + settings.reminder_days * 86400000).toISOString();

  const rows = input.requirementCodes
    .map((code) => reqs.find((r: any) => r.code === code))
    .filter(Boolean)
    .map((r: any) => ({
      client_id: input.clientId ?? null,
      property_id: input.propertyId ?? null,
      requirement_code: r.code,
      requirement_name: r.name,
      scope: r.scope,
      status: "pending",
      due_at: dueAt,
      next_reminder_at: nextReminder,
      message: input.message ?? null,
      created_by: input.createdBy ?? null,
    }));

  if (!rows.length) return { created: 0, requests: [] as any[] };

  const { data, error } = await db().from("document_requests").insert(rows).select("*");
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    await logEvent({
      request_id: r.id,
      action: "request_created",
      message: r.requirement_name,
      actor: input.createdBy ?? "crm",
    });
  }
  return { created: data?.length ?? 0, requests: data ?? [] };
}

export function requestLink(token: string) {
  return `${SITE_URL}/api/public/documents/upload/${token}`;
}

export async function cancelRequest(id: string) {
  const { error } = await db()
    .from("document_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent({ request_id: id, action: "request_cancelled", actor: "crm" });
  return { ok: true };
}

export async function getRequestByToken(token: string) {
  const { data } = await db()
    .from("document_requests")
    .select("*, clients(full_name), properties(title)")
    .eq("share_token", token)
    .maybeSingle();
  return data ?? null;
}

export async function listRequests(status?: string | null) {
  let q = db()
    .from("document_requests")
    .select("*, clients(full_name, email, phone), properties(title)")
    .order("created_at", { ascending: false })
    .limit(400);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ------------------------------------------------------------------
// Документи
// ------------------------------------------------------------------
export async function listDocuments(filters?: {
  status?: string | null;
  clientId?: string | null;
  propertyId?: string | null;
}) {
  let q = db()
    .from("document_items")
    .select("*, clients(full_name), properties(title)")
    .order("created_at", { ascending: false })
    .limit(400);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.clientId) q = q.eq("client_id", filters.clientId);
  if (filters?.propertyId) q = q.eq("property_id", filters.propertyId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

function expiryFor(
  validMonths: number | null | undefined,
  issuedAt?: string | null,
): string | null {
  if (!validMonths) return null;
  const base = issuedAt ? new Date(issuedAt) : new Date();
  base.setMonth(base.getMonth() + validMonths);
  return base.toISOString().slice(0, 10);
}

export type RegisterInput = {
  requirementCode?: string | null;
  clientId?: string | null;
  propertyId?: string | null;
  title?: string | null;
  docType?: string | null;
  fileName: string;
  storagePath?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  checksum?: string | null;
  source?: string;
  issuedAt?: string | null;
  notes?: string | null;
  uploadedBy?: string | null;
  requestId?: string | null;
  externalSourceId?: string | null;
};

/** Записва файл в регистъра и вдига версията при същото изискване/собственик. */
export async function registerDocument(input: RegisterInput) {
  const reqs = await listRequirements();
  const requirement = input.requirementCode
    ? reqs.find((r: any) => r.code === input.requirementCode)
    : null;

  let version = 1;
  if (input.requirementCode) {
    const owner = input.clientId
      ? { col: "client_id", val: input.clientId }
      : input.propertyId
        ? { col: "property_id", val: input.propertyId }
        : null;
    if (owner) {
      const { data: prev } = await db()
        .from("document_items")
        .select("version")
        .eq("requirement_code", input.requirementCode)
        .eq(owner.col, owner.val)
        .order("version", { ascending: false })
        .limit(1);
      version = (prev?.[0]?.version ?? 0) + 1;
    }
  }

  const row = {
    requirement_code: input.requirementCode ?? null,
    scope: requirement?.scope ?? (input.propertyId ? "property" : "client"),
    client_id: input.clientId ?? null,
    property_id: input.propertyId ?? null,
    title: input.title ?? requirement?.name ?? input.fileName,
    doc_type: input.docType ?? requirement?.code ?? "other",
    file_name: input.fileName,
    storage_path: input.storagePath ?? null,
    file_url: input.fileUrl ?? null,
    file_size: input.fileSize ?? null,
    mime_type: input.mimeType ?? null,
    checksum: input.checksum ?? null,
    status: "uploaded",
    source: input.source ?? "crm",
    version,
    issued_at: input.issuedAt ?? null,
    expires_at: expiryFor(requirement?.valid_months, input.issuedAt),
    ai_status: requirement?.ai_check === false ? "skipped" : "pending",
    notes: input.notes ?? null,
    uploaded_by: input.uploadedBy ?? null,
    external_source_id: input.externalSourceId ?? null,
  };

  const { data, error } = await db().from("document_items").insert(row).select("*").maybeSingle();
  if (error) throw new Error(error.message);

  if (input.requestId) {
    await db()
      .from("document_requests")
      .update({
        status: "uploaded",
        document_id: data.id,
        next_reminder_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.requestId);
  }
  await logEvent({
    document_id: data.id,
    request_id: input.requestId ?? null,
    action: "document_registered",
    message: row.file_name,
    actor: input.uploadedBy ?? input.source ?? "crm",
  });
  return data;
}

export async function signedUrlFor(id: string, seconds = 3600) {
  const { data: doc } = await db()
    .from("document_items")
    .select("storage_path, file_url")
    .eq("id", id)
    .maybeSingle();
  if (!doc) throw new Error("Документът не е намерен");
  if (doc.storage_path) {
    const { data, error } = await db()
      .storage.from(BUCKET)
      .createSignedUrl(doc.storage_path, seconds);
    if (error) throw new Error(error.message);
    return { url: data?.signedUrl ?? null };
  }
  return { url: doc.file_url ?? null };
}

export async function reviewDecision(
  id: string,
  decision: "approved" | "rejected" | "in_review",
  reason: string | null,
  actor: string | null,
) {
  const patch: Record<string, unknown> = {
    status: decision,
    rejected_reason: decision === "rejected" ? reason : null,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db()
    .from("document_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (data?.requirement_code) {
    const owner = data.client_id
      ? { col: "client_id", val: data.client_id }
      : data.property_id
        ? { col: "property_id", val: data.property_id }
        : null;
    if (owner && (decision === "approved" || decision === "rejected")) {
      await db()
        .from("document_requests")
        .update({ status: decision, updated_at: new Date().toISOString() })
        .eq("requirement_code", data.requirement_code)
        .eq(owner.col, owner.val)
        .in("status", ["uploaded", "pending"]);
    }
  }
  await logEvent({
    document_id: id,
    action: `document_${decision}`,
    message: reason,
    actor: actor ?? "crm",
  });
  return data;
}

export async function deleteDocument(id: string) {
  const { data: doc } = await db()
    .from("document_items")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (doc?.storage_path) await db().storage.from(BUCKET).remove([doc.storage_path]);
  const { error } = await db().from("document_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ------------------------------------------------------------------
// AI проверка на документ
// ------------------------------------------------------------------
export async function aiReviewDocument(id: string, extractedText?: string | null) {
  const settings = await getDocumentSettings();
  if (!settings.ai_enabled || listAiProviders().length === 0) {
    await db()
      .from("document_items")
      .update({ ai_status: "skipped", updated_at: new Date().toISOString() })
      .eq("id", id);
    return { skipped: true as const };
  }

  const { data: doc } = await db().from("document_items").select("*").eq("id", id).maybeSingle();
  if (!doc) throw new Error("Документът не е намерен");

  const started = Date.now();
  const res = await aiChatCompletions({
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "Ти си асистент в българска агенция за недвижими имоти и проверяваш документи по сделки. " +
          'Връщаш САМО валиден JSON (без markdown): {"doc_type":string,"summary":string,"issued_at":"YYYY-MM-DD|null","expires_at":"YYYY-MM-DD|null","fields":object,"confidence":0-100,"issues":string[]}. ' +
          "НЕ измисляй данни — при липса на информация връщай null и посочвай липсите в issues.",
      },
      {
        role: "user",
        content:
          `Очакван документ: ${doc.title} (код: ${doc.requirement_code ?? "няма"})\n` +
          `Файл: ${doc.file_name} (${doc.mime_type ?? "неизвестен тип"})\n` +
          `Бележки: ${doc.notes ?? "-"}\n` +
          `Текст от документа: ${(extractedText ?? "").slice(0, 6000) || "(няма извлечен текст)"}`,
      },
    ],
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 402 || res.status === 403)
      throw new GatewayDenied(res.status, text.slice(0, 400));
    await db()
      .from("document_items")
      .update({
        ai_status: "failed",
        ai_summary: `AI грешка (HTTP ${res.status})`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (res.status === 429 || res.status >= 500)
      throw new Error(`AI временно недостъпен (HTTP ${res.status})`);
    throw new Error(`AI грешка (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = (json.choices?.[0]?.message?.content ?? "").replace(/```json|```/g, "").trim();
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    parsed = { summary: raw.slice(0, 500), confidence: 0, issues: ["Неразчетен AI отговор"] };
  }

  const issues: string[] = Array.isArray(parsed.issues) ? parsed.issues : [];
  const confidence = Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : null;
  const patch: Record<string, unknown> = {
    ai_status: issues.length ? "warning" : "ok",
    ai_summary: String(parsed.summary ?? "").slice(0, 2000) || null,
    ai_fields: { ...(parsed.fields ?? {}), issues, doc_type: parsed.doc_type ?? null },
    ai_confidence: confidence,
    issued_at: doc.issued_at ?? (parsed.issued_at || null),
    expires_at: doc.expires_at ?? (parsed.expires_at || null),
    status: doc.status === "uploaded" ? "in_review" : doc.status,
    updated_at: new Date().toISOString(),
  };
  if (
    !issues.length &&
    settings.auto_approve_confidence > 0 &&
    (confidence ?? 0) >= settings.auto_approve_confidence
  ) {
    patch.status = "approved";
    patch.reviewed_at = new Date().toISOString();
  }

  const { data, error } = await db()
    .from("document_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await logEvent({
    document_id: id,
    action: "ai_review",
    status: issues.length ? "warning" : "ok",
    message: patch.ai_summary as string | null,
    meta: { issues, confidence },
    duration_ms: Date.now() - started,
  });
  return data;
}

// ------------------------------------------------------------------
// Чеклист по клиент / имот
// ------------------------------------------------------------------
export async function checklistFor(params: {
  clientId?: string | null;
  propertyId?: string | null;
  category?: string | null;
}) {
  const reqs = (await listRequirements(true)).filter((r: any) => {
    if (params.category && r.category !== params.category) return false;
    if (params.clientId && params.propertyId) return true;
    if (params.propertyId) return r.scope === "property";
    return r.scope !== "property";
  });

  const docs = await listDocuments({
    clientId: params.clientId ?? null,
    propertyId: params.propertyId ?? null,
  });
  const requests = (await listRequests()).filter(
    (r: any) =>
      (params.clientId ? r.client_id === params.clientId : true) &&
      (params.propertyId ? r.property_id === params.propertyId : true),
  );

  return reqs.map((r: any) => {
    const mine = docs
      .filter((d: any) => d.requirement_code === r.code)
      .sort((a: any, b: any) => b.version - a.version);
    const latest = mine[0] ?? null;
    const request =
      requests.find(
        (q: any) => q.requirement_code === r.code && !["cancelled"].includes(q.status),
      ) ?? null;
    const expired = latest?.expires_at ? new Date(latest.expires_at).getTime() < Date.now() : false;
    return {
      requirement: r,
      document: latest,
      versions: mine.length,
      request,
      state: !latest ? (request ? "requested" : "missing") : expired ? "expired" : latest.status,
    };
  });
}

// ------------------------------------------------------------------
// Импорт на съществуващи файлове от CRM
// ------------------------------------------------------------------
export async function importLegacyDocuments() {
  let imported = 0;
  const { data: cd } = await db().from("client_documents").select("*").limit(1000);
  for (const r of cd ?? []) {
    const { error } = await db()
      .from("document_items")
      .upsert(
        {
          external_source_id: r.id,
          client_id: r.client_id,
          scope: "client",
          title: r.document_type ?? r.file_name,
          doc_type: r.document_type ?? "other",
          file_name: r.file_name,
          file_url: r.file_url,
          file_size: r.file_size,
          mime_type: r.mime_type,
          status: "uploaded",
          source: "import",
          ai_status: "skipped",
          version: r.version ?? 1,
          notes: r.notes,
          created_at: r.created_at,
        },
        { onConflict: "external_source_id", ignoreDuplicates: true },
      );
    if (!error) imported += 1;
  }

  const { data: pd } = await db().from("property_documents").select("*").limit(1000);
  for (const r of pd ?? []) {
    const { error } = await db()
      .from("document_items")
      .upsert(
        {
          external_source_id: r.id,
          property_id: r.property_id,
          scope: "property",
          title: r.doc_type ?? r.file_name,
          doc_type: r.doc_type ?? "other",
          file_name: r.file_name,
          storage_path: r.file_path,
          file_url: r.file_url,
          file_size: r.file_size,
          mime_type: r.mime_type,
          status: "uploaded",
          source: "import",
          ai_status: "skipped",
          version: r.version ?? 1,
          created_at: r.created_at,
        },
        { onConflict: "external_source_id", ignoreDuplicates: true },
      );
    if (!error) imported += 1;
  }

  await logEvent({
    action: "import_legacy",
    message: `Импортирани ${imported} записа`,
    actor: "crm",
  });
  return { imported };
}

// ------------------------------------------------------------------
// Фонова обработка: AI ревю, напомняния, изтекли документи
// ------------------------------------------------------------------
async function processBatch(batch: number, settings: DocumentSettings, probe: boolean) {
  const stats = { reviewed: 0, reminders: 0, expired: 0, overdue: 0, errors: 0 };

  // 1) AI проверка на новите документи
  const { data: pending } = await db()
    .from("document_items")
    .select("id")
    .eq("ai_status", "pending")
    .order("created_at", { ascending: true })
    .limit(probe ? 1 : batch);

  for (const d of pending ?? []) {
    try {
      await aiReviewDocument(d.id);
      stats.reviewed += 1;
    } catch (e) {
      if (e instanceof GatewayDenied) {
        await pauseDocumentJob(`AI блокиран (HTTP ${e.status}): ${e.message}`);
        return { ...stats, paused: true };
      }
      stats.errors += 1;
      await logEvent({
        document_id: d.id,
        action: "ai_review",
        status: "error",
        message: (e as Error).message,
      });
    }
  }
  if (probe) {
    if (stats.reviewed > 0) await resumeDocumentJob();
    return stats;
  }

  const now = new Date().toISOString();

  // 2) Напомняния за неизпратени документи
  const { data: due } = await db()
    .from("document_requests")
    .select("id, reminders_sent, requirement_name, client_id")
    .eq("status", "pending")
    .not("next_reminder_at", "is", null)
    .lte("next_reminder_at", now)
    .limit(batch);

  for (const r of due ?? []) {
    const sent = (r.reminders_sent ?? 0) + 1;
    const exhausted = sent >= settings.max_reminders;
    await db()
      .from("document_requests")
      .update({
        reminders_sent: sent,
        last_reminder_at: now,
        next_reminder_at: exhausted
          ? null
          : new Date(Date.now() + settings.reminder_days * 86400000).toISOString(),
        updated_at: now,
      })
      .eq("id", r.id);
    await logEvent({
      request_id: r.id,
      action: "reminder_due",
      message: `Напомняне №${sent} за „${r.requirement_name}“`,
    });
    stats.reminders += 1;
  }

  // 3) Просрочени заявки
  const { data: over } = await db()
    .from("document_requests")
    .select("id")
    .eq("status", "pending")
    .lt("due_at", now)
    .limit(batch);
  for (const r of over ?? []) {
    await db()
      .from("document_requests")
      .update({ status: "expired", next_reminder_at: null, updated_at: now })
      .eq("id", r.id);
    await logEvent({ request_id: r.id, action: "request_expired" });
    stats.overdue += 1;
  }

  // 4) Изтекли документи
  const today = new Date().toISOString().slice(0, 10);
  const { data: exp } = await db()
    .from("document_items")
    .select("id")
    .not("expires_at", "is", null)
    .lt("expires_at", today)
    .in("status", ["uploaded", "in_review", "approved"])
    .limit(batch);
  for (const d of exp ?? []) {
    await db().from("document_items").update({ status: "expired", updated_at: now }).eq("id", d.id);
    await logEvent({ document_id: d.id, action: "document_expired" });
    stats.expired += 1;
  }

  return stats;
}

export async function runDocumentsQueue(limit?: number) {
  const settings = await getDocumentSettings();
  if (!settings.enabled) return { skipped: "disabled" as const };

  const job = await getDocumentJobState();
  const batch = Math.max(1, Math.min(limit ?? settings.batch_size, 50));

  if (job.paused) {
    const probe = await processBatch(1, settings, true);
    return { paused: true, reason: job.paused_reason, probe };
  }

  if (!(await claimJob(settings.lease_seconds))) return { skipped: "locked" as const };
  try {
    const stats = await processBatch(batch, settings, false);
    await releaseJob(stats as unknown as Record<string, number | string | boolean | null>);
    return stats;
  } catch (e) {
    await releaseJob({ error: (e as Error).message });
    throw e;
  }
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------
export async function documentsAnalytics() {
  const { data: docs } = await db()
    .from("document_items")
    .select(
      "status, ai_status, doc_type, requirement_code, expires_at, created_at, reviewed_at, source",
    )
    .order("created_at", { ascending: false })
    .limit(2000);
  const rows = docs ?? [];

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let reviewHours = 0;
  let reviewCount = 0;
  let expiringSoon = 0;

  const settings = await getDocumentSettings();
  const warnUntil = Date.now() + settings.expiry_warning_days * 86400000;

  for (const r of rows) {
    byStatus[r.status ?? "uploaded"] = (byStatus[r.status ?? "uploaded"] ?? 0) + 1;
    const t = r.requirement_code ?? r.doc_type ?? "other";
    byType[t] = (byType[t] ?? 0) + 1;
    bySource[r.source ?? "crm"] = (bySource[r.source ?? "crm"] ?? 0) + 1;
    if (r.reviewed_at && r.created_at) {
      reviewHours +=
        (new Date(r.reviewed_at).getTime() - new Date(r.created_at).getTime()) / 3600000;
      reviewCount += 1;
    }
    if (r.expires_at && r.status !== "expired") {
      const t2 = new Date(r.expires_at).getTime();
      if (t2 >= Date.now() && t2 <= warnUntil) expiringSoon += 1;
    }
  }

  const { data: reqs } = await db().from("document_requests").select("status");
  const requestsByStatus: Record<string, number> = {};
  for (const r of reqs ?? []) requestsByStatus[r.status] = (requestsByStatus[r.status] ?? 0) + 1;

  const closed = (requestsByStatus["approved"] ?? 0) + (requestsByStatus["uploaded"] ?? 0);
  const totalReq = (reqs ?? []).length;

  return {
    total: rows.length,
    byStatus,
    byType,
    bySource,
    expiringSoon,
    pendingReview: (byStatus["uploaded"] ?? 0) + (byStatus["in_review"] ?? 0),
    approved: byStatus["approved"] ?? 0,
    expired: byStatus["expired"] ?? 0,
    avgReviewHours: reviewCount ? Math.round((reviewHours / reviewCount) * 10) / 10 : 0,
    requestsByStatus,
    collectionRate: totalReq ? Math.round((closed / totalReq) * 100) : 0,
  };
}

export async function listDocumentEvents(limit = 120) {
  const { data, error } = await db()
    .from("document_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ------------------------------------------------------------------
// Качване от публичния линк
// ------------------------------------------------------------------
export async function uploadByToken(
  token: string,
  file: { name: string; type: string; size: number; bytes: ArrayBuffer },
  note?: string | null,
) {
  const settings = await getDocumentSettings();
  const request = await getRequestByToken(token);
  if (!request) throw new Error("Невалиден или изтекъл линк");
  if (["approved", "cancelled"].includes(request.status)) throw new Error("Заявката е приключена");
  if (file.size > settings.max_file_mb * 1024 * 1024)
    throw new Error(`Файлът е над ${settings.max_file_mb} MB`);

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `requests/${request.id}/${Date.now()}-${safe}`;
  const { error: upErr } = await db()
    .storage.from(BUCKET)
    .upload(path, new Uint8Array(file.bytes), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) throw new Error(upErr.message);

  const doc = await registerDocument({
    requirementCode: request.requirement_code,
    clientId: request.client_id,
    propertyId: request.property_id,
    fileName: file.name,
    storagePath: path,
    fileSize: file.size,
    mimeType: file.type,
    source: "client_link",
    notes: note ?? null,
    requestId: request.id,
  });

  await db()
    .from("document_requests")
    .update({ attempts: (request.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq("id", request.id);
  return doc;
}
