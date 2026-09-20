// Автоматизации №1 и №2 — сървърна логика (без зависимост от Lovable).
// №1 Smart Lead Capture: приемане, дедупликация, AI обогатяване, свързване с CRM.
// №2 Instant First Contact: насрочване и изпращане на първи контакт до 30 сек.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions, listAiProviders } from "@/lib/ai-provider";
import { sendTransactionalEmail } from "@/lib/send-email";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
  };

export type LeadInput = {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  channel?: string | null;
  source?: string | null;
  preferred_contact?: string | null;
  property_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referrer?: string | null;
  landing_path?: string | null;
};

export type AutomationSettings = {
  enabled: boolean;
  window_seconds: number;
  channel: string;
  ai_personalize: boolean;
  escalate_after_minutes: number;
  work_hours_start: number;
  work_hours_end: number;
};

const DEFAULT_SETTINGS: AutomationSettings = {
  enabled: true,
  window_seconds: 30,
  channel: "email",
  ai_personalize: true,
  escalate_after_minutes: 30,
  work_hours_start: 8,
  work_hours_end: 21,
};

export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("359")) return `+${digits}`;
  if (digits.startsWith("0")) return `+359${digits.slice(1)}`;
  return `+${digits}`;
}

export function buildDedupeKey(input: LeadInput): string | null {
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim().toLowerCase() || null;
  const ident = phone ?? email;
  if (!ident) return null;
  const day = new Date().toISOString().slice(0, 10);
  return `${ident}|${input.property_id ?? "-"}|${day}`;
}

export async function getAutomationSettings(): Promise<AutomationSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", "instant_contact")
    .maybeSingle();
  return { ...DEFAULT_SETTINGS, ...((data?.value ?? {}) as Partial<AutomationSettings>) };
}

export async function saveAutomationSettings(
  patch: Partial<AutomationSettings>,
): Promise<AutomationSettings> {
  const next = { ...(await getAutomationSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: "instant_contact", value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

// ---------------- AI обогатяване ----------------

type Enrichment = {
  lead_type: string;
  intent: string | null;
  budget_min: number | null;
  budget_max: number | null;
  desired_city: string | null;
  desired_property_type: string | null;
  score: number;
  ai_summary: string | null;
  ai_raw: unknown;
};

/** Евристичен резерв, когато AI не е конфигуриран или върне грешка. */
function heuristicEnrichment(input: LeadInput): Enrichment {
  const text = `${input.message ?? ""}`.toLowerCase();
  let lead_type = "buyer";
  if (/продав|продажба на моя|искам да продам/.test(text)) lead_type = "seller";
  else if (/наем|под наем|наемам/.test(text)) lead_type = "tenant";
  else if (/инвест/.test(text)) lead_type = "investor";

  const budgetMatch = text.match(/(\d[\d\s.,]{2,})\s*(евро|eur|€|лв|лева|bgn)/);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(/[^\d]/g, "")) : null;

  let score = 40;
  if (normalizePhone(input.phone)) score += 20;
  if (input.email) score += 10;
  if (input.property_id) score += 15;
  if ((input.message ?? "").length > 60) score += 10;
  if (budget) score += 5;

  return {
    lead_type,
    intent: null,
    budget_min: null,
    budget_max: budget,
    desired_city: null,
    desired_property_type: null,
    score: Math.min(100, score),
    ai_summary: null,
    ai_raw: { mode: "heuristic" },
  };
}

export async function enrichLead(
  input: LeadInput,
  propertyTitle?: string | null,
): Promise<Enrichment> {
  const fallback = heuristicEnrichment(input);
  if (listAiProviders().length === 0) return fallback;

  const prompt = `Ти си асистент на българска агенция за недвижими имоти. Анализирай запитването и върни САМО JSON без обяснения:
{"lead_type":"buyer|seller|tenant|landlord|investor|unknown","intent":"кратко","budget_min":number|null,"budget_max":number|null,"desired_city":string|null,"desired_property_type":string|null,"score":0-100,"summary":"1-2 изречения на български"}
score = вероятност за реална сделка (има телефон, конкретен имот, ясен бюджет и срок = висок).

Запитване:
Име: ${input.full_name}
Телефон: ${input.phone ?? "—"}
Имейл: ${input.email ?? "—"}
Канал: ${input.channel ?? "website"}
Имот: ${propertyTitle ?? "—"}
Съобщение: ${input.message ?? "—"}`;

  try {
    const res = await aiChatCompletions({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      lead_type: typeof parsed.lead_type === "string" ? parsed.lead_type : fallback.lead_type,
      intent: typeof parsed.intent === "string" ? parsed.intent : null,
      budget_min: num(parsed.budget_min),
      budget_max: num(parsed.budget_max),
      desired_city: typeof parsed.desired_city === "string" ? parsed.desired_city : null,
      desired_property_type:
        typeof parsed.desired_property_type === "string" ? parsed.desired_property_type : null,
      score: Math.max(0, Math.min(100, Number(parsed.score) || fallback.score)),
      ai_summary: typeof parsed.summary === "string" ? parsed.summary : null,
      ai_raw: parsed,
    };
  } catch {
    return fallback;
  }
}

// ---------------- Приемане на лийд ----------------

async function logEvent(
  leadId: string,
  event_type: string,
  detail?: string | null,
  payload?: unknown,
  channel?: string | null,
) {
  await db()
    .from("lead_events")
    .insert({
      lead_id: leadId,
      event_type,
      detail: detail ?? null,
      payload: payload ?? null,
      channel: channel ?? null,
    });
}

/** Намира или създава клиент по телефон/имейл и връща id. */
async function linkClient(input: LeadInput, leadType: string): Promise<string | null> {
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim().toLowerCase() || null;
  if (!phone && !email) return null;

  const filters: string[] = [];
  if (phone) filters.push(`phone.eq.${phone}`);
  if (email) filters.push(`email.eq.${email}`);
  const { data: existing } = await db().from("clients").select("id").or(filters.join(",")).limit(1);
  if (existing?.[0]?.id) return existing[0].id as string;

  const clientType = ["buyer", "seller", "tenant", "landlord"].includes(leadType)
    ? leadType
    : "buyer";
  const { data: created } = await db()
    .from("clients")
    .insert({
      full_name: input.full_name,
      phone,
      email,
      client_type: clientType,
      status: "active",
      notes: input.message
        ? `Създаден автоматично от лийд: ${input.message.slice(0, 500)}`
        : "Създаден автоматично от лийд",
    })
    .select("id")
    .maybeSingle();
  return (created?.id as string | undefined) ?? null;
}

export async function captureLead(
  input: LeadInput,
): Promise<{ id: string; deduped: boolean; score: number }> {
  const dedupe_key = buildDedupeKey(input);

  if (dedupe_key) {
    const { data: dup } = await db()
      .from("leads")
      .select("id, score")
      .eq("dedupe_key", dedupe_key)
      .maybeSingle();
    if (dup?.id) {
      await logEvent(dup.id as string, "deduped", "Повторно запитване в рамките на 24 часа", {
        channel: input.channel,
      });
      return { id: dup.id as string, deduped: true, score: Number(dup.score ?? 0) };
    }
  }

  let propertyTitle: string | null = null;
  if (input.property_id) {
    const { data: prop } = await db()
      .from("properties")
      .select("title, city_id")
      .eq("id", input.property_id)
      .maybeSingle();
    propertyTitle = (prop?.title as string | undefined) ?? null;
  }

  const enriched = await enrichLead(input, propertyTitle);
  const client_id = await linkClient(input, enriched.lead_type);

  const { data: lead, error } = await db()
    .from("leads")
    .insert({
      channel: input.channel ?? "website",
      source: input.source ?? null,
      utm_source: input.utm_source ?? null,
      utm_medium: input.utm_medium ?? null,
      utm_campaign: input.utm_campaign ?? null,
      referrer: input.referrer ?? null,
      landing_path: input.landing_path ?? null,
      full_name: input.full_name,
      phone: normalizePhone(input.phone),
      email: input.email?.trim().toLowerCase() || null,
      message: input.message ?? null,
      preferred_contact: input.preferred_contact ?? null,
      property_id: input.property_id ?? null,
      client_id,
      lead_type: enriched.lead_type,
      intent: enriched.intent,
      budget_min: enriched.budget_min,
      budget_max: enriched.budget_max,
      desired_city: enriched.desired_city,
      desired_property_type: enriched.desired_property_type,
      score: enriched.score,
      ai_summary: enriched.ai_summary,
      ai_raw: enriched.ai_raw,
      dedupe_key,
      status: "new",
    })
    .select("id")
    .maybeSingle();

  if (error || !lead?.id) throw new Error(error?.message ?? "Лийдът не беше записан.");
  const leadId = lead.id as string;

  await logEvent(
    leadId,
    "captured",
    `Канал: ${input.channel ?? "website"}`,
    { source: input.source },
    input.channel ?? "website",
  );
  await logEvent(
    leadId,
    "enriched",
    enriched.ai_summary ?? `Тип: ${enriched.lead_type}, score ${enriched.score}`,
    enriched.ai_raw,
  );

  // Автоматизация №3 — AI квалификация веднага след улавяне.
  try {
    const { getQualificationSettings, qualifyLead } = await import("@/lib/qualification.server");
    const qCfg = await getQualificationSettings();
    if (qCfg.enabled && qCfg.auto_on_capture) await qualifyLead(leadId, { source: "auto" });
  } catch (e) {
    await logEvent(
      leadId,
      "note",
      `Квалификацията не беше изпълнена: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Автоматизация №2 — насрочва първи контакт веднага.
  await scheduleFirstContact(leadId, propertyTitle);

  return { id: leadId, deduped: false, score: enriched.score };
}

// ---------------- Автоматизация №2 ----------------

function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
}

async function pickTemplate(channel: string, leadType: string | null) {
  const { data } = await db()
    .from("contact_templates")
    .select("*")
    .eq("channel", channel)
    .eq("is_active", true);
  const list = (data ?? []) as any[];
  return list.find((t) => t.lead_type === leadType) ?? list.find((t) => !t.lead_type) ?? null;
}

async function personalize(body: string, lead: any, propertyTitle: string | null): Promise<string> {
  if (listAiProviders().length === 0) return body;
  try {
    const res = await aiChatCompletions({
      temperature: 0.5,
      messages: [
        {
          role: "user",
          content: `Персонализирай това първо съобщение на български за клиент на агенция „Имоти Надежда“. Запази учтивия тон, максимум 90 думи, без измислени факти, запази телефона и подписа. Върни само текста.

Шаблон:
${body}

Данни за клиента: име ${lead.full_name}; тип ${lead.lead_type ?? "неизвестен"}; съобщение: ${lead.message ?? "—"}; имот: ${propertyTitle ?? "—"}.`,
        },
      ],
    });
    if (!res.ok) return body;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : body;
  } catch {
    return body;
  }
}

/** Създава pending опит за контакт и веднага го обработва (цел < 30 сек). */
export async function scheduleFirstContact(
  leadId: string,
  propertyTitle?: string | null,
): Promise<void> {
  const settings = await getAutomationSettings();
  if (!settings.enabled) return;

  const { data: lead } = await db().from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return;

  const channel = lead.email ? settings.channel : "sms";
  const tpl = await pickTemplate(channel, lead.lead_type ?? null);
  if (!tpl) {
    await logEvent(leadId, "contact_failed", `Няма активен шаблон за канал ${channel}`);
    return;
  }

  const vars = {
    name: String(lead.full_name ?? "").split(" ")[0] || String(lead.full_name ?? ""),
    property_line: propertyTitle ? ` за имот „${propertyTitle}“` : "",
    property: propertyTitle ?? "",
  };
  let body = fillTemplate(String(tpl.body), vars);
  if (settings.ai_personalize && channel === "email")
    body = await personalize(body, lead, propertyTitle ?? null);
  const subject = tpl.subject ? fillTemplate(String(tpl.subject), vars) : "Имоти Надежда";

  const { data: attempt } = await db()
    .from("contact_attempts")
    .insert({
      lead_id: leadId,
      channel,
      template_id: tpl.id,
      subject,
      body,
      status: "pending",
      scheduled_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (attempt?.id) await processContactAttempt(attempt.id as string);
}

export async function processContactAttempt(
  attemptId: string,
): Promise<"sent" | "failed" | "skipped"> {
  const { data: attempt } = await db()
    .from("contact_attempts")
    .select("*, leads:lead_id(*)")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt || attempt.status !== "pending") return "skipped";
  const lead = attempt.leads as any;

  // Само имейлът се изпраща автоматично; SMS/WhatsApp се подготвя за ръчно изпращане.
  if (attempt.channel !== "email" || !lead?.email) {
    await db().from("contact_attempts").update({ status: "manual" }).eq("id", attemptId);
    await logEvent(
      lead.id,
      "contact_sent",
      `Подготвено съобщение за ръчно изпращане (${attempt.channel})`,
      null,
      attempt.channel,
    );
    return "skipped";
  }

  const createdMs = new Date(lead.created_at as string).getTime();
  try {
    await sendTransactionalEmail({
      to: String(lead.email),
      subject: String(attempt.subject ?? "Имоти Надежда"),
      text: String(attempt.body ?? ""),
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${String(attempt.body ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</div>`,
      purpose: "instant_first_contact",
      label: "instant-first-contact",
      idempotency_key: attemptId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db()
      .from("contact_attempts")
      .update({ status: "failed", error: msg })
      .eq("id", attemptId);
    await logEvent(lead.id, "contact_failed", msg, null, attempt.channel);
    return "failed";
  }

  const now = new Date();
  const latency = Math.max(0, Math.round((now.getTime() - createdMs) / 1000));
  await db()
    .from("contact_attempts")
    .update({ status: "sent", sent_at: now.toISOString(), latency_seconds: latency })
    .eq("id", attemptId);
  await db()
    .from("leads")
    .update({
      status: lead.status === "new" ? "contacted" : lead.status,
      first_contact_at: now.toISOString(),
      first_contact_seconds: latency,
      updated_at: now.toISOString(),
    })
    .eq("id", lead.id);
  await logEvent(
    lead.id,
    "contact_sent",
    `Първи контакт по имейл за ${latency} сек.`,
    null,
    "email",
  );
  return "sent";
}

/** Cron: обработва изостанали опити и ескалира лийдове без контакт. */
export async function runInstantContactSweep(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  escalated: number;
}> {
  const settings = await getAutomationSettings();
  const { data: pending } = await db()
    .from("contact_attempts")
    .select("id")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .limit(50);

  let sent = 0,
    failed = 0;
  for (const a of (pending ?? []) as any[]) {
    const r = await processContactAttempt(a.id as string);
    if (r === "sent") sent++;
    else if (r === "failed") failed++;
  }

  // Лийдове без първи контакт след X минути → ескалация
  const cutoff = new Date(Date.now() - settings.escalate_after_minutes * 60 * 1000).toISOString();
  const { data: stale } = await db()
    .from("leads")
    .select("id, full_name")
    .is("first_contact_at", null)
    .eq("status", "new")
    .lte("created_at", cutoff)
    .limit(50);

  let escalated = 0;
  for (const l of (stale ?? []) as any[]) {
    const { data: already } = await db()
      .from("lead_events")
      .select("id")
      .eq("lead_id", l.id)
      .eq("event_type", "escalated")
      .limit(1);
    if (already?.length) continue;
    await logEvent(
      l.id,
      "escalated",
      `Няма първи контакт над ${settings.escalate_after_minutes} мин. — нужна намеса на брокер`,
    );
    escalated++;
  }

  return { processed: (pending ?? []).length, sent, failed, escalated };
}

// ---------------- Аналитика ----------------

export async function leadAnalytics() {
  const { data } = await db()
    .from("leads")
    .select("channel, status, score, created_at, first_contact_seconds")
    .limit(5000);
  const rows = (data ?? []) as any[];
  const byChannel: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  let scoreSum = 0;
  const latencies: number[] = [];

  for (const r of rows) {
    byChannel[r.channel ?? "—"] = (byChannel[r.channel ?? "—"] ?? 0) + 1;
    byStatus[r.status ?? "—"] = (byStatus[r.status ?? "—"] ?? 0) + 1;
    const day = String(r.created_at).slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
    scoreSum += Number(r.score ?? 0);
    if (typeof r.first_contact_seconds === "number") latencies.push(r.first_contact_seconds);
  }

  const under30 = latencies.filter((s) => s <= 30).length;
  return {
    total: rows.length,
    byChannel,
    byStatus,
    byDay,
    avgScore: rows.length ? Math.round(scoreSum / rows.length) : 0,
    contacted: latencies.length,
    avgFirstContactSeconds: latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null,
    under30Pct: latencies.length ? Math.round((under30 / latencies.length) * 100) : null,
    converted: byStatus["converted"] ?? 0,
    conversionPct: rows.length ? Math.round(((byStatus["converted"] ?? 0) / rows.length) * 100) : 0,
  };
}
