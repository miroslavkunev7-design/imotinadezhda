// Автоматизация №15 — Реактивиране на Клиенти: връщане на стари/студени контакти в процеса.
// Без зависимост от Lovable: Supabase + конфигуриран AI провайдър + собствен email слой.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions } from "@/lib/ai-provider";
import { sendTransactionalEmail } from "@/lib/send-email";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

export const SITE_URL = "https://imotinadezhda.bg";
const JOB_KEY = "client_reactivation_sweep";
const SETTINGS_KEY = "client_reactivation";

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type ReactivationSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  auto_enroll: boolean;
  default_campaign: string;
  inactive_days: number;
  batch_size: number;
  enroll_batch: number;
  lease_seconds: number;
  min_score_to_send: number;
  stop_on_reply: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
};

export const DEFAULT_REACTIVATION_SETTINGS: ReactivationSettings = {
  enabled: true,
  ai_enabled: true,
  auto_enroll: true,
  default_campaign: "cold_90",
  inactive_days: 90,
  batch_size: 15,
  enroll_batch: 25,
  lease_seconds: 300,
  min_score_to_send: 25,
  stop_on_reply: true,
  quiet_hours_start: 21,
  quiet_hours_end: 8,
};

export async function getReactivationSettings(): Promise<ReactivationSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return {
    ...DEFAULT_REACTIVATION_SETTINGS,
    ...((data?.value ?? {}) as Partial<ReactivationSettings>),
  };
}

export async function saveReactivationSettings(
  patch: Partial<ReactivationSettings>,
): Promise<ReactivationSettings> {
  const next = { ...(await getReactivationSettings()), ...patch };
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
// Задача (lease + circuit breaker)
// ------------------------------------------------------------------
export async function getReactivationJobState() {
  const { data } = await db().from("automation_jobs").select("*").eq("key", JOB_KEY).maybeSingle();
  return {
    key: JOB_KEY,
    paused: Boolean(data?.paused),
    paused_reason: data?.paused_reason ?? null,
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

export async function pauseReactivationJob(reason: string) {
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

export async function resumeReactivationJob() {
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
  return getReactivationJobState();
}

async function logEvent(
  enrollmentId: string | null,
  clientId: string | null,
  campaignCode: string | null,
  action: string,
  status: string,
  message?: string | null,
  actor?: string | null,
) {
  await db()
    .from("reactivation_events")
    .insert({
      enrollment_id: enrollmentId,
      client_id: clientId,
      campaign_code: campaignCode,
      action,
      status,
      message: message ?? null,
      actor: actor ?? "system",
    });
}

// ------------------------------------------------------------------
// Помощни
// ------------------------------------------------------------------
export async function listCampaigns() {
  const { data, error } = await db()
    .from("reactivation_campaigns")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listTemplates() {
  const { data, error } = await db()
    .from("reactivation_templates")
    .select("*")
    .order("campaign_code", { ascending: true })
    .order("step_no", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function campaignByCode(code: string) {
  const { data } = await db()
    .from("reactivation_campaigns")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  return data ?? null;
}

async function pickTemplate(campaignCode: string, step: number, channel: string) {
  const { data } = await db()
    .from("reactivation_templates")
    .select("*")
    .eq("is_active", true)
    .eq("channel", channel)
    .eq("step_no", step)
    .in("campaign_code", [campaignCode, "cold_90"])
    .limit(10);
  const rows = data ?? [];
  return rows.find((t: any) => t.campaign_code === campaignCode) ?? rows[0] ?? null;
}

function fillTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? "");
}

function daysSince(iso?: string | null): number {
  if (!iso) return 9999;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function inQuietHours(s: ReactivationSettings): boolean {
  const h = new Date().getUTCHours() + 3; // Sofia
  const hour = ((h % 24) + 24) % 24;
  const start = Number(s.quiet_hours_start);
  const end = Number(s.quiet_hours_end);
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export function optOutLink(token: string) {
  return `${SITE_URL}/api/public/reactivation/o/${token}`;
}

// ------------------------------------------------------------------
// Скоринг (вероятност за реактивиране 0–100)
// ------------------------------------------------------------------
export function scoreClient(client: any, inactiveDays: number): { score: number; reason: string } {
  let score = 40;
  const reasons: string[] = [];
  if (client.email) {
    score += 12;
    reasons.push("има имейл");
  }
  if (client.phone) {
    score += 8;
    reasons.push("има телефон");
  }
  if (client.deposit_amount) {
    score += 20;
    reasons.push("оставял е депозит");
  }
  if (client.interest_property_id) {
    score += 14;
    reasons.push("харесал е имот");
  }
  if (client.notes) {
    score += 4;
    reasons.push("има бележки");
  }
  if (client.client_type === "buyer") {
    score += 6;
    reasons.push("купувач");
  }
  if (inactiveDays > 365) {
    score -= 22;
    reasons.push("над година неактивен");
  } else if (inactiveDays > 180) {
    score -= 12;
    reasons.push("над 6 месеца неактивен");
  } else if (inactiveDays <= 120) {
    score += 6;
    reasons.push("скорошна активност");
  }
  score = Math.max(0, Math.min(100, score));
  return { score, reason: reasons.join(", ") || "базов профил" };
}

// ------------------------------------------------------------------
// Записване (auto + ръчно)
// ------------------------------------------------------------------
export async function enrollClient(input: {
  clientId: string;
  campaignCode?: string;
  channel?: string;
  actor?: string | null;
  startNow?: boolean;
}) {
  const settings = await getReactivationSettings();
  const campaignCode = input.campaignCode ?? settings.default_campaign;
  const { data: client } = await db()
    .from("clients")
    .select(
      "id, full_name, email, phone, client_type, notes, updated_at, created_at, deposit_amount, interest_property_id, assigned_to",
    )
    .eq("id", input.clientId)
    .maybeSingle();
  if (!client) throw new Error("Клиентът не е намерен.");

  const channel = input.channel ?? (client.email ? "email" : "call");
  const inactive = daysSince(client.updated_at ?? client.created_at);
  const { score, reason } = scoreClient(client, inactive);

  const { data: row, error } = await db()
    .from("reactivation_enrollments")
    .upsert(
      {
        campaign_code: campaignCode,
        client_id: client.id,
        contact_name: client.full_name,
        contact_email: client.email,
        contact_phone: client.phone,
        channel,
        status: "active",
        step_no: 0,
        inactive_days: inactive,
        score,
        score_reason: reason,
        next_action_at: new Date(input.startNow ? Date.now() : Date.now() + 60_000).toISOString(),
        created_by: input.actor ?? "system",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "campaign_code,client_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(
    row.id,
    client.id,
    campaignCode,
    "enrolled",
    "ok",
    `${channel} · score ${score}`,
    input.actor,
  );
  return row;
}

/** Намира неактивни клиенти и ги записва в кампания. */
export async function autoEnrollDormant(limit?: number) {
  const settings = await getReactivationSettings();
  const campaign = (await campaignByCode(settings.default_campaign)) ?? {
    code: settings.default_campaign,
    inactive_days: settings.inactive_days,
  };
  const cutoff = new Date(
    Date.now() - Number(campaign.inactive_days ?? settings.inactive_days) * 86_400_000,
  ).toISOString();
  const take = Math.min(Math.max(limit ?? settings.enroll_batch, 1), 100);

  const { data: clients } = await db()
    .from("clients")
    .select(
      "id, full_name, email, phone, client_type, notes, updated_at, created_at, deposit_amount, interest_property_id",
    )
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(take * 3);

  const candidates = (clients ?? []).filter((c: any) => c.email || c.phone);
  if (!candidates.length) return { enrolled: 0, skipped: 0 };

  const { data: existing } = await db()
    .from("reactivation_enrollments")
    .select("client_id")
    .eq("campaign_code", campaign.code)
    .in(
      "client_id",
      candidates.map((c: any) => c.id),
    );
  const taken = new Set((existing ?? []).map((r: any) => r.client_id));

  let enrolled = 0;
  let skipped = 0;
  for (const c of candidates) {
    if (enrolled >= take) break;
    if (taken.has(c.id)) {
      skipped += 1;
      continue;
    }
    try {
      await enrollClient({ clientId: c.id, campaignCode: campaign.code, actor: "auto" });
      enrolled += 1;
    } catch {
      skipped += 1;
    }
  }
  return { enrolled, skipped };
}

// ------------------------------------------------------------------
// AI персонализация
// ------------------------------------------------------------------
async function aiCompose(name: string, context: string, offer: string, step: number) {
  const res = await aiChatCompletions({
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content:
          'Ти пишеш кратки, топли и професионални имейли на български за агенция за недвижими имоти „Имоти Надежда“. Отговаряш само с валиден JSON: {"subject":"...","body":"..."}.',
      },
      {
        role: "user",
        content: `Напиши имейл за реактивиране на стар клиент (стъпка ${step} от кампания).
Име: ${name}
Контекст: ${context || "стар контакт без активност"}
Оферта/повод: ${offer || "нови оферти и актуални цени"}
До 120 думи, без агресивна продажба, с ясен въпрос в края.`,
      },
    ],
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const json = (await res.json()) as any;
  const raw = String(json?.choices?.[0]?.message?.content ?? "").trim();
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const parsed = JSON.parse(cleaned) as { subject?: string; body?: string };
  const model = String(json?.model ?? "");
  if (!parsed.body) throw new Error("AI не върна текст.");
  return { subject: parsed.subject ?? `Още ли търсите имот, ${name}?`, body: parsed.body, model };
}

export async function generateAiSummary(enrollmentId: string, actor?: string | null) {
  const { data: en } = await db()
    .from("reactivation_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!en) throw new Error("Записът не е намерен.");
  const { data: client } = await db()
    .from("clients")
    .select("full_name, client_type, notes, deposit_amount, interest_property_id, updated_at")
    .eq("id", en.client_id)
    .maybeSingle();
  const res = await aiChatCompletions({
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          "Ти си CRM аналитик на българска агенция за имоти. Пишеш кратки препоръки на български (до 60 думи).",
      },
      {
        role: "user",
        content: `Клиент: ${client?.full_name ?? en.contact_name}
Тип: ${client?.client_type ?? "—"}
Неактивен дни: ${en.inactive_days ?? "—"}
Депозит: ${client?.deposit_amount ?? "няма"}
Харесал имот: ${client?.interest_property_id ? "да" : "не"}
Бележки: ${client?.notes ?? "—"}

Дай препоръка как да го реактивираме и с какъв канал/повод.`,
      },
    ],
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const json = (await res.json()) as any;
  const summary = String(json?.choices?.[0]?.message?.content ?? "").trim();
  if (!summary) throw new Error("AI не върна отговор.");
  const { data, error } = await db()
    .from("reactivation_enrollments")
    .update({
      ai_summary: summary,
      ai_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(
    enrollmentId,
    en.client_id,
    en.campaign_code,
    "ai_summary",
    "ok",
    summary.slice(0, 200),
    actor,
  );
  return data;
}

// ------------------------------------------------------------------
// Изпращане на стъпка
// ------------------------------------------------------------------
export async function sendNextStep(enrollmentId: string, actor?: string | null) {
  const settings = await getReactivationSettings();
  const { data: en } = await db()
    .from("reactivation_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!en) throw new Error("Записът не е намерен.");
  if (en.status === "opted_out") throw new Error("Клиентът е отказал комуникация.");
  if (en.status === "revived") throw new Error("Клиентът вече е реактивиран.");

  const campaign = (await campaignByCode(en.campaign_code)) ?? {
    max_steps: 3,
    step_gap_days: 5,
    offer_text: null,
  };
  const step = Number(en.step_no ?? 0) + 1;
  if (step > Number(campaign.max_steps ?? 3)) {
    await db()
      .from("reactivation_enrollments")
      .update({ status: "exhausted", updated_at: new Date().toISOString() })
      .eq("id", en.id);
    await logEvent(
      en.id,
      en.client_id,
      en.campaign_code,
      "exhausted",
      "ok",
      "изчерпани стъпки",
      actor,
    );
    return { skipped: true, reason: "exhausted" };
  }

  const channel = en.channel ?? "email";
  const name = en.contact_name ?? "клиент";
  const template = await pickTemplate(en.campaign_code, step, channel);
  const offer = campaign.offer_text ?? "";

  if (channel !== "email") {
    // Обаждане / SMS — записваме задача за брокера, без автоматично изпращане.
    await db()
      .from("reactivation_messages")
      .insert({
        enrollment_id: en.id,
        client_id: en.client_id,
        campaign_code: en.campaign_code,
        step_no: step,
        channel,
        subject: template?.subject ?? null,
        body: fillTemplate(template?.body ?? offer, {
          name,
          offer,
          search_summary: en.score_reason ?? "",
        }),
        recipient: en.contact_phone,
        status: "queued",
      });
    await db()
      .from("reactivation_enrollments")
      .update({
        step_no: step,
        last_sent_at: new Date().toISOString(),
        next_action_at: new Date(
          Date.now() + Number(campaign.step_gap_days ?? 5) * 86_400_000,
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", en.id);
    await logEvent(
      en.id,
      en.client_id,
      en.campaign_code,
      "task_queued",
      "ok",
      `${channel} · стъпка ${step}`,
      actor,
    );
    return { queued: true, step };
  }

  if (!en.contact_email) throw new Error("Липсва имейл за реактивиране.");

  let subject = fillTemplate(template?.subject ?? `Още ли търсите имот, ${name}?`, {
    name,
    offer,
    count: "3",
    search_summary: en.score_reason ?? "",
  });
  let body = fillTemplate(
    template?.body ?? `Здравейте, ${name},\n\n${offer}\n\nЕкип „Имоти Надежда“`,
    {
      name,
      offer,
      count: "3",
      search_summary: en.score_reason ?? "предпочитания район",
    },
  );
  let aiUsed = false;
  let model: string | null = null;

  if (settings.ai_enabled) {
    try {
      const ai = await aiCompose(
        name,
        `${en.campaign_code} · неактивен ${en.inactive_days ?? "?"} дни · ${en.score_reason ?? ""}`,
        offer,
        step,
      );
      subject = ai.subject;
      body = ai.body;
      aiUsed = true;
      model = ai.model;
    } catch (e) {
      await logEvent(
        en.id,
        en.client_id,
        en.campaign_code,
        "ai_compose",
        "warn",
        (e as Error).message,
        actor,
      );
    }
  }

  const { data: msg, error: msgErr } = await db()
    .from("reactivation_messages")
    .insert({
      enrollment_id: en.id,
      client_id: en.client_id,
      campaign_code: en.campaign_code,
      step_no: step,
      channel: "email",
      subject,
      body,
      recipient: en.contact_email,
      status: "queued",
      ai_used: aiUsed,
      model,
    })
    .select("*")
    .single();
  if (msgErr) throw new Error(msgErr.message);

  const footer = `\n\n—\nАко не желаете повече съобщения: ${optOutLink(msg.token)}`;
  try {
    await sendTransactionalEmail({
      to: en.contact_email,
      subject,
      text: `${body}${footer}`,
      purpose: "client_reactivation",
      label: `${en.campaign_code}:${step}`,
      idempotency_key: `react-${en.id}-${step}`,
    });
  } catch (e) {
    await db()
      .from("reactivation_messages")
      .update({ status: "failed", error: (e as Error).message })
      .eq("id", msg.id);
    await db()
      .from("reactivation_enrollments")
      .update({
        attempts: Number(en.attempts ?? 0) + 1,
        error: (e as Error).message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", en.id);
    await logEvent(
      en.id,
      en.client_id,
      en.campaign_code,
      "send",
      "error",
      (e as Error).message,
      actor,
    );
    throw e;
  }

  await db().from("reactivation_messages").update({ status: "sent", error: null }).eq("id", msg.id);
  const nextAt = new Date(
    Date.now() + Number(campaign.step_gap_days ?? 5) * 86_400_000,
  ).toISOString();
  const { data: updated } = await db()
    .from("reactivation_enrollments")
    .update({
      step_no: step,
      last_sent_at: new Date().toISOString(),
      next_action_at: nextAt,
      attempts: Number(en.attempts ?? 0) + 1,
      error: null,
      status: step >= Number(campaign.max_steps ?? 3) ? "exhausted" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", en.id)
    .select("*")
    .single();
  await logEvent(
    en.id,
    en.client_id,
    en.campaign_code,
    "send",
    "ok",
    `стъпка ${step} · ${en.contact_email}`,
    actor,
  );
  return updated;
}

// ------------------------------------------------------------------
// Статуси
// ------------------------------------------------------------------
export async function markRevived(
  enrollmentId: string,
  reason?: string | null,
  actor?: string | null,
) {
  const { data, error } = await db()
    .from("reactivation_enrollments")
    .update({
      status: "revived",
      revived_at: new Date().toISOString(),
      revived_reason: reason ?? "отговор от клиента",
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(
    enrollmentId,
    data?.client_id ?? null,
    data?.campaign_code ?? null,
    "revived",
    "ok",
    reason ?? null,
    actor,
  );
  return data;
}

export async function setEnrollmentStatus(
  enrollmentId: string,
  status: string,
  actor?: string | null,
) {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "opted_out") patch["opted_out_at"] = new Date().toISOString();
  const { data, error } = await db()
    .from("reactivation_enrollments")
    .update(patch)
    .eq("id", enrollmentId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(
    enrollmentId,
    data?.client_id ?? null,
    data?.campaign_code ?? null,
    "status",
    "ok",
    status,
    actor,
  );
  return data;
}

export async function optOutByToken(token: string) {
  const { data: msg } = await db()
    .from("reactivation_messages")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!msg) return false;
  await db()
    .from("reactivation_enrollments")
    .update({
      status: "opted_out",
      opted_out_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", msg.enrollment_id);
  await logEvent(
    msg.enrollment_id,
    msg.client_id,
    msg.campaign_code,
    "opt_out",
    "ok",
    "чрез линк в имейла",
    "public",
  );
  return true;
}

export async function registerReply(
  enrollmentId: string,
  note?: string | null,
  actor?: string | null,
) {
  const settings = await getReactivationSettings();
  await db()
    .from("reactivation_messages")
    .update({ replied_at: new Date().toISOString() })
    .eq("enrollment_id", enrollmentId)
    .is("replied_at", null);
  await logEvent(enrollmentId, null, null, "reply", "ok", note ?? null, actor);
  if (settings.stop_on_reply)
    return markRevived(enrollmentId, note ?? "отговор на кампания", actor);
  return getEnrollment(enrollmentId);
}

export async function getEnrollment(id: string) {
  const { data } = await db()
    .from("reactivation_enrollments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

// ------------------------------------------------------------------
// Sweep (cron)
// ------------------------------------------------------------------
export async function runReactivationSweep(limit?: number) {
  const settings = await getReactivationSettings();
  if (!settings.enabled) return { skipped: true, reason: "disabled" };
  const job = await getReactivationJobState();
  if (job.paused) return { skipped: true, reason: "paused", paused_reason: job.paused_reason };
  if (inQuietHours(settings)) return { skipped: true, reason: "quiet_hours" };
  const got = await claimJob(settings.lease_seconds);
  if (!got) return { skipped: true, reason: "locked" };

  const stats = { enrolled: 0, sent: 0, queued: 0, failed: 0, skipped: 0 };
  try {
    if (settings.auto_enroll) {
      const res = await autoEnrollDormant();
      stats.enrolled = res.enrolled;
    }

    const take = Math.min(Math.max(limit ?? settings.batch_size, 1), 50);
    const { data: due } = await db()
      .from("reactivation_enrollments")
      .select("id, score")
      .eq("status", "active")
      .lte("next_action_at", new Date().toISOString())
      .gte("score", settings.min_score_to_send)
      .order("score", { ascending: false })
      .limit(take);

    let consecutiveErrors = 0;
    for (const row of due ?? []) {
      try {
        const res: any = await sendNextStep(row.id, "cron");
        if (res?.queued) stats.queued += 1;
        else if (res?.skipped) stats.skipped += 1;
        else stats.sent += 1;
        consecutiveErrors = 0;
      } catch (e) {
        stats.failed += 1;
        consecutiveErrors += 1;
        if (consecutiveErrors >= 3) {
          await pauseReactivationJob(`3 последователни грешки: ${(e as Error).message}`);
          break;
        }
      }
    }
    return stats;
  } finally {
    await releaseJob(stats);
  }
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------
export async function getReactivationAnalytics() {
  const [{ data: enrollments }, { data: messages }] = await Promise.all([
    db()
      .from("reactivation_enrollments")
      .select(
        "id, campaign_code, status, step_no, score, inactive_days, revived_at, created_at, channel",
      )
      .limit(3000),
    db()
      .from("reactivation_messages")
      .select("id, campaign_code, step_no, status, channel, replied_at, created_at")
      .limit(3000),
  ]);
  const ens = enrollments ?? [];
  const msgs = messages ?? [];
  const sent = msgs.filter((m: any) => m.status === "sent").length;
  const replied = msgs.filter((m: any) => m.replied_at).length;
  const revived = ens.filter((e: any) => e.status === "revived").length;
  const optedOut = ens.filter((e: any) => e.status === "opted_out").length;
  const byCampaign: Record<string, { total: number; revived: number; sent: number }> = {};
  for (const e of ens) {
    const key = String(e.campaign_code ?? "—");
    const cur = byCampaign[key] ?? { total: 0, revived: 0, sent: 0 };
    cur.total += 1;
    if (e.status === "revived") cur.revived += 1;
    byCampaign[key] = cur;
  }
  for (const m of msgs) {
    const key = String(m.campaign_code ?? "—");
    const cur = byCampaign[key] ?? { total: 0, revived: 0, sent: 0 };
    if (m.status === "sent") cur.sent += 1;
    byCampaign[key] = cur;
  }
  const scores = ens
    .map((e: any) => Number(e.score ?? 0))
    .filter((n: number) => Number.isFinite(n));
  return {
    enrollments_total: ens.length,
    active: ens.filter((e: any) => e.status === "active").length,
    revived,
    opted_out: optedOut,
    exhausted: ens.filter((e: any) => e.status === "exhausted").length,
    failed: ens.filter((e: any) => e.status === "failed").length,
    messages_total: msgs.length,
    sent,
    queued: msgs.filter((m: any) => m.status === "queued").length,
    replied,
    reply_rate: sent ? Math.round((replied / sent) * 100) : 0,
    revive_rate: ens.length ? Math.round((revived / ens.length) * 100) : 0,
    opt_out_rate: ens.length ? Math.round((optedOut / ens.length) * 100) : 0,
    avg_score: scores.length
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 0,
    avg_inactive_days: ens.length
      ? Math.round(
          ens.reduce((a: number, e: any) => a + Number(e.inactive_days ?? 0), 0) / ens.length,
        )
      : 0,
    by_campaign: byCampaign,
    by_step: [1, 2, 3, 4, 5].reduce<Record<string, number>>((acc, n) => {
      acc[String(n)] = msgs.filter((m: any) => Number(m.step_no) === n).length;
      return acc;
    }, {}),
  };
}
