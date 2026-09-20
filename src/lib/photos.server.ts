// Автоматизация №12 — AI Обработка на Снимки: подобрение, HDR и виртуално обзавеждане.
// Без зависимост от Lovable: Supabase Storage + конфигуриран image провайдър (OpenAI / Gateway).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
    storage: any;
  };

const JOB_KEY = "property_photos";
const SETTINGS_KEY = "property_photos";
const BUCKET = "property-images";

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type PhotoSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  batch_size: number;
  lease_seconds: number;
  auto_queue_new: boolean;
  auto_apply_approved: boolean;
  auto_approve_min_score: number;
  default_preset: string;
  watermark: boolean;
  max_per_property: number;
  retry_limit: number;
};

export const DEFAULT_PHOTOS: PhotoSettings = {
  enabled: true,
  ai_enabled: true,
  batch_size: 3,
  lease_seconds: 600,
  auto_queue_new: false,
  auto_apply_approved: false,
  auto_approve_min_score: 88,
  default_preset: "enhance_pro",
  watermark: false,
  max_per_property: 12,
  retry_limit: 2,
};

export async function getPhotoSettings(): Promise<PhotoSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return { ...DEFAULT_PHOTOS, ...((data?.value ?? {}) as Partial<PhotoSettings>) };
}

export async function savePhotoSettings(patch: Partial<PhotoSettings>): Promise<PhotoSettings> {
  const next = { ...(await getPhotoSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: SETTINGS_KEY, value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

// ------------------------------------------------------------------
// Състояние на фоновата задача
// ------------------------------------------------------------------
export async function getPhotoJobState() {
  const { data } = await db().from("automation_jobs").select("*").eq("key", JOB_KEY).maybeSingle();
  return {
    key: JOB_KEY,
    paused: Boolean(data?.paused),
    paused_reason: data?.paused_reason ?? null,
    paused_at: data?.paused_at ?? null,
    last_run_at: data?.last_run_at ?? null,
    locked_until: data?.locked_until ?? null,
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

export async function pausePhotoJob(reason: string) {
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

export async function resumePhotoJob() {
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
  return getPhotoJobState();
}

export async function logPhotoEvent(entry: {
  property_id?: string | null;
  asset_id?: string | null;
  action: string;
  status?: string;
  message?: string | null;
  meta?: Record<string, unknown> | null;
  actor?: string;
}) {
  await db()
    .from("photo_events")
    .insert({
      property_id: entry.property_id ?? null,
      asset_id: entry.asset_id ?? null,
      action: entry.action,
      status: entry.status ?? "ok",
      message: entry.message ?? null,
      meta: entry.meta ?? null,
      actor: entry.actor ?? "automation",
    });
}

// ------------------------------------------------------------------
// Пресети
// ------------------------------------------------------------------
export async function getPhotoPresets() {
  const { data, error } = await db()
    .from("photo_presets")
    .select("*")
    .eq("is_active", true)
    .order("kind")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getPreset(code: string) {
  const { data } = await db().from("photo_presets").select("*").eq("code", code).maybeSingle();
  if (data) return data;
  const presets = await getPhotoPresets();
  const fallback = presets[0];
  if (!fallback) throw new Error("Няма активни пресети за обработка на снимки.");
  return fallback;
}

// ------------------------------------------------------------------
// Image провайдъри (edits — обработка на съществуваща снимка)
// ------------------------------------------------------------------
type ImageProvider = {
  id: string;
  url: string;
  key: string;
  model: string;
  header: "bearer" | "lovable";
};

export function listPhotoProviders(): ImageProvider[] {
  const out: ImageProvider[] = [];

  const openai = process.env["OPENAI_API_KEY"];
  if (openai) {
    out.push({
      id: "openai",
      url: "https://api.openai.com/v1/images/edits",
      key: openai,
      model: process.env["OPENAI_IMAGE_MODEL"] ?? "gpt-image-1",
      header: "bearer",
    });
  }

  const gatewayKey =
    process.env["AI_GATEWAY_KEY"] ??
    process.env["VERCEL_AI_GATEWAY_KEY"] ??
    process.env["AI_GATEWAY_API_KEY"];
  if (gatewayKey) {
    out.push({
      id: "vercel-gateway",
      url:
        process.env["AI_GATEWAY_IMAGE_EDIT_URL"] ?? "https://ai-gateway.vercel.sh/v1/images/edits",
      key: gatewayKey,
      model: process.env["AI_GATEWAY_IMAGE_MODEL"] ?? "openai/gpt-image-1",
      header: "bearer",
    });
  }

  const lovable = process.env["LOVABLE_API_KEY"];
  if (lovable) {
    out.push({
      id: "lovable-gateway",
      url: "https://ai.gateway.lovable.dev/v1/images/edits",
      key: lovable,
      model: process.env["LOVABLE_IMAGE_MODEL"] ?? "openai/gpt-image-2",
      header: "lovable",
    });
  }

  return out;
}

function buildPrompt(preset: any, extra?: string | null): string {
  const parts = [String(preset.prompt ?? "")];
  if (preset.keep_structure) {
    parts.push(
      "Задължително: запази реалната архитектура, размери и перспектива на помещението — това е снимка за обява на реален имот и не трябва да въвежда купувача в заблуда.",
    );
  }
  parts.push(
    `Сила на обработката: ${Number(preset.strength ?? 60)}/100. Изход: фотореалистичен кадър без текст, лога и водни знаци.`,
  );
  if (extra) parts.push(`Допълнително указание: ${extra}`);
  return parts.join(" ");
}

async function fetchSource(url: string): Promise<{ blob: Blob; bytes: number; type: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Снимката не може да се изтегли (HTTP ${res.status}).`);
  const buf = await res.arrayBuffer();
  const type = res.headers.get("content-type") ?? "image/jpeg";
  if (!type.startsWith("image/")) throw new Error("Адресът не сочи към изображение.");
  return { blob: new Blob([buf], { type }), bytes: buf.byteLength, type };
}

async function runProviderEdit(input: { blob: Blob; type: string; prompt: string; size: string }) {
  const providers = listPhotoProviders();
  if (providers.length === 0) {
    throw new Error(
      "Обработката на снимки не е конфигурирана — задайте OPENAI_API_KEY или AI_GATEWAY_KEY.",
    );
  }

  const ext = input.type.includes("png") ? "png" : input.type.includes("webp") ? "webp" : "jpg";
  let lastError = "";

  for (const p of providers) {
    const form = new FormData();
    form.append("model", p.model);
    form.append("prompt", input.prompt);
    form.append("size", input.size);
    form.append("n", "1");
    form.append("quality", "high");
    form.append("image", input.blob, `source.${ext}`);

    const headers: Record<string, string> = {};
    if (p.header === "lovable") headers["Lovable-API-Key"] = p.key;
    else headers["Authorization"] = `Bearer ${p.key}`;

    const res = await fetch(p.url, { method: "POST", headers, body: form });
    if (!res.ok) {
      lastError = `${p.id}: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`;
      console.warn("[photos]", lastError);
      continue;
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const first = json.data?.[0];
    if (first?.b64_json) return { base64: first.b64_json, provider: p.id, model: p.model };
    if (first?.url) {
      const dl = await fetch(first.url);
      if (dl.ok) {
        const bytes = new Uint8Array(await dl.arrayBuffer());
        let bin = "";
        for (const b of bytes) bin += String.fromCharCode(b);
        return { base64: btoa(bin), provider: p.id, model: p.model };
      }
    }
    lastError = `${p.id}: отговорът не съдържа изображение`;
  }

  throw new Error(`Обработката се провали. ${lastError}`);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ------------------------------------------------------------------
// Качество
// ------------------------------------------------------------------
export function scorePhoto(input: {
  bytes: number;
  sourceBytes: number;
  durationMs: number;
  kind: string;
}) {
  const issues: string[] = [];
  let score = 100;

  if (input.bytes < 60_000) {
    score -= 25;
    issues.push("Резултатът е с нисък размер — възможна загуба на детайл.");
  }
  if (input.sourceBytes > 0 && input.bytes < input.sourceBytes * 0.25) {
    score -= 15;
    issues.push("Резултатът е значително по-малък от оригинала.");
  }
  if (input.durationMs > 120_000) {
    score -= 5;
    issues.push("Обработката отне над 2 минути.");
  }
  if (input.kind === "staging") {
    issues.push(
      "Виртуално обзавеждане — задължително обозначи в обявата, че мебелите са виртуални.",
    );
  }
  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ------------------------------------------------------------------
// Обработка на една снимка
// ------------------------------------------------------------------
export async function processPhoto(input: {
  propertyId: string;
  sourceUrl: string;
  sourceImageId?: string | null;
  presetCode?: string;
  extraPrompt?: string | null;
  actor?: string;
  createdBy?: string | null;
}) {
  const settings = await getPhotoSettings();
  if (!settings.ai_enabled) throw new Error("AI обработката на снимки е изключена в настройките.");

  const preset = await getPreset(input.presetCode ?? settings.default_preset);
  const started = Date.now();

  const { count } = await db()
    .from("photo_assets")
    .select("id", { count: "exact", head: true })
    .eq("property_id", input.propertyId);
  if (Number(count ?? 0) >= settings.max_per_property) {
    throw new Error(
      `Достигнат е лимитът от ${settings.max_per_property} обработени снимки за този имот.`,
    );
  }

  const { data: last } = await db()
    .from("photo_assets")
    .select("version")
    .eq("property_id", input.propertyId)
    .eq("preset_code", preset.code)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = Number(last?.version ?? 0) + 1;

  const source = await fetchSource(input.sourceUrl);
  const prompt = buildPrompt(preset, input.extraPrompt);

  let result: { base64: string; provider: string; model: string };
  try {
    result = await runProviderEdit({
      blob: source.blob,
      type: source.type,
      prompt,
      size: String(preset.size ?? "1536x1024"),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db()
      .from("photo_assets")
      .insert({
        property_id: input.propertyId,
        source_image_id: input.sourceImageId ?? null,
        source_url: input.sourceUrl,
        preset_code: preset.code,
        kind: preset.kind,
        version,
        status: "error",
        error: message.slice(0, 500),
        created_by: input.createdBy ?? null,
      });
    await logPhotoEvent({
      property_id: input.propertyId,
      action: "process",
      status: "error",
      message: message.slice(0, 500),
      actor: input.actor,
    });
    throw e;
  }

  const bytes = base64ToBytes(result.base64);
  const path = `ai/${input.propertyId}/${preset.code}-v${version}-${Date.now()}.png`;
  const { error: upErr } = await db()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: "image/png", upsert: true });
  if (upErr) throw new Error(`Качването в хранилището се провали: ${upErr.message}`);
  const { data: pub } = db().storage.from(BUCKET).getPublicUrl(path);
  const resultUrl = pub?.publicUrl as string;

  const durationMs = Date.now() - started;
  const [w, h] = String(preset.size ?? "1536x1024")
    .split("x")
    .map((n: string) => Number(n) || null);
  const { score, issues } = scorePhoto({
    bytes: bytes.byteLength,
    sourceBytes: source.bytes,
    durationMs,
    kind: preset.kind,
  });
  const autoApproved = score >= settings.auto_approve_min_score;

  const row = {
    property_id: input.propertyId,
    source_image_id: input.sourceImageId ?? null,
    source_url: input.sourceUrl,
    preset_code: preset.code,
    kind: preset.kind,
    version,
    result_url: resultUrl,
    storage_path: path,
    width: w,
    height: h,
    bytes: bytes.byteLength,
    status: autoApproved ? "approved" : "ready",
    approved_at: autoApproved ? new Date().toISOString() : null,
    quality_score: score,
    issues,
    ai_used: true,
    provider: result.provider,
    model: result.model,
    duration_ms: durationMs,
    error: null,
    created_by: input.createdBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await db()
    .from("photo_assets")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await logPhotoEvent({
    property_id: input.propertyId,
    asset_id: saved?.id ?? null,
    action: "process",
    status: "ok",
    message: `${preset.name} · ${score}/100 · ${Math.round(durationMs / 1000)}с`,
    meta: { preset: preset.code, provider: result.provider, bytes: bytes.byteLength },
    actor: input.actor,
  });

  if (autoApproved && settings.auto_apply_approved && saved?.id) {
    try {
      await applyPhoto({ assetId: saved.id, actor: input.actor });
    } catch {
      /* прилагането не бива да проваля обработката */
    }
  }

  return saved;
}

// ------------------------------------------------------------------
// Статус / прилагане в галерията
// ------------------------------------------------------------------
export async function setPhotoStatus(input: {
  assetId: string;
  status: "ready" | "approved" | "rejected";
  actor?: string;
  userId?: string | null;
}) {
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (input.status === "approved") {
    patch.approved_at = new Date().toISOString();
    patch.approved_by = input.userId ?? null;
  }
  const { data, error } = await db()
    .from("photo_assets")
    .update(patch)
    .eq("id", input.assetId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await logPhotoEvent({
    property_id: data?.property_id,
    asset_id: input.assetId,
    action: `status:${input.status}`,
    actor: input.actor,
  });
  return data;
}

/** Добавя обработената снимка в галерията на имота (и по избор като корица). */
export async function applyPhoto(input: { assetId: string; asCover?: boolean; actor?: string }) {
  const { data: asset, error } = await db()
    .from("photo_assets")
    .select("*")
    .eq("id", input.assetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!asset) throw new Error("Обработената снимка не е намерена.");
  if (!asset.result_url) throw new Error("Липсва резултат за прилагане.");

  const { count } = await db()
    .from("property_images")
    .select("id", { count: "exact", head: true })
    .eq("property_id", asset.property_id);

  const { error: insErr } = await db()
    .from("property_images")
    .insert({
      property_id: asset.property_id,
      url: asset.result_url,
      is_cover: Boolean(input.asCover),
      display_order: Number(count ?? 0) + 1,
    });
  if (insErr) throw new Error(insErr.message);

  if (input.asCover) {
    await db()
      .from("properties")
      .update({ cover_image_url: asset.result_url })
      .eq("id", asset.property_id);
  }

  const { data: updated } = await db()
    .from("photo_assets")
    .update({
      status: "published",
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.assetId)
    .select("*")
    .maybeSingle();

  await logPhotoEvent({
    property_id: asset.property_id,
    asset_id: input.assetId,
    action: input.asCover ? "apply:cover" : "apply",
    message: "Снимката е добавена в галерията",
    actor: input.actor,
  });
  return updated;
}

export async function deletePhotoAsset(input: { assetId: string; actor?: string }) {
  const { data: asset } = await db()
    .from("photo_assets")
    .select("id, property_id, storage_path")
    .eq("id", input.assetId)
    .maybeSingle();
  if (asset?.storage_path) {
    await db().storage.from(BUCKET).remove([asset.storage_path]);
  }
  const { error } = await db().from("photo_assets").delete().eq("id", input.assetId);
  if (error) throw new Error(error.message);
  await logPhotoEvent({
    property_id: asset?.property_id ?? null,
    action: "delete",
    message: "Обработената снимка е изтрита",
    actor: input.actor,
  });
  return { ok: true };
}

// ------------------------------------------------------------------
// Опашка
// ------------------------------------------------------------------
export async function queuePhotos(input: {
  items: Array<{ propertyId: string; sourceUrl: string; sourceImageId?: string | null }>;
  presetCode?: string;
  requestedBy?: string | null;
}) {
  const settings = await getPhotoSettings();
  const preset = input.presetCode ?? settings.default_preset;
  const rows = input.items.map((i) => ({
    property_id: i.propertyId,
    source_image_id: i.sourceImageId ?? null,
    source_url: i.sourceUrl,
    preset_code: preset,
    status: "queued",
    requested_by: input.requestedBy ?? null,
  }));
  if (rows.length === 0) return { queued: 0 };
  const { error } = await db()
    .from("photo_queue")
    .upsert(rows, { onConflict: "source_url,preset_code", ignoreDuplicates: true });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
  await logPhotoEvent({
    action: "queue",
    message: `Добавени ${rows.length} снимки за обработка (${preset})`,
    actor: "crm",
  });
  return { queued: rows.length };
}

/** Автоматично добавя необработени снимки на публикувани имоти. */
export async function autoQueueMissing(limit = 10) {
  const settings = await getPhotoSettings();
  const { data: images } = await db()
    .from("property_images")
    .select("id, url, property_id, properties:property_id(is_published)")
    .order("created_at", { ascending: false })
    .limit(300);
  const { data: done } = await db().from("photo_assets").select("source_url");
  const processed = new Set((done ?? []).map((d: any) => d.source_url));

  const items = (images ?? [])
    .filter(
      (i: any) =>
        i.properties?.is_published !== false &&
        !processed.has(i.url) &&
        !String(i.url).includes("/ai/"),
    )
    .slice(0, limit)
    .map((i: any) => ({ propertyId: i.property_id, sourceUrl: i.url, sourceImageId: i.id }));

  if (items.length === 0) return { queued: 0 };
  return queuePhotos({ items, presetCode: settings.default_preset });
}

export async function runPhotoQueue(limitOverride?: number) {
  const settings = await getPhotoSettings();
  const job = await getPhotoJobState();
  if (!settings.enabled) return { skipped: "disabled" as const, processed: 0, done: 0, errors: 0 };
  if (job.paused)
    return {
      skipped: "paused" as const,
      reason: job.paused_reason,
      processed: 0,
      done: 0,
      errors: 0,
    };
  if (!(await claimJob(settings.lease_seconds)))
    return { skipped: "locked" as const, processed: 0, done: 0, errors: 0 };

  const limit = Math.min(Math.max(limitOverride ?? settings.batch_size, 1), 10);
  let processed = 0;
  let done = 0;
  let errors = 0;

  try {
    if (settings.auto_queue_new) {
      try {
        await autoQueueMissing(limit);
      } catch {
        /* опашката ще се напълни при следващия цикъл */
      }
    }

    const { data: items } = await db()
      .from("photo_queue")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(limit);

    for (const item of items ?? []) {
      processed += 1;
      try {
        await processPhoto({
          propertyId: item.property_id,
          sourceUrl: item.source_url,
          sourceImageId: item.source_image_id,
          presetCode: item.preset_code,
          actor: "cron",
        });
        done += 1;
        await db()
          .from("photo_queue")
          .update({
            status: "done",
            processed_at: new Date().toISOString(),
            attempts: Number(item.attempts ?? 0) + 1,
            error: null,
          })
          .eq("id", item.id);
      } catch (e) {
        errors += 1;
        const message = e instanceof Error ? e.message : String(e);
        const attempts = Number(item.attempts ?? 0) + 1;
        await db()
          .from("photo_queue")
          .update({
            status: attempts >= settings.retry_limit ? "error" : "queued",
            attempts,
            error: message.slice(0, 500),
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        if (/402|403/.test(message)) {
          await pausePhotoJob(`AI е блокиран: ${message.slice(0, 200)}`);
          break;
        }
      }
    }
  } finally {
    await releaseJob({ processed, done, errors, at: new Date().toISOString() });
  }

  return { processed, done, errors };
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------
export async function getPhotoAnalytics() {
  const [{ data: assets }, { data: queue }, { data: images }, { data: events }] = await Promise.all(
    [
      db()
        .from("photo_assets")
        .select(
          "id, created_at, status, kind, preset_code, quality_score, duration_ms, bytes, ai_used, provider",
        ),
      db().from("photo_queue").select("status"),
      db().from("property_images").select("id, url, property_id"),
      db()
        .from("photo_events")
        .select("action, status, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ],
  );

  const rows = assets ?? [];
  const byStatus: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    if (r.provider) byProvider[r.provider] = (byProvider[r.provider] ?? 0) + 1;
  }
  const ok = rows.filter((r: any) => r.status !== "error");
  const avg = (key: "quality_score" | "duration_ms" | "bytes") =>
    ok.length
      ? Math.round(ok.reduce((s: number, r: any) => s + Number(r[key] ?? 0), 0) / ok.length)
      : 0;

  const queueRows = queue ?? [];
  const queueByStatus: Record<string, number> = {};
  for (const q of queueRows) queueByStatus[q.status] = (queueByStatus[q.status] ?? 0) + 1;

  const imageRows = (images ?? []).filter((i: any) => !String(i.url).includes("/ai/"));
  const processedUrls = new Set(rows.map((r: any) => r.source_url));
  const covered = imageRows.filter((i: any) => processedUrls.has(i.url)).length;

  const last30 = rows.filter(
    (r: any) => Date.now() - new Date(r.created_at).getTime() < 30 * 864e5,
  );
  const trend: Record<string, number> = {};
  for (const r of last30) {
    const day = new Date(r.created_at).toISOString().slice(0, 10);
    trend[day] = (trend[day] ?? 0) + 1;
  }

  return {
    total: rows.length,
    ready: byStatus["ready"] ?? 0,
    approved: byStatus["approved"] ?? 0,
    published: byStatus["published"] ?? 0,
    failed: byStatus["error"] ?? 0,
    avg_quality: avg("quality_score"),
    avg_duration_ms: avg("duration_ms"),
    avg_bytes: avg("bytes"),
    by_status: byStatus,
    by_kind: byKind,
    by_provider: byProvider,
    queue: queueByStatus,
    images_total: imageRows.length,
    images_processed: covered,
    coverage: imageRows.length ? Math.round((covered / imageRows.length) * 100) : 0,
    trend: Object.entries(trend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count })),
    recent_errors: (events ?? []).filter((e: any) => e.status === "error").length,
    providers_configured: listPhotoProviders().map((p) => p.id),
  };
}
