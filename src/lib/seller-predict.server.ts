// Автоматизация №19 — AI Прогнозиране на Продавачи.
// Откриване на потенциални продавачи, скоринг по сигнали + AI, подход за контакт.
// Без зависимост от Lovable: Supabase + конфигуриран AI провайдър.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiChatCompletions } from "@/lib/ai-provider";

const db = () =>
  supabaseAdmin as unknown as {
    from: (t: string) => any;
    rpc: (fn: string, args?: unknown) => any;
  };

const JOB_KEY = "seller_prediction_sweep";
const SETTINGS_KEY = "seller_prediction";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const nowIso = () => new Date().toISOString();

export type SellerSettings = {
  enabled: boolean;
  ai_enabled: boolean;
  auto_score_new: boolean;
  hot_threshold: number;
  warm_threshold: number;
  auto_assign_broker: boolean;
  batch_size: number;
  lease_seconds: number;
  follow_up_days: number;
};

export const DEFAULT_SELLER_SETTINGS: SellerSettings = {
  enabled: true,
  ai_enabled: true,
  auto_score_new: true,
  hot_threshold: 70,
  warm_threshold: 45,
  auto_assign_broker: false,
  batch_size: 25,
  lease_seconds: 300,
  follow_up_days: 14,
};

export async function getSellerSettings(): Promise<SellerSettings> {
  const { data } = await db()
    .from("automation_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return { ...DEFAULT_SELLER_SETTINGS, ...((data?.value ?? {}) as Partial<SellerSettings>) };
}

export async function saveSellerSettings(patch: Partial<SellerSettings>): Promise<SellerSettings> {
  const next = { ...(await getSellerSettings()), ...patch };
  const { error } = await db()
    .from("automation_settings")
    .upsert({ key: SETTINGS_KEY, value: next, updated_at: nowIso() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return next;
}

export async function getSellerJobState() {
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

export async function resumeSellerJob() {
  await db()
    .from("automation_jobs")
    .upsert(
      {
        key: JOB_KEY,
        paused: false,
        paused_reason: null,
        locked_until: null,
        updated_at: nowIso(),
      },
      { onConflict: "key" },
    );
  return getSellerJobState();
}

async function logEvent(
  prospectId: string | null,
  type: string,
  status: "ok" | "warn" | "error",
  message?: string | null,
  payload?: Record<string, unknown>,
  actor?: string | null,
) {
  await db()
    .from("seller_events")
    .insert({
      prospect_id: prospectId,
      event_type: type,
      status,
      message: message ?? null,
      payload: payload ?? {},
      actor: actor ?? "crm",
    });
}

// ------------------------------------------------------------------
// Правила и сигнали
// ------------------------------------------------------------------
export async function listSignalRules() {
  const { data, error } = await db()
    .from("seller_signal_rules")
    .select("*")
    .order("weight", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveSignalRule(input: {
  id?: string | null;
  code: string;
  label: string;
  weight?: number;
  is_active?: boolean;
  description?: string | null;
}) {
  const row = {
    code: input.code.trim(),
    label: input.label.trim(),
    weight: Math.round(num(input.weight ?? 5)),
    is_active: input.is_active ?? true,
    description: input.description ?? null,
    updated_at: nowIso(),
  };
  const { error } = await db()
    .from("seller_signal_rules")
    .upsert(input.id ? { id: input.id, ...row } : row, { onConflict: "code" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function listSignals(prospectId?: string) {
  let q = db()
    .from("seller_signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(400);
  if (prospectId) q = q.eq("prospect_id", prospectId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addSignal(
  input: {
    prospect_id: string;
    signal_code: string;
    value?: string | null;
    source?: string | null;
  },
  actor?: string | null,
) {
  const rules = await listSignalRules();
  const rule = rules.find((r: any) => r.code === input.signal_code);
  const { error } = await db()
    .from("seller_signals")
    .insert({
      prospect_id: input.prospect_id,
      signal_code: input.signal_code,
      weight: Math.round(num(rule?.weight ?? 5)),
      value: input.value ?? null,
      source: input.source ?? "crm",
    });
  if (error) throw new Error(error.message);
  await logEvent(
    input.prospect_id,
    "signal",
    "ok",
    `Сигнал: ${rule?.label ?? input.signal_code}`,
    { code: input.signal_code },
    actor,
  );
  return scoreProspect(input.prospect_id, actor);
}

export async function removeSignal(id: string) {
  const { data } = await db()
    .from("seller_signals")
    .select("prospect_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await db().from("seller_signals").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (data?.prospect_id) await scoreProspect(data.prospect_id);
  return { ok: true };
}

// ------------------------------------------------------------------
// Потенциални продавачи
// ------------------------------------------------------------------
export async function listProspects(filter?: {
  status?: string;
  city?: string;
  minScore?: number;
}) {
  let q = db().from("seller_prospects").select("*").order("score", { ascending: false }).limit(500);
  if (filter?.status) q = q.eq("status", filter.status);
  if (filter?.city) q = q.eq("city", filter.city);
  if (filter?.minScore) q = q.gte("score", filter.minScore);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type ProspectInput = {
  id?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  property_type?: string | null;
  rooms?: number | null;
  area?: number | null;
  build_year?: number | null;
  estimated_price?: number | null;
  currency?: string | null;
  ownership_years?: number | null;
  source?: string | null;
  source_ref?: string | null;
  property_id?: string | null;
  client_id?: string | null;
  broker_id?: string | null;
  status?: string | null;
  notes?: string | null;
  next_action_at?: string | null;
};

export async function saveProspect(input: ProspectInput, actor?: string | null) {
  const row: Record<string, unknown> = {
    full_name: input.full_name?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    city: input.city?.trim() || null,
    district: input.district?.trim() || null,
    address: input.address?.trim() || null,
    property_type: input.property_type || null,
    rooms: input.rooms == null ? null : Math.round(num(input.rooms)),
    area: input.area == null ? null : num(input.area),
    build_year: input.build_year == null ? null : Math.round(num(input.build_year)),
    estimated_price: input.estimated_price == null ? null : num(input.estimated_price),
    currency: input.currency || "EUR",
    ownership_years: input.ownership_years == null ? null : num(input.ownership_years),
    source: input.source || "manual",
    source_ref: input.source_ref || null,
    property_id: input.property_id || null,
    client_id: input.client_id || null,
    broker_id: input.broker_id || null,
    notes: input.notes ?? null,
    next_action_at: input.next_action_at || null,
    updated_at: nowIso(),
  };
  if (input.status) row.status = input.status;

  if (input.id) {
    const { error } = await db().from("seller_prospects").update(row).eq("id", input.id);
    if (error) throw new Error(error.message);
    await logEvent(input.id, "status", "ok", "Обновен потенциален продавач", {}, actor);
    return scoreProspect(input.id, actor);
  }

  const { data, error } = await db()
    .from("seller_prospects")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const id = data?.id as string;
  await logEvent(id, "created", "ok", "Нов потенциален продавач", { source: row.source }, actor);
  const settings = await getSellerSettings();
  if (settings.auto_score_new) await scoreProspect(id, actor);
  return { ok: true, id };
}

export async function setProspectStatus(id: string, status: string, actor?: string | null) {
  const patch: Record<string, unknown> = { status, updated_at: nowIso() };
  if (status === "not_interested") patch.opted_out = true;
  const { error } = await db().from("seller_prospects").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(id, "status", "ok", `Статус: ${status}`, {}, actor);
  return { ok: true };
}

export async function deleteProspect(id: string) {
  const { error } = await db().from("seller_prospects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ------------------------------------------------------------------
// Скоринг (правила + евристики)
// ------------------------------------------------------------------
function windowFor(score: number): string {
  if (score >= 80) return "0-3м";
  if (score >= 60) return "3-6м";
  if (score >= 40) return "6-12м";
  return "12м+";
}

export async function scoreProspect(id: string, actor?: string | null) {
  const { data: p } = await db().from("seller_prospects").select("*").eq("id", id).maybeSingle();
  if (!p) throw new Error("Записът не е намерен.");
  const [{ data: signals }, rules] = await Promise.all([
    db().from("seller_signals").select("signal_code, weight").eq("prospect_id", id),
    listSignalRules(),
  ]);
  const activeCodes = new Set(
    (rules ?? []).filter((r: any) => r.is_active).map((r: any) => r.code),
  );

  const seen = new Set<string>();
  let signalScore = 0;
  for (const s of signals ?? []) {
    if (!activeCodes.has(s.signal_code) || seen.has(s.signal_code)) continue;
    seen.add(s.signal_code);
    signalScore += num(s.weight);
  }

  // евристики
  let heur = 0;
  if (num(p.ownership_years) >= 10) heur += 6;
  if (num(p.build_year) > 0 && num(p.build_year) < 1990) heur += 3;
  if (p.phone) heur += 4;
  if (p.email) heur += 2;
  if (p.address) heur += 2;
  if (num(p.estimated_price) > 0) heur += 2;
  if (p.source === "owner_inquiry" || p.source === "referral") heur += 5;
  if (p.opted_out) heur -= 40;

  const score = Math.round(clamp(signalScore + heur));
  const probability = Math.round(clamp(score * 0.9 + (seen.size >= 3 ? 8 : 0)) * 100) / 100;

  const { error } = await db()
    .from("seller_prospects")
    .update({
      score,
      probability,
      expected_window: windowFor(score),
      status: p.status === "new" ? "scored" : p.status,
      updated_at: nowIso(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(
    id,
    "scored",
    "ok",
    `Скор: ${score}`,
    { signalScore, heur, signals: [...seen] },
    actor,
  );
  return { ok: true, id, score, probability, expected_window: windowFor(score) };
}

export async function rescoreAll(actor?: string | null) {
  const { data } = await db().from("seller_prospects").select("id").limit(1000);
  let updated = 0;
  for (const r of data ?? []) {
    try {
      await scoreProspect(r.id, actor);
      updated += 1;
    } catch {
      /* пропускаме единични грешки */
    }
  }
  return { updated };
}

// ------------------------------------------------------------------
// AI прогноза и подход за контакт
// ------------------------------------------------------------------
async function aiText(system: string, user: unknown, temperature = 0.4): Promise<string> {
  const res = await aiChatCompletions({
    messages: [
      { role: "system", content: system },
      { role: "user", content: typeof user === "string" ? user : JSON.stringify(user) },
    ],
    temperature,
  });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
  const json = (await res.json()) as any;
  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}

export async function generateAiPrediction(id: string, actor?: string | null) {
  const settings = await getSellerSettings();
  if (!settings.ai_enabled) throw new Error("AI е изключен в настройките на модула.");
  const { data: p } = await db().from("seller_prospects").select("*").eq("id", id).maybeSingle();
  if (!p) throw new Error("Записът не е намерен.");
  const { data: signals } = await db()
    .from("seller_signals")
    .select("signal_code, value, weight")
    .eq("prospect_id", id);

  const raw = await aiText(
    [
      "Ти си анализатор на българска агенция за недвижими имоти „Имоти Надежда“.",
      "Оцени вероятността собственикът да продаде имота в следващите 12 месеца.",
      "Върни само валиден JSON без коментари със структура:",
      '{"probability": число 0-100, "window": "0-3м|3-6м|6-12м|12м+", "reasoning": "до 500 знака на български", "pitch": "до 600 знака — конкретен подход за първи контакт на български"}',
    ].join(" "),
    { prospect: p, signals: signals ?? [] },
    0.3,
  );

  let parsed: any = {};
  try {
    parsed = JSON.parse(
      raw
        .replace(/^```json/i, "")
        .replace(/```$/, "")
        .trim(),
    );
  } catch {
    parsed = { reasoning: raw.slice(0, 500), pitch: "" };
  }

  const probability = Math.round(clamp(num(parsed.probability) || num(p.probability)) * 100) / 100;
  const { error } = await db()
    .from("seller_prospects")
    .update({
      probability,
      expected_window: parsed.window || p.expected_window || windowFor(num(p.score)),
      ai_reasoning: parsed.reasoning ?? null,
      ai_pitch: parsed.pitch ?? null,
      ai_updated_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(id, "ai_pitch", "ok", "AI прогноза и подход", { probability }, actor);
  return {
    ok: true,
    probability,
    reasoning: parsed.reasoning ?? null,
    pitch: parsed.pitch ?? null,
    window: parsed.window ?? null,
  };
}

// ------------------------------------------------------------------
// Контакти
// ------------------------------------------------------------------
export async function listOutreach(prospectId?: string) {
  let q = db()
    .from("seller_outreach")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(400);
  if (prospectId) q = q.eq("prospect_id", prospectId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function logOutreach(
  input: {
    prospect_id: string;
    channel?: string;
    subject?: string | null;
    body?: string | null;
    status?: string;
    outcome?: string | null;
    scheduled_at?: string | null;
    ai_used?: boolean;
  },
  actor?: string | null,
) {
  const status = input.status ?? "sent";
  const { error } = await db()
    .from("seller_outreach")
    .insert({
      prospect_id: input.prospect_id,
      channel: input.channel ?? "phone",
      subject: input.subject ?? null,
      body: input.body ?? null,
      status,
      outcome: input.outcome ?? null,
      scheduled_at: input.scheduled_at ?? null,
      sent_at: status === "sent" || status === "answered" ? nowIso() : null,
      ai_used: Boolean(input.ai_used),
      actor: actor ?? "crm",
    });
  if (error) throw new Error(error.message);

  const settings = await getSellerSettings();
  const patch: Record<string, unknown> = { updated_at: nowIso() };
  if (status === "sent" || status === "answered" || status === "no_answer") {
    patch.last_contacted_at = nowIso();
    patch.next_action_at = new Date(Date.now() + settings.follow_up_days * 86400000).toISOString();
  }
  const { data: cur } = await db()
    .from("seller_prospects")
    .select("status")
    .eq("id", input.prospect_id)
    .maybeSingle();
  if (cur?.status === "new" || cur?.status === "scored") patch.status = "contacted";
  if (status === "refused") {
    patch.status = "not_interested";
    patch.opted_out = true;
  }
  await db().from("seller_prospects").update(patch).eq("id", input.prospect_id);
  await logEvent(
    input.prospect_id,
    "outreach",
    "ok",
    `Контакт (${input.channel ?? "phone"}) — ${status}`,
    {},
    actor,
  );
  return { ok: true };
}

/** AI генерира скрипт/съобщение за конкретен канал. */
export async function generateOutreachMessage(id: string, channel: string, actor?: string | null) {
  const settings = await getSellerSettings();
  if (!settings.ai_enabled) throw new Error("AI е изключен в настройките на модула.");
  const { data: p } = await db().from("seller_prospects").select("*").eq("id", id).maybeSingle();
  if (!p) throw new Error("Записът не е намерен.");
  const text = await aiText(
    `Ти си брокер в „Имоти Надежда“. Напиши учтиво съобщение на български за канал ${channel} към собственик на имот, което предлага безплатна пазарна оценка и съдействие при продажба. Без агресивна продажба, максимум 700 знака, персонализирано по данните.`,
    { prospect: p },
    0.6,
  );
  await logEvent(id, "ai_pitch", "ok", `AI съобщение (${channel})`, {}, actor);
  return { message: text };
}

// ------------------------------------------------------------------
// Откриване на кандидати от CRM данни
// ------------------------------------------------------------------
export async function discoverProspects(actor?: string | null) {
  const stats = { scanned: 0, created: 0, signals: 0 };

  // 1) Наеми, които приключват — собственикът може да продаде
  const { data: rentals } = await db()
    .from("rentals")
    .select("id, owner_name, owner_phone, city, property_id, end_date, status")
    .limit(200);
  for (const r of rentals ?? []) {
    stats.scanned += 1;
    if (!r?.owner_phone) continue;
    const { data: exists } = await db()
      .from("seller_prospects")
      .select("id")
      .eq("phone", r.owner_phone)
      .limit(1)
      .maybeSingle();
    let pid = exists?.id as string | undefined;
    if (!pid) {
      const created = await saveProspect(
        {
          full_name: r.owner_name ?? null,
          phone: r.owner_phone,
          city: r.city ?? null,
          property_id: r.property_id ?? null,
          source: "rental",
          source_ref: r.id,
        },
        actor,
      );
      pid = (created as { id?: string }).id;
      if (pid) stats.created += 1;
    }
    if (pid && r.end_date && String(r.end_date) <= new Date().toISOString().slice(0, 10)) {
      await addSignal(
        {
          prospect_id: pid,
          signal_code: "rental_ended",
          value: String(r.end_date),
          source: "system",
        },
        actor,
      );
      stats.signals += 1;
    }
  }

  // 2) Собственици, изпратили запитване за оценка
  const { data: inquiries } = await db()
    .from("inquiries")
    .select("id, name, phone, email, city, message, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  for (const q of inquiries ?? []) {
    stats.scanned += 1;
    const msg = String(q?.message ?? "").toLowerCase();
    const wantsSell = /продам|продажб|оценк|собственик|искам да продам/.test(msg);
    if (!wantsSell || !q?.phone) continue;
    const { data: exists } = await db()
      .from("seller_prospects")
      .select("id")
      .eq("phone", q.phone)
      .limit(1)
      .maybeSingle();
    let pid = exists?.id as string | undefined;
    if (!pid) {
      const created = await saveProspect(
        {
          full_name: q.name ?? null,
          phone: q.phone,
          email: q.email ?? null,
          city: q.city ?? null,
          source: "owner_inquiry",
          source_ref: q.id,
        },
        actor,
      );
      pid = (created as { id?: string }).id;
      if (pid) stats.created += 1;
    }
    if (pid) {
      await addSignal(
        {
          prospect_id: pid,
          signal_code: "owner_inquiry",
          value: msg.slice(0, 200),
          source: "system",
        },
        actor,
      );
      stats.signals += 1;
    }
  }

  await logEvent(null, "sweep", "ok", "Откриване на потенциални продавачи", stats, actor);
  return stats;
}

// ------------------------------------------------------------------
// Analytics
// ------------------------------------------------------------------
export async function getSellerAnalytics() {
  const settings = await getSellerSettings();
  const { data } = await db().from("seller_prospects").select("*");
  const rows = data ?? [];
  const { data: outreach } = await db().from("seller_outreach").select("status, channel");
  const { data: signals } = await db().from("seller_signals").select("signal_code");

  const hot = rows.filter((r: any) => num(r.score) >= settings.hot_threshold);
  const warm = rows.filter(
    (r: any) => num(r.score) >= settings.warm_threshold && num(r.score) < settings.hot_threshold,
  );
  const won = rows.filter((r: any) => r.status === "listing_won");
  const contacted = rows.filter((r: any) => Boolean(r.last_contacted_at));

  const byStatus = new Map<string, number>();
  for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);

  const byCity = new Map<string, { city: string; total: number; hot: number; avg: number }>();
  for (const r of rows) {
    const k = r.city ?? "—";
    const e = byCity.get(k) ?? { city: k, total: 0, hot: 0, avg: 0 };
    e.total += 1;
    if (num(r.score) >= settings.hot_threshold) e.hot += 1;
    e.avg += num(r.score);
    byCity.set(k, e);
  }
  const cities = [...byCity.values()]
    .map((c) => ({ ...c, avg: Math.round(c.avg / Math.max(1, c.total)) }))
    .sort((a, b) => b.total - a.total);

  const bySignal = new Map<string, number>();
  for (const s of signals ?? [])
    bySignal.set(s.signal_code, (bySignal.get(s.signal_code) ?? 0) + 1);

  const byChannel = new Map<string, number>();
  for (const o of outreach ?? []) byChannel.set(o.channel, (byChannel.get(o.channel) ?? 0) + 1);

  const pipelineValue = Math.round(
    rows.reduce(
      (s: number, r: any) => s + num(r.estimated_price) * (num(r.probability) / 100 || 0),
      0,
    ),
  );

  return {
    kpi: {
      total: rows.length,
      hot: hot.length,
      warm: warm.length,
      contacted: contacted.length,
      won: won.length,
      avg_score: rows.length
        ? Math.round(rows.reduce((s: number, r: any) => s + num(r.score), 0) / rows.length)
        : 0,
      conversion: contacted.length ? Math.round((won.length / contacted.length) * 100) : 0,
      pipeline_value: pipelineValue,
      hot_threshold: settings.hot_threshold,
      warm_threshold: settings.warm_threshold,
    },
    by_status: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
    by_city: cities.slice(0, 12),
    by_signal: [...bySignal.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
    by_channel: [...byChannel.entries()].map(([channel, count]) => ({ channel, count })),
    top: [...rows]
      .sort((a: any, b: any) => num(b.score) - num(a.score))
      .slice(0, 10)
      .map((r: any) => ({
        id: r.id,
        name: r.full_name,
        city: r.city,
        score: num(r.score),
        probability: num(r.probability),
        window: r.expected_window,
      })),
  };
}

export async function listSellerEvents() {
  const { data, error } = await db()
    .from("seller_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ------------------------------------------------------------------
// Sweep
// ------------------------------------------------------------------
export async function runSellerSweep() {
  const settings = await getSellerSettings();
  if (!settings.enabled) return { skipped: "disabled" as const };
  const job = await getSellerJobState();
  if (job.paused) return { skipped: "paused" as const, reason: job.paused_reason };

  const claimed = await db().rpc("claim_automation_job", {
    _key: JOB_KEY,
    _lease_seconds: settings.lease_seconds,
  });
  if (claimed?.error) throw new Error(claimed.error.message);
  if (claimed?.data === false) return { skipped: "locked" as const };

  const stats: Record<string, number> = { discovered: 0, created: 0, scored: 0, due: 0 };
  try {
    const found = await discoverProspects("cron");
    stats.discovered = found.scanned;
    stats.created = found.created;

    const { data: pending } = await db()
      .from("seller_prospects")
      .select("id")
      .in("status", ["new", "scored", "contacted"])
      .order("updated_at", { ascending: true })
      .limit(settings.batch_size);
    for (const r of pending ?? []) {
      await scoreProspect(r.id, "cron");
      stats.scored += 1;
    }

    const { data: due } = await db()
      .from("seller_prospects")
      .select("id")
      .lte("next_action_at", nowIso())
      .eq("opted_out", false)
      .limit(100);
    stats.due = (due ?? []).length;

    await db()
      .from("automation_jobs")
      .upsert(
        { key: JOB_KEY, last_run_at: nowIso(), locked_until: null, stats, updated_at: nowIso() },
        { onConflict: "key" },
      );
    await logEvent(null, "sweep", "ok", "Sweep завършен", stats, "cron");
    return { ok: true as const, stats };
  } catch (e) {
    await db()
      .from("automation_jobs")
      .upsert(
        { key: JOB_KEY, last_run_at: nowIso(), locked_until: null, updated_at: nowIso() },
        { onConflict: "key" },
      );
    await logEvent(null, "error", "error", (e as Error).message, stats, "cron");
    throw e;
  }
}
