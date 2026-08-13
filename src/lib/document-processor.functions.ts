import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { unzipSync, strFromU8 } from "fflate";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveServerDb } from "@/lib/supabase-server-db";
import { assertAdmin } from "@/lib/auth/crm-access";
import { aiChatCompletions } from "@/lib/ai-provider";

/* ============================================================
 * AI-driven document ingest.
 *
 * Flow:
 *   1. Client uploads file(s) directly to Supabase Storage under
 *      client-documents/temp/{batch_id}/{filename}
 *   2. Client calls processBatchFile({ batch_id, storage_path, ... })
 *      per file. For ZIPs the fn extracts each inner file to
 *      temp/{batch_id}/... and classifies every entry with Gemini.
 *   3. Client shows AI results, user approves, then calls
 *      commitDocumentBatch → resolves client, moves files to
 *      {client_id}/{category}/{filename}, inserts client_documents.
 * ============================================================ */

const CATEGORIES = [
  "id_card_front",
  "id_card_back",
  "salary_slip",
  "bank_statement",
  "employment_contract",
  "property_deed",
  "tax_declaration",
  "other",
] as const;
type Category = (typeof CATEGORIES)[number];

type Classified = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size: number;
  category: Category;
  period_day: number | null;
  period_month: number | null;
  period_year: number | null;
  detected_client_name: string | null;
  detected_bank: string | null;
  detected_amount: number | null;
  confidence: number;
  reasoning: string;
};

const BUCKET = "client-documents";
const AI_MAX_BYTES = 15 * 1024 * 1024; // 15MB per file to model

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "zip") return "application/zip";
  return "application/octet-stream";
}

function isSupportedByAi(mime: string): boolean {
  return /^image\/(jpeg|png|webp|heic)$/i.test(mime) || mime === "application/pdf";
}

/* -----------------------------------------------------------
 * Gemini classification via AI Gateway (multimodal chat).
 * ----------------------------------------------------------- */
async function classifyDocument(
  fileBytes: Uint8Array,
  fileName: string,
  mimeType: string,
): Promise<Omit<Classified, "storage_path" | "file_name" | "mime_type" | "size">> {
  // Force model choice: user selected Gemini 3 Pro Preview for this feature.
  const model = process.env.DOC_INGEST_MODEL ?? "google/gemini-3-pro-preview";

  // btoa is available in Workers/Node20; encode chunk-by-chunk to avoid stack blowups.
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < fileBytes.length; i += chunk) {
    bin += String.fromCharCode(...fileBytes.subarray(i, i + chunk));
  }
  const b64 = btoa(bin);

  const dataUrl = `data:${mimeType};base64,${b64}`;

  const systemPrompt = `Ти си експертен класификатор на български банкови и лични документи за ипотечен кредит. Върни СТРОГО валиден JSON, без коментари. Схема:
{
  "category": "id_card_front|id_card_back|salary_slip|bank_statement|employment_contract|property_deed|tax_declaration|other",
  "period_day":   1-31 или null (точен ден от датата на документа, ако е видим),
  "period_month": 1-12 или null (само за фишове/извлечения),
  "period_year": 2000-2100 или null,
  "detected_client_name": "име и фамилия" или null,
  "detected_bank": "името на банката (напр. УниКредит, ДСК, Пощенска)" или null,
  "detected_amount": число (сума в лева/евро) или null,
  "confidence": 0.0-1.0,
  "reasoning": "1 изречение на български защо си избрал тази категория"
}

Правила:
- "фиш за заплата", "разчетно-платежен документ" → salary_slip
- "извлечение", "движение по сметка", "банково извлечение" → bank_statement
- Лична карта: лицевата страна (снимка + име) → id_card_front; гърбът (адрес) → id_card_back
- "трудов договор", "договор за работа" → employment_contract
- "нотариален акт", "документ за собственост" → property_deed
- "декларация чл. 14", "декларация ЗМДТ" → tax_declaration
- Ако не можеш да определиш категорията с > 0.4 увереност → "other"
- Датата: върни точния ДЕН, МЕСЕЦ и ГОДИНА, както са отпечатани на документа (напр. "период 07.03.2026" → day 7, month 3, year 2026). Ако видиш само месец/година — попълни само тях. Ако документът покрива период, върни КРАЙНАТА дата.`;

  const contentBlocks: Array<Record<string, unknown>> = [
    { type: "text", text: `Класифицирай този документ. Име на файла: "${fileName}".` },
  ];
  if (mimeType.startsWith("image/")) {
    contentBlocks.push({ type: "image_url", image_url: { url: dataUrl } });
  } else if (mimeType === "application/pdf") {
    contentBlocks.push({ type: "file", file: { filename: fileName, file_data: dataUrl } });
  } else {
    // Unsupported binary — return other with 0 confidence.
    return {
      category: "other",
      period_day: null,
      period_month: null,
      period_year: null,
      detected_client_name: null,
      detected_bank: null,
      detected_amount: null,
      confidence: 0,
      reasoning: "Файлът не е изображение или PDF — не мога да го анализирам.",
    };
  }

  const res = await aiChatCompletions({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: contentBlocks },
    ],
    temperature: 0.1,
  });

  if (!res.ok) {
    console.error("[doc-ingest] AI error", res.status, (await res.text()).slice(0, 300));
    return {
      category: "other",
      period_day: null,
      period_month: null,
      period_year: null,
      detected_client_name: null,
      detected_bank: null,
      detected_amount: null,
      confidence: 0,
      reasoning: "AI услугата не отговори — файлът е запазен като 'Друго'.",
    };
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // Try to extract first JSON object substring.
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]) as Record<string, unknown>; } catch { /* ignore */ }
    }
  }

  const cat = (typeof parsed.category === "string" && (CATEGORIES as readonly string[]).includes(parsed.category)
    ? parsed.category
    : "other") as Category;

  const asInt = (v: unknown, min: number, max: number): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return null;
    const r = Math.round(n);
    return r >= min && r <= max ? r : null;
  };

  return {
    category: cat,
    period_day: asInt(parsed.period_day, 1, 31),
    period_month: asInt(parsed.period_month, 1, 12),
    period_year: asInt(parsed.period_year, 2000, 2100),
    detected_client_name: typeof parsed.detected_client_name === "string" ? parsed.detected_client_name.slice(0, 200) : null,
    detected_bank: typeof parsed.detected_bank === "string" ? parsed.detected_bank.slice(0, 100) : null,
    detected_amount: typeof parsed.detected_amount === "number" ? parsed.detected_amount : null,
    confidence: Math.min(1, Math.max(0, typeof parsed.confidence === "number" ? parsed.confidence : 0)),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 500) : "",
  };
}

/* -----------------------------------------------------------
 * startDocumentBatch — mints a batch UUID.
 * ----------------------------------------------------------- */
export const startDocumentBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    return { batch_id: crypto.randomUUID() };
  });

/* -----------------------------------------------------------
 * processBatchFile — downloads (from temp/{batch}/...), and if
 * ZIP extracts inner files back into temp/{batch}/inner/…,
 * classifies each entry, returns classification results.
 * ----------------------------------------------------------- */
export const processBatchFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      batch_id: z.string().uuid(),
      storage_path: z.string().min(1).max(500),
      file_name: z.string().min(1).max(255),
      mime_type: z.string().max(120).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const db = resolveServerDb(context.supabase);

    // Fetch bytes from Storage (server-side, RLS applies).
    const dl = await db.storage.from(BUCKET).download(data.storage_path);
    if (dl.error || !dl.data) {
      throw new Error("Файлът не може да бъде прочетен: " + (dl.error?.message ?? "unknown"));
    }
    const arr = new Uint8Array(await dl.data.arrayBuffer());
    const mime = data.mime_type || guessMime(data.file_name);
    const isZip = mime === "application/zip" || data.file_name.toLowerCase().endsWith(".zip");

    const results: Classified[] = [];

    if (isZip) {
      let entries: Record<string, Uint8Array>;
      try {
        entries = unzipSync(arr);
      } catch (e) {
        throw new Error("Невалиден ZIP архив: " + (e as Error).message);
      }

      for (const [innerName, innerBytes] of Object.entries(entries)) {
        // Skip directories and macOS metadata.
        if (innerName.endsWith("/")) continue;
        if (innerName.includes("__MACOSX/") || innerName.split("/").pop()?.startsWith(".")) continue;
        if (innerBytes.length === 0) continue;

        const baseName = innerName.split("/").pop() ?? "file";
        const innerMime = guessMime(baseName);

        // Upload each inner file back to temp/ so commit can move it.
        const safeName = baseName.replace(/[^\w.\-]+/g, "_");
        const innerPath = `temp/${data.batch_id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName}`;
        const upl = await db.storage
          .from(BUCKET)
          .upload(innerPath, innerBytes as unknown as Uint8Array, { contentType: innerMime, upsert: false });
        if (upl.error) {
          console.error("[doc-ingest] inner upload failed", upl.error.message);
          continue;
        }

        let classification;
        if (isSupportedByAi(innerMime) && innerBytes.length <= AI_MAX_BYTES) {
          classification = await classifyDocument(innerBytes, baseName, innerMime);
        } else if (baseName.toLowerCase().endsWith(".txt") || innerMime.startsWith("text/")) {
          // Text files: pass as short text to model.
          const text = strFromU8(innerBytes).slice(0, 4000);
          const fake = new TextEncoder().encode(text);
          classification = await classifyDocument(fake, baseName, "image/png"); // fallback low conf
          classification.reasoning = "Текстов файл — само по име и съдържание.";
        } else {
          classification = {
            category: "other" as const,
            period_day: null,
            period_month: null,
            period_year: null,
            detected_client_name: null,
            detected_bank: null,
            detected_amount: null,
            confidence: 0,
            reasoning: "Файлът не е снимка/PDF — запазен като 'Друго'.",
          };
        }

        results.push({
          storage_path: innerPath,
          file_name: baseName,
          mime_type: innerMime,
          size: innerBytes.length,
          ...classification,
        });
      }

      // Delete the original ZIP from storage — no longer needed.
      await db.storage.from(BUCKET).remove([data.storage_path]);
    } else {
      let classification;
      if (isSupportedByAi(mime) && arr.length <= AI_MAX_BYTES) {
        classification = await classifyDocument(arr, data.file_name, mime);
      } else {
        classification = {
          category: "other" as const,
          period_day: null,
          period_month: null,
          period_year: null,
          detected_client_name: null,
          detected_bank: null,
          detected_amount: null,
          confidence: 0,
          reasoning: arr.length > AI_MAX_BYTES
            ? "Файлът е твърде голям за AI анализ (>15MB) — запазен като 'Друго'."
            : "Форматът не се поддържа от AI — запазен като 'Друго'.",
        };
      }
      results.push({
        storage_path: data.storage_path,
        file_name: data.file_name,
        mime_type: mime,
        size: arr.length,
        ...classification,
      });
    }

    return { batch_id: data.batch_id, files: results };
  });

/* -----------------------------------------------------------
 * commitDocumentBatch — resolves client, moves files to final
 * paths, inserts client_documents rows.
 * ----------------------------------------------------------- */
export const commitDocumentBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      batch_id: z.string().uuid(),
      client_id: z.string().uuid().optional().nullable(),
      client_name: z.string().min(2).max(200).optional().nullable(),
      files: z.array(
        z.object({
          storage_path: z.string().min(1).max(500),
          file_name: z.string().min(1).max(255),
          mime_type: z.string().max(120),
          size: z.number().int().nonnegative(),
          category: z.enum(CATEGORIES),
          period_day: z.number().int().min(1).max(31).nullable(),
          period_month: z.number().int().min(1).max(12).nullable(),
          period_year: z.number().int().min(2000).max(2100).nullable(),
          detected_client_name: z.string().max(200).nullable().optional(),
          detected_bank: z.string().max(100).nullable().optional(),
          detected_amount: z.number().nullable().optional(),
          confidence: z.number().min(0).max(1),
          reasoning: z.string().max(500).optional().default(""),
        }),
      ).min(1).max(200),
    }).refine((v) => !!(v.client_id || v.client_name), {
      message: "Липсва client_id или client_name",
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.supabase, authEmail(context.claims));
    const db = resolveServerDb(context.supabase);

    // 1) Resolve client
    let clientId = data.client_id ?? null;
    let created = false;
    if (!clientId && data.client_name) {
      // RPC declared in manual migration; types haven't been regenerated yet.
      const { data: rpc, error } = await (db.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "find_or_create_client_by_name",
        { _name: data.client_name, _created_by: context.userId },
      );
      if (error) throw new Error("Клиент не може да бъде намерен/създаден: " + error.message);
      clientId = rpc as unknown as string;
      created = true;
    }
    if (!clientId) throw new Error("Не е избран клиент.");

    // 2) Move each file & insert record
    const inserted: Array<{ id: string; category: string; period_month: number | null; period_year: number | null; file_name: string }> = [];
    for (const f of data.files) {
      const finalName = buildFinalName(f);
      const finalPath = `${clientId}/${f.category}/${finalName}`;

      // storage.move copies + deletes atomically inside the same bucket.
      const mv = await db.storage.from(BUCKET).move(f.storage_path, finalPath);
      if (mv.error) {
        console.error("[doc-ingest] move failed", f.storage_path, mv.error.message);
        continue;
      }
      const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(finalPath, 60 * 60 * 24 * 365);

      // New columns (category, period_*, ai_*, source_batch_id, storage_path) come
      // from the manual migration; generated types don't know them yet.
      const insertPayload: Record<string, unknown> = {
        client_id: clientId,
        document_type: f.category,
        category: f.category,
        period_day: f.period_day,
        period_month: f.period_month,
        period_year: f.period_year,
        storage_path: finalPath,
        file_url: signed?.signedUrl ?? finalPath,
        file_name: f.file_name,
        file_size: f.size,
        mime_type: f.mime_type,
        ai_confidence: f.confidence,
        ai_metadata: {
          detected_client_name: f.detected_client_name ?? null,
          detected_bank: f.detected_bank ?? null,
          detected_amount: f.detected_amount ?? null,
          reasoning: f.reasoning ?? "",
        },
        source_batch_id: data.batch_id,
        uploaded_by: context.userId,
      };
      const { data: row, error: insErr } = await (db.from("client_documents") as unknown as {
        insert: (v: Record<string, unknown>) => {
          select: (cols: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
      })
        .insert(insertPayload)
        .select("id, category, period_month, period_year, file_name")
        .single();

      if (insErr) {
        console.error("[doc-ingest] insert failed", insErr.message);
        continue;
      }
      inserted.push(row as never);
    }

    return { client_id: clientId, client_created: created, inserted, count: inserted.length };
  });

function buildFinalName(f: {
  file_name: string;
  category: Category;
  period_day: number | null;
  period_month: number | null;
  period_year: number | null;
}): string {
  const rawExt = (f.file_name.split(".").pop() ?? "bin").toLowerCase();
  const ext = rawExt.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";

  // Bulgarian slug for the category (used as the file's prefix).
  const slugMap: Record<Category, string> = {
    id_card_front:       "лична-карта-лице",
    id_card_back:        "лична-карта-гръб",
    salary_slip:         "фиш",
    bank_statement:      "извлечение",
    employment_contract: "трудов-договор",
    property_deed:       "нотариален-акт",
    tax_declaration:     "данъчна-декларация",
    other:               "документ",
  };
  const slug = slugMap[f.category];

  // Build DD-MM-YYYY / MM-YYYY / YYYY suffix from whatever the AI recognised.
  const pad = (n: number) => String(n).padStart(2, "0");
  let datePart = "";
  if (f.period_day && f.period_month && f.period_year) {
    datePart = `${pad(f.period_day)}-${pad(f.period_month)}-${f.period_year}`;
  } else if (f.period_month && f.period_year) {
    datePart = `${pad(f.period_month)}-${f.period_year}`;
  } else if (f.period_year) {
    datePart = String(f.period_year);
  }

  // ID card doesn't have a period; card face is enough.
  if (f.category === "id_card_front" || f.category === "id_card_back") {
    return `${slug}.${ext}`;
  }

  if (datePart) return `${slug}-${datePart}.${ext}`;
  // No date detected → keep slug + short original stub so it's still readable.
  const stub = f.file_name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}\-_]+/gu, "_").slice(0, 40) || "документ";
  return `${slug}-${stub}.${ext}`;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  id_card_front: "Лична карта (лице)",
  id_card_back: "Лична карта (гръб)",
  salary_slip: "Фиш за заплата",
  bank_statement: "Банково извлечение",
  employment_contract: "Трудов договор",
  property_deed: "Нотариален акт",
  tax_declaration: "Данъчна декларация",
  other: "Друго",
};

export const DOCUMENT_CATEGORIES = CATEGORIES;