import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import { resolveServerDb } from "@/lib/supabase-server-db";

type ChecklistUpdate = Database["public"]["Tables"]["document_checklist"]["Update"];
type ClientDocUpdate = Database["public"]["Tables"]["client_documents"]["Update"];
type PropertyDocUpdate = Database["public"]["Tables"]["property_documents"]["Update"];

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

const uuid = z.string().uuid();
const optUuid = uuid.optional().nullable();

export const DOC_STATUSES = ["missing", "requested", "uploaded", "verified", "expired"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const DOC_TYPES = [
  { id: "id_card", label: "Лична карта", subject: "client" },
  { id: "power_of_attorney", label: "Пълномощно", subject: "client" },
  { id: "marital_status", label: "Семеен статус", subject: "client" },
  { id: "skica", label: "Скица", subject: "property" },
  { id: "tax_evaluation", label: "Данъчна оценка", subject: "property" },
  { id: "notary_deed", label: "Нотариален акт", subject: "property" },
  { id: "encumbrance", label: "Проверка за тежести", subject: "property" },
  { id: "cadastral", label: "Кадастрална схема", subject: "property" },
  { id: "tax_declaration", label: "Данъчна декларация", subject: "property" },
  { id: "other", label: "Друго", subject: "any" },
] as const;

export type DocTypeId = (typeof DOC_TYPES)[number]["id"];

const DOC_TYPE_SET = new Set<string>(DOC_TYPES.map((t) => t.id));

export function labelDocType(raw: string | null | undefined): string {
  const id = normalizeDocType(raw);
  return DOC_TYPES.find((t) => t.id === id)?.label ?? (raw?.trim() || "Друго");
}

export function normalizeDocType(raw: string | null | undefined): string {
  const t = String(raw ?? "").trim().toLowerCase();
  if (!t) return "other";
  const first = t.split(":")[0]?.replace(/^guarantor/, "") ?? t;
  if (DOC_TYPE_SET.has(first)) return first;
  if (t.includes("id_card") || t.includes("личн") || t === "id") return "id_card";
  if (t.includes("power") || t.includes("пълном") || t.includes("attorney")) return "power_of_attorney";
  if (t.includes("marital") || t.includes("семеен")) return "marital_status";
  if (t.includes("skica") || t.includes("скиц")) return "skica";
  if (t.includes("tax_eval") || (t.includes("данъчн") && t.includes("оцен"))) return "tax_evaluation";
  if (t.includes("notary") || t.includes("нотариал") || t.includes("deed") || t.includes("property_deed")) return "notary_deed";
  if (t.includes("encumbr") || t.includes("тежест")) return "encumbrance";
  if (t.includes("cadastr") || t.includes("кадастр")) return "cadastral";
  if (t.includes("tax_decl") || t.includes("декларац")) return "tax_declaration";
  if (t.includes("salary") || t.includes("bank_statement") || t.includes("employment")) return "other";
  return DOC_TYPE_SET.has(t) ? t : "other";
}

export type DeskRow = {
  id: string;
  source: "client" | "property" | "archive" | "checklist";
  client_id: string | null;
  client_name: string | null;
  property_id: string | null;
  property_title: string | null;
  archived_property_id: string | null;
  doc_type: string;
  doc_type_label: string;
  file_name: string | null;
  file_url: string | null;
  status: DocStatus;
  expires_at: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string | null;
  verified_at: string | null;
  mime_type: string | null;
  file_size: number | null;
  notes: string | null;
  checklist_id: string | null;
};

export type DeskAnalytics = {
  total: number;
  complete_pct: number;
  missing: number;
  requested: number;
  uploaded: number;
  verified: number;
  expired: number;
  expiring_30: number;
  overdue: number;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function effectiveStatus(status: string | null | undefined, expiresAt: string | null | undefined): DocStatus {
  const today = todayIsoDate();
  if (expiresAt && expiresAt < today) return "expired";
  const s = String(status ?? "missing");
  if ((DOC_STATUSES as readonly string[]).includes(s)) return s as DocStatus;
  return "uploaded";
}

function asName(rel: unknown): string | null {
  if (!rel || typeof rel !== "object") return null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  if (!row || typeof row !== "object") return null;
  const name = (row as { full_name?: unknown; title?: unknown }).full_name
    ?? (row as { title?: unknown }).title;
  return typeof name === "string" && name.trim() ? name : null;
}

async function brokerNames(db: ReturnType<typeof resolveServerDb>): Promise<Map<string, string>> {
  const { data } = await db.from("brokers").select("user_id, full_name");
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.user_id && row.full_name) map.set(row.user_id, row.full_name);
  }
  return map;
}

const filterSchema = z.object({
  client_id: uuid.optional(),
  property_id: uuid.optional(),
  doc_type: z.string().max(64).optional(),
  status: z.enum(DOC_STATUSES).optional(),
});

export const listDocumentDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filterSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));

    const names = await brokerNames(db);
    const today = todayIsoDate();
    const soon = daysFromNow(30);

    const [clientRes, propRes, checkRes, archiveRes] = await Promise.all([
      db.from("client_documents")
        .select("id, client_id, document_type, file_name, file_url, file_size, mime_type, notes, uploaded_by, created_at, status, expires_at, verified_at, clients:client_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(800),
      db.from("property_documents")
        .select("id, property_id, doc_type, file_name, file_url, file_size, mime_type, notes, uploaded_by, created_at, status, expires_at, verified_at, properties:property_id(title)")
        .order("created_at", { ascending: false })
        .limit(800),
      db.from("document_checklist")
        .select("*, clients:client_id(full_name), properties:property_id(title)")
        .order("updated_at", { ascending: false })
        .limit(800),
      (db.from("archived_properties") as any)
        .select("id, title, documents")
        .limit(300) as Promise<{ data: Array<{ id: string; title: string; documents?: Record<string, { name?: string; url?: string; path?: string }> | null }> | null; error: { message: string } | null }>,
    ]);

    if (clientRes.error) throw new Error(clientRes.error.message);
    if (propRes.error) throw new Error(propRes.error.message);
    if (checkRes.error) throw new Error(checkRes.error.message);

    const rows: DeskRow[] = [];
    const seenFileKeys = new Set<string>();
    const expireCheck: string[] = [];
    const expireClient: string[] = [];
    const expireProp: string[] = [];

    for (const row of checkRes.data ?? []) {
      const status = effectiveStatus(row.status, row.expires_at);
      if (status === "expired" && row.status !== "expired") expireCheck.push(row.id);
      const fileKey = row.file_source && row.file_id ? `${row.file_source}:${row.file_id}` : null;
      if (fileKey) seenFileKeys.add(fileKey);
      rows.push({
        id: `check:${row.id}`,
        source: row.file_url ? (row.file_source === "property_documents" ? "property" : row.file_source === "archive-docs" ? "archive" : "client") : "checklist",
        client_id: row.client_id,
        client_name: asName(row.clients),
        property_id: row.property_id,
        property_title: asName(row.properties),
        archived_property_id: row.archived_property_id,
        doc_type: row.doc_type,
        doc_type_label: labelDocType(row.doc_type),
        file_name: row.file_name,
        file_url: row.file_url,
        status,
        expires_at: row.expires_at,
        uploaded_by: row.uploaded_by,
        uploaded_by_name: row.uploaded_by ? names.get(row.uploaded_by) ?? null : null,
        uploaded_at: row.uploaded_at ?? row.created_at,
        verified_at: row.verified_at,
        mime_type: null,
        file_size: null,
        notes: row.notes,
        checklist_id: row.id,
      });
    }

    for (const row of clientRes.data ?? []) {
      const key = `client_documents:${row.id}`;
      if (seenFileKeys.has(key)) continue;
      const status = effectiveStatus(row.status ?? "uploaded", row.expires_at);
      if (status === "expired" && row.status !== "expired") expireClient.push(row.id);
      rows.push({
        id: `client:${row.id}`,
        source: "client",
        client_id: row.client_id,
        client_name: asName(row.clients),
        property_id: null,
        property_title: null,
        archived_property_id: null,
        doc_type: normalizeDocType(row.document_type),
        doc_type_label: labelDocType(row.document_type),
        file_name: row.file_name,
        file_url: row.file_url,
        status,
        expires_at: row.expires_at,
        uploaded_by: row.uploaded_by,
        uploaded_by_name: row.uploaded_by ? names.get(row.uploaded_by) ?? null : null,
        uploaded_at: row.created_at,
        verified_at: row.verified_at,
        mime_type: row.mime_type,
        file_size: row.file_size,
        notes: row.notes,
        checklist_id: null,
      });
    }

    for (const row of propRes.data ?? []) {
      const key = `property_documents:${row.id}`;
      if (seenFileKeys.has(key)) continue;
      const status = effectiveStatus(row.status ?? "uploaded", row.expires_at);
      if (status === "expired" && row.status !== "expired") expireProp.push(row.id);
      rows.push({
        id: `property:${row.id}`,
        source: "property",
        client_id: null,
        client_name: null,
        property_id: row.property_id,
        property_title: asName(row.properties),
        archived_property_id: null,
        doc_type: normalizeDocType(row.doc_type),
        doc_type_label: labelDocType(row.doc_type),
        file_name: row.file_name,
        file_url: row.file_url,
        status,
        expires_at: row.expires_at,
        uploaded_by: row.uploaded_by,
        uploaded_by_name: row.uploaded_by ? names.get(row.uploaded_by) ?? null : null,
        uploaded_at: row.created_at,
        verified_at: row.verified_at,
        mime_type: row.mime_type,
        file_size: row.file_size,
        notes: row.notes,
        checklist_id: null,
      });
    }

    if (!archiveRes.error) {
      for (const arch of archiveRes.data ?? []) {
        const docs = (arch.documents ?? {}) as Record<string, { name?: string; url?: string; path?: string }>;
        for (const [slot, doc] of Object.entries(docs)) {
          if (!doc?.url && !doc?.path) continue;
          const key = `archive-docs:${arch.id}:${slot}`;
          if (seenFileKeys.has(key)) continue;
          rows.push({
            id: `archive:${arch.id}:${slot}`,
            source: "archive",
            client_id: null,
            client_name: null,
            property_id: null,
            property_title: arch.title,
            archived_property_id: arch.id,
            doc_type: normalizeDocType(slot),
            doc_type_label: labelDocType(slot),
            file_name: doc.name ?? slot,
            file_url: doc.url ?? null,
            status: "uploaded",
            expires_at: null,
            uploaded_by: null,
            uploaded_by_name: null,
            uploaded_at: null,
            verified_at: null,
            mime_type: null,
            file_size: null,
            notes: null,
            checklist_id: null,
          });
        }
      }
    }

    if (expireCheck.length) {
      await db.from("document_checklist").update({ status: "expired" }).in("id", expireCheck);
    }
    if (expireClient.length) {
      await db.from("client_documents").update({ status: "expired" }).in("id", expireClient);
    }
    if (expireProp.length) {
      await db.from("property_documents").update({ status: "expired" }).in("id", expireProp);
    }

    const filtered = rows.filter((r) => {
      if (data.client_id && r.client_id !== data.client_id) return false;
      if (data.property_id && r.property_id !== data.property_id && r.archived_property_id !== data.property_id) return false;
      if (data.doc_type && r.doc_type !== data.doc_type) return false;
      if (data.status && r.status !== data.status) return false;
      return true;
    });

    const counts: Record<DocStatus, number> = {
      missing: 0, requested: 0, uploaded: 0, verified: 0, expired: 0,
    };
    let expiring_30 = 0;
    let overdue = 0;
    for (const r of filtered) {
      counts[r.status] += 1;
      if (r.expires_at && r.expires_at < today) overdue += 1;
      else if (r.expires_at && r.expires_at <= soon && r.status !== "expired") expiring_30 += 1;
    }
    const tracked = filtered.length;
    const required = filtered.filter((r) => r.checklist_id);
    const pctBase = required.length ? required : filtered;
    const done = pctBase.filter((r) => r.status === "uploaded" || r.status === "verified").length;
    const analytics: DeskAnalytics = {
      total: tracked,
      complete_pct: pctBase.length ? Math.round((done / pctBase.length) * 100) : 0,
      missing: counts.missing,
      requested: counts.requested,
      uploaded: counts.uploaded,
      verified: counts.verified,
      expired: counts.expired,
      expiring_30,
      overdue,
    };

    filtered.sort((a, b) => String(b.uploaded_at ?? "").localeCompare(String(a.uploaded_at ?? "")));
    return { rows: filtered, analytics };
  });

export const listDocumentLookups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = resolveServerDb(context.supabase);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const [clients, properties] = await Promise.all([
      db.from("clients").select("id, full_name, phone").order("full_name").limit(400),
      db.from("properties").select("id, title").order("created_at", { ascending: false }).limit(400),
    ]);
    if (clients.error) throw new Error(clients.error.message);
    if (properties.error) throw new Error(properties.error.message);
    return {
      clients: clients.data ?? [],
      properties: properties.data ?? [],
    };
  });

const seedSchema = z.object({
  client_id: optUuid,
  property_id: optUuid,
  archived_property_id: optUuid,
});

export const seedDealChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => seedSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    if (!data.client_id && !data.property_id && !data.archived_property_id) {
      throw new Error("Избери клиент и/или имот.");
    }
    const types = DOC_TYPES.filter((t) => {
      if (t.subject === "any") return false;
      if (t.subject === "client") return !!data.client_id;
      return !!(data.property_id || data.archived_property_id);
    });
    const payload = types.map((t) => ({
      client_id: data.client_id ?? null,
      property_id: data.property_id ?? null,
      archived_property_id: data.archived_property_id ?? null,
      doc_type: t.id,
      status: "missing" as const,
    }));
    for (const row of payload) {
      let q = db.from("document_checklist").select("id").eq("doc_type", row.doc_type);
      q = row.client_id ? q.eq("client_id", row.client_id) : q.is("client_id", null);
      q = row.property_id ? q.eq("property_id", row.property_id) : q.is("property_id", null);
      q = row.archived_property_id
        ? q.eq("archived_property_id", row.archived_property_id)
        : q.is("archived_property_id", null);
      const found = await q.maybeSingle();
      if (found.data?.id) continue;
      const ins = await db.from("document_checklist").insert(row);
      if (ins.error && !/duplicate|unique/i.test(ins.error.message)) throw new Error(ins.error.message);
    }
    return { ok: true, count: types.length };
  });

const checklistPatch = z.object({
  id: uuid,
  status: z.enum(DOC_STATUSES).optional(),
  expires_at: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => checklistPatch.parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const patch: ChecklistUpdate = {};
    if (data.status) {
      patch.status = data.status;
      if (data.status === "requested") patch.requested_at = new Date().toISOString();
      if (data.status === "verified") {
        patch.verified_at = new Date().toISOString();
        patch.verified_by = context.userId;
      }
    }
    if (data.expires_at !== undefined) patch.expires_at = data.expires_at;
    if (data.notes !== undefined) patch.notes = data.notes;
    const { error } = await db.from("document_checklist").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const { error } = await db.from("document_checklist").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const registerSchema = z.object({
  client_id: optUuid,
  property_id: optUuid,
  archived_property_id: optUuid,
  doc_type: z.string().min(1).max(64),
  file_url: z.string().min(1).max(4000),
  file_name: z.string().min(1).max(255),
  file_size: z.number().int().optional().nullable(),
  mime_type: z.string().max(120).optional().nullable(),
  file_path: z.string().max(500).optional().nullable(),
  expires_at: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  bucket: z.enum(["client-documents", "property-documents", "archive-docs"]),
});

export const registerDocumentUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => registerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const docType = normalizeDocType(data.doc_type);
    const now = new Date().toISOString();
    let fileId: string | null = null;
    let fileSource: "client_documents" | "property_documents" | "archive-docs" = "client_documents";

    if (data.bucket === "client-documents") {
      if (!data.client_id) throw new Error("Липсва клиент за клиентски документ.");
      const { data: row, error } = await db.from("client_documents").insert({
        client_id: data.client_id,
        document_type: docType,
        file_url: data.file_url,
        file_name: data.file_name,
        file_size: data.file_size ?? null,
        mime_type: data.mime_type ?? null,
        notes: data.notes ?? null,
        uploaded_by: context.userId,
        status: "uploaded",
        expires_at: data.expires_at ?? null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      fileId = row.id;
      fileSource = "client_documents";
    } else if (data.bucket === "property-documents") {
      if (!data.property_id) throw new Error("Липсва имот за имотен документ.");
      const { data: row, error } = await db.from("property_documents").insert({
        property_id: data.property_id,
        doc_type: docType,
        file_url: data.file_url,
        file_name: data.file_name,
        file_path: data.file_path || `${data.property_id}/${docType}/${data.file_name}`,
        file_size: data.file_size ?? null,
        mime_type: data.mime_type ?? null,
        notes: data.notes ?? null,
        uploaded_by: context.userId,
        status: "uploaded",
        expires_at: data.expires_at ?? null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      fileId = row.id;
      fileSource = "property_documents";
    } else {
      fileSource = "archive-docs";
    }

    // Attach to matching checklist slot if present; otherwise create one.
    let q = db.from("document_checklist").select("id").eq("doc_type", docType);
    q = data.client_id ? q.eq("client_id", data.client_id) : q.is("client_id", null);
    q = data.property_id ? q.eq("property_id", data.property_id) : q.is("property_id", null);
    q = data.archived_property_id
      ? q.eq("archived_property_id", data.archived_property_id)
      : q.is("archived_property_id", null);
    const { data: slot } = await q.maybeSingle();
    const checkPatch = {
      status: "uploaded" as const,
      file_source: fileSource,
      file_id: fileId,
      file_url: data.file_url,
      file_name: data.file_name,
      expires_at: data.expires_at ?? null,
      uploaded_at: now,
      uploaded_by: context.userId,
      notes: data.notes ?? null,
    };
    if (slot?.id) {
      const { error } = await db.from("document_checklist").update(checkPatch).eq("id", slot.id);
      if (error) throw new Error(error.message);
    } else if (data.client_id || data.property_id || data.archived_property_id) {
      const { error } = await db.from("document_checklist").insert({
        client_id: data.client_id ?? null,
        property_id: data.property_id ?? null,
        archived_property_id: data.archived_property_id ?? null,
        doc_type: docType,
        ...checkPatch,
      });
      if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    }

    return { ok: true, file_id: fileId };
  });

const fileTrackSchema = z.object({
  source: z.enum(["client", "property", "checklist"]),
  id: uuid,
  status: z.enum(["uploaded", "verified", "expired", "requested", "missing"]).optional(),
  expires_at: z.string().max(20).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateDocumentTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => fileTrackSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = resolveServerDb(context.supabase);
    await assertCrmAccess(context.userId, context.supabase, authEmail(context.claims));
    const now = new Date().toISOString();
    if (data.source === "checklist") {
      const patch: ChecklistUpdate = {};
      if (data.expires_at !== undefined) patch.expires_at = data.expires_at;
      if (data.notes !== undefined) patch.notes = data.notes;
      if (data.status) {
        patch.status = data.status;
        if (data.status === "verified") {
          patch.verified_at = now;
          patch.verified_by = context.userId;
        }
        if (data.status === "requested") patch.requested_at = now;
      }
      const { error } = await db.from("document_checklist").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else if (data.source === "client") {
      const patch: ClientDocUpdate = {};
      if (data.expires_at !== undefined) patch.expires_at = data.expires_at;
      if (data.notes !== undefined) patch.notes = data.notes;
      if (data.status === "uploaded" || data.status === "verified" || data.status === "expired") {
        patch.status = data.status;
        if (data.status === "verified") {
          patch.verified_at = now;
          patch.verified_by = context.userId;
        }
      }
      const { error } = await db.from("client_documents").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const patch: PropertyDocUpdate = {};
      if (data.expires_at !== undefined) patch.expires_at = data.expires_at;
      if (data.notes !== undefined) patch.notes = data.notes;
      if (data.status === "uploaded" || data.status === "verified" || data.status === "expired") {
        patch.status = data.status;
        if (data.status === "verified") {
          patch.verified_at = now;
          patch.verified_by = context.userId;
        }
      }
      const { error } = await db.from("property_documents").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
