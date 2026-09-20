// Автоматизация №5 — Follow-Up автоматизация: последващи контакти и реактивация.
// Без зависимост от Lovable: Supabase + конфигуриран AI провайдър + собствен email слой.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions, listAiProviders } from "@/lib/ai-provider";
import { sendTransactionalEmail } from "@/lib/send-email";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

export const SITE_URL = "https://imotinadezhda.bg";
const JOB_KEY = "followup_sweep";

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type FollowupSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  batch_size: number;
  max_steps: number;
  min_hours_between: number;
  stop_on_reply: boolean;
  auto_enroll_no_response: boolean;
  auto_enroll_after_send: boolean;
  auto_enroll_dormant: boolean;
  dormant_days: number;
  reactivation_limit_per_run: number;
  lease_seconds: number;
};

export const DEFAULT_FOLLOWUP: FollowupSettings = {
  enabled: true,
  ai_enabled: true,
  batch_size: 25,
  max_steps: 5,
  min_hours_between: 20,
  stop_on_reply: true,
  auto_enroll_no_response: true,
  auto_enroll_after_send: true,
  auto_enroll_dormant: true,
  dormant_days: 90,
  reactivation_limit_per_run: 10,
  lease_seconds: 300,
};

export async function getFollowupSettings(): Promise<FollowupSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", "followup")
    .maybeSingle();
  return { ...DEFAULT_FOLLOWUP, ...((data?.value ?? {}) as Partial<FollowupSettings>) };
}

export async function saveFollowupSettings(
  patch: Partial<FollowupSettings>,
): Promise<FollowupSettings> {
  const next = { ...(await getFollowupSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: "followup", value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

// ------------------------------------------------------------------
// Състояние на фоновата задача (lease + circuit breaker)
// ------------------------------------------------------------------
export type JobState = {
  key: string;
  paused: boolean;
  paused_reason: string | null;
  paused_at: string | null;
  last_run_at: string | null;
  locked_until: string | null;
  stats: Record<string, number | string | boolean | null>;
};

export async function getJobState(key = JOB_KEY): Promise<JobState> {
  const { data } = await db().from("automation_jobs").select("*").eq("key", key).maybeSingle();
  return {
    key,
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

export async function pauseJob(reason: string) {
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

export async function resumeJob() {
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
  return getJobState();
}

// ------------------------------------------------------------------
// Помощни
// ------------------------------------------------------------------
const esc = (s: string) =>
  s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? "");
}

function token(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function inQuietHours(seq: { quiet_start: number; quiet_end: number }): boolean {
  // Работим по локално време София (UTC+3 през активния сезон, UTC+2 иначе).
  const now = new Date();
  const sofiaHour = Number(
    new Intl.DateTimeFormat("bg-BG", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Sofia",
    }).format(now),
  );
  const start = seq.quiet_start ?? 21;
  const end = seq.quiet_end ?? 8;
  return start > end
    ? sofiaHour >= start || sofiaHour < end
    : sofiaHour >= start && sofiaHour < end;
}

async function logEvent(leadId: string, type: string, detail: string, payload?: unknown) {
  await db()
    .from("lead_events")
    .insert({
      lead_id: leadId,
      event_type: type,
      detail,
      payload: payload ?? null,
      actor: "followup",
    });
}

/** AI шлиф на текста; при 402/403 спира цялата автоматизация (circuit breaker). */
async function personalize(
  body: string,
  lead: Record<string, any>,
  seqName: string,
): Promise<{ text: string; ai_used: boolean; model: string | null; blocked?: string }> {
  if (listAiProviders().length === 0) return { text: body, ai_used: false, model: null };
  try {
    const res = await aiChatCompletions({
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "Ти си опитен български брокер на недвижими имоти. Пренапиши подадения follow-up имейл — учтиво, кратко (до 130 думи), персонално, без емоджи, без обещания за цени. Запази смисъла и подписа. Върни само текста на имейла.",
        },
        {
          role: "user",
          content: `Последователност: ${seqName}\nКлиент: ${lead.full_name ?? "—"}\nТип: ${lead.lead_type ?? "—"}\nГрад: ${lead.desired_city ?? "—"}\nБюджет: ${lead.budget_min ?? "—"}–${lead.budget_max ?? "—"} ${lead.currency ?? "EUR"}\nЗапитване: ${lead.message ?? "—"}\n\nЧернова:\n${body}`,
        },
      ],
    });
    if (!res.ok) {
      if (res.status === 402 || res.status === 403) {
        const msg = (await res.text()).slice(0, 400);
        return {
          text: body,
          ai_used: false,
          model: null,
          blocked: `AI е блокиран (HTTP ${res.status}): ${msg}`,
        };
      }
      return { text: body, ai_used: false, model: null };
    }
    const json = (await res.json()) as any;
    const out = String(json?.choices?.[0]?.message?.content ?? "").trim();
    return out.length > 40
      ? { text: out, ai_used: true, model: json?.model ?? null }
      : { text: body, ai_used: false, model: null };
  } catch {
    return { text: body, ai_used: false, model: null };
  }
}

// ------------------------------------------------------------------
// Записване в последователност
// ------------------------------------------------------------------
export async function listSequences() {
  const { data, error } = await db()
    .from("followup_sequences")
    .select("*, followup_steps(*)")
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((s: any) => ({
    ...s,
    followup_steps: [...(s.followup_steps ?? [])].sort((a: any, b: any) => a.step_no - b.step_no),
  }));
}

async function pickSequence(trigger: string, leadType: string | null, status: string | null) {
  const { data } = await db()
    .from("followup_sequences")
    .select("*")
    .eq("trigger_type", trigger)
    .eq("is_active", true)
    .order("priority", { ascending: true });
  const rows = (data ?? []) as any[];
  return (
    rows.find((s) => (s.lead_type ?? null) === leadType && (s.target_status ?? null) === status) ??
    rows.find((s) => (s.lead_type ?? null) === leadType) ??
    rows.find((s) => !s.lead_type) ??
    null
  );
}

export async function enrollLead(
  leadId: string,
  opts: { trigger?: string; sequenceId?: string; reason?: string } = {},
): Promise<{ enrolled: boolean; reason?: string; enrollment_id?: string }> {
  const { data: lead } = await db().from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return { enrolled: false, reason: "Няма такъв лийд" };
  if (lead.followup_opt_out) return { enrolled: false, reason: "Клиентът е отписан" };
  if (["converted", "lost", "spam"].includes(String(lead.status)))
    return { enrolled: false, reason: `Статус ${lead.status}` };

  const seq = opts.sequenceId
    ? (await db().from("followup_sequences").select("*").eq("id", opts.sequenceId).maybeSingle())
        .data
    : await pickSequence(
        opts.trigger ?? "no_response",
        lead.lead_type ?? null,
        lead.status ?? null,
      );
  if (!seq) return { enrolled: false, reason: "Няма подходяща последователност" };

  const { data: existing } = await db()
    .from("followup_enrollments")
    .select("id, status")
    .eq("lead_id", leadId)
    .eq("sequence_id", seq.id)
    .maybeSingle();
  if (existing && existing.status === "active")
    return { enrolled: false, reason: "Вече е записан", enrollment_id: existing.id };

  const firstStep = (
    await db()
      .from("followup_steps")
      .select("delay_hours")
      .eq("sequence_id", seq.id)
      .eq("is_active", true)
      .order("step_no")
      .limit(1)
  ).data?.[0];
  if (!firstStep) return { enrolled: false, reason: "Последователността няма стъпки" };

  const nextRun = new Date(
    Date.now() + Number(firstStep.delay_hours ?? 24) * 3600_000,
  ).toISOString();
  const payload = {
    lead_id: leadId,
    sequence_id: seq.id,
    status: "active",
    current_step: 0,
    next_run_at: nextRun,
    reason: opts.reason ?? opts.trigger ?? "manual",
    stop_reason: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
  };
  const { data: row, error } = await db()
    .from("followup_enrollments")
    .upsert(payload, { onConflict: "lead_id,sequence_id" })
    .select("id")
    .maybeSingle();
  if (error) return { enrolled: false, reason: error.message };

  await logEvent(leadId, "followup_enrolled", `Записан в „${seq.name}“ (${payload.reason})`);
  return { enrolled: true, enrollment_id: row?.id as string };
}

export async function stopEnrollment(enrollmentId: string, reason: string) {
  const { data: e } = await db()
    .from("followup_enrollments")
    .select("lead_id")
    .eq("id", enrollmentId)
    .maybeSingle();
  await db()
    .from("followup_enrollments")
    .update({ status: "stopped", stop_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", enrollmentId);
  if (e?.lead_id) await logEvent(e.lead_id as string, "followup_stopped", reason);
  return { ok: true };
}

/** Отговор/активност от клиента → спира активните последователности. */
export async function registerLeadActivity(leadId: string, kind: string) {
  const now = new Date().toISOString();
  await db().from("leads").update({ last_activity_at: now, updated_at: now }).eq("id", leadId);
  const settings = await getFollowupSettings();
  if (!settings.stop_on_reply) return { stopped: 0 };
  const { data: rows } = await db()
    .from("followup_enrollments")
    .select("id, sequence_id, followup_sequences:sequence_id(stop_on_reply)")
    .eq("lead_id", leadId)
    .eq("status", "active");
  let stopped = 0;
  for (const r of (rows ?? []) as any[]) {
    if (r.followup_sequences?.stop_on_reply === false) continue;
    await stopEnrollment(r.id as string, `Активност от клиента: ${kind}`);
    stopped++;
  }
  return { stopped };
}

export async function optOutByToken(tok: string) {
  const { data: msg } = await db()
    .from("followup_messages")
    .select("id, lead_id")
    .eq("token", tok)
    .maybeSingle();
  if (!msg) return { ok: false };
  const now = new Date().toISOString();
  await db()
    .from("leads")
    .update({ followup_opt_out: true, updated_at: now })
    .eq("id", msg.lead_id);
  const { data: rows } = await db()
    .from("followup_enrollments")
    .select("id")
    .eq("lead_id", msg.lead_id)
    .eq("status", "active");
  for (const r of (rows ?? []) as any[]) await stopEnrollment(r.id as string, "Клиентът се отписа");
  await logEvent(msg.lead_id as string, "followup_opt_out", "Отписване от follow-up имейли");
  return { ok: true };
}

export async function trackMessage(tok: string, action: "open" | "click" | "reply") {
  const { data: msg } = await db()
    .from("followup_messages")
    .select("id, lead_id")
    .eq("token", tok)
    .maybeSingle();
  if (!msg) return { ok: false };
  const now = new Date().toISOString();
  const patch =
    action === "open"
      ? { opened_at: now }
      : action === "click"
        ? { clicked_at: now, opened_at: now }
        : { replied_at: now };
  await db().from("followup_messages").update(patch).eq("id", msg.id);
  if (action !== "open")
    await registerLeadActivity(
      msg.lead_id as string,
      action === "click" ? "клик в имейл" : "отговор",
    );
  return { ok: true, lead_id: msg.lead_id as string };
}

// ------------------------------------------------------------------
// Изпращане на една стъпка
// ------------------------------------------------------------------
export type StepResult = "sent" | "manual" | "failed" | "skipped" | "completed" | "blocked";

export async function runEnrollmentStep(
  enrollmentId: string,
  opts: { force?: boolean } = {},
): Promise<{ result: StepResult; detail?: string }> {
  const settings = await getFollowupSettings();
  const { data: enr } = await db()
    .from("followup_enrollments")
    .select("*, leads:lead_id(*), followup_sequences:sequence_id(*)")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!enr) return { result: "skipped", detail: "Няма такова записване" };
  if (enr.status !== "active") return { result: "skipped", detail: `Статус ${enr.status}` };

  const lead = enr.leads as any;
  const seq = enr.followup_sequences as any;
  if (!lead || !seq) return { result: "skipped", detail: "Липсва лийд или последователност" };
  if (lead.followup_opt_out) {
    await stopEnrollment(enrollmentId, "Клиентът е отписан");
    return { result: "skipped", detail: "Отписан" };
  }
  if (["converted", "lost", "spam"].includes(String(lead.status))) {
    await stopEnrollment(enrollmentId, `Статус на лийда: ${lead.status}`);
    return { result: "skipped", detail: "Затворен лийд" };
  }
  if (!opts.force && inQuietHours(seq)) return { result: "skipped", detail: "Тихи часове" };
  if (
    !opts.force &&
    lead.last_followup_at &&
    Date.now() - new Date(lead.last_followup_at as string).getTime() <
      settings.min_hours_between * 3600_000
  ) {
    return { result: "skipped", detail: "Твърде скоро след предишен follow-up" };
  }

  const nextNo = Number(enr.current_step ?? 0) + 1;
  if (nextNo > settings.max_steps) {
    await db()
      .from("followup_enrollments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", enrollmentId);
    return { result: "completed", detail: "Достигнат лимит на стъпките" };
  }

  const { data: step } = await db()
    .from("followup_steps")
    .select("*")
    .eq("sequence_id", seq.id)
    .eq("step_no", nextNo)
    .eq("is_active", true)
    .maybeSingle();
  if (!step) {
    await db()
      .from("followup_enrollments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", enrollmentId);
    await logEvent(lead.id, "followup_completed", `Последователността „${seq.name}“ е завършена`);
    return { result: "completed" };
  }

  // Идемпотентност: същата стъпка не се изпраща втори път.
  const { data: dup } = await db()
    .from("followup_messages")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .eq("step_no", nextNo)
    .in("status", ["sent", "manual"])
    .limit(1);
  if (dup?.length) {
    await advance(enrollmentId, seq.id, nextNo);
    return { result: "skipped", detail: "Стъпката вече е изпратена" };
  }

  const vars = {
    name: String(lead.full_name ?? "").split(" ")[0] || "клиент",
    full_name: String(lead.full_name ?? ""),
    city: String(lead.desired_city ?? ""),
    sequence: String(seq.name ?? ""),
  };
  let body = fill(String(step.body), vars);
  const subject = fill(String(step.subject ?? `Имоти Надежда — ${seq.name}`), vars);
  let ai_used = false;
  let model: string | null = null;

  if (settings.ai_enabled && seq.ai_personalize && step.channel === "email") {
    const p = await personalize(body, lead, String(seq.name));
    if (p.blocked) {
      await pauseJob(p.blocked);
      return { result: "blocked", detail: p.blocked };
    }
    body = p.text;
    ai_used = p.ai_used;
    model = p.model;
  }

  const tok = token();
  const optOutUrl = `${SITE_URL}/api/public/followup/track?token=${tok}&action=opt_out`;
  const replyUrl = `${SITE_URL}/api/public/followup/track?token=${tok}&action=interested`;
  const channel = String(step.channel ?? seq.channel ?? "email");

  const { data: msg, error: msgErr } = await db()
    .from("followup_messages")
    .insert({
      enrollment_id: enrollmentId,
      lead_id: lead.id,
      sequence_id: seq.id,
      step_id: step.id,
      step_no: nextNo,
      channel,
      subject,
      body,
      status: "pending",
      token: tok,
      ai_used,
      model,
      scheduled_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (msgErr || !msg) return { result: "failed", detail: msgErr?.message ?? "Грешка при запис" };

  if (channel !== "email" || !lead.email) {
    await db().from("followup_messages").update({ status: "manual" }).eq("id", msg.id);
    await logEvent(
      lead.id,
      "followup_manual",
      `Стъпка ${nextNo} по ${channel} — подготвена за ръчно изпращане`,
    );
    await advance(enrollmentId, seq.id, nextNo);
    return { result: "manual" };
  }

  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#3a2a2e;white-space:pre-wrap">${esc(body)}</div>
<p style="margin-top:22px"><a href="${replyUrl}" style="background:#8b1a2b;color:#f7e3c0;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-family:system-ui,sans-serif">Да, интересува ме</a></p>
<p style="font-size:12px;color:#8a7c7f;font-family:system-ui,sans-serif;margin-top:18px">Ако не желаете повече съобщения — <a href="${optOutUrl}" style="color:#8b1a2b">отпишете се тук</a>.</p>
<img src="${SITE_URL}/api/public/followup/track?token=${tok}&action=open" width="1" height="1" alt="" style="display:none"/>`;

  try {
    await sendTransactionalEmail({
      to: String(lead.email),
      subject,
      text: `${body}\n\nОтписване: ${optOutUrl}`,
      html,
      purpose: "followup_sequence",
      label: `followup-step-${nextNo}`,
      idempotency_key: msg.id as string,
      unsubscribe_token: tok,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await db()
      .from("followup_messages")
      .update({ status: "failed", error: detail })
      .eq("id", msg.id);
    await logEvent(lead.id, "followup_failed", detail);
    return { result: "failed", detail };
  }

  const now = new Date().toISOString();
  await db().from("followup_messages").update({ status: "sent", sent_at: now }).eq("id", msg.id);
  await db()
    .from("leads")
    .update({
      last_followup_at: now,
      followup_count: Number(lead.followup_count ?? 0) + 1,
      updated_at: now,
      status: lead.status === "new" ? "contacted" : lead.status,
    })
    .eq("id", lead.id);
  await logEvent(lead.id, "followup_sent", `Стъпка ${nextNo} от „${seq.name}“ изпратена по имейл`);
  await advance(enrollmentId, seq.id, nextNo);
  return { result: "sent" };
}

async function advance(enrollmentId: string, sequenceId: string, doneStep: number) {
  const { data: next } = await db()
    .from("followup_steps")
    .select("delay_hours")
    .eq("sequence_id", sequenceId)
    .eq("is_active", true)
    .gt("step_no", doneStep)
    .order("step_no")
    .limit(1);
  const step = (next ?? [])[0];
  if (!step) {
    await db()
      .from("followup_enrollments")
      .update({
        current_step: doneStep,
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", enrollmentId);
    return;
  }
  await db()
    .from("followup_enrollments")
    .update({
      current_step: doneStep,
      next_run_at: new Date(Date.now() + Number(step.delay_hours ?? 24) * 3600_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId);
}

// ------------------------------------------------------------------
// Автоматично записване
// ------------------------------------------------------------------
async function autoEnroll(settings: FollowupSettings): Promise<number> {
  let enrolled = 0;
  const iso = (ms: number) => new Date(Date.now() - ms).toISOString();

  if (settings.auto_enroll_no_response) {
    const { data } = await db()
      .from("leads")
      .select("id")
      .eq("followup_opt_out", false)
      .in("status", ["new", "contacted"])
      .is("last_activity_at", null)
      .lte("created_at", iso(24 * 3600_000))
      .limit(settings.batch_size);
    for (const l of (data ?? []) as any[]) {
      const r = await enrollLead(l.id as string, {
        trigger: "no_response",
        reason: "Няма отговор над 24ч",
      });
      if (r.enrolled) enrolled++;
    }
  }

  if (settings.auto_enroll_after_send) {
    const { data } = await db()
      .from("leads")
      .select("id, last_match_sent_at")
      .eq("followup_opt_out", false)
      .not("last_match_sent_at", "is", null)
      .lte("last_match_sent_at", iso(48 * 3600_000))
      .limit(settings.batch_size);
    for (const l of (data ?? []) as any[]) {
      const r = await enrollLead(l.id as string, {
        trigger: "after_send",
        reason: "Изпратен подбор без реакция",
      });
      if (r.enrolled) enrolled++;
    }
  }

  if (settings.auto_enroll_dormant) {
    const cutoff = iso(settings.dormant_days * 86400_000);
    const { data } = await db()
      .from("leads")
      .select("id")
      .eq("followup_opt_out", false)
      .in("status", ["contacted", "qualified"])
      .lte("updated_at", cutoff)
      .limit(settings.reactivation_limit_per_run);
    for (const l of (data ?? []) as any[]) {
      const r = await enrollLead(l.id as string, {
        trigger: "dormant",
        reason: `Без активност над ${settings.dormant_days} дни`,
      });
      if (r.enrolled) {
        enrolled++;
        await db()
          .from("leads")
          .update({ reactivated_at: new Date().toISOString() })
          .eq("id", l.id);
      }
    }
  }

  return enrolled;
}

// ------------------------------------------------------------------
// Cron: обработка на дължимите стъпки
// ------------------------------------------------------------------
export async function runFollowupSweep(
  limitOverride?: number,
): Promise<{
  ran: boolean;
  reason?: string;
  enrolled: number;
  processed: number;
  sent: number;
  manual: number;
  failed: number;
  skipped: number;
  completed: number;
  paused?: boolean;
}> {
  const settings = await getFollowupSettings();
  const empty = {
    enrolled: 0,
    processed: 0,
    sent: 0,
    manual: 0,
    failed: 0,
    skipped: 0,
    completed: 0,
  };
  if (!settings.enabled) return { ran: false, reason: "Автоматизацията е изключена", ...empty };

  const state = await getJobState();
  const probeOnly = state.paused;

  if (!(await claimJob(settings.lease_seconds))) {
    return { ran: false, reason: "Друг цикъл вече работи", ...empty };
  }

  const limit = Math.min(Math.max(limitOverride ?? settings.batch_size, 1), 100);
  const stats = { ...empty };
  try {
    if (!probeOnly) stats.enrolled = await autoEnroll(settings);

    const { data: due } = await db()
      .from("followup_enrollments")
      .select("id")
      .eq("status", "active")
      .lte("next_run_at", new Date().toISOString())
      .order("next_run_at", { ascending: true })
      .limit(probeOnly ? 1 : limit);

    for (const e of (due ?? []) as any[]) {
      stats.processed++;
      const r = await runEnrollmentStep(e.id as string);
      if (r.result === "sent") stats.sent++;
      else if (r.result === "manual") stats.manual++;
      else if (r.result === "failed") stats.failed++;
      else if (r.result === "completed") stats.completed++;
      else if (r.result === "blocked") {
        await releaseJob({ ...stats, blocked: r.detail ?? null, at: new Date().toISOString() });
        return { ran: true, reason: r.detail, paused: true, ...stats };
      } else stats.skipped++;
    }

    if (probeOnly && stats.sent > 0) await resumeJob();
    await releaseJob({ ...stats, at: new Date().toISOString(), probe: probeOnly });
    return {
      ran: true,
      reason: probeOnly ? "Пробен цикъл (автоматизацията е на пауза)" : undefined,
      ...stats,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await releaseJob({ ...stats, error: detail, at: new Date().toISOString() });
    throw new Error(detail);
  }
}

// ------------------------------------------------------------------
// Аналитика
// ------------------------------------------------------------------
export async function followupAnalytics() {
  const [{ data: msgs }, { data: enrs }] = await Promise.all([
    db()
      .from("followup_messages")
      .select(
        "status, step_no, sent_at, opened_at, clicked_at, replied_at, ai_used, created_at, sequence_id",
      )
      .limit(5000),
    db()
      .from("followup_enrollments")
      .select("status, current_step, created_at, sequence_id, reason")
      .limit(5000),
  ]);
  const m = (msgs ?? []) as any[];
  const e = (enrs ?? []) as any[];
  const sent = m.filter((r) => r.status === "sent");
  const opened = sent.filter((r) => r.opened_at).length;
  const clicked = sent.filter((r) => r.clicked_at).length;
  const replied = sent.filter((r) => r.replied_at).length;
  const week = Date.now() - 7 * 86400_000;

  const byStep: Record<string, number> = {};
  for (const r of sent) byStep[`step_${r.step_no}`] = (byStep[`step_${r.step_no}`] ?? 0) + 1;
  const byStatus: Record<string, number> = {};
  for (const r of e) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const byReason: Record<string, number> = {};
  for (const r of e)
    byReason[String(r.reason ?? "—")] = (byReason[String(r.reason ?? "—")] ?? 0) + 1;

  const { data: reactivated } = await db()
    .from("leads")
    .select("id")
    .not("reactivated_at", "is", null)
    .limit(2000);

  return {
    enrollments: e.length,
    active: byStatus["active"] ?? 0,
    completed: byStatus["completed"] ?? 0,
    stopped: byStatus["stopped"] ?? 0,
    messages: m.length,
    sent: sent.length,
    sentThisWeek: sent.filter((r) => new Date(r.created_at).getTime() >= week).length,
    manual: m.filter((r) => r.status === "manual").length,
    failed: m.filter((r) => r.status === "failed").length,
    openRate: sent.length ? Math.round((opened / sent.length) * 100) : 0,
    clickRate: sent.length ? Math.round((clicked / sent.length) * 100) : 0,
    replyRate: sent.length ? Math.round((replied / sent.length) * 100) : 0,
    aiUsedPct: sent.length
      ? Math.round((sent.filter((r) => r.ai_used).length / sent.length) * 100)
      : 0,
    reactivated: (reactivated ?? []).length,
    byStep,
    byStatus,
    byReason,
  };
}
