// Автоматизация №6 — Насрочване на огледи: календар, покани, напомняния, обратна връзка.
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
const JOB_KEY = "viewings_sweep";
const TZ = "Europe/Sofia";

// ------------------------------------------------------------------
// Настройки
// ------------------------------------------------------------------
export type ViewingSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  batch_size: number;
  send_invite: boolean;
  reminder_24h: boolean;
  reminder_2h: boolean;
  feedback_request: boolean;
  agent_brief: boolean;
  feedback_delay_hours: number;
  auto_no_show_hours: number;
  min_lead_hours: number;
  slot_days_ahead: number;
  quiet_start: number;
  quiet_end: number;
  lease_seconds: number;
};

export const DEFAULT_VIEWINGS: ViewingSettings = {
  enabled: true,
  ai_enabled: true,
  batch_size: 25,
  send_invite: true,
  reminder_24h: true,
  reminder_2h: true,
  feedback_request: true,
  agent_brief: true,
  feedback_delay_hours: 3,
  auto_no_show_hours: 24,
  min_lead_hours: 3,
  slot_days_ahead: 10,
  quiet_start: 21,
  quiet_end: 8,
  lease_seconds: 300,
};

export async function getViewingSettings(): Promise<ViewingSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", "viewings")
    .maybeSingle();
  return { ...DEFAULT_VIEWINGS, ...((data?.value ?? {}) as Partial<ViewingSettings>) };
}

export async function saveViewingSettings(
  patch: Partial<ViewingSettings>,
): Promise<ViewingSettings> {
  const next = { ...(await getViewingSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert(
      { key: "viewings", value: next, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
  return next;
}

// ------------------------------------------------------------------
// Състояние на фоновата задача
// ------------------------------------------------------------------
export type ViewingJobState = {
  key: string;
  paused: boolean;
  paused_reason: string | null;
  paused_at: string | null;
  last_run_at: string | null;
  locked_until: string | null;
  stats: Record<string, number | string | boolean | null>;
};

export async function getViewingJobState(): Promise<ViewingJobState> {
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

export async function pauseViewingJob(reason: string) {
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

export async function resumeViewingJob() {
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
  return getViewingJobState();
}

// ------------------------------------------------------------------
// Помощни
// ------------------------------------------------------------------
const esc = (s: string) =>
  s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string);

function token(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function formatSofia(iso: string): string {
  return new Intl.DateTimeFormat("bg-BG", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function sofiaHourNow(): number {
  return Number(
    new Intl.DateTimeFormat("bg-BG", { hour: "numeric", hour12: false, timeZone: TZ }).format(
      new Date(),
    ),
  );
}

function inQuietHours(s: ViewingSettings): boolean {
  const h = sofiaHourNow();
  return s.quiet_start > s.quiet_end
    ? h >= s.quiet_start || h < s.quiet_end
    : h >= s.quiet_start && h < s.quiet_end;
}

async function logEvent(leadId: string | null, type: string, detail: string, payload?: unknown) {
  if (!leadId) return;
  await db()
    .from("lead_events")
    .insert({
      lead_id: leadId,
      event_type: type,
      detail,
      payload: payload ?? null,
      actor: "viewings",
    });
}

const PROPERTY_SELECT =
  "id, title, price, currency, property_type, rooms, area_sqm, address, cover_image_url, cities:city_id(name), quarters:quarter_id(name)";

export const VIEWING_SELECT =
  "*, leads:lead_id(id, full_name, email, phone, status, lead_type, qualification_grade), properties:property_id(id, title, price, currency, property_type, rooms, area_sqm, cover_image_url, cities:city_id(name), quarters:quarter_id(name))";

function propertyLabel(p: any): string {
  if (!p) return "имот по договорка";
  const loc = [p.cities?.name, p.quarters?.name].filter(Boolean).join(", ");
  return [p.title, loc].filter(Boolean).join(" — ");
}

// ------------------------------------------------------------------
// Свободни часове
// ------------------------------------------------------------------
export type Slot = { start: string; end: string; agent_id: string | null };

export async function suggestSlots(
  opts: { agentId?: string | null; days?: number; limit?: number } = {},
): Promise<Slot[]> {
  const settings = await getViewingSettings();
  const days = Math.min(Math.max(opts.days ?? settings.slot_days_ahead, 1), 30);
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 60);
  const agentId = opts.agentId ?? null;

  const { data: rules } = await db()
    .from("viewing_availability")
    .select("*")
    .eq("is_active", true)
    .or(agentId ? `agent_id.eq.${agentId},agent_id.is.null` : "agent_id.is.null");

  const from = new Date();
  const to = new Date(Date.now() + days * 86400_000);
  const [{ data: booked }, { data: blackouts }] = await Promise.all([
    db()
      .from("viewings")
      .select("scheduled_at, duration_min, agent_id, status")
      .gte("scheduled_at", from.toISOString())
      .lte("scheduled_at", to.toISOString())
      .in("status", ["proposed", "confirmed", "rescheduled"]),
    db()
      .from("viewing_blackouts")
      .select("*")
      .lte("starts_at", to.toISOString())
      .gte("ends_at", from.toISOString()),
  ]);

  const taken = ((booked ?? []) as any[]).map((b) => ({
    start: new Date(b.scheduled_at).getTime(),
    end: new Date(b.scheduled_at).getTime() + Number(b.duration_min ?? 45) * 60_000,
    agent_id: b.agent_id ?? null,
  }));
  const blocks = ((blackouts ?? []) as any[]).map((b) => ({
    start: new Date(b.starts_at).getTime(),
    end: new Date(b.ends_at).getTime(),
    agent_id: b.agent_id ?? null,
  }));

  const out: Slot[] = [];
  const minStart = Date.now() + settings.min_lead_hours * 3600_000;

  for (let d = 0; d < days && out.length < limit; d++) {
    const day = new Date(Date.now() + d * 86400_000);
    const weekday = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(day) === "Sun"
        ? 0
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
            new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(day),
          ),
    );
    const rule =
      ((rules ?? []) as any[]).find((r) => r.weekday === weekday && r.agent_id === agentId) ??
      ((rules ?? []) as any[]).find((r) => r.weekday === weekday && !r.agent_id);
    if (!rule) continue;

    const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(day); // YYYY-MM-DD
    const step = Number(rule.slot_minutes ?? 60);
    for (
      let h = Number(rule.start_hour);
      h < Number(rule.end_hour) && out.length < limit;
      h += step / 60
    ) {
      const hh = String(Math.floor(h)).padStart(2, "0");
      const mm = String(Math.round((h % 1) * 60)).padStart(2, "0");
      const start = new Date(`${ymd}T${hh}:${mm}:00${sofiaOffset(day)}`).getTime();
      const end = start + step * 60_000;
      if (start < minStart) continue;
      const busy =
        taken.some(
          (t) =>
            (t.agent_id === agentId || !agentId || !t.agent_id) && start < t.end && end > t.start,
        ) ||
        blocks.some(
          (b) => (b.agent_id === agentId || !b.agent_id) && start < b.end && end > b.start,
        );
      if (busy) continue;
      out.push({
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        agent_id: agentId,
      });
    }
  }
  return out;
}

/** Отместване на София за конкретна дата (+02:00 / +03:00). */
function sofiaOffset(d: Date): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  return (name ?? "GMT+02:00").replace("GMT", "") || "+02:00";
}

// ------------------------------------------------------------------
// Насрочване
// ------------------------------------------------------------------
export type ScheduleInput = {
  leadId?: string | null;
  clientId?: string | null;
  propertyId?: string | null;
  agentId?: string | null;
  agentName?: string | null;
  agentEmail?: string | null;
  agentPhone?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  scheduledAt: string;
  durationMin?: number;
  location?: string | null;
  notes?: string | null;
  source?: string;
  createdBy?: string | null;
  autoConfirm?: boolean;
};

export async function scheduleViewing(
  input: ScheduleInput,
): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) return { ok: false, reason: "Невалидна дата" };
  const settings = await getViewingSettings();
  if (when.getTime() < Date.now() - 3600_000) return { ok: false, reason: "Часът е в миналото" };

  const duration = Math.min(Math.max(input.durationMin ?? 45, 15), 240);

  // Проверка за застъпване при същия брокер
  if (input.agentId) {
    const { data: clash } = await db()
      .from("viewings")
      .select("id, scheduled_at, duration_min")
      .eq("agent_id", input.agentId)
      .in("status", ["proposed", "confirmed", "rescheduled"])
      .gte("scheduled_at", new Date(when.getTime() - 4 * 3600_000).toISOString())
      .lte("scheduled_at", new Date(when.getTime() + 4 * 3600_000).toISOString());
    const overlap = ((clash ?? []) as any[]).some((c) => {
      const s = new Date(c.scheduled_at).getTime();
      return (
        when.getTime() < s + Number(c.duration_min ?? 45) * 60_000 &&
        when.getTime() + duration * 60_000 > s
      );
    });
    if (overlap) return { ok: false, reason: "Брокерът има друг оглед в този час" };
  }

  let lead: any = null;
  if (input.leadId) {
    const { data } = await db().from("leads").select("*").eq("id", input.leadId).maybeSingle();
    lead = data;
  }

  const { data: row, error } = await db()
    .from("viewings")
    .insert({
      lead_id: input.leadId ?? null,
      client_id: input.clientId ?? null,
      property_id: input.propertyId ?? null,
      agent_id: input.agentId ?? null,
      agent_name: input.agentName ?? null,
      agent_email: input.agentEmail ?? null,
      agent_phone: input.agentPhone ?? null,
      contact_name: input.contactName ?? lead?.full_name ?? null,
      contact_email: input.contactEmail ?? lead?.email ?? null,
      contact_phone: input.contactPhone ?? lead?.phone ?? null,
      scheduled_at: when.toISOString(),
      duration_min: duration,
      status: input.autoConfirm ? "confirmed" : "proposed",
      confirmed_at: input.autoConfirm ? new Date().toISOString() : null,
      source: input.source ?? "crm",
      location: input.location ?? null,
      notes: input.notes ?? null,
      token: token(),
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error || !row) return { ok: false, reason: error?.message ?? "Грешка при запис" };

  await planReminders(row.id as string, settings);

  if (input.leadId) {
    const now = new Date().toISOString();
    await db()
      .from("leads")
      .update({
        next_viewing_at: when.toISOString(),
        viewings_count: Number(lead?.viewings_count ?? 0) + 1,
        updated_at: now,
        status: ["new", "contacted"].includes(String(lead?.status))
          ? "viewing_scheduled"
          : lead?.status,
      })
      .eq("id", input.leadId);
    await logEvent(
      input.leadId,
      "viewing_scheduled",
      `Насрочен оглед за ${formatSofia(when.toISOString())}`,
    );
  }

  return { ok: true, id: row.id as string };
}

/** Създава/пренасрочва плана от напомняния за даден оглед. */
export async function planReminders(viewingId: string, settingsIn?: ViewingSettings) {
  const settings = settingsIn ?? (await getViewingSettings());
  const { data: v } = await db().from("viewings").select("*").eq("id", viewingId).maybeSingle();
  if (!v) return;
  const at = new Date(v.scheduled_at).getTime();

  const plan: { kind: string; scheduled_at: number; enabled: boolean; recipient: string | null }[] =
    [
      {
        kind: "invite",
        scheduled_at: Date.now(),
        enabled: settings.send_invite,
        recipient: v.contact_email ?? null,
      },
      {
        kind: "reminder_24h",
        scheduled_at: at - 24 * 3600_000,
        enabled: settings.reminder_24h,
        recipient: v.contact_email ?? null,
      },
      {
        kind: "reminder_2h",
        scheduled_at: at - 2 * 3600_000,
        enabled: settings.reminder_2h,
        recipient: v.contact_email ?? null,
      },
      {
        kind: "agent_brief",
        scheduled_at: at - 3 * 3600_000,
        enabled: settings.agent_brief,
        recipient: v.agent_email ?? null,
      },
      {
        kind: "feedback",
        scheduled_at:
          at + Number(v.duration_min ?? 45) * 60_000 + settings.feedback_delay_hours * 3600_000,
        enabled: settings.feedback_request,
        recipient: v.contact_email ?? null,
      },
    ];

  for (const p of plan) {
    if (!p.enabled) continue;
    const { data: existing } = await db()
      .from("viewing_reminders")
      .select("id, status")
      .eq("viewing_id", viewingId)
      .eq("kind", p.kind)
      .maybeSingle();
    if (existing && existing.status !== "pending") continue;
    await db()
      .from("viewing_reminders")
      .upsert(
        {
          ...(existing ? { id: existing.id } : {}),
          viewing_id: viewingId,
          kind: p.kind,
          channel: "email",
          scheduled_at: new Date(Math.max(p.scheduled_at, Date.now() - 60_000)).toISOString(),
          status: "pending",
          recipient: p.recipient,
        },
        { onConflict: "viewing_id,kind" },
      );
  }
}

async function cancelPendingReminders(viewingId: string, kinds?: string[]) {
  let q = db()
    .from("viewing_reminders")
    .update({ status: "cancelled" })
    .eq("viewing_id", viewingId)
    .eq("status", "pending");
  if (kinds?.length) q = q.in("kind", kinds);
  await q;
}

// ------------------------------------------------------------------
// Промени по статуса
// ------------------------------------------------------------------
export async function confirmViewing(id: string, by = "клиент") {
  const now = new Date().toISOString();
  await db()
    .from("viewings")
    .update({ status: "confirmed", confirmed_at: now, updated_at: now })
    .eq("id", id);
  const { data: v } = await db()
    .from("viewings")
    .select("lead_id, scheduled_at")
    .eq("id", id)
    .maybeSingle();
  await logEvent(
    v?.lead_id ?? null,
    "viewing_confirmed",
    `Огледът за ${formatSofia(v?.scheduled_at ?? now)} е потвърден (${by})`,
  );
  if (v?.lead_id) {
    const { registerLeadActivity } = await import("@/lib/followup.server");
    await registerLeadActivity(v.lead_id as string, "потвърден оглед");
  }
  return { ok: true };
}

export async function cancelViewing(id: string, reason: string, by = "клиент") {
  const now = new Date().toISOString();
  await db()
    .from("viewings")
    .update({ status: "cancelled", cancelled_at: now, cancel_reason: reason, updated_at: now })
    .eq("id", id);
  await cancelPendingReminders(id);
  const { data: v } = await db().from("viewings").select("lead_id").eq("id", id).maybeSingle();
  await logEvent(v?.lead_id ?? null, "viewing_cancelled", `Отменен оглед (${by}): ${reason}`);
  if (v?.lead_id)
    await db().from("leads").update({ next_viewing_at: null, updated_at: now }).eq("id", v.lead_id);
  return { ok: true };
}

export async function rescheduleViewing(id: string, newAt: string, by = "CRM") {
  const when = new Date(newAt);
  if (Number.isNaN(when.getTime())) return { ok: false, reason: "Невалидна дата" };
  const { data: v } = await db().from("viewings").select("*").eq("id", id).maybeSingle();
  if (!v) return { ok: false, reason: "Няма такъв оглед" };
  const now = new Date().toISOString();
  await db()
    .from("viewings")
    .update({
      scheduled_at: when.toISOString(),
      rescheduled_from: v.scheduled_at,
      reschedule_count: Number(v.reschedule_count ?? 0) + 1,
      status: "rescheduled",
      confirmed_at: null,
      updated_at: now,
    })
    .eq("id", id);
  await cancelPendingReminders(id, ["reminder_24h", "reminder_2h", "agent_brief", "feedback"]);
  await db()
    .from("viewing_reminders")
    .delete()
    .eq("viewing_id", id)
    .eq("kind", "invite")
    .eq("status", "pending");
  await planReminders(id);
  if (v.lead_id)
    await db()
      .from("leads")
      .update({ next_viewing_at: when.toISOString(), updated_at: now })
      .eq("id", v.lead_id);
  await logEvent(
    v.lead_id ?? null,
    "viewing_rescheduled",
    `Пренасрочен за ${formatSofia(when.toISOString())} (${by})`,
  );
  return { ok: true };
}

export async function setViewingOutcome(
  id: string,
  outcome: string,
  notes?: string | null,
  status: "completed" | "no_show" = "completed",
) {
  const now = new Date().toISOString();
  await db()
    .from("viewings")
    .update({ status, outcome, outcome_notes: notes ?? null, updated_at: now })
    .eq("id", id);
  const { data: v } = await db()
    .from("viewings")
    .select("lead_id, scheduled_at")
    .eq("id", id)
    .maybeSingle();
  if (v?.lead_id) {
    await db()
      .from("leads")
      .update({ last_viewing_at: v.scheduled_at, next_viewing_at: null, updated_at: now })
      .eq("id", v.lead_id);
    await logEvent(
      v.lead_id as string,
      "viewing_outcome",
      `Резултат от оглед: ${outcome}${notes ? ` — ${notes}` : ""}`,
    );
    if (status === "completed") {
      const { enrollLead } = await import("@/lib/followup.server");
      await enrollLead(v.lead_id as string, {
        trigger: "after_viewing",
        reason: "След проведен оглед",
      });
    }
  }
  return { ok: true };
}

export async function saveViewingFeedback(
  id: string,
  rating: number | null,
  feedback: string | null,
) {
  const now = new Date().toISOString();
  await db()
    .from("viewings")
    .update({ rating, feedback, feedback_at: now, updated_at: now })
    .eq("id", id);
  const { data: v } = await db().from("viewings").select("lead_id").eq("id", id).maybeSingle();
  if (v?.lead_id) {
    await logEvent(
      v.lead_id as string,
      "viewing_feedback",
      `Оценка ${rating ?? "—"}/5: ${feedback ?? "—"}`,
    );
    const { registerLeadActivity } = await import("@/lib/followup.server");
    await registerLeadActivity(v.lead_id as string, "обратна връзка след оглед");
  }
  return { ok: true };
}

export async function getViewingByToken(tok: string) {
  const { data } = await db()
    .from("viewings")
    .select(VIEWING_SELECT)
    .eq("token", tok)
    .maybeSingle();
  return data ?? null;
}

// ------------------------------------------------------------------
// Съдържание на съобщенията
// ------------------------------------------------------------------
type Built = {
  subject: string;
  text: string;
  ai_used: boolean;
  model: string | null;
  blocked?: string;
};

const KIND_LABEL: Record<string, string> = {
  invite: "Покана за оглед",
  reminder_24h: "Напомняне 24 часа",
  reminder_2h: "Напомняне 2 часа",
  agent_brief: "Брифинг за брокера",
  feedback: "Обратна връзка след оглед",
};

async function buildMessage(kind: string, v: any, settings: ViewingSettings): Promise<Built> {
  const when = formatSofia(v.scheduled_at);
  const prop = propertyLabel(v.properties);
  const name = String(v.contact_name ?? "").split(" ")[0] || "клиент";
  const where = v.location ?? v.properties?.address ?? prop;
  const agent = v.agent_name
    ? `${v.agent_name}${v.agent_phone ? `, тел. ${v.agent_phone}` : ""}`
    : "наш брокер";

  let subject: string;
  let text: string;

  if (kind === "invite") {
    subject = `Оглед на ${prop} — ${when}`;
    text = `Здравейте, ${name},\n\nПотвърждаваме предложения час за оглед:\n\n• Имот: ${prop}\n• Дата и час: ${when}\n• Място: ${where}\n• Брокер: ${agent}\n\nМоля, потвърдете с бутона по-долу. Ако часът не Ви е удобен, може да го промените или откажете със същия линк.\n\nПоздрави,\nЕкип „Имоти Надежда“`;
  } else if (kind === "reminder_24h") {
    subject = `Напомняне: оглед утре — ${when}`;
    text = `Здравейте, ${name},\n\nНапомняме Ви за огледа утре:\n\n• Имот: ${prop}\n• Час: ${when}\n• Място: ${where}\n• Брокер: ${agent}\n\nАко нещо се промени, моля уведомете ни през линка по-долу.\n\nПоздрави,\nЕкип „Имоти Надежда“`;
  } else if (kind === "reminder_2h") {
    subject = `След 2 часа: оглед на ${prop}`;
    text = `Здравейте, ${name},\n\nОгледът е след около 2 часа — ${when}, на адрес ${where}. Брокер: ${agent}.\n\nДо скоро!\nЕкип „Имоти Надежда“`;
  } else if (kind === "agent_brief") {
    subject = `Брифинг: оглед ${when} — ${prop}`;
    text = `Оглед след няколко часа.\n\n• Имот: ${prop}\n• Час: ${when}\n• Клиент: ${v.contact_name ?? "—"} (${v.contact_phone ?? "—"}, ${v.contact_email ?? "—"})\n• Статус на клиента: ${v.leads?.status ?? "—"} / оценка ${v.leads?.qualification_grade ?? "—"}\n• Бележки: ${v.notes ?? "—"}\n\nСистемата ще поиска обратна връзка от клиента ${settings.feedback_delay_hours} ч. след огледа.`;
  } else {
    subject = `Как мина огледът на ${prop}?`;
    text = `Здравейте, ${name},\n\nБлагодарим Ви за отделеното време днес. Ще се радваме на кратка обратна връзка за имота — харесва ли Ви и има ли нещо, което да търсим по-различно?\n\nМоже да отговорите с един клик от линка по-долу.\n\nПоздрави,\nЕкип „Имоти Надежда“`;
  }

  if (!settings.ai_enabled || kind === "agent_brief" || listAiProviders().length === 0) {
    return { subject, text, ai_used: false, model: null };
  }

  try {
    const res = await aiChatCompletions({
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "Ти си български брокер на недвижими имоти. Пренапиши съобщението за оглед — учтиво, кратко (до 120 думи), персонално, без емоджи и без обещания за цени. Запази всички факти (имот, дата, час, място, брокер) точно както са подадени. Върни само текста.",
        },
        { role: "user", content: `Тип: ${KIND_LABEL[kind] ?? kind}\n\nЧернова:\n${text}` },
      ],
    });
    if (!res.ok) {
      if (res.status === 402 || res.status === 403) {
        return {
          subject,
          text,
          ai_used: false,
          model: null,
          blocked: `AI е блокиран (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`,
        };
      }
      return { subject, text, ai_used: false, model: null };
    }
    const json = (await res.json()) as any;
    const out = String(json?.choices?.[0]?.message?.content ?? "").trim();
    return out.length > 40
      ? { subject, text: out, ai_used: true, model: json?.model ?? null }
      : { subject, text, ai_used: false, model: null };
  } catch {
    return { subject, text, ai_used: false, model: null };
  }
}

function actionsHtml(tok: string, kind: string): string {
  const base = `${SITE_URL}/api/public/viewings/respond?token=${tok}&action=`;
  if (kind === "feedback") {
    return `<p style="margin-top:22px">
<a href="${base}feedback" style="background:#8b1a2b;color:#f7e3c0;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600">Дайте обратна връзка</a></p>`;
  }
  return `<p style="margin-top:22px">
<a href="${base}confirm" style="background:#8b1a2b;color:#f7e3c0;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;margin-right:8px">Потвърждавам</a>
<a href="${base}reschedule" style="color:#8b1a2b;text-decoration:none;font-weight:600;margin-right:8px">Друг час</a>
<a href="${base}cancel" style="color:#8a7c7f;text-decoration:none">Отказ</a></p>`;
}

// ------------------------------------------------------------------
// Изпращане на едно напомняне
// ------------------------------------------------------------------
export type ReminderResult = "sent" | "manual" | "failed" | "skipped" | "blocked";

export async function runReminder(
  reminderId: string,
  opts: { force?: boolean } = {},
): Promise<{ result: ReminderResult; detail?: string }> {
  const settings = await getViewingSettings();
  const { data: r } = await db()
    .from("viewing_reminders")
    .select("*")
    .eq("id", reminderId)
    .maybeSingle();
  if (!r) return { result: "skipped", detail: "Няма такова напомняне" };
  if (r.status !== "pending") return { result: "skipped", detail: `Статус ${r.status}` };

  const { data: v } = await db()
    .from("viewings")
    .select(VIEWING_SELECT)
    .eq("id", r.viewing_id)
    .maybeSingle();
  if (!v) {
    await db()
      .from("viewing_reminders")
      .update({ status: "cancelled", error: "Огледът липсва" })
      .eq("id", r.id);
    return { result: "skipped", detail: "Огледът липсва" };
  }
  if (["cancelled"].includes(String(v.status))) {
    await db().from("viewing_reminders").update({ status: "cancelled" }).eq("id", r.id);
    return { result: "skipped", detail: "Отменен оглед" };
  }
  if (r.kind === "feedback" && String(v.status) === "no_show") {
    await db().from("viewing_reminders").update({ status: "skipped" }).eq("id", r.id);
    return { result: "skipped", detail: "Клиентът не се яви" };
  }
  if (!opts.force && r.kind !== "agent_brief" && inQuietHours(settings)) {
    return { result: "skipped", detail: "Тихи часове" };
  }

  const built = await buildMessage(String(r.kind), v, settings);
  if (built.blocked) {
    await pauseViewingJob(built.blocked);
    return { result: "blocked", detail: built.blocked };
  }

  const recipient = r.kind === "agent_brief" ? v.agent_email : v.contact_email;
  if (!recipient) {
    await db()
      .from("viewing_reminders")
      .update({
        status: "manual",
        subject: built.subject,
        body: built.text,
        ai_used: built.ai_used,
        model: built.model,
      })
      .eq("id", r.id);
    await logEvent(
      v.lead_id ?? null,
      "viewing_reminder_manual",
      `${KIND_LABEL[r.kind] ?? r.kind} — няма имейл, за ръчно изпращане`,
    );
    return { result: "manual" };
  }

  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.65;color:#3a2a2e;white-space:pre-wrap">${esc(built.text)}</div>
${r.kind === "agent_brief" ? "" : actionsHtml(String(v.token), String(r.kind))}
<p style="font-size:12px;color:#8a7c7f;font-family:system-ui,sans-serif;margin-top:18px">Имоти Надежда · imotinadezhda.bg</p>`;

  try {
    await sendTransactionalEmail({
      to: String(recipient),
      subject: built.subject,
      text: built.text,
      html,
      purpose: "viewing_reminder",
      label: `viewing-${r.kind}`,
      idempotency_key: r.id as string,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await db().from("viewing_reminders").update({ status: "failed", error: detail }).eq("id", r.id);
    return { result: "failed", detail };
  }

  const now = new Date().toISOString();
  await db()
    .from("viewing_reminders")
    .update({
      status: "sent",
      sent_at: now,
      subject: built.subject,
      body: built.text,
      ai_used: built.ai_used,
      model: built.model,
      error: null,
    })
    .eq("id", r.id);
  await db()
    .from("viewings")
    .update({
      reminders_sent: Number(v.reminders_sent ?? 0) + 1,
      ai_used: v.ai_used || built.ai_used,
      updated_at: now,
    })
    .eq("id", v.id);
  await logEvent(
    v.lead_id ?? null,
    "viewing_reminder_sent",
    `${KIND_LABEL[r.kind] ?? r.kind} — изпратено до ${recipient}`,
  );
  return { result: "sent" };
}

// ------------------------------------------------------------------
// Cron: дължими напомняния + авто-статуси
// ------------------------------------------------------------------
export async function runViewingsSweep(limitOverride?: number): Promise<{
  ran: boolean;
  reason?: string;
  processed: number;
  sent: number;
  manual: number;
  failed: number;
  skipped: number;
  no_show: number;
  paused?: boolean;
}> {
  const settings = await getViewingSettings();
  const empty = { processed: 0, sent: 0, manual: 0, failed: 0, skipped: 0, no_show: 0 };
  if (!settings.enabled) return { ran: false, reason: "Автоматизацията е изключена", ...empty };

  const state = await getViewingJobState();
  const probeOnly = state.paused;
  if (!(await claimJob(settings.lease_seconds)))
    return { ran: false, reason: "Друг цикъл вече работи", ...empty };

  const limit = Math.min(Math.max(limitOverride ?? settings.batch_size, 1), 100);
  const stats = { ...empty };

  try {
    if (!probeOnly) {
      // Непотвърдени огледи, чийто час е минал → отбелязваме като „не се яви“
      const cutoff = new Date(Date.now() - settings.auto_no_show_hours * 3600_000).toISOString();
      const { data: stale } = await db()
        .from("viewings")
        .select("id, lead_id")
        .in("status", ["proposed", "rescheduled"])
        .lte("scheduled_at", cutoff)
        .limit(limit);
      for (const s of (stale ?? []) as any[]) {
        await db()
          .from("viewings")
          .update({ status: "no_show", updated_at: new Date().toISOString() })
          .eq("id", s.id);
        await cancelPendingReminders(s.id as string);
        await logEvent(
          s.lead_id ?? null,
          "viewing_no_show",
          "Огледът остана непотвърден и е отбелязан като неосъществен",
        );
        stats.no_show++;
      }
    }

    const { data: due } = await db()
      .from("viewing_reminders")
      .select("id")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(probeOnly ? 1 : limit);

    for (const r of (due ?? []) as any[]) {
      stats.processed++;
      const res = await runReminder(r.id as string);
      if (res.result === "sent") stats.sent++;
      else if (res.result === "manual") stats.manual++;
      else if (res.result === "failed") stats.failed++;
      else if (res.result === "blocked") {
        await releaseJob({ ...stats, blocked: res.detail ?? null, at: new Date().toISOString() });
        return { ran: true, reason: res.detail, paused: true, ...stats };
      } else stats.skipped++;
    }

    if (probeOnly && stats.sent > 0) await resumeViewingJob();
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
export async function viewingsAnalytics() {
  const [{ data: vs }, { data: rs }] = await Promise.all([
    db()
      .from("viewings")
      .select(
        "status, outcome, rating, scheduled_at, created_at, confirmed_at, reschedule_count, source, agent_name",
      )
      .limit(5000),
    db().from("viewing_reminders").select("kind, status, ai_used, created_at").limit(5000),
  ]);
  const v = (vs ?? []) as any[];
  const r = (rs ?? []) as any[];
  const now = Date.now();
  const week = now - 7 * 86400_000;

  const byStatus: Record<string, number> = {};
  for (const x of v) byStatus[String(x.status)] = (byStatus[String(x.status)] ?? 0) + 1;
  const byOutcome: Record<string, number> = {};
  for (const x of v)
    if (x.outcome) byOutcome[String(x.outcome)] = (byOutcome[String(x.outcome)] ?? 0) + 1;
  const bySource: Record<string, number> = {};
  for (const x of v)
    bySource[String(x.source ?? "—")] = (bySource[String(x.source ?? "—")] ?? 0) + 1;

  const done = v.filter((x) => ["completed", "no_show"].includes(String(x.status)));
  const ratings = v.filter((x) => typeof x.rating === "number");
  const confirmed = v.filter((x) => x.confirmed_at).length;
  const sentReminders = r.filter((x) => x.status === "sent");

  return {
    total: v.length,
    upcoming: v.filter(
      (x) =>
        new Date(x.scheduled_at).getTime() > now &&
        ["proposed", "confirmed", "rescheduled"].includes(String(x.status)),
    ).length,
    thisWeek: v.filter(
      (x) =>
        new Date(x.scheduled_at).getTime() > now &&
        new Date(x.scheduled_at).getTime() < now + 7 * 86400_000,
    ).length,
    createdThisWeek: v.filter((x) => new Date(x.created_at).getTime() >= week).length,
    completed: byStatus["completed"] ?? 0,
    noShow: byStatus["no_show"] ?? 0,
    cancelled: byStatus["cancelled"] ?? 0,
    confirmRate: v.length ? Math.round((confirmed / v.length) * 100) : 0,
    showRate: done.length ? Math.round(((byStatus["completed"] ?? 0) / done.length) * 100) : 0,
    rescheduled: v.filter((x) => Number(x.reschedule_count ?? 0) > 0).length,
    avgRating: ratings.length
      ? Math.round((ratings.reduce((s, x) => s + Number(x.rating), 0) / ratings.length) * 10) / 10
      : 0,
    remindersSent: sentReminders.length,
    remindersPending: r.filter((x) => x.status === "pending").length,
    remindersFailed: r.filter((x) => x.status === "failed").length,
    aiUsedPct: sentReminders.length
      ? Math.round((sentReminders.filter((x) => x.ai_used).length / sentReminders.length) * 100)
      : 0,
    byStatus,
    byOutcome,
    bySource,
  };
}
