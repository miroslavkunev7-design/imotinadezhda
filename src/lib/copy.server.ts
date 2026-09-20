// Автоматизация №11 — AI Описание на Имот: обяви, портални текстове, социални постове, SEO мета.
// Без зависимост от Lovable: Supabase + конфигуриран AI провайдър (OpenAI / Gemini / Gateway).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions } from "@/lib/ai-provider";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

const JOB_KEY = "property_copy";
const SETTINGS_KEY = "property_copy";

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type CopySettings = {
  enabled: boolean;
  ai_enabled: boolean;
  batch_size: number;
  lease_seconds: number;
  auto_queue_new: boolean;
  auto_apply_approved: boolean;
  auto_approve_min_score: number;
  default_template: string;
  min_words: number;
  max_words: number;
  retry_limit: number;
};

export const DEFAULT_COPY: CopySettings = {
  enabled: true,
  ai_enabled: true,
  batch_size: 5,
  lease_seconds: 300,
  auto_queue_new: true,
  auto_apply_approved: true,
  auto_approve_min_score: 85,
  default_template: "site_premium",
  min_words: 90,
  max_words: 320,
  retry_limit: 3,
};

export async function getCopySettings(): Promise<CopySettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return { ...DEFAULT_COPY, ...((data?.value ?? {}) as Partial<CopySettings>) };
}

export async function saveCopySettings(patch: Partial<CopySettings>): Promise<CopySettings> {
  const next = { ...(await getCopySettings()), ...patch };
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
export async function getCopyJobState() {
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

export async function pauseCopyJob(reason: string) {
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

export async function resumeCopyJob() {
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
  return getCopyJobState();
}

// ------------------------------------------------------------------
// Помощни
// ------------------------------------------------------------------
const PROPERTY_SELECT =
  "id, title, description, price, currency, property_type, status, rooms, bedrooms, bathrooms, area_sqm, built_up_area_sqm, yard_sqm, floor, total_floors, year_built, construction_type, heating, address, amenities, has_garage, parking_spaces, cover_image_url, is_published, updated_at, cities:city_id(name), quarters:quarter_id(name)";

const TYPE_LABEL: Record<string, string> = {
  apartment: "апартамент",
  house: "къща",
  villa: "вила",
  land: "парцел",
  office: "офис",
  shop: "магазин",
  industrial: "индустриален имот",
  garage: "гараж",
  hotel: "хотел",
  farm: "земеделска земя",
};

export async function logCopyEvent(entry: {
  property_id?: string | null;
  copy_id?: string | null;
  action: string;
  status?: string;
  message?: string | null;
  meta?: Record<string, unknown> | null;
  actor?: string;
}) {
  await db()
    .from("copy_events")
    .insert({
      property_id: entry.property_id ?? null,
      copy_id: entry.copy_id ?? null,
      action: entry.action,
      status: entry.status ?? "ok",
      message: entry.message ?? null,
      meta: entry.meta ?? null,
      actor: entry.actor ?? "automation",
    });
}

export function slugify(input: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sht",
    ъ: "a",
    ь: "",
    ю: "yu",
    я: "ya",
  };
  return input
    .toLowerCase()
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

const words = (s?: string | null) =>
  String(s ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

export type PropertyFacts = {
  id: string;
  title: string;
  typeLabel: string;
  city: string | null;
  quarter: string | null;
  price: string;
  lines: string[];
  amenities: string[];
};

export function buildFacts(p: any): PropertyFacts {
  const city = p?.cities?.name ?? null;
  const quarter = p?.quarters?.name ?? null;
  const typeLabel = TYPE_LABEL[p?.property_type] ?? String(p?.property_type ?? "имот");
  const lines: string[] = [];
  const push = (label: string, v: unknown, suffix = "") => {
    if (v === null || v === undefined || v === "") return;
    lines.push(`${label}: ${v}${suffix}`);
  };
  push("Тип", typeLabel);
  push("Град", city);
  push("Квартал", quarter);
  push("Адрес", p?.address);
  push("Стаи", p?.rooms);
  push("Спални", p?.bedrooms);
  push("Бани", p?.bathrooms);
  push("Площ", p?.area_sqm, " кв.м");
  push("РЗП", p?.built_up_area_sqm, " кв.м");
  push("Двор", p?.yard_sqm, " кв.м");
  push(
    "Етаж",
    p?.floor != null && p?.total_floors != null ? `${p.floor} от ${p.total_floors}` : p?.floor,
  );
  push("Година на строеж", p?.year_built);
  push("Конструкция", p?.construction_type);
  push("Отопление", p?.heating);
  if (p?.has_garage) lines.push("Гараж: да");
  push("Паркоместа", p?.parking_spaces);
  const amenities: string[] = Array.isArray(p?.amenities) ? p.amenities.filter(Boolean) : [];
  if (amenities.length) lines.push(`Екстри: ${amenities.join(", ")}`);
  const price =
    p?.price != null
      ? `${Number(p.price).toLocaleString("bg-BG", { maximumFractionDigits: 0 })} ${p.currency ?? "EUR"}`
      : "по договаряне";
  return {
    id: p.id,
    title: p?.title ?? typeLabel,
    typeLabel,
    city,
    quarter,
    price,
    lines,
    amenities,
  };
}

// ------------------------------------------------------------------
// Оценка на качество и SEO
// ------------------------------------------------------------------
export type CopyDraft = {
  title: string;
  body: string;
  short_text: string;
  bullets: string[];
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  hashtags: string[];
};

const CLICHES = ["уникален шанс", "не пропускайте", "мечтан дом", "цена под пазарната", "спешно"];

export function scoreCopy(
  draft: CopyDraft,
  facts: PropertyFacts,
  settings: CopySettings,
  template: any,
) {
  const issues: string[] = [];
  let quality = 100;
  let seo = 100;

  const bodyWords = words(draft.body);
  if (bodyWords < settings.min_words) {
    quality -= 20;
    issues.push(`Описанието е кратко (${bodyWords} думи, минимум ${settings.min_words}).`);
  }
  if (bodyWords > settings.max_words) {
    quality -= 10;
    issues.push(`Описанието е дълго (${bodyWords} думи, максимум ${settings.max_words}).`);
  }
  if (draft.title.length > (template?.max_title ?? 70)) {
    quality -= 10;
    issues.push(`Заглавието надвишава ${template?.max_title ?? 70} знака.`);
  }
  if (draft.bullets.length < 3) {
    quality -= 10;
    issues.push("Липсват поне 3 акцента (bullets).");
  }
  const lowerBody = draft.body.toLowerCase();
  const found = CLICHES.filter((c) => lowerBody.includes(c));
  if (found.length) {
    quality -= 8 * found.length;
    issues.push(`Клишета в текста: ${found.join(", ")}.`);
  }
  if (/[A-ZА-Я]{5,}/.test(draft.body)) {
    quality -= 5;
    issues.push("Има думи изцяло с главни букви.");
  }

  if (!draft.seo_title) {
    seo -= 30;
    issues.push("Липсва SEO заглавие.");
  } else if (draft.seo_title.length > 60) {
    seo -= 12;
    issues.push(`SEO заглавието е ${draft.seo_title.length} знака (макс. 60).`);
  }
  const sd = draft.seo_description?.length ?? 0;
  if (!sd) {
    seo -= 30;
    issues.push("Липсва SEO описание.");
  } else if (sd < 120 || sd > 165) {
    seo -= 12;
    issues.push(`SEO описанието е ${sd} знака (оптимално 140–160).`);
  }
  if (draft.seo_keywords.length < 5) {
    seo -= 12;
    issues.push("По-малко от 5 ключови думи.");
  }
  if (
    facts.city &&
    !`${draft.seo_title} ${draft.seo_description}`.toLowerCase().includes(facts.city.toLowerCase())
  ) {
    seo -= 15;
    issues.push("Градът не се среща в SEO мета данните.");
  }
  if (!lowerBody.includes(facts.typeLabel.toLowerCase())) {
    seo -= 10;
    issues.push("Типът имот не се среща в описанието.");
  }

  return {
    quality_score: Math.max(0, Math.min(100, Math.round(quality))),
    seo_score: Math.max(0, Math.min(100, Math.round(seo))),
    issues,
    word_count: bodyWords,
  };
}

// ------------------------------------------------------------------
// Генериране — резервен вариант без AI
// ------------------------------------------------------------------
function fallbackDraft(facts: PropertyFacts, template: any): CopyDraft {
  const place = [facts.quarter, facts.city].filter(Boolean).join(", ");
  const title =
    `${facts.typeLabel[0].toUpperCase()}${facts.typeLabel.slice(1)}${place ? ` в ${place}` : ""}`.slice(
      0,
      template?.max_title ?? 70,
    );
  const bullets = facts.lines.slice(0, 6);
  const body = [
    `${title}${facts.price ? ` — ${facts.price}` : ""}.`,
    facts.lines.join(" • ") + ".",
    facts.amenities.length ? `Екстри: ${facts.amenities.join(", ")}.` : "",
    "Свържете се с „Имоти Надежда“ за оглед и пълна информация по документите.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const seoTitle = `${title} | Имоти Надежда`.slice(0, 60);
  const seoDescription =
    `${title}. ${facts.lines.slice(0, 3).join(", ")}. Цена ${facts.price}. Огледи и съдействие от Имоти Надежда.`.slice(
      0,
      160,
    );
  return {
    title,
    body,
    short_text: `${title} — ${facts.price}.`,
    bullets,
    seo_title: seoTitle,
    seo_description: seoDescription,
    seo_keywords: [
      facts.typeLabel,
      facts.city,
      facts.quarter,
      `${facts.typeLabel} ${facts.city ?? ""}`.trim(),
      "имоти",
      "Имоти Надежда",
    ]
      .filter((x): x is string => Boolean(x))
      .slice(0, 8),
    hashtags: [
      facts.city ? `#${slugify(facts.city)}` : "#bulgaria",
      "#imoti",
      "#imotinadezhda",
    ].filter(Boolean),
  };
}

function safeJson(text: string): any | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function aiDraft(
  facts: PropertyFacts,
  template: any,
  settings: CopySettings,
): Promise<CopyDraft | null> {
  const prompt = [
    `Имот: ${facts.title}`,
    `Цена: ${facts.price}`,
    ...facts.lines,
    "",
    `Канал: ${template.channel}. Тон: ${template.tone}.`,
    `Инструкции: ${template.instructions ?? ""}`,
    `Заглавие до ${template.max_title} знака. Описание между ${settings.min_words} и ${settings.max_words} думи.`,
    template.include_price ? "Включи цената в текста." : "Не споменавай цена.",
    template.emoji_allowed ? "Допустими са малко емоджита." : "Без емоджита.",
    "",
    "Върни само JSON със полета: title, body, short_text, bullets (масив от 4-6 кратки акцента), seo_title (до 60 знака), seo_description (140-160 знака), seo_keywords (6-10 български ключови думи), hashtags (до 5).",
  ].join("\n");

  const res = await aiChatCompletions({
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content:
          "Ти си копирайтър на българска агенция за недвижими имоти „Имоти Надежда“. Пишеш на български език, конкретно, без клишета и без измислени факти. Използваш само подадените данни. Отговаряш само с валиден JSON.",
      },
      { role: "user", content: prompt },
    ],
  });

  if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content ?? "";
  const parsed = safeJson(String(content));
  if (!parsed) return null;

  const arr = (v: unknown, max: number) =>
    (Array.isArray(v) ? v : String(v ?? "").split(/[,\n]/))
      .map((x) => String(x).trim())
      .filter(Boolean)
      .slice(0, max);

  return {
    title: String(parsed.title ?? "")
      .trim()
      .slice(0, template.max_title),
    body: String(parsed.body ?? "").trim(),
    short_text: String(parsed.short_text ?? "").trim(),
    bullets: arr(parsed.bullets, 6),
    seo_title: String(parsed.seo_title ?? "")
      .trim()
      .slice(0, 70),
    seo_description: String(parsed.seo_description ?? "")
      .trim()
      .slice(0, 200),
    seo_keywords: arr(parsed.seo_keywords, 10),
    hashtags: arr(parsed.hashtags, 5).map((h) => (h.startsWith("#") ? h : `#${h}`)),
  };
}

// ------------------------------------------------------------------
// Основно генериране
// ------------------------------------------------------------------
export async function getTemplates() {
  const { data, error } = await db()
    .from("copy_templates")
    .select("*")
    .order("channel")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getTemplate(code: string) {
  const { data } = await db().from("copy_templates").select("*").eq("code", code).maybeSingle();
  return (
    data ?? {
      code,
      name: code,
      channel: "site",
      tone: "premium",
      max_title: 70,
      max_body: 1600,
      instructions: null,
      include_price: true,
      emoji_allowed: false,
    }
  );
}

export async function generatePropertyCopy(input: {
  propertyId: string;
  templateCode?: string;
  useAi?: boolean;
  actor?: string;
  createdBy?: string | null;
}) {
  const settings = await getCopySettings();
  const templateCode = input.templateCode ?? settings.default_template;
  const template = await getTemplate(templateCode);

  const { data: property, error } = await db()
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("id", input.propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!property) throw new Error("Имотът не е намерен.");

  const facts = buildFacts(property);
  const wantAi = input.useAi ?? settings.ai_enabled;

  let draft: CopyDraft | null = null;
  let aiUsed = false;
  let model: string | null = null;
  let aiError: string | null = null;

  if (wantAi) {
    try {
      draft = await aiDraft(facts, template, settings);
      if (draft && draft.body) {
        aiUsed = true;
        model = "ai-provider";
      }
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }
  }
  if (!draft || !draft.body) draft = fallbackDraft(facts, template);
  if (!draft.seo_title) draft.seo_title = draft.title.slice(0, 60);
  if (!draft.seo_description) draft.seo_description = draft.short_text.slice(0, 160);

  const scores = scoreCopy(draft, facts, settings, template);

  const { data: last } = await db()
    .from("property_copy")
    .select("version")
    .eq("property_id", input.propertyId)
    .eq("template_code", templateCode)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = Number(last?.version ?? 0) + 1;

  const total = Math.round((scores.quality_score + scores.seo_score) / 2);
  const autoApprove = total >= settings.auto_approve_min_score;

  const row = {
    property_id: input.propertyId,
    template_code: templateCode,
    channel: template.channel,
    language: template.language ?? "bg",
    version,
    title: draft.title,
    body: draft.body,
    short_text: draft.short_text,
    bullets: draft.bullets,
    seo_title: draft.seo_title,
    seo_description: draft.seo_description,
    seo_keywords: draft.seo_keywords,
    slug: slugify(`${draft.title}-${facts.city ?? ""}`),
    hashtags: draft.hashtags,
    status: autoApprove ? "approved" : "draft",
    approved_at: autoApprove ? new Date().toISOString() : null,
    quality_score: scores.quality_score,
    seo_score: scores.seo_score,
    issues: scores.issues,
    word_count: scores.word_count,
    ai_used: aiUsed,
    model,
    created_by: input.createdBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error: insErr } = await db()
    .from("property_copy")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (insErr) throw new Error(insErr.message);

  await logCopyEvent({
    property_id: input.propertyId,
    copy_id: saved?.id ?? null,
    action: "generate",
    status: aiError ? "warn" : "ok",
    message: aiError
      ? `AI недостъпен, използван е резервен текст: ${aiError}`
      : aiUsed
        ? "AI генерира текста."
        : "Текстът е генериран по шаблон.",
    meta: { template: templateCode, quality: scores.quality_score, seo: scores.seo_score, version },
    actor: input.actor ?? "automation",
  });

  if (autoApprove && settings.auto_apply_approved && template.channel === "site") {
    await applyCopy({ copyId: saved.id, actor: input.actor ?? "automation" });
  }

  return { copy: saved, scores, ai_used: aiUsed, ai_error: aiError };
}

// ------------------------------------------------------------------
// Одобрение / прилагане
// ------------------------------------------------------------------
export async function setCopyStatus(input: {
  copyId: string;
  status: "draft" | "approved" | "rejected";
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
    .from("property_copy")
    .update(patch)
    .eq("id", input.copyId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await logCopyEvent({
    property_id: data?.property_id,
    copy_id: input.copyId,
    action: `status:${input.status}`,
    actor: input.actor ?? "crm",
  });
  return data;
}

export async function updateCopy(input: {
  copyId: string;
  patch: Partial<
    Pick<CopyDraft, "title" | "body" | "short_text" | "seo_title" | "seo_description">
  > & {
    bullets?: string[];
    seo_keywords?: string[];
    hashtags?: string[];
  };
  actor?: string;
}) {
  const { data: current, error: curErr } = await db()
    .from("property_copy")
    .select("*")
    .eq("id", input.copyId)
    .maybeSingle();
  if (curErr) throw new Error(curErr.message);
  if (!current) throw new Error("Текстът не е намерен.");

  const merged = { ...current, ...input.patch };
  const { data: property } = await db()
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("id", current.property_id)
    .maybeSingle();
  const settings = await getCopySettings();
  const template = await getTemplate(current.template_code);
  const scores = property
    ? scoreCopy(
        {
          title: merged.title ?? "",
          body: merged.body ?? "",
          short_text: merged.short_text ?? "",
          bullets: merged.bullets ?? [],
          seo_title: merged.seo_title ?? "",
          seo_description: merged.seo_description ?? "",
          seo_keywords: merged.seo_keywords ?? [],
          hashtags: merged.hashtags ?? [],
        },
        buildFacts(property),
        settings,
        template,
      )
    : {
        quality_score: current.quality_score,
        seo_score: current.seo_score,
        issues: current.issues,
        word_count: current.word_count,
      };

  const { data, error } = await db()
    .from("property_copy")
    .update({ ...input.patch, ...scores, updated_at: new Date().toISOString() })
    .eq("id", input.copyId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await logCopyEvent({
    property_id: current.property_id,
    copy_id: input.copyId,
    action: "edit",
    actor: input.actor ?? "crm",
  });
  return data;
}

/** Записва одобрения текст в самия имот (title/description). */
export async function applyCopy(input: { copyId: string; actor?: string }) {
  const { data: copy, error } = await db()
    .from("property_copy")
    .select("*")
    .eq("id", input.copyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!copy) throw new Error("Текстът не е намерен.");

  const patch: Record<string, unknown> = {
    description: copy.body,
    updated_at: new Date().toISOString(),
  };
  if (copy.title) patch.title = copy.title;
  const { error: upErr } = await db().from("properties").update(patch).eq("id", copy.property_id);
  if (upErr) throw new Error(upErr.message);

  const { data: published } = await db()
    .from("property_copy")
    .update({
      status: "published",
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.copyId)
    .select("*")
    .maybeSingle();

  await logCopyEvent({
    property_id: copy.property_id,
    copy_id: input.copyId,
    action: "apply",
    message: "Текстът е записан в имота.",
    actor: input.actor ?? "crm",
  });
  return published;
}

// ------------------------------------------------------------------
// Опашка и фонов пас
// ------------------------------------------------------------------
export async function queueProperties(input: {
  propertyIds: string[];
  templateCode?: string;
  requestedBy?: string | null;
}) {
  const settings = await getCopySettings();
  const template = input.templateCode ?? settings.default_template;
  let queued = 0;
  for (const propertyId of input.propertyIds) {
    const { data: existing } = await db()
      .from("copy_queue")
      .select("id")
      .eq("property_id", propertyId)
      .eq("template_code", template)
      .eq("status", "queued")
      .maybeSingle();
    if (existing) continue;
    const { error } = await db()
      .from("copy_queue")
      .insert({
        property_id: propertyId,
        template_code: template,
        requested_by: input.requestedBy ?? null,
      });
    if (!error) queued += 1;
  }
  return { queued, template };
}

/** Слага в опашката имоти без описание (или с много кратко). */
export async function autoQueueMissing(limit = 20) {
  const settings = await getCopySettings();
  const { data, error } = await db().from("properties").select("id, description").limit(500);
  if (error) throw new Error(error.message);
  const candidates = (data ?? [])
    .filter((p: any) => words(p.description) < settings.min_words)
    .slice(0, limit)
    .map((p: any) => p.id);
  if (!candidates.length) return { queued: 0, template: settings.default_template };
  return queueProperties({ propertyIds: candidates });
}

export async function runCopyQueue(limitOverride?: number) {
  const settings = await getCopySettings();
  const job = await getCopyJobState();
  if (!settings.enabled)
    return { skipped: "disabled" as const, processed: 0, generated: 0, errors: 0 };
  if (job.paused)
    return {
      skipped: "paused" as const,
      reason: job.paused_reason,
      processed: 0,
      generated: 0,
      errors: 0,
    };
  if (!(await claimJob(settings.lease_seconds)))
    return { skipped: "locked" as const, processed: 0, generated: 0, errors: 0 };

  const limit = Math.min(Math.max(limitOverride ?? settings.batch_size, 1), 25);
  let processed = 0;
  let generated = 0;
  let errors = 0;

  try {
    if (settings.auto_queue_new) {
      try {
        await autoQueueMissing(limit);
      } catch {
        /* игнорирай — опашката пак ще се напълни */
      }
    }

    const { data: items } = await db()
      .from("copy_queue")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(limit);

    for (const item of items ?? []) {
      processed += 1;
      try {
        await generatePropertyCopy({
          propertyId: item.property_id,
          templateCode: item.template_code,
          actor: "cron",
        });
        generated += 1;
        await db()
          .from("copy_queue")
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
          .from("copy_queue")
          .update({
            status: attempts >= settings.retry_limit ? "error" : "queued",
            attempts,
            error: message.slice(0, 500),
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        await logCopyEvent({
          property_id: item.property_id,
          action: "generate",
          status: "error",
          message: message.slice(0, 500),
          actor: "cron",
        });
        if (/402|403/.test(message)) {
          await pauseCopyJob(`AI е блокиран: ${message.slice(0, 200)}`);
          break;
        }
      }
    }
  } finally {
    await releaseJob({ processed, generated, errors, at: new Date().toISOString() });
  }

  return { processed, generated, errors };
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------
export async function getCopyAnalytics() {
  const [{ data: copies }, { data: queue }, { data: properties }, { data: events }] =
    await Promise.all([
      db()
        .from("property_copy")
        .select(
          "id, created_at, status, channel, template_code, quality_score, seo_score, word_count, ai_used",
        ),
      db().from("copy_queue").select("status"),
      db().from("properties").select("id, description"),
      db()
        .from("copy_events")
        .select("action, status, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  const rows = copies ?? [];
  const byStatus: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1;
  }
  const avg = (key: "quality_score" | "seo_score" | "word_count") =>
    rows.length
      ? Math.round(rows.reduce((s: number, r: any) => s + Number(r[key] ?? 0), 0) / rows.length)
      : 0;

  const settings = await getCopySettings();
  const propRows = properties ?? [];
  const missing = propRows.filter((p: any) => words(p.description) < settings.min_words).length;

  const queueRows = queue ?? [];
  const queueByStatus: Record<string, number> = {};
  for (const q of queueRows) queueByStatus[q.status] = (queueByStatus[q.status] ?? 0) + 1;

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
    ai_share: rows.length
      ? Math.round((rows.filter((r: any) => r.ai_used).length / rows.length) * 100)
      : 0,
    avg_quality: avg("quality_score"),
    avg_seo: avg("seo_score"),
    avg_words: avg("word_count"),
    by_status: byStatus,
    by_channel: byChannel,
    queue: queueByStatus,
    properties_total: propRows.length,
    properties_missing_copy: missing,
    coverage: propRows.length
      ? Math.round(((propRows.length - missing) / propRows.length) * 100)
      : 0,
    trend: Object.entries(trend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count })),
    recent_errors: (events ?? []).filter((e: any) => e.status === "error").length,
  };
}
