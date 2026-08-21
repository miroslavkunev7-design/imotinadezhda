import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertCrmAccess } from "@/lib/auth/crm-access";
import { resolveServerDb, type ServerDb } from "@/lib/supabase-server-db";

export const PHOTO_JOB_TYPES = ["enhance", "hdr", "staging"] as const;
export type PhotoJobType = (typeof PHOTO_JOB_TYPES)[number];
export const STAGING_STYLES = ["living", "empty"] as const;
export type StagingStyle = (typeof STAGING_STYLES)[number];

const JOB_LABELS: Record<PhotoJobType, string> = {
  enhance: "Подобри",
  hdr: "HDR",
  staging: "Виртуално обзавеждане",
};

function authEmail(claims: unknown): string | null {
  return (claims as { email?: string } | undefined)?.email ?? null;
}

async function gate(ctx: { userId: string; supabase: ServerDb; claims: unknown }) {
  await assertCrmAccess(ctx.userId, ctx.supabase, authEmail(ctx.claims));
  return resolveServerDb(ctx.supabase) as ServerDb & { from: (t: string) => any };
}

function imageKeysReady() {
  const openai = Boolean(process.env["OPENAI_API_KEY"]?.trim());
  const gateway = Boolean(
    (process.env["AI_GATEWAY_KEY"] ?? process.env["VERCEL_AI_GATEWAY_KEY"] ?? process.env["AI_GATEWAY_API_KEY"])?.trim(),
  );
  const gemini = Boolean((process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_GENERATIVE_AI_API_KEY"])?.trim());
  const lovable = Boolean(process.env["LOVABLE_API_KEY"]?.trim());
  return { openai, gateway, gemini, lovable, any: openai || gateway || gemini || lovable };
}

const KEYS_MISSING_BG =
  "Липсват ключове за обработка на снимки. Задайте OPENAI_API_KEY, AI_GATEWAY_KEY или GEMINI_API_KEY в .env и рестартирайте локалния сървър.";

function promptFor(type: PhotoJobType, style?: StagingStyle | null) {
  if (type === "enhance") {
    return "Professionally enhance this real estate listing photo. Improve lighting, white balance, sharpness and clarity. Keep the exact same room, furniture, architecture and camera angle. Do not add, remove or restage objects. Photorealistic, natural colors.";
  }
  if (type === "hdr") {
    return "Apply a photorealistic HDR-style improvement to this real estate photo: recover shadows and highlights, even natural lighting, richer but realistic colors. Keep the exact same scene, furniture and architecture. Do not add or remove objects.";
  }
  if (style === "empty") {
    return "Virtually stage this empty or sparse room as a furnished residential interior. Keep the exact architecture, windows, walls, floors and camera angle. Add tasteful modern European furniture appropriate to the room. Photorealistic, bright, clean. Do not change room structure.";
  }
  return "Virtually stage this real estate photo as a furnished contemporary living room. Keep the exact room architecture, windows, walls, floors and camera angle. Add a modern European sofa, coffee table, rug, warm lighting and plants. Photorealistic luxury listing photo, not cartoon.";
}

type SourceBytes = { bytes: Uint8Array; mime: string };

function parseDataUrl(dataUrl: string): SourceBytes | null {
  const m = dataUrl.trim().match(/^data:([^;]+);base64,(.+)$/i);
  if (!m) return null;
  try {
    const bytes = Uint8Array.from(Buffer.from(m[2], "base64"));
    if (!bytes.length) return null;
    return { bytes, mime: m[1] || "image/jpeg" };
  } catch {
    return null;
  }
}

async function loadSource(sourceUrl: string): Promise<SourceBytes> {
  const data = parseDataUrl(sourceUrl);
  if (data) return data;

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Оригиналната снимка не може да се прочете (HTTP ${res.status}).`);
  }
  const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim() || "image/jpeg";
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.length) throw new Error("Оригиналната снимка е празна.");
  if (buf.length > 8 * 1024 * 1024) throw new Error("Снимката е над 8 MB — намалете размера и опитайте пак.");
  return { bytes: buf, mime };
}

type EditOk = { image: Uint8Array; mime: string; provider: string };

function extFromMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

async function tryOpenAiEdits(
  id: string,
  url: string,
  key: string,
  header: "bearer" | "lovable",
  model: string,
  source: SourceBytes,
  prompt: string,
): Promise<EditOk | string> {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("n", "1");
  const blob = new Blob([Buffer.from(source.bytes)], { type: source.mime || "image/jpeg" });
  form.append("image", blob, `source.${extFromMime(source.mime)}`);

  const headers: Record<string, string> = {};
  if (header === "lovable") headers["Lovable-API-Key"] = key;
  else headers["Authorization"] = `Bearer ${key}`;

  const res = await fetch(url, { method: "POST", headers, body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return `${id}: HTTP ${res.status} ${text}`.slice(0, 500);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = json.data?.[0];
  if (first?.b64_json) {
    return { image: Uint8Array.from(Buffer.from(first.b64_json, "base64")), mime: "image/png", provider: id };
  }
  if (first?.url) {
    const imgRes = await fetch(first.url);
    if (!imgRes.ok) return `${id}: резултатът не се свали (HTTP ${imgRes.status})`;
    const mime = (imgRes.headers.get("content-type") ?? "image/png").split(";")[0];
    return { image: new Uint8Array(await imgRes.arrayBuffer()), mime, provider: id };
  }
  return `${id}: отговорът не съдържа изображение`;
}

async function tryGeminiEdit(source: SourceBytes, prompt: string): Promise<EditOk | string> {
  const key = (process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_GENERATIVE_AI_API_KEY"] ?? "").trim();
  if (!key) return "gemini: няма ключ";

  const models = [
    process.env["GEMINI_IMAGE_MODEL"]?.trim(),
    "gemini-2.5-flash-image",
    "gemini-2.0-flash-preview-image-generation",
  ].filter(Boolean) as string[];

  let last = "gemini: няма отговор";
  const b64 = Buffer.from(source.bytes).toString("base64");

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: source.mime || "image/jpeg", data: b64 } },
            ],
          },
        ],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });
    if (!res.ok) {
      last = `gemini/${model}: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 280)}`;
      continue;
    }
    const json = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }> };
      }>;
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData ?? part.inline_data;
      if (inline?.data) {
        return {
          image: Uint8Array.from(Buffer.from(inline.data, "base64")),
          mime: inline.mimeType ?? inline.mime_type ?? "image/png",
          provider: `gemini/${model}`,
        };
      }
    }
    last = `gemini/${model}: няма изображение в отговора`;
  }
  return last;
}

async function tryTextOnlyGenerate(prompt: string): Promise<EditOk | string> {
  type ImageProvider = { id: string; url: string; key: string; model: string; header: "bearer" | "lovable" };
  const out: ImageProvider[] = [];
  const openai = process.env["OPENAI_API_KEY"];
  if (openai) {
    out.push({
      id: "openai-gen",
      url: "https://api.openai.com/v1/images/generations",
      key: openai,
      model: process.env["OPENAI_IMAGE_MODEL"] ?? "gpt-image-1",
      header: "bearer",
    });
  }
  const gatewayKey =
    process.env["AI_GATEWAY_KEY"] ?? process.env["VERCEL_AI_GATEWAY_KEY"] ?? process.env["AI_GATEWAY_API_KEY"];
  if (gatewayKey) {
    out.push({
      id: "vercel-gateway-gen",
      url: process.env["AI_GATEWAY_IMAGE_URL"] ?? "https://ai-gateway.vercel.sh/v1/images/generations",
      key: gatewayKey,
      model: process.env["AI_GATEWAY_IMAGE_MODEL"] ?? "openai/gpt-image-1",
      header: "bearer",
    });
  }
  const lovable = process.env["LOVABLE_API_KEY"];
  if (lovable) {
    out.push({
      id: "lovable-gateway-gen",
      url: "https://ai.gateway.lovable.dev/v1/images/generations",
      key: lovable,
      model: process.env["LOVABLE_IMAGE_MODEL"] ?? "openai/gpt-image-2",
      header: "lovable",
    });
  }

  let last = "няма доставчик за генериране";
  for (const p of out) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (p.header === "lovable") headers["Lovable-API-Key"] = p.key;
    else headers["Authorization"] = `Bearer ${p.key}`;
    const res = await fetch(p.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: p.model, prompt, size: "1024x1024", n: 1, quality: "low" }),
    });
    if (!res.ok) {
      last = `${p.id}: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 280)}`;
      continue;
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const first = json.data?.[0];
    if (first?.b64_json) {
      return { image: Uint8Array.from(Buffer.from(first.b64_json, "base64")), mime: "image/png", provider: p.id };
    }
    if (first?.url) {
      const imgRes = await fetch(first.url);
      if (!imgRes.ok) {
        last = `${p.id}: резултатът не се свали`;
        continue;
      }
      return {
        image: new Uint8Array(await imgRes.arrayBuffer()),
        mime: (imgRes.headers.get("content-type") ?? "image/png").split(";")[0],
        provider: p.id,
      };
    }
    last = `${p.id}: празен отговор`;
  }
  return last;
}

async function runImageEdit(source: SourceBytes, prompt: string): Promise<EditOk> {
  const errors: string[] = [];

  const openai = process.env["OPENAI_API_KEY"]?.trim();
  if (openai) {
    const r = await tryOpenAiEdits(
      "openai-edits",
      "https://api.openai.com/v1/images/edits",
      openai,
      "bearer",
      process.env["OPENAI_IMAGE_MODEL"] ?? "gpt-image-1",
      source,
      prompt,
    );
    if (typeof r !== "string") return r;
    errors.push(r);
  }

  const gateway =
    process.env["AI_GATEWAY_KEY"] ?? process.env["VERCEL_AI_GATEWAY_KEY"] ?? process.env["AI_GATEWAY_API_KEY"];
  if (gateway?.trim()) {
    const r = await tryOpenAiEdits(
      "vercel-gateway-edits",
      process.env["AI_GATEWAY_IMAGE_EDIT_URL"] ?? "https://ai-gateway.vercel.sh/v1/images/edits",
      gateway.trim(),
      "bearer",
      process.env["AI_GATEWAY_IMAGE_MODEL"] ?? "openai/gpt-image-1",
      source,
      prompt,
    );
    if (typeof r !== "string") return r;
    errors.push(r);
  }

  const gemini = await tryGeminiEdit(source, prompt);
  if (typeof gemini !== "string") return gemini;
  errors.push(gemini);

  const gen = await tryTextOnlyGenerate(
    `${prompt} Based on a typical Bulgarian residential interior listing photograph.`,
  );
  if (typeof gen !== "string") return gen;
  errors.push(gen);

  throw new Error(`Обработката се провали. ${errors.filter(Boolean).join(" · ").slice(0, 700)}`);
}

function sofiaDayStartIso() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}T00:00:00+03:00`;
}

export const listPhotoDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await gate(context);
    const since = sofiaDayStartIso();
    const [{ data: properties, error: pErr }, { data: jobs, error: jErr }, { data: todayRows }, { data: mixRows }] =
      await Promise.all([
        db
          .from("properties")
          .select("id, title, price, currency, cover_image_url, cities:city_id(name)")
          .order("updated_at", { ascending: false })
          .limit(200),
        db.from("photo_jobs").select("*").order("created_at", { ascending: false }).limit(40),
        db.from("photo_jobs").select("id, status").gte("created_at", since),
        db.from("photo_jobs").select("id, job_type, status").gte("created_at", since),
      ]);

    if (pErr) throw new Error(pErr.message);
    if (jErr) throw new Error(jErr.message);

    const today = todayRows ?? [];
    const done = today.filter((r: { status: string }) => r.status === "done").length;
    const failed = today.filter((r: { status: string }) => r.status === "error").length;
    const finished = done + failed;
    const mix = { enhance: 0, hdr: 0, staging: 0 };
    for (const r of mixRows ?? []) {
      if (r.job_type === "enhance" || r.job_type === "hdr" || r.job_type === "staging") mix[r.job_type] += 1;
    }

    const keys = imageKeysReady();
    return {
      properties: properties ?? [],
      jobs: jobs ?? [],
      stats: {
        jobsToday: today.length,
        successRate: finished ? Math.round((done / finished) * 100) : null,
        mix,
      },
      aiReady: keys.any,
      aiHint: keys.any ? null : KEYS_MISSING_BG,
      labels: JOB_LABELS,
    };
  });

export const listPropertyPhotoSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ property_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    const { data: rows, error } = await db
      .from("property_images")
      .select("id, url, is_cover, display_order")
      .eq("property_id", data.property_id)
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { images: rows ?? [] };
  });

const processSchema = z.object({
  property_id: z.string().uuid().nullable().optional(),
  source_url: z.string().min(8).max(2_000_000),
  job_type: z.enum(PHOTO_JOB_TYPES),
  staging_style: z.enum(STAGING_STYLES).nullable().optional(),
});

export const processPhotoJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => processSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    if (!imageKeysReady().any) {
      throw new Error(KEYS_MISSING_BG);
    }

    const prompt = promptFor(data.job_type, data.staging_style);
    const insert = await db
      .from("photo_jobs")
      .insert({
        created_by: context.userId,
        property_id: data.property_id ?? null,
        job_type: data.job_type,
        staging_style: data.job_type === "staging" ? (data.staging_style ?? "living") : null,
        status: "processing",
        source_url: data.source_url.startsWith("data:") ? null : data.source_url,
        prompt,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insert.error || !insert.data?.id) {
      throw new Error(insert.error?.message ?? "Не мога да създам задачата.");
    }
    const jobId = insert.data.id as string;

    try {
      const source = await loadSource(data.source_url);
      const result = await runImageEdit(source, prompt);
      const ext = extFromMime(result.mime);
      const path = `photo-jobs/${jobId}/result.${ext}`;
      const up = await db.storage.from("property-images").upload(path, Buffer.from(result.image), {
        contentType: result.mime || "image/png",
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);
      const { data: pub } = db.storage.from("property-images").getPublicUrl(path);
      const resultUrl = pub.publicUrl;
      const { error: updErr } = await db
        .from("photo_jobs")
        .update({
          status: "done",
          result_url: resultUrl,
          result_storage_path: path,
          provider: result.provider,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      if (updErr) throw new Error(updErr.message);
      return { id: jobId, result_url: resultUrl, provider: result.provider, status: "done" as const };
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "Неизвестна грешка").slice(0, 700);
      await db
        .from("photo_jobs")
        .update({ status: "error", error_message: msg, updated_at: new Date().toISOString() })
        .eq("id", jobId);
      throw new Error(msg);
    }
  });

export const attachPhotoResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ job_id: z.string().uuid(), property_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await gate(context);
    const { data: job, error } = await db.from("photo_jobs").select("*").eq("id", data.job_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Задачата не е намерена.");
    if (job.status !== "done" || !job.result_url) throw new Error("Няма готов резултат за прикачване.");
    const propertyId = data.property_id ?? job.property_id;
    if (!propertyId) throw new Error("Изберете имот, към който да се прикачи снимката.");

    const { data: existing } = await db
      .from("property_images")
      .select("display_order")
      .eq("property_id", propertyId)
      .order("display_order", { ascending: false })
      .limit(1);
    const nextOrder = (existing?.[0]?.display_order ?? 0) + 1;

    const ins = await db
      .from("property_images")
      .insert({
        property_id: propertyId,
        url: job.result_url,
        is_cover: false,
        display_order: nextOrder,
      })
      .select("id")
      .single();
    if (ins.error || !ins.data?.id) throw new Error(ins.error?.message ?? "Не мога да прикача снимката.");

    await db
      .from("photo_jobs")
      .update({
        attached_image_id: ins.data.id,
        property_id: propertyId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.job_id);

    return { image_id: ins.data.id as string, url: job.result_url as string };
  });
