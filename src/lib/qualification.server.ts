// Автоматизация №3 — AI Квалификация на клиенти.
// Извлича бюджет, район, интерес и срок; изчислява претеглен скор и
// препоръчва следващо действие. Без зависимост от Lovable — само Supabase + AI провайдър.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions, listAiProviders } from "@/lib/ai-provider";

const db = () => supabaseAdmin as unknown as { from: (t: string) => any };

export type QualificationWeights = {
  budget: number;
  timeframe: number;
  financing: number;
  location: number;
  contactability: number;
  engagement: number;
};

export type QualificationSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  auto_on_capture: boolean;
  qualified_threshold: number;
  nurture_threshold: number;
  weights: QualificationWeights;
};

export const DEFAULT_QUALIFICATION: QualificationSettings = {
  enabled: true,
  ai_enabled: true,
  auto_on_capture: true,
  qualified_threshold: 70,
  nurture_threshold: 40,
  weights: {
    budget: 25,
    timeframe: 20,
    financing: 15,
    location: 15,
    contactability: 15,
    engagement: 10,
  },
};

export async function getQualificationSettings(): Promise<QualificationSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", "qualification")
    .maybeSingle();
  const v = (data?.value ?? {}) as Partial<QualificationSettings>;
  return {
    ...DEFAULT_QUALIFICATION,
    ...v,
    weights: { ...DEFAULT_QUALIFICATION.weights, ...(v.weights ?? {}) },
  };
}

export async function saveQualificationSettings(
  patch: Partial<QualificationSettings>,
): Promise<QualificationSettings> {
  const current = await getQualificationSettings();
  const next: QualificationSettings = {
    ...current,
    ...patch,
    weights: { ...current.weights, ...(patch.weights ?? {}) },
  };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: "qualification", value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

// ---------------- Извличане на параметри ----------------

export type Extracted = {
  lead_type: string | null;
  intent: string | null;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  desired_city: string | null;
  desired_district: string | null;
  desired_property_type: string | null;
  rooms_min: number | null;
  area_min: number | null;
  area_max: number | null;
  timeframe: string | null;
  financing: string | null;
  motivation: string | null;
  ai_summary: string | null;
  ai_raw: unknown;
  model: string | null;
};

const CITIES = [
  "шумен",
  "варна",
  "нови пазар",
  "велики преслав",
  "преслав",
  "каспичан",
  "смядово",
  "търговище",
  "бургас",
  "софия",
  "плевен",
  "русе",
];
const TYPES: Record<string, string> = {
  едностаен: "apartment",
  двустаен: "apartment",
  тристаен: "apartment",
  четиристаен: "apartment",
  апартамент: "apartment",
  мезонет: "apartment",
  студио: "studio",
  къща: "house",
  вила: "house",
  "етаж от къща": "house",
  парцел: "land",
  земя: "land",
  земеделска: "land",
  офис: "office",
  магазин: "shop",
  склад: "warehouse",
  гараж: "garage",
  хотел: "hotel",
};

function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(/[\s.]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1000 ? n * 1000 : n; // „до 120к / 120" → 120 000
}

/** Евристично извличане — резервен вариант без AI. */
export function heuristicExtract(text: string): Extracted {
  const t = (text ?? "").toLowerCase();

  let lead_type: string | null = null;
  if (/искам да продам|продавам|продажба на моя|оценка на имот/.test(t)) lead_type = "seller";
  else if (/под наем|наем|наемам|искам да наема/.test(t)) lead_type = "tenant";
  else if (/инвестиц|доходност|за инвест/.test(t)) lead_type = "investor";
  else if (/купя|купувам|търся|интересува ме/.test(t)) lead_type = "buyer";

  const currency = /(евро|eur|€)/.test(t) ? "EUR" : /(лв|лева|bgn)/.test(t) ? "BGN" : "EUR";

  let budget_min: number | null = null;
  let budget_max: number | null = null;
  const range = t.match(
    /(?:между\s*)?(\d[\d\s.,]*)\s*(?:до|-|–)\s*(\d[\d\s.,]*)\s*(?:к|k|хил|000)?\s*(?:евро|eur|€|лв|лева|bgn)?/,
  );
  const upTo = t.match(/(?:до|максимум|макс\.?|бюджет)\s*(\d[\d\s.,]*)\s*(?:к|k|хил)?/);
  const from = t.match(/(?:от|минимум|мин\.?)\s*(\d[\d\s.,]*)\s*(?:к|k|хил)?/);
  if (range) {
    budget_min = parseAmount(range[1]!);
    budget_max = parseAmount(range[2]!);
  } else {
    if (upTo) budget_max = parseAmount(upTo[1]!);
    if (from) budget_min = parseAmount(from[1]!);
  }

  const city = CITIES.find((c) => t.includes(c)) ?? null;
  const districtMatch = t.match(/(?:кв\.?|квартал|район)\s*([а-яa-z\s-]{3,30})/);
  const desired_district = districtMatch
    ? districtMatch[1]!.trim().split(/[,.;]/)[0]!.trim()
    : null;

  const typeKey = Object.keys(TYPES).find((k) => t.includes(k)) ?? null;
  const desired_property_type = typeKey ? TYPES[typeKey]! : null;

  const roomsWord = /едностаен/.test(t)
    ? 1
    : /двустаен/.test(t)
      ? 2
      : /тристаен/.test(t)
        ? 3
        : /четиристаен/.test(t)
          ? 4
          : null;
  const roomsNum = t.match(/(\d)\s*(?:стаен|стаи|спални)/);
  const rooms_min = roomsWord ?? (roomsNum ? Number(roomsNum[1]) : null);

  const areaRange = t.match(/(\d{2,4})\s*(?:до|-|–)\s*(\d{2,4})\s*(?:кв|m2|м2|кв\.м)/);
  const areaOne = t.match(/(\d{2,4})\s*(?:кв\.?\s*м|кв\.м|m2|м2|квадрата)/);
  const area_min = areaRange ? Number(areaRange[1]) : null;
  const area_max = areaRange ? Number(areaRange[2]) : areaOne ? Number(areaOne[1]) : null;

  let timeframe: string | null = null;
  if (/веднага|спешно|незабавно|този месец|до седмица/.test(t)) timeframe = "immediate";
  else if (/до\s*(1|2|3)\s*месец|следващите месеци|в кратък срок/.test(t)) timeframe = "1_3_months";
  else if (/до\s*(4|5|6)\s*месец|половин година/.test(t)) timeframe = "3_6_months";
  else if (/година|догодина/.test(t)) timeframe = "6_12_months";
  else if (/разглеждам|проучвам|само питам|информативно/.test(t)) timeframe = "exploring";

  let financing: string | null = null;
  if (/в брой|кеш|собствени средства|налични средства/.test(t)) financing = "cash";
  else if (/одобрен(а)? (ипотека|кредит)|имам одобрение/.test(t)) financing = "mortgage_approved";
  else if (/ипотек|кредит|банка|лизинг/.test(t)) financing = "mortgage_needed";

  return {
    lead_type,
    intent: null,
    budget_min,
    budget_max,
    currency,
    desired_city: city ? city.charAt(0).toUpperCase() + city.slice(1) : null,
    desired_district,
    desired_property_type,
    rooms_min,
    area_min,
    area_max,
    timeframe,
    financing,
    motivation: null,
    ai_summary: null,
    ai_raw: { mode: "heuristic" },
    model: "heuristic",
  };
}

const AI_PROMPT = `Ти си старши брокер в българска агенция за недвижими имоти. Квалифицирай клиента по данните и върни САМО валиден JSON без обяснения и без markdown:
{"lead_type":"buyer|seller|tenant|landlord|investor|unknown","intent":"кратко описание","budget_min":number|null,"budget_max":number|null,"currency":"EUR|BGN","desired_city":string|null,"desired_district":string|null,"desired_property_type":"apartment|studio|house|land|office|shop|warehouse|garage|hotel|other|null","rooms_min":number|null,"area_min":number|null,"area_max":number|null,"timeframe":"immediate|1_3_months|3_6_months|6_12_months|exploring|unknown","financing":"cash|mortgage_approved|mortgage_needed|unknown","motivation":"кратко","summary":"1-2 изречения на български","next_questions":["най-важните 2-3 въпроса, които брокерът да зададе"]}
Не измисляй данни — липсващото е null. Суми преобразувай в число без разделители.`;

export async function aiExtract(payload: string): Promise<Extracted> {
  const fallback = heuristicExtract(payload);
  const settings = await getQualificationSettings();
  if (!settings.ai_enabled || listAiProviders().length === 0) return fallback;

  try {
    const res = await aiChatCompletions({
      temperature: 0.1,
      messages: [
        { role: "system", content: AI_PROMPT },
        { role: "user", content: payload },
      ],
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      model?: string;
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const p = JSON.parse(match[0]) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
    const str = (v: unknown) =>
      typeof v === "string" && v.trim() && v !== "unknown" && v !== "null" ? v.trim() : null;
    return {
      lead_type: str(p.lead_type) ?? fallback.lead_type,
      intent: str(p.intent),
      budget_min: num(p.budget_min) ?? fallback.budget_min,
      budget_max: num(p.budget_max) ?? fallback.budget_max,
      currency: str(p.currency) ?? fallback.currency,
      desired_city: str(p.desired_city) ?? fallback.desired_city,
      desired_district: str(p.desired_district) ?? fallback.desired_district,
      desired_property_type: str(p.desired_property_type) ?? fallback.desired_property_type,
      rooms_min: num(p.rooms_min) ?? fallback.rooms_min,
      area_min: num(p.area_min) ?? fallback.area_min,
      area_max: num(p.area_max) ?? fallback.area_max,
      timeframe: str(p.timeframe) ?? fallback.timeframe,
      financing: str(p.financing) ?? fallback.financing,
      motivation: str(p.motivation),
      ai_summary: str(p.summary),
      ai_raw: p,
      model: json.model ?? "ai",
    };
  } catch {
    return fallback;
  }
}

// ---------------- Скоринг ----------------

export type Scored = {
  score: number;
  grade: string;
  status: string;
  breakdown: Record<string, number>;
  missing_fields: string[];
  recommended_action: string;
  next_questions: string[];
};

const TIMEFRAME_FACTOR: Record<string, number> = {
  immediate: 1,
  "1_3_months": 0.85,
  "3_6_months": 0.6,
  "6_12_months": 0.35,
  exploring: 0.15,
};

const FINANCING_FACTOR: Record<string, number> = {
  cash: 1,
  mortgage_approved: 0.9,
  mortgage_needed: 0.5,
  unknown: 0.25,
};

export function scoreQualification(
  e: Extracted,
  ctx: {
    hasPhone: boolean;
    hasEmail: boolean;
    messageLength: number;
    hasProperty: boolean;
    matchedProperties: number;
  },
  settings: QualificationSettings,
): Scored {
  const w = settings.weights;
  const missing: string[] = [];

  // Бюджет
  let budgetFactor = 0.2;
  if (e.budget_max || e.budget_min) {
    const value = e.budget_max ?? e.budget_min ?? 0;
    budgetFactor = value >= 150000 ? 1 : value >= 80000 ? 0.85 : value >= 40000 ? 0.7 : 0.5;
    if (e.budget_min && e.budget_max) budgetFactor = Math.min(1, budgetFactor + 0.1);
  } else missing.push("бюджет");

  // Срок
  const tf = e.timeframe ?? "unknown";
  const timeframeFactor = TIMEFRAME_FACTOR[tf] ?? 0.25;
  if (!e.timeframe) missing.push("срок за покупка/наем");

  // Финансиране
  const financingFactor = FINANCING_FACTOR[e.financing ?? "unknown"] ?? 0.25;
  if (!e.financing) missing.push("начин на финансиране");

  // Локация и тип
  let locationFactor = 0.2;
  if (e.desired_city) locationFactor += 0.4;
  if (e.desired_district) locationFactor += 0.2;
  if (e.desired_property_type) locationFactor += 0.2;
  locationFactor = Math.min(1, locationFactor);
  if (!e.desired_city) missing.push("район / град");
  if (!e.desired_property_type) missing.push("тип имот");

  // Достъпност за контакт
  let contactFactor = 0;
  if (ctx.hasPhone) contactFactor += 0.7;
  if (ctx.hasEmail) contactFactor += 0.3;
  if (!ctx.hasPhone) missing.push("телефон");

  // Ангажираност
  let engagementFactor = Math.min(1, ctx.messageLength / 240);
  if (ctx.hasProperty) engagementFactor = Math.min(1, engagementFactor + 0.4);
  if (ctx.matchedProperties > 0) engagementFactor = Math.min(1, engagementFactor + 0.2);

  const breakdown = {
    budget: Math.round(budgetFactor * w.budget),
    timeframe: Math.round(timeframeFactor * w.timeframe),
    financing: Math.round(financingFactor * w.financing),
    location: Math.round(locationFactor * w.location),
    contactability: Math.round(contactFactor * w.contactability),
    engagement: Math.round(engagementFactor * w.engagement),
  };

  const totalWeight = Object.values(w).reduce((a, b) => a + b, 0) || 100;
  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.max(0, Math.min(100, Math.round((raw / totalWeight) * 100)));

  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 40 ? "C" : "D";
  const status =
    score >= settings.qualified_threshold
      ? "qualified"
      : score >= settings.nurture_threshold
        ? "nurture"
        : "disqualified";

  const recommended_action =
    status === "qualified"
      ? ctx.matchedProperties > 0
        ? `Обади се днес и предложи ${ctx.matchedProperties} подходящи имота + оглед в рамките на 48 часа.`
        : "Обади се днес, уточни критериите и заяви търсене по поръчка."
      : status === "nurture"
        ? `Включи в кампания за подхранване и уточни: ${missing.slice(0, 2).join(", ") || "критериите"}.`
        : "Ниска готовност — остави в списък за периодичен бюлетин без активно обаждане.";

  const next_questions = missing.slice(0, 3).map((m) => {
    if (m === "бюджет") return "Какъв бюджет сте предвидили и в каква валута?";
    if (m === "срок за покупка/наем") return "В какъв срок планирате сделката?";
    if (m === "начин на финансиране") return "Ще плащате в брой или с банков кредит?";
    if (m === "район / град") return "В кой град и район търсите имот?";
    if (m === "тип имот") return "Какъв тип имот Ви интересува?";
    if (m === "телефон") return "На кой телефон да Ви потърсим?";
    return `Уточнете: ${m}`;
  });

  return {
    score,
    grade,
    status,
    breakdown,
    missing_fields: missing,
    recommended_action,
    next_questions,
  };
}

// ---------------- Съвпадения с наличните имоти ----------------

async function countMatchingProperties(e: Extracted): Promise<number> {
  try {
    let q = db()
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    if (e.budget_max) q = q.lte("price", e.budget_max * 1.1);
    if (e.budget_min) q = q.gte("price", e.budget_min * 0.9);
    if (e.desired_property_type) q = q.eq("property_type", e.desired_property_type);
    if (e.rooms_min) q = q.gte("rooms", e.rooms_min);
    if (e.area_min) q = q.gte("area_sqm", e.area_min);
    const { count } = await q;
    return Number(count ?? 0);
  } catch {
    return 0;
  }
}

// ---------------- Основен вход ----------------

export async function qualifyLead(
  leadId: string,
  opts: {
    source?: "auto" | "manual" | "form";
    actor?: string | null;
    answers?: Record<string, unknown> | null;
  } = {},
) {
  const settings = await getQualificationSettings();
  if (!settings.enabled) return null;

  const { data: lead } = await db()
    .from("leads")
    .select("*, properties:property_id(title, price, city_id, property_type)")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) throw new Error("Лийдът не е намерен.");

  const answers = opts.answers ?? null;
  const answersText = answers
    ? Object.entries(answers)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join("\n")
    : "";

  const payload = [
    `Име: ${lead.full_name ?? "—"}`,
    `Телефон: ${lead.phone ?? "—"}`,
    `Имейл: ${lead.email ?? "—"}`,
    `Канал: ${lead.channel ?? "website"}`,
    `Имот от сайта: ${lead.properties?.title ?? "—"}`,
    `Съобщение: ${lead.message ?? "—"}`,
    answersText ? `Отговори от въпросника:\n${answersText}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const extracted = await aiExtract(payload);

  // Отговорите от въпросника имат приоритет над AI предположенията.
  if (answers) {
    const a = answers as Record<string, any>;
    const num = (v: unknown) =>
      v === null || v === undefined || v === "" ? null : Number(v) || null;
    if (a.lead_type) extracted.lead_type = String(a.lead_type);
    if (num(a.budget_min)) extracted.budget_min = num(a.budget_min);
    if (num(a.budget_max)) extracted.budget_max = num(a.budget_max);
    if (a.currency) extracted.currency = String(a.currency);
    if (a.desired_city) extracted.desired_city = String(a.desired_city);
    if (a.desired_district) extracted.desired_district = String(a.desired_district);
    if (a.desired_property_type) extracted.desired_property_type = String(a.desired_property_type);
    if (num(a.rooms_min)) extracted.rooms_min = num(a.rooms_min);
    if (num(a.area_min)) extracted.area_min = num(a.area_min);
    if (num(a.area_max)) extracted.area_max = num(a.area_max);
    if (a.timeframe) extracted.timeframe = String(a.timeframe);
    if (a.financing) extracted.financing = String(a.financing);
    if (a.motivation) extracted.motivation = String(a.motivation);
  }

  const matchedProperties = await countMatchingProperties(extracted);

  const scored = scoreQualification(
    extracted,
    {
      hasPhone: Boolean(lead.phone),
      hasEmail: Boolean(lead.email),
      messageLength: String(lead.message ?? "").length + answersText.length,
      hasProperty: Boolean(lead.property_id),
      matchedProperties,
    },
    settings,
  );

  const aiQuestions = Array.isArray((extracted.ai_raw as any)?.next_questions)
    ? (((extracted.ai_raw as any).next_questions as unknown[])
        .filter((q) => typeof q === "string")
        .slice(0, 3) as string[])
    : [];
  const next_questions = aiQuestions.length ? aiQuestions : scored.next_questions;

  const { data: record, error } = await db()
    .from("lead_qualifications")
    .insert({
      lead_id: leadId,
      lead_type: extracted.lead_type,
      intent: extracted.intent,
      budget_min: extracted.budget_min,
      budget_max: extracted.budget_max,
      currency: extracted.currency,
      desired_city: extracted.desired_city,
      desired_district: extracted.desired_district,
      desired_property_type: extracted.desired_property_type,
      rooms_min: extracted.rooms_min,
      area_min: extracted.area_min,
      area_max: extracted.area_max,
      timeframe: extracted.timeframe,
      financing: extracted.financing,
      motivation: extracted.motivation,
      score: scored.score,
      grade: scored.grade,
      status: scored.status,
      breakdown: scored.breakdown,
      missing_fields: scored.missing_fields,
      matched_properties: matchedProperties,
      recommended_action: scored.recommended_action,
      next_questions,
      ai_summary: extracted.ai_summary,
      ai_raw: extracted.ai_raw,
      model: extracted.model,
      source: opts.source ?? "auto",
      actor: opts.actor ?? null,
    })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);

  const now = new Date().toISOString();
  await db()
    .from("leads")
    .update({
      lead_type: extracted.lead_type ?? lead.lead_type,
      intent: extracted.intent ?? lead.intent,
      budget_min: extracted.budget_min ?? lead.budget_min,
      budget_max: extracted.budget_max ?? lead.budget_max,
      currency: extracted.currency ?? lead.currency,
      desired_city: extracted.desired_city ?? lead.desired_city,
      desired_district: extracted.desired_district ?? lead.desired_district,
      desired_property_type: extracted.desired_property_type ?? lead.desired_property_type,
      rooms_min: extracted.rooms_min ?? lead.rooms_min,
      area_min: extracted.area_min ?? lead.area_min,
      area_max: extracted.area_max ?? lead.area_max,
      timeframe: extracted.timeframe ?? lead.timeframe,
      financing: extracted.financing ?? lead.financing,
      motivation: extracted.motivation ?? lead.motivation,
      qualification_score: scored.score,
      qualification_grade: scored.grade,
      qualification_status: scored.status,
      qualified_at: now,
      status:
        scored.status === "qualified" && lead.status !== "converted" ? "qualified" : lead.status,
      ai_summary: extracted.ai_summary ?? lead.ai_summary,
      updated_at: now,
    })
    .eq("id", leadId);

  await db()
    .from("lead_events")
    .insert({
      lead_id: leadId,
      event_type: "qualified",
      detail: `Скор ${scored.score} (${scored.grade}) · ${scored.status} · ${matchedProperties} съвпадения`,
      payload: {
        breakdown: scored.breakdown,
        missing: scored.missing_fields,
        source: opts.source ?? "auto",
      },
      actor: opts.actor ?? null,
    });

  // Автоматизация №4 — при квалифициран клиент веднага подбира и изпраща имоти.
  if (scored.status === "qualified") {
    try {
      const { getMatchingSettings, generateMatchesForLead, sendMatchesToLead } =
        await import("@/lib/matching.server");
      const mCfg = await getMatchingSettings();
      if (mCfg.enabled && mCfg.auto_on_qualified) {
        await generateMatchesForLead(leadId);
        await sendMatchesToLead(leadId);
      }
    } catch {
      /* не блокира квалификацията */
    }
  }

  return record;
}

/** Публичен въпросник: записва отговори към лийд и го квалифицира. */
export async function submitQualificationForm(input: {
  lead_id: string;
  answers: Record<string, unknown>;
  ip?: string | null;
  landing_path?: string | null;
}) {
  await db()
    .from("qualification_answers")
    .insert({
      lead_id: input.lead_id,
      answers: input.answers,
      ip: input.ip ?? null,
      landing_path: input.landing_path ?? null,
    });
  const record = await qualifyLead(input.lead_id, { source: "form", answers: input.answers });
  return {
    score: record?.score ?? null,
    grade: record?.grade ?? null,
    status: record?.status ?? null,
    matched_properties: record?.matched_properties ?? 0,
  };
}

/** Пакетна квалификация на неквалифицирани лийдове (cron или бутон в CRM). */
export async function qualifyPending(
  limit = 25,
): Promise<{ processed: number; qualified: number; failed: number }> {
  const { data } = await db()
    .from("leads")
    .select("id")
    .or("qualification_status.is.null,qualification_status.eq.pending")
    .order("created_at", { ascending: false })
    .limit(limit);

  let qualified = 0;
  let failed = 0;
  for (const row of (data ?? []) as any[]) {
    try {
      const rec = await qualifyLead(row.id as string, { source: "auto" });
      if (rec?.status === "qualified") qualified++;
    } catch {
      failed++;
    }
  }
  return { processed: (data ?? []).length, qualified, failed };
}

// ---------------- Аналитика ----------------

export async function qualificationAnalytics() {
  const { data } = await db()
    .from("leads")
    .select(
      "qualification_status, qualification_grade, qualification_score, budget_max, timeframe, financing, desired_city, lead_type, created_at",
    )
    .limit(5000);
  const rows = (data ?? []) as any[];

  const byStatus: Record<string, number> = {};
  const byGrade: Record<string, number> = {};
  const byTimeframe: Record<string, number> = {};
  const byFinancing: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let scoreSum = 0;
  let scored = 0;
  let budgetSum = 0;
  let budgetCount = 0;

  for (const r of rows) {
    const st = r.qualification_status ?? "pending";
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    if (r.qualification_grade)
      byGrade[r.qualification_grade] = (byGrade[r.qualification_grade] ?? 0) + 1;
    if (r.timeframe) byTimeframe[r.timeframe] = (byTimeframe[r.timeframe] ?? 0) + 1;
    if (r.financing) byFinancing[r.financing] = (byFinancing[r.financing] ?? 0) + 1;
    if (r.desired_city) byCity[r.desired_city] = (byCity[r.desired_city] ?? 0) + 1;
    if (r.lead_type) byType[r.lead_type] = (byType[r.lead_type] ?? 0) + 1;
    if (typeof r.qualification_score === "number") {
      scoreSum += r.qualification_score;
      scored++;
    }
    if (typeof r.budget_max === "number" && r.budget_max > 0) {
      budgetSum += r.budget_max;
      budgetCount++;
    }
  }

  const { data: recent } = await db()
    .from("lead_qualifications")
    .select("matched_properties, score")
    .order("created_at", { ascending: false })
    .limit(500);
  const recs = (recent ?? []) as any[];

  return {
    total: rows.length,
    scored,
    pending: byStatus["pending"] ?? 0,
    qualified: byStatus["qualified"] ?? 0,
    nurture: byStatus["nurture"] ?? 0,
    disqualified: byStatus["disqualified"] ?? 0,
    avgScore: scored ? Math.round(scoreSum / scored) : 0,
    avgBudget: budgetCount ? Math.round(budgetSum / budgetCount) : null,
    qualifiedPct: rows.length ? Math.round(((byStatus["qualified"] ?? 0) / rows.length) * 100) : 0,
    avgMatches: recs.length
      ? Math.round(
          (recs.reduce((a, b) => a + Number(b.matched_properties ?? 0), 0) / recs.length) * 10,
        ) / 10
      : 0,
    byStatus,
    byGrade,
    byTimeframe,
    byFinancing,
    byCity,
    byType,
  };
}
